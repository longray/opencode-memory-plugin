# BL-40: 依赖关系审计报告

> **审计时间**: 2026-04-04  
> **审计人**: OpenCode Agent  
> **范围**: `opencode-memory-plugin/package.json`

---

## 执行摘要

| 指标                | 数值  |
| ------------------- | ----- |
| **总依赖数**        | 12 个 |
| **dependencies**    | 2 个  |
| **devDependencies** | 10 个 |
| **P0 问题**         | 1 个  |
| **P1 问题**         | 2 个  |
| **P2 问题**         | 2 个  |

---

## 详细审计结果

### 🔴 P0 问题（必须修复）

#### 问题 1: `oxc-parser` 在 devDependencies 中

| 项目         | 内容                                                                    |
| ------------ | ----------------------------------------------------------------------- |
| **问题描述** | `oxc-parser` 是运行时必需的解析器，但目前在 `devDependencies` 中        |
| **当前位置** | `devDependencies`                                                       |
| **应该位置** | `dependencies`                                                          |
| **影响**     | 发布后用户安装插件时，`oxc-parser` 不会被安装，导致代码分析功能无法运行 |
| **修复建议** | 将 `"oxc-parser": "^0.121.0"` 从 `devDependencies` 移到 `dependencies`  |
| **工作量**   | 2 分钟                                                                  |

**验证方式**:

```bash
# 修复前
npm ls oxc-parser --prod  # 应该显示 empty

# 修复后
npm ls oxc-parser --prod  # 应该显示 oxc-parser@0.121.0
```

---

### 🟡 P1 问题（建议修复）

#### 问题 2: Tree-sitter 相关依赖未使用

| 项目         | 内容                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------- |
| **问题描述** | `tree-sitter-javascript`、`tree-sitter-typescript`、`web-tree-sitter` 已声明但未在代码中使用      |
| **当前位置** | `devDependencies`                                                                                 |
| **涉及包**   | `tree-sitter-javascript@0.25.0`、`tree-sitter-typescript@0.23.2`、`web-tree-sitter@0.26.7`        |
| **影响**     | 增加安装体积和依赖冲突风险，用户困惑（文档说支持多语言但实际只有 JS/TS）                          |
| **修复建议** | 方案 A: 实现 Tree-sitter 降级策略（推荐，但工作量大）<br>方案 B: 暂时移除，等实现后再添加（快速） |
| **工作量**   | 方案 A: 1-2 周<br>方案 B: 2 分钟                                                                  |

**验证方式**:

```bash
# 检查是否使用
grep -r "tree-sitter" lib/ cli/ tools/ --include="*.js"
# 当前应该无结果（除了可能的注释）
```

#### 问题 3: `typescript` 依赖位置存疑

| 项目         | 内容                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| **问题描述** | `typescript` 在 `devDependencies` 中，但代码分析功能可能需要它解析 TS 文件 |
| **当前位置** | `devDependencies`                                                          |
| **应该位置** | 待验证（如果 Oxc 能独立解析 TS，则不需要；否则需要移到 dependencies）      |
| **影响**     | 如果 Oxc 不能独立解析 TS，发布后 TS 分析会失败                             |
| **修复建议** | 先验证 Oxc 是否能独立解析 TS，如果不能则移动                               |
| **工作量**   | 验证 10 分钟 + 修复 2 分钟（如需要）                                       |

**验证方式**:

```bash
# 测试 Oxc 解析 TS（不依赖 typescript 包）
node -e "
const { parseSync } = require('oxc-parser');
const code = 'interface User { name: string; }';
const result = parseSync('test.ts', code);
console.log(result);
"
```

---

### 🟢 P2 问题（可选优化）

#### 问题 4: 缺少 `chokidar` 文件监听依赖

| 项目         | 内容                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| **问题描述** | 设计文档 v1.2 承诺文件监听功能，但缺少 `chokidar` 或 `fs.watch` 封装依赖 |
| **当前状态** | 未声明                                                                   |
| **应该位置** | `dependencies`（如实现文件监听）                                         |
| **影响**     | 文件监听功能无法实现（OpenCode 插件系统不支持事件监听）                  |
| **修复建议** | 如确定需要文件监听，添加 `chokidar` 到 `dependencies`                    |
| **工作量**   | 2 分钟（添加依赖）+ 实现文件监听功能                                     |

#### 问题 5: `ws` 版本锁定

| 项目         | 内容                                                         |
| ------------ | ------------------------------------------------------------ |
| **问题描述** | `ws` 版本为 `^8.19.0`，但 `package-lock.json` 可能锁定旧版本 |
| **当前版本** | `^8.19.0`                                                    |
| **影响**     | 潜在的安全漏洞或兼容性问题                                   |
| **修复建议** | 检查 `package-lock.json`，如有旧版本运行 `npm update ws`     |
| **工作量**   | 5 分钟                                                       |

---

## 依赖清单总览

### dependencies（运行时必需）

| 包名                  | 版本       | 用途              | 状态                     |
| --------------------- | ---------- | ----------------- | ------------------------ |
| `@opencode-ai/plugin` | `^1.0.0`   | OpenCode 插件框架 | ✅ 正确                  |
| `ws`                  | `^8.19.0`  | WebSocket 客户端  | ✅ 正确                  |
| `oxc-parser`          | `^0.121.0` | JS/TS 代码解析    | 🔴 **应在 dependencies** |

### devDependencies（开发时必需）

| 包名                     | 版本       | 用途                       | 状态                  |
| ------------------------ | ---------- | -------------------------- | --------------------- |
| `@jest/globals`          | `^29.7.0`  | Jest 测试框架              | ✅ 正确               |
| `@types/node`            | `^22.10.5` | Node.js 类型定义           | ✅ 正确               |
| `jest`                   | `^29.7.0`  | 测试运行器                 | ✅ 正确               |
| `markdownlint-cli2`      | `^0.22.0`  | Markdown 检查              | ✅ 正确               |
| `oxlint`                 | `1.57.0`   | JavaScript 检查            | ✅ 正确               |
| `prettier`               | `3.8.1`    | 代码格式化                 | ✅ 正确               |
| `tree-sitter-javascript` | `^0.25.0`  | JS 解析（未使用）          | 🟡 **建议移除或实现** |
| `tree-sitter-typescript` | `^0.23.2`  | TS 解析（未使用）          | 🟡 **建议移除或实现** |
| `typescript`             | `^5.7.3`   | TS 编译器（待验证）        | 🟡 **位置待验证**     |
| `web-tree-sitter`        | `^0.26.7`  | Tree-sitter WASM（未使用） | 🟡 **建议移除或实现** |

---

## 修复优先级建议

### 立即修复（今天）

1. **BL-40-P0-1**: 将 `oxc-parser` 移到 `dependencies`
   - 影响：代码分析功能能否运行
   - 工作量：2 分钟

### 本周修复（Week 1）

2. **BL-40-P1-2**: 决定 Tree-sitter 依赖命运
   - 方案 A: 实现降级策略（1-2 周）
   - 方案 B: 暂时移除（2 分钟）

3. **BL-40-P1-3**: 验证 `typescript` 依赖位置
   - 测试 Oxc 是否能独立解析 TS
   - 如不能，移到 `dependencies`

### 可选优化（按需）

4. **BL-40-P2-4**: 添加 `chokidar`（如需要文件监听）
5. **BL-40-P2-5**: 更新 `ws` 版本

---

## 修复后验证清单

- [ ] `npm install` 成功
- [ ] `npm ls --depth=0` 无错误
- [ ] `npm ls oxc-parser --prod` 显示已安装
- [ ] `opencode-memory code-analyze test.js` 成功运行
- [ ] 所有测试通过

---

## 相关文档

- **设计文档 v1.2**: `D:\embedding_service\docs\CODE-ANALYSIS-DESIGN-v1.2.md`
- **4周探索计划**: `PLAN-4-WEEK-EXPLORATION.md`
- **Backlog**: `BACKLOG.md` (BL-40)

---

_报告生成时间: 2026-04-04_
