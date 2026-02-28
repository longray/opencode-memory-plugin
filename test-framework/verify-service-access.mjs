#!/usr/bin/env node
/**
 * 验证是否真的访问了 localhost:18000 嵌入服务
 */

import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';

async function verifyEmbeddingServiceAccess() {
  console.log('🔍 验证嵌入服务访问...\n');
  console.log('目标服务端点: http://localhost:18000/v1/embeddings\n');
  
  const tools = new MockOpenCodeToolsV5({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
    maxBatchSize: 64,
  });
  
  const testTexts = [
    '这是第一条测试文本',
    '这是第二条测试文本',
    '这是第三条测试文本',
  ];
  
  console.log('开始预生成 embedding...');
  console.log(`测试数据: ${testTexts.length} 条\n`);
  
  const startTime = Date.now();
  
  try {
    await tools.preGenerateEmbeddings(testTexts);
    
    const duration = Date.now() - startTime;
    
    console.log('\n✅ 预生成完成！');
    console.log(`总耗时: ${duration}ms`);
    console.log(`API 调用次数: ${tools.stats.batchApiCalls} 次`);
    console.log(`缓存大小: ${tools.embeddingCache.size} 条`);
    
    // 验证是否真的调用了 API
    if (tools.stats.batchApiCalls > 0) {
      console.log('\n🎉 成功验证了嵌入服务访问！');
      console.log(`   实际进行了 ${tools.stats.batchApiCalls} 次 API 调用`);
      console.log(`   服务端点: http://localhost:18000/v1/embeddings`);
    } else {
      console.log('\n⚠️ 警告: 未检测到 API 调用');
      console.log('   可能使用了 mock 模式或缓存');
    }
    
  } catch (error) {
    console.error('\n❌ 预生成失败:', error.message);
    console.error('   可能原因: 嵌入服务未启动或无法访问');
    console.error('   请检查服务是否运行在 http://localhost:18000');
  }
}

// 运行验证
verifyEmbeddingServiceAccess();
