# relation-recommender

## Summary

优化推荐引擎，消除 N+1 API 调用模式。

## Requirements

### REQ-1: 批量获取关系缓存

- `recommendRelationsBySimilarity` 开始时一次调用 `client.getRelations({})` 获取所有关系
- 构建 `Map<string, Set<string>>`（from_id → Set of to_id）
- 循环中不再逐个调用 `client.getRelations({ memory_id: entity.id })`
- 保留 `try/catch` 错误处理，缓存获取失败时 fallback 到逐个查询

### Acceptance Criteria

- 50 个实体的推荐运行：HTTP 调用从 ~100 次降为 ~51 次（1 次获取关系 + 50 次搜索）
- 推荐结果与优化前一致（相同的实体对和权重）
- 所有 975 个测试通过
