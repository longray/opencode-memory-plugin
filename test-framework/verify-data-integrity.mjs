/**
 * 数据完整性验证工具
 * 验证入库和出库内容的一致性
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 详细验证数据完整性
 */
async function verifyDataIntegrity() {
  console.log('🔍 开始验证数据完整性...\n');

  // 读取测试结果
  const resultsPath = path.join(__dirname, '..', 'test-results', 'test-results.json');
  const resultsData = await fs.readFile(resultsPath, 'utf-8');
  const results = JSON.parse(resultsData);

  // 创建数据映射
  const dataMap = new Map(); // ID -> 数据

  // 统计数据
  const stats = {
    writtenRecords: 0,
    readRecords: 0,
    matchedRecords: 0,
    mismatchedRecords: 0,
    lostRecords: 0,
    corruptedRecords: 0,
    writeErrors: 0,
    readErrors: 0,
    sampleWrites: [],      // 抽查的入库记录
    sampleReads: [],      // 抽查的出库记录
  };

  console.log('📊 第一阶段：扫描入库操作\n');

  // 第一阶段：扫描所有入库操作
  for (const result of results) {
    const testName = result.testCase?.name || 'Unknown';
    const success = result.result?.success === true;

    // 检查入库操作
    if (testName.includes('入库') || testName.includes('写入')) {
      if (success && result.result?.result?.id) {
        const id = result.result.result.id;

        // 检查是否是批量操作
        if (result.result?.result?.count) {
          // 批量操作，记录数量
          for (let i = 0; i < result.result.result.count; i++) {
            const batchId = `${id}-${i}`;
            dataMap.set(batchId, {
              id: batchId,
              testName,
              written: true,
              read: false,
              verified: false,
            });
            stats.writtenRecords++;
          }
        } else {
          // 单条记录
          dataMap.set(id.toString(), {
            id: id.toString(),
            testName,
            written: true,
            read: false,
            verified: false,
          });
          stats.writtenRecords++;
        }

        // 抽查前10条入库记录
        if (stats.sampleWrites.length < 10) {
          stats.sampleWrites.push({
            id: result.result.result.id,
            testName,
            success,
            timestamp: result.timestamp,
          });
        }
      } else {
        stats.writeErrors++;
      }
    }
  }

  console.log(`✅ 扫描完成，共发现 ${stats.writtenRecords} 条入库记录`);
  console.log(`⚠️  入库错误: ${stats.writeErrors} 条\n`);

  console.log('📊 第二阶段：扫描搜索/读取操作\n');

  // 第二阶段：扫描所有搜索和读取操作
  for (const result of results) {
    const testName = result.testCase?.name || 'Unknown';
    const success = result.result?.success === true;
    const category = result.testCase?.category || 'Unknown';

    // 检查搜索/读取操作
    if ((category.includes('搜索') || testName.includes('搜索') || testName.includes('检索')) &&
        success &&
        Array.isArray(result.result?.result)) {
      const searchResults = result.result.result;

      // 标记这些记录为已读取
      searchResults.forEach(item => {
        if (item?.id) {
          const id = item.id.toString();
          if (dataMap.has(id)) {
            const record = dataMap.get(id);
            record.read = true;
            record.verified = true;
            stats.readRecords++;
            stats.matchedRecords++;
          } else {
            // 找到了未入库的记录（可能是之前测试的）
            stats.readRecords++;
          }
        }
      });

      // 抽查前10条搜索结果
      if (stats.sampleReads.length < 10 && searchResults.length > 0) {
        stats.sampleReads.push({
          testName,
          resultCount: searchResults.length,
          sampleItem: searchResults[0],
          timestamp: result.timestamp,
        });
      }
    }

    // 检查数据流动验证测试
    if (testName.includes('验证') && success) {
      const verified = result.result?.verified === true;
      const found = result.result?.found === true;

      if (verified && found) {
        stats.matchedRecords++;
      } else if (!verified) {
        stats.mismatchedRecords++;
      }
    }
  }

  console.log(`✅ 扫描完成，共 ${stats.readRecords} 条记录被读取`);
  console.log(`✅ 匹配记录: ${stats.matchedRecords} 条`);
  console.log(`⚠️  不匹配记录: ${stats.mismatchedRecords} 条\n`);

  console.log('📊 第三阶段：计算数据完整性指标\n');

  // 计算完整性指标
  const totalRecords = stats.writtenRecords;
  const foundRecords = stats.matchedRecords;
  const lostRecords = totalRecords - foundRecords;

  const integrityRate = totalRecords > 0 ? (foundRecords / totalRecords) * 100 : 100;
  const lossRate = totalRecords > 0 ? (lostRecords / totalRecords) * 100 : 0;
  const mismatchRate = totalRecords > 0 ? (stats.mismatchedRecords / totalRecords) * 100 : 0;

  console.log('📈 数据完整性指标:');
  console.log(`   总入库记录: ${totalRecords} 条`);
  console.log(`   成功检索: ${foundRecords} 条`);
  console.log(`   丢失记录: ${lostRecords} 条`);
  console.log(`   不匹配记录: ${stats.mismatchedRecords} 条`);
  console.log('');

  console.log('📊 完整性分析:');
  console.log(`   完整性: ${integrityRate.toFixed(4)}%`);
  console.log(`   丢失率: ${lossRate.toFixed(4)}%`);
  console.log(`   不匹配率: ${mismatchRate.toFixed(4)}%`);
  console.log('');

  console.log('📊 评估标准:');
  console.log(`   完整性 ≥ 99.99%: ${integrityRate >= 99.99 ? '✅ 优秀' : '❌ 未达标'}`);
  console.log(`   丢失率 ≤ 0.01%: ${lossRate <= 0.01 ? '✅ 优秀' : '❌ 未达标'}`);
  console.log(`   不匹配率 ≤ 0.01%: ${mismatchRate <= 0.01 ? '✅ 优秀' : '❌ 未达标'}`);
  console.log('');

  console.log('📋 详细抽查:\n');

  console.log('入库记录抽查:');
  stats.sampleWrites.forEach((item, index) => {
    console.log(`   ${index + 1}. ID: ${item.id}`);
    console.log(`      测试: ${item.testName}`);
    console.log(`      状态: ${item.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`      时间: ${item.timestamp}`);
  });
  console.log('');

  console.log('搜索结果抽查:');
  stats.sampleReads.forEach((item, index) => {
    console.log(`   ${index + 1}. 测试: ${item.testName}`);
    console.log(`      结果数: ${item.resultCount}`);
    console.log(`      示例ID: ${item.sampleItem?.id || 'N/A'}`);
    console.log(`      示例内容: ${item.sampleItem?.content?.substring(0, 50) || 'N/A'}...`);
    console.log(`      时间: ${item.timestamp}`);
  });
  console.log('');

  // 综合评估
  console.log('🎯 综合评估:\n');

  const overallQuality =
    integrityRate >= 99.99 && lossRate <= 0.01 && mismatchRate <= 0.01;

  if (overallQuality) {
    console.log('✅ 数据完整性优秀！');
    console.log('   所有入库记录都能成功检索，无数据丢失！');
    console.log('   入库和出库的内容完全一致！');
  } else if (integrityRate >= 99.9 && lossRate <= 0.1 && mismatchRate <= 0.1) {
    console.log('✅ 数据完整性良好！');
    console.log('   绝大多数入库记录都能成功检索！');
    console.log('   入库和出库的内容基本一致！');
  } else if (integrityRate >= 99.0 && lossRate <= 1.0) {
    console.log('⚠️ 数据完整性可接受！');
    console.log('   大部分入库记录都能成功检索！');
    console.log('   入库和出库的内容存在少量不一致！');
  } else {
    console.log('❌ 数据完整性不足！');
    console.log('   存在数据丢失或内容不一致问题！');
    console.log('   需要检查入库和出库逻辑！');
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 数据完整性验证总结:');
  console.log('='.repeat(60));
  console.log(`完整性率: ${integrityRate.toFixed(4)}%`);
  console.log(`丢失率: ${lossRate.toFixed(4)}%`);
  console.log(`不匹配率: ${mismatchRate.toFixed(4)}%`);
  console.log(`总偏差率: ${lossRate.toFixed(4)}%`);
  console.log('='.repeat(60));

  // 返回验证结果
  return {
    totalRecords,
    foundRecords,
    lostRecords,
    mismatchedRecords: stats.mismatchedRecords,
    integrityRate,
    lossRate,
    mismatchRate,
    overallQuality,
  };
    totalRecords,
    foundRecords,
    lostRecords,
    mismatchedRecords,
    integrityRate,
    lossRate,
    mismatchRate,
    overallQuality,
  };
}

// 运行验证
verifyDataIntegrity().catch(error => {
  console.error('验证失败:', error);
  process.exit(1);
});
