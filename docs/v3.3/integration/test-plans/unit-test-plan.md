---
status: draft
version: 1.0.0
last_updated: 2026-05-01
owner: Atlas
traceability:
  - DESIGN-INTEGRATION.md §二 (工具层修复)
  - ATOM-ARCHITECTURE.md §5.2 (API 设计)
  - ATOM-ARCHITECTURE.md §8 (关键算法)
---

# 单元测试计划

> **范围**: `lib/atom-tree.js`, `lib/memory-core.js` 中的原子函数  
> **目标**: 验证每个函数在隔离环境下的输入输出正确性  
> **框架**: Jest (`tests/unit/atoms/`)

---

## 1. `detectCircularReference()`

**文件**: `lib/atom-tree.js:88`  
**追溯**: ATOM-ARCHITECTURE.md §8.1 — 三色 DFS 循环检测

### 1.1 测试用例

| # | 用例名 | 输入 | 预期输出 | 边界条件 |
|---|--------|------|----------|----------|
| 1.1 | 无环链（线性） | `[{local_id:"A",parent_id:null},{local_id:"B",parent_id:"A"},{local_id:"C",parent_id:"B"}]` | `{hasCycle:false,path:[]}` | — |
| 1.2 | 无环树（多子节点） | `[{local_id:"R",parent_id:null},{local_id:"C1",parent_id:"R"},{local_id:"C2",parent_id:"R"}]` | `{hasCycle:false,path:[]}` | — |
| 1.3 | 自环（A→A） | `[{local_id:"A",parent_id:"A"}]` | `{hasCycle:true,path:["A","A"]}` | 单节点自引用 |
| 1.4 | 双节点环（A→B→A） | `[{local_id:"A",parent_id:"B"},{local_id:"B",parent_id:"A"}]` | `{hasCycle:true,path:["A","B","A"]}` | 最小环 |
| 1.5 | 三节点环（A→B→C→A） | `[{local_id:"A",parent_id:"C"},{local_id:"B",parent_id:"A"},{local_id:"C",parent_id:"B"}]` | `{hasCycle:true,path:["A","C","B","A"]}` | — |
| 1.6 | 混合（树+环） | `[{local_id:"R",parent_id:null},{local_id:"A",parent_id:"R"},{local_id:"B",parent_id:"A"},{local_id:"C",parent_id:"B"},{local_id:"D",parent_id:"C"}]` 其中 C.parent_id 改为 "A" | `{hasCycle:true,path:["A","C","A"]}` 或等效路径 | 环路在子树内部 |
| 1.7 | 空数组 | `[]` | `{hasCycle:false,path:[]}` | 空输入 |
| 1.8 | 单根节点 | `[{local_id:"A",parent_id:null}]` | `{hasCycle:false,path:[]}` | 最小合法输入 |
| 1.9 | 悬挂引用（parent_id 指向不存在的节点） | `[{local_id:"A",parent_id:"MISSING"},{local_id:"B",parent_id:null}]` | `{hasCycle:false,path:[]}` | dangling ref 不算环 |
| 1.10 | 森林（多个根节点） | `[{local_id:"A",parent_id:null},{local_id:"B",parent_id:null},{local_id:"C",parent_id:"A"}]` | `{hasCycle:false,path:[]}` | 多个独立树 |

### 1.2 自动化脚本

```javascript
// tests/unit/atoms/detect-circular-reference.test.js
import { detectCircularReference } from '../../../lib/atom-tree.js';

describe('detectCircularReference', () => {
  test.each([
    // [用例名, atoms 输入, 预期 hasCycle, 预期 path 长度>0]
    ['无环链', [
      { local_id: 'A', parent_id: null },
      { local_id: 'B', parent_id: 'A' },
      { local_id: 'C', parent_id: 'B' },
    ], false, false],
    ['自环', [{ local_id: 'A', parent_id: 'A' }], true, true],
    ['双节点环', [
      { local_id: 'A', parent_id: 'B' },
      { local_id: 'B', parent_id: 'A' },
    ], true, true],
    ['空数组', [], false, false],
    ['悬挂引用', [
      { local_id: 'A', parent_id: 'MISSING' },
      { local_id: 'B', parent_id: null },
    ], false, false],
  ])('%s', (_, atoms, expectedCycle, expectedPathLength) => {
    const result = detectCircularReference(atoms);
    expect(result.hasCycle).toBe(expectedCycle);
    expect(result.path.length > 0).toBe(expectedPathLength);
  });
});
```

---

## 2. `buildAtomTree()`

**文件**: `lib/atom-tree.js:13`  
**追溯**: ATOM-ARCHITECTURE.md §5.2 — O(n) 树重建算法

### 2.1 测试用例

| # | 用例名 | 输入 | 预期输出 | 边界条件 |
|---|--------|------|----------|----------|
| 2.1 | 空列表 | `[]` | `[]` | 空输入 |
| 2.2 | 单根节点（无子节点） | `[{local_id:"A",parent_id:null,name:"Root",content:"data",order:"a0",heading_level:1}]` | `[{local_id:"A",name:"Root",content:"data",order:"a0",heading_level:1,children:[]}]` | 最小树 |
| 2.3 | 扁平列表（全部无 parent） | `[{local_id:"A",parent_id:null,order:"a1"},{local_id:"B",parent_id:null,order:"a0"}]` | `[{local_id:"B",...children:[]},{local_id:"A",...children:[]}]` | 按 order 排序 |
| 2.4 | 两层嵌套 | `[{local_id:"P",parent_id:null},{local_id:"C",parent_id:"P"}]` | `[{local_id:"P",children:[{local_id:"C",children:[]}]}]` | — |
| 2.5 | 三层嵌套 | `[{local_id:"G",parent_id:null},{local_id:"P",parent_id:"G"},{local_id:"C",parent_id:"P"}]` | `[{local_id:"G",children:[{local_id:"P",children:[{local_id:"C",children:[]}]}]}]` | 深度递归 |
| 2.6 | 多子节点排序 | `[{local_id:"P",parent_id:null},{local_id:"C2",parent_id:"P",order:"a1"},{local_id:"C1",parent_id:"P",order:"a0"},{local_id:"C3",parent_id:"P",order:"a2"}]` | 根节点 children 顺序: `[C1, C2, C3]` | order 排序验证 |
| 2.7 | 悬挂引用（parent 指向不存在的节点） | `[{local_id:"A",parent_id:"MISSING"},{local_id:"B",parent_id:null}]` | `[{local_id:"A",children:[]},{local_id:"B",children:[]}]` | A 降级为根 |
| 2.8 | `includeContent=false` | `[{local_id:"A",parent_id:null,content:"secret",order:"a0"}]` + `includeContent=false` | `[{local_id:"A",content:undefined,children:[]}]` | content 被剥离 |
| 2.9 | 大规模（100 节点） | 生成 100 个扁平节点，parent_id=null | 返回 100 个根节点，按 order 排序 | 性能边界 |
| 2.10 | 森林（2 棵独立树） | `[{local_id:"R1",parent_id:null},{local_id:"C1",parent_id:"R1"},{local_id:"R2",parent_id:null}]` | 2 个根节点，R1 含 C1 | 多棵树 |

---

## 3. `flattenAtomTree()`

**文件**: `lib/atom-tree.js:63`  
**追溯**: ATOM-ARCHITECTURE.md §5.2 — 树扁平化传输

### 3.1 测试用例

| # | 用例名 | 输入 | 预期输出 | 边界条件 |
|---|--------|------|----------|----------|
| 3.1 | 空树 | `[]` | `[]` | 空输入 |
| 3.2 | 单节点（无子节点） | `[{local_id:"A",parent_id:null,name:"X"}]` | `[{local_id:"A",parent_id:null,name:"X"}]` | parent_id 默认为传入的 parentLocalId |
| 3.3 | 两层树 | `[{local_id:"P",name:"Parent",children:[{local_id:"C",name:"Child",children:[]}]}]` | `[{local_id:"P",parent_id:null,name:"Parent"},{local_id:"C",parent_id:"P",name:"Child"}]` | children 被移除，parent_id 正确设置 |
| 3.4 | 三层树 | 根 → 子 → 孙 | 3 个扁平节点，parent_id 逐级正确 | 深度递归 |
| 3.5 | 多子节点 | 根含 3 个子节点 | 4 个扁平节点（1 根 + 3 子），parent_id 全部指向根 | 扁平化后无 children 字段 |
| 3.6 | 传入 parentLocalId 参数 | `[{local_id:"A"}]` + `parentLocalId="ROOT"` | `[{local_id:"A",parent_id:"ROOT"}]` | 外部指定父 ID |
| 3.7 | 节点包含额外属性 | `[{local_id:"A",tags:["t1"],order:"a0",heading_level:2,children:[]}]` | `[{local_id:"A",tags:["t1"],order:"a0",heading_level:2}]` | 额外属性保留，children 移除 |
| 3.8 | 往返一致性 | 树 → flatten → build → 与原树比较 | 结构一致 | flatten + build 可逆 |

---

## 4. `extractWikiLinks()`

**文件**: `lib/atom-tree.js:226`  
**追溯**: ATOM-ARCHITECTURE.md §7.2 — 双向链接解析

### 4.1 测试用例

| # | 用例名 | 输入 content | 预期输出 | 边界条件 |
|---|--------|-------------|----------|----------|
| 4.1 | 无链接 | `"Hello world"` | `[]` | 空结果 |
| 4.2 | 单个普通链接 | `"参见 [[01ABC123]] 的说明"` | `[{target:"01ABC123",label:"01ABC123",isEmbed:false}]` | — |
| 4.3 | 带标签的链接 | `"参见 [[01ABC123\|Performance 章节]]"` | `[{target:"01ABC123",label:"Performance 章节",isEmbed:false}]` | label 使用竖线后文本 |
| 4.4 | 嵌入链接 | `"示例: ![[01XYZ789\|代码片段]]"` | `[{target:"01XYZ789",label:"代码片段",isEmbed:true}]` | isEmbed=true |
| 4.5 | 多个链接 | `"A [[01A]] 和 B [[01B\|Label B]] 以及 ![[01C]]"` | 3 个链接，第 3 个 isEmbed=true | 混合链接 |
| 4.6 | 相邻链接无空格 | `"[[01A]][[01B]]"` | 2 个链接 | 紧邻解析 |
| 4.7 | 空内容 | `""` | `[]` | 空字符串 |
| 4.8 | 链接在代码块内 | `"```[[01A]]```"` | `[{target:"01A",...}]` | 当前实现不区分代码块 |
| 4.9 | ULID 格式链接 | `"[[01HQ51SKMAWH0JWYV7KBNM7H1Z]]"` | `[{target:"01HQ51SKMAWH0JWYV7KBNM7H1Z",label:"01HQ51SKMAWH0JWYV7KBNM7H1Z",isEmbed:false}]` | 真实 ULID 长度 |
| 4.10 | 带空格的标签 | `"[[01A\|My Custom Label]]"` | `[{target:"01A",label:"My Custom Label",isEmbed:false}]` | 标签含空格 |

---

## 5. `findIncomingLinks()`

**文件**: `lib/memory-core.js:509`  
**追溯**: ATOM-ARCHITECTURE.md §7.2 — 反向链接查询

### 5.1 测试用例

| # | 用例名 | 输入 allAtoms | 目标 targetLocalId | 预期输出 | 边界条件 |
|---|--------|---------------|-------------------|----------|----------|
| 5.1 | 无反向链接 | `[{local_id:"A",content:"no links"}]` | `"MISSING"` | `[]` | 目标不存在 |
| 5.2 | 单个反向链接 | `[{local_id:"A",content:"see [[TARGET]]"},{local_id:"TARGET",content:"target"}]` | `"TARGET"` | `[{source:"A",label:"TARGET",isEmbed:false}]` | — |
| 5.3 | 多个来源指向同一目标 | 3 个 Atom 的 content 都包含 `[[TARGET]]` | `"TARGET"` | 3 个结果 | 聚合多个来源 |
| 5.4 | 带标签的反向链接 | `[{local_id:"A",content:"see [[TARGET\|My Label]]"}]` | `"TARGET"` | `[{source:"A",label:"My Label",isEmbed:false}]` | label 正确传递 |
| 5.5 | 嵌入链接也计为反向 | `[{local_id:"A",content:"![[TARGET]]"}]` | `"TARGET"` | `[{source:"A",label:"TARGET",isEmbed:true}]` | isEmbed=true |
| 5.6 | 自引用不计为反向 | `[{local_id:"A",content:"[[A]] self ref"}]` | `"A"` | `[{source:"A",label:"A",isEmbed:false}]` | 当前实现不排除自引用 |
| 5.7 | 空原子列表 | `[]` | `"ANY"` | `[]` | 空输入 |
| 5.8 | 部分原子包含目标 | 3 个 Atom 中只有 1 个包含目标链接 | `"TARGET"` | 1 个结果 | 过滤正确 |

---

## 6. Atom 移除（在 `updateEntity` 内）

**文件**: `lib/memory-core.js` (`updateEntity` 函数)  
**追溯**: ATOM-ARCHITECTURE.md §5.2 — `update_entity` 的 remove action

> 注意：Atom 移除不是独立函数，而是 `updateEntity` 内 `atoms_batch` 的 `remove` action。测试通过 `entity_update` 工具间接验证。

### 6.1 测试用例

| # | 用例名 | 初始状态 | atoms_batch 操作 | 预期结果 | 边界条件 |
|---|--------|----------|-----------------|----------|----------|
| 6.1 | 删除叶子节点 | 树: R → C（叶子） | `[{action:"remove",local_id:"C"}]` | R.children=[], C 不在 atoms 中 | 最简单删除 |
| 6.2 | 删除非叶子（无 cascade） | 树: R → P → C | `[{action:"remove",local_id:"P",cascade:false}]` | P 被删除，C 的 parent_id 指向已删除的 P（悬挂） | 不级联 |
| 6.3 | 删除非叶子（cascade=true） | 树: R → P → [C1, C2] | `[{action:"remove",local_id:"P",cascade:true}]` | P、C1、C2 全部删除 | 级联删除 |
| 6.4 | 删除根节点（cascade=true） | 树: R → [C1, C2] | `[{action:"remove",local_id:"R",cascade:true}]` | 所有节点删除 | 整棵树删除 |
| 6.5 | 删除不存在的 Atom | 树: R | `[{action:"remove",local_id:"MISSING"}]` | 返回错误或跳过 | 错误处理 |
| 6.6 | 删除后循环检测通过 | 树: R → A, R → B（A,B 无环） | 删除 A 后检测 B | 无环 | 删除不影响剩余结构 |
| 6.7 | 批量删除（混合操作） | 树: R → [A, B, C] | `[{action:"remove",local_id:"A"},{action:"remove",local_id:"B"}]` | 只剩 R → C | 按序执行 |
| 6.8 | 深度级联（4 层） | R → L1 → L2 → L3 → L4 | 删除 L1 (cascade=true) | L1, L2, L3, L4 全部删除 | 深度级联 |

---

## 7. `detectDanglingReferences()`

**文件**: `lib/atom-tree.js:252`  
**追溯**: ATOM-ARCHITECTURE.md §9 — 悬挂引用处理

### 7.1 测试用例

| # | 用例名 | 输入 | 预期输出 | 边界条件 |
|---|--------|------|----------|----------|
| 7.1 | 无悬挂引用 | 所有 parent_id 都有效 | `[]` | — |
| 7.2 | 单个悬挂引用 | A.parent_id="MISSING" | `["A"]` 或 `[{local_id:"A",parent_id:"MISSING"}]` | — |
| 7.3 | 多个悬挂引用 | 3 个 Atom 的 parent_id 都无效 | 3 个结果 | — |
| 7.4 | 部分有效部分悬挂 | A.parent_id=null（有效）, B.parent_id="MISSING" | 只有 B | 混合场景 |
| 7.5 | 空列表 | `[]` | `[]` | 空输入 |

---

## 8. `generateFractionalIndex()`

**文件**: `lib/atom-tree.js:150`  
**追溯**: ATOM-ARCHITECTURE.md §8.2 — 分数索引生成

### 8.1 测试用例

| # | 用例名 | prevIndex | nextIndex | 预期输出 | 边界条件 |
|---|--------|-----------|-----------|----------|----------|
| 8.1 | 首个索引 | `null` | `null` | `"a0"` | 初始位置 |
| 8.2 | 插入到开头前 | `null` | `"a0"` | 介于 null 和 "a0" 之间的值 | 前置插入 |
| 8.3 | 插入到末尾后 | `"a0"` | `null` | 介于 "a0" 和 null 之间的值 | 后置插入 |
| 8.4 | 两个相邻之间 | `"a0"` | `"a1"` | `"aV"` 或等效中间值 | 典型中间插入 |
| 8.5 | 密集区域插入 | `"aV"` | `"aW"` | 中间值 | 分数索引精度 |
| 8.6 | 相同值（冲突） | `"a0"` | `"a0"` | 不等于 "a0" 的值 | 避免重复 |
| 8.7 | 已有 62 个子节点后再插入 | `"a0"` ~ `"a9","aA"`~`"aZ","aa"`~`"az"` | 中间值 | base-62 溢出处理 |

---

## 测试覆盖率矩阵

| 函数 | 文件位置 | 正常 | 边界 | 错误 | 性能 | 总用例 |
|------|----------|------|------|------|------|--------|
| `detectCircularReference` | atom-tree.js:88 | 4 | 3 | 2 | 1 | 10 |
| `buildAtomTree` | atom-tree.js:13 | 4 | 3 | 2 | 1 | 10 |
| `flattenAtomTree` | atom-tree.js:63 | 3 | 2 | 1 | 2 | 8 |
| `extractWikiLinks` | atom-tree.js:226 | 4 | 3 | 2 | 1 | 10 |
| `findIncomingLinks` | memory-core.js:509 | 3 | 3 | 1 | 1 | 8 |
| Atom 移除 (remove action) | memory-core.js | 3 | 3 | 1 | 1 | 8 |
| `detectDanglingReferences` | atom-tree.js:252 | 2 | 2 | 1 | 0 | 5 |
| `generateFractionalIndex` | atom-tree.js:150 | 3 | 2 | 1 | 1 | 7 |
| **合计** | | **26** | **21** | **11** | **8** | **66** |

---

## 执行命令

```bash
# 运行所有原子单元测试
node --experimental-vm-modules node_modules/.bin/jest tests/unit/atoms/ -v

# 运行单个函数测试
node --experimental-vm-modules node_modules/.bin/jest tests/unit/atoms/detect-circular-reference.test.js -v

# 运行并生成覆盖率
node --experimental-vm-modules node_modules/.bin/jest tests/unit/atoms/ --coverage
```

---

**维护者**: Atlas (执行者智能体)  
**更新频率**: 每次代码变更后
