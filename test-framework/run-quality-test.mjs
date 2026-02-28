#!/usr/bin/env node
/**
 * 搜索质量测试 - 简化版
 * 验证BM25修复效果
 */

import RealEmbeddingTools from './real-embedding-tools.mjs';
import labeledDataset from './labeled-dataset.mjs';

async function main() {
  console.log('🎯 BM25中文分词修复验证测试');
  console.log('========================================\n');

  console.log('📋 测试配置:');
  console.log(`   文档数量: ${labeledDataset.documents.length}`);
  console.log(`   查询数量: ${labeledDataset.queries.length}\n`);

  // 初始化工具
  console.log('🔧 初始化Embedding工具...');
  const tools = new RealEmbeddingTools({
    endpoint: 'http://localhost:18000/v1/embeddings',
    model: 'Qwen3-Embedding-0.6B',
  });

  // 加载数据集
  console.log('📚 加载标注数据集...');
  const loadStart = Date.now();
  await tools.loadLabeledDataset(labeledDataset);
  const loadTime = Date.now() - loadStart;
  console.log(`   ✅ 已加载 ${tools.memoryData.length} 条文档，耗时 ${loadTime}ms\n`);

  // 运行所有查询
  console.log('🚀 开始运行查询...\n');
  
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < labeledDataset.queries.length; i++) {
    const query = labeledDataset.queries[i];
    
    // 根据查询模式选择搜索方法
    let searchResults;
    if (query.mode === 'keyword') {
      searchResults = await tools.memory_search({ query: query.query, limit: 10 });
    } else {
      searchResults = await tools.vector_memory_search({ query: query.query, mode: query.mode, limit: 10 });
    }

    // 计算Recall@10
    const foundIds = new Set(searchResults.map(r => r.id));
    const foundRelevant = query.relevant.filter(id => foundIds.has(id));
    const recall = query.relevant.length > 0 ? foundRelevant.length / query.relevant.length : 0;
    
    // 计算Precision@10
    const precision = searchResults.length > 0 ? foundRelevant.length / searchResults.length : 0;
    
    // 计算MRR
    let mrr = 0;
    for (let j = 0; j < searchResults.length; j++) {
      if (foundIds.has(query.relevant[0])) {
        const firstRelevantIndex = searchResults.findIndex(r => query.relevant.includes(r.id));
        if (firstRelevantIndex >= 0) {
          mrr = 1 / (firstRelevantIndex + 1);
        }
        break;
      }
    }

    results.push({
      query: query.query,
      mode: query.mode,
      recall,
      precision,
      mrr,
      found: foundRelevant.length,
      total: query.relevant.length
    });

    // 进度显示
    if ((i + 1) % 5 === 0 || i === labeledDataset.queries.length - 1) {
      const progress = ((i + 1) / labeledDataset.queries.length * 100).toFixed(1);
      const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
      console.log(`   进度: ${i + 1}/${labeledDataset.queries.length} (${progress}%) - Recall@10: ${(avgRecall * 100).toFixed(1)}%`);
    }
  }

  const totalTime = Date.now() - startTime;

  // 计算聚合指标
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;

  console.log('\n' + '='.repeat(40));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(40) + '\n');

  console.log('📈 聚合质量指标:');
  console.log(`   Recall@10:    ${(avgRecall * 100).toFixed(2)}%  (目标: ≥70%)  ${avgRecall >= 0.7 ? '✅' : '❌'}`);
  console.log(`   Precision@10: ${(avgPrecision * 100).toFixed(2)}%  (目标: ≥50%)  ${avgPrecision >= 0.5 ? '✅' : '❌'}`);
  console.log(`   MRR:          ${avgMRR.toFixed(4)}   (目标: ≥0.6)  ${avgMRR >= 0.6 ? '✅' : '❌'}`);

  console.log('\n⏱️  性能指标:');
  console.log(`   总耗时: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   平均延迟: ${(totalTime / results.length).toFixed(2)}ms/查询`);

  console.log('\n📊 按搜索模式统计:');
  const modeGroups = {};
  results.forEach(r => {
    if (!modeGroups[r.mode]) {
      modeGroups[r.mode] = { recall: 0, precision: 0, mrr: 0, count: 0 };
    }
    modeGroups[r.mode].recall += r.recall;
    modeGroups[r.mode].precision += r.precision;
    modeGroups[r.mode].mrr += r.mrr;
    modeGroups[r.mode].count++;
  });

  for (const [mode, stats] of Object.entries(modeGroups)) {
    console.log(`   ${mode.padEnd(12)}: Recall ${(stats.recall / stats.count * 100).toFixed(1)}%, Precision ${(stats.precision / stats.count * 100).toFixed(1)}%, MRR ${(stats.mrr / stats.count).toFixed(3)}, Queries: ${stats.count}`);
  }

  console.log('\n🏆 最佳查询 (Recall@10):');
  results.sort((a, b) => b.recall - a.recall);
  results.slice(0, 5).forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.query.padEnd(20)}: ${(r.recall * 100).toFixed(1)}% (${r.found}/${r.total})`);
  });

  console.log('\n⚠️  最差查询 (Recall@10):');
  results.slice(-5).reverse().forEach((r, i) => {
    console.log(`   ${i + 1}. ${r.query.padEnd(20)}: ${(r.recall * 100).toFixed(1)}% (${r.found}/${r.total})`);
  });

  console.log('\n' + '='.repeat(40));

  const passed = avgRecall >= 0.7 && avgPrecision >= 0.5 && avgMRR >= 0.6;

  if (passed) {
    console.log('✅ 搜索质量测试通过！');
  } else {
    console.log('❌ 搜索质量测试未通过。');
    console.log('   部分指标低于目标值，需要优化。');
  }

  console.log('\n' + '='.repeat(40));
  
  // 返回退出码
  process.exit(passed ? 0 : 1);
}

main().catch(error => {
  console.error('\n❌ 测试运行失败:', error);
  process.exit(1);
});