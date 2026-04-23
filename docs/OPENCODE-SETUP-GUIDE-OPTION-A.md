# OpenCode + oh-my-opencode + Memory Plugin 综合配置指南

**版本**: v1.0
**更新时间**: 2026-04-23
**适用**: opencode-memory-plugin v3.2.0-beta.1+, oh-my-opencode latest
**基于**: 真实配置文件逆向分析（非模板）
**目标**: 将 OMO 配置从旧版工具升级到 v3.2+ 当前工具集

---

## 目录

1. [现状分析与升级概要](#一现状分析与升级概要)
2. [配置文件矩阵](#二配置文件矩阵)
3. [OMO 工具版本升级](#三omo-工具版本升级)
4. [OpenCode 主配置更新](#四opencode-主配置更新)
5. [OMO 子智能体 prompt_append 指导](#五omo-子智能体-prompt_append-指导)
6. [插件内置代理完整定义](#六插件内置代理完整定义)
7. [v3.2 Atom/Entity/Reference 工作流](#七v32-atomentityreference-工作流)
8. [OMO × 插件代理交互协议](#八omo--插件代理交互协议)
9. [五层架构工具权限矩阵](#九五层架构工具权限矩阵)
10. [验证与故障排查](#十验证与故障排查)
11. [附录：完整配置文件参考](#附录完整配置文件参考)

---

## 一、现状分析与升级概要

### 1.1 当前配置审计结果

对以下 **真实配置文件** 进行了审计：

| 文件 | 路径 | 状态 |
|------|------|------|
| OMO 配置 | `~/.config/opencode/oh-my-opencode.json` | ⚠️ 需要升级 |
| OpenCode 配置 | `~/.config/opencode/opencode.json` | ⚠️ 需要升级 |
| 全局 Agent 指令 | `~/.config/opencode/AGENTS.md` | ✅ 已是最新 |
| Plugin Agent: Observer | `opencode-memory-plugin/agents/memory-automation.md` | ✅ 已是最新 |
| Plugin Agent: Librarian | `opencode-memory-plugin/agents/memory-consolidate.md` | ✅ 已是最新 |
| 插件核心 | `opencode-memory-plugin/plugin.js` | ✅ 已是最新 |

### 1.2 关键问题

**问题 1：OMO categories 中的 tools 配置使用旧版工具名**

当前所有 OMO category（universal, ultrabrain, deep, artistry, quick, writing）中的 memory tools 配置为：

```jsonc
// ❌ 当前（旧版 v2.x 工具名）
"tools": {
  "memory_write": true,
  "memory_read": true,
  "memory_search": true,
  "list_daily": true,       // ⚠️ 已废弃！
  "init_daily": true,       // ⚠️ 已废弃！
  "rebuild_index": true,
  "index_status": true
}
```

**问题 2：OpenCode opencode.json 也使用旧版工具名**

```jsonc
// ❌ 当前（旧版）
"tools": {
  "index_status": true,
  "init_daily": true,       // ⚠️ 已废弃！
  "list_daily": true,       // ⚠️ 已废弃！
  "memory_read": true,
  "memory_search": true,
  "memory_write": true,
  "rebuild_index": true
}
```

**问题 3：OpenCode agent 配置引用旧版工具**

```jsonc
// ❌ 当前 memory-consolidate 引用了废弃工具
"memory-consolidate": {
  "tools": {
    "list_daily": true,        // ⚠️ 废弃 → memory_timeline
    "rebuild_index": true,     // ⚠️ 废弃 → incremental_sync
    "memory_read": true,
    "memory_search": true,
    "memory_write": true
  }
}
```

### 1.3 工具版本对照表

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

## 二、配置文件矩阵

### 2.1 四个关键配置文件的关系

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

### 2.2 配置优先级

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

---

## 三、OMO 工具版本升级

### 3.1 OMO categories tools 升级对照

以下展示每个 category 的 **当前配置** 和 **升级后配置** 的差异：

#### universal（全功能）

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

#### quick（简单任务）— 精简版

```jsonc
// ✅ 升级后（v3.2+）— 只保留核心 + 搜索 + 浏览
"quick": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true,
    "index_status": true
  }
}
```

> **注意**：quick 分类不需要 sync/graph/conflict 工具，保持精简。

#### artistry / visual-engineering（创造性 + 视觉）

```jsonc
// ✅ 升级后（v3.2+）— 不需要 sync_checkpoint/conflict 工具
"artistry": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true,
    "index_status": true, "incremental_sync": true
  }
}
```

#### writing（文档）

```jsonc
// ✅ 升级后（v3.2+）— 不需要 sync_checkpoint/conflict 工具，但需要 pin
"writing": {
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "incremental_sync": true
  }
}
```

#### ultrabrain / deep（同 universal 完整版）

这两个 category 需要全部工具，与 universal 配置一致。

### 3.2 各 category 工具需求矩阵

| 工具 | universal | ultrabrain | deep | artistry | quick | writing | visual-eng |
|------|:---------:|:----------:|:----:|:--------:|:-----:|:-------:|:----------:|
| `memory_write` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_search` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_suggest` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_timeline` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_topics` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `memory_relate` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `memory_graph` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `memory_pin` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `index_status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `incremental_sync` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `rebuild_index` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sync_checkpoint` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `conflict_list` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `conflict_resolve` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 3.3 升级操作步骤

```powershell
# 1. 备份当前配置
Copy-Item "$env:USERPROFILE\.config\opencode\oh-my-opencode.json" `
  "$env:USERPROFILE\.config\opencode\oh-my-opencode.json.backup.$(Get-Date -Format 'yyyyMMdd')"

# 2. 编辑 oh-my-opencode.json
# 在每个 categories 的 tools 中：
#   - 删除 "list_daily": true
#   - 删除 "init_daily": true
#   - 添加上述新工具（参照 3.2 矩阵）

# 3. 验证 JSON 语法
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-Content "$env:USERPROFILE\.config\opencode\oh-my-opencode.json" -Raw | ConvertFrom-Json | Out-Null
if ($?) { "✅ JSON 语法正确" } else { "❌ JSON 语法错误" }

# 4. 重启 OpenCode 使配置生效
```

---

## 四、OpenCode 主配置更新

### 4.1 opencode.json tools 升级

```jsonc
// ❌ 当前
"tools": {
  "index_status": true,
  "init_daily": true,       // 废弃
  "list_daily": true,       // 废弃
  "memory_read": true,
  "memory_search": true,
  "memory_write": true,
  "rebuild_index": true
}

// ✅ 升级后
"tools": {
  "memory_write": true, "memory_read": true,
  "memory_search": true, "memory_suggest": true,
  "memory_timeline": true, "memory_topics": true,
  "memory_relate": true, "memory_graph": true, "memory_pin": true,
  "index_status": true, "rebuild_index": true,
  "incremental_sync": true, "full_sync": true,
  "sync_checkpoint": true, "conflict_list": true, "conflict_resolve": true
}
```

### 4.2 opencode.json agent 配置升级

```jsonc
// ❌ 当前
{
  "agent": {
    "memory-automation": {
      "mode": "subagent",           // ⚠️ 应为 primary
      "tools": {
        "memory_read": true,
        "memory_search": true,
        "memory_write": true        // ⚠️ Observer 不应有 write
      }
    },
    "memory-consolidate": {
      "mode": "subagent",
      "tools": {
        "list_daily": true,         // ⚠️ 废弃 → memory_timeline
        "rebuild_index": true,      // ⚠️ 应为 incremental_sync
        "memory_read": true,
        "memory_search": true,
        "memory_write": true
      }
    }
  }
}

// ✅ 升级后
{
  "agent": {
    "memory-automation": {
      "description": "Memory Observer — analyzes conversations, proposes saves",
      "mode": "primary",
      "tools": {
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true
      },
      "permission": {
        "memory_read": "allow", "memory_search": "allow",
        "memory_suggest": "allow", "memory_timeline": "allow",
        "memory_topics": "allow", "memory_write": "deny"
      }
    },
    "memory-consolidate": {
      "description": "Memory Librarian — consolidates fragmented memories",
      "mode": "subagent",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true, "memory_pin": true,
        "incremental_sync": true, "conflict_list": true, "conflict_resolve": true
      }
    }
  }
}
```

> **关键差异**：
> - Observer 是 `primary` 模式（Tab 切换），**没有** `memory_write`（只分析不保存）
> - Librarian 是 `subagent` 模式（@memory-consolidate 触发），有全部工具
> - 删除了 `list_daily` 和 `init_daily`

### 4.3 注意事项

opencode.json 中的 agent 配置**可能与插件 agents 目录冲突**。插件安装时会自动注册 agent 定义，opencode.json 中的定义是**全局覆盖**。

**建议**：如果使用插件内置 agents（推荐），在 opencode.json 中**删除** agent 配置块，让插件 agents 目录中的定义生效。

---

## 五、OMO 子智能体 prompt_append 指导

### 5.1 核心原则

每个 OMO 子智能体的 `prompt_append` 应包含**记忆工具使用指导**，确保智能体知道：
1. **何时**使用记忆工具（触发条件）
2. **如何**使用记忆工具（参数选择）
3. **什么**内容值得保存（过滤标准）

### 5.2 Sisyphus（主协调器）→ memory_search + memory_write

```jsonc
"sisyphus": {
  "prompt_append": "每次调度必须说明：选择该智能体的理由、预期输出、失败回退方案。\n\n## 记忆工具使用规范\n\n### 任务前：搜索历史\n收到任务后，先用 memory_search 搜索相关历史方案：\n- memory_search(query=\"任务关键词\", mode=\"hybrid\", level=1)\n- 如果找到相关记忆，读取详情：memory_read(entry_id=\"xxx\", level=2)\n\n### 任务后：保存决策\n任务完成后，保存关键决策和方案：\n- memory_write(content=\"完整方案\", abstract=\"一句话摘要\", overview=\"关键要点\", type=\"general\", tags=[\"task\",\"decision\"])\n- **绝不省略 abstract 和 overview**\n\n### 调度子智能体时：传递记忆上下文\n在给子智能体的指令中包含相关记忆 ID，让子智能体用 memory_read 加载上下文。"
}
```

### 5.3 Prometheus（规划器）→ memory_timeline + memory_topics + memory_search

```jsonc
"prometheus": {
  "prompt_append": "计划必须包含：任务分解树、依赖关系、验收标准、风险清单、回滚方案。\n\n## 记忆工具使用规范\n\n### 规划前：了解项目全貌\n制定计划前，先用浏览工具了解项目当前状态：\n- memory_timeline(days=7, level=1) — 查看最近 7 天活动\n- memory_topics(min_entries=3) — 发现活跃主题\n\n### 规划中：避免重复造轮子\n- memory_search(query=\"相关功能/架构方案\", level=1) — 搜索是否有现成方案\n- 如果找到：在计划中引用记忆 ID，标注「已有方案，需验证」\n- 如果未找到：标注「需新设计，完成后保存」\n\n### 规划后：保存计划摘要\n- memory_write(content=\"计划完整内容\", abstract=\"计划名称和目标\", overview=\"里程碑和关键决策点\", type=\"general\", tags=[\"plan\",\"project-name\"])"
}
```

### 5.4 Atlas（执行指挥）→ memory_read + memory_write

```jsonc
"atlas": {
  "prompt_append": "执行时必须：检查 Worker 可用性、分配任务时说明选择理由、监控超时和错误。\n\n## 记忆工具使用规范\n\n### 执行前：加载计划上下文\n- 如果 Prometheus 传递了记忆 ID，用 memory_read(level=2) 加载\n- 搜索相关技术方案：memory_search(query=\"实现技术\", level=1)\n\n### 执行中：记录关键发现\n- 遇到问题时搜索解决方案：memory_search(query=\"错误信息/问题关键词\")\n- 找到方案后立即保存以备后续：memory_write(type=\"code\", tags=[\"solution\",\"bugfix\"])\n\n### 执行后：保存实现方案\n- memory_write(content=\"最终实现方案\", abstract=\"实现了什么功能\", overview=\"关键实现细节和注意事项\", type=\"code\", tags=[\"implementation\",\"feature\"])"
}
```

### 5.5 Oracle（架构师）→ memory_graph + memory_search + memory_relate

```jsonc
"oracle": {
  "prompt_append": "架构建议必须包含：可扩展性评估、安全性分析、性能考量、备选方案对比。\n\n## 记忆工具使用规范\n\n### 架构设计前：追溯历史决策\n- memory_graph(memory_id=\"相关模块ID\", depth=2) — 追溯架构演进脉络\n- memory_search(query=\"架构决策/技术选型\", mode=\"hybrid\", level=1)\n- 了解为什么选择了当前架构，避免推翻后重建\n\n### 架构设计后：建立关联\n- memory_write(content=\"架构方案\", abstract=\"架构目标和核心决策\", overview=\"技术栈、模块划分、关键接口\", type=\"long-term\", tags=[\"architecture\",\"design\"])\n- memory_relate(action=\"create\", from_id=\"新方案ID\", to_id=\"旧方案ID\", relation_type=\"supersedes\") — 建立架构演进链\n\n### 核心习惯：架构追溯\n每次架构决策前，用 memory_graph 查看历史决策链。理解\"为什么\"比设计\"怎么做\"更重要。"
}
```

### 5.6 Momus（审查者）→ memory_search + memory_write（只保存可复用模式）

```jsonc
"momus": {
  "prompt_append": "审查意见必须具体到：文件路径、行号范围、问题等级、改进代码示例。\n\n## 记忆工具使用规范\n\n### 审查前：加载项目规范\n- memory_search(query=\"代码规范/风格约定\", level=1)\n- memory_search(query=\"已知问题/技术债务\", level=1)\n\n### 审查后：保存模式\n- 发现的共性问题 → memory_write(type=\"preference\", tags=[\"code-review\",\"pattern\"])\n- 不要保存单次审查结果，只保存可复用的模式和规则"
}
```

### 5.7 Librarian（OMO 知识管理）→ memory_search(level=0→1→2) + memory_graph

```jsonc
"librarian": {
  "prompt_append": "检索结果必须标注：信息来源、最后更新时间、可信度评级。\n\n## 记忆工具使用规范\n\n### 检索时：使用渐进加载\n- memory_search(query=\"检索关键词\", level=0) — 先扫描摘要列表\n- 发现相关 → memory_read(entry_id=\"xxx\", level=1) — 加载概述确认\n- 确认需要 → memory_read(entry_id=\"xxx\", level=2) — 加载完整内容\n\n### 整理时：建立关联\n- memory_topics(min_entries=5) — 发现主题聚类\n- memory_relate(action=\"create\", relation_type=\"related\") — 连接相关知识\n- memory_graph(memory_id=\"xxx\", depth=2) — 发现隐藏关联\n\n### 核心习惯：渐进加载\n永远不要一开始就用 level=2 加载大量内容。先 0 后 1 再 2。"
}
```

### 5.8 Explore（探索者）→ memory_search(level=0) + memory_write

```jsonc
"explore": {
  "prompt_append": "原型代码必须标注：TODO、FIXME、HACK。明确区分实验性和生产就绪代码。\n\n## 记忆工具使用规范\n\n### 探索前：快速扫描已有知识\n- memory_search(query=\"探索主题\", mode=\"hybrid\", level=0) — 快速扫描摘要\n- 避免重复探索已有方案\n\n### 探索后：区分质量\n- 有价值的发现 → type=\"long-term\", pinned=true\n- 实验性原型 → type=\"daily\", tags=[\"prototype\",\"TODO\"]\n- 废弃方案 → type=\"daily\", tags=[\"HACK\",\"deprecated\"]"
}
```

### 5.9 Metis（评审专家）→ memory_search + memory_write

```jsonc
"metis": {
  "prompt_append": "评审报告必须包含：1) 严重/高/中/低优先级问题分类 2) 每个问题的具体文件路径和行号 3) 重构建议代码示例 4) 正面反馈\n\n## 记忆工具使用规范\n\n### 评审前：加载上下文\n- memory_search(query=\"项目规范/评审标准\", level=1)\n- memory_search(query=\"历史评审发现的问题\", level=0) — 避免重复报告\n\n### 评审后：沉淀知识\n- 新发现的代码模式 → memory_write(type=\"preference\")\n- 严重问题的解决方案 → memory_write(type=\"code\", tags=[\"bugfix\",\"security\"])"
}
```

### 5.10 Sisyphus-Junior（初级开发者）→ memory_search（只搜索不保存）

```jsonc
"sisyphus-junior": {
  "prompt_append": "编码前必须先输出《实现 Spec》。严禁擅自修改用户未要求的规范。\n\n## 记忆工具使用规范\n\n### 编码前：加载规范\n- memory_search(query=\"代码规范/风格指南\", level=1)\n\n### 编码后：不要保存\n- Junior 不负责保存知识，只负责执行\n- 如果发现了重要模式，报告给 Sisyphus 由其保存"
}
```

### 5.11 OpenCode-Builder（代码工匠）→ memory_search + memory_write

```jsonc
"OpenCode-Builder": {
  "prompt_append": "编写代码时必须：1) 遵循项目现有代码风格 2) 添加必要的注释说明复杂逻辑 3) 考虑边界情况和错误处理 4) 输出完整的可运行代码而非片段\n\n## 记忆工具使用规范\n\n### 实现前：搜索参考实现\n- memory_search(query=\"类似功能/设计模式/实现方案\", level=1)\n- memory_search(query=\"已知陷阱/常见错误\", level=0)\n\n### 实现后：保存可复用模式\n- 通用设计模式 → memory_write(type=\"code\", tags=[\"pattern\",\"reusable\"])\n- 项目特定约定 → memory_write(type=\"preference\")"
}
```

### 5.12 Multimodal-Looker（视觉分析师）→ memory_search + memory_write

```jsonc
"multimodal-looker": {
  "prompt_append": "分析图像时必须：1) 详细描述视觉元素 2) 指出潜在的可访问性问题 3) 对比设计规范时标注具体差异 4) 如涉及代码实现，给出具体的CSS/样式建议\n\n## 记忆工具使用规范\n\n### 分析时：参考已有设计规范\n- memory_search(query=\"UI设计规范/组件库约定/样式指南\", level=1)\n\n### 分析后：保存设计决策\n- UI 组件规范 → memory_write(type=\"preference\", tags=[\"ui\",\"design\"])"
}
```

---

## 六、插件内置代理完整定义

### 6.1 The Observer（@memory-automation）

**文件**: `opencode-memory-plugin/agents/memory-automation.md`

**完整定义**：

```yaml
---
description: 'Memory Observer — analyzes conversations and extracts
  valuable insights. Returns ONLY high-confidence candidates. Never saves;
  only proposes.'
mode: primary
model: anthropic/claude-sonnet-4-20250514
tools:
  memory_search: true
  memory_suggest: true
  memory_timeline: true
  memory_topics: true
  bash: false
  write: false
  edit: false
  read: false
  # 注意：不配置 memory_write，Observer 只能分析和报告，不能保存
---

你是记忆观察者（The Observer）。你的职责是分析对话，识别值得保存的信息。

**关键规则：你只配置了读取类工具（memory_search/memory_suggest/memory_timeline/memory_topics），没有 memory_write。你只能分析和报告，不能执行保存。主代理会在用户确认后执行保存。**
```

**工作流**：

```text
用户按 Tab 切换到 The Observer
    ↓
分析当前对话上下文
    ↓
对每条候选调用 memory_search 查重
    ↓
┌─────────────────────────────────────────────┐
│ 高置信候选（可直接保存）                     │
│   类型 / Abstract / Overview / Tags         │
├─────────────────────────────────────────────┤
│ 隐式发现（需要确认）                         │
│   行为模式 / 推断偏好                       │
└─────────────────────────────────────────────┘
    ↓
用户选择：Save 1 / Save all / Save N / Edit / Discard
    ↓
切换回主代理，主代理执行 memory_write
```

**关键设计决策**：

| 决策 | 原因 |
|------|------|
| `mode: primary` | subagent 无法与用户多轮交互，Human-in-the-loop 需要用户直接对话 |
| 无 `memory_write` | 只分析不保存，防止绕过用户确认 |
| `model: claude-sonnet-4` | 指令遵循更强，避免跳过确认步骤 |
| `bash/write/edit/read: false` | 最小权限原则，只做记忆分析 |

**过滤规则**（命中任意一条即拒绝）：

1. 通用教程（git/npm/docker 常见操作）
2. 常见错误 + 常见修复
3. 通用最佳实践（"写测试"、"代码要整洁"）
4. 仅复述对话，无提炼
5. 模糊偏好（"我喜欢好代码"）
6. 无项目上下文（适用于任何人/任何项目）

**终极判断**：在 Google 搜索这段内容，30 秒内能找到同样质量的答案吗？如果能 → **拒绝**。

### 6.2 The Librarian（@memory-consolidate）

**文件**: `opencode-memory-plugin/agents/memory-consolidate.md`

**完整定义**：

```yaml
---
description: 'Automatically organizes and summarizes recent memory logs.
  Runs periodically to consolidate fragmented information into high-value
  knowledge graphs.'
mode: subagent
model: anthropic/claude-haiku-4-20250514
tools:
  memory_write: true
  memory_read: true
  memory_search: true
  memory_suggest: true
  memory_timeline: true
  memory_topics: true
  memory_relate: true
  memory_graph: true
  memory_pin: true
  incremental_sync: true
  conflict_list: true
  conflict_resolve: true
  bash: false
  write: false
  edit: false
  read: false
permission:
  memory_write: allow
  memory_read: allow
  memory_search: allow
  memory_suggest: allow
  memory_timeline: allow
  memory_topics: allow
  memory_relate: allow
  memory_graph: allow
  memory_pin: allow
  incremental_sync: allow
  conflict_list: allow
  conflict_resolve: allow
---

You are the Memory Consolidation Agent (The Librarian). Your purpose is to
maintain a healthy memory system by discovering fragmented daily logs,
synthesizing them into high-value knowledge, and building semantic graph
relations.

**CRITICAL RULE: You NEVER use bash to move or delete files. You ONLY interact
with the memory system via the provided MCP tools.**
```

**S.O.P.（标准操作流程）**：

```text
Step 1: 发现碎片
    memory_timeline(days=7, level=1) + memory_topics
    寻找：多步骤调试→最终方案、演进偏好、碎片决策
    ↓
Step 2: 聚合提炼
    3-5 条碎片 → 1 条高价值 long-term/convention 节点
    格式：abstract（≤100字）+ overview（≤500字）+ content（完整）
    ↓
Step 3: 图谱织网
    memory_relate(action="create", from_id="新节点", to_id="旧碎片",
                  relation_type="summarizes", weight=1.0)
    ↓
Step 4: 置顶关键
    如果是关键项目约定 → memory_pin(entry_id="新节点", action="pin")
    ↓
Step 5: 静默同步
    incremental_sync(dry_run=false)
```

**输出格式**：

```markdown
📚 **Memory Consolidation Complete**

I have analyzed recent memories and synthesized the following knowledge graph:

**1. [Synthesized Node Abstract]** (ID: xxx)
- Summarized 3 fragmented daily notes.
- Pinned: Yes 📌
- Relations created: 3

**Sync Status**: Incremental sync completed successfully.
```

**关键设计决策**：

| 决策 | 原因 |
|------|------|
| `mode: subagent` | 由主代理通过 @memory-consolidate 触发，不需要用户交互 |
| 全部记忆工具 | 需要读取、写入、关联、同步 |
| `model: claude-haiku-4` | 成本更低，整合任务不需要深度推理 |
| `bash/write/edit/read: false` | 禁止文件操作，只通过 MCP 工具操作记忆 |

### 6.3 代理红线（禁止行为）

- **禁止** 代理使用 `bash` 对记忆目录进行物理文件操作（移动、删除、重命名）
- **禁止** 代理绕过 Human-in-the-loop 直接批量写入（memory-automation）
- **禁止** 代理使用已废弃工具（`list_daily`、`batch_resolve`、`full_sync` 等）
- **禁止** `memory_write` 省略 `abstract` 或 `overview` 字段

---

## 七、v3.2 Atom/Entity/Reference 工作流

### 7.1 架构概览

```text
┌───────────────────────────────────────────────────────────┐
│  Atom（原子）— 最小语义单元                                │
│  ├── function   函数定义                                   │
│  ├── class      类定义                                     │
│  ├── import     导入语句                                   │
│  ├── type       类型定义                                   │
│  └── variable   变量定义                                   │
└───────────────────────┬───────────────────────────────────┘
                        ↓ 组合
┌───────────────────────────────────────────────────────────┐
│  Entity（实体）— 语义聚合单元                              │
│  ├── memory    记忆条目                                   │
│  ├── backlog   待办事项（状态机）                           │
│  ├── code      代码文件（关联多个 Atom）                   │
│  └── wiki      文档条目（⚠️ 预留）                        │
└───────────────────────┬───────────────────────────────────┘
                        ↓ 连接
┌───────────────────────────────────────────────────────────┐
│  Reference（关系）— 语义连接（14 种类型）                  │
│  ├── calls / imports / extends / implements（代码关系）    │
│  ├── depends_on / related / follow_up / elaboration（语义）│
│  ├── contradiction / reference / derived_from / similar_to│
│  ├── wiki_link / part_of（结构关系）                       │
│  └── wiki_link（⚠️ 预留）                                │
└───────────────────────────────────────────────────────────┘
```

### 7.2 代码分析工作流（文件保存自动触发）

```text
开发者保存文件: src/utils/helper.js
    ↓
code-analysis-service.js 监听到 file.saved 事件
    ↓
Step 1: 指纹检查
    CodeFingerprint.compute(filePath, content)
    与缓存对比 → 未变更则跳过
    ↓
Step 2: AST 分析
    CodeAnalyzer.analyze(content, language)
    提取：函数、类、导入、类型、变量
    ↓
Step 3: 隐私过滤
    PrivacyFilter.shouldSkipFile(filePath) → 跳过敏感文件
    ↓
Step 4: 创建 Atom（顺序创建，非并行）
    createAtom({ type: "function", name: "formatDate", ... })
    createAtom({ type: "function", name: "parseJSON", ... })
    createAtom({ type: "import", name: "lodash", ... })
    ↓
Step 5: 创建 Entity
    createEntity({
      type: "code",
      abstract: "JavaScript file: src/utils/helper.js (2 functions)",
      atoms: [atom1, atom2, atom3],
      file_path: "src/utils/helper.js"
    })
    ↓
Step 6: 创建 Reference
    createReference({ from_id: "entity:xxx", to_id: "atom:formatDate",
                      type: "part_of" })
    createReference({ from_id: "atom:formatDate", to_id: "atom:moment",
                      type: "calls" })
    ↓
Step 7: 存储到后端
    SurrealDB + Meilisearch 索引
```

### 7.3 Backlog 管理工作流

```text
创建 Backlog
    ↓
createEntity({
  type: "backlog",
  abstract: "实现用户认证系统",
  status: "backlog",  // backlog→in_progress→review→done→cancelled
  priority: "P0",
  tags: ["feature", "auth"]
})
    ↓
分配开发任务 → Atlas/Sisyphus-Junior 执行
    ↓
保存代码文件 → 自动创建 code Entity
    ↓
建立关联:
createReference({
  from_id: "entity:code-file",
  to_id: "entity:backlog-item",
  type: "implements"
})
    ↓
开发完成 → 更新状态:
updateEntity({ id: "entity:xxx", status: "done" })
    ↓
The Librarian 整合到长期记忆
```

### 7.4 知识图谱遍历工作流

```text
场景：Oracle 需要了解某个架构决策的演进历史

Step 1: 搜索目标决策
    memory_search(query="数据库选型决策", mode="hybrid", level=1)
    找到: "从 PostgreSQL 迁移到 SurrealDB 的决策" (ID: xxx)
    ↓
Step 2: 图谱遍历
    memory_graph(memory_id="xxx", depth=2)
    结果:
    ├── [summarizes] ← "数据库迁移总结" (综合版)
    ├── [supersedes] ← "PostgreSQL 配置方案" (旧方案)
    ├── [elaboration] → "SurrealDB 性能测试报告"
    ├── [depends_on] → "SurrealDB Docker 部署指南"
    └── [contradiction] ← "为什么不用 SQLite" (反面论证)
    ↓
Step 3: 加载关键节点
    memory_read(entry_id="迁移总结", level=2)
    memory_read(entry_id="性能测试", level=1)  // 概述即可
    ↓
Step 4: 基于完整上下文做出架构建议
```

### 7.5 Atom/Entity API 调用示例

```javascript
import { WrapperClient } from './wrapper-client.js';
const client = new WrapperClient();

// ===== 创建 Atom =====
const atom = await client.createAtom({
  type: "function",
  name: "calculateTotal",
  content: "function calculateTotal(items) { ... }",
  signature: "calculateTotal(items: Item[]): number",
  params: ["items"],
  return_type: "number",
  is_exported: true,
  is_async: false,
  start_line: 42,
  end_line: 56,
});

// ===== 创建 Entity =====
const entity = await client.createEntity({
  type: "code",
  abstract: "JavaScript file: src/utils.js (5 functions)",
  overview: "Utility functions for data processing",
  atoms: ["atom:1", "atom:2", "atom:3"],
  tags: ["javascript", "utils"],
  project: "my-project",
  file_path: "src/utils.js",
});

// ===== 创建 Reference =====
const ref = await client.createReference({
  from_id: "entity:caller",
  to_id: "atom:callee",
  type: "calls",
  weight: 0.8,
  metadata: { line: 42, column: 10 },
});

// ===== 查询 References =====
const refs = await client.queryReferences({
  from_id: "entity:xxx",
  type: "calls",
  limit: 50,
});
```

### 7.6 端口变更说明

| 版本 | 端口 | 状态 |
|------|------|------|
| v3.1 及之前 | 17999 | ❌ 已废弃 |
| v3.2+ | 18008 | ✅ 当前 |

```bash
# 验证后端
curl http://localhost:18008/health

# 如仍使用旧端口，更新配置
# memory-config.json: "apiPort": 18008
# 环境变量: export API_PORT=18008
```

---

## 八、OMO × 插件代理交互协议

### 8.1 代理层级与职责

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 5: OMO 编排层                                        │
│                                                              │
│  ┌──────────┐  ┌────────────┐  ┌────────┐                   │
│  │ Sisyphus │→│ Prometheus │→│ Atlas  │                       │
│  │ (协调)   │  │ (规划)     │  │ (执行) │                      │
│  └────┬─────┘  └────────────┘  └───┬────┘                   │
│       │                             │                         │
│       │    ┌────────┐  ┌────────┐  │                         │
│       └───→│ Oracle │  │ Explore │←─┘                         │
│            │ (架构) │  │ (探索)  │                            │
│            └────────┘  └────────┘                            │
│                                                              │
│  协作模式：Sisyphus 通过 Task 工具调用 subagent               │
├──────────────────────────────────────────────────────────────┤
│  Layer 3: 插件代理层                                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │ The Observer │  │ The Librarian │                          │
│  │ (primary)    │  │ (subagent)   │                          │
│  │ Tab 切换触发  │  │ @mention 触发 │                          │
│  └──────────────┘  └──────────────┘                          │
│                                                              │
│  协作模式：独立于 OMO，通过 OpenCode 框架注册                  │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 OMO 智能体如何使用插件代理

**场景 1：Sisyphus 任务完成后触发 Observer**

```text
Sisyphus 完成一个复杂编码任务
    ↓
Sisyphus prompt_append 指示：保存关键决策
    ↓
Sisyphus 调用 memory_write（直接保存，不经过 Observer）
    ↓
会话结束时，用户 Tab 切换到 The Observer
    ↓
Observer 分析整段对话，发现 Sisyphus 遗漏的信息
    ↓
Observer 提出候选 → 用户确认 → 主代理保存
```

> **注意**：OMO 智能体**不能**直接调用 The Observer。Observer 是 primary 模式，需要用户手动 Tab 切换。

**场景 2：Prometheus 规划后触发 Librarian**

```text
Prometheus 制定计划
    ↓
计划中包含建议：@memory-consolidate 整合历史知识
    ↓
主代理执行：调用 The Librarian subagent
    ↓
The Librarian 执行 S.O.P.
    ├── memory_timeline(days=7, level=1) — 发现碎片
    ├── memory_write — 聚合提炼
    ├── memory_relate — 织网
    ├── memory_pin — 置顶
    └── incremental_sync — 同步
    ↓
返回整合报告给主代理
```

> **The Librarian 是 subagent**，可以被主代理通过 @mention 触发。OMO 智能体在 prompt 中可以建议用户触发 Librarian。

**场景 3：Oracle 架构追溯使用 memory_graph**

```text
Oracle 接到架构审查任务
    ↓
Oracle 调用 memory_search 搜索相关架构决策
    ↓
Oracle 调用 memory_graph(memory_id="xxx", depth=2) 追溯决策链
    ↓
基于图谱上下文，Oracle 给出架构建议
    ↓
Oracle 调用 memory_relate 建立新关联
    ↓
Oracle 调用 memory_write 保存架构决策
```

### 8.3 工具权限隔离矩阵

| 工具 | Sisyphus | Prometheus | Atlas | Oracle | Momus | Librarian (OMO) | Explore | Observer (插件) | Librarian (插件) |
|------|:--------:|:----------:|:-----:|:------:|:-----:|:---------------:|:-------:|:---------------:|:----------------:|
| `memory_write` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `memory_read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `memory_search` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_suggest` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_timeline` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_topics` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `memory_relate` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `memory_graph` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `memory_pin` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `index_status` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `incremental_sync` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `rebuild_index` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `conflict_list` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `conflict_resolve` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |

> **关键隔离**：Observer（插件）只有搜索/浏览工具，没有写入/同步/图谱工具。这是 Human-in-the-loop 安全机制的基石。

---

## 九、五层架构工具权限矩阵

### 9.1 按层分类

| 层级 | 组件 | 可用工具 | 说明 |
|------|------|---------|------|
| **L5** | OMO Sisyphus | 全部 15 工具 + Atom/Entity API | 编排需要最大权限 |
| **L5** | OMO Prometheus | 浏览 + 搜索 + 写入 + 同步 | 规划需要历史上下文 |
| **L5** | OMO Oracle | 图谱 + 搜索 + 写入 + 关联 | 架构追溯需要图谱 |
| **L5** | OMO Explore | 搜索 + 写入（精简） | 探索只需要基本工具 |
| **L5** | OMO Junior | 搜索（只读） | Junior 不负责保存 |
| **L3** | Plugin Observer | 搜索 + 浏览（只读） | Human-in-the-loop |
| **L3** | Plugin Librarian | 全部记忆工具 + 同步 | 自动整合 |

### 9.2 按功能分层

```text
┌─────────────────────────────────────────────────────────────┐
│  写入层 (Write Layer)                                       │
│  memory_write, memory_pin, memory_relate                    │
│  ├── 需要人工确认：Observer（无写入权限）                    │
│  └── 可自动写入：Librarian, Sisyphus, Prometheus, Oracle    │
├─────────────────────────────────────────────────────────────┤
│  读取层 (Read Layer)                                        │
│  memory_read, memory_search, memory_suggest                 │
│  ├── 所有智能体可用                                         │
│  └── 推荐渐进加载：level=0 → level=1 → level=2             │
├─────────────────────────────────────────────────────────────┤
│  浏览层 (Browse Layer)                                      │
│  memory_timeline, memory_topics                             │
│  ├── 所有智能体可用                                         │
│  └── 用于了解项目全貌                                       │
├─────────────────────────────────────────────────────────────┤
│  图谱层 (Graph Layer)                                       │
│  memory_graph, memory_relate                                │
│  ├── Oracle（架构追溯）                                      │
│  ├── Librarian（知识织网）                                   │
│  └── Prometheus/Sisyphus（上下文连接）                       │
├─────────────────────────────────────────────────────────────┤
│  同步层 (Sync Layer)                                        │
│  index_status, incremental_sync, rebuild_index,             │
│  sync_checkpoint, conflict_list, conflict_resolve           │
│  ├── Sisyphus（全局监控）                                    │
│  ├── Librarian（整合后同步）                                 │
│  └── 其他智能体一般不需要                                    │
├─────────────────────────────────────────────────────────────┤
│  代码分析层 (Code Analysis Layer)  ⚠️ v3.2 实验性           │
│  createAtom, createEntity, createReference                  │
│  ├── 自动触发（文件保存时）                                  │
│  ├── WrapperClient API（非 MCP 工具）                       │
│  └── 未来可能暴露为 MCP 工具                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 十、验证与故障排查

### 10.1 升级后验证清单

```powershell
# 1. 验证 JSON 语法
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$json = Get-Content "$env:USERPROFILE\.config\opencode\oh-my-opencode.json" -Raw | ConvertFrom-Json
Write-Output "✅ OMO 配置 JSON 语法正确"

# 2. 检查是否还有旧工具引用
$content = Get-Content "$env:USERPROFILE\.config\opencode\oh-my-opencode.json" -Raw
if ($content -match 'list_daily|init_daily') {
    Write-Output "⚠️ 仍包含旧工具引用：list_daily 或 init_daily"
} else {
    Write-Output "✅ 无旧工具引用"
}

# 3. 检查 opencode.json
$config = Get-Content "$env:USERPROFILE\.config\opencode\opencode.json" -Raw | ConvertFrom-Json
if ($config.tools.'init_daily' -or $config.tools.'list_daily') {
    Write-Output "⚠️ opencode.json 仍包含旧工具引用"
} else {
    Write-Output "✅ opencode.json 工具配置已更新"
}

# 4. 验证后端连接
try {
    $health = (Invoke-WebRequest -Uri "http://localhost:18008/health" -TimeoutSec 5).Content
    Write-Output "✅ 后端服务正常: $health"
} catch {
    Write-Output "❌ 后端服务不可用: $($_.Exception.Message)"
}
```

### 10.2 OpenCode 中功能验证

在 OpenCode 对话中依次测试：

```text
# 1. 测试搜索
memory_search query="测试" mode="keyword" level=0

# 2. 测试时间线（替代 list_daily）
memory_timeline days=7 level=1

# 3. 测试主题浏览
memory_topics

# 4. 测试状态检查
index_status detailed=true

# 5. 测试写入
memory_write content="配置升级验证" abstract="v3.2 配置升级验证" overview="OMO 工具版本升级完成" type="general"

# 6. 测试自动补全
memory_suggest prefix="memory" limit=5

# 7. 测试同步
incremental_sync dry_run=true
```

### 10.3 常见问题

| 问题 | 症状 | 解决方案 |
|------|------|---------|
| 旧工具名仍出现 | `list_daily is not a function` | 检查 oh-my-opencode.json 和 opencode.json |
| Observer 有 write 权限 | Observer 自动保存 | 检查 opencode.json agent 配置，确保无 memory_write |
| 后端连接失败 | `Unable to connect to localhost:18008` | 检查端口是否从 17999 迁移 |
| 搜索无结果 | hybrid 模式返回空 | 检查 MODELSCOPE_API_KEY 和后端健康 |
| WebSocket 断连 | 实时同步不工作 | 检查 websocket.enabled 配置 |
| 图谱查询失败 | `memory_graph` 返回错误 | 确认后端 SurrealDB 运行正常 |

---

## 附录：完整配置文件参考

### A. 升级后的 oh-my-opencode.json tools 配置

以下是每个 category 升级后的完整 tools 配置（仅展示 tools 部分）：

```jsonc
{
  "categories": {
    "universal": {
      "description": "全功能无限制智能体模板",
      "model": "zhipuai-coding-plan/glm-5-turbo",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true, "memory_pin": true,
        "index_status": true, "rebuild_index": true,
        "incremental_sync": true, "sync_checkpoint": true,
        "conflict_list": true, "conflict_resolve": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "ultrabrain": {
      "description": "超高难度、需要极限推理的复杂逻辑任务",
      "model": "zhipuai-coding-plan/glm-5.1",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true, "memory_pin": true,
        "index_status": true, "rebuild_index": true,
        "incremental_sync": true, "sync_checkpoint": true,
        "conflict_list": true, "conflict_resolve": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "deep": {
      "description": "深度自主调研与执行、复杂问题解决",
      "model": "zhipuai-coding-plan/glm-5-turbo",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true, "memory_pin": true,
        "index_status": true, "rebuild_index": true,
        "incremental_sync": true, "sync_checkpoint": true,
        "conflict_list": true, "conflict_resolve": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": true, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "artistry": {
      "description": "非常规创造性方法、创新解决方案",
      "model": "zhipuai-coding-plan/glm-5-turbo",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true,
        "index_status": true, "incremental_sync": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": false, "Bash": false, "WebFetch": true,
        "Task": true, "TodoWrite": true, "Think": true
      }
    },
    "quick": {
      "description": "简单任务 - 单文件更改、拼写修复",
      "model": "opencode/minimax-m2.5-free",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true,
        "index_status": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": false, "WebFetch": false,
        "Task": false, "TodoWrite": false, "Think": false
      }
    },
    "writing": {
      "description": "文档、散文、技术写作",
      "model": "zhipuai-coding-plan/glm-5-turbo",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true, "memory_pin": true,
        "index_status": true, "incremental_sync": true,
        "Read": true, "Write": true, "Edit": true,
        "LSP": true, "Bash": false, "WebFetch": true,
        "Task": false, "TodoWrite": false, "Think": true
      }
    },
    "visual-engineering": {
      "description": "视觉工程与UI实现",
      "model": "zhipuai-coding-plan/glm-4.6v",
      "tools": {
        "memory_write": true, "memory_read": true,
        "memory_search": true, "memory_suggest": true,
        "memory_timeline": true, "memory_topics": true,
        "memory_relate": true, "memory_graph": true,
        "index_status": true, "incremental_sync": true
      }
    }
  }
}
```

### B. 升级后的 opencode.json

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "~/.opencode/memory/SOUL.md",
    "~/.opencode/memory/AGENTS.md",
    "~/.opencode/memory/USER.md",
    "~/.opencode/memory/IDENTITY.md",
    "~/.opencode/memory/TOOLS.md",
    "~/.opencode/memory/MEMORY.md"
  ],
  "model": "provider-auth-big/glm-5",
  "plugin": ["oh-my-opencode@latest"],
  "tools": {
    "memory_write": true, "memory_read": true,
    "memory_search": true, "memory_suggest": true,
    "memory_timeline": true, "memory_topics": true,
    "memory_relate": true, "memory_graph": true, "memory_pin": true,
    "index_status": true, "rebuild_index": true,
    "incremental_sync": true, "full_sync": true,
    "sync_checkpoint": true, "conflict_list": true, "conflict_resolve": true
  }
}
```

> **建议**：删除 opencode.json 中的 `agent` 配置块，让插件内置 agents 目录定义代理。

### C. 环境变量清单

```bash
# 必须
export WRAPPER_MEILI_API_KEY="your-api-key"      # 后端认证
export MODELSCOPE_API_KEY="your-modelscope-key"  # Embedding 服务

# 可选覆盖
export API_PORT=18008                             # 后端端口（默认 18008）
export API_HOST=localhost                         # 后端地址
export WS_ENABLED=true                            # WebSocket 开关
```

### D. 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 最佳实践 | [BEST-PRACTICES-v2.1.md](./BEST-PRACTICES-v2.1.md) | 五层架构 + Atom/Entity/Reference 详细指南 |
| API 契约 | [API-CONTRACT.md](./API-CONTRACT.md) | 工具↔后端 API 映射 |
| 原版指南 | [OPENCODE-SETUP-GUIDE.md](./OPENCODE-SETUP-GUIDE.md) | 通用配置指南（模板版） |
| 插件开发 | [../AGENTS.md](../AGENTS.md) | 插件开发指南 |

### E. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-04-23 | 初始版本，基于真实配置文件逆向分析 |

---

*本文档基于以下真实配置文件分析生成：*

- *`~/.config/opencode/oh-my-opencode.json`（771 行）*
- *`~/.config/opencode/opencode.json`（125 行）*
- *`~/.config/opencode/AGENTS.md`（全局代理指令）*
- *`opencode-memory-plugin/plugin.js`（134 行，当前注册的 15 个工具）*
- *`opencode-memory-plugin/agents/memory-automation.md`（123 行）*
- *`opencode-memory-plugin/agents/memory-consolidate.md`（111 行）*
- *`docs/BEST-PRACTICES-v2.1.md`（1002 行）*

