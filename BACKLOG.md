# Backlog

> ⚠️ **创建新任务前必读**：
>
> 1. 检查当前最大编号：`grep "^### BL-" BACKLOG.md | tail -1` → **当前最大：BL-CA-51**
> 2. 下一个可用编号：**BL-CA-52**
> 3. 规则：**永不复用、永不跳号**（详见 [`AGENTS.md#backlog-编号规则`](./AGENTS.md)）
> 4. 如编号冲突，使用下一个可用编号（BL-CA-52, BL-CA-53, BL-CA-54...）
>
> 未完成任务。已完成任务归档至 [`backlog_archive.md`](./backlog_archive.md)。
> 已发布版本详见 [`CHANGELOG.md`](./CHANGELOG.md)。

**更新时间**: 2026-04-10  
**版本**: v2.9.5  
**当前阶段**: 场景十一 — v3.2 架构升级（文档已完成，准备开发）

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

---

### BL-8 [P1] 隐式偏好发现端到端验证

**目标**: 完整测试隐式偏好发现→报告→确认→保存的全流程，修复发现的问题

**涉及范围**:

1. `opencode-memory-plugin/agents/memory-automation.md` - Observer prompt 微调
2. `opencode-memory-plugin/agents/` - 主代理 prompt 微调
3. `README.md` - 更新 Observer 使用说明
4. `AGENTS.md` - 更新代理配置文档

**前置依赖**:

- BL-7 完成（隐式偏好发现基础实现）
- memory-automation agent 已配置

**完成标准**:

1. 全流程跑通：对话行为→Observer 分析→主代理确认→用户确认→memory_write 成功
2. Observer 输出中包含"需要确认"的隐式发现区块（至少识别出1个潜在偏好）
3. 主代理向用户确认："观察到你在第 N 轮遇到 XX 问题，是否需要保存这个记忆？"
4. 用户确认后，记忆成功保存到 timeline
5. 保存的记忆包含完整的 abstract/overview/content 三层结构
6. 误报率 < 20%（5次测试中出现1次误报可接受）

**验证方式**:

1. 设计测试对话场景：用户写代码→被 lint 检出→默默删除→再次提交
2. 运行 Observer 分析测试对话，检查输出是否包含隐式发现区块
3. 验证主代理是否正确引用 Observer 的发现并询问用户
4. 用户确认后，使用 `memory_read` 验证记忆已保存
5. 检查记忆内容是否包含：类型=preference、标签包含代码风格、abstract≤100字符
6. 运行5次不同场景的测试，统计识别准确率和误报率

**状态**: ⏳ 下一步执行

---

### BL-15 [P2] 后端增量同步对接

**目标**: 对接后端 fingerprint API，实现代码分析结果的增量同步，避免重复上传未变更文件

**涉及范围**:

1. `opencode-memory-plugin/lib/code-fingerprint.js` - 新增/修改指纹计算逻辑
2. `opencode-memory-plugin/lib/wrapper-client.js` - 新增 `syncCodeFingerprints()` 方法
3. `opencode-memory-plugin/lib/code-analysis-service.js` - 集成指纹检查到分析流程
4. 后端 API 对接：`POST /api/v1/sync/code-fingerprints`

**前置依赖**:

- BL-9 完成（代码分析基础功能）
- 后端 BL-26 完成（增量同步 API）
- code-fingerprint.js 基础实现已存在

**完成标准**:

1. 计算文件指纹（content_hash: SHA256、symbols_hash: 函数名+参数哈希）
2. 调用后端 fingerprint API 获取需要更新的文件列表
3. 只上传后端返回的变更文件，未变更文件跳过上传
4. 本地指纹持久化到 `.code_fingerprints.json`（项目根目录）
5. 支持手动触发全量同步（绕过指纹检查）
6. 同步完成后更新本地指纹缓存
7. 错误处理：后端 API 失败时回退到全量上传

**验证方式**:

1. 首次分析项目，验证所有文件上传成功，指纹文件生成
2. 修改单个文件，再次分析，验证只上传修改的文件（通过日志或网络监控）
3. 验证未修改文件未产生上传请求（检查 network 日志）
4. 删除 `.code_fingerprints.json`，验证全量同步触发
5. 模拟后端 API 失败，验证回退到全量上传
6. 检查指纹文件格式：JSON，包含文件路径→{content_hash, symbols_hash, last_sync}
7. 运行 `npm test`，验证无回归

**状态**: ⏸️ 暂停（等待后端 BL-26 完成）

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
> **当前阶段**: Phase 1 - 深度审计（Week 1）

---

### BL-CA-12 [P1] 函数元数据补齐 - 多语言支持

**目标**: 补齐 Python/Go/Rust/Java 函数的元数据字段

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 新增多语言函数元数据提取
2. 返回类型分析（Python `-> Type`, Go `func() Type`, Rust `-> Type`, Java `@return`）
3. 导出函数识别（Python `__all__`, Go `func` vs `func`, Rust `pub fn`, Java `public`）

**前置依赖**: BL-CA-11 完成（基础元数据提取）

**完成标准**:

1. Python 函数提取 return_type, is_exported
2. Go 函数提取 return_type, is_exported
3. Rust 函数提取 return_type, is_exported
4. Java 方法提取 return_type, is_exported
5. CLI 输出包含完整元数据

**验证方式**:

1. 分析 Python/Go/Rust/Java 文件，验证元数据完整
2. 运行 `npm test`，验证无回归

**状态**: ⏳ 待执行

---

### BL-CA-14 [P1] 接口/特性提取 - Go/Rust/Java 支持

**目标**: 提取接口（Go interface, Rust trait, Java interface）支持面向对象设计分析

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 新增接口提取
2. Go interface 提取（方法签名列表）
3. Rust trait 提取（方法签名列表）
4. Java interface 提取（方法签名列表）

**前置依赖**: BL-CA-13 完成（类成员提取）

**完成标准**:

1. Go interface 提取完整
2. Rust trait 提取完整
3. Java interface 提取完整
4. CLI 输出包含接口定义

**验证方式**:

1. 分析 Go/Rust/Java 接口文件，验证提取完整
2. 运行 `npm test`，验证无回归

**状态**: ⏳ 待执行

---

### BL-CA-19 [P1] 场景3 - 重构影响分析 ⚠️ 待开发 - 依赖后端 API

**目标**: 实现查找函数引用功能，支持重构前评估变更影响范围

**涉及范围**:

1. `lib/code-analyzer.js` - 新增 `findReferences()` 方法
2. `cli/code-analyzer.cjs` - 新增 `--find-refs` 选项
3. 调用后端 API `GET /api/v1/memories/{id}/references`
4. 结果格式化输出（表格形式展示引用位置）

**前置依赖**: BL-CA-18 完成（调用关系提取），后端 BL-CA-21 完成（引用查询 API）

**完成标准**:

1. 支持按函数名查找所有引用位置
2. 输出包含：引用文件、行号、调用上下文
3. 支持跨文件引用查找
4. 支持递归查找（查找引用的引用，深度可配置）
5. CLI 输出格式清晰，便于重构决策

**验证方式**:

1. 查找已知函数的引用，验证结果完整
2. 验证跨文件引用正确解析
3. 测试递归查找功能（深度=2）
4. 运行 `npm test`，验证无回归

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

## 未完成任务优先级矩阵

| 任务     | 优先级 | 用户价值 | 技术难度 | 依赖数量 | 推荐顺序 |
| -------- | ------ | -------- | -------- | -------- | -------- |
| BL-CA-12 | P1     | 高       | 中       | 0        | 1        |
| BL-CA-14 | P1     | 中       | 高       | 2        | 5        |
| BL-CA-19 | P1     | 高       | 中       | 2        | 4        |
| BL-CA-20 | P1     | 中       | 中       | 1        | 6        |
| BL-8     | P1     | 高       | 中       | 1        | 3        |
| BL-CA-21 | P2     | 中       | 中       | 2        | 7        |
| BL-15    | P2     | 中       | 高       | 2        | 8        |

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

**状态**: 🆕 新建

---

### BL-CA-36 [P0] v3.2 WebSocket 服务重构

**目标**: 按 v3.2 设计完全重写 WebSocket 服务，实现完整的可靠性保障（心跳、指数退避重连、消息确认、DIFF 模式）

**涉及范围**:

1. `embedding_service/wrapper/src/routers/websocket.py` - 完全重写
2. `embedding_service/wrapper/src/utils/websocket/` - 新增目录
   - `reliable_client.py` - ReliableWebSocketClient 类
   - `ack_system.py` - AcknowledgementSystem 类
   - `state_recovery.py` - ConnectionStateRecovery 类
   - `persistent_queue.py` - PersistentMessageQueue 类
3. `embedding_service/wrapper/src/utils/diff/` - 新增 DIFF 模式支持
   - `subscription.py` - DiffSubscription 类
   - `patch_applier.py` - JSON Patch 应用器

**前置依赖**:

- BL-CA-35 完成（WebSocket 详细设计文档）
- Python `websockets` 库调研完成
- `fast-json-patch` 库确认可用

**完成标准**:

1. ReliableWebSocketClient 实现：
   - 心跳机制（30s 间隔，2 次未响应触发重连）
   - 指数退避重连（1s → 2s → 4s... 最大 300s）
   - 连接状态恢复（session + offset）
2. AcknowledgementSystem 实现：
   - 消息发送等待确认
   - 超时重试（5s 超时，3 次重试）
   - 指数退避延迟

3. DiffSubscription 实现：
   - LIVE SELECT DIFF 订阅
   - 本地缓存维护
   - JSON Patch 应用

4. PersistentMessageQueue 实现：
   - 离线消息持久化
   - 文件锁机制（portalocker）
   - 7 天过期清理

5. 所有功能单元测试通过

**验证方式**:

1. 单元测试：每个类独立测试
2. 集成测试：完整 WebSocket 流程测试
3. 压力测试：1000+ 并发连接测试
4. 故障测试：断网、超时、重连场景测试
5. 性能测试：DIFF 模式减少 90% 数据传输验证

**状态**: 🆕 新建

---

### BL-CA-37 [P0] v3.2 PrecomputeService 重构

**目标**: 将现有代码分析重构为 PrecomputeService，实现服务化、批量处理、增量更新、性能监控

**涉及范围**:

1. `embedding_service/wrapper/src/services/` - 新增目录
   - `precompute.py` - PrecomputeService 主类
   - `performance_monitor.py` - 性能监控类
   - `concurrency_control.py` - 并发控制类
2. `embedding_service/wrapper/src/utils/code_analyzer.py` - 解耦，改为服务调用
3. `embedding_service/wrapper/src/routers/code.py` - 新增预计算路由

**前置依赖**:

- BL-CA-35 完成（PrecomputeService 设计文档）
- `tree-sitter` Python 绑定确认可用
- `psutil` 库确认可用

**完成标准**:

1. PrecomputeService 实现：
   - AST 解析（tree-sitter Query）
   - 符号提取（函数、类、接口）
   - 批量创建 Atoms（SurrealDB 批量插入）
   - 创建 Entity（含双向引用）
   - 创建 Relations（调用关系）

2. 性能监控实现：
   - 耗时监控（perf_counter）
   - 内存监控（psutil）
   - CPU 监控（psutil）
   - 自动记录到 performance_log 表

3. 增量更新实现：
   - 文件指纹计算（SHA256）
   - 变更检测
   - 差异计算
   - 只更新变更部分

4. 并发控制实现：
   - asyncio.Semaphore 限流（最大 5 并发）
   - 去重机制（processing set）
   - 队列管理

5. 所有功能单元测试通过

**验证方式**:

1. 单元测试：每个方法独立测试
2. 集成测试：完整预计算流程测试
3. 性能测试：大文件（>1000 行）处理测试
4. 增量测试：重复分析相同文件，验证跳过
5. 并发测试：多文件同时分析测试

**状态**: 🆕 新建

---

### BL-CA-38 [P0] v3.2 Meilisearch SDK 升级

**目标**: 将 Meilisearch 从 httpx 调用升级为 Python SDK 0.40，获得类型安全和更好的 API

**涉及范围**:

1. `embedding_service/pyproject.toml` - 新增依赖 `meilisearch>=0.40.0,<0.41.0`
2. `embedding_service/wrapper/src/utils/meili_client.py` - 完全重写
3. `embedding_service/wrapper/src/utils/memory_manager/meili_sync.py` - 适配新 SDK

**前置依赖**:

- BL-CA-35 完成（Meilisearch 升级指南文档）
- Meilisearch SDK 0.40 发布确认
- 向后兼容性确认

**完成标准**:

1. 依赖升级：
   - 添加 `meilisearch>=0.40.0,<0.41.0` 到 pyproject.toml
   - 移除 httpx 直接调用

2. MeiliClient 重写：
   - 使用 Meilisearch SDK 客户端
   - 保持现有功能（索引管理、文档 CRUD、搜索）
   - 添加类型注解

3. 同步逻辑适配：
   - 更新 MeiliSyncMixin
   - 保持双写策略（SurrealDB + Meilisearch）

4. 配置兼容：
   - 环境变量配置保持不变
   - 索引设置自动迁移

5. 所有功能单元测试通过

**验证方式**:

1. 单元测试：MeiliClient 所有方法测试
2. 集成测试：文档增删改查测试
3. 搜索测试：全文搜索、过滤、排序测试
4. 性能测试：与 httpx 版本性能对比
5. 兼容性测试：现有索引无缝迁移

**状态**: 🆕 新建

---

### BL-CA-39 [P0] v3.2 服务端口迁移

**目标**: 将服务端口从 17999 迁移到 18008，完成与现有服务的完全替换

**涉及范围**:

1. `embedding_service/wrapper/src/main.py` - 端口配置更新
2. `embedding_service/wrapper/src/config.py` - 配置更新
3. `embedding_service/docker-compose.yml` - 端口映射更新
4. `opencode-memory-plugin/lib/wrapper-client.js` - 端口更新
5. `opencode-memory-plugin/agents/` - 端口更新
6. 文档更新

**前置依赖**:

- BL-CA-35 完成（迁移指南文档）
- BL-CA-36、BL-CA-37、BL-CA-38 完成（新服务就绪）
- 新服务测试通过

**完成标准**:

1. 后端端口更新：
   - FastAPI 服务端口改为 18008
   - WebSocket 端口改为 18008
   - Docker 端口映射更新

2. 插件端端口更新：
   - wrapper-client.js 默认端口改为 18008
   - 所有 agent 配置更新

3. 文档更新：
   - 所有文档中的端口引用更新
   - API 文档更新

4. 兼容性处理：
   - 保留 17999 作为可选配置（向后兼容）
   - 环境变量支持 PORT 配置

5. 部署验证：
   - Docker 部署测试通过
   - 本地部署测试通过

**验证方式**:

1. 配置检查：全局搜索 17999，确认全部更新
2. 单元测试：配置加载测试
3. 集成测试：完整端到端测试
4. 部署测试：Docker 部署验证
5. 回归测试：现有功能全部正常

**状态**: 🆕 新建

---

### BL-CA-40 [P1] v3.2 插件端依赖升级

**目标**: 升级插件端依赖（ws 8.20, pino, dotenv），支持 v3.2 新功能

**涉及范围**:

1. `opencode-memory-plugin/package.json` - 依赖更新
2. `opencode-memory-plugin/lib/websocket-client.js` - 适配新 ws 版本
3. `opencode-memory-plugin/lib/logger.js` - 新增（pino 封装）
4. `opencode-memory-plugin/lib/config.js` - 新增（dotenv 封装）

**前置依赖**:

- BL-CA-35 完成（插件端实施指南文档）
- BL-CA-36 完成（后端 WebSocket 就绪）

**完成标准**:

1. 依赖升级：
   - ws: 8.19.0 → 8.20.0
   - 新增 pino: ^9.5.0
   - 新增 dotenv: ^16.4.5

2. WebSocket 客户端适配：
   - 使用 ws 8.20 新特性
   - 适配后端 ReliableWebSocket

3. 日志系统：
   - pino 结构化日志
   - 性能提升 5x
   - 开发环境美化（pino-pretty）

4. 配置管理：
   - dotenv 环境变量加载
   - 配置验证

5. 所有功能测试通过

**验证方式**:

1. 依赖检查：package.json 验证
2. 单元测试：logger、config 测试
3. 集成测试：WebSocket 连接测试
4. 性能测试：日志性能对比
5. 回归测试：现有功能全部正常

**状态**: 🆕 新建

---

### BL-CA-41 [P1] v3.2 SurrealDB Schema 升级

**目标**: 升级 SurrealDB Schema 到 3.0+，添加 tenant_id 预留字段，支持 v3.2 新特性

**涉及范围**:

1. `docs/v3.2/DATABASE-v3.2-SCHEMA.md` - Schema 文档
2. `embedding_service/wrapper/src/db/migrations/` - 新增迁移脚本
   - `v3.2_schema.sql` - Schema 定义
   - `migrate_v2_to_v3.2.py` - 迁移脚本

**前置依赖**:

- BL-CA-35 完成（Schema 设计文档）
- SurrealDB 3.0+ 确认可用

**完成标准**:

1. Schema 升级：
   - 所有表添加 tenant_id 字段
   - 添加复合索引（tenant_id + 其他字段）
   - 添加辅助表（timeline, stats, project, config）
   - 添加 DEFINE EVENT
   - 添加 DEFINE FUNCTION
   - 添加 ChangeFeed

2. 数据迁移：
   - 现有数据迁移脚本
   - tenant_id 默认值为 "default"
   - 零停机迁移

3. 验证：
   - Schema 创建成功
   - 索引生效
   - 事件触发正常

**验证方式**:

1. Schema 检查：所有表结构验证
2. 索引检查：查询性能验证
3. 事件测试：CREATE/UPDATE/DELETE 触发验证
4. 迁移测试：现有数据迁移验证
5. 回归测试：现有功能全部正常

**状态**: 🆕 新建

---

### BL-CA-42 [P2] v3.2 P1/P2 文档编写

**目标**: 完成 v3.2 的 P1/P2 补充文档

**涉及范围**:

1. `docs/v3.2/BACKEND-v3.2-MEILISEARCH.md` - Meilisearch 详细指南
2. `docs/v3.2/PLUGIN-v3.2-API.md` - 插件端 API 规范
3. `docs/v3.2/DEPLOYMENT-v3.2.md` - 部署指南
4. `docs/v3.2/DEVELOPMENT-v3.2.md` - 开发指南

**前置依赖**:

- BL-CA-35 完成（P0 文档）
- 所有 P0 开发任务完成

**完成标准**:

1. 所有 P1/P2 文档编写完成
2. 文档与实现保持一致
3. 包含完整的示例代码
4. 包含故障排除指南

**验证方式**:

1. 文档评审：检查完整性
2. 技术评审：确认准确性
3. 示例验证：所有代码可运行

**状态**: 🆕 新建

---

### BL-CA-43 [P1] 补充 WebSocket 性能测试基准 ✅

**目标**: 在 PLUGIN-v3.2-API.md 中补充完整的 WebSocket 性能测试方案，确保 WebSocket 实现满足生产环境性能要求

**涉及范围**:

1. `docs/v3.2/PLUGIN-v3.2-API.md` - 新增第5节"性能测试"
   - 并发连接数基准（1000+ 连接）
   - 消息吞吐量基准（10000 msg/s）
   - 延迟基准（p99 < 100ms）
   - 内存使用基准（< 500MB per 1000 connections）

2. `docs/v3.2/DEVELOPMENT-v3.2.md` - 补充性能测试工具使用指南
   - Artillery 配置示例
   - k6 脚本示例
   - 自定义测试工具代码

3. `tests/performance/websocket-load-test.js` - 创建性能测试脚本（可选）

**前置依赖**:

- BL-CA-35 完成（v3.2 架构文档基础）
- BACKEND-v3.2-WEBSOCKET.md 完成（WebSocket 设计文档）

**完成标准**:

1. PLUGIN-v3.2-API.md 包含完整的性能测试章节，包括：
   - 性能指标定义（并发、吞吐量、延迟、内存）
   - 测试环境要求（硬件、网络、软件版本）
   - 测试工具配置（Artillery、k6 或自定义脚本）
   - 测试步骤和命令
   - 预期结果和通过标准
   - 结果分析方法

2. 所有性能指标有明确的数值基准
3. 包含至少一种可运行的测试工具配置
4. 包含结果解读和故障排查指南

**验证方式**:

1. 文档评审：
   - 检查性能指标是否完整（并发、吞吐量、延迟、内存）
   - 检查测试步骤是否可执行
   - 检查基准数值是否合理

2. 技术验证：
   - 使用提供的测试工具配置运行测试
   - 验证测试脚本可正常执行
   - 验证结果分析逻辑正确

3. 示例验证：
   - Artillery 配置 YAML 语法正确
   - k6 脚本 JavaScript 语法正确
   - 自定义测试工具代码可运行

**状态**: 🆕 新建

---

### BL-CA-44 [P1] 完善 PrecomputeService 关系创建实现

**目标**: 补充 BACKEND-v3.2-PRECOMPUTE.md 中 `_create_relations()` 方法的完整实现，使调用关系分析功能可用

**涉及范围**:

1. `docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md` - 完善第4.3节"关系创建"
   - 函数调用图构建算法详解
   - 调用关系存储到 SurrealDB 的具体实现
   - 循环调用检测算法
   - 关系权重计算方法

2. `embedding_service/wrapper/src/services/precompute.py` - 实际代码实现（后续开发阶段）
   - `_create_relations()` 方法实现
   - `_detect_cycles()` 循环检测
   - `_calculate_weights()` 权重计算

3. `embedding_service/wrapper/src/utils/call_graph.py` - 新增调用图工具模块（可选）

**前置依赖**:

- BL-CA-37 完成（PrecomputeService 基础实现）
- DATABASE-v3.2-SCHEMA.md 完成（reference 表定义）
- 代码分析模块已完成（tree-sitter 解析器）

**完成标准**:

1. BACKEND-v3.2-PRECOMPUTE.md 包含完整的 `_create_relations()` 实现：
   - Python 代码实现（不少于 50 行）
   - 算法复杂度分析（时间/空间复杂度）
   - 边界情况处理（循环调用、递归调用、匿名函数）
   - 错误处理机制

2. 文档包含调用关系存储的 SurrealDB 查询示例
3. 包含单元测试示例（至少 3 个测试用例）
4. 包含性能考虑（大数据量处理策略）

**验证方式**:

1. 代码审查：
   - Python 代码语法正确
   - 算法逻辑清晰
   - 边界情况处理完整

2. 逻辑验证：
   - 调用图构建算法正确性
   - 循环检测算法正确性
   - 权重计算合理性

3. 示例验证：
   - 提供的 SurrealDB 查询可执行
   - 单元测试用例覆盖主要场景
   - 代码示例可编译/运行

**状态**: 🆕 新建

---

### BL-CA-45 [P2] 统一预计算批处理大小参数

**目标**: 统一文档中预计算批处理大小的数值，消除不一致，确保实施时配置正确

**涉及范围**:

1. `docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md` - 修改批处理大小定义
   - 当前: `BATCH_SIZE = 100`
   - 需确认并统一

2. `docs/v3.2/DEPLOYMENT-v3.2.md` - 修改环境变量默认值
   - 当前: `PRECOMPUTE_BATCH_SIZE=10`
   - 需与 BACKEND-v3.2-PRECOMPUTE.md 统一

3. `docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md` - 补充批处理大小选择指南
   - 不同场景的建议值
   - 性能影响说明

**前置依赖**:

- BL-CA-37 完成（PrecomputeService 设计）
- 性能基准测试数据（如有）

**完成标准**:

1. 所有文档中批处理大小数值统一为一致值（建议 100）
2. 在 BACKEND-v3.2-IMPLEMENTATION.md 中添加说明：
   - 批处理大小对性能的影响
   - 不同场景的建议值（实时场景 10，批量场景 100）
   - 如何根据硬件资源调整

3. 更新 DEPLOYMENT-v3.2.md 中的环境变量说明：
   - 明确说明默认值和可选范围
   - 提供配置建议

**验证方式**:

1. 一致性检查：
   - 全局搜索 `BATCH_SIZE` 和 `PRECOMPUTE_BATCH_SIZE`
   - 确认所有文档数值一致

2. 文档评审：
   - 批处理大小选择指南是否清晰
   - 场景建议是否合理

3. 逻辑验证：
   - 批处理大小与性能的关系说明是否正确
   - 默认值选择是否合理

**状态**: 🆕 新建

---

### BL-CA-46 [P2] 扩充后端实施指南

**目标**: 扩充 BACKEND-v3.2-IMPLEMENTATION.md 内容，添加 Phase 1-5 的详细任务分解和时间估算，使实施计划可执行

**涉及范围**:

1. `docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md` - 扩充第4节"实施步骤"
   - Phase 1: 基础准备（详细任务清单）
   - Phase 2: WebSocket 重写（详细任务清单）
   - Phase 3: PrecomputeService（详细任务清单）
   - Phase 4: 依赖升级（详细任务清单）
   - Phase 5: 迁移与验证（详细任务清单）

2. 新增内容：
   - 每个 Phase 的具体任务列表（每个 Phase 5-10 个任务）
   - 每个任务的预估工时
   - 任务依赖关系图
   - 人力资源需求
   - 关键里程碑和交付物

**前置依赖**:

- BL-CA-35 完成（v3.2 架构总体设计）
- 所有 v3.2 设计文档完成

**完成标准**:

1. BACKEND-v3.2-IMPLEMENTATION.md 包含详细的实施计划：
   - 5 个 Phase，每个 Phase 包含：
     - 目标说明
     - 详细任务列表（5-10 个任务）
     - 每个任务的预估工时（小时或天）
     - 任务依赖关系
     - 交付物清单
   - 总体时间估算（总工时、日历时间）
   - 人力资源需求（角色、人数）
   - 关键里程碑（至少 3 个）

2. 任务分解粒度适中（每个任务 4-16 小时）
3. 依赖关系清晰，可识别关键路径

**验证方式**:

1. 完整性检查：
   - 所有 Phase 都有详细任务列表
   - 每个任务都有工时估算
   - 依赖关系完整

2. 合理性检查：
   - 工时估算是否合理（不过长/过短）
   - 任务粒度是否适中
   - 依赖关系是否符合逻辑

3. 可执行性检查：
   - 任务是否可分配
   - 里程碑是否可验证
   - 总体计划是否可行

**状态**: 🆕 新建

---

### BL-CA-47 [P2] 添加 WebSocket 错误处理示例

**目标**: 在 PLUGIN-v3.2-IMPLEMENTATION.md 中添加 WebSocket 错误处理的最佳实践和代码示例

**涉及范围**:

1. `docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md` - 新增第4节"错误处理"
   - 连接失败处理
   - 消息超时处理
   - 重连失败处理
   - 异常上报机制

2. 新增代码示例：
   - 连接错误处理（JavaScript）
   - 消息发送失败重试（JavaScript）
   - 重连策略实现（指数退避）
   - 错误日志记录

3. 故障排查指南：
   - 常见错误码说明
   - 排查步骤
   - 解决方案

**前置依赖**:

- BACKEND-v3.2-WEBSOCKET.md 完成（WebSocket 设计文档）
- PLUGIN-v3.2-API.md 完成（API 规范）

**完成标准**:

1. PLUGIN-v3.2-IMPLEMENTATION.md 包含完整的错误处理章节：
   - 错误类型分类（连接、消息、重连）
   - 每种错误的处理策略
   - 完整的 JavaScript 代码示例（不少于 100 行）
   - 错误处理流程图（可选）

2. 包含故障排查指南：
   - 至少 5 个常见错误场景
   - 每个场景的排查步骤
   - 解决方案和代码示例

3. 包含最佳实践：
   - 错误处理原则
   - 日志记录建议
   - 监控和告警

**验证方式**:

1. 代码审查：
   - JavaScript 代码语法正确
   - 错误处理逻辑完整
   - 边界情况处理到位

2. 示例验证：
   - 代码示例可运行
   - 错误场景覆盖主要问题
   - 解决方案有效

3. 文档评审：
   - 错误分类清晰
   - 排查步骤可执行
   - 最佳实践合理

**状态**: 🆕 新建

---

### BL-CA-48 [P2] 添加 Kubernetes 部署配置

**目标**: 在 DEPLOYMENT-v3.2.md 中添加 Kubernetes 部署配置示例，支持生产环境容器编排

**涉及范围**:

1. `docs/v3.2/DEPLOYMENT-v3.2.md` - 新增第4.5节"Kubernetes 部署"
   - Deployment 配置（api, surrealdb, meilisearch）
   - Service 配置（ClusterIP, NodePort, LoadBalancer）
   - ConfigMap 配置（环境变量）
   - Secret 配置（API 密钥）
   - PersistentVolumeClaim 配置（数据持久化）

2. 新增高级配置（可选）：
   - HPA 水平自动扩缩容
   - Ingress 配置（Nginx）
   - Cert-manager 自动证书管理
   - PodDisruptionBudget

3. 部署脚本：
   - kubectl apply 命令
   - Helm Chart（可选）

**前置依赖**:

- DEPLOYMENT-v3.2.md 基础内容完成
- Docker 配置已验证

**完成标准**:

1. DEPLOYMENT-v3.2.md 包含完整的 K8s 配置：
   - 所有服务的 Deployment YAML（语法正确）
   - 所有服务的 Service YAML
   - ConfigMap 和 Secret 示例
   - PVC 配置（数据持久化）

2. 配置包含生产环境最佳实践：
   - 资源限制（CPU/内存）
   - 健康检查（liveness/readiness）
   - 滚动更新策略
   - 反亲和性配置

3. 包含部署步骤：
   - 前置条件（K8s 集群、kubectl）
   - 部署命令
   - 验证步骤
   - 故障排查

**验证方式**:

1. 语法验证：
   - 所有 YAML 文件语法正确（可通过 `kubectl apply --dry-run` 验证）
   - 资源配置合理

2. 配置审查：
   - 是否符合 K8s 最佳实践
   - 资源限制是否合理
   - 健康检查配置是否完整

3. 示例验证（可选）：
   - 在测试 K8s 集群部署
   - 验证服务可正常运行

**状态**: 🆕 新建

---

### BL-CA-49 [P3] 添加数据库 ER 关系图

**目标**: 在 DATABASE-v3.2-SCHEMA.md 中添加 ER 关系图，直观展示表之间的关系

**涉及范围**:

1. `docs/v3.2/DATABASE-v3.2-SCHEMA.md` - 新增第2.4节"ER 关系图"
   - 使用 Mermaid 语法绘制 ER 图
   - 展示 atom、entity、reference 表之间的关系
   - 展示辅助表（timeline, stats, project, config）

2. 图表内容：
   - 实体（表）
   - 属性（关键字段）
   - 关系（一对一、一对多、多对多）
   - 关系类型（depends_on, calls, imports 等）

**前置依赖**:

- DATABASE-v3.2-SCHEMA.md 完成（Schema 定义）

**完成标准**:

1. DATABASE-v3.2-SCHEMA.md 包含 Mermaid ER 图：
   - 语法正确，可在 GitHub/GitLab 渲染
   - 包含所有核心表（atom, entity, reference）
   - 包含辅助表（timeline, stats, project, config）
   - 关系标注清晰

2. 图表包含：
   - 表名和关键字段
   - 主键和外键关系
   - 关系类型和方向

**验证方式**:

1. 语法验证：
   - Mermaid 语法正确（使用 Mermaid Live Editor 验证）
   - 可在 Markdown 渲染器中正确显示

2. 内容验证：
   - 表和字段与 Schema 定义一致
   - 关系类型正确
   - 图表清晰易读

**状态**: 🆕 新建

---

### BL-CA-50 [P3] 添加 SSL 自动续期配置

**目标**: 在 DEPLOYMENT-v3.2.md 中添加 Certbot SSL 证书自动续期配置

**涉及范围**:

1. `docs/v3.2/DEPLOYMENT-v3.2.md` - 新增第4.6节"SSL 自动续期"
   - Certbot 安装和配置
   - 自动续期 cron 任务
   - 证书更新钩子（重启服务）
   - 测试续期流程

2. 配置内容：
   - Nginx + Certbot 配置
   - Docker 环境下 Certbot 使用
   - Kubernetes 环境下 cert-manager 使用

3. 脚本示例：
   - 证书申请脚本
   - 续期测试脚本
   - 钩子脚本（自动重启服务）

**前置依赖**:

- DEPLOYMENT-v3.2.md 基础内容完成
- SSL/TLS 基础配置已完成

**完成标准**:

1. DEPLOYMENT-v3.2.md 包含完整的 SSL 自动续期指南：
   - Certbot 安装步骤
   - 证书申请命令
   - 自动续期配置（cron 或 systemd timer）
   - 证书更新钩子配置

2. 包含不同环境的配置：
   - 裸机/虚拟机环境
   - Docker 环境
   - Kubernetes 环境（cert-manager）

3. 包含测试和验证：
   - 续期测试命令
   - 验证脚本
   - 故障排查

**验证方式**:

1. 文档评审：
   - 步骤清晰可执行
   - 命令语法正确
   - 配置示例完整

2. 示例验证（可选）：
   - 在测试环境验证续期流程
   - 验证钩子脚本可正常执行

**状态**: 🆕 新建

---

### BL-CA-51 [P1] 锁定依赖版本

**目标**: 锁定关键依赖的版本，消除版本漂移风险，确保实施稳定性

**涉及范围**:

1. `docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md` - 更新依赖版本
   - tree-sitter: 锁定语言包版本与核心 0.22.x 对齐
   - ws: 修正版本号（当前 `^8.20.0` → 实际 `^8.18.0`）
   - surrealdb: 缩小版本范围 `>=1.0.8,<1.1.0`

2. `embedding_service/wrapper/pyproject.toml` - 实际依赖锁定（后续开发阶段）
   - 更新依赖版本约束
   - 添加 poetry.lock（锁定精确版本）

3. `docs/v3.2/BACKEND-v3.2-WEBSOCKET.md` - 修正 ws 版本号
   - 检查并修正所有 ws 版本引用

**前置依赖**:

- 所有 v3.2 设计文档完成
- 依赖版本调研完成

**完成标准**:

1. 所有文档中依赖版本一致且正确：
   - tree-sitter: 明确语言包版本（如 tree-sitter-python = "^0.21.0"）
   - ws: 统一为 `^8.18.0`（或最新稳定版）
   - surrealdb: `>=1.0.8,<1.1.0`

2. 文档包含版本选择说明：
   - 为什么选择这个版本
   - 版本兼容性说明
   - 升级注意事项

3. 创建依赖版本对照表：
   - 依赖名称
   - 当前版本
   - 目标版本
   - 变更原因

**验证方式**:

1. 一致性检查：
   - 全局搜索依赖名称，确认版本一致
   - 检查 pyproject.toml 和文档一致性

2. 版本验证：
   - 确认版本在 PyPI/npm 存在
   - 确认版本兼容性

3. 文档评审：
   - 版本选择说明是否合理
   - 升级注意事项是否完整

**状态**: 🆕 新建

---

_文档版本: v2.9.6_  
_更新时间: 2026-04-10_  
_状态: 已归档 29 个已完成/已取消任务至 backlog_archive.md_
