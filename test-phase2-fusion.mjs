/**
 * Phase 2 融合策略对比测试
 * 对比三种融合策略的效果
 */

import { getVectorStore } from './opencode-memory-plugin/lib/vector-store.js';
import { createBM25Index } from './opencode-memory-plugin/lib/bm25.js';
import * as fusion from './opencode-memory-plugin/lib/fusion-strategies.js';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');

console.log('🔬 Phase 2 融合策略对比测试');
console.log('========================================\n');

// 测试文档集
const testDocuments = [
  { id: '1', content: 'JavaScript async/await patterns for error handling in modern web applications', metadata: { source: 'js-guide.md' } },
  { id: '2', content: 'Python asyncio best practices and examples for concurrent programming', metadata: { source: 'python-guide.md' } },
  { id: '3', content: 'TypeScript type safety in async functions and Promise handling', metadata: { source: 'ts-guide.md' } },
  { id: '4', content: 'Error handling in Promise chains and async JavaScript code', metadata: { source: 'error-guide.md' } },
  { id: '5', content: 'Async patterns in modern JavaScript frameworks like React and Vue', metadata: { source: 'framework-guide.md' } },
  { id: '6', content: 'Rust async runtime comparison: Tokio vs async-std', metadata: { source: 'rust-guide.md' } },
  { id: '7', content: 'Callback hell and how to avoid it with Promises and async/await', metadata: { source: 'callback-guide.md' } },
  { id: '8', content: 'Event loop and asynchronous programming in JavaScript', metadata: { source: 'eventloop-guide.md' } },
  { id: '9', content: 'Memory management in async JavaScript applications', metadata: { source: 'memory-guide.md' } },
  { id: '10', content: 'Vector search and BM25 hybrid approaches for information retrieval', metadata: { source: 'search-guide.md' } }
];

// 模拟向量搜索结果（使用相似度分数）
function mockVectorSearch(query) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  
  return testDocuments.map(doc => {
    const docTerms = doc.content.toLowerCase().split(/\s+/);
    let matchCount = 0;
    
    queryTerms.forEach(term => {
      if (docTerms.some(t => t.includes(term) || term.includes(t))) {
        matchCount++;
      }
    });
    
    // 模拟向量相似度（基于语义匹配）
    const semanticScore = 0.3 + (matchCount / queryTerms.length) * 0.6 + Math.random() * 0.1;
    
    return {
      ...doc,
      score: Math.min(semanticScore, 0.95)
    };
  }).sort((a, b) => b.score - a.score);
}

// 模拟BM25搜索结果
function mockBM25Search(query) {
  const index = createBM25Index(testDocuments);
  return index.search(query, { limit: 10, minScore: 0 });
}

// 测试查询
const testQueries = [
  { query: 'async', type: 'short', description: '单关键词' },
  { query: 'javascript async', type: 'short', description: '双关键词' },
  { query: 'error handling patterns', type: 'medium', description: '中查询' },
  { query: 'async javascript error handling patterns', type: 'long', description: '长查询' }
];

// 对比三种融合策略
async function compareStrategies() {
  console.log('📊 融合策略对比');
  console.log('----------------------------------------\n');
  
  const results = [];
  
  for (const test of testQueries) {
    console.log(`\n🔍 查询: "${test.query}" (${test.description})`);
    console.log('─'.repeat(60));
    
    // 获取搜索结果
    const vectorResults = mockVectorSearch(test.query);
    const bm25Results = mockBM25Search(test.query);
    
    console.log(`  向量搜索: ${vectorResults.length} 个结果`);
    console.log(`  BM25搜索: ${bm25Results.length} 个结果`);
    
    // 测试温和版乘法融合
    console.log('\n  📐 温和版乘法融合:');
    const softMultResults = fusion.softMultiplicationFusion(
      vectorResults, 
      bm25Results, 
      { limit: 5, vectorWeight: 0.5, bm25Weight: 0.3, productWeight: 0.2 }
    );
    
    softMultResults.slice(0, 3).forEach((r, i) => {
      console.log(`    ${i + 1}. [${r.score.toFixed(4)}] ${r.source}: ${r.content.substring(0, 40)}...`);
    });
    
    // 测试RRF融合
    console.log('\n  🔄 RRF融合:');
    const rrfResults = fusion.rrfFusion(
      vectorResults, 
      bm25Results, 
      { limit: 5, k: 60 }
    );
    
    rrfResults.slice(0, 3).forEach((r, i) => {
      console.log(`    ${i + 1}. [${r.score.toFixed(4)}] ${r.source}: ${r.content.substring(0, 40)}...`);
    });
    
    // 测试动态权重融合
    console.log('\n  ⚖️  动态权重融合:');
    const dynamicResults = fusion.dynamicWeightFusion(
      vectorResults, 
      bm25Results, 
      test.query,
      { limit: 5 }
    );
    
    dynamicResults.slice(0, 3).forEach((r, i) => {
      console.log(`    ${i + 1}. [${r.score.toFixed(4)}] ${r.source}: ${r.content.substring(0, 40)}...`);
    });
    
    // 记录结果
    results.push({
      query: test.query,
      type: test.type,
      softMultiplication: softMultResults.map(r => ({ id: r.id, score: r.score })),
      rrf: rrfResults.map(r => ({ id: r.id, score: r.score })),
      dynamic: dynamicResults.map(r => ({ id: r.id, score: r.score, weights: r.weights }))
    });
  }
  
  return results;
}

// 分析不同查询类型的表现
function analyzeByQueryType(results) {
  console.log('\n\n📈 按查询类型分析');
  console.log('========================================');
  
  const byType = {
    short: results.filter(r => r.type === 'short'),
    medium: results.filter(r => r.type === 'medium'),
    long: results.filter(r => r.type === 'long')
  };
  
  Object.entries(byType).forEach(([type, queries]) => {
    if (queries.length === 0) return;
    
    console.log(`\n${type.toUpperCase()} 查询分析:`);
    
    // 计算每种策略的平均分数范围
    const strategies = ['softMultiplication', 'rrf', 'dynamic'];
    
    strategies.forEach(strategy => {
      const allScores = queries.flatMap(q => q[strategy].map(r => r.score));
      const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
      const minScore = Math.min(...allScores);
      const maxScore = Math.max(...allScores);
      
      console.log(`  ${strategy}:`);
      console.log(`    - 平均分数: ${avgScore.toFixed(4)}`);
      console.log(`    - 分数范围: ${minScore.toFixed(4)} - ${maxScore.toFixed(4)}`);
    });
  });
}

// 主函数
async function main() {
  try {
    const results = await compareStrategies();
    analyzeByQueryType(results);
    
    console.log('\n\n========================================');
    console.log('✅ Phase 2 融合策略对比测试完成！');
    console.log('\n📋 总结:');
    console.log('1. 温和版乘法融合: 平衡了两种信号，但对归一化敏感');
    console.log('2. RRF融合: 简单高效，无需归一化，推荐首选');
    console.log('3. 动态权重融合: 自适应查询类型，适合混合场景');
    console.log('\n💡 建议:');
    console.log('- 短查询(1-2词): BM25权重应较高');
    console.log('- 长查询(>4词): 向量权重应较高');
    console.log('- 通用场景: RRF是最佳选择');
    
  } catch (e) {
    console.error('\n❌ 错误:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
