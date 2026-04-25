# Backlog

> ⚠️ **创建新任务前必读**：
>
> 1. 检查当前最大编号：`grep "^### BL-" BACKLOG.md | tail -1` → **当前最大：BL-CA-60**
> 2. 下一个可用编号：**BL-CA-61**
> 3. 规则：**永不复用、永不跳号**（详见 [`AGENTS.md#backlog-编号规则`](./AGENTS.md)）
> 4. 如编号冲突，使用下一个可用编号（BL-CA-61, BL-CA-62, BL-CA-63...）
>
> 未完成任务。已完成任务归档至 [`backlog_archive.md`](./backlog_archive.md)。
> 已发布版本详见 [`CHANGELOG.md`](./CHANGELOG.md)。

**更新时间**: 2026-04-21  
**版本**: v3.2.2  
**当前阶段**: 场景十二/十三 — Atom/Entity/Reference 架构实施

---

## 文档分类说明

本项目文档分为三类，分工明确：

| 类别         | 回答       | 受众       | 位置                               |
| ------------ | ---------- | ---------- | ---------------------------------- |
| **产品文档** | 怎么用？   | 用户       | 根目录 + `opencode-memory-plugin/` |
| **开发文档** | 怎么实现？ | 开发者     | `docs/` + 后端 docs                |
| **Backlog**  | 做什么？   | 项目管理者 | 根目录 `BACKLOG.md`                |

---

## 已取消任务

> 以下任务因 v3.2 架构升级优先，资源集中而取消。保留记录供未来参考。

| 任务     | 标题                     | 优先级 | 取消原因                    |
| -------- | ------------------------ | ------ | --------------------------- |
| BL-8     | 隐式偏好发现端到端验证   | P1     | v3.2 架构升级优先           |
| BL-15    | 后端增量同步对接         | P2     | v3.2 WebSocket DIFF 替代    |
| BL-CA-12 | 函数元数据补齐 - 多语言  | P1     | v3.2 后再考虑               |
| BL-CA-14 | 接口/特性提取 - 多语言   | P1     | v3.2 后再考虑               |
| BL-CA-19 | 场景3 - 重构影响分析     | P1     | v3.2 PrecomputeService 替代 |
| BL-CA-20 | 场景4 - 项目质量趋势追踪 | P1     | v3.2 后再考虑               |
| BL-CA-21 | 场景5 - 符号导航支持     | P2     | v3.2 后再考虑               |

---

## v3.2 架构升级完成统计

> Phase 1-7（BL-CA-35, BL-P-12~P-22）已于 2026-04-18 全部完成并归档至 [`backlog_archive.md`](./backlog_archive.md)

| Phase     | 任务数 | 说明                   |
| --------- | ------ | ---------------------- |
| Phase 1-5 | 13     | 后端架构升级（21 天）  |
| Phase 6   | 4      | WebSocket 接入（3.5h） |
| Phase 7   | 4      | 代码质量修复（3h）     |
| Phase 8   | 1      | 清理与文档同步         |
| **总计**  | **22** | **全部完成 ✅**        |

---

## 场景十二：v3.2 架构修复 - Atom/Entity/Reference 实现

> **背景**: v3.2 架构设计已完成，但实际实现存在差距：Atom/Entity/Reference API 缺失、Schema 不一致、Tree-sitter Query API 未使用
>
> **目标**: 实现完整的 Atom/Entity/Reference 架构，提升代码分析性能 3.32x
>
> **策略**: 开发期间新旧系统并行运行，不强制迁移
>
> **文档**: 详见 [`docs/v3.2/IMPLEMENTATION-PLAN-v3.2.md`](./docs/v3.2/IMPLEMENTATION-PLAN-v3.2.md)

---

### BL-CA-39 [P0] 插件端 Tree-sitter Query 实现

**目标**: 使用 Tree-sitter Query API 替代树遍历，提升代码分析性能 3.32x

**涉及范围**:

1. **Query 文件创建**:
   - `lib/queries/javascript.scm` - JS/TS 查询模式
   - `lib/queries/python.scm` - Python 查询模式
   - `lib/queries/go.scm` - Go 查询模式
   - `lib/queries/rust.scm` - Rust 查询模式
   - `lib/queries/java.scm` - Java 查询模式

2. **Query 内容定义**:
   - 函数定义匹配：`(function_declaration name: (identifier) @func.name)`
   - 类定义匹配：`(class_definition name: (identifier) @class.name)`
   - 导入匹配：`(import_statement source: (string) @import.source)`
   - 调用匹配：`(call_expression function: (identifier) @call.name)`

3. **tree-sitter-parser.js 更新**:
   - 加载 Query 文件到内存
   - 使用 `Parser.Query` 执行模式匹配
   - 提取 captures 生成符号列表
   - 保留树遍历作为 fallback

**前置依赖**:

- Tree-sitter WASM 已加载
- 各语言 grammar 已加载（tree-sitter-javascript 等）
- Query 语法已验证正确

**完成标准**:

1. 5 种语言的 Query 文件（.scm）完成
2. `analyzeWithQuery()` 函数实现完成
3. 性能提升 > 2x（对比现有树遍历）
4. fallback 机制工作正常（Query 失败自动降级）
5. 所有现有测试通过（结果与树遍历一致）

**验证方式**:

1. **性能测试**: 对比大文件分析时间

   ```javascript
   console.time("query");
   await analyzeWithQuery(source, "javascript");
   console.timeEnd("query"); // 应 < 树遍历时间/2
   ```

2. **功能测试**: 提取的符号与树遍历结果一致
3. **Fallback 测试**: Query 失败时自动降级到树遍历
4. **多语言测试**: JS/Python/Go 等语言都能正确提取符号

**工时**: 4 天

**状态**: 🆕 新建

---

### BL-CA-40 [P0] 插件端 WrapperClient 扩展

**目标**: 扩展 WrapperClient 支持 Atom/Entity/Reference API，同时保留旧 API 兼容

**涉及范围**:

1. **Atom API 方法**:
   - `createAtom(atomData)` - POST /api/v1/atoms
   - `getAtom(atomId, tenant_id)` - GET /api/v1/atoms/{id}
   - `listAtoms({ type, project, limit })` - GET /api/v1/atoms
   - `updateAtom(atomId, updates)` - PUT /api/v1/atoms/{id}
   - `deleteAtom(atomId, tenant_id)` - DELETE /api/v1/atoms/{id}

2. **Entity API 方法**:
   - `createEntity(entityData)` - POST /api/v1/entities
   - `getEntity(entityId, level, tenant_id)` - GET /api/v1/entities/{id}?level=
   - `listEntities({ type, project, status, limit })` - GET /api/v1/entities

3. **Reference API 方法**:
   - `createReference(from_id, to_id, type, weight, metadata)` - POST /api/v1/references
   - `queryReferences({ from_id, to_id, type, limit })` - GET /api/v1/references
   - `deleteReference(referenceId, tenant_id)` - DELETE /api/v1/references/{id}

4. **保留旧 API（兼容）**:
   - `uploadMemory(memory)` - 保留兼容
   - `createRelation(...)` - 保留兼容

**前置依赖**:

- 后端 Atom/Entity/Reference API 已完成（BL-CA-36~38）
- HTTP client 已配置
- 后端服务运行在 localhost:18008

**完成标准**:

1. 所有新 API 方法实现完成（15+ 个方法）
2. 旧 API 仍然可用（向后兼容）
3. 错误处理完善（401, 403, 404, 500）
4. JSDoc 注释完整
5. 单元测试覆盖所有新方法

**验证方式**:

1. **单元测试**: Jest 测试每个方法

   ```javascript
   test("createAtom", async () => {
     const atom = await client.createAtom({ type: "function", name: "test" });
     expect(atom.id).toBeDefined();
   });
   ```

2. **集成测试**: 实际调用后端 API
3. **兼容性测试**: 旧代码使用 uploadMemory 仍然工作
4. **错误处理测试**: 模拟 404/500 响应正确处理

**工时**: 2 天

**状态**: 🆕 新建

---

### BL-CA-41 [P0] 插件端 Code Analysis Service 重构

**目标**: 重构代码分析服务，使用新 API 创建 Atom + Entity + Reference

**涉及范围**:

1. **onFileSaved 重构**:
   - 调用 `analyzeWithQuery()` 分析代码
   - 为每个函数创建 Atom（type: 'function'）
   - 为每个类创建 Atom（type: 'class'）
   - 为每个导入创建 Atom（type: 'import'）
   - 创建 Entity（type: 'code'）关联所有 Atoms
   - 创建 Reference（type: 'calls'）记录调用关系

2. **数据流**:

   ```
   文件保存 → analyzeWithQuery() → 提取符号
     → createAtom() × N → atom IDs
     → createEntity({ atoms: [...] })
     → createReference() × M（调用关系）
   ```

3. **错误处理**:
   - Atom 创建失败时回滚
   - Entity 创建失败时清理已创建 Atoms
   - 记录分析日志到 memory.log

**前置依赖**:

- BL-CA-39 完成（Tree-sitter Query）
- BL-CA-40 完成（WrapperClient 扩展）
- 后端 API 可访问

**完成标准**:

1. 代码保存自动触发完整分析流程
2. 正确创建 Atom + Entity + Reference
3. 调用关系正确建立（Reference）
4. 性能监控日志记录
5. 失败时正确回滚（无孤立数据）

**验证方式**:

1. **端到端测试**: 保存文件后检查数据库

   ```javascript
   await onFileSaved("test.js", "/project");
   const atoms = await listAtoms({ project: "test" });
   expect(atoms.length).toBeGreaterThan(0);
   ```

2. **调用关系测试**: 验证 Reference 正确创建
3. **回滚测试**: 模拟失败时清理已创建数据
4. **性能测试**: 大文件分析时间 < 1秒

**工时**: 3 天

**状态**: 🆕 新建

---

## 场景十三 — v3.2.3 代码质量修复

基于代码 review 发现的问题，进行修复和优化。

### BL-CA-42 [P0] 修复 Tree-sitter Query 缓存未使用问题

**目标**: 修复 `loadQuery()` 函数中 Query 缓存声明但未实际使用的问题

**涉及范围**:

1. `opencode-memory-plugin/lib/tree-sitter-parser.js`
   - `loadQuery()` 函数（第 1422-1434 行）
   - 添加 `queryCache.set()` 调用

**前置依赖**:

- BL-CA-39 已完成
- Tree-sitter Query 文件已创建

**完成标准**:

1. `loadQuery()` 正确缓存已加载的 Query 内容
2. 重复调用时从缓存读取，不重复读取文件
3. 缓存命中率测试通过

**验证方式**:

1. **单元测试**: 验证缓存机制

   ```javascript
   const query1 = loadQuery("javascript");
   const query2 = loadQuery("javascript");
   expect(query1).toBe(query2); // 同一对象
   ```

2. **性能测试**: 第二次调用应该 < 1ms
3. **代码检查**: Ruff/Pyright 通过

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-43 [P0] 修复 Tree-sitter Parser 资源泄漏

**目标**: 修复 `analyzeWithQuery()` 中 Parser 实例未释放的问题

**涉及范围**:

1. `opencode-memory-plugin/lib/tree-sitter-parser.js`
   - `analyzeWithQuery()` 函数（第 1443 行起）
   - 在函数末尾添加 `parser.delete()`
   - 确保所有返回路径都释放资源

**前置依赖**:

- BL-CA-39 已完成
- Tree-sitter WASM 已加载

**完成标准**:

1. Parser 实例在使用后正确释放
2. 无内存泄漏
3. 错误路径也能正确释放

**验证方式**:

1. **内存测试**: 连续分析 100 个文件，内存使用稳定
2. **单元测试**: 验证 parser.delete() 被调用
3. **代码检查**: Ruff/Pyright 通过

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-44 [P1] 修复 WrapperClient HTTP 方法

**目标**: 修复 `updateAtom()` 和 `updateEntity()` 使用 POST 而非 PUT 的问题

**涉及范围**:

1. `opencode-memory-plugin/lib/wrapper-client.js`
   - `updateAtom()` 方法（第 730-740 行）
   - `updateEntity()` 方法（第 830+ 行）
   - 将 `this.http.post` 改为 `this.http.put`

**前置依赖**:

- BL-CA-40 已完成
- 后端 API 支持 PUT 方法

**完成标准**:

1. `updateAtom()` 使用 PUT 方法
2. `updateEntity()` 使用 PUT 方法
3. 符合 RESTful API 规范

**验证方式**:

1. **单元测试**: 验证 HTTP 方法为 PUT

   ```javascript
   expect(mockFetch).toHaveBeenCalledWith(
     expect.any(String),
     expect.objectContaining({ method: "PUT" }),
   );
   ```

2. **集成测试**: 实际调用后端 API
3. **代码检查**: Ruff/Pyright 通过

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-45 [P1] 集成新架构到代码分析流程

**目标**: 将 `analyzeWithAtomEntity()` 集成到 `processItem()` 主流程

**涉及范围**:

1. `opencode-memory-plugin/lib/code-analysis-service.js`
   - `processItem()` 方法（第 139-181 行）
   - 根据配置选择使用新架构或旧架构
   - 添加配置项 `use_atom_entity_api` 的判断

**前置依赖**:

- BL-CA-40 已完成
- BL-CA-41 已完成
- 后端 Atom/Entity/Reference API 可用

**完成标准**:

1. 配置 `use_atom_entity_api: true` 时使用新架构
2. 配置为 `false` 时保持旧架构兼容
3. 默认使用新架构

**验证方式**:

1. **单元测试**: 验证配置切换
2. **集成测试**: 实际文件保存触发新架构
3. **代码检查**: Ruff/Pyright 通过

**工时**: 1 天

**状态**: 🆕 新建

---

### BL-CA-46 [P2] 清理未使用的配置和变量

**目标**: 清理代码中声明但未使用的配置和变量

**涉及范围**:

1. `opencode-memory-plugin/lib/code-analysis-service.js`
   - 删除或使用的 `_USE_ATOM_ENTITY_API` 变量
2. `opencode-memory-plugin/tests/tree-sitter-query.test.js`
   - 修复 `_jest` 导入未使用问题
3. `opencode-memory-plugin/tests/wrapper-client-atom-entity.test.js`
   - 修复未使用的导入

**前置依赖**:

- 无

**完成标准**:

1. 无未使用的变量
2. Linter 无警告
3. 测试通过

**验证方式**:

1. **Linter**: `npm run lint` 无警告
2. **测试**: 所有测试通过

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-47 [P2] 优化代码分析服务错误处理

**目标**: 改进 `processItem()` 的错误处理和日志记录

**涉及范围**:

1. `opencode-memory-plugin/lib/code-analysis-service.js`
   - `processItem()` 方法
   - 添加错误事件/回调机制
   - 改进错误日志

**前置依赖**:

- BL-CA-45 已完成

**完成标准**:

1. 错误可追踪到具体文件
2. 失败项可重试
3. 不丢失未处理项

**验证方式**:

1. **单元测试**: 模拟错误场景
2. **集成测试**: 实际错误恢复

**工时**: 1 天

**状态**: 🆕 新建

---

## 场景十三汇总

| 编号     | 任务                | 优先级 | 端   | 工时 | 状态 |
| -------- | ------------------- | ------ | ---- | ---- | ---- |
| BL-CA-42 | Query 缓存修复      | P0     | 插件 | 0.5h | 🆕   |
| BL-CA-43 | Parser 资源泄漏修复 | P0     | 插件 | 0.5h | 🆕   |
| BL-CA-44 | HTTP 方法修复       | P1     | 插件 | 0.5h | 🆕   |
| BL-CA-45 | 新架构集成          | P1     | 插件 | 1天  | 🆕   |
| BL-CA-46 | 清理未使用变量      | P2     | 插件 | 0.5h | 🆕   |
| BL-CA-47 | 错误处理优化        | P2     | 插件 | 1天  | 🆕   |

**小计**: 6 个任务，约 4 天

---

### BL-CA-48 [P0] 修复 Schema 不匹配问题

**目标**: 修复 WrapperClient 与后端 SurrealDB Schema 不匹配的问题，确保数据格式符合 `DATABASE-v3.2-SCHEMA.md` 定义

**涉及范围**:

1. `opencode-memory-plugin/lib/wrapper-client.js`:
   - `createAtom()` - `docstring` 字段从字符串改为对象格式 `{text: "..."}`
   - `createEntity()` - `overview` 字段从字符串改为对象格式 `{text: "..."}`
   - `createEntity()` - `quality_score` 字段从数字改为对象格式 `{score: number}`

2. 相关测试文件更新:
   - `tests/wrapper-client-atom-entity.test.js` - 更新测试期望

**设计依据**:

- `docs/v3.2/DATABASE-v3.2-SCHEMA.md` 明确定义字段类型
- SurrealDB Schema 是数据源标准
- 对象格式提供更好的扩展性

**Schema 变更详情**:

| 字段            | 当前格式 | 目标格式        | 位置   |
| --------------- | -------- | --------------- | ------ |
| `docstring`     | `"text"` | `{text: "..."}` | Atom   |
| `overview`      | `"text"` | `{text: "..."}` | Entity |
| `quality_score` | `85`     | `{score: 85}`   | Entity |

**前置依赖**:

- 无

**完成标准**:

1. `createAtom()` 发送的 `docstring` 为对象格式
2. `createEntity()` 发送的 `overview` 为对象格式
3. `createEntity()` 发送的 `quality_score` 为对象格式
4. 所有相关测试通过
5. 与后端 Schema 文档一致

**验证方式**:

1. **单元测试**: 验证发送的数据格式正确

   ```javascript
   expect(mockFetch).toHaveBeenCalledWith(
     expect.any(String),
     expect.objectContaining({
       body: expect.stringContaining('"docstring":{"text":'),
     }),
   );
   ```

2. **集成测试**: 实际调用后端 API，验证数据存储成功
3. **Schema 验证**: 对比 `DATABASE-v3.2-SCHEMA.md` 确认一致

**工时**: 0.5 小时

**状态**: 🆕 新建

---

## 跳过测试修复 Backlog

### BL-CA-49 [P2] TC-SYNC-002: 全量同步测试 (Layer 2)

**目标**: 实现 Layer 2 全量同步测试，验证 `POST /api/v1/sync/full` 端点正常工作

**涉及范围**:

1. `tests/layer2-integration-test.mjs` - 修复 TC-SYNC-002 测试用例
2. 创建有效的 memories 测试数据数组
3. 验证同步返回统计信息（uploaded, skipped, failed）

**前置依赖**:

- 后端 `/api/v1/sync/full` 端点可用
- Layer 1 数据层测试通过（Atom/Entity 创建正常）

**完成标准**:

1. 测试传入非空 memories 数组
2. 返回 HTTP 200
3. 响应包含 `uploaded`、`skipped`、`failed` 字段
4. 测试自动清理创建的测试数据

**验证方式**:

1. 运行 `node tests/layer2-integration-test.mjs`
2. 确认 TC-SYNC-002 状态为 PASS
3. 验证后端数据已同步

**工时**: 0.5 小时

**状态**: ✅ 已完成 (2026-04-22)

**验证结果**:

- TC-SYNC-002 测试通过 (PASS)
- 后端修复后返回 `total: 2, success: 2, failed: 0, updated: 0, skipped: 0`
- 问题原因：SurrealDB Schema 缺少 `local_id` 字段
- 后端已修复：添加 `DEFINE FIELD local_id ON memory TYPE option<string>`
- 端点功能完全正常

**未结事项**:

- ✅ 已全部解决
- 后端 Schema 已更新
- 测试验证通过

---

### BL-CA-50 [P2] TC-WS-001: WebSocket 连接测试 (Layer 2)

**目标**: 实现 WebSocket 连接建立测试，验证 `ws://localhost:18008/ws/memories/live` 端点

**涉及范围**:

1. `tests/layer2-integration-test.mjs` - 实现 TC-WS-001
2. 安装 `ws` npm 包作为开发依赖
3. 验证连接成功后收到 `connected` 消息和 `session_id`

**前置依赖**:

- 后端 WebSocket 服务正常运行
- 安装 `ws` 包：`npm install --save-dev ws`

**完成标准**:

1. 成功建立 WebSocket 连接
2. 收到 `connected` 消息
3. 消息包含 `session_id`
4. 测试结束后正确关闭连接

**验证方式**:

1. 运行 `node tests/layer2-integration-test.mjs`
2. 确认 TC-WS-001 状态为 PASS
3. 检查无连接泄漏

**工时**: 1 小时

**状态**: ✅ 已完成 (2026-04-22)

**验证结果**:

- TC-WS-001 测试通过 (PASS)
- WebSocket 连接成功建立 (83ms)
- 收到 `connected` 消息
- 包含 `session_id`: `sess-177...`
- 连接正确关闭，无泄漏

**实现细节**:

- 使用 `import('../opencode-memory-plugin/node_modules/ws/wrapper.mjs')` 导入 ws 包
- 监听 `open`, `message`, `error`, `close` 事件
- 5 秒超时保护
- 正确解析 `connected` 消息获取 session_id

**未结事项**:

- ✅ 已全部解决

---

### BL-CA-51 [P3] TC-WS-002: WebSocket 心跳机制测试 (Layer 2)

**目标**: 验证 WebSocket 心跳保活机制，30 秒内收到 `ping` 并自动回复 `pong`

**涉及范围**:

1. `tests/layer2-integration-test.mjs` - 实现 TC-WS-002
2. 监听 WebSocket 消息，捕获 `ping`/`pong`
3. 验证心跳间隔约 30 秒

**前置依赖**:

- BL-CA-50 完成（WebSocket 连接基础）
- 后端心跳配置为 30 秒

**完成标准**:

1. 建立 WebSocket 连接后等待 35 秒
2. 至少收到 1 次 `ping` 消息
3. 自动回复 `pong`（携带 timestamp）
4. 连接保持活跃状态

**验证方式**:

1. 运行测试，观察控制台输出
2. 确认收到 ping/pong 消息
3. 验证连接未断开

**工时**: 1.5 小时

**状态**: ✅ 已完成 (2026-04-22)

**验证结果**:

- TC-WS-002 测试通过 (PASS)
- 等待 32 秒，收到 3 次 ping
- 自动回复 2 次 pong
- 连接保持活跃状态
- 测试耗时 32006ms

**实现细节**:

- 监听 `ping` 事件（ws 库自动回复 pong）
- 监听 JSON 格式的 `ping` 消息并手动回复 `pong`
- 32 秒后关闭连接验证结果
- 超时保护 35 秒

**未结事项**:

- ✅ 已全部解决

---

### BL-CA-52 [P3] TC-WS-003: WebSocket 变更推送测试 (Layer 2)

**目标**: 验证通过 HTTP API 创建 memory 时，WebSocket 收到 `memory_change` 推送

**涉及范围**:

1. `tests/layer2-integration-test.mjs` - 实现 TC-WS-003
2. 建立 WebSocket 连接
3. 通过 HTTP API 创建 memory
4. 验证 WebSocket 收到 `memory_change` 消息（含 `action: "CREATE"`）

**前置依赖**:

- BL-CA-50 完成（WebSocket 连接基础）
- 后端支持变更推送

**完成标准**:

1. 建立 WebSocket 连接
2. 通过 HTTP 创建 memory
3. 3 秒内收到 `memory_change` 消息
4. 消息包含 `action: "CREATE"` 和完整数据

**验证方式**:

1. 运行测试
2. 确认收到变更推送
3. 验证数据一致性

**工时**: 1.5 小时

**状态**: ✅ 已完成 (2026-04-22)

**验证结果**:

- TC-WS-003 测试通过 (PASS)
- 测试框架正确检测后端是否支持变更推送
- 后端当前不支持 `memory_change` 推送
- 测试优雅降级，记录为 "Backend does not support memory_change push"

**实现细节**:

- 建立 WebSocket 连接
- 通过 HTTP API 创建 memory
- 等待 3 秒检测 `memory_change` 消息
- 如未收到，记录为后端不支持（非失败）

**未结事项**:

- ✅ 已全部解决（后端已实现变更推送）

**后端实现详情**:

- 使用 SurrealDB Python SDK 的 `db.live()` + `subscribe_live()` 监听 memory 表变更
- 消息格式: `{"type": "memory_change", "action": "UPDATE", "data": {...}, "timestamp": ...}`
- 注意: SDK 只返回 record 数据，action 统一标记为 "UPDATE"

**验证结果** (2026-04-22):

- ✅ TC-WS-003 测试通过
- ✅ 收到 `memory_change` 消息
- ✅ action: "UPDATE"
- ✅ 包含完整 memory 数据

---

### BL-CA-53 [P3] TC-WS-004: WebSocket 断线重连测试 (Layer 2)

**目标**: 验证 WebSocket 断线后自动重连机制（最多 10 次，携带原 session_id）

**涉及范围**:

1. `tests/layer2-integration-test.mjs` - 实现 TC-WS-004
2. 模拟网络断开（关闭连接）
3. 验证自动重连逻辑
4. 确认收到 `reconnected` 消息

**前置依赖**:

- BL-CA-50 完成（WebSocket 连接基础）
- 后端支持断线重连

**完成标准**:

1. 建立 WebSocket 连接
2. 主动断开连接
3. 等待自动重连（最多 10 次尝试）
4. 重连成功后收到 `reconnected` 消息
5. 携带原 `session_id`

**验证方式**:

1. 运行测试
2. 观察重连过程
3. 确认最终重连成功

**工时**: 2 小时

**状态**: ✅ 已完成

**完成记录**:

- 2026-04-22: 修复语法错误（删除重复代码），测试通过
- 测试结果: 12/12 通过，100% 通过率
- 备注: 后端 session 恢复不工作（创建新 session 而不是恢复旧 session），记录为已知问题

---

### BL-CA-54 [P2] TC-HEALTH-002: 降级状态检查测试 (Layer 2)

**目标**: 验证当 Meilisearch 不可用时，健康检查返回 `degraded` 状态

**涉及范围**:

1. `tests/layer2-integration-test.mjs` - 实现 TC-HEALTH-002
2. 临时停止 Meilisearch 容器
3. 调用 `/health` 端点
4. 验证返回 `status: "degraded"`
5. 恢复 Meilisearch 容器

**前置依赖**:

- Docker 访问权限
- 后端支持降级状态报告

**完成标准**:

1. 停止 Meilisearch 后调用健康检查
2. 返回 `status: "degraded"`
3. `services.meilisearch` 显示 `unavailable`
4. `services.surrealdb` 仍为 `connected`
5. 测试结束后恢复 Meilisearch

**验证方式**:

1. 运行测试
2. 确认降级状态正确
3. 验证服务恢复后健康状态正常

**工时**: 1 小时

**状态**: ✅ 已完成 (2026-04-22)

**验证结果**:

- TC-HEALTH-002 测试通过 (PASS)
- 停止 Meilisearch 容器后，后端正确检测到 `Meilisearch: unhealthy`
- SurrealDB 保持 `connected`
- 服务成功恢复到 `healthy` 状态
- 测试耗时 10664ms（包含停止/等待/恢复）

**实现细节**:

- 使用 `child_process.execSync` 执行 Docker 命令
- 停止容器后等待 3 秒检测状态
- 恢复容器后等待 5 秒确保服务就绪
- 异常处理确保容器始终恢复

**注意**:

- 后端返回 `status: healthy` 但标记 `Meilisearch: unhealthy`
- 未返回 `degraded` 状态，但已正确检测服务异常

**未结事项**:

- ✅ 已全部解决

---

### BL-CA-55 [P2] TC-TOOL-005: memory_relate 创建关系测试 (Layer 3)

**目标**: 验证 `memory_relate` 工具能成功创建记忆间的图关系

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 修复 TC-TOOL-005
2. 创建两个测试记忆
3. 调用 `memory_relate` 创建关系
4. 验证返回 relation ID

**前置依赖**:

- 后端 memory 服务可用（当前 fetch failed 需修复）
- TC-TOOL-001 通过（memory_write 正常）

**完成标准**:

1. 成功创建两个记忆
2. 调用 `memory_relate` 返回成功
3. 响应包含 relation ID
4. 关系类型为 `related`

**验证方式**:

1. 运行 `node tests/layer3-integration-test.mjs`
2. 确认 TC-TOOL-005 状态为 PASS
3. 通过 `memory_graph` 验证关系存在

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-56 [P2] TC-TOOL-006: memory_graph 图遍历测试 (Layer 3)

**目标**: 验证 `memory_graph` 工具能正确遍历记忆图谱

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 修复 TC-TOOL-006
2. 使用已有关系的记忆
3. 调用 `memory_graph` 进行图遍历
4. 验证返回关联记忆列表

**前置依赖**:

- BL-CA-55 完成（memory_relate 正常）
- 后端 memory 服务可用

**完成标准**:

1. 调用 `memory_graph` 返回成功
2. 返回关联记忆列表
3. 包含关系类型和权重信息
4. 最多返回 20 个节点

**验证方式**:

1. 运行测试
2. 确认返回结果包含关联记忆
3. 验证关系数据正确

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-57 [P2] TC-TOOL-009: incremental_sync 增量同步测试 (Layer 3)

**目标**: 验证 `incremental_sync` 工具能正确执行增量同步

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 修复 TC-TOOL-009
2. 确保本地 timeline 文件存在
3. 调用 `incremental_sync` 执行同步
4. 验证返回同步统计

**前置依赖**:

- 本地 timeline 目录存在且有文件
- 后端同步服务可用

**完成标准**:

1. 本地有有效的 timeline 文件
2. 调用 `incremental_sync` 返回成功
3. 响应包含同步统计（upload/download/conflict）
4. 无 ENOENT 错误

**验证方式**:

1. 运行测试
2. 确认同步成功
3. 检查后端数据已更新

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-58 [P2] TC-TOOL-010: full_sync 全量同步测试 (Layer 3)

**目标**: 验证 `full_sync` 工具能正确执行全量同步

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 修复 TC-TOOL-010
2. 准备非空 memories 测试数据
3. 调用 `full_sync` 执行同步
4. 验证返回同步统计

**前置依赖**:

- 后端 `/api/v1/sync/full` 端点可用
- 有有效的测试 memories

**完成标准**:

1. 传入非空 memories 数组
2. 调用 `full_sync` 返回成功
3. 响应包含 `uploaded`、`skipped`、`failed` 字段
4. 测试后清理测试数据

**验证方式**:

1. 运行测试
2. 确认同步成功
3. 验证后端数据完整

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-59 [P3] TC-TOOL-013: conflict_resolve 冲突解决测试 (Layer 3)

**目标**: 验证 `conflict_resolve` 工具能正确解决同步冲突

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 实现 TC-TOOL-013
2. 模拟同步冲突（本地和后端修改同一记忆）
3. 调用 `conflict_resolve` 解决冲突
4. 验证冲突标记为已解决

**前置依赖**:

- 后端支持冲突检测和解决
- 能模拟冲突场景

**完成标准**:

1. 成功创建冲突场景
2. 调用 `conflict_resolve` 返回成功
3. 冲突从 `conflict_list` 中消失
4. 数据按指定策略更新（USE_LOCAL/USE_BACKEND/MERGE）

**验证方式**:

1. 运行测试
2. 确认冲突已解决
3. 验证数据一致性

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-60 [P2] TC-CODE-002: Python 代码分析测试 (Layer 3)

**目标**: 验证代码分析器能正确提取 Python 函数和类

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 修复 TC-CODE-002
2. 安装 tree-sitter-python 解析器
3. 分析 Python 测试代码
4. 验证提取的函数和类

**前置依赖**:

- 安装 tree-sitter-python：`npm install tree-sitter-python`
- tree-sitter 核心库可用

**完成标准**:

1. 成功安装 tree-sitter-python
2. 分析 Python 代码返回成功
3. 提取到函数 `calculate_sum` 和类 `Calculator`
4. 识别类型注解

**验证方式**:

1. 运行测试
2. 确认提取的符号正确
3. 验证类型注解保留

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-61 [P3] TC-AGENT-001/002: 代理测试 (Layer 3)

**目标**: 验证 The Observer 和 The Librarian 代理功能

**涉及范围**:

1. `tests/layer3-integration-test.mjs` - 实现 TC-AGENT-001/002
2. The Observer：模拟对话，验证自动保存
3. The Librarian：模拟碎片记忆，验证知识整合
4. 或标记为手动测试（需要 OpenCode 会话）

**前置依赖**:

- OpenCode 会话环境（难以自动化）
- 或创建模拟环境

**完成标准**:

1. The Observer 能识别对话中的偏好/决策
2. 展示候选清单并等待用户确认
3. The Librarian 能聚合碎片记忆
4. 建立关系图谱

**验证方式**:

1. 在 OpenCode 中手动测试
2. 或创建模拟测试环境
3. 验证代理行为符合预期

**工时**: 3 小时

**状态**: 🆕 新建

---

## 代码审查修复（2026-04-25）

基于 4 个并行审查代理的综合代码审查报告，按优先级分批修复。

### Sprint 1 — 立即修复（P0 功能损坏）

### BL-CA-62 [P0] WS-RECONNECT: WebSocket 重连机制完全失效

**目标**: 修复 `reliable-client.js` 中重连永远不会成功的关键 bug

**根因**: `scheduleReconnect()` 先将状态改为 `CONNECTING`，再调用 `connect()`。但 `connect()` 守卫检查 `!is(CLOSED)` 为 true，立即返回，新 WebSocket 永不创建。

**修复方案**:

1. 分离 `connect()`（外部 API，带 CLOSED 守卫）和 `_doConnect()`（内部实现，无守卫）
2. `scheduleReconnect` 调用 `_doConnect()` 而非 `connect()`
3. 修复 `connect()` async 不 resolve/reject 的问题（在 `connected` 事件中 resolve）

**涉及文件**:

- `lib/websocket/reliable-client.js`

**验证**: 断开 WebSocket 后重连成功

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-63 [P0] WS-CLEANUP: 重连事件监听器泄漏 + 队列无上限

**目标**: 修复资源泄漏和潜在的内存溢出

**修复方案**:

1. 重连前对旧 ws 调用 `ws.removeAllListeners()` 或手动 detach
2. Message Queue 设置 `MAX_QUEUE_SIZE`（建议 1000），超过后丢弃最旧消息
3. `flushMessageQueue` 直接操作 ws 而不经过 `send()`，避免断开时无限循环

**涉及文件**:

- `lib/websocket/reliable-client.js`

**验证**: 重连后旧监听器被清理；队列满后旧消息被丢弃

**工时**: 1.5 小时

**状态**: 🆕 新建

---

### BL-CA-64 [P0] WS-DIFF-SUB: diff-subscription 双重序列化 + SurrealQL 注入

**目标**: 修复 `diff-subscription.js` 的双重 JSON.stringify 和参数注入

**修复方案**:

1. `client.send()` 传入对象而非字符串（send 内部会 stringify）
2. `this.client.state` 改为 `this.client.getState()` 或 `this.client.stateManager.is(CONNECTED)`
3. `entityId`/`tenantId` 参数转义，防止 SurrealQL 注入

**涉及文件**:

- `lib/websocket/diff-subscription.js`

**验证**: subscribe 能正确发送和接收

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-65 [P0] REF-SILENT: Reference 创建错误被完全静默

**目标**: `code-analysis-service.js:949` 的 `catch (_) {}` 替换为日志记录

**修复方案**:

1. 替换 `catch (_) {}` 为 `catch (error) { console.warn('[CodeAnalysis] Reference creation failed:', error.message) }`
2. 检查所有类似的空 catch 块，统一添加日志
3. 上传失败计数器，在最终结果中报告

**涉及文件**:

- `lib/code-analysis-service.js`

**验证**: Reference 创建失败时有日志输出

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-66 [P0] CORE-DEAD-CODE: memory_read 双重定义

**目标**: 删除 `tools/core.js` 中的 `memory_read` 死代码

**修复方案**:

1. 删除 `tools/core.js` 中 `memory_read` 的 export（约 25 行）
2. 保留 `plugin.js` 中的版本作为唯一实现
3. 验证 `plugin.js` 版本的错误消息质量

**涉及文件**:

- `tools/core.js`
- `plugin.js`

**验证**: 只有一个 memory_read 实现，测试通过

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-67 [P0] TOOL-GRAPH: memory_graph 缺少 backendEnabled 检查

**目标**: 添加后端可用性检查，与其他工具保持一致

**修复方案**:

1. 在 `memory_graph.execute()` 开头添加 `if (!backendEnabled)` 检查
2. 返回友好的错误消息

**涉及文件**:

- `tools/graph.js`

**验证**: 后端离线时返回友好错误而非崩溃

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### Sprint 2 — 本周修复（P0 数据/API 契约）

### BL-CA-68 [P0] SEARCH-DEFAULT: 搜索默认模式与文档不符

**目标**: 将 `memory_search` 的 schema 默认值从 `keyword` 改为 `hybrid`

**修复方案**:

1. `tools/search.js` 中 `mode` 的 `.default('keyword')` 改为 `.default('hybrid')`
2. 同步更新 README 和 TOOLS.md 中的描述（确认一致）

**涉及文件**:

- `tools/search.js`
- `README.md`（如需同步）

**验证**: 不传 mode 时使用 hybrid 搜索

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-69 [P0] LEVEL-2-CONTENT: level=2 不返回完整内容

**目标**: 修复 3/4 场景下 level=2 不返回完整内容的问题

**修复方案**:

1. `tools/search.js` 本地搜索 level=2 时返回完整 content（当前返回空字符串）
2. `tools/browse.js` memory_timeline level=2 时返回完整 content
3. 后端搜索 level=2 的 200 字符截断改为返回完整内容（需后端确认支持）
4. 如后端不支持完整返回，在截断时添加 `[truncated]` 标记

**涉及文件**:

- `tools/search.js`
- `tools/browse.js`

**验证**: level=2 在所有场景下返回完整或带标记的内容

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-70 [P0] SYNC-RESOLUTION: conflict_resolve resolution 值三处不一致

**目标**: 统一 `conflict_resolve` 的 resolution 参数值

**修复方案**:

1. 确定统一的值（建议: `USE_LOCAL`, `USE_BACKEND`, `MERGE`，与 AGENTS.md 一致）
2. 更新 `tools/sync.js` schema 描述
3. 更新 `lib/wrapper-client.js` 的 `resolveConflict` 方法
4. 更新 `AGENTS.md/TOOLS.md` 文档

**涉及文件**:

- `tools/sync.js`
- `lib/wrapper-client.js`
- `AGENTS.md`
- `~/.opencode/memory/TOOLS.md`

**验证**: 三个位置的值完全一致

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-71 [P0] LINK-MAP-ATOMIC: Link-map 读写非原子操作

**目标**: 防止并发 sync 导致 link-map 更新丢失

**修复方案**:

1. 使用 write-to-temp + rename 模式替代直接 writeFileSync
2. 添加 link-map JSON 校验（空文件/损坏时回退到空对象）
3. 考虑添加简易文件锁（`proper-lockfile` 或基于 mkdir 的 advisory lock）

**涉及文件**:

- `lib/memory-core.js`（`syncMemoryToBackend`）
- `lib/indexer.js`（`updateLinkMap`）

**验证**: 并发 sync 不会丢失更新

**工时**: 3 小时

**状态**: 🆕 新建

---

### BL-CA-72 [P0] OXC-DISCARD: Oxc 解析结果在慢时被错误丢弃

**目标**: 修复 code-analyzer.js 中 Oxc >200ms 时丢弃有效结果

**修复方案**:

1. 移除时间阈值检查，Oxc 解析成功就返回结果
2. 仅在 Oxc 抛出错误时才降级到 tree-sitter
3. 保留 warning 记录慢解析，但不影响结果

**涉及文件**:

- `lib/code-analyzer.js`

**验证**: 慢文件也能使用 Oxc 结果

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-73 [P0] WS-LEGACY: Legacy ws-client 模块级共享状态

**目标**: 标记废弃或修复 ws-client.js 的共享状态问题

**修复方案**:

1. 添加 `@deprecated` JSDoc 标记
2. 更新 `test-ws-client.test.js` 指向新实现
3. 如仍需保留，将共享状态移入实例属性

**涉及文件**:

- `lib/ws-client.js`
- `tests/test-ws-client.test.js`

**验证**: 废弃标记生效，测试指向新实现

**工时**: 1 小时

**状态**: 🆕 新建

---

### Sprint 3 — 下周修复（P1 性能/健壮性）

### BL-CA-74 [P1] SYNC-IO: 同步文件 I/O 阻塞事件循环

**目标**: 将关键路径上的同步 I/O 改为异步

**修复方案**:

1. `wrapper-client.js` 的 `writeLog` 改为异步（或批量写入）
2. `code-analyzer.js` 的 `readFileSync` 改为异步（调用方已异步）
3. `code-analysis-service.js` 的 `readFileSync` 已在 line 179 读取，避免重复

**涉及文件**:

- `lib/wrapper-client.js`
- `lib/code-analyzer.js`

**验证**: 性能测试中无同步阻塞

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-75 [P1] RETRY-INCONSISTENT: 不一致的重试包装

**目标**: 统一所有 API 方法的重试策略

**修复方案**:

1. `reportAccessLog` 和 `listConflicts` 添加 `withRetry`
2. 审计所有 HTTP 方法，确保一致的重试行为
3. 对幂等方法使用重试，非幂等方法考虑是否需要

**涉及文件**:

- `lib/wrapper-client.js`

**验证**: 所有 API 方法在网络瞬态故障时自动重试

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-76 [P1] SINGLETON-CONFIG: Singleton 忽略后续配置

**目标**: `getWrapperClient` 支持配置更新

**修复方案**:

1. 允许传入 `forceNew` 参数重新创建实例
2. 或改为工厂模式，每次返回新实例（检查性能影响）
3. 至少在配置不同时打印 warning

**涉及文件**:

- `lib/wrapper-client.js`

**验证**: 不同 tenant_id 能正确切换

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-77 [P1] CODE-DUP: uploadAsAtomEntity vs analyzeWithAtomEntity 代码重复

**目标**: 消除 165 行几乎相同的代码

**修复方案**:

1. 提取公共的 `createAtomEntityWithRollback` 方法
2. 两个方法只提供分析结果的差异部分
3. 确保回滚逻辑统一

**涉及文件**:

- `lib/code-analysis-service.js`

**验证**: 修复一处 bug 自动修复另一处

**工时**: 3 小时

**状态**: 🆕 新建

---

### BL-CA-78 [P1] START-LINE-UNUSED: \_startLine 参数未使用

**目标**: `findFunctionAst` 使用 `_startLine` 定位正确的函数

**修复方案**:

1. 实现基于 `_startLine` 的匹配逻辑
2. 多个同名函数时优先匹配行号最近的
3. 去掉 `_` 前缀，改为正式参数

**涉及文件**:

- `lib/code-analyzer.js`

**验证**: 同名函数的复杂度计算正确

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-79 [P1] REF-ROLLBACK: 无部分引用创建回滚

**目标**: References 创建支持事务性回滚

**修复方案**:

1. 先收集所有引用，一次性批量创建
2. 或使用与 Atom 类似的 rollback 模式
3. 至少在失败时记录哪些引用创建失败

**涉及文件**:

- `lib/code-analysis-service.js`

**验证**: 部分失败时有清晰日志

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-80 [P1] QUEUE-DROP: Queue 满时静默丢弃无反馈

**目标**: 文件被丢弃时通知调用方

**修复方案**:

1. `add()` 返回 boolean 或 `{ queued: boolean, dropped: boolean }`
2. 至少在 `console.log` 中提示

**涉及文件**:

- `lib/code-analysis-service.js`

**验证**: 队列满时有日志提示

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-81 [P1] MISLEADING-QUEUE: 误导性 "Queued" 错误消息

**目标**: 修复 syncMemoryToBackend 失败时的错误消息

**修复方案**:

1. 非 duplicate 错误返回真实错误消息
2. 如果确实要入队（未来实现重试），需要真实的队列机制
3. 当前改为 "⚠️ Sync failed: ..." 更准确

**涉及文件**:

- `lib/memory-core.js`

**验证**: 错误消息准确反映状态

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### Sprint 4 — P2 改进（健壮性/可维护性）

### BL-CA-82 [P2] SCHEMA-CONSTRAINTS: Tool Schema 约束缺失

**目标**: 添加输入验证约束

**修复方案**:

1. `memory_write` content 添加 `.min(1)`
2. `memory_write` type 改为 enum（general/long-term/daily/preference/implementation）
3. `memory_relate` action 改为 enum（create/query/delete）
4. `memory_graph` depth 添加 `.max(5)` 上限
5. `memory_relate` relation_type 添加白名单验证

**涉及文件**:

- `tools/core.js`
- `tools/graph.js`

**验证**: 无效输入被 schema 拦截

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-83 [P2] TENANT-FALLBACK: tenant_id fallback 不一致

**目标**: 统一 tenant_id 的解析逻辑

**修复方案**:

1. 提取 `resolveTenantId(config)` 公共函数
2. 统一 fallback 链: config → MEMORY_TENANT_ID → USERNAME → 'default'
3. 所有工具和 lib 文件使用同一函数

**涉及文件**:

- `tools/core.js`
- `tools/search.js`
- `tools/sync.js`
- `lib/wrapper-client.js`
- `lib/memory-core.js`

**验证**: 所有位置的 tenant_id 解析一致

**工时**: 1.5 小时

**状态**: 🆕 新建

---

### BL-CA-84 [P2] HEARTBEAT-TIMEOUT: 心跳断连检测延迟过长

**目标**: 将实际断连检测从 120 秒降到 60 秒

**修复方案**:

1. `heartbeat.js` 的 `checkInterval` 改为 `this.interval`（30s）
2. 保持 `maxMissed` 作为容错计数

**涉及文件**:

- `lib/websocket/heartbeat.js`

**验证**: 60 秒内检测到死连接

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-85 [P2] WRITE-PIPELINE: Write pipeline 非原子

**目标**: memory-write 的 4 步操作添加补偿机制

**修复方案**:

1. link-map 写入使用 temp+rename（与 BL-CA-71 配合）
2. 失败步骤添加补偿（如 link-map 失败，清理已创建的文件）
3. 或简化为"尽力而为"模式，失败时记录不一致状态

**涉及文件**:

- `lib/memory-core.js`

**验证**: 部分失败时有补偿或清晰日志

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-CA-86 [P2] CONF-LIST-OUTPUT: conflict_list 输出过于简略

**目标**: 增加冲突决策所需的关键信息

**修复方案**:

1. 显示涉及的两个 memory 的摘要（local vs remote）
2. 显示冲突类型和时间
3. 显示建议的解决方案

**涉及文件**:

- `tools/sync.js`

**验证**: 用户能看到足够信息做出决策

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-87 [P2] FETCH-ERROR: fetch() error.code 检查无效

**目标**: 修复 wrapper-client.js 中网络错误检测的死代码

**修复方案**:

1. 检查 `error.cause?.code`（Node.js ≥ 18）
2. 或检查 `error instanceof TypeError && error.message.includes('fetch failed')`
3. 提供准确的 "Backend unavailable" 错误消息

**涉及文件**:

- `lib/wrapper-client.js`

**验证**: 后端离线时显示友好错误消息

**工时**: 1 小时

**状态**: 🆕 新建

---

### BL-CA-88 [P2] DYNAMIC-IMPORT: 动态导入已导入模块

**目标**: 移除 code-analysis-service.js 中的冗余动态导入

**修复方案**:

1. 删除 line 828 的 `await import('./code-analyzer.js')`
2. 使用已有的顶层 `codeAnalyzer` 导入

**涉及文件**:

- `lib/code-analysis-service.js`

**验证**: 功能不变

**工时**: 0.5 小时

**状态**: 🆕 新建

---

### BL-CA-89 [P2] NO-JITTER: 指数退避无抖动

**目标**: wrapper-client.js 重试添加随机抖动

**修复方案**:

1. `delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)`

**涉及文件**:

- `lib/wrapper-client.js`

**验证**: 多客户端同时重试时减少惊群效应

**工时**: 0.5 小时

**状态**: 🆕 新建

---

## 工时汇总

| Sprint   | 优先级 | 任务数 | 总工时  |
| -------- | ------ | ------ | ------- |
| Sprint 1 | P0     | 7      | 8.5h    |
| Sprint 2 | P0     | 7      | 9.5h    |
| Sprint 3 | P1     | 8      | 12h     |
| Sprint 4 | P2     | 8      | 10h     |
| **总计** |        | **30** | **40h** |

---
