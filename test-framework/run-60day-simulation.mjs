#!/usr/bin/env node

/**
 * 60天生产级测试主程序
 * 执行完整的测试套件并生成报告
 */

import TestEngine from './test-engine.mjs';
import { createIngestionTestSuite } from './suites/ingestion-test-suite.mjs';
import { createRetrievalTestSuite } from './suites/retrieval-test-suite.mjs';
import { createArchivingTestSuite } from './suites/archiving-test-suite.mjs';
import { createDataFlowTestSuite } from './suites/data-flow-test-suite.mjs';
import { create60DaySimulationSuite } from './suites/60day-simulation-suite.mjs';
import TestDataGenerator from './test-data-generator.mjs';
import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 主函数
 */
async function main() {
  console.log('🚀 OpenCode Memory Plugin 60天生产级测试\n');

  // 创建测试引擎
  const engine = new TestEngine({
    logger: {
      logFile: path.join(__dirname, '..', 'test-results', 'test.log'),
      verbose: true,
    },
    monitor: {
      verbose: true,
    },
    tools: new MockOpenCodeToolsV5({
      apiEndpoint: 'http://localhost:18000/v1/embeddings',
      model: 'Qwen3-Embedding-0.6B',
      maxBatchSize: 64,
    }), // 使用V5批量优化工具
  });

  try {
    // 初始化
    await engine.initialize();

    // 导出生成的测试数据
    const testData = TestDataGenerator.generate60DayData();
    const stats = TestDataGenerator.getDataStatistics(testData);
    console.log('\n📊 测试数据统计:');
    console.log(`   总天数: ${stats.totalDays}`);
    console.log(`   总记录数: ${stats.totalRecords}`);
    console.log(`   平均每天记录: ${stats.averageRecordsPerDay}`);
    console.log(`   类型分布:`, stats.typeDistribution);
    console.log('');

    // 创建所有测试套件
    const testSuites = [
      createIngestionTestSuite(),
      createRetrievalTestSuite(),
      createArchivingTestSuite(),
      createDataFlowTestSuite(),
      create60DaySimulationSuite(),
    ];

    console.log(`📦 共 ${testSuites.length} 个测试套件\n`);

    // 运行所有测试套件
    const suiteResults = [];
    for (let i = 0; i < testSuites.length; i++) {
      const suite = testSuites[i];
      await engine.logger.logMilestone(`开始执行: ${suite.name}`);
      const result = await engine.runTestSuite(suite);
      suiteResults.push(result);
    }

    // 汇总统计
    const totalTests = suiteResults.reduce((sum, r) => sum + r.total, 0);
    const totalPassed = suiteResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = suiteResults.reduce((sum, r) => sum + r.failed, 0);
    const totalDuration = suiteResults.reduce((sum, r) => sum + r.duration, 0);

    console.log('\n' + '='.repeat(60));
    console.log('📊 测试汇总');
    console.log('='.repeat(60));
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${totalPassed} ✅`);
    console.log(`失败: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`成功率: ${(totalPassed / totalTests * 100).toFixed(2)}%`);
    console.log(`总耗时: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('='.repeat(60));

    // 详细结果
    console.log('\n📦 各测试套件结果:');
    suiteResults.forEach((result, index) => {
      const status = result.failed === 0 ? '✅' : '❌';
      console.log(`   ${status} ${result.name}: ${result.passed}/${result.total} (${result.successRate}%)`);
    });

    // 生成测试报告
    console.log('\n📝 生成测试报告...');
    const reportFile = await engine.generateReport();
    console.log(`✅ 测试报告已生成: ${reportFile}`);

    // 导出日志和性能数据
    await engine.logger.exportLogs('test-logs.json');
    await engine.monitor.exportMetrics('performance-metrics.json');
    await engine.monitor.exportReport('performance-report.md');

    // 打印性能统计
    console.log('\n📊 性能统计:');
    engine.monitor.printStatistics();

    // 打印日志摘要
    engine.logger.printSummary();

    // 最终评估
    const successRate = totalPassed / totalTests * 100;
    console.log('\n' + '='.repeat(60));
    if (successRate >= 99.9) {
      console.log('🎉 生产就绪！系统已达到生产级标准。');
    } else if (successRate >= 99) {
      console.log('⚠️ 接近生产就绪，修复少量问题后可部署。');
    } else {
      console.log('❌ 未达到生产级标准，需要修复问题。');
    }
    console.log('='.repeat(60));

    // 退出码
    process.exit(totalFailed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    await engine.logger.logError('测试执行失败', error);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});
