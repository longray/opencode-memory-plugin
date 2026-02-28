#!/usr/bin/env node
/**
 * BM25 minScore阈值优化测试
 * 测试不同的minScore阈值对Precision的影响
 */

import RealEmbeddingTools from './real-embedding-tools.mjs';
import labeledDataset from './labeled-dataset.mjs';

// 测试的minScore阈值
const minScoreThresholds = [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0];

async function testMinScore(threshold, tools, queries) {
  // 临时修改BM25搜索方法
  const originalMemorySearch = tools.memory_search;
  
  tools.memory_search = async function({ query, scope = 'all', limit = 10 }) {
    this.stats.totalSearches++;
    
    // 使用指定的minScore阈值
    const results = this.bm25Index.search(query, { limit: this.memoryData.length, minScore: threshold });
    
    // 取top N结果
    const topResults = results.slice(0, limit).map(r => {
      const record = this.memoryData.find(d => d.id === r.id);
      return {
        ...record,
        score: r.score,
      };
    });
    
    return topResults;
  };
  
  // 运行测试
  const results = [];
  for (const query of queries) {
    const searchResults = await tools.memory_search({ query: query.query, limit: 10 });
    
    const foundIds = new Set(searchResults.map(r => r.id));
    const foundRelevant = query.relevant.filter(id => foundIds.has(id));
    const recall = query.relevant.length > 0 ? foundRelevant.length / query.relevant.length : 0;
    const precision = searchResults.length > 0 ? foundRelevant.length / searchResults.length : 0;
    
    // 计算MRR
    let mrr = 0;
    for (let i = 0; i < searchResults.length; i++) {
      if (query.relevant.includes(searchResults[i].id)) {
        mrr = 1 / (i + 1);
        break;
      }
    }
    
    results.push({
      query: query.query,
      recall,
      precision,
      mrr,
      resultCount: searchResults.length,
    });
  }
  
  // 恢复原始方法
  tools.memory_search = originalMemorySearch;
  
  // 计算聚合指标
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;
  const avgResultCount = results.reduce((sum, r) => sum + r.resultCount, 0) / results.length;
  
  return {
    threshold,
    avgRecall,
    avgPrecision,
    avgMRR,
    avgResultCount,
    results,
  };
}

async function main() {
  console.log('🎯 BM25 minScore阈值优化测试');
  console.log('========================================\n');
  
  // 初始化工具
  console.log('🔧 初始化工具...');
  const tools = new RealEmbeddingTools({
    endpoint: 'http://localhost:18000/v1/embeddings',
    model: 'Qwen3-Embedding-0.6B',
  });
  
  // 加载数据集
  console.log('📚 加载标注数据集...');
  await tools.loadLabeledDataset(labeledDataset);
  
  // 筛选keyword模式的查询（使用BM25）
  const keywordQueries = labeledDataset.queries.filter(q => q.mode === 'keyword');
  console.log(`   ✅ 找到 ${keywordQueries.length} 个keyword模式查询\n`);
  
  console.log('🚀 开始测试不同minScore阈值...\n');
  
  const allResults = [];
  
  for (const threshold of minScoreThresholds) {
    console.log(`📊 测试阈值: ${threshold}...`);
    
    const result = await testMinScore(threshold, tools, keywordQueries);
    allResults.push(result);
    
    console.log(`   Recall@10:    ${(result.avgRecall * 100).toFixed(1)}%`);
    console.log(`   Precision@10: ${(result.avgPrecision * 100).toFixed(1)}%`);
    console.log(`   MRR:          ${result.avgMRR.toFixed(4)}`);
    console.log(`   平均结果数:   ${result.avgResultCount.toFixed(1)}`);
    console.log();
  }
  
  // 找到最佳平衡点
  console.log('='.repeat(70));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(70) + '\n');
  
  // 按Precision排序（目标50%+）
  const sortedByPrecision = [...allResults].sort((a, b) => b.avgPrecision - a.avgPrecision);
  
  // 按Recall排序（目标70%+）
  const sortedByRecall = [...allResults].sort((a, b) => b.avgRecall - a.avgRecall);
  
  // 显示所有结果
  console.log('详细对比:');
  console.log(`\n${'阈值'.padStart(10)} | ${'Recall'.padStart(12)} | ${'Precision'.padStart(12)} | ${'MRR'.padStart(10)} | ${'结果数'.padStart(10)}`);
  console.log('-'.repeat(70));
  
  allResults.forEach(result => {
    console.log(
      `${result.threshold.toFixed(1).padStart(10)} | ` +
      `${(result.avgRecall * 100).toFixed(1).padStart(12)}% | ` +
      `${(result.avgPrecision * 100).toFixed(1).padStart(12)}% | ` +
      `${result.avgMRR.toFixed(4).padStart(10)} | ` +
      `${result.avgResultCount.toFixed(1).padStart(10)}`
    );
  });
  
  console.log('\n' + '='.repeat(70));
  console.log('💡 推荐配置分析');
  console.log('='.repeat(70));
  
  // 寻找满足Precision >= 50%的最佳阈值
  const bestForPrecision = allResults
    .filter(r => r.avgPrecision >= 0.5)
    .sort((a, b) => b.avgRecall - a.avgRecall)[0];
  
  if (bestForPrecision) {
    console.log('\n🎯 满足Precision ≥ 50%的最佳配置:');
    console.log(`   minScore: ${bestForPrecision.threshold}`);
    console.log(`   Recall@10:    ${(bestForPrecision.avgRecall * 100).toFixed(2)}%`);
    console.log(`   Precision@10: ${(bestForPrecision.avgPrecision * 100).toFixed(2)}%`);
    console.log(`   MRR:          ${bestForPrecision.avgMRR.toFixed(4)}`);
  } else {
    console.log('\n⚠️  没有阈值满足Precision ≥ 50%的目标');
    console.log(`   最高Precision: ${(sortedByPrecision[0].avgPrecision * 100).toFixed(2)}% (minScore: ${sortedByPrecision[0].threshold})`);
  }
  
  // 寻找满足Recall >= 70%的最佳阈值
  const bestForRecall = allResults
    .filter(r => r.avgRecall >= 0.7)
    .sort((a, b) => b.avgPrecision - a.avgPrecision)[0];
  
  if (bestForRecall) {
    console.log('\n🎯 满足Recall ≥ 70%的最佳配置:');
    console.log(`   minScore: ${bestForRecall.threshold}`);
    console.log(`   Recall@10:    ${(bestForRecall.avgRecall * 100).toFixed(2)}%`);
    console.log(`   Precision@10: ${(bestForRecall.avgPrecision * 100).toFixed(2)}%`);
    console.log(`   MRR:          ${bestForRecall.avgMRR.toFixed(4)}`);
  } else {
    console.log('\n⚠️  没有阈值满足Recall ≥ 70%的目标');
    console.log(`   最高Recall: ${(sortedByRecall[0].avgRecall * 100).toFixed(2)}% (minScore: ${sortedByRecall[0].threshold})`);
  }
  
  // 寻找F1分数最高的配置
  const bestF1 = allResults
    .map(r => ({
      ...r,
      f1: r.avgRecall + r.avgPrecision > 0 
        ? 2 * r.avgRecall * r.avgPrecision / (r.avgRecall + r.avgPrecision)
        : 0
    }))
    .sort((a, b) => b.f1 - a.f1)[0];
  
  console.log('\n🏆 F1分数最高的配置（Recall和Precision平衡）:');
  console.log(`   minScore: ${bestF1.threshold}`);
  console.log(`   Recall@10:    ${(bestF1.avgRecall * 100).toFixed(2)}%`);
  console.log(`   Precision@10: ${(bestF1.avgPrecision * 100).toFixed(2)}%`);
  console.log(`   MRR:          ${bestF1.avgMRR.toFixed(4)}`);
  console.log(`   F1 Score:     ${bestF1.f1.toFixed(4)}`);
  
  console.log('\n' + '='.repeat(70));
  
  // 返回退出码
  if (bestF1.avgPrecision >= 0.5 && bestF1.avgRecall >= 0.7) {
    console.log('✅ 找到满足所有目标的配置！');
    process.exit(0);
  } else {
    console.log('⚠️  没有找到满足所有目标的配置，可能需要其他优化手段');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});