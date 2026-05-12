## Context

v3.3 代码关系提取功能已完成并通过审查。Metis + Explore 审查发现 7 个代码质量问题，均为不影响功能的优化项。当前代码存在以下模式问题：

- 常量在 3 个文件中重复定义（`SUPPORTED_EXTENSIONS`, `EXTENSION_TO_LANGUAGE`, `languageMap`）
- batch API 响应有两种不同的解析方式
- `rollbackAtoms` 执行了操作但不返回结果
- 推荐引擎每个实体调用 2 次 HTTP（搜索 + 获取关系），50 个实体 = 100 次 HTTP
- 150 行 builtin modules 列表内联在业务方法中

## Goals / Non-Goals

**Goals:**

- 消除常量重复定义，建立单一数据源
- 统一 batch API 调用模式（响应解析 + 错误处理）
- 减少推荐引擎 HTTP 调用次数（N+1 → 1+内存过滤）
- 提取大块内联数据为独立模块
- 提高代码可读性和可维护性

**Non-Goals:**

- 不改变外部 API 或行为（纯内部重构）
- 不涉及 uploadProject 并行化（需后端 batch entities/atoms API）
- 不改变关系推荐算法或阈值
- 不修改后端代码

## Decisions

1. **常量集中到 `constants.js`**: 已有 `constants.js` 文件，新增 `EXTENSION_TO_LANGUAGE` 和 `SUPPORTED_EXTENSIONS` 导出。所有模块从此导入。

2. **builtin modules 独立文件**: 新建 `lib/builtin-modules.js`，导出 `BUILTIN_MODULES` Set。理由：150 行数据不应混在业务逻辑中，且 `code-analyzer.js` 的 `BUILTIN_CALLS` 也可考虑未来合并。

3. **batch API 统一用 `result.created`**: 后端返回 `{ created, skipped, errors }` 统计字段，直接使用比 `references.filter()` 更简洁可靠。

4. **推荐引擎缓存策略**: 开始时一次 `getRelations({})` 获取所有关系，构建 `Map<from_id, Set<to_id>>`，后续过滤在内存中完成。权衡：首次查询可能返回大量数据，但推荐引擎本身限制 50 个实体，实际关系数可控。

5. **max_nesting_depth 用 `null`**: 消费方需兼容 `null`。当前消费方仅 `quality-dashboard.js` 和日志，影响范围小。

6. **rollbackAtoms 返回值不破坏兼容性**: 返回 `{ total, rolledBack, failed }` 但调用方不检查返回值也完全正常（不 throw）。

## Risks / Trade-offs

- **Risk: 消费方兼容 `null` 的 max_nesting_depth**: 需确认所有消费方不假设值为数字。低风险。
- **Risk: 推荐引擎首次 getRelations 可能返回大量数据**: 对于 1000+ 关系的项目，单次查询可能较慢。可加 limit 参数缓解。
- **Trade-off: 常量集中降低了文件独立性**: `constants.js` 变成更多文件的依赖。但收益大于成本。
