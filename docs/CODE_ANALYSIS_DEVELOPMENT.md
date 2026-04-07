# Code Analysis Development Guide

> **目标**: 帮助开发者理解代码分析功能的架构和开发流程  
> **读者**: 贡献者、维护者  
> **前置知识**: JavaScript/Node.js, AST 基础  
> **版本**: v3.0.0 + v1.4 路线图

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

## 8. v1.4 数据模型与增强计划

> **设计文档**: `embedding_service/docs/CODE-ANALYSIS-DESIGN-v1.4.md`

### 8.1 完整数据结构（v1.4 目标）

```typescript
interface CodeAnalysisResult {
  // 基础信息
  language: string; // 标准化语言名
  analyzer: string; // "oxc" | "tree-sitter" | "fallback"
  analyzed_at: string; // ISO 8601
  analyzer_version: string;

  // 符号信息
  functions: FunctionSymbol[]; // ✅ v3.0 已实现（Oxc），⚠️ Tree-sitter 待增强
  classes: ClassSymbol[]; // ✅ v3.0 已实现（Oxc），⚠️ Tree-sitter 待增强
  interfaces: InterfaceSymbol[]; // ✅ v3.0 已实现（Oxc），❌ Tree-sitter 缺失
  imports: ImportSymbol[]; // ✅ v3.0 已实现，⚠️ Tree-sitter 结构待增强
  exports: ExportSymbol[]; // ✅ v3.0 已实现（Oxc），❌ Tree-sitter 缺失

  // 复杂度指标
  complexity_metrics: ComplexityMetrics;

  // 依赖信息
  dependencies: DependencyInfo;

  // 调用关系（v1.4 新增）
  calls?: CallSymbol[]; // ❌ 待实现

  // 错误与警告
  errors?: ParseError[];
  warnings?: ParseWarning[];
}
```

### 8.2 FunctionSymbol（v1.4 完整字段）

```typescript
interface FunctionSymbol {
  name: string;
  start_line: number;
  end_line: number;
  params: Array<{ name: string; type?: string }>;
  return_type?: string; // ✅ Oxc 已有，❌ Tree-sitter 缺失
  is_exported: boolean; // ✅ Oxc 已有，❌ Tree-sitter 缺失
  is_async: boolean; // ✅ Oxc 已有，❌ Tree-sitter 缺失
}
```

**实现状态**:

| 字段        | Oxc 路径  | Tree-sitter 路径 | 任务     |
| ----------- | --------- | ---------------- | -------- |
| name        | ✅        | ✅               | —        |
| start/end   | ✅        | ✅ (line only)   | BL-CA-11 |
| params      | ✅ 含类型 | ⚠️ 无类型        | BL-CA-11 |
| return_type | ✅        | ❌               | BL-CA-11 |
| is_exported | ✅        | ❌               | BL-CA-11 |
| is_async    | ✅        | ❌               | BL-CA-11 |

### 8.3 CallSymbol（v1.4 新增）

```typescript
interface CallSymbol {
  target: string; // 被调用函数名
  line: number; // 调用所在行
  column?: number; // 调用所在列
}
```

**提取策略**:

- **Oxc 路径**: 遍历 `CallExpression` AST 节点，提取 `callee.name`
- **Tree-sitter 路径**: 遍历 `call_expression` 节点，提取 `function` 子节点
- **过滤规则**: 跳过内置调用（`console.log`、`require`、`super` 等）
- **任务**: BL-CA-12

**实现位置**: `lib/code-analyzer.js` 新增 `_extractCalls(ast)` 方法

### 8.4 ClassSymbol（v1.4 完整字段）

```typescript
interface ClassSymbol {
  name: string;
  start_line: number;
  end_line: number;
  methods: string[]; // ✅ Oxc 已有，⚠️ Tree-sitter 部分有
  properties: string[]; // ✅ Oxc 已有，❌ Tree-sitter 缺失
}
```

**实现状态**:

| 字段       | Oxc 路径 | Tree-sitter Python | Tree-sitter Go | Tree-sitter Rust | Tree-sitter Java |
| ---------- | -------- | ------------------ | -------------- | ---------------- | ---------------- |
| name       | ✅       | ✅                 | ✅             | ✅               | ✅               |
| methods    | ✅       | ✅                 | ❌             | ✅ (impl)        | ✅               |
| properties | ✅       | ❌                 | ❌             | ❌               | ❌               |

**任务**: BL-CA-13

### 8.5 InterfaceSymbol（v1.4 新增实现）

```typescript
interface InterfaceSymbol {
  name: string;
  start_line: number;
  end_line: number;
  methods: string[];
  properties: string[];
}
```

**语言映射**:

| 语言  | 概念           | Tree-sitter 节点类型        |
| ----- | -------------- | --------------------------- |
| Go    | interface      | `interface_type`            |
| Rust  | trait          | `trait_item`                |
| Java  | interface      | `interface_declaration`     |
| JS/TS | interface (TS) | `TSInterfaceDeclaration` ✅ |

**任务**: BL-CA-13

### 8.6 圈复杂度计算（v1.4 增强）

**当前差距**:

| 路径        | 算法                                | 准确度 |
| ----------- | ----------------------------------- | ------ |
| Oxc         | AST 遍历 if/for/while/catch/&&/\|\| | ✅ 高  |
| Tree-sitter | 函数名启发式（handle→3）            | ❌ 低  |

**v1.4 目标**: Tree-sitter 路径改为 AST 级别计算。

**算法**: 遍历 Tree-sitter AST，计数分支节点：

```text
基础复杂度 = 1
+1: if, elif, else, for, while, repeat, until, except, catch
+1: and (&&), or (||)
+1: case (switch/case, match)
```

**实现位置**: `lib/tree-sitter-parser.js` 新增 `calculateCyclomaticFromAST(node)`

**任务**: BL-CA-15

### 8.7 代码质量评分（v1.4 新增）

**评分维度**:

| 维度              | 权重 | 计算                                | 满分 |
| ----------------- | ---- | ----------------------------------- | ---- |
| 圈复杂度          | 30%  | `max(0, 100 - avg_complexity * 10)` | 30   |
| 嵌套深度          | 20%  | `max(0, 100 - max_depth * 25)`      | 20   |
| 函数长度          | 20%  | `avg(100 - func_length_penalty)`    | 20   |
| 函数数量/文件长度 | 15%  | 基于函数密度评分                    | 15   |
| 注释覆盖          | 15%  | `comment_lines / total_lines`       | 15   |

**评级映射**:

```text
90-100: A (优秀)
70-89:  B (良好)
50-69:  C (一般)
0-49:   D (需改进)
```

**实现位置**: `lib/code-analyzer.js` 新增 `calculateQualityScore(result)` 方法

**任务**: BL-CA-16

### 8.8 DependencyInfo 分类（v1.4 增强）

```typescript
interface DependencyInfo {
  internal: string[]; // 相对路径导入
  external: string[]; // npm/pip/cargo 第三方包
  builtin: string[]; // 语言内置模块
}
```

**分类规则**:

| 语言   | builtin 判断                                   | external 判断                   |
| ------ | ---------------------------------------------- | ------------------------------- |
| JS/TS  | `node:*` 前缀或内置模块名（fs, path, http...） | 非相对路径且非 builtin          |
| Python | 标准库模块名（os, sys, json...）               | 非相对路径且非 builtin          |
| Go     | 标准库（fmt, net, io...）                      | 非相对路径且非 builtin          |
| Rust   | 核心库（std, core, alloc...）                  | 外部 crate（非 std/core/alloc） |
| Java   | `java.*` / `javax.*` 包名                      | 第三方包                        |

**当前状态**: Oxc 路径已实现分类 ✅，Tree-sitter 路径为扁平数组 ❌

**任务**: BL-CA-14

---

## 9. 扩展开发

### 9.1 添加新语言支持

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

### 9.2 添加新输出格式

1. 在 `code-analysis-formatter.js` 中添加格式化函数:

```javascript
export function formatAs<Format>(result) {
  // 实现格式化逻辑
  return formattedString;
}
```

1. 在 CLI 中添加选项支持

---

## 10. 相关文档

- **[产品文档](../opencode-memory-plugin/CODE-ANALYSIS.md)** - 用户指南
- **[快速入门](../opencode-memory-plugin/QUICK_START_CODE_ANALYSIS.md)** - 5分钟上手
- **[API 文档](./API-CONTRACT.md)** - 后端 API 契约
- **[v1.4 设计文档](../../embedding_service/docs/CODE-ANALYSIS-DESIGN-v1.4.md)** - 完整设计方案

---

_最后更新：2026-04-07_
