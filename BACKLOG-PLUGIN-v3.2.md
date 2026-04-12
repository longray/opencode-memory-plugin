# 插件端 v3.2 完整 BACKLOG

> 所有任务包含完整的5个要素：目标、涉及范围、前置依赖、完成标准、验证方式

---

## Phase 1: 基础设施（已完成）

### BL-P-1 [P0] 依赖升级

**目标**: 升级插件端依赖，支持 v3.2 新功能

**涉及范围**:

1. `package.json` - 更新依赖版本
   - `ws`: 8.19.0 → 8.20.0
   - 新增 `pino`: ^9.5.0
   - 新增 `dotenv`: ^16.4.5
   - 新增 `fast-json-patch`: ^3.1.1
2. `package-lock.json` - 重新生成
3. 依赖安装验证

**前置依赖**:

- 后端依赖版本确认
- v3.2 协议文档冻结

**完成标准**:

1. `package.json` 更新完成
2. `npm install` 成功执行
3. 所有依赖版本正确
4. 无安全漏洞

**验证方式**:

1. `npm ls ws pino dotenv fast-json-patch` 验证版本
2. `npm audit` 无高危漏洞
3. 现有测试通过

**工时**: 0.5 天

**状态**: ✅ 已完成

---

## Phase 2: WebSocket 客户端（Day 11-24）

### BL-P-2 [P0] ReliableWebSocketClient 核心实现

**目标**: 实现可靠的 WebSocket 客户端，支持心跳、重连、状态管理

**涉及范围**:

1. `lib/websocket/reliable-client.js` - ReliableWebSocketClient 类
   - 连接管理（connect/disconnect）
   - 心跳机制（30s 间隔，5s 超时）
   - 指数退避重连（1→2→4→...→300s）
   - 状态机管理（CLOSED/CONNECTING/CONNECTED/RECONNECTING）
2. `lib/websocket/state-manager.js` - 连接状态管理
3. `lib/websocket/heartbeat.js` - 心跳管理器

**前置依赖**:

- BL-P-1 完成（依赖升级）
- WebSocket 协议文档 v1.0 冻结
- 后端 WebSocket 服务端就绪

**完成标准**:

1. 成功建立 WebSocket 连接
2. 心跳机制正常工作（30s 发送 ping，检测 pong 超时）
3. 指数退避重连正常工作（1→2→4→...→300s）
4. 状态机正确转换
5. 连接状态可查询

**验证方式**:

1. 单元测试：连接/断开、心跳、重连
2. 集成测试：与后端 WebSocket 服务端联调
3. 故障测试：断网、超时、重连场景
4. 性能测试：1000+ 连接并发

**工时**: 3 天

**状态**: 🆕 新建

---

### BL-P-3 [P0] ACK 管理器实现

**目标**: 实现消息确认机制，确保可靠消息传递

**涉及范围**:

1. `lib/websocket/ack-manager.js` - AckManager 类
   - 消息发送等待 ACK 确认
   - 超时重试（5s 超时，最多 3 次重试）
   - 待确认消息队列管理
2. `lib/websocket/message-queue.js` - 消息队列管理
3. ACK 超时处理逻辑

**前置依赖**:

- BL-P-2 完成（ReliableWebSocketClient 核心）
- ACK 协议确认（5s 超时，3 次重试）

**完成标准**:

1. `sendWithAck(message, timeout=5000, maxRetries=3)` 方法可用
2. 收到 ACK 后 resolve Promise
3. 超时后自动重试（最多 3 次）
4. 达到最大重试次数后 reject
5. 待确认消息队列管理正常

**验证方式**:

1. 单元测试：正常 ACK、超时重试、最大重试失败
2. 集成测试：与后端 ACK 机制联调
3. 故障测试：ACK 丢失、延迟场景
4. 性能测试：高并发消息 ACK

**工时**: 2 天

**状态**: 🆕 新建（原 BL-P-X）

---

### BL-P-4 [P1] DIFF 模式实现

**目标**: 实现 DIFF 模式，支持 JSON Patch 增量更新

**涉及范围**:

1. `lib/websocket/diff-handler.js` - DiffHandler 类
   - JSON Patch 接收（RFC 6902）
   - Patch 应用到本地缓存
   - 本地状态管理
2. `lib/websocket/cache-manager.js` - 本地缓存管理
3. `fast-json-patch` 库集成

**前置依赖**:

- BL-P-2 完成（ReliableWebSocketClient 核心）
- DIFF 协议确认（JSON Patch RFC 6902）
- 后端 DIFF 订阅支持

**完成标准**:

1. 成功接收 JSON Patch 消息
2. Patch 正确应用到本地缓存
3. 本地状态与后端同步
4. 支持 replace/add/remove 操作
5. 缓存一致性保证

**验证方式**:

1. 单元测试：Patch 应用、缓存更新
2. 集成测试：与后端 DIFF 模式联调
3. 一致性测试：本地/后端状态对比
4. 性能测试：大数据量 Patch 应用

**工时**: 2 天

**状态**: 🆕 新建

---

### BL-P-5 [P0] WebSocket 协议文档（客户端实现版）

**目标**: 编写 WebSocket 客户端实现文档，指导开发

**涉及范围**:

1. `docs/v3.2/WEBSOCKET-CLIENT-IMPLEMENTATION.md`
   - 客户端架构设计
   - 类图和时序图
   - 状态机详细说明
   - 错误处理策略
   - 配置参数说明
2. API 文档（JSDoc）
3. 使用示例

**前置依赖**:

- WebSocket 协议文档 v1.0 冻结
- BL-P-2/3/4 设计完成

**完成标准**:

1. 文档完整，包含架构、设计、使用说明
2. 所有公共 API 有 JSDoc 注释
3. 包含完整使用示例
4. 包含故障排除指南

**验证方式**:

1. 文档评审：完整性、准确性
2. 示例验证：代码可运行
3. API 文档生成：JSDoc 正确

**工时**: 1 天

**状态**: 🆕 新建（原 BL-P-Y 扩展）

---

## Phase 3: Precompute 客户端（Day 2-10）

### BL-P-6 [P1] PrecomputeClient 实现

**目标**: 实现 PrecomputeService 客户端，调用后端预计算 API

**涉及范围**:

1. `lib/precompute/client.js` - PrecomputeClient 类
   - `callPrecomputeAPI(filePath, content, language)`
   - `checkFingerprints(fingerprints)`
   - 批量文件处理
2. `lib/precompute/batch-processor.js` - 批处理器
3. `lib/precompute/fingerprint-cache.js` - 指纹缓存管理

**前置依赖**:

- 后端 OpenAPI 规范（Day 3）
- 后端 Mock Server（Day 4-5）
- 后端 Precompute API 就绪

**完成标准**:

1. 成功调用 `/api/v1/code/precompute`
2. 成功调用 `/api/v1/code/fingerprint/check`
3. 批量处理 100 条文件
4. 指纹缓存管理正常
5. 错误处理完善

**验证方式**:

1. 单元测试：API 调用、批处理、缓存
2. 集成测试：与后端 Precompute API 联调
3. 性能测试：大批量文件处理
4. 错误测试：网络错误、API 错误处理

**工时**: 3 天

**状态**: 🆕 新建（原 BL-CA-37-CLIENT）

---

### BL-P-7 [P1] 代码分析工具适配 v3.2 API

**目标**: 适配现有代码分析工具，使用新的 Precompute API

**涉及范围**:

1. `lib/code-analyzer.js` - 适配 PrecomputeClient
   - 替换直接分析为 API 调用
   - 支持批量分析
   - 支持增量分析（指纹缓存）
2. `tools/code-analysis.js` - 工具适配
3. 向后兼容性处理

**前置依赖**:

- BL-P-6 完成（PrecomputeClient）
- 后端 Precompute API 稳定

**完成标准**:

1. 代码分析通过 Precompute API 执行
2. 支持批量分析（100 条/批次）
3. 支持增量分析（指纹匹配跳过）
4. 向后兼容（可切换旧模式）
5. 性能不下降

**验证方式**:

1. 功能测试：分析结果正确性
2. 性能测试：与旧模式性能对比
3. 兼容性测试：向后兼容
4. 集成测试：端到端流程

**工时**: 2 天

**状态**: 🆕 新建（原 BL-P-8）

---

## Phase 4: 其他任务（Day 25-32）

### BL-P-8 [P0] 端口迁移

**目标**: 将服务端口从 17999 迁移到 18008

**涉及范围**:

1. `lib/wrapper-client.js` - 默认端口更新
2. `lib/config.js` - 支持环境变量配置 `API_PORT`
3. 双端口兼容（17999 + 18008）
4. 文档更新

**前置依赖**:

- 后端端口迁移完成（BL-B-22）
- 双端口并行期开始

**完成标准**:

1. 默认端口改为 18008
2. 支持环境变量 `API_PORT` 覆盖
3. 双端口兼容（1-2 周并行期）
4. 所有文档更新
5. 回归测试通过

**验证方式**:

1. 配置测试：端口配置正确
2. 兼容测试：双端口都能连接
3. 回归测试：现有功能正常
4. 部署测试：Docker/本地部署

**工时**: 0.5 天

**状态**: 🆕 新建（原 BL-P-4）

---

### BL-P-9 [P1] 日志系统升级（pino）

**目标**: 使用 pino 替换现有日志系统，提升性能

**涉及范围**:

1. `lib/logger.js` - 使用 pino 实现
   - 结构化日志
   - 性能提升 5x
   - 开发环境美化（pino-pretty）
2. 现有日志调用替换
3. 日志级别配置

**前置依赖**:

- BL-P-1 完成（pino 依赖）
- 日志格式标准确认

**完成标准**:

1. pino 日志系统可用
2. 所有现有日志调用替换
3. 性能提升 5x（基准测试）
4. 开发环境日志可读
5. 生产环境日志结构化

**验证方式**:

1. 功能测试：日志输出正确
2. 性能测试：与旧系统性能对比
3. 配置测试：日志级别配置
4. 兼容性测试：不影响现有功能

**工时**: 1 天

**状态**: 🆕 新建

---

### BL-P-10 [P1] 配置管理升级（dotenv）

**目标**: 使用 dotenv 管理环境变量配置

**涉及范围**:

1. `lib/config.js` - 使用 dotenv 加载配置
   - `.env` 文件支持
   - 环境变量验证
   - 默认值处理
2. `.env.example` 模板
3. 配置文档

**前置依赖**:

- BL-P-1 完成（dotenv 依赖）
- 配置项清单确认

**完成标准**:

1. dotenv 配置加载正常
2. `.env` 文件支持
3. 环境变量验证
4. 配置文档完整

**验证方式**:

1. 功能测试：配置加载正确
2. 验证测试：环境变量验证
3. 错误测试：缺失配置处理
4. 文档测试：配置文档准确

**工时**: 0.5 天

**状态**: 🆕 新建

---

## Phase 5: 测试与优化（全程）

### BL-P-11 [P1] WebSocket 客户端单元测试

**目标**: 为 WebSocket 客户端编写完整单元测试

**涉及范围**:

1. `tests/websocket/reliable-client.test.js`
2. `tests/websocket/ack-manager.test.js`
3. `tests/websocket/diff-handler.test.js`
4. Mock WebSocket 服务端

**前置依赖**:

- BL-P-2/3/4 完成
- 测试框架就绪

**完成标准**:

1. ReliableWebSocketClient 测试覆盖率 > 80%
2. AckManager 测试覆盖率 > 80%
3. DiffHandler 测试覆盖率 > 80%
4. 所有关键路径有测试

**验证方式**:

1. 测试执行：全部通过
2. 覆盖率报告：> 80%
3. 边界测试：异常场景覆盖

**工时**: 2 天

**状态**: 🆕 新建（原 BL-CA-61）

---

### BL-P-12 [P1] Precompute 客户端单元测试

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
4. 所有关键路径有测试

**验证方式**:

1. 测试执行：全部通过
2. 覆盖率报告：> 80%
3. Mock 测试：API 调用覆盖

**工时**: 1.5 天

**状态**: 🆕 新建（原 BL-CA-62）

---

### BL-P-13 [P1] 端到端集成测试

**目标**: 编写端到端集成测试，验证完整流程

**涉及范围**:

1. `tests/e2e/websocket-sync.test.js` - WebSocket 同步流程
2. `tests/e2e/code-analysis.test.js` - 代码分析流程
3. `tests/e2e/full-workflow.test.js` - 完整工作流
4. 测试环境搭建

**前置依赖**:

- BL-P-11/12 完成
- 后端服务就绪
- 测试数据准备

**完成标准**:

1. WebSocket 同步流程测试通过
2. 代码分析流程测试通过
3. 完整工作流测试通过
4. 测试环境可复现

**验证方式**:

1. E2E 测试执行：全部通过
2. 性能测试：端到端延迟 < 100ms
3. 稳定性测试：长时间运行

**工时**: 2 天

**状态**: 🆕 新建（原 BL-CA-63）

---

## 统计

| 分类     | 任务数 | P0    | P1    | 总工时    |
| -------- | ------ | ----- | ----- | --------- |
| Phase 1  | 1      | 1     | 0     | 0.5 天 ✅ |
| Phase 2  | 4      | 3     | 1     | 8 天      |
| Phase 3  | 2      | 0     | 2     | 5 天      |
| Phase 4  | 3      | 1     | 2     | 2 天      |
| Phase 5  | 3      | 0     | 3     | 5.5 天    |
| **总计** | **13** | **5** | **8** | **21 天** |

---

_文档版本: v1.0_  
_创建时间: 2026-04-12_  
_状态: 完整 BACKLOG，准备执行_
