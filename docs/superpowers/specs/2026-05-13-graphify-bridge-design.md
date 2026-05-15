# Graphify Bridge 设计文档

**日期**: 2026-05-13
**版本**: v1.2 (代码审查修复)
**作者**: 插件端
**状态**: ✅ 已实现

---

## 1. 概述

### 1.1 问题

当前自研 Oxc 代码分析器存在严重的**架构代差**：

| 指标               | Oxc (当前) | Graphify |
| ------------------ | ---------- | -------- |
| 孤立率             | 42%        | 0.2%     |
| calls 边           | 37         | 647      |
| method 边          | 0          | 309      |
| imports 边         | 0          | 587      |
| contains 边        | 0          | 2156     |
| 跨文件调用         | 不支持     | 174 条   |
| this.method() 解析 | 不支持     | 309 条   |

### 1.2 方案

开发 `graphify-bridge.js` 桥接模块，将 [graphify](https://github.com/safishamsi/graphify) 的 `graph.json` 产出完整导入 SurrealDB。

**核心原则**：

- graphify 是**唯一代码分析入口**，`uploadProject()` 删除，`graphifyProject()` 替代
- graphify 未安装 → 报错退出，不降级到 Oxc
- **不向后兼容**

### 1.3 范围

- **插件端**：`graphify-bridge.js` + `graphifyProject()` + CLI 命令
- **后端**：7 项 schema 变更（已请求，部分已部署）

---

## 2. 架构

### 2.1 整体流程

```
用户触发 graphifyProject()
  │
  ├─ 1. 检查 graphify 安装 (python -m graphify --version)
  │     └─ 未安装 → 抛错退出
  │
  ├─ 2. 运行 graphify (python -m graphify update {projectPath})
  │     └─ 产出 graphify-out/graph.json
  │
  ├─ 3. 导入前清理：删除该项目旧的 Entity/Atom/Reference
  │     └─ 按 project 字段过滤，全量删除
  │
  ├─ 4. graphify-bridge.js 解析 graph.json
  │     ├─ 4a. 构建 node 映射表 (graphifyId → {role, ourId})
  │     ├─ 4b. 批量创建 Entities (文件级 node)
  │     ├─ 4c. 批量创建 Atoms (符号级 node)
  │     ├─ 4d. 并发创建 References (links, 10 并发)
  │     └─ 4e. 返回统计报告
  │
  └─ 5. 返回导入结果
```

### 2.2 文件位置

```
opencode-memory-plugin/lib/
  ├── graphify-bridge.js      # 新增：桥接核心逻辑
  ├── code-analysis-service.js # 修改：uploadProject() → graphifyProject()
  └── wrapper-client.js       # 修改：新增 confidence/confidence_score/norm_label 参数
```

---

## 3. 数据模型映射

### 3.1 Node → Entity / Atom 判定规则

graphify 的 node 有两种语义角色，通过字段组合判定：

| 条件                                                 | 角色       | 映射目标 |
| ---------------------------------------------------- | ---------- | -------- |
| `source_location` 缺失 或 `source_location` 为空     | 文件级节点 | Entity   |
| `source_location` 存在（如 `"L206"`, `"LL206-230"`） | 符号级节点 | Atom     |

**例外**：`file_type: "document"` 的文件级节点也映射为 Entity（Markdown 文档），其子节点映射为 Atom（章节）。

### 3.2 Node 字段映射

#### 3.2.1 Entity 映射

| graphify 字段 | 典型值                    | Entity 字段  | 转换规则                                                       |
| ------------- | ------------------------- | ------------ | -------------------------------------------------------------- |
| `source_file` | `"lib/wrapper-client.js"` | `file_path`  | 直接使用                                                       |
| `file_type`   | `"code"` / `"document"`   | `type`       | 直接使用                                                       |
| `label`       | `"wrapper-client.js"`     | `abstract`   | 从 children 统计生成：`"lib/wrapper-client.js: 15 fns, 3 cls"` |
| `community`   | `42`                      | `tags`       | `["community:42"]`                                             |
| `norm_label`  | `"wrapper-client.js"`     | `norm_label` | 直接使用                                                       |
| —             | —                         | `project`    | 从 package.json 读取                                           |
| —             | —                         | `language`   | 从 file_path 后缀推断                                          |
| —             | —                         | `created_by` | 固定 `"graphify"`                                              |

#### 3.2.2 Atom 映射

| graphify 字段     | 典型值                         | Atom 字段                 | 转换规则                                                                   |
| ----------------- | ------------------------------ | ------------------------- | -------------------------------------------------------------------------- |
| `label`           | `"tokenize()"` / `"BM25Index"` | `name`                    | `label.replace(/\(\)$/, '')` 去除末尾括号                                  |
| `label`           | `"tokenize()"` / `"BM25Index"` | `type`                    | 带 `()` → `"function"`，首字母大写+无括号 → `"class"`，其他 → `"function"` |
| `source_file`     | `"lib/bm25.js"`                | `metadata.source_file`    | 直接使用                                                                   |
| `source_location` | `"L206"` / `"LL206-230"`       | `start_line` / `end_line` | 正则解析：`L(\d+)` → start_line；`LL(\d+)-(\d+)` → start_line + end_line   |
| `community`       | `42`                           | `metadata.community`      | 直接使用                                                                   |
| `norm_label`      | `"tokenize()"`                 | `norm_label`              | 直接使用                                                                   |
| —                 | —                              | `project`                 | 从 package.json 读取                                                       |

**Atom type 推断规则**：

```javascript
function inferAtomType(label) {
  if (label.endsWith("()")) return "function";
  if (/^[A-Z]/.test(label) && !label.includes("(")) return "class";
  return "function";
}
```

### 3.3 Link 字段映射 → Reference

| graphify 字段      | 典型值                       | Reference 字段     | 转换规则                                                |
| ------------------ | ---------------------------- | ------------------ | ------------------------------------------------------- |
| `source`           | `"plugin_js"`                | `from_id`          | 通过映射表查找 `entity:xxx` / `atom:xxx`                |
| `target`           | `"tools_core_memory_write"`  | `to_id`            | 同上                                                    |
| `relation`         | `"calls"` / `"method"` / ... | `type`             | 直接使用（见边类型映射表）                              |
| `confidence`       | `"EXTRACTED"` / `"INFERRED"` | `confidence`       | 直接使用                                                |
| `confidence_score` | `1.0` / `0.8`                | `confidence_score` | 直接使用                                                |
| `source_file`      | `"lib/wrapper-client.js"`    | `file_path`        | 直接使用                                                |
| `source_location`  | `"L15"`                      | `line`             | 正则解析 `L(\d+)` → 数字                                |
| `context`          | `"import"` / `undefined`     | `metadata.context` | 直接使用                                                |
| —                  | —                            | `weight`           | **不自使用** graphify 的 weight（恒为 1），按规则自设   |
| —                  | —                            | `description`      | 桥接生成：`"{relation}: {sourceLabel} → {targetLabel}"` |

### 3.4 边类型映射

| graphify relation | 数量 | → Reference.type | 双重映射                                   |
| ----------------- | ---- | ---------------- | ------------------------------------------ |
| `calls`           | 647  | `calls`          | 无                                         |
| `contains`        | 2156 | `contains`       | ✅ 同时建立 Entity.atoms[] 关联            |
| `imports`         | 331  | `imports`        | 无                                         |
| `imports_from`    | 256  | `imports_from`   | 无                                         |
| `method`          | 309  | `method`         | 无（Atom 已通过 contains 关联到同 Entity） |

**双重映射说明**：

1. **contains 边**：创建 Reference(type=contains)，Atom 通过此 Reference 关联到 Entity
2. **method 边**：仅创建 Reference(type=method)。Atom 已通过 contains 边关联到同一个 Entity，不需要额外 parent_id 操作

### 3.5 Weight 自设规则

graphify 的 weight 恒为 1，无信息量。桥接时按 relation × confidence 自设：

| relation       | confidence | weight | 理由                            |
| -------------- | ---------- | ------ | ------------------------------- |
| `contains`     | EXTRACTED  | 1.0    | 确定性包含，最强                |
| `method`       | EXTRACTED  | 0.9    | 类方法，强关联                  |
| `imports`      | EXTRACTED  | 0.8    | 符号级导入                      |
| `imports_from` | EXTRACTED  | 0.8    | 文件级导入                      |
| `calls`        | EXTRACTED  | 0.7    | 确定性调用                      |
| `calls`        | INFERRED   | 0.5    | 推断调用（this.method()），降权 |

---

## 4. graphify-bridge.js 核心模块设计

### 4.1 模块 API

```javascript
/**
 * Graphify Bridge - 将 graph.json 导入 SurrealDB
 * @param {Object} options
 * @param {string} options.projectPath - 项目根路径
 * @param {string} options.projectId - 项目 ID
 * @param {WrapperClient} options.client - API 客户端
 * @param {string} options.tenantId - 租户 ID
 * @returns {Promise<ImportResult>}
 */
export async function importGraphJSON(options) {}

/**
 * 检查 graphify 是否安装
 * @returns {Promise<{installed: boolean, version: string}>}
 */
export async function checkGraphifyInstalled() {}

/**
 * 运行 graphify update
 * @param {string} projectPath
 * @returns {Promise<{success: boolean, outputPath: string}>}
 */
export async function runGraphify(projectPath) {}
```

### 4.2 导入流程（伪代码）

```javascript
async function importGraphJSON(options) {
  const { projectPath, projectId, client, tenantId } = options;

  // Step 1: 读取 graph.json
  const graphPath = path.join(projectPath, "graphify-out", "graph.json");
  const graph = JSON.parse(await fs.readFile(graphPath, "utf-8"));

  // Step 2: 分类 nodes（Entity vs Atom）
  const { entityNodes, atomNodes } = classifyNodes(graph.nodes);

  // Step 3: 导入前清理该项目旧数据
  await client.deleteByProject(projectId, tenantId);

  // Step 4: 批量创建 Entities
  const entityMap = new Map(); // graphifyId → ourEntityId (entity:xxx)
  const entityBatch = entityNodes.map((node) =>
    buildEntityPayload(node, projectId, tenantId),
  );
  const entityResults = await client.batchCreateEntities(entityBatch);
  // 按 source_file 匹配建立 entityMap...

  // Step 5: 批量创建 Atoms（独立创建，不关联 Entity）
  const atomMap = new Map(); // graphifyId → ourAtomId (atom:xxx)
  const atomBatch = atomNodes.map((node) =>
    buildAtomPayload(node, projectId, tenantId),
  );
  const atomResults = await client.batchCreateAtoms(atomBatch);
  // 按顺序匹配建立 atomMap...

  // Step 6: 并发创建 References（10 并发，Semaphore 控制）
  const linkQueue = graph.links.map((link) => () => {
    const fromId = resolveId(link.source, entityMap, atomMap);
    const toId = resolveId(link.target, entityMap, atomMap);
    if (!fromId || !toId) return null; // 跳过无法解析的边

    const refPayload = buildReferencePayload(link, fromId, toId, tenantId);
    return client.createRelation(refPayload);
  });
  const refResults = await runConcurrent(linkQueue, { concurrency: 10 });

  // Step 7: 返回统计
  return {
    entities: entityNodes.length,
    atoms: atomNodes.length,
    references: graph.links.length,
    byRelation: countByRelation(graph.links),
    errors: countErrors(refResults),
  };
}
```

> **注意**：Atom 和 Entity 的关联通过 `contains` Reference 建立，而非 Atom 的某个 parent 字段。
> `batchCreateAtoms` 创建的 Atom 是独立的，后续创建 `contains` Reference 时建立关联。

### 4.3 Node 分类逻辑

```javascript
function classifyNodes(nodes) {
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
```

### 4.4 Entity 查找父级（用于 ID 映射验证）

Atom 不需要知道 parent Entity ID（关联通过 contains Reference 建立）。
但 ID 映射表需要能通过 `source_file` 反查 Entity：

```javascript
function buildSourceFileIndex(entityMap) {
  // source_file → graphifyId 的反向索引
  const index = new Map();
  for (const [graphifyId, data] of entityMap) {
    if (data.source_file) {
      index.set(data.source_file, graphifyId);
    }
  }
  return index;
}
```

### 4.5 source_location 解析

```javascript
function parseSourceLocation(loc) {
  if (!loc) return {};

  // "LL206-230" → { start_line: 206, end_line: 230 }
  const rangeMatch = loc.match(/^LL(\d+)-(\d+)$/);
  if (rangeMatch) {
    return { start_line: +rangeMatch[1], end_line: +rangeMatch[2] };
  }

  // "L206" → { start_line: 206 }
  const lineMatch = loc.match(/^L(\d+)$/);
  if (lineMatch) {
    return { start_line: +lineMatch[1] };
  }

  return {};
}
```

### 4.6 语言检测

```javascript
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

function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return LANG_MAP[ext] || "unknown";
}
```

### 4.7 并发控制

graphify 使用 `{filepath}_{classname}_{methodname}` 格式的 ID，我们使用 SurrealDB 的 ULID。桥接维护两个映射表：

```javascript
// graphifyId → ourId (entity:xxx 或 atom:xxx)
const entityMap = new Map(); // 文件级 node 的映射
const atomMap = new Map(); // 符号级 node 的映射

// 解析 link 的 source/target
function resolveId(graphifyId, entityMap, atomMap) {
  // 先查 atom（更精确），再查 entity
  return atomMap.get(graphifyId) || entityMap.get(graphifyId) || null;
}
```

---

## 5. graphifyProject() 命令

### 5.1 函数签名

```javascript
/**
 * 使用 graphify 分析项目并导入 SurrealDB
 * @param {Object} options
 * @param {string} options.projectPath - 项目根路径（默认 process.cwd()）
 * @param {boolean} options.skipGraphify - 跳过 graphify 运行，直接导入已有 graph.json
 * @returns {Promise<ImportResult>}
 */
async function graphifyProject(options = {}) {}
```

### 5.2 调用流程

```javascript
async function graphifyProject(options = {}) {
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
    const { success, outputPath } = await runGraphify(projectPath);
    if (!success) {
      throw new Error("graphify 运行失败");
    }
  }

  // 3. 导入 graph.json
  const config = getConfig();
  const client = new WrapperClient(config);
  const projectId = await resolveProjectId(projectPath);

  return await importGraphJSON({
    projectPath,
    projectId,
    client,
    tenantId: config.backend?.tenant_id || process.env.USERNAME,
  });
}
```

### 5.3 CLI 集成

在 `cli/index.cjs` 中新增 `graphify` 命令：

```bash
# 使用方式
opencode-memory graphify                    # 分析当前项目
opencode-memory graphify --project /path    # 分析指定项目
opencode-memory graphify --skip-graphify    # 跳过运行，直接导入已有 graph.json
```

---

## 6. 废弃模块

以下模块将在 graphify-bridge.js 完成后废弃：

| 文件                          | 当前职责             | 废弃原因                       |
| ----------------------------- | -------------------- | ------------------------------ |
| `lib/code-analyzer.js`        | Oxc AST 分析         | graphify 的 tree-sitter 更强大 |
| `lib/tree-sitter-parser.js`   | 多语言 AST 解析      | graphify 内置 tree-sitter      |
| `lib/relation-recommender.js` | 推荐关系（信号太弱） | graphify 直接提取关系          |
| `lib/fix-engine.js`           | 只诊断不修复         | graphify 解决了根因            |

**废弃方式**：不删除文件，在文件头部添加 `@deprecated` 注释，从 `code-analysis-service.js` 的 import 中移除。

---

## 7. 后端依赖

### 7.1 已部署 ✅

| 变更                | 状态      |
| ------------------- | --------- |
| `entity.norm_label` | ✅ 已生效 |
| `atom.norm_label`   | ✅ 已生效 |

### 7.2 部分部署 ⚠️

| 变更                         | 状态                                   | 说明       |
| ---------------------------- | -------------------------------------- | ---------- |
| `ReferenceType.method`       | ⚠️ 枚举已生效，SurrealDB ASSERT 未更新 | 500 错误   |
| `ReferenceType.imports_from` | ⚠️ 同上                                | 500 错误   |
| `reference.confidence`       | ⚠️ 字段存在但存为 null                 | 写入未生效 |
| `reference.confidence_score` | ⚠️ 同上                                | 写入未生效 |

### 7.3 降级策略

如果后端 `method` / `imports_from` 短期内无法修复：

1. `method` 边 → 仍创建 Atom parent-child 关系（不创建 Reference）
2. `imports_from` 边 → 降级为 `imports` 类型（丢失粒度区分）
3. `confidence` / `confidence_score` → 存入 `metadata` 字段（临时方案）

---

## 8. 错误处理

| 错误场景            | 处理方式                               |
| ------------------- | -------------------------------------- |
| graphify 未安装     | 抛错退出，提示 `pip install graphifyy` |
| graphify 运行失败   | 抛错退出，输出 stderr                  |
| graph.json 不存在   | 抛错退出，提示先运行 graphify          |
| graph.json 格式错误 | 抛错退出，输出解析错误详情             |
| Entity 创建失败     | 跳过该 Entity，记录错误，继续          |
| Atom 创建失败       | 跳过该 Atom，记录错误，继续            |
| Reference 创建失败  | 跳过该 Reference，记录错误，继续       |
| 后端不可用          | 抛错退出，提示检查后端服务             |

**容错原则**：单个 Entity/Atom/Reference 创建失败不阻塞整个导入流程。最终报告包含成功数和失败数。

---

## 9. 性能预估

基于 opencode-memory-plugin 项目（2646 nodes + 3699 links）：

| 操作                    | 数量     | 预估耗时 | 优化                |
| ----------------------- | -------- | -------- | ------------------- |
| graphify 运行           | 181 文件 | 10-30s   | 无法优化            |
| 导入前清理              | ~3000 条 | <2s      | 按 project 批量删除 |
| batchCreateEntities     | ~181 个  | <1s      | 批量 API            |
| batchCreateAtoms        | ~2465 个 | <3s      | 批量 API            |
| createRelation (10并发) | ~3699 个 | ~20s     | Semaphore 并发      |

**总预估**：35-60 秒（含 graphify 运行）

---

## 10. 测试策略

### 10.1 单元测试

| 测试                      | 覆盖                                    |
| ------------------------- | --------------------------------------- |
| `classifyNodes()`         | 文件级 vs 符号级判定                    |
| `parseSourceLocation()`   | L206 / LL206-230 / 空 / 非法格式        |
| `inferAtomType()`         | function / class / 边界情况             |
| `buildEntityPayload()`    | 字段映射正确性                          |
| `buildAtomPayload()`      | 字段映射正确性                          |
| `buildReferencePayload()` | weight 自设规则 + confidence 传递       |
| `findParentEntity()`      | contains 边查找 + 降级 source_file 匹配 |

### 10.2 集成测试

| 测试         | 覆盖                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| 完整导入流程 | graph.json → SurrealDB 验证                                             |
| 孤立率验证   | 导入后确认 < 1%                                                         |
| 边完整性     | 647 calls + 309 method + 331 imports + 256 imports_from + 2156 contains |
| 双重映射     | method 边同时创建 Reference + Atom parent_id                            |

---

## 11. 风险与缓解

| 风险                   | 概率 | 影响                         | 缓解                                          |
| ---------------------- | ---- | ---------------------------- | --------------------------------------------- |
| graphify 不支持某语言  | 中   | 部分文件无法分析             | graphify 支持 JS/TS/Py/Go/Rust/Java，覆盖主流 |
| graph.json 格式变更    | 低   | 桥接解析失败                 | 版本检查 + 字段容错                           |
| 大型项目导入耗时过长   | 中   | 用户体验差                   | 进度回调 + batch API                          |
| 后端 schema 未完全部署 | 高   | method/imports_from 无法导入 | 降级策略（见 7.3）                            |

---

## 附录 A：graph.json 结构参考

```json
{
  "directed": true,
  "multigraph": false,
  "graph": {},
  "nodes": [
    {
      "id": "lib_wrapper-client_js",
      "label": "wrapper-client.js",
      "file_type": "code",
      "source_file": "lib/wrapper-client.js",
      "source_location": "",
      "community": 42,
      "norm_label": "wrapper-client.js"
    },
    {
      "id": "lib_wrapper-client_js_wrapperclient",
      "label": "WrapperClient",
      "file_type": "code",
      "source_file": "lib/wrapper-client.js",
      "source_location": "L25",
      "community": 42,
      "norm_label": "wrapperclient"
    }
  ],
  "links": [
    {
      "source": "lib_wrapper-client_js",
      "target": "lib_wrapper-client_js_wrapperclient",
      "relation": "contains",
      "confidence": "EXTRACTED",
      "confidence_score": 1.0,
      "weight": 1,
      "source_file": "lib/wrapper-client.js",
      "source_location": "L25",
      "context": "import"
    }
  ],
  "hyperedges": [],
  "built_at_commit": "96b33c5"
}
```

## 附录 B：wrapper-client.js 需修改的 API

| API                     | 修改内容                                                |
| ----------------------- | ------------------------------------------------------- |
| `createRelation()`      | 新增 `confidence`, `confidence_score` 参数              |
| `createEntity()`        | 新增 `norm_label` 参数                                  |
| `createAtom()`          | 新增 `norm_label` 参数                                  |
| `batchCreateEntities()` | 新增 `norm_label` 参数                                  |
| `batchCreateAtoms()`    | 新增 `norm_label` 参数                                  |
| `deleteByProject()`     | **新增**：按 project 批量删除 Entity + Atom + Reference |

## 附录 C：语义对齐审计结论

| graphify 字段                  | 我们的字段                              | 对齐        | 说明                           |
| ------------------------------ | --------------------------------------- | ----------- | ------------------------------ |
| `node.norm_label`              | `Entity.norm_label` / `Atom.norm_label` | ✅ 一致     | 仅做小写，用于搜索             |
| `link.confidence`              | `Reference.confidence`                  | ✅ 一致     | 分类标签（EXTRACTED/INFERRED） |
| `link.confidence_score`        | `Reference.confidence_score`            | ✅ 一致     | 数值置信度，与 weight 正交     |
| `link.weight`                  | `Reference.weight`                      | ❌ 冲突     | graphify 恒为 1，我们自设      |
| `link.relation` (calls)        | `Reference.type` (calls)                | ✅ 一致     |                                |
| `link.relation` (contains)     | `Reference.type` (contains)             | ✅ 一致     |                                |
| `link.relation` (imports)      | `Reference.type` (imports)              | ✅ 一致     | 符号级导入                     |
| `link.relation` (imports_from) | `Reference.type` (imports_from)         | ✅ 一致     | 文件级导入                     |
| `link.relation` (method)       | `Reference.type` (method)               | ✅ 一致     | 类→方法                        |
| `node.community`               | `Entity.tags`                           | ⚠️ 不同     | 社区是拓扑聚类，存为 tag       |
| `node.source_location`         | `Atom.start_line/end_line`              | ⚠️ 格式不同 | 需解析 L206 → 206              |
