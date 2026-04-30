# v3.3 Atom 架构技术设计

## 1. 存储结构（内嵌树模型）

### 1.1 目录结构

```
timeline/2026/04/26/
└── entry_01HQ....md                    # 单个文件（Entity + Atom 树）
```

### 1.2 为什么选择内嵌树模型？

| 优势 | 说明 |
|------|------|
| **写入原子性** | `atomicWriteText` 保证 Entity + Atoms 一致写入 |
| **并发安全** | 单文件锁足够，无多文件竞争 |
| **读取性能** | 1 次 I/O 读取全部，O(1) 文件操作 |
| **数据一致性** | 天然一致，无 Entity-Atom 同步问题 |
| **备份简单** | 复制单个文件即可 |
| **incoming_links** | 单文件内解析 O(n)，无需全量扫描 |

### 1.3 权衡

- 单文件 ≤100KB（已有约束，纯文本约 5 万汉字）
- 超大知识需拆分为多个 Entity

## 2. 关键算法

### 2.1 循环引用检测（三色 DFS）

```javascript
function detectCircularReference(atoms) {
  const graph = new Map();  // local_id → parent_local_id
  const color = new Map();
  const WHITE = 0, GRAY = 1, BLACK = 2;

  // 构建图
  for (const atom of atoms) {
    graph.set(atom.local_id, atom.parent_id);
    color.set(atom.local_id, WHITE);
  }

  function dfs(localId, currentPath) {
    color.set(localId, GRAY);
    currentPath.push(localId);

    const pid = graph.get(localId);

    if (pid && color.has(pid)) {
      if (color.get(pid) === GRAY) {
        // 发现环，返回路径
        const cycleStart = currentPath.indexOf(pid);
        return [...currentPath.slice(cycleStart), pid];
      }
      if (color.get(pid) === WHITE) {
        const result = dfs(pid, currentPath);
        if (result) return result;
      }
    }

    color.set(localId, BLACK);
    currentPath.pop();
    return null;
  }

  for (const localId of graph.keys()) {
    if (color.get(localId) === WHITE) {
      const cycle = dfs(localId, []);
      if (cycle) {
        return { hasCycle: true, path: cycle };
      }
    }
  }

  return { hasCycle: false, path: [] };
}
```

**复杂度**: O(n) 时间，O(n) 空间

### 2.2 分数索引生成

```javascript
function generateFractionalIndex(prevIndex = null, nextIndex = null) {
  // 在 prev 和 next 之间生成新的分数索引
  // 使用 base-62 编码（a-z, A-Z, 0-9）

  if (!prevIndex && !nextIndex) return "a0";
  if (!prevIndex) return decrementIndex(nextIndex);
  if (!nextIndex) return incrementIndex(prevIndex);

  return midIndex(prevIndex, nextIndex);
}

// 简化实现：使用字符串比较
function midIndex(a, b) {
  // 在 "a0" 和 "a1" 之间生成 "aV"
  // 实际实现需要 base-62 算术
  return "aV"; // 占位
}
```

**为什么用分数索引？**

```javascript
// 整数 order 的问题：插入需要重排
order: (1, 2, 3);
// 在 2 和 3 之间插入 → 需要把 3→4, 4→5...

// 分数索引：插入不需重排
order: ("a0", "a1", "aV", "aG0");
// 在 "a0" 和 "a1" 之间插入 → "aV"（自动计算）
```

### 2.3 树重建算法（O(n)）

```javascript
function buildAtomTree(atoms, includeContent) {
  const map = new Map();
  const roots = [];

  // 第一遍：创建节点映射
  for (const atom of atoms) {
    map.set(atom.local_id, {
      ...atom,
      content: includeContent ? atom.content : undefined,
      children: [],
    });
  }

  // 第二遍：建立父子关系
  for (const atom of atoms) {
    const node = map.get(atom.local_id);
    if (!atom.parent_id) {
      roots.push(node);
    } else {
      const parent = map.get(atom.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node); // 悬挂引用降级为根
      }
    }
  }

  // 按 order 排序
  const sortByOrder = (nodes) => {
    nodes.sort((a, b) => a.order.localeCompare(b.order));
    nodes.forEach((n) => sortByOrder(n.children));
  };
  sortByOrder(roots);

  return roots;
}
```

### 2.4 树扁平化传输

```javascript
function flattenAtomTree(tree, parentLocalId = null, result = []) {
  for (let i = 0; i < tree.length; i++) {
    const node = tree[i];
    const { children, ...nodeWithoutChildren } = node;

    const flatNode = {
      ...nodeWithoutChildren,
      parent_local_id: parentLocalId,
      children: undefined,
    };
    result.push(flatNode);

    if (children && children.length > 0) {
      flattenAtomTree(children, node.local_id, result);
    }
  }
  return result;
}
```

## 3. 双向链接处理

### 3.1 存储格式

```markdown
# Atom content 中的链接（使用 local_id）
setup() 函数参见 [[01I9J0K1L2...|Performance 章节]] 的优化技巧。

# 嵌入其他 Atom
![[01X1Y2Z3W4...|示例代码]]
```

**注意**：Wiki 链接使用 Atom 的 `local_id`（纯 ULID），不是 `atom_id`。

### 3.2 解析与缓存

```javascript
// 写入时：提取 outgoing_refs
function extractWikiLinks(content) {
  const regex = /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const links = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({
      target: match[1],
      label: match[2] || match[1],
      isEmbed: match[0].startsWith("!"),
    });
  }
  return links;
}

// 读取时：查询 incoming_refs（单文件内）
function findIncomingLinks(allAtoms, targetLocalId) {
  const incoming = [];
  for (const atom of allAtoms) {
    const links = extractWikiLinks(atom.content);
    for (const link of links) {
      if (link.target === targetLocalId) {
        incoming.push({
          source: atom.local_id,
          label: link.label,
          isEmbed: link.isEmbed,
        });
      }
    }
  }
  return incoming;
}
```

**优势**：
- 纯文本存储，Obsidian 兼容
- 单文件内查询，O(n) 复杂度
- 无外部索引，无同步问题

## 4. 实现逻辑

### 4.1 memory_read 实现

```javascript
async function memory_read({ entry_id, level = 2 }) {
  // 1. 检测 ID 类型（通过查找 Entity 文件中的 atoms 判断）
  const entity = await findEntityByAtomId(entry_id);
  const isAtom = entity && findAtomInTree(entity.atoms, entry_id);

  if (isAtom) {
    // 读取 Atom
    const atom = findAtomInTree(entity.atoms, entry_id);
    const links = extractWikiLinks(atom.content);
    const incoming = findIncomingLinks(entity.atoms, entry_id);

    return {
      type: "atom",
      local_id: atom.local_id,
      atom_id: atom.atom_id,
      entity_id: entity.id,
      atom_type: atom.type,
      name: atom.name,
      content: atom.content,
      parent_local_id: atom.parent_id,
      order: atom.order,
      heading_level: atom.heading_level,
      tags: atom.tags,
      aliases: atom.aliases,
      outgoing_links: links,
      incoming_links: incoming,
    };
  } else {
    // 读取 Entity
    const entity = await readEntityFile(entry_id);

    switch (level) {
      case 0:
        return {
          type: "entity",
          id: entity.id,
          abstract: entity.abstract,
        };

      case 1:
        return {
          type: "entity",
          id: entity.id,
          abstract: entity.abstract,
          overview: entity.overview,
        };

      case 2:
        // 合成 content：包含 Atom local_id 的完整文本
        const content = synthesizeContentWithAtomIds(entity);
        return {
          type: "entity",
          id: entity.id,
          abstract: entity.abstract,
          overview: entity.overview,
          content,
        };
    }
  }
}
```

### 4.2 update_entity 实现（事务性）

```javascript
async function update_entity({ entry_id, entity_updates, atoms_batch }) {
  // 1. 读取现有 Entity
  const entity = await readEntityFile(entry_id);

  // 2. 创建深拷贝，在副本上执行所有操作
  const entityCopy = JSON.parse(JSON.stringify(entity));

  // 3. 验证 atoms_batch
  validateAtomsBatch(entityCopy, atoms_batch);

  // 4. 按顺序执行 atoms_batch
  const results = [];
  try {
    for (const op of atoms_batch || []) {
      switch (op.action) {
        case "add":
          // 新增 Atom
          const newAtom = {
            local_id: op.local_id,
            source_id: op.source_id || op.local_id,
            atom_id: null,
            type: op.type,
            name: op.name,
            content: op.content,
            parent_id: op.parent_local_id || null,
            order: op.order,
            heading_level: calculateHeadingLevel(entityCopy.atoms, op.parent_local_id),
            tags: op.tags || [],
            aliases: op.aliases || [],
          };
          entityCopy.atoms.push(newAtom);
          results.push({ action: "add", local_id: op.local_id, atom_id: null, success: true });
          break;

        case "update":
          // 更新 Atom
          const atomToUpdate = entityCopy.atoms.find(a => a.local_id === op.local_id);
          if (!atomToUpdate) throw new Error(`Atom ${op.local_id} not found`);

          if (op.content !== undefined) atomToUpdate.content = op.content;
          if (op.name !== undefined) atomToUpdate.name = op.name;
          if (op.type !== undefined) atomToUpdate.type = op.type;
          if (op.parent_local_id !== undefined) {
            atomToUpdate.parent_id = op.parent_local_id;
            atomToUpdate.heading_level = calculateHeadingLevel(entityCopy.atoms, op.parent_local_id);
          }
          if (op.order !== undefined) atomToUpdate.order = op.order;
          if (op.tags !== undefined) atomToUpdate.tags = op.tags;
          if (op.aliases !== undefined) atomToUpdate.aliases = op.aliases;

          results.push({ action: "update", local_id: op.local_id, success: true });
          break;

        case "remove":
          // 删除 Atom（级联）
          const toRemove = [op.local_id];
          if (op.cascade) {
            const children = findAllChildren(entityCopy.atoms, op.local_id);
            toRemove.push(...children.map(c => c.local_id));
          }

          entityCopy.atoms = entityCopy.atoms.filter(a => !toRemove.includes(a.local_id));
          results.push({ action: "remove", local_id: op.local_id, removed_count: toRemove.length, success: true });
          break;
      }
    }

    // 5. 更新 Entity 属性
    if (entity_updates) {
      Object.assign(entityCopy, entity_updates);
    }

    // 6. 检测循环引用
    if (atoms_batch) {
      const cycleCheck = detectCircularReference(entityCopy.atoms);
      if (cycleCheck.hasCycle) {
        throw new Error(`Circular reference detected: ${cycleCheck.path.join(' -> ')}`);
      }
    }

    // 7. 所有操作成功，合并到原始 entity
    Object.assign(entity, entityCopy);

    // 8. 保存 Entity 文件（原子写入）
    await writeEntityFile(entry_id, entity);

    // 9. 同步到后端（异步）
    syncEntityToBackend(entity);

    return {
      success: true,
      entity_id: entry_id,
      atoms_result: results,
    };
  } catch (error) {
    // 任一操作失败，全部回滚
    return {
      success: false,
      entity_id: entry_id,
      error: error.message,
      atoms_result: results,
    };
  }
}
```

## 5. 风险缓解

### 5.1 风险矩阵

| 风险 | 等级 | 说明 | 缓解措施 |
|------|------|------|----------|
| **单文件大小超限** | 🟡 中 | > 100KB 限制 | 拆分为多个 Entity，或使用 namespace 组织 |
| **循环 parent_id** | 🔴 高 | A→B→A 循环引用 | 三色 DFS 检测，拒绝写入 |
| **悬挂 parent_id** | 🟡 中 | parent_id 指向不存在 Atom | 降级为根级，记录警告 |
| **分数索引冲突** | 🟢 低 | 两个 Atom 相同 order | 保存时验证唯一性 |
| **并发写入** | 🟢 低 | 多进程同时写入 | `atomicWriteText` + `withLinkMapLock` 足够 |
| **链接失效** | 🟡 中 | [[target]] 指向已删除 Atom | 读取时标记 dead link，不报错 |

### 5.2 link-map.json 扩展

```json
{
  "version": "3.3.0",
  "entries": {
    "entity_01HQ...": {
      "id": "entity_01HQ...",
      "path": "timeline/2026/04/26/entry_01HQ....md",
      "abstract": "Vue 3 最佳实践",
      "type": "memory",
      "atom_count": 5,
      "tags": ["vue", "patterns"],
      "pinned": false,
      "synced": false,
      "memory_id": null,
      "entity_id": "entity_01HQ..."
    }
  }
}
```

**注意**：不缓存 Atom 列表（避免同步问题），直接从 Entity 文件读取。

## 6. 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| **存储模型** | **内嵌树模型** | 单文件原子写入，无并发问题，性能好 |
| **Atom ID** | ULID | 稳定，与内容/位置无关 |
| **排序** | 分数索引（字符串） | 插入不需重排 |
| **双向链接** | MD 纯文本 [[链接]] | Obsidian 兼容，单文件内查询 |
| **循环检测** | 三色 DFS | 正确性保证 |
| **悬挂引用** | 降级为根级 | 容错，不阻塞写入 |
