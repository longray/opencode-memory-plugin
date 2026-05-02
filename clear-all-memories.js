#!/usr/bin/env node
/**
 * 一键清空所有记忆数据（插件端 + 后端）
 * 用法: node clear-all-memories.js
 */

import { rmSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const MEMORY_DIR = join(homedir(), ".opencode", "memory");
const TIMELINE_DIR = join(MEMORY_DIR, "timeline");
const MEMORY_INDEX = join(MEMORY_DIR, "MEMORY.md");

async function clearBackendMemories() {
  console.log("\n🌐 正在清空后端记忆...");

  const apiKey = process.env.WRAPPER_MEILI_API_KEY;
  if (!apiKey) {
    console.error("❌ 错误: 未设置 WRAPPER_MEILI_API_KEY 环境变量");
    console.log('💡 请先设置: $env:WRAPPER_MEILI_API_KEY="your-key"');
    return false;
  }

  const apiPort = process.env.API_PORT || "18008";
  const baseUrl = `http://localhost:${apiPort}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/api/v1/memories/clear`, {
      method: "DELETE",
      headers: {
        WRAPPER_MEILI_API_KEY: apiKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ 后端记忆已清空:", result.message || "Success");
    return true;
  } catch (error) {
    console.error("❌ 后端清空失败:", error.message);
    console.log("💡 提示: 确保后端服务运行在 localhost:" + apiPort);
    return false;
  }
}

function clearPluginMemories() {
  console.log("\n💻 正在清空插件端记忆...");
  try {
    if (!existsSync(MEMORY_DIR)) {
      mkdirSync(MEMORY_DIR, { recursive: true });
    }

    if (existsSync(TIMELINE_DIR)) {
      rmSync(TIMELINE_DIR, { recursive: true, force: true });
      console.log("✅ 时间线目录已删除");
    }

    mkdirSync(TIMELINE_DIR, { recursive: true });

    const indexContent = `# Memory Index

> 自动生成文件 - 由程序更新，请勿手动编辑

**统计**
| 指标 | 值 |
|------|-----|
| 总条目数 | 0 |
| 最后更新 | ${new Date().toISOString()} |

**类型分布**
| 类型 | 数量 |
|------|------|

**日期分布 (最近7天)**
| 日期 | 条目数 |
|------|--------|

## 最近条目 (最近 5 条)

---

*此文件由 memory_write 工具自动更新*
`;
    writeFileSync(MEMORY_INDEX, indexContent);
    console.log("✅ MEMORY.md 索引已重置");

    const cacheDir = join(MEMORY_DIR, "cache");
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
      mkdirSync(cacheDir, { recursive: true });
      console.log("✅ 缓存已清理");
    }

    return true;
  } catch (error) {
    console.error("❌ 插件端清空失败:", error.message);
    return false;
  }
}

async function main() {
  console.log("🧹 OpenCode Memory Plugin - 清空所有记忆数据\n");
  console.log("⚠️  警告: 此操作不可逆，所有记忆将被永久删除！\n");
  console.log("目标位置:");
  console.log(`  - 插件端: ${MEMORY_DIR}`);
  console.log(
    `  - 后端: http://localhost:${process.env.API_PORT || "18008"}/api/v1/memories/clear\n`,
  );

  const backendOk = await clearBackendMemories();
  const pluginOk = clearPluginMemories();

  console.log("\n" + "=".repeat(60));
  if (backendOk && pluginOk) {
    console.log("🎉 所有记忆数据已成功清空！");
    console.log("\n建议下一步:");
    console.log("  1. 重启 OpenCode 以刷新状态");
    console.log("  2. 运行 index_status 验证清空结果");
    console.log("  3. 开始新的对话，系统将重新建立记忆");
  } else if (pluginOk && !backendOk) {
    console.log("⚠️  插件端已清空，但后端清空失败");
    console.log("   后端可能未运行或 API key 无效");
  } else if (!pluginOk && backendOk) {
    console.log("⚠️  后端已清空，但插件端清空失败");
    console.log("   请检查文件权限");
  } else {
    console.log("❌ 清空操作失败，请检查错误信息");
  }
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("执行出错:", error);
  process.exit(1);
});
