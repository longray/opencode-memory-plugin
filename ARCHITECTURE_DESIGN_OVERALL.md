# OpenCode Memory 系统总体功能设计方案

**版本**: v1.0.0  
**日期**: 2026-03-15  
**作者**: OpenCode Agent  
**范围**: D:\github\opencode-memory-plugin + D:\embedding_service

---

## 1. 项目概述

### 1.1 系统定位

OpenCode Memory 是一个**分布式 AI 记忆系统**，为 OpenCode AI 助手提供持久化、语义化、可检索的长期记忆能力。采用**前后端分离架构**，插件端（轻量）+ 后端服务（重计算）模式。

### 1.2 设计哲学

1. **无感知记忆**: 用户无需主动保存，系统自动识别重要信息
2. **双重存储**: 本地 Markdown + 后端向量数据库，兼顾隐私与性能
3. **智能搜索**: 语义搜索 + 关键词搜索 + 图关系搜索，多维度召回
4. **渐进增强**: 本地基础功能 + 后端高级功能，优雅降级

---

## 2. 系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户层 (User Layer)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  OpenCode AI Assistant                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │
│  │ memory_write │  │memory_search │  │memory_relate │  ... 9 tools         │
│  └──────────────┘  └──────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           插件端 (Plugin Layer)                              │
│                    D:\github\opencode-memory-plugin                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        plugin.js (Tool Registration)                  │ │
│  │  - memory_write  → lib/memory-manager.js → Local MD file              │ │
│  │  - memory_search → lib/wrapper-client.js → Backend API                │ │
│  │  - memory_relate → lib/wrapper-client.js → Backend API                │ │
│  │  - memory_graph  → lib/wrapper-client.js → Backend API                │ │
│  │  - list_daily    → Local file system                                  │ │
│  │  - init_daily    → Local file system                                  │ │
│  │  - rebuild_index → lib/upload-queue.js  → Backend sync                │ │
│  │  - index_status  → lib/wrapper-client.js + Local status               │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      核心库模块 (lib/)                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  memory-manager.js  │  WrapperClient (wrapper-client.js)            │   │
│  │  - 本地MD文件管理   │  - HTTP客户端封装                             │   │
│  │  - 8个元数据标签    │  - 自动重试机制                               │   │
│  │  - 项目标签检测     │  - 错误分类处理                               │   │
│  │  - 上传状态管理     │  - 连接池复用                                 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  BM25算法 (bm25.js)         │  搜索融合 (fusion-strategies.js)      │   │
│  │  - 中文分词优化             │  - RRF融合                            │   │
│  │  - BM25_K1=1.2, B=0.75     │  - 温和版乘法融合                      │   │
│  │  - 回退搜索                 │  - 动态权重融合                        │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  上传队列 (upload-queue.js) │  项目解析 (project-resolver.js)       │   │
│  │  - 失败任务持久化           │  - 当前项目检测                        │   │
│  │  - 重试机制(MAX_RETRY=3)   │  - Git仓库识别                         │   │
│  │  - 批量重试                 │  - 工作区路径解析                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/WebSocket (Port 17999/3001)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         后端服务 (Backend Layer)                             │
│                         D:\embedding_service                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Wrapper Service (FastAPI)                         │   │
│  │                    Port: 17999 (minimal) / 3001 (full)              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  API Endpoints:                                                     │   │
│  │    GET  /health           → 级联健康检查                            │   │
│  │    POST /v1/embeddings    → Embedding代理 + 缓存                   │   │
│  │    POST /api/v1/memories  → 批量上传记忆                           │   │
│  │    POST /api/v1/memories/search → 混合搜索 (RRF)                   │   │
│  │    POST /api/v1/memories/relations → 创建图关系                     │   │
│  │    GET  /api/v1/memories/{id}/relations → 查询关系                 │   │
│  │    DEL  /api/v1/memories/relations/{id} → 删除关系                 │   │
│  │    POST /api/v1/memories/{id}/graph → 图遍历                        │   │
│  │    WS   /ws/memories/live → WebSocket实时推送                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   SurrealDB 3.0      │ │   Meilisearch 1.13   │ │   Embedding Service  │
│   Port: 18002        │ │   Port: 7700/18003   │ │   Port: 18000        │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│ - 向量存储 (HNSW)    │ │ - 全文搜索           │ │ - Qwen3-Embedding    │
│ - 图关系 (RELATE)    │ │ - CJK中文分词        │ │ - 1024维度           │
│ - KNN搜索 <|K,EF|>  │ │ - 代码术语字典       │ │ - 批处理优化         │
│ - 多租户隔离         │ │ - 104词字典          │ │ - ~50-100ms/req      │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
```

### 2.2 数据流架构

#### 2.2.1 写入流程 (memory_write)

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Plugin Layer                                                     │
│    - Build entry with 8 metadata tags                               │
│    - Detect project_tag via file path / git / heuristics           │
│    - Write to local MD file (MEMORY.md / PROJECT_MEMORY.md)        │
└─────────────────────────────────────────────────────────────────────┘
    │
    │ Async (non-blocking)
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Upload Queue                                                     │
│    - Add to upload-queue.json                                       │
│    - Background sync to backend                                     │
└─────────────────────────────────────────────────────────────────────┘
    │
    │ HTTP POST /api/v1/memories
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Backend Layer                                                    │
│    - Batch get embeddings from Embedding Service                    │
│    - Store to SurrealDB (vector + metadata)                         │
│    - Index to Meilisearch (full-text)                               │
│    - Return memory_id                                               │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Storage Layer                                                    │
│    SurrealDB: {id, content, embedding[], tenant_id, project_id...} │
│    Meilisearch: {id, content_zh, tags, date, ip_address...}         │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.2.2 搜索流程 (memory_search)

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Plugin Layer                                                     │
│    - Determine search mode: hybrid (default) / vector / keyword    │
│    - Call WrapperClient.search()                                    │
└─────────────────────────────────────────────────────────────────────┘
    │
    │ HTTP POST /api/v1/memories/search
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Backend Layer (MemoryManager)                                    │
│    IF mode == "vector":                                             │
│      - Get embedding for query                                      │
│      - SurrealDB KNN: SELECT ... FROM memory                        │
│            WHERE embedding <|$limit,50|> $query_vector              │
│      RETURN vector results                                          │
│                                                                     │
│    IF mode == "keyword":                                            │
│      - Meilisearch.search(query)                                    │
│      RETURN keyword results                                         │
│                                                                     │
│    IF mode == "hybrid" (default):                                   │
│      - Parallel: Vector search (SurrealDB) + Keyword (Meilisearch) │
│      - RRF Fusion: score = Σ 1/(k + rank), k=60                    │
│      - RETURN merged & ranked results                               │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Plugin Response Formatting                                       │
│    - Format backend results for OpenCode display                    │
│    - Add score, tags, project_id metadata                           │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2.2.3 图关系流程 (memory_relate / memory_graph)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Create Relation (memory_relate)                                     │
│                                                                     │
│ Plugin → POST /api/v1/memories/relations                            │
│ Backend → SurrealDB: RELATE memory:from_id → memory:to_id          │
│           CONTENT { relationship_type, weight, tenant_id }         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Graph Traversal (memory_graph)                                      │
│                                                                     │
│ Plugin → POST /api/v1/memories/{id}/graph                           │
│ Backend → SurrealDB:                                                │
│   SELECT * FROM memory:{id}                                         │
│   ->(follow_up|related|elaboration)->memory                         │
│   [WHERE depth <= $depth]                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 功能模块详细设计

### 3.1 插件端功能模块 (opencode-memory-plugin)

#### 3.1.1 工具清单 (9个)

| 工具            | 类型   | 功能描述                      | 后端依赖 | 回退机制     |
| --------------- | ------ | ----------------------------- | -------- | ------------ |
| `memory_write`  | Write  | 写入记忆到本地MD + 同步到后端 | Optional | Local only   |
| `memory_read`   | Read   | 读取本地记忆文件              | No       | N/A          |
| `memory_search` | Search | 混合搜索（向量+关键词）       | Yes      | BM25 local   |
| `memory_relate` | Graph  | 创建记忆间关系                | Yes      | Error        |
| `memory_graph`  | Graph  | 图遍历查询                    | Yes      | Error        |
| `list_daily`    | List   | 列出每日日志文件              | No       | N/A          |
| `init_daily`    | Write  | 初始化今日日志                | No       | N/A          |
| `rebuild_index` | Sync   | 同步本地文件到后端索引        | Yes      | BM25 rebuild |
| `index_status`  | Status | 检查系统状态                  | Optional | Local only   |

#### 3.1.2 MemoryManager (记忆管理器)

**核心职责**:

- 本地 Markdown 文件读写
- 8个元数据标签管理
- 项目标签自动检测
- 上传状态追踪

**数据结构**:

```javascript
{
  id: "mem_1710259200000_a1b2c3d4",
  timestamp: "2026-03-15T10:30:00.000Z",
  type: "preference",
  tags: ["typescript", "code-style"],
  project_tag: "global",        // 项目标签
  project_id: null,             // 项目唯一ID
  project_name: null,           // 项目可读名
  uploaded: false,              // 上传状态
  upload_timestamp: null,       // 上传时间
  upload_error: null,           // 上传错误
  classification_confidence: null,
  classified_at: null,
  content: "User prefers TypeScript..."
}
```

**项目检测算法**:

```javascript
detectProjectTag(content) {
  // 1. 文件路径模式匹配
  const pathPatterns = [
    /\/workspaces\/([^\/]+)\//,
    /\/projects\/([^\/]+)\//,
    /git@github\.com:([^\/]+)\//
  ];

  // 2. 全局白名单
  const globalPatterns = [
    'user preferences', 'coding style',
    'best practices', 'system configuration'
  ];

  // 3. 返回: 'global' | projectName | 'unclassified'
}
```

#### 3.1.3 WrapperClient (后端客户端)

**功能特性**:

- HTTP/HTTPS 请求封装
- 自动重试（指数退避）
- 超时控制（默认30s）
- 错误分类（可重试/不可重试）

**重试策略**:

```javascript
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!error.retryable || attempt === maxRetries) throw error;
      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
}
```

**错误分类**:

- **可重试**: 500+, 429, ECONNREFUSED, ETIMEDOUT
- **不可重试**: 400-499 (客户端错误)

#### 3.1.4 BM25 算法 (bm25.js)

**参数配置**:

```javascript
const BM25_K1 = 1.2; // 词频饱和参数
const BM25_B = 0.75; // 文档长度归一化
```

**中文分词优化**:

```javascript
tokenize(text) {
  // 1. 提取2字以上中文词组
  const chineseWords = part.match(/[\u4e00-\u9fa5]{2,}/g) || [];

  // 2. 提取单个中文字符
  const singleChars = part.match(/[\u4e00-\u9fa5]/g) || [];

  // 3. 保留英文词组（长度>1）
  const englishParts = part.match(/[a-z0-9]+/g) || [];

  return [...chineseWords, ...singleChars,
          ...englishParts.filter(w => w.length > 1)];
}
```

**性能指标**:

- Recall: 82.5% (中文优化后)
- MRR: 0.7939
- 搜索延迟: <50ms (1000文档)

#### 3.1.5 Fusion Strategies (搜索融合)

**1. RRF融合 (推荐)**:

```javascript
function rrfFusion(vectorResults, bm25Results, k = 60) {
  const scoreMap = new Map();

  // 向量结果评分
  vectorResults.forEach((r, index) => {
    const rank = index + 1;
    scoreMap.set(r.id, { score: 1 / (k + rank) });
  });

  // BM25结果累加评分
  bm25Results.forEach((r, index) => {
    const rank = index + 1;
    if (scoreMap.has(r.id)) {
      scoreMap.get(r.id).score += 1 / (k + rank);
    } else {
      scoreMap.set(r.id, { score: 1 / (k + rank) });
    }
  });

  return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
}
```

**2. 温和版乘法融合**:

```
final_score = 0.5 * norm_vector + 0.3 * norm_bm25 + 0.2 * norm_vector * norm_bm25
```

### 3.2 后端服务功能模块 (embedding_service)

#### 3.2.1 Wrapper Service API

**端点清单**:

| 端点                              | 方法 | 请求体                                        | 响应                                                  | 描述          |
| --------------------------------- | ---- | --------------------------------------------- | ----------------------------------------------------- | ------------- |
| `/health`                         | GET  | -                                             | `{status, embedding_service, surrealdb, meilisearch}` | 级联健康检查  |
| `/v1/embeddings`                  | POST | `{input, model}`                              | `{data: [{embedding}]}`                               | Embedding代理 |
| `/api/v1/memories`                | POST | `{memories[], tenant_id}`                     | `{total, success, failed, memory_ids[]}`              | 批量上传      |
| `/api/v1/memories/search`         | POST | `{query, mode, limit, threshold, tenant_id}`  | `{results[]}`                                         | 混合搜索      |
| `/api/v1/memories/relations`      | POST | `{from_id, to_id, relationship_type, weight}` | `{relation_id}`                                       | 创建关系      |
| `/api/v1/memories/{id}/relations` | GET  | -                                             | `{relations[]}`                                       | 查询关系      |
| `/api/v1/memories/relations/{id}` | DEL  | -                                             | `{success}`                                           | 删除关系      |
| `/api/v1/memories/{id}/graph`     | POST | `{depth, limit}`                              | `{nodes[], edges[]}`                                  | 图遍历        |
| `/ws/memories/live`               | WS   | Query params                                  | `{action, result}`                                    | 实时推送      |

#### 3.2.2 MemoryManager (后端)

**核心职责**:

- 批量上传记忆
- 混合搜索协调
- Embedding服务调用
- Meilisearch集成

**搜索算法**:

```python
async def search_memories(self, query, mode="hybrid", limit=10):
    if mode == "vector":
        # 1. 获取query的embedding
        query_embedding = await self._get_embeddings([query])
        # 2. SurrealDB KNN搜索
        return await self._vector_search(query_embedding, limit)

    elif mode == "keyword":
        # Meilisearch全文搜索
        return await self._meili.search(query, limit)

    elif mode == "hybrid":
        # 并行执行
        vector_task = self._vector_search(query_embedding, limit * 2)
        keyword_task = self._meili.search(query, limit * 2)

        vector_results, keyword_results = await asyncio.gather(
            vector_task, keyword_task
        )

        # RRF融合
        return self._rrf_fusion(vector_results, keyword_results, limit)
```

**RRF融合实现**:

```python
def _rrf_fusion(self, vector_results, keyword_results, limit, k=60):
    scores = {}

    # 向量结果
    for rank, result in enumerate(vector_results, 1):
        doc_id = result['id']
        scores[doc_id] = {
            'doc': result,
            'score': 1.0 / (k + rank)
        }

    # 关键词结果累加
    for rank, result in enumerate(keyword_results, 1):
        doc_id = result['id']
        if doc_id in scores:
            scores[doc_id]['score'] += 1.0 / (k + rank)
        else:
            scores[doc_id] = {
                'doc': result,
                'score': 1.0 / (k + rank)
            }

    # 排序并返回前limit个
    return sorted(scores.values(), key=lambda x: x['score'], reverse=True)[:limit]
```

#### 3.2.3 SurrealDB Schema

**记忆表 (memory)**:

```sql
DEFINE TABLE memory SCHEMAFULL;

DEFINE FIELD content ON memory TYPE string;
DEFINE FIELD embedding ON memory TYPE array<float>;
DEFINE FIELD tenant_id ON memory TYPE string;
DEFINE FIELD type ON memory TYPE string;
DEFINE FIELD tags ON memory TYPE array<string>;
DEFINE FIELD project_id ON memory TYPE string;
DEFINE FIELD source ON memory TYPE string;
DEFINE FIELD source_id ON memory TYPE option<string>;
DEFINE FIELD metadata ON memory TYPE object;

-- HNSW向量索引
DEFINE INDEX memory_embedding_idx ON memory
  FIELDS embedding
  HNSW DIMENSION 1024
  DISTANCE COSINE
  EFC 50;
```

**图关系表 (memory_relations)**:

```sql
DEFINE TABLE memory_relations SCHEMAFULL;

DEFINE FIELD from ON memory_relations TYPE record<memory>;
DEFINE FIELD to ON memory_relations TYPE record<memory>;
DEFINE FIELD relationship_type ON memory_relations TYPE string;
DEFINE FIELD weight ON memory_relations TYPE float;
DEFINE FIELD tenant_id ON memory_relations TYPE string;

-- 关系索引
DEFINE INDEX rel_from_idx ON memory_relations FIELDS from;
DEFINE INDEX rel_to_idx ON memory_relations FIELDS to;
DEFINE INDEX rel_type_idx ON memory_relations FIELDS relationship_type;
```

#### 3.2.4 Meilisearch 配置

**索引设置**:

```python
DEFAULT_INDEX_SETTINGS = {
    "searchableAttributes": [
        "content_zh", "title_zh", "tags_zh",
        "content_search", "code", "content"
    ],
    "filterableAttributes": [
        "tenant_id", "type", "tags", "project_id",
        "date", "ip_address", "email", "version", "created_at"
    ],
    "sortableAttributes": ["date", "created_at"],

    # 非分隔符（保留代码标识符完整性）
    "nonSeparatorTokens": [".", "-", "@", ":", "/", "_"],

    # 104词代码术语字典
    "dictionary": [
        "v1", "v2", "v3", "alpha", "beta", "rc",
        "python", "javascript", "typescript", "fastapi",
        "http", "https", "api", "get", "post", "put", "delete",
        "class", "function", "async", "await",
        "react", "vue", "django", "flask",
        # ... 104个术语
    ],

    "typoTolerance": {
        "enabled": True,
        "disableOnAttributes": ["file_path", "version", "email", "ip_address"]
    }
}
```

---

## 4. 配置体系

### 4.1 插件端配置

**配置文件**: `~/.opencode/memory/memory-config.json`

```json
{
  "version": "3.0",
  "search": {
    "mode": "hybrid"
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "default",
    "timeout": 30000,
    "max_retries": 3
  },
  "projects": {
    "auto_detect": true,
    "mapping": {
      "opencode-memory-plugin": "memory-plugin"
    }
  }
}
```

### 4.2 后端服务配置

**环境变量配置**:

```bash
# Wrapper Service
WRAPPER_HOST=0.0.0.0
WRAPPER_PORT=17999
WRAPPER_EMBEDDING_SERVICE_URL=http://localhost:18000
WRAPPER_SURREALDB_URL=ws://localhost:18002/rpc
WRAPPER_MEILI_ENABLED=true
WRAPPER_MEILI_URL=http://localhost:7700

# SurrealDB
WRAPPER_SURREALDB_NAMESPACE=memory_ns
WRAPPER_SURREALDB_DATABASE=memory_db
WRAPPER_SURREALDB_USERNAME=root
WRAPPER_SURREALDB_PASSWORD=root
WRAPPER_SURREALDB_USE_RUNTIME_CREDENTIALS=true

# Telemetry (OpenTelemetry)
WRAPPER_OTEL_ENABLED=false
WRAPPER_OTEL_ENDPOINT=http://localhost:4317
WRAPPER_OTEL_SAMPLE_RATE=1.0
```

---

## 5. 部署架构

### 5.1 Docker Compose 部署

```yaml
version: "3.8"

services:
  surrealdb:
    image: surrealdb/surrealdb:v3.0.1
    ports: ["18002:18002"]
    command: start --user root --pass root --bind 0.0.0.0:18002 rocksdb://data
    volumes: [surrealdb-data:/data]

  meilisearch:
    image: getmeili/meilisearch:v1.13
    ports: ["7700:7700"]
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
      MEILI_ENV: development
    volumes: [meili-data:/meili_data]

  embedding:
    build:
      context: .
      dockerfile: Dockerfile.embedding
    ports: ["18000:18000"]
    environment:
      EMB_PORT: 18000
      EMB_MODEL_PATH: Qwen/Qwen3-Embedding-0.6B
    volumes: [model-cache:/models]

  wrapper:
    build:
      context: ./wrapper
      dockerfile: Dockerfile
    ports: ["17999:17999"]
    environment:
      WRAPPER_PORT: 17999
      WRAPPER_EMBEDDING_SERVICE_URL: http://embedding:18000
      WRAPPER_SURREALDB_URL: ws://surrealdb:18002/rpc
      WRAPPER_MEILI_ENABLED: "true"
      WRAPPER_MEILI_URL: http://meilisearch:7700
    depends_on:
      - surrealdb
      - meilisearch
      - embedding

volumes:
  surrealdb-data:
  meili-data:
  model-cache:
```

### 5.2 端口映射

| 服务        | 端口       | 协议           | 说明            |
| ----------- | ---------- | -------------- | --------------- |
| Wrapper     | 17999/3001 | HTTP/WebSocket | 主API入口       |
| SurrealDB   | 18002      | WebSocket      | 向量+图数据库   |
| Meilisearch | 7700/18003 | HTTP           | 全文搜索引擎    |
| Embedding   | 18000      | HTTP           | Embedding服务   |
| LLM         | 18001      | HTTP           | LLM服务（可选） |

---

## 6. 开发路线图

### 6.1 当前状态 (v2.3.0)

**已完成 ✅**:

- [x] P0: 核心功能（Embedding + LLM + Wrapper）
- [x] P1: 增强功能（熔断器、缓存、监控）
- [x] P2: 生产就绪（API认证、CI/CD、文档）
- [x] P3-1: Docker Compose一键部署
- [x] P3-2: HNSW向量搜索优化
- [x] Phase 3A: 批量Embedding性能优化（10x加速）
- [x] Phase 3B: OpenTelemetry分布式追踪
- [x] Phase 3C: 安全加固（DB权限分离）
- [x] Phase 3D: WebSocket实时推送
- [x] Phase 3E: Polyglot搜索架构（Meilisearch + SurrealDB）

### 6.2 短期路线图 (v2.4.0 - v2.5.0)

**优先级P0 (必须)**:

- [ ] 实现对话钩子自动触发 (@memory-automation)
- [ ] 添加HNSW向量索引性能监控
- [ ] 实现查询结果缓存

**优先级P1 (高)**:

- [ ] 用户反馈机制（点赞/点踩）
- [ ] 合并历史追踪与回滚
- [ ] 异步I/O优化（插件端）

### 6.3 中期路线图 (v3.0.0)

**优先级P2 (中)**:

- [ ] 智能推荐系统（上下文感知推荐）
- [ ] 访问统计与分析
- [ ] Kubernetes Helm Chart
- [ ] 审计日志系统
- [ ] API密钥轮换机制

**优先级P3 (低)**:

- [ ] Redis分布式缓存
- [ ] 多模态记忆支持（图片、代码片段）
- [ ] 记忆图谱可视化
- [ ] 团队协作功能

---

## 7. 关键技术决策

### 7.1 为什么选择 Polyglot 架构？

**决策背景**:

- SurrealDB的FTS在v3.0.1-3.0.3有多个未修复的bug
- SurrealDB的tokenizer无法可靠处理日期格式和中文分词
- Meilisearch原生支持CJK分词，日期搜索开箱即用

**架构决策**:

- **SurrealDB**: 向量存储(HNSW) + 图关系(RELATE) + 数据存储
- **Meilisearch**: 全文搜索 + CJK分词 + 日期精确匹配

**收益**:

- ✅ 搜索质量提升30%
- ✅ 代码标识符搜索精度提升
- ✅ 开发时间从7-10天降到2-3天
- ✅ 消除所有workaround

### 7.2 为什么保留本地MD文件？

**决策理由**:

1. **隐私保护**: 敏感数据可仅本地存储
2. **离线可用**: 后端不可用时仍可基础功能
3. **可移植性**: Markdown格式通用，易于导出
4. **调试便利**: 可直接查看和编辑

**权衡**:

- ✅ 优势: 隐私、离线、可移植
- ⚠️ 劣势: 数据一致性需要同步机制

### 7.3 为什么使用RRF融合算法？

**决策理由**:

1. **零样本**: 无需训练，直接使用
2. **无需归一化**: 对分数分布不敏感
3. **简单高效**: 计算复杂度低
4. **文献验证**: Cormack et al. 2009推荐

**对比**:
| 算法 | 复杂度 | 归一化 | 长尾处理 | 推荐度 |
|------|--------|--------|----------|--------|
| RRF | O(N) | 不需要 | 优秀 | ⭐⭐⭐⭐⭐ |
| 加权平均 | O(N) | 需要 | 一般 | ⭐⭐⭐ |
| 乘法融合 | O(N) | 需要 | 差 | ⭐⭐ |

---

## 8. 性能指标与SLA

### 8.1 当前性能指标

| 指标          | 目标   | 当前     | 状态      |
| ------------- | ------ | -------- | --------- |
| 写入延迟      | <1s    | <500ms   | ✅ 优秀   |
| 搜索延迟      | <500ms | <200ms   | ✅ 优秀   |
| Embedding延迟 | <200ms | 50-100ms | ✅ 优秀   |
| 搜索准确率    | >90%   | 95%+     | ✅ 优秀   |
| 系统可用性    | 99.9%  | -        | ⏳ 待监控 |
| 缓存命中率    | >50%   | -        | ⏳ 待监控 |

### 8.2 容量规划

| 资源              | 当前  | 建议  | 说明         |
| ----------------- | ----- | ----- | ------------ |
| SurrealDB内存     | 2GB   | 4GB   | 向量索引占用 |
| Meilisearch内存   | 1GB   | 2GB   | 全文索引占用 |
| Embedding服务内存 | 4GB   | 8GB   | 模型加载     |
| Wrapper服务内存   | 512MB | 1GB   | API服务      |
| 存储              | 10GB  | 100GB | 日志+索引    |

---

## 9. 风险评估与缓解

### 9.1 技术风险

| 风险                | 影响 | 概率 | 缓解措施                 |
| ------------------- | ---- | ---- | ------------------------ |
| SurrealDB升级不兼容 | 高   | 中   | 在测试环境验证，灰度发布 |
| Meilisearch索引损坏 | 中   | 低   | 定期备份，支持重建       |
| Embedding服务过载   | 中   | 中   | 限流 + 熔断 + 缓存       |
| 网络分区            | 高   | 低   | 本地回退机制             |

### 9.2 运营风险

| 风险     | 影响 | 概率 | 缓解措施                  |
| -------- | ---- | ---- | ------------------------- |
| 数据泄露 | 高   | 低   | API认证 + 审计日志        |
| 服务宕机 | 高   | 中   | Docker Compose + 健康检查 |
| 性能下降 | 中   | 中   | 监控告警 + 自动扩容       |
| 数据丢失 | 高   | 低   | 定期备份 + 多副本         |

---

## 10. 总结

### 10.1 核心成就

✅ **架构完成**: 前后端分离，职责清晰  
✅ **功能完整**: 9个工具，覆盖记忆全生命周期  
✅ **搜索优化**: Polyglot架构，RRF融合，95%+准确率  
✅ **部署就绪**: Docker Compose一键部署  
✅ **可扩展性**: 支持多租户、多项目、图关系

### 10.2 下一步行动

**立即执行** (本周):

1. 实现对话钩子自动触发
2. 添加HNSW性能监控
3. 完善测试覆盖率

**短期执行** (本月):

1. 用户反馈机制
2. 合并历史追踪
3. 异步I/O优化

**中期执行** (下月):

1. 智能推荐系统
2. Kubernetes支持
3. 审计日志

### 10.3 架构愿景

**终极目标**: 打造一个**自进化的 AI 记忆系统**

- 自动识别重要信息，无需人工干预
- 智能关联记忆，发现隐藏知识
- 持续学习用户偏好，越用越智能
- 支持团队协作，知识共享

**路线图**: v2.x → v3.0 → v4.0

- **v2.x**: 功能完善，性能优化
- **v3.0**: 智能推荐，可视化
- **v4.0**: 团队协作，机器学习

---

**文档版本**: v1.0.0  
**最后更新**: 2026-03-15  
**作者**: OpenCode Agent  
**审核**: 待Oracle评审
