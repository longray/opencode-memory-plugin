**统一架构 v3.2 完整实施方案（融合版）**

```markdown
# 统一架构 v3.2 设计方案（实施版）

> **版本**: v3.2.0  
> **日期**: 2026-04-10  
> **状态**: 实施版  
> **技术栈**: Python 3.10+ + SurrealDB 3.0+ + SDK 1.0.8  
> **服务端口**: 18008  
> **核心变更**: 单租户实施 + tenant_id 预留字段（多租户物理隔离暂缓至 SDK 2.0 stable）

---

## 目录

0. [附加](#0-拟变更依赖列表总结)
1. [设计原则](#1-设计原则)
2. [架构概览](#2-架构概览)
3. [数据模型](#3-数据模型)
4. [数据库 Schema](#4-数据库-schema)
5. [API 接口规范](#5-api-接口规范)
6. [WebSocket 实时同步设计](#6-websocket-实时同步设计)
7. [预计算服务设计](#7-预计算服务设计)
8. [Docker 多阶段构建方案](#8-docker-多阶段构建方案)
9. [实施计划](#9-实施计划)
10. [实现状态标注](#10-实现状态标注)
11. [关键遗漏项补充](#11-关键遗漏项补充)
12. [风险与应对](#12-风险与应对)

---

📋 拟变更依赖列表总结
🔵 插件端（Node.js）
依赖 当前版本
ws 8.19.0
pino ❌ 无
dotenv ❌ 无
不变更：

- @opencode-ai/plugin: ^1.0.0
- chokidar: ^5.0.0
- oxc-parser: ^0.121.0

---

🟢 后端记忆服务（Python）
依赖 当前版本
meilisearch ❌ 无 (httpx 调用)
不变更：

- surrealdb: >=1.0.0,<2.0.0 (保持 1.0.8)
- fastapi: >=0.115.0,<0.116.0
- uvicorn: >=0.32.0,<0.33.0
- pydantic: >=2.9.0,<2.10.0
- transformers: >=4.48.0
- torch: 2.4.0+cu121

---

📊 变更统计
组件 升级
插件端 1
后端 0
总计：2 个升级，3 个新增，0 个删除

---

📝 配置文件变更
插件端 package.json
{
"dependencies": {
"@opencode-ai/plugin": "^1.0.0",
"chokidar": "^5.0.0",
"oxc-parser": "^0.121.0",
"ws": "^8.20.0",
"pino": "^9.5.0",
"dotenv": "^16.4.5"
}
}
后端 pyproject.toml
dependencies = [
"fastapi>=0.115.0,<0.116.0",
"uvicorn[standard]>=0.32.0,<0.33.0",
"pydantic>=2.9.0,<2.10.0",
"surrealdb>=1.0.0,<2.0.0",
"meilisearch>=0.40.0,<0.41.0", # 新增 # ... 其他依赖
]

---

✅ 待办清单

- [ ] 插件端：升级 ws 8.19.0 → 8.20.0
- [ ] 插件端：新增 pino ^9.5.0
- [ ] 插件端：新增 dotenv ^16.4.5
- [ ] 后端：新增 meilisearch ^0.40.0
- [ ] 后端：替换 httpx 调用为 meilisearch SDK
- [ ] 测试：验证所有功能正常

---

## 1. 设计原则

### 1.1 核心原则（基于反馈确认）

| 原则               | 说明                                 | 决策依据                         |
| ------------------ | ------------------------------------ | -------------------------------- |
| **云端优先**       | 主要部署在云端，小型化后可本地部署   | 云端更适合 Agent 高频调用        |
| **Agent-Native**   | 为 Coding Agent 设计，不迁就人类习惯 | 无 GUI、无自动 LLM 处理          |
| **无后端 LLM**     | Agent 显式决策，系统只提供能力       | Agent 手动标注、手动建立关系     |
| **预计算加速**     | 文件保存时预计算，查询时快速响应     | 基于现有 code-analyzer.js        |
| **保留 v2.0 模型** | Atom/Entity/Relation 四层架构        | v2.0 内容全部需要                |
| **SurrealDB 3.0+** | 使用最新数据库特性                   | RELATE、COMPUTED、FULLTEXT       |
| **端口 18008**     | 新服务独立端口                       | 与现有 17999 服务隔离            |
| **Python 原生**    | 使用 Python 3.10+ + SDK 1.0.8        | 异步支持、Live Queries、类型安全 |

### 1.2 关键决策

- ✅ **多租户策略调整**: 暂缓 Namespace 物理隔离（SDK 2.0 alpha 不稳定），采用单租户 + `tenant_id` 预留字段方案，SDK 2.0 stable 后无缝迁移
- ✅ **Docker 已做**: 基础容器化已完成，Phase 1 包含多阶段构建优化
- ✅ **BACKLOG API 取消**: 融入当前设计方案，作为 Entity 类型实现
- ✅ **代码分析已实现**: CallSymbol 提取已完成（tree-sitter Query）
- ✅ **优先级**: 预计算服务优先
- ✅ **接口模式**: 插件工具 + CLI（无 MCP、无 IDE 集成）
- ✅ **SurrealDB 版本**: 使用 3.0+ 语法（`COMPUTED`, `FULLTEXT`, `type::record()`）
- ✅ **tree-sitter Query**: 验证通过，性能提升 3.32x，纳入 Phase 1
- ✅ **服务端口**: 新服务使用 18008（从 17999 迁移）
- ✅ **Agent-Native**: 无 GUI、无 IDE Integration（已取消）

---

## 2. 架构概览

### 2.1 四层架构（保留 v2.0 设计，简化表示层）
```

┌─────────────────────────────────────────────────────────────┐
│ 表示层 (Presentation) │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐ │
│ │ Markdown │ │ Wiki/MD │ │ Obsidian Vault │ │
│ │ (人类可读) │ │ (双向链接) │ │ (本地编辑) │ │
│ └─────────────┘ └─────────────┘ └─────────────────────┘ │
│ │
│ 【注：Agent-Native 设计，无 GUI、无 IDE 集成】 │
│ 【所有交互通过 Python FastAPI 进行】 │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 原子层 (Atomic Layer) │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │ Goal │ │ Scope │ │ Task │ │ Note │ │
│ │ (目标) │ │ (范围) │ │ (任务) │ │ (笔记) │ │
│ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │Function │ │ Class │ │Interface│ │ Import │ │
│ │ (函数) │ │ (类) │ │ (接口) │ │ (导入) │ │
│ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │
│ └─────────────┴─────────────┴────────────┘ │
│ │ │
│ ┌────────┴────────┐ │
│ │ Atom Relations │ │
│ │ • depends_on │ │
│ │ • blocks │ │
│ │ • calls │ ← 代码调用 │
│ │ • imports │ ← 代码导入 │
│ │ • implements │ ← 代码实现任务 │
│ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 实体层 (Entity Layer) │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│ │ Memory │ │ Backlog │ │ Wiki │ │ Code │ │
│ │ (记忆) │ │ (任务) │ │ (页面) │ │ (代码) │ │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│ └──────────────┼──────────────┴────────────┘ │
│ │ │
│ ┌────────┴────────┐ │
│ │ Entity Graph │ │
│ │ • wiki_link │ │
│ │ • implements │ ← 代码实现任务 │
│ │ • relates_to │ │
│ │ • part_of │ │
│ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ 存储层 (Storage Layer) │
│ ┌─────────────────┐ ┌─────────────────┐ │
│ │ SurrealDB │◄──►│ Meilisearch │ │
│ │ (主数据库) │ │ (搜索索引) │ │
│ │ │ │ │ │
│ │ • Entities │ │ • 全文搜索 │ │
│ │ • Atoms │ │ • 向量搜索 │ │
│ │ • Relations │ │ • 过滤排序 │ │
│ │ • Graph │ │ │ │
│ └─────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘

```

### 2.2 部署架构

```

┌─────────────────────────────────────────────────────────────┐
│ Cloud Deployment (主要) │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ API Gateway │ │
│ │ • 统一认证 (API Key) │ │
│ │ • 请求路由 │ │
│ │ • 限流/配额 │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Precompute Service │ │
│ │ • AST 解析 (tree-sitter) │ │
│ │ • 符号提取 │ │
│ │ • 引用解析 │ │
│ │ • 聚类 (Leiden) │ │
│ │ • 执行流追踪 │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Plugin Tool API │ │
│ │ • memory_write/search/read │ │
│ │ • code_analyze/navigate/impact │ │
│ │ • task_create/update │ │
│ │ • graph_traverse/query │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Storage Layer │ │
│ │ • SurrealDB 3.0+ (符号、关系、图谱) │ │
│ │ • Meilisearch (混合搜索索引) │ │
│ │ • 纯存储，无 LLM 处理 │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ Local Deployment (小型化后) │
│ docker-compose up │
│ • 同样的容器镜像（已存在） │
│ • 本地 SurrealDB 3.0+ + Meilisearch │
│ • 同样的插件工具接口 │
│ • 服务端口: 18008 │
└─────────────────────────────────────────────────────────────┘

````

**端口配置更新**:

- 新服务端口: **18008** (从 17999 迁移)
- SurrealDB 端口: 8000 (保持不变)
- Meilisearch 端口: 7700 (保持不变)

---

## 3. 数据模型

### 3.1 Atom（原子单元）- 最小知识单元

```python
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

@dataclass
class Atom:
    """
    原子单元 - 最小知识单元

    对应 SurrealDB atom 表
    """
    # 基础字段（所有 Atom 共有）
    id: Optional[str] = None  # ULID，如 "atom:01HQ..."
    type: str  # function | class | interface | import | goal | scope | task | note
    content: str  # 内容（函数源码、任务描述等）
    tenant_id: str = "default"  # v3.2: 预留字段，当前固定为 "default"

    # 状态（用于 task 类型）
    status: Optional[str] = None  # pending | done | blocked

    # 代码特有字段（Function/Class/Interface）
    name: Optional[str] = None  # 函数/类名
    signature: Optional[str] = None  # 函数签名
    params: List[Dict] = field(default_factory=list)
    return_type: Optional[str] = None
    is_exported: Optional[bool] = None
    is_async: Optional[bool] = None
    complexity: Optional[int] = None
    max_nesting_depth: Optional[int] = None
    docstring: Optional[Dict] = None
    start_line: Optional[int] = None
    end_line: Optional[int] = None

    # 通用元数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    version: int = 1
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def to_dict(self) -> dict:
        """转换为字典（用于 SurrealDB 插入）"""
        return {k: v for k, v in {
            "id": self.id,
            "type": self.type,
            "content": self.content,
            "tenant_id": self.tenant_id,
            "status": self.status,
            "name": self.name,
            "signature": self.signature,
            "params": self.params,
            "return_type": self.return_type,
            "is_exported": self.is_exported,
            "is_async": self.is_async,
            "complexity": self.complexity,
            "max_nesting_depth": self.max_nesting_depth,
            "docstring": self.docstring,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "metadata": self.metadata,
            "version": self.version,
        }.items() if v is not None}
````

### 3.2 Entity（实体）- 知识实体

```python
@dataclass
class Entity:
    """
    实体 - 知识实体

    对应 SurrealDB entity 表
    """
    id: Optional[str] = None  # ULID
    type: str  # memory | backlog | wiki | code
    tenant_id: str = "default"  # v3.2: 预留字段
    abstract: str  # L0: 摘要
    overview: Dict[str, Any] = field(default_factory=dict)  # L1: 结构化概览
    atoms: List[str] = field(default_factory=list)  # L2: Atom ID 列表

    # Wiki 特性
    title: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    outgoing_links: List[str] = field(default_factory=list)
    incoming_links: List[str] = field(default_factory=list)

    # Backlog 特性（融入当前设计）
    priority: Optional[str] = None  # P0 | P1 | P2 | P3
    status: Optional[str] = None  # backlog | todo | in_progress | in_review | done
    scene: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None

    # Code 特性
    file_path: Optional[str] = None
    language: Optional[str] = None
    quality_score: Optional[Dict] = None
    complexity_metrics: Optional[Dict] = None

    # 通用
    tags: List[str] = field(default_factory=list)
    project: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
```

### 3.3 Relation（关系）- 原子/实体间关系

```python
@dataclass
class Relation:
    """
    关系 - 原子/实体间关系

    对应 SurrealDB reference 表
    """
    id: Optional[str] = None  # ULID
    type: str  # depends_on | blocks | calls | imports | implements | relates_to | wiki_link | part_of
    tenant_id: str = "default"  # v3.2: 预留字段

    from_id: str  # Atom ID 或 Entity ID
    to_id: str  # Atom ID 或 Entity ID

    # 代码特有（用于 calls/imports）
    file_path: Optional[str] = None
    line: Optional[int] = None
    column: Optional[int] = None

    # Backlog 特有（用于 implements）
    metadata: Optional[Dict] = None

    # 通用
    weight: float = 0.5
    created_by: Optional[str] = None
    created_at: Optional[str] = None
```

---

## 4. 数据库 Schema

### 4.1 Atom 表（SurrealDB 3.0+ 语法）

```sql
-- 使用 SurrealDB 3.0+ 语法
DEFINE NAMESPACE IF NOT EXISTS opencode;
USE NS opencode;
DEFINE DATABASE IF NOT EXISTS memory;
USE DB memory;

-- Atom 表定义
DEFINE TABLE atom TYPE NORMAL SCHEMAFULL CHANGEFEED 7d INCLUDE ORIGINAL;

DEFINE FIELD id ON atom TYPE record;
-- v3.2: tenant_id 预留字段，单租户时默认 "default"
DEFINE FIELD tenant_id ON atom TYPE string DEFAULT 'default';
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

-- 通用字段（使用 COMPUTED 替代 FUTURE）
DEFINE FIELD metadata ON atom TYPE option<object> DEFAULT {};
DEFINE FIELD version ON atom TYPE int DEFAULT 1;
DEFINE FIELD created_at ON atom TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON atom TYPE datetime DEFAULT time::now();

-- 索引（含 tenant_id 复合索引，为多租户预留）
DEFINE INDEX idx_atom_type ON atom FIELDS type;
DEFINE INDEX idx_atom_name ON atom FIELDS name;
DEFINE INDEX idx_atom_project ON atom FIELDS project;
DEFINE INDEX idx_atom_tenant_type ON atom FIELDS tenant_id, type;
DEFINE INDEX idx_atom_tenant_project ON atom FIELDS tenant_id, project;
```

### 4.2 Entity 表（SurrealDB 3.0+ 语法）

```sql
DEFINE TABLE entity TYPE NORMAL SCHEMAFULL CHANGEFEED 7d INCLUDE ORIGINAL;

DEFINE FIELD id ON entity TYPE record;
DEFINE FIELD tenant_id ON entity TYPE string DEFAULT 'default';
DEFINE FIELD type ON entity TYPE string
    ASSERT $value IN ['memory', 'backlog', 'wiki', 'code'];

-- L0/L1/L2 分层
DEFINE FIELD abstract ON entity TYPE string;
DEFINE FIELD overview ON entity TYPE object;

-- v3.2: 双向引用（自动维护反向引用）
DEFINE FIELD atoms ON entity
    TYPE option<array<record<atom>>>
    REFERENCE
    ON DELETE CASCADE;

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
DEFINE INDEX idx_entity_tenant_type ON entity FIELDS tenant_id, type;
DEFINE INDEX idx_entity_tenant_status ON entity FIELDS tenant_id, status;
```

### 4.3 Relation 表（使用 RELATE - SurrealDB 3.0+ 推荐）

```sql
-- 使用原生图关系（替代手动关系表）
-- v3.2: 通用关系表，支持 atom-atom/atom-entity/entity-entity
DEFINE TABLE reference TYPE RELATION SCHEMAFULL CHANGEFEED 7d;

DEFINE FIELD tenant_id ON reference TYPE string DEFAULT 'default';
DEFINE FIELD type ON reference TYPE string
    ASSERT $value IN ['depends_on', 'blocks', 'calls', 'imports', 'implements', 'relates_to', 'wiki_link', 'part_of'];

-- 代码特有
DEFINE FIELD file_path ON reference TYPE option<string>;
DEFINE FIELD line ON reference TYPE option<int>;
DEFINE FIELD column ON reference TYPE option<int>;

-- Backlog 特有
DEFINE FIELD metadata ON reference TYPE option<object>;

-- 通用字段
DEFINE FIELD weight ON reference TYPE float DEFAULT 0.5;
DEFINE FIELD created_by ON reference TYPE string;
DEFINE FIELD created_at ON reference TYPE datetime DEFAULT time::now();

-- 唯一索引：避免重复关系（单租户下不含 tenant_id，预留兼容性）
DEFINE INDEX idx_unique_ref ON reference FIELDS in, out, type UNIQUE;
```

### 4.4 图关系表（用于快速遍历）

```sql
-- Atom 之间的图关系
DEFINE TABLE atom_graph TYPE RELATION IN atom OUT atom;
DEFINE FIELD type ON atom_graph TYPE string;
DEFINE FIELD weight ON atom_graph TYPE float DEFAULT 0.5;

-- Entity 之间的图关系
DEFINE TABLE entity_graph TYPE RELATION IN entity OUT entity;
DEFINE FIELD type ON entity_graph TYPE string;
DEFINE FIELD weight ON entity_graph TYPE float DEFAULT 0.5;
```

### 4.5 事件定义（DEFINE EVENT - SurrealDB 3.0+）

```sql
-- v3.2 修复：自动维护 timeline（补充 entity 监听）
DEFINE EVENT timeline_atom ON atom
    WHEN $event IN ["CREATE", "UPDATE", "DELETE"]
    THEN {
        CREATE timeline SET
            tenant_id = $after.tenant_id,
            date = time::now(),
            atom_id = $after.id,
            type = $after.type,
            action = $event,
            file_path = $after.file_path,
            project = $after.project;
    };

-- v3.2 修复补充：Entity 变更监听（防止 60%+ 事件丢失）
DEFINE EVENT timeline_entity ON entity
    WHEN $event IN ["CREATE", "UPDATE", "DELETE"]
    THEN {
        CREATE timeline SET
            tenant_id = $after.tenant_id,
            date = time::now(),
            entity_id = $after.id,
            type = $after.type,
            action = $event,
            file_path = $after.file_path,
            project = $after.project;
    };

-- 自动更新统计信息
DEFINE EVENT update_stats ON atom
    WHEN $event = "CREATE"
    THEN {
        LET $file = $after.file_path;
        UPDATE stats:file SET
            atom_count += 1,
            last_updated = time::now()
        WHERE id = stats:file;
    };
```

### 4.6 向量索引（HNSW - SurrealDB 3.0+ 推荐）

```sql
-- HNSW 向量索引（MTREE 已在 3.0 中移除）
-- 语法验证：EFC 为官方正确参数（非 EF_CONSTRUCTION）
DEFINE INDEX idx_atom_embedding ON atom
  FIELDS embedding
  HNSW DIMENSION 1024
  TYPE F32
  DIST COSINE
  EFC 150
  M 12;

-- 向量相似度搜索示例
-- SELECT * FROM atom WHERE embedding <|10|> $query_vector;
```

### 4.7 全文搜索索引（FULLTEXT - SurrealDB 3.0+ 语法）

```sql
-- 定义分析器
DEFINE ANALYZER simple
  TOKENIZERS class, punct
  FILTERS lowercase, ascii, snowball;

-- 全文搜索索引（SEARCH ANALYZER → FULLTEXT ANALYZER）
-- 语法验证：FULLTEXT 为 3.0+ 标准语法（非 SEARCH ANALYZER）
DEFINE INDEX idx_content ON entity
  FIELDS content
  FULLTEXT ANALYZER simple
  BM25(1.2, 0.75)
  HIGHLIGHTS;

-- 全文搜索示例
-- SELECT * FROM entity WHERE content @@ 'async patterns';
```

### 4.8 图遍历查询示例

```sql
-- 查询函数A调用了哪些函数（2层深度）
SELECT ->reference->atom->reference->atom FROM atom:func_a;

-- 查询哪些函数调用了函数B
SELECT <-reference<-atom FROM atom:func_b;

-- 带权重的关系
SELECT ->reference.{out.name, weight} FROM atom:func_a;

-- 递归查询调用链（使用 3.0+ 语法）
SELECT * FROM atom:func_a
WHERE ->reference->atom
  ->reference->atom
  ->reference->atom;
```

### 4.9 辅助表定义（新增）

#### 4.9.1 Timeline 表（自动维护时间线）

```sql
-- Timeline 表：记录所有 Atom/Entity 创建事件
DEFINE TABLE timeline TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON timeline TYPE record;
DEFINE FIELD tenant_id ON timeline TYPE string DEFAULT 'default';
DEFINE FIELD date ON timeline TYPE datetime DEFAULT time::now();
DEFINE FIELD atom_id ON timeline TYPE option<record<atom>>;
DEFINE FIELD entity_id ON timeline TYPE option<record<entity>>;
DEFINE FIELD type ON timeline TYPE string;
DEFINE FIELD file_path ON timeline TYPE option<string>;
DEFINE FIELD project ON timeline TYPE option<string>;
DEFINE FIELD action ON timeline TYPE string;  -- CREATE/UPDATE/DELETE

-- 索引：按日期范围查询
DEFINE INDEX idx_timeline_date ON timeline FIELDS date;
DEFINE INDEX idx_timeline_project ON timeline FIELDS project;
DEFINE INDEX idx_timeline_type ON timeline FIELDS type;
DEFINE INDEX idx_timeline_tenant_date ON timeline FIELDS tenant_id, date;
```

#### 4.9.2 Stats 表（统计信息）

```sql
-- Stats 表：项目级统计信息
DEFINE TABLE stats TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON stats TYPE record;
DEFINE FIELD tenant_id ON stats TYPE string DEFAULT 'default';
DEFINE FIELD project ON stats TYPE string;
DEFINE FIELD file_path ON stats TYPE option<string>;
DEFINE FIELD atom_count ON stats TYPE int DEFAULT 0;
DEFINE FIELD entity_count ON stats TYPE int DEFAULT 0;
DEFINE FIELD relation_count ON stats TYPE int DEFAULT 0;
DEFINE FIELD last_updated ON stats TYPE datetime DEFAULT time::now();
DEFINE FIELD complexity_score ON stats TYPE option<float>;
DEFINE FIELD quality_grade ON stats TYPE option<string>;

-- 索引
DEFINE INDEX idx_stats_project ON stats FIELDS project;
DEFINE INDEX idx_stats_file ON stats FIELDS file_path;

-- v3.2 修复：多租户下复合唯一约束（条件索引处理 NULL）
DEFINE INDEX idx_stats_tenant_project_file ON stats
    FIELDS tenant_id, project, file_path UNIQUE
    WHERE file_path IS NOT NONE;
```

#### 4.9.3 Project 表（项目管理）

```sql
-- Project 表：项目配置和元数据
DEFINE TABLE project TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON project TYPE record;
DEFINE FIELD tenant_id ON project TYPE string DEFAULT 'default';
DEFINE FIELD name ON project TYPE string;
DEFINE FIELD description ON project TYPE option<string>;
DEFINE FIELD root_path ON project TYPE string;
DEFINE FIELD config ON project TYPE option<object>;
DEFINE FIELD created_at ON project TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON project TYPE datetime DEFAULT time::now();
DEFINE FIELD is_active ON project TYPE bool DEFAULT true;

-- 索引
DEFINE INDEX idx_project_name ON project FIELDS name UNIQUE;
DEFINE INDEX idx_project_active ON project FIELDS is_active;
```

#### 4.9.4 Config 表（系统配置）

```sql
-- Config 表：系统级配置
DEFINE TABLE config TYPE NORMAL SCHEMAFULL;

DEFINE FIELD id ON config TYPE record;
DEFINE FIELD key ON config TYPE string;
DEFINE FIELD value ON config TYPE object;
DEFINE FIELD description ON config TYPE option<string>;
DEFINE FIELD updated_at ON config TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_by ON config TYPE option<string>;

-- 索引
DEFINE INDEX idx_config_key ON config FIELDS key UNIQUE;
```

### 4.10 Record References（双向引用 - 新增）

使用 SurrealDB 3.0+ 的 `REFERENCE` 关键字自动维护双向引用：

```sql
-- Entity 引用多个 Atom（自动维护反向引用）
-- 已在 4.2 Entity 表定义中实现
DEFINE FIELD atoms ON entity
  TYPE option<array<record<atom>>>
  REFERENCE
  ON DELETE CASCADE;

-- 自动生成的反向引用：Atom 知道被哪些 Entity 引用
-- 可通过 <~entity 查询

-- 示例：查询某个 Atom 被哪些 Entity 引用
SELECT * FROM atom:func_001 WHERE <~entity;

-- 示例：级联删除 - 删除 Entity 时自动清理关联
```

### 4.11 DEFINE FUNCTION（自定义函数 - 新增）

封装复杂查询逻辑：

```sql
-- 爆炸半径分析函数
DEFINE FUNCTION fn::get_impact($symbol_id: record, $depth: int) {
  IF $depth <= 0 {
    RETURN [];
  };

  LET $direct = SELECT out FROM reference WHERE in = $symbol_id;
  LET $indirect = $direct.map(|$s| fn::get_impact($s.out, $depth - 1));

  RETURN array::distinct($direct + $indirect);
};

-- 使用示例
SELECT * FROM fn::get_impact(atom:func_analyzeCode, 2);

-- 搜索记忆函数
DEFINE FUNCTION fn::search_memories($query: string, $project: string) {
  RETURN SELECT * FROM entity
  WHERE project = $project
  AND (abstract CONTAINS $query OR content CONTAINS $query);
};

-- 项目统计函数
DEFINE FUNCTION fn::get_project_stats($project: string) {
  LET $atom_count = count(SELECT * FROM atom WHERE project = $project);
  LET $entity_count = count(SELECT * FROM entity WHERE project = $project);
  LET $relation_count = count(SELECT * FROM reference WHERE in.project = $project);

  RETURN {
    project: $project,
    atoms: $atom_count,
    entities: $entity_count,
    relations: $relation_count
  };
};
```

### 4.12 ChangeFeed（变更日志 - 新增）

启用表级变更日志，支持审计和历史追溯：

```sql
-- 启用变更日志（保留 7 天）
-- 已在各表定义中使用 CHANGEFEED 7d INCLUDE ORIGINAL

-- 查询变更历史
SHOW CHANGES FOR TABLE atom
SINCE d"2026-04-01T00:00:00Z"
LIMIT 100;

-- 查询特定记录的变更
SHOW CHANGES FOR TABLE atom
SINCE d"2026-04-01T00:00:00Z"
WHERE id = atom:func_001;
```

### 4.13 Record ID 范围查询（新增）

利用 SurrealDB 的 Record ID 排序特性进行高效范围查询：

```sql
-- 使用时间作为 Record ID 的一部分
CREATE atom:['project-a', d'2026-04-09T10:30:00Z']
  SET name = "analyzeCode", type = "function", tenant_id = 'default';

-- 高效时间范围查询（比 WHERE 快 10-100 倍）
SELECT * FROM atom:['project-a', d'2026-04-01']..['project-a', d'2026-04-30'];

-- 分页查询
SELECT * FROM atom:['project-a', d'2026-04-01']..['project-a', d'2026-04-30']
LIMIT 100 START 0;
```

---

## 5. API 接口规范

### 5.1 基础配置

```python
# 服务端口: 18008 (从 17999 迁移)
API_BASE = "http://localhost:18008/api/v1"

# 请求头
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer {API_KEY}"
}
```

### 5.2 原子级操作

```python
# 创建 Atom（Agent 显式标注）
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
  "tenant_id": "default",  # v3.2: 预留字段
  "tags": ["typescript", "analysis"]
}

# 更新 Atom
PATCH /api/v1/atoms/{atom_id}
{
  "content": "更新后的内容",
  "version": 2
}

# 删除 Atom
DELETE /api/v1/atoms/{atom_id}

# 搜索 Atom（自动按 tenant_id 过滤）
GET /api/v1/atoms?query=analyzeCode&type=function&project=backlog-api&tenant_id=default
```

### 5.3 实体操作

```python
# 创建 Entity（包含 Atoms）
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
  "tenant_id": "default",
  "tags": ["typescript", "utils"]
}

# Backlog Entity（融入当前设计）
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
  "tenant_id": "default",
  "tags": ["代码分析", "自动化"]
}
```

### 5.4 关系操作

```python
# 创建关系（Agent 显式建立）
POST /api/v1/relations
{
  "type": "calls",
  "from_id": "atom:func-analyzeCode",
  "to_id": "atom:func-parseSync",
  "file_path": "src/utils.ts",
  "line": 95,
  "column": 20,
  "tenant_id": "default"
}

# 代码实现任务关系
POST /api/v1/relations
{
  "type": "implements",
  "from_id": "entity:backlog-BL-CA-17",
  "to_id": "entity:code-src-file-watcher",
  "metadata": {
    "implemented_functions": ["onFileSaved", "debouncedAnalyze"],
    "status": "completed"
  },
  "tenant_id": "default"
}
```

### 5.5 代码分析 API（预计算）

```python
# 触发预计算
POST /api/v1/code/precompute
{
  "file_path": "src/utils.ts",
  "tenant_id": "default",
  "analysis": {
    "language": "typescript",
    "functions": [...],
    "classes": [...],
    "calls": [...]
  }
}

# 代码导航（查询预计算数据）
GET /api/v1/code/navigate?symbol=analyzeCode&action=goto_definition&tenant_id=default

# 爆炸半径分析
GET /api/v1/code/impact?symbol=analyzeCode&depth=2&direction=both&tenant_id=default

# 混合搜索
GET /api/v1/code/search?query=文件监听&language=typescript&hybrid=true&tenant_id=default
```

### 5.6 WebSocket 实时同步 API（新增）

```python
# WebSocket 连接（带认证）
# v3.2: 指数退避重连算法（1s → 2s → 4s... 最大 300s）
ws = websocket.WebSocketApp(
    "ws://localhost:18008/api/v1/ws?token={JWT_TOKEN}&tenant_id=default",
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)

# 心跳机制
ws.on_open = lambda ws: (
    setattr(ws, 'heartbeat_thread',
        threading.Timer(30.0, lambda: ws.send(json.dumps({
            "type": "ping",
            "timestamp": time.time()
        })))
    ),
    ws.heartbeat_thread.start()
)

# 订阅记忆变更（使用 SurrealDB LIVE SELECT）
ws.send(json.dumps({
    "action": "subscribe",
    "query": 'LIVE SELECT * FROM entity WHERE project = "my-project"'
}))

# 订阅 DIFF 模式（减少 90% 数据传输）
ws.send(json.dumps({
    "action": "subscribe",
    "query": 'LIVE SELECT DIFF FROM entity WHERE project = "my-project"'
}))

# 消息确认机制
ws.send(json.dumps({
    "action": "sync",
    "data": memoryEntry,
    "messageId": "msg-001",
    "requiresAck": True
}))
```

### 5.7 批量操作 API（新增）

```python
# 批量创建 Atoms
POST /api/v1/atoms/batch
{
  "tenant_id": "default",
  "atoms": [
    { "type": "function", "name": "func1", ... },
    { "type": "function", "name": "func2", ... }
  ]
}

# 批量创建 Relations
POST /api/v1/relations/batch
{
  "tenant_id": "default",
  "relations": [
    { "type": "calls", "from_id": "atom:a", "to_id": "atom:b" },
    { "type": "imports", "from_id": "atom:a", "to_id": "atom:c" }
  ]
}

# v3.2 修复：批量删除（使用 POST 替代 DELETE 携带请求体，符合 HTTP 规范）
POST /api/v1/atoms/batch-delete
{
  "tenant_id": "default",
  "ids": ["atom:001", "atom:002", "atom:003"]
}
```

### 5.8 搜索 API（新增）

```python
# 全文搜索
GET /api/v1/search/fulltext?query=async patterns&project=my-project&tenant_id=default

# 向量搜索
GET /api/v1/search/vector?query=文件监听&embedding=[...]&limit=10&tenant_id=default

# 混合搜索（向量 + BM25）
GET /api/v1/search/hybrid?query=文件监听&project=my-project&limit=10&tenant_id=default

# 图遍历搜索
GET /api/v1/search/graph?symbol=analyzeCode&depth=2&direction=both&tenant_id=default
```

### 5.9 统计 API（新增）

```python
# 项目统计
GET /api/v1/stats/project/my-project?tenant_id=default

# 文件统计
GET /api/v1/stats/file/src/utils.ts?tenant_id=default

# 系统健康检查
GET /api/v1/health
{
  "status": "healthy",
  "surrealdb": "connected",
  "meilisearch": "connected",
  "websocket_clients": 5,
  "uptime": 3600
}
```

---

## 6. WebSocket 实时同步设计（新增）

### 6.1 可靠性机制

#### 6.1.1 心跳机制（Ping/Pong）

```python
# v3.2: Python 实现 ReliableWebSocketClient
import asyncio
import json
import time
import logging

logger = logging.getLogger(__name__)

class ReliableWebSocketClient:
    """
    v3.2: 带指数退避重连的 WebSocket 客户端
    延迟策略：1s, 2s, 4s... 最大 300s (5分钟)
    """
    def __init__(self, url, options=None):
        self.url = url
        self.ws = None
        self.heartbeat_interval = options.get('heartbeatInterval', 30) if options else 30
        self.heartbeat_timer = None
        self.latency = 0
        self.missed_pongs = 0
        self.max_missed_pongs = 2
        self.retry_count = 0
        self.base_delay = 1.0
        self.max_delay = 300.0

    async def connect(self):
        """连接并启动心跳"""
        try:
            self.ws = await websockets.connect(self.url)
            self.retry_count = 0
            await self._on_open()
        except Exception as e:
            logger.error(f"Connection error: {e}")
            await self._schedule_reconnect()

    async def _on_open(self):
        """连接成功回调"""
        self.missed_pongs = 0
        await self.start_heartbeat()

    async def start_heartbeat(self):
        """启动心跳检测"""
        while self.ws and self.ws.open:
            if self.missed_pongs >= self.max_missed_pongs:
                await self.ws.close()
                await self._schedule_reconnect()
                return

            try:
                await self.ws.send(json.dumps({
                    "type": "ping",
                    "timestamp": time.time()
                }))
                self.missed_pongs += 1
                await asyncio.sleep(self.heartbeat_interval)
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                break

    async def _schedule_reconnect(self):
        """指数退避重连"""
        delay = min(self.base_delay * (2 ** self.retry_count), self.max_delay)
        self.retry_count += 1
        logger.info(f"Reconnecting in {delay}s (attempt {self.retry_count})")
        await asyncio.sleep(delay)
        await self.connect()
```

#### 6.1.2 消息确认机制（Ack）

```python
class AcknowledgementSystem:
    """v3.2: 消息确认系统（Python 版）"""
    def __init__(self, timeout=5.0):
        self.pending_acks = {}
        self.timeout = timeout
        self.message_id_counter = 0
        self.lock = asyncio.Lock()

    async def send_with_ack(self, ws, data):
        """发送消息并等待确认"""
        async with self.lock:
            self.message_id_counter += 1
            message_id = f"msg-{self.message_id_counter}"

        future = asyncio.Future()

        # 设置超时
        async def timeout_handler():
            await asyncio.sleep(self.timeout)
            if not future.done():
                future.set_exception(TimeoutError(f"Ack timeout for {message_id}"))

        asyncio.create_task(timeout_handler())
        self.pending_acks[message_id] = future

        await ws.send(json.dumps({
            **data,
            "_msgId": message_id,
            "_requiresAck": True
        }))

        return await future

    async def handle_ack(self, message):
        """处理确认响应"""
        ack_id = message.get("_ackId")
        if ack_id and ack_id in self.pending_acks:
            self.pending_acks[ack_id].set_result(message.get("_ackData"))
            del self.pending_acks[ack_id]
```

#### 6.1.3 连接状态恢复

```python
class ConnectionStateRecovery:
    """v3.2: 连接状态恢复（Python 版）"""
    def __init__(self):
        self.session_id = self._generate_session_id()
        self.last_offset = "0"
        self.message_buffer = []

    def _generate_session_id(self):
        import uuid
        return f"sess-{int(time.time())}-{uuid.uuid4().hex[:9]}"

    async def connect(self):
        """带状态恢复的连接"""
        url = f"{self.ws_url}?session={self.session_id}&offset={self.last_offset}"
        self.ws = await websockets.connect(url)

        # 同步丢失的消息
        await self._sync_missed_messages(self.last_offset)

    async def _sync_missed_messages(self, from_offset):
        """同步丢失的消息"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"/api/v1/messages?since={from_offset}&session={self.session_id}"
            )
            messages = response.json()
            for msg in messages:
                await self.handle_message(msg)
```

### 6.2 SurrealDB LIVE SELECT DIFF 模式

```python
# v3.2: Python 使用 SurrealDB SDK 1.0.8 实现
from surrealdb import AsyncSurreal

class DiffSubscription:
    """v3.2: DIFF 模式订阅，减少 90% 数据传输"""
    def __init__(self, db: AsyncSurreal):
        self.db = db
        self.local_cache = {}

    async def subscribe(self, entity_id: str):
        """订阅 DIFF 模式"""
        # 先获取完整数据缓存
        full_data = await self.db.query(
            "SELECT * FROM entity WHERE id = $id",
            {"id": entity_id}
        )
        self.local_cache[entity_id] = full_data[0] if full_data else None

        # 订阅 DIFF 模式
        query_uuid = await self.db.live(
            "LIVE SELECT DIFF FROM entity WHERE id = $id",
            {"id": entity_id}
        )

        # 监听通知队列
        queue = self.db.subscribe_live(query_uuid)
        while True:
            notification = await queue.get()
            if notification.get("action") == "UPDATE":
                await self.apply_diff(entity_id, notification.get("data"))

    async def apply_diff(self, entity_id: str, patches):
        """应用差异更新"""
        import jsonpatch
        current = self.local_cache.get(entity_id)
        if not current:
            return

        updated = jsonpatch.apply_patch(current, patches)
        self.local_cache[entity_id] = updated

        # 触发更新事件
        await self.emit("update", {
            "entity_id": entity_id,
            "data": updated,
            "patches": patches
        })

    async def emit(self, event, data):
        """事件发射（子类实现）"""
        pass
```

### 6.3 离线队列持久化

```python
# v3.2: Python 持久化队列（带文件锁）
import aiofiles
import portalocker
import json
from pathlib import Path

class PersistentMessageQueue:
    """v3.2: 离线队列持久化（跨平台文件锁）"""
    def __init__(self, queue_file: str = ".opencode/ws-queue.json"):
        self.queue_file = Path(queue_file)
        self.lock_file = self.queue_file.with_suffix(".lock")
        self.max_age = 7 * 24 * 60 * 60 * 1000  # 7天

    async def load(self):
        """加载队列（线程安全）"""
        try:
            # 获取文件锁（跨平台）
            with portalocker.Lock(str(self.lock_file), timeout=5):
                if self.queue_file.exists():
                    async with aiofiles.open(self.queue_file, 'r') as f:
                        content = await f.read()
                        data = json.loads(content) if content else []
                        # 清理过期消息
                        now = time.time() * 1000
                        return [msg for msg in data if now - msg.get("_queuedAt", 0) < self.max_age]
                return []
        except Exception as e:
            logger.error(f"Load queue error: {e}")
            return []

    async def save(self, queue: list):
        """保存队列（原子写入）"""
        temp_file = self.queue_file.with_suffix(".tmp")
        async with aiofiles.open(temp_file, 'w') as f:
            await f.write(json.dumps(queue))
        temp_file.replace(self.queue_file)

    async def push(self, message: dict):
        """入队"""
        queue = await self.load()
        queue.append({
            **message,
            "_queuedAt": time.time() * 1000
        })

        with portalocker.Lock(str(self.lock_file), timeout=5):
            await self.save(queue)

    async def shift(self):
        """出队"""
        with portalocker.Lock(str(self.lock_file), timeout=5):
            queue = await self.load()
            if not queue:
                return None
            item = queue.pop(0)
            await self.save(queue)
            return item
```

---

## 7. 预计算服务设计

### 7.1 预计算流程

```python
# v3.2: Python 实现 PrecomputeService（基于 tree-sitter）
import time
import psutil
from tree_sitter import Language, Parser
from typing import List, Dict, Any

class PrecomputeService:
    """
    v3.2: 预计算服务完整流程
    基于 tree-sitter Query API（性能 3.32x 提升）
    """
    def __init__(self, db: AsyncSurreal, tenant_id: str = "default"):
        self.db = db
        self.tenant_id = tenant_id
        self.parser = Parser()
        self._init_languages()

    def _init_languages(self):
        """初始化语言解析器"""
        try:
            from tree_sitter_python import language as python_lang
            self.languages = {
                "python": python_lang,
                # 可扩展更多语言
            }
        except ImportError:
            self.languages = {}

    async def precompute(self, file_path: str, source_code: str, language: str = "python") -> Dict[str, Any]:
        """
        v3.2: 完整预计算流程（含性能监控）
        """
        start_time = time.perf_counter()
        process = psutil.Process()
        start_mem = process.memory_info().rss / 1024 / 1024  # MB

        try:
            # 1. 解析 AST（复用 tree-sitter）
            ast = self._parse_ast(source_code, language)

            # 2. 提取符号（函数、类、接口）
            symbols = self._extract_symbols(ast, file_path, source_code)

            # 3. 解析引用（跨文件调用）
            references = self._extract_references(ast, source_code)

            # 4. 创建 Atoms（批量）
            atoms = await self._create_atoms_batch(symbols)

            # 5. 创建 Entity（文件级，含双向引用）
            entity = await self._create_file_entity(file_path, atoms, source_code)

            # 6. 创建 Relations（调用关系）
            await self._create_relations(references, atoms)

            # 7. 检测任务引用（从注释中提取 BL-XXX）
            task_refs = self._extract_task_references(ast, source_code)
            for task_id in task_refs:
                await self._create_task_relation(entity, task_id)

            # 8. 构建搜索索引（Meilisearch）
            await self._build_search_index(symbols)

            # 性能监控
            duration = (time.perf_counter() - start_time) * 1000
            memory = process.memory_info().rss / 1024 / 1024 - start_mem

            await self._log_performance(file_path, duration, memory)

            return {
                "entity_id": entity["id"],
                "atoms_count": len(atoms),
                "relations_count": len(references),
                "compute_time_ms": duration,
                "memory_mb": memory,
                "success": True
            }

        except Exception as e:
            logger.error(f"Precompute error: {e}")
            raise

    def _parse_ast(self, source_code: str, language: str):
        """解析 AST"""
        if language not in self.languages:
            raise ValueError(f"Unsupported language: {language}")

        self.parser.set_language(self.languages[language])
        return self.parser.parse(bytes(source_code, "utf8"))

    def _extract_symbols(self, ast, file_path: str, source_code: str) -> List[Dict]:
        """提取符号（使用 tree-sitter Query）"""
        symbols = []
        root_node = ast.root_node

        # Query 模式匹配（性能优于手动遍历）
        query_str = """
        (function_definition
          name: (identifier) @func_name
          parameters: (parameters) @params
          body: (block) @body)

        (class_definition
          name: (identifier) @class_name
          body: (block) @body)
        """

        # 实际实现根据语言调整...
        # 简化为递归遍历示例
        def visit_node(node):
            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                name = source_code[name_node.start_byte:name_node.end_byte] if name_node else "anonymous"

                symbols.append({
                    "type": "function",
                    "name": name,
                    "content": source_code[node.start_byte:node.end_byte],
                    "file_path": file_path,
                    "start_line": node.start_point[0],
                    "end_line": node.end_point[0],
                    "tenant_id": self.tenant_id,
                    "complexity": self._calc_complexity(node)
                })

            for child in node.children:
                visit_node(child)

        visit_node(root_node)
        return symbols

    def _calc_complexity(self, node) -> int:
        """计算圈复杂度（简化版）"""
        # 实际实现：计算分支数量（if/for/while/and/or）
        return 1

    async def _create_atoms_batch(self, symbols: List[Dict]) -> List[Dict]:
        """批量创建 Atoms（优化网络往返）"""
        if not symbols:
            return []

        # 使用 SurrealDB 批量插入
        result = await self.db.query("""
            RETURN array::flatten(
                $symbols.map(|$s| CREATE atom CONTENT $s)
            )
        """, {"symbols": symbols})

        return result[0]["result"] if result else []

    async def _create_file_entity(self, file_path: str, atoms: List[Dict], source_code: str) -> Dict:
        """创建文件级 Entity（含双向引用）"""
        entity_data = {
            "type": "code",
            "title": file_path.split("/")[-1],
            "abstract": f"File with {len(atoms)} symbols",
            "overview": {
                "language": "python",
                "lines_of_code": len(source_code.splitlines()),
                "function_count": len(atoms)
            },
            "atoms": [a["id"] for a in atoms],  # 双向引用自动维护
            "file_path": file_path,
            "project": file_path.split("/")[0] if "/" in file_path else "default",
            "tenant_id": self.tenant_id,
            "created_at": "time::now()"
        }

        return await self.db.create("entity", entity_data)

    async def _create_relations(self, references: List[Dict], atoms: List[Dict]):
        """创建调用关系"""
        for ref in references:
            ref["tenant_id"] = self.tenant_id
            await self.db.query("""
                RELATE $from->reference->$to SET
                    type = $type,
                    tenant_id = $tid,
                    file_path = $file,
                    line = $line
            """, {
                "from": ref["from_id"],
                "to": ref["to_id"],
                "type": ref["type"],
                "tid": self.tenant_id,
                "file": ref.get("file_path"),
                "line": ref.get("line")
            })

    async def _log_performance(self, file_path: str, duration_ms: float, memory_mb: float):
        """记录性能指标"""
        await self.db.query("""
            CREATE performance_log SET
                tenant_id = $tid,
                operation = 'precompute',
                file_path = $file,
                duration_ms = $duration,
                memory_mb = $memory,
                timestamp = time::now()
        """, {
            "tid": self.tenant_id,
            "file": file_path,
            "duration": duration_ms,
            "memory": memory_mb
        })
```

### 7.2 触发时机

```python
# 1. 文件保存时自动触发（文件监听）
async def on_file_save(file_path: str, source_code: str, tenant_id: str = "default"):
    service = PrecomputeService(db, tenant_id)
    return await service.precompute(file_path, source_code)

# 2. CLI 手动触发
# opencode-memory analyze src/utils.ts --tenant-id=default

# 3. 批量触发
# opencode-memory analyze --all --tenant-id=default
```

---

## 8. Docker 多阶段构建方案（新增）

### 8.1 Dockerfile 完整示例

```dockerfile
# syntax=docker/dockerfile:1
# opencode-memory-service 多阶段构建 Dockerfile
# 目标：镜像大小减少 50-70%，构建时间减少 30-50%

# =============================================================================
# 阶段 1: 依赖安装（最稳定的层，最大化缓存命中）
# =============================================================================
FROM python:3.11-slim as deps

# 安装构建依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖文件（利用层缓存）
COPY pyproject.toml ./

# 安装 Python 依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir hatchling && \
    pip install --no-cache-dir -e .

# =============================================================================
# 阶段 2: 构建（如有需要）
# =============================================================================
FROM python:3.11-slim as builder

WORKDIR /app

# 从 deps 阶段复制
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# 复制源码
COPY . .

# =============================================================================
# 阶段 3: 生产运行（最小镜像，仅包含必要文件）
# =============================================================================
FROM python:3.11-slim as production

# 创建非 root 用户（安全最佳实践）
RUN groupadd -r -g 1001 appuser && \
    useradd -r -u 1001 -g appuser appuser

WORKDIR /app

# 从 deps 阶段复制生产依赖
COPY --from=deps --chown=appuser:appuser /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps --chown=appuser:appuser /usr/local/bin /usr/local/bin

# 从 builder 阶段复制源码
COPY --chown=appuser:appuser . .

# 创建数据目录并设置权限
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appuser /app

# v3.2 安全加固：切换到非 root 用户
USER appuser

# 健康检查
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries 3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:18008/health')" || exit 1

# 暴露端口
EXPOSE 18008

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "18008"]

# =============================================================================
# 阶段 4: 开发环境（可选，用于本地开发）
# =============================================================================
FROM python:3.11-slim as development

WORKDIR /app

# 安装所有依赖（包括 dev）
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir hatchling

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

# 挂载源码卷
VOLUME ["/app/src"]

EXPOSE 18008

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "18008", "--reload"]
```

### 8.2 .dockerignore 优化

```gitignore
# .dockerignore - 减少构建上下文大小
__pycache__
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# 虚拟环境
venv/
ENV/
env/
.venv/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# 测试
.pytest_cache/
.coverage
htmlcov/
.tox/

# 文档
*.md
docs/

# Git
.git/
.gitignore

# Docker
Dockerfile*
docker-compose*
.dockerignore

# 本地数据
data/
logs/
*.db
*.sqlite3

# 环境变量（安全）
.env
.env.*
!.env.example
```

### 8.3 docker-compose.yml 多环境配置

```yaml
version: "3.9"

services:
  # 基础服务（始终启动）
  surrealdb:
    image: surrealdb/surrealdb:latest
    command: start --user root --pass root file:/data/surreal.db
    ports:
      - "8000:8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    volumes:
      - surrealdb-data:/data

  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY:-masterKey}
    volumes:
      - meilisearch-data:/meili_data

  # 开发环境
  memory-service-dev:
    build:
      context: .
      target: development
    profiles: ["dev"]
    volumes:
      - ./src:/app/src
      - /app/src/__pycache__
    environment:
      - ENV=development
      - SURREALDB_URL=ws://surrealdb:8000
      - MEILISEARCH_URL=http://meilisearch:7700
      - API_PORT=18008
      - TENANT_ID=default
    ports:
      - "18008:18008"
    depends_on:
      surrealdb:
        condition: service_healthy
      meilisearch:
        condition: service_started

  # 生产环境（v3.2 安全加固）
  memory-service-prod:
    build:
      context: .
      target: production
    profiles: ["prod"]
    environment:
      - ENV=production
      - SURREALDB_URL=ws://surrealdb:8000
      - MEILISEARCH_URL=http://meilisearch:7700
      - API_PORT=18008
      - TENANT_ID=default

    # v3.2 安全加固配置
    security_opt:
      - no-new-privileges:true # 禁止提升权限
    read_only: true # 只读文件系统
    cap_drop:
      - ALL # 丢弃所有能力
    cap_add:
      - NET_BIND_SERVICE # 仅保留网络绑定
    user: "1001:1001" # 非 root 用户

    tmpfs:
      - /tmp:noexec,nosuid,size=100m,mode=1777
      - /app/logs:noexec,nosuid,size=50m,mode=755

    ports:
      - "18008:18008"
    depends_on:
      surrealdb:
        condition: service_healthy
      meilisearch:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.5"
          memory: 256M

  # 测试环境
  memory-service-test:
    build:
      context: .
      target: builder
    profiles: ["test"]
    command: pytest -v
    environment:
      - ENV=test
      - SURREALDB_URL=ws://surrealdb:8000
    depends_on:
      - surrealdb

volumes:
  surrealdb-data:
  meilisearch-data:
```

### 8.4 构建命令

```bash
# 开发环境
docker-compose --profile dev up --build

# 生产环境
docker-compose --profile prod up --build

# 仅运行测试
docker-compose --profile test up

# 手动构建生产镜像
docker build --target production -t opencode-memory-service:latest .

# 使用 BuildKit 构建（推荐）
DOCKER_BUILDKIT=1 docker build --target production -t opencode-memory-service:latest .

# 多平台构建
docker buildx build --platform linux/amd64,linux/arm64 --target production -t opencode-memory-service:latest --push .
```

### 8.5 预期收益

| 指标         | 优化前          | 优化后        | 提升         |
| ------------ | --------------- | ------------- | ------------ |
| 镜像大小     | ~500MB          | ~150MB        | **-70%**     |
| 构建时间     | ~3min           | ~1.5min       | **-50%**     |
| 安全漏洞     | 高（root 运行） | 低（非 root） | **显著提升** |
| 层缓存命中率 | 低              | 高            | **+40%**     |

---

## 9. 实施计划（修订版 - 整合 150+ 验证特性）

### Phase 1: 立即实施（1-2周）

**Week 1: 基础设施**

- [ ] **SurrealDB 3.0+ Schema 创建**
  - 创建 opencode namespace
  - 创建 memory database
  - 定义 atom/entity/reference 表（CHANGEFEED, FULLTEXT, RELATE）
  - **新增**：定义辅助表（timeline, stats, project, config）
  - **新增**：配置 Record References 和 DEFINE FUNCTION
  - **v3.2 调整**：所有表含 tenant_id 字段（预留多租户）
- [ ] **端口迁移 17999→18008**
  - 全局搜索替换端口配置
  - 更新 Python 配置
  - 更新文档和配置

- [ ] **Docker 多阶段构建优化**
  - 创建多阶段 Dockerfile（deps/builder/production）
  - 配置 BuildKit 缓存挂载
  - **v3.2 安全加固**：配置健康检查、非 root 用户、no-new-privileges、read_only
  - 创建 docker-compose.yml（dev/prod/test profiles）
  - 目标：镜像大小减少 50-70%

- [ ] **Python 项目初始化**
  - 配置 pyproject.toml（含修正后的依赖）
  - 配置 ruff/mypy/pytest
  - 创建基础目录结构

**Week 2: 核心功能**

- [ ] **tree-sitter Query 迁移** ⚡ **（已验证，性能 3.32x）**
  - 安装 tree-sitter-python
  - 迁移手动遍历到 Query API
  - 代码减少 50%+

- [ ] **GitHub Actions CI/CD** ⭐ **增强**
  - 创建 CI 工作流（矩阵构建 Python 3.10/3.11/3.12 + Ubuntu）
  - 配置缓存优化（pip 缓存）
  - 配置并发控制（cancel-in-progress）
  - 添加安全扫描（bandit + ruff security rules）
  - 自动化测试和发布

**验收标准**:

- 所有表创建成功（SurrealDB 3.0+ 语法）
- tree-sitter Query 性能提升 3x+
- 服务端口 18008 正常运行
- CI/CD 自动化部署成功
- 测试覆盖率 >= 50%
- Docker 安全扫描通过（无 HIGH/CRITICAL 漏洞）

---

### Phase 2: 核心功能实施（2-4周）

**Week 3-4: 实时同步与性能**

- [ ] **WebSocket 可靠性设计** ⭐ **新增（从 Phase 3 提升）**
  - 实现心跳机制（Ping/Pong，30秒间隔）
  - 实现消息确认机制（Ack）
  - 实现连接状态恢复（session + offset）
  - **v3.2 指数退避**：重连延迟 1s→2s→4s... 最大 300s
  - 集成 SurrealDB LIVE SELECT DIFF 模式（减少 90% 传输）
  - 实现离线队列持久化（portalocker 文件锁）

- [ ] **Python 并发优化**
  - asyncio.gather() 并发处理（替代 Node.js Worker Threads 概念）
  - aiofiles 异步文件 IO（替代 Node.js Streams）
  - multiprocessing.Pool 用于 CPU 密集型任务（如 Embedding）

**Week 5-6: 预计算与监控**

- [ ] **预计算服务**
  - 实现 `/api/v1/code/precompute` API
  - 符号提取和存储（tree-sitter）
  - 调用关系创建（reference 表）
  - 性能监控（psutil 记录耗时/内存）

- [ ] **代码工具**
  - `code_navigate` 工具
  - `code_impact` 工具（使用 fn::get_impact）
  - `code_search` 工具（混合搜索）

- [ ] **Performance Hooks 监控** ⭐ **新增**
  - 添加性能监控（函数执行时间）
  - 内存使用监控
  - 性能仪表板基础

**验收标准**:

- WebSocket 连接稳定（心跳成功率 > 99%）
- 预计算数据正确存储
- 代码导航功能可用
- 大文件处理内存 < 100MB
- 性能指标可观测（/metrics 端点）

---

### Phase 3: 高级优化（持续实施）

- [ ] **SurrealDB 高级特性**
  - ChangeFeed 审计查询（SHOW CHANGES）
  - Record ID 范围查询优化
  - 权限控制（RBAC，等待 SDK 2.0）
  - EXPLAIN 查询分析

- [ ] **Docker 进阶优化**
  - Compose Profiles 多环境
  - BuildKit Secrets 管理
  - 网络安全隔离（自定义网络）

- [ ] **Python 进阶优化**
  - HTTP Keep-Alive 连接池
  - asyncio.Semaphore 并发控制
  - DNS 缓存

**验收标准**:

- 审计日志完整（ChangeFeed）
- 连接池命中率 >= 80%
- 查询性能优化（EXPLAIN 分析）

---

## 10. 实现状态标注（基于验证结果 - 2026-04-10）

### 10.1 验证结果总览

| 技术                           | 验证状态  | 关键发现                         | 实施优先级 |
| ------------------------------ | --------- | -------------------------------- | ---------- |
| **SurrealDB 3.0+**             | ✅ 已验证 | 7 个特性均可用                   | P0         |
| **SurrealDB Python SDK 1.0.8** | ✅ 已验证 | 稳定版，支持 live/subscribe_live | P0         |
| **SurrealDB SDK 2.0**          | ⚠️ Alpha  | 不稳定，暂缓多租户物理隔离       | P2         |
| **tree-sitter Query**          | ✅ 已验证 | 性能 3.32x                       | P0         |
| **GitHub Actions**             | ✅ 已验证 | 完全适配 Python                  | P0         |
| **Docker**                     | ✅ 已验证 | 多阶段构建可行                   | P0         |
| **Python asyncio**             | ✅ 已验证 | 替代 Node.js Worker Threads      | P1         |

### 10.2 已验证特性清单（150+ 个）

#### SurrealDB 3.0+ 特性（已验证）

- ✅ Database/Namespace 隔离
- ✅ RELATE 图关系（跨表支持，v3.1 误报已澄清）
- ✅ Live Queries（单节点，SDK 1.0.8 支持）
- ✅ Record References（REFERENCE ON DELETE CASCADE）
- ✅ DEFINE EVENT（$event 变量语法正确）
- ✅ HNSW 向量索引（EFC 参数正确，非 EF_CONSTRUCTION）
- ✅ FULLTEXT 索引（3.0+ 标准语法）
- ✅ 事务支持
- ✅ ChangeFeed（CHANGEFEED 7d）
- ✅ DEFINE FUNCTION（自定义函数）

#### tree-sitter 特性（已验证）

- ✅ Query API 可用
- ✅ 性能提升 3.32x
- ✅ 多语言支持（Python/JS/Rust/Java）
- ✅ 增量解析

#### Python 生态（已验证）

- ✅ FastAPI 异步性能
- ✅ SurrealDB SDK 1.0.8 异步支持
- ✅ tree-sitter Python 绑定
- ✅ portalocker 跨平台文件锁

### 10.3 关键差距分析

#### 差距 1：多租户物理隔离暂缓 ⚠️

**现状**:

- SurrealDB Python SDK 2.0 处于 Alpha 阶段，Namespace 切换 API 不稳定
- 当前采用单租户 + tenant_id 预留字段方案

**解决方案**:

1. **当前（v3.2）**：应用层 tenant_id 过滤（WHERE tenant_id = $1）
2. **未来（SDK 2.0 stable）**：迁移至 Namespace 物理隔离，无缝切换（Schema 已预留 tenant_id）

#### 差距 2：调用关系未激活 ⚠️

**现状**:

- 预计算服务已提取 calls，但存储在 metadata 中

**解决方案**:

1. 使用 SurrealDB RELATE 创建独立关系（reference 表）
2. 调用 `/api/v1/code/precompute` 时创建关系
3. 使用 fn::get_impact() 进行爆炸半径分析

#### 差距 3：存储粒度 ⚠️

**现状**: 文件级存储为主
**目标**: 符号级存储（Atom）+ 文件级（Entity）

**解决方案**:

1. 创建 Atom 表（函数/类/接口级别）
2. 创建 Entity 表（文件级别，通过 REFERENCE 关联 Atoms）
3. 建立 Atom-Entity 双向引用（自动维护）

---

## 11. 关键遗漏项补充

### 11.1 SurrealDB 2.x → 3.x 迁移要点

```sql
-- 1. 函数名变更
type::thing() → type::record()
duration::from::days() → duration::from_days()
string::is::email() → string::is_email()

-- 2. 全文搜索索引
SEARCH ANALYZER → FULLTEXT ANALYZER（v3.2 已使用正确语法）

-- 3. 计算字段
VALUE <future> { expr } → COMPUTED expr

-- 4. 参数声明
$var = value → LET $var = value

-- 5. MTREE 移除（使用 HNSW）
MTREE DIMENSION 768 → HNSW DIMENSION 768
```

### 11.2 增量更新策略

```python
# v3.2: Python 实现增量预计算
class IncrementalPrecompute:
    async def precompute(self, file_path: str, analysis: dict, tenant_id: str = "default"):
        # 1. 计算文件指纹（SHA256）
        fingerprint = self._calculate_fingerprint(analysis["content"])

        # 2. 检查是否变更
        last = await self._get_last_precompute(file_path, tenant_id)
        if last and last.get("fingerprint") == fingerprint:
            return {"skipped": True, "reason": "No changes detected"}

        # 3. 计算差异（diff）
        diff = self._calculate_diff(last.get("symbols", []), analysis.get("symbols", []))

        # 4. 只更新变更部分
        await self._apply_diff(diff, tenant_id)

        # 5. 更新指纹
        await self._update_fingerprint(file_path, fingerprint, tenant_id)
```

### 11.3 数据迁移方案（预留多租户升级）

```python
# v3.2: 预留迁移脚本（SDK 2.0 stable 后使用）
class TenantMigration:
    async def migrate_to_physical_isolation(self, tenant_id: str):
        """
        从逻辑隔离（tenant_id 字段）迁移到物理隔离（独立 Namespace）
        适用于 SDK 2.0 stable 后的升级
        """
        # 1. 创建新的 Namespace（tenant_{id}）
        await self.system_db.query(f"DEFINE NAMESPACE tenant_{tenant_id}")

        # 2. 导出该 tenant 的数据
        data = await self.shared_db.query(
            "SELECT * FROM atom WHERE tenant_id = $tid",
            {"tid": tenant_id}
        )

        # 3. 导入到新 Namespace（无需 tenant_id 字段）
        for record in data:
            del record["tenant_id"]  # 物理隔离下无需此字段
            await self.new_db.create("atom", record)

        # 4. 验证数据完整性
        # 5. 更新租户元数据
        await self.system_db.query("""
            UPDATE tenant SET tier = 'enterprise', namespace = $ns WHERE id = $id
        """, {"ns": f"tenant_{tenant_id}", "id": f"tenant:{tenant_id}"})
```

### 11.4 并发控制

```python
# v3.2: Python 并发控制
class ConcurrencyControl:
    def __init__(self):
        self.processing = set()
        self.queue = asyncio.Queue()
        self.semaphore = asyncio.Semaphore(5)  # 最大并发 5

    async def precompute(self, file_path: str, analysis: dict, tenant_id: str):
        # 去重
        key = f"{tenant_id}:{file_path}"
        if key in self.processing:
            return {"skipped": True, "reason": "Already processing"}

        self.processing.add(key)
        try:
            async with self.semaphore:  # 限流
                service = PrecomputeService(self.db, tenant_id)
                return await service.precompute(file_path, analysis)
        finally:
            self.processing.discard(key)
```

### 11.5 错误处理和重试

```python
# v3.2: Python 错误处理和指数退避重试
class PrecomputeErrorHandler:
    async def precompute_with_retry(self, file_path: str, analysis: dict, tenant_id: str, max_attempts: int = 3):
        for attempt in range(1, max_attempts + 1):
            try:
                service = PrecomputeService(self.db, tenant_id)
                return await service.precompute(file_path, analysis)
            except Exception as error:
                if not self._is_retryable(error):
                    raise

                # 指数退避：2^attempt 秒
                delay = 2 ** attempt
                logger.warning(f"Attempt {attempt} failed, retrying in {delay}s...")
                await asyncio.sleep(delay)

        raise Exception(f"Failed after {max_attempts} attempts")

    def _is_retryable(self, error: Exception) -> bool:
        """判断错误是否可重试"""
        retryable_exceptions = (
            ConnectionError,
            asyncio.TimeoutError,
            # SurrealDB 特定重试错误码...
        )
        return isinstance(error, retryable_exceptions)
```

---

## 12. 风险与应对（更新版）

| 风险                         | 影响 | 应对措施                                                   | 状态      |
| ---------------------------- | ---- | ---------------------------------------------------------- | --------- |
| **SurrealDB 3.x 语法变更**   | 高   | 使用新语法（COMPUTED, FULLTEXT），已验证 EFC/$event 正确性 | ✅ 已更新 |
| **tree-sitter Query 兼容性** | 中   | 版本对齐（0.22.x），Python 绑定已验证                      | ✅ 已验证 |
| **端口迁移遗漏**             | 中   | 全局搜索 + 全面测试                                        | ⚠️ 需检查 |
| **SDK 2.0 Alpha 不稳定**     | 高   | **暂缓物理隔离**，使用 tenant_id 预留字段方案              | ✅ 已调整 |
| **Live Queries 单节点限制**  | 低   | 当前架构单节点足够，未来考虑集群                           | ⚠️ 待评估 |
| **预计算性能问题**           | 高   | 异步处理、增量更新、连接池优化                             | ✅ 已补充 |
| **数据迁移失败**             | 高   | 备份、分阶段迁移、tenant_id 预留兼容                       | ✅ 已补充 |
| **并发冲突**                 | 中   | asyncio.Semaphore 限流、去重机制                           | ✅ 已补充 |
| **Docker 容器逃逸**          | 高   | **v3.2 安全加固**：no-new-privileges、read_only、非 root   | ✅ 已加固 |

---

## 参考文档

- [UNIFIED-ARCHITECTURE-v3.0.md](../archive/UNIFIED-ARCHITECTURE-v3.0.md)
- [API-CONTRACT.md](../API-CONTRACT.md)
- [CODE-ANALYSIS-DESIGN.md](../CODE-ANALYSIS-DESIGN.md)
- [SurrealDB 3.x 迁移指南](https://surrealdb.com/docs/surrealdb/installation/upgrading/migrating-data-to-3.x)
- [SurrealDB Python SDK 1.0.8](https://pypi.org/project/surrealdb/1.0.8/)
- [tree-sitter Python 文档](https://github.com/tree-sitter/py-tree-sitter)

---

_文档版本: v3.2.0_  
_最后更新: 2026-04-10_  
_状态: 实施版（单租户 + tenant_id 预留）_  
_SurrealDB 版本: 3.0+_  
_Python SDK: 1.0.8（稳定版）_  
_服务端口: 18008_

```

```
