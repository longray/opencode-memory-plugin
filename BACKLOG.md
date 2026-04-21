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
