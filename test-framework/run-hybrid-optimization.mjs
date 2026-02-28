#!/usr/bin/env node
/**
 * Hybrid搜索权重优化测试（适配real-embedding-tools）
 */

import RealEmbeddingTools from './real-embedding-tools.mjs';
import labeledDataset from './labeled-dataset.mjs';

const weightConfigs = [
  { name: '当前配置', vector: 0.7, bm25: 0.3 },
  { name: '均衡配置', vector: 0.5, bm25: 0.5 },
  { name: 'BM25主导', vector: 0.4, bm25: 0.6 },
  { name: '向量主导', vector: 0.6, bm25: 0.4 },
];

async function testWeightConfig(config, tools, hybridQueries) {
  const originalVectorMemorySearch = tools.vector_memory_search.bind(tools);
  
  tools.vector_memory_search = async function({ query, mode, limit = 10 }) {
    if (mode !== 'hybrid') {
      return originalVectorMemorySearch({ query, mode, limit });
    }
    
    this.stats.totalSearches++;
    const queryEmbedding = await this.getEmbedding(query);
    const records = this.memoryData;
    
    const vectorScores = new Map();
    records.forEach(record => {
      vectorScores.set(record.id, this.cosineSimilarity(queryEmbedding, record.embedding));
    });
    
    const bm25Scores = new Map();
    records.forEach(record => {
      bm25Scores.set(record.id, this.bm25Score(query, record.id));
    });
    
    const vectorScoresArray = Array.from(vectorScores.values());
    const bm25ScoresArray = Array.from(bm25Scores.values());
    const maxVectorScore = Math.max(...vectorScoresArray, 1);
    const maxBM25Score = Math.max(...bm25ScoresArray, 1);
    
    const results = records.map(record => {
      const normalizedVector = (vectorScores.get(record.id) || 0) / maxVectorScore;
      const normalizedBM25 = (bm25Scores.get(record.id) || 0) / maxBM25Score;
      const hybridScore = config.vector * normalizedVector + config.bm25 * normalizedBM25;
      
      return { ...record, score: hybridScore };
    }).sort((a, b) => b.score - a.score).slice(0, limit);
    
    return results;
  };
  
  const results = [];
  for (const query of hybridQueries) {
    const searchResults = await tools.vector_memory_search({ query: query.query, mode: 'hybrid', limit: 10 });
    
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
    
    results.push({ query: query.query, recall, precision, mrr });
  }
  
  tools.vector_memory_search = originalVectorMemorySearch;
  
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;
  
  return {
    config: config.name,
    weights: `${config.vector}/${config.bm25}`,
    avgRecall,
    avgPrecision,
    avgMRR,
  };
}

async function main() {
  console.log('🔬 Hybrid搜索权重优化测试\n' + '='.repeat(50) + '\n');
  
  const tools = new RealEmbeddingTools({
    endpoint: 'http://localhost:18000/v1/embeddings',
    model: 'Qwen3-Embedding-0.6B',
  });
  
  console.log('📚 加载数据集...');
  await tools.loadLabeledDataset(labeledDataset);
  
  const hybridQueries = labeledDataset.queries.filter(q => q.mode === 'hybrid');
  console.log(`✅ 找到 ${hybridQueries.length} 个hybrid查询\n`);
  
  const allResults = [];
  
  for (const config of weightConfigs) {
    console.log(`📊 测试: ${config.name} (${config.vector}/${config.bm25})`);
    const result = await testWeightConfig(config, tools, hybridQueries);
    allResults.push(result);
    
    console.log(`   Recall: ${(result.avgRecall * 100).toFixed(1)}%`);
    console.log(`   Precision: ${(result.avgPrecision * 100).toFixed(1)}%`);
    console.log(`   MRR: ${result.avgMRR.toFixed(4)}\n`);
  }
  
  allResults.sort((a, b) => b.avgRecall - a.avgRecall);
  
  console.log('='.repeat(50));
  console.log('📊 测试结果（按Recall排序）\n');
  
  allResults.forEach((result, i) => {
    const prefix = i === 0 ? '🏆' : '  ';
    console.log(`${prefix} ${result.config.padEnd(15)} ${result.weights}`);
    console.log(`   Recall: ${(result.avgRecall * 100).toFixed(2)}%`);
    console.log(`   Precision: ${(result.avgPrecision * 100).toFixed(2)}%`);
    console.log(`   MRR: ${result.avgMRR.toFixed(4)}`);
    
    if (result.avgRecall + result.avgPrecision > 0) {
      const f1 = 2 * result.avgRecall * result.avgPrecision / (result.avgRecall + result.avgPrecision);
      console.log(`   F1: ${f1.toFixed(4)}`);
    }
    console.log();
  });
  
  const best = allResults[0];
  console.log('='.repeat(50));
  console.log('💡 最佳配置');
  console.log('='.repeat(50));
  console.log(`\n${best.config} (${best.weights})`);
  console.log(`Recall: ${(best.avgRecall * 100).toFixed(2)}%`);
  console.log(`Precision: ${(best.avgPrecision * 100).toFixed(2)}%`);
  console.log(`MRR: ${best.avgMRR.toFixed(4)}\n`);
  
  if (best.avgRecall >= 0.7) {
    console.log('✅ 满足Recall ≥ 70%目标！\n');
  }
}

main().catch(console.error);