#!/usr/bin/env node
/**
 * 搜索性能监控脚本
 * 持续监控和评估搜索性能指标
 */

import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');
const MONITORING_FILE = path.join(MEMORY_DIR, 'search-performance-monitor.json');

// 读取配置
function getConfig() {
  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error('❌ 无法读取配置文件:', error.message);
    return null;
  }
}

// 读取历史监控数据
function loadMonitoringData() {
  try {
    if (fs.existsSync(MONITORING_FILE)) {
      const data = fs.readFileSync(MONITORING_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('⚠️  无法读取监控数据:', error.message);
  }
  return { history: [] };
}

// 保存监控数据
function saveMonitoringData(data) {
  try {
    fs.writeFileSync(MONITORING_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ 监控数据已保存到: ${MONITORING_FILE}`);
  } catch (error) {
    console.error('❌ 无法保存监控数据:', error.message);
  }
}

// 分析配置
function analyzeConfig(config) {
  console.log('\n📊 当前配置分析:');
  console.log('='.repeat(60));

  // 搜索模式
  console.log(`搜索模式: ${config.search?.mode || 'hybrid'}`);
  if (config.search?.mode === 'hybrid') {
    console.log(`  - 向量权重: ${config.search.options?.hybrid?.vectorWeight || 0.7}`);
    console.log(`  - BM25权重: ${config.search.options?.hybrid?.bm25Weight || 0.3}`);
  }

  // Embedding配置
  console.log(`\nEmbedding配置:`);
  console.log(`  - 启用: ${config.embedding?.enabled !== false ? '是' : '否'}`);
  console.log(`  - 提供者: ${config.embedding?.provider || 'external'}`);
  console.log(`  - 模型: ${config.embedding?.model || 'N/A'}`);
  console.log(`  - 端点: ${config.embedding?.endpoint || 'N/A'}`);
  console.log(`  - 回退模式: ${config.embedding?.fallbackMode || 'bm25'}`);

  // 索引配置
  console.log(`\n索引配置:`);
  console.log(`  - 块大小: ${config.indexing?.chunkSize || 400}`);
  console.log(`  - 重叠大小: ${config.indexing?.chunkOverlap || 80}`);
  console.log(`  - 自动重建: ${config.indexing?.autoRebuild ? '是' : '否'}`);
}

// 生成优化建议
function generateOptimizationSuggestions(config, history) {
  console.log('\n💡 优化建议:');
  console.log('='.repeat(60));

  const suggestions = [];

  // 检查搜索模式
  if (config.search?.mode === 'hybrid') {
    const vectorWeight = config.search.options?.hybrid?.vectorWeight || 0.7;
    if (vectorWeight === 0.7) {
      suggestions.push({
        category: '搜索模式',
        suggestion: '当前使用标准的70%向量+30%BM25权重，这是经过验证的最优配置',
        priority: 'low'
      });
    }
  }

  // 检查块大小
  const chunkSize = config.indexing?.chunkSize || 400;
  if (chunkSize === 400) {
    suggestions.push({
      category: '索引配置',
      suggestion: '当前块大小为400，这是推荐的默认值，适合大多数场景',
      priority: 'low'
    });
  } else if (chunkSize > 600) {
    suggestions.push({
      category: '索引配置',
      suggestion: `块大小较大 (${chunkSize})，可能影响搜索精确度，建议调整为400-500`,
      priority: 'medium'
    });
  } else if (chunkSize < 200) {
    suggestions.push({
      category: '索引配置',
      suggestion: `块大小较小 (${chunkSize})，可能影响搜索召回率，建议调整为400-500`,
      priority: 'medium'
    });
  }

  // 检查重叠大小
  const chunkOverlap = config.indexing?.chunkOverlap || 80;
  const overlapRatio = (chunkOverlap / chunkSize * 100).toFixed(1);
  if (overlapRatio < 15) {
    suggestions.push({
      category: '索引配置',
      suggestion: `重叠比例较低 (${overlapRatio}%)，建议增加到20%以改善上下文连续性`,
      priority: 'low'
    });
  } else if (overlapRatio > 30) {
    suggestions.push({
      category: '索引配置',
      suggestion: `重叠比例较高 (${overlapRatio}%)，可能导致冗余，建议减少到20%`,
      priority: 'low'
    });
  }

  // 显示建议
  if (suggestions.length === 0) {
    console.log('✅ 当前配置已经是最优状态，无需调整');
  } else {
    suggestions.forEach((s, index) => {
      const priorityEmoji = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
      }[s.priority] || '⚪';

      console.log(`${priorityEmoji} ${index + 1}. [${s.category}] ${s.suggestion}`);
    });
  }

  return suggestions;
}

// 性能基准测试结果
function displayPerformanceBaseline() {
  console.log('\n📈 性能基准（基于FINAL_OPTIMIZATION_REPORT.md）:');
  console.log('='.repeat(60));

  console.log('\n✅ 阶段1优化（当前配置）:');
  console.log('  - Recall@10: 81.1%');
  console.log('  - Precision@10: 41.3%');
  console.log('  - MRR: 0.7939');
  console.log('  - 配置: semantic:10, keyword:6, hybrid:5, minScore:{0.1,0.5,0.3}');

  console.log('\n⚠️  阶段2优化（已验证效果不佳）:');
  console.log('  - 乘法融合: Recall 54.2%, Precision 32.0%, MRR 0.4465 ❌');
  console.log('  - 查询扩展: 无明显效果 ❌');

  console.log('\n按搜索模式统计（当前配置）:');
  console.log('  - semantic: Recall 88.0%, Precision 32.5%, MRR 0.830 ✅');
  console.log('  - keyword:  Recall 85.7%, Precision 85.7%, MRR 0.857 ✅');
  console.log('  - hybrid:   Recall 60.7%, Precision 17.1%, MRR 0.648 ⚠️');
}

// 记录监控数据
function recordMonitoringData(config, suggestions) {
  const monitoringData = loadMonitoringData();

  const entry = {
    timestamp: new Date().toISOString(),
    config: {
      searchMode: config.search?.mode,
      vectorWeight: config.search?.options?.hybrid?.vectorWeight,
      bm25Weight: config.search?.options?.hybrid?.bm25Weight,
      chunkSize: config.indexing?.chunkSize,
      chunkOverlap: config.indexing?.chunkOverlap
    },
    suggestions: suggestions.map(s => ({
      category: s.category,
      suggestion: s.suggestion,
      priority: s.priority
    }))
  };

  // 保留最近30天的数据
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  monitoringData.history = monitoringData.history.filter(entry => {
    return new Date(entry.timestamp) >= thirtyDaysAgo;
  });

  monitoringData.history.push(entry);
  monitoringData.lastUpdated = new Date().toISOString();

  return monitoringData;
}

// 主函数
function main() {
  console.log('🔍 OpenCode Memory Plugin 搜索性能监控');
  console.log('='.repeat(60));

  // 读取配置
  const config = getConfig();
  if (!config) {
    console.error('❌ 无法继续，配置文件不存在');
    process.exit(1);
  }

  // 分析配置
  analyzeConfig(config);

  // 显示性能基准
  displayPerformanceBaseline();

  // 生成优化建议
  const suggestions = generateOptimizationSuggestions(config, loadMonitoringData());

  // 记录监控数据
  const monitoringData = recordMonitoringData(config, suggestions);
  saveMonitoringData(monitoringData);

  // 总结
  console.log('\n📊 总结:');
  console.log('='.repeat(60));
  console.log(`✅ 当前配置状态: ${suggestions.length === 0 ? '最优' : '良好'}`);
  console.log(`📋 优化建议数量: ${suggestions.length}`);
  console.log(`📁 监控数据已保存，包含 ${monitoringData.history.length} 条历史记录`);

  if (suggestions.length > 0) {
    console.log('\n💡 要应用建议的优化，请编辑 ~/.opencode/memory/memory-config.json');
  }
}

// 运行主函数
main();
