#!/usr/bin/env node

/**
 * Embedding模式对比测试
 * 对比Mock模式和Real模式的差异
 */

import MockOpenCodeTools from './mock-opencode-tools-v2.mjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMockMode() {
  console.log('\n🧪 测试Mock模式\n');

  const tools = new MockOpenCodeTools({
    embeddingMode: 'mock',
  });

  // 写入测试数据
  const testData = [
    '用户偏好使用TypeScript',
    'PostgreSQL数据库性能优化',
    'Redis缓存实现',
  ];

  console.log('写入测试数据...');
  for (const content of testData) {
    const result = await tools.memory_write({
      content,
      type: 'long-term',
      tags: 'test',
    });
    console.log(`  ✅ 写入: ${content.substring(0, 30)}...`);
  }

  // 测试向量生成
  console.log('\n测试向量生成...');
  const startTime = Date.now();
  const queryVector = await tools.generateEmbedding('TypeScript');
  const duration = Date.now() - startTime;
  console.log(`  ✅ 向量生成耗时: ${duration}ms`);
  console.log(`  ✅ 向量维度: ${queryVector.length}`);
  console.log(`  ✅ 前5个值: [${queryVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

  // 测试搜索
  console.log('\n测试搜索...');
  const searchResults = await tools.vector_memory_search({
    query: 'TypeScript',
    mode: 'hybrid',
  });
  console.log(`  ✅ 搜索结果数: ${searchResults.length}`);
  if (searchResults.length > 0) {
    console.log(`  ✅ 第1个结果: ${searchResults[0].content.substring(0, 50)}...`);
  }

  // 获取状态
  const status = await tools.index_status();
  console.log('\n索引状态:');
  console.log(`  ✅ 总记录数: ${status.totalRecords}`);
  console.log(`  ✅ 向量索引大小: ${status.vectorIndexSize}`);
  console.log(`  ✅ 缓存大小: ${status.embeddingCacheSize}`);
  console.log(`  ✅ 模式: ${status.embeddingMode}`);

  return {
    mode: 'mock',
    avgEmbeddingTime: duration,
    vectorDimensions: queryVector.length,
    searchResults: searchResults.length,
  };
}

async function testRealMode() {
  const apiKey = process.env.MODELSCOPE_API_KEY;

  if (!apiKey) {
    console.log('\n⚠️  跳过Real模式测试（未设置MODELSCOPE_API_KEY）');
    console.log('提示: export MODELSCOPE_API_KEY=your-key');
    return null;
  }

  console.log('\n🌐 测试Real模式\n');

  const tools = new MockOpenCodeTools({
    embeddingMode: 'real',
    apiKey: apiKey,
  });

  // 写入测试数据
  const testData = [
    '用户偏好使用TypeScript',
    'PostgreSQL数据库性能优化',
    'Redis缓存实现',
  ];

  console.log('写入测试数据...');
  for (const content of testData) {
    const result = await tools.memory_write({
      content,
      type: 'long-term',
      tags: 'test',
    });
    console.log(`  ✅ 写入: ${content.substring(0, 30)}...`);
  }

  // 测试向量生成
  console.log('\n测试向量生成...');
  const startTime = Date.now();
  const queryVector = await tools.generateEmbedding('TypeScript');
  const duration = Date.now() - startTime;
  console.log(`  ✅ 向量生成耗时: ${duration}ms`);
  console.log(`  ✅ 向量维度: ${queryVector.length}`);
  console.log(`  ✅ 前5个值: [${queryVector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}]`);

  // 测试搜索
  console.log('\n测试搜索...');
  const searchResults = await tools.vector_memory_search({
    query: 'TypeScript',
    mode: 'hybrid',
  });
  console.log(`  ✅ 搜索结果数: ${searchResults.length}`);
  if (searchResults.length > 0) {
    console.log(`  ✅ 第1个结果: ${searchResults[0].content.substring(0, 50)}...`);
  }

  // 获取状态
  const status = await tools.index_status();
  console.log('\n索引状态:');
  console.log(`  ✅ 总记录数: ${status.totalRecords}`);
  console.log(`  ✅ 向量索引大小: ${status.vectorIndexSize}`);
  console.log(`  ✅ 缓存大小: ${status.embeddingCacheSize}`);
  console.log(`  ✅ 模式: ${status.embeddingMode}`);
  console.log(`  ✅ API Key: ${status.apiKey}`);

  return {
    mode: 'real',
    avgEmbeddingTime: duration,
    vectorDimensions: queryVector.length,
    searchResults: searchResults.length,
  };
}

async function compareModes(mockResult, realResult) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 模式对比分析');
  console.log('='.repeat(60));

  if (!realResult) {
    console.log('⚠️  无法对比（Real模式测试未运行）');
    return;
  }

  console.log('\n性能对比:');
  console.log(`| 指标 | Mock模式 | Real模式 | 差异 |`);
  console.log(`|------|---------|----------|------|`);
  console.log(`| 向量生成耗时 | ${mockResult.avgEmbeddingTime}ms | ${realResult.avgEmbeddingTime}ms | ${realResult.avgEmbeddingTime - mockResult.avgEmbeddingTime}ms |`);
  console.log(`| 向量维度 | ${mockResult.vectorDimensions} | ${realResult.vectorDimensions} | ${realResult.vectorDimensions - mockResult.vectorDimensions} |`);
  console.log(`| 搜索结果数 | ${mockResult.searchResults} | ${realResult.searchResults} | ${realResult.searchResults - mockResult.searchResults} |`);

  const speedRatio = realResult.avgEmbeddingTime / mockResult.avgEmbeddingTime;
  console.log('\n速度分析:');
  console.log(`  Real模式比Mock模式慢 ${speedRatio.toFixed(2)}x`);

  console.log('\n真实性分析:');
  console.log(`  Mock模式: ❌ 哈希模拟，不是真正的语义向量`);
  console.log(`  Real模式: ✅ 真实API调用，真正的语义向量`);
  console.log(`  维度匹配: ${mockResult.vectorDimensions === realResult.vectorDimensions ? '❌' : '✅'} (${mockResult.vectorDimensions} vs ${realResult.vectorDimensions})`);

  console.log('\n使用建议:');
  console.log(`  📌 开发/调试: 使用Mock模式（快速、无网络）`);
  console.log(`  📌 功能测试: 使用Mock模式（稳定、可控）`);
  console.log(`  📌 集成测试: 使用Real模式（真实API）`);
  console.log(`  📌 性能测试: 使用Real模式（真实延迟）`);
  console.log(`  📌 生产验证: 使用Real模式（真实语义）`);

  // 生成对比报告
  const report = {
    timestamp: new Date().toISOString(),
    mock: mockResult,
    real: realResult,
    comparison: {
      speedRatio: speedRatio.toFixed(2),
      dimensionMismatch: mockResult.vectorDimensions !== realResult.vectorDimensions,
      dimensionDifference: realResult.vectorDimensions - mockResult.vectorDimensions,
    },
  };

  const reportPath = path.join(__dirname, '..', 'test-results', 'embedding-comparison.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n✅ 对比报告已生成: ${reportPath}`);
}

async function main() {
  console.log('🔍 Embedding模式对比测试\n');

  try {
    // 测试Mock模式
    const mockResult = await testMockMode();

    // 测试Real模式
    const realResult = await testRealMode();

    // 对比两种模式
    await compareModes(mockResult, realResult);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 对比测试完成！');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行主函数
main();
