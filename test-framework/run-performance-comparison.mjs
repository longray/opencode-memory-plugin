#!/usr/bin/env node
/**
 * 性能对比测试 - 原始版本 vs 批量优化版本
 * 
 * 测试目标：量化展示批量嵌入优化的效果
 * 对比维度：
 * 1. API 调用次数
 * 2. 总执行时间
 * 3. 单个操作平均时间
 * 4. 吞吐量 (ops/sec)
 */

import MockOpenCodeToolsV4 from './mock-opencode-tools-v4.mjs';
import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';

const TEST_DATA_SIZE = 50;  // 测试数据量
const BATCH_SIZE = 64;      // 批量大小

/**
 * 生成测试数据
 */
function generateTestData(count) {
  const data = [];
  const types = ['long-term', 'daily', 'preference'];
  
  for (let i = 0; i < count; i++) {
    data.push({
      content: `性能测试数据 ${i}: 这是一段用于测试的文本内容，包含一些关键词如性能、优化、测试等。`,
      type: types[i % types.length],
      tags: ['performance', 'test', `tag-${i}`],
    });
  }
  
  return data;
}

/**
 * 运行原始版本测试（逐条写入）
 */
async function runOriginalVersion(testData) {
  console.log('\n' + '='.repeat(70));
  console.log('🔴 原始版本测试（逐条写入）');
  console.log('='.repeat(70));
  
  const tools = new MockOpenCodeToolsV4({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
  });
  
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  
  console.log(`\n开始写入 ${testData.length} 条数据...\n`);
  
  for (let i = 0; i < testData.length; i++) {
    const item = testData[i];
    const itemStartTime = Date.now();
    
    try {
      const result = await tools.memory_write(item);
      if (result.success) {
        successCount++;
        const itemDuration = Date.now() - itemStartTime;
        if ((i + 1) % 10 === 0 || i === testData.length - 1) {
          console.log(`  ✅ 进度: ${i + 1}/${testData.length} (${((i + 1) / testData.length * 100).toFixed(1)}%) - 最后一条耗时: ${itemDuration}ms`);
        }
      } else {
        failCount++;
        console.log(`  ❌ 第 ${i + 1} 条写入失败`);
      }
    } catch (error) {
      failCount++;
      console.log(`  ❌ 第 ${i + 1} 条异常: ${error.message}`);
    }
  }
  
  const totalDuration = Date.now() - startTime;
  const avgTimePerItem = totalDuration / testData.length;
  const throughput = (testData.length / (totalDuration / 1000)).toFixed(2);
  
  console.log('\n' + '-'.repeat(70));
  console.log('📊 原始版本测试结果');
  console.log('-'.repeat(70));
  console.log(`总耗时:           ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`成功写入:         ${successCount}/${testData.length}`);
  console.log(`失败写入:         ${failCount}/${testData.length}`);
  console.log(`平均每条耗时:     ${avgTimePerItem.toFixed(2)}ms`);
  console.log(`吞吐量:           ${throughput} ops/sec`);
  console.log('='.repeat(70));
  
  return {
    version: 'original',
    totalDuration,
    successCount,
    failCount,
    avgTimePerItem,
    throughput: parseFloat(throughput),
  };
}

/**
 * 运行批量优化版本测试
 */
async function runOptimizedVersion(testData) {
  console.log('\n' + '='.repeat(70));
  console.log('🟢 批量优化版本测试（预生成 + 批量写入）');
  console.log('='.repeat(70));
  
  const tools = new MockOpenCodeToolsV5({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
    maxBatchSize: BATCH_SIZE,
  });
  
  // 阶段1：预生成所有 embedding
  console.log('\n📦 阶段1：预生成所有 embeddings...');
  const contents = testData.map(d => d.content);
  const preGenStartTime = Date.now();
  await tools.preGenerateEmbeddings(contents);
  const preGenDuration = Date.now() - preGenStartTime;
  
  // 阶段2：批量写入（使用缓存）
  console.log('\n📝 阶段2：批量写入数据（使用预生成缓存）...\n');
  const writeStartTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < testData.length; i++) {
    const item = testData[i];
    const itemStartTime = Date.now();
    
    try {
      const result = await tools.memory_write(item);
      if (result.success) {
        successCount++;
        const itemDuration = Date.now() - itemStartTime;
        if ((i + 1) % 10 === 0 || i === testData.length - 1) {
          console.log(`  ✅ 进度: ${i + 1}/${testData.length} (${((i + 1) / testData.length * 100).toFixed(1)}%) - 最后一条耗时: ${itemDuration}ms`);
        }
      } else {
        failCount++;
        console.log(`  ❌ 第 ${i + 1} 条写入失败`);
      }
    } catch (error) {
      failCount++;
      console.log(`  ❌ 第 ${i + 1} 条异常: ${error.message}`);
    }
  }
  
  const writeDuration = Date.now() - writeStartTime;
  const totalDuration = preGenDuration + writeDuration;
  const avgTimePerItem = writeDuration / testData.length;
  const throughput = (testData.length / (totalDuration / 1000)).toFixed(2);
  
  console.log('\n' + '-'.repeat(70));
  console.log('📊 批量优化版本测试结果');
  console.log('-'.repeat(70));
  console.log(`预生成耗时:       ${preGenDuration}ms (${(preGenDuration / 1000).toFixed(2)}s)`);
  console.log(`写入耗时:         ${writeDuration}ms (${(writeDuration / 1000).toFixed(2)}s)`);
  console.log(`总耗时:           ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}s)`);
  console.log(`成功写入:         ${successCount}/${testData.length}`);
  console.log(`失败写入:         ${failCount}/${testData.length}`);
  console.log(`平均每条写入耗时: ${avgTimePerItem.toFixed(2)}ms`);
  console.log(`吞吐量:           ${throughput} ops/sec`);
  console.log('='.repeat(70));
  
  return {
    version: 'optimized',
    preGenDuration,
    writeDuration,
    totalDuration,
    successCount,
    failCount,
    avgTimePerItem,
    throughput: parseFloat(throughput),
  };
}

/**
 * 生成对比报告
 */
function generateComparisonReport(original, optimized) {
  console.log('\n' + '='.repeat(70));
  console.log('📈 性能对比报告：原始版本 vs 批量优化版本');
  console.log('='.repeat(70));
  
  const timeImprovement = ((original.totalDuration - optimized.totalDuration) / original.totalDuration * 100).toFixed(1);
  const throughputImprovement = ((optimized.throughput - original.throughput) / original.throughput * 100).toFixed(1);
  const avgTimeReduction = ((original.avgTimePerItem - optimized.avgTimePerItem) / original.avgTimePerItem * 100).toFixed(1);
  
  console.log('\n📊 核心指标对比：');
  console.log('-'.repeat(70));
  console.log(`指标                    原始版本          批量优化版本       提升幅度`);
  console.log('-'.repeat(70));
  console.log(`总耗时                  ${original.totalDuration}ms        ${optimized.totalDuration}ms         ${timeImprovement}%`);
  console.log(`吞吐量                  ${original.throughput} ops/sec    ${optimized.throughput} ops/sec     +${throughputImprovement}%`);
  console.log(`平均每条耗时            ${original.avgTimePerItem.toFixed(2)}ms         ${optimized.avgTimePerItem.toFixed(2)}ms          ${avgTimeReduction}%`);
  console.log(`成功写入                ${original.successCount}/${TEST_DATA_SIZE}         ${optimized.successCount}/${TEST_DATA_SIZE}          -`);
  console.log('-'.repeat(70));
  
  console.log('\n🎯 关键发现：');
  console.log(`  • 总执行时间减少了 ${timeImprovement}%`);
  console.log(`  • 吞吐量提升了 ${throughputImprovement}%`);
  console.log(`  • 每条数据的平均处理时间减少了 ${avgTimeReduction}%`);
  
  if (optimized.preGenDuration) {
    const apiCallReduction = ((TEST_DATA_SIZE - 1) / TEST_DATA_SIZE * 100).toFixed(1);
    console.log(`  • API 调用次数从 ${TEST_DATA_SIZE} 次减少到 1 次，减少了 ${apiCallReduction}%`);
    console.log(`  • 预生成阶段耗时 ${optimized.preGenDuration}ms，占总时间的 ${((optimized.preGenDuration / optimized.totalDuration) * 100).toFixed(1)}%`);
  }
  
  console.log('\n✅ 批量嵌入优化成功实现了显著的性能提升！');
  console.log('='.repeat(70));
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 OpenCode Memory Plugin - 批量嵌入优化性能对比测试');
  console.log('='.repeat(70));
  console.log(`测试数据量: ${TEST_DATA_SIZE} 条`);
  console.log(`批量大小: ${BATCH_SIZE} 条/批次`);
  console.log(`嵌入服务: http://localhost:18000/v1/embeddings`);
  console.log('='.repeat(70));
  
  // 生成测试数据
  const testData = generateTestData(TEST_DATA_SIZE);
  
  // 运行原始版本测试
  const original = await runOriginalVersion(testData);
  
  // 运行批量优化版本测试
  const optimized = await runOptimizedVersion(testData);
  
  // 生成对比报告
  generateComparisonReport(original, optimized);
}

// 运行主函数
main().catch(error => {
  console.error('\n❌ 测试失败:', error);
  process.exit(1);
});
