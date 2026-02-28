# OpenCode Memory Plugin - 安装流程深度分析

## 📋 目录
1. [执行入口](#执行入口)
2. [安装阶段](#安装阶段)
3. [配置生成](#配置生成)
4. [工具注册](#工具注册)
5. [目录结构](#目录结构)
6. [文件复制](#文件复制)
7. [运行时机制](#运行时机制)

---

## 执行入口

### npm install 触发机制

当用户执行：
```bash
npm install -g @csuwl/opencode-memory-plugin
```

**package.json 配置** (`opencode-memory-plugin/package.json`):

```json
{
  "name": "@csuwl/opencode-memory-plugin",
  "version": "1.2.0",
  "type": "module",
  "main": "plugin.js",
  "bin": {
    "opencode-memory-plugin": "bin/install.cjs",
    "opencode-memory": "bin/cli.cjs"
  },
  "scripts": {
    "install": "node bin/install.cjs"
  },
  "exports": {
    ".": {
      "import": "./plugin.js"
    }
  }
}
```

**关键点**:
- `"scripts": { "install": "node bin/install.cjs" }` - npm install 时自动执行
- `"main": "plugin.js"` - OpenCode 加载插件的入口点
- `"bin"` - 全局 CLI 命令注册
- `"type": "module"` - 使用 ES Module 格式

---

## 安装阶段

### install.cjs 执行流程

安装脚本 `bin/install.cjs` (CommonJS 格式) 执行以下 5 个步骤：

```
Step 1/5: Creating memory directory structure...
Step 2/5: Copying memory files...
Step 3/5: Creating memory configuration...
Step 4/5: Configuring OpenCode...
Step 5/5: Initializing today's daily log...
```

---

## 配置生成

### 1. 目录结构创建

**路径定义** (install.cjs: 24-37):
```javascript
const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_ROOT = path.join(HOME, '.opencode');
const MEMORY_DIR = path.join(MEMORY_ROOT, 'memory');
const DAILY_DIR = path.join(MEMORY_DIR, 'daily');
const OPENCORE_CONFIG_DIR = path.join(HOME, '.config', 'opencode');
const OPENCORE_CONFIG = path.join(OPENCORE_CONFIG_DIR, 'opencode.json');
```

**创建的目录** (install.cjs: 334-341):
```bash
~/.opencode/
└── memory/                    # 记忆系统根目录
    ├── daily/                  # 每日日志
    └── archive/                # 归档目录
        ├── weekly/              # 周归档
        └── monthly/             # 月归档
```

**实现函数**:
```javascript
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
```

---

### 2. 记忆文件复制

**9个核心记忆文件** (install.cjs: 41-51):

| 文件 | 大小 | 用途 |
|------|------|------|
| SOUL.md | 959B | AI 助手个性、语调、边界 |
| AGENTS.md | 2.5KB | 操作指令和记忆规则 |
| USER.md | 986B | 用户画像和偏好 |
| IDENTITY.md | 1.2KB | AI 助手身份标识 |
| TOOLS.md | 3KB | 工具使用约定 |
| MEMORY.md | 557B | 长期记忆（初始为空） |
| HEARTBEAT.md | 721B | 健康检查清单 |
| BOOT.md | 1.1KB | 启动检查清单 |
| BOOTSTRAP.md | 2.4KB | 一次性初始化仪式 |

**复制逻辑** (install.cjs: 65-79):
```javascript
function copyFileIfNotExists(source, dest) {
  if (fs.existsSync(dest)) {
    log(`  ⊙ Exists: ${path.basename(dest)} (skipped)`, 'blue');
    return false;  // 不覆盖现有文件
  }

  if (fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
    log(`  ✓ Created: ${path.basename(dest)}`, 'green');
    return true;
  }
}
```

**关键特性**:
- ✅ 不覆盖现有文件（保护用户数据）
- ✅ 首次安装时复制所有模板
- ✅ 支持增量更新（新文件会被添加）

---

### 3. 记忆配置生成

**配置文件位置**: `~/.opencode/memory/memory-config.json`

**完整配置结构** (install.cjs: 84-181):

```json
{
  "version": "2.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25",
    "cache": {
      "enabled": false
    }
  },
  "models": {
    "available": {
      "Xenova/all-MiniLM-L6-v2": {
        "dimensions": 384,
        "size": "80MB",
        "language": "en",
        "useCase": "general",
        "quality": "good",
        "speed": "fast"
      },
      "Xenova/bge-small-en-v1.5": {
        "dimensions": 384,
        "size": "130MB",
        "language": "en",
        "useCase": "high-quality",
        "quality": "excellent",
        "speed": "medium"
      },
      "Xenova/bge-base-en-v1.5": {
        "dimensions": 768,
        "size": "400MB",
        "language": "en",
        "useCase": "best-quality",
        "quality": "best",
        "speed": "slow"
      },
      "Xenova/e5-small-v2": {
        "dimensions": 384,
        "size": "130MB",
        "language": "en",
        "useCase": "question-answer",
        "quality": "good",
        "speed": "medium"
      },
      "Xenova/nomic-embed-text-v1.5": {
        "dimensions": 768,
        "size": "270MB",
        "language": "en",
        "useCase": "long-documents",
        "quality": "excellent",
        "speed": "medium"
      }
    }
  },
  "indexing": {
    "chunkSize": 400,
    "chunkOverlap": 80,
    "autoRebuild": true
  },
  "auto_save": true,
  "consolidation": {
    "enabled": true,
    "run_daily": true,
    "run_hour": 23,
    "archive_days": 30,
    "delete_days": 90
  },
  "retention": {
    "max_daily_files": 30,
    "max_entries_per_file": 100,
    "chunk_size": 400,
    "chunk_overlap": 80
  }
}
```

**配置说明**:

| 配置项 | 默认值 | 说明 |
|--------|---------|------|
| `search.mode` | `"hybrid"` | 搜索模式：hybrid/vector/bm25/hash |
| `embedding.enabled` | `true` | 是否启用embedding |
| `embedding.provider` | `"external"` | 提供者：external/transformers |
| `embedding.endpoint` | ModelScope API | 外部API端点 |
| `embedding.model` | Qwen3-Embedding-0.6B | 模型名称 |
| `embedding.fallbackMode` | `"bm25"` | 失败时的回退模式 |
| `indexing.chunkSize` | `400` | 文本分块大小（token） |
| `indexing.chunkOverlap` | `80` | 分块重叠大小 |
| `consolidation.run_daily` | `true` | 每日自动整理 |
| `consolidation.archive_days` | `30` | 30天后归档 |
| `consolidation.delete_days` | `90` | 90天后删除 |

**环境变量支持**:
```bash
# 设置 ModelScope API 密钥（推荐）
export MODELSCOPE_API_KEY='your-api-key-here'

# Windows PowerShell
$env:MODELSCOPE_API_KEY='your-api-key-here'
```

---

### 4. OpenCode 配置更新

**配置文件位置**: `~/.config/opencode/opencode.json`

**更新逻辑** (install.cjs: 186-293):

#### 4.1 备份现有配置

```javascript
if (fs.existsSync(OPENCORE_CONFIG)) {
  const backup = `${OPENCORE_CONFIG}.backup.${timestamp}`;
  fs.copyFileSync(OPENCORE_CONFIG, backup);
  log('  ⊙ Backed up existing config', 'blue');
}
```

#### 4.2 添加 instructions

```javascript
config.instructions = [
  '~/.opencode/memory/SOUL.md',
  '~/.opencode/memory/AGENTS.md',
  '~/.opencode/memory/USER.md',
  '~/.opencode/memory/IDENTITY.md',
  '~/.opencode/memory/TOOLS.md',
  '~/.opencode/memory/MEMORY.md'
];
```

**作用**: 告诉 OpenCode 在每次会话开始时加载这些文件作为上下文。

#### 4.3 注册自动化代理

**@memory-automation** (install.cjs: 226-244):
```json
{
  "description": "Automatically saves important information to memory",
  "mode": "subagent",
  "tools": {
    "memory_write": true,
    "memory_read": true,
    "memory_search": true,
    "vector_memory_search": true
  },
  "permission": {
    "memory_write": "allow",
    "memory_read": "allow",
    "memory_search": "allow",
    "vector_memory_search": "allow"
  }
}
```

**用途**: 自动检测并保存对话中的重要信息。

**@memory-consolidate** (install.cjs: 246-268):
```json
{
  "description": "Consolidates daily logs into long-term memory",
  "mode": "subagent",
  "tools": {
    "memory_write": true,
    "memory_read": true,
    "memory_search": true,
    "vector_memory_search": true,
    "list_daily": true,
    "rebuild_index": true
  },
  "permission": {
    "memory_write": "allow",
    "memory_read": "allow",
    "memory_search": "allow",
    "vector_memory_search": "allow",
    "list_daily": "allow",
    "rebuild_index": "allow"
  }
}
```

**用途**: 整理每日日志并归档到长期记忆。

#### 4.4 注册工具

**8个记忆工具** (install.cjs: 275-276):
```javascript
const tools = [
  'memory_write',
  'memory_read',
  'memory_search',
  'vector_memory_search',
  'list_daily',
  'init_daily',
  'rebuild_index',
  'index_status'
];

config.tools[tool] = true;  // 启用每个工具
```

---

### 5. 今日日志初始化

**日志文件位置**: `~/.opencode/memory/daily/YYYY-MM-DD.md`

**模板内容** (install.cjs: 298-322):
```markdown
# Daily Memory Log - 2026-02-28

*Session starts: 2026-02-28T15:30:00.000Z*

## Notes

## Tasks

## Learnings

---
```

**创建逻辑**:
```javascript
const today = new Date().toISOString().split('T')[0];
const dailyFile = path.join(DAILY_DIR, `${today}.md`);

if (!fs.existsSync(dailyFile)) {
  fs.writeFileSync(dailyFile, templateContent);
  log(`  ✓ Created daily log: ${today}.md`, 'green');
}
```

---

## 工具注册

### plugin.js - 插件入口

**OpenCode 插件加载流程**:

1. **检测**: OpenCode 扫描 `~/.opencode/node_modules/` 中的插件
2. **加载**: 读取 `plugin.js` 导出的默认函数
3. **注册**: 执行插件函数，获取工具定义
4. **集成**: 将工具添加到 OpenCode 工具列表

**工具导出结构** (plugin.js: 63-558):

```javascript
export const MemoryPlugin = async (ctx) => {
  return {
    tools: {
      memory_write: tool({
        description: "...",
        args: { ... },
        async execute(args) { ... }
      }),
      memory_read: tool({ ... }),
      memory_search: tool({ ... }),
      vector_memory_search: tool({ ... }),
      list_daily: tool({ ... }),
      init_daily: tool({ ... }),
      rebuild_index: tool({ ... }),
      index_status: tool({ ... })
    }
  };
};
```

---

## 目录结构

### 完整的安装后目录树

```
~/.opencode/
├── memory/                              # 记忆系统根目录
│   ├── SOUL.md                          # AI 助手个性
│   ├── AGENTS.md                        # 操作指令
│   ├── USER.md                          # 用户画像
│   ├── IDENTITY.md                      # AI 身份
│   ├── TOOLS.md                         # 工具约定
│   ├── MEMORY.md                        # 长期记忆
│   ├── HEARTBEAT.md                     # 健康检查
│   ├── BOOT.md                          # 启动检查
│   ├── BOOTSTRAP.md                     # 初始化仪式
│   ├── daily/                           # 每日日志
│   │   └── 2026-02-28.md               # 今日日志
│   ├── archive/                         # 归档目录
│   │   ├── weekly/                       # 周归档
│   │   └── monthly/                      # 月归档
│   └── memory-config.json               # 配置文件
├── config/                             # OpenCode 配置
│   └── opencode/                       # OpenCode 配置目录
│       ├── opencode.json                 # 主配置（已更新）
│       └── opencode.json.backup.*        # 备份文件
└── node_modules/
    └── @csuwl/
        └── opencode-memory-plugin/        # 插件目录
            ├── memory/                   # 模板文件
            ├── lib/                     # 核心库
            │   ├── vector-store.js
            │   ├── bm25.js
            │   └── service-validator.js
            ├── bin/                     # 脚本
            │   ├── install.cjs
            │   └── cli.cjs
            ├── agents/                   # 代理定义
            ├── scripts/                  # 实用脚本
            ├── plugin.js                # 插件入口
            ├── index.js                 # 插件元数据
            └── package.json
```

---

## 文件复制

### 记忆文件模板位置

**源目录**: `opencode-memory-plugin/memory/`
**目标目录**: `~/.opencode/memory/`

### SOUL.md - AI 助手个性

```markdown
# AI Assistant Personality

## Core Identity
You are OpenCode Memory, an AI coding assistant with persistent memory and semantic search capabilities.

## Tone and Style
- Professional, friendly, and concise
- Prefer direct answers over long explanations
- Use code examples when helpful
- Always maintain context of previous conversations through memory

## Boundaries
- Always ask before making destructive changes
- Respect user's time and attention
- Admit when you don't know something
- Never hallucinate information - check memory first

## Memory Awareness
- You have access to persistent memory through the memory tools
- Always consult memory before answering questions
- Proactively save important information to memory
- Use semantic search to find relevant past information

## Working Principles
- Quality over quantity
- Clarity over cleverness
- Test your assumptions
- Learn from mistakes (document them in memory)
```

**作用**: 定义 AI 助手的行为准则、语气和边界。

### AGENTS.md - 操作指令

```markdown
# Agent Operating Instructions & Memory

## Primary Directives

1. **Memory First**: Always consult your memory before providing advice or making decisions
2. **Proactive Saving**: Automatically save important information to memory without being asked
3. **Context Awareness**: Use semantic search to find relevant past conversations and decisions
4. **Learning Mindset**: Continuously improve based on feedback (document successes and failures)

## How to Use Memory

### When to Read Memory
- At the start of every conversation (already injected)
- When answering questions about preferences, conventions, or past decisions
- Before suggesting solutions to check if similar problems were solved before

### When to Write Memory
- User states a preference or rule
- A successful pattern or approach is discovered
- An important decision is made with rationale
- User feedback is received (positive or negative)
- Project-specific conventions are established

### Memory Priority
**Long-term (MEMORY.md)**:
- User preferences and coding style
- Project-specific conventions and rules
- Successful patterns and solutions
- Important decisions and their rationale
- Lessons learned from mistakes

**Daily (memory/YYYY-MM-DD.md)**:
- Running context for current work
- Temporary notes that might become long-term
- Questions asked and answered
- Tasks completed and pending
```

**作用**: 定义如何使用记忆系统的规则。

### USER.md - 用户画像

```markdown
# User Profile & Preferences

## User Identity
- Name: Your Name
- Communication Style: Professional, direct, concise
- Language Preference: English
- Timezone: UTC

## Preferred Communication
- Get straight to the point
- Show, don't just tell
- Use examples
- Summarize key takeaways

## Working Style
- Provide context upfront
- Ask clarifying questions when uncertain
- Prefer multiple options over single approach
- Want to understand "why", not just "what"
```

**作用**: 定义用户偏好和工作风格（应个性化）。

### MEMORY.md - 长期记忆

```markdown
# Long-Term Memory

This file stores important information that should persist across all sessions and projects.

## User Preferences & Habits
- (To be populated as user interacts)

## Project-Specific Knowledge
- (To be populated as user interacts)

## Successful Patterns & Solutions
- (To be populated as user interacts)

## Important Decisions & Rationale
- (To be populated as user interacts)

## Lessons Learned
- (To be populated from mistakes and their fixes)

---
*Last Updated: 2026-02-28*
```

**作用**: 存储跨会话持久化的重要信息。

---

## 运行时机制

### 向量存储初始化

**文件**: `lib/vector-store.js`

**初始化流程** (plugin.js: 231-251):

```javascript
const vectorStore = getVectorStore();

if (!vectorStore.initialized) {
  const initResult = await vectorStore.initialize({
    dbPath: config.dbPath,
    useExternalService: config.embedding?.enabled,
    externalEndpoint: config.embedding?.endpoint
  });

  if (!initResult.success) {
    // 回退到 BM25 搜索
    return {
      success: true,
      mode: 'keyword',
      matches: await fallbackBM25Search(query, limit),
      note: `Vector search unavailable: ${initResult.error}. Using keyword search.`
    };
  }
}
```

### Embedding 服务选择

**优先级** (vector-store.js: 201-299):

```
1. ModelScope API (如果设置了 MODELSCOPE_API_KEY)
   - Endpoint: https://api-inference.modelscope.cn/v1/embeddings
   - Model: Qwen/Qwen3-Embedding-0.6B
   - Dimensions: 1024
   - Latency: ~50-100ms

2. 本地服务 (localhost:18000)
   - Endpoint: http://localhost:18000/embeddings
   - Model: 自定义
   - Dimensions: 动态检测
   - Latency: ~50-100ms

3. BM25 关键词搜索 (最终回退)
   - No external service required
   - Fast: <1ms
   - Quality: ⭐⭐ Keywords
```

### 搜索流程

**vector_memory_search 工具** (plugin.js: 200-293):

```javascript
async execute(args) {
  const { query, mode, limit, threshold } = args;

  // 1. 读取配置
  const config = getConfig();

  // 2. 初始化向量存储
  const vectorStore = getVectorStore();
  await vectorStore.initialize({ model: config.embedding?.model });

  // 3. 根据模式执行搜索
  const searchMode = mode || config.search?.mode || 'hybrid';

  if (searchMode === 'vector') {
    results = await vectorStore.search(query, { limit, threshold });
  } else if (searchMode === 'keyword') {
    results = vectorStore.keywordSearch(query, { limit });
  } else {
    // Hybrid 模式（默认）
    results = await vectorStore.search(query, { limit, threshold: 0.3 });
  }

  // 4. 返回结果
  return {
    success: true,
    query,
    mode: searchMode,
    matches: results.map(r => ({ ... })),
    count: results.length,
    model: vectorStore.modelName,
    indexed: vectorStore.getIndexedCount()
  };
}
```

### 错误处理

**多层回退机制**:

```
Layer 1: ModelScope API
    ↓ 失败
Layer 2: 本地服务 (localhost:18000)
    ↓ 失败
Layer 3: BM25 关键词搜索
    ↓ 失败
Layer 4: 简单关键词搜索（最后的回退）
```

**实现** (plugin.js: 281-291):
```javascript
catch (e) {
  return {
    success: true,  // 仍然返回成功（使用回退）
    query,
    mode: 'keyword',
    matches: await fallbackBM25Search(query, 10),
    note: `Vector search failed: ${e.message}. Using keyword search.`
  };
}
```

---

## 总结

### 安装流程图

```
npm install -g @csuwl/opencode-memory-plugin
    ↓
┌─────────────────────────────────────────┐
│ Step 1: 创建目录结构               │
│ ~/.opencode/memory/                  │
│ ├── daily/                         │
│ └── archive/                       │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 2: 复制记忆文件               │
│ SOUL.md, AGENTS.md, USER.md,       │
│ IDENTITY.md, TOOLS.md, MEMORY.md,   │
│ HEARTBEAT.md, BOOT.md, BOOTSTRAP.md│
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 3: 创建配置文件               │
│ ~/.opencode/memory/memory-config.json  │
│ - 搜索模式配置                      │
│ - Embedding 配置                  │
│ - 索引参数                          │
│ - 自动化规则                        │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 4: 更新 OpenCode 配置         │
│ ~/.config/opencode/opencode.json     │
│ - 添加 instructions 路径           │
│ - 注册 @memory-automation 代理        │
│ - 注册 @memory-consolidate 代理       │
│ - 启用 8 个记忆工具               │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 5: 初始化今日日志             │
│ ~/.opencode/memory/daily/YYYY-MM-DD.md│
└─────────────────────────────────────────┘
    ↓
✅ 安装完成！
```

### 关键特性

| 特性 | 描述 |
|------|------|
| ✅ 零配置 | 开箱即用，无需手动设置 |
| ✅ 不覆盖 | 保护现有文件和数据 |
| ✅ 自动回退 | 多层回退机制保证可用性 |
| ✅ 灵活配置 | 支持多种 embedding 服务 |
| ✅ 自动化 | 内置自动保存和整理代理 |
| ✅ 向量搜索 | 支持语义搜索和关键词搜索 |

### 文件统计

```
创建的目录: 7
复制的文件: 9 (首次安装)
创建的配置: 2 (memory-config.json, opencode.json)
注册的工具: 8
注册的代理: 2
总代码行数: ~1000+
```

---

*生成时间: 2026-02-28*
*版本: v1.2.0*
