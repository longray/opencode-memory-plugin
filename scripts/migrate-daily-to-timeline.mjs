#!/usr/bin/env node

/**
 * Daily to Timeline 迁移脚本
 * 功能：将 daily/ 目录的文件迁移到 timeline/ 目录
 */

import fs from "fs";
import path from "path";

const MEMORY_DIR = "C:/Users/Longray/.opencode/memory";
const DAILY_DIR = path.join(MEMORY_DIR, "daily");
const TIMELINE_DIR = path.join(MEMORY_DIR, "timeline");

console.log("🔄 开始迁移 daily/ 到 timeline/...\n");

// 检查 daily/ 目录
if (!fs.existsSync(DAILY_DIR)) {
  console.log("❌ daily/ 目录不存在");
  process.exit(1);
}

// 获取所有 daily 文件
const dailyFiles = fs
  .readdirSync(DAILY_DIR)
  .filter((f) => f.endsWith(".md") && !f.endsWith(".backup"))
  .sort();

console.log(`📁 找到 ${dailyFiles.length} 个 daily 文件\n`);

let totalEntries = 0;
let migratedEntries = 0;

// 处理每个文件
for (const file of dailyFiles) {
  const filePath = path.join(DAILY_DIR, file);
  const content = fs.readFileSync(filePath, "utf-8");

  // 从文件名提取日期 (YYYY-MM-DD.md)
  const dateMatch = file.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
  if (!dateMatch) {
    console.log(`⚠️ 跳过无效文件名: ${file}`);
    continue;
  }

  const [, year, month, day] = dateMatch;
  const dayDir = path.join(TIMELINE_DIR, year, month, day);

  // 创建目标目录
  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true });
  }

  // 解析条目 (按 ## 分割)
  const entries = content.split(/\n## /).filter((e) => e.trim());

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // 跳过标题和空内容
    if (entry.startsWith("# ") || entry.trim().length < 50) {
      continue;
    }

    totalEntries++;

    // 生成唯一文件名
    const entryId = `entry-${String(i + 1).padStart(3, "0")}`;
    const targetFile = path.join(dayDir, `${entryId}.md`);

    // 检查是否已存在
    if (fs.existsSync(targetFile)) {
      console.log(`  ⚠️ 跳过已存在: ${targetFile}`);
      continue;
    }

    // 写入文件
    const entryContent = entry.startsWith("#") ? entry : `## ${entry}`;
    fs.writeFileSync(targetFile, entryContent, "utf-8");
    migratedEntries++;
  }

  console.log(`✅ ${file}: ${entries.length} 个条目`);
}

console.log(`\n📊 迁移完成:`);
console.log(`  - 总条目: ${totalEntries}`);
console.log(`  - 已迁移: ${migratedEntries}`);
console.log(`  - 跳过: ${totalEntries - migratedEntries}`);

// 询问是否删除 daily/ 目录
console.log(`\n⚠️ 是否删除 daily/ 目录？`);
console.log(`  文件列表:`);
dailyFiles.forEach((f) => console.log(`    - ${f}`));
console.log(`\n请手动执行: rm -rf ${DAILY_DIR}`);
