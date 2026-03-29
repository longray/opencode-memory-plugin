# AGENTS.md - OpenCode Memory Plugin 开发指南

**版本**: v2.9.0  
**分支**: main  
**更新时间**: 2026-03-29

---

## 项目结构

```
D:/github/opencode-memory-plugin/
├── opencode-memory-plugin/
│   ├── lib/                  # 核心库（CLI 和 Plugin 共用）
│   │   ├── constants.js      # 常量定义
│   │   ├── ulid.js           # ULID 生成
│   │   ├── entry.js          # buildEntryContent, writeEntryToTimeline, parseEntryFromFile
│   │   ├── extractor.js      # extractByLevel, getEntryInfo
│   │   ├── indexer.js        # updateLinkMap, updateMemoryIndex
│   │   ├── storage.js        # getConfig, getLinkMap, getEntryById
│   │   ├── memory-core.js    # writeMemory, readMemory, writeAndSyncMemory, syncMemoryToBackend
│   │   ├── wrapper-client.js # 后端 API 客户端
│   │   ├── project-resolver.js # 项目 ID 解析器
│   │   ├── bm25.js           # BM25 关键词搜索
│   │   ├── trie-index.js     # Trie 索引
│   │   └── ws-client.js      # WebSocket 客户端
│   ├── tools/                # OpenCode 插件工具
│   │   ├── core.js           # memory_write
│   │   ├── search.js         # memory_search, memory_suggest
│   │   ├── graph.js          # memory_relate, memory_graph
│   │   ├── browse.js         # memory_timeline, memory_topics
│   │   └── sync.js           # index_status, rebuild_index, incremental_sync, full_sync,
│   │                          #   sync_checkpoint, conflict_list, conflict_resolve
│   ├── cli/                  # CLI 工具
│   │   └── index.cjs         # 命令行界面
│   ├── bin/                  # 安装脚本
│   │   └── install.cjs       # NPM 安装钩子
│   ├── memory/               # 记忆文件模板（安装时复制到 ~/.opencode/memory/）
│   ├── agents/               # 自定义 OpenCode 代理
│   ├── scripts/              # 实用脚本
│   ├── docs/                 # 产品文档（面向用户）
│   ├── plugin.js             # OpenCode 插件入口
│   └── package.json
├── docs/                     # 开发文档
│   ├── API-CONTRACT.md       # 工具↔后端 API 映射
│   ├── CODE-ANALYSIS-DESIGN.md # 远期功能设计
│   ├── BACKLOG.md            # 旧归档（详细开发日志）
│   └── archive/              # 已归档的过时设计文档
├── README.md                 # [产品] GitHub 首页
├── CHANGELOG.md              # [产品] 版本发布记录
├── BACKLOG.md                # [backlog] 未完成任务
├── backlog_archive.md        # [backlog] 已完成任务归档
└── AGENTS.md                 # [开发] 本文件
```

---

## 模块映射

### lib/ 核心库

| 文件              | 主要导出                                                    | 说明                              |
| ----------------- | ----------------------------------------------------------- | --------------------------------- |
| memory-core.js    | writeMemory, readMemory, writeAndSyncMemory                 | 写入/读取/同步核心逻辑            |
| entry.js          | buildEntryContent, writeEntryToTimeline, parseEntryFromFile | 条目格式化和文件操作              |
| extractor.js      | extractByLevel, getEntryInfo                                | 分层提取和 frontmatter 解析       |
| wrapper-client.js | WrapperClient                                               | 后端 API 客户端（所有 HTTP 调用） |
| storage.js        | getConfig, getLinkMap, getEntryById                         | 配置和 link-map 读取              |
| trie-index.js     | searchByPrefix, getAutocompleteSuggestions                  | Trie 索引和自动补全               |

### tools/ 工具

| 文件      | 工具                                                                                                       | 后端依赖       |
| --------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| core.js   | memory_write                                                                                               | 同步           |
| search.js | memory_search, memory_suggest                                                                              | 搜索时后端优先 |
| graph.js  | memory_relate, memory_graph                                                                                | 必须           |
| browse.js | memory_timeline, memory_topics                                                                             | 无             |
| sync.js   | index_status, rebuild_index, incremental_sync, full_sync, sync_checkpoint, conflict_list, conflict_resolve | 必须           |

---

## 记忆条目格式 (v2.5.0)

```
---
id: {ulid}
date: {ISO8601}
type: {type}
tags: [{tags}]
project: {project}
memory_id: {memory_id}
source_id: {source_id}
synced: {boolean}
synced_at: {timestamp}
meta: [{键:值}, ...]
---

# ≡≡≡ Abstract ≡≡≡
```

{abstract 内容}

```

# ≡≡≡ Overview ≡≡≡
```

{overview 内容}

```

# ≡≡≡ Contents ≡≡≡
```

{完整内容}

```

---
```

- **分隔符**: `# ≡≡≡ {标题} ≡≡≡` (3个≡)
- **内容区域**: 使用 ``` 代码块包围
- **meta**: 可选，JSON 数组 `[{"key":"value"},...]`
- **abstract**: 必填，≤100 字符
- **overview**: 必填，≤500 字符

---

## 后端 API

详见 [`docs/API-CONTRACT.md`](./docs/API-CONTRACT.md)

| 后端地址 | localhost:17999 |
| API 前缀 | `/api/v1` |
| API 文档 | `http://localhost:17999/docs` |
| 认证 | Header: `WRAPPER_MEILI_API_KEY` |

---

## 工具选择规则

**搜索与重构任务的工具优先级**：

1. **ripgrep (rg)**：文本搜索首选（自动跳过 node_modules，并行搜索）
2. **ast-grep (sg)**：结构重构首选（AST 感知，精准替换）
3. **grep**：仅用于管道过滤或极简环境（无 rg/sg 时）

**禁止**：使用 `grep -r` 进行递归目录搜索。

**复杂场景**：调用 `skill("code-search")` 获取详细策略。

## 代码规范

### 提交格式

- `feat:` 新功能
- `fix:` 修复 bug
- `refactor:` 重构
- `docs:` 文档更新
- `chore:` 构建/配置

### 红线规则

- 不将敏感信息提交至代码库
- 不移除向后兼容性功能
- 不在没有 fallback 的情况下移除关键功能
- 不修改 memory/ 下的模板文件

---

## 内置代理

项目在 `opencode-memory-plugin/agents/` 中内置了两个自动化代理，安装时自动注册到 OpenCode。

### 代理一览

| 代理文件                | 别名          | 职责                                 |
| ----------------------- | ------------- | ------------------------------------ |
| `memory-automation.md`  | The Observer  | 对话后萃取重要信息，向用户确认后保存 |
| `memory-consolidate.md` | The Librarian | 定期聚合碎片记忆，建立图谱关联和置顶 |

### memory-automation（The Observer）

**触发方式**：`@memory-automation`

**工作流**：

1. 分析对话，识别值得保存的信息（决策、偏好、解决方案）
2. 按类别归类，输出候选条目清单
3. 等待用户确认选择（Human-in-the-loop）
4. 对确认条目调用 `memory_write`（含 abstract/overview/content 三层）
5. 调用 `memory_search` 查重，避免重复保存

**工具白名单**：`memory_write`, `memory_read`, `memory_search`, `memory_suggest`, `memory_pin`, `incremental_sync`

### memory-consolidate（The Librarian）

**触发方式**：`@memory-consolidate`

**工作流**（S.O.P.）：

1. `memory_timeline(days=7, level=1)` + `memory_topics` 发现碎片
2. `memory_write` 聚合提炼为单条高价值节点
3. `memory_relate(relation_type="summarizes")` 织网，保留知识溯源
4. `memory_pin` 置顶关键约定
5. `incremental_sync` 静默同步

**工具白名单**：`memory_write`, `memory_read`, `memory_search`, `memory_suggest`, `memory_timeline`, `memory_topics`, `memory_relate`, `memory_graph`, `memory_pin`, `incremental_sync`, `conflict_list`, `conflict_resolve`

### 代理红线（禁止行为）

- **禁止** 代理使用 `bash` 对记忆目录进行物理文件操作（移动、删除、重命名）
- **禁止** 代理绕过 Human-in-the-loop 直接批量写入（memory-automation）
- **禁止** 代理使用已废弃工具（`list_daily`、`batch_resolve`、`full_sync` 等）
- **禁止** `memory_write` 省略 `abstract` 或 `overview` 字段

### 依赖

- `@opencode-ai/plugin` - OpenCode 插件框架
- Node.js 16+

### Lint 配置

**工具**: Oxlint + Prettier（替代 ESLint）

**选择原因**:

- Oxlint 基于 Rust 构建，速度比 ESLint 快 10-50 倍
- 开箱即用，无需复杂配置
- 与 Prettier 天然兼容，无规则冲突

**配置要点**:

- `.oxlintrc.json` - Oxlint 规则配置
  - `caughtErrorsIgnorePattern: "^_"` 需显式配置（catch 参数忽略 `_` 前缀）
  - `varsIgnorePattern` 和 `argsIgnorePattern` 默认就是 `^_`
- `.prettierrc` - Prettier 格式配置（保持不变）
- `.eslintignore` - 忽略文件列表（Oxlint 使用此文件）

**Oxlint 不支持的规则**（原 ESLint 规则）:

- `no-shadow`
- `prefer-arrow-callback`
- `object-shorthand`
- `no-multiple-empty-lines`
- `eol-last`

**npm scripts**:

- `npm run lint` - 检查代码规范
- `npm run lint:fix` - 自动修复可修复的问题
- `npm run lint:md` - 检查 Markdown 规范
- `npm run lint:md:fix` - 自动修复 Markdown 问题
- `npm run format` - 格式化代码
- `npm run format:check` - 检查格式是否正确

### 文档规范

**工具**: Markdownlint-cli2

**选择原因**:

- 支持命令行检查（marksman 不支持）
- 官方 pre-commit 集成
- 支持自动修复
- 配置灵活

**配置文件**: `.markdownlint-cli2.jsonc`

**禁用规则**:

- `MD013` - 行长度检查（允许长行）
- `MD033` - 内联 HTML（允许特殊格式）
- `MD036` - 强调代替标题（允许特殊格式）
- `MD040` - 代码块语言指定（允许无语言代码块）
- `MD041` - 首行 H1（允许特殊文档）
- `MD051` - 链接片段（允许特殊链接）

**编写规范**:

- 标题层级: `#` → `##` → `###`，不跳级
- 链接格式: 使用相对路径，避免绝对路径
- 代码块: 使用三重反引号，指定语言
- 表格: 使用对齐格式，保持一致性
- 避免重复标题: 同一文件中不要有相同标题

**npm scripts**:

- `npm run lint:md` - 检查 Markdown 规范
- `npm run lint:md:fix` - 自动修复 Markdown 问题

---

## 文档分工

### 三类文档

| 类别        | 文档                                           | 受众          | 内容                         |
| ----------- | ---------------------------------------------- | ------------- | ---------------------------- |
| **产品**    | `README.md`                                    | 用户/AI Agent | GitHub 首页、安装、使用      |
| **产品**    | `README.npm.md`                                | npm 用户      | npm 包首页                   |
| **产品**    | `CHANGELOG.md`                                 | 所有人        | 版本发布记录                 |
| **产品**    | `opencode-memory-plugin/CONFIGURATION.md`      | 用户          | 配置指南                     |
| **产品**    | `opencode-memory-plugin/QUICK_START.md`        | 新用户        | 快速入门                     |
| **产品**    | `opencode-memory-plugin/TROUBLESHOOTING.md`    | 用户          | 故障排除                     |
| **产品**    | `opencode-memory-plugin/EXTERNAL_EMBEDDING.md` | 用户          | 嵌入服务配置                 |
| **产品**    | `opencode-memory-plugin/WINDOWS_SETUP.md`      | Windows 用户  | 安装说明                     |
| **开发**    | `AGENTS.md`                                    | 开发者        | 项目结构、代码规范（本文件） |
| **开发**    | `docs/API-CONTRACT.md`                         | 开发者        | 工具↔后端 API 映射           |
| **开发**    | `docs/CODE-ANALYSIS-DESIGN.md`                 | 开发者        | 远期功能设计                 |
| **backlog** | `BACKLOG.md`                                   | 项目管理      | 未完成任务                   |
| **backlog** | `backlog_archive.md`                           | 项目管理      | 已完成任务归档               |

### Backlog 编号规则

- **格式**: `BL-{N}` 主任务 / `BL-{N}.{SS}` 步骤（SS 两位数字，01 补零）
- **最多两层**: 主任务 + 步骤，不嵌套
- **编号递增**: 从 BL-1 起，永不复用、永不跳号
- **归档规则**: `[x]` 超过 5 条时剪切到 `backlog_archive.md`
- **旧编号**: `BL-001`~`BL-610` 已归档，保留在 archive 中作为历史记录
