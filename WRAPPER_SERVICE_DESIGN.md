# 🎯 包装层服务设计分析报告

**分析时间**: 2026-03-03  
**基准项目**: D:\embedding_service  
**目标**: 升级为 wrapper-service，保留现有能力，添加新功能  
**分析范围**: 网络检查、语义搜索、统一健康接口

---

## 📋 一、embedding_service 现有服务能力

### 1.1 Embedding 服务（端口 18000）

#### 现有 API 端点

| 端点             | 方法 | 功能             | 状态    |
| ---------------- | ---- | ---------------- | ------- |
| `/v1/embeddings` | POST | 生成文本嵌入向量 | ✅ 保留 |
| `/health`        | GET  | 服务健康检查     | ✅ 保留 |
| `/v1/models`     | GET  | 模型列表         | ✅ 保留 |
| `/stats`         | GET  | 统计信息         | ✅ 保留 |

#### `/v1/embeddings` 请求格式

```json
{
  "input": "文本或字符串数组",
  "model": "Qwen3-Embedding-0.6B",
  "encoding_format": "float",
  "dimensions": 1024,
  "normalize": true
}
```

#### `/v1/embeddings` 响应格式

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.123, 0.456, ...]  // 1024 维向量
    }
  ],
  "model": "Qwen3-Embedding-0.6B",
  "usage": {
    "prompt_tokens": 10,
    "total_tokens": 10,
    "processing_time_ms": 45.2
  }
}
```

#### `/health` 响应格式

```json
{
  "status": "healthy",
  "service": "embedding",
  "version": "2.0.1",
  "device": "cuda",
  "max_batch_size": 256,
  "max_length": 2048,
  "model": "Qwen/Qwen3-Embedding-0___6B",
  "cuda_available": true,
  "gpu_name": "NVIDIA GeForce RTX 3090",
  "gpu_memory_total_gb": 24.0,
  "gpu_memory_used_mb": 1500.5,
  "gpu_memory_reserved_mb": 2048.0
}
```

### 1.2 LLM 服务（端口 18001）

#### 现有 API 端点

| 端点                   | 方法 | 功能                     | 状态    |
| ---------------------- | ---- | ------------------------ | ------- |
| `/v1/chat/completions` | POST | OpenAI 兼容对话接口      | ✅ 保留 |
| `/generate`            | POST | 简单生成接口（支持缓存） | ✅ 保留 |
| `/health`              | GET  | 服务健康检查             | ✅ 保留 |
| `/v1/models`           | GET  | 模型列表                 | ✅ 保留 |
| `/stats`               | GET  | 统计信息                 | ✅ 保留 |

#### `/v1/chat/completions` 请求格式

```json
{
  "model": "MiniCPM4-0.5B",
  "messages": [
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "你好！有什么我可以帮助你的吗？" }
  ],
  "temperature": 0.7,
  "top_p": 0.7,
  "max_tokens": 512,
  "do_sample": true
}
```

#### `/v1/chat/completions` 响应格式

```json
{
  "id": "chatcmpl-local",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "MiniCPM4-0.5B",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！有什么我可以帮助你的吗？"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 50,
    "total_tokens": 70
  }
}
```

#### `/generate` 请求格式

```json
{
  "prompt": "介绍一下人工智能",
  "temperature": 0.7,
  "top_p": 0.7,
  "max_new_tokens": 512,
  "use_cache": true
}
```

#### `/generate` 响应格式

````json
{
  "response": "人工智能（AI）是计算机科学的一个分支...",
  "model": "MiniCPM4-0.Checker 需要的外部接口设计

### 2.1 NetworkChecker 需求分析

#### 需要的 API 端点

| 端点 | 方法 | 功能 | 优先级 |
|------|------|------|--------|
| `/api/health` | GET | 综一健康检查 | 🔴 高 |

#### 需要的响应格式

根据 DESIGN_API.md 第 29-43 行的规格：

**成功响应**：
```json
{
  "status": "ok",
  "timestamp": "2026-03-05T12:00:00Z",
  "latency": 15,
  "services": {
    "wrapper": "healthy",
    "surrealdb": "healthy",
    "embedding": "healthy",
    "allHealthy": true
  }
}
````

**错误响应**：

```json
{
  "status": "error",
  "timestamp": "2026-03-05T12:00:00Z",
  "error": "Service unavailable",
  "services": {
    "wrapper": "healthy",
    "surrealdb": "unreachable",
    "embedding": "healthy",
    "allHealthy": false
  }
}
```

#### 状态说明

| 状态       | 说明         | 处理方式                       |
| ---------- | ------------ | ------------------------------ |
| `ok`       | 所有服务正常 | ✅ 标记为 healthy              |
| `degraded` | 部分服务降级 | ⚠️ 标记为 degraded，但继续工作 |
| `error`    | 服务不可用   | ❌ 标记为 unhealthy            |

#### 定时检查需求

- **默认间隔**: 1 分钟（60000ms）
- **超时时间**: 5 秒（5000ms）
- **历史记录**: 保留最近 100 条记录

---

### 3.1 WrapperClient 需求分析

#### 需要的 API 端点

| 端点                | 方法 | 功能     | 优先级 |
| ------------------- | ---- | -------- | ------ |
| `/api/search`       | POST | 语义搜索 | 🔴 高  |
| `/api/upload`       | POST | 上传记忆 | 🟡 中  |
| `/api/batch-upload` | POST | 批量上传 | 🟡 中  |

#### `/api/search` 请求格式

根据 DESIGN_API.md 第 48-83 行的规格：

```json
{
  "query": "用户偏好的编码风格",
  "mode": "hybrid", // "vector", "keyword", "hybrid"
  "limit": 10,
  "threshold": 0.3,
  "filters": {
    "project_tag": "projectA"
  }
}
```

**参数说明**:

- `query`: 搜索查询
- `mode`: 搜索模式
  - `vector`: 纯向量搜索
  - `keyword`: 纯关键词搜索
  - `hybrid`: 混合搜索（70% 向量 + 30% BM25）
- `limit`: 返回结果数量
- `threshold`: 相似度阈值（0-1）
- `filters`: 过滤条件（可选）

#### `/api/search` 响应格式

```json
{
  "success": true,
  "query": "用户偏好的编码风格",
  "count": 3,
  "results": [
    {
      "id": "memory_001",
      "content": "用户偏好使用 TypeScript 进行项目开发",
      "score": 0.92,
      "project_tag": "projectA",
      "project_id": "D:\\github\\project-a",
      "project_name": "Project A",
      "source": "MEMORY.md",
      "line": 15,
      "timestamp": "2026-03-05T12:00:00Z"
    },
    {
      "id": "memory_002",
      "content": "编码风格：使用 ESLint + Prettier",
      "score": 0.85,
      "project_tag": "projectA",
      "project_id": "D:\\github\\project-a",
      "project_name": "Project A",
      "source": "PROJECT_MEMORY.md",
      "line": 18,
      "timestamp": "2026-03-05T11:30:00Z"
    },
    {
      "id": "memory_003",
      "content": "配置文件：.eslintrc 和 .prettierrc",
      "score": 0.78,
      "project_tag": "projectA",
      "project_id": "D:\\github\\project-a",
      "project_name": "Project A",
      "source": "PROJECT_MEMORY.md",
      "line": 21,
      "timestamp": "2026-03-05T10:15:00Z"
    }
  ],
  "query_time_ms": 45,
  "search_mode": "hybrid"
}
```

#### `/api/upload` 请求格式

```json
{
  "entries": [
    {
      "id": "memory_001",
      "content": "用户偏好使用 TypeScript 进行项目开发",
      "type": "preference",
      "tags": ["typescript", "code-style"],
      "project_tag": "projectA",
      "project_id": "D:\\github\\project-a",
      "project_name": "Project A",
      "uploaded": false
    }
  ]
}
```

#### `/api/upload` 响应格式

```json
{
  "success": true,
  "total": 1,
  "uploaded": 1,
  "failed": 0,
  "results": [
    {
      "id": "memory_001",
      "success": true,
      "uploaded": true,
      "error": null
    }
  ]
}
```

#### `/api/batch-upload` 请求格式

```json
{
  "entries": [
    {
      "id": "memory_001",
      "content": "用户偏好使用 TypeScript 进行项目开发",
      "type": "preference",
      "tags": ["typescript", "code-style"],
      "project_tag": "projectA",
      "project_id": "D:\\github\\project-a",
      "project_name": "Project A",
      "uploaded": false
    },
    {
      "id": "memory_002",
      "content": "编码风格：使用 ESLint + Prettier",
      "type": "note",
      "tags": ["eslint", "prettier"],
      "project_tag": "projectA",
      "project_id": "D:\\github\\project\\project-a",
      "project_name": "Project A",
      "uploaded": false
    }
  ]
}
```

#### `/api/batch-upload` 响应格式

````json
{
  "success": true,
  "total": 2,
  "uploaded": 2,
  "failed": 0,
  "results": [
    {
      "id": "memory_001",
      "success": true,
      "uploaded": true,
      "error": null
    },
    {
      "id": "memory_002",
      "success": true,
      "保留所有 6 个现有端点，向后兼容

### 4.2 新增端点实现优先级

#### Phase 1：统一健康检查（高优先级）

**目标**: 实现 `/api/health` 端点

**位置**: 新建 `wrapper_service.py` 或修改 `embedding_service.py`

**实现步骤**:
1. 创建 `/api/health` 端点（POST）
2. 集成两个现有服务的 `/health` 端点
3. 集成 SurrealDB 的健康检查（如果存在）
4. 返回统一的健康状态

**代码框架**:
```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Literal

class ServiceStatus(BaseModel):
    wrapper: Literal["healthy", "degraded", "down", "unreachable"]
    surrealdb: Literal["healthy", "down", "unreachable"]
    embedding: Literal["healthy", "down", "unreachable"]

class HealthResponse(BaseModel):
    status: Literal["ok", "error"]
    timestamp: str
    latency: float
    services: dict

@app.post("/api/health")
async def unified_health_check():
    """统一健康检查端点"""
    import httpx

    start_time = time.time()

    # 检查 embedding 服务
    embedding_status = await check_service_health("embedding", "http://localhost:18000/health")

    # 检查 SurrealDB（如果配置）
    surrealdb_status = await check_surrealdb_health()

    latency_ms = (time.time() - start_time) * 1000

    # 判断总体状态
    all_healthy = all([
        embedding_status["status"] == "healthy",
        surrealdb_status["status"] == "healthy"
    ])

    overall = "ok" if all_healthy else "degraded"

    return HealthResponse(
        status=overall,
        timestamp=datetime.utcnow().isoformat(),
        latency=latency_ms,
        services={
            "embedding": embedding_status["status"],
            "surrealdb": surrealdb_status["status"],
            "allHealthy": all_healthy
        }
    )

async def check_service_health(service_name: str, url: str):
    """检查单个服务的健康状态"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                data = response.json()
                return {"status": "healthy", "latency": data.get("latency", 0)}
            else:
                return {"status": "down", "error": f"HTTP {response.status_code}"}
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}

async def check_surrealdb_health():
    """检查 SurrealDB 健康状态"""
    # TODO: 实现 SurrealDB 健康检查
    return {"status": "healthy", "latency": 0}
````

**向后兼容性保证**:

- ✅ `/health` 端点保持不变
- ✅ `/v1/embeddings` 端点保持不变
- ✅ 所有现有 API 调用继续工作

#### Phase 2: 语义搜索端点（高优先级）

**目标**: 实现 `/api/search` 端点

**实现方式**:

- 在 `embedding_service.py` 中添加 `/api/search` 端点
- 复用现有的 `get_embeddings()` 函数
- 添加本地 MD 文件读取功能
- 实现搜索逻辑

**代码框架**:

```python
@app.post("/api/search")
async def semantic_search(request: SearchRequest):
    """语义搜索端点"""
    import re
    from pathlib import Path

    start_time = time.time()

    # 1. 生成查询的嵌入
    query_embedding = await get_embeddings([request.query])

    # 2. 读取本地记忆文件
    memory_dir = Path(os.getenv("HOME")) / ".opencode" / "memory"
    all_entries = []

    for md_file in memory_dir.glob("**/*.md"):
        with open(md_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')

            for line in lines:
                # 解析记忆条目
                if line.startswith('**') and 'Date:' in line:
                    entry_id = line.strip('*').strip()
                elif line.startswith('**') and 'Type:' in line:
                    entry_type = line.split(':')[1].strip()
                elif line.strip() and not line.startswith('#') and not line.startswith('**'):
                    entry_content = line.strip()

                    # 生成嵌入并计算相似度
                    entry_embedding = await get_embeddings([entry_content])
                    similarity = cosine_similarity(query_embedding[0], entry_embedding[0])

                    if similarity >= request.threshold:
                        all_entries.append({
                            "content": entry_content,
                            "score": float(similarity),
                            "source": md_file.name,
                            "line": lines.index(line) + 1
                        })

    # 3. 排序和限制
    all_entries.sort(key=lambda x: x["score"], reverse=True)
    results = all_entries[:request.limit]

    query_time_ms = (time.time() - start_time) * 1000

    return SearchResponse(
        success=True,
        query=request.query,
        count=len(results),
        results=results,
        query_time_ms=query_time_ms,
        search_mode=request.mode
    )

def cosine_similarity(vec1, vec2):
    """计算余弦相似度"""
    import numpy as np
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
```

**向后兼容性保证**:

- ✅ 所有现有端点保持不变
- ✅ 不影响现有的 embedding 功能
- ✅ 可以独立部署和测试

#### Phase 3: 记忆上传端点（中优先级）

**目标**: 实现 `/api/upload` 和 `/api/batch-upload` 端点

**实现方式**:

- 在 `embedding_service.py` 中添加这两个端点
- 接收 MemoryManager 格式的记忆数据
- 写入本地 MD 文件

**代码框架**:

```python
@app.post("/api/upload")
async def upload_memory(request: UploadRequest):
    """上传单条记忆"""
    # 解析记忆条目
    entry = request.entries[0]

    # 写入对应文件
    target_file = get_target_file(entry["project_tag"])
    file_path = os.path.join(MEMORY_DIR, target_file)

    with open(file_path, 'a', encoding='utf-8') as f:
        f.write(format_entry_as_markdown(entry))

    return UploadResponse(
        success=True,
        total=1,
        uploaded=1,
        failed=0,
        results=[{
            "id": entry["id"],
            "success": True,
            "uploaded": True,
            "error": None
        }]
    )

@app.post("/api/batch-upload")
async def batch_upload_memories(request: BatchUploadRequest):
    """批量上传记忆"""
    results = []

    for entry in request.entries:
        try:
            target_file = get_target_file(entry["project_tag"])
            file_path = os.path.join(MEMORY_DIR, target_file)

            with open(file_path, 'a', encoding='utf-8') as f:
                f.write(format_entry_as_markdown(entry))

            results.append({
                "id": entry["id"],
                "success": True,
                "uploaded": True,
                "error": None
            })
        except Exception as e:
            results.append({
                "id": entry["id"],
                "success": False,
                "uploaded": False,
                "error": str(e)
            })

    uploaded_count = sum(1 for r in results if r["success"])
    failed_count = len(results) - uploaded_count

    return UploadResponse(
        success=True,
        total=len(results),
        uploaded=uploaded_count,
        failed=failed_count,
        results=results
    )

def format_entry_as_markdown(entry):
    """格式化记忆条目为 Markdown"""
    timestamp = entry.get("timestamp", datetime.utcnow().isoformat())
    entry_type = entry.get("type", "general")
    tags = entry.get("tags", [])

    return f"""## {entry_type.capitalize()} Entry

**Date**: {timestamp}

**Type**: {entry_type}

**Tags**: {', '.join(tags) or 'none'}

{entry.get("content", "")}

---
"""
```

**向后兼容性保证**:

- ✅ 所有现有端点保持不变
- ✅ 独立部署和测试
- ✅ 不影响现有 embedding 和 LLM 功能

---

## 🎯 五、升级路径详细步骤

### Step 1: 创建包装层服务（1h）

**目标**: 创建新的 `wrapper_service.py`

**步骤**:

1. 在 `D:\embedding_service\src\qwen3_embedding_service\` 目录创建 `wrapper_service.py`
2. 实现 `/api/health` 端点（统一健康检查）
3. 实现 `/api/search` 端点（语义搜索）
4. 实现 `/api/upload` 和 `/api/batch-upload` 端点
5. 添加必要的依赖导入

**代码框架**:

```python
# D:\embedding_service\src\qwen3_embedding_service\wrapper_service.py
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from pathlib import Path
import time
import asyncio

app = FastAPI(title="Wrapper Service", version="1.0.0")

# 导入现有服务（需要重构）
# from embedding_service import get_embeddings, logger

# ... 端点实现
```

### Step 2: 重构现有代码（2h）

**目标**: 提取公共代码到共享模块

**步骤**:

1. 创建 `shared/utils.py` - 工具函数
2. 创建 `shared/config.py` - 配置管理
3. 重构 `embedding_service.py` 和 `llm_service.py` 使用共享模块
4. 保持所有现有端点不变

**共享模块**:

```python
# shared/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 服务端口
    embedding_port: int = 18000
    llm_port: int = 18001
    wrapper_port: int = 3001

    # 模型路径
    embedding_model_path: str = "Qwen/Qwen3-Embedding-0___6B"
    llm_model_path: str = "OpenBMB/MiniCPM4-0.5B"

    # 缓存配置
    cache_size: int = 1000
    batch_size: int = 256

    # 记忆目录
    memory_dir: Path = Path.home() / ".opencode" / "memory"

class Config:
    memory_dir: Path = Path.home() / ".opencode" / "memory"

    def get_target_file(self, project_tag: str) -> str:
        if project_tag == 'global':
            return self.memory_dir / "GLOBAL_MEMORY.md"
        elif project_tag == 'unclassified':
            return self.memory_dir / "MEMORY.md"
        else:
            return self.memory_dir / "PROJECT_MEMORY.md"

# shared/utils.py
from pathlib import Path
from typing import List, Dict
import re

def parse_md_entries(content: str) -> List[Dict]:
    """解析 Markdown 格式的记忆文件"""
    entries = []
    current_entry = {}

    lines = content.split('\n')
    for i, line in enumerate(lines):
        line = line.strip()

        if line.startswith('## ') and ' Entry' in line:
            if current_entry:
                entries.append(current_entry)
            current_entry = {
                "line": i + 1,
                "type": line.split()[1].strip(),
                "content": ""
            }
        elif line.startswith('**Date:**):
            if 'Entry' in current_entry.get('content', ''):
                current_entry['timestamp'] = line.split(':', 1)[1].strip()
        elif line.startswith('**Type:**):
            if 'Entry' in current_entry.get('content', ''):
                current_entry['type'] = line.split(':', 1)[1].strip()
        elif line.startswith('**Tags:**):
            if 'Entry' in current_entry.get('content', ''):
                tags = line.split(':', 1)[1].strip()
                current_entry['tags'] = [t.strip() for t in tags.split(',')]
        elif line and not line.startswith('#') and not line.startswith('**'):
            if 'Entry' in current_entry:
                current_entry['content'] += line + '\n'

    if current_entry:
        entries.append(current_entry)

    return entries

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """计算余弦相似度"""
    import numpy as np
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
```

### Step 3: 集成统一健康检查（1.5h）

**目标**: 在两个服务中集成统一的 `/api/health` 端点

**步骤**:

1. 在 `embedding_service.py` 中添加 `/api/health` 端点
2. 在 `llm_service.py` 中添加 `/api/health` 端点
3. 两个端点都返回相同格式的响应

**代码示例**:

```python
# embedding_service.py
@app.post("/api/health")
async def unified_health_check_embedding():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "latency": 5,
        "services": {
            "embedding": "healthy",
            "allHealthy": True
        }
    }

# llm_service.py
@app.post("/api/health")
async def unified_health_check_llm():
    return {
        "status": "options": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "latency": 3,
        "services": {
            "llm": "healthy",
            "allHealthy": True
        }
    }
```

### Step 4: 添加语义搜索功能（2h）

**目标**: 在 `embedding_service.py` 中添加 `/api/search` 端点

**步骤**:

1. 添加搜索请求和响应模型
2. 实现语义搜索逻辑
3. 集成本地 MD 文件读取
4. 实现相似度计算和排序

### Step 5: 添加记忆上传功能（2h）

**目标**: 添加 `/api/upload` 和 `/api/batch-upload` 端点

**步骤**:

1. 添加上传请求和响应模型
2. 实现文件写入逻辑
3. 支持批量上传

### Step 6: 测试和验证（1.5h）

**测试计划**:

1. 测试所有现有端点（向后兼容性）
2. 测试新增端点
3. 测试健康检查逻辑
4. 测试语义搜索功能
5. 测试记忆上传功能
6. 性能测试

---

## 📊 六、配置管理方案

### 6.1 环有配置方式

**embedding_service.py 配置**:

- 硬编码：端口、批量大小、模型路径
- 环境变量：`EMB_MAX_BATCH_SIZE`, `EMB_MODEL_PATH`
- 运行时检测：GPU 内存

### 6.2 建议的统一配置方式

**创建 `shared/config.py`**:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 服务端口
    embedding_port: int = 18000
    llm_port: int = 18001
    wrapper_port: int = 3001

    # 模型配置
    embedding_model_path: str = "Qwen/Qwen3-Embedding-0___6B"
    llm_model_path: str = "OpenBMB/MiniCPM4-0.5B"

    # 缓存配置
    cache_size: int = 1000
    batch_size: int = 256

    # 搜索配置
    search_threshold: float = 0.3
    search_limit: int = 10

    # 记忆目录
    memory_dir: Path.home() / ".opencode" / "memory"

    class Config:
        def get_target_file(self, project_tag: str) -> Path:
            if project_tag == 'global':
                return self.memory_dir / "GLOBAL_MEMORY.md"
            elif project_tag == 'unclassified':
                return self.memory_dir / "MEMORY.md"
            else:
                return self.memory_dir / "PROJECT_MEMORY.md"

settings = Settings()
config = Config()
```

### 6.3 环境变量映射

| 环境变量             | 配置项                 | 默认值                        | 说明               |
| -------------------- | ---------------------- | ----------------------------- | ------------------ |
| `EMB_MAX_BATCH_SIZE` | `embedding_batch_size` | 256                           | Embedding 批量大小 |
| `EMB_MODEL_PATH`     | `embedding_model_path` | `Qwen/Qwen3-Embedding-0___6B` | Embedding 模型路径 |
| `LLM_MAX_BATCH_SIZE` | `llm_batch_size`       | 2                             | LLM 批量大小       |
| `LLM_MODEL_PATH`     | `llm_model_path`       | `OpenBMB/MiniCPM4-0.5B`       | LLM 模型路径       |
| `WRAPPER_PORT`       | `wrapper_port`         | 3001                          | Wrapper 服务端口   |
| `MEMORY_DIR`         | `memory_dir`           | ~/.opencode/memory            | 记忆目录           |

---

## 🎯 七、部署方案

### 7.1 单服务部署（推荐用于开发/测试）

**方案**:

```
D:\embedding_service\
├── src\qwen3_embedding_service\
│   ├── embedding_service.py      # 端口 18000, 包含所有端点
│   └── llm_service.py           # 端口 18001, 包含所有端点
├── requirements.txt
└── run_service.bat              # 统一启动脚本
```

**启动命令**:

```bash
# 启动所有服务
python -m uvicorn src.qwen3_embedding_service.embedding_service:app --host 0.0.0 --port 18000
python -m uvicorn src.qwen3_embedding_service.llm_service:app --host 0.0.0 --port 18001
```

**优点**:

- ✅ 部署简单
- ✅ 易于开发和测试
- ✅ 资源利用率高

**缺点**:

- ⚠️ 两个服务共享一个进程
- ⚠️ 需要处理端口冲突

### 7.2 分服务部署（推荐用于生产）

**方案**:

```
D:\embedding_service\
├── services\
│   ├── embedding\
│   │   ├── embedding_service.py
│   │   └── start_embedding.py
│   └── llm\
│       ├── llm_service.py
│       └── start_llm.py
├── docker-compose.yml               # 统一管理
```

**docker-compose.yml**:

```yaml
version: "3.8"

services:
  embedding:
    build: .
    ports:
      - "18000:18000"
    environment:
      - EMB_MAX_BATCH_SIZE: 256
    restart: unless-stopped

  llm:
    build: .
    ports:
      - "18001:18001"
    environment:
      - LLM_MAX_BATCH_SIZE: 2
    restart: unless-stopped
```

**优点**:

- ✅ 服务隔离
- ✅ 独立扩展
- ✅ 容错和恢复能力强

**缺点**:

- ⚠️ 需要更多资源
- ⚠️ 部署复杂度增加

---

## 📋 八、向后兼容性保证措施

### 8.1 现有端点保留清单

| 端点                   | 路径                   | 保留状态    |
| ---------------------- | ---------------------- | ----------- |
| `/v1/embeddings`       | `embedding_service.py` | ✅ 完全保留 |
| `/health`              | `embedding_service.py` | ✅ 完全保留 |
| `/v1/models`           | `embedding_service.py` | ✅ 完全保留 |
| `/stats`               | `embedding_service.py` | ✅ 完全保留 |
| `/v1/chat/completions` | `llm_service.py`       | ✅ 完全保留 |
| `/generate`            | `llm_service.py`       | ✅ 完全保留 |
| `/health`              | `llm_service.py`       | ✅ 完全保留 |
| `/v1/models`           | `llm_service.py`       | ✅ 完全保留 |
| `/stats`               | `llm_service.py`       | ✅ 完全保留 |

### 8.2 新增端点

| 端点                | 路径                   | 功能         |
| ------------------- | ---------------------- | ------------ |
| `/api/health`       | `embedding_service.py` | 统一健康检查 |
| `/api/search`       | `embedding_service.py` | 语义搜索     |
| `/api/upload`       | `embedding_service.py` | 记忆上传     |
| `/api/batch-upload` | `embedding_service.py` | 批量上传     |

### 8.3 兼容性测试清单

#### 向后兼容性测试

**Phase 1: 现有功能测试**

- [ ] Embedding 服务 - `/v1/embeddings` 端点
- [ ] Embedding 服务 - `/health` 端点
- [ ] Embedding 服务 - `/v1/models` 端点
- [ ] Embedding 服务 - `/stats` 端点
- [ ] LLM 服务 - `/v1/chat/completions` 端点
- [ ] LLM 服务 - `/generate` 端点
- [ ] LLM 服务 - `/health` 端点
- [ ] LLM 服务 - `/v1/models` 端点
- [ ] LLM 服务 - `/stats` 端点

**Phase 2: 新增功能测试**

- [ ] 统一健康检查 - `/api/health` 端点
- [ ] 语义搜索 - `/api/search` 端点
- [ ] 记忆上传 - `/api/upload` 端点
- [ ] 批量上传 - `/api/batch-upload` 端点

#### 性能测试

- [ ] 健康检查响应时间 < 100ms
- [ ] 语义搜索响应时间 < 500ms
- [ ] 记忆上传响应时间 < 200ms

---

## 🎯 九、风险评估和缓解措施

| 风险               | 影响             | 概率 | 缓解措施                            |
| ------------------ | ---------------- | ---- | ----------------------------------- |
| **端口冲突**       | 服务启动失败     | 中   | ✅ 使用不同端口（18000/18001/3001） |
| **性能下降**       | 响应延迟增加     | 低   | ✅ 优化算法和缓存                   |
| **向后兼容性破坏** | 现有客户端失效   | 低   | ✅ 完整测试 + 版本管理              |
| **数据一致性**     | 多服务数据不一致 | 低   | ✅ 统一配置管理                     |
| **部署复杂度增加** | 部署时间增加     | 低   | ✅ Docker Compose 管化              |
| **新增功能的 Bug** | 新功能不稳定     | 中   | ✅ 充分测试 + 灰进式发布            |

---

## 📋 十、后续工作建议

### 短期（1-2 周）

1. ✅ 实现统一健康检查
2. ✅ 实现语义搜索端点
3. ✅ 实现记忆上传端点
4. ✅ 完整测试向后兼容性

### 中期（1-2 月）

1. 🔧 实现 SurrealDB 集成
2. 🔧 实现高级搜索功能
3. 🔧 实现批量上传优化
4. 🔧 添加监控和日志

### 长期（3-6 月）

1. 🔧 性能优化（HNSW 索引）
2. 🔧 分布式部署方案
3. 🔧 高级缓存策略
4. 🔧 A/B 测试和金丝雀发布

---

**报告生成时间**: 2026-03-03  
**建议**: 按照升级路径逐步实施，确保向后兼容性
