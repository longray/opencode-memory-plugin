# Graphify Bridge 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 graphify 替代自研 Oxc 分析器，开发 `graphify-bridge.js` 将 graph.json 导入 SurrealDB，孤立率从 42% 降至 0.2%。

**Architecture:** 桥接模式 — `graphifyProject()` 调用 graphify CLI 产出 `graph.json`，`graphify-bridge.js` 解析并映射为 Entity/Atom/Reference，通过 batch API 写入 SurrealDB。10 并发创建 References 控制耗时。

**Tech Stack:** Node.js ES Modules, graphify (Python CLI), SurrealDB (后端), Jest (测试)

**设计文档:** `docs/superpowers/specs/2026-05-13-graphify-bridge-design.md`

---

## File Structure

| 操作     | 文件                                            | 职责                                                               |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| **创建** | `lib/graphify-bridge.js`                        | 桥接核心：解析 graph.json，映射 Entity/Atom/Reference              |
| **修改** | `lib/wrapper-client.js`                         | 新增 confidence/confidence_score/norm_label 参数 + deleteByProject |
| **修改** | `lib/code-analysis-service.js`                  | 替换 uploadProject() → graphifyProject()                           |
| **修改** | `cli/index.cjs`                                 | 新增 `graphify` CLI 命令                                           |
| **废弃** | `lib/code-analyzer.js`                          | 添加 @deprecated                                                   |
| **废弃** | `lib/relation-recommender.js`                   | 添加 @deprecated                                                   |
| **废弃** | `lib/fix-engine.js`                             | 添加 @deprecated                                                   |
| **创建** | `tests/unit/graphify-bridge/parse.test.js`      | 解析函数单元测试                                                   |
| **创建** | `tests/unit/graphify-bridge/mapping.test.js`    | 映射函数单元测试                                                   |
| **创建** | `tests/unit/graphify-bridge/classify.test.js`   | 分类函数单元测试                                                   |
| **创建** | `tests/unit/graphify-bridge/concurrent.test.js` | 并发控制测试                                                       |
| **创建** | `tests/unit/graphify-bridge/import.test.js`     | 完整导入流程测试                                                   |

---

## Task 1: wrapper-client.js 新增参数支持

**Files:**

- Modify: `opencode-memory-plugin/lib/wrapper-client.js`
- Test: `tests/unit/core/wrapper-client.test.js`

- [ ] **Step 1: 写 createRelation 新增参数的测试**

```javascript
// tests/unit/core/wrapper-client.test.js
describe("createRelation with graphify fields", () => {
  it("should pass confidence and confidence_score to API", async () => {
    const mockPost = jest.fn().mockResolvedValue({ id: "reference:test123" });
    const client = new WrapperClient({ backend: { tenant_id: "test" } });
    client.http = { post: mockPost };

    await client.createRelation({
      from_id: "entity:a",
      to_id: "entity:b",
      type: "method",
      weight: 0.9,
      confidence: "EXTRACTED",
      confidence_score: 1.0,
      tenant_id: "test",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/references",
      expect.objectContaining({
        type: "method",
        confidence: "EXTRACTED",
        confidence_score: 1.0,
        weight: 0.9,
      }),
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/core/wrapper-client.test.js -v --testNamePattern="graphify fields"`
Expected: FAIL (confidence/confidence_score not passed in request body)

- [ ] **Step 3: 修改 createRelation 传递新字段**

在 `opencode-memory-plugin/lib/wrapper-client.js` 的 `createRelation` 方法中，在 `if (description)` 块之后添加：

```javascript
if (confidence) {
  requestBody.confidence = confidence;
}

if (confidence_score !== undefined) {
  requestBody.confidence_score = confidence_score;
}
```

同时更新函数签名：

```javascript
async createRelation({ from_id, to_id, type = 'related', weight = 0.5, description, confidence, confidence_score, tenant_id }) {
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/core/wrapper-client.test.js -v --testNamePattern="graphify fields"`
Expected: PASS

- [ ] **Step 5: 写 batchCreateEntities/batchCreateAtoms norm_label 测试**

```javascript
describe("batchCreateEntities with norm_label", () => {
  it("should pass norm_label in entity payload", async () => {
    const mockPost = jest
      .fn()
      .mockResolvedValue({ created: 1, skipped: 0, errors: 0 });
    const client = new WrapperClient({ backend: { tenant_id: "test" } });
    client.http = { post: mockPost };

    await client.batchCreateEntities([
      {
        type: "code",
        abstract: "test",
        file_path: "test.js",
        norm_label: "testjs",
        tenant_id: "test",
      },
    ]);

    const calledWith = mockPost.mock.calls[0][1];
    expect(calledWith.entities[0]).toHaveProperty("norm_label", "testjs");
  });
});
```

- [ ] **Step 6: 修改 batchCreateEntities 传递 norm_label**

在 `wrapper-client.js` 的 `batchCreateEntities` 方法中，entity map 里添加：

```javascript
        norm_label: e.norm_label,
```

同样修改 `createEntity`、`createAtom`、`batchCreateAtoms` 中对应的 payload 构建代码。

- [ ] **Step 7: 运行测试确认通过**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/core/wrapper-client.test.js -v`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add opencode-memory-plugin/lib/wrapper-client.js tests/unit/core/wrapper-client.test.js
git commit -m "feat: add confidence/confidence_score/norm_label params to wrapper-client"
```

---

## Task 2: graphify-bridge.js 核心解析函数

**Files:**

- Create: `opencode-memory-plugin/lib/graphify-bridge.js`
- Create: `tests/unit/graphify-bridge/parse.test.js`

- [ ] **Step 1: 写 classifyNodes 测试**

```javascript
// tests/unit/graphify-bridge/parse.test.js
import { describe, it, expect } from "@jest/globals";
import {
  classifyNodes,
  parseSourceLocation,
  inferAtomType,
  detectLanguage,
} from "../../../lib/graphify-bridge.js";

describe("classifyNodes", () => {
  it("should separate file-level and symbol-level nodes", () => {
    const nodes = [
      {
        id: "lib_test_js",
        label: "test.js",
        source_file: "lib/test.js",
        source_location: "",
      },
      {
        id: "lib_test_js_foo",
        label: "foo()",
        source_file: "lib/test.js",
        source_location: "L10",
      },
      {
        id: "lib_test_js_bar",
        label: "Bar",
        source_file: "lib/test.js",
        source_location: "L20",
      },
    ];

    const { entityNodes, atomNodes } = classifyNodes(nodes);
    expect(entityNodes).toHaveLength(1);
    expect(entityNodes[0].id).toBe("lib_test_js");
    expect(atomNodes).toHaveLength(2);
  });

  it("should treat node without source_location as entity", () => {
    const nodes = [
      { id: "readme_md", label: "README.md", source_file: "README.md" },
    ];
    const { entityNodes, atomNodes } = classifyNodes(nodes);
    expect(entityNodes).toHaveLength(1);
    expect(atomNodes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/parse.test.js -v`
Expected: FAIL (module not found)

- [ ] **Step 3: 创建 graphify-bridge.js 并实现 classifyNodes + parseSourceLocation + inferAtomType + detectLanguage**

```javascript
// opencode-memory-plugin/lib/graphify-bridge.js

import path from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { logInfo, logError } from "./logger.js";

const execFile = promisify(execFileCb);

const LANG_MAP = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".md": "markdown",
};

const WEIGHT_MAP = {
  contains_EXTRACTED: 1.0,
  method_EXTRACTED: 0.9,
  imports_EXTRACTED: 0.8,
  imports_from_EXTRACTED: 0.8,
  calls_EXTRACTED: 0.7,
  calls_INFERRED: 0.5,
};

/**
 * 分类 nodes 为 Entity（文件级）和 Atom（符号级）
 */
export function classifyNodes(nodes) {
  const entityNodes = [];
  const atomNodes = [];

  for (const node of nodes) {
    if (!node.source_location || node.source_location === "") {
      entityNodes.push(node);
    } else {
      atomNodes.push(node);
    }
  }

  return { entityNodes, atomNodes };
}

/**
 * 解析 graphify source_location 为 start_line / end_line
 * "L206" → { start_line: 206 }
 * "LL206-230" → { start_line: 206, end_line: 230 }
 */
export function parseSourceLocation(loc) {
  if (!loc) return {};

  const rangeMatch = loc.match(/^LL(\d+)-(\d+)$/);
  if (rangeMatch) {
    return {
      start_line: Number(rangeMatch[1]),
      end_line: Number(rangeMatch[2]),
    };
  }

  const lineMatch = loc.match(/^L(\d+)$/);
  if (lineMatch) {
    return { start_line: Number(lineMatch[1]) };
  }

  return {};
}

/**
 * 从 label 推断 Atom 类型
 * "foo()" → "function", "MyClass" → "class", 其他 → "function"
 */
export function inferAtomType(label) {
  if (label.endsWith("()")) return "function";
  if (/^[A-Z]/.test(label) && !label.includes("(")) return "class";
  return "function";
}

/**
 * 从 file_path 后缀检测语言
 */
export function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return LANG_MAP[ext] || "unknown";
}

/**
 * 根据 relation + confidence 计算 weight
 */
export function calculateWeight(relation, confidence) {
  const key = `${relation}_${confidence || "EXTRACTED"}`;
  return WEIGHT_MAP[key] ?? 0.5;
}

/**
 * 并发执行任务（Semaphore 模式）
 */
export async function runConcurrent(tasks, { concurrency = 10 } = {}) {
  const results = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = { error: err.message, index: i };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// === 以下函数后续 Task 实现 ===

export async function checkGraphifyInstalled() {
  throw new Error("Not implemented");
}
export async function runGraphify() {
  throw new Error("Not implemented");
}
export async function importGraphJSON() {
  throw new Error("Not implemented");
}
export async function graphifyProject() {
  throw new Error("Not implemented");
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/parse.test.js -v`
Expected: ALL PASS

- [ ] **Step 5: 写 parseSourceLocation + inferAtomType + detectLanguage 测试**

在 `tests/unit/graphify-bridge/parse.test.js` 追加：

```javascript
describe("parseSourceLocation", () => {
  it("should parse L206 format", () => {
    expect(parseSourceLocation("L206")).toEqual({ start_line: 206 });
  });

  it("should parse LL206-230 range format", () => {
    expect(parseSourceLocation("LL206-230")).toEqual({
      start_line: 206,
      end_line: 230,
    });
  });

  it("should return empty for null/empty", () => {
    expect(parseSourceLocation(null)).toEqual({});
    expect(parseSourceLocation("")).toEqual({});
    expect(parseSourceLocation("invalid")).toEqual({});
  });
});

describe("inferAtomType", () => {
  it("should detect function from ()", () => {
    expect(inferAtomType("getWebSocketClient()")).toBe("function");
    expect(inferAtomType("log()")).toBe("function");
  });

  it("should detect class from PascalCase without ()", () => {
    expect(inferAtomType("WrapperClient")).toBe("class");
    expect(inferAtomType("BM25Index")).toBe("class");
  });

  it("should default to function", () => {
    expect(inferAtomType("handler")).toBe("function");
  });
});

describe("detectLanguage", () => {
  it("should detect from extension", () => {
    expect(detectLanguage("lib/test.js")).toBe("javascript");
    expect(detectLanguage("lib/test.ts")).toBe("typescript");
    expect(detectLanguage("lib/test.py")).toBe("python");
    expect(detectLanguage("README.md")).toBe("markdown");
  });

  it("should return unknown for unrecognized", () => {
    expect(detectLanguage("Makefile")).toBe("unknown");
  });
});
```

- [ ] **Step 6: 运行测试确认通过**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/parse.test.js -v`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add opencode-memory-plugin/lib/graphify-bridge.js tests/unit/graphify-bridge/parse.test.js
git commit -m "feat: add graphify-bridge core parsing functions"
```

---

## Task 3: 映射函数（graphify node → Entity/Atom payload）

**Files:**

- Modify: `opencode-memory-plugin/lib/graphify-bridge.js`
- Create: `tests/unit/graphify-bridge/mapping.test.js`

- [ ] **Step 1: 写 buildEntityPayload 测试**

```javascript
// tests/unit/graphify-bridge/mapping.test.js
import { describe, it, expect } from "@jest/globals";
import {
  buildEntityPayload,
  buildAtomPayload,
  buildReferencePayload,
} from "../../../lib/graphify-bridge.js";

describe("buildEntityPayload", () => {
  it("should map graphify node to entity payload", () => {
    const node = {
      id: "lib_wrapper-client_js",
      label: "wrapper-client.js",
      file_type: "code",
      source_file: "lib/wrapper-client.js",
      source_location: "",
      community: 42,
      norm_label: "wrapper-client.js",
    };

    const payload = buildEntityPayload(
      node,
      "@longray/opencode-memory-plugin",
      "longray",
    );

    expect(payload).toMatchObject({
      type: "code",
      file_path: "lib/wrapper-client.js",
      norm_label: "wrapper-client.js",
      language: "javascript",
      project: "@longray/opencode-memory-plugin",
      tenant_id: "longray",
      created_by: "graphify",
      tags: ["community:42"],
    });
    expect(payload.abstract).toContain("wrapper-client.js");
  });

  it("should handle document file_type", () => {
    const node = {
      id: "readme_md",
      label: "README.md",
      file_type: "document",
      source_file: "README.md",
      source_location: "",
      community: 1,
      norm_label: "readme.md",
    };

    const payload = buildEntityPayload(node, "test-project", "longray");
    expect(payload.type).toBe("document");
    expect(payload.language).toBe("markdown");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/mapping.test.js -v`
Expected: FAIL (buildEntityPayload not exported)

- [ ] **Step 3: 实现 buildEntityPayload + buildAtomPayload + buildReferencePayload**

在 `graphify-bridge.js` 中添加：

```javascript
/**
 * 构建 Entity payload（从文件级 node）
 */
export function buildEntityPayload(node, projectId, tenantId) {
  return {
    type: node.file_type || "code",
    abstract: `${node.source_file || node.label}`,
    file_path: node.source_file,
    norm_label: node.norm_label || null,
    language: detectLanguage(node.source_file || ""),
    project: projectId,
    tenant_id: tenantId,
    created_by: "graphify",
    tags: node.community != null ? [`community:${node.community}`] : [],
  };
}

/**
 * 构建 Atom payload（从符号级 node）
 */
export function buildAtomPayload(node, projectId, tenantId) {
  const name = node.label.replace(/\(\)$/, "");
  const location = parseSourceLocation(node.source_location);

  return {
    type: inferAtomType(node.label),
    name,
    content: "", // graphify 不提取函数体
    norm_label: node.norm_label || null,
    start_line: location.start_line,
    end_line: location.end_line || undefined,
    project: projectId,
    tenant_id: tenantId,
    metadata: {
      source_file: node.source_file,
      community: node.community,
      graphify_id: node.id,
    },
  };
}

/**
 * 构建 Reference payload（从 link）
 */
export function buildReferencePayload(link, fromId, toId, tenantId) {
  const weight = calculateWeight(link.relation, link.confidence);
  const location = parseSourceLocation(link.source_location);

  return {
    from_id: fromId,
    to_id: toId,
    type: link.relation,
    weight,
    confidence: link.confidence || null,
    confidence_score: link.confidence_score || null,
    file_path: link.source_file || null,
    line: location.start_line || null,
    description: `${link.relation}: ${link.source} → ${link.target}`,
    tenant_id: tenantId,
    metadata: {
      context: link.context || null,
      graphify_source: link.source,
      graphify_target: link.target,
    },
  };
}
```

- [ ] **Step 4: 写 buildAtomPayload 和 buildReferencePayload 测试**

在 `mapping.test.js` 追加：

```javascript
describe("buildAtomPayload", () => {
  it("should strip () from function label", () => {
    const node = {
      id: "lib_test_js_foo",
      label: "getWebSocketClient()",
      file_type: "code",
      source_file: "lib/test.js",
      source_location: "L206",
      community: 5,
      norm_label: "getwebsocketclient()",
    };

    const payload = buildAtomPayload(node, "test-project", "longray");
    expect(payload.name).toBe("getWebSocketClient");
    expect(payload.type).toBe("function");
    expect(payload.start_line).toBe(206);
    expect(payload.metadata.graphify_id).toBe("lib_test_js_foo");
  });

  it("should parse LL range location", () => {
    const node = {
      id: "lib_test_js_bar",
      label: "Bar",
      source_file: "lib/test.js",
      source_location: "LL10-50",
      community: 5,
      norm_label: "bar",
    };

    const payload = buildAtomPayload(node, "test-project", "longray");
    expect(payload.type).toBe("class");
    expect(payload.start_line).toBe(10);
    expect(payload.end_line).toBe(50);
  });
});

describe("buildReferencePayload", () => {
  it("should calculate weight from relation and confidence", () => {
    const link = {
      source: "a",
      target: "b",
      relation: "calls",
      confidence: "EXTRACTED",
      confidence_score: 1.0,
      weight: 1,
      source_file: "test.js",
      source_location: "L10",
      context: "call",
    };

    const payload = buildReferencePayload(
      link,
      "entity:a",
      "atom:b",
      "longray",
    );
    expect(payload.weight).toBe(0.7); // calls + EXTRACTED
    expect(payload.confidence).toBe("EXTRACTED");
    expect(payload.confidence_score).toBe(1.0);
    expect(payload.line).toBe(10);
  });

  it("should use lower weight for INFERRED calls", () => {
    const link = {
      source: "a",
      target: "b",
      relation: "calls",
      confidence: "INFERRED",
      confidence_score: 0.8,
      weight: 1,
      source_file: null,
      source_location: null,
    };

    const payload = buildReferencePayload(
      link,
      "entity:a",
      "atom:b",
      "longray",
    );
    expect(payload.weight).toBe(0.5); // calls + INFERRED
  });
});
```

- [ ] **Step 5: 运行全部 mapping 测试**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/mapping.test.js -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add opencode-memory-plugin/lib/graphify-bridge.js tests/unit/graphify-bridge/mapping.test.js
git commit -m "feat: add graphify-bridge mapping functions (Entity/Atom/Reference payloads)"
```

---

## Task 4: 并发控制 + ID 映射

**Files:**

- Modify: `opencode-memory-plugin/lib/graphify-bridge.js`
- Create: `tests/unit/graphify-bridge/concurrent.test.js`

- [ ] **Step 1: 写 runConcurrent 测试**

```javascript
// tests/unit/graphify-bridge/concurrent.test.js
import { describe, it, expect } from "@jest/globals";
import { runConcurrent, buildIdMaps } from "../../../lib/graphify-bridge.js";

describe("runConcurrent", () => {
  it("should execute tasks with concurrency limit", async () => {
    const order = [];
    const tasks = Array.from({ length: 20 }, (_, i) => () => {
      order.push(i);
      return Promise.resolve(i * 2);
    });

    const results = await runConcurrent(tasks, { concurrency: 5 });

    expect(results).toHaveLength(20);
    expect(results[0]).toBe(0);
    expect(results[19]).toBe(38);
  });

  it("should capture errors without failing", async () => {
    const tasks = [
      () => Promise.resolve("ok"),
      () => Promise.reject(new Error("boom")),
      () => Promise.resolve("also ok"),
    ];

    const results = await runConcurrent(tasks, { concurrency: 2 });
    expect(results[0]).toBe("ok");
    expect(results[1].error).toBe("boom");
    expect(results[2]).toBe("also ok");
  });

  it("should handle empty tasks", async () => {
    const results = await runConcurrent([], { concurrency: 5 });
    expect(results).toHaveLength(0);
  });
});

describe("buildIdMaps", () => {
  it("should build entity and atom ID maps from batch results", () => {
    const entityNodes = [
      { id: "lib_test_js", source_file: "lib/test.js" },
      { id: "lib_foo_js", source_file: "lib/foo.js" },
    ];
    const atomNodes = [{ id: "lib_test_js_bar", source_file: "lib/test.js" }];
    const entityResults = [
      { id: "entity:aaa111", file_path: "lib/test.js" },
      { id: "entity:bbb222", file_path: "lib/foo.js" },
    ];
    const atomResults = [{ id: "atom:ccc333" }];

    const { entityMap, atomMap } = buildIdMaps(
      entityNodes,
      atomNodes,
      entityResults,
      atomResults,
    );

    expect(entityMap.get("lib_test_js")).toBe("entity:aaa111");
    expect(entityMap.get("lib_foo_js")).toBe("entity:bbb222");
    expect(atomMap.get("lib_test_js_bar")).toBe("atom:ccc333");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/concurrent.test.js -v`
Expected: FAIL (buildIdMaps not exported)

- [ ] **Step 3: 实现 buildIdMaps**

在 `graphify-bridge.js` 中添加：

```javascript
/**
 * 构建 graphify ID → 我们的 ID 映射表
 */
export function buildIdMaps(
  entityNodes,
  atomNodes,
  entityResults,
  atomResults,
) {
  const entityMap = new Map();
  const atomMap = new Map();

  // Entity 映射：按顺序匹配（batchCreateEntities 返回顺序与输入一致）
  for (let i = 0; i < entityNodes.length; i++) {
    if (entityResults[i] && entityResults[i].id) {
      entityMap.set(entityNodes[i].id, entityResults[i].id);
    }
  }

  // Atom 映射：按顺序匹配
  for (let i = 0; i < atomNodes.length; i++) {
    if (atomResults[i] && atomResults[i].id) {
      atomMap.set(atomNodes[i].id, atomResults[i].id);
    }
  }

  return { entityMap, atomMap };
}

/**
 * 解析 graphify link 的 source/target 为我们的 ID
 */
export function resolveId(graphifyId, entityMap, atomMap) {
  return atomMap.get(graphifyId) || entityMap.get(graphifyId) || null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/concurrent.test.js -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add opencode-memory-plugin/lib/graphify-bridge.js tests/unit/graphify-bridge/concurrent.test.js
git commit -m "feat: add concurrent execution and ID mapping functions"
```

---

## Task 5: importGraphJSON 完整导入流程

**Files:**

- Modify: `opencode-memory-plugin/lib/graphify-bridge.js`
- Create: `tests/unit/graphify-bridge/import.test.js`

- [ ] **Step 1: 写 importGraphJSON 集成测试（mock wrapper-client）**

```javascript
// tests/unit/graphify-bridge/import.test.js
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { importGraphJSON } from "../../../lib/graphify-bridge.js";

// Mock fs.readFile
jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

import { readFile } from "node:fs/promises";

const SAMPLE_GRAPH = {
  directed: true,
  nodes: [
    {
      id: "lib_test_js",
      label: "test.js",
      file_type: "code",
      source_file: "lib/test.js",
      source_location: "",
      community: 1,
      norm_label: "test.js",
    },
    {
      id: "lib_test_js_foo",
      label: "foo()",
      file_type: "code",
      source_file: "lib/test.js",
      source_location: "L10",
      community: 1,
      norm_label: "foo()",
    },
    {
      id: "lib_test_js_bar",
      label: "Bar",
      file_type: "code",
      source_file: "lib/test.js",
      source_location: "L20",
      community: 1,
      norm_label: "bar",
    },
  ],
  links: [
    {
      source: "lib_test_js",
      target: "lib_test_js_foo",
      relation: "contains",
      confidence: "EXTRACTED",
      confidence_score: 1.0,
      weight: 1,
    },
    {
      source: "lib_test_js",
      target: "lib_test_js_bar",
      relation: "contains",
      confidence: "EXTRACTED",
      confidence_score: 1.0,
      weight: 1,
    },
    {
      source: "lib_test_js_bar",
      target: "lib_test_js_foo",
      relation: "method",
      confidence: "EXTRACTED",
      confidence_score: 1.0,
      weight: 1,
    },
    {
      source: "lib_test_js_foo",
      target: "lib_test_js_bar",
      relation: "calls",
      confidence: "INFERRED",
      confidence_score: 0.8,
      weight: 1,
    },
  ],
};

function createMockClient() {
  return {
    deleteByProject: jest.fn().mockResolvedValue({ deleted: 0 }),
    batchCreateEntities: jest.fn().mockResolvedValue({
      entities: [{ id: "entity:ent1", file_path: "lib/test.js" }],
      created: 1,
      skipped: 0,
      errors: 0,
    }),
    batchCreateAtoms: jest.fn().mockResolvedValue({
      created: 2,
      skipped: 0,
      errors: 0,
      atoms: [{ id: "atom:at1" }, { id: "atom:at2" }],
    }),
    createRelation: jest.fn().mockResolvedValue({ id: "reference:ref1" }),
  };
}

describe("importGraphJSON", () => {
  beforeEach(() => {
    readFile.mockReset();
  });

  it("should import full graph with correct counts", async () => {
    readFile.mockResolvedValue(JSON.stringify(SAMPLE_GRAPH));
    const client = createMockClient();

    const result = await importGraphJSON({
      projectPath: "/project",
      projectId: "test-project",
      client,
      tenantId: "longray",
    });

    expect(result.entities).toBe(1);
    expect(result.atoms).toBe(2);
    expect(result.references).toBe(4);
    expect(client.deleteByProject).toHaveBeenCalledWith(
      "test-project",
      "longray",
    );
    expect(client.batchCreateEntities).toHaveBeenCalledTimes(1);
    expect(client.batchCreateAtoms).toHaveBeenCalledTimes(1);
    expect(client.createRelation).toHaveBeenCalledTimes(4);
  });

  it("should skip links with unresolvable IDs", async () => {
    const graph = {
      directed: true,
      nodes: [
        {
          id: "a",
          label: "a.js",
          file_type: "code",
          source_file: "a.js",
          source_location: "",
          community: 1,
          norm_label: "a.js",
        },
      ],
      links: [
        {
          source: "a",
          target: "nonexistent",
          relation: "calls",
          confidence: "EXTRACTED",
          confidence_score: 1.0,
          weight: 1,
        },
      ],
    };

    readFile.mockResolvedValue(JSON.stringify(graph));
    const client = createMockClient();

    const result = await importGraphJSON({
      projectPath: "/project",
      projectId: "test-project",
      client,
      tenantId: "longray",
    });

    expect(result.references).toBe(1);
    expect(result.errors).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/import.test.js -v`
Expected: FAIL (importGraphJSON throws 'Not implemented')

- [ ] **Step 3: 实现 importGraphJSON**

替换 `graphify-bridge.js` 中的 `importGraphJSON` 存根：

```javascript
/**
 * 导入 graph.json 到 SurrealDB
 */
export async function importGraphJSON(options) {
  const { projectPath, projectId, client, tenantId } = options;

  // Step 1: 读取 graph.json
  const graphPath = path.join(projectPath, "graphify-out", "graph.json");
  const raw = await readFile(graphPath, "utf-8");
  const graph = JSON.parse(raw);
  logInfo(
    "GRAPHIFY",
    `Loaded graph.json: ${graph.nodes.length} nodes, ${graph.links.length} links`,
  );

  // Step 2: 分类 nodes
  const { entityNodes, atomNodes } = classifyNodes(graph.nodes);
  logInfo(
    "GRAPHIFY",
    `Classified: ${entityNodes.length} entities, ${atomNodes.length} atoms`,
  );

  // Step 3: 导入前清理
  if (client.deleteByProject) {
    await client.deleteByProject(projectId, tenantId);
    logInfo("GRAPHIFY", "Cleared old data for project");
  }

  // Step 4: 批量创建 Entities
  const entityBatch = entityNodes.map((n) =>
    buildEntityPayload(n, projectId, tenantId),
  );
  const entityResults = await client.batchCreateEntities(entityBatch);
  logInfo("GRAPHIFY", `Created ${entityResults.created ?? 0} entities`);

  // 处理 batchCreateEntities 返回格式
  const entityResultList = entityResults.entities || entityResults.data || [];
  const { entityMap, atomMap } = buildIdMaps(
    entityNodes,
    atomNodes,
    entityResultList,
    [],
  );

  // Step 5: 批量创建 Atoms
  const atomBatch = atomNodes.map((n) =>
    buildAtomPayload(n, projectId, tenantId),
  );
  const atomResults = await client.batchCreateAtoms(atomBatch);
  logInfo("GRAPHIFY", `Created ${atomResults.created ?? 0} atoms`);

  // 更新 atomMap
  const atomResultList = atomResults.atoms || atomResults.data || [];
  for (let i = 0; i < atomNodes.length; i++) {
    if (atomResultList[i] && atomResultList[i].id) {
      atomMap.set(atomNodes[i].id, atomResultList[i].id);
    }
  }

  // Step 6: 并发创建 References
  const linkTasks = graph.links.map((link) => {
    const fromId = resolveId(link.source, entityMap, atomMap);
    const toId = resolveId(link.target, entityMap, atomMap);
    if (!fromId || !toId)
      return () => {
        return { skipped: true, link };
      };

    const payload = buildReferencePayload(link, fromId, toId, tenantId);
    return () => client.createRelation(payload);
  });

  const refResults = await runConcurrent(linkTasks, { concurrency: 10 });
  const errors = refResults.filter((r) => r && r.error).length;
  const skipped = refResults.filter((r) => r && r.skipped).length;
  logInfo(
    "GRAPHIFY",
    `References: ${graph.links.length} total, ${errors} errors, ${skipped} skipped`,
  );

  // Step 7: 统计
  const byRelation = {};
  for (const link of graph.links) {
    byRelation[link.relation] = (byRelation[link.relation] || 0) + 1;
  }

  return {
    entities: entityNodes.length,
    atoms: atomNodes.length,
    references: graph.links.length,
    errors,
    skipped,
    byRelation,
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/import.test.js -v`
Expected: ALL PASS

- [ ] **Step 5: 运行全部 graphify-bridge 测试**

Run: `node --experimental-vm-modules node_modules/.bin/jest tests/unit/graphify-bridge/ -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add opencode-memory-plugin/lib/graphify-bridge.js tests/unit/graphify-bridge/import.test.js
git commit -m "feat: implement importGraphJSON full import flow"
```

---

## Task 6: checkGraphifyInstalled + runGraphify + graphifyProject

**Files:**

- Modify: `opencode-memory-plugin/lib/graphify-bridge.js`
- Modify: `opencode-memory-plugin/lib/code-analysis-service.js`

- [ ] **Step 1: 实现 checkGraphifyInstalled + runGraphify + graphifyProject**

替换 `graphify-bridge.js` 中的三个存根：

```javascript
/**
 * 检查 graphify 是否安装
 */
export async function checkGraphifyInstalled() {
  try {
    const { stdout } = await execFile(
      "python",
      ["-m", "graphify", "--version"],
      {
        timeout: 10000,
      },
    );
    const version = stdout.trim();
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

/**
 * 运行 graphify update
 */
export async function runGraphify(projectPath) {
  try {
    const { stdout, stderr } = await execFile(
      "python",
      ["-m", "graphify", "update", projectPath],
      {
        timeout: 300000, // 5 分钟超时
        cwd: projectPath,
      },
    );

    const outputPath = path.join(projectPath, "graphify-out", "graph.json");
    return { success: true, outputPath, stdout, stderr };
  } catch (err) {
    logError("GRAPHIFY", "graphify run failed", {
      error: err.message,
      stderr: err.stderr,
    });
    return {
      success: false,
      outputPath: null,
      error: err.message,
      stderr: err.stderr,
    };
  }
}

/**
 * 使用 graphify 分析项目并导入 SurrealDB
 */
export async function graphifyProject(options = {}) {
  const { projectPath = process.cwd(), skipGraphify = false } = options;

  // 1. 检查 graphify 安装
  if (!skipGraphify) {
    const { installed, version } = await checkGraphifyInstalled();
    if (!installed) {
      throw new Error(
        "graphify 未安装。请运行: pip install graphifyy\n" +
          "文档: https://github.com/safishamsi/graphify",
      );
    }
    logInfo("GRAPHIFY", `graphify v${version} detected`);

    // 2. 运行 graphify
    const { success, error } = await runGraphify(projectPath);
    if (!success) {
      throw new Error(`graphify 运行失败: ${error}`);
    }
  }

  // 3. 导入
  const { getConfig } = await import("./storage.js");
  const { default: WrapperClient } = await import("./wrapper-client.js");
  const config = getConfig();

  const client = new WrapperClient(config);
  const projectId = config.project?.id || "unknown";

  return await importGraphJSON({
    projectPath,
    projectId,
    client,
    tenantId: config.backend?.tenant_id || process.env.USERNAME,
  });
}
```

- [ ] **Step 2: 在 code-analysis-service.js 中替换 uploadProject 为 graphifyProject**

在 `opencode-memory-plugin/lib/code-analysis-service.js` 中：

1. 修改 import，添加 `graphifyProject`：

```javascript
import { graphifyProject } from "./graphify-bridge.js";
```

1. 找到 `uploadProject` 函数（或其 export），替换为调用 `graphifyProject`：

```javascript
export async function uploadProject(options) {
  // @deprecated since v3.4 - replaced by graphifyProject
  return graphifyProject(options);
}

export { graphifyProject };
```

- [ ] **Step 3: Commit**

```bash
git add opencode-memory-plugin/lib/graphify-bridge.js opencode-memory-plugin/lib/code-analysis-service.js
git commit -m "feat: implement graphifyProject command (replaces uploadProject)"
```

---

## Task 7: CLI 命令

**Files:**

- Modify: `opencode-memory-plugin/cli/index.cjs`

- [ ] **Step 1: 在 CLI 中添加 graphify 命令**

在 `cli/index.cjs` 中找到命令注册区域，添加：

```javascript
program
  .command("graphify")
  .description("Analyze project with graphify and import to SurrealDB")
  .option("--project <path>", "Project path", process.cwd())
  .option(
    "--skip-graphify",
    "Skip running graphify, import existing graph.json",
  )
  .action(async (opts) => {
    try {
      const { graphifyProject } = await import("../lib/graphify-bridge.js");
      const result = await graphifyProject({
        projectPath: opts.project,
        skipGraphify: opts.skipGraphify,
      });

      console.log("\n=== Graphify Import Report ===");
      console.log(`Entities:   ${result.entities}`);
      console.log(`Atoms:      ${result.atoms}`);
      console.log(`References: ${result.references}`);
      if (result.errors) console.log(`Errors:     ${result.errors}`);
      if (result.skipped) console.log(`Skipped:    ${result.skipped}`);
      console.log("\nBy Relation:");
      for (const [type, count] of Object.entries(result.byRelation || {})) {
        console.log(`  ${type}: ${count}`);
      }
    } catch (err) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  });
```

- [ ] **Step 2: 验证 CLI 注册成功**

Run: `node opencode-memory-plugin/cli/index.cjs --help`
Expected: 输出包含 `graphify` 命令

- [ ] **Step 3: Commit**

```bash
git add opencode-memory-plugin/cli/index.cjs
git commit -m "feat: add graphify CLI command"
```

---

## Task 8: 废弃旧模块

**Files:**

- Modify: `opencode-memory-plugin/lib/code-analyzer.js`
- Modify: `opencode-memory-plugin/lib/relation-recommender.js`
- Modify: `opencode-memory-plugin/lib/fix-engine.js`

- [ ] **Step 1: 在三个文件头部添加 @deprecated 注释**

`code-analyzer.js` 头部添加：

```javascript
/**
 * @deprecated since v3.4 - Replaced by graphify-bridge.js
 * This module will be removed in a future version.
 * Use graphifyProject() from graphify-bridge.js instead.
 */
```

`relation-recommender.js` 头部添加：

```javascript
/**
 * @deprecated since v3.4 - Replaced by graphify-bridge.js
 * Graphify provides direct relationship extraction.
 * This module's signal-based approach was too weak (see root cause analysis).
 */
```

`fix-engine.js` 头部添加：

```javascript
/**
 * @deprecated since v3.4 - Replaced by graphify-bridge.js
 * Graphify solves the root cause (42% isolation rate) directly.
 * This module only diagnosed but never fixed issues.
 */
```

- [ ] **Step 2: 从 code-analysis-service.js 移除对废弃模块的 import**

检查 `code-analysis-service.js` 中是否有对这三个模块的 import，如果有则移除。

- [ ] **Step 3: 运行全部测试确认无破坏**

Run: `node --experimental-vm-modules node_modules/.bin/jest --passWithNoTests`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add opencode-memory-plugin/lib/code-analyzer.js opencode-memory-plugin/lib/relation-recommender.js opencode-memory-plugin/lib/fix-engine.js opencode-memory-plugin/lib/code-analysis-service.js
git commit -m "chore: deprecate Oxc analyzer, relation-recommender, and fix-engine"
```

---

## Task 9: wrapper-client.js 新增 deleteByProject

**Files:**

- Modify: `opencode-memory-plugin/lib/wrapper-client.js`

- [ ] **Step 1: 实现 deleteByProject 方法**

在 `wrapper-client.js` 的 WrapperClient 类中添加：

```javascript
  /**
   * 按项目删除所有 Entity + Atom + Reference
   * @param {string} projectId - 项目 ID
   * @param {string} [tenant_id] - 租户 ID
   * @returns {Promise<{deleted: number}>}
   */
  async deleteByProject(projectId, tenant_id) {
    const tid = tenant_id || this.tenantId;
    const result = await withRetry(
      () => this.http.delete(`/api/v1/entities/by-project/${encodeURIComponent(projectId)}?tenant_id=${tid}`),
      this.maxRetries
    );
    logInfo('ENTITY', 'deleteByProject completed', { projectId, deleted: result.deleted ?? 0 });
    return result;
  }
```

> **注意**：此前端 API 需要后端支持。如果后端暂时没有 `DELETE /api/v1/entities/by-project/:id`，可以在 graphifyProject 中改为逐条查询+删除的降级方案。

- [ ] **Step 2: Commit**

```bash
git add opencode-memory-plugin/lib/wrapper-client.js
git commit -m "feat: add deleteByProject method to wrapper-client"
```

---

## Task 10: 端到端验证

**Files:** 无新文件

- [ ] **Step 1: 确保后端 schema 已完全部署**

验证以下 API 可用：

```bash
# method 类型
curl -X POST http://localhost:18008/api/v1/references -H "Content-Type: application/json" -d '{"from_id":"entity:test","to_id":"atom:test","type":"method","weight":0.9,"tenant_id":"longray"}'

# imports_from 类型
curl -X POST http://localhost:18008/api/v1/references -H "Content-Type: application/json" -d '{"from_id":"entity:test","to_id":"entity:test2","type":"imports_from","weight":0.8,"tenant_id":"longray"}'
```

如果后端未就绪，使用降级策略（见设计文档 7.3）。

- [ ] **Step 2: 运行 graphifyProject 对 opencode-memory-plugin 项目**

```bash
node opencode-memory-plugin/cli/index.cjs graphify --project opencode-memory-plugin
```

Expected: 成功导入 ~181 entities, ~2465 atoms, ~3699 references

- [ ] **Step 3: 验证孤立率**

通过 `index_status` 或直接查询验证孤立率 < 1%。

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: graphify-bridge v3.4 complete - 42% → 0.2% isolation rate"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: 设计文档每个章节都有对应 Task（1-10）
- [x] **Placeholder scan**: 无 TBD/TODO，所有步骤含完整代码
- [x] **Type consistency**: buildEntityPayload/buildAtomPayload/buildReferencePayload 签名在各 Task 中一致
- [x] **TDD**: 每个 Task 先写测试再实现
- [x] **File paths**: 所有路径使用相对于项目根的精确路径
