# 代码分析功能测试方案 v3.1

**版本**: v3.1 (2026-04-24)
**状态**: 已审核
**关联**: BL-CA-41, BL-CA-45

## v3.1 审核修正 (18 项)

| #     | 严重度 | 问题                                                                   | 修正                |
| ----- | ------ | ---------------------------------------------------------------------- | ------------------- |
| 1     | 致命   | P0-1 Mock 缺少 `storage.js`/`wrapper-client.js`/`precompute/client.js` | 补齐 9 个模块 mock  |
| 2     | 致命   | §4.4.2 `formatTree` → `formatAsTree`                                   | 修正函数名          |
| 3     | 致命   | §4.3.3 password 测试用 `db_pass` 不匹配正则                            | 改为 `password`     |
| 4     | 致命   | §4.3.5 shouldSkipFile 测试用 `db_pass` 不匹配正则                      | 改为 `password`     |
| 5     | 致命   | P2-1 Mock 缺少 `code-analysis-service.js`/`privacy-filter.js`          | 补齐 mock           |
| 6     | 误导   | §4.1.3 描述说 "and N more" 但代码无此文本                              | 修正描述            |
| 7     | 误导   | §4.3.3 短密码测试 key 名不对                                           | `pass` → `password` |
| 8-12  | 缺失   | §4.2.1/4.2.2/4.2.4/4.2.5/4.2.6 无内容                                  | 补全 17 个用例      |
| 13-14 | 缺失   | §4.5.1/4.5.2 无内容                                                    | 补全 4 个用例       |
| 15-17 | 缺失   | §4.6.1-4.6.3 无内容                                                    | 补全 3 个用例       |
| 18    | 次要   | §3.1 bug 修复未注明 import 变更                                        | 补充说明            |

---

## 1. 现有覆盖

| 测试文件                                          | 用例数  | 覆盖模块                                                                                 |
| ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| `tests/test-code-analysis.test.js`                | ~50     | CodeAnalyzer(Oxc)、Tree-sitter、ProjectAnalyzer、AnalysisQueue(构造器)、PrivacyFilter(3) |
| `tests/code-analysis-service-atom-entity.test.js` | ~15     | AnalysisQueue.uploadAsAtomEntity() Mock                                                  |
| `tests/tree-sitter-query.test.js`                 | ~12     | analyzeWithQuery 4语言                                                                   |
| `tests/test-precompute.test.js`                   | ~13     | FingerprintCache                                                                         |
| `tests/integration/code-analysis-v14-e2e.test.js` | ~8      | 分析→上传→缓存→调用关系 E2E                                                              |
| **合计**                                          | **~98** |                                                                                          |

## 2. 覆盖缺口

| 模块                                     | 行数 | 公共方法 | 已测 | 零测    |
| ---------------------------------------- | ---- | -------- | ---- | ------- |
| `code-analysis-service.js` AnalysisQueue | 833  | 18       | 1    | **17**  |
| `memory-id-cache.js` MemoryIdCache       | 562  | 20+      | 0    | **20+** |
| `privacy-filter.js`                      | 125  | 4        | 2    | **2**   |
| `code-analysis-formatter.js`             | 220  | 3        | 0    | **3**   |
| `file-watcher.js`                        | 125  | 3        | 0    | **3**   |

## 3. Bug 修复（测试前置）

### 3.1 validateFileSize 性能 Bug

**文件**: `lib/privacy-filter.js` L111-124

**问题**: 用 `readFileSync().length` 读取整个文件到内存只为获取大小，返回字符串字符数而非文件字节数。UTF-8 多字节字符下结果错误。

**修复**（2 处改动）:

```javascript
// 1. Import 变更
// Before
import { readFileSync } from "fs";
// After
import { statSync } from "fs";

// 2. 函数体变更
// Before (bug)
const stats = readFileSync(filePath, { flag: "r" }).length;
// After (fix)
const stats = statSync(filePath).size;
```

---

## 4. 测试文件详细方案

### P0-1: `tests/test-analysis-queue-core.test.js` (~20 用例)

**目标**: 覆盖 AnalysisQueue 的队列管理、文件过滤、语言检测、摘要生成、完整处理流程
**依赖**: jest mock (WrapperClient, resolveProjectId, fs, codeAnalyzer, shouldSkipFile)
**后端**: 不需要

#### Mock 策略

```javascript
import { jest } from "@jest/globals";

// 模块级 mock（必须在 import 之前）
// ⚠️ 模块级调用：L14 getConfig()、L49 getPrecomputeClient()
// 必须在 import AnalysisQueue 之前 mock，否则模块加载时就会执行真实代码

jest.mock("../lib/storage.js", () => ({
  getConfig: jest.fn().mockReturnValue({ code_analysis: {} }),
}));

jest.mock("../lib/wrapper-client.js", () => ({
  WrapperClient: jest.fn().mockImplementation(() => ({
    tenantId: "test-tenant",
    createAtom: jest.fn().mockResolvedValue({ id: "atom:1" }),
    createEntity: jest.fn().mockResolvedValue({ id: "entity:1" }),
    createReference: jest.fn().mockResolvedValue({ id: "ref:1" }),
    deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    uploadMemories: jest.fn().mockResolvedValue({ success: 1, total: 1 }),
  })),
}));

jest.mock("../lib/precompute/client.js", () => ({
  getPrecomputeClient: jest.fn().mockReturnValue({
    uploadAnalysisBatch: jest.fn().mockResolvedValue({ success: 1, total: 1 }),
  }),
}));

jest.mock("../lib/precompute/fingerprint-cache.js", () => ({
  FingerprintCache: jest.fn().mockImplementation(() => ({
    hasChanged: jest.fn().mockReturnValue({ changed: true }),
    set: jest.fn(),
    getSymbolsHash: jest.fn().mockReturnValue("hash123"),
  })),
}));

jest.mock("../lib/memory-id-cache.js", () => ({
  MemoryIdCache: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(true),
    set: jest.fn().mockResolvedValue(undefined),
    getMemoryId: jest.fn().mockResolvedValue(null),
    getSourceId: jest.fn().mockResolvedValue(null),
    generateSourceId: jest.fn().mockReturnValue("local-test-id"),
  })),
}));

jest.mock("../lib/code-analyzer.js", () => ({
  codeAnalyzer: {
    analyze: jest.fn().mockResolvedValue({
      language: "javascript",
      functions: [{ name: "test", start_line: 1, end_line: 5 }],
      classes: [],
      imports: [],
      calls: [],
      complexity_metrics: {
        cyclomatic: 1,
        max_nesting_depth: 1,
        lines_of_code: 5,
      },
      quality_score: { score: 90, grade: "A" },
    }),
  },
}));

jest.mock("../lib/privacy-filter.js", () => ({
  shouldSkipFile: jest.fn().mockReturnValue({ skip: false }),
}));

jest.mock("../lib/project-resolver.js", () => ({
  resolveProjectId: jest.fn().mockResolvedValue("test-project"),
}));

jest.mock("../lib/tree-sitter-parser.js", () => ({
  analyzeWithQuery: jest.fn().mockResolvedValue({
    language: "javascript",
    functions: [],
    classes: [],
    calls: [],
    complexity_metrics: {},
  }),
}));

jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue("function test() {}"),
  existsSync: jest.fn().mockReturnValue(true),
  writeFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 100 }),
}));

import { AnalysisQueue } from "../lib/code-analysis-service.js";
```

#### 4.1.1 detectLanguage (实例方法，逻辑纯，5 用例)

```javascript
describe("detectLanguage", () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  test(".js → javascript", () => {
    expect(queue.detectLanguage("src/foo.js")).toBe("javascript");
  });

  test(".mjs / .cjs → javascript (同族)", () => {
    expect(queue.detectLanguage("src/foo.mjs")).toBe("javascript");
    expect(queue.detectLanguage("src/foo.cjs")).toBe("javascript");
  });

  test(".ts / .tsx → typescript", () => {
    expect(queue.detectLanguage("src/foo.ts")).toBe("typescript");
    expect(queue.detectLanguage("src/foo.tsx")).toBe("typescript");
  });

  test(".py / .go / .rs / .java → 各自语言", () => {
    expect(queue.detectLanguage("src/foo.py")).toBe("python");
    expect(queue.detectLanguage("src/foo.go")).toBe("go");
    expect(queue.detectLanguage("src/foo.rs")).toBe("rust");
    expect(queue.detectLanguage("src/Foo.java")).toBe("java");
  });

  test("未知扩展名 → unknown", () => {
    expect(queue.detectLanguage("src/foo.xyz")).toBe("unknown");
    expect(queue.detectLanguage("src/Makefile")).toBe("unknown");
  });
});
```

#### 4.1.2 generateAbstract (实例方法，逻辑纯，3 用例)

```javascript
describe("generateAbstract", () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  test("有函数 + 类 → 标准格式", () => {
    const result = {
      language: "javascript",
      functions: [{ name: "a" }, { name: "b" }],
      classes: [{ name: "C" }],
    };
    expect(queue.generateAbstract("src/utils.js", result)).toBe(
      "javascript file: src/utils.js (2 functions, 1 classes)",
    );
  });

  test("无函数无类 → 0 计数", () => {
    const result = { language: "python", functions: [], classes: [] };
    expect(queue.generateAbstract("src/main.py", result)).toBe(
      "python file: src/main.py (0 functions, 0 classes)",
    );
  });

  test("null/undefined functions/classes → defensive 0 计数", () => {
    const result = { language: "javascript" };
    expect(queue.generateAbstract("src/empty.js", result)).toBe(
      "javascript file: src/empty.js (0 functions, 0 classes)",
    );
  });
});
```

#### 4.1.3 generateOverview (实例方法，逻辑纯，3 用例)

```javascript
describe("generateOverview", () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  test("正常结果 → 4 行格式", () => {
    const result = {
      complexity_metrics: { lines_of_code: 100, cyclomatic: 5 },
      functions: [{ name: "a" }, { name: "b" }],
      classes: [{ name: "C" }],
    };
    const output = queue.generateOverview("src/utils.js", result);
    expect(output).toContain("File: src/utils.js");
    expect(output).toContain("Lines: 100");
    expect(output).toContain("Functions: a, b");
    expect(output).toContain("Classes: C");
    expect(output).toContain("Complexity: 5");
  });

  test("超过 5 函数 → 静默截断只取前 5", () => {
    const funcs = Array(8)
      .fill(0)
      .map((_, i) => ({ name: `f${i}` }));
    const result = { complexity_metrics: {}, functions: funcs, classes: [] };
    const output = queue.generateOverview("src/big.js", result);
    expect(output).toContain("f0, f1, f2, f3, f4");
    // 确认 f5 不在输出中（静默截断，无 "and N more" 提示）
    expect(output).not.toContain("f5");
  });

  test("超过 3 类 → 静默截断只取前 3", () => {
    const classes = Array(5)
      .fill(0)
      .map((_, i) => ({ name: `C${i}` }));
    const result = { complexity_metrics: {}, functions: [], classes };
    const output = queue.generateOverview("src/big.js", result);
    expect(output).toContain("C0, C1, C2");
    // 确认 C3 不在输出中（静默截断，无 "and N more" 提示）
    expect(output).not.toContain("C3");
  });
});
```

#### 4.1.4 add (5 用例)

```javascript
describe("add", () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    // Mock debouncedProcess 避免 timer
    queue.debouncedProcess = jest.fn();
  });

  test("正常入队 → queue.length === 1", () => {
    queue.add("/project/src/test.js", "/project");
    expect(queue.queue).toHaveLength(1);
    expect(queue.queue[0].filePath).toBe("/project/src/test.js");
    expect(queue.queue[0].relativePath).toBe("src/test.js");
  });

  test("排除文件 → 不入队", async () => {
    const { shouldSkipFile } = await import("../lib/privacy-filter.js");
    shouldSkipFile.mockReturnValueOnce({ skip: true, reason: "excluded_file" });
    queue.add("/project/.env", "/project");
    expect(queue.queue).toHaveLength(0);
  });

  test("不支持扩展名 → 不入队", () => {
    queue.add("/project/readme.txt", "/project");
    expect(queue.queue).toHaveLength(0);
  });

  test("重复文件 → 去重（替换旧条目）", () => {
    queue.add("/project/src/a.js", "/project");
    queue.add("/project/src/a.js", "/project");
    expect(queue.queue).toHaveLength(1);
  });

  test("队列溢出 (MAX_QUEUE_SIZE=10) → shift 最旧", () => {
    for (let i = 0; i < 11; i++) {
      queue.add(`/project/src/f${i}.js`, "/project");
    }
    expect(queue.queue).toHaveLength(10);
    expect(queue.queue[0].filePath).toBe("/project/src/f1.js"); // f0 被移除
  });
});
```

#### 4.1.5 processItem 完整流程 (4 用例，深度 mock)

```javascript
describe("processItem", () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    queue.initCache = jest.fn();
    queue.fingerprintCache = {
      hasChanged: jest.fn().mockReturnValue({ changed: true }),
      set: jest.fn(),
      getSymbolsHash: jest.fn().mockReturnValue("hash123"),
    };
    queue.memoryIdCache = { set: jest.fn() };
    queue.wrapperClient = {
      tenantId: "test-tenant",
      createAtom: jest.fn().mockResolvedValue({ id: "atom:1" }),
      createEntity: jest.fn().mockResolvedValue({ id: "entity:1" }),
      createReference: jest.fn().mockResolvedValue({ id: "ref:1" }),
      deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    };
    queue.concurrentCount = 0;
  });

  afterEach(() => {
    queue.processing.clear();
  });

  test("文件不存在 (ENOENT) → 不抛异常", async () => {
    const { readFileSync } = await import("fs");
    const error = new Error("ENOENT");
    error.code = "ENOENT";
    readFileSync.mockImplementationOnce(() => {
      throw error;
    });

    await expect(
      queue.processItem({
        filePath: "/project/deleted.js",
        relativePath: "deleted.js",
        projectRoot: "/project",
      }),
    ).resolves.not.toThrow();
  });

  test("文件含敏感内容 → 跳过分析", async () => {
    const { shouldSkipFile } = await import("../lib/privacy-filter.js");
    shouldSkipFile.mockReturnValueOnce({
      skip: true,
      reason: "sensitive_content",
    });

    await queue.processItem({
      filePath: "/project/secret.js",
      relativePath: "secret.js",
      projectRoot: "/project",
    });

    // 不应调用 codeAnalyzer
    const { codeAnalyzer } = await import("../lib/code-analyzer.js");
    expect(codeAnalyzer.analyze).not.toHaveBeenCalled();
  });

  test("指纹未变 → 跳过分析", async () => {
    queue.fingerprintCache.hasChanged.mockReturnValueOnce({ changed: false });

    await queue.processItem({
      filePath: "/project/unchanged.js",
      relativePath: "unchanged.js",
      projectRoot: "/project",
    });

    const { codeAnalyzer } = await import("../lib/code-analyzer.js");
    expect(codeAnalyzer.analyze).not.toHaveBeenCalled();
  });

  test("正常流程 → 调用 codeAnalyzer + uploadAsAtomEntity", async () => {
    // Mock processItem 内部调用的 uploadAsAtomEntity
    const uploadSpy = jest
      .spyOn(queue, "uploadAsAtomEntity")
      .mockResolvedValue({
        atoms: [{ id: "atom:1" }],
        entity: { id: "entity:1" },
        references: [],
        duration: 10,
      });

    await queue.processItem({
      filePath: "/project/src/test.js",
      relativePath: "src/test.js",
      projectRoot: "/project",
    });

    const { codeAnalyzer } = await import("../lib/code-analyzer.js");
    expect(codeAnalyzer.analyze).toHaveBeenCalledWith(
      "src/test.js",
      expect.any(String),
    );
    uploadSpytoHaveBeenCalled();
  });
});
```

#### 4.1.6 rollbackAtoms (2 用例)

```javascript
describe("rollbackAtoms", () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    queue.wrapperClient = {
      tenantId: "test",
      deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    };
  });

  test("全部成功删除 → deleteAtom 调用 N 次", async () => {
    const atoms = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
    await queue.rollbackAtoms(atoms);
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledTimes(3);
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledWith("a1");
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledWith("a2");
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledWith("a3");
  });

  test("部分删除失败 → 继续删除剩余，不抛异常", async () => {
    queue.wrapperClient.deleteAtom
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });

    const atoms = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
    await expect(queue.rollbackAtoms(atoms)).resolves.not.toThrow();
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledTimes(3);
  });
});
```

---

### P0-2: `tests/test-memory-id-cache.test.js` (~25 用例)

**目标**: 覆盖 MemoryIdCache 的 CRUD、持久化、导入导出、验证、重建
**依赖**: temp 目录 (`os.tmpdir()` + `Date.now()` 隔离)
**后端**: 不需要
**关键**: 使用 `jest.useFakeTimers()` 处理 scheduleSave 1 秒防抖

#### Fixture 模板

```
---
id: 01ABC123DEF
source_id: src-utils-001
memory_id: memory:abc123
synced: true
---
```

> **注意**: parseEntryFile 的正则 `^(\w+):\s*(.+)$` 不匹配含连字符的 key（如 `synced-at`）。fixture 中只使用纯字母 key。

#### Mock 策略

```javascript
import { jest } from "@jest/globals";
import os from "os";
import path from "path";
import fs from "fs";

jest.useFakeTimers();

const TEST_CACHE_DIR = path.join(
  os.tmpdir(),
  `memory-cache-test-${Date.now()}`,
);
```

#### 4.2.1 基本 CRUD (6 用例)

```javascript
describe("基本 CRUD", () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  });

  test("set + getMemoryId → 返回 memory_id", async () => {
    await cache.set("src/a.js", "sid1", "mid1");
    expect(await cache.getMemoryId("src/a.js")).toBe("mid1");
  });

  test("getMemoryId 未命中 → null + misses++", async () => {
    await cache.getMemoryId("src/nonexist.js");
    expect(cache.stats.misses).toBe(1);
  });

  test("getSourceId → 返回 source_id", async () => {
    await cache.set("src/a.js", "sid1", "mid1");
    expect(await cache.getSourceId("src/a.js")).toBe("sid1");
  });

  test("getFilePath (reverseIndex) → 返回 file_path", async () => {
    await cache.set("src/a.js", "sid1", "mid1");
    expect(await cache.getFilePath("sid1")).toBe("src/a.js");
  });

  test("has → 存在/不存在", () => {
    expect(cache.has("src/a.js")).toBe(false);
    cache.mappings.set("src/a.js", { source_id: "s1", memory_id: "m1" });
    expect(cache.has("src/a.js")).toBe(true);
  });

  test("delete → 删除后 getMemoryId 返回 null", async () => {
    await cache.set("src/a.js", "sid1", "mid1");
    expect(await cache.delete("src/a.js")).toBe(true);
    expect(await cache.getMemoryId("src/a.js")).toBeNull();
  });
});
```

#### 4.2.2 批量操作 (3 用例)

```javascript
describe("批量操作", () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  });

  test("setBatch → 批量写入后全部可查", async () => {
    const mappings = new Map([
      ["src/a.js", { source_id: "s1", memory_id: "m1" }],
      ["src/b.js", { source_id: "s2", memory_id: "m2" }],
    ]);
    await cache.setBatch(mappings);
    expect(await cache.getMemoryId("src/a.js")).toBe("m1");
    expect(await cache.getMemoryId("src/b.js")).toBe("m2");
  });

  test("getBatch → 只返回存在的条目", async () => {
    await cache.set("src/a.js", "s1", "m1");
    const result = await cache.getBatch(["src/a.js", "src/missing.js"]);
    expect(result.size).toBe(1);
    expect(result.get("src/a.js")).toBe("m1");
  });

  test("getBatch 空输入 → 空 Map", async () => {
    const result = await cache.getBatch([]);
    expect(result.size).toBe(0);
  });
});
```

#### 4.2.3 持久化 (4 用例)

关键: 每次写入后调用 `jest.advanceTimersByTime(1100)` 刷出 pending save。

```javascript
test("save + load 往返一致", async () => {
  const cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  await cache.set("src/a.js", "sid1", "mid1");
  jest.advanceTimersByTime(1100); // 刷出 scheduleSave

  const cache2 = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  await cache2.load();
  expect(await cache2.getMemoryId("src/a.js")).toBe("mid1");
});
```

#### 4.2.4 导入导出 (3 用例)

```javascript
describe("导入导出", () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  });

  test("export → 有效 JSON，包含 project_id", () => {
    cache.mappings.set("src/a.js", { source_id: "s1", memory_id: "m1" });
    const json = cache.export();
    const parsed = JSON.parse(json);
    expect(parsed.project_id).toBe("test-project");
    expect(parsed.mappings["src/a.js"].memory_id).toBe("m1");
  });

  test("import (merge) → 新条目导入，旧条目保留", async () => {
    await cache.set("src/a.js", "s1", "m1");
    const importJson = JSON.stringify({
      project_id: "test-project",
      mappings: {
        "src/b.js": {
          source_id: "s2",
          memory_id: "m2",
          last_synced: new Date().toISOString(),
        },
      },
    });
    const result = await cache.import(importJson);
    expect(result.imported).toBe(1);
    expect(await cache.getMemoryId("src/a.js")).toBe("m1");
    expect(await cache.getMemoryId("src/b.js")).toBe("m2");
  });

  test("import 非 merge → 丢弃旧条目", async () => {
    await cache.set("src/a.js", "s1", "m1");
    const importJson = JSON.stringify({
      project_id: "test-project",
      mappings: {
        "src/a.js": {
          source_id: "s1-new",
          memory_id: "m1-new",
          last_synced: new Date().toISOString(),
        },
      },
    });
    const result = await cache.import(importJson, { merge: false });
    // merge=false 不更新已存在条目
    expect(result.imported).toBe(0);
    expect(await cache.getMemoryId("src/a.js")).toBe("m1"); // 旧值保留
  });
});
```

#### 4.2.5 验证与统计 (3 用例)

```javascript
describe("验证与统计", () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  });

  test("validate → 空 cache → valid: 0", () => {
    const result = cache.validate();
    expect(result.valid).toBe(0);
    expect(result.invalid).toBe(0);
    expect(result.missing).toEqual([]);
  });

  test("validate → 有效条目 + 缺失 memory_id", () => {
    cache.mappings.set("src/a.js", { source_id: "s1", memory_id: "m1" });
    cache.mappings.set("src/b.js", { source_id: "s2", memory_id: null });
    const result = cache.validate();
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.missing).toContain("src/b.js");
  });

  test("getStats → hit_rate 计算", async () => {
    await cache.set("src/a.js", "s1", "m1");
    await cache.getMemoryId("src/a.js"); // hit
    await cache.getMemoryId("src/nonexist.js"); // miss
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hit_rate).toBe("50.00%");
  });
});
```

#### 4.2.6 路径标准化 (2 用例)

```javascript
describe("路径标准化", () => {
  test("反斜杠 → 正斜杠", () => {
    const cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
    expect(cache.normalizePath("src\\utils\\index.js")).toBe(
      "src/utils/index.js",
    );
  });

  test("已经是正斜杠 → 不变", () => {
    const cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
    expect(cache.normalizePath("src/utils/index.js")).toBe(
      "src/utils/index.js",
    );
  });
});
```

#### 4.2.7 rebuildFromLocal (3 用例)

需要创建 temp timeline 目录 + .md fixture 文件：

```javascript
test("有 entry 文件 → 正确解析", async () => {
  const timelineDir = path.join(TEST_CACHE_DIR, "timeline", "2026", "04", "24");
  fs.mkdirSync(timelineDir, { recursive: true });
  fs.writeFileSync(path.join(timelineDir, "entry_test.md"), entryFixture);

  const cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  const count = await cache.rebuildFromLocal(timelineDir);
  expect(count).toBe(1);
  expect(await cache.getMemoryId("src/utils.js")).toBe("memory:abc123");
});
```

#### 4.2.8 parseEntryFile (2 用例)

```javascript
test("正常 frontmatter → 提取 source_id/memory_id", () => {
  const cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  const result = cache.parseEntryFile(entryFixture);
  expect(result.source_id).toBe("src-utils-001");
  expect(result.memory_id).toBe("memory:abc123");
});

test("无 frontmatter → 全部 null", () => {
  const cache = new MemoryIdCache("test-project", TEST_CACHE_DIR);
  const result = cache.parseEntryFile("# Just a heading\nSome text");
  expect(result.source_id).toBeNull();
  expect(result.memory_id).toBeNull();
});
```

---

### P1-1: `tests/test-privacy-filter-extended.test.js` (~28 用例)

**目标**: 全覆盖 25 个排除模式 + 10 个敏感模式 + 修复后的 validateFileSize
**依赖**: 无（纯函数）
**后端**: 不需要

#### 4.3.1 isExcludedFile 关键路径 (10 用例)

```javascript
describe("isExcludedFile", () => {
  test(".env / .env.local / .env.production → excluded", () => {
    expect(isExcludedFile("/project/.env").excluded).toBe(true);
    expect(isExcludedFile("/project/.env.local").excluded).toBe(true);
    expect(isExcludedFile("/project/.env.production").excluded).toBe(true);
  });

  test(".git/ 下的文件 → excluded", () => {
    expect(isExcludedFile("/project/.git/config").excluded).toBe(true);
  });

  test("证书文件 → excluded", () => {
    expect(isExcludedFile("/project/server.pem").excluded).toBe(true);
    expect(isExcludedFile("/project/server.key").excluded).toBe(true);
    expect(isExcludedFile("/project/cert.p12").excluded).toBe(true);
    expect(isExcludedFile("/project/cert.pfx").excluded).toBe(true);
  });

  test("SSH 密钥 → excluded", () => {
    expect(isExcludedFile("/project/.ssh/id_rsa").excluded).toBe(true);
    expect(isExcludedFile("/project/.ssh/id_ed25519").excluded).toBe(true);
  });

  test("配置凭证 → excluded", () => {
    expect(isExcludedFile("/project/.npmrc").excluded).toBe(true);
    expect(isExcludedFile("/project/.htpasswd").excluded).toBe(true);
  });

  test("敏感目录名 → excluded", () => {
    expect(isExcludedFile("/project/credentials/db.json").excluded).toBe(true);
    expect(isExcludedFile("/project/secrets/app.key").excluded).toBe(true);
  });

  test("config.*.json → excluded", () => {
    expect(isExcludedFile("/project/config.json").excluded).toBe(true);
    expect(isExcludedFile("/project/config.production.json").excluded).toBe(
      true,
    );
  });

  test("普通源文件 → 不排除", () => {
    expect(isExcludedFile("/project/src/index.js").excluded).toBe(false);
    expect(isExcludedFile("/project/lib/utils.ts").excluded).toBe(false);
  });
});
```

#### 4.3.2 isExcludedFile Windows 路径 (2 用例)

```javascript
describe("isExcludedFile - Windows paths", () => {
  test("反斜杠路径 → 正确排除", () => {
    expect(isExcludedFile("C:\\project\\.env").excluded).toBe(true);
    expect(isExcludedFile("C:\\Users\\test\\.ssh\\id_rsa").excluded).toBe(true);
  });

  test("反斜杠路径 → 正确放行", () => {
    expect(isExcludedFile("C:\\project\\src\\index.js").excluded).toBe(false);
  });
});
```

#### 4.3.3 containsSensitiveInfo 全覆盖 (12 用例)

```javascript
describe("containsSensitiveInfo", () => {
  test("password 模式", () => {
    const result = containsSensitiveInfo('password = "mySecret123"');
    expect(result.hasSensitive).toBe(true);
    expect(result.patterns[0].type).toBe("password");
  });

  test("api_key 模式 (大小写)", () => {
    expect(containsSensitiveInfo('API_KEY = "sk-abc123"').hasSensitive).toBe(
      true,
    );
    expect(containsSensitiveInfo('api_key="sk-abc"').hasSensitive).toBe(true);
  });

  test("secret 模式", () => {
    expect(containsSensitiveInfo('secret = "abc"').hasSensitive).toBe(true);
  });

  test("token 模式", () => {
    expect(containsSensitiveInfo('token = "eyJhbGci"').hasSensitive).toBe(true);
  });

  test("private_key 模式", () => {
    expect(
      containsSensitiveInfo('private_key = "-----BEGIN"').hasSensitive,
    ).toBe(true);
  });

  test("aws_access_key_id 模式", () => {
    expect(
      containsSensitiveInfo('aws_access_key_id = "AKIAIOSFODNN7"').hasSensitive,
    ).toBe(true);
  });

  test("aws_secret_access_key 模式", () => {
    expect(
      containsSensitiveInfo('aws_secret_access_key = "wJalrX"').hasSensitive,
    ).toBe(true);
  });

  test("database_url 模式", () => {
    expect(
      containsSensitiveInfo('database_url = "postgres://localhost"')
        .hasSensitive,
    ).toBe(true);
  });

  test("connection_string 模式", () => {
    expect(
      containsSensitiveInfo('connection_string = "Server=localhost"')
        .hasSensitive,
    ).toBe(true);
  });

  test("Bearer token 模式", () => {
    expect(
      containsSensitiveInfo("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9")
        .hasSensitive,
    ).toBe(true);
  });

  test("null / undefined → hasSensitive: false", () => {
    expect(containsSensitiveInfo(null).hasSensitive).toBe(false);
    expect(containsSensitiveInfo(undefined).hasSensitive).toBe(false);
  });

  test("短密码 (< 4 字符) → 不匹配（正则要求 4+ 字符）", () => {
    expect(containsSensitiveInfo('password = "ab"').hasSensitive).toBe(false);
  });
});
```

#### 4.3.4 validateFileSize (修复后，2 用例)

```javascript
describe("validateFileSize", () => {
  test("正常文件 → valid: true", () => {
    // 创建一个 < 1MB 的 temp 文件
    const tmpFile = path.join(os.tmpdir(), `size-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "a".repeat(100)); // 100 bytes
    const result = validateFileSize(tmpFile);
    expect(result.valid).toBe(true);
    expect(result.size).toBe(100);
    fs.unlinkSync(tmpFile);
  });

  test("超大文件 → valid: false", () => {
    const tmpFile = path.join(os.tmpdir(), `size-test-big-${Date.now()}.txt`);
    // Mock statSync 返回超大文件，不实际创建
    jest.spyOn(fs, "statSync").mockReturnValueOnce({ size: 1024 * 1024 + 1 });
    const result = validateFileSize(tmpFile);
    expect(result.valid).toBe(false);
    expect(result.size).toBeGreaterThan(1024 * 1024);
  });
});
```

#### 4.3.5 shouldSkipFile (with content) (3 用例)

```javascript
describe("shouldSkipFile (with content)", () => {
  test("路径排除优先 → skip: true", () => {
    const result = shouldSkipFile("/project/.env");
    expect(result.skip).toBe(true);
    expect(result.reason).toBe("excluded_file");
  });

  test("路径正常 + 内容含 password → skip: true", () => {
    const result = shouldSkipFile(
      "/project/config.js",
      'password = "secret123"',
    );
    expect(result.skip).toBe(true);
    expect(result.reason).toBe("sensitive_content");
    expect(result.details.patterns).toBeDefined();
    expect(result.details.patterns[0].type).toBe("password");
  });

  test("路径正常 + 内容正常 → skip: false", () => {
    const result = shouldSkipFile("/project/src/index.js", "const x = 1;");
    expect(result.skip).toBe(false);
  });
});
```

---

### P1-2: `tests/test-code-analysis-formatter.test.js` (~15 用例)

**目标**: 覆盖 formatAsTable / formatAsTree / formatAsJson
**依赖**: 无（纯函数）
**后端**: 不需要

#### Fixture

```javascript
const mockResult = {
  success: true,
  file: "src/utils.js",
  result: {
    language: "javascript",
    functions: [
      { name: "add", line: 1, type: "function" },
      { name: "subtract", line: 5, type: "function" },
    ],
    classes: [
      { name: "Calculator", line: 10, methods: [{ name: "run", line: 12 }] },
    ],
    complexity_metrics: {
      cyclomatic: 5,
      max_nesting_depth: 3,
      lines_of_code: 100,
    },
    calls: [
      { target: "add", line: 20, column: 4 },
      { target: "subtract", line: 21, column: 8 },
    ],
    quality_score: {
      score: 85,
      grade: "B",
      issues: ["High complexity in subtract"],
    },
  },
};

const mockErrorResult = {
  success: false,
  error: "Parse error",
};

const mockEmptyResult = {
  success: true,
  file: "empty.js",
  result: {
    language: "javascript",
    functions: [],
    classes: [],
    complexity_metrics: { cyclomatic: 0, lines_of_code: 0 },
    calls: [],
  },
};
```

#### 4.4.1 formatAsTable (6 用例)

```javascript
describe("formatAsTable", () => {
  test("正常结果 → 包含 header + basic info + functions + classes + calls", () => {
    const output = formatAsTable(mockResult);
    expect(output).toContain("┌");
    expect(output).toContain("Code Analysis: src/utils.js");
    expect(output).toContain("Language: javascript");
    expect(output).toContain("Lines: 100");
    expect(output).toContain("Functions: 2");
    expect(output).toContain("Classes: 1");
    expect(output).toContain("Complexity: 5");
    expect(output).toContain("add");
    expect(output).toContain("Calculator");
    expect(output).toContain("add()");
    expect(output).toContain("└");
  });

  test("有 quality_score → 显示评分和 issues", () => {
    const output = formatAsTable(mockResult);
    expect(output).toContain("Quality: 85/100 (B)");
    expect(output).toContain("High complexity in subtract");
  });

  test("超过 10 函数 → 截断显示", () => {
    const manyFuncs = Array(15)
      .fill(0)
      .map((_, i) => ({ name: `func${i}`, line: i }));
    const result = {
      success: true,
      file: "big.js",
      result: {
        language: "javascript",
        functions: manyFuncs,
        classes: [],
        complexity_metrics: {},
        calls: [],
      },
    };
    const output = formatAsTable(result);
    expect(output).toContain("... and 5 more");
  });

  test("超过 5 类 → 截断显示", () => {
    const manyClasses = Array(8)
      .fill(0)
      .map((_, i) => ({ name: `C${i}`, line: i, methods: [] }));
    const result = {
      success: true,
      file: "big.js",
      result: {
        language: "javascript",
        functions: [],
        classes: manyClasses,
        complexity_metrics: {},
        calls: [],
      },
    };
    const output = formatAsTable(result);
    expect(output).toContain("... and 3 more");
  });

  test("超过 10 calls → 截断显示", () => {
    const manyCalls = Array(15)
      .fill(0)
      .map((_, i) => ({ target: `fn${i}`, line: i, column: 0 }));
    const result = {
      success: true,
      file: "big.js",
      result: {
        language: "javascript",
        functions: [],
        classes: [],
        complexity_metrics: {},
        calls: manyCalls,
      },
    };
    const output = formatAsTable(result);
    expect(output).toContain("... and 5 more");
  });

  test("error 结果 → Error: xxx", () => {
    const output = formatAsTable(mockErrorResult);
    expect(output).toBe("Error: Parse error");
  });
});
```

#### 4.4.2 formatAsTree (5 用例)

```javascript
describe("formatAsTree", () => {
  test("正常结果 → 树形结构", () => {
    const output = formatAsTree(mockResult);
    expect(output).toContain("src/utils.js [javascript]");
    expect(output).toContain("├── Functions (2)");
    expect(output).toContain("add() @ line 1");
    expect(output).toContain("subtract() @ line 5");
    expect(output).toContain("└── Classes (1)");
    expect(output).toContain("Calculator @ line 10");
    expect(output).toContain("run() @ line 12");
    expect(output).toContain("└── Calls (2)");
    expect(output).toContain("add() @ line 20:4");
  });

  test("只有函数无类 → 正确前缀 (└──)", () => {
    const result = {
      success: true,
      file: "funcs.js",
      result: {
        language: "javascript",
        functions: [{ name: "a", line: 1 }],
        classes: [],
        calls: [],
      },
    };
    const output = formatAsTree(result);
    expect(output).toContain("├── Functions (1)");
    expect(output).toContain("└── a() @ line 1");
    expect(output).not.toContain("Classes");
  });

  test("只有类无函数 → 正确前缀 (├──)", () => {
    const result = {
      success: true,
      file: "cls.js",
      result: {
        language: "javascript",
        functions: [],
        classes: [{ name: "A", line: 1 }],
        calls: [],
      },
    };
    const output = formatAsTree(result);
    expect(output).toContain("├── Classes (1)");
    expect(output).toContain("└── A @ line 1");
  });

  test("只有 calls 无函数无类 → 正确前缀", () => {
    const result = {
      success: true,
      file: "calls.js",
      result: {
        language: "javascript",
        functions: [],
        classes: [],
        calls: [{ target: "fn", line: 1, column: 0 }],
      },
    };
    const output = formatAsTree(result);
    expect(output).toContain("├── Calls (1)");
    expect(output).toContain("└── fn() @ line 1:0");
  });

  test("error 结果 → Error: xxx", () => {
    const output = formatAsTree(mockErrorResult);
    expect(output).toBe("Error: Parse error");
  });
});
```

#### 4.4.3 formatAsJson (4 用例)

```javascript
describe("formatAsJson", () => {
  test("默认 → 紧凑 JSON 字符串", () => {
    const output = formatAsJson(mockResult);
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(true);
    expect(parsed.file).toBe("src/utils.js");
  });

  test("pretty=true → 缩进 2 空格", () => {
    const output = formatAsJson(mockResult, true);
    expect(output).toContain('  "success": true,\n');
    expect(output).toContain('  "file": "src/utils.js",\n');
  });

  test("结果可 JSON.parse 往返", () => {
    const output = formatAsJson(mockEmptyResult);
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(true);
    expect(parsed.result.language).toBe("javascript");
    expect(parsed.result.functions).toEqual([]);
    expect(parsed.result.classes).toEqual([]);
  });

  test("error 结果 → 有效 JSON", () => {
    const output = formatAsJson(mockErrorResult);
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("Parse error");
  });
});
```

---

### P2-1: `tests/test-file-watcher.test.js` (~4 用例)

**目标**: 覆盖 FileWatcher 的启动/停止/文件变更过滤
**依赖**: jest mock (chokidar)
**后端**: 不需要

#### Mock 策略

```javascript
import { jest } from "@jest/globals";

// file-watcher.js L7: 模块级 getConfig()
jest.mock("../lib/storage.js", () => ({
  getConfig: jest.fn().mockReturnValue({ code_analysis: {} }),
}));

// file-watcher.js L83: processPendingFiles 调用 onFileSaved
jest.mock("../lib/code-analysis-service.js", () => ({
  onFileSaved: jest.fn(),
}));

// file-watcher.js L60: handleFileChange 调用 shouldSkipFile
jest.mock("../lib/privacy-filter.js", () => ({
  shouldSkipFile: jest.fn().mockReturnValue({ skip: false }),
}));

jest.mock("chokidar", () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn(),
  })),
}));
```

#### 4.5.1 start + stop (2 用例)

```javascript
describe('start + stop', () => {
  test('start → chokidar.watch 被调用', () => {
    const { watch } = await import('chokidar');
    const watcher = new FileWatcher('/project');
    watcher.start();
    expect(watch).toHaveBeenCalledWith(
      '**/*.{js,ts,mjs,cjs,mts,cts,tsx,py,go,rs,java}',
      expect.objectContaining({ cwd: '/project', ignoreInitial: true })
    );
  });

  test('stop → watcher.close 被调用 + pendingFiles 清空', () => {
    const { watch } = await import('chokidar');
    const mockClose = jest.fn();
    watch.mockReturnValueOnce({ on: jest.fn().mockReturnThis(), close: mockClose });

    const watcher = new FileWatcher('/project');
    watcher.start();
    watcher.pendingFiles.add('/project/a.js');
    watcher.stop();

    expect(mockClose).toHaveBeenCalled();
    expect(watcher.pendingFiles.size).toBe(0);
  });
});
```

#### 4.5.2 handleFileChange (2 用例)

```javascript
describe('handleFileChange', () => {
  test('排除文件 → 不加入 pendingFiles', () => {
    const { shouldSkipFile } = await import('../lib/privacy-filter.js');
    shouldSkipFile.mockReturnValueOnce({ skip: true, reason: 'excluded_file' });

    const watcher = new FileWatcher('/project');
    watcher.handleFileChange('.env');

    expect(watcher.pendingFiles.size).toBe(0);
  });

  test('正常文件 → 加入 pendingFiles + 设置 debounce timer', () => {
    jest.useFakeTimers();
    const watcher = new FileWatcher('/project');
    watcher.handleFileChange('src/index.js');

    expect(watcher.pendingFiles.has('/project/src/index.js')).toBe(true);
    expect(watcher.debounceTimer).not.toBeNull();

    // 快进 300ms 后 processPendingFiles 被调用
    const processSpy = jest.spyOn(watcher, 'processPendingFiles');
    jest.advanceTimersByTime(300);
    expect(processSpy).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
```

---

### P2-2: `tests/test-tree-sitter-ci-safe.test.js` (~3 用例)

**目标**: CI 环境下验证 Tree-sitter 错误处理降级路径
**依赖**: jest mock (tree-sitter WASM)
**后端**: 不需要

#### 4.6.1 不支持语言降级 (1 用例)

```javascript
describe("Tree-sitter CI-safe", () => {
  test("不支持的语言 → 返回空结果而非崩溃", async () => {
    // 在 CI 环境中 tree-sitter WASM 可能不可用
    // analyzeWithQuery 对不支持语言应返回空结果
    const result = await analyzeWithQuery(
      "test.xyz",
      "some content",
      "unknown",
    );
    expect(result).toBeDefined();
    expect(result.language).toBe("unknown");
    expect(result.functions).toEqual([]);
    expect(result.classes).toEqual([]);
  });
});
```

#### 4.6.2 空内容不崩溃 (1 用例)

```javascript
test("空字符串/undefined → 不崩溃，返回空结果", async () => {
  const result1 = await analyzeWithQuery("test.js", "", "javascript");
  expect(result1).toBeDefined();
  expect(result1.functions).toEqual([]);

  const result2 = await analyzeWithQuery("test.js", undefined, "javascript");
  expect(result2).toBeDefined();
});
```

#### 4.6.3 WASM 不可用降级 (1 用例)

```javascript
test("WASM 加载失败 → 返回空结果而非抛异常", async () => {
  // Mock tree-sitter WASM 加载失败
  jest.mock("../lib/tree-sitter-parser.js", () => ({
    analyzeWithQuery: jest
      .fn()
      .mockRejectedValue(new Error("WASM not available")),
  }));

  const { analyzeWithQuery } = await import("../lib/tree-sitter-parser.js");
  // 实际代码应 catch 此异常并返回空结果
  // 如果当前代码不 catch，此测试会 fail → 提示需要添加 try/catch
  try {
    const result = await analyzeWithQuery(
      "test.py",
      'print("hello")',
      "python",
    );
    expect(result).toBeDefined();
  } catch {
    // 如果抛异常，说明需要添加 WASM 降级逻辑
    expect(true).toBe(false); // 显式 fail，提示需要修复
  }
});
```

---

## 5. 汇总

| 优先级   | 文件                                   | 新增用例 | 依赖                   | Bug 修复         |
| -------- | -------------------------------------- | -------- | ---------------------- | ---------------- |
| **P0-1** | `test-analysis-queue-core.test.js`     | ~20      | jest mock (6 个)       | 无               |
| **P0-2** | `test-memory-id-cache.test.js`         | ~25      | temp 目录 + fakeTimers | 无               |
| **P1-1** | `test-privacy-filter-extended.test.js` | ~28      | 无                     | validateFileSize |
| **P1-2** | `test-code-analysis-formatter.test.js` | ~15      | 无                     | 无               |
| P2-1     | `test-file-watcher.test.js`            | ~4       | chokidar mock          | 无               |
| P2-2     | `test-tree-sitter-ci-safe.test.js`     | ~3       | WASM mock              | 无               |
| **合计** | **6 个文件**                           | **~95**  |                        | **1 个**         |

**总用例数**: 现有 ~98 + 新增 ~95 = **~193**

## 6. 执行顺序

1. 修复 `privacy-filter.js` validateFileSize bug（1 行改动）
2. P0-1: AnalysisQueue 核心测试
3. P0-2: MemoryIdCache 测试
4. P1-1: PrivacyFilter 扩展测试
5. P1-2: Formatter 测试
6. P2: FileWatcher + Tree-sitter CI-safe

每个文件独立，可并行开发和执行。

## 7. 验证标准

- 所有测试 `npm test` 通过
- 无 lint 错误 (`npm run lint`)
- 新增测试覆盖所有零测公共方法
- 无临时文件泄漏（afterEach 清理 temp 目录）
