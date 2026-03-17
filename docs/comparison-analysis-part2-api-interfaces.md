# 现有代码 vs 设计文档 - API接口对比分析

**分析日期**: 2026-03-17  
**分析范围**: 后端API、设计文档API

---

## 1. 现有API端点清单

### 1.1 后端现有API

| 端点                              | 方法   | 功能         | 状态      |
| --------------------------------- | ------ | ------------ | --------- |
| `/health`                         | GET    | 健康检查     | ✅ 已实现 |
| `/v1/embeddings`                  | POST   | 获取向量     | ✅ 已实现 |
| `/api/v1/memories`                | POST   | 批量上传记忆 | ✅ 已实现 |
| `/api/v1/memories/search`         | POST   | 搜索记忆     | ✅ 已实现 |
| `/api/v1/memories/relations`      | POST   | 创建关系     | ✅ 已实现 |
| `/api/v1/memories/{id}/relations` | POST   | 查询关系     | ✅ 已实现 |
| `/api/v1/memories/relations/{id}` | DELETE | 删除关系     | ✅ 已实现 |
| `/api/v1/memories/{id}/graph`     | POST   | 图遍历       | ✅ 已实现 |

### 1.2 设计文档提出的新API

| 端点                          | 方法 | 功能             | 状态      |
| ----------------------------- | ---- | ---------------- | --------- |
| `/api/v1/memories/batch-sync` | POST | 批量同步（增量） | ❌ 未实现 |

---

## 2. 批量上传API对比

### 2.1 现有API：POST /api/v1/memories

**请求模型**：

```python
{
    "memories": [
        {
            "content": str,
            "type": str,
            "tags": list[str],
            "metadata": dict,
            "project_id": str,
            "source": str,
            "source_id": str | None,
            "source_timestamp": str | None,
            "classification_confidence": float | None
        }
    ],
    "tenant_id": str
}
```

**响应模型**：

```python
{
    "total": int,
    "success": int,
    "failed": int,
    "memory_ids": list[str],
    "errors": list[str | dict]
}
```

**特点**：

- ✅ 支持批量上传
- ✅ 支持去重检测（hash + 语义）
- ❌ 只支持新增（CREATE）
- ❌ 不支持更新（UPDATE）
- ❌ 不支持删除（DELETE）
- ❌ 无幂等性保证
- ❌ 无并发控制

### 2.2 设计文档：POST /api/v1/memories/batch-sync

**请求模型**：

```typescript
{
    "batch_id": string,        // 幂等键
    "tenant_id": string,
    "project_id": string,

    "to_add": MemoryEntry[],   // 新增
    "to_update": MemoryUpdate[], // 更新
    "to_delete": MemoryDelete[]  // 删除
}
```

**响应模型**：

```typescript
{
    "batch_id": string,
    "status": "success" | "partial" | "failed",

    "results": {
        "added": AddResult[],
        "updated": UpdateResult[],
        "deleted": DeleteResult[]
    },

    "summary": {
        "total": number,
        "succeeded": number,
        "failed": number,
        "skipped": number
    },

    "errors": ErrorDetail[]
}
```

**特点**：

- ✅ 支持三种操作（CREATE/UPDATE/DELETE）
- ✅ 幂等性保证（batch_id）
- ✅ 并发控制（version字段）
- ✅ 部分成功处理
- ✅ 详细的错误信息

---

## 3. 缺失的API（现有没有，增量同步需要）

### 3.1 获取单个记忆

**建议端点**：`GET /api/v1/memories/{memory_id}`

**用途**：

- 查询单个记忆的详细信息
- 验证记忆是否存在
- 获取最新的version

**现有状态**：❌ 缺失

### 3.2 更新记忆

**建议端点**：`PATCH /api/v1/memories/{memory_id}`

**请求**：

```json
{
  "content": "Updated content",
  "tags": ["new", "tags"],
  "expected_version": 2
}
```

**用途**：

- 更新单个记忆
- 支持乐观锁

**现有状态**：❌ 缺失

### 3.3 删除记忆

**建议端点**：`DELETE /api/v1/memories/{memory_id}`

**请求**：

```json
{
  "tenant_id": "default",
  "reason": "Outdated"
}
```

**用途**：

- 删除单个记忆（软删除）
- 记录删除原因

**现有状态**：❌ 缺失

### 3.4 列出所有source_id

**建议端点**：`GET /api/v1/memories/source_ids`

**请求参数**：

```
?tenant_id=default&project_id=my-project
```

**响应**：

```json
{
  "source_ids": [
    {
      "source_id": "abc123...",
      "record_id": "memory:01HQ...",
      "content_hash": "def456...",
      "updated_at": "2026-03-17..."
    }
  ],
  "total": 1000
}
```

**用途**：

- 增量同步的核心API
- 对比本地和后端的差异
- 识别需要删除的记忆

**现有状态**：❌ 缺失，**增量同步必需**

### 3.5 按source_id批量查询

**建议端点**：`POST /api/v1/memories/by-source-ids`

**请求**：

```json
{
    "source_ids": ["abc123", "def456", ...],
    "tenant_id": "default",
    "project_id": "my-project"
}
```

**响应**：

```json
{
  "memories": [
    {
      "source_id": "abc123",
      "record_id": "memory:01HQ...",
      "version": 3,
      "content_hash": "...",
      "updated_at": "..."
    }
  ]
}
```

**用途**：

- 批量检查记忆是否存在
- 获取version信息用于并发控制

**现有状态**：❌ 缺失

---

## 4. 响应模型对比

### 4.1 现有上传响应

```python
{
    "total": 10,
    "success": 8,
    "failed": 2,
    "memory_ids": ["memory:01HQ...", ...],
    "errors": [
        "Error message",
        {
            "type": "duplicate",
            "duplicate_type": "hash",
            "message": "...",
            "existing_id": "memory:01HR...",
            "similarity": 0.98
        }
    ]
}
```

**问题**：

- ❌ 无法区分哪个条目成功/失败（只有总数）
- ❌ errors数组混合了字符串和对象
- ❌ 无op_index标识失败的条目位置

### 4.2 设计文档响应

```typescript
{
    "batch_id": "uuid",
    "status": "partial",
    "results": {
        "added": [
            {
                "op_index": 0,
                "status": "success",
                "record_id": "memory:01HQ...",
                "version": 1
            },
            {
                "op_index": 1,
                "status": "duplicate",
                "error": "Hash duplicate"
            }
        ],
        "updated": [...],
        "deleted": [...]
    },
    "summary": {
        "total": 10,
        "succeeded": 8,
        "failed": 2,
        "skipped": 0
    }
}
```

**优势**：

- ✅ 每个操作都有明确的结果
- ✅ op_index标识操作位置
- ✅ 结构化的错误信息
- ✅ 区分成功/失败/跳过

---

## 5. 幂等性支持对比

### 5.1 现有实现

**状态**：❌ 无幂等性保证

**问题**：

- 重复请求会创建重复记忆（如果source_id不同）
- 网络重试可能导致重复上传
- 无法安全地重试失败的批次

### 5.2 设计文档

**机制**：Redis存储batch_id

```python
# 伪代码
key = f"batch_sync:idempotency:{batch_id}"
if redis.exists(key):
    return cached_result

redis.set(key, "processing", ex=86400)
# 执行操作
redis.set(key, "completed", ex=86400)
```

**优势**：

- ✅ 相同batch_id的请求只执行一次
- ✅ 支持安全重试
- ✅ 24小时TTL自动清理

---

## 6. 并发控制对比

### 6.1 现有实现

**状态**：❌ 无并发控制

**问题**：

- 多个客户端同时更新同一记忆会导致数据覆盖
- 无法检测并发冲突
- 后写入的数据会覆盖先写入的数据

### 6.2 设计文档

**机制**：乐观锁（version字段）

```sql
UPDATE memory SET
    content = $content,
    version = version + 1
WHERE id = $id AND version = $expected_version
```

**优势**：

- ✅ 检测并发冲突
- ✅ 返回冲突错误
- ✅ 客户端可以重新读取并合并

---

## 7. 错误处理对比

### 7.1 现有实现

**错误类型**：

```python
# 混合格式
errors = [
    "Error message string",
    {
        "type": "duplicate",
        "message": "...",
        "existing_id": "..."
    }
]
```

**问题**：

- ❌ 格式不统一（字符串 + 对象）
- ❌ 无法定位失败的条目
- ❌ 错误信息不够详细

### 7.2 设计文档

**错误格式**：

```typescript
{
    "op_index": 1,
    "status": "failed",
    "error": "Detailed error message",
    "error_code": "VERSION_CONFLICT",
    "details": {
        "expected_version": 2,
        "actual_version": 3
    }
}
```

**优势**：

- ✅ 统一的结构
- ✅ op_index定位失败条目
- ✅ error_code便于程序处理
- ✅ details提供详细信息

---

## 8. 关键问题总结

### 8.1 严重问题（P0）

| 问题                 | 影响              | 建议         |
| -------------------- | ----------------- | ------------ |
| 缺少批量同步API      | 无法增量同步      | **必须实现** |
| 缺少更新/删除API     | 无法修改/删除记忆 | **必须实现** |
| 缺少source_id列表API | 无法对比差异      | **必须实现** |
| 无幂等性保证         | 重复上传风险      | **必须实现** |
| 无并发控制           | 数据覆盖风险      | **必须实现** |

### 8.2 重要问题（P1）

| 问题           | 影响         | 建议         |
| -------------- | ------------ | ------------ |
| 响应格式不统一 | 难以处理     | 改进响应模型 |
| 错误信息不详细 | 难以调试     | 增强错误信息 |
| 缺少op_index   | 无法定位失败 | 添加操作索引 |

---

## 9. API实施优先级

### 9.1 P0（必须实现）

1. **POST /api/v1/memories/batch-sync**
   - 支持CREATE/UPDATE/DELETE
   - 幂等性保证
   - 并发控制

2. **GET /api/v1/memories/source_ids**
   - 列出所有source_id
   - 支持分页
   - 支持过滤

### 9.2 P1（强烈建议）

3. **POST /api/v1/memories/by-source-ids**
   - 批量查询记忆信息
   - 获取version和hash

4. **GET /api/v1/memories/{id}**
   - 查询单个记忆

### 9.3 P2（可选）

5. **PATCH /api/v1/memories/{id}**
   - 单个更新（batch-sync已覆盖）

6. **DELETE /api/v1/memories/{id}**
   - 单个删除（batch-sync已覆盖）

---

**下一部分**：业务逻辑对比分析
