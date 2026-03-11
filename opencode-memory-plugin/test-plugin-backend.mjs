import { WrapperClient } from './lib/wrapper-client.js';
import { resolveProjectId } from './lib/project-resolver.js';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

function getConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function generateSourceId(content, type, tags, tenantId, projectId) {
  const normalizedTags = (tags || []).sort().join(',');
  const data = `${tenantId}:${projectId}:${content}:${type}:${normalizedTags}`;
  return createHash('md5').update(data).digest('hex');
}

console.log('直接测试 plugin.js 后端调用逻辑\n');
console.log('================================\n');

const config = getConfig();
console.log('1. Config 加载:', config ? '✅ 成功' : '❌ 失败');

if (config) {
  console.log('2. Backend 配置:', config.backend);
  console.log('3. Backend enabled:', config.backend?.enabled);
  
  const backendEnabled = config?.backend?.enabled !== false;
  console.log('4. 条件判断 (enabled !== false):', backendEnabled);
  
  if (backendEnabled) {
    console.log('\n5. 尝试调用后端...\n');
    
    const client = new WrapperClient(config);
    
    resolveProjectId(config).then(async (projectId) => {
      console.log('   Project ID:', projectId);
      
      const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';
      console.log('   Tenant ID:', tenantId);
      
      const testContent = '直接测试后端调用 ' + Date.now();
      const sourceId = generateSourceId(testContent, 'test', ['direct'], tenantId, projectId);
      
      const memory = {
        content: testContent,
        type: 'test',
        tags: ['direct', 'test'],
        project_id: projectId,
        source_id: sourceId,
        tenant_id: tenantId,
        source: 'plugin',
        metadata: { test: true }
      };
      
      console.log('   Memory 数据:', JSON.stringify(memory, null, 2));
      
      try {
        const result = await client.uploadMemory(memory);
        console.log('\n   ✅ 后端调用成功!');
        console.log('   Memory ID:', result.id);
        console.log('   Success:', result.success);
      } catch (e) {
        console.log('\n   ❌ 后端调用失败!');
        console.log('   错误:', e.message);
      }
    });
  }
}
