# 统一架构 v2.0 设计方案

> **版本**: v2.0.0  
> **日期**: 2026-04-09  
> **状态**: 草案/待细化  
> **作者**: OpenCode Agent

---

## 目录

1. [核心洞察](#1-核心洞察)
2. [统一架构：四层模型](#2-统一架构四层模型)
3. [数据模型](#3-数据模型)
4. [关键整合点](#4-关键整合点)
5. [代码分析重构方案](#5-代码分析重构方案)
6. [API 设计](#6-api-设计)
7. [实施路径](#7-实施路径)
8. [向后兼容](#8-向后兼容)
9. [核心价值](#9-核心价值)
10. [参考文档](#10-参考文档)

---

## 1. 核心洞察

通过深度分析代码分析功能、BACKLOG API、原子级记忆和 Wiki/Obsidian，发现了**三个关键问题**和**一个统一解决方案**：

### 1.1 问题 1：代码分析的存储困境

**现状**：整个文件作为一个 memory，analysisResult 嵌套在 metadata 中

```javascript
// 当前代码分析的记忆存储格式
const memoryItem = {
  type: 'code',
  content: '完整代码内容',
  metadata: {
    code_analysis: {
      functions: [...],  // ❌ 无法单独检索
      calls: [...]       // ❌ 无法建立关系
    }
  }
};
```

**后果**：

- ❌ 无法搜索"哪个文件包含 analyzeCode 函数"
- ❌ 无法查询"analyzeCode 调用了哪些函数"
- ❌ 无法更新单个函数的信息
- ❌ 函数之间的关系无法建立

### 1.2 问题 2：记忆系统的更新困境

**现状**：文档级存储，混合内容无法部分更新

```markdown
# 混合内容，无法部分更新

- CHANGELOG 更新需求
- BACKLOG 更新需求 ← 只想更新这个
- API 文档更新需求
```

**后果**：

- 更新 = 创建新条目
- 内容重复和版本碎片化
- 检索时返回多个相关但部分过时的条目

### 1.3 问题 3：功能割裂

- 代码分析、BACKLOG、Wiki、记忆系统各自独立
- 无法建立跨系统的关联
- 数据孤岛，无法形成知识网络

---

## 2. 统一架构：四层模型

```
┌─────────────────────────────────────────────────────────────────┐
│                    表示层 (Presentation)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Markdown  │  │   Wiki/MD   │  │    Obsidian Vault   │   │
│  │  (人类可读)  │  │  (双向链接)  │  │    (本地编辑)        │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │  Code View  │  │  Code Graph │  │   IDE Integration   │   │
│  │  (代码浏览)  │  │  (代码图谱)  │  │   (VSCode/JetBrains)│   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    原子层 (Atomic Layer)                       │
│                                                                  │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│   │  Goal   │  │  Scope  │  │  Task   │  │  Note   │         │
│   │ (目标)  │  │ (范围)  │  │ (任务)  │  │ (笔记)  │         │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│   │Function │  │  Class  │  │Interface│  │ Import  │         │
│   │ (函数)  │  │  (类)   │  │ (接口)  │  │ (导入)  │         │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘         │
│        └─────────────┴─────────────┴────────────┘              │
│                       │                                          │
│              ┌────────┴────────┐                               │
│              │  Atom Relations  │                               │
│              │  (原子间关系)     │                               │
│              │  • depends_on    │                               │
│              │  • blocks        │                               │
│              │  • calls         │  ← 代码调用                   │
│              │  • imports       │  ← 代码导入                   │
│              │  • implements    │  ← 代码实现任务               │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  实体层 (Entity Layer)                         │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │  Memory  │  │  Backlog │  │   Wiki   │  │   Code   │     │
│   │  (记忆)  │  │  (任务)  │  │  (页面)  │  │  (代码)  │     │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│        └──────────────┼──────────────┴────────────┘            │
│                       │                                          │
│              ┌────────┴────────┐                               │
│              │  Entity Graph    │                               │
│              │  (实体关系图)     │                               │
│              │  • wiki_link     │                               │
│              │  • implements    │  ← 代码实现任务               │
│              │  • relates_to    │                               │
│              │  • part_of       │                               │
│              └─────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   存储层 (Storage Layer)                       │
│                                                                  │
│   ┌─────────────────┐    ┌─────────────────┐                  │
│   │   SurrealDB     │◄──►│   Meilisearch   │                  │
│   │  (主数据库)      │    │   (搜索索引)     │                  │
│   │                 │    │                 │                  │
│   │  • Entities     │    │  • 全文搜索      │                  │
│   │  • Atoms        │    │  • 向量搜索      │                  │
│   │  • Relations    │    │  • 过滤排序      │                  │
│   │  • Graph        │    │                 │                  │
│   └─────────────────┘    └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 核心创新

1. **Function/Class/Interface → Atom**（原子单元）
2. **Call/Import → Relation**（调用关系）
3. **文件分析结果 → Entity**（代码实体）
4. **代码 ↔ BACKLOG/Wiki → Relation**（跨系统关联）

---

## 3. 数据模型

### 3.1 Atom（原子单元）

统一所有最小知识单元。

```python
class Atom(BaseModel):
    """原子单元 - 最小知识单元"""
    id: str                    # ULID
    type: AtomType             # goal | scope | task | note
                              # | function | class | interface | import
    content: str
    status: Optional[str]      # pending | done | blocked

    # 代码特有字段
    name: Optional[str]        # 函数/类名
    signature: Optional[str]   # 函数签名
    params: Optional[List[ParamSymbol]]
    return_type: Optional[str]
    is_exported: Optional[bool]
    is_async: Optional[bool]
    complexity: Optional[int]
    max_nesting_depth: Optional[int]
    docstring: Optional[Dict]
    start_line: Optional[int]
    end_line: Optional[int]

    # 通用
    metadata: Dict[str, Any]
    version: int = 1
    created_at: datetime
    updated_at: datetime
```

### 3.2 Entity（实体）

统一所有知识实体。

```python
class Entity(BaseModel):
    """实体 - 知识实体"""
    id: str
    type: EntityType           # memory | backlog | wiki | code

    # L0/L1/L2 分层
    abstract: str              # L0: 摘要
    overview: Dict[str, Any]   # L1: 结构化概览
    atoms: List[str]           # L2: Atom ID 列表

    # Wiki 特性
    title: Optional[str]
    aliases: List[str]
    outgoing_links: List[str]  # [[Link]] 解析结果
    incoming_links: List[str]  # 反向链接

    # Backlog 特性
    priority: Optional[str]    # P0/P1/P2/P3
    status: Optional[str]      # backlog | in_progress | done
    scene: Optional[str]
    estimated_hours: Optional[float]

    # Code 特性
    file_path: Optional[str]
    language: Optional[str]
    quality_score: Optional[QualityScore]
    complexity_metrics: Optional[ComplexityMetrics]

    # 通用
    tags: List[str]
    created_at: datetime
    updated_at: datetime
```

### 3.3 Relation（关系）

统一所有关系。

```python
class Relation(BaseModel):
    """关系 - 原子/实体间关系"""
    id: str
    type: RelationType         # depends_on | blocks | relates_to
                              # | calls | imports | implements | wiki_link
    from_id: str               # Atom ID 或 Entity ID
    to_id: str                 # Atom ID 或 Entity ID

    # 代码特有
    file_path: Optional[str]
    line: Optional[int]
    column: Optional[int]

    # 通用
    weight: float = 0.5
    metadata: Dict[str, Any]
    created_at: datetime
```

---

## 4. 关键整合点

| 系统         | 整合方式                         | 价值                 |
| ------------ | -------------------------------- | -------------------- |
| **代码分析** | Function/Class 作为 Atom         | 可单独检索、更新函数 |
| **BACKLOG**  | 任务与代码通过 `implements` 关联 | 代码实现追踪         |
| **Wiki**     | 代码支持 `[[双向链接]]`          | 代码导航、图谱       |
| **记忆系统** | 统一使用 Entity + Atoms          | 原子级更新           |

### 4.1 代码 ↔ BACKLOG 集成

```javascript
// 代码实现 BACKLOG 任务
{
  id: "rel:implements-1",
  type: "implements",
  from_id: "backlog:BL-CA-17",           // 任务
  to_id: "code:src/file-watcher.ts",     // 实现代码
  metadata: {
    implemented_functions: ["onFileSaved", "debouncedAnalyze"],
    status: "completed"
  }
}
```

### 4.2 代码 ↔ Wiki 集成

```markdown
---
id: code:src/utils.ts
type: code
title: utils.ts
aliases: [工具函数]
tags: [typescript, utils]
---

# utils.ts

## 函数列表

- [[analyzeCode]] - 代码分析主函数
- [[extractSymbols]] - 提取符号
- [[calculateComplexity]] - 计算复杂度

## 依赖

- [[oxc-parser]] (外部)
- [[tree-sitter-parser.js]] (内部)

## 被引用

- [[code-analysis-service.js]]
- [[project-analyzer.js]]

## 实现的任务

- [[BL-CA-11]] 函数元数据字段
- [[BL-CA-12]] CallSymbol 提取
```

---

## 5. 代码分析重构方案

### 5.1 新方案：生成 Atoms + Relations + Entity

```javascript
// 分析 src/utils.ts 后的存储结构

// 1. CodeEntity（文件级）
{
  id: "code:src/utils.ts",
  type: "code",
  title: "utils.ts",
  abstract: "TypeScript file: src/utils.ts (5 functions, 2 classes)",
  overview: {
    language: "typescript",
    lines_of_code: 150,
    function_count: 5,
    class_count: 2,
    complexity: 8,
    quality_score: { score: 85, grade: "A", issues: [] }
  },
  atoms: [
    "atom:func-analyzeCode@code:src/utils.ts",
    "atom:func-extractSymbols@code:src/utils.ts",
    "atom:class-CodeAnalyzer@code:src/utils.ts"
  ],
  file_path: "src/utils.ts",
  language: "typescript",
  tags: ["typescript", "code-analysis", "utils"]
}

// 2. CodeAtoms（函数/类级）
{
  id: "atom:func-analyzeCode@code:src/utils.ts",
  type: "function",
  name: "analyzeCode",
  content: "async function analyzeCode(filePath, content) { ... }",
  signature: "async analyzeCode(filePath: string, content?: string): Promise<AnalysisResult>",
  params: [
    { name: "filePath", type: "string" },
    { name: "content", type: "string", optional: true }
  ],
  return_type: "Promise<AnalysisResult>",
  is_exported: true,
  is_async: true,
  complexity: 5,
  max_nesting_depth: 3,
  docstring: {
    description: "分析代码文件",
    params: [...],
    returns: { type: "AnalysisResult", description: "分析结果" }
  },
  start_line: 85,
  end_line: 125,
  parent_entity: "code:src/utils.ts"
}

// 3. CodeRelations（调用关系）
{
  id: "rel:call-1",
  type: "calls",
  from_id: "atom:func-analyzeCode@code:src/utils.ts",
  to_id: "atom:func-parseSync@code:src/parser.ts",
  file_path: "src/utils.ts",
  line: 95,
  column: 20
}
```

### 5.2 代码图谱查询

```javascript
// 查询函数调用关系
code_get_callers({
  atom_id: "atom:func-analyzeCode@code:src/utils.ts",
  depth: 2,
});
// 返回: 调用 analyzeCode 的函数列表

code_get_callees({
  atom_id: "atom:func-analyzeCode@code:src/utils.ts",
  depth: 2,
});
// 返回: analyzeCode 调用的函数列表

// 代码图谱可视化
code_graph({
  center: "code:src/utils.ts",
  depth: 2,
  include_calls: true,
  include_imports: true,
});
// 返回: 代码关系图（类似 Obsidian Graph View）
```

---

## 6. API 设计

### 6.1 原子级操作

```javascript
atom_create({ entity_id, type, content, ... })
atom_update({ atom_id, content, status, ... })
atom_delete({ atom_id })
atom_search({ query, filters, ... })
```

### 6.2 实体操作

```javascript
entity_create({ type, title, atoms, ... })
entity_update({ entity_id, ... })
entity_delete({ entity_id })
entity_search({ query, filters, ... })
```

### 6.3 关系操作

```javascript
relation_create({ type, from_id, to_id, ... })
relation_delete({ relation_id })
relation_query({ from_id, to_id, type, ... })
```

### 6.4 代码特有

```javascript
code_analyze({ file_path, ... })
code_get_callers({ atom_id, depth, ... })
code_get_callees({ atom_id, depth, ... })
code_link_to_backlog({ code_entity, backlog_id, ... })
```

### 6.5 Wiki 特有

```javascript
wiki_create({ title, content, ... })
wiki_get_links({ page_id, direction, ... })
wiki_import_obsidian({ vault_path, ... })
wiki_export_obsidian({ entity_ids, output_path, ... })
```

### 6.6 Backlog 特有

```javascript
backlog_create({ title, description, ... })
backlog_update_status({ backlog_id, status, ... })
backlog_list({ filters, ... })
```

---

## 7. 实施路径

```
Phase 1: 基础设施 (3周)
  ├─ 扩展 SurrealDB schema (atom, entity, relation 表)
  ├─ 实现统一存储层
  ├─ 向后兼容层
  └─ 数据迁移工具

Phase 2: 原子层 (2周)
  ├─ atom_create/update/delete API
  ├─ 原子关系管理
  ├─ 版本追踪
  └─ 原子级搜索

Phase 3: 代码分析重构 (2周)
  ├─ 重构 code-analysis-service
  ├─ 生成 Atoms + Relations
  ├─ 代码图谱 API
  └─ 代码↔BACKLOG 关联

Phase 4: Wiki 层 (2周)
  ├─ 双向链接解析
  ├─ 图谱可视化
  ├─ Obsidian 导入/导出
  └─ Graph View 前端

Phase 5: BACKLOG 集成 (1周)
  ├─ BacklogTask 继承 Entity
  ├─ 自动原子转换
  └─ 状态机集成

Phase 6: 迁移 (1周)
  ├─ 现有数据迁移
  ├─ 测试验证
  └─ 文档更新

总计: 11 周
```

---

## 8. 向后兼容

```javascript
// 现有 API 仍然可用（自动转换）
memory_write({
  abstract: "...",
  overview: "...",
  content: "...",
  type: "general",
});
// 内部自动转换为 Entity + Atoms

// 代码分析 API 保持不变
code_analyze({ file_path: "src/utils.ts" });
// 内部自动生成 CodeEntity + CodeAtoms + CodeRelations
```

---

## 9. 核心价值

| 问题                   | 解决方案                           |
| ---------------------- | ---------------------------------- |
| 代码分析无法原子级更新 | Function/Class/Interface 作为 Atom |
| 代码关系无法建立       | Call/Import 作为 Atom Relation     |
| 代码与任务无法关联     | implements Relation                |
| 代码与 Wiki 割裂       | Code Entity 支持双向链接           |
| 记忆系统无法部分更新   | Atom 支持独立更新                  |
| 类型不安全             | Pydantic 结构化                    |
| 与 Obsidian 隔离       | 原生 Wiki 语法支持                 |

### 9.1 关键创新

1. **统一数据模型**：Memory/Backlog/Wiki/Code 统一使用 Entity + Atoms + Relations
2. **代码原子化**：函数、类、接口作为独立 Atom，支持精确操作
3. **代码关系化**：调用、导入作为 Relation，支持图谱查询
4. **双向集成**：代码 ↔ BACKLOG、代码 ↔ Wiki 无缝关联
5. **向后兼容**：现有 API 仍然可用，平滑迁移

---

## 10. 参考文档

- [BACKLOG_API_DESIGN.md](./BACKLOG_API_DESIGN.md) - BACKLOG API 设计
- [CODE-ANALYSIS-DESIGN-v1.4.md](./CODE-ANALYSIS-DESIGN-v1.4.md) - 代码分析设计
- [API-CONTRACT.md](./API-CONTRACT.md) - 工具↔后端 API 映射
- [AGENTS.md](../../AGENTS.md) - 项目结构和开发指南

---

## 附录：记忆系统条目

- **记忆 ID**: `01KNQ0P0682K6P8GQ1P06W930G`
- **后端 Memory ID**: `memory:wf0k0unrfg0u6n4ojfk5`
- **状态**: 已置顶 (pinned)
- **保存时间**: 2026-04-09

---

_文档版本: v2.0.0_  
_最后更新: 2026-04-09_  
_状态: 草案/待细化_
