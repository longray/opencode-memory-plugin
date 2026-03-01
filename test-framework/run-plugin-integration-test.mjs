/**
 * 插件集成测试 - 使用真实的插件代码
 * 验证BM25和混合搜索的实际效果
 */

import { BM25Index } from '../opencode-memory-plugin/lib/bm25.js';
import fs from 'fs';
import path from 'path';

// 测试数据加载
const DATA_DIR = path.join(process.cwd(), 'test-data', 'labeled-dataset');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.jsonl');
const QUERIES_FILE = path.join(DATA_DIR, 'queries.json');

class PluginIntegrationTest {
  constructor() {
    this.documents = [];
    this.queries = [];
    this.bm25Index = new BM25Index();
    this.vectorEmbeddings = new Map(); // 假设已经有embedding数据
  }

  async initialize() {
    console.log('📚 加载标注数据集...');

    // 加载文档
    const docsContent = fs.readFileSync(DOCUMENTS_FILE, 'utf-8');
    for (const line of docsContent.trim().split('\n')) {
      const doc = JSON.parse(line);
      this.documents.push({
        id: doc.id,
        content: doc.content,
        metadata: { type: doc.type, tags: doc.tags }
      });
    }
    console.log(`   ✅ 已加载 ${this.documents.length} 条文档`);

    // 加载查询
    const queriesContent = fs.readFileSync(QUERIES_FILE, 'utf-8');
    this.queries = JSON.parse(queriesContent);
    console.log(`   ✅ 已加载 ${this.queries.length} 条查询`);

    // 构建BM25索引
    console.log('🔧 构建BM25索引（使用插件真实实现）...');
    for (const doc of this.documents) {
      this.bm25Index.addDocument(doc.id, doc.content, doc.metadata);
    }

    const stats = this.bm25Index.getStats();
    console.log(`   ✅ 索引构建完成: ${stats.documentCount} 文档, ${stats.uniqueTerms} 唯一术语`);
  }

  /**
   * 测试BM25搜索
   */
  async testBM25Search() {
    console.log('\n📊 测试插件BM25搜索...');

    const results = [];

    for (const query of this.queries) {
      const searchResults = this.bm25Index.search(query.query, { limit: 10, minScore: 0.1 });

      // 计算Recall@10
      const relevantIds = new Set(query.relevant_ids);
      const foundRelevant = searchResults.filter(r => relevantIds.has(r.id)).length;
      const recall = query.relevant_ids.length > 0 ? foundRelevant / query.relevant_ids.length : 0;

      // 计算Precision@10
      const precision = searchResults.length > 0 ? foundRelevant / searchResults.length : 0;

      // 计算MRR
      let mrr = 0;
      for (let i = 0; i < searchResults.length; i++) {
        if (relevantIds.has(searchResults[i].id)) {
          mrr = 1 / (i + 1);
          break;
        }
      }

      results.push({
        query: query.query,
        mode: 'bm25-plugin',
        recall,
        precision,
        mrr,
        foundRelevant,
        totalRelevant: query.relevant_ids.length,
        topResults: searchResults.slice(0, 5).map(r => ({ id: r.id, score: r.score }))
      });
    }

    // 计算聚合指标
    const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
    const avgPrecision = results.reduce((sum, r) => sum + (r.precision || 0), 0) / results.length;
    const avgMRR = results.reduce((sum, r) => sum + r.mrr, 0) / results.length;

    console.log('\n📊 BM25搜索结果:');
    console.log(`   Recall@10:    ${(avgRecall * 100).toFixed(2)}%`);
    console.log(`   Precision@10: ${(avgPrecision * 100).toFixed(2)}%`);
    console.log(`   MRR:          ${avgMRR.toFixed(4)}`);

    // 查找最佳和最差查询
    results.sort((a, b) => b.recall - a.recall);
    console.log('\n🏆 最佳查询 (Top 5):');
    results.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.query}: ${(r.recall * 100).toFixed(1)}% (${r.foundRelevant}/${r.totalRelevant})`);
    });

    console.log('\n⚠️  最差查询 (Bottom 5):');
    results.slice(-5).reverse().forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.query}: ${(r.recall * 100).toFixed(1)}% (${r.foundRelevant}/${r.totalRelevant})`);
    });

    // 保存结果
    const outputPath = path.join(process.cwd(), 'test-results', 'plugin-integration-test.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: {
        recall: avgRecall,
        precision: avgPrecision,
        mrr: avgMRR
      },
      results
    }, null, 2));

    console.log(`\n📄 详细结果已保存: ${outputPath}`);

    return {
      avgRecall,
      avgPrecision,
      avgMRR,
      results
    };
  }

  /**
   * 生成中文分词测试报告
   */
  testChineseTokenization() {
    console.log('\n🔬 测试中文分词...');

    const testCases = [
      'TypeScript类型检查',
      'PostgreSQL数据库',
      'Python编程语言',
      'Jest测试框架',
      'JWT认证机制',
      '缓存策略优化',
      '内存安全'
    ];

    console.log('\n分词结果:');
    testCases.forEach(text => {
      const tokens = this.bm25Index.tokenize(text);
      console.log(`   "${text}" -> [${tokens.map(t => `"${t}"`).join(', ')}]`);
    });
  }
}

// 主函数
async function main() {
  console.log('🎯 插件集成测试 - 使用真实代码\n' + '='.repeat(50));

  const test = new PluginIntegrationTest();
  await test.initialize();

  // 测试中文分词
  test.testChineseTokenization();

  // 测试BM25搜索
  const results = await test.testBM25Search();

  console.log('\n' + '='.repeat(50));
  if (results.avgRecall >= 0.70) {
    console.log('✅ BM25搜索测试通过！');
  } else {
    console.log(`❌ BM25搜索测试未通过 (Recall@10: ${(results.avgRecall * 100).toFixed(2)}%)`);
  }
}

main().catch(console.error);