## Why

当前知识图谱的代码关系提取存在严重瓶颈：depends_on关系仅占5.4%，calls关系仅占1.2%，extends关系仅占3%。根本原因是跨文件符号解析未实现，导致import路径无法映射到实体ID，函数调用无法解析到目标实体。同时，健康检查完全依赖人工触发，关系推荐需要手动运行CLI，自动化程度不足。需要实现自动代码关系提取和定时健康监控，将代码关系占比从9.6%提升到40%+。

## What Changes

- **跨文件符号解析**：实现`relPathToEntityId`映射，将import/require路径解析为实体ID，自动创建depends_on关系
- **全局符号表持久化**：缓存`globalNameToAtomId`映射，支持跨文件函数调用解析，自动创建calls关系
- **类继承关系提取**：在Oxc和Tree-sitter中完整提取superClass信息，自动创建extends关系
- **定时健康检查**：每日自动运行健康度检查，低于阈值时主动告警
- **双阈值自动推荐**：相似度>0.85自动创建关系，0.75-0.85待审核，<0.75忽略

## Capabilities

### New Capabilities

- `cross-file-symbol-resolution`: 跨文件符号解析，将import路径和函数调用映射到实体ID
- `global-symbol-table`: 全局符号表持久化缓存，支持增量更新和跨文件查询
- `auto-depends-on-extraction`: 自动提取模块依赖关系，基于import语句创建depends_on关系
- `auto-calls-extraction`: 自动提取函数调用关系，基于CallExpression创建calls关系
- `auto-extends-extraction`: 自动提取类继承关系，基于superClass创建extends关系
- `scheduled-health-check`: 定时健康检查，每日自动运行并生成报告
- `dual-threshold-recommendation`: 双阈值关系推荐，高置信度自动创建，中置信度待审核

### Modified Capabilities

- `code-analysis-service`: 修改上传流程，在uploadProject时构建符号表并创建代码关系
- `relation-recommender`: 修改推荐逻辑，实现双阈值策略和自动创建
- `quality-dashboard`: 添加定时任务支持，支持自动触发和告警通知

## Impact

- **插件端**:
  - 修改`lib/code-analysis-service.js`，添加符号表构建和关系创建逻辑
  - 修改`lib/relation-recommender.js`，实现双阈值策略
  - 修改`lib/quality-dashboard.js`，添加定时任务支持
  - 新增`lib/symbol-table.js`，全局符号表管理
  - 修改`plugin.js`，初始化定时任务
- **后端服务**: 无修改，使用现有createReference API

- **关系数量**:
  - depends_on: 137 → 500+ (提升265%)
  - calls: 30 → 1,000+ (提升3233%)
  - extends: 76 → 200+ (提升163%)
  - 代码关系占比: 9.6% → 40%+

- **自动化程度**:
  - 健康检查: 人工100% → 自动100%
  - 关系推荐: 人工100% → 自动70% + 待审核30%
  - 代码关系: 人工100% → 自动90%

- **性能影响**:
  - 代码分析时间: +10-20%（符号表构建开销）
  - 内存占用: +50MB（符号表缓存）
  - 首次同步时间: +30%（关系创建）

- **兼容性**:
  - 向后兼容：现有关系不受影响
  - 配置新增：`symbol_table.enabled`, `health_check.schedule`, `recommendation.thresholds`
