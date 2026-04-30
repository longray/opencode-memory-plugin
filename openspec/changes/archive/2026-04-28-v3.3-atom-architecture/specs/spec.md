# v3.3 Atom 架构功能规范

## 1. 数据模型

### 1.1 Entity（知识实体）

```yaml
id: entity_01HQ...
type: memory | backlog | wiki | code
abstract: "Vue 3 最佳实践"  # L0: 摘要 ≤100 字符
overview:  # L1: 结构化概览
  chapters: 3
  topics: ["Composition", "Performance"]
tags: [vue, patterns]
```

**存储**: `timeline/YYYY/MM/DD/entry_{localId}.md`

### 1.2 Atom（原子单元）

```yaml
local_id: "01KPXPH54X9Y6RX6331P8QJHPS"  # 本地生成（ULID）
source_id: "01KPXPH54X9Y6RX6331P8QJHPS"  # 与 local_id 相同
atom_id: null  # 同步后后端返回的 Atom 全局 ID

type: chapter | section | function | class | note
name: "Composition API"  # 标题
content: "setup() 函数..."  # 原子级内容

# 层级属性
parent_id: null  # null = 根级，否则指向父 Atom 的 local_id
order: "a0"  # 分数索引（Figma/Notion 方案）
heading_level: 1  # 1=H1, 2=H2, 3=H3

# 可选属性
tags: ["setup", "reactivity"]
aliases: ["Setup API", "Setup Function"]
```

**存储**: 内嵌在 Entity 文件的 Atoms 段（JSON 格式）

## 2. API 规范

### 2.1 后端 API 扩展

#### Atom 字段扩展

```python
# POST /api/v1/atoms
# PUT /api/v1/atoms/{id}
{
  "type": "chapter",
  "name": "Composition API",
  "content": "setup() 函数...",
  "entity_id": "entity_01HQ...",

  # 新增字段
  "tags": ["setup", "reactive"],
  "aliases": ["Setup API"],
  "parent_id": null,           # 根级
  "order": "a0",               # 分数索引
  "heading_level": 1
}
```

#### 统一搜索端点

```python
# POST /api/v1/search
{
  "query": "Vue",
  "mode": "hybrid",              # vector | keyword | hybrid
  "scope": "all",                # all | memory | code | backlog
  "types": ["memory", "atom"],   # 可选过滤
  "atom_types": ["chapter", "function"],  # 可选：只搜特定 atom 类型
  "limit": 20,
  "level": 1,                    # 0=abstract, 1=overview, 2=full
  "tenant_id": "default"
}

# 响应
{
  "results": [
    {
      "type": "entity",
      "id": "entity_01HQ...",
      "entity_type": "memory",
      "abstract": "Vue 3 最佳实践",
      "score": 0.95
    },
    {
      "type": "atom",
      "local_id": "01A1B2C3D4...",
      "atom_id": "atom:xxx",
      "atom_type": "chapter",
      "name": "Composition API",
      "entity_id": "entity_01HQ...",
      "score": 0.88
    }
  ],
  "total": 15,
  "mode": "hybrid",
  "query": "Vue"
}
```

### 2.2 插件端 API

#### memory_write（支持 Atom 树）

```javascript
memory_write({
  // L0/L1（Entity 级）
  abstract: "Vue 3 最佳实践",
  overview: { chapters: 3, topics: ["Composition", "Performance"] },

  // L2（Atom 树）
  atoms: [
    {
      type: "chapter",
      name: "Composition API",
      content: "setup() 函数...",
      tags: ["setup"],
      order: "a0",
      heading_level: 1,
      parent_id: null,
      children: [
        {
          type: "section",
          name: "1.1 Reactive State",
          content: "ref() 和 reactive()...",
          order: "a0",
          heading_level: 2,
          parent_id: "01PARENT...",
          children: []
        }
      ]
    }
  ],

  type: "memory",
  tags: ["vue", "patterns"]
});
```

#### memory_read（扩展版）

```javascript
// 场景 1：读取 Entity L0（快速扫描）
memory_read({ entry_id: "entity_01HQ...", level: 0 });
// 返回：{ type: "entity", id: "...", abstract: "..." }

// 场景 2：读取 Entity L1（概览浏览）
memory_read({ entry_id: "entity_01HQ...", level: 1 });
// 返回：{ type: "entity", id: "...", abstract: "...", overview: {...} }

// 场景 3：读取 Entity L2（完整内容）
memory_read({ entry_id: "entity_01HQ...", level: 2 });
// 返回：{ type: "entity", id: "...", abstract: "...", overview: {...}, content: "..." }

// 场景 4：读取 Atom（自动检测 ID 类型）
memory_read({ entry_id: "01A1B2C3D4..." });
// 返回：{ type: "atom", local_id: "...", atom_type: "...", content: "...", ... }
```

#### update_entity（批量更新）

```javascript
update_entity({
  entry_id: "entity_01HQ...",
  entity_updates: { abstract: "新摘要" },
  atoms_batch: [
    { action: "add", local_id: "01NEW...", type: "section", name: "1.2", ... },
    { action: "update", local_id: "01EXIST...", content: "更新后的内容" },
    { action: "remove", local_id: "01DELETE...", cascade: true }
  ]
});
```

#### get_entity_atoms（获取 Atom 树）

```javascript
get_entity_atoms({
  entry_id: "entity_01HQ...",
  include_content: false  // 默认 false，只返回元数据
});
// 返回：{ entity_id: "...", total_atoms: 5, tree: [...] }
```

## 3. 文件格式

### 3.1 Entity 文件（单文件存储）

```markdown
---
id: entity_01HQ...
date: 2026-04-26T14:00:00.000Z
type: memory
abstract: Vue 3 最佳实践
overview: '{"chapters": 3, "topics": ["Composition", "Performance"]}'
tags: [vue, patterns]
---

# ≡≡≡ Abstract ≡≡≡
```

Vue 3 最佳实践

```

# ≡≡≡ Overview ≡≡≡
```

{"chapters": 3, "topics": ["Composition", "Performance"]}

````

# ≡≡≡ Atoms ≡≡≡
```json
[
  {
    "local_id": "01A1B2C3D4E5F6G7H8I9J0K1",
    "source_id": "01A1B2C3D4E5F6G7H8I9J0K1",
    "atom_id": null,
    "type": "chapter",
    "name": "Composition API",
    "content": "setup() 函数...",
    "tags": ["setup"],
    "aliases": ["Setup API"],
    "order": "a0",
    "heading_level": 1,
    "parent_id": null,
    "children": [
      {
        "local_id": "01L2M3N4O5P6Q7R8S9T0U1V2",
        "source_id": "01L2M3N4O5P6Q7R8S9T0U1V2",
        "atom_id": null,
        "type": "section",
        "name": "1.1 Reactive State",
        "content": "ref() 和 reactive()...",
        "tags": [],
        "aliases": [],
        "order": "a0",
        "heading_level": 2,
        "parent_id": "01A1B2C3D4E5F6G7H8I9J0K1",
        "children": []
      }
    ]
  }
]
```
````

```

## 4. 向后兼容性

### 4.1 兼容性策略

| 场景 | 行为 |
|------|------|
| 旧版 memory_write（无 atoms） | ✅ 完全兼容，content 作为单个 Atom 存储 |
| 旧版 memory_read | ⚠️ API 签名兼容，但返回值结构变化（新增 type 字段） |
| 旧版 link-map.json | ⚠️ 自动升级，添加 atom_count 字段 |
| 旧版文件格式 | ✅ 无需修改，新功能可选启用 |

### 4.2 Feature Flag

```json
{
  "features": {
    "useAtomArchitecture": false
  }
}
```

- 默认 `false`，渐进启用
- 新用户可默认启用
- 混合模式：旧 Entity 保持原格式，新 Entity 使用 Atom 架构
