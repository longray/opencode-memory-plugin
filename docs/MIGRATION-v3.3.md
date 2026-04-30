# v3.3 Atom Architecture 迁移指南

**版本**: v3.3.0  
**更新日期**: 2026-04-29  
**适用**: 从 v3.2.x 升级到 v3.3.0

---

## 概述

v3.3 Atom Architecture 引入了层级化知识图谱架构，将扁平的记忆存储升级为支持嵌套 Atom 的知识实体。本指南帮助用户和开发者完成迁移。

---

## 用户迁移指南

### 1. 自动迁移（无需操作）

**向后兼容保证**:
- ✅ 旧格式 Entity 自动识别，无需手动迁移
- ✅ `memory_write` 无 atoms 参数时行为不变
- ✅ `memory_read` 自动检测 Entity/Atom ID 类型

### 2. 新功能启用

**使用 Atom 功能**:

```javascript
// 创建带 Atom 树的 Entity
memory_write({
  abstract: "Vue 3 最佳实践",
  overview: "Composition API 指南",
  content: "完整内容...",
  type: "memory",
  tags: ["vue"],
  atoms: [
    {
      local_id: "01CHAP001",
      type: "chapter",
      name: "第1章：入门",
      content: "章节内容...",
      order: "a0",
      heading_level: 1,
      parent_id: null,
      children: [
        {
          local_id: "01SEC001",
          type: "section",
          name: "1.1 安装",
          content: "安装说明...",
          order: "a0",
          heading_level: 2,
          parent_id: "01CHAP001",
          children: []
        }
      ]
    }
  ]
});
```

### 3. 文件格式变化

**新 Entity 文件格式**:

```markdown
---
id: 01HQ...
date: 2026-04-29T...
type: memory
abstract: Vue 3 最佳实践
overview: Composition API 指南
tags: [vue]
---

# ≡≡≡ Abstract ≡≡≡
```

Vue 3 最佳实践

```

# ≡≡≡ Overview ≡≡≡
```

Composition API 指南

```

# ≡≡≡ Atoms ≡≡≡
```json
[
  {
    "local_id": "01CHAP001",
    "type": "chapter",
    "name": "第1章：入门",
    "content": "章节内容...",
    "order": "a0",
    "heading_level": 1,
    "parent_id": null,
    "children": [...]
  }
]
```
```

---

## 开发者迁移指南

### 1. API 变化

#### memory_write 扩展

```javascript
// v3.2 - 旧方式（仍然支持）
memory_write({
  abstract: "...",
  content: "..."
});

// v3.3 - 新方式（可选 atoms）
memory_write({
  abstract: "...",
  content: "...",
  atoms: [...]  // 新增可选参数
});
```

#### memory_read 扩展

```javascript
// v3.3 - 自动检测 ID 类型
const result = await readMemory({ entry_id: "01HQ..." });  // Entity
const result = await readMemory({ entry_id: "01ATOM..." }); // Atom

// 返回结构变化
// Entity: { type: "entity", id: "...", atoms: [...] }
// Atom: { type: "atom", local_id: "...", content: "..." }
```

### 2. 新增 API

| API | 用途 | 示例 |
|-----|------|------|
| `updateEntity` | 批量更新 Atoms | `updateEntity({entry_id, atoms_batch: [{action: "add", ...}]})` |
| `getEntityAtoms` | 获取 Atom 树 | `getEntityAtoms({entry_id})` |
| `markDeadLinks` | 标记死链 | `markDeadLinks({entry_id})` |
| `extractWikiLinks` | 提取 wiki 链接 | `extractWikiLinks(content)` |
| `findIncomingLinks` | 查找入链 | `findIncomingLinks(atoms, targetId)` |

### 3. 后端 API 变化

#### 新端点

```
POST /api/v1/search          # 统一搜索（Entity + Atom）
```

#### Atom 字段扩展

```python
# POST /api/v1/atoms
{
  "tags": ["setup"],
  "heading_level": 1,
  "parent_id": null,
  "order": "a0",
  "aliases": ["Setup API"],
  "entity_id": "entity:01HQ..."
}
```

### 4. 配置更新

**无需配置变更** - v3.3 功能默认启用，向后兼容。

---

## 故障排除

### 问题 1: 循环引用错误

**症状**: `writeMemory` 返回 "Circular reference detected"

**解决**: 检查 `parent_id` 是否形成循环（A→B→A）

```javascript
// 错误示例
[
  { local_id: "A", parent_id: "B" },
  { local_id: "B", parent_id: "A" }  // 循环！
]
```

### 问题 2: 悬挂引用警告

**症状**: 写入成功但返回警告 "dangling reference(s) detected"

**解决**: 检查 `parent_id` 或 `[[link]]` 指向的 ID 是否存在

### 问题 3: 文件大小限制

**症状**: "Content size exceeds maximum limit"

**解决**: Entity 文件超过 100KB，建议拆分或使用更小的 atoms

---

## 验证迁移

### 1. 运行测试

```bash
# 运行 v3.3 相关测试
npm test -- --testPathPattern="atom"

# 运行所有测试
npm test
```

### 2. 验证功能

```javascript
// 验证 Atom 功能
const result = await writeMemory({
  abstract: "Test",
  atoms: [{ local_id: "01TEST", type: "note", name: "Test", content: "..." }]
});

console.log(result.success); // 应为 true
```

---

## 回滚方案

如需回滚到 v3.2:

1. 降级插件版本: `npm install @csuwl/opencode-memory-plugin@3.2.x`
2. 旧格式 Entity 完全兼容，无需数据迁移
3. 新格式 Entity（含 atoms）仍可读取，但 atoms 会被忽略

---

## 参考文档

- [API-CONTRACT.md](./API-CONTRACT.md) - 完整 API 契约
- [v3.3-ATOM-ARCHITECTURE-DESIGN.md](./v3.3-ATOM-ARCHITECTURE-DESIGN.md) - 架构设计
- [ACCEPTANCE-REPORT.md](../openspec/changes/archive/2026-04-28-v3.3-atom-architecture/ACCEPTANCE-REPORT.md) - 验收报告

---

**迁移支持**: 如遇问题，请查看 [TROUBLESHOOTING.md](../opencode-memory-plugin/TROUBLESHOOTING.md) 或提交 Issue。
