# 10. 工具链配置模板

> **适用范围**: OpenCode Memory Plugin 项目
> **依赖章节**: [1. 总则与原则](./01-GLOBAL-PRINCIPLES.md)

---

## 📖 10.1 概述

本文档提供 OpenCode Memory Plugin 项目的完整工具链配置模板。

### 10.1.1 模板设计原则

| 原则 | 说明 |
|------|------|
| **完整性** | 包含所有必要的配置文件 |
| **即用性** | 复制即可使用，最小修改 |
| **文档化** | 每个配置都有清晰注释 |
| **最佳实践** | 基于行业最佳实践 |

---

## 🚀 10.2 快速开始

### 10.2.1 安装依赖

```bash
cd opencode-memory-plugin
npm install --save-dev eslint prettier husky lint-staged
npx husky install
```

### 10.2.2 初始化 Pre-commit

```bash
npx husky add .husky/pre-commit "npx lint-staged"
npx husky add .husky/commit-msg 'npx --no-install commitlint --edit "$1"'
```

### 10.2.3 验证配置

```bash
# 运行所有检查
npx pre-commit run --all-files

# 或手动运行
npx eslint .
npx prettier --check .
```

---

## ⚙️ 10.3 配置文件详解

### 10.3.1 ESLint 配置 (`.eslintrc.cjs`)

```javascript
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  rules: {
    // 错误预防
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-undef': 'error',
    'no-console': 'off', // 允许 console，但建议使用日志库
    
    // 最佳实践
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    
    // 代码风格
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'indent': ['error', 2],
    'max-len': ['warn', { code: 120, ignoreComments: true }],
    
    // Node.js 特定
    'no-path-concat': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '*.min.js',
  ],
};
```

### 10.3.2 Prettier 配置 (`.prettierrc`)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 100,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### 10.3.3 EditorConfig (`.editorconfig`)

```ini
# EditorConfig 配置文件
# 统一编辑器设置

root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2
```

### 10.3.4 Pre-commit 配置 (`.pre-commit-config.yaml`)

```yaml
# .pre-commit-config.yaml
# Pre-commit hooks 配置

default_stages: [pre-commit]
fail_fast: false

exclude: '^node_modules/|^dist/|^build/|^\.git/'

repos:
  # ===========================================
  # 🔐 安全扫描
  # ===========================================
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
        name: Gitleaks Secret Detection
        stages: [pre-commit]

  # ===========================================
  # 📝 通用文件检查
  # ===========================================
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
        name: Trim Trailing Whitespace
      - id: end-of-file-fixer
        name: Fix End of File
      - id: check-yaml
        name: Check YAML Syntax
      - id: check-json
        name: Check JSON Syntax
      - id: check-merge-conflict
        name: Check Merge Conflicts
      - id: detect-private-key
        name: Detect Private Keys
      - id: mixed-line-ending
        name: Fix Mixed Line Endings
        args: ['--fix=lf']

  # ===========================================
  # 📦 Node.js/JavaScript 检查
  # ===========================================
  - repo: local
    hooks:
      - id: eslint
        name: ESLint (JavaScript)
        entry: npx eslint
        language: system
        types: [javascript]
        pass_filenames: true
        args: ['--fix', '--max-warnings=0']
        require_serial: true

      - id: prettier
        name: Prettier (Format)
        entry: npx prettier
        language: system
        types: [javascript, json, yaml, markdown]
        pass_filenames: true
        args: ['--write']
        require_serial: true

      - id: npm-test
        name: NPM Test
        entry: npm test
        language: system
        pass_filenames: false
        stages: [pre-push]
        require_serial: true
```

### 10.3.5 Lint-staged 配置 (`package.json`)

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,yml,yaml,md}": [
      "prettier --write"
    ]
  }
}
```

### 10.3.6 Gitleaks 配置 (`.gitleaks.toml`)

```toml
# Gitleaks 配置
# 密钥泄露检测规则

title = "OpenCode Memory Plugin Gitleaks Config"

[extend]
# 使用默认规则
path = ""

# 允许的路径（不检查）
[allowlist]
paths = [
  '''node_modules''',
  '''dist''',
  '''build''',
  '''\.git''',
  '''test-results''',
  '''phase\d+-''',
]

# 允许的提交（用于测试数据）
commits = [
  "test-commit-hash",
]

# 允许的正则（测试用的假密钥）
regexes = [
  '''test-key-12345''',
  '''fake-secret-67890''',
]
```

### 10.3.7 Commitlint 配置 (`commitlint.config.js`)

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // 修复
        'docs',     // 文档
        'style',    // 格式
        'refactor', // 重构
        'perf',     // 性能
        'test',     // 测试
        'chore',    // 构建/工具
        'ci',       // CI/CD
        'revert',   // 回滚
      ],
    ],
    'subject-full-stop': [0, 'never'],
    'subject-case': [0, 'never'],
    'header-max-length': [2, 'always', 100],
  },
};
```

---

## 📋 10.4 配置文件检查清单

### 10.4.1 必需文件

| 文件 | 用途 | 优先级 |
|------|------|--------|
| `.eslintrc.cjs` | ESLint 代码检查 | P1 |
| `.prettierrc` | Prettier 格式化 | P2 |
| `.editorconfig` | 编辑器统一配置 | P2 |
| `.pre-commit-config.yaml` | Pre-commit hooks | P0 |
| `.gitleaks.toml` | 密钥检测 | P0 |
| `commitlint.config.js` | 提交规范 | P3 |

### 10.4.2 可选文件

| 文件 | 用途 | 优先级 |
|------|------|--------|
| `.eslintignore` | ESLint 忽略规则 | P3 |
| `.prettierignore` | Prettier 忽略规则 | P3 |
| `.husky/pre-commit` | Husky pre-commit hook | P2 |
| `.husky/commit-msg` | Husky commit-msg hook | P3 |

---

## 🎯 10.5 验证命令

```bash
# 验证 ESLint 配置
npx eslint --print-config .eslintrc.cjs

# 验证 Prettier 配置
npx prettier --check .

# 验证所有 hooks
pre-commit run --all-files

# 验证特定 hook
pre-commit run eslint --all-files
pre-commit run prettier --all-files
pre-commit run gitleaks --all-files
```

---

## 🔗 相关文档

- [1. 总则与原则](./01-GLOBAL-PRINCIPLES.md)
- [2. 代码格式化规范](./02-FORMATTING-STANDARDS.md)
- [3. 代码检查规范](./03-LINTING-STANDARDS.md)
- [7. Pre-commit 规范](./07-PRECOMMIT-STANDARDS.md)
