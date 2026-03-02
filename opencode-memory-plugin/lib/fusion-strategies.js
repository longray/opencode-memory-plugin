/**
 * 搜索融合策略模块 - Phase 2 实验实现
 * 
 * 提供三种融合策略：
 * 1. 温和版乘法融合 (Soft Multiplication Fusion)
 * 2. RRF融合 (Reciprocal Rank Fusion)
 * 3. 动态权重融合 (Dynamic Weight Fusion)
 */

/**
 * 归一化分数到[0,1]范围
 * 使用min-max归一化，对长尾分布进行对数压缩
 * @param {number[]} scores - 原始分数数组
 * @returns {number[]} 归一化后的分数
 */
export function normalizeScores(scores) {
  if (scores.length === 0) return [];
  
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  
  if (max === min) {
    return scores.map(() => 0.5);
  }
  
  // 对长尾分布使用对数压缩
  // 这样可以减少极端高值的影响
  return scores.map(score => {
    // 先进行min-max归一化
    const normalized = (score - min) / (max - min);
    // 然后应用对数压缩（softmax-like）
    // 这会使高值不那么极端，低值不那么接近于0
    return Math.log1p(normalized * 9) / Math.log1p(9);
  });
}

/**
 * 实验A: 温和版乘法融合
 * 公式: final_score = w1 * norm_vector + w2 * norm_bm25 + w3 * norm_vector * norm_bm25
 * 默认权重: w1=0.5, w2=0.3, w3=0.2
 * 
 * @param {Array<{id, score, source}>} vectorResults - 向量搜索结果
 * @param {Array<{id, score, source}>} bm25Results - BM25搜索结果
 * @param {Object} options - 融合选项
 * @returns {Array<{id, score, sources}>} 融合后的结果
 */
export function softMultiplicationFusion(vectorResults, bm25Results, options = {}) {
  const {
    vectorWeight = 0.5,
    bm25Weight = 0.3,
    productWeight = 0.2,
    limit = 10
  } = options;
  
  // 创建结果映射表
  const resultMap = new Map();
  
  // 提取并归一化分数
  const vectorScores = vectorResults.map(r => r.score);
  const bm25Scores = bm25Results.map(r => r.score);
  
  const normalizedVectorScores = normalizeScores(vectorScores);
  const normalizedBm25Scores = normalizeScores(bm25Scores);
  
  // 处理向量结果
  vectorResults.forEach((result, index) => {
    resultMap.set(result.id, {
      id: result.id,
      content: result.content,
      source: result.source,
      line: result.line,
      vectorScore: result.score,
      normVectorScore: normalizedVectorScores[index],
      bm25Score: 0,
      normBm25Score: 0
    });
  });
  
  // 处理BM25结果
  bm25Results.forEach((result, index) => {
    if (resultMap.has(result.id)) {
      const existing = resultMap.get(result.id);
      existing.bm25Score = result.score;
      existing.normBm25Score = normalizedBm25Scores[index];
    } else {
      resultMap.set(result.id, {
        id: result.id,
        content: result.content,
        source: result.source,
        line: result.line,
        vectorScore: 0,
        normVectorScore: 0,
        bm25Score: result.score,
        normBm25Score: normalizedBm25Scores[index]
      });
    }
  });
  
  // 计算融合分数
  const fusedResults = Array.from(resultMap.values()).map(item => {
    const { normVectorScore, normBm25Score } = item;
    
    // 温和版乘法融合公式
    const fusionScore = 
      vectorWeight * normVectorScore +
      bm25Weight * normBm25Score +
      productWeight * normVectorScore * normBm25Score;
    
    return {
      ...item,
      score: fusionScore,
      fusionMethod: 'soft-multiplication'
    };
  });
  
  // 排序并返回top结果
  return fusedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 实验B: RRF融合 (Reciprocal Rank Fusion)
 * 公式: score = Σ 1/(k + rank)
 * 默认k=60 (文献推荐值)
 * 
 * 优点:
 * - 零样本，无需归一化
 * - 对分数分布不敏感
 * - 简单高效
 * 
 * @param {Array<{id, score, source}>} vectorResults - 向量搜索结果
 * @param {Array<{id, score, source}>} bm25Results - BM25搜索结果
 * @param {Object} options - 融合选项
 * @returns {Array<{id, score, sources}>} 融合后的结果
 */
export function rrfFusion(vectorResults, bm25Results, options = {}) {
  const {
    k = 20,  // Phase 3: 优化后的k值 (推荐20-60，越小区分度越高)
    limit = 10
  } = options;
  
  // 创建分数累加器
  // 创建分数累加器
  const scoreMap = new Map();
  
  // 处理向量结果（按排名给分）
  vectorResults.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = 1 / (k + rank);
    
    scoreMap.set(result.id, {
      id: result.id,
      content: result.content,
      source: result.source,
      line: result.line,
      vectorScore: result.score,
      bm25Score: 0,
      rrfScore: rrfScore,
      ranks: { vector: rank }
    });
  });
  
  // 处理BM25结果（按排名给分）
  bm25Results.forEach((result, index) => {
    const rank = index + 1;
    const rrfScore = 1 / (k + rank);
    
    if (scoreMap.has(result.id)) {
      const existing = scoreMap.get(result.id);
      existing.bm25Score = result.score;
      existing.rrfScore += rrfScore;  // 累加RRF分数
      existing.ranks.bm25 = rank;
    } else {
      scoreMap.set(result.id, {
        id: result.id,
        content: result.content,
        source: result.source,
        line: result.line,
        vectorScore: 0,
        bm25Score: result.score,
        rrfScore: rrfScore,
        ranks: { bm25: rank }
      });
    }
  });
  
  // 转换为数组并排序
  const fusedResults = Array.from(scoreMap.values()).map(item => ({
    ...item,
    score: item.rrfScore,
    fusionMethod: 'rrf'
  }));
  
  return fusedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 实验C: 动态权重融合
 * 根据查询特征动态调整向量/BM25权重
 * 
 * 策略:
 * - 短查询(1-2词): BM25权重较高 (0.7)
 * - 中查询(3-4词): 权重均衡 (0.5)
 * - 长查询(>4词): 向量权重较高 (0.3)
 * 
 * @param {Array<{id, score, source}>} vectorResults - 向量搜索结果
 * @param {Array<{id, score, source}>} bm25Results - BM25搜索结果
 * @param {string} query - 原始查询（用于分析查询长度）
 * @param {Object} options - 融合选项
 * @returns {Array<{id, score, sources}>} 融合后的结果
 */
export function dynamicWeightFusion(vectorResults, bm25Results, query, options = {}) {
  const { limit = 10 } = options;
  
  // 分析查询
  const queryTerms = query.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1);
  
  const termCount = queryTerms.length;
  
  // 根据查询长度确定权重
  let vectorWeight, bm25Weight, description;
  
  if (termCount <= 2) {
    // 短查询: 关键词匹配更重要
    vectorWeight = 0.3;
    bm25Weight = 0.7;
    description = 'short-query';
  } else if (termCount <= 4) {
    // 中查询: 均衡权重
    vectorWeight = 0.5;
    bm25Weight = 0.5;
    description = 'medium-query';
  } else {
    // 长查询: 语义理解更重要
    vectorWeight = 0.7;
    bm25Weight = 0.3;
    description = 'long-query';
  }
  
  // 归一化分数
  const vectorScores = vectorResults.map(r => r.score);
  const bm25Scores = bm25Results.map(r => r.score);
  
  const normalizedVectorScores = normalizeScores(vectorScores);
  const normalizedBm25Scores = normalizeScores(bm25Scores);
  
  // 创建结果映射
  const resultMap = new Map();
  
  // 处理向量结果
  vectorResults.forEach((result, index) => {
    resultMap.set(result.id, {
      id: result.id,
      content: result.content,
      source: result.source,
      line: result.line,
      vectorScore: result.score,
      normVectorScore: normalizedVectorScores[index],
      bm25Score: 0,
      normBm25Score: 0
    });
  });
  
  // 处理BM25结果
  bm25Results.forEach((result, index) => {
    if (resultMap.has(result.id)) {
      const existing = resultMap.get(result.id);
      existing.bm25Score = result.score;
      existing.normBm25Score = normalizedBm25Scores[index];
    } else {
      resultMap.set(result.id, {
        id: result.id,
        content: result.content,
        source: result.source,
        line: result.line,
        vectorScore: 0,
        normVectorScore: 0,
        bm25Score: result.score,
        normBm25Score: normalizedBm25Scores[index]
      });
    }
  });
  
  // 计算动态权重融合分数
  const fusedResults = Array.from(resultMap.values()).map(item => {
    const { normVectorScore, normBm25Score } = item;
    
    // 动态权重融合
    const fusionScore = 
      vectorWeight * normVectorScore +
      bm25Weight * normBm25Score;
    
    return {
      ...item,
      score: fusionScore,
      fusionMethod: 'dynamic-weight',
      queryType: description,
      weights: { vector: vectorWeight, bm25: bm25Weight }
    };
  });
  
  return fusedResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 通用融合接口
 * 根据策略名称调用相应的融合方法
 */
export function fuseResults(strategy, vectorResults, bm25Results, query, options = {}) {
  switch (strategy) {
    case 'soft-multiplication':
      return softMultiplicationFusion(vectorResults, bm25Results, options);
    case 'rrf':
      return rrfFusion(vectorResults, bm25Results, options);
    case 'dynamic':
      return dynamicWeightFusion(vectorResults, bm25Results, query, options);
    default:
      throw new Error(`Unknown fusion strategy: ${strategy}`);
  }
}

/**
 * 获取可用融合策略列表
 */
export function getAvailableStrategies() {
  return [
    {
      name: 'soft-multiplication',
      description: '温和版乘法融合: 0.5*v + 0.3*bm25 + 0.2*v*bm25',
      pros: ['平衡了加法和乘法', '减少极端值影响'],
      cons: ['需要归一化', '对长尾分布仍敏感']
    },
    {
      name: 'rrf',
      description: 'RRF融合: 基于排名的倒数融合',
      pros: ['零样本，无需归一化', '对分数分布不敏感', '简单高效'],
      cons: ['丢失原始分数信息', '对平局处理简单']
    },
    {
      name: 'dynamic',
      description: '动态权重: 根据查询长度调整权重',
      pros: ['自适应不同查询类型', '短查询重BM25，长查询重向量'],
      cons: ['需要归一化', '权重规则需要调优']
    }
  ];
}

export default {
  softMultiplicationFusion,
  rrfFusion,
  dynamicWeightFusion,
  fuseResults,
  normalizeScores,
  getAvailableStrategies
};
