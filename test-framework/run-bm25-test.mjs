/**
 * BM25中文分词测试 - 验证修复效果
 */

import { BM25Index } from '../opencode-memory-plugin/lib/bm25.js';

console.log('🎯 BM25中文分词测试\n' + '='.repeat(50));

const bm25 = new BM25Index();

// 测试用例
const testCases = [
  { text: 'TypeScript类型检查', description: '中英文混合' },
  { text: 'PostgreSQL数据库', description: '英文专有名词+中文' },
  { text: 'Python编程语言', description: '编程语言' },
  { text: 'Jest测试框架', description: '测试工具' },
  { text: 'JWT认证机制', description: '技术缩写+中文' },
  { text: '缓存策略优化', description: '纯中文' },
  { text: '内存安全', description: '短中文词' },
  { text: 'API设计最佳实践', description: '技术短语' },
  { text: '如何处理错误', description: '问题描述' },
  { text: '提高Web性能', description: '优化建议' },
];

console.log('\n📝 分词测试结果:\n');

testCases.forEach(({ text, description }) => {
  const tokens = bm25.tokenize(text);
  console.log(`📌 ${description}:`);
  console.log(`   原文: "${text}"`);
  console.log(`   分词: [${tokens.map(t => `"${t}"`).join(', ')}]`);
  console.log(`   数量: ${tokens.length} tokens\n`);
});

// 测试文档添加和搜索
console.log('='.repeat(50));
console.log('\n🔧 搜索测试:\n');

// 添加测试文档
const documents = [
  { id: 1, content: 'TypeScript类型检查是前端开发中的重要功能，可以帮助开发者在编译时发现类型错误。' },
  { id: 2, content: 'PostgreSQL数据库是一个强大的开源关系型数据库系统，支持ACID事务和复杂的查询。' },
  { id: 3, content: 'Python编程语言以其简洁的语法和丰富的生态系统在数据科学和机器学习领域广泛应用。' },
  { id: 4, content: 'Jest测试框架是Facebook开发的JavaScript测试工具，支持快照测试和断言。' },
  { id: 5, content: 'JWT认证机制是一种无状态的认证方式，通过令牌进行用户身份验证。' },
  { id: 6, content: '缓存策略可以显著提高系统性能，常用的缓存包括Redis和Memcached。' },
  { id: 7, content: '内存安全是Rust等系统编程语言的核心特性，通过所有权机制防止内存泄漏和悬垂指针。' },
];

documents.forEach(doc => {
  bm25.addDocument(doc.id, doc.content, {});
});

console.log(`✅ 已索引 ${documents.length} 条文档\n`);

// 测试搜索
const searchQueries = [
  'TypeScript',
  'PostgreSQL',
  'Python',
  'Jest',
  'JWT',
  '缓存',
  '内存安全',
  '类型检查',
  '认证',
  '测试框架',
];

searchQueries.forEach(query => {
  const results = bm25.search(query, { limit: 3, minScore: 0.1 });
  console.log(`🔍 查询: "${query}"`);
  if (results.length > 0) {
    results.forEach((r, i) => {
      console.log(`   ${i + 1}. [ID:${r.id}] Score: ${r.score.toFixed(3)}`);
      console.log(`      ${r.content.substring(0, 50)}...`);
    });
  } else {
    console.log('   ❌ 无结果');
  }
  console.log();
});

// 索引统计
const stats = bm25.getStats();
console.log('='.repeat(50));
console.log('\n📊 索引统计:');
console.log(`   文档数量: ${stats.documentCount}`);
console.log(`   平均文档长度: ${stats.averageDocumentLength} tokens`);
console.log(`   唯一术语数: ${stats.uniqueTerms}`);
console.log(`   总Token数: ${stats.totalTokens}`);
console.log('\n' + '='.repeat(50));
console.log('\n✅ BM25中文分词测试完成！');