# batch-api-consistency

## Summary

统一 batch API 响应解析模式和 rollbackAtoms 返回值。

## Requirements

### REQ-1: 统一 createReferences 响应解析

- `code-analysis-service.js` 中所有 `createReferences` 调用统一使用 `result?.created || 0`
- 删除 `result?.references?.filter(r => r.status === 'created').length || 0` 写法
- catch 块中不累加 refCount（失败的 reference 不计入）

### REQ-2: rollbackAtoms 返回结果

- `rollbackAtoms` 方法返回 `{ total: number, rolledBack: number, failed: number }`
- 调用方不检查返回值时行为不变（向后兼容）
- 日志保留现有格式

### Acceptance Criteria

- 所有 `createReferences` 调用使用相同的响应解析模式
- `rollbackAtoms` 返回值类型为 `{ total, rolledBack, failed }`
- 所有 975 个测试通过
