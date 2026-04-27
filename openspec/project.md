# OpenCode Memory Plugin

> OpenClaw-style persistent memory system for OpenCode with native plugin integration, semantic vector search, and hierarchical Atom architecture.

## 技术栈

### 运行时

- **Node.js**: 18+ (CI: node:20)
- **模块系统**: ES Modules (`"type": "module"`)

### 核心依赖

| 包                  | 版本     | 用途                        |
| ------------------- | -------- | --------------------------- |
| @opencode-ai/plugin | ^1.0.0   | OpenCode 插件框架           |
| chokidar            | ^5.0.0   | 文件系统监听                |
| dotenv              | ^16.4.5  | 环境变量配置                |
| fast-json-patch     | ^3.1.1   | JSON Patch (WebSocket diff) |
| oxc-parser          | ^0.121.0 | JS/TS AST 解析              |
| pino                | ^9.5.0   | 结构化日志                  |
| ws                  | ^8.20.0  | WebSocket 客户端            |
| web-tree-sitter     | ^0.26.7  | 多语言 AST 解析             |

### Tree-sitter 语言支持

- tree-sitter-python: ^0.25.0
- tree-sitter-go: ^0.25.0
- tree-sitter-java: ^0.23.5
- tree-sitter-javascript: ^0.25.0
- tree-sitter-rust: ^0.24.0
- tree-sitter-typescript: ^0.23.2

### 开发工具

- **Jest**: ^29.7.0 (测试框架)
- **Oxlint**: 1.57.0 (代码检查)
- **Prettier**: 3.8.1 (代码格式化)
- **TypeScript**: ^5.7.3 (JSDoc 类型检查，不编译)
- **Gitleaks**: v8.21.2 (安全扫描)
- **markdownlint-cli2**: ^0.22.0

### 后端服务 (独立部署)

- **Python**: >=3.10
- **FastAPI**: >=0.115.0,<0.116.0
- **SurrealDB**: 3.0+ (核心数据库)
- **Meilisearch**: (全文搜索引擎)
- **端口**: localhost:18008

## 目录结构

```
opencode-memory-plugin/
├── lib/                          # 核心库 (28 个模块)
│   ├── memory-core.js            # 写入/读取/同步核心
│   ├── entry.js                  # 条目格式化
│   ├── extractor.js              # 分层提取 (L0/L1/L2)
│   ├── storage.js                # 配置/存储
│   ├── wrapper-client.js         # 后端 HTTP API 客户端
│   ├── indexer.js                # 索引管理
│   ├── constants.js              # 常量定义
│   ├── ulid.js                   # ULID 生成
│   ├── config.js                 # 环境配置
│   ├── logger.js                 # 结构化日志
│   ├── project-resolver.js       # 项目 ID 解析
│   ├── memory-id-cache.js        # Memory ID 缓存
│   ├── upload-queue.js           # 上传队列
│   ├── bm25.js                   # BM25 关键词搜索
│   ├── trie.js                   # Trie 数据结构
│   ├── trie-index.js             # Trie 索引管理
│   ├── code-analyzer.js          # 代码 AST 分析 (Oxc)
│   ├── code-analysis-service.js  # 批量分析队列
│   ├── code-analysis-formatter.js # 输出格式化
│   ├── tree-sitter-parser.js     # 多语言 AST 解析
│   ├── project-analyzer.js       # 项目健康度评级
│   ├── privacy-filter.js         # 敏感内容过滤
│   ├── file-watcher.js           # 文件系统监听
│   ├── ws-client.js              # WebSocket 客户端
│   ├── precompute/               # 预计算服务客户端 (4 文件)
│   ├── websocket/                # WebSocket 实时同步 (6 文件)
│   └── queries/                  # Tree-sitter 查询文件 (5 语言)
├── tools/                        # OpenCode 工具 (5 文件)
│   ├── core.js                   # memory_write, memory_pin
│   ├── search.js                 # memory_search, memory_suggest
│   ├── graph.js                  # memory_relate, memory_graph
│   ├── browse.js                 # memory_timeline, memory_topics
│   └── sync.js                   # rebuild_index, index_status, incremental_sync, full_sync, conflict_*
├── tests/                        # 测试文件 (37 个)
│   ├── cli/                      # CLI 测试
│   ├── e2e/                      # 端到端测试
│   ├── integration/              # 集成测试
│   ├── performance/              # 性能测试
│   └── websocket/                # WebSocket 测试
├── agents/                       # 内置代理
│   ├── memory-automation.md      # The Observer
│   └── memory-consolidate.md     # The Librarian
├── cli/                          # CLI 工具
├── scripts/                      # 安装/卸载脚本
├── memory/                       # 记忆文件模板
├── plugin.js                     # 插件入口
├── index.js                      # 插件元数据
└── package.json
```

## 核心模块

### 1. 存储层 (lib/memory-core.js, lib/entry.js, lib/storage.js)

**本地存储路径**: `~/.opencode/memory/timeline/YYYY/MM/DD/entry_{id}.md`

**文件格式**:

```markdown
---
id: 01KQ587D692XHVR1N464Q35FZ3
date: 2026-04-26T15:58:42.391Z
type: architecture
tags: [v3.3, atom, review]
project: @csuwl/opencode-memory-plugin
memory_id: pending
source_id: 
synced: false
synced_at: null
meta: []
---

# ≡≡≡ Abstract ≡≡≡
```

v3.3 Atom review: 5 Critical issues

```

# ≡≡≡ Overview ≡≡≡
```

Found 5 critical issues...

```

# ≡≡≡ Contents ≡≡≡
```

[完整内容]

```

---
```

**索引**: `link-map.json` (内存缓存 + mtime 校验 + 互斥锁)

### 2. 后端 API 客户端 (lib/wrapper-client.js)

**基础**: `localhost:18008`, 前缀 `/api/v1`, 认证 `WRAPPER_MEILI_API_KEY`

| 端点                                 | 方法     | 用途           |
| ------------------------------------ | -------- | -------------- |
| `/health`                            | GET      | 健康检查       |
| `/api/v1/memories/search`            | POST     | 搜索记忆       |
| `/api/v1/memories`                   | POST     | 批量上传       |
| `/api/v1/memories/lookup`            | GET      | 按 ID/路径查找 |
| `/api/v1/memories/{id}/references`   | GET      | 入站调用       |
| `/api/v1/memories/{id}/dependencies` | GET      | 出站调用       |
| `/api/v1/memories/relations`         | POST     | 创建关系       |
| `/api/v1/memories/{id}/graph`        | POST     | 图遍历         |
| `/api/v1/atoms`                      | POST/GET | Atom CRUD      |
| `/api/v1/entities`                   | POST/GET | Entity CRUD    |
| `/api/v1/sync/preview`               | POST     | 增量同步预览   |
| `/api/v1/sync/full`                  | POST     | 全量同步       |

### 3. 插件工具 (tools/)

| 工具               | 功能          | 后端依赖           |
| ------------------ | ------------- | ------------------ |
| `memory_write`     | 写入记忆      | 同步               |
| `memory_read`      | 读取记忆      | 本地               |
| `memory_search`    | 搜索记忆      | 优先后端，降级本地 |
| `memory_suggest`   | 自动补全      | 本地 (Trie)        |
| `memory_pin`       | 置顶/取消置顶 | 本地               |
| `memory_relate`    | 创建关系      | 必须               |
| `memory_graph`     | 图遍历        | 必须               |
| `memory_timeline`  | 时间线浏览    | 本地               |
| `memory_topics`    | 主题浏览      | 本地               |
| `index_status`     | 系统状态      | 可选               |
| `rebuild_index`    | 重建索引      | 必须               |
| `incremental_sync` | 增量同步      | 必须               |
| `full_sync`        | 全量同步      | 必须               |
| `conflict_list`    | 冲突列表      | 必须               |
| `conflict_resolve` | 解决冲突      | 必须               |
| `sync_checkpoint`  | 同步检查点    | 必须               |

### 4. 搜索 (lib/bm25.js, lib/trie-index.js)

**混合搜索**: `final_score = 0.7 * vector_similarity + 0.3 * bm25_score`

| 模式      | 算法        | 速度 | 质量   |
| --------- | ----------- | ---- | ------ |
| `hybrid`  | 向量 + BM25 | 中   | ⭐⭐⭐ |
| `vector`  | 纯向量      | 中   | ⭐⭐   |
| `keyword` | BM25        | 快   | ⭐⭐   |
| `hash`    | 精确匹配    | 快   | ⭐     |

### 5. 代码分析 (lib/code-analyzer.js, lib/tree-sitter-parser.js)

- **Oxc 引擎**: JS/TS AST 分析
- **Tree-sitter**: Python, Go, Rust, Java 支持
- **健康度评级**: A/B/C/D
- **复杂度指标**: 圈复杂度、最大嵌套深度

## 数据模型

### Entity (实体)

```javascript
{
  id:          "entity:01H..."           // ULID record ID
  tenant_id:   "default"                 // 租户 ID
  type:        "memory" | "backlog" | "wiki" | "code"

  // L0/L1/L2 分层
  abstract:    "string ≤100 chars"       // L0 摘要
  overview:    { text: "string ≤500" }   // L1 结构化概览

  // 关联
  atoms:       ["atom:01H...", ...]      // 关联 Atom IDs
  tags:        ["tag1", "tag2"]
  project:     "@owner/repo"

  // Wiki 特有
  title:       "string?"
  aliases:     ["alias1"]
  outgoing_links: ["id1"]
  incoming_links: ["id2"]

  // Backlog 特有
  priority:    "P0" | "P1" | "P2" | "P3"
  status:      "backlog" | "todo" | "in_progress" | "in_review" | "done"
  scene:       "string?"
  estimated_hours:  float?
  actual_hours:     float?

  // Code 特有
  file_path:       "string?"
  language:        "string?"
  quality_score:   { score: number }?
  complexity_metrics: {}?

  created_by:  "plugin"
  created_at:  datetime
  updated_at:  datetime
}
```

### Atom (原子)

| 字段                | 类型                                                                                        | 说明                |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| `id`                | `"atom:01H..."`                                                                             | Atom 唯一 ID        |
| `tenant_id`         | `"default"`                                                                                 | 租户 ID             |
| `type`              | `"function" \| "class" \| "interface" \| "import" \| "goal" \| "scope" \| "task" \| "note"` | Atom 类型           |
| `content`           | `string`                                                                                    | 函数源码 / 任务描述 |
| `name`              | `string?`                                                                                   | 函数名 / 类名       |
| `signature`         | `string?`                                                                                   | 函数签名            |
| `params`            | `string[]?`                                                                                 | 参数列表            |
| `return_type`       | `string?`                                                                                   | 返回类型            |
| `is_exported`       | `boolean?`                                                                                  | 是否导出            |
| `is_async`          | `boolean?`                                                                                  | 是否异步            |
| `complexity`        | `int?`                                                                                      | 圈复杂度            |
| `max_nesting_depth` | `int?`                                                                                      | 最大嵌套深度        |
| `docstring`         | `{text: string}?`                                                                           | JSDoc 文档          |
| `start_line`        | `int?`                                                                                      | 起始行号            |
| `end_line`          | `int?`                                                                                      | 结束行号            |
| `status`            | `"pending" \| "done" \| "blocked"?`                                                         | 任务状态            |
| `metadata`          | `object?`                                                                                   | 元数据              |
| `project`           | `string?`                                                                                   | 项目 ID             |
| `version`           | `1`                                                                                         | 版本                |
| `created_at`        | `datetime`                                                                                  | 创建时间            |
| `updated_at`        | `datetime`                                                                                  | 更新时间            |

### Reference (关系)

```javascript
{
  id:          "reference:01H..."
  tenant_id:   "default"
  type:        "depends_on" | "blocks" | "calls" | "imports" | "implements" | "relates_to" | "wiki_link" | "part_of"
  in:          "atom:01H..." | "entity:01H..."   // 源
  out:         "atom:01H..." | "entity:01H..."   // 目标
  file_path:   "string?"
  line:        int?
  column:      int?
  weight:      0.5
  metadata:    {}?
  created_by:  "plugin"
  created_at:  datetime
}
```

## 编码规范

### 命名风格

| 类别     | 风格        | 示例                                  |
| -------- | ----------- | ------------------------------------- |
| 文件名   | kebab-case  | `memory-core.js`, `wrapper-client.js` |
| 函数名   | camelCase   | `writeMemory()`, `extractByLevel()`   |
| 类名     | PascalCase  | `WrapperClient`, `BM25Index`          |
| 常量     | UPPER_SNAKE | `MEMORY_DIR`, `LINK_MAP_FILE`         |
| 私有变量 | 下划线前缀  | `_source`, `_wsClient`                |
| 工具名   | snake_case  | `memory_write`, `memory_search`       |
| 环境变量 | UPPER_SNAKE | `API_PORT`, `WRAPPER_MEILI_API_KEY`   |

### 错误处理

**结果对象返回** (lib 层):

```javascript
return {
  success: false,
  localId: "",
  message: "❌ Error: abstract is REQUIRED...",
};
```

**字符串返回** (工具层):

```javascript
return "❌ Error: abstract is REQUIRED.";
```

**异常类** (HTTP 层):

```javascript
export class WrapperError extends Error {
  constructor(message, statusCode, retryable = false) { ... }
}
```

### 异步模式

```javascript
// async/await 为主
async function writeEntryToTimeline(layers, metadata) { ... }

// Promise 链互斥锁
let linkMapLock = Promise.resolve();
export async function withLinkMapLock(fn) { ... }

// 指数退避重试
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) { ... }

// 动态 import
const { readMemory } = await import('./lib/memory-core.js');
```

### 注释风格

```javascript
/**
 * JSDoc 块注释 — 用于公开 API
 * @param {WriteMemoryParams} params
 * @returns {Promise<WriteMemoryResult>}
 */

// 行内注释 — 解释业务逻辑
// 1. 写入本地文件
// 2. 更新 link-map
// 3. 回滚：步骤 2-4 失败时删除孤立文件

// 中文注释为主，英文为辅
// 日志前缀约定
console.warn(`[memory-core] ...`);
```

## 技术债务

### 🔴 Critical（5 项）

| #   | 问题                         | 位置                                                                                          | 影响                                    |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| C1  | **EXDEV 处理重复**           | 6 处 (`entry.js`, `indexer.js`, `memory-id-cache.js`, `project-resolver.js`, `trie-index.js`) | 应提取为 `lib/atomic-write.js` 共用函数 |
| C2  | **writeLog 重复且缺少脱敏**  | `wrapper-client.js`, `sync.js`                                                                | `sync.js` 版本可能泄露 API key 到日志   |
| C3  | **frontmatter 解析重复**     | `entry.js`, `extractor.js`                                                                    | 逻辑几乎相同，应统一                    |
| C4  | **atomicWriteText 重复**     | `entry.js`, `indexer.js`                                                                      | 完全相同的函数定义                      |
| C5  | **HOME/MEMORY_DIR 重复计算** | 4 处                                                                                          | 应统一从 constants 导入                 |

### 🟠 High（9 项）

| #   | 问题                       | 位置                     | 建议                            |
| --- | -------------------------- | ------------------------ | ------------------------------- |
| H1  | Magic Number 102           | `indexer.js:89`          | 抽取为常量 `MAX_OVERVIEW_LINES` |
| H2  | 端口硬编码                 | `wrapper-client.js:256`  | 从 config 读取                  |
| H3  | BM25 参数不可配置          | `bm25.js:15-16`          | 支持不同场景调参                |
| H4  | MAX_FILE_SIZE 不可配置     | `privacy-filter.js:46`   | 配置化                          |
| H5  | 7 处硬编码超时/TTL         | 多处                     | 统一为可配置常量                |
| H6  | abstract/overview 长度限制 | `memory-core.js:127-144` | 提取为 constants                |
| H7  | 16 处空 catch 块           | 分布多处                 | 部分合理，部分需添加日志        |
| H8  | 单例无重置机制             | `wrapper-client.js`      | tenant_id 变更时无法更新        |
| H9  | forceNew 参数未实现        | `wrapper-client.js`      | 文档提到但未实现                |

### 🟡 Medium（8 项）

- JSDoc 缺失: `tools/sync.js`, `tools/search.js`, `tools/browse.js`, `tools/graph.js`, `lib/extractor.js`, `lib/storage.js`
- 命名不一致: `resolveTenantId` 两处实现略有不同
- 日志不脱敏: `sync.js` 的 `writeLog` 与 `wrapper-client.js` 版本不同步
- linkMap 版本硬编码: 4 处 `"2.4.0"`

### 🟢 Low（6 项）

- 依赖版本: `tree-sitter-typescript` 可升级
- console.log 散布: 应统一使用 `lib/logger.js`
- 未使用变量: `_originalUrl`, `_source`
- 文档不一致: `AGENTS.md` 与实际代码不符

**修复建议**: 3 个 PR 可消除 60%+ 债务

1. **PR1**: 提取 `atomicWrite` 共用函数 → 消除 C1 + C4 + C5
2. **PR2**: 统一日志模块 → 消除 C2 + M6 + L2
3. **PR3**: 统一 frontmatter 解析 → 消除 C3 + M8

## 部署方式

### 本地开发

```bash
# 插件端
npm install -g @csuwl/opencode-memory-plugin

# 后端 (需单独部署)
git clone <backend-repo>
cd embedding_service/wrapper
pip install -e .
uvicorn src.main:app --host 0.0.0.0 --port 18008
```

### Docker (测试用途)

```dockerfile
# Dockerfile.quick-test - 快速测试（无模型下载）
FROM node:20-slim

# Dockerfile.opendcode-test - 完整测试（含模型下载）
FROM node:20-slim
```

### 环境变量

```bash
# 必需
export WRAPPER_MEILI_API_KEY="your-api-key"

# 可选
export API_PORT="18008"
export BACKEND_URL="http://localhost:18008"
export MEMORY_DIR="~/.opencode/memory"
export MODELSCOPE_API_KEY="..."
```

## 测试策略

### 测试框架

- **Jest**: ^29.7.0
- **运行命令**: `node --experimental-vm-modules node_modules/jest/bin/jest.js`
- **覆盖率门槛**: 10% (本地), 85% (CI)
- **超时**: 30 秒

### 测试分布

| 类型           | 数量   | 位置                 |
| -------------- | ------ | -------------------- |
| 单元测试       | 28     | `tests/`             |
| CLI 测试       | 1      | `tests/cli/`         |
| 集成测试       | 4      | `tests/integration/` |
| 端到端测试     | 1      | `tests/e2e/`         |
| 性能测试       | 1      | `tests/performance/` |
| WebSocket 测试 | 2      | `tests/websocket/`   |
| **总计**       | **37** |                      |

### CI/CD

**GitHub Actions**: `.github/workflows/design-compliance.yml`

**流水线**:

1. Gitleaks 安全扫描
2. Oxlint 代码检查
3. Prettier 格式化检查
4. Markdownlint 文档检查
5. Jest 单元测试 (覆盖率 ≥85%)
6. Design-Ref 提交信息检查
7. RTM 更新检查

**Pre-commit 钩子**:

```yaml
- Gitleaks (P0)
- Oxlint (P1)
- Prettier (P2)
- Markdownlint (P3)
- Jest (P4)
```

---

**生成日期**: 2026-04-27
**扫描范围**: opencode-memory-plugin v3.2.0
**技术债务**: 28 项 (5 Critical / 9 High / 8 Medium / 6 Low)
