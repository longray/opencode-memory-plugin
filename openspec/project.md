# OpenCode Memory Plugin

> OpenClaw-style persistent memory system for OpenCode with native plugin integration, semantic vector search, and hierarchical Atom architecture.

## 技术栈

### 后端服务 (Python)

- **Python**: >=3.10
- **FastAPI**: >=0.115.0,<0.116.0
- **Uvicorn**: >=0.32.0,<0.33.0 (standard)
- **Pydantic**: >=2.9.0,<2.10.0
- **SurrealDB SDK**: >=1.0.8,<1.1.0
- **Meilisearch SDK**: >=0.40.0,<0.41.0
- **WebSockets**: >=12.0,<13.0
- **Transformers**: >=4.48.0
- **Torch**: ==2.4.0+cu121
- **tree-sitter**: >=0.25.0,<0.26.0 (多语言 AST 解析)
- **fast-json-patch**: >=1.32
- **portalocker**: >=2.7
- **psutil**: >=5.9
- **aiofiles**: >=23.0

### 插件端 (Node.js)

- **Node.js**: 18+
- **模块系统**: ESM ("type": "module")
- **@opencode-ai/plugin**: ^1.0.0
- **chokidar**: ^5.0.0 (文件监听)
- **dotenv**: ^16.4.5
- **fast-json-patch**: ^3.1.1
- **oxc-parser**: ^0.121.0 (JS/TS AST)
- **pino**: ^9.5.0 (日志)
- **ws**: ^8.20.0 (WebSocket)

### 开发工具

- **Jest**: ^29.7.0 (测试)
- **Oxlint**: 1.57.0 (代码检查)
- **Prettier**: 3.8.1 (格式化)
- **TypeScript**: ^5.7.3 (类型检查)
- **markdownlint-cli2**: ^0.22.0

### 数据库

- **SurrealDB**: 3.0+ (核心数据库，7 张表)
- **Meilisearch**: (全文搜索引擎)

## 目录结构

```
opencode-memory-plugin/
├── opencode-memory-plugin/          # 插件端 (Node.js ESM)
│   ├── plugin.js                    # 插件入口，注册 15 个工具
│   ├── lib/                         # 核心库 (28 个模块)
│   │   ├── memory-core.js           # 写入/读取/同步核心
│   │   ├── wrapper-client.js        # 后端 HTTP API 客户端
│   │   ├── entry.js                 # 条目格式化
│   │   ├── extractor.js             # 分层提取 (L0/L1/L2)
│   │   ├── storage.js               # 本地存储
│   │   ├── indexer.js               # 索引管理
│   │   ├── bm25.js                  # BM25 关键词搜索
│   │   ├── trie-index.js            # Trie 前缀索引
│   │   ├── code-analyzer.js         # Oxc AST 分析 (JS/TS)
│   │   ├── tree-sitter-parser.js    # 多语言 AST 解析
│   │   ├── project-analyzer.js      # 项目健康度评级
│   │   ├── file-watcher.js          # 文件监听 (300ms debounce)
│   │   ├── privacy-filter.js        # 敏感内容过滤
│   │   ├── websocket/               # WebSocket 实时同步 (6 文件)
│   │   │   ├── reliable-client.js   # 可靠连接 (指数退避重连)
│   │   │   ├── heartbeat.js
│   │   │   ├── ack-manager.js
│   │   │   ├── state-manager.js
│   │   │   ├── diff-subscription.js
│   │   │   └── index.js
│   │   ├── precompute/              # 预计算服务客户端 (4 文件)
│   │   │   ├── client.js
│   │   │   ├── batch-processor.js
│   │   │   ├── fingerprint-cache.js
│   │   │   └── index.js
│   │   └── queries/                 # SurrealDB 查询模板
│   ├── tools/                       # OpenCode 工具定义 (5 文件)
│   │   ├── core.js                  # memory_write, memory_pin
│   │   ├── search.js                # memory_search, memory_suggest
│   │   ├── graph.js                 # memory_relate, memory_graph
│   │   ├── browse.js                # memory_timeline, memory_topics
│   │   └── sync.js                  # index_status, rebuild_index, incremental_sync, full_sync, sync_checkpoint, conflict_*
│   ├── agents/                      # 内置代理 (2 个)
│   │   ├── memory-automation.md     # The Observer (primary, Tab 切换)
│   │   └── memory-consolidate.md    # The Librarian (@memory-consolidate)
│   ├── cli/                         # CLI 工具
│   │   ├── index.cjs                # 主 CLI
│   │   └── code-analyzer.cjs        # 代码分析 CLI
│   ├── tests/                       # 测试 (37 个文件)
│   │   ├── test-core.test.js
│   │   ├── test-code-analysis.test.js
│   │   ├── websocket/
│   │   ├── integration/
│   │   ├── performance/
│   │   └── e2e/
│   ├── bin/install.cjs              # NPM 安装钩子
│   └── memory/                      # 记忆模板 (安装时复制)
├── docs/                            # 开发文档 (34 文件)
│   ├── API-CONTRACT.md              # 工具↔后端 API 映射
│   ├── v3.2/                        # v3.2 架构文档 (22 文件)
│   │   ├── UNIFIED-ARCHITECTURE-v3.2.md
│   │   ├── DATABASE-v3.2-SCHEMA.md  # SurrealDB Schema (839 行)
│   │   ├── DEPENDENCY-VERSIONS.md
│   │   ├── PLUGIN-v3.2-*.md
│   │   └── BACKEND-v3.2-*.md
│   ├── v3.3-ATOM-ARCHITECTURE-DESIGN.md  # v3.3 Atom 架构设计
│   └── archive/                     # 26 个已归档文档
├── embedding_service/               # 后端 (Python, 子模块)
│   └── wrapper/
│       ├── pyproject.toml
│       └── src/routers/             # API 路由
├── .github/workflows/               # CI/CD
│   └── design-compliance.yml
├── Dockerfile.quick-test            # 测试容器
├── Dockerfile.opendcode-test        # 测试容器
└── clear-all-memories.js            # 调试用清空脚本
```

## 核心模块

### 1. 后端 API

**基础**: `localhost:18008`, 前缀 `/api/v1`, 认证 `WRAPPER_MEILI_API_KEY`

| 端点                                 | 方法     | 用途                             |
| ------------------------------------ | -------- | -------------------------------- |
| `/health`                            | GET      | 健康检查                         |
| `/api/v1/memories/search`            | POST     | 搜索记忆 (vector/keyword/hybrid) |
| `/api/v1/memories`                   | POST     | 批量上传记忆                     |
| `/api/v1/memories/lookup`            | GET      | 按 ID/路径查找                   |
| `/api/v1/memories/{id}/references`   | GET      | 入站调用                         |
| `/api/v1/memories/{id}/dependencies` | GET      | 出站调用                         |
| `/api/v1/memories/relations`         | POST     | 创建关系                         |
| `/api/v1/memories/{id}/graph`        | POST     | 图遍历                           |
| `/api/v1/atoms`                      | POST/GET | Atom CRUD                        |
| `/api/v1/entities`                   | POST/GET | Entity CRUD                      |
| `/api/v1/sync/preview`               | POST     | 增量同步预览                     |
| `/api/v1/sync/full`                  | POST     | 全量同步                         |

### 2. 存储层

**本地存储**: `~/.opencode/memory/timeline/YYYY/MM/DD/entry_{id}.md`

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

### 3. 插件工具

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

### 4. 搜索

**混合搜索**: `final_score = 0.7 * vector_similarity + 0.3 * bm25_score`

| 模式      | 算法        | 速度 | 质量   |
| --------- | ----------- | ---- | ------ |
| `hybrid`  | 向量 + BM25 | 中   | ⭐⭐⭐ |
| `vector`  | 纯向量      | 中   | ⭐⭐   |
| `keyword` | BM25        | 快   | ⭐⭐   |
| `hash`    | 精确匹配    | 快   | ⭐     |

## 数据模型

### Entity (实体)

```javascript
{
  id:          "entity:01H..."           // ULID record ID
  tenant_id:   "default"
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

```javascript
{
  id: "atom:01H...";
  tenant_id: "default";
  type: "function" |
    "class" |
    "interface" |
    "import" |
    "goal" |
    "scope" |
    "task" |
    "note";
  content: "string"; // 函数源码 / 任务描述
  name: "string?"; // 函数名 / 类名
  signature: "string?"; // 函数签名
  params: ["arg1", "arg2"] // 参数列表
    ? return_type
    : "string?"; // 返回类型
  is_exported: boolean
    ? is_async
    : boolean
      ? complexity
      : int // 圈复杂度
        ? max_nesting_depth
        : int // 最大嵌套深度
          ? docstring
          : { text: "..." } // JSDoc
            ? start_line
            : int
              ? end_line
              : int
                ? status
                : "pending" | "done" | "blocked"
                  ? metadata
                  : {}
                    ? project
                    : "string?";
  version: 1;
  created_at: datetime;
  updated_at: datetime;
}
```

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

### 1. JSDoc 覆盖不完整

| 文件                | 覆盖      | 说明          |
| ------------------- | --------- | ------------- |
| `memory-core.js`    | ⭐⭐⭐ 优 | 完整 @typedef |
| `wrapper-client.js` | ⭐⭐⭐ 优 | 完整文档      |
| `extractor.js`      | ⭐ 无     | 零 JSDoc      |
| `storage.js`        | ⭐ 无     | 零 JSDoc      |
| `entry.js`          | ⭐ 无     | 零 JSDoc      |
| `tools/*.js`        | ⭐ 无     | 零 JSDoc      |

### 2. 硬编码值

```javascript
// constants.js
MEMORY_DIR = '~/.opencode/memory'        // 不可配置

// wrapper-client.js
apiPort = '18008'                        // 环境变量可覆盖
timeout = 30000                          // 30s 默认超时
maxRetries = 3                           // 重试次数

// bm25.js
K1 = 1.2, B = 0.75                       // BM25 参数不可调

// privacy-filter.js
MAX_FILE_SIZE = 1MB                      // 不可配置

// indexer.js
lines.length > 102                       // .overview.md 最大行数
```

### 3. 重复代码

| 重复点            | 位置                            | 说明                               |
| ----------------- | ------------------------------- | ---------------------------------- |
| `atomicWriteText` | `entry.js` + `indexer.js`       | 完全相同的原子写入实现             |
| `writeLog`        | `wrapper-client.js` + `sync.js` | 日志函数重复，sync.js 版本缺少脱敏 |
| `EXDEV` 处理      | 3 处                            | 跨设备 rename fallback 重复        |
| frontmatter 解析  | `entry.js` + `extractor.js`     | 两个几乎相同的 YAML 解析器         |

### 4. 其他债务

1. **单例客户端不可重建**: `getWrapperClient()` 全局单例，tenant_id 变更时仅 warn
2. **同步 I/O 大量使用**: `fs.writeFileSync`, `fs.readFileSync` 遍布核心路径
3. **link-map 无分片**: 所有条目存一个 JSON 文件，条目数增长后性能下降
4. **BM25 未实际使用**: `bm25.js` 实现了完整 BM25，但 `memory_search` 本地降级用的是简易字符串匹配
5. **memory_read 动态 import**: 每次调用都重新加载模块
6. **WrapperClient 无连接池**: 每个请求都是独立 fetch

## 部署方式

### 本地开发

```bash
# 插件端
npm install -g @csuwl/opencode-memory-plugin

# 后端 (需单独部署 embedding_service)
git clone <backend-repo>
cd embedding_service/wrapper
pip install -e .
uvicorn src.main:app --host 0.0.0.0 --port 18008
```

### Docker (测试用途)

```dockerfile
# Dockerfile.quick-test
FROM node:20-slim
# 快速向量搜索测试（无模型下载）

# Dockerfile.opendcode-test
FROM node:20-slim
# OpenCode 集成测试（含模型下载）
```

### 生产部署

**无 Kubernetes 配置**，推荐方式:

1. **后端**: Docker Compose / 裸机部署
2. **数据库**: SurrealDB 官方 Docker 镜像
3. **搜索**: Meilisearch 官方 Docker 镜像
4. **插件**: 用户本地安装 `npm install -g @csuwl/opencode-memory-plugin`

### 环境变量

```bash
# 必需
export WRAPPER_MEILI_API_KEY="your-api-key"

# 可选
export API_PORT="18008"
export BACKEND_URL="http://localhost:18008"
export MEMORY_DIR="~/.opencode/memory"
export MODELSCOPE_API_KEY="..."  # 外部嵌入服务
```

## CI/CD

**GitHub Actions**: `.github/workflows/design-compliance.yml`

**流水线**:

1. Node.js 20 + `npm ci`
2. Oxlint 代码检查
3. Markdownlint 文档检查
4. Jest 单元测试（覆盖率阈值 85%）
5. Design-Ref 提交信息检查
6. RTM 更新检查
7. 合规报告生成

**Pre-commit 钩子**:

- Gitleaks (安全扫描)
- Oxlint (代码检查)
- Prettier (格式化)
- Markdownlint-cli2
- Jest (测试门禁)
