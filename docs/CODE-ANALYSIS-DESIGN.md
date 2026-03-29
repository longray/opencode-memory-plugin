# 代码分析功能设计文档

> 基于 GitNexus 功能分析，为 opencode-memory-plugin 设计的代码分析增强方案

**版本**: v1.0.0  
**日期**: 2026-03-28  
**状态**: 设计阶段

---

## 目录

1. [背景与目标](#背景与目标)
2. [GitNexus 功能分析](#gitnexus-功能分析)
3. [现有架构分析](#现有架构分析)
4. [增强功能设计](#增强功能设计)
5. [与后端集成](#与后端集成)
6. [技术栈选择](#技术栈选择)
7. [数据模型设计](#数据模型设计)
8. [API 接口设计](#api-接口设计)
9. [实现计划](#实现计划)
10. [风险与挑战](#风险与挑战)

---

## 背景与目标

### 背景

当前 opencode-memory-plugin 主要专注于**记忆管理**（memory_write, memory_search 等），但缺乏**代码分析**能力。用户在使用 AI 编程助手时，经常需要：

1. **代码搜索** - 在代码库中搜索函数、类、变量等符号
2. **代码理解** - 分析代码结构，理解项目架构
3. **代码记忆** - 将代码分析结果保存到记忆系统

### 目标

实现完整的代码分析功能，包括：

- ✅ **AST 解析** - 使用 tree-sitter 解析 14 种编程语言
- ✅ **符号提取** - 提取函数、类、接口、装饰器等
- ✅ **依赖解析** - 解析导入、调用、继承关系
- ✅ **知识图谱** - 构建代码关系图谱
- ✅ **社区检测** - 识别功能模块和集群
- ✅ **流程追踪** - 追踪执行流程和调用链
- ✅ **影响分析** - 评估代码变更的影响范围
- ✅ **MCP 工具** - 为 AI 代理提供代码分析工具

---

## GitNexus 功能分析

### GitNexus 核心架构

```
源代码 → Tree-sitter AST → 符号提取 → 依赖解析 → 社区检测 → 流程追踪 → 知识图谱
```

### 6 阶段索引管道

| 阶段    | 功能                    | 进度    | 技术         |
| ------- | ----------------------- | ------- | ------------ |
| 1. 扫描 | 遍历文件树，收集路径    | 0-15%   | 文件系统遍历 |
| 2. 结构 | 创建 File/Folder 节点   | 15-20%  | 图数据库     |
| 3. 解析 | AST 解析，提取符号      | 20-82%  | Tree-sitter  |
| 4. 解析 | 解析导入、调用、继承    | 集成    | 语言感知逻辑 |
| 5. 社区 | Leiden 算法检测功能集群 | 82-92%  | 图算法       |
| 6. 流程 | 追踪执行流程和调用链    | 92-100% | BFS 遍历     |

### GitNexus MCP 工具

| 工具             | 功能                    | 本项目适用性 |
| ---------------- | ----------------------- | ------------ |
| `query`          | 混合搜索（BM25 + 语义） | ✅ 高        |
| `context`        | 360度符号视图           | ✅ 高        |
| `impact`         | 爆炸半径分析            | ✅ 高        |
| `detect_changes` | Git 变更影响            | ⚠️ 中        |
| `rename`         | 多文件重命名            | ⚠️ 中        |
| `cypher`         | 原始图查询              | ⚠️ 中        |

### GitNexus 技术栈

| 组件     | GitNexus                  | 说明           |
| -------- | ------------------------- | -------------- |
| AST 解析 | Tree-sitter (native/WASM) | 支持 14 种语言 |
| 图数据库 | KuzuDB (原 LadybugDB)     | 嵌入式图数据库 |
| 社区检测 | Leiden (graphology)       | 图算法库       |
| 搜索     | BM25 + 语义 + RRF         | 混合搜索       |
| 嵌入     | transformers.js           | 可选，GPU 加速 |
| 并发     | Worker threads            | 并行解析       |

---

## 现有架构分析

### 当前模块结构

```
opencode-memory-plugin/
├── lib/
│   ├── memory-core.js      # 记忆核心（write/read）
│   ├── entry.js            # 条目格式化
│   ├── extractor.js        # L0/L1/L2 内容提取
│   ├── indexer.js          # link-map 索引
│   ├── storage.js          # 配置和存储
│   ├── bm25.js             # BM25 搜索
│   ├── trie.js             # Trie 索引
│   ├── trie-index.js       # Trie 索引管理
│   └── wrapper-client.js   # 后端 API 客户端
├── tools/
│   ├── core.js             # memory_write
│   ├── search.js           # memory_search, memory_suggest
│   ├── graph.js            # memory_relate, memory_graph
│   ├── browse.js           # memory_timeline, memory_topics
│   └── sync.js             # 同步工具
└── plugin.js               # 插件入口
```

### 现有搜索能力

| 搜索方式    | 实现          | 局限性           |
| ----------- | ------------- | ---------------- |
| BM25 关键词 | `lib/bm25.js` | 仅搜索记忆内容   |
| Trie 前缀   | `lib/trie.js` | 仅搜索记忆关键词 |
| 语义搜索    | 后端 API      | 依赖后端服务     |

### 与后端的关系

```
┌─────────────────┐     ┌─────────────────┐
│  本地插件       │     │  后端服务       │
│  (Node.js)      │◄───►│  (FastAPI)      │
├─────────────────┤     ├─────────────────┤
│ - 本地存储      │     │ - 向量搜索      │
│ - BM25 搜索     │     │ - 图数据库      │
│ - Trie 索引     │     │ - 记忆同步      │
└─────────────────┘     └─────────────────┘
```

---

## 增强功能设计

### 新增模块

```
opencode-memory-plugin/
├── lib/
│   ├── code-parser.js          # AST 解析器（封装 tree-sitter）
│   ├── feature-extractor.js    # 代码特征提取器
│   ├── dependency-resolver.js  # 依赖解析器
│   ├── code-graph.js           # 知识图谱
│   ├── community-detector.js   # 社区检测（Leiden 算法）
│   ├── process-tracer.js       # 流程追踪
│   ├── impact-analyzer.js      # 影响分析
│   └── code-search.js          # 代码搜索引擎
├── tools/
│   └── code-analysis.js        # 代码分析工具
└── parsers/                    # 语言解析器配置
    ├── javascript.js
    ├── typescript.js
    ├── python.js
    └── ...
```

### 功能模块设计

#### 1. AST 解析器 (`lib/code-parser.js`)

```javascript
export class CodeParser {
  constructor() {
    this.parsers = new Map(); // 语言 -> parser
  }

  // 初始化解析器
  async init(languages = ["javascript", "typescript", "python"]) {}

  // 解析文件
  parseFile(filePath, content) {
    // 1. 检测语言
    // 2. 选择解析器
    // 3. 解析 AST
    // 4. 返回 AST 和语言信息
  }

  // 提取符号
  extractSymbols(ast, language) {
    // 提取函数、类、接口、变量等
  }
}
```

#### 2. 特征提取器 (`lib/feature-extractor.js`)

```javascript
export class FeatureExtractor {
  // 提取函数
  extractFunctions(ast) {
    return [{
      name: 'functionName',
      params: ['param1', 'param2'],
      returnType: 'string',
      startLine: 10,
      endLine: 20,
      isExported: true,
      isAsync: false
    }];
  }

  // 提取类
  extractClasses(ast) {
    return [{
      name: 'ClassName',
      methods: [...],
      properties: [...],
      extends: 'ParentClass',
      implements: ['Interface1']
    }];
  }

  // 提取接口
  extractInterfaces(ast) {}

  // 提取装饰器
  extractDecorators(ast) {}

  // 提取导入
  extractImports(ast) {}

  // 提取导出
  extractExports(ast) {}
}
```

#### 3. 依赖解析器 (`lib/dependency-resolver.js`)

```javascript
export class DependencyResolver {
  constructor(symbolTable) {
    this.symbolTable = symbolTable;
    this.importCache = new Map();
  }

  // 解析导入
  resolveImports(ast, filePath) {
    // 1. 提取 import 语句
    // 2. 解析导入路径
    // 3. 查找目标文件
    // 4. 创建 IMPORTS 边
  }

  // 解析调用
  resolveCalls(ast, filePath) {
    // 1. 查找函数调用
    // 2. 查找调用者函数
    // 3. 查找被调用函数
    // 4. 创建 CALLS 边（带置信度）
  }

  // 解析继承
  resolveHeritage(ast) {
    // 1. 查找 extends/implements
    // 2. 创建 EXTENDS/IMPLEMENTS 边
  }
}
```

#### 4. 知识图谱 (`lib/code-graph.js`)

```javascript
export class CodeGraph {
  constructor() {
    this.nodes = new Map(); // id -> node
    this.edges = new Map(); // id -> edges[]
  }

  // 添加节点
  addNode(type, name, filePath, metadata) {
    const id = `${type}:${name}:${filePath}`;
    this.nodes.set(id, { type, name, filePath, ...metadata });
    return id;
  }

  // 添加边
  addEdge(fromId, toId, type, confidence = 1.0) {
    const edge = { from: fromId, to: toId, type, confidence };
    if (!this.edges.has(fromId)) this.edges.set(fromId, []);
    this.edges.get(fromId).push(edge);
  }

  // 查询节点
  getNode(id) {}

  // 查询关系
  getEdges(nodeId, direction = "both") {}

  // 导出为 JSON
  toJSON() {}

  // 从 JSON 导入
  fromJSON(json) {}
}
```

#### 5. 社区检测 (`lib/community-detector.js`)

```javascript
export class CommunityDetector {
  // Leiden 算法检测社区
  detect(graph, options = {}) {
    // 1. 构建加权图
    // 2. 运行 Leiden 算法
    // 3. 返回社区分配
  }

  // 生成启发式标签
  generateLabels(communities, nodePathMap) {
    // 基于文件夹名生成标签
    // 例如: "Authentication", "Database", "Api"
  }

  // 计算内聚度
  calculateCohesion(community, graph) {
    // 计算内部边密度
  }
}
```

#### 6. 流程追踪 (`lib/process-tracer.js`)

```javascript
export class ProcessTracer {
  // 检测入口点
  detectEntryPoints(graph) {
    // 评分算法:
    // - 调用比率 (calls many, called by few)
    // - 导出状态 (public API)
    // - 名称模式 (handle*, on*, *Controller)
  }

  // BFS 追踪
  traceFromEntry(entryId, graph, options = {}) {
    // 1. 从入口点开始
    // 2. 跟随 CALLS 边
    // 3. 限制深度和分支
    // 4. 返回调用链
  }

  // 去重
  deduplicateTraces(traces) {
    // 移除子集，保留最长路径
  }
}
```

#### 7. 影响分析 (`lib/impact-analyzer.js`)

```javascript
export class ImpactAnalyzer {
  // 上游分析（谁依赖我）
  analyzeUpstream(symbolId, graph, maxDepth = 3) {
    // 返回:
    // - Depth 1: 直接依赖（会中断）
    // - Depth 2: 间接依赖（可能受影响）
    // - Depth 3+: 远程依赖（低风险）
  }

  // 下游分析（我依赖谁）
  analyzeDownstream(symbolId, graph, maxDepth = 3) {}

  // 计算置信度
  calculateConfidence(path) {
    // 同文件: 1.0
    // 导入解析: 0.85
    // 模糊匹配: 0.5 或 0.3
  }
}
```

#### 8. 代码搜索引擎 (`lib/code-search.js`)

```javascript
export class CodeSearchEngine {
  constructor(graph, bm25Index, trieIndex) {
    this.graph = graph;
    this.bm25 = bm25Index;
    this.trie = trieIndex;
  }

  // 三层搜索
  async search(query, options = {}) {
    // 第一层: 文件名搜索
    const fileResults = this.searchByFilename(query);

    // 第二层: AST 符号搜索
    const symbolResults = this.searchBySymbol(query);

    // 第三层: BM25 全文搜索
    const bm25Results = await this.bm25.search(query);

    // RRF 融合
    return this.fuseResults(fileResults, symbolResults, bm25Results);
  }

  // RRF 融合算法
  fuseResults(...resultSets) {
    // RRF_score = Σ (1 / (k + rank_i))
    // k = 60
  }
}
```

#### 9. 增量索引器 (`lib/incremental-indexer.js`)

```javascript
export class IncrementalIndexer {
  constructor(codeGraph, codeParser) {
    this.graph = codeGraph;
    this.parser = codeParser;
    this.fingerprints = new Map(); // filePath -> { hash, lastModified, size }
  }

  // 检测文件变化
  detectChanges(dirPath) {
    const changes = {
      added: [], // 新增文件
      modified: [], // 修改文件
      deleted: [], // 删除文件
    };

    // 1. 扫描当前文件
    const currentFiles = this.scanDirectory(dirPath);

    // 2. 比对指纹
    for (const file of currentFiles) {
      const fingerprint = this.calculateFingerprint(file);
      const cached = this.fingerprints.get(file.path);

      if (!cached) {
        changes.added.push(file);
      } else if (cached.hash !== fingerprint.hash) {
        changes.modified.push(file);
      }
    }

    // 3. 检测删除的文件
    for (const [filePath] of this.fingerprints) {
      if (!currentFiles.find((f) => f.path === filePath)) {
        changes.deleted.push(filePath);
      }
    }

    return changes;
  }

  // 增量更新索引
  async updateIndex(dirPath) {
    const changes = this.detectChanges(dirPath);

    // 1. 处理新增文件
    for (const file of changes.added) {
      await this.indexFile(file);
    }

    // 2. 处理修改文件
    for (const file of changes.modified) {
      await this.reindexFile(file);
    }

    // 3. 处理删除文件
    for (const filePath of changes.deleted) {
      await this.removeFile(filePath);
    }

    // 4. 更新指纹
    this.updateFingerprints();

    return {
      added: changes.added.length,
      modified: changes.modified.length,
      deleted: changes.deleted.length,
    };
  }

  // 计算文件指纹
  calculateFingerprint(file) {
    const content = fs.readFileSync(file.path, "utf-8");
    const hash = crypto.createHash("md5").update(content).digest("hex");
    const stat = fs.statSync(file.path);

    return {
      hash,
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
    };
  }

  // 索引单个文件
  async indexFile(file) {
    const content = fs.readFileSync(file.path, "utf-8");
    const ast = this.parser.parseFile(file.path, content);

    if (ast.success) {
      const symbols = this.parser.extractSymbols(ast.ast, file.language);
      this.graph.addFileNode(file);

      for (const symbol of symbols) {
        this.graph.addNode(symbol.type, symbol.name, file.path, symbol);
      }
    }
  }

  // 重新索引文件
  async reindexFile(file) {
    // 1. 移除旧索引
    await this.removeFile(file.path);

    // 2. 重新索引
    await this.indexFile(file);
  }

  // 移除文件索引
  async removeFile(filePath) {
    // 1. 移除节点
    this.graph.removeNodesByFile(filePath);

    // 2. 移除边
    this.graph.removeEdgesByFile(filePath);

    // 3. 移除指纹
    this.fingerprints.delete(filePath);
  }

  // 保存指纹
  saveFingerprints(filePath) {
    const data = Object.fromEntries(this.fingerprints);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // 加载指纹
  loadFingerprints(filePath) {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      this.fingerprints = new Map(Object.entries(data));
    }
  }
}
```

---

## 与记忆系统集成

### 集成目标

代码分析功能需要与现有记忆系统深度集成，实现：

1. **代码记忆存储** - 将代码分析结果保存为记忆条目
2. **代码记忆搜索** - 在记忆系统中搜索代码相关信息
3. **代码记忆关联** - 建立代码记忆与普通记忆的关联

### 代码记忆类型

```javascript
// 代码记忆条目格式
{
  id: "code-{ulid}",
  date: "2026-03-28T00:00:00Z",
  type: "code",  // 新增类型
  tags: ["javascript", "function", "api"],
  project: "my-project",
  memory_id: "pending",
  source_id: "code-analysis",
  synced: false,
  meta: [
    {"symbol_type": "Function"},
    {"symbol_name": "myFunction"},
    {"file_path": "src/index.js"},
    {"start_line": 10},
    {"end_line": 20}
  ]
}

# ≡≡≡ Abstract ≡≡≡
```

Function myFunction in src/index.js (lines 10-20)

```

# ≡≡≡ Overview ≡≡≡
```

Function myFunction(param1: string, param2: number): boolean

- Exported: true
- Async: false
- Calls: validateInput, processData
- Called by: handleRequest, processBatch

```

# ≡≡≡ Contents ≡≡≡
```

完整函数代码和上下文信息...

```

---
```

### 集成方式

#### 1. 自动保存

当用户使用 `code_analyze` 工具分析代码时，自动将结果保存为记忆：

```javascript
// tools/code-analysis.js
export const code_analyze = tool({
  name: "code_analyze",
  description: "Analyze code structure",
  args: { path: string },
  execute: async (args) => {
    // 1. 分析代码
    const analysis = await analyzeCode(args.path);

    // 2. 保存为记忆
    if (config.codeAnalysis.autoSave) {
      await saveCodeMemory(analysis);
    }

    return analysis;
  },
});
```

#### 2. 手动保存

提供 `code_remember` 工具，让用户手动保存代码分析结果：

```javascript
export const code_remember = tool({
  name: "code_remember",
  description: "Save code analysis result to memory",
  args: {
    symbol: string,
    filePath: string,
    content: string,
    tags: string[]
  },
  execute: async (args) => {
    // 保存为代码记忆
    return await writeMemory({
      abstract: `${args.symbol} in ${args.filePath}`,
      overview: args.content.substring(0, 500),
      content: args.content,
      type: "code",
      tags: args.tags,
      meta: [
        {"symbol_name": args.symbol},
        {"file_path": args.filePath}
      ]
    });
  }
});
```

#### 3. 搜索集成

在 `memory_search` 中支持代码记忆搜索：

```javascript
// tools/search.js
export const memory_search = tool({
  name: "memory_search",
  description: "Search memories",
  args: {
    query: string,
    type: string, // 支持 "code" 类型过滤
  },
  execute: async (args) => {
    // 如果查询包含代码相关关键词，优先搜索代码记忆
    if (isCodeQuery(args.query)) {
      return await searchCodeMemory(args.query);
    }

    // 否则搜索普通记忆
    return await searchMemory(args.query);
  },
});
```

### 数据流向

```
代码分析 → 代码记忆 → 记忆系统 → 记忆搜索
    │          │          │          │
    └──────────┴──────────┴──────────┘
              统一存储和搜索
```

### 与现有记忆的区别

| 特性     | 普通记忆                   | 代码记忆                   |
| -------- | -------------------------- | -------------------------- |
| 类型     | general, daily, preference | code                       |
| 来源     | 用户对话                   | 代码分析                   |
| 内容     | 文本描述                   | 代码结构和上下文           |
| 元数据   | 可选                       | 必须（符号名、文件路径等） |
| 自动保存 | 用户触发                   | 分析时自动保存             |

---

## 与后端集成

### 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│  本地插件 (Node.js)                                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ AST 解析    │  │ 符号提取    │  │ 依赖解析    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         ▼                ▼                ▼                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              本地知识图谱 (JSON)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              本地搜索引擎 (BM25 + Trie)              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
         │ 同步
         ▼
┌─────────────────────────────────────────────────────────────┐
│  后端服务 (FastAPI)                                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 向量数据库  │  │ 图数据库    │  │ 记忆存储    │         │
│  │ (Meilisearch)│  │ （待定）    │  │ (文件系统)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### 同步策略

| 数据类型 | 本地存储    | 后端存储    | 同步方式 |
| -------- | ----------- | ----------- | -------- |
| 代码符号 | JSON 文件   | 图数据库    | 增量同步 |
| 依赖关系 | JSON 文件   | 图数据库    | 增量同步 |
| 社区信息 | JSON 文件   | 图数据库    | 全量同步 |
| 流程信息 | JSON 文件   | 图数据库    | 全量同步 |
| 搜索索引 | BM25 + Trie | Meilisearch | 增量同步 |

### 后端 API 扩展

```yaml
# 新增 API 端点
/api/v1/code/symbols:
  POST: # 上传代码符号
  GET: # 查询代码符号

/api/v1/code/relations:
  POST: # 上传依赖关系
  GET: # 查询依赖关系

/api/v1/code/communities:
  POST: # 上传社区信息
  GET: # 查询社区信息

/api/v1/code/processes:
  POST: # 上传流程信息
  GET: # 查询流程信息

/api/v1/code/search:
  POST: # 代码搜索（BM25 + 语义）

/api/v1/code/impact:
  POST: # 影响分析
```

### 数据流向

```
本地解析 → 本地存储 → 增量同步 → 后端存储 → 后端搜索
    │                                          │
    └──────────── 本地搜索 ◄───────────────────┘
```

---

## 技术栈选择

### 核心依赖

| 依赖                           | 版本    | 用途        | 必要性 |
| ------------------------------ | ------- | ----------- | ------ |
| tree-sitter                    | ^0.21.0 | AST 解析    | 必须   |
| tree-sitter-javascript         | ^0.21.0 | JS 解析     | 必须   |
| tree-sitter-typescript         | ^0.21.0 | TS 解析     | 必须   |
| tree-sitter-python             | ^0.21.0 | Python 解析 | 必须   |
| graphology                     | ^0.25.0 | 图数据结构  | 推荐   |
| graphology-communities-louvain | ^0.2.0  | 社区检测    | 推荐   |

### 可选依赖

| 依赖             | 版本    | 用途      | 必要性 |
| ---------------- | ------- | --------- | ------ |
| tree-sitter-go   | ^0.21.0 | Go 解析   | 可选   |
| tree-sitter-rust | ^0.21.0 | Rust 解析 | 可选   |
| tree-sitter-java | ^0.21.0 | Java 解析 | 可选   |
| tree-sitter-c    | ^0.21.0 | C 解析    | 可选   |
| tree-sitter-cpp  | ^0.21.0 | C++ 解析  | 可选   |
| transformers.js  | ^2.0.0  | 语义嵌入  | 可选   |

### 语言支持优先级

| 优先级 | 语言                  | 原因         |
| ------ | --------------------- | ------------ |
| P0     | JavaScript            | 项目主要语言 |
| P0     | TypeScript            | 项目主要语言 |
| P1     | Python                | 广泛使用     |
| P1     | Go                    | 广泛使用     |
| P2     | Rust                  | 广泛使用     |
| P2     | Java                  | 广泛使用     |
| P3     | C/C++                 | 系统编程     |
| P3     | Ruby/PHP/Swift/Kotlin | 其他语言     |

---

## 数据模型设计

### 节点类型

```javascript
// 文件节点
{
  id: "File:src/index.js",
  type: "File",
  name: "index.js",
  path: "src/index.js",
  language: "javascript",
  size: 1024,
  lastModified: "2026-03-28T00:00:00Z"
}

// 函数节点
{
  id: "Function:myFunction:src/index.js",
  type: "Function",
  name: "myFunction",
  filePath: "src/index.js",
  startLine: 10,
  endLine: 20,
  params: ["param1", "param2"],
  returnType: "string",
  isExported: true,
  isAsync: false
}

// 类节点
{
  id: "Class:MyClass:src/index.js",
  type: "Class",
  name: "MyClass",
  filePath: "src/index.js",
  startLine: 30,
  endLine: 50,
  extends: "ParentClass",
  implements: ["Interface1"]
}

// 社区节点
{
  id: "Community:Authentication",
  type: "Community",
  name: "Authentication",
  heuristicLabel: "Auth",
  cohesion: 0.85,
  symbolCount: 15
}

// 流程节点
{
  id: "Process:LoginFlow",
  type: "Process",
  name: "LoginFlow",
  processType: "cross_community",
  stepCount: 7,
  entryPointId: "Function:handleLogin:src/api/auth.js"
}
```

### 边类型

```javascript
// 调用关系
{
  from: "Function:handleLogin:src/api/auth.js",
  to: "Function:validateUser:src/services/user.js",
  type: "CALLS",
  confidence: 0.85,
  reason: "import-resolved"
}

// 导入关系
{
  from: "File:src/api/auth.js",
  to: "File:src/services/user.js",
  type: "IMPORTS",
  confidence: 1.0
}

// 继承关系
{
  from: "Class:AdminUser:src/models/admin.js",
  to: "Class:User:src/models/user.js",
  type: "EXTENDS",
  confidence: 1.0
}

// 成员关系
{
  from: "Function:validateUser:src/services/user.js",
  to: "Community:Authentication",
  type: "MEMBER_OF",
  confidence: 1.0
}

// 流程步骤
{
  from: "Function:validateUser:src/services/user.js",
  to: "Process:LoginFlow",
  type: "STEP_IN_PROCESS",
  step: 2
}
```

### 存储格式

```javascript
// 本地存储: ~/.opencode/memory/code/{project-id}/
{
  "graph.json": {
    "nodes": [...],
    "edges": [...],
    "metadata": {
      "version": "1.0.0",
      "createdAt": "2026-03-28T00:00:00Z",
      "updatedAt": "2026-03-28T00:00:00Z",
      "fileCount": 100,
      "symbolCount": 500,
      "edgeCount": 1000
    }
  },
  "index.json": {
    "symbols": {
      "myFunction": ["Function:myFunction:src/index.js"],
      "MyClass": ["Class:MyClass:src/index.js"]
    },
    "files": {
      "src/index.js": ["Function:myFunction", "Class:MyClass"]
    }
  },
  "fingerprints.json": {
    "src/index.js": {
      "hash": "abc123",
      "lastModified": "2026-03-28T00:00:00Z",
      "size": 1024
    }
  }
}
```

---

## API 接口设计

### MCP 工具

#### code_search

```javascript
{
  name: "code_search",
  description: "Search code symbols (functions, classes, interfaces)",
  args: {
    query: {
      type: "string",
      description: "Search query (symbol name or keyword)"
    },
    language: {
      type: "string",
      optional: true,
      description: "Filter by language (javascript, typescript, python, etc.)"
    },
    type: {
      type: "string",
      optional: true,
      description: "Filter by symbol type (function, class, interface, etc.)"
    },
    limit: {
      type: "number",
      optional: true,
      default: 10,
      description: "Maximum results"
    }
  },
  returns: {
    results: [{
      name: "string",
      type: "string",
      filePath: "string",
      startLine: "number",
      snippet: "string"
    }]
  }
}
```

#### code_context

```javascript
{
  name: "code_context",
  description: "Get 360-degree view of a code symbol",
  args: {
    name: {
      type: "string",
      description: "Symbol name"
    },
    filePath: {
      type: "string",
      optional: true,
      description: "File path (for disambiguation)"
    }
  },
  returns: {
    symbol: {
      name: "string",
      type: "string",
      filePath: "string",
      startLine: "number",
      endLine: "number"
    },
    callers: [{
      name: "string",
      filePath: "string",
      confidence: "number"
    }],
    callees: [{
      name: "string",
      filePath: "string",
      confidence: "number"
    }],
    imports: [{
      name: "string",
      filePath: "string"
    }],
    community: {
      name: "string",
      cohesion: "number"
    },
    processes: [{
      name: "string",
      step: "number"
    }]
  }
}
```

#### code_impact

```javascript
{
  name: "code_impact",
  description: "Analyze impact of changing a symbol",
  args: {
    symbol: {
      type: "string",
      description: "Symbol name"
    },
    direction: {
      type: "string",
      optional: true,
      default: "upstream",
      description: "Direction: upstream (who depends on me) or downstream (who I depend on)"
    },
    maxDepth: {
      type: "number",
      optional: true,
      default: 3,
      description: "Maximum depth"
    },
    minConfidence: {
      type: "number",
      optional: true,
      default: 0.5,
      description: "Minimum confidence"
    }
  },
  returns: {
    target: {
      name: "string",
      type: "string",
      filePath: "string"
    },
    impacts: [{
      depth: "number",
      symbol: {
        name: "string",
        type: "string",
        filePath: "string"
      },
      confidence: "number",
      reason: "string"
    }],
    summary: {
      totalAffected: "number",
      byDepth: {
        "1": "number",
        "2": "number",
        "3+": "number"
      }
    }
  }
}
```

#### code_analyze

```javascript
{
  name: "code_analyze",
  description: "Analyze code structure of a file or directory",
  args: {
    path: {
      type: "string",
      description: "File or directory path"
    },
    includeRelations: {
      type: "boolean",
      optional: true,
      default: false,
      description: "Include dependency relations"
    }
  },
  returns: {
    path: "string",
    files: [{
      path: "string",
      language: "string",
      symbols: [{
        name: "string",
        type: "string",
        startLine: "number",
        endLine: "number"
      }]
    }],
    relations: [{
      from: "string",
      to: "string",
      type: "string"
    }],
    summary: {
      fileCount: "number",
      symbolCount: "number",
      relationCount: "number"
    }
  }
}
```

---

## 实现计划

### 阶段 1: 基础 AST 解析（1-2 周）

**目标**: 实现基本的 AST 解析和符号提取

**任务**:

- [ ] 添加 tree-sitter 依赖
- [ ] 实现 `CodeParser` 类
- [ ] 实现 `FeatureExtractor` 类
- [ ] 支持 JavaScript/TypeScript
- [ ] 编写测试

**产出**:

- `lib/code-parser.js`
- `lib/feature-extractor.js`
- `parsers/javascript.js`
- `parsers/typescript.js`

### 阶段 2: 依赖解析（1 周）

**目标**: 实现导入、调用、继承解析

**任务**:

- [ ] 实现 `DependencyResolver` 类
- [ ] 解析 import 语句
- [ ] 解析函数调用
- [ ] 解析类继承
- [ ] 编写测试

**产出**:

- `lib/dependency-resolver.js`

### 阶段 3: 知识图谱（1 周）

**目标**: 实现本地知识图谱存储

**任务**:

- [ ] 实现 `CodeGraph` 类
- [ ] 设计节点和边的数据结构
- [ ] 实现 JSON 序列化/反序列化
- [ ] 实现基本查询接口
- [ ] 编写测试

**产出**:

- `lib/code-graph.js`

### 阶段 4: 社区检测（1 周）

**目标**: 实现 Leiden 算法社区检测

**任务**:

- [ ] 添加 graphology 依赖
- [ ] 实现 `CommunityDetector` 类
- [ ] 实现启发式标签生成
- [ ] 实现内聚度计算
- [ ] 编写测试

**产出**:

- `lib/community-detector.js`

### 阶段 5: 流程追踪（1 周）

**目标**: 实现执行流程追踪

**任务**:

- [ ] 实现 `ProcessTracer` 类
- [ ] 实现入口点检测
- [ ] 实现 BFS 追踪
- [ ] 实现去重逻辑
- [ ] 编写测试

**产出**:

- `lib/process-tracer.js`

### 阶段 6: 影响分析（1 周）

**目标**: 实现代码变更影响分析

**任务**:

- [ ] 实现 `ImpactAnalyzer` 类
- [ ] 实现上游分析
- [ ] 实现下游分析
- [ ] 实现置信度计算
- [ ] 编写测试

**产出**:

- `lib/impact-analyzer.js`

### 阶段 7: 搜索引擎（1 周）

**目标**: 实现三层代码搜索

**任务**:

- [ ] 实现 `CodeSearchEngine` 类
- [ ] 实现文件名搜索
- [ ] 实现符号搜索
- [ ] 实现 RRF 融合
- [ ] 编写测试

**产出**:

- `lib/code-search.js`

### 阶段 8: MCP 工具（1 周）

**目标**: 实现 MCP 工具接口

**任务**:

- [ ] 实现 `code_search` 工具
- [ ] 实现 `code_context` 工具
- [ ] 实现 `code_impact` 工具
- [ ] 实现 `code_analyze` 工具
- [ ] 编写测试

**产出**:

- `tools/code-analysis.js`

### 阶段 9: 后端集成（1-2 周）

**目标**: 实现与后端的同步

**任务**:

- [ ] 设计后端 API 接口
- [ ] 实现增量同步
- [ ] 实现全量同步
- [ ] 编写测试

**产出**:

- 后端 API 端点
- 同步逻辑

### 阶段 10: 多语言支持（持续）

**目标**: 扩展语言支持

**任务**:

- [ ] 添加 Python 支持
- [ ] 添加 Go 支持
- [ ] 添加 Rust 支持
- [ ] 添加 Java 支持
- [ ] 添加其他语言支持

**产出**:

- `parsers/python.js`
- `parsers/go.js`
- `parsers/rust.js`
- `parsers/java.js`

---

## 性能指标

### 索引性能

| 仓库规模 | 文件数 | 符号数 | 索引时间  | 峰值内存 |
| -------- | ------ | ------ | --------- | -------- |
| 小型     | < 100  | < 1K   | 5-10s     | ~200MB   |
| 中型     | 1K     | ~10K   | 30-60s    | ~500MB   |
| 大型     | 5K     | ~50K   | 3-5 min   | ~1GB     |
| 超大型   | 20K+   | 200K+  | 10-20 min | ~2GB     |

### 搜索性能

| 操作       | 目标响应时间 | 说明                  |
| ---------- | ------------ | --------------------- |
| 符号搜索   | < 100ms      | 本地 Trie + BM25      |
| 上下文查询 | < 200ms      | 图遍历 + 关系查询     |
| 影响分析   | < 500ms      | BFS 遍历 + 置信度计算 |
| 全文搜索   | < 100ms      | BM25 + RRF 融合       |

### 增量索引性能

| 变更规模    | 目标时间 | 说明                  |
| ----------- | -------- | --------------------- |
| 1-10 文件   | < 5s     | 单文件解析 + 索引更新 |
| 10-100 文件 | < 30s    | 批量解析 + 索引更新   |
| 100+ 文件   | < 2 min  | 全量重建可能更快      |

### 内存占用

| 组件     | 目标内存 | 说明               |
| -------- | -------- | ------------------ |
| AST 缓存 | < 100MB  | LRU 缓存，限制大小 |
| 符号表   | < 50MB   | 内存中的符号索引   |
| 图数据   | < 200MB  | 节点和边的存储     |
| 搜索索引 | < 50MB   | Trie + BM25 索引   |
| **总计** | < 500MB  | 正常操作时的峰值   |

---

## 错误处理

### 错误分类

| 错误类型 | 严重程度 | 处理策略                     |
| -------- | -------- | ---------------------------- |
| 解析错误 | 中       | 跳过文件，记录日志，继续处理 |
| 索引错误 | 中       | 回滚事务，重试或跳过         |
| 搜索错误 | 低       | 返回空结果，记录日志         |
| 同步错误 | 高       | 重试 3 次，失败后告警        |
| 内存溢出 | 高       | 分块处理，降低并发           |

### 解析错误处理

```javascript
// lib/code-parser.js
export class CodeParser {
  parseFile(filePath, content) {
    try {
      const ast = this.parser.parse(content);
      return { success: true, ast };
    } catch (error) {
      // 记录错误但不中断
      this.logger.warn(`Parse failed: ${filePath}`, error);
      return {
        success: false,
        error: error.message,
        filePath,
      };
    }
  }

  parseDirectory(dirPath) {
    const results = [];
    const errors = [];

    for (const file of files) {
      const result = this.parseFile(file);
      if (result.success) {
        results.push(result);
      } else {
        errors.push(result);
      }
    }

    return { results, errors };
  }
}
```

### 索引错误处理

```javascript
// lib/code-graph.js
export class CodeGraph {
  addNode(type, name, filePath, metadata) {
    try {
      const id = `${type}:${name}:${filePath}`;
      this.nodes.set(id, { type, name, filePath, ...metadata });
      return { success: true, id };
    } catch (error) {
      this.logger.error(`Add node failed: ${name}`, error);
      return { success: false, error: error.message };
    }
  }

  save(filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.toJSON()));
      return { success: true };
    } catch (error) {
      this.logger.error(`Save graph failed`, error);
      // 尝试备份
      this.backup(filePath);
      return { success: false, error: error.message };
    }
  }
}
```

### 搜索错误处理

```javascript
// lib/code-search.js
export class CodeSearchEngine {
  async search(query, options = {}) {
    try {
      const results = await this.doSearch(query, options);
      return { success: true, results };
    } catch (error) {
      this.logger.error(`Search failed: ${query}`, error);
      // 返回空结果而不是抛出错误
      return {
        success: false,
        results: [],
        error: error.message,
      };
    }
  }
}
```

### 同步错误处理

```javascript
// lib/wrapper-client.js
export class WrapperClient {
  async syncCodeAnalysis(data, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.post("/api/v1/code/symbols", data);
        return { success: true, result };
      } catch (error) {
        this.logger.warn(`Sync failed (attempt ${i + 1}/${retries})`, error);

        if (i === retries - 1) {
          // 最后一次重试失败
          this.alertSyncFailure(data, error);
          return { success: false, error: error.message };
        }

        // 等待后重试
        await this.delay(1000 * Math.pow(2, i));
      }
    }
  }
}
```

### 日志记录

```javascript
// lib/logger.js
export class CodeAnalysisLogger {
  constructor() {
    this.logFile = path.join(MEMORY_DIR, "code-analysis.log");
  }

  info(message, data = {}) {
    this.log("INFO", message, data);
  }

  warn(message, data = {}) {
    this.log("WARN", message, data);
  }

  error(message, data = {}) {
    this.log("ERROR", message, data);
  }

  log(level, message, data) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    fs.appendFileSync(this.logFile, JSON.stringify(entry) + "\n");
  }
}
```

### 错误恢复

| 场景             | 恢复策略                       |
| ---------------- | ------------------------------ |
| 部分文件解析失败 | 跳过失败文件，继续处理其他文件 |
| 索引文件损坏     | 从备份恢复，或重新索引         |
| 内存溢出         | 分块处理，降低并发数           |
| 同步失败         | 本地保存，下次同步时重试       |
| 搜索超时         | 返回部分结果，提示用户         |

---

## 风险与挑战

### 技术风险

| 风险                 | 影响 | 缓解措施                         |
| -------------------- | ---- | -------------------------------- |
| tree-sitter 安装复杂 | 高   | 提供预编译二进制，支持 WASM 回退 |
| 内存占用过高         | 中   | 分块处理，限制索引大小           |
| 解析速度慢           | 中   | Worker 线程并行，增量索引        |
| 语言支持不完整       | 低   | 渐进式支持，优先主流语言         |

### 集成风险

| 风险          | 影响 | 缓解措施             |
| ------------- | ---- | -------------------- |
| 后端 API 变更 | 高   | 版本化 API，向后兼容 |
| 数据同步冲突  | 中   | 基于时间戳的冲突解决 |
| 存储空间不足  | 低   | 压缩存储，清理旧数据 |

### 性能风险

| 风险           | 影响 | 缓解措施               |
| -------------- | ---- | ---------------------- |
| 大型仓库索引慢 | 高   | 增量索引，并行处理     |
| 搜索响应慢     | 中   | 索引优化，缓存热门查询 |
| 内存占用高     | 中   | 流式处理，分块加载     |

---

## 参考资料

### GitNexus

- GitHub: https://github.com/abhigyanpatwari/GitNexus
- 文档: https://mintlify.com/abhigyanpatwari/GitNexus/introduction
- 架构: https://www.mintlify.com/abhigyanpatwari/GitNexus/advanced/architecture
- 索引管道: https://mintlify.com/abhigyanpatwari/GitNexus/concepts/indexing-pipeline

### Tree-sitter

- 官网: https://tree-sitter.github.io/tree-sitter/
- JavaScript 绑定: https://github.com/tree-sitter/node-tree-sitter
- 语言支持: https://tree-sitter.github.io/tree-sitter/#parsers

### Graphology

- 官网: https://graphology.github.io/
- 社区检测: https://graphology.github.io/standard-library/communities-louvain

---

## 附录

### A. 术语表

| 术语       | 定义                                 |
| ---------- | ------------------------------------ |
| AST        | Abstract Syntax Tree，抽象语法树     |
| Symbol     | 代码符号（函数名、类名、变量名等）   |
| Feature    | 代码特征（函数、类、导入、导出等）   |
| Community  | 功能社区（相关符号的集群）           |
| Process    | 执行流程（从入口点到终端的调用链）   |
| Impact     | 影响范围（代码变更的影响）           |
| Confidence | 置信度（关系的可靠性）               |
| Cohesion   | 内聚度（社区的紧密程度）             |
| RRF        | Reciprocal Rank Fusion，排名融合算法 |

### B. 文件扩展名到语言映射

```javascript
const LANGUAGE_MAP = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
};
```

### C. 符号类型定义

```javascript
const SYMBOL_TYPES = {
  FUNCTION: "Function",
  CLASS: "Class",
  METHOD: "Method",
  INTERFACE: "Interface",
  ENUM: "Enum",
  STRUCT: "Struct",
  TRAIT: "Trait",
  VARIABLE: "Variable",
  CONSTANT: "Constant",
  TYPE: "Type",
  NAMESPACE: "Namespace",
  MODULE: "Module",
};
```

### D. 关系类型定义

```javascript
const RELATION_TYPES = {
  CALLS: "CALLS", // 函数调用
  IMPORTS: "IMPORTS", // 文件导入
  EXTENDS: "EXTENDS", // 类继承
  IMPLEMENTS: "IMPLEMENTS", // 接口实现
  DEFINES: "DEFINES", // 文件定义符号
  MEMBER_OF: "MEMBER_OF", // 符号属于社区
  STEP_IN_PROCESS: "STEP_IN_PROCESS", // 符号是流程步骤
};
```

---

**文档结束**
