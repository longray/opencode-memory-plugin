# OpenCode Memory Plugin v2.4.0

# L0/L1/L2 分层存储 - 综合设计方案

**版本**: v2.4.0-L0L1L2  
**状态**: 待审核  
**更新日期**: 2026-03-24  
**预计实施时间**: 20-26 小时

---

## 一、设计目标

### 1.1 核心目标

1. **分层存储**: 实现 L0(摘要)/L1(概览)/L2(全文) 三层内容分离
2. **性能优化**: 启动只加载 L0，按需加载 L1/L2，节省 90% Token
3. **智能分层**: 基于重要性 + 访问频率 + 时间，而非纯时间降级
4. **全局唯一**: 文件名使用后端 memory_id，支持离线写入
5. **强制生成**: abstract 和 overview 由调用方（OpenCode）生成，必填

### 1.2 非目标

- ❌ 不实现 AI 自动生成（插件端不调用 LLM）
- ❌ 不上传到 S3（本地压缩归档）
- ❌ 不迁移旧数据（重建上传）
- ❌ 不保留向后兼容（abstract/overview 必填）

---

## 二、架构概览

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenCode Agent（调用方）                                        │
│  ├─ 生成 abstract（建议≤100字符，一句话摘要）                    │
│  ├─ 生成 overview（建议≤500字符，核心要点）                      │
│  └─ 调用 memory_write({abstract, overview, content})            │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP API / 本地文件
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  插件端（本地文件系统）                                          │
│  ├─ memory_write()          # 写入分层格式                       │
│  ├─ memory_read(level=0/1/2) # 分级读取                         │
│  ├─ memory_pin()            # 置顶重要条目                       │
│  └─ memory_archive()        # 手动归档（可选）                    │
│                                                                 │
│  文件结构：                                                      │
│  ~/.opencode/memory/                                            │
│  ├── MEMORY.md              # 全局索引（最近20条L0）              │
│  ├── link-map.json          # 路径映射 + 置顶标记                │
│  ├── SOUL.md, AGENTS.md...  # 静态配置（不变）                   │
│  └── timeline/                                                  │
│      └── 2026/03/23/                                            │
│          ├── memory_s9kzvcu9z3xflbr2al5s.md   # 使用后端ID       │
│          ├── local_lx3j9k_abc123.md           # 离线临时文件     │
│          ├── .overview.md                     # 日概览          │
│          └── .index.json                      # 快速索引         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 同步时上报访问
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  后端（SurrealDB）                                               │
│  ├─ memory 表               # 热数据（1024维向量）                │
│  │   ├─ content_abstract    # L0                                │
│  │   ├─ content_overview    # L1                                │
│  │   ├─ content             # L2                                │
│  │   ├─ embedding           # 1024维（热数据）                    │
│  │   └─ pinned              # 用户置顶标记                        │
│  │                                                              │
│  ├─ memory_warm 表          # 温数据（PQ量化256维）               │
│  ├─ memory_cold 表          # 冷数据（仅L0 + 归档引用）           │
│  ├─ abstract_index 表       # L0快速索引                         │
│  ├─ access_log 表           # 访问日志（后端记录）                │
│  └─ 定时任务                # 每日智能分层评估                    │
│       ├─ 规则：preference/decision 永不过期                      │
│       ├─ 规则：pinned 永不过期                                   │
│       ├─ 规则：<30天 保持热数据                                  │
│       └─ 规则：访问频率影响分层                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
写入流程：
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌────────────┐
│ OpenCode    │───▶│ 插件端        │───▶│ 后端            │───▶│ 返回       │
│ 生成L0/L1   │    │ 写入timeline │    │ 存储 + 返回ID   │    │ memory_id  │
└─────────────┘    └──────────────┘    └─────────────────┘    └────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ 本地文件     │
                   │ memory_xxx.md│
                   └──────────────┘

读取流程：
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│ 用户查询    │───▶│ 插件端        │───▶│ 后端（可选）    │
│             │    │ 读取L0/L1/L2 │    │ 记录访问日志    │
└─────────────┘    └──────────────┘    └─────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ 返回内容     │
                   │ 根据level过滤│
                   └──────────────┘
```

---

## 三、文件格式规范

### 3.1 Timeline 条目格式

**文件名**：

- 在线：`memory_{backend_id}.md` （例如：`memory_s9kzvcu9z3xflbr2al5s.md`）
- 离线：`local_{temp_id}.md` （例如：`local_lx3j9k_abc123.md`）

**内容格式**：

```markdown
---
id: mem_20260323_001
date: 2026-03-23T10:30:00Z
type: decision
tags: [typescript, preference]
project: @longray/opencode-memory-plugin
memory_id: memory:s9kzvcu9z3xflbr2al5s  # 后端ID
source_id: a1b2c3d4e5f6...              # 内容哈希
---

# Abstract

User prefers TypeScript for all new projects.

## Overview

- TypeScript preference established on 2026-03-23
- Used for type safety and better IDE support
- Applies to all new features and refactors

## Content

User explicitly stated they prefer TypeScript for all new projects.
This decision was made after experiencing productivity gains...

---
```

### 3.2 字段说明

| 层级   | 字段     | 建议长度 | 用途                     |
| ------ | -------- | -------- | ------------------------ |
| **L0** | Abstract | ≤100字符 | 一句话摘要，用于快速浏览 |
| **L1** | Overview | ≤500字符 | 核心要点，用于详细预览   |
| **L2** | Content  | 无限制   | 完整内容，按需加载       |

### 3.3 日概览格式（.overview.md）

```markdown
# 2026-03-23 记忆概览（6 entries）

- [decision] User prefers TypeScript... → memory_s9kzvcu9z3xflbr2al5s.md
- [pattern] Use async/await... → memory_a1b2c3d4e5f6g7h8.md
- [lesson] Learned: Always validate... → memory_i9j0k1l2m3n4o5p6.md
```

### 3.4 全局索引格式（MEMORY.md）

```markdown
# 长期记忆索引 v2.4

**总条目**: 40 | **最后更新**: 2026-03-23

## 🔥 置顶记忆

- [preference] User prefers TypeScript... → timeline/2026/03/23/memory_s9kzvcu9z3xflbr2al5s.md ⭐

## 📝 最近记忆（20条）

- [decision] Phase A implementation... → timeline/2026/03/19/memory_xxx.md
- [preference] User prefers segmented... → timeline/2026/03/19/memory_yyy.md
  ...

## 📊 按主题统计

| 主题        | 数量 |
| ----------- | ---- |
| decisions   | 15   |
| preferences | 8    |

## 🔗 Timeline 目录

timeline/2026/03/...
```

### 3.5 关联映射格式（link-map.json）

```json
{
  "version": "2.4.0",
  "updated_at": "2026-03-23T10:30:00Z",
  "entries": {
    "memory:s9kzvcu9z3xflbr2al5s": {
      "path": "timeline/2026/03/23/memory_s9kzvcu9z3xflbr2al5s.md",
      "abstract": "User prefers TypeScript...",
      "type": "preference",
      "tags": ["typescript"],
      "pinned": true,
      "pinned_at": "2026-03-23T10:30:00Z",
      "pin_note": "Core preference, never forget"
    }
  }
}
```

---

## 四、API 设计

### 4.1 memory_write（插件端）

**参数**（abstract/overview 必填）：

```javascript
{
  content: string;      // L2: 完整内容（必填）
  abstract: string;     // L0: 一句话摘要，建议≤100字符（必填）
  overview: string;     // L1: 核心要点，建议≤500字符（必填）
  type: string;         // 类型：preference/decision/pattern/lesson/note（默认general）
  tags: string[];       // 标签数组（可选）
  pinned: boolean;      // 是否置顶（可选，默认false）
}
```

**验证**：

- ❌ abstract/overview 缺失 → 报错：`abstract and overview are required`
- ⚠️ 长度超出建议 → 警告但不拒绝

**返回值**：

```javascript
{
  success: true,
  filePath: "timeline/2026/03/23/memory_s9kzvcu9z3xflbr2al5s.md",
  memoryId: "memory:s9kzvcu9z3xflbr2al5s",
  abstract: "User prefers TypeScript...",
  isLocal: false  // true表示离线写入，待同步
}
```

### 4.2 memory_read（插件端）

**参数**：

```javascript
{
  entry_id: string; // 条目ID（必填）
  level: number; // 0=abstract, 1=overview, 2=full（默认2）
}
```

**返回值**：

```javascript
// level=0
"User prefers TypeScript for all new projects.";

// level=1
"# Abstract\nUser prefers TypeScript...\n\n## Overview\n- TypeScript preference...";

// level=2
"---\nfrontmatter...\n---\n# Abstract\n...\n## Overview\n...\n## Content\n...";
```

### 4.3 memory_pin（插件端）

**参数**：

```javascript
{
  entry_id: string; // 条目ID
  action: "pin" | "unpin" | "status"; // 操作
  note: string; // 置顶备注（可选）
}
```

**功能**：

- 标记条目为 pinned
- pinned 条目永不过期（后端分层时保护）
- 显示在 MEMORY.md "置顶记忆" 区域

### 4.4 memory_archive（插件端，可选）

**参数**：

```javascript
{
  mode: "preview" | "execute"; // 预览或执行
  months_ago: number; // 归档N个月前的数据
}
```

**功能**：

- 手动归档旧条目到 `.archive/2026-01.tar.gz`
- 本地压缩，不上传到 S3

### 4.5 后端 API（新增/改造）

**POST /api/v1/memories**（上传）

```json
{
  "content": "full content...",
  "type": "preference",
  "tags": ["typescript"],
  "metadata": {
    "l0": "User prefers TypeScript...",
    "l1": "- TypeScript preference...",
    "pinned": true
  },
  "tenant_id": "default",
  "project_id": "@longray/opencode-memory-plugin"
}
```

**响应**：

```json
{
  "id": "memory:s9kzvcu9z3xflbr2al5s",
  "success": true
}
```

**POST /api/v1/memories/search**（搜索）

```json
{
  "query": "TypeScript preference",
  "mode": "hybrid",
  "level": 0, // 只返回 L0
  "limit": 10
}
```

**POST /api/v1/access/log**（访问上报）

```json
{
  "entry_id": "memory:s9kzvcu9z3xflbr2al5s",
  "access_type": "read", // read | search
  "access_level": 0
}
```

---

## 五、数据生命周期管理

### 5.1 智能分层规则

```
分层评分 = 时间衰减(30%) + 访问频率(50%) + 重要性(20%)

热数据：评分 ≥ 60 或 满足特殊规则
温数据：30 ≤ 评分 < 60
冷数据：评分 < 30
```

### 5.2 特殊规则（永不过期）

| 条件                | 层级 | 说明       |
| ------------------- | ---- | ---------- |
| `pinned = true`     | 热   | 用户置顶   |
| `type = preference` | 热   | 核心偏好   |
| `type = decision`   | 热   | 重要决策   |
| `created < 30天`    | 热   | 新数据保护 |

### 5.3 默认时间规则（后端离线时）

| 类型                | 时间     | 默认层级 |
| ------------------- | -------- | -------- |
| preference/decision | 任何时间 | 热       |
| pattern/lesson      | 30-180天 | 温       |
| daily/note          | >180天   | 冷       |

### 5.4 访问频率加分（后端在线时）

| 访问时间 | 加分 |
| -------- | ---- |
| 今天     | +40  |
| 7天内    | +20  |
| 30天内   | +10  |

### 5.5 降级/升级策略

```
降级：
- Hot -> Warm: 向量从 1024维 量化到 256维
- Warm -> Cold: 删除 L2，保留 L0+L1，指向归档

升级：
- Cold -> Warm: 从归档加载，重新量化
- Warm -> Hot: 重新生成 1024维 向量（调用 embedding 服务）
```

---

## 六、实施路线图

### Phase 1: 插件端核心（11-13小时）⭐ 立即实施

| 任务                           | 时间 | 说明                                 |
| ------------------------------ | ---- | ------------------------------------ |
| **6.1.1** memory_write 改造    | 3h   | 必填 abstract/overview，生成分层格式 |
| **6.1.2** writeEntryToTimeline | 2h   | 在线用后端ID，离线索临时ID           |
| **6.1.3** 文件名重命名逻辑     | 1.5h | 同步后 local_xxx → memory_xxx        |
| **6.1.4** updateDayOverview    | 1h   | 更新日概览                           |
| **6.1.5** updateMemoryIndex    | 1h   | 更新全局索引（20条限制）             |
| **6.1.6** updateLinkMap        | 1h   | 更新关联映射，支持 pinned            |
| **6.1.7** memory_read 改造     | 1.5h | 支持 level 参数分级读取              |

### Phase 2: 插件端增强（3-4小时）后续

| 任务                          | 时间 | 说明               |
| ----------------------------- | ---- | ------------------ |
| **6.2.1** memory_pin 工具     | 1.5h | 置顶/取消置顶      |
| **6.2.2** memory_archive 工具 | 1h   | 手动归档（可选）   |
| **6.2.3** 访问上报（可选）    | 1h   | 异步上报访问到后端 |

### Phase 3: 后端核心（10-12小时）后续

| 任务                          | 时间 | 说明                        |
| ----------------------------- | ---- | --------------------------- |
| **6.3.1** memory 表改造       | 2h   | 添加 L0/L1 字段，1024维向量 |
| **6.3.2** memory_warm/cold 表 | 1.5h | 温/冷数据表                 |
| **6.3.3** abstract_index 表   | 1.5h | L0 快速索引                 |
| **6.3.4** 上传端点改造        | 2h   | 接收 metadata.l0/l1         |
| **6.3.5** 查询端点改造        | 2h   | 支持 level 参数             |
| **6.3.6** 定时分层任务        | 2h   | 每日评估，降级/升级         |

### Phase 4: 测试与优化（3-4小时）

- 边界测试
- 性能测试
- 离线/在线切换测试

---

## 七、时间估算汇总

| 阶段                   | 工作量     | 优先级  |
| ---------------------- | ---------- | ------- |
| **Phase 1** 插件端核心 | 11-13h     | ⭐ 立即 |
| **Phase 2** 插件端增强 | 3-4h       | 后续    |
| **Phase 3** 后端核心   | 10-12h     | 后续    |
| **Phase 4** 测试优化   | 3-4h       | 最后    |
| **总计**               | **27-33h** | -       |

**建议**：分 2-3 个迭代完成

- 迭代 1：Phase 1（插件端核心）
- 迭代 2：Phase 3（后端核心）
- 迭代 3：Phase 2+4（增强+测试）

---

## 八、验证清单

### 功能验证

- [ ] abstract/overview 必填验证
- [ ] 长度超出建议时警告
- [ ] 分层格式文件生成
- [ ] 文件名使用后端 memory_id
- [ ] 离线时生成本地临时 ID
- [ ] 同步后自动重命名
- [ ] memory_read level=0/1/2 正确
- [ ] 日概览正确更新
- [ ] MEMORY.md 限制20条
- [ ] link-map.json 正确更新
- [ ] pinned 条目保护

### 边界验证

- [ ] 后端离线时本地写入
- [ ] 重命名失败处理
- [ ] 并发写入冲突
- [ ] 超长内容处理

### 回归验证

- [ ] 旧格式条目可读取（如有）
- [ ] 后端同步正常
- [ ] 搜索功能正常

---

## 九、风险与缓解

| 风险               | 可能性 | 影响 | 缓解                       |
| ------------------ | ------ | ---- | -------------------------- |
| 重命名失败         | 低     | 中   | 保留临时文件，下次同步重试 |
| 后端ID冲突         | 极低   | 高   | 后端保证唯一性             |
| 离线写入丢失       | 低     | 高   | 本地持久化，队列同步       |
| 降级重要数据       | 中     | 高   | pinned 标记 + 类型保护     |
| Token 优化不达预期 | 低     | 中   | 先加载20条L0测试           |

---

## 十、关键决策总结

| 决策项                | 选择           | 理由                       |
| --------------------- | -------------- | -------------------------- |
| **abstract/overview** | 必填           | 由 OpenCode 生成，确保质量 |
| **文件名**            | 后端 memory_id | 全局唯一，易于追踪         |
| **离线写入**          | local\_ 前缀   | 支持离线，同步后重命名     |
| **分层策略**          | 智能分层       | 重要性 + 访问频率 + 时间   |
| **AI 生成**           | ❌ 移除        | 插件端不调用 LLM           |
| **S3 归档**           | ❌ 移除        | 本地压缩即可               |
| **数据迁移**          | ❌ 不迁移      | 重建上传，干净起点         |
| **向后兼容**          | ❌ 不保留      | 新格式，强制验证           |

---

## 十一、待确认问题

1. **实施优先级**：是否先实施 Phase 1（插件端核心）？
2. **评分权重**：访问频率 50% / 重要性 20% / 时间 30% 是否合理？
3. **置顶功能**：是否需要 memory_pin 工具？
4. **手动归档**：是否需要 memory_archive 工具？
5. **旧数据**：确认不迁移，重建上传？

---

**文档索引**：

- 详细插件端计划：`IMPLEMENTATION-PLAN-PLUGIN-v2.md`
- 详细后端计划：`IMPLEMENTATION-PLAN-BACKEND-v2.md`
- 数据生命周期：`DATA-LIFECYCLE-STRATEGY-FINAL.md`
- 文件名策略：`FILENAME-STRATEGY.md`

---

**请审核此设计方案，确认或提出修改意见。**
