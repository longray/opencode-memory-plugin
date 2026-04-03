# API Contract - 工具↔后端映射

> 工具与后端 API 的对应关系，供开发者参考

**更新时间**: 2026-03-28

---

## 后端信息

| 项目     | 值                             |
| -------- | ------------------------------ |
| 地址     | `localhost:17999`              |
| API 前缀 | `/api/v1`                      |
| 认证     | `WRAPPER_MEILI_API_KEY` Header |
| 文档     | `http://localhost:17999/docs`  |

---

## 本地工具（不依赖后端）

| 工具            | 文件            | 说明                    |
| --------------- | --------------- | ----------------------- |
| memory_write    | tools/core.js   | 写入本地文件 + 同步后端 |
| memory_read     | plugin.js       | 读取本地文件            |
| memory_suggest  | tools/search.js | Trie 索引本地搜索       |
| memory_timeline | tools/browse.js | 读取 link-map.json      |
| memory_topics   | tools/browse.js | 读取 link-map.json      |

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
