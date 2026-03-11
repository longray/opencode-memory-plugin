# Wrapper Service API 适配指南

**文档版本**: 1.0  
**创建时间**: 2026-03-04  
**适用版本**: OpenCode Memory Plugin v2.0+  
**作者**: Plugin Development Team

---

## 一、背景说明

### 1.1 为什么需要适配？

在v2.0设计阶段，我们评估了两种方案：

1. 让Wrapper Service适配我们的API设计
2. 让我们适配Wrapper Service的API设计

**最终决定：采用方案2**

**理由**：

- ✅ Wrapper Service的API设计更符合RESTful标准
- ✅ 版本化设计（`/api/v1/`）更利于未来升级
- ✅ 通用性更强，可以服务多个客户端
- ✅ 我们作为客户端，适配服务端是标准做法
- ✅ 降低服务端复杂度，提高系统整体可维护性

### 1.2 设计原则

**核心原则**：

- 🎯 客户端适配服务端，而不是反过来
- 🎯 服务端保持通用和标准
- 🎯 客户端负责自己的数据映射

**好处**：

- 服务端简洁，易于维护
- 我们的业务逻辑保持独立
- 未来可以灵活调整映射策略

---

## 二、Wrapper Service API 规范

### 2.1 基础信息

**服务地址**: `http://localhost:3001`  
**API版本**: v1  
**协议**: HTTP/HTTPS  
**认证**: 暂无（未来可能添加）

### 2.2 API端点

#### 端点1：健康检查

```
GET /api/v1/health
```

**响应格式**:

```json
{
  "status": "healthy",
  "services": {
    "surrealdb": { "status": "healthy" },
    "embedding": { "status": "healthy" },
    "llm": { "status": "healthy" }
  }
}
```

**我们需要的字段**:

- `status`: 总体状态
- `services.surrealdb`: SurrealDB状态
- `services.embedding`: Embedding服务状态

---

#### 端点2：上传记忆

```
POST /api/v1/memories
```

**请求格式**:

```json
{
  "memories": [
    {
      "content": "用户偏好使用 TypeScript",
      "metadata": {
        "type": "preference",
        "tags": ["typescript", "style"],
        "project_tag": "projectA",
        "project_id": "github-org-repo",
        "project_name": "项目 A",
        "source": "MEMORY.md",
        "line": 15,
        "classification_confidence": 0.85,
        "classified_at": "2026-03-05T12:05:00Z"
      },
      "entities": []
    }
  ],
  "batch_size": 10
}
```

**响应格式**:

```json
{
  "success": true,
  "uploaded": 1,
  "failed": 0,
  "results": [
    {
      "id": "memory:001",
      "status": "success",
      "entities_created": 0
    }
  ]
}
```

**关键字段说明**:

- `memories`: 记忆数组（注意：不是`entries`）
- `metadata`: 所有业务字段都放在这里
- `entities`: 实体数组（我们暂时不使用，传空数组）

---

#### 端点3：搜索记忆

```
POST /api/v1/memories/search
```

**请求格式**:

```json
{
  "query": "用户偏好的编码风格",
  "mode": "hybrid",
  "limit": 10,
  "threshold": 0.7,
  "filters": {
    "project_tag": "projectA"
  }
}
```

**响应格式**:

```json
{
  "results": [
    {
      "id": "memory:001",
      "content": "用户偏好使用 TypeScript...",
      "metadata": {
        "type": "preference",
        "tags": ["typescript"],
        "project_tag": "projectA",
        "source": "MEMORY.md",
        "line": 15
      },
      "score": 0.92,
      "created_at": "2026-03-05T10:30:00Z"
    }
  ],
  "count": 1
}
```

**关键字段说明**:

- `mode`: 搜索模式（`vector`, `keyword`, `hybrid`）
- `filters`: 过滤条件（支持metadata中的任意字段）
- `results[].metadata`: 包含我们存储的所有业务字段

---

## 三、数据格式映射

### 3.1 上传记忆的映射

**我们的内部格式** → **Wrapper Service格式**

```javascript
// 我们的格式（内部使用）
const pluginEntry = {
  id: 'local-001', // 本地ID
  content: '用户偏好使用 TypeScript',
  type: 'preference',
  tags: ['typescript', 'style'],
  project_tag: 'projectA',
  project_id: 'github-org-repo',
  project_name: '项目 A',
  timestamp: '2026-03-05T12:00:00Z',
  classification_confidence: 0.85,
  classified_at: '2026-03-05T12:05:00Z',
  metadata: {},
};

// 映射为Wrapper Service格式
const wrapperMemory = {
  content: pluginEntry.content,
  metadata: {
    type: pluginEntry.type,
    tags: pluginEntry.tags,
    project_tag: pluginEntry.project_tag,
    project_id: pluginEntry.project_id,
    project_name: pluginEntry.project_name,
    source_id: pluginEntry.id, // 保存本地ID
    timestamp: pluginEntry.timestamp,
    classification_confidence: pluginEntry.classification_confidence,
    classified_at: pluginEntry.classified_at,
    ...pluginEntry.metadata, // 合并额外的metadata
  },
  entities: [], // 我们不使用实体功能
};
```

**关键点**:

1. 所有业务字段都放入`metadata`
2. 保存本地ID为`source_id`（用于后续同步）
3. `entities`传空数组

---

### 3.2 搜索结果的映射

**Wrapper Service格式** → **我们的内部格式**

```javascript
// Wrapper Service返回的格式
const wrapperResult = {
  id: 'memory:001',
  content: '用户偏好使用 TypeScript...',
  metadata: {
    type: 'preference',
    tags: ['typescript'],
    project_tag: 'projectA',
    project_id: 'github-org-repo',
    project_name: '项目 A',
    source: 'MEMORY.md',
    line: 15,
    source_id: 'local-001',
    classification_confidence: 0.85,
  },
  score: 0.92,
  created_at: '2026-03-05T10:30:00Z',
};

// 映射为我们的格式
const pluginResult = {
  id: wrapperResult.id,
  content: wrapperResult.content,
  score: wrapperResult.score,
  type: wrapperResult.metadata.type,
  tags: wrapperResult.metadata.tags,
  project_tag: wrapperResult.metadata.project_tag,
  project_id: wrapperResult.metadata.project_id,
  project_name: wrapperResult.metadata.project_name,
  source: wrapperResult.metadata.source,
  line: wrapperResult.metadata.line,
  timestamp: wrapperResult.created_at,
  local_id: wrapperResult.metadata.source_id, // 恢复本地ID
};
```

**关键点**:

1. 从`metadata`中提取业务字段
2. 使用`created_at`作为时间戳
3. 恢复本地ID（如果需要）

---

## 四、实现指南

### 4.1 创建适配器模块

**文件**: `lib/wrapper-adapter.js`

```javascript
/**
 * Wrapper Service API 适配器
 * 负责在插件格式和Wrapper Service格式之间转换
 */

export class WrapperServiceAdapter {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * 将插件格式转换为Wrapper Service格式
   */
  toWrapperFormat(pluginEntry) {
    return {
      content: pluginEntry.content,
      metadata: {
        type: pluginEntry.type,
        tags: pluginEntry.tags || [],
        project_tag: pluginEntry.project_tag || 'unclassified',
        project_id: pluginEntry.project_id,
        project_name: pluginEntry.project_name,
        source: pluginEntry.source || 'MEMORY.md',
        line: pluginEntry.line || 0,
        source_id: pluginEntry.id,
        timestamp: pluginEntry.timestamp,
        classification_confidence: pluginEntry.classification_confidence,
        classified_at: pluginEntry.classified_at,
        ...pluginEntry.metadata,
      },
      entities: [],
    };
  }

  /**
   * 将Wrapper Service格式转换为插件格式
   */
  fromWrapperFormat(wrapperResult) {
    return {
      id: wrapperResult.id,
      content: wrapperResult.content,
      score: wrapperResult.score,
      type: wrapperResult.metadata?.type,
      tags: wrapperResult.metadata?.tags || [],
      project_tag: wrapperResult.metadata?.project_tag || 'unclassified',
      project_id: wrapperResult.metadata?.project_id,
      project_name: wrapperResult.metadata?.project_name,
      source: wrapperResult.metadata?.source || 'MEMORY.md',
      line: wrapperResult.metadata?.line || 0,
      timestamp: wrapperResult.created_at,
      local_id: wrapperResult.metadata?.source_id,
    };
  }

  /**
   * 上传记忆到Wrapper Service
   */
  async uploadMemories(entries, batchSize = 10) {
    const memories = entries.map(e => this.toWrapperFormat(e));

    const response = await fetch(`${this.baseUrl}/api/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memories, batch_size: batchSize }),
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * 搜索记忆
   */
  async searchMemories(query, options = {}) {
    const { mode = 'hybrid', limit = 10, threshold = 0.7, filters = {} } = options;

    const response = await fetch(`${this.baseUrl}/api/v1/memories/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode, limit, threshold, filters }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      results: data.results.map(r => this.fromWrapperFormat(r)),
      count: data.count,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/api/v1/health`);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

---

**文档第一部分完成**  
**下一部分**: 集成指南和测试

## 五、集成指南

### 5.1 更新配置文件

**文件**: `~/.opencode/memory/memory-config.json`

```json
{
  "version": "2.0",
  "network": {
    "wrapperUrl": "http://localhost:3001",
    "timeoutMs": 5000,
    "enableAutoFallback": true
  },
  "embedding": {
    "provider": "external",
    "endpoint": "http://localhost:18000/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B"
  },
  "semanticSearch": {
    "enabled": true,
    "defaultLimit": 10,
    "defaultThreshold": 0.7
  }
}
```

**关键配置**:

- `wrapperUrl`: Wrapper Service地址
- `embedding.endpoint`: Embedding服务地址（Wrapper Service提供）

---

### 5.2 使用适配器

**在现有代码中集成**:

```javascript
import { WrapperServiceAdapter } from './lib/wrapper-adapter.js';
// 初始化适配器
const adapter = new WrapperServiceAdapter('http://localhost:3001');
// 上传记忆
async function uploadToWrapper(entries) {
  try {
    const result = await adapter.uploadMemories(entries);
    console.log(`上传成功: ${result.uploaded}条`);
    console.log(`失败: ${result.failed}条`);
    return result;
  } catch (error) {
    console.error('上传失败:', error);
    throw error;
  }
}
// 搜索记忆
async function searchFromWrapper(query, projectTag) {
  try {
    const result = await adapter.searchMemories(query, {
      mode: 'hybrid',
      limit: 10,
      threshold: 0.7,
      filters: { project_tag: projectTag },
    });
    console.log(`找到 ${result.count} 条结果`);
    return result.results;
  } catch (error) {
    console.error('搜索失败:', error);
    throw error;
  }
}
// 健康检查
async function checkWrapperHealth() {
  try {
    const health = await adapter.healthCheck();
    console.log('Wrapper Service状态:', health.status);
    return health;
  } catch (error) {
    console.error('健康检查失败:', error);
    return { status: 'unhealthy', error: error.message };
  }
}
```

---

### 5.3 错误处理

**推荐的错误处理策略**:

```javascript
async function uploadWithFallback(entries) {
  try {
    // 尝试上传到Wrapper Service
    return await adapter.uploadMemories(entries);
  } catch (error) {
    console.warn('Wrapper Service不可用，回退到本地存储');
    // 回退到本地存储
    return await saveToLocalStorage(entries);
  }
}
async function searchWithFallback(query, options) {
  try {
    // 尝试从Wrapper Service搜索
    return await adapter.searchMemories(query, options);
  } catch (error) {
    console.warn('Wrapper Service不可用，使用本地搜索');
    // 回退到本地搜索
    return await searchLocalStorage(query, options);
  }
}
```

**关键点**:

- ✅ 始终提供fallback机制
- ✅ 记录错误日志
- ✅ 对用户透明（自动切换）

---

## 六、测试指南

### 6.1 单元测试

**文件**: `tests/wrapper-adapter.test.js`

```javascript
import { WrapperServiceAdapter } from '../lib/wrapper-adapter.js';
describe('WrapperServiceAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new WrapperServiceAdapter('http://localhost:3001');
  });

  describe('toWrapperFormat', () => {
    it('应该正确转换插件格式到Wrapper格式', () => {
      const pluginEntry = {
        id: 'local-001',
        content: '测试内容',
        type: 'preference',
        tags: ['test'],
        project_tag: 'projectA',
      };

      const result = adapter.toWrapperFormat(pluginEntry);

      expect(result.content).toBe('测试内容');
      expect(result.metadata.type).toBe('preference');
      expect(result.metadata.tags).toEqual(['test']);
      expect(result.metadata.project_tag).toBe('projectA');
      expect(result.metadata.source_id).toBe('local-001');
      expect(result.entities).toEqual([]);
    });
  });

  describe('fromWrapperFormat', () => {
    it('应该正确转换Wrapper格式到插件格式', () => {
      const wrapperResult = {
        id: 'memory:001',
        content: '测试内容',
        metadata: {
          type: 'preference',
          tags: ['test'],
          project_tag: 'projectA',
          source_id: 'local-001',
        },
        score: 0.92,
        created_at: '2026-03-05T10:30:00Z',
      };

      const result = adapter.fromWrapperFormat(wrapperResult);

      expect(result.id).toBe('memory:001');
      expect(result.content).toBe('测试内容');
      expect(result.type).toBe('preference');
      expect(result.score).toBe(0.92);
      expect(result.local_id).toBe('local-001');
    });
  });
});
```

---

### 6.2 集成测试

**文件**: `tests/integration/wrapper-service.test.js`

```javascript
import { WrapperServiceAdapter } from '../../lib/wrapper-adapter.js';
describe('Wrapper Service Integration', () => {
  let adapter;

  beforeAll(() => {
    adapter = new WrapperServiceAdapter('http://localhost:3001');
  });

  it('应该能够上传记忆', async () => {
    const entries = [
      {
        id: 'test-001',
        content: '集成测试记忆',
        type: 'test',
        tags: ['integration'],
        project_tag: 'test-project',
      },
    ];

    const result = await adapter.uploadMemories(entries);

    expect(result.success).toBe(true);
    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('应该能够搜索记忆', async () => {
    const result = await adapter.searchMemories('集成测试', {
      mode: 'hybrid',
      limit: 10,
      filters: { project_tag: 'test-project' },
    });

    expect(result.count).toBeGreaterThan(0);
    expect(result.results[0]).toHaveProperty('content');
    expect(result.results[0]).toHaveProperty('score');
  });

  it('应该能够进行健康检查', async () => {
    const health = await adapter.healthCheck();

    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('services');
  });
});
```

---

### 6.3 手动测试

**测试步骤**:

1. **启动Wrapper Service**
   ```bash
   cd D:/embedding_service/wrapper-service
   python -m src.main
   ```
2. **测试健康检查**
   ```bash
   curl http://localhost:3001/api/v1/health
   ```
3. **测试上传记忆**
   ```bash
   curl -X POST http://localhost:3001/api/v1/memories \
     -H "Content-Type: application/json" \
     -d '{
       "memories": [{
         "content": "测试记忆",
         "metadata": {
           "type": "test",
           "project_tag": "test-project"
         }
       }]
     }'
   ```
4. **测试搜索记忆**
   ```bash
   curl -X POST http://localhost:3001/api/v1/memories/search \
     -H "Content-Type: application/json" \
     -d '{
       "query": "测试",
       "mode": "hybrid",
       "limit": 10
     }'
   ```

---

## 七、注意事项

### 7.1 兼容性

**版本要求**:

- Wrapper Service: v1.0+
- OpenCode Memory Plugin: v2.0+
- Node.js: 18+
  **向后兼容**:
- v1.x插件继续使用本地存储
- v2.0+插件可选使用Wrapper Service
- 通过配置开关控制

---

### 7.2 性能考虑

**批量上传**:

- 推荐批量大小：10-20条
- 过大会导致超时
- 过小会增加网络开销
  **搜索优化**:
- 使用`filters`减少结果集
- 合理设置`threshold`（推荐0.7）
- `limit`不要过大（推荐10-50）
  **缓存策略**:
- 搜索结果可以缓存5-10分钟
- 上传后清除相关缓存

---

### 7.3 安全考虑

**当前版本**:

- ⚠️ 无认证机制
- ⚠️ 仅限本地访问
- ⚠️ 不要暴露到公网
  **未来版本**:
- 🔒 添加API Key认证
- 🔒 支持HTTPS
- 🔒 添加访问控制

---

### 7.4 故障排查

**常见问题**:
**1. 连接失败**

```
Error: fetch failed
```

**解决方案**:

- 检查Wrapper Service是否启动
- 检查端口是否正确（3001）
- 检查防火墙设置
  **2. 上传失败**

```
Error: Upload failed: 400 Bad Request
```

**解决方案**:

- 检查数据格式是否正确
- 检查必填字段是否完整
- 查看Wrapper Service日志
  **3. 搜索无结果**

```
{ "count": 0, "results": [] }
```

**解决方案**:

- 检查是否有数据上传
- 降低`threshold`值
- 检查`filters`是否过于严格
- 尝试不同的`mode`（vector/keyword/hybrid）

---

## 八、开发路线图

### 8.1 当前状态（v2.0）

- ✅ 基础适配器实现
- ✅ 上传、搜索、健康检查
- ✅ 数据格式映射
- ✅ 错误处理和fallback

### 8.2 未来计划（v2.1+）

- 📋 添加批量删除功能
- 📋 添加记忆更新功能
- 📋 支持增量同步
- 📋 添加冲突解决机制
- 📋 性能优化（连接池、缓存）

---

## 九、总结

### 9.1 关键要点

1. ✅ **使用适配器模式**：解耦插件和Wrapper Service
2. ✅ **所有业务字段放metadata**：保持灵活性
3. ✅ **提供fallback机制**：确保可用性
4. ✅ **充分测试**：单元测试+集成测试
5. ✅ **错误处理**：优雅降级

### 9.2 开发检查清单

**实现阶段**:

- [ ] 创建`lib/wrapper-adapter.js`
- [ ] 实现格式转换方法
- [ ] 实现API调用方法
- [ ] 添加错误处理
- [ ] 实现fallback机制
      **测试阶段**:
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 手动测试所有API
- [ ] 测试错误场景
- [ ] 测试fallback机制
      **部署阶段**:
- [ ] 更新配置文件
- [ ] 更新文档
- [ ] 发布新版本
- [ ] 通知用户升级

---

## 十、参考资源

**相关文档**:

- [Wrapper Service技术设计](../../embedding_service/.opencode/plans/memory-api-technical-design-v2.md)
- [API对比分析](../../embedding_service/.opencode/plans/PLUGIN_API_ANALYSIS.md)
- [调整决策分析](../../embedding_service/.opencode/plans/WHO_SHOULD_CHANGE.md)
  **联系方式**:
- 技术问题：提交GitHub Issue
- 设计讨论：参与GitHub Discussions

---

**文档完成**  
**版本**: 1.0  
**最后更新**: 2026-03-04  
**下一步**: 开始实现适配器模块
