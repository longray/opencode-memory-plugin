# OpenCode Memory Plugin 详细设计文档

**版本**: 2.3.0
**日期**: 2026-03-23
**状态**: 设计阶段
**适用**: OpenCode Memory CLI/Plugin 开发

---

## 目录

1. [架构概述](#1-架构概述)
2. [核心模块设计](#2-核心模块设计)
3. [数据存储设计](#3-数据存储设计)
4. [同步机制](#4-同步机制)
5. [工具接口](#5-工具接口)
6. [CLI 设计](#6-cli-设计)
7. [插件集成](#7-插件集成)
8. [与后端服务的交互](#8-与后端服务的交互)
9. [开发指南](#9-开发指南)
10. [测试策略](#10-测试策略)

---

## 1. 架构概述

### 1.1 设计目标

- **统一接口**: CLI 和 OpenCode 插件共享相同的核心逻辑
- **立即同步**: 代码/记忆变更立即上传到后端（非 5 分钟缓冲）
- **后端优先**: 搜索优先使用后端服务，离线时才降级到本地
- **本地缓冲**: 同步失败时本地队列重试，保证最终一致性
- **无 SQLite**: 纯文件系统存储，避免 bun 兼容性问题

### 1.2 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户层                                │
│  ┌─────────────┐  ┌─────────────┐                           │
│  │   CLI 用户   │  │ OpenCode 用户│                           │
│  └──────┬──────┘  └──────┬──────┘                           │
│         │                │                                  │
│         └────────────────┼────────────────┐                 │
│                          │                │                 │
│                          ▼                ▼                 │
├─────────────────────────────────────────────────────────────┤
│                      接口层 (统一)                           │
│              ┌─────────────────────────┐                   │
│              │      Tools 统一接口      │                   │
│              │  index/search/relate/... │                   │
│              └────────────┬────────────┘                   │
├───────────────────────────┼─────────────────────────────────┤
│                      实现层                                │
│         ┌─────────────────┼─────────────────┐              │
│         │                 │                 │              │
│         ▼                 ▼                 ▼              │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐        │
│  │   CLI    │      │  Daemon  │      │  Plugin  │        │
│  │  cli.js  │      │ daemon.js│      │ plugin.js│        │
│  └────┬─────┘      └────┬─────┘      └────┬─────┘        │
│       │                 │                 │               │
│       └─────────────────┼─────────────────┘               │
│                         │                                 │
├─────────────────────────┼─────────────────────────────────┤
│                      核心层 (共享)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │FileIndexer  │ │FeatureExtrac│ │ SyncManager │         │
│  │             │ │   tor       │ │ (Immediate) │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│  │OfflineSearch│ │BackendClient│ │ RetryQueue  │         │
│  │(3-layer)    │ │             │ │             │         │
│  └─────────────┘ └─────────────┘ └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                      存储层 (本地)                           │
│  ~/.opencode/memory/                                        │
│  ├── code/                    # 代码记忆                     │
│  │   ├── index/               # 文件索引 (JSON)              │
│  │   └── features/            # AST 特征 (JSON)              │
│  ├── timeline/                # 时间线记忆 (Markdown)        │
│  ├── active/                  # 活跃记忆                    │
│  └── queue/                   # 同步队列                    │
│       ├── pending.json        # 待同步任务                  │
│       └── retry.json          # 重试队列                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                      后端服务层                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │  SurrealDB  │ │ Meilisearch │ │  Embedding  │           │
│  │ (图+向量)   │ │ (全文搜索)  │ │  Service    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 技术栈

| 组件        | 技术          | 版本   | 说明           |
| ----------- | ------------- | ------ | -------------- |
| 运行时      | Node.js / Bun | 18+    | ES Modules     |
| CLI         | Commander     | 11.x   | 命令解析       |
| 文件监听    | chokidar      | 3.x    | 跨平台文件监控 |
| AST 解析    | tree-sitter   | 0.21.x | 13 种语言支持  |
| HTTP 客户端 | fetch (原生)  | -      | 后端通信       |
| WebSocket   | ws            | 8.x    | 实时同步       |

---

## 2. 核心模块设计

### 2.1 统一工具接口 (Tools)

**设计原则**: 所有功能通过统一接口暴露，CLI 和插件共享实现。

```javascript
// src/core/tools/index.js

/**
 * 统一工具接口
 *
 * 每个工具函数签名:
 * (input: Object, context: Context) => Promise<Output>
 *
 * Context 包含:
 * - backendClient: 后端客户端实例
 * - localIndex: 本地索引实例
 * - config: 配置信息
 * - syncManager: 同步管理器
 */

export const Tools = {
  /**
   * 索引文件或目录
   *
   * 流程:
   * 1. 本地提取特征 (AST)
   * 2. 保存到本地索引
   * 3. 立即同步到后端
   * 4. 失败则入队重试
   */
  async index({ filePath, options = {} }, context) {
    const { localIndex, syncManager } = context;

    // 1. 本地索引
    const result = await localIndex.indexPath(filePath, {
      recursive: options.recursive ?? true,
      extractFeatures: true,
    });

    // 2. 立即同步每个文件
    for (const file of result.files) {
      if (file.features) {
        await syncManager.uploadImmediate({
          type: "code",
          path: file.path,
          features: file.features,
        });
      }
    }

    return {
      success: true,
      filesProcessed: result.files.length,
      uploaded: result.files.filter((f) => f.features).length,
    };
  },

  /**
   * 搜索记忆
   *
   * 策略: 后端优先，离线降级
   * 1. 检查在线状态
   * 2. 在线: 后端搜索 (向量+图+混合)
   * 3. 离线: 本地三层搜索
   */
  async search({ query, options = {} }, context) {
    const { backendClient, offlineSearch, config } = context;

    // 1. 检查在线
    const isOnline = await checkConnectivity(config.backendUrl);

    if (isOnline && !options.forceLocal) {
      try {
        // 2. 后端搜索 (优先)
        const results = await backendClient.search({
          query,
          mode: options.mode || "hybrid",
          limit: options.limit || 10,
          tenantId: options.tenantId || "default",
        });

        if (results.length > 0) {
          return {
            results,
            source: "backend",
            offline: false,
          };
        }

        // 后端无结果，降级到本地补充
        console.log("[Search] Backend empty, fallback to local");
      } catch (error) {
        console.error("[Search] Backend failed:", error.message);
      }
    }

    // 3. 本地搜索 (离线或失败)
    const results = await offlineSearch.search(query, {
      limit: options.limit || 10,
    });

    return {
      results,
      source: "local",
      offline: !isOnline,
    };
  },

  /**
   * 写入记忆 (普通记忆/时间线)
   */
  async memory_write(
    { content, type = "general", tags = [], metadata = {} },
    context,
  ) {
    const { syncManager } = context;

    const memory = {
      type: "memory",
      content,
      memoryType: type,
      tags,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
      },
    };

    // 立即上传
    await syncManager.uploadImmediate(memory);

    return { success: true };
  },

  /**
   * 创建关系
   */
  async relate(
    { fromId, toId, relationshipType, weight = 0.5, description },
    context,
  ) {
    const { syncManager } = context;

    // 关系必须同步到后端
    await syncManager.uploadImmediate({
      type: "relation",
      fromId,
      toId,
      relationshipType,
      weight,
      description,
    });

    return { success: true };
  },

  /**
   * 图遍历
   */
  async graph({ memoryId, depth = 1 }, context) {
    const { backendClient } = context;

    // 图遍历必须后端
    const results = await backendClient.getRelatedMemories({
      memoryId,
      depth,
    });

    return results;
  },

  /**
   * 批量操作
   */
  async batch({ operations }, context) {
    const results = [];

    for (const op of operations) {
      const toolFn = Tools[op.tool];
      if (!toolFn) throw new Error(`Unknown tool: ${op.tool}`);

      const result = await toolFn(op.input, context);
      results.push({ tool: op.tool, result });
    }

    return { results };
  },
};
```

### 2.2 文件索引器 (FileIndexer)

**职责**: 本地文件遍历、特征提取、索引管理。

```javascript
// src/core/file-indexer.js

import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { FeatureExtractor } from "./feature-extractor.js";

const MEMORY_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".opencode",
  "memory",
);
const CODE_INDEX_DIR = path.join(MEMORY_DIR, "code", "index");
const CODE_FEATURES_DIR = path.join(MEMORY_DIR, "code", "features");

export class FileIndexer {
  constructor() {
    this.extractor = new FeatureExtractor();
    this._ensureDirs();
  }

  /**
   * 索引路径（文件或目录）
   */
  async indexPath(filePath, options = {}) {
    const stats = await fs.stat(filePath).catch(() => null);
    if (!stats) throw new Error(`Path not found: ${filePath}`);

    if (stats.isDirectory()) {
      return this._indexDirectory(filePath, options);
    }
    return this._indexFile(filePath, options);
  }

  /**
   * 索引目录（递归）
   */
  async _indexDirectory(dirPath, options) {
    const files = await this._collectFiles(dirPath);
    const results = [];

    for (const file of files) {
      try {
        const result = await this._indexFile(file, options);
        results.push(result);
      } catch (e) {
        console.error(`[Indexer] Failed: ${file}`, e.message);
      }
    }

    return {
      path: dirPath,
      files: results,
      indexed: results.filter((r) => r.indexed).length,
      unchanged: results.filter((r) => r.unchanged).length,
    };
  }

  /**
   * 索引单个文件
   *
   * 流程:
   * 1. 计算内容指纹 (MD5)
   * 2. 检查是否已索引且未变化
   * 3. 提取 AST 特征
   * 4. 保存索引和特征到本地
   */
  async _indexFile(filePath, options) {
    const content = await fs.readFile(filePath, "utf-8");
    const stats = await fs.stat(filePath);

    const fingerprint = createHash("md5").update(content).digest("hex");

    // 检查是否已索引
    const existing = await this._loadIndex(filePath);
    if (existing?.fingerprint === fingerprint) {
      return {
        path: filePath,
        fingerprint,
        indexed: false,
        unchanged: true,
      };
    }

    // 提取特征
    const features = await this.extractor.extractFeatures(filePath, content);

    // 保存到本地
    const indexEntry = {
      path: filePath,
      fingerprint,
      mtime: stats.mtimeMs,
      size: stats.size,
      language: features.language,
      indexedAt: Date.now(),
      hasFeatures: true,
    };

    await this._saveIndex(filePath, indexEntry);
    await this._saveFeatures(filePath, features);

    return {
      path: filePath,
      fingerprint,
      indexed: true,
      unchanged: false,
      features,
    };
  }

  /**
   * 收集文件（递归遍历）
   */
  async _collectFiles(
    dirPath,
    ignorePatterns = ["node_modules", ".git", "dist", "build"],
  ) {
    const files = [];

    async function traverse(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!ignorePatterns.includes(entry.name)) {
            await traverse(fullPath);
          }
        } else if (entry.isFile() && this._isCodeFile(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    await traverse(dirPath);
    return files;
  }

  _isCodeFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    const codeExts = [
      ".js",
      ".ts",
      ".jsx",
      ".tsx",
      ".py",
      ".java",
      ".go",
      ".rs",
      ".cpp",
      ".c",
      ".cs",
      ".php",
      ".rb",
      ".swift",
      ".sql",
      ".md",
    ];
    return codeExts.includes(ext);
  }

  // 存储辅助方法...
  async _loadIndex(filePath) {
    /* 从 code/index/ 加载 */
  }
  async _saveIndex(filePath, entry) {
    /* 保存到 code/index/ */
  }
  async _saveFeatures(filePath, features) {
    /* 保存到 code/features/ */
  }
  _getIndexPath(filePath) {
    /* 基于文件路径哈希 */
  }
  _getFeaturePath(filePath) {
    /* 基于文件路径哈希 */
  }
}
```

### 2.3 特征提取器 (FeatureExtractor)

**职责**: AST 解析，提取代码结构信息。

```javascript
// src/core/feature-extractor.js

import Parser from "tree-sitter";

// 语言解析器映射（延迟加载）
const LANGUAGE_PARSERS = {
  javascript: () => import("tree-sitter-javascript"),
  typescript: () => import("tree-sitter-typescript"),
  python: () => import("tree-sitter-python"),
  java: () => import("tree-sitter-java"),
  go: () => import("tree-sitter-go"),
  rust: () => import("tree-sitter-rust"),
  cpp: () => import("tree-sitter-cpp"),
  c: () => import("tree-sitter-c"),
  csharp: () => import("tree-sitter-c-sharp"),
  php: () => import("tree-sitter-php"),
  ruby: () => import("tree-sitter-ruby"),
  swift: () => import("tree-sitter-swift"),
};

export class FeatureExtractor {
  constructor() {
    this.parsers = new Map();
  }

  /**
   * 提取代码特征
   *
   * 返回结构:
   * {
   *   file_path: string,
   *   language: string,
   *   content_hash: string,
   *   ast: {
   *     functions: [{ name, params, line, async }],
   *     classes: [{ name, methods, line }],
   *     imports: [{ module, names }],
   *     exports: [{ name, type }],
   *   },
   *   search: {
   *     symbols: [{ name, type }],
   *     entry_points: [{ name, line, type }],
   *     keywords: string[],
   *   },
   *   metrics: {
   *     lines: number,
   *     code_lines: number,
   *     comment_lines: number,
   *     complexity: number,
   *   },
   * }
   */
  async extractFeatures(filePath, content) {
    const language = this._detectLanguage(filePath);
    const ast = await this._parseAST(content, language);

    return {
      file_path: filePath,
      language,
      content_hash: this._hash(content),
      ast: {
        functions: ast.functions,
        classes: ast.classes,
        imports: ast.imports,
        exports: ast.exports,
      },
      search: {
        symbols: this._extractSymbols(ast),
        entry_points: this._detectEntryPoints(ast, language),
        keywords: this._extractKeywords(ast, content),
      },
      metrics: {
        lines: content.split("\n").length,
        code_lines: this._countCodeLines(content),
        comment_lines: this._countCommentLines(content, language),
        function_count: ast.functions.length,
        class_count: ast.classes.length,
        complexity: this._calculateComplexity(ast),
      },
    };
  }

  /**
   * AST 解析
   */
  async _parseAST(content, language) {
    const parser = await this._getParser(language);
    if (!parser) {
      // 降级：正则提取
      return this._extractWithRegex(content, language);
    }

    const tree = parser.parse(content);
    const root = tree.rootNode;

    return {
      functions: this._extractFunctions(root, content),
      classes: this._extractClasses(root, content),
      imports: this._extractImports(root, content),
      exports: this._extractExports(root, content),
    };
  }

  /**
   * 提取函数定义
   */
  _extractFunctions(node, content) {
    const functions = [];
    const funcTypes = [
      "function_declaration",
      "function_definition",
      "method_definition",
      "arrow_function",
    ];

    const traverse = (n) => {
      if (funcTypes.includes(n.type)) {
        functions.push({
          name: this._getNodeText(n, content, "identifier"),
          params: this._extractParams(n, content),
          line: n.startPosition.row,
          async: this._isAsync(n, content),
        });
      }
      n.children.forEach(traverse);
    };

    traverse(node);
    return functions;
  }

  /**
   * 检测入口点
   */
  _detectEntryPoints(ast, language) {
    const patterns = {
      javascript: ["main", "app.listen", "server.listen", "export default"],
      python: ["main", "app.run", "if __name__"],
      go: ["main", "http.ListenAndServe"],
      java: ["public static void main", "SpringApplication.run"],
    };

    const langPatterns = patterns[language] || [];
    const entryPoints = [];

    for (const func of ast.functions) {
      for (const pattern of langPatterns) {
        if (func.name?.toLowerCase().includes(pattern.toLowerCase())) {
          entryPoints.push({
            name: func.name,
            line: func.line,
            type: "function",
          });
        }
      }
    }

    return entryPoints;
  }

  /**
   * 提取可搜索符号
   */
  _extractSymbols(ast) {
    const symbols = [];

    for (const func of ast.functions) {
      if (func.name) {
        symbols.push({ name: func.name, type: "function" });
        // 驼峰分割
        const parts = func.name.split(/(?=[A-Z])|_/);
        parts.forEach((p) =>
          symbols.push({ name: p.toLowerCase(), type: "keyword" }),
        );
      }
    }

    for (const cls of ast.classes) {
      if (cls.name) symbols.push({ name: cls.name, type: "class" });
    }

    for (const imp of ast.imports) {
      symbols.push({ name: imp.module, type: "import" });
    }

    return symbols;
  }

  // 辅助方法...
  async _getParser(language) {
    /* 缓存解析器 */
  }
  _detectLanguage(filePath) {
    /* 根据扩展名 */
  }
  _hash(content) {
    /* MD5 */
  }
  _extractWithRegex(content, language) {
    /* 降级 */
  }
  _extractClasses(node, content) {
    /* 提取类 */
  }
  _extractImports(node, content) {
    /* 提取导入 */
  }
  _extractExports(node, content) {
    /* 提取导出 */
  }
  _getNodeText(node, content, type) {
    /* 获取文本 */
  }
  _extractParams(node, content) {
    /* 提取参数 */
  }
  _isAsync(node, content) {
    /* 判断是否 async */
  }
  _extractKeywords(ast, content) {
    /* 提取关键词 */
  }
  _countCodeLines(content) {
    /* 代码行 */
  }
  _countCommentLines(content, language) {
    /* 注释行 */
  }
  _calculateComplexity(ast) {
    /* 圈复杂度 */
  }
}
```

---

## 3. 数据存储设计

### 3.1 目录结构

```
~/.opencode/memory/
├── code/                           # 代码记忆
│   ├── index/                      # 文件索引 (JSON)
│   │   └── 00/
│   │       └── 001a2b3c...json    # 基于文件路径 SHA256 命名
│   └── features/                   # AST 特征 (JSON)
│       └── 00/
│           └── 001a2b3c...json
├── timeline/                       # 时间线记忆 (Markdown)
│   └── 2026/
│       └── 03/
│           └── 23.md
├── active/                         # 活跃记忆 (JSON/Markdown)
└── queue/                          # 同步队列
    ├── pending.json                # 待同步任务
    └── retry.json                  # 重试队列
```

### 3.2 文件格式

**索引文件** (`code/index/xx/xxxx.json`):

```json
{
  "path": "/project/src/auth.js",
  "fingerprint": "md5-hash-of-content",
  "mtime": 1712345678000,
  "size": 15234,
  "language": "javascript",
  "indexedAt": 1712345678000,
  "hasFeatures": true,
  "symbols": {
    "functions": ["validateToken", "refreshToken"],
    "classes": ["AuthService"],
    "imports": ["jwt", "bcrypt"]
  }
}
```

**特征文件** (`code/features/xx/xxxx.json`):

```json
{
  "file_path": "/project/src/auth.js",
  "language": "javascript",
  "content_hash": "md5-hash",
  "ast": {
    "functions": [
      {
        "name": "validateToken",
        "params": ["token"],
        "line": 15,
        "async": false
      }
    ],
    "classes": [
      { "name": "AuthService", "methods": ["login", "logout"], "line": 60 }
    ],
    "imports": [{ "module": "jsonwebtoken", "names": ["sign", "verify"] }],
    "exports": [{ "name": "AuthService", "type": "class" }]
  },
  "search": {
    "symbols": [
      { "name": "validateToken", "type": "function" },
      { "name": "auth", "type": "keyword" }
    ],
    "entry_points": [
      { "name": "validateToken", "line": 15, "type": "function" }
    ],
    "keywords": ["auth", "token", "jwt", "security"]
  },
  "metrics": {
    "lines": 150,
    "code_lines": 120,
    "comment_lines": 30,
    "function_count": 8,
    "class_count": 1,
    "complexity": 12
  }
}
```

**队列文件** (`queue/pending.json`):

```json
{
  "version": "2.3.0",
  "lastUpdated": "2026-03-23T10:30:00Z",
  "queues": {
    "code": [
      {
        "id": "c-001",
        "type": "code",
        "path": "/project/src/auth.js",
        "features": {
          /* 特征数据 */
        },
        "status": "pending",
        "createdAt": "2026-03-23T10:30:00Z"
      }
    ],
    "memory": [
      {
        "id": "m-001",
        "type": "memory",
        "content": "今天决定用 SurrealDB",
        "memoryType": "decision",
        "status": "pending",
        "createdAt": "2026-03-23T10:35:00Z"
      }
    ],
    "relation": [
      {
        "id": "r-001",
        "type": "relation",
        "fromId": "memory:abc",
        "toId": "memory:def",
        "relationshipType": "related",
        "status": "pending"
      }
    ]
  }
}
```

---

## 4. 同步机制

### 4.1 立即同步策略

**核心原则**: 变更立即上传，失败入队重试。

```javascript
// src/core/sync-manager.js

export class ImmediateSyncManager {
  constructor(backendClient, config) {
    this.backend = backendClient;
    this.config = config;
    this.retryQueue = new RetryQueue();
    this.processing = false;
  }

  /**
   * 立即上传
   *
   * 流程:
   * 1. 立即尝试上传
   * 2. 成功: 完成
   * 3. 失败: 入队稍后重试
   */
  async uploadImmediate(item) {
    try {
      const result = await this._uploadToBackend(item);
      console.log(`[Sync] Uploaded: ${item.type}/${item.id || item.path}`);
      return result;
    } catch (error) {
      console.error(`[Sync] Failed, queued: ${error.message}`);
      await this._queueForRetry(item, error);
      throw error; // 向上抛出，调用者知道失败
    }
  }

  /**
   * 上传到后端
   */
  async _uploadToBackend(item) {
    switch (item.type) {
      case "code":
        return await this.backend.uploadCode({
          content: item.features.content || "",
          type: "code",
          language: item.features.language,
          filePath: item.path,
          tags: item.features.search.symbols.map((s) => s.name),
          metadata: {
            fingerprint: item.features.content_hash,
            metrics: item.features.metrics,
          },
        });

      case "memory":
        return await this.backend.uploadMemories([
          {
            content: item.content,
            type: item.memoryType,
            tags: item.tags,
            metadata: item.metadata,
          },
        ]);

      case "relation":
        return await this.backend.createRelation({
          fromId: item.fromId,
          toId: item.toId,
          relationshipType: item.relationshipType,
          weight: item.weight,
          description: item.description,
        });

      default:
        throw new Error(`Unknown type: ${item.type}`);
    }
  }

  /**
   * 入队重试
   */
  async _queueForRetry(item, error) {
    await this.retryQueue.add({
      ...item,
      error: error.message,
      retryCount: (item.retryCount || 0) + 1,
      nextRetryAt: Date.now() + this.config.retryDelay,
    });
  }

  /**
   * 启动重试处理器（后台）
   */
  startRetryProcessor() {
    setInterval(async () => {
      if (this.processing) return;
      this.processing = true;

      try {
        const pending = await this.retryQueue.getPending();

        for (const item of pending) {
          if (item.nextRetryAt <= Date.now() && item.retryCount < 3) {
            try {
              await this._uploadToBackend(item);
              await this.retryQueue.remove(item.id);
            } catch (e) {
              await this._queueForRetry(item, e);
            }
          }
        }
      } finally {
        this.processing = false;
      }
    }, 5000); // 每 5 秒检查一次
  }
}
```

### 4.2 重试队列

```javascript
// src/core/retry-queue.js

import fs from "fs/promises";
import path from "path";

const QUEUE_FILE = path.join(
  process.env.HOME,
  ".opencode",
  "memory",
  "queue",
  "retry.json",
);

export class RetryQueue {
  async add(item) {
    const queue = await this._load();
    queue.items.push(item);
    await this._save(queue);
  }

  async remove(id) {
    const queue = await this._load();
    queue.items = queue.items.filter((i) => i.id !== id);
    await this._save(queue);
  }

  async getPending() {
    const queue = await this._load();
    return queue.items.filter((i) => i.retryCount < 3);
  }

  async _load() {
    try {
      const content = await fs.readFile(QUEUE_FILE, "utf-8");
      return JSON.parse(content);
    } catch {
      return { items: [] };
    }
  }

  async _save(queue) {
    await fs.mkdir(path.dirname(QUEUE_FILE), { recursive: true });
    await fs.writeFile(QUEUE_FILE, JSON.stringify(queue, null, 2));
  }
}
```

---

## 5. 离线搜索（三层优先级）

**策略**: 后端优先，离线时三层本地搜索。

```javascript
// src/core/offline-search.js

export class OfflineSearch {
  /**
   * 三层优先级搜索
   *
   * 1. 文件名匹配（O(1)，最快）
   * 2. AST 符号匹配（O(n)，函数/类名）
   * 3. BM25 全文（O(n log n)，兜底）
   */
  async search(query, options = {}) {
    const limit = options.limit || 10;
    const results = [];
    const seen = new Set();

    // 第 1 层：文件名
    const fileMatches = await this._searchByFilename(query);
    for (const match of fileMatches) {
      if (!seen.has(match.path)) {
        results.push({ ...match, matchType: "filename", priority: 1 });
        seen.add(match.path);
        if (results.length >= limit) return results;
      }
    }

    // 第 2 层：AST 符号
    const symbolMatches = await this._searchBySymbols(query);
    for (const match of symbolMatches) {
      if (!seen.has(match.path)) {
        results.push({ ...match, matchType: "symbol", priority: 2 });
        seen.add(match.path);
        if (results.length >= limit) return results;
      }
    }

    // 第 3 层：BM25 全文
    const bm25Matches = await this._bm25Search(query);
    for (const match of bm25Matches) {
      if (!seen.has(match.path)) {
        results.push({ ...match, matchType: "content", priority: 3 });
        seen.add(match.path);
        if (results.length >= limit) return results;
      }
    }

    return results;
  }

  /**
   * 第 1 层：文件名匹配
   */
  async _searchByFilename(query) {
    const queryLower = query.toLowerCase();
    const matches = [];
    const indexFiles = await this._listIndexFiles();

    for (const file of indexFiles) {
      const content = await fs.readFile(file, "utf-8");
      const entry = JSON.parse(content);

      const filename = path.basename(entry.path).toLowerCase();
      if (filename.includes(queryLower)) {
        matches.push({
          path: entry.path,
          score: filename === queryLower ? 1.0 : 0.8,
          entry,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * 第 2 层：AST 符号匹配
   */
  async _searchBySymbols(query) {
    const queryLower = query.toLowerCase();
    const matches = [];
    const indexFiles = await this._listIndexFiles();

    for (const file of indexFiles) {
      const content = await fs.readFile(file, "utf-8");
      const entry = JSON.parse(content);

      if (!entry.hasFeatures) continue;

      // 从索引中的符号匹配（无需加载完整特征文件）
      for (const symbol of entry.symbols?.functions || []) {
        if (symbol.toLowerCase().includes(queryLower)) {
          matches.push({
            path: entry.path,
            score: 0.9,
            entry,
            matchDetail: `function: ${symbol}`,
          });
        }
      }
    }

    return matches;
  }

  /**
   * 第 3 层：BM25 全文搜索
   */
  async _bm25Search(query) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const matches = [];
    const indexFiles = await this._listIndexFiles();

    for (const file of indexFiles) {
      const indexContent = await fs.readFile(file, "utf-8");
      const entry = JSON.parse(indexContent);

      try {
        const fileContent = await fs.readFile(entry.path, "utf-8");
        const fileLower = fileContent.toLowerCase();

        let score = 0;
        for (const term of queryTerms) {
          const regex = new RegExp(term, "g");
          const matches = fileLower.match(regex);
          if (matches) score += matches.length;
        }

        if (score > 0) {
          matches.push({
            path: entry.path,
            score: Math.min(score / 10, 1.0),
            entry,
          });
        }
      } catch {
        // 文件不可读
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }
}
```

---

## 6. CLI 设计

### 6.1 命令结构

```bash
# 索引
opencode-memory index <path> [--recursive] [--no-sync]

# 搜索
opencode-memory search <query> [--mode=hybrid] [--limit=10] [--local]

# 写入记忆
opencode-memory write <content> [--type=general] [--tags=a,b,c]

# 创建关系
opencode-memory relate <from-id> <to-id> [--type=related] [--weight=0.5]

# 图遍历
opencode-memory graph <memory-id> [--depth=1]

# 批量操作
opencode-memory batch <file.json>

# 同步
opencode-memory sync [--force]

# 守护进程
opencode-memory daemon --start <path>
opencode-memory daemon --kill
opencode-memory daemon --status
```

### 6.2 实现示例

```javascript
// src/cli/cli.js
import { Command } from "commander";
import { Tools } from "../core/tools/index.js";
import { createContext } from "./context.js";

const program = new Command();

program.name("opencode-memory").version("2.3.0");

// index 命令
program
  .command("index <path>")
  .option("-r, --recursive", "递归索引", true)
  .option("--no-sync", "不同步到后端")
  .action(async (filePath, options) => {
    const context = await createContext();
    const result = await Tools.index(
      {
        filePath,
        options: {
          recursive: options.recursive,
          syncImmediately: options.sync,
        },
      },
      context,
    );
    console.log(`✓ Indexed ${result.filesProcessed} files`);
  });

// search 命令
program
  .command("search <query>")
  .option("-m, --mode <mode>", "模式", "hybrid")
  .option("-l, --limit <n>", "结果数量", "10")
  .option("--local", "强制本地搜索")
  .action(async (query, options) => {
    const context = await createContext();
    const result = await Tools.search(
      {
        query,
        options: {
          mode: options.mode,
          limit: parseInt(options.limit),
          forceLocal: options.local,
        },
      },
      context,
    );

    console.log(
      `\nFound ${result.results.length} results [${result.source}]:\n`,
    );
    result.results.forEach((r, i) => {
      console.log(`${i + 1}. [${r.matchType}] ${r.path}`);
    });
  });

program.parse();
```

---

## 7. 与后端服务的交互

### 7.1 API 客户端

```javascript
// src/core/backend-client.js

export class BackendClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async uploadCode(memory) {
    return this._post("/api/v1/memories", { memories: [memory] });
  }

  async uploadMemories(memories) {
    return this._post("/api/v1/memories", { memories });
  }

  async search(params) {
    return this._post("/api/v1/memories/search", params);
  }

  async createRelation(params) {
    return this._post("/api/v1/memories/relations", params);
  }

  async getRelatedMemories(params) {
    return this._post("/api/v1/memories/graph", params);
  }

  async _post(endpoint, body) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
}
```

### 7.2 数据格式契约

**上传代码记忆**:

```javascript
// POST /api/v1/memories
{
  "memories": [
    {
      "content": "代码内容",
      "type": "code",
      "language": "javascript",
      "filePath": "/project/src/auth.js",
      "tags": ["validateToken", "AuthService", "jwt"],
      "metadata": {
        "fingerprint": "md5-hash",
        "metrics": {
          "lines": 150,
          "complexity": 12
        }
      }
    }
  ],
  "tenantId": "default"
}
```

**搜索请求**:

```javascript
// POST /api/v1/memories/search
{
  "query": "用户认证",
  "mode": "hybrid",  // keyword/vector/hybrid
  "limit": 10,
  "tenantId": "default"
}
```

**创建关系**:

```javascript
// POST /api/v1/memories/relations
{
  "fromId": "memory:abc",
  "toId": "memory:def",
  "relationshipType": "related",
  "weight": 0.8,
  "description": "AuthService 使用 validateToken",
  "tenantId": "default"
}
```

---

## 8. 开发指南

### 8.1 开发环境

```bash
# 克隆项目
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin

# 安装依赖
npm install

# 或 bun
bun install

# 运行测试
npm test

# 本地运行 CLI
node src/cli/cli.js index .
```

### 8.2 添加新工具

1. 在 `src/core/tools/index.js` 添加工具函数
2. 在 `src/cli/cli.js` 添加 CLI 命令
3. 在 `src/plugin/plugin.js` 添加插件工具包装器
4. 更新测试

### 8.3 调试

```bash
# 开启调试日志
DEBUG=opencode-memory opencode-memory index .

# 查看队列状态
cat ~/.opencode/memory/queue/pending.json | jq
```

---

## 9. 测试策略

| 测试类型 | 工具       | 覆盖范围                |
| -------- | ---------- | ----------------------- |
| 单元测试 | Jest       | 核心模块、工具函数      |
| 集成测试 | Jest       | CLI 命令、后端 API 交互 |
| E2E 测试 | Playwright | 完整工作流              |

---

## 10. 版本历史

| 版本  | 日期       | 变更                                 |
| ----- | ---------- | ------------------------------------ |
| 2.3.0 | 2026-03-23 | 立即同步、后端优先搜索、统一工具接口 |
| 2.2.0 | ...        | 双模式同步、冲突解决                 |
| 2.1.0 | ...        | 基础功能                             |

---

**文档位置**: `opencode-memory-plugin/docs/DESIGN.md`
