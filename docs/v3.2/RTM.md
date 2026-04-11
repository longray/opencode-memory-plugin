# v3.2 实施追踪矩阵（RTM）

> **项目**: OpenCode Memory Plugin (Node.js)  
> **版本**: v3.2.0  
> **基线标签**: [v3.2-design-baseline](https://github.com/longray/opencode-memory-plugin/releases/tag/v3.2-design-baseline)  
> **最后更新**: 2026-04-11  
> **状态**: 开发中  
> **Backlog**: [opencode-memory-plugin/BACKLOG.md](../../opencode-memory-plugin/BACKLOG.md)

---

## 说明

本矩阵追踪 v3.2 架构设计到**插件端**代码实现的映射关系，确保每个设计点都有对应的实现和测试。

**注**: 标记为 ❌ 后端的项为后端独占功能，插件端通过 API 调用使用，不在本 RTM 追踪范围内。

---

## 风险图例

| 等级 | 标记 | 含义 |
|------|------|------|
| 🔴 高 | 高风险 | 技术复杂度高或依赖未就绪，可能阻塞发布 |
| 🟡 中 | 中风险 | 有一定复杂度，需关注进度 |
| 🟢 低 | 低风险 | 常规实现，风险可控 |

---

## 状态图例

| 状态 | 标记 | 含义 |
|------|------|------|
| ⏳ | 待实现 | 尚未开始开发 |
| 🔄 | 进行中 | 开发中 |
| ⚠️ | 有风险 | 开发中但遇到阻碍 |
| ✅ | 已完成 | 已通过验收 |
| ❌ | 已取消 | 不再实施 |

---

## 1. WebSocket 客户端模块

| 设计ID | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 | Backlog |
|--------|--------|----------|----------|------|------|---------|
| WS-001 | 心跳机制 30s | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🔴 高 | BL-P-1 |
| WS-002 | 2次未响应触发重连 | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🔴 高 | BL-P-1 |
| WS-003 | 指数退避重连 1→2→4s | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🔴 高 | BL-P-1 |
| WS-004 | 最大重连 10次 | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🔴 高 | BL-P-1 |
| WS-005 | 消息确认 ACK | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🔴 高 | BL-P-2 |
| WS-006 | DIFF 模式 | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🟡 中 | BL-P-3 |
| WS-007 | 并发连接 ≥1000 | `tests/performance/ws-load-test.js` | 性能测试 | ⏳ | 🔴 高 | BL-P-10 |
| WS-008 | 消息延迟 p99<100ms | `tests/performance/ws-load-test.js` | 性能测试 | ⏳ | 🔴 高 | BL-P-10 |
| WS-009 | 心跳成功率 ≥99% | `tests/performance/ws-load-test.js` | 性能测试 | ⏳ | 🟡 中 | BL-P-10 |

---

## 2. PrecomputeService 模块

| 设计ID | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 | Backlog |
|--------|--------|----------|----------|------|------|---------|
| PC-001 | 批处理大小 100 | — | — | ❌ 后端 | — | — |
| PC-002 | 增量分析（指纹） | `lib/code-fingerprint.js` | `tests/test-code-fingerprint.test.js` | ⏳ | 🟡 中 | BL-P-6 |
| PC-003 | 调用关系创建 | — | — | ❌ 后端 | — | — |
| PC-004 | 循环检测 | — | — | ❌ 后端 | — | — |
| PC-005 | 权重计算 | — | — | ❌ 后端 | — | — |
| PC-006 | 性能监控 | — | — | ❌ 后端 | — | — |
| PC-007 | 并发控制 | — | — | ❌ 后端 | — | — |

---

## 3. 数据库 Schema 模块

| 设计ID | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 | Backlog |
|--------|--------|----------|----------|------|------|---------|
| DB-001 | atom 表 | — | — | ❌ 后端 | — | — |
| DB-002 | entity 表 | — | — | ❌ 后端 | — | — |
| DB-003 | reference 表 | — | — | ❌ 后端 | — | — |
| DB-004 | tenant_id 预留字段 | — | — | ❌ 后端 | — | — |
| DB-005 | ChangeFeed 7d | — | — | ❌ 后端 | — | — |

---

## 4. API 模块

| 设计ID | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 | Backlog |
|--------|--------|----------|----------|------|------|---------|
| API-001 | Memory CRUD | `tools/core.js` | `tests/test-core.test.js` | ⏳ | 🟢 低 | BL-P-7 |
| API-002 | Code Analysis | `lib/code-analyzer.js` | `tests/test-code-analysis.test.js` | ⏳ | 🟡 中 | BL-P-8 |
| API-003 | WebSocket 连接 | `lib/ws-client.js` | `tests/test-ws-client.test.js` | ⏳ | 🔴 高 | BL-P-1 |
| API-004 | Meilisearch SDK 0.40 | — | — | ❌ 后端 | — | — |

---

## 5. 部署配置模块

| 设计ID | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 | Backlog |
|--------|--------|----------|----------|------|------|---------|
| DEP-001 | Docker 多阶段构建 | — | — | ❌ 后端 | — | — |
| DEP-002 | docker-compose 配置 | — | — | ❌ 后端 | — | — |
| DEP-003 | Kubernetes 部署 | — | — | ❌ 后端 | — | — |
| DEP-004 | SSL 自动续期 | — | — | ❌ 后端 | — | — |
| DEP-005 | 端口迁移 17999→18008 | `lib/wrapper-client.js` | 集成测试 | ⏳ | 🟡 中 | BL-P-4 |

---

## 6. 依赖版本模块

| 设计ID | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 | Backlog |
|--------|--------|----------|----------|------|------|---------|
| VER-001 | tree-sitter 0.25.x | — | — | ❌ 后端 | — | — |
| VER-002 | surrealdb 1.0.8 | — | — | ❌ 后端 | — | — |
| VER-003 | meilisearch 0.40.0 | — | — | ❌ 后端 | — | — |
| VER-004 | ws 8.20.0 | `package.json` | 依赖安装测试 | ⏳ | 🟢 低 | BL-P-5 |

---

## 统计摘要

### 插件端追踪项

| 模块 | 总数 | 已完成 | 进行中 | 待实现 | 高风险 | 有 Backlog 映射 |
|------|------|--------|--------|--------|--------|----------------|
| WebSocket | 9 | 0 | 0 | 9 | 6 | 9 |
| PrecomputeService | 1 | 0 | 0 | 1 | 0 | 1 |
| API | 3 | 0 | 0 | 3 | 1 | 3 |
| Deployment | 1 | 0 | 0 | 1 | 0 | 1 |
| Dependencies | 1 | 0 | 0 | 1 | 0 | 1 |
| **插件端小计** | **15** | **0** | **0** | **15** | **7** | **15** |

### 后端独占项（仅供参考）

| 模块 | 数量 | 说明 |
|------|------|------|
| PrecomputeService | 6 | PC-001, PC-003~007 |
| Database Schema | 5 | DB-001~005 |
| API | 1 | API-004 |
| Deployment | 4 | DEP-001~004 |
| Dependencies | 3 | VER-001~003 |
| **后端独占小计** | **19** | — |

### 总览

| 指标 | 值 |
|------|-----|
| 总追踪项 | 34 |
| 插件端 | 15 (44%) |
| 后端独占 | 19 (56%) |
| 高风险 | 7 |
| Backlog 映射率 | 15/15 (100%) |
| 完成率 | 0% |

---

## 更新记录

| 日期 | 更新内容 | 更新人 |
|------|----------|--------|
| 2026-04-10 | 初始版本，创建 34 个追踪项 | OpenCode |
| 2026-04-11 | 对齐后端 RTM 结构：增加项目标识、风险图例、Backlog 列；修正代码/测试路径；标记后端独占项 | OpenCode |

---

_基线标签: v3.2-design-baseline_  
_文档版本: v3.2.0-plugin_
