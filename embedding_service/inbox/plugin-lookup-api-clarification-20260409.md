# 补充说明：Memory Lookup API 需求细节

**发件人**: OpenCode Memory Plugin 前端团队  
**收件人**: rs-memory-service 后端团队  
**日期**: 2026-04-09  
**关联文档**: plugin-lookup-api-request-20260409.md

---

## 问题澄清

针对之前的需求文档，补充以下技术细节：

---

## 1. 查询范围

**问题**: 是否只查询 `type = 'code'` 的记忆，还是所有类型？

**答案**:

- **默认查询所有类型**
- 如果提供 `type` 参数，则按类型过滤
- 代码分析场景主要使用 `type = 'code'`，但 API 应该通用

**建议 API 设计**:

```http
GET /api/v1/memories/lookup?source_id=xxx&type=code  # 只查代码类型
GET /api/v1/memories/lookup?source_id=xxx            # 查所有类型
```

---

## 2. 返回数量

**问题**: `file_path` 和 `hash` 查询可能返回多条，是返回最新的一条还是全部？

**答案**:

- **默认返回最新的一条**（按 `created_at` 降序）
- 如果提供 `limit` 参数，返回多条
- 如果提供 `all=true`，返回全部历史版本

**原因**:

- 缓存重建场景只需要最新的 memory_id
- 版本追踪场景可能需要历史记录

**建议 API 设计**:

```http
# 默认：返回最新一条
GET /api/v1/memories/lookup?file_path=src/utils.ts&project_id=xxx

# 返回多条
GET /api/v1/memories/lookup?file_path=src/utils.ts&project_id=xxx&limit=10

# 返回全部历史版本
GET /api/v1/memories/lookup?file_path=src/utils.ts&project_id=xxx&all=true
```

**响应格式（多条）**:

```json
{
  "found": true,
  "count": 3,
  "memories": [
    {
      "memory_id": "memory:xyz...",
      "source_id": "01H1ABC...",
      "created_at": "2026-04-09T10:30:00Z"
    },
    {
      "memory_id": "memory:abc...",
      "source_id": "01H2DEF...",
      "created_at": "2026-04-08T09:20:00Z"
    }
  ]
}
```

---

## 3. Hash 格式

**问题**: 插件端存储的 hash 是 `md5:abc123...` 还是纯 `abc123...`？

**答案**:

- **当前使用纯 hash**（32 位十六进制字符串）
- 格式：`abc123def456...`（不含前缀）
- 算法：MD5

**代码示例**:

```javascript
// 插件端计算 hash
import { createHash } from 'crypto';
const contentHash = createHash('md5').update(content).digest('hex');
// 结果: "d41d8cd98f00b204e9800998ecf8427e"

// 存储到 metadata
metadata: {
  content_hash: contentHash,  // 纯 hash，不含前缀
  file_path: "src/utils.ts"
}
```

**建议**:

- API 接收纯 hash 字符串
- 后端存储时也使用纯 hash
- 如果需要算法标识，可以额外提供 `hash_algorithm` 参数

```http
GET /api/v1/memories/lookup?hash=d41d8cd98f00b204e9800998ecf8427e&hash_algorithm=md5
```

---

## 4. 多租户

**问题**: 是否需要按 `tenant_id` 过滤？

**答案**:

- **是，必须按 tenant_id 过滤**
- 默认使用 `default` tenant
- 与现有 API 保持一致

**建议 API 设计**:

```http
# 显式指定 tenant
GET /api/v1/memories/lookup?source_id=xxx&tenant_id=default

# 使用默认 tenant
GET /api/v1/memories/lookup?source_id=xxx
```

**注意**:

- `file_path` 查询必须配合 `project_id` 或 `tenant_id`
- 避免不同项目/租户之间的冲突

---

## 5. 参数优先级

**问题**: 如果同时提供多个参数（如 `source_id` 和 `file_path`），是优先用 `source_id` 还是报错？

**答案**:

- **按优先级使用，不报错**
- 优先级顺序：
  1. `source_id`（最精确）
  2. `hash`（内容唯一）
  3. `file_path` + `project_id`（路径唯一）

**原因**:

- 提供多个参数可能是为了容错
- 优先使用最精确的标识
- 简化客户端逻辑

**建议实现**:

```python
def lookup_memory(source_id=None, file_path=None, project_id=None, hash=None, tenant_id='default'):
    # 按优先级查询
    if source_id:
        return query_by_source_id(source_id, tenant_id)

    if hash:
        return query_by_hash(hash, tenant_id)

    if file_path and project_id:
        return query_by_file_path(file_path, project_id, tenant_id)

    # 如果参数不足
    raise ValueError("Insufficient query parameters. Provide at least one of: source_id, hash, or (file_path + project_id)")
```

---

## 6. 补充：错误处理

**场景 1**: 找到多个（按时间取最新）

```json
{
  "found": true,
  "memory_id": "memory:xyz...",
  "warning": "Multiple memories found, returning the latest"
}
```

**场景 2**: 未找到

```json
{
  "found": false,
  "message": "No memory found matching the query criteria"
}
```

**场景 3**: 参数不足

```json
{
  "error": "Invalid query parameters",
  "message": "Provide at least one of: source_id, hash, or (file_path + project_id)"
}
```

---

## 7. 最终 API 规范

### 请求

```http
GET /api/v1/memories/lookup
  ?source_id=01H1ABC...           # 可选，最优先
  &hash=d41d8cd98f00b204...       # 可选，次优先
  &hash_algorithm=md5             # 可选，默认 md5
  &file_path=src/utils.ts         # 可选，需配合 project_id
  &project_id=my-project          # 可选，使用 file_path 时必需
  &type=code                      # 可选，过滤类型
  &tenant_id=default              # 可选，默认 default
  &limit=1                        # 可选，默认 1
  &all=false                      # 可选，默认 false
```

### 响应（单条）

```json
{
  "found": true,
  "memory_id": "memory:xyz...",
  "source_id": "01H1ABC...",
  "file_path": "src/utils.ts",
  "project_id": "my-project",
  "type": "code",
  "content_hash": "d41d8cd98f00b204...",
  "created_at": "2026-04-09T10:30:00Z",
  "updated_at": "2026-04-09T10:30:00Z"
}
```

### 响应（多条，limit > 1 或 all=true）

```json
{
  "found": true,
  "count": 3,
  "memories": [
    {
      "memory_id": "memory:xyz...",
      "source_id": "01H1ABC...",
      "created_at": "2026-04-09T10:30:00Z"
    }
  ]
}
```

---

## 8. 使用示例

### 场景 1：缓存重建（通过 file_path）

```javascript
// 缓存丢失后重建
const result = await client.lookupMemory({
  file_path: "src/utils.ts",
  project_id: "my-project",
  type: "code",
});

if (result.found) {
  cache.set(result.file_path, result.source_id, result.memory_id);
}
```

### 场景 2：精确查询（通过 source_id）

```javascript
// 多设备同步
const result = await client.lookupMemory({
  source_id: "01H1ABC...",
});
```

### 场景 3：内容去重（通过 hash）

```javascript
// 检查是否已存在
const result = await client.lookupMemory({
  hash: "d41d8cd98f00b204...",
  hash_algorithm: "md5",
});
```

---

如有其他问题，请随时联系。

**前端团队**  
OpenCode Memory Plugin
