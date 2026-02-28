# 向量生成机制分析

**分析时间**: 2026-02-28
**分析对象**: mock-opencode-tools.mjs 的向量生成

---

## 📊 当前实现分析

### 向量生成代码

```javascript
/**
 * 生成简单的embedding（模拟向量）
 */
generateEmbedding(text) {
  const terms = this.tokenize(text);
  const embedding = new Array(100).fill(0);

  terms.forEach(term => {
    const hash = this.hashCode(term) % 100;
    embedding[Math.abs(hash)] += 1;
  });

  // 归一化
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? embedding.map(val => val / norm) : embedding;
}
```

### 关键问题

#### ❌ 问题1: 并没有调用嵌入服务

**当前实现**:
- 使用哈希函数将词映射到100维向量
- 简单的词频计数
- 纯本地计算，**没有任何网络请求**
- **没有调用 ModelScope API**
- **没有调用任何嵌入服务**

**代码证据**:
```javascript
// ❌ 没有以下代码：
// - fetch('https://api-inference.modelscope.cn/v1/embeddings')
// - MODELSCOPE_API_KEY
// - 真实的向量API调用
```

#### ❌ 问题2: 只是哈希模拟

**哈希函数**:
```javascript
hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}
```

**向量生成**:
```javascript
const hash = this.hashCode(term) % 100;
embedding[Math.abs(hash)] += 1;
```

**结果**: 相同的词总是产生相同的向量，但这个向量不是语义向量！

#### ❌ 问题3: 维度不匹配

**当前实现**:
- 维度: 100
- 类型: 词频哈希

**真实API**:
- 维度: 1024 (Qwen/Qwen3-Embedding-0.6B)
- 类型: 真实语义向量

**不匹配**: 测试结果不能反映真实性能！

---

## 📈 对比分析

| 特性 | 当前模拟 | 真实API | 差距 |
|------|---------|---------|------|
| **调用嵌入服务** | ❌ 否 | ✅ 是 | 无法测试API |
| **网络请求** | ❌ 否 | ✅ 是 | 无法测试网络 |
| **语义理解** | ❌ 否 | ✅ 是 | 无法测试语义 |
| **API集成** | ❌ 否 | ✅ 是 | 无法验证集成 |
| **性能真实性** | ⚠️ 低 | ✅ 高 | 结果不准确 |
| **维度** | 100 | 1024 | 不匹配 |
| **延迟** | ~0ms | ~50-100ms | 无法测试延迟 |

---

## 🎯 改进方案

### 方案1: 集成真实ModelScope API（推荐）

**优点**:
- ✅ 真实的语义搜索
- ✅ 真实的API调用
- ✅ 真实的性能测试
- ✅ 可以测试API集成

**缺点**:
- ⚠️ 需要网络连接
- ⚠️ 需要 API Key
- ⚠️ 速度较慢

**实现代码**:
```javascript
/**
 * 真实的向量生成（使用ModelScope API）
 */
async generateEmbedding(text) {
  const apiKey = process.env.MODELSCOPE_API_KEY;
  const endpoint = process.env.EMBEDDING_ENDPOINT ||
    'https://api-inference.modelscope.cn/v1/embeddings';
  const model = process.env.EMBEDDING_MODEL ||
    'Qwen/Qwen3-Embedding-0.6B';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: text,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // 支持多种API响应格式
    if (data.data && data.data[0] && data.data[0].embedding) {
      return data.data[0].embedding;
    } else if (Array.isArray(data) && data[0] && data[0].embedding) {
      return data[0].embedding;
    } else if (data.embeddings) {
      return data.embeddings[0];
    } else {
      throw new Error('Unknown API response format');
    }
  } catch (error) {
    console.error('Embedding API error:', error);
    // 降级到哈希模拟
    console.warn('Falling back to hash-based embedding');
    return this.generateHashEmbedding(text);
  }
}

/**
 * 哈希嵌入（降级方案）
 */
generateHashEmbedding(text) {
  const terms = this.tokenize(text);
  const embedding = new Array(100).fill(0);

  terms.forEach(term => {
    const hash = this.hashCode(term) % 100;
    embedding[Math.abs(hash)] += 1;
  });

  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return norm > 0 ? embedding.map(val => val / norm) : embedding;
}
```

**使用方式**:
```javascript
// 在 vectorSearch 中使用
async vectorSearch(query, mode = 'vector') {
  // 生成查询向量（使用真实API）
  const queryVector = await this.generateEmbedding(query);

  const similarities = this.memoryData.map(record => {
    const recordVector = this.vectorIndex.get(record.id);
    return {
      record,
      similarity: this.cosineSimilarity(queryVector, recordVector),
    };
  });

  return similarities
    .filter(s => s.similarity > 0.1) // 提高阈值
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10)
    .map(s => s.record);
}
```

### 方案2: 可配置模式（灵活）

**实现**:
```javascript
class MockOpenCodeTools {
  constructor(options = {}) {
    this.memoryData = [];
    this.bm25Index = new Map();
    this.vectorIndex = new Map();

    // 配置项
    this.embeddingMode = options.embeddingMode || 'real'; // 'real' or 'mock'
    this.apiEndpoint = options.apiEndpoint || 'https://api-inference.modelscope.cn/v1/embeddings';
    this.apiKey = options.apiKey || process.env.MODELSCOPE_API_KEY;
    this.model = options.model || 'Qwen/Qwen3-Embedding-0.6B';
  }

  /**
   * 生成embedding（根据模式）
   */
  async generateEmbedding(text) {
    if (this.embeddingMode === 'real') {
      return await this.generateRealEmbedding(text);
    } else {
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * 真实embedding（调用API）
   */
  async generateRealEmbedding(text) {
    // ... 方案1的代码
  }

  /**
   * 模拟embedding（哈希）
   */
  generateMockEmbedding(text) {
    // ... 当前的代码
  }
}
```

**使用方式**:
```javascript
// 测试时可以选择模式
const tools = new MockOpenCodeTools({
  embeddingMode: process.env.TEST_MODE === 'fast' ? 'mock' : 'real',
});

// 快速测试
TEST_MODE=fast node run-60day-simulation.mjs

// 真实测试
node run-60day-simulation.mjs
```

### 方案3: 混合模式（推荐用于测试）

**实现**:
```javascript
/**
 * 混合向量生成（首次调用API，后续使用缓存）
 */
async generateEmbedding(text) {
  // 1. 检查缓存
  const cacheKey = this.hashCode(text).toString();
  if (this.embeddingCache.has(cacheKey)) {
    return this.embeddingCache.get(cacheKey);
  }

  // 2. 尝试调用真实API
  try {
    const realEmbedding = await this.generateRealEmbedding(text);
    this.embeddingCache.set(cacheKey, realEmbedding);
    return realEmbedding;
  } catch (error) {
    // 3. 降级到模拟
    console.warn('API error, falling back to mock embedding:', error.message);
    const mockEmbedding = this.generateMockEmbedding(text);
    this.embeddingCache.set(cacheKey, mockEmbedding);
    return mockEmbedding;
  }
}
```

---

## 📋 建议的测试策略

### 阶段1: 快速验证（使用mock模式）
```bash
# 使用模拟模式快速验证功能
TEST_MODE=mock node run-60day-simulation.mjs
```

**优点**:
- 速度快
- 无需网络
- 无需API Key
- 适合快速迭代

### 阶段2: 真实测试（使用real模式）
```bash
# 使用真实模式测试性能和集成
export MODELSCOPE_API_KEY='your-api-key'
node run-60day-simulation.mjs
```

**优点**:
- 真实的语义搜索
- 真实的API性能
- 验证API集成

### 阶段3: 混合测试（使用缓存模式）
```bash
# 使用混合模式平衡速度和真实性
node run-60day-simulation.mjs
```

**优点**:
- 首次调用API
- 后续使用缓存
- 平衡性能和真实性

---

## ✅ 结论

### 当前问题
1. ❌ **没有调用嵌入服务** - 只是哈希模拟
2. ❌ **不是真正的语义搜索** - 基于词频
3. ❌ **无法测试API集成** - 无网络请求
4. ❌ **性能测试不准确** - 无法反映真实延迟

### 建议改进
1. ✅ **集成真实ModelScope API** - 实现真正的语义搜索
2. ✅ **支持可配置模式** - 根据需要选择mock或real
3. ✅ **实现缓存机制** - 平衡性能和真实性
4. ✅ **完善错误处理** - API失败时降级到mock

### 下一步
1. 实现方案1（集成真实API）
2. 创建新的测试工具类
3. 更新文档说明配置选项
4. 运行真实测试验证性能

---

**分析完成**: 2026-02-28
**建议**: 立即实现真实API集成
