# OpenCode + oh-my-opencode 生活指南

> **版本**: v1.0
> **更新时间**: 2026-04-23
> **适用**: opencode-memory-plugin v3.2+ / oh-my-opencode
> **视角**: 用户日常使用流程（不是配置文档）

---

## 前言：这不是一篇配置文档

你已经有了 `oh-my-opencode.json`，有了 12 个智能体，有了 15 个记忆工具。
你可能已经读过 [OPENCODE-SETUP-GUIDE.md](./OPENCODE-SETUP-GUIDE.md)（Option A）——
那份文档回答了「怎么装」，但没回答「怎么用」。

**这篇文档回答的是后者。**

想象一下：你早上打开 OpenCode，面对一个需要 3 天完成的 feature，
这篇文档会带你走完一整天的工作流——从开机到下班，
从编码到记忆，从查资料到做决策。

---

## 目录

1. [早间启动：5 分钟检查清单](#一早间启动5-分钟检查清单)
2. [编码实战：一个完整的 Sisyphus 工作流](#二编码实战一个完整的-sisyphus-工作流)
3. [记忆捕获：The Observer 的正确打开方式](#三记忆捕获the-observer-的正确打开方式)
4. [知识整合：每周五的 Librarian 仪式](#四知识整合每周五的-librarian-仪式)
5. [两个 Librarian 的区别（重要）](#五两个-librarian-的区别重要)
6. [进阶技巧：Atom / Entity / Reference 什么时候用](#六进阶技巧atom--entity--reference-什么时候用)
7. [常见决策树](#七常见决策树)
8. [速查表](#八速查表)

---

## 一、早间启动：5 分钟检查清单

每天早上打开 OpenCode 时，做这 5 件事：

### 步骤 1：检查后端是否活着

````
你: index_status detailed=true
````

预期输出：

````
✅ 后端服务: localhost:18008 正常
✅ Meilisearch: 已连接
✅ SurrealDB: 已连接
📊 本地条目数: 43
📊 后端条目数: 43
🔄 待同步: 0
````

如果看到「后端不可用」：
- Docker 没启动？→ `docker-compose up -d`
- 端口不对？→ 确认是 18008（不是旧版 17999）
- API Key 没设？→ 检查环境变量 `WRAPPER_MEILI_API_KEY`

### 步骤 2：加载昨天的上下文

````
你: memory_timeline days=1 level=1
````

这会给你一个快速摘要，看看昨天做了什么。
不需要 level=2（完整内容），level=1（Abstract + Overview）足够回忆上下文。

### 步骤 3：搜索当前项目相关记忆

````
你: memory_search query="当前项目的关键决策和进行中的任务" mode=hybrid level=0
````

level=0 只返回 Abstract，一扫而过。找到感兴趣的再 `memory_read(entry_id=xxx, level=2)`。

### 步骤 4：看一下有什么智能体可用

OpenCode 底部状态栏会显示当前智能体。
按 **Tab** 可以在 primary 智能体之间切换：

| 按 Tab | 切换到 | 用途 |
|--------|--------|------|
| → | Sisyphus | 主协调器，分配任务 |
| → | Prometheus | 规划器，制定计划 |
| → | Atlas | 执行指挥，调度工人 |
| → | The Observer | 记忆观察者，捕获知识 |

subagent（如 Oracle、Momus、Explore）不通过 Tab 切换，而是由 Sisyphus 通过 Task 工具调度。

### 步骤 5：告诉 Sisyphus 今天要做什么

````
你: 我今天要给 memory plugin 加一个新功能：代码变更检测。
    当文件保存时，自动检测哪些函数被修改了。
````

Sisyphus 会接管——它会：
1. 调用 `memory_search` 搜索历史方案
2. 把任务交给 Prometheus 做规划
3. 按规划把子任务分给 Atlas 执行

**你只需要坐在旁边看，在关键决策点点头或摇头。**

---

## 二、编码实战：一个完整的 Sisyphus 工作流

让我们用一个真实场景走一遍：

> **任务**：给 memory plugin 加上「文件变更指纹」功能——当文件保存时，通过 SHA-256 指纹检测哪些文件被修改了，只对修改过的文件做代码分析。

### 第 1 幕：Sisyphus 接单

````
你: 给 code-fingerprint.js 加一个功能：保存文件时计算 SHA-256 指纹，
    和上次的指纹对比，只对修改过的文件触发分析。
````

Sisyphus 的内部流程（你不需要手动执行，它自动完成）：

````
Sisyphus: [memory_search] query="code-fingerprint SHA-256 变更检测"
Sisyphus: 找到了 2 条相关记忆：
         - "CodeFingerprint 类已实现基础指纹功能"
         - "代码分析触发条件：300ms debounce"
Sisyphus: [调度 Prometheus] 制定实施计划
````

### 第 2 幕：Prometheus 规划

Prometheus 被 Sisyphus 调度（作为 subagent），它会：

````
Prometheus: 制定计划：
1. 在 CodeFingerprint 类中添加 compareFingerprint() 方法
2. 修改 file-watcher.js，在文件保存时调用指纹对比
3. 只对指纹变化的文件触发 code-analyzer
4. 添加指纹缓存持久化（可选）

验收标准：
- 文件内容不变时不触发分析
- 文件内容变化时正常触发
- 指纹缓存可以持久化到 memory-config.json
````

Prometheus 把计划交给 Sisyphus，Sisyphus 确认后进入执行。

### 第 3 幕：Atlas 执行

Atlas 被 Sisyphus 调度，它会分派工人去写代码：

````
Atlas: [调度 OpenCode-Builder] 实现 compareFingerprint() 方法
Atlas: [调度 Sisyphus-Junior] 修改 file-watcher.js 的触发逻辑
Atlas: [调度 Momus] 代码审查
````

每个工人专注于自己的任务，完成后报告给 Atlas。

### 第 4 幕：Momus 审查

Momus 被调用来做代码审查：

````
Momus: 审查 file-watcher.js 变更：
- ⚠️ 第 42 行：fingerprintCache 可能未初始化就使用
  → 建议添加空值检查
- ✅ SHA-256 计算使用 Node.js crypto 模块，正确
- ✅ debounce 逻辑保持不变
````

### 第 5 幕：记忆保存

**这里有一个关键问题：Sisyphus 会自动保存记忆吗？**

**答案：取决于配置。** 看你的 `oh-my-opencode.json`：

```json
"categories": {
  "universal": {
    "tools": {
      "memory_write": true,   // ✅ Sisyphus 有记忆权限
      "memory_search": true   // ✅ Sisyphus 会搜索记忆
    }
  }
}
```

你的配置里 `memory_write: true`，所以 Sisyphus **可以**自动保存。
但它不会把所有东西都存——它遵循「智能过滤」原则：
只存项目特定、非显而易见、有决策价值的信息。

---

## 三、记忆捕获：The Observer 的正确打开方式

### 什么时候用 The Observer？

**不是「每次对话后都切过去」。**

The Observer 适合这些场景：
- 你和 Sisyphus 做了一个重要技术决策
- 你发现了一个反复出现的问题模式
- 你确立了新的编码规范
- 你解决了一个很难的 bug

**不适合这些场景：**
- 日常闲聊
- 简单的代码修改（改个 typo）
- 通用编程问题（怎么用 git rebase）

### 实操流程

**步骤 1：完成一次有价值的对话后，按 Tab 切到 The Observer**

````
[Tab] → 切到 The Observer
````

**步骤 2：Observer 分析对话并输出候选**

Observer 会调用 `memory_search` 做查重，然后输出：

````
🧠 **记忆候选（可直接保存）**

**[1] 类型: preference**

- Abstract: 文件变更检测使用 SHA-256 指纹 + JSON 序列化
- Overview: CodeFingerprint 使用 SHA-256 hash JSON.stringify(astNodes) 作为指纹，
  对比前后指纹决定是否触发分析。缓存存储在 ~/.opencode/memory/fingerprint-cache.json
- Tags: code-analysis, fingerprint, sha256

**[2] 类型: code**

- Abstract: fingerprint cache 持久化方案：写入 timeline 目录
- Overview: 指纹缓存不存 JSON 配置，而是存入 timeline/YYYY/MM/DD/ 目录，
  和其他记忆文件一起同步。好处是自动跟随 incremental_sync 流程
- Tags: architecture, storage, sync

---

回复保存：输入 "Save 1" 或 "Save all" 或 "Discard"
````

**步骤 3：你做决定**

````
你: Save 1, Discard 2
````

**为什么 Discard 2？** 因为 Observer 只是提出候选，你才是决策者。
可能你觉得方案 2 还不够成熟，或者需要再验证。

**步骤 4：主代理执行保存**

Observer 没有配置 `memory_write` 工具——这是设计上的安全措施。
主代理（Sisyphus 或你当前的 primary 智能体）会执行实际的 `memory_write`。

**步骤 5：按 Tab 切回工作智能体**

````
[Tab] → 切回 Sisyphus（或你之前的智能体）
````

### Observer 的过滤规则

你不需要管这些，但了解一下有助于理解为什么有些东西没被提出。

Observer 会**自动拒绝**以下内容：
- 通用教程（怎么用 git）
- 常见错误 + 常见修复
- 通用最佳实践（「写测试」「用 TypeScript」）
- 复述对话（换个说法重复一遍）
- 30 秒内 Google 能找到答案的内容

**终极判断标准**：如果 Google 30 秒内能找到同样质量的答案 → 拒绝。

### 「隐式发现」功能

Observer 还会观察你的**行为模式**，而不只是你说了什么：

````
⚠️ **需要确认的隐式发现**

**[A] 观察到的行为模式：**
- 你在第 3 轮手动删掉了 JSDoc 注释
- 第 7 轮又删了
- 第 12 轮 Sisyphus 自动加了注释，你又删了

**[B] 推断的用户偏好：**
- 你可能不喜欢函数内部的详细 JSDoc 注释，只保留简短说明

**是否需要保存？**
- 保存 A → "Save A"
- 保存 B → "Save B"
- 不保存 → "Discard"
````

---

## 四、知识整合：每周五的 Librarian 仪式

### 什么时候用 Librarian？

The Librarian（`@memory-consolidate`）是一个 subagent。
你**不需要**每天用，但建议每周五做一次。

````
你: @memory-consolidate
````

### Librarian 做什么？

Librarian 执行一个固定的 S.O.P.（标准操作流程）：

**Step 1：发现碎片**

````
Librarian: [memory_timeline days=7 level=1]
Librarian: [memory_topics]
````

它会找出过去 7 天的碎片记忆——比如：
- 3 条关于 Docker 配置的 debug 记录
- 2 条关于数据库迁移的临时笔记
- 5 条关于测试失败的排查过程

**Step 2：聚合提炼**

把这些碎片合成一条高价值节点：

````
Librarian: [memory_write]
  type: "long-term"
  abstract: "Docker Compose 多阶段构建最佳实践"
  overview: "基于 3 次 debug 经验总结..."
  content: "完整最佳实践（包含 build stage、runtime stage、health check）..."
````

**Step 3：建立关联**

````
Librarian: [memory_relate action=create]
  from_id: [新节点ID]
  to_id: [碎片1 ID]
  relation_type: "summarizes"
Librarian: [memory_relate action=create]
  from_id: [新节点ID]
  to_id: [碎片2 ID]
  relation_type: "summarizes"
Librarian: [memory_relate action=create]
  from_id: [新节点ID]
  to_id: [碎片3 ID]
  relation_type: "summarizes"
````

这样就从「散落的碎片」变成了「织网的知识」。

**Step 4：置顶重要条目**

````
Librarian: [memory_pin entry_id=xxx action=pin]
````

关键的项目约定会被置顶，确保未来的对话自动加载。

**Step 5：静默同步**

````
Librarian: [incremental_sync dry_run=false]
````

### Librarian 的输出

````
📚 **Memory Consolidation Complete**

我分析了最近 7 天的记忆，合成了以下知识图谱：

**1. Docker Compose 多阶段构建最佳实践** (ID: 01HXYZ...)

- 汇总了 3 条碎片 debug 记录
- 置顶: 是 📌
- 创建关联: 3

**2. SurrealDB 迁移注意事项** (ID: 01HABC...)

- 汇总了 2 条临时笔记
- 置顶: 否
- 创建关联: 2

**同步状态**: 增量同步已完成。
````

---

## 五、两个 Librarian 的区别（重要）

这是最容易搞混的地方。

### OMO 的 Librarian（oh-my-opencode 配置里的）

```json
"agents": {
  "librarian": {
    "model": "alibaba-coding-plan-cn/kimi-k2.5",
    "description": "知识管理 - 文档检索与信息整理",
    "mode": "subagent",
    "prompt": "你是 Librarian，知识管理专家。擅长文档检索、信息整理、知识库构建。"
  }
}
```

**这是什么**：OMO 框架里的通用知识管理智能体。

- **用途**：文档检索、信息整理、知识库构建
- **能力**：有 WebFetch、有 Bash、有 Read/Write/Edit
- **触发**：由 Sisyphus 调度
- **记忆**：有 `memory_search`/`memory_read`/`memory_write` 权限

### Plugin 的 Librarian（The Librarian / @memory-consolidate）

```yaml
# opencode-memory-plugin/agents/memory-consolidate.md
mode: subagent
model: anthropic/claude-haiku-4
tools:
  memory_write: true
  memory_read: true
  memory_search: true
  memory_relate: true
  memory_graph: true
  memory_pin: true
  bash: false    # ⬅️ 不能操作文件系统
  write: false   # ⬅️ 不能写文件
  edit: false    # ⬅️ 不能编辑文件
```

**这是什么**：Memory Plugin 专用的记忆整合智能体。

- **用途**：整合碎片记忆 → 建立图谱关联 → 置顶关键条目
- **能力**：只能操作记忆工具（memory_*），不能操作文件系统
- **触发**：`@memory-consolidate` 或手动调度
- **限制**：没有 Bash、Read、Write、Edit（安全隔离）

### 什么时候用哪个？

| 场景 | 用 OMO Librarian | 用 Plugin Librarian |
|------|------------------|---------------------|
| 搜索项目文档 | ✅ | ❌ 没有文件访问权限 |
| 整合记忆碎片 | ❌ 不是它的职责 | ✅ 核心功能 |
| 建立知识图谱 | ❌ 没有记忆图谱工具 | ✅ 有 memory_relate/graph |
| 整理外部资料 | ✅ 有 WebFetch | ❌ 没有 WebFetch |
| 定期清理记忆 | ❌ 不能操作记忆文件 | ✅ 专门的 S.O.P. |

**简单记忆**：

- **OMO Librarian** = 通用图书管理员，什么书都能找
- **Plugin Librarian** = 记忆专属馆员，只管记忆的整理和织网

它们是互补关系，不是竞争关系。

---

## 六、进阶技巧：Atom / Entity / Reference 什么时候用

v3.2 引入了 Atom/Entity/Reference 三层架构。
你可能不需要每天用，但了解它有助于做出更好的架构决策。

### 概念速览

````
Entity（实体）
├── Memory（记忆条目） ← 你日常用 memory_write 创建的
├── Backlog（任务） ← 通过后端 API 创建的任务
├── Wiki（知识页面） ← 通过后端 API 创建的文档
└── Code（代码文件） ← 自动分析生成的代码实体

Entity 包含 Atom（原子单元）：
├── Function（函数）
├── Class（类）
├── Interface（接口）
├── Goal（目标）
├── Task（任务）
└── Note（笔记）

Atom 和 Entity 之间通过 Reference（关系）连接：
├── calls（函数调用）
├── imports（模块导入）
├── implements（实现）
├── depends_on（依赖）
├── relates_to（关联）
└── summarizes（汇总）
````

### 什么时候用 Atom？

**你通常不需要手动创建 Atom。** Atom 是代码分析自动提取的：

````
你保存一个 .js 文件
    ↓
file-watcher 检测到变更（300ms debounce）
    ↓
code-analyzer.js 分析 AST
    ↓
提取出 Function Atom、Class Atom
    ↓
自动上传到后端（如果 use_atom_entity_api=true）
````

**当你需要手动操作 Atom 时**：

- 你发现自动分析遗漏了一个函数 → 手动调用后端 API 创建
- 你需要查询某个函数被谁调用 → 通过 `memory_graph` 遍历关系

### 什么时候用 Entity？

**日常的 `memory_write` 就是在创建 Memory 类型的 Entity。**

你不需要切换思维模式——`memory_write` 仍然是主要的记忆操作方式。

Entity 更有用的场景是通过后端 API：

- 创建 Backlog Entity → 管理任务
- 创建 Wiki Entity → 构建知识库
- 创建 Code Entity → 关联代码文件和 Atom

### 什么时候用 Reference？

**关系是知识图谱的核心。** 两种创建方式：

**1. 记忆条目之间（Plugin Librarian 最常用）**：

````
memory_relate action=create from_id=xxx to_id=yyy relation_type=summarizes
````

**2. 代码元素之间（自动或手动）**：

````
# 自动：代码分析时自动创建 calls/imports 关系
# 手动：通过后端 API 创建 implements/depends_on 关系
````

### 一张图总结

````
你的日常工作                    v3.2 自动层
────────────                    ────────────
memory_write()          →       创建 Memory Entity
保存 .js/.ts 文件       →       提取 Function/Class Atom
保存 .py/.go/.rs 文件   →       提取 Atom（基础支持）
memory_relate()         →       创建 Entity-Entity 关系
代码分析                 →       创建 Atom-Atom 关系（calls/imports）
@memory-consolidate     →       创建 summarizes 关系 + 聚合
````

---

## 七、常见决策树

### 「memory_search 还是 memory_graph？」

````
需要查找信息？
├── 找「某个话题的相关记忆」
│   → memory_search(query="Docker 配置", mode=hybrid)
│
├── 找「和某个条目相关联的其他条目」
│   → memory_graph(memory_id=xxx, depth=2)
│
├── 找「某个函数被谁调用了」（代码层面）
│   → memory_graph(memory_id=xxx, depth=1)  # 需要先有 Atom
│
└── 不确定？
    → 先 memory_search 找到起点，再 memory_graph 向外扩展
````

**经验法则**：

- `memory_search` = 用自然语言找东西（「之前我们怎么处理 X 的？」）
- `memory_graph` = 从一个已知点出发探索关联（「这个决策还影响了什么？」）

### 「Sisyphus 在用我的记忆吗？」

检查方式：

1. 看对话中是否有 `memory_search` 调用
2. 如果 Sisyphus 在规划前没有搜索记忆 → 它可能忘了

**如何确保**：

- 在 `oh-my-opencode.json` 中确认 `memory_search: true`
- 如果 Sisyphus 还是没用 → 在任务描述中提示：「先搜索记忆」

### 「什么时候该用 level=0 / level=1 / level=2？」

````
浏览场景（快速扫描）
├── memory_timeline(days=7, level=1)   # 看日期摘要
├── memory_topics(level=1)             # 看主题分布
└── memory_search(query=..., level=0)  # 扫描结果列表

深读场景（需要细节）
├── memory_read(entry_id=xxx, level=2) # 读取完整内容
└── memory_search(query=..., level=1)  # 先看 Overview 再决定

经验法则：
- 扫描用 level=0（只要 Abstract）
- 确认用 level=1（Abstract + Overview）
- 深读用 level=2（完整内容）
- 永远不要在 memory_search 中默认 level=2（数据量太大）
````

### 「我应该手动 memory_write 还是让 Observer 做？」

````
明确想记住 something？
├── "请记住：项目用 Oxlint 替代 ESLint"
│   → 直接 memory_write（或让主代理自动保存）
│
├── 做完了一个重要决策，但没说「请记住」
│   → Tab 切到 Observer，让它分析
│
├── 闲聊中发现了一个模式
│   → Observer 的「隐式发现」会捕捉
│
└── 日常编码中的小发现
    → 不需要保存（Observer 会自动过滤）
````

### 「增量同步还是完整同步？」

````
日常使用
├── 每次 memory_write 后自动 incremental_sync
│   → 默认行为，不需要手动操作
│
├── 搜索结果不准
│   → rebuild_index force=true
│
├── 迁移/修复后
│   → full_sync（会批量处理所有条目）
│
└── 冲突了
    → conflict_list → conflict_resolve
````

---

## 八、速查表

### 智能体分工

| 智能体 | 角色 | 什么时候用 | Tab 可切？ |
|--------|------|-----------|-----------|
| **Sisyphus** | 主协调器 | 接收任务、分配工作 | ✅ Primary |
| **Prometheus** | 规划器 | 复杂任务需要拆解 | ✅ Primary |
| **Atlas** | 执行指挥 | 开始编码 | ✅ Primary |
| **Oracle** | 架构师 | 技术选型、系统设计 | ❌ Subagent |
| **Momus** | 审查者 | 代码审查、质量诊断 | ❌ Subagent |
| **OMO Librarian** | 知识管理 | 文档检索、信息整理 | ❌ Subagent |
| **Explore** | 探索者 | 快速原型、实验性开发 | ❌ Subagent |
| **The Observer** | 记忆观察者 | 捕获对话中的知识 | ✅ Primary |
| **Plugin Librarian** | 记忆馆员 | 整合碎片记忆 | ❌ Subagent |

### 记忆工具速查

| 工具 | 一句话说明 | 常用参数 |
|------|-----------|----------|
| `memory_write` | 保存记忆 | content, abstract, overview, tags, pinned |
| `memory_read` | 读取记忆 | entry_id, level (0/1/2) |
| `memory_search` | 搜索记忆 | query, mode (hybrid/vector/keyword), level |
| `memory_suggest` | 自动补全 | prefix, limit |
| `memory_timeline` | 按日期浏览 | days, level |
| `memory_topics` | 按主题浏览 | min_entries |
| `memory_relate` | 建立关系 | action, from_id, to_id, relation_type |
| `memory_graph` | 遍历图谱 | memory_id, depth, limit |
| `memory_pin` | 置顶/取消 | entry_id, action (pin/unpin) |
| `index_status` | 系统状态 | detailed |
| `incremental_sync` | 增量同步 | dry_run |
| `rebuild_index` | 重建索引 | force |

### 搜索模式选择

| 模式 | 场景 | 质量 | 速度 |
|------|------|------|------|
| `hybrid` | 日常搜索（默认） | ⭐⭐⭐ | 中 |
| `vector` | 语义模糊搜索 | ⭐⭐ | 中 |
| `keyword` | 精确匹配（变量名、错误码） | ⭐⭐ | 快 |
| `hash` | ID 查找 | ⭐ | 极快 |

### 端口参考

| 服务 | 端口 | 备注 |
|------|------|------|
| 后端 API | 18008 | v3.2+ 新端口 |
| SurrealDB | 8000 | 图数据库 |
| Meilisearch | 7700 | 搜索引擎 |

---

## 附录：环境变量速查

```powershell
# 必需
$env:WRAPPER_MEILI_API_KEY = "your-api-key"     # 后端认证
$env:MODELSCOPE_API_KEY = "your-key"             # Embedding 服务（推荐 ModelScope）

# 可选
$env:API_PORT = "18008"                          # 后端端口（默认 18008）
$env:OPENCODE_HOME = "$env:USERPROFILE\.opencode"
$env:OPENCODE_CONFIG = "$env:USERPROFILE\.config\opencode"
```

---

## 相关文档

- [Option A: 配置指南](./OPENCODE-SETUP-GUIDE.md) — 安装和配置详解
- [API 契约](./API-CONTRACT.md) — 工具↔后端 API 映射
- [v3.2 统一架构](./v3.2/UNIFIED-ARCHITECTURE-v3.2.md) — Atom/Entity/Reference 设计
- [最佳实践](./BEST-PRACTICES-v2.1.md) — 深度使用建议
- [插件快速入门](../opencode-memory-plugin/QUICK_START.md) — 插件安装和基础使用

---

_祝编码愉快。记住——让记忆替你干活，而不是你替记忆干活。_ 🧠
