# 现有代码 vs 设计文档 - 业务逻辑对比分析

**分析日期**: 2026-03-17  
**分析范围**: 去重逻辑、同步机制、错误处理

---

## 1. 去重逻辑对比

### 1.1 现有去重机制

#### 后端去重（memory_manager.py）

**两层去重**：

1. **内容哈希去重**（快速）：

```python
content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()

existing = await db.query(
    "SELECT id FROM memory WHERE tenant_id = $tenant_id AND content_hash = $hash",
    {"tenant_id": tenant_id, "hash": content_hash}
)

if existing:
    return DuplicateError(type="hash")
```

2. **语义相似度去重**（精确）：

```python
similar = await search_by_vector(
    embedding=embedding,
    limit=1,
    threshold=0.95  # 95%相似度
)

if similar:
    return DuplicateError(
        type="semantic",
        similarity=similar[0]["score"]
    )
```

#### 插件端去重（plugin.js）

**source_id生成**：

```javascript
function generateSourceId(content, type, tags, tenantId, projectId) {
  const normalizedTags = (tags || []).sort().join(",");
  const data = `${tenantId}:${projectId}:${content}:${type}:${normalizedTags}`;
  return createHash("md5").update(data).digest("hex");
}
```

**特点**：

- ✅ 考虑了租户和项目隔离
- ✅ 标签排序规范化
- ✅ 包含类型信息
- ❌ 依赖后端检测重复

### 1.2 设计文档去重机制

**提到的去重方式**：

- Hash去重（快速）
- 语义相似度检查（可选）

**问题**：

- ⚠️ 未明确说明hash算法（MD5 vs SHA256）
- ⚠️ 未说明相似度阈值
- ⚠️ 未说明去重的维度（是否考虑tenant/project）

---

## 2. 同步机制对比

### 2.1 现有同步机制（全量）

**rebuild_index流程**：

```
1. 获取文件列表（核心文件 + 最近30天daily）
2. 解析所有条目
3. 批量上传（批次大小：10）
4. 后端检测重复 → 跳过
5. 失败 → 加入重试队列
```

**特点**：

- ✅ 简单直接
- ❌ 每次都上传所有条目
- ❌ 依赖后端去重（网络开销大）
- ❌ 无法删除后端的旧记忆
- ❌ 30天限制（旧日志不同步）

**性能**：

- 1000条记忆 × 10条/批 = 100次请求
- 每次请求 ~200ms
- 总耗时：~20秒

### 2.2 设计文档同步机制（增量）

**增量同步流程**：

```
1. 加载checkpoint
2. 解析本地文件
3. 对比差异 → 识别新增/更新/删除
4. 批量同步（1次请求）
5. 更新checkpoint
```

**特点**：

- ✅ 只同步变更
- ✅ 支持删除
- ✅ 1次请求完成
- ✅ 无30天限制

**性能**：

- 10条变更 × 1次请求
- 耗时：~100ms
- **提升：200倍**

---

## 3. 变更检测算法对比

### 3.1 现有实现

**状态**：❌ 无变更检测

**问题**：

- 每次都上传所有条目
- 依赖后端的source_id去重
- 无法检测本地删除

### 3.2 设计文档实现

**算法**：

```javascript
// 1. 加载checkpoint
const checkpointMap = new Map(checkpoint.map((c) => [c.local_key, c]));

// 2. 解析本地文件
const localMap = new Map(localEntries.map((e) => [e.local_key, e]));

// 3. 检测新增和更新
for (const [key, local] of localMap) {
  const ckpt = checkpointMap.get(key);

  if (!ckpt) {
    to_add.push(local); // 新增
  } else if (local.source_fingerprint !== ckpt.source_fingerprint) {
    to_update.push({ ...local, record_id: ckpt.record_id }); // 更新
  }
}

// 4. 检测删除
for (const [key, ckpt] of checkpointMap) {
  if (!localMap.has(key) && !ckpt.deleted) {
    to_delete.push({ record_id: ckpt.record_id }); // 删除
  }
}
```

**复杂度**：O(n + m)，n=checkpoint条目数，m=本地条目数

---

## 4. Source Fingerprint vs Content Hash

### 4.1 现有：Content Hash（MD5）

```python
content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
```

**特点**：

- ✅ 快速计算
- ✅ 用于快速去重
- ❌ 包含时间戳（不稳定）
- ❌ 无法用于重建checkpoint

**问题**：

- 如果内容中包含时间戳，每次解析都会生成不同的hash
- 无法通过hash匹配现有记录

### 4.2 设计文档：Source Fingerprint（SHA256）

```javascript
function generateSourceFingerprint(content, metadata) {
  // 1. 规范化内容（去除时间戳）
  let normalized = content
    .replace(/\*\*Date\*\*:.*$/gm, "")
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "")
    .trim();

  // 2. 提取核心字段
  const core = {
    content: normalized,
    type: metadata.type,
    tags: metadata.tags.sort().join(","),
  };

  // 3. 生成SHA256
  return crypto.createHash("sha256").update(JSON.stringify(core)).digest("hex");
}
```

**特点**：

- ✅ 稳定（去除时间戳）
- ✅ 可用于重建checkpoint
- ✅ 标签排序规范化
- ⚠️ 计算稍慢（但可接受）

**用途**：

- 重建checkpoint时匹配现有记录
- 检测内容是否真正变化（忽略时间戳）

---

## 5. Checkpoint机制对比

### 5.1 现有实现

**状态**：❌ 无checkpoint机制

**问题**：

- 无法追踪同步状态
- 无法识别本地删除
- 无法实现增量同步
- 无法恢复同步状态

### 5.2 设计文档实现

**Checkpoint结构**：

```typescript
{
    record_id: "memory:01HQ...",
    local_key: "MEMORY.md:a1b2c3",
    source_fingerprint: "sha256:...",
    hash: "sha256:...",
    version: 3,
    last_op_id: "batch_123:5",
    synced_at: 1710648000000,
    deleted: false
}
```

**存储格式**：JSONL（追加写入）

**操作**：

- 加载：读取所有行，解析为Map
- 保存：原子写入（临时文件 + rename）
- 压缩：移除7天前的deleted条目

---

## 6. 错误处理对比

### 6.1 现有错误处理

**上传失败处理**：

```javascript
try {
  const result = await client.uploadMemories(batch);
  totalSuccess += result.success;
} catch {
  totalFailed += batch.length;
  batch.forEach((entry) => uploadQueue.addToQueue(entry));
}
```

**特点**：

- ✅ 失败加入重试队列
- ❌ 整批失败（无部分成功）
- ❌ 无法区分失败原因
- ❌ 重试次数限制（3次）

**重试队列**：

```json
{
    "failed_uploads": [
        {
            "timestamp": "2026-03-17...",
            "memory": {...},
            "retry_count": 2,
            "last_error": "Network error"
        }
    ]
}
```

### 6.2 设计文档错误处理

**部分成功处理**：

```typescript
{
    "results": {
        "added": [
            {"op_index": 0, "status": "success", ...},
            {"op_index": 1, "status": "failed", "error": "..."}
        ]
    }
}
```

**Checkpoint更新**：

```javascript
// 只更新成功的条目
for (const result of response.results.added) {
    if (result.status === 'success') {
        checkpointMap.set(entry.local_key, {
            record_id: result.record_id,
            version: result.version,
            ...
        });
    }
}
```

**特点**：

- ✅ 部分成功也能更新checkpoint
- ✅ 失败的条目可以单独重试
- ✅ 详细的错误信息

---

## 7. 删除保护对比

### 7.1 现有实现

**状态**：❌ 无删除保护

**问题**：

- 无法删除后端记忆（无删除API）
- 本地删除后后端仍保留
- 可能导致数据不一致

### 7.2 设计文档实现

**删除保护算法**：

```javascript
function validateDeletions(to_delete, checkpoint) {
  const deleteCount = to_delete.length;
  const totalCount = checkpoint.length;
  const deleteRatio = deleteCount / totalCount;

  // 阈值：20% 或 50条
  if (deleteRatio > 0.2 || deleteCount > 50) {
    throw new Error(`删除保护触发：${deleteCount}/${totalCount}`);
  }
}
```

**软删除**：

```sql
UPDATE memory SET
    metadata = metadata || { deleted: true, deleted_at: time::now() }
WHERE id = $id
```

**特点**：

- ✅ 防止误删大量数据
- ✅ 软删除（可恢复）
- ✅ 保留7天
- ✅ 需要--force跳过保护

---

## 8. 批量处理对比

### 8.1 现有批量处理

**批次大小**：10条/批（可配置）

**处理逻辑**：

```javascript
for (let i = 0; i < entries.length; i += batchSize) {
  const batch = entries.slice(i, i + batchSize);
  await client.uploadMemories(batch);
}
```

**特点**：

- ✅ 简单直接
- ❌ 多次网络请求
- ❌ 串行处理（慢）
- ❌ 整批失败

**性能**：

- 1000条 ÷ 10 = 100次请求
- 每次 ~200ms
- 总计：~20秒

### 8.2 设计文档批量处理

**批次大小**：20条/批（可配置）

**处理逻辑**：

```javascript
// 单次请求，包含所有操作
const result = await client.batchSync({
    batch_id: generateBatchId(),
    to_add: [...],
    to_update: [...],
    to_delete: [...]
});
```

**特点**：

- ✅ 单次请求
- ✅ 支持三种操作
- ✅ 部分成功
- ✅ 幂等性

**性能**：

- 10条变更 × 1次请求
- 耗时：~100ms
- **提升：200倍**

---

## 9. 并发控制对比

### 9.1 现有实现

**状态**：❌ 无并发控制

**问题**：

- 多个插件实例同时同步会冲突
- 后写入覆盖先写入
- 无法检测冲突

### 9.2 设计文档实现

**乐观锁**：

```sql
UPDATE memory SET
    content = $content,
    version = version + 1
WHERE id = $id AND version = $expected_version
```

**冲突处理**：

```javascript
if (result.status === "conflict") {
  // 1. 重新读取最新版本
  const latest = await client.getMemory(record_id);

  // 2. 合并修改
  const merged = mergeChanges(local, latest);

  // 3. 重试更新
  await client.updateMemory(record_id, merged, latest.version);
}
```

---

## 10. 关键问题总结

### 10.1 严重问题（P0）

| 问题       | 现有状态 | 设计文档 | 影响         |
| ---------- | -------- | -------- | ------------ |
| 变更检测   | ❌ 无    | ✅ 有    | 无法增量同步 |
| Checkpoint | ❌ 无    | ✅ 有    | 无法追踪状态 |
| 删除同步   | ❌ 无    | ✅ 有    | 数据不一致   |
| 并发控制   | ❌ 无    | ✅ 有    | 数据覆盖风险 |

### 10.2 重要问题（P1）

| 问题               | 现有状态 | 设计文档 | 影响               |
| ------------------ | -------- | -------- | ------------------ |
| Source Fingerprint | ❌ 无    | ✅ 有    | 无法重建checkpoint |
| 删除保护           | ❌ 无    | ✅ 有    | 误删风险           |
| 部分成功           | ❌ 无    | ✅ 有    | 效率低             |

---

**下一部分**：修正建议总结
