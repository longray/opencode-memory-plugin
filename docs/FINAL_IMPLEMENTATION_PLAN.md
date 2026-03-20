# 增量同步 - 最终实施方案

**决策时间**: 2026-03-17  
**决策依据**: 三位专家审核意见  
**方案版本**: v1.0

---

## 🎯 决策结果

**选定方案**: 方案A - 完整修复（P0 + 关键P1）

**理由**:
1. P0问题是数据一致性问题，不修复会影响数据安全
2. 10-13小时投入相对于项目重要性而言合理
3. 避免生产环境问题导致返工
4. 建立高质量代码基础

---

## 📋 实施范围

### 阶段1: P0修复（必须）- 5小时

| # | 问题 | 文件 | 修复内容 | 工时 |
|---|------|------|----------|------|
| 1 | 批量事务边界 | part3-algorithms.md | 添加显式事务包装 | 2h |
| 2 | Checkpoint竞态 | part1-architecture.md | 添加版本控制机制 | 3h |

### 阶段2: 关键P1修复（强烈建议）- 5小时

| # | 问题 | 文件 | 修复内容 | 工时 |
|---|------|------|----------|------|
| 3 | TOCTOU竞态 | part3-algorithms.md | 原子插入-查询 | 1h |
| 4 | Processing超时 | part3-algorithms.md | 5分钟超时逻辑 | 1h |
| 5 | 复合索引 | part2-data-models.md | 添加idx_memory_tenant_project等 | 1h |
| 6 | Idempotency优化 | part3-algorithms.md | IF NOT EXISTS模式 | 2h |

### 阶段3: 监控P1修复（建议）- 3小时

| # | 问题 | 文件 | 修复内容 | 工时 |
|---|------|------|----------|------|
| 7 | 监控设计 | part1-architecture.md | 添加Metrics和Tracing设计 | 2h |
| 8 | 多客户端协调 | part3-algorithms.md | 文件锁或后端协调设计 | 1h |

**总工时**: 13小时

---

## 🗓️ 实施计划

### Week 1: 修复阶段

**Day 1 (5小时)**
- 上午: 修复P0-1 批量事务边界
- 下午: 修复P0-2 Checkpoint版本控制
- 晚间: 代码审查和测试

**Day 2 (5小时)**
- 上午: 修复P1-1 TOCTOU + P1-2 Processing超时
- 下午: 修复P1-4 复合索引 + P1-5 Idempotency优化
- 晚间: 集成测试

**Day 3 (3小时)**
- 上午: P1-6 监控设计
- 下午: P1-3 多客户端协调（简化版）
- 晚间: 最终审查

### Week 2: 实施阶段

**Day 4-5 (后端开发)**
- 批量同步API实现
- 事务和并发控制实现
- 单元测试

**Day 6-7 (插件开发)**
- SyncManager实现
- CheckpointManager实现
- 集成测试

**Day 8 (测试和优化)**
- 集成测试
- 性能测试
- Bug修复

**Day 9-10 (文档和发布)**
- 文档更新
- 发布准备
- 灰度发布

---

## 🛠️ 技术实现细节

### 1. 批量事务边界修复

**修改文件**: `incremental-sync-design-part3-algorithms.md` 第7章

**当前代码**:
```python
async def update_memory(entry, expected_version):
    result = await db.query("""
        UPDATE memories ... WHERE version = $expected_version
    """)
    if not result:
        raise VersionConflictError(...)
```

**修复后代码**:
```python
async def batch_sync_memories(operations, batch_id):
    """所有操作在一个事务中完成"""
    async with db.transaction() as tx:
        results = {"succeeded": [], "failed": [], "conflicts": []}
        
        for op in operations:
            try:
                if op["action"] == "UPDATE":
                    result = await update_memory(
                        op["entry"], 
                        op["expected_version"], 
                        tx=tx  # 传递事务上下文
                    )
                    results["succeeded"].append(result)
            except VersionConflictError as e:
                results["conflicts"].append({"op": op, "error": str(e)})
                # 继续处理其他操作，不中止事务
        
        await tx.commit()
    return results

async def update_memory(entry, expected_version, tx=None):
    """支持事务上下文"""
    db_context = tx if tx else db
    result = await db_context.query("""
        UPDATE memories
        SET content = $content,
            version = version + 1,
            updated_at = time::now()
        WHERE source_fingerprint = $fp
          AND version = $expected_version
        RETURN AFTER
    """, {...})
    
    if not result or len(result) == 0:
        raise VersionConflictError(f"Version conflict: expected {expected_version}")
    
    return result[0]
```

---

### 2. Checkpoint版本控制修复

**修改文件**: `incremental-sync-design-part1-architecture.md` 第2.3节

**新增内容**:

```typescript
// Checkpoint增加版本控制
interface CheckpointFile {
  metadata: {
    version: number;        // 文件版本号，每次更新递增
    updated_at: number;     // 更新时间戳
    checksum: string;       // 内容校验和
  };
  entries: Checkpoint[];    // 原checkpoint条目数组
}

// 原子写入实现
async function saveCheckpointAtomic(checkpoint: Checkpoint[]) {
  const tempPath = `${this.checkpointPath}.tmp`;
  const backupPath = `${this.checkpointPath}.backup`;
  
  try {
    // 1. 读取当前版本
    const current = await this.loadCheckpoint();
    const currentVersion = current.metadata?.version || 0;
    
    // 2. 构建新版本
    const newCheckpoint: CheckpointFile = {
      metadata: {
        version: currentVersion + 1,
        updated_at: Date.now(),
        checksum: calculateChecksum(checkpoint)
      },
      entries: checkpoint
    };
    
    // 3. 写入临时文件
    await fs.writeFile(tempPath, JSON.stringify(newCheckpoint), 'utf8');
    
    // 4. 备份现有文件
    if (await this.fileExists(this.checkpointPath)) {
      await fs.copyFile(this.checkpointPath, backupPath);
    }
    
    // 5. 验证版本未变化（双重检查）
    const verify = await this.loadCheckpoint();
    if (verify.metadata?.version !== currentVersion) {
      throw new Error(`Checkpoint版本冲突: 期望${currentVersion}, 实际${verify.metadata?.version}`);
    }
    
    // 6. 原子替换
    await fs.rename(tempPath, this.checkpointPath);
    
    // 7. 删除备份
    if (await this.fileExists(backupPath)) {
      await fs.unlink(backupPath);
    }
    
    return { version: newCheckpoint.metadata.version };
    
  } catch (error) {
    // 恢复备份
    if (await this.fileExists(backupPath)) {
      await fs.copyFile(backupPath, this.checkpointPath);
    }
    throw error;
  }
}
```

---

### 3. Idempotency优化（IF NOT EXISTS模式）

**修改文件**: `incremental-sync-design-part3-algorithms.md` 第8章

**修复后代码**:

```python
async def check_idempotency(batch_id: str, db) -> tuple[bool, dict]:
    """
    使用IF NOT EXISTS模式避免TOCTOU竞态
    """
    result = await db.query("""
        BEGIN TRANSACTION;
        
        -- 先查询
        LET $existing = (SELECT * FROM idempotency WHERE batch_id = $batch_id LIMIT 1);
        
        -- 如果不存在，插入
        IF $existing IS NONE {
            CREATE idempotency CONTENT {
                batch_id: $batch_id,
                status: 'processing',
                created_at: time::now(),
                result: null,
                error: null
            };
            RETURN { is_new: true, record: null };
        } ELSE {
            -- 已存在，返回现有记录
            RETURN { is_new: false, record: $existing };
        };
        
        COMMIT TRANSACTION;
    """, {"batch_id": batch_id})
    
    if result["is_new"]:
        return True, None  # 新请求
    else:
        record = result["record"]
        if record["status"] == "completed":
            return False, record["result"]  # 已完成，返回缓存结果
        elif record["status"] == "processing":
            # 检查是否卡住
            elapsed = datetime.utcnow() - record["created_at"]
            if elapsed > timedelta(minutes=5):
                # 超时，允许重试
                await db.query("""
                    UPDATE idempotency
                    SET status = 'failed',
                        error = 'Timeout: processing exceeded 5 minutes'
                    WHERE batch_id = $batch_id
                """, {"batch_id": batch_id})
                return True, None
            else:
                return False, {"error": "Batch currently processing"}
        elif record["status"] == "failed":
            return True, None  # 失败，允许重试
        
    return True, None
```

---

### 4. 复合索引添加

**修改文件**: `incremental-sync-design-part2-data-models.md` 第4章

**新增索引**:

```sql
-- Memory表新增索引
-- 1. 租户+项目索引（最常用查询）
DEFINE INDEX idx_memory_tenant_project ON TABLE memory COLUMNS tenant_id, project_id;

-- 2. 类型索引（按类型筛选）
DEFINE INDEX idx_memory_type ON TABLE memory COLUMNS type;

-- Outbox表新增索引
-- 3. 状态+时间复合索引（消费队列查询）
DEFINE INDEX idx_outbox_status_created ON TABLE outbox COLUMNS status, created_at;
```

**索引使用场景**:

```sql
-- 场景1: 按租户查询（常用）
SELECT * FROM memory WHERE tenant_id = 'default' AND project_id = 'test';
-- 使用 idx_memory_tenant_project

-- 场景2: 按类型筛选
SELECT * FROM memory WHERE type = 'long-term';
-- 使用 idx_memory_type

-- 场景3: 消费Outbox
SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at LIMIT 10;
-- 使用 idx_outbox_status_created
```

---

### 5. 监控设计

**新增章节**: `incremental-sync-design-part1-architecture.md` 第5节

```markdown
## 5. 监控和可观测性

### 5.1 关键指标

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|----------|
| sync_duration | Histogram | 同步操作耗时 | > 5s |
| sync_operations | Counter | 同步操作次数 | - |
| version_conflicts | Counter | 版本冲突次数 | > 10/小时 |
| checkpoint_size | Gauge | Checkpoint文件大小 | > 10MB |
| outbox_queue_depth | Gauge | Outbox队列深度 | > 100 |
| idempotency_hit | Counter | 幂等性命中次数 | - |

### 5.2 分布式追踪

```python
import uuid
from contextvars import ContextVar

trace_id_var = ContextVar("trace_id", default=None)

async def batch_sync_with_tracing(operations, batch_id):
    trace_id = str(uuid.uuid4())
    trace_id_var.set(trace_id)
    
    logger.info(f"[{trace_id}] Starting batch sync", extra={
        "trace_id": trace_id,
        "batch_id": batch_id,
        "operation_count": len(operations)
    })
    
    try:
        result = await batch_sync_memories(operations, batch_id)
        logger.info(f"[{trace_id}] Batch sync completed", extra={
            "trace_id": trace_id,
            "status": "success",
            "succeeded": result["summary"]["succeeded"]
        })
        return result
    except Exception as e:
        logger.error(f"[{trace_id}] Batch sync failed", extra={
            "trace_id": trace_id,
            "error": str(e)
        })
        raise
```

### 5.3 健康检查

```python
async def health_check():
    """系统健康检查"""
    checks = {
        "database": await check_database_connection(),
        "outbox": await check_outbox_lag(),
        "checkpoint": await check_checkpoint_integrity()
    }
    
    all_healthy = all(check["status"] == "ok" for check in checks.values())
    
    return {
        "status": "healthy" if all_healthy else "unhealthy",
        "checks": checks,
        "timestamp": datetime.utcnow().isoformat()
    }
```
```

---

## ✅ 成功标准

### 功能标准

- [ ] 批量操作原子性：所有操作在一个事务中完成
- [ ] Checkpoint版本控制：多客户端安全
- [ ] 幂等性保证：重复请求正确处理
- [ ] 超时机制：卡住的任务自动释放
- [ ] 监控完备：关键指标可观测

### 性能标准

- [ ] 同步延迟 < 100ms（单批次20条）
- [ ] 并发支持 > 10客户端
- [ ] 查询延迟 < 10ms（带索引）
- [ ] Checkpoint加载 < 1s（1000条）

### 质量标准

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 并发测试通过
- [ ] 文档完整

---

## 📞 决策确认

**决策者**: [待填写]  
**决策日期**: [待填写]  
**备注**: [待填写]

**已批准**: ☐ 是  ☐ 需要调整  ☐ 拒绝

---

**方案制定**: OpenCode Memory  
**制定时间**: 2026-03-17  
**版本**: v1.0
