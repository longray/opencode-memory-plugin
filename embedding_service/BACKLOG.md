# Embedding Service — Backlog

> 后端服务任务列表
>
> **编号规则**: `BL-B-{N}` (B = Backend)
> **最后更新**: 2026-04-21

---

## 状态图例

- ⏳ 待实施
- 🔄 进行中
- ✅ 已完成
- ❌ 已取消

---

## 场景十四：后端 Bug 修复（v3.2.3）

> **背景**: Layer 1 数据层测试发现 2 个严重后端 Bug
>
> **目标**: 修复 Entity GET 端点和 Reference 创建端点的 Bug
>
> **状态**: 🆕 新建

---

### BL-B-32 [P0] 修复 Entity GET 端点返回 404

**目标**: 修复 `GET /api/v1/entities/:id` 端点返回 404 的问题，即使 Entity 刚创建成功

**涉及范围**:

1. `wrapper/src/routers/entities.py` — 检查 GET 端点实现
2. `wrapper/src/services/entity_service.py` — 检查查询逻辑
3. SurrealDB 查询语句 — 验证 ID 格式匹配

**前置依赖**:

- 无

**完成标准**:

1. `GET /api/v1/entities/{id}` 返回正确的 Entity 数据
2. 支持 `level` 参数（0=abstract, 1=overview, 2=full）
3. 响应时间 < 50ms
4. 现有 Entity 创建测试不受影响

**验证方式**:

1. **API 测试**: 创建 Entity 后立即查询

   ```bash
   # 创建
   curl -X POST http://localhost:18008/api/v1/entities \
     -H "Content-Type: application/json" \
     -H "WRAPPER_MEILI_API_KEY: your-key" \
     -d '{"type":"code","abstract":"test"}'

   # 查询（应返回 200）
   curl http://localhost:18008/api/v1/entities/{id} \
     -H "WRAPPER_MEILI_API_KEY: your-key"
   ```

2. **Level 参数测试**: 验证 level=0/1/2 返回正确字段
3. **单元测试**: Mock SurrealDB 查询，验证逻辑正确
4. **集成测试**: 实际调用后端 API

**工时**: 2 小时

**状态**: 🆕 新建

---

### BL-B-33 [P0] 修复 Reference 创建失败（from_id 不存在）

**目标**: 修复 `POST /api/v1/references` 返回 "from_id 不存在" 的问题，即使 Atom 确实存在

**涉及范围**:

1. `wrapper/src/routers/references.py` — 检查 POST 端点实现
2. `wrapper/src/services/reference_service.py` — 检查 Atom 存在性验证逻辑
3. SurrealDB 查询 — 验证 Atom ID 解析逻辑

**前置依赖**:

- 无

**完成标准**:

1. `POST /api/v1/references` 成功创建 Reference
2. 正确验证 `from_id` 和 `to_id` 存在性
3. 支持所有 Reference 类型（calls, imports, extends, implements, related）
4. 响应时间 < 100ms

**验证方式**:

1. **API 测试**: 创建 Atom 后创建 Reference

   ```bash
   # 创建 Atom
   curl -X POST http://localhost:18008/api/v1/atoms \
     -H "Content-Type: application/json" \
     -H "WRAPPER_MEILI_API_KEY: your-key" \
     -d '{"type":"function","name":"testFunc"}'

   # 创建 Reference（应返回 201）
   curl -X POST http://localhost:18008/api/v1/references \
     -H "Content-Type: application/json" \
     -H "WRAPPER_MEILI_API_KEY: your-key" \
     -d '{"from_id":"atom:xxx","to_id":"atom:yyy","type":"calls"}'
   ```

2. **存在性验证测试**: 验证不存在的 ID 返回 400
3. **单元测试**: Mock SurrealDB 查询，验证逻辑正确
4. **集成测试**: 实际调用后端 API

**工时**: 2 小时

**状态**: 🆕 新建

---

## 待实施任务

### WebSocket

| 任务   | 优先级 | 工时   | 状态            |
| ------ | ------ | ------ | --------------- |
| BL-B-4 | P1     | 1 天   | ⏳ DIFF 模式    |
| BL-B-6 | P1     | 0.5 天 | ⏳ 并发连接测试 |
| BL-B-7 | P1     | 0.5 天 | ⏳ 消息延迟测试 |

### Precompute Service

| 任务    | 优先级 | 工时   | 状态        |
| ------- | ------ | ------ | ----------- |
| BL-B-11 | P2     | 0.5 天 | ⏳ 循环检测 |
| BL-B-12 | P2     | 0.5 天 | ⏳ 权重计算 |

### Deployment

| 任务    | 优先级 | 工时   | 状态                       |
| ------- | ------ | ------ | -------------------------- |
| BL-B-23 | P1     | 0.5 天 | ⏳ Docker 多阶段构建       |
| BL-B-24 | P1     | 0.5 天 | ⏳ docker-compose 健康检查 |
| BL-B-25 | P2     | 0.5 天 | ⏳ SSL 自动续期            |

### Testing

| 任务    | 优先级 | 工时   | 状态                   |
| ------- | ------ | ------ | ---------------------- |
| BL-B-26 | P0     | 1 天   | ⏳ WebSocket 单元测试  |
| BL-B-27 | P0     | 1 天   | ⏳ Precompute 单元测试 |
| BL-B-28 | P1     | 1 天   | ⏳ WebSocket E2E 测试  |
| BL-B-29 | P1     | 0.5 天 | ⏳ API E2E 测试        |
| BL-B-30 | P2     | 0.5 天 | ⏳ 性能基准测试        |

---

## 统计

| 分类       | 总数   | P0    | P1    | P2    |
| ---------- | ------ | ----- | ----- | ----- |
| Bug 修复   | 2      | 2     | 0     | 0     |
| WebSocket  | 3      | 0     | 3     | 0     |
| Precompute | 2      | 0     | 0     | 2     |
| Deployment | 3      | 0     | 2     | 1     |
| Testing    | 5      | 2     | 2     | 1     |
| **总计**   | **15** | **4** | **7** | **4** |

> **已完成**: 19 个任务（已归档至 `backlog_archive.md`）

---

## 参考文档

- [v3.2 RTM](../../docs/v3.2/RTM.md) — 实施追踪矩阵
- [v3.2 实施指南](../../docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md) — 完整实施计划
- [统一架构](../../docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md) — 架构设计
- [DATABASE-v3.2-SCHEMA](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md) — 数据库 Schema

---

_Backlog 最后更新: 2026-04-21_
