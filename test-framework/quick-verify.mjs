#!/usr/bin/env node

/**
 * 快速验证测试
 * 验证关键修复是否成功
 */

import TestEngine from "./test-engine.mjs";
import MockOpenCodeTools from "./mock-opencode-tools.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function quickVerify() {
  console.log("🚀 快速验证测试\n");

  const engine = new TestEngine({
    logger: { verbose: true },
    monitor: { verbose: true },
    tools: new MockOpenCodeTools(),
  });

  try {
    await engine.initialize();

    // 测试1: 验证写入功能
    console.log("\n📊 测试1: 写入功能\n");
    const writeResult = await engine.options.tools.memory_write({
      content: "测试内容：验证写入功能",
      type: "long-term",
      tags: "test,verify",
    });
    console.log("✅ 写入成功:", writeResult.id);

    // 测试2: 验证搜索功能
    console.log("\n📊 测试2: 搜索功能\n");
    const searchResult = await engine.options.tools.memory_search({
      query: "测试",
      scope: "all",
    });
    console.log("✅ 搜索成功:", searchResult.length, "条结果");

    // 测试3: 验证向量搜索
    console.log("\n📊 测试3: 向量搜索\n");
    const vectorResult = await engine.options.tools.memory_search({
      query: "验证",
      mode: "hybrid",
    });
    console.log("✅ 向量搜索成功:", vectorResult.length, "条结果");

    // 测试4: 验证索引状态
    console.log("\n📊 测试4: 索引状态\n");
    const indexStatus = await engine.options.tools.index_status();
    console.log("✅ 索引状态:", indexStatus);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 所有验证测试通过！");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("\n❌ 验证失败:", error);
    process.exit(1);
  }
}

quickVerify();
