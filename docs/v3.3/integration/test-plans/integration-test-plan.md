---
status: draft
version: 1.0.0
last_updated: 2026-05-01
owner: Atlas
traceability:
  - DESIGN-INTEGRATION.md §二 (集成方案)
  - DESIGN-INTEGRATION.md §五 (验证方案)
  - ATOM-ARCHITECTURE.md §5.2 (API 设计)
---

# 集成测试计划

> **范围**: 工具间协作（memory_write ↔ entity_atoms ↔ memory_search ↔ sync）  
> **目标**: 验证工具链端到端数据一致性  
> **前提**: 后端服务运行中（localhost:18008），tenant_id="default"

---

## 1. `memory_write({atoms})` → `entity_atoms()` 往返

**追溯**: DESIGN-INTEGRATION.md §5.1 功能验证 — 测试 1/2

### 1.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 1.1 | 写入带 Atom 树的 Entity → 读取验证 | 无 | 1. `memory_write({abstract, overview, content, atoms: [2层树]})`<br>2. `entity_atoms({entry_id: result.localId, include_content: true})` | entity_atoms 返回树结构与写入一致（local_id, type, name, content, parent_id, order, heading_level 全匹配） | 删除该 Entity |
| 1.2 | 写入无 Atom 的 Entity → entity_atoms 返回空 | 无 | 1. `memory_write({abstract, overview, content})`<br>2. `entity_atoms({entry_id})` | 返回 `tree: []` | 删除该 Entity |
| 1.3 | 写入 4 层深度 Atom 树 | 无 | 1. `memory_write({atoms: [L1→L2→L3→L4]})`<br>2. `entity_atoms({include_content: true})` | 树深度 4，层级关系正确 | 删除该 Entity |
| 1.4 | 写入多根节点（森林） | 无 | 1. `memory_write({atoms: [根A+子, 根B+子]})`<br>2. `entity_atoms({})` | 返回 2 个根节点，各自子树完整 | 删除该 Entity |
| 1.5 | 写入后 `include_content=false` | 同 1.1 | 1. `memory_write({atoms})`<br>2. `entity_atoms({include_content: false})` | 返回树结构，但每个节点的 content 为 undefined | 删除该 Entity |

### 1.2 验证脚本

```javascript
// tests/integration/atoms/write-read-roundtrip.test.js

const entity = await memory_write({
  abstract: "Integration test",
  overview: "Roundtrip verification",
  content: "Full content",
  type: "test",
  tags: ["integration", "atom"],
  atoms: [
    {
      local_id: "01CHAPTER001",
      type: "chapter",
      name: "Chapter 1",
      content: "Chapter content",
      order: "a0",
      heading_level: 1,
      parent_id: null,
      tags: ["ch1"],
    },
    {
      local_id: "01SECTION001",
      type: "section",
      name: "Section 1.1",
      content: "Section content",
      order: "a0",
      heading_level: 2,
      parent_id: "01CHAPTER001",
    },
  ],
});

const atoms = await entity_atoms({
  entry_id: entity.localId,
  include_content: true,
});

expect(atoms.tree.length).toBe(1);
expect(atoms.tree[0].local_id).toBe("01CHAPTER001");
expect(atoms.tree[0].children[0].local_id).toBe("01SECTION001");
expect(atoms.tree[0].children[0].parent_id).toBe("01CHAPTER001");
```

---

## 2. `entity_update({atoms_batch})` 增删改操作

**追溯**: DESIGN-INTEGRATION.md §5.1 功能验证 — 测试 4

### 2.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 2.1 | Add 操作：新增叶子 Atom | 写入 1 个根 Atom | 1. `entity_update({entry_id, atoms_batch:[{action:"add",local_id:"01NEW",type:"section",name:"New",content:"...",parent_id:"ROOT_ID",order:"a0"}]})`<br>2. `entity_atoms({entry_id})` | 树新增 1 个子节点，parent_id 正确 | 删除 Entity |
| 2.2 | Add 操作：新增根 Atom | 写入 1 个根 Atom | 1. `entity_update({atoms_batch:[{action:"add",local_id:"01NEW2",type:"chapter",name:"New Root",parent_id:null,order:"a1"}]})`<br>2. `entity_atoms({})` | 返回 2 个根节点 | 删除 Entity |
| 2.3 | Update 操作：更新 content | 写入带 Atom 的 Entity | 1. `entity_update({atoms_batch:[{action:"update",local_id:"ATOM_ID",content:"updated content"}]})`<br>2. `entity_atoms({include_content:true})` | Atom 的 content 已更新 | 删除 Entity |
| 2.4 | Update 操作：移动 Atom 到另一个父 | 写入 2 个根 + 各 1 个子 | 1. `entity_update({atoms_batch:[{action:"update",local_id:"CHILD_A",parent_id:"ROOT_B"}]})`<br>2. `entity_atoms({})` | CHILD_A 从 ROOT_A 移到 ROOT_B 下 | 删除 Entity |
| 2.5 | Remove 操作：删除叶子 | 写入 根→子 | 1. `entity_update({atoms_batch:[{action:"remove",local_id:"CHILD_ID"}]})`<br>2. `entity_atoms({})` | 根节点 children 为空 | 删除 Entity |
| 2.6 | Remove 操作：级联删除 | 写入 根→父→[子1,子2] | 1. `entity_update({atoms_batch:[{action:"remove",local_id:"PARENT_ID",cascade:true}]})`<br>2. `entity_atoms({})` | 仅剩根节点，父和子全部删除 | 删除 Entity |
| 2.7 | 混合操作：一次请求 add+update+remove | 写入 根→A, 根→B | 1. `entity_update({atoms_batch:[{action:"add",...新增C},{action:"update",local_id:"A",content:"updated"},{action:"remove",local_id:"B"}]})`<br>2. `entity_atoms({})` | A 已更新，B 已删除，C 已新增 | 删除 Entity |
| 2.8 | Update 不存在的 Atom | 写入 1 个 Atom | 1. `entity_update({atoms_batch:[{action:"update",local_id:"MISSING",content:"x"}]})` | 返回 success:false 或抛出错误 | 删除 Entity |
| 2.9 | 循环引用检测 | 写入 根→A | 1. `entity_update({atoms_batch:[{action:"update",local_id:"ROOT",parent_id:"A"}]})` | 返回错误，提示 circular reference | 删除 Entity |
| 2.10 | Entity 属性更新 | 写入 Entity | 1. `entity_update({entry_id, entity_updates:{abstract:"New abstract"}, atoms_batch:[]})`<br>2. `memory_read({entry_id, level:0})` | abstract 已更新 | 删除 Entity |

---

## 3. `memory_search(scope="atom")` Atom 粒度搜索

**追溯**: DESIGN-INTEGRATION.md §5.1 功能验证 — 测试 3；ATOM-ARCHITECTURE.md §5.1 统一搜索端点

### 3.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 3.1 | scope="atom" 只返回 Atom 级别结果 | 写入 Entity 含 3 个 Atom | 1. `memory_search({query: "Atom 名称关键词", scope: "atom"})` | results 中 type="atom" 的结果 ≥1 | 删除 Entity |
| 3.2 | scope="all" 返回 Entity 和 Atom | 同上 | 1. `memory_search({query: "abstract 关键词", scope: "all"})` | results 包含 type="entity" 和 type="atom" | 删除 Entity |
| 3.3 | scope="entity" 只返回 Entity | 同上 | 1. `memory_search({query: "abstract 关键词", scope: "entity"})` | results 只包含 type="entity" | 删除 Entity |
| 3.4 | atom_types 过滤 | 写入含 chapter 和 function 类型 Atom 的 Entity | 1. `memory_search({query: "关键词", scope: "atom", atom_types: ["function"]})` | 结果只包含 atom_type="function" | 删除 Entity |
| 3.5 | 搜索不存在的关键词 | 写入 Entity | 1. `memory_search({query: "zzz_nonexistent", scope: "atom"})` | results 为空或 score 极低 | 删除 Entity |
| 3.6 | level=0 返回摘要 | 写入 Entity | 1. `memory_search({query: "关键词", scope: "atom", level: 0})` | 结果只有 abstract，无 content | 删除 Entity |

---

## 4. `load_context_level()` 按层级过滤

**追溯**: DESIGN-INTEGRATION.md §任务 3.4 — 上下文管理按 Atom 粒度

### 4.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 4.1 | max_level=1 只返回 H1 Atom | 写入含 H1, H2, H3 Atom 的 Entity | 1. `load_context_level({entry_id, max_level: 1})` | 返回的 markdown 中只有 H1 Atom | 删除 Entity |
| 4.2 | max_level=2 返回 H1+H2 | 同上 | 1. `load_context_level({entry_id, max_level: 2})` | 返回 H1 和 H2 Atom，不含 H3 | 删除 Entity |
| 4.3 | max_level=3 返回全部 | 同上 | 1. `load_context_level({entry_id, max_level: 3})` | 返回所有 Atom | 删除 Entity |
| 4.4 | 无 Atom 的 Entity | 写入无 Atom 的 Entity | 1. `load_context_level({entry_id, max_level: 2})` | 返回 abstract + overview，无 Atom 内容 | 删除 Entity |
| 4.5 | include_breadcrumbs=true | 写入嵌套 Atom | 1. `load_context_level({entry_id, max_level: 2, include_breadcrumbs: true})` | 每个 Atom 前有面包屑路径 | 删除 Entity |
| 4.6 | 不存在的 entry_id | 无 | 1. `load_context_level({entry_id: "MISSING"})` | 返回错误信息 | 无需清理 |

---

## 5. `load_context_budget()` 按 Token 预算加载

**追溯**: ATOM-ARCHITECTURE.md §5.2 — load_context_budget

### 5.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 5.1 | 小预算只返回最相关 Atom | 写入含 5 个 Atom（各 500 字）的 Entity | 1. `load_context_budget({entry_id, query: "关键词匹配 Atom A", max_tokens: 200})` | 返回内容 ≤200 tokens，包含 Atom A | 删除 Entity |
| 5.2 | 大预算返回全部 | 同上 | 1. `load_context_budget({entry_id, query: "任意", max_tokens: 10000})` | 返回所有 Atom | 删除 Entity |
| 5.3 | 零预算 | 同上 | 1. `load_context_budget({entry_id, query: "关键词", max_tokens: 0})` | 返回空或仅 abstract | 删除 Entity |
| 5.4 | strategy="relevance" | 同上 | 1. `load_context_budget({entry_id, query: "特定主题", max_tokens: 500, strategy: "relevance"})` | 最相关的 Atom 优先返回 | 删除 Entity |

---

## 6. Atom 同步：写入本地 → 同步后端 → 搜索返回

**追溯**: DESIGN-INTEGRATION.md §1.3 syncMemoryToBackend Bug 修复

### 6.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 6.1 | 写入含 Atom 的 Entity → incremental_sync → 搜索 | 后端运行 | 1. `memory_write({abstract, atoms: [树]})`<br>2. `incremental_sync()`<br>3. `memory_search({query: "Atom 名称", scope: "atom"})` | 搜索结果中包含刚写入的 Atom（后端可搜索到） | `DELETE /api/v1/memories/clear` 或删除测试 Entity |
| 6.2 | 同步后 entity_atoms 从后端获取 | 同上 | 1. 写入+同步<br>2. `entity_atoms({entry_id})` | 返回的树包含 atom_id（后端返回的全局 ID） | 清理 |
| 6.3 | 本地修改后重新同步 | 写入+同步 | 1. `entity_update({atoms_batch:[{action:"update",content:"new"}]})`<br>2. `incremental_sync()`<br>3. `entity_atoms({include_content:true})` | content 已更新为 "new" | 清理 |
| 6.4 | 后端不可用时降级 | 停止后端 | 1. `memory_write({atoms: [树]})`<br>2. `memory_search({query: "关键词", scope: "atom"})` | 写入成功（本地），搜索降级为 BM25 本地搜索 | 重启后端 |

---

## 7. Wiki 链接端到端验证

**追溯**: ATOM-ARCHITECTURE.md §7 — 双向链接处理

### 7.1 测试用例

| # | 用例名 | Setup | Steps | Expected | Cleanup |
|---|--------|-------|-------|----------|---------|
| 7.1 | Atom A 引用 Atom B → findIncomingLinks 可查 | 写入含 Atom A（content 含 `[[B_ID]]`）和 Atom B 的 Entity | 1. `memory_read({entry_id: "B_ID"})`<br>2. 检查返回的 incoming_links | incoming_links 包含 `{source: "A_ID", ...}` | 删除 Entity |
| 7.2 | 嵌入链接 `![[...]]` 标记正确 | 写入含嵌入链接的 Atom | 1. `memory_read({entry_id: "目标 Atom ID"})`<br>2. 检查 incoming_links 的 isEmbed | isEmbed=true | 删除 Entity |
| 7.3 | 死链检测 | 写入 Atom A 引用已删除的 Atom B | 1. 删除 Atom B<br>2. 读取 Atom A 的 outgoing_links | outgoing_links 中 B 标记为 dead link | 删除 Entity |

---

## 测试覆盖率矩阵

| 工具链 | 覆盖场景 | 正常 | 边界 | 错误 | 总用例 |
|--------|----------|------|------|------|--------|
| write → atoms 往返 | 1.x | 3 | 1 | 1 | 5 |
| entity_update 增删改 | 2.x | 4 | 3 | 3 | 10 |
| search(scope=atom) | 3.x | 2 | 2 | 2 | 6 |
| load_context_level | 4.x | 2 | 2 | 2 | 6 |
| load_context_budget | 5.x | 2 | 1 | 1 | 4 |
| Atom 同步链路 | 6.x | 2 | 1 | 1 | 4 |
| Wiki 链接 | 7.x | 1 | 1 | 1 | 3 |
| **合计** | | **16** | **11** | **11** | **38** |

---

## 执行命令

```bash
# 运行所有集成测试
node --experimental-vm-modules node_modules/.bin/jest tests/integration/ -v

# 运行 Atom 集成测试
node --experimental-vm-modules node_modules/.bin/jest tests/integration/v3.3-atom-e2e.test.js -v

# 运行并生成覆盖率
node --experimental-vm-modules node_modules/.bin/jest tests/integration/ --coverage
```

---

## 前置条件

| 条件 | 验证方式 |
|------|----------|
| 后端服务运行 | `(Invoke-WebRequest -Uri http://localhost:18008/health).Content` |
| API Key 配置 | 环境变量 `WRAPPER_MEILI_API_KEY` 已设置 |
| tenant_id="default" | 测试代码中显式指定 |
| 本地 timeline 目录存在 | `~/.opencode/memory/timeline/` 存在 |

---

**维护者**: Atlas (执行者智能体)  
**更新频率**: 每次 API 变更后
