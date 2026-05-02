# OpenCode Memory Plugin v3.3 开发文档

> **版本**: v3.3.0 (Atom Architecture Edition)  
> **日期**: 2026-05-02  
> **状态**: Phase 1 ✅ 已完成，Phase 2 ✅ 已完成 (Prompt 注入)，Phase 3 ✅ 已完成

---

## 目录结构

```
docs/v3.3/
├── README.md                          # 本文件 - 目录总览
├── AGENTS.md                          # 文档分工和智能体操作指南
├── architecture/                      # 架构设计文档
│   ├── README.md
│   └── ATOM-ARCHITECTURE.md           # Atom 架构详细设计（从根目录移入）
├── evaluation/                        # 效果评估
│   ├── README.md
│   ├── DESIGN-EVALUATION.md           # 评估方案设计（升级自 EVALUATION-PLAN）
│   ├── IMPLEMENTATION-EVALUATION.md   # 评估实施手册
│   └── scripts/                       # 可执行评估脚本
│       ├── evaluate-atom-quality.js
│       ├── evaluate-search-performance.js
│       ├── evaluate-context-efficiency.js
│       ├── seed-test-data.mjs        # 种子数据生成脚本
│       └── queries.json              # 搜索评估查询集
└── reports/                          # 评估报告输出目录
└── integration/                       # Atom 架构集成
    ├── README.md
    ├── DESIGN-INTEGRATION.md          # 集成方案设计（升级自 INTEGRATION-PLAN）
    ├── IMPLEMENTATION-INTEGRATION.md  # 集成实施手册
    └── test-plans/                    # 测试计划
        ├── unit-test-plan.md
        ├── integration-test-plan.md
        └── e2e-test-plan.md
```

---

## 文档分类

| 类别         | 问题             | 受众               | 示例                                        |
| ------------ | ---------------- | ------------------ | ------------------------------------------- |
| **架构设计** | 系统如何构建？   | 架构师、核心开发者 | `architecture/ATOM-ARCHITECTURE.md`         |
| **效果评估** | 系统效果如何？   | 产品经理、QA       | `evaluation/DESIGN-EVALUATION.md`           |
| **集成方案** | 功能如何接入？   | 全栈开发者         | `integration/DESIGN-INTEGRATION.md`         |
| **实施手册** | 具体如何执行？   | 实施工程师         | `integration/IMPLEMENTATION-INTEGRATION.md` |
| **测试计划** | 如何验证正确性？ | QA、开发者         | `integration/test-plans/*.md`               |
| **评估脚本** | 如何量化测量？   | 数据分析师         | `evaluation/scripts/*.js`                   |

---

## 版本状态

### Phase 1: 工具层修复 ✅ 已完成

- `memory_write` 暴露 atoms 参数
- `entity_update` / `entity_atoms` 工具注册
- `memory_search` 支持 Atom 粒度搜索
- `syncMemoryToBackend` atoms 同步修复

### Phase 2: Prompt 工程 ✅ 已完成 (Prompt 注入完成，Agent 行为待验证)

- SOUL.md Atom 认知注入 ✅
- AGENTS.md 操作规范定义 ✅
- TOOLS.md 工具使用说明 ✅

### Phase 3: 工作流改造 ✅ 已完成

- The Observer 自动萃取 Atom 树 ✅
- The Librarian 按 Atom 粒度整合 ✅
- 代码分析关联对话 ✅ (Task 3.3 `linkToConversationMemory`)

### Bug Fixes (2026-05-02)

| Bug   | 修复内容                                                       | 文件                            |
| ----- | -------------------------------------------------------------- | ------------------------------- |
| B1 🔴 | `syncFull()` 未传递 atoms 字段 — 全量同步 Atom 数据丢失        | `lib/wrapper-client.js:558`     |
| B2 🟡 | `search()` 路由到统一端点 `/api/v1/search`（scope/atom_types） | `lib/wrapper-client.js:284-332` |
| B2 🟡 | `formatSearchResults()` 兼容统一端点 `entity_type` 字段        | `tools/search.js:139-166`       |

### CLI v3.3.0 Atom 支持

CLI 已升级至 v3.3.0，新增 6 项 Atom 功能：

| 命令                                                   | 说明                 |
| ------------------------------------------------------ | -------------------- |
| `write --atoms '<json>'`                               | 写入带 Atom 树的记忆 |
| `entity-update --entry-id <id> --atoms-batch '<json>'` | 批量 Atom 操作       |
| `entity-atoms --entry-id <id> [--no-content]`          | 查看 Atom 树         |
| `search --scope atom --atom-types "function,class"`    | Atom 粒度搜索        |
| `load-context-budget --entry-id <id> --query <text>`   | Token 预算加载       |
| `load-context-level --entry-id <id> --max-level 2`     | 层级过滤加载         |

### 测试与质量 (2026-05-02)

| 维度          | 数量                         | 状态    |
| ------------- | ---------------------------- | ------- |
| 测试套件      | 55                           | ✅ 全绿 |
| 测试用例      | 779                          | ✅ 全绿 |
| Atom 专项测试 | 15 个文件, ~220 用例         | ✅      |
| Agent 测试    | 53 用例 (frontmatter schema) | ✅ 新增 |
| 搜索测试      | 10 用例 (scope:atom)         | ✅ 新增 |

**Bug 修复验证**：B1 (syncFull atoms) + B2 (unified search) 已通过 779 测试用例验证。

**评估脚本种子数据**：

- 种子 Entity: "JavaScript 异步编程完全指南" (15 个 Atom, 3 层结构)
- 搜索查询集: `queries.json` (7 条评测查询)
- 生成脚本: `seed-test-data.mjs` (可重复运行)

---

## 与历史文档的关系

| 旧文档（根目录）                    | 新位置                                   | 状态      |
| ----------------------------------- | ---------------------------------------- | --------- |
| `v3.3-ATOM-ARCHITECTURE-DESIGN.md`  | `v3.3/architecture/ATOM-ARCHITECTURE.md` | 已移入    |
| `MEMORY-PLUGIN-EVALUATION-PLAN.md`  | `v3.3/evaluation/DESIGN-EVALUATION.md`   | 已移入 ✅ |
| `OPENCODE-ATOM-INTEGRATION-PLAN.md` | `v3.3/integration/DESIGN-INTEGRATION.md` | 已移入 ✅ |

---

## 快速导航

- **想了解 Atom 架构设计？** → `architecture/ATOM-ARCHITECTURE.md`
- **想评估系统效果？** → `evaluation/DESIGN-EVALUATION.md`
- **想接入 Atom 功能？** → `integration/DESIGN-INTEGRATION.md`
- **想执行具体任务？** → `integration/IMPLEMENTATION-INTEGRATION.md`
- **智能体操作指南？** → `AGENTS.md`

---

**维护者**: OpenCode Agent  
**最后更新**: 2026-05-02
