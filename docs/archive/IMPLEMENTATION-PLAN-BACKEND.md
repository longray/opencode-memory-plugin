# OpenCode Memory Plugin - L0/L1/L2 分层存储实施计划

## 后端记忆服务实施计划

**版本**: v2.4.0-L0L1L2  
**目标**: 实现后端 SurrealDB 的 L0/L1/L2 分层存储与查询优化  
**工作量**: 约 14-16 小时  
**更新日期**: 2026-03-24

---

## 一、架构目标

### 1.1 核心原则

- **分层存储**: L0/L1 热数据常驻内存，L2 冷数据可归档
- **快速查询**: Abstract 单独索引，毫秒级 L0 查询
- **向量优化**: HNSW 索引 + 量化压缩，降低存储成本
- **向后兼容**: 现有 API 不变，新增分层字段

### 1.2 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Plugin (Node.js)                │
│  - 生成分层内容 (L0/L1/L2)                                  │
│  - 上传时携带 metadata: { l0, l1 }                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP POST /api/v1/memories
                         │ Body: { content, metadata: {l0, l1} }
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Wrapper Service (localhost:17999)           │
│  - 解析 metadata                                            │
│  - 生成分层存储记录                                          │
│  - 更新索引                                                 │
└──────────┬───────────────────────────────┬──────────────────┘
           │                               │
           ▼                               ▼
┌──────────────────────┐      ┌──────────────────────┐
│  SurrealDB           │      │  SurrealDB           │
│  ├─ memory_entries   │      │  ├─ abstract_index   │
│  ├─ layer_links      │      │  └─ vector_quantized │
│  └─ relations        │      │                      │
└──────────────────────┘      └──────────────────────┘
```

### 1.3 分层定义

| 层级     | 字段               | 长度      | 存储位置              | 索引类型   | 用途         |
| -------- | ------------------ | --------- | --------------------- | ---------- | ------------ |
| **L0**   | `content_abstract` | ≤200字符  | memory_entries        | 全文索引   | 快速摘要查询 |
| **L1**   | `content_overview` | ≤1000字符 | memory_entries        | 无         | 详细概览     |
| **L2**   | `content`          | 无限制    | memory_entries (冷存) | 无         | 完整内容     |
| **索引** | `abstract_index`   | -         | 独立表                | 关键词索引 | 加速 L0 搜索 |

---

## 二、SurrealDB 表结构改造

### Phase 1: 核心表改造（4-5小时）

#### 任务 1.1: 改造 memory 表（2小时）

**文件**: 后端 SurrealDB schema 定义  
**实施**:

```sql
-- ==========================================
-- 1. 扩展 memory 表添加分层字段
-- ==========================================

-- 添加 L0 字段（一句话摘要）
DEFINE FIELD content_abstract ON memory TYPE string
  ASSERT string::len($value) <= 200;

-- 添加 L1 字段（核心要点）
DEFINE FIELD content_overview ON memory TYPE string
  ASSERT string::len($value) <= 1000;

-- 修改 L2 字段为可选（冷存）
DEFINE FIELD content ON memory TYPE option<string>;

-- 添加分层引用路径（用于快速定位）
DEFINE FIELD l0_ref ON memory TYPE string;
DEFINE FIELD l1_ref ON memory TYPE string;
DEFINE FIELD l2_ref ON memory TYPE string;

-- 添加内容哈希（用于去重和变更检测）
DEFINE FIELD content_hash ON memory TYPE string;
DEFINE FIELD l0_hash ON memory TYPE string;
DEFINE FIELD l1_hash ON memory TYPE string;

-- 添加存储层级标记
DEFINE FIELD storage_tier ON memory TYPE string
  DEFAULT 'hot'
  ASSERT $value IN ['hot', 'warm', 'cold'];

-- 添加最后访问时间（用于 LRU 淘汰）
DEFINE FIELD last_accessed ON memory TYPE datetime;
```

**验证**:

```sql
-- 测试字段添加
INFO FOR TABLE memory;

-- 测试约束
CREATE memory:test SET
  content_abstract = 'This is a test abstract that is way too long and should fail validation because it exceeds the maximum allowed length of 200 characters for the abstract field in the memory table',
  content = 'test';
-- 应该报错
```

---

#### 任务 1.2: 新建 abstract_index 表（2小时）

**目的**: 加速 L0 查询，支持关键词搜索

```sql
-- ==========================================
-- 2. 新建 abstract_index 表
-- ==========================================

DEFINE TABLE abstract_index SCHEMAFULL;

-- 主键: abs:{tenant_id}:{entry_id}
DEFINE FIELD id ON abstract_index TYPE string
  ASSERT $value MATCHES /^abs:[^:]+:.+$/;

-- 关联的 memory 记录
DEFINE FIELD entry_id ON abstract_index TYPE record<memory>;

-- L0 摘要内容（用于快速关键词匹配）
DEFINE FIELD abstract_text ON abstract_index TYPE string
  ASSERT string::len($value) <= 200;

-- 提取的关键词数组
DEFINE FIELD keywords ON abstract_index TYPE array<string>;

-- 所属主题（便于按主题查询）
DEFINE FIELD topic ON abstract_index TYPE string;

-- 元数据
DEFINE FIELD tenant_id ON abstract_index TYPE string;
DEFINE FIELD project_id ON abstract_index TYPE string;
DEFINE FIELD created_at ON abstract_index TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON abstract_index TYPE datetime;

-- ==========================================
-- 3. 为 abstract_index 创建索引
-- ==========================================

-- 关键词索引（用于快速关键词搜索）
DEFINE INDEX idx_abstract_keywords ON abstract_index FIELDS keywords;

-- 全文搜索索引（支持模糊匹配）
DEFINE INDEX idx_abstract_text ON abstract_index FIELDS abstract_text;

-- 主题索引
DEFINE INDEX idx_abstract_topic ON abstract_index FIELDS tenant_id, topic;

-- 时间索引（用于排序）
DEFINE INDEX idx_abstract_time ON abstract_index FIELDS tenant_id, created_at;
```

**验证**:

```sql
-- 创建测试记录
CREATE abstract_index:test SET
  entry_id = memory:test,
  abstract_text = 'User prefers TypeScript for new projects',
  keywords = ['typescript', 'preference', 'projects'],
  topic = 'preferences',
  tenant_id = 'default',
  project_id = 'global';

-- 测试关键词搜索
SELECT * FROM abstract_index
WHERE keywords CONTAINS 'typescript'
AND tenant_id = 'default';

-- 测试全文搜索
SELECT * FROM abstract_index
WHERE abstract_text CONTAINS 'TypeScript'
AND tenant_id = 'default';
```

---

#### 任务 1.3: 新建 layer_links 表（1小时）

**目的**: 维护 L0/L1/L2 三层之间的关联关系

```sql
-- ==========================================
-- 4. 新建 layer_links 表
-- ==========================================

DEFINE TABLE layer_links SCHEMAFULL;

-- 主键: link:{memory_id}
DEFINE FIELD id ON layer_links TYPE string
  ASSERT $value MATCHES /^link:.+$/;

-- 关联的 memory 记录（唯一）
DEFINE FIELD entry_id ON layer_links TYPE record<memory> UNIQUE;

-- 三层路径引用（指向 storage 或外部存储）
DEFINE FIELD l0_path ON layer_links TYPE string;  -- "surrealdb://memory/{id}/content_abstract"
DEFINE FIELD l1_path ON layer_links TYPE string;  -- "surrealdb://memory/{id}/content_overview"
DEFINE FIELD l2_path ON layer_links TYPE string;  -- "surrealdb://memory/{id}/content" 或 "s3://bucket/{id}"

-- 各层内容哈希
DEFINE FIELD l0_hash ON layer_links TYPE string;
DEFINE FIELD l1_hash ON layer_links TYPE string;
DEFINE FIELD l2_hash ON layer_links TYPE string;

-- 同步状态
DEFINE FIELD sync_status ON layer_links TYPE string
  DEFAULT 'synced'
  ASSERT $value IN ['synced', 'pending', 'failed', 'conflict'];

-- 时间戳
DEFINE FIELD last_synced ON layer_links TYPE datetime;
DEFINE FIELD created_at ON layer_links TYPE datetime DEFAULT time::now();

-- ==========================================
-- 5. 为 layer_links 创建索引
-- ==========================================

-- entry_id 唯一索引
DEFINE INDEX idx_link_entry ON layer_links FIELDS entry_id UNIQUE;

-- L0 路径索引（用于快速定位）
DEFINE INDEX idx_link_l0 ON layer_links FIELDS l0_path;

-- 同步状态索引（用于查找待同步记录）
DEFINE INDEX idx_link_sync ON layer_links FIELDS sync_status, last_synced;
```

---

### Phase 2: 向量索引优化（3-4小时）

#### 任务 2.1: 向量量化索引（2小时）

**目的**: 降低存储成本，加速相似度搜索

```sql
-- ==========================================
-- 6. 添加量化向量字段
-- ==========================================

-- PQ (Product Quantization) 量化向量（256维，比原始1024减少75%）
DEFINE FIELD embedding_quantized ON memory TYPE array<int>;

-- LSH (Locality-Sensitive Hashing) 哈希桶（用于预过滤）
DEFINE FIELD embedding_lsh ON memory TYPE array<string>;

-- 原始向量（可选，冷存）
DEFINE FIELD embedding_full ON memory TYPE option<array<float>>;

-- ==========================================
-- 7. 创建分层向量索引
-- ==========================================

-- HNSW 索引在量化向量上（热数据）
DEFINE INDEX idx_memory_embedding_quantized ON memory
FIELDS embedding_quantized
VECTOR DIMENSION 256
DIST COSINE
TYPE HNSW
EFC 200
M 16;

-- LSH 哈希索引（用于预过滤）
DEFINE INDEX idx_memory_embedding_lsh ON memory FIELDS embedding_lsh;
```

**量化逻辑**（后端代码）:

```rust
// 伪代码 - 向量量化
fn quantize_vector(full_embedding: &[f32]) -> Vec<i8> {
    // 使用 Product Quantization
    // 1. 将 1024 维分成 16 个子空间，每空间 64 维
    // 2. 每个子空间量化为 1 byte (256 个聚类中心)
    // 3. 结果: 16 bytes (对比原始 1024*4=4096 bytes，压缩率 256:1)
    pq_quantize(full_embedding, n_subspaces=16, n_clusters=256)
}

fn generate_lsh_hashes(embedding: &[f32], n_hashes: u8) -> Vec<String> {
    // 生成 8 个 LSH 哈希值
    // 用于快速预过滤（相似向量至少共享 1 个哈希）
    (0..n_hashes)
        .map(|i| lsh_hash(embedding, seed=i))
        .collect()
}
```

---

#### 任务 2.2: 动态索引调优（1-2小时）

**目的**: 根据数据量自动调整 HNSW 参数

```sql
-- ==========================================
-- 8. 创建索引参数动态调整事件
-- ==========================================

DEFINE EVENT auto_tune_hnsw ON TABLE memory
WHEN $event = 'CREATE'
THEN {
  -- 统计当前数据量
  LET $count = (SELECT count() FROM memory WHERE tenant_id = $after.tenant_id GROUP BY tenant_id);

  -- 根据数据量计算最优 M 参数
  LET $m =
    IF $count < 1000 THEN 12
    ELSE IF $count < 10000 THEN 16
    ELSE IF $count < 100000 THEN 20
    ELSE 24
  END;

  -- 更新索引参数（伪代码，实际需重建索引）
  -- UPDATE INDEX idx_memory_embedding_quantized SET M = $m;

  RETURN { tuned: true, data_count: $count, m_param: $m };
};
```

---

### Phase 3: API 端点改造（4-5小时）

#### 任务 3.1: 上传端点改造（2小时）

**文件**: 后端 API - `POST /api/v1/memories`

**改造逻辑**:

```rust
// 伪代码 - Rust/Go 实现
async fn create_memory(req: CreateMemoryRequest) -> Result<MemoryResponse> {
    // 1. 解析 metadata 中的 L0/L1
    let l0 = req.metadata.get("l0").ok_or(Error::MissingAbstract)?;
    let l1 = req.metadata.get("l1").ok_or(Error::MissingOverview)?;
    let l2 = req.content;

    // 2. 计算哈希
    let l0_hash = sha256(l0);
    let l1_hash = sha256(l1);
    let l2_hash = sha256(&l2);

    // 3. 生成向量嵌入（如果未提供）
    let embedding = if let Some(emb) = req.embedding {
        emb
    } else {
        embedding_service.embed(&l2).await?
    };

    // 4. 量化向量
    let embedding_quantized = quantize_vector(&embedding);
    let embedding_lsh = generate_lsh_hashes(&embedding, 8);

    // 5. 创建 memory 记录
    let memory_id = surrealdb
        .create("memory")
        .content(json!({
            "content_abstract": l0,
            "content_overview": l1,
            "content": Some(l2),
            "content_hash": l2_hash,
            "l0_hash": l0_hash,
            "l1_hash": l1_hash,
            "embedding_quantized": embedding_quantized,
            "embedding_lsh": embedding_lsh,
            "storage_tier": "hot",
            // ... 其他字段
        }))
        .await?;

    // 6. 创建 abstract_index 记录
    let keywords = extract_keywords(l0);
    surrealdb
        .create("abstract_index")
        .content(json!({
            "entry_id": memory_id,
            "abstract_text": l0,
            "keywords": keywords,
            "topic": req.metadata.get("topic").unwrap_or("general"),
            // ...
        }))
        .await?;

    // 7. 创建 layer_links 记录
    surrealdb
        .create("layer_links")
        .content(json!({
            "entry_id": memory_id,
            "l0_path": format!("surrealdb://memory/{}/content_abstract", memory_id),
            "l1_path": format!("surrealdb://memory/{}/content_overview", memory_id),
            "l2_path": format!("surrealdb://memory/{}/content", memory_id),
            "l0_hash": l0_hash,
            "l1_hash": l1_hash,
            "l2_hash": l2_hash,
        }))
        .await?;

    Ok(MemoryResponse { id: memory_id })
}
```

**请求格式**:

```json
{
  "content": "User explicitly stated they prefer TypeScript...",
  "type": "preference",
  "tags": ["typescript"],
  "metadata": {
    "l0": "User prefers TypeScript for all new projects",
    "l1": "- TypeScript preference established\n- Used for type safety",
    "topic": "preferences"
  },
  "tenant_id": "default",
  "project_id": "@longray/opencode-memory-plugin"
}
```

---

#### 任务 3.2: 查询端点改造（2-3小时）

**文件**: 后端 API - `POST /api/v1/memories/search`

**新增参数**:

```rust
struct SearchRequest {
    query: String,
    mode: SearchMode,  // vector | keyword | hybrid | abstract
    level: u8,         // 0=abstract, 1=overview, 2=full
    limit: usize,
    threshold: f32,
    tenant_id: String,
    project_id: Option<String>,
}
```

**查询逻辑**:

```rust
async fn search_memories(req: SearchRequest) -> Result<SearchResponse> {
    match req.mode {
        SearchMode::Abstract => {
            // 只在 abstract_index 中搜索（最快）
            search_abstract_index(&req).await
        }
        SearchMode::Vector => {
            // 分层向量搜索
            search_vector_layered(&req).await
        }
        SearchMode::Hybrid => {
            // 混合搜索：abstract(30%) + vector(70%)
            search_hybrid_layered(&req).await
        }
        _ => search_default(&req).await,
    }
}

async fn search_abstract_index(req: &SearchRequest) -> Result<SearchResponse> {
    // 提取查询关键词
    let keywords = extract_keywords(&req.query);

    // 在 abstract_index 中搜索
    let results: Vec<AbstractResult> = surrealdb
        .query(r#"
            SELECT
                entry_id,
                abstract_text,
                search::score(1) as relevance
            FROM abstract_index
            WHERE keywords CONTAINSANY $keywords
            AND tenant_id = $tenant_id
            ORDER BY relevance DESC
            LIMIT $limit
        "#)
        .bind(("keywords", keywords))
        .bind(("tenant_id", &req.tenant_id))
        .bind(("limit", req.limit))
        .await?;

    // 根据 level 返回不同内容
    let memories = match req.level {
        0 => results.iter().map(|r| L0Result {
            id: r.entry_id,
            abstract: r.abstract_text.clone()
        }).collect(),
        1 => fetch_l0_l1(&results).await?,
        _ => fetch_full(&results).await?,
    };

    Ok(SearchResponse { results: memories })
}

async fn search_vector_layered(req: &SearchRequest) -> Result<SearchResponse> {
    // 1. 生成查询向量
    let query_embedding = embedding_service.embed(&req.query).await?;
    let query_quantized = quantize_vector(&query_embedding);
    let query_lsh = generate_lsh_hashes(&query_embedding, 8);

    // 2. LSH 预过滤
    let candidates: Vec<String> = surrealdb
        .query(r#"
            SELECT id FROM memory
            WHERE embedding_lsh CONTAINSANY $query_lsh
            AND tenant_id = $tenant_id
            LIMIT 100
        "#)
        .bind(("query_lsh", query_lsh))
        .await?;

    // 3. 在量化向量上精排
    let results: Vec<VectorResult> = surrealdb
        .query(r#"
            SELECT
                id,
                content_abstract,
                vector::similarity::cosine(embedding_quantized, $query) as score
            FROM memory
            WHERE id IN $candidates
            ORDER BY score DESC
            LIMIT $limit
        "#)
        .bind(("query", query_quantized))
        .bind(("candidates", candidates))
        .bind(("limit", req.limit))
        .await?;

    Ok(SearchResponse {
        results: results.into_iter().map(|r| r.into()).collect()
    })
}
```

**响应格式**（根据 level）:

```json
// Level 0 (abstract only)
{
  "results": [
    {
      "id": "memory:s9kzvcu9z3xflbr2al5s",
      "abstract": "User prefers TypeScript for all new projects",
      "score": 0.95
    }
  ],
  "level": 0,
  "total": 1
}

// Level 2 (full content)
{
  "results": [
    {
      "id": "memory:s9kzvcu9z3xflbr2al5s",
      "abstract": "User prefers TypeScript...",
      "overview": "- TypeScript preference...",
      "content": "User explicitly stated...",
      "score": 0.95
    }
  ],
  "level": 2,
  "total": 1
}
```

---

### Phase 4: 归档与生命周期管理（3-4小时）

#### 任务 4.1: 自动归档任务（2小时）

**目的**: 90 天前的 L2 内容归档到 S3，降低存储成本

```sql
-- ==========================================
-- 9. 创建归档事件
-- ==========================================

DEFINE EVENT archive_old_entries ON TABLE memory
WHEN $event = 'CREATE'
THEN {
  -- 查找 90 天前的热数据
  LET $old_entries = SELECT id, content FROM memory
  WHERE storage_tier = 'hot'
  AND created_at < time::now() - 90d
  AND content IS NOT NULL
  LIMIT 100;

  -- 归档到外部存储（伪代码）
  FOR $entry IN $old_entries {
    -- 上传到 S3
    LET $s3_path = http::post('https://s3.amazonaws.com/bucket/archive', {
      entry_id: $entry.id,
      content: $entry.content,
      compression: 'zstd'
    });

    -- 更新记录
    UPDATE memory SET
      content = NONE,
      storage_tier = 'cold',
      l2_ref = $s3_path
    WHERE id = $entry.id;
  }

  RETURN { archived: array::len($old_entries) };
};
```

---

#### 任务 4.2: 动态加载端点（1-2小时）

**文件**: 后端 API - `GET /api/v1/memories/{id}/content`

**目的**: 按需加载 L2 冷数据

```rust
async fn get_memory_content(id: &str, level: u8) -> Result<ContentResponse> {
    // 1. 查询 layer_links 获取路径
    let link: LayerLink = surrealdb
        .select(("layer_links", format!("link:{}", id)))
        .await?
        .ok_or(Error::NotFound)?;

    // 2. 根据层级和存储位置获取内容
    match level {
        0 => {
            // L0 始终在 SurrealDB
            let memory: Memory = surrealdb.select(("memory", id)).await?;
            Ok(ContentResponse {
                level: 0,
                content: memory.content_abstract,
            })
        }
        1 => {
            // L1 始终在 SurrealDB
            let memory: Memory = surrealdb.select(("memory", id)).await?;
            Ok(ContentResponse {
                level: 1,
                abstract: memory.content_abstract,
                overview: memory.content_overview,
            })
        }
        2 => {
            // L2 可能在 SurrealDB 或 S3
            let memory: Memory = surrealdb.select(("memory", id)).await?;

            let full_content = if let Some(content) = memory.content {
                content
            } else {
                // 从 S3 加载
                let s3_url = memory.l2_ref.ok_or(Error::ContentNotAvailable)?;
                s3_client.download(&s3_url).await?
            };

            // 更新最后访问时间
            surrealdb
                .update(("memory", id))
                .patch(PatchOp::replace("/last_accessed", Utc::now()))
                .await?;

            Ok(ContentResponse {
                level: 2,
                abstract: memory.content_abstract,
                overview: memory.content_overview,
                content: full_content,
            })
        }
        _ => Err(Error::InvalidLevel),
    }
}
```

---

## 三、迁移策略

### 现有数据迁移

```rust
async fn migrate_existing_data() -> Result<()> {
    // 1. 查询所有没有分层字段的记录
    let old_entries: Vec<Memory> = surrealdb
        .query("SELECT * FROM memory WHERE content_abstract IS NONE")
        .await?;

    for entry in old_entries {
        // 2. 从 content 提取 abstract/overview
        let (l0, l1) = extract_layers(&entry.content);

        // 3. 更新记录
        surrealdb
            .update(("memory", &entry.id))
            .content(json!({
                "content_abstract": l0,
                "content_overview": l1,
                "content_hash": sha256(&entry.content),
            }))
            .await?;

        // 4. 创建 abstract_index
        let keywords = extract_keywords(&l0);
        surrealdb
            .create("abstract_index")
            .content(json!({
                "entry_id": &entry.id,
                "abstract_text": l0,
                "keywords": keywords,
            }))
            .await?;
    }

    Ok(())
}
```

---

## 四、性能指标

| 操作              | 目标延迟 | 实现策略                    |
| ----------------- | -------- | --------------------------- |
| **L0 查询**       | <10ms    | abstract_index + 关键词索引 |
| **L1 查询**       | <20ms    | 直接查询 memory 表          |
| **L2 查询（热）** | <30ms    | 直接查询 memory 表          |
| **L2 查询（冷）** | <200ms   | 从 S3 加载                  |
| **向量搜索**      | <50ms    | LSH 预过滤 + 量化向量 HNSW  |
| **混合搜索**      | <80ms    | abstract(30%) + vector(70%) |
| **写入**          | <100ms   | 异步索引更新                |

---

## 五、验证清单

### 表结构验证

- [ ] memory 表包含分层字段
- [ ] abstract_index 表创建成功
- [ ] layer_links 表创建成功
- [ ] 所有索引创建成功

### API 验证

- [ ] 上传时正确解析 metadata.l0/l1
- [ ] 创建 abstract_index 记录
- [ ] 创建 layer_links 记录
- [ ] 搜索支持 level 参数
- [ ] L0 查询 <10ms
- [ ] 向量搜索使用量化向量

### 数据验证

- [ ] 现有数据成功迁移
- [ ] L0 长度限制 ≤200 字符
- [ ] L1 长度限制 ≤1000 字符
- [ ] 关键词正确提取

---

## 六、时间估算

| Phase       | 任务           | 时间           |
| ----------- | -------------- | -------------- |
| **Phase 1** | 核心表改造     | 4-5 小时       |
| **Phase 2** | 向量索引优化   | 3-4 小时       |
| **Phase 3** | API 端点改造   | 4-5 小时       |
| **Phase 4** | 归档与生命周期 | 3-4 小时       |
| **测试**    | 验证与修复     | 2-3 小时       |
| **总计**    |                | **16-21 小时** |

---

**总工作量**: 插件端 13-18 小时 + 后端 16-21 小时 = **29-39 小时**

**建议**: 可分阶段实施，先插件端（用户可见），后后端（性能优化）。
