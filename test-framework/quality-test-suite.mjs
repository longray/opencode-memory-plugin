/**
 * 搜索质量测试套件
 * 测试召回率、精确率、MRR等搜索质量指标
 * 
 * 使用真实embedding服务 (localhost:18000)
 */

import labeledDataset from './labeled-dataset.mjs';

/**
 * 计算召回率@K
 * Recall@K = TopK中命中的相关文档数 / 总相关文档数
 */
export function calculateRecallAtK(results, expectedIds, k = 10) {
  if (!expectedIds || expectedIds.length === 0) {
    // 无期望结果，检查返回是否为空
    return results.length === 0 ? 1.0 : 0.0;
  }
  
  const topKIds = results.slice(0, k).map(r => r.id);
  const hits = topKIds.filter(id => expectedIds.includes(id));
  return hits.length / expectedIds.length;
}

/**
 * 计算精确率@K
 * Precision@K = TopK中命中的相关文档数 / K
 */
export function calculatePrecisionAtK(results, expectedIds, k = 10) {
  if (!expectedIds || expectedIds.length === 0) {
    return results.length === 0 ? 1.0 : 0.0;
  }
  
  const topKIds = results.slice(0, k).map(r => r.id);
  const hits = topKIds.filter(id => expectedIds.includes(id));
  return hits.length / Math.min(k, results.length);
}

/**
 * 计算平均倒数排名 (MRR)
 * MRR = 1/|Q| * Σ(1/rank_i)
 * rank_i 是第一个相关文档的排名
 */
export function calculateMRR(results, expectedIds) {
  if (!expectedIds || expectedIds.length === 0) {
    return 0.0;
  }
  
  for (let i = 0; i < results.length; i++) {
    if (expectedIds.includes(results[i].id)) {
      return 1 / (i + 1);
    }
  }
  return 0.0;
}

/**
 * 计算NDCG@K (Normalized Discounted Cumulative Gain)
 * 衡量排序质量
 */
export function calculateNDCGAtK(results, expectedIds, k = 10) {
  if (!expectedIds || expectedIds.length === 0) {
    return results.length === 0 ? 1.0 : 0.0;
  }
  
  // DCG@K
  let dcg = 0;
  for (let i = 0; i < Math.min(k, results.length); i++) {
    const relevance = expectedIds.includes(results[i].id) ? 1 : 0;
    dcg += relevance / Math.log2(i + 2); // i+2 because log2(1) = 0
  }
  
  // IDCG@K (ideal DCG)
  let idcg = 0;
  for (let i = 0; i < Math.min(k, expectedIds.length); i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  
  return idcg > 0 ? dcg / idcg : 0.0;
}

/**
 * 计算F1@K
 * F1 = 2 * (Precision * Recall) / (Precision + Recall)
 */
export function calculateF1AtK(results, expectedIds, k = 10) {
  const precision = calculatePrecisionAtK(results, expectedIds, k);
  const recall = calculateRecallAtK(results, expectedIds, k);
  
  if (precision + recall === 0) {
    return 0.0;
  }
  
  return 2 * (precision * recall) / (precision + recall);
}

/**
 * 创建搜索质量测试套件
 */
export function createQualityTestSuite() {
  const testCases = [];
  const { documents, queries, qualityTargets } = labeledDataset;
  
  // 为每个查询创建测试用例
  for (const queryData of queries) {
    testCases.push({
      name: `QC-${queryData.id}: ${queryData.query}`,
      category: '搜索质量',
      subcategory: queryData.mode,
      query: queryData.query,
      expectedIds: queryData.relevant,
      mode: queryData.mode,
      execute: async (engine) => {
        const startTime = Date.now();
        
        // 使用 vector_memory_search 进行搜索
        const results = await engine.options.tools.vector_memory_search({
          query: queryData.query,
          mode: queryData.mode,
          limit: 10,
        });
        
        const latency = Date.now() - startTime;
        
        // 计算质量指标
        const recall = calculateRecallAtK(results, queryData.relevant, 10);
        const precision = calculatePrecisionAtK(results, queryData.relevant, 10);
        const mrr = calculateMRR(results, queryData.relevant);
        const ndcg = calculateNDCGAtK(results, queryData.relevant, 10);
        const f1 = calculateF1AtK(results, queryData.relevant, 10);
        
        // 判断是否通过（基于目标）
        const passed = recall >= qualityTargets.recallAt10;
        
        return {
          results,
          metrics: {
            recall: recall.toFixed(4),
            precision: precision.toFixed(4),
            mrr: mrr.toFixed(4),
            ndcg: ndcg.toFixed(4),
            f1: f1.toFixed(4),
          },
          latency,
          passed,
          target: `Recall@10 ≥ ${(qualityTargets.recallAt10 * 100).toFixed(0)}%`,
          description: queryData.description,
        };
      },
    });
  }
  
  // 添加聚合测试用例
  testCases.push({
    name: 'QC-AGG: 聚合质量指标',
    category: '搜索质量',
    subcategory: 'aggregate',
    execute: async (engine) => {
      // 收集所有查询的结果
      const allMetrics = [];
      
      for (const queryData of queries) {
        const results = await engine.options.tools.vector_memory_search({
          query: queryData.query,
          mode: queryData.mode,
          limit: 10,
        });
        
        allMetrics.push({
          queryId: queryData.id,
          recall: calculateRecallAtK(results, queryData.relevant, 10),
          precision: calculatePrecisionAtK(results, queryData.relevant, 10),
          mrr: calculateMRR(results, queryData.relevant),
          ndcg: calculateNDCGAtK(results, queryData.relevant, 10),
          f1: calculateF1AtK(results, queryData.relevant, 10),
        });
      }
      
      // 计算平均值
      const avgRecall = allMetrics.reduce((sum, m) => sum + m.recall, 0) / allMetrics.length;
      const avgPrecision = allMetrics.reduce((sum, m) => sum + m.precision, 0) / allMetrics.length;
      const avgMRR = allMetrics.reduce((sum, m) => sum + m.mrr, 0) / allMetrics.length;
      const avgNDCG = allMetrics.reduce((sum, m) => sum + m.ndcg, 0) / allMetrics.length;
      const avgF1 = allMetrics.reduce((sum, m) => sum + m.f1, 0) / allMetrics.length;
      
      // 按模式分组统计
      const byMode = {};
      for (const queryData of queries) {
        if (!byMode[queryData.mode]) {
          byMode[queryData.mode] = { recalls: [], precisions: [], mrrs: [] };
        }
        const metric = allMetrics.find(m => m.queryId === queryData.id);
        if (metric) {
          byMode[queryData.mode].recalls.push(metric.recall);
          byMode[queryData.mode].precisions.push(metric.precision);
          byMode[queryData.mode].mrrs.push(metric.mrr);
        }
      }
      
      const modeStats = {};
      for (const [mode, data] of Object.entries(byMode)) {
        modeStats[mode] = {
          avgRecall: (data.recalls.reduce((a, b) => a + b, 0) / data.recalls.length).toFixed(4),
          avgPrecision: (data.precisions.reduce((a, b) => a + b, 0) / data.precisions.length).toFixed(4),
          avgMRR: (data.mrrs.reduce((a, b) => a + b, 0) / data.mrrs.length).toFixed(4),
          count: data.recalls.length,
        };
      }
      
      const passed = avgRecall >= qualityTargets.recallAt10 && 
                     avgPrecision >= qualityTargets.precisionAt10 &&
                     avgMRR >= qualityTargets.mrr;
      
      return {
        aggregateMetrics: {
          avgRecall: avgRecall.toFixed(4),
          avgPrecision: avgPrecision.toFixed(4),
          avgMRR: avgMRR.toFixed(4),
          avgNDCG: avgNDCG.toFixed(4),
          avgF1: avgF1.toFixed(4),
        },
        modeStats,
        targets: {
          recallAt10: qualityTargets.recallAt10,
          precisionAt10: qualityTargets.precisionAt10,
          mrr: qualityTargets.mrr,
        },
        passed,
        totalQueries: queries.length,
      };
    },
  });
  
  return {
    name: '搜索质量测试套件',
    description: '测试搜索质量指标：召回率、精确率、MRR、NDCG等',
    requiresRealEmbedding: true,
    testCases,
  };
}

/**
 * 生成质量报告
 */
export function generateQualityReport(results) {
  const qualityResults = results.filter(r => r.testCase.category === '搜索质量');
  const aggregateResult = qualityResults.find(r => r.testCase.subcategory === 'aggregate');
  
  let report = `# 搜索质量测试报告\n\n`;
  report += `**生成时间**: ${new Date().toISOString()}\n\n`;
  
  if (aggregateResult && aggregateResult.result.aggregateMetrics) {
    const metrics = aggregateResult.result.aggregateMetrics;
    const targets = aggregateResult.result.targets;
    
    report += `## 📊 聚合指标\n\n`;
    report += `| 指标 | 实际值 | 目标值 | 状态 |\n`;
    report += `|------|--------|--------|------|\n`;
    report += `| Recall@10 | ${(metrics.avgRecall * 100).toFixed(2)}% | ≥${(targets.recallAt10 * 100).toFixed(0)}% | ${parseFloat(metrics.avgRecall) >= targets.recallAt10 ? '✅' : '❌'} |\n`;
    report += `| Precision@10 | ${(metrics.avgPrecision * 100).toFixed(2)}% | ≥${(targets.precisionAt10 * 100).toFixed(0)}% | ${parseFloat(metrics.avgPrecision) >= targets.precisionAt10 ? '✅' : '❌'} |\n`;
    report += `| MRR | ${metrics.avgMRR} | ≥${targets.mrr} | ${parseFloat(metrics.avgMRR) >= targets.mrr ? '✅' : '❌'} |\n`;
    report += `| NDCG@10 | ${metrics.avgNDCG} | - | - |\n`;
    report += `| F1@10 | ${metrics.avgF1} | - | - |\n\n`;
    
    // 按模式统计
    if (aggregateResult.result.modeStats) {
      report += `## 📈 按搜索模式统计\n\n`;
      report += `| 模式 | Recall@10 | Precision@10 | MRR | 查询数 |\n`;
      report += `|------|-----------|--------------|-----|--------|\n`;
      
      for (const [mode, stats] of Object.entries(aggregateResult.result.modeStats)) {
        report += `| ${mode} | ${(stats.avgRecall * 100).toFixed(2)}% | ${(stats.avgPrecision * 100).toFixed(2)}% | ${stats.avgMRR} | ${stats.count} |\n`;
      }
      report += `\n`;
    }
  }
  
  // 详细结果（按指标排序）
  const detailResults = qualityResults.filter(r => r.testCase.subcategory !== 'aggregate');
  const sortedByRecall = [...detailResults].sort((a, b) => 
    parseFloat(b.result.metrics?.recall || 0) - parseFloat(a.result.metrics?.recall || 0)
  );
  
  report += `## 📋 详细结果（按召回率排序）\n\n`;
  report += `| 查询 | 模式 | Recall@10 | Precision@10 | MRR | 状态 |\n`;
  report += `|------|------|-----------|--------------|-----|------|\n`;
  
  for (const result of sortedByRecall.slice(0, 20)) { // 只显示前20条
    const metrics = result.result.metrics || {};
    const passed = result.result.passed;
    report += `| ${result.testCase.query} | ${result.testCase.mode} | ${(parseFloat(metrics.recall || 0) * 100).toFixed(1)}% | ${(parseFloat(metrics.precision || 0) * 100).toFixed(1)}% | ${metrics.mrr || '0'} | ${passed ? '✅' : '❌'} |\n`;
  }
  
  // 问题分析
  const failedQueries = detailResults.filter(r => !r.result.passed);
  if (failedQueries.length > 0) {
    report += `\n## ⚠️ 未达标查询分析\n\n`;
    
    for (const result of failedQueries.slice(0, 10)) {
      report += `### ${result.testCase.query}\n`;
      report += `- **模式**: ${result.testCase.mode}\n`;
      report += `- **召回率**: ${(parseFloat(result.result.metrics?.recall || 0) * 100).toFixed(2)}%\n`;
      report += `- **期望相关文档**: ${result.testCase.expectedIds.join(', ')}\n`;
      report += `- **实际返回**: ${result.result.results?.slice(0, 5).map(r => r.id).join(', ') || '无'}\n\n`;
    }
  }
  
  // 结论
  report += `\n## 🎯 结论\n\n`;
  
  if (aggregateResult?.result?.passed) {
    report += `✅ **搜索质量达标** - 所有指标均达到目标值。\n\n`;
    report += `系统搜索能力良好，可以投入生产使用。\n`;
  } else {
    report += `❌ **搜索质量未达标** - 部分指标低于目标值。\n\n`;
    report += `**建议**:\n`;
    report += `1. 检查embedding模型是否合适\n`;
    report += `2. 考虑调整搜索模式权重\n`;
    report += `3. 增加更多训练数据\n`;
  }
  
  return report;
}

export default {
  createQualityTestSuite,
  generateQualityReport,
  calculateRecallAtK,
  calculatePrecisionAtK,
  calculateMRR,
  calculateNDCGAtK,
  calculateF1AtK,
};