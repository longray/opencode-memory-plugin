# 后端 SurrealDB 表结构 - 完整版

**版本**: v2.4.0-L0L1L2  
**更新日期**: 2026-03-24  
**关键更新**: 添加 local_id 字段建立双向关联

---

## 一、核心关联设计

### 1.1 双向关联关系

```
插件端本地文件                    后端 SurrealDB
├─ 文件名: entry_{ulid}.md        ├─ id: memory:{backend_ulid}
├─ frontmatter.id: {ulid}         └─ local_id: {ulid}  ← 关联字段
└─ frontmatter.memory_id: {backend_id}
        │
        └──────────────────────────────┘
              通过 local_id 双向查找
```

### 1.2 为什么需要 local_id？

**场景 1：后端返回结果，插件端查找本地文件**

```javascript
// 后端搜索结果
{
  "id": "memory:s9kzvcu9z3xflbr2al5s",
  "local_id": "01HV8J3K2M4N5P6Q7R8S9T0UV",  // ← 通过这个找到本地文件
  "abstract": "User prefers TypeScript...",
  "score": 0.95
}

// 插件端查找本地文件
const fileName = `entry_${result.local_id}.md`;
const filePath = `timeline/2026/03/23/${fileName}`;
```

**场景 2：插件端同步，后端去重**

```javascript
// 上传时提供 local_id
{
  "content": "...",
  "metadata": {
    "local_id": "01HV8J3K2M4N5P6Q7R8S9T0UV"
  }
}

// 后端检查是否已存在
SELECT * FROM memory WHERE local_id = "01HV8J3K2M4N5P6Q7R8S9T0UV";
// 如果存在，更新而不是创建新记录
```

**场景 3：增量同步比对**

```javascript
// 后端返回已同步的 local_id 列表
{
  "synced_ids": ["01HV8J3K2M4...", "01HV8J3K2M5..."]
}

// 插件端找出未同步的文件
const pendingFiles = localFiles.filter(f =>
  !synced_ids.includes(extractUlidFromFileName(f))
);
```

---

## 二、表结构（完整版）

### 2.1 memory 表（热数据）

```sql
-- ==========================================
-- memory 表 - 热数据存储
-- ==========================================

DEFINE TABLE memory SCHEMAFULL;

-- 【关键】关联字段
DEFINE FIELD local_id ON memory TYPE string
  ASSERT $value MATCHES /^[0-9A-Z]{26}$/  -- ULID 格式
  UNIQUE;  -- 唯一约束，防止重复同步

-- 分层内容字段
DEFINE FIELD content_abstract ON memory TYPE string
  ASSERT string::len($value) <= 200;

DEFINE FIELD content_overview ON memory TYPE string
  ASSERT string::len($value) <= 1000;

DEFINE FIELD content ON memory TYPE string;  -- L2 完整内容

-- 分层哈希（用于变更检测）
DEFINE FIELD abstract_hash ON memory TYPE string;
DEFINE FIELD overview_hash ON memory TYPE string;
DEFINE FIELD content_hash ON memory TYPE string;

-- 向量嵌入（热数据保留1024维）
DEFINE FIELD embedding ON memory TYPE array<float>;
DEFINE FIELD embedding_quantized ON memory TYPE option<array<int>>;

-- 【关键】分层引用路径（用于快速定位）
DEFINE FIELD l0_ref ON memory TYPE string;  -- "abstract"
DEFINE FIELD l1_ref ON memory TYPE string;  -- "overview"
DEFINE FIELD l2_ref ON memory TYPE string;  -- "content"

-- 元数据
DEFINE FIELD entry_type ON memory TYPE string  -- preference/decision/pattern/lesson/note
  ASSERT $value IN ['preference', 'decision', 'pattern', 'lesson', 'note', 'general'];

DEFINE FIELD tags ON memory TYPE array<string>;

DEFINE FIELD tenant_id ON memory TYPE string;
DEFINE FIELD project_id ON memory TYPE string;

-- 【关键】同步状态
DEFINE FIELD synced_at ON memory TYPE datetime;  -- 最后同步时间
DEFINE FIELD sync_version ON memory TYPE string; -- 同步版本（用于冲突检测）

-- 分层状态
DEFINE FIELD storage_tier ON memory TYPE string
  DEFAULT 'hot'
  ASSERT $value IN ['hot', 'warm', 'cold'];

-- 访问统计（用于智能分层）
DEFINE FIELD access_count ON memory TYPE number DEFAULT 0;
DEFINE FIELD last_accessed ON memory TYPE datetime;

-- 用户标记
DEFINE FIELD pinned ON memory TYPE bool DEFAULT false;
DEFINE FIELD pin_note ON memory TYPE option<string>;

-- 时间戳
DEFINE FIELD created_at ON memory TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON memory TYPE datetime;

-- ==========================================
-- 索引
-- ==========================================

-- 【关键】local_id 唯一索引（核心关联）
DEFINE INDEX idx_memory_local_id ON memory FIELDS local_id UNIQUE;

-- 租户/项目索引
DEFINE INDEX idx_memory_tenant ON memory FIELDS tenant_id, project_id;

-- 类型索引（用于过滤）
DEFINE INDEX idx_memory_type ON memory FIELDS entry_type;

-- 置顶索引（快速查询置顶条目）
DEFINE INDEX idx_memory_pinned ON memory FIELDS pinned, tenant_id;

-- HNSW 向量索引
DEFINE INDEX idx_memory_embedding ON memory
  FIELDS embedding
  VECTOR DIMENSION 1024
  DIST COSINE
  TYPE HNSW
  EFC 200
  M 16;

-- 访问时间索引（用于智能分层）
DEFINE INDEX idx_memory_access ON memory FIELDS last_accessed;
```

### 2.2 memory_warm 表（温数据）

```sql
-- ==========================================
-- memory_warm 表 - 温数据（90-180天或评分中等）
-- ==========================================

DEFINE TABLE memory_warm SCHEMAFULL;

-- 【关键】关联字段（保持与 memory 表一致）
DEFINE FIELD local_id ON memory_warm TYPE string UNIQUE;
DEFINE FIELD original_id ON memory_warm TYPE record<memory>;  -- 指向原热数据记录

-- 分层内容（保留 L0/L1/L2）
DEFINE FIELD content_abstract ON memory_warm TYPE string;
DEFINE FIELD content_overview ON memory_warm TYPE string;
DEFINE FIELD content ON memory_warm TYPE string;

-- PQ 量化向量（256维，节省存储）
DEFINE FIELD embedding_quantized ON memory_warm TYPE array<int>;

-- 分层引用
DEFINE FIELD l0_ref ON memory_warm TYPE string;
DEFINE FIELD l1_ref ON memory_warm TYPE string;
DEFINE FIELD l2_ref ON memory_warm TYPE string;

-- 降级信息
DEFINE FIELD demoted_at ON memory_warm TYPE datetime;  -- 降级时间
DEFINE FIELD demote_reason ON memory_warm TYPE string; -- "age" | "score" | "space"

-- 访问统计
DEFINE FIELD access_count ON memory_warm TYPE number DEFAULT 0;
DEFINE FIELD last_accessed ON memory_warm TYPE datetime;

-- 升级标记（用于快速识别需要升级的条目）
DEFINE FIELD upgrade_candidate ON memory_warm TYPE bool DEFAULT false;

-- 时间戳
DEFINE FIELD created_at ON memory_warm TYPE datetime;
DEFINE FIELD updated_at ON memory_warm TYPE datetime DEFAULT time::now();

-- ==========================================
-- 索引
-- ==========================================

-- local_id 唯一索引
DEFINE INDEX idx_warm_local_id ON memory_warm FIELDS local_id UNIQUE;

-- 升级候选索引（用于定时任务查找）
DEFINE INDEX idx_warm_upgrade ON memory_warm FIELDS upgrade_candidate, last_accessed;
```

### 2.3 memory_cold 表（冷数据）

```sql
-- ==========================================
-- memory_cold 表 - 冷数据（>180天且低频访问）
-- ==========================================

DEFINE TABLE memory_cold SCHEMAFULL;

-- 【关键】关联字段
DEFINE FIELD local_id ON memory_cold TYPE string UNIQUE;
DEFINE FIELD original_id ON memory_cold TYPE record<memory>;

-- 仅保留 L0（最小存储）
DEFINE FIELD content_abstract ON memory_cold TYPE string;

-- PQ 量化向量（256维）
DEFINE FIELD embedding_quantized ON memory_cold TYPE array<int>;

-- 【关键】本地归档引用
DEFINE FIELD local_archive_ref ON memory_cold TYPE string;
-- 格式: "file://~/.opencode/memory/.archive/2026-01.tar.gz#entry_{ulid}.md"

-- 分层引用（L1/L2 指向归档）
DEFINE FIELD l0_ref ON memory_cold TYPE string;
DEFINE FIELD l1_ref ON memory_cold TYPE string;  -- 指向归档
DEFINE FIELD l2_ref ON memory_cold TYPE string;  -- 指向归档

-- 归档信息
DEFINE FIELD archived_at ON memory_cold TYPE datetime;
DEFINE FIELD archive_size_bytes ON memory_cold TYPE number;  -- 归档时原始大小

-- 访问统计（用于决定是否升级）
DEFINE FIELD access_count_cold ON memory_cold TYPE number DEFAULT 0;
DEFINE FIELD last_accessed ON memory_cold TYPE datetime;

-- 时间戳
DEFINE FIELD created_at ON memory_cold TYPE datetime;

-- ==========================================
-- 索引
-- ==========================================

DEFINE INDEX idx_cold_local_id ON memory_cold FIELDS local_id UNIQUE;
DEFINE INDEX idx_cold_access ON memory_cold FIELDS last_accessed;
```

### 2.4 abstract_index 表（L0 快速索引）

```sql
-- ==========================================
-- abstract_index 表 - L0 快速查询
-- ==========================================

DEFINE TABLE abstract_index SCHEMAFULL;

-- 【关键】关联字段
DEFINE FIELD entry_id ON abstract_index TYPE record<memory>;
DEFINE FIELD local_id ON abstract_index TYPE string;  -- 冗余存储，避免 JOIN

-- L0 内容
DEFINE FIELD abstract_text ON abstract_index TYPE string ASSERT string::len($value) <= 200;
DEFINE FIELD abstract_hash ON abstract_index TYPE string;  -- 用于去重

-- 提取的关键词（用于快速搜索）
DEFINE FIELD keywords ON abstract_index TYPE array<string>;

-- 类型和标签（用于过滤）
DEFINE FIELD entry_type ON abstract_index TYPE string;
DEFINE FIELD tags ON abstract_index TYPE array<string>;

-- 元数据
DEFINE FIELD tenant_id ON abstract_index TYPE string;
DEFINE FIELD project_id ON abstract_index TYPE string;
DEFINE FIELD created_at ON abstract_index TYPE datetime;

-- ==========================================
-- 索引
-- ==========================================

-- 关键词索引（核心搜索）
DEFINE INDEX idx_abstract_keywords ON abstract_index FIELDS keywords;

-- local_id 索引（快速关联）
DEFINE INDEX idx_abstract_local_id ON abstract_index FIELDS local_id;

-- 全文搜索（SurrealDB 全文索引）
DEFINE INDEX idx_abstract_fulltext ON abstract_index FIELDS abstract_text SEARCH;

-- 类型过滤索引
DEFINE INDEX idx_abstract_type ON abstract_index FIELDS entry_type, tenant_id;
```

### 2.5 sync_state 表（同步状态追踪）

```sql
-- ==========================================
-- sync_state 表 - 同步状态管理
-- ==========================================

DEFINE TABLE sync_state SCHEMAFULL;

-- 【关键】关联字段
DEFINE FIELD local_id ON sync_state TYPE string UNIQUE;
DEFINE FIELD entry_id ON sync_state TYPE option<record<memory>>;

-- 同步状态
DEFINE FIELD status ON sync_state TYPE string
  ASSERT $value IN ['pending', 'syncing', 'synced', 'failed', 'conflict'];

-- 版本控制（用于冲突检测）
DEFINE FIELD local_version ON sync_state TYPE string;  -- 本地内容哈希
DEFINE FIELD remote_version ON sync_state TYPE string; -- 后端内容哈希

-- 重试计数
DEFINE FIELD retry_count ON sync_state TYPE number DEFAULT 0;
DEFINE FIELD last_error ON sync_state TYPE option<string>;

-- 时间戳
DEFINE FIELD created_at ON sync_state TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON sync_state TYPE datetime;
DEFINE FIELD last_sync_attempt ON sync_state TYPE option<datetime>;

-- ==========================================
-- 索引
-- ==========================================

-- local_id 唯一索引
DEFINE INDEX idx_sync_local_id ON sync_state FIELDS local_id UNIQUE;

-- 状态索引（用于查询待同步条目）
DEFINE INDEX idx_sync_status ON sync_state FIELDS status, retry_count;

-- 待处理索引（用于定时任务）
DEFINE INDEX idx_sync_pending ON sync_state
  FIELDS status, created_at
  WHERE status = 'pending';
```

---

## 三、API 设计（完整）

### 3.1 上传端点

**POST /api/v1/memories**

```json
// 请求
{
  "content": "User explicitly stated they prefer TypeScript...",
  "abstract": "User prefers TypeScript for new projects",
  "overview": "- TypeScript preference established\n- Used for type safety",
  "type": "preference",
  "tags": ["typescript"],
  "metadata": {
    "local_id": "01HV8J3K2M4N5P6Q7R8S9T0UV",  // ← 插件端提供的 local_id
    "content_hash": "sha256:abc123...",
    "pinned": true,
    "pin_note": "Core preference"
  },
  "tenant_id": "default",
  "project_id": "@longray/opencode-memory-plugin"
}

// 响应
{
  "id": "memory:s9kzvcu9z3xflbr2al5s",
  "local_id": "01HV8J3K2M4N5P6Q7R8S9T0UV",  // ← 返回 local_id 确认关联
  "success": true,
  "synced_at": "2026-03-23T10:30:00Z"
}
```

**后端处理逻辑**：

```rust
async fn create_memory(req: CreateMemoryRequest) -> Result<MemoryResponse> {
    // 1. 检查 local_id 是否已存在（去重）
    let existing: Option<Memory> = surrealdb
        .query("SELECT * FROM memory WHERE local_id = $local_id")
        .bind("local_id", &req.metadata.local_id)
        .await?;

    if let Some(entry) = existing {
        // 已存在，更新而不是创建
        return update_existing_entry(entry.id, req).await;
    }

    // 2. 生成向量
    let embedding = embedding_service.embed(&req.content).await?;
    let quantized = pq_quantize(&embedding);

    // 3. 创建记录
    let memory = surrealdb.create("memory").content({
        local_id: req.metadata.local_id.clone(),  // ← 存储 local_id
        content_abstract: req.abstract,
        content_overview: req.overview,
        content: req.content,
        embedding: embedding,
        embedding_quantized: Some(quantized),
        entry_type: req.type,
        tags: req.tags,
        tenant_id: req.tenant_id,
        project_id: req.project_id,
        pinned: req.metadata.pinned,
        pin_note: req.metadata.pin_note,
        synced_at: Utc::now(),
    }).await?;

    // 4. 创建 abstract_index
    surrealdb.create("abstract_index").content({
        entry_id: memory.id,
        local_id: req.metadata.local_id,  // ← 冗余存储
        abstract_text: req.abstract,
        keywords: extract_keywords(&req.abstract),
        entry_type: req.type,
        tags: req.tags,
    }).await?;

    // 5. 创建 sync_state
    surrealdb.create("sync_state").content({
        local_id: req.metadata.local_id,
        entry_id: Some(memory.id),
        status: "synced",
        local_version: req.metadata.content_hash,
        remote_version: calculate_hash(&req.content),
    }).await?;

    Ok(MemoryResponse {
        id: memory.id,
        local_id: req.metadata.local_id,
        success: true,
    })
}
```

### 3.2 搜索端点

**POST /api/v1/memories/search**

```json
// 请求
{
  "query": "TypeScript preference",
  "mode": "hybrid",
  "level": 0,
  "limit": 10,
  "tenant_id": "default"
}

// 响应
{
  "results": [
    {
      "id": "memory:s9kzvcu9z3xflbr2al5s",
      "local_id": "01HV8J3K2M4N5P6Q7R8S9T0UV",  // ← 返回 local_id
      "abstract": "User prefers TypeScript...",
      "score": 0.95,
      "storage_tier": "hot"
    }
  ],
  "total": 15
}
```

**插件端处理**：

```javascript
// 通过 local_id 找到本地文件
for (const result of results) {
  const fileName = `entry_${result.local_id}.md`; // ← 使用 local_id
  const filePath = path.join(dayDir, fileName);

  if (fs.existsSync(filePath)) {
    // 加载本地内容
    const content = fs.readFileSync(filePath, "utf-8");
    display(extractByLevel(content, level));
  } else {
    // 本地文件不存在，从后端加载完整内容
    const fullContent = await backend.getContent(result.id, level);
    display(fullContent);
  }
}
```

### 3.3 批量查询同步状态

**POST /api/v1/memories/sync-status**

```json
// 请求 - 插件端提供所有 local_id
{
  "local_ids": [
    "01HV8J3K2M4N5P6Q7R8S9T0UV",
    "01HV8J3K2M5ABC123DEF456",
    "01HV8J3K2M5GHI789JKL012"
  ],
  "tenant_id": "default"
}

// 响应
{
  "synced": [
    {
      "local_id": "01HV8J3K2M4N5P6Q7R8S9T0UV",
      "memory_id": "memory:s9kzvcu9z3xflbr2al5s",
      "synced_at": "2026-03-23T10:30:00Z"
    },
    {
      "local_id": "01HV8J3K2M5ABC123DEF456",
      "memory_id": "memory:a1b2c3d4e5f6...",
      "synced_at": "2026-03-23T10:35:00Z"
    }
  ],
  "missing": [
    "01HV8J3K2M5GHI789JKL012"  // ← 需要上传
  ]
}
```

**用途**：增量同步时快速找出哪些本地文件需要上传。

---

## 四、数据流示例

### 4.1 完整写入流程

```
插件端                                          后端
  │                                               │
  │ 1. 生成 local_id: 01HV8J3K2M4...              │
  │                                               │
  │ 2. 写入本地文件                               │
  │    entry_01HV8J3K2M4...md                     │
  │    ├── frontmatter.id: 01HV8J3K2M4...         │
  │    └── frontmatter.memory_id: pending         │
  │                                               │
  │ 3. 上传                                       │
  │    POST /api/v1/memories                      │
  │    {                                          │
  │      "content": "...",                        │
  │      "abstract": "...",                       │
  │      "metadata": {                            │
  │        "local_id": "01HV8J3K2M4..."  ────────▶│
  │      }                                        │
  │    }                                          │
  │                                               │
  │ 4. 接收响应                                   │
  │    {                                          │
  │      "id": "memory:s9kzvcu9...",              │
  │      "local_id": "01HV8J3K2M4..."  ◀─────────│
  │    }                                          │
  │                                               │
  │ 5. 更新本地文件                               │
  │    memory_id: memory:s9kzvcu...  (不改文件名) │
  │                                               │
  ▼                                               ▼
```

### 4.2 搜索流程

```
用户搜索 "TypeScript"
        │
        ▼
插件端调用 backend.search("TypeScript")
        │
        ▼
后端返回:
{
  "results": [
    {
      "id": "memory:s9kzvcu...",
      "local_id": "01HV8J3K2M4...",  ◀── 关键
      "abstract": "User prefers TypeScript...",
      "score": 0.95
    }
  ]
}
        │
        ▼
插件端通过 local_id 找到本地文件:
entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md
        │
        ▼
加载本地内容返回给用户
```

---

## 五、总结

### 5.1 关键字段：local_id

| 属性       | 说明                                                             |
| ---------- | ---------------------------------------------------------------- |
| **位置**   | memory / memory_warm / memory_cold / abstract_index / sync_state |
| **类型**   | string (ULID 格式)                                               |
| **唯一性** | UNIQUE 索引                                                      |
| **作用**   | 建立后端记录 ↔ 插件端文件的双向关联                              |

### 5.2 双向查找

| 方向              | 方法                                             |
| ----------------- | ------------------------------------------------ |
| **后端 → 插件端** | 通过 `local_id` 拼接文件名 `entry_{local_id}.md` |
| **插件端 → 后端** | 通过 `memory_id` 或 `local_id` 查询              |

### 5.3 核心价值

1. **去重**：上传时检查 local_id 是否已存在
2. **关联**：搜索结果通过 local_id 找到本地文件
3. **增量同步**：批量查询哪些 local_id 已同步
4. **一致性**：即使后端 ID 变化，local_id 保持不变

---

**确认**：此设计满足需求吗？local_id 作为关联字段是否清晰？
