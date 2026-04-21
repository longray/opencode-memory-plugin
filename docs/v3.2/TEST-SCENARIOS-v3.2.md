# 测试场景与用例：opencode-memory-plugin v3.2

**版本**: v3.2.2  
**更新时间**: 2026-04-21  
**基于**: [BEST-PRACTICES-v2.md](../BEST-PRACTICES-v2.md)

---

## 目录

1. [测试策略概述](#一测试策略概述)
2. [Layer 1: 数据层测试](#二layer-1-数据层测试)
3. [Layer 2: 后端服务层测试](#三layer-2-后端服务层测试)
4. [Layer 3: 插件层测试](#四layer-3-插件层测试)
5. [Layer 4: OpenCode 集成测试](#五layer-4-opencode-集成测试)
6. [Layer 5: oh-my-opencode 编排测试](#六layer-5-oh-my-opencode-编排测试)
7. [端到端场景测试](#七端到端场景测试)
8. [性能与压力测试](#八性能与压力测试)
9. [测试执行计划](#九测试执行计划)

---

## 一、测试策略概述

### 1.1 测试金字塔

```
        /\
       /  \     E2E 场景测试 (10%)
      /____\
     /      \   集成测试 (30%)
    /________\
   /          \ 单元测试 (60%)
  /____________\
```

### 1.2 测试分类

| 层级 | 测试类型     | 目标                       | 自动化    |
| ---- | ------------ | -------------------------- | --------- |
| L1   | 数据模型测试 | Atom/Entity/Reference CRUD | ✅        |
| L2   | API 契约测试 | 后端接口符合 OpenAPI       | ✅        |
| L3   | 插件功能测试 | 15 工具 + 2 代理           | ✅        |
| L4   | 集成测试     | OpenCode × 插件 × 后端     | ✅        |
| L5   | 编排测试     | 多智能体协作               | ⚠️ 半自动 |
| E2E  | 场景测试     | 完整用户旅程               | ⚠️ 半自动 |

### 1.3 测试环境矩阵

| 环境     | 后端            | 插件 | OpenCode | 用途     |
| -------- | --------------- | ---- | -------- | -------- |
| 单元测试 | Mock            | 本地 | Mock     | 快速反馈 |
| 集成测试 | localhost:18008 | 本地 | 真实     | API 验证 |
| E2E 测试 | localhost:18008 | 本地 | 真实     | 完整流程 |
| 生产验证 | 生产后端        | 生产 | 生产     | 冒烟测试 |

---

## 二、Layer 1: 数据层测试

### 2.1 Atom 数据模型测试

#### TC-ATOM-001: 创建 Atom - 函数类型

**前置条件**: 后端服务运行，API key 有效
**输入**:

```json
{
  "type": "function",
  "name": "calculateSum",
  "signature": "calculateSum(a: number, b: number): number",
  "location": {
    "file": "src/utils/math.js",
    "line_start": 10,
    "line_end": 15
  },
  "metadata": {
    "params": [
      { "name": "a", "type": "number" },
      { "name": "b", "type": "number" }
    ],
    "return_type": "number",
    "is_async": false,
    "is_exported": true
  }
}
```

**预期输出**:

- HTTP 201 Created
- 返回 atom ID (格式: `atom:{ulid}`)
- 数据持久化到 SurrealDB

#### TC-ATOM-002: 创建 Atom - 类类型

**输入**:

```json
{
  "type": "class",
  "name": "UserService",
  "signature": "class UserService",
  "location": {
    "file": "src/services/user.js",
    "line_start": 1,
    "line_end": 50
  },
  "metadata": {
    "methods": ["findById", "create", "update"],
    "extends": "BaseService",
    "implements": ["IUserService"]
  }
}
```

**预期输出**: HTTP 201，返回 atom ID

#### TC-ATOM-003: 批量创建 Atoms

**输入**: 包含 100 个 function atoms 的数组
**预期输出**:

- HTTP 201
- 返回 100 个 atom IDs
- 总耗时 < 5s

#### TC-ATOM-004: 获取 Atom

**前置条件**: TC-ATOM-001 已执行
**输入**: `GET /api/v1/atoms/{atom_id}`
**预期输出**:

- HTTP 200
- 返回完整 atom 数据
- 包含 `created_at` 和 `updated_at` 时间戳

#### TC-ATOM-005: 更新 Atom

**输入**: `PUT /api/v1/atoms/{atom_id}`

```json
{
  "metadata": {
    "is_deprecated": true,
    "deprecated_reason": "Use calculateTotal instead"
  }
}
```

**预期输出**:

- HTTP 200
- `updated_at` 时间戳更新
- 仅指定字段更新，其他保持不变

#### TC-ATOM-006: 删除 Atom

**输入**: `DELETE /api/v1/atoms/{atom_id}`
**预期输出**:

- HTTP 204 No Content
- 关联的 References 自动清理

#### TC-ATOM-007: 创建重复 Atom

**前置条件**: 同名 atom 已存在
**输入**: 与 TC-ATOM-001 相同
**预期输出**:

- HTTP 409 Conflict
- 错误信息包含现有 atom ID

### 2.2 Entity 数据模型测试

#### TC-ENTITY-001: 创建 Entity - 代码文件

**输入**:

```json
{
  "type": "code",
  "name": "src/utils/math.js",
  "abstract": "Math utilities with 5 functions",
  "atoms": ["atom:xxx", "atom:yyy"],
  "metadata": {
    "language": "javascript",
    "total_lines": 150,
    "function_count": 5,
    "class_count": 0
  }
}
```

**预期输出**: HTTP 201，返回 entity ID

#### TC-ENTITY-002: 创建 Entity - 记忆条目

**输入**:

```json
{
  "type": "memory",
  "name": "User preference for TypeScript",
  "abstract": "User prefers TypeScript over JavaScript",
  "content": "...",
  "tags": ["preference", "typescript"]
}
```

**预期输出**: HTTP 201

#### TC-ENTITY-003: 创建 Entity - Backlog 条目 ✅ 新增

**输入**:

```json
{
  "type": "backlog",
  "name": "BL-001: Implement user authentication",
  "abstract": "Add JWT-based authentication",
  "status": "in_progress",
  "priority": "P0",
  "metadata": {
    "assignee": "developer",
    "due_date": "2026-04-30",
    "estimated_hours": 8
  }
}
```

**预期输出**: HTTP 201，包含 backlog 特有字段

#### TC-ENTITY-004: 获取 Entity - Level 0

**输入**: `GET /api/v1/entities/{id}?level=0`
**预期输出**:

- 仅返回 `abstract` 字段
- 响应大小 < 200 bytes

#### TC-ENTITY-005: 获取 Entity - Level 1

**输入**: `GET /api/v1/entities/{id}?level=1`
**预期输出**:

- 返回 `abstract` + `overview`
- 响应大小 < 1KB

#### TC-ENTITY-006: 获取 Entity - Level 2

**输入**: `GET /api/v1/entities/{id}?level=2`
**预期输出**:

- 返回完整内容
- 包含所有 atoms 和 references

### 2.3 Reference 数据模型测试

#### TC-REF-001: 创建 Reference - 函数调用

**输入**:

```json
{
  "from_id": "atom:calculateSum",
  "to_id": "atom:validateInput",
  "type": "calls",
  "weight": 1.0,
  "metadata": {
    "line": 12,
    "column": 5,
    "is_dynamic": false
  }
}
```

**预期输出**: HTTP 201，返回 reference ID

#### TC-REF-002: 创建 Reference - 导入关系

**输入**:

```json
{
  "from_id": "entity:math.js",
  "to_id": "atom:lodash",
  "type": "imports",
  "weight": 0.8
}
```

**预期输出**: HTTP 201

#### TC-REF-003: 查询 References

**输入**: `GET /api/v1/references?from_id=atom:xxx`
**预期输出**:

- HTTP 200
- 返回所有从该 atom 出发的 references
- 支持分页

#### TC-REF-004: 删除 Reference

**输入**: `DELETE /api/v1/references/{ref_id}`
**预期输出**: HTTP 204

---

## 三、Layer 2: 后端服务层测试

### 3.1 健康检查测试

#### TC-HEALTH-001: 基础健康检查

**输入**: `GET /health`
**预期输出**:

```json
{
  "status": "healthy",
  "version": "3.2.2",
  "services": {
    "surrealdb": "connected",
    "meilisearch": "available",
    "websocket": "active"
  }
}
```

#### TC-HEALTH-002: 降级状态检查

**前置条件**: Meilisearch 不可用
**预期输出**:

```json
{
  "status": "degraded",
  "services": {
    "surrealdb": "connected",
    "meilisearch": "unavailable"
  }
}
```

### 3.2 搜索 API 测试

#### TC-SEARCH-001: Hybrid 搜索

**输入**:

```json
{
  "query": "如何处理异步错误",
  "mode": "hybrid",
  "limit": 10,
  "threshold": 0.3
}
```

**预期输出**:

- HTTP 200
- 返回结果包含 `score`（混合分数）
- 结果按相关性排序

#### TC-SEARCH-002: Vector 搜索

**输入**: `mode: "vector"`
**预期输出**:

- 使用 embedding 服务
- 返回语义相似结果

#### TC-SEARCH-003: Keyword 搜索

**输入**: `mode: "keyword"`
**预期输出**:

- 使用 BM25 算法
- 返回精确匹配结果

#### TC-SEARCH-004: 搜索建议

**输入**: `GET /api/v1/memories/suggest?prefix="asy"`
**预期输出**:

- 返回以 "asy" 开头的关键词建议
- 最多 10 条

### 3.3 同步 API 测试

#### TC-SYNC-001: 增量同步预览

**输入**:

```json
{
  "fingerprints": [
    { "id": "memory:xxx", "hash": "abc123", "modified": "2026-04-21T10:00:00Z" }
  ]
}
```

**预期输出**:

- 返回需要同步的条目列表
- 区分 `upload` / `download` / `conflict`

#### TC-SYNC-002: 全量同步

**输入**: `POST /api/v1/sync/full`
**预期输出**:

- 返回同步统计
- 支持断点续传

### 3.4 WebSocket 测试

#### TC-WS-001: 连接建立

**输入**: `ws://localhost:18008/ws/memories/live?mode=full`
**预期输出**:

- 收到 `connected` 消息
- 包含 `session_id`

#### TC-WS-002: 心跳机制

**输入**: 等待 30s
**预期输出**:

- 收到后端 `ping` 消息
- 自动回复 `pong`（携带 timestamp）

#### TC-WS-003: 变更推送

**前置条件**: 已建立 WebSocket 连接
**操作**: 通过 HTTP API 创建 memory
**预期输出**:

- WebSocket 收到 `memory_change` 消息
- 包含 `action: "CREATE"` 和完整数据

#### TC-WS-004: 断线重连

**操作**: 断开网络 10s，然后恢复
**预期输出**:

- 自动重连（最多 10 次）
- 携带原 `session_id`
- 收到 `reconnected` 消息

---

## 四、Layer 3: 插件层测试

### 4.1 核心工具测试

#### TC-TOOL-001: memory_write - 基础写入

**输入**:

```javascript
memory_write({
  content: "User prefers TypeScript",
  abstract: "TS preference",
  overview: "User likes TypeScript for type safety",
  type: "preference",
  tags: ["preference", "typescript"],
});
```

**预期输出**:

- 返回 memory ID
- 本地 timeline 创建条目
- 后端同步成功

#### TC-TOOL-002: memory_write - 缺少必填字段

**输入**: 缺少 `abstract`
**预期输出**:

- 返回错误："abstract is required"
- HTTP 400

#### TC-TOOL-003: memory_read - 渐进加载

**输入**:

```javascript
memory_read({ entry_id: "memory:xxx", level: 1 });
```

**预期输出**:

- 返回 abstract + overview
- 不包含完整 content

#### TC-TOOL-004: memory_search - Hybrid 模式

**输入**:

```javascript
memory_search({
  query: "async error handling",
  mode: "hybrid",
  limit: 5,
});
```

**预期输出**:

- 返回 5 条结果
- 每条包含 `score` 和 `abstract`

#### TC-TOOL-005: memory_relate - 创建关系

**输入**:

```javascript
memory_relate({
  action: "create",
  from_id: "memory:xxx",
  to_id: "memory:yyy",
  relation_type: "related",
  weight: 0.9,
});
```

**预期输出**:

- 返回 relation ID
- 双向关系建立

#### TC-TOOL-006: memory_graph - 图遍历

**输入**:

```javascript
memory_graph({
  memory_id: "memory:xxx",
  depth: 2,
  limit: 20,
});
```

**预期输出**:

- 返回关联的记忆图谱
- 最多 20 个节点
- 包含关系类型和权重

#### TC-TOOL-007: memory_timeline - 时间线浏览

**输入**:

```javascript
memory_timeline({ days: 7, level: 1 });
```

**预期输出**:

- 返回最近 7 天的记忆
- 按日期分组
- 每条显示 abstract

#### TC-TOOL-008: memory_topics - 主题发现

**输入**:

```javascript
memory_topics({ min_entries: 5 });
```

**预期输出**:

- 返回活跃主题列表
- 每个主题包含条目数

#### TC-TOOL-009: incremental_sync - 增量同步

**输入**:

```javascript
incremental_sync({ dry_run: false });
```

**预期输出**:

- 返回同步统计
- 本地 fingerprint 与后端对比

#### TC-TOOL-010: full_sync - 全量同步

**输入**:

```javascript
full_sync({ auto_resolve: true });
```

**预期输出**:

- 完整同步所有记忆
- 自动解决冲突

#### TC-TOOL-011: index_status - 状态检查

**输入**:

```javascript
index_status({ detailed: true });
```

**预期输出**:

```json
{
  "backend_connected": true,
  "local_entries": 150,
  "pending_sync": 0,
  "websocket_status": "connected"
}
```

#### TC-TOOL-012: conflict_list - 冲突查看

**输入**:

```javascript
conflict_list({ limit: 10 });
```

**预期输出**:

- 返回未解决的冲突列表
- 每个冲突包含本地和远程版本

#### TC-TOOL-013: conflict_resolve - 冲突解决

**输入**:

```javascript
conflict_resolve({
  conflict_id: "conflict:xxx",
  resolution: "USE_LOCAL",
});
```

**预期输出**:

- 冲突标记为已解决
- 数据更新

### 4.2 代码分析测试

#### TC-CODE-001: Tree-sitter Query - JavaScript

**输入文件**: `src/utils/helper.js`

```javascript
function formatDate(date) {
  return new Date(date).toISOString();
}

class DateFormatter {
  format(input) {
    return formatDate(input);
  }
}

export { formatDate, DateFormatter };
```

**预期输出**:

- 提取 1 个 function atom: `formatDate`
- 提取 1 个 class atom: `DateFormatter`
- 提取 1 个 export atom
- 创建 1 个 entity (type: code)
- 创建 reference: `DateFormatter.format` → calls → `formatDate`

#### TC-CODE-002: 代码分析 - Python

**输入文件**: `src/utils/helper.py`

```python
def calculate_sum(a: int, b: int) -> int:
    return a + b

class Calculator:
    def add(self, x, y):
        return calculate_sum(x, y)
```

**预期输出**:

- 正确提取 Python 函数和类
- 识别类型注解
- 建立调用关系

#### TC-CODE-003: 指纹缓存 - 未变更文件

**前置条件**: 文件已分析过
**操作**: 再次保存相同文件
**预期输出**:

- 命中指纹缓存
- 跳过重复分析
- 日志显示 "Fingerprint match, skipping analysis"

#### TC-CODE-004: 隐私过滤

**输入文件**: `.env` (包含 API keys)
**预期输出**:

- 识别为敏感文件
- 跳过分析
- 日志显示 "Skipping sensitive file"

### 4.3 代理测试

#### TC-AGENT-001: The Observer - 自动保存

**场景**: 用户对话包含重要决策
**对话内容**: "我决定使用 React 而不是 Vue"
**预期行为**:

- Observer 识别为偏好
- 展示候选清单
- 用户确认后保存到记忆

#### TC-AGENT-002: The Librarian - 知识整合

**场景**: 运行 `@memory-consolidate`
**预期行为**:

- 查询最近 7 天记忆
- 识别碎片知识
- 聚合为高质量节点
- 建立关系图谱

---

## 五、Layer 4: OpenCode 集成测试

### 5.1 工具调用链测试

#### TC-CHAIN-001: 搜索 → 读取 → 关联

**场景**:

1. 用户提问："我们怎么处理错误？"
2. AI 调用 `memory_search` 搜索 "error handling"
3. 找到相关记忆
4. 调用 `memory_read(level=2)` 读取详情
5. 调用 `memory_relate` 建立与当前对话的关系

**预期输出**:

- 完整回答用户问题
- 新对话自动关联相关记忆

#### TC-CHAIN-002: 写入 → 同步 → 验证

**场景**:

1. 用户："记住我喜欢用 async/await"
2. AI 调用 `memory_write`
3. 调用 `incremental_sync`
4. 调用 `index_status` 验证

**预期输出**:

- 记忆保存成功
- 同步完成
- 状态显示条目数 +1

### 5.2 错误恢复测试

#### TC-ERROR-001: 后端不可用

**前置条件**: 后端服务停止
**操作**: 调用 `memory_write`
**预期输出**:

- 本地保存成功
- 后端同步失败（记录待同步）
- 返回成功（本地）
- 日志显示后端不可用

#### TC-ERROR-002: 网络中断恢复

**场景**:

1. 网络中断期间写入 5 条记忆
2. 网络恢复
3. WebSocket 自动重连
4. 触发同步

**预期输出**:

- 5 条记忆全部同步到后端
- 无数据丢失

---

## 六、Layer 5: oh-my-opencode 编排测试

### 6.1 多智能体协作测试

#### TC-ORCH-001: Sisyphus 任务分发

**场景**: 复杂功能开发任务
**预期行为**:

1. Sisyphus 接收任务
2. 调用 `memory_search` 查找历史方案
3. 分发子任务给 Prometheus（规划）
4. Prometheus 创建 Backlog 条目
5. Atlas 执行代码开发
6. 完成后更新 Backlog 状态

#### TC-ORCH-002: Oracle 架构决策

**场景**: 需要技术决策
**预期行为**:

1. Oracle 查询 `memory_graph` 查找相关决策
2. 分析历史方案优缺点
3. 提供决策建议
4. 决策保存到记忆

### 6.2 Hook 集成测试

#### TC-HOOK-001: PreToolUse Hook

**场景**: 危险操作前拦截
**预期行为**:

- 检测到 `memory_delete` 调用
- 提示用户确认
- 记录操作意图

#### TC-HOOK-002: PostToolUse Hook

**场景**: 自动保存工具结果
**预期行为**:

- `memory_search` 返回结果
- 自动保存搜索上下文
- 建立与后续操作的关系

---

## 七、端到端场景测试

### 7.1 场景一：新用户入门

**用户**: 首次使用插件的开发者
**目标**: 完成首次记忆写入和读取

**步骤**:

1. 安装插件
2. 配置 API key
3. 运行 `index_status` 检查连接
4. 对话中声明偏好："我喜欢用 TypeScript"
5. Observer 自动识别并保存
6. 新对话中提问："我喜欢用什么语言？"
7. AI 搜索记忆并回答

**验证点**:

- ✅ 后端连接正常
- ✅ 记忆自动保存
- ✅ 语义搜索能找到相关记忆
- ✅ 回答准确

### 7.2 场景二：代码分析工作流

**用户**: 正在开发功能的工程师
**目标**: 分析代码变更影响

**步骤**:

1. 保存文件 `src/auth.js`
2. 插件自动触发代码分析
3. 提取函数 atoms: `login`, `logout`, `verifyToken`
4. 创建 entity (type: code)
5. 建立调用关系
6. 用户提问："修改 login 会影响哪些地方？"
7. AI 查询 `memory_graph` 查找引用
8. 显示影响范围

**验证点**:

- ✅ 代码分析自动触发
- ✅ Atoms 正确提取
- ✅ 调用关系正确建立
- ✅ 影响分析准确

### 7.3 场景三：知识整合

**用户**: 使用插件一周后的开发者
**目标**: 整理碎片知识

**步骤**:

1. 运行 `@memory-consolidate`
2. Librarian 查询最近 7 天记忆
3. 识别主题："代码规范"、"API 设计"、"错误处理"
4. 聚合每个主题为高质量节点
5. 建立主题间关系
6. 置顶重要约定
7. 同步到后端

**验证点**:

- ✅ 碎片知识被识别
- ✅ 聚合节点质量高
- ✅ 关系图谱完整
- ✅ 同步成功

### 7.4 场景四：离线工作

**用户**: 在无网络环境的开发者
**目标**: 离线使用，恢复后同步

**步骤**:

1. 断开网络
2. 写入 10 条记忆
3. 查询 `index_status`（显示待同步 10 条）
4. 恢复网络
5. WebSocket 自动重连
6. 触发同步
7. 验证后端数据完整

**验证点**:

- ✅ 离线写入成功
- ✅ 待同步队列正确
- ✅ 自动重连成功
- ✅ 同步无丢失

### 7.5 场景五：多设备同步

**用户**: 在笔记本和台式机间切换
**目标**: 记忆无缝同步

**步骤**:

1. 设备 A 写入记忆
2. 设备 A 同步到后端
3. 设备 B 启动 OpenCode
4. 设备 B 运行 `full_sync`
5. 设备 B 查询记忆，确认同步
6. 设备 B 修改记忆
7. 设备 A 收到 WebSocket 推送
8. 设备 A 自动更新

**验证点**:

- ✅ 设备 B 能获取设备 A 的记忆
- ✅ WebSocket 实时推送
- ✅ 冲突正确处理

---

## 八、性能与压力测试

### 8.1 性能基准测试

#### TC-PERF-001: 代码分析性能

**输入**: 1000 行 JavaScript 文件
**预期**:

- Tree-sitter Query: < 100ms
- Atom 创建: < 500ms
- Entity 创建: < 200ms
- 总耗时: < 1s

#### TC-PERF-002: 搜索性能

**输入**: 搜索 "async error handling"
**预期**:

- Hybrid 模式: < 500ms
- Vector 模式: < 1s
- Keyword 模式: < 100ms

#### TC-PERF-003: 批量写入性能

**输入**: 100 条记忆批量写入
**预期**:

- 本地写入: < 1s
- 后端同步: < 5s
- 无内存泄漏

### 8.2 压力测试

#### TC-STRESS-001: 并发写入

**场景**: 100 个并发写入请求
**预期**:

- 无数据丢失
- 无重复 ID
- 后端响应时间 < 2s

#### TC-STRESS-002: 大文件分析

**场景**: 10,000 行代码文件
**预期**:

- 分析完成不崩溃
- 内存使用 < 500MB
- 可中断（用户取消）

#### TC-STRESS-003: WebSocket 长连接

**场景**: 保持连接 24 小时
**预期**:

- 心跳正常
- 自动重连 < 3 次
- 无内存泄漏

### 8.3 容量测试

#### TC-CAP-001: 大量记忆

**场景**: 100,000 条记忆
**预期**:

- 搜索性能不降级
- 内存使用稳定
- 同步时间可接受

#### TC-CAP-002: 复杂关系图

**场景**: 10,000 个节点，50,000 条边
**预期**:

- 图遍历 < 3s
- 可视化不卡顿

---

## 九、测试执行计划

### 9.1 测试阶段

| 阶段     | 时间   | 测试内容       | 通过标准     |
| -------- | ------ | -------------- | ------------ |
| 单元测试 | 持续   | L1-L3 所有 TC  | 覆盖率 > 80% |
| 集成测试 | 每日   | L2-L4 关键路径 | 100% 通过    |
| E2E 测试 | 每周   | 7 大场景       | 全部通过     |
| 性能测试 | 每周   | PERF 测试      | 符合基准     |
| 回归测试 | 发布前 | 全量测试       | 无阻塞 bug   |

### 9.2 自动化脚本

```bash
# 运行所有单元测试
npm test

# 运行集成测试（需要后端）
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行性能测试
npm run test:perf

# 全量测试
npm run test:all
```

### 9.3 测试报告模板

```markdown
## 测试报告 - 2026-04-21

### 执行摘要

- 总用例: 150
- 通过: 145
- 失败: 3
- 跳过: 2
- 通过率: 96.7%

### 失败用例

| TC-ID     | 描述     | 优先级 | 状态    |
| --------- | -------- | ------ | ------- |
| TC-WS-004 | 断线重连 | P1     | 🔴 失败 |

### 性能指标

- 平均搜索响应: 320ms (目标 < 500ms) ✅
- 代码分析: 850ms (目标 < 1000ms) ✅
- 内存使用: 180MB (稳定) ✅

### 建议

1. 修复 TC-WS-004 断线重连问题
2. 优化 TC-PERF-002 vector 搜索
```

---

## 附录

### A. 测试数据生成

```javascript
// 生成测试记忆
function generateTestMemories(count) {
  return Array.from({ length: count }, (_, i) => ({
    content: `Test memory ${i}`,
    abstract: `Abstract ${i}`,
    overview: `Overview for test ${i}`,
    type: i % 2 === 0 ? "general" : "code",
    tags: [`tag${i % 5}`, `category${i % 3}`],
  }));
}
```

### B. Mock 后端

```javascript
// 快速启动 Mock 后端用于测试
import { createMockBackend } from "./tests/mocks/backend.js";

const mockBackend = createMockBackend({
  port: 18008,
  latency: 50, // 模拟延迟
  failureRate: 0.01, // 1% 失败率
});

await mockBackend.start();
```

### C. 测试覆盖率检查

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看 HTML 报告
open coverage/index.html
```

---

**文档版本**: v1.0  
**最后更新**: 2026-04-21  
**维护者**: OpenCode Memory Team
