# Memory ID 缓存设计文档

> 代码分析 v1.4 调用关系功能的基础设施

**版本**: v1.0.0  
**更新时间**: 2026-04-09  
**关联任务**: BL-CA-33

---

## 背景

后端 `POST /api/v1/calls/batch` API 要求使用 `memory_id` 而非 `file_path` 来标识函数：

```json
{
  "calls": [
    {
      "caller_memory_id": "01H1ABC...", // 必需
      "callee_memory_id": "01H2DEF...", // 必需
      "line": 42,
      "column": 10
    }
  ]
}
```

前端需要维护本地缓存来存储 `file_path` → `memory_id` 的映射关系。

---

## 设计目标

1. **可靠性**: 缓存持久化，跨会话可用
2. **性能**: 内存级查询速度
3. **一致性**: 与后端数据同步
4. **可维护性**: 支持缓存清理和重建

---

## 架构设计

### 数据流

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   代码分析       │────▶│   上传代码       │────▶│  后端返回        │
│  (提取调用关系)  │     │  (POST /memories)│     │  memory_id      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  创建调用关系    │◀────│  查询 memory_id  │◀────│  保存到缓存      │
│ (POST /calls)   │     │  (MemoryIdCache) │     │  (本地文件)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 缓存结构

```javascript
// 内存缓存
Map<string, string> {
  "src/utils.ts": "01H1ABC...",
  "src/auth.ts": "01H2DEF...",
  "src/api.ts": "01H3GHI..."
}

// 持久化文件 (~/.opencode/memory-id-cache.json)
{
  "version": "1.0",
  "project_id": "my-project",
  "last_updated": "2026-04-09T10:30:00Z",
  "mappings": {
    "src/utils.ts": "01H1ABC...",
    "src/auth.ts": "01H2DEF...",
    "src/api.ts": "01H3GHI..."
  }
}
```

---

## API 设计

### MemoryIdCache 类

```javascript
class MemoryIdCache {
  // 构造函数
  constructor(projectId, cacheDir)

  // 核心方法
  set(filePath, memoryId): void
  get(filePath): string | undefined
  has(filePath): boolean
  delete(filePath): boolean
  clear(): void

  // 批量操作
  setBatch(mappings: Map<string, string>): void
  getBatch(filePaths: string[]): Map<string, string>

  // 持久化
  load(): Promise<void>
  save(): Promise<void>

  // 工具
  getStats(): { total, hitRate, lastUpdated }
  validate(): { valid, invalid, missing }
}
```

### 使用示例

```javascript
// 初始化缓存
const cache = new MemoryIdCache("my-project");
await cache.load();

// 保存映射（上传代码后）
cache.set("src/utils.ts", "01H1ABC...");
cache.set("src/auth.ts", "01H2DEF...");
await cache.save();

// 查询映射（创建调用关系前）
const callerId = cache.get("src/auth.ts");
const calleeId = cache.get("src/utils.ts");

// 创建调用关系
await client.createCallRelations([
  {
    caller_memory_id: callerId,
    callee_memory_id: calleeId,
    line: 42,
    column: 10,
  },
]);
```

---

## 集成点

### 1. 代码分析服务 (code-analysis-service.js)

```javascript
// 上传代码后保存 memory_id
async function uploadCodeAnalysis(filePath, analysis) {
  const result = await client.uploadMemories([
    {
      type: "code",
      content: JSON.stringify(analysis),
      // ...
    },
  ]);

  // 保存返回的 memory_id
  if (result.success && result.id) {
    memoryIdCache.set(filePath, result.id);
    await memoryIdCache.save();
  }
}
```

### 2. WrapperClient (wrapper-client.js)

```javascript
// 添加调用关系 API 方法
async createCallRelations(calls) {
  return this.request('/api/v1/calls/batch', {
    method: 'POST',
    body: { calls }
  });
}

async getCallReferences(memoryId, limit = 50) {
  return this.request(`/api/v1/memories/${memoryId}/references?limit=${limit}`);
}

async getCallDependencies(memoryId, limit = 50) {
  return this.request(`/api/v1/memories/${memoryId}/dependencies?limit=${limit}`);
}
```

---

## 错误处理

### 缓存未命中

```javascript
const memoryId = cache.get("src/unknown.ts");
if (!memoryId) {
  // 选项 1: 重新上传代码
  // 选项 2: 从后端查询（如果支持）
  // 选项 3: 跳过该文件的调用关系
}
```

### 缓存损坏

```javascript
try {
  await cache.load();
} catch (error) {
  // 重建缓存
  cache.clear();
  await rebuildCacheFromBackend();
}
```

---

## 性能考虑

### 内存使用

- 每个映射约 100 字节（路径 + ID）
- 1000 个文件约 100KB 内存
- 可忽略不计

### 磁盘 I/O

- 批量保存时写入（非每次操作）
- 使用防抖避免频繁写入
- 文件大小约 50KB（1000 个文件）

---

## 安全考虑

1. **数据隐私**: 缓存只存储 memory_id，不包含代码内容
2. **访问控制**: 缓存文件存储在用户目录，其他用户不可读
3. **数据完整性**: JSON 格式，易于验证和修复

---

## 未来扩展

1. **分布式缓存**: 支持多设备同步
2. **缓存压缩**: 大项目时压缩存储
3. **增量更新**: 只保存变更的部分
4. **缓存预热**: 启动时预加载常用项目

---

## 相关文档

- [API-CONTRACT.md](./API-CONTRACT.md) - 后端 API 映射
- [CODE-ANALYSIS-DESIGN-v1.4.md](./CODE-ANALYSIS-DESIGN-v1.4.md) - 代码分析设计
- [../BACKLOG.md](../BACKLOG.md) - BL-CA-33 任务
