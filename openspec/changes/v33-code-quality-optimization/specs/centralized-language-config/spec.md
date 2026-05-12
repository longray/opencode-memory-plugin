# centralized-language-config

## Summary

集中管理语言扩展名映射和 builtin modules 常量，消除 3 处重复定义。

## Requirements

### REQ-1: EXTENSION_TO_LANGUAGE 常量

- `constants.js` 导出 `EXTENSION_TO_LANGUAGE` 对象（扩展名 → 语言名映射）
- 包含 `.js/.mjs/.cjs → javascript`, `.ts/.mts/.cts/.tsx → typescript`, `.py → python`, `.go → go`, `.rs → rust`, `.java → java`
- `constants.js` 导出 `SUPPORTED_EXTENSIONS` 数组（从 `EXTENSION_TO_LANGUAGE` 的 keys 派生）
- `code-analysis-service.js` 删除模块级 `SUPPORTED_EXTENSIONS` 数组，改为从 `constants.js` import
- `code-analysis-service.js` 删除 `detectLanguage()` 方法，改为使用 `CodeAnalyzer.detectLanguage()`
- `code-analyzer.js` 删除模块级 `EXTENSION_TO_LANGUAGE`，改为从 `constants.js` import

### REQ-2: builtin modules 提取

- 新建 `lib/builtin-modules.js`，导出 `BUILTIN_MODULES` Set
- 包含 Node.js、Python、Go、Rust、Java 的内置模块名
- `code-analysis-service.js` 的 `createDependsOnRelations` 改为从 `builtin-modules.js` import
- Set 为模块级常量（只创建一次）

### REQ-3: fallback max_nesting_depth

- `code-analyzer.js` 的 fallback 结果中 `max_nesting_depth` 和 `average_nesting_depth` 改为 `null`
- 消费方需兼容 `null` 值

### Acceptance Criteria

- 新增语言只需修改 `constants.js` 一处
- `builtin-modules.js` 导出的 Set 在模块加载时创建一次
- 所有 975 个测试通过
