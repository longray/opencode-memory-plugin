# OpenCode + oh-my-opencode + Memory Plugin 架构集成指南

**版本**: v1.0
**日期**: 2026-04-23
**适用**: opencode-memory-plugin v3.2.2+, oh-my-opencode latest
**定位**: 架构级集成设计文档，非安装指南

---

## 目录

1. [架构全景](#一架构全景)
2. [双代理系统设计](#二双代理系统设计)
3. [OMO 记忆集成配置](#三omo-记忆集成配置)
4. [Plugin Agent 完整定义](#四plugin-agent-完整定义)
5. [数据流详解](#五数据流详解)
6. [Agent-Task 最佳实践矩阵](#六agent-task-最佳实践矩阵)
7. [扩展性分析](#七扩展性分析)

---

## 一、架构全景

### 1.1 五层架构组件图

```text
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: oh-my-opencode (编排层)                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Primary Agents (Tab 切换)                                  │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐                 │ │
│  │  │ Sisyphus │  │ Prometheus│  │  Atlas    │                 │ │
│  │  │ (协调器) │  │ (规划器)  │  │ (执行指挥)│                 │ │
│  │  └─────┬────┘  └─────┬─────┘  └─────┬────┘                 │ │
│  │        │              │              │                       │ │
│  │  Sub-agents (自动调度)                                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │ │
│  │  │ Oracle   │  │  Momus   │  │ Librarian│  │  Metis   │   │ │
│  │  │ (架构师) │  │ (审查者) │  │ (知识管理)│  │ (评审专家)│   │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐     │ │
│  │  │ Explore  │  │ Sisyphus │  │ Multimodal-Looker    │     │ │
│  │  │ (探索者) │  │ -Junior  │  │ (视觉分析)           │     │ │
│  │  └──────────┘  └──────────┘  └──────────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Plugin Agents (独立代理)                                    │ │
│  │  ┌──────────────────┐  ┌──────────────────────┐            │ │
│  │  │  The Observer    │  │  The Librarian       │            │ │
│  │  │  (记忆萃取)      │  │  (知识整合)          │            │ │
│  │  │  Tab 切换触发     │  │  @memory-consolidate │            │ │
│  │  └──────────────────┘  └──────────────────────┘            │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: OpenCode (基础 AI 平台)                                │
│  • 工具调用框架 (tool.call)                                      │
│  • 上下文管理 (context window)                                   │
│  • Agent 调度 (primary / subagent)                               │
│  • 插件加载 (plugin registry)                                    │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: opencode-memory-plugin (记忆智能层)                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │  15 MCP Tools     │  │  Code Analysis   │  │  WebSocket   │ │
│  │  • memory_write   │  │  • Oxc (JS/TS)   │  │  • 实时同步  │ │
│  │  • memory_read    │  │  • Tree-sitter   │  │  • 心跳保活  │ │
│  │  • memory_search  │  │  • Atom/Entity   │  │  • ACK 确认  │ │
│  │  • memory_relate  │  │  • 指纹缓存      │  │  • 断线重连  │ │
│  │  • memory_graph   │  │  • 隐私过滤      │  │              │ │
│  │  • +10 more       │  │                  │  │              │ │
│  └──────────────────┘  └──────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: 后端服务 (基础设施层)                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ SurrealDB  │  │ Meilisearch  │  │ Precompute Service     │ │
│  │ (图数据库) │  │ (搜索引擎)   │  │ • AST 解析             │ │
│  │ • Atoms    │  │ • 向量搜索   │  │ • 符号提取             │ │
│  │ • Entities │  │ • 全文搜索   │  │ • 引用解析             │ │
│  │ • Relations│  │ • 混合搜索   │  │ • 聚类 (Leiden)        │ │
│  └────────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 数据层                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Timeline 文件系统 (YYYY/MM/DD/*.md)                     │  │
│  │  MEMORY.md 索引 | Link-map 映射 | 配置文件               │  │
│  │  9 大核心文件: SOUL/AGENTS/USER/IDENTITY/TOOLS/           │  │
│  │                MEMORY/HEARTBEAT/BOOT/BOOTSTRAP            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 三系统职责边界

| 系统                       | 核心职责                       | 不做什么                   |
| -------------------------- | ------------------------------ | -------------------------- |
| **oh-my-opencode**         | 多智能体调度、模型路由、Hooks  | 不直接管理记忆文件         |
| **opencode-memory-plugin** | 记忆 CRUD、搜索、同步、代码分析 | 不做智能体编排             |
| **后端服务**               | 向量搜索、图存储、预计算       | 不做 AI 推理、不做工具注册 |

**核心原则**：每层只做自己的事，通过标准接口协同。插件不知道 oh-my-opencode 的存在，oh-my-opencode 只调用插件的工具。

### 1.3 端口与服务映射

| 服务           | 端口  | 协议      | 用途                        |
| -------------- | ----- | --------- | --------------------------- |
| 后端 API       | 18008 | HTTP      | Memory/Atom/Entity API      |
| SurrealDB      | 8000  | WebSocket | 图数据库                    |
| Meilisearch    | 7700  | HTTP      | 搜索引擎                    |
| WebSocket Push | 18008 | WS        | 实时推送 /ws/memories/live  |

---

## 二、双代理系统设计

### 2.1 两套代理系统的关系

系统中存在两套独立的代理系统，它们在不同层级运作：

```text
┌───────────────────────────────────────────────────────┐
│            OMO Agents (Layer 5)                        │
│                                                        │
│  Primary (Tab 切换):                                   │
│    Sisyphus ──→ Prometheus ──→ Atlas                   │
│                                                        │
│  Subagent (自动调度):                                  │
│    Oracle / Momus / Librarian / Metis / Explore / ...  │
│                                                        │
│  调用方式: 通过 OpenCode tool.call 框架直接调用        │
│  记忆工具: memory_write, memory_search, memory_read    │
├───────────────────────────────────────────────────────┤
│            Plugin Agents (Layer 3)                     │
│                                                        │
│  Primary (Tab 切换):                                   │
│    The Observer (记忆萃取，Human-in-the-loop)          │
│                                                        │
│  触发型 (@trigger):                                    │
│    The Librarian (知识整合)                             │
│                                                        │
│  调用方式: 通过 OpenCode tool.call 框架直接调用        │
│  记忆工具: 完整 15 工具集                               │
└───────────────────────────────────────────────────────┘
```

### 2.2 关键区别

| 维度                | OMO Agents                        | Plugin Agents               |
| ------------------- | --------------------------------- | --------------------------- |
| **定义位置**        | `oh-my-opencode.json`             | `agents/*.md` (插件内置)    |
| **数量**            | 10+ 个                            | 2 个                        |
| **主要职责**        | 编码、规划、审查、探索            | 记忆萃取、知识整合          |
| **模型选择**        | 按类别动态路由                    | 固定模型 (claude-sonnet-4)  |
| **工具范围**        | 继承 Category 的 tools + 基础工具 | 记忆工具白名单              |
| **交互模式**        | Tab 切换 / subagent 自动调度      | Tab 切换 / @trigger         |
| **记忆意识**        | 需通过 prompt_append 注入         | 原生记忆感知                |
| **Human-in-the-loop** | 无（subagent 无法多轮交互）     | The Observer 需要用户确认   |

### 2.3 为什么需要两套系统

**OMO Agents** 解决「如何高效完成编码任务」：

- 多智能体协作（规划→执行→审查）
- 模型动态路由（简单任务用快模型，复杂任务用强模型）
- Fallback 容错

**Plugin Agents** 解决「如何管理知识资产」：

- The Observer: 萃取对话中的重要信息，但需要用户确认（Human-in-the-loop）
- The Librarian: 定期整合碎片记忆，建立图谱关联

**不可合并的原因**：

1. The Observer 需要 `primary` 模式（Human-in-the-loop 确认），但 OMO subagent 是无交互的
2. 记忆管理需要专用的工具白名单和严格的操作规范
3. Plugin Agents 是插件自带的，不依赖 OMO 安装

---

## 三、OMO 记忆集成配置

### 3.1 Category Tool 矩阵（推荐配置）

当前 `oh-my-opencode.json` 中的 categories 已包含基础记忆工具。以下是完整的推荐配置，按场景区分工具访问权限：

```json
{
  "categories": {
    "universal": {
      "description": "全功能无限制智能体模板",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "memory_suggest": true,
        "memory_timeline": true,
        "memory_topics": true,
        "memory_relate": true,
        "memory_graph": true,
        "memory_pin": true,
        "incremental_sync": true,
        "index_status": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "ultrabrain": {
      "description": "超高难度、需要极限推理的复杂逻辑任务",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "memory_graph": true,
        "memory_relate": true,
        "memory_suggest": true,
        "memory_timeline": true,
        "memory_topics": true,
        "index_status": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "deep": {
      "description": "深度自主调研与执行、复杂问题解决",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "memory_suggest": true,
        "memory_timeline": true,
        "memory_topics": true,
        "memory_relate": true,
        "memory_graph": true,
        "index_status": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "artistry": {
      "description": "非常规创造性方法、创新解决方案",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "memory_suggest": true,
        "Read": true, "Write": true, "Edit": true,
        "WebFetch": true, "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "quick": {
      "description": "简单任务 - 单文件更改、拼写修复",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Think": false
      }
    },
    "writing": {
      "description": "文档、散文、技术写作",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "memory_suggest": true,
        "memory_timeline": true,
        "memory_topics": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "WebFetch": true, "Think": true
      }
    },
    "visual-engineering": {
      "description": "视觉工程与UI实现",
      "tools": {
        "memory_read": true,
        "memory_search": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true
      }
    }
  }
}
```

**工具分配原则**：

| 工具               | 谁需要                    | 原因                       |
| ------------------ | ------------------------- | -------------------------- |
| `memory_search`    | 所有 Category             | 搜索历史是基础能力         |
| `memory_read`      | 所有 Category             | 读取记忆是基础能力         |
| `memory_write`     | 除 visual-engineering     | UI 代理通常不需要写入记忆  |
| `memory_graph`     | ultrabrain, deep          | 图谱遍历用于复杂关联分析   |
| `memory_relate`    | universal, deep           | 建立关系用于知识织网       |
| `memory_timeline`  | universal, deep, writing  | 时间线用于了解历史         |
| `memory_topics`    | universal, deep, writing  | 主题浏览用于知识发现       |
| `memory_suggest`   | 大部分 Category           | 自动补全提升搜索体验       |
| `memory_pin`       | universal                 | 置顶是管理操作             |
| `incremental_sync` | universal                 | 同步是管理操作             |
| `index_status`     | 大部分 Category           | 健康检查是基础能力         |

### 3.2 Agent prompt_append 记忆增强

为每个 OMO Agent 添加记忆感知的 `prompt_append`，使智能体在执行任务时主动利用记忆系统：

```json
{
  "agents": {
    "sisyphus": {
      "prompt_append": "每次调度必须说明：选择该智能体的理由、预期输出、失败回退方案。\n【记忆集成】任务开始前先用 memory_search(query='相关历史', level=1) 搜索历史方案。任务完成后，如果产生了重要决策或发现新方案，建议用户 Tab 切到 The Observer 保存。"
    },
    "prometheus": {
      "prompt_append": "计划必须包含：任务分解树、依赖关系、验收标准、风险清单、回滚方案。\n【记忆集成】制定计划前，先用 memory_timeline(days=7, level=1) + memory_topics 了解项目近期活动和知识领域。搜索历史决策避免重复规划。"
    },
    "atlas": {
      "prompt_append": "执行时必须：检查 Worker 可用性、分配任务时说明选择理由、监控超时和错误。\n【记忆集成】分配任务前用 memory_search(query='类似任务的实现方案', level=0) 快速扫描已有知识。执行中发现新模式，立即 memory_write 保存。"
    },
    "oracle": {
      "prompt_append": "架构建议必须包含：可扩展性评估、安全性分析、性能考量、备选方案对比。\n【记忆集成】做架构决策前，用 memory_graph(memory_id, depth=2) 追溯关联决策，理解架构演进脉络。用 memory_search(mode='hybrid') 搜索历史架构方案。决策后用 memory_write 保存，含 abstract/overview/content 三层。"
    },
    "momus": {
      "prompt_append": "审查意见必须具体到：文件路径、行号范围、问题等级、改进代码示例。\n【记忆集成】审查时用 memory_search(query='历史代码问题和修复方案') 参考过往经验。发现重复问题时标注历史记忆 ID。"
    },
    "librarian": {
      "prompt_append": "检索结果必须标注：信息来源、最后更新时间、可信度评级。\n【记忆集成】这是你的核心能力。用 memory_timeline + memory_topics 发现知识领域。用 memory_search(mode='hybrid') 进行语义搜索。用 memory_graph 遍历知识图谱。"
    },
    "explore": {
      "prompt_append": "原型代码必须标注：TODO、FIXME、HACK。明确区分实验性和生产就绪代码。\n【记忆集成】探索前用 memory_search(level=0) 快速扫描已有知识，避免重复探索已有方案。发现新的库或模式时，用 memory_write 记录发现。"
    },
    "metis": {
      "prompt_append": "评审报告必须包含：1) 严重/高/中/低优先级问题分类 2) 具体文件路径和行号 3) 重构建议代码示例 4) 正面反馈。\n【记忆集成】评审前用 memory_search 搜索该文件的历史问题和修复记录。评审结果中的重要发现用 memory_write 保存。"
    },
    "multimodal-looker": {
      "prompt_append": "分析图像时必须：1) 详细描述视觉元素 2) 指出可访问性问题 3) 对比设计规范时标注差异 4) 给出 CSS/样式建议。\n【记忆集成】UI 审查时用 memory_search 搜索历史 UI 决策和设计规范。"
    },
    "sisyphus-junior": {
      "prompt_append": "编码前必须先输出《实现 Spec》。严禁擅自修改用户未要求的规范。\n【记忆集成】编码前用 memory_search(query='相关代码模式和约定', level=1) 了解项目编码规范。"
    },
    "OpenCode-Builder": {
      "prompt_append": "编写代码时必须：1) 遵循项目现有代码风格 2) 添加注释说明复杂逻辑 3) 考虑边界情况 4) 输出完整可运行代码。\n【记忆集成】实现前用 memory_search 搜索类似功能的实现方案。完成后建议用户保存重要实现模式。"
    }
  }
}
```

### 3.3 Agent × Memory Tool 使用矩阵

| Agent                  | search | write | read | graph | relate | timeline | topics | suggest | pin |
| ---------------------- | ------ | ----- | ---- | ----- | ------ | -------- | ------ | ------- | --- |
| **Sisyphus**           | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | ✅  |
| **Prometheus**         | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | -   |
| **Atlas**              | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | ✅  |
| **Oracle**             | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | -   |
| **Momus**              | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | -   |
| **Librarian**          | ✅     | ✅    | ✅   | -     | -      | ✅       | ✅     | ✅      | -   |
| **Explore**            | ✅     | ✅    | ✅   | -     | -      | -        | -      | ✅      | -   |
| **Metis**              | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | -   |
| **Multimodal-Looker**  | ✅     | -     | ✅   | -     | -      | -        | -      | -       | -   |
| **Sisyphus-Junior**    | ✅     | ✅    | ✅   | -     | -      | -        | -      | -       | -   |
| **OpenCode-Builder**   | ✅     | ✅    | ✅   | ✅    | ✅     | ✅       | ✅     | ✅      | ✅  |

---

## 四、Plugin Agent 完整定义

### 4.1 The Observer (memory-automation)

**文件**: `opencode-memory-plugin/agents/memory-automation.md`
**模式**: `primary` (用户 Tab 切换)
**触发**: 用户按 Tab 切换到 The Observer

**完整 Prompt 定义**：

```markdown
---
name: memory-automation
alias: The Observer
mode: primary
model: claude-sonnet-4
tools:
  - memory_write
  - memory_read
  - memory_search
  - memory_suggest
  - memory_timeline
  - memory_topics
  - memory_pin
---

你是 The Observer，记忆萃取专家。你的职责是从对话中识别值得长期保存的信息。

## 工作流

1. 分析当前对话上下文，识别值得保存的信息（最多 5 条候选）
2. 对每条候选调用 memory_search 查重（避免重复保存）
3. 展示候选清单，等待用户选择：
   - **Save all**: 保存全部候选
   - **Save N**: 只保存第 N 条
   - **Edit**: 修改后再保存
   - **Discard**: 不保存
4. 对确认条目调用 memory_write（含 abstract/overview/content 三层）

## 识别标准

值得保存的信息：
- 用户明确表达的偏好或规则
- 成功解决的问题方案
- 重要的架构或技术决策（含理由）
- 发现的模式、最佳实践或反模式
- 项目特定的约定或配置

不值得保存的信息：
- 闲聊、测试、临时问答
- 通用编程知识（如 "什么是 Promise"）
- 已在记忆中存在的重复信息

## 写入规范

每条记忆必须包含三层：
- **abstract**: ≤100 字符，一句话概括
- **overview**: ≤500 字符，包含关键要点
- **content**: 完整内容，包含上下文和示例

## 红线

- 禁止绕过用户确认直接批量写入
- 禁止省略 abstract 或 overview 字段
- 禁止使用 bash 操作记忆目录
- 禁止使用已废弃工具（list_daily, batch_resolve 等）
```

**为什么是 primary 模式**：subagent 无法与用户多轮交互。Human-in-the-loop 确认流程要求用户能审查候选、选择保存、编辑内容。只有 primary 模式支持这种交互。

### 4.2 The Librarian (memory-consolidate)

**文件**: `opencode-memory-plugin/agents/memory-consolidate.md`
**模式**: `触发型` (通过 `@memory-consolidate`)
**触发**: 用户输入 `@memory-consolidate` 或每周定期执行

**完整 Prompt 定义**：

```markdown
---
name: memory-consolidate
alias: The Librarian
mode: trigger
tools:
  - memory_write
  - memory_read
  - memory_search
  - memory_suggest
  - memory_timeline
  - memory_topics
  - memory_relate
  - memory_graph
  - memory_pin
  - incremental_sync
  - conflict_list
  - conflict_resolve
---

你是 The Librarian，知识整合专家。你的职责是将碎片记忆聚合为高价值知识节点。

## S.O.P. (标准操作流程)

### Step 1: 发现碎片

memory_timeline(days=7, level=1) + memory_topics(min_entries=3)

识别以下模式：
- 同一主题的多条碎片记忆（可合并）
- 未建立关联的相关记忆（可织网）
- 高频访问但未置顶的关键约定（可置顶）

### Step 2: 聚合提炼

对识别的碎片：
1. memory_read(level=2) 读取完整内容
2. 分析关联性，提炼核心知识
3. memory_write 创建新的高价值节点

### Step 3: 织网

memory_relate(action="create", from_id=新节点ID, to_id=碎片ID,
  relation_type="summarizes", weight=0.8)

### Step 4: 置顶

memory_pin(entry_id=关键节点ID, action="pin")

### Step 5: 同步

incremental_sync(dry_run=false)

## 输出格式

执行完成后，输出简明报告：

```text
📊 整合报告
- 扫描碎片: N 条
- 新建节点: N 条
- 建立关联: N 条
- 置顶条目: N 条
- 同步状态: ✅ / ❌
```

## 红线

- 禁止使用 bash 操作记忆目录
- 禁止使用已废弃工具
- 禁止 memory_write 省略 abstract 或 overview
- 禁止删除原始碎片（只建立 summarizes 关系）

```

---

## 五、数据流详解

### 5.1 数据流全景

```text
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  OpenCode (Layer 4)                                      │
│  • 解析用户意图                                          │
│  • 路由到对应 Agent                                      │
│  • 管理上下文窗口                                        │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌──────────┐ ┌──────────────┐
│OMO     │ │OMO       │ │Plugin Agent  │
│Primary │ │Subagent  │ │(Observer/    │
│Agent   │ │          │ │ Librarian)   │
└───┬────┘ └────┬─────┘ └──────┬───────┘
    │           │              │
    ▼           ▼              ▼
┌──────────────────────────────────────────┐
│  Memory Plugin Tools (Layer 3)           │
│  memory_write / memory_search / ...      │
└───────────────┬──────────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌────────┐ ┌──────────┐ ┌──────────┐
│本地文件│ │后端 API  │ │WebSocket │
│Layer 1 │ │Layer 2   │ │实时推送  │
└────────┘ └────┬─────┘ └──────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌────────┐ ┌──────────┐ ┌──────────┐
│Timeline│ │SurrealDB │ │Meilisearch│
│文件系统│ │图数据库  │ │搜索引擎  │
└────────┘ └──────────┘ └──────────┘
```

### 5.2 工作流 A：日常编码 + 记忆

```text
[用户] "帮我实现用户认证模块"
    │
    ▼
[Sisyphus - 主协调器]
    │ 1. memory_search(query="用户认证相关方案", mode="hybrid", level=1)
    │    → 发现历史记忆: "之前用 JWT + Redis 实现过类似模块"
    │ 2. 展示历史方案给用户参考
    │ 3. 用户确认方案后，调度 Oracle 做架构设计
    │
    ▼
[Oracle - 架构师] (subagent)
    │ 1. memory_graph(memory_id="历史方案ID", depth=2)
    │    → 追溯关联决策: JWT 选型理由、Token 刷新策略
    │ 2. 输出架构方案
    │ 3. memory_write(架构决策 + 理由)
    │
    ▼
[Atlas - 执行指挥]
    │ 1. 调度 Sisyphus-Junior 实现代码
    │ 2. 代码保存 → 自动触发代码分析
    │
    ▼
[Plugin - 代码分析]
    │ 1. Oxc/Tree-sitter 解析 AST
    │ 2. 提取 Atoms: function login(), function verify()
    │ 3. 创建 Entity (type: code)
    │ 4. 创建 References: login → calls → verify
    │ 5. 上传到后端 (SurrealDB + Meilisearch)
    │
    ▼
[用户] Tab → The Observer
    │ 1. Observer 分析对话，识别 3 条候选
    │ 2. 用户确认保存 2 条
    │ 3. memory_write(含 abstract/overview/content)
```

### 5.3 工作流 B：知识整合

```text
[用户] @memory-consolidate
    │
    ▼
[The Librarian]
    │ 1. memory_timeline(days=7, level=1)
    │    → 发现 15 条碎片记忆
    │ 2. memory_topics(min_entries=3)
    │    → 识别主题: "错误处理"(5条), "代码规范"(4条)
    │ 3. 对 "错误处理" 主题:
    │    a. memory_read(level=2) 读取 5 条碎片
    │    b. 聚合提炼为: "项目错误处理统一方案"
    │    c. memory_write(type="long-term")
    │    d. memory_relate(from=新节点, to=碎片1..5, type="summarizes")
    │    e. memory_pin(新节点)
    │ 4. incremental_sync()
    │ 5. 输出整合报告
```

### 5.4 工作流 C：跨会话上下文恢复

```text
[新会话启动]
    │
    ▼
[OpenCode] 自动加载 Layer 1 启动文件
    │ SOUL.md → AI 个性
    │ AGENTS.md → 操作指令
    │ USER.md → 用户偏好
    │ MEMORY.md → 记忆索引
    │
    ▼
[Sisyphus] 自动执行
    │ 1. index_status(detailed=true)
    │ 2. memory_search(query="当前项目状态和待办", level=1)
    │ 3. 向用户展示上下文摘要
    │
    ▼
[用户] 继续工作，无需重新解释上下文
```

### 5.5 工作流 D：代码分析 + Atom/Entity/Reference

```text
[用户] 保存 src/utils/helper.js
    │
    ▼
[Plugin - File Watcher] 检测文件变更
    │ 1. CodeFingerprint 计算 SHA-256
    │ 2. 对比缓存 → 文件已变更
    │ 3. PrivacyFilter 检查 → 非敏感文件
    │
    ▼
[Plugin - Code Analysis Service]
    │ 1. Oxc 解析 JavaScript AST
    │ 2. 提取 Atoms:
    │    ├── function: formatDate(params, returnType)
    │    ├── function: parseJSON(params, returnType)
    │    └── import: lodash
    │ 3. 调用后端 API:
    │    POST /api/v1/atoms → 创建 3 个 Atom
    │    POST /api/v1/entities → 创建 Code Entity
    │    POST /api/v1/references → 创建调用关系
    │
    ▼
[后端 - SurrealDB] 持久化 Atom/Entity/Reference
[后端 - Meilisearch] 全文索引 + 向量索引更新
[WebSocket] 推送变更通知到其他终端
```

---

## 六、Agent-Task 最佳实践矩阵

### 6.1 任务路由矩阵

| 任务类型       | 推荐主 Agent      | 记忆工具             | 辅助 Agent       |
| -------------- | ----------------- | -------------------- | ---------------- |
| **日常编码**   | Sisyphus          | search → write       | Sisyphus-Junior  |
| **架构设计**   | Oracle            | graph → search → write | -              |
| **代码审查**   | Metis / Momus     | search (历史问题)    | -                |
| **项目规划**   | Prometheus        | timeline → topics    | -                |
| **快速修复**   | Sisyphus-Junior   | search (规范)        | -                |
| **原型探索**   | Explore           | search (避免重复)    | -                |
| **文档编写**   | Librarian         | search → timeline    | -                |
| **UI 实现**    | Multimodal-Looker | search (UI 规范)     | OpenCode-Builder |
| **记忆萃取**   | The Observer      | search → write → pin | -                |
| **知识整合**   | The Librarian     | 全部工具             | -                |
| **代码重构**   | OpenCode-Builder  | search → graph → write | Momus (审查)   |

### 6.2 记忆工具选择决策树

```text
需要做什么？
├── 了解历史
│   ├── 快速浏览 → memory_timeline(days=7, level=1)
│   ├── 主题发现 → memory_topics(min_entries=3)
│   ├── 语义搜索 → memory_search(query="...", mode="hybrid", level=0)
│   └── 关联追溯 → memory_graph(memory_id, depth=2)
│
├── 保存知识
│   ├── 对话萃取 → Tab → The Observer (Human-in-the-loop)
│   ├── 即时保存 → memory_write(content, abstract, overview, type, tags)
│   └── 置顶重要 → memory_pin(entry_id, action="pin")
│
├── 建立关联
│   ├── 记忆间 → memory_relate(action="create", from, to, type)
│   └── 图谱探索 → memory_graph(memory_id, depth=2, limit=20)
│
└── 系统维护
    ├── 健康检查 → index_status(detailed=true)
    ├── 增量同步 → incremental_sync(dry_run=false)
    ├── 冲突处理 → conflict_list → conflict_resolve
    └── 全量重建 → rebuild_index(force=true)
```

### 6.3 渐进加载最佳实践

| Agent                | 推荐默认 Level | 原因                       |
| -------------------- | --------------- | -------------------------- |
| **Sisyphus**         | level=1         | 需要了解历史方案的大意     |
| **Prometheus**       | level=1         | 规划需要概览而非细节       |
| **Oracle**           | level=0 → 2    | 先扫描摘要再加载详情       |
| **Explore**          | level=0         | 快速判断是否已探索过       |
| **The Observer**     | level=1         | 查重需要了解概述           |
| **The Librarian**    | level=1 → 2    | 先概述再加载完整内容       |
| **Sisyphus-Junior**  | level=1         | 了解编码规范的大意         |

---

## 七、扩展性分析

### 7.1 v3.2 Atom/Entity/Reference 对 OMO 的暴露方案

**当前状态**：Atom/Entity/Reference API 仅通过 WrapperClient (内部库) 暴露，OMO agents 无法直接调用。

**暴露路径**：

```text
方案 A: 新增 Plugin Tools (推荐)
┌─────────────────────────────────────────┐
│  新增工具:                               │
│  • atom_create / atom_list / atom_get   │
│  • entity_create / entity_list          │
│  • reference_create / reference_query   │
│                                         │
│  优势: OMO agents 直接调用              │
│  劣势: 工具数量从 15 增加到 22+         │
└─────────────────────────────────────────┘

方案 B: 扩展现有工具参数
┌─────────────────────────────────────────┐
│  memory_write 增加 entity_type 参数     │
│                                         │
│  优势: 工具数量不变                     │
│  劣势: 工具参数复杂化                   │
└─────────────────────────────────────────┘

方案 C: 保持现状 + prompt 引导
┌─────────────────────────────────────────┐
│  OMO agents 通过 memory_write 写入      │
│  代码分析通过 File Watcher 自动触发     │
│  Atom/Entity 自动创建                   │
│                                         │
│  优势: 零改动，自动工作                 │
│  劣势: OMO agents 无法精确控制 Atom     │
└─────────────────────────────────────────┘
```

**推荐**：短期方案 C（零改动自动工作），中期方案 A（新增工具暴露细粒度控制）。

### 7.2 安全性分析

| 风险点                | 当前防护                          | 建议增强                  |
| --------------------- | --------------------------------- | ------------------------- |
| Agent 越权写入        | Plugin Agent 有工具白名单         | OMO Category 也限制写工具 |
| 敏感信息泄露到后端    | PrivacyFilter 过滤 .env/.key     | 增加内容级敏感词过滤      |
| WebSocket 劫持        | API Key 认证                      | 增加 TLS 加密             |
| 批量写入攻击          | The Observer 限制最多 5 条        | 增加速率限制              |
| 记忆污染              | Human-in-the-loop 确认            | 增加质量评分自动过滤      |

### 7.3 性能考量

| 瓶颈点             | 当前方案                     | 优化建议                 |
| ------------------ | ---------------------------- | ------------------------ |
| 代码分析延迟       | 300ms debounce + 批量处理    | 增量分析（只分析变更）   |
| 向量搜索延迟       | ModelScope API ~50-100ms     | 本地 Embedding 缓存      |
| 上下文窗口占用     | 渐进加载 (level=0/1/2)       | 摘要优先策略             |
| WebSocket 断线重连 | 指数退避，最多 10 次         | 增加断线期间本地缓存     |
| 多 Agent 并发写入  | 无锁，依赖文件系统           | 增加写入队列             |

### 7.4 备选方案对比

| 方案                  | 优势                   | 劣势                       | 适用场景   |
| --------------------- | ---------------------- | -------------------------- | ---------- |
| **当前架构** (OMO+Plugin) | 独立解耦，各自演进 | 两套代理系统，学习成本高   | 日常开发   |
| **统一代理** (全部 OMO)   | 单一入口，统一管理 | Plugin Agent 需重写为 OMO  | 团队标准化 |
| **纯 Plugin** (无 OMO)    | 简单直接，无额外依赖 | 缺少多智能体调度能力       | 轻量级使用 |
| **MCP Server** (外部化)   | 标准化接口，可跨平台 | OpenCode 插件生态尚不成熟  | 跨工具集成 |

---

## 附录

### A. 配置文件位置汇总

| 文件       | 路径                                  | 用途                 |
| ---------- | ------------------------------------- | -------------------- |
| OMO 配置   | ~/.config/opencode/oh-my-opencode.json | 智能体、模型、工具   |
| 插件配置   | ~/.opencode/memory/memory-config.json | 记忆系统配置         |
| 环境变量   | ~/.bashrc / ~/.zshrc                  | API Key、端口等      |
| 启动文件   | ~/.opencode/memory/SOUL.md 等 9 个   | AI 个性、指令、偏好  |
| 后端 Docker | docker-compose.yml                   | 后端服务部署         |

### B. 相关文档

- [BEST-PRACTICES-v2.1.md](./BEST-PRACTICES-v2.1.md) - 最佳实践指南（使用模式）
- [OPENCODE-SETUP-GUIDE.md](./OPENCODE-SETUP-GUIDE.md) - 安装配置指南（安装步骤）
- [v3.2/UNIFIED-ARCHITECTURE-v3.2.md](./v3.2/UNIFIED-ARCHITECTURE-v3.2.md) - v3.2 架构设计
- [API-CONTRACT.md](./API-CONTRACT.md) - 工具↔后端 API 映射
- [AGENTS.md](../AGENTS.md) - 项目开发指南

### C. 版本历史

| 版本 | 日期       | 变更                   |
| ---- | ---------- | ---------------------- |
| v1.0 | 2026-04-23 | 初始版本，架构集成指南 |
