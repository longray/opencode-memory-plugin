/**
 * Phase 1 数据收集和分析脚本
 * 收集真实查询的分数分布数据并生成分析报告
 */

import { createBM25Index } from './opencode-memory-plugin/lib/bm25.js';
import * as stats from './opencode-memory-plugin/lib/statistics-utils.js';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const OUTPUT_DIR = path.join(process.cwd(), 'phase1-analysis');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔍 Phase 1 数据分析');
console.log('========================================\n');

// 从memory目录加载文档
function loadMemoryDocuments() {
  const files = [];
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md'];
  
  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      files.push(filePath);
    }
  }
  
  // 添加daily logs
  const dailyDir = path.join(MEMORY_DIR, 'daily');
  if (fs.existsSync(dailyDir)) {
    const dailyFiles = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 30);
    
    for (const file of dailyFiles) {
      files.push(path.join(dailyDir, file));
    }
  }
  
  return files;
}

// 将文档分块
function chunkDocument(content, fileName, chunkSize = 400, overlap = 80) {
  const lines = content.split('\n');
  const chunks = [];
  let docId = 0;
  
  let i = 0;
  while (i < lines.length) {
    const endLine = Math.min(i + chunkSize, lines.length);
    const chunk = lines.slice(i, endLine).join('\n');
    
    if (chunk.trim()) {
      chunks.push({
        id: `${fileName}_chunk_${docId++}`,
        content: chunk,
        metadata: { source: fileName, line: i + 1 }
      });
    }
    
    i += (chunkSize - overlap);
  }
  
  return chunks;
}

// 测试查询集
const testQueries = [
  // 关键词查询
  'async javascript',
  'error handling',
  'python asyncio',
  'memory write',
  'vector search',
  'BM25 algorithm',
  'external embedding',
  'configuration',
  'installation',
  'troubleshooting',
  
  // 语义查询
  'how to handle async errors',
  'best practices for memory management',
  'setting up the plugin',
  'what is hybrid search',
  'configuring external service',
  'memory consolidation',
  'indexing documents',
  'search performance',
  
  // 长尾查询
  'phase 1 optimization',
  'score distribution',
  'multiplication fusion',
  'reciprocal rank fusion',
  'long tail distribution',
  'dynamic threshold',
  
  // 短查询
  'async',
  'error',
  'memory',
  'search',
  'plugin',
  
  // 复合查询
  'javascript async patterns error handling',
  'memory plugin installation configuration',
  'vector bm25 hybrid search optimization'
];

// 收集数据
async function collectData() {
  console.log('📁 加载记忆文档...');
  const files = loadMemoryDocuments();
  console.log(`  找到 ${files.length} 个文件`);
  
  console.log('\n📄 分块处理文档...');
  const documents = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const chunks = chunkDocument(content, path.basename(file));
      documents.push(...chunks);
    } catch (e) {
      console.log(`  ⚠️  跳过文件: ${path.basename(file)}`);
    }
  }
  console.log(`  共 ${documents.length} 个文档块`);
  
  console.log('\n🔨 创建BM25索引...');
  const index = createBM25Index(documents);
  console.log(`  索引创建完成: ${index.docCount} 个文档`);
  
  console.log('\n🔍 运行测试查询...');
  const results = [];
  
  for (const query of testQueries) {
    process.stdout.write(`  查询: "${query.substring(0, 40)}${query.length > 40 ? '...' : ''}"...`);
    
    const { results: searchResults, diagnostics } = index.searchWithDiagnostics(query, {
      limit: 10,
      minScore: 0
    });
    
    results.push({
      query,
      queryTerms: diagnostics.queryTerms,
      totalDocs: diagnostics.totalDocs,
      processingTime: diagnostics.processingTime,
      scoreDistribution: diagnostics.scoreDistribution,
      idfStats: diagnostics.idfStats,
      topResults: searchResults.map(r => ({
        id: r.id,
        score: r.score,
        source: r.metadata.source
      }))
    });
    
    process.stdout.write(` ✓ (${diagnostics.processingTime}ms, ${searchResults.length} results)\n`);
  }
  
  return results;
}

// 分析数据
function analyzeData(results) {
  console.log('\n\n📊 数据分析');
  console.log('========================================');
  
  // 1. 分数分布统计
  console.log('\n1. 整体分数分布统计');
  const allScores = results.flatMap(r => {
    // 从每个查询的topResults获取分数
    return r.topResults.map(res => res.score);
  });
  
  const overallDist = stats.calculateScoreDistribution(allScores);
  console.log(`  - 样本数: ${overallDist.count}`);
  console.log(`  - 最小值: ${overallDist.min.toFixed(4)}`);
  console.log(`  - 最大值: ${overallDist.max.toFixed(4)}`);
  console.log(`  - 平均值: ${overallDist.mean.toFixed(4)}`);
  console.log(`  - 中位数: ${overallDist.median.toFixed(4)}`);
  console.log(`  - 标准差: ${overallDist.stdDev.toFixed(4)}`);
  
  // 2. 长尾分布判断
  console.log('\n2. 长尾分布分析');
  const isLongTail = stats.isLongTailedDistribution(overallDist);
  const meanToMedian = overallDist.mean / overallDist.median;
  console.log(`  - 平均值/中位数: ${meanToMedian.toFixed(2)}`);
  console.log(`  - 是否为长尾分布: ${isLongTail ? '✅ 是' : '❌ 否'}`);
  
  if (isLongTail) {
    console.log('  ⚠️  检测到长尾分布，乘法融合可能效果不佳');
    console.log('     建议：使用RRF融合或温和版乘法融合');
  }
  
  // 3. 按查询类型分析
  console.log('\n3. 按查询类型分析');
  
  const keywordQueries = results.filter(r => r.queryTerms.length === 1);
  const multiWordQueries = results.filter(r => r.queryTerms.length >= 2 && r.queryTerms.length <= 4);
  const longQueries = results.filter(r => r.queryTerms.length > 4);
  
  const analyzeQueryGroup = (name, queries) => {
    if (queries.length === 0) return;
    const scores = queries.flatMap(q => q.topResults.map(r => r.score));
    const dist = stats.calculateScoreDistribution(scores);
    console.log(`\n  ${name} (${queries.length}个查询):`);
    console.log(`    - 平均结果数: ${(queries.reduce((a, q) => a + q.topResults.length, 0) / queries.length).toFixed(1)}`);
    console.log(`    - 分数范围: ${dist.min.toFixed(2)} - ${dist.max.toFixed(2)}`);
    console.log(`    - 平均分: ${dist.mean.toFixed(4)}`);
  };
  
  analyzeQueryGroup('单关键词', keywordQueries);
  analyzeQueryGroup('多关键词(2-4词)', multiWordQueries);
  analyzeQueryGroup('长查询(>4词)', longQueries);
  
  // 4. IDF分析
  console.log('\n4. IDF统计');
  const allIdfValues = results.flatMap(r => 
    Object.values(r.idfStats).map(s => s.idf)
  );
  const idfDist = stats.calculateScoreDistribution(allIdfValues);
  console.log(`  - IDF值范围: ${idfDist.min.toFixed(4)} - ${idfDist.max.toFixed(4)}`);
  console.log(`  - 平均IDF: ${idfDist.mean.toFixed(4)}`);
  console.log(`  - IDF标准差: ${idfDist.stdDev.toFixed(4)}`);
  
  // 5. 性能统计
  console.log('\n5. 性能统计');
  const times = results.map(r => r.processingTime);
  const timeDist = stats.calculateScoreDistribution(times);
  console.log(`  - 平均处理时间: ${timeDist.mean.toFixed(1)}ms`);
  console.log(`  - 中位数时间: ${timeDist.median.toFixed(1)}ms`);
  console.log(`  - 最大时间: ${timeDist.max.toFixed(1)}ms`);
  console.log(`  - P95时间: ${timeDist.percentiles[95].toFixed(1)}ms`);
  
  // 6. 生成直方图
  console.log('\n6. 分数直方图');
  const histogram = stats.generateHistogram(allScores, 10);
  const maxCount = Math.max(...Object.values(histogram));
  
  Object.entries(histogram).forEach(([range, count]) => {
    const bar = '█'.repeat(Math.round((count / maxCount) * 30));
    console.log(`  [${range.padEnd(12)}]: ${count.toString().padStart(4)} ${bar}`);
  });
  
  return {
    overallDist,
    isLongTail,
    meanToMedian,
    idfDist,
    timeDist,
    histogram,
    results
  };
}

// 保存结果
function saveResults(analysis) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(OUTPUT_DIR, `analysis-${timestamp}.json`);
  
  fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
  console.log(`\n\n💾 分析结果已保存: ${outputFile}`);
  
  // 生成Markdown报告
  const reportFile = path.join(OUTPUT_DIR, `report-${timestamp}.md`);
  const report = generateMarkdownReport(analysis);
  fs.writeFileSync(reportFile, report);
  console.log(`📝 Markdown报告已保存: ${reportFile}`);
}

// 生成Markdown报告
function generateMarkdownReport(analysis) {
  return `# Phase 1 数据分析报告

生成时间: ${new Date().toISOString()}

## 概述

本报告分析了BM25搜索算法的分数分布特性，为后续优化提供数据支撑。

## 分数分布统计

| 指标 | 值 |
|------|-----|
| 样本数 | ${analysis.overallDist.count} |
| 最小值 | ${analysis.overallDist.min.toFixed(4)} |
| 最大值 | ${analysis.overallDist.max.toFixed(4)} |
| 平均值 | ${analysis.overallDist.mean.toFixed(4)} |
| 中位数 | ${analysis.overallDist.median.toFixed(4)} |
| 标准差 | ${analysis.overallDist.stdDev.toFixed(4)} |

## 长尾分布分析

- **平均值/中位数**: ${analysis.meanToMedian.toFixed(2)}
- **是否为长尾分布**: ${analysis.isLongTail ? '✅ 是' : '❌ 否'}

${analysis.isLongTail ? '**结论**: 检测到明显的长尾分布，乘法融合可能效果不佳。建议采用RRF融合或温和版乘法融合。' : '**结论**: 分数分布较为均匀，乘法融合可能有效。'}

## 百分位数

| 百分位 | 值 |
|--------|-----|
| P25 | ${analysis.overallDist.percentiles[25].toFixed(4)} |
| P50 | ${analysis.overallDist.percentiles[50].toFixed(4)} |
| P75 | ${analysis.overallDist.percentiles[75].toFixed(4)} |
| P90 | ${analysis.overallDist.percentiles[90].toFixed(4)} |
| P95 | ${analysis.overallDist.percentiles[95].toFixed(4)} |
| P99 | ${analysis.overallDist.percentiles[99].toFixed(4)} |

## 性能统计

| 指标 | 值 |
|------|-----|
| 平均处理时间 | ${analysis.timeDist.mean.toFixed(1)}ms |
| 中位数时间 | ${analysis.timeDist.median.toFixed(1)}ms |
| 最大时间 | ${analysis.timeDist.max.toFixed(1)}ms |
| P95时间 | ${analysis.timeDist.percentiles[95].toFixed(1)}ms |

## IDF统计

| 指标 | 值 |
|------|-----|
| IDF范围 | ${analysis.idfDist.min.toFixed(4)} - ${analysis.idfDist.max.toFixed(4)} |
| 平均IDF | ${analysis.idfDist.mean.toFixed(4)} |
| IDF标准差 | ${analysis.idfDist.stdDev.toFixed(4)} |

## 分数直方图

\`\`\`
${Object.entries(analysis.histogram).map(([range, count]) => {
  const bar = '█'.repeat(Math.round((count / Math.max(...Object.values(analysis.histogram))) * 30));
  return `[${range.padEnd(12)}]: ${count.toString().padStart(4)} ${bar}`;
}).join('\n')}
\`\`\`

## 优化建议

基于数据分析结果，提出以下优化建议：

${analysis.isLongTail ? `
### 1. 避免使用简单乘法融合
由于检测到长尾分布，简单乘法融合会导致：
- 高BM25分数被压缩
- 低分数被异常放大
- 向量分数主导最终结果

### 2. 推荐RRF融合
RRF (Reciprocal Rank Fusion) 优势：
- 零样本，无需归一化
- 对分数分布不敏感
- 简单高效

### 3. 温和版乘法融合公式
如果必须使用乘法，尝试：
\`\`\`
final_score = 0.5 * norm_vector + 0.5 * norm_bm25 + 0.3 * norm_vector * norm_bm25
\`\`\`

### 4. 动态权重调整
根据查询特征动态调整权重：
- 短查询（1-2词）：BM25权重较高
- 长查询（>3词）：向量权重较高
` : '分数分布较为均匀，可以尝试标准乘法融合，但建议先进行小规模测试。'}

---
*报告由 Phase 1 数据分析脚本生成*
`;
}

// 主函数
async function main() {
  try {
    const results = await collectData();
    const analysis = analyzeData(results);
    saveResults(analysis);
    
    console.log('\n========================================');
    console.log('✅ Phase 1 数据分析完成！');
    console.log('\n输出文件:');
    console.log(`  📁 ${OUTPUT_DIR}`);
    console.log('\n下一步:');
    console.log('1. 查看分析报告');
    console.log('2. 根据建议实施优化');
    console.log('3. 测试RRF融合或温和版乘法融合');
    
  } catch (e) {
    console.error('\n❌ 错误:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
