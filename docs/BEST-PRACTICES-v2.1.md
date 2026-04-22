# 🧠 最佳实践：opencode-memory-plugin × 后端 × OpenCode × oh-my-opencode 协同指南

**版本**: v2.1.2  
**更新时间**: 2026-04-23  
**适用**: opencode-memory-plugin v3.2.2+ (Atom/Entity/Reference 架构)

---

## 版本变更摘要

### v2.1.1 (2026-04-23)

- **修复**: Reference 类型列表（8 种完整类型）
- **修复**: Entity 类型枚举顺序（与 Schema 保持一致）
- **新增**: 端口迁移说明（17999 → 18008）
- **新增**: Wiki/Obsidian 集成状态说明
- **新增**: Layer 测试最佳实践（Layer 1-5 测试策略）
- **新增**: 测试数据清理规范
- **优化**: API 端点列表（补充 Projects/Calls 子端点）

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
│  • class     - 类定义                                     │
│  • import    - 导入语句                                   │
│  • type      - 类型定义                                   │
│  • variable  - 变量定义                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Entity (实体) - 语义聚合单元                          │
├─────────────────────────────────────────────────────────┤
│  • memory    - 记忆条目                                   │
│  • backlog   - 待办事项 ✅ 新增                          │
│  • wiki      - 文档条目 ⚠️ 预留类型（暂无实现）          │
│  • code      - 代码文件 (关联多个 Atom)                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Reference (关系) - 语义连接                            │
├─────────────────────────────────────────────────────────┤
│  • calls         - 函数调用                                │
│  • imports       - 导入关系                                │
│  • extends       - 继承关系                                │
│  • implements    - 实现关系                                │
│  • depends_on    - 依赖关系                                │
│  • related       - 一般关联                                │
│  • follow_up     - 后续关联                                │
│  • elaboration   - 详细阐述                                │
│  • contradiction - 矛盾关系                                │
│  • reference     - 引用关系                                │
│  • derived_from  - 派生关系                                │
│  • similar_to    - 相似关系                                │
│  • wiki_link     - Wiki 链接 ⚠️ 预留类型                  │
│  • part_of       - 组成部分                                │
└─────────────────────────────────────────────────────────┘
```

**Entity 类型说明**：

- `memory`: 通用记忆条目
- `backlog`: 待办事项，支持状态机（backlog → in_progress → review → done）
- `wiki`: ⚠️ **预留类型**，暂无专门 API，未来用于 Wiki 文档
- `code`: 代码文件，关联多个 Atom

**Reference 类型说明**：

- **14 种完整类型**，覆盖代码调用、依赖、继承、关联等关系
- 核心类型：`calls`, `imports`, `extends`, `implements`（代码分析）
- 关联类型：`depends_on`, `related`, `follow_up`, `elaboration`（语义关联）
- 逻辑类型：`contradiction`, `reference`, `derived_from`, `similar_to`（逻辑关系）
- 结构类型：`wiki_link`, `part_of`（结构关系）
- `wiki_link`: ⚠️ **预留类型**，暂无实现

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
│   ├── POST   /entities       - 创建 Entity
│   ├── GET    /entities/{id} - 获取 Entity
│   ├── GET    /entities       - 列出 Entities
│   └── DELETE /entities/{id} - 删除 Entity
│
├── /api/v1/references/*     ← Reference CRUD (新增)
│   ├── POST   /references     - 创建 Reference
│   ├── GET    /references     - 查询 References
│   └── DELETE /references/{id} - 删除 Reference
│
├── /api/v1/memories/*       ← 传统 Memory API (兼容)
│   ├── POST   /memories       - 上传记忆
│   ├── GET    /memories       - 搜索记忆
│   └── DELETE /memories/{id}  - 删除记忆
│
├── /api/v1/sync/*           ← 同步 API
│   ├── POST   /sync/preview   - 增量同步预览
│   └── POST   /sync/full      - 全量同步
│
├── /api/v1/calls/*          ← 代码调用关系
│   ├── POST   /calls          - 创建调用关系
│   ├── GET    /calls/references - 查询引用
│   └── GET    /calls/dependencies - 查询依赖
│
├── /api/v1/projects/*       ← 项目地图/统计
│   ├── GET    /projects/{id}/stats - 项目统计
│   └── GET    /projects/{id}/map   - 项目地图
│
├── /ws/memories/live        ← WebSocket 实时推送
└── /health                  ← 健康检查
```

**端口变更说明** (v3.2+): 默认端口从 **17999** 迁移到 **18008**，请更新配置。

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

**⚠️ 端口迁移** (v3.2+): 如果之前使用 17999，请更新为 18008。

---

## 四、插件配置最佳实践

### 4.1 推荐配置 (`~/.opencode/memory/memory-config.json`)

```json
{
  "version": "3.0",
  "apiKey": "your-api-key",
  "apiPort": 18008, // ⚠️ v3.2+ 新端口（原 17999）
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
    "enabled": true,
    "url": "http://localhost:18008", // ⚠️ v3.2+ 新端口
    "tenant_id": "default"
  },
  "websocket": {
    "enabled": true,
    "heartbeatInterval": 30000,
    "reconnectMaxAttempts": 10
  },
  "code_analysis": {
    "auto_trigger": true,
    "use_atom_entity_api": true,
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

### 4.4 性能优化建议

| 场景           | 建议                                | 原因                             |
| -------------- | ----------------------------------- | -------------------------------- |
| 批量创建 Atoms | 使用 sequential 而非 Promise.all()  | 避免后端限流，单个失败不影响其他 |
| 大文件分析     | 设置 `batchSize: 50`                | 防止内存溢出，控制并发           |
| WebSocket 重连 | 保持默认 `reconnectMaxAttempts: 10` | 平衡可靠性与资源消耗             |
| 指纹缓存       | 启用 `fingerprintCache`             | 避免重复分析未变更文件           |
| 代码分析语言   | 只启用需要的语言                    | 减少 Tree-sitter WASM 加载       |

**配置示例**（高性能）：

```json
{
  "code_analysis": {
    "auto_trigger": true,
    "use_atom_entity_api": true,
    "batch_size": 50,
    "languages": ["javascript", "typescript"],
    "fingerprint_cache": true
  }
}
```

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

## 十二、Layer 测试最佳实践 ✅ 新增

### 12.1 五层测试策略

| Layer       | 测试文件                        | 测试类型      | 关键验证点                        |
| ----------- | ------------------------------- | ------------- | --------------------------------- |
| **Layer 1** | `layer1-integration-test.mjs`   | 数据层        | Timeline 存储、文件格式、索引管理 |
| **Layer 2** | `layer2-integration-test.mjs`   | 后端服务层    | Health、Search、Sync、WebSocket   |
| **Layer 3** | `layer3-integration-test.mjs`   | 工具层        | 15 个工具函数、渐进加载、错误处理 |
| **Layer 4** | `layer4-integration-test.mjs`   | OpenCode 集成 | 工具链、错误恢复、边界条件        |
| **Layer 5** | `layer5-orchestration-test.mjs` | 编排层        | Sisyphus 工作流、多智能体协作     |

### 12.2 测试数据清理规范

**必须实现 Cleanup**：

```javascript
// ===== Cleanup Helper =====
async function cleanupTestMemories(ids) {
  const { getEntryById } =
    await import("../opencode-memory-plugin/lib/storage.js");
  const { removeFromLinkMap } =
    await import("../opencode-memory-plugin/lib/indexer.js");

  let deletedCount = 0;
  for (const id of ids) {
    try {
      const entry = getEntryById(id);
      if (entry?.path && fs.existsSync(entry.path)) {
        fs.unlinkSync(entry.path);
        await removeFromLinkMap(id);
        deletedCount++;
      }
    } catch (err) {
      console.warn(`Failed to delete ${id}: ${err.message}`);
    }
  }
  return deletedCount;
}

// 在测试结束时调用
await cleanupTestMemories(testMemories);
```

**清理原则**：

- 每个测试创建的记忆必须在测试结束时删除
- 同时删除文件和 link-map 条目
- 记录清理结果（成功/失败数量）

### 12.3 ID 提取健壮性

**使用 ULID 格式验证**：

```javascript
/**
 * Validate ULID format (26 characters, Crockford's base32)
 */
function isValidUlid(id) {
  return id && /^[0-9A-Z]{26}$/.test(id);
}

/**
 * Extract local ID from memory_write result
 * Format: "ID: 01Kxxx..." (26 characters)
 */
function extractLocalId(result) {
  const match = result.match(/ID:\s*([A-Z0-9]{26})/);
  const id = match ? match[1] : null;
  if (id && !isValidUlid(id)) {
    console.warn(`Warning: ID ${id} doesn't match ULID format`);
  }
  return id;
}
```

### 12.4 测试常量提取

**避免魔法字符串**：

```javascript
// ===== Constants =====
const TEST_CONVERSATION_ID = "conversation:layer4-test";
const TEST_DATA = {
  chain001: {
    content: "...",
    abstract: "Async error handling pattern",
    type: "code",
    tags: ["error-handling", "async", "javascript"],
  },
};
```

---

## 十三、常见问题排查

### 13.1 Atom/Entity API 错误

| 错误                 | 可能原因                          | 解决方案                               |
| -------------------- | --------------------------------- | -------------------------------------- |
| `409 Conflict`       | 同一项目中存在重复的 atom 名称    | 使用唯一命名或先检查是否存在           |
| `404 Not Found`      | Entity 引用了不存在的 Atom ID     | 确保所有 atoms 创建成功后再创建 entity |
| `400 Bad Request`    | 缺少必需字段（如 `type`, `name`） | 检查请求体是否包含所有必填字段         |
| `500 Internal Error` | 后端数据库连接问题                | 检查 SurrealDB 状态，重试或联系管理员  |

**调试命令**：

```bash
# 检查后端健康状态
curl http://localhost:18008/health

# 测试 Atom API
curl http://localhost:18008/api/v1/atoms

# 查看后端日志
docker logs opencode-memory-backend
```

### 13.2 WebSocket 连接问题

| 症状         | 可能原因                 | 解决方案                              |
| ------------ | ------------------------ | ------------------------------------- |
| 连接反复断开 | 心跳间隔过短或网络不稳定 | 增加 `heartbeatInterval` 到 60000ms   |
| 无法连接     | 后端未启动或端口冲突     | 检查 `API_PORT` 是否被占用            |
| 消息丢失     | 未收到 ACK 确认          | 检查后端日志，确认 WebSocket 服务正常 |

**验证步骤**：

```javascript
// 在 OpenCode 中检查连接状态
index_status detailed=true
```

### 13.3 代码分析失败

| 症状                        | 可能原因                | 解决方案                     |
| --------------------------- | ----------------------- | ---------------------------- |
| Tree-sitter 解析失败        | WASM 未加载或语言不支持 | 检查文件扩展名是否在支持列表 |
| Oxc 分析超时                | 文件过大或复杂度太高    | 增加超时时间或分批处理       |
| Atom 创建成功但 Entity 失败 | 部分 Atom 创建失败      | 检查日志，确认 rollback 执行 |

**日志查看**：

```bash
# 查看代码分析日志
grep "\[CodeAnalysis\]" ~/.opencode/logs/opencode.log
```

### 13.4 搜索无结果

| 症状                 | 可能原因             | 解决方案                              |
| -------------------- | -------------------- | ------------------------------------- |
| 新写入的记忆搜索不到 | 索引尚未同步         | 等待几秒或手动运行 `incremental_sync` |
| 语义搜索结果不准确   | Embedding 服务不可用 | 检查 `MODELSCOPE_API_KEY` 是否设置    |
| 关键词搜索无结果     | BM25 索引未构建      | 运行 `rebuild_index` 重建索引         |

**诊断命令**：

```javascript
// 检查后端搜索服务
memory_search query="test" mode="keyword"
memory_search query="test" mode="vector"
```

### 13.5 同步问题

| 症状           | 可能原因             | 解决方案                                    |
| -------------- | -------------------- | ------------------------------------------- |
| 同步卡住       | 网络中断或后端不可用 | 检查网络，使用 `sync_checkpoint` 查看进度   |
| 冲突无法解决   | 本地和远程同时修改   | 使用 `conflict_list` 查看，手动选择保留版本 |
| 同步后数据丢失 | 冲突自动解决策略不当 | 修改 `auto_resolve` 为 `manual`             |

**恢复步骤**：

```javascript
// 查看同步状态
sync_checkpoint

// 列出冲突
conflict_list

// 手动解决冲突
conflict_resolve conflict_id="xxx" resolution="USE_LOCAL"
```

### 13.6 端口迁移问题 (v3.2+) ⚠️ 新增

| 症状         | 可能原因         | 解决方案                                |
| ------------ | ---------------- | --------------------------------------- |
| 后端连接失败 | 使用旧端口 17999 | 更新配置为 18008                        |
| 配置不生效   | 环境变量覆盖     | 检查 `API_PORT` 和 `MEMORY_BACKEND_URL` |

**迁移步骤**：

```json
// 更新 ~/.opencode/memory/memory-config.json
{
  "backend": {
    "url": "http://localhost:18008" // 从 17999 改为 18008
  }
}
```

---

## 十四、推荐每日操作清单

- [ ] 启动 OpenCode → 确认后端连接正常（`index_status`）
- [ ] 编码中遇到问题 → `memory_search` 搜索历史
- [ ] 做出重要决策 → `memory_write` 保存（含 abstract/overview）
- [ ] 保存文件 → 确认代码分析自动触发（Atom/Entity/Reference）
- [ ] 创建 Backlog → 使用 `createEntity({ type: 'backlog' })`
- [ ] 会话结束 → Tab 切到 The Observer 审阅候选
- [ ] 每周五 → `@memory-consolidate` 整合知识

---

## 十五、Wiki/Obsidian 集成状态 ⚠️ 新增

### 15.1 当前状态

| 功能                       | 状态          | 说明                         |
| -------------------------- | ------------- | ---------------------------- |
| `wiki` Entity 类型         | ⚠️ **预留**   | Schema 已定义，暂无专门 API  |
| `wiki_link` Reference 类型 | ⚠️ **预留**   | Schema 已定义，暂无实现      |
| Obsidian 导入              | ❌ **未实现** | 仅在 v2.0 架构中规划，已移除 |
| Obsidian 导出              | ❌ **未实现** | 同上                         |
| Wiki 导入/导出             | ❌ **未实现** | 同上                         |

### 15.2 历史演变

```
v2.0 架构 (远期规划)
  └── Phase 4: Wiki 层
      ├── wiki_import_obsidian({ vault_path, ... })
      ├── wiki_export_obsidian({ entity_ids, output_path, ... })
      └── wiki_create({ title, content, ... })

v3.0+ 架构 (实际实施)
  └── ❌ 所有 Wiki 特有 API 被移除
  └── ⚠️ 仅保留 wiki 作为 Entity 类型枚举
```

### 15.3 未来规划

根据路线图，以下功能在规划中：

| 功能                              | 优先级 | 时间线        | 状态      |
| --------------------------------- | ------ | ------------- | --------- |
| Graph Visualization（图谱可视化） | P0     | 短期（3个月） | 📋 计划中 |
| Bidirectional Links（双向链接）   | P0     | 短期（3个月） | 📋 计划中 |
| Obsidian-style Graph              | P0     | 短期（3个月） | 📋 计划中 |
| Block-level References            | P0     | 短期（3个月） | 📋 计划中 |

**注意**：这些是竞争分析建议，不是已确认的 backlog 任务。

---

## 十六、版本历史

| 版本   | 日期       | 变更                                            |
| ------ | ---------- | ----------------------------------------------- |
| v2.1.2 | 2026-04-23 | 修复 Reference 类型列表（14种，与后端代码一致） |
| v2.1.1 | 2026-04-23 | 修复 Reference 类型列表（8种完整类型）          |
|        |            | 修复 Entity 类型枚举顺序                        |
|        |            | 新增端口迁移说明（17999→18008）                 |
|        |            | 新增 Wiki/Obsidian 集成状态说明                 |
|        |            | 新增 Layer 测试最佳实践（第 12 节）             |
|        |            | 新增测试数据清理规范                            |
| v2.1   | 2026-04-21 | 新增性能优化建议（第 4.4 节）                   |
|        |            | 新增常见问题排查（第 12 节）                    |
| v2.0   | 2026-04-21 | 新增 Atom/Entity/Reference 架构                 |
|        |            | 新增 Backlog 支持                               |
|        |            | 新增 Tree-sitter Query API                      |
| v1.0   | 2026-04-19 | 初始版本                                        |

---

## 相关文档

- [v3.2 架构设计](./v3.2/UNIFIED-ARCHITECTURE-v3.2.md)
- [插件端实施指南](./v3.2/PLUGIN-v3.2-IMPLEMENTATION.md)
- [后端 API 规范](./v3.2/BACKEND-v3.2-IMPLEMENTATION.md)
- [Backlog 任务列表](../BACKLOG.md)
- [Layer 测试场景](./v3.2/TEST-SCENARIOS-v3.2.md)
