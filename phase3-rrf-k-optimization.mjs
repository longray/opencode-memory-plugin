/**
 * Phase 3 RRF k参数优化扫描
 * 寻找最优的k值参数
 */

import { rrfFusion } from './opencode-memory-plugin/lib/fusion-strategies.js';
import { createBM25Index } from './opencode-memory-plugin/lib/bm25.js';
import fs from 'fs';
import path from 'path';

console.log('🔬 Phase 3 RRF k参数优化');
console.log('========================================\n');

// 模拟搜索结果（用于参数扫描）
const mockVectorResults = [
  { id: '1', score: 0.95, source: 'doc1.md', content: 'Content A' },
  { id: '2', score: 0.88, source: 'doc2.md', content: 'Content B' },
  { id: '3', score: 0.82, source: 'doc3.md', content: 'Content C' },
  { id: '4', score: 0.76, source: 'doc4.md', content: 'Content D' },
  { id: '5', score: 0.71, source: 'doc5.md', content: 'Content E' },
  { id: '6', score: 0.65, source: 'doc6.md', content: 'Content F' },
  { id: '7', score: 0.60, source: 'doc7.md', content: 'Content G' },
  { id: '8', score: 0.55, source: 'doc8.md', content: 'Content H' },
  { id: '9', score: 0.50, source: 'doc9.md', content: 'Content I' },
  { id: '10', score: 0.45, source: 'doc10.md', content: 'Content J' }
];

const mockBM25Results = [
  { id: '3', score: 2.5, source: 'doc3.md', content: 'Content C' },
  { id: '1', score: 2.1, source: 'doc1.md', content: 'Content A' },
  { id: '5', score: 1.8, source: 'doc5.md', content: 'Content E' },
  { id: '7', score: 1.5, source: 'doc7.md', content: 'Content G' },
  { id: '2', score: 1.2, source: 'doc2.md', content: 'Content B' },
  { id: '9', score: 0.9, source: 'doc9.md', content: 'Content I' },
  { id: '4', score: 0.7, source: 'doc4.md', content: 'Content D' },
  { id: '6', score: 0.5, source: 'doc6.md', content: 'Content F' },
  { id: '8', score: 0.3, source: 'doc8.md', content: 'Content H' },
  { id: '11', score: 0.1, source: 'doc11.md', content: 'Content K' }  // 只在BM25中出现
];

// 测试不同k值
const kValues = [20, 30, 40, 50, 60, 70, 80, 100, 120, 150, 200];

// 评估指标
function evaluateK(k) {
  const results = rrfFusion(mockVectorResults, mockBM25Results, { limit: 10, k });
  
  // 分析结果多样性
  const vectorTopIds = new Set(mockVectorResults.slice(0, 5).map(r => r.id));
  const bm25TopIds = new Set(mockBM25Results.slice(0, 5).map(r => r.id));
  
  let vectorInTop = 0;
  let bm25InTop = 0;
  let bothInTop = 0;
  
  results.slice(0, 5).forEach(r => {
    const inVector = vectorTopIds.has(r.id);
    const inBM25 = bm25TopIds.has(r.id);
    
    if (inVector) vectorInTop++;
    if (inBM25) bm25InTop++;
    if (inVector && inBM25) bothInTop++;
  });
  
  // 计算分数分布
  const scores = results.map(r => r.score);
  const scoreRange = Math.max(...scores) - Math.min(...scores);
  const scoreVariance = scores.reduce((sum, s) => sum + Math.pow(s - scores[0], 2), 0) / scores.length;
  
  return {
    k,
    results,
    top5Analysis: {
      vectorInTop,
      bm25InTop,
      bothInTop,
      uniqueDocs: results.slice(0, 5).length
    },
    scoreDistribution: {
      range: scoreRange,
      variance: scoreVariance,
      topScore: scores[0],
      minScore: scores[scores.length - 1]
    }
  };
}

// 运行扫描
console.log('📊 扫描k值范围:', kValues.join(', '));
console.log('─'.repeat(70));

const scanResults = kValues.map(k => {
  process.stdout.write(`  测试 k=${k}... `);
  const result = evaluateK(k);
  console.log('✓');
  return result;
});

// 分析结果
console.log('\n\n📈 结果分析');
console.log('========================================\n');

console.log('1️⃣  Top-5结果来源分析');
console.log('─'.repeat(70));
console.log('  k值    | 来自向量 | 来自BM25 | 两者都有 | 独特文档');
console.log('  ───────┼──────────┼──────────┼──────────┼──────────');

scanResults.forEach(r => {
  const { k, top5Analysis } = r;
  console.log(
    `  ${k.toString().padEnd(6)} | ` +
    `${top5Analysis.vectorInTop.toString().padEnd(8)} | ` +
    `${top5Analysis.bm25InTop.toString().padEnd(8)} | ` +
    `${top5Analysis.bothInTop.toString().padEnd(8)} | ` +
    `${top5Analysis.uniqueDocs.toString().padEnd(8)}`
  );
});

console.log('\n\n2️⃣  分数分布分析');
console.log('─'.repeat(70));
console.log('  k值    | 分数范围  | 方差     | 最高分   | 最低分');
console.log('  ───────┼───────────┼──────────┼──────────┼──────────');

scanResults.forEach(r => {
  const { k, scoreDistribution } = r;
  console.log(
    `  ${k.toString().padEnd(6)} | ` +
    `${scoreDistribution.range.toFixed(4).padEnd(9)} | ` +
    `${scoreDistribution.variance.toFixed(6).padEnd(8)} | ` +
    `${scoreDistribution.topScore.toFixed(4).padEnd(8)} | ` +
    `${scoreDistribution.minScore.toFixed(4).padEnd(8)}`
  );
});

// 推荐k值
console.log('\n\n3️⃣  k值推荐');
console.log('─'.repeat(70));

// 计算综合得分
const scored = scanResults.map(r => {
  // 我们希望：
  // 1. 多样性高（两者都有越多越好）
  // 2. 分数分布合理（不要太极端）
  // 3. 方差适中（能区分排名）
  
  const diversityScore = r.top5Analysis.bothInTop / 5; // 0-1
  const balanceScore = Math.min(r.top5Analysis.vectorInTop, r.top5Analysis.bm25InTop) / 5; // 0-1
  const distributionScore = r.scoreDistribution.range > 0.01 ? 1 : 0; // 有区分度
  
  const totalScore = diversityScore * 0.4 + balanceScore * 0.4 + distributionScore * 0.2;
  
  return {
    k: r.k,
    score: totalScore,
    diversity: diversityScore,
    balance: balanceScore,
    details: r
  };
});

scored.sort((a, b) => b.score - a.score);

console.log('\n  排名 | k值  | 综合得分 | 多样性 | 平衡性');
console.log('  ─────┼──────┼──────────┼────────┼────────');

scored.forEach((s, index) => {
  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
  console.log(
    `  ${medal} ${(index + 1).toString().padEnd(2)}   | ` +
    `${s.k.toString().padEnd(4)} | ` +
    `${s.score.toFixed(3).padEnd(8)} | ` +
    `${(s.diversity * 100).toFixed(0)}%    | ` +
    `${(s.balance * 100).toFixed(0)}%`
  );
});

console.log(`\n  💡 推荐k值: ${scored[0].k} (得分: ${scored[0].score.toFixed(3)})`);

// 保存结果
const outputDir = path.join(process.cwd(), 'phase3-evaluation');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = path.join(outputDir, `rrf-k-optimization-${timestamp}.json`);

fs.writeFileSync(outputFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  kValues,
  scanResults,
  recommendation: {
    bestK: scored[0].k,
    score: scored[0].score,
    reason: 'Best balance between diversity and distribution'
  }
}, null, 2));

console.log(`\n💾 结果已保存: ${outputFile}`);

console.log('\n========================================');
console.log('✅ Phase 3 RRF k参数优化完成！');
console.log(`\n📝 建议: 将默认k值从60改为${scored[0].k}`);
