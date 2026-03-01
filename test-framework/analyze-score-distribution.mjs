#!/usr/bin/env node
/**
 * BM25和向量检索分数分布分析
 * 用于验证理论假设和实际数据的对比
 */

import labeledDataset from './labeled-dataset.mjs';

/**
 * 支持中文的分词方法
 */
function tokenizeChinese(text) {
  const lowerText = text.toLowerCase();
  
  // 按空格分割（处理英文）
  const spaceSplit = lowerText.replace(/[^\w\u4e00-\u9fa5\s]/g, ' ').split(/\s+/);
  
  const tokens = [];
  
  for (const part of spaceSplit) {
    if (!part || part.trim() === '') continue;
    
    // 检查是否包含中文
    const hasChinese = /[\u4e00-\u9fa5]/.test(part);
    
    if (hasChinese) {
      // 中文部分：按字符切分，保留2字以上词组
      const chineseWords = part.match(/[\u4e00-\u9fa5]{2,}/g) || [];
      const singleChars = part.match(/[\u4e00-\u9fa5]/g) || [];
      
      tokens.push(...chineseWords);
      tokens.push(...singleChars);
      
      // 同时保留混合的英文部分
      const englishParts = part.match(/[a-z0-9]+/g) || [];
      tokens.push(...englishParts.filter(w => w.length > 1));
    } else {
      // 纯英文部分
      if (part.length > 1) {
        tokens.push(part);
      }
    }
  }
  
  return tokens;
}

/**
 * 支持中文的BM25索引类
 */
class ChineseBM25Index {
  constructor() {
    this.documents = new Map();
    this.docCount = 0;
    this.avgDocLength = 0;
    this.termDocFreq = new Map();
    this.totalDocLengths = 0;
  }
  
  tokenize(text) {
    return tokenizeChinese(text);
  }
  
  addDocument(id, content, metadata = {}) {
    const tokens = this.tokenize(content);
    const termFreq = new Map();
    
    for (const term of tokens) {
      termFreq.set(term, (termFreq.get(term) || 0) + 1);
    }
    
    for (const term of termFreq.keys()) {
      this.termDocFreq.set(term, (this.termDocFreq.get(term) || 0) + 1);
    }
    
    const doc = {
      id,
      content,
      tokens,
      length: tokens.length,
      termFreq,
      metadata
    };
    
    this.documents.set(id, doc);
    this.docCount++;
    this.totalDocLengths += tokens.length;
    this.avgDocLength = this.totalDocLengths / this.docCount;
  }
  
  calculateIDF(term) {
    const n = this.termDocFreq.get(term) || 0;
    const N = this.docCount;
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }
  
  calculateBM25Score(doc, queryTerms, k1 = 1.2, b = 0.75) {
    let score = 0;
    const docLength = doc.length;
    const avgdl = this.avgDocLength || 1;
    
    for (const term of queryTerms) {
      const tf = doc.termFreq.get(term) || 0;
      if (tf === 0) continue;
      
      const idf = this.calculateIDF(term);
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / avgdl));
      
      score += idf * (numerator / denominator);
    }
    
    return score;
  }
  
  search(query, options = {}) {
    const { limit = 10, minScore = 0.01 } = options;
    const queryTerms = this.tokenize(query);
    
    if (queryTerms.length === 0) {
      return [];
    }
    
    const results = [];
    
    for (const [id, doc] of this.documents) {
      const score = this.calculateBM25Score(doc, queryTerms);
      
      if (score >= minScore) {
        results.push({
          id: doc.id,
          score,
          content: doc.content,
          metadata: doc.metadata
        });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  getStats() {
    return {
      documentCount: this.docCount,
      averageDocumentLength: Math.round(this.avgDocLength * 100) / 100,
      uniqueTerms: this.termDocFreq.size,
      totalTokens: this.totalDocLengths
    };
  }
}

console.log('📊 BM25和向量检索分数分布分析\n' + '='.repeat(60));

// ==================== 1. BM25分数分布分析 ====================
console.log('\n## 1. BM25分数分布分析\n');

const bm25 = new ChineseBM25Index();

// 加载测试文档
labeledDataset.documents.forEach(doc => {
  bm25.addDocument(doc.id, doc.content, { tags: doc.tags });
});

console.log(`📚 已索引 ${labeledDataset.documents.length} 条文档`);
const stats = bm25.getStats();
console.log(`   平均文档长度: ${stats.averageDocumentLength} tokens`);
console.log(`   唯一术语数: ${stats.uniqueTerms}`);

// 分析不同查询的BM25分数分布
const testQueries = [
  { query: 'TypeScript', desc: '精确匹配' },
  { query: '类型检查', desc: '中文关键词' },
  { query: '数据库', desc: '常见词' },
  { query: 'PostgreSQL', desc: '专有名词' },
  { query: '缓存策略', desc: '组合词' },
  { query: '并发编程', desc: '抽象概念' },
  { query: 'xyz不存在', desc: '无匹配' },
];

console.log('\n### BM25分数分布详情:\n');

const allBm25Scores = [];

for (const { query, desc } of testQueries) {
  const results = bm25.search(query, { limit: 50, minScore: 0.01 });
  
  // 收集所有分数（包括0分）
  const scoresWithZero = [];
  for (let i = 1; i <= labeledDataset.documents.length; i++) {
    const found = results.find(r => r.id === i);
    scoresWithZero.push(found ? found.score : 0);
  }
  
  const nonZeroScores = scoresWithZero.filter(s => s > 0);
  allBm25Scores.push(...nonZeroScores);
  
  // 统计分析
  const max = Math.max(...scoresWithZero);
  const min = nonZeroScores.length > 0 ? Math.min(...nonZeroScores) : 0;
  const avg = nonZeroScores.length > 0 
    ? nonZeroScores.reduce((a, b) => a + b, 0) / nonZeroScores.length 
    : 0;
  const variance = nonZeroScores.length > 0
    ? nonZeroScores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / nonZeroScores.length
    : 0;
  const stdDev = Math.sqrt(variance);
  
  // 分数分布区间
  const ranges = {
    '0 (无匹配)': scoresWithZero.filter(s => s === 0).length,
    '0-1': scoresWithZero.filter(s => s > 0 && s <= 1).length,
    '1-2': scoresWithZero.filter(s => s > 1 && s <= 2).length,
    '2-3': scoresWithZero.filter(s => s > 2 && s <= 3).length,
    '3-4': scoresWithZero.filter(s => s > 3 && s <= 4).length,
    '4-5': scoresWithZero.filter(s => s > 4 && s <= 5).length,
    '>5': scoresWithZero.filter(s => s > 5).length,
  };
  
  console.log(`\n📌 查询: "${query}" (${desc})`);
  console.log(`   分词结果: [${bm25.tokenize(query).map(t => `"${t}"`).join(', ')}]`);
  console.log(`   非零分数数量: ${nonZeroScores.length}/${labeledDataset.documents.length}`);
  console.log(`   最大值: ${max.toFixed(3)}, 最小值(非零): ${min.toFixed(3)}`);
  console.log(`   平均值: ${avg.toFixed(3)}, 标准差: ${stdDev.toFixed(3)}`);
  console.log(`   分数分布: ${JSON.stringify(ranges)}`);
  
  // 显示前5个结果
  if (results.length > 0) {
    console.log(`   Top 5 结果:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`      ${i + 1}. [ID:${r.id}] Score: ${r.score.toFixed(3)} - ${r.content.substring(0, 40)}...`);
    });
  }
}

// ==================== 2. BM25理论分布特性 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 2. BM25理论分布特性分析\n');

if (allBm25Scores.length > 0) {
  // 计算整体分数分布
  const overallMax = Math.max(...allBm25Scores);
  const overallMin = Math.min(...allBm25Scores);
  const overallAvg = allBm25Scores.reduce((a, b) => a + b, 0) / allBm25Scores.length;

  // 长尾分析：前10%的分数占比
  const sortedScores = [...allBm25Scores].sort((a, b) => b - a);
  const top10Percent = Math.ceil(sortedScores.length * 0.1);
  const top10Sum = sortedScores.slice(0, top10Percent).reduce((a, b) => a + b, 0);
  const totalSum = sortedScores.reduce((a, b) => a + b, 0);
  const top10Ratio = top10Sum / totalSum;

  console.log('### BM25分数长尾特性:\n');
  console.log(`   总分数数: ${allBm25Scores.length}`);
  console.log(`   最大值: ${overallMax.toFixed(3)}, 最小值: ${overallMin.toFixed(3)}`);
  console.log(`   平均值: ${overallAvg.toFixed(3)}`);
  console.log(`   前10%分数占总分比例: ${(top10Ratio * 100).toFixed(1)}%`);
  console.log(`   长尾特性: ${top10Ratio > 0.5 ? '明显（>50%集中在头部）' : '不明显'}`);

  // 零值比例
  const zeroCount = labeledDataset.documents.length * testQueries.length - allBm25Scores.length;
  const zeroRatio = zeroCount / (labeledDataset.documents.length * testQueries.length);
  console.log(`\n### 零值传播分析:\n`);
  console.log(`   零分文档数: ${zeroCount}`);
  console.log(`   零分比例: ${(zeroRatio * 100).toFixed(1)}%`);
  
  // ==================== 4. 归一化影响分析 ====================
  console.log('\n\n' + '='.repeat(60));
  console.log('\n## 4. 归一化对分数分布的影响\n');

  // BM25归一化（除以最大值）
  const normalizedBm25 = allBm25Scores.map(s => s / overallMax);

  // 对比归一化前后
  console.log('### BM25归一化前后对比:\n');
  console.log(`   原始范围: [${overallMin.toFixed(3)}, ${overallMax.toFixed(3)}]`);
  console.log(`   归一化范围: [${(overallMin / overallMax).toFixed(3)}, 1.000]`);
  console.log(`   归一化后平均值: ${(overallAvg / overallMax).toFixed(3)}`);

  // 归一化后的分布区间
  const normalizedRanges = {
    '0': normalizedBm25.filter(s => s === 0).length,
    '0-0.2': normalizedBm25.filter(s => s > 0 && s <= 0.2).length,
    '0.2-0.4': normalizedBm25.filter(s => s > 0.2 && s <= 0.4).length,
    '0.4-0.6': normalizedBm25.filter(s => s > 0.4 && s <= 0.6).length,
    '0.6-0.8': normalizedBm25.filter(s => s > 0.6 && s <= 0.8).length,
    '0.8-1.0': normalizedBm25.filter(s => s > 0.8 && s <= 1.0).length,
  };

  console.log(`\n   归一化后分布区间:`);
  Object.entries(normalizedRanges).forEach(([range, count]) => {
    const percentage = (count / normalizedBm25.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / normalizedBm25.length * 50));
    console.log(`   ${range.padEnd(8)}: ${count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
  });
}

// ==================== 3. 向量相似度理论分布 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 3. 向量相似度分布特性分析\n');

console.log('### 向量相似度理论特性:\n');
console.log('   - 余弦相似度范围: [-1, 1]，实际通常 [0, 1]');
console.log('   - 分布特性: 相对稠密，很少出现极端值');
console.log('   - 典型分布: 大多数相似度集中在 0.3-0.8 区间');
console.log('   - 零值: 几乎不存在（正交向量很少）');

// 模拟向量相似度分布（假设使用真实embedding）
const simulatedVectorScores = [];
for (let i = 0; i < 1000; i++) {
  // 模拟余弦相似度分布（Beta分布近似）
  const u1 = Math.random();
  const u2 = Math.random();
  // 使用Beta(2,5)分布模拟，产生偏向0.3-0.6的分布
  const beta = Math.pow(u1, 1/2) * Math.pow(1 - u1, 5);
  const score = 0.3 + 0.5 * beta; // 映射到0.3-0.8区间
  simulatedVectorScores.push(score);
}

const vectorAvg = simulatedVectorScores.reduce((a, b) => a + b, 0) / simulatedVectorScores.length;
const vectorMin = Math.min(...simulatedVectorScores);
const vectorMax = Math.max(...simulatedVectorScores);
const vectorVariance = simulatedVectorScores.reduce((sum, s) => sum + Math.pow(s - vectorAvg, 2), 0) / simulatedVectorScores.length;
const vectorStdDev = Math.sqrt(vectorVariance);

console.log(`\n### 模拟向量相似度分布:\n`);
console.log(`   范围: [${vectorMin.toFixed(3)}, ${vectorMax.toFixed(3)}]`);
console.log(`   平均值: ${vectorAvg.toFixed(3)}`);
console.log(`   标准差: ${vectorStdDev.toFixed(3)}`);
console.log(`   分布类型: 相对稠密，无明显长尾`);

// ==================== 5. 乘法融合问题分析 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 5. 乘法融合数学问题分析\n');

// 模拟当前融合方式
console.log('### 当前融合方式: 0.7 × vector + 0.3 × bm25_normalized\n');

// 模拟一个具体案例
const exampleCase = [
  { id: 1, vector: 0.85, bm25Raw: 4.2, desc: '高度相关，BM25高分' },
  { id: 2, vector: 0.82, bm25Raw: 0.8, desc: '语义相关，BM25低分' },
  { id: 3, vector: 0.75, bm25Raw: 3.8, desc: '中等相关，BM25高分' },
  { id: 4, vector: 0.72, bm25Raw: 0, desc: '语义相关，BM25无匹配' },
  { id: 5, vector: 0.45, bm25Raw: 5.0, desc: '低语义相关，BM25最高分' },
];

const maxBm25Example = 5.0;

console.log('\n示例数据分析:\n');
console.log('ID | Vector | BM25原始 | BM25归一化 | 加权融合 | 排序');
console.log('-'.repeat(70));

const fusionResults = exampleCase.map(item => {
  const bm25Norm = item.bm25Raw / maxBm25Example;
  const fusion = 0.7 * item.vector + 0.3 * bm25Norm;
  return { ...item, bm25Norm, fusion };
}).sort((a, b) => b.fusion - a.fusion);

fusionResults.forEach((item, i) => {
  console.log(`${item.id}  | ${item.vector.toFixed(2)}  | ${item.bm25Raw.toFixed(2).padStart(6)}  | ${item.bm25Norm.toFixed(3).padStart(8)}  | ${item.fusion.toFixed(3).padStart(7)}  | ${i + 1}`);
});

console.log('\n分析:');
console.log('   - ID 4: BM25=0导致归一化后为0，加权融合后严重受损');
console.log('   - ID 5: 低向量分数但高BM25，归一化后BM25优势被放大');
console.log('   - 问题: 归一化使BM25分数的区分度降低');

// ==================== 6. 乘法融合问题 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 6. 乘法融合的问题（score_vector × score_bm25）\n');

console.log('### 问题1: 零值传播\n');
console.log('   当BM25分数为0时：');
console.log('   - 乘法融合: vector × 0 = 0 (完全抹杀向量分数)');
console.log('   - 加法融合: 0.7 × vector + 0.3 × 0 = 0.7 × vector (保留向量贡献)');
console.log('   结论: 乘法融合对零值极度敏感');

console.log('\n### 问题2: 归一化后的"浪费"现象\n');
console.log('   BM25原始分数范围: [0, 5+]');
console.log('   归一化后范围: [0, 1]');
console.log('   问题: 高BM25分数(如4.5)归一化后变为0.9');
console.log('   与低BM25分数(如0.5)归一化后变为0.1差距缩小');

console.log('\n### 问题3: 幂次效应\n');
console.log('   乘法融合: vector² × bm25² (如果两边都用幂)');
console.log('   效果: 进一步放大差异，加剧长尾');
console.log('   风险: 低分文档被进一步压制');

// ==================== 7. 温和版融合方案 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 7. 温和版融合方案设计\n');

console.log('### 方案1: 加法+乘法混合\n');
console.log('   公式: α × vector + β × bm25_norm + γ × vector × bm25_norm');
console.log('   参数建议: α=0.5, β=0.3, γ=0.2');
console.log('   优点: 同时享受加法稳定性和乘法协同效应');

console.log('\n### 方案2: 指数平滑\n');
console.log('   公式: α × vector + β × log(1 + bm25_norm)');
console.log('   优点: 对BM25高分进行压缩，减少长尾影响');

console.log('\n### 方案3: 动态权重\n');
console.log('   根据BM25分数动态调整权重:');
console.log('   - bm25=0: 100%向量权重');
console.log('   - bm25>0: 按比例混合');
console.log('   公式: (1 - bm25_norm) × vector + bm25_norm × (α×vector + β×bm25_norm)');

console.log('\n### 方案4: RRF (Reciprocal Rank Fusion)\n');
console.log('   公式: 1/(k + rank_vector) + 1/(k + rank_bm25)');
console.log('   参数: k=60 (经典值)');
console.log('   优点: 不依赖分数绝对值，只依赖排序');

// 测试不同融合方案
console.log('\n### 融合方案效果对比:\n');

const testItems = [
  { id: 1, vector: 0.85, bm25Norm: 0.84, desc: '双高' },
  { id: 2, vector: 0.82, bm25Norm: 0.16, desc: '向量高BM25低' },
  { id: 3, vector: 0.75, bm25Norm: 0.76, desc: '中等' },
  { id: 4, vector: 0.72, bm25Norm: 0, desc: 'BM25无匹配' },
  { id: 5, vector: 0.45, bm25Norm: 1.0, desc: 'BM25高向量低' },
];

const fusionMethods = {
  '当前加法': (v, b) => 0.7 * v + 0.3 * b,
  '混合融合': (v, b) => 0.5 * v + 0.3 * b + 0.2 * v * b,
  '指数平滑': (v, b) => 0.7 * v + 0.3 * Math.log(1 + b * 5) / Math.log(6),
  '乘法融合': (v, b) => v * (0.5 + 0.5 * b),
};

Object.entries(fusionMethods).forEach(([name, formula]) => {
  console.log(`\n${name}:`);
  const results = testItems.map(item => ({
    ...item,
    score: formula(item.vector, item.bm25Norm)
  })).sort((a, b) => b.score - a.score);
  
  results.forEach((item, i) => {
    console.log(`   ${i + 1}. ID:${item.id} Score:${item.score.toFixed(3)} (${item.desc})`);
  });
});

// ==================== 8. 推荐方案 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 8. 最终推荐方案\n');

console.log('### 推荐: 加法融合 + 指数平滑\n');
console.log('```javascript');
console.log('function hybridScore(vectorScore, bm25Score, maxBm25) {');
console.log('  // 归一化BM25');
console.log('  const bm25Norm = bm25Score / maxBm25;');
console.log('  ');
console.log('  // 指数平滑处理BM25（压缩高分，拉伸低分）');
console.log('  const bm25Smoothed = Math.log(1 + bm25Norm * 3) / Math.log(4);');
console.log('  ');
console.log('  // 加法融合');
console.log('  return 0.65 * vectorScore + 0.35 * bm25Smoothed;');
console.log('}');
console.log('```\n');

console.log('优点:');
console.log('   1. 避免零值传播问题');
console.log('   2. 压缩BM25长尾分布');
console.log('   3. 保持分数区分度');
console.log('   4. 计算简单高效');

// ==================== 9. 实际数据验证 ====================
console.log('\n\n' + '='.repeat(60));
console.log('\n## 9. 实际BM25分数数据验证\n');

// 使用更多样化的查询来验证BM25分数分布
const detailedQueries = [
  'TypeScript',
  '类型检查',
  '数据库',
  'PostgreSQL',
  '缓存',
  'Redis',
  'API设计',
  '认证',
  '错误处理',
  '测试',
];

console.log('\n### 各查询的BM25分数统计:\n');

let allScores = [];
let scoreByQuery = [];

for (const query of detailedQueries) {
  const results = bm25.search(query, { limit: 50, minScore: 0.01 });
  const scores = results.map(r => r.score);
  allScores.push(...scores);
  
  scoreByQuery.push({
    query,
    count: scores.length,
    max: scores.length > 0 ? Math.max(...scores) : 0,
    min: scores.length > 0 ? Math.min(...scores) : 0,
    avg: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
  });
}

// 打印表格
console.log('查询          | 匹配数 | 最大值 | 最小值 | 平均值');
console.log('-'.repeat(60));
scoreByQuery.forEach(q => {
  console.log(`${q.query.padEnd(12)} | ${q.count.toString().padStart(4)} | ${q.max.toFixed(3).padStart(6)} | ${q.min.toFixed(3).padStart(6)} | ${q.avg.toFixed(3).padStart(6)}`);
});

if (allScores.length > 0) {
  // 整体统计
  const overallMax = Math.max(...allScores);
  const overallMin = Math.min(...allScores);
  const overallAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  
  // 分位数
  const sorted = [...allScores].sort((a, b) => a - b);
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  
  console.log('\n### 整体BM25分数分布:\n');
  console.log(`   分数总数: ${allScores.length}`);
  console.log(`   范围: [${overallMin.toFixed(3)}, ${overallMax.toFixed(3)}]`);
  console.log(`   平均值: ${overallAvg.toFixed(3)}`);
  console.log(`   P25: ${p25.toFixed(3)}, P50: ${p50.toFixed(3)}, P75: ${p75.toFixed(3)}, P90: ${p90.toFixed(3)}`);
  
  // 分布直方图
  console.log('\n### 分数分布直方图:\n');
  const histogram = {
    '0-1': allScores.filter(s => s > 0 && s <= 1).length,
    '1-2': allScores.filter(s => s > 1 && s <= 2).length,
    '2-3': allScores.filter(s => s > 2 && s <= 3).length,
    '3-4': allScores.filter(s => s > 3 && s <= 4).length,
    '4-5': allScores.filter(s => s > 4 && s <= 5).length,
    '>5': allScores.filter(s => s > 5).length,
  };
  
  Object.entries(histogram).forEach(([range, count]) => {
    const percentage = (count / allScores.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / allScores.length * 40));
    console.log(`   ${range.padEnd(5)}: ${count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('\n✅ 分析完成！');