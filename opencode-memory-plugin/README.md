# OpenCode Memory Plugin

> **版本**: v3.2.0-beta.1  
> **许可证**: MIT  
> **Node.js**: 18+

[![npm version](https://img.shields.io/npm/v/@csuwl/opencode-memory-plugin.svg)](https://www.npmjs.com/package/@csuwl/opencode-memory-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 简介

OpenCode Memory Plugin 是一个具有持久记忆和语义搜索能力的 AI 编程助手插件。它帮助开发者在编程过程中记住重要信息，并通过语义搜索快速找到相关的历史解决方案。

**核心能力**:

- 🧠 **持久记忆** - 自动保存编程偏好、成功模式、重要决策
- 🔍 **语义搜索** - 使用向量搜索找到相关的历史记忆
- 📊 **代码分析** - 自动分析代码结构，提取符号和调用关系
- 🔄 **实时同步** - 通过 WebSocket 实时同步记忆数据
- 📝 **结构化日志** - pino 日志框架，支持 JSON 和美化输出
- ⚙️ **环境配置** - dotenv 支持，灵活的配置管理

---

## 快速开始

### 安装

```bash
# 全局安装
npm install -g @csuwl/opencode-memory-plugin

# 或在项目中安装
npm install @csuwl/opencode-memory-plugin
```

### 配置

创建 `memory-config.json`:

```json
{
  "apiKey": "your-api-key",
  "apiPort": 18008,
  "codeAnalysis": {
    "autoTrigger": true,
    "languages": ["javascript", "typescript", "python"]
  }
}
```

### 验证安装

```bash
# 检查版本
opencode-memory --version

# 测试连接
opencode-memory health
```

---

## 可用工具

| 类别     | 工具               | 说明         |
| -------- | ------------------ | ------------ |
| **核心** | `memory_write`     | 写入记忆     |
|          | `memory_read`      | 读取记忆     |
|          | `memory_search`    | 搜索记忆     |
| **搜索** | `memory_suggest`   | 自动补全建议 |
|          | `memory_timeline`  | 时间线浏览   |
|          | `memory_topics`    | 主题浏览     |
| **图谱** | `memory_relate`    | 创建关系     |
|          | `memory_graph`     | 遍历图谱     |
| **同步** | `incremental_sync` | 增量同步     |
|          | `full_sync`        | 完整同步     |
| **代码** | `analyze_code` | 代码分析 (计划中) |
|          | `code_search` | 代码搜索 (计划中) |

---

## 内置代理

### The Observer（观察者）

自动识别对话中的重要信息并保存。

**触发方式**: Tab 键切换

**工作流程**:

1. 分析当前对话
2. 识别值得保存的信息（最多 5 条）
3. 查重并展示候选清单
4. 用户确认后保存

### The Librarian（图书管理员）

定期聚合碎片记忆，建立图谱关联。

**触发方式**: `@memory-consolidate`

**工作流程**:

1. 发现碎片记忆
2. 聚合提炼为高价值节点
3. 创建关系织网
4. 置顶关键约定

---

## 搜索模式

| 模式        | 说明              | 使用场景 |
| ----------- | ----------------- | -------- |
| **hybrid**  | 语义 + 关键词混合 | 默认推荐 |
| **vector**  | 纯语义搜索        | 概念查找 |
| **keyword** | BM25 关键词       | 精确匹配 |
| **hash**    | 精确哈希匹配      | ID 查找  |

---

## v3.2 新特性（开发中）

🚧 **v3.2.0-beta.1 开发中**

### v3.2.0 主要更新

| 特性 | 说明 | 状态 |
| ---- | ---- | ---- |
| **WebSocket 可靠连接** | 心跳保活、指数退避重连、ACK 确认机制 | 已完成 |
| **端口迁移** | 17999 → 18008，支持 API_PORT 环境变量 | 已完成 |
| **依赖升级** | pino 结构化日志、dotenv 环境配置 | 已完成 |
| **Memory CRUD 适配** | 适配 v3.2 API，新增 memory_read 工具 | 已完成 |
| **代码分析测试** | 新增 38 个测试用例，覆盖多语言解析 | 已完成 |
| **性能测试** | WebSocket 性能基准测试框架 | 已完成 |
| **文档更新** | v3.2 配置文档、迁移 FAQ | 已完成 |

### 详细设计

- [v3.2 架构设计](../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md)
- [v3.2 插件实施](../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md)
- [v3.2 API 规范](../docs/v3.2/PLUGIN-v3.2-API.md)
- [v3.2 开发指南](../docs/v3.2/DEVELOPMENT-v3.2.md)

---

## 详细配置

详见 [CONFIGURATION.md](./CONFIGURATION.md)

### 关键配置项

```javascript
{
  "apiKey": "your-api-key",
  "apiPort": 18008,  // v3.2 新端口
  "websocket": {
    "enabled": true,
    "heartbeatInterval": 30,
    "reconnectMaxAttempts": 10
  },
  "codeAnalysis": {
    "autoTrigger": true,
    "batchSize": 100
  }
}
```

---

## CLI 工具

```bash
# 安装记忆系统
opencode-memory install

# 查看状态
opencode-memory status

# 运行代码分析
opencode-memory analyze --project .

# 同步记忆
opencode-memory sync

# 查看帮助
opencode-memory --help
```

---

## 开发

### 项目结构

```
opencode-memory-plugin/
├── lib/           # 核心库
├── tools/         # 工具实现
├── agents/        # 内置代理
├── cli/           # CLI 工具
└── docs/          # 文档
```

### 开发指南

详见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 代码检查
npm run lint

# 格式化
npm run format
```

---

## 迁移指南

### v2.x → v3.0

- 条目格式升级至 v2.5
- 新增代码分析功能
- 新增 tree-sitter 支持

### v3.0 → v3.2

- 端口迁移：17999 → 18008
- WebSocket 协议升级
- 依赖升级

详见 [docs/MIGRATION.md](./docs/MIGRATION.md)

---

## 贡献

1. Fork 仓库
2. 创建分支 (`git checkout -b feature/amazing`)
3. 提交变更 (`git commit -m 'feat: add amazing'`)
4. 推送分支 (`git push origin feature/amazing`)
5. 创建 PR

详见 [贡献指南](../CONTRIBUTING.md)

---

## 许可证

[MIT](../LICENSE)

---

## 相关链接

- [产品文档](../README.md)
- [后端服务](../embedding_service/)
- [v3.2 设计文档](../docs/v3.2/)
- [Backlog](../BACKLOG.md)
- [Changelog](../CHANGELOG.md)

---

_版本: 2.9.1_  
_最后更新: 2026-04-10_
