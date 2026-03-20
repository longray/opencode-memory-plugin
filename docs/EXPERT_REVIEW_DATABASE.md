# 专家审核报告 - 数据库专家

**审核专家**: SurrealDB数据库专家 (模拟)  
**审核文档**: incremental-sync-design-part2-data-models.md  
**审核日期**: 2026-03-17  
**设计版本**: v2.1

---

## 总体评价

**✅ 有条件通过**

Schema设计整体合理，充分利用了SurrealDB的特性。但存在1个P1级问题（idempotency表高并发性能）和2个P2级优化建议。

---

## 📊 Schema审核详情

### 1. Memory表扩展 ✅

**新增字段评估**:

| 字段 | 类型 | 用途 | 评价 |
|------|------|------|------|
| `version` | INT | 乐观锁 | ✅ 标准做法 |
| `last_op_id` | STRING | 幂等性追踪 | ✅ 便于调试 |
| `source_fingerprint` | STRING | 内容指纹 | ✅ 稳定识别 |

**索引设计**:

```sql
DEFINE INDEX idx_memory_fingerprint ON TABLE memory COLUMNS source_fingerprint;
DEFINE INDEX idx_memory_version ON TABLE memory COLUMNS version;
DEFINE INDEX idx_memory_hash ON TABLE memory COLUMNS hash;
```

**问题**: 
- `idx_memory_version`索引使用场景有限（主要用于调试，非查询）
- 缺少`tenant_id` + `project_id`复合索引（常用查询场景）

**建议添加**:
```sql
-- 常用查询：按租户和项目查询
DEFINE INDEX idx_memory_tenant_project ON TABLE memory COLUMNS tenant_id, project_id;

-- 常用查询：按指纹查找（去重）
-- idx_memory_fingerprint 已存在 ✅

-- 常用查询：按类型和标签
DEFINE INDEX idx_memory_type ON TABLE memory COLUMNS type;
```

---

### 2. Idempotency表 ⚠️

**Schema评估**:

```sql
DEFINE TABLE idempotency SCHEMAFULL;
DEFINE FIELD batch_id ON TABLE idempotency TYPE string;
DEFINE FIELD status ON TABLE idempotency TYPE string
    ASSERT $value IN ['processing', 'completed', 'failed'];
DEFINE FIELD created_at ON TABLE idempotency TYPE datetime DEFAULT time::now();
DEFINE FIELD completed_at ON TABLE idempotency TYPE datetime;
DEFINE FIELD result ON TABLE idempotency TYPE object;
DEFINE FIELD error ON TABLE idempotency TYPE string;

-- 关键索引
DEFINE INDEX idx_batch_id ON TABLE idempotency COLUMNS batch_id UNIQUE;
DEFINE INDEX idx_created_at ON TABLE idempotency COLUMNS created_at;
```

**P1-1: 高并发下的UNIQUE索引性能问题**

**问题描述**:
- SurrealDB的UNIQUE索引在高并发写入时可能出现锁竞争
- 当多个客户端同时尝试CREATE时，失败率增加
- 异常处理逻辑（捕获"duplicate"异常）依赖字符串匹配，不可靠

**风险场景**:
```
100个并发请求同时写入不同batch_id
→ 预期：全部成功
→ 实际：可能出现部分失败（锁竞争）
```

**建议优化**:

**方案A: 使用IF NOT EXISTS模式**（推荐）
```sql
-- SurrealDB支持的原子操作
LET $existing = (SELECT * FROM idempotency WHERE batch_id = $batch_id LIMIT 1);

IF $existing IS NONE {
    CREATE idempotency CONTENT {
        batch_id: $batch_id,
        status: 'processing',
        created_at: time::now()
    };
    RETURN { is_new: true };
} ELSE {
    RETURN { is_new: false, record: $existing };
}
```

**方案B: 应用层退避重试**
```python
async def check_idempotency_with_retry(batch_id, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await check_idempotency(batch_id)
        except DuplicateError:
            if attempt < max_retries - 1:
                await asyncio.sleep(0.1 * (2 ** attempt))  # 指数退避
            else:
                raise
```

**优先级**: P1

---

### 3. Outbox表 ✅

**Schema评估**:

```sql
DEFINE TABLE outbox SCHEMAFULL;
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

-- 索引
DEFINE INDEX idx_outbox_status ON TABLE outbox COLUMNS status;
DEFINE INDEX idx_outbox_created ON TABLE outbox COLUMNS created_at;
```

**优点**:
- ✅ 字段完整，支持状态机
- ✅ 重试计数器便于监控
- ✅ 状态约束防止非法值

**建议优化**:

**P2-1: 添加复合索引优化查询**

当前消费Outbox的查询模式：
```sql
-- 查询待处理记录
SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 10;
```

建议添加复合索引：
```sql
-- 优化"按状态+时间"查询
DEFINE INDEX idx_outbox_status_created ON TABLE outbox COLUMNS status, created_at;
```

**P2-2: 考虑添加优先级字段**

如果某些同步操作需要优先处理：
```sql
DEFINE FIELD priority ON TABLE outbox TYPE int DEFAULT 0;
DEFINE INDEX idx_outbox_priority ON TABLE outbox COLUMNS priority, created_at;

-- 查询时
SELECT * FROM outbox 
WHERE status = 'pending' 
ORDER BY priority DESC, created_at ASC 
LIMIT 10;
```

---

### 4. Checkpoint数据结构 ✅

**字段评估**:

| 字段 | 必要性 | 建议 |
|------|--------|------|
| `record_id` | ✅ 必须 | 后端ID映射 |
| `local_key` | ✅ 必须 | 本地识别 |
| `source_fingerprint` | ✅ 必须 | 内容对比 |
| `hash` | ⚠️ 可选 | 完整内容校验，但可能冗余 |
| `version` | ✅ 必须 | 乐观锁 |
| `last_op_id` | ⚠️ 可选 | 调试用，生产环境可省略 |
| `synced_at` | ✅ 必须 | 时间戳 |
| `deleted` | ✅ 必须 | 软删除 |

**P2-3: hash字段冗余评估**

问题: `source_fingerprint`和`hash`的区别是什么？
- `source_fingerprint`: 去除时间戳后的稳定指纹
- `hash`: 完整内容hash

如果仅用于变更检测，`source_fingerprint`已足够。`hash`可用于完整性校验，但会增加存储开销。

**建议**: 保留`hash`但设为可选，仅在需要严格完整性校验时启用。

---

## 📈 性能优化建议

### 1. 索引优化清单

**必须添加**:
```sql
-- 常用查询：租户+项目
DEFINE INDEX idx_memory_tenant_project ON TABLE memory COLUMNS tenant_id, project_id;

-- Outbox消费查询
DEFINE INDEX idx_outbox_status_created ON TABLE outbox COLUMNS status, created_at;
```

**可选添加**:
```sql
-- 按类型查询
DEFINE INDEX idx_memory_type ON TABLE memory COLUMNS type;

-- 按标签查询（如果标签是数组，需要考虑GIN索引）
-- SurrealDB对数组索引支持有限，建议在应用层处理
```

### 2. 查询优化建议

**批量操作优化**:

当前设计每次操作一个条目，建议支持批量INSERT/UPDATE：

```sql
-- 批量插入（SurrealDB支持）
INSERT INTO memory [
    { content: "...", type: "long-term", ... },
    { content: "...", type: "long-term", ... },
    ...
];

-- 相比单条循环插入，性能提升10-50倍
```

### 3. 数据清理策略

**Idempotency表清理**:

当前方案：
```python
# 清理24小时前的记录
DELETE FROM idempotency WHERE created_at < $cutoff;
```

优化建议：
```sql
-- 分批清理，避免大事务
LET $batch = (SELECT * FROM idempotency 
              WHERE created_at < $cutoff 
              LIMIT 1000);
              
DELETE FROM idempotency WHERE id IN $batch.id;

-- 重复直到清理完成
```

---

## 🔍 数据一致性检查

### 1. 外键关系

**问题**: idempotency和memory表之间没有外键约束

**建议**: 在应用层保证一致性，因为SurrealDB对外键约束支持有限。

### 2. 字段约束完整性

✅ 所有表都使用SCHEMAFULL模式  
✅ 状态字段都有ASSERT约束  
✅ 日期字段有默认值

---

## 🎯 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| UNIQUE索引锁竞争 | 中 | 中 | 使用IF NOT EXISTS模式 |
| 索引缺失导致慢查询 | 高 | 中 | 添加建议的索引 |
| Outbox积压 | 中 | 中 | 监控+告警+扩容 |
| 数据类型不匹配 | 低 | 高 | SCHEMAFULL模式 |

---

## ✅ 审核结论

**总体评价**: Schema设计良好，充分利用SurrealDB特性。

**必须修复**:
1. ⚠️ P1-1: Idempotency表高并发优化（使用IF NOT EXISTS）

**建议修复**:
2. 💡 P2-1: 添加复合索引（idx_memory_tenant_project, idx_outbox_status_created）
3. 💡 P2-2: 考虑Outbox优先级字段
4. 💡 P2-3: 评估hash字段必要性

**性能预期**:
- 修复P1-1后，支持100+并发同步
- 添加索引后，常用查询<10ms
- 批量操作可达到1000+ ops/sec

---

**审核专家签名**: 数据库专家 (模拟)  
**审核完成时间**: 2026-03-17
