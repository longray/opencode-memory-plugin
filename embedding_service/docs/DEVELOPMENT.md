# Development Guide

> Embedding Service 后端开发指南
>
> **版本**: v3.2.0 | **最后更新**: 2026-04-10

---

## 目录

1. [环境搭建](#1-环境搭建)
2. [依赖管理](#2-依赖管理)
3. [开发工作流](#3-开发工作流)
4. [测试](#4-测试)
5. [Docker 开发](#5-docker-开发)
6. [调试](#6-调试)

---

## 1. 环境搭建

### 1.1 前置要求

| 工具           | 版本  | 说明       |
| -------------- | ----- | ---------- |
| Python         | 3.10+ | 主开发语言 |
| uv             | 最新  | 包管理器   |
| Docker         | 24+   | 容器化     |
| Docker Compose | 2.20+ | 多服务编排 |
| Git            | 2.40+ | 版本控制   |

### 1.2 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin/embedding_service

# 2. 使用 uv 创建虚拟环境
uv venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 3. 安装依赖（含开发依赖）
cd wrapper
uv pip install -e ".[dev]"

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 MODELSCOPE_API_KEY 和 MEILISEARCH_API_KEY

# 5. 启动依赖服务
docker-compose up -d surrealdb meilisearch

# 6. 运行数据库迁移
uv run python src/db/migrations/migrate_v2_to_v3.2.py

# 7. 启动开发服务
uv run uvicorn src.main:app --host 0.0.0.0 --port 18008 --reload
```

### 1.3 验证安装

```bash
# 检查服务健康
curl http://localhost:18008/health

# 预期输出
# {"status":"healthy","version":"3.2.0"}

# 检查 API 文档
# 浏览器打开 http://localhost:18008/docs
```

---

## 2. 依赖管理

### 2.1 核心依赖

```toml
# pyproject.toml
[project]
name = "opencode-memory-service"
version = "3.2.0"
requires-python = ">=3.10"

dependencies = [
    # Web 框架
    "fastapi>=0.115.0,<0.116.0",
    "uvicorn[standard]>=0.32.0,<0.33.0",
    "pydantic>=2.9.0,<2.10.0",

    # 数据库
    "surrealdb>=1.0.8,<1.1.0",
    "meilisearch>=0.40.0,<0.41.0",

    # WebSocket
    "websockets>=12.0,<13.0",

    # AST 解析
    "tree-sitter>=0.25.0,<0.26.0",
    "tree-sitter-python>=0.25.0,<0.26.0",
    "tree-sitter-javascript>=0.25.0,<0.26.0",
    "tree-sitter-typescript>=0.23.0,<0.24.0",
    "tree-sitter-go>=0.25.0,<0.26.0",
    "tree-sitter-rust>=0.24.0,<0.25.0",
    "tree-sitter-java>=0.23.0,<0.24.0",

    # 工具
    "fast-json-patch>=1.32",
    "portalocker>=2.7",
    "psutil>=5.9",
    "aiofiles>=23.0",
]
```

### 2.2 开发依赖

```toml
[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pytest-cov>=4.1",
    "httpx>=0.27",       # FastAPI TestClient
    "mypy>=1.8",
    "ruff>=0.4",
    "black>=24.0",
]
```

### 2.3 常用命令

```bash
# 安装生产依赖
uv pip install -e .

# 安装开发依赖
uv pip install -e ".[dev]"

# 检查已安装包
uv pip list | grep -E "surrealdb|meilisearch|tree-sitter|fastapi"

# 导出依赖锁定
uv pip freeze > requirements.lock
```

---

## 3. 开发工作流

### 3.1 项目结构

```
wrapper/
├── src/
│   ├── main.py                    # FastAPI 入口
│   ├── config.py                  # 配置管理
│   ├── models.py                  # Pydantic 模型
│   ├── routers/
│   │   ├── memory.py              # 记忆 CRUD
│   │   ├── search.py              # 搜索 API
│   │   ├── graph.py               # 图关系
│   │   ├── code.py                # 代码分析
│   │   ├── websocket.py           # WebSocket
│   │   └── sync.py                # 同步 API
│   ├── services/
│   │   ├── precompute.py          # 预计算服务
│   │   ├── performance_monitor.py # 性能监控
│   │   └── concurrency_control.py # 并发控制
│   ├── utils/
│   │   ├── websocket/             # WebSocket 工具
│   │   ├── meili_client.py        # Meilisearch 客户端
│   │   ├── embedding_client.py    # Embedding 客户端
│   │   └── code_analyzer.py       # 代码分析器
│   └── db/
│       ├── connection.py          # 数据库连接
│       └── migrations/            # 迁移脚本
├── tests/
│   ├── unit/                      # 单元测试
│   ├── integration/               # 集成测试
│   └── conftest.py                # 测试配置
├── pyproject.toml
└── Dockerfile
```

### 3.2 代码风格

```python
# ✅ 正确：类型注解 + 文档字符串
from typing import Optional, List
from pydantic import BaseModel


class AtomCreate(BaseModel):
    """创建 Atom 的请求模型。

    Attributes:
        type: Atom 类型
        content: 内容文本
        tenant_id: 租户 ID
    """

    type: str
    content: str
    tenant_id: str = "default"


# ✅ 正确：异步函数 + 错误处理
async def create_atom(db: AsyncSurreal, request: AtomCreate) -> dict:
    """创建 Atom 记录。

    Args:
        db: SurrealDB 异步连接
        request: 创建请求

    Returns:
        创建的 Atom 字典

    Raises:
        ValueError: 当类型无效时
    """
    valid_types = ["function", "class", "task", "note"]
    if request.type not in valid_types:
        raise ValueError(f"Invalid type: {request.type}")

    result = await db.create("atom", request.model_dump())
    return result[0]
```

### 3.3 导入规范

```python
# 标准库
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime

# 第三方库
from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel, Field
from surrealdb import Surreal

# 本地模块
from src.config import settings
from src.models import Atom, Entity
from src.utils.logger import logger
```

### 3.4 代码检查

```bash
# 格式化
uv run black src/ tests/

# Lint
uv run ruff check src/ tests/

# 类型检查
uv run mypy src/

# 一键检查
uv run ruff format src/ tests/ && uv run ruff check src/ tests/
```

---

## 4. 测试

### 4.1 测试结构

```
tests/
├── conftest.py                    # 全局 fixtures
├── unit/
│   ├── test_models.py             # Pydantic 模型测试
│   ├── test_config.py             # 配置测试
│   ├── test_services/
│   │   ├── test_precompute.py     # 预计算服务测试
│   │   └── test_performance.py    # 性能监控测试
│   └── test_utils/
│       ├── test_meili_client.py   # Meilisearch 客户端测试
│       └── test_websocket/
│           ├── test_reliable.py   # 可靠连接测试
│           └── test_ack.py        # ACK 系统测试
├── integration/
│   ├── test_api.py                # API 端点测试
│   ├── test_websocket.py          # WebSocket 集成测试
│   └── test_database.py           # 数据库集成测试
└── e2e/
    └── test_full_flow.py          # 端到端测试
```

### 4.2 运行测试

```bash
# 运行所有测试
uv run pytest

# 运行特定模块
uv run pytest tests/unit/test_models.py -v

# 运行带覆盖率
uv run pytest --cov=src --cov-report=html --cov-report=term

# 只运行单元测试
uv run pytest tests/unit/ -v

# 只运行集成测试（需要 Docker 服务）
uv run pytest tests/integration/ -v

# 运行性能测试
uv run pytest tests/ -m "slow" -v

# 调试模式
uv run pytest tests/ -v --pdb
```

### 4.3 Fixtures

```python
# tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app


@pytest.fixture
async def client():
    """FastAPI 测试客户端"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def auth_headers():
    """认证头"""
    return {"WRAPPER_MEILI_API_KEY": "test-key"}


@pytest.fixture
async def db_connection():
    """SurrealDB 测试连接"""
    async with Surreal("ws://localhost:8000") as db:
        await db.signin({"user": "root", "pass": "root"})
        await db.use("opencode", "memory_test")
        yield db
        # 清理测试数据
        await db.query("DELETE FROM atom WHERE tenant_id = 'test'")
```

### 4.4 测试示例

```python
# tests/unit/test_services/test_precompute.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from src.services.precompute import PrecomputeService


@pytest.fixture
def precompute_service():
    service = PrecomputeService()
    service.db = AsyncMock()
    service.db.query = AsyncMock(return_value=[{"result": []}])
    return service


@pytest.mark.asyncio
async def test_process_file_unchanged(precompute_service):
    """文件未变更时应跳过处理"""
    result = await precompute_service.precompute(
        file_path="test.py",
        source_code="def hello(): pass",
        language="python"
    )

    assert result["success"] is True


@pytest.mark.asyncio
async def test_process_file_creates_atoms(precompute_service):
    """文件变更时应创建 Atoms"""
    code = """
def foo():
    return bar()

def bar():
    return 42
"""
    result = await precompute_service.precompute(
        file_path="test.py",
        source_code=code,
        language="python"
    )

    assert result["atoms_count"] == 2
```

---

## 5. Docker 开发

### 5.1 开发模式

```bash
# 启动开发环境（热重载）
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 查看日志
docker-compose logs -f api

# 进入容器
docker-compose exec api bash

# 运行测试
docker-compose exec api pytest
```

### 5.2 docker-compose.dev.yml

```yaml
version: "3.8"
services:
  api:
    volumes:
      - ./wrapper/src:/app/src
    command: >
      uvicorn src.main:app
      --host 0.0.0.0
      --port 18008
      --reload
    environment:
      - LOG_LEVEL=DEBUG
```

### 5.3 构建

```bash
# 构建 Docker 镜像
docker build -t opencode-memory-api:v3.2.0 -f wrapper/Dockerfile wrapper/

# 运行
docker run -d \
  -p 18008:18008 \
  -e MODELSCOPE_API_KEY=your-key \
  -e MEILISEARCH_API_KEY=your-key \
  --name memory-api \
  opencode-memory-api:v3.2.0
```

---

## 6. 调试

### 6.1 VS Code 调试

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: FastAPI",
      "type": "debugpy",
      "request": "launch",
      "module": "uvicorn",
      "args": ["src.main:app", "--reload", "--port", "18008"],
      "jinja": true,
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}/embedding_service/wrapper/src",
        "MODELSCOPE_API_KEY": "your-key",
        "MEILISEARCH_API_KEY": "your-key"
      }
    },
    {
      "name": "Python: Pytest",
      "type": "debugpy",
      "request": "launch",
      "module": "pytest",
      "args": ["tests/", "-v"],
      "justMyCode": false
    }
  ]
}
```

### 6.2 日志调试

```python
import logging

logger = logging.getLogger(__name__)

async def process_file(file_path: str, content: str):
    logger.debug(f"Processing: {file_path}")

    try:
        result = await analyze(content)
        logger.info(f"Analysis complete: {len(result.symbols)} symbols")
        return result
    except Exception as e:
        logger.exception(f"Failed: {file_path}")
        raise
```

### 6.3 数据库调试

```bash
# 连接 SurrealDB 控制台
docker-compose exec surrealdb surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns opencode --db memory

# 常用查询
SELECT * FROM atom LIMIT 10;
SELECT * FROM entity WHERE type = 'code';
SELECT * FROM reference WHERE type = 'calls';

# 查看表结构
INFO FOR TABLE atom;

# 查看 ChangeFeed
SELECT * FROM atom CHANGES SINCE time::now() - 1h;
```

### 6.4 性能分析

```python
# 使用 cProfile
import cProfile
import pstats

profiler = cProfile.Profile()
profiler.enable()

# ... 运行需要分析的代码 ...

profiler.disable()
stats = pstats.Stats(profiler)
stats.sort_stats("cumulative")
stats.print_stats(20)
```

---

## 参考文档

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [SurrealDB Python SDK](https://github.com/surrealdb/surrealdb.py)
- [Meilisearch Python SDK](https://github.com/meilisearch/meilisearch-python)
- [tree-sitter Python](https://github.com/tree-sitter/py-tree-sitter)
- [pytest 文档](https://docs.pytest.org/)

---

_文档版本: v3.2.0 | 最后更新: 2026-04-10_
