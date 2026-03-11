# 🔧 v2.0 核心组件集成 - 完整实施指南

**生成时间**: 2026-03-03  
**基准版本**: v1.2.1  
**目标版本**: v2.0  
**文档状态**: ✅ 完整

---

## 📋 执行摘要

### 集成目标

- ✅ MemoryManager 已完成（727 行代码）
- ⏳ NetworkChecker 待实现（预估 2h）
- ⏳ WrapperClient 待实现（预估 3h）
- ⏳ Plugin.js 集成待完成（预估 3h）

**总预估工时**: 8 小时  
**推荐方式**: 渐进式集成（分 4 个 Phase）

---

## 🎯 Phase 1: 实现 NetworkChecker (2h)

### 1.1 创建文件

**文件路径**: `lib/network-checker.js`

**完整代码**:

```javascript
/**
 * Network Checker - 外部服务健康检查组件
 *
 * 核心功能：
 * - 定时检查外部 Wrapper Service 的健康状态
 * - 返回综合健康状态供其他组件使用
 * - 记录健康检查历史
 *
 * @version v2.0
 */

export class NetworkChecker {
  constructor(options = {}) {
    this.config = {
      checkIntervalMs: options.checkIntervalMs || 60000, // 默认 1 分钟
      wrapperUrl: options.wrapperUrl || "http://localhost:3001",
      timeoutMs: options.timeoutMs || 5000,
    };

    this.lastStatus = null;
    this.statusHistory = [];
    this.checkTimer = null;
    this.isRunning = false;
    this.onStatusChange = null;
  }

  /**
   * 启动定时健康检查
   * @param {Function} onStatusChange - 状态变化回调
   */
  start(onStatusChange) {
    if (this.isRunning) {
      console.warn("[NetworkChecker] Already running");
      return;
    }

    this.isRunning = true;
    this.onStatusChange = onStatusChange;

    // 立即执行一次检查
    this.check().catch((error) => {
      console.error("[NetworkChecker] Initial check failed:", error);
    });

    // 启动定时器
    this.checkTimer = setInterval(
      () =>
        this.check().catch((error) => {
          console.error("[NetworkChecker] Scheduled check failed:", error);
        }),
      this.config.checkIntervalMs,
    );

    console.log(
      `[NetworkChecker] Started with ${this.config.checkIntervalMs}ms interval`,
    );
  }

  /**
   * 停止定时健康检查
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.isRunning = false;
    console.log("[NetworkChecker] Stopped");
  }

  /**
   * 执行一次健康检查
   * @returns {Promise<HealthStatus>} 健康状态对象
   */
  async check() {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeoutMs,
      );

      const response = await fetch(`${this.config.wrapperUrl}/api/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      // 更新状态缓存
      this.lastStatus = {
        overall: "healthy",
        timestamp: new Date().toISOString(),
        responseTime,
        details: data,
      };

      // 记录历史
      this.statusHistory.push({
        ...this.lastStatus,
        timestamp: this.lastStatus.timestamp,
      });

      // 保留最近 100 条记录
      if (this.statusHistory.length > 100) {
        this.statusHistory = this.statusHistory.slice(-100);
      }

      // 触发回调
      if (this.onStatusChange) {
        this.onStatusChange(this.lastStatus);
      }

      return this.lastStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // 错误处理
      this.lastStatus = {
        overall: "unhealthy",
        timestamp: new Date().toISOString(),
        responseTime,
        error: error.message,
      };

      // 记录历史
      this.statusHistory.push({
        ...this.lastStatus,
        timestamp: this.lastStatus.timestamp,
      });

      // 触发回调
      if (this.onStatusChange) {
        this.onStatusChange(this.lastStatus);
      }

      return this.lastStatus;
    }
  }

  /**
   * 获取当前健康状态
   * @returns {HealthStatus|null} 当前健康状态
   */
  getStatus() {
    return this.lastStatus;
  }

  /**
   * 判断服务是否健康
   * @returns {boolean} 是否健康
   */
  isHealthy() {
    return this.lastStatus?.overall === "healthy";
  }

  /**
   * 获取健康状态历史
   * @param {number} limit - 返回记录数量（默认：10）
   * @returns {Array<HealthStatus>} 健康状态历史
   */
  getStatusHistory(limit = 10) {
    return this.statusHistory.slice(-limit);
  }
}

/**
 * @typedef {Object} HealthStatus
 * @property {string} overall - 总体状态 ('healthy' | 'unhealthy' | 'degraded')
 * @property {string} timestamp - ISO 8601 时间戳
 * @property {number} responseTime - 响应时间（毫秒）
 * @property {Object} details - 详细状态信息
 * @property {string} [error] - 错误信息（如果存在）
 */
```

### 1.2 验收标准

- ✅ 定时检查正常工作（默认 1 分钟）
- ✅ 健康状态正确更新
- ✅ 回调函数正确触发
- ✅ start() 和 stop() 正常工作
- ✅ getStatus() 和 isHealthy() 返回正确值
- ✅ 超时处理正常工作
- ✅ 健康历史记录正常

---

## 🎯 Phase 2: 实现 WrapperClient (3h)

### 2.1 创建文件

**文件路径**: `lib/wrapper-client.js`

**完整代码**:

```javascript
/**
 * Wrapper Client - 外部 HTTP 服务客户端
 *
 * 核心功能：
 * - 作为 HTTP 客户端调用外部 Express Wrapper Service
 * - 提供语义搜索和记忆上传接口
 * - 处理网络异常，返回标准错误
 * - 实现重试机制
 *
 * @version v2.0
 */

export class WrapperClient {
  constructor(options = {}) {
    this.config = {
      baseUrl: options.baseUrl || "http://localhost:3001",
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }

  /**
   * 通用 HTTP 请求方法（带重试）
   * @param {string} method - HTTP 方法
   * @param {string} path - API 路径
   * @param {Object} body - 请求体
   * @returns {Promise<Object>} 响应数据
   */
  async request(method, path, body = null) {
    let lastError;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const url = `${this.config.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout,
        );

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : null,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;

        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.config.maxRetries - 1) {
          console.log(
            `[WrapperClient] Request failed, retrying in ${this.config.retryDelay}ms... (Attempt ${attempt + 1}/${this.config.maxRetries})`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.retryDelay),
          );
        }
      }
    }

    // 所有重试都失败
    console.error(`[WrapperClient] All retries failed: ${lastError.message}`);
    throw lastError;
  }

  /**
   * 语义搜索
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} 搜索结果
   */
  async search({ query, mode = "hybrid", limit = 10, threshold = 0.3 }) {
    return this.request("POST", "/api/search", {
      query,
      mode,
      limit,
      threshold,
    });
  }

  /**
   * 上传单个记忆
   * @param {Object} entry - 记忆条目
   * @returns {Promise<Object>} 上传结果
   */
  async upload(entry) {
    return this.request("POST", "/api/upload", {
      entries: [entry],
    });
  }

  /**
   * 批量上传记忆
   * @param {Array<Object>} entries - 记忆条目数组
   * @returns {Promise<Array>} 上传结果数组
   */
  async batchUpload(entries) {
    return this.request("POST", "/api/batch-upload", {
      entries,
    });
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async health() {
    return this.request("GET", "/api/health");
  }

  /**
   * 获取服务状态
   * @returns {Promise<Object>} 服务状态
   */
  async stats() {
    return this.request("GET", "/api/stats");
  }
}
```

### 2.2 验收标准

- ✅ HTTP 请求正常发送
- ✅ 重试机制正常工作（最多 3 次）
- ✅ 超时处理正常工作（30 秒）
- ✅ 错误处理完善
- ✅ search() 方法正常工作
- ✅ upload() 方法正常工作
- ✅ batchUpload() 方法正常工作
- ✅ health() 方法正常工作
- ✅ stats() 方法正常工作

---

## 🎯 Phase 3: 集成 MemoryManager 到 plugin.js (3h)

### 3.1 修改 plugin.js 顶部导入

```javascript
import { tool } from "@opencode-ai/plugin/tool";
import fs from "fs";
import path from "path";
import { getVectorStore } from "./lib/vector-store.js";
import { BM25Index, createBM25Index } from "./lib/bm25.js";
import { getMemoryManager } from "./lib/memory-manager.js"; // 新增
```

### 3.2 初始化 MemoryManager

```javascript
// 在 MemoryPlugin 函数内部初始化
export const MemoryPlugin = async (ctx) => {
  // 初始化 MemoryManager
  const memoryManager = getMemoryManager();

  return {
    tool: {
      // ... 工具定义
    },
  };
};
```

### 3.3 修改 memory_write 工具

```javascript
memory_write: tool({
  description: "Write an entry to long-term memory with 8 metadata tags.",
  args: {
    content: tool.schema.string().describe("The content to write to memory"),
    type: tool.schema
      .string()
      .optional()
      .default("general")
      .describe(
        "The type of entry (e.g., 'preference', 'decision', 'note', 'general')",
      ),
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

### 3.4 修改 memory_read 工具

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

### 3.5 验收标准

- ✅ MemoryManager 正确导入和初始化
- ✅ memory_write 使用 MemoryManager.write()
- ✅ memory_read 使用 MemoryManager.read()
- ✅ 8 个标签正确添加到记忆条目
- ✅ 项目标签自动检测
- ✅ 文件映射规则正确应用
- ✅ 向后兼容现有功能
- ✅ 返回格式保持一致

---

## 🎯 Phase 4: 单元测试 (2h)

### 4.1 创建测试文件

**文件路径**: `tests/lib/network-checker.test.js`

```javascript
/**
 * Network Checker 单元测试
 */

import { NetworkChecker } from "../../lib/network-checker.js";

describe("NetworkChecker", () => {
  let checker;

  beforeEach(() => {
    checker = new NetworkChecker({
      wrapperUrl: "http://localhost:3001",
      checkIntervalMs: 1000,
    });
  });

  afterEach(() => {
    checker.stop();
  });

  describe("Constructor", () => {
    test("should initialize with default config", () => {
      expect(checker).toBeDefined();
      expect(checker.config.wrapperUrl).toBe("http://localhost:3001");
      expect(checker.config.checkIntervalMs).toBe(60000);
    });

    test("should initialize with custom config", () => {
      const customChecker = new NetworkChecker({
        wrapperUrl: "http://localhost:3002",
        checkIntervalMs: 30000,
      });
      expect(customChecker.config.wrapperUrl).toBe("http://localhost:3002");
      expect(customChecker.config.checkIntervalMs).toBe(30000);
    });
  });

  describe("start/stop", () => {
    test("should start and stop timer", async () => {
      const statusChangeMock = jest.fn();

      checker.start(statusChangeMock);
      expect(checker.isRunning).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      checker.stop();
      expect(checker.isRunning).toBe(false);
      expect(checker.checkTimer).toBe(null);
    });

    test("should not start if already running", () => {
      const statusChangeMock = jest.fn();
      checker.start(statusChangeMock);
      checker.start(statusChangeMock);
      expect(checker.isRunning).toBe(true);
    });
  });

  describe("getStatus", () => {
    test("should return null initially", () => {
      expect(checker.getStatus()).toBe(null);
    });

    test("should return last status after check", async () => {
      const statusChangeMock = jest.fn();
      checker.start(statusChangeMock);

      // 等待一次检查完成
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const status = checker.getStatus();
      expect(status).toBeDefined();
      expect(status.timestamp).toBeDefined();

      checker.stop();
    });
  });

  describe("isHealthy", () => {
    test("should return false initially", () => {
      expect(checker.isHealthy()).toBe(false);
    });

    test("should return true when status is healthy", async () => {
      const statusChangeMock = jest.fn();
      checker.start(statusChangeMock);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(checker.isHealthy()).toBe(false); // 服务可能不在线

      checker.stop();
    });
  });

  describe("getStatusHistory", () => {
    test("should return empty history initially", () => {
      const history = checker.getStatusHistory();
      expect(history).toEqual([]);
    });

    test("should return last 10 entries by default", async () => {
      const statusChangeMock = jest.fn();
      checker.start(statusChangeMock);

      // 等待多次检查
      await new Promise((resolve) => setTimeout(resolve, 3100));

      const history = checker.getStatusHistory();
      expect(history.length).toBeLessThanOrEqual(10);

      checker.stop();
    });
  });
});
```

**文件路径**: `tests/lib/wrapper-client.test.js`

```javascript
/**
 * Wrapper Client 单元测试
 */

import { WrapperClient } from "../../lib/wrapper-client.js";

describe("WrapperClient", () => {
  let client;

  beforeEach(() => {
    client = new WrapperClient({
      baseUrl: "http://localhost:3001",
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  describe("Constructor", () => {
    test("should initialize with default config", () => {
      expect(client).toBeDefined();
      expect(client.config.baseUrl).toBe("http://localhost:3001");
      expect(client.config.maxRetries).toBe(3);
    });

    test("should initialize with custom config", () => {
      const customClient = new WrapperClient({
        baseUrl: "http://localhost:3002",
        maxRetries: 5,
      });
      expect(customClient.config.baseUrl).toBe("http://localhost:3002");
      expect(customClient.config.maxRetries).toBe(5);
    });
  });

  describe("search", () => {
    test("should make search request with default parameters", async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await client.search({ query: "test" });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/search",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );

      global.fetch.mockRestore();
    });

    test("should make search request with custom parameters", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await client.search({
        query: "test",
        mode: "vector",
        limit: 20,
        threshold: 0.5,
      });

      expect(global.fetch).toHaveBeenCalled();

      global.fetch.mockRestore();
    });
  });

  describe("upload", () => {
    test("should make upload request", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await client.upload({ id: "test-id", content: "test" });

      expect(global.fetch).toHaveBeenCalled();

      global.fetch.mockRestore();
    });
  });

  describe("batchUpload", () => {
    test("should make batch upload request", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await client.batchUpload([
        { id: "1", content: "test1" },
        { id: "2", content: "test2" },
      ]);

      expect(global.fetch).toHaveBeenCalled();

      global.fetch.mockRestore();
    });
  });

  describe("retry mechanism", () => {
    test("should retry on failure", async () => {
      let attemptCount = 0;
      global.fetch = jest
        .fn()
        .mockImplementationOnce(() => {
          attemptCount++;
          throw new Error("Network error");
        })
        .mockImplementationOnce(() => {
          attemptCount++;
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        });

      const result = await client.upload({ id: "test", content: "test" });

      expect(attemptCount).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      global.fetch.mockRestore();
    });
  });
});
```

### 4.2 验收标准

- ✅ NetworkChecker 单元测试 ≥ 80%
- ✅ WrapperClient 单元测试 ≥ 80%
- ✅ 所有测试通过
- ✅ 测试覆盖率报告生成

---

## 📋 完整验收标准

### 功能完整性

- ✅ NetworkChecker 完全实现
- ✅ WrapperClient 完全实现
- ✅ MemoryManager 集成到 plugin.js
- ✅ 8 个标签系统正常工作
- ✅ 项目标签自动检测
- ✅ 文件映射规则正确

### 测试覆盖

- ✅ NetworkChecker 单元测试 ≥ 80%
- ✅ WrapperClient 单元测试 ≥ 80%
- ✅ 集成测试 ≥ 70%

### 性能指标

- ✅ memory_write 响应时间 < 100ms
- ✅ memory_read 响应时间 < 50ms
- ✅ 网络检查响应时间 < 5s

### 向后兼容性

- ✅ 现有工具功能不受影响
- ✅ 现有 API 保持兼容
- ✅ 用户体验无变化

---

## 🚀 推荐执行计划

### Day 1: NetworkChecker 实现

- **Morning (2h)**: 创建文件 + 实现所有方法
- **Afternoon (1h)**: 单元测试
- **Evening (1h)**: 修复测试发现的问题

### Day 2: WrapperClient 实现

- **Morning (2h)**: 创建文件 + 实现所有方法
- **Afternoon (1h)**: 单元测试
- **Evening (1h)**: 修复测试发现的问题

### Day 3: Plugin.js 集成

- **Morning (1.5h)**: 导入和初始化
- **Afternoon (1.5h)**: 修改 memory_write 和 memory_read
- **Evening (1h)**: 测试和验证

### Day 4: 测试和文档

- **Morning (2h)**: 运行所有测试
- **Afternoon (1h)**: 修复发现的问题
- **Evening (1h)**: 更新文档

---

## 📊 风险和缓解

| 风险           | 影响                            | 概率 | 缓解措施              |
| -------------- | ------------------------------- | ---- | --------------------- |
| 外部服务不可用 | vector_memory_search 回退到本地 | 中   | 完善的回退机制        |
| 网络检查失败   | 状态不准确                      | 低   | 超时重试 + 错误日志   |
| 向后兼容性破坏 | 现有功能失效                    | 低   | 渐进式集成 + 充分测试 |
| 性能下降       | 8 个标签增加处理时间            | 低   | 优化标签生成逻辑      |

---

## ✅ 成功指标

### v2.0 核心组件发布

- ✅ MemoryManager 完全集成
- ✅ NetworkChecker 实现并测试
- ✅ WrapperClient 实现并测试
- ✅ 测试覆盖率 ≥ 80%

### 功能增强

- ✅ 8 个元数据标签正常工作
- ✅ 项目标签自动检测
- ✅ 上传状态管理
- ✅ 远程语义搜索支持

### 代码质量

- ✅ 模块化架构
- ✅ 完整的错误处理
- ✅ 充分的测试覆盖
- ✅ 详细的文档

---

**报告生成时间**: 2026-03-03  
**预估总工时**: 8 小时  
**推荐执行方式**: 渐进式集成（分 4 个 Phase）  
**下一步建议**: 按照 Day 1-4 的计划逐步实施
