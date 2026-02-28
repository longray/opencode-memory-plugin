# BM25 中文分词问题深度分析报告

**分析日期**: 2026-03-01  
**目标文件**: `opencode-memory-plugin/lib/bm25.js`  
**问题严重程度**: 🔴 严重（运行时崩溃）

---

## 📋 问题总结

| 问题 | 严重程度 | 影响 |
|------|---------|------|
| 依赖缺失 | 🔴 严重 | 任何包含中文的查询都会崩溃 |
| 死代码路径 | 🟡 中等 | splitMixedToken 永远不会执行 |
| 英文词丢失 | 🟡 中等 | 中文句子中的英文词汇无法提取 |
| 分词一致性 | 🟢 低 | 暂无问题（因为jieba不可用） |

---

## 🔴 问题1: @node-rs/jieba 依赖缺失（致命）

### 现象
```javascript
// bm25.js 第4行
import { Jieba } from '@node-rs/jieba';

// package.json 第30-34行 - 没有 @node-rs/jieba
"dependencies": {
  "@opencode-ai/plugin": "^1.0.0",
  "better-sqlite3": "^11.7.0",
  "sqlite-vec": "^0.1.1"
}
```

### 后果
- 任何包含中文字符的查询都会触发运行时错误
- 错误信息: `Cannot find package '@node-rs/jieba'`

### 影响范围
```
输入: "Python"           → ✅ 正常（ASCII快速路径）
输入: "Jest测试"         → ❌ 崩溃（中文路径）
输入: "使用Python开发"   → ❌ 崩溃（中文路径）
输入: "JWT认证"          → ❌ 崩溃（中文路径）
```

---

## 🟡 问题2: splitMixedToken 成为死代码

### 代码流程分析
```javascript
// bm25.js tokenize() 函数流程

if (isAsciiOnly(normalized)) {
  // ASCII快速路径 ✅ 可执行
  tokens = ...
} else {
  // 中文路径
  const jieba = Jieba.withDict();  // ← 这里崩溃
  const jiebaResults = jieba.cut(...);
  
  for (const word of jiebaResults) {
    if (isMixedWord(trimmed)) {
      tokens.push(...splitMixedToken(trimmed));  // ← 永远执行不到
    }
  }
}
```

### splitMixedToken 函数本身是正确的
测试证明该函数可以正确处理混合词：
```
"Jest测试"   → ["jest", "测试"] ✅
"JWT认证"    → ["jwt", "认证"]  ✅
"Python教程" → ["python", "教程"] ✅
"Node.js实战" → ["node", "js", "实战"] ✅
```

但问题在于：**必须先通过 jieba 才能到达这里**。

---

## 🟡 问题3: 索引与查询阶段的分词一致性

### 当前状态
由于 jieba 不可用，两者都无法处理中文：
- **索引阶段**: 包含中文的文档 → 崩溃
- **查询阶段**: 包含中文的查询 → 崩溃

### 如果 jieba 可用
假设 jieba 正常工作：
- 索引和查询都使用同一个 `tokenize()` 函数
- 都使用精确模式 `jieba.cut(text, false)`
- **一致性应该没有问题**

---

## 🔬 关键函数分析

### isAsciiOnly() - 检测函数
```javascript
function isAsciiOnly(text) {
  return /^[\x00-\x7F]+$/.test(text);
}
```
**行为正确**：
- "Python" → true
- "Jest测试" → false
- "使用Python开发" → false

### splitMixedToken() - 混合词拆分
```javascript
function splitMixedToken(word) {
  const parts = word.match(/([a-zA-Z0-9_.]+)|([\u4e00-\u9fa5]+)/g) || [];
  // ...
}
```
**行为正确**：
- 能分离中英文部分
- 处理驼峰命名
- 处理下划线和点号

### tokenize() - 主分词函数
```javascript
export function tokenize(text) {
  if (isAsciiOnly(normalized)) {
    // ASCII路径：空格分词
    return normalized.toLowerCase()...
  } else {
    // 中文路径：jieba分词 ← 这里崩溃
    const jieba = Jieba.withDict();
  }
}
```
**问题**：没有 fallback 机制

---

## 📊 测试结果

### ASCII快速路径测试
| 输入 | 预期 | 实际 | 状态 |
|------|------|------|------|
| "Python" | ["python"] | ["python"] | ✅ |
| "JavaScript" | ["javascript"] | ["javascript"] | ✅ |
| "Node.js" | ["node", "js"] | ["node", "js"] | ✅ |

### 中文路径测试
| 输入 | 预期 | 实际 | 状态 |
|------|------|------|------|
| "Jest测试" | ["jest", "测试"] | 崩溃 | ❌ |
| "JWT认证" | ["jwt", "认证"] | 崩溃 | ❌ |
| "Python教程" | ["python", "教程"] | 崩溃 | ❌ |
| "使用Python开发" | ["使用", "python", "开发"] | 崩溃 | ❌ |

---

## 🛠️ 解决方案

### 方案A: 添加 jieba 依赖（推荐）
```bash
cd opencode-memory-plugin
npm install @node-rs/jieba
```

**优点**：
- 完整的中文分词支持
- 分词质量高
- 无需修改代码逻辑

**缺点**：
- 增加包大小（约10MB）
- 原生模块可能有跨平台问题

---

### 方案B: 实现轻量级降级分词器

修改 `tokenize()` 函数，添加 fallback：

```javascript
export function tokenize(text) {
  // ... 标准化代码 ...
  
  if (isAsciiOnly(normalized)) {
    // ASCII快速路径
    return normalized.toLowerCase()...
  }
  
  // 中文路径 - 带fallback
  let tokens;
  try {
    const jieba = Jieba.withDict();
    const jiebaResults = jieba.cut(normalized, false);
    // ... jieba 处理逻辑 ...
  } catch (e) {
    // 降级：使用简单的中英文分离
    tokens = simpleChineseTokenizer(normalized);
  }
  
  return tokens;
}

// 简单的中文分词器
function simpleChineseTokenizer(text) {
  const tokens = [];
  const segments = text.match(/[a-zA-Z0-9_.]+|[\u4e00-\u9fa5]+|\s+/g) || [];
  
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    
    if (/[\u4e00-\u9fa5]/.test(seg)) {
      // 中文：双字符滑动窗口 + 单字符
      for (let i = 0; i < seg.length; i++) {
        if (i + 1 < seg.length) tokens.push(seg.substring(i, i + 2));
        tokens.push(seg[i]);
      }
    } else if (/[a-zA-Z0-9]/.test(seg)) {
      // 英文：使用现有逻辑
      tokens.push(...splitMixedToken(seg));
    }
  }
  
  return [...new Set(tokens)].filter(t => t.length > 0);
}
```

**优点**：
- 零依赖 fallback
- 永不崩溃
- 基本的混合词支持

**缺点**：
- 中文分词质量较低
- 会产生很多单字/双字token

---

### 方案C: jieba 作为可选依赖 + 平滑降级

```json
// package.json
{
  "dependencies": {
    "@node-rs/jieba": "optional"
  }
}
```

```javascript
// bm25.js
let Jieba = null;
try {
  const module = await import('@node-rs/jieba');
  Jieba = module.Jieba;
} catch (e) {
  console.warn('[BM25] @node-rs/jieba not available, using fallback tokenizer');
}

// 在 tokenize 中根据 Jieba 是否可用选择路径
```

---

## 📝 推荐修复步骤

1. **立即修复**: 添加 `@node-rs/jieba` 依赖
2. **中期改进**: 添加 fallback 机制
3. **长期优化**: 考虑更好的中文分词策略

---

## 🔍 验证修复

修复后应测试以下场景：
```javascript
const testCases = [
  { input: "Python", expected: ["python"] },
  { input: "Jest测试", expected: ["jest", "测试"] },
  { input: "JWT认证", expected: ["jwt", "认证"] },
  { input: "使用Python开发", expected: ["使用", "python", "开发"] },
];

for (const tc of testCases) {
  const result = tokenize(tc.input);
  console.log(`${tc.input}: ${JSON.stringify(result)}`);
}
```

---

**报告生成**: debug-tokenizer-deep.mjs 分析工具