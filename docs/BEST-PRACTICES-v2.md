# 🧠 最佳实践：opencode-memory-plugin × 后端 × OpenCode × oh-my-opencode 协同指南

**版本**: v2.0  
**更新时间**: 2026-04-21  
**适用**: opencode-memory-plugin v3.2.2+ (Atom/Entity/Reference 架构)

---

## 一、五层架构全景

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5: oh-my-opencode (编排层)                        │
│  Sisyphus / Prometheus / Oracle / Explore...            │
│  多智能体调度 + Hooks + LSP + AST + MCP                 │
├─────────────────────────────────────────────────────────┤
│  Layer 4: OpenCode (基础 AI 平台)                        │
│  编码助手 + 工具调用 + 上下文管理                       │
├─────────────────────────────────────────────────────────┤
│  Layer 3: opencode-memory-plugin (记忆智能层)            │
│  15 工具 + 2 代理 + 代码分析 + WebSocket                │
│  Atom/Entity/Reference 架构 (v3.2+)                     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: 后端服务 (基础设施层)                          │
│  SurrealDB + Meilisearch + Embedding + WS                │
│  Atom/Entity/Reference API (v3.2+)                     │
├─────────────────────────────────────────────────────────┤
│  Layer 1: 原子记忆存储 (数据层)                          │
│  Atom (函数/类/导入) → Entity (代码文件) → Reference (关系)│
└─────────────────────────────────────────────────────────┘
```

**核心原则**：每层只做自己的事，通过标准接口协同。插件不知道 oh-my-opencode 的存在，oh-my-opencode 只调用插件的工具。

**v3.2+ 新架构**：从扁平的 Memory 模型升级为 **Atom/Entity/Reference 三层模型**，支持更精细的代码分析和关系追踪。

---

## 二、原子记忆架构详解

### 2.1 三层数据模型

```
┌─────────────────────────────────────────────────────────┐
│  Atom (原子) - 最小语义单元                              │
├─────────────────────────────────────────────────────────┤
│  • function  - 函数定义                                   │
│  • class   - 类定义                                     │
│  • import  - 导入语句                                   │
│  • type    - 类型定义                                   │
│  • variable - 变量定义                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Entity (实体) - 语义聚合单元                          │
├─────────────────────────────────────────────────────────┤
│  • code    - 代码文件 (关联多个 Atom)                   │
│  • memory  - 记忆条目                                   │
│  • backlog - 待办事项 ✅ 新增                            │
│  • wiki    - 文档条目                                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Reference (关系) - 语义连接                            │
├─────────────────────────────────────────────────────────┤
│  • calls      - 函数调用                                │
│  • imports    - 导入关系                                │
│  • extends    - 继承关系                                │
│  • implements - 实现关系                                │
│  • related    - 一般关联                                │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流示例

```
文件保存: src/utils/helper.js
    ↓
Tree-sitter Query API 分析
    ↓
提取 Atoms:
  • function: formatDate()
  • function: parseJSON()
  • import: lodash
    ↓
创建 Entity (type: code):
  • abstract: "JavaScript file: src/utils/helper.js (2 functions, 0 classes)"
  • atoms: [atom:formatDate, atom:parseJSON, atom:lodash]
    ↓
创建 References:
  • formatDate → calls → moment (外部库)
  • parseJSON → imports → lodash
    ↓
存储到 SurrealDB
```

### 2.3 API 端点

```
localhost:18008
├── /api/v1/atoms/*          ← Atom CRUD (新增)
│   ├── POST   /atoms        - 创建 Atom
│   ├── GET    /atoms/{id}   - 获取 Atom
│   ├── GET    /atoms        - 列出 Atoms
│   ├── PUT    /atoms/{id}   - 更新 Atom
│   └── DELETE /atoms/{id}   - 删除 Atom
│
├── /api/v1/entities/*       ← Entity CRUD (新增)
│   ├── POST   /entities     - 创建 Entity
│   ├── GET    /entities/{id} - 获取 Entity
│   ├── GET    /entities     - 列出 Entities
│   └── DELETE /entities/{id} - 删除 Entity
│
├── /api/v1/references/*     ← Reference CRUD (新增)
│   ├── POST   /references   - 创建 Reference
│   ├── GET    /references   - 查询 References
│   └── DELETE /references/{id} - 删除 Reference
│
├── /api/v1/memories/*       ← 传统 Memory API (兼容)
├── /api/v1/sync/*           ← 同步 API
├── /api/v1/calls/*          ← 代码调用关系
├── /api/v1/projects/*       ← 项目地图/统计
├── /ws/memories/live        ← WebSocket 实时推送
└── /health                  ← 健康检查
```

---

## 三、后端部署最佳实践

### 3.1 推荐部署方式

| 场景         | 部署方式          | 说明                         |
| ------------ | ----------------- | ---------------------------- |
| **个人开发** | Docker localhost  | 最简单，开箱即用             |
| **团队协作** | Docker 远程服务器 | 共享 SurrealDB + Meilisearch |
| **离线环境** | 本地全栈          | Embedding 用本地模型         |

### 3.2 后端必须就绪的服务

```bash
# 健康检查
curl http://localhost:18008/health

# Atom API 测试
curl http://localhost:18008/api/v1/atoms

# Entity API 测试
curl http://localhost:18008/api/v1/entities

# Reference API 测试
curl http://localhost:18008/api/v1/references
```

### 3.3 环境变量配置

```bash
# 必须设置
export WRAPPER_MEILI_API_KEY="your-api-key"

# 可选覆盖
export API_PORT=18008
export API_HOST=localhost
export WS_ENABLED=true
```

---

## 四、插件配置最佳实践

### 4.1 推荐配置 (`~/.opencode/memory/memory-config.json`)

```json
{
  "apiKey": "your-api-key",
  "apiPort": 18008,
  "search": {
    "mode": "hybrid"
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B"
  },
  "backend": {
    "tenant_id": "default"
  },
  "websocket": {
    "enabled": true,
    "heartbeatInterval": 30000,
    "reconnectMaxAttempts": 10
  },
  "code_analysis": {
    "auto_trigger": true,
    "use_atom_entity_api": true, // ✅ 启用新架构
    "languages": ["javascript", "typescript", "python", "go", "rust", "java"]
  }
}
```

### 4.2 搜索模式选择策略

| 模式          | 何时用                         | 质量   | 速度 | 后端 |
| ------------- | ------------------------------ | ------ | ---- | ---- |
| **hybrid** ⭐ | 日常默认                       | ⭐⭐⭐ | 中   | ✅   |
| vector        | 概念查找（"怎么处理异步错误"） | ⭐⭐   | 中   | ✅   |
| keyword       | 精确匹配（变量名、错误码）     | ⭐⭐   | 快   | ❌   |
| hash          | ID 精确查找                    | ⭐     | 极快 | ❌   |

**策略**：后端可用时用 hybrid，后端不可用时自动降级到 BM25 keyword。

### 4.3 渐进加载（节省上下文窗口）

| Level | 内容                            | 大小 | 用途       |
| ----- | ------------------------------- | ---- | ---------- |
| 0     | Abstract（≤100字符）            | 极小 | 浏览列表   |
| 1     | Abstract + Overview（≤500字符） | 小   | 了解大意   |
| 2     | 完整内容（无限制）              | 大   | 需要详情时 |

**最佳实践**：先用 `level=0` 或 `level=1` 扫描，确认相关后再 `memory_read(level=2)` 加载详情。

---

## 五、Backlog 支持 ✅ 新增

### 5.1 Backlog 作为 Entity 类型

从 v3.2+ 开始，Backlog 作为 **Entity 类型** 原生支持：

```javascript
// 创建 Backlog Entity
await wrapperClient.createEntity({
  type: "backlog",
  abstract: "实现用户认证系统",
  overview: "需要实现登录、注册、密码重置功能",
  status: "backlog", // backlog | in_progress | review | done
  priority: "P0",
  estimated_hours: 8,
  tags: ["feature", "auth", "backend"],
});
```

### 5.2 Backlog 状态机

```
backlog → in_progress → review → done
   ↑           ↓
   └─────── cancelled
```

| 状态        | 说明         |
| ----------- | ------------ |
| backlog     | 待办，未开始 |
| in_progress | 进行中       |
| review      | 待审核       |
| done        | 已完成       |
| cancelled   | 已取消       |

### 5.3 Backlog 查询

```javascript
// 列出所有 backlog
const backlogs = await wrapperClient.listEntities({
  type: "backlog",
  status: "backlog",
  limit: 50,
});

// 列出进行中的任务
const inProgress = await wrapperClient.listEntities({
  type: "backlog",
  status: "in_progress",
});

// 获取 backlog 详情
const backlog = await wrapperClient.getEntity("entity:xxx", 2);
```

### 5.4 Backlog 与代码关联

```javascript
// 创建 Backlog
const backlog = await wrapperClient.createEntity({
  type: "backlog",
  abstract: "重构代码分析服务",
  status: "in_progress",
});

// 创建代码 Entity
const codeEntity = await wrapperClient.createEntity({
  type: "code",
  abstract: "code-analysis-service.js",
  atoms: [atom1, atom2, atom3],
});

// 建立关联
await wrapperClient.createReference({
  from_id: codeEntity.id,
  to_id: backlog.id,
  type: "implements",
  weight: 1.0,
});
```

---

## 六、Atom/Entity/Reference API 使用指南

### 6.1 WrapperClient 新方法

```javascript
import { WrapperClient } from "./wrapper-client.js";

const client = new WrapperClient();

// ===== Atom API =====

// 创建函数 Atom
const atom = await client.createAtom({
  type: "function",
  name: "calculateTotal",
  content: "function calculateTotal(items) { ... }",
  signature: "calculateTotal(items: Item[]): number",
  params: ["items"],
  return_type: "number",
  is_exported: true,
  is_async: false,
  start_line: 42,
  end_line: 56,
});

// 获取 Atom
const atom = await client.getAtom("atom:xxx");

// 列出 Atoms
const atoms = await client.listAtoms({
  type: "function",
  project: "my-project",
  limit: 50,
});

// 更新 Atom
await client.updateAtom("atom:xxx", {
  name: "newName",
  content: "updated content",
});

// 删除 Atom
await client.deleteAtom("atom:xxx");

// ===== Entity API =====

// 创建代码 Entity
const entity = await client.createEntity({
  type: "code",
  abstract: "JavaScript file: src/utils.js (5 functions)",
  overview: "Utility functions for data processing",
  atoms: ["atom:1", "atom:2", "atom:3"],
  tags: ["javascript", "utils"],
  project: "my-project",
  file_path: "src/utils.js",
});

// 获取 Entity
const entity = await client.getEntity("entity:xxx", 2); // level=2

// 列出 Entities
const entities = await client.listEntities({
  type: "code",
  project: "my-project",
  limit: 50,
});

// ===== Reference API =====

// 创建调用关系
const ref = await client.createReference({
  from_id: "entity:caller",
  to_id: "atom:callee",
  type: "calls",
  weight: 0.8,
  metadata: {
    line: 42,
    column: 10,
  },
});

// 查询 References
const refs = await client.queryReferences({
  from_id: "entity:xxx",
  type: "calls",
  limit: 50,
});

// 删除 Reference
await client.deleteReference("ref:xxx");
```

### 6.2 代码分析服务新架构

```javascript
import { AnalysisQueue } from './code-analysis-service.js';

const queue = new AnalysisQueue();

// 使用新架构分析文件
const result = await queue.analyzeWithAtomEntity(
  '/path/to/file.js',
  fileContent,
  '/project/root'
);

// 返回结果
{
  atoms: [
    { id: 'atom:1', name: 'func1', type: 'function' },
    { id: 'atom:2', name: 'MyClass', type: 'class' },
  ],
  entity: {
    id: 'entity:xxx',
    type: 'code',
    atoms: ['atom:1', 'atom:2'],
  },
  references: [
    { id: 'ref:1', from_id: 'entity:xxx', to_id: 'atom:1', type: 'calls' },
  ],
  duration: 150.5, // ms
}
```

---

## 七、9 大核心记忆文件 × oh-my-opencode

| 文件             | 作用                 | oh-my-opencode 智能体如何利用     |
| ---------------- | -------------------- | --------------------------------- |
| **SOUL.md**      | AI 个性、语调、边界  | Sisyphus 读取以保持一致的沟通风格 |
| **AGENTS.md**    | 操作指令、代码规范   | Prometheus 读取以遵循项目约定     |
| **USER.md**      | 用户偏好、雷区       | 所有代理读取以避免踩坑            |
| **IDENTITY.md**  | 助手身份             | 定义 "我是谁"，影响所有交互       |
| **TOOLS.md**     | 工具使用约定         | 指导代理正确使用 15 个记忆工具    |
| **MEMORY.md**    | 记忆索引（自动更新） | 快速了解已存储的知识总量          |
| **HEARTBEAT.md** | 健康检查清单         | 系统自检                          |
| **BOOT.md**      | 启动清单             | 每次会话启动时的检查项            |
| **BOOTSTRAP.md** | 初始化仪式           | 首次安装时的一次性设置            |

---

## 八、四大工作流

### 8.1 日常工作流：编码 + 记忆

```
启动 OpenCode
    ↓
oh-my-opencode 自动加载 → Sisyphus 就绪
    ↓
memory-plugin 初始化 → WebSocket 连接后端
    ↓
[编码过程中]
    ├── 保存文件 → 自动代码分析 (Atom/Entity/Reference) → 后端上传
    ├── 遇到问题 → memory_search 搜索历史方案
    ├── 做出决策 → memory_write 保存（含 abstract/overview/content）
    └── AI 主动 → 搜索相关记忆提供上下文建议
    ↓
[会话结束前]
    Tab → The Observer → 审阅候选 → 确认保存
    ↓
下次启动 → 上下文自动恢复
```

### 8.2 知识整合流：The Librarian

```
每周或积累 20+ 碎片记忆后
    ↓
@memory-consolidate
    ↓
The Librarian 执行 S.O.P.：
    1. memory_timeline(days=7) + memory_topics → 发现碎片
    2. memory_write → 聚合提炼为单条高价值节点
    3. memory_relate(relation_type="summarizes") → 织网
    4. memory_pin → 置顶关键约定
    5. incremental_sync → 静默同步
```

### 8.3 跨会话/跨项目流：WebSocket + Graph

```
终端 A：在项目 X 工作 → memory_write 保存架构决策
    ↓ WebSocket change event
终端 B：在项目 Y 工作 → 收到实时通知
    ↓
memory_graph(memory_id, depth=2) → 发现关联知识
    ↓
跨项目知识复用
```

### 8.4 Backlog 管理工作流 ✅ 新增

```
创建 Backlog
    ↓
@memory-write (type: backlog)
    ↓
编码实现
    ↓
保存文件 → 自动关联代码 Entity 到 Backlog
    ↓
完成 → 更新 Backlog 状态为 done
    ↓
知识沉淀 → The Librarian 整合到长期记忆
```

---

## 九、oh-my-opencode 智能体 × 记忆工具映射

| 智能体                         | 最佳记忆工具                       | 场景                                   |
| ------------------------------ | ---------------------------------- | -------------------------------------- |
| **Sisyphus** (主编排)          | `memory_search`, `memory_write`    | 任务执行前搜索历史方案，执行后保存决策 |
| **Prometheus** (规划)          | `memory_timeline`, `memory_topics` | 了解项目历史和当前状态再制定计划       |
| **Oracle** (架构)              | `memory_graph`, `memory_search`    | 追溯关联决策，理解架构演进脉络         |
| **Explore** (探索)             | `memory_search` (level=0)          | 快速扫描已有知识，避免重复探索         |
| **The Observer** (观察者)      | `memory_search`, `memory_write`    | 人工确认后保存重要信息                 |
| **The Librarian** (图书管理员) | 全部工具                           | 定期整合碎片，建立图谱                 |

---

## 十、最高 ROI 的 6 个习惯

### 🥇 1. 先查后做（Search Before Act）

每次做决策前，先搜索记忆：

```javascript
memory_search((query = "类似的架构决策"), (mode = "hybrid"), (level = 1));
```

### 🥈 2. 用完即存（Write After Learn）

发现偏好、做出决策、找到方案后立即保存：

```javascript
memory_write(
  (content = "完整内容..."),
  (abstract = "≤100字摘要"), // ← 渐进加载依赖这个
  (overview = "≤500字概述"), // ← 快速浏览依赖这个
  (type = "long-term"),
  (tags = ["架构", "决策"]),
);
```

### 🥉 3. 定期整合（Weekly Consolidation）

每周五 → `@memory-consolidate` → The Librarian 自动整合

### 4️⃣ 4. 图谱织网（Connect Knowledge）

```javascript
// 传统 Memory 关系
memory_relate(
  (action = "create"),
  (from_id = "A"),
  (to_id = "B"),
  (relation_type = "informs"),
);

// 新架构：Atom/Entity/Reference
wrapperClient.createReference({
  from_id: "entity:code",
  to_id: "entity:backlog",
  type: "implements",
  weight: 1.0,
});

memory_graph((memory_id = "xxx"), (depth = 2));
```

### 5️⃣ 5. 渐进加载（Level-Aware Access）

```javascript
// ✅ 高效方式
memory_search((query = "xxx"), (level = 0)); // 先看摘要
memory_read((entry_id = "xxx"), (level = 1)); // 确认相关再看概述
memory_read((entry_id = "xxx"), (level = 2)); // 只加载真正需要的详情

// ✅ Entity 渐进加载
wrapperClient.getEntity("entity:xxx", 0); // 只看 abstract
wrapperClient.getEntity("entity:xxx", 1); // abstract + overview
wrapperClient.getEntity("entity:xxx", 2); // 完整内容
```

### 6️⃣ 6. 使用新架构（Atom/Entity/Reference）✅ 新增

```javascript
// ❌ 旧方式：扁平 Memory
memory_write({
  type: "code",
  content: "整个文件内容...",
});

// ✅ 新方式：原子记忆
const atoms = await Promise.all([
  wrapperClient.createAtom({ type: "function", name: "func1" }),
  wrapperClient.createAtom({ type: "class", name: "Class1" }),
]);

await wrapperClient.createEntity({
  type: "code",
  atoms: atoms.map((a) => a.id),
});
```

---

## 十一、常见反模式

| 反模式                              | 后果         | 正确做法                |
| ----------------------------------- | ------------ | ----------------------- |
| memory_write 省略 abstract/overview | 渐进加载失效 | 始终填写三层内容        |
| 只搜索不保存                        | 知识不复利   | 发现价值信息立即 write  |
| 从不用 The Librarian                | 记忆碎片化   | 每周 consolidate        |
| 全量同步代替增量                    | 浪费资源     | 日常用 incremental_sync |
| 忽略 WebSocket                      | 多终端无感知 | 保持开启                |
| 不加 tags                           | 搜索精度低   | 使用一致标签体系        |
| level=2 到处用                      | 上下文浪费   | 先 0 再 1 最后 2        |
| 不使用新架构                        | 代码分析粗糙 | 启用 Atom/Entity API    |

---

## 十二、推荐每日操作清单

- [ ] 启动 OpenCode → 确认后端连接正常（`index_status`）
- [ ] 编码中遇到问题 → `memory_search` 搜索历史
- [ ] 做出重要决策 → `memory_write` 保存（含 abstract/overview）
- [ ] 保存文件 → 确认代码分析自动触发（Atom/Entity/Reference）
- [ ] 创建 Backlog → 使用 `createEntity({ type: 'backlog' })`
- [ ] 会话结束 → Tab 切到 The Observer 审阅候选
- [ ] 每周五 → `@memory-consolidate` 整合知识

---

## 十三、版本历史

| 版本 | 日期       | 变更                            |
| ---- | ---------- | ------------------------------- |
| v2.0 | 2026-04-21 | 新增 Atom/Entity/Reference 架构 |
|      |            | 新增 Backlog 支持               |
|      |            | 新增 Tree-sitter Query API      |
| v1.0 | 2026-04-19 | 初始版本                        |

---

## 相关文档

- [v3.2 架构设计](./v3.2/UNIFIED-ARCHITECTURE-v3.2.md)
- [插件端实施指南](./v3.2/PLUGIN-v3.2-IMPLEMENTATION.md)
- [后端 API 规范](./v3.2/BACKEND-v3.2-IMPLEMENTATION.md)
- [Backlog 任务列表](../BACKLOG.md)
