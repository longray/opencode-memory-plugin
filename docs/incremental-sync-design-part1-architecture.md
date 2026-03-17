# OpenCode Memory Plugin 增量同步方案

## 第一部分：系统架构设计

**版本**: v1.0  
**日期**: 2026-03-17  
**状态**: 设计阶段

---

## 1. 架构概览

### 1.1 系统组件图

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Plugin                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ rebuild_index│  │ SyncManager  │  │  Checkpoint  │     │
│  │    Tool      │──│              │──│   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                │
│                    ┌───────▼────────┐                       │
│                    │ WrapperClient  │                       │
│                    └───────┬────────┘                       │
└────────────────────────────┼──────────────────────────────┘
                             │ HTTP/JSON
                             │
┌────────────────────────────▼──────────────────────────────┐
│                  Backend Service (FastAPI)                 │
│  ┌──────────────────────────────────────────────────────┐ │
│  │         POST /api/v1/memories/batch-sync             │ │
│  └────────────────────┬─────────────────────────────────┘ │
│                       │                                    │
│  ┌────────────────────▼─────────────────────────────────┐ │
│  │           MemoryManager.batch_sync_memories()        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │ │
│  │  │  Idempotency │  │  Concurrency │  │  Outbox   │  │ │
│  │  │    Check     │  │   Control    │  │  Pattern  │  │ │
│  │  └──────────────┘  └──────────────┘  └───────────┘  │ │
│  └──────────────────────┬───────────────────────────────┘ │
│                         │                                  │
│         ┌───────────────┴───────────────┐                 │
│         │                               │                 │
│  ┌──────▼────────┐             ┌────────▼────────┐       │
│  │   SurrealDB   │             │  Meilisearch    │       │
│  │  (主存储)      │             │  (全文搜索)      │       │
│  │  - 向量搜索    │             │  - 中文分词      │       │
│  │  - 图关系      │             │  - 特殊格式      │       │
│  └───────────────┘             └─────────────────┘       │
└───────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **后端生成ID**：SurrealDB生成ULID格式的record_id，插件端存储
2. **操作分离**：显式CREATE/UPDATE/DELETE，避免混合UPSERT
3. **单一事务**：所有操作在一个SurrealDB事务中完成
4. **幂等性保证**：batch_id + op_id防止重复执行
5. **乐观锁**：version字段防止并发冲突
6. **最终一致性**：Outbox模式保证跨存储一致性

### 1.3 数据流向

**增量同步流程**：

```
1. Plugin读取本地文件 → 解析所有条目
2. 加载Checkpoint → 对比差异
3. 识别变更：to_add / to_update / to_delete
4. 调用batch-sync API → 后端处理
5. 后端返回record_id → 更新Checkpoint
6. 完成同步
```

**写入流程**：

```
Plugin → Checkpoint → WrapperClient → Backend API
                                          ↓
                                    Idempotency Check
                                          ↓
                                    SurrealDB Transaction
                                          ↓
                                    Outbox Queue
                                          ↓
                                    Meilisearch Sync
                                          ↓
                                    Update Checkpoint
```

**读取流程（搜索）**：

```
Plugin → WrapperClient → Backend API
                              ↓
                        Hybrid Search
                        ↙          ↘
                  SurrealDB      Meilisearch
                  (Vector)       (Keyword)
                        ↘          ↙
                        Merge Results
                              ↓
                          Return
```

## 2. 关键技术决策

### 2.1 ID生成策略

**决策**：SurrealDB生成record_id，插件端记录

**理由**：

- SurrealDB的ULID保证全局唯一性和时间排序
- 避免插件端生成ID的冲突风险
- 简化分布式环境下的ID管理

**实现**：

```python
# 后端：CREATE时自动生成
result = await db.create("memory", content)
record_id = result["id"]  # 例如：memory:01HQZX9K3M7N8P9Q0R1S2T3U4V

# 返回给插件
return {"record_id": record_id, ...}
```

```javascript
// 插件：存储到checkpoint
checkpoint.record_id = response.record_id;
await saveCheckpoint(checkpoint);
```

### 2.2 操作分离 vs 混合UPSERT

**决策**：显式分离CREATE/UPDATE/DELETE

**对比**：

| 方案       | 优点               | 缺点                 |
| ---------- | ------------------ | -------------------- |
| 混合UPSERT | 代码简洁           | 逻辑不清晰，难以优化 |
| 显式分离   | 逻辑清晰，性能最优 | 代码稍长             |

**选择理由**：

- 插件端已知操作类型（通过checkpoint对比）
- 显式分离便于添加不同的业务逻辑（如去重仅在CREATE时）
- 性能更好（避免UPSERT的内部判断）

### 2.3 Checkpoint存储格式

**决策**：JSONL格式（追加写入）

**理由**：

- 追加写入避免全文件重写
- 崩溃恢复：最后一行可能损坏，其他行完整
- 易于压缩和归档

**格式**：

```jsonl
{"record_id":"memory:01HQ...","local_key":"MEMORY.md:a1b2c3","version":1,"hash":"abc123...","synced_at":1710648000000}
{"record_id":"memory:01HR...","local_key":"daily/2026-03-16.md:d4e5f6","version":1,"hash":"def456...","synced_at":1710648001000}
```

**压缩策略**：

- 当文件 > 1MB 时，重写为紧凑格式
- 移除deleted=true的条目（保留最近7天）
- 按local_key排序，便于二分查找

## 3. 性能目标

### 3.1 性能指标

| 指标     | 当前（全量） | 目标（增量） | 提升     |
| -------- | ------------ | ------------ | -------- |
| 同步延迟 | 2000ms       | 50-100ms     | 20倍     |
| 网络请求 | N次          | 1次          | N倍      |
| 数据传输 | 全量         | 变更量       | 10-100倍 |

### 3.2 扩展性

- 支持10,000+条记忆
- 支持100+个daily日志文件
- 批量大小可配置（默认20条）
- 支持并发同步（多项目）

## 4. 安全性和可靠性

### 4.1 数据安全

- **原子写入**：Checkpoint使用临时文件+原子替换
- **备份机制**：写入前自动备份现有checkpoint
- **校验和**：可选的文件完整性校验
- **软删除**：删除操作标记deleted=true，保留7天

### 4.2 容错机制

- **幂等性**：batch_id防止重复执行
- **乐观锁**：version字段防止并发冲突
- **部分成功**：区分成功/失败条目，不全盘回滚
- **自动重试**：失败的操作加入重试队列

### 4.3 删除保护

- **阈值检查**：删除超过20%或50条时需确认
- **软删除**：标记deleted=true而非物理删除
- **保留期**：软删除记录保留7天
- **恢复机制**：可从checkpoint恢复误删数据

---

**下一部分**：数据模型和API设计
