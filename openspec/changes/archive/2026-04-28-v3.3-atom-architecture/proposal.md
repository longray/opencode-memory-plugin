# v3.3 Atom 架构实施提案

## 概述

将现有扁平记忆存储升级为**层级化知识图谱架构**，支持 Entity（知识实体）和 Atom（原子单元）的两级存储模型。

## 目标

1. **Entity（知识实体）**：保留 L0/L1/L2 三层结构，L2 由 Atom 树组成
2. **Atom（原子单元）**：原子级内容，支持层级结构（parent_id），无 L0/L1/L2
3. **双向链接**：Obsidian 兼容的 `[[链接]]` 语法
4. **统一搜索**：跨 Entity 和 Atom 的混合搜索
5. **Obsidian 导入/导出**：完整的知识库迁移能力

## 范围

### 包含

- 后端 API 扩展（Atom 字段、统一搜索端点）
- 插件端存储层改造（内嵌树模型）
- 插件端 API 扩展（memory_write/read/update_entity）
- 关键算法实现（三色 DFS、分数索引）
- 风险缓解（循环检测、悬挂引用处理）
- 向后兼容策略

### 不包含

- 自动数据迁移（旧数据保持原格式）
- 外部插件适配（提供迁移指南）

## 成功标准

1. 新 Entity 可以包含 Atom 树结构
2. Atom 支持 parent_id 层级和 order 排序
3. memory_read 自动检测 ID 类型（Entity/Atom）
4. update_entity 支持批量 Atom 操作（add/update/remove）
5. 循环引用被检测并拒绝写入
6. 向后兼容：旧格式 Entity 正常工作

## 风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 单文件大小超限 | 中 | 拆分为多个 Entity，监控 100KB 限制 |
| 循环 parent_id | 高 | 三色 DFS 检测，拒绝写入 |
| 悬挂 parent_id | 中 | 降级为根级，记录警告 |
| memory_read 返回值变更 | 中 | feature flag 控制，默认关闭 |

## 时间线

- Phase 1: 后端基础（1 周）
- Phase 2: 插件端核心（1 周）
- Phase 3: 风险缓解（1 周）
- Phase 4: 测试与优化（1 周）

## 相关文档

- [v3.3-ATOM-ARCHITECTURE-DESIGN.md](../../docs/v3.3-ATOM-ARCHITECTURE-DESIGN.md) - 完整设计文档
