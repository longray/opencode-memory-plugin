# API Specification

> Embedding Service REST API 和 WebSocket 协议规范
>
> **版本**: v3.2.0 | **端口**: 18008 | **前缀**: `/api/v1`

---

## 目录

1. [认证](#1-认证)
2. [REST API](#2-rest-api)
3. [WebSocket 协议](#3-websocket-协议)
4. [请求/响应 Schema](#4-请求响应-schema)
5. [错误处理](#5-错误处理)
6. [速率限制](#6-速率限制)

---

## 1. 认证

所有 API 请求需要通过 `WRAPPER_MEILI_API_KEY` Header 认证。

```bash
# REST API 认证
curl -X POST http://localhost:18008/api/v1/memories \
  -H "Content-Type: application/json" \
  -H "WRAPPER_MEILI_API_KEY: your-api-key" \
  -d '{"content": "test", "type": "general"}'

# WebSocket 认证 (Query Param)
ws://localhost:18008/ws?token=your-api-key&tenant_id=default
```

---

## 2. REST API

### 2.1 健康检查

#### `GET /health`

服务健康状态检查。

**响应**:

```json
{
  "status": "healthy",
  "version": "3.2.0",
  "uptime": 3600
}
```

#### `GET /health/db`

数据库连接状态。

**响应**:

```json
{
  "surrealdb": "connected",
  "meilisearch": "connected"
}
```

#### `GET /health/ws`

WebSocket 连接状态。

**响应**:

```json
{
  "connections": 5,
  "uptime": 3600
}
```

---

### 2.2 记忆管理

#### `POST /api/v1/memories`

创建记忆条目。

**请求体**:

```json
{
  "content": "完整记忆内容",
  "abstract": "摘要（≤100字符）",
  "overview": { "key": "value" },
  "type": "long-term",
  "tags": ["typescript", "preference"],
  "project": "my-project",
  "tenant_id": "default"
}
```

**响应** (`201`):

```json
{
  "id": "01KNVJZXW4V14BZYPKX5EB074E",
  "type": "long-term",
  "abstract": "摘要",
  "created_at": "2026-04-10T10:00:00Z"
}
```

#### `GET /api/v1/memories/{id}`

获取记忆条目。

**响应** (`200`):

```json
{
  "id": "01KNVJZXW4V14BZYPKX5EB074E",
  "type": "long-term",
  "abstract": "摘要",
  "overview": { "key": "value" },
  "content": "完整内容",
  "tags": ["typescript"],
  "project": "my-project",
  "created_at": "2026-04-10T10:00:00Z"
}
```

#### `PATCH /api/v1/memories/{id}`

更新记忆条目。

**请求体**:

```json
{
  "content": "更新后的内容",
  "tags": ["typescript", "updated"]
}
```

#### `DELETE /api/v1/memories/{id}`

删除记忆条目。

**响应** (`200`):

```json
{
  "deleted": true,
  "id": "01KNVJZXW4V14BZYPKX5EB074E"
}
```

---

### 2.3 搜索

#### `POST /api/v1/memories/search`

混合搜索（语义 + 关键词）。

**请求体**:

```json
{
  "query": "async error handling patterns",
  "mode": "hybrid",
  "limit": 10,
  "tenant_id": "default",
  "project_id": "my-project",
  "filters": {
    "type": "long-term",
    "tags": ["typescript"]
  }
}
```

**搜索模式**:

| 模式      | 说明                  | 算法                  |
| --------- | --------------------- | --------------------- |
| `hybrid`  | 语义 + 关键词（默认） | 0.7×vector + 0.3×bm25 |
| `vector`  | 纯语义搜索            | HNSW 近似搜索         |
| `keyword` | 纯关键词搜索          | Meilisearch BM25      |

**响应** (`200`):

```json
{
  "results": [
    {
      "id": "01KNVJZXW4V14BZYPKX5EB074E",
      "abstract": "异步错误处理最佳实践",
      "overview": { "language": "typescript" },
      "content": "完整内容...",
      "type": "long-term",
      "tags": ["typescript", "async"],
      "score": 0.95
    }
  ],
  "total": 1,
  "processing_time_ms": 45
}
```

#### `GET /api/v1/memories/suggest`

搜索建议（自动补全）。

**查询参数**:

| 参数     | 类型   | 默认值 | 说明     |
| -------- | ------ | ------ | -------- |
| `prefix` | string | -      | 搜索前缀 |
| `limit`  | int    | 10     | 返回数量 |

**响应** (`200`):

```json
{
  "suggestions": [
    "async error handling",
    "async await pattern",
    "async generator"
  ]
}
```

---

### 2.4 图关系

#### `POST /api/v1/memories/relations`

创建图关系。

**请求体**:

```json
{
  "from_id": "01KNVJZXW4V14BZYPKX5EB074E",
  "to_id": "01KNTTS65V84MNMJ5NE44SQCDS",
  "type": "relates_to",
  "weight": 0.8,
  "tenant_id": "default"
}
```

**关系类型**:

| 类型         | 说明     |
| ------------ | -------- |
| `relates_to` | 通用关联 |
| `depends_on` | 依赖关系 |
| `blocks`     | 阻塞关系 |
| `part_of`    | 组成关系 |
| `summarizes` | 总结关系 |

#### `GET /api/v1/memories/{id}/graph`

遍历关系图。

**查询参数**:

| 参数    | 类型 | 默认值 | 说明     |
| ------- | ---- | ------ | -------- |
| `depth` | int  | 2      | 遍历深度 |
| `limit` | int  | 20     | 最大数量 |

**响应** (`200`):

```json
{
  "source": {
    "id": "01KNVJZXW4V14BZYPKX5EB074E",
    "abstract": "源节点摘要"
  },
  "nodes": [
    { "id": "...", "abstract": "...", "depth": 1 },
    { "id": "...", "abstract": "...", "depth": 2 }
  ],
  "edges": [
    { "from": "...", "to": "...", "type": "relates_to", "weight": 0.8 }
  ],
  "total_nodes": 5,
  "total_edges": 4
}
```

#### `DELETE /api/v1/memories/relations/{id}`

删除关系。

---

### 2.5 同步

#### `POST /api/v1/memories`

批量上传记忆（用于 rebuild_index）。

**请求体**:

```json
{
  "memories": [
    { "id": "...", "content": "...", "type": "long-term" },
    { "id": "...", "content": "...", "type": "preference" }
  ],
  "tenant_id": "default"
}
```

#### `POST /api/v1/sync/incremental`

增量同步（基于指纹）。

**请求体**:

```json
{
  "entries": [
    {
      "id": "01KNVJ...",
      "fingerprint": "abc123",
      "content": "内容"
    }
  ]
}
```

#### `GET /api/v1/sync/checkpoint`

查看同步检查点。

---

### 2.6 代码分析

#### `POST /api/v1/code/analyze`

分析代码文件。

**请求体**:

```json
{
  "file_path": "src/utils.ts",
  "content": "export function hello() { return 'world'; }",
  "language": "typescript",
  "project_id": "my-project",
  "tenant_id": "default"
}
```

**响应** (`200`):

```json
{
  "entity_id": "entity:01ABC...",
  "atoms_count": 1,
  "symbols": [
    {
      "type": "function",
      "name": "hello",
      "start_line": 1,
      "end_line": 1,
      "complexity": 1
    }
  ],
  "relations_created": 0,
  "duration_ms": 45
}
```

#### `POST /api/v1/code/analyze/batch`

批量分析代码文件。

**请求体**:

```json
{
  "files": [
    { "file_path": "src/a.ts", "content": "...", "language": "typescript" },
    { "file_path": "src/b.py", "content": "...", "language": "python" }
  ],
  "project_id": "my-project",
  "tenant_id": "default"
}
```

---

## 3. WebSocket 协议

### 3.1 连接

```javascript
const ws = new WebSocket(
  "ws://localhost:18008/ws?token=your-api-key&tenant_id=default",
);
```

### 3.2 消息格式

所有消息为 JSON 格式：

```json
{
  "type": "message_type",
  "id": "unique-message-id",
  "data": {},
  "timestamp": "2026-04-10T10:00:00Z"
}
```

### 3.3 心跳协议

```json
// Client → Server (ping)
{"type": "ping", "timestamp": 1712721600000}

// Server → Client (pong)
{"type": "pong", "timestamp": 1712721600000}
```

**规则**: 30s 间隔，2 次未响应触发重连。

### 3.4 ACK 协议

```json
// Server → Client (需要确认)
{
  "type": "data",
  "id": "msg-001",
  "_requiresAck": true,
  "data": {"action": "entity_created", "entity_id": "..."}
}

// Client → Server (确认)
{"type": "ack", "_ackId": "msg-001"}
```

**规则**: 5s 超时，3 次重试。

### 3.5 DIFF 协议

```json
// Client → Server (订阅 DIFF)
{
  "action": "subscribe",
  "query": "LIVE SELECT DIFF FROM entity WHERE tenant_id = 'default'"
}

// Server → Client (差异更新)
{
  "type": "diff",
  "entity_id": "entity:01ABC...",
  "patches": [
    {"op": "replace", "path": "/status", "value": "done"}
  ]
}
```

### 3.6 状态恢复

```json
// Client → Server (重连后同步)
{
  "action": "sync",
  "sessionId": "sess-1712721600-abc123",
  "lastOffset": "12345"
}

// Server → Client (丢失消息)
{
  "type": "sync_result",
  "messages": [...],
  "current_offset": "12350"
}
```

---

## 4. 请求/响应 Schema

### 4.1 通用响应格式

**成功**:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "processing_time_ms": 45,
    "request_id": "req-abc123"
  }
}
```

**错误**:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Content is required",
    "details": {}
  },
  "meta": {
    "request_id": "req-abc123"
  }
}
```

### 4.2 分页参数

| 参数    | 类型   | 默认值 | 说明        |
| ------- | ------ | ------ | ----------- |
| `page`  | int    | 1      | 页码        |
| `limit` | int    | 20     | 每页数量    |
| `sort`  | string | -      | 排序字段    |
| `order` | string | desc   | asc 或 desc |

### 4.3 Pydantic 模型

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class MemoryCreate(BaseModel):
    """创建记忆请求"""
    content: str
    abstract: str = Field(max_length=100)
    overview: Dict[str, Any] = {}
    type: str = "general"
    tags: List[str] = []
    project: Optional[str] = None
    tenant_id: str = "default"

class SearchRequest(BaseModel):
    """搜索请求"""
    query: str
    mode: str = "hybrid"  # hybrid | vector | keyword
    limit: int = Field(default=10, le=100)
    tenant_id: str = "default"
    project_id: Optional[str] = None
    filters: Dict[str, Any] = {}

class RelationCreate(BaseModel):
    """创建关系请求"""
    from_id: str
    to_id: str
    type: str = "relates_to"
    weight: float = Field(default=0.5, ge=0.0, le=1.0)
    tenant_id: str = "default"
```

---

## 5. 错误处理

### 5.1 HTTP 状态码

| 状态码 | 说明         | 场景                   |
| ------ | ------------ | ---------------------- |
| `200`  | 成功         | GET、PATCH、DELETE     |
| `201`  | 创建成功     | POST                   |
| `400`  | 请求参数错误 | 缺少必需字段、类型错误 |
| `401`  | 认证失败     | API Key 缺失或错误     |
| `403`  | 权限不足     | 租户隔离               |
| `404`  | 资源不存在   | ID 无效                |
| `408`  | 请求超时     | Embedding API 超时     |
| `429`  | 速率限制     | 超过请求频率           |
| `500`  | 内部错误     | 未预期的异常           |
| `503`  | 服务不可用   | 数据库连接失败         |

### 5.2 错误码

| 错误码             | 说明               |
| ------------------ | ------------------ |
| `VALIDATION_ERROR` | 请求参数验证失败   |
| `AUTH_FAILED`      | 认证失败           |
| `NOT_FOUND`        | 资源不存在         |
| `RATE_LIMITED`     | 速率限制           |
| `DB_ERROR`         | 数据库操作失败     |
| `EMBEDDING_ERROR`  | Embedding 生成失败 |
| `SEARCH_ERROR`     | 搜索操作失败       |
| `TIMEOUT`          | 操作超时           |
| `INTERNAL_ERROR`   | 内部错误           |

### 5.3 重试策略

| 错误码            | 重试 | 策略                |
| ----------------- | ---- | ------------------- |
| `TIMEOUT`         | 是   | 指数退避，最多 3 次 |
| `DB_ERROR`        | 是   | 指数退避，最多 3 次 |
| `EMBEDDING_ERROR` | 是   | 指数退避，最多 3 次 |
| `429`             | 是   | 根据 Retry-After    |
| `401`/`403`       | 否   | -                   |
| `400`             | 否   | -                   |

---

## 6. 速率限制

### 6.1 限制规则

| 端点类型        | 限制      | 窗口     |
| --------------- | --------- | -------- |
| REST API (读取) | 100 次/分 | 滑动窗口 |
| REST API (写入) | 30 次/分  | 滑动窗口 |
| WebSocket 连接  | 10 次/分  | 滑动窗口 |
| 搜索请求        | 60 次/分  | 滑动窗口 |
| 代码分析        | 20 次/分  | 滑动窗口 |

### 6.2 速率限制响应

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2026-04-10T10:01:00Z"
    }
  }
}
```

**响应头**:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1712721660
```

---

## 参考文档

- [API 契约](../../docs/API-CONTRACT.md) — 工具↔后端映射
- [统一架构](../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md) — 架构设计
- [WebSocket 设计](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md) — WebSocket 详细设计

---

_文档版本: v3.2.0 | 最后更新: 2026-04-10_
