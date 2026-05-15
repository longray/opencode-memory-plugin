# API Contract - 工具↔后端映射

> 工具与后端 API 的对应关系，供开发者参考

**更新时间**: 2026-05-15

---

## 后端信息

| 项目     | 值                             |
| -------- | ------------------------------ |
| 地址     | `localhost:18008`              |
| API 前缀 | `/api/v1`                      |
| 认证     | `WRAPPER_MEILI_API_KEY` Header |
| 文档     | `http://localhost:18008/docs`  |

**注意**: v3.2+ 端口已从 17999 迁移至 18008

---

## v3.3 Atom Architecture API (New)

### 统一搜索端点

| 项目        | 值                                                                 |
| ----------- | ------------------------------------------------------------------ |
| 工具文件    | `tools/search.js`                                                  |
| Client 方法 | `client.unifiedSearch()`                                           |
| HTTP        | `POST /api/v1/search`                                              |
| 参数        | `{query, mode, scope, types, atom_types, limit, level, tenant_id}` |
| 返回        | `{results: [EntityResult \| AtomResult], total, mode, query}`      |
| 状态        | ✅ v3.3 新增                                                       |

**EntityResult**:

```json
{
  "type": "entity",
  "id": "memory:01HQ...",
  "entity_type": "memory",
  "abstract": "...",
  "score": 0.95
}
```

**AtomResult**:

```json
{
  "type": "atom",
  "local_id": "01A1B2...",
  "atom_id": "atom:xxx",
  "atom_type": "chapter",
  "name": "Composition API",
  "entity_id": "memory:01HQ...",
  "score": 0.88
}
```

---

### Atom CRUD

| 操作 | HTTP | 路径                 | 状态             |
| ---- | ---- | -------------------- | ---------------- |
| 创建 | POST | `/api/v1/atoms`      | ✅ v3.3 扩展字段 |
| 更新 | PUT  | `/api/v1/atoms/{id}` | ✅ v3.3 扩展字段 |
| 查询 | GET  | `/api/v1/atoms/{id}` | ✅ v3.3 扩展字段 |

**v3.3 新增字段**:

- `tags`: list[str] - 标签列表
- `heading_level`: int (1-6) - 标题层级
- `parent_id`: str | null - 父 Atom ID
- `order`: str - 分数索引（如 "a0", "aV"）
- `aliases`: list[str] - 别名列表
- `entity_id`: str - 所属 Entity ID

---

---

## 本地工具（不依赖后端）

| 工具                | 文件            | 说明                                      |
| ------------------- | --------------- | ----------------------------------------- |
| memory_write        | tools/core.js   | 写入本地文件 + 同步后端                   |
| memory_pin          | tools/core.js   | 置顶/取消置顶条目                         |
| entity_update       | tools/core.js   | 批量 Atom 操作（add/update/remove）+ 同步 |
| entity_atoms        | tools/core.js   | 获取 Entity 的 Atom 树结构                |
| load_context_budget | tools/core.js   | 按 token 预算加载最相关的 Atom            |
| load_context_level  | tools/core.js   | 按层级过滤加载 Entity 上下文              |
| memory_read         | plugin.js       | 读取本地文件                              |
| memory_suggest      | tools/search.js | Trie 索引本地搜索                         |
| memory_timeline     | tools/browse.js | 读取 link-map.json                        |
| memory_topics       | tools/browse.js | 读取 link-map.json                        |

---

## 需要后端的工具

### memory_search

| 项目        | 值                                                                  |
| ----------- | ------------------------------------------------------------------- |
| 工具文件    | `tools/search.js`                                                   |
| Client 方法 | `client.search()`                                                   |
| HTTP        | `POST /api/v1/memories/search`                                      |
| 参数        | `{query, mode, limit, tenant_id, project_id}`                       |
| 返回        | `{results: [{id, abstract, overview, content, type, tags, score}]}` |
| 状态        | ✅ 正常                                                             |

---

### memory_relate

| 项目        | 值                                                                              |
| ----------- | ------------------------------------------------------------------------------- |
| 工具文件    | `tools/graph.js`                                                                |
| Client 方法 | `client.createRelation()` / `client.getRelations()` / `client.deleteRelation()` |
| HTTP        | `POST /api/v1/memories/relations`                                               |
|             | `POST /api/v1/memories/{id}/relations`                                          |
|             | `DELETE /api/v1/memories/relations/{id}`                                        |
| 状态        | ✅ 正常                                                                         |

---

### memory_graph

| 项目        | 值                                                        |
| ----------- | --------------------------------------------------------- |
| 工具文件    | `tools/graph.js`                                          |
| Client 方法 | `client.traverseGraph()`                                  |
| HTTP        | `POST /api/v1/memories/{id}/graph`                        |
| 参数        | `{depth, tenant_id}`                                      |
| 返回        | `{memories: [{id, abstract, ...}], total, source, depth}` |
| 状态        | ✅ 正常                                                   |

---

### index_status

| 项目        | 值                                                     |
| ----------- | ------------------------------------------------------ |
| 工具文件    | `tools/sync.js`                                        |
| Client 方法 | `client.getStatus()` / `client.health()`               |
| HTTP        | `GET /health`                                          |
| 返回        | `{status, memory_count, surrealdb, embedding_service}` |
| 状态        | ✅ 正常                                                |

---

### rebuild_index

| 项目        | 值                       |
| ----------- | ------------------------ |
| 工具文件    | `tools/sync.js`          |
| Client 方法 | `client.uploadMemory()`  |
| HTTP        | `POST /api/v1/memories`  |
| 说明        | 遍历未同步条目，逐个上传 |
| 状态        | ✅ 正常                  |

---

### sync_checkpoint

| 项目        | 值                                                 |
| ----------- | -------------------------------------------------- |
| 工具文件    | `tools/sync.js`                                    |
| Client 方法 | `client.getServerFingerprints()`                   |
| HTTP        | `GET /api/v1/sync/fingerprints?tenant_id=xxx`      |
| 返回        | `{fingerprints: [{path, mtime, hash, source_id}]}` |
| 状态        | ✅ 正常                                            |

---

### conflict_list

| 项目        | 值                                 |
| ----------- | ---------------------------------- |
| 工具文件    | `tools/sync.js`                    |
| Client 方法 | `client.listConflicts()`           |
| HTTP        | `POST /api/v1/sync/conflicts/list` |
| 参数        | `{tenant_id, limit}`               |
| 返回        | `[{id, description}]`              |
| 状态        | ✅ 正常（空列表）                  |

---

### incremental_sync ✅ 正常

| 项目        | 值                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 工具文件    | `tools/sync.js`                                                                                                                   |
| Client 方法 | `client.syncPreview(fingerprints, tenant_id)`                                                                                     |
| HTTP        | `POST /api/v1/sync/preview`                                                                                                       |
| 需要参数    | `{fingerprints: [{path, mtime, hash, source_id}], tenant_id}`                                                                     |
| 返回        | `{synced, to_upload: [{source_id, reason, path}], to_delete: [source_id], conflicts: [{id, source_id, local_hash, server_hash}]}` |
| 状态        | ✅ 正常                                                                                                                           |

---

### full_sync ✅ 正常

| 项目        | 值                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------- |
| 工具文件    | `tools/sync.js`                                                                                     |
| Client 方法 | `client.syncFull(memories, tenant_id)`                                                              |
| HTTP        | `POST /api/v1/sync/full`                                                                            |
| 参数        | `dry_run?: boolean`, `auto_clean?: boolean`                                                         |
| 需要参数    | `{memories: [{content, type, tags, local_id, ...}], tenant_id}`                                     |
| 返回        | `{total, success, failed, updated, skipped: [{local_id, existing_id, reason, similarity}], errors}` |
| 说明        | 后端 v2.4.0 新增 `skipped` 列表；`auto_clean=true` 时自动删除本地重复文件和 link-map 条目           |
| 状态        | ✅ 正常                                                                                             |

---

### conflict_resolve ✅ 正常

| 项目        | 值                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| 工具文件    | `tools/sync.js`                                                                                        |
| Client 方法 | `client.resolveConflict(conflict_id, resolution, tenant_id)`                                           |
| HTTP        | `POST /api/v1/sync/conflicts/{id}/resolve`                                                             |
| 需要参数    | `{resolution, tenant_id}`                                                                              |
| 说明        | 后端 v2.4.0 已支持大小写（`USE_LOCAL` / `use_local` 均可）；合法值：`use_local, use_remote, keep_both` |
| 状态        | ✅ 正常                                                                                                |

---

### batch_resolve ❌ 已移除

| 项目        | 值                                             |
| ----------- | ---------------------------------------------- |
| 工具文件    | 已删除                                         |
| Client 方法 | 已删除                                         |
| HTTP        | `POST /api/v1/sync/conflicts/batch-resolve`    |
| **问题**    | 后端 API 不存在（404），插件侧已移除工具和方法 |
| **Bug**     | BL-104（已关闭）                               |

---

## v3.3 插件端 Atom API (lib/memory-core.js)

### writeMemory (扩展)

| 项目     | 值                                                       |
| -------- | -------------------------------------------------------- |
| 文件     | `lib/memory-core.js`                                     |
| 导出     | `writeMemory({abstract, overview, content, atoms, ...})` |
| 新增参数 | `atoms: Array<Atom>` - Atom 树结构                       |
| 验证     | 自动检测循环引用 (detectCircularReference)               |
| 验证     | 自动检测悬挂引用 (detectDanglingReferences)              |
| 状态     | ✅ v3.3 扩展                                             |

**Atom 结构**:

```javascript
{
  local_id: "01ATOM001",        // ULID
  source_id: "01ATOM001",       // 与 local_id 相同
  atom_id: null,                // 同步后后端返回
  type: "chapter",              // chapter | section | function | ...
  name: "Chapter 1",            // 标题
  content: "...",               // 内容
  tags: ["tag1"],               // 标签
  aliases: ["Alias"],           // 别名
  order: "a0",                  // 分数索引
  heading_level: 1,             // 1-6
  parent_id: null,              // 父 Atom local_id
  children: []                  // 子 Atom 数组
}
```

---

### readMemory (扩展)

| 项目     | 值                                        |
| -------- | ----------------------------------------- |
| 文件     | `lib/memory-core.js`                      |
| 导出     | `readMemory({entry_id, level})`           |
| 自动检测 | 自动识别 Entity ID vs Atom local_id       |
| level    | 0=abstract, 1=overview, 2=full (含 atoms) |
| 返回     | `{type: "entity" \| "atom", ...}`         |
| 状态     | ✅ v3.3 扩展                              |

---

### updateEntity (新增)

| 项目     | 值                                                              |
| -------- | --------------------------------------------------------------- |
| 文件     | `lib/memory-core.js`                                            |
| 导出     | `updateEntity({entry_id, entity_updates, atoms_batch, client})` |
| 批量操作 | `atoms_batch: [{action, local_id, ...}]`                        |
| actions  | `add`, `update`, `remove`                                       |
| 级联删除 | `remove` 支持 `cascade: true` 删除子树                          |
| 状态     | ✅ v3.3 新增                                                    |

**entity_updates 字段**（可选，更新 Entity 级别的元数据）:

| 字段       | 类型       | 说明                |
| ---------- | ---------- | ------------------- |
| `abstract` | `string`   | L0 摘要             |
| `overview` | `string`   | L1 概览             |
| `content`  | `string`   | L2 完整内容         |
| `tags`     | `string[]` | 标签列表            |
| `meta`     | `object[]` | 元数据（JSON 数组） |

**atoms_batch 操作字段**:

| 字段            | 类型       | 适用 action  | 说明                        |
| --------------- | ---------- | ------------ | --------------------------- |
| `action`        | `string`   | 全部（必填） | `add` / `update` / `remove` |
| `local_id`      | `string`   | 全部（必填） | Atom 的 local ID            |
| `type`          | `string`   | add, update  | Atom 类型                   |
| `name`          | `string`   | add, update  | Atom 名称                   |
| `content`       | `string`   | add, update  | Atom 内容                   |
| `parent_id`     | `string`   | add, update  | 父 Atom local_id            |
| `order`         | `string`   | add, update  | 分数索引（如 "a0"）         |
| `heading_level` | `number`   | add, update  | 标题层级（1-4）             |
| `tags`          | `string[]` | add, update  | Atom 标签                   |
| `aliases`       | `string[]` | add, update  | Atom 别名                   |
| `cascade`       | `boolean`  | remove       | 是否级联删除子树            |

**返回值**:

```json
{
  "success": true,
  "entity_id": "01HQ...",
  "atoms_result": [
    { "action": "add", "local_id": "01NEW", "success": true },
    { "action": "update", "local_id": "01OLD", "success": true },
    {
      "action": "remove",
      "local_id": "01DEL",
      "success": true,
      "removed_count": 3
    }
  ],
  "synced": true,
  "memory_id": "mem_xxx",
  "warnings": ["⚠️ Warning: 1 dangling reference(s) detected"]
}
```

**示例**:

```javascript
// 添加新 Atom + 更新 Entity abstract
entity_update({
  entry_id: "01HQABC...",
  entity_updates: {
    abstract: "更新后的摘要",
    content: "更新后的完整内容",
    tags: ["updated-tag"],
    meta: [{ key: "value" }],
  },
  atoms_batch: [
    {
      action: "add",
      local_id: "01NEW001",
      type: "section",
      name: "新小节",
      content: "内容...",
    },
    { action: "update", local_id: "01OLD001", content: "更新后的内容" },
    { action: "remove", local_id: "01DEL001", cascade: true },
  ],
});
```

---

### getEntityAtoms (新增)

| 项目 | 值                                                            |
| ---- | ------------------------------------------------------------- |
| 文件 | `lib/memory-core.js`                                          |
| 导出 | `getEntityAtoms({entry_id, include_content})`                 |
| 参数 | `entry_id: string` — Entity ID（必填）                        |
| 参数 | `include_content: boolean` — 是否包含 Atom 内容（默认 false） |
| 返回 | `{success, entity_id, total_atoms, tree: [...]}`              |
| 状态 | ✅ v3.3 新增                                                  |

**返回值**:

```json
{
  "success": true,
  "entity_id": "01HQ...",
  "total_atoms": 12,
  "tree": [
    {
      "local_id": "01CHAP001",
      "type": "chapter",
      "name": "第1章：标题",
      "content": "章节内容...",
      "order": "a0",
      "heading_level": 1,
      "parent_id": null,
      "children": [
        {
          "local_id": "01SEC001",
          "type": "section",
          "name": "1.1 小节标题",
          "content": "小节内容...",
          "order": "a0",
          "heading_level": 2,
          "parent_id": "01CHAP001",
          "children": []
        }
      ]
    }
  ]
}
```

**示例**:

```javascript
// 获取 Atom 树（不含内容，用于导航）
entity_atoms({ entry_id: "01HQ...", include_content: false });

// 获取完整 Atom 树（含内容）
entity_atoms({ entry_id: "01HQ...", include_content: true });
```

---

### loadContextByBudget (新增)

| 项目 | 值                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 文件 | `lib/memory-core.js`                                                                                            |
| 导出 | `loadContextByBudget({entry_id, query, maxTokens, strategy})`                                                   |
| 参数 | `entry_id: string` — Entity ID（必填）                                                                          |
| 参数 | `query: string` — 当前查询，用于相关性评分（必填）                                                              |
| 参数 | `maxTokens: number` — token 预算上限（默认 2000）                                                               |
| 参数 | `strategy: string` — 选择策略：`relevance`（BM25+标题）/ `hierarchy`（层级优先）                                |
| 返回 | `{success, selected_atoms, total_atoms, selected_count, used_tokens, max_tokens, strategy, budget_utilization}` |
| 状态 | ✅ v3.3 新增                                                                                                    |

**选择策略**:

| 策略        | 说明                                                            |
| ----------- | --------------------------------------------------------------- |
| `relevance` | 按 BM25 + 标题相似度排序，贪心选取最相关的 Atom                 |
| `hierarchy` | 优先选取高层级 Atom（chapter > section > note），同层级按相关性 |

**返回值**:

```json
{
  "success": true,
  "entry_id": "01HQ...",
  "selected_atoms": [
    {
      "local_id": "01SEC001",
      "name": "1.1 setup() 函数",
      "type": "section",
      "content": "详细说明...",
      "relevance_score": 0.85,
      "heading_level": 2,
      "order": "a0"
    }
  ],
  "total_atoms": 45,
  "selected_count": 8,
  "used_tokens": 1856,
  "max_tokens": 2000,
  "strategy": "relevance",
  "budget_utilization": 93
}
```

**示例**:

```javascript
// 按 token 预算加载最相关的 Atom
load_context_budget({
  entry_id: "01HQ...",
  query: "setup 函数如何使用",
  max_tokens: 2000,
  strategy: "relevance",
});

// 按层级优先加载
load_context_budget({
  entry_id: "01HQ...",
  query: "项目架构",
  max_tokens: 4000,
  strategy: "hierarchy",
});
```

---

### loadContextByLevel (新增)

| 项目 | 值                                                                                     |
| ---- | -------------------------------------------------------------------------------------- |
| 文件 | `lib/memory-core.js`                                                                   |
| 导出 | `loadContextByLevel({entry_id, maxLevel, includeBreadcrumbs})`                         |
| 参数 | `entry_id: string` — Entity ID（必填）                                                 |
| 参数 | `maxLevel: number` — 最大 heading_level（1=仅章节, 2=章节+小节, 3=全部细节，默认 2）   |
| 参数 | `includeBreadcrumbs: boolean` — 是否包含父链面包屑（默认 true）                        |
| 返回 | `{success, entry_id, filtered_tree, markdown, total_atoms, filtered_count, max_level}` |
| 状态 | ✅ v3.3 新增                                                                           |

**层级映射**:

| maxLevel | 保留内容                         | 典型用途     |
| -------- | -------------------------------- | ------------ |
| 1        | 仅 chapter（heading_level=1）    | 快速概览大纲 |
| 2        | chapter + section（≤2）          | 标准阅读     |
| 3        | chapter + section + detail（≤3） | 完整阅读     |

**返回值**:

```json
{
  "success": true,
  "entry_id": "01HQ...",
  "filtered_tree": [...],
  "markdown": "# 第1章：标题\n\n> 第1章：标题\n\n章节内容...\n\n## 1.1 小节\n\n> 第1章：标题 > 1.1 小节\n\n小节内容...",
  "total_atoms": 45,
  "filtered_count": 12,
  "max_level": 2,
  "include_breadcrumbs": true
}
```

**示例**:

```javascript
// 仅获取章节标题（大纲模式）
load_context_level({ entry_id: "01HQ...", max_level: 1 });

// 获取章节+小节（标准模式，含面包屑）
load_context_level({
  entry_id: "01HQ...",
  max_level: 2,
  include_breadcrumbs: true,
});

// 获取全部细节
load_context_level({ entry_id: "01HQ...", max_level: 3 });
```

---

### markDeadLinks (新增)

| 项目 | 值                          |
| ---- | --------------------------- |
| 文件 | `lib/memory-core.js`        |
| 导出 | `markDeadLinks({entry_id})` |
| 功能 | 检测并标记悬挂 wiki 链接    |
| 状态 | ✅ v3.3 新增                |

---

### extractWikiLinks / findIncomingLinks

| 项目 | 值                                                                |
| ---- | ----------------------------------------------------------------- | ---------------------- |
| 文件 | `lib/memory-core.js`                                              |
| 导出 | `extractWikiLinks(content)`, `findIncomingLinks(atoms, targetId)` |
| 语法 | `[[target]]`, `[[target                                           | label]]`, `![[embed]]` |
| 状态 | ✅ v3.3 新增                                                      |

---

## WrapperClient 方法完整列表

| 方法                      | HTTP                                     | 用途                          | 状态 |
| ------------------------- | ---------------------------------------- | ----------------------------- | ---- |
| `health()`                | GET /health                              | 健康检查                      | ✅   |
| `isHealthy()`             | -                                        | 包装 health()                 | ✅   |
| `getStatus()`             | GET /health                              | 状态信息                      | ✅   |
| `search()`                | POST /api/v1/memories/search             | 搜索                          | ✅   |
| `uploadMemory()`          | POST /api/v1/memories                    | 上传单条                      | ✅   |
| `uploadMemories()`        | POST /api/v1/memories                    | 上传多条                      | ✅   |
| `createRelation()`        | POST /api/v1/memories/relations          | 创建关系                      | ✅   |
| `getRelations()`          | POST /api/v1/memories/{id}/relations     | 查询关系                      | ✅   |
| `deleteRelation()`        | DELETE /api/v1/memories/relations/{id}   | 删除关系                      | ✅   |
| `traverseGraph()`         | POST /api/v1/memories/{id}/graph         | 图遍历                        | ✅   |
| `syncPreview()`           | POST /api/v1/sync/preview                | 同步预览                      | ✅   |
| `syncFull()`              | POST /api/v1/sync/full                   | 全量同步（返回 skipped 列表） | ✅   |
| `getServerFingerprints()` | GET /api/v1/sync/fingerprints            | 获取指纹                      | ✅   |
| `resolveConflict()`       | POST /api/v1/sync/conflicts/{id}/resolve | 解决冲突（大小写不敏感）      | ✅   |
| `listConflicts()`         | POST /api/v1/sync/conflicts/list         | 冲突列表                      | ✅   |
| `reportAccessLog()`       | POST /api/v1/access-log                  | 访问日志                      | ✅   |

### 后端 v2.4.0 变更记录

| 变更                                                | 影响                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/api/v1/sync/incremental` → `/api/v1/sync/preview` | 旧路由保留为别名，插件无需改动                                                    |
| `SyncFullResponse` 新增 `skipped` 列表              | `skipped: [{local_id, existing_id, reason, similarity}]`，`errors` 仅保留真正异常 |
| `SyncFullResponse` 新增 `updated` 字段              | 返回被更新的条目数                                                                |
| conflict resolution 大小写兼容                      | `USE_LOCAL` / `use_local` 均可                                                    |

---

## 代码分析 API（新增）

### uploadCodeAnalysis

| 项目        | 值                                                          |
| ----------- | ----------------------------------------------------------- |
| 工具文件    | lib/code-analysis-service.js                                |
| Client 方法 | client.uploadCodeAnalysis() / client.uploadMemories()       |
| HTTP        | POST /api/v1/memories                                       |
| 参数        | {type: 'code', content, abstract, overview, tags, metadata} |
| 返回        | {success, id, source_id}                                    |
| 说明        | 代码分析结果通过标准 memory 接口上传，type 标记为 'code'    |
| 状态        | ✅ 正常                                                     |

---

### createCallRelations

| 项目        | 值                                                                       |
| ----------- | ------------------------------------------------------------------------ |
| 工具文件    | lib/wrapper-client.js                                                    |
| Client 方法 | client.createCallRelations()                                             |
| HTTP        | POST /api/v1/calls/batch                                                 |
| 参数        | {calls: [{caller_memory_id, callee_memory_id, line, column, file_path}]} |
| 返回        | {success, created, errors}                                               |
| 说明        | 批量创建函数调用关系，需要 memory_id 而非 file_path                      |
| 状态        | ✅ 正常                                                                  |

---

### lookupMemory

| 项目        | 值                                                                             |
| ----------- | ------------------------------------------------------------------------------ |
| 工具文件    | lib/wrapper-client.js                                                          |
| Client 方法 | client.lookupMemory()                                                          |
| HTTP        | GET /api/v1/memories/lookup                                                    |
| 参数        | {source_id, hash, file_path, project_id, type, tenant_id, limit, all}          |
| 返回        | {found: boolean, memory_id: string, source_id: string, file_path: string, ...} |
| 说明        | 根据唯一标识符快速查找记忆 ID，支持多种查询优先级                              |
| 状态        | ✅ 正常                                                                        |

---

### getCallReferences

| 项目        | 值                                                   |
| ----------- | ---------------------------------------------------- |
| 工具文件    | lib/wrapper-client.js                                |
| Client 方法 | client.getCallReferences()                           |
| HTTP        | GET /api/v1/memories/{memory_id}/references          |
| 参数        | memory_id (path), limit (query, default=50)          |
| 返回        | {references: [{memory_id, file_path, line, column}]} |
| 说明        | 查询谁调用了该函数（入站调用）                       |
| 状态        | ✅ 正常                                              |

---

### getCallDependencies

| 项目        | 值                                                     |
| ----------- | ------------------------------------------------------ |
| 工具文件    | lib/wrapper-client.js                                  |
| Client 方法 | client.getCallDependencies()                           |
| HTTP        | GET /api/v1/memories/{memory_id}/dependencies          |
| 参数        | memory_id (path), limit (query, default=50)            |
| 返回        | {dependencies: [{memory_id, file_path, line, column}]} |
| 说明        | 查询该函数调用了谁（出站调用）                         |
| 状态        | ✅ 正常                                                |

---

### getProjectMap

| 项目        | 值                                                     |
| ----------- | ------------------------------------------------------ |
| 工具文件    | lib/wrapper-client.js                                  |
| Client 方法 | client.getProjectMap()                                 |
| HTTP        | GET /api/v1/projects/{project_id}/map                  |
| 参数        | project_id (path)                                      |
| 返回        | {files: [], dependencies: [], hotspots: [], stats: {}} |
| 说明        | 获取项目代码地图（文件树、模块依赖、热点文件）         |
| 状态        | ✅ 正常                                                |

---

### getProjectStats

| 项目        | 值                                                                            |
| ----------- | ----------------------------------------------------------------------------- |
| 工具文件    | lib/wrapper-client.js                                                         |
| Client 方法 | client.getProjectStats()                                                      |
| HTTP        | GET /api/v1/projects/{project_id}/stats                                       |
| 参数        | project_id (path)                                                             |
| 返回        | {total_files, total_functions, total_classes, avg_complexity, max_complexity} |
| 说明        | 获取项目代码统计信息                                                          |
| 状态        | ✅ 正常                                                                       |

---

## Memory ID 缓存机制

### 设计说明

后端 `POST /api/v1/calls/batch` API 要求使用 `memory_id` 而非 `file_path` 来标识函数。前端需要维护本地缓存：

```
文件路径 → Memory ID 映射
src/utils.ts → 01H1ABC...
src/auth.ts → 01H2DEF...
```

### 缓存模块

| 模块          | 文件                             | 说明                        |
| ------------- | -------------------------------- | --------------------------- |
| MemoryIdCache | lib/memory-id-cache.js           | 内存缓存 + 持久化到本地文件 |
| 存储位置      | ~/.opencode/memory-id-cache.json | 项目级缓存文件              |
| 生命周期      | 与项目绑定                       | 随代码上传自动更新          |

### 使用流程

1. 分析代码文件
2. 上传代码分析结果 → 后端返回 memory_id
3. 保存 file_path → memory_id 映射到缓存
4. 提取调用关系（包含 file_path）
5. 查询缓存获取 caller/callee 的 memory_id
6. 调用 `POST /api/v1/calls/batch` 创建关系

---

## Graphify Bridge API

> graphify-bridge.js 使用以下后端 API 将 graph.json 导入 SurrealDB

### 批量创建 Entities

| 项目        | 值                                                                             |
| ----------- | ------------------------------------------------------------------------------ |
| 源文件      | `lib/graphify-bridge.js` → `lib/wrapper-client.js`                             |
| Client 方法 | `client.batchCreateEntities(entities)`                                         |
| HTTP        | `POST /api/v1/entities/batch`                                                  |
| 参数        | `{entities: [{type, abstract, file_path, language, project, tenant_id, ...}]}` |
| 返回        | `{entities: [{id, ...}], created, skipped, errors}`                            |
| 批量限制    | 100 条/请求                                                                    |

### 批量创建 Atoms

| 项目        | 值                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------- |
| 源文件      | `lib/graphify-bridge.js` → `lib/wrapper-client.js`                                           |
| Client 方法 | `client.batchCreateAtoms(atoms)`                                                             |
| HTTP        | `POST /api/v1/atoms/batch`                                                                   |
| 参数        | `{atoms: [{type, name, entity_id, content, start_line, end_line, project, tenant_id, ...}]}` |
| 返回        | `{atoms: [{id, status, sync_status}], created, skipped, errors}`                             |
| 批量限制    | 100 条/请求                                                                                  |

**注意**: `entity_id` 字段关联 atom 到所属 entity，支持 `entity_atoms` 查询。

### 创建单个 Reference

| 项目        | 值                                                                        |
| ----------- | ------------------------------------------------------------------------- |
| 源文件      | `lib/graphify-bridge.js` → `lib/wrapper-client.js`                        |
| Client 方法 | `client.createRelation(payload)`                                          |
| HTTP        | `POST /api/v1/references`                                                 |
| 参数        | `{from_id, to_id, type, weight, confidence, description, tenant_id, ...}` |
| 并发        | 10 并发（`runConcurrent`）                                                |

### 删除项目数据

| 项目        | 值                                            |
| ----------- | --------------------------------------------- |
| Client 方法 | `client.deleteByProject(projectId, tenantId)` |
| HTTP        | `DELETE /api/v1/entities/by-project/:id`      |

### Graphify 关系类型映射

| graphify relation   | Reference type | Weight | 说明               |
| ------------------- | -------------- | ------ | ------------------ |
| `contains`          | contains       | 1.0    | 文件包含函数/类    |
| `method`            | method         | 0.9    | this.method() 调用 |
| `imports`           | imports        | 0.8    | 模块导入           |
| `imports_from`      | imports_from   | 0.8    | 具名导入           |
| `calls` (EXTRACTED) | calls          | 0.7    | 函数调用（精确）   |
| `calls` (INFERRED)  | calls          | 0.5    | 函数调用（推断）   |
