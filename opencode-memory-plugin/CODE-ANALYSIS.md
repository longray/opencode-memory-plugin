# Code Analysis Feature

**版本**: v3.0.0 (v1.4 实施中)
**最后更新**: 2026-04-07

---

## 功能介绍

代码分析功能会自动分析你保存的代码文件，提取函数、类、接口等结构信息，并保存到记忆系统中。

**核心特性**:

- ✅ **自动触发** — 文件保存后自动分析（300ms防抖，可配置）**[JS/TS 完整支持，多语言待完善]**
- ✅ **AST 分析** — 使用 Oxc 解析器进行精确的语法树分析（JS/TS）
- ✅ **多语言支持** — Tree-sitter 解析器支持 Python/Go/Rust/Java（基础功能）
- ✅ **深度指标** — 圈复杂度、嵌套深度、函数数量 **[JS/TS 完整，多语言有 Bug]**
- ✅ **JSDoc 提取** — 自动提取函数文档注释 **[JS/TS only]**
- ✅ **批量上传** — 智能批量处理，减少网络请求
- ✅ **隐私保护** — 自动检测并跳过敏感文件（.env、配置文件等）
- ✅ **项目级分析** — 生成项目健康度报告（A/B/C/D评级）
- ✅ **调用关系提取** — 提取函数调用关系，支持跨文件追踪（6种语言）
- ✅ **文件级质量评分** — 代码质量评分和改进建议 **[JS/TS only]**
- 🔄 **调用关系后端对接** — 后端 API 开发中（2026-04-11 联调）
- 🔄 **Tree-sitter 路径增强** — 多语言高级功能完善中

---

## 支持语言

| 语言           | 扩展名                        | 分析器      | 分析内容                              | 状态        |
| -------------- | ----------------------------- | ----------- | ------------------------------------- | ----------- |
| **JavaScript** | `.js`, `.mjs`, `.cjs`         | Oxc         | 函数、类、导入、导出、JSDoc、质量评分 | ✅ 完整支持 |
| **TypeScript** | `.ts`, `.mts`, `.cts`, `.tsx` | Oxc         | 函数、类、接口、类型、JSDoc、质量评分 | ✅ 完整支持 |
| **Python**     | `.py`                         | Tree-sitter | 函数、类、导入、调用关系              | ⚠️ 基础支持 |
| **Go**         | `.go`                         | Tree-sitter | 函数、类、导入、调用关系              | ⚠️ 基础支持 |
| **Rust**       | `.rs`                         | Tree-sitter | 函数、类、导入、调用关系              | ⚠️ 基础支持 |
| **Java**       | `.java`                       | Tree-sitter | 函数、类、导入、调用关系              | ⚠️ 基础支持 |

### 功能对比

| 功能         | JS/TS (Oxc) | Python | Go  | Rust | Java |
| ------------ | ----------- | ------ | --- | ---- | ---- |
| 函数提取     | ✅          | ✅     | ✅  | ✅   | ✅   |
| 类提取       | ✅          | ✅     | ✅  | ✅   | ✅   |
| 接口提取     | ✅          | ✅     | ✅  | ✅   | ✅   |
| 导入提取     | ✅          | ✅     | ✅  | ✅   | ✅   |
| 导出提取     | ✅          | ❌     | ❌  | ❌   | ❌   |
| 调用关系提取 | ✅          | ✅     | ✅  | ✅   | ✅   |
| 圈复杂度计算 | ✅          | ⚠️     | ⚠️  | ⚠️   | ⚠️   |
| 质量评分     | ✅          | ❌     | ❌  | ❌   | ❌   |
| JSDoc 提取   | ✅          | N/A    | N/A | N/A  | N/A  |
| 自动触发分析 | ✅          | ❌     | ❌  | ❌   | ❌   |

**图例**:

- ✅ 完整支持
- ⚠️ 支持但有已知问题
- ❌ 不支持
- N/A 不适用

### 已知限制

**Tree-sitter 路径（Python/Go/Rust/Java）**:

1. **圈复杂度计算偏高** - `binary_expression` 错误包含在决策类型中，导致普通运算也会增加复杂度
2. **不显示质量评分** - 未实现 `quality_score` 计算
3. **不支持自动触发** - 文件监听器仅监听 JS/TS 文件
4. **导出提取缺失** - `exports` 字段为空数组
5. **依赖未分类** - `dependencies` 为扁平数组，未分类为 internal/external/builtin

> **说明**: Oxc 解析器提供完整功能支持。Tree-sitter 多语言解析器提供基础功能，部分高级功能待完善。

---

## 工作原理

### 自动触发流程

```
文件保存
    ↓
文件系统监听（chokidar）
    ↓
300ms 防抖处理
    ↓
隐私过滤器检查（跳过敏感文件）
    ↓
解析器选择（Oxc/Tree-sitter/Fallback）
    ↓
AST 分析（提取函数、类、接口等）
    ↓
批量队列（最多 10 个文件或 2 秒后上传）
    ↓
保存到后端记忆服务
```

**降级策略**:

- **JS/TS** → Oxc 解析器（高性能）✅ 当前可用
- **其他/失败** → Fallback（基础信息）✅ 当前可用

> **内部实验**: Tree-sitter WASM 解析器（Python/Go/Rust/Java）已内部实现，待后端 API 就绪后发布。

**性能优化**:

- **300ms 防抖** — 快速连续保存时只触发一次分析
- **批量上传** — 最多 10 个文件或等待 2 秒后统一上传
- **并发控制** — 最多 2 个文件同时分析
- **隐私过滤** — 自动跳过 `.env`、`node_modules`、`.git` 等目录

---

## v1.4 新特性

### 调用关系追踪

自动提取函数调用关系，支持跨文件引用查询。

**功能**:

- 提取函数调用链 (CallSymbol)
- 查询谁调用了某个函数 (references)
- 查询某个函数调用了谁 (dependencies)

**状态**: 🔄 开发中 (后端 Phase 2)

### 增强的代码指标

**新增字段**:

- `return_type`: 函数返回类型
- `is_exported`: 是否导出
- `is_async`: 是否异步
- `properties`: 类属性
- `interfaces`: 接口定义

**状态**: ⚠️ 部分完成 (Oxc 路径 ✅, Tree-sitter 路径 🔄)

### 代码地图

项目级代码可视化，包含文件树、模块依赖、热点文件。

**API**: `GET /api/v1/projects/{id}/map`

**状态**: 🔄 规划中 (后端 Phase 3)

---

## 后端支持状态

| 功能         | 后端 API                               | 状态       |
| ------------ | -------------------------------------- | ---------- |
| 代码存储     | POST /api/v1/memories                  | ✅ 已支持  |
| 调用关系存储 | POST /api/v1/calls/batch               | 🔄 Phase 2 |
| 引用查询     | GET /api/v1/memories/{id}/references   | 🔄 Phase 2 |
| 依赖查询     | GET /api/v1/memories/{id}/dependencies | 🔄 Phase 2 |
| 代码地图     | GET /api/v1/projects/{id}/map          | 🔄 Phase 3 |
| 项目统计     | GET /api/v1/projects/{id}/stats        | 🔄 Phase 3 |

---

## CLI 使用指南

### 分析单个文件

```bash
# 分析 JavaScript 文件
node cli/code-analyzer.cjs src/utils.js

# 分析 TypeScript 文件
node cli/code-analyzer.cjs src/index.ts
```

### 输出格式

```bash
# JSON 格式（默认）
node cli/code-analyzer.cjs src/utils.js

# 表格格式（人类可读）
node cli/code-analyzer.cjs src/utils.js --format table

# 树形格式
node cli/code-analyzer.cjs src/utils.js --format tree
```

### 保存到记忆系统

```bash
# 分析并保存结果
node cli/code-analyzer.cjs src/utils.js --save

# 表格格式 + 保存
node cli/code-analyzer.cjs src/utils.js --format table --save
```

### 项目级分析

```bash
# 分析整个项目
node cli/code-analyzer.cjs --project .

# 输出项目健康度报告
```

### 指定语言

```bash
# 强制指定语言（用于无扩展名文件）
node cli/code-analyzer.cjs --language python script.txt
```

### 输出到文件

```bash
# 保存结果到 JSON 文件
node cli/code-analyzer.cjs src/utils.js --output result.json

# 保存表格格式到文件
node cli/code-analyzer.cjs src/utils.js --format table --output report.txt
```

---

## 配置项

代码分析功能默认启用，无需配置。如需自定义，编辑 `~/.opencode/memory/memory-config.json`：

### 启用/禁用

```json
{
  "code_analysis": {
    "enabled": true
  }
}
```

**说明**:

- `enabled`: 是否启用代码分析（默认 `true`）
- 设置为 `false` 可完全禁用自动分析

### 排除目录

```json
{
  "code_analysis": {
    "exclude_patterns": ["node_modules", ".git", "dist", "build", "coverage", ".min.js"]
  }
}
```

**说明**:

- `exclude_patterns`: 要排除的目录和文件模式（默认包含常用目录）
- 支持 glob 模式匹配

### 批量设置

```json
{
  "code_analysis": {
    "batch_max_size": 10,
    "batch_delay_ms": 2000,
    "debounce_ms": 300
  }
}
```

**说明**:

- `batch_max_size`: 批量上传的最大文件数（默认 `10`）
- `batch_delay_ms`: 批量上传前的等待时间（默认 `2000` 毫秒）
- `debounce_ms`: 文件保存后的防抖时间（默认 `300` 毫秒）

### 完整配置示例

```json
{
  "version": "3.0",
  "code_analysis": {
    "enabled": true,
    "exclude_patterns": ["node_modules", ".git", "dist", "build", "coverage"],
    "batch_max_size": 10,
    "batch_delay_ms": 2000,
    "debounce_ms": 300
  }
}
```

---

## 使用场景

### 1. 代码审查

**场景**: 团队成员保存代码后，自动分析并保存结构信息。

**效果**:

```
✅ JavaScript 文件：src/utils/helper.js (5 个函数，2 个类)
   - 函数：formatDate, parseJSON, validateEmail, debounce, throttle
   - 类：EventEmitter, Logger
   - 复杂度：中等（15 行代码）
```

### 2. 项目理解

**场景**: 新加入项目时，通过记忆系统快速了解代码结构。

**操作**:

```bash
# 搜索特定函数的使用
memory_search query="用户认证函数"

# 浏览项目的代码记忆
memory_timeline days=7 level=1
```

### 3. 知识管理

**场景**: 将常用代码模式保存到记忆，便于后续复用。

**效果**:

```
✅ TypeScript 接口：src/types/user.ts
   - 接口：User, UserProfile, UserRole
   - 导出：User (默认), UserProfile, UserRole
   - 复杂度：简单（8 行代码）
```

### 4. 代码导航

**场景**: 快速定位特定文件或函数。

**操作**:

```bash
# 搜索包含特定函数的文件
memory_search query="useEffect 自定义 hook"

# 查看某个模块的所有导出
memory_search query="src/utils 导出"
```

### 5. 项目健康度检查

**场景**: 了解项目整体代码质量，识别技术债务。

**操作**:

```bash
# 分析整个项目
node cli/code-analyzer.cjs --project .
```

**输出示例**:

```
┌────────────────────────────────────────────────────────────┐
│                 Project Health Report                      │
│ Project: @longray/my-project                               │
├────────────────────────────────────────────────────────────┤
│ Overall Grade: 🟡 B (良好)                                  │
├────────────────────────────────────────────────────────────┤
│ Statistics:                                                │
│  • Total Files: 150                                        │
│  • Total Functions: 450                                    │
│  • Total Classes: 30                                       │
│  • Average Complexity: 5.2                                 │
│  • Language Distribution:                                  │
│    - JavaScript: 60%                                       │
│    - TypeScript: 40%                                       │
├────────────────────────────────────────────────────────────┤
│ 🔴 High Risk Files (Complexity > 10):                     │
│  1. src/utils/dataProcessor.js (complexity: 25)            │
│  2. src/services/api.ts (complexity: 18)                   │
│  3. src/components/DataTable.tsx (complexity: 15)          │
└────────────────────────────────────────────────────────────┘
```

**健康度评级**:

- **A (优秀)**: 平均复杂度 < 5，无高风险文件
- **B (良好)**: 平均复杂度 < 8，高风险文件 < 5
- **C (一般)**: 平均复杂度 < 12，高风险文件 < 10
- **D (需改进)**: 其他情况

---

## 示例输出

### 分析结果示例

**输入文件** (`src/utils/helper.js`):

```javascript
export function formatDate(date) {
  return new Date(date).toLocaleDateString();
}

export function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

export class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(data));
    }
  }
}
```

**分析结果**:

```json
{
  "file_path": "src/utils/helper.js",
  "language": "javascript",
  "analyzer": "oxc",
  "functions": [
    {
      "name": "formatDate",
      "start": 0,
      "end": 3,
      "jsdoc": {
        "description": "Format a date to string",
        "params": [{ "type": "Date", "name": "date" }],
        "returns": { "type": "string" }
      }
    }
  ],
  "classes": [{ "name": "EventEmitter" }],
  "exports": [
    { "name": "formatDate", "type": "function" },
    { "name": "EventEmitter", "type": "class" }
  ],
  "complexity_metrics": {
    "lines_of_code": 31,
    "functions": 4,
    "classes": 1,
    "cyclomatic": 3,
    "max_function_complexity": 5,
    "average_function_complexity": 2.5,
    "max_nesting_depth": 2,
    "average_nesting_depth": 1.2
  }
}
```

### 复杂度指标说明

| 指标                          | 说明             | 健康阈值            |
| ----------------------------- | ---------------- | ------------------- |
| `cyclomatic`                  | 平均圈复杂度     | < 5 优秀，< 10 良好 |
| `max_function_complexity`     | 最高函数圈复杂度 | < 10 安全           |
| `average_function_complexity` | 平均函数圈复杂度 | < 5 优秀            |
| `max_nesting_depth`           | 最大嵌套深度     | < 3 安全            |
| `average_nesting_depth`       | 平均嵌套深度     | < 2 优秀            |
| `lines_of_code`               | 代码行数         | -                   |
| `function_count`              | 函数数量         | -                   |
| `class_count`                 | 类数量           | -                   |

### JSDoc 提取

Oxc 解析器会自动提取函数、类、接口的 JSDoc 注释：

**支持的标签**:

- `@description` — 描述文本（无标签部分）
- `@param {type} name - description` — 参数类型和说明
- `@returns {type} - description` — 返回值类型和说明

**示例**:

```javascript
/**
 * Calculate sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}
```

**提取结果**:

```json
{
  "jsdoc": {
    "description": "Calculate sum of two numbers",
    "params": [
      { "type": "number", "name": "a", "description": "First number" },
      { "type": "number", "name": "b", "description": "Second number" }
    ],
    "returns": { "type": "number", "description": "Sum of a and b" }
  }
}
```

**保存到记忆**:

```
Abstract: javascript file: src/utils/helper.js (4 functions, 1 classes)

Overview:
File: src/utils/helper.js
Lines: 31
Functions: formatDate, parseJSON, on, emit
Classes: EventEmitter
Complexity: 3

Content: [完整代码内容]
```

---

## v1.4 路线图（规划中）

v1.4 在 v3.0.0 基础上补齐设计文档承诺的数据字段，增强 Tree-sitter 多语言路径。

### 新增特性预览

**调用关系提取（CallSymbol）**:

分析函数之间的调用关系，支持跨文件引用追踪。

```json
{
  "calls": [
    { "target": "validateUser", "line": 42, "column": 8 },
    { "target": "hashPassword", "line": 15, "column": 12 }
  ]
}
```

**文件级质量评分**:

基于圈复杂度、嵌套深度、函数长度计算单个文件的质量评分。

```
┌────────────────────────────────────────────────────────────┐
│  Code Analysis: auth.ts                                    │
├────────────────────────────────────────────────────────────┤
│  Quality Score: 72/100  ⚠️ Needs Improvement              │
│  Complexity: 12 (High)  Nesting: 4 (High)                │
└────────────────────────────────────────────────────────────┘
```

**Tree-sitter 路径增强**:

当前 Tree-sitter 多语言解析器使用简化的启发式算法，v1.4 将对齐为 AST 级别的精确计算。

| 特性       | v3.0.0（当前）   | v1.4（目标）                             |
| ---------- | ---------------- | ---------------------------------------- |
| 圈复杂度   | 函数名启发式估算 | AST 级别精确计算                         |
| 函数元数据 | name, line, type | + return_type, is_exported, is_async     |
| 类成员     | methods          | + properties                             |
| 接口提取   | ❌ 缺失          | Go interface, Rust trait, Java interface |
| 依赖分类   | 扁平数组         | internal/external/builtin 分类           |
| 调用关系   | ❌ 缺失          | CallSymbol 数组                          |

### 任务列表

详见 [`BACKLOG.md`](../../BACKLOG.md) 场景十/十一（BL-CA-11~32）。

| 任务     | 优先级 | 状态        |
| -------- | ------ | ----------- |
| BL-CA-11 | P0     | ⚠️ 部分完成 |
| BL-CA-12 | P1     | ⏳ 待执行   |
| BL-CA-13 | P1     | ⚠️ 部分完成 |
| BL-CA-14 | P1     | ⏳ 待执行   |
| BL-CA-15 | P0     | ⚠️ 部分完成 |
| BL-CA-16 | P1     | ⚠️ 部分完成 |
| BL-CA-17 | P0     | ⚠️ 部分完成 |
| BL-CA-18 | P1     | ✅ 已完成   |
| BL-CA-19 | P1     | ⚠️ 待开发   |
| BL-CA-27 | P0     | ⏳ 待执行   |
| BL-CA-28 | P0     | ⏳ 待执行   |
| BL-CA-29 | P0     | ⏳ 待执行   |
| BL-CA-30 | P1     | ⏳ 待执行   |
| BL-CA-31 | P1     | ⏳ 待执行   |
| BL-CA-32 | P2     | ⏳ 待执行   |

---

## 常见问题

### Q: 代码分析会影响性能吗？

**A**: 不会。代码分析在后台异步执行，不会阻塞文件保存。300ms 防抖和批量上传机制确保性能优化。

### Q: 如何禁用代码分析？

**A**: 在配置文件中设置 `"enabled": false`：

```json
{
  "code_analysis": {
    "enabled": false
  }
}
```

### Q: 支持私有项目吗？

**A**: 支持。代码分析结果保存到本地记忆系统，不会上传到公共服务器。后端服务运行在本地（localhost:17999）。

### Q: 如何查看已分析的代码？

**A**: 使用 `memory_search` 或 `memory_timeline` 命令：

```bash
# 搜索代码记忆
memory_search query="JavaScript 代码"

# 浏览最近的代码分析
memory_timeline days=7 level=1
```

---

## 调用关系分析

### 功能说明

代码分析 v1.4 支持函数调用关系追踪，帮助理解代码依赖结构：

- **调用关系提取**: 自动识别函数调用（支持 JS/TS/Python/Go/Rust/Java）
- **入站调用查询**: 查看谁调用了某个函数（References）
- **出站调用查询**: 查看某个函数调用了谁（Dependencies）
- **项目代码地图**: 可视化项目结构和模块依赖

### 使用方式

调用关系分析在代码保存时自动进行：

1. 保存代码文件
2. 自动分析代码结构
3. 提取函数调用关系
4. 上传到后端建立关系图谱
5. 通过 CLI 或 API 查询调用关系

### 查询调用关系

```bash
# 查看谁调用了某个函数
node cli/index.cjs code-references --file src/utils.ts --line 42

# 查看某个函数调用了谁
node cli/index.cjs code-dependencies --file src/utils.ts --line 42

# 查看项目代码地图
node cli/index.cjs code-map

# 查看项目统计
node cli/index.cjs code-stats
```

### 技术实现

调用关系追踪采用**三层映射机制**以确保稳定性与性能：

1. **用户层 (file_path)**: 使用相对路径作为唯一标识，直观且易于操作。
2. **逻辑层 (source_id)**: 为每个文件生成唯一的 ULID，不随文件重命名而变化。
3. **存储层 (memory_id)**: 使用后端生成的唯一 ID，作为数据库主键。

**映射流程**: `file_path` ──────▶ `source_id` ──────▶ `memory_id`

**缓存机制**:

- 插件在本地维护 `~/.opencode/cache/memory-id-cache.json`。
- 每次上传代码后自动更新映射。
- 支持从本地 entry 文件或后端 Lookup API 自动重建缓存。

**注意**: 调用关系功能需要后端支持，确保后端服务已启动。

---

## 技术细节

**实现细节请参考开发文档**:

- [`CODE_ANALYSIS_DEVELOPMENT.md`](./CODE_ANALYSIS_DEVELOPMENT.md) — 开发者指南
- [`MEMORY-ID-HYBRID-DESIGN.md`](../../docs/MEMORY-ID-HYBRID-DESIGN.md) — 混合关联方案设计
- [`lib/code-analyzer.js`](./lib/code-analyzer.js) — Oxc AST 分析
- [`lib/code-analysis-service.js`](./lib/code-analysis-service.js) — 批量队列管理
- [`lib/memory-id-cache.js`](./lib/memory-id-cache.js) — Memory ID 缓存管理
- [`lib/privacy-filter.js`](./lib/privacy-filter.js) — 隐私过滤

---

_最后更新：2026-04-09_
