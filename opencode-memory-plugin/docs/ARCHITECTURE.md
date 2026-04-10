# 系统架构文档

> **版本**: v3.0.0 → v3.2.0  
> **更新时间**: 2026-04-10  
> **状态**: 维护中

---

## 目录

1. [架构概览](#1-架构概览)
2. [插件架构](#2-插件架构)
3. [核心模块详解](#3-核心模块详解)
4. [数据流](#4-数据流)
5. [组件交互](#5-组件交互)
6. [目录结构](#6-目录结构)
7. [设计原则](#7-设计原则)
8. [相关文档](#8-相关文档)

---

## 1. 架构概览

### 1.1 系统全景

OpenCode Memory Plugin 采用 **后端优先（Backend-First）** 架构，将向量搜索、图关系、同步等重型操作委托给后端服务，插件本身保持轻量化。

```
┌───────────────────────────────────────────────────────────────┐
│                    OpenCode Host                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              MemoryPlugin (plugin.js)                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │  Tools   │ │  Agents  │ │   Lib    │ │   CLI     │  │  │
│  │  │ (16个)   │ │ (2个)    │ │ (24个)   │ │           │  │  │
│  │  └────┬─────┘ └──────────┘ └────┬─────┘ └───────────┘  │  │
│  └───────┼──────────────────────────┼──────────────────────┘  │
│          │                          │                         │
└──────────┼──────────────────────────┼─────────────────────────┘
           │                          │
           │  HTTP / WebSocket        │  本地文件 I/O
           ▼                          ▼
┌──────────────────┐    ┌──────────────────────────────────┐
│   后端服务        │    │     本地存储 (~/.opencode/memory/) │
│  localhost:17999 │    │  ┌─────────┐  ┌──────────────┐   │
│                  │    │  │ timeline/│  │ MEMORY.md    │   │
│  • SurrealDB     │    │  │ YYYY/MM/ │  │ SOUL.md ...  │   │
│  • Meilisearch   │    │  │   DD/    │  │ link-map.json│   │
│  • FastAPI       │    │  └─────────┘  └──────────────┘   │
└──────────────────┘    └──────────────────────────────────┘
```

### 1.2 技术栈

| 层级       | 技术                  | 版本     | 用途                       |
| ---------- | --------------------- | -------- | -------------------------- |
| 插件框架   | `@opencode-ai/plugin` | ^1.0.0   | OpenCode 原生集成          |
| 运行时     | Node.js               | 18+      | 插件执行环境               |
| AST 解析   | Oxc Parser            | ^0.121.0 | JavaScript/TypeScript 解析 |
| 多语言解析 | tree-sitter           | 0.25.x   | Python/Go/Rust/Java        |
| WebSocket  | ws                    | ^8.19.0  | 实时同步                   |
| 文件监听   | chokidar              | ^5.0.0   | 代码变更检测               |
| 后端数据库 | SurrealDB             | 3.0+     | 向量搜索 + 图关系          |
| 后端搜索   | Meilisearch           | 0.40.x   | 全文搜索                   |
| 后端框架   | FastAPI               | -        | Python 后端服务            |

---

## 2. 插件架构

### 2.1 入口结构

插件入口为 `plugin.js`，通过 `MemoryPlugin` 函数注册所有工具和事件监听器：

```javascript
// plugin.js (简化)
export const MemoryPlugin = async ctx => {
  const config = getConfig();

  // 注册文件保存事件 → 自动代码分析
  if (config.code_analysis?.auto_trigger !== false) {
    ctx?.on('file.saved', filePath => onFileSaved(filePath, projectRoot));
  }

  return {
    tool: {
      memory_write,
      memory_read,
      memory_pin,
      memory_search,
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
};
```

### 2.2 工具层（tools/）

16 个工具按职责分为 4 个模块：

| 模块     | 文件        | 工具                                                                                                                     | 后端依赖     |
| -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ | ------------ |
| **核心** | `core.js`   | `memory_write`, `memory_pin`                                                                                             | 同步写入     |
| **搜索** | `search.js` | `memory_search`, `memory_suggest`                                                                                        | 搜索优先后端 |
| **图谱** | `graph.js`  | `memory_relate`, `memory_graph`                                                                                          | 必须         |
| **浏览** | `browse.js` | `memory_timeline`, `memory_topics`                                                                                       | 无（本地）   |
| **同步** | `sync.js`   | `rebuild_index`, `index_status`, `incremental_sync`, `full_sync`, `sync_checkpoint`, `conflict_list`, `conflict_resolve` | 必须         |

### 2.3 核心库层（lib/）

24 个库文件按功能分组：

```
lib/
├── 记忆核心
│   ├── memory-core.js          # writeMemory, readMemory, writeAndSyncMemory
│   ├── entry.js                # buildEntryContent, writeEntryToTimeline
│   ├── extractor.js            # extractByLevel, getEntryInfo
│   ├── storage.js              # getConfig, getLinkMap, getEntryById
│   ├── constants.js            # 常量定义（路径、配置键）
│   └── ulid.js                 # ULID 生成器
│
├── 搜索引擎
│   ├── bm25.js                 # BM25 关键词搜索
│   ├── trie.js                 # Trie 数据结构
│   └── trie-index.js           # Trie 索引管理 + 自动补全
│
├── 后端通信
│   ├── wrapper-client.js       # HTTP API 客户端（所有后端调用）
│   ├── ws-client.js            # WebSocket 实时同步客户端
│   └── upload-queue.js         # 上传队列管理
│
├── 索引管理
│   ├── indexer.js              # updateLinkMap, updateMemoryIndex
│   └── memory-id-cache.js      # Memory ID 缓存管理
│
├── 代码分析（v3.0）
│   ├── code-analyzer.js        # Oxc AST 分析器
│   ├── tree-sitter-parser.js   # 多语言 AST 解析
│   ├── project-analyzer.js     # 项目健康度评级
│   ├── code-analysis-formatter.js  # 输出格式化（table/tree/json）
│   ├── code-analysis-service.js    # 批量分析队列
│   ├── code-fingerprint.js     # SHA256 变更检测
│   ├── privacy-filter.js       # 敏感内容过滤
│   └── file-watcher.js         # 文件系统监听（300ms debounce）
│
└── 工具
    └── project-resolver.js     # 项目 ID 自动检测
```

### 2.4 代理层（agents/）

两个内置自动化代理，安装时自动注册：

| 代理              | 文件                    | 模式                | 职责                           |
| ----------------- | ----------------------- | ------------------- | ------------------------------ |
| **The Observer**  | `memory-automation.md`  | primary（Tab 切换） | 对话后萃取信息，用户确认后保存 |
| **The Librarian** | `memory-consolidate.md` | subagent（@触发）   | 聚合碎片记忆，建立图谱关联     |

---

## 3. 核心模块详解

### 3.1 memory-core.js — 记忆操作核心

统一的记忆读写入口，CLI 和 Plugin 共用：

```javascript
// 写入流程
writeMemory({ abstract, overview, content, type, tags })
  → 参数验证（abstract/overview 必填）
  → buildEntryContent()     // entry.js - 生成 markdown 内容
  → writeEntryToTimeline()  // entry.js - 写入 timeline/YYYY/MM/DD/ 目录
  → updateLinkMap()         // indexer.js - 更新索引
  → updateMemoryIndex()     // indexer.js - 更新 MEMORY.md
  → syncMemoryToBackend()   // 异步同步到后端（可选）

// 读取流程
readMemory({ entry_id, level })
  → getEntryById()          // storage.js - 定位文件
  → extractByLevel()        // extractor.js - 按 L0/L1/L2 提取
  → 返回内容字符串
```

### 3.2 wrapper-client.js — 后端 API 客户端

封装所有后端 HTTP 调用，支持自动重试和错误分类：

```javascript
class WrapperClient {
  constructor(options = {})
  // 默认: localhost:17999, /api/v1

  async healthCheck()        // GET  /api/v1/health
  async search(params)       // POST /api/v1/memories/search
  async upload(entry)        // POST /api/v1/memories
  async createRelation(...)  // POST /api/v1/memories/relations
  async getRelations(id)     // GET  /api/v1/memories/{id}/relations
  async deleteRelation(id)   // DELETE /api/v1/memories/relations/{id}
  async graphTraversal(...)  // POST /api/v1/memories/graph
  async syncPreview(entries) // POST /api/v1/sync/preview
  async syncUpload(entries)  // POST /api/v1/sync/upload
}
```

### 3.3 code-analyzer.js — 代码分析引擎

基于 Oxc Parser 的 AST 分析器，支持 6 种语言：

```javascript
class CodeAnalyzer {
  analyze(filePath, source)
  // 1. 选择解析器（Oxc for JS/TS, tree-sitter for others）
  // 2. 提取符号：函数、类、接口、导入
  // 3. 计算复杂度：圈复杂度、嵌套深度
  // 4. 提取 JSDoc（仅 JS/TS）
  // 5. 返回 AnalysisResult

  extractSymbols(ast)        // 函数、类、接口
  calculateComplexity(ast)   // 圈复杂度
  extractJSDoc(comments)     // 描述、参数、返回值
}
```

### 3.4 ws-client.js — WebSocket 客户端

实时同步客户端，支持自动重连：

```javascript
class SyncWebSocketClient {
  constructor(url, tenantId = 'default')

  async connect()             // 建立连接
  async send(message)         // 发送消息
  onMessage(handler)          // 注册消息处理器
  disconnect()                // 断开连接
  // 内置：自动重连（5次，5s间隔）、消息队列、离线缓存
}
```

---

## 4. 数据流

### 4.1 记忆写入流程

```
User/Agent
    │
    ▼
memory_write(abstract, overview, content, type, tags)
    │
    ▼
┌──────────────────────────────────────────┐
│  tools/core.js                           │
│  1. 参数验证（abstract/overview 必填）     │
│  2. 生成 ULID                             │
│  3. 调用 writeAndSyncMemory()             │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  lib/memory-core.js                      │
│  writeAndSyncMemory(params)               │
│  1. writeMemory() → 写入本地文件           │
│  2. syncMemoryToBackend() → 同步后端      │
└──────────────┬───────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌────────────┐   ┌─────────────────┐
│  本地写入   │   │   后端同步        │
│            │   │                  │
│ timeline/  │   │ POST /api/v1/    │
│ YYYY/MM/DD │   │ memories         │
│ entry.md   │   │                  │
│            │   │ SurrealDB 存储   │
│ link-map   │   │ Meilisearch 索引 │
│ MEMORY.md  │   │                  │
└────────────┘   └─────────────────┘
```

### 4.2 记忆搜索流程

```
User/Agent
    │
    ▼
memory_search(query, mode, limit)
    │
    ▼
┌──────────────────────────────────────────┐
│  tools/search.js                         │
│  1. 优先尝试后端搜索                       │
│  2. 后端不可用时降级到本地搜索             │
└──────────────┬───────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌────────────┐   ┌─────────────────┐
│  后端搜索   │   │   本地搜索（降级）│
│            │   │                  │
│ hybrid:    │   │ bm25.js         │
│ 70% vector │   │ BM25 关键词匹配  │
│ + 30% bm25 │   │                  │
│            │   │ trie-index.js    │
│ 返回结果    │   │ 前缀匹配        │
└────────────┘   └─────────────────┘
```

### 4.3 代码分析流程

```
File Save Event
    │
    ▼
┌──────────────────────────────────────────┐
│  plugin.js → onFileSaved(filePath)       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  lib/code-analysis-service.js            │
│  AnalysisQueue.enqueue(filePath)          │
│  • 300ms debounce（批量处理）              │
│  • privacy-filter.js 过滤敏感文件          │
│  • code-fingerprint.js 跳过未变更文件      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  lib/code-analyzer.js                    │
│  1. Oxc 解析（JS/TS）                     │
│     或 tree-sitter（Python/Go/Rust/Java） │
│  2. 提取符号、计算复杂度                    │
│  3. 提取 JSDoc（JS/TS）                   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  lib/code-analysis-formatter.js          │
│  格式化输出（table/tree/json）             │
└──────────────────────────────────────────┘
```

### 4.4 实时同步流程

```
Plugin Startup
    │
    ▼
┌──────────────────────────────────────────┐
│  lib/ws-client.js                        │
│  SyncWebSocketClient.connect()           │
│  → ws://localhost:17999/ws               │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  消息处理                                  │
│  • memory_created → 本地创建对应文件       │
│  • memory_updated → 本地更新对应文件       │
│  • memory_deleted → 本地删除对应文件       │
│  • sync_complete   → 确认同步完成          │
└──────────────────────────────────────────┘
```

---

## 5. 组件交互

### 5.1 工具 → 库依赖关系

```
tools/core.js
  ├── lib/memory-core.js
  │     ├── lib/entry.js
  │     ├── lib/indexer.js
  │     ├── lib/extractor.js
  │     └── lib/storage.js
  └── lib/wrapper-client.js (同步时)

tools/search.js
  ├── lib/wrapper-client.js (后端搜索)
  ├── lib/bm25.js (本地降级)
  └── lib/trie-index.js (自动补全)

tools/graph.js
  └── lib/wrapper-client.js

tools/browse.js
  ├── lib/storage.js
  └── lib/indexer.js

tools/sync.js
  ├── lib/wrapper-client.js
  └── lib/storage.js
```

### 5.2 事件流

```
OpenCode Event: file.saved
    │
    ▼
plugin.js → ctx.on('file.saved', handler)
    │
    ▼
code-analysis-service.js → AnalysisQueue
    │
    ▼
code-analyzer.js → AnalysisResult
    │
    ▼
code-analysis-formatter.js → Formatted Output
```

---

## 6. 目录结构

```
opencode-memory-plugin/
├── plugin.js              # 插件入口（MemoryPlugin 函数）
├── index.js               # 插件元数据
├── package.json           # NPM 包配置
│
├── lib/                   # 核心库（24 个模块）
│   ├── memory-core.js     #   记忆读写核心
│   ├── entry.js           #   条目格式化 + 文件写入
│   ├── extractor.js       #   分层内容提取
│   ├── storage.js         #   配置和文件读取
│   ├── wrapper-client.js  #   后端 HTTP API 客户端
│   ├── ws-client.js       #   WebSocket 客户端
│   ├── bm25.js            #   BM25 搜索算法
│   ├── trie-index.js      #   Trie 索引
│   ├── code-analyzer.js   #   代码 AST 分析
│   └── ...                #   其他模块
│
├── tools/                 # OpenCode 工具（5 个文件，16 个工具）
│   ├── core.js            #   memory_write, memory_pin
│   ├── search.js          #   memory_search, memory_suggest
│   ├── graph.js           #   memory_relate, memory_graph
│   ├── browse.js          #   memory_timeline, memory_topics
│   └── sync.js            #   同步相关 7 个工具
│
├── agents/                # 内置代理
│   ├── memory-automation.md    # The Observer
│   └── memory-consolidate.md   # The Librarian
│
├── cli/                   # CLI 工具
│   ├── index.cjs               # 主 CLI
│   └── code-analyzer.cjs       # 代码分析 CLI
│
├── bin/                   # 安装钩子
│   └── install.cjs             # npm install 时执行
│
├── memory/                # 记忆文件模板
│   ├── SOUL.md, AGENTS.md ...  # 9 个核心文件
│   └── timeline/               # 时间线目录
│
├── tests/                 # 测试（19 个文件，138 用例）
│   ├── test-core.test.js
│   ├── test-memory-core.test.js
│   └── ...
│
├── scripts/               # 实用脚本
├── docs/                  # 插件开发文档
└── node_modules/          # 依赖
```

---

## 7. 设计原则

### 7.1 后端优先

所有向量搜索、图关系操作委托后端服务。插件仅保留本地文件 I/O 和降级搜索。

**好处**：插件轻量化（无 better-sqlite3 等重依赖）、搜索质量更高、多端一致性。

### 7.2 渐进加载

记忆条目采用 L0/L1/L2 三层结构：

| Level | 内容     | 大小      | 场景     |
| ----- | -------- | --------- | -------- |
| L0    | Abstract | ≤100 字符 | 列表浏览 |
| L1    | Overview | ≤500 字符 | 概要了解 |
| L2    | Content  | 无限制    | 完整阅读 |

### 7.3 优雅降级

后端不可用时自动降级：

- `memory_search` → BM25 本地关键词搜索
- `memory_graph` → 返回空结果 + 提示
- WebSocket → 离线队列 + 定时重连

### 7.4 Agent-Native

为 Coding Agent 设计，不迁就人类 GUI 习惯：

- 无 GUI、无 IDE 集成
- 所有交互通过工具调用
- 代理显式决策，系统只提供能力

---

## 8. 相关文档

### 项目文档

| 文档                                                                                         | 说明                           |
| -------------------------------------------------------------------------------------------- | ------------------------------ |
| [../../AGENTS.md](../../AGENTS.md)                                                           | 项目开发指南（AGENTS.md 级别） |
| [../../docs/API-CONTRACT.md](../../docs/API-CONTRACT.md)                                     | 工具↔后端 API 映射             |
| [../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md](../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md) | v3.2 统一架构设计              |

### v3.2 设计文档

| 文档                                                                                           | 说明                 |
| ---------------------------------------------------------------------------------------------- | -------------------- |
| [../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md) | 插件端 v3.2 实施指南 |
| [../../docs/v3.2/PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md)                       | 插件端 API 规范      |
| [../../docs/v3.2/DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)             | 数据库 Schema        |
| [../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)         | WebSocket 详细设计   |
| [../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)       | 预计算服务设计       |

### 产品文档

| 文档                                           | 说明     |
| ---------------------------------------------- | -------- |
| [../CONFIGURATION.md](../CONFIGURATION.md)     | 配置指南 |
| [../QUICK_START.md](../QUICK_START.md)         | 快速入门 |
| [../TROUBLESHOOTING.md](../TROUBLESHOOTING.md) | 故障排除 |
