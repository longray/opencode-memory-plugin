#!/usr/bin/env node

/**
 * Real模式采样测试
 * 采样测试真实API性能
 */

import { fileURLToPath } from "url";
import { dirname } from "path";
import MockOpenCodeTools from "./mock-opencode-tools-v3.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function sampleRealAPITest() {
  console.log("🧪 Real模式API性能采样测试\n");

  const tools = new MockOpenCodeTools({
    embeddingMode: "real", // 使用真实API
  });

  const testData = [];
  for (let i = 0; i < 20; i++) {
    testData.push({
      content: `采样测试数据 ${i}: 这是一个关于软件开发、数据库优化、缓存策略、用户体验、API设计、前端框架、测试方法、代码质量、性能优化、安全措施、部署策略的示例文本`,
      type: "long-term",
      tags: "sample,test,performance",
    });
  }

  console.log(`📊 采样数据量: ${testData.length}条\n`);

  // 测试1: 批量写入
  console.log("测试1: 批量写入\n");
  const writeStartTime = Date.now();
  const writeResults = await Promise.all(
    testData.map((data) => tools.memory_write(data)),
  );
  const writeDuration = Date.now() - writeStartTime;
  console.log(`✅ 写入完成: ${writeResults.length}条`);
  console.log(`   总耗时: ${writeDuration}ms`);
  console.log(
    `   平均耗时: ${(writeDuration / writeResults.length).toFixed(2)}ms`,
  );

  // 测试2: 单个embedding性能
  console.log("\n测试2: 单个embedding性能测试\n");
  const embedTimes = [];
  for (let i = 0; i < 10; i++) {
    const startTime = Date.now();
    await tools.generateEmbedding(testData[i].content);
    const duration = Date.now() - startTime;
    embedTimes.push(duration);
    console.log(`  Embedding ${i + 1}: ${duration}ms`);
  }

  const avgEmbedTime =
    embedTimes.reduce((sum, t) => sum + t, 0) / embedTimes.length;
  const minEmbedTime = Math.min(...embedTimes);
  const maxEmbedTime = Math.max(...embedTimes);
  const p95EmbedTime = embedTimes.sort((a, b) => a - b)[
    Math.floor(embedTimes.length * 0.95)
  ];

  console.log(`✅ Embedding性能统计:`);
  console.log(`   平均: ${avgEmbedTime.toFixed(2)}ms`);
  console.log(`   最小: ${minEmbedTime}ms`);
  console.log(`   最大: ${maxEmbedTime}ms`);
  console.log(`   P95: ${p95EmbedTime.toFixed(2)}ms`);

  // 测试3: 批量embedding性能
  console.log("\n测试3: 批量embedding性能\n");
  const batchStartTime = Date.now();
  const batchResults = await Promise.all(
    testData.slice(0, 10).map((data) => tools.generateEmbedding(data.content)),
  );
  const batchDuration = Date.now() - batchStartTime;
  console.log(`✅ 批量完成: ${batchResults.length}条`);
  console.log(`   总耗时: ${batchDuration}ms`);
  console.log(
    `   平均耗时: ${(batchDuration / batchResults.length).toFixed(2)}ms`,
  );
  console.log(
    `   吞吐量: ${((batchResults.length / batchDuration) * 1000).toFixed(2)} embeddings/秒`,
  );

  // 测试4: 搜索性能
  console.log("\n测试4: 搜索性能\n");
  const searchTests = [
    { query: "开发", mode: "hybrid" },
    { query: "数据库", mode: "vector" },
    { query: "缓存", mode: "keyword" },
    { query: "性能", mode: "hybrid" },
    { query: "API", mode: "vector" },
  ];

  const searchTimes = [];
  for (const test of searchTests) {
    const startTime = Date.now();
    const results = await tools.memory_search(test);
    const duration = Date.now() - startTime;
    searchTimes.push({ ...test, duration, resultCount: results.length });
    console.log(
      `  ${test.mode}搜索 "${test.query}": ${duration}ms (${results.length}条结果)`,
    );
  }

  const avgSearchTime =
    searchTimes.reduce((sum, t) => sum + t.duration, 0) / searchTimes.length;
  const avgSearchResults =
    searchTimes.reduce((sum, t) => sum + t.resultCount, 0) / searchTimes.length;

  console.log(`\n✅ 搜索性能统计:`);
  console.log(`   平均搜索时间: ${avgSearchTime.toFixed(2)}ms`);
  console.log(`   平均结果数: ${avgSearchResults.toFixed(2)}条`);

  // 测试5: 缓存效果
  console.log("\n测试5: 缓存效果\n");
  const cacheHitTests = [
    "开发测试",
    "开发测试",
    "开发测试",
    "开发测试",
    "开发测试",
    "数据库测试",
    "数据库测试",
    "数据库测试",
    "数据库测试",
    "数据库测试",
  ];

  const cacheHitTimes = [];
  for (const test of cacheHitTests) {
    const startTime = Date.now();
    const embedding = await tools.generateEmbedding(test);
    const duration = Date.now() - startTime;
    cacheHitTimes.push(duration);
    console.log(`  缓存命中: ${duration}ms`);
  }

  const avgCacheHitTime =
    cacheHitTimes.reduce((sum, t) => sum + t, 0) / cacheHitTimes.length;
  const speedup = avgEmbedTime / avgCacheHitTime;

  console.log(`\n✅ 缓存效果:`);
  console.log(`   首次平均: ${avgEmbedTime.toFixed(2)}ms`);
  console.log(`   缓存平均: ${avgCacheHitTime.toFixed(2)}ms`);
  console.log(`   加速比: ${speedup.toFixed(2)}x`);

  // 生成报告
  const report = {
    timestamp: new Date().toISOString(),
    mode: "real",
    apiKey: tools.apiKey ? "***" + tools.apiKey.slice(-4) : "none",
    tests: {
      write: {
        count: testData.length,
        totalTime: writeDuration,
        avgTime: (writeDuration / testData.length).toFixed(2),
        throughput: ((testData.length / writeDuration) * 1000).toFixed(2),
      },
      singleEmbedding: {
        count: embedTimes.length,
        avgTime: avgEmbedTime.toFixed(2),
        minTime: minEmbedTime,
        maxTime: maxEmbedTime,
        p95Time: p95EmbedTime.toFixed(2),
      },
      batchEmbedding: {
        count: batchResults.length,
        totalTime: batchDuration,
        avgTime: (batchDuration / batchResults.length).toFixed(2),
        throughput: ((batchResults.length / batchDuration) * 1000).toFixed(2),
      },
      search: {
        count: searchTests.length,
        avgTime: avgSearchTime.toFixed(2),
        avgResults: avgSearchResults.toFixed(2),
      },
      cache: {
        count: cacheHitTests.length,
        avgTime: avgCacheHitTime.toFixed(2),
        avgNonCachedTime: avgEmbedTime.toFixed(2),
        speedup: speedup.toFixed(2),
      },
    },
  };

  // 保存报告
  const fs = await import("fs/promises");
  const path = await import("path");
  const reportPath = path.join(
    __dirname,
    "..",
    "test-results",
    "real-api-performance-report.json",
  );
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n✅ 性能报告已生成: ${reportPath}`);

  // 打印总结
  console.log("\n" + "=".repeat(60));
  console.log("📊 Real API性能总结");
  console.log("=".repeat(60));
  console.log(`写入性能: ${report.tests.write.avgTime}ms/条`);
  console.log(
    `单个Embedding: ${report.tests.singleEmbedding.avgTime}ms (P95: ${report.tests.singleEmbedding.p95Time}ms)`,
  );
  console.log(`批量Embedding: ${report.tests.batchEmbedding.avgTime}ms/条`);
  console.log(`搜索性能: ${report.tests.search.avgTime}ms`);
  console.log(`缓存效果: ${report.tests.cache.speedup}x加速`);
  console.log("=".repeat(60));

  console.log("\n🎉 Real API性能测试完成！");
}

sampleRealAPITest();
