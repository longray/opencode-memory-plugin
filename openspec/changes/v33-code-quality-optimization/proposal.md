## Why

v3.3 代码审查（Metis + Explore）发现 7 个代码质量问题：常量重复定义、API 响应解析不一致、方法缺少返回值、推荐引擎 N+1 调用等。这些问题不影响功能正确性，但会增加维护成本、降低代码可读性，并在大型项目中造成性能瓶颈。

## What Changes

- **统一 batch API 响应解析**: `code-analysis-service.js` 和 `relation-recommender.js` 中 `createReferences` 响应解析统一使用 `result.created`（而非 `result.references.filter()`）
- **rollbackAtoms 返回结果对象**: 返回 `{ total, rolledBack, failed }` 让调用方可感知回滚状态
- **detectLanguage 去重**: 删除 `code-analysis-service.js` 中的重复 `detectLanguage` 方法，统一使用 `CodeAnalyzer.detectLanguage`
- **扩展名常量集中**: `SUPPORTED_EXTENSIONS` 和 `EXTENSION_TO_LANGUAGE` 统一到 `constants.js` 导出，消除三处重复定义
- **builtin modules 提取**: 150 行内联 builtin modules Set 提取为 `lib/builtin-modules.js`
- **推荐引擎缓存优化**: `recommendRelationsBySimilarity` 改为开始时一次获取所有关系，在内存中过滤，消除 N+1 API 调用
- **fallback max_nesting_depth 语义**: `null` 替代 `0`，区分"未分析"和"无嵌套"

## Capabilities

### New Capabilities

- `centralized-language-config`: 集中管理语言扩展名映射和 builtin modules 常量
- `batch-api-consistency`: 统一 batch API 响应解析和错误处理模式

### Modified Capabilities

- `relation-recommender`: 推荐引擎改为批量获取关系缓存，消除 N+1 API 调用

## Impact

- **代码文件**: `lib/constants.js`, `lib/code-analysis-service.js`, `lib/code-analyzer.js`, `lib/relation-recommender.js`, `lib/builtin-modules.js`（新建）
- **测试文件**: 需更新受影响模块的测试用例
- **API 兼容性**: 无 breaking change（rollbackAtoms 新增返回值，调用方无需改动即可兼容）
- **性能影响**: 推荐引擎从 O(n) 次 HTTP 调用降为 O(1) + O(n) 内存过滤
