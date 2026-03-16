# AGENTS.md - OpenCode Memory Plugin 核心指南

**生成时间**: 2026-03-16  
**分支**: main  
**当前版本**: v1.2.1

## 📝 最近更新 (2026-03-16)

- ✅ 实现 daily 日志路由功能（memory_write 支持 type="daily"）
- ✅ 自动创建 daily/YYYY-MM-DD.md 文件
- ✅ memory-automation 代理支持智能识别 daily 类型
- ✅ 完善数据一致性分析和智能增量同步设计

## 🔧 快速上手

### 项目结构

```
D:/github/opencode-memory-plugin/
├── opencode-memory-plugin/          # 插件主目录
│   ├── lib/                        # 核心库文件
│   │   ├── vector-store.js         # 向量存储和外部API集成
│   │   ├── bm25.js                 # BM25关键词搜索算法
│   │   └── service-validator.js    # 外部服务验证工具
│   ├── bin/                        # CLI和安装脚本
│   │   ├── cli.cjs                 # 命令行界面
│   │   └── install.cjs             # NPM安装钩子
│   ├── agents/                     # 自定义OpenCode代理
│   │   ├── memory-automation.md    # 自动保存代理
│   │   └── memory-consolidate.md   # 自动合并代理
│   ├── memory/                     # OpenClaw式记忆文件
│   ├── scripts/                     # 实用脚本
│   ├── ARCHITECTURE.md             # 系统架构文档
│   ├── CONFIGURATION.md            # 配置说明文档
│   ├── EXTERNAL_EMBEDDING.md       # 外部embedding服务文档
│   ├── QUICK_START.md              # 快速开始指南
│   ├── TROUBLESHOOTING.md          # 故障排除指南
│   ├── WINDOWS_SETUP.md            # Windows设置指南
│   ├── plugin.js                   # OpenCode插件入口
│   ├── index.js                    # 插件元数据
│   └── package.json                # NPM包配置
│   ├── test-external-embedding.mjs    # 外部服务测试工具
│   ├── test-rebuild.mjs               # 索引重建测试工具
├── README.md                       # 项目说明
├── CHANGELOG.md                    # 版本变更日志
└── INSTALL.md                      # 安装说明
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

### 8个记忆工具

| 工具            | 功能       | 说明                 |
| --------------- | ---------- | -------------------- |
| `memory_write`  | 写入记忆   | 将信息写入长期记忆   |
| `memory_read`   | 读取记忆   | 从记忆文件读取内容   |
| `memory_search` | 搜索记忆   | 关键词和语义搜索     |
| `list_daily`    | 列出日志   | 显示每日日志文件     |
| `init_daily`    | 初始化日志 | 创建今日的日志文件   |
| `rebuild_index` | 重建索引   | 重新索引所有记忆文件 |
| `index_status`  | 状态检查   | 检查向量索引状态     |

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

| 符号           | 文件                | 说明                       |
| -------------- | ------------------- | -------------------------- |
| VectorStore    | lib/vector-store.js | 向量存储和外部API集成      |
| BM25Index      | lib/bm25.js         | 关键词搜索算法             |
| OpenCodePlugin | plugin.js           | OpenCode插件入口和工具注册 |
| InstallScript  | bin/install.cjs     | 插件安装脚本               |

### 服务集成

| 符号                 | 文件                | 说明                     |
| -------------------- | ------------------- | ------------------------ |
| ExternalEmbeddingAPI | lib/vector-store.js | 外部embedding服务API接口 |
| getExternalEmbedding | lib/vector-store.js | 外部embedding获取方法    |
| useExternalService   | lib/vector-store.js | 外部服务启用标志         |

### 工具模块

| 符号          | 文件      | 说明                        |
| ------------- | --------- | --------------------------- |
| memory_write  | plugin.js | 写入记忆工具                |
| memory_search | plugin.js | 搜索记忆工具（关键词+语义） |
| rebuild_index | plugin.js | 索引重建工具                |
| index_status  | plugin.js | 索引状态检查工具            |

## 📊 核心特性总结

### 主要功能

- ✅ **8个记忆工具**: 提供完整的记忆管理功能
- ✅ **外部embedding集成**: 通过HTTP API连接自定义embedding服务
- ✅ **混合搜索算法**: 70%向量相似度 + 30%BM25关键词评分
- ✅ **OpenClaw式记忆结构**: 包含SOUL、AGENTS、USER等9个核心记忆文件
- ✅ **零配置**: 安装后立即可用
- ✅ **回退机制**: 服务不可用时自动使用BM25关键词搜索
- ✅ **向量存储**: 基于SQLite和sqlite-vec的高效向量存储

### 性能特征

- **响应时间**: 首次 ~50-100ms，后续 ~50-100ms/查询
- **内存使用**: ~50-100MB RAM (显著低于本地模型)
- **服务依赖**: 需要 `localhost:18000` 上的embedding服务

### 部署配置

- **默认端点**: `http://localhost:18000/embeddings`
- **API格式**: POST JSON请求，返回embedding向量
- **支持格式**:
  - OpenAI兼容: `{ "data": [{ "embedding": [...] }] }`
  - 直接数组: `[0.1, 0.2, ...]`
  - 包装embedding: `{ "embeddings": [...] }`

## 🎯 使用外部服务指南

参考 [EXTERNAL_EMBEDDING.md](./opencode-memory-plugin/EXTERNAL_EMBEDDING.md) 和 [QUICK_START.md](./opencode-memory-plugin/QUICK_START.md) 进行外部embedding服务的设置和使用：

- 配置外部服务端点
- 验证API兼容性
- 测试连接和响应格式
- 验证性能和稳定性
