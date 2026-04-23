# OpenCode + oh-my-opencode + Memory Plugin 综合配置指南

**版本**: v2.0 (Merged Edition)  
**更新时间**: 2026-04-23  
**适用**: opencode-memory-plugin v3.2.0+, oh-my-opencode latest  
**基于**: 真实配置文件逆向分析 + 架构集成设计  

---

## 目录

1. [Executive Summary](#一executive-summary)
2. [Architecture Overview](#二architecture-overview)
3. [Current Environment Analysis](#三current-environment-analysis)
4. [Quick Start: Day in the Life](#四quick-start-day-in-the-life)
5. [Detailed Configuration](#五detailed-configuration)
6. [Agent Configuration](#六agent-configuration)
7. [Workflow Examples](#七workflow-examples)
8. [Decision Trees](#八decision-trees)
9. [Verification & Troubleshooting](#九verification--troubleshooting)
10. [Appendix](#十appendix)

---

## 一、Executive Summary

### 1.1 这是什么？

你已经有了 OpenCode，有了 oh-my-opencode (OMO) 的 12 个智能体，有了 opencode-memory-plugin 的 15 个记忆工具。

**这篇文档回答三个问题：**

1. **现状是什么？** —— 你的配置有哪些问题需要修复
2. **怎么升级？** —— 从 v2.x 工具升级到 v3.2+ 的完整步骤
3. **怎么用？** —— 从早上开机到下班的完整工作流

### 1.2 核心价值主张

| 能力 | 价值 |
|------|------|
| **完美记忆** | 跨会话保持上下文，不再重复解释 |
| **智能检索** | 语义搜索找到你忘记存在的知识 |
| **自动萃取** | The Observer 帮你捕获重要信息 |
| **知识整合** | The Librarian 定期聚合碎片 |
| **代码分析** | 保存文件时自动分析 AST |

### 1.3 五层架构速览

```text
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: OMO 编排层 (Sisyphus/Prometheus/Atlas/...)         │
│ Layer 4: OpenCode 平台 (工具调用/Agent 调度)                │
│ Layer 3: Memory Plugin (15 MCP Tools + Code Analysis)       │
│ Layer 2: 后端服务 (SurrealDB + Meilisearch + WebSocket)     │
│ Layer 1: 数据层 (Timeline 文件系统 + 9 大核心文件)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Architecture Overview

### 2.1 五层架构详解

```text
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: oh-my-opencode (编排层)                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Primary Agents (Tab 切换)                                   ││
│  │  ┌──────────┐  ┌───────────┐  ┌──────────┐                  ││
│  │  │ Sisyphus │  │ Prometheus│  │  Atlas    │                  ││
│  │  │ (协调器) │  │ (规划器)  │  │ (执行指挥)│                  ││
│  │  └─────┬────┘  └─────┬─────┘  └─────┬────┘                  ││
│  │        │              │              │                        ││
│  │  Sub-agents (自动调度)                                         ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    ││
│  │  │ Oracle   │  │  Momus   │  │ Librarian│  │  Metis   │    ││
│  │  │ (架构师) │  │ (审查者) │  │ (知识管理)│  │ (评审专家)│    ││
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐      ││
│  │  │ Explore  │  │ Sisyphus │  │ Multimodal-Looker    │      ││
│  │  │ (探索者) │  │ -Junior  │  │ (视觉分析)           │      ││
│  │  └──────────┘  └──────────┘  └──────────────────────┘      ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Plugin Agents (独立代理)                                    ││
│  │  ┌──────────────────┐  ┌──────────────────────┐            ││
│  │  │  The Observer    │  │  The Librarian       │            ││
│  │  │  (记忆萃取)      │  │  (知识整合)          │            ││
│  │  │  Tab 切换触发     │  │  @memory-consolidate │            ││
│  │  └──────────────────┘  └──────────────────────┘            ││
│  └─────────────────────────────────────────────────────────────┘│
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
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ SurrealDB  │  │ Meilisearch  │  │ Precompute Service     │  │
│  │ (图数据库) │  │ (搜索引擎)   │  │ • AST 解析             │  │
│  │ • Atoms    │  │ • 向量搜索   │  │ • 符号提取             │  │
│  │ • Entities │  │ • 全文搜索   │  │ • 引用解析             │  │
│  │ • Relations│  │ • 混合搜索   │  │ • 聚类 (Leiden)        │  │
│  └────────────┘  └──────────────┘  └────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: 数据层                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Timeline 文件系统 (YYYY/MM/DD/*.md)                     │   │
│  │  MEMORY.md 索引 | Link-map 映射 | 配置文件               │   │
│  │  9 大核心文件: SOUL/AGENTS/USER/IDENTITY/TOOLS/           │   │
│  │                MEMORY/HEARTBEAT/BOOT/BOOTSTRAP            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 双代理系统设计

系统中存在两套独立的代理系统：

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
│    The Librarian (知识整合)                            │
│                                                        │
│  调用方式: 通过 OpenCode tool.call 框架直接调用        │
│  记忆工具: 完整 15 工具集                              │
└───────────────────────────────────────────────────────┘
```

### 2.3 关键区别

| 维度 | OMO Agents | Plugin Agents |
|------|-----------|---------------|
| **定义位置** | `oh-my-opencode.json` | `agents/*.md` (插件内置) |
| **数量** | 10+ 个 | 2 个 |
| **主要职责** | 编码、规划、审查、探索 | 记忆萃取、知识整合 |
| **模型选择** | 按类别动态路由 | 固定模型 (claude-sonnet-4) |
| **工具范围** | 继承 Category 的 tools + 基础工具 | 记忆工具白名单 |
| **交互模式** | Tab 切换 / subagent 自动调度 | Tab 切换 / @trigger |
| **记忆意识** | 需通过 prompt_append 注入 | 原生记忆感知 |
| **Human-in-the-loop** | 无（subagent 无法多轮交互） | The Observer 需要用户确认 |

### 2.4 为什么需要两套系统

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

## 三、Current Environment Analysis

### 3.1 你的实际配置文件

| 文件路径 | 作用 | 当前状态 |
|---------|------|---------|
| `C:\Users\Longray\.config\opencode\AGENTS.md` | OpenCode 全局配置 | ✅ 已配置（语言、Python规则、Windows环境） |
| `C:\Users\Longray\.config\opencode\oh-my-opencode.json` | OMO 子代理配置 | ⚠️ 工具列表过时，需要升级 |
| `D:\github\opencode-memory-plugin\AGENTS.md` | 插件开发文档 | ✅ 项目结构文档 |
| `~/.opencode/memory/memory-config.json` | 插件核心配置 | ⚠️ 需要确认是否启用 v3.2 特性 |

### 3.2 当前 OMO 配置分析

**已启用的记忆工具（旧版本）**:

```json
"tools": {
  "memory_write": true,      // ✅ 仍有效
  "memory_read": true,       // ✅ 仍有效
  "memory_search": true,     // ✅ 仍有效
  "list_daily": true,        // ❌ 已废弃
  "init_daily": true,        // ❌ 已废弃
  "rebuild_index": true,     // ✅ 仍有效
  "index_status": true       // ✅ 仍有效
}
```

**缺失的新工具**:

- `memory_suggest` - 搜索建议
- `memory_relate` - 关系图谱
- `memory_graph` - 图谱遍历
- `memory_timeline` - 时间线浏览
- `memory_topics` - 主题发现
- `incremental_sync` - 增量同步
- `full_sync` - 全量同步
- `conflict_list` / `conflict_resolve` - 冲突处理

### 3.3 关键问题识别

1. **工具列表过时**: OMO 配置使用的是 v2.x 工具列表，缺少 v3.x 新工具
2. **缺少 v3.2 Atom/Entity/Reference 工具**: 新架构的 API 未暴露给 OMO
3. **子代理提示词未优化**: Sisyphus、Prometheus 等代理不知道如何最佳使用记忆系统
4. **插件代理与 OMO 代理关系不清**: The Observer/The Librarian 如何与 OMO 协作

### 3.4 工具版本对照表

| 旧版工具 (v2.x) | 当前版本 (v3.2+) | 替换说明 |
|----------------|-----------------|---------|
| `list_daily` | `memory_timeline` | 时间线浏览，功能完全替代 |
| `init_daily` | `memory_timeline` | 初始化逻辑已合并到 timeline |
| `memory_search` | `memory_search` | ✅ 保留，新增 `memory_suggest` |
| `memory_write` | `memory_write` | ✅ 保留，新增 `memory_pin` |
| `memory_read` | `memory_read` | ✅ 保留，支持 level 渐进加载 |
| `rebuild_index` | `rebuild_index` | ✅ 保留，新增 `incremental_sync` |
| `index_status` | `index_status` | ✅ 保留 |
| *(不存在)* | `memory_suggest` | 🆕 自动补全建议 |
| *(不存在)* | `memory_timeline` | 🆕 按日期浏览记忆 |
| *(不存在)* | `memory_topics` | 🆕 按主题浏览记忆 |
| *(不存在)* | `memory_relate` | 🆕 创建/查询图关系 |
| *(不存在)* | `memory_graph` | 🆕 图谱遍历 |
| *(不存在)* | `memory_pin` | 🆕 置顶/取消置顶 |
| *(不存在)* | `incremental_sync` | 🆕 增量同步 |
| *(不存在)* | `full_sync` | 🆕 完整同步 |
| *(不存在)* | `sync_checkpoint` | 🆕 同步检查点 |
| *(不存在)* | `conflict_list` | 🆕 冲突列表 |
| *(不存在)* | `conflict_resolve` | 🆕 冲突解决 |
| *(不存在)* | `createAtom` | 🆕 v3.2 Atom API |
| *(不存在)* | `createEntity` | 🆕 v3.2 Entity API |
| *(不存在)* | `createReference` | 🆕 v3.2 Reference API |

---

## 四、Quick Start: Day in the Life

### 4.1 早间启动：5 分钟检查清单

每天早上打开 OpenCode 时，做这 5 件事：

#### 步骤 1：检查后端是否活着

```
你: index_status detailed=true
```

预期输出：

```
✅ 后端服务: localhost:18008 正常
✅ Meilisearch: 已连接
✅ SurrealDB: 已连接
📊 本地条目数: 43
📊 后端条目数: 43
🔄 待同步: 0
```

如果看到「后端不可用」：

- Docker 没启动？→ `docker-compose up -d`
- 端口不对？→ 确认是 18008（不是旧版 17999）
- API Key 没设？→ 检查环境变量 `WRAPPER_MEILI_API_KEY`

#### 步骤 2：加载昨天的上下文

```
你: memory_timeline days=1 level=1
```

这会给你一个快速摘要，看看昨天做了什么。
不需要 level=2（完整内容），level=1（Abstract + Overview）足够回忆上下文。

#### 步骤 3：搜索当前项目相关记忆

```
你: memory_search query="当前项目的关键决策和进行中的任务" mode=hybrid level=0
```

level=0 只返回 Abstract，一扫而过。找到感兴趣的再 `memory_read(entry_id=xxx, level=2)`。

#### 步骤 4：看一下有什么智能体可用

OpenCode 底部状态栏会显示当前智能体。
按 **Tab** 可以在 primary 智能体之间切换：

| 按 Tab | 切换到 | 用途 |
|--------|--------|------|
| → | Sisyphus | 主协调器，分配任务 |
| → | Prometheus | 规划器，制定计划 |
| → | Atlas | 执行指挥，调度工人 |
| → | The Observer | 记忆观察者，捕获知识 |

subagent（如 Oracle、Momus、Explore）不通过 Tab 切换，而是由 Sisyphus 通过 Task 工具调度。

#### 步骤 5：告诉 Sisyphus 今天要做什么

```
你: 我今天要给 memory plugin 加一个新功能：代码变更检测。
    当文件保存时，自动检测哪些函数被修改了。
```

Sisyphus 会接管——它会：

1. 调用 `memory_search` 搜索历史方案
2. 把任务交给 Prometheus 做规划
3. 按规划把子任务分给 Atlas 执行

**你只需要坐在旁边看，在关键决策点点头或摇头。**

### 4.2 编码实战：一个完整的 Sisyphus 工作流

让我们用一个真实场景走一遍：

> **任务**：给 memory plugin 加上「文件变更指纹」功能——当文件保存时，通过 SHA-256 指纹检测哪些文件被修改了，只对修改过的文件做代码分析。

#### 第 1 幕：Sisyphus 接单

```
你: 给 code-fingerprint.js 加一个功能：保存文件时计算 SHA-256 指纹，
    和上次的指纹对比，只对修改过的文件触发分析。
```

Sisyphus 的内部流程（你不需要手动执行，它自动完成）：

```
Sisyphus: [memory_search] query="code-fingerprint SHA-256 变更检测"
Sisyphus: 找到了 2 条相关记忆：
         - "CodeFingerprint 类已实现基础指纹功能"
         - "代码分析触发条件：300ms debounce"
Sisyphus: [调度 Prometheus] 制定实施计划
```

#### 第 2 幕：Prometheus 规划

Prometheus 被 Sisyphus 调度（作为 subagent），它会：

```
Prometheus: 制定计划：
1. 在 CodeFingerprint 类中添加 compareFingerprint() 方法
2. 修改 file-watcher.js，在文件保存时调用指纹对比
3. 只对指纹变化的文件触发 code-analyzer
4. 添加指纹缓存持久化（可选）

验收标准：
- 文件内容不变时不触发分析
- 文件内容变化时正常触发
- 指纹缓存可以持久化到 memory-config.json
```

Prometheus 把计划交给 Sisyphus，Sisyphus 确认后进入执行。

#### 第 3 幕：Atlas 执行

Atlas 被 Sisyphus 调度，它会分派工人去写代码：

```
Atlas: [调度 OpenCode-Builder] 实现 compareFingerprint() 方法
Atlas: [调度 Sisyphus-Junior] 修改 file-watcher.js 的触发逻辑
Atlas: [调度 Momus] 代码审查
```

每个工人专注于自己的任务，完成后报告给 Atlas。

#### 第 4 幕：Momus 审查

Momus 被调用来做代码审查：

```
Momus: 审查 file-watcher.js 变更：
- ⚠️ 第 42 行：fingerprintCache 可能未初始化就使用
  → 建议添加空值检查
- ✅ SHA-256 计算使用 Node.js crypto 模块，正确
- ✅ debounce 逻辑保持不变
```

#### 第 5 幕：记忆保存

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

### 4.3 记忆捕获：The Observer 的正确打开方式

**The Observer 是什么？**

The Observer 是插件内置的 primary agent（按 Tab 切换到它）。
它的工作是：**分析当前对话，识别值得保存的信息，等你确认后写入记忆。**

**为什么需要 Human-in-the-loop？**

因为 subagent（如 Sisyphus-Junior）无法与用户多轮交互。
如果让 Sisyphus 自动保存，它可能会：

- 保存太多垃圾信息
- 保存敏感信息
- 覆盖已有知识

The Observer 作为 primary agent，可以：

1. 展示候选清单
2. 等你选择（Save all / Save N / Edit / Discard）
3. 对确认条目执行保存

**使用流程**：

```
你: [完成一个复杂任务，做了很多决策]

你: [按 Tab 切换到 The Observer]

The Observer: 我发现了 3 条值得保存的信息：

1. ✅ 决策：使用 SHA-256 而非 MD5 做指纹（安全性考虑）
2. ✅ 模式：300ms debounce 是最佳触发间隔
3. ⚠️ 临时调试代码位置（建议不保存）

请选择：
- Save all（保存 1 和 2）
- Save 1（只保存第 1 条）
- Edit（让我修改后再保存）
- Discard（都不保存）

你: Save all

The Observer: [执行 memory_write 保存 2 条记忆]
```

### 4.4 知识整合：每周五的 Librarian 仪式

**The Librarian 是什么？**

The Librarian 是插件内置的 subagent（通过 `@memory-consolidate` 触发）。
它的工作是：**定期聚合碎片记忆，建立图谱关联，置顶关键约定。**

**为什么需要定期整合？**

因为日常工作中产生的记忆是碎片化的：

- 今天记了一个决策
- 明天记了一个 bug 修复
- 后天记了一个 API 用法

这些碎片之间可能有隐藏关联。The Librarian 会：

1. 扫描最近 7 天的记忆
2. 发现主题聚类
3. 聚合相关碎片为知识节点
4. 建立图谱关系（summarizes, relates_to, depends_on）
5. 置顶关键约定

**使用流程**：

```
你: @memory-consolidate

The Librarian: 开始知识整合仪式...

[1/4] 扫描碎片
- 发现 12 条未整合记忆
- 主题分布：代码规范(3), 架构决策(2), Bug修复(4), API用法(3)

[2/4] 聚合提炼
- 将 3 条代码规范聚合成「项目代码规范 v1.0」
- 将 2 条架构决策聚合成「微服务拆分原则」
- 将 4 条 Bug 修复聚合成「常见陷阱与解决方案」

[3/4] 织网关联
- memory_relate: 「项目代码规范 v1.0」 summarizes 3 条原始规范
- memory_relate: 「微服务拆分原则」 relates_to 架构设计文档
- memory_relate: 「常见陷阱」 depends_on 项目技术栈

[4/4] 置顶关键
- memory_pin: 「项目代码规范 v1.0」（关键约定）
- memory_pin: 「微服务拆分原则」（架构基石）

✅ 整合完成！生成 3 个高价值知识节点，建立 6 条关系。
```

### 4.5 两个 Librarian 的区别（重要）

| 代理 | 归属 | 触发方式 | 主要职责 |
|------|------|---------|---------|
| **OMO Librarian** | oh-my-opencode | Sisyphus 调度 | 知识检索、文档整理 |
| **The Librarian** | opencode-memory-plugin | `@memory-consolidate` | 记忆聚合、图谱构建 |

**协作关系**：

- OMO Librarian 负责**外部知识**的检索和整理
- The Librarian 负责**记忆系统内部**的碎片整合
- 两者可以协作：OMO Librarian 发现知识缺口 → The Librarian 整合到长期记忆

---

## 五、Detailed Configuration

### 5.1 配置文件矩阵

#### 四个关键配置文件的关系

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ~/.config/opencode/opencode.json                        │
│  ├── provider 定义（模型接入）                             │
│  ├── plugin 列表（oh-my-opencode@latest）                 │
│  ├── instructions（记忆文件路径）                          │
│  ├── tools（全局工具开关） ← ⚠️ 需升级                   │
│  └── agent（代理定义） ← ⚠️ 需升级                       │
│                                                          │
│  ~/.config/opencode/oh-my-opencode.json                  │
│  ├── categories（能力分类模板）← ⚠️ 需升级              │
│  │   └── tools（每类可用的记忆工具）                       │
│  ├── agents（子智能体定义）                                │
│  │   ├── model / fallback_models                          │
│  │   ├── prompt / prompt_append                          │
│  │   └── permission（权限控制）                            │
│  ├── lsp（语言服务协议）                                   │
│  ├── skills（技能启用）                                    │
│  ├── background_task（并发控制）                           │
│  └── sisyphus_agent（编排器配置）                          │
│                                                          │
│  opencode-memory-plugin/agents/memory-automation.md       │
│  └── The Observer（primary 模式）                         │
│      ├── tools: search-only（无 write）                    │
│      └── Human-in-the-loop 确认流程                       │
│                                                          │
│  opencode-memory-plugin/agents/memory-consolidate.md      │
│  └── The Librarian（subagent 模式）                       │
│      ├── tools: 全部记忆工具 + sync                       │
│      └── S.O.P. 自动整合流程                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### 配置优先级

```text
opencode.json.tools (全局开关)
    ↓ 限制
oh-my-opencode.json.categories.*.tools (按能力分类)
    ↓ 覆盖
oh-my-opencode.json.agents.* (子智能体自定义)
    ↓ 独立
plugin agents (memory-automation.md / memory-consolidate.md)
```

**关键规则**：`opencode.json.tools` 是**全局开关**，如果某个工具在这里设为 `false`，所有 OMO 智能体和插件代理都无法使用。

### 5.2 OMO 工具版本升级

#### OMO categories tools 升级对照

以下展示每个 category 的 **当前配置** 和 **升级后配置** 的差异：

##### universal（全功能）

```jsonc
// ❌ 当前（旧版）
"universal": {
  "tools": {
    "memory_write": true, "memory_read": true, "memory_search": true,
    "list_daily": true, "init_daily": true,
    "rebuild_index": true, "index_status": true
  }
}

// ✅ 升级后（v3.2+）
"universal": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "sync_checkpoint": true,
    "conflict_list": true, "conflict_resolve": true
  }
}
```

##### ultrabrain（极限推理）

```jsonc
// ❌ 当前（旧版）
"ultrabrain": {
  "tools": {
    "memory_write": true, "memory_read": true, "memory_search": true,
    "list_daily": true, "init_daily": true,
    "rebuild_index": true, "index_status": true
  }
}

// ✅ 升级后（v3.2+）
"ultrabrain": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "sync_checkpoint": true,
    "conflict_list": true, "conflict_resolve": true
  }
}
```

##### deep（深度调研）

```jsonc
// ❌ 当前（旧版）
"deep": {
  "tools": {
    "memory_write": true, "memory_read": true, "memory_search": true,
    "list_daily": true, "init_daily": true,
    "rebuild_index": true, "index_status": true
  }
}

// ✅ 升级后（v3.2+）
"deep": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "sync_checkpoint": true,
    "conflict_list": true, "conflict_resolve": true
  }
}
```

##### artistry（创新方案）

```jsonc
// ❌ 当前（旧版）
"artistry": {
  "tools": {
    "memory_write": true, "memory_read": true, "memory_search": true,
    "list_daily": true, "init_daily": true,
    "rebuild_index": true, "index_status": true
  }
}

// ✅ 升级后（v3.2+）
"artistry": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "sync_checkpoint": true,
    "conflict_list": true, "conflict_resolve": true
  }
}
```

##### quick（快速任务）

```jsonc
// ❌ 当前（旧版）
"quick": {
  "tools": {
    "memory_write": true, "memory_read": true, "memory_search": true,
    "list_daily": true, "init_daily": true,
    "rebuild_index": true, "index_status": true
  }
}

// ✅ 升级后（v3.2+）
"quick": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "sync_checkpoint": true,
    "conflict_list": true, "conflict_resolve": true
  }
}
```

##### writing（文档写作）

```jsonc
// ❌ 当前（旧版）
"writing": {
  "tools": {
    "memory_write": true, "memory_read": true, "memory_search": true,
    "list_daily": true, "init_daily": true,
    "rebuild_index": true, "index_status": true
  }
}

// ✅ 升级后（v3.2+）
"writing": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "sync_checkpoint": true,
    "conflict_list": true, "conflict_resolve": true
  }
}
```

### 5.3 OpenCode 主配置更新

#### opencode.json 工具升级

```jsonc
// ❌ 当前（旧版）
{
  "tools": {
    "index_status": true,
    "init_daily": true,       // ⚠️ 废弃
    "list_daily": true,       // ⚠️ 废弃
    "memory_read": true,
    "memory_search": true,
    "memory_write": true,
    "rebuild_index": true
  }
}

// ✅ 升级后（v3.2+）
{
  "tools": {
    // Core
    "memory_write": true,
    "memory_read": true,
    // Search
    "memory_search": true,
    "memory_suggest": true,
    // Graph
    "memory_relate": true,
    "memory_graph": true,
    // Browse
    "memory_timeline": true,
    "memory_topics": true,
    // Sync
    "index_status": true,
    "rebuild_index": true,
    "incremental_sync": true,
    "full_sync": true,
    "sync_checkpoint": true,
    "conflict_list": true,
    "conflict_resolve": true,
    // Pin
    "memory_pin": true
  }
}
```

#### opencode.json agent 配置升级

```jsonc
// ❌ 当前（旧版）
{
  "agent": {
    "memory-consolidate": {
      "tools": {
        "list_daily": true,        // ⚠️ 废弃
        "rebuild_index": true,
        "memory_read": true,
        "memory_search": true,
        "memory_write": true
      }
    }
  }
}

// ✅ 升级后（v3.2+）
{
  "agent": {
    "memory-consolidate": {
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
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
      }
    }
  }
}
```

---

## 六、Agent Configuration

### 6.1 OMO 子智能体 prompt_append 指导

以下是为每个 OMO 子智能体设计的 `prompt_append`，指导它们正确使用记忆系统。

#### Sisyphus (主协调器)

```json
{
  "agents": {
    "sisyphus": {
      "prompt_append": "记忆系统使用指南：\n\n1. **任务前查询**: 调度任务前，先用 `memory_search(query='相关关键词', mode='hybrid', level=1)` 查找历史方案和决策。\n\n2. **决策后保存**: 重要决策立即用 `memory_write` 保存，必须包含：\n   - abstract: ≤100字摘要\n   - overview: ≤500字概述  \n   - content: 完整内容\n   - type: 'decision' | 'architecture' | 'pattern'\n\n3. **使用 v3.2 新架构**: 代码分析任务优先使用 Atom/Entity/Reference API：\n   - `createAtom`: 提取函数/类/导入\n   - `createEntity`: 聚合代码文件\n   - `createReference`: 建立调用关系\n\n4. **与插件代理协作**: \n   - 会话结束时，提示用户 Tab 切换到 @memory-automation 审阅候选记忆\n   - 每周五提醒用户运行 @memory-consolidate 整合知识\n\n5. **渐进加载**: 搜索时先用 level=0/1，确认相关后再 level=2 加载详情"
    }
  }
}
```

#### Prometheus (规划器)

```json
{
  "agents": {
    "prometheus": {
      "prompt_append": "规划时的记忆使用：\n\n1. **历史方案检索**: 制定计划前，搜索类似任务的过往规划：\n   `memory_search(query='类似功能的历史规划方案', mode='hybrid', level=1)`\n\n2. **技术决策记录**: 每个关键决策点记录 rationale：\n   `memory_write(type='decision', abstract='选择 X 而非 Y', overview='原因：性能/可维护性/兼容性')`\n\n3. **依赖关系建立**: 用 `memory_relate` 关联相关决策：\n   - 架构决策 → 实现方案 (depends_on)\n   - 方案 → 代码模式 (implements)\n\n4. **计划模板保存**: 成功的规划模式保存为可复用模板\n\n5. **验收标准记录**: 每个计划的验收标准写入记忆，便于后续验证"
    }
  }
}
```

#### Atlas (执行指挥)

```json
{
  "agents": {
    "atlas": {
      "prompt_append": "执行时的记忆使用：\n\n1. **工人调度前**: 搜索该工人的历史表现：\n   `memory_search(query='OpenCode-Builder 历史任务成功率', level=0)`\n\n2. **任务分配记录**: 记录谁做了什么：\n   `memory_write(type='task', abstract='Atlas 调度 Momus 审查代码', tags=['workflow'])`\n\n3. **问题追踪**: 执行中遇到的问题立即记录：\n   `memory_write(type='issue', abstract='发现竞态条件', overview='在文件监听中...')`\n\n4. **进度同步**: 关键里程碑用 `memory_write` 记录，便于 Sisyphus 追踪\n\n5. **失败分析**: 任务失败后搜索类似失败的历史解决方案"
    }
  }
}
```

#### Oracle (架构师)

```json
{
  "agents": {
    "oracle": {
      "prompt_append": "架构设计时的记忆使用：\n\n1. **架构决策记录 (ADR)**: 每个重大决策必须记录：\n   `memory_write(type='architecture', abstract='选择微服务而非单体', overview='原因、权衡、影响')`\n\n2. **模式库构建**: 成功的架构模式保存到记忆：\n   `memory_write(type='pattern', abstract='API 网关模式', tags=['architecture', 'microservices'])`\n\n3. **关系图谱**: 用 `memory_relate` 建立架构元素关系：\n   - 服务 → 数据库 (uses)\n   - 模块 → 接口 (implements)\n   - 决策 → 约束 (leads_to)\n\n4. **技术雷达**: 定期用 `memory_timeline` 回顾技术决策，识别过时方案\n\n5. **架构健康度**: 结合代码分析数据评估架构演进"
    }
  }
}
```

#### Momus (审查者)

```json
{
  "agents": {
    "momus": {
      "prompt_append": "代码审查时的记忆使用：\n\n1. **历史问题检索**: 审查前搜索该类问题的历史记录：\n   `memory_search(query='常见的内存泄漏模式', mode='hybrid')`\n\n2. **问题模式记录**: 发现新问题类型时保存：\n   `memory_write(type='code-review', abstract='发现新的竞态条件模式', overview='在异步初始化中...')`\n\n3. **最佳实践库**: 优秀的代码模式记录为参考：\n   `memory_write(type='pattern', abstract='错误处理最佳实践', tags=['error-handling'])`\n\n4. **审查清单**: 维护项目特定的审查 checklist 在记忆中\n\n5. **趋势分析**: 用 `memory_timeline` 分析代码质量趋势"
    }
  }
}
```

#### Metis (评审专家)

```json
{
  "agents": {
    "metis": {
      "prompt_append": "评审时的记忆使用：\n\n1. **评审标准检索**: 搜索项目评审标准：\n   `memory_search(query='项目代码评审标准', level=1)`\n\n2. **评审记录**: 记录评审结果和反馈：\n   `memory_write(type='review', abstract='PR #123 评审通过', overview='主要反馈...')`\n\n3. **质量趋势**: 用 `memory_graph` 追踪代码质量指标变化\n\n4. **知识传递**: 评审中发现的知识 gaps 记录并关联到相关条目"
    }
  }
}
```

#### Librarian (知识管理)

```json
{
  "agents": {
    "librarian": {
      "prompt_append": "知识管理时的记忆使用：\n\n1. **知识检索**: 使用 `memory_search` 查找外部知识资源\n\n2. **知识缺口识别**: 发现缺失的知识时，提示用户补充\n\n3. **与 The Librarian 协作**: 外部知识整理后，触发 @memory-consolidate 整合到记忆系统\n\n4. **知识图谱**: 用 `memory_relate` 建立知识间关联\n\n5. **定期整理**: 每周运行知识整理工作流"
    }
  }
}
```

#### Explore (探索者)

```json
{
  "agents": {
    "explore": {
      "prompt_append": "探索时的记忆使用：\n\n1. **已有知识扫描**: 探索前先 `memory_search(level=0)` 快速扫描已有知识\n\n2. **发现记录**: 新发现立即记录：\n   `memory_write(type='discovery', abstract='发现新的 API 用法', overview='在实验中发现...')`\n\n3. **实验追踪**: 实验过程和结果详细记录\n\n4. **失败也记录**: 失败的探索同样有价值，记录避免重复踩坑\n\n5. **模式识别**: 探索后用 `memory_topics` 发现隐藏模式"
    }
  }
}
```

#### Sisyphus-Junior (初级开发者)

```json
{
  "agents": {
    "sisyphus-junior": {
      "prompt_append": "编码时的记忆使用：\n\n1. **代码模式检索**: 实现前搜索类似功能的代码模式：\n   `memory_search(query='如何实现 debounce', mode='hybrid')`\n\n2. **实现记录**: 记录实现细节和注意事项：\n   `memory_write(type='implementation', abstract='实现文件监听功能', overview='使用 chokidar...')`\n\n3. **问题求助**: 遇到困难时搜索历史解决方案\n\n4. **代码片段**: 可复用的代码片段保存到记忆\n\n5. **学习记录**: 新学到的技术点记录到长期记忆"
    }
  }
}
```

#### OpenCode-Builder (代码工匠)

```json
{
  "agents": {
    "opencode-builder": {
      "prompt_append": "构建代码时的记忆使用：\n\n1. **设计模式检索**: 实现前搜索适用的设计模式\n\n2. **实现决策记录**: 记录关键实现选择：\n   `memory_write(type='implementation', abstract='选择策略模式实现插件系统')`\n\n3. **代码质量**: 参考记忆中的最佳实践\n\n4. **重构记录**: 重构前后的对比记录到记忆\n\n5. **技术债务**: 识别的技术债务标记并记录"
    }
  }
}
```

#### Multimodal-Looker (视觉分析)

```json
{
  "agents": {
    "multimodal-looker": {
      "prompt_append": "视觉分析时的记忆使用：\n\n1. **UI 模式检索**: 分析前搜索项目 UI 设计模式\n\n2. **设计决策记录**: 视觉设计选择记录到记忆\n\n3. **可访问性**: 可访问性问题记录并关联到相关组件\n\n4. **设计系统**: 维护设计系统知识在记忆中\n\n5. **视觉趋势**: 用 `memory_timeline` 追踪设计演进"
    }
  }
}
```

#### UI-Sketcher (界面设计)

```json
{
  "agents": {
    "ui-sketcher": {
      "prompt_append": "界面设计时的记忆使用：\n\n1. **设计规范检索**: 设计前搜索项目设计规范\n\n2. **组件模式**: 可复用的组件模式记录到记忆\n\n3. **用户反馈**: 用户反馈关联到设计决策\n\n4. **A/B 测试**: 测试结果记录并关联到设计变更\n\n5. **设计债务**: 需要改进的设计点标记记录"
    }
  }
}
```

### 6.2 插件内置代理完整定义

#### The Observer (memory-automation.md)

```yaml
---
name: memory-automation
description: |
  The Observer - 对话后萃取重要信息，向用户确认后保存。
  Human-in-the-loop 流程：分析对话 → 查重 → 展示候选 → 用户确认 → 保存。
model: claude-sonnet-4  # 指令遵循更强，避免跳过确认步骤
type: primary           # 用户通过 Tab 键切换
instructions: |
  你是 The Observer，负责从对话中萃取值得保存的信息。

  ## 工作流程

  1. **分析对话**: 识别以下类型的信息：
     - 重要决策及 rationale
     - 成功的解决方案和模式
     - 用户偏好和约定
     - 项目特定知识
     - 避免的陷阱和错误

  2. **查重过滤**: 对每条候选调用 `memory_search` 检查是否已存在

  3. **展示候选**: 向用户展示最多 5 条候选，格式：
     ```
     我发现了 N 条值得保存的信息：

     1. [类型] 摘要
     2. [类型] 摘要
     ...

     请选择：
     - Save all（保存全部）
     - Save N（只保存第 N 条）
     - Edit N（修改第 N 条后保存）
     - Discard（都不保存）
     ```

  4. **等待确认**: 必须等待用户明确回复，禁止自动保存

  5. **执行保存**: 对确认条目调用 `memory_write`，必须包含：
     - abstract: ≤100 字符
     - overview: ≤500 字符
     - content: 完整内容
     - type: 适当类型
     - tags: 相关标签

tools:
  - memory_search      # 查重
  - memory_read        # 读取已有条目
  - memory_suggest     # 标签建议
  - memory_timeline    # 查看上下文
  - memory_topics      # 主题发现
  # 注意：不包含 memory_write，避免自动保存
---
```

#### The Librarian (memory-consolidate.md)

```yaml
---
name: memory-consolidate
description: |
  The Librarian - 定期聚合碎片记忆，建立图谱关联和置顶。
  S.O.P.：扫描碎片 → 聚合提炼 → 织网关联 → 置顶关键 → 静默同步。
model: claude-sonnet-4
type: subagent          # 通过 @memory-consolidate 触发
instructions: |
  你是 The Librarian，负责定期整合碎片记忆，构建知识图谱。

  ## 标准操作流程 (S.O.P.)

  ### 步骤 1: 扫描碎片
  - `memory_timeline(days=7, level=1)` 查看最近记忆
  - `memory_topics(min_entries=3)` 发现活跃主题
  - 识别未整合的碎片条目

  ### 步骤 2: 聚合提炼
  - 将相关碎片聚合成高价值知识节点
  - 每条聚合记忆必须包含完整 L0/L1/L2 结构
  - 类型选择：decision | pattern | architecture | guide

  ### 步骤 3: 织网关联
  - 使用 `memory_relate` 建立关系：
    - `summarizes`: 聚合记忆 → 原始碎片
    - `relates_to`: 相关知识节点
    - `depends_on`: 依赖关系
    - `implements`: 实现关系
  - 权重设置：核心关系 0.8-1.0，次要关系 0.3-0.5

  ### 步骤 4: 置顶关键
  - `memory_pin` 置顶关键约定和架构决策
  - 置顶标准：影响面广、长期有效、频繁引用

  ### 步骤 5: 静默同步
  - `incremental_sync` 同步到后端
  - 不打扰用户，后台完成

  ## 禁止行为

  - 禁止使用 `bash` 操作记忆文件
  - 禁止自动批量写入（必须遵循 S.O.P.）
  - 禁止省略 abstract/overview 字段

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
```

---

## 七、Workflow Examples

### 7.1 场景 1：新功能开发完整流程

```
用户: 我要给项目加一个用户认证功能

Sisyphus: [memory_search] "用户认证 历史实现方案"
Sisyphus: 找到 2 条相关记忆，调度 Prometheus 规划

Prometheus: 制定计划：
1. 调研认证方案 (JWT vs Session)
2. 设计数据库 schema
3. 实现登录/注册 API
4. 添加前端登录页面
5. 编写测试

Sisyphus: 确认计划，调度 Atlas 执行

Atlas: [调度 Oracle] 设计认证架构
Oracle: [memory_write] 记录架构决策
Oracle: 建议使用 JWT，原因：...

Atlas: [调度 OpenCode-Builder] 实现 API
OpenCode-Builder: 编写代码...
OpenCode-Builder: [memory_write] 记录实现细节

Atlas: [调度 Momus] 代码审查
Momus: 审查通过，建议添加 rate limiting
Momus: [memory_write] 记录审查反馈

Atlas: 任务完成

Sisyphus: 会话结束，提示用户：
"任务已完成。按 Tab 切换到 The Observer 审阅候选记忆？"

用户: [Tab 切换到 The Observer]

The Observer: 发现 3 条候选：
1. 架构决策：使用 JWT
2. 实现细节：API 设计
3. 审查反馈：rate limiting 建议

用户: Save all

The Observer: [memory_write x3] 保存完成
```

### 7.2 场景 2：Bug 修复与知识沉淀

```
用户: 生产环境出现内存泄漏，帮我排查

Sisyphus: [memory_search] "内存泄漏 排查方法"
Sisyphus: 找到历史排查方案，调度 Explore 深入分析

Explore: 分析代码，发现事件监听器未移除
Explore: [memory_write] 记录排查过程

Sisyphus: 调度 OpenCode-Builder 修复
OpenCode-Builder: 修复代码...
OpenCode-Builder: [memory_write] 记录修复方案

Sisyphus: 调度 Momus 验证修复
Momus: 验证通过

用户: [Tab 切换到 The Observer]

The Observer: 发现 2 条候选：
1. 内存泄漏排查方法
2. 事件监听器最佳实践

用户: Save all

[一周后]

用户: @memory-consolidate

The Librarian: 整合最近 Bug 修复记忆：
- 聚合为「常见内存问题与解决方案」
- 建立关系图谱
- 置顶关键实践
```

### 7.3 场景 3：v3.2 Atom/Entity/Reference 工作流

```
用户: 分析这个项目的代码结构

Sisyphus: 使用 v3.2 新架构进行代码分析

Sisyphus: [createEntity] 创建项目实体
{
  "name": "my-project",
  "type": "project",
  "metadata": {
    "language": "javascript",
    "framework": "express"
  }
}

Sisyphus: [createAtom] 提取关键函数
{
  "entity_id": "proj_xxx",
  "type": "function",
  "name": "authenticateUser",
  "content": "async function authenticateUser...",
  "metadata": {
    "complexity": 5,
    "lines": 42
  }
}

Sisyphus: [createReference] 建立调用关系
{
  "from_atom": "atom_auth_xxx",
  "to_atom": "atom_db_xxx",
  "type": "calls",
  "metadata": {
    "frequency": "high"
  }
}

Sisyphus: [memory_write] 记录分析结果

Sisyphus: [memory_relate] 关联到项目记忆
```

### 7.4 数据流详解

#### 记忆写入数据流

```
OMO Agent / Plugin Agent
         │
         ▼
┌─────────────────┐
│  memory_write   │ ◄── 工具调用
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   entry.js      │ ◄── 构建条目内容 (L0/L1/L2)
│  buildEntryContent
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│ Timeline│ │ Backend  │ ◄── 双写
│  File   │ │  API     │
└────────┘ └──────────┘
```

#### 搜索数据流

```
User / Agent
    │
    ▼
┌─────────────────┐
│  memory_search  │ ◄── 工具调用 (mode=hybrid/vector/keyword)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│  BM25  │ │ Backend  │ ◄── 并行查询
│ (Local)│ │  API     │
└────────┘ └────┬─────┘
                │
         ┌──────┴──────┐
         ▼             ▼
    ┌─────────┐   ┌──────────┐
    │Meilisearch│   │SurrealDB │ ◄── 向量 + 图搜索
    │ (向量)   │   │ (关系)   │
    └─────────┘   └──────────┘
         │             │
         └──────┬──────┘
                ▼
         ┌─────────────┐
         │ 结果合并     │ ◄── 0.7*向量 + 0.3*BM25
         │ (hybrid)    │
         └──────┬──────┘
                ▼
         ┌─────────────┐
         │  extractor  │ ◄── 按 level 提取内容
         │  (L0/L1/L2) │
         └─────────────┘
```

#### 同步数据流

```
Local Timeline Files
         │
         ▼
┌─────────────────┐
│ incremental_sync│ ◄── 基于指纹的变更检测
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 指纹对比 (SHA-256)│ ◄── 只上传变更的文件
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Batch Upload   │ ◄── 批量上传 (默认 50条)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend API   │ ◄── /api/v1/memories/batch
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────┐
│SurrealDB│ │Meilisearch│ ◄── 双写
│ (图)   │ │ (搜索)   │
└────────┘ └──────────┘
```

---

## 八、Decision Trees

### 8.1 工具选择决策树

```
需要查找信息？
├── 知道确切 entry_id？
│   └── memory_read(entry_id=xxx, level=1) → 确认后 level=2
│
├── 知道大概时间？
│   └── memory_timeline(days=N, level=1) → 浏览后 read
│
├── 想发现主题？
│   └── memory_topics(min_entries=5) → 按主题浏览
│
└── 只有模糊概念？
    ├── 需要语义理解？
    │   └── memory_search(mode=hybrid, level=1)
    │       └── 找到相关？
    │           ├── 是 → memory_read(level=2)
    │           └── 否 → 换关键词重试
    │
    └── 只需要关键词？
        └── memory_search(mode=keyword, level=1)
```

### 8.2 同步策略决策树

```
需要同步？
├── 日常开发后？
│   └── incremental_sync() ◄── 自动，无需手动
│
├── 刚写入重要记忆？
│   └── 已自动同步（memory_write 自动触发）
│
├── 怀疑数据不一致？
│   └── index_status(detailed=true)
│       └── 本地 ≠ 后端？
│           ├── 是 → incremental_sync(force=true)
│           └── 否 → 无需操作
│
├── 迁移到新设备？
│   └── full_sync(resume=true) ◄── 支持断点续传
│
└── 搜索不准确？
    └── rebuild_index() ◄── 重建向量索引
```

### 8.3 Agent 选择决策树

```
有任务需要处理？
├── 需要多智能体协作？
│   └── 告诉 Sisyphus，它会调度 Prometheus → Atlas → Workers
│
├── 需要架构设计？
│   └── Sisyphus 会自动调度 Oracle
│
├── 需要代码审查？
│   └── Sisyphus 会自动调度 Momus
│
├── 需要探索研究？
│   └── 告诉 Sisyphus "深入研究 xxx"，它会调度 Explore
│
├── 会话结束，想保存记忆？
│   └── 按 Tab 切换到 The Observer
│
└── 想整理碎片知识？
    └── 运行 @memory-consolidate
```

### 8.4 搜索模式选择决策树

```
需要搜索记忆？
├── 后端可用？
│   ├── 需要最佳质量？
│   │   └── mode=hybrid (70%向量+30%关键词)
│   │
│   └── 只需要语义相似？
│       └── mode=vector
│
└── 后端不可用？
    ├── 需要快速结果？
    │   └── mode=keyword (BM25)
    │
    └── 只需要粗略匹配？
        └── mode=hash (哈希 fallback)
```

---

## 九、Verification & Troubleshooting

### 9.1 验证清单

#### 安装验证

```bash
# 1. 检查记忆文件存在
ls ~/.opencode/memory/
# 预期: SOUL.md AGENTS.md USER.md IDENTITY.md TOOLS.md MEMORY.md HEARTBEAT.md BOOT.md BOOTSTRAP.md timeline/

# 2. 检查插件加载
opencode
# 在 OpenCode 中: index_status

# 3. 测试写入
memory_write content="验证测试" type="general"

# 4. 测试搜索
memory_search query="验证测试"

# 5. 检查后端连接
index_status detailed=true
```

#### 配置验证

```bash
# 检查 OMO 配置版本
cat ~/.config/opencode/oh-my-opencode.json | grep -E "(memory_timeline|memory_topics|incremental_sync)"
# 预期: 看到这些新工具名，而不是 list_daily/init_daily

# 检查 OpenCode 配置
cat ~/.config/opencode/opencode.json | grep -E "(memory_relate|memory_graph)"
# 预期: 看到这些图工具
```

### 9.2 常见问题

#### Q1: 后端连接失败

**症状**: `index_status` 显示「后端不可用」

**排查**:

```bash
# 1. 检查 Docker
docker ps | grep surrealdb
docker ps | grep meilisearch

# 2. 检查端口
curl http://localhost:18008/health

# 3. 检查 API Key
echo $WRAPPER_MEILI_API_KEY
```

**解决**:

```bash
# 启动后端
cd /path/to/embedding_service
docker-compose up -d

# 设置 API Key
export WRAPPER_MEILI_API_KEY="your-key"
```

#### Q2: 搜索返回空结果

**症状**: `memory_search` 返回 `[]`

**排查**:

```bash
# 1. 检查是否有数据
index_status

# 2. 检查同步状态
sync_checkpoint

# 3. 尝试重建索引
rebuild_index dry_run=true  # 先看影响范围
rebuild_index force=true    # 确认后执行
```

#### Q3: OMO 智能体无法使用记忆工具

**症状**: Sisyphus 说「我没有权限使用 memory_write」

**排查**:

```bash
# 1. 检查 opencode.json 全局工具
cat ~/.config/opencode/opencode.json | jq '.tools'

# 2. 检查 oh-my-opencode.json category 工具
cat ~/.config/opencode/oh-my-opencode.json | jq '.categories.universal.tools'

# 3. 检查 agent 特定工具
cat ~/.config/opencode/oh-my-opencode.json | jq '.agents.sisyphus.tools'
```

**解决**: 按照第 5 章「Detailed Configuration」升级配置

#### Q4: The Observer 不显示候选

**症状**: 切换到 The Observer 后没有反应

**排查**:

- 确认当前对话有足够内容（至少 5 轮以上）
- 检查 The Observer 的 tools 配置是否包含 `memory_search`
- 查看日志是否有错误

**解决**:

```bash
# 手动触发记忆保存
memory_write content="手动保存的内容" type="general"
```

#### Q5: 同步冲突

**症状**: `conflict_list` 显示未解决的冲突

**解决**:

```bash
# 查看冲突列表
conflict_list

# 解决单个冲突（使用本地版本）
conflict_resolve conflict_id="xxx" resolution="USE_LOCAL"

# 解决单个冲突（使用后端版本）
conflict_resolve conflict_id="xxx" resolution="USE_BACKEND"

# 批量解决
conflict_list | xargs -I {} conflict_resolve conflict_id={} resolution="MERGE"
```

### 9.3 性能优化

#### 搜索优化

```javascript
// 使用渐进加载减少数据传输
memory_search(query="xxx", level=0)  // 只返回 Abstract
// 确认相关后再加载详情
memory_read(entry_id="xxx", level=2)  // 完整内容
```

#### 同步优化

```javascript
// 日常使用增量同步（自动）
// 大量变更时使用批量模式
incremental_sync(batch_size=100)
```

#### 索引优化

```javascript
// 定期重建索引（搜索变慢时）
rebuild_index(force=true)

// 检查索引状态
index_status(detailed=true)
```

---

## 十、Appendix

### 10.1 完整配置文件参考

#### opencode.json (完整版)

```json
{
  "provider": {
    "openrouter": {
      "api_key": "${OPENROUTER_API_KEY}",
      "model": "anthropic/claude-3.5-sonnet"
    }
  },
  "plugins": [
    "oh-my-opencode@latest"
  ],
  "instructions": [
    "~/.opencode/memory/SOUL.md",
    "~/.opencode/memory/AGENTS.md",
    "~/.opencode/memory/USER.md",
    "~/.opencode/memory/IDENTITY.md",
    "~/.opencode/memory/TOOLS.md",
    "~/.opencode/memory/MEMORY.md"
  ],
  "tools": {
    "Read": true,
    "Write": true,
    "Edit": true,
    "LSP": true,
    "Bash": true,
    "WebFetch": true,
    "Task": true,
    "TodoWrite": true,
    "Think": true,
    "memory_write": true,
    "memory_read": true,
    "memory_search": true,
    "memory_suggest": true,
    "memory_timeline": true,
    "memory_topics": true,
    "memory_relate": true,
    "memory_graph": true,
    "memory_pin": true,
    "index_status": true,
    "rebuild_index": true,
    "incremental_sync": true,
    "full_sync": true,
    "sync_checkpoint": true,
    "conflict_list": true,
    "conflict_resolve": true
  },
  "agent": {
    "memory-consolidate": {
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
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
      }
    }
  }
}
```

#### oh-my-opencode.json (记忆相关片段)

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
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
      }
    },
    "ultrabrain": {
      "description": "超高难度、需要极限推理的复杂逻辑任务",
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
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
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
        "memory_pin": true,
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
      }
    },
    "artistry": {
      "description": "非常规创造性方法、创新解决方案",
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
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
      }
    },
    "quick": {
      "description": "简单任务 - 单文件更改、拼写修复",
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
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
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
        "memory_relate": true,
        "memory_graph": true,
        "memory_pin": true,
        "index_status": true,
        "rebuild_index": true,
        "incremental_sync": true,
        "full_sync": true,
        "sync_checkpoint": true,
        "conflict_list": true,
        "conflict_resolve": true
      }
    }
  }
}
```

### 10.2 扩展性分析

#### 添加新的 OMO Agent

```json
{
  "agents": {
    "my-custom-agent": {
      "model": "claude-sonnet-4",
      "fallback_models": ["gpt-4o"],
      "prompt": "你是 MyCustomAgent，负责...",
      "prompt_append": "记忆使用指南：...",
      "tools": {
        "memory_write": true,
        "memory_search": true,
        "memory_read": true
      },
      "permission": {
        "allow_bash": true,
        "allow_edit": true
      }
    }
  }
}
```

#### 添加新的记忆工具

1. 在 `opencode-memory-plugin/tools/` 创建新工具文件
2. 在 `plugin.js` 注册工具
3. 在 `oh-my-opencode.json` 的 categories 中启用
4. 在 `opencode.json` 的 tools 中启用

#### 自定义后端集成

```javascript
// 创建自定义后端客户端
class MyBackendClient {
  async query(params) {
    // 自定义查询逻辑
  }
}

// 在 wrapper-client.js 中集成
```

### 10.3 15 个记忆工具完整清单

| 类别 | 工具 | 用途 | 后端依赖 |
|------|------|------|---------|
| **Core** | `memory_write` | 写入记忆 | 同步 |
| | `memory_read` | 读取记忆 | 本地 |
| | `memory_pin` | 置顶/取消置顶 | 本地 |
| **Search** | `memory_search` | 搜索记忆 | 优先后端 |
| | `memory_suggest` | 自动补全建议 | 本地 |
| **Graph** | `memory_relate` | 创建/查询关系 | ✅ 必须 |
| | `memory_graph` | 图谱遍历 | ✅ 必须 |
| **Browse** | `memory_timeline` | 时间线浏览 | 本地 |
| | `memory_topics` | 主题发现 | 本地 |
| **Sync** | `index_status` | 状态检查 | 混合 |
| | `rebuild_index` | 重建索引 | ✅ 必须 |
| | `incremental_sync` | 增量同步 | ✅ 必须 |
| | `full_sync` | 全量同步 | ✅ 必须 |
| | `sync_checkpoint` | 同步检查点 | ✅ 必须 |
| **Conflict** | `conflict_list` | 冲突列表 | ✅ 必须 |
| | `conflict_resolve` | 冲突解决 | ✅ 必须 |

### 10.4 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v2.0 | 2026-04-23 | 合并 4 个方案为综合指南 |
| v1.0 | 2026-04-23 | 初始版本（4 个独立方案） |

---

**文档结束**

*本指南融合了 4 个方案的最佳实践：*

- *Option A: 技术配置深度*
- *Option B: 用户工作流体验*
- *Option C: 架构设计系统*
- *Option D: 实战应用示例*
