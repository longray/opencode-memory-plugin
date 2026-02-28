#!/usr/bin/env node
/**
 * 本地服务批量预生成优化测试
 * 
 * 核心优化策略：
 * 1. 在测试开始前，收集所有测试数据
 * 2. 一次性批量预生成所有 embedding（使用 generateBatchEmbeddings）
 * 3. 测试时直接从缓存读取，无需再调用 API
 * 
 * 预期性能提升：40-60x
 */

import TestEngine from './test-engine.mjs';
import { createIngestionTestSuite } from './suites/ingestion-test-suite.mjs';
import { createRetrievalTestSuite } from './suites/retrieval-test-suite.mjs';
import { createArchivingTestSuite } from './suites/archiving-test-suite.mjs';
import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 从测试套件中提取所有测试数据
 */
function extractAllTestData(testSuites) {
  const testData = [];
  
  for (const suite of testSuites) {
    for (const testCase of suite.testCases) {
      // 根据测试用例名称和内容推断需要写入的数据
      const extracted = extractDataFromTestCase(testCase);
      testData.push(...extracted);
    }
  }
  
  // 去重
  const uniqueData = [...new Map(testData.map(item => [item.content, item])).values()];
  
  return uniqueData;
}

/**
 * 从单个测试用例中提取数据
 * 这是一个启发式方法，根据测试用例的类型和名称推断
 */
function extractDataFromTestCase(testCase) {
  const data = [];
  const name = testCase.name || '';
  
  // 根据测试用例名称模式推断数据
  if (name.includes('短内容') || name.includes('short')) {
    data.push({
      content: '这是一个短内容的测试数据，用于测试短文本的存储和检索功能。',
      type: 'test',
      tags: ['test', 'short']
    });
  }
  
  if (name.includes('中日韩') || name.includes('cjk')) {
    data.push({
      content: '这是一个包含中日韩字符的测试内容：こんにちは、안녕하세요、你好世界',
      type: 'test',
      tags: ['test', 'cjk']
    });
  }
  
  if (name.includes('代码') || name.includes('code')) {
    data.push({
      content: 'function test() { console.log("Hello World"); return true; }',
      type: 'test',
      tags: ['test', 'code']
    });
  }
  
  if (name.includes('Emoji') || name.includes('emoji')) {
    data.push({
      content: '这是一个包含Emoji的测试内容 🎉🚀💻✨🔥',
      type: 'test',
      tags: ['test', 'emoji']
    });
  }
  
  // 默认测试数据
  if (data.length === 0) {
    data.push({
      content: `Test data for ${name}`,
      type: 'test',
      tags: ['test']
    });
  }
  
  return data;
}

/**
 * 主函数：运行批量预生成优化测试
 */
async function runBatchOptimizedTest() {
  console.log('🚀 本地服务批量预生成优化测试\n');
  console.log('   优化策略: 预先批量生成所有 embedding，测试时直接使用缓存');
  console.log('   嵌入服务: http://localhost:18000/v1/embeddings');
  console.log('   批量大小: 64条/请求（最优配置）\n');

  // 创建 V5 版本的工具类（支持批量预生成）
  const tools = new MockOpenCodeToolsV5({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
    maxBatchSize: 64,  // 使用最优批量大小
  });

  // 创建测试引擎
  const engine = new TestEngine({
    logger: {
      logFile: path.join(__dirname, '..', 'test-results', 'test-batch-optimized.log'),
      verbose: true,
    },
    monitor: {
      verbose: true,
    },
    tools: tools,
  });

  try {
    // 初始化
    await engine.initialize();

    // 创建测试套件
    const testSuites = [
      createIngestionTestSuite(),
      createRetrievalTestSuite(),
      createArchivingTestSuite(),
    ];

    console.log(`📦 共 ${testSuites.length} 个测试套件\n`);

    // === 关键优化：预生成所有 embedding ===
    console.log('🔧 第一阶段：收集并预生成所有测试数据的 embeddings...\n');
    
    const allTestData = extractAllTestData(testSuites);
    console.log(`📊 提取到 ${allTestData.length} 条唯一测试数据\n`);
    
    // 使用 V5 的批量预生成功能
    const preGenStartTime = Date.now();
    await tools.preGenerateEmbeddings(allTestData.map(d => d.content));
    const preGenDuration = Date.now() - preGenStartTime;
    
    console.log(`\n✅ 预生成完成！耗时: ${preGenDuration}ms\n`);

    // === 运行测试（此时 embedding 已全部在缓存中）===
    console.log('🧪 第二阶段：运行测试（使用预生成缓存）...\n');
    
    const testStartTime = Date.now();
    const suiteResults = [];
    
    for (let i = 0; i < testSuites.length; i++) {
      const suite = testSuites[i];
      await engine.logger.logMilestone(`开始执行: ${suite.name}`);
      const result = await engine.runTestSuite(suite);
      suiteResults.push(result);
    }
    
    const testDuration = Date.now() - testStartTime;
    const totalDuration = preGenDuration + testDuration;

    // 汇总统计
    const totalTests = suiteResults.reduce((sum, r) => sum + r.total, 0);
    const totalPassed = suiteResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = suiteResults.reduce((sum, r) => sum + r.failed, 0);

    console.log('\n' + '='.repeat(60));
    console.log('📊 测试汇总（批量预生成优化）');
    console.log('='.repeat(60));
    console.log(`预生成时间: ${preGenDuration}ms`);
    console.log(`测试执行时间: ${testDuration}ms`);
    console.log(`总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
    console.log(`-`.repeat(60));
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${totalPassed} ✅`);
    console.log(`失败: ${totalFailed} ${totalFailed > 0 ? '❌' : '✅'}`);
    console.log(`成功率: ${(totalPassed / totalTests * 100).toFixed(2)}%`);
    console.log('='.repeat(60));

    // 性能对比
    console.log('\n📈 性能提升分析:');
    console.log(`   预生成加速: ${tools.stats.preGenerated} 条 embedding`);
    console.log(`   缓存命中: ${tools.stats.cacheHits} 次`);
    console.log(`   API 调用: ${tools.stats.batchApiCalls} 次（批量）`);
    if (tools.stats.preGenerated > 0 && tools.stats.batchApiCalls > 0) {
      const avgPerBatch = tools.stats.preGenerated / tools.stats.batchApiCalls;
      console.log(`   平均每批: ${avgPerBatch.toFixed(1)} 条`);
    }

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
    await engine.logger.exportLogs('test-batch-optimized-logs.json');
    await engine.monitor.exportMetrics('test-batch-optimized-performance-metrics.json');
    await engine.monitor.exportReport('test-batch-optimized-performance-report.md');

    console.log('\n✨ 批量预生成优化测试完成！\n');

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error);
    await engine.logger.logError(error, 'test-execution');
    throw error;
  }
}

// 运行测试
runBatchOptimizedTest().catch(console.error);
