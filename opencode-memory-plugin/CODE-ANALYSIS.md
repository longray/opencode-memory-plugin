# Code Analysis Feature

**版本**: v2.9.0  
**最后更新**: 2026-04-02

---

## 功能介绍

代码分析功能会自动分析你保存的代码文件，提取函数、类、接口等结构信息，并保存到记忆系统中。

**核心特性**:

- ⚠️ **自动触发** — 文件保存后自动分析（开发中，当前需手动触发）
- ✅ **AST 分析** — 使用 Oxc 解析器进行精确的语法树分析（JS/TS）
- ✅ **批量上传** — 智能批量处理，减少网络请求
- ✅ **隐私保护** — 自动检测并跳过敏感文件（.env、配置文件等）
- ⚠️ **多语言支持** — JavaScript, TypeScript（已支持）, Python, Go, Rust, Java（开发中）

---

## 支持语言

| 语言           | 扩展名                        | 分析内容                         | 状态      |
| -------------- | ----------------------------- | -------------------------------- | --------- |
| **JavaScript** | `.js`, `.mjs`, `.cjs`         | 函数、类、导入、导出             | ✅ 已支持 |
| **TypeScript** | `.ts`, `.mts`, `.cts`, `.tsx` | 函数、类、接口、类型、导入、导出 | ✅ 已支持 |
| **Python**     | `.py`                         | 基础信息（行数等）               | ⚠️ 开发中 |
| **Go**         | `.go`                         | 基础信息（行数等）               | ⚠️ 开发中 |
| **Rust**       | `.rs`                         | 基础信息（行数等）               | ⚠️ 开发中 |
| **Java**       | `.java`                       | 基础信息（行数等）               | ⚠️ 开发中 |

> **说明**: Python/Go/Rust/Java 当前仅提取基础信息（行数、文件大小等），完整 AST 分析开发中。

---

## 工作原理

### 当前实现（手动触发）

```
CLI 命令或 API 调用
    ↓
隐私过滤器检查（跳过敏感文件）
    ↓
Oxc AST 分析（提取函数、类、接口等）
    ↓
批量队列（最多 10 个文件或 2 秒后上传）
    ↓
保存到后端记忆服务
```

### 计划实现（自动触发）

```
文件保存
    ↓
OpenCode 触发 file.saved 事件（开发中）
    ↓
插件监听器捕获事件（300ms 防抖）
    ↓
隐私过滤器检查（跳过敏感文件）
    ↓
Oxc AST 分析（提取函数、类、接口等）
    ↓
批量队列（最多 10 个文件或 2 秒后上传）
    ↓
保存到后端记忆服务
```

> **注意**: 自动触发功能开发中，当前版本请使用 CLI 手动触发。

**性能优化**:

- **300ms 防抖** — 快速连续保存时只触发一次分析
- **批量上传** — 最多 10 个文件或等待 2 秒后统一上传
- **并发控制** — 最多 2 个文件同时分析
- **隐私过滤** — 自动跳过 `.env`、`node_modules`、`.git` 等目录

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
    { "name": "formatDate", "start": 0, "end": 3 },
    { "name": "parseJSON", "start": 4, "end": 12 },
    { "name": "on", "start": 18, "end": 24 },
    { "name": "emit", "start": 25, "end": 31 }
  ],
  "classes": [{ "name": "EventEmitter" }],
  "exports": [
    { "name": "formatDate", "type": "function" },
    { "name": "parseJSON", "type": "function" },
    { "name": "EventEmitter", "type": "class" }
  ],
  "complexity_metrics": {
    "lines_of_code": 31,
    "functions": 4,
    "classes": 1,
    "cyclomatic": 3
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

## 技术细节

**实现细节请参考开发文档**:

- [`lib/code-analyzer.js`](./lib/code-analyzer.js) — Oxc AST 分析
- [`lib/code-analysis-service.js`](./lib/code-analysis-service.js) — 批量队列管理
- [`lib/privacy-filter.js`](./lib/privacy-filter.js) — 隐私过滤

---

_最后更新：2026-04-02_
