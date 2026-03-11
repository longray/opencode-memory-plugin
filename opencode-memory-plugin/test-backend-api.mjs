/**
 * 后端功能全面测试
 * 测试所有调用后端服务的工具
 */

import { WrapperClient } from './lib/wrapper-client.js';
import { resolveProjectId } from './lib/project-resolver.js';
import { createHash } from 'crypto';

// Helper function to generate source ID
function generateSourceId(content, type, tags, tenantId, projectId) {
  const normalizedTags = (tags || []).sort().join(',');
  const data = `${tenantId}:${projectId}:${content}:${type}:${normalizedTags}`;
  return createHash('md5').update(data).digest('hex');
}


const TEST_CONFIG = {
  backend: {
    enabled: true,
    url: 'http://localhost:17999',
    tenant_id: 'backend_test_user',
    timeout: 30000
  }
};

const client = new WrapperClient(TEST_CONFIG);

console.log('========================================');
console.log('后端功能全面测试');
console.log('========================================\n');

async function testBackendHealth() {
  console.log('1️⃣ 测试后端健康检查');
  console.log('----------------------------------------');
  
  try {
    const health = await client.health();
    console.log(`✅ Backend Status: ${health.status}`);
    console.log(`   Version: ${health.version}`);
    console.log(`   Embedding: ${health.embedding_service?.status}`);
    console.log(`   SurrealDB: ${health.surrealdb?.status}`);
    console.log(`   Cache Hit Rate: ${health.cache_stats?.hit_rate?.toFixed(1) || 0}%`);
    return true;
  } catch (e) {
    console.log(`❌ Backend Error: ${e.message}`);
    return false;
  }
}

async function testUploadMemory() {
  console.log('\n2️⃣ 测试单条记忆上传');
  console.log('----------------------------------------');
  
  try {
    const testContent = `Test memory ${Date.now()}`;
    const projectId = await resolveProjectId(TEST_CONFIG);
    const tenantId = TEST_CONFIG.backend.tenant_id;
    const sourceId = generateSourceId(testContent, 'test', ['backend'], tenantId, projectId);
    
    const result = await client.uploadMemory({
      content: testContent,
      type: 'test',
      tags: ['backend', 'upload'],
      project_id: projectId,
      source_id: sourceId,
      tenant_id: tenantId
    });
    
    console.log(`✅ Upload Success`);
    console.log(`   Memory ID: ${result.id}`);
    return result.id;
  } catch (e) {
    console.log(`❌ Upload Error: ${e.message}`);
    return null;
  }
}

async function testSearchModes() {
  console.log('\n3️⃣ 测试三种搜索模式');
  console.log('----------------------------------------');
  
  const modes = ['keyword', 'vector', 'hybrid'];
  const query = 'test';
  
  for (const mode of modes) {
    try {
      const start = Date.now();
      const result = await client.search({
        query,
        mode,
        limit: 5,
        tenant_id: TEST_CONFIG.backend.tenant_id
      });
      const duration = Date.now() - start;
      
      console.log(`✅ ${mode.toUpperCase()} Search: ${duration}ms`);
      console.log(`   Found: ${result.total} results`);
    } catch (e) {
      console.log(`❌ ${mode.toUpperCase()} Search Error: ${e.message}`);
    }
  }
}

async function testBatchUpload() {
  console.log('\n4️⃣ 测试批量上传');
  console.log('----------------------------------------');
  
  const memories = [];
  for (let i = 0; i < 5; i++) {
    memories.push({
      content: `Batch test ${i} ${Date.now()}`,
      type: 'test',
      tags: ['batch'],
      tenant_id: TEST_CONFIG.backend.tenant_id
    });
  }
  
  try {
    const start = Date.now();
    const result = await client.uploadMemories(memories);
    const duration = Date.now() - start;
    
    console.log(`✅ Batch Upload: ${duration}ms`);
    console.log(`   Total: ${result.total}`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Failed: ${result.failed}`);
  } catch (e) {
    console.log(`❌ Batch Upload Error: ${e.message}`);
  }
}

async function testGraphRelations(memoryId) {
  console.log('\n5️⃣ 测试图关系功能');
  console.log('----------------------------------------');
  
  if (!memoryId) {
    console.log('⚠️ Skipping: No memory ID');
    return;
  }
  
  // Create another memory for relation
  let targetId;
  try {
    const projectId = await resolveProjectId(TEST_CONFIG);
    const result = await client.uploadMemory({
      content: 'Target memory for relation',
      type: 'test',
      tags: ['relation-target'],
      project_id: projectId,
      tenant_id: TEST_CONFIG.backend.tenant_id
    });
    targetId = result.id;
    console.log(`✅ Created target memory: ${targetId}`);
  } catch (e) {
    console.log(`❌ Create Target Error: ${e.message}`);
    return;
  }
  
  // Create relation
  try {
    const relation = await client.createRelation({
      from_id: memoryId,
      to_id: targetId,
      relationship_type: 'related',
      weight: 0.8,
      tenant_id: TEST_CONFIG.backend.tenant_id
    });
    console.log(`✅ Created relation: ${relation.id}`);
  } catch (e) {
    console.log(`❌ Create Relation Error: ${e.message}`);
  }
  
  // Query relations
  try {
    const relations = await client.getRelations({
      memory_id: memoryId,
      direction: 'outgoing',
      tenant_id: TEST_CONFIG.backend.tenant_id
    });
    console.log(`✅ Queried relations: ${relations.total} found`);
  } catch (e) {
    console.log(`❌ Query Relations Error: ${e.message}`);
  }
  
  // Graph traversal
  try {
    const graph = await client.traverseGraph({
      memory_id: memoryId,
      depth: 1,
      tenant_id: TEST_CONFIG.backend.tenant_id
    });
    console.log(`✅ Graph traversal: ${graph.total} nodes found`);
  } catch (e) {
    console.log(`❌ Graph Traversal Error: ${e.message}`);
  }
}

async function testEmbedding() {
  console.log('\n6️⃣ 测试 Embedding 服务');
  console.log('----------------------------------------');
  
  const texts = [
    'Short text',
    'Medium length text for testing',
    'Long text with more content for better testing'
  ];
  
  for (const text of texts) {
    try {
      const start = Date.now();
      const embedding = await client.getEmbedding(text);
      const duration = Date.now() - start;
      
      console.log(`✅ Embedding (${text.length} chars): ${duration}ms`);
      console.log(`   Dimensions: ${embedding.length}`);
    } catch (e) {
      console.log(`❌ Embedding Error: ${e.message}`);
    }
  }
}

async function runAllTests() {
  console.log(`开始测试时间: ${new Date().toLocaleString()}\n`);
  
  // Test 1: Health
  const healthy = await testBackendHealth();
  if (!healthy) {
    console.log('\n❌ Backend not healthy, stopping tests');
    process.exit(1);
  }
  
  // Test 2: Upload
  const memoryId = await testUploadMemory();
  
  // Test 3: Search
  await testSearchModes();
  
  // Test 4: Batch Upload
  await testBatchUpload();
  
  // Test 5: Graph Relations
  await testGraphRelations(memoryId);
  
  // Test 6: Embedding
  await testEmbedding();
  
  console.log('\n========================================');
  console.log('后端功能测试完成！');
  console.log('========================================');
}

runAllTests().catch(console.error);
