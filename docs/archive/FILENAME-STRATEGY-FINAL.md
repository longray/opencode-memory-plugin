# 文件名命名策略（最终版）

**版本**: v2.4.0  
**更新日期**: 2026-03-24  
**状态**: ✅ 已审核确认

---

## 一、核心原则

### 1.1 统一命名规范

**文件名格式**：`entry_{ulid}.md`

```
timeline/2026/03/23/
├── entry_01HV8J3K2M4N5P6Q7R8S9T0UV.md  # ULID 格式
├── entry_01HV8J3K2M5ABC123DEF456.md
└── entry_01HV8J3K2M5GHI789JKL012.md
```

**关键特性**：

- ✅ 统一前缀 `entry_`
- ✅ 字典序 = 时间序（ULID 内置时间戳）
- ✅ 无需区分在线/离线文件
- ✅ 同步后**不重命名**

---

## 二、关联机制

### 2.1 通过 frontmatter 区分同步状态

**已同步**：

```markdown
---
id: 01HV8J3K2M4N5P6Q7R8S9T0UV
memory_id: memory:s9kzvcu9z3xflbr2al5s
synced: true
synced_at: 2026-03-23T10:30:00.000Z
---
```

**待同步**：

```markdown
---
id: 01HV8J3K2M5GHI789JKL012
memory_id: pending
synced: false
---
```

---

## 三、同步流程

### 3.1 写入时

```javascript
// 1. 生成本地 ULID
const localId = ulid(); // 01HV8J3K2M4N5P6Q7R8S9T0UV
const fileName = `entry_${localId}.md`;

// 2. 写入本地文件
fs.writeFileSync(filePath, content); // synced: false

// 3. 尝试同步
if (backendOnline) {
  const result = await backend.upload({...});

  // 4. 更新内容（不重命名！）
  updateFileContent(filePath, {
    memory_id: result.id,
    synced: true,
    synced_at: new Date()
  });
}
```

### 3.2 冲突处理

```javascript
// 服务器返回已存在的 local_id
{
  "exists": true,
  "server_id": "memory:existing123",
  "action": "USE_SERVER"
}

// 处理：
// 1. 删除本地文件
fs.unlinkSync(localFilePath);

// 2. 从服务器拉取最新内容
const serverContent = await backend.getContent(serverId);
fs.writeFileSync(localFilePath, serverContent);
```

---

## 四、注意事项

### 4.1 旧文件处理

- ❌ 不再使用 `memory_xxx.md` 格式
- ❌ 不再使用 `local_xxx.md` 格式
- ✅ 统一使用 `entry_{ulid}.md`
- ✅ 迁移脚本转换旧文件

### 4.2 排序

```javascript
// 直接按文件名排序即可
const files = fs
  .readdirSync(dayDir)
  .filter((f) => f.startsWith("entry_"))
  .sort();

// 结果按时间顺序
// entry_01HV8J3K2M4... (更早)
// entry_01HV8J3K2M5... (稍后)
// entry_01HV8J3K2M6... (最新)
```

---

## 五、总结

| 项目     | 说明                         |
| -------- | ---------------------------- |
| 文件名   | `entry_{ulid}.md`            |
| 排序     | 字典序 = 时间序              |
| 同步状态 | frontmatter `synced` 字段    |
| 后端ID   | frontmatter `memory_id` 字段 |
| 重命名   | ❌ 同步后不重命名            |
