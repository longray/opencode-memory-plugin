# 现有代码 vs 设计文档 - 数据模型对比分析

**分析日期**: 2026-03-17  
**分析范围**: 后端、插件端、设计文档

---

## 1. 记忆条目模型对比

### 1.1 现有后端模型（MemoryItem）

```python
class MemoryItem(BaseModel):
    # 核心字段
    content: str                          # ✅ 必需
    type: str = "general"                 # ✅ 默认值
    tags: list[str] = []                  # ✅ 默认值

    # 多租户/项目隔离
    project_id: str = "global"            # ✅ 默认值

    # 来源标识
    source: str = "api"                   # ✅ 默认值

    # 元数据（灵活结构）
    metadata: dict[str, Any] = {}         # ✅ 默认值，任意字段

    # 可选字段
    source_id: str | None = None          # ✅ 可选，用于去重
    source_timestamp: str | None = None   # ✅ 可选
    classification_confidence: float | None = None  # ✅ 可选
```

### 1.2 后端存储层添加的字段

```python
# memory_manager.py 在上传时自动添加
memory_data = {
    ...MemoryItem字段,
    "content_hash": str,        # ✅ MD5哈希，快速去重
    "embedding": list[float],   # ✅ 向量（1024维），语义搜索
    "tenant_id": str,           # ✅ 租户ID，多租户隔离
}
```

### 1.3 设计文档中的模型（MemoryEntry）

```typescript
interface MemoryEntry {
  content: string; // ✅ 有
  type: string; // ✅ 有
  tags: string[]; // ✅ 有
  source_fingerprint: string; // ❌ 新增，现有没有
  hash: string; // ❌ 新增，现有没有
  metadata: {
    // ⚠️ 结构冲突
    source_file: string;
    created_at: string;
  };
}
```

---

## 2. 字段差异详细分析

### 2.1 设计文档缺失的必需字段

| 字段           | 用途       | 影响等级    | 说明                           |
| -------------- | ---------- | ----------- | ------------------------------ |
| `embedding`    | 向量搜索   | ❌ **严重** | 无法进行语义搜索，核心功能丧失 |
| `tenant_id`    | 多租户隔离 | ❌ **严重** | 数据混乱，安全风险             |
| `project_id`   | 项目隔离   | ❌ **严重** | 无法区分不同项目的记忆         |
| `content_hash` | 快速去重   | ⚠️ **重要** | 去重性能下降，依赖语义搜索     |
| `source`       | 来源标识   | ⚠️ **重要** | 无法区分api/plugin来源         |

### 2.2 设计文档新增的字段

| 字段                 | 用途         | 与现有字段关系              |
| -------------------- | ------------ | --------------------------- |
| `source_fingerprint` | 稳定内容指纹 | 🆕 新增，用于重建checkpoint |
| `hash`               | 完整hash     | ⚠️ 与现有`content_hash`冲突 |

**问题**：

- 现有使用 `content_hash`（MD5）
- 设计文档使用 `hash`（SHA256）
- 两者功能重叠但算法不同

### 2.3 metadata 结构冲突

**现有模型**：

```python
metadata: dict[str, Any] = {}  # 灵活结构，任意字段
```

**示例**：

```json
{
  "source_file": "MEMORY.md",
  "created_at": "2026-03-17...",
  "written_at": "2026-03-17...",
  "custom_field": "value",
  "nested": { "key": "value" }
}
```

**设计文档**：

```typescript
metadata: {
  source_file: string; // 固定字段
  created_at: string; // 固定字段
}
```

**冲突**：

- 现有：灵活，支持任意字段
- 设计：固定，只有两个字段
- **影响**：限制了元数据的扩展性

### 2.4 可选字段丢失

| 字段                        | 用途           | 影响              |
| --------------------------- | -------------- | ----------------- |
| `source_id`                 | 外部系统集成   | ⚠️ 插件端用于去重 |
| `source_timestamp`          | 保留原始时间戳 | ℹ️ 可选功能       |
| `classification_confidence` | AI分类置信度   | ℹ️ 可选功能       |

---

## 3. 批量同步请求模型对比

### 3.1 现有模型（MemoryUploadRequest）

```python
class MemoryUploadRequest(BaseModel):
    memories: list[MemoryItem]   # 记忆列表
    tenant_id: str = "default"   # 租户ID
```

**特点**：

- 简单的批量上传
- 只支持新增（CREATE）
- 无更新/删除操作

### 3.2 设计文档模型（BatchSyncRequest）

```typescript
interface BatchSyncRequest {
  batch_id: string; // ❌ 新增：幂等键
  tenant_id: string; // ✅ 有
  project_id: string; // ❌ 新增：项目ID

  to_add: MemoryEntry[]; // ❌ 新增：新增操作
  to_update: MemoryUpdate[]; // ❌ 新增：更新操作
  to_delete: MemoryDelete[]; // ❌ 新增：删除操作
}
```

**差异**：

- 设计文档支持三种操作（CREATE/UPDATE/DELETE）
- 现有只支持CREATE
- 设计文档添加了幂等性支持（batch_id）
- 设计文档添加了project_id（现有在MemoryItem中）

---

## 4. 更新/删除模型（现有缺失）

### 4.1 MemoryUpdate（设计文档）

```typescript
interface MemoryUpdate {
  record_id: string; // 要更新的记录ID
  expected_version: number; // 乐观锁版本号
  content: string;
  tags: string[];
  source_fingerprint: string;
  hash: string;
}
```

**现有状态**：❌ 完全缺失，无更新API

### 4.2 MemoryDelete（设计文档）

```typescript
interface MemoryDelete {
  record_id: string; // 要删除的记录ID
  reason?: string; // 删除原因
}
```

**现有状态**：❌ 完全缺失，无删除API

---

## 5. Checkpoint模型（设计文档新增）

```typescript
interface Checkpoint {
  record_id: string; // SurrealDB ID
  local_key: string; // 本地唯一键
  source_fingerprint: string; // 稳定指纹
  hash: string; // 完整hash
  version: number; // 乐观锁
  last_op_id: string; // 幂等性
  synced_at: number; // 同步时间
  deleted: boolean; // 软删除标记
}
```

**现有状态**：❌ 完全缺失，无checkpoint机制

---

## 6. 关键问题总结

### 6.1 严重问题（P0）

| 问题                           | 影响         | 建议                 |
| ------------------------------ | ------------ | -------------------- |
| 设计文档缺少 `embedding` 字段  | 无法语义搜索 | **必须添加**         |
| 设计文档缺少 `tenant_id` 字段  | 多租户混乱   | **必须添加**         |
| 设计文档缺少 `project_id` 字段 | 项目隔离失效 | **必须添加**         |
| metadata 结构冲突              | 扩展性受限   | **必须改为灵活结构** |

### 6.2 重要问题（P1）

| 问题                              | 影响         | 建议           |
| --------------------------------- | ------------ | -------------- |
| `hash` vs `content_hash` 命名冲突 | 混淆         | 统一命名       |
| 缺少 `source` 字段                | 无法区分来源 | 添加到设计文档 |
| 缺少可选字段                      | 功能受限     | 添加到设计文档 |

### 6.3 设计问题（P2）

| 问题               | 影响             | 建议               |
| ------------------ | ---------------- | ------------------ |
| 现有无更新/删除API | 无法增量同步     | 实现新API          |
| 现有无checkpoint   | 无法追踪同步状态 | 实现checkpoint     |
| 现有无version字段  | 无并发控制       | 添加到数据库schema |

---

## 7. 修正建议

### 7.1 修正后的 MemoryEntry

```typescript
interface MemoryEntry {
  // 核心内容
  content: string;
  type: string;
  tags: string[];

  // 指纹和哈希
  source_fingerprint: string; // 新增：稳定指纹
  content_hash: string; // 保留：MD5快速去重

  // 多租户和项目
  tenant_id: string; // 保留：必需
  project_id: string; // 保留：必需

  // 向量
  embedding: number[]; // 保留：必需

  // 来源
  source: string; // 保留：必需

  // 元数据（灵活结构）
  metadata: {
    [key: string]: any; // 允许任意字段
  };

  // 可选字段
  source_id?: string;
  source_timestamp?: string;
  classification_confidence?: number;
}
```

### 7.2 修正后的 BatchSyncRequest

```typescript
interface BatchSyncRequest {
  batch_id: string;
  tenant_id: string;
  project_id: string;

  to_add: MemoryEntry[]; // 使用修正后的模型
  to_update: MemoryUpdate[];
  to_delete: MemoryDelete[];
}
```

---

**下一部分**：API接口对比分析
