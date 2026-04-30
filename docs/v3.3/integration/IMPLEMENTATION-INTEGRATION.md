---
status: draft
version: 1.0.0
last_updated: 2026-05-01
owner: Atlas
---

# Phase 2 & Phase 3 实施手册

**版本**: v1.0.0
**日期**: 2026-05-01
**前置文档**: [`DESIGN-INTEGRATION.md`](./DESIGN-INTEGRATION.md)

> 本文档为 Atlas（执行者智能体）提供可操作的逐步实施指南。
> Phase 1（工具层修复）已完成，本文档覆盖 Phase 2（Prompt 工程）和 Phase 3（工作流改造）。

---

## 目录

- [一、Phase 2: Prompt 工程实施](#一phase-2-prompt-工程实施)
  - [Task 2.1: SOUL.md 更新](#task-21-soulmd-更新)
  - [Task 2.2: AGENTS.md 更新](#task-22-agentsmd-更新)
  - [Task 2.3: TOOLS.md 更新](#task-23-toolsmd-更新)
  - [Phase 2 验证清单](#phase-2-验证清单)
  - [Phase 2 回滚策略](#phase-2-回滚策略)
- [二、Phase 3: 工作流改造实施](#二phase-3-工作流改造实施)
  - [Task 3.1: The Observer 自动萃取 Atom](#task-31-the-observer-自动萃取-atom)
  - [Task 3.2: The Librarian 按 Atom 粒度整合](#task-32-the-librarian-按-atom-粒度整合)
  - [Task 3.3: 代码分析关联](#task-33-代码分析关联)
  - [Task 3.4: Atom 级上下文管理](#task-34-atom-级上下文管理)
- [三、执行日程](#三执行日程)
- [四、代码模板](#四代码模板)
- [五、验收清单](#五验收清单)

---

## 一、Phase 2: Prompt 工程实施

**目标**: 将 Atom Architecture 认知注入到 OpenCode system prompt，让 Agent 理解并使用 Atom 概念。

**涉及文件**（均在 `~/.opencode/memory/` 下）:

| 文件 | 注入内容 | 状态 |
|------|----------|------|
| `SOUL.md` | Atom Architecture 认知 | ✅ 已完成 |
| `AGENTS.md` | Atom 操作规范 | ✅ 已完成 |
| `TOOLS.md` | Atom 工具使用说明 | ✅ 已完成 |

> **注**: Phase 2 已全部完成。以下为已完成内容的详细记录，供审计和回滚参考。

---

### Task 2.1: SOUL.md 更新

**文件**: `~/.opencode/memory/SOUL.md`

**注入位置**: 在 "## 核心身份" 之后、"## 语调和风格" 之前插入新章节。

**注入内容**:

```markdown
## Atom Architecture 认知 (v3.3)

### 什么是 Atom Architecture？

传统记忆是"一大坨"文本，而 Atom Architecture 将知识组织为**层级化的原子节点**：

- **Entity**: 知识容器（如"Vue3 最佳实践"）
- **Atom**: 原子节点（如"setup() 函数"、"ref() 响应式"）
- **层级**: parent_id + children 形成树结构
- **链接**: [[local_id]] 实现精准引用

### 为什么使用 Atom？

1. **精准引用**: 用 [[01ATOM001]] 引用特定知识点，而非加载整篇文档
2. **层级组织**: chapter → section → detail，逻辑清晰
3. **灵活重组**: 通过 parent_id 重新组织知识结构
4. **高效检索**: 搜索返回 Atom 粒度，减少 token 浪费

### 何时创建 Atom 树？

**应该创建 Atom 树的情况**:
- 代码分析结果（函数、类、导入）
- 技术文档（章节、小节、要点）
- 复杂对话（主题 → 要点 → 细节）
- 项目知识（模块 → 组件 → 函数）

**可以扁平存储的情况**:
- 简单笔记（<500 字）
- 临时想法
- 单条日志

### Atom 结构示例

```json
[
  {
    "local_id": "01CHAP001",
    "type": "chapter",
    "name": "第1章：Composition API",
    "content": "章节概述...",
    "order": "a0",
    "heading_level": 1,
    "parent_id": null,
    "children": [
      {
        "local_id": "01SEC001",
        "type": "section",
        "name": "1.1 setup() 函数",
        "content": "详细说明...",
        "order": "a0",
        "heading_level": 2,
        "parent_id": "01CHAP001",
        "children": []
      }
    ]
  }
]
```

### 使用 [[local_id]] 链接

在内容中引用其他 Atom：

- `详见 [[01SEC001]] 的说明`
- `参考 [[01CHAP001|Composition API 章节]]`

系统会自动解析这些链接并建立关系图谱。

### 最佳实践

1. **分层原则**: 不要超过 4 层（Entity → Chapter → Section → Detail）
2. **粒度控制**: 每个 Atom 内容 200-500 字为宜
3. **命名规范**: Atom name 使用标题式（"setup() 函数"）
4. **链接丰富**: 相关内容用 [[local_id]] 互相链接
5. **定期整理**: 使用 @memory-consolidate 整合碎片

```

预期输出: 匹配到 "## Atom Architecture 认知 (v3.3)" 标题。

---

### Task 2.2: AGENTS.md 更新

**文件**: `~/.opencode/memory/AGENTS.md`

**注入位置**: 在 "## 代码规范" 之前插入 Atom 操作规范章节。

**注入内容**:

```markdown
## Atom 操作规范

### 创建 Atom 树的决策流程

开始
  ↓
内容是否 > 1000 字或有明确层级？
  ↓ 是
构建 Atom 树结构
  ↓
• 识别顶层章节 (type: chapter, heading_level: 1)
• 识别小节 (type: section, heading_level: 2)
• 识别细节 (type: note, heading_level: 3)
  ↓
为每个 Atom 生成 local_id (ULID)
  ↓
设置 parent_id 和 children
  ↓
调用 memory_write({atoms})
  ↓
结束

### Atom 类型指南

| 类型 | 用途 | heading_level |
|------|------|---------------|
| chapter | 顶层章节 | 1 |
| section | 小节 | 2 |
| function | 函数说明 | 2-3 |
| class | 类说明 | 2-3 |
| note | 笔记/要点 | 3-4 |
| task | 任务项 | 任意 |
| goal | 目标 | 1-2 |

### 自动萃取 Atom 的启发式规则

**代码分析结果**:

- 每个函数 → 一个 Atom (type: function)
- 每个类 → 一个 Atom (type: class)
- 函数调用关系 → [[local_id]] 链接

**技术文档**:

- 标题 (H1) → chapter
- 子标题 (H2) → section
- 代码块 → note (type: code)
- 列表项 → note

**对话记录**:

- 主题 → Entity abstract
- 关键决策 → chapter
- 讨论要点 → section
- 具体细节 → note

### 使用 [[atom_id]] 链接

在内容中引用其他 Atom：

- `详见 [[01SEC001]] 的说明`
- `参考 [[01CHAP001|Composition API 章节]]`

系统会自动解析这些链接并建立关系图谱。
```

**验证方法**:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Select-String -Path "$env:USERPROFILE\.opencode\memory\AGENTS.md" -Pattern "Atom 操作规范"
```

---

### Task 2.3: TOOLS.md 更新

**文件**: `~/.opencode/memory/TOOLS.md`

**注入位置**: 在 "## 渐进加载使用指南" 之前插入 Atom 相关工具章节。

**注入内容**:

```markdown
## Atom 相关工具 (v3.3)

### memory_write with atoms

创建带 Atom 树结构的记忆：

```javascript
memory_write({
  abstract: "Vue3 Composition API 指南",
  overview: "涵盖 setup、ref、reactive 等核心概念",
  content: "完整内容...",
  type: "memory",
  tags: ["vue", "javascript"],
  atoms: [
    {
      local_id: "01CHAP001",
      type: "chapter",
      name: "第1章：setup() 函数",
      content: "setup 是 Composition API 的入口...",
      order: "a0",
      heading_level: 1,
      parent_id: null,
      children: [
        {
          local_id: "01SEC001",
          type: "section",
          name: "1.1 基本用法",
          content: "在组件中定义 setup 函数...",
          order: "a0",
          heading_level: 2,
          parent_id: "01CHAP001",
          children: []
        }
      ]
    }
  ]
});
```

### entity_update

批量更新 Atom：

```javascript
entity_update({
  entry_id: "01HQ...",
  atoms_batch: [
    { action: "add", local_id: "01NEW", type: "section", name: "新增小节", ... },
    { action: "update", local_id: "01EXIST", content: "更新后的内容" },
    { action: "remove", local_id: "01DELETE", cascade: true }
  ]
});
```

### entity_atoms

获取 Atom 树：

```javascript
entity_atoms({
  entry_id: "01HQ...",
  include_content: true  // 是否包含完整内容
});
// 返回树形结构，可用于导航或展示
```

### memory_search with atom scope

Atom 粒度搜索：

```javascript
memory_search({
  query: "setup function",
  scope: "atom",           // 只搜索 Atom
  atom_types: ["function", "section"],
  limit: 10
});
// 返回 Atom 级别结果，而非整个 Entity
```

**验证方法**:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Select-String -Path "$env:USERPROFILE\.opencode\memory\TOOLS.md" -Pattern "Atom 相关工具"
```

---

### Phase 2 验证清单

- [ ] SOUL.md 包含 "Atom Architecture 认知 (v3.3)" 章节
- [ ] AGENTS.md 包含 "Atom 操作规范" 章节（含决策流程图）
- [ ] TOOLS.md 包含 "Atom 相关工具 (v3.3)" 章节（含 4 个工具示例）
- [ ] 三个文件中的 Atom 示例结构一致（local_id 使用 ULID 格式）
- [ ] 三个文件均包含 `[[local_id]]` 链接使用说明
- [ ] 无重复内容（SOUL 讲"是什么"，AGENTS 讲"怎么做"，TOOLS 讲"工具参数"）

### Phase 2 回滚策略

所有注入内容使用独立章节标题，回滚时删除对应章节即可：

```powershell
# 回滚 SOUL.md: 删除 "## Atom Architecture 认知 (v3.3)" 到下一个 ## 之间的所有内容
# 回滚 AGENTS.md: 删除 "## Atom 操作规范" 到下一个 ## 之间的所有内容
# 回滚 TOOLS.md: 删除 "## Atom 相关工具 (v3.3)" 到下一个 ## 之间的所有内容
```

**备份建议**: 修改前先备份三个文件：

```powershell
Copy-Item "$env:USERPROFILE\.opencode\memory\SOUL.md" "$env:USERPROFILE\.opencode\memory\SOUL.md.bak"
Copy-Item "$env:USERPROFILE\.opencode\memory\AGENTS.md" "$env:USERPROFILE\.opencode\memory\AGENTS.md.bak"
Copy-Item "$env:USERPROFILE\.opencode\memory\TOOLS.md" "$env:USERPROFILE\.opencode\memory\TOOLS.md.bak"
```

---

## 二、Phase 3: 工作流改造实施

**目标**: 改造 Agent 工作流，让 The Observer 自动萃取 Atom 树，让 The Librarian 按 Atom 粒度整合碎片。

**当前状态**: ⏳ 待实施

---

### Task 3.1: The Observer 自动萃取 Atom

**文件**: `opencode-memory-plugin/agents/memory-automation.md`

**当前状态**: ✅ 已完成 — Observer 已支持三类输出（扁平 / 隐式发现 / Atom 树），包含完整的启发式规则和场景示例。

**已完成内容**（审计记录）:

1. **description 更新**: 前置声明了 "flat entries or Atom tree structures"
2. **三类输出格式**: 第一类（扁平）、第二类（隐式发现）、第三类（Atom 树）
3. **Atom 树启发式规则**: 6 条判定规则（内容长度、Markdown 标题、结构化列表、代码块、多主题、代码分析）
4. **Atom 类型选择指南**: 7 种对话内容类型对应的 Atom 类型和 heading_level
5. **Atom 树构建规则**: 7 条规则（local_id 格式、层级深度、parent_id、children、content 长度、引用链接、order）
6. **场景示例**: 3 个场景（应使用 Atom 树 / 应使用扁平 / 边界情况）

**测试场景**:

| # | 场景 | 输入 | 预期输出 | 验证方法 |
|---|------|------|----------|----------|
| T3.1.1 | 代码讨论（3 个函数） | 对话中讨论了 `auth` 模块的 `verifyToken()`、`refreshSession()` 和 `logout()` | Atom 树：1 chapter + 3 function atoms | Tab 切换到 Observer，观察输出格式 |
| T3.1.2 | 简单偏好 | "以后都用 pnpm" | 扁平存储 | Tab 切换到 Observer，确认无 Atom 树 |
| T3.1.3 | 边界（2 个相关主题 < 500 字） | 讨论了 Bun 和 better-sqlite3 | 扁平存储 | Tab 切换到 Observer，确认降级 |
| T3.1.4 | 大型文档讨论（> 1000 字，3 个章节） | 讨论了 Vue3 Composition API 的 3 个子主题 | Atom 树：1 chapter + 3 section + notes | Tab 切换到 Observer，检查树结构 |
| T3.1.5 | 用户编辑 Atom 节点 | "Edit 01KQEDZ3S3WM4E8CKESJ6WWKPK" | Observer 修改指定节点内容并重新展示 | Tab 切换，执行编辑命令 |
| T3.1.6 | 用户降级 Atom 树 | "Flatten T1" | Observer 将 Atom 树转为扁平存储 | Tab 切换，执行降级命令 |

**验收标准**:

- [ ] 代码片段（3+ 函数）触发 Atom 树输出
- [ ] 多主题对话（3+ 子主题）触发 Atom 树输出
- [ ] 简单偏好（< 500 字）使用扁平存储
- [ ] 边界情况正确降级
- [ ] 用户确认流程（Save/Edit/Remove/Flatten/Discard）不受影响
- [ ] Atom 树中每个节点有正确的 local_id、type、parent_id、heading_level
- [ ] Atom 树层级不超过 4 层

**回滚策略**: Observer 的第三类输出是增量添加的，不影响第一类和第二类。如需回滚，删除 "### 第三类：Atom 树候选" 章节及以下所有 Atom 相关内容即可。Observer 会退化为仅支持扁平存储。

---

### Task 3.2: The Librarian 按 Atom 粒度整合

**文件**: `opencode-memory-plugin/agents/memory-consolidate.md`

**当前状态**: ✅ 已完成 — Librarian 已支持两种整合模式（Atom Tree / Flat），包含完整的 S.O.P. 和示例。

**已完成内容**（审计记录）:

1. **两种整合模式**: Atom Tree Consolidation（首选）和 Flat Consolidation（降级）
2. **复杂度评估规则**: 5 条 Atom Tree 判定规则 / 4 条 Flat 判定规则
3. **Atom Tree 构建流程**: 5 步（识别知识域 → 设计树结构 → 分配内容 → 生成 Atom ID → 添加交叉引用）
4. **图谱织网**: Entity 级关系 + 跨主题关系
5. **源碎片标记**: 使用 `entity_update` 添加 `meta.consolidated` 标记
6. **完整示例**: 4 个示例（碎片识别 / 知识树构建 / 关系建立 / Flat 整合）
7. **决策快速参考**: 文本决策树

**测试场景**:

| # | 场景 | 输入 | 预期输出 | 验证方法 |
|---|------|------|----------|----------|
| T3.2.1 | 5 条 Docker 碎片 | `memory_timeline` 返回 5 条 Docker 相关碎片 | Atom 树整合：3 chapter + 5 section | `@memory-consolidate` 触发 |
| T3.2.2 | 2 条简单碎片 | 2 条关于 var/let 的碎片 | Flat 整合 | `@memory-consolidate` 触发 |
| T3.2.3 | 已整合碎片 | `meta.consolidated: true` | 跳过，不重复整合 | 多次触发，检查是否重复 |
| T3.2.4 | 关系建立 | 整合完成后 | 5 条 summarizes 关系 + 跨主题关系 | `memory_graph` 查询 |
| T3.2.5 | 源碎片标记 | 整合完成后 | 所有源碎片有 `meta.consolidated` | `memory_read` 检查 |
| T3.2.6 | 置顶 | 关键约定 | 整合节点被置顶 | `memory_timeline` 检查 pinned |

**验收标准**:

- [ ] 3+ 相关碎片触发 Atom Tree 整合
- [ ] 1-2 碎片使用 Flat 整合
- [ ] 整合 Entity 包含完整 Atom 树（local_id、parent_id、children 正确）
- [ ] 源碎片通过 `entity_update` 标记为已整合
- [ ] `memory_relate(relation_type="summarizes")` 关系正确建立
- [ ] 整合节点被 `memory_pin` 置顶（仅关键约定）
- [ ] `incremental_sync` 静默执行
- [ ] 已整合碎片不被重复处理

**回滚策略**: Atom Tree 整合是 Flat 整合的超集。如需回滚，删除 Step 3A 和相关示例，保留 Step 3B（Flat Consolidation）。Librarian 会退化为仅支持扁平整合。

---

### Task 3.3: 代码分析关联

**文件**: `opencode-memory-plugin/lib/code-analysis-service.js`

**状态**: ⏳ 待实施（标记为 `// TODO: Experimental`）

**设计文档参考**: `DESIGN-INTEGRATION.md` 任务 3.3（代码分析结果关联到对话记忆）

**实施步骤**:

#### 步骤 1：定义关联函数

在 `code-analysis-service.js` 中新增 `linkToConversationMemory` 方法：

```javascript
async linkToConversationMemory(entityId, filePath) {
  try {
    const recentMemories = await this.wrapperClient.search({
      query: `code analysis ${path.basename(filePath)}`,
      limit: 5,
      level: 0,
    });

    if (recentMemories.results && recentMemories.results.length > 0) {
      for (const mem of recentMemories.results.slice(0, 3)) {
        await this.wrapperClient.relate({
          action: "create",
          from_id: mem.id,
          to_id: entityId,
          relation_type: "analyzes",
          weight: 0.8,
        });
      }
    }
  } catch (err) {
    this.logger.warn({
      msg: "Failed to link code analysis to conversation memory",
      entityId,
      filePath,
      error: err.message,
    });
  }
}
```

#### 步骤 2：在 `uploadAsAtomEntity()` 中调用

在 `uploadAsAtomEntity()` 成功返回后追加调用：

```javascript
// 现有代码：const result = await this.uploadAsAtomEntity(fileResult);
// 新增：
if (result && result.localId) {
  await this.linkToConversationMemory(result.localId, filePath).catch(() => {});
}
```

#### 步骤 3：添加配置开关

在 `memory-config.json` 中添加：

```json
{
  "codeAnalysis": {
    "autoLinkToConversation": true
  }
}
```

#### 集成点

| 集成点 | 文件 | 说明 |
|--------|------|------|
| 调用入口 | `code-analysis-service.js` `uploadAsAtomEntity()` | 分析完成后自动关联 |
| 搜索 API | `wrapper-client.js` `search()` | 查找最近相关对话记忆 |
| 关系 API | `wrapper-client.js` `relate()` | 创建 `analyzes` 关系 |
| 配置 | `memory-config.json` | `codeAnalysis.autoLinkToConversation` 开关 |

**测试场景**:

| # | 场景 | 预期 | 验证 |
|---|------|------|------|
| T3.3.1 | 分析 JS 文件后检查关联 | `memory_graph` 能查到 `analyzes` 关系 | 分析 → `memory_graph(from=entity_id)` |
| T3.3.2 | 无对话记忆时分析 | 不报错，静默跳过 | 清空记忆后分析 |
| T3.3.3 | 关联失败 | 不影响代码分析主流程 | mock API 返回错误 |
| T3.3.4 | 配置关闭 | 不执行关联 | 设置 `autoLinkToConversation: false` |

**验收标准**:

- [ ] 代码分析 Entity 创建后自动关联到对话记忆
- [ ] 关联关系可通过 `memory_graph` 查询到
- [ ] 关联失败不影响代码分析主流程（仅 warn 日志）
- [ ] 可通过配置关闭此功能

**回滚策略**: 关联调用使用 `.catch(() => {})` 包装，失败不影响主流程。回滚时删除 `linkToConversationMemory` 方法和调用点即可。

---

### Task 3.4: Atom 级上下文管理

**文件**: `opencode-memory-plugin/tools/core.js`

**状态**: ✅ 已实现（作为工具暴露给 Agent）

**已实现工具**:

| 工具 | 位置 | 功能 |
|------|------|------|
| `load_context_budget` | `tools/core.js:292` | 按 token 预算加载最相关的 Atom |
| `load_context_level` | `tools/core.js:355` | 按层级过滤 Atom 内容 |

**需要验证的行为**:

Agent 在实际对话中是否使用这些工具替代 `memory_read` 加载长文档。

**验证步骤**:

1. 创建一个包含 3 层 Atom 树的长记忆条目
2. 在对话中触发 Agent 查询该记忆
3. 观察 Agent 是否调用 `load_context_level(max_level=1)` 而非 `memory_read`

**测试场景**:

| # | 场景 | 预期 | 验证 |
|---|------|------|------|
| T3.4.1 | 加载长文档（> 2000 字） | Agent 使用 `load_context_level` | 观察 Agent 工具调用 |
| T3.4.2 | token 预算限制 | `load_context_budget` 在预算内返回 | 检查返回内容长度 |
| T3.4.3 | 渐进加载 L0 → L1 → L2 | 先看 abstract，再按需加载 detail | 观察 Agent 多轮调用 |
| T3.4.4 | 无 Atom 的条目 | 降级为普通读取 | 创建无 Atom 条目，调用工具 |

**验收标准**:

- [ ] `load_context_level` 正确按层级过滤 Atom（heading_level 控制）
- [ ] `load_context_budget` 在 token 预算内返回最相关 Atom
- [ ] 无 Atom 条目时优雅降级
- [ ] 渐进加载（L0 → L1 → L2）工作正常

**回滚策略**: 工具已注册且向后兼容，不影响现有功能。如需回滚，从 `plugin.js` 中移除工具注册即可。

---

## 三、执行日程

### Phase 2 日程（3 天）

> Phase 2 已完成，以下为实际执行记录。

| 天 | 任务 | 产出 | 验证 |
|----|------|------|------|
| D1 | Task 2.1: 更新 SOUL.md | Atom Architecture 认知章节 | `Select-String "Atom Architecture" SOUL.md` |
| D2 | Task 2.2: 更新 AGENTS.md | Atom 操作规范章节 | `Select-String "Atom 操作规范" AGENTS.md` |
| D3 | Task 2.3: 更新 TOOLS.md + 验证 | Atom 工具示例 + 全量验证 | 三文件完整性检查 |

**里程碑**: Phase 2 完成 — Agent 理解 Atom 概念并能正确构建 Atom 树。

### Phase 3 日程（5 天）

| 天 | 任务 | 产出 | 检查点 |
|----|------|------|--------|
| D1 | Task 3.1: 审查 Observer 改造 | 确认已完成内容正确 | T3.1.1-T3.1.3 手动测试 |
| D2 | Task 3.2: 审查 Librarian 改造 | 确认已完成内容正确 | T3.2.1-T3.2.3 手动测试 |
| D3 | Task 3.3: 代码分析关联 | `linkToConversationMemory()` | T3.3.1-T3.3.4 单元测试 |
| D4 | Task 3.4: 上下文管理验证 | 验证 `load_context_*` 工具 | T3.4.1-T3.4.4 集成测试 |
| D5 | 全量验收 + 文档更新 | 验收报告 + 文档状态更新 | 完成验收清单 |

**里程碑**:

- **D2 结束**: Agent 工作流改造完成（Observer + Librarian）
- **D4 结束**: 所有 4 个 Task 实施完毕
- **D5 结束**: Phase 3 验收通过，更新 `DESIGN-INTEGRATION.md` 状态为 ✅

---

## 四、代码模板

### 模板 1: 修改 Agent Markdown 文件

```markdown
---
description: '[更新后的描述，说明是否支持 Atom]'
mode: primary | subagent
model: anthropic/claude-sonnet-4-20250514
tools:
  memory_write: true | false
  entity_update: true | false
  entity_atoms: true | false
  # ... 其他工具
---

[Agent 身份描述]

## 工作流

### Step N: [步骤名称]

[具体步骤描述]

**Atom 树构建**（如适用）:
- 识别顶层概念 → chapter (heading_level: 1)
- 识别子要点 → section (heading_level: 2)
- 识别细节 → note (heading_level: 3)
- 生成 ULID 格式的 local_id
- 设置 parent_id 和 children

**降级策略**: [描述 Atom 构建失败时的 fallback 行为]
```

### 模板 2: 添加新工具使用示例

```markdown
### [工具名称]

[一句话说明]

**适用场景**: [何时使用此工具]

**参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| param1 | string | 是 | [说明] |
| param2 | number | 否 | 默认值 |

**示例**:

```javascript
[工具名称]({
  param1: "value",
  param2: 10,
});
// 预期输出: [描述]
```

**注意事项**:

- [使用限制或注意事项]
- [与其他工具的关系]

### 模板 3: 测试用例

```javascript
describe('[功能名称]', () => {
  let client;
  let testEntryId;

  beforeAll(async () => {
    client = new WrapperClient({
      backend: { tenant_id: "default" },
    });
  });

  afterAll(async () => {
    // 清理测试数据
  });

  test('[测试场景描述]', async () => {
    // Arrange
    const input = { /* 测试输入 */ };

    // Act
    const result = await [被测函数](input);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  test('[边界情况描述]', async () => {
    // Arrange: 准备边界条件

    // Act
    const result = await [被测函数](boundaryInput);

    // Assert: 验证边界行为
    expect(result).not.toThrow();
  });
});
```

---

## 五、验收清单

### Phase 2 完成标准

| # | 检查项 | 通过标准 | 验证方法 |
|---|--------|----------|----------|
| P2.1 | SOUL.md Atom 认知 | 包含完整 Atom Architecture 章节 | 文件内容检查 |
| P2.2 | AGENTS.md 操作规范 | 包含决策流程图 + 类型指南 + 启发式规则 | 文件内容检查 |
| P2.3 | TOOLS.md 工具说明 | 包含 4 个 Atom 工具示例 | 文件内容检查 |
| P2.4 | 内容一致性 | 三个文件中的 Atom 结构定义一致 | 交叉对比 |
| P2.5 | 无重复 | SOUL/AGENTS/TOOLS 各有侧重，无重复段落 | 人工审查 |

### Phase 3 完成标准

| # | 检查项 | 通过标准 | 验证方法 |
|---|--------|----------|----------|
| P3.1 | Observer Atom 树萃取 | 结构化对话触发 Atom 树输出 | T3.1.1-T3.1.6 |
| P3.2 | Librarian Atom 整合 | 3+ 碎片触发 Atom Tree 整合 | T3.2.1-T3.2.6 |
| P3.3 | 代码分析关联 | Entity 创建后自动关联对话记忆 | T3.3.1-T3.3.4 |
| P3.4 | 上下文管理 | Agent 使用 `load_context_*` 加载长文档 | T3.4.1-T3.4.4 |
| P3.5 | 向后兼容 | 无 Atom 的旧记忆正常读取 | 读取 v3.2 格式记忆 |
| P3.6 | 降级策略 | Atom 构建失败不影响主流程 | mock 失败场景 |

### 集成测试场景

| # | 场景 | 步骤 | 预期结果 |
|---|------|------|----------|
| IT.1 | 端到端 Atom 创建 | 对话 → Observer 萃取 → 用户确认 → 主代理保存 → Librarian 整合 | Atom 树从创建到整合的完整链路 |
| IT.2 | 代码分析 → 记忆关联 | 保存文件 → 代码分析 → Atom Entity 创建 → 自动关联对话记忆 | 双向链接可查询 |
| IT.3 | 跨会话 Atom 查询 | 会话 A 创建 Atom 树 → 会话 B 使用 `load_context_level` 加载 | 按层级正确返回 |
| IT.4 | Atom 搜索 | 创建含 Atom 的 Entity → `memory_search(scope="atom")` | 返回 Atom 级别结果 |
| IT.5 | 碎片整合 + 关系 | 5 条碎片 → Librarian 整合 → `memory_graph` 查询 | 溯源关系完整 |

---

**维护者**: Atlas (执行者智能体)
**审核者**: Prometheus (规划者智能体)
**参考文档**: [`DESIGN-INTEGRATION.md`](./DESIGN-INTEGRATION.md) | [`ATOM-ARCHITECTURE.md`](../architecture/ATOM-ARCHITECTURE.md)
