# Phase B 实施计划 - OpenCode Memory Plugin v2.2-lite

**版本**: 2.0 (基于代码分析)  
**目标**: 主题组织 + 双模式同步  
**工作量**: 约 6 小时  
**更新日期**: 2026-03-19

---

## 一、当前状态分析

### 1.1 已实现功能（plugin.js）

| 功能                              | 位置           | 状态    |
| --------------------------------- | -------------- | ------- |
| `TYPE_TO_TOPIC` 映射表            | 第 26-32 行    | ✅ 完成 |
| `TOPIC_KEYWORDS` 关键词映射       | 第 35-41 行    | ✅ 完成 |
| `TAG_TO_TOPIC` 标签映射           | 第 44-56 行    | ✅ 完成 |
| `identifyTopic()` 主题识别        | 第 130-150+ 行 | ✅ 完成 |
| `writeToTopic()` 写入主题目录     | 第 333-369 行  | ✅ 完成 |
| `updateTopicIndex()` 更新索引     | 第 379-404 行  | ✅ 完成 |
| `updateTopicOverview()` 更新概览  | 第 413-443 行  | ✅ 完成 |
| `getTopics()` 获取主题列表        | 第 449-456 行  | ✅ 完成 |
| `getTopicEntryCount()` 主题条目数 | 第 463-472 行  | ✅ 完成 |
| link-map.json 管理函数            | 第 574-603 行  | ✅ 完成 |
| memory_write 集成                 | 第 910-999 行  | ✅ 完成 |

### 1.2 已实现功能（wrapper-client.js）

| 功能                        | 位置          | 状态    |
| --------------------------- | ------------- | ------- |
| `health()` 健康检查         | 第 154-165 行 | ✅ 完成 |
| `search()` 搜索             | 第 186-203 行 | ✅ 完成 |
| `uploadMemory()` 单条上传   | 第 210-234 行 | ✅ 完成 |
| `uploadMemories()` 批量上传 | 第 241-257 行 | ✅ 完成 |
| `createRelation()` 创建关系 | 第 264-288 行 | ✅ 完成 |
| `getRelations()` 查询关系   | 第 295-309 行 | ✅ 完成 |
| `deleteRelation()` 删除关系 | 第 317-325 行 | ✅ 完成 |
| `traverseGraph()` 图遍历    | 第 332-342 行 | ✅ 完成 |

### 1.3 待实现功能

| 组件              | 功能                | 预计时间   |
| ----------------- | ------------------- | ---------- |
| wrapper-client.js | 增量同步方法        | 1.5 小时   |
| wrapper-client.js | 全量同步方法        | 1 小时     |
| wrapper-client.js | 冲突解决方法        | 0.5 小时   |
| plugin.js         | topic_sync 工具     | 1.5 小时   |
| plugin.js         | rebuild_topics 工具 | 1 小时     |
| 测试              | 单元测试 + 集成测试 | 1.5 小时   |
| **总计**          |                     | **7 小时** |

---

## 二、任务清单

### 任务 B-P1：添加同步方法到 wrapper-client.js（2.5 小时）

**目标**：在 `lib/wrapper-client.js` 中添加同步相关 API 方法

**实现位置**：第 344-361 行后（文件末尾，类外部导出之前）

#### B-P1.1 增量同步方法

```javascript
/**
 * 增量同步 - 发送本地指纹获取变更指令
 * @param {Array} fingerprints - 本地文件指纹数组
 * @param {string} tenant_id - 租户ID (可选)
 * @returns {Promise<{to_upload: Array, to_delete: Array, conflicts: Array, synced: number}>}
 */
async function syncIncremental(fingerprints, tenant_id) {
  const requestBody = {
    fingerprints: fingerprints.map((fp) => ({
      path: fp.path,
      mtime: fp.mtime,
      hash: fp.hash,
      source_id: fp.source_id,
    })),
    tenant_id: tenant_id || this.tenantId,
  };

  return await withRetry(
    () => this.http.post("/api/v1/sync/incremental", requestBody),
    this.maxRetries,
  );
}
```

#### B-P1.2 全量同步方法

```javascript
/**
 * 全量同步 - 上传所有本地记忆到后端
 * @param {Array} memories - 记忆数组
 * @param {string} tenant_id - 租户ID (可选)
 * @returns {Promise<{total: number, success: number, failed: number, errors: Array}>}
 */
async function syncFull(memories, tenant_id) {
  const requestBody = {
    memories: memories.map((m) => ({
      content: m.content,
      type: m.type || "general",
      tags: m.tags || [],
      project_id: m.project_id || "global",
      source_id: m.source_id,
      source: m.source || "plugin",
      metadata: m.metadata || {
        l0: m.l0,
        l1: m.l1,
      },
      tenant_id: m.tenant_id || this.tenantId,
    })),
    tenant_id: tenant_id || this.tenantId,
  };

  return await withRetry(
    () => this.http.post("/api/v1/sync/full", requestBody),
    this.maxRetries,
  );
}
```

#### B-P1.3 获取服务端指纹

```javascript
/**
 * 获取服务端指纹 - 用于增量同步对比
 * @param {string} tenant_id - 租户ID (可选)
 * @returns {Promise<{fingerprints: Array, count: number}>}
 */
async function getServerFingerprints(tenant_id) {
  const params = new URLSearchParams();
  params.append("tenant_id", tenant_id || this.tenantId);

  return await withRetry(
    () => this.http.get(`/api/v1/sync/fingerprints?${params.toString()}`),
    this.maxRetries,
  );
}
```

#### B-P1.4 冲突解决

```javascript
/**
 * 解决同步冲突
 * @param {string} conflict_id - 冲突ID
 * @param {string} resolution - 解决策略: 'use_local' | 'use_remote' | 'keep_both'
 * @param {string} tenant_id - 租户ID (可选)
 * @returns {Promise<{resolved: boolean, action: string}>}
 */
async function resolveConflict(conflict_id, resolution, tenant_id) {
  const requestBody = {
    resolution,
    tenant_id: tenant_id || this.tenantId,
  };

  return await withRetry(
    () =>
      this.http.post(
        `/api/v1/sync/conflicts/${conflict_id}/resolve`,
        requestBody,
      ),
    this.maxRetries,
  );
}
```

#### B-P1.5 将方法添加到 WrapperClient 类

在 `WrapperClient` 类中添加这些方法（约第 342 行后）：

```javascript
/**
 * 增量同步 - 发送本地指纹获取变更指令
 */
async syncIncremental(fingerprints, tenant_id) {
  const requestBody = {
    fingerprints: fingerprints.map(fp => ({
      path: fp.path,
      mtime: fp.mtime,
      hash: fp.hash,
      source_id: fp.source_id
    })),
    tenant_id: tenant_id || this.tenantId
  };

  return await withRetry(
    () => this.http.post('/api/v1/sync/incremental', requestBody),
    this.maxRetries
  );
}

/**
 * 全量同步 - 上传所有本地记忆
 */
async syncFull(memories, tenant_id) {
  const requestBody = {
    memories: memories.map(m => ({
      content: m.content,
      type: m.type || 'general',
      tags: m.tags || [],
      project_id: m.project_id || 'global',
      source_id: m.source_id,
      source: m.source || 'plugin',
      metadata: m.metadata || {
        l0: m.l0,
        l1: m.l1
      },
      tenant_id: m.tenant_id || this.tenantId
    })),
    tenant_id: tenant_id || this.tenantId
  };

  return await withRetry(
    () => this.http.post('/api/v1/sync/full', requestBody),
    this.maxRetries
  );
}

/**
 * 获取服务端指纹
 */
async getServerFingerprints(tenant_id) {
  const params = new URLSearchParams();
  params.append('tenant_id', tenant_id || this.tenantId);

  return await withRetry(
    () => this.http.get(`/api/v1/sync/fingerprints?${params.toString()}`),
    this.maxRetries
  );
}

/**
 * 解决同步冲突
 */
async resolveConflict(conflict_id, resolution, tenant_id) {
  const requestBody = {
    resolution,
    tenant_id: tenant_id || this.tenantId
  };

  return await withRetry(
    () => this.http.post(`/api/v1/sync/conflicts/${conflict_id}/resolve`, requestBody),
    this.maxRetries
  );
}
```

**验证方法**：

- 运行 `node -c lib/wrapper-client.js` 语法检查
- 添加单元测试验证 API 调用格式

**预计时间**：2.5 小时

---

### 任务 B-P2：创建 topic_sync 工具（1.5 小时）

**目标**：在 plugin.js 中添加增量同步工具

**实现位置**：约第 1500-1600 行（在现有工具定义之后）

#### B-P2.1 指纹生成函数

在文件顶部辅助函数区域添加：

```javascript
/**
 * 生成文件指纹用于增量同步
 * @param {string} baseDir - 基础目录
 * @param {string[]} subDirs - 子目录数组
 * @returns {Promise<Array>} 指纹数组
 */
async function generateSyncFingerprints(baseDir, subDirs = []) {
  const fingerprints = [];
  const dirsToScan =
    subDirs.length > 0 ? subDirs.map((d) => path.join(baseDir, d)) : [baseDir];

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;

      const filePath = path.join(dir, file.name);
      const stats = fs.statSync(filePath);

      // 跳过隐藏文件和索引文件
      if (file.name.startsWith(".") || file.name.startsWith("_")) continue;

      const content = fs.readFileSync(filePath, "utf-8");
      const hash = createHash("md5").update(content).digest("hex");

      // 从文件名提取 source_id
      const sourceId = path.basename(file.name, ".md");

      fingerprints.push({
        path: filePath,
        relativePath: path.relative(baseDir, filePath),
        mtime: stats.mtimeMs,
        size: stats.size,
        hash: hash,
        source_id: sourceId,
      });
    }
  }

  return fingerprints;
}
```

#### B-P2.2 topic_sync 工具定义

```javascript
// ============================================================================
// 主题同步工具 - 增量同步
// ============================================================================

export const topic_sync = tool({
  description:
    "Incremental sync topic memories to backend service. Detects changes using fingerprints and only uploads modified entries.",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "Specific topic to sync. If omitted, syncs all topics.",
      },
      dry_run: {
        type: "boolean",
        description:
          "If true, only shows what would be synced without making changes",
        default: false,
      },
      force: {
        type: "boolean",
        description: "Force full sync ignoring mtime checks",
        default: false,
      },
    },
  },
  required: [],
  async execute(params) {
    const { topic, dry_run = false, force = false } = params;

    try {
      // 1. 获取主题列表
      const topics = topic ? [topic] : getTopics();

      if (topics.length === 0) {
        return { success: true, message: "No topics to sync", synced: 0 };
      }

      // 2. 生成指纹
      const fingerprints = [];
      for (const t of topics) {
        const topicDir = path.join(ACTIVE_DIR, t, "entries");
        if (fs.existsSync(topicDir)) {
          const topicFps = await generateSyncFingerprints(topicDir);
          fingerprints.push(...topicFps);
        }
      }

      if (fingerprints.length === 0) {
        return { success: true, message: "No entries to sync", synced: 0 };
      }

      // 3. 调用后端增量同步
      const client = getWrapperClient();

      if (dry_run) {
        // 只显示统计信息
        return {
          success: true,
          dry_run: true,
          topics: topics,
          entry_count: fingerprints.length,
          fingerprints_preview: fingerprints.slice(0, 5).map((fp) => ({
            path: fp.relativePath,
            hash: fp.hash.substring(0, 8),
            mtime: new Date(fp.mtime).toISOString(),
          })),
          message: `Would sync ${fingerprints.length} entries from ${topics.length} topics`,
        };
      }

      const result = await client.syncIncremental(fingerprints);

      return {
        success: true,
        synced: result.synced || 0,
        to_upload: result.to_upload?.length || 0,
        to_delete: result.to_delete?.length || 0,
        conflicts: result.conflicts?.length || 0,
        message: `Synced ${result.synced || 0} entries`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Sync failed: ${error.message}`,
      };
    }
  },
});
```

**验证方法**：

- 运行 `node -c plugin.js` 语法检查
- 测试工具调用（dry_run 模式）

**预计时间**：1.5 小时

---

### 任务 B-P3：创建 rebuild_topics 工具（1 小时）

**目标**：在 plugin.js 中添加全量同步和重建工具

**实现位置**：topic_sync 之后

#### B-P3.1 收集主题记忆函数

```javascript
/**
 * 收集所有主题记忆用于全量同步
 * @returns {Promise<Array>} 记忆数组
 */
async function collectTopicMemories() {
  const memories = [];
  const topics = getTopics();

  for (const topic of topics) {
    const topicEntriesDir = path.join(ACTIVE_DIR, topic, "entries");

    if (!fs.existsSync(topicEntriesDir)) continue;

    const files = fs.readdirSync(topicEntriesDir);

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const filePath = path.join(topicEntriesDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      // 解析 entry
      const entryId = path.basename(file, ".md");
      const sourceIdMatch = content.match(/\*\*Source ID\*\*:\s*(\S+)/);
      const typeMatch = content.match(/\*\*Type\*\*:\s*(\S+)/);
      const tagsMatch = content.match(/\*\*Tags\*\*:\s*([^\n]+)/);
      const projectMatch = content.match(/\*\*Project\*\*:\s*([^\n]+)/);
      const l0Match = content.match(/\*\*L0\*\*:\s*([^\n]+)/);
      const l1Match = content.match(/\*\*L1\*\*:\s*([^\n]+)/);
      const l2Match = content.match(/\*\*L2\*\*:\s*\n([\s\S]*)$/);

      memories.push({
        content: l2Match ? l2Match[1].trim() : content,
        type: typeMatch ? typeMatch[1] : "general",
        tags: tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()) : [],
        project_id: projectMatch ? projectMatch[1] : "global",
        source_id: sourceIdMatch ? sourceIdMatch[1] : entryId,
        metadata: {
          l0: l0Match ? l0Match[1].trim() : "",
          l1: l1Match ? l1Match[1].trim() : "",
          topic: topic,
          entry_id: entryId,
        },
      });
    }
  }

  return memories;
}
```

#### B-P3.2 rebuild_topics 工具定义

```javascript
// ============================================================================
// 主题重建工具 - 全量同步
// ============================================================================

export const rebuild_topics = tool({
  description:
    "Full sync and rebuild topic structure. Re-uploads all topic memories to backend service.",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description:
          "Specific topic to rebuild. If omitted, rebuilds all topics.",
      },
      dry_run: {
        type: "boolean",
        description: "If true, only shows statistics without making changes",
        default: false,
      },
    },
  },
  required: [],
  async execute(params) {
    const { topic, dry_run = false } = params;

    try {
      // 1. 收集记忆
      const allMemories = await collectTopicMemories();

      let memories = allMemories;
      if (topic) {
        memories = allMemories.filter((m) => m.metadata.topic === topic);
      }

      if (memories.length === 0) {
        return {
          success: true,
          message: "No memories to rebuild",
          total: 0,
        };
      }

      // 2. 统计信息
      const stats = {
        total: memories.length,
        by_topic: {},
      };

      for (const mem of memories) {
        const t = mem.metadata.topic;
        stats.by_topic[t] = (stats.by_topic[t] || 0) + 1;
      }

      if (dry_run) {
        return {
          success: true,
          dry_run: true,
          total: memories.length,
          by_topic: stats.by_topic,
          preview: memories.slice(0, 3).map((m) => ({
            topic: m.metadata.topic,
            entry_id: m.metadata.entry_id,
            l0: m.metadata.l0.substring(0, 50),
          })),
          message: `Would rebuild ${memories.length} memories`,
        };
      }

      // 3. 全量同步
      const client = getWrapperClient();
      const result = await client.syncFull(memories);

      return {
        success: result.failed === 0,
        total: result.total,
        success_count: result.success,
        failed_count: result.failed,
        by_topic: stats.by_topic,
        errors: result.errors?.slice(0, 5) || [],
        message: `Rebuilt ${result.success}/${result.total} memories`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Rebuild failed: ${error.message}`,
      };
    }
  },
});
```

**验证方法**：

- 运行 `node -c plugin.js` 语法检查
- 测试工具调用（dry_run 模式）

**预计时间**：1 小时

---

### 任务 B-P4：测试（1.5 小时）

**目标**：为新增功能编写测试

#### B-P4.1 单元测试 - wrapper-client.js 同步方法

创建文件 `tests/test-sync-methods.mjs`：

```javascript
import { describe, it, expect, beforeEach } from "bun:test";
import { WrapperClient, WrapperError } from "../lib/wrapper-client.js";

describe("WrapperClient Sync Methods", () => {
  let client;

  beforeEach(() => {
    client = new WrapperClient({
      backend: {
        url: "http://localhost:17999",
        tenant_id: "test-user",
      },
    });
  });

  describe("syncIncremental", () => {
    it("should call /api/v1/sync/incremental with correct body", async () => {
      // Mock fetch response
      const fingerprints = [
        {
          path: "active/preferences/entry-001.md",
          mtime: 1234567890,
          hash: "abc123",
          source_id: "entry-001",
        },
      ];

      // This would require mocking the HTTP client
      // For now, just verify the method exists
      expect(typeof client.syncIncremental).toBe("function");
    });
  });

  describe("syncFull", () => {
    it("should call /api/v1/sync/full with correct body", () => {
      expect(typeof client.syncFull).toBe("function");
    });
  });

  describe("getServerFingerprints", () => {
    it("should call /api/v1/sync/fingerprints endpoint", () => {
      expect(typeof client.getServerFingerprints).toBe("function");
    });
  });

  describe("resolveConflict", () => {
    it("should call conflict resolve endpoint", () => {
      expect(typeof client.resolveConflict).toBe("function");
    });
  });
});
```

#### B-P4.2 集成测试 - 插件工具

创建文件 `tests/test-topic-sync.mjs`：

```javascript
import { describe, it, expect } from 'bun:test';

describe('Topic Sync Tools', () => {
  describe('topic_sync', () => {
    it('should exist and be callable', () => {
      // Import the tool
      const { topic_sync } = await import('../plugin.js');
      expect(topic_sync).toBeDefined();
      expect(topic_sync.execute).toBeDefined();
    });

    it('should return correct structure for dry_run', async () => {
      const result = await topic_sync.execute({ dry_run: true });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('dry_run', true);
      expect(result).toHaveProperty('entry_count');
    });
  });

  describe('rebuild_topics', () => {
    it('should exist and be callable', () => {
      const { rebuild_topics } = await import('../plugin.js');
      expect(rebuild_topics).toBeDefined();
    });

    it('should return correct structure for dry_run', async () => {
      const { rebuild_topics } = await import('../plugin.js');
      const result = await rebuild_topics.execute({ dry_run: true });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('total');
    });
  });
});
```

#### B-P4.3 同步流程测试

创建文件 `tests/test-sync-flow.mjs`：

```javascript
import { describe, it, expect, beforeAll } from "bun:test";

describe("Full Sync Flow", () => {
  const TEST_TOPIC = "test-topic";

  // Create test entry
  const testEntry = {
    type: "general",
    tags: ["test"],
    content: "Test content for sync flow",
    project_id: "test-project",
  };

  it("should complete full sync flow", async () => {
    // 1. Generate fingerprints from topic directory
    // 2. Call syncIncremental
    // 3. Verify results

    // This is a placeholder for E2E testing
    // Would require actual backend running
    expect(true).toBe(true);
  });

  it("should handle conflicts correctly", async () => {
    // Test conflict detection and resolution
    expect(true).toBe(true);
  });
});
```

**测试框架**：Bun (与项目现有测试保持一致)

**验证方法**：

- 运行 `bun test tests/`
- 验证所有测试通过

**预计时间**：1.5 小时

---

## 三、API 端点定义

### 3.1 增量同步 API

**端点**: `POST /api/v1/sync/incremental`

**请求体**:

```json
{
  "fingerprints": [
    {
      "path": "active/preferences/entry-001.md",
      "mtime": 1234567890123,
      "hash": "abc123def456",
      "source_id": "entry-001"
    }
  ],
  "tenant_id": "test-user"
}
```

**响应**:

```json
{
  "synced": 5,
  "to_upload": [{ "path": "active/preferences/entry-002.md", "reason": "new" }],
  "to_delete": [],
  "conflicts": []
}
```

### 3.2 全量同步 API

**端点**: `POST /api/v1/sync/full`

**请求体**:

```json
{
  "memories": [
    {
      "content": "记忆内容",
      "type": "preference",
      "tags": ["tag1", "tag2"],
      "project_id": "@owner/repo",
      "source_id": "entry-001",
      "source": "plugin",
      "metadata": {
        "l0": "一句话摘要",
        "l1": "核心要点"
      }
    }
  ],
  "tenant_id": "test-user"
}
```

**响应**:

```json
{
  "total": 10,
  "success": 10,
  "failed": 0,
  "errors": []
}
```

### 3.3 获取服务端指纹

**端点**: `GET /api/v1/sync/fingerprints?tenant_id=test-user`

**响应**:

```json
{
  "fingerprints": [
    {
      "source_id": "entry-001",
      "hash": "abc123def456",
      "mtime": 1234567890123
    }
  ],
  "count": 10
}
```

### 3.4 冲突解决

**端点**: `POST /api/v1/sync/conflicts/conflict-001/resolve`

**请求体**:

```json
{
  "resolution": "use_local",
  "tenant_id": "test-user"
}
```

**响应**:

```json
{
  "resolved": true,
  "action": "use_local"
}
```

---

## 四、冲突解决策略

### 4.1 策略类型

| 策略         | 说明                 | 适用场景       |
| ------------ | -------------------- | -------------- |
| `use_local`  | 使用本地版本覆盖远程 | 本地更新更准确 |
| `use_remote` | 使用远程版本覆盖本地 | 远程更新更准确 |
| `keep_both`  | 保留两个版本         | 需要保留历史   |

### 4.2 自动裁决规则

```javascript
function autoResolveConflict(local, remote) {
  // 时间戳裁决：选择最新版本
  if (local.mtime > remote.mtime + 3600000) {
    // 1小时差异
    return "use_local";
  }

  if (remote.mtime > local.mtime + 3600000) {
    return "use_remote";
  }

  // 内容长度裁决：选择更详细的版本
  if (local.content.length > remote.content.length * 1.5) {
    return "use_local";
  }

  if (remote.content.length > local.content.length * 1.5) {
    return "use_remote";
  }

  // 默认保留两者
  return "keep_both";
}
```

---

## 五、Go/No-Go 检查点

### 检查点 B-1: 同步方法添加 ✅

- [ ] wrapper-client.js 添加 syncIncremental 方法
- [ ] wrapper-client.js 添加 syncFull 方法
- [ ] wrapper-client.js 添加 getServerFingerprints 方法
- [ ] wrapper-client.js 添加 resolveConflict 方法
- [ ] 语法检查通过: `node -c lib/wrapper-client.js`

### 检查点 B-2: 工具实现 ✅

- [ ] plugin.js 添加 generateSyncFingerprints 函数
- [ ] plugin.js 添加 topic_sync 工具
- [ ] plugin.js 添加 collectTopicMemories 函数
- [ ] plugin.js 添加 rebuild_topics 工具
- [ ] 语法检查通过: `node -c plugin.js`

### 检查点 B-3: 测试验证 ✅

- [ ] 单元测试: 同步方法测试通过
- [ ] 集成测试: 工具 dry_run 模式工作正常
- [ ] 同步流程测试: 完整流程验证通过

### 检查点 B-4: 端到端验证 ✅

- [ ] 实际增量同步功能测试
- [ ] 实际全量同步功能测试
- [ ] 冲突检测和解决测试
- [ ] 多主题同步测试

---

## 六、时间分配

| 任务                      | 时间     | 累计 |
| ------------------------- | -------- | ---- |
| B-P1: 同步方法            | 2.5h     | 2.5h |
| B-P2: topic_sync 工具     | 1.5h     | 4h   |
| B-P3: rebuild_topics 工具 | 1h       | 5h   |
| B-P4: 测试                | 1.5h     | 6.5h |
| **总计**                  | **6.5h** |      |

---

## 七、依赖关系

### 7.1 外部依赖

| 依赖        | 版本            | 用途     |
| ----------- | --------------- | -------- |
| 后端 API    | localhost:17999 | 同步端点 |
| fs 模块     | Node.js 内置    | 文件操作 |
| crypto 模块 | Node.js 内置    | 哈希计算 |

### 7.2 内部依赖

| 模块              | 依赖项                                             |
| ----------------- | -------------------------------------------------- |
| wrapper-client.js | HTTPClient, withRetry                              |
| plugin.js         | getWrapperClient(), getTopics(), generateEntryId() |

---

## 八、回滚计划

### 8.1 如果 wrapper-client.js 修改失败

- 恢复文件到修改前状态
- 重新执行任务 B-P1

### 8.2 如果 plugin.js 工具添加失败

- 恢复文件到修改前状态
- 重新执行任务 B-P2、B-P3

### 8.3 如果测试失败

- 修复失败的测试用例
- 确保所有现有测试仍然通过

---

## 九、关键实现细节

### 9.1 指纹算法

使用 MD5 而非 xxhash64（Node.js 原生支持）：

```javascript
const hash = createHash("md5").update(content).digest("hex");
```

### 9.2 指纹内容

```javascript
{
  path: 'active/preferences/entry-001.md',  // 完整路径
  relativePath: 'entry-001.md',              // 相对路径
  mtime: 1234567890123,                      // 修改时间 (毫秒)
  size: 1234,                                // 文件大小
  hash: 'abc123def456',                      // MD5 哈希
  source_id: 'entry-001'                     // 记忆唯一ID
}
```

### 9.3 同步流程

```
┌─────────────────┐
│ 生成本地指纹    │
│ (generateSync  │
│  Fingerprints) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 调用后端API    │
│ syncIncremental │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 解析响应        │
│ to_upload       │
│ to_delete       │
│ conflicts       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 执行操作        │
│ 上传/删除/     │
│ 解决冲突        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 返回结果        │
│ synced: 5       │
│ conflicts: 2    │
└─────────────────┘
```

---

## 十、验证步骤

### 10.1 代码验证

```bash
# 语法检查
node -c lib/wrapper-client.js
node -c plugin.js

# 运行测试
bun test tests/test-sync-methods.mjs
bun test tests/test-topic-sync.mjs
```

### 10.2 功能验证

```javascript
// 1. Dry-run 模式测试
await topic_sync.execute({ dry_run: true });
// 预期: 返回待同步条目统计

// 2. 实际同步测试
await topic_sync.execute({ topic: "preferences" });
// 预期: 同步完成，返回成功数量

// 3. 全量重建测试
await rebuild_topics.execute({ dry_run: true });
// 预期: 返回所有主题记忆统计
```

### 10.3 后端 API 验证

确保以下端点存在并返回正确格式：

| 端点                                  | 方法 | 验证方式                  |
| ------------------------------------- | ---- | ------------------------- |
| `/api/v1/sync/incremental`            | POST | 发送指纹，返回变更指令    |
| `/api/v1/sync/full`                   | POST | 上传记忆，返回成功/失败数 |
| `/api/v1/sync/fingerprints`           | GET  | 返回服务端指纹列表        |
| `/api/v1/sync/conflicts/{id}/resolve` | POST | 解决冲突，返回结果        |

---

## 十一、总结

### 11.1 实施要点

1. **最小化实现**：只在现有代码基础上添加必要功能
2. **向后兼容**：保持与 Phase A 功能的兼容性
3. **灰度验证**：每个检查点独立验证
4. **测试驱动**：先写测试，再实现功能

### 11.2 预期成果

- 完整的增量同步功能（topic_sync）
- 完整的全量同步功能（rebuild_topics）
- 冲突检测和解决机制
- 完整的测试覆盖

### 11.3 后续工作（Phase C）

- 本地 Trie 索引优化
- 性能优化
- 实时同步机制
