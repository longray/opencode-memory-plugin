# OpenCode Memory Plugin - 数据生命周期管理策略

**版本**: v2.4.0-L0L1L2  
**更新日期**: 2026-03-24

---

## 一、架构分层责任划分

```
┌─────────────────────────────────────────────────────────┐
│  插件端（本地文件系统）                                    │
│  ├─ timeline/2026/03/23/entry-001.md  [热数据]           │
│  ├─ timeline/2026/03/23/.overview.md  [索引]            │
│  └─ .archive/2026-01.tar.gz           [归档-手动/定时]   │
│                                                         │
│  责任：写入分层格式，维护本地索引                           │
│  触发：用户调用 memory_write                              │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP API
                         ▼
┌─────────────────────────────────────────────────────────┐
│  后端（SurrealDB + 本地压缩）                              │
│  ├─ memory 表 (<90天)       [热数据-1024维向量]           │
│  ├─ memory_warm 表 (90-180天) [温数据-PQ量化]            │
│  ├─ memory_cold 表 (>180天)   [冷数据-仅L0]              │
│  └─ .archive/2026-01.tar.gz   [归档-自动/手动]           │
│                                                         │
│  责任：自动分层转换，向量量化，归档管理                      │
│  触发：后端定时任务 / 管理员手动触发                        │
└─────────────────────────────────────────────────────────┘
```

---

## 二、本地文件（插件端）策略

### 2.1 简化策略：只有"热"和"归档"

**原则**：本地文件**不自动转换**，只有两种状态：

- **热数据**：`timeline/` 目录下的所有条目（活跃使用）
- **归档数据**：`.archive/` 目录下的按月压缩包（手动归档）

### 2.2 本地归档触发方式

#### 方式 1：手动触发（推荐）⭐

用户主动调用工具归档：

```javascript
// 新增工具：memory_archive
memory_archive: tool({
  description: 'Archive old memory entries to local compressed storage',
  args: {
    mode: tool.schema.string().default('preview')
      .describe('preview|execute - Preview shows what would be archived'),
    months_ago: tool.schema.number().default(3)
      .describe('Archive entries older than N months'),
  },
  async execute(args) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - args.months_ago);

    // 扫描旧条目
    const oldEntries = await scanOldEntries(cutoffDate);

    if (args.mode === 'preview') {
      return `📋 Archive Preview:\n- Entries to archive: ${oldEntries.length}\n- Cutoff date: ${cutoffDate.toISOString().split('T')[0]}\n\nRun with mode="execute" to archive.`;
    }

    // 执行归档
    const result = await archiveEntries(oldEntries);
    return `✅ Archived ${result.archived} entries to ${result.archivePath}`;
  },
}),
```

**调用示例**：

```javascript
// 预览
memory_archive({ mode: "preview", months_ago: 3 });

// 执行归档
memory_archive({ mode: "execute", months_ago: 3 });
```

#### 方式 2：自动触发（可选）

OpenCode 启动时检查：

```javascript
// 在插件初始化时
async function init() {
  // 每月检查一次
  const lastArchiveCheck = await getLastArchiveCheck();
  const now = new Date();

  if (!lastArchiveCheck || now.getMonth() !== lastArchiveCheck.getMonth()) {
    // 检查是否需要归档
    const stats = await getArchiveStats();

    if (stats.entriesOlderThan3Months > 100) {
      console.log(
        `[Archive] ${stats.entriesOlderThan3Months} old entries detected. Run memory_archive to compress.`,
      );
      // 仅提示，不自动执行（避免意外数据丢失）
    }

    await setLastArchiveCheck(now);
  }
}
```

#### 方式 3：定时脚本（外部）

用户自己设置定时任务：

```bash
# crontab -e
# 每月 1 号凌晨 3 点执行归档
0 3 1 * * cd ~/.opencode/memory && node archive-old-months.js
```

**结论**：本地文件**推荐手动归档**，给用户完全控制权。

---

## 三、后端 SurrealDB 策略

### 3.1 三层自动转换（后端责任）

后端服务**自动**管理数据分层：

```
热数据 (memory 表)          温数据 (memory_warm 表)         冷数据 (memory_cold 表)
├─ <90天                    ├─ 90-180天                    ├─ >180天
├─ 完整 L0/L1/L2            ├─ L0/L1 + PQ量化向量           ├─ 仅 L0
├─ 1024维向量               ├─ 256维量化                    ├─ 指向归档文件
└─ 常驻内存                  └─ 可 swap                      └─ 按需加载
```

### 3.2 自动转换触发机制

#### 触发器 1：每日定时任务（后端内部）

```rust
// 后端服务启动时启动定时任务
#[tokio::main]
async fn main() {
    // 启动 HTTP 服务
    let app = create_app().await;

    // 启动后台任务
    tokio::spawn(data_lifecycle_manager());

    app.run().await;
}

// 数据生命周期管理器
async fn data_lifecycle_manager() {
    let mut interval = tokio::time::interval(Duration::from_secs(86400)); // 每天

    loop {
        interval.tick().await;

        // 执行分层转换
        if let Err(e) = convert_hot_to_warm().await {
            eprintln!("[Lifecycle] Hot->Warm conversion failed: {}", e);
        }

        if let Err(e) = convert_warm_to_cold().await {
            eprintln!("[Lifecycle] Warm->Cold conversion failed: {}", e);
        }

        if let Err(e) = archive_cold_data().await {
            eprintln!("[Lifecycle] Cold data archival failed: {}", e);
        }
    }
}
```

#### 触发器 2：事件驱动（SurrealDB 原生）

```sql
-- 创建转换事件（如果 SurrealDB 支持）
DEFINE EVENT auto_convert_warm ON TABLE memory
WHEN $event = 'CREATE'
THEN {
  -- 查找 90-180 天的记录并转换
  LET $warm_candidates = SELECT id FROM memory
  WHERE created_at < time::now() - 90d
  AND created_at >= time::now() - 180d
  AND storage_tier = 'hot';

  FOR $entry IN $warm_candidates {
    -- 调用转换函数
    fn::convert_to_warm($entry.id);
  }
};
```

**注意**：实际转换逻辑需要在应用层实现（向量量化等），所以**推荐后端定时任务**而非数据库事件。

### 3.3 转换逻辑实现

#### 热 -> 温（90天）

```rust
async fn convert_hot_to_warm() -> Result<()> {
    let cutoff = Utc::now() - Duration::days(90);

    // 1. 查询需要转换的记录
    let to_convert: Vec<Memory> = surrealdb
        .query("SELECT * FROM memory WHERE created_at < $cutoff AND storage_tier = 'hot'")
        .bind("cutoff", cutoff)
        .await?;

    for entry in to_convert {
        // 2. 向量量化（1024 -> 256）
        let quantized = pq_quantize(&entry.embedding);

        // 3. 创建温数据记录
        surrealdb.create("memory_warm").content({
            id: &entry.id,
            content_abstract: entry.content_abstract,
            content_overview: entry.content_overview,
            content: entry.content,  // 保留 L2
            embedding_quantized: quantized,
            storage_tier: "warm",
            converted_at: Utc::now(),
        }).await?;

        // 4. 更新原记录（移除原始向量）
        surrealdb.update(&entry.id).patch(json!({
            "embedding": None,  // 删除 1024 维向量
            "storage_tier": "warm",
        })).await?;

        info!("Converted {} from hot to warm", entry.id);
    }

    Ok(())
}
```

#### 温 -> 冷（180天）

```rust
async fn convert_warm_to_cold() -> Result<()> {
    let cutoff = Utc::now() - Duration::days(180);

    let to_convert: Vec<MemoryWarm> = surrealdb
        .query("SELECT * FROM memory_warm WHERE created_at < $cutoff")
        .bind("cutoff", cutoff)
        .await?;

    for entry in to_convert {
        // 1. 本地压缩归档 L2 内容
        let archive_ref = archive_to_local(&entry).await?;

        // 2. 创建冷数据记录（仅保留 L0）
        surrealdb.create("memory_cold").content({
            id: &entry.id,
            content_abstract: entry.content_abstract,  // 仅 L0
            embedding_quantized: entry.embedding_quantized,
            content_archive_ref: archive_ref,  // 指向本地压缩文件
            storage_tier: "cold",
        }).await?;

        // 3. 删除温数据
        surrealdb.delete(&entry.id).await?;

        info!("Converted {} from warm to cold", entry.id);
    }

    Ok(())
}
```

### 3.4 管理员手动触发

提供管理员 API：

```bash
# 手动触发转换（需要管理员 token）
POST /admin/lifecycle/convert
Authorization: Bearer ADMIN_TOKEN
{
  "from": "hot",
  "to": "warm",
  "older_than_days": 90
}

# 响应
{
  "converted": 150,
  "duration_ms": 5000,
  "errors": 0
}
```

---

## 四、总结：谁负责？何时触发？

| 层级             | 责任方      | 触发方式                  | 频率      |
| ---------------- | ----------- | ------------------------- | --------- |
| **本地文件归档** | 用户/管理员 | 手动工具 `memory_archive` | 按需      |
| **热 -> 温**     | 后端服务    | 自动定时任务（每日）      | 90天自动  |
| **温 -> 冷**     | 后端服务    | 自动定时任务（每日）      | 180天自动 |
| **冷 -> 归档**   | 后端服务    | 自动定时任务（每月）      | 按需      |
| **紧急手动**     | 管理员      | Admin API                 | 随时      |

### 推荐配置

```yaml
# 后端服务配置
data_lifecycle:
  enabled: true
  schedule: "0 3 * * *" # 每天凌晨 3 点

  tiers:
    hot:
      max_age_days: 90
      vector_dimensions: 1024

    warm:
      max_age_days: 180
      vector_dimensions: 256 # PQ 量化

    cold:
      archive_local: true
      archive_path: "~/.opencode/memory/.archive"
      compress_format: "tar.gz"
```

---

## 五、实施建议

### Phase 1：插件端（立即）

- ✅ 实现 `memory_write` 分层写入
- ✅ 实现 `memory_archive` 手动归档工具
- ⏸️ 本地自动归档提示（可选）

### Phase 2：后端（后续）

- ✅ 热/温/冷三层表结构
- ✅ 每日自动转换定时任务
- ✅ 管理员手动触发 API
- ⏸️ 事件驱动转换（未来优化）

**核心原则**：

- 本地文件：用户控制，手动归档
- 后端数据：自动管理，透明分层
