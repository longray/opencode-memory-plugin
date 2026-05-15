# AGENTS.md - OpenCode Memory Plugin 开发指南

**版本**: v3.3.0  
**分支**: main  
**更新时间**: 2026-05-15

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
│   │   ├── memory-core.js    # writeMemory, readMemory, writeAndSyncMemory, syncMemoryToBackend,
│   │   │                     #   updateEntity, getEntityAtoms, markDeadLinks, loadContextByBudget,
│   │   │                     #   loadContextByLevel
│   │   ├── wrapper-client.js # 后端 API 客户端
│   │   ├── project-resolver.js # 项目 ID 解析器
│   │   ├── bm25.js           # BM25 关键词搜索
│   │   ├── trie-index.js     # Trie 索引
│   │   ├── ws-client.js      # WebSocket 客户端
│   │   ├── code-analyzer.js  # 代码 AST 分析（Oxc + Tree-sitter）
│   │   ├── tree-sitter-parser.js # 多语言 AST 解析（Python/Go/Rust/Java）
│   │   ├── project-analyzer.js   # 项目级分析（健康度评级）
│   │   ├── code-analysis-formatter.js # 输出格式化（table/tree/json）
│   │   ├── code-analysis-service.js # 批量分析队列
│   │   ├── graphify-bridge.js  # graphify graph.json → SurrealDB 桥接
│   │   ├── privacy-filter.js # 敏感内容过滤
│ │ ├── file-watcher.js # 文件系统监听
│ │ └── memory-id-cache.js # Memory ID 缓存管理
│   ├── tools/                # OpenCode 插件工具
│   │   ├── core.js           # memory_write, memory_pin, entity_update, entity_atoms,
│   │   │                     #   load_context_budget, load_context_level
│   │   ├── search.js         # memory_search, memory_suggest
│   │   ├── graph.js          # memory_relate, memory_graph
│   │   ├── browse.js         # memory_timeline, memory_topics
│   │   └── sync.js           # index_status, rebuild_index, incremental_sync, full_sync,
│   │                          #   sync_checkpoint, conflict_list, conflict_resolve
│   ├── cli/                  # CLI 工具
│   │   └── index.mjs         # 命令行界面
│   ├── bin/                  # 安装脚本
│   │   └── install.cjs       # NPM 安装钩子
│   ├── memory/               # 记忆文件模板（安装时复制到 ~/.opencode/memory/）
│   ├── agents/               # 自定义 OpenCode 代理
│   ├── scripts/              # 实用脚本
│   ├── docs/                 # 产品文档（面向用户）
│   ├── tests/                # 测试文件
│   │   ├── unit/             # 单元测试（core/, search/, sync/, atoms/, analysis/, websocket/, graphify-bridge/）
│   │   ├── integration/      # 集成测试
│   │   ├── e2e/              # 端到端测试
│   │   ├── performance/      # 性能测试
│   │   ├── cli/              # CLI 测试
│   │   └── helpers/          # 测试辅助工具
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

| 文件                  | 主要导出                                                                                                                          | 说明                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| memory-core.js        | writeMemory, readMemory, writeAndSyncMemory, updateEntity, getEntityAtoms, markDeadLinks, loadContextByBudget, loadContextByLevel | 写入/读取/同步/实体/Atom 核心逻辑    |
| entry.js              | buildEntryContent, writeEntryToTimeline, parseEntryFromFile                                                                       | 条目格式化和文件操作                 |
| extractor.js          | extractByLevel, getEntryInfo                                                                                                      | 分层提取和 frontmatter 解析          |
| wrapper-client.js     | WrapperClient                                                                                                                     | 后端 API 客户端（所有 HTTP 调用）    |
| graphify-bridge.js    | importGraphJSON, importGraphJSONIncremental, graphifyProject, classifyNodes, diffGraphs, nodeHash, loadCache, saveCache, buildAtomPayload, buildEntityPayload, buildReferencePayload | graphify graph.json → SurrealDB 桥接 + 增量导入 |
| storage.js            | getConfig, getLinkMap, getEntryById                                                                                               | 配置和 link-map 读取                 |
| trie-index.js         | searchByPrefix, getAutocompleteSuggestions                                                                                        | Trie 索引和自动补全                  |
| code-analyzer.js      | CodeAnalyzer                                                                                                                      | 代码 AST 分析（Oxc + Tree-sitter）   |
| tree-sitter-parser.js | analyzeWithTreeSitter                                                                                                             | 多语言 AST 解析                      |
| project-analyzer.js   | ProjectAnalyzer                                                                                                                   | 项目级分析（健康度评级）             |

### tools/ 工具

| 文件      | 工具                                                                                                       | 后端依赖       |
| --------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| core.js   | memory_write, memory_pin, entity_update, entity_atoms, load_context_budget, load_context_level             | 同步           |
| search.js | memory_search, memory_suggest                                                                              | 搜索时后端优先 |
| graph.js  | memory_relate, memory_graph                                                                                | 必须           |
| browse.js | memory_timeline, memory_topics                                                                             | 无             |
| sync.js   | index_status, rebuild_index, incremental_sync, full_sync, sync_checkpoint, conflict_list, conflict_resolve | 必须           |

---

## 记忆条目格式 (v3.3)

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
- **abstract**: 必填，建议 ≤100 字符（超长会警告但不拒绝）
- **overview**: 必填，建议 ≤500 字符（超长会警告但不拒绝）

### Atom 扩展（v3.3+）

条目可包含 `atoms` 字段，支持层级化知识组织：

```yaml
---
atoms:
  - local_id: "01CHAP001"
    type: chapter
    name: "第1章：标题"
    content: "章节内容..."
    order: "a0"
    heading_level: 1
    parent_id: null
    children:
      - local_id: "01SEC001"
        type: section
        name: "1.1 小节标题"
        order: "a0"
        heading_level: 2
        parent_id: "01CHAP001"
---
```

- **层级**: 通过 `parent_id` + `children` 构成树结构（最多 4 层）
- **链接**: 内容中使用 `[[local_id]]` 引用其他 Atom，系统自动解析
- **类型**: chapter / section / function / class / note / task / goal
- **验证**: 自动检测循环引用和悬空链接

---

## 后端 API

详见 [`docs/API-CONTRACT.md`](./docs/API-CONTRACT.md)

| 后端地址 | localhost:18008 |
| API 前缀 | `/api/v1` |
| API 文档 | `http://localhost:18008/docs` |
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

## 集成测试规范

### 后端联调测试

**Tenant 配置统一**: 写测试时必须使用 `default` tenant 来匹配后端的标准配置，否则会出现前后端理解不统一的问题，导致测试失败。

**测试数据要求**:

- 上传测试数据时必须包含 `tenant_id: "default"`
- 项目 ID 使用测试专用项目（如 `test-project`）
- 测试完成后清理测试数据

**验证流程**:

1. 上传代码文件 → 验证返回 memory_id
2. 查询验证 → 确认数据已持久化
3. 创建调用关系 → 验证 references/dependencies API
4. 项目地图验证 → 确认可视化数据正确

---

## 内置代理

项目在 `opencode-memory-plugin/agents/` 中内置了两个自动化代理，安装时自动注册到 OpenCode。

### 代理一览

| 代理文件                | 别名          | 职责                                 |
| ----------------------- | ------------- | ------------------------------------ |
| `memory-automation.md`  | The Observer  | 对话后萃取重要信息，向用户确认后保存 |
| `memory-consolidate.md` | The Librarian | 定期聚合碎片记忆，建立图谱关联和置顶 |

### memory-automation（The Observer）

**模式**：`primary`（用户通过 Tab 键切换到该代理）

**为什么是 primary 而非 subagent**：subagent 无法与用户多轮交互，Human-in-the-loop 确认流程在 subagent 模式下不可能实现。改为 primary 后，用户 Tab 切换到 The Observer → 审阅候选清单 → 确认保存 → Tab 切回主代理。

**工作流**：

1. 用户 Tab 切换到 The Observer
2. 分析当前对话，识别值得保存的信息（最多 5 条候选）
3. 对每条候选调用 `memory_search` 查重
4. 展示候选清单，等待用户选择（Save all / Save N / Edit / Discard）
5. 对确认条目调用 `memory_write`（含 abstract/overview/content 三层）

**模型**：`claude-sonnet-4`（指令遵循更强，避免跳过确认步骤）

**工具白名单**：`memory_write`, `memory_read`, `memory_search`, `memory_suggest`, `memory_timeline`, `memory_topics`, `memory_pin`

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

## Pre-commit 质量门禁

### 已配置的检查项

| 检查项           | 工具         | 阶段       | 说明                                | 耗时     |
| ---------------- | ------------ | ---------- | ----------------------------------- | -------- |
| 🔐 安全扫描      | Gitleaks     | pre-commit | 检测硬编码的秘密（API key、密码等） | <5 秒    |
| 🔍 代码检查      | Oxlint       | pre-commit | JavaScript 代码规范检查             | <10 秒   |
| 💅 代码格式化    | Prettier     | pre-commit | 代码格式化（JS/JSON/MD/YAML）       | <10 秒   |
| 📝 Markdown 检查 | Markdownlint | pre-commit | Markdown 文档规范检查               | <5 秒    |
| 🧪 测试运行      | Jest         | pre-commit | 运行所有测试（57 个文件）           | 30-60 秒 |

### 测试门禁配置

**配置文件**: `.pre-commit-config.yaml`

**测试命令**: `npm test`

**测试框架**: Jest (`jest@^29.7.0`)

**测试文件**: `opencode-memory-plugin/tests/**/*.test.*`（57 个文件）

**运行策略**:

- 运行所有测试（不限制文件）
- 使用 `node --experimental-vm-modules` 运行 Jest
- 测试失败会阻止提交

**如何跳过测试门禁**（不推荐）:

```bash
git commit --no-verify -m "your message"
```

### 本地运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监视模式（开发时使用）
npm run test:watch
```

### 为什么添加测试门禁？

**决策日期**: 2026-04-02

**原因**:

1. 确保提交前所有测试通过
2. 避免 broken code 进入主分支
3. 提高代码质量和信心
4. 早期发现问题，降低修复成本

**性能影响**:

- 测试运行时间：30-60 秒
- 总 pre-commit 时间：约 60-90 秒（包含所有检查）

---

## 文档分工

### 三类文档

| 类别        | 文档                                           | 受众          | 内容                              |
| ----------- | ---------------------------------------------- | ------------- | --------------------------------- |
| **产品**    | `README.md`                                    | 用户/AI Agent | GitHub 首页、安装、使用           |
| **产品**    | `README.npm.md`                                | npm 用户      | npm 包首页                        |
| **产品**    | `CHANGELOG.md`                                 | 所有人        | 版本发布记录                      |
| **产品**    | `opencode-memory-plugin/CONFIGURATION.md`      | 用户          | 配置指南                          |
| **产品**    | `opencode-memory-plugin/QUICK_START.md`        | 新用户        | 快速入门                          |
| **产品**    | `opencode-memory-plugin/TROUBLESHOOTING.md`    | 用户          | 故障排除                          |
| **产品**    | `opencode-memory-plugin/EXTERNAL_EMBEDDING.md` | 用户          | 嵌入服务配置                      |
| **产品**    | `opencode-memory-plugin/WINDOWS_SETUP.md`      | Windows 用户  | 安装说明                          |
| **开发**    | `AGENTS.md`                                    | 开发者        | 项目结构、代码规范（本文件）      |
| **开发**    | `docs/API-CONTRACT.md`                         | 开发者        | 工具↔后端 API 映射                |
| **开发**    | `docs/CODE-ANALYSIS-DESIGN.md`                 | 开发者        | 代码分析远期功能设计（v1.0 归档） |
| **开发**    | `docs/CODE_ANALYSIS_DEVELOPMENT.md`            | 开发者        | 代码分析开发者指南（v3.0 + v1.4） |
| **backlog** | `BACKLOG.md`                                   | 项目管理      | 未完成任务                        |
| **backlog** | `backlog_archive.md`                           | 项目管理      | 已完成任务归档                    |

### Backlog 编号规则

> ⚠️ **重要**：创建新任务前必须检查编号，违反规则会导致任务管理混乱！

- **格式**: `BL-{N}` 主任务 / `BL-{N}.{SS}` 步骤（SS 两位数字，01 补零）
- **最多两层**: 主任务 + 步骤，不嵌套
- **编号递增**: 从 BL-1 起，**永不复用、永不跳号**
- **归档规则**: `[x]` 已完成的超过 5 条时剪切到 `backlog_archive.md`
- **旧编号**: `BL-001`~`BL-610` 已归档，保留在 archive 中作为历史记录

#### 创建新任务检查清单

**必须按顺序执行**：

```bash
# 1. 检查当前最大编号
grep "### BL-" BACKLOG.md | tail -1
# 输出：### BL-25 [P2] WINDOWS_SETUP.md 内容扩展

# 2. 确认新编号未被使用
grep "### BL-26" BACKLOG.md
# 应无结果（如有结果，说明编号已使用，用 BL-27）

# 3. 确认编号连续
# 从 BL-25 推断下一个是 BL-26（正确）
# 如跳到 BL-27（错误，违反"永不跳号"）
```

#### 错误示例（禁止行为）

❌ **复用编号**：

```markdown
### BL-17 [P0] 新任务 # 错误！BL-17 已存在
```

❌ **跳号**：

```markdown
### BL-25 [P2] 任务 A

### BL-27 [P2] 任务 B # 错误！跳过 BL-26
```

❌ **不检查直接使用**：

```markdown
# 错误：没有运行 grep 检查就直接写 BL-26

### BL-26 [P0] 新任务
```

#### 正确示例

✅ **正确流程**：

```bash
# 1. 检查当前最大编号
$ grep "### BL-" BACKLOG.md | tail -1
### BL-25 [P2] WINDOWS_SETUP.md 内容扩展

# 2. 确认 BL-26 未被使用
$ grep "### BL-26" BACKLOG.md
# 无结果（可用）

# 3. 创建新任务
### BL-26 [P0] 新任务名称
```

#### 快速参考

| 检查项         | 命令                                   | 预期结果    |
| -------------- | -------------------------------------- | ----------- |
| 当前最大编号   | `grep "### BL-" BACKLOG.md \| tail -1` | `### BL-25` |
| 下一个可用编号 | 最大编号 +1                            | `BL-26`     |
| 编号是否被使用 | `grep "### BL-26" BACKLOG.md`          | 无结果      |
| 编号连续性     | 检查 BL-1 到最大编号                   | 无跳号      |

---

## 测试注意事项

### Windows 环境 tenant_id 问题

**问题**: 在 Windows 上运行测试时，WrapperClient 默认使用 `process.env.USERNAME`（如 "Longray"）作为 tenant_id，但后端查询可能默认使用 "default"，导致 tenant_id 不匹配。

**症状**:

- 上传成功（返回 memory_id）
- 查询返回 `found: false`
- 测试失败

**解决方案**: 在测试中显式指定 tenant_id：

```javascript
wrapperClient = new WrapperClient({
  backend: {
    tenant_id: "default", // 显式指定，避免使用 USERNAME
  },
});
```

---

## AGENTS.md - 项目级 Agent 行为规则

## 规则 1：自动生成 project.md

当用户说"生成 project.md"、"更新项目上下文"、"扫描现有代码"等时：

- 自动调用 skill("project-context-writer")
- 不要直接写文件，先走 brainstorming → 扫描 → writing-plans 的完整流程

## 规则 2：OpenSpec 变更自动走 OMO

当用户处于 openspec/changes/\*/ 目录上下文，或输入 /opsx:apply、/opsx:continue 时：

- 自动调用 skill("opsx-execute")
- 传入变更名称作为参数
- 禁止直接单 agent 编码，必须经过 Sisyphus 调度

## 规则 3：存量项目约束（全局）

所有涉及本项目的编码任务必须遵守：

1. 向后兼容 —— 旧 API 不能断，新字段必须 optional
2. 数据库迁移只增不减
3. 修改现有函数前，必须先读原函数签名和测试
4. 优先写适配层，不要直接改旧数据格式

## 规则 4：Superpowers 调用规范

当需要 Superpowers 技能时：

- 如果 OMO 未启用：直接 `skill("brainstorming")`
- 如果 OMO 已启用：使用 `skill("superpowers/brainstorming")` 避免冲突
