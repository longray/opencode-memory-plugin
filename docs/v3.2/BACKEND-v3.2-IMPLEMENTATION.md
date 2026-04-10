# 后端 v3.2 实施指南

> **版本**: v3.2.0  
> **日期**: 2026-04-10  
> **状态**: 实施版  
> **目标**: 完成后端服务从 17999 到 18008 的完全替换

---

## 目录

1. [项目结构](#1-项目结构)
2. [依赖升级](#2-依赖升级)
3. [服务架构](#3-服务架构)
4. [实施步骤](#4-实施步骤)
5. [测试验证](#5-测试验证)

---

## 1. 项目结构

```
embedding_service/
├── wrapper/
│   ├── src/
│   │   ├── main.py                    # FastAPI 入口（端口 18008）
│   │   ├── config.py                  # 配置管理
│   │   ├── models.py                  # Pydantic 模型
│   │   ├── routers/
│   │   │   ├── websocket.py           # WebSocket 端点（重写）
│   │   │   ├── code.py                # 预计算路由（新增）
│   │   │   └── ...
│   │   ├── services/                  # 新增目录
│   │   │   ├── precompute.py          # PrecomputeService
│   │   │   ├── performance_monitor.py
│   │   │   └── concurrency_control.py
│   │   ├── utils/
│   │   │   ├── websocket/             # 新增目录
│   │   │   │   ├── reliable_client.py
│   │   │   │   ├── ack_system.py
│   │   │   │   ├── state_recovery.py
│   │   │   │   └── persistent_queue.py
│   │   │   ├── diff/                  # 新增目录
│   │   │   │   ├── subscription.py
│   │   │   │   └── patch_applier.py
│   │   │   ├── meili_client.py        # 重写（SDK 0.40）
│   │   │   └── code_analyzer.py       # 解耦
│   │   └── db/
│   │       └── migrations/            # 新增目录
│   │           ├── v3.2_schema.sql
│   │           └── migrate_v2_to_v3.2.py
│   ├── pyproject.toml                 # 依赖更新
│   └── docker-compose.yml             # 端口更新
└── ...
```

---

## 2. 依赖升级

### pyproject.toml 更新

```toml
[project]
name = "opencode-memory-service"
version = "3.2.0"
description = "OpenCode Memory Service v3.2"
requires-python = ">=3.10"

dependencies = [
    # 现有依赖（保持不变）
    "fastapi>=0.115.0,<0.116.0",
    "uvicorn[standard]>=0.32.0,<0.33.0",
    "pydantic>=2.9.0,<2.10.0",
    "surrealdb>=1.0.0,<2.0.0",
    "transformers>=4.48.0",
    "torch==2.4.0+cu121",

    # 新增依赖
    "meilisearch>=0.40.0,<0.41.0",  # SDK 升级
    "websockets>=12.0",              # WebSocket 增强
    "fast-json-patch>=1.32",         # DIFF 模式
    "portalocker>=2.7",              # 文件锁
    "psutil>=5.9",                   # 性能监控
    "aiofiles>=23.0",                # 异步文件操作
]
```

---

## 3. 服务架构

### 3.1 核心服务

| 服务            | 文件                              | 说明                |
| --------------- | --------------------------------- | ------------------- |
| **WebSocket**   | `utils/websocket/`                | 可靠 WebSocket 连接 |
| **预计算**      | `services/precompute.py`          | 代码分析服务        |
| **Meilisearch** | `utils/meili_client.py`           | 搜索客户端          |
| **性能监控**    | `services/performance_monitor.py` | 指标收集            |

### 3.2 端口配置

```python
# config.py
class Config:
    PORT = 18008  # 从 17999 迁移
    HOST = "0.0.0.0"

    # 向后兼容
    LEGACY_PORT = 17999  # 可选
```

---

## 4. 实施步骤

### Phase 1: 依赖升级（1 天）

1. 更新 `pyproject.toml`
2. 运行 `pip install -e .`
3. 验证依赖安装

### Phase 2: WebSocket 重构（2-3 天）

详见 [BACKEND-v3.2-WEBSOCKET.md](./BACKEND-v3.2-WEBSOCKET.md)

### Phase 3: PrecomputeService（2-3 天）

详见 [BACKEND-v3.2-PRECOMPUTE.md](./BACKEND-v3.2-PRECOMPUTE.md)

### Phase 4: Meilisearch SDK 升级（1 天）

详见 [BACKEND-v3.2-MEILISEARCH.md](./BACKEND-v3.2-MEILISEARCH.md)

### Phase 5: 端口迁移（1 天）

详见 [BACKEND-v3.2-MIGRATION.md](./BACKEND-v3.2-MIGRATION.md)

---

## 5. 测试验证

### 5.1 单元测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定模块
pytest tests/test_websocket.py -v
pytest tests/test_precompute.py -v
```

### 5.2 集成测试

```bash
# 启动服务
uvicorn wrapper.src.main:app --port 18008

# 运行集成测试
pytest tests/integration/ -v
```

### 5.3 端到端测试

```bash
# 完整流程测试
python tests/e2e/test_full_flow.py
```

---

## 参考文档

- [BACKEND-v3.2-WEBSOCKET.md](./BACKEND-v3.2-WEBSOCKET.md)
- [BACKEND-v3.2-PRECOMPUTE.md](./BACKEND-v3.2-PRECOMPUTE.md)
- [BACKEND-v3.2-MIGRATION.md](./BACKEND-v3.2-MIGRATION.md)
- [PLUGIN-v3.2-IMPLEMENTATION.md](./PLUGIN-v3.2-IMPLEMENTATION.md)

---

_文档版本: v3.2.0_  
_最后更新: 2026-04-10_
