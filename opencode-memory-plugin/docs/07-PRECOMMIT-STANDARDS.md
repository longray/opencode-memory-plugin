# 7. Pre-commit 规范

> **适用范围**: OpenCode Memory Plugin 项目
> **依赖章节**: [1. 总则与原则](./01-GLOBAL-PRINCIPLES.md)

---

## 📖 7.1 通用原则

### 7.1.1 Pre-commit 核心原则

| 原则 | 说明 | 实施方式 |
|------|------|----------|
| **自动化** | 所有检查自动执行, 无需手动触发 | `.git/hooks/pre-commit` 自动运行 |
| **快速反馈** | 开发者提交前立即看到检查结果 | 实时错误输出 |
| **可配置性** | 通过配置文件灵活定制 | `.pre-commit-config.yaml` |
| **跨平台** | 支持 Windows/Linux/macOS | 统一配置 |

### 7.1.2 Hook 时机

| 时机 | 触发条件 | 说明 |
|------|---------|------|
| **pre-commit** | `git commit` 前 | 所有文件提交前检查 |
| **pre-push** | `git push` 前 | 推送前检查（测试等耗时操作） |

**推荐**: pre-commit（代码质量）+ pre-push（测试）

### 7.1.3 Hook 执行顺序

```
1. Gitleaks (安全扫描) - P0
2. ESLint (代码检查) - P1
3. Prettier (格式化) - P2
```

---

## ⚙️ 7.2 Pre-commit 配置

### 7.2.1 完整配置示例

```yaml
# .pre-commit-config.yaml
default_stages: [pre-commit]
fail_fast: true  # 第一个失败就停止

exclude: '^node_modules/|^dist/|^build/|^\.git/'

repos:
  # ===========================================
  # 🔐 安全扫描 (P0 - 最高优先级)
  # ===========================================
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.21.2
    hooks:
      - id: gitleaks
        name: 🔐 Gitleaks - Secret Detection
        description: Detect hardcoded secrets using Gitleaks
        entry: gitleaks protect --verbose --redact --staged
        language: system
        pass_filenames: false
        stages: [pre-commit]

  # ===========================================
  # 📝 代码格式化 (P2)
  # ===========================================
  - repo: local
    hooks:
      - id: prettier
        name: 💅 Prettier - Code Formatting
        entry: npx prettier --write --ignore-unknown
        language: system
        files: '\.(js|mjs|cjs|ts|json|md|yaml|yml)$'
        stages: [pre-commit]

  # ===========================================
  # 🔍 代码检查 (P1)
  # ===========================================
  - repo: local
    hooks:
      - id: eslint
        name: 🔍 ESLint - Code Linting
        entry: npx eslint --fix
        language: system
        files: '\.(js|mjs|cjs)$'
        exclude: 'node_modules/'
        stages: [pre-commit]

  # ===========================================
  # 📦 依赖检查
  # ===========================================
  - repo: local
    hooks:
      - id: npm-audit
        name: 📦 npm audit - Dependency Check
        entry: npm audit --audit-level=high
        language: system
        pass_filenames: false
        stages: [pre-push]
```

### 7.2.2 配置说明

| 配置项 | 说明 | 本项目设置 |
|--------|------|------------|
| `fail_fast` | 第一个失败就停止 | `true` - 快速反馈 |
| `exclude` | 排除的文件路径 | `node_modules/`, `dist/`, `build/` |
| `default_stages` | 默认执行时机 | `[pre-commit]` |

### 7.2.3 Hook 详细配置

#### Gitleaks (安全扫描)

```yaml
- repo: https://github.com/gitleaks/gitleaks
  rev: v8.21.2
  hooks:
    - id: gitleaks
      name: 🔐 Secret Detection
      entry: gitleaks protect --verbose --redact --staged
      language: system
      pass_filenames: false
```

**功能**: 检测提交的代码中是否包含硬编码的密钥、密码等敏感信息

**失败处理**: 发现密钥时阻止提交，需要手动移除后才能提交

#### Prettier (代码格式化)

```yaml
- repo: local
  hooks:
    - id: prettier
      name: 💅 Code Formatting
      entry: npx prettier --write --ignore-unknown
      language: system
      files: '\.(js|mjs|cjs|ts|json|md|yaml|yml)$'
```

**功能**: 自动格式化代码

**失败处理**: 格式化失败时阻止提交

#### ESLint (代码检查)

```yaml
- repo: local
  hooks:
    - id: eslint
      name: 🔍 Code Linting
      entry: npx eslint --fix
      language: system
      files: '\.(js|mjs|cjs)$'
```

**功能**: 检查代码质量问题，自动修复可修复的问题

**失败处理**: 发现无法自动修复的错误时阻止提交

---

## 🚀 7.3 安装和初始化

### 7.3.1 安装 pre-commit

```bash
# 安装 pre-commit 工具
pip install pre-commit

# 或者使用 npm 安装 (推荐用于 Node.js 项目)
npm install --save-dev pre-commit
```

### 7.3.2 初始化 hooks

```bash
# 安装 git hooks
pre-commit install

# 验证安装
pre-commit --version
```

### 7.3.3 手动运行检查

```bash
# 运行所有 hooks
pre-commit run --all-files

# 运行特定 hook
pre-commit run eslint
pre-commit run prettier
pre-commit run gitleaks
```

---

## 🔧 7.4 故障排除

### 7.4.1 常见问题

#### Hook 安装失败

```bash
# 重新安装
pre-commit uninstall
pre-commit install

# 检查权限
git config core.hooksPath .git/hooks
```

#### Hook 执行慢

- 使用 `fail_fast: true` 快速失败
- 排除大文件和目录
- 只检查修改的文件（默认行为）

#### Windows 兼容性问题

- 使用 PowerShell 或 Git Bash
- 确保 Node.js 和 npm 在 PATH 中
- 使用 `npx` 运行本地工具

### 7.4.2 跳过 hooks

**⚠️ 不推荐跳过 hooks，仅在紧急情况下使用**

```bash
# 跳过 pre-commit hooks
git commit -m "紧急修复" --no-verify

# 跳过特定 hook
SKIP=eslint git commit -m "跳过 ESLint"
```

---

## 📊 7.5 性能优化

### 7.5.1 执行时间目标

| Hook | 目标时间 | 优化策略 |
|------|----------|----------|
| Gitleaks | < 1s | 只检查 staged 文件 |
| Prettier | < 2s | 并行处理 |
| ESLint | < 5s | 缓存结果 |
| 总计 | < 10s | fail_fast 模式 |

### 7.5.2 缓存配置

```yaml
# ESLint 缓存
default_language_version:
  node: system
```

---

## ✅ 7.6 检查清单

- [ ] `.pre-commit-config.yaml` 文件存在且配置正确
- [ ] `pre-commit install` 已成功执行
- [ ] Gitleaks hook 能检测测试密钥
- [ ] Prettier hook 能自动格式化代码
- [ ] ESLint hook 能检查代码问题
- [ ] 所有 hooks 能在 10s 内完成
- [ ] Windows/Linux/macOS 都能正常工作
