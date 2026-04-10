# Agent-Native Backlog API 详细设计方案

## 文档信息

| 项目     | 内容           |
| -------- | -------------- |
| **版本** | v1.0.0         |
| **日期** | 2026-04-07     |
| **作者** | OpenCode Agent |
| **状态** | 草案           |

---

## 目录

1. [架构设计](#1-架构设计)
2. [数据模型设计](#2-数据模型设计)
3. [Meilisearch 索引设计](#3-meilisearch-索引设计)
4. [API 规范](#4-api-规范)
5. [服务层设计](#5-服务层设计)
6. [插件端集成](#6-插件端集成)
7. [迁移方案](#7-迁移方案)
8. [附录](#8-附录)

---

## 1. 架构设计

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenCode Agent / CLI                      │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │backlog_create│  │backlog_query│  │backlog_update/delete   │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
│         │                │                      │               │
│         └────────────────┴──────────────────────┘               │
│                          │                                       │
│              ┌───────────┴───────────┐                          │
│              │  X-Tenant-ID Header   │                          │
│              │  X-Project-ID Header  │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼─────────────────────────────────────┘
                           │
┌──────────────────────────┼─────────────────────────────────────┐
│           Backend API (localhost:17999)                        │
│                          │                                       │
│  ┌───────────────────────┴───────────────────────┐              │
│  │              FastAPI Application               │              │
│  │                                                │              │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │              │
│  │  │/backlog/tasks│  │/backlog/scenes│  │/export │ │              │
│  │  └──────┬──────┘  └──────┬──────┘  └───┬────┘ │              │
│  │         │                │              │      │              │
│  │         └────────────────┴──────────────┘      │              │
│  │                          │                      │              │
│  │              ┌───────────┴───────────┐          │              │
│  │              │   BacklogManager      │          │              │
│  │              │   (Mixin Pattern)     │          │              │
│  │              └───────────┬───────────┘          │              │
│  │                          │                      │              │
│  │         ┌────────────────┼────────────────┐     │              │
│  │         │                │                │     │              │
│  │    ┌────┴────┐     ┌────┴────┐     ┌────┴───┐ │              │
│  │    │  CRUD   │     │  Search │     │  Graph │ │              │
│  │    │  Mixin  │     │  Mixin  │     │  Mixin │ │              │
│  │    └────┬────┘     └────┬────┘     └───┬────┘ │              │
│  │         └────────────────┴──────────────┘      │              │
│  │                          │                      │              │
│  └──────────────────────────┼──────────────────────┘              │
│                             │                                    │
│              ┌──────────────┴──────────────┐                    │
│              │                             │                    │
│     ┌────────┴────────┐         ┌─────────┴────────┐           │
│     │   SurrealDB     │         │   Meilisearch    │           │
│     │  (Primary)      │◄───────►│  (Search Index)  │           │
│     │                 │  双写    │                  │           │
│     │  backlog_task   │         │ backlog_tasks    │           │
│     │  backlog_scene  │         │  index           │           │
│     └─────────────────┘         └──────────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 模块划分

| 模块               | 职责                   | 文件位置                                         |
| ------------------ | ---------------------- | ------------------------------------------------ |
| **Router**         | API 端点定义、参数解析 | `wrapper/src/routers/backlog.py`                 |
| **Models**         | Pydantic 数据模型      | `wrapper/src/models.py` (新增)                   |
| **BacklogManager** | 业务逻辑编排           | `wrapper/src/utils/backlog_manager/`             |
| **CRUD Mixin**     | 增删改查操作           | `wrapper/src/utils/backlog_manager/crud.py`      |
| **Search Mixin**   | 搜索查询操作           | `wrapper/src/utils/backlog_manager/search.py`    |
| **Graph Mixin**    | 关系图谱操作           | `wrapper/src/utils/backlog_manager/relations.py` |
| **Meili Client**   | Meilisearch 客户端     | 复用 `utils/meili_client.py`                     |

### 1.3 集成点

| 集成点               | 说明                                                  |
| -------------------- | ----------------------------------------------------- |
| **SurrealDB**        | 主数据存储，使用 `backlog_task` 和 `backlog_scene` 表 |
| **Meilisearch**      | 搜索索引，使用 `backlog_tasks` 索引，双写策略         |
| **Memory System**    | 未来支持 backlog → memory 的图关系                    |
| **Project Resolver** | 复用插件端的 project_id 自动识别                      |

---

## 2. 数据模型设计

### 2.1 SurrealDB Schema

```sql
-- ============================================
-- Backlog Task 表
-- ============================================
DEFINE TABLE IF NOT EXISTS backlog_task TYPE NORMAL SCHEMAFULL;

-- 核心标识字段
DEFINE FIELD IF NOT EXISTS id ON backlog_task TYPE record;
DEFINE FIELD IF NOT EXISTS display_id ON backlog_task TYPE string;
DEFINE FIELD IF NOT EXISTS title ON backlog_task TYPE string;
DEFINE FIELD IF NOT EXISTS description ON backlog_task TYPE string;

-- 状态管理
DEFINE FIELD IF NOT EXISTS status ON backlog_task TYPE string
    ASSERT $value IN ['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled', 'archived'];
DEFINE FIELD IF NOT EXISTS priority ON backlog_task TYPE string
    ASSERT $value IN ['P0', 'P1', 'P2', 'P3'];

-- 分类组织
DEFINE FIELD IF NOT EXISTS scene ON backlog_task TYPE string;
DEFINE FIELD IF NOT EXISTS tags ON backlog_task TYPE array<string> DEFAULT [];

-- 租户和项目隔离
DEFINE FIELD IF NOT EXISTS tenant_id ON backlog_task TYPE string DEFAULT 'default';
DEFINE FIELD IF NOT EXISTS project_id ON backlog_task TYPE string DEFAULT 'global';

-- 元数据（5要素中的3个）
DEFINE FIELD IF NOT EXISTS metadata ON backlog_task TYPE object FLEXIBLE DEFAULT {};
DEFINE FIELD IF NOT EXISTS metadata.scope ON backlog_task TYPE array<string>;
DEFINE FIELD IF NOT EXISTS metadata.acceptance_criteria ON backlog_task TYPE array<string>;
DEFINE FIELD IF NOT EXISTS metadata.verification_method ON backlog_task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS metadata.estimated_hours ON backlog_task TYPE option<number>;
DEFINE FIELD IF NOT EXISTS metadata.actual_hours ON backlog_task TYPE option<number>;

-- 关系（5要素中的前置依赖）
DEFINE FIELD IF NOT EXISTS relations ON backlog_task TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS relations.depends_on ON backlog_task TYPE array<string>;
DEFINE FIELD IF NOT EXISTS relations.blocks ON backlog_task TYPE array<string>;
DEFINE FIELD IF NOT EXISTS relations.relates_to ON backlog_task TYPE array<string>;

-- 来源追踪
DEFINE FIELD IF NOT EXISTS source ON backlog_task TYPE object;
DEFINE FIELD IF NOT EXISTS source.type ON backlog_task TYPE string
    ASSERT $value IN ['user_created', 'user_imported', 'ai_generated', 'ai_suggested', 'automated', 'decomposed', 'cloned', 'conversation'];
DEFINE FIELD IF NOT EXISTS source.id ON backlog_task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS source.detail ON backlog_task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS source.created_by ON backlog_task TYPE string;
DEFINE FIELD IF NOT EXISTS source.context ON backlog_task TYPE option<object>;

-- 审计字段
DEFINE FIELD IF NOT EXISTS created_at ON backlog_task TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON backlog_task TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS started_at ON backlog_task TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS completed_at ON backlog_task TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS created_by ON backlog_task TYPE string;
DEFINE FIELD IF NOT EXISTS updated_by ON backlog_task TYPE string;

-- 索引
DEFINE INDEX IF NOT EXISTS idx_backlog_display_id ON backlog_task FIELDS display_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_backlog_tenant_project ON backlog_task FIELDS tenant_id, project_id;
DEFINE INDEX IF NOT EXISTS idx_backlog_tenant_status ON backlog_task FIELDS tenant_id, status;
DEFINE INDEX IF NOT EXISTS idx_backlog_tenant_scene ON backlog_task FIELDS tenant_id, scene;
DEFINE INDEX IF NOT EXISTS idx_backlog_status ON backlog_task FIELDS status;
DEFINE INDEX IF NOT EXISTS idx_backlog_priority ON backlog_task FIELDS priority;
DEFINE INDEX IF NOT EXISTS idx_backlog_created_at ON backlog_task FIELDS created_at;

-- ============================================
-- Backlog Scene 表
-- ============================================
DEFINE TABLE IF NOT EXISTS backlog_scene TYPE NORMAL SCHEMAFULL;

DEFINE FIELD IF NOT EXISTS id ON backlog_scene TYPE record;
DEFINE FIELD IF NOT EXISTS name ON backlog_scene TYPE string;
DEFINE FIELD IF NOT EXISTS description ON backlog_scene TYPE option<string>;
DEFINE FIELD IF NOT EXISTS status ON backlog_scene TYPE string
    ASSERT $value IN ['active', 'completed', 'archived'];
DEFINE FIELD IF NOT EXISTS tenant_id ON backlog_scene TYPE string DEFAULT 'default';
DEFINE FIELD IF NOT EXISTS project_id ON backlog_scene TYPE string DEFAULT 'global';
DEFINE FIELD IF NOT EXISTS created_at ON backlog_scene TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON backlog_scene TYPE datetime DEFAULT time::now();

DEFINE INDEX IF NOT EXISTS idx_scene_tenant_project ON backlog_scene FIELDS tenant_id, project_id;
DEFINE INDEX IF NOT EXISTS idx_scene_status ON backlog_scene FIELDS status;

-- ============================================
-- 图关系（可选，用于复杂依赖追踪）
-- ============================================
DEFINE TABLE IF NOT EXISTS backlog_relation TYPE RELATION IN backlog_task OUT backlog_task SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS relationship_type ON backlog_relation TYPE string
    ASSERT $value IN ['depends_on', 'blocks', 'relates_to', 'part_of'];
DEFINE FIELD IF NOT EXISTS created_at ON backlog_relation TYPE datetime DEFAULT time::now();
```

### 2.2 Pydantic 模型

```python
# wrapper/src/models.py

from typing import Any, Optional
from pydantic import BaseModel, Field


# ==================== Backlog Source Models ====================

class BacklogTaskSource(BaseModel):
    """任务来源信息"""
    type: str = Field(
        default="user_created",
        description="来源类型: user_created | user_imported | ai_generated | ai_suggested | automated | decomposed | cloned | conversation"
    )
    id: Optional[str] = Field(default=None, description="来源标识")
    detail: Optional[str] = Field(default=None, description="详细说明")
    created_by: str = Field(default="system", description="创建者")
    context: Optional[dict[str, Any]] = Field(default=None, description="上下文信息")


# ==================== Backlog Metadata Models ====================

class BacklogTaskMetadata(BaseModel):
    """任务元数据（5要素中的3个）"""
    scope: list[str] = Field(default_factory=list, description="涉及范围")
    acceptance_criteria: list[str] = Field(default_factory=list, description="完成标准")
    verification_method: Optional[str] = Field(default=None, description="验证方式")
    estimated_hours: Optional[float] = Field(default=None, description="预估工时")
    actual_hours: Optional[float] = Field(default=None, description="实际工时")


class BacklogTaskRelations(BaseModel):
    """任务关系（5要素中的前置依赖）"""
    depends_on: list[str] = Field(default_factory=list, description="依赖的任务ID")
    blocks: list[str] = Field(default_factory=list, description="阻塞的任务ID")
    relates_to: list[str] = Field(default_factory=list, description="相关的任务ID")


# ==================== Backlog Request Models ====================

class BacklogTaskCreateRequest(BaseModel):
    """创建任务请求"""
    title: str = Field(..., description="任务标题")
    description: str = Field(..., description="任务描述")
    priority: str = Field(default="P2", description="优先级: P0 | P1 | P2 | P3")
    scene: str = Field(..., description="所属场景")
    project_id: str = Field(default="global", description="项目ID")
    tenant_id: str = Field(default="default", description="租户ID")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    metadata: BacklogTaskMetadata = Field(default_factory=BacklogTaskMetadata, description="元数据")
    relations: BacklogTaskRelations = Field(default_factory=BacklogTaskRelations, description="关系")
    source: Optional[BacklogTaskSource] = Field(default=None, description="来源信息")


class BacklogTaskUpdateRequest(BaseModel):
    """更新任务请求"""
    title: Optional[str] = Field(default=None, description="任务标题")
    description: Optional[str] = Field(default=None, description="任务描述")
    status: Optional[str] = Field(default=None, description="状态")
    priority: Optional[str] = Field(default=None, description="优先级")
    scene: Optional[str] = Field(default=None, description="所属场景")
    project_id: Optional[str] = Field(default=None, description="项目ID")
    tenant_id: Optional[str] = Field(default=None, description="租户ID")
    tags: Optional[list[str]] = Field(default=None, description="标签列表")
    metadata: Optional[BacklogTaskMetadata] = Field(default=None, description="元数据")
    relations: Optional[BacklogTaskRelations] = Field(default=None, description="关系")


class BacklogTaskQueryRequest(BaseModel):
    """查询任务请求"""
    status: Optional[str] = Field(default=None, description="按状态过滤")
    priority: Optional[str] = Field(default=None, description="按优先级过滤")
    scene: Optional[str] = Field(default=None, description="按场景过滤")
    project_id: Optional[str] = Field(default=None, description="按项目过滤")
    tenant_id: str = Field(default="default", description="租户ID")
    tags: Optional[list[str]] = Field(default=None, description="按标签过滤")
    limit: int = Field(default=50, ge=1, le=100, description="返回数量限制")
    offset: int = Field(default=0, ge=0, description="偏移量")


class BacklogTaskBatchRequest(BaseModel):
    """批量操作请求"""
    operations: list[dict[str, Any]] = Field(..., description="批量操作列表")
    tenant_id: str = Field(default="default", description="租户ID")


# ==================== Backlog Response Models ====================

class BacklogTaskResponse(BaseModel):
    """任务响应"""
    id: str = Field(..., description="内部ID")
    display_id: str = Field(..., description="展示ID: BL-{场景}-{N}")
    title: str = Field(..., description="任务标题")
    description: str = Field(..., description="任务描述")
    status: str = Field(..., description="状态")
    priority: str = Field(..., description="优先级")
    scene: str = Field(..., description="所属场景")
    project_id: str = Field(..., description="项目ID")
    tenant_id: str = Field(..., description="租户ID")
    tags: list[str] = Field(..., description="标签列表")
    metadata: BacklogTaskMetadata = Field(..., description="元数据")
    relations: BacklogTaskRelations = Field(..., description="关系")
    source: BacklogTaskSource = Field(..., description="来源信息")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")
    created_by: str = Field(..., description="创建者")


class BacklogTaskListResponse(BaseModel):
    """任务列表响应"""
    data: list[BacklogTaskResponse] = Field(..., description="任务列表")
    meta: dict[str, Any] = Field(..., description="元信息")


# ==================== Scene Models ====================

class BacklogSceneCreateRequest(BaseModel):
    """创建场景请求"""
    name: str = Field(..., description="场景名称")
    description: Optional[str] = Field(default=None, description="场景描述")
    project_id: str = Field(default="global", description="项目ID")
    tenant_id: str = Field(default="default", description="租户ID")


class BacklogSceneResponse(BaseModel):
    """场景响应"""
    id: str = Field(..., description="内部ID")
    name: str = Field(..., description="场景名称")
    description: Optional[str] = Field(default=None, description="场景描述")
    status: str = Field(..., description="状态")
    project_id: str = Field(..., description="项目ID")
    tenant_id: str = Field(..., description="租户ID")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")


# ==================== Export/Import Models ====================

class BacklogExportRequest(BaseModel):
    """导出请求"""
    format: str = Field(default="markdown", description="导出格式: markdown | json")
    scene: Optional[str] = Field(default=None, description="按场景过滤")
    project_id: Optional[str] = Field(default=None, description="按项目过滤")
    tenant_id: str = Field(default="default", description="租户ID")


class BacklogImportRequest(BaseModel):
    """导入请求"""
    content: str = Field(..., description="导入内容")
    format: str = Field(default="markdown", description="导入格式: markdown | json")
    tenant_id: str = Field(default="default", description="租户ID")
    project_id: str = Field(default="global", description="项目ID")
```

---

## 3. Meilisearch 索引设计

### 3.1 索引配置

```python
# meilisearch_code/config_backlog.py

"""
Backlog Meilisearch 配置
场景：任务管理/Backlog
策略：双字段 + 结构化数据优化
"""

import os
from dotenv import load_dotenv

load_dotenv()


class BacklogMeiliConfig:
    """Backlog Meilisearch 配置类"""

    # 连接配置
    HOST = os.getenv("MEILI_HOST", "http://localhost:18003")
    MASTER_KEY = os.getenv("MEILI_MASTER_KEY", "meili_master_key_2026_safe")
    INDEX_NAME = "backlog_tasks"  # 独立索引

    # 核心配置
    SETTINGS = {
        # ========== 可搜索字段（全文搜索）==========
        "searchableAttributes": [
            # 中文内容字段（启用 localizedAttributes）
            "title_zh",
            "description_zh",
            "tags_zh",
            # 原始内容（备用）
            "title",
            "description",
            "tags",
        ],

        # ========== 可过滤字段（结构化查询）==========
        "filterableAttributes": [
            # 隔离字段
            "tenant_id",
            "project_id",
            # 状态字段
            "status",
            "priority",
            "scene",
            # 分类字段
            "tags",
            "display_id",
            # 时间字段
            "created_at",
            "updated_at",
            "started_at",
            "completed_at",
            # 来源字段
            "source_type",
            "source_created_by",
        ],

        # ========== 可排序字段 ==========
        "sortableAttributes": [
            "created_at",
            "updated_at",
            "priority",
            "started_at",
            "completed_at",
        ],

        # ========== 保留特殊字符 ==========
        "nonSeparatorTokens": [
            ".", "-", "@", ":", "/", "_", "=", "+", "#", "::", "->", "=>",
        ],

        # ========== 中文分词配置 ==========
        "localizedAttributes": [
            {"locales": ["zho"], "attributePatterns": ["*_zh"]}
        ],

        # ========== 代码词典（复用现有）==========
        "dictionary": [
            # 版本前缀
            "v1", "v2", "v3", "v4", "v5",
            "alpha", "beta", "rc", "release", "snapshot",
            # 编程语言
            "python", "java", "javascript", "typescript", "go", "rust",
            # 常见命名
            "http", "https", "api", "www", "localhost",
            # 代码术语
            "class", "interface", "function", "method", "property",
            # 框架/库
            "django", "flask", "fastapi", "spring", "react", "vue",
            # 时间
            "2025", "2026", "2027", "2028",
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ],

        # ========== 容错配置 ==========
        "typoTolerance": {
            "enabled": True,
            "minWordSizeForTypos": {"oneTypo": 5, "twoTypos": 10},
            "disableOnAttributes": [
                "display_id",
                "file_path",
                "version",
            ],
        },

        # ========== 排序规则 ==========
        "rankingRules": [
            "words",
            "typo",
            "proximity",
            "attribute",
            "exactness",
            "sort",
        ],

        # ========== 分面搜索 ==========
        "faceting": {"maxValuesPerFacet": 100},

        # ========== 分页 ==========
        "pagination": {"maxTotalHits": 10000},
    }

    @classmethod
    def get_client(cls):
        """获取 Meilisearch 客户端"""
        import meilisearch
        return meilisearch.Client(cls.HOST, cls.MASTER_KEY)

    @classmethod
    def get_index(cls):
        """获取索引对象"""
        client = cls.get_client()
        return client.index(cls.INDEX_NAME)
```

### 3.2 文档结构

```python
# Meilisearch 文档结构
backlog_document = {
    # 主键
    "id": "backlog_task:01HQ...",
    "surreal_id": "backlog_task:01HQ...",
    "display_id": "BL-CA-17",

    # 可搜索内容（中文）
    "title_zh": "文件保存自动触发分析",
    "description_zh": "当用户保存文件时，自动触发代码分析...",
    "tags_zh": "代码分析 自动化 P0",

    # 原始内容（备用）
    "title": "文件保存自动触发分析",
    "description": "当用户保存文件时，自动触发代码分析...",
    "tags": ["代码分析", "自动化", "P0"],

    # 状态字段
    "status": "in_progress",
    "priority": "P0",

    # 分类字段
    "scene": "代码分析v1.4",
    "tags": ["代码分析", "自动化", "P0"],

    # 隔离字段
    "tenant_id": "default",
    "project_id": "@csuwl/opencode-memory-plugin",

    # 时间字段（Unix 时间戳）
    "created_at": 1703980800,
    "updated_at": 1704067200,
    "started_at": 1704067200,
    "completed_at": None,

    # 来源字段
    "source_type": "ai_generated",
    "source_created_by": "claude",

    # 元数据（可选，用于过滤）
    "estimated_hours": 4,
    "actual_hours": 2,
}
```

### 3.3 初始化脚本

```python
# scripts/init_backlog_index.py

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Backlog Meilisearch 索引初始化脚本
"""

import sys
import time
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from meilisearch_code.config_backlog import BacklogMeiliConfig
from meilisearch.errors import MeilisearchApiError


def check_server_health(max_retries=30, delay=2):
    """等待 Meilisearch 服务启动"""
    import requests

    print("⏳ 等待 Meilisearch 服务启动...")

    for i in range(max_retries):
        try:
            response = requests.get(
                f"{BacklogMeiliConfig.HOST}/health",
                timeout=5
            )
            if response.status_code == 200:
                print("✅ Meilisearch 服务已就绪")
                return True
        except requests.RequestException:
            pass

        print(f"   重试 {i + 1}/{max_retries}...")
        time.sleep(delay)

    print("❌ Meilisearch 服务启动超时")
    return False


def create_or_update_index():
    """创建或更新索引"""
    print("\n" + "=" * 70)
    print("🔧 开始配置 Backlog Meilisearch 索引")
    print("=" * 70)

    try:
        client = BacklogMeiliConfig.get_client()
        index = client.index(BacklogMeiliConfig.INDEX_NAME)

        # 1. 创建索引
        print(f"\n📁 索引名称：{BacklogMeiliConfig.INDEX_NAME}")
        try:
            client.create_index(
                BacklogMeiliConfig.INDEX_NAME,
                {"primaryKey": "id"}
            )
            print("✅ 索引创建成功")
        except MeilisearchApiError as e:
            if "index_already_exists" in str(e).lower():
                print("ℹ️  索引已存在，将更新配置")
            else:
                raise

        # 2. 应用配置
        print("\n⚙️  应用索引配置...")
        task = index.update_settings(BacklogMeiliConfig.SETTINGS)
        client.wait_for_task(task.task_uid, timeout_in_ms=60000)
        print("✅ 配置更新成功")

        # 3. 验证配置
        print("\n🔍 验证配置...")
        current_settings = index.get_settings()

        assertions = [
            (
                set(current_settings.get("searchableAttributes", [])),
                set(BacklogMeiliConfig.SETTINGS["searchableAttributes"]),
                "searchableAttributes",
            ),
            (
                set(current_settings.get("filterableAttributes", [])),
                set(BacklogMeiliConfig.SETTINGS["filterableAttributes"]),
                "filterableAttributes",
            ),
        ]

        for actual, expected, name in assertions:
            if actual == expected:
                print(f"   ✅ {name} 验证通过")
            else:
                print(f"   ❌ {name} 验证失败")
                print(f"      期望: {expected}")
                print(f"      实际: {actual}")
                return False

        print("\n" + "=" * 70)
        print("✅ Backlog 索引初始化完成")
        print("=" * 70)
        return True

    except Exception as e:
        print(f"\n❌ 初始化失败: {e}")
        return False


def main():
    """主函数"""
    if not check_server_health():
        sys.exit(1)

    if not create_or_update_index():
        sys.exit(1)

    print("\n🎉 全部完成！")
    print(f"\n索引信息:")
    print(f"  - 名称: {BacklogMeiliConfig.INDEX_NAME}")
    print(f"  - 地址: {BacklogMeiliConfig.HOST}")
    print(f"\n使用示例:")
    print(f'  curl "{BacklogMeiliConfig.HOST}/indexes/{BacklogMeiliConfig.INDEX_NAME}/search?q=代码分析"')


if __name__ == "__main__":
    main()
```

### 3.4 双写策略

```python
# wrapper/src/utils/backlog_manager/meili_sync.py

"""Backlog Meilisearch 双写/同步"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class BacklogMeiliSyncMixin:
    """Backlog Meilisearch 集成方法"""

    def _build_backlog_meili_doc(
        self,
        record_id: str,
        task_data: dict[str, Any],
        tenant_id: str
    ) -> dict[str, Any]:
        """构建 Backlog Meilisearch 文档"""
        from datetime import datetime, timezone

        # 基础字段
        doc: dict[str, Any] = {
            "id": record_id,
            "surreal_id": record_id,
            "display_id": task_data.get("display_id", ""),

            # 可搜索内容（中文）
            "title_zh": task_data.get("title", ""),
            "description_zh": task_data.get("description", ""),
            "tags_zh": " ".join(task_data.get("tags", [])),

            # 原始内容
            "title": task_data.get("title", ""),
            "description": task_data.get("description", ""),
            "tags": task_data.get("tags", []),

            # 状态字段
            "status": task_data.get("status", "backlog"),
            "priority": task_data.get("priority", "P2"),

            # 分类字段
            "scene": task_data.get("scene", ""),

            # 隔离字段
            "tenant_id": tenant_id,
            "project_id": task_data.get("project_id", "global"),

            # 时间字段（转换为 Unix 时间戳）
            "created_at": self._to_timestamp(task_data.get("created_at")),
            "updated_at": self._to_timestamp(task_data.get("updated_at")),
            "started_at": self._to_timestamp(task_data.get("started_at")),
            "completed_at": self._to_timestamp(task_data.get("completed_at")),

            # 来源字段
            "source_type": task_data.get("source", {}).get("type", "user_created"),
            "source_created_by": task_data.get("source", {}).get("created_by", "system"),
        }

        # 元数据（可选）
        metadata = task_data.get("metadata", {})
        if metadata:
            doc["estimated_hours"] = metadata.get("estimated_hours")
            doc["actual_hours"] = metadata.get("actual_hours")

        return doc

    def _to_timestamp(self, dt: Any) -> int | None:
        """转换为 Unix 时间戳"""
        if not dt:
            return None

        if isinstance(dt, str):
            from datetime import datetime
            try:
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            except:
                return None

        if hasattr(dt, 'timestamp'):
            return int(dt.timestamp())

        return None

    async def _sync_to_meili(
        self,
        record_id: str,
        task_data: dict[str, Any],
        tenant_id: str
    ) -> bool:
        """同步到 Meilisearch"""
        try:
            if not self._meili_client:
                logger.warning("[MeiliSync] Meilisearch 客户端未初始化")
                return False

            doc = self._build_backlog_meili_doc(record_id, task_data, tenant_id)

            await self._meili_client.add_documents([doc])
            logger.debug("[MeiliSync] 文档已同步: %s", record_id)
            return True

        except Exception as e:
            logger.error("[MeiliSync] 同步失败: %s, 错误: %s", record_id, e)
            # 不阻塞主流程
            return False

    async def _delete_from_meili(self, record_id: str) -> bool:
        """从 Meilisearch 删除"""
        try:
            if not self._meili_client:
                return False

            await self._meili_client.delete_document(record_id)
            logger.debug("[MeiliSync] 文档已删除: %s", record_id)
            return True

        except Exception as e:
            logger.error("[MeiliSync] 删除失败: %s, 错误: %s", record_id, e)
            return False
```

---

## 4. API 规范

### 4.1 端点概览

| 端点                                          | 方法   | 功能         | 认证    |
| --------------------------------------------- | ------ | ------------ | ------- |
| `/api/v1/backlog/tasks`                       | POST   | 创建任务     | 🌍 公开 |
| `/api/v1/backlog/tasks`                       | GET    | 查询任务     | 🌍 公开 |
| `/api/v1/backlog/tasks/{display_id}`          | GET    | 获取单个任务 | 🌍 公开 |
| `/api/v1/backlog/tasks/{display_id}`          | PATCH  | 更新任务     | 🌍 公开 |
| `/api/v1/backlog/tasks/{display_id}`          | DELETE | 删除任务     | 🌍 公开 |
| `/api/v1/backlog/tasks/{display_id}/start`    | POST   | 开始任务     | 🌍 公开 |
| `/api/v1/backlog/tasks/{display_id}/complete` | POST   | 完成任务     | 🌍 公开 |
| `/api/v1/backlog/tasks/{display_id}/block`    | POST   | 阻塞任务     | 🌍 公开 |
| `/api/v1/backlog/tasks/batch`                 | POST   | 批量操作     | 🌍 公开 |
| `/api/v1/backlog/scenes`                      | POST   | 创建场景     | 🌍 公开 |
| `/api/v1/backlog/scenes`                      | GET    | 查询场景     | 🌍 公开 |
| `/api/v1/backlog/export`                      | GET    | 导出任务     | 🌍 公开 |
| `/api/v1/backlog/import`                      | POST   | 导入任务     | 🌍 公开 |

### 4.2 详细端点规范

#### 4.2.1 创建任务

```yaml
POST /api/v1/backlog/tasks

Description: 创建新任务（自动分配 display_id）

Headers:
  X-Tenant-ID:
    type: string
    default: default
    description: 租户ID（可选，优先级高于Body）
  X-Project-ID:
    type: string
    default: global
    description: 项目ID（可选，优先级高于Body）

Request Body:
  type: BacklogTaskCreateRequest
  example:
    {
      "title": "文件保存自动触发分析",
      "description": "当用户保存文件时，自动触发代码分析...",
      "priority": "P0",
      "scene": "代码分析v1.4",
      "project_id": "@csuwl/opencode-memory-plugin",
      "tenant_id": "default",
      "tags": ["代码分析", "自动化"],
      "metadata": {
        "scope": ["lib/file-watcher.js", "plugin.js"],
        "acceptance_criteria": ["使用chokidar监听", "300ms防抖"],
        "verification_method": "手动测试+单元测试",
        "estimated_hours": 4
      },
      "relations": {
        "depends_on": ["BL-CA-16"],
        "blocks": []
      },
      "source": {
        "type": "ai_generated",
        "created_by": "claude",
        "detail": "从对话分析自动生成"
      }
    }

Responses:
  201:
    description: 创建成功
    content:
      application/json:
        schema: BacklogTaskResponse
        example:
          {
            "id": "backlog_task:01HQ...",
            "display_id": "BL-CA-17",
            "title": "文件保存自动触发分析",
            "status": "backlog",
            "priority": "P0",
            "scene": "代码分析v1.4",
            "project_id": "@csuwl/opencode-memory-plugin",
            "tenant_id": "default",
            "created_at": "2026-04-07T12:00:00Z",
            "updated_at": "2026-04-07T12:00:00Z"
          }

  400:
    description: 参数错误
    content:
      application/json:
        example:
          {
            "error": {
              "code": "VALIDATION_ERROR",
              "message": "Invalid priority: must be P0/P1/P2/P3"
            }
          }

  503:
    description: BacklogManager 未初始化
```

#### 4.2.2 查询任务

```yaml
GET /api/v1/backlog/tasks

Description: 查询任务列表（支持过滤）

Headers:
  X-Tenant-ID:
    type: string
    default: default
  X-Project-ID:
    type: string
    default: global

Query Parameters:
  status:
    type: string
    enum: [backlog, todo, in_progress, in_review, blocked, completed, cancelled, archived]
    description: 按状态过滤
  priority:
    type: string
    enum: [P0, P1, P2, P3]
    description: 按优先级过滤
  scene:
    type: string
    description: 按场景过滤
  project_id:
    type: string
    description: 按项目过滤（可选，默认使用Header或global）
  tags:
    type: array[string]
    description: 按标签过滤
  limit:
    type: integer
    default: 50
    minimum: 1
    maximum: 100
  offset:
    type: integer
    default: 0
    minimum: 0

Responses:
  200:
    description: 查询成功
    content:
      application/json:
        schema: BacklogTaskListResponse
        example:
          {
            "data": [
              {
                "id": "backlog_task:01HQ...",
                "display_id": "BL-CA-17",
                "title": "文件保存自动触发分析",
                "status": "in_progress",
                "priority": "P0",
                "scene": "代码分析v1.4",
                "created_at": "2026-04-07T12:00:00Z"
              }
            ],
            "meta": {
              "total": 25,
              "limit": 50,
              "offset": 0,
              "has_more": false
            }
          }
```

#### 4.2.3 更新任务

```yaml
PATCH /api/v1/backlog/tasks/{display_id}

Description: 部分更新任务

Path Parameters:
  display_id:
    type: string
    example: BL-CA-17
    description: 任务展示ID

Headers:
  X-Tenant-ID:
    type: string
    default: default
  X-Project-ID:
    type: string
    default: global

Request Body:
  type: BacklogTaskUpdateRequest
  example:
    {
      "status": "in_progress",
      "metadata": {
        "actual_hours": 2
      }
    }

Responses:
  200:
    description: 更新成功
    content:
      application/json:
        schema: BacklogTaskResponse

  400:
    description: 无效的状态流转
    content:
      application/json:
        example:
          {
            "error": {
              "code": "INVALID_STATUS_TRANSITION",
              "message": "Cannot transition from 'completed' to 'in_progress'",
              "allowed_transitions": ["archived"]
            }
          }

  404:
    description: 任务不存在
```

#### 4.2.4 意图驱动操作

```yaml
POST /api/v1/backlog/tasks/{display_id}/start

Description: 开始任务（状态: backlog/todo → in_progress）

Path Parameters:
  display_id:
    type: string

Responses:
  200:
    description: 操作成功
    content:
      application/json:
        schema: BacklogTaskResponse

POST /api/v1/backlog/tasks/{display_id}/complete

Description: 完成任务（状态: in_progress/in_review → completed）

Path Parameters:
  display_id:
    type: string

Responses:
  200:
    description: 操作成功

POST /api/v1/backlog/tasks/{display_id}/block

Description: 阻塞任务（状态: in_progress → blocked）

Path Parameters:
  display_id:
    type: string

Request Body:
  type: object
  properties:
    reason:
      type: string
      description: 阻塞原因

Responses:
  200:
    description: 操作成功
```

#### 4.2.5 批量操作

```yaml
POST /api/v1/backlog/tasks/batch

Description: 批量操作任务

Headers:
  X-Tenant-ID:
    type: string
    default: default

Request Body:
  type: BacklogTaskBatchRequest
  example:
    {
      "operations": [
        {
          "action": "update",
          "display_id": "BL-CA-17",
          "data": {
            "status": "in_progress"
          }
        },
        {
          "action": "update",
          "display_id": "BL-CA-18",
          "data": {
            "priority": "P0"
          }
        }
      ],
      "tenant_id": "default"
    }

Responses:
  200:
    description: 批量操作完成
    content:
      application/json:
        example:
          {
            "success": 2,
            "failed": 0,
            "results": [
              {
                "display_id": "BL-CA-17",
                "status": "success"
              },
              {
                "display_id": "BL-CA-18",
                "status": "success"
              }
            ]
          }
```

#### 4.2.6 导出任务

```yaml
GET /api/v1/backlog/export

Description: 导出任务为 Markdown 或 JSON

Headers:
  X-Tenant-ID:
    type: string
    default: default

Query Parameters:
  format:
    type: string
    enum: [markdown, json]
    default: markdown
  scene:
    type: string
    description: 按场景过滤
  project_id:
    type: string
    description: 按项目过滤

Responses:
  200:
    description: 导出成功
    content:
      text/markdown:
        example: |
          # Backlog

          ## 代码分析v1.4

          ### BL-CA-17 [P0] 文件保存自动触发分析
          | 项目 | 内容 |
          |------|------|
          | **状态** | 🔄 in_progress |
          | **目标** | 当用户保存文件时，自动触发代码分析... |
          | **涉及范围** | lib/file-watcher.js<br>plugin.js |
          | **前置依赖** | BL-CA-16 |
          | **完成标准** | 使用chokidar监听<br>300ms防抖 |
          | **验证方式** | 手动测试+单元测试 |
```

### 4.3 错误码规范

| 错误码                            | HTTP状态 | 说明                    |
| --------------------------------- | -------- | ----------------------- |
| `VALIDATION_ERROR`                | 400      | 参数验证失败            |
| `INVALID_STATUS_TRANSITION`       | 400      | 无效的状态流转          |
| `CIRCULAR_DEPENDENCY`             | 400      | 循环依赖检测            |
| `TASK_NOT_FOUND`                  | 404      | 任务不存在              |
| `SCENE_NOT_FOUND`                 | 404      | 场景不存在              |
| `BACKLOG_MANAGER_NOT_INITIALIZED` | 503      | BacklogManager 未初始化 |
| `INTERNAL_ERROR`                  | 500      | 内部服务器错误          |

### 4.4 状态机流转

```
┌─────────┐    ┌─────────┐    ┌─────────────┐
│ BACKLOG │───→│   TODO  │───→│ IN_PROGRESS │
│ (待规划)│    │ (待开始)│    │  (进行中)   │
└────┬────┘    └────┬────┘    └──────┬──────┘
     │              │               │
     ↓              ↓               ↓
┌─────────┐    ┌─────────┐    ┌─────────────┐
│CANCELLED│    │CANCELLED│    │   BLOCKED   │
│(已取消) │    │(已取消) │    │   (阻塞)    │
└────┬────┘    └────┬────┘    └──────┬──────┘
     │              │               │
     └──────────────┴───────────────┘
                    │
                    ↓
             ┌─────────────┐    ┌───────────┐
             │  IN_REVIEW  │───→│ COMPLETED │
             │   (审核中)    │    │  (已完成) │
             └─────────────┘    └─────┬─────┘
                                      │
                                      ↓
                                ┌───────────┐
                                │  ARCHIVED │
                                │  (已归档) │
                                └───────────┘
```

---

## 5. 服务层设计

### 5.1 BacklogManager 架构

```python
# wrapper/src/utils/backlog_manager/manager.py

"""BacklogManager - 主类"""

import logging
from surrealdb import AsyncSurreal

from .crud import BacklogCrudMixin
from .search import BacklogSearchMixin
from .relations import BacklogRelationsMixin
from .meili_sync import BacklogMeiliSyncMixin

logger = logging.getLogger(__name__)


class BacklogManager(
    BacklogCrudMixin,
    BacklogSearchMixin,
    BacklogRelationsMixin,
    BacklogMeiliSyncMixin,
):
    """Backlog 管理器

    使用 Mixin 模式组织功能：
    - CrudMixin: 增删改查
    - SearchMixin: 搜索查询
    - RelationsMixin: 关系图谱
    - MeiliSyncMixin: Meilisearch 同步
    """

    def __init__(
        self,
        db: AsyncSurreal,
        meili_client=None,
        default_tenant_id: str = "default",
    ):
        self._db = db
        self._meili_client = meili_client
        self._default_tenant_id = default_tenant_id
```

### 5.2 CRUD Mixin

```python
# wrapper/src/utils/backlog_manager/crud.py

"""Backlog CRUD 操作"""

import logging
from typing import Any

from ..exceptions import ValidationError, DatabaseError

logger = logging.getLogger(__name__)


class BacklogCrudMixin:
    """CRUD 操作 Mixin"""

    async def create_task(
        self,
        task_data: dict[str, Any],
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """创建任务"""
        effective_tenant_id = tenant_id or self._default_tenant_id

        # 生成 display_id
        display_id = await self._generate_display_id(
            task_data.get("scene", "general"),
            effective_tenant_id,
        )

        # 构建完整任务
        task = {
            "display_id": display_id,
            "tenant_id": effective_tenant_id,
            "project_id": task_data.get("project_id", "global"),
            "status": "backlog",
            **task_data,
            "created_at": "time::now()",
            "updated_at": "time::now()",
        }

        # 插入 SurrealDB
        result = await self._db.create("backlog_task", task)
        created = result[0] if result else None

        if created:
            # 同步到 Meilisearch
            await self._sync_to_meili(created["id"], created, effective_tenant_id)

        return created

    async def _generate_display_id(
        self,
        scene: str,
        tenant_id: str,
    ) -> str:
        """生成 display_id"""
        # 查询该租户该场景下最大编号
        result = await self._db.query(
            """
            SELECT display_id FROM backlog_task
            WHERE scene = $scene AND tenant_id = $tenant_id
            ORDER BY display_id DESC LIMIT 1
            """,
            {"scene": scene, "tenant_id": tenant_id}
        )

        next_num = 1
        if result and result[0]:
            import re
            match = re.search(r"-(\d+)$", result[0].get("display_id", ""))
            if match:
                next_num = int(match.group(1)) + 1

        # 场景缩写
        scene_abbr = self._get_scene_abbreviation(scene)
        return f"BL-{scene_abbr}-{next_num}"

    def _get_scene_abbreviation(self, scene: str) -> str:
        """获取场景缩写"""
        mappings = {
            "代码分析": "CA",
            "文档治理": "DOC",
            "隐式偏好发现": "IPD",
        }

        for key, abbr in mappings.items():
            if key in scene:
                return abbr

        return scene[:3].upper()
```

### 5.3 Search Mixin

```python
# wrapper/src/utils/backlog_manager/search.py

"""Backlog 搜索操作"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


class BacklogSearchMixin:
    """搜索操作 Mixin"""

    async def search_tasks(
        self,
        query: str,
        tenant_id: str | None = None,
        filters: dict[str, Any] | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict[str, Any]:
        """搜索任务"""
        effective_tenant_id = tenant_id or self._default_tenant_id

        # 使用 Meilisearch 搜索
        if self._meili_client and query:
            return await self._search_by_meili(
                query,
                effective_tenant_id,
                filters,
                limit,
                offset,
            )

        # 回退到 SurrealDB
        return await self._search_by_surreal(
            effective_tenant_id,
            filters,
            limit,
            offset,
        )

    async def _search_by_meili(
        self,
        query: str,
        tenant_id: str,
        filters: dict[str, Any] | None,
        limit: int,
        offset: int,
    ) -> dict[str, Any]:
        """使用 Meilisearch 搜索"""
        # 构建过滤条件
        filter_str = f"tenant_id = '{tenant_id}'"

        if filters:
            if filters.get("status"):
                filter_str += f" AND status = '{filters['status']}'"
            if filters.get("priority"):
                filter_str += f" AND priority = '{filters['priority']}'"
            if filters.get("scene"):
                filter_str += f" AND scene = '{filters['scene']}'"

        # 执行搜索
        results = await self._meili_client.search(
            query,
            {
                "filter": filter_str,
                "limit": limit,
                "offset": offset,
            }
        )

        return {
            "results": results.get("hits", []),
            "total": results.get("estimatedTotalHits", 0),
            "mode": "meilisearch",
        }
```

---

## 6. 插件端集成

### 6.1 OpenCode 工具定义

```javascript
// opencode-memory-plugin/tools/backlog.js

import { tool } from "@opencode-ai/plugin";
import { getWrapperClient, getConfig } from "../lib/wrapper-client.js";
import { resolveProjectId } from "../lib/project-resolver.js";

/**
 * 创建 Backlog 任务
 */
export const backlog_create = tool({
  name: "backlog_create",
  description: "创建新的 Backlog 任务",
  parameters: {
    title: {
      type: "string",
      description: "任务标题",
    },
    description: {
      type: "string",
      description: "任务描述",
    },
    priority: {
      type: "string",
      enum: ["P0", "P1", "P2", "P3"],
      default: "P2",
      description: "优先级",
    },
    scene: {
      type: "string",
      description: "所属场景",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      default: [],
      description: "标签列表",
    },
    metadata: {
      type: "object",
      description:
        "元数据（scope, acceptance_criteria, verification_method, estimated_hours）",
    },
    relations: {
      type: "object",
      description: "关系（depends_on, blocks）",
    },
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const projectId = await resolveProjectId(config);

    const result = await client.createBacklogTask({
      ...args,
      project_id: projectId,
    });

    return {
      content: `任务创建成功: ${result.display_id}`,
      data: result,
    };
  },
});

/**
 * 查询 Backlog 任务
 */
export const backlog_query = tool({
  name: "backlog_query",
  description: "查询 Backlog 任务",
  parameters: {
    status: {
      type: "string",
      enum: [
        "backlog",
        "todo",
        "in_progress",
        "in_review",
        "blocked",
        "completed",
        "cancelled",
        "archived",
      ],
      description: "按状态过滤",
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
      description: "返回数量限制",
    },
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const projectId = await resolveProjectId(config);

    const result = await client.queryBacklogTasks({
      ...args,
      project_id: projectId,
    });

    return {
      content: `查询到 ${result.meta.total} 个任务`,
      data: result,
    };
  },
});

/**
 * 更新 Backlog 任务
 */
export const backlog_update = tool({
  name: "backlog_update",
  description: "更新 Backlog 任务",
  parameters: {
    display_id: {
      type: "string",
      description: "任务展示ID",
    },
    status: {
      type: "string",
      description: "新状态",
    },
    priority: {
      type: "string",
      description: "新优先级",
    },
    // ... 其他可更新字段
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    const { display_id, ...updates } = args;
    const result = await client.updateBacklogTask(display_id, updates);

    return {
      content: `任务 ${display_id} 更新成功`,
      data: result,
    };
  },
});
```

### 6.2 WrapperClient 扩展

```javascript
// opencode-memory-plugin/lib/wrapper-client.js (新增方法)

export class WrapperClient {
  // ... 现有代码 ...

  /**
   * 创建 Backlog 任务
   */
  async createBacklogTask(taskData) {
    const projectId = await resolveProjectId(this.config);

    const requestBody = {
      ...taskData,
      tenant_id: taskData.tenant_id || this.tenantId,
      project_id: taskData.project_id || projectId,
    };

    return await this.http.post("/api/v1/backlog/tasks", requestBody);
  }

  /**
   * 查询 Backlog 任务
   */
  async queryBacklogTasks(filters = {}) {
    const params = new URLSearchParams();

    params.append("tenant_id", filters.tenant_id || this.tenantId);

    if (filters.project_id) {
      params.append("project_id", filters.project_id);
    }
    if (filters.status) {
      params.append("status", filters.status);
    }
    if (filters.priority) {
      params.append("priority", filters.priority);
    }
    if (filters.scene) {
      params.append("scene", filters.scene);
    }
    if (filters.limit) {
      params.append("limit", filters.limit.toString());
    }

    return await this.http.get(`/api/v1/backlog/tasks?${params.toString()}`);
  }

  /**
   * 更新 Backlog 任务
   */
  async updateBacklogTask(displayId, updates) {
    const requestBody = {
      ...updates,
      tenant_id: updates.tenant_id || this.tenantId,
    };

    return await this.http.patch(
      `/api/v1/backlog/tasks/${displayId}`,
      requestBody,
    );
  }
}
```

---

## 7. 迁移方案

### 7.1 从 BACKLOG.md 导入

```python
# scripts/migrate_backlog.py

#!/usr/bin/env python3
"""
BACKLOG.md 迁移脚本
将现有 Markdown 格式的 Backlog 迁移到新的 API
"""

import re
import json
from pathlib import Path
from datetime import datetime

import httpx


def parse_backlog_md(content: str) -> list[dict]:
    """解析 BACKLOG.md"""
    tasks = []
    current_scene = None

    lines = content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]

        # 场景标题
        if line.startswith('## '):
            current_scene = line[3:].strip()
            i += 1
            continue

        # 任务标题
        task_match = re.match(r'### (BL-\d+) \[(P\d)\] (.+)', line)
        if task_match:
            display_id = task_match.group(1)
            priority = task_match.group(2)
            title = task_match.group(3)

            task = {
                'display_id': display_id,
                'priority': priority,
                'title': title,
                'scene': current_scene or '未分类',
                'status': 'backlog',
                'description': '',
                'metadata': {
                    'scope': [],
                    'acceptance_criteria': [],
                    'verification_method': '',
                },
                'relations': {
                    'depends_on': [],
                    'blocks': [],
                },
            }

            # 解析表格内容
            i += 1
            while i < len(lines) and not lines[i].startswith('### '):
                if '|' in lines[i] and '**' in lines[i]:
                    # 解析表格行
                    row_match = re.match(r'\| \*\*(.+?)\*\* \| (.+?) \|', lines[i])
                    if row_match:
                        key = row_match.group(1).strip()
                        value = row_match.group(2).strip()

                        if key == '目标':
                            task['description'] = value
                        elif key == '涉及范围':
                            task['metadata']['scope'] = [v.strip() for v in value.split('<br>') if v.strip()]
                        elif key == '前置依赖':
                            deps = re.findall(r'BL-\d+', value)
                            task['relations']['depends_on'] = deps
                        elif key == '完成标准':
                            task['metadata']['acceptance_criteria'] = [v.strip() for v in value.split('<br>') if v.strip()]
                        elif key == '验证方式':
                            task['metadata']['verification_method'] = value

                i += 1

            tasks.append(task)
            continue

        i += 1

    return tasks


async def migrate_to_api(tasks: list[dict], api_url: str = 'http://localhost:17999'):
    """迁移到 API"""
    async with httpx.AsyncClient() as client:
        for task in tasks:
            try:
                response = await client.post(
                    f'{api_url}/api/v1/backlog/tasks',
                    json={
                        'title': task['title'],
                        'description': task['description'],
                        'priority': task['priority'],
                        'scene': task['scene'],
                        'metadata': task['metadata'],
                        'relations': task['relations'],
                        'source': {
                            'type': 'user_imported',
                            'created_by': 'migration_script',
                            'detail': f"从 {task['display_id']} 迁移",
                        },
                    },
                )

                if response.status_code == 201:
                    result = response.json()
                    print(f"✅ 迁移成功: {task['display_id']} -> {result['display_id']}")
                else:
                    print(f"❌ 迁移失败: {task['display_id']} - {response.text}")

            except Exception as e:
                print(f"❌ 异常: {task['display_id']} - {e}")


def main():
    """主函数"""
    import asyncio

    # 读取 BACKLOG.md
    backlog_path = Path(__file__).parent.parent / 'BACKLOG.md'
    if not backlog_path.exists():
        print(f"❌ 找不到文件: {backlog_path}")
        return

    content = backlog_path.read_text(encoding='utf-8')

    # 解析任务
    tasks = parse_backlog_md(content)
    print(f"📋 解析到 {len(tasks)} 个任务")

    # 迁移到 API
    asyncio.run(migrate_to_api(tasks))

    print("\n🎉 迁移完成！")


if __name__ == '__main__':
    main()
```

---

## 8. 附录

### 8.1 术语表

| 术语           | 说明                                         |
| -------------- | -------------------------------------------- |
| **Backlog**    | 待办事项列表                                 |
| **Scene**      | 场景，任务的分类维度                         |
| **Display ID** | 人类可读的任务ID，格式 BL-{场景}-{N}         |
| **Tenant**     | 租户，多租户隔离的单位                       |
| **Project**    | 项目，任务归属的项目                         |
| **5要素**      | 目标、涉及范围、前置依赖、完成标准、验证方式 |

### 8.2 参考资料

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [SurrealDB 文档](https://surrealdb.com/docs)
- [Meilisearch 文档](https://www.meilisearch.com/docs)
- [后端记忆服务 API 契约](./API-CONTRACT.md)

### 8.3 变更历史

| 版本   | 日期       | 变更内容 |
| ------ | ---------- | -------- |
| v1.0.0 | 2026-04-07 | 初始版本 |

---

**文档结束**
