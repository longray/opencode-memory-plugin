基于附件中的架构设计文档，我为您制定插件端1.1+1.2的完整优化方案。这个方案将解决当前MEMORY.md膨胀问题，实现真正的分层存储架构。

---

# OpenCode Memory 插件端存储架构优化方案

**目标**: 解决MEMORY.md膨胀，实现分层加载，提升启动性能

---

## 一、当前架构问题诊断

### 1.1 实际运行数据分析

来自附件中的实际观测：

- `MEMORY.md`: **82.98 KB, 3254行** — 严重超标（目标≤16KB/200行）
- `daily/`: 5个日志文件，但缺乏自动归档机制
- 所有长期记忆混存在单一文件，无主题隔离

### 1.2 核心问题

| 问题               | 影响                         | 优先级 |
| ------------------ | ---------------------------- | ------ |
| 单文件存储所有记忆 | 启动加载慢，Token消耗大      | P0     |
| 缺乏L0/L1/L2分层   | 无法按需加载，搜索效率低     | P0     |
| 元数据不完整       | 无法支持智能去重、优先级排序 | P1     |
| 主题隔离缺失       | 检索精准度下降               | P1     |

---

## 二、优化后存储架构（1.1 完整版）

### 2.1 目录结构

```
~/.opencode/memory/                    # 记忆根目录
│
├── 📁 core/                            # 【新增】核心配置（原根目录迁移）
│   ├── SOUL.md                        # AI人格（≤2KB，启动加载）
│   ├── IDENTITY.md                    # 身份定义（≤1KB）
│   ├── USER.md                        # 用户画像（≤4KB）
│   ├── AGENTS.md                      # Agent指令（≤4KB）
│   ├── TOOLS.md                       # 工具约定（≤4KB）
│   ├── BOOT.md                        # 启动清单（≤2KB）
│   └── HEARTBEAT.md                   # 健康检查（≤2KB）
│
├── 📁 active/                          # 【新增】活跃工作区（强制分层）
│   ├── 📁 decisions/                   # 决策记录
│   │   ├── .index                      # L0：一句话摘要（≤200字）
│   │   ├── .overview                   # L1：结构化概览
│   │   ├── 2025-postgresql.md         # L2：完整决策
│   │   └── 2025-frontend-framework.md
│   │
│   ├── 📁 preferences/                 # 用户偏好
│   │   ├── .index
│   │   ├── .overview
│   │   ├── code-style.md
│   │   ├── communication.md
│   │   └── tools.md
│   │
│   ├── 📁 patterns/                    # 成功模式
│   │   ├── .index
│   │   ├── .overview
│   │   ├── error-handling.md
│   │   └── refactoring.md
│   │
│   ├── 📁 lessons/                     # 经验教训
│   │   ├── .index
│   │   ├── .overview
│   │   ├── bugs.md
│   │   └── performance.md
│   │
│   └── 📁 projects/                    # 项目专属
│       └── 📁 {project-name}/
│           ├── .index
│           ├── .overview
│           ├── tech-stack.md
│           └── conventions.md
│
├── 📁 timeline/                        # 【优化】时间轴归档
│   └── 📁 2025/
│       └── 📁 03/
│           ├── 12.md                   # L2：原始日志
│           ├── 12.meta.json           # 【新增】元数据（L1）
│           └── 12.abstract            # 【新增】摘要（L0）
│
├── 📁 archive/                         # 【优化】压缩归档
│   └── 📁 2025/
│       └── 03.tar.zst
│
├── MEMORY.md                           # 【降级】全局索引（≤200行）
├── MEMORY.lock                         # 【新增】并发控制
├── sync-queue.json                     # 同步队列（已有）
├── local-only.json                     # 【新增】隐私标记
└── .version                            # 【新增】版本标记（v2.2.0）
```

### 2.2 核心设计决策

| 决策                  | 理由                                    | 约束             |
| --------------------- | --------------------------------------- | ---------------- |
| `core/` 独立目录      | 区分配置vs记忆，启动只加载core          | core/总大小≤20KB |
| 强制4个active主题     | 基于实际内容反推（决策/偏好/模式/教训） | 可扩展自定义主题 |
| 每个主题必须有.index  | 支持分层加载，快速定位                  | .index≤200字     |
| timeline/配.meta.json | 支持按日期快速过滤                      | 不读完整.md      |
| MEMORY.md纯索引       | 解决膨胀问题                            | 严格≤200行       |

---

## 三、核心文件规范（1.2 完整版）

### 3.1 core/ 目录规范

| 文件           | 用途             | 大小限制 | 更新频率 | 格式     |
| -------------- | ---------------- | -------- | -------- | -------- |
| `SOUL.md`      | 人格、边界、原则 | ≤2KB     | 极少     | Markdown |
| `IDENTITY.md`  | 名称、标语、能力 | ≤1KB     | 极少     | Markdown |
| `USER.md`      | 用户偏好、风格   | ≤4KB     | 低频     | Markdown |
| `AGENTS.md`    | 记忆读写规则     | ≤4KB     | 低频     | Markdown |
| `TOOLS.md`     | 工具使用约定     | ≤4KB     | 低频     | Markdown |
| `BOOT.md`      | 启动检查清单     | ≤2KB     | 静态     | Markdown |
| `HEARTBEAT.md` | 健康检查项       | ≤2KB     | 静态     | Markdown |

**约束**: core/总大小≤20KB，确保启动<100ms。

### 3.2 active/ 主题规范（统一格式）

#### .index（L0：一句话摘要）

```markdown
# 决策记录索引

一句话摘要：包含数据库选型、框架选择、架构决策等关键决策，共15条。

## 快速导航

- [PostgreSQL选型](2025-postgresql.md) - 2025-03-13 | #high
- [React框架选择](2025-frontend-framework.md) - 2025-03-10 | #medium
- [微服务拆分](2025-microservices.md) - 2025-02-28 | #high
```

#### .overview（L1：结构化概览）

```markdown
# 决策概览

## 按时间

| 日期       | 决策           | 状态     | 重要性 |
| ---------- | -------------- | -------- | ------ |
| 2025-03-13 | PostgreSQL选型 | active   | high   |
| 2025-03-10 | React框架      | active   | medium |
| 2025-02-28 | 微服务拆分     | archived | high   |

## 按项目

- web-dashboard: 3条决策
- embedding-service: 2条决策

## 按标签

- #database: 5条
- #frontend: 3条
- #architecture: 4条

## 统计

- 总计: 15条
- active: 12条
- archived: 3条
- 最后更新: 2025-03-13
```

#### 具体条目（L2：完整详情）

（在这里，我提一个建议：ULID 生成 所有条目使用 ULID 保证时序唯一性）

````markdown
---
id: mem_20250313_postgresql_001
type: decision
importance: high
confidence: 0.95
project: web-dashboard
tags: [database, postgresql, architecture]
created: 2025-03-13T09:15:00+08:00
updated: 2025-03-13T09:15:00+08:00
source: timeline/2025/03/13.md
synced: true
sync_id: backend_uuid_123
---

# PostgreSQL选型决策

## 决策概览

**选择**: PostgreSQL  
**放弃**: MongoDB, MySQL  
**状态**: active  
**决策人**: 老曹

## 决策理由

1. **ACID事务**: 业务需要强一致性
2. **团队熟悉**: 现有技能栈匹配
3. **生态成熟**: 工具链完善

## 技术细节

```python
DATABASE_URL = "postgresql://user:pass@localhost/db"
```
````

## 相关链接

- 相关决策: [缓存选型](2025-redis.md)
- 依赖项目: web-dashboard
- 后续影响: [性能优化](2025-db-optimization.md)

````

### 3.3 timeline/ 规范

#### 12.md（L2：原始日志）

```markdown
# 2025-03-12

## 09:15 [decision] [confidence:0.95]
**内容**: 用户决定使用PostgreSQL
**详细**: 讨论了15分钟，对比了MongoDB、MySQL...
**工具**: opencode
**标签**: #database #postgresql

## 09:45 [preference] [confidence:0.9]
**内容**: 用户要求2空格缩进
**详细**: 用户看到4空格代码后明确纠正...
**标签**: #coding-style
````

#### 12.meta.json（L1元数据）

```json
{
  "date": "2025-03-12",
  "entries_count": 5,
  "types": {
    "decision": 2,
    "preference": 2,
    "note": 1
  },
  "projects": ["web-dashboard"],
  "tags": ["database", "postgresql", "coding-style"],
  "abstract": "今日主要决策：PostgreSQL选型、代码风格确定为2空格缩进",
  "consolidated": false,
  "consolidated_to": null,
  "last_modified": "2025-03-12T18:30:00+08:00"
}
```

#### 12.abstract（L0摘要）

```
2025-03-12: PostgreSQL选型决策，代码风格统一为2空格缩进，共5条记录。
```

### 3.4 MEMORY.md 规范（严格≤200行）

```markdown
# Memory Index v2.2

> 本文档为索引，详细内容请查看 active/ 各主题目录

## Active Topics

| 主题                               | 数量  | 最后更新   | 描述               |
| ---------------------------------- | ----- | ---------- | ------------------ |
| [decisions](active/decisions/)     | 15    | 2025-03-13 | 技术选型与架构决策 |
| [preferences](active/preferences/) | 8     | 2025-03-12 | 用户偏好与习惯     |
| [patterns](active/patterns/)       | 12    | 2025-03-10 | 成功模式与最佳实践 |
| [lessons](active/lessons/)         | 6     | 2025-03-08 | 经验教训与避坑指南 |
| [projects](active/projects/)       | 3项目 | 2025-03-13 | 项目专属知识       |

## Recent Highlights

- [2025-03-13] **[HIGH]** PostgreSQL选型 | #database #architecture
- [2025-03-12] **[MED]** 代码风格统一为2空格 | #coding-style
- [2025-03-10] **[HIGH]** React框架选择 | #frontend

## Quick Stats

- 总记忆数: 41条
- 活跃项目: 3个
- 待同步: 2条
- 最后整理: 2025-03-12

## Maintenance

- 下次整理: 2025-03-19
- 归档大小: 1.2 MB
- 版本: v2.2.0
```

---

## 四、核心类设计

### 4.1 存储层架构

### 4.2 MemoryStore 核心类

### 4.3 ActiveStore 实现

### 4.4 IndexGenerator 索引生成器

---

## 五、工具改造

### 5.1 memory_read 改造

### 5.2 memory_search 改造

### 5.3 rebuild_index 改造

## 六、迁移

## 七、验证清单

## 八、交付物清单

另：需增加一个特性：去重预检 写入前本地 SimHash 快速去重/后端去重
