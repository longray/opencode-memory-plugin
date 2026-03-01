/**
 * Phase 1 诊断功能测试脚本
 * 验证 bm25_diagnose 工具和分数分布分析
 */

import { BM25Index, createBM25Index } from './opencode-memory-plugin/lib/bm25.js';
import { getVectorStore } from './opencode-memory-plugin/lib/vector-store.js';
import * as stats from './opencode-memory-plugin/lib/statistics-utils.js';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');

console.log('🔍 Phase 1 诊断功能测试');
console.log('========================================\n');

// 测试1: BM25 searchWithDiagnostics
console.log('📊 测试1: BM25 searchWithDiagnostics');
console.log('----------------------------------------');

const testDocs = [
  { id: '1', content: 'JavaScript async/await patterns for error handling', metadata: { source: 'test1.md' } },
  { id: '2', content: 'Python asyncio best practices and examples', metadata: { source: 'test2.md' } },
  { id: '3', content: 'TypeScript type safety in async functions', metadata: { source: 'test3.md' } },
  { id: '4', content: 'Error handling in Promise chains', metadata: { source: 'test4.md' } },
  { id: '5', content: 'Async patterns in modern JavaScript frameworks', metadata: { source: 'test5.md' } },
  { id: '6', content: 'Rust async runtime comparison', metadata: { source: 'test6.md' } },
  { id: '7', content: 'Callback hell and how to avoid it', metadata: { source: 'test7.md' } },
  { id: '8', content: 'Event loop and asynchronous programming', metadata: { source: 'test8.md' } }
];

const index = createBM25Index(testDocs);

// 测试不同的查询
const testQueries = [
  'async javascript',
  'error handling',
  'python asyncio',
  'typescript',
  'rust'
];

for (const query of testQueries) {
  console.log(`\n🔍 查询: "${query}"`);
  const { results, diagnostics } = index.searchWithDiagnostics(query, { limit: 5, minScore: 0.1 });
  
  console.log(`  📈 分数分布:`);
  console.log(`    - 文档总数: ${diagnostics.totalDocs}`);
  console.log(`    - 超过阈值: ${diagnostics.scoreDistribution.aboveThreshold}`);
  console.log(`    - 最小值: ${diagnostics.scoreDistribution.min.toFixed(4)}`);
  console.log(`    - 最大值: ${diagnostics.scoreDistribution.max.toFixed(4)}`);
  console.log(`    - 平均值: ${diagnostics.scoreDistribution.mean.toFixed(4)}`);
  
  if (diagnostics.scoreDistribution.percentiles) {
    const p = diagnostics.scoreDistribution.percentiles;
    console.log(`    - 百分位数: P25=${p.p25?.toFixed(4)}, P50=${p.p50?.toFixed(4)}, P75=${p.p75?.toFixed(4)}`);
  }
  
  console.log(`  📝 查询词: [${diagnostics.queryTerms.join(', ')}]`);
  console.log(`  ⏱️  处理时间: ${diagnostics.processingTime}ms`);
  
  if (results.length > 0) {
    console.log(`  📄 最佳匹配:`);
    results.slice(0, 3).forEach((r, i) => {
      console.log(`    ${i + 1}. [${r.score.toFixed(4)}] ${r.metadata.source}: ${r.content.substring(0, 50)}...`);
    });
  }
}

// 测试2: 统计工具
console.log('\n\n📊 测试2: 统计工具函数');
console.log('----------------------------------------');

const testScores = [0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 1.0, 2.5, 5.0, 10.0];
const distribution = stats.calculateScoreDistribution(testScores);

console.log(`测试分数: [${testScores.join(', ')}]`);
console.log(`\n统计结果:`);
console.log(`  - 平均值: ${distribution.mean.toFixed(4)}`);
console.log(`  - 中位数: ${distribution.median.toFixed(4)}`);
console.log(`  - 标准差: ${distribution.stdDev.toFixed(4)}`);
console.log(`  - 最小值: ${distribution.min.toFixed(4)}`);
console.log(`  - 最大值: ${distribution.max.toFixed(4)}`);

// 生成分布报告
const report = stats.generateDistributionReport(distribution, '测试分数');
console.log(`\n${report}`);

// 测试3: 长尾分布判断
console.log('\n📊 测试3: 长尾分布判断');
console.log('----------------------------------------');

const longTailScores = [0.01, 0.02, 0.03, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0];
const longTailDist = stats.calculateScoreDistribution(longTailScores);
const isLongTail = stats.isLongTailedDistribution(longTailDist);

console.log(`长尾分布测试:`);
console.log(`  - 平均值/中位数: ${(longTailDist.mean / longTailDist.median).toFixed(2)}`);
console.log(`  - 是否为长尾分布: ${isLongTail ? '✅ 是' : '❌ 否'}`);

// 测试4: 鲁棒性测试查询
console.log('\n\n📊 测试4: 鲁棒性测试');
console.log('----------------------------------------');

const robustnessTests = [
  { name: '空查询', query: '' },
  { name: '单字符', query: 'a' },
  { name: '特殊字符', query: '!@#$%^&*()' },
  { name: '超长查询', query: 'async '.repeat(50) },
  { name: '混合语言', query: 'async 异步 비동기' },
  { name: '数字查询', query: '12345 67890' }
];

for (const test of robustnessTests) {
  console.log(`\n🔍 ${test.name}: "${test.query.substring(0, 30)}${test.query.length > 30 ? '...' : ''}"`);
  const start = Date.now();
  const { results, diagnostics } = index.searchWithDiagnostics(test.query, { limit: 3, minScore: 0 });
  const time = Date.now() - start;
  
  console.log(`  - 查询词: [${diagnostics.queryTerms.join(', ') || '无'}]`);
  console.log(`  - 结果数: ${results.length}`);
  console.log(`  - 处理时间: ${time}ms`);
}

console.log('\n========================================');
console.log('✅ Phase 1 诊断功能测试完成！');
console.log('\n下一步:');
console.log('1. 使用 bm25_diagnose 工具进行实际数据分析');
console.log('2. 收集真实查询的分数分布');
console.log('3. 分析长尾分布特征');
console.log('4. 运行更多鲁棒性测试');
