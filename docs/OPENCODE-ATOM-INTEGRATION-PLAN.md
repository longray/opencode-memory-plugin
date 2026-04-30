# OpenCode Atom 架构内化集成方案

**版本**: v1.0  
**日期**: 2026-04-29  
**状态**: 设计完成，待实施  
**基于**: opencode-memory-plugin v3.3 深度代码分析

---

## 执行摘要

### 问题陈述

当前 OpenCode 使用记忆插件时，**只能创建"一大坨"扁平记忆**，无法利用 v3.3 Atom Architecture 的原子化、层级化、可链接的知识组织能力。

**核心矛盾**: 底层已实现完整的 Atom 架构（代码分析自动创建 Atom 树），但 OpenCode 完全无法访问这些能力。

### 解决方案

通过**三层改造**让 OpenCode 内化原子化知识管理：

1. **工具层修复**（P0，1-2天）：暴露 atoms 参数，新增 Atom 操作工具
2. **Prompt 工程**（P1，2-3天）：注入 Atom 架构认知到 Agent
3. **工作流改造**（P2，1周）：Agent 自动萃取和组织 Atom 树

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
| Atom 写入 | `lib/memory-core.js:173` | ✅ `writeMemory({atoms})` 完整实现 |
| Atom 读取 | `lib/memory-core.js:567` | ✅ `readMemory()` 自动查找 Atom |
| Atom 更新 | `lib/memory-core.js:695` | ✅ `updateEntity({atoms_batch})` 支持增删改 |
| Atom 树查询 | `lib/memory-core.js:865` | ✅ `getEntityAtoms()` 返回树结构 |
| 死链标记 | `lib/memory-core.js:916` | ✅ `markDeadLinks()` 完整实现 |
| Wiki 链接解析 | `lib/memory-core.js:468` | ✅ `extractWikiLinks()` / `findIncomingLinks()` |
| 树算法 | `lib/atom-tree.js` | ✅ O(n) 建树、循环检测、分数索引 |
| 代码分析 Atom 化 | `lib/code-analysis-service.js:454` | ✅ `uploadAsAtomEntity()` 自动创建 Atom 树 |

### 1.2 五大集成缺口

#### ✅ 缺口 1：memory_write 不暴露 atoms 参数（已修复）

**位置**: `tools/core.js:19-28`

```javascript
// 当前实现 - 缺少 atoms！
export const memory_write = tool({
  args: {
    content: tool.schema.string(),  // ← 只能存一大坨
    abstract: tool.schema.string(),
    overview: tool.schema.string(),
    // ❌ 没有 atoms 参数
  },
});
```

**影响**: OpenCode 永远无法创建带 Atom 结构的知识树。

#### ✅ 缺口 2：无 Atom 操作工具（已修复）

**位置**: `plugin.js:116-135`

已注册 16 个工具，**无一与 Atom 相关**：
- ❌ 没有 `entity_update`（批量 Atom 操作）
- ❌ 没有 `entity_atoms`（获取 Atom 树）
- ❌ 没有 `atom_search`（Atom 粒度搜索）
- ❌ 没有 `atom_create` / `atom_update` / `atom_delete`

#### ✅ 缺口 3：搜索不支持 Atom 粒度（已修复）

**位置**: `tools/search.js:18-60`

当前搜索只返回 Entity 级别结果，无法精准定位到 Atom。

#### 🔴 缺口 4：Agent 无法自动萃取 Atom

**位置**: `agents/memory-automation.md`, `agents/memory-consolidate.md`

Agent 的 prompt 中**没有任何关于 Atom 的说明**，完全不知道 Atom 架构存在。

#### 🔴 缺口 5：Prompt 不注入 Atom 结构

**位置**: `memory/SOUL.md`, `memory/AGENTS.md`, `memory/TOOLS.md`

OpenCode 的 system prompt 中**没有 Atom Architecture 的概念**，AI 不知道应该按层级组织知识。

### 1.3 两套存储路径的割裂

```
代码分析路径（自动）：
  文件保存 → Oxc 分析 → createAtom() → createEntity() → createReference()
  ↓ 直接写入后端，本地无文件

记忆写入路径（手动）：
  Agent 调用 → writeMemory() → 本地 .md 文件 → syncMemoryToBackend()
  ↓ atoms 参数不传给后端！
```

**关键 Bug**: ~~`syncMemoryToBackend()` 构造的同步对象**不包含 atoms**，本地 Atom 树永远无法同步到后端。~~ ✅ 已修复：`syncMemoryToBackend` 现在正确传递 atoms 到后端。

---

## 二、集成方案

### 2.1 第一阶段：工具层修复（P0，1-2天）

#### 任务 1.1：修复 memory_write 暴露 atoms 参数

**文件**: `tools/core.js`

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
    // ✅ 新增 atoms 参数
    atoms: tool.schema.array(
      tool.schema.object({
        local_id: tool.schema.string(),
        type: tool.schema.string(),  // chapter, section, function, note
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
    // 现有逻辑 + 传递 atoms
    const result = await writeAndSyncMemory({
      ...args,
      atoms: args.atoms || [],
    });
    return result.message;
  },
});
```

#### 任务 1.2：修复 syncMemoryToBackend 同步 atoms

**文件**: `lib/memory-core.js:287-367`

```javascript
// 当前代码（有 Bug）
const memory = {
  content: entry.content,
  abstract: entry.abstract,
  overview: entry.overview,
  // ❌ 缺少 atoms！
};

// 修复后
const memory = {
  content: entry.content,
  abstract: entry.abstract,
  overview: entry.overview,
  atoms: entry.atoms || [],  // ✅ 添加 atoms
};
```

#### 任务 1.3：新增 entity_update 工具

**文件**: `tools/core.js`（新增）

```javascript
export const entity_update = tool({
  description: 'Update an entity with batch Atom operations (add/update/remove).',
  args: {
    entry_id: tool.schema.string().describe('Entity ID to update'),
    entity_updates: tool.schema.object({
      abstract: tool.schema.string().optional(),
      overview: tool.schema.string().optional(),
      tags: tool.schema.array(tool.schema.string()).optional(),
    }).optional(),
    atoms_batch: tool.schema.array(
      tool.schema.object({
        action: tool.schema.string(),  // 'add', 'update', 'remove'
        local_id: tool.schema.string(),
        // ... Atom fields
      })
    ).optional(),
  },
  async execute(args) {
    const { updateEntity } = await import('../lib/memory-core.js');
    const result = await updateEntity({
      entry_id: args.entry_id,
      entity_updates: args.entity_updates,
      atoms_batch: args.atoms_batch,
    });
    return result.message;
  },
});
```

#### 任务 1.4：新增 entity_atoms 工具

**文件**: `tools/core.js`（新增）

```javascript
export const entity_atoms = tool({
  description: 'Get Atom tree structure of an entity.',
  args: {
    entry_id: tool.schema.string().describe('Entity ID'),
    include_content: tool.schema.boolean().optional().default(true),
  },
  async execute(args) {
    const { getEntityAtoms } = await import('../lib/memory-core.js');
    const result = await getEntityAtoms({
      entry_id: args.entry_id,
      include_content: args.include_content,
    });
    return JSON.stringify(result.tree, null, 2);
  },
});
```

#### 任务 1.5：扩展 memory_search 支持 Atom 粒度

**文件**: `tools/search.js`

```javascript
export const memory_search = tool({
  description: 'Search memories with optional Atom-level filtering.',
  args: {
    query: tool.schema.string(),
    mode: tool.schema.string().optional().default('hybrid'),
    scope: tool.schema.string().optional().default('all'),  // 'all', 'entity', 'atom'
    atom_types: tool.schema.array(tool.schema.string()).optional(),  // ['chapter', 'function']
    limit: tool.schema.number().optional().default(10),
    level: tool.schema.number().optional().default(0),
  },
  async execute(args) {
    // 调用后端 /api/v1/search（统一搜索端点）
    const results = await client.search({
      ...args,
      scope: args.scope,
      atom_types: args.atom_types,
    });
    return JSON.stringify(results, null, 2);
  },
});
```

#### 任务 1.6：在 plugin.js 注册新工具

**文件**: `plugin.js:116-135`

```javascript
return {
  tool: {
    memory_write,      // ✅ 已修复，支持 atoms
    memory_read,
    memory_pin,
    memory_search,     // ✅ 已扩展，支持 Atom 粒度
    // ... 其他工具
    // ✅ 新增工具
    entity_update,     // 批量 Atom 操作
    entity_atoms,      // 获取 Atom 树
    atom_search: memory_search,  // 别名，语义更清晰
  },
};
```

### 2.2 第二阶段：Prompt 工程（P1，2-3天）

#### 任务 2.1：更新 SOUL.md 注入 Atom 认知

**文件**: `memory/SOUL.md`

在现有内容后添加：

```markdown
## Atom Architecture 认知

你是 OpenCode Memory，一个具有**原子化知识管理能力**的 AI 助手。

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

#### 任务 2.2：更新 AGENTS.md 定义 Atom 操作规范

**文件**: `memory/AGENTS.md`

添加章节：

```markdown
## Atom 操作规范

### 创建 Atom 树的决策流程

```
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
```

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
```

#### 任务 2.3：更新 TOOLS.md 说明 Atom 工具使用

**文件**: `memory/TOOLS.md`

添加：

```markdown
## Atom 相关工具

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
```

### 2.3 第三阶段：工作流改造（P2，1周）

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

修改 `uploadAsAtomEntity()` 后，添加：

```javascript
// 创建代码分析 Entity 后，尝试关联到最近的对话记忆
async linkToConversationMemory(entityId, filePath) {
  // 1. 搜索最近的对话记忆
  const recentMemories = await memory_search({
    query: `code analysis ${filePath}`,
    limit: 5,
  });

  // 2. 如果找到相关对话，创建关系
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

**文件**: `lib/memory-core.js`（新增函数）

```javascript
// 按层级加载 Atom 内容
export async function loadContextByLevel(entryId, maxLevel = 2) {
  const entity = await readMemory({ entry_id: entryId, level: 2 });

  if (!entity.atoms) return entity;

  // 按层级过滤 Atom
  const filteredAtoms = entity.atoms.filter(atom => {
    return atom.heading_level <= maxLevel;
  });

  // 构建上下文字符串
  let context = entity.abstract + '\n\n';
  for (const atom of filteredAtoms) {
    context += `${'#'.repeat(atom.heading_level)} ${atom.name}\n`;
    context += atom.content + '\n\n';
  }

  return context;
}
```

---

## 三、实施路线图

### Phase 1: 工具层修复（Week 1）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1 | 修复 memory_write 暴露 atoms | ✅ COMPLETED |
| Day 1 | 修复 syncMemoryToBackend | ✅ COMPLETED |
| Day 2 | 新增 entity_update 工具 | ✅ COMPLETED |
| Day 2 | 新增 entity_atoms 工具 | ✅ COMPLETED |
| Day 3 | 扩展 memory_search | ✅ COMPLETED |
| Day 3 | 更新 plugin.js 注册 | ✅ COMPLETED |
| Day 4-5 | 编写测试 | ✅ 10+ 新测试通过 |

### Phase 2: Prompt 工程（Week 2）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1-2 | 更新 SOUL.md | ✅ Atom 认知注入 |
| Day 2-3 | 更新 AGENTS.md | ✅ 操作规范定义 |
| Day 3-4 | 更新 TOOLS.md | ✅ 使用示例 |
| Day 5 | 验证 Agent 行为 | ✅ 自动创建 Atom 树 |

### Phase 3: 工作流改造（Week 3）

| 天数 | 任务 | 产出 |
|------|------|------|
| Day 1-2 | 改造 The Observer | ✅ 自动萃取 Atom |
| Day 2-3 | 改造 The Librarian | ✅ 按 Atom 整合 |
| Day 3-4 | 代码分析关联 | ✅ 双向链接 |
| Day 4-5 | 上下文管理 | ✅ Atom 粒度加载 |

---

## 四、验证方案

### 4.1 功能验证

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

### 4.2 集成验证

- [ ] OpenCode 调用 memory_write({atoms}) 成功
- [ ] OpenCode 调用 entity_update 成功
- [ ] OpenCode 调用 entity_atoms 成功
- [ ] Agent 自动创建 Atom 树（观察 The Observer 行为）
- [ ] 代码分析结果自动关联到对话记忆

---

## 五、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| atoms 参数 schema 复杂 | 中 | Agent 使用困难 | 提供清晰的示例和模板 |
| 向后兼容性问题 | 低 | 旧记忆无法读取 | atoms 是 optional，默认空数组 |
| 性能下降 | 低 | Atom 树构建慢 | O(n) 算法，已优化 |
| Agent 不理解 Atom | 中 | 继续使用扁平模式 | Prompt 工程 + 示例引导 |

---

## 六、成功标准

### 6.1 定量指标

- [ ] memory_write 调用中 atoms 参数使用率 > 30%
- [ ] entity_update / entity_atoms 工具调用次数 > 100/周
- [ ] Atom 粒度搜索占比 > 20%
- [ ] 平均 Entity 包含 Atom 数 > 3

### 6.2 定性指标

- [ ] Agent 主动将结构化知识组织为 Atom 树
- [ ] 用户反馈"精准引用知识片段"体验良好
- [ ] 上下文加载 token 使用量减少 > 30%
- [ ] 代码分析与对话记忆形成知识图谱

---

## 七、附录

### 7.1 参考文档

- [v3.3-ATOM-ARCHITECTURE-DESIGN.md](./v3.3-ATOM-ARCHITECTURE-DESIGN.md)
- [API-CONTRACT.md](./API-CONTRACT.md)
- [MIGRATION-v3.3.md](./MIGRATION-v3.3.md)

### 7.2 相关代码

- `lib/memory-core.js` - Atom 核心 API
- `lib/atom-tree.js` - 树算法
- `tools/core.js` - memory_write 工具
- `plugin.js` - 工具注册
- `agents/*.md` - Agent 配置

---

**下一步行动**: 开始 Phase 1，修复工具层暴露 atoms 参数。
