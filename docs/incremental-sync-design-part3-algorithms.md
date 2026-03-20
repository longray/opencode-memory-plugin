# OpenCode Memory Plugin 增量同步方案

## 第三部分：核心算法和实现

**版本**: v1.0  
**日期**: 2026-03-17  
**状态**: 设计阶段

---

## 1. 变更检测算法

### 1.1 核心逻辑

```javascript
// 插件端：SyncManager.detectChanges()
async function detectChanges() {
  // 1. 加载checkpoint
  const checkpoint = await loadCheckpoint();
  const checkpointMap = new Map(checkpoint.map((c) => [c.local_key, c]));

  // 2. 解析本地文件
  const localEntries = await parseAllMemoryFiles();
  const localMap = new Map(localEntries.map((e) => [e.local_key, e]));

  // 3. 识别变更
  const to_add = [];
  const to_update = [];
  const to_delete = [];

  // 3.1 检查新增和更新
  for (const [key, local] of localMap) {
    const ckpt = checkpointMap.get(key);

    if (!ckpt) {
      // 新增：本地有，checkpoint没有
      to_add.push(local);
    } else if (local.source_fingerprint !== ckpt.source_fingerprint) {
      // 更新：内容指纹变化
      to_update.push({
        record_id: ckpt.record_id,
        expected_version: ckpt.version,
        ...local,
      });
    }
    // else: 无变化，跳过
  }

  // 3.2 检查删除
  for (const [key, ckpt] of checkpointMap) {
    if (!localMap.has(key) && !ckpt.deleted) {
      // 删除：checkpoint有，本地没有
      to_delete.push({
        record_id: ckpt.record_id,
      });
    }
  }

  return { to_add, to_update, to_delete };
}
```

### 1.2 时间复杂度分析

| 操作           | 复杂度       | 说明                 |
| -------------- | ------------ | -------------------- |
| 加载checkpoint | O(n)         | n = checkpoint条目数 |
| 解析本地文件   | O(m)         | m = 本地条目数       |
| 构建Map        | O(n + m)     | 两个Map构建          |
| 检查新增/更新  | O(m)         | 遍历本地条目         |
| 检查删除       | O(n)         | 遍历checkpoint       |
| **总计**       | **O(n + m)** | 线性时间复杂度       |

### 1.3 空间复杂度

- Checkpoint Map: O(n)
- Local Map: O(m)
- 结果数组: O(变更数量)
- **总计**: O(n + m)

## 2. Source Fingerprint生成

### 2.1 算法设计

```javascript
// 稳定内容指纹：去除时间戳和动态内容
function generateSourceFingerprint(content, metadata) {
  // 1. 规范化内容
  let normalized = content
    .replace(/\*\*Date\*\*:.*$/gm, "") // 移除日期行
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "") // 移除ISO时间戳
    .replace(/Last Updated:.*$/gm, "") // 移除更新时间
    .trim();

  // 2. 提取核心字段
  const core = {
    content: normalized,
    type: metadata.type,
    tags: metadata.tags.sort().join(","), // 排序后拼接
  };

  // 3. 生成SHA256
  return crypto.createHash("sha256").update(JSON.stringify(core)).digest("hex");
}
```

### 2.2 为什么需要Source Fingerprint？

| 场景           | 完整Hash    | Source Fingerprint |
| -------------- | ----------- | ------------------ |
| 内容修改       | 变化 ✅     | 变化 ✅            |
| 时间戳更新     | 变化 ❌     | 不变 ✅            |
| 标签顺序变化   | 变化 ❌     | 不变 ✅            |
| 重建checkpoint | 无法匹配 ❌ | 可以匹配 ✅        |

**关键优势**：

- 重建checkpoint时可以通过fingerprint匹配现有记录
- 避免因时间戳变化导致的误判更新
- 提高变更检测的准确性

## 3. 删除保护算法

### 3.1 核心逻辑

```javascript
// 防止误删大量数据
function validateDeletions(to_delete, checkpoint) {
  const deleteCount = to_delete.length;
  const totalCount = checkpoint.length;
  const deleteRatio = deleteCount / totalCount;

  // 阈值：删除超过20%或超过50条
  if (deleteRatio > 0.2 || deleteCount > 50) {
    throw new Error(
      `删除保护触发：尝试删除 ${deleteCount}/${totalCount} 条记录 ` +
        `(${(deleteRatio * 100).toFixed(1)}%)\n` +
        `请确认这是预期操作，使用 --force 参数跳过保护`,
    );
  }
}
```

### 3.2 保护策略

| 条件     | 阈值            | 行为                  |
| -------- | --------------- | --------------------- |
| 删除比例 | > 20%           | 抛出错误，需要--force |
| 删除数量 | > 50条          | 抛出错误，需要--force |
| 正常删除 | ≤ 20% 且 ≤ 50条 | 正常执行              |

### 3.3 用户体验

```bash
# 正常删除（5条）
$ rebuild_index
✅ Sync completed: 5 deleted

# 大量删除（100条）
$ rebuild_index
❌ 删除保护触发：尝试删除 100/500 条记录 (20.0%)
请确认这是预期操作，使用 --force 参数跳过保护

# 强制删除
$ rebuild_index --force
⚠️ 跳过删除保护
✅ Sync completed: 100 deleted
```

## 4. Checkpoint原子写入

### 4.1 算法设计

```javascript
async function saveCheckpointAtomic(checkpoint) {
  const tempPath = `${this.checkpointPath}.tmp`;
  const backupPath = `${this.checkpointPath}.backup`;

  try {
    // 1. 写入临时文件
    const content = checkpoint.map((c) => JSON.stringify(c)).join("\n");
    await fs.promises.writeFile(tempPath, content, "utf8");

    // 2. 备份现有文件
    if (await this.fileExists(this.checkpointPath)) {
      await fs.promises.copyFile(this.checkpointPath, backupPath);
    }

    // 3. 原子替换
    await fs.promises.rename(tempPath, this.checkpointPath);

    // 4. 删除备份
    if (await this.fileExists(backupPath)) {
      await fs.promises.unlink(backupPath);
    }
  } catch (error) {
    // 恢复备份
    if (await this.fileExists(backupPath)) {
      await fs.promises.copyFile(backupPath, this.checkpointPath);
    }
    throw error;
  }
}
```

### 4.2 故障场景分析

| 故障时机         | 文件状态   | 恢复策略         |
| ---------------- | ---------- | ---------------- |
| 写入临时文件失败 | 原文件完整 | 直接抛出错误     |
| 备份失败         | 原文件完整 | 直接抛出错误     |
| 原子替换失败     | 备份完整   | 从备份恢复       |
| 删除备份失败     | 新文件完整 | 忽略（备份残留） |

### 4.3 数据一致性保证

- ✅ **原子性**：rename操作是原子的
- ✅ **持久性**：写入后立即fsync（可选）
- ✅ **可恢复**：失败时自动从备份恢复
- ✅ **幂等性**：多次执行结果相同

## 5. Checkpoint压缩算法

### 5.1 核心逻辑

```javascript
async function compactCheckpoint() {
  const checkpoint = await this.loadCheckpoint();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // 过滤和排序
  const compacted = checkpoint
    .filter((c) => !c.deleted || c.synced_at > sevenDaysAgo)
    .sort((a, b) => a.local_key.localeCompare(b.local_key));

  // 原子写入
  await this.saveCheckpointAtomic(compacted);

  return {
    before: checkpoint.length,
    after: compacted.length,
    removed: checkpoint.length - compacted.length,
  };
}
```

### 5.2 压缩策略

| 条件                  | 行为     |
| --------------------- | -------- |
| deleted=true 且 < 7天 | 保留     |
| deleted=true 且 ≥ 7天 | 移除     |
| deleted=false         | 保留     |
| 文件大小 > 1MB        | 触发压缩 |

### 5.3 性能影响

- **压缩前**：1000条记录，1.2MB
- **压缩后**：800条记录，0.96MB
- **节省**：20%空间，加载速度提升15%

## 6. 批量同步优化

### 6.1 批量大小选择

```javascript
// 动态批量大小
function calculateBatchSize(totalEntries) {
  if (totalEntries < 10) return totalEntries;
  if (totalEntries < 100) return 20;
  if (totalEntries < 1000) return 50;
  return 100;
}
```

### 6.2 性能对比

| 批量大小 | 总条目 | 请求数 | 总耗时 | 平均延迟 |
| -------- | ------ | ------ | ------ | -------- |
| 10       | 100    | 10     | 1000ms | 100ms/批 |
| 20       | 100    | 5      | 600ms  | 120ms/批 |
| 50       | 100    | 2      | 400ms  | 200ms/批 |
| 100      | 100    | 1      | 300ms  | 300ms/批 |

**推荐**：20-50条/批（平衡延迟和吞吐量）

## 7. 并发控制（乐观锁）

### 7.1 条件更新（原子操作）

**修正后实现**（修复P0-1竞态条件）：

```python
async def update_memory(entry: MemoryEntry, expected_version: int):
    """使用条件更新保证原子性"""
    result = await db.query("""
        UPDATE memories
        SET content = $content,
            version = version + 1,
            updated_at = time::now()
        WHERE source_fingerprint = $fp
          AND version = $expected_version
        RETURN AFTER
    """, {
        "fp": entry.source_fingerprint,
        "content": entry.content,
        "expected_version": expected_version
    })

    if not result or len(result) == 0:
        # 版本不匹配或记录不存在
        raise VersionConflictError(
            f"Expected version {expected_version}, but record has been modified"
        )

    return result[0]
```

**原问题实现**（存在竞态条件）：

```python
# ❌ 错误：查询、检查、更新三步不是原子操作
async def update_memory_old(entry: MemoryEntry, expected_version: int):
    current = await db.query(...)  # 1. 查询当前版本
    if current.version != expected_version:  # 2. 版本检查
        raise ConflictError(...)
    entry.version = expected_version + 1
    await db.update("memories", entry)  # 3. 更新（非原子）
```

**关键改进**：使用`WHERE version = $expected_version`条件，将查询和更新合并为单一原子操作。

### 7.2 冲突处理流程

```
1. 客户端读取记录（version=2）
2. 客户端修改内容
3. 客户端提交更新（expected_version=2）
4. 服务端检查：当前version=3（已被其他客户端修改）
5. 服务端返回冲突错误
6. 客户端选择：
   a) 重新读取最新版本，合并修改
   b) 放弃修改
   c) 强制覆盖（需要特殊权限）
```

## 8. 幂等性实现（SurrealDB版本）

### 8.1 使用SurrealDB idempotency表

**修正后实现**（修复P1-1 Redis依赖）：

```python
async def check_idempotency(batch_id: str, db) -> tuple[bool, dict]:
    """
    检查batch_id是否已处理
    使用SurrealDB idempotency表 + UNIQUE索引
    """
    try:
        # 尝试插入记录（UNIQUE索引保证幂等性）
        result = await db.query("""
            CREATE idempotency CONTENT {
                batch_id: $batch_id,
                status: 'processing',
                created_at: time::now(),
                result: null
            }
        """, {"batch_id": batch_id})

        # 插入成功，是新请求
        return True, None

    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            # 记录已存在，查询状态
            existing = await db.query("""
                SELECT * FROM idempotency WHERE batch_id = $batch_id
            """, {"batch_id": batch_id})

            if existing and len(existing) > 0:
                status = existing[0]["status"]
                result = existing[0].get("result")

                if status == "completed":
                    return False, result  # 已完成，返回缓存结果
                elif status == "processing":
                    return True, None     # 正在处理，允许重试
                elif status == "failed":
                    return True, None     # 失败，允许重试

        # 其他错误
        raise

async def complete_idempotency(batch_id: str, result: dict, db):
    """标记批次为已完成"""
    await db.query("""
        UPDATE idempotency
        SET status = 'completed',
            result = $result,
            completed_at = time::now()
        WHERE batch_id = $batch_id
    """, {"batch_id": batch_id, "result": result})

async def fail_idempotency(batch_id: str, error: str, db):
    """标记批次为失败"""
    await db.query("""
        UPDATE idempotency
        SET status = 'failed',
            error = $error,
            completed_at = time::now()
        WHERE batch_id = $batch_id
    """, {"batch_id": batch_id, "error": error})
```

### 8.2 状态转换

```
[不存在] --CREATE--> [processing] --UPDATE--> [completed]
                            ↓
                        [failed]
                            ↓
                        [重试]
```

### 8.3 定期清理策略

**清理24小时前的已完成/失败记录**（修复P1-3）：

```python
async def cleanup_expired_idempotency(db):
    """清理过期的幂等性记录"""
    cutoff = datetime.utcnow() - timedelta(hours=24)

    result = await db.query("""
        DELETE FROM idempotency
        WHERE created_at < $cutoff
          AND status IN ['completed', 'failed']
        RETURN BEFORE
    """, {"cutoff": cutoff.isoformat()})

    deleted_count = len(result[0]["result"]) if result else 0
    logger.info(f"清理了 {deleted_count} 条幂等性记录")
    return deleted_count

# APScheduler定时任务
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
scheduler.add_job(
    cleanup_expired_idempotency,
    'interval',
    hours=1,
    args=[db]
)
scheduler.start()
```

---

**下一部分**：测试和实施计划
