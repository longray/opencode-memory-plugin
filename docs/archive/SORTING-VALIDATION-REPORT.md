# 渐进加载与排序设计验证报告

**版本**: v2.4.0-L0L1L2  
**验证日期**: 2026-03-24  
**状态**: 需要修正

---

## 一、问题提出

**用户问题**：

1. 后端 ULID 支持按时间排序，插件端 HashID 支持吗？
2. 渐进加载设计是否正确？

**核心问题**：混合 ID（后端 ULID + 插件端临时 ID）能否统一按时间排序？

---

## 二、ID 格式分析

### 2.1 ULID（后端）

**格式**：`01HV8J3K2M4N5P6Q7R8S9T0UV`  
**长度**：26 个字符  
**结构**：

- 前 10 字符：时间戳（Crockford Base32，毫秒级）
- 后 16 字符：随机熵

**排序特性**：

```javascript
// ULID 按字典序 = 按时间序
const ulid1 = "01HV8J3K2M4N5P6Q7R8S9T0UV"; // 2024-03-23 10:00:00.000Z
const ulid2 = "01HV8J3K2M4N5P6Q7R8S9T0UW"; // 2024-03-23 10:00:00.001Z
const ulid3 = "01HV8J3K2M5ABC123..."; // 2024-03-23 10:00:01.000Z

// 字典序比较
ulid1 < ulid2 < ulid3; // ✅ 正确的时间序
```

**优势**：

- ✅ 纯字符串比较即可按时间排序
- ✅ 无冲突（毫秒级 + 16位随机）
- ✅ 可解码获取精确时间戳

---

### 2.2 当前设计（插件端临时 ID）❌ 有问题

**方案 A**：`local_{timestamp}_{random}`

```javascript
// 示例：local_lx3j9k_abc123
local_ + Date.now().toString(36) + _ + random;
// local_ + lxp3j9k + _ + abc123
```

**排序问题**：

```javascript
const id1 = "local_lxp3j9k_abc123"; // 时间戳: lxp3j9k (base36)
const id2 = "local_lxp3j9l_def456"; // 时间戳: lxp3j9l (base36)
const id3 = "local_lxp3j9k_zzz999"; // 时间戳: lxp3j9k (base36)

// 字典序比较
id1 < id2 < id3; // ❌ 错误！id3 时间戳和 id1 相同，但字典序更大
// 实际时间序应该是：id1 == id3 < id2
```

**结论**：`local_{timestamp}_{random}` 不能按字典序排序！

---

**方案 B**：`local_{ulid}`

```javascript
// 示例：local_01HV8J3K2M4N5P6Q7R8S9T0UV
local_ + ulid();
```

**排序问题**：

```javascript
const id1 = "local_01HV8J3K2M4N5P6Q7R8S9T0UV";
const id2 = "local_01HV8J3K2M4N5P6Q7R8S9T0UW";

// 字典序比较
"local_" + ulid1 vs "local_" + ulid2
// 由于前缀相同，比较后缀 ULID
id1 < id2  // ✅ 正确！
```

**结论**：`local_{ulid}` ✅ 可以按字典序排序！

---

### 2.3 混合 ID 排序验证

**场景**：同一目录下有后端同步的文件和本地临时的文件

```
timeline/2026/03/23/
├── memory_01HV8J3K2M4N5P6Q7R8S9T0UV.md   # 后端 ULID（已同步）
├── memory_01HV8J3K2M5ABC123DEF456.md     # 后端 ULID（已同步）
├── local_01HV8J3K2M5GHI789JKL012.md      # 本地临时 ULID
└── local_01HV8J3K2M6MNO345PQR678.md      # 本地临时 ULID
```

**排序测试**：

```javascript
const files = [
  "memory_01HV8J3K2M6MNO345PQR678.md",
  "local_01HV8J3K2M5GHI789JKL012.md",
  "memory_01HV8J3K2M4N5P6Q7R8S9T0UV.md",
  "local_01HV8J3K2M6MNO345PQR678.md",
];

// 字典序排序
files.sort();
// 结果：
// ["local_01HV8J3K2M5...", "local_01HV8J3K2M6...",
//  "memory_01HV8J3K2M4...", "memory_01HV8J3K2M6..."]

// ❌ 问题！"local_" 和 "memory_" 前缀不同
// "local_" < "memory_" (因为 'l' < 'm')
// 所以所有 local 文件排在前面，即使时间更晚
```

**根本问题**：不同前缀导致排序分组！

---

## 三、问题根因

### 3.1 排序失效原因

1. **不同前缀**：`local_` vs `memory_` 按字典序 `local_` < `memory_`
2. **所有 local 文件排在 memory 文件前面**，即使时间更晚
3. **无法统一按时间排序**

### 3.2 影响

- ❌ 无法按时间顺序加载记忆
- ❌ 日概览 `.overview.md` 顺序混乱
- ❌ 渐进加载逻辑失效

---

## 四、解决方案

### 方案 1：统一前缀 + ULID（推荐）⭐

**文件名格式**：

- 在线：`entry_{ulid}.md`（同步后也是这个格式）
- 离线：`entry_{ulid}.md`（临时文件，同步后不重命名）
- 后端 ID 存储在文件内容 frontmatter 中

**结构**：

```
timeline/2026/03/23/
├── entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md   # 在线写入
├── entry_01HV8J3K2M5ABC123DEF456.md     # 在线写入
├── entry_01HV8J3K2M5GHI789JKL012.md     # 离线写入（临时）
└── entry_01HV8J3K2M6MNO345PQR678.md     # 离线写入（临时）

// 统一前缀 "entry_"，后面都是 ULID
// 可以按字典序 = 按时间序排序 ✅
```

**优点**：

- ✅ 统一前缀，支持字典序排序
- ✅ ULID 包含时间戳，无需解析
- ✅ 离线文件同步后无需重命名
- ✅ 简化实现

**缺点**：

- ⚠️ 无法从文件名直接识别是本地还是后端生成
- ⚠️ 需要打开文件查看 frontmatter 获取 memory_id

---

### 方案 2：保留双前缀 + 排序时解析（复杂）

**文件名保持**：

- 在线：`memory_{backend_ulid}.md`
- 离线：`local_{local_ulid}.md`

**排序逻辑**：

```javascript
function sortByTime(files) {
  return files.sort((a, b) => {
    // 解析时间戳
    const timeA = extractTimestamp(a);
    const timeB = extractTimestamp(b);
    return timeA - timeB;
  });
}

function extractTimestamp(filename) {
  if (filename.startsWith("memory_")) {
    // 解析后端 ULID
    const ulid = filename.replace("memory_", "").replace(".md", "");
    return decodeULID(ulid);
  } else if (filename.startsWith("local_")) {
    // 解析本地 ULID
    const ulid = filename.replace("local_", "").replace(".md", "");
    return decodeULID(ulid);
  }
}
```

**优点**：

- ✅ 文件名可区分来源
- ✅ 支持按时间排序

**缺点**：

- ❌ 排序需要解析，复杂
- ❌ 需要 ULID 解码库
- ❌ 同步后仍需重命名（可选）

---

### 方案 3：时间戳前缀（不推荐）

**文件名**：`20260323_103000_{random}.md`

**问题**：

- ❌ 重复（毫秒级可能冲突）
- ❌ 长文件名
- ❌ 无时区信息

---

## 五、推荐方案：统一前缀 + ULID

### 5.1 最终文件名格式

```javascript
// 统一格式
const fileName = `entry_${ulid()}.md`;

// 示例
entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md;
entry_01HV8J3K2M5ABC123DEF456.md;
entry_01HV8J3K2M5GHI789JKL012.md;

// 排序：按字典序 = 按时间序 ✅
```

### 5.2 如何区分本地/后端？

**通过 frontmatter**：

```markdown
---
id: entry_01HV8J3K2M4N5P6Q7R8S9T0UV
memory_id: memory:s9kzvcu9z3xflbr2al5s # 有值 = 已同步
synced: true # 同步状态
synced_at: 2026-03-23T10:30:00Z
---

## // 离线文件

id: entry_01HV8J3K2M5GHI789JKL012
memory_id: pending # 待同步
synced: false

---
```

### 5.3 更新后的写入流程

```javascript
async function writeEntry(layers, metadata) {
  // 1. 生成本地 ULID（统一格式）
  const localId = ulid();  // 01HV8J3K2M4N5P6Q7R8S9T0UV
  const fileName = `entry_${localId}.md`;

  // 2. 构建内容
  const content = buildEntryContent({
    id: localId,
    memory_id: 'pending',  // 初始状态
    synced: false,
    ...
  });

  // 3. 写入文件
  fs.writeFileSync(filePath, content);

  // 4. 尝试同步
  if (backendOnline) {
    const result = await backend.upload({...});

    // 5. 更新文件内容（不重命名！）
    const updatedContent = content.replace(
      /memory_id: pending/,
      `memory_id: ${result.id}`
    ).replace(
      /synced: false/,
      'synced: true'
    );

    fs.writeFileSync(filePath, updatedContent);
  }

  return { fileName, localId };  // 文件名就是 localId
}
```

### 5.4 关键变更

| 原设计           | 新设计                  | 原因               |
| ---------------- | ----------------------- | ------------------ |
| `memory_{id}.md` | `entry_{ulid}.md`       | 统一前缀           |
| `local_{id}.md`  | `entry_{ulid}.md`       | 统一前缀           |
| 同步后重命名     | **不重命名**            | 简化，避免排序问题 |
| 从文件名识别来源 | **从 frontmatter 识别** | 更可靠             |

---

## 六、渐进加载设计（修正后）

### 6.1 目录结构（不变）

```
timeline/
├── 2026/
│   ├── 03/
│   │   ├── 23/
│   │   │   ├── entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md  # 10:00:00
│   │   │   ├── entry_01HV8J3K2M5ABC123DEF456.md    # 10:00:01
│   │   │   ├── entry_01HV8J3K2M5GHI789JKL012.md    # 10:00:01 (离线)
│   │   │   ├── entry_01HV8J3K2M6MNO345PQR678.md    # 10:00:02
│   │   │   └── .overview.md
│   │   └── 22/
│   │       └── ...
```

### 6.2 按时间排序（修正后）

```javascript
// 读取目录并排序
const files = fs
  .readdirSync(dayDir)
  .filter((f) => f.startsWith("entry_") && f.endsWith(".md"))
  .sort(); // 字典序 = 时间序 ✅

// 结果按时间顺序
[
  "entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md", // 10:00:00
  "entry_01HV8J3K2M5ABC123DEF456.md", // 10:00:01
  "entry_01HV8J3K2M5GHI789JKL012.md", // 10:00:01
  "entry_01HV8J3K2M6MNO345PQR678.md", // 10:00:02
];
```

### 6.3 日概览生成（按序）

```javascript
async function updateDayOverview(dayDir) {
  const files = fs
    .readdirSync(dayDir)
    .filter((f) => f.startsWith("entry_") && f.endsWith(".md"))
    .sort(); // ✅ 按时间序

  const entries = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(dayDir, file), "utf-8");
    const frontmatter = parseFrontmatter(content);
    const abstract = extractAbstract(content);

    entries.push({
      file,
      abstract,
      type: frontmatter.type,
      synced: frontmatter.synced,
    });
  }

  // 生成日概览（按时间序）
  const overview = entries
    .map(
      (e) =>
        `- [${e.type}] ${e.abstract.substring(0, 80)}... → ${e.file}${e.synced ? "" : " [pending]"}`,
    )
    .join("\n");

  fs.writeFileSync(path.join(dayDir, ".overview.md"), overview);
}
```

---

## 七、link-map.json 更新

### 7.1 新格式

```json
{
  "version": "2.4.0",
  "entries": {
    "entry_01HV8J3K2M4N5P6Q7R8S9T0UV": {
      "path": "timeline/2026/03/23/entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md",
      "memory_id": "memory:s9kzvcu9z3xflbr2al5s",
      "abstract": "User prefers TypeScript...",
      "synced": true,
      "synced_at": "2026-03-23T10:30:00Z"
    },
    "entry_01HV8J3K2M5GHI789JKL012": {
      "path": "timeline/2026/03/23/entry_01HV8J3K2M5GHI789JKL012.md",
      "memory_id": null,
      "abstract": "Some other entry...",
      "synced": false
    }
  }
}
```

### 7.2 使用本地 ID 作为主键

- **主键**：`entry_{ulid}`（文件名）
- **后端引用**：`memory_id`（可选，同步后有值）

---

## 八、验证总结

### 8.1 原设计问题

| 问题                           | 状态              |
| ------------------------------ | ----------------- |
| `local_` vs `memory_` 前缀不同 | ❌ 无法字典序排序 |
| `local_{timestamp}_{random}`   | ❌ 无法字典序排序 |
| 需要同步后重命名               | ❌ 复杂且风险高   |

### 8.2 修正后方案

| 方案                      | 状态              |
| ------------------------- | ----------------- |
| 统一前缀 `entry_`         | ✅ 支持字典序排序 |
| 统一使用 ULID             | ✅ 包含时间戳     |
| 同步后**不重命名**        | ✅ 简化流程       |
| 通过 frontmatter 区分状态 | ✅ 可靠           |

### 8.3 渐进加载验证

```
✅ 目录结构：YYYY/MM/DD/ 按时间组织
✅ 文件名排序：entry_{ulid} 字典序 = 时间序
✅ 日概览：按文件排序生成，时间有序
✅ 全局索引：可按时间遍历
```

---

## 九、关键修正

### 9.1 文件名规范（最终）

```javascript
// 统一格式，无论在线离线
const fileName = `entry_${ulid()}.md`;

// 示例
entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md;
entry_01HV8J3K2M5ABC123DEF456.md;

// 排序：
// entry_01HV8J3K2M4... < entry_01HV8J3K2M5...
// ✅ 按时间序
```

### 9.2 同步流程（简化）

```javascript
// 写入（在线或离线）
writeEntry({...})
  -> entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md
  -> memory_id: pending

// 同步（如果离线）
syncEntry()
  -> 上传到后端
  -> 获取 memory_id
  -> 更新文件内容 memory_id: memory:xxx
  -> ✅ 不重命名！
```

### 9.3 工作量调整

| 原任务               | 原时间   | 修正后   | 变化    |
| -------------------- | -------- | -------- | ------- |
| 文件名重命名逻辑     | 1.5h     | **0h**   | 移除！  |
| 同步后重命名         | 1h       | **0h**   | 移除！  |
| 索引更新（重命名后） | 1h       | **0.5h** | 简化    |
| **节省**             | **3.5h** | **0.5h** | **-3h** |

**新总工作量**：27-33h → **24-30h**

---

## 十、待确认

1. **统一前缀 `entry_`** 是否接受？
2. **同步后不重命名** 是否接受？
3. **通过 frontmatter 识别同步状态** 是否接受？

**确认后更新主设计文档。**
