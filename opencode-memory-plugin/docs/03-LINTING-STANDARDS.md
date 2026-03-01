# 3. 代码检查规范

> **适用范围**: OpenCode Memory Plugin 项目
> **依赖章节**: [1. 总则与原则](./01-GLOBAL-PRINCIPLES.md), [2. 代码格式化规范](./02-FORMATTING-STANDARDS.md)

---

## 📖 3.1 通用原则

### 3.1.1 检查目标

- **错误预防** - 在运行时前发现潜在错误
- **代码质量** - 保持代码整洁和可维护
- **最佳实践** - 遵循 JavaScript/Node.js 最佳实践

### 3.1.2 检查工具

| 工具       | 用途                | 配置文件        |
| ---------- | ------------------- | --------------- |
| **ESLint** | JavaScript 代码检查 | `.eslintrc.cjs` |

---

## 🔍 3.2 ESLint 规则分类

### 3.2.1 错误预防规则 (P0)

这些规则防止运行时错误：

```javascript
// ❌ no-undef - 禁止未定义变量
console.log(undefinedVariable);

// ❌ no-unused-vars - 禁止未使用变量（警告级别）
function test() {
  const unused = 42;
  return 0;
}

// ❌ no-debugger - 禁止 debugger 语句
debugger;

// ✅ 正确示例
const definedVariable = 'value';
console.log(definedVariable);

function test() {
  const used = 42;
  return used;
}
```

### 3.2.2 最佳实践规则 (P1)

这些规则确保代码符合最佳实践：

```javascript
// ✅ prefer-const - 优先使用 const
const MAX_SIZE = 100; // 不再重新赋值
let currentSize = 0; // 会重新赋值

// ✅ no-var - 禁止 var
let x = 1; // 使用 let 替代 var

// ✅ prefer-arrow-callback - 优先使用箭头函数
const doubled = numbers.map(n => n * 2);

// ✅ object-shorthand - 对象简写
const obj = {
  value,
  getValue() {
    return this.value;
  },
};
```

### 3.2.3 代码风格规则 (P2)

这些规则保持代码风格一致：

```javascript
// ✅ no-trailing-spaces - 禁止行尾空格
const x = 1;

// ✅ eol-last - 文件末尾空行
// 文件末尾必须有一个空行

// ✅ no-multiple-empty-lines - 禁止多个空行
function a() {}
// 只有一个空行
function b() {}
```

---

## 📋 3.3 规则详细说明

### 3.3.1 错误级别规则

| 规则          | 级别  | 说明               |
| ------------- | ----- | ------------------ |
| `no-undef`    | error | 禁止未定义变量     |
| `no-debugger` | error | 禁止 debugger 语句 |
| `no-var`      | error | 禁止使用 var       |

### 3.3.2 警告级别规则

| 规则                    | 级别  | 说明                            |
| ----------------------- | ----- | ------------------------------- |
| `no-unused-vars`        | error | 禁止未使用变量（忽略 `_` 前缀） |
| `no-shadow`             | warn  | 禁止变量遮蔽                    |
| `no-unused-expressions` | warn  | 禁止未使用表达式                |

### 3.3.3 建议级别规则

| 规则                    | 级别  | 说明             |
| ----------------------- | ----- | ---------------- |
| `prefer-const`          | error | 优先使用 const   |
| `prefer-arrow-callback` | warn  | 优先使用箭头函数 |
| `object-shorthand`      | warn  | 对象简写         |

---

## 🔧 3.4 规则配置说明

### 3.4.1 忽略未使用变量

```javascript
// ✅ 以 _ 开头的变量名会被忽略
function process(_unused, used) {
  return used * 2;
}

// ✅ 解构时忽略某些属性
const { _internal, public } = obj;
```

### 3.4.2 CLI 工具特殊规则

```javascript
// bin/cli.cjs
// CLI 工具允许使用 console

// ✅ 正确
console.log('Processing...');
console.error('Error occurred');

// 这是因为 CLI 工具需要输出到控制台
```

---

## ✅ 3.5 检查清单

- [ ] 无未定义变量
- [ ] 无未使用变量（`_` 前缀除外）
- [ ] 使用 `const` 和 `let`，不使用 `var`
- [ ] 优先使用箭头函数
- [ ] 使用对象简写语法
- [ ] 无 debugger 语句
- [ ] 文件末尾有空行
- [ ] 无行尾空格
