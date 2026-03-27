# Changelog

## [Unreleased]

### Changed

- **ESLint → Oxlint 迁移**：使用 Oxlint（Rust 构建，10-50x 更快）替代 ESLint，与 Prettier 天然兼容
- **测试文件重写**：将 Python 风格的 test-phase-c-performance.js 重写为 Jest 格式，修复 test-sync-methods.test.js 语法问题
- **Pre-commit Hook 更新**：ESLint hook 替换为 Oxlint hook

### Added

- **Oxlint 配置**：新增 `.oxlintrc.json`，配置 `caughtErrorsIgnorePattern: "^_"` 支持下划线前缀忽略
- **代码规范文档**：README.md 和 AGENTS.md 新增代码规范章节，说明 Oxlint + Prettier 使用方法
- **npm scripts**：新增 `lint`、`lint:fix`、`format`、`format:check` 命令

### Removed

- **ESLint 依赖**：移除 `@eslint/js`、`globals`、`eslint` 依赖
- **ESLint 配置**：删除 `.eslintrc.cjs` 和 `eslint.config.js`

### Fixed

- **修复 5 个 no-unused-vars 警告**：使用 `_` 前缀约定修复未使用变量
- **修复测试文件语法**：test-phase-c-performance.js 从 Python 转为 JavaScript，test-sync-methods.test.js 修复顶层 await

---

## Previous Versions

See git history for older changes.
