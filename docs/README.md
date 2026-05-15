# Development Documentation

**版本**: v3.2.0  
**最后更新**: 2026-04-10

---

## 文档分类

本项目文档分为三类：

| 类别         | 回答       | 受众       | 位置                               |
| ------------ | ---------- | ---------- | ---------------------------------- |
| **产品文档** | 怎么用？   | 用户       | 根目录 + `opencode-memory-plugin/` |
| **开发文档** | 怎么实现？ | 开发者     | `docs/`                            |
| **Backlog**  | 做什么？   | 项目管理者 | 根目录 `BACKLOG.md`                |

---

## 开发文档索引

### 项目级文档

| 项目                 | 产品文档                                                                | 开发文档                                                        | Backlog                                                                   |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **插件端** (Node.js) | [opencode-memory-plugin/README.md](../opencode-memory-plugin/README.md) | [opencode-memory-plugin/docs/](../opencode-memory-plugin/docs/) | [opencode-memory-plugin/BACKLOG.md](../opencode-memory-plugin/BACKLOG.md) |
| **后端** (Python)    | [embedding_service/README.md](../embedding_service/README.md)           | [embedding_service/docs/](../embedding_service/docs/)           | [embedding_service/BACKLOG.md](../embedding_service/BACKLOG.md)           |

### v3.2 架构文档（当前）

| 文档                                                                         | 说明                 | 状态      |
| ---------------------------------------------------------------------------- | -------------------- | --------- |
| [v3.2/UNIFIED-ARCHITECTURE-v3.2.md](./v3.2/UNIFIED-ARCHITECTURE-v3.2.md)     | v3.2 统一架构设计    | ✅ 实施版 |
| [v3.2/BACKEND-v3.2-IMPLEMENTATION.md](./v3.2/BACKEND-v3.2-IMPLEMENTATION.md) | 后端实施指南         | ✅ 实施版 |
| [v3.2/BACKEND-v3.2-WEBSOCKET.md](./v3.2/BACKEND-v3.2-WEBSOCKET.md)           | WebSocket 详细设计   | ✅ 实施版 |
| [v3.2/BACKEND-v3.2-PRECOMPUTE.md](./v3.2/BACKEND-v3.2-PRECOMPUTE.md)         | 预计算服务设计       | ✅ 实施版 |
| [v3.2/BACKEND-v3.2-MIGRATION.md](./v3.2/BACKEND-v3.2-MIGRATION.md)           | 迁移指南             | ✅ 实施版 |
| [v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](./v3.2/PLUGIN-v3.2-IMPLEMENTATION.md)   | 插件端实施           | ✅ 实施版 |
| [v3.2/PLUGIN-v3.2-API.md](./v3.2/PLUGIN-v3.2-API.md)                         | 插件端 API 规范      | ✅ 实施版 |
| [v3.2/BACKEND-v3.2-MEILISEARCH.md](./v3.2/BACKEND-v3.2-MEILISEARCH.md)       | Meilisearch 升级指南 | ✅ 实施版 |
| [v3.2/DATABASE-v3.2-SCHEMA.md](./v3.2/DATABASE-v3.2-SCHEMA.md)               | 数据库 Schema        | ✅ 实施版 |
| [v3.2/DEPLOYMENT-v3.2.md](./v3.2/DEPLOYMENT-v3.2.md)                         | 部署指南             | ✅ 实施版 |
| [v3.2/DEVELOPMENT-v3.2.md](./v3.2/DEVELOPMENT-v3.2.md)                       | 开发指南             | ✅ 实施版 |
| [v3.2/DEPENDENCY-VERSIONS.md](./v3.2/DEPENDENCY-VERSIONS.md)                 | 依赖版本锁定         | ✅ 实施版 |
| [v3.2/EVALUATION-PROMPT.md](./v3.2/EVALUATION-PROMPT.md)                     | 文档评估模板         | ✅ 实施版 |
| [v3.2/EVALUATION-REPORT.md](./v3.2/EVALUATION-REPORT.md)                     | 文档评估报告         | ✅ 实施版 |

### 核心开发文档

| 文档                                 | 说明                         |
| ------------------------------------ | ---------------------------- |
| [AGENTS.md](./AGENTS.md)             | 项目结构、代码规范、开发指南 |
| [API-CONTRACT.md](./API-CONTRACT.md) | 工具↔后端 API 映射           |

### 架构文档

| 文档                                         | 说明                   |
| -------------------------------------------- | ---------------------- |
| [ARCHITECTURE.md](./archive/ARCHITECTURE.md) | 系统架构说明（已归档） |
| [DESIGN.md](./archive/DESIGN.md)             | 设计文档（已归档）     |

### Superpowers 设计文档

| 文档                                                                                                   | 说明                     | 状态      |
| ------------------------------------------------------------------------------------------------------ | ------------------------ | --------- |
| [specs/2026-05-13-graphify-bridge-design.md](./superpowers/specs/2026-05-13-graphify-bridge-design.md) | Graphify Bridge 设计文档 | ✅ 已实现 |
| [plans/2026-05-13-graphify-bridge.md](./superpowers/plans/2026-05-13-graphify-bridge.md)               | Graphify Bridge 实施计划 | ✅ 已实现 |

### 已归档文档

`archive/` 目录包含 26 个已归档的过时设计文档，仅供历史参考。

---

## 模块映射

### lib/ 核心库

| 文件                         | 主要导出                                    | 说明                                   |
| ---------------------------- | ------------------------------------------- | -------------------------------------- |
| `memory-core.js`             | writeMemory, readMemory, writeAndSyncMemory | 写入/读取/同步核心逻辑                 |
| `entry.js`                   | buildEntryContent, writeEntryToTimeline     | 条目格式化和文件操作                   |
| `extractor.js`               | extractByLevel, getEntryInfo                | 分层提取和 frontmatter 解析            |
| `wrapper-client.js`          | WrapperClient                               | 后端 API 客户端（所有 HTTP 调用）      |
| `storage.js`                 | getConfig, getLinkMap, getEntryById         | 配置和 link-map 读取                   |
| `trie-index.js`              | searchByPrefix, getAutocompleteSuggestions  | Trie 索引和自动补全                    |
| `code-analyzer.js`           | CodeAnalyzer                                | 代码 AST 分析（Oxc）                   |
| `tree-sitter-parser.js`      | analyzeWithTreeSitter                       | 多语言 AST 解析（Python/Go/Rust/Java） |
| `project-analyzer.js`        | ProjectAnalyzer                             | 项目级分析（健康度评级）               |
| `code-analysis-formatter.js` | formatCodeAnalysis, formatTable, formatTree | 输出格式化（table/tree/json）          |
| `code-analysis-service.js`   | AnalysisQueue                               | 批量分析队列                           |
| `graphify-bridge.js`         | importGraphJSON, graphifyProject            | graphify graph.json → SurrealDB 桥接   |
| `code-fingerprint.js`        | CodeFingerprint                             | 变更检测                               |
| `privacy-filter.js`          | shouldSkipFile, validateFileSize            | 敏感内容过滤                           |
| `file-watcher.js`            | FileWatcher                                 | 文件系统监听（300ms debounce）         |

### tools/ 工具

| 文件        | 工具                                                                                                       | 后端依赖       |
| ----------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| `core.js`   | memory_write, memory_pin                                                                                   | 同步           |
| `search.js` | memory_search, memory_suggest                                                                              | 搜索时后端优先 |
| `graph.js`  | memory_relate, memory_graph                                                                                | 必须           |
| `browse.js` | memory_timeline, memory_topics                                                                             | 无             |
| `sync.js`   | index_status, rebuild_index, incremental_sync, full_sync, sync_checkpoint, conflict_list, conflict_resolve | 必须           |

---

## 代码规范

- 使用 JavaScript (ES Modules)
- 遵循现有项目约定
- 为复杂逻辑添加注释
- 优先考虑可读性而非巧妙性
- 使用一致的格式

---

## 开发工作流

1. **理解**: 阅读文档和搜索相关上下文
2. **计划**: 基于过去成功经验提出方案
3. **执行**: 实现解决方案
4. **验证**: 测试和验证
5. **反思**: 将经验教训保存到记忆

---

## 相关资源

- [产品文档](../README.md) - GitHub 首页
- [Backlog](../BACKLOG.md) - 未完成任务
- [CHANGELOG](../CHANGELOG.md) - 版本发布记录

---

## 文档分工说明

### 三类文档的职责划分

| 文档类型                 | 核心问题     | 目标读者           | 内容特点                  | 维护频率     |
| ------------------------ | ------------ | ------------------ | ------------------------- | ------------ |
| **产品文档** (README.md) | "怎么用？"   | 用户、新贡献者     | 安装、配置、使用示例、FAQ | 每个版本发布 |
| **开发文档** (docs/)     | "怎么实现？" | 开发者、维护者     | 架构、API、开发指南、部署 | 架构变更时   |
| **Backlog** (BACKLOG.md) | "做什么？"   | 项目管理者、贡献者 | 任务列表、优先级、里程碑  | 持续更新     |

### 跨项目引用规范

- **主项目 → 子项目**: 使用相对路径 `../opencode-memory-plugin/` 或 `../embedding_service/`
- **子项目 → 主项目**: 使用相对路径 `../../docs/v3.2/`
- **避免内容重复**: 详细设计留在主项目，子项目只保留实施相关的具体信息

### 版本对应关系

| 主项目版本 | 插件端版本 | 后端版本 | 状态      |
| ---------- | ---------- | -------- | --------- |
| v3.2.0     | v3.2.0     | v3.2.0   | 🚧 开发中 |
| v3.0.0     | v3.0.0     | v2.4.0   | ✅ 已发布 |
| v2.9.0     | v2.9.0     | v2.3.0   | ✅ 已发布 |
