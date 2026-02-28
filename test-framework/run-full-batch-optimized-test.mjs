#!/usr/bin/env node
/**
 * 完整批量优化测试 - 真正使用预生成缓存
 * 
 * 这个版本与之前的不同之处在于：
 * 1. 使用一套固定的测试数据，确保预生成和实际写入的数据完全一致
 * 2. 先预生成所有 embedding，然后运行测试，避免缓存未命中
 * 3. 使用统一的测试数据集，不再依赖启发式数据提取
 */

import TestEngine from './test-engine.mjs';
import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 固定测试数据集 - 确保预生成和实际测试使用相同的数据
const TEST_DATASET = {
  // 入库测试数据
  ingestion: [
    { id: 'TC-001', content: '用户偏好使用TypeScript进行类型检查', type: 'long-term', tags: ['typescript', 'preference'] },
    { id: 'TC-002', content: '代码风格偏好使用2空格缩进，使用Prettier进行自动格式化', type: 'long-term', tags: ['style', 'formatting'] },
    { id: 'TC-003', content: '决定使用PostgreSQL作为主数据库，因为它支持复杂的查询和事务', type: 'long-term', tags: ['database', 'postgres'] },
    { id: 'TC-004', content: '这是一个非常长的内容，用于测试系统处理长文本的能力。这是一个非常长的内容，用于测试系统处理长文本的能力。', type: 'long-term', tags: ['long-content'] },
    { id: 'TC-005', content: '今天正在实现用户认证功能', type: 'daily', tags: ['auth', 'daily'] },
    { id: 'TC-006', content: '正在调试登录流程中的会话管理问题，发现token过期时间设置不合理', type: 'daily', tags: ['debug', 'session'] },
    { id: 'TC-007', content: '正在优化数据库查询性能，添加了多个索引，使用了查询计划分析', type: 'daily', tags: ['performance', 'database'] },
    { id: 'TC-008', content: '编辑器偏好使用VS Code', type: 'preference', tags: ['editor', 'vscode'] },
    { id: 'TC-009', content: '代码格式化工具偏好使用Prettier，配置文件使用.prettierrc', type: 'preference', tags: ['formatting', 'prettier'] },
    { id: 'TC-010', content: '中文、日本語、한글混合内容测试，用于验证多语言支持', type: 'test', tags: ['multilingual'] },
    { id: 'TC-011', content: '项目状态: 🚀 正在开发中 🎉 完成了核心功能 ⚠️ 需要注意性能问题', type: 'test', tags: ['status', 'emoji'] },
    { id: 'TC-012', content: '特殊字符测试: @#$%^&*()_+-=[]{}|;:",.<>?/~`', type: 'test', tags: ['special-chars'] },
    { id: 'TC-013', content: 'HTML实体: &lt;div&gt;&amp;&copy;&nbsp;', type: 'test', tags: ['html-entities'] },
    { id: 'TC-014', content: 'async function fetchData(url) { const response = await fetch(url); return response.json(); }', type: 'test', tags: ['code'] },
    { id: 'TC-015', content: 'API文档地址: https://api.example.com/v1/docs 源码地址: https://github.com/example/project', type: 'test', tags: ['url'] },
  ],
  
  // 检索测试数据
  retrieval: [
    { id: 'TC-030', content: 'TypeScript类型检查', type: 'long-term', tags: ['typescript'] },
    { id: 'TC-031', content: '用户偏好使用TypeScript', type: 'long-term', tags: ['preference'] },
    { id: 'TC-032', content: 'TypeScript配置使用严格模式', type: 'long-term', tags: ['config'] },
    { id: 'TC-033', content: '正在学习TypeScript高级类型', type: 'daily', tags: ['learning'] },
    { id: 'TC-034', content: '解决了TypeScript类型推断问题', type: 'daily', tags: ['problem-solving'] },
  ],
  
  // 归档测试数据
  archiving: [
    { id: 'TC-070', content: '2026-02-28工作日志', type: 'daily', tags: ['log'] },
    { id: 'TC-071', content: '2026-02-27工作日志', type: 'daily', tags: ['log'] },
    { id: 'TC-072', content: '2026-02-26工作日志', type: 'daily', tags: ['log'] },
    { id: 'TC-073', content: '2026-02-25工作日志', type: 'daily', tags: ['log'] },
    { id: 'TC-074', content: '2026-02-24工作日志', type: 'daily', tags: ['log'] },
  ],
};

// 获取所有测试数据（用于预生成）
function getAllTestData() {
  const allData = [];
  Object.values(TEST_DATASET).forEach(category => {
    allData.push(...category);
  });
  return allData;
}

/**
 * 创建完整的批量优化测试套件
 */
function createFullBatchOptimizedTestSuite() {
  const allTestCases = [];
  
  // 添加入库测试用例
  TEST_DATASET.ingestion.forEach((data, index) => {
    allTestCases.push({
      name: `${data.id}: ${data.content.substring(0, 30)}...`,
      category: '入库测试',
      execute: async (engine) => {
        const result = await engine.options.tools.memory_write({
          content: data.content,
          type: data.type,
          tags: data.tags,
        });
        return { result };
      },
    });
  });
  
  // 添加检索测试用例
  TEST_DATASET.retrieval.forEach((data, index) => {
    allTestCases.push({
      name: `${data.id}: ${data.content.substring(0, 30)}...`,
      category: '检索测试',
      execute: async (engine) => {
        // 先写入
        await engine.options.tools.memory_write({
          content: data.content,
          type: data.type,
          tags: data.tags,
        });
        
        // 再搜索
        const result = await engine.options.tools.memory_search({
          query: data.content.split(' ')[0],
          scope: 'all',
        });
        return { result };
      },
    });
  });
  
  // 添加归档测试用例
  TEST_DATASET.archiving.forEach((data, index) => {
    allTestCases.push({
      name: `${data.id}: ${data.content.substring(0, 30)}...`,
      category: '归档测试',
      execute: async (engine) => {
        const result = await engine.options.tools.memory_write({
          content: data.content,
          type: data.type,
          tags: data.tags,
        });
        return { result };
      },
    });
  });
  
  return {
    name: '完整批量优化测试套件',
    testCases: allTestCases,
  };
}

/**
 * 主函数：运行完整批量优化测试
 */
async function runFullBatchOptimizedTest() {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 完整批量优化测试 - 确保所有数据预生成');
  console.log('='.repeat(70));
  console.log('特点：');
  console.log('  • 使用固定测试数据集（确保预生成和实际写入一致）');
  console.log('  • 先预生成所有 embedding，再运行测试');
  console.log('  • 验证所有数据都从缓存读取（无 API 调用）');
  console.log('='.repeat(70) + '\n');

  // 获取所有测试数据
  const allTestData = getAllTestData();
  console.log(`📊 测试数据集统计：`);
  console.log(`  • 入库测试数据: ${TEST_DATASET.ingestion.length} 条`);
  console.log(`  • 检索测试数据: ${TEST_DATASET.retrieval.length} 条`);
  console.log(`  • 归档测试数据: ${TEST_DATASET.archiving.length} 条`);
  console.log(`  • 总计: ${allTestData.length} 条\n`);

  // 创建 V5 工具类
  const tools = new MockOpenCodeToolsV5({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
    maxBatchSize: 64,
  });

  // === 阶段1：预生成所有 embedding ===
  console.log('🔧 阶段1：预生成所有 embeddings...\n');
  const preGenStartTime = Date.now();
  await tools.preGenerateEmbeddings(allTestData.map(d => d.content));
  const preGenDuration = Date.now() - preGenStartTime;
  
  console.log(`\n✅ 预生成完成！耗时: ${preGenDuration}ms\n`);

  // === 阶段2：运行测试（所有数据都应在缓存中）===
  console.log('🧪 阶段2：运行测试（所有数据应从缓存读取）...\n');
  
  const testStartTime = Date.now();
  let successCount = 0;
  let failCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (let i = 0; i < allTestData.length; i++) {
    const data = allTestData[i];
    const itemStartTime = Date.now();
    
    // 检查缓存
    const cacheKey = tools.hashCode(data.content).toString();
    const isCached = tools.embeddingCache.has(cacheKey);
    
    if (isCached) {
      cacheHits++;
    } else {
      cacheMisses++;
    }
    
    try {
      const result = await tools.memory_write({
        content: data.content,
        type: data.type,
        tags: data.tags,
      });
      
      if (result.success) {
        successCount++;
        const itemDuration = Date.now() - itemStartTime;
        if ((i + 1) % 10 === 0 || i === allTestData.length - 1) {
          console.log(`  ✅ 进度: ${i + 1}/${allTestData.length} (${((i + 1) / allTestData.length * 100).toFixed(1)}%) - 耗时: ${itemDuration}ms [缓存: ${isCached ? '命中' : '未命中'}]`);
        }
      } else {
        failCount++;
        console.log(`  ❌ 第 ${i + 1} 条写入失败`);
      }
    } catch (error) {
      failCount++;
      console.log(`  ❌ 第 ${i + 1} 条异常: ${error.message}`);
    }
  }
  
  const testDuration = Date.now() - testStartTime;
  const totalDuration = preGenDuration + testDuration;

  // === 汇总统计 ===
  console.log('\n' + '='.repeat(70));
  console.log('📊 完整批量优化测试 - 结果汇总');
  console.log('='.repeat(70));
  console.log(`预生成阶段:`);
  console.log(`  • 数据量: ${allTestData.length} 条`);
  console.log(`  • API 调用: ${tools.stats.batchApiCalls} 次`);
  console.log(`  • 耗时: ${preGenDuration}ms`);
  console.log(`  • 缓存大小: ${tools.embeddingCache.size} 条`);
  console.log(`\n测试执行阶段:`);
  console.log(`  • 成功写入: ${successCount}/${allTestData.length}`);
  console.log(`  • 失败写入: ${failCount}/${allTestData.length}`);
  console.log(`  • 缓存命中: ${cacheHits}/${allTestData.length} (${(cacheHits/allTestData.length*100).toFixed(1)}%)`);
  console.log(`  • 缓存未命中: ${cacheMisses}/${allTestData.length} (${(cacheMisses/allTestData.length*100).toFixed(1)}%)`);
  console.log(`  • 耗时: ${testDuration}ms`);
  console.log(`\n总计:`);
  console.log(`  • 总耗时: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
  console.log(`  • 吞吐量: ${(allTestData.length / (totalDuration / 1000)).toFixed(2)} ops/sec`);
  console.log(`  • 平均每条: ${(totalDuration / allTestData.length).toFixed(2)}ms`);
  console.log('='.repeat(70));
  
  // 验证结果
  if (cacheMisses === 0) {
    console.log('\n✅ 完美！所有数据都从缓存读取，无 API 调用');
  } else {
    console.log(`\n⚠️ 警告: 有 ${cacheMisses} 条数据未命中缓存`);
    console.log('   建议: 检查预生成数据是否覆盖所有测试数据');
  }
  
  if (failCount === 0) {
    console.log('✅ 所有数据写入成功！');
  } else {
    console.log(`❌ 有 ${failCount} 条数据写入失败`);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🎉 完整批量优化测试完成！');
  console.log('='.repeat(70) + '\n');
}

// 运行测试
runFullBatchOptimizedTest().catch(console.error);
