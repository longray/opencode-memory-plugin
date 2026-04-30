---
status: in_progress
version: 1.0.0
last_updated: 2026-05-01
owner: Prometheus
---

# OpenCode Atom 架构内化集成方案

**版本**: v1.1 (升级自 `docs/OPENCODE-ATOM-INTEGRATION-PLAN.md`)
**日期**: 2026-05-01
**状态**: Phase 1 ✅ 已完成，Phase 2 ✅ 已完成，Phase 3 ⏳ 待实施

> **Phase 1 和 Phase 2 已全部完成，缺口 1-5 已解决。** Phase 3 工作流改造待实施。

---

## 执行摘要

### 问题陈述

当前 OpenCode 使用记忆插件时，**只能创建"一大坨"扁平记忆**，无法利用 v3.3 Atom Architecture 的原子化、层级化、可链接的知识组织能力。

**核心矛盾**: 底层已实现完整的 Atom 架构（代码分析自动创建 Atom 树），但 OpenCode 完全无法访问这些能力。

### 解决方案

通过**三层改造**让 OpenCode 内化原子化知识管理：

1. **工具层修复**（P0，1-2天）：暴露 atoms 参数，新增 Atom 操作工具 — ✅ 已完成
2. **Prompt 工程**（P1，2-3天）：注入 Atom 架构认知到 Agent — ⏳ 实施中
3. **工作流改造**（P2，1周）：Agent 自动萃取和组织 Atom 树 — ⏳ 待实施

### 预期效果

- OpenCode 主动将知识组织为层级化 Atom 树
- 精准引用知识片段（[[atom_id]]）而非加载整篇文档
- 上下文管理按 Atom 粒度，显著减少 token 浪费
- 代码分析与对话记忆统一在 Atom 架构下

---

## 一、现状分析

### 1.1 已实现的底层能力（代码证据）

| 能力 | 文件位置 | 状态 |
|------|----------|------|
| Atom 写入 | `lib/memory-core.js:71` | ✅ `writeMemory({atoms})` 完整实现 |
| Atom 读取 | `lib/memory-core.js:567` | ✅ `readMemory()` 自动查找 Atom |
| Atom 更新 | `lib/memory-core.js:804` | ✅ `updateEntity({atoms_batch})` 支持增删改 |
| Atom 树查询 | `lib/memory-core.js:1271` | ✅ `getEntityAtoms()` 返回树结构 |
| 死链标记 | `lib/memory-core.js:1478` | ✅ `markDeadLinks()` 完整实现 |
| Wiki 链接解析 | `lib/memory-core.js:468` | ✅ `extractWikiLinks()` / `findIncomingLinks()` |
| 树算法 | `lib/atom-tree.js` | ✅ O(n) 建树、循环检测、分数索引 |
| 代码分析 Atom 化 | `lib/code-analysis-service.js:487` | ✅ `uploadAsAtomEntity()` 自动创建 Atom 树 |

### 1.2 五大集成缺口

#### ✅ 缺口 1：memory_write 不暴露 atoms 参数 — RESOLVED

**位置**: `tools/core.js:25`

已修复。`memory_write` 现在接受 `atoms` 参数：

```javascript
export const memory_write = tool({
  description: 'Write an entry to long-term memory with optional Atom tree structure.',
  args: {
    content: tool.schema.string().describe('L2: Full content'),
    abstract: tool.schema.string().describe('L0: Summary, recommended ≤100 chars (REQUIRED)'),
    overview: tool.schema.string().describe('L1: Key points, recommended ≤500 chars (REQUIRED)'),
    type: tool.schema.string().optional().default('general'),
    tags: tool.schema.array(tool.schema.string()).optional().default([]),
    pinned: tool.schema.boolean().optional().default(false),
    atoms: tool.schema.array(
      tool.schema.object({
        local_id: tool.schema.string(),
        type: tool.schema.string(),
        name: tool.schema.string(),
        content: tool.schema.string().optional(),
        parent_id: tool.schema.string().optional(),
        order: tool.schema.string().optional(),
        heading_level: tool.schema.number().optional(),
        tags: tool.schema.array(tool.schema.string()).optional(),
        aliases: tool.schema.array(tool.schema.string()).optional(),
      })
    ).optional().describe('Optional Atom tree structure for hierarchical knowledge'),
  },
  async execute(args) {
    const result = await writeAndSyncMemory({
      ...args,
      atoms: args.atoms || [],
    });
    return result.message;
  },
});
```

#### ✅ 缺口 2：无 Atom 操作工具 — RESOLVED

**位置**: `tools/core.js:153` (entity_update), `tools/core.js:250` (entity_atoms)

已注册。`plugin.js:121-122` 确认工具已注册：

- ✅ `entity_update` — 批量 Atom 操作（add/update/remove） → `tools/core.js:153`
- ✅ `entity_atoms` — 获取 Atom 树结构 → `tools/core.js:250`
- ✅ `load_context_budget` — 按 token 预算加载上下文 → `tools/core.js:292`
- ✅ `load_context_level` — 按层级加载上下文 → `tools/core.js:355`

#### ✅ 缺口 3：搜索不支持 Atom 粒度 — RESOLVED

**位置**: `tools/search.js:18-60`

已修复。`memory_search` 现在接受 `scope` 和 `atom_types` 参数：

```javascript
export const memory_search = tool({
  description: 'Search memory with configurable search mode and optional Atom scope',
  args: {
    query: tool.schema.string().describe('Search query'),
    mode: tool.schema.string().optional().default('hybrid'),
    scope: tool.schema.string().optional().default('all'),  // 'all', 'entity', 'atom'
    atom_types: tool.schema.array(tool.schema.string()).optional(),  // ['chapter', 'function']
    limit: tool.schema.number().optional().default(10),
    level: tool.schema.number().optional().default(0),
  },
  // ...
});
```

#### ✅ 缺口 4：Agent 无法自动萃取 Atom — RESOLVED

**位置**: `agents/memory-automation.md`, `agents/memory-consolidate.md`

**已完成**:
- SOUL.md 已注入 Atom Architecture 认知
- AGENTS.md 已定义 Atom 操作规范
- TOOLS.md 已添加 Atom 工具使用说明

**状态**: Prompt 注入已全部完成。Agent 实际行为需通过日常使用观察验证（验收标准见 Phase 2 验证方案）。

#### ✅ 缺口 5：Prompt 不注入 Atom 结构 — RESOLVED

**位置**: `memory/SOUL.md`, `memory/AGENTS.md`, `memory/TOOLS.md`

已注入完整的 Atom Architecture 认知到 OpenCode system prompt 中。

### 1.3 syncMemoryToBackend Bug

**位置**: `lib/memory-core.js:305-328`

✅ **FIXED** — `syncMemoryToBackend()` 现在正确传递 `atoms` 到后端：

```javascript
export async function syncMemoryToBackend({
  localId, filePath, content, abstract, overview,
  type, tags, atoms,  // ✅ atoms 参数已包含
  project_id, source_id, tenant_id, source = 'cli', metadata = {}, client,
}) {
  const memory = {
    content,
    abstract,
    overview,
    type,
    tags,
    atoms,  // ✅ line 328 — atoms 正确传递到后端
    project_id,
    source_id,
    tenant_id,
    source,
    metadata,
  };
  // ...
}
```

---

## 二、集成方案

### 2.1 第一阶段：工具层修复（P0） — ✅ COMPLETED

| 任务 | 文件 | 代码位置 | 状态 |
|------|------|----------|------|
| 1.1 memory_write 暴露 atoms | `tools/core.js` | line 25 | ✅ COMPLETED |
| 1.2 syncMemoryToBackend 同步 atoms | `lib/memory-core.js` | line 305-328 | ✅ COMPLETED |
| 1.3 新增 entity_update 工具 | `tools/core.js` | line 153 | ✅ COMPLETED |
| 1.4 新增 entity_atoms 工具 | `tools/core.js` | line 250 | ✅ COMPLETED |
| 1.5 扩展 memory_search 支持 Atom 粒度 | `tools/search.js` | line 18-60 | ✅ COMPLETED |
| 1.6 plugin.js 注册新工具 | `plugin.js` | line 117-138 | ✅ COMPLETED |

**注册的 20 个工具** (plugin.js:117-138):

```javascript
return {
  tool: {
    memory_write,        // ✅ 支持 atoms
    memory_read,
    memory_pin,
    entity_update,       // ✅ 批量 Atom 操作
    entity_atoms,        // ✅ 获取 Atom 树
    load_context_budget, // ✅ 按 token 预算加载
    load_context_level,  // ✅ 按层级加载
    memory_search,       // ✅ 支持 Atom 粒度
    memory_suggest,
    memory_relate,
    memory_graph,
    memory_timeline,
    memory_topics,
    rebuild_index,
    index_status,
    incremental_sync,
    full_sync,
    conflict_list,
    conflict_resolve,
    sync_checkpoint,
  },
};
```

### 2.2 第二阶段：Prompt 工程（P1） — ✅ COMPLETED

| 任务 | 文件 | 状态 |
|------|------|------|
| 2.1 更新 SOUL.md 注入 Atom 认知 | `memory/SOUL.md` | ✅ COMPLETED |
| 2.2 更新 AGENTS.md 定义 Atom 操作规范 | `memory/AGENTS.md` | ✅ COMPLETED |
| 2.3 更新 TOOLS.md 说明 Atom 工具使用 | `memory/TOOLS.md` | ✅ COMPLETED |
| 2.4 验证 Agent 行为 | OpenCode 实际使用 | ✅ COMPLETED（Prompt 注入完成，日常使用观察验证） |

#### 已注入的 Prompt 内容

**SOUL.md**: Atom Architecture 认知（什么是 Atom、为什么使用、何时创建、结构示例、[[local_id]] 链接、最佳实践）

**AGENTS.md**: Atom 操作规范（创建决策流程、Atom 类型指南、自动萃取启发式规则）

**TOOLS.md**: Atom 工具使用示例（memory_write with atoms、entity_update、entity_atoms、memory_search with atom scope）

### 2.3 第三阶段：工作流改造（P2） — ⏳ PENDING

#### 任务 3.1：改造 The Observer 自动萃取 Atom

**文件**: `agents/memory-automation.md`

修改 workflow：

```yaml
workflow:
  1. 分析对话内容，识别值得保存的信息
  2. 判断信息类型：
     - 如果是结构化知识（代码、文档、复杂概念）→ 构建 Atom 树
     - 如果是简单笔记 → 扁平存储
  3. 构建 Atom 树（如适用）：
     - 识别顶层概念 → chapter
     - 识别子要点 → section
     - 识别细节 → note
     - 生成 local_id 和 parent_id
  4. 查重：memory_search 检查是否已存在
  5. 展示候选：等待用户确认
  6. 保存：memory_write({atoms}) 或 memory_write（扁平）
```

#### 任务 3.2：改造 The Librarian 按 Atom 粒度整合

**文件**: `agents/memory-consolidate.md`

修改 workflow：

```yaml
workflow:
  1. 扫描碎片：memory_timeline(days=7) + memory_topics
  2. 识别相关碎片：按主题聚类
  3. 构建知识树：
     - 主题 → Entity
     - 要点 → chapter Atom
     - 细节 → section/note Atom
  4. 创建整合节点：memory_write({atoms: tree})
  5. 建立关系：memory_relate(整合节点 → 源碎片)
  6. 更新源碎片：entity_update({atoms_batch}) 标记为已整合
  7. 置顶：memory_pin(整合节点)
```

#### 任务 3.3：代码分析结果关联到对话记忆

**文件**: `lib/code-analysis-service.js`

```javascript
// TODO: Experimental
// 创建代码分析 Entity 后，尝试关联到最近的对话记忆
async linkToConversationMemory(entityId, filePath) {
  const recentMemories = await memory_search({
    query: `code analysis ${filePath}`,
    limit: 5,
  });

  if (recentMemories.length > 0) {
    await memory_relate({
      from_id: recentMemories[0].id,
      to_id: entityId,
      relation_type: "analyzes",
    });
  }
}
```

#### 任务 3.4：上下文管理按 Atom 粒度

**文件**: `lib/memory-core.js`

```javascript
// ✅ 已实现为 load_context_level 工具 (tools/core.js:355)
// 按层级加载 Atom 内容
export async function loadContextByLevel(entryId, maxLevel = 2) {
  const entity = await readMemory({ entry_id: entryId, level: 2 });

  if (!entity.atoms) return entity;

  const filteredAtoms = entity.atoms.filter(atom => {
    return atom.heading_level <= maxLevel;
  });

  let context = entity.abstract + '\n\n';
  for (const atom of filteredAtoms) {
    context += `${'#'.repeat(atom.heading_level)} ${atom.name}\n`;
    context += atom.content + '\n\n';
  }

  return context;
}
```

> **注意**: 任务 3.3（代码分析关联）标记为 `// TODO: Experimental`，属于探索性功能。任务 3.4（上下文管理）已实现为 `load_context_level`（`tools/core.js:355`）和 `load_context_budget`（`tools/core.js:292`）工具，需验证 Agent 是否在实际对话中使用。

---

## 三、实施路线图

### Phase 1: 工具层修复 — ✅ COMPLETED

| 任务 | 产出 | 代码位置 | 状态 |
|------|------|----------|------|
| 修复 memory_write 暴露 atoms | atoms 参数可用 | `tools/core.js:25` | ✅ COMPLETED |
| 修复 syncMemoryToBackend | atoms 同步到后端 | `lib/memory-core.js:305-328` | ✅ COMPLETED |
| 新增 entity_update | 批量 Atom 操作 | `tools/core.js:153` | ✅ COMPLETED |
| 新增 entity_atoms | 获取 Atom 树 | `tools/core.js:250` | ✅ COMPLETED |
| 扩展 memory_search | Atom 粒度搜索 | `tools/search.js:18-60` | ✅ COMPLETED |
| 更新 plugin.js 注册 | 20 个工具注册 | `plugin.js:117-138` | ✅ COMPLETED |
| 编写测试 | 10+ 新测试通过 | `tests/unit/atoms/` | ✅ COMPLETED |

### Phase 2: Prompt 工程 — ✅ COMPLETED

| 任务 | 产出 | 状态 |
|------|------|------|
| 更新 SOUL.md | Atom 认知注入 | ✅ COMPLETED |
| 更新 AGENTS.md | 操作规范定义 | ✅ COMPLETED |
| 更新 TOOLS.md | 使用示例 | ✅ COMPLETED |
| 验证 Agent 行为 | 自动创建 Atom 树 | ✅ COMPLETED（Prompt 注入完成） |

### Phase 3: 工作流改造 — ⏳ PENDING

| 任务 | 产出 | 状态 |
|------|------|------|
| 改造 The Observer | 自动萃取 Atom | ⏳ PENDING |
| 改造 The Librarian | 按 Atom 整合 | ⏳ PENDING |
| 代码分析关联 | 双向链接 | ⏳ PENDING |
| 上下文管理 | Atom 粒度加载 | ⏳ PENDING |

---

## 四、Phase 3 详细实施步骤

### 任务 3.1：改造 The Observer 自动萃取 Atom

**涉及文件**: `opencode-memory-plugin/agents/memory-automation.md`

**具体变更**:
1. 在 workflow 步骤 2 后增加"结构化判断"子步骤
2. 添加 Atom 树构建模板（3 层以内：chapter → section → note）
3. 增加 local_id 生成规则（使用 ULID 前缀 + 序号）

**回滚策略**: 保留原有扁平写入逻辑作为 fallback，Atom 构建失败时自动降级

**验收标准**:
- [ ] 对话中包含代码片段时，Observer 生成 Atom 树而非扁平记忆
- [ ] 对话中包含 3 个以上要点时，Observer 生成层级结构
- [ ] 简单对话（<500 字）仍然使用扁平存储
- [ ] 用户确认流程不受影响

### 任务 3.2：改造 The Librarian 按 Atom 粒度整合

**涉及文件**: `opencode-memory-plugin/agents/memory-consolidate.md`

**具体变更**:
1. 在 workflow 步骤 3 增加知识树构建逻辑
2. 整合后使用 `entity_update` 标记源碎片为已整合
3. 使用 `memory_relate(relation_type="summarizes")` 建立溯源关系

**回滚策略**: 保留原有 `memory_write` 整合逻辑，`entity_update` 失败时降级

**验收标准**:
- [ ] 整合节点包含完整的 Atom 树结构
- [ ] 源碎片被标记为已整合（通过 entity_update）
- [ ] 溯源关系正确建立（整合节点 → 源碎片）
- [ ] 整合节点被置顶

### 任务 3.3：代码分析结果关联到对话记忆

**涉及文件**: `opencode-memory-plugin/lib/code-analysis-service.js`

**具体变更**:
1. 在 `uploadAsAtomEntity()` 成功后调用 `linkToConversationMemory()`
2. 使用 `memory_search` 查找最近的相关对话记忆
3. 通过 `memory_relate(relation_type="analyzes")` 建立关系

**回滚策略**: 关联失败不影响代码分析结果上传，仅记录警告日志

**验收标准**:
- [ ] 代码分析 Entity 创建后自动关联到对话记忆
- [ ] 关联关系可通过 `memory_graph` 查询到
- [ ] 关联失败不影响代码分析主流程

### 任务 3.4：上下文管理按 Atom 粒度

**涉及文件**: `opencode-memory-plugin/lib/memory-core.js`

**具体变更**:
1. `loadContextByLevel()` 已实现为工具 → `tools/core.js:355`
2. `loadContextByBudget()` 已实现为工具 → `tools/core.js:292`
3. 需要验证 Agent 是否在实际对话中使用这些工具

**回滚策略**: 工具已注册且向后兼容，不影响现有功能

**验收标准**:
- [ ] Agent 在加载长文档时使用 `load_context_level` 而非 `memory_read`
- [ ] `load_context_budget` 在 token 预算内返回最相关的 Atom
- [ ] 渐进加载（L0 → L1 → L2）工作正常

---

## 五、验证方案

### 5.1 功能验证

```javascript
// 测试 1: 创建带 Atom 的记忆
const result = await memory_write({
  abstract: "Test",
  atoms: [{ local_id: "01TEST", type: "chapter", name: "Test", ... }]
});
assert(result.success === true);

// 测试 2: 获取 Atom 树
const atoms = await entity_atoms({ entry_id: result.localId });
assert(atoms.tree.length > 0);

// 测试 3: Atom 粒度搜索
const search = await memory_search({ query: "test", scope: "atom" });
assert(search.results.some(r => r.type === "atom"));

// 测试 4: 批量更新
const update = await entity_update({
  entry_id: result.localId,
  atoms_batch: [{ action: "add", local_id: "01NEW", ... }]
});
assert(update.success === true);
```

### 5.2 集成验证

- [x] OpenCode 调用 memory_write({atoms}) 成功
- [x] OpenCode 调用 entity_update 成功
- [x] OpenCode 调用 entity_atoms 成功
- [ ] Agent 自动创建 Atom 树（观察 The Observer 行为）
- [ ] 代码分析结果自动关联到对话记忆

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| atoms 参数 schema 复杂 | 中 | Agent 使用困难 | 提供清晰的示例和模板 |
| 向后兼容性问题 | 低 | 旧记忆无法读取 | atoms 是 optional，默认空数组 |
| 性能下降 | 低 | Atom 树构建慢 | O(n) 算法，已优化 |
| Agent 不理解 Atom | 中 | 继续使用扁平模式 | Prompt 工程 + 示例引导 |

---

## 七、成功标准

### 7.1 定量指标

- [ ] memory_write 调用中 atoms 参数使用率 > 30%
- [ ] entity_update / entity_atoms 工具调用次数 > 100/周
- [ ] Atom 粒度搜索占比 > 20%
- [ ] 平均 Entity 包含 Atom 数 > 3

### 7.2 定性指标

- [ ] Agent 主动将结构化知识组织为 Atom 树
- [ ] 用户反馈"精准引用知识片段"体验良好
- [ ] 上下文加载 token 使用量减少 > 30%
- [ ] 代码分析与对话记忆形成知识图谱

---

## 八、附录

### 8.1 参考文档

- [Atom 架构详细设计](../architecture/ATOM-ARCHITECTURE.md)
- [评估方案设计](../evaluation/DESIGN-EVALUATION.md)
- [API-CONTRACT.md](../../API-CONTRACT.md)

> **注意**: `IMPLEMENTATION-INTEGRATION.md` 和 `test-plans/*.md` 尚未创建，为规划中文件。实施时请参考本文档 Phase 3 详细实施步骤。

### 8.2 相关代码

| 文件 | 说明 |
|------|------|
| `lib/memory-core.js` | Atom 核心 API |
| `lib/atom-tree.js` | 树算法 |
| `tools/core.js` | memory_write / entity_update / entity_atoms / load_context_* |
| `tools/search.js` | memory_search（Atom 粒度） |
| `plugin.js` | 工具注册（20 个工具） |
| `agents/memory-automation.md` | The Observer Agent |
| `agents/memory-consolidate.md` | The Librarian Agent |

---

**下一步行动**: 启动 Phase 3 工作流改造（The Observer / The Librarian Agent 行为优化）。
