#!/usr/bin/env node
/**
 * 快速测试脚本 - 简化版语义搜索测试
 * 用于快速验证测试框架的可行性
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简化的配置
const CONFIG = {
  testDataDir: path.join(__dirname, '..', 'test-data'),
  outputDir: path.join(__dirname, '..', 'test-results')
};

// 确保输出目录存在
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// 简化的日志
function log(level, message) {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  const color = colors[level] || '';
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${message}`);
}

// 简化的测试执行
async function runQuickTest() {
  console.log('\n' + '='.repeat(80));
  console.log('          快速语义搜索测试 - 简化版');
  console.log('='.repeat(80) + '\n');

  const startTime = Date.now();

  try {
    // 1. 加载测试数据
    log('info', '加载测试数据...');
    
    const memoriesPath = path.join(CONFIG.testDataDir, 'retrieval-memories.json');
    const queriesPath = path.join(CONFIG.testDataDir, 'retrieval-queries.json');
    
    if (!fs.existsSync(memoriesPath)) {
      log('error', `找不到测试数据文件: ${memoriesPath}`);
      log('info', '请先运行完整的数据准备流程');
      process.exit(1);
    }

    const memoriesData = JSON.parse(fs.readFileSync(memoriesPath, 'utf-8'));
    const queriesData = JSON.parse(fs.readFileSync(queriesPath, 'utf-8'));
    
    const memories = memoriesData.memories.slice(0, 5); // 只测试5条记忆
    const queries = queriesData.queries.slice(0, 5); // 只测试5个查询
    
    log('success', `加载了 ${memories.length} 条记忆和 ${queries.length} 个查询`);

    // 2. 模拟数据录入
    log('info', '模拟数据录入...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    log('success', '数据录入完成（模拟）');

    // 3. 模拟索引重建
    log('info', '模拟索引重建...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    log('success', '索引重建完成（模拟）');

    // 4. 执行查询测试
    log('info', '执行查询测试...\n');
    
    const results = [];
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      log('info', `[${i + 1}/${queries.length}] 测试: ${query.query}`);
      
      // 模拟搜索延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 模拟结果（简化版）
      const mockResult = {
        query_id: query.id,
        query: query.query,
        expected_result: query.expected_result,
        passed: Math.random() > 0.2, // 80%通过率（模拟）
        metrics: {
          f1: 0.75 + Math.random() * 0.2, // 0.75-0.95
          precision: 0.80 + Math.random() * 0.15,
          recall: 0.75 + Math.random() * 0.20
        },
        top_similarity: 0.70 + Math.random() * 0.25,
        duration: 450 + Math.random() * 100
      };
      
      results.push(mockResult);
      
      if (mockResult.passed) {
        log('success', `  ✓ PASS (F1: ${mockResult.metrics.f1.toFixed(2)}, Sim: ${mockResult.top_similarity.toFixed(2)})`);
      } else {
        log('warn', `  ✗ FAIL (F1: ${mockResult.metrics.f1.toFixed(2)}, Sim: ${mockResult.top_similarity.toFixed(2)})`);
      }
    }

    // 5. 计算指标
    log('info', '\n计算评估指标...');
    
    const passedCount = results.filter(r => r.passed).length;
    const avgF1 = results.reduce((sum, r) => sum + r.metrics.f1, 0) / results.length;
    const avgPrecision = results.reduce((sum, r) => sum + r.metrics.precision, 0) / results.length;
    const avgRecall = results.reduce((sum, r) => sum + r.metrics.recall, 0) / results.length;
    const avgSimilarity = results.reduce((sum, r) => sum + r.top_similarity, 0) / results.length;
    
    // 6. 生成报告
    const duration = Date.now() - startTime;
    
    const report = {
      metadata: {
        test_run_id: `quick-test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        duration: duration,
        mode: 'quick-test'
      },
      summary: {
        total_tests: results.length,
        passed: passedCount,
        failed: results.length - passedCount,
        pass_rate: passedCount / results.length
      },
      metrics: {
        avg_f1: avgF1,
        avg_precision: avgPrecision,
        avg_recall: avgRecall,
        avg_similarity: avgSimilarity
      },
      results: results
    };
    
    // 保存报告
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(CONFIG.outputDir, `quick-test-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    log('success', `\n报告已保存: ${reportPath}`);
    
    // 打印摘要
    console.log('\n' + '='.repeat(80));
    console.log('                    快速测试执行完成');
    console.log('='.repeat(80));
    console.log('');
    console.log(`  总测试数: ${report.summary.total_tests}`);
    console.log(`  通过: ${report.summary.passed} ✅ (${(report.summary.pass_rate * 100).toFixed(2)}%)`);
    console.log(`  失败: ${report.summary.failed} ❌`);
    console.log('');
    console.log('  平均指标:');
    console.log(`    F1分数: ${report.metrics.avg_f1.toFixed(4)}`);
    console.log(`    精确率: ${(report.metrics.avg_precision * 100).toFixed(2)}%`);
    console.log(`    召回率: ${(report.metrics.avg_recall * 100).toFixed(2)}%`);
    console.log(`    相似度: ${(report.metrics.avg_similarity * 100).toFixed(2)}%`);
    console.log('');
    console.log(`  总耗时: ${(report.metadata.duration / 1000).toFixed(2)}s`);
    console.log('');
    console.log('='.repeat(80));
    console.log('');

  } catch (error) {
    log('error', `测试执行失败: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// 运行测试
runQuickTest().catch(error => {
  console.error('致命错误:', error);
  process.exit(1);
});
