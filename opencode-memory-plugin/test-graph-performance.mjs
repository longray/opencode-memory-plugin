/**
 * 图关系性能测试
 * 测试图关系的创建、查询和遍历性能
 */

import { WrapperClient } from './lib/wrapper-client.js';
import { generateGraphMemories } from './test-data-generator.mjs';
import fs from 'fs';

const TEST_CONFIG = {
  backend: {
    enabled: true,
    url: 'http://localhost:17999',
    tenant_id: 'graph_perf_test',
    timeout: 60000,
  },
};

/**
 * 图性能测试
 */
class GraphPerformanceTest {
  constructor() {
    this.client = new WrapperClient(TEST_CONFIG);
    this.results = [];
    this.memoryIds = [];
  }

  /**
   * 生成测试数据
   */
  async setupTestData(nodeCount, edgeDensity) {
    console.log(`\n🌐 Generating test data: ${nodeCount} nodes, ${edgeDensity} edge density...`);

    const { memories, relations } = generateGraphMemories(nodeCount, edgeDensity);

    // 上传记忆
    console.log('  Uploading memories...');
    const uploadResults = await this.client.uploadMemories(memories);
    console.log(`  Uploaded: ${uploadResults.success}/${uploadResults.total}`);

    // 保存 memory IDs
    this.memoryIds = uploadResults.memory_ids;

    // 创建关系
    console.log('  Creating relations...');
    let relationCount = 0;
    for (const rel of relations) {
      try {
        const fromId = this.memoryIds[rel.from];
        const toId = this.memoryIds[rel.to];

        if (fromId && toId) {
          await this.client.createRelation({
            from_id: fromId,
            to_id: toId,
            relationship_type: rel.type,
            weight: rel.weight,
          });
          relationCount++;
        }
      } catch (e) {
        // 忽略重复关系错误
      }
    }

    console.log(`  Created: ${relationCount} relations`);

    return {
      nodes: nodeCount,
      edges: relationCount,
      density: edgeDensity,
    };
  }

  /**
   * 测试关系创建性能
   */
  async testRelationCreation() {
    console.log('\n🌐 Test: Relation Creation Performance');
    console.log('========================================');

    const sizes = [10, 50, 100];

    for (const size of sizes) {
      // 创建两个节点
      const mem1 = await this.client.uploadMemory({
        content: `Source node ${size}`,
        type: 'test',
        tenant_id: 'graph_perf_test',
      });

      const mem2 = await this.client.uploadMemory({
        content: `Target node ${size}`,
        type: 'test',
        tenant_id: 'graph_perf_test',
      });

      // 批量创建关系
      const startTime = Date.now();

      for (let i = 0; i < size; i++) {
        await this.client.createRelation({
          from_id: mem1.id,
          to_id: mem2.id,
          relationship_type: 'related',
          weight: Math.random(),
        });
      }

      const duration = Date.now() - startTime;
      const avgLatency = duration / size;

      console.log(`  ${size} relations: ${duration}ms (avg ${avgLatency.toFixed(2)}ms)`);

      this.results.push({
        test: 'relation_creation',
        count: size,
        duration,
        avgLatency,
      });
    }
  }

  /**
   * 测试关系查询性能
   */
  async testRelationQuery() {
    console.log('\n🌐 Test: Relation Query Performance');
    console.log('========================================');

    // 准备数据
    const graphInfo = await this.setupTestData(100, 0.2);
    await new Promise(r => setTimeout(r, 1000));

    // 查询测试
    const sampleSize = 20;
    const latencies = [];

    console.log(`  Querying relations for ${sampleSize} nodes...`);

    for (let i = 0; i < sampleSize; i++) {
      const memoryId = this.memoryIds[Math.floor(Math.random() * this.memoryIds.length)];

      const startTime = Date.now();
      const result = await this.client.getRelations({
        memory_id: memoryId,
        direction: 'both',
        tenant_id: 'graph_perf_test',
      });
      const duration = Date.now() - startTime;

      latencies.push({
        duration,
        relationCount: result.total,
      });
    }

    const avgLatency = latencies.reduce((a, b) => a + b.duration, 0) / latencies.length;
    const maxLatency = Math.max(...latencies.map(l => l.duration));
    const minLatency = Math.min(...latencies.map(l => l.duration));
    const avgRelations = latencies.reduce((a, b) => a + b.relationCount, 0) / latencies.length;

    console.log(`  Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Min Latency: ${minLatency}ms`);
    console.log(`  Max Latency: ${maxLatency}ms`);
    console.log(`  Avg Relations per Node: ${avgRelations.toFixed(2)}`);

    this.results.push({
      test: 'relation_query',
      sampleSize,
      avgLatency,
      minLatency,
      maxLatency,
      avgRelations,
    });
  }

  /**
   * 测试图遍历性能
   */
  async testGraphTraversal() {
    console.log('\n🌐 Test: Graph Traversal Performance');
    console.log('========================================');

    // 准备不同规模的数据
    const configs = [
      { nodes: 50, edges: 0.1, depth: 1 },
      { nodes: 50, edges: 0.1, depth: 2 },
      { nodes: 50, edges: 0.1, depth: 3 },
      { nodes: 100, edges: 0.1, depth: 2 },
      { nodes: 200, edges: 0.05, depth: 2 },
    ];

    for (const config of configs) {
      console.log(`\n  Testing ${config.nodes} nodes, depth ${config.depth}...`);

      // 准备数据
      await this.setupTestData(config.nodes, config.edges);
      await new Promise(r => setTimeout(r, 1000));

      // 遍历测试
      const sampleSize = 10;
      const latencies = [];
      const nodeCounts = [];

      for (let i = 0; i < sampleSize; i++) {
        const memoryId = this.memoryIds[Math.floor(Math.random() * this.memoryIds.length)];

        const startTime = Date.now();
        const result = await this.client.traverseGraph({
          memory_id: memoryId,
          depth: config.depth,
          tenant_id: 'graph_perf_test',
        });
        const duration = Date.now() - startTime;

        latencies.push(duration);
        nodeCounts.push(result.total);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const avgNodes = nodeCounts.reduce((a, b) => a + b, 0) / nodeCounts.length;

      console.log(`    Avg Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`    Avg Nodes Found: ${avgNodes.toFixed(2)}`);

      this.results.push({
        test: 'graph_traversal',
        nodes: config.nodes,
        edges: config.edges,
        depth: config.depth,
        avgLatency,
        avgNodes,
      });
    }
  }

  /**
   * 测试复杂图查询
   */
  async testComplexGraphQueries() {
    console.log('\n🌐 Test: Complex Graph Queries');
    console.log('========================================');

    // 创建一个星型图结构
    console.log('  Creating star topology...');

    const centerNode = await this.client.uploadMemory({
      content: 'Central hub node',
      type: 'hub',
      tenant_id: 'graph_perf_test',
    });

    const leafCount = 50;
    const leafNodes = [];

    for (let i = 0; i < leafCount; i++) {
      const leaf = await this.client.uploadMemory({
        content: `Leaf node ${i}`,
        type: 'leaf',
        tenant_id: 'graph_perf_test',
      });
      leafNodes.push(leaf.id);

      await this.client.createRelation({
        from_id: centerNode.id,
        to_id: leaf.id,
        relationship_type: 'connected',
        weight: 0.8,
      });
    }

    await new Promise(r => setTimeout(r, 1000));

    // 测试中心节点查询
    console.log('  Querying center node relations...');
    const startTime = Date.now();
    const result = await this.client.getRelations({
      memory_id: centerNode.id,
      direction: 'outgoing',
      tenant_id: 'graph_perf_test',
    });
    const duration = Date.now() - startTime;

    console.log(`    Query Time: ${duration}ms`);
    console.log(`    Relations Found: ${result.total}`);

    this.results.push({
      test: 'complex_star_topology',
      leafCount,
      queryTime: duration,
      relationsFound: result.total,
    });

    // 测试图遍历
    console.log('  Testing traversal from center...');
    const traversalStart = Date.now();
    const traversalResult = await this.client.traverseGraph({
      memory_id: centerNode.id,
      depth: 1,
      tenant_id: 'graph_perf_test',
    });
    const traversalDuration = Date.now() - traversalStart;

    console.log(`    Traversal Time: ${traversalDuration}ms`);
    console.log(`    Nodes Found: ${traversalResult.total}`);

    this.results.push({
      test: 'complex_traversal',
      depth: 1,
      traversalTime: traversalDuration,
      nodesFound: traversalResult.total,
    });
  }

  /**
   * 测试并发图操作
   */
  async testConcurrentGraphOperations() {
    console.log('\n🌐 Test: Concurrent Graph Operations');
    console.log('========================================');

    const concurrency = 20;
    const operations = 100;

    // 准备数据
    await this.setupTestData(50, 0.2);
    await new Promise(r => setTimeout(r, 1000));

    console.log(`  Running ${operations} concurrent operations...`);

    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // 批量执行
    const batches = [];
    for (let i = 0; i < operations; i += concurrency) {
      const batch = [];
      for (let j = 0; j < concurrency && i + j < operations; j++) {
        const memoryId = this.memoryIds[Math.floor(Math.random() * this.memoryIds.length)];
        batch.push(
          this.client
            .getRelations({
              memory_id: memoryId,
              direction: 'both',
              tenant_id: 'graph_perf_test',
            })
            .then(() => successCount++)
            .catch(() => failCount++)
        );
      }
      await Promise.all(batch);
      process.stdout.write(`\r    Progress: ${Math.min(100, Math.round((i / operations) * 100))}%`);
    }

    console.log('\n');

    const duration = Date.now() - startTime;
    const throughput = Math.round((successCount + failCount) / (duration / 1000));

    console.log(`  Duration: ${duration}ms`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log(`  Throughput: ${throughput} ops/sec`);

    this.results.push({
      test: 'concurrent_graph',
      concurrency,
      operations,
      duration,
      success: successCount,
      failed: failCount,
      throughput,
    });
  }

  /**
   * 生成报告
   */
  generateReport() {
    console.log('\n========================================');
    console.log('Graph Performance Report');
    console.log('========================================\n');

    this.results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.test}`);
      console.log('-'.repeat(40));
      Object.entries(result).forEach(([key, value]) => {
        if (key !== 'test' && typeof value === 'number') {
          console.log(`   ${key}: ${value.toFixed ? value.toFixed(2) : value}`);
        } else if (key !== 'test') {
          console.log(`   ${key}: ${value}`);
        }
      });
      console.log('');
    });

    // 保存详细报告
    const reportPath = 'graph-performance-report.json';
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
    console.log('🌐 Starting Graph Performance Tests\n');

    try {
      await this.testRelationCreation();
      await this.testRelationQuery();
      await this.testGraphTraversal();
      await this.testComplexGraphQueries();
      await this.testConcurrentGraphOperations();
      this.generateReport();

      console.log('\n✅ All graph performance tests completed!');
    } catch (e) {
      console.error('\n❌ Graph test failed:', e);
      throw e;
    }
  }
}

// 运行测试
const test = new GraphPerformanceTest();
test.run().catch(console.error);
