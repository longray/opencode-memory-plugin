#!/usr/bin/env node

/**
 * Real模式详细验证测试
 * 验证API调用和向量搜索
 */

import MockOpenCodeTools from "./mock-opencode-tools-v3.mjs";

async function testRealModeDetailed() {
  console.log("🌐 Real模式详细验证测试\n");

  const tools = new MockOpenCodeTools({
    embeddingMode: "real", // 使用真实API
  });

  try {
    // 测试1: 写入多条数据
    console.log("测试1: 写入测试数据\n");
    const testData = [
      "TypeScript类型检查",
      "PostgreSQL数据库",
      "Redis缓存",
      "用户偏好设置",
      "代码风格指南",
    ];

    const writePromises = testData.map((content) =>
      tools.memory_write({ content, type: "long-term", tags: "test" }),
    );

    const writeResults = await Promise.all(writePromises);
    console.log(`✅ 写入完成: ${writeResults.length}条`);

    // 测试2: 测试单个embedding生成
    console.log("\n测试2: 测试embedding生成\n");
    const testText = "TypeScript类型检查";
    console.log(`文本: ${testText}`);
    const startTime = Date.now();
    const embedding = await tools.generateEmbedding(testText);
    const duration = Date.now() - startTime;
    console.log(`✅ Embedding生成成功:`);
    console.log(`   维度: ${embedding.length}`);
    console.log(`   耗时: ${duration}ms`);
    console.log(
      `   前5个值: [${embedding
        .slice(0, 5)
        .map((v) => v.toFixed(6))
        .join(", ")}]`,
    );

    // 测试3: 测试BM25搜索
    console.log("\n测试3: 测试BM25搜索\n");
    const bm25Results = await tools.bm25Search("TypeScript");
    console.log(`✅ BM25搜索结果: ${bm25Results.length}条`);
    if (bm25Results.length > 0) {
      console.log(
        `   第1个结果: ${bm25Results[0].content.substring(0, 50)}...`,
      );
    }

    // 测试4: 测试向量搜索
    console.log("\n测试4: 测试向量搜索\n");
    const vectorResults = await tools.vectorSearch("TypeScript", embedding);
    console.log(`✅ 向量搜索结果: ${vectorResults.length}条`);
    if (vectorResults.length > 0) {
      console.log(
        `   第1个结果: ${vectorResults[0].content.substring(0, 50)}...`,
      );
    }

    // 测试5: 测试混合搜索
    console.log("\n测试5: 测试混合搜索\n");
    const hybridResults = await tools.hybridSearch("TypeScript", embedding);
    console.log(`✅ 混合搜索结果: ${hybridResults.length}条`);
    if (hybridResults.length > 0) {
      console.log(
        `   第1个结果: ${hybridResults[0].content.substring(0, 50)}...`,
      );
    }

    // 测试6: 通过工具接口测试
    console.log("\n测试6: 通过工具接口测试\n");
    const searchResults = await tools.memory_search({
      query: "TypeScript",
      mode: "hybrid",
    });
    console.log(`✅ memory_search(hybrid): ${searchResults.length}条`);
    if (searchResults.length > 0) {
      console.log(
        `   第1个结果: ${searchResults[0].content.substring(0, 50)}...`,
      );
    }

    const keywordResults = await tools.memory_search({
      query: "TypeScript",
      scope: "all",
    });
    console.log(`✅ memory_search: ${keywordResults.length}条`);
    if (keywordResults.length > 0) {
      console.log(
        `   第1个结果: ${keywordResults[0].content.substring(0, 50)}...`,
      );
    }

    // 测试7: 索引状态
    console.log("\n测试7: 索引状态\n");
    const status = await tools.index_status();
    console.log("✅ 索引状态:");
    console.log(`   总记录数: ${status.totalRecords}`);
    console.log(`   索引记录数: ${status.indexedRecords}`);
    console.log(`   BM25索引大小: ${status.bm25IndexSize}`);
    console.log(`   向量索引大小: ${status.vectorIndexSize}`);
    console.log(`   缓存大小: ${status.embeddingCacheSize}`);
    console.log(`   Embedding模式: ${status.embeddingMode}`);
    console.log(`   API Key: ${status.apiKey}`);

    // 总结
    console.log("\n" + "=".repeat(60));
    console.log("📊 测试总结");
    console.log("=".repeat(60));
    console.log(`✅ 写入: ${writeResults.length}条`);
    console.log(`✅ Embedding: ${embedding.length}维, ${duration}ms`);
    console.log(`✅ BM25搜索: ${bm25Results.length}条结果`);
    console.log(`✅ 向量搜索: ${vectorResults.length}条结果`);
    console.log(`✅ 混合搜索: ${hybridResults.length}条结果`);
    console.log(
      `✅ 工具搜索: ${searchResults.length}条 + ${keywordResults.length}条结果`,
    );
    console.log("\n✅ Real模式验证通过！");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ 测试失败:", error);
    process.exit(1);
  }
}

testRealModeDetailed();
