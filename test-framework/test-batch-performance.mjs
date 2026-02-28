#!/usr/bin/env node
/**
 * 批量嵌入性能测试
 * 测试不同批量大小下的性能表现
 */

import MockOpenCodeTools from './mock-opencode-tools-v4.mjs';

async function testBatchPerformance() {
  console.log('🚀 批量嵌入性能测试\n');
  console.log('   服务端点: http://localhost:18000/v1/embeddings\n');

  const tools = new MockOpenCodeTools({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
    maxBatchSize: 64,
  });

  // 生成测试文本
  const testTexts = [];
  for (let i = 1; i <= 100; i++) {
    testTexts.push(`这是第${i}条测试文本，用于测试批量嵌入性能。包含一些中文和English mixed content。`);
  }

  console.log(`📊 测试文本数量: ${testTexts.length}\n`);

  // 测试不同批量大小
  const batchSizes = [1, 10, 25, 50, 64];
  const results = [];

  for (const batchSize of batchSizes) {
    console.log(`\n📦 测试批量大小: ${batchSize}`);

    const batches = [];
    for (let i = 0; i < testTexts.length; i += batchSize) {
      batches.push(testTexts.slice(i, i + batchSize));
    }

    const startTime = Date.now();
    let totalProcessed = 0;

    for (const batch of batches) {
      await tools.generateBatchEmbeddings(batch);
      totalProcessed += batch.length;
    }

    const duration = Date.now() - startTime;
    const avgTimePerText = duration / totalProcessed;
    const throughput = (totalProcessed / (duration / 1000)).toFixed(2);

    console.log(`   批次: ${batches.length}`);
    console.log(`   总耗时: ${duration}ms`);
    console.log(`   平均: ${avgTimePerText.toFixed(2)}ms/条`);
    console.log(`   吞吐量: ${throughput} 条/秒`);

    results.push({
      batchSize,
      batches: batches.length,
      totalProcessed,
      duration,
      avgTimePerText,
      throughput,
    });
  }

  // 汇总结果
  console.log('\n' + '='.repeat(70));
  console.log('📊 性能测试汇总');
  console.log('='.repeat(70));
  console.log('批量大小 | 批次数 | 总文本数 | 总耗时 | 平均/条 | 吞吐量(条/秒)');
  console.log('---------|--------|----------|--------|---------|--------------');
  results.forEach(r => {
    console.log(
      `${r.batchSize.toString().padStart(8)} | ` +
      `${r.batches.toString().padStart(6)} | ` +
      `${r.totalProcessed.toString().padStart(8)} | ` +
      `${r.duration.toString().padStart(6)} | ` +
      `${r.avgTimePerText.toFixed(2).padStart(7)} | ` +
      `${r.throughput.toString().padStart(12)}`
    );
  });
  console.log('='.repeat(70));

  // 测试缓存性能
  console.log('\n📦 测试缓存性能...');
  const cacheTestTexts = testTexts.slice(0, 10);

  // 第一次请求（无缓存）
  const cacheStart1 = Date.now();
  await tools.generateBatchEmbeddings(cacheTestTexts);
  const cacheDuration1 = Date.now() - cacheStart1;
  console.log(`   第一次请求（无缓存）: ${cacheDuration1}ms (${cacheDuration1 / cacheTestTexts.length.toFixed(2)}ms/条)`);

  // 第二次请求（有缓存）
  const cacheStart2 = Date.now();
  await tools.generateBatchEmbeddings(cacheTestTexts);
  const cacheDuration2 = Date.now() - cacheStart2;
  console.log(`   第二次请求（有缓存）: ${cacheDuration2}ms (${cacheDuration2 / cacheTestTexts.length.toFixed(2)}ms/条)`);
  console.log(`   加速比: ${(cacheDuration1 / cacheDuration2).toFixed(2)}x`);

  // 打印缓存统计
  console.log('\n📊 缓存统计:');
  const cacheStats = tools.getCacheStats();
  console.log(`   缓存命中: ${cacheStats.totalHits}`);
  console.log(`   缓存大小: ${cacheStats.cacheSize}`);
  console.log(`   命中率: ${cacheStats.hitRate}%`);
}

// 运行测试
testBatchPerformance().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
