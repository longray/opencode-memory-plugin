/**
 * 压力测试套件
 * 测试后端服务在高负载下的表现
 */

import { WrapperClient } from './lib/wrapper-client.js';
import { generateMixedMemories } from './test-data-generator.mjs';
import fs from 'fs';

const TEST_CONFIG = {
  backend: {
    enabled: true,
    url: 'http://localhost:17999',
    tenant_id: 'stress_test',
    timeout: 120000,
    maxRetries: 0, // 不自动重试，观察真实失败
  },
};

/**
 * 压力测试配置
 */
const STRESS_CONFIG = {
  // 并发上传测试
  concurrentUploads: {
    levels: [10, 50, 100, 200],
    duration: 30000, // 30秒
    batchSize: 10,
  },

  // 持续压力测试
  sustainedLoad: {
    duration: 60000, // 1分钟
    targetRps: 20, // 目标每秒请求数
  },

  // 突发流量测试
  burstLoad: {
    bursts: [100, 200, 500],
    interval: 5000, // 5秒间隔
  },

  // 搜索压力测试
  searchStress: {
    concurrent: 50,
    duration: 30000,
    queries: [
      'Python',
      'React',
      'Vue',
      'Angular',
      '性能优化',
      '微服务',
      '缓存',
      '数据库',
      'API设计',
      '用户认证',
      '日志系统',
      '监控系统',
    ],
  },
};

/**
 * 压力测试运行器
 */
class StressTestRunner {
  constructor() {
    this.client = new WrapperClient(TEST_CONFIG);
    this.results = [];
  }

  /**
   * 生成测试数据
   */
  generateData(count) {
    return generateMixedMemories(Math.ceil(count / 5)).slice(0, count);
  }

  /**
   * 并发上传压力测试
   */
  async testConcurrentUploads() {
    console.log('\n🔥 Test: Concurrent Uploads');
    console.log('========================================');

    for (const concurrency of STRESS_CONFIG.concurrentUploads.levels) {
      console.log(`\nTesting ${concurrency} concurrent uploads...`);

      const memories = this.generateData(concurrency);
      const startTime = Date.now();

      // 创建并发请求
      const promises = memories.map((memory, i) =>
        this.client
          .uploadMemory(memory)
          .then(result => ({
            success: true,
            index: i,
            result,
          }))
          .catch(error => ({
            success: false,
            index: i,
            error: error.message,
          }))
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      const throughput = Math.round((successCount / duration) * 1000);

      console.log(`  Concurrency: ${concurrency}`);
      console.log(`  Success: ${successCount}/${concurrency}`);
      console.log(`  Failed: ${failCount}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Throughput: ${throughput} req/sec`);
      console.log(`  Avg Latency: ${Math.round(duration / concurrency)}ms`);

      this.results.push({
        test: 'concurrent_uploads',
        concurrency,
        success: successCount,
        failed: failCount,
        duration,
        throughput,
        avgLatency: Math.round(duration / concurrency),
      });

      // 间隔，避免过度压力
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  /**
   * 持续压力测试
   */
  async testSustainedLoad() {
    console.log('\n🔥 Test: Sustained Load');
    console.log('========================================');

    const { duration, targetRps } = STRESS_CONFIG.sustainedLoad;
    const interval = 1000 / targetRps; // 请求间隔

    console.log(`Running sustained load for ${duration / 1000}s at ${targetRps} req/sec...`);

    let successCount = 0;
    let failCount = 0;
    let totalLatency = 0;
    const latencies = [];

    const memories = this.generateData(100);
    let memoryIndex = 0;

    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const requestStart = Date.now();

      try {
        await this.client.uploadMemory(memories[memoryIndex % memories.length]);
        successCount++;
      } catch (e) {
        failCount++;
      }

      const latency = Date.now() - requestStart;
      totalLatency += latency;
      latencies.push(latency);

      memoryIndex++;

      // 控制请求速率
      const elapsed = Date.now() - requestStart;
      if (elapsed < interval) {
        await new Promise(r => setTimeout(r, interval - elapsed));
      }

      // 每10秒输出进度
      if (memoryIndex % (targetRps * 10) === 0) {
        const progress = Math.round(((Date.now() - startTime) / duration) * 100);
        process.stdout.write(
          `\r  Progress: ${progress}% | Success: ${successCount} | Failed: ${failCount}`
        );
      }
    }

    console.log('\n');

    const actualDuration = Date.now() - startTime;
    const actualRps = Math.round((successCount + failCount) / (actualDuration / 1000));
    const avgLatency = Math.round(totalLatency / (successCount + failCount));
    const p95Latency = this.percentile(latencies, 0.95);

    console.log(`  Total Requests: ${successCount + failCount}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log(`  Actual RPS: ${actualRps}`);
    console.log(`  Avg Latency: ${avgLatency}ms`);
    console.log(`  P95 Latency: ${p95Latency}ms`);
    console.log(`  Error Rate: ${((failCount / (successCount + failCount)) * 100).toFixed(2)}%`);

    this.results.push({
      test: 'sustained_load',
      duration,
      targetRps,
      actualRps,
      success: successCount,
      failed: failCount,
      avgLatency,
      p95Latency,
      errorRate: ((failCount / (successCount + failCount)) * 100).toFixed(2),
    });
  }

  /**
   * 突发流量测试
   */
  async testBurstLoad() {
    console.log('\n🔥 Test: Burst Load');
    console.log('========================================');

    for (const burstSize of STRESS_CONFIG.burstLoad.bursts) {
      console.log(`\nTesting burst of ${burstSize} requests...`);

      const memories = this.generateData(burstSize);
      const startTime = Date.now();

      const promises = memories.map(memory => this.client.uploadMemory(memory).catch(() => null));

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      const successCount = results.filter(r => r !== null).length;
      const throughput = Math.round((burstSize / duration) * 1000);

      console.log(`  Burst Size: ${burstSize}`);
      console.log(`  Success: ${successCount}/${burstSize}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Throughput: ${throughput} req/sec`);

      this.results.push({
        test: 'burst_load',
        burstSize,
        success: successCount,
        failed: burstSize - successCount,
        duration,
        throughput,
      });

      // 等待间隔
      await new Promise(r => setTimeout(r, STRESS_CONFIG.burstLoad.interval));
    }
  }

  /**
   * 搜索压力测试
   */
  async testSearchStress() {
    console.log('\n🔥 Test: Search Stress');
    console.log('========================================');

    // 先上传一些数据
    console.log('Preparing test data...');
    const testData = this.generateData(500);
    await this.client.uploadMemories(testData);
    await new Promise(r => setTimeout(r, 3000)); // 等待索引

    const { concurrent, duration, queries } = STRESS_CONFIG.searchStress;

    console.log(`Running ${concurrent} concurrent searches for ${duration / 1000}s...`);

    let totalRequests = 0;
    let successCount = 0;
    let failCount = 0;
    const latencies = [];

    const workers = [];

    // 启动多个工作线程
    for (let i = 0; i < concurrent; i++) {
      workers.push(
        new Promise(async resolve => {
          const startTime = Date.now();

          while (Date.now() - startTime < duration) {
            const query = queries[Math.floor(Math.random() * queries.length)];
            const requestStart = Date.now();

            try {
              await this.client.search({
                query,
                mode: 'hybrid',
                limit: 10,
                tenant_id: 'stress_test',
              });
              successCount++;
            } catch (e) {
              failCount++;
            }

            latencies.push(Date.now() - requestStart);
            totalRequests++;
          }

          resolve();
        })
      );
    }

    // 显示进度
    const progressInterval = setInterval(() => {
      const progress = (successCount + failCount) / ((concurrent * duration) / 100);
      process.stdout.write(
        `\r  Progress: ${Math.min(100, Math.round(progress))}% | Requests: ${totalRequests}`
      );
    }, 1000);

    await Promise.all(workers);
    clearInterval(progressInterval);

    console.log('\n');

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = this.percentile(latencies, 0.95);
    const actualDuration = duration / 1000;
    const throughput = Math.round(totalRequests / actualDuration);

    console.log(`  Total Requests: ${totalRequests}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log(`  Throughput: ${throughput} req/sec`);
    console.log(`  Avg Latency: ${Math.round(avgLatency)}ms`);
    console.log(`  P95 Latency: ${p95Latency}ms`);

    this.results.push({
      test: 'search_stress',
      concurrent,
      duration,
      totalRequests,
      success: successCount,
      failed: failCount,
      throughput,
      avgLatency: Math.round(avgLatency),
      p95Latency,
    });
  }

  /**
   * 混合负载测试
   */
  async testMixedLoad() {
    console.log('\n🔥 Test: Mixed Load (Upload + Search)');
    console.log('========================================');

    const duration = 30000; // 30秒
    const uploadRate = 5; // 每秒5个上传
    const searchRate = 15; // 每秒15个搜索

    console.log(`Running mixed load for ${duration / 1000}s...`);
    console.log(`  Upload rate: ${uploadRate}/sec`);
    console.log(`  Search rate: ${searchRate}/sec`);

    let uploadSuccess = 0;
    let uploadFail = 0;
    let searchSuccess = 0;
    let searchFail = 0;

    const memories = this.generateData(100);
    const queries = ['Python', 'React', '性能', '微服务', '缓存'];

    const startTime = Date.now();

    // 上传工作线程
    const uploadWorker = async () => {
      while (Date.now() - startTime < duration) {
        try {
          await this.client.uploadMemory(memories[Math.floor(Math.random() * memories.length)]);
          uploadSuccess++;
        } catch (e) {
          uploadFail++;
        }
        await new Promise(r => setTimeout(r, 1000 / uploadRate));
      }
    };

    // 搜索工作线程
    const searchWorker = async () => {
      while (Date.now() - startTime < duration) {
        try {
          await this.client.search({
            query: queries[Math.floor(Math.random() * queries.length)],
            mode: 'hybrid',
            limit: 10,
            tenant_id: 'stress_test',
          });
          searchSuccess++;
        } catch (e) {
          searchFail++;
        }
        await new Promise(r => setTimeout(r, 1000 / searchRate));
      }
    };

    // 启动多个工作线程
    const workers = [...Array(3).fill(uploadWorker), ...Array(5).fill(searchWorker)].map(fn =>
      fn()
    );

    // 进度显示
    const progressInterval = setInterval(() => {
      const progress = Math.round(((Date.now() - startTime) / duration) * 100);
      process.stdout.write(
        `\r  Progress: ${progress}% | Uploads: ${uploadSuccess}/${uploadFail} | Searches: ${searchSuccess}/${searchFail}`
      );
    }, 1000);

    await Promise.all(workers);
    clearInterval(progressInterval);

    console.log('\n');
    console.log(`  Upload Success: ${uploadSuccess}`);
    console.log(`  Upload Failed: ${uploadFail}`);
    console.log(`  Search Success: ${searchSuccess}`);
    console.log(`  Search Failed: ${searchFail}`);
    console.log(
      `  Total Throughput: ${Math.round((uploadSuccess + uploadFail + searchSuccess + searchFail) / (duration / 1000))} req/sec`
    );

    this.results.push({
      test: 'mixed_load',
      duration,
      uploadSuccess,
      uploadFail,
      searchSuccess,
      searchFail,
    });
  }

  /**
   * 计算百分位
   */
  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 生成报告
   */
  generateReport() {
    console.log('\n========================================');
    console.log('Stress Test Summary');
    console.log('========================================\n');

    this.results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.test}`);
      console.log('-'.repeat(40));
      Object.entries(result).forEach(([key, value]) => {
        if (key !== 'test') {
          console.log(`   ${key}: ${value}`);
        }
      });
      console.log('');
    });

    // 保存详细报告
    const reportPath = 'stress-test-report.json';
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results: this.results,
        },
        null,
        2
      )
    );

    console.log(`Detailed report saved to: ${reportPath}`);
  }

  async run() {
    console.log('🚀 Starting Stress Tests\n');

    try {
      await this.testConcurrentUploads();
      await this.testSustainedLoad();
      await this.testBurstLoad();
      await this.testSearchStress();
      await this.testMixedLoad();
      this.generateReport();

      console.log('\n✅ All stress tests completed!');
    } catch (e) {
      console.error('\n❌ Stress test failed:', e);
      throw e;
    }
  }
}

// 运行测试
const runner = new StressTestRunner();
runner.run().catch(console.error);
