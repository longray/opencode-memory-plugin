# Tasks: v3.3 Code Quality Optimization

## Phase 1: 常量集中 (centralized-language-config)

### 1.1 [P0] 在 constants.js 中新增 EXTENSION_TO_LANGUAGE 和 SUPPORTED_EXTENSIONS

- **文件**: `lib/constants.js`
- **操作**:
  - 新增 `EXTENSION_TO_LANGUAGE` 对象（扩展名 → 语言名）
  - 新增 `SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_LANGUAGE)` 导出
- **验证**: import 无报错

### 1.2 [P0] code-analysis-service.js 改用集中常量

- **文件**: `lib/code-analysis-service.js`
- **操作**:
  - 删除模块级 `SUPPORTED_EXTENSIONS` 数组（第 58-70 行）
  - 从 `constants.js` import `SUPPORTED_EXTENSIONS`
  - 删除 `detectLanguage()` 方法（第 870-886 行）
  - 改用 `CodeAnalyzer.detectLanguage(filePath)`（需 import CodeAnalyzer）
  - uploadProject 中的 `const SUPPORTED = new Set(SUPPORTED_EXTENSIONS)` 保持不变
- **验证**: 现有测试通过

### 1.3 [P0] code-analyzer.js 改用集中常量

- **文件**: `lib/code-analyzer.js`
- **操作**:
  - 删除模块级 `EXTENSION_TO_LANGUAGE` 对象（第 63-75 行）
  - 从 `constants.js` import `EXTENSION_TO_LANGUAGE`
  - `detectLanguage` 静态方法继续使用 `EXTENSION_TO_LANGUAGE`
- **验证**: 现有测试通过

### 1.4 [P0] 新建 lib/builtin-modules.js

- **文件**: `lib/builtin-modules.js`（新建）
- **操作**:
  - 从 `code-analysis-service.js` 的 `createDependsOnRelations` 中提取 builtin modules Set
  - 导出 `BUILTIN_MODULES`（模块级常量，加载时创建一次）
  - 包含 Node.js / Python / Go / Rust / Java 内置模块
- **验证**: import 无报错

### 1.5 [P0] code-analysis-service.js 使用集中 builtin modules

- **文件**: `lib/code-analysis-service.js`
- **操作**:
  - `createDependsOnRelations` 中删除内联 `builtinModules` Set 定义
  - 从 `lib/builtin-modules.js` import `BUILTIN_MODULES`
- **验证**: 现有测试通过

### 1.6 [P1] fallback max_nesting_depth 改为 null

- **文件**: `lib/code-analyzer.js`
- **操作**:
  - fallback 结果中 `max_nesting_depth: 0` → `max_nesting_depth: null`
  - `average_nesting_depth: 0` → `average_nesting_depth: null`
  - 检查消费方（quality-dashboard.js 等）是否兼容 null
- **验证**: 现有测试通过

## Phase 2: Batch API 一致性 (batch-api-consistency)

### 2.1 [P0] 统一 createReferences 响应解析

- **文件**: `lib/code-analysis-service.js`
- **操作**:
  - 所有 `createReferences` 调用统一改为 `refCount += result?.created || 0`
  - 删除 `result?.references?.filter(r => r.status === 'created').length || 0` 写法
  - 确认 catch 块中没有 `refCount += chunk.length`（已在上一轮修复）
- **验证**: 搜索确认无 `references?.filter` 残留

### 2.2 [P0] rollbackAtoms 返回结果对象

- **文件**: `lib/code-analysis-service.js`
- **操作**:
  - `rollbackAtoms` 方法末尾添加 `return { total: atoms.length, rolledBack, failed: atoms.length - rolledBack }`
  - 调用方（第 624 行）不改动（向后兼容）
- **验证**: 现有测试通过

## Phase 3: 推荐引擎优化 (relation-recommender)

### 3.1 [P0] 批量获取关系缓存

- **文件**: `lib/relation-recommender.js`
- **操作**:
  - `recommendRelationsBySimilarity` 开始时调用 `client.getRelations({})` 获取所有关系
  - 构建 `Map<string, Set<string>>`（from_id → Set of to_id）
  - 循环中用内存 Map 过滤替代逐个 `client.getRelations({ memory_id })` 调用
  - 保留 try/catch fallback（缓存获取失败时回退到逐个查询）
- **验证**: 现有测试通过

## Phase 4: 测试验证

### 4.1 [P0] 全量测试

- 运行 `npm test`，确认 975/975 通过
- 检查无新增 lint 错误

### 4.2 [P1] 更新相关测试用例

- 如果 `detectLanguage` 移动导致 mock 路径变化，更新测试
- 如果 `max_nesting_depth` 改为 null，更新断言值的测试
