# OpenCode Memory Plugin - L0/L1/L2 分层存储实施计划

## 插件端实施计划

**版本**: v2.4.0-L0L1L2  
**目标**: 实现本地文件系统的 L0/L1/L2 分层存储架构  
**工作量**: 约 12-14 小时  
**更新日期**: 2026-03-24

---

## 一、架构目标

### 1.1 核心原则

- **向后兼容**: 现有 memory_write 调用无需修改即可工作
- **渐进增强**: 新增 abstract/overview 参数，不传则 AI 自动生成
- **性能优先**: 启动时只加载 L0，按需加载 L1/L2
- **可靠存储**: 单一文件存储完整内容，派生文件可重建

### 1.2 存储结构（混合方案）

```
~/.opencode/memory/
├── MEMORY.md                    # 全局轻量索引（最近20条L0）
├── link-map.json                # 全局关联映射（memory_id → 文件路径）
├── SOUL.md, AGENTS.md, etc.    # 核心记忆文件
└── timeline/
    └── 2026/
        └── 03/
            └── 23/
                ├── entry-001.md      # 完整三层内容（L0/L1/L2）
                ├── entry-002.md      # 完整三层内容
                ├── .overview.md      # 日概览（当天所有L0摘要）
                └── .index.json       # 快速索引（entry_id → 位置映射）
```

### 1.3 文件格式规范

#### entry-XXX.md（完整条目）

```markdown
---
id: mem_20260323_001
date: 2026-03-23T10:30:00Z
type: decision
tags: [typescript, preference]
project: @longray/opencode-memory-plugin
memory_id: memory:s9kzvcu9z3xflbr2al5s
source_id: a1b2c3d4e5f6
---

# Abstract

User prefers TypeScript for all new projects.

## Overview

- TypeScript preference established on 2026-03-23
- Used for type safety and better IDE support
- Applies to all new features and refactors

## Content

User explicitly stated they prefer TypeScript for all new projects...

---
```

#### .overview.md（日概览）

```markdown
# 2026-03-23 记忆概览（6 entries）

- [decision] User prefers TypeScript for all new projects → entry-001.md
- [pattern] Use async/await for all async operations → entry-002.md
- [lesson] Learned: Always validate user input → entry-003.md
```

#### .index.json（快速索引）

```json
{
  "version": "2.3.0",
  "date": "2026-03-23",
  "entries": {
    "mem_20260323_001": {
      "file": "entry-001.md",
      "type": "decision",
      "l0_line": 10,
      "l1_line": 14,
      "l2_line": 20,
      "abstract": "User prefers TypeScript...",
      "tags": ["typescript", "preference"]
    }
  }
}
```

---

## 二、任务清单

### Phase 1: 核心存储函数（4-5小时）

#### 任务 1.1: 目录常量定义（15分钟）

**文件**: `plugin.js`  
**位置**: 文件顶部（第 18-26 行后）

**实施**:

```javascript
// 新增目录常量
const CORE_DIR = path.join(MEMORY_DIR, "core");
const ACTIVE_DIR = path.join(MEMORY_DIR, "active");
const LINK_MAP_FILE = path.join(MEMORY_DIR, "link-map.json");
```

**验证**:

- 语法检查: `node -c plugin.js`
- 确认常量可访问

---

#### 任务 1.2: generateEntryId() 函数（30分钟）

**文件**: `plugin.js`  
**位置**: 辅助函数区域（第 200 行后）

**实施**:

```javascript
/**
 * 生成条目ID
 * 格式: mem_YYYYMMDD_XXX 或 ULID
 */
function generateEntryId() {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8);
  return `mem_${dateStr}_${random}`;
}

/**
 * 生成文件名
 * 格式: entry-{timestamp}-{random}.md
 */
function generateFileName() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 5);
  return `entry-${timestamp}-${random}.md`;
}
```

**验证**:

- 调用 10 次，确保 ID 唯一
- 格式正确性检查

---

#### 任务 1.3: buildEntryContent() 函数（1小时）

**文件**: `plugin.js`

**实施**:

```javascript
/**
 * 构建分层内容
 */
function buildEntryContent({
  content,
  abstract,
  overview,
  type,
  tags,
  date,
  projectId,
  memoryId,
}) {
  // 如果没有提供 abstract/overview，从 content 提取
  const finalAbstract = abstract || extractAbstract(content);
  const finalOverview = overview || extractOverview(content);

  // 生成 source_id 用于去重
  const sourceId = generateSourceId(content, type, tags);

  const frontmatter = {
    id: generateEntryId(),
    date: date || new Date().toISOString(),
    type: type || "general",
    tags: tags || [],
    project: projectId || "global",
    memory_id: memoryId || "pending",
    source_id: sourceId,
  };

  return `---
${Object.entries(frontmatter)
  .map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
    return `${k}: ${v}`;
  })
  .join("\n")}
---

# Abstract
${finalAbstract}

## Overview
${finalOverview}

## Content
${content}

---
`;
}

/**
 * 从 content 提取 abstract（建议前100字符）
 */
function extractAbstract(content) {
  const firstSentence = content.split(/[.!?。！？]/)[0].trim();
  if (firstSentence.length <= 100) return firstSentence;
  return firstSentence.substring(0, 97) + "...";
}

/**
 * 从 content 提取 overview（建议前500字符或前3个要点）
 */
function extractOverview(content) {
  // 尝试提取 bullet points
  const lines = content
    .split("\n")
    .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"));
  if (lines.length >= 3) {
    return lines.slice(0, 5).join("\n");
  }

  // 否则取前500字符
  if (content.length <= 500) return content;
  return content.substring(0, 497) + "...";
}

/**
 * 生成 source_id 用于去重
 */
function generateSourceId(content, type, tags) {
  const data = `${content}:${type}:${(tags || []).sort().join(",")}`;
  return createHash("md5").update(data).digest("hex").substring(0, 16);
}
```

**验证**:

- 测试各种 content 长度
- 验证 frontmatter 格式正确
- 测试特殊字符处理

---

#### 任务 1.4: writeEntryToTimeline() 函数（1.5小时）

**文件**: `plugin.js`

**实施**:

```javascript
/**
 * 写入条目到 timeline
 * 返回: { filePath, entryId, dayDir, entry }
 */
async function writeEntryToTimeline(layers, metadata = {}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const dayDir = path.join(TIMELINE_DIR, String(year), month, day);

  // 创建目录
  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true });
  }

  // 生成文件名
  const fileName = generateFileName();
  const filePath = path.join(dayDir, fileName);

  // 解析现有条目确定序号
  const existingFiles = fs
    .readdirSync(dayDir)
    .filter((f) => f.startsWith("entry-") && f.endsWith(".md"));
  const entryIndex = existingFiles.length + 1;

  // 构建内容
  const entryContent = buildEntryContent({
    content: layers.content,
    abstract: layers.abstract,
    overview: layers.overview,
    type: metadata.type || "general",
    tags: metadata.tags || [],
    date: now.toISOString(),
    projectId: metadata.projectId,
  });

  // 写入文件
  fs.writeFileSync(filePath, entryContent, "utf-8");

  // 解析 frontmatter 获取 entryId
  const frontmatterMatch = entryContent.match(/---\n([\s\S]*?)\n---/);
  const entryId = frontmatterMatch
    ? frontmatterMatch[1].match(/id:\s*(.+)/)?.[1]?.trim()
    : `unknown_${Date.now()}`;

  return {
    filePath,
    fileName,
    entryId,
    entryIndex,
    dayDir,
    entry: {
      id: entryId,
      abstract: layers.abstract,
      type: metadata.type || "general",
      tags: metadata.tags || [],
      date: now.toISOString(),
    },
  };
}
```

**验证**:

- 创建测试条目
- 验证目录结构正确
- 验证文件内容格式
- 测试并发写入

---

### Phase 2: 索引管理函数（3-4小时）

#### 任务 2.1: updateDayOverview() 函数（1小时）

**文件**: `plugin.js`

**实施**:

```javascript
/**
 * 更新日概览文件 .overview.md
 */
async function updateDayOverview(dayDir, entry) {
  const overviewPath = path.join(dayDir, ".overview.md");
  const dateStr = path.basename(dayDir);

  let content = "";
  if (fs.existsSync(overviewPath)) {
    content = fs.readFileSync(overviewPath, "utf-8");
  } else {
    content = `# ${dateStr} 记忆概览\n\n`;
  }

  // 添加新条目（限制长度80字符）
  const abstractShort =
    entry.abstract.length > 80
      ? entry.abstract.substring(0, 77) + "..."
      : entry.abstract;

  const entryLine = `- [${entry.type}] ${abstractShort} → ${entry.fileName}\n`;

  // 插入到第3行（标题和空行之后）
  const lines = content.split("\n");
  lines.splice(2, 0, entryLine);

  // 限制最多100条（保留标题+100条）
  if (lines.length > 102) {
    lines.splice(102);
  }

  // 更新标题中的计数
  const entryCount = lines.length - 2; // 减去标题和空行
  lines[0] = `# ${dateStr} 记忆概览（${entryCount} entries）`;

  fs.writeFileSync(overviewPath, lines.join("\n"), "utf-8");

  return { updated: true, count: entryCount };
}
```

**验证**:

- 创建多个条目，检查概览更新
- 验证条目数限制
- 验证格式正确性

---

#### 任务 2.2: updateMemoryIndex() 函数（1小时）

**文件**: `plugin.js`

**实施**:

```javascript
/**
 * 更新 MEMORY.md 全局索引
 * 保持最近 20 条，总长度 ≤200 行
 */
async function updateMemoryIndex(entry, filePath, options = {}) {
  const { maxEntries = 20 } = options;

  let content = "";
  if (fs.existsSync(MEMORY_FILE)) {
    content = fs.readFileSync(MEMORY_FILE, "utf-8");
  } else {
    content = `# 长期记忆索引 v2.3\n\n**最后更新**: ${new Date().toISOString().split("T")[0]}\n**总条目**: 0\n\n`;
  }

  // 构建相对路径
  const relativePath = filePath
    .replace(MEMORY_DIR + path.sep, "")
    .replace(/\\/g, "/");

  // 构建新条目行（限制60字符）
  const abstractShort =
    entry.abstract.length > 60
      ? entry.abstract.substring(0, 57) + "..."
      : entry.abstract;

  const entryLine = `- [${entry.type}] ${abstractShort} → ${relativePath}`;

  // 解析现有内容
  const lines = content.split("\n");

  // 找到 ## 最近记忆 部分
  const recentStart = lines.findIndex(
    (l) => l.startsWith("## ") && l.includes("最近"),
  );
  const insertPos = recentStart >= 0 ? recentStart + 1 : lines.length;

  // 插入新条目
  lines.splice(insertPos, 0, entryLine);

  // 统计条目数并截断
  const entryLines = lines.filter((l) => l.startsWith("- ["));
  if (entryLines.length > maxEntries) {
    // 找到第 maxEntries 条后的位置并删除
    let count = 0;
    for (let i = insertPos; i < lines.length; i++) {
      if (lines[i].startsWith("- [")) {
        count++;
        if (count > maxEntries) {
          lines.splice(i, 1);
          i--;
        }
      }
    }
  }

  // 更新统计信息
  const totalEntries =
    entryLines.length > maxEntries ? maxEntries : entryLines.length;
  const statsLine = lines.findIndex((l) => l.startsWith("**总条目**"));
  if (statsLine >= 0) {
    lines[statsLine] =
      `**总条目**: ${totalEntries} | **最后更新**: ${new Date().toISOString().split("T")[0]}`;
  }

  // 确保不超过 200 行
  if (lines.length > 200) {
    lines.splice(200);
  }

  fs.writeFileSync(MEMORY_FILE, lines.join("\n"), "utf-8");

  return { updated: true, totalEntries };
}
```

**验证**:

- 创建 30 条条目，验证只保留 20 条
- 验证行数限制
- 验证相对路径正确

---

#### 任务 2.3: updateLinkMap() 函数（1小时）

**文件**: `plugin.js`

**实施**:

```javascript
/**
 * 更新 link-map.json 全局关联映射
 */
async function updateLinkMap(entry, filePath) {
  let linkMap = {
    version: "2.3.0",
    updated_at: new Date().toISOString(),
    entries: {},
  };

  if (fs.existsSync(LINK_MAP_FILE)) {
    try {
      linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, "utf-8"));
    } catch (e) {
      console.warn("[LinkMap] Failed to parse, creating new");
    }
  }

  // 读取文件计算行号
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  let l0Line = 0,
    l1Line = 0,
    l2Line = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("# Abstract")) l0Line = i + 1;
    if (lines[i].startsWith("## Overview")) l1Line = i + 1;
    if (lines[i].startsWith("## Content")) l2Line = i + 1;
  }

  // 相对路径
  const relativePath = filePath
    .replace(MEMORY_DIR + path.sep, "")
    .replace(/\\/g, "/");
  const dayDir = path.dirname(relativePath);

  linkMap.entries[entry.id] = {
    l0_path: `${relativePath}:${l0Line}`,
    l1_path: `${relativePath}:${l1Line}`,
    l2_path: `${relativePath}:${l2Line}`,
    day_overview: `${dayDir}/.overview.md`,
    abstract: entry.abstract,
    type: entry.type,
    tags: entry.tags,
    updated_at: new Date().toISOString(),
  };

  linkMap.updated_at = new Date().toISOString();

  fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2), "utf-8");

  return { updated: true, entryId: entry.id };
}
```

**验证**:

- 更新后验证 JSON 格式正确
- 验证路径计算正确
- 测试大文件（1000+ 条目）性能

---

#### 任务 2.4: generateDayIndex() 函数（1小时）

**文件**: `plugin.js`

**实施**:

```javascript
/**
 * 生成 .index.json 快速索引
 */
async function generateDayIndex(dayDir) {
  const indexPath = path.join(dayDir, ".index.json");
  const entries = {};

  const files = fs
    .readdirSync(dayDir)
    .filter((f) => f.startsWith("entry-") && f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(dayDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // 解析 frontmatter
    const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) continue;

    const frontmatter = {};
    frontmatterMatch[1].split("\n").forEach((line) => {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        if (value.startsWith("[")) {
          frontmatter[key] = value
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim());
        } else {
          frontmatter[key] = value;
        }
      }
    });

    // 查找各层位置
    const lines = content.split("\n");
    let l0Line = 0,
      l1Line = 0,
      l2Line = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("# Abstract")) l0Line = i;
      if (lines[i].startsWith("## Overview")) l1Line = i;
      if (lines[i].startsWith("## Content")) l2Line = i;
    }

    // 提取 abstract
    let abstract = "";
    if (l0Line > 0) {
      for (let i = l0Line + 1; i < lines.length; i++) {
        if (lines[i].startsWith("#") || lines[i].startsWith("---")) break;
        abstract += lines[i] + " ";
      }
    }

    entries[frontmatter.id] = {
      file,
      type: frontmatter.type || "general",
      l0_line: l0Line,
      l1_line: l1Line,
      l2_line: l2Line,
      abstract: abstract.trim(),
      tags: frontmatter.tags || [],
    };
  }

  const index = {
    version: "2.3.0",
    date: path.basename(dayDir),
    generated_at: new Date().toISOString(),
    entry_count: Object.keys(entries).length,
    entries,
  };

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");

  return { generated: true, count: index.entry_count };
}
```

**验证**:

- 测试包含多种格式的条目
- 验证行号计算准确
- 测试空目录情况

---

### Phase 3: 工具改造（3-4小时）

#### 任务 3.1: memory_write 工具改造（2小时）

**文件**: `plugin.js`  
**位置**: 第 1470-1575 行

**实施**:

```javascript
memory_write: tool({
  description: 'Write an entry to long-term memory with L0/L1/L2 layered structure. Automatically generates abstract/overview if not provided.',
  args: {
    content: tool.schema.string().describe('L2: The complete content to write (required)'),
    abstract: tool.schema
      .string()
      .optional()
      .describe('L0: One-sentence summary (≤100 chars). Auto-generated if not provided'),
    overview: tool.schema
      .string()
      .optional()
      .describe('L1: Key points summary (≤500 chars). Auto-generated if not provided'),
    type: tool.schema.string().optional().default('general'),
    tags: tool.schema.array(tool.schema.string()).optional().default([]),
    auto_generate: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe('Auto generate abstract/overview from content if not provided'),
  },
  async execute(args) {
    try {
      const { content, type, tags } = args;

      // 获取或生成 layers
      let abstract = args.abstract;
      let overview = args.overview;

      if (args.auto_generate && (!abstract || !overview)) {
        // 从 content 自动生成
        if (!abstract) abstract = extractAbstract(content);
        if (!overview) overview = extractOverview(content);
      }

      // 验证长度
      if (abstract && abstract.length > 100) {
        abstract = abstract.substring(0, 97) + '...';
      }
      if (overview && overview.length > 500) {
        overview = overview.substring(0, 497) + '...';
      }

      const layers = { abstract, overview, content };
      const metadata = {
        type,
        tags,
        projectId: await resolveProjectId(),
      };

      // 1. 写入 timeline
      const result = await writeEntryToTimeline(layers, metadata);

      // 2. 更新日概览
      await updateDayOverview(result.dayDir, {
        ...result.entry,
        fileName: result.fileName,
      });

      // 3. 更新 MEMORY.md
      await updateMemoryIndex(result.entry, result.filePath);

      // 4. 更新 link-map
      await updateLinkMap(result.entry, result.filePath);

      // 5. 更新日索引（异步，不阻塞）
      generateDayIndex(result.dayDir).catch(e =>
        console.warn('[Index] Failed to generate:', e.message)
      );

      // 6. 后端同步（如果启用）
      let backendStatus = '❌ Disabled';
      let memoryId = null;

      const config = getConfig();
      if (config?.backend?.enabled !== false) {
        const client = getWrapperClient(config?.backend?.url);

        try {
          const backendResult = await client.uploadMemory({
            content,
            type,
            tags,
            project_id: metadata.projectId,
            source_id: generateSourceId(content, type, tags),
            metadata: {
              l0: abstract,
              l1: overview,
              entry_id: result.entryId,
            },
          });

          memoryId = backendResult.id;
          backendStatus = `✅ Synced (${memoryId})`;

          // 更新文件中的 memory_id
          await updateMemoryIdInFile(result.filePath, memoryId);
        } catch (e) {
          backendStatus = `⏳ Queued (${e.message})`;
          // 添加到上传队列
          uploadQueue.addToQueue({
            content,
            type,
            tags,
            metadata: { l0: abstract, l1: overview },
          });
        }
      }

      return `✅ Memory saved with L0/L1/L2 layers
- Abstract: ${abstract.substring(0, 50)}${abstract.length > 50 ? '...' : ''}
- Type: ${type}
- File: ${result.filePath.replace(MEMORY_DIR + path.sep, '')}
- Backend: ${backendStatus}`;
    } catch (e) {
      return `❌ Error writing to memory: ${e.message}`;
    }
  },
}),
```

**辅助函数**:

```javascript
async function updateMemoryIdInFile(filePath, memoryId) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const updated = content.replace(
      /memory_id:\s*pending/,
      `memory_id: ${memoryId}`,
    );
    fs.writeFileSync(filePath, updated, "utf-8");
  } catch (e) {
    console.warn("[UpdateMemoryId] Failed:", e.message);
  }
}
```

**验证**:

- 测试带 abstract/overview 的调用
- 测试自动生成
- 验证所有索引文件更新
- 测试后端同步

---

#### 任务 3.2: memory_read 工具改造（1.5小时）

**文件**: `plugin.js`  
**位置**: 第 1577-1610 行

**实施**:

```javascript
memory_read: tool({
  description: 'Read from memory with L0/L1/L2 level support. Can read by file or by entry ID for fast lookup.',
  args: {
    file: tool.schema.string().optional().default('MEMORY.md'),
    level: tool.schema
      .number()
      .optional()
      .default(2)
      .describe('0=abstract only, 1=abstract+overview, 2=full content'),
    entry_id: tool.schema
      .string()
      .optional()
      .describe('Specific entry ID for fast lookup via link-map.json'),
  },
  async execute(args) {
    try {
      const { file, level, entry_id } = args;

      // 如果提供了 entry_id，使用快速查找
      if (entry_id) {
        return await readEntryById(entry_id, level);
      }

      // 标准文件读取
      const filePath = path.join(MEMORY_DIR, file);

      if (!fs.existsSync(filePath)) {
        return `❌ File not found: ${file}`;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      // 如果是 entry 文件，根据 level 过滤
      if (file.startsWith('entry-') || file.includes('/entry-')) {
        return extractByLevel(content, level);
      }

      // 其他文件返回完整内容
      return `📖 ${file}:\n\n${content}`;
    } catch (e) {
      return `❌ Error reading memory: ${e.message}`;
    }
  },
}),
```

**辅助函数**:

```javascript
async function readEntryById(entryId, level = 2) {
  if (!fs.existsSync(LINK_MAP_FILE)) {
    return `❌ Link map not found. Try reading by file path.`;
  }

  const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, "utf-8"));
  const entry = linkMap.entries[entryId];

  if (!entry) {
    return `❌ Entry not found: ${entryId}`;
  }

  const filePath = path.join(MEMORY_DIR, entry.l2_path.split(":")[0]);

  if (!fs.existsSync(filePath)) {
    return `❌ File not found: ${filePath}`;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return extractByLevel(content, level, entryId);
}

function extractByLevel(content, level, entryId = "unknown") {
  if (level === 0) {
    // 只提取 Abstract
    const match = content.match(/# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/);
    const abstract = match ? match[1].trim() : "No abstract found";
    return `📄 ${entryId} (L0 - Abstract):\n\n${abstract}`;
  }

  if (level === 1) {
    // 提取 Abstract + Overview
    const abstractMatch = content.match(
      /# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/,
    );
    const overviewMatch = content.match(
      /## Overview\n([\s\S]*?)(?=\n## |\n---|$)/,
    );

    const abstract = abstractMatch
      ? abstractMatch[1].trim()
      : "No abstract found";
    const overview = overviewMatch
      ? overviewMatch[1].trim()
      : "No overview found";

    return `📄 ${entryId} (L0+L1):\n\n# Abstract\n${abstract}\n\n## Overview\n${overview}`;
  }

  // Level 2: 完整内容
  return `📄 ${entryId} (Full Content):\n\n${content}`;
}
```

**验证**:

- 测试 level=0/1/2
- 测试 entry_id 快速查找
- 测试文件不存在情况
- 验证内容提取准确性

---

### Phase 4: 辅助功能（1-2小时）

#### 任务 4.1: getMemoryFiles 适配（30分钟）

**修改** `getMemoryFiles()` 函数支持新目录结构:

```javascript
function getMemoryFiles() {
  const files = [];

  // 1. Core 记忆文件
  const coreFiles = [
    "MEMORY.md",
    "SOUL.md",
    "AGENTS.md",
    "USER.md",
    "IDENTITY.md",
    "TOOLS.md",
  ];
  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      files.push({ path: filePath, name: file, type: "core" });
    }
  }

  // 2. Timeline 最近30天
  if (fs.existsSync(TIMELINE_DIR)) {
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now - i * 86400000);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      const dayDir = path.join(TIMELINE_DIR, String(year), month, day);
      if (fs.existsSync(dayDir)) {
        // 添加条目文件
        const dayFiles = fs
          .readdirSync(dayDir)
          .filter((f) => f.startsWith("entry-") && f.endsWith(".md"))
          .map((f) => ({
            path: path.join(dayDir, f),
            name: `timeline/${year}/${month}/${day}/${f}`,
            type: "entry",
          }));
        files.push(...dayFiles);

        // 添加概览文件
        const overviewPath = path.join(dayDir, ".overview.md");
        if (fs.existsSync(overviewPath)) {
          files.push({
            path: overviewPath,
            name: `timeline/${year}/${month}/${day}/.overview.md`,
            type: "overview",
          });
        }
      }
    }
  }

  return files;
}
```

---

#### 任务 4.2: rebuild_index 适配（1小时）

确保 `rebuild_index` 工具正确处理 L0/L1/L2:

```javascript
// 在 rebuild_index 中解析分层内容
async function parseEntryFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");

  // 解析 frontmatter
  const frontmatterMatch = content.match(/---\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch
    ? parseFrontmatter(frontmatterMatch[1])
    : {};

  // 提取各层
  const abstract = extractAbstractFromContent(content);
  const overview = extractOverviewFromContent(content);
  const fullContent = extractContentFromContent(content);

  return {
    ...frontmatter,
    l0: abstract,
    l1: overview,
    l2: fullContent,
    source_file: filePath,
  };
}
```

---

## 三、验证清单

### 功能测试

- [ ] `memory_write` 带 abstract/overview 正常写入
- [ ] `memory_write` 自动生成 abstract/overview
- [ ] `memory_write` 长度建议（100/500字符，超出时警告）
- [ ] `memory_read level=0` 只返回 abstract
- [ ] `memory_read level=1` 返回 abstract+overview
- [ ] `memory_read level=2` 返回完整内容
- [ ] `memory_read entry_id=xxx` 快速查找
- [ ] `.overview.md` 正确生成和更新
- [ ] `MEMORY.md` 保持 ≤200 行
- [ ] `link-map.json` 正确更新
- [ ] `.index.json` 正确生成

### 边界测试

- [ ] 空 content 处理
- [ ] 超长 content（>10KB）
- [ ] 特殊字符（emoji, unicode）
- [ ] 并发写入
- [ ] 文件权限错误
- [ ] 磁盘满错误

### 回归测试

- [ ] 旧格式条目可读取
- [ ] 后端同步正常
- [ ] 搜索功能正常
- [ ] 冲突解决正常

---

## 四、时间估算

| Phase       | 任务         | 时间           |
| ----------- | ------------ | -------------- |
| **Phase 1** | 核心存储函数 | 4-5 小时       |
| **Phase 2** | 索引管理函数 | 3-4 小时       |
| **Phase 3** | 工具改造     | 3-4 小时       |
| **Phase 4** | 辅助功能     | 1-2 小时       |
| **测试**    | 验证与修复   | 2-3 小时       |
| **总计**    |              | **13-18 小时** |

---

## 五、风险与缓解

| 风险         | 可能性 | 影响 | 缓解措施                   |
| ------------ | ------ | ---- | -------------------------- |
| 向后兼容破坏 | 中     | 高   | 保留旧格式解析能力         |
| 性能下降     | 低     | 中   | 异步生成索引，缓存优化     |
| 文件系统错误 | 低     | 高   | try-catch 包裹所有 IO 操作 |
| 并发写入冲突 | 低     | 中   | 使用随机文件名避免冲突     |
| 存储空间增长 | 中     | 低   | 派生文件可重建，定期清理   |

---

**下一步**: 完成后端记忆服务实施计划
