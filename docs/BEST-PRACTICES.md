# 🧠 最佳实践：opencode-memory-plugin × 后端 × OpenCode × oh-my-opencode 协同指南

**版本**: v1.0  
**更新时间**: 2026-04-19  
**适用**: opencode-memory-plugin v3.2.2+

---

## 一、四层架构全景

```
┌─────────────────────────────────────────────────┐
│  Layer 4: oh-my-opencode (编排层)                │
│  Sisyphus / Prometheus / Oracle / Explore...     │
│  多智能体调度 + Hooks + LSP + AST + MCP          │
├─────────────────────────────────────────────────┤
│  Layer 3: OpenCode (基础 AI 平台)                │
│  编码助手 + 工具调用 + 上下文管理                 │
├─────────────────────────────────────────────────┤
│  Layer 2: opencode-memory-plugin (记忆智能层)     │
│  15 工具 + 2 代理 + 代码分析 + WebSocket          │
├─────────────────────────────────────────────────┤
│  Layer 1: 后端服务 (基础设施层)                    │
│  SurrealDB + Meilisearch + Embedding + WS         │
└─────────────────────────────────────────────────┘
```

**核心原则**：每层只做自己的事，通过标准接口协同。插件不知道 oh-my-opencode 的存在，oh-my-opencode 只调用插件的工具。

---

## 二、后端部署最佳实践

### 2.1 推荐部署方式

| 场景         | 部署方式          | 说明                         |
| ------------ | ----------------- | ---------------------------- |
| **个人开发** | Docker localhost  | 最简单，开箱即用             |
| **团队协作** | Docker 远程服务器 | 共享 SurrealDB + Meilisearch |
| **离线环境** | 本地全栈          | Embedding 用本地模型         |

### 2.2 后端必须就绪的服务

```
localhost:18008
├── /health                     ← 健康检查
├── /api/v1/memories/*          ← 记忆 CRUD + 搜索
├── /api/v1/sync/*              ← 同步（指纹/全量/冲突）
├── /api/v1/calls/*             ← 代码调用关系
├── /api/v1/projects/*          ← 项目地图/统计
├── /ws/memories/live           ← WebSocket 实时推送
└── Embedding Service (18000)   ← 向量嵌入
```

### 2.3 环境变量配置

```bash
# 必须设置
export WRAPPER_MEILI_API_KEY="your-api-key"

# 可选覆盖
export API_PORT=18008
export API_HOST=localhost
export WS_ENABLED=true
```

---

## 三、插件配置最佳实践

### 3.1 推荐配置 (`~/.opencode/memory/memory-config.json`)

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
    "languages": ["javascript", "typescript", "python"]
  }
}
```

### 3.2 搜索模式选择策略

| 模式          | 何时用                         | 质量   | 速度 | 后端 |
| ------------- | ------------------------------ | ------ | ---- | ---- |
| **hybrid** ⭐ | 日常默认                       | ⭐⭐⭐ | 中   | ✅   |
| vector        | 概念查找（"怎么处理异步错误"） | ⭐⭐   | 中   | ✅   |
| keyword       | 精确匹配（变量名、错误码）     | ⭐⭐   | 快   | ❌   |
| hash          | ID 精确查找                    | ⭐     | 极快 | ❌   |

**策略**：后端可用时用 hybrid，后端不可用时自动降级到 BM25 keyword。

### 3.3 渐进加载（节省上下文窗口）

| Level | 内容                            | 大小 | 用途       |
| ----- | ------------------------------- | ---- | ---------- |
| 0     | Abstract（≤100字符）            | 极小 | 浏览列表   |
| 1     | Abstract + Overview（≤500字符） | 小   | 了解大意   |
| 2     | 完整内容（无限制）              | 大   | 需要详情时 |

**最佳实践**：先用 `level=0` 或 `level=1` 扫描，确认相关后再 `memory_read(level=2)` 加载详情。

---

## 四、9 大核心记忆文件 × oh-my-opencode

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

## 五、三大工作流

### 5.1 日常工作流：编码 + 记忆

```
启动 OpenCode
    ↓
oh-my-opencode 自动加载 → Sisyphus 就绪
    ↓
memory-plugin 初始化 → WebSocket 连接后端
    ↓
[编码过程中]
    ├── 保存文件 → 自动代码分析 → 后端上传
    ├── 遇到问题 → memory_search 搜索历史方案
    ├── 做出决策 → memory_write 保存（含 abstract/overview/content）
    └── AI 主动 → 搜索相关记忆提供上下文建议
    ↓
[会话结束前]
    Tab → The Observer → 审阅候选 → 确认保存
    ↓
下次启动 → 上下文自动恢复
```

### 5.2 知识整合流：The Librarian

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

### 5.3 跨会话/跨项目流：WebSocket + Graph

```
终端 A：在项目 X 工作 → memory_write 保存架构决策
    ↓ WebSocket change event
终端 B：在项目 Y 工作 → 收到实时通知
    ↓
memory_graph(memory_id, depth=2) → 发现关联知识
    ↓
跨项目知识复用
```

---

## 六、oh-my-opencode 智能体 × 记忆工具映射

| 智能体                         | 最佳记忆工具                       | 场景                                   |
| ------------------------------ | ---------------------------------- | -------------------------------------- |
| **Sisyphus** (主编排)          | `memory_search`, `memory_write`    | 任务执行前搜索历史方案，执行后保存决策 |
| **Prometheus** (规划)          | `memory_timeline`, `memory_topics` | 了解项目历史和当前状态再制定计划       |
| **Oracle** (架构)              | `memory_graph`, `memory_search`    | 追溯关联决策，理解架构演进脉络         |
| **Explore** (探索)             | `memory_search` (level=0)          | 快速扫描已有知识，避免重复探索         |
| **The Observer** (观察者)      | `memory_search`, `memory_write`    | 人工确认后保存重要信息                 |
| **The Librarian** (图书管理员) | 全部工具                           | 定期整合碎片，建立图谱                 |

---

## 七、最高 ROI 的 5 个习惯

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
memory_relate(
  (action = "create"),
  (from_id = "A"),
  (to_id = "B"),
  (relation_type = "informs"),
);
memory_graph((memory_id = "xxx"), (depth = 2));
```

### 5️⃣ 5. 渐进加载（Level-Aware Access）

```javascript
// ✅ 高效方式
memory_search((query = "xxx"), (level = 0)); // 先看摘要
memory_read((entry_id = "xxx"), (level = 1)); // 确认相关再看概述
memory_read((entry_id = "xxx"), (level = 2)); // 只加载真正需要的详情
```

---

## 八、常见反模式

| 反模式                              | 后果         | 正确做法                |
| ----------------------------------- | ------------ | ----------------------- |
| memory_write 省略 abstract/overview | 渐进加载失效 | 始终填写三层内容        |
| 只搜索不保存                        | 知识不复利   | 发现价值信息立即 write  |
| 从不用 The Librarian                | 记忆碎片化   | 每周 consolidate        |
| 全量同步代替增量                    | 浪费资源     | 日常用 incremental_sync |
| 忽略 WebSocket                      | 多终端无感知 | 保持开启                |
| 不加 tags                           | 搜索精度低   | 使用一致标签体系        |
| level=2 到处用                      | 上下文浪费   | 先 0 再 1 最后 2        |

---

## 九、推荐每日操作清单

- [ ] 启动 OpenCode → 确认后端连接正常（`index_status`）
- [ ] 编码中遇到问题 → `memory_search` 搜索历史
- [ ] 做出重要决策 → `memory_write` 保存（含 abstract/overview）
- [ ] 保存文件 → 确认代码分析自动触发
- [ ] 会话结束 → Tab 切到 The Observer 审阅候选
- [ ] 每周五 → `@memory-consolidate` 整合知识
