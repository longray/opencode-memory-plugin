# 代码分析功能设计文档 v1.4

> **版本**: v1.4.0  
> **日期**: 2026-04-07  
> **状态**: 实施中  
> **对应版本**: v3.0.0

---

## 1. 概述

本文档定义代码分析功能 v1.4 的设计规范，基于后端确认的技术细节（见 [BACKEND-ALIGNMENT-v1.4.md](./BACKEND-ALIGNMENT-v1.4.md)）。

### 1.1 目标

- 补齐 v1.2 设计文档承诺的数据字段
- 新增调用关系追踪功能
- 增强多语言支持（Python/Go/Rust/Java）

### 1.2 非目标

- 代码图谱可视化（v2.0 规划）
- 社区检测算法（v2.0 规划）
- MCP 工具集成（v2.0 规划）

---

## 2. 数据模型

### 2.1 FunctionSymbol（增强）

```typescript
interface FunctionSymbol {
  name: string;
  start_line: number;
  end_line: number;
  params: ParamSymbol[];
  return_type?: string; // v1.4 新增
  is_exported: boolean; // v1.4 新增
  is_async: boolean; // v1.4 新增
  complexity: number;
  max_nesting_depth: number;
  docstring?: string;
}
```

### 2.2 CallSymbol（v1.4 新增）

```typescript
interface CallSymbol {
  target: string; // 被调用函数名
  file_path: string; // 调用者文件路径（必需）
  line: number;
  column?: number;
}
```

**后端确认**: `file_path` 为必需字段，用于跨文件调用解析。

### 2.3 ClassSymbol（增强）

```typescript
interface ClassSymbol {
  name: string;
  start_line: number;
  end_line: number;
  methods: FunctionSymbol[];
  properties?: PropertySymbol[]; // v1.4 新增
  docstring?: string;
}
```

### 2.4 InterfaceSymbol（v1.4 新增）

```typescript
interface InterfaceSymbol {
  name: string;
  start_line: number;
  methods: FunctionSymbol[];
  properties?: PropertySymbol[];
}
```

---

## 3. 后端 API

### 3.1 Phase 1: Schema 扩展（BL-CA-18）

**Meilisearch 索引字段**:

```json
{
  "filterableAttributes": [
    "code_function_count",
    "code_class_count",
    "code_analyzer",
    "code_has_exports",
    "min_complexity",
    "max_complexity"
  ]
}
```

### 3.2 Phase 2: 调用关系 API（BL-CA-20~22）

| 端点                                     | 方法 | 说明               |
| ---------------------------------------- | ---- | ------------------ |
| `POST /api/v1/calls/batch`               | POST | 批量创建调用关系   |
| `GET /api/v1/memories/{id}/references`   | GET  | 查询谁调用了此函数 |
| `GET /api/v1/memories/{id}/dependencies` | GET  | 查询此函数调用了谁 |

### 3.3 Phase 3: 代码地图 API（⛔ 已推迟）

> ⚠️ **注意**: BL-CA-23~25 已取消/无限期推迟，代码地图功能不再作为 v1.4 范围。

| 端点                              | 方法 | 说明         | 状态      |
| --------------------------------- | ---- | ------------ | --------- |
| `GET /api/v1/projects/{id}/map`   | GET  | 项目代码地图 | ⛔ 已取消 |
| `GET /api/v1/projects/{id}/stats` | GET  | 项目统计     | ⛔ 已取消 |

---

## 4. 实施路线图

### Phase 1: 数据字段补齐（Week 1-2）

- BL-CA-11: 函数元数据字段（return_type, is_exported, is_async）
- BL-CA-13: 类成员提取（methods, properties, interfaces）
- BL-CA-15: AST 级别圈复杂度（Tree-sitter 路径）

> ⚠️ **已知限制**: Tree-sitter 路径暂不支持圈复杂度计算，复杂度字段可能为估算值或 null。

### Phase 2: 调用关系（Week 3-4）

- BL-CA-12: CallSymbol 提取
- BL-CA-18: 调用关系可视化（⚠️ 待后端 API 就绪）
- BL-CA-20: 质量趋势追踪（⚠️ Phase 3 任务可能推迟）

### Phase 3: 质量评分（⚠️ 可能推迟）

> ⚠️ **注意**: Phase 3 功能（BL-CA-16, BL-CA-20）与 Phase 3 API 依赖，可能无限期推迟。

---

## 5. 参考文档

- [BACKEND-ALIGNMENT-v1.4.md](./BACKEND-ALIGNMENT-v1.4.md) - 后端技术细节确认
- [CODE-ANALYSIS.md](../opencode-memory-plugin/CODE-ANALYSIS.md) - 产品文档
- [BACKLOG.md](../BACKLOG.md) - 任务追踪

---

_文档版本: v1.4.0_  
_最后更新: 2026-04-07_
