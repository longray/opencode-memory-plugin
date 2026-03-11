/**
 * 性能基准测试套件
 * 测试后端服务的各项性能指标
 */

import { WrapperClient } from './lib/wrapper-client.js';
import { generateMixedMemories, generateGraphMemories, getStats } from './test-data-generator.mjs';
import fs from 'fs';
import path from 'path';

const TEST_CONFIG = {
  backend: {
    enabled: true,
    url: 'http://localhost:17999',
    tenant_id: 'perf_test',
    timeout: 60000,
    maxRetries: 1,
  },
};

/**
 * 性能测试指标收集器
 */
class MetricsCollector {
  constructor() {
    this.metrics = [];
  }

  record(operation, duration, details = {}) {
    this.metrics.push({
      operation,
      duration,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  getStats(operation) {
    const ops = this.metrics.filter(m => m.operation === operation);
    if (ops.length === 0) return null;

    const durations = ops.map(m => m.duration);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: ops.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: Math.round(sum / ops.length),
      p50: this.percentile(durations, 0.5),
      p95: this.percentile(durations, 0.95),
      p99: this.percentile(durations, 0.99),
      total: sum,
    };
  }

  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  summary() {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    return operations.map(op => ({
      operation: op,
      ...this.getStats(op),
    }));
  }

  export(filename) {
    const data = {
      timestamp: new Date().toISOString(),
      summary: this.summary(),
      raw: this.metrics,
    };
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  }
}

/**
 * 计时器
 */
function timer() {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/**
 * 进度条
 */
function progressBar(current, total, width = 40) {
  const percent = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(width * percent);
  const empty = Math.max(0, width - filled);
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  process.stdout.write(`\r${bar} ${Math.round(percent * 100)}% (${current}/${total})`);
}

/**
 * 测试套件
 */
class PerformanceTestSuite {
  constructor() {
    this.client = new WrapperClient(TEST_CONFIG);
    this.metrics = new MetricsCollector();
    this.results = [];
  }

  async setup() {
    console.log('🔧 Setup: Checking backend health...');
    const health = await this.client.health();
    if (health.status !== 'healthy') {
      throw new Error('Backend is not healthy');
    }
    console.log('✅ Backend is healthy\n');
  }

  /**
   * 测试1: 单条上传延迟
   */
  async testSingleUploadLatency() {
    console.log('📊 Test 1: Single Upload Latency');
    console.log('----------------------------------------');

    const memories = generateMixedMemories(50);

    for (let i = 0; i < memories.length; i++) {
      const t = timer();
      await this.client.uploadMemory(memories[i]);
      const duration = t();
      this.metrics.record('single_upload', duration, { size: memories[i].content.length });

      if ((i + 1) % 10 === 0) progressBar(i + 1, 50);
    }
    console.log('\n');

    const stats = this.metrics.getStats('single_upload');
    console.log(`  Count: ${stats.count}`);
    console.log(`  Min: ${stats.min}ms`);
    console.log(`  Max: ${stats.max}ms`);
    console.log(`  Avg: ${stats.avg}ms`);
    console.log(`  P95: ${stats.p95}ms`);
    console.log(`  P99: ${stats.p99}ms`);
    console.log('');

    this.results.push({
      test: 'Single Upload Latency',
      stats,
    });
  }

  /**
   * 测试2: 批量上传性能
   */
  async testBatchUploadPerformance() {
    console.log('📊 Test 2: Batch Upload Performance');
    console.log('----------------------------------------');

    const batchSizes = [1, 5, 10, 20, 50];
    const memories = generateMixedMemories(100);

    for (const batchSize of batchSizes) {
      const batches = [];
      for (let i = 0; i < memories.length; i += batchSize) {
        batches.push(memories.slice(i, i + batchSize));
      }

      const t = timer();
      let totalUploaded = 0;

      for (const batch of batches) {
        const result = await this.client.uploadMemories(batch);
        totalUploaded += result.success;
      }

      const duration = t();
      const throughput = Math.round((totalUploaded / duration) * 1000); // items/sec

      this.metrics.record('batch_upload', duration, {
        batchSize,
        total: totalUploaded,
        throughput,
      });

      console.log(`  Batch size ${batchSize}: ${duration}ms (${throughput} items/sec)`);
    }
    console.log('');

    this.results.push({
      test: 'Batch Upload Performance',
      batches: this.metrics.summary().filter(m => m.operation === 'batch_upload'),
    });
  }

  /**
   * 测试3: 搜索延迟
   */
  async testSearchLatency() {
    console.log('📊 Test 3: Search Latency');
    console.log('----------------------------------------');

    // 先上传一些测试数据
    console.log('  Uploading test data...');
    const testData = generateMixedMemories(200);
    await this.client.uploadMemories(testData);
    console.log('  Test data uploaded\n');

    // 等待索引
    await new Promise(r => setTimeout(r, 2000));

    const queries = [
      'Python',
      'React',
      '性能优化',
      '微服务架构',
      'Bug 修复',
      '代码审查',
      '用户认证',
      '缓存策略',
      '数据库设计',
      'API 接口',
    ];

    const modes = ['keyword', 'vector', 'hybrid'];

    for (const mode of modes) {
      console.log(`  Testing ${mode} mode...`);

      for (const query of queries) {
        const t = timer();
        await this.client.search({
          query,
          mode,
          limit: 10,
          threshold: 0.3,
          tenant_id: 'perf_test',
        });
        const duration = t();
        this.metrics.record(`search_${mode}`, duration, { query });
      }

      const stats = this.metrics.getStats(`search_${mode}`);
      console.log(`    ${mode}: avg=${stats.avg}ms, p95=${stats.p95}ms`);
    }
    console.log('');

    this.results.push({
      test: 'Search Latency',
      modes: ['keyword', 'vector', 'hybrid'].map(mode => ({
        mode,
        stats: this.metrics.getStats(`search_${mode}`),
      })),
    });
  }

  /**
   * 测试4: 大规模数据导入
   */
  async testLargeScaleImport() {
    console.log('📊 Test 4: Large Scale Import (1000 memories)');
    console.log('----------------------------------------');

    const memories = generateMixedMemories(200); // 1000条
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < memories.length; i += batchSize) {
      batches.push(memories.slice(i, i + batchSize));
    }

    console.log(`  Importing ${memories.length} memories in ${batches.length} batches...`);

    const t = timer();
    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
      const result = await this.client.uploadMemories(batches[i]);
      totalSuccess += result.success;
      totalFailed += result.failed;
      progressBar(i + 1, batches.length);
    }
    console.log('\n');

    const duration = t();
    const throughput = Math.round((totalSuccess / duration) * 1000);

    console.log(`  Total: ${memories.length}`);
    console.log(`  Success: ${totalSuccess}`);
    console.log(`  Failed: ${totalFailed}`);
    console.log(`  Duration: ${duration}ms`);
    console.log(`  Throughput: ${throughput} items/sec`);
    console.log('');

    this.results.push({
      test: 'Large Scale Import',
      total: memories.length,
      success: totalSuccess,
      failed: totalFailed,
      duration,
      throughput,
    });
  }

  /**
   * 测试5: 并发性能
   */
  async testConcurrentPerformance() {
    console.log('📊 Test 5: Concurrent Performance');
    console.log('----------------------------------------');

    const concurrencyLevels = [5, 10, 20];
    const memories = generateMixedMemories(20);

    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing with ${concurrency} concurrent uploads...`);

      const t = timer();

      // 并发上传
      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(this.client.uploadMemory(memories[i % memories.length]));
      }

      await Promise.all(promises);
      const duration = t();

      this.metrics.record('concurrent_upload', duration, { concurrency });
      console.log(`    ${concurrency} concurrent: ${duration}ms total`);
    }
    console.log('');

    this.results.push({
      test: 'Concurrent Performance',
      stats: this.metrics.summary().filter(m => m.operation === 'concurrent_upload'),
    });
  }

  /**
   * 测试6: Embedding 性能
   */
  async testEmbeddingPerformance() {
    console.log('📊 Test 6: Embedding Performance');
    console.log('----------------------------------------');

    const texts = [
      'Short text',
      'Medium length text with some content about programming',
      'Long text: ' + generateMixedMemories(1)[0].content,
      'Very long text: ' +
        generateMixedMemories(1)[0].content +
        ' ' +
        generateMixedMemories(1)[0].content,
    ];

    for (const text of texts) {
      const t = timer();
      await this.client.getEmbedding(text);
      const duration = t();
      this.metrics.record('embedding', duration, { length: text.length });
      console.log(`  Length ${text.length}: ${duration}ms`);
    }

    const stats = this.metrics.getStats('embedding');
    console.log(`\n  Avg: ${stats.avg}ms, P95: ${stats.p95}ms`);
    console.log('');

    this.results.push({
      test: 'Embedding Performance',
      stats,
    });
  }

  /**
   * 生成报告
   */
  generateReport() {
    console.log('========================================');
    console.log('Performance Test Report');
    console.log('========================================\n');

    this.results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.test}`);
      console.log('-'.repeat(40));

      if (result.stats) {
        const s = result.stats;
        console.log(`   Count: ${s.count || 'N/A'}`);
        console.log(`   Min: ${s.min || 'N/A'}ms`);
        console.log(`   Max: ${s.max || 'N/A'}ms`);
        console.log(`   Avg: ${s.avg || 'N/A'}ms`);
        if (s.p95) console.log(`   P95: ${s.p95}ms`);
        if (s.p99) console.log(`   P99: ${s.p99}ms`);
      }

      if (result.throughput) {
        console.log(`   Throughput: ${result.throughput} items/sec`);
      }

      console.log('');
    });

    // 保存详细报告
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results: this.results,
          metrics: this.metrics.summary(),
        },
        null,
        2
      )
    );

    console.log(`\nDetailed report saved to: ${reportPath}`);
  }

  async run() {
    try {
      await this.setup();
      await this.testSingleUploadLatency();
      await this.testBatchUploadPerformance();
      await this.testSearchLatency();
      await this.testLargeScaleImport();
      await this.testConcurrentPerformance();
      await this.testEmbeddingPerformance();
      this.generateReport();

      console.log('\n✅ All performance tests completed!');
    } catch (e) {
      console.error('\n❌ Performance test failed:', e.message);
      throw e;
    }
  }
}

// 运行测试
const suite = new PerformanceTestSuite();
suite.run().catch(console.error);
