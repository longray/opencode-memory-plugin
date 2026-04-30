---
status: draft
version: 1.0.0
last_updated: 2026-05-01
owner: Atlas
traceability:
  - DESIGN-INTEGRATION.md §三 (Phase 3 工作流改造)
  - DESIGN-INTEGRATION.md §七 (成功标准)
  - ATOM-ARCHITECTURE.md §2 (核心概念)
---

# 端到端测试计划

> **范围**: 完整用户工作流（从知识创建到检索到更新的全链路）  
> **目标**: 验证 Atom 架构在真实使用场景中的端到端表现  
> **前提**: 后端服务运行，OpenCode 环境，所有工具可用

---

## Workflow A: 代码分析保存 → 搜索 → 读取 → 更新

**追溯**: DESIGN-INTEGRATION.md §任务 3.3 — 代码分析结果关联到对话记忆

### 用户故事

> 作为开发者，我通过 OpenCode 分析一个 JS 文件后，系统自动将函数结构保存为 Atom 树。后续我可以通过搜索找到特定函数的 Atom，读取其详细信息，并更新函数文档。

### 步骤与预期

| Step | Action | Tool Call | Expected Outcome | 验证点 |
|------|--------|-----------|-----------------|--------|
| A.1 | 分析代码文件 | CLI: `node cli/code-analyzer.cjs src/utils.js` | 返回 AST 分析结果（函数列表、类列表、复杂度） | 输出包含 function/class 条目 |
| A.2 | 保存分析结果为 Atom 树 | `memory_write({abstract:"src/utils.js 代码分析", overview:"包含 5 个函数和 2 个类", content:"完整分析内容", type:"memory", tags:["code-analysis","utils"], atoms:[{local_id:"FN001",type:"function",name:"parseConfig()",content:"解析配置文件...",order:"a0",heading_level:2,parent_id:null},{local_id:"FN002",type:"function",name:"validateInput()",content:"验证输入参数...",order:"a1",heading_level:2,parent_id:null}]})` | 返回 success=true，localId 有效 | atoms 被正确存储 |
| A.3 | 验证 Atom 树结构 | `entity_atoms({entry_id:"<localId>", include_content:true})` | 返回树结构，2 个根 Atom（FN001, FN002） | 树深度、节点数正确 |
| A.4 | 搜索特定函数 | `memory_search({query:"parseConfig 函数", scope:"atom", atom_types:["function"]})` | 返回结果中包含 FN001 | Atom 粒度搜索有效 |
| A.5 | 读取函数 Atom 详情 | `memory_read({entry_id:"FN001"})` | 返回 `{type:"atom", local_id:"FN001", name:"parseConfig()", content:"解析配置文件..."}` | Atom 级别读取正确 |
| A.6 | 更新函数文档 | `entity_update({entry_id:"<entityId>", atoms_batch:[{action:"update", local_id:"FN001", content:"解析配置文件（支持 YAML 和 JSON 格式）..."}]})` | 返回 success=true | Atom 内容已更新 |
| A.7 | 验证更新结果 | `entity_atoms({entry_id:"<entityId>", include_content:true})` | FN001 的 content 包含 "YAML 和 JSON" | 更新持久化 |
| A.8 | 同步到后端 | `incremental_sync()` | 同步成功 | 后端可搜索到 FN001 |
| A.9 | 后端搜索验证 | `memory_search({query:"parseConfig YAML", scope:"atom"})` | 返回 FN001，score > 0 | 后端索引已更新 |

### 成功标准

- [ ] A.2 写入返回 success=true
- [ ] A.3 Atom 树结构与写入一致
- [ ] A.4 搜索结果包含目标 Atom
- [ ] A.5 读取返回正确的 Atom 详情
- [ ] A.6 更新返回 success=true
- [ ] A.7 更新后读取验证通过
- [ ] A.8 同步无错误
- [ ] A.9 后端搜索可找到更新后的内容

### 清理

```javascript
// 删除测试 Entity
entity_update({ entry_id: "<entityId>", atoms_batch: [{ action: "remove", local_id: "FN001", cascade: true }, { action: "remove", local_id: "FN002", cascade: true }] });
```

---

## Workflow B: 知识实体创建 → The Observer 萃取 → The Librarian 整合

**追溯**: DESIGN-INTEGRATION.md §任务 3.1 (Observer) + §任务 3.2 (Librarian)

### 用户故事

> 作为 OpenCode 用户，我在对话中讨论了 Vue 3 的响应式系统。The Observer 自动识别值得保存的信息并构建 Atom 树。之后 The Librarian 将碎片化记忆整合为一个高价值的知识实体。

### 步骤与预期

| Step | Action | Actor | Tool Call | Expected Outcome | 验证点 |
|------|--------|-------|-----------|-----------------|--------|
| B.1 | 用户对话讨论 Vue 3 响应式 | User | — | 对话包含 ref(), reactive(), computed() 等多个概念 | — |
| B.2 | Observer 分析对话并生成候选 | The Observer | `memory_search({query:"Vue 3 响应式系统", limit:5})` | 查重结果（避免重复保存） | 搜索执行无错 |
| B.3 | Observer 展示候选并等待确认 | The Observer | — | 展示 Atom 树结构候选（chapter: ref(), section: 用法, section: 注意事项） | 候选结构合理 |
| B.4 | 用户确认保存 | User | — | 用户选择 "Save all" | — |
| B.5 | Observer 保存 Atom 树 | The Observer | `memory_write({abstract:"Vue 3 响应式系统核心概念", overview:"涵盖 ref、reactive、computed 三大核心 API", content:"...", type:"memory", tags:["vue","reactivity"], atoms:[{local_id:"CH_REF",type:"chapter",name:"ref() 函数",content:"创建响应式引用...",order:"a0",heading_level:1,parent_id:null,children:[{local_id:"SEC_REF_USAGE",type:"section",name:"基本用法",content:"const count = ref(0)...",order:"a0",heading_level:2,parent_id:"CH_REF"},{local_id:"SEC_REF_NOTE",type:"note",name:"注意事项",content:"ref 需要 .value 访问...",order:"a1",heading_level:2,parent_id:"CH_REF"}]},{local_id:"CH_REACTIVE",type:"chapter",name:"reactive() 函数",content:"创建响应式对象...",order:"a1",heading_level:1,parent_id:null}]})` | 返回 success=true | Atom 树包含 2 个 chapter + 2 个 section/note |
| B.6 | 验证 Atom 树 | — | `entity_atoms({entry_id:"<localId>", include_content:true})` | 树结构正确，层级关系完整 | CH_REF 有 2 个 children |
| B.7 | 用户后续对话产生碎片记忆 | User | 多次 `memory_write` 保存碎片 | 3-5 个碎片记忆被创建 | 碎片存在 |
| B.8 | 触发 Librarian 整合 | User | `@memory-consolidate` | Librarian 扫描碎片 | — |
| B.9 | Librarian 识别相关碎片 | The Librarian | `memory_timeline({days:7, level:1})` + `memory_topics()` | 找到与 Vue 3 响应式相关的碎片 | 碎片被正确聚类 |
| B.10 | Librarian 创建整合节点 | The Librarian | `memory_write({abstract:"Vue 3 响应式系统完整指南", atoms:[整合 Atom 树]})` | 整合 Entity 创建成功 | 包含源碎片的信息 |
| B.11 | Librarian 建立溯源关系 | The Librarian | `memory_relate({from_id:"<整合 ID>", to_id:"<碎片 ID>", relation_type:"summarizes"})` | 关系创建成功 | — |
| B.12 | Librarian 置顶整合节点 | The Librarian | `memory_pin({entry_id:"<整合 ID>", action:"pin"})` | 整合节点被置顶 | — |

### 成功标准

- [ ] B.5 Observer 保存 Atom 树成功
- [ ] B.6 Atom 树结构与预期一致（2 chapters + 2 sections）
- [ ] B.7 碎片记忆被创建
- [ ] B.9 Librarian 正确识别相关碎片
- [ ] B.10 整合节点包含完整的 Atom 树
- [ ] B.11 溯源关系正确建立
- [ ] B.12 整合节点被置顶

### 清理

```javascript
// 取消置顶
memory_pin({ entry_id: "<整合 ID>", action: "unpin" });
// 删除测试数据（通过 API 或手动）
```

---

## Workflow C: 混合搜索 → 加载 Atom 上下文 → 构建 LLM Prompt

**追溯**: DESIGN-INTEGRATION.md §任务 3.4 — 上下文管理按 Atom 粒度；ATOM-ARCHITECTURE.md §5.2 memory_read

### 用户故事

> 作为 OpenCode Agent，用户询问 "Vue 3 中如何处理异步错误"。我需要搜索相关知识 → 精准加载相关 Atom → 在 token 预算内构建高质量上下文 → 生成回答。

### 步骤与预期

| Step | Action | Tool Call | Expected Outcome | 验证点 |
|------|--------|-----------|-----------------|--------|
| C.1 | 混合搜索知识库 | `memory_search({query:"Vue 3 异步错误处理", mode:"hybrid", scope:"all", limit:5, level:0})` | 返回 5 个结果，包含 Entity 和 Atom 级别 | 结果相关性高 |
| C.2 | 识别最相关的 Entity | — | 从搜索结果中找到最相关的 Entity（如 "Vue 3 错误处理最佳实践"） | Entity abstract 匹配 |
| C.3 | 渐进加载：先看 overview | `memory_read({entry_id:"<Entity ID>", level:1})` | 返回 abstract + overview，不含完整 content | 数据量小 |
| C.4 | 确认相关性后按预算加载 Atom | `load_context_budget({entry_id:"<Entity ID>", query:"异步错误处理", max_tokens:2000, strategy:"relevance"})` | 返回 ≤2000 tokens 的最相关 Atom 内容 | Token 预算不被超 |
| C.5 | 替代方案：按层级加载 | `load_context_level({entry_id:"<Entity ID>", max_level:2})` | 返回 H1 + H2 Atom 的内容，不含 H3 | 层级过滤正确 |
| C.6 | 精准读取特定 Atom | `memory_read({entry_id:"<目标 Atom ID>"})` | 返回 Atom 详情，包含 outgoing_links 和 incoming_links | 双向链接完整 |
| C.7 | 追踪链接到关联知识 | 对 outgoing_links 中的 target 逐个 `memory_read({entry_id:"<target>"})` | 获取关联 Atom 的内容 | 链接可追踪 |
| C.8 | 组装 LLM 上下文 | — | 将搜索结果 + Atom 内容组装为结构化 Prompt | Prompt 包含精准引用 `[[local_id]]` |

### 成功标准

- [ ] C.1 混合搜索返回 Entity + Atom 混合结果
- [ ] C.2 能从结果中识别最相关的知识
- [ ] C.3 level=1 加载不包含完整 content
- [ ] C.4 budget 加载在 token 预算内且内容相关
- [ ] C.5 level 加载正确过滤层级
- [ ] C.6 Atom 读取包含双向链接
- [ ] C.7 链接追踪可到达关联 Atom
- [ ] C.8 组装的上下文包含精准引用

### 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 搜索延迟 | < 500ms | 计时 C.1 |
| level=1 加载 | < 100ms | 计时 C.3 |
| budget 加载 (2000 tokens) | < 300ms | 计时 C.4 |
| Atom 读取 | < 50ms | 计时 C.6 |
| 上下文 Token 使用量 | 比加载完整 Entity 减少 > 30% | 对比 C.4 与全量加载 |

### 清理

无需清理（只读操作）

---

## Workflow D: 实体创建 → 循环引用防护 → 悬挂引用处理

**追溯**: ATOM-ARCHITECTURE.md §9 — 潜在风险与缓解措施

### 用户故事

> 作为开发者，我需要确保系统在异常操作（创建循环引用、删除被引用的 Atom）下不会数据损坏。

### 步骤与预期

| Step | Action | Tool Call | Expected Outcome | 验证点 |
|------|--------|-----------|-----------------|--------|
| D.1 | 创建合法 Entity | `memory_write({atoms:[{local_id:"A",parent_id:null},{local_id:"B",parent_id:"A"}]})` | success=true | — |
| D.2 | 尝试制造循环引用 | `entity_update({entry_id:"<id>", atoms_batch:[{action:"update",local_id:"A",parent_id:"B"}]})` | 返回错误："Circular reference detected" | 循环引用被阻止 |
| D.3 | 验证数据未被污染 | `entity_atoms({entry_id:"<id>"})` | 树结构未变，A 的 parent_id 仍为 null | 事务回滚成功 |
| D.4 | 删除被引用的 Atom | `entity_update({atoms_batch:[{action:"remove",local_id:"B"}]})` | success=true | B 被删除 |
| D.5 | 检查悬挂引用 | `entity_atoms({include_content:true})` | A 的 children 为空（B 已删除） | 树结构正确 |
| D.6 | 尝试自引用 | `entity_update({atoms_batch:[{action:"add",local_id:"C",parent_id:"C"}]})` | 返回错误 | 自环被阻止 |

### 成功标准

- [ ] D.1 合法创建成功
- [ ] D.2 循环引用被检测并阻止
- [ ] D.3 数据未被污染（事务性）
- [ ] D.4 删除操作正常
- [ ] D.5 树结构在删除后正确
- [ ] D.6 自引用被阻止

---

## 测试覆盖率矩阵

| Workflow | 覆盖工具 | 覆盖场景 | Steps | Success Criteria |
|----------|----------|----------|-------|-----------------|
| A: 代码分析链路 | memory_write, entity_atoms, memory_search, memory_read, entity_update, incremental_sync | 写入→搜索→读取→更新→同步 | 9 | 8 |
| B: Observer+Librarian | memory_search, memory_write, entity_atoms, memory_timeline, memory_topics, memory_relate, memory_pin | 萃取→整合→织网 | 12 | 7 |
| C: 上下文构建 | memory_search, memory_read, load_context_budget, load_context_level | 搜索→渐进加载→精准引用 | 8 | 8 |
| D: 异常防护 | memory_write, entity_update, entity_atoms | 循环引用→悬挂引用→事务回滚 | 6 | 6 |
| **合计** | **14 个工具** | **4 个场景** | **35** | **29** |

---

## 执行指南

### 环境准备

```bash
# 1. 确认后端运行
(Invoke-WebRequest -Uri http://localhost:18008/health).Content

# 2. 确认 API Key
$env:WRAPPER_MEILI_API_KEY  # 应有值

# 3. 运行 E2E 测试
node --experimental-vm-modules node_modules/.bin/jest tests/e2e/ -v
```

### 执行顺序

```
Workflow D (异常防护) → Workflow A (代码分析) → Workflow C (上下文构建) → Workflow B (Agent 工作流)
```

> D 优先执行：验证系统健壮性后，再执行功能测试。B 最后执行：依赖 Observer/Librarian Agent 行为。

### 失败处理

| 失败类型 | 处理方式 |
|----------|----------|
| 后端不可用 | 跳过涉及 sync 的步骤，记录为 SKIP |
| 工具返回错误 | 记录错误详情，标记对应 Step 为 FAIL |
| 数据不一致 | 截图当前状态，清理后重试一次 |
| Agent 行为不符预期 | 记录实际行为，标记为 OBSERVE（需人工判断） |

---

## 与评估指标的关系

| Workflow | 对应评估指标 | 数据采集方式 |
|----------|-------------|-------------|
| A | Atom 写入/读取成功率 | 测试 pass/fail 计数 |
| B | Atom 树自动构建率 | Observer 是否生成 Atom 树（0/1） |
| C | 上下文 Token 节省率 | 对比全量加载 vs budget 加载的 token 数 |
| D | 异常防护覆盖率 | 循环引用/悬挂引用测试通过率 |

详细评估方案见 [`../evaluation/DESIGN-EVALUATION.md`](../evaluation/DESIGN-EVALUATION.md)。

---

**维护者**: Atlas (执行者智能体)  
**更新频率**: 每 Phase 完成后
