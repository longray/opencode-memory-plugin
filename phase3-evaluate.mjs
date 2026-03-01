/**
 * Phase 3 真实数据集评估框架
 * 在真实记忆数据上评估三种融合策略
 */

import { getVectorStore } from './opencode-memory-plugin/lib/vector-store.js';
import { createBM25Index } from './opencode-memory-plugin/lib/bm25.js';
import * as fusion from './opencode-memory-plugin/lib/fusion-strategies.js';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');

console.log('🔬 Phase 3 真实数据集评估');
console.log('========================================\n');

// 测试查询集（基于实际使用场景）
const testQueries = [
  // 技术查询
  { query: 'async await error handling', category: 'technical', relevance: ['MEMORY.md'] },
  { query: 'vector search implementation', category: 'technical', relevance: ['MEMORY.md'] },
  { query: 'BM25 algorithm parameters', category: 'technical', relevance: ['MEMORY.md'] },
  { query: 'javascript typescript best practices', category: 'technical', relevance: ['TOOLS.md', 'MEMORY.md'] },
  { query: 'memory plugin configuration', category: 'technical', relevance: ['AGENTS.md', 'TOOLS.md'] },
  
  // 配置查询
  { query: 'how to configure external embedding', category: 'config', relevance: ['AGENTS.md', 'TOOLS.md'] },
  { query: 'installation setup guide', category: 'config', relevance: ['BOOTSTRAP.md', 'BOOT.md'] },
  { query: 'troubleshooting connection issues', category: 'config', relevance: ['HEARTBEAT.md', 'AGENTS.md'] },
  
  // 使用查询
  { query: 'memory write usage examples', category: 'usage', relevance: ['TOOLS.md', 'AGENTS.md'] },
  { query: 'daily log initialization', category: 'usage', relevance: ['BOOT.md', 'BOOTSTRAP.md'] },
  { query: 'search modes hybrid vector keyword', category: 'usage', relevance: ['MEMORY.md', 'AGENTS.md'] },
  
  // 短查询
  { query: 'async', category: 'short', relevance: ['MEMORY.md'] },
  { query: 'error', category: 'short', relevance: ['MEMORY.md', 'AGENTS.md'] },
  { query: 'memory', category: 'short', relevance: ['MEMORY.md', 'AGENTS.md'] },
  
  // 长查询
  { query: 'how to implement custom embedding service with local API endpoint', category: 'long', relevance: ['AGENTS.md', 'TOOLS.md'] },
  { query: 'best practices for organizing memory entries and daily logs', category: 'long', relevance: ['AGENTS.md', 'BOOTSTRAP.md'] },
  { query: 'difference between vector search and keyword search and when to use each', category: 'long', relevance: ['MEMORY.md', 'AGENTS.md'] }
];

// 加载真实记忆文档
function loadMemoryDocuments() {
  const documents = [];
  const files = [];
  
  // 核心记忆文件
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md', 'BOOT.md', 'BOOTSTRAP.md'];
  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      files.push({ path: filePath, name: file });
    }
  }
  
  // Daily logs
  const dailyDir = path.join(MEMORY_DIR, 'daily');
  if (fs.existsSync(dailyDir)) {
    const dailyFiles = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 10);
    
    for (const file of dailyFiles) {
      files.push({ path: path.join(dailyDir, file), name: `daily/${file}` });
    }
  }
  
  // 分块处理
  let docId = 0;
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const lines = content.split('\n');
      const chunkSize = 10; // 每10行一个块
      
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join('\n').trim();
        if (chunk.length > 20) {
          documents.push({
            id: `doc_${docId++}`,
            content: chunk,
            metadata: { source: file.name, line: i + 1 }
          });
        }
      }
    } catch (e) {
      console.log(`  ⚠️  跳过文件: ${file.name}`);
    }
  }
  
  return { documents, files: files.map(f => f.name) };
}

// 评估策略性能
async function evaluateStrategy(strategyName, query, documents, vectorStore, options = {}) {
  const startTime = Date.now();
  
  // 执行搜索
  const vectorResults = await vectorStore.search(query, { 
    limit: 20, 
    threshold: 0.3 
  });
  
  const bm25Index = createBM25Index(documents);
  const bm25Results = bm25Index.search(query, { limit: 20, minScore: 0 });
  
  let fusedResults;
  switch (strategyName) {
    case 'rrf':
      fusedResults = fusion.rrfFusion(vectorResults, bm25Results, { 
        limit: 10, 
        k: options.k || 60 
      });
      break;
    case 'soft-multiplication':
      fusedResults = fusion.softMultiplicationFusion(vectorResults, bm25Results, { 
        limit: 10,
        vectorWeight: options.vectorWeight || 0.5,
        bm25Weight: options.bm25Weight || 0.3,
        productWeight: options.productWeight || 0.2
      });
      break;
    case 'dynamic':
      fusedResults = fusion.dynamicWeightFusion(vectorResults, bm25Results, query, { limit: 10 });
      break;
    default:
      throw new Error(`Unknown strategy: ${strategyName}`);
  }
  
  const processingTime = Date.now() - startTime;
  
  return {
    strategy: strategyName,
    query,
    results: fusedResults,
    resultCount: fusedResults.length,
    processingTime,
    vectorResultsCount: vectorResults.length,
    bm25ResultsCount: bm25Results.length
  };
}

// 计算评估指标
function calculateMetrics(results, relevantFiles) {
  if (results.length === 0 || !relevantFiles) {
    return { precision: 0, recall: 0, f1: 0, mrr: 0 };
  }
  
  // 简化评估：检查前N个结果中是否包含相关文件
  let relevantCount = 0;
  let firstRelevantRank = -1;
  
  results.forEach((result, index) => {
    const source = result.source || '';
    const isRelevant = relevantFiles.some(file => source.includes(file));
    
    if (isRelevant) {
      relevantCount++;
      if (firstRelevantRank === -1) {
        firstRelevantRank = index + 1;
      }
    }
  });
  
  const precision = relevantCount / results.length;
  const recall = relevantCount / relevantFiles.length; // 简化计算
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const mrr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0;
  
  return { precision, recall, f1, mrr };
}

// 主评估函数
async function runEvaluation() {
  console.log('📁 加载记忆文档...');
  const { documents, files } = loadMemoryDocuments();
  console.log(`  加载了 ${documents.length} 个文档块，来自 ${files.length} 个文件`);
  
  console.log('\n🔌 初始化向量存储...');
  const vectorStore = getVectorStore();
  const initResult = await vectorStore.initialize();
  if (!initResult.success) {
    console.log('  ⚠️  向量存储初始化失败，将使用模拟数据');
  } else {
    console.log(`  ✓ 向量存储就绪 (${vectorStore.dimensions}维度)`);
  }
  
  console.log('\n🔍 开始评估...');
  console.log('─'.repeat(70));
  
  const strategies = ['rrf', 'soft-multiplication', 'dynamic'];
  const results = {
    rrf: [],
    'soft-multiplication': [],
    dynamic: []
  };
  
  for (const testCase of testQueries) {
    process.stdout.write(`\n查询: "${testCase.query.substring(0, 50)}${testCase.query.length > 50 ? '...' : ''}" `);
    
    for (const strategy of strategies) {
      try {
        const evalResult = await evaluateStrategy(strategy, testCase.query, documents, vectorStore);
        const metrics = calculateMetrics(evalResult.results, testCase.relevance);
        
        results[strategy].push({
          ...evalResult,
          ...metrics,
          category: testCase.category
        });
        
        process.stdout.write('.');
      } catch (e) {
        process.stdout.write('x');
      }
    }
  }
  
  console.log('\n\n✅ 评估完成！');
  return results;
}

// 分析结果
function analyzeResults(results) {
  console.log('\n\n📊 评估结果分析');
  console.log('========================================\n');
  
  const strategies = Object.keys(results);
  
  // 1. 总体表现
  console.log('1️⃣  总体表现');
  console.log('─'.repeat(70));
  
  strategies.forEach(strategy => {
    const strategyResults = results[strategy];
    const avgPrecision = strategyResults.reduce((a, b) => a + b.precision, 0) / strategyResults.length;
    const avgRecall = strategyResults.reduce((a, b) => a + b.recall, 0) / strategyResults.length;
    const avgF1 = strategyResults.reduce((a, b) => a + b.f1, 0) / strategyResults.length;
    const avgMRR = strategyResults.reduce((a, b) => a + b.mrr, 0) / strategyResults.length;
    const avgTime = strategyResults.reduce((a, b) => a + b.processingTime, 0) / strategyResults.length;
    
    console.log(`\n  ${strategy.toUpperCase()}:`);
    console.log(`    Precision: ${(avgPrecision * 100).toFixed(1)}%`);
    console.log(`    Recall:    ${(avgRecall * 100).toFixed(1)}%`);
    console.log(`    F1 Score:  ${(avgF1 * 100).toFixed(1)}%`);
    console.log(`    MRR:       ${avgMRR.toFixed(3)}`);
    console.log(`    Avg Time:  ${avgTime.toFixed(0)}ms`);
  });
  
  // 2. 按类别分析
  console.log('\n\n2️⃣  按查询类别分析');
  console.log('─'.repeat(70));
  
  const categories = ['technical', 'config', 'usage', 'short', 'long'];
  
  categories.forEach(category => {
    console.log(`\n  ${category.toUpperCase()} 查询:`);
    
    strategies.forEach(strategy => {
      const categoryResults = results[strategy].filter(r => r.category === category);
      if (categoryResults.length === 0) return;
      
      const avgPrecision = categoryResults.reduce((a, b) => a + b.precision, 0) / categoryResults.length;
      const avgMRR = categoryResults.reduce((a, b) => a + b.mrr, 0) / categoryResults.length;
      
      console.log(`    ${strategy.padEnd(20)}: P=${(avgPrecision * 100).toFixed(1)}%, MRR=${avgMRR.toFixed(3)}`);
    });
  });
  
  // 3. 找出最佳策略
  console.log('\n\n3️⃣  最佳策略推荐');
  console.log('─'.repeat(70));
  
  // 计算综合得分
  const scores = strategies.map(strategy => {
    const strategyResults = results[strategy];
    const avgPrecision = strategyResults.reduce((a, b) => a + b.precision, 0) / strategyResults.length;
    const avgMRR = strategyResults.reduce((a, b) => a + b.mrr, 0) / strategyResults.length;
    const avgTime = strategyResults.reduce((a, b) => a + b.processingTime, 0) / strategyResults.length;
    
    // 综合得分 = 0.4*Precision + 0.4*MRR + 0.2*(1/normalized_time)
    const score = 0.4 * avgPrecision + 0.4 * avgMRR + 0.2 * (100 / (avgTime + 100));
    
    return { strategy, score, avgPrecision, avgMRR, avgTime };
  });
  
  scores.sort((a, b) => b.score - a.score);
  
  scores.forEach((s, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`  ${medal} ${index + 1}. ${s.strategy.padEnd(20)} (得分: ${s.score.toFixed(3)})`);
  });
  
  return scores;
}

// 保存结果
function saveResults(results, ranking) {
  const outputDir = path.join(process.cwd(), 'phase3-evaluation');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(outputDir, `evaluation-${timestamp}.json`);
  
  fs.writeFileSync(outputFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    results,
    ranking,
    summary: {
      totalQueries: testQueries.length,
      strategies: Object.keys(results),
      winner: ranking[0].strategy
    }
  }, null, 2));
  
  console.log(`\n\n💾 结果已保存: ${outputFile}`);
}

// 主函数
async function main() {
  try {
    const results = await runEvaluation();
    const ranking = analyzeResults(results);
    saveResults(results, ranking);
    
    console.log('\n\n========================================');
    console.log('✅ Phase 3 真实数据集评估完成！');
    console.log('\n💡 下一步:');
    console.log('1. 分析评估结果，确定最佳策略');
    console.log('2. 调整RRF的k参数进行优化');
    console.log('3. 添加配置文件选项');
    
  } catch (e) {
    console.error('\n❌ 错误:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
