#!/usr/bin/env node
/**
 * 功能完整性测试脚本
 * 测试 OpenCode Memory Plugin 的所有核心功能
 */


import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

// 测试结果记录
const testResults = {
  passed: [],
  failed: [],
  skipped: []
};

// 辅助函数：记录测试结果
function recordTest(name, passed, message, details = {}) {
  const result = {
    name,
    passed,
    message,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (passed) {
    testResults.passed.push(result);
    console.log(`✅ ${name}: ${message}`);
  } else {
    testResults.failed.push(result);
    console.log(`❌ ${name}: ${message}`);
  }

  return passed;
}

// 辅助函数：跳过测试
function skipTest(name, reason) {
  testResults.skipped.push({
    name,
    reason,
    timestamp: new Date().toISOString()
  });
  console.log(`⏭️  ${name}: ${reason}`);
}

// 测试1：检查配置文件
function testConfigurationFile() {
  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configContent);

    return recordTest(
      '配置文件读取',
      true,
      '配置文件存在且格式正确',
      { version: config.version, embeddingEnabled: config.embedding?.enabled }
    );
  } catch (error) {
    return recordTest(
      '配置文件读取',
      false,
      `配置文件读取失败: ${error.message}`
    );
  }
}

// 测试2：检查配置值
function testConfigurationValues() {
  try {
    const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configContent);

    const checks = [];

    // 检查版本
    checks.push(config.version === '2.0' ? '版本正确' : `版本错误: ${config.version}`);

    // 检查搜索模式
    const validModes = ['hybrid', 'vector', 'bm25', 'hash'];
    checks.push(validModes.includes(config.search?.mode) ? '搜索模式有效' : `搜索模式无效: ${config.search?.mode}`);

    // 检查embedding配置
    checks.push(config.embedding?.enabled !== undefined ? 'Embedding配置存在' : 'Embedding配置缺失');

    // 检查外部服务配置
    const isExternalService = config.embedding?.provider === 'external';
    checks.push(isExternalService ? '使用外部embedding服务' : '未使用外部embedding服务');

    // 检查端点配置
    checks.push(config.embedding?.endpoint ? 'Embedding端点已配置' : 'Embedding端点未配置');

    // 检查模型配置
    checks.push(config.embedding?.model ? '模型已配置' : '模型未配置');

    const allPassed = checks.every(check => check.includes('正确') || check.includes('有效') || check.includes('存在') || check.includes('使用') || check.includes('已配置'));

    return recordTest(
      '配置值验证',
      allPassed,
      allPassed ? '所有配置值正确' : '部分配置值有误',
      { checks }
    );
  } catch (error) {
    return recordTest(
      '配置值验证',
      false,
      `配置验证失败: ${error.message}`
    );
  }
}

// 测试3：检查记忆文件
function testMemoryFiles() {
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md'];
  const checks = [];

  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    const exists = fs.existsSync(filePath);

    checks.push({
      file,
      exists,
      size: exists ? fs.statSync(filePath).size : 0
    });
  }

  const allExist = checks.every(check => check.exists);

  return recordTest(
    '记忆文件检查',
    allExist,
    allExist ? '所有核心记忆文件存在' : '部分核心记忆文件缺失',
    { files: checks }
  );
}

// 测试4：检查每日日志目录
function testDailyLogs() {
  const dailyDir = path.join(MEMORY_DIR, 'daily');

  try {
    if (!fs.existsSync(dailyDir)) {
      return recordTest(
        '每日日志目录',
        false,
        '每日日志目录不存在'
      );
    }

    const dailyFiles = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse();

    return recordTest(
      '每日日志目录',
      true,
      `每日日志目录存在，包含 ${dailyFiles.length} 个文件`,
      { fileCount: dailyFiles.length, files: dailyFiles.slice(0, 5) }
    );
  } catch (error) {
    return recordTest(
      '每日日志目录',
      false,
      `检查失败: ${error.message}`
    );
  }
}

// 测试5：检查向量索引数据库
function testVectorIndexDatabase() {
  const dbPath = path.join(MEMORY_DIR, 'vector-index.db');

  try {
    if (!fs.existsSync(dbPath)) {
      return recordTest(
        '向量索引数据库',
        false,
        '向量索引数据库不存在'
      );
    }

    const stats = fs.statSync(dbPath);

    return recordTest(
      '向量索引数据库',
      true,
      `向量索引数据库存在，大小: ${(stats.size / 1024).toFixed(2)} KB`,
      { size: stats.size, lastModified: stats.mtime }
    );
  } catch (error) {
    return recordTest(
      '向量索引数据库',
      false,
      `检查失败: ${error.message}`
    );
  }
}

// 测试6：检查环境变量
function testEnvironmentVariables() {
  const checks = [];

  // 检查 MODELSCOPE_API_KEY
  const apiKey = process.env.MODELSCOPE_API_KEY;
  if (apiKey) {
    checks.push({
      variable: 'MODELSCOPE_API_KEY',
      status: 'set',
      length: apiKey.length
    });
  } else {
    checks.push({
      variable: 'MODELSCOPE_API_KEY',
      status: 'not set'
    });
  }

  const apiKeySet = apiKey && apiKey.length > 0;

  return recordTest(
    '环境变量检查',
    apiKeySet,
    apiKeySet ? 'MODELSCOPE_API_KEY 已设置' : 'MODELSCOPE_API_KEY 未设置',
    { checks }
  );
}

// 测试7：测试外部embedding服务连接
async function testExternalEmbeddingService() {
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
  const config = JSON.parse(configContent);

  if (!config.embedding?.enabled) {
    skipTest('外部embedding服务连接', 'Embedding未启用');
    return true;
  }

  if (config.embedding?.provider !== 'external') {
    skipTest('外部embedding服务连接', '未使用外部embedding服务');
    return true;
  }

  const endpoint = config.embedding.endpoint;

  try {
    console.log(`正在测试连接到: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODELSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-Embedding-0.6B',
        input: 'test connection',
        encoding_format: 'float'
      })
    });

    if (!response.ok) {
      return recordTest(
        '外部embedding服务连接',
        false,
        `HTTP ${response.status}: ${await response.text()}`
      );
    }

    const data = await response.json();

    if (!data || !data.data || !Array.isArray(data.data) || !data.data[0]) {
      return recordTest(
        '外部embedding服务连接',
        false,
        '响应格式无效'
      );
    }

    const embedding = data.data[0].embedding || data.data[0];

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return recordTest(
        '外部embedding服务连接',
        false,
        'Embedding向量无效'
      );
    }

    return recordTest(
      '外部embedding服务连接',
      true,
      `成功连接，向量维度: ${embedding.length}`,
      { dimensions: embedding.length, sampleValue: embedding[0] }
    );
  } catch (error) {
    return recordTest(
      '外部embedding服务连接',
      false,
      `连接失败: ${error.message}`
    );
  }
}

// 测试8：测试本地embedding服务回退
async function testLocalServiceFallback() {
  const localEndpoint = 'http://localhost:18000/v1/embeddings';

  try {
    console.log(`正在测试本地服务: ${localEndpoint}`);

    const response = await fetch(localEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: 'test connection',
        model: 'Qwen3-Embedding-0.6B',
        encoding_format: 'float',
        normalize: true
      })
    });

    if (!response.ok) {
      return recordTest(
        '本地embedding服务回退',
        false,
        `HTTP ${response.status}: ${await response.text()}`
      );
    }

    const data = await response.json();

    if (!data) {
      return recordTest(
        '本地embedding服务回退',
        false,
        '本地服务响应为空'
      );
    }

    // 检查多种响应格式
    let embedding = null;

    if (data.data && Array.isArray(data.data) && data.data[0]) {
      embedding = data.data[0].embedding || data.data[0];
    } else if (Array.isArray(data)) {
      embedding = data;
    } else if (data.embeddings && Array.isArray(data.embeddings)) {
      embedding = data.embeddings;
    } else if (data.embedding && Array.isArray(data.embedding)) {
      embedding = data.embedding;
    }

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return recordTest(
        '本地embedding服务回退',
        false,
        'Embedding向量无效'
      );
    }

    return recordTest(
      '本地embedding服务回退',
      true,
      `本地服务可用，向量维度: ${embedding.length}`,
      { dimensions: embedding.length, sampleValue: embedding[0] }
    );
  } catch (error) {
    // 本地服务不可用不是严重问题，因为优先使用ModelScope API
    return recordTest(
      '本地embedding服务回退',
      false,
      `本地服务不可用（可接受）: ${error.message}`
    );
  }
}

// 主测试函数
async function runAllTests() {
  console.log('🧪 开始功能完整性测试\n');
  console.log('='.repeat(60));

  // 基础测试
  console.log('\n📋 基础配置测试');
  console.log('-'.repeat(60));
  testConfigurationFile();
  testConfigurationValues();
  testMemoryFiles();
  testDailyLogs();
  testVectorIndexDatabase();
  testEnvironmentVariables();

  // 服务测试
  console.log('\n🌐 外部服务测试');
  console.log('-'.repeat(60));
  await testExternalEmbeddingService();
  await testLocalServiceFallback();

  // 生成测试报告
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${testResults.passed.length}`);
  console.log(`❌ 失败: ${testResults.failed.length}`);
  console.log(`⏭️  跳过: ${testResults.skipped.length}`);
  console.log(`📋 总计: ${testResults.passed.length + testResults.failed.length + testResults.skipped.length}`);

  // 保存测试结果
  const testReportPath = path.join(MEMORY_DIR, 'test-report.json');
  fs.writeFileSync(testReportPath, JSON.stringify(testResults, null, 2));

  console.log(`\n📄 详细报告已保存到: ${testReportPath}`);

  // 返回总体结果
  const allPassed = testResults.failed.length === 0;
  console.log(`\n${allPassed ? '🎉 所有测试通过！' : '⚠️  部分测试失败，请检查详细信息。'}`);

  return allPassed;
}

// 运行测试
runAllTests().catch(error => {
  console.error('❌ 测试执行失败:', error);
  process.exit(1);
});
