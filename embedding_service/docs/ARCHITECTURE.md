# System Architecture

> Embedding Service 后端系统架构设计
>
> **版本**: v3.2.0 | **最后更新**: 2026-04-10

---

## 目录

1. [架构概览](#1-架构概览)
2. [服务架构](#2-服务架构)
3. [数据流](#3-数据流)
4. [组件图](#4-组件图)
5. [数据库 Schema](#5-数据库-schema)
6. [服务边界](#6-服务边界)

---

## 1. 架构概览

Embedding Service 采用四层架构，遵循 Agent-Native 设计原则（无 GUI、无 IDE 集成，所有交互通过 FastAPI 进行）。

```
┌──────────────────────────────────────────────────────────────┐
│                     表示层 (Presentation)                     │
│                                                              │
│  Plugin (Node.js)  ←── HTTP/WebSocket ──→  FastAPI (Python)  │
│                                                              │
│  交互方式：REST API + WebSocket                               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     服务层 (Service Layer)                    │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐   │
│  │  REST API    │  │  WebSocket  │  │  Precompute Svc    │   │
│  │  /api/v1/*   │  │  /ws         │  │  (tree-sitter)     │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬───────────┘   │
│         │                │                   │               │
│         ▼                ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Business Logic                       │    │
│  │  • Search (Meilisearch + Vector)                     │    │
│  │  • Graph (SurrealDB RELATE)                          │    │
│  │  • Embedding (ModelScope API)                        │    │
│  │  • Performance Monitor                               │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     存储层 (Storage Layer)                    │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │    SurrealDB      │    │       Meilisearch             │   │
│  │   (Port 8000)     │    │       (Port 7700)             │   │
│  │                    │    │                                │   │
│  │ • atom 表          │    │ • memories 索引               │   │
│  │ • entity 表        │    │ • 全文搜索                    │   │
│  │ • reference 表     │    │ • 过滤/排序                   │   │
│  │ • 图关系 (RELATE)  │    │ • BM25 排序                   │   │
│  │ • ChangeFeed 7d    │    │                                │   │
│  └──────────────────┘    └──────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  ModelScope  │
                    │  Embedding   │
                    │  (外部 API)  │
                    └──────────────┘
```

---

## 2. 服务架构

### 2.1 FastAPI 主服务

主服务基于 FastAPI 构建，运行在 Uvicorn ASGI 服务器上。

```python
# src/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # Startup
    await init_database()
    await init_meilisearch()
    precompute_service.start()
    yield
    # Shutdown
    precompute_service.stop()
    await close_database()

app = FastAPI(
    title="OpenCode Memory Service",
    version="3.2.0",
    lifespan=lifespan,
    port=18008
)
```

### 2.2 核心服务组件

| 服务           | 模块路径                          | 职责                       |
| -------------- | --------------------------------- | -------------------------- |
| **REST API**   | `routers/*.py`                    | CRUD 操作、搜索、同步      |
| **WebSocket**  | `routers/websocket.py`            | 实时推送、心跳、ACK        |
| **Precompute** | `services/precompute.py`          | 代码分析、符号提取、批处理 |
| **Search**     | `utils/meili_client.py`           | Meilisearch 混合搜索       |
| **Embedding**  | `utils/embedding_client.py`       | ModelScope 向量生成        |
| **Graph**      | `utils/graph_client.py`           | SurrealDB 图关系操作       |
| **Monitor**    | `services/performance_monitor.py` | 性能指标收集               |

### 2.3 服务配置

```python
# src/config.py
class Config:
    # 服务
    PORT: int = 18008
    HOST: str = "0.0.0.0"
    WORKERS: int = 4

    # SurrealDB
    SURREALDB_URL: str = "ws://localhost:8000"
    SURREALDB_NS: str = "opencode"
    SURREALDB_DB: str = "memory"

    # Meilisearch
    MEILISEARCH_URL: str = "http://localhost:7700"

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30  # 秒
    WS_MAX_RETRIES: int = 10
    WS_ACK_TIMEOUT: float = 5.0  # 秒

    # Precompute
    PRECOMPUTE_BATCH_SIZE: int = 100
    PRECOMPUTE_MAX_CONCURRENT: int = 5
```

---

## 3. 数据流

### 3.1 记忆写入流程

```
Plugin (memory_write)
  │
  ├─1.→ 本地文件写入 (timeline/YYYY/MM/DD/)
  │
  └─2.→ HTTP POST /api/v1/memories
         │
         ├─3.→ SurrealDB CREATE entity
         │
         ├─4.→ ModelScope Embedding API
         │     └─→ 生成 1024 维向量
         │
         ├─5.→ Meilisearch add_documents
         │     └─→ 索引更新
         │
         └─6.→ WebSocket 推送 (CHANGEFEED)
               └─→ 通知所有订阅客户端
```

### 3.2 搜索流程

```
Plugin (memory_search)
  │
  └─1.→ HTTP POST /api/v1/memories/search
         │
         ├─ mode=hybrid:
         │   ├─2a.→ Meilisearch search (BM25)
         │   ├─2b.→ SurrealDB HNSW search (vector)
         │   └─2c.→ 合并排序: 0.7×vector + 0.3×bm25
         │
         ├─ mode=vector:
         │   └─2.→ SurrealDB HNSW search
         │
         └─ mode=keyword:
             └─2.→ Meilisearch BM25 search
```

### 3.3 代码分析流程

```
Plugin (文件保存)
  │
  └─1.→ HTTP POST /api/v1/code/analyze
         │
         ├─2.→ SHA256 指纹计算
         │     └─→ 与上次指纹比较
         │           ├─ 相同 → 跳过
         │           └─ 不同 → 继续
         │
         ├─3.→ tree-sitter AST 解析
         │     └─→ 6 语言支持
         │
         ├─4.→ 符号提取 (functions, classes, interfaces)
         │
         ├─5.→ 批量创建 Atoms (SurrealDB batch insert)
         │
         ├─6.→ 创建 Entity (file-level)
         │
         ├─7.→ 创建 References (RELATE calls/imports)
         │
         └─8.→ 性能指标记录
```

### 3.4 WebSocket 实时同步流程

```
Plugin (ws-client)
  │
  ├─1.→ WebSocket connect ws://localhost:18008/ws?token=xxx
  │
  ├─2.→ 心跳维持
  │     Server ──ping──→ Client (30s)
  │     Client ──pong──→ Server
  │
  ├─3.→ 消息推送
  │     Server ──data──→ Client
  │     Client ──ack───→ Server (5s 超时)
  │
  ├─4.→ DIFF 模式
  │     Server ──LIVE SELECT DIFF──→ Client
  │     Client ──JSON Patch apply──→ 本地缓存
  │
  └─5.→ 状态恢复
        Client ──sync(lastOffset)──→ Server
        Server ──missed messages──→ Client
```

---

## 4. 组件图

### 4.1 模块依赖关系

```
┌────────────────────────────────────────────────────────────┐
│                         main.py                            │
│                    (FastAPI Application)                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐     │
│  │ routers/ │  │ routers/ │  │    routers/           │     │
│  │ memory.py│  │  ws.py   │  │    code.py            │     │
│  └────┬─────┘  └────┬─────┘  └─────────┬────────────┘     │
│       │              │                  │                   │
│       ▼              ▼                  ▼                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │                   services/                         │    │
│  │                                                     │    │
│  │  ┌──────────────┐  ┌──────────────────────────┐   │    │
│  │  │ precompute   │  │ performance_monitor      │   │    │
│  │  │ _service.py  │  │ .py                      │   │    │
│  │  └──────┬───────┘  └──────────────────────────┘   │    │
│  │         │                                         │    │
│  └─────────┼─────────────────────────────────────────┘    │
│            │                                               │
│            ▼                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │                    utils/                           │    │
│  │                                                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │    │
│  │  │ meili    │  │ graph    │  │ websocket/   │    │    │
│  │  │ _client  │  │ _client  │  │  reliable    │    │    │
│  │  │ .py      │  │ .py      │  │  _client.py  │    │    │
│  │  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │    │
│  └───────┼─────────────┼───────────────┼────────────┘    │
│          │             │               │                  │
└──────────┼─────────────┼───────────────┼──────────────────┘
           │             │               │
           ▼             ▼               ▼
    ┌──────────┐  ┌──────────┐   ┌──────────────┐
    │Meilisearch│  │SurrealDB │   │ websockets   │
    │  (HTTP)  │  │  (WS)    │   │  (library)   │
    └──────────┘  └──────────┘   └──────────────┘
```

### 4.2 WebSocket 可靠连接组件

```
┌────────────────────────────────────────────────────────────┐
│                 WebSocket Reliable Layer                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────┐    │
│  │ ReliableWebSocket   │  │ AcknowledgementSystem    │    │
│  │ Client               │  │                          │    │
│  │ • connect()         │  │ • send_with_ack()       │    │
│  │ • send()            │  │ • handle_ack()          │    │
│  │ • heartbeat_loop()  │  │ • timeout retry (3x)    │    │
│  │ • reconnect()       │  │                          │    │
│  └─────────────────────┘  └──────────────────────────┘    │
│                                                             │
│  ┌─────────────────────┐  ┌──────────────────────────┐    │
│  │ ConnectionState     │  │ PersistentMessageQueue   │    │
│  │ Recovery             │  │                          │    │
│  │ • session_id        │  │ • push() / pop()        │    │
│  │ • last_offset       │  │ • 7d auto-expire        │    │
│  │ • sync_missed()     │  │ • file lock (portalocker)│    │
│  └─────────────────────┘  └──────────────────────────┘    │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ DiffSubscription                                       │  │
│  │ • subscribe(entity_id)                                │  │
│  │ • apply_diff(patches)                                 │  │
│  │ • LIVE SELECT DIFF                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 5. 数据库 Schema

### 5.1 核心表

| 表名        | 类型     | 说明                              | ChangeFeed |
| ----------- | -------- | --------------------------------- | ---------- |
| `atom`      | NORMAL   | 原子级数据（函数、类、任务等）    | 7d         |
| `entity`    | NORMAL   | 实体级数据（记忆、代码、Backlog） | 7d         |
| `reference` | RELATION | 图关系（调用、依赖、关联）        | 7d         |

### 5.2 辅助表

| 表名       | 说明       |
| ---------- | ---------- |
| `timeline` | 时间线索引 |
| `stats`    | 统计信息   |
| `project`  | 项目元数据 |
| `config`   | 系统配置   |

### 5.3 ER 关系

```
atom ──calls──→ atom        (函数调用)
atom ──imports──→ atom       (模块导入)
atom ──part_of──→ entity     (组成关系)
entity ──wiki_link──→ entity  (Wiki 链接)
entity ──relates_to──→ entity (关联)
entity ──implements──→ entity (实现关系)
```

### 5.4 索引策略

```sql
-- 复合索引（含 tenant_id 预留）
DEFINE INDEX idx_atom_tenant_type ON atom FIELDS tenant_id, type;
DEFINE INDEX idx_entity_tenant_type ON entity FIELDS tenant_id, type;
DEFINE INDEX idx_unique_ref ON reference FIELDS in, out, type UNIQUE;

-- 性能索引
DEFINE INDEX idx_atom_name ON atom FIELDS name;
DEFINE INDEX idx_entity_status ON entity FIELDS status;
DEFINE INDEX idx_timeline_date ON timeline FIELDS year, month, day;
```

> 详细 Schema 定义见 [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)

---

## 6. 服务边界

### 6.1 职责划分

| 边界          | Embedding Service (后端) | Plugin (前端)              |
| ------------- | ------------------------ | -------------------------- |
| **数据存储**  | SurrealDB + Meilisearch  | 本地 timeline 文件         |
| **向量搜索**  | 混合搜索 (vector + BM25) | 关键词搜索 (BM25 fallback) |
| **代码分析**  | tree-sitter AST + 预计算 | 文件监听 + 变更检测        |
| **实时同步**  | WebSocket Server         | WebSocket Client           |
| **图关系**    | SurrealDB RELATE         | 本地 link-map              |
| **Embedding** | ModelScope API 调用      | 不涉及                     |

### 6.2 通信协议

| 协议         | 端口  | 用途                 | 认证              |
| ------------ | ----- | -------------------- | ----------------- |
| HTTP REST    | 18008 | CRUD + 搜索          | API Key Header    |
| WebSocket    | 18008 | 实时推送 + DIFF 同步 | Token Query Param |
| SurrealDB WS | 8000  | 数据库连接           | 用户名/密码       |
| Meilisearch  | 7700  | 搜索索引             | Master Key        |

### 6.3 错误处理策略

| 场景               | 后端行为                  | 前端行为       |
| ------------------ | ------------------------- | -------------- |
| 数据库不可用       | 返回 503 + 健康检查标记   | 降级到本地搜索 |
| WebSocket 断开     | 保持队列，等待重连        | 指数退避重连   |
| Meilisearch 不可用 | 降级到 SurrealDB 全文搜索 | 降级到 BM25    |
| Embedding API 轮限 | 排队 + 重试               | 等待重试       |
| 请求超时           | 返回 408                  | 降级到本地     |

---

## 参考文档

- [统一架构设计](../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md) — 完整架构设计
- [后端实施指南](../../docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md) — 实施计划
- [数据库 Schema](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md) — Schema 定义
- [WebSocket 设计](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md) — WebSocket 详细设计
- [预计算服务](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md) — Precompute 设计

---

_文档版本: v3.2.0 | 最后更新: 2026-04-10_
