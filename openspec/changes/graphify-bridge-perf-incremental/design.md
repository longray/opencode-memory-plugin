## Context

Graphify Bridge（`lib/graphify-bridge.js`）当前采用全量删除重建策略：
1. `deleteByProject` 删除项目所有数据
2. 串行 batch 创建 Entities（100/批）
3. 串行 batch 创建 Atoms（100/批）— 瓶颈，~174s
4. 逐个 `createRelation` + 并发 10 创建 References — ~37s

E2E 数据：205s / 200 entities / 2452 atoms / 2843 refs。
日常开发通常只修改 3-5 个文件（~2% 变更率），全量重建浪费 98% 资源。

后端已优化 batch embedding（6.3x 提升），具备并发处理能力。`wrapper-client.js` 已有 `createReferences()` 批量 API 但未被 graphify-bridge 使用。

## Goals / Non-Goals

**Goals:**

- Phase 1：Refs 批量化 + HTTP 连接复用，全量导入 205s → ~155s
- Phase 2：Atoms 并发 batch，全量导入 → ~65s
- Phase 3：增量导入，日常增量 → ~3-10s（20-70x 提升）
- 保持全量导入作为 fallback（`--full` 选项）
- CLI 用户体验不变（进度条、日志格式）

**Non-Goals:**

- 不修改后端 API（使用已有端点）
- 不引入本地 embedding（远期方向）
- 不修改 graphify Python 工具本身
- 不改变 graph.json 的数据格式

## Decisions

### D1: graph.json diff 作为增量检测手段

**选择**：对比新旧 `graph.json` 的 nodes/links，用 `node.id` 作为唯一键

**替代方案**：
- A) SHA-256 文件级指纹：粒度太粗，无法检测单个函数变更
- B) 后端查询对比：需 ~2600 次 API 调用，比全量还慢
- C) graphify 内置增量：需要修改 graphify Python 包，超出范围

**理由**：graphify 的 node ID 基于 `file_path + symbol_name`，在同一代码库中稳定。diff 算法在本地执行，零网络开销。

### D2: 本地 JSON 文件缓存

**选择**：`.graphify-cache.json` 存储上次 graph.json 的完整 nodes/links + 每个 node 的 content hash

**替代方案**：
- A) 只存 node ID 集合：无法检测 node 内容变更（如函数签名变化）
- B) SQLite 缓存：过重，JSON 文件对 2646 nodes 也就 ~2MB

**理由**：JSON 文件简单可靠，graphify 输出本身也是 JSON。缓存文件加入 `.gitignore`。

### D3: node hash 计算

**选择**：`SHA-256(label + source_file + source_location + file_type)` 截取前 16 位

**理由**：这些字段覆盖了 node 的核心身份和位置信息。`source_location` 变化意味着代码行号变更，需要重新导入。

### D4: References 改用 createReferences() 批量 API

**选择**：将 ~3400 个逐个 `createRelation` 调用改为 `createReferences()` 批量创建（100 条/批）

**理由**：
- `wrapper-client.js` 第 967 行已有 `createReferences()` 方法，调用 `POST /api/v1/references/batch`
- 从 ~3400 次 HTTP 请求降到 ~34 次，消除网络 I/O 瓶颈
- 无需后端改动

### D5: Atoms 并发 batch — 动态探测

**选择**：前 3 个 atom batch 试并发 2，全部成功则保持；任一超时则降级到串行

**理由**：之前测试 3+ 并发导致超时，但那是后端 batch embedding 优化前。现在后端已 6.3x 提升，需重新探测安全并发数。用 3 个 batch（而非仅首个）判断可避免首批碰巧是小 batch 导致的误判。

### D6: HTTP Keep-Alive Agent

**选择**：在 `wrapper-client.js` 的 `HTTPClient` 中通过 `undici` 或全局 dispatcher 实现 Keep-Alive

**注意**：Node.js 18+ 的原生 `fetch()` 基于 undici，**不支持** `node:http.Agent` 的 `agent` 选项。需要使用 `undici.Agent` + `setGlobalDispatcher()` 或在 fetch 选项中传入 `dispatcher`。

**理由**：当前每次 `fetch()` 都是独立 TCP 连接。全量导入 ~2600+ 次请求，连接复用可减少 ~5-15% 时间。

**实现方式**：
```javascript
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ keepAliveTimeout: 30000, connections: 10 }));
```

### D7: Changed nodes ID remapping

**选择**：changed nodes 按 "delete old → create new → remap links" 处理，维护 old_backend_id → new_backend_id 映射表

**流程**：
1. 对每个 changed node，删除旧 backend atom/entity（记录旧 backend_id）
2. 创建新 atom/entity（获得新 backend_id）
3. 将 `{graphify_id → new_backend_id}` 写入 atomMap/entityMap（覆盖旧映射）
4. 收集所有引用了 changed nodes 的 links，删除旧 references 并重建新 references

**理由**：graphify node ID 在代码不变时稳定（实测确认：路径+符号名拼接，如 `tools_core_memory_write`），但后端 atom ID 在每次创建时都是新的。changed nodes 的后端 ID 必然变化，关联的 references 也必须更新。

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| graphify node ID 不稳定 | 增量 diff 误判，导致全量重建 | ⚠️ **已验证：ID 确定性强**（路径+符号名拼接，如 `tools_core_memory_write`）。文件重命名会触发该文件的局部全量重建，这是可接受的降级行为 |
| 后端并发能力不足 | Atoms batch 超时 | 动态探测：首批试并发 2，失败则降级串行 |
| `.graphify-cache.json` 损坏 | 无法增量 | 提供 `--full` 强制全量；损坏时自动 fallback |
| 增量删除的级联问题 | 删除 Entity 后 Atoms/Refs 残留 | 🔴 **当前无批量删除 API**。需要：①给后端写信请求 `DELETE /api/v1/entities/{id}` 级联删除；②fallback 方案：查询关联 atoms/refs 后逐个删除（单文件 ~70 次 API 调用） |
| Refs 批量 API 后端不支持 | 运行时错误 | `try/catch` 降级到逐个创建 |

## Migration Plan

1. **Phase 1**（向后兼容）：Refs 批量化 + HTTP Agent，CLI 无变化
2. **Phase 2**（向后兼容）：Atoms 并发，CLI 无变化
3. **Phase 3**（新增选项）：CLI 新增 `--incremental`（默认）和 `--full`（强制全量），不破坏现有用法

**Rollback**：任何 phase 出问题可立即回退（git revert），无数据库迁移。

## Open Questions

- [x] ~~graphify node ID 在代码不变时是否稳定？~~ **已验证：稳定**。ID 格式为路径+符号名拼接（如 `tools_core_memory_write`），2646 个 ID 全部唯一。文件重命名会导致该文件所有 node ID 变化（预期行为）。
- [ ] 后端 `DELETE /api/v1/entities/{id}` 是否支持级联删除 Atoms 和 References？**需给后端写信确认**
- [ ] `POST /api/v1/references/batch` 的实际 batch size 限制是多少？**已验证：100 条/批**（后端 Pydantic 验证 `max_length: 100`）
- [ ] 后端 embedding 并发能力上限（几个并发 batch 不超时）？
- [ ] `listAtoms` API 是否支持按 `entity_id` 过滤？（增量删除需要查询某 entity 下的所有 atoms）
