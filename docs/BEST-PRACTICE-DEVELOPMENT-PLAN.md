# 最佳实践开发方案：OPENCODE + OMO + SUPERPOWERS + OPENSPEC

**版本**: v1.1 (已修复)  
**日期**: 2026-04-29  
**状态**: 已评审，待执行  
**目标**: 让 OpenCode 内化 Atom Architecture

---

## 执行摘要

### 方案选择

采用 **OPENCODE + OMO + SUPERPOWERS + OPENSPEC 四合一深度集成**，这是经过评审和修复的最佳方案。

### 核心修复（相比 v1.0）

| 问题 | 修复措施 |
|------|----------|
| 智能体调用方式不明确 | 明确使用 `task()` 工具调用 subagent |
| 缺少渐进式策略 | 分 6 个 Phase 执行，每 Phase 有明确依赖 |
| 验证环节不够具体 | 每个任务必须运行测试 + lint + 功能验证 |
| 缺少失败回退 | 定义 3 级回退策略 |
| 时间估算过于乐观 | 调整为 2-3 天（更务实） |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│              四合一深度集成架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Phase 1: OPENSPEC 提案 (同步)                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  /opsx-propose "让 OpenCode 内化 Atom Architecture"  │  │
│   │  输出: proposal.md + design.md + spec.md + tasks.md │  │
│   └─────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│   Phase 2: 探索阶段 (并行 2-3 个 explore)                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  task(subagent_type="explore", ...) × 3             │  │
│   │  探索: tools/core.js, plugin.js, agents/            │  │
│   └─────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│   Phase 3: 规划阶段 (Prometheus)                            │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  task(subagent_type="oracle", load_skills=[...])    │  │
│   │  输出: 详细执行计划 + 依赖图 + 风险识别              │  │
│   └─────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│   Phase 4: 执行阶段 (分波次并行)                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  Wave 1: 工具层修复 (5 个任务并行)                   │  │
│   │  Wave 2: Prompt 工程 (3 个任务并行)                  │  │
│   │  Wave 3: 工作流改造 (2 个任务串行)                   │  │
│   └─────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│   Phase 5: 验证阶段 (Metis + Momus)                         │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  task(subagent_type="metis") - 代码审查              │  │
│   │  task(subagent_type="momus") - 质量检查              │  │
│   │  skill("verification-before-completion")            │  │
│   └─────────────────────────────────────────────────────┘  │
│                          │                                  │
│                          ▼                                  │
│   Phase 6: OPENSPEC 归档                                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │  /opsx-archive opencode-atom-integration            │  │
│   │  输出: 完整变更历史                                  │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 详细说明

### Phase 1: OPENSPEC 提案（同步，必须完成）

**命令**:
```bash
/opsx-propose "让 OpenCode 内化 Atom Architecture"
```

**输出**:
```
.opencode/changes/opencode-atom-integration/
├── proposal.md          # 变更提案（Why）
├── design.md            # 架构设计（How）
├── spec.md              # 功能规格（What）
├── tasks.md             # 任务列表（Tasks）
└── project-context.md   # 项目上下文
```

**成功标准**:
- [ ] 所有 5 个文件生成
- [ ] proposal.md 包含清晰的变更理由
- [ ] tasks.md 包含可执行的任务列表

**失败回退**:
- 如果生成失败，手动创建最小化 proposal.md
- 使用模板: `.opencode/templates/proposal.md`

---

### Phase 2: 探索阶段（并行 2-3 个 explore agent）

**并行任务**:

```javascript
// Task 2.1: 探索 tools/ 目录
task({
  subagent_type: "explore",
  prompt: "探索 opencode-memory-plugin/tools/ 目录，重点理解：\n" +
          "1. memory_write 工具当前实现\n" +
          "2. 如何添加 atoms 参数\n" +
          "3. 工具注册机制\n" +
          "输出: 详细分析报告 + 修改建议",
  run_in_background: true,
  load_skills: []
});

// Task 2.2: 探索 lib/ 目录
task({
  subagent_type: "explore",
  prompt: "探索 opencode-memory-plugin/lib/ 目录，重点理解：\n" +
          "1. memory-core.js 的 writeMemory 函数\n" +
          "2. syncMemoryToBackend 同步逻辑\n" +
          "3. updateEntity / getEntityAtoms 函数\n" +
          "输出: API 使用文档 + 调用示例",
  run_in_background: true,
  load_skills: []
});

// Task 2.3: 探索 agents/ 目录
task({
  subagent_type: "explore",
  prompt: "探索 opencode-memory-plugin/agents/ 目录，重点理解：\n" +
          "1. memory-automation.md (The Observer)\n" +
          "2. memory-consolidate.md (The Librarian)\n" +
          "3. 如何注入 Atom 架构认知\n" +
          "输出: Agent 改造方案",
  run_in_background: true,
  load_skills: []
});
```

**成功标准**:
- [ ] 3 个探索任务全部完成
- [ ] 每个任务输出详细报告
- [ ] 识别所有技术依赖

**失败回退**:
- 如果某个探索任务失败，由我（Sisyphus）手动补充探索

---

### Phase 3: 规划阶段（Prometheus + writing-plans）

**命令**:
```javascript
task({
  subagent_type: "oracle",
  prompt: "基于 Phase 2 的探索结果，创建详细执行计划：\n" +
          "1. 读取 OPENSPEC 产物 (proposal.md, tasks.md)\n" +
          "2. 读取探索报告\n" +
          "3. 分解任务为可执行单元\n" +
          "4. 识别依赖关系\n" +
          "5. 输出: 详细执行计划 + 依赖图",
  run_in_background: false,  // 同步，必须完成
  load_skills: ["writing-plans"]
});
```

**输出**:
```markdown
## 执行计划

### Wave 1: 工具层修复（并行）
- [ ] Task 1.1: 修复 memory_write 暴露 atoms 参数
- [ ] Task 1.2: 修复 syncMemoryToBackend 同步 atoms
- [ ] Task 1.3: 新增 entity_update 工具
- [ ] Task 1.4: 新增 entity_atoms 工具
- [ ] Task 1.5: 扩展 memory_search 支持 Atom 粒度

### Wave 2: Prompt 工程（并行）
- [ ] Task 2.1: 更新 SOUL.md 注入 Atom 认知
- [ ] Task 2.2: 更新 AGENTS.md 定义操作规范
- [ ] Task 2.3: 更新 TOOLS.md 说明 Atom 工具使用

### Wave 3: 工作流改造（串行）
- [ ] Task 3.1: 改造 The Observer 自动萃取 Atom
  - 依赖: Task 2.1, Task 2.2
- [ ] Task 3.2: 改造 The Librarian 按 Atom 粒度整合
  - 依赖: Task 2.1, Task 2.2

### 依赖图
```
Task 1.x (并行) ──┐
Task 2.x (并行) ──┼──► Task 3.x (串行)
                  │
Phase 2 探索 ─────┘
```
```

**成功标准**:
- [ ] 所有任务有明确输入/输出
- [ ] 依赖关系清晰
- [ ] 每个任务有验证标准

---

### Phase 4: 执行阶段（分波次并行）

#### Wave 1: 工具层修复（5 个任务并行）

```javascript
// 并行启动 5 个 Atlas 实例
task({
  subagent_type: "OpenCode-Builder",
  prompt: "执行任务: 修复 memory_write 暴露 atoms 参数\n" +
          "文件: tools/core.js\n" +
          "要求:\n" +
          "1. 在 args 中添加 atoms 参数\n" +
          "2. 修改 execute 函数传递 atoms\n" +
          "3. 运行测试: npm test\n" +
          "4. 运行 lint: npm run lint",
  run_in_background: true,
  load_skills: ["test-driven-development"]
});

// Task 1.2 - 1.5 类似...
```

**验证清单（每个任务必须）**:
```bash
# 1. 功能测试
npm test

# 2. 代码规范
npm run lint

# 3. 功能验证（实际调用）
node -e "
const { memory_write } = require('./tools/core.js');
memory_write({
  abstract: 'Test',
  overview: 'Test overview',
  content: 'Test content',
  atoms: [{ local_id: '01TEST', type: 'chapter', name: 'Test' }]
}).then(r => console.log('Success:', r));
"
```

#### Wave 2: Prompt 工程（3 个任务并行）

类似 Wave 1，并行更新 3 个文档。

#### Wave 3: 工作流改造（2 个任务串行）

```javascript
// Task 3.1: 改造 The Observer
task({
  subagent_type: "OpenCode-Builder",
  prompt: "改造 agents/memory-automation.md\n" +
          "要求:\n" +
          "1. 添加 Atom 萃取逻辑\n" +
          "2. 更新 workflow 章节\n" +
          "3. 添加 Atom 结构示例",
  run_in_background: false,  // 同步
  load_skills: ["writing-skills"]
});

// Task 3.2: 改造 The Librarian（依赖 3.1）
// 等待 3.1 完成后再启动
```

**失败回退策略**:
- **Level 1**: 单个任务失败 → 重试 1 次
- **Level 2**: 同 Wave 失败 > 50% → 转为串行执行
- **Level 3**: 测试持续失败 → 停止并人工介入

---

### Phase 5: 验证阶段（Metis + Momus）

```javascript
// Task 5.1: 代码审查
task({
  subagent_type: "metis",
  prompt: "审查 Phase 4 的所有修改：\n" +
          "1. 读取修改的文件列表\n" +
          "2. 检查代码质量\n" +
          "3. 检查是否符合项目规范\n" +
          "输出: 审查报告 + 修复建议",
  run_in_background: true,
  load_skills: ["code-reviewer"]
});

// Task 5.2: 质量检查
task({
  subagent_type: "momus",
  prompt: "质量检查：\n" +
          "1. 运行完整测试套件\n" +
          "2. 检查测试覆盖率\n" +
          "3. 验证功能完整性\n" +
          "输出: 质量报告",
  run_in_background: true,
  load_skills: ["verification-before-completion"]
});
```

**验证标准**:
- [ ] 所有测试通过
- [ ] 代码审查无严重问题
- [ ] 功能验证通过
- [ ] 文档完整

---

### Phase 6: OPENSPEC 归档

**命令**:
```bash
/opsx-archive opencode-atom-integration
```

**输出**:
```
.opencode/changes/opencode-atom-integration/
├── proposal.md
├── design.md
├── spec.md
├── tasks.md
├── execution-log.md      # 新增: 执行日志
├── review-report.md      # 新增: 审查报告
└── status: archived      # 状态更新
```

---

## 关键成功因素

### 1. 强制使用技能

每个 Phase 必须调用相关 SUPERPOWERS 技能：

| Phase | 必需技能 |
|-------|----------|
| Phase 2 | 无（探索阶段） |
| Phase 3 | `writing-plans` |
| Phase 4 | `test-driven-development`, `subagent-driven-development` |
| Phase 5 | `code-reviewer`, `verification-before-completion` |

### 2. 验证门禁

每个任务必须通过 3 道门禁：

```
代码提交
    │
    ▼
┌─────────────┐
│ 1. 测试通过  │ ◄── npm test
│    (Jest)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 2. 规范检查  │ ◄── npm run lint
│   (Oxlint)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 3. 功能验证  │ ◄── 实际调用工具
│  (手动/自动) │
└──────┬──────┘
       │
       ▼
   任务完成
```

### 3. 并行最大化

识别可并行任务：

```
Wave 1 (5 个并行):
├── Task 1.1: memory_write 修复
├── Task 1.2: syncMemoryToBackend 修复
├── Task 1.3: entity_update 工具
├── Task 1.4: entity_atoms 工具
└── Task 1.5: memory_search 扩展

Wave 2 (3 个并行):
├── Task 2.1: 更新 SOUL.md
├── Task 2.2: 更新 AGENTS.md
└── Task 2.3: 更新 TOOLS.md

Wave 3 (2 个串行):
├── Task 3.1: 改造 The Observer
└── Task 3.2: 改造 The Librarian (依赖 3.1)
```

---

## 时间估算

| Phase | 任务数 | 并行度 | 预估时间 |
|-------|--------|--------|----------|
| Phase 1 | 1 | 1 | 10 分钟 |
| Phase 2 | 3 | 3 | 20 分钟 |
| Phase 3 | 1 | 1 | 30 分钟 |
| Phase 4 Wave 1 | 5 | 5 | 1 小时 |
| Phase 4 Wave 2 | 3 | 3 | 40 分钟 |
| Phase 4 Wave 3 | 2 | 1 | 1 小时 |
| Phase 5 | 2 | 2 | 30 分钟 |
| Phase 6 | 1 | 1 | 5 分钟 |
| **总计** | **18** | - | **~4 小时** |

**实际预期**: 2-3 天（考虑等待、重试、审查）

---

## 失败回退策略

### Level 1: 任务级重试
- 单个任务失败 → 自动重试 1 次
- 重试仍失败 → 标记为阻塞，通知 Sisyphus

### Level 2: Wave 级降级
- 同 Wave 失败 > 50% → 转为串行执行
- 串行仍失败 → 进入 Level 3

### Level 3: 项目级暂停
- 测试持续失败 > 3 次 → 停止执行
- 人工介入分析根本原因
- 修复后从失败点恢复

---

## 预期效果

### 定量指标

| 指标 | 目标 |
|------|------|
| 完成时间 | 2-3 天 |
| 测试通过率 | 100% |
| 代码审查通过率 | > 90% |
| 并行任务占比 | > 70% |

### 定性指标

- [ ] OpenCode 可以创建带 Atom 树的记忆
- [ ] Agent 主动使用层级化知识组织
- [ ] 代码分析与对话记忆统一在 Atom 架构下
- [ ] 完整变更历史可追溯

---

## 立即开始

### 选项 A: 全自动执行（推荐）

```bash
# Step 1: 创建 OPENSPEC 变更
/opsx-propose "让 OpenCode 内化 Atom Architecture"

# Step 2: 启动 OMO 多智能体调度
# （自动执行 Phase 2-6）

# Step 3: 归档
/opsx-archive opencode-atom-integration
```

### 选项 B: 分步执行（更可控）

逐个 Phase 执行，每完成一个检查后再继续：

```bash
# 先执行 Phase 1
/opsx-propose "..."

# 确认产物正确后，执行 Phase 2
task(subagent_type="explore", ...) × 3

# 依此类推...
```

---

## 附录

### A. 工具映射

| 功能 | OpenCode 工具 |
|------|--------------|
| 调用 subagent | `task()` |
| 调用技能 | `skill()` |
| OPENSPEC 命令 | `/opsx-propose`, `/opsx-apply`, `/opsx-archive` |
| 代码编辑 | `read()`, `write()`, `edit()` |
| 代码搜索 | `grep()`, `ast_grep_search()` |
| 执行命令 | `bash()` |

### B. 相关文档

- `docs/OPENCODE-ATOM-INTEGRATION-PLAN.md` - 技术实现方案
- `docs/MEMORY-PLUGIN-EVALUATION-PLAN.md` - 效果评估方案
- `AGENTS.md` - 项目开发指南

### C. 变更历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-29 | 初始方案 |
| v1.1 | 2026-04-29 | 修复智能体调用方式、添加失败回退、调整时间估算 |

---

**下一步**: 选择选项 A 或 B，开始执行 Phase 1。
