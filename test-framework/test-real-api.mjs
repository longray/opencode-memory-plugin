#!/usr/bin/env node

/**
 * 真实API测试脚本
 * 验证ModelScope API集成是否正常工作
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testRealAPI() {
  const apiKey = process.env.MODELSCOPE_API_KEY;

  if (!apiKey) {
    console.log('\n❌ 未设置 MODELSCOPE_API_KEY');
    console.log('请设置环境变量:');
    console.log('  export MODELSCOPE_API_KEY=your-api-key-here');
    console.log('\n或者跳过此测试，继续使用Mock模式');
    return false;
  }

  console.log('\n🌐 测试真实API集成\n');

  const endpoint = process.env.EMBEDDING_ENDPOINT || 'https://api-inference.modelscope.cn/v1/embeddings';
  const model = process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-0.6B';

  console.log(`端点: ${endpoint}`);
  console.log(`模型: ${model}`);
  console.log(`API Key: ${apiKey.slice(0, 8)}***\n`);

  // 测试1: 简单文本embedding
  console.log('测试1: 生成简单文本embedding');
  try {
    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: 'TypeScript类型检查',
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    let embedding;
    if (data.data && data.data[0] && data.data[0].embedding) {
      embedding = data.data[0].embedding;
    } else if (Array.isArray(data) && data[0] && data[0].embedding) {
      embedding = data[0].embedding;
    } else if (data.embeddings) {
      embedding = data.embeddings[0];
    } else {
      console.error('未知响应格式:', JSON.stringify(data, null, 2));
      throw new Error('Unknown API response format');
    }

    console.log(`✅ 成功！`);
    console.log(`   耗时: ${duration}ms`);
    console.log(`   维度: ${embedding.length}`);
    console.log(`   前5个值: [${embedding.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);

    return {
      success: true,
      duration,
      dimensions: embedding.length,
      embedding: embedding.slice(0, 5),
    };
  } catch (error) {
    console.log(`❌ 失败: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function testBatchEmbedding() {
  const apiKey = process.env.MODELSCOPE_API_KEY;

  if (!apiKey) {
    console.log('\n⚠️ 跳过批量测试（未设置API Key）');
    return false;
  }

  console.log('\n📦 测试批量embedding\n');

  const endpoint = process.env.EMBEDDING_ENDPOINT || 'https://api-inference.modelscope.cn/v1/embeddings';
  const model = process.env.EMBEDDING_MODEL || 'Qwen/Qwen3-Embedding-0.6B';

  const texts = [
    'TypeScript类型检查',
    'PostgreSQL数据库优化',
    'Redis缓存实现',
    '用户偏好设置',
    '代码风格指南',
  ];

  try {
    const startTime = Date.now();

    // 批量请求
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        input: texts,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    let embeddings;
    if (data.data && Array.isArray(data.data)) {
      embeddings = data.data.map(item => item.embedding);
    } else if (Array.isArray(data)) {
      embeddings = data.map(item => item.embedding);
    } else if (data.embeddings) {
      embeddings = data.embeddings;
    } else {
      console.error('未知响应格式:', JSON.stringify(data, null, 2));
      throw new Error('Unknown API response format');
    }

    console.log(`✅ 批量成功！`);
    console.log(`   数量: ${embeddings.length}`);
    console.log(`   总耗时: ${duration}ms`);
    console.log(`   平均耗时: ${(duration / embeddings.length).toFixed(2)}ms`);
    console.log(`   维度: ${embeddings[0].length}`);

    return {
      success: true,
      count: embeddings.length,
      totalDuration: duration,
      avgDuration: duration / embeddings.length,
      dimensions: embeddings[0].length,
    };
  } catch (error) {
    console.log(`❌ 批量失败: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function saveReport(results) {
  const reportPath = path.join(__dirname, '..', 'test-results', 'real-api-test-report.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n✅ 测试报告已保存: ${reportPath}`);
}

async function main() {
  console.log('🧪 真实API集成测试\n');

  const results = {
    timestamp: new Date().toISOString(),
    singleTest: null,
    batchTest: null,
    summary: null,
  };

  // 测试1: 单个embedding
  results.singleTest = await testRealAPI();

  // 测试2: 批量embedding
  results.batchTest = await testBatchEmbedding();

  // 生成总结
  if (results.singleTest && results.batchTest) {
    const success = results.singleTest.success && results.batchTest.success;
    results.summary = {
      success,
      message: success ? '✅ 所有测试通过' : '❌ 部分测试失败',
    };
  }

  // 保存报告
  await saveReport(results);

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试总结');
  console.log('='.repeat(60));

  if (results.summary && results.summary.success) {
    console.log('✅ 真实API集成测试通过！');
    console.log('');
    console.log('📌 建议:');
    console.log('   1. 使用真实API模式运行完整测试套件');
    console.log('   2. 对比Mock和Real模式的性能差异');
    console.log('   3. 基于真实API数据重新评估偏差率');
  } else {
    console.log('⚠️  真实API集成测试未通过');
    console.log('');
    console.log('📌 建议:');
    console.log('   1. 检查API Key是否正确');
    console.log('   2. 检查网络连接');
    console.log('   3. 检查API端点是否正确');
  }

  console.log('='.repeat(60));
}

main();
