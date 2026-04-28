# lib/ - 核心库模块指南

**生成时间**: 2026-04-28  
**目录**: opencode-memory-plugin/lib/

## 概述

核心库文件目录，包含内存操作、索引管理、代码分析、文件监控等功能模块。

## 结构

```
lib/
├── atomic-write.js          # 原子写入操作
├── bm25.js                 # BM25关键词搜索算法
├── code-analysis-formatter.js # 代码分析输出格式化
├── code-analysis-service.js # 代码分析服务
├── code-analyzer.js        # 代码分析器
├── config.js               # 配置管理
├── constants.js            # 常量定义
├── entry.js                # 条目格式化和文件操作
├── extractor.js            # 分层提取和frontmatter解析
├── file-watcher.js         # 文件系统监听
├── indexer.js              # 索引更新管理
├── logger.js               # 结构化日志
├── memory-core.js          # 内存读写核心逻辑
├── memory-id-cache.js      # Memory ID缓存管理
├── privacy-filter.js       # 敏感内容过滤
├── project-analyzer.js     # 项目级分析
├── project-resolver.js     # 项目ID解析器
├── storage.js              # 存储配置和link-map读取
├── tree-sitter-parser.js   # 多语言AST解析
├── trie-index.js           # Trie索引和自动补全
├── trie.js                 # Trie数据结构
├── ulid.js                 # ULID生成
├── upload-queue.js         # 上传队列管理
├── wrapper-client.js       # 后端API客户端
├── ws-client.js            # WebSocket客户端
├── precompute/             # 预计算服务客户端
├── queries/                # Tree-sitter查询文件
└── websocket/              # WebSocket实时同步
```

## WHERE TO LOOK

| 功能         | 文件                     | 说明                      |
| ------------ | ------------------------ | ------------------------- |
| 内存核心     | memory-core.js           | 内存读写和同步核心逻辑    |
| 条目操作     | entry.js                 | 条目格式化和文件操作      |
| 提取解析     | extractor.js             | 分层提取和frontmatter解析 |
| 索引管理     | indexer.js               | link-map和MEMORY.md更新   |
| 存储管理     | storage.js               | 配置和link-map读取        |
| 代码分析     | code-analyzer.js         | 代码AST分析               |
| 代码分析服务 | code-analysis-service.js | 代码分析批处理队列        |
| 文件监控     | file-watcher.js          | 文件系统监听              |
| 项目解析     | project-resolver.js      | 项目ID解析器              |
| 项目分析     | project-analyzer.js      | 项目级分析（健康度评级）  |
| 日志记录     | logger.js                | 结构化日志（pino）        |
| ID生成       | ulid.js                  | ULID生成                  |
| 网络请求     | wrapper-client.js        | 后端API客户端             |
| WebSocket    | ws-client.js             | WebSocket客户端           |
| Trie索引     | trie-index.js            | Trie索引和自动补全        |
| 敏感过滤     | privacy-filter.js        | 敏感内容过滤              |

## 核心功能

- **memory-core.js**: 内存读写和同步核心逻辑，统一CLI和Plugin操作
- **entry.js**: 条目格式化和文件操作，处理L0/L1/L2分层存储
- **indexer.js**: 索引管理，更新link-map和MEMORY.md索引文件
- **code-analyzer.js**: 代码AST分析，提取函数、类、复杂度等信息
- **file-watcher.js**: 文件系统监听，支持防抖和批量处理
- **project-resolver.js**: 项目ID解析，支持多种策略（git、package.json等）

## 独特约定

- 使用ULID作为条目ID（时间有序、全局唯一）
- L0/L1/L2三层存储结构（abstract/overview/full content）
- 基于指纹的增量同步机制
- 支持多种编程语言的AST分析（JavaScript、TypeScript、Python、Go、Rust、Java）
- 自动降级到BM25搜索当向量服务不可用
- 使用pino进行结构化日志记录

## 命令

```bash
# 运行代码分析
node opencode-memory-plugin/cli/code-analyzer.cjs --project .
```
