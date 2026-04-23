# OpenCode + oh-my-opencode + opencode-memory-plugin 实战配置指南

**版本**: v2.0  
**更新时间**: 2026-04-23  
**适用**: OpenCode + oh-my-opencode + opencode-memory-plugin v3.2+  
**目标**: 基于真实环境配置，实现记忆系统的最佳实践

---

## 目录

1. [环境现状分析](#一环境现状分析)
2. [架构关系澄清](#二架构关系澄清)
3. [OMO 配置升级](#三omo-配置升级)
4. [插件代理定义](#四插件代理定义)
5. [实战工作流](#五实战工作流)
6. [v3.2 新架构应用](#六v32-新架构应用)
7. [验证与调试](#七验证与调试)

---

## 一、环境现状分析

### 1.1 你的实际配置文件

| 文件路径 | 作用 | 当前状态 |
|---------|------|---------|
| `C:\Users\Longray\.config\opencode\AGENTS.md` | OpenCode 全局配置 | ✅ 已配置（语言、Python规则、Windows环境） |
| `C:\Users\Longray\.config\opencode\oh-my-opencode.json` | OMO 子代理配置 | ⚠️ 工具列表过时，需要升级 |
| `D:\github\opencode-memory-plugin\AGENTS.md` | 插件开发文档 | ✅ 项目结构文档 |
| `~/.opencode/memory/memory-config.json` | 插件核心配置 | ⚠️ 需要确认是否启用 v3.2 特性 |

### 1.2 当前 OMO 配置分析

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

### 1.3 关键问题识别

1. **工具列表过时**: OMO 配置使用的是 v2.x 工具列表，缺少 v3.x 新工具
2. **缺少 v3.2 Atom/Entity/Reference 工具**: 新架构的 API 未暴露给 OMO
3. **子代理提示词未优化**: Sisyphus、Prometheus 等代理不知道如何最佳使用记忆系统
4. **插件代理与 OMO 代理关系不清**: The Observer/The Librarian 如何与 OMO 协作

---

## 二、架构关系澄清

### 2.1 三层代理架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: OMO 编排层 (oh-my-opencode.json)               │
│  ├─ Sisyphus (主协调器)                                  │
│  ├─ Prometheus (规划器)                                  │
│  ├─ Atlas (执行指挥)                                     │
│  ├─ Oracle (架构师)                                      │
│  ├─ Momus/Metis (审查者)                                 │
│  └─ Librarian/Explore (专项)                             │
│     ↓ 通过 prompt_append 指导工具使用                    │
├─────────────────────────────────────────────────────────┤
│  Layer 2: 插件代理层 (opencode-memory-plugin)            │
│  ├─ @memory-automation (The Observer)                    │
│  │   模式: primary (Tab切换)                             │
│  │   职责: 对话后萃取信息，用户确认后保存                 │
│  │                                                        │
│  └─ @memory-consolidate (The Librarian)                  │
│      模式: subagent (@触发)                              │
│      职责: 定期聚合碎片，建立图谱关联                     │
│     ↓ 通过 AGENTS.md 定义系统提示词                      │
├─────────────────────────────────────────────────────────┤
│  Layer 3: 工具层 (15个 MCP 工具)                         │
│  ├─ Core: memory_write, memory_read                      │
│  ├─ Search: memory_search, memory_suggest                │
│  ├─ Graph: memory_relate, memory_graph                   │
│  ├─ Browse: memory_timeline, memory_topics               │
│  ├─ Sync: index_status, incremental_sync, full_sync...   │
│  └─ v3.2: createAtom, createEntity, createReference...   │
│     ↓ 调用后端 API                                       │
├─────────────────────────────────────────────────────────┤
│  Layer 4: 后端服务                                       │
│  └─ SurrealDB + Meilisearch + WebSocket                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 代理关系说明

**重要澄清**: OMO 的 `librarian` 子代理 ≠ 插件的 `The Librarian`

| 代理 | 归属 | 触发方式 | 主要职责 |
|------|------|---------|---------|
| **OMO Librarian** | oh-my-opencode | Sisyphus 调度 | 知识检索、文档整理 |
| **The Librarian** | opencode-memory-plugin | `@memory-consolidate` | 记忆聚合、图谱构建 |

**协作关系**:
- OMO Librarian 负责**外部知识**的检索和整理
- The Librarian 负责**记忆系统内部**的碎片整合
- 两者可以协作：OMO Librarian 发现知识缺口 → The Librarian 整合到长期记忆

---

## 三、OMO 配置升级

### 3.1 完整工具列表更新

**文件**: `C:\Users\Longray\.config\opencode\oh-my-opencode.json`

```json
{
  "tools": {
    // Core 工具
    "memory_write": true,
    "memory_read": true,
    
    // Search 工具
    "memory_search": true,
    "memory_suggest": true,
    
    // Graph 工具
    "memory_relate": true,
    "memory_graph": true,
    
    // Browse 工具
    "memory_timeline": true,
    "memory_topics": true,
    
    // Sync 工具
    "index_status": true,
    "incremental_sync": true,
    "full_sync": true,
    "sync_checkpoint": true,
    "conflict_list": true,
    "conflict_resolve": true,
    
    // v3.2 Atom/Entity/Reference API (通过 wrapperClient)
    "createAtom": true,
    "getAtom": true,
    "listAtoms": true,
    "updateAtom": true,
    "deleteAtom": true,
    
    "createEntity": true,
    "getEntity": true,
    "listEntities": true,
    "deleteEntity": true,
    
    "createReference": true,
    "queryReferences": true,
    "deleteReference": true,
    
    // 基础工具
    "Read": true,
    "Write": true,
    "Edit": true,
    "LSP": true,
    "Bash": true,
    "WebFetch": true,
    "Task": true,
    "TodoWrite": true,
    "Think": true
  }
}
```

### 3.2 子代理 prompt_append 升级

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
      "prompt_append": "规划时的记忆系统使用：\n\n1. **历史方案检索**: 制定计划前，执行：\n   ```\n   memory_search(query='类似功能实现', mode='hybrid', limit=5)\n   memory_timeline(days=30, level=1)  // 查看近期相关决策\n   ```\n\n2. **Backlog 管理**: 创建任务时：\n   ```\n   createEntity({\n     type: 'backlog',\n     abstract: '任务标题',\n     overview: '任务描述',\n     status: 'backlog',\n     priority: 'P0' | 'P1' | 'P2'\n   })\n   ```\n\n3. **依赖关系建立**: 任务间有关联时：\n   ```\n   createReference({\n     from_id: 'backlog:task-a',\n     to_id: 'backlog:task-b',\n     type: 'depends_on' | 'follow_up'\n   })\n   ```\n\n4. **计划保存**: 将最终计划保存为记忆：\n   ```\n   memory_write({\n     type: 'plan',\n     abstract: 'XXX功能实现计划',\n     overview: '包含任务分解、依赖关系、验收标准',\n     tags: ['plan', 'backlog']\n   })\n   ```"
    }
  }
}
```

#### Atlas (执行指挥)

```json
{
  "agents": {
    "atlas": {
      "prompt_append": "执行时的记忆系统使用：\n\n1. **代码分析**: 分析文件时启用 v3.2 架构：\n   ```\n   // 分析文件提取 Atoms\n   const atoms = await analyzeWithTreeSitter(filePath, content)\n   \n   // 创建代码 Entity\n   const entity = await createEntity({\n     type: 'code',\n     abstract: `文件: ${filePath}`,\n     atoms: atoms.map(a => a.id),\n     project: projectId\n   })\n   ```\n\n2. **调用关系追踪**: 发现函数调用时：\n   ```\n   createReference({\n     from_id: entity.id,\n     to_id: targetAtom.id,\n     type: 'calls',\n     metadata: { line, column }\n   })\n   ```\n\n3. **进度更新**: 任务状态变更时更新 Backlog：\n   ```\n   // 更新状态\n   updateEntity(backlogId, { status: 'in_progress' | 'done' })\n   ```\n\n4. **经验保存**: 解决难题后立即保存：\n   ```\n   memory_write({\n     type: 'solution',\n     abstract: 'XXX问题的解决方案',\n     overview: '问题现象、根因分析、解决步骤',\n     tags: ['solution', 'troubleshooting']\n   })\n   ```"
    }
  }
}
```

#### Oracle (架构师)

```json
{
  "agents": {
    "oracle": {
      "prompt_append": "架构设计时的记忆系统使用：\n\n1. **架构历史查询**: 做决策前检索：\n   ```\n   memory_search(query='架构决策', mode='hybrid', limit=10)\n   memory_graph(memory_id='xxx', depth=2)  // 查看相关决策网络\n   ```\n\n2. **决策记录**: 架构决策必须保存：\n   ```\n   memory_write({\n     type: 'architecture',\n     abstract: '选择XXX而非YYY',\n     overview: '决策背景、选项对比、最终选择、 trade-offs',\n     tags: ['architecture', 'decision']\n   })\n   ```\n\n3. **模式提取**: 识别设计模式时创建 Entity：\n   ```\n   createEntity({\n     type: 'pattern',\n     abstract: '观察者模式实现',\n     overview: '适用场景、实现方式、优缺点',\n     tags: ['pattern', 'design']\n   })\n   ```\n\n4. **关系建立**: 架构元素间建立 Reference：\n   ```\n   createReference({\n     from_id: 'pattern:observer',\n     to_id: 'code:event-emitter',\n     type: 'implements'\n   })\n   ```"
    }
  }
}
```

---

## 四、插件代理定义

### 4.1 @memory-automation (The Observer)

**文件**: `opencode-memory-plugin/agents/memory-automation.md`

```markdown
# @memory-automation (The Observer)

## 身份
你是 The Observer，记忆系统的观察者代理。你的职责是在对话结束后，主动识别值得保存的重要信息，并向用户确认后保存到记忆系统。

## 工作模式
- **触发**: 用户 Tab 切换到你（primary 模式）
- **输入**: 当前对话的完整历史
- **输出**: 候选记忆清单，等待用户确认

## 工作流程

### Step 1: 分析对话
扫描当前对话，识别以下类型的信息：
- ✅ 重要决策及理由
- ✅ 成功的问题解决方案
- ✅ 发现的模式或最佳实践
- ✅ 用户明确表达的偏好
- ✅ 项目约定或规范
- ❌ 闲聊、测试内容
- ❌ 临时性、无长期价值的信息

### Step 2: 查重
对每条候选信息，执行：
```javascript
memory_search(query='候选信息摘要', mode='hybrid', limit=3)
```
如果找到相似度 > 0.8 的已有记忆，标记为"可能重复"。

### Step 3: 展示候选
向用户展示清单（最多 5 条）：
```
📋 发现以下值得保存的信息：

1. [decision] 使用 JWT 而非 Session 做认证
   理由：无状态、易扩展、符合 RESTful
   [Save] [Edit] [Discard]

2. [pattern] 错误处理采用 try-catch + 特定错误类型
   [Save] [Edit] [Discard]

[Save All] [Save Selected] [Discard All]
```

### Step 4: 保存确认
用户确认后，执行：
```javascript
memory_write({
  content: '完整内容...',
  abstract: '≤100字摘要',
  overview: '≤500字概述',
  type: 'decision' | 'pattern' | 'preference' | 'convention',
  tags: ['auto-saved', 'decision'],
  pinned: false
})
```

## 工具白名单
- memory_write
- memory_read
- memory_search
- memory_suggest

## 红线
- ❌ 禁止绕过用户确认直接保存
- ❌ 禁止保存测试、闲聊内容
- ❌ 禁止省略 abstract 或 overview
- ✅ 宁可漏掉，不要过度保存
```

### 4.2 @memory-consolidate (The Librarian)

**文件**: `opencode-memory-plugin/agents/memory-consolidate.md`

```markdown
# @memory-consolidate (The Librarian)

## 身份
你是 The Librarian，记忆系统的图书管理员。你的职责是定期聚合碎片化的记忆，建立知识图谱关联，并将重要约定置顶。

## 工作模式
- **触发**: 用户输入 `@memory-consolidate`
- **频率**: 建议每周运行一次
- **输入**: 时间范围内的所有记忆
- **输出**: 聚合后的高价值节点 + 图谱关系

## 工作流程 (S.O.P.)

### Step 1: 发现碎片
```javascript
// 获取近期记忆
const recent = await memory_timeline(days=7, level=1)

// 发现活跃主题
const topics = await memory_topics(min_entries=3)
```

### Step 2: 聚合提炼
识别相关碎片，聚合成单条高价值节点：
```javascript
// 示例：将多个"错误处理"相关的碎片聚合成一条
memory_write({
  content: `
    ## 异步错误处理最佳实践
    
    ### 原则
    1. 始终使用 try-catch
    2. 捕获特定错误类型
    3. 提供有意义的错误信息
    
    ### 代码示例
    \`\`\`javascript
    try {
      await riskyOperation()
    } catch (error) {
      if (error instanceof ValidationError) {
        // 处理验证错误
      } else {
        // 处理其他错误
      }
    }
    \`\`\`
  `,
  abstract: '异步错误处理最佳实践',
  overview: '汇总近期所有错误处理相关经验，提炼为可复用的模式',
  type: 'pattern',
  tags: ['consolidated', 'error-handling', 'async', 'best-practice']
})
```

### Step 3: 建立图谱关系
将聚合节点与原始碎片关联：
```javascript
// 聚合节点 summarizes 原始碎片
memory_relate({
  action: 'create',
  from_id: 'consolidated:xxx',
  to_id: 'original:yyy',
  relation_type: 'summarizes',
  weight: 0.9
})

// 相关主题间建立关联
memory_relate({
  action: 'create',
  from_id: 'pattern:error-handling',
  to_id: 'pattern:logging',
  relation_type: 'related',
  weight: 0.7
})
```

### Step 4: 置顶关键约定
识别重要的项目约定，置顶以便快速访问：
```javascript
memory_pin({
  entry_id: 'convention:code-style',
  action: 'pin'
})
```

### Step 5: 同步后端
```javascript
incremental_sync({ dry_run: false })
```

## 工具白名单
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

## 聚合策略

### 按主题聚合
- 错误处理 → 错误处理最佳实践
- 性能优化 → 性能优化指南
- 代码风格 → 项目代码规范

### 按时间聚合
- 本周所有决策 → 本周关键决策汇总
- 本月所有模式 → 本月提炼的模式

### 按项目聚合
- 项目 X 的所有记忆 → 项目 X 知识库
```

---

## 五、实战工作流

### 5.1 日常编码工作流

```
08:00 启动 OpenCode
  └─ 自动加载 OMO + 记忆插件
  └─ WebSocket 连接后端
  └─ 运行 index_status 确认健康

08:05 Sisyphus 加载上下文
  └─ memory_search(query='当前项目', limit=5)
  └─ listEntities(type='backlog', status='in_progress')
  └─ "今天有 3 个进行中的任务"

09:00 开始编码任务
  └─ 保存文件 → 自动触发代码分析
  └─ createAtom({ type: 'function', name: 'newFeature' })
  └─ createEntity({ type: 'code', atoms: [...] })
  └─ "代码已分析并建立索引"

10:30 遇到难题
  └─ memory_search(query='类似问题', mode='hybrid')
  └─ "找到 2 个相关解决方案"
  └─ 解决问题

12:00 午餐前
  └─ Tab 切换到 @memory-automation
  └─ The Observer: "发现 2 条值得保存的信息"
  └─ 用户确认保存

17:00 下班前
  └─ @memory-consolidate
  └─ The Librarian 整合今日碎片
  └─ 建立知识图谱关联
```

### 5.2 架构决策工作流

```
14:00 需要做一个架构决策
  └─ Sisyphus 调度 Oracle
  
14:05 Oracle 检索历史
  └─ memory_search(query='认证架构', mode='hybrid')
  └─ memory_graph(memory_id='xxx', depth=2)
  └─ "发现 3 个相关历史决策"

14:30 分析选项
  └─ 对比 JWT vs Session
  └─ createEntity({ type: 'decision', ... })

15:00 做出决策
  └─ memory_write({
       type: 'architecture',
       abstract: '选择 JWT 做认证',
       overview: '决策理由、trade-offs'
     })
  └─ createReference({
       from_id: 'decision:jwt',
       to_id: 'pattern:auth',
       type: 'implements'
     })

15:30 更新 Backlog
  └─ createEntity({
       type: 'backlog',
       abstract: '实现 JWT 认证',
       status: 'backlog'
     })
```

---

## 六、v3.2 新架构应用

### 6.1 何时使用 Atom/Entity/Reference

| 场景 | 使用 | 示例 |
|------|------|------|
| 分析单个函数 | Atom | `createAtom({ type: 'function', name: 'calculate' })` |
| 分析整个文件 | Entity | `createEntity({ type: 'code', atoms: [...] })` |
| 函数 A 调用函数 B | Reference | `createReference({ type: 'calls' })` |
| 创建任务 | Entity | `createEntity({ type: 'backlog' })` |
| 任务依赖关系 | Reference | `createReference({ type: 'depends_on' })` |

### 6.2 代码分析实战

```javascript
// 1. 分析文件提取 Atoms
const analysis = await codeAnalyzer.analyze('src/utils.js', content)

// 2. 为每个函数创建 Atom
const atoms = await Promise.all(
  analysis.functions.map(fn => 
    wrapperClient.createAtom({
      type: 'function',
      name: fn.name,
      content: fn.content,
      signature: fn.signature,
      params: fn.params,
      return_type: fn.returnType,
      is_exported: fn.isExported,
      start_line: fn.startLine,
      end_line: fn.endLine
    })
  )
)

// 3. 创建代码 Entity 聚合所有 Atoms
const entity = await wrapperClient.createEntity({
  type: 'code',
  abstract: `JavaScript文件: src/utils.js (${atoms.length} 个函数)`,
  overview: '工具函数集合，包含日期处理、格式化等功能',
  atoms: atoms.map(a => a.id),
  project: 'my-project',
  file_path: 'src/utils.js',
  tags: ['javascript', 'utils']
})

// 4. 发现调用关系时创建 Reference
await wrapperClient.createReference({
  from_id: entity.id,
  to_id: atoms[0].id,  // formatDate 函数
  type: 'calls',
  weight: 1.0,
  metadata: {
    line: 42,
    column: 10
  }
})
```

---

## 七、验证与调试

### 7.1 验证配置

```bash
# 1. 检查 OMO 配置
opencode config get oh-my-opencode.json

# 2. 验证工具启用
opencode exec "index_status" detailed=true

# 3. 测试记忆写入
opencode exec "memory_write" \
  --content "测试内容" \
  --abstract "测试摘要" \
  --overview "测试概述"

# 4. 测试 v3.2 API
opencode exec "createAtom" \
  --type "function" \
  --name "testFunc"
```

### 7.2 调试技巧

```bash
# 查看 OMO 代理日志
tail -f ~/.opencode/logs/agents.log | grep sisyphus

# 查看插件日志
tail -f ~/.opencode/logs/memory-plugin.log

# 查看后端日志
docker-compose logs -f backend

# 检查记忆文件
ls -la ~/.opencode/memory/timeline/
```

### 7.3 常见问题

**Q: OMO 子代理没有使用记忆工具？**  
A: 检查 `prompt_append` 是否正确配置，子代理需要明确的指导才知道何时使用工具。

**Q: v3.2 Atom API 返回 404？**  
A: 确认后端版本支持 Atom/Entity/Reference，检查 `use_atom_entity_api: true` 是否配置。

**Q: The Observer 没有自动保存？**  
A: The Observer 是 primary 模式，需要用户 Tab 切换触发，不会自动运行。

---

## 附录

### A. 完整 OMO 配置示例

[参考 3.1 和 3.2 节]

### B. 代理定义文件

[参考 4.1 和 4.2 节]

### C. 相关文档

- `BEST-PRACTICES-v2.1.md` - 最佳实践
- `API-CONTRACT.md` - API 契约
- `UNIFIED-ARCHITECTURE-v3.2.md` - 架构设计

---

**文档结束**

**版本**: D (My Version)  
**特点**: 基于真实环境、实战导向、包含完整 prompt_append 和代理定义
