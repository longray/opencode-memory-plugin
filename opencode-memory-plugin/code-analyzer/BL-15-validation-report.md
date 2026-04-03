# BL-15: Phase 0 技术验证报告

**日期**: 2026-03-31  
**状态**: ⚠️ 部分完成 - WASM 版本兼容性问题

---

## 验证结果摘要

| 测试项                | 状态    | 备注                       |
| --------------------- | ------- | -------------------------- |
| WASM 模块加载         | ✅ 通过 | web-tree-sitter 可正常加载 |
| JavaScript 解析器加载 | ❌ 失败 | WASM 版本不兼容            |
| 1000行解析性能        | ⏸️ 跳过 | 依赖解析器加载             |
| 5000行解析性能        | ⏸️ 跳过 | 依赖解析器加载             |
| 内存稳定性            | ⏸️ 跳过 | 依赖解析器加载             |
| TypeScript 支持       | ⏸️ 跳过 | 依赖解析器加载             |
| AST 提取功能          | ⏸️ 跳过 | 依赖解析器加载             |

---

## 问题分析

### 1. WASM 版本兼容性问题

**错误信息**:

```
Incompatible language version ${version}.
Compatibility range ${MIN_COMPATIBLE_VERSION} through ${LANGUAGE_VERSION}.
```

**根本原因**:

- `web-tree-sitter` (v0.25.3) 与语言包 WASM 文件版本不匹配
- 语言包是为 Tree-sitter CLI 编译的，不是为 web 版本

### 2. 原生 Binding 编译失败

**错误信息**:

```
Could not find any Visual Studio installation to use
```

**根本原因**:

- Windows 环境缺少 Visual Studio Build Tools
- `tree-sitter` 原生模块需要 C++ 编译

---

## 解决方案

### 方案 A: 使用 Prebuilt WASM (推荐)

使用 `tree-sitter` 官方预构建的 WASM 文件：

```javascript
import Parser from 'web-tree-sitter';

// 从 CDN 或本地加载语言 WASM
const langUrl =
  'https://cdn.jsdelivr.net/npm/tree-sitter-javascript@0.23.1/tree-sitter-javascript.wasm';
const response = await fetch(langUrl);
const wasmBytes = await response.arrayBuffer();
const JavaScript = await Parser.Language.load(new Uint8Array(wasmBytes));
```

### 方案 B: 降级 web-tree-sitter

找到与语言包版本匹配的 web-tree-sitter 版本：

```bash
npm install web-tree-sitter@0.23.1
```

### 方案 C: 使用 Oxc 作为 JS/TS 主解析器

对于 JavaScript/TypeScript，直接使用 Oxc 解析：

```javascript
import { parseSync } from 'oxc-parser';

const ast = parseSync('test.js', sourceCode);
```

---

## 技术验证结论

### ✅ 已验证

1. **Bun 支持 WebAssembly**: web-tree-sitter 核心库可正常加载
2. **WASM 加载机制**: 通过 `Parser.Language.load()` 可以加载语言包
3. **问题定位**: 版本兼容性问题是主要障碍，不是 Bun/WASM 本身的问题

### ⚠️ 待解决

1. **语言包版本对齐**: 需要找到兼容的 web-tree-sitter + language 包版本组合
2. **Oxc 作为备选**: 对于 JS/TS 文件，Oxc 是更优选择（设计文档已定）

---

## 对 Phase 1 的影响

### 降级策略调整

根据设计文档 §3.1 降级策略，实际实现将调整为：

```
文件保存
    │
    ▼
是 JS/TS 文件？
    ├── Yes → 尝试 Oxc 解析（优先）
    │         ├── 成功 → 返回 Oxc AST ✅
    │         └── 失败 → 降级到 Tree-sitter
    │
    └── No → Tree-sitter WASM
              ├── 成功 → 返回 Tree-sitter AST ✅
              └── 失败 → 基础信息
```

### Phase 1 实现计划

1. **优先实现 Oxc 集成** (BL-22 提前)
   - Oxc 是纯 Rust + WASM，版本兼容性好
   - JS/TS 是主要代码语言
   - 性能更优 (26ms vs 50-150ms)

2. **Tree-sitter 作为多语言备选**
   - Python/Go/Rust/Java 等非 JS/TS 语言
   - 解决版本兼容性后启用

---

## 下一步行动

1. [ ] **BL-22 提前**: 先实现 Oxc 集成，确保 JS/TS 支持
2. [ ] **版本对齐**: 找到兼容的 tree-sitter 版本组合
3. [ ] **多语言支持**: 版本对齐后启用 Python/Go/Rust/Java 支持

---

## 参考

- Tree-sitter WASM 文档: <https://tree-sitter.github.io/tree-sitter/7-playground.html>
- web-tree-sitter npm: <https://www.npmjs.com/package/web-tree-sitter>
- Oxc 解析器: <https://github.com/oxc-project/oxc>
