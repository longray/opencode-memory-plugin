# OpenCode Memory Plugin - 智能数据生命周期管理策略

**版本**: v2.4.0-L0L1L2  
**更新日期**: 2026-03-24

---

## 一、问题分析

### 纯时间分层的缺陷 ❌

```
场景1：核心偏好设置
- 创建时间：90天前
- 访问频率：每天查询
- 纯时间策略：降级为温数据 ❌
- 实际需求：应保持热数据 ✅

场景2：临时笔记
- 创建时间：7天前
- 访问频率：从未查询
- 纯时间策略：保持热数据 ❌
- 实际需求：应降级为温数据 ✅

场景3：项目决策
- 创建时间：180天前
- 访问频率：每周查询
- 纯时间策略：降级为冷数据 ❌
- 实际需求：应保持温数据 ✅
```

**结论**：需要**基于访问频率**而非纯粹时间的智能分层策略。

---

## 二、智能分层策略（基于 LRU + 重要性）

### 2.1 分层标准（多维评分）

```
数据评分 = 时间衰减分 × 0.3 + 访问频率分 × 0.5 + 重要性分 × 0.2

分层阈值：
- 热数据：评分 ≥ 60
- 温数据：30 ≤ 评分 < 60
- 冷数据：评分 < 30
```

### 2.2 评分维度详解

#### 维度 1：时间衰减（权重 30%）

```
时间衰减分 = 100 × e^(-λt)

其中：
- t = 距离创建的天数
- λ = 衰减系数 (0.01，约69天后衰减到50%)

示例：
- 0天：100分
- 30天：74分
- 90天：41分
- 180天：17分
```

#### 维度 2：访问频率（权重 50%）⭐ **核心**

```
访问频率分 = min(100, 访问次数 × 10 + 最近访问权重)

最近访问加分：
- 今天访问：+40分
- 7天内访问：+20分
- 30天内访问：+10分

示例：
- 从未访问：0分
- 创建时访问1次：10分
- 今天访问3次：70分（3×10 + 40）
- 每周访问，今天刚查：60分（多次累加）
```

#### 维度 3：重要性（权重 20%）

```
重要性基础分（按类型）：
- preference（偏好）：80分
- decision（决策）：70分
- pattern（模式）：60分
- lesson（教训）：50分
- general（普通）：30分
- daily（日志）：20分

特殊标记：
- 用户"置顶"：+100分（永不降级）
- 标签"critical"：+50分
```

### 2.3 分层决策示例

```
案例1：TypeScript 偏好（90天前创建）
├─ 时间衰减：41分（90天）
├─ 访问频率：60分（每周查询）
├─ 重要性：80分（preference类型）
└─ 总分：41×0.3 + 60×0.5 + 80×0.2 = 59.3分
→ 温数据（接近热数据边界）
→ 实际：保持热数据（重要偏好）

案例2：临时会议记录（7天前创建）
├─ 时间衰减：93分（7天）
├─ 访问频率：0分（从未查询）
├─ 重要性：20分（daily类型）
└─ 总分：93×0.3 + 0×0.5 + 20×0.2 = 32.9分
→ 温数据

案例3：核心架构决策（180天前创建，用户置顶）
├─ 时间衰减：17分（180天）
├─ 访问频率：50分（每月查询）
├─ 重要性：170分（decision 70 + 置顶 100）
└─ 总分：17×0.3 + 50×0.5 + 170×0.2 = 59.1分
→ 温数据（但置顶强制保持热数据）
```

---

## 三、访问追踪实现

### 3.1 访问日志（本地 SQLite）

```javascript
// 本地轻量级访问追踪
const sqlite3 = require("better-sqlite3");
const accessDb = new sqlite3(path.join(MEMORY_DIR, ".access.db"));

// 初始化表
accessDb.exec(`
  CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id TEXT NOT NULL,
    access_type TEXT, -- 'read' | 'search' | 'relate'
    access_level INTEGER, -- 0 | 1 | 2
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_entry_access ON access_log(entry_id, accessed_at);
  CREATE INDEX IF NOT EXISTS idx_time_access ON access_log(accessed_at);
`);

// 记录访问
function logAccess(entryId, accessType, level) {
  accessDb
    .prepare(
      "INSERT INTO access_log (entry_id, access_type, access_level) VALUES (?, ?, ?)",
    )
    .run(entryId, accessType, level);
}
```

### 3.2 memory_read 集成

```javascript
memory_read: tool({
  // ...
  async execute(args) {
    const result = await readEntryById(args.entry_id, args.level);

    // 记录访问
    logAccess(args.entry_id, 'read', args.level);

    return result;
  },
}),
```

### 3.3 访问统计查询

```javascript
async function getAccessStats(entryId, days = 30) {
  const stats = accessDb
    .prepare(
      `
    SELECT 
      COUNT(*) as total_accesses,
      COUNT(DISTINCT DATE(accessed_at)) as unique_days,
      MAX(accessed_at) as last_accessed
    FROM access_log 
    WHERE entry_id = ? 
    AND accessed_at > DATE('now', '-${days} days')
  `,
    )
    .get(entryId);

  // 最近访问加分
  const lastAccess = new Date(stats.last_accessed);
  const now = new Date();
  const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);

  let recencyBonus = 0;
  if (daysSinceAccess < 1) recencyBonus = 40;
  else if (daysSinceAccess < 7) recencyBonus = 20;
  else if (daysSinceAccess < 30) recencyBonus = 10;

  return {
    ...stats,
    recency_bonus: recencyBonus,
    frequency_score: Math.min(100, stats.total_accesses * 10 + recencyBonus),
  };
}
```

---

## 四、动态分层转换（后端）

### 4.1 智能分层算法

```rust
#[derive(Debug, Clone)]
struct EntryScore {
    entry_id: String,
    time_decay: f64,      // 0-100
    access_frequency: f64, // 0-100
    importance: f64,      // 0-100
    pinned: bool,         // 用户置顶
}

impl EntryScore {
    fn total_score(&self) -> f64 {
        if self.pinned {
            return 100.0;  // 置顶永不降级
        }

        self.time_decay * 0.3
        + self.access_frequency * 0.5
        + self.importance * 0.2
    }

    fn tier(&self) -> StorageTier {
        let score = self.total_score();

        match score {
            s if s >= 60.0 => StorageTier::Hot,
            s if s >= 30.0 => StorageTier::Warm,
            _ => StorageTier::Cold,
        }
    }
}

// 每日分层评估
async fn evaluate_and_convert_tiers() -> Result<()> {
    // 1. 查询所有条目
    let entries: Vec<Memory> = surrealdb
        .query("SELECT id, type, created_at, pinned FROM memory")
        .await?;

    for entry in entries {
        // 2. 计算评分
        let access_stats = get_access_stats(&entry.id).await?;

        let score = EntryScore {
            entry_id: entry.id.clone(),
            time_decay: calculate_time_decay(&entry.created_at),
            access_frequency: access_stats.frequency_score,
            importance: get_importance_score(&entry.type, &entry.tags),
            pinned: entry.pinned,
        };

        // 3. 确定目标层级
        let target_tier = score.tier();
        let current_tier = get_current_tier(&entry.id).await?;

        // 4. 执行转换
        if target_tier != current_tier {
            info!(
                "Converting {} from {:?} to {:?} (score: {:.1})",
                entry.id, current_tier, target_tier, score.total_score()
            );

            match (current_tier, target_tier) {
                (StorageTier::Hot, StorageTier::Warm) =>
                    convert_hot_to_warm(&entry).await?,
                (StorageTier::Hot, StorageTier::Cold) => {
                    // 先转温再转冷
                    convert_hot_to_warm(&entry).await?;
                    convert_warm_to_cold(&entry).await?;
                }
                (StorageTier::Warm, StorageTier::Cold) =>
                    convert_warm_to_cold(&entry).await?,
                (StorageTier::Warm, StorageTier::Hot) =>
                    convert_warm_to_hot(&entry).await?,  // 升级！
                (StorageTier::Cold, StorageTier::Warm) =>
                    convert_cold_to_warm(&entry).await?,  // 升级！
                (StorageTier::Cold, StorageTier::Hot) =>
                    convert_cold_to_hot(&entry).await?,   // 升级！
                _ => {}
            }
        }
    }

    Ok(())
}
```

### 4.2 降级与升级

**降级（Hot -> Warm）**：

```rust
async fn convert_hot_to_warm(entry: &Memory) -> Result<()> {
    // 1. 向量量化
    let quantized = pq_quantize(&entry.embedding);

    // 2. 创建温数据记录
    surrealdb.create("memory_warm")
        .content(/* ... */)
        .await?;

    // 3. 删除原始向量（节省空间）
    surrealdb.update(&entry.id)
        .patch(json!({"embedding": None}))
        .await?;

    Ok(())
}
```

**升级（Warm -> Hot）**⭐ 关键！

```rust
async fn convert_warm_to_hot(entry: &Memory) -> Result<()> {
    // 1. 重新生成完整向量（需要调用 embedding 服务）
    let full_embedding = embedding_service
        .embed(&entry.content)  // 基于完整内容重新生成
        .await?;

    // 2. 更新为热数据
    surrealdb.update(&entry.id)
        .content(json!({
            "embedding": full_embedding,
            "storage_tier": "hot",
            "upgraded_at": Utc::now(),
        }))
        .await?;

    info!("Upgraded {} to hot tier", entry.id);
    Ok(())
}
```

---

## 五、用户控制（置顶功能）

### 5.1 memory_pin 工具

```javascript
memory_pin: tool({
  description: 'Pin important entries to prevent automatic tier downgrade',
  args: {
    entry_id: tool.schema.string().describe('Entry ID to pin'),
    action: tool.schema.string().default('pin')
      .describe('pin | unpin | status'),
    note: tool.schema.string().optional()
      .describe('Optional note why this is pinned'),
  },
  async execute(args) {
    const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
    const entry = linkMap.entries[args.entry_id];

    if (!entry) {
      return `❌ Entry not found: ${args.entry_id}`;
    }

    switch (args.action) {
      case 'pin':
        entry.pinned = true;
        entry.pin_note = args.note;
        entry.pinned_at = new Date().toISOString();
        fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));

        // 同步到后端
        await pinToBackend(args.entry_id, args.note);

        return `📌 Pinned: ${args.entry_id}\nNote: ${args.note || 'N/A'}`;

      case 'unpin':
        delete entry.pinned;
        delete entry.pin_note;
        fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
        await unpinFromBackend(args.entry_id);
        return `📍 Unpinned: ${args.entry_id}`;

      case 'status':
        const pinned = entry.pinned ? 'Yes' : 'No';
        const note = entry.pin_note || 'N/A';
        return `📍 Pinned: ${pinned}\nNote: ${note}\nEntry: ${entry.abstract.substring(0, 50)}...`;
    }
  },
}),
```

### 5.2 查看热数据列表

```javascript
memory_hot_list: tool({
  description: 'List hot/warm/cold entries with scores',
  args: {
    tier: tool.schema.string().optional().default('all')
      .describe('hot | warm | cold | all'),
    limit: tool.schema.number().optional().default(20),
  },
  async execute(args) {
    // 查询后端获取分层统计
    const stats = await backendClient.getTierStats(args.tier, args.limit);

    return `📊 Storage Tier Stats (${args.tier}):

${stats.entries.map(e => `- [${e.tier}] ${e.abstract.substring(0, 40)}... (score: ${e.score.toFixed(1)})`).join('\n')}

Total: ${stats.total} entries`;
  },
}),
```

---

## 六、实施路线图（更新）

### Phase 1：基础（8-10小时）

- ✅ memory_write 分层写入（必填 L0/L1）
- ✅ memory_read 分级读取
- ✅ 基础索引文件（.overview.md, link-map.json）

### Phase 2：访问追踪（4-5小时）

- ✅ SQLite 访问日志表
- ✅ memory_read/search 集成追踪
- ✅ 访问统计查询

### Phase 3：智能分层（后端）（6-8小时）

- ✅ 评分算法实现
- ✅ 每日评估任务
- ✅ 降级/升级转换逻辑
- ✅ 置顶功能

### Phase 4：用户界面（2-3小时）

- ✅ memory_pin 工具
- ✅ memory_hot_list 工具
- ✅ 分层状态查看

**总时间**：20-26小时

---

## 七、关键优势

| 特性         | 纯时间策略      | 智能分层策略      |
| ------------ | --------------- | ----------------- |
| **核心偏好** | 90天后降级 ❌   | 高频访问保持热 ✅ |
| **临时数据** | 90天内保持热 ❌ | 低频及时降级 ✅   |
| **自动优化** | 简单            | 复杂但高效        |
| **用户控制** | 无              | 置顶功能 ✅       |
| **双向转换** | 仅降级          | 降级+升级 ✅      |

**结论**：智能分层策略更能反映数据的**真实价值**。
