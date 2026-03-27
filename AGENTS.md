# AGENTS.md - OpenCode Memory Plugin 开发指南

**版本**: v2.5.0  
**分支**: main  
**更新时间**: 2026-03-27

---

## 项目结构

```
D:/github/opencode-memory-plugin/
├── opencode-memory-plugin/
│   ├── lib/                  # 核心库（CLI 和 Plugin 共用）
│   │   ├── constants.js      # 常量定义
│   │   ├── ulid.js           # ULID 生成
│   │   ├── entry.js          # buildEntryContent, writeEntryToTimeline, parseEntryFromFile
│   │   ├── extractor.js      # extractByLevel, getEntryInfo
│   │   ├── indexer.js        # updateLinkMap, updateMemoryIndex
│   │   ├── storage.js        # getConfig, getLinkMap, getEntryById
│   │   ├── memory-core.js    # writeMemory, readMemory, writeAndSyncMemory, syncMemoryToBackend
│   │   ├── wrapper-client.js # 后端 API 客户端
│   │   ├── project-resolver.js # 项目 ID 解析器
│   │   ├── bm25.js           # BM25 关键词搜索
│   │   ├── trie-index.js     # Trie 索引
│   │   └── ws-client.js      # WebSocket 客户端
│   ├── tools/                # OpenCode 插件工具
│   │   ├── core.js           # memory_write
│   │   ├── search.js         # memory_search, memory_suggest
│   │   ├── graph.js          # memory_relate, memory_graph
│   │   ├── browse.js         # memory_timeline, memory_topics
│   │   └── sync.js           # index_status, rebuild_index, incremental_sync, full_sync,
│   │                          #   sync_checkpoint, conflict_list, conflict_resolve, batch_resolve
│   ├── cli/                  # CLI 工具
│   │   └── index.cjs         # 命令行界面
│   ├── bin/                  # 安装脚本
│   │   └── install.cjs       # NPM 安装钩子
│   ├── memory/               # 记忆文件模板（安装时复制到 ~/.opencode/memory/）
│   ├── agents/               # 自定义 OpenCode 代理
│   ├── scripts/              # 实用脚本
│   ├── plugin.js             # OpenCode 插件入口
│   └── package.json
├── docs/                     # 开发文档
│   └── API-CONTRACT.md       # 工具↔后端 API 映射
├── README.md                 # 产品文档
├── CHANGELOG.md              # 版本记录
├── BACKLOG.md                # 任务追踪
└── AGENTS.md                 # 本文件
```

---

## 模块映射

### lib/ 核心库

| 文件              | 主要导出                                                    | 说明                              |
| ----------------- | ----------------------------------------------------------- | --------------------------------- |
| memory-core.js    | writeMemory, readMemory, writeAndSyncMemory                 | 写入/读取/同步核心逻辑            |
| entry.js          | buildEntryContent, writeEntryToTimeline, parseEntryFromFile | 条目格式化和文件操作              |
| extractor.js      | extractByLevel, getEntryInfo                                | 分层提取和 frontmatter 解析       |
| wrapper-client.js | WrapperClient                                               | 后端 API 客户端（所有 HTTP 调用） |
| storage.js        | getConfig, getLinkMap, getEntryById                         | 配置和 link-map 读取              |
| trie-index.js     | searchByPrefix, getAutocompleteSuggestions                  | Trie 索引和自动补全               |

### tools/ 工具

| 文件      | 工具                                                                                                                      | 后端依赖       |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | -------------- |
| core.js   | memory_write                                                                                                              | 同步           |
| search.js | memory_search, memory_suggest                                                                                             | 搜索时后端优先 |
| graph.js  | memory_relate, memory_graph                                                                                               | 必须           |
| browse.js | memory_timeline, memory_topics                                                                                            | 无             |
| sync.js   | index_status, rebuild_index, incremental_sync, full_sync, sync_checkpoint, conflict_list, conflict_resolve, batch_resolve | 必须           |

---

## 记忆条目格式 (v2.5.0)

```
---
id: {ulid}
date: {ISO8601}
type: {type}
tags: [{tags}]
project: {project}
memory_id: {memory_id}
source_id: {source_id}
synced: {boolean}
synced_at: {timestamp}
meta: [{键:值}, ...]
---

# ≡≡≡ Abstract ≡≡≡
```

{abstract 内容}

```

# ≡≡≡ Overview ≡≡≡
```

{overview 内容}

```

# ≡≡≡ Contents ≡≡≡
```

{完整内容}

```

---
```

- **分隔符**: `# ≡≡≡ {标题} ≡≡≡` (3个≡)
- **内容区域**: 使用 ``` 代码块包围
- **meta**: 可选，JSON 数组 `[{"key":"value"},...]`
- **abstract**: 必填，≤100 字符
- **overview**: 必填，≤500 字符

---

## 后端 API

详见 [`docs/API-CONTRACT.md`](./docs/API-CONTRACT.md)

| 后端地址 | localhost:17999 |
| API 前缀 | `/api/v1` |
| API 文档 | `http://localhost:17999/docs` |
| 认证 | Header: `WRAPPER_MEILI_API_KEY` |

---

## 代码规范

### 提交格式

- `feat:` 新功能
- `fix:` 修复 bug
- `refactor:` 重构
- `docs:` 文档更新
- `chore:` 构建/配置

### 红线规则

- 不将敏感信息提交至代码库
- 不移除向后兼容性功能
- 不在没有 fallback 的情况下移除关键功能
- 不修改 memory/ 下的模板文件

### 依赖

- `@opencode-ai/plugin` - OpenCode 插件框架
- Node.js 16+

---

## 文档分工

| 文档                   | 受众          | 内容                         |
| ---------------------- | ------------- | ---------------------------- |
| `README.md`            | 用户/AI Agent | 产品介绍、安装、使用         |
| `docs/API-CONTRACT.md` | 开发者        | 工具↔后端 API 映射           |
| `BACKLOG.md`           | 项目管理      | 任务追踪、Bug 列表           |
| `CHANGELOG.md`         | 所有人        | 版本发布记录                 |
| `AGENTS.md`            | 开发者        | 项目结构、代码规范（本文件） |
