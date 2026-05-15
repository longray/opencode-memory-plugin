## 1. Phase 1: Refs 批量化 + HTTP 连接复用

- [x] 1.0 验证 Open Questions：确认 `POST /api/v1/references/batch` 的 batch size 限制、后端并发能力上限
- [ ] 1.1 将 `importGraphJSON` 中 References 创建从逐个 `createRelation` + `runConcurrent(concurrency=10)` 改为 `createReferences()` 批量调用（100 条/批）
- [ ] 1.2 为 Refs 批量模式添加进度条（显示 batch 进度而非逐条进度）
- [ ] 1.3 添加批量 API 降级逻辑：`createReferences()` 失败时 fallback 到逐个 `createRelation()`
- [ ] 1.4 在 `wrapper-client.js` 中通过 `undici.Agent` + `setGlobalDispatcher()` 实现 HTTP Keep-Alive（Node.js 原生 fetch 不支持 `node:http.Agent`）
- [ ] 1.5 编写 Refs 批量化的单元测试（mock `createReferences`，验证批量拆分、降级逻辑）
- [ ] 1.6 E2E 验证：全量导入确认 Refs 耗时从 ~37s 降到 ~5s 以下

## 2. Phase 2: Atoms 并发 Batch

- [ ] 2.1 实现动态并发探测：前 3 个 atom batch 试并发 2，全部成功则保持，任一超时则降级串行
- [ ] 2.2 将 `importGraphJSON` 中 Atoms 的 `for` 串行循环改为 `runConcurrent` 并发 batch
- [ ] 2.3 添加并发探测日志：记录探测结果（"concurrency=2 confirmed" 或 "fallback to serial"）
- [ ] 2.4 编写并发 batch 的单元测试（mock 延迟，验证并发执行和降级行为）
- [ ] 2.5 E2E 验证：全量导入确认 Atoms 耗时从 ~174s 降到 ~90s 以下（并发 2）

## 3. Phase 3: 增量导入 — diff 算法与缓存

- [ ] 3.1 实现 `nodeHash(node)` 函数：`SHA-256(label + source_file + source_location + file_type)` 前 16 位
- [ ] 3.2 实现 `diffGraphs(oldGraph, newGraph)` 函数：返回 `{addedNodes, removedNodes, changedNodes, addedLinks, removedLinks, changedNodeIds}`（changedNodeIds 用于后续 link remapping）
- [ ] 3.3 实现 `loadCache(cachePath)` 和 `saveCache(cachePath, graph)` 函数（缓存路径：`graphify-out/.graphify-cache.json`）
- [ ] 3.4 实现 `importGraphJSONIncremental(options)` 函数：调用 diff → 删除 removed → 删除 changed old → 创建 added/changed new → remap changed node IDs → 重建 affected links
- [ ] 3.5 实现增量删除的级联逻辑：删除 Entity 时同时删除其 Atoms 和相关 References（优先使用后端级联删除 API，fallback 到查询+逐个删除）
- [ ] 3.6 实现 changed nodes ID remapping：维护 old_backend_id → new_backend_id 映射，重建引用了 changed nodes 的 links
- [ ] 3.6 编写 diff 算法的单元测试：覆盖 added/removed/changed/unchanged 所有场景
- [ ] 3.7 编写缓存管理的单元测试：覆盖创建/更新/损坏降级场景

## 4. Phase 3: CLI 集成

- [ ] 4.1 在 CLI `graphify` 命令中添加 `--incremental`（默认）和 `--full` 选项
- [ ] 4.2 实现 mode 选择逻辑：有缓存 → 增量，无缓存 → 全量，`--full` → 强制全量
- [ ] 4.3 适配进度条：增量模式显示变更数量而非全量数量
- [ ] 4.4 将 `graphify-out/.graphify-cache.json` 添加到 `.gitignore`
- [ ] 4.5 E2E 验证增量导入：修改 2 个文件后运行，确认只导入变更部分（~3-10s）

## 5. 后端协调

- [ ] 5.1 给后端写信：请求 `DELETE /api/v1/entities/{id}` 支持级联删除 Atoms 和 References
- [ ] 5.2 给后端写信：确认 `listAtoms` API 是否支持按 `entity_id` 过滤
- [ ] 5.3 确认 `POST /api/v1/references/batch` 的 batch size 限制

## 6. 文档更新

- [ ] 6.1 更新 `CHANGELOG.md`：添加 graphify-bridge 性能优化和增量导入条目
- [ ] 6.2 更新 `AGENTS.md`：CLI 选项、增量导入说明
- [ ] 6.3 更新 `docs/API-CONTRACT.md`：References 批量 API 使用说明
