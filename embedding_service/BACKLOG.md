# Embedding Service — Backlog

> 后端服务任务列表
>
> **编号规则**: `BL-B-{N}` (B = Backend)
> **最后更新**: 2026-04-10

---

## 状态图例

- ⏳ 待实施
- 🔄 进行中
- ✅ 已完成
- ❌ 已取消

---

## WebSocket Server

### BL-B-1 [P0] WebSocket 可靠连接 — 心跳机制

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: Phase 1 依赖升级
- **设计文档**: [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)
- **追踪**: RTM WS-001, WS-002
- **描述**: 实现 30s 间隔心跳，2 次未响应触发重连
- **验收**: 心跳成功率 ≥ 99%

### BL-B-2 [P0] WebSocket 可靠连接 — 指数退避重连

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-1
- **设计文档**: [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)
- **追踪**: RTM WS-003, WS-004
- **描述**: 1s → 2s → 4s 指数退避，最大重连 10 次
- **验收**: 重连时间 < 5s（首次）

### BL-B-3 [P0] WebSocket 可靠连接 — ACK 确认系统

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-1
- **设计文档**: [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)
- **追踪**: RTM WS-005
- **描述**: 消息发送后等待 ACK，5s 超时，3 次重试
- **验收**: 消息确认率 > 99.9%

### BL-B-4 [P1] WebSocket 可靠连接 — DIFF 模式

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-3
- **设计文档**: [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)
- **追踪**: RTM WS-006
- **描述**: 基于 SurrealDB LIVE SELECT DIFF 实现增量数据同步
- **验收**: 数据传输减少 ≥ 90%

### BL-B-5 [P0] WebSocket 可靠连接 — 状态恢复

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-3
- **设计文档**: [BACKEND-v3.2-WEBSOCKET.md](../../docs/v3.2/BACKEND-v3.2-WEBSOCKET.md)
- **描述**: 基于 session ID + offset 的连接状态恢复，丢失消息同步
- **验收**: 重连后无消息丢失

### BL-B-6 [P1] WebSocket 性能 — 并发连接测试

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-2
- **追踪**: RTM WS-007
- **描述**: 验证并发连接 ≥ 1000
- **验收**: 1000 并发连接稳定运行

### BL-B-7 [P1] WebSocket 性能 — 消息延迟测试

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-6
- **追踪**: RTM WS-008
- **描述**: 验证消息延迟 p99 < 100ms
- **验收**: p99 延迟达标

---

## Precompute Service

### BL-B-8 [P0] PrecomputeService — 基础架构

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: Phase 1 依赖升级
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-001
- **描述**: 创建 services/ 目录，实现 PrecomputeService 基类，批处理循环
- **验收**: 批处理大小 100 条/批次

### BL-B-9 [P0] PrecomputeService — tree-sitter 集成

- **状态**: ⏳
- **工时**: 1.5 天
- **依赖**: BL-B-8
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-002
- **描述**: 集成 tree-sitter 0.25.x，支持 Python/JS/TS/Go/Rust/Java 6 语言
- **验收**: 6 语言 AST 解析通过

### BL-B-10 [P1] PrecomputeService — 调用关系创建

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-9
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-003
- **描述**: 分析函数调用关系，使用 SurrealDB RELATE 创建图关系
- **验收**: 调用关系正确建立

### BL-B-11 [P2] PrecomputeService — 循环检测

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-10
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-004
- **描述**: DFS 算法检测循环调用链，记录警告日志
- **验收**: 循环调用正确识别

### BL-B-12 [P2] PrecomputeService — 权重计算

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-10
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-005
- **描述**: 基于调用频率、复杂度、参数数量计算关系权重
- **验收**: 权重值在 0.0-1.0 范围内

### BL-B-13 [P1] PrecomputeService — 性能监控

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-8
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-006
- **描述**: 使用 psutil 收集处理耗时、内存、CPU 指标
- **验收**: 性能指标正确记录到 performance_log

### BL-B-14 [P1] PrecomputeService — 并发控制

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-8
- **设计文档**: [BACKEND-v3.2-PRECOMPUTE.md](../../docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md)
- **追踪**: RTM PC-007
- **描述**: asyncio.Semaphore 限制最大 5 并发，去重机制
- **验收**: 同一文件不重复处理

---

## Meilisearch Upgrade

### BL-B-15 [P0] Meilisearch SDK 0.40 — 客户端迁移

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: Phase 1 依赖升级
- **设计文档**: [BACKEND-v3.2-MEILISEARCH.md](../../docs/v3.2/BACKEND-v3.2-MEILISEARCH.md)
- **追踪**: RTM API-004
- **描述**: 从 httpx 直接调用迁移到 Meilisearch Python SDK 0.40.x
- **验收**: 所有搜索功能正常

### BL-B-16 [P1] Meilisearch SDK 0.40 — 索引设置迁移

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-15
- **设计文档**: [BACKEND-v3.2-MEILISEARCH.md](../../docs/v3.2/BACKEND-v3.2-MEILISEARCH.md)
- **描述**: 更新索引创建、配置设置、过滤属性
- **验收**: 索引配置正确应用

### BL-B-17 [P1] Meilisearch SDK 0.40 — 批量操作支持

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-15
- **设计文档**: [BACKEND-v3.2-MEILISEARCH.md](../../docs/v3.2/BACKEND-v3.2-MEILISEARCH.md)
- **描述**: 使用 SDK 内置的批量文档操作和任务等待
- **验收**: 批量 1000 文档操作成功

---

## SurrealDB Schema

### BL-B-18 [P0] Schema v3.2 — 核心表创建

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: SurrealDB 3.0+
- **设计文档**: [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)
- **追踪**: RTM DB-001, DB-002, DB-003
- **描述**: 创建 atom、entity、reference 三张核心表，包含 tenant_id 预留字段
- **验收**: 三张表及索引创建成功

### BL-B-19 [P1] Schema v3.2 — ChangeFeed 配置

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-18
- **设计文档**: [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)
- **追踪**: RTM DB-005
- **描述**: 为核心表启用 7 天 ChangeFeed
- **验收**: 变更事件正确推送

### BL-B-20 [P1] Schema v3.2 — 辅助表创建

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-18
- **设计文档**: [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)
- **描述**: 创建 timeline、stats、project、config 辅助表
- **验收**: 辅助表及事件函数创建成功

### BL-B-21 [P1] Schema v3.2 — 迁移脚本

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-18
- **设计文档**: [DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)
- **描述**: 编写 v2.x → v3.2 迁移脚本，添加 tenant_id 字段
- **验收**: 迁移后数据完整

---

## Deployment & Infrastructure

### BL-B-22 [P0] 端口迁移 17999 → 18008

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: 无
- **设计文档**: [BACKEND-v3.2-MIGRATION.md](../../docs/v3.2/BACKEND-v3.2-MIGRATION.md)
- **追踪**: RTM DEP-005
- **描述**: 更新 config.py、Dockerfile、docker-compose、文档中的端口引用
- **验收**: `curl http://localhost:18008/health` 返回正常

### BL-B-23 [P1] Docker 多阶段构建优化

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-22
- **设计文档**: [DEPLOYMENT-v3.2.md](../../docs/v3.2/DEPLOYMENT-v3.2.md)
- **追踪**: RTM DEP-001
- **描述**: 优化 Dockerfile，使用多阶段构建减小镜像体积
- **验收**: 镜像体积减少 ≥ 30%

### BL-B-24 [P1] docker-compose 健康检查

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-22
- **设计文档**: [DEPLOYMENT-v3.2.md](../../docs/v3.2/DEPLOYMENT-v3.2.md)
- **追踪**: RTM DEP-002
- **描述**: 为所有服务配置健康检查端点
- **验收**: `docker-compose ps` 显示所有服务 healthy

### BL-B-25 [P2] SSL 自动续期

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-22
- **设计文档**: [DEPLOYMENT-v3.2.md](../../docs/v3.2/DEPLOYMENT-v3.2.md)
- **追踪**: RTM DEP-004
- **描述**: Certbot + cron 自动续期 HTTPS 证书
- **验收**: 证书自动续期测试通过

---

## Testing

### BL-B-26 [P0] 单元测试 — WebSocket 模块

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-3
- **描述**: 覆盖心跳、重连、ACK、DIFF 模式的单元测试
- **验收**: 覆盖率 ≥ 80%

### BL-B-27 [P0] 单元测试 — Precompute 模块

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-10
- **描述**: 覆盖 AST 解析、符号提取、关系创建的单元测试
- **验收**: 覆盖率 ≥ 80%

### BL-B-28 [P1] 集成测试 — WebSocket 端到端

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: BL-B-5
- **描述**: 完整 WebSocket 连接-断开-重连-状态恢复流程测试
- **验收**: 端到端流程通过

### BL-B-29 [P1] 集成测试 — API 端到端

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-15
- **描述**: 完整 REST API CRUD 流程测试
- **验收**: 所有 API 端点测试通过

### BL-B-30 [P2] 性能基准测试

- **状态**: ⏳
- **工时**: 0.5 天
- **依赖**: BL-B-27
- **描述**: 建立性能基准，处理速度 > 1000 行/秒
- **验收**: 基准报告生成

---

## Dependencies

### BL-B-31 [P0] 依赖升级 — pyproject.toml

- **状态**: ⏳
- **工时**: 1 天
- **依赖**: 无
- **设计文档**: [DEPENDENCY-VERSIONS.md](../../docs/v3.2/DEPENDENCY-VERSIONS.md)
- **追踪**: RTM VER-001, VER-002, VER-003
- **描述**: 锁定 SurrealDB 1.0.8、Meilisearch 0.40.0、tree-sitter 0.25.x 版本
- **验收**: `pip install -e ".[dev]"` 成功

---

## 统计

| 分类         | 总数   | P0     | P1     | P2    |
| ------------ | ------ | ------ | ------ | ----- |
| WebSocket    | 7      | 3      | 4      | 0     |
| Precompute   | 7      | 2      | 3      | 2     |
| Meilisearch  | 3      | 1      | 2      | 0     |
| Schema       | 4      | 1      | 3      | 0     |
| Deployment   | 4      | 1      | 2      | 1     |
| Testing      | 5      | 2      | 2      | 1     |
| Dependencies | 1      | 1      | 0      | 0     |
| **总计**     | **31** | **11** | **16** | **4** |

---

## 时间线

```
Week 1 (Day 1-5):
├── Day 1: BL-B-31 依赖升级
├── Day 2-3: BL-B-1~3 WebSocket 心跳/重连/ACK
├── Day 3-4: BL-B-5 状态恢复
└── Day 4-5: BL-B-8~9 Precompute 基础 + tree-sitter

Week 2 (Day 6-10):
├── Day 6: BL-B-10 调用关系创建
├── Day 7: BL-B-15~17 Meilisearch SDK 升级
├── Day 8: BL-B-22 端口迁移
├── Day 9: BL-B-18~21 Schema 创建
└── Day 10: BL-B-26~30 测试
```

---

## 参考文档

- [v3.2 RTM](../../docs/v3.2/RTM.md) — 实施追踪矩阵
- [v3.2 实施指南](../../docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md) — 完整实施计划
- [统一架构](../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md) — 架构设计

---

_Backlog 最后更新: 2026-04-10_
