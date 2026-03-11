# 🔧 v2.0 核心组件集成 - 详细工作分析

## 📋 概览

**分析时间**: 2026-03-03  
**基准版本**: v1.2.1 (稳定)  
**目标版本**: v2.0 (开发中)  
**当前状态**: MemoryManager 已实现，NetworkChecker 和 WrapperClient 待实现

---

## 🎯 集成目标

### 核心任务

1. ✅ **MemoryManager** (已完成) - 727 行代码
2. ⏳ **NetworkChecker** (待实现) - 预估 2h
3. ⏳ **WrapperClient** (待实现) - 预估 3h
4. ⏳ **Plugin.js 集成** (待完成) - 预估 3h

**总预估工时**: 8 小时

---

## 📦 一、MemoryManager 实现分析

### 1.1 核心方法

| 方法                     | 参数                           | 返回值                             | 功能                   |
| ------------------------ | ------------------------------ | ---------------------------------- | ---------------------- |
| `write()`                | `{content, type, tags}`        | `Promise<{success, entry}>`        | 写入记忆到本地 MD 文件 |
| `read()`                 | `{file, projectTag, uploaded}` | `Promise<{entries, file, exists}>` | 读取记忆，支持过滤     |
| `getUnuploadedEntries()` | 无                             | `Promise<Array>`                   | 获取所有待上传的记忆   |
| `markAsUploaded()`       | `{entryIds, options}`          | `Promise<void>`                    | 标记记忆为已上传或失败 |

### 1.2 8 标签系统

| 标签                        | 类型     | 说明             | 示例                                 |
| --------------------------- | -------- | ---------------- | ------------------------------------ |
| `id`                        | string   | 记忆唯一标识符   | `entry_20260303_001`                 |
| `timestamp`                 | string   | ISO 8601 时间戳  | `2026-03-03T12:00:00Z`               |
| `type`                      | string   | 记忆类型         | `general`, `preference`, `decision`  |
| `tags`                      | string[] | 用户自定义标签   | `["typescript", "code-style"]`       |
| `project_tag`               | string   | 项目标签（分类） | `global`, `unclassified`, `projectA` |
| `project_id`                | string   | 项目唯一标识符   | `D:\github\project-a`                |
| `project_name`              | string   | 项目可读名称     | `My Project`                         |
| `uploaded`                  | boolean  | 上传状态         | `false`, `true`, `"failed"`          |
| `upload_timestamp`          | string   | 上传时间戳       | `2026-03-03T12:05:00Z`               |
| `upload_error`              | string   | 上传错误信息     | `"Connection timeout"`               |
| `classification_confidence` | number   | 分类置信度 (0-1) | `0.95`                               |
| `classified_at`             | string   | 分类时间戳       | `2026-03-03T12:01:00Z`               |
| `content`                   | string   | 记忆内容         | 用户输入的实际内容                   |

### 1.3 文件映射规则

```javascript
function getTargetFile(projectTag) {
  switch (projectTag) {
    case "global":
      return "GLOBAL_MEMORY.md"; // 全局记忆
    case "unclassified":
      return "MEMORY.md"; // 默认记忆（向后兼容）
    default:
      return "PROJECT_MEMORY.md"; // 所有项目记忆统一放这里
  }
}
```

### 1.4 项目标签检测逻辑

```javascript
// 基于内容中的文件路径自动检测项目标签
detectProjectTag(content) {
  // 1. 检测绝对路径模式
  const absolutePathMatch = content.match(/[A-Z]:\\[^\\s]+\//g);
  if (absolutePathMatch) {
    const path = absolutePathMatch[0];
    // 提取项目名称（最后一个目录）
    const projectName = path.split('\\').filter(Boolean).pop();
    // 生成项目 ID（哈希路径）
    const projectId = this.hashPath(path);
    return { project_tag: 'project', project_id: projectId, project_name: projectName };
  }

  // 2. 检测相对路径模式
  const relativePathMatch = content.match(/(\.\.\/|..\/|\.\.\\|..\\)[^\\s]+/g);
  if (relativePathMatch) {
    const path = relativePathMatch[0];
    const projectName = path.split(/[\/\\]/).filter(Boolean).pop();
    const projectId = this.hashPath(path);
    return { project_tag: 'project', project_id: projectId, project_name: projectName };
  }

  // 3. 默认：未分类
  return { project_tag: 'unclassified', project_id: null, project_name: null };
}
```

---

## 🌐 二、NetworkChecker 实现规格

### 2.1 文件位置

**路径**: `lib/network-checker.js`  
**状态**: ❌ 不存在，需要创建

### 2.2 类结构

```javascript
// lib/network-checker.js
export class NetworkChecker {
  constructor(options = {}) {
    this.config = {
      checkIntervalMs: options.checkIntervalMs || 60000, // 默认 1 分钟
      wrapperUrl: options.wrapperUrl || "http://localhost:3001",
      timeoutMs: options.timeoutMs || 5000,
    };

    this.lastStatus = null; // 最后一次健康状态
    this.statusHistory = []; // 健康状态历史
    this.checkTimer = null; // 定时器引用
    this.isRunning = false; // 是否正在运行
    this.onStatusChange = null; // 状态变化回调
  }
}
```

### 2.3 核心方法

| 方法          | 参数                       | 返回值                  | 功能             |
| ------------- | -------------------------- | ----------------------- | ---------------- |
| `start()`     | `onStatusChange(callback)` | `void`                  | 启动定时健康检查 |
| `stop()`      | 无                         | `void`                  | 停止定时检查     |
| `check()`     | 无                         | `Promise<HealthStatus>` | 执行一次健康检查 |
| `getStatus()` | 无                         | `HealthStatus`          | 获取当前健康状态 |
| `isHealthy()` | 无                         | `boolean`               | 判断服务是否健康 |

### 2.4 健康检查流程

```
定时器触发 (默认 1 分钟)
    ↓
fetch(GET http://localhost:3001/api/health)
    ↓
┌──────────────────────────────────────┐
│         响应处理                     │
├──────────────────────────────────────┤
│ HTTP 200 → 解析 JSON               │
│           ↓                          │
│         更新状态缓存                │
│           ↓                          │
│         触发回调                    │
│                                      │
│ HTTP error → 标记为 unhealthy       │
│           ↓                          │
│         更新状态缓存                │
│           ↓                          │
│         触发回调                    │
└──────────────────────────────────────┘
    ↓
返回 HealthStatus 对象
```

### 2.5 HealthStatus 对象结构

```javascript
{
  overall: 'healthy' | 'unhealthy' | 'degraded',
  timestamp: '2026-03-03T12:00:00Z',
  details: {
    wrapper: {
      status: 'up' | 'down' | 'timeout',
      responseTime: 150,  // ms
      lastCheck: '2026-03-03T12:00:00Z'
    },
    embedding: {
      status: 'up' | 'down' | 'timeout',
      model: 'Qwen3-Embedding-0.6B',
      lastCheck: '2026-03-03T12:00:00Z'
    }
  }
}
```

### 2.6 实现步骤

**Step 1: 创建文件结构** (15 分钟)

```bash
# 创建 network-checker.js
touch opencode-memory-plugin/lib/network-checker.js
```

**Step 2: 实现构造函数** (30 分钟)

```javascript
export class NetworkChecker {
  constructor(options = {}) {
    // 配置初始化
    // 状态初始化
  }
}
```

**Step 3: 实现 check() 方法** (45 分钟)

```javascript
async check() {
  try {
    const response = await fetch(`${this.config.wrapperUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(this.config.timeoutMs)
    });

    const data = await response.json();

    // 更新状态
    this.lastStatus = {
      overall: 'healthy',
      timestamp: new Date().toISOString(),
      details: data
    };

    // 触发回调
    if (this.onStatusChange) {
      this.onStatusChange(this.lastStatus);
    }

    return this.lastStatus;

  } catch (error) {
    // 错误处理
    this.lastStatus = {
      overall: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    };

    if (this.onStatusChange) {
      this.onStatusChange(this.lastStatus);
    }

    return this.lastStatus;
  }
}
```

**Step 4: 实现 start() 和 stop() 方法** (30 分钟)

**Step 5: 单元测试** (30 分钟)

---

## 📡 三、WrapperClient 实现规格

### 3.1 文件位置

**路径**: `lib/wrapper-client.js`  
**状态**: ❌ 不存在，需要创建

### 3.2 类结构

```javascript
// lib/wrapper-client.js
export class WrapperClient {
  constructor(options = {}) {
    this.config = {
      baseUrl: options.baseUrl || "http://localhost:3001",
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }
}
```

### 3.3 核心方法

| 方法            | 参数                              | 返回值                    | 功能           |
| --------------- | --------------------------------- | ------------------------- | -------------- |
| `search()`      | `{query, mode, limit, threshold}` | `Promise<SearchResult[]>` | 语义搜索       |
| `upload()`      | `{entries}`                       | `Promise<UploadResult>`   | 上传单个记忆   |
| `batchUpload()` | `{entries}`                       | `Promise<UploadResult[]>` | 批量上传记忆   |
| `request()`     | `{method, path, body}`            | `Promise<Response>`       | 通用 HTTP 请求 |

### 3.4 API 端点

| 端点                | 方法 | 功能     | 参数                                  |
| ------------------- | ---- | -------- | ------------------------------------- |
| `/api/search`       | POST | 语义搜索 | `query`, `mode`, `limit`, `threshold` |
| `/api/upload`       | POST | 上传记忆 | `entries`                             |
| `/api/batch-upload` | POST | 批量上传 | `entries`                             |

### 3.5 实现步骤

**Step 1: 创建文件结构** (15 分钟)

**Step 2: 实现 request() 方法（带重试）** (45 分钟)

```javascript
async request(method, path, body = null) {
  let lastError;

  for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
    try {
      const url = `${this.config.baseUrl}${path}`;
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null,
        signal: AbortSignal.timeout(this.config.timeout)
      });

      // 检查响应状态
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error) {
      lastError = error;

      // 如果不是最后一次尝试，等待后重试
      if (attempt < this.config.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  // 所有重试都失败
  throw lastError;
}
```

**Step 3: 实现 search() 方法** (30 分钟)

```javascript
async search({ query, mode = 'hybrid', limit = 10, threshold = 0.3 }) {
  return this.request('POST', '/api/search', {
    query,
    mode,
    limit,
    threshold
  });
}
```

**Step 4: 实现 upload() 方法** (30 分钟)

**Step 5: 实现 batchUpload() 方法** (30 分钟)

**Step 6: 单元测试** (30 分钟)

---

## 🔌 四、Plugin.js 集成工作

### 4.1 当前实现分析

#### 现有工具实现方式

**memory_write** (第 66-107 行):

```javascript
// 当前实现：直接操作文件系统
- 生成 Markdown 格式的条目
- 直接 fs.appendFileSync() 写入 MEMORY.md
- 简单的文件存在性检查
```

**memory_read** (第 109-138 行):

```javascript
// 当前实现：直接读取文件
- fs.readFileSync() 读取文件
- 统计行数和大小
- 返回完整文件内容
```

**memory_search** (第 140-189 行):

```javascript
// 当前实现：简单的关键词搜索
- 读取文件内容
- 逐行匹配（toLowerCase()）
- 返回前 10 个匹配结果
```

**vector_memory_search** (第 191-322 行):

```javascript
// 当前实现：调用 VectorStore
- 支持三种模式：vector, keyword, hybrid
- 有完整的回退机制（BM25, hash）
- 与外部 embedding 服务集成
```

### 4.2 集成策略

#### 策略 1：渐进式集成（推荐）

**优点**:

- 风险低，可以逐步验证
- 保持向后兼容性
- 可以先测试 MemoryManager

**步骤**:

1. **Phase 1**: 仅集成 MemoryManager 到 memory_write 和 memory_read
2. **Phase 2**: 实现 NetworkChecker 和 WrapperClient
3. **Phase 3**: 集成到 vector_memory_search
4. **Phase 4**: 实现自动上传功能

#### 策略 2：一次性重构

**优点**:

- 架构一致
- 一次性完成

**缺点**:

- 风险高
- 需要大量测试
- 可能破坏现有功能

**不推荐**。

### 4.3 具体集成步骤（渐进式）

#### Phase 1: 集成 MemoryManager (2h)

**Step 1.1: 导入 MemoryManager**

```javascript
// 在 plugin.js 顶部添加
import { MemoryManager } from "./lib/memory-manager.js";

// 在 MemoryPlugin 函数内部初始化
export const MemoryPlugin = async (ctx) => {
  // 初始化 MemoryManager
  const memoryManager = new MemoryManager();

  return {
    tool: {
      // ... 工具定义
    },
  };
};
```

**Step 1.2: 修改 memory_write 工具**

```javascript
memory_write: tool({
  description: "Write an entry to long-term memory with 8 metadata tags.",
  args: {
    content: tool.schema.string().describe("The content to write to memory"),
    type: tool.schema
      .string()
      .optional()
      .default("general")
      .describe("The type of entry"),
    tags: tool.schema
      .array(tool.schema.string())
      .optional()
      .default([])
      .describe("Tags for categorizing entry"),
  },
  async execute(args) {
    try {
      const { content, type, tags } = args;

      // 使用 MemoryManager 写入
      const result = await memoryManager.write({ content, type, tags });

      return `✅ Entry written successfully
- Type: ${result.entry.type}
- Tags: ${result.entry.tags.join(", ") || "none"}
- Project Tag: ${result.entry.project_tag}
- Project ID: ${result.entry.project_id || "N/A"}
- File: ${memoryManager.getTargetFile(result.entry.project_tag)}
- Entry ID: ${result.entry.id}`;
    } catch (e) {
      return `❌ Error writing to memory: ${e.message}`;
    }
  },
});
```

**Step 1.3: 修改 memory_read 工具**

```javascript
memory_read: tool({
  description: "Read from a memory file with optional filtering.",
  args: {
    file: tool.schema
      .string()
      .optional()
      .default("MEMORY.md")
      .describe("The memory file to read"),
    projectTag: tool.schema
      .string()
      .optional()
      .describe(
        "Filter by project tag (e.g., 'global', 'unclassified', or project ID)",
      ),
    uploaded: tool.schema
      .boolean()
      .optional()
      .describe("Filter by upload status"),
  },
  async execute(args) {
    try {
      const { file, projectTag, uploaded } = args;

      // 使用 MemoryManager 读取
      const { entries, exists } = await memoryManager.read({
        file,
        projectTag,
        uploaded,
      });

      if (!exists) {
        return `❌ File not found: ${file}`;
      }

      let result = `📖 Memory file: ${file}
- Entries: ${entries.length}
- File exists: ${exists}`;

      // 显示前 5 条记录
      if (entries.length > 0) {
        result += "\n\nRecent entries:\n";
        entries.slice(0, 5).forEach((entry) => {
          result += `\n[${entry.timestamp}] ${entry.type}: ${entry.content.substring(0, 50)}...`;
        });
      }

      return result;
    } catch (e) {
      return `❌ Error reading memory: ${e.message}`;
    }
  },
});
```

**验收标准**:

- ✅ 8 标签正确添加到记忆条目
- ✅ 项目标签自动检测和分类
- ✅ 文件映射规则正确应用
- ✅ 向后兼容现有功能

#### Phase 2: 实现 NetworkChecker 和 WrapperClient (5h)

按照上述 NetworkChecker 和 WrapperClient 的实现步骤完成。

#### Phase 3: 集成到 vector_memory_search (1h)

```javascript
vector_memory_search: tool({
  description:
    "Search memory using semantic vector search with remote service support.",
  args: {
    query: tool.schema.string().describe("The semantic search query"),
    mode: tool.schema
      .string()
      .optional()
      .default("hybrid")
      .describe("Search mode: 'vector', 'keyword', or 'hybrid'"),
    limit: tool.schema
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results"),
    threshold: tool.schema
      .number()
      .optional()
      .default(0.3)
      .describe("Minimum similarity score"),
  },
  async execute(args) {
    try {
      const { query, mode, limit, threshold } = args;

      // 优先使用远程服务（如果 NetworkChecker 显示健康）
      if (networkChecker && networkChecker.isHealthy()) {
        const results = await wrapperClient.search({
          query,
          mode,
          limit,
          threshold,
        });
        return formatSearchResults(results, "remote");
      }

      // 回退到本地搜索
      const vectorStore = getVectorStore();
      const results = await vectorStore.search(query, {
        mode,
        limit,
        threshold,
      });
      return formatSearchResults(results, "local");
    } catch (e) {
      return `❌ Error searching memory: ${e.message}`;
    }
  },
});
```

#### Phase 4: 实现自动上传功能 (可选，2h)

```javascript
// 新增工具：memory_upload
memory_upload: tool({
  description: "Upload unuploaded memories to remote service.",
  args: {
    batchSize: tool.schema
      .number()
      .optional()
      .default(10)
      .describe("Number of entries to upload per batch"),
  },
  async execute(args) {
    try {
      const { batchSize } = args;

      // 获取待上传的记忆
      const unuploaded = await memoryManager.getUnuploadedEntries();

      if (unuploaded.length === 0) {
        return `✅ No unuploaded memories found.`;
      }

      // 批量上传
      const uploadResults = [];
      for (let i = 0; i < unuploaded.length; i += batchSize) {
        const batch = unuploaded.slice(i, i + batchSize);
        const result = await wrapperClient.batchUpload({ entries: batch });
        uploadResults.push(...result);
      }

      // 标记为已上传
      const successIds = uploadResults
        .filter((r) => r.success)
        .map((r) => entryId);
      await memoryManager.markAsUploaded(successIds, { success: true });

      const failedIds = uploadResults
        .filter((r) => !r.success)
        .map((r) => entryId);
      await memoryManager.markAsUploaded(failedIds, {
        success: false,
        error: "Upload failed",
      });

      return `✅ Upload completed
- Total: ${unuploaded.length}
- Success: ${successIds.length}
- Failed: ${failedIds.length}`;
    } catch (e) {
      return `❌ Error uploading memories: ${e.message}`;
    }
  },
});
```

---

## 📋 五、工作清单

### 5.1 立即执行（本周）

| 任务                            | 预估工时 | 依赖                          | 状态      |
| ------------------------------- | -------- | ----------------------------- | --------- |
| 实现 NetworkChecker             | 2h       | -                             | ⏳ 待开始 |
| 实现 WrapperClient              | 3h       | -                             | ⏳ 待开始 |
| 集成 MemoryManager 到 plugin.js | 3h       | NetworkChecker, WrapperClient | ⏳ 待开始 |
| 添加单元测试                    | 2h       | 所有组件                      | ⏳ 待开始 |

**总计**: 10 小时

### 5.2 验收标准

#### NetworkChecker 验收

- ✅ 定时检查正常工作（默认 1 分钟）
- ✅ 健康状态正确更新
- ✅ 回调函数正确触发
- ✅ start() 和 stop() 正常工作
- ✅ getStatus() 和 isHealthy() 返回正确值

#### WrapperClient 验收

- ✅ HTTP 请求正常发送
- ✅ 重试机制正常工作（最多 3 次）
- ✅ 超时处理正常
- ✅ 错误处理完善
- ✅ search(), upload(), batchUpload() 正常工作

#### Plugin.js 集成验收

- ✅ memory_write 使用 MemoryManager
- ✅ memory_read 使用 MemoryManager
- ✅ 8 标签正确添加
- ✅ 项目标签自动检测
- ✅ 文件映射规则正确
- ✅ 向后兼容现有功能
- ✅ vector_memory_search 支持远程服务

### 5.3 测试计划

#### 单元测试

```javascript
// tests/lib/network-checker.test.js
describe("NetworkChecker", () => {
  test("should initialize with default config", () => {
    /* ... */
  });
  test("should perform health check", async () => {
    /* ... */
  });
  test("should start and stop timer", () => {
    /* ... */
  });
  test("should handle timeout", async () => {
    /* ... */
  });
});

// tests/lib/wrapper-client.test.js
describe("WrapperClient", () => {
  test("should initialize with default config", () => {
    /* ... */
  });
  test("should perform search request", async () => {
    /* ... */
  });
  test("should retry on failure", async () => {
    /* ... */
  });
  test("should handle timeout", async () => {
    /* ... */
  });
});
```

#### 集成测试

```javascript
// tests/integration/memory-manager-integration.test.js
describe("MemoryManager Integration", () => {
  test("should write and read entry", async () => {
    /* ... */
  });
  test("should detect project tag", async () => {
    /* ... */
  });
  test("should mark as uploaded", async () => {
    /* ... */
  });
});
```

---

## 🚀 六、执行计划

### Day 1: NetworkChecker 实现

- **Morning**: 创建文件结构 + 构造函数
- **Afternoon**: 实现 check() + start() + stop() 方法
- **Evening**: 单元测试

### Day 2: WrapperClient 实现

- **Morning**: 创建文件结构 + 构造函数 + request() 方法
- **Afternoon**: 实现 search() + upload() + batchUpload() 方法
- **Evening**: 单元测试

### Day 3: Plugin.js 集成

- **Morning**: 集成 MemoryManager 到 memory_write + memory_read
- **Afternoon**: 集成 NetworkChecker 和 WrapperClient 到 vector_memory_search
- **Evening**: 集成测试

### Day 4: 测试和修复

- **Morning**: 运行所有单元测试
- **Afternoon**: 运行集成测试
- **Evening**: 修复发现的问题

### Day 5: 文档和发布

- **Morning**: 更新文档
- **Afternoon**: 代码审查
- **Evening**: 提交和发布

---

## 📊 七、风险和缓解

| 风险           | 影响                            | 概率 | 缓解措施              |
| -------------- | ------------------------------- | ---- | --------------------- |
| 外部服务不可用 | vector_memory_search 回退到本地 | 中   | 完善的回退机制        |
| 网络检查失败   | 状态不准确                      | 低   | 超时重试 + 错误日志   |
| 向后兼容性破坏 | 现有功能失效                    | 低   | 渐进式集成 + 充分测试 |
| 性能下降       | 8 标签增加处理时间              | 低   | 优化标签生成逻辑      |

---

## ✅ 八、成功指标

### 功能完整性

- ✅ 所有 3 个核心组件实现
- ✅ MemoryManager 集成到 plugin.js
- ✅ 8 标签系统正常工作
- ✅ 项目标签自动检测
- ✅ 上传状态管理

### 测试覆盖

- ✅ NetworkChecker 单元测试 ≥ 80%
- ✅ WrapperClient 单元测试 ≥ 80%
- ✅ 集成测试 ≥ 70%

### 性能

- ✅ memory_write 响应时间 < 100ms
- ✅ memory_read 响应时间 < 50ms
- ✅ vector_memory_search 响应时间 < 200ms

### 向后兼容性

- ✅ 现有工具功能不受影响
- ✅ 现有 API 保持兼容
- ✅ 用户体验无变化

---

**报告生成时间**: 2026-03-03  
**预估总工时**: 10 小时  
**推荐执行方式**: 渐进式集成（分 4 个 Phase）
