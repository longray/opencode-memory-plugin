#!/usr/bin/env node

/**
 * MEMORY.md 清理脚本
 * 功能：将 MEMORY.md 中的条目移动到 timeline/ 目录，重建索引
 */

import fs from 'fs';
import path from 'path';

// 配置
const MEMORY_DIR = 'C:/Users/Longray/.opencode/memory';
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const TIMELINE_DIR = path.join(MEMORY_DIR, 'timeline');
const BACKUP_FILE = path.join(MEMORY_DIR, 'MEMORY.md.backup.cleanup');

// 读取 MEMORY.md
console.log('📖 读取 MEMORY.md...');
const content = fs.readFileSync(MEMORY_FILE, 'utf8');
const lines = content.split('\n');
console.log(`  行数: ${lines.length}`);

// 解析条目（按 ## 分割）
console.log('\n🔍 解析条目...');
const entries = content.split(/\n## /).filter(e => e.trim());
console.log(`  总条目数: ${entries.length}`);

// 解析元数据
function parseEntry(entry) {
  const lines = entry.split('\n');
  const title = lines[0].replace(/^#+ /, '');
  
  // 提取 Date
  const dateMatch = entry.match(/\*\*Date\*\*:\s*([^\n]+)/);
  const date = dateMatch ? dateMatch[1].trim() : null;
  
  // 提取 Type
  const typeMatch = entry.match(/\*\*Type\*\*:\s*([^\n]+)/);
  const type = typeMatch ? typeMatch[1].trim() : 'general';
  
  // 提取 Tags
  const tagsMatch = entry.match(/\*\*Tags\*\*:\s*([^\n]+)/);
  const tags = tagsMatch ? tagsMatch[1].trim().split(',').map(t => t.trim()) : [];
  
  // 提取 Project
  const projectMatch = entry.match(/\*\*Project\*\*:\s*([^\n]+)/);
  const project = projectMatch ? projectMatch[1].trim() : null;
  
  // 提取 Memory ID
  const memoryIdMatch = entry.match(/\*\*Memory ID\*\*:\s*([^\n]+)/);
  const memoryId = memoryIdMatch ? memoryIdMatch[1].trim() : null;
  
  return {
    title,
    date,
    type,
    tags,
    project,
    memoryId,
    content: entry
  };
}

// 解析所有条目
const parsedEntries = entries.map(parseEntry).filter(e => e.date);
console.log(`  有效条目数: ${parsedEntries.length}`);

// 统计
const typeCount = {};
parsedEntries.forEach(e => {
  typeCount[e.type] = (typeCount[e.type] || 0) + 1;
});
console.log('  类型分布:', typeCount);

// 创建 timeline 目录结构
console.log('\n📁 创建 timeline 目录...');
const dateGroups = {};
parsedEntries.forEach(e => {
  const dateStr = e.date.split('T')[0];
  const dateParts = dateStr.split('-');
  
  // 验证日期格式
  if (dateParts.length !== 3) {
    console.log(`  ⚠️ 跳过无效日期: ${dateStr}`);
    return;
  }
  
  const [year, month, day] = dateParts;
  const dirPath = path.join(TIMELINE_DIR, year, month, day);
  
  if (!dateGroups[dirPath]) {
    dateGroups[dirPath] = [];
  }
  dateGroups[dirPath].push(e);
});

// 创建目录
for (const dirPath of Object.keys(dateGroups)) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`  创建: ${dirPath}`);
  }
}

// 写入条目到 timeline
console.log('\n📝 写入条目到 timeline...');
let writtenCount = 0;
let skippedCount = 0;

for (const [dirPath, entries] of Object.entries(dateGroups)) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const fileName = `entry-${String(i + 1).padStart(3, '0')}.md`;
    const filePath = path.join(dirPath, fileName);
    
    // 检查文件是否已存在
    if (fs.existsSync(filePath)) {
      console.log(`  ⚠️ 跳过: ${filePath} (已存在)`);
      skippedCount++;
      continue;
    }
    
    // 写入文件
    fs.writeFileSync(filePath, entry.content, 'utf8');
    writtenCount++;
    
    if (writtenCount % 20 === 0) {
      console.log(`  ✅ 已写入 ${writtenCount} 个条目`);
    }
  }
}

console.log(`\n✅ 写入完成: ${writtenCount} 个条目, 跳过: ${skippedCount} 个`);

// 重建 MEMORY.md 索引
console.log('\n🔄 重建 MEMORY.md 索引...');

// 按日期分组统计
const dateStats = {};
parsedEntries.forEach(e => {
  const dateStr = e.date.split('T')[0];
  if (!dateStats[dateStr]) {
    dateStats[dateStr] = { count: 0, types: {} };
  }
  dateStats[dateStr].count++;
  dateStats[dateStr].types[e.type] = (dateStats[dateStr].types[e.type] || 0) + 1;
});

// 生成索引内容
const indexContent = `# Long-Term Memory Index

**版本**: v2.3.0 (索引格式)
**最后更新**: ${new Date().toISOString()}
**总条目数**: ${parsedEntries.length}

---

## 📊 统计信息

| 类型 | 数量 |
|------|------|
${Object.entries(typeCount).map(([type, count]) => `| ${type} | ${count} |`).join('\n')}

---

## 📅 按日期分布

| 日期 | 条目数 | 类型分布 |
|------|--------|----------|
${Object.entries(dateStats).sort().map(([date, stats]) => {
  const typeStr = Object.entries(stats.types).map(([t, c]) => `${t}:${c}`).join(', ');
  return `| ${date} | ${stats.count} | ${typeStr} |`;
}).join('\n')}

---

## 🔗 Timeline 目录

完整记忆条目存储在 \`timeline/\` 目录中：

\`\`\`
timeline/
${Object.keys(dateGroups).map(dirPath => {
  const relativePath = dirPath.replace(TIMELINE_DIR + '/', '');
  return `├── ${relativePath}/`;
}).join('\n')}
\`\`\`

---

## 📝 最近条目（最近10条）

${parsedEntries.slice(-10).reverse().map((e, i) => {
  const dateStr = e.date.split('T')[0];
  return `${i + 1}. [${e.type}] ${e.title} (${dateStr})`;
}).join('\n')}

---

## 🔍 搜索指南

使用 \`memory_search\` 工具搜索记忆：
- 语义搜索: \`memory_search query="关键词" mode="vector"\`
- 关键词搜索: \`memory_search query="关键词" mode="keyword"\`
- 混合搜索: \`memory_search query="关键词" mode="hybrid"\`

使用 \`memory_timeline\` 工具按日期浏览：
- \`memory_timeline days=7\` - 最近7天
- \`memory_timeline days=30\` - 最近30天

使用 \`memory_topics\` 工具按主题浏览：
- \`memory_topics min_entries=3\` - 至少3个条目的主题
`;

// 写入新的 MEMORY.md
fs.writeFileSync(MEMORY_FILE, indexContent, 'utf8');
console.log('✅ MEMORY.md 已重建为索引格式');

// 统计新文件行数
const newIndexLines = indexContent.split('\n').length;
console.log(`  新 MEMORY.md 行数: ${newIndexLines}`);

// 验证
console.log('\n🔍 验证...');
const timelineFiles = fs.readdirSync(TIMELINE_DIR, { recursive: true })
  .filter(f => f.endsWith('.md'));
console.log(`  timeline 文件数: ${timelineFiles.length}`);

// 备份原文件
console.log('\n💾 备份原文件...');
fs.copyFileSync(MEMORY_FILE, BACKUP_FILE);
console.log(`  备份到: ${BACKUP_FILE}`);

console.log('\n✅ 清理完成！');
console.log(`  - 原 MEMORY.md: ${lines.length} 行`);
console.log(`  - 新 MEMORY.md: ${newIndexLines} 行`);
console.log(`  - timeline 条目: ${writtenCount} 个`);
console.log(`  - 备份文件: ${BACKUP_FILE}`);
