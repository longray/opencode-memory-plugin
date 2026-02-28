#!/usr/bin/env node
/**
 * 阶段1优化验证测试
 * 验证动态返回数量 + BM25阈值优化的效果
 */

import { BM25Index } from '../opencode-memory-plugin/lib/bm25.js';
import labeledDataset from './labeled-dataset.mjs';

class OptimizedEmbeddingTools {
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'http://localhost:18000/v1/embeddings';
    this.model = options.model || 'Qwen3-Embedding-0.6B';
    this.embeddingDimension = options.embeddingDimension || 1024;
    
    // 内存存储
    this.memoryData = [];
    this.vectorIndex = new Map();
    this.embeddingCache = new Map();
    
    // 使用插件真实BM25
    this.bm25PluginIndex = new BM25Index();
    
    // 阶段1优化配置
    this.searchConfig = {
      limits: {
        semantic: 10,  // 保持不变
        keyword: 6,    // 减少返回数量
        hybrid: 5      // 减少返回数量
      },
      minScores: {
        semantic: 0.1,  // 保持宽松
        keyword: 0.5,   // 提高阈值
        hybrid: 0.3     // 适度提高
      }
    };
    
    this.stats = {
      totalWrites: 0,
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      errors: 0,
    };
    
    console.log(`🔗 OptimizedEmbeddingTools initialized`);
    console.log(`   Limits: ${JSON.stringify(this.searchConfig.limits)}`);
    console.log(`   MinScores: ${JSON.stringify(this.searchConfig.minScores)}`);
  }

  async getEmbedding(text) {
    const cacheKey = text.substring(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      this.stats.cacheHits++;
      return this.embeddingCache.get(cacheKey);
    }
    
    this.stats.cacheMisses++;
    this.stats.apiCalls++;
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: text }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      let embedding;
      if (Array.isArray(data)) {
        embedding = data;
      } else if (data.data && Array.isArray(data.data) && data.data[0]?.embedding) {
        embedding = data.data[0].embedding;
      } else if (data.embeddings && Array.isArray(data.embeddings)) {
        embedding = data.embeddings;
      } else {
        throw new Error('Unknown response format');
      }
      
      this.embeddingCache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }

  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    
    const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
    
    return norm1 > 0 && norm2 > 0 ? dotProduct / (norm1 * norm2) : 0;
  }

  async _addDocumentDirectly(id, content, type, tags) {
    const embedding = await this.getEmbedding(content);
    
    const record = {
      id,
      content,
      type,
      tags: typeof tags === 'string' ? tags.split(',') : tags,
      timestamp: new Date().toISOString(),
      embedding,
    };
    
    this.memoryData.push(record);
    this.vectorIndex.set(id, embedding);
    this.bm25PluginIndex.addDocument(id, content, { type, tags: record.tags });
    
    return { success: true, id };
  }

  async loadLabeledDataset(dataset) {
    console.log(`Loading ${dataset.documents.length} documents...`);
    
    for (const doc of dataset.documents) {
      await this._addDocumentDirectly(doc.id, doc.content, doc.type, doc.tags);
    }
    
    console.log(`Loaded ${this.memoryData.length} documents`);
    return { loaded: dataset.documents.length };
  }

  async memory_search({ query, scope = 'all', limit = 10 }) {
    this.stats.totalSearches++;
    
    const optimizedLimit = this.searchConfig.limits.keyword;
    const minScore = this.searchConfig.minScores.keyword;
    
    // 使用插件BM25，应用优化的minScore
    const results = this.bm25PluginIndex.search(query, {
      limit: optimizedLimit,
      minScore
    });
    
    return results.map(r => {
      const record = this.memoryData.find(d => d.id === r.id);
      return { ...record, score: r.score };
    });
  }

  async vector_memory_search({ query, mode = 'hybrid', limit = 10 }) {
    this.stats.totalSearches++;
    
    const optimizedLimit = this.searchConfig.limits[mode] || limit;
    const minScore = this.searchConfig.minScores[mode] || 0.1;
    
    const queryEmbedding = await this.getEmbedding(query);
    
    if (mode === 'keyword') {
      // 使用插件BM25
      const results = this.bm25PluginIndex.search(query, {
        limit: optimizedLimit,
        minScore
      });
      
      return results.map(r => {
        const record = this.memoryData.find(d => d.id === r.id);
        return { ...record, score: r.score };
      });
    }
    
    // vector或hybrid模式
    const vectorScores = new Map();
    for (const record of this.memoryData) {
      vectorScores.set(record.id, this.cosineSimilarity(queryEmbedding, record.embedding));
    }
    
    if (mode === 'vector') {
      const sorted = [...vectorScores.entries()]
        .sort((a, b) => b[1] - a[1])
        .filter(([_, score]) => score > 0)
        .slice(0, optimizedLimit);
      
      return sorted.map(([id, score]) => {
        const record = this.memoryData.find(d => d.id === id);
        return { ...record, score };
      });
    }
    
    // hybrid模式
    const bm25Results = this.bm25PluginIndex.search(query, {
      limit: this.memoryData.length,
      minScore: this.searchConfig.minScores.hybrid
    });
    
    const bm25Scores = new Map();
    for (const r of bm25Results) {
      bm25Scores.set(r.id, r.score);
    }
    
    const maxVector = Math.max(...vectorScores.values(), 1);
    const maxBM25 = Math.max(...bm25Scores.values(), 1);
    
    const results = this.memoryData.map(record => {
      const normVec = (vectorScores.get(record.id) || 0) / maxVector;
      const normBM25 = (bm25Scores.get(record.id) || 0) / maxBM25;
      const hybridScore = 0.7 * normVec + 0.3 * normBM25;
      
      return {
        ...record,
        score: hybridScore,
        vectorScore: vectorScores.get(record.id) || 0,
        bm25Score: bm25Scores.get(record.id) || 0
      };
    }).sort((a, b) => b.score - a.score)
      .slice(0, optimizedLimit);
    
    return results;
  }

  getStats() {
    return {
      ...this.stats,
      documentCount: this.memoryData.length,
      bm25Stats: this.bm25PluginIndex.getStats(),
      config: this.searchConfig
    };
  }
}

async function main() {
  console.log('🎯 阶段1优化验证测试');
  console.log('========================================\n');
  
  console.log('📋 优化配置:');
  console.log('   动态返回数量: semantic=10, keyword=6, hybrid=5');
  console.log('   BM25阈值: semantic=0.1, keyword=0.5, hybrid=0.3\n');
  
  const tools = new OptimizedEmbeddingTools();
  
  console.log('📚 加载数据集...');
  await tools.loadLabeledDataset(labeledDataset);
  
  const queries = labeledDataset.queries;
  console.log(`✅ 加载 ${queries.length} 个查询\n`);
  
  console.log('🚀 开始测试...\n');
  
  const results = [];
  
  for (const query of queries) {
    let searchResults;
    const limit = tools.searchConfig.limits[query.mode];
    
    if (query.mode === 'keyword') {
      searchResults = await tools.memory_search({ query: query.query });
    } else {
      searchResults = await tools.vector_memory_search({ query: query.query, mode: query.mode, limit });
    }
    
    const foundIds = new Set(searchResults.map(r => r.id));
    const foundRelevant = query.relevant.filter(id => foundIds.has(id));
    const recall = query.relevant.length > 0 ? foundRelevant.length / query.relevant.length : 0;
    const precision = searchResults.length > 0 ? foundRelevant.length / searchResults.length : 0;
    
    let mrr = 0;
    for (let i = 0; i < searchResults.length; i++) {
      if (query.relevant.includes(searchResults[i].id)) {
        mrr = 1 / (i + 1);
        break;
      }
    }
    
    results.push({
      query: query.query,
      mode: query.mode,
      recall,
      precision,
      mrr,
      resultCount: searchResults.length
    });
    
    if ((results.length % 5 === 0) || results.length === queries.length) {
      const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
      console.log(`   进度: ${results.length}/${queries.length} - Recall: ${(avgRecall * 100).toFixed(1)}%`);
    }
  }
  
  // 计算聚合指标
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 阶段1优化测试结果');
  console.log('='.repeat(50) + '\n');
  
  console.log('📈 聚合质量指标:');
  console.log(`   Recall@10:    ${(avgRecall * 100).toFixed(2)}%  (目标: ≥70%)  ${avgRecall >= 0.7 ? '✅' : '❌'}`);
  console.log(`   Precision@10: ${(avgPrecision * 100).toFixed(2)}%  (目标: ≥50%)  ${avgPrecision >= 0.5 ? '✅' : '❌'}`);
  console.log(`   MRR:          ${avgMRR.toFixed(4)}   (目标: ≥0.6)  ${avgMRR >= 0.6 ? '✅' : '❌'}`);
  
  // 按模式统计
  const modeStats = {};
  for (const r of results) {
    if (!modeStats[r.mode]) {
      modeStats[r.mode] = { recall: 0, precision: 0, mrr: 0, count: 0 };
    }
    modeStats[r.mode].recall += r.recall;
    modeStats[r.mode].precision += r.precision;
    modeStats[r.mode].mrr += r.mrr;
    modeStats[r.mode].count++;
  }
  
  console.log('\n📊 按搜索模式统计:');
  for (const [mode, stats] of Object.entries(modeStats)) {
    stats.recall /= stats.count;
    stats.precision /= stats.count;
    stats.mrr /= stats.count;
    console.log(`   ${mode.padEnd(10)}: Recall ${(stats.recall * 100).toFixed(1)}%, Precision ${(stats.precision * 100).toFixed(1)}%, MRR ${stats.mrr.toFixed(3)}, Queries: ${stats.count}`);
  }
  
  console.log('\n' + '='.repeat(50));
  
  const allPassed = avgRecall >= 0.7 && avgPrecision >= 0.5 && avgMRR >= 0.6;
  
  if (allPassed) {
    console.log('✅ 阶段1优化成功！所有目标达成！');
  } else {
    console.log('⚠️  阶段1优化部分成功：');
    if (avgRecall >= 0.7) console.log('   ✅ Recall达标');
    if (avgPrecision >= 0.5) console.log('   ✅ Precision达标');
    if (avgMRR >= 0.6) console.log('   ✅ MRR达标');
  }
  
  console.log('\n' + '='.repeat(50));
  
  return {
    avgRecall,
    avgPrecision,
    avgMRR,
    allPassed
  };
}

main().then(result => {
  process.exit(result.allPassed ? 0 : 1);
}).catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});