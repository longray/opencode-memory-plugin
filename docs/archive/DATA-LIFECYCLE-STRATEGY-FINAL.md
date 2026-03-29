# OpenCode Memory Plugin - 数据生命周期管理策略（最终版）

**版本**: v2.4.0-L0L1L2  
**更新日期**: 2026-03-24  
**重要变更**: 插件端移除 SQLite，访问追踪完全由后端负责

---

## 一、架构调整

### 1.1 责任重新划分

```
┌─────────────────────────────────────────────────────────┐
│  插件端（纯文件系统，无数据库）                            │
│  ├─ timeline/            # 分层格式文件（只写不追踪）       │
│  ├─ MEMORY.md            # 轻量索引                      │
│  ├─ link-map.json        # 路径映射                      │
│  └─ .archive/            # 手动归档（可选）               │
│                                                         │
│  责任：写入分层格式，读取时上报访问上下文                    │
│  触发：用户调用工具                                        │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP API + 访问上下文
                         │
                         │ 请求头：
                         │ X-Access-Type: read/search
                         │ X-Entry-ID: mem_xxx
                         │ X-Access-Level: 0/1/2
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  后端（SurrealDB 全权负责）                               │
│  ├─ memory 表            # 热数据 + 访问统计              │
│  ├─ memory_warm 表       # 温数据 + 访问统计              │
│  ├─ memory_cold 表       # 冷数据 + 访问统计              │
│  ├─ access_log 表        # 访问日志（后端 SQLite）        │
│  └─ 定时任务             # 每日评分 + 分层转换            │
│                                                         │
│  责任：访问追踪、评分计算、自动分层、升级/降级             │
│  触发：后端内部定时任务（每日3点）                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 插件端无状态化

**移除 SQLite 后，插件端**：

- ❌ 不记录访问日志
- ❌ 不计算访问频率
- ❌ 不决定数据分层
- ✅ 只负责文件读写
- ✅ 调用后端时**上报访问上下文**

---

## 二、访问追踪迁移到后端

### 2.1 后端 access_log 表

```sql
-- 后端 SurrealDB 记录访问
DEFINE TABLE access_log SCHEMAFULL;

DEFINE FIELD entry_id ON access_log TYPE record<memory>;
DEFINE FIELD tenant_id ON access_log TYPE string;
DEFINE FIELD access_type ON access_log TYPE string  -- 'read' | 'search' | 'write'
DEFINE FIELD access_level ON access_log TYPE number; -- 0 | 1 | 2
DEFINE FIELD accessed_at ON access_log TYPE datetime DEFAULT time::now();

-- 索引加速统计查询
DEFINE INDEX idx_access_entry ON access_log FIELDS entry_id, accessed_at;
DEFINE INDEX idx_access_time ON access_log FIELDS accessed_at;
```

### 2.2 API 调用上报访问

**插件端调用后端时，自动附加访问信息**：

```javascript
// wrapper-client.js 自动处理
async function search({ query, mode, level }) {
  const response = await fetch("/api/v1/memories/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 自动附加访问上下文
      "X-Access-Type": "search",
      "X-Query": query,
    },
    body: JSON.stringify({ query, mode, level }),
  });

  const results = await response.json();

  // 异步上报：这些结果被查看了
  if (results.results) {
    for (const entry of results.results) {
      // 后台上报，不阻塞
      reportAccess(entry.id, "search_result", level).catch(console.warn);
    }
  }

  return results;
}

// 显式读取时上报
async function readEntry(entryId, level) {
  const content = await fetchEntry(entryId, level);

  // 上报访问
  await reportAccess(entryId, "read", level);

  return content;
}

// 上报函数
async function reportAccess(entryId, accessType, level) {
  try {
    await fetch("/api/v1/access/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_id: entryId,
        access_type: accessType,
        access_level: level,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    // 静默失败，不影响主流程
    console.warn("[AccessReport] Failed:", e.message);
  }
}
```

### 2.3 后端记录访问

```rust
// 后端 API: POST /api/v1/access/log
async fn log_access(req: AccessLogRequest) -> Result<()> {
    surrealdb.create("access_log").content({
        entry_id: req.entry_id,
        tenant_id: get_tenant_id(),
        access_type: req.access_type,
        access_level: req.access_level,
        accessed_at: Utc::now(),
    }).await?;

    // 同时更新 memory 表的访问计数（用于快速查询）
    surrealdb.query(r#"
        UPDATE memory SET
            access_count += 1,
            last_accessed = $now,
            access_score = calculate_access_score(access_count, $now, last_accessed)
        WHERE id = $entry_id
    "#)
    .bind("entry_id", req.entry_id)
    .bind("now", Utc::now())
    .await?;

    Ok(())
}
```

---

## 三、简化策略（推荐）

### 3.1 为什么不完全依赖后端访问追踪？

**问题**：

- 后端可能离线（本地开发）
- 访问上报增加延迟
- 网络失败导致追踪丢失

### 3.2 简化方案：混合规则（不依赖访问频率）

```
分层决策（后端）：

热数据（保持 1024 维向量）：
├─ 类型 = preference/decision（核心配置）
├─ pinned = true（用户置顶）
├─ 创建时间 < 30 天（新数据）
└─ OR 后端访问日志显示最近 7 天查询过（如果在线）

温数据（PQ 量化 256 维）：
├─ 类型 = pattern/lesson
├─ 创建时间 30-180 天
└─ AND 未被置顶

冷数据（仅保留 L0 + 归档）：
├─ 类型 = daily/note（日志类）
├─ 创建时间 > 180 天
└─ AND 低频访问（如果后端在线）
```

**优势**：

- ✅ 不依赖插件端 SQLite
- ✅ 后端离线时仍有默认规则
- ✅ 简单可预测
- ✅ 重要数据（preference）永不过期

### 3.3 后端在线时的增强

```rust
fn determine_tier(entry: &Memory, backend_online: bool) -> StorageTier {
    // 规则1：置顶永不过期
    if entry.pinned {
        return StorageTier::Hot;
    }

    // 规则2：重要类型永不过期
    if matches!(entry.entry_type, "preference" | "decision") {
        return StorageTier::Hot;
    }

    // 规则3：新数据保持热
    let age_days = (Utc::now() - entry.created_at).num_days();
    if age_days < 30 {
        return StorageTier::Hot;
    }

    // 规则4：后端在线时，检查访问频率
    if backend_online {
        let access_score = calculate_access_score(&entry.id);
        if access_score > 60 {
            return StorageTier::Hot;
        } else if access_score > 30 {
            return StorageTier::Warm;
        }
    }

    // 规则5：按时间默认分层
    match age_days {
        0..=90 => StorageTier::Warm,
        _ => StorageTier::Cold,
    }
}
```

---

## 四、最终推荐架构

### 4.1 插件端（极简）

```javascript
// 只负责：
// 1. 写入分层格式
// 2. 读取时可选上报（fire-and-forget）
// 3. 提供用户置顶标记（保存到 link-map.json）

// memory_write - 写入时可选标记重要性
memory_write({
  content: "...",
  abstract: "...",
  overview: "...",
  type: "preference", // 后端根据类型决定分层
  pinned: true, // 可选：用户置顶
});

// memory_pin - 修改置顶状态
memory_pin({ entry_id: "mem_xxx", action: "pin" });

// 读取时（可选上报，不阻塞）
memory_read({ entry_id: "xxx", level: 0 });
// 内部：异步上报访问，失败静默处理
```

### 4.2 后端（全权负责）

```rust
// 1. 接收访问日志（可选）
// 2. 每日定时评估分层
// 3. 规则驱动 + 访问频率增强
// 4. 自动降级/升级
```

---

## 五、实施简化

### Phase 1：插件端（8-10小时）- 立即实施

- ✅ memory_write（分层写入 + pinned 标记）
- ✅ memory_read（分级读取）
- ✅ memory_pin（置顶工具）
- ✅ 可选访问上报（不阻塞）

### Phase 2：后端（8-10小时）- 后续实施

- ✅ 规则驱动分层（类型 + 时间 + 置顶）
- ✅ 访问日志表（可选增强）
- ✅ 每日评估任务
- ✅ 降级/升级转换

**总时间**：16-20小时（简化后）

---

## 六、关键规则总结

| 条件                               | 分层 | 说明       |
| ---------------------------------- | ---- | ---------- |
| `pinned = true`                    | 热   | 用户置顶   |
| `type = preference/decision`       | 热   | 重要类型   |
| `created < 30 天`                  | 热   | 新数据保护 |
| `type = pattern/lesson` + 30-180天 | 温   | 普通类型   |
| `type = daily/note` + >180天       | 冷   | 日志归档   |
| 最近7天高访问（后端在线）          | 热   | 频率增强   |

**用户控制**：

- `memory_pin` 置顶重要条目
- `type` 选择影响默认分层
- 自动分层对用户透明

---

## 七、文档更新

**移除**：

- ❌ 插件端 SQLite 访问日志
- ❌ 复杂访问频率计算
- ❌ 插件端评分逻辑

**保留**：

- ✅ 分层格式（L0/L1/L2）
- ✅ 文件结构（timeline/.overview.md）
- ✅ 置顶功能（memory_pin）
- ✅ 后端全权负责分层

**新增**：

- ✅ 规则驱动分层（类型+时间+置顶）
- ✅ 后端访问追踪（可选增强）
- ✅ 异步访问上报（不阻塞）
