# 后端对齐文档 - 代码分析 v1.4

> **日期**: 2026-04-07  
> **版本**: v1.0  
> **状态**: 已确认，待实施  
> **相关文档**: `CODE-ANALYSIS-DESIGN-v1.4.md`

---

## 1. 概述

本文档记录插件端与后端团队就代码分析 v1.4 实施的技术细节达成的共识。所有内容基于双方往来信函确认。

**往来信函**:

- 插件端对齐信: `handoffs/backend-clarification-letter-20260407.md`
- 后端回复函: `embedding_service/inbox/backend-clarification-reply-20260407.md`

---

## 2. 技术细节确认

### 2.1 CallSymbol 结构（问题 1 确认）

**后端要求**: `calls` 数组中的每个条目必须包含 `file_path` 字段

```typescript
interface CallSymbol {
  target: string; // 被调用函数名
  file_path: string; // ← 新增必需字段（相对于项目根目录）
  line: number; // 调用所在行
  column?: number; // 调用所在列（可选）
}
```

**示例**:

```json
{
  "target": "funcB",
  "file_path": "src/utils/helpers.ts",
  "line": 42,
  "column": 10
}
```

**后端解析机制**:

- 使用复合键 `(project_id, file_path, function_name)` 解析 `target`
- SurrealDB 将创建复合索引
- 解析失败时标记为 `unresolved`，不阻塞上传流程

---

### 2.2 调用关系双向查询（问题 2 确认）

**Phase 2（当前）行为**:

| 场景                       | 行为     | 返回值                |
| -------------------------- | -------- | --------------------- |
| 目标函数已分析且关系已建立 | 正常查询 | 匹配的 memory_id 列表 |
| 目标函数未分析             | 静默处理 | 空数组 `[]`           |
| 目标函数已分析但无调用关系 | 正常查询 | 空数组 `[]`           |

**关键约定**: 关系不存在时一律返回空数组，**不返回错误**

**Phase 3+ 规划**:

- 递归调用链查询（可配置深度，默认 5 层，最大 10 层）
- 循环依赖检测
- 调用链缓存

**API 端点**:

```yaml
GET /api/v1/memories/{id}/references    # 谁调用了我
GET /api/v1/memories/{id}/dependencies  # 我调用了谁
```

---

### 2.3 代码地图数据来源（问题 3 确认）

**结论**: 采用方案 B（从已上传记忆聚合）

**数据来源**:

```sql
SELECT DISTINCT metadata.code_analysis.file_path
FROM memories
WHERE project_id = $project_id
  AND type = 'code_analysis';
```

**对插件端的要求**:

- 确保项目全量上传
- 代码地图的完整性依赖已上传的记忆
- 未上传的文件不会出现在 `file_tree` 中

**后端处理**:

- 从聚合的 `file_path` 列表构建树形结构
- 支持文件类型过滤
- 不需要插件端额外提供文件列表接口

---

### 2.4 复杂度字段命名（问题 4 确认）

**统一命名**:

| 字段             | 类型              | 说明             |
| ---------------- | ----------------- | ---------------- |
| `min_complexity` | `integer \| null` | 函数最小圈复杂度 |
| `max_complexity` | `integer \| null` | 函数最大圈复杂度 |

**原因**:

- 与设计文档 v1.4 保持一致
- 与现有 `code_complexity` 字段风格统一
- 符合 Meilisearch filter 惯例

---

### 2.5 每周同步安排（问题 5 确认）

**时间**: 每周五 16:00 - 16:30（北京时间）  
**首次同步**: 2026-04-10（本周五）

**形式**:

- 以异步文档更新为主
- 阻塞问题即时沟通，无需等待周五

**同步内容模板**:

```markdown
## [团队] 周报 - 2026-Wxx

### 本周完成

- [x] 任务描述（关联 BL-CA-xx）

### 下周计划

- [ ] 任务描述（关联 BL-CA-xx）

### 阻塞问题

- ⚠️ 问题描述 → 负责人 → 预期解决时间

### 技术决策

- 决策内容 → 原因 → 影响范围
```

---

## 3. 后端 API 实施路线图

### Phase 1: Schema 扩展（BL-CA-18）

**时间**: 2 周（2026-04-07 至 2026-04-21）

**内容**:

- Meilisearch 新增 filterable 字段
- SurrealDB `calls` 表设计
- 复合索引创建

### Phase 2: 调用关系 API（BL-CA-20~22）

**依赖**: Phase 1 完成 + 插件端 BL-CA-12 完成

**API 端点**:

- `POST /api/v1/calls/batch` - 批量创建调用关系
- `GET /api/v1/memories/{id}/references` - 引用查询
- `GET /api/v1/memories/{id}/dependencies` - 依赖查询

### Phase 3: 代码地图 API（BL-CA-23~25）

**依赖**: Phase 1 完成

**API 端点**:

- `GET /api/v1/projects/{id}/map` - 项目代码地图
- `GET /api/v1/projects/{id}/stats` - 项目统计
- `GET /api/v1/projects/{id}/hot-files` - 热点文件

---

## 4. 插件端实施要点

### BL-CA-12 关键变更

根据后端确认，CallSymbol 提取需要调整：

1. **必须包含 `file_path` 字段**
   - 相对于项目根目录的路径
   - 与上传时的 `file_path` 一致

2. **支持跨文件调用解析**
   - 后端通过 `(project_id, file_path, target)` 解析
   - 插件端无需预先查询 target 的 memory_id

3. **错误处理**
   - 解析失败时后端标记为 `unresolved`
   - 不阻塞上传流程

### 数据格式示例

```json
{
  "content": "...",
  "type": "code",
  "metadata": {
    "file_path": "src/auth.ts",
    "code_analysis": {
      "language": "typescript",
      "analyzer": "oxc",
      "functions": [...],
      "calls": [
        {
          "target": "hashPassword",
          "file_path": "src/utils/crypto.ts",
          "line": 42,
          "column": 10
        }
      ]
    }
  }
}
```

---

## 5. 下一步行动

### 插件端（本周）

- [ ] 调整 `CallSymbol` 结构，增加 `file_path` 字段
- [ ] 提供示例 CodeAnalysisResult JSON
- [ ] 确认项目全量上传策略
- [ ] 启动 BL-CA-12 实现

### 后端（本周）

- [x] 回复澄清函（已完成）
- [ ] 创建 BL-CA-18 实施分支
- [ ] 建立复合索引
- [ ] 准备联调环境

### 双方共同

- [ ] 首次同步：2026-04-10（周五）16:00
- [ ] 建立共享同步文档

---

## 6. 参考文档

- 设计文档: `embedding_service/docs/CODE-ANALYSIS-DESIGN-v1.4.md`
- 后端任务: `embedding_service/BACKLOG.md` Scene 9
- 插件端任务: `BACKLOG.md` Scene 9

---

_文档版本: v1.0_  
_最后更新: 2026-04-07_  
_状态: 已确认，待实施_
