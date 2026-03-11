# OpenCode Memory Plugin ↔ Backend Memory Service 集成架构设计

> 版本: 1.0  
> 日期: 2026-03-11  
> 方案: 混合模式 (本地写 + 异步同步 + 后端搜索)

---

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          OpenCode 环境                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Plugin (plugin.js)                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │memory_write │  │memory_search│  │memory_relate│  │memory_graph│  │   │
│  │  │  (改造)     │  │  (改造)     │  │  (新增)     │  │  (新增)   │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │   │
│  │         └─────────────────┴─────────────────┴───────────────┘      │   │
│  │                              │                                     │   │
│  │                    ┌─────────▼──────────┐                          │   │
│  │                    │  wrapper-client.js │                          │   │
│  │                    │  (HTTP API 客户端)  │                          │   │
│  │                    └─────────┬──────────┘                          │   │
│  │                              │                                     │   │
│  │  ┌───────────────────────────┴───────────────────────────┐        │   │
│  │  │              本地文件系统 (~/.opencode/memory/)          │        │   │
│  │  │  MEMORY.md, daily/*.md, project-mappings.json            │        │   │
│  │  └────────────────────────────────────────────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ HTTP/JSON
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Backend Memory Service (Port 17999)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ /v1/embeddings│  │/api/v1/memories│ │/api/v1/memories│ │ /health      │    │
│  │  (Embedding) │  │   (Upload)   │  │  (Search)    │  │ (Health)     │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐                                          │
│  │ /api/v1/memories│  │/api/v1/memories│  SurrealDB (HNSW + BM25)           │
│  │  (Relations) │  │  (Graph)     │  ┌────────────────────────┐            │
│  └──────────────┘  └──────────────┘  │ memory table           │            │
│                                       │ - tenant_id, project_id│            │
│                                       │ - embedding (1024d)    │            │
│                                       │ - source_id (UNIQUE)   │            │
│                                       │ memory_relation table  │            │
│                                       └────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、多租户与项目隔离策略

### 2.1 tenant_id (用户级隔离)

**生成策略**:

1. 优先从环境变量 `MEMORY_TENANT_ID` 读取
2. 否则从配置文件的 `backend.tenant_id` 读取
3. 否则使用 OS 用户名: `process.env.USERNAME || process.env.USER`
4. 兜底: `"default"`

**持久化**: 写入 `memory-config.json` 的 `backend.tenant_id`

**场景覆盖**:

- 用户A和用户B共享同一后端 → tenant_id 不同，完全隔离

### 2.2 project_id (项目级隔离)

**生成策略** (按优先级):

| 优先级 | 来源                         | 说明                                       |
| ------ | ---------------------------- | ------------------------------------------ |
| 1      | 环境变量 `MEMORY_PROJECT_ID` | 用户强制指定                               |
| 2      | Git 远程URL                  | `git remote get-url origin` → 提取 repo 名 |
| 3      | package.json name            | 读取 `name` 字段                           |
| 4      | 当前目录名                   | `path.basename(process.cwd())`             |
| 5      | 配置中手动映射               | 目录路径 → project_id 映射表               |
| 兜底   | `"global"`                   | 跨项目共享的记忆                           |

**project-mappings.json** (解决场景2: 同一项目多目录):

```json
{
  "project_mappings": {
    "myapp": {
      "paths": ["D:\\projects\\myapp", "E:\\backup\\myapp"],
      "project_id": "myapp"
    }
  }
}
```

**场景覆盖**:

- 场景1: 同名项目不同用户 → tenant_id 已隔离
- 场景2: 同一项目不同目录 → 通过 mappings 关联到同一 project_id
- 场景3: 混合目录 → 优先 git/package.json 识别，失败时使用目录名

### 2.3 source_id (去重)

**生成策略**:

```javascript
source_id = `${tenant_id}:${project_id}:${content_hash}`;
// content_hash = md5(content + type + tags.sort().join(','))
```

**特点**:

- 包含 tenant_id 和 project_id，确保跨租户/项目不冲突
- 基于内容哈希，内容变化则 source_id 变化
- SurrealDB UNIQUE 约束防止重复上传

---

## 三、核心组件设计

### 3.1 wrapper-client.js

```javascript
class WrapperClient {
  constructor(config)

  // 健康检查
  async health() → { status, embedding_service, surrealdb, cache_stats }

  // 搜索 (3种模式)
  async search(query, mode, limit, threshold, tenant_id, project_id) → { results, total, mode }

  // 上传记忆
  async uploadMemory(memory) → { id, success }
  async uploadMemories(memories) → { total, success, failed, memory_ids }

  // 图关系
  async createRelation(from_id, to_id, type, weight, tenant_id) → { id }
  async getRelations(memory_id, direction, type, tenant_id) → { relations, total }
  async deleteRelation(relation_id, tenant_id) → { deleted }
  async traverseGraph(memory_id, depth, tenant_id) → { memories, total }
}
```

**错误处理**:

- HTTP 错误 → 分类为可重试/不可重试
- 后端不可用 → 返回 `fallback: true` 信号
- 自动重试: 3次，指数退避

### 3.2 project-resolver.js

```javascript
class ProjectResolver {
  constructor(config)

  async resolveProjectId() → string
  // 1. 检查环境变量
  // 2. 检查 git remote
  // 3. 检查 package.json
  // 4. 检查目录名
  // 5. 检查 mappings

  async saveMapping(project_id, path) → void
  async getMapping(path) → project_id | null
}
```

---

## 四、工具改造方案

### 4.1 memory_write (改造)

**原逻辑**:

1. 追加写入本地 MEMORY.md

**新逻辑**:

1. 追加写入本地 MEMORY.md (保持不变)
2. 异步上传到后端 (不阻塞返回)
3. 如果后端不可用，记录待同步队列

**实现**:

```javascript
async execute(args) {
  // 1. 本地写入 (保持原逻辑)
  const localResult = await writeToLocalFile(args);

  // 2. 异步上传到后端
  const projectId = await projectResolver.resolveProjectId();
  const sourceId = generateSourceId(args);

  uploadQueue.add({
    content: args.content,
    type: args.type,
    tags: args.tags,
    project_id: projectId,
    source_id: sourceId,
    tenant_id: config.backend.tenant_id
  });

  return localResult; // 立即返回本地结果
}
```

### 4.2 memory_search (改造)

**原逻辑**: 本地逐行 `.includes()` 匹配

**新逻辑**:

1. 尝试后端 keyword 搜索
2. 如果后端不可用，回退到本地 BM25

**实现**:

```javascript
async execute(args) {
  const client = new WrapperClient(config);
  const health = await client.health();

  if (health.status === 'healthy') {
    const projectId = await projectResolver.resolveProjectId();
    const results = await client.search(
      args.query,
      'keyword', // 强制 keyword 模式
      args.limit || 10,
      0.0, // keyword 模式 threshold 为 0
      config.backend.tenant_id,
      projectId
    );
    return formatBackendResults(results);
  } else {
    // 回退到本地 BM25
    return fallbackBM25Search(args.query, args.limit);
  }
}
```

### 4.3 vector_memory_search (改造)

**原逻辑**: 本地 sqlite-vec / BM25 (Bun下不可用)

**新逻辑**:

1. 优先后端 hybrid/vector 搜索
2. 后端不可用时回退到本地 BM25

**实现**:

```javascript
async execute(args) {
  const mode = args.mode || 'hybrid';
  const client = new WrapperClient(config);
  const health = await client.health();

  if (health.status === 'healthy') {
    const projectId = await projectResolver.resolveProjectId();
    const results = await client.search(
      args.query,
      mode, // 'vector' | 'keyword' | 'hybrid'
      args.limit || 10,
      args.threshold || 0.3,
      config.backend.tenant_id,
      projectId
    );
    return formatBackendResults(results);
  } else {
    // 回退到本地 BM25
    return fallbackBM25Search(args.query, args.limit);
  }
}
```

### 4.4 rebuild_index (改造)

**原逻辑**: 本地 SQLite 索引

**新逻辑**: 批量同步本地 .md 文件到后端

**实现**:

```javascript
async execute(args) {
  // 1. 扫描所有本地 .md 文件
  const files = getMemoryFiles();

  // 2. 解析每个文件的条目
  const entries = [];
  for (const file of files) {
    const fileEntries = parseEntriesFromFile(file);
    entries.push(...fileEntries);
  }

  // 3. 批量上传到后端
  const client = new WrapperClient(config);
  const projectId = await projectResolver.resolveProjectId();

  const memories = entries.map(e => ({
    content: e.content,
    type: e.type,
    tags: e.tags,
    project_id: projectId,
    source_id: generateSourceId(e),
    tenant_id: config.backend.tenant_id
  }));

  const result = await client.uploadMemories(memories);

  return `已同步 ${result.success}/${result.total} 条记忆到后端`;
}
```

### 4.5 index_status (改造)

**原逻辑**: 本地文件状态 + 本地索引状态

**新逻辑**: 本地状态 + 后端状态合并

**实现**:

```javascript
async execute(args) {
  // 本地状态 (保持不变)
  const localStatus = getLocalStatus();

  // 后端状态
  const client = new WrapperClient(config);
  let backendStatus;
  try {
    backendStatus = await client.health();
  } catch (e) {
    backendStatus = { status: 'unavailable', error: e.message };
  }

  return formatCombinedStatus(localStatus, backendStatus);
}
```

### 4.6 memory_relate (新增)

**功能**: 创建/查询图关系

```javascript
memory_relate: tool({
  description: 'Create or query relations between memories',
  args: {
    action: tool.schema.string().describe("'create', 'query', or 'delete'"),
    from_id: tool.schema.string().optional().describe('Source memory ID (for create)'),
    to_id: tool.schema.string().optional().describe('Target memory ID (for create)'),
    relation_type: tool.schema
      .string()
      .optional()
      .default('related')
      .describe(
        "'related', 'follow_up', 'elaboration', 'contradiction', 'reference', 'derived_from'"
      ),
    memory_id: tool.schema.string().optional().describe('Memory ID (for query/delete)'),
    direction: tool.schema
      .string()
      .optional()
      .default('both')
      .describe("'outgoing', 'incoming', 'both' (for query)"),
  },
  async execute(args) {
    const client = new WrapperClient(config);

    if (args.action === 'create') {
      return await client.createRelation(
        args.from_id,
        args.to_id,
        args.relation_type,
        0.5,
        config.backend.tenant_id
      );
    } else if (args.action === 'query') {
      return await client.getRelations(
        args.memory_id,
        args.direction,
        args.relation_type,
        config.backend.tenant_id
      );
    } else if (args.action === 'delete') {
      return await client.deleteRelation(args.memory_id, config.backend.tenant_id);
    }
  },
});
```

### 4.7 memory_graph (新增)

**功能**: 图遍历

```javascript
memory_graph: tool({
  description: 'Traverse the memory graph to find related memories',
  args: {
    memory_id: tool.schema.string().describe('Starting memory ID'),
    depth: tool.schema.number().optional().default(2).describe('Traversal depth (1-3)'),
    limit: tool.schema.number().optional().default(20).describe('Max results'),
  },
  async execute(args) {
    const client = new WrapperClient(config);
    const result = await client.traverseGraph(args.memory_id, args.depth, config.backend.tenant_id);
    return formatGraphResults(result);
  },
});
```

### 4.8 memory_read, list_daily, init_daily (保持不变)

这些工具只操作本地文件，无需改造。

---

## 五、配置系统

### 5.1 memory-config.json 新结构

```json
{
  "version": "3.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25",
    "cache": { "enabled": false }
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "longray",
    "project_resolution": {
      "strategy": "auto",
      "priority": ["env", "git", "package", "dirname"]
    },
    "sync": {
      "mode": "async",
      "on_write": true,
      "batch_size": 10,
      "retry_failed": true
    },
    "fallback": {
      "enabled": true,
      "local_search": true,
      "queue_failed_uploads": true
    }
  },
  "project_mappings": {
    "myapp": {
      "paths": ["D:\\projects\\myapp", "E:\\backup\\myapp"]
    }
  },
  "indexing": {
    "chunkSize": 400,
    "chunkOverlap": 80,
    "autoRebuild": true
  }
}
```

### 5.2 环境变量

| 变量                 | 说明                | 优先级 |
| -------------------- | ------------------- | ------ |
| `MEMORY_TENANT_ID`   | 强制指定 tenant_id  | 最高   |
| `MEMORY_PROJECT_ID`  | 强制指定 project_id | 最高   |
| `MEMORY_BACKEND_URL` | 后端服务 URL        | 高     |
| `MODELSCOPE_API_KEY` | ModelScope API Key  | -      |

---

## 六、同步策略

### 6.1 同步时机

| 触发条件           | 行为                     |
| ------------------ | ------------------------ |
| memory_write 调用  | 异步上传 (不阻塞)        |
| rebuild_index 调用 | 批量同步所有历史记忆     |
| 启动时             | 检查并同步上次失败的队列 |

### 6.2 失败队列

```javascript
// ~/.opencode/memory/upload-queue.json
{
  "failed_uploads": [
    {
      "timestamp": "2026-03-11T12:00:00Z",
      "memory": { /* memory data */ },
      "retry_count": 2,
      "last_error": "Connection timeout"
    }
  ]
}
```

### 6.3 幂等性保证

- source_id 格式: `${tenant_id}:${project_id}:${content_hash}`
- SurrealDB UNIQUE 约束: `DEFINE INDEX memory_source_id ON memory FIELDS source_id UNIQUE`
- 重复上传自动忽略 (后端返回成功但无新记录)

---

## 七、错误处理与回退

### 7.1 错误分类

| 错误类型   | 示例                  | 处理策略                |
| ---------- | --------------------- | ----------------------- |
| 网络错误   | ECONNREFUSED, timeout | 重试3次，然后标记为失败 |
| 服务端错误 | 500, 502              | 立即回退                |
| 客户端错误 | 400, 422              | 记录错误，不回退        |
| 后端不可用 | health 失败           | 回退到本地搜索          |

### 7.2 回退策略

```
后端搜索失败
    │
    ├─► 网络超时? ──► 重试3次
    │
    └─► 仍失败? ────► 回退到本地 BM25
                        │
                        └─► 返回本地结果 + 警告信息
```

---

## 八、分阶段实施计划

### 阶段1: 基础组件 (4h)

| 任务 | 文件                      | 说明                  |
| ---- | ------------------------- | --------------------- |
| 1.1  | `lib/project-resolver.js` | project_id 解析器     |
| 1.2  | `lib/wrapper-client.js`   | HTTP API 客户端       |
| 1.3  | `lib/upload-queue.js`     | 失败上传队列管理      |
| 1.4  | 配置读取改造              | 读取新的 backend 配置 |

### 阶段2: 工具改造 (4h)

| 任务 | 文件                               | 说明                   |
| ---- | ---------------------------------- | ---------------------- |
| 2.1  | `plugin.js` - memory_write         | 本地写 + 异步上传      |
| 2.2  | `plugin.js` - memory_search        | 优先后端 keyword       |
| 2.3  | `plugin.js` - vector_memory_search | 优先后端 hybrid/vector |
| 2.4  | `plugin.js` - rebuild_index        | 批量同步本地→后端      |
| 2.5  | `plugin.js` - index_status         | 合并后端状态           |

### 阶段3: 新增工具 (2h)

| 任务 | 文件                        | 说明         |
| ---- | --------------------------- | ------------ |
| 3.1  | `plugin.js` - memory_relate | 图关系工具   |
| 3.2  | `plugin.js` - memory_graph  | 图遍历工具   |
| 3.3  | `index.js`                  | 更新工具列表 |

### 阶段4: 测试与文档 (2h)

| 任务 | 说明                               |
| ---- | ---------------------------------- |
| 4.1  | 测试所有工具 (后端可用/不可用场景) |
| 4.2  | 更新 README.md                     |
| 4.3  | 更新 CHANGELOG.md                  |

**总计: ~12 小时**

---

## 九、API 映射表

| 插件工具               | 后端 API                                 | 参数映射                                    |
| ---------------------- | ---------------------------------------- | ------------------------------------------- |
| memory_search          | `POST /api/v1/memories/search`           | query→query, mode='keyword'                 |
| vector_memory_search   | `POST /api/v1/memories/search`           | query→query, mode=mode                      |
| memory_write (异步)    | `POST /api/v1/memories`                  | content,tags,project_id,source_id,tenant_id |
| rebuild_index          | `POST /api/v1/memories`                  | 批量上传                                    |
| memory_relate (create) | `POST /api/v1/memories/relations`        | from_id,to_id,relationship_type,weight      |
| memory_relate (query)  | `POST /api/v1/memories/{id}/relations`   | memory_id,direction                         |
| memory_relate (delete) | `DELETE /api/v1/memories/relations/{id}` | relation_id                                 |
| memory_graph           | `POST /api/v1/memories/{id}/graph`       | memory_id,depth                             |

---

## 十、兼容性说明

- **向后兼容**: 后端不可用时，所有工具仍正常工作
- **配置兼容**: 旧版配置自动升级，新增字段有默认值
- **Bun 兼容**: 无需 better-sqlite3，所有搜索走后端或 BM25
- **版本要求**: 后端服务 >= 2.2.0 (SurrealDB 3.0 + HNSW)
