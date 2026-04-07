# Code Analysis — Developer Documentation

**版本**: v3.0.0  
**最后更新**: 2026-04-07

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Code Analysis System                      │
├─────────────────────────────────────────────────────────────┤
│  File Watcher → Analysis Queue → AST Parser → Formatter    │
│       ↓              ↓              ↓            ↓         │
│   chokidar    Batch/Debounce   Oxc/Tree-sitter  JSON/Table │
│       ↓              ↓              ↓            ↓         │
│   Privacy Filter   Concurrent    Complexity    Memory      │
│   (sensitive)      Control       Metrics       Storage     │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. lib/code-analyzer.js

**职责**: Oxc AST 分析、复杂度计算、JSDoc 提取

**关键类**:

- `CodeAnalyzer` — 主分析器

**关键方法**:

- `analyze(filePath, sourceCode)` — 分析单个文件
- `analyzeWithOxc(filePath, sourceCode, language)` — Oxc 解析
- `calculateComplexity(functions, classes, sourceCode, ast)` — 复杂度计算
- `extractJSDoc(nodeStart, comments)` — JSDoc 提取
- `parseJSDoc(commentValue)` — JSDoc 解析

**复杂度算法**:

- 圈复杂度: 决策点数量 + 1
- 嵌套深度: 递归遍历 AST 计算最大嵌套层级

### 2. lib/code-analysis-service.js

**职责**: 批量队列管理、并发控制、记忆集成

**关键类**:

- `AnalysisQueue` — 分析队列管理

**关键常量**:

- `DEBOUNCE_MS` — 防抖时间 (300ms)
- `BATCH_MAX_SIZE` — 批量大小 (10)
- `MAX_CONCURRENT` — 并发限制 (2)

### 3. lib/file-watcher.js

**职责**: 文件系统监听

**关键类**:

- `FileWatcher` — chokidar 封装

**功能**:

- 监听文件变更 (change, add)
- 300ms 防抖
- 隐私过滤集成

### 4. lib/code-analysis-formatter.js

**职责**: 输出格式化

**支持格式**:

- JSON — 机器可读
- Table — 表格形式
- Tree — 树形结构

### 5. lib/project-analyzer.js

**职责**: 项目级分析

**关键类**:

- `ProjectAnalyzer` — 项目分析器

**健康度评级**:

- A (优秀): 平均复杂度 < 5，无高风险文件
- B (良好): 平均复杂度 < 8，高风险文件 < 5
- C (一般): 平均复杂度 < 12，高风险文件 < 10
- D (需改进): 其他情况

### 6. lib/code-fingerprint.js

**职责**: 变更检测

**关键类**:

- `CodeFingerprint` — 指纹管理

**指纹组成**:

- content_hash — SHA256 内容哈希
- symbols_hash — 符号哈希（函数/类名）

### 7. lib/privacy-filter.js

**职责**: 敏感文件检测

**功能**:

- 路径模式匹配（.env, .git, node_modules）
- 内容敏感信息检测（password, api_key, token）

---

## Complexity Metrics

### 圈复杂度计算

**算法**: 遍历 AST，统计决策点

**决策点类型**:

- `IfStatement` — if 语句
- `ConditionalExpression` — 三元运算符
- `SwitchCase` — case 语句
- `ForStatement` / `ForInStatement` / `ForOfStatement` — for 循环
- `WhileStatement` / `DoWhileStatement` — while 循环
- `CatchClause` — catch 子句
- `LogicalExpression` (&& / ||) — 逻辑表达式

**公式**: `complexity = 1 + decision_points`

### 嵌套深度计算

**算法**: 递归遍历 AST，跟踪嵌套层级

**嵌套结构**:

- IfStatement, ForStatement, WhileStatement
- SwitchStatement, TryStatement, CatchClause
- FunctionDeclaration, FunctionExpression, ArrowFunctionExpression
- ClassDeclaration

**公式**: `max_depth = max(nesting_level)`

---

## JSDoc Extraction

### 提取流程

1. Oxc 解析时获取 comments 数组
2. 根据函数位置 (node.start) 查找前置注释
3. 筛选 Block 类型且以 `*` 开头的注释
4. 解析注释内容提取标签

### 支持标签

| 标签     | 格式                        | 提取字段                |
| -------- | --------------------------- | ----------------------- |
| @param   | `{type} name - description` | type, name, description |
| @returns | `{type} - description`      | type, description       |
| @return  | `{type} - description`      | type, description       |
| 无标签   | 描述文本                    | description             |

### 示例

```javascript
/**
 * Calculate sum
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) { ... }
```

**提取结果**:

```json
{
  "description": "Calculate sum",
  "params": [
    { "type": "number", "name": "a", "description": "First number" },
    { "type": "number", "name": "b", "description": "Second number" }
  ],
  "returns": { "type": "number", "description": "Sum of a and b" }
}
```

---

## Configuration

### memory-config.json

```json
{
  "code_analysis": {
    "enabled": true,
    "debounce_ms": 300,
    "batch_max_size": 10,
    "batch_delay_ms": 2000,
    "max_concurrent": 2,
    "large_file_threshold": 5000,
    "skip_file_threshold": 10000
  }
}
```

### 配置项说明

| 配置项               | 默认值 | 说明                 |
| -------------------- | ------ | -------------------- |
| enabled              | true   | 是否启用代码分析     |
| debounce_ms          | 300    | 防抖时间（毫秒）     |
| batch_max_size       | 10     | 每批最大文件数       |
| batch_delay_ms       | 2000   | 批量延迟（毫秒）     |
| max_concurrent       | 2      | 最大并发分析数       |
| large_file_threshold | 5000   | 大文件警告阈值（行） |
| skip_file_threshold  | 10000  | 跳过文件阈值（行）   |

---

## Testing

### 测试文件位置

```
tests/
├── code-analyzer.test.js
├── code-analysis-service.test.js
├── file-watcher.test.js
└── project-analyzer.test.js
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- code-analyzer.test.js

# 带覆盖率
npm run test:coverage
```

### 测试覆盖要求

- 单元测试: 核心函数覆盖率 > 80%
- 集成测试: CLI 端到端场景
- 性能测试: 大文件分析 < 500ms

---

## Extending Language Support

### Tree-sitter 解析器结构

**文件**: `lib/tree-sitter-parser.js`

**支持语言**:

- Python (tree-sitter-python)
- Go (tree-sitter-go)
- Rust (tree-sitter-rust)
- Java (tree-sitter-java)

**状态**: 内部实验，待后端 API 就绪后发布

### 添加新语言步骤

1. 安装 grammar 包: `npm install tree-sitter-<lang>`
2. 在 `loadLanguage()` 添加 case
3. 实现 `extract<Lang>Symbols()` 函数
4. 添加测试用例
5. 更新文档

---

## CLI Usage

### 分析单个文件

```bash
node cli/code-analyzer.cjs src/utils.js
node cli/code-analyzer.cjs src/utils.js --format table
node cli/code-analyzer.cjs src/utils.js --save
```

### 分析整个项目

```bash
node cli/code-analyzer.cjs --project .
```

### 选项说明

| 选项             | 说明              |
| ---------------- | ----------------- |
| `--format json`  | JSON 输出（默认） |
| `--format table` | 表格输出          |
| `--format tree`  | 树形输出          |
| `--save`         | 保存到记忆系统    |
| `--project`      | 项目级分析        |

---

## Troubleshooting

### 常见问题

**Q: 分析失败，提示 "Oxc parse error"**
A: 检查文件语法是否正确，Oxc 对语法要求严格

**Q: JSDoc 未提取**
A: 确保注释是 Block 类型（/\*\* \*/），且紧邻函数

**Q: 复杂度计算不准确**
A: 复杂度基于 AST 决策点，某些模式可能未覆盖

### 调试

```bash
# 启用调试日志
DEBUG=code-analysis node cli/code-analyzer.cjs file.js
```

---

## 8. v1.4 Data Structures

### 8.1 FunctionSymbol (Extended)

Complete field definition:

| Field       | Type    | Description            | Status                 |
| ----------- | ------- | ---------------------- | ---------------------- |
| name        | string  | Function name          | ✅ Implemented         |
| start_line  | number  | Start line             | ✅ Implemented         |
| end_line    | number  | End line               | ✅ Implemented         |
| params      | array   | Parameters with types  | ✅ Implemented         |
| return_type | string  | Return type annotation | ✅ Oxc, ⚠️ Tree-sitter |
| is_exported | boolean | Whether exported       | ✅ Oxc, ⚠️ Tree-sitter |
| is_async    | boolean | Whether async function | ✅ Oxc, ⚠️ Tree-sitter |

### 8.2 CallSymbol (New)

Function call relationship:

```typescript
interface CallSymbol {
  target: string; // Called function name
  line: number; // Call location line
  column?: number; // Call location column
  file_path?: string; // Source file (for cross-file calls)
}
```

### 8.3 ClassSymbol (Extended)

| Field      | Type   | Description          | Status                 |
| ---------- | ------ | -------------------- | ---------------------- |
| name       | string | Class name           | ✅ Implemented         |
| methods    | array  | Method definitions   | ✅ Implemented         |
| properties | array  | Property definitions | ✅ Oxc, ⚠️ Tree-sitter |

### 8.4 InterfaceSymbol (New)

```typescript
interface InterfaceSymbol {
  name: string;
  methods: FunctionSymbol[];
  properties: PropertySymbol[];
}
```

### 8.5 DependencyInfo (Enhanced)

Categorized dependencies:

```typescript
interface DependencyInfo {
  internal: string[]; // Relative imports (./, ../)
  external: string[]; // npm/pip/cargo packages
  builtin: string[]; // Built-in modules (node:fs, os, sys)
}
```

### 8.6 Complexity Metrics

**Cyclomatic Complexity Algorithm**:

- Formula: `complexity = 1 + decision_points`
- Decision points: if, for, while, switch, catch, &&, ||, ?:

**Nesting Depth Algorithm**:

- Formula: `max_depth = max(nesting_level)`
- Tracks nested blocks recursively

### 8.7 Quality Scoring

**File-level scoring** (planned):

- Based on: cyclomatic complexity, nesting depth, function length
- Output: 0-100 score with grade (A/B/C/D)

**Project-level grading** (implemented):

- A: avg_complexity < 5, no high-risk files
- B: avg_complexity < 8, high-risk files < 5
- C: avg_complexity < 12, high-risk files < 10
- D: other

---

## References

- [CODE-ANALYSIS.md](./CODE-ANALYSIS.md) — 用户文档
- [QUICK_START_CODE_ANALYSIS.md](./QUICK_START_CODE_ANALYSIS.md) — 快速入门
- [Oxc Parser](https://github.com/oxc-project/oxc) — AST 解析器
- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) — 多语言解析

---

_最后更新：2026-04-07_
