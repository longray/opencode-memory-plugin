/**
 * Integration Test Suite for OpenCode Memory Plugin v2.0
 * Tests wrapper-client, project-resolver, upload-queue, and plugin tools
 */

import { WrapperClient } from './lib/wrapper-client.js';
import { ProjectResolver, resolveProjectId } from './lib/project-resolver.js';
import * as uploadQueue from './lib/upload-queue.js';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');

// Test configuration
const TEST_CONFIG = {
  backend: {
    enabled: true,
    url: 'http://localhost:17999',
    tenant_id: 'test_user',
    timeout: 30000,
  },
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function test(name, fn) {
  return async () => {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`✅ ${name}`);
    } catch (e) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: e.message });
      console.log(`❌ ${name}: ${e.message}`);
    }
  };
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion failed');
  }
}

// ==================== Tests ====================

const tests = [
  // Wrapper Client Tests
  test('WrapperClient - Health Check', async () => {
    const client = new WrapperClient(TEST_CONFIG);
    const health = await client.health();
    assertEqual(health.status, 'healthy', 'Health status');
    assertTrue(health.embedding_service, 'Embedding service exists');
    assertTrue(health.surrealdb, 'SurrealDB exists');
  }),

  test('WrapperClient - Search (keyword)', async () => {
    const client = new WrapperClient(TEST_CONFIG);
    const result = await client.search({
      query: '测试',
      mode: 'keyword',
      limit: 5,
      tenant_id: 'test_user',
    });
    assertTrue(Array.isArray(result.results), 'Results is array');
    assertTrue(result.total >= 0, 'Total is number');
  }),

  test('WrapperClient - Search (hybrid)', async () => {
    const client = new WrapperClient(TEST_CONFIG);
    const result = await client.search({
      query: 'Python programming',
      mode: 'hybrid',
      limit: 5,
      threshold: 0.3,
      tenant_id: 'test_user',
    });
    assertTrue(Array.isArray(result.results), 'Results is array');
    assertEqual(result.mode, 'hybrid', 'Mode is hybrid');
  }),

  test('WrapperClient - Upload Memory', async () => {
    const client = new WrapperClient(TEST_CONFIG);
    const testContent = `Test memory ${Date.now()}`;
    const result = await client.uploadMemory({
      content: testContent,
      type: 'test',
      tags: ['test', 'integration'],
      project_id: 'test_project',
      tenant_id: 'test_user',
    });
    assertTrue(result.id, 'Memory ID returned');
    assertTrue(result.success, 'Upload successful');
    console.log(`   Memory ID: ${result.id}`);
  }),

  test('WrapperClient - Batch Upload', async () => {
    const client = new WrapperClient(TEST_CONFIG);
    const memories = [
      { content: 'Batch test 1', type: 'test', tenant_id: 'test_user' },
      { content: 'Batch test 2', type: 'test', tenant_id: 'test_user' },
    ];
    const result = await client.uploadMemories(memories);
    assertTrue(result.total >= 0, 'Total count');
    assertTrue(result.success >= 0, 'Success count');
    console.log(`   Uploaded: ${result.success}/${result.total}`);
  }),

  // Project Resolver Tests
  test('ProjectResolver - Resolve with env', async () => {
    process.env.MEMORY_PROJECT_ID = 'env_project';
    const resolver = new ProjectResolver({
      backend: {
        project_resolution: {
          strategy: 'auto',
          priority: ['env'],
        },
      },
    });
    const projectId = await resolver.resolve();
    assertEqual(projectId, 'env_project', 'Project ID from env');
    delete process.env.MEMORY_PROJECT_ID;
  }),

  test('ProjectResolver - Resolve with dirname', async () => {
    const resolver = new ProjectResolver({
      backend: {
        project_resolution: {
          strategy: 'auto',
          priority: ['dirname'],
        },
      },
    });
    const projectId = await resolver.resolve();
    assertTrue(projectId.length > 0, 'Project ID resolved');
    console.log(`   Project ID: ${projectId}`);
  }),

  test('ProjectResolver - Save and load mapping', async () => {
    const resolver = new ProjectResolver(TEST_CONFIG);
    await resolver.saveMapping('my_test_project');

    const resolver2 = new ProjectResolver({
      backend: {
        project_resolution: {
          strategy: 'auto',
          priority: ['mapping'],
        },
      },
    });
    const projectId = await resolver2.resolve();
    assertEqual(projectId, 'my_test_project', 'Project ID from mapping');
  }),

  // Upload Queue Tests
  test('UploadQueue - Add and get pending', () => {
    uploadQueue.clearQueue();
    uploadQueue.addToQueue({
      content: 'Test queue item',
      type: 'test',
    });

    const pending = uploadQueue.getPendingUploads();
    assertTrue(pending.length > 0, 'Pending uploads exist');
    assertEqual(pending[0].memory.content, 'Test queue item', 'Content matches');
  }),

  test('UploadQueue - Queue stats', () => {
    const stats = uploadQueue.getQueueStats();
    assertTrue(stats.total >= 0, 'Total count');
    assertTrue(stats.pending >= 0, 'Pending count');
    console.log(`   Queue: ${stats.pending} pending, ${stats.exhausted} exhausted`);
  }),

  test('UploadQueue - Remove from queue', () => {
    uploadQueue.clearQueue();
    uploadQueue.addToQueue({ content: 'To be removed' });

    const pending = uploadQueue.getPendingUploads();
    const result = uploadQueue.removeFromQueue(pending[0].index);
    assertTrue(result, 'Remove successful');

    const pending2 = uploadQueue.getPendingUploads();
    assertEqual(pending2.length, 0, 'Queue empty after remove');
  }),

  // Integration Tests
  test('Integration - Upload and Search', async () => {
    const client = new WrapperClient(TEST_CONFIG);
    const testContent = `Integration test ${Date.now()} Python async patterns`;

    // Upload
    const uploadResult = await client.uploadMemory({
      content: testContent,
      type: 'test',
      tags: ['integration', 'python'],
      project_id: 'integration_test',
      tenant_id: 'test_user',
    });
    assertTrue(uploadResult.id, 'Upload succeeded');

    // Wait a bit for indexing
    await new Promise(r => setTimeout(r, 1000));

    // Search
    const searchResult = await client.search({
      query: 'Python async',
      mode: 'hybrid',
      limit: 10,
      tenant_id: 'test_user',
    });
    assertTrue(searchResult.results.length > 0, 'Found results');

    const found = searchResult.results.some(
      r => r.content && r.content.includes('Python async patterns')
    );
    assertTrue(found, 'Found uploaded content');
  }),

  test('Integration - Graph Relations', async () => {
    const client = new WrapperClient(TEST_CONFIG);

    // Upload two memories
    const mem1 = await client.uploadMemory({
      content: 'Parent memory for graph test',
      type: 'test',
      tenant_id: 'test_user',
    });

    const mem2 = await client.uploadMemory({
      content: 'Child memory for graph test',
      type: 'test',
      tenant_id: 'test_user',
    });

    // Create relation
    const relation = await client.createRelation({
      from_id: mem1.id,
      to_id: mem2.id,
      relationship_type: 'related',
      weight: 0.8,
      tenant_id: 'test_user',
    });
    assertTrue(relation.id, 'Relation created');
    console.log(`   Relation ID: ${relation.id}`);

    // Query relations
    const relations = await client.getRelations({
      memory_id: mem1.id,
      direction: 'outgoing',
      tenant_id: 'test_user',
    });
    assertTrue(relations.relations.length > 0, 'Found relations');

    // Graph traversal
    const graph = await client.traverseGraph({
      memory_id: mem1.id,
      depth: 1,
      tenant_id: 'test_user',
    });
    assertTrue(graph.memories.length > 0, 'Graph traversal found memories');
  }),
];

// ==================== Run Tests ====================

async function runTests() {
  console.log('========================================');
  console.log('OpenCode Memory Plugin v2.0 - Test Suite');
  console.log('========================================\n');

  const startTime = Date.now();

  for (const testFn of tests) {
    await testFn();
  }

  const duration = Date.now() - startTime;

  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  console.log(`Total: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Duration: ${duration}ms`);
  console.log('========================================');

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  ❌ ${t.name}: ${t.error}`));
    process.exit(1);
  }

  console.log('\n🎉 All tests passed!');
}

runTests().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});
