# v3.2 架构修复实施方案

> **版本**: 1.0  
> **日期**: 2026-04-19  
> **状态**: 待实施  
> **策略**: 开发期间不迁移，新旧系统并行运行

---

## 目录

1. [问题确认](#一问题确认)
2. [Atom/Entity 架构理解](#二atomentity-架构完整理解)
3. [Tree-sitter Query 理解](#三tree-sitter-query-api-完整理解)
4. [修复方案](#四详细修复方案)
5. [实施时间表](#五实施时间表)
6. [验收标准](#六验收标准)
7. [风险与缓解](#七风险与缓解)

---

## 一、问题确认

### 1.1 已确认的问题

| #     | 问题                             | 确认结果                                       | 严重程度    |
| ----- | -------------------------------- | ---------------------------------------------- | ----------- |
| **1** | **Atom/Entity API 缺失**         | ✅ 确认 - 后端无 router，插件无调用            | 🔴 **严重** |
| **2** | **Schema 不一致**                | ✅ 确认 - 实际用 memory 表，设计为 atom/entity | 🟡 中等     |
| **3** | **Tree-sitter Query API 未使用** | ✅ 确认 - 使用树遍历，性能差距 3.32x           | 🟡 中等     |

### 1.2 根本原因

```
文档设计 (v3.2)          实际实现
─────────────────────────────────────────
Atom/Entity/Reference    Memory (简化版)
Query API (高性能)       树遍历 (低性能)
四层架构                 两层架构
```

**关键发现**: 后端 SurrealDB schema 文件 `init_surrealdb_v3.2.surql` **已定义** atom/entity/reference 表，但：

1. **未使用** - 实际运行的是 `init_surrealdb.surql`（只有 memory 表）
2. **无 API** - 后端没有 atom/entity/reference 的 router
3. **无调用** - 插件端没有调用 atom/entity API 的代码

---

## 二、Atom/Entity 架构完整理解

### 2.1 核心概念

**Atom（原子）** = 最小不可分知识单元

- **类型**: `function`, `class`, `interface`, `import`, `goal`, `scope`, `task`, `note`
- **存储**: 函数源码、签名、参数、返回值、复杂度、行号范围
- **特点**: 独立存在，可被多个 Entity 引用

**Entity（实体）** = 知识聚合单元

- **类型**: `memory`, `backlog`, `wiki`, `code`
- **组成**:
  - L0: `abstract` (≤100字符) - 快速扫描
  - L1: `overview` (≤500字符) - 摘要预览
  - L2: `atoms[]` (Atom ID 列表) - 完整详情
- **特点**: 通过 `atoms` 字段聚合多个 Atom

**Reference（关系）** = 图连接边

- **类型**: `calls`, `imports`, `depends_on`, `implements`, `wiki_link`, `part_of`
- **特点**: SurrealDB 原生 `RELATION` 类型，自动维护双向

### 2.2 数据流示例

```
源代码文件 (src/utils.ts)
    ↓ 解析
┌─────────────────────────────────────────┐
│ Atom: func-1 (analyzeCode)              │
│   - type: function                      │
│   - content: "function analyzeCode..."  │
│   - name: "analyzeCode"                 │
│   - signature: "(file: string)"         │
│   - start_line: 10                      │
│   - end_line: 25                        │
└─────────────────────────────────────────┘
    ↓ 聚合
┌─────────────────────────────────────────┐
│ Entity: code-1 (src/utils.ts)           │
│   - type: code                          │
│   - abstract: "File with 3 functions"   │
│   - overview: {                         │
│       language: "typescript",           │
│       function_count: 3,                │
│       lines: 150                        │
│     }                                   │
│   - atoms: [func-1, func-2, func-3]     │
└─────────────────────────────────────────┘
    ↓ 关系
Reference: func-1 --calls--> func-2
```

### 2.3 为什么这样设计？

| 设计决策         | 原因                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Atom/Entity 分离 | 代码分析需要细粒度（函数级），知识管理需要粗粒度（文件级）             |
| L0/L1/L2 分层    | 渐进加载：列表看 abstract，预览看 overview，详情加载 atoms             |
| SurrealDB RELATE | 原生图操作，无需 JOIN，支持复杂遍历（如 "找出所有调用 func-A 的函数"） |
| ChangeFeed       | 实时同步，WebSocket 推送变更                                           |

---

## 三、Tree-sitter Query API 完整理解

### 3.1 当前实现 vs Query API

**当前（树遍历）**:

```javascript
// 递归遍历所有节点，O(n) 时间复杂度
function extractPythonSymbols(node, collectors) {
  if (node.type === "function_definition") {
    const nameNode = node.childForFieldName("name");
    // 手动提取...
  }
  for (const child of node.children) {
    extractPythonSymbols(child, collectors); // 递归
  }
}
```

- **问题**: 访问每个节点，无法跳过不相关分支
- **性能**: 基准（慢）

**目标（Query API）**:

```javascript
// 声明式查询，NFA 状态机匹配
const query = new Parser.Query(
  language,
  `
  (function_definition
    name: (identifier) @func.name
    parameters: (parameters) @func.params)
`,
);

const matches = query.matches(tree.rootNode);
```

- **优势**: 跳过不相关节点，只返回匹配
- **性能**: 3.32x 更快

### 3.2 Query 语法示例

```scheme
; 匹配函数定义
(function_definition
  name: (identifier) @func.name
  parameters: (parameters) @func.params
  return_type: (type)? @func.return)

; 匹配类定义
(class_definition
  name: (identifier) @class.name
  body: (block
    (function_definition
      name: (identifier) @class.method.name)*))

; 匹配导入
(import_statement
  name: (dotted_name) @import.source)

; 匹配函数调用
(call
  function: [
    (identifier) @call.name
    (attribute
      object: (identifier) @call.object
      attribute: (identifier) @call.method)
  ])
```

---

## 四、详细修复方案

### 策略说明

**开发期间**: 新旧系统并行运行，不强制迁移

- 新功能使用 Atom/Entity/Reference API
- 旧功能继续使用 Memory API
- 两者通过 tenant_id 隔离

---

### 阶段1：后端 Atom/Entity/Reference API（2周）

#### 4.1.1 创建 Atom Router

**文件**: `D:\embedding_service\wrapper\src\routers\atom.py`

```python
"""Atom CRUD 端点 - 原子级知识单元管理"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from .. import state
from ..models import AtomCreateRequest, AtomUpdateRequest, AtomResponse

router = APIRouter(prefix="/api/v1", tags=["atoms"])


@router.post("/atoms", response_model=AtomResponse)
async def create_atom(request: AtomCreateRequest):
    """
    创建 Atom

    Atom 是最小知识单元，可以是：
    - function: 函数定义
    - class: 类定义
    - interface: 接口定义
    - import: 导入语句
    - goal/scope/task/note: 知识管理单元
    """
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        atom_data = {
            "type": request.type,
            "content": request.content,
            "tenant_id": request.tenant_id or "default",
            "name": request.name,
            "signature": request.signature,
            "params": request.params or [],
            "return_type": request.return_type,
            "is_exported": request.is_exported,
            "is_async": request.is_async,
            "complexity": request.complexity,
            "start_line": request.start_line,
            "end_line": request.end_line,
            "metadata": request.metadata or {},
            "version": 1,
        }

        result = await db.create("atom", atom_data)

        return AtomResponse(
            id=result[0]["id"],
            **atom_data,
            created_at=result[0].get("created_at"),
            updated_at=result[0].get("updated_at"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建 Atom 失败: {e}")


@router.get("/atoms/{atom_id}")
async def get_atom(atom_id: str, tenant_id: str = Query(default="default")):
    """获取 Atom 详情"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db
        result = await db.query(
            f"SELECT * FROM atom WHERE id = '{atom_id}' AND tenant_id = '{tenant_id}'"
        )

        if not result or len(result) == 0:
            raise HTTPException(status_code=404, detail="Atom 不存在")

        return result[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")


@router.get("/atoms")
async def list_atoms(
    type: Optional[str] = Query(None, description="Atom 类型过滤"),
    project: Optional[str] = Query(None),
    tenant_id: str = Query(default="default"),
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0),
):
    """列出 Atoms"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        conditions = [f"tenant_id = '{tenant_id}'"]
        if type:
            conditions.append(f"type = '{type}'")
        if project:
            conditions.append(f"project = '{project}'")

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT * FROM atom
        WHERE {where_clause}
        LIMIT {limit} START {offset}
        """

        result = await db.query(query)
        return result or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")


@router.put("/atoms/{atom_id}")
async def update_atom(atom_id: str, request: AtomUpdateRequest):
    """更新 Atom"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        update_data = {}
        for field, value in request.model_dump(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value

        update_data["updated_at"] = "time::now()"
        update_data["version"] = "version + 1"

        result = await db.update(atom_id, update_data)

        if not result:
            raise HTTPException(status_code=404, detail="Atom 不存在")

        return result[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新失败: {e}")


@router.delete("/atoms/{atom_id}")
async def delete_atom(atom_id: str, tenant_id: str = Query(default="default")):
    """删除 Atom"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        check = await db.query(
            f"SELECT id FROM atom WHERE id = '{atom_id}' AND tenant_id = '{tenant_id}'"
        )
        if not check:
            raise HTTPException(status_code=404, detail="Atom 不存在")

        await db.delete(atom_id)

        return {"success": True, "message": "Atom 已删除"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {e}")
```

#### 4.1.2 创建 Entity Router

**文件**: `D:\embedding_service\wrapper\src\routers\entity.py`

```python
"""Entity CRUD 端点 - 知识实体管理"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Literal
from .. import state
from ..models import EntityCreateRequest, EntityResponse

router = APIRouter(prefix="/api/v1", tags=["entities"])


@router.post("/entities", response_model=EntityResponse)
async def create_entity(request: EntityCreateRequest):
    """
    创建 Entity

    Entity 是知识聚合单元，包含 L0/L1/L2 分层：
    - L0 (abstract): ≤100字符，用于列表展示
    - L1 (overview): ≤500字符，用于预览
    - L2 (atoms): Atom ID 列表，完整详情
    """
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        entity_data = {
            "type": request.type,
            "tenant_id": request.tenant_id or "default",
            "abstract": request.abstract,
            "overview": request.overview or {},
            "atoms": request.atoms or [],
            "tags": request.tags or [],
            "project": request.project,
            "created_by": request.created_by,
        }

        # 类型特定字段
        if request.type == "wiki":
            entity_data.update({
                "title": request.title,
                "aliases": request.aliases or [],
            })
        elif request.type == "backlog":
            entity_data.update({
                "priority": request.priority,
                "status": request.status,
                "scene": request.scene,
                "estimated_hours": request.estimated_hours,
                "actual_hours": request.actual_hours,
            })
        elif request.type == "code":
            entity_data.update({
                "file_path": request.file_path,
                "language": request.language,
                "quality_score": request.quality_score,
                "complexity_metrics": request.complexity_metrics,
            })

        result = await db.create("entity", entity_data)

        return EntityResponse(
            id=result[0]["id"],
            **entity_data,
            created_at=result[0].get("created_at"),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建 Entity 失败: {e}")


@router.get("/entities/{entity_id}")
async def get_entity(
    entity_id: str,
    level: Literal[0, 1, 2] = Query(default=2, description="返回层级"),
    tenant_id: str = Query(default="default"),
):
    """
    获取 Entity

    Args:
        level: 0=abstract only, 1=abstract+overview, 2=full with atoms
    """
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        if level == 0:
            query = f"""
            SELECT id, type, abstract, tenant_id, created_at
            FROM entity
            WHERE id = '{entity_id}' AND tenant_id = '{tenant_id}'
            """
        elif level == 1:
            query = f"""
            SELECT id, type, abstract, overview, tags, project, created_at
            FROM entity
            WHERE id = '{entity_id}' AND tenant_id = '{tenant_id}'
            """
        else:
            query = f"""
            SELECT *, atoms.*
            FROM entity
            WHERE id = '{entity_id}' AND tenant_id = '{tenant_id}'
            """

        result = await db.query(query)

        if not result or len(result) == 0:
            raise HTTPException(status_code=404, detail="Entity 不存在")

        return result[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")


@router.get("/entities")
async def list_entities(
    type: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tenant_id: str = Query(default="default"),
    limit: int = Query(default=50),
    offset: int = Query(default=0),
):
    """列出 Entities"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        conditions = [f"tenant_id = '{tenant_id}'"]
        if type:
            conditions.append(f"type = '{type}'")
        if project:
            conditions.append(f"project = '{project}'")
        if status:
            conditions.append(f"status = '{status}'")

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT id, type, abstract, tags, status, project, created_at
        FROM entity
        WHERE {where_clause}
        LIMIT {limit} START {offset}
        """

        result = await db.query(query)
        return result or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")
```

#### 4.1.3 创建 Reference Router

**文件**: `D:\embedding_service\wrapper\src\routers\reference.py`

```python
"""Reference (Graph Relation) 端点 - 图关系管理"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Literal, Optional
from .. import state
from ..models import ReferenceCreateRequest, ReferenceResponse

router = APIRouter(prefix="/api/v1", tags=["references"])


@router.post("/references", response_model=ReferenceResponse)
async def create_reference(request: ReferenceCreateRequest):
    """
    创建关系 (Atom-Atom, Atom-Entity, Entity-Entity)

    使用 SurrealDB RELATE 语法创建原生图关系：
    RELATE atom:xxx->reference->atom:yyy
    """
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        query = f"""
        RELATE {request.from_id}->reference->{request.to_id} CONTENT {{
            type: '{request.type}',
            tenant_id: '{request.tenant_id or "default"}',
            weight: {request.weight or 0.5},
            file_path: '{request.file_path or ""}',
            line: {request.line or 'NONE'},
            column: {request.column or 'NONE'},
            metadata: {request.metadata or '{}'}
        }}
        """

        result = await db.query(query)

        if not result or len(result) == 0:
            raise HTTPException(status_code=500, detail="创建关系失败")

        return ReferenceResponse(
            id=result[0]["id"],
            from_id=request.from_id,
            to_id=request.to_id,
            type=request.type,
            weight=request.weight or 0.5,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建关系失败: {e}")


@router.get("/references")
async def query_references(
    from_id: Optional[str] = Query(None),
    to_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    tenant_id: str = Query(default="default"),
    limit: int = Query(default=50),
):
    """查询关系"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        if from_id:
            query = f"""
            SELECT * FROM {from_id}->reference
            WHERE tenant_id = '{tenant_id}'
            """
            if type:
                query += f" AND type = '{type}'"
            query += f" LIMIT {limit}"
        elif to_id:
            query = f"""
            SELECT * FROM <-reference-{to_id}
            WHERE tenant_id = '{tenant_id}'
            """
            if type:
                query += f" AND type = '{type}'"
            query += f" LIMIT {limit}"
        else:
            conditions = [f"tenant_id = '{tenant_id}'"]
            if type:
                conditions.append(f"type = '{type}'")

            where_clause = " AND ".join(conditions)
            query = f"""
            SELECT * FROM reference
            WHERE {where_clause}
            LIMIT {limit}
            """

        result = await db.query(query)
        return result or []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {e}")


@router.delete("/references/{reference_id}")
async def delete_reference(reference_id: str, tenant_id: str = Query(default="default")):
    """删除关系"""
    if not state.memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager未初始化")

    try:
        db = state.memory_manager.db

        check = await db.query(
            f"SELECT id FROM reference WHERE id = '{reference_id}' AND tenant_id = '{tenant_id}'"
        )
        if not check:
            raise HTTPException(status_code=404, detail="关系不存在")

        await db.delete(reference_id)

        return {"success": True, "message": "关系已删除"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {e}")
```

#### 4.1.4 更新 main.py 注册 Routers

```python
# D:\embedding_service\wrapper\src\main.py

from .routers import (
    atom,        # 新增
    entity,      # 新增
    reference,   # 新增
    memories,    # 保留兼容
    relations,   # 保留兼容
    search,
    sync,
    websocket,
    precompute,
    # ... 其他
)

# 注册 routers
app.include_router(atom.router, prefix="/api/v1")
app.include_router(entity.router, prefix="/api/v1")
app.include_router(reference.router, prefix="/api/v1")
app.include_router(memories.router)  # 保留旧 API
app.include_router(relations.router)  # 保留旧 API
# ...
```

---

### 阶段2：Tree-sitter Query 实现（1周）

#### 4.2.1 创建 Query 文件

**文件**: `D:\github\opencode-memory-plugin\opencode-memory-plugin\lib\queries\javascript.scm`

```scheme
;; JavaScript/TypeScript Queries for Code Analysis

;; ============ Function Definitions ============
(function_declaration
  "async"? @func.async
  "function"? @func.keyword
  name: (identifier) @func.name
  parameters: (formal_parameters) @func.params
  return_type: (type_annotation)? @func.return_type
  body: (statement_block) @func.body
) @function

(arrow_function
  "async"? @func.async
  parameters: [
    (formal_parameters) @func.params
    (identifier) @func.params
  ]
  return_type: (type_annotation)? @func.return_type
  body: [
    (statement_block) @func.body
    (_) @func.body
  ]
) @arrow_function

(method_definition
  "async"? @method.async
  "static"? @method.static
  name: (property_identifier) @method.name
  parameters: (formal_parameters) @method.params
  return_type: (type_annotation)? @method.return_type
  body: (statement_block) @method.body
) @method

;; ============ Class Definitions ============
(class_declaration
  "class" @class.keyword
  name: (type_identifier) @class.name
  super_class: (class_heritage)? @class.extends
  body: (class_body) @class.body
) @class

;; ============ Import Statements ============
(import_statement
  "import" @import.keyword
  source: (string) @import.source
) @import

(import_statement
  "import" @import.keyword
  (import_clause
    [
      (identifier) @import.default
      (named_imports
        (import_specifier
          name: (identifier) @import.name))
    ])
  "from"?
  source: (string) @import.source
) @import

;; ============ Function Calls ============
(call_expression
  function: [
    (identifier) @call.name
    (member_expression
      object: (_) @call.object
      property: (property_identifier) @call.method)
  ]
  arguments: (arguments) @call.args
) @call
```

**文件**: `D:\github\opencode-memory-plugin\opencode-memory-plugin\lib\queries\python.scm`

```scheme
;; Python Queries for Code Analysis

(function_definition
  "async"? @func.async
  "def" @func.keyword
  name: (identifier) @func.name
  parameters: (parameters) @func.params
  return_type: (type)? @func.return_type
  body: (block) @func.body
) @function

(class_definition
  "class" @class.keyword
  name: (identifier) @class.name
  superclasses: (argument_list)? @class.bases
  body: (block) @class.body
) @class

(import_statement
  "import" @import.keyword
  name: (dotted_name) @import.name
) @import

(import_from_statement
  "from" @import.from
  module: (dotted_name) @import.module
  "import" @import.keyword
  names: [
    (wildcard_import) @import.wildcard
    (import_from_as_names
      (import_from_as_name
        name: (identifier) @import.name))
  ]
) @import_from
```

#### 4.2.2 更新 tree-sitter-parser.js

**文件**: `D:\github\opencode-memory-plugin\opencode-memory-plugin\lib\tree-sitter-parser.js`

```javascript
import * as Parser from "web-tree-sitter";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载 Query 文件
const QUERIES = {};
let parserInitialized = false;
let languageCache = new Map();

/**
 * 初始化 Parser
 */
async function initParser() {
  if (parserInitialized) return;

  await Parser.init();
  parserInitialized = true;

  // 预加载所有语言的 Query
  const languages = [
    "javascript",
    "typescript",
    "python",
    "go",
    "rust",
    "java",
  ];
  for (const lang of languages) {
    try {
      const queryPath = join(__dirname, "queries", `${lang}.scm`);
      const querySource = readFileSync(queryPath, "utf-8");
      QUERIES[lang] = querySource;
    } catch (e) {
      console.warn(`[TreeSitter] Query file not found for ${lang}`);
    }
  }
}

/**
 * 使用 Query API 分析代码
 */
export async function analyzeWithQuery(sourceCode, language) {
  const lang = await loadLanguage(language);
  const parser = new Parser();
  parser.setLanguage(lang);

  const tree = parser.parse(sourceCode);
  const rootNode = tree.rootNode;

  const querySource = QUERIES[language];
  if (!querySource) {
    throw new Error(`No query defined for language: ${language}`);
  }

  const query = new Parser.Query(lang, querySource);
  const matches = query.matches(rootNode);

  const symbols = {
    functions: [],
    classes: [],
    interfaces: [],
    imports: [],
    exports: [],
    calls: [],
  };

  for (const match of matches) {
    const captures = match.captures;

    // 提取函数
    const funcCapture = captures.find((c) => c.name === "function");
    if (funcCapture) {
      const name = captures.find((c) => c.name === "func.name")?.node.text;
      const params = captures.find((c) => c.name === "func.params")?.node.text;
      const returnType = captures.find((c) => c.name === "func.return_type")
        ?.node.text;
      const isAsync = captures.some((c) => c.name === "func.async");

      if (name) {
        symbols.functions.push({
          name,
          params,
          return_type: returnType,
          is_async: isAsync,
          line: funcCapture.node.startPosition.row + 1,
        });
      }
    }

    // 提取类
    const classCapture = captures.find((c) => c.name === "class");
    if (classCapture) {
      const name = captures.find((c) => c.name === "class.name")?.node.text;
      if (name) {
        symbols.classes.push({
          name,
          line: classCapture.node.startPosition.row + 1,
        });
      }
    }

    // 提取导入
    const importCapture = captures.find((c) => c.name === "import");
    if (importCapture) {
      const source = captures.find((c) => c.name === "import.source")?.node
        .text;
      if (source) {
        symbols.imports.push({
          source: source.replace(/['"]/g, ""),
          line: importCapture.node.startPosition.row + 1,
        });
      }
    }
  }

  return {
    language,
    analyzer: "tree-sitter-query",
    analyzed_at: new Date().toISOString(),
    ...symbols,
  };
}

/**
 * 主分析函数（带 fallback）
 */
export async function analyzeWithTreeSitter(sourceCode, language) {
  try {
    // 尝试使用 Query API
    return await analyzeWithQuery(sourceCode, language);
  } catch (error) {
    console.warn("[TreeSitter] Query API failed, falling back:", error.message);
    // 降级到树遍历（保留旧实现）
    return await analyzeWithTreeWalking(sourceCode, language);
  }
}
```

---

### 阶段3：插件端更新（1周）

#### 4.3.1 更新 WrapperClient

**文件**: `D:\github\opencode-memory-plugin\opencode-memory-plugin\lib\wrapper-client.js`

```javascript
export class WrapperClient {
  // ... 现有代码 ...

  // ==================== Atom API (新增) ====================

  async createAtom(atomData) {
    return await this.http.post("/api/v1/atoms", atomData);
  }

  async getAtom(atomId, tenant_id = "default") {
    return await this.http.get(
      `/api/v1/atoms/${atomId}?tenant_id=${tenant_id}`,
    );
  }

  async listAtoms({ type, project, tenant_id = "default", limit = 50 } = {}) {
    const params = new URLSearchParams({ tenant_id, limit: String(limit) });
    if (type) params.set("type", type);
    if (project) params.set("project", project);
    return await this.http.get(`/api/v1/atoms?${params.toString()}`);
  }

  async updateAtom(atomId, updates) {
    return await this.http.put(`/api/v1/atoms/${atomId}`, updates);
  }

  async deleteAtom(atomId, tenant_id = "default") {
    return await this.http.delete(
      `/api/v1/atoms/${atomId}?tenant_id=${tenant_id}`,
    );
  }

  // ==================== Entity API (新增) ====================

  async createEntity(entityData) {
    return await this.http.post("/api/v1/entities", entityData);
  }

  async getEntity(entityId, level = 2, tenant_id = "default") {
    return await this.http.get(
      `/api/v1/entities/${entityId}?level=${level}&tenant_id=${tenant_id}`,
    );
  }

  async listEntities({
    type,
    project,
    status,
    tenant_id = "default",
    limit = 50,
  } = {}) {
    const params = new URLSearchParams({ tenant_id, limit: String(limit) });
    if (type) params.set("type", type);
    if (project) params.set("project", project);
    if (status) params.set("status", status);
    return await this.http.get(`/api/v1/entities?${params.toString()}`);
  }

  // ==================== Reference API (新增) ====================

  async createReference(from_id, to_id, type, weight = 0.5, metadata = {}) {
    return await this.http.post("/api/v1/references", {
      from_id,
      to_id,
      type,
      weight,
      ...metadata,
    });
  }

  async queryReferences({
    from_id,
    to_id,
    type,
    tenant_id = "default",
    limit = 50,
  } = {}) {
    const params = new URLSearchParams({ tenant_id, limit: String(limit) });
    if (from_id) params.set("from_id", from_id);
    if (to_id) params.set("to_id", to_id);
    if (type) params.set("type", type);
    return await this.http.get(`/api/v1/references?${params.toString()}`);
  }

  async deleteReference(referenceId, tenant_id = "default") {
    return await this.http.delete(
      `/api/v1/references/${referenceId}?tenant_id=${tenant_id}`,
    );
  }

  // ==================== 保留旧 API (兼容) ====================

  async uploadMemory(memory) {
    return await this.http.post("/api/v1/memories", memory);
  }

  // ... 其他旧 API ...
}
```

#### 4.3.2 更新 Code Analysis Service

**文件**: `D:\github\opencode-memory-plugin\opencode-memory-plugin\lib\code-analysis-service.js`

```javascript
export async function onFileSaved(filePath, projectRoot) {
  // 1. 分析代码（使用 Query API）
  const analysis = await analyzeCode(filePath);

  // 2. 创建 Atoms
  const atoms = [];

  // 为每个函数创建 Atom
  for (const func of analysis.functions) {
    const atom = await wrapperClient.createAtom({
      type: "function",
      name: func.name,
      content: func.source || "",
      signature: func.signature,
      params: func.params,
      return_type: func.return_type,
      is_async: func.is_async,
      is_exported: func.is_exported,
      start_line: func.line,
      tenant_id: "default",
    });
    atoms.push({ id: atom.id, type: "function", name: func.name });
  }

  // 为每个类创建 Atom
  for (const cls of analysis.classes) {
    const atom = await wrapperClient.createAtom({
      type: "class",
      name: cls.name,
      content: "",
      start_line: cls.line,
      tenant_id: "default",
    });
    atoms.push({ id: atom.id, type: "class", name: cls.name });
  }

  // 3. 创建 Entity（文件级别）
  const entity = await wrapperClient.createEntity({
    type: "code",
    abstract: `File with ${atoms.length} symbols`,
    overview: {
      language: analysis.language,
      file_path: filePath,
      function_count: analysis.functions.length,
      class_count: analysis.classes.length,
    },
    atoms: atoms.map((a) => a.id),
    file_path: filePath,
    language: analysis.language,
    tenant_id: "default",
  });

  // 4. 创建 References（调用关系）
  for (const call of analysis.calls) {
    const calleeAtom = atoms.find(
      (a) => a.type === "function" && a.name === call.name,
    );

    if (calleeAtom) {
      await wrapperClient.createReference(
        entity.id,
        calleeAtom.id,
        "calls",
        0.8,
        { line: call.line, file_path: filePath },
      );
    }
  }

  console.log(
    `[CodeAnalysis] Created ${atoms.length} atoms, 1 entity for ${filePath}`,
  );
}
```

---

## 五、实施时间表

| 周         | 任务                           | 交付物                                 | 负责人   |
| ---------- | ------------------------------ | -------------------------------------- | -------- |
| **Week 1** | 后端 Atom/Entity/Reference API | `atom.py`, `entity.py`, `reference.py` | 后端开发 |
| **Week 2** | 后端集成测试                   | API 测试通过，文档更新                 | 后端开发 |
| **Week 3** | Tree-sitter Query 实现         | Query 文件，更新 parser                | 插件开发 |
| **Week 4** | 插件端更新 + 集成测试          | 更新 wrapper-client, code-analysis     | 插件开发 |
| **Week 5** | 端到端测试 + 文档更新          | 测试报告，更新文档                     | 联合测试 |

---

## 六、验收标准

### 6.1 Atom API

- [ ] POST /api/v1/atoms - 创建 Atom
- [ ] GET /api/v1/atoms/{id} - 获取 Atom
- [ ] GET /api/v1/atoms - 列出 Atoms
- [ ] PUT /api/v1/atoms/{id} - 更新 Atom
- [ ] DELETE /api/v1/atoms/{id} - 删除 Atom

### 6.2 Entity API

- [ ] POST /api/v1/entities - 创建 Entity
- [ ] GET /api/v1/entities/{id}?level=0/1/2 - 获取 Entity（支持分层）
- [ ] GET /api/v1/entities - 列出 Entities
- [ ] Entity.atoms 正确关联 Atom IDs

### 6.3 Reference API

- [ ] POST /api/v1/references - 创建关系（使用 SurrealDB RELATE）
- [ ] GET /api/v1/references - 查询关系（支持图遍历）
- [ ] DELETE /api/v1/references/{id} - 删除关系

### 6.4 Tree-sitter Query

- [ ] Query API 性能提升 > 2x
- [ ] 支持 JavaScript/TypeScript/Python/Go/Rust/Java
- [ ] 降级到树遍历机制工作正常

### 6.5 集成

- [ ] 代码保存自动创建 Atom + Entity + Reference
- [ ] 端到端测试通过
- [ ] 新旧 API 并行运行无冲突

---

## 七、风险与缓解

| 风险             | 影响 | 缓解措施                          |
| ---------------- | ---- | --------------------------------- |
| Query API 不稳定 | 中   | 保留树遍历作为 fallback；A/B 测试 |
| 性能不达预期     | 中   | 渐进式切换；监控性能指标          |
| 插件兼容性问题   | 高   | 保留旧 API；双模式运行            |
| 开发延期         | 中   | 分阶段交付；优先核心功能          |

---

## 附录

### A. 文件清单

**后端新增文件**:

- `wrapper/src/routers/atom.py`
- `wrapper/src/routers/entity.py`
- `wrapper/src/routers/reference.py`

**插件新增文件**:

- `lib/queries/javascript.scm`
- `lib/queries/typescript.scm`
- `lib/queries/python.scm`
- `lib/queries/go.scm`
- `lib/queries/rust.scm`
- `lib/queries/java.scm`

**修改文件**:

- `wrapper/src/main.py` - 注册 routers
- `lib/tree-sitter-parser.js` - 添加 Query 支持
- `lib/wrapper-client.js` - 添加新 API
- `lib/code-analysis-service.js` - 使用新 API

### B. 参考文档

- [Tree-sitter Query Syntax](https://tree-sitter.github.io/tree-sitter/using-parsers/queries/1-syntax.html)
- [SurrealDB RELATE](https://surrealdb.com/docs/surrealql/statements/relate)
- [v3.2 架构设计](docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md)

---

**文档版本**: 1.0  
**最后更新**: 2026-04-19  
**状态**: 待实施
