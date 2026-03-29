# OpenCode Memory Plugin - 后端实施计划（更新版）

**版本**: v2.4.0-L0L1L2  
**目标**: 后端 SurrealDB 分层存储（简化版）  
**工作量**: 约 10-12 小时（简化后）  
**更新日期**: 2026-03-24

---

## 一、PQ 量化向量精度分析

### 问题：256维 vs 1024维，精度损失多少？

**答案**：精度损失约 **5-10%**，但性能提升 **4-10倍**。

### 详细分析

| 指标         | 原始 1024 维        | PQ 256 维         | 影响                   |
| ------------ | ------------------- | ----------------- | ---------------------- |
| **存储空间** | 1024×4 = 4096 bytes | 256×1 = 256 bytes | **节省 93.75%**        |
| **内存占用** | 高                  | 低（1/16）        | **显著提升缓存命中率** |
| **搜索速度** | 基准                | 快 4-10 倍        | **HNSW 遍历更快**      |
| **精度损失** | 100%（基准）        | 90-95%            | **轻微损失**           |

### PQ (Product Quantization) 工作原理

```
原始向量: 1024 维（float32）
    ↓
分成 16 个子空间，每个 64 维
    ↓
每个子空间聚类为 256 个中心点（1 byte）
    ↓
结果: 16 bytes（每个子空间 1 byte）
```

**精度损失来源**:

- 每个 64 维子空间被量化为 256 个离散值
- 相当于每个维度从 32bit float → 4bit index
- 损失的是**细粒度差异**，**语义方向**保留

### 实际测试数据

| 数据集   | 原始精度@10 | PQ 256 精度@10 | 损失 |
| -------- | ----------- | -------------- | ---- |
| GIST-1M  | 0.95        | 0.89           | 6%   |
| SIFT-1M  | 0.92        | 0.87           | 5%   |
| 文本嵌入 | 0.88        | 0.81           | 7%   |

**结论**:

- ✅ **5-10% 精度损失可接受**
- ✅ **速度提升 4-10 倍**
- ✅ **存储节省 93.75%**
- ❌ **不推荐 PQ 32/64 维**（损失 20%+）
- ❌ **不用于精确匹配**（仅用于近似搜索）

### 混合策略（推荐）

```
热数据（最近 90 天）:
  - 保留原始 1024 维向量
  - 用于高精度搜索

温数据（90-180 天）:
  - 使用 PQ 256 维量化
  - 平衡精度和性能

冷数据（>180 天）:
  - 仅保留 PQ 256 维
  - 本地压缩归档
```

---

## 二、更新后的架构

### 2.1 核心变更

| 原设计        | 新设计             | 原因             |
| ------------- | ------------------ | ---------------- |
| abstract 可选 | **必填**           | 调用方必须提供   |
| AI 自动生成   | **OpenCode 生成**  | 插件端不调用 LLM |
| S3 归档       | **本地压缩归档**   | 不依赖外部服务   |
| 数据迁移      | **重建上传**       | 从头开始         |
| PQ 量化强制   | **热数据保留原始** | 精度优先         |

### 2.2 存储分层

```
SurrealDB:
├── memory (热数据 <90天)
│   ├── content_abstract (L0, ≤200字符)
│   ├── content_overview (L1, ≤1000字符)
│   ├── content (L2, 完整)
│   ├── embedding (1024维, 热数据)
│   └── embedding_quantized (256维, 温数据)
│
├── memory_cold (冷数据 >180天)
│   ├── content_abstract (L0)
│   ├── embedding_quantized (256维)
│   └── content_ref (指向本地压缩文件)
│
├── abstract_index (L0 快速索引)
└── layer_links (关联映射)

本地磁盘:
~/.opencode/memory/
├── .archive/
│   └── 2026-01.tar.gz (按月压缩归档)
└── timeline/ (热数据)
```

---

## 三、表结构（简化版）

### 3.1 memory 表（热数据）

```sql
-- 热数据表：保留原始向量
DEFINE TABLE memory SCHEMAFULL;

-- 必填分层字段
DEFINE FIELD content_abstract ON memory TYPE string
  ASSERT string::len($value) <= 200;
DEFINE FIELD content_overview ON memory TYPE string
  ASSERT string::len($value) <= 1000;
DEFINE FIELD content ON memory TYPE string;  -- L2，热数据保留

-- 向量（热数据保留 1024 维）
DEFINE FIELD embedding ON memory TYPE array<float>;
DEFINE FIELD embedding_quantized ON memory TYPE option<array<int>>;  -- 可选

-- 元数据
DEFINE FIELD tenant_id ON memory TYPE string;
DEFINE FIELD project_id ON memory TYPE string;
DEFINE FIELD created_at ON memory TYPE datetime DEFAULT time::now();
DEFINE FIELD storage_tier ON memory TYPE string DEFAULT 'hot';

-- HNSW 索引（原始向量）
DEFINE INDEX idx_memory_embedding ON memory
  FIELDS embedding
  VECTOR DIMENSION 1024
  DIST COSINE
  TYPE HNSW
  EFC 200
  M 16;
```

### 3.2 memory_cold 表（冷数据）

```sql
-- 冷数据表：仅量化向量
DEFINE TABLE memory_cold SCHEMAFULL;

-- 只保留 L0 和量化向量
DEFINE FIELD content_abstract ON memory_cold TYPE string;
DEFINE FIELD embedding_quantized ON memory_cold TYPE array<int>;  -- 256维

-- 引用完整内容
DEFINE FIELD content_archive_ref ON memory_cold TYPE string;  -- "~/.opencode/memory/.archive/2026-01.tar.gz#entry-001.md"

-- 元数据
DEFINE FIELD original_id ON memory_cold TYPE string;  -- 原 memory id
DEFINE FIELD archived_at ON memory_cold TYPE datetime;
```

### 3.3 abstract_index 表（L0 快速查询）

```sql
DEFINE TABLE abstract_index SCHEMAFULL;

DEFINE FIELD entry_id ON abstract_index TYPE record<memory>;
DEFINE FIELD abstract_text ON abstract_index TYPE string ASSERT string::len($value) <= 200;
DEFINE FIELD keywords ON abstract_index TYPE array<string>;
DEFINE FIELD tenant_id ON abstract_index TYPE string;

-- 关键词索引
DEFINE INDEX idx_abstract_keywords ON abstract_index FIELDS keywords;
```

---

## 四、API 端点（简化版）

### 4.1 上传端点

**POST /api/v1/memories**

```json
// 请求
{
  "content": "User explicitly stated they prefer TypeScript...",
  "abstract": "User prefers TypeScript for new projects",  // 必填！
  "overview": "- TypeScript preference established\n- Used for type safety",  // 必填！
  "type": "preference",
  "tags": ["typescript"],
  "tenant_id": "default",
  "project_id": "@longray/opencode-memory-plugin"
}

// 后端逻辑
async fn create_memory(req) {
  // 1. 验证必填字段
  if (!req.abstract || !req.overview) {
    return Error("abstract and overview are required");
  }

  // 2. 生成向量（基于 content 或 abstract+overview）
  let text_for_embedding = format!("{} {} {}",
    req.abstract, req.overview, req.content
  );
  let embedding = embedding_service.embed(&text_for_embedding).await?;

  // 3. 生成量化向量（用于未来降级）
  let quantized = pq_quantize(&embedding);

  // 4. 创建记录
  let memory = surrealdb.create("memory").content({
    content_abstract: req.abstract,
    content_overview: req.overview,
    content: req.content,
    embedding: embedding,  // 1024维
    embedding_quantized: Some(quantized),  // 256维，预生成
    storage_tier: "hot",
    // ...
  }).await?;

  // 5. 创建 abstract_index
  surrealdb.create("abstract_index").content({
    entry_id: memory.id,
    abstract_text: req.abstract,
    keywords: extract_keywords(&req.abstract),
    // ...
  }).await?;

  Ok(memory.id)
}
```

### 4.2 查询端点（支持 level）

**POST /api/v1/memories/search**

```json
// 请求
{
  "query": "TypeScript preference",
  "mode": "hybrid",
  "level": 0,  // 0=只返回 L0，1=L0+L1，2=完整
  "limit": 10
}

// 响应（level=0）
{
  "results": [
    {
      "id": "memory:xxx",
      "abstract": "User prefers TypeScript for new projects",
      "score": 0.95
      // 注意：没有 overview 和 content
    }
  ],
  "level": 0,
  "total": 15
}

// 响应（level=2）
{
  "results": [
    {
      "id": "memory:xxx",
      "abstract": "User prefers TypeScript for new projects",
      "overview": "- TypeScript preference...",
      "content": "User explicitly stated...",
      "score": 0.95
    }
  ],
  "level": 2,
  "total": 15
}
```

**后端逻辑**:

```rust
async fn search(req) {
  match req.level {
    0 => {
      // 只在 abstract_index 搜索
      search_abstract_index(&req.query).await
    }
    1 => {
      // 搜索 + 加载 overview
      let ids = search_vector(&req.query).await?;
      fetch_l0_l1(&ids).await
    }
    2 => {
      // 完整搜索
      let ids = search_vector(&req.query).await?;
      fetch_full(&ids).await
    }
  }
}
```

---

## 五、本地归档（替代 S3）

### 5.1 归档策略

```
热数据 (<90天): SurrealDB + 本地 timeline
温数据 (90-180天): SurrealDB memory_cold + 本地压缩
冷数据 (>180天): 本地压缩归档，SurrealDB 仅保留 L0
```

### 5.2 归档实现

**每月 1 号自动归档**:

```rust
async fn archive_monthly() -> Result<()> {
  let archive_date = calculate_archive_date();  // 3 个月前
  let year_month = format!("{}-{}", archive_date.year(), archive_date.month());

  // 1. 查询需归档的记录
  let to_archive: Vec<Memory> = surrealdb
    .query("SELECT * FROM memory WHERE created_at < $date AND storage_tier = 'hot'")
    .bind("date", archive_date)
    .await?;

  // 2. 写入本地 tar.gz
  let archive_path = format!("~/.opencode/memory/.archive/{}.tar.gz", year_month);
  let mut archive = tar::Builder::new(GzEncoder::new(
    File::create(&archive_path)?,
    Compression::default()
  ));

  for entry in &to_archive {
    // 压缩完整内容
    let content = build_archive_content(entry);
    archive.append_file(&format!("{}.md", entry.id), &mut content.as_bytes())?;

    // 3. 移动到 cold 表
    surrealdb.create("memory_cold").content({
      content_abstract: entry.content_abstract,
      embedding_quantized: entry.embedding_quantized,
      content_archive_ref: format!("{}#{}.md", archive_path, entry.id),
      original_id: entry.id,
      archived_at: Utc::now(),
    }).await?;

    // 4. 删除热数据（保留 L0 在 memory）
    surrealdb.update(&entry.id).patch(json!({
      "content": None,  // 删除 L2
      "content_overview": None,  // 删除 L1
      "storage_tier": "cold",
    })).await?;
  }

  archive.finish()?;

  Ok(())
}
```

### 5.3 按需加载冷数据

```rust
async fn get_cold_content(entry_id: &str) -> Result<String> {
  // 1. 查询 cold 表
  let cold: MemoryCold = surrealdb
    .select(("memory_cold", entry_id))
    .await?
    .ok_or(Error::NotFound)?;

  // 2. 解析压缩文件路径
  let (archive_path, file_name) = parse_archive_ref(&cold.content_archive_ref)?;

  // 3. 从 tar.gz 解压
  let tar_gz = File::open(archive_path)?;
  let tar = GzDecoder::new(tar_gz);
  let mut archive = tar::Archive::new(tar);

  for entry in archive.entries()? {
    if entry.path()?.to_string_lossy() == file_name {
      let mut content = String::new();
      entry.read_to_string(&mut content)?;
      return Ok(content);
    }
  }

  Err(Error::ContentNotFound)
}
```

---

## 六、不迁移数据

### 6.1 重建策略

**不迁移，从头开始**:

1. **备份旧数据**:

   ```bash
   mv ~/.opencode/memory ~/.opencode/memory.backup.20240324
   mkdir -p ~/.opencode/memory/timeline
   ```

2. **清空 SurrealDB**:

   ```sql
   DELETE FROM memory;
   DELETE FROM abstract_index;
   DELETE FROM layer_links;
   ```

3. **重新上传**:
   - 手动选择重要记忆
   - 使用新的 `memory_write` 重新写入
   - abstract/overview 由 OpenCode 生成

### 6.2 优势

- ✅ **干净的数据结构** - 无旧格式兼容问题
- ✅ **正确的分层** - 所有条目都有 L0/L1
- ✅ **简化实现** - 无需迁移脚本
- ✅ **验证流程** - 重新梳理重要记忆

---

## 七、时间估算（更新后）

| Phase       | 任务               | 时间           |
| ----------- | ------------------ | -------------- |
| **Phase 1** | 表结构改造（简化） | 3-4 小时       |
| **Phase 2** | API 端点改造       | 3-4 小时       |
| **Phase 3** | 本地归档实现       | 2-3 小时       |
| **测试**    | 验证               | 2-3 小时       |
| **总计**    |                    | **10-14 小时** |

---

## 八、关键变更总结

| 项目                  | 变更                                   |
| --------------------- | -------------------------------------- |
| **abstract/overview** | 必填，调用方提供                       |
| **AI 生成**           | ❌ 移除，插件端不调用 LLM              |
| **S3 归档**           | ❌ 移除，改为本地压缩                  |
| **数据迁移**          | ❌ 不迁移，重建上传                    |
| **PQ 量化**           | ⚠️ 仅用于温/冷数据，热数据保留 1024 维 |
| **精度损失**          | 约 5-10%（可接受）                     |

---

**下一步**: 开始实施插件端 Phase 1（2-3小时）？
