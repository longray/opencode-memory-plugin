# OpenCode Memory Plugin v2.4.0

# L0/L1/L2 分层存储 - 综合设计方案（最终版）

**版本**: v2.4.0-L0L1L2  
**状态**: ✅ 已审核确认  
**更新日期**: 2026-03-24  
**预计实施时间**: 24-30 小时

---

## 一、设计目标

### 1.1 核心目标

1. **分层存储**: 实现 L0(摘要)/L1(概览)/L2(全文) 三层内容分离
2. **性能优化**: 启动只加载 L0，按需加载 L1/L2，节省 90% Token
3. **智能分层**: 基于重要性 + 访问频率 + 时间，而非纯时间降级
4. **全局唯一**: 文件名使用统一 ULID 格式，支持离线写入
5. **强制生成**: abstract 和 overview 由调用方（OpenCode）生成，必填

### 1.2 已确认决策

| 问题             | 决策                                               |
| ---------------- | -------------------------------------------------- |
| 文件名策略       | 统一 `entry_{ulid}.md`，同步后不重命名             |
| 旧数据兼容       | 从备份迁移，生成三层内容                           |
| 同步时机         | 自动同步（memory_read/write/rebuild_index 时检查） |
| 访问频率（离线） | 本地记录 + 后端在线时批量上报                      |
| 并发冲突         | 服务器去重后，本地同步删除/拉取                    |
| 日概览更新       | 批量延迟更新，单条立即更新                         |

---

## 二、架构概览

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenCode Agent（调用方）                                        │
│  ├─ 生成 abstract（建议≤100字符，一句话摘要）                    │
│  ├─ 生成 overview（建议≤500字符，核心要点）                      │
│  └─ 调用 memory_write({abstract, overview, content})             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP API / 本地文件
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  插件端（本地文件系统）                                          │
│  ├─ memory_write()          # 写入分层格式                       │
│  ├─ memory_read(level=0/1/2) # 分级读取                         │
│  ├─ memory_pin()            # 置顶重要条目                       │
│  ├─ memory_sync()           # 同步待上传条目                     │
│  └─ 同步检查               # read/write/rebuild 时自动触发       │
│                                                                 │
│  文件结构：                                                      │
│  ~/.opencode/memory/                                            │
│  ├── MEMORY.md              # 全局索引（最近20条L0）              │
│  ├── link-map.json          # 路径映射 + 状态                    │
│  ├── SOUL.md, AGENTS.md...  # 静态配置（不变）                   │
│  └── timeline/                                                  │
│      └── 2026/03/23/                                            │
│          ├── entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md   # ULID格式   │
│          ├── entry_01HV8J3K2M5ABC123DEF456.md     # ULID格式   │
│          ├── .overview.md                     # 日概览           │
│          └── .index.json                     # 快速索引          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 同步时上报
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  后端（SurrealDB）                                               │
│  ├─ memory 表               # 热数据（1024维向量）                │
│  │   ├─ local_id           # 关联插件端文件                      │
│  │   ├─ content_abstract   # L0                                │
│  │   ├─ content_overview   # L1                                │
│  │   ├─ content            # L2                                │
│  │   ├─ embedding          # 1024维（热数据）                    │
│  │   └─ pinned            # 用户置顶标记                        │
│  │                                                              │
│  ├─ memory_warm 表         # 温数据（PQ量化256维）               │
│  ├─ memory_cold 表         # 冷数据（仅L0 + 归档引用）           │
│  ├─ abstract_index 表      # L0快速索引                         │
│  ├─ access_log 表          # 访问日志                           │
│  ├─ sync_state 表          # 同步状态追踪                        │
│  └─ 定时任务              # 每日智能分层评估                     │
│       ├─ 规则：preference/decision 永不过期                      │
│       ├─ 规则：pinned 永不过期                                   │
│       ├─ 规则：<30天 保持热数据                                  │
│       └─ 规则：访问频率影响分层                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、文件格式规范

### 3.1 Timeline 条目格式（最终版）

**文件名**：统一使用 `entry_{ulid}.md`

**内容格式**：

```markdown
---
id: 01HV8J3K2M4N5P6Q7R8S9T0UV
date: 2026-03-23T10:30:00.000Z
type: decision
tags: [typescript, preference]
project: @longray/opencode-memory-plugin
memory_id: memory:s9kzvcu9z3xflbr2al5s
source_id: a1b2c3d4e5f6g7h8
synced: true
synced_at: 2026-03-23T10:30:05.000Z
---

# Abstract

User prefers TypeScript for all new projects.

## Overview

- TypeScript preference established on 2026-03-23
- Used for type safety and better IDE support
- Applies to all new features and refactors

## Content

User explicitly stated they prefer TypeScript for all new projects.
This decision was made after experiencing productivity gains in previous
projects. The preference applies globally unless specifically overridden.

Key reasons:

1. Type safety catches bugs at compile time
2. Better IDE support with IntelliSense
3. Easier refactoring with type information
4. Industry standard for modern web development

---
```

### 3.2 字段说明

| 层级   | 字段     | 建议长度 | 用途                     |
| ------ | -------- | -------- | ------------------------ |
| **L0** | Abstract | ≤100字符 | 一句话摘要，用于快速浏览 |
| **L1** | Overview | ≤500字符 | 核心要点，用于详细预览   |
| **L2** | Content  | 无限制   | 完整内容，按需加载       |

### 3.3 frontmatter 字段

| 字段        | 类型     | 说明                                          |
| ----------- | -------- | --------------------------------------------- |
| `id`        | string   | 本地 ULID（文件名）                           |
| `date`      | datetime | 创建时间                                      |
| `type`      | string   | 类型：preference/decision/pattern/lesson/note |
| `tags`      | array    | 标签数组                                      |
| `project`   | string   | 项目 ID                                       |
| `memory_id` | string   | 后端 ID，pending 表示待同步                   |
| `source_id` | string   | 内容哈希（去重用）                            |
| `synced`    | boolean  | 是否已同步                                    |
| `synced_at` | datetime | 最后同步时间                                  |

---

## 四、同步机制（最终版）

### 4.1 同步触发时机

| 操作            | 触发条件                       |
| --------------- | ------------------------------ |
| `memory_write`  | 写入后检查待同步队列           |
| `memory_read`   | 读取前检查当前条目是否需要同步 |
| `rebuild_index` | 全量同步所有待同步条目         |
| 定时任务        | 每5分钟自动检查                |

### 4.2 同步流程

```javascript
// 1. 检查是否需要同步
async function checkAndSync() {
  const pendingFiles = await findPendingFiles();

  if (pendingFiles.length === 0) {
    return { synced: 0, skipped: 0 };
  }

  // 2. 获取服务器同步状态
  const serverStatus = await backend.getSyncStatus({
    local_ids: pendingFiles.map((f) => f.localId),
  });

  const toUpload = [];
  const toDelete = [];
  const toPull = [];

  // 3. 分类处理
  for (const file of pendingFiles) {
    const server = serverStatus.synced.find((s) => s.local_id === file.localId);

    if (!server) {
      // 服务器没有，上传
      toUpload.push(file);
    } else if (server.content_hash !== file.contentHash) {
      // 内容冲突
      if (server.latest) {
        // 服务器更新，本地删除，拉取服务器版本
        toDelete.push(file);
        toPull.push(server);
      } else {
        // 本地更新，上传覆盖
        toUpload.push(file);
      }
    }
  }

  // 4. 执行同步
  const results = {
    uploaded: 0,
    deleted: 0,
    pulled: 0,
  };

  // 上传
  for (const file of toUpload) {
    await uploadToServer(file);
    updateLocalFileAfterSync(file, { synced: true });
    results.uploaded++;
  }

  // 删除本地并拉取
  for (const item of toPull) {
    fs.unlinkSync(item.localPath);
    await pullFromServer(item.serverId, item.localPath);
    results.deleted++;
    results.pulled++;
  }

  return results;
}
```

### 4.3 并发冲突处理

```javascript
async function resolveConflict(serverEntry, localEntry) {
  // 比较时间戳
  if (serverEntry.updated_at > localEntry.updated_at) {
    // 服务器更新更晚，保留服务器版本
    return {
      action: "USE_SERVER",
      localFile: localEntry.path,
      serverData: serverEntry,
    };
  } else {
    // 本地更新更晚，上传覆盖
    return {
      action: "USE_LOCAL",
      localFile: localEntry.path,
      serverId: serverEntry.id,
    };
  }
}
```

---

## 五、日概览更新（最终版）

### 5.1 更新策略

| 场景             | 策略                  |
| ---------------- | --------------------- |
| 单条写入         | 立即更新 .overview.md |
| 批量写入（>5条） | 延迟更新（防抖 2秒）  |
| 迁移脚本         | 迁移完成后统一重建    |
| 手动触发         | 立即更新              |

### 5.2 防抖实现

```javascript
let overviewUpdateTimer = null;

async function updateDayOverviewDebounced(dayDir) {
  // 清除之前的定时器
  if (overviewUpdateTimer) {
    clearTimeout(overviewUpdateTimer);
  }

  // 设置新的定时器（2秒后执行）
  overviewUpdateTimer = setTimeout(async () => {
    await generateDayOverview(dayDir);
    overviewUpdateTimer = null;
  }, 2000);
}

// 批量写入时
async function batchWrite(entries) {
  for (const entry of entries) {
    await writeEntry(entry);
  }

  // 批量写入后立即更新
  if (entries.length > 5) {
    if (overviewUpdateTimer) {
      clearTimeout(overviewUpdateTimer);
    }
    await generateDayOverview(dayDir);
  }
}
```

---

## 六、访问频率追踪（最终版）

### 6.1 本地记录（离线）

```javascript
// 轻量级访问日志（文件存储）
const accessLogPath = path.join(MEMORY_DIR, ".access-log.jsonl");

// 记录访问
function logLocalAccess(entryId, accessType, level) {
  const logEntry = {
    local_id: entryId,
    access_type: accessType,
    access_level: level,
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(accessLogPath, JSON.stringify(logEntry) + "\n");
}

// 批量上报到服务器
async function syncAccessLogs() {
  if (!(await backend.isOnline())) {
    return; // 离线不上报
  }

  const logs = readPendingAccessLogs();

  for (const log of logs) {
    await backend.reportAccess(log);
  }

  // 上报成功后清除
  clearPendingLogs();
}
```

### 6.2 触发时机

| 操作          | 是否记录访问 |
| ------------- | ------------ |
| memory_read   | ✅ 记录      |
| memory_search | ✅ 记录      |
| memory_write  | ❌ 不记录    |
| memory_pin    | ❌ 不记录    |

---

## 七、实施路线图

### Phase 1: 插件端核心（11-13小时）

| 任务                         | 时间 | 说明                                 |
| ---------------------------- | ---- | ------------------------------------ |
| **1.1** memory_write 改造    | 3h   | 必填 abstract/overview，生成分层格式 |
| **1.2** writeEntryToTimeline | 2h   | 使用 ULID，生成新格式                |
| **1.3** updateDayOverview    | 1h   | 支持防抖                             |
| **1.4** updateMemoryIndex    | 1h   | 更新 MEMORY.md                       |
| **1.5** updateLinkMap        | 1h   | 更新 link-map.json                   |
| **1.6** memory_read 改造     | 1.5h | 支持 level 分级                      |
| **1.7** 同步检查逻辑         | 2h   | read/write 时自动检查                |
| **1.8** 冲突处理             | 1.5h | 删除/拉取逻辑                        |

### Phase 2: 插件端增强（3-4小时）

| 任务                    | 时间 | 说明               |
| ----------------------- | ---- | ------------------ |
| **2.1** memory_pin 工具 | 1.5h | 置顶/取消置顶      |
| **2.2** 本地访问记录    | 1h   | 离线访问追踪       |
| **2.3** 迁移脚本        | 1.5h | 从备份迁移生成三层 |

### Phase 3: 后端核心（10-12小时）

| 任务                 | 时间 | 说明                 |
| -------------------- | ---- | -------------------- |
| **3.1** 表结构改造   | 3h   | 添加 local_id 等字段 |
| **3.2** 上传端点     | 2h   | 支持 local_id        |
| **3.3** 搜索端点     | 2h   | 返回 local_id        |
| **3.4** 定时分层任务 | 3h   | 智能分层评估         |
| **3.5** 访问日志     | 2h   | 记录和统计           |

---

## 八、时间估算汇总

| 阶段                   | 工作量     | 优先级  |
| ---------------------- | ---------- | ------- |
| **Phase 1** 插件端核心 | 11-13h     | ⭐ 立即 |
| **Phase 2** 插件端增强 | 3-4h       | 后续    |
| **Phase 3** 后端核心   | 10-12h     | 后续    |
| **总计**               | **24-30h** | -       |

---

## 九、验证清单

### 功能验证

- [ ] abstract/overview 必填验证
- [ ] 长度超出建议时警告
- [ ] 分层格式文件生成（entry\_{ulid}.md）
- [ ] 离线写入后自动同步
- [ ] 冲突时删除/拉取
- [ ] memory_read level=0/1/2 正确
- [ ] 日概览防抖更新
- [ ] 本地访问记录

### 数据迁移

- [ ] 备份现有数据
- [ ] 迁移脚本生成 L0/L1/L2
- [ ] 迁移后索引正确

---

## 十、已确认决策总结

| 问题             | 决策                                      |
| ---------------- | ----------------------------------------- |
| 文件名策略       | 统一 `entry_{ulid}.md`，同步后不重命名 ✅ |
| 旧数据兼容       | 从备份迁移，生成三层内容 ✅               |
| 同步时机         | 自动同步（read/write/rebuild 时检查）✅   |
| 访问频率（离线） | 本地记录 + 后端在线时批量上报 ✅          |
| 并发冲突         | 服务器去重后，本地删除/拉取 ✅            |
| 日概览更新       | 批量延迟，单条立即 ✅                     |

---

**请确认是否可以开始实施 Phase 1。**
