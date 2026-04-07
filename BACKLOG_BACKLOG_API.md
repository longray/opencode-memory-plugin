# Backlog API 实施任务

## 场景十一：Agent-Native Backlog API 实施

> **背景**: 基于 BACKLOG_V2_DESIGN.md 最终方案，实施 Backlog 管理功能
>
> **目标**: 基于 Memory 系统实现 Backlog 管理，采用 ULID、4状态、Metadata 嵌套方案
>
> **设计文档**: [BACKLOG_V2_DESIGN.md](./BACKLOG_V2_DESIGN.md)
>
> **关键决策**:
>
> - ID: ULID 天然唯一，字典序可排序
> - 状态机: 4状态（backlog → in_progress → review → done）
> - 数据模型: Metadata 嵌套，零 Schema 变更

---

### BL-CA-22 [P0] Phase 1 - 扩展 Meilisearch 索引配置

**目标**: 扩展 Meilisearch 索引配置，支持 Backlog 特有字段的过滤和排序

**涉及范围**:

1. `wrapper/src/utils/meili_client.py` - 更新 DEFAULT_INDEX_SETTINGS
2. 添加 filterableAttributes: metadata.status, metadata.priority, metadata.scene, metadata.blocked
3. 添加 sortableAttributes: metadata.priority, metadata.estimated_hours, metadata.started_at
4. 重建索引（开发阶段可立即重建）

**前置依赖**: 无

**完成标准**:

1. Meilisearch 配置更新完成
2. 支持按 metadata.status 过滤
3. 支持按 metadata.priority 排序
4. 索引重建成功
5. 查询测试通过

**验证方式**:

1. 检查 Meilisearch 配置是否正确更新
2. 测试过滤查询: `metadata.status = "in_progress"`
3. 测试排序查询: `metadata.priority:desc`
4. 验证索引重建无错误

---

### BL-CA-23 [P0] Phase 2 - 实现 backlog_create 工具

**目标**: 实现 backlog_create 工具，支持创建 Backlog 任务

**涉及范围**:

1. 新建 `opencode-memory-plugin/tools/backlog.js`
2. 实现 `backlog_create` 工具
3. 生成 ULID 作为 source_id
4. 构建 5要素内容格式
5. 调用 memory_write 写入

**前置依赖**: BL-CA-22 完成

**完成标准**:

1. backlog_create 工具可用
2. 生成 ULID 格式的 source_id
3. 正确构建 metadata 字段（priority, scene, status等）
4. 5要素内容格式正确
5. 返回创建成功的 Backlog ID

**验证方式**:

1. 调用 backlog_create 创建任务
2. 验证 memory_write 调用参数正确
3. 检查生成的 metadata 字段完整
4. 验证 ULID 格式正确
5. 运行 npm test，验证无回归

---

### BL-CA-24 [P0] Phase 3 - 实现 backlog_list 工具

**目标**: 实现 backlog_list 工具，支持查询 Backlog 任务列表

**涉及范围**:

1. 在 `backlog.js` 中实现 `backlog_list` 工具
2. 支持按 status、priority、scene 过滤
3. 支持排序和分页
4. 格式化输出结果

**前置依赖**: BL-CA-23 完成

**完成标准**:

1. backlog_list 工具可用
2. 支持按 metadata.status 过滤
3. 支持按 metadata.priority 过滤
4. 支持按 metadata.scene 过滤
5. 输出格式清晰可读

**验证方式**:

1. 调用 backlog_list 查询所有任务
2. 测试 status 过滤: `backlog_list(status="in_progress")`
3. 测试 priority 过滤: `backlog_list(priority="P0")`
4. 测试 scene 过滤: `backlog_list(scene="代码分析v1.4")`
5. 验证返回结果格式正确

---

### BL-CA-25 [P1] Phase 4 - 实现 backlog_update_status 工具

**目标**: 实现 backlog_update_status 工具，支持更新 Backlog 任务状态

**涉及范围**:

1. 在 `backlog.js` 中实现 `backlog_update_status` 工具
2. 验证状态流转（4状态机）
3. 自动更新 started_at/completed_at 时间戳
4. 处理 blocked 状态（metadata.blocked）

**前置依赖**: BL-CA-24 完成

**完成标准**:

1. backlog_update_status 工具可用
2. 验证 4 状态流转规则
3. 状态变为 in_progress 时自动设置 started_at
4. 状态变为 done 时自动设置 completed_at
5. 支持设置 metadata.blocked 和 blocked_reason

**验证方式**:

1. 更新状态从 backlog → in_progress
2. 验证 started_at 自动设置
3. 更新状态从 in_progress → done
4. 验证 completed_at 自动设置
5. 测试非法状态流转被拒绝

---

### BL-CA-26 [P1] Phase 5 - 测试和文档

**目标**: 完成测试覆盖和文档更新

**涉及范围**:

1. 编写单元测试（backlog.test.js）
2. 更新 CONFIGURATION.md，添加 Backlog 配置说明
3. 更新 QUICK_START.md，添加 Backlog 快速入门
4. 更新 AGENTS.md，添加 Backlog 使用说明

**前置依赖**: BL-CA-25 完成

**完成标准**:

1. 单元测试覆盖率 > 80%
2. CONFIGURATION.md 更新完成
3. QUICK_START.md 更新完成
4. AGENTS.md 更新完成
5. npm run lint:md 通过

**验证方式**:

1. 运行 npm test，所有测试通过
2. 检查测试覆盖率报告
3. 验证文档更新完整
4. 运行 lint:md，无错误
5. 端到端测试通过

---

## 任务依赖关系

```text
BL-CA-22 (Meilisearch配置)
         │
         ▼
BL-CA-23 (backlog_create)
         │
         ▼
BL-CA-24 (backlog_list)
         │
         ▼
BL-CA-25 (backlog_update_status)
         │
         ▼
BL-CA-26 (测试和文档)
```

## 实施优先级

| 优先级 | 任务     | 阶段    | 预期时间 | 预期收益 |
| ------ | -------- | ------- | -------- | -------- |
| P0     | BL-CA-22 | Phase 1 | 0.5天    | 基础设施 |
| P0     | BL-CA-23 | Phase 2 | 1-2天    | 核心功能 |
| P0     | BL-CA-24 | Phase 3 | 1-2天    | 核心功能 |
| P1     | BL-CA-25 | Phase 4 | 1天      | 状态管理 |
| P1     | BL-CA-26 | Phase 5 | 1-2天    | 质量保证 |

**总计**: 5-8天

---

## 变更历史

| 版本   | 日期       | 变更内容                                     |
| ------ | ---------- | -------------------------------------------- |
| v1.0.0 | 2026-04-07 | 初始创建，基于 BACKLOG_V2_DESIGN.md 最终方案 |
