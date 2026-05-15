## Why

Graphify Bridge 当前采用全量删除重建策略（`deleteByProject` → 全量导入），每次导入耗时 ~205s（2452 atoms, 2843 refs）。日常开发中通常只修改 3-5 个文件，却要每次全量重建，浪费 98%+ 的计算和网络资源。同时，References 使用逐个创建（并发 10）而非已有的批量 API，Atoms 串行 batch 未利用后端并发能力。

## What Changes

- **新增增量导入模式**：对比新旧 `graph.json` 的 diff，只导入新增/变更的 nodes 和 links，跳过未变更部分。本地缓存 `.graphify-cache.json` 保存上次导入状态
- **References 改用批量 API**：从逐个 `createRelation()` + 并发 10 改为 `createReferences()` 批量创建（100 条/批），消除 ~3400 次独立 HTTP 请求
- **Atoms 并发 batch**：从串行改为并发 2-3 个 batch，利用后端 batch embedding 优化后的并发能力
- **HTTP 连接复用**：添加 Keep-Alive Agent，减少 TCP 握手开销
- **CLI 新增 `--incremental` 选项**：默认增量，`--full` 强制全量

## Capabilities

### New Capabilities

- `graphify-incremental-import`: graph.json diff 算法、本地缓存管理、增量 entities/atoms/refs 创建与删除
- `graphify-batch-refs`: References 批量创建（替代逐个创建），含进度条适配
- `graphify-concurrent-atoms`: Atoms 并发 batch 创建，含后端并发能力探测

### Modified Capabilities

（无既有 spec 需要修改）

## Impact

- **代码**：`lib/graphify-bridge.js`（主要改动）、`lib/wrapper-client.js`（HTTP Agent）、`cli/index.mjs`（新增选项）
- **API**：使用已有的 `createReferences()` 批量 API，无需后端改动
- **缓存**：新增 `.graphify-cache.json` 本地文件（需 `.gitignore`）
- **测试**：新增 diff 算法、增量导入、并发 batch 的单元测试
- **性能**：Phase 1+2 全量导入 205s → ~65s，Phase 3 日常增量导入 ~3-10s（20-70x）
