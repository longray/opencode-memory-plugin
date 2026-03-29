# OpenCode Memory Plugin - 文件名命名策略（更新）

**版本**: v2.4.0-L0L1L2  
**更新日期**: 2026-03-24  
**重要变更**: 使用后端 memory_id 作为文件名

---

## 一、命名策略对比

### 旧方案（不推荐）❌

```
timeline/2026/03/23/
├── entry-001.md
├── entry-002.md
└── entry-003.md
```

**问题**:

- 序号冲突（多设备同时写入）
- 与后端 ID 不对应
- 难以追踪
- 重启后序号重置

### 新方案（推荐）✅

```
timeline/2026/03/23/
├── memory_s9kzvcu9z3xflbr2al5s.md     # 后端返回的 ID
├── memory_a1b2c3d4e5f6g7h8i9j0.md     # 后端返回的 ID
└── local_abc123def456.md              # 离线时的临时 ID
```

**优势**:

- ✅ 全局唯一
- ✅ 与后端一致
- ✅ 支持离线写入
- ✅ 易于追踪

---

## 二、实现方案

### 2.1 文件命名规则

```javascript
// 在线状态：使用后端返回的 memory_id
if (backendOnline && syncResult.success) {
  fileName = `${memory_id.replace(":", "_")}.md`;
  // 例如: memory_s9kzvcu9z3xflbr2al5s.md
}

// 离线状态：使用本地临时 ID
else {
  const localId = generateLocalId(); // local_ + hash
  fileName = `${localId}.md`;
  // 例如: local_abc123def456.md
}
```

### 2.2 本地临时 ID 生成

```javascript
function generateLocalId() {
  // 格式: local_{timestamp}_{random}
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `local_${timestamp}_${random}`;
  // 例如: local_lx3j9k_abc123
}

// 或使用 ULID（推荐，时间有序）
function generateLocalULID() {
  return `local_${ulid()}`;
  // 例如: local_01HV8J3K2M4N5P6Q7R8S9T0UV
}
```

### 2.3 写入流程（在线）

```javascript
async function writeEntryOnline(layers, metadata) {
  // 1. 先写入临时文件（避免同步失败导致数据丢失）
  const tempId = generateLocalId();
  const tempPath = await writeToTemp(layers, metadata, tempId);

  try {
    // 2. 同步到后端
    const result = await backend.uploadMemory({
      content: layers.content,
      type: metadata.type,
      tags: metadata.tags,
      metadata: {
        l0: layers.abstract,
        l1: layers.overview,
        temp_id: tempId,
      },
    });

    // 3. 获取后端 memory_id
    const memoryId = result.id; // "memory:s9kzvcu9z3xflbr2al5s"

    // 4. 重命名为正式文件名
    const finalFileName = `${memoryId.replace(":", "_")}.md`;
    const finalPath = path.join(dayDir, finalFileName);

    // 5. 更新文件内容（添加 memory_id）
    const content = fs.readFileSync(tempPath, "utf-8");
    const updatedContent = content.replace(
      /memory_id: pending/,
      `memory_id: ${memoryId}`,
    );

    fs.writeFileSync(finalPath, updatedContent, "utf-8");
    fs.unlinkSync(tempPath); // 删除临时文件

    return {
      filePath: finalPath,
      fileName: finalFileName,
      memoryId,
      isLocal: false,
    };
  } catch (e) {
    // 同步失败，保留临时文件，标记为待同步
    console.warn(
      "[WriteEntry] Backend sync failed, keeping temp file:",
      e.message,
    );

    return {
      filePath: tempPath,
      fileName: path.basename(tempPath),
      memoryId: null,
      isLocal: true,
      tempId,
    };
  }
}
```

### 2.4 写入流程（离线）

```javascript
async function writeEntryOffline(layers, metadata) {
  // 1. 生成本地临时 ID
  const localId = generateLocalId();

  // 2. 直接写入（不等待后端）
  const fileName = `${localId}.md`;
  const filePath = path.join(dayDir, fileName);

  const content = buildEntryContent({
    ...layers,
    ...metadata,
    id: localId,
    memory_id: "pending", // 标记为待同步
  });

  fs.writeFileSync(filePath, content, "utf-8");

  // 3. 添加到同步队列
  syncQueue.add({
    tempId: localId,
    filePath,
    layers,
    metadata,
  });

  return {
    filePath,
    fileName,
    memoryId: null,
    isLocal: true,
    tempId: localId,
  };
}
```

### 2.5 同步后重命名（关键！）

```javascript
// 增量同步或全量同步后，更新本地文件名
async function syncAndRenamePendingFiles() {
  // 1. 查找所有待同步的文件（memory_id: pending）
  const pendingFiles = await findPendingFiles();

  for (const file of pendingFiles) {
    try {
      // 2. 读取内容
      const content = fs.readFileSync(file.path, "utf-8");
      const frontmatter = parseFrontmatter(content);

      // 3. 同步到后端
      const result = await backend.uploadMemory({
        content: extractContent(content),
        type: frontmatter.type,
        tags: frontmatter.tags,
        metadata: {
          l0: extractAbstract(content),
          l1: extractOverview(content),
          temp_id: frontmatter.id,
        },
      });

      // 4. 获取 memory_id
      const memoryId = result.id;

      // 5. 重命名文件
      const newFileName = `${memoryId.replace(":", "_")}.md`;
      const newPath = path.join(path.dirname(file.path), newFileName);

      // 6. 更新内容
      const updatedContent = content
        .replace(/memory_id: pending/, `memory_id: ${memoryId}`)
        .replace(
          new RegExp(`id: ${frontmatter.id}`),
          `id: ${memoryId.replace("memory:", "mem_")}`,
        );

      fs.writeFileSync(newPath, updatedContent, "utf-8");
      fs.unlinkSync(file.path);

      // 7. 更新索引
      await updateIndexesAfterRename({
        oldPath: file.path,
        newPath,
        oldId: frontmatter.id,
        newId: memoryId,
      });

      console.log(`[Sync] Renamed ${file.path} -> ${newPath}`);
    } catch (e) {
      console.error(`[Sync] Failed to sync ${file.path}:`, e.message);
      // 保留原文件，下次再试
    }
  }
}
```

### 2.6 索引更新（重命名后）

```javascript
async function updateIndexesAfterRename({ oldPath, newPath, oldId, newId }) {
  // 1. 更新 link-map.json
  const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, "utf-8"));

  if (linkMap.entries[oldId]) {
    linkMap.entries[newId] = {
      ...linkMap.entries[oldId],
      path: newPath.replace(MEMORY_DIR + path.sep, "").replace(/\\/g, "/"),
      memory_id: newId,
    };
    delete linkMap.entries[oldId];

    fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2), "utf-8");
  }

  // 2. 更新日概览中的链接
  const dayDir = path.dirname(newPath);
  const overviewPath = path.join(dayDir, ".overview.md");

  if (fs.existsSync(overviewPath)) {
    let content = fs.readFileSync(overviewPath, "utf-8");
    content = content.replace(
      new RegExp(path.basename(oldPath)),
      path.basename(newPath),
    );
    fs.writeFileSync(overviewPath, content, "utf-8");
  }

  // 3. 更新 MEMORY.md 中的链接（如果有）
  // ... 类似处理
}
```

---

## 三、文件结构示例

### 场景 1：在线写入

```javascript
// 在线状态写入
memory_write({
  content: "User prefers TypeScript...",
  abstract: "User prefers TypeScript",
  overview: "- TypeScript preference",
  type: "preference",
});

// 结果
timeline/2026/03/23/
└── memory_s9kzvcu9z3xflbr2al5s.md   # 使用后端 ID
```

### 场景 2：离线写入

```javascript
// 离线状态写入
memory_write({
  content: "User prefers TypeScript...",
  abstract: "User prefers TypeScript",
  overview: "- TypeScript preference",
  type: "preference",
});

// 结果
timeline/2026/03/23/
└── local_lx3j9k_abc123.md            # 使用本地临时 ID

// 文件内容
---
id: local_lx3j9k_abc123
memory_id: pending
---

# Abstract
User prefers TypeScript
...
```

### 场景 3：同步后重命名

```bash
# 同步前
timeline/2026/03/23/
├── local_lx3j9k_abc123.md            # 待同步
└── .overview.md

# 执行同步
$ opencode-memory sync
[INFO] Syncing 1 pending files...
[INFO] Uploaded local_lx3j9k_abc123.md -> memory:s9kzvcu9z3xflbr2al5s
[INFO] Renamed local_lx3j9k_abc123.md -> memory_s9kzvcu9z3xflbr2al5s.md

# 同步后
timeline/2026/03/23/
├── memory_s9kzvcu9z3xflbr2al5s.md   # 已重命名
└── .overview.md                      # 链接已更新
```

---

## 四、边界情况处理

### 情况 1：重命名失败（磁盘错误）

```javascript
try {
  fs.renameSync(oldPath, newPath);
} catch (e) {
  // 如果重命名失败，尝试复制+删除
  try {
    fs.copyFileSync(oldPath, newPath);
    fs.unlinkSync(oldPath);
  } catch (e2) {
    // 复制也失败，保留两个文件，记录冲突
    console.error(`[Rename] Failed to rename ${oldPath}:`, e2);
    // 下次同步时处理
  }
}
```

### 情况 2：目标文件已存在（极少见）

```javascript
if (fs.existsSync(newPath)) {
  // 文件已存在，比较内容
  const existingContent = fs.readFileSync(newPath, "utf-8");
  const newContent = fs.readFileSync(oldPath, "utf-8");

  if (existingContent === newContent) {
    // 内容相同，删除旧文件
    fs.unlinkSync(oldPath);
  } else {
    // 内容不同，保留两个文件，添加后缀
    const uniqueNewPath = newPath.replace(".md", "_duplicate.md");
    fs.renameSync(oldPath, uniqueNewPath);
    console.warn(`[Rename] Duplicate content, saved as ${uniqueNewPath}`);
  }
}
```

### 情况 3：后端返回相同 ID（重复同步）

```javascript
// 通过 content_hash 去重
const contentHash = sha256(content);
const existing = await backend.findByHash(contentHash);

if (existing) {
  // 内容已存在，直接使用现有 ID
  return existing.id;
}
```

---

## 五、更新后的时间估算

| 任务                         | 原估算 | 新估算   | 变更                |
| ---------------------------- | ------ | -------- | ------------------- |
| **writeEntryToTimeline**     | 1.5h   | **2h**   | +0.5h（重命名逻辑） |
| **syncAndRename**            | -      | **1.5h** | 新增                |
| **updateIndexesAfterRename** | -      | **1h**   | 新增                |
| **总计**                     | 1.5h   | **4.5h** | +3h                 |

**原因**：重命名涉及文件系统操作，需要处理各种边界情况。

---

## 六、总结

### 文件名格式

| 状态         | 格式                              | 示例                             |
| ------------ | --------------------------------- | -------------------------------- |
| **在线写入** | `memory_{backend_id}.md`          | `memory_s9kzvcu9z3xflbr2al5s.md` |
| **离线写入** | `local_{temp_id}.md`              | `local_lx3j9k_abc123.md`         |
| **同步后**   | 重命名为 `memory_{backend_id}.md` | -                                |

### 关键实现点

1. ✅ 在线时直接使用后端 memory_id
2. ✅ 离线时使用 local\_ 前缀的临时 ID
3. ✅ 同步成功后重命名文件
4. ✅ 更新所有索引（link-map, .overview, MEMORY.md）
5. ✅ 处理重命名失败的边界情况

这个方案满足您的要求吗？需要我详细展开某个部分吗？
