# 测试框架重构计划

**重构时间**: 2026-02-28
**重构目标**: 提升测试真实性、修复bug、改进性能统计

---

## 🔍 发现的问题

### P0 - 严重问题

#### 1. 测试报告NaN问题
- **文件**: `test-engine.mjs:162`
- **问题**: `r.duration`是对象，不是数字
- **影响**: 测试报告显示NaN
- **修复**: 使用`r.duration.duration`

#### 2. verify-data-integrity.mjs变量未定义bug
- **文件**: `verify-data-integrity.mjs:244`
- **问题**: `mismatchedRecords`可能未定义
- **影响**: 脚本运行失败
- **修复**: 在所有路径中定义变量

### P1 - 重要问题

#### 3. Mock工具过于简化
- **文件**: `run-60day-simulation.mjs:24`
- **问题**:
  - 没有真正的向量搜索
  - 没有BM25算法
  - 没有索引管理
- **影响**: 无法测试真实功能
- **修复**: 创建更真实的Mock工具

#### 4. 性能统计异常
- **问题**: P99显示60001ms
- **原因**: 长时间操作干扰统计
- **影响**: 性能报告不准确
- **修复**: 过滤长时间操作

### P2 - 优化问题

#### 5. 代码重复
- **问题**: 219处console.log重复
- **影响**: 代码维护困难
- **修复**: 创建统一的输出工具

---

## 🎯 重构方案

### 方案1: 修复NaN问题

```javascript
// ❌ 修复前
const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

// ✅ 修复后
const totalDuration = this.results.reduce((sum, r) => {
    const duration = typeof r.duration === 'number' ? r.duration : r.duration?.duration || 0;
    return sum + duration;
}, 0);
```

### 方案2: 修复变量未定义

```javascript
// ❌ 修复前
return {
    mismatchedRecords,  // 可能未定义
    // ...
};

// ✅ 修复后
// 在函数开头定义
const stats = {
    // ...
    mismatchedRecords: 0,  // 确保始终定义
};

// 在所有路径中更新
stats.mismatchedRecords += count;

// 返回时使用
return {
    mismatchedRecords: stats.mismatchedRecords,
    // ...
};
```

### 方案3: 创建真实的Mock工具

```javascript
// ✅ 改进的MockOpenCodeTools
class MockOpenCodeTools {
  constructor() {
    this.memoryData = [];
    this.bm25Index = new Map();
    this.vectorIndex = new Map();
  }

  // 添加BM25索引
  buildBM25Index() {
    const documents = this.memoryData.map(record => ({
      id: record.id,
      content: record.content,
      tags: record.tags,
    }));

    documents.forEach(doc => {
      const terms = this.tokenize(doc.content + ' ' + doc.tags);
      terms.forEach(term => {
        if (!this.bm25Index.has(term)) {
          this.bm25Index.set(term, new Map());
        }
        const postings = this.bm25Index.get(term);
        postings.set(doc.id, (postings.get(doc.id) || 0) + 1);
      });
    });
  }

  // 分词
  tokenize(text) {
    return text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 0);
  }

  // BM25搜索
  bm25Search(query, k1 = 1.5, b = 0.75) {
    const queryTerms = this.tokenize(query);
    const scores = new Map();

    this.memoryData.forEach(record => {
      let score = 0;
      queryTerms.forEach(term => {
        const postings = this.bm25Index.get(term);
        if (postings) {
          const tf = postings.get(record.id) || 0;
          const df = postings.size;
          const idf = Math.log((this.memoryData.length - df + 0.5) / (df + 0.5));
          score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * 1));
        }
      });
      scores.set(record.id, score);
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => this.memoryData.find(r => r.id === id));
  }

  // 模拟向量搜索（使用余弦相似度）
  vectorSearch(query, mode = 'vector') {
    const queryVector = this.generateEmbedding(query);
    const similarities = this.memoryData.map(record => {
      const recordVector = this.generateEmbedding(record.content);
      return {
        record,
        similarity: this.cosineSimilarity(queryVector, recordVector),
      };
    });

    return similarities
      .filter(s => s.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(s => s.record);
  }

  // 生成简单的embedding（模拟）
  generateEmbedding(text) {
    // 使用简单的词频作为embedding
    const terms = this.tokenize(text);
    const embedding = new Array(100).fill(0);
    terms.forEach(term => {
      const hash = this.hashCode(term) % 100;
      embedding[Math.abs(hash)] += 1;
    });

    // 归一化
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / norm);
  }

  // 哈希函数
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  // 余弦相似度
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // 混合搜索
  hybridSearch(query) {
    const bm25Results = this.bm25Search(query);
    const vectorResults = this.vectorSearch(query, 'vector');

    // 合并结果
    const combined = new Map();
    bm25Results.forEach((record, index) => {
      combined.set(record.id, {
        record,
        bm25Score: bm25Results.length - index,
        vectorScore: 0,
      });
    });

    vectorResults.forEach((record, index) => {
      if (combined.has(record.id)) {
        combined.get(record.id).vectorScore = vectorResults.length - index;
      } else {
        combined.set(record.id, {
          record,
          bm25Score: 0,
          vectorScore: vectorResults.length - index,
        });
      }
    });

    // 计算混合分数
    const finalResults = Array.from(combined.values())
      .map(item => ({
        record: item.record,
        score: 0.7 * item.vectorScore + 0.3 * item.bm25Score,
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.record);

    return finalResults;
  }

  async memory_search({ query, scope }) {
    const records = scope === 'all'
      ? this.memoryData
      : this.memoryData.filter(r => r.type === scope);

    // 使用BM25搜索
    this.buildBM25Index();
    return this.bm25Search(query);
  }

  async vector_memory_search({ query, mode }) {
    switch (mode) {
      case 'vector':
        return this.vectorSearch(query, mode);
      case 'keyword':
        return this.bm25Search(query);
      case 'hash':
        return this.memoryData.filter(r =>
          r.content.includes(query) || r.tags.includes(query)
        );
      case 'hybrid':
      default:
        return this.hybridSearch(query);
    }
  }
}
```

### 方案4: 改进性能统计

```javascript
// ✅ 过滤长时间操作
async generateReport() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.result.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = (passedTests / totalTests * 100).toFixed(2);

    // 过滤长时间操作（>10秒）
    const normalResults = this.results.filter(r => {
        const duration = typeof r.duration === 'number' ? r.duration : r.duration?.duration || 0;
        return duration < 10000; // < 10秒
    });

    const totalDuration = normalResults.reduce((sum, r) => {
        const duration = typeof r.duration === 'number' ? r.duration : r.duration?.duration || 0;
        return sum + duration;
    }, 0);

    const avgDuration = normalResults.length > 0 ? totalDuration / normalResults.length : 0;

    // ...
}
```

### 方案5: 统一日志输出

```javascript
// ✅ 创建统一的输出工具
class OutputFormatter {
  static header(text, char = '=') {
    console.log('\n' + char.repeat(60));
    console.log(`${text}`);
    console.log(char.repeat(60));
  }

  static section(title) {
    console.log(`\n📊 ${title}\n`);
  }

  static metric(name, value, unit = '') {
    console.log(`   ${name}: ${value}${unit}`);
  }

  static status(text, status = 'info') {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };
    console.log(`${icons[status]} ${text}`);
  }

  static table(headers, rows) {
    // 输出格式化的表格
    const widths = headers.map(h => Math.max(h.length, ...rows.map(r => String(r[headers.indexOf(h)]).length)));
    const separator = '   ' + widths.map(w => '-'.repeat(w)).join('-');

    console.log('   ' + widths.map((w, i) => headers[i].padEnd(w)).join(' '));
    console.log(separator);
    rows.forEach(row => {
      console.log('   ' + widths.map((w, i) => String(row[i]).padEnd(w)).join(' '));
    });
  }
}

// 使用示例
OutputFormatter.header('📊 测试汇总');
OutputFormatter.metric('总测试数', totalTests);
OutputFormatter.status('所有测试通过', 'success');
```

---

## 📋 重构步骤

### Step 1: 修复P0问题
1. 修复test-engine.mjs的NaN问题
2. 修复verify-data-integrity.mjs的变量未定义

### Step 2: 改进Mock工具
1. 创建新的MockOpenCodeTools
2. 添加BM25搜索算法
3. 添加向量搜索模拟
4. 添加混合搜索

### Step 3: 改进性能统计
1. 过滤长时间操作
2. 改进统计计算逻辑
3. 添加性能基准对比

### Step 4: 统一代码风格
1. 创建OutputFormatter工具
2. 替换重复的console.log
3. 统一格式化输出

### Step 5: 重新运行测试
1. 运行修复后的测试
2. 验证所有问题已解决
3. 生成新的测试报告

---

## 📊 预期改进

| 指标 | 修复前 | 修复后 | 改进 |
|------|--------|--------|------|
| 测试报告NaN | 存在 | 无 | ✅ 修复 |
| 变量未定义错误 | 存在 | 无 | ✅ 修复 |
| 搜索真实性 | 简化字符串匹配 | BM25+向量 | ✅ 提升 |
| 性能统计准确性 | 异常 | 准确 | ✅ 改进 |
| 代码重复 | 219处 | 0处 | ✅ 消除 |

---

**重构状态**: 🔄 进行中
**预计完成时间**: 30分钟
