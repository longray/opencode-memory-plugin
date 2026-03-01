# 9. 开发流程规范

> **适用范围**: OpenCode Memory Plugin 项目
> **依赖章节**: [1. 总则与原则](./01-GLOBAL-PPRINCIPLES.md)

---

## 📖 9.1 通用原则

### 9.1.1 开发流程目标

- **质量保证** - 每个提交都经过检查
- **效率提升** - 自动化减少人工审查
- **一致性** - 统一的开发流程

### 9.1.2 流程概览

```
开发 → 本地检查 → 提交 → Pre-commit → Push → CI/CD → 合并
```

---

## 🔄 9.2 提交前检查流程

### 9.2.1 本地开发检查

```bash
# 1. 编写代码
# 编辑代码文件...

# 2. 运行 ESLint 检查
npm run lint

# 3. 运行 Prettier 格式化
npm run format

# 4. 运行测试（如果有）
npm test
```

### 9.2.2 Pre-commit 自动检查

```bash
# 5. 添加文件到暂存区
git add .

# 6. 提交代码（自动触发 pre-commit hooks）
git commit -m "feat: 新增功能"

# Pre-commit 会自动运行：
# - Gitleaks (密钥检测)
# - ESLint (代码检查)
# - Prettier (代码格式化)
```

### 9.2.3 Push 前检查

```bash
# 7. 推送到远程（可选触发 pre-push hooks）
git push origin main

# Pre-push 可能会运行：
# - npm audit (依赖安全检查)
# - 完整的测试套件
```

---

## 📝 9.3 提交信息规范

### 9.3.1 提交信息格式

```
<type>: <subject>

<body>

<footer>
```

### 9.3.2 Type 类型

| 类型         | 说明      | 示例                     |
| ------------ | --------- | ------------------------ |
| **feat**     | 新功能    | `feat: 添加向量搜索功能` |
| **fix**      | 修复 Bug  | `fix: 修复内存泄漏`      |
| **docs**     | 文档更新  | `docs: 更新 README`      |
| **style**    | 代码格式  | `style: 格式化代码`      |
| **refactor** | 重构      | `refactor: 优化搜索算法` |
| **test**     | 测试相关  | `test: 添加单元测试`     |
| **chore**    | 构建/工具 | `chore: 更新依赖`        |

### 9.3.3 提交信息示例

```bash
# 功能提交
git commit -m "feat: 添加 BM25 诊断功能

- 新增 searchWithDiagnostics 方法
- 支持分数分布分析
- 添加处理时间统计"

# 修复提交
git commit -m "fix: 修复 RRF 融合分数计算错误

修复 k 参数未正确传递的问题"

# 文档提交
git commit -m "docs: 添加代码质量文档

- 添加全局原则文档
- 添加工具链配置模板"
```

---

## 🌿 9.4 分支策略

### 9.4.1 分支命名

| 分支类型     | 命名格式         | 示例                    |
| ------------ | ---------------- | ----------------------- |
| **主分支**   | `main`           | `main`                  |
| **功能分支** | `feature/<描述>` | `feature/hybrid-search` |
| **修复分支** | `fix/<描述>`     | `fix/memory-leak`       |
| **文档分支** | `docs/<描述>`    | `docs/api-reference`    |

### 9.4.2 分支工作流程

```bash
# 1. 从 main 创建功能分支
git checkout -b feature/new-feature

# 2. 开发并提交
git add .
git commit -m "feat: 实现新功能"

# 3. 推送到远程
git push origin feature/new-feature

# 4. 创建 Pull Request（GitHub/GitLab）

# 5. Code Review 后合并到 main
```

---

## ✅ 9.5 检查清单

- [ ] 提交前运行 `npm run lint` 无错误
- [ ] 提交前运行 `npm run format` 已格式化
- [ ] 提交信息符合规范（type: subject）
- [ ] Pre-commit hooks 全部通过
- [ ] 无敏感信息泄露（Gitleaks 通过）
- [ ] 代码审查通过（团队项目）
