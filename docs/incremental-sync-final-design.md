# OpenCode Memory Plugin - 增量同步最终设计与实施方案

**文档版本**: v2.0 (修正版)  
**生成时间**: 2026-03-17  
**状态**: ✅ 已完成

---

## 📋 文档说明

本文档是基于以下分析结果编写的修正版设计方案：

- **对比分析文档**（5个文件）- 识别了25个问题（16个P0 + 9个P1）
- **原始设计文档**（5个文件）- 初始设计方案
- **现有代码分析** - 后端和插件端实际实现（通过explore agents深度分析）

**修正成果**：

1. ✅ 补充所有缺失的字段（embedding, tenant_id, project_id, content_hash, version）
2. ✅ 补充所有缺失的API（5个核心API：batch-sync, source_fingerprints, batch-delete等）
3. ✅ 补充所有缺失的机制（幂等性、并发控制、Outbox、Checkpoint）
4. ✅ 提供完整的实施计划（3个方案：完整版22h / MVP 11h / 分阶段3×7h）
5. ✅ 提供详细的测试策略（单元测试、集成测试、性能测试）
6. ✅ 提供风险评估与缓解措施（6个技术风险 + 4个实施风险）

**核心改进**：

- 性能提升：20倍（2000ms → 100ms）
- 网络请求：减少100倍（N次 → 1次）
- 数据传输：减少10-100倍（全量 → 增量）

---

## 📚 目录

1. [系统架构设计](#系统架构设计)
2. [数据模型定义](#数据模型定义)
3. [API接口规范](#api接口规范)
4. [核心算法实现](#核心算法实现)
5. [一致性保障机制](#一致性保障机制)
6. [实施计划](#实施计划)
7. [测试策略](#测试策略)
8. [风险评估与缓解](#风险评估与缓解)

---

## 🏗️ 系统架构设计

### 核心组件

**后端服务（Wrapper Service）**

- **MemoryManager**: 记忆管理核心，处理CRUD操作
- **EmbeddingService**: 向量生成服务（1024维）
- **SurrealDB**: 向量存储 + 图关系 + 数据持久化 + 幂等性检查
- **Meilisearch**: 全文搜索 + 中文分词

**插件端（OpenCode Plugin）**

- **SyncManager**: 增量同步管理器，负责变更检测和同步协调
- **CheckpointManager**: 同步状态管理，原子化checkpoint存储
- **WrapperClient**: 后端API客户端，封装所有HTTP请求
- **UploadQueue**: 失败重试队列，保证最终一致性

### 数据流

```
用户操作 → memory_write → 本地文件写入 → 异步上传后端
                                    ↓
                            SyncManager检测变更
                                    ↓
                            批量同步API（幂等）
                                    ↓
                        后端处理（Outbox模式）
                                    ↓
                    SurrealDB + Meilisearch 双写
                                    ↓
                            Checkpoint更新
```

### 交互模式

**写入流程**：

1. 插件端写入本地文件
2. 生成source_fingerprint（SHA256，去除时间戳）
3. 异步调用后端API上传
4. 后端幂等性检查（SurrealDB idempotency表）
5. Outbox模式保证跨存储一致性
6. 更新本地checkpoint

**同步流程**：

1. 获取本地所有source_fingerprint
2. 获取后端所有source_fingerprint
3. 对比差异（to_add, to_update, to_delete）
4. 批量同步API提交变更
5. 处理冲突（version字段乐观锁）
6. 更新checkpoint

---

## 📊 数据模型定义

### MemoryEntry（修正版）

```typescript
interface MemoryEntry {
  // 核心内容
  content: string; // 记忆内容
  type: string; // 类型：general, preference, daily等
  tags: string[]; // 标签数组

  // 指纹和哈希（修正：添加缺失字段）
  source_fingerprint: string; // SHA256稳定指纹（去除时间戳）
  content_hash: string; // MD5快速去重哈希

  // 多租户和项目（修正：添加缺失字段）
  tenant_id: string; // 租户ID（必需）
  project_id: string; // 项目ID（必需，默认"global"）

  // 向量（修正：添加缺失字段）
  embedding: number[]; // 1024维向量（必需）

  // 来源信息
  source: string; // 来源：api, plugin, cli等
  source_id?: string; // 可选：外部系统ID
  source_timestamp?: string; // 可选：来源时间戳

  // 元数据（修正：改为灵活结构）
  metadata: { [key: string]: any }; // 灵活的元数据字典

  // 分类置信度（可选）
  classification_confidence?: number;

  // 并发控制（新增）
  version: number; // 版本号，用于乐观锁

  // 系统字段（后端自动生成）
  record_id?: string; // SurrealDB记录ID
  created_at?: string; // 创建时间
  updated_at?: string; // 更新时间
}
```

### 幂等性表（Idempotency）

```sql
-- SurrealDB Schema定义
DEFINE TABLE idempotency SCHEMAFULL;

-- 字段定义
DEFINE FIELD batch_id ON TABLE idempotency TYPE string;
DEFINE FIELD status ON TABLE idempotency TYPE string
    ASSERT $value IN ["pending", "processing", "completed", "failed"];
DEFINE FIELD tenant_id ON TABLE idempotency TYPE string;
DEFINE FIELD project_id ON TABLE idempotency TYPE string;
DEFINE FIELD created_at ON TABLE idempotency TYPE datetime DEFAULT time::now();
DEFINE FIELD completed_at ON TABLE idempotency TYPE option<datetime>;
DEFINE FIELD result ON TABLE idempotency TYPE option<object>;

-- 唯一索引（幂等性保证）
DEFINE INDEX idx_batch_id ON TABLE idempotency COLUMNS batch_id UNIQUE;

-- 清理索引（定期清理任务使用）
DEFINE INDEX idx_created_at ON TABLE idempotency COLUMNS created_at;
```

### Outbox表（事件发布）

```sql
-- SurrealDB Schema定义
DEFINE TABLE outbox SCHEMAFULL;

-- 字段定义
DEFINE FIELD event_id ON TABLE outbox TYPE string;
DEFINE FIELD event_type ON TABLE outbox TYPE string
    ASSERT $value IN ["memory_created", "memory_updated", "memory_deleted"];
DEFINE FIELD aggregate_id ON TABLE outbox TYPE string;  -- source_fingerprint
DEFINE FIELD payload ON TABLE outbox TYPE object;
DEFINE FIELD status ON TABLE outbox TYPE string
    ASSERT $value IN ["pending", "published", "failed"];
DEFINE FIELD tenant_id ON TABLE outbox TYPE string;
DEFINE FIELD project_id ON TABLE outbox TYPE string;
DEFINE FIELD created_at ON TABLE outbox TYPE datetime DEFAULT time::now();
DEFINE FIELD published_at ON TABLE outbox TYPE option<datetime>;
DEFINE FIELD retry_count ON TABLE outbox TYPE int DEFAULT 0;

-- 状态索引（查询待发布事件）
DEFINE INDEX idx_outbox_status ON TABLE outbox COLUMNS status;

-- 清理索引（定期清理任务使用）
DEFINE INDEX idx_outbox_created_at ON TABLE outbox COLUMNS created_at;
```

### API请求/响应模型

**批量同步请求**：

```typescript
interface BatchSyncRequest {
  batch_id: string; // 批次ID（幂等键）
  tenant_id: string;
  project_id: string;
  operations: SyncOperation[];
}

interface SyncOperation {
  action: "CREATE" | "UPDATE" | "DELETE";
  entry?: MemoryEntry; // CREATE/UPDATE时必需
  source_fingerprint?: string; // DELETE时必需
  expected_version?: number; // UPDATE时用于并发控制
}
```

**批量同步响应**：

```typescript
interface BatchSyncResponse {
  batch_id: string;
  success: number; // 成功数量
  failed: number; // 失败数量
  conflicts: ConflictInfo[]; // 冲突列表
  results: OperationResult[];
}

interface ConflictInfo {
  source_fingerprint: string;
  conflict_type: "version_mismatch" | "concurrent_update";
  local_version: number;
  remote_version: number;
}
```

---

## 🔌 API接口规范

### 现有API（保持向后兼容）

```python
# 单条上传（保留）
POST /api/v1/memories
Body: MemoryItem
Response: { record_id, status }

# 搜索（保留）
POST /api/v1/memories/search
Body: { query, mode, limit, tenant_id, project_id }
Response: { results: MemoryEntry[] }

# 健康检查（保留）
GET /api/v1/health
Response: { status, version, services }
```

### 新增API（增量同步核心）

**1. 批量同步API（核心功能）**

```python
POST /api/v1/memories/batch-sync
Body: BatchSyncRequest
Response: BatchSyncResponse

# 功能：
- 幂等性保证（SurrealDB UNIQUE索引检查batch_id）
- 批量处理CREATE/UPDATE/DELETE
- 并发控制（version字段乐观锁）
- Outbox模式保证跨存储一致性
- 删除保护（超过20%或50条需确认）
```

**2. 获取source_fingerprint列表API**

```python
GET /api/v1/memories/source_fingerprints
Query: { tenant_id, project_id }
Response: {
    fingerprints: string[],
    total: number,
    last_updated: string
}

# 功能：
- 返回所有记忆的source_fingerprint
- 用于客户端对比差异
- 支持分页（可选）
```

**3. 批量删除API**

```python
DELETE /api/v1/memories/batch
Body: {
    tenant_id: string,
    project_id: string,
    source_fingerprints: string[]
}
Response: {
    deleted: number,
    failed: number,
    errors: ErrorInfo[]
}

# 功能：
- 删除保护（超过20%或50条需confirm=true）
- 批量删除提高效率
- 返回详细错误信息
```

**4. 同步状态API**

```python
GET /api/v1/memories/sync-status
Query: { tenant_id, project_id }
Response: {
    last_sync: string,
    total_entries: number,
    status: "healthy" | "syncing" | "error",
    pending_operations: number
}
```

**5. 冲突解决API**

```python
POST /api/v1/memories/resolve-conflict
Body: {
    source_fingerprint: string,
    resolution: "local" | "remote" | "merge",
    entry?: MemoryEntry
}
Response: {
    resolved: boolean,
    final_entry: MemoryEntry
}
```

---

## 🧮 核心算法实现

### 变更检测算法

```typescript
async function detectChanges(
  localFingerprints: Set<string>,
  remoteFingerprints: Set<string>,
): Promise<ChangeSet> {
  // O(n+m) 复杂度
  const to_add = new Set<string>();
  const to_delete = new Set<string>();

  // 找出需要添加的（本地有，远程没有）
  for (const fp of localFingerprints) {
    if (!remoteFingerprints.has(fp)) {
      to_add.add(fp);
    }
  }

  // 找出需要删除的（远程有，本地没有）
  for (const fp of remoteFingerprints) {
    if (!localFingerprints.has(fp)) {
      to_delete.add(fp);
    }
  }

  return { to_add, to_delete };
}
```

### 同步流程

```typescript
async function syncMemories(): Promise<SyncResult> {
  // 1. 加载checkpoint
  const checkpoint = await checkpointManager.load();

  // 2. 获取本地和远程fingerprints
  const localFps = await getLocalFingerprints();
  const remoteFps = await wrapperClient.getSourceFingerprints();

  // 3. 检测变更
  const changes = await detectChanges(localFps, remoteFps);

  // 4. 删除保护检查
  if (changes.to_delete.size > Math.max(remoteFps.size * 0.2, 50)) {
    throw new Error("删除数量超过阈值，需要用户确认");
  }

  // 5. 构建批量同步请求
  const operations: SyncOperation[] = [];

  for (const fp of changes.to_add) {
    const entry = await getLocalEntry(fp);
    operations.push({ action: "CREATE", entry });
  }

  for (const fp of changes.to_delete) {
    operations.push({ action: "DELETE", source_fingerprint: fp });
  }

  // 6. 批量同步（幂等）
  const batchId = generateBatchId();
  const response = await wrapperClient.batchSync({
    batch_id: batchId,
    tenant_id: getTenantId(),
    project_id: getProjectId(),
    operations,
  });

  // 7. 处理冲突
  for (const conflict of response.conflicts) {
    await resolveConflict(conflict);
  }

  // 8. 更新checkpoint（原子写入）
  await checkpointManager.save({
    last_sync: new Date().toISOString(),
    local_fingerprints: Array.from(localFps),
    remote_fingerprints: Array.from(remoteFps),
    batch_id: batchId,
  });

  return {
    added: changes.to_add.size,
    deleted: changes.to_delete.size,
    conflicts: response.conflicts.length,
  };
}
```

### 冲突解决

```typescript
async function resolveConflict(conflict: ConflictInfo): Promise<void> {
  const { source_fingerprint, local_version, remote_version } = conflict;

  // 策略1：远程优先（默认）
  if (remote_version > local_version) {
    const remoteEntry = await wrapperClient.getEntry(source_fingerprint);
    await updateLocalEntry(remoteEntry);
    return;
  }

  // 策略2：本地优先
  if (local_version > remote_version) {
    const localEntry = await getLocalEntry(source_fingerprint);
    await wrapperClient.updateEntry(localEntry, remote_version);
    return;
  }

  // 策略3：内容合并（可选）
  // 比较content_hash，如果相同则无需处理
  const localHash = await getLocalContentHash(source_fingerprint);
  const remoteHash = await wrapperClient.getContentHash(source_fingerprint);

  if (localHash === remoteHash) {
    // 内容相同，只需同步version
    return;
  }

  // 真正的冲突，需要用户介入
  throw new ConflictError("需要用户手动解决冲突", conflict);
}
```

---

## 🔒 一致性保障机制

### 幂等性保证

**实现方式**：SurrealDB idempotency表 + UNIQUE索引

```python
async def batch_sync(request: BatchSyncRequest):
    # 1. 幂等性检查（利用唯一索引）
    try:
        await db.create("idempotency", {
            "batch_id": request.batch_id,
            "status": "processing"
        })
    except UniqueConstraintError:
        # 已存在，查询状态
        existing = await db.query(
            "SELECT * FROM idempotency WHERE batch_id = $batch_id",
            {"batch_id": request.batch_id}
        )
        if existing[0]["result"][0]["status"] == "completed":
            return await get_cached_result(request.batch_id)

    # 2. 处理批量操作
    result = await process_batch_operations(request.operations)

    # 3. 标记完成
    await db.query("""
        UPDATE idempotency SET status = 'completed'
        WHERE batch_id = $batch_id
    """, {"batch_id": request.batch_id})

    return result
```

**保证**：

- 同一batch_id的请求只处理一次（UNIQUE索引）
- 网络重试不会导致重复写入
- 数据持久化，重启不丢失
- 定期清理任务（24小时）

### 并发控制

**实现方式**：version字段 + 乐观锁

```python
async def update_memory(entry: MemoryEntry, expected_version: int):
    # 使用条件更新（原子操作）
    result = await db.query("""
        UPDATE memories
        SET
            content = $content,
            tags = $tags,
            updated_at = time::now(),
            version = version + 1
        WHERE source_fingerprint = $fp AND version = $expected_version
        RETURN AFTER
    """, {
        "fp": entry.source_fingerprint,
        "content": entry.content,
        "tags": entry.tags,
        "expected_version": expected_version
    })

    # 如果没有更新任何记录，说明版本冲突
    if not result or len(result) == 0:
        raise VersionConflictError(
            f"Version conflict: expected {expected_version}"
        )

    return result[0]
```

**保证**：

- 并发更新时检测冲突
- 后到的请求会收到冲突错误
- 客户端可以重试或手动解决

### Outbox模式

**实现方式**：事务 + 异步发布

```python
async def save_memory_with_outbox(entry: MemoryEntry):
    async with db.transaction():
        # 1. 写入主表
        await db.insert("memories", entry)

        # 2. 写入outbox表
        await db.insert("outbox", {
            "event_type": "memory_created",
            "payload": entry,
            "status": "pending"
        })

    # 3. 异步发布到Meilisearch（后台任务）
    await publish_to_meilisearch(entry)
```

**保证**：

- SurrealDB和Meilisearch最终一致
- 即使Meilisearch失败，数据也不会丢失
- 后台任务会重试失败的发布

### Checkpoint机制

**实现方式**：原子写入 + 损坏恢复

```typescript
class CheckpointManager {
  private checkpointFile = "~/.opencode/memory/checkpoint.json";
  private backupFile = "~/.opencode/memory/checkpoint.json.bak";

  async save(checkpoint: Checkpoint): Promise<void> {
    // 1. 写入临时文件
    const tempFile = `${this.checkpointFile}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(checkpoint, null, 2));

    // 2. 备份旧文件
    if (await fs.exists(this.checkpointFile)) {
      await fs.copyFile(this.checkpointFile, this.backupFile);
    }

    // 3. 原子替换
    await fs.rename(tempFile, this.checkpointFile);
  }

  async load(): Promise<Checkpoint> {
    try {
      // 尝试加载主文件
      const data = await fs.readFile(this.checkpointFile, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      // 主文件损坏，尝试备份
      console.warn("Checkpoint corrupted, loading backup");
      const data = await fs.readFile(this.backupFile, "utf-8");
      return JSON.parse(data);
    }
  }
}
```

**保证**：

- 写入失败不会损坏现有checkpoint
- 损坏时自动恢复到备份
- 追踪同步状态，支持断点续传

### 定期清理任务

**实现方式**：后台定时任务 + 批量删除

```python
# cleanup_task.py
import asyncio
from datetime import datetime, timedelta

class CleanupTask:
    def __init__(self, db, interval_hours=24):
        self.db = db
        self.interval_hours = interval_hours

    async def cleanup_idempotency(self, retention_hours=24):
        """清理过期的幂等性记录"""
        cutoff_time = datetime.now() - timedelta(hours=retention_hours)

        result = await self.db.query("""
            DELETE FROM idempotency
            WHERE created_at < $cutoff_time
            AND status IN ['completed', 'failed']
            RETURN BEFORE
        """, {"cutoff_time": cutoff_time.isoformat()})

        deleted_count = len(result[0]["result"]) if result else 0
        print(f"Cleaned up {deleted_count} idempotency records")
        return deleted_count

    async def cleanup_outbox(self, retention_hours=72):
        """清理已发布的outbox事件"""
        cutoff_time = datetime.now() - timedelta(hours=retention_hours)

        result = await self.db.query("""
            DELETE FROM outbox
            WHERE created_at < $cutoff_time
            AND status = 'published'
            RETURN BEFORE
        """, {"cutoff_time": cutoff_time.isoformat()})

        deleted_count = len(result[0]["result"]) if result else 0
        print(f"Cleaned up {deleted_count} outbox records")
        return deleted_count

    async def run_forever(self):
        """持续运行清理任务"""
        while True:
            try:
                await self.cleanup_idempotency()
                await self.cleanup_outbox()
            except Exception as e:
                print(f"Cleanup task error: {e}")

            # 等待下一次执行
            await asyncio.sleep(self.interval_hours * 3600)

# 启动清理任务（在应用启动时）
async def start_cleanup_task(db):
    task = CleanupTask(db, interval_hours=24)
    asyncio.create_task(task.run_forever())
```

**保证**：

- 自动清理过期的幂等性记录（24小时后）
- 自动清理已发布的outbox事件（72小时后）
- 防止数据库无限增长
- 失败时不影响主业务

---

## 📅 实施计划

### 方案A：完整实施（推荐）

**总工时**: 22.5小时  
**范围**: P0（16个）+ P1（9个）全部修复  
**收益**: 生产就绪，性能提升20倍，完整监控，零Redis依赖

#### 阶段1：后端基础（6小时）

| 任务             | 工时 | 产出                                                                           |
| ---------------- | ---- | ------------------------------------------------------------------------------ |
| 数据模型准备     | 1h   | SurrealDB schema更新（version, last_op_id, source_fingerprint, idempotency表） |
| 批量同步API      | 3h   | POST /api/v1/memories/batch-sync（CREATE/UPDATE/DELETE）                       |
| 幂等性和并发控制 | 2.5h | SurrealDB幂等性检查 + 清理任务 + version乐观锁                                 |

#### 阶段2：插件端核心（5小时）

| 任务              | 工时 | 产出                          |
| ----------------- | ---- | ----------------------------- |
| SyncManager实现   | 3h   | 变更检测算法 + 同步逻辑       |
| CheckpointManager | 1.5h | 原子写入 + 损坏恢复 + 压缩    |
| rebuild_index集成 | 0.5h | 调用SyncManager + dry-run参数 |

#### 阶段3：一致性保障（4小时）

| 任务               | 工时 | 产出                             |
| ------------------ | ---- | -------------------------------- |
| Outbox模式         | 2h   | 异步同步到Meilisearch + 重试机制 |
| Source Fingerprint | 1h   | 稳定内容指纹生成（去除时间戳）   |
| 部分成功处理       | 1h   | 响应模型完善 + 错误详情          |

#### 阶段4：测试和优化（7小时）

| 任务       | 工时 | 产出                               |
| ---------- | ---- | ---------------------------------- |
| 单元测试   | 2h   | 后端 + 插件端核心逻辑测试          |
| 集成测试   | 2h   | 端到端测试 + 跨存储一致性验证      |
| 性能优化   | 2h   | 批量大小调优 + 查询优化 + 压力测试 |
| 监控和文档 | 1h   | 监控指标 + README更新              |

### 方案B：MVP最小版本

**总工时**: 11.5小时  
**范围**: 仅P0核心功能（11个）  
**收益**: 快速验证，核心功能可用，零Redis依赖

#### MVP包含功能

- ✅ 批量同步API（CREATE/UPDATE/DELETE）
- ✅ 幂等性检查（SurrealDB）
- ✅ 并发控制（version乐观锁）
- ✅ SyncManager（变更检测）
- ✅ CheckpointManager（原子写入）
- ✅ 删除保护（20%/50条阈值）
- ✅ 基础单元测试

#### MVP不包含

- ❌ Outbox模式（同步调用Meilisearch）
- ❌ Source Fingerprint（使用完整hash）
- ❌ 部分成功响应（全成功或全失败）
- ❌ 性能优化和监控

#### MVP实施步骤

| 阶段       | 工时 | 任务                                     |
| ---------- | ---- | ---------------------------------------- |
| 后端核心   | 4.5h | 批量同步API + SurrealDB幂等性 + 并发控制 |
| 插件端核心 | 4h   | SyncManager + CheckpointManager          |
| 基础测试   | 2h   | 核心功能单元测试                         |
| 手动验证   | 1h   | 新增/更新/删除场景测试                   |

### 方案C：分阶段实施

**Phase 1**（8小时）- 数据模型 + 批量同步API  
**Phase 2**（7小时）- 插件端增量同步  
**Phase 3**（7小时）- 监控、优化、完整测试

#### Phase 1：后端就绪（8小时）

- 数据模型修正（2h）
- 批量同步API实现（4h）
- 幂等性和并发控制（2h）

**里程碑**: 后端API可用，支持批量操作

#### Phase 2：插件端集成（7小时）

- SyncManager实现（3h）
- CheckpointManager实现（2h）
- rebuild_index集成（1h）
- 基础测试（1h）

**里程碑**: 增量同步功能完整可用

#### Phase 3：生产就绪（7小时）

- Outbox模式（2h）
- Source Fingerprint（1h）
- 集成测试（2h）
- 性能优化（1h）
- 监控和文档（1h）

**里程碑**: 生产环境部署就绪

---

## 🧪 测试策略

### 单元测试

#### 后端测试（pytest）

```python
# test_batch_sync.py
def test_batch_sync_create():
    """测试批量创建"""
    request = BatchSyncRequest(
        batch_id="test-001",
        tenant_id="default",
        project_id="test",
        operations=[
            SyncOperation(
                action="CREATE",
                entry=MemoryEntry(
                    content="Test memory",
                    type="long-term",
                    tags=["test"]
                )
            )
        ]
    )
    response = await batch_sync(request)
    assert response.success == 1

def test_batch_sync_idempotency():
    """测试幂等性"""
    request = BatchSyncRequest(batch_id="test-002", ...)
    response1 = await batch_sync(request)
    response2 = await batch_sync(request)  # 重复请求
    assert response1.batch_id == response2.batch_id

def test_version_conflict():
    """测试并发冲突"""
    update = MemoryUpdate(
        record_id="memory:123",
        expected_version=1,
        content="new content"
    )
    # 模拟版本已变化
    with pytest.raises(VersionConflictError):
        await update_memory(update)
```

#### 插件端测试（Jest）

```javascript
// sync-manager.test.js
describe('SyncManager', () => {
  test('detectChanges - 识别新增', async () => {
    const checkpoint = [];
    const local = [{ local_key: 'MEMORY.md:abc123', ... }];
    const changes = await detectChanges(checkpoint, local);
    expect(changes.to_add).toHaveLength(1);
  });

  test('detectChanges - 识别更新', async () => {
    const checkpoint = [{
      local_key: 'MEMORY.md:abc123',
      source_fingerprint: 'old-fp'
    }];
    const local = [{
      local_key: 'MEMORY.md:abc123',
      source_fingerprint: 'new-fp'
    }];
    const changes = await detectChanges(checkpoint, local);
    expect(changes.to_update).toHaveLength(1);
  });

  test('validateDeletions - 触发保护', () => {
    const to_delete = new Array(60).fill({});
    const checkpoint = new Array(100).fill({});
    expect(() => validateDeletions(to_delete, checkpoint))
      .toThrow('删除保护触发');
  });
});
```

### 集成测试

#### 端到端测试场景

```javascript
// e2e.test.js
describe("增量同步端到端测试", () => {
  test("完整同步流程", async () => {
    // 1. 初始同步
    await memory_write({ content: "Test 1", type: "long-term" });
    await rebuild_index();

    // 2. 验证checkpoint
    const checkpoint1 = await loadCheckpoint();
    expect(checkpoint1).toHaveLength(1);

    // 3. 修改内容
    await memory_write({ content: "Test 1 Updated", type: "long-term" });

    // 4. 增量同步
    await rebuild_index();

    // 5. 验证更新
    const checkpoint2 = await loadCheckpoint();
    expect(checkpoint2[0].version).toBe(2);
  });

  test("删除同步", async () => {
    // 1. 创建记忆
    await memory_write({ content: "To be deleted", type: "long-term" });
    await rebuild_index();

    // 2. 删除本地文件
    await fs.unlink("~/.opencode/memory/MEMORY.md");

    // 3. 同步删除
    await rebuild_index();

    // 4. 验证软删除
    const checkpoint = await loadCheckpoint();
    expect(checkpoint[0].deleted).toBe(true);
  });
});
```

### 性能测试

#### 基准测试

| 场景       | 数据量 | 目标延迟 | 目标吞吐量 |
| ---------- | ------ | -------- | ---------- |
| 小批量同步 | 10条   | <50ms    | >200条/秒  |
| 中批量同步 | 100条  | <200ms   | >500条/秒  |
| 大批量同步 | 1000条 | <2s      | >500条/秒  |

#### 压力测试

```python
# locustfile.py
from locust import HttpUser, task, between

class MemorySyncUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def batch_sync(self):
        self.client.post("/api/v1/memories/batch-sync", json={
            "batch_id": f"load-test-{uuid.uuid4()}",
            "tenant_id": "default",
            "project_id": "test",
            "to_add": [generate_memory_entry() for _ in range(20)]
        })
```

### 测试覆盖率目标

| 模块       | 目标覆盖率 | 当前覆盖率 |
| ---------- | ---------- | ---------- |
| 后端API    | >80%       | 待测试     |
| 插件端核心 | >80%       | 待测试     |
| 算法逻辑   | >90%       | 待测试     |
| 错误处理   | >70%       | 待测试     |

---

## ⚠️ 风险评估与缓解

### 技术风险

| 风险                  | 影响 | 概率 | 优先级 | 缓解措施                               |
| --------------------- | ---- | ---- | ------ | -------------------------------------- |
| **Checkpoint损坏**    | 高   | 低   | P0     | 原子写入 + 备份文件 + 校验和验证       |
| **并发冲突频繁**      | 中   | 中   | P0     | 乐观锁 + 自动重试（最多3次）+ 冲突提示 |
| **大量误删**          | 高   | 低   | P0     | 删除保护（20%/50条）+ 软删除 + 7天保留 |
| **SurrealDB事务超时** | 中   | 低   | P1     | 批量大小限制（最多100条）+ 超时重试    |
| **Outbox队列堆积**    | 中   | 中   | P1     | 监控告警 + 自动扩容 + 手动清理工具     |
| **性能不达标**        | 中   | 中   | P1     | 批量优化 + 索引优化 + 缓存策略         |

### 实施风险

| 风险               | 影响 | 概率 | 缓解措施                     |
| ------------------ | ---- | ---- | ---------------------------- |
| **工时超支**       | 中   | 中   | 分阶段实施，优先P0功能       |
| **向后兼容性问题** | 高   | 低   | 保留现有API，新增增量同步API |
| **数据迁移失败**   | 高   | 低   | 灰度发布，支持回滚           |
| **用户学习成本**   | 低   | 中   | 自动化同步，无需用户干预     |

### 缓解策略详解

#### 1. Checkpoint损坏恢复

**策略**：

- 临时文件 + 原子替换
- 自动备份（.backup文件）
- 损坏时自动恢复到备份
- 定期校验和验证

**恢复流程**：

```javascript
try {
  checkpoint = await loadCheckpoint();
} catch (error) {
  console.warn("Checkpoint损坏，尝试恢复备份");
  checkpoint = await loadBackup();
  await saveCheckpoint(checkpoint); // 修复主文件
}
```

#### 2. 并发冲突处理

**策略**：

- version字段乐观锁
- 自动重试（最多3次）
- 重试时重新获取最新version
- 3次失败后提示用户手动解决

**重试逻辑**：

```javascript
let retries = 0;
while (retries < 3) {
  try {
    await updateMemory(entry, expectedVersion);
    break;
  } catch (VersionConflictError) {
    retries++;
    expectedVersion = await getLatestVersion(entry.record_id);
  }
}
```

#### 3. 删除保护机制

**策略**：

- 阈值检查（20%或50条）
- 软删除（7天保留期）
- 用户确认（--force参数）
- 删除日志记录

**保护流程**：

```javascript
if (deleteRatio > 0.2 || deleteCount > 50) {
  if (!force) {
    throw new Error("删除保护触发，使用 --force 跳过");
  }
  console.warn(`强制删除 ${deleteCount} 条记录`);
}
```

#### 4. 性能优化策略

**批量大小优化**：

- <10条：全部一批
- 10-100条：20条/批
- 100-1000条：50条/批
- > 1000条：100条/批

**索引优化**：

- source_fingerprint索引（唯一）
- version索引（范围查询）
- tenant_id + project_id复合索引

**缓存策略**：

- SurrealDB缓存幂等性状态（定期清理）
- 本地缓存checkpoint（内存）

### 回滚计划

#### 场景1：批量同步API失败

**回滚步骤**：

1. 停止使用新API
2. 回退到全量上传模式
3. 修复问题后重新部署

**数据影响**：无（新API独立）

#### 场景2：Checkpoint损坏

**回滚步骤**：

1. 从备份恢复checkpoint
2. 如果备份也损坏，删除checkpoint
3. 下次同步时全量重建

**数据影响**：需要重新全量同步

#### 场景3：性能严重下降

**回滚步骤**：

1. 禁用增量同步（配置开关）
2. 回退到全量上传模式
3. 分析性能瓶颈
4. 优化后重新启用

**数据影响**：无（功能降级）

---

## 📊 成功指标

### 性能指标

| 指标     | 当前    | 目标      | 测量方法     |
| -------- | ------- | --------- | ------------ |
| 同步延迟 | 2000ms  | <100ms    | 平均响应时间 |
| 吞吐量   | 50条/秒 | >200条/秒 | 批量同步测试 |
| 错误率   | 未知    | <1%       | 失败请求比例 |
| 可用性   | 未知    | >99.9%    | 服务健康检查 |

### 质量指标

| 指标       | 目标 | 测量方法          |
| ---------- | ---- | ----------------- |
| 测试覆盖率 | >80% | pytest-cov / Jest |
| 代码质量   | A级  | SonarQube         |
| 文档完整性 | 100% | 人工审核          |

---

**文档状态**: ✅ 已完成（已移除Redis依赖）  
**最后更新**: 2026-03-17  
**版本**: v2.0 (修正版 - 零Redis依赖)  
**总工时**: 22.5小时（完整版）/ 11.5小时（MVP）
