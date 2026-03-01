#!/usr/bin/env node
/**
 * 语义搜索自动化测试执行脚本
 * 执行完整的记忆召回测试流程
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const CONFIG = {
  embeddingEndpoint: process.env.EMBEDDING_ENDPOINT || 'http://localhost:18000/v1/embeddings',
  model: process.env.MODEL || 'Qwen3-Embedding-0.6B',
  similarityThreshold: 0.70,
  maxRetries: 3,
  retryDelay: 1000,
  testDataDir: path.join(__dirname, '..', 'test-data'),
  outputDir: path.join(__dirname, '..', 'test-results')
};

// 确保输出目录存在
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// 日志工具
class Logger {
  constructor() {
    this.logs = [];
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    this.logs.push(logEntry);
    
    const colorCodes = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
      debug: '\x1b[90m'    // Gray
    };
    
    const reset = '\x1b[0m';
    const color = colorCodes[level] || '';
    
    console.log(`${color}[${level.toUpperCase()}]${reset} ${message}`);
    if (data && level === 'debug') {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  info(message, data) { this.log('info', message, data); }
  success(message, data) { this.log('success', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  error(message, data) { this.log('error', message, data); }
  debug(message, data) { this.log('debug', message, data); }

  saveToFile(filepath) {
    fs.writeFileSync(filepath, JSON.stringify(this.logs, null, 2));
  }
}

const logger = new Logger();

// 模拟OpenCode Memory Plugin工具
// 在实际使用中，这里应该调用真实的工具
class MockMemoryTools {
  constructor() {
    this.memories = new Map();
    this.index = new Map();
  }

  async memory_write({ content, type, tags }) {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const memory = {
      id,
      content,
      type,
      tags: tags.split(',').map(t => t.trim()),
      created_at: new Date().toISOString()
    };
    this.memories.set(id, memory);
    return { success: true, id, message: 'Memory written successfully' };
  }

  async vector_memory_search({ query, mode = 'hybrid', limit = 10, threshold = 0.3 }) {
    // 模拟语义搜索
    // 实际实现中这里应该调用embedding服务
    const results = [];
    
    for (const [id, memory] of this.memories) {
      // 简单的相似度计算（实际应该使用向量相似度）
      const similarity = this.calculateSimilarity(query, memory.content);
      
      if (similarity >= threshold) {
        results.push({
          id: memory.id,
          content: memory.content.substring(0, 200) + '...',
          similarity: similarity,
          source: memory.id,
          line: 1
        });
      }
    }
    
    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    return {
      success: true,
      query,
      mode,
      matches: results.slice(0, limit),
      count: results.length
    };
  }

  calculateSimilarity(query, content) {
    // 非常简化的相似度计算（仅用于模拟）
    // 实际应该使用向量嵌入
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentWords.some(cw => cw.includes(word) || word.includes(cw))) {
        matches++;
      }
    }
    
    return Math.min(matches / queryWords.length * 1.5, 0.95);
  }
}

// 测试执行引擎
class TestExecutionEngine {
  constructor() {
    this.tools = new MockMemoryTools();
    this.results = [];
    this.startTime = null;
  }

  async runTest(testDataPath, queriesPath) {
    logger.info('Starting memory retrieval test execution...');
    this.startTime = Date.now();

    try {
      // 1. 加载测试数据
      logger.info('Loading test data...');
      const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
      const queriesData = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));
      
      logger.success(`Loaded ${testData.memories.length} memories and ${queriesData.queries.length} queries`);

      // 2. 批量录入记忆
      logger.info('Step 1: Batch memory ingestion...');
      await this.ingestMemories(testData.memories);

      // 3. 重建索引（模拟）
      logger.info('Step 2: Rebuilding vector index...');
      await this.rebuildIndex();

      // 4. 执行查询测试
      logger.info('Step 3: Executing queries...');
      await this.executeQueries(queriesData.queries);

      // 5. 计算评估指标
      logger.info('Step 4: Calculating metrics...');
      const metrics = this.calculateMetrics();

      // 6. 生成报告
      logger.info('Step 5: Generating report...');
      await this.generateReport(metrics);

      const duration = Date.now() - this.startTime;
      logger.success(`Test execution completed in ${(duration / 1000).toFixed(2)}s`);

      return {
        success: true,
        metrics,
        results: this.results,
        duration
      };

    } catch (error) {
      logger.error('Test execution failed', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async ingestMemories(memories) {
    let successCount = 0;
    let failCount = 0;

    for (const memory of memories) {
      try {
        const result = await this.tools.memory_write({
          content: memory.content,
          type: memory.type,
          tags: memory.tags.join(',')
        });

        if (result.success) {
          successCount++;
          logger.debug(`Ingested memory: ${memory.id}`);
        } else {
          failCount++;
          logger.warn(`Failed to ingest memory: ${memory.id}`);
        }
      } catch (error) {
        failCount++;
        logger.error(`Error ingesting memory ${memory.id}: ${error.message}`);
      }
    }

    logger.success(`Memory ingestion: ${successCount} succeeded, ${failCount} failed`);
  }

  async rebuildIndex() {
    // 模拟索引重建
    logger.info('Indexing memories...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    logger.success('Index rebuilt successfully');
  }

  async executeQueries(queries) {
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      logger.info(`[${i + 1}/${queries.length}] Testing: ${query.query}`);

      try {
        const startTime = Date.now();
        const searchResult = await this.tools.vector_memory_search({
          query: query.query,
          mode: 'hybrid',
          limit: 5,
          threshold: 0.3
        });
        const duration = Date.now() - startTime;

        const analysis = this.analyzeResult(query, searchResult, duration);
        this.results.push(analysis);

        if (analysis.passed) {
          logger.success(`  ✓ PASS (F1: ${analysis.f1.toFixed(2)}, Sim: ${analysis.top_similarity.toFixed(2)})`);
        } else {
          logger.warn(`  ✗ FAIL (F1: ${analysis.f1.toFixed(2)}, Sim: ${analysis.top_similarity.toFixed(2)})`);
        }

      } catch (error) {
        logger.error(`  ✗ ERROR: ${error.message}`);
        this.results.push({
          query_id: query.id,
          error: error.message,
          passed: false
        });
      }
    }
  }

  analyzeResult(query, searchResult, duration) {
    const actualIds = searchResult.matches.map(m => m.id);
    const expectedIds = query.expected_memory_ids;
    
    // 计算TP, FP, FN
    const tp = actualIds.filter(id => expectedIds.includes(id)).length;
    const fp = actualIds.filter(id => !expectedIds.includes(id)).length;
    const fn = expectedIds.filter(id => !actualIds.includes(id)).length;
    
    // 计算指标
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    // 计算Top-K
    const top1 = expectedIds.includes(actualIds[0]);
    const top3 = expectedIds.some(id => actualIds.slice(0, 3).includes(id));
    const top5 = expectedIds.some(id => actualIds.slice(0, 5).includes(id));
    
    // 计算第一个相关结果的排名
    let firstRelevantRank = 0;
    for (let i = 0; i < actualIds.length; i++) {
      if (expectedIds.includes(actualIds[i])) {
        firstRelevantRank = i + 1;
        break;
      }
    }
    
    // 判断是否通过
    let passed = false;
    if (query.expected_result === 'should_recall') {
      // 正例测试：需要召回相关记忆
      passed = f1 >= 0.75 && top1;
    } else {
      // 负例测试：不应该召回相关记忆
      passed = tp === 0 && fp <= 1; // 允许最多1个误召回
    }
    
    return {
      query_id: query.id,
      query: query.query,
      expected_result: query.expected_result,
      expected_memory_ids: expectedIds,
      actual_results: searchResult.matches,
      metrics: {
        tp, fp, fn,
        precision,
        recall,
        f1,
        top1,
        top3,
        top5,
        first_relevant_rank: firstRelevantRank,
        mrr: firstRelevantRank > 0 ? 1 / firstRelevantRank : 0
      },
      top_similarity: searchResult.matches[0]?.similarity || 0,
      duration,
      passed,
      test_type: query.test_type,
      test_subtype: query.test_subtype
    };
  }

  calculateMetrics() {
    const results = this.results.filter(r => !r.error);
    
    // 分离正例和负例
    const positiveResults = results.filter(r => r.expected_result === 'should_recall');
    const negativeResults = results.filter(r => r.expected_result === 'should_not_recall');
    
    // 计算总体指标
    const totalTP = results.reduce((sum, r) => sum + r.metrics.tp, 0);
    const totalFP = results.reduce((sum, r) => sum + r.metrics.fp, 0);
    const totalFN = results.reduce((sum, r) => sum + r.metrics.fn, 0);
    const totalTN = negativeResults.reduce((sum, r) => {
      // TN = 正确不召回的记忆数
      return sum + (12 - r.metrics.fp - r.metrics.tp); // 12是总记忆数
    }, 0);
    
    const precision = totalTP / (totalTP + totalFP) || 0;
    const recall = totalTP / (totalTP + totalFN) || 0;
    const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const accuracy = (totalTP + totalTN) / (totalTP + totalFP + totalFN + totalTN) || 0;
    
    // 计算MRR
    const mrrSum = results.reduce((sum, r) => sum + r.metrics.mrr, 0);
    const mrr = mrrSum / results.length || 0;
    
    // 计算Top-K准确率
    const top1Accuracy = positiveResults.filter(r => r.metrics.top1).length / positiveResults.length || 0;
    const top3Accuracy = positiveResults.filter(r => r.metrics.top3).length / positiveResults.length || 0;
    const top5Accuracy = positiveResults.filter(r => r.metrics.top5).length / positiveResults.length || 0;
    
    // 按测试类型统计
    const byType = {};
    results.forEach(r => {
      if (!byType[r.test_type]) {
        byType[r.test_type] = { total: 0, passed: 0, failed: 0, f1_sum: 0 };
      }
      byType[r.test_type].total++;
      if (r.passed) {
        byType[r.test_type].passed++;
      } else {
        byType[r.test_type].failed++;
      }
      byType[r.test_type].f1_sum += r.metrics.f1;
    });
    
    // 计算每个类型的平均F1
    Object.keys(byType).forEach(type => {
      byType[type].avg_f1 = byType[type].f1_sum / byType[type].total;
      byType[type].pass_rate = byType[type].passed / byType[type].total;
    });
    
    return {
      summary: {
        total_tests: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        pass_rate: results.filter(r => r.passed).length / results.length,
        total_duration: results.reduce((sum, r) => sum + r.duration, 0),
        avg_duration: results.reduce((sum, r) => sum + r.duration, 0) / results.length
      },
      overall_metrics: {
        precision,
        recall,
        f1,
        accuracy,
        mrr
      },
      ranking_metrics: {
        top1_accuracy: top1Accuracy,
        top3_accuracy: top3Accuracy,
        top5_accuracy: top5Accuracy
      },
      by_test_type: byType,
      by_result_type: {
        positive: {
          count: positiveResults.length,
          passed: positiveResults.filter(r => r.passed).length,
          avg_f1: positiveResults.reduce((sum, r) => sum + r.metrics.f1, 0) / positiveResults.length || 0
        },
        negative: {
          count: negativeResults.length,
          passed: negativeResults.filter(r => r.passed).length,
          avg_f1: negativeResults.reduce((sum, r) => sum + r.metrics.f1, 0) / negativeResults.length || 0
        }
      },
      confusion_matrix: {
        tp: totalTP,
        fp: totalFP,
        fn: totalFN,
        tn: totalTN
      },
      detailed_results: results
    };
  }

  async generateReport(metrics) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 生成JSON报告
    const jsonPath = path.join(CONFIG.outputDir, `test-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2));
    logger.success(`JSON report saved: ${jsonPath}`);

    // 生成Markdown报告
    const markdown = this.generateMarkdownReport(metrics);
    const mdPath = path.join(CONFIG.outputDir, `test-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, markdown);
    logger.success(`Markdown report saved: ${mdPath}`);

    // 生成控制台摘要
    this.printConsoleSummary(metrics);

    return { jsonPath, mdPath };
  }

  generateMarkdownReport(metrics) {
    const { summary, overall_metrics, ranking_metrics, by_test_type, confusion_matrix } = metrics;
    
    return `# 记忆召回测试报告

## 执行摘要

- **测试时间**: ${new Date().toISOString()}
- **总测试数**: ${summary.total_tests}
- **通过数**: ${summary.passed} ✅
- **失败数**: ${summary.failed} ❌
- **通过率**: ${(summary.pass_rate * 100).toFixed(2)}%
- **总耗时**: ${(summary.total_duration / 1000).toFixed(2)}s
- **平均耗时**: ${summary.avg_duration.toFixed(2)}ms

## 整体指标

| 指标 | 值 | 目标 | 状态 |
|------|------|------|------|
| 精确率 (Precision) | ${(overall_metrics.precision * 100).toFixed(2)}% | > 85% | ${overall_metrics.precision >= 0.85 ? '✅' : '❌'} |
| 召回率 (Recall) | ${(overall_metrics.recall * 100).toFixed(2)}% | > 80% | ${overall_metrics.recall >= 0.80 ? '✅' : '❌'} |
| F1分数 | ${overall_metrics.f1.toFixed(4)} | > 0.82 | ${overall_metrics.f1 >= 0.82 ? '✅' : '❌'} |
| 准确率 (Accuracy) | ${(overall_metrics.accuracy * 100).toFixed(2)}% | > 75% | ${overall_metrics.accuracy >= 0.75 ? '✅' : '❌'} |
| MRR | ${overall_metrics.mrr.toFixed(4)} | > 0.70 | ${overall_metrics.mrr >= 0.70 ? '✅' : '❌'} |

## 排名质量指标

| 指标 | 值 | 目标 | 状态 |
|------|------|------|------|
| Top-1准确率 | ${(ranking_metrics.top1_accuracy * 100).toFixed(2)}% | > 70% | ${ranking_metrics.top1_accuracy >= 0.70 ? '✅' : '❌'} |
| Top-3准确率 | ${(ranking_metrics.top3_accuracy * 100).toFixed(2)}% | > 85% | ${ranking_metrics.top3_accuracy >= 0.85 ? '✅' : '❌'} |
| Top-5准确率 | ${(ranking_metrics.top5_accuracy * 100).toFixed(2)}% | > 90% | ${ranking_metrics.top5_accuracy >= 0.90 ? '✅' : '❌'} |

## 混淆矩阵

| 实际\\预测 | 预测为正 | 预测为负 | 总计 |
|-----------|---------|---------|------|
| 实际为正 | ${confusion_matrix.tp} (TP) | ${confusion_matrix.fn} (FN) | ${confusion_matrix.tp + confusion_matrix.fn} |
| 实际为负 | ${confusion_matrix.fp} (FP) | ${confusion_matrix.tn} (TN) | ${confusion_matrix.fp + confusion_matrix.tn} |
| 总计 | ${confusion_matrix.tp + confusion_matrix.fp} | ${confusion_matrix.fn + confusion_matrix.tn} | ${confusion_matrix.tp + confusion_matrix.fp + confusion_matrix.fn + confusion_matrix.tn} |

## 按测试类型统计

${Object.entries(by_test_type).map(([type, stats]) => `
### ${type}

- 总数: ${stats.total}
- 通过: ${stats.passed} (${(stats.pass_rate * 100).toFixed(2)}%)
- 失败: ${stats.failed}
- 平均F1: ${stats.avg_f1.toFixed(4)}
`).join('\n')}

## 详细结果

${metrics.detailed_results.map((result, index) => `
### ${index + 1}. ${result.query_id}

**查询**: ${result.query}

**期望**: ${result.expected_result === 'should_recall' ? '应该召回' : '不应该召回'}

**状态**: ${result.passed ? '✅ 通过' : '❌ 失败'}

**指标**:
- 精确率: ${(result.metrics.precision * 100).toFixed(2)}%
- 召回率: ${(result.metrics.recall * 100).toFixed(2)}%
- F1: ${result.metrics.f1.toFixed(4)}
- Top-1: ${result.metrics.top1 ? '✓' : '✗'}
- Top-3: ${result.metrics.top3 ? '✓' : '✗'}
- 相似度: ${result.top_similarity.toFixed(4)}
- 耗时: ${result.duration}ms

**召回的记忆**:
${result.actual_results.map((match, i) => `- ${i + 1}. ${match.id} (相似度: ${match.similarity.toFixed(4)})`).join('\n')}
`).join('\n---\n')}

---

*报告生成时间: ${new Date().toISOString()}*
`;
  }

  printConsoleSummary(metrics) {
    const { summary, overall_metrics, ranking_metrics } = metrics;
    
    console.log('\n' + '='.repeat(80));
    console.log('                    记忆召回测试执行完成');
    console.log('='.repeat(80));
    console.log('');
    console.log(`  总测试数: ${summary.total_tests}`);
    console.log(`  通过: ${summary.passed} ✅ (${(summary.pass_rate * 100).toFixed(2)}%)`);
    console.log(`  失败: ${summary.failed} ❌`);
    console.log(`  总耗时: ${(summary.total_duration / 1000).toFixed(2)}s`);
    console.log('');
    console.log('  关键指标:');
    console.log(`    精确率: ${(overall_metrics.precision * 100).toFixed(2)}% ${overall_metrics.precision >= 0.85 ? '✅' : '❌'}`);
    console.log(`    召回率: ${(overall_metrics.recall * 100).toFixed(2)}% ${overall_metrics.recall >= 0.80 ? '✅' : '❌'}`);
    console.log(`    F1分数: ${overall_metrics.f1.toFixed(4)} ${overall_metrics.f1 >= 0.82 ? '✅' : '❌'}`);
    console.log(`    Top-1:  ${(ranking_metrics.top1_accuracy * 100).toFixed(2)}% ${ranking_metrics.top1_accuracy >= 0.70 ? '✅' : '❌'}`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node run-semantic-test.mjs [options]

Options:
  --data <path>        Path to test memory data JSON (default: ../test-data/retrieval-memories.json)
  --queries <path>     Path to test queries JSON (default: ../test-data/retrieval-queries.json)
  --output <path>      Output directory (default: ../test-results)
  --threshold <n>      Similarity threshold (default: 0.70)
  --help, -h           Show this help

Environment Variables:
  EMBEDDING_ENDPOINT   URL of embedding service (default: http://localhost:18000/v1/embeddings)
  MODEL                Model name (default: Qwen3-Embedding-0.6B)
    `);
    process.exit(0);
  }

  // 解析参数
  const dataIndex = args.indexOf('--data');
  const queriesIndex = args.indexOf('--queries');
  const outputIndex = args.indexOf('--output');
  const thresholdIndex = args.indexOf('--threshold');

  const testDataPath = dataIndex !== -1 ? args[dataIndex + 1] : path.join(CONFIG.testDataDir, 'retrieval-memories.json');
  const queriesPath = queriesIndex !== -1 ? args[queriesIndex + 1] : path.join(CONFIG.testDataDir, 'retrieval-queries.json');
  const outputDir = outputIndex !== -1 ? args[outputIndex + 1] : CONFIG.outputDir;
  
  if (thresholdIndex !== -1) {
    CONFIG.similarityThreshold = parseFloat(args[thresholdIndex + 1]);
  }

  // 更新配置
  CONFIG.outputDir = outputDir;
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // 验证文件存在
  if (!fs.existsSync(testDataPath)) {
    logger.error(`Test data file not found: ${testDataPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(queriesPath)) {
    logger.error(`Queries file not found: ${queriesPath}`);
    process.exit(1);
  }

  // 执行测试
  try {
    const engine = new TestExecutionEngine();
    const result = await engine.runTest(testDataPath, queriesPath);
    
    // 保存日志
    const logPath = path.join(CONFIG.outputDir, `test-execution-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
    logger.saveToFile(logPath);
    
    // 退出码
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    logger.error('Test execution failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
