# AGENTS.md - OpenCode Memory Plugin 核心指南

**生成时间**: 2026-03-26  
**分支**: main  
**当前版本**: v2.4.0

## 📝 最近更新 (2026-03-26)

- ✅ v2.4.0 L0/L1/L2 分层存储架构完成
- ✅ 统一使用 ULID 格式 `entry_{ulid}.md`
- ✅ 新增 frontmatter 字段：id, memory_id, synced, synced_at
- ✅ 分层格式：`# Abstract` / `## Overview` / `## Content`
- ✅ abstract/overview 必填（建议 ≤100/≤500 字符，超长可容忍）
- ✅ 代码重构：lib/、tools/、cli/ 模块化拆分
- ✅ CLI 和 Plugin 共享 lib/ 核心库

## 📝 历史更新 (2026-03-23)

- ✅ 完成 Timeline 迁移（daily/ → timeline/YYYY/MM/DD/）
- ✅ 添加迁移脚本 scripts/migrate-daily-to-timeline.mjs
- ✅ 迁移 9 个 daily 文件到 timeline 结构
- ✅ 删除旧的 daily/ 目录
- ✅ 更新项目文档（README、CHANGELOG、AGENTS.md）
- ✅ 总计 137 个时间线条目

## 🔧 快速上手

### 项目结构

```
D:/github/opencode-memory-plugin/
├── opencode-memory-plugin/          # 插件主目录
│   ├── lib/                        # 核心库文件（CLI和Plugin共用）
│   │   ├── constants.js            # 常量定义
│   │   ├── ulid.js                 # ULID生成
│   │   ├── entry.js                # buildEntryContent, writeEntryToTimeline
│   │   ├── indexer.js              # updateLinkMap, updateMemoryIndex
│   │   ├── extractor.js            # extractByLevel
│   │   ├── storage.js              # getConfig, getLinkMap, getEntryById
│   │   ├── wrapper-client.js       # 后端API客户端
│   │   ├── project-resolver.js     # 项目ID解析器
│   │   ├── bm25.js                 # BM25关键词搜索算法
│   │   └── ws-client.js            # WebSocket客户端
│   ├── tools/                      # OpenCode插件工具
│   │   ├── core.js                 # memory_write
│   │   ├── search.js              # memory_search, memory_suggest
│   │   ├── graph.js                # memory_relate, memory_graph
│   │   ├── browse.js               # memory_timeline, memory_topics
│   │   └── sync.js                # 同步相关工具
│   ├── cli/                        # CLI工具
│   │   └── index.cjs               # 命令行界面（使用lib/）
│   ├── bin/                        # 安装脚本
│   │   └── install.cjs             # NPM安装钩子
│   ├── memory/                     # OpenClaw式记忆文件
│   │   ├── SOUL.md, AGENTS.md, USER.md, etc.  # 核心记忆文件
│   │   ├── MEMORY.md               # 长期记忆索引（程序化更新）
│   │   └── timeline/               # 时间线结构的记忆条目
│   │       └── YYYY/MM/DD/         # 日期组织结构
│   ├── agents/                     # 自定义OpenCode代理
│   ├── scripts/                    # 实用脚本
│   ├── plugin.js                   # OpenCode插件入口
│   └── package.json                # NPM包配置
├── docs/                           # 设计文档
├── README.md                       # 项目说明
├── CHANGELOG.md                    # 版本变更日志
└── AGENTS.md                       # 本文件
```

### 命令速查

**Node.js后端:**

```bash
# 安装插件（全局）
npm install -g @csuwl/opencode-memory-plugin

# 验证安装
opencode
# 在OpenCode中使用 memory_write, memory_search 等工具

# CLI工具使用
opencode-memory write "User prefers TypeScript" --type "preference" --tags "typescript,code-style"
opencode-memory search "typescript"
opencode-memory list --days 7
```

### 核心入口

| 类型     | 文件                                                 | 命令                               |
| -------- | ---------------------------------------------------- | ---------------------------------- |
| 主插件   | `opencode-memory-plugin/plugin.js`                   | 注册所有记忆工具                   |
| 安装脚本 | `opencode-memory-plugin/bin/install.cjs`             | `npm install` 自动运行             |
| 向量存储 | `opencode-memory-plugin/lib/vector-store.js`         | 语义搜索核心                       |
| 测试工具 | `opencode-memory-plugin/test-external-embedding.mjs` | `node test-external-embedding.mjs` |

## 📁 文件放置规则

### 文档文件

| 文件类型 | 放置目录                                    | 命名规范 |
| -------- | ------------------------------------------- | -------- |
| 配置说明 | `opencode-memory-plugin/CONFIGURATION.md`   | 配置文档 |
| 架构说明 | `opencode-memory-plugin/ARCHITECTURE.md`    | 系统架构 |
| 快速开始 | `opencode-memory-plugin/QUICK_START.md`     | 快速入门 |
| 故障排除 | `opencode-memory-plugin/TROUBLESHOOTING.md` | 问题诊断 |

### 源代码

| 文件类型   | 放置目录                                                     | 说明               |
| ---------- | ------------------------------------------------------------ | ------------------ |
| JavaScript | `opencode-memory-plugin/lib/`, `opencode-memory-plugin/bin/` | 核心功能           |
| 代理配置   | `opencode-memory-plugin/agents/`                             | 自动化代理定义     |
| 记忆文件   | `opencode-memory-plugin/memory/`                             | OpenClaw式记忆模板 |

### ⚠️ 禁止

- ❌ 修改 `opencode-memory-plugin/memory/` 下的模板文件 (应由安装脚本复制)
- ❌ 移除向后兼容性功能 (保留fallback机制)
- ❌ 移除必需的依赖项

## 🔄 工作流程

1. **安装**: 运行 `npm install -g @csuwl/opencode-memory-plugin` 自动执行安装脚本
2. **配置**: 在 `~/.opencode/memory/memory-config.json` 中修改配置
3. **使用**: 在OpenCode中使用各种memory工具
4. **外部服务**: 确保embedding服务在 `localhost:18000` 运行

## ⚙️ 核心功能

- **8个记忆工具**: 提供完整的记忆管理系统
- **外部embedding集成**: 通过HTTP API连接自定义embedding服务
- **混合搜索**: 向量搜索+BM25关键词搜索+回退机制
- **OpenClaw式记忆**: 9个核心记忆文件结构
- **零配置**: 开箱即用，无需复杂设置

#### 使用场景

| 场景     | 工具                             | 说明              |
| -------- | -------------------------------- | ----------------- |
| 长期记忆 | `memory_write` / `memory_read`   | 存储/读取重要信息 |
| 搜索记忆 | `memory_search`                  | 关键词和语义搜索  |
| 日志管理 | `list_daily` / `init_daily`      | 每日日志管理      |
| 索引管理 | `rebuild_index` / `index_status` | 向量索引管理      |

## 📋 项目规范

- **项目约定**:
  - Node.js 16+, 使用 npm 管理依赖
  - 模块格式: ES Modules (现代Node.js兼容)
  - 配置: `package.json` 集中管理
  - 文档: 详尽的markdown文档
  - **编码规范**: 保持向后兼容性

- **提交格式**:
  - `feat:` 新功能
  - `fix:` 修复bug
  - `refactor:` 重构
  - `docs:` 文档更新
  - `chore:` 构建/配置

- **核心依赖**:
  - `@opencode-ai/plugin` - OpenCode插件框架
  - `better-sqlite3` - SQLite数据库
  - `sqlite-vec` - 向量搜索扩展

## 🔍 核心概念

### L0/L1/L2 分层存储

| 层级 | 字段     | 内容       | 大小   | 使用场景         |
| ---- | -------- | ---------- | ------ | ---------------- |
| L0   | abstract | 一句话摘要 | ≤100字 | 快速浏览条目列表 |
| L1   | overview | 核心要点   | ≤500字 | 了解条目大意     |
| L2   | content  | 完整内容   | 无限制 | 需要详细阅读     |

### 19个记忆工具

| 工具             | 功能       | 说明                    |
| ---------------- | ---------- | ----------------------- |
| `memory_write`   | 写入记忆   | 必填 abstract, overview |
| `memory_read`    | 读取记忆   | 支持 level=0/1/2        |
| `memory_search`  | 搜索记忆   | 关键词和语义搜索        |
| `memory_suggest` | 自动补全   | 前缀搜索建议            |
| `list_daily`     | 列出日志   | 显示每日日志文件        |
| `init_daily`     | 初始化日志 | 创建今日的日志文件      |
| `rebuild_index`  | 重建索引   | 重新索引所有记忆文件    |
| `index_status`   | 状态检查   | 检查向量索引状态        |

### 搜索模式

| 模式      | 类型         | 性能 | 质量     | 服务依赖    |
| --------- | ------------ | ---- | -------- | ----------- |
| `hybrid`  | 向量+BM25    | 中等 | ⭐⭐⭐⭐ | ✅ 外部服务 |
| `vector`  | 向量优先     | 中等 | ⭐⭐⭐   | ✅ 外部服务 |
| `keyword` | 关键词       | 快   | ⭐⭐     | ❌ 无       |
| `hash`    | 哈希（回退） | 快   | ⭐       | ❌ 无       |

### 配置参数

| 参数                     | 默认值                              | 说明                                     |
| ------------------------ | ----------------------------------- | ---------------------------------------- |
| `embedding.provider`     | "external"                          | embedding提供者类型                      |
| `embedding.endpoint`     | "http://localhost:18000/embeddings" | 外部embedding服务端点                    |
| `embedding.fallbackMode` | "bm25"                              | 服务不可用时的回退模式                   |
| `search.mode`            | "hybrid"                            | 搜索模式 ("hybrid", "vector", "keyword") |

## 🚫 红线规则

- 不将敏感信息或私钥提交至代码库
- 不移除向后兼容性功能
- 不在没有fallback机制的情况下移除关键功能
- 不修改OpenClaw式记忆文件的基本结构

## 🗺️ 核心模块映射

### 主要模块

| 符号            | 文件                    | 说明                       |
| --------------- | ----------------------- | -------------------------- |
| WrapperClient   | lib/wrapper-client.js   | 后端API客户端              |
| ProjectResolver | lib/project-resolver.js | 项目ID解析器               |
| BM25Index       | lib/bm25.js             | 关键词搜索算法             |
| TrieIndex       | lib/trie-index.js       | Trie索引管理器             |
| WebSocketClient | lib/ws-client.js        | WebSocket实时同步          |
| OpenCodePlugin  | plugin.js               | OpenCode插件入口和工具注册 |
| InstallScript   | bin/install.cjs         | 插件安装脚本               |

### 工具模块

| 符号             | 文件            | 说明                        |
| ---------------- | --------------- | --------------------------- |
| memory_write     | tools/core.js   | 写入记忆工具                |
| memory_search    | tools/search.js | 搜索记忆工具（关键词+语义） |
| memory_timeline  | tools/browse.js | 时间线浏览工具              |
| memory_topics    | tools/browse.js | 主题浏览工具                |
| incremental_sync | tools/sync.js   | 增量同步工具                |
| full_sync        | tools/sync.js   | 完整同步工具                |
| conflict_list    | tools/sync.js   | 冲突列表工具                |
| conflict_resolve | tools/sync.js   | 冲突解决工具                |
| rebuild_index    | tools/sync.js   | 索引重建工具                |
| index_status     | tools/sync.js   | 索引状态检查工具            |

## 📊 核心特性总结

### 主要功能

- ✅ **19个记忆工具**: 提供完整的记忆管理功能（核心11 + 同步4 + 浏览2 + 冲突2）
- ✅ **v2.4 L0/L1/L2 分层存储**: abstract/overview/content 分层结构
- ✅ **v2.4 ULID 格式**: `entry_{ulid}.md` 统一文件名
- ✅ **v2.4 模块化架构**: lib/、tools/、cli/ 代码分离，共享核心库
- ✅ **v2.3 双模同步**: 增量同步（基于指纹）+ 完整同步（支持断点续传）
- ✅ **v2.3 冲突解决**: 自动检测、智能解决、手动合并
- ✅ **v2.3 记忆浏览**: 时间线浏览器 + 主题探索器
- ✅ **Timeline 结构**: 基于 timeline/YYYY/MM/DD/ 的日期组织结构
- ✅ **SurrealDB 后端**: 支持 HNSW 向量搜索的外部记忆服务
- ✅ **图关系**: 连接记忆的语义关系
- ✅ **项目隔离**: 多租户支持（tenant_id + project_id）
- ✅ **混合模式**: 本地文件 + 后端服务，自动回退
- ✅ **零配置**: 安装后立即可用
- ✅ **OpenClaw式记忆结构**: 包含SOUL、AGENTS、USER等9个核心记忆文件
- ✅ **Phase C 性能优化**: Trie索引（10x更快）、自动补全（<50ms）、实时同步

### 性能特征

- **响应时间**: Trie搜索 <10ms，自动补全 <50ms
- **同步性能**: 增量同步仅上传变更，完整同步支持断点续传
- **服务依赖**: 后端服务 localhost:17999，WebSocket 实时同步
- **内存使用**: 本地 Trie 索引轻量级，后端承担向量计算

## 🎯 使用外部服务指南

参考 [EXTERNAL_EMBEDDING.md](./opencode-memory-plugin/EXTERNAL_EMBEDDING.md) 和 [QUICK_START.md](./opencode-memory-plugin/QUICK_START.md) 进行外部embedding服务的设置和使用：

- 配置外部服务端点
- 验证API兼容性
- 测试连接和响应格式
- 验证性能和稳定性
