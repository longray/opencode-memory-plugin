# Embedding Service

> **OpenCode Memory Plugin** 的 Python 后端服务 — 向量搜索、代码分析与实时同步

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![SurrealDB](https://img.shields.io/badge/SurrealDB-3.0%2B-red.svg)](https://surrealdb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 项目简介

Embedding Service 是 OpenCode Memory Plugin 的后端服务，为 OpenCode 编码助手提供持久化记忆能力。它负责向量搜索、代码 AST 分析、实时 WebSocket 同步以及图关系管理。

**核心能力**:

- **向量搜索** — 基于 Meilisearch 的混合搜索（语义 + 关键词）
- **代码分析** — 基于 tree-sitter 的多语言 AST 解析和符号提取
- **实时同步** — WebSocket 可靠连接，支持心跳、重连、ACK、DIFF 模式
- **图关系** — 基于 SurrealDB 原生图关系的代码调用链追踪
- **预计算** — 文件保存时自动触发分析，查询时快速响应

---

## 架构概览

```
┌───────────────────────────────────────────────────────────┐
│                     Plugin (Node.js)                      │
│  memory_write │ memory_search │ memory_graph │ ws-client  │
└──────────────────────────┬────────────────────────────────┘
                           │ HTTP / WebSocket
                           ▼
┌───────────────────────────────────────────────────────────┐
│                  Embedding Service (Python)                │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │   REST API   │  │  WebSocket  │  │ Precompute Svc   │  │
│  │  (FastAPI)   │  │  (可靠连接)  │  │ (tree-sitter)    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘  │
│         │                │                   │            │
│         ▼                ▼                   ▼            │
│  ┌──────────────────────────────────────────────────┐    │
│  │                  Storage Layer                    │    │
│  │  ┌──────────────┐    ┌──────────────────────┐    │    │
│  │  │   SurrealDB   │    │     Meilisearch      │    │    │
│  │  │  (图+向量)     │    │    (全文+过滤)        │    │    │
│  │  └──────────────┘    └──────────────────────┘    │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │ ModelScope   │
                   │ Embedding    │
                   │ (外部 API)   │
                   └──────────────┘
```

**端口**: `18008` (v3.2 从 17999 迁移)

---

## 当前状态

| 版本 | 状态   | 说明                                                    |
| ---- | ------ | ------------------------------------------------------- |
| v3.2 | 开发中 | WebSocket 重写、PrecomputeService、Meilisearch SDK 升级 |
| v3.0 | 已发布 | 代码分析、项目健康度、JSDoc 提取                        |
| v2.x | 已发布 | 向量搜索、同步、图关系                                  |

**v3.2 核心变更**:

- WebSocket 重写 — 心跳、指数退避重连、ACK 确认、DIFF 模式
- PrecomputeService — 服务化代码分析，批处理 + 增量更新
- Meilisearch SDK 0.40 — 从 httpx 直接调用迁移到类型化 SDK
- SurrealDB Schema v3.2 — tenant_id 预留字段、ChangeFeed 7d
- 端口迁移 17999 → 18008

---

## 技术栈

| 组件       | 技术                       | 版本         |
| ---------- | -------------------------- | ------------ |
| Web 框架   | FastAPI + Uvicorn          | 0.115.x      |
| 数据库     | SurrealDB                  | 3.0+         |
| 全文搜索   | Meilisearch Python SDK     | 0.40.x       |
| AST 解析   | tree-sitter (Python)       | 0.25.x       |
| Embedding  | ModelScope Qwen3-Embedding | 0.6B         |
| 异步运行时 | asyncio                    | Python 3.10+ |
| 容器化     | Docker + docker-compose    | 24+          |
| 包管理     | uv / pip + pyproject.toml  | -            |

---

## 快速开始

### Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin/embedding_service

# 配置环境变量
cp .env.example .env
# 编辑 .env 设置 API 密钥

# 启动所有服务
docker-compose up -d

# 验证服务状态
curl http://localhost:18008/health
```

### 本地 Python 开发

```bash
# 安装依赖
cd embedding_service/wrapper
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -e ".[dev]"

# 启动依赖服务
docker-compose up -d surrealdb meilisearch

# 启动 FastAPI 服务
uvicorn src.main:app --host 0.0.0.0 --port 18008 --reload
```

> 详细配置见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) 和 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## Roadmap

### v3.2 — 当前开发

| 模块              | 状态   | 预计工时 | 详见                               |
| ----------------- | ------ | -------- | ---------------------------------- |
| 依赖升级          | 待实施 | 1 天     | Phase 1: pyproject.toml 更新       |
| WebSocket 重写    | 待实施 | 2-3 天   | Phase 2: 可靠连接、心跳、重连、ACK |
| PrecomputeService | 待实施 | 2-3 天   | Phase 3: 服务化代码分析            |
| Meilisearch 0.40  | 待实施 | 1 天     | Phase 4: SDK 升级                  |
| 端口迁移          | 待实施 | 1 天     | Phase 5: 17999 → 18008             |

### 未来计划

| 版本 | 功能                | 说明                     |
| ---- | ------------------- | ------------------------ |
| v3.3 | 多租户物理隔离      | SurrealDB SDK 2.0 stable |
| v3.4 | Kubernetes 生产部署 | HPA、PVC、Ingress        |
| v4.0 | 分布式架构          | 集群、分片、读写分离     |

---

## 项目结构

```
embedding_service/
├── wrapper/
│   ├── src/
│   │   ├── main.py                    # FastAPI 入口（端口 18008）
│   │   ├── config.py                  # 配置管理
│   │   ├── models.py                  # Pydantic 模型
│   │   ├── routers/
│   │   │   ├── websocket.py           # WebSocket 端点
│   │   │   ├── code.py                # 预计算路由
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── precompute.py          # PrecomputeService
│   │   │   ├── performance_monitor.py # 性能监控
│   │   │   └── concurrency_control.py # 并发控制
│   │   ├── utils/
│   │   │   ├── websocket/             # WebSocket 工具
│   │   │   │   ├── reliable_client.py # 可靠连接
│   │   │   │   ├── ack_system.py      # ACK 系统
│   │   │   │   ├── state_recovery.py  # 状态恢复
│   │   │   │   └── persistent_queue.py # 持久化队列
│   │   │   ├── diff/                  # DIFF 工具
│   │   │   ├── meili_client.py        # Meilisearch 客户端
│   │   │   └── code_analyzer.py       # 代码分析器
│   │   └── db/
│   │       └── migrations/            # 数据库迁移
│   ├── tests/                         # 测试文件
│   ├── pyproject.toml                 # Python 依赖
│   └── Dockerfile                     # 容器配置
├── docs/                              # 开发文档
│   ├── ARCHITECTURE.md                # 系统架构
│   ├── API-SPEC.md                    # API 规范
│   ├── DEVELOPMENT.md                 # 开发指南
│   ├── DEPLOYMENT.md                  # 部署指南
│   └── V3.2-IMPLEMENTATION.md        # v3.2 实施计划
├── inbox/                             # 收件箱（临时）
├── BACKLOG.md                         # 后端任务列表
├── README.md                          # 本文件
└── docker-compose.yml                 # 服务编排
```

---

## 环境变量

| 变量                  | 必需 | 默认值  | 说明                 |
| --------------------- | ---- | ------- | -------------------- |
| `MODELSCOPE_API_KEY`  | 是   | -       | ModelScope Embedding |
| `MEILISEARCH_API_KEY` | 是   | -       | Meilisearch 认证     |
| `PORT`                | 否   | 18008   | 服务端口             |
| `HOST`                | 否   | 0.0.0.0 | 绑定地址             |
| `WORKERS`             | 否   | 4       | Uvicorn 工作进程     |
| `LOG_LEVEL`           | 否   | INFO    | 日志级别             |

---

## 开发文档

| 文档                                                    | 说明               |
| ------------------------------------------------------- | ------------------ |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)               | 系统架构设计       |
| [API-SPEC.md](./docs/API-SPEC.md)                       | API 接口规范       |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md)                 | 开发环境搭建与指南 |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md)                   | 部署指南           |
| [V3.2-IMPLEMENTATION.md](./docs/V3.2-IMPLEMENTATION.md) | v3.2 实施计划      |
| [BACKLOG.md](./BACKLOG.md)                              | 后端任务列表       |

### 上游设计文档

| 文档                                                                             | 说明                 |
| -------------------------------------------------------------------------------- | -------------------- |
| [BACKEND-v3.2-IMPLEMENTATION.md](../../docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md) | 后端 v3.2 实施指南   |
| [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)           | WebSocket 详细设计   |
| [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)         | 预计算服务设计       |
| [BACKEND-v3.2-MEILISEARCH.md](../../docs/v3.2/BACKEND-v3.2-MEILISEARCH.md)       | Meilisearch 升级指南 |
| [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)               | 数据库 Schema        |
| [UNIFIED-ARCHITECTURE-v3.2.md](../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md)     | 统一架构设计         |

---

## 许可证

[MIT License](../../LICENSE)

---

_Embedding Service v3.2 | OpenCode Memory Plugin_
