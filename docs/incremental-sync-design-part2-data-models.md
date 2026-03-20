# OpenCode Memory Plugin 增量同步方案

## 第二部分：数据模型和API设计

**版本**: v1.0  
**日期**: 2026-03-17  
**状态**: 设计阶段

---

## 1. Checkpoint数据结构

### 1.1 完整定义

```typescript
interface Checkpoint {
  // 核心标识
  record_id: string; // SurrealDB生成的ID，例如：memory:01HQZX...
  local_key: string; // 本地唯一键：file:hash_prefix

  // 内容标识
  source_fingerprint: string; // 稳定内容指纹（去除时间戳后的hash）
  hash: string; // 完整内容hash（包含时间戳）

  // 并发控制
  version: number; // 乐观锁版本号，从1开始

  // 幂等性
  last_op_id: string; // 最后一次操作ID：batch_id:op_index

  // 元数据
  synced_at: number; // 同步时间戳（毫秒）
  deleted: boolean; // 软删除标记
}
```

### 1.2 字段说明

| 字段               | 类型    | 说明              | 示例                                |
| ------------------ | ------- | ----------------- | ----------------------------------- |
| record_id          | string  | SurrealDB记录ID   | `memory:01HQZX9K3M7N8P9Q0R1S2T3U4V` |
| local_key          | string  | 本地文件+内容前缀 | `MEMORY.md:a1b2c3`                  |
| source_fingerprint | string  | 稳定内容指纹      | `sha256:abc123...`                  |
| hash               | string  | 完整内容hash      | `sha256:def456...`                  |
| version            | number  | 版本号（乐观锁）  | `3`                                 |
| last_op_id         | string  | 操作ID（幂等性）  | `batch_uuid_123:5`                  |
| synced_at          | number  | 同步时间戳        | `1710648000000`                     |
| deleted            | boolean | 软删除标记        | `false`                             |

### 1.3 示例数据

```json
{
  "record_id": "memory:01HQZX9K3M7N8P9Q0R1S2T3U4V",
  "local_key": "MEMORY.md:a1b2c3",
  "source_fingerprint": "sha256:abc123def456...",
  "hash": "sha256:def456abc123...",
  "version": 3,
  "last_op_id": "batch_uuid_123:5",
  "synced_at": 1710648000000,
  "deleted": false
}
```

## 2. API请求模型

### 2.1 批量同步请求

```typescript
// POST /api/v1/memories/batch-sync
interface BatchSyncRequest {
  batch_id: string; // UUID，幂等键
  tenant_id: string; // 租户ID
  project_id: string; // 项目ID

  to_add: MemoryEntry[]; // 新增条目（无record_id）
  to_update: MemoryUpdate[]; // 更新条目（含record_id + version）
  to_delete: MemoryDelete[]; // 删除条目（含record_id）
}
```

### 2.2 新增条目模型

```typescript
interface MemoryEntry {
  content: string; // 条目内容
  type: string; // 类型：long-term, daily, preference等
  tags: string[]; // 标签数组
  source_fingerprint: string; // 内容指纹
  hash: string; // 完整hash
  metadata: {
    source_file: string; // 来源文件
    created_at: string; // ISO时间戳
  };
}
```

**示例**：

```json
{
  "content": "User prefers TypeScript for new projects",
  "type": "preference",
  "tags": ["typescript", "code-style"],
  "source_fingerprint": "sha256:abc123...",
  "hash": "sha256:def456...",
  "metadata": {
    "source_file": "MEMORY.md",
    "created_at": "2026-03-17T04:36:14.916Z"
  }
}
```

### 2.3 更新条目模型

```typescript
interface MemoryUpdate {
  record_id: string; // 要更新的记录ID
  expected_version: number; // 期望的版本号（乐观锁）
  content: string; // 新内容
  tags: string[]; // 新标签
  source_fingerprint: string; // 新指纹
  hash: string; // 新hash
}
```

**示例**：

```json
{
  "record_id": "memory:01HQZX9K3M7N8P9Q0R1S2T3U4V",
  "expected_version": 2,
  "content": "User prefers TypeScript and Vue 3 for new projects",
  "tags": ["typescript", "vue3", "code-style"],
  "source_fingerprint": "sha256:new123...",
  "hash": "sha256:new456..."
}
```

### 2.4 删除条目模型

```typescript
interface MemoryDelete {
  record_id: string; // 要删除的记录ID
  reason?: string; // 删除原因（可选）
}
```

**示例**：

```json
{
  "record_id": "memory:01HQZX9K3M7N8P9Q0R1S2T3U4V",
  "reason": "Outdated preference"
}
```

## 3. API响应模型

### 3.1 批量同步响应

```typescript
interface BatchSyncResponse {
  batch_id: string; // 请求的batch_id
  status: "success" | "partial" | "failed";

  results: {
    added: AddResult[]; // 新增结果
    updated: UpdateResult[]; // 更新结果
    deleted: DeleteResult[]; // 删除结果
  };

  summary: {
    total: number; // 总操作数
    succeeded: number; // 成功数
    failed: number; // 失败数
    skipped: number; // 跳过数（重复）
  };

  errors?: ErrorDetail[]; // 错误详情（如果有）
}
```

### 3.2 新增结果模型

```typescript
interface AddResult {
  op_index: number; // 操作索引（对应请求中的位置）
  status: "success" | "failed" | "duplicate";
  record_id?: string; // 成功时返回
  version?: number; // 成功时返回（初始为1）
  error?: string; // 失败时返回
}
```

**成功示例**：

```json
{
  "op_index": 0,
  "status": "success",
  "record_id": "memory:01HQZX9K3M7N8P9Q0R1S2T3U4V",
  "version": 1
}
```

**重复示例**：

```json
{
  "op_index": 1,
  "status": "duplicate",
  "error": "Hash already exists"
}
```

### 3.3 更新结果模型

```typescript
interface UpdateResult {
  op_index: number;
  record_id: string;
  status: "success" | "failed" | "conflict";
  new_version?: number; // 成功时返回
  error?: string; // 失败或冲突时返回
}
```

**成功示例**：

```json
{
  "op_index": 0,
  "record_id": "memory:01HQZX9K3M7N8P9Q0R1S2T3U4V",
  "status": "success",
  "new_version": 3
}
```

**冲突示例**：

```json
{
  "op_index": 1,
  "record_id": "memory:01HR...",
  "status": "conflict",
  "error": "Version mismatch: expected 2, got 3"
}
```

### 3.4 删除结果模型

```typescript
interface DeleteResult {
  op_index: number;
  record_id: string;
  status: "success" | "failed" | "not_found";
  error?: string;
}
```

**成功示例**：

```json
{
  "op_index": 0,
  "record_id": "memory:01HQZX9K3M7N8P9Q0R1S2T3U4V",
  "status": "success"
}
```

## 4. 数据库Schema

### 4.1 SurrealDB Memory表

```sql
-- 更新memory表
ALTER TABLE memory ADD COLUMN version INT DEFAULT 1;
ALTER TABLE memory ADD COLUMN last_op_id STRING;
ALTER TABLE memory ADD COLUMN source_fingerprint STRING;

-- 创建索引
DEFINE INDEX idx_memory_fingerprint ON TABLE memory COLUMNS source_fingerprint;
DEFINE INDEX idx_memory_version ON TABLE memory COLUMNS version;
DEFINE INDEX idx_memory_hash ON TABLE memory COLUMNS hash;
```

### 4.2 SurrealDB Outbox表

```sql
-- 创建Outbox表
DEFINE TABLE outbox SCHEMAFULL;
DEFINE FIELD id ON TABLE outbox TYPE record;
DEFINE FIELD action ON TABLE outbox TYPE string
  ASSERT $value IN ['create', 'update', 'delete'];
DEFINE FIELD record_id ON TABLE outbox TYPE string;
DEFINE FIELD data ON TABLE outbox TYPE object;
DEFINE FIELD status ON TABLE outbox TYPE string
  ASSERT $value IN ['pending', 'processing', 'completed', 'failed'];
DEFINE FIELD retry_count ON TABLE outbox TYPE int DEFAULT 0;
DEFINE FIELD created_at ON TABLE outbox TYPE datetime;
DEFINE FIELD processed_at ON TABLE outbox TYPE datetime;
DEFINE FIELD error ON TABLE outbox TYPE string;

-- 创建索引
DEFINE INDEX idx_outbox_status ON TABLE outbox COLUMNS status;
DEFINE INDEX idx_outbox_created ON TABLE outbox COLUMNS created_at;
```

### 4.3 SurrealDB Idempotency表（修复P1-2）

```sql
-- 幂等性表
DEFINE TABLE idempotency SCHEMAFULL;
DEFINE FIELD batch_id ON TABLE idempotency TYPE string;
DEFINE FIELD status ON TABLE idempotency TYPE string
    ASSERT $value IN ['processing', 'completed', 'failed'];
DEFINE FIELD created_at ON TABLE idempotency TYPE datetime DEFAULT time::now();
DEFINE FIELD completed_at ON TABLE idempotency TYPE datetime;
DEFINE FIELD result ON TABLE idempotency TYPE object;
DEFINE FIELD error ON TABLE idempotency TYPE string;

-- 唯一索引（幂等性保证）
DEFINE INDEX idx_batch_id ON TABLE idempotency COLUMNS batch_id UNIQUE;

-- 时间索引（用于清理）
DEFINE INDEX idx_created_at ON TABLE idempotency COLUMNS created_at;
```

**说明**：使用SurrealDB的UNIQUE索引替代Redis，实现零外部依赖。

### 4.4 已废弃：Redis幂等性存储

**注意**：设计已更新，使用SurrealDB idempotency表替代Redis。保留此章节用于历史参考。

```
旧方案（已废弃）：
Key格式: batch_sync:idempotency:{batch_id}
Value: "processing" | "completed"
TTL: 86400秒（24小时）
```

**新方案优势**：
- 零额外依赖（无需Redis）
- 事务一致性（与Memory表同一数据库）
- 自动清理（通过SurrealDB查询）

## 5. 配置扩展

### 5.1 memory-config.json扩展

```json
{
  "version": "2.0.0",
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "default",
    "timeout": 30000
  },
  "sync": {
    "mode": "incremental",
    "enabled": true,
    "batch_size": 20,
    "auto_sync": false,
    "daily_days_limit": 30,
    "checkpoint_compact_threshold": 1048576
  },
  "search": {
    "mode": "hybrid"
  }
}
```

### 5.2 配置字段说明

| 字段                              | 类型    | 默认值        | 说明                              |
| --------------------------------- | ------- | ------------- | --------------------------------- |
| sync.mode                         | string  | "incremental" | 同步模式："incremental" \| "full" |
| sync.enabled                      | boolean | true          | 是否启用同步                      |
| sync.batch_size                   | number  | 20            | 批量大小                          |
| sync.auto_sync                    | boolean | false         | 是否自动同步                      |
| sync.daily_days_limit             | number  | 30            | daily日志天数限制                 |
| sync.checkpoint_compact_threshold | number  | 1048576       | checkpoint压缩阈值（字节）        |

---

**下一部分**：核心算法和实现
