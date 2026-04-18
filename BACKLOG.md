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

**更新时间**: 2026-04-11  
**版本**: v2.9.6  
**当前阶段**: 场景十一 — v3.2 架构升级（**已补充 9 个任务，覆盖度提升**）

> **资源集中**: 所有非 v3.2 任务已取消（BL-8, BL-15, BL-CA-12/14/19/20/21），全力投入 v3.2 开发

---

## 文档分类说明

本项目文档分为三类，分工明确：

| 类别         | 回答       | 受众       | 位置                               |
| ------------ | ---------- | ---------- | ---------------------------------- |
| **产品文档** | 怎么用？   | 用户       | 根目录 + `opencode-memory-plugin/` |
| **开发文档** | 怎么实现？ | 开发者     | `docs/` + 后端 docs                |
| **Backlog**  | 做什么？   | 项目管理者 | 根目录 `BACKLOG.md`                |

---

## 场景四：文档治理 — 消除冗余、归档过时、统一分类

> **背景**: 项目有 55+ 个 md 文件，大量过时文档（v2.3.0 时代）散布在多个位置。产品文档、开发文档、Backlog 混在一起。
>
> **目标**: 建立三类文档分工（产品/开发/Backlog），归档过时文档，修复关键不一致。
>
> **状态**: ✅ **已完成** - 9 个文档治理任务已完成（BL-26~BL-34 已归档）
>
> **未完成**: BL-8, BL-15 已取消（因 v3.2 架构升级优先）

---

### BL-8 [P1] 隐式偏好发现端到端验证 ⏸️ 已取消

**目标**: ~~完整测试隐式偏好发现→报告→确认→保存的全流程，修复发现的问题~~

**状态**: ⏸️ **已取消** - 因 v3.2 架构升级优先，资源集中

**取消说明**:

- v3.2 架构升级（WebSocket 重写、PrecomputeService、端口迁移）为当前最高优先级
- 隐式偏好发现功能可在 v3.2 稳定后再考虑
- 已完成的 Observer Agent 基础功能仍然可用

---

### BL-15 [P2] 后端增量同步对接 ⏸️ 已取消

**目标**: ~~对接后端 fingerprint API，实现代码分析结果的增量同步~~

**状态**: ⏸️ **已取消** - v3.2 WebSocket DIFF 模式将替代此功能

**取消说明**:

- v3.2 引入全新的 WebSocket 可靠连接和 DIFF 同步模式
- 增量同步功能将由 v3.2 的 syncPreview/syncFull 替代
- 指纹计算逻辑保留，用于本地缓存，但同步机制将重构

---

## 场景七：代码分析功能 — 已完成

> **背景**: 代码分析功能已实现但有严重 bug（`resolveProjectId` 未导入会崩溃，隐私过滤器失效），且零测试覆盖。
>
> **目标**: 修复所有 bug，补充测试，完善功能。
>
> **状态**: ✅ **核心功能已完成**（BL-9, BL-10, BL-11, BL-12, BL-15~BL-22, BL-26~BL-34）
>
> **归档说明**: 9 个文档治理任务（BL-26~BL-34）已全部完成并归档至 [`backlog_archive.md`](./backlog_archive.md)

---

## 场景十：代码分析功能 - 4周探索计划（真实使用场景验证）

> **背景**: 20周完整实施计划因"方向不确定、投入过大、风险过高"已调整为4周探索计划。
>
> **目标**: 快速验证代码分析功能的价值，在使用过程中决定下一步。
>
> **核心原则**: 让用户尽快"用起来"，根据实际痛点动态调整。
>
> **当前阶段**: ✅ **Phase 1 已完成** - 核心功能已交付（调用关系、缓存机制、Lookup API）
>
> **状态**: ⏸️ **已暂停** - 因 v3.2 架构升级优先，剩余任务已取消
>
> **取消任务**: BL-CA-12, BL-CA-14, BL-CA-19, BL-CA-20, BL-CA-21（已归档）
>
> **已完成**: BL-CA-11, BL-CA-13, BL-CA-15~18, BL-CA-27~34（已归档）

---

### BL-CA-12 [P1] 函数元数据补齐 - 多语言支持 ⏸️ 已取消

**目标**: ~~补齐 Python/Go/Rust/Java 函数的元数据字段~~

**状态**: ⏸️ **已取消** - v3.2 架构升级优先，多语言支持延后

**取消说明**:

- v3.2 架构升级是当前最高优先级
- JS/TS 元数据提取已完成，满足当前主要使用场景
- Python/Go/Rust/Java 多语言支持将在 v3.2 稳定后考虑

---

### BL-CA-14 [P1] 接口/特性提取 - Go/Rust/Java 支持 ⏸️ 已取消

**目标**: ~~提取接口（Go interface, Rust trait, Java interface）支持面向对象设计分析~~

**状态**: ⏸️ **已取消** - v3.2 架构升级优先，多语言接口支持延后

**取消说明**:

- v3.2 架构升级是当前最高优先级
- 接口提取功能对当前核心场景（JS/TS 代码分析）非必需
- 多语言接口支持将在 v3.2 稳定后考虑

---

### BL-CA-19 [P1] 场景3 - 重构影响分析 ⏸️ 已取消

**目标**: ~~实现查找函数引用功能，支持重构前评估变更影响范围~~

**状态**: ⏸️ **已取消** - v3.2 PrecomputeService 将提供替代方案

**取消说明**:

- v3.2 PrecomputeService 将提供更强大的调用关系分析
- 重构影响分析功能将由 v3.2 的图关系查询替代
- 当前基础调用关系功能（BL-CA-18）已满足基本需求

---

### BL-CA-20 [P1] 场景4 - 项目质量趋势追踪

**目标**: 实现项目代码质量历史追踪，展示质量变化趋势

**涉及范围**:

1. `lib/project-analyzer.js` - 新增 `saveAnalysisSnapshot()` 方法
2. 调用 `memory_write` 保存每次分析结果
3. 新增 `getQualityTrend()` 方法查询历史数据
4. `cli/code-analyzer.cjs` - 新增 `--trend` 选项

**前置依赖**: BL-CA-16 完成（代码质量评分）

**完成标准**:

1. 每次项目分析自动保存质量快照
2. 支持查询最近 N 次分析的质量变化
3. 输出趋势图表（文本形式）
4. 识别质量退化文件（复杂度上升）
5. 支持对比两个时间点的质量差异

**验证方式**:

1. 运行多次项目分析，验证快照保存成功
2. 查询趋势数据，验证历史记录完整
3. 验证质量退化文件识别准确
4. 运行 `npm test`，验证无回归

---

### BL-CA-20 [P1] 场景4 - 项目质量趋势追踪 ⏸️ 已取消

**目标**: ~~实现项目代码质量历史追踪，展示质量变化趋势~~

**状态**: ⏸️ **已取消** - v3.2 架构升级优先，质量趋势功能延后

**取消说明**:

- v3.2 架构升级是当前最高优先级
- 质量趋势追踪功能对当前核心场景非必需
- 可在 v3.2 稳定后考虑实现

---

### BL-CA-21 [P2] 场景5 - 符号导航支持 ⏸️ 已取消

**目标**: ~~增强代码导航功能，支持跳转到定义和跨文件符号搜索~~

**状态**: ⏸️ **已取消** - v3.2 架构升级优先，符号导航功能延后

**取消说明**:

- v3.2 架构升级是当前最高优先级
- 符号导航功能对当前核心场景非必需
- 可在 v3.2 稳定后考虑实现

---

### BL-CA-21 [P2] 场景5 - 符号导航支持

**目标**: 增强代码导航功能，支持跳转到定义和跨文件符号搜索

**涉及范围**:

1. `lib/code-analyzer.js` - 新增 `findSymbolDefinition()` 方法
2. 集成 `memory_search` 查询符号定义
3. `cli/code-analyzer.cjs` - 新增 `--goto` 选项
4. 支持符号类型过滤（函数/类/接口）

**前置依赖**: BL-CA-11 完成（函数元数据补齐），BL-CA-13 完成（类成员提取）

**完成标准**:

1. 支持按符号名查找定义位置
2. 输出包含：文件路径、行号、符号类型
3. 支持符号类型过滤
4. 支持模糊搜索（部分匹配）
5. 结果按相关性排序

**验证方式**:

1. 查找已知符号的定义，验证位置准确
2. 测试模糊搜索功能
3. 验证类型过滤有效
4. 运行 `npm test`，验证无回归

---

## 未完成任务状态

> **说明**: 以下非 v3.2 任务已取消，资源集中投入 v3.2 架构升级

| 任务     | 标题                     | 优先级 | 状态      | 取消原因                    |
| -------- | ------------------------ | ------ | --------- | --------------------------- |
| BL-8     | 隐式偏好发现端到端验证   | P1     | ⏸️ 已取消 | v3.2 架构升级优先           |
| BL-15    | 后端增量同步对接         | P2     | ⏸️ 已取消 | v3.2 WebSocket DIFF 替代    |
| BL-CA-12 | 函数元数据补齐 - 多语言  | P1     | ⏸️ 已取消 | v3.2 后再考虑               |
| BL-CA-14 | 接口/特性提取 - 多语言   | P1     | ⏸️ 已取消 | v3.2 后再考虑               |
| BL-CA-19 | 场景3 - 重构影响分析     | P1     | ⏸️ 已取消 | v3.2 PrecomputeService 替代 |
| BL-CA-20 | 场景4 - 项目质量趋势追踪 | P1     | ⏸️ 已取消 | v3.2 后再考虑               |
| BL-CA-21 | 场景5 - 符号导航支持     | P2     | ⏸️ 已取消 | v3.2 后再考虑               |

---

## 场景十二：Agent-Native Backlog API 实施

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
>
> **实施阶段**: Phase 1-5（5-8天）
>
> **状态**: ⏸️ **已取消** - 需要重新综合设计方案
>
> **取消原因**: 设计方案需要重新评估，暂停实施
>
> **归档说明**: 5 个实施阶段任务（BL-CA-22~BL-CA-26）已全部取消并归档至 [`backlog_archive.md`](./backlog_archive.md)

---

## 场景十一：v3.2 架构升级 — 统一架构实施

> **背景**: 基于 v3.1 文档审核结果和代码库分析，需要实施 v3.2 架构升级，包括 WebSocket 重构、PrecomputeService 服务化、Meilisearch SDK 升级、服务端口迁移。
>
> **目标**: 完成后端服务从 17999 到 18008 的完全替换，实现完整的可靠性保障和性能优化。

---

### BL-CA-35 [P0] v3.2 架构升级 - 总体文档编写

**目标**: 完成 v3.2 架构升级的所有 P0 核心文档编写，为后续开发提供完整的设计规范和实施指南

**涉及范围**:

1. `docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md` - 总体架构文档
2. `docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md` - 后端实施总览
3. `docs/v3.2/BACKEND-v3.2-WEBSOCKET.md` - WebSocket 详细设计
4. `docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md` - 预计算服务设计
5. `docs/v3.2/BACKEND-v3.2-MIGRATION.md` - 迁移指南
6. `docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md` - 插件端实施指南

**前置依赖**:

- v3.1 文档审核完成（UNIFIED-ARCHITECTURE-v3.1-problems-confirm.md）
- 技术栈确认（Python 3.10+, SurrealDB 3.0+, SDK 1.0.8）
- 决策确认（WebSocket 重写、PrecomputeService 重构、Meilisearch SDK 升级）

**完成标准**:

1. 所有 P0 文档编写完成并通过审核
2. 文档包含完整的目标、范围、前置依赖、完成标准、验证方式
3. WebSocket 设计包含心跳、指数退避重连、消息确认、DIFF 模式
4. PrecomputeService 设计包含批量处理、增量更新、性能监控
5. 迁移指南包含 17999 → 18008 的详细步骤
6. 插件端文档包含依赖升级（ws 8.20, pino, dotenv）

**验证方式**:

1. 文档评审：检查所有文档是否完整、一致、可实施
2. 技术评审：后端团队确认设计可行性
3. 架构评审：确认与现有系统的兼容性
4. 检查清单：所有完成标准项逐一确认

**状态**: ✅ 已完成（2026-04-17）

---

### BL-P-12 [P1] Precompute 客户端单元测试 ✅

**目标**: 为 Precompute 客户端编写完整单元测试

**涉及范围**:

1. `tests/precompute/client.test.js`
2. `tests/precompute/batch-processor.test.js`
3. Mock Precompute API

**前置依赖**:

- BL-P-6/7 完成
- 测试框架就绪

**完成标准**:

1. PrecomputeClient 测试覆盖率 > 80%
2. 批处理器测试覆盖率 > 80%
3. 指纹缓存测试覆盖率 > 80%

**验证方式**:

1. 测试执行：全部通过
2. 覆盖率报告：> 80%
3. Mock 测试：API 调用覆盖

**工时**: 1.5 天

**状态**: ✅ 已完成（2026-04-17）

---

### BL-P-13 [P1] 端到端集成测试 ✅

**目标**: 编写端到端集成测试，验证完整流程

**涉及范围**:

1. `tests/e2e/test-backend-api.test.js` - 后端 API E2E 测试

**前置依赖**:

- 后端服务就绪 ✅
- PrecomputeClient 完成 ✅

**完成标准**:

1. Health Check 测试通过 ✅
2. Memory CRUD 测试通过 ✅
3. Code Fingerprint Sync 测试通过 ✅
4. Precompute Analysis 测试通过 ✅
5. Symbol Search 测试通过 ✅
6. Graph Relations 测试通过 ✅
7. Sync Operations 测试通过 ✅

**验证方式**:

1. E2E 测试执行：11/11 全部通过

**工时**: 2 天

**状态**: ✅ 已完成（2026-04-17）

---

## 统计

| 分类     | 任务数 | P0     | P1    | 总工时    |
| -------- | ------ | ------ | ----- | --------- |
| Phase 1  | 1      | 1      | 0     | 0.5 天 ✅ |
| Phase 2  | 4      | 4      | 0     | 8 天 ✅   |
| Phase 3  | 2      | 2      | 0     | 5 天 ✅   |
| Phase 4  | 3      | 3      | 0     | 2 天 ✅   |
| Phase 5  | 3      | 3      | 0     | 5.5 天 ✅ |
| **总计** | **13** | **13** | **0** | **21 天** |

> **v3.2 完成度**: 100% — 所有 Phase 1-5 全部完成 (13/13 tasks)

---

## Phase 6: WebSocket 接入（v3.2.1）

> **目标**: 将后端已就绪的 WebSocket 实时推送接入插件端  
> **依据**: 后端接入指南 `websocket-integration-guide.md` + 技术回复 `websocket-integration-reply-20260417.md`  
> **策略**: 阶段 1 — 使用 `mode=full`，diff/subscribe/sync_request 等后端 v3.2.1 修复后再接入

---

### BL-P-14 [P0] 修复 WebSocket 协议映射

**目标**: 修复 ReliableWebSocketClient 与后端实际 API 的协议不匹配，使客户端能正确处理后端消息

**涉及范围**:

1. `lib/websocket/reliable-client.js` — handleMessage 逻辑修改：
   - 消息类型识别：`type === 'memory_change'` + 读 `message.action`（当前错误检查 `message.type === 'CREATE'`）
   - ACK 字段：`seq`（当前错误使用 `_ackId`）
   - 新增 `connected` 消息处理：保存 `session_id`
   - 新增 `error` 消息处理：处理 `SESSION_EXPIRED`
2. `lib/websocket/heartbeat.js` — 禁用主动 ping，改为被动回复后端 ping
3. `lib/websocket/ack-manager.js` — ACK 字段 `_ackId` → `seq`，匹配后端格式

**前置依赖**:

- 后端 WebSocket 已就绪 ✅
- 后端确认心跳由后端单方面发起 ✅
- 后端确认使用 `mode=full`（diff 有 bug）✅

**完成标准**:

1. `connected` 消息正确保存 `session_id`
2. `memory_change` 消息按 `msg.action` 分发（CREATE/UPDATE/DELETE）
3. ACK 使用 `seq` 字段发送
4. 心跳只回复 pong，不主动发 ping
5. `error` 消息（SESSION_EXPIRED）正确处理

**验证方式**:

1. 单元测试：mock 后端消息，验证 handleMessage 行为
2. 语法检查：`node -c reliable-client.js`

**工时**: 2 小时

**状态**: ✅ 已完成 (2026-04-18) — 协议映射修复：`type: "change"` + `action` + `result` 字段，被动心跳，seq ACK

---

**目标**: 在 plugin.js 启动时自动建立 WebSocket 连接，接收实时变更通知

**涉及范围**:

1. `plugin.js` — 添加 WebSocket 初始化逻辑：
   - 检查后端 enabled 配置
   - 构建 WebSocket URL（`ws://localhost:18008/ws/memories/live`）
   - 调用 ReliableWebSocketClient.connect()
   - 注册 memory_change handler
2. `lib/ws-client.js` — 评估是否保留旧版 SyncWebSocketClient 或统一使用新版 ReliableWebSocketClient

**前置依赖**:

- BL-P-14 完成（协议映射修复）

**完成标准**:

1. plugin.js 启动时自动连接后端 WebSocket
2. 连接成功后日志输出 `[WebSocket] Connected`
3. 后端不可用时优雅降级（不阻塞插件启动）
4. 收到 memory_change 通知时触发 link-map 更新

**验证方式**:

1. 启动插件后检查 WebSocket 连接状态
2. 通过 HTTP API 上传记忆，验证 WebSocket 收到通知
3. 后端不可用时插件正常启动（不报错）

**工时**: 2 小时

**状态**: ✅ 已完成 (2026-04-18) — plugin.js 自动连接 WebSocket，优雅降级

---

**目标**: 编写端到端测试验证 WebSocket 接入完整流程

**涉及范围**:

1. `tests/websocket/test-integration.js` — 新增集成测试：
   - 连接 → 收到 connected 消息
   - 心跳 pong 回复
   - memory_change 消息处理 + ACK 回复
   - 断线重连（携带 session_id）
   - 后端不可用时降级
2. 复用 `tests/e2e/test-backend-api.test.js` 中的后端健康检查

**前置依赖**:

- BL-P-14 完成
- BL-P-15 完成
- 后端服务运行

**完成标准**:

1. 连接测试通过（connected + session_id）
2. 心跳测试通过（ping → pong）
3. 变更通知测试通过（memory_change → ACK）
4. 重连测试通过（断线 → 重连成功）
5. 降级测试通过（后端不可用不阻塞）

**验证方式**:

1. `npx vitest run tests/websocket/test-integration.js` 全部通过
2. 或 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js tests/websocket/`

**工时**: 2 小时

**状态**: ✅ 已完成 (2026-04-18) — 7 个集成测试全部通过（连接/心跳/状态追踪）

---

**目标**: 更新产品文档和开发文档，反映 WebSocket 接入状态

**涉及范围**:

1. `README.md` — 更新实时同步状态（从 "library modules not yet wired" → 接入状态）
2. `CHANGELOG.md` — 补充 WebSocket 接入条目
3. `opencode-memory-plugin/CONFIGURATION.md` — 添加 WebSocket 环境变量说明
4. `AGENTS.md` — 更新模块映射表

**前置依赖**:

- BL-P-15 完成（接入确认可用）

**完成标准**:

1. README 准确反映 WebSocket 接入状态
2. CONFIGURATION.md 包含 WS\_\* 环境变量
3. CHANGELOG 记录接入变更

**验证方式**:

1. `npm run lint:md` 通过
2. 人工审阅内容准确性

**工时**: 1 小时

**状态**: ✅ 已完成 (2026-04-18) — README/CHANGELOG/BACKLOG 已更新

---

| Phase 7 | 4 | 4 | 0 | 3.5 小时 |

---

_文档版本: v3.2.2_  
_更新时间: 2026-04-18_  
_状态: Phase 7 全部完成 ✅_

---

## Phase 7: 代码质量修复（v3.2.2）

> **目标**: 修复 Phase 6 code review 发现的问题  
> **依据**: Phase 6 全量代码 review 报告  
> **策略**: 按优先级修复，先 🔴 必须修复，再 🟡 建议修复

---

### BL-P-18 [P0] 修复 pong 缺少 timestamp + 心跳检测窗口过长

**目标**: 修复 pong 消息未携带 timestamp 导致后端可能无法匹配 ping-pong 对，同时缩短心跳检测窗口

**涉及范围**:

1. `lib/websocket/reliable-client.js` 第 118 行：
   - `this.send({ type: 'pong' })` → `this.send({ type: 'pong', timestamp: message.timestamp })`
   - 匹配后端接入指南要求
2. `lib/websocket/heartbeat.js` 第 57 行：
   - `checkInterval = this.interval * (this.maxMissed + 1)` → `this.interval * this.maxMissed`
   - 当前 30000 × 3 = 90s 太长，改为 30000 × 2 = 60s
3. `lib/websocket/heartbeat.js`：
   - 移除未使用的 `this.timeout` 字段（旧版主动 ping 遗留）
   - `getStats()` 中移除 `timeout` 返回值

**前置依赖**:

- 无

**完成标准**:

1. pong 消息包含 `timestamp` 字段，值与收到的 ping 一致
2. 心跳检测窗口 ≤ 60s（interval × maxMissed）
3. `HeartbeatManager` 不再暴露未使用的 `timeout` 字段
4. 现有 47 个 WebSocket 单元测试 + 7 个集成测试全部通过

**验证方式**:

1. 单元测试：`npx jest --testPathPattern="websocket" --no-coverage`
2. 集成测试：`npx jest --testPathPattern="websocket.integration" --no-coverage`
3. 语法检查：`node -c reliable-client.js && node -c heartbeat.js`

**工时**: 0.5 小时

**状态**: ✅ 已完成 (2026-04-18) — pong 携带 timestamp，检测窗口 60s，移除 timeout 字段

**目标**: 修复 DiffSubscription 中的 2 个 bug（属性访问错误、双重 stringify），并评估是否应移除该死代码

**涉及范围**:

1. `lib/websocket/diff-subscription.js`：
   - 第 13/30 行：`this.client.state` → `this.client.getState()`
   - 第 13/30 行：`'CONNECTED'` → `'connected'`（状态值是小写字符串）
   - 第 24/39 行：`this.client.send(JSON.stringify(...))` → `this.client.send(...)`（send 内部已 stringify）
2. `lib/websocket/reliable-client.js` 第 44 行：
   - 评估 `this.diffSubscription = new DiffSubscription(this)` 是否应保留
   - 如果保留：确保 DiffSubscription 依赖修复
   - 如果移除：移除 import 和构造，减少不必要的 `fast-json-patch` 依赖加载

**前置依赖**:

- 无

**完成标准**:

1. DiffSubscription 属性访问正确（使用 `getState()` + 小写状态值）
2. 不再双重 stringify（send 内部处理序列化）
3. 如果保留 DiffSubscription：现有 DiffSubscription 单元测试通过
4. 如果移除 DiffSubscription：移除 import、构造、相关测试文件
5. 全量单元测试通过

**验证方式**:

1. 单元测试：`npx jest --testPathPattern="websocket" --no-coverage`
2. 如果移除：确认 `diff-subscription.js` 和 `tests/websocket/diff-subscription.test.js` 已删除

**工时**: 1 小时

**状态**: ✅ 已完成 (2026-04-18) — 移除 DiffSubscription 死代码及 import

**目标**: 让 WebSocket 实例可被外部访问（关闭、状态查询），并在连接 URL 中显式指定 `mode=full`

**涉及范围**:

1. `plugin.js` 第 73 行：
   - 将 `wsClient` 存储到模块级变量或挂载到返回对象上
   - 提供 `getWebSocketClient()` 方法或暴露在返回值中
2. `lib/websocket/reliable-client.js` 第 72-80 行 `buildUrl()`：
   - 添加 `mode` 参数支持：`url.searchParams.set('mode', this.mode || 'full')`
   - 构造函数接受 `options.mode`，默认 `'full'`

**前置依赖**:

- 无

**完成标准**:

1. `wsClient` 实例可通过返回对象或导出方法访问
2. WebSocket 连接 URL 包含 `mode=full` 参数
3. 插件启动时日志显示完整 URL（含 mode 参数）
4. 全量测试通过

**验证方式**:

1. 单元测试通过
2. 手动检查 plugin.js 导出的 WebSocket 实例
3. 检查连接 URL 包含 `mode=full`

**工时**: 1 小时

**状态**: ✅ 已完成 (2026-04-18) — wsClient 存储到模块变量，buildUrl 添加 mode=full

**目标**: 修复集成测试后端不可用时静默通过的问题，对齐 ack-manager API 与后端协议

**涉及范围**:

1. `tests/integration/websocket.integration.test.js`：
   - 所有 `if (!backendUp) return;` → 改为动态 skip（使用 `it.skip()` 或 `describe.skip()`）
   - 确保 Jest 报告正确的 skip 数量
2. `lib/websocket/ack-manager.js`：
   - `sendWithAck` 的 `_msgId` + `_requiresAck` 标记为内部协议（添加注释说明）
   - 或更新为支持 `seq` 字段（匹配后端协议）
   - 评估 `sendWithAck` 是否应该被废弃（当前未被生产代码使用）

**前置依赖**:

- 无

**完成标准**:

1. 后端不可用时测试显示为 `skipped` 而非 `passed`
2. ack-manager API 文档或注释说明其与后端协议的关系
3. 全量测试通过

**验证方式**:

1. 停止后端后运行测试，确认 skip 数量正确
2. `npx jest --testPathPattern="websocket" --no-coverage`

**工时**: 1 小时

**状态**: ✅ 已完成 (2026-04-18) — 集成测试动态 skip，ack-manager 添加协议说明

| 任务    | 优先级 | 工时 | 类型              |
| ------- | ------ | ---- | ----------------- |
| BL-P-18 | P0     | 0.5h | 🔴 Bug fix        |
| BL-P-19 | P0     | 1h   | 🔴 Bug fix + 清理 |
| BL-P-20 | P1     | 1h   | 🟡 改进           |
| BL-P-21 | P2     | 1h   | 🟢 优化           |

---

## Phase 8: 清理与文档同步（v3.2.2）

> **目标**: 清理 Phase 7 遗留的孤立文件和过时文档  
> **依据**: Phase 7 移除 DiffSubscription 后，测试文件和文档未同步更新

---

### BL-P-22 [P1] 移除孤立 diff-subscription 测试 + 同步 CHANGELOG/README

**目标**: 移除已删除模块的测试文件，更新 CHANGELOG 和 README.npm.md 反映 v3.2.2

**涉及范围**:

1. `tests/websocket/diff-subscription.test.js` — 删除（DiffSubscription 模块已在 BL-P-19 中移除，20 个测试跑的是已移除的代码）
2. `CHANGELOG.md` — 添加 v3.2.2 条目（Phase 7 的 4 项修复）
3. `opencode-memory-plugin/README.npm.md` — 版本号更新 v3.2.0 → v3.2.2
4. `BACKLOG.md` — 同步旧 BL-P 条目的实际状态（BL-P-2~5, BL-P-8~13 标题标 ✅ 但正文仍显示 🆕）

**前置依赖**:

- BL-P-19 完成（DiffSubscription 已移除）✅
- Phase 7 全部完成 ✅

**完成标准**:

1. `diff-subscription.test.js` 已删除
2. CHANGELOG 包含 v3.2.2 条目，列出 BL-P-18~21 的修复内容
3. README.npm.md 版本号显示 v3.2.2
4. BACKLOG.md 中旧 BL-P 条目状态同步为 ✅
5. `npm run lint:md` 通过
6. 全量单元测试通过（预期减少 20 个测试）

**验证方式**:

1. 确认 `diff-subscription.test.js` 不存在
2. `npx jest --testPathPattern="websocket" --no-coverage` 通过（预期 27 tests，无 diff-subscription）
3. `npm run lint:md` 通过
4. 全量单元测试通过

**工时**: 0.5 小时

**状态**: 🔄 进行中（待聚焦测试验证）
