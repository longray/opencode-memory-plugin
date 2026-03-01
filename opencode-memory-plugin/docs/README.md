# 📚 OpenCode Memory Plugin 代码质量标准

> **版本**: 1.0.0  
> **状态**: 实施中  
> **最后更新**: 2026-03-01  
> **项目**: @csuwl/opencode-memory-plugin

---

## 📋 概述

本文档定义了 OpenCode Memory Plugin 项目的**代码质量检查标准**，旨在：

1. **规范项目开发** - 为团队提供统一的开发规范
2. **保证代码质量** - 通过自动化工具确保代码符合最佳实践
3. **提高可维护性** - 统一的代码风格和结构
4. **防止安全问题** - 自动检测密钥泄露和安全漏洞

### 🌐 技术栈

- **语言**: JavaScript (ES Modules)
- **运行时**: Node.js 16+
- **包管理器**: npm
- **模块系统**: ES Modules (type: "module")

---

## 🗂️ 文档结构

| 章节 | 文件 | 说明 |
|------|------|------|
| 1. 总则与原则 | `01-GLOBAL-PRINCIPLES.md` | 适用范围、核心原则、规范层级 |
| 2. 代码格式化规范 | `02-FORMATTING-STANDARDS.md` | JavaScript/Node.js 格式化规则 |
| 3. 代码检查规范 | `03-LINTING-STANDARDS.md` | ESLint 配置、错误检测 |
| 4. 类型检查规范 | `04-TYPE-CHECKING-STANDARDS.md` | TypeScript 类型检查配置 |
| 5. 安全扫描规范 | `05-SECURITY-SCANNING.md` | 密钥检测、代码安全 |
| 6. 测试规范 | `06-TESTING-STANDARDS.md` | 测试框架、覆盖率要求 |
| 7. Pre-commit 规范 | `07-PRECOMMIT-STANDARDS.md` | Git hooks 配置 |
| 8. CI/CD 集成规范 | `08-CICD-INTEGRATION-STANDARDS.md` | Pipeline 结构 |
| 9. 依赖管理规范 | `09-DEPENDENCY-STANDARDS.md` | 版本选择、漏洞检查 |
| 10. 开发流程规范 | `10-DEVELOPMENT-WORKFLOW.md` | 提交规范、分支策略 |
| 11. 工具链配置 | `11-TOOLCHAIN-CONFIG.md` | 完整配置文件模板 |
| 12. 实施计划 | `12-IMPLEMENTATION-PLAN.md` | 分阶段实施计划 |

---

## 🚀 快速开始

### 步骤 1: 安装依赖

```bash
cd opencode-memory-plugin
npm install
```

### 步骤 2: 安装 Pre-commit Hooks

```bash
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

### 步骤 3: 运行代码检查

```bash
# 检查所有文件
npm run lint

# 自动修复问题
npm run lint:fix

# 格式化代码
npm run format

# 类型检查
npm run type-check
```

---

## 📊 规范层级

```
┌─────────────────────────────────────────────┐
│  Level 1: 总则与原则                          │
│  - 适用范围、核心原则、团队文化               │
└─────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────┐
│  Level 2: 技术规范                            │
│  - 格式化、检查、类型检查、测试              │
│  - 安全扫描、依赖管理、CI/CD                 │
└─────────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────────┐
│  Level 3: 实施指南                            │
│  - Pre-commit、CI/CD、开发流程               │
│  - 工具链配置、最佳实践                      │
└─────────────────────────────────────────────┘
```

### 规范优先级

| 优先级 | 类别 | 说明 | 违规后果 |
|--------|------|------|----------|
| **P0** | 安全扫描 | 必须通过，阻止提交 | 密钥泄露、安全漏洞 |
| **P1** | 类型检查 | 必须通过，阻止提交 | 类型错误、未定义变量 |
| **P2** | 代码格式化 | 自动修复，可豁免 | 格式不一致 |
| **P3** | 代码检查 | 警告级别，建议修复 | 代码异味、复杂度 |
| **P4** | 测试覆盖 | 阶段性目标 | 覆盖率不足 |
| **P5** | 文档规范 | 辅助性要求 | 注释不完整 |

---

## 🎯 核心价值

### 1. 统一性
✅ **统一的代码风格** - 所有开发者遵循相同规范  
✅ **一致的工具配置** - 避免因个人偏好导致的混乱  
✅ **标准化的检查流程** - 从开发到部署的全程质量保证

### 2. 自动化
✅ **自动化检查** - 减少人工审查的工作量  
✅ **即时反馈** - 开发者提交前就能发现问题  
✅ **持续监控** - CI/CD 管道自动执行所有检查

### 3. 可维护性
✅ **清晰的规则定义** - 新成员快速上手  
✅ **可扩展的架构** - 新项目快速复制配置  
✅ **版本化的规范** - 规则演进可追溯

### 4. 安全性
✅ **密钥泄露防护** - 自动检测敏感信息  
✅ **代码安全扫描** - 发现潜在漏洞  
✅ **依赖漏洞检查** - 自动更新有漏洞的依赖

---

## 📞 相关资源

### 外部参考
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript) - JavaScript 最佳实践
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html) - Google JS 规范
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices) - Node.js 最佳实践

---

## 📄 文档信息

- **文件名**: `README.md`
- **版本**: 1.0.0
- **许可证**: MIT

---

## 🔗 快速链接

- [总则与原则](./01-GLOBAL-PRINCIPLES.md)
- [代码格式化规范](./02-FORMATTING-STANDARDS.md)
- [代码检查规范](./03-LINTING-STANDARDS.md)
- [Pre-commit 规范](./07-PRECOMMIT-STANDARDS.md)
- [工具链配置](./11-TOOLCHAIN-CONFIG.md)
- [实施计划](./12-IMPLEMENTATION-PLAN.md)
