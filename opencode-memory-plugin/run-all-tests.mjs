#!/usr/bin/env node
/**
 * 综合测试套件 - 一键运行所有测试并生成报告
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const tests = [
  {
    name: 'Integration Tests',
    file: 'test-integration.mjs',
    description: '基本功能集成测试',
  },
  {
    name: 'Performance Tests',
    file: 'test-performance.mjs',
    description: '性能基准测试',
  },
  {
    name: 'Stress Tests',
    file: 'test-stress.mjs',
    description: '压力测试',
  },
  {
    name: 'Graph Performance Tests',
    file: 'test-graph-performance.mjs',
    description: '图关系性能测试',
  },
];

async function runTest(test) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${test.name}`);
  console.log(`Description: ${test.description}`);
  console.log('='.repeat(60) + '\n');

  return new Promise(resolve => {
    const startTime = Date.now();
    const child = spawn('node', [test.file], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.on('close', code => {
      const duration = Date.now() - startTime;
      resolve({
        name: test.name,
        file: test.file,
        success: code === 0,
        duration,
        exitCode: code,
      });
    });

    child.on('error', err => {
      console.error(`Failed to run ${test.name}:`, err.message);
      resolve({
        name: test.name,
        file: test.file,
        success: false,
        duration: 0,
        exitCode: -1,
        error: err.message,
      });
    });
  });
}

async function main() {
  console.log('🚀 OpenCode Memory Plugin v2.0 - Comprehensive Test Suite\n');
  console.log(`Start Time: ${new Date().toLocaleString()}`);
  console.log(`Backend URL: http://localhost:17999`);
  console.log('');

  // 检查后端服务
  console.log('Checking backend service...');
  try {
    const response = await fetch('http://localhost:17999/health');
    if (!response.ok) {
      console.error('❌ Backend service is not responding');
      process.exit(1);
    }
    const health = await response.json();
    console.log(`✅ Backend is ${health.status}`);
    console.log(`   Version: ${health.version || 'unknown'}`);
    console.log(`   Embedding: ${health.embedding_service?.status || 'unknown'}`);
    console.log(`   SurrealDB: ${health.surrealdb?.status || 'unknown'}`);
  } catch (e) {
    console.error('❌ Failed to connect to backend:', e.message);
    console.log('\nPlease start the backend service first:');
    console.log('  cd D:\\embedding_service');
    console.log('  start_services.bat');
    process.exit(1);
  }

  // 运行所有测试
  const results = [];
  const totalStartTime = Date.now();

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }

  const totalDuration = Date.now() - totalStartTime;

  // 生成综合报告
  console.log(`\n${'='.repeat(60)}`);
  console.log('COMPREHENSIVE TEST REPORT');
  console.log('='.repeat(60));
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length} ✅`);
  console.log(`Failed: ${results.filter(r => !r.success).length} ❌`);
  console.log('');

  console.log('Test Results:');
  console.log('-'.repeat(60));
  results.forEach((result, i) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const duration = (result.duration / 1000).toFixed(2);
    console.log(`${i + 1}. ${result.name}`);
    console.log(`   Status: ${status}`);
    console.log(`   Duration: ${duration}s`);
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });

  // 收集所有报告
  const reportFiles = [
    'performance-report.json',
    'stress-test-report.json',
    'graph-performance-report.json',
  ];

  const allReports = {};
  reportFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        allReports[file.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        console.error(`Failed to read ${file}:`, e.message);
      }
    }
  });

  // 保存综合报告
  const comprehensiveReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDuration,
      totalTests: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    testResults: results,
    detailedReports: allReports,
  };

  const reportPath = path.join(process.cwd(), 'comprehensive-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(comprehensiveReport, null, 2));

  console.log('='.repeat(60));
  console.log(`Comprehensive report saved to: ${reportPath}`);
  console.log('='.repeat(60));

  // 返回状态码
  const hasFailures = results.some(r => !r.success);
  process.exit(hasFailures ? 1 : 0);
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
