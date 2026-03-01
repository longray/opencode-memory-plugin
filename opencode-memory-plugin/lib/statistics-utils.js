/**
 * 统计工具模块
 * 提供统计指标计算和分数分布分析功能
 */

/**
 * 计算数组的平均值
 * @param {number[]} arr - 数值数组
 * @returns {number} 平均值
 */
export function calculateMean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * 计算数组的中位数
 * @param {number[]} arr - 数值数组
 * @returns {number} 中位数
 */
export function calculateMedian(arr) {
  if (arr.length === 0) return 0;

  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * 计算百分位数
 * @param {number[]} arr - 数值数组
 * @param {number} percentile - 百分位数 (0-100)
 * @returns {number} 百分位数值
 */
export function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }

  const sorted = [...arr].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);

  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (upper === lower) {
    return sorted[lower];
  }

  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

/**
 * 计算标准差
 * @param {number[]} arr - 数值数组
 * @returns {number} 标准差
 */
export function calculateStdDev(arr) {
  if (arr.length === 0) return 0;

  const mean = calculateMean(arr);
  const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
  const variance = calculateMean(squaredDiffs);

  return Math.sqrt(variance);
}

/**
 * 计算众数
 * @param {number[]} arr - 数值数组
 * @returns {number} 众数
 */
export function calculateMode(arr) {
  if (arr.length === 0) return 0;

  const frequency = {};
  let maxFreq = 0;
  let mode = arr[0];

  for (const val of arr) {
    frequency[val] = (frequency[val] || 0) + 1;
    if (frequency[val] > maxFreq) {
      maxFreq = frequency[val];
      mode = val;
    }
  }

  return mode;
}

/**
 * 计算分数分布统计
 * @param {number[]} scores - 分数数组
 * @returns {Object} 统计对象
 */
export function calculateScoreDistribution(scores) {
  if (scores.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      mode: 0,
      percentiles: {
        25: 0,
        50: 0,
        75: 0,
        90: 0,
        95: 0,
        99: 0,
      },
      histogram: {},
    };
  }

  return {
    count: scores.length,
    min: Math.min(...scores),
    max: Math.max(...scores),
    mean: calculateMean(scores),
    median: calculateMedian(scores),
    stdDev: calculateStdDev(scores),
    mode: calculateMode(scores),
    percentiles: {
      25: calculatePercentile(scores, 25),
      50: calculatePercentile(scores, 50),
      75: calculatePercentile(scores, 75),
      90: calculatePercentile(scores, 90),
      95: calculatePercentile(scores, 95),
      99: calculatePercentile(scores, 99),
    },
    // 生成简单的直方图（10个bin）
    histogram: generateHistogram(scores, 10),
  };
}

/**
 * 生成直方图
 * @param {number[]} scores - 分数数组
 * @param {number} bins - bin数量
 * @returns {Object} 直方图数据
 */
export function generateHistogram(scores, bins = 10) {
  if (scores.length === 0) return {};

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  const binSize = range / bins;

  const histogram = {};
  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binSize;
    const binEnd = binStart + binSize;
    const binLabel = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;

    const count = scores.filter(
      s => s >= binStart && (s < binEnd || (i === bins - 1 && s <= binEnd))
    ).length;
    histogram[binLabel] = count;
  }

  return histogram;
}

/**
 * 生成文本报告
 * @param {Object} dist - 分数分布统计对象
 * @returns {string} 文本报告
 */
export function generateDistributionReport(dist, label = 'BM25分数') {
  const report = [
    `📊 ${label}分布报告`,
    '========================================',
    '',
    `📈 基础统计:`,
    `   样本数: ${dist.count}`,
    `   最小值: ${dist.min.toFixed(4)}`,
    `   最大值: ${dist.max.toFixed(4)}`,
    `   平均值: ${dist.mean.toFixed(4)}`,
    `   中位数: ${dist.median.toFixed(4)}`,
    `   标准差: ${dist.stdDev.toFixed(4)}`,
    '   众数: ${dist.mode.toFixed(4)}',
    '',
    '📊 百分位数:',
    `   P25: ${dist.percentiles[25].toFixed(4)}`,
    `   P50: ${dist.percentiles[50].toFixed(4)}`,
    '   P75: ' + dist.percentiles[75].toFixed(4),
    `   P90: ${dist.percentiles[90].toFixed(4)}`,
    `   P95: ${dist.percentiles[95].toFixed(4)}`,
    `   P99: ${dist.percentiles[99].toFixed(4)}`,
    '',
    '📊 直方图 (10 bins):',
  ];

  const histogramLines = Object.entries(dist.histogram).map(([range, count]) => {
    const bar = '█'.repeat(Math.min(count * 2, 50));
    return `   [${range}]: ${count.toString().padStart(4)} ${bar}`;
  });

  return report.concat(histogramLines).join('\n');
}

/**
 * 判断是否为长尾分布
 * @param {Object} dist - 分数分布统计对象
 * @returns {boolean} 是否为长尾分布
 */
export function isLongTailedDistribution(dist) {
  if (dist.count === 0) return false;

  // 长尾分布的特征：
  // 1. 平均值显著大于中位数（平均被高值拉高）
  // 2. P90远大于P75
  // 3. P99远大于P95

  const meanToMedian = dist.mean / dist.median;
  const p90ToP75 = dist.percentiles[90] / dist.percentiles[75];
  const p99ToP95 = dist.percentiles[99] / dist.percentiles[95];

  // 如果平均值比中位数大50%以上，判定为长尾
  return meanToMedian > 1.5 && (p90ToP75 > 1.2 || p99ToP95 > 1.2);
}

/**
 * 识别异常值
 * @param {number[]} scores - 分数数组
 * @param {number} threshold - 标准差倍数阈值（默认3）
 * @returns {Object[]} 异常值列表
 */
export function identifyOutliers(scores, threshold = 3) {
  if (scores.length === 0) return [];

  const mean = calculateMean(scores);
  const stdDev = calculateStdDev(scores);
  const lower = mean - threshold * stdDev;
  const upper = mean + threshold * stdDev;

  return scores
    .map((score, index) => ({ score, index }))
    .filter(({ score }) => score < lower || score > upper);
}

export default {
  calculateMean,
  calculateMedian,
  calculatePercentile,
  calculateStdDev,
  calculateMode,
  calculateScoreDistribution,
  generateHistogram,
  generateDistributionReport,
  isLongTailedDistribution,
  identifyOutliers,
};
