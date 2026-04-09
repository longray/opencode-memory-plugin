# Memory ID 混合关联方案设计

> 结合 file_path 的直观性和 source_id 的稳定性

**版本**: v1.0.0  
**更新时间**: 2026-04-09  
**关联任务**: BL-CA-33

---

## 1. 设计目标

### 核心矛盾

| 需求     | file_path       | source_id   |
| -------- | --------------- | ----------- |
| 人类可读 | ✅ 直观         | ❌ 机器生成 |
| 稳定性   | ❌ 会变化       | ✅ 永久不变 |
| 全局唯一 | ❌ 项目内唯一   | ✅ 全局唯一 |
| 版本追踪 | ❌ 需要额外处理 | ✅ 天然支持 |

### 解决方案

**分层映射架构**：

```
用户层 ──────▶ 逻辑层 ──────▶ 存储层 ──────▶ 后端层
file_path      source_id      memory_id      数据库
(直观)         (稳定)         (持久)
```

---

## 2. 架构设计

### 2.1 三层映射模型

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 用户层 (User Layer)                                │
│  ─────────────────────────                                   │
│  Key: file_path (相对路径)                                   │
│  Example: "src/utils.ts", "lib/auth.js"                     │
│                                                              │
│  职责:                                                       │
│  - 用户界面显示                                              │
│  - CLI 命令参数                                              │
│  - 配置文件引用                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: 逻辑层 (Logic Layer)                               │
│  ─────────────────────────                                   │
│  Key: source_id (ULID)                                       │
│  Example: "01H1ABC...", "01H2DEF..."                        │
│                                                              │
│  职责:                                                       │
│  - API 调用标识                                              │
│  - 缓存主键                                                  │
│  - 跨设备同步                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: 存储层 (Storage Layer)                             │
│  ─────────────────────────                                   │
│  Key: memory_id (后端生成)                                   │
│  Example: "memory:xyz...", "memory:abc..."                  │
│                                                              │
│  职责:                                                       │
│  - 后端数据库主键                                            │
│  - 调用关系引用                                              │
│  - 长期持久化                                                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 映射关系

```javascript
// 本地缓存结构 (memory-id-cache.json)
{
  "version": "1.0",
  "project_id": "my-project",
  "last_updated": "2026-04-09T10:30:00Z",
  "mappings": {
    // file_path → source_id (1:1)
    "src/utils.ts": {
      "source_id": "01H1ABC...",
      "memory_id": "memory:xyz...",
      "content_hash": "md5:abc123...",
      "last_synced": "2026-04-09T10:30:00Z"
    },
    "src/auth.ts": {
      "source_id": "01H2DEF...",
      "memory_id": "memory:abc...",
      "content_hash": "md5:def456...",
      "last_synced": "2026-04-09T10:30:00Z"
    }
  },
  // source_id → file_path (反向索引，用于快速查找)
  "reverse_index": {
    "01H1ABC...": "src/utils.ts",
    "01H2DEF...": "src/auth.ts"
  }
}
```

---

## 3. 核心流程

### 3.1 代码上传流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  分析代码    │────▶│  生成 ID    │────▶│  上传后端    │
│  src/utils.ts│     │  source_id  │     │  获取memory_id│
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  完成        │◀────│  保存缓存    │◀────│  返回结果    │
│             │     │  file_path  │     │  memory_id  │
│             │     │  source_id  │     │             │
│             │     │  memory_id  │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**详细步骤**:

```javascript
// Step 1: 分析代码
const analysis = await analyzer.analyze("src/utils.ts", code);

// Step 2: 生成 source_id（本地 ULID）
const sourceId = generateLocalId(); // 01H1ABC...

// Step 3: 上传后端
const result = await client.uploadMemories([
  {
    source_id: sourceId, // ✅ 传递 source_id
    local_id: sourceId,
    content: JSON.stringify(analysis),
    metadata: {
      file_path: "src/utils.ts", // ✅ 保存 file_path
      code_analysis: analysis,
    },
  },
]);

// Step 4: 获取 memory_id
const memoryId = result.memory_ids[0]; // memory:xyz...

// Step 5: 保存三层映射
cache.set("src/utils.ts", {
  source_id: sourceId,
  memory_id: memoryId,
  content_hash: calculateHash(code),
});
```

### 3.2 调用关系创建流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  发现调用    │────▶│  查询缓存    │────▶│  获取 IDs   │
│  auth→utils │     │  file_path  │     │  source_id  │
└─────────────┘     └─────────────┘     │  memory_id  │
                                        └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  完成        │◀────│  保存关系    │◀────│  创建关系    │
│             │     │  本地+后端   │     │  POST /calls │
└─────────────┘     └─────────────┘     └─────────────┘
```

**详细步骤**:

```javascript
// Step 1: 发现调用关系
const call = {
  caller_file: "src/auth.ts",
  caller_function: "login",
  callee_file: "src/utils.ts",
  callee_function: "hashPassword",
  line: 42,
  column: 15,
};

// Step 2: 通过 file_path 查询缓存
const caller = cache.get(call.caller_file); // {source_id, memory_id}
const callee = cache.get(call.callee_file); // {source_id, memory_id}

// Step 3: 创建调用关系（使用 memory_id）
await client.createCallRelations([
  {
    caller_memory_id: caller.memory_id,
    callee_memory_id: callee.memory_id,
    line: call.line,
    column: call.column,
    file_path: call.caller_file, // 可选，用于调试
  },
]);
```

### 3.3 缓存重建流程（当缓存丢失时）

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  缓存丢失    │────▶│  扫描本地    │────▶│  查询后端    │
│  需要memory_id│     │  代码文件    │     │  通过source_id│
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  恢复完成    │◀────│  重建缓存    │◀────│  返回结果    │
│             │     │  file_path  │     │  memory_id  │
│             │     │  source_id  │     │             │
│             │     │  memory_id  │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**详细步骤**:

```javascript
// Step 1: 扫描本地代码文件
const files = await scanCodeFiles("./src");

// Step 2: 从 entry 文件读取 source_id
for (const file of files) {
  const entry = await readEntryFile(file);
  const sourceId = entry.source_id; // 从本地文件读取

  // Step 3: 查询后端获取 memory_id
  const memoryId = await client.lookupMemory({
    source_id: sourceId, // 或 file_path + project_id
  });

  // Step 4: 重建缓存
  cache.set(entry.file_path, {
    source_id: sourceId,
    memory_id: memoryId,
  });
}
```

---

## 4. API 设计

### 4.1 前端缓存 API

```javascript
class MemoryIdCache {
  /**
   * 通过 file_path 获取 memory_id（用户层接口）
   * @param {string} filePath - 相对路径，如 "src/utils.ts"
   * @returns {Promise<string|null>} memory_id 或 null
   */
  async getMemoryId(filePath);

  /**
   * 通过 file_path 获取 source_id（逻辑层接口）
   * @param {string} filePath - 相对路径
   * @returns {Promise<string|null>} source_id 或 null
   */
  async getSourceId(filePath);

  /**
   * 通过 source_id 获取 file_path（反向查询）
   * @param {string} sourceId - source_id
   * @returns {Promise<string|null>} file_path 或 null
   */
  async getFilePath(sourceId);

  /**
   * 保存映射关系
   * @param {string} filePath - 文件路径
   * @param {string} sourceId - source_id
   * @param {string} memoryId - memory_id
   */
  async set(filePath, sourceId, memoryId);

  /**
   * 从本地 entry 文件重建缓存
   * @returns {Promise<number>} 重建的条目数
   */
  async rebuildFromLocal();

  /**
   * 从后端查询重建缓存
   * @returns {Promise<number>} 重建的条目数
   */
  async rebuildFromBackend();

  /**
   * 导出缓存（备份）
   * @returns {Promise<string>} JSON 字符串
   */
  async export();

  /**
   * 导入缓存（恢复）
   * @param {string} json - 缓存 JSON
   */
  async import(json);
}
```

### 4.2 后端 Lookup API（需要后端支持）

```http
# 通过 source_id 查询（精确匹配）
GET /api/v1/memories/lookup?source_id=01H1ABC...

# 通过 file_path 查询（需要 project_id）
GET /api/v1/memories/lookup?file_path=src/utils.ts&project_id=my-project

# 通过 content hash 查询
GET /api/v1/memories/lookup?hash=md5:abc123...

# 混合查询（按优先级匹配）
GET /api/v1/memories/lookup
  ?source_id=01H1ABC...
  &file_path=src/utils.ts
  &project_id=my-project

# 返回
{
  "memory_id": "memory:xyz...",
  "source_id": "01H1ABC...",
  "file_path": "src/utils.ts",
  "project_id": "my-project",
  "found": true
}
```

### 4.3 调用关系 API（使用 memory_id）

```http
# 创建调用关系（不变）
POST /api/v1/calls/batch
{
  "calls": [
    {
      "caller_memory_id": "memory:abc...",
      "callee_memory_id": "memory:xyz...",
      "line": 42,
      "column": 15,
      "file_path": "src/auth.ts"  // 可选，用于调试
    }
  ]
}

# 查询入站调用（谁调用了我）
GET /api/v1/memories/{memory_id}/references

# 查询出站调用（我调用了谁）
GET /api/v1/memories/{memory_id}/dependencies
```

---

## 5. 容错设计

### 5.1 缓存未命中处理

```javascript
async getMemoryId(filePath) {
  // 1. 检查内存缓存
  const cached = this.memoryCache.get(filePath);
  if (cached) return cached.memory_id;

  // 2. 检查磁盘缓存
  const diskCached = await this.loadFromDisk(filePath);
  if (diskCached) {
    this.memoryCache.set(filePath, diskCached);
    return diskCached.memory_id;
  }

  // 3. 从本地 entry 文件读取 source_id
  const sourceId = await this.readSourceIdFromEntry(filePath);
  if (sourceId) {
    // 4. 查询后端获取 memory_id
    const memoryId = await this.client.lookupMemory({ source_id: sourceId });
    if (memoryId) {
      await this.set(filePath, sourceId, memoryId);
      return memoryId;
    }
  }

  // 5. 通过 file_path 搜索后端（备选）
  const result = await this.client.searchMemories({
    query: filePath,
    code_filter: { file_path: filePath }
  });
  if (result.length > 0) {
    await this.set(filePath, result[0].source_id, result[0].id);
    return result[0].id;
  }

  // 6. 未找到，返回 null
  return null;
}
```

### 5.2 文件重命名检测

```javascript
// 通过 content hash 检测重命名
async detectRenamedFile(newFilePath, content) {
  const newHash = calculateHash(content);

  // 查找相同 hash 的不同路径
  for (const [path, data] of this.cache.entries()) {
    if (data.content_hash === newHash && path !== newFilePath) {
      // 发现重命名
      console.log(`Detected rename: ${path} -> ${newFilePath}`);

      // 更新缓存
      const entry = this.cache.get(path);
      this.cache.set(newFilePath, entry);
      this.cache.delete(path);

      return entry;
    }
  }

  return null;
}
```

### 5.3 多设备同步

```javascript
// 导出缓存（用于同步）
async exportForSync() {
  return {
    version: '1.0',
    project_id: this.projectId,
    mappings: Object.fromEntries(this.cache),
    exported_at: new Date().toISOString()
  };
}

// 导入缓存（合并）
async importFromSync(syncData) {
  for (const [filePath, data] of Object.entries(syncData.mappings)) {
    const existing = this.cache.get(filePath);

    // 保留最新的数据
    if (!existing || new Date(data.last_synced) > new Date(existing.last_synced)) {
      this.cache.set(filePath, data);
    }
  }

  await this.save();
}
```

---

## 6. 实施计划

### Phase 1: 基础实现（1-2 周）

1. **实现 MemoryIdCache 类**
   - 三层映射管理
   - 持久化到本地文件
   - 导出/导入功能

2. **修改代码上传流程**
   - 生成 source_id
   - 保存 file_path 到 metadata
   - 缓存 memory_id

3. **实现缓存重建**
   - 从本地 entry 文件读取
   - 基础容错处理

### Phase 2: 后端集成（2-4 周）

1. **与后端团队沟通**
   - 设计 lookup API
   - 确定查询优先级

2. **实现 lookup 客户端**
   - 支持 source_id 查询
   - 支持 file_path 查询（如果后端支持）

3. **完善容错机制**
   - 自动重建缓存
   - 重命名检测

### Phase 3: 优化（可选）

1. **多设备同步**
   - 缓存导出/导入
   - 云端同步（如果有账号系统）

2. **性能优化**
   - 缓存压缩
   - 增量更新

---

## 7. 优势总结

### 相比纯 file_path 方案

| 优势     | 说明                         |
| -------- | ---------------------------- |
| 稳定性   | source_id 不随文件重命名变化 |
| 全局唯一 | 避免多项目冲突               |
| 版本追踪 | 不同版本不同 source_id       |

### 相比纯 source_id 方案

| 优势     | 说明                            |
| -------- | ------------------------------- |
| 直观性   | 用户看到 file_path，而非机器 ID |
| 可恢复性 | 通过 file_path 可重建缓存       |
| 兼容性   | 支持现有基于路径的工具          |

### 相比纯 memory_id 方案

| 优势     | 说明             |
| -------- | ---------------- |
| 独立性   | 不依赖后端缓存   |
| 可重建性 | 缓存丢失后可恢复 |
| 灵活性   | 支持多种查询方式 |

---

## 8. 相关文档

- [API-CONTRACT.md](./API-CONTRACT.md) - 后端 API 映射
- [MEMORY-ID-CACHE-DESIGN.md](./MEMORY-ID-CACHE-DESIGN.md) - 缓存设计
- [../BACKLOG.md](../BACKLOG.md) - BL-CA-33 任务
