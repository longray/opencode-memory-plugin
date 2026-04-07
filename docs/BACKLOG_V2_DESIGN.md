# Agent-Native Backlog V2 设计方案

## 基于 Memory 系统的 Backlog 实现

---

## 文档信息

| 项目         | 内容                          |
| ------------ | ----------------------------- |
| **版本**     | v2.1.0                        |
| **日期**     | 2026-04-07                    |
| **作者**     | OpenCode Agent                |
| **状态**     | 已确认                        |
| **设计原则** | 以复用为主，局部独立          |
| **关键决策** | ULID排序、4状态、Metadata嵌套 |

---

## 目录

1. [设计概述](#1-设计概述)
2. [架构对比](#2-架构对比)
3. [数据模型设计](#3-数据模型设计)
4. [Meilisearch 索引配置](#4-meilisearch-索引配置)
5. [API 设计](#5-api-设计)
6. [插件端工具](#6-插件端工具)
7. [实施计划](#7-实施计划)
8. [附录](#8-附录)

---

## 1. 设计概述

### 1.1 核心设计原则

**以复用为主，局部独立**

本方案基于对 BACKLOG_API_DESIGN.md (v1.0.0) 的多角度评估，采用"复用现有 Memory 系统为主，保留 Backlog 特有语义为辅"的混合架构。

### 1.2 设计决策矩阵

| 维度            | v1.0 (独立方案)       | v2.0 (复用为主)           | 决策理由                                      |
| --------------- | --------------------- | ------------------------- | --------------------------------------------- |
| **数据表**      | 新建 `backlog_task`   | 复用 `memory`             | 节省 100% 表创建工作量，自动继承同步/冲突解决 |
| **字段命名**    | `title`/`description` | `abstract`/`overview`     | 复用现有分层结构 (L0/L1/L2)，支持渐进加载     |
| **状态机**      | 8 状态完整版          | **简化为** 4 状态         | 认知负荷理论，80/20法则                       |
| **ID 格式**     | BL-{场景}-{N}         | **ULID** 天然唯一         | 无需递增，字典序可排序，分布式安全            |
| **Meilisearch** | 独立索引              | 复用 `memories`           | 统一搜索体验，避免资源重复                    |
| **API 路由**    | `/backlog/*`          | 复用 `/memories/*` + 封装 | 既复用后端，又提供清晰工具接口                |
| **服务层**      | BacklogManager        | 复用 MemoryManager        | 自动继承所有功能，减少 70% 代码量             |
| **Scene**       | 独立表                | **Metadata** 嵌套         | 零Schema变更，100%向后兼容                    |

### 1.3 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Agent / CLI                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │backlog_create│  │backlog_list │  │backlog_update       │ │
│  │(封装工具)    │  │(封装工具)    │  │(封装工具)           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                    │            │
│         └────────────────┴────────────────────┘            │
│                          │                                 │
│              ┌───────────┴───────────┐                     │
│              │  内部调用 memory_write  │                     │
│              │  内部调用 memory_search │                     │
│              └───────────┬───────────┘                     │
└──────────────────────────┼─────────────────────────────────┘
                           │
┌──────────────────────────┼─────────────────────────────────┐
│           Backend API (localhost:17999)                    │
│                          │                                 │
│  ┌───────────────────────┴───────────────────────┐         │
│  │              FastAPI Application               │         │
│  │                                                │         │
│  │  ┌─────────────────────────────────────────┐  │         │
│  │  │  /api/v1/memories (复用现有端点)         │  │         │
│  │  │  - POST /memories (创建 backlog)         │  │         │
│  │  │  - GET /memories?type=backlog (查询)     │  │         │
│  │  │  - PATCH /memories/{id} (更新状态)       │  │         │
│  │  └─────────────────────────────────────────┘  │         │
│  │                          │                    │         │
│  │              ┌───────────┴───────────┐        │         │
│  │              │   MemoryManager       │        │         │
│  │              │   (复用现有)          │        │         │
│  │              └───────────┬───────────┘        │         │
│  └──────────────────────────┼────────────────────┘         │
│                             │                              │
│              ┌──────────────┴──────────────┐              │
│              │                             │              │
│     ┌────────┴────────┐         ┌─────────┴────────┐     │
│     │   SurrealDB     │         │   Meilisearch    │     │
│     │  (Primary)      │◄───────►│  (Search Index)  │     │
│     │                 │  双写    │                  │     │
│     │  memory 表      │         │  memories 索引   │     │
│     │  - type=backlog │         │  (扩展配置)      │     │
│     └─────────────────┘         └──────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 架构对比

### 2.1 v1.0 vs v2.0 关键差异

| 方面         | v1.0 (独立)    | v2.0 (复用)   | 影响      |
| ------------ | -------------- | ------------- | --------- |
| **代码量**   | ~2000 行       | ~600 行       | 减少 70%  |
| **开发时间** | 8-10 周        | 1-2 周        | 节省 80%  |
| **新表数量** | 2 个           | 0 个          | 节省 100% |
| **API 端点** | 13 个新端点    | 0 个新端点    | 复用现有  |
| **服务层**   | BacklogManager | MemoryManager | 复用现有  |
| **维护成本** | 高（双系统）   | 低（单系统）  | 降低 60%  |

### 2.2 保留的 Backlog 特有设计

虽然采用复用架构，但以下 Backlog 核心语义得到保留：

1. **状态机**：4 个状态（Backlog → In Progress → Review → Done）
2. **ID 格式**：ULID 天然唯一，字典序可排序
3. **5要素模型**：目标、范围、依赖、标准、验证
4. **优先级系统**：P0/P1/P2/P3 四级优先级（metadata.priority）
5. **场景组织**：metadata.scene 字段

---

## 3. 数据模型设计

### 3.1 复用 Memory 表结构

**无需修改 SurrealDB Schema**，复用现有 `memory` 表：

```sql
-- 现有 memory 表结构（无需修改）
DEFINE TABLE memory TYPE NORMAL SCHEMAFULL;

DEFINE FIELD type ON memory TYPE option<string> DEFAULT 'general';
-- 应用层验证: general | preference | long-term | daily | backlog

DEFINE FIELD abstract ON memory TYPE option<string>;
-- Backlog 用途: 任务标题 (L0)

DEFINE FIELD overview ON memory TYPE option<string>;
-- Backlog 用途: 任务描述 (L1)

DEFINE FIELD content ON memory TYPE option<string>;
-- Backlog 用途: 详细内容/5要素 (L2)

DEFINE FIELD tags ON memory TYPE array<string> DEFAULT [];
-- Backlog 用途: ["P0", "代码分析v1.4", "backend"]

DEFINE FIELD metadata ON memory TYPE object FLEXIBLE DEFAULT {};
-- Backlog 用途: 状态、依赖、工时等特有字段

DEFINE FIELD source_id ON memory TYPE option<string>;
-- Backlog 用途: Backlog 编号 "BL-CA-17"

DEFINE FIELD project_id ON memory TYPE string DEFAULT 'global';
-- Backlog 用途: 项目归属
```

### 3.2 Backlog 字段映射

| Backlog 语义     | Memory 字段         | 说明                            |
| ---------------- | ------------------- | ------------------------------- |
| **任务标题**     | `abstract` (L0)     | 简短标题，≤100字符              |
| **任务描述**     | `overview` (L1)     | 详细描述，≤500字符              |
| **详细内容**     | `content` (L2)      | 完整内容，包含5要素             |
| **任务类型**     | `type` = "backlog"  | 类型标识                        |
| **优先级**       | `metadata.priority` | P0/P1/P2/P3                     |
| **场景**         | `metadata.scene`    | 如 "代码分析v1.4"               |
| **Backlog 编号** | `source_id`         | ULID 格式                       |
| **项目归属**     | `project_id`        | 项目ID                          |
| **状态**         | `metadata.status`   | backlog/in_progress/review/done |

### 3.3 Metadata 字段设计（Backlog 特有）

```json
{
  "type": "backlog",
  "abstract": "文件保存自动触发分析",
  "overview": "当用户保存文件时，自动触发代码分析...",
  "content": "# 目标\n...\n# 涉及范围\n...",
  "tags": ["backlog", "代码分析v1.4"],
  "source_id": "01HQ2K3M4N5P6Q7R8S9T0UVWXY",
  "project_id": "@csuwl/opencode-memory-plugin",
  "metadata": {
    "status": "in_progress",
    "priority": "P0",
    "scene": "代码分析v1.4",
    "scope": ["lib/file-watcher.js", "plugin.js"],
    "acceptance_criteria": ["使用chokidar监听", "300ms防抖"],
    "verification_method": "手动测试+单元测试",
    "estimated_hours": 4,
    "actual_hours": 2,
    "started_at": "2026-04-07T10:00:00Z",
    "completed_at": null,
    "blocked": false,
    "blocked_reason": null,
    "dependencies": ["01HQ2K3M4N5P6Q7R8S9T0UVWXZ"],
    "blocks": [],
    "source": {
      "type": "ai_generated",
      "created_by": "claude",
      "detail": "从对话分析自动生成"
    }
  }
}
```

**说明**：

- `source_id`: ULID 格式（26字符），天然唯一且字典序可排序
- `tags`: 仅用于额外标签，优先级和场景移至 metadata
- `metadata`: 包含所有 Backlog 特有字段，零 Schema 变更

### 3.4 Pydantic 模型（扩展）

```python
# wrapper/src/models.py (扩展)

class MemoryItem(BaseModel):
    """扩展现有 MemoryItem，支持 Backlog"""

    # ... 现有字段 ...
    type: str = Field(
        default="general",
        description="记忆类型: general | preference | long-term | daily | backlog"
    )

    # Backlog 特有验证（当 type='backlog' 时）
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="""
        Backlog 字段 (当 type='backlog' 时):
        - status: backlog/in_progress/review/done (4状态)
        - priority: P0/P1/P2/P3
        - scene: 场景名称
        - scope: 涉及范围列表
        - acceptance_criteria: 完成标准列表
        - verification_method: 验证方式
        - estimated_hours: 预估工时
        - actual_hours: 实际工时
        - started_at: 开始时间
        - completed_at: 完成时间
        - blocked: 是否阻塞 (布尔值)
        - blocked_reason: 阻塞原因
        - dependencies: 依赖任务ID列表 (ULID)
        - blocks: 阻塞任务ID列表 (ULID)
        - source: 来源信息 {type, created_by, detail}
        """
    )


class BacklogCreateRequest(BaseModel):
    """Backlog 创建请求（内部使用）"""
    title: str = Field(..., description="任务标题")
    description: str = Field(..., description="任务描述")
    priority: str = Field(default="P2", description="优先级: P0/P1/P2/P3")
    scene: str = Field(..., description="所属场景")
    scope: list[str] = Field(default_factory=list, description="涉及范围")
    acceptance_criteria: list[str] = Field(default_factory=list, description="完成标准")
    verification_method: str = Field(default="", description="验证方式")
    estimated_hours: float | None = Field(default=None, description="预估工时")
    dependencies: list[str] = Field(default_factory=list, description="依赖任务")
    tags: list[str] = Field(default_factory=list, description="额外标签")


class BacklogUpdateRequest(BaseModel):
    """Backlog 更新请求（内部使用）"""
    status: str | None = Field(default=None, description="状态")
    priority: str | None = Field(default=None, description="优先级")
    actual_hours: float | None = Field(default=None, description="实际工时")
    blocked: bool | None = Field(default=None, description="是否阻塞")
    blocked_reason: str | None = Field(default=None, description="阻塞原因")
```

---

## 4. Meilisearch 索引配置

### 4.1 扩展现有配置

```python
# wrapper/src/utils/meili_client.py

DEFAULT_INDEX_SETTINGS = {
    # ... 现有配置 ...

    "filterableAttributes": [
        # 现有字段
        "tenant_id",
        "type",           # ✅ 可按 backlog 类型过滤
        "tags",           # ✅ 可按优先级/场景过滤
        "project_id",     # ✅ 可按项目过滤
        "source_id",      # ✅ 可按 backlog 编号过滤
        # Backlog 特有字段
        "metadata.status",
        "metadata.priority",
        "metadata.scene",
        "metadata.blocked",
    ],

    "sortableAttributes": [
        # 现有字段
        "date",
        "created_at",
        # Backlog 特有字段
        "metadata.priority",
        "metadata.estimated_hours",
        "metadata.started_at",
        "metadata.completed_at",
    ],

    "searchableAttributes": [
        # 现有字段
        "content_zh",
        "title_zh",
        "tags_zh",
        # Backlog 特有
        "metadata.scene",
    ],
}
```

### 4.2 索引重建策略

由于添加了新的 filterable/sortable 字段，需要重建索引：

```bash
# 1. 备份现有索引
python scripts/backup_index.py

# 2. 更新配置
curl -X PATCH http://localhost:7700/indexes/memories/settings \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" \
  -d @meili_settings_v2.json

# 3. 重新索引数据
python scripts/reindex_memories.py --add-backlog-fields
```

---

## 5. API 设计

### 5.1 后端 API（复用现有端点）

**复用 `/api/v1/memories` 端点**，添加 Backlog 特有参数：

```python
# wrapper/src/routers/memories.py (扩展)

@router.post("/memories")
async def upload_memories(request: MemoryUploadRequest):
    """创建记忆/Backlog（复用现有端点）"""
    # 自动处理 type='backlog'
    if request.memories[0].type == "backlog":
        validate_backlog_fields(request.memories[0])

    result = await state.memory_manager.upload_memories(
        [m.model_dump() for m in request.memories],
        tenant_id=request.tenant_id,
    )
    return result


@router.get("/memories")
async def query_memories(
    # 现有参数
    query: str = Query(None, description="搜索查询"),
    type: str = Query(None, description="按类型过滤: backlog"),
    tags: list[str] = Query(None, description="按标签过滤"),
    # Backlog 特有参数
    status: str = Query(None, description="Backlog 状态过滤"),
    priority: str = Query(None, description="Backlog 优先级过滤"),
    scene: str = Query(None, description="Backlog 场景过滤"),
    blocked: bool = Query(None, description="是否阻塞"),
    # 分页
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """查询记忆/Backlog（复用现有端点）"""
    # 构建过滤条件
    filters = {"type": type} if type else {}
    if status:
        filters["metadata.status"] = status
    if priority:
        filters["metadata.priority"] = priority
    if scene:
        filters["metadata.scene"] = scene

    results = await state.memory_manager.search_memories(
        query=query,
        filters=filters,
        limit=limit,
        offset=offset,
    )
    return results


def validate_backlog_fields(memory: dict):
    """验证 Backlog 特有字段"""
    metadata = memory.get("metadata", {})

    # 验证状态 (4状态)
    valid_statuses = ["backlog", "in_progress", "review", "done"]
    if metadata.get("status") not in valid_statuses:
        raise ValidationError(f"Invalid status: {metadata.get('status')}")

    # 验证优先级
    valid_priorities = ["P0", "P1", "P2", "P3"]
    if metadata.get("priority") not in valid_priorities:
        raise ValidationError(f"Invalid priority: {metadata.get('priority')}")
```

### 5.2 状态流转 API

```python
@router.patch("/memories/{memory_id}/status")
async def update_memory_status(
    memory_id: str,
    status: str = Query(..., description="新状态"),
    tenant_id: str = "default",
):
    """更新 Backlog 状态（复用现有端点）"""
    # 验证状态流转
    current = await state.memory_manager.get_memory(memory_id, tenant_id)
    if not validate_status_transition(current["metadata"]["status"], status):
        raise HTTPException(400, "Invalid status transition")

    # 更新时间戳
    updates = {"metadata.status": status}
    if status == "in_progress":
        updates["metadata.started_at"] = datetime.now().isoformat()
    elif status == "completed":
        updates["metadata.completed_at"] = datetime.now().isoformat()

    result = await state.memory_manager.update_memory(memory_id, updates, tenant_id)
    return result
```

---

## 6. 插件端工具

### 6.1 工具封装（内部调用 memory API）

```javascript
// opencode-memory-plugin/tools/backlog.js

import {
  memory_write,
  memory_search,
  memory_read,
  memory_update,
} from "./core.js";
import { resolveProjectId } from "../lib/project-resolver.js";

/**
 * 创建 Backlog 任务
 * 内部封装 memory_write
 */
export const backlog_create = tool({
  name: "backlog_create",
  description: "创建新的 Backlog 任务",
  parameters: {
    title: { type: "string", description: "任务标题" },
    description: { type: "string", description: "任务描述" },
    priority: {
      type: "string",
      enum: ["P0", "P1", "P2", "P3"],
      default: "P2",
      description: "优先级",
    },
    scene: { type: "string", description: "所属场景" },
    scope: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "涉及范围",
    },
    acceptance_criteria: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "完成标准",
    },
    verification_method: {
      type: "string",
      default: "",
      description: "验证方式",
    },
    estimated_hours: {
      type: "number",
      description: "预估工时",
    },
    dependencies: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "依赖任务ID列表",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "额外标签",
    },
  },

  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const projectId = await resolveProjectId(config);

    // 生成 ULID（天然唯一，字典序可排序）
    const backlogId = await generateBacklogId();

    // 构建 5要素内容
    const content = buildFiveElementsContent(args);

    // 调用 memory_write
    const result = await memory_write({
      type: "backlog",
      abstract: args.title,
      overview: args.description,
      content: content,
      tags: [args.scene, ...args.tags], // 优先级移至 metadata
      source_id: backlogId, // ULID 格式
      project_id: projectId,
      metadata: {
        status: "backlog",
        priority: args.priority, // 独立字段
        scene: args.scene, // 独立字段
        scope: args.scope,
        acceptance_criteria: args.acceptance_criteria,
        verification_method: args.verification_method,
        estimated_hours: args.estimated_hours,
        dependencies: args.dependencies,
        source: {
          type: "user_created",
          created_by: "user",
        },
      },
    });

    return {
      content: `Backlog 任务创建成功: ${backlogId}`,
      data: {
        backlog_id: backlogId,
        id: result.id,
        ...args,
      },
    };
  },
});

/**
 * 查询 Backlog 任务
 * 内部封装 memory_search
 */
export const backlog_list = tool({
  name: "backlog_list",
  description: "查询 Backlog 任务列表",
  parameters: {
    status: {
      type: "string",
      enum: ["backlog", "in_progress", "review", "done"],
      description: "按状态过滤 (4状态)",
    },
    priority: {
      type: "string",
      enum: ["P0", "P1", "P2", "P3"],
      description: "按优先级过滤",
    },
    scene: {
      type: "string",
      description: "按场景过滤",
    },
    limit: {
      type: "number",
      default: 50,
      description: "返回数量",
    },
  },

  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    // 构建过滤条件
    const filters = { type: "backlog" };
    if (args.status) filters["metadata.status"] = args.status;
    if (args.priority) filters["metadata.priority"] = args.priority;
    if (args.scene) filters["metadata.scene"] = args.scene;

    // 调用 memory_search
    const results = await memory_search({
      query: "",
      filters: filters,
      limit: args.limit,
    });

    // 格式化输出
    const formatted = results.data.map((item) => ({
      display_id: item.source_id,
      title: item.abstract,
      status: item.metadata.status,
      priority: item.metadata.priority,
      scene: item.metadata.scene,
    }));

    return {
      content: `查询到 ${formatted.length} 个 Backlog 任务`,
      data: formatted,
    };
  },
});

/**
 * 更新 Backlog 状态
 * 内部封装 memory_update
 */
export const backlog_update_status = tool({
  name: "backlog_update_status",
  description: "更新 Backlog 任务状态",
  parameters: {
    display_id: {
      type: "string",
      description: "Backlog 编号 (如 BL-CA-17)",
    },
    status: {
      type: "string",
      enum: ["backlog", "in_progress", "review", "done"],
      description: "新状态 (4状态)",
    },
  },

  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    // 先查询 memory_id
    const searchResult = await memory_search({
      query: "",
      filters: { source_id: args.display_id },
      limit: 1,
    });

    if (!searchResult.data.length) {
      throw new Error(`Backlog 任务不存在: ${args.display_id}`);
    }

    const memoryId = searchResult.data[0].id;

    // 更新状态
    const updates = {
      metadata: {
        status: args.status,
      },
    };

    if (args.status === "in_progress") {
      updates.metadata.started_at = new Date().toISOString();
    } else if (args.status === "completed") {
      updates.metadata.completed_at = new Date().toISOString();
    }

    const result = await memory_update({
      id: memoryId,
      updates: updates,
    });

    return {
      content: `Backlog 任务 ${args.display_id} 状态更新为: ${args.status}`,
      data: result,
    };
  },
});

// 辅助函数

import { ulid } from "../lib/ulid.js";

async function generateBacklogId(scene) {
  // 使用 ULID 天然唯一，无需递增
  // ULID 特性：
  // 1. 48位时间戳 + 80位随机数
  // 2. 字典序可排序（按字符串比较即可按时间排序）
  // 3. 26字符 Crockford Base32 编码
  // 4. 同一毫秒内也是有序的
  return ulid();
}

function buildFiveElementsContent(args) {
  return `# 目标
${args.description}

# 涉及范围
${args.scope.join("\n")}

# 前置依赖
${args.dependencies.join(", ") || "无"}

# 完成标准
${args.acceptance_criteria.join("\n")}

# 验证方式
${args.verification_method}`;
}
```

---

## 7. 实施计划

### 7.1 工作量估算

| 阶段        | 内容                       | 时间       | 优先级 |
| ----------- | -------------------------- | ---------- | ------ |
| **Phase 1** | 扩展 Meilisearch 配置      | 0.5 天     | P0     |
| **Phase 2** | 实现 backlog_create 工具   | 1-2 天     | P0     |
| **Phase 3** | 实现 backlog_list 工具     | 1-2 天     | P0     |
| **Phase 4** | 实现 backlog_update_status | 1 天       | P1     |
| **Phase 5** | 测试和文档                 | 1-2 天     | P1     |
| **总计**    |                            | **5-8 天** |        |

### 7.2 与 v1.0 对比

| 维度         | v1.0 (独立)  | v2.0 (复用)  | 节省     |
| ------------ | ------------ | ------------ | -------- |
| **开发时间** | 8-10 周      | 1-2 周       | **80%**  |
| **代码量**   | ~2000 行     | ~600 行      | **70%**  |
| **新表数量** | 2 个         | 0 个         | **100%** |
| **API 端点** | 13 个新端点  | 0 个新端点   | **100%** |
| **维护成本** | 高（双系统） | 低（单系统） | **60%**  |

### 7.3 风险与缓解

| 风险                 | 缓解措施                        |
| -------------------- | ------------------------------- |
| Meilisearch 索引重建 | 提前备份，低峰期执行            |
| 状态机验证           | 应用层 + 数据库层双重验证       |
| ID 并发冲突          | 使用 ULID 或数据库序列          |
| 向后兼容性           | 保持现有 API 不变，仅添加新参数 |

---

## 8. 附录

### 8.1 状态机流转规则（4状态）

```yaml
状态流转:
  backlog:
    - in_progress
    # 可取消：直接删除或标记为 done + metadata.cancelled=true

  in_progress:
    - review
    - done
    # blocked 改为 metadata.blocked 布尔值

  review:
    - done
    - in_progress # 打回重做

  done: [] # 终态


# 说明：
# 1. 4状态遵循认知负荷理论（4±1法则）
# 2. blocked 不作为独立状态，使用 metadata.blocked + metadata.blocked_reason
# 3. cancelled/archived 通过 metadata 标记，简化状态机
# 4. 覆盖 80% 实际使用场景（80/20法则）
```

### 8.2 场景缩写映射

```python
SCENE_ABBR = {
    '代码分析v1.4': 'CA',
    '文档治理': 'DOC',
    '隐式偏好发现': 'IPD',
    '后端增量同步': 'SYNC',
    # 可扩展...
}
```

### 8.3 关键决策记录

#### 决策 1：ULID 天然唯一（vs 递增序号）

**选择**：ULID 天然唯一，无需递增

**理由**：

- ✅ 无需 Redis 或 SurrealDB 序列
- ✅ 字典序可排序（48位时间戳前缀）
- ✅ 分布式安全（80位随机数）
- ✅ 26字符可读性可接受

**替代方案**：SurrealDB DEFINE SEQUENCE（需要额外配置）

#### 决策 2：4状态（vs 8状态）

**选择**：Backlog → In Progress → Review → Done

**理由**：

- ✅ 认知负荷理论（4±1法则）
- ✅ 80/20法则（覆盖80%场景）
- ✅ blocked 改为 metadata.blocked 布尔值
- ✅ cancelled/archived 改为 metadata 标记

**替代方案**：8状态完整版（认知负荷高）

#### 决策 3：Metadata 嵌套（vs 独立字段）

**选择**：Backlog 专用字段放在 metadata 内

**理由**：

- ✅ 零 Schema 变更
- ✅ 100% 向后兼容
- ✅ 不影响现有 Memory 系统
- ✅ Meilisearch 支持嵌套字段索引

**替代方案**：独立字段（需要 Schema 变更，影响现有系统）

### 8.4 参考资料

- BACKLOG_API_DESIGN.md (v1.0.0) - 原始独立方案
- 架构评估报告 - 复用 vs 独立对比分析
- 最佳实践评估报告 - Linear/Jira/GitHub 设计参考
- 后端实现评估报告 - 技术可行性分析

---

**文档结束**

---

## 变更历史

| 版本   | 日期       | 变更内容                                    |
| ------ | ---------- | ------------------------------------------- |
| v2.1.0 | 2026-04-07 | 确认最终方案：ULID排序、4状态、Metadata嵌套 |
| v2.0.0 | 2026-04-07 | 基于评估报告，改为复用 Memory 系统架构      |
| v1.0.0 | 2026-04-07 | 初始独立 Backlog API 方案                   |
