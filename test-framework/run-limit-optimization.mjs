#!/usr/bin/env node
/**
 * 返回结果数量优化测试
 * 测试不同的返回数量对Precision的影响
 */

import RealEmbeddingTools from './real-embedding-tools.mjs';
import labeledDataset from './labeled-dataset.mjs';

// 测试的返回数量配置
const limitConfigs = [
  { name: '当前配置', semantic: 10, keyword: 10, hybrid: 10 },
  { name: '优化配置', semantic: 10, keyword: 8, hybrid: 5 },
  { name: '激进配置', semantic: 10, keyword: 6, hybrid: 3 },
];

async function testLimitConfig(config, tools, queries) {
  const results = [];
  
  for (const query of queries) {
    let searchResults;
    const limit = config[query.mode] || 10;
    
    if (query.mode === 'keyword') {
      searchResults = await tools.memory_search({ query: query.query, limit });
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
      resultCount: searchResults.length,
    });
  }
  
  // 按模式分组统计
  const modeStats = {};
  for (const result of results) {
    if (!modeStats[result.mode]) {
      modeStats[result.mode] = { recall: 0, precision: 0, mrr: 0, count: 0 };
    }
    modeStats[result.mode].recall += result.recall;
    modeStats[result.mode].precision += result.precision;
    modeStats[result.mode].mrr += result.mrr;
    modeStats[result.mode].count++;
  }
  
  // 计算平均值
  for (const mode in modeStats) {
    modeStats[mode].recall /= modeStats[mode].count;
    modeStats[mode].precision /= modeStats[mode].count;
    modeStats[mode].mrr /= modeStats[mode].count;
  }
  
  // 计算总体指标
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;
  
  return {
    config: config.name,
    limits: config,
    avgRecall,
    avgPrecision,
    avgMRR,
    modeStats,
    results,
  };
}

async function main() {
  console.log('🎯 返回结果数量优化测试');
  console.log('========================================\n');
  
  const tools = new RealEmbeddingTools({
    endpoint: 'http://localhost:18000/v1/embeddings',
    model: 'Qwen3-Embedding-0.6B',
  });
  
  console.log('📚 加载数据集...');
  await tools.loadLabeledDataset(labeledDataset);
  
  const queries = labeledDataset.queries;
  console.log(`✅ 加载 ${queries.length} 个查询\n`);
  
  console.log('🚀 开始测试不同返回数量配置...\n');
  
  const allResults = [];
  
  for (const config of limitConfigs) {
    console.log(`📊 测试配置: ${config.name}`);
    console.log(`   Semantic: ${config.semantic}, Keyword: ${config.keyword}, Hybrid: ${config.hybrid}`);
    
    const result = await testLimitConfig(config, tools, queries);
    allResults.push(result);
    
    console.log(`   Recall@10:    ${(result.avgRecall * 100).toFixed(1)}%`);
    console.log(`   Precision@10: ${(result.avgPrecision * 100).toFixed(1)}%`);
    console.log(`   MRR:          ${result.avgMRR.toFixed(4)}\n`);
  }
  
  // 按Precision排序
  allResults.sort((a, b) => b.avgPrecision - a.avgPrecision);
  
  console.log('='.repeat(70));
  console.log('📊 测试结果汇总（按Precision排序）');
  console.log('='.repeat(70) + '\n');
  
  allResults.forEach((result, i) => {
    const isBest = i === 0;
    const prefix = isBest ? '🏆' : '  ';
    
    console.log(`${prefix} ${result.config.padEnd(15)} ${JSON.stringify(result.limits)}`);
    console.log(`   总体指标:`);
    console.log(`     Recall@10:    ${(result.avgRecall * 100).toFixed(2)}%`);
    console.log(`     Precision@10: ${(result.avgPrecision * 100).toFixed(2)}%`);
    console.log(`     MRR:          ${result.avgMRR.toFixed(4)}`);
    
    console.log(`   按模式:`);
    for (const [mode, stats] of Object.entries(result.modeStats)) {
      console.log(`     ${mode.padEnd(10)}: Recall ${(stats.recall * 100).toFixed(1)}%, Precision ${(stats.precision * 100).toFixed(1)}%, MRR ${stats.mrr.toFixed(3)}`);
    }
    console.log();
  });
  
  const best = allResults[0];
  console.log('='.repeat(70));
  console.log('💡 最佳配置');
  console.log('='.repeat(70));
  console.log(`\n${best.config}`);
  console.log(`\n配置参数:`);
  console.log(`  Semantic: ${best.limits.semantic}`);
  console.log(`  Keyword:  ${best.limits.keyword}`);
  console.log(`  Hybrid:    ${best.limits.hybrid}`);
  
  console.log(`\n总体指标:`);
  console.log(`  Recall@10:    ${(best.avgRecall * 100).toFixed(2)}% (目标: ≥70%)`);
  console.log(`  Precision@10: ${(best.avgPrecision * 100).toFixed(2)}% (目标: ≥50%)`);
  console.log(`  MRR:          ${best.avgMRR.toFixed(4)} (目标: ≥0.6)`);
  
  const allGoalsMet = best.avgRecall >= 0.7 && best.avgPrecision >= 0.5 && best.avgMRR >= 0.6;
  
  if (allGoalsMet) {
    console.log(`\n✅ 所有目标达成！`);
  } else {
    console.log(`\n⚠️  部分目标未达成:`);
    if (best.avgRecall < 0.7) {
      console.log(`   Recall@10: 需要从${(best.avgRecall * 100).toFixed(1)}%提升到70%`);
    }
    if (best.avgPrecision < 0.5) {
      console.log(`   Precision@10: 需要从${(best.avgPrecision * 100).toFixed(1)}%提升到50%`);
    }
    if (best.avgMrr < 0.6) {
      console.log(`   MRR: 需要从${best.avgMRR.toFixed(4)}提升到0.6`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
}

main().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});