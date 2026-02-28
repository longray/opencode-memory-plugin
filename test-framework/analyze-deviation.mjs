/**
 * 数据偏差率分析工具
 * 分析测试数据中入库和出库的偏差
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 分析测试结果，计算入库和出库的偏差率
 */
async function analyzeDeviation() {
  console.log('🔍 开始分析数据偏差率...\n');

  // 读取测试结果
  const resultsPath = path.join(__dirname, '..', 'test-results', 'test-results.json');
  const resultsData = await fs.readFile(resultsPath, 'utf-8');
  const results = JSON.parse(resultsData);

  console.log(`📊 总测试用例数: ${results.length}\n`);

  // 统计数据
  const stats = {
    writeOperations: [],      // 入库操作
    readOperations: [],       // 出库操作
    searchOperations: [],     // 搜索操作
    writeSuccess: 0,
    writeFailed: 0,
    readSuccess: 0,
    readFailed: 0,
    searchSuccess: 0,
    searchFailed: 0,
  };

  // 分析每个测试用例
  for (const result of results) {
    const testName = result.testCase?.name || 'Unknown';
    const category = result.testCase?.category || 'Unknown';
    const success = result.result?.success === true;
    const duration = result.duration?.duration || 0;

    // 分类统计
    if (testName.includes('入库') || testName.includes('写入') || category === '基础入库' || category === '特殊内容' || category === '边界条件') {
      stats.writeOperations.push({
        name: testName,
        success,
        duration,
        category,
      });
      if (success) {
        stats.writeSuccess++;
      } else {
        stats.writeFailed++;
      }
    } else if (testName.includes('搜索') || testName.includes('检索') || category === '关键词搜索' || category === '语义搜索' || category === '搜索模式' || category === '性能测试') {
      stats.searchOperations.push({
        name: testName,
        success,
        duration,
        category,
        resultCount: result.result?.result?.length || 0,
      });
      if (success) {
        stats.searchSuccess++;
      } else {
        stats.searchFailed++;
      }
    } else if (testName.includes('读取') || testName.includes('归档') || category === '每日日志管理' || category === '索引管理') {
      stats.readOperations.push({
        name: testName,
        success,
        duration,
        category,
      });
      if (success) {
        stats.readSuccess++;
      } else {
        stats.readFailed++;
      }
    }
  }

  // 打印统计结果
  console.log('📊 入库操作统计:');
  console.log(`   总次数: ${stats.writeOperations.length}`);
  console.log(`   成功: ${stats.writeSuccess} ✅`);
  console.log(`   失败: ${stats.writeFailed} ${stats.writeFailed > 0 ? '❌' : '✅'}`);
  console.log(`   成功率: ${((stats.writeSuccess / stats.writeOperations.length) * 100).toFixed(2)}%`);
  console.log(`   平均耗时: ${(stats.writeOperations.reduce((sum, r) => sum + r.duration, 0) / stats.writeOperations.length).toFixed(2)}ms`);
  console.log('');

  console.log('📊 搜索操作统计:');
  console.log(`   总次数: ${stats.searchOperations.length}`);
  console.log(`   成功: ${stats.searchSuccess} ✅`);
  console.log(`   失败: ${stats.searchFailed} ${stats.searchFailed > 0 ? '❌' : '✅'}`);
  console.log(`   成功率: ${((stats.searchSuccess / stats.searchOperations.length) * 100).toFixed(2)}%`);
  console.log(`   平均耗时: ${(stats.searchOperations.reduce((sum, r) => sum + r.duration, 0) / stats.searchOperations.length).toFixed(2)}ms`);

  // 计算搜索结果数量统计
  const searchResults = stats.searchOperations.map(r => r.resultCount);
  if (searchResults.length > 0) {
    const avgResults = searchResults.reduce((sum, r) => sum + r, 0) / searchResults.length;
    const maxResults = Math.max(...searchResults);
    const minResults = Math.min(...searchResults);
    console.log(`   平均结果数: ${avgResults.toFixed(2)}`);
    console.log(`   最大结果数: ${maxResults}`);
    console.log(`   最小结果数: ${minResults}`);
  }
  console.log('');

  console.log('📊 读取操作统计:');
  console.log(`   总次数: ${stats.readOperations.length}`);
  console.log(`   成功: ${stats.readSuccess} ✅`);
  console.log(`   失败: ${stats.readFailed} ${stats.readFailed > 0 ? '❌' : '✅'}`);
  console.log(`   成功率: ${((stats.readSuccess / stats.readOperations.length) * 100).toFixed(2)}%`);
  console.log(`   平均耗时: ${(stats.readOperations.reduce((sum, r) => sum + r.duration, 0) / stats.readOperations.length).toFixed(2)}ms`);
  console.log('');

  // 计算偏差率
  console.log('📈 偏差率分析:\n');

  // 1. 入库成功率偏差
  const writeSuccessRate = stats.writeSuccess / stats.writeOperations.length;
  const writeDeviation = Math.abs(1.0 - writeSuccessRate);
  console.log('1️⃣ 入库成功率偏差:');
  console.log(`   预期: 100%`);
  console.log(`   实际: ${(writeSuccessRate * 100).toFixed(2)}%`);
  console.log(`   偏差率: ${(writeDeviation * 100).toFixed(2)}%`);
  console.log(`   状态: ${writeDeviation < 0.001 ? '✅ 优秀' : writeDeviation < 0.01 ? '✅ 良好' : '❌ 需改进'}`);
  console.log('');

  // 2. 搜索成功率偏差
  const searchSuccessRate = stats.searchSuccess / stats.searchOperations.length;
  const searchDeviation = Math.abs(1.0 - searchSuccessRate);
  console.log('2️⃣ 搜索成功率偏差:');
  console.log(`   预期: 100%`);
  console.log(`   实际: ${(searchSuccessRate * 100).toFixed(2)}%`);
  console.log(`   偏差率: ${(searchDeviation * 100).toFixed(2)}%`);
  console.log(`   状态: ${searchDeviation < 0.001 ? '✅ 优秀' : searchDeviation < 0.01 ? '✅ 良好' : '❌ 需改进'}`);
  console.log('');

  // 3. 读取成功率偏差
  const readSuccessRate = stats.readSuccess / stats.readOperations.length;
  const readDeviation = Math.abs(1.0 - readSuccessRate);
  console.log('3️⃣ 读取成功率偏差:');
  console.log(`   预期: 100%`);
  console.log(`   实际: ${(readSuccessRate * 100).toFixed(2)}%`);
  console.log(`   偏差率: ${(readDeviation * 100).toFixed(2)}%`);
  console.log(`   状态: ${readDeviation < 0.001 ? '✅ 优秀' : readDeviation < 0.01 ? '✅ 良好' : '❌ 需改进'}`);
  console.log('');

  // 4. 总体偏差率
  const totalSuccessRate = (stats.writeSuccess + stats.searchSuccess + stats.readSuccess) /
                          (stats.writeOperations.length + stats.searchOperations.length + stats.readOperations.length);
  const totalDeviation = Math.abs(1.0 - totalSuccessRate);
  console.log('4️⃣ 总体成功率偏差:');
  console.log(`   预期: 100%`);
  console.log(`   实际: ${(totalSuccessRate * 100).toFixed(2)}%`);
  console.log(`   偏差率: ${(totalDeviation * 100).toFixed(2)}%`);
  console.log(`   状态: ${totalDeviation < 0.001 ? '✅ 优秀' : totalDeviation < 0.01 ? '✅ 良好' : '❌ 需改进'}`);
  console.log('');

  // 5. 性能偏差分析
  const avgWriteDuration = stats.writeOperations.reduce((sum, r) => sum + r.duration, 0) / stats.writeOperations.length;
  const avgSearchDuration = stats.searchOperations.reduce((sum, r) => sum + r.duration, 0) / stats.searchOperations.length;
  const avgReadDuration = stats.readOperations.reduce((sum, r) => sum + r.duration, 0) / stats.readOperations.length;

  console.log('5️⃣ 性能偏差分析:');
  console.log(`   入库平均耗时: ${avgWriteDuration.toFixed(2)}ms (目标: <100ms)`);
  console.log(`   搜索平均耗时: ${avgSearchDuration.toFixed(2)}ms (目标: <200ms)`);
  console.log(`   读取平均耗时: ${avgReadDuration.toFixed(2)}ms (目标: <100ms)`);
  console.log('');

  // 6. 详细抽查
  console.log('6️⃣ 详细抽查:\n');

  // 抽查入库操作
  console.log('入库操作抽查:');
  const sampleWrites = stats.writeOperations.slice(0, 5);
  sampleWrites.forEach((op, index) => {
    console.log(`   ${index + 1}. ${op.name}`);
    console.log(`      状态: ${op.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`      耗时: ${op.duration}ms`);
    console.log(`      分类: ${op.category}`);
  });
  console.log('');

  // 抽查搜索操作
  console.log('搜索操作抽查:');
  const sampleSearches = stats.searchOperations.slice(0, 5);
  sampleSearches.forEach((op, index) => {
    console.log(`   ${index + 1}. ${op.name}`);
    console.log(`      状态: ${op.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`      耗时: ${op.duration}ms`);
    console.log(`      结果数: ${op.resultCount}`);
    console.log(`      分类: ${op.category}`);
  });
  console.log('');

  // 7. 综合评估
  console.log('📋 综合评估:\n');

  const deviationLevels = {
    excellent: writeDeviation < 0.001 && searchDeviation < 0.001 && readDeviation < 0.001,
    good: writeDeviation < 0.01 && searchDeviation < 0.01 && readDeviation < 0.01,
    acceptable: totalDeviation < 0.05,
  };

  if (deviationLevels.excellent) {
    console.log('✅ 优秀 - 所有偏差率均小于0.1%');
    console.log('   系统表现优秀，入库和出库的数据完全一致！');
  } else if (deviationLevels.good) {
    console.log('✅ 良好 - 所有偏差率均小于1%');
    console.log('   系统表现良好，入库和出库的数据基本一致！');
  } else if (deviationLevels.acceptable) {
    console.log('⚠️ 可接受 - 总体偏差率小于5%');
    console.log('   系统表现可接受，但仍有改进空间！');
  } else {
    console.log('❌ 需改进 - 偏差率超过5%');
    console.log('   系统需要改进，存在数据不一致问题！');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 偏差率总结:');
  console.log('='.repeat(60));
  console.log(`入库偏差率: ${(writeDeviation * 100).toFixed(4)}%`);
  console.log(`搜索偏差率: ${(searchDeviation * 100).toFixed(4)}%`);
  console.log(`读取偏差率: ${(readDeviation * 100).toFixed(4)}%`);
  console.log(`总体偏差率: ${(totalDeviation * 100).toFixed(4)}%`);
  console.log('='.repeat(60));
}

// 运行分析
analyzeDeviation().catch(error => {
  console.error('分析失败:', error);
  process.exit(1);
});
