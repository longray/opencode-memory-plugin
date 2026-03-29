# OpenCode Memory Plugin v2.4.0 L0/L1/L2 分层存储 - 实施提示词

**版本**: v2.4.0  
**用途**: 用于 AI 实施插件端核心功能  
**预计时间**: 11-13 小时

---

## 角色设定

你是一个经验丰富的全栈工程师，擅长 Node.js 文件系统操作、API 设计和性能优化。你需要严格按照以下设计规范实施插件端核心功能。

---

## 项目背景

OpenCode Memory Plugin 是一个 OpenCode 插件，为 AI 助手提供持久记忆能力。当前需要实施 v2.4.0 版本的 L0/L1/L2 分层存储架构。

---

## 核心设计决策（必须遵守）

### 1. 文件名格式

```
✅ 正确：entry_{ulid}.md
   例如：entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md

❌ 错误：memory_xxx.md, local_xxx.md, entry-001.md
```

**关键点**：

- 统一使用 ULID 格式作为文件名
- 无论在线还是离线，都使用 `entry_{ulid}.md` 格式
- **同步后不重命名文件**
- 通过 frontmatter 中的 `synced` 字段区分同步状态

### 2. 必填参数

```javascript
// memory_write 工具参数
{
  content: string,      // L2: 完整内容（必填）
  abstract: string,     // L0: 一句话摘要（必填，建议 ≤100 字符，超长可容忍）
  overview: string,    // L1: 核心要点（必填，建议 ≤500 字符，超长可容忍）
  type: string,       // 类型：preference/decision/pattern/lesson/note（默认 general）
  tags: string[],     // 标签数组（可选）
  pinned: boolean     // 是否置顶（可选，默认 false）
}
```

**验证规则**：

- 如果 `abstract` 或 `overview` 缺失或为空，返回错误
- 长度是约定和建议，超长也可容忍，不强制截断

### 3. frontmatter 字段

```yaml
---
id: 01HV8J3K2M4N5P6Q7R8S9T0UV    # 本地 ULID（必填）
date: 2026-03-23T10:30:00.000Z  # ISO 时间格式
type: decision                    # 类型
tags: [typescript, preference]    # 标签
project: @longray/xxx            # 项目 ID
memory_id: memory:s9kzvcu9z3xflbr2al5s  # 后端 ID，pending 表示待同步
source_id: a1b2c3d4e5f6g7h8     # 内容哈希
synced: true                     # 是否已同步
synced_at: 2026-03-23T10:30:00.000Z  # 同步时间
---
```

### 4. 分层内容格式

```markdown
---
# frontmatter
---

# Abstract

User prefers TypeScript for all new projects.

## Overview

- TypeScript preference established
- Used for type safety

## Content

完整内容...
```

---

## 目录结构

```
~/.opencode/memory/
├── MEMORY.md              # 全局索引（最近 20 条 L0）
├── link-map.json         # 路径映射 + 状态
├── SOUL.md, AGENTS.md   # 静态配置（不变）
└── timeline/
    └── 2026/
        └── 03/
            └── 23/
                ├── entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md
                ├── entry_01HV8J3K2M5ABC123DEF456.md
                ├── .overview.md
                └── .index.json
```

---

## 实施任务清单

### 任务 1：ULID 生成工具

安装 ulid 包或使用兼容实现：

```javascript
import { ulid } from "ulid";
// 或
function generateId() {
  const now = Date.now();
  const timePart = now.toString(36).padStart(10, "0");
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timePart}${randomPart}`.toUpperCase();
}
```

### 任务 2：writeEntryToTimeline 函数

```javascript
async function writeEntryToTimeline(layers, metadata) {
  // 1. 生成 ULID
  const localId = ulid();
  const fileName = `entry_${localId}.md`;

  // 2. 构建目录路径
  const now = new Date();
  const dayDir = path.join(
    TIMELINE_DIR,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  );

  // 3. 构建分层内容
  const content = buildEntryContent({
    id: localId,
    date: now.toISOString(),
    type: metadata.type || "general",
    tags: metadata.tags || [],
    project: metadata.projectId,
    memory_id: "pending", // 初始状态
    source_id: generateSourceId(layers.content),
    synced: false,
    abstract: layers.abstract,
    overview: layers.overview,
    content: layers.content,
  });

  // 4. 写入文件
  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true });
  }
  const filePath = path.join(dayDir, fileName);
  fs.writeFileSync(filePath, content, "utf-8");

  return { filePath, localId };
}

function buildEntryContent(data) {
  return `---
id: ${data.id}
date: ${data.date}
type: ${data.type}
tags: [${(data.tags || []).join(", ")}]
project: ${data.project}
memory_id: ${data.memory_id}
source_id: ${data.source_id}
synced: ${data.synced}
synced_at: ${data.synced_at || "null"}
---

# Abstract
${data.abstract}

## Overview
${data.overview}

## Content
${data.content}

---
`;
}
```

### 任务 3：memory_write 工具改造

```javascript
memory_write: tool({
  description: 'Write memory with L0/L1/L2 layers. abstract and overview are REQUIRED.',
  args: {
    content: tool.schema.string().describe('L2: Full content (required)'),
    abstract: tool.schema.string().describe('L0: Summary ≤100 chars (REQUIRED)'),
    overview: tool.schema.string().describe('L1: Key points ≤500 chars (REQUIRED)'),
    type: tool.schema.string().optional().default('general'),
    tags: tool.schema.array(tool.schema.string()).optional().default([]),
    pinned: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    // 1. 验证必填
    if (!args.abstract || args.abstract.trim().length === 0) {
      return '❌ Error: abstract is REQUIRED. Generate it before calling memory_write.';
    }
    if (!args.overview || args.overview.trim().length === 0) {
      return '❌ Error: overview is REQUIRED. Generate it before calling memory_write.';
    }

    // 2. 长度验证和截断
    let abstract = args.abstract.trim();
    let overview = args.overview.trim();
    let content = args.content.trim();

    if (abstract.length > 100) {
      abstract = abstract.substring(0, 97) + '...';
      console.warn('[memory_write] Abstract truncated to 100 chars');
    }
    if (overview.length > 500) {
      overview = overview.substring(0, 497) + '...';
      console.warn('[memory_write] Overview truncated to 500 chars');
    }

    // 3. 写入文件
    const result = await writeEntryToTimeline(
      { abstract, overview, content },
      { type: args.type, tags: args.tags, pinned: args.pinned }
    );

    // 4. 更新索引
    await updateDayOverview(dayDir, { abstract, type: args.type, fileName: result.fileName });
    await updateMemoryIndex({ abstract, type: args.type }, result.filePath);
    await updateLinkMap({ id: result.localId, abstract, type: args.type, tags: args.tags, pinned: args.pinned }, result.filePath);

    // 5. 尝试同步（如果后端在线）
    // ... 同步逻辑

    return `✅ Memory saved: ${abstract.substring(0, 50)}...\nFile: ${result.filePath}`;
  },
}),
```

### 任务 4：memory_read 工具改造

```javascript
memory_read: (tool({
  description: "Read memory entry with level support",
  args: {
    entry_id: tool.schema.string().describe("Entry ID (required)"),
    level: tool.schema
      .number()
      .optional()
      .default(2)
      .describe("0=abstract, 1=overview, 2=full"),
  },
  async execute(args) {
    // 1. 从 link-map.json 查找路径
    const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, "utf-8"));
    const entry = linkMap.entries[args.entry_id];

    if (!entry) {
      return `❌ Entry not found: ${args.entry_id}`;
    }

    // 2. 读取文件
    const filePath = path.join(MEMORY_DIR, entry.path);
    const content = fs.readFileSync(filePath, "utf-8");

    // 3. 根据 level 提取内容
    return extractByLevel(content, args.level);
  },
}),
  function extractByLevel(content, level) {
    if (level === 0) {
      // 只返回 Abstract
      const match = content.match(/# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/);
      return match ? match[1].trim() : "No abstract found";
    }

    if (level === 1) {
      // 返回 Abstract + Overview
      const abstract =
        content.match(/# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/)?.[1]?.trim() ||
        "";
      const overview =
        content
          .match(/## Overview\n([\s\S]*?)(?=\n## |\n---|$)/)?.[1]
          ?.trim() || "";
      return `# Abstract\n${abstract}\n\n## Overview\n${overview}`;
    }

    // level 2: 完整内容
    return content;
  });
```

### 任务 5：索引更新函数

**updateDayOverview**：

```javascript
async function updateDayOverview(dayDir, entry) {
  const overviewPath = path.join(dayDir, ".overview.md");
  const dateStr = path.basename(dayDir);

  let lines = [];
  if (fs.existsSync(overviewPath)) {
    lines = fs.readFileSync(overviewPath, "utf-8").split("\n");
  } else {
    lines = [`# ${dateStr} 记忆概览\n`];
  }

  // 添加新条目（第3行）
  const line = `- [${entry.type}] ${entry.abstract.substring(0, 80)} → ${entry.fileName}`;
  lines.splice(2, 0, line);

  // 限制100条
  if (lines.length > 102) {
    lines.splice(102);
  }

  // 更新计数
  const count = lines.filter((l) => l.startsWith("- [")).length;
  lines[0] = `# ${dateStr} 记忆概览（${count} entries）`;

  fs.writeFileSync(overviewPath, lines.join("\n"), "utf-8");
}
```

**updateMemoryIndex**：

- 限制显示最近 20 条
- 包含相对路径链接

**updateLinkMap**：

```javascript
async function updateLinkMap(entry, filePath) {
  let linkMap = { version: "2.4.0", entries: {} };

  if (fs.existsSync(LINK_MAP_FILE)) {
    linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, "utf-8"));
  }

  const relativePath = filePath
    .replace(MEMORY_DIR + path.sep, "")
    .replace(/\\/g, "/");

  linkMap.entries[entry.id] = {
    path: relativePath,
    abstract: entry.abstract,
    type: entry.type,
    tags: entry.tags,
    pinned: entry.pinned || false,
  };

  fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
}
```

### 任务 6：同步检查逻辑

在 memory_read 和 memory_write 执行时检查待同步文件：

```javascript
async function checkAndSyncIfNeeded() {
  const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
  const pending = Object.values(linkMap.entries).filter(e => !e.synced);

  if (pending.length > 0 && await backend.isOnline()) {
    // 尝试同步
    for (const entry of pending) {
      await syncEntry(entry);
    }
  }
}

// 在 memory_read 中调用
async function memory_read(...) {
  await checkAndSyncIfNeeded();  // 读取前检查
  // ... 读取逻辑
}
```

---

## 关键约束

1. **文件名必须使用 ULID 格式**：`entry_{ulid}.md`
2. **abstract 和 overview 必填**：不接受空值
3. **分层格式**：必须包含 `# Abstract`、`## Overview`、`## Content` 三个标题
4. **同步后不重命名**：文件名列保持不变，通过 frontmatter 区分状态
5. **使用绝对路径**：`path.join(MEMORY_DIR, ...)` 确保路径正确

---

## 依赖安装

```bash
npm install ulid
# 或
npm install uuid
```

---

## 参考文件位置

- 插件入口：`opencode-memory-plugin/plugin.js`
- 配置文件：`~/.opencode/memory/memory-config.json`
- 记忆目录：`~/.opencode/memory/`
- Timeline 目录：`~/.opencode/memory/timeline/`

---

## 验证步骤

实施完成后验证：

1. ✅ `memory_write({abstract: '测试', overview: '测试', content: '测试'})` 成功
2. ✅ `memory_write({abstract: '', overview: '测试', content: '测试'})` 返回错误
3. ✅ 生成的文件名为 `entry_*.md` 格式
4. ✅ 文件包含 `# Abstract`、`## Overview`、`## Content` 三个部分
5. ✅ `memory_read({entry_id: 'xxx', level: 0})` 只返回 abstract
6. ✅ `link-map.json` 正确更新
7. ✅ `.overview.md` 正确更新

---

## 输出要求

1. 修改 `plugin.js` 添加/修改相关函数
2. 保持现有功能不变
3. 添加必要的依赖
4. 输出验证结果
