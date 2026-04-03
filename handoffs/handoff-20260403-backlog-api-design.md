# Session Handoff - Backlog-as-a-Service API Design

**日期**: 2026-04-03  
**任务焦点**: 为 Agent 设计 Backlog-as-a-Service API，替代手动维护 Markdown 文件  
**当前状态**: 方案设计已完成，待确认后进入 Phase 1 实现

---

## 快速上下文

### 问题定义

当前 `BACKLOG.md` 有 **527 行、39 个 backlog 项**，Agent 操作是**字符串解析地狱**：

- 创建项：手动分配 BL-XX 编号、填充 5 要素表格
- 更新状态：正则匹配替换表格内容
- 查询：全文搜索，无结构化过滤
- 关系：无依赖图谱，纯文本描述

### 已完成的设计工作

1. **架构设计**：复用现有 Wrapper Service (`localhost:17999`)，新增 `/backlog` 命名空间
2. **API 设计**：REST API + SQLite 本地存储 + Meilisearch 搜索
3. **协议对比**：排除 A2A/ACP/MCP（过度设计）、排除 WebSocket（轮询足够）
4. **数据模型**：支持 5 要素（目标/范围/依赖/标准/验证）+ 关系图谱

### 核心决策（待确认）

| 决策项 | 选择         | 理由                           |
| ------ | ------------ | ------------------------------ |
| 协议   | 简单 REST    | Agent 不需要实时推送，轮询足够 |
| 存储   | SQLite 本地  | 复用现有架构，无需部署         |
| 搜索   | Meilisearch  | 已有基础设施                   |
| 实时   | 无 WebSocket | 减少复杂度                     |

---

## 技术设计详情

### API 端点规划

```javascript
// 1. 创建 backlog 项（最常用）
POST /api/v1/backlog
{
  "title": "优化测试超时",
  "priority": "P0",
  "description": "Checkpoint 3 测试经常超时",
  "tags": ["test", "timeout"],
  "estimated_hours": 4,
  "depends_on": ["BL-35"]
}
// 返回: { "id": "bl_01HR8...", "display_id": "BL-42", "status": "open" }

// 2. 批量更新（从 commit message 触发）
PATCH /api/v1/backlog/batch
{
  "items": ["BL-36", "BL-37", "BL-38"],
  "updates": { "status": "completed" },
  "trigger": { "type": "git_commit", "commit": "abc123" }
}

// 3. 关系图谱查询
GET /api/v1/backlog/BL-36/graph?depth=2
// 返回: { "nodes": [...], "edges": [...] }

// 4. 导出为 Markdown
GET /api/v1/backlog/export?format=markdown&filter=status:completed
```

### 数据模型

```typescript
// Backlog 项（复用现有 memory 结构）
interface BacklogItem {
  id: string; // 内部 ID: bl_01HR8...
  display_id: string; // 展示 ID: BL-42

  // 5 要素
  title: string; // 目标一句话
  scope: string[]; // 涉及范围（文件列表）
  dependencies: string[]; // 前置依赖（BL-XX 列表）
  acceptance_criteria: string[]; // 完成标准
  verification_method: string; // 验证方式

  // 元数据
  priority: "P0" | "P1" | "P2" | "P3";
  status: "open" | "in_progress" | "completed" | "blocked";
  tags: string[];
  estimated_hours: number;
  actual_hours?: number;

  // 关系图谱
  relations: {
    blocks: string[]; // 阻塞了哪些任务
    depends_on: string[]; // 依赖哪些任务
    relates_to: string[]; // 关联任务
  };

  // 时间戳
  created_at: string;
  updated_at: string;
  completed_at?: string;

  // 来源追踪
  source?: {
    type: "git_commit" | "manual" | "import";
    commit?: string;
    message?: string;
  };
}
```

### 与现有系统集成

```javascript
// 复用现有的 WrapperClient
const client = new WrapperClient({
  baseUrl: 'http://localhost:17999',
  apiKey: process.env.WRAPPER_MEILI_API_KEY
});

// Backlog API 挂载在 /backlog 路径
await client.post('/api/v1/backlog', {...});
await client.get('/api/v1/backlog/search', {...});

// 复用现有认证机制
Authorization: Bearer ${WRAPPER_MEILI_API_KEY}

// 数据存储
- SQLite: backlog 表（本地文件）
- Meilisearch: 全文搜索（已有基础设施）
- Git: 版本控制（可选导出到 BACKLOG.md）
```

---

## 下一步行动（需要你确认）

### 需要决策的问题

1. **API 认证**：复用 `WRAPPER_MEILI_API_KEY` 还是新增独立认证？
   - 推荐：复用，简化配置

2. **优先级**：是否支持 P0/P1/P2/P3 之外的自定义优先级？
   - 推荐：暂时只支持这四级，保持简单

3. **关系方向**：存储双向关系（A 阻塞 B 且 B 被 A 阻塞）还是单向？
   - 推荐：存储双向，查询更方便

4. **Git 集成深度**：
   - 选项 A：只支持导出 Markdown（只读）
   - 选项 B：双向同步（Git commit 自动更新 backlog，backlog 变更导出到 Git）
   - 推荐：选项 A，更简单可靠

### 确认后启动 Phase 1

收到你的确认后，我将开始：

**Phase 1: 核心 CRUD（预计 3 天）**

- [ ] 设计数据库 schema（SQLite）
- [ ] 实现 POST /api/v1/backlog（创建）
- [ ] 实现 GET /api/v1/backlog/:id（获取）
- [ ] 实现 PATCH /api/v1/backlog/:id（更新）
- [ ] 实现 DELETE /api/v1/backlog/:id（删除）
- [ ] 自动分配 BL-XX 编号逻辑
- [ ] 基础测试

请确认上述决策问题，或提出调整建议。确认后立即开始实现。
