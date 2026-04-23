# CLI v3.2 升级实施文档

**版本**: v3.2.0  
**日期**: 2026-04-23  
**状态**: 待实施  
**优先级**: High

---

## 1. 项目概述

### 1.1 目标

将 CLI 从 v2.4.0 升级到 v3.2.0，实现代码复用：CLI 命令直接调用 `tools/` 目录的工具，确保一份代码多处使用。

### 1.2 核心原则

```
┌─────────────────────────────────────────────────────────┐
│  核心原则：一份代码，多处使用                             │
├─────────────────────────────────────────────────────────┤
│  CLI (index.cjs)          Tools (tools/*.js)             │
│      │                          │                      │
│      ├── import tools          ├── export tool          │
│      │                          │                      │
│      ├── call tool.execute()   ├── tool.execute()      │
│      │                          │                      │
│      └── ✅ 复用 Tools 代码      └── OpenCode 调用       │
└─────────────────────────────────────────────────────────┘
```

### 1.3 现状分析

| CLI 命令   | 当前实现                                  | 问题        | 修正方案                  |
| ---------- | ----------------------------------------- | ----------- | ------------------------- |
| write      | 直接调用 `lib/memory-core.js`             | ❌ 代码重复 | ✅ 使用 `memory_write`    |
| read       | 直接读取文件                              | ❌ 代码重复 | ✅ 使用 `memory_read`     |
| search     | 直接遍历 `linkMap`                        | ❌ 代码重复 | ✅ 使用 `memory_search`   |
| list       | 直接遍历 `linkMap`                        | ❌ 代码重复 | ✅ 使用 `memory_timeline` |
| init       | 直接创建目录                              | ✅ 无需更改 | -                         |
| status     | 直接调用 `client.getStatus()`             | ❌ 代码重复 | ✅ 使用 `index_status`    |
| checkpoint | 直接调用 `client.getServerFingerprints()` | ❌ 代码重复 | ✅ 使用 `sync_checkpoint` |

---

## 2. 详细实施计划

### 2.1 阶段 1: 重构现有命令（优先级: High）

#### 2.1.1 write 命令重构

**当前代码 (v2.4.0)**:

```javascript
async function writeCommand(args) {
  const { writeAndSyncMemory } = await import("../lib/memory-core.js");
  const { getConfig } = await import("../lib/storage.js");
  const { getWrapperClient } = await import("../lib/wrapper-client.js");

  const config = getConfig();
  const client = getWrapperClient(config);

  const result = await writeAndSyncMemory({
    abstract,
    overview,
    content,
    type,
    tags,
    // ...
  });

  log(`✅ Written: ${result.id}`, "green");
}
```

**修正后代码 (v3.2.0)**:

```javascript
async function writeCommand(args) {
  const { memory_write } = await import("../tools/core.js");

  const result = await memory_write.execute({
    content: args._[1],
    abstract: args.abstract,
    overview: args.overview,
    type: args.type || "general",
    tags: parseTags(args.tags),
  });

  log(`✅ Written: ${result.memory_id}`, "green");
}
```

**修改要点**:

- 导入 `memory_write` 工具
- 调用 `memory_write.execute()`
- 使用工具返回的 `memory_id`

---

#### 2.1.2 read 命令重构

**当前代码 (v2.4.0)**:

```javascript
async function readCommand(args) {
  const entry = linkMap.entries[args.id];
  const filePath = path.join(MEMORY_DIR, entry.path);
  const content = fs.readFileSync(filePath, "utf-8");
  // 解析并显示...
}
```

**修正后代码 (v3.2.0)**:

```javascript
async function readCommand(args) {
  const { memory_read } = await import("../tools/core.js");

  const result = await memory_read.execute({
    entry_id: args.id,
    level: parseInt(args.level) || 2,
  });

  console.log(result); // 工具已格式化输出
}
```

---

#### 2.1.3 search 命令重构

**当前代码 (v2.4.0)**:

```javascript
async function searchCommand(args) {
  const { getLinkMap } = await import("../lib/storage.js");
  const linkMap = getLinkMap();
  // 遍历所有条目进行匹配...
}
```

**修正后代码 (v3.2.0)**:

```javascript
async function searchCommand(args) {
  const { memory_search } = await import("../tools/search.js");

  const results = await memory_search.execute({
    query: args._[1],
    mode: args.mode || "keyword",
    limit: parseInt(args.limit) || 10,
    level: 0, // 只显示摘要
  });

  console.log(results); // 工具已格式化输出
}
```

---

#### 2.1.4 list 命令重构 → timeline

**当前代码 (v2.4.0)**:

```javascript
async function listCommand(args) {
  const { getLinkMap } = await import("../lib/storage.js");
  const linkMap = getLinkMap();
  // 手动按日期分组...
}
```

**修正后代码 (v3.2.0)**:

```javascript
async function timelineCommand(args) {
  const { memory_timeline } = await import("../tools/browse.js");

  const result = await memory_timeline.execute({
    days: parseInt(args.days) || 7,
    level: 1, // 显示 overview
  });

  console.log(result); // 工具已格式化输出
}
```

**注意**: `list` 命令改名为 `timeline`，更符合 v3.2 命名

---

#### 2.1.5 status 命令重构

**当前代码 (v2.4.0)**:

```javascript
async function statusCommand(args) {
  const { getLinkMap, getConfig } = await import("../lib/storage.js");
  const { getWrapperClient } = await import("../lib/wrapper-client.js");

  const config = getConfig();
  const client = getWrapperClient(config);
  const linkMap = getLinkMap();

  const status = await client.getStatus();
  // 手动格式化输出...
}
```

**修正后代码 (v3.2.0)**:

```javascript
async function statusCommand(args) {
  const { index_status } = await import("../tools/sync.js");

  const result = await index_status.execute({
    detailed: args.detailed || false,
  });

  console.log(result); // 工具已格式化输出
}
```

---

#### 2.1.6 checkpoint 命令重构

**当前代码 (v2.4.0)**:

```javascript
async function checkpointCommand(args) {
  const { getWrapperClient } = await import("../lib/wrapper-client.js");
  const client = getWrapperClient(config);

  const fingerprints = await client.getServerFingerprints(tenantId);
  // 手动格式化...
}
```

**修正后代码 (v3.2.0)**:

```javascript
async function checkpointCommand(args) {
  const { sync_checkpoint } = await import("../tools/sync.js");

  const result = await sync_checkpoint.execute({
    action: args.action || "list",
    limit: parseInt(args.limit) || 20,
  });

  console.log(result); // 工具已格式化输出
}
```

---

### 2.2 阶段 2: 新增命令（优先级: Medium）

#### 2.2.1 sync 命令（新增）

**功能**: 执行增量同步或完整同步

```javascript
async function syncCommand(args) {
  const { incremental_sync, full_sync } = await import("../tools/sync.js");

  if (args.full) {
    const result = await full_sync.execute({
      dry_run: args["dry-run"] || false,
      auto_clean: args["auto-clean"] || false,
    });
    console.log(result);
  } else {
    const result = await incremental_sync.execute({
      dry_run: args["dry-run"] || false,
    });
    console.log(result);
  }
}

// CLI 映射
// opencode-memory sync [--full] [--dry-run] [--auto-clean]
```

---

#### 2.2.2 rebuild 命令（新增）

**功能**: 重建索引并同步

```javascript
async function rebuildCommand(args) {
  const { rebuild_index } = await import("../tools/sync.js");

  const result = await rebuild_index.execute({
    force: args.force || false,
    dry_run: args["dry-run"] || false,
  });

  console.log(result);
}

// CLI 映射
// opencode-memory rebuild [--force] [--dry-run]
```

---

#### 2.2.3 relate 命令（新增）

**功能**: 创建或查询记忆关系

```javascript
async function relateCommand(args) {
  const { memory_relate } = await import("../tools/graph.js");

  const action = args.action || "create";

  if (action === "create") {
    const result = await memory_relate.execute({
      action: "create",
      from_id: args["from-id"],
      to_id: args["to-id"],
      relation_type: args.type || "related",
      weight: parseFloat(args.weight) || 0.5,
    });
    console.log(result);
  } else if (action === "query") {
    const result = await memory_relate.execute({
      action: "query",
      from_id: args["from-id"],
    });
    console.log(result);
  }
}

// CLI 映射
// opencode-memory relate --from-id <id> --to-id <id> [--type related] [--weight 0.5]
// opencode-memory relate --action query --from-id <id>
```

---

#### 2.2.4 graph 命令（新增）

**功能**: 遍历记忆图谱

```javascript
async function graphCommand(args) {
  const { memory_graph } = await import("../tools/graph.js");

  const result = await memory_graph.execute({
    memory_id: args["memory-id"],
    depth: parseInt(args.depth) || 2,
    limit: parseInt(args.limit) || 20,
  });

  console.log(result);
}

// CLI 映射
// opencode-memory graph --memory-id <id> [--depth 2] [--limit 20]
```

---

#### 2.2.5 topics 命令（新增）

**功能**: 浏览记忆主题

```javascript
async function topicsCommand(args) {
  const { memory_topics } = await import("../tools/browse.js");

  const result = await memory_topics.execute({
    min_entries: parseInt(args.min) || 3,
  });

  console.log(result);
}

// CLI 映射
// opencode-memory topics [--min 3]
```

---

#### 2.2.6 pin 命令（新增）

**功能**: 置顶/取消置顶记忆

```javascript
async function pinCommand(args) {
  const { memory_pin } = await import("../tools/core.js");

  const result = await memory_pin.execute({
    entry_id: args["entry-id"],
    action: args.action || "pin", // 'pin' | 'unpin'
  });

  console.log(result);
}

// CLI 映射
// opencode-memory pin --entry-id <id> [--action pin|unpin]
```

---

#### 2.2.7 conflicts 命令（新增）

**功能**: 查看和解决同步冲突

```javascript
async function conflictsCommand(args) {
  const { conflict_list, conflict_resolve } = await import("../tools/sync.js");

  if (args.resolve) {
    const result = await conflict_resolve.execute({
      conflict_id: args["conflict-id"],
      resolution: args.resolution, // 'use_local' | 'use_remote' | 'keep_both'
    });
    console.log(result);
  } else {
    const result = await conflict_list.execute({
      limit: parseInt(args.limit) || 10,
    });
    console.log(result);
  }
}

// CLI 映射
// opencode-memory conflicts [--limit 10]
// opencode-memory conflicts --resolve --conflict-id <id> --resolution <strategy>
```

---

### 2.3 阶段 3: 命令映射表

#### 完整命令映射

| v3.2 工具          | CLI 命令              | 参数                                           | 说明          |
| ------------------ | --------------------- | ---------------------------------------------- | ------------- |
| `memory_write`     | `write <content>`     | `--abstract`, `--overview`, `--type`, `--tags` | 写入记忆      |
| `memory_read`      | `read`                | `--id`, `--level`                              | 读取记忆      |
| `memory_search`    | `search <query>`      | `--mode`, `--limit`                            | 搜索记忆      |
| `memory_timeline`  | `timeline`            | `--days`                                       | 时间线浏览    |
| `memory_topics`    | `topics`              | `--min`                                        | 主题浏览      |
| `memory_relate`    | `relate`              | `--from-id`, `--to-id`, `--type`, `--weight`   | 创建关系      |
| `memory_graph`     | `graph`               | `--memory-id`, `--depth`, `--limit`            | 图谱遍历      |
| `memory_pin`       | `pin`                 | `--entry-id`, `--action`                       | 置顶/取消置顶 |
| `index_status`     | `status`              | `--detailed`                                   | 系统状态      |
| `rebuild_index`    | `rebuild`             | `--force`, `--dry-run`                         | 重建索引      |
| `incremental_sync` | `sync`                | `--dry-run`                                    | 增量同步      |
| `full_sync`        | `sync --full`         | `--dry-run`, `--auto-clean`                    | 完整同步      |
| `sync_checkpoint`  | `checkpoint`          | `--action`, `--limit`                          | 同步检查点    |
| `conflict_list`    | `conflicts`           | `--limit`                                      | 冲突列表      |
| `conflict_resolve` | `conflicts --resolve` | `--conflict-id`, `--resolution`                | 解决冲突      |
| `init`             | `init`                | -                                              | 初始化目录    |

---

## 3. 实施检查清单

### 3.1 重构现有命令

- [ ] `writeCommand` - 使用 `memory_write`
- [ ] `readCommand` - 使用 `memory_read`
- [ ] `searchCommand` - 使用 `memory_search`
- [ ] `listCommand` → `timelineCommand` - 使用 `memory_timeline`
- [ ] `statusCommand` - 使用 `index_status`
- [ ] `checkpointCommand` - 使用 `sync_checkpoint`

### 3.2 新增命令

- [ ] `syncCommand` - `incremental_sync` / `full_sync`
- [ ] `rebuildCommand` - `rebuild_index`
- [ ] `relateCommand` - `memory_relate`
- [ ] `graphCommand` - `memory_graph`
- [ ] `topicsCommand` - `memory_topics`
- [ ] `pinCommand` - `memory_pin`
- [ ] `conflictsCommand` - `conflict_list` / `conflict_resolve`

### 3.3 更新文档

- [ ] 更新 `showHelp()` 函数
- [ ] 更新版本号到 v3.2.0
- [ ] 更新 README.md

### 3.4 测试

- [ ] 测试所有现有命令
- [ ] 测试所有新增命令
- [ ] 测试错误处理
- [ ] 测试帮助信息

---

## 4. 代码模板

### 4.1 标准命令模板

```javascript
async function commandName(args) {
  try {
    // 1. 导入工具
    const { tool_name } = await import("../tools/xxx.js");

    // 2. 准备参数
    const toolArgs = {
      param1: args["param-name"],
      param2: parseInt(args["param-name"]) || defaultValue,
      param3: args["param-name"] === "true",
    };

    // 3. 执行工具
    const result = await tool_name.execute(toolArgs);

    // 4. 输出结果
    console.log(result);
  } catch (e) {
    log(`❌ Command failed: ${e.message}`, "red");
    console.error(e);
    process.exit(1);
  }
}
```

### 4.2 命令注册模板

```javascript
const commands = {
  write: writeCommand,
  read: readCommand,
  search: searchCommand,
  timeline: timelineCommand, // 原 list
  topics: topicsCommand,
  relate: relateCommand,
  graph: graphCommand,
  pin: pinCommand,
  init: initCommand,
  status: statusCommand,
  sync: syncCommand,
  rebuild: rebuildCommand,
  checkpoint: checkpointCommand,
  conflicts: conflictsCommand,
  help: showHelp,
};
```

---

## 5. 风险与缓解

| 风险         | 影响 | 缓解措施                           |
| ------------ | ---- | ---------------------------------- |
| 向后兼容     | 中   | 保持现有命令名（除 list→timeline） |
| 工具导入失败 | 高   | 添加 try-catch 和友好错误信息      |
| 输出格式变化 | 低   | 工具已格式化，直接输出             |
| 性能下降     | 低   | 工具内部有缓存，影响不大           |

---

## 6. 时间估算

| 阶段     | 任务              | 预计时间    |
| -------- | ----------------- | ----------- |
| 阶段 1   | 重构 6 个现有命令 | 3 小时      |
| 阶段 2   | 添加 7 个新命令   | 4 小时      |
| 阶段 3   | 更新文档和帮助    | 1 小时      |
| 阶段 4   | 测试和调试        | 2 小时      |
| **总计** |                   | **10 小时** |

---

## 7. 实施步骤

### 步骤 1: 备份

```bash
cp cli/index.cjs cli/index.cjs.backup.v2.4.0
```

### 步骤 2: 重构现有命令

按 2.1 节的顺序逐个重构。

### 步骤 3: 添加新命令

按 2.2 节的顺序逐个添加。

### 步骤 4: 更新帮助信息

更新 `showHelp()` 函数。

### 步骤 5: 测试

运行所有命令测试。

### 步骤 6: 更新版本号

```javascript
// 第 4 行
const VERSION = "v3.2.0";
```

---

## 8. 附件

- [ ] 完整修改后的 `index.cjs` 代码
- [ ] 测试脚本
- [ ] 迁移指南

---

**文档完成！** 可以开始实施了。
