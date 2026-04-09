# 统一架构 v3.0 设计方案（实施版）

> **版本**: v3.0.0  
> **日期**: 2026-04-09  
> **状态**: 实施版  
> **作者**: OpenCode Agent  
> **基于**: v2.0 完整模型 + 实际项目现状

---

## 目录

1. [设计原则](#1-设计原则)
2. [架构概览](#2-架构概览)
3. [数据模型](#3-数据模型)
4. [数据库 Schema](#4-数据库-schema)
5. [API 接口规范](#5-api-接口规范)
6. [预计算服务设计](#6-预计算服务设计)
7. [实施计划](#7-实施计划)
8. [与现有系统集成](#8-与现有系统集成)
9. [风险与应对](#9-风险与应对)

---

## 1. 设计原则

### 1.1 核心原则（基于反馈确认）

| 原则               | 说明                                 | 决策依据                     |
| ------------------ | ------------------------------------ | ---------------------------- |
| **云端优先**       | 主要部署在云端，小型化后可本地部署   | 云端更适合 Agent 高频调用    |
| **Agent-Native**   | 为 Coding Agent 设计，不迁就人类习惯 | 无 GUI、无自动 LLM 处理      |
| **无后端 LLM**     | Agent 显式决策，系统只提供能力       | Agent 手动标注、手动建立关系 |
| **预计算加速**     | 文件保存时预计算，查询时快速响应     | 基于现有 code-analyzer.js    |
| **保留 v2.0 模型** | Atom/Entity/Relation 四层架构        | v2.0 内容全部需要            |

### 1.2 关键决策

- ✅ **Docker 已做**：不需要再做容器化
- ✅ **BACKLOG API 取消**：融入当前设计方案，作为 Entity 类型实现
- ✅ **代码分析已实现**：CallSymbol 提取已完成（`extractCallsFromOxcAst`）
- ✅ **优先级**：预计算服务优先
- ✅ **接口模式**：插件工具 + CLI（无 MCP）

---

## 2. 架构概览

### 2.1 四层架构（保留 v2.0 设计）

```
┌─────────────────────────────────────────────────────────────┐
│                    表示层 (Presentation)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Markdown  │  │   Wiki/MD   │  │    Obsidian Vault   │ │
│  │  (人类可读)  │  │  (双向链接)  │  │    (本地编辑)        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Code View  │  │  Code Graph │  │   IDE Integration   │ │
│  │  (代码浏览)  │  │  (代码图谱)  │  │   (VSCode/JetBrains)│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    原子层 (Atomic Layer)                     │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│   │  Goal   │  │  Scope  │  │  Task   │  │  Note   │       │
│   │ (目标)  │  │ (范围)  │  │ (任务)  │  │ (笔记)  │       │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│   │Function │  │  Class  │  │Interface│  │ Import  │       │
│   │ (函数)  │  │  (类)   │  │ (接口)  │  │ (导入)  │       │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘       │
│        └─────────────┴─────────────┴────────────┘            │
│                       │                                      │
│              ┌────────┴────────┐                           │
│              │  Atom Relations  │                           │
│              │  • depends_on    │                           │
│              │  • blocks        │                           │
│              │  • calls         │ ← 代码调用               │
│              │  • imports       │ ← 代码导入               │
│              │  • implements    │ ← 代码实现任务           │
│              └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  实体层 (Entity Layer)                       │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │  Memory  │  │  Backlog │  │   Wiki   │  │   Code   │  │
│   │  (记忆)  │  │  (任务)  │  │  (页面)  │  │  (代码)  │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│        └──────────────┼──────────────┴────────────┘         │
│                       │                                      │
│              ┌────────┴────────┐                           │
│              │  Entity Graph    │                           │
│              │  • wiki_link     │                           │
│              │  • implements    │ ← 代码实现任务           │
│              │  • relates_to    │                           │
│              │  • part_of       │                           │
│              └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   存储层 (Storage Layer)                     │
│   ┌─────────────────┐    ┌─────────────────┐               │
│   │   SurrealDB     │◄──►│   Meilisearch   │               │
│   │  (主数据库)      │    │   (搜索索引)     │               │
│   │                 │    │                 │               │
│   │  • Entities     │    │  • 全文搜索      │               │
│   │  • Atoms        │    │  • 向量搜索      │               │
│   │  • Relations    │    │  • 过滤排序      │               │
│   │  • Graph        │    │                 │               │
│   └─────────────────┘    └─────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Deployment (主要)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 API Gateway                          │   │
│  │  • 统一认证 (API Key)                                │   │
│  │  • 请求路由                                          │   │
│  │  • 限流/配额                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Precompute Service                      │   │
│  │  • AST 解析 (Oxc/Tree-sitter)                        │   │
│  │  • 符号提取                                          │   │
│  │  • 引用解析                                          │   │
│  │  • 聚类 (Leiden)                                     │   │
│  │  • 执行流追踪                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Plugin Tool API                         │   │
│  │  • memory_write/search/read                          │   │
│  │  • code_analyze/navigate/impact                      │   │
│  │  • task_create/update                                │   │
│  │  • graph_traverse/query                              │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Storage Layer                          │   │
│  │  • SurrealDB (符号、关系、图谱)                       │   │
│  │  • Meilisearch (混合搜索索引)                         │   │
│  │  • 纯存储，无 LLM 处理                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Local Deployment (小型化后)                     │
│  docker-compose up                                          │
│  • 同样的容器镜像（已存在）                                 │
│  • 本地 SurrealDB + Meilisearch                            │
│  • 同样的插件工具接口                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型

### 3.1 Atom（原子单元）- 最小知识单元

```python
class Atom(BaseModel):
    """原子单元 - 最小知识单元"""
    # 基础字段（所有 Atom 共有）
    id: str                    # ULID，如 "atom:01HQ..."
    type: AtomType             # function | class | interface | import
                              # | goal | scope | task | note
    content: str               # 内容（函数源码、任务描述等）

    # 状态（用于 task 类型）
    status: Optional[str]      # pending | done | blocked

    # 代码特有字段（Function/Class/Interface）
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

    # 通用元数据
    metadata: Dict[str, Any]
    version: int = 1
    created_at: datetime
    updated_at: datetime

    # 关系（Agent 显式建立）
    relations: List[str]       # Relation ID 列表
```

### 3.2 Entity（实体）- 知识实体

```python
class Entity(BaseModel):
    """实体 - 知识实体"""
    id: str                    # ULID
    type: EntityType           # memory | backlog | wiki | code

    # L0/L1/L2 分层（记忆系统兼容）
    abstract: str              # L0: 摘要
    overview: Dict[str, Any]   # L1: 结构化概览
    atoms: List[str]           # L2: Atom ID 列表

    # Wiki 特性
    title: Optional[str]
    aliases: List[str]
    outgoing_links: List[str]
    incoming_links: List[str]

    # Backlog 特性（融入当前设计）
    priority: Optional[str]    # P0 | P1 | P2 | P3
    status: Optional[str]      # backlog | todo | in_progress | in_review | done
    scene: Optional[str]
    estimated_hours: Optional[float]
    actual_hours: Optional[float]

    # Code 特性
    file_path: Optional[str]
    language: Optional[str]
    quality_score: Optional[QualityScore]
    complexity_metrics: Optional[ComplexityMetrics]

    # 通用
    tags: List[str]
    project: Optional[str]
    created_by: str
    created_at: datetime
    updated_at: datetime
```

### 3.3 Relation（关系）- 原子/实体间关系

```python
class Relation(BaseModel):
    """关系 - 原子/实体间关系"""
    id: str                    # ULID
    type: RelationType         # depends_on | blocks | calls | imports
                              # | implements | relates_to | wiki_link | part_of

    from_id: str               # Atom ID 或 Entity ID
    to_id: str                 # Atom ID 或 Entity ID

    # 代码特有（用于 calls/imports）
    file_path: Optional[str]
    line: Optional[int]
    column: Optional[int]

    # Backlog 特有（用于 implements）
    metadata: Optional[Dict]

    # 通用
    weight: float = 0.5
    created_by: str
    created_at: datetime
```

---

## 4. 数据库 Schema

### 4.1 Atom 表

```sql
DEFINE TABLE atom TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON atom TYPE record;
DEFINE FIELD type ON atom TYPE string
    ASSERT $value IN ['function', 'class', 'interface', 'import', 'goal', 'scope', 'task', 'note'];

DEFINE FIELD content ON atom TYPE string;
DEFINE FIELD status ON atom TYPE option<string>
    ASSERT $value == NONE OR $value IN ['pending', 'done', 'blocked'];

-- 代码特有字段
DEFINE FIELD name ON atom TYPE option<string>;
DEFINE FIELD signature ON atom TYPE option<string>;
DEFINE FIELD params ON atom TYPE option<array>;
DEFINE FIELD return_type ON atom TYPE option<string>;
DEFINE FIELD is_exported ON atom TYPE option<bool>;
DEFINE FIELD is_async ON atom TYPE option<bool>;
DEFINE FIELD complexity ON atom TYPE option<int>;
DEFINE FIELD max_nesting_depth ON atom TYPE option<int>;
DEFINE FIELD docstring ON atom TYPE option<object>;
DEFINE FIELD start_line ON atom TYPE option<int>;
DEFINE FIELD end_line ON atom TYPE option<int>;

-- 通用字段
DEFINE FIELD metadata ON atom TYPE option<object> DEFAULT {};
DEFINE FIELD version ON atom TYPE int DEFAULT 1;
DEFINE FIELD created_at ON atom TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON atom TYPE datetime DEFAULT time::now();

-- 索引
DEFINE INDEX idx_atom_type ON atom FIELDS type;
DEFINE INDEX idx_atom_name ON atom FIELDS name;
DEFINE INDEX idx_atom_project ON atom FIELDS project;
```

### 4.2 Entity 表

```sql
DEFINE TABLE entity TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON entity TYPE record;
DEFINE FIELD type ON entity TYPE string
    ASSERT $value IN ['memory', 'backlog', 'wiki', 'code'];

-- L0/L1/L2 分层
DEFINE FIELD abstract ON entity TYPE string;
DEFINE FIELD overview ON entity TYPE object;
DEFINE FIELD atoms ON entity TYPE array<record<atom>>;

-- Wiki 特性
DEFINE FIELD title ON entity TYPE option<string>;
DEFINE FIELD aliases ON entity TYPE array<string> DEFAULT [];
DEFINE FIELD outgoing_links ON entity TYPE array<string> DEFAULT [];
DEFINE FIELD incoming_links ON entity TYPE array<string> DEFAULT [];

-- Backlog 特性
DEFINE FIELD priority ON entity TYPE option<string>
    ASSERT $value == NONE OR $value IN ['P0', 'P1', 'P2', 'P3'];
DEFINE FIELD status ON entity TYPE option<string>
    ASSERT $value == NONE OR $value IN ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
DEFINE FIELD scene ON entity TYPE option<string>;
DEFINE FIELD estimated_hours ON entity TYPE option<float>;
DEFINE FIELD actual_hours ON entity TYPE option<float>;

-- Code 特性
DEFINE FIELD file_path ON entity TYPE option<string>;
DEFINE FIELD language ON entity TYPE option<string>;
DEFINE FIELD quality_score ON entity TYPE option<object>;
DEFINE FIELD complexity_metrics ON entity TYPE option<object>;

-- 通用字段
DEFINE FIELD tags ON entity TYPE array<string> DEFAULT [];
DEFINE FIELD project ON entity TYPE option<string>;
DEFINE FIELD created_by ON entity TYPE string;
DEFINE FIELD created_at ON entity TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON entity TYPE datetime DEFAULT time::now();

-- 索引
DEFINE INDEX idx_entity_type ON entity FIELDS type;
DEFINE INDEX idx_entity_project ON entity FIELDS project;
DEFINE INDEX idx_entity_status ON entity FIELDS status;
```

### 4.3 Relation 表

```sql
DEFINE TABLE relation TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON relation TYPE record;
DEFINE FIELD type ON relation TYPE string
    ASSERT $value IN ['depends_on', 'blocks', 'calls', 'imports', 'implements', 'relates_to', 'wiki_link', 'part_of'];

DEFINE FIELD from_id ON relation TYPE string;
DEFINE FIELD to_id ON relation TYPE string;

-- 代码特有
DEFINE FIELD file_path ON relation TYPE option<string>;
DEFINE FIELD line ON relation TYPE option<int>;
DEFINE FIELD column ON relation TYPE option<int>;

-- Backlog 特有
DEFINE FIELD metadata ON relation TYPE option<object>;

-- 通用字段
DEFINE FIELD weight ON relation TYPE float DEFAULT 0.5;
DEFINE FIELD created_by ON relation TYPE string;
DEFINE FIELD created_at ON relation TYPE datetime DEFAULT time::now();

-- 索引
DEFINE INDEX idx_relation_type ON relation FIELDS type;
DEFINE INDEX idx_relation_from ON relation FIELDS from_id;
DEFINE INDEX idx_relation_to ON relation FIELDS to_id;
```

### 4.4 图关系表（用于快速遍历）

```sql
DEFINE TABLE atom_graph TYPE RELATION IN atom OUT atom;
DEFINE FIELD type ON atom_graph TYPE string;
DEFINE FIELD weight ON atom_graph TYPE float DEFAULT 0.5;

DEFINE TABLE entity_graph TYPE RELATION IN entity OUT entity;
DEFINE FIELD type ON entity_graph TYPE string;
DEFINE FIELD weight ON entity_graph TYPE float DEFAULT 0.5;
```

---

## 5. API 接口规范

### 5.1 原子级操作

```javascript
// 创建 Atom（Agent 显式标注）
POST /api/v1/atoms
{
  "type": "function",
  "content": "async function analyzeCode(...) { ... }",
  "name": "analyzeCode",
  "signature": "async analyzeCode(filePath: string): Promise<AnalysisResult>",
  "params": [{"name": "filePath", "type": "string"}],
  "return_type": "Promise<AnalysisResult>",
  "is_exported": true,
  "is_async": true,
  "complexity": 5,
  "start_line": 85,
  "end_line": 125,
  "project": "backlog-api",
  "tags": ["typescript", "analysis"]
}

// 更新 Atom
PATCH /api/v1/atoms/{atom_id}
{
  "content": "更新后的内容",
  "version": 2
}

// 删除 Atom
DELETE /api/v1/atoms/{atom_id}

// 搜索 Atom
GET /api/v1/atoms?query=analyzeCode&type=function&project=backlog-api
```

### 5.2 实体操作

```javascript
// 创建 Entity（包含 Atoms）
POST /api/v1/entities
{
  "type": "code",
  "title": "utils.ts",
  "abstract": "TypeScript file with 5 functions",
  "overview": {
    "language": "typescript",
    "lines_of_code": 150,
    "function_count": 5
  },
  "atoms": ["atom:func-1", "atom:func-2"],
  "file_path": "src/utils.ts",
  "language": "typescript",
  "project": "backlog-api",
  "tags": ["typescript", "utils"]
}

// Backlog Entity（融入当前设计）
POST /api/v1/entities
{
  "type": "backlog",
  "title": "实现文件监听",
  "abstract": "文件保存自动触发分析",
  "overview": {
    "description": "当用户保存文件时...",
    "scope": ["lib/file-watcher.js"]
  },
  "priority": "P0",
  "status": "in_progress",
  "scene": "代码分析v1.4",
  "estimated_hours": 4,
  "project": "backlog-api",
  "tags": ["代码分析", "自动化"]
}
```

### 5.3 关系操作

```javascript
// 创建关系（Agent 显式建立）
POST /api/v1/relations
{
  "type": "calls",
  "from_id": "atom:func-analyzeCode",
  "to_id": "atom:func-parseSync",
  "file_path": "src/utils.ts",
  "line": 95,
  "column": 20
}

// 代码实现任务关系
POST /api/v1/relations
{
  "type": "implements",
  "from_id": "entity:backlog-BL-CA-17",
  "to_id": "entity:code-src-file-watcher",
  "metadata": {
    "implemented_functions": ["onFileSaved", "debouncedAnalyze"],
    "status": "completed"
  }
}
```

### 5.4 代码分析 API（预计算）

```javascript
// 触发预计算
POST /api/v1/code/precompute
{
  "file_path": "src/utils.ts",
  "analysis": {
    "language": "typescript",
    "functions": [...],
    "classes": [...],
    "calls": [...]
  }
}

// 代码导航（查询预计算数据）
GET /api/v1/code/navigate?symbol=analyzeCode&action=goto_definition

// 爆炸半径分析
GET /api/v1/code/impact?symbol=analyzeCode&depth=2&direction=both

// 混合搜索
GET /api/v1/code/search?query=文件监听&language=typescript&hybrid=true
```

---

## 6. 预计算服务设计

### 6.1 预计算流程

```javascript
// 基于现有 code-analysis-service.js 扩展

class PrecomputeService {
  async precompute(filePath, analysis) {
    const startTime = Date.now();

    // 1. 解析 AST（复用现有解析结果）
    const ast = analysis.ast;

    // 2. 提取符号（函数、类、接口）
    const symbols = this.extractSymbols(analysis, filePath);

    // 3. 解析引用（跨文件调用）
    const references = this.extractReferences(analysis);

    // 4. 创建 Atoms
    const atoms = await this.createAtoms(symbols);

    // 5. 创建 Entity（文件级）
    const entity = await this.createEntity(filePath, analysis, atoms);

    // 6. 创建 Relations（调用关系）
    const relations = await this.createRelations(references, atoms);

    // 7. 检测任务引用（从注释中提取 BL-XXX）
    const taskRefs = this.extractTaskReferences(analysis);
    for (const taskId of taskRefs) {
      await this.createTaskRelation(entity, taskId);
    }

    // 8. 构建搜索索引
    await this.buildSearchIndex(symbols);

    return {
      entityId: entity.id,
      atomsCount: atoms.length,
      relationsCount: relations.length,
      computeTime: Date.now() - startTime,
    };
  }

  extractSymbols(analysis, filePath) {
    const symbols = [];

    // 从现有 analysis.functions 提取
    for (const func of analysis.functions) {
      symbols.push({
        type: "function",
        name: func.name,
        signature: func.signature,
        params: func.params,
        return_type: func.return_type,
        is_exported: func.is_exported,
        is_async: func.is_async,
        complexity: func.complexity,
        start_line: func.start_line,
        end_line: func.end_line,
        file_path: filePath,
      });
    }

    // 从 analysis.classes 提取
    for (const cls of analysis.classes) {
      symbols.push({
        type: "class",
        name: cls.name,
        start_line: cls.start_line,
        end_line: cls.end_line,
        file_path: filePath,
      });
    }

    return symbols;
  }

  extractReferences(analysis) {
    // 从 analysis.calls 提取（已实现）
    return analysis.calls || [];
  }

  extractTaskReferences(analysis) {
    // 从注释中提取 BL-XXX 格式的任务 ID
    const refs = [];
    for (const comment of analysis.comments || []) {
      const matches = comment.value.match(/BL-[A-Z]+-\d+/g);
      if (matches) refs.push(...matches);
    }
    return refs;
  }
}
```

### 6.2 触发时机

```javascript
// 1. 文件保存时自动触发（现有文件监听）
onFileSave: async (filePath) => {
  const analysis = await codeAnalyzer.analyze(filePath);
  await api.code.precompute(filePath, analysis);
};

// 2. CLI 手动触发
// opencode-memory analyze src/utils.ts

// 3. 批量触发
// opencode-memory analyze --all
```

---

## 7. 实施计划

### Phase 1: 数据库 Schema 和基础 API（2周）

**Week 1: 数据库设计**

- [ ] 创建 SurrealDB 表（atom, entity, relation）
- [ ] 创建索引
- [ ] 编写数据库迁移脚本
- [ ] 测试数据插入和查询

**Week 2: 基础 API**

- [ ] 实现 Atom CRUD API
- [ ] 实现 Entity CRUD API
- [ ] 实现 Relation CRUD API
- [ ] 编写 API 测试

**验收标准**：

- 所有表创建成功
- API 返回正确数据结构
- 单元测试通过率 100%

### Phase 2: 预计算服务（3周）

**Week 3: 符号提取**

- [ ] 复用现有 code-analyzer.js
- [ ] 实现符号提取逻辑
- [ ] 创建 Atom 记录

**Week 4: 引用解析和关系建立**

- [ ] 复用现有 extractCallsFromOxcAst
- [ ] 创建 Relation 记录
- [ ] 实现任务引用检测

**Week 5: 搜索索引**

- [ ] 集成 Meilisearch
- [ ] 构建混合搜索索引
- [ ] 测试搜索功能

**验收标准**：

- 文件保存后自动触发预计算
- 预计算数据正确存储
- 搜索返回正确结果

### Phase 3: 插件工具（2周）

**Week 6: 记忆工具**

- [ ] memory_write（Agent 显式标注）
- [ ] memory_search
- [ ] memory_read

**Week 7: 代码工具**

- [ ] code_analyze（触发预计算）
- [ ] code_navigate
- [ ] code_impact

**验收标准**：

- 工具可在 OpenCode 中调用
- 返回正确数据结构
- 错误处理完善

### Phase 4: 与现有系统集成（2周）

**Week 8: 文件监听集成**

- [ ] 修改 code-analysis-service.js
- [ ] 集成预计算调用
- [ ] 测试端到端流程

**Week 9: BACKLOG 整合**

- [ ] 实现任务引用检测
- [ ] 创建代码-任务关系
- [ ] 双向查询功能

**验收标准**：

- 文件保存后自动预计算
- 代码与任务正确关联
- 查询返回完整上下文

### Phase 5: 测试和优化（1周）

**Week 10: 测试和文档**

- [ ] 集成测试
- [ ] 性能测试
- [ ] 编写使用文档

**验收标准**：

- 所有测试通过
- 性能满足要求（查询 <100ms）
- 文档完整

---

## 8. 实现状态标注（基于代码分析）

> **更新时间**: 2026-04-09  
> **分析范围**: 后端记忆服务（wrapper）+ 插件端（opencode-memory-plugin）

---

### 8.1 详细实现状态总览

#### 图例说明

| 图标 | 含义             |
| ---- | ---------------- |
| ✅   | 已实现并可用     |
| ⚠️   | 部分实现或需验证 |
| ❌   | 未实现           |
| 🚫   | 已取消/推迟      |

---

### 8.2 后端记忆服务（wrapper）实现状态

#### 8.2.1 已实现的 API ✅

| API 端点                          | 方法   | 状态 | 说明                    |
| --------------------------------- | ------ | ---- | ----------------------- |
| `/api/v1/memories`                | POST   | ✅   | 批量上传记忆条目        |
| `/api/v1/memories/search`         | GET    | ✅   | 语义搜索（向量+关键词） |
| `/api/v1/memories/{id}`           | GET    | ✅   | 获取单个记忆            |
| `/api/v1/memories/{id}`           | DELETE | ✅   | 删除记忆                |
| `/api/v1/memories/relations`      | POST   | ✅   | 创建记忆间关系          |
| `/api/v1/memories/relations/{id}` | DELETE | ✅   | 删除关系                |
| `/api/v1/memories/{id}/graph`     | POST   | ✅   | 图遍历查询              |
| `/api/v1/memories/{id}/relations` | POST   | ✅   | 创建特定记忆的关系      |
| `/api/v1/sync`                    | POST   | ✅   | 增量同步                |
| `/api/v1/sync/full`               | POST   | ✅   | 全量同步                |

**代码位置**: `wrapper/src/routers/memories.py`, `wrapper/src/routers/sync.py`

#### 8.2.2 已取消/推迟的 API 🚫

| API 端点                             | 方法 | 状态 | 说明                                 |
| ------------------------------------ | ---- | ---- | ------------------------------------ |
| `/api/v1/projects/{id}/map`          | GET  | 🚫   | 项目代码地图（v1.4 已取消）          |
| `/api/v1/calls/batch`                | POST | ⚠️   | 调用关系批量创建（API 定义但未激活） |
| `/api/v1/memories/{id}/references`   | GET  | ⚠️   | 查询调用者（API 定义但未激活）       |
| `/api/v1/memories/{id}/dependencies` | GET  | ⚠️   | 查询被调用者（API 定义但未激活）     |

**说明**: 调用关系相关 API 在 `API-CONTRACT.md` 中定义，但未在 `code-analysis-service.js` 中调用

#### 8.2.3 待实现的 API ❌

| API 端点                  | 方法 | 状态 | 优先级 | 说明               |
| ------------------------- | ---- | ---- | ------ | ------------------ |
| `/api/v1/code/precompute` | POST | ❌   | P0     | 触发代码预计算     |
| `/api/v1/symbols`         | POST | ❌   | P0     | 创建符号           |
| `/api/v1/symbols/{id}`    | GET  | ❌   | P0     | 获取符号           |
| `/api/v1/symbols`         | GET  | ❌   | P0     | 搜索符号           |
| `/api/v1/references`      | POST | ❌   | P0     | 创建引用关系       |
| `/api/v1/references`      | GET  | ❌   | P0     | 查询引用关系       |
| `/api/v1/graph/traverse`  | POST | ❌   | P0     | 图遍历（多跳查询） |
| `/api/v1/graph/impact`    | GET  | ❌   | P0     | 爆炸半径分析       |
| `/api/v1/clusters`        | POST | ❌   | P1     | 创建聚类           |
| `/api/v1/processes`       | POST | ❌   | P1     | 创建执行流         |

#### 8.2.4 现有数据库表结构

**已实现的表**（`wrapper/src/database/surrealdb.py`）:

```sql
-- ✅ 已实现
DEFINE TABLE memory TYPE NORMAL SCHEMAFULL;
  DEFINE FIELD id ON memory TYPE record;
  DEFINE FIELD content ON memory TYPE string;
  DEFINE FIELD abstract ON memory TYPE string;
  DEFINE FIELD overview ON memory TYPE string;
  DEFINE FIELD type ON memory TYPE string;
  DEFINE FIELD tags ON memory TYPE array<string>;
  DEFINE FIELD metadata ON memory TYPE option<object>;

-- ✅ 已实现
DEFINE TABLE relation TYPE RELATION IN memory OUT memory SCHEMAFULL;
  DEFINE FIELD type ON relation TYPE string;
  DEFINE FIELD weight ON relation TYPE float DEFAULT 0.5;

-- ✅ 已实现
DEFINE TABLE timeline TYPE NORMAL;
DEFINE TABLE link_map TYPE NORMAL;
DEFINE TABLE sync_checkpoint TYPE NORMAL;
```

**待实现的表**:

```sql
-- ❌ 待实现（预计算设计）
DEFINE TABLE symbol TYPE NORMAL SCHEMAFULL;
  DEFINE FIELD id ON symbol TYPE record;
  DEFINE FIELD name ON symbol TYPE string;
  DEFINE FIELD type ON symbol TYPE string;  -- function/class/interface
  DEFINE FIELD signature ON symbol TYPE option<string>;
  DEFINE FIELD complexity ON symbol TYPE option<int>;
  DEFINE FIELD file_path ON symbol TYPE string;
  DEFINE FIELD start_line ON symbol TYPE int;
  DEFINE FIELD end_line ON symbol TYPE int;

-- ❌ 待实现
DEFINE TABLE reference TYPE RELATION IN symbol OUT symbol SCHEMAFULL;
  DEFINE FIELD type ON reference TYPE string;  -- calls/imports/extends
  DEFINE FIELD line ON reference TYPE int;
  DEFINE FIELD column ON reference TYPE int;

-- ❌ 待实现
DEFINE TABLE graph TYPE NORMAL;
  DEFINE FIELD file_path ON graph TYPE string;
  DEFINE FIELD nodes ON graph TYPE array<object>;
  DEFINE FIELD edges ON graph TYPE array<object>;

-- ❌ 待实现
DEFINE TABLE cluster TYPE NORMAL;
  DEFINE FIELD name ON cluster TYPE string;
  DEFINE FIELD nodes ON cluster TYPE array<record<symbol>>;

-- ❌ 待实现
DEFINE TABLE process TYPE NORMAL;
  DEFINE FIELD entry_point ON process TYPE record<symbol>;
  DEFINE FIELD steps ON process TYPE array<record<symbol>>;
```

---

### 8.3 插件端（opencode-memory-plugin）实现状态

#### 8.3.1 已实现的工具（15/15）✅

| 工具               | 文件              | 状态 | 说明                 |
| ------------------ | ----------------- | ---- | -------------------- |
| `memory_write`     | `tools/core.js`   | ✅   | 写入记忆             |
| `memory_read`      | `plugin.js`       | ✅   | 读取记忆（L0/L1/L2） |
| `memory_search`    | `tools/search.js` | ✅   | 混合搜索             |
| `memory_suggest`   | `tools/search.js` | ✅   | 前缀搜索建议         |
| `memory_relate`    | `tools/graph.js`  | ✅   | 创建关系             |
| `memory_graph`     | `tools/graph.js`  | ✅   | 图遍历               |
| `memory_timeline`  | `tools/browse.js` | ✅   | 时间线浏览           |
| `memory_topics`    | `tools/browse.js` | ✅   | 主题浏览             |
| `memory_pin`       | `tools/core.js`   | ✅   | 置顶记忆             |
| `index_status`     | `tools/sync.js`   | ✅   | 索引状态             |
| `rebuild_index`    | `tools/sync.js`   | ✅   | 重建索引             |
| `incremental_sync` | `tools/sync.js`   | ✅   | 增量同步             |
| `full_sync`        | `tools/sync.js`   | ✅   | 全量同步             |
| `sync_checkpoint`  | `tools/sync.js`   | ✅   | 同步检查点           |
| `conflict_list`    | `tools/sync.js`   | ✅   | 冲突列表             |
| `conflict_resolve` | `tools/sync.js`   | ✅   | 冲突解决             |

#### 8.3.2 已实现的代码分析功能 ✅

| 功能             | 文件                       | 状态 | 说明                               |
| ---------------- | -------------------------- | ---- | ---------------------------------- |
| **AST 解析**     | `code-analyzer.js`         | ✅   | Oxc (JS/TS) + Tree-sitter (多语言) |
| **函数提取**     | `code-analyzer.js`         | ✅   | 名称、参数、返回类型、复杂度       |
| **类提取**       | `code-analyzer.js`         | ✅   | 名称、方法、属性                   |
| **接口提取**     | `code-analyzer.js`         | ✅   | TypeScript/Java 接口               |
| **导入提取**     | `code-analyzer.js`         | ✅   | 来源、分类                         |
| **调用关系提取** | `code-analyzer.js`         | ✅   | `extractCallsFromOxcAst()`         |
| **多语言支持**   | `tree-sitter-parser.js`    | ✅   | Python/Go/Rust/Java                |
| **复杂度计算**   | `code-analyzer.js`         | ✅   | 圈复杂度、嵌套深度                 |
| **质量评分**     | `code-analyzer.js`         | ✅   | A/B/C/D 评级                       |
| **项目健康度**   | `project-analyzer.js`      | ✅   | 项目级分析报告                     |
| **文件监听**     | `file-watcher.js`          | ✅   | chokidar + 300ms 防抖              |
| **批量队列**     | `code-analysis-service.js` | ✅   | 批处理 + 并发控制                  |

**代码分析流程**（已实现）:

```javascript
// code-analysis-service.js
onFileSaved(filePath)
  → AnalysisQueue.add(filePath)      // ✅ 队列管理
  → codeAnalyzer.analyze(filePath)   // ✅ AST 分析
  → addToBatch(item, analysis)       // ✅ 生成 memoryItem
  → flushBatch()                     // ✅ 批量上传
  → wrapperClient.uploadMemories()   // ✅ 上传到后端
```

#### 8.3.3 待实现的预计算功能 ❌

| 功能                 | 文件                       | 状态 | 优先级 | 说明                           |
| -------------------- | -------------------------- | ---- | ------ | ------------------------------ |
| **符号提取**         | `code-analysis-service.js` | ❌   | P0     | 从 analysis 提取 symbols 数组  |
| **预计算触发**       | `code-analysis-service.js` | ❌   | P0     | 调用 `/api/v1/code/precompute` |
| **代码导航工具**     | `tools/code.js`            | ❌   | P0     | `code_navigate` 工具           |
| **爆炸半径工具**     | `tools/code.js`            | ❌   | P0     | `code_impact` 工具             |
| **代码搜索工具**     | `tools/code.js`            | ❌   | P0     | `code_search` 工具             |
| **增量更新**         | `code-analysis-service.js` | ❌   | P1     | 指纹 + diff 机制               |
| **Memory ID 持久化** | `code-analysis-service.js` | ❌   | P1     | 缓存写入本地文件               |

#### 8.3.4 已取消的功能 🚫

| 功能             | 文件                  | 状态 | 说明                        |
| ---------------- | --------------------- | ---- | --------------------------- |
| **项目代码地图** | `project-analyzer.js` | 🚫   | v1.4 设计文档中已标记为取消 |
| **时序质量趋势** | -                     | 🚫   | Phase 3 功能，已推迟        |

---

### 8.4 关键差距分析

#### 差距 1：调用关系未激活 ⚠️

**现状**:

```javascript
// code-analyzer.js ✅ 已提取
const calls = this.extractCallsFromOxcAst(ast, filePath, sourceCode);
// 返回: [{target, file_path, line, column}]

// code-analysis-service.js ❌ 未上传
addToBatch(item, analysis) {
  const memoryItem = {
    metadata: {
      code_analysis: {
        calls: analysis.calls  // ❌ 嵌套在 metadata 中，未创建独立关系
      }
    }
  };
}
```

**设计目标**:

```javascript
// 应该创建独立的引用关系
reference: {
  type: "calls",
  from: "symbol:analyzeCode@src_utils_ts",
  to: "symbol:parseSync@src_parser_ts",
  line: 95,
  column: 20
}
```

**影响**:

- ❌ 无法查询"谁调用了 analyzeCode"
- ❌ 无法进行爆炸半径分析
- ❌ 无法进行代码导航

**解决方案**:

1. 后端新增 `symbol` 和 `reference` 表
2. 后端新增 `POST /api/v1/code/precompute` API
3. 插件端在 `flushBatch` 后调用预计算 API
4. 插件端新增 `code_navigate` 和 `code_impact` 工具

#### 差距 2：存储粒度不足 ⚠️

**现状**（文件级）:

```javascript
// 一个文件 = 一个 memory 条目
{
  type: 'code',
  content: '整个文件内容',
  metadata: {
    code_analysis: {
      functions: [...],  // 嵌套在 metadata 中
      calls: [...]
    }
  }
}
```

**设计目标**（符号级）:

```javascript
// 一个函数 = 一个 symbol 条目
symbol: {
  id: "symbol:analyzeCode@src_utils_ts",
  type: "function",
  name: "analyzeCode",
  signature: "async analyzeCode(filePath: string): Promise<AnalysisResult>",
  complexity: 5,
  file_path: "src/utils.ts",
  start_line: 85,
  end_line: 125
}
```

**影响**:

- ❌ 无法搜索特定函数
- ❌ 无法更新单个函数信息
- ❌ 无法建立函数级关系

#### 差距 3：缺少查询工具 ❌

**现状**: 没有代码导航和代码分析工具

**设计目标**:

```javascript
// 代码导航工具
code_navigate({
  symbol: "analyzeCode",
  action: "goto_definition",
});
// 返回: {file_path, line, column}

code_impact({
  symbol: "analyzeCode",
  depth: 2,
});
// 返回: {affected_symbols, affected_files, risk_level}
```

---

### 8.5 复用现有代码策略

| 现有代码                   | 实现状态  | 复用方式 | 修改内容                       | 工作量 |
| -------------------------- | --------- | -------- | ------------------------------ | ------ |
| `code-analyzer.js`         | ✅ 已实现 | 直接复用 | 无需修改                       | 0%     |
| `tree-sitter-parser.js`    | ✅ 已实现 | 直接复用 | 无需修改                       | 0%     |
| `file-watcher.js`          | ✅ 已实现 | 直接复用 | 无需修改                       | 0%     |
| `code-analysis-service.js` | ✅ 已实现 | 扩展     | 添加 `precompute()` 方法       | 20%    |
| `wrapper-client.js`        | ✅ 已实现 | 扩展     | 添加预计算 API 调用            | 10%    |
| `tools/core.js`            | ✅ 已实现 | 保留     | 向后兼容                       | 0%     |
| `tools/graph.js`           | ✅ 已实现 | 扩展     | 添加代码导航工具               | 30%    |
| 后端 `memories.py`         | ✅ 已实现 | 扩展     | 添加 symbol/reference 路由     | 40%    |
| 后端数据库                 | ✅ 已实现 | 扩展     | 添加 symbol/reference/graph 表 | 30%    |

**总体评估**: 约 60% 的功能已实现，40% 需要新增

---

### 8.6 向后兼容策略

```javascript
// 现有 memory_write 仍然可用
memory_write({
  abstract: "...",
  overview: "...",
  content: "...",
  type: "general",
});
// 内部自动转换为 Entity + Atoms

// 新的显式 API
atom_create({
  type: "function",
  name: "analyzeCode",
  content: "...",
});
```

---

## 9. 关键遗漏项补充

### 9.1 增量更新策略

**问题**：预计算时如何只更新变更部分，而不是全量重新计算

**解决方案**：

```javascript
// 预计算增量更新策略
class IncrementalPrecompute {
  async precompute(filePath, analysis) {
    // 1. 获取上次预计算结果
    const lastPrecompute = await this.getLastPrecompute(filePath);

    // 2. 计算文件指纹（hash）
    const currentFingerprint = this.calculateFingerprint(analysis.content);

    // 3. 如果指纹相同，跳过
    if (lastPrecompute && lastPrecompute.fingerprint === currentFingerprint) {
      return { skipped: true, reason: "no_change" };
    }

    // 4. 计算差异（diff）
    const diff = this.calculateDiff(lastPrecompute?.symbols, analysis.symbols);

    // 5. 只更新变更的部分
    if (diff.added.length > 0) {
      await this.createAtoms(diff.added);
    }
    if (diff.updated.length > 0) {
      await this.updateAtoms(diff.updated);
    }
    if (diff.deleted.length > 0) {
      await this.deleteAtoms(diff.deleted);
    }

    // 6. 更新引用关系
    await this.updateReferences(diff);

    // 7. 更新文件指纹
    await this.updateFingerprint(filePath, currentFingerprint);

    return {
      updated: true,
      added: diff.added.length,
      updated: diff.updated.length,
      deleted: diff.deleted.length,
    };
  }

  calculateFingerprint(content) {
    // 使用 SHA-256 计算文件指纹
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  calculateDiff(oldSymbols, newSymbols) {
    const oldMap = new Map(oldSymbols?.map((s) => [s.id, s]) || []);
    const newMap = new Map(newSymbols.map((s) => [s.id, s]));

    return {
      added: newSymbols.filter((s) => !oldMap.has(s.id)),
      updated: newSymbols.filter((s) => {
        const old = oldMap.get(s.id);
        return old && JSON.stringify(old) !== JSON.stringify(s);
      }),
      deleted: oldSymbols?.filter((s) => !newMap.has(s.id)) || [],
    };
  }
}
```

**触发策略**：

```javascript
// 预计算触发配置
const PRECOMPUTE_CONFIG = {
  // 单个文件触发
  onFileSave: {
    enabled: true,
    debounceMs: 300, // 防抖 300ms
    maxFileSize: 1024 * 1024, // 最大 1MB
  },

  // 批量触发（git checkout 等）
  onBatchChange: {
    enabled: true,
    maxBatchSize: 50, // 最多 50 个文件
    concurrency: 5, // 并发 5 个
    queueTimeout: 5000, // 队列超时 5s
  },

  // 大文件策略
  largeFileStrategy: {
    threshold: 1024 * 1024, // 1MB
    action: "partial", // skip | partial | async
    partialLines: 100, // 只分析前 100 行
  },

  // 增量更新
  incremental: {
    enabled: true,
    fingerprintAlgorithm: "sha256",
    maxDiffSize: 100, // 最大差异数量，超过则全量更新
  },
};
```

---

### 9.2 数据迁移方案

**问题**：现有记忆数据如何迁移到新的 Atom/Entity 模型

**迁移策略**：

```javascript
// 数据迁移方案
class DataMigration {
  async migrate() {
    console.log("开始数据迁移...");

    // 1. 备份现有数据
    await this.backup();

    // 2. 创建迁移记录表
    await this.createMigrationLog();

    // 3. 分批迁移
    const batchSize = 100;
    let migrated = 0;
    let failed = 0;

    while (true) {
      const memories = await this.getMemoriesBatch(batchSize);
      if (memories.length === 0) break;

      for (const memory of memories) {
        try {
          await this.migrateMemory(memory);
          migrated++;
        } catch (error) {
          await this.logFailure(memory.id, error);
          failed++;
        }
      }

      console.log(`已迁移: ${migrated}, 失败: ${failed}`);
    }

    // 4. 验证迁移结果
    await this.verify();

    // 5. 生成迁移报告
    return this.generateReport(migrated, failed);
  }

  async migrateMemory(memory) {
    // 1. 创建 Entity
    const entity = await this.createEntityFromMemory(memory);

    // 2. 尝试拆分内容为 Atoms（如果可能）
    const atoms = await this.trySplitIntoAtoms(memory);
    if (atoms.length > 0) {
      entity.atoms = atoms.map((a) => a.id);
    }

    // 3. 保存 Entity
    await db.create("entity", entity);

    // 4. 保存 Atoms
    for (const atom of atoms) {
      await db.create("atom", atom);
    }

    // 5. 记录迁移
    await this.logMigration(memory.id, entity.id);
  }

  async trySplitIntoAtoms(memory) {
    const atoms = [];

    // 如果内容是代码，尝试按函数拆分
    if (memory.type === "code" && memory.metadata?.code_analysis) {
      const analysis = memory.metadata.code_analysis;

      for (const func of analysis.functions || []) {
        atoms.push({
          type: "function",
          name: func.name,
          content: func.source_code || "",
          signature: func.signature,
          complexity: func.complexity,
          parent_entity: `entity:${memory.id}`,
        });
      }
    }

    return atoms;
  }

  async verify() {
    // 验证迁移后的数据完整性
    const originalCount = await this.getOriginalCount();
    const migratedCount = await this.getMigratedCount();

    if (originalCount !== migratedCount) {
      throw new Error(`迁移不完整: ${migratedCount}/${originalCount}`);
    }

    // 抽样验证
    const samples = await this.getSampleEntities(10);
    for (const entity of samples) {
      await this.verifyEntity(entity);
    }
  }
}
```

**回滚方案**：

```javascript
// 迁移失败时的回滚
async function rollback() {
  console.log("开始回滚...");

  // 1. 获取迁移记录
  const migrations = await db.query("SELECT * FROM migration_log");

  // 2. 删除迁移后的数据
  for (const migration of migrations) {
    await db.delete(`entity:${migration.new_id}`);
    // 删除关联的 atoms
    const entity = await db.select(`entity:${migration.new_id}`);
    for (const atomId of entity.atoms || []) {
      await db.delete(atomId);
    }
  }

  // 3. 恢复备份数据
  await restoreBackup();

  console.log("回滚完成");
}
```

---

### 9.3 版本控制策略

**问题**：Atom/Entity 的版本如何管理，如何回滚

**版本控制方案**：

```sql
-- 版本历史表
DEFINE TABLE version_history TYPE NORMAL SCHEMAFULL;
DEFINE FIELD id ON version_history TYPE record;
DEFINE FIELD target_id ON version_history TYPE string; -- Atom 或 Entity ID
DEFINE FIELD target_type ON version_history TYPE string ASSERT $value IN ['atom', 'entity'];
DEFINE FIELD version ON version_history TYPE int;
DEFINE FIELD data ON version_history TYPE object; -- 完整数据快照
DEFINE FIELD changed_by ON version_history TYPE string; -- Agent ID
DEFINE FIELD changed_at ON version_history TYPE datetime DEFAULT time::now();
DEFINE FIELD change_reason ON version_history TYPE option<string>;

-- 索引
DEFINE INDEX idx_version_target ON version_history FIELDS target_id, version;
```

```javascript
// 版本管理
class VersionControl {
  async updateAtom(atomId, newData, changeReason) {
    // 1. 获取当前版本
    const current = await db.select(`atom:${atomId}`);
    const newVersion = current.version + 1;

    // 2. 保存版本历史
    await db.create("version_history", {
      target_id: atomId,
      target_type: "atom",
      version: current.version,
      data: current,
      changed_by: current.created_by,
      changed_at: current.updated_at,
      change_reason: changeReason,
    });

    // 3. 更新数据
    await db.update(`atom:${atomId}`, {
      ...newData,
      version: newVersion,
      updated_at: new Date(),
    });

    return { id: atomId, version: newVersion };
  }

  async rollback(atomId, targetVersion) {
    // 1. 获取目标版本
    const history = await db.query(`
      SELECT * FROM version_history
      WHERE target_id = '${atomId}'
      AND version = ${targetVersion}
    `);

    if (history.length === 0) {
      throw new Error(`版本 ${targetVersion} 不存在`);
    }

    // 2. 恢复数据
    const oldData = history[0].data;
    await db.update(`atom:${atomId}`, {
      ...oldData,
      version: targetVersion + 1, // 新版本号
      updated_at: new Date(),
    });

    // 3. 记录回滚
    await db.create("version_history", {
      target_id: atomId,
      target_type: "atom",
      version: targetVersion + 1,
      data: oldData,
      changed_by: "system",
      change_reason: `回滚到版本 ${targetVersion}`,
    });

    return { id: atomId, version: targetVersion + 1 };
  }

  async getVersionHistory(atomId, limit = 10) {
    return await db.query(`
      SELECT * FROM version_history
      WHERE target_id = '${atomId}'
      ORDER BY version DESC
      LIMIT ${limit}
    `);
  }
}
```

---

### 9.4 并发控制

**问题**：多个文件同时保存时的预计算并发处理

**并发控制方案**：

```javascript
// 并发控制
class ConcurrencyControl {
  constructor() {
    this.processing = new Set(); // 正在处理的文件
    this.queue = []; // 等待队列
    this.maxConcurrency = 5; // 最大并发数
  }

  async precompute(filePath, analysis) {
    // 1. 检查是否已在处理
    if (this.processing.has(filePath)) {
      // 去重：如果同一文件正在处理，跳过
      console.log(`文件 ${filePath} 正在处理，跳过`);
      return { skipped: true, reason: "already_processing" };
    }

    // 2. 检查并发数
    if (this.processing.size >= this.maxConcurrency) {
      // 加入队列
      return new Promise((resolve, reject) => {
        this.queue.push({
          filePath,
          analysis,
          resolve,
          reject,
          timestamp: Date.now(),
        });
        console.log(
          `文件 ${filePath} 加入队列，当前队列长度: ${this.queue.length}`,
        );
      });
    }

    // 3. 开始处理
    this.processing.add(filePath);

    try {
      const result = await this.doPrecompute(filePath, analysis);
      return result;
    } finally {
      // 4. 处理完成
      this.processing.delete(filePath);

      // 5. 处理队列
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.queue.length === 0) return;
    if (this.processing.size >= this.maxConcurrency) return;

    // 取出队列中的任务（先进先出）
    const task = this.queue.shift();

    // 检查超时（超过 5 分钟的任务丢弃）
    if (Date.now() - task.timestamp > 5 * 60 * 1000) {
      task.reject(new Error("任务超时"));
      this.processQueue();
      return;
    }

    // 执行
    this.precompute(task.filePath, task.analysis)
      .then(task.resolve)
      .catch(task.reject);
  }

  // 批量处理优化
  async precomputeBatch(filePaths, analyses) {
    // 按文件路径排序，避免死锁
    const sorted = filePaths
      .map((path, i) => ({ path, analysis: analyses[i] }))
      .sort((a, b) => a.path.localeCompare(b.path));

    // 使用 Promise.all 控制并发
    const results = [];
    for (let i = 0; i < sorted.length; i += this.maxConcurrency) {
      const batch = sorted.slice(i, i + this.maxConcurrency);
      const batchResults = await Promise.all(
        batch.map(({ path, analysis }) => this.precompute(path, analysis)),
      );
      results.push(...batchResults);
    }

    return results;
  }
}
```

---

### 9.5 错误处理和重试机制

**问题**：预计算失败时如何处理

**错误处理方案**：

```javascript
// 错误处理和重试
class PrecomputeErrorHandler {
  constructor() {
    this.maxRetries = 3;
    this.retryableErrors = [
      "ECONNRESET", // 连接重置
      "ETIMEDOUT", // 超时
      "NETWORK_ERROR", // 网络错误
      "SERVICE_UNAVAILABLE", // 服务不可用
    ];
  }

  async precomputeWithRetry(filePath, analysis) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.precompute(filePath, analysis);
      } catch (error) {
        lastError = error;

        // 记录错误
        await this.logError(filePath, error, attempt);

        // 判断是否可重试
        if (!this.isRetryable(error)) {
          console.log(`错误不可重试: ${error.message}`);
          break;
        }

        // 最后一次尝试，不再重试
        if (attempt === this.maxRetries) {
          console.log(`达到最大重试次数: ${this.maxRetries}`);
          break;
        }

        // 指数退避
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.log(`第 ${attempt} 次失败，${delay}ms 后重试...`);
        await this.sleep(delay);
      }
    }

    // 所有重试都失败，保存到失败队列
    await this.enqueueFailed(filePath, analysis, lastError);

    // 通知（可选）
    await this.notifyFailure(filePath, lastError);

    throw lastError;
  }

  isRetryable(error) {
    // 检查错误类型是否可重试
    if (this.retryableErrors.includes(error.code)) {
      return true;
    }

    // 检查 HTTP 状态码
    if (error.statusCode >= 500 && error.statusCode < 600) {
      return true;
    }

    return false;
  }

  async enqueueFailed(filePath, analysis, error) {
    await db.create("failed_precompute", {
      file_path: filePath,
      analysis: analysis,
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
      },
      failed_at: new Date(),
      retry_count: 0,
      status: "pending", // pending | processing | resolved | abandoned
    });
  }

  // 失败队列重试（定时任务）
  async retryFailed() {
    const failed = await db.query(`
      SELECT * FROM failed_precompute
      WHERE status = 'pending'
      AND retry_count < 3
      ORDER BY failed_at ASC
      LIMIT 10
    `);

    for (const item of failed) {
      try {
        await db.update(`failed_precompute:${item.id}`, {
          status: "processing",
        });

        await this.precompute(item.file_path, item.analysis);

        await db.update(`failed_precompute:${item.id}`, {
          status: "resolved",
          resolved_at: new Date(),
        });
      } catch (error) {
        await db.update(`failed_precompute:${item.id}`, {
          retry_count: item.retry_count + 1,
          last_error: error.message,
          status: item.retry_count >= 2 ? "abandoned" : "pending",
        });
      }
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## 10. 风险与应对（更新版）

| 风险           | 影响 | 应对措施                           | 状态              |
| -------------- | ---- | ---------------------------------- | ----------------- |
| 预计算性能问题 | 高   | 异步处理、增量更新、队列限流       | ✅ 已补充增量更新 |
| 数据迁移失败   | 高   | 备份现有数据、分阶段迁移、回滚方案 | ✅ 已补充迁移方案 |
| API 不兼容     | 中   | 保持向后兼容、版本控制、灰度发布   | ✅ 已补充版本控制 |
| 存储空间不足   | 中   | 数据压缩、过期清理、分片存储       | -                 |
| Agent 使用复杂 | 低   | 提供示例、文档、简化默认参数       | -                 |
| 并发冲突       | 中   | 并发控制、队列管理、去重机制       | ✅ 已补充并发控制 |
| 预计算失败     | 中   | 错误分类、重试机制、失败队列       | ✅ 已补充错误处理 |

---

## 参考文档

- [UNIFIED-ARCHITECTURE-v2.0.md](./UNIFIED-ARCHITECTURE-v2.0.md)
- [UNIFIED-ARCHITECTURE-v3.0-DRAFT.md](./UNIFIED-ARCHITECTURE-v3.0-DRAFT.md)
- [COMPETITIVE-ANALYSIS-REPORT.md](./COMPETITIVE-ANALYSIS-REPORT.md)
- [BACKLOG_API_DESIGN.md](./BACKLOG_API_DESIGN.md)
- [CODE-ANALYSIS-DESIGN-v1.4.md](./CODE-ANALYSIS-DESIGN-v1.4.md)

---

_文档版本: v3.0.0_  
_最后更新: 2026-04-09_  
_状态: 实施版_
