/**
 * 性能监控器
 * 监控和记录性能指标
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class PerformanceMonitor {
  constructor(options = {}) {
    this.metrics = [];
    this.startTime = Date.now();
    this.intervals = new Map();
    this.verbose = options.verbose || false;
    this.outputFile = options.outputFile || null;
  }

  /**
   * 开始计时
   */
  startTimer(operation, metadata = {}) {
    const timerId = `${Date.now()}-${Math.random()}`;
    this.intervals.set(timerId, {
      operation,
      metadata,
      startTime: Date.now(),
    });

    if (this.verbose) {
      console.log(`⏱️  开始计时: ${operation}`);
    }

    return timerId;
  }

  /**
   * 结束计时
   */
  endTimer(timerId, result = {}) {
    const interval = this.intervals.get(timerId);
    if (!interval) {
      console.warn(`⚠️  未找到计时器: ${timerId}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - interval.startTime;

    const metric = {
      operation: interval.operation,
      startTime: interval.startTime,
      endTime,
      duration,
      result: result.success !== undefined ? (result.success ? 'success' : 'failure') : 'unknown',
      ...interval.metadata,
      ...result,
    };

    this.metrics.push(metric);
    this.intervals.delete(timerId);

    if (this.verbose) {
      const status = result.success ? '✅' : '❌';
      console.log(`⏱️  结束计时: ${interval.operation} ${status} 耗时 ${duration}ms`);
    }

    return metric;
  }

  /**
   * 记录性能指标
   */
  recordMetric(operation, duration, metadata = {}) {
    const metric = {
      operation,
      duration,
      startTime: Date.now() - duration,
      endTime: Date.now(),
      ...metadata,
    };

    this.metrics.push(metric);

    if (this.verbose) {
      console.log(`📊 性能指标: ${operation} 耗时 ${duration}ms`);
    }

    return metric;
  }

  /**
   * 记录内存使用
   */
  recordMemoryUsage(operation, metadata = {}) {
    const memoryUsage = process.memoryUsage();
    const metric = {
      operation: `${operation}_memory`,
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers,
      ...metadata,
    };

    this.metrics.push(metric);

    if (this.verbose) {
      console.log(`💾 内存使用: ${operation}`);
      console.log(`   RSS: ${(metric.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Heap Used: ${(metric.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }

    return metric;
  }

  /**
   * 获取性能统计
   */
  getStatistics(operation = null) {
    let filteredMetrics = this.metrics;

    if (operation) {
      filteredMetrics = this.metrics.filter(m =>
        m.operation.includes(operation)
      );
    }

    // 过滤出有duration的指标
    const durationMetrics = filteredMetrics.filter(m => m.duration !== undefined);

    if (durationMetrics.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        total: 0,
      };
    }

    const durations = durationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    const p50Index = Math.floor(durations.length * 0.5);
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      count: durationMetrics.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: sum / durations.length,
      p50: durations[p50Index],
      p95: durations[p95Index],
      p99: durations[p99Index],
      total: sum,
    };
  }

  /**
   * 获取内存统计
   */
  getMemoryStatistics() {
    const memoryMetrics = this.metrics.filter(m =>
      m.operation.includes('_memory')
    );

    if (memoryMetrics.length === 0) {
      return {
        count: 0,
        avgRss: 0,
        maxRss: 0,
        avgHeapUsed: 0,
        maxHeapUsed: 0,
      };
    }

    const rssValues = memoryMetrics.map(m => m.rss);
    const heapUsedValues = memoryMetrics.map(m => m.heapUsed);

    return {
      count: memoryMetrics.length,
      avgRss: rssValues.reduce((a, b) => a + b, 0) / rssValues.length,
      maxRss: Math.max(...rssValues),
      avgHeapUsed: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
      maxHeapUsed: Math.max(...heapUsedValues),
    };
  }

  /**
   * 打印性能统计
   */
  printStatistics(operation = null) {
    const stats = this.getStatistics(operation);
    const memoryStats = this.getMemoryStatistics();

    console.log('\n📊 性能统计:');
    if (operation) {
      console.log(`   操作: ${operation}`);
    }
    console.log(`   总次数: ${stats.count}`);
    console.log(`   最小值: ${stats.min}ms`);
    console.log(`   最大值: ${stats.max}ms`);
    console.log(`   平均值: ${stats.avg.toFixed(2)}ms`);
    console.log(`   P50: ${stats.p50.toFixed(2)}ms`);
    console.log(`   P95: ${stats.p95.toFixed(2)}ms`);
    console.log(`   P99: ${stats.p99.toFixed(2)}ms`);
    console.log(`   总耗时: ${stats.total.toFixed(2)}ms`);
    console.log('');

    console.log('💾 内存统计:');
    console.log(`   样本数: ${memoryStats.count}`);
    console.log(`   平均 RSS: ${(memoryStats.avgRss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   最大 RSS: ${(memoryStats.maxRss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   平均 Heap: ${(memoryStats.avgHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   最大 Heap: ${(memoryStats.maxHeapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
  }

  /**
   * 检查性能阈值
   */
  checkThresholds(thresholds = {}) {
    const stats = this.getStatistics();
    const violations = [];

    if (thresholds.avg && stats.avg > thresholds.avg) {
      violations.push({
        metric: 'avg',
        expected: thresholds.avg,
        actual: stats.avg,
        violation: stats.avg - thresholds.avg,
      });
    }

    if (thresholds.p95 && stats.p95 > thresholds.p95) {
      violations.push({
        metric: 'p95',
        expected: thresholds.p95,
        actual: stats.p95,
        violation: stats.p95 - thresholds.p95,
      });
    }

    if (thresholds.p99 && stats.p99 > thresholds.p99) {
      violations.push({
        metric: 'p99',
        expected: thresholds.p99,
        actual: stats.p99,
        violation: stats.p99 - thresholds.p99,
      });
    }

    return violations;
  }

  /**
   * 导出性能数据
   */
  async exportMetrics(filename = 'performance-metrics.json') {
    const outputDir = path.join(__dirname, '..', 'test-results');
    await fs.mkdir(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, filename);
    await fs.writeFile(outputFile, JSON.stringify(this.metrics, null, 2), 'utf-8');
    console.log(`✅ 性能数据已导出到: ${outputFile}`);
    return outputFile;
  }

  /**
   * 导出性能报告
   */
  async exportReport(filename = 'performance-report.md') {
    const stats = this.getStatistics();
    const memoryStats = this.getMemoryStatistics();
    const violations = this.checkThresholds({
      avg: 200,
      p95: 500,
      p99: 1000,
    });

    const report = `# 性能测试报告

**生成时间**: ${new Date().toISOString()}

## 📊 总体统计

| 指标 | 值 |
|------|-----|
| 总操作次数 | ${stats.count} |
| 最小响应时间 | ${stats.min}ms |
| 最大响应时间 | ${stats.max}ms |
| 平均响应时间 | ${stats.avg.toFixed(2)}ms |
| P50响应时间 | ${stats.p50.toFixed(2)}ms |
| P95响应时间 | ${stats.p95.toFixed(2)}ms |
| P99响应时间 | ${stats.p99.toFixed(2)}ms |
| 总耗时 | ${(stats.total / 1000).toFixed(2)}s |

## 💾 内存统计

| 指标 | 值 |
|------|-----|
| 样本数 | ${memoryStats.count} |
| 平均 RSS | ${(memoryStats.avgRss / 1024 / 1024).toFixed(2)} MB |
| 最大 RSS | ${(memoryStats.maxRss / 1024 / 1024).toFixed(2)} MB |
| 平均 Heap | ${(memoryStats.avgHeapUsed / 1024 / 1024).toFixed(2)} MB |
| 最大 Heap | ${(memoryStats.maxHeapUsed / 1024 / 1024).toFixed(2)} MB |

## 🎯 性能目标验证

| 指标 | 目标 | 实际 | 状态 |
|------|------|------|------|
| 平均响应时间 | < 200ms | ${stats.avg.toFixed(2)}ms | ${stats.avg < 200 ? '✅ 通过' : '❌ 失败'} |
| P95响应时间 | < 500ms | ${stats.p95.toFixed(2)}ms | ${stats.p95 < 500 ? '✅ 通过' : '❌ 失败'} |
| P99响应时间 | < 1000ms | ${stats.p99.toFixed(2)}ms | ${stats.p99 < 1000 ? '✅ 通过' : '❌ 失败'} |
| 最大 RSS | < 150MB | ${(memoryStats.maxRss / 1024 / 1024).toFixed(2)}MB | ${memoryStats.maxRss < 150 * 1024 * 1024 ? '✅ 通过' : '❌ 失败'} |

${violations.length > 0 ? `
## ⚠️ 阈值违规

${violations.map(v => `
- **${v.metric}**: 超出目标 ${v.violation.toFixed(2)}ms (目标: ${v.expected}ms, 实际: ${v.actual.toFixed(2)}ms)
`).join('\n')}
` : `
## ✅ 所有性能目标均已通过
`}

## 📈 详细数据

详见 [performance-metrics.json](./performance-metrics.json)
`;

    const outputDir = path.join(__dirname, '..', 'test-results');
    await fs.mkdir(outputDir, { recursive: true });
    const outputFile = path.join(outputDir, filename);
    await fs.writeFile(outputFile, report, 'utf-8');
    console.log(`✅ 性能报告已导出到: ${outputFile}`);
    return outputFile;
  }

  /**
   * 清空性能数据
   */
  clear() {
    this.metrics = [];
    this.startTime = Date.now();
    this.intervals.clear();
  }

  /**
   * 获取所有指标
   */
  getAllMetrics() {
    return [...this.metrics];
  }

  /**
   * 按操作类型分组
   */
  groupByOperation() {
    const groups = {};
    this.metrics.forEach(metric => {
      if (!groups[metric.operation]) {
        groups[metric.operation] = [];
      }
      groups[metric.operation].push(metric);
    });
    return groups;
  }
}

export default PerformanceMonitor;
