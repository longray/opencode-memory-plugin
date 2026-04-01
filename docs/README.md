# Development Documentation

**版本**: v2.9.0  
**最后更新**: 2026-04-01

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

### 已归档文档

`archive/` 目录包含 26 个已归档的过时设计文档，仅供历史参考。

---

## 模块映射

### lib/ 核心库

| 文件                       | 主要导出                                    | 说明                              |
| -------------------------- | ------------------------------------------- | --------------------------------- |
| `memory-core.js`           | writeMemory, readMemory, writeAndSyncMemory | 写入/读取/同步核心逻辑            |
| `entry.js`                 | buildEntryContent, writeEntryToTimeline     | 条目格式化和文件操作              |
| `extractor.js`             | extractByLevel, getEntryInfo                | 分层提取和 frontmatter 解析       |
| `wrapper-client.js`        | WrapperClient                               | 后端 API 客户端（所有 HTTP 调用） |
| `storage.js`               | getConfig, getLinkMap, getEntryById         | 配置和 link-map 读取              |
| `trie-index.js`            | searchByPrefix, getAutocompleteSuggestions  | Trie 索引和自动补全               |
| `code-analyzer.js`         | CodeAnalyzer                                | 代码 AST 分析（Oxc）              |
| `code-analysis-service.js` | AnalysisQueue                               | 批量分析队列                      |
| `code-fingerprint.js`      | CodeFingerprint                             | 变更检测                          |
| `privacy-filter.js`        | shouldSkipFile, validateFileSize            | 敏感内容过滤                      |

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
