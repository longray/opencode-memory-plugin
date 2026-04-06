# Code Analysis Development Guide

> **目标**: 帮助开发者理解代码分析功能的架构和开发流程  
> **读者**: 贡献者、维护者  
> **前置知识**: JavaScript/Node.js, AST 基础

---

## 1. 架构概述

### 1.1 模块关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  code-analyzer.cjs                                          │
│  - parseArgs()        - analyzeFile()                       │
│  - analyzeProject()   - formatOutput()                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Analyzer Layer                           │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │  CodeAnalyzer   │  │ ProjectAnalyzer  │                  │
│  │  - analyze()    │  │  - analyzeProject│                  │
│  │  - analyzeWith  │  │  - calculateGrade│                  │
│  │    Strategy()   │  │  - identifyRisks │                  │
│  └────────┬────────┘  └──────────────────┘                  │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │  Oxc Parser     │  │ TreeSitterParser │                  │
│  │  (JS/TS)        │  │ (Python/Go/      │                  │
│  │                 │  │  Rust/Java)      │                  │
│  └─────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                            │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │ FileWatcher     │  │ AnalysisQueue    │                  │
│  │ - watch()       │  │ - add()          │                  │
│  │ - debounce()    │  │ - flush()        │                  │
│  └─────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心模块职责

| 模块                 | 文件                             | 职责                                   |
| -------------------- | -------------------------------- | -------------------------------------- |
| **CodeAnalyzer**     | `lib/code-analyzer.js`           | 单文件分析，解析器选择，AST 遍历       |
| **ProjectAnalyzer**  | `lib/project-analyzer.js`        | 项目级分析，健康度评级，风险识别       |
| **TreeSitterParser** | `lib/tree-sitter-parser.js`      | 多语言 AST 解析（Python/Go/Rust/Java） |
| **FileWatcher**      | `lib/file-watcher.js`            | 文件系统监听，自动触发                 |
| **AnalysisQueue**    | `lib/code-analysis-service.js`   | 批量队列，防抖处理                     |
| **Formatter**        | `lib/code-analysis-formatter.js` | 输出格式化（table/tree/json）          |

---

## 2. 开发环境搭建

### 2.1 克隆仓库

```bash
git clone https://github.com/longray/opencode-memory-plugin.git
cd opencode-memory-plugin/opencode-memory-plugin
```

### 2.2 安装依赖

```bash
npm install
```

### 2.3 验证安装

```bash
# 运行测试
npm test

# 验证 CLI
node cli/code-analyzer.cjs --help
```

---

## 3. 测试运行指南

### 3.1 运行所有测试

```bash
npm test
```

### 3.2 运行特定测试

```bash
# 仅运行核心测试
npm test -- --testPathPattern="test-core"

# 仅运行集成测试
npm test -- --testPathPattern="phase-a-integration"

# 运行代码分析相关测试
npm test -- --testPathPattern="code-analyzer"
```

### 3.3 测试覆盖率

```bash
npm run test:coverage
```

### 3.4 监视模式

```bash
npm run test:watch
```

---

## 4. 核心模块详解

### 4.1 CodeAnalyzer

**职责**: 单文件代码分析，解析器选择和 AST 遍历

**关键方法**:

```javascript
// 分析文件
async analyze(filePath, content)

// 选择解析策略
async analyzeWithStrategy(filePath, sourceCode, language, warnings)

// Oxc 解析（JS/TS）
analyzeWithOxc(filePath, sourceCode, language)

// Tree-sitter 解析（多语言）
analyzeWithTreeSitter(filePath, sourceCode, language)
```

**降级策略**:

```
JS/TS → Oxc (高性能)
  ↓ 失败/超时
Python/Go/Rust/Java → Tree-sitter WASM
  ↓ 失败
Fallback (基础信息)
```

### 4.2 ProjectAnalyzer

**职责**: 项目级分析，健康度评级，风险识别

**关键方法**:

```javascript
// 分析整个项目
async analyzeProject(files)

// 计算项目级指标
calculateMetrics(results)

// 识别风险文件
identifyRisks(results)

// 计算健康度评级 (A/B/C/D)
calculateGrade(metrics)
```

**健康度评级标准**:

| 评级 | 条件                             | 说明   |
| ---- | -------------------------------- | ------ |
| A    | 平均复杂度 < 5，无高风险文件     | 优秀   |
| B    | 平均复杂度 < 8，高风险文件 < 5   | 良好   |
| C    | 平均复杂度 < 12，高风险文件 < 10 | 一般   |
| D    | 其他情况                         | 需改进 |

### 4.3 TreeSitterParser

**职责**: 多语言 AST 解析

**支持语言**:

- Python: `tree-sitter-python`
- Go: `tree-sitter-go`
- Rust: `tree-sitter-rust`
- Java: `tree-sitter-java`

**使用示例**:

```javascript
import { analyzeWithTreeSitter } from "./lib/tree-sitter-parser.js";

const result = await analyzeWithTreeSitter(
  "script.py",
  'def hello():\n    print("Hello")',
  "python",
);

console.log(result.functions); // [{ name: 'hello', line: 1 }]
```

---

## 5. 贡献流程

### 5.1 开发流程

1. **Fork 仓库** → 创建特性分支
2. **编写代码** → 遵循现有代码风格
3. **添加测试** → 确保测试覆盖
4. **运行测试** → `npm test` 全部通过
5. **提交 PR** → 描述变更和动机

### 5.2 代码规范

**Lint 检查**:

```bash
# 检查代码规范
npm run lint

# 自动修复
npm run lint:fix

# 检查 Markdown
npm run lint:md
```

**Pre-commit 钩子**:

- Gitleaks（敏感信息检测）
- Oxlint（代码规范）
- Prettier（代码格式化）
- Markdownlint（文档规范）
- Jest Tests（测试运行）

### 5.3 PR 要求

- [ ] 所有测试通过
- [ ] 代码规范检查通过
- [ ] 文档已更新（如需要）
- [ ] CHANGELOG 已更新
- [ ] 提交信息清晰（遵循 conventional commits）

---

## 6. 调试技巧

### 6.1 调试 CLI

```bash
# 使用 Node.js 调试器
node --inspect-brk cli/code-analyzer.cjs test.js

# 打印详细日志
DEBUG=code-analysis node cli/code-analyzer.cjs test.js
```

### 6.2 调试测试

```bash
# 调试特定测试
node --inspect-brk node_modules/.bin/jest --testPathPattern="code-analyzer"
```

### 6.3 常见问题

**问题**: Tree-sitter WASM 加载失败

**解决**:

```bash
# 重新安装依赖
rm -rf node_modules
npm install

# 确认 WASM 文件存在
ls node_modules/web-tree-sitter/tree-sitter.wasm
```

**问题**: 测试超时

**解决**:

```bash
# 增加超时时间
npm test -- --testTimeout=30000
```

---

## 7. 扩展开发

### 7.1 添加新语言支持

1. 安装 Tree-sitter grammar:

```bash
npm install tree-sitter-<language> --save-dev
```

1. 在 `tree-sitter-parser.js` 中添加语言支持:

```javascript
case '<language>':
  langModule = await import('tree-sitter-<language>');
  break;
```

1. 实现符号提取函数:

```javascript
function extract<Language>Symbols(node, sourceCode, collectors) {
  // 实现 AST 遍历逻辑
}
```

1. 添加测试用例

### 7.2 添加新输出格式

1. 在 `code-analysis-formatter.js` 中添加格式化函数:

```javascript
export function formatAs<Format>(result) {
  // 实现格式化逻辑
  return formattedString;
}
```

1. 在 CLI 中添加选项支持

---

## 8. 相关文档

- **[产品文档](../opencode-memory-plugin/CODE-ANALYSIS.md)** - 用户指南
- **[快速入门](../opencode-memory-plugin/QUICK_START_CODE_ANALYSIS.md)** - 5分钟上手
- **[API 文档](../docs/API-CONTRACT.md)** - 后端 API 契约

---

_最后更新：2026-04-06_
