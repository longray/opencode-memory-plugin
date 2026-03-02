# 组件详细规格

> [← 架构设计](DESIGN_ARCHITECTURE.md) | [接口规格 →](DESIGN_API.md)

---

## 一、Memory Manager（核心组件）

### 1.1 核心职责

- 管理所有本地 MD 文件的读写
- 添加默认标签（`project_tag`, `uploaded`）
- 提供记忆分类和上传接口

### 1.2 类结构

```javascript
// lib/memory-manager.js

export class MemoryManager {
  constructor(options = {}) {
    this.memoryDir = options.memoryDir || getDefaultMemoryDir();
    this.configFile = options.configFile || getDefaultConfigFile();
    
    // 加载项目配置
    this.projects = this.loadProjects();
  }
  
  // ============ 核心方法 ============
  
  /**
   * 写入记忆到本地 MD 文件
   * @param {Object} params
   * @param {string} params.content - 记忆内容
   * @param {string} params.type - 记忆类型 (general, preference, decision, etc.)
   * @param {string[]} params.tags - 标签数组
   * @returns {Promise<{success: boolean, entry: Object}>}
   */
  async write({ content, type, tags = [] }) {
    // 1. 检测项目标签
    const projectTag = this.detectProjectTag(content);
    const projectId = this.detectProjectId(content);
    const projectName = this.detectProjectName(content);
    
    // 2. 构建带标签的记忆条目
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      tags,
      project_tag: projectTag,           // 项目标签（分类）
      project_id: projectId,             // 项目唯一标识符
      project_name: projectName,         // 项目可读名称
      uploaded: false,                   // 上传状态
      upload_timestamp: null,            // 上传时间戳
      upload_error: null,                // 上传错误信息
      classification_confidence: null,   // 分类置信度
      classified_at: null,              // 分类时间戳
      content
    };
    
    // 3. 写入对应文件
    const targetFile = this.getTargetFile(projectTag);
    await this.appendToFile(targetFile, entry);
    
    // 4. 更新项目统计
    this.updateProjectStats(projectTag);
    
    return { success: true, entry };
  }
  
  /**
   * 读取记忆
   */
  async read({ file = 'MEMORY.md', projectTag, uploaded }) {
    const content = await this.readFile(file);
    return this.filterContent(content, { projectTag, uploaded });
  }
  
  /**
   * 获取待上传的记忆
   */
  async getUnuploadedEntries() {
    return this.scanForEntries({ uploaded: false });
  }
  
  /**
   * 标记记忆为已上传
   * @param {string[]} entryIds - 记忆 ID 数组
   * @param {Object} options - 选项
   * @param {boolean} options.success - 是否成功
   * @param {string} options.error - 错误信息（失败时）
   */
  async markAsUploaded(entryIds, options = {}) {
    const { success = true, error = null } = options;
    
    for (const id of entryIds) {
      if (success) {
        await this.updateEntryTag(id, 'uploaded', 'true');
        await this.updateEntryTag(id, 'upload_timestamp', new Date().toISOString());
        await this.updateEntryTag(id, 'upload_error', null);
      } else {
        await this.updateEntryTag(id, 'uploaded', 'failed');
        await this.updateEntryTag(id, 'upload_timestamp', new Date().toISOString());
        await this.updateEntryTag(id, 'upload_error', error);
      }
    }
  }
  // ============ 辅助方法 ============
  
  detectProjectTag(content) { /* 基于规则检测 */ }
  detectProjectId(content) { /* 检测项目唯一标识符 */ }
  detectProjectName(content) { /* 检测项目可读名称 */ }
  getTargetFile(projectTag) { /* 根据项目返回目标文件 */ }
  loadProjects() { /* 加载项目配置 */ }
  updateProjectStats(projectTag) { /* 更新项目统计 */ }
  filterContent(content, filters) { /* 过滤内容 */ }
  scanForEntries(filter) { /* 扫描符合条件的条目 */ }
  updateEntryTag(id, key, value) { /* 更新条目标签 */ }
}
```

### 1.3 文件映射规则

```javascript
function getTargetFile(projectTag) {
  switch (projectTag) {
    case 'global':
      return 'GLOBAL_MEMORY.md';
    case 'unclassified':
      return 'MEMORY.md';  // 默认
    default:
      return 'PROJECT_MEMORY.md';  // 项目记忆统一放这里
  }
}
```

---

## 二、Network Checker（核心组件）

### 2.1 核心职责

- 定时检查外部包装服务的健康状态
- 返回综合健康状态供其他组件使用
- 记录健康检查历史

### 2.2 类结构

```javascript
// lib/network-checker.js
export class NetworkChecker {
  constructor(options = {}) {
    this.config = {
      checkIntervalMs: options.checkIntervalMs || 60000, // 默认 1 分钟
      wrapperUrl: options.wrapperUrl || 'http://localhost:3001',
      timeoutMs: options.timeoutMs || 5000
    };
    
    this.lastStatus = null;
    this.statusHistory = [];
    this.checkTimer = null;
    this.isRunning = false;
  }
  
  /**
   * 启动定时检查
   */
  start(onStatusChange) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.onStatusChange = onStatusChange;
    
    // 立即执行一次检查
    await this.check();
    
    // 启动定时器
    this.checkTimer = setInterval(
      () => this.check(),
      this.config.checkIntervalMs
    );
  }
  
  /**
   * 停止定时检查
   */
  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.isRunning = false;
  }
  
  /**
   * 执行健康检查
   */
  async check() { /* 详见下方 */ }
  
  /**
   * 获取当前健康状态
   */
  getStatus() { return this.lastStatus; }
  
  /**
   * 判断是否健康
   */
  isHealthy() { return this.lastStatus?.overall === 'healthy'; }
}
```

### 2.3 健康检查流程

```
定时器触发 (默认 1 分钟)
     ↓
fetch(GET /api/health)
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

---

## 三、Wrapper Client（核心组件）

### 3.1 核心职责

- 作为 HTTP 客户端调用外部 Express Wrapper Service
- 提供语义搜索和记忆上传接口
- 处理网络异常，返回标准错误

### 3.2 类结构

```javascript
// lib/wrapper-client.js

export class WrapperClient {
  constructor(options = {}) {
    this.config = {
      baseUrl: options.baseUrl || 'http://localhost:3001',
      timeout: options.timeout || 30000,
      retry: options.retry || 3,
      retryDelay: options.retryDelay || 1000
    };
  }
  
  /**
   * 语义搜索
   */
  async search({ query, limit = 10, threshold = 0.3, projectTag }) {
    const response = await this.request('/api/search', {
      method: 'POST',
      body: { query, limit, threshold, filters: projectTag ? { project_tag: projectTag } : undefined }
    });
    
    return response.results || [];
  }
  
  /**
   * 上传记忆
   */
  async upload({ entries }) {
    const response = await this.request('/api/upload', {
      method: 'POST',
      body: { entries }
    });
    
    return {
      success: response.success,
      count: response.count || 0,
      ids: response.ids || [],
      failed: response.failed || []
    };
  }
  
  /**
   * 批量上传
   */
  async batchUpload(entries, batchSize = 20) { /* 分批处理 */ }
  
  /**
   * 发送请求（带重试）
   */
  async request(endpoint, options = {}) { /* 详见下方 */ }
}
```

### 3.3 重试机制

```javascript
async request(endpoint, options = {}) {
  const { method = 'GET', body } = options;
  
  for (let attempt = 0; attempt < this.config.retry; attempt++) {
    try {
      const response = await fetch(
        `${this.config.baseUrl}${endpoint}`,
        { method, body: JSON.stringify(body), signal }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      return await response.json();
      
    } catch (error) {
      // 非网络错误不重试
      if (!error.message.includes('network')) throw error;
      
      // 等待后重试
      if (attempt < this.config.retry - 1) {
        await this.delay(this.config.retryDelay);
      }
    }
  }
  
  throw lastError;
}
```

---

## 四、Memory Classifier 子代理

### 4.1 触发方式

```yaml
command: "@memory-classifier classify unclassified memories"
```

### 4.2 代理定义

```markdown
---
name: memory-classifier
description: >
  Classifier agent that categorizes unclassified memories into global or project-specific.
  Run this command to classify memories that don't have a project_tag set.
  
  Usage: @memory-classifier classify unclassified memories
mode: subagent
model: anthropic/claude-haiku-4-20250514
tools:
  memory_read: true
  memory_write: true
  memory_search: false
  vector_memory_search: false
  bash: false
  write: false
  edit: true
permission:
  memory_read: allow
  memory_write: allow
  edit: allow
---

## Role

You are a memory classifier that analyzes unclassified memories and assigns appropriate project tags.

## When to Run

```
@memory-classifier classify unclassified memories
```

## How to Classify

1. **Read** unclassified memories from memory files
2. **Analyze** each memory to determine:
   - **Global**: User preferences, coding style, general best practices
   - **Project-specific**: Related to a specific project
3. **Update** the project_tag using edit tool

## Classification Guidelines

### Global Memories (project_tag: global)
- User preferences and settings
- Coding style and conventions
- General best practices

### Project Memories (project_tag: <project_name>)
- Project-specific configurations
- Project decisions and rationale

## Important Notes

- Do NOT change the `uploaded` tag
- Only edit the `project_tag` field
- If you can't determine the project, leave as `unclassified`
```

---

## 五、相关文档

- [← 设计概述](DESIGN_OVERVIEW.md)
- [← 架构设计](DESIGN_ARCHITECTURE.md)
- [接口规格 →](DESIGN_API.md)
- [开发计划 →](DESIGN_ROADMAP.md)

---

*文档版本: v2.4.0 | 最后更新: 2026-03-05*