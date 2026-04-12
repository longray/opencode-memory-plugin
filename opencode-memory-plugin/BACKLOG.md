# Plugin Backlog

> **项目**: OpenCode Memory Plugin (opencode-memory-plugin)
> **当前版本**: v2.9.1
> **目标版本**: v3.2.0
> **创建时间**: 2026-04-10

---

## 编号规则

- **格式**: `BL-P-{N}`（P = Plugin，与主项目 BL-CA-{N} 区分）
- **永不复用、永不跳号**
- 创建新任务前检查最大编号：`grep "^### BL-P-" BACKLOG.md | tail -1`

---

## 文档分类说明

本项目文档分为三类，分工明确：

| 类别         | 回答       | 受众       | 位置                               |
| ------------ | ---------- | ---------- | ---------------------------------- |
| **产品文档** | 怎么用？   | 用户       | 根目录 + `opencode-memory-plugin/` |
| **开发文档** | 怎么实现？ | 开发者     | `docs/`                            |
| **Backlog**  | 做什么？   | 项目管理者 | 根目录 `BACKLOG.md` + 本文件       |

---

## 优先级定义

| 优先级 | 含义            | 发布阻塞     | 示例                         |
| ------ | --------------- | ------------ | ---------------------------- |
| **P0** | 关键 / Critical | 是           | 核心功能缺失，导致系统不可用 |
| **P1** | 高 / High       | 否但影响体验 | 重要功能不完善，有降级方案   |
| **P2** | 中 / Medium     | 否           | 改进项、优化、补充           |
| **P3** | 低 / Low        | 否           | 长期改进、nice-to-have       |

---

## v3.2 迁移任务

> **背景**: v3.2 架构升级涉及 WebSocket 重写、PrecomputeService 服务化、Schema 迁移、端口迁移。
> **设计文档**: [../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md)
> **API 规范**: [../../docs/v3.2/PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md)
> **实施追踪**: [../../docs/v3.2/RTM.md](../../docs/v3.2/RTM.md)

---

### BL-P-1 [P0] WebSocket 客户端实现 — 心跳与重连

**目标**: 实现可靠的 WebSocket 客户端，支持心跳保活和指数退避重连

**涉及范围**:

1. `lib/websocket/reliable-client.js` — 实现 `ReliableWebSocketClient` 类
2. `lib/websocket/state-manager.js` — 状态机管理
3. `lib/websocket/heartbeat.js` — 心跳管理器
4. 新增心跳机制（30s 间隔，2 次未响应触发重连）
5. 新增指数退避重连（1s → 2s → 4s... 最大 10 次）

**RTM 映射**: WS-001, WS-002, WS-003, WS-004

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md) §3.1

**完成标准**:

1. ✅ `ReliableWebSocketClient` 类实现心跳发送（`ping`/`pong`）
2. ✅ 2 次未收到 `pong` 后自动关闭并触发重连
3. ✅ 重连延迟为指数退避：`baseDelay * 2^retryCount`，上限 300s
4. ✅ 最大重连 10 次，超出后进入降级模式
5. ✅ 连接恢复后自动重置重连计数器
6. ✅ `lib/config.js` 中可配置心跳间隔和最大重试次数

**验证方式**:

1. ✅ 单元测试：`tests/websocket/reliable-client.test.js` — 16 tests passing
2. ⏳ 集成测试：启动后端 WebSocket 服务，验证客户端自动连接和心跳
3. ⏳ 故障测试：手动断开后端，观察重连行为
4. ⏳ 边界测试：验证达到最大重连次数后的降级行为

**状态**: ✅ **已完成 (单元测试通过，集成测试待后端就绪)**

---

### BL-P-2 [P0] WebSocket 客户端实现 — 消息确认 (ACK)

**目标**: 实现消息发送确认机制，确保消息可靠投递

**涉及范围**:

1. `lib/websocket/ack-manager.js` — 新增 `AckManager` 类
2. `lib/websocket/reliable-client.js` — 集成 ACK 支持
3. 消息发送等待 ACK 确认
4. 超时重试（5s 超时，最多 3 次重试）

**RTM 映射**: WS-005

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md) §4.3

**完成标准**:

1. ✅ `AckManager` 类实现 `sendWithAck(ws, message, timeout, maxRetries)`
2. ✅ 消息发送后启动 5s 超时计时器（可配置）
3. ✅ 收到 ACK 后清除超时，resolve Promise
4. ✅ 超时后自动重试（最多 3 次，可配置）
5. ✅ 超时和取消操作清理 pending 状态

**验证方式**:

1. ✅ 单元测试：`tests/websocket/ack-manager.test.js` — 11 tests passing
2. ⏳ 集成测试：发送消息 → 收到 ACK → 验证 Promise resolve
3. ⏳ 故障测试：模拟无 ACK 响应，验证超时重试

**状态**: ✅ **已完成 (单元测试通过，集成测试待后端就绪)**

---

### BL-P-3 [P1] WebSocket 客户端实现 — DIFF 模式

**目标**: 实现 DIFF 增量同步模式，减少数据传输量

**涉及范围**:

1. `lib/ws-client.js` — 扩展 `ReliableWebSocketClient` 支持 DIFF 订阅
2. 本地缓存维护（内存）
3. JSON Patch 应用

**RTM 映射**: WS-006

**设计文档**: [../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)

**完成标准**:

1. 支持 `LIVE SELECT DIFF` 订阅模式
2. 维护本地状态缓存
3. 收到 JSON Patch 后正确应用到本地缓存
4. 支持订阅取消和重新订阅

**验证方式**:

1. 单元测试：JSON Patch 应用逻辑
2. 集成测试：订阅 → 修改后端数据 → 验证收到 DIFF
3. 性能测试：DIFF 模式 vs 全量模式，数据量减少 ≥90%

**状态**: ⏳ 待实现

**前置依赖**: BL-P-1 完成（基础 WebSocket 客户端）

---

### BL-P-4 [P0] 端口迁移 17999 → 18008（插件端）

**目标**: 更新插件端所有端口配置，适配后端 v3.2 新端口

**涉及范围**:

1. ✅ `lib/wrapper-client.js` — 默认端口改为 18008，支持 API_PORT 环境变量
2. ✅ `lib/config.js` — 新增 `API_PORT` 配置项（默认 18008）
3. ✅ `lib/ws-client.js` — WebSocket URL 端口更新
4. ✅ `agents/memory-automation.md` — 无端口引用（无需更新）
5. ✅ `agents/memory-consolidate.md` — 无端口引用（无需更新）
6. ✅ `plugin.js` — 无端口引用（无需更新）
7. ✅ `tests/websocket/reliable-client.test.js` — 测试端口更新
8. ✅ `tests/phase-a-integration.test.js` — 测试端口更新
9. ✅ `tests/test-sync-methods.test.js` — 测试端口更新
10. ✅ `README.md` — 文档更新
11. ✅ `CONFIGURATION.md` — 文档更新
12. ✅ `TROUBLESHOOTING.md` — 文档更新
13. ✅ `CODE-ANALYSIS.md` — 文档更新
14. ✅ `QUICK_START.md` — 文档更新
15. ✅ `docs/DEVELOPMENT.md` — 文档更新
16. ✅ `docs/ARCHITECTURE.md` — 文档更新

**RTM 映射**: DEP-005（插件端部分）

**设计文档**: [../../docs/v3.2/BACKEND-v3.2-MIGRATION.md](../../docs/v3.2/BACKEND-v3.2-MIGRATION.md)

**完成标准**:

1. ✅ `wrapper-client.js` 默认端口为 18008
2. ✅ 支持环境变量 `API_PORT` 覆盖（向后兼容 17999）
3. ✅ WebSocket URL 使用新端口
4. ✅ 所有文档中端口引用已更新（或标注为旧版）
5. ✅ 全局搜索 `17999`，仅出现在向后兼容注释中

**验证方式**:

1. ✅ 全局搜索 `17999`，确认仅出现在向后兼容注释中
2. ⏳ 连接测试：使用默认配置连接 18008 端口（待后端就绪）
3. ⏳ 兼容性测试：设置 `API_PORT=17999` 可正常连接旧版后端（待后端就绪）
4. ✅ 运行 `npm test`，验证无回归 — **52 tests passing**

**状态**: ✅ **已完成**

**前置依赖**: 后端 v3.2 服务就绪

---

### BL-P-5 [P0] 插件端依赖升级

**目标**: 升级插件依赖以支持 v3.2 新功能

**涉及范围**:

1. ✅ `package.json` — 依赖版本更新
   - ✅ `ws`: `^8.18.0` → `^8.20.0`
   - ✅ 新增 `pino`: `^9.5.0`
   - ✅ 新增 `dotenv`: `^16.4.5`
   - ✅ 新增 `pino-pretty`: `^13.0.0`（devDependencies）
   - ✅ 新增 `@types/ws`: `^8.5.13`（devDependencies）
2. ✅ `lib/logger.js` — 新增 pino 结构化日志封装
3. ✅ `lib/config.js` — 新增 dotenv 环境变量加载

**RTM 映射**: VER-004

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md) §1

**完成标准**:

1. ✅ `npm install` 无错误
2. ✅ pino 日志封装可用（info/warn/error/debug 级别）
3. ✅ dotenv 自动加载 `.env` 文件
4. ✅ 开发环境使用 `pino-pretty` 美化输出
5. ✅ 生产环境使用 pino JSON 格式

**验证方式**:

1. ✅ `npm list ws pino dotenv` 验证版本
2. ✅ 单元测试：`tests/logger.test.js` 11 tests passing
3. ✅ 单元测试：`tests/config.test.js` 14 tests passing
4. ⏳ 集成测试：插件启动后日志正常输出（待后端就绪）
5. ✅ 运行 `npm test`，验证无回归 — **25 tests passing**

**状态**: ✅ **已完成**

---

### BL-P-6 [P1] 代码指纹增量同步完善

**目标**: 完善代码指纹（code-fingerprint.js）与后端增量同步 API 的对接

**涉及范围**:

1. `lib/code-fingerprint.js` — 指纹计算逻辑优化
2. `lib/wrapper-client.js` — 新增 `syncCodeFingerprints()` 方法
3. `lib/code-analysis-service.js` — 集成指纹检查到分析流程

**RTM 映射**: PC-002

**设计文档**: [../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)

**完成标准**:

1. 计算文件指纹（content_hash: SHA256、symbols_hash: 函数名+参数哈希）
2. 调用后端 fingerprint API 获取需要更新的文件列表
3. 只上传后端返回的变更文件
4. 本地指纹持久化到 `.code_fingerprints.json`
5. 后端 API 失败时回退到全量上传

**验证方式**:

1. 首次分析项目，验证全量上传成功
2. 修改单个文件，验证仅上传变更文件
3. 删除 `.code_fingerprints.json`，验证全量同步触发
4. 模拟后端 API 失败，验证回退到全量上传
5. 运行 `npm test`，验证无回归

**状态**: ⏳ 待实现

**前置依赖**: BL-P-4 完成（端口迁移），后端增量同步 API 就绪

---

### BL-P-7 [P1] Memory CRUD 工具适配 v3.2 API

**目标**: 更新 `tools/core.js` 中的 Memory CRUD 操作，适配 v3.2 后端 API

**涉及范围**:

1. `tools/core.js` — `memory_write`、`memory_read` 适配新 API
2. `lib/wrapper-client.js` — 更新 HTTP 请求方法和路径
3. 新增 v3.2 字段支持（tenant_id 等）

**RTM 映射**: API-001

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md) §2

**完成标准**:

1. `memory_write` 适配新 API 格式（含 tenant_id）
2. `memory_read` 适配新 API 格式
3. 请求头包含正确的认证信息
4. 错误处理与新 API 错误码对齐
5. 向后兼容：旧版后端仍可使用

**验证方式**:

1. 单元测试：tools/core.js 所有方法
2. 集成测试：写入 → 读取 → 验证内容一致
3. 回归测试：`npm test` 全部通过

**状态**: ⏳ 待实现

**前置依赖**: BL-P-4 完成（端口迁移）

---

### BL-P-8 [P1] Code Analysis 工具适配 v3.2 API

**目标**: 更新代码分析相关工具，适配 v3.2 后端 PrecomputeService API

**涉及范围**:

1. `lib/code-analysis-service.js` — 适配新的代码分析 API
2. `lib/code-analyzer.js` — 本地分析逻辑保留，上传 API 更新
3. `lib/memory-id-cache.js` — 适配新的 memory_id 返回格式

**RTM 映射**: API-002, PC-003

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md) §3

**完成标准**:

1. 代码分析结果上传到 v3.2 API
2. memory_id 缓存正确更新
3. 调用关系创建 API 对接
4. 本地分析功能不受影响（Oxc + Tree-sitter）

**验证方式**:

1. 单元测试：分析结果上传、缓存更新
2. 集成测试：分析文件 → 上传 → 查询验证
3. 运行 `npm test`，验证无回归

**状态**: ⏳ 待实现

**前置依赖**: BL-P-4 完成（端口迁移），BL-P-6 完成（指纹同步）

---

### BL-P-9 [P0] WrapperClient 端口和 API 适配

**目标**: 更新 `WrapperClient` 类，支持 v3.2 新端口和新 API 格式

**涉及范围**:

1. ✅ `lib/wrapper-client.js` — 端口更新、API 方法签名更新
2. ✅ 新增 v3.2 API 方法（lookup、calls/batch、references、dependencies）
3. ⏳ 认证头更新（如果 v3.2 有变化）

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md) §1

**完成标准**:

1. ✅ 默认连接 `localhost:18008/api/v1`
2. ✅ 支持环境变量 `API_PORT` 配置
3. ✅ 新增 `lookupMemory()`, `createCallRelations()`, `getCallReferences()`, `getCallDependencies()` 方法
4. ✅ 旧 API 方法保持向后兼容
5. ⏳ 认证错误有清晰的用户提示

**验证方式**:

1. ✅ 代码审查：所有新方法已实现
2. ⏳ 集成测试：连接 v3.2 后端，调用所有新 API（待后端就绪）
3. ⏳ 兼容性测试：连接旧版后端，旧方法正常工作（待后端就绪）
4. ✅ 运行 `npm test`，验证无回归

**状态**: ✅ **已完成 (代码实现完成，集成测试待后端就绪)**

**前置依赖**: BL-P-4 完成（端口迁移）

---

## 测试与验证任务

---

### BL-P-10 [P1] WebSocket 性能测试

**目标**: 建立 WebSocket 客户端性能测试基准

**涉及范围**:

1. `tests/performance/ws-load-test.js` — 新增性能测试脚本
2. 并发连接数基准（≥1000 连接）
3. 消息延迟基准（p99 < 100ms）
4. 心跳成功率基准（≥99%）

**RTM 映射**: WS-007, WS-008, WS-009

**设计文档**: [../../docs/v3.2/PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md) §5

**完成标准**:

1. 可运行的性能测试脚本
2. 并发连接测试：1000+ 连接稳定
3. 消息延迟测试：p99 < 100ms
4. 心跳成功率测试：≥99%
5. 内存使用监控：<500MB per 1000 connections
6. 测试结果输出到控制台和文件

**验证方式**:

1. 运行性能测试脚本
2. 验证所有基准指标通过
3. 多次运行取平均值，确认稳定性

**状态**: ⏳ 待实现

**前置依赖**: BL-P-1 完成（WebSocket 客户端基础实现）

---

### BL-P-11 [P2] 端到端集成测试套件

**目标**: 建立插件端到端集成测试，覆盖 v3.2 完整流程

**涉及范围**:

1. `tests/integration/` — 新增集成测试目录
2. 连接测试（HTTP + WebSocket）
3. Memory CRUD 全流程测试
4. 代码分析 → 上传 → 查询全流程测试
5. 端口迁移兼容性测试

**完成标准**:

1. 连接测试：HTTP 健康检查 + WebSocket 握手
2. Memory 测试：write → read → search → delete
3. 代码分析测试：analyze → upload → query
4. 兼容性测试：17999 端口（旧版）和 18008 端口（v3.2）
5. 所有测试可独立运行

**验证方式**:

1. `npm run test:integration` 运行所有集成测试
2. 验证测试覆盖 v3.2 关键路径
3. CI 集成（如有）

**状态**: ⏳ 待实现

**前置依赖**: BL-P-1 至 BL-P-9 完成

---

## 文档任务

---

### BL-P-12 [P2] 产品文档更新 — v3.2 适配

**目标**: 更新产品文档，反映 v3.2 变更（端口、新功能、配置）

**涉及范围**:

1. `CONFIGURATION.md` — 新增 v3.2 配置选项（端口、日志级别等）
2. `QUICK_START.md` — 更新连接信息
3. `TROUBLESHOOTING.md` — 新增 v3.2 常见问题
4. `WINDOWS_SETUP.md` — 更新端口信息

**完成标准**:

1. CONFIGURATION.md 包含 v3.2 新配置项
2. QUICK_START.md 中的端口信息已更新
3. TROUBLESHOOTING.md 包含 v3.2 迁移相关 FAQ
4. 所有文档中 17999 引用已更新（或标注为旧版）

**验证方式**:

1. `npm run lint:md` 通过
2. 文档评审：检查端口引用一致性

**状态**: ⏳ 待实现

**前置依赖**: BL-P-4 完成（端口迁移）

---

### BL-P-13 [P2] README 更新 — v3.2 版本发布

**目标**: 更新 README.md 和 README.npm.md，反映 v3.2 新功能

**涉及范围**:

1. `README.md` — 新增 v3.2 功能描述（WebSocket 实时同步、DIFF 模式）
2. `README.npm.md` — npm 包描述更新
3. 版本号更新为 v3.2.0
4. CHANGELOG.md — 添加 v3.2.0 发布记录

**完成标准**:

1. README.md 包含 v3.2 新功能列表
2. README.npm.md 版本号和描述已更新
3. CHANGELOG.md 包含 v3.2.0 完整变更记录
4. 功能特性列表与实际实现一致

**验证方式**:

1. `npm run lint:md` 通过
2. 文档评审：功能描述准确

**状态**: ⏳ 待实现

**前置依赖**: 所有 P0/P1 任务完成

---

## 持续维护任务

---

### BL-P-14 [P2] Tree-sitter 多语言元数据完善

**目标**: 完善 Python/Go/Rust/Java 的函数元数据提取（return_type, is_exported）

**涉及范围**:

1. `lib/tree-sitter-parser.js` — 多语言 return_type 分析
2. Python `-> Type`、Go `func() Type`、Rust `-> Type`、Java `@return`

**完成标准**:

1. Python 函数提取 return_type, is_exported
2. Go 函数提取 return_type, is_exported
3. Rust 函数提取 return_type, is_exported
4. Java 方法提取 return_type, is_exported

**验证方式**:

1. 分析 Python/Go/Rust/Java 文件，验证元数据完整
2. 运行 `npm test`，验证无回归

**状态**: ⏳ 待执行

---

### BL-P-15 [P2] 代码分析测试覆盖率提升

**目标**: 将代码分析模块测试覆盖率从 ~50% 提升到 70%+

**涉及范围**:

1. `tests/test-code-analysis.test.js` — 补充测试用例
2. Tree-sitter 多语言解析器详细测试
3. 项目分析器完整功能测试
4. 代码分析服务队列处理测试

**完成标准**:

1. 新增 ≥30 个测试用例
2. 测试覆盖率 ≥70%
3. 覆盖率报告可生成

**验证方式**:

1. `npm run test:coverage` 生成覆盖率报告
2. 确认覆盖率 ≥70%

**状态**: ⏳ 部分完成（当前 20 套件，171 测试通过）

---

### BL-P-16 [P3] 符号导航支持

**目标**: 增强代码导航功能，支持跳转到定义和跨文件符号搜索

**涉及范围**:

1. `lib/code-analyzer.js` — 新增 `findSymbolDefinition()` 方法
2. `cli/code-analyzer.cjs` — 新增 `--goto` 选项

**完成标准**:

1. 支持按符号名查找定义位置
2. 支持符号类型过滤（函数/类/接口）
3. 支持模糊搜索（部分匹配）

**验证方式**:

1. 查找已知符号，验证位置准确
2. 运行 `npm test`，验证无回归

**状态**: ⏳ 待执行

---

## 任务依赖关系

```text
BL-P-5 (依赖升级) ──→ BL-P-1 (WebSocket 心跳/重连)
                   ──→ BL-P-2 (ACK 机制)
                   ──→ BL-P-9 (WrapperClient 适配)

BL-P-1 (心跳/重连) ──→ BL-P-3 (DIFF 模式)
                   ──→ BL-P-10 (性能测试)

BL-P-4 (端口迁移) ──→ BL-P-6 (指纹同步)
                   ──→ BL-P-7 (Memory CRUD)
                   ──→ BL-P-8 (Code Analysis)
                   ──→ BL-P-9 (WrapperClient)

BL-P-6 (指纹同步) ──→ BL-P-8 (Code Analysis)

BL-P-1~9 完成 ──→ BL-P-11 (集成测试)

BL-P-4 完成 ──→ BL-P-12 (文档更新)

BL-P-1~9 完成 ──→ BL-P-13 (README 更新)
```

---

## 实施优先级矩阵

| 编号    | 任务                   | 优先级 | 依赖数 | 预估工时 | 推荐顺序 |
| ------- | ---------------------- | ------ | ------ | -------- | -------- |
| BL-P-1  | WebSocket 心跳与重连   | P0     | 1      | 3-4 天   | 1        |
| BL-P-2  | WebSocket ACK 机制     | P0     | 1      | 1-2 天   | 2        |
| BL-P-4  | 端口迁移（插件端）     | P0     | 0      | 0.5 天   | 1        |
| BL-P-5  | 插件端依赖升级         | P0     | 0      | 1 天     | 1        |
| BL-P-9  | WrapperClient 适配     | P0     | 1      | 1-2 天   | 3        |
| BL-P-3  | WebSocket DIFF 模式    | P1     | 1      | 2-3 天   | 4        |
| BL-P-6  | 代码指纹增量同步       | P1     | 1      | 2-3 天   | 4        |
| BL-P-7  | Memory CRUD 适配       | P1     | 1      | 1 天     | 3        |
| BL-P-8  | Code Analysis 适配     | P1     | 2      | 2-3 天   | 5        |
| BL-P-10 | WebSocket 性能测试     | P1     | 1      | 2-3 天   | 5        |
| BL-P-11 | 端到端集成测试         | P2     | 9      | 2-3 天   | 6        |
| BL-P-12 | 产品文档更新           | P2     | 1      | 1 天     | 5        |
| BL-P-13 | README 更新            | P2     | 9      | 0.5 天   | 7        |
| BL-P-14 | Tree-sitter 多语言完善 | P2     | 0      | 2-3 天   | —        |
| BL-P-15 | 测试覆盖率提升         | P2     | 0      | 2-3 天   | —        |
| BL-P-16 | 符号导航支持           | P3     | 0      | 3-5 天   | —        |

---

## 推荐实施路线

### Phase 1: 基础准备（P0，预计 2-3 天）

可并行执行：

1. **BL-P-4** — 端口迁移（0.5 天）
2. **BL-P-5** — 依赖升级（1 天）

### Phase 2: 核心功能（P0，预计 5-7 天）

1. **BL-P-1** — WebSocket 心跳与重连（3-4 天）
2. **BL-P-2** — ACK 机制（1-2 天）
3. **BL-P-9** — WrapperClient 适配（1-2 天）

### Phase 3: 功能适配（P1，预计 7-10 天）

1. **BL-P-7** — Memory CRUD 适配（1 天）
2. **BL-P-6** — 代码指纹同步（2-3 天）
3. **BL-P-8** — Code Analysis 适配（2-3 天）
4. **BL-P-3** — DIFF 模式（2-3 天）

### Phase 4: 测试与文档（P1-P2，预计 5-7 天）

1. **BL-P-10** — 性能测试（2-3 天）
2. **BL-P-12** — 文档更新（1 天）
3. **BL-P-11** — 集成测试（2-3 天）
4. **BL-P-13** — README 更新（0.5 天）

---

## 已完成任务

> 此区域记录已完成任务。完成任务从上方移至此处。

（暂无已完成任务）

---

## 参考文档

| 文档                                                                           | 说明                        |
| ------------------------------------------------------------------------------ | --------------------------- |
| [RTM v3.2](../../docs/v3.2/RTM.md)                                             | 实施追踪矩阵（34 个追踪项） |
| [PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md) | 插件端实施指南              |
| [PLUGIN-v3.2-API.md](../../docs/v3.2/PLUGIN-v3.2-API.md)                       | 插件端 API 规范             |
| [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)         | WebSocket 详细设计          |
| [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)       | 预计算服务设计              |
| [BACKEND-v3.2-MIGRATION.md](../../docs/v3.2/BACKEND-v3.2-MIGRATION.md)         | 迁移指南                    |
| [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)             | 数据库 Schema               |
| [DEPENDENCY-VERSIONS.md](../../docs/v3.2/DEPENDENCY-VERSIONS.md)               | 依赖版本锁定                |

---

_文档版本: v1.0.0_
_创建时间: 2026-04-10_
_状态: 初始版本，包含 16 个任务（5 P0, 5 P1, 4 P2, 1 P3）_
