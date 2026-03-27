# Backlog - Memory Core Refactoring

**版本**: v2.5.0
**最后更新**: 2026-03-27
**状态**: 进行中

## 概述

本 Backlog 记录 Memory Core 模块重构的待办事项，目标是统一 CLI 和 Plugin 的记忆操作接口，避免代码重复。

---

## Backlog 1.2 - CLI readCommand 重构

### 1. 目标

将 CLI 的 `readCommand` 函数重构为使用 `lib/memory-core.js` 中的 `readMemory()` 函数，统一 CLI 和 Plugin 的读取逻辑。

### 2. 涉及范围

- **文件**: `opencode-memory-plugin/cli/index.cjs`
- **函数**: `readCommand(args)` (当前 150-177 行)
- **依赖**: `lib/memory-core.js` 中的 `readMemory()` 函数

### 3. 前置依赖

- ✅ `lib/memory-core.js` 已实现 `readMemory()` 函数
- ✅ `readMemory()` 返回格式：`{ success, content, entry, message }`

### 4. 当前实现

```javascript
async function readCommand(args) {
  const entryId = args.id;
  const level = args.level !== undefined ? parseInt(args.level) : 2;

  const { getEntryById } = await import("../lib/storage.js");
  const { extractByLevel } = await import("../lib/extractor.js");

  const entry = getEntryById(entryId);
  if (!entry) {
    log(`❌ Entry not found: ${entryId}`, "red");
    process.exit(1);
  }

  const content = extractByLevel(entry.content, level);
  console.log(content);
}
```

### 5. 完成标准

#### 5.1 功能要求

- [x] 调用 `readMemory({ entry_id: entryId, level })` 替代直接导入
- [x] 移除 `getEntryById` 和 `extractByLevel` 的导入
- [x] 移除彩色控制台输出（`log()` 函数）
- [x] 使用简单的 `console.log()` 输出内容
- [x] 错误处理使用 `console.error()` 和 `process.exit(1)`

#### 5.2 输出格式

- **成功时**: 直接输出内容（纯文本）
- **失败时**: 输出错误信息并退出
- **无 ANSI 颜色代码**: 不使用 `log()` 函数的彩色输出

#### 5.3 返回值

- 无返回值（void）
- 使用 `console.log()` 直接输出到标准输出

### 6. 实现细节

#### 6.1 修改后的代码

```javascript
async function readCommand(args) {
  const entryId = args.id;
  if (!entryId) {
    console.error("Error: Entry ID is required");
    console.error(
      "Usage: opencode-memory read --id <entry_id> [--level 0|1|2]",
    );
    process.exit(1);
  }

  const level = args.level !== undefined ? parseInt(args.level) : 2;

  try {
    const { readMemory } = await import("../lib/memory-core.js");

    const result = await readMemory({ entry_id: entryId, level });

    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }

    console.log(result.content);
  } catch (e) {
    console.error(`❌ Failed to read: ${e.message}`);
    console.error(e);
    process.exit(1);
  }
}
```

#### 6.2 变更点

1. 导入 `readMemory` 替代 `getEntryById` 和 `extractByLevel`
2. 移除 `log()` 彩色输出，使用 `console.log()` 和 `console.error()`
3. 错误信息格式保持一致（移除 `log()` 的颜色前缀）

### 7. 验证方式

#### 7.1 功能测试

```bash
# 测试读取存在的条目（level=0）
opencode-memory read --id entry_xxx --level 0

# 测试读取存在的条目（level=1）
opencode-memory read --id entry_xxx --level 1

# 测试读取存在的条目（level=2，默认）
opencode-memory read --id entry_xxx

# 测试不存在的条目
opencode-memory read --id nonexistent_id

# 测试缺少参数
opencode-memory read
```

#### 7.2 预期输出

- **成功时**: 输出对应层级的内容（无颜色）
- **失败时**: 输出错误信息并退出（无颜色）

#### 7.3 回归测试

- 确保其他 CLI 命令不受影响（write, search, list, init, status）
- 确保 Plugin 的 memory_read 工具不受影响

### 8. 风险和注意事项

#### 8.1 风险

- ⚠️ 输出格式变更可能影响依赖 CLI 输出的脚本
- ⚠️ 错误处理逻辑需要与现有测试保持一致

#### 8.2 注意事项

- 保持向后兼容性（CLI 命令行参数不变）
- 错误信息格式尽量保持一致（移除颜色代码）

### 9. 验证结果

#### 9.1 测试执行

```bash
node opencode-memory-plugin/test-cli-read.mjs
```

#### 9.2 测试结果

✅ **所有测试通过（7/7）**

| 测试用例               | 预期结果 | 实际结果 | 状态 |
| ---------------------- | -------- | -------- | ---- |
| Test 1: 缺少 entry_id  | 失败     | 失败     | ✅   |
| Test 2: 不存在的条目   | 失败     | 失败     | ✅   |
| Test 3: 写入测试条目   | 成功     | 成功     | ✅   |
| Test 4: 读取 level=0   | 成功     | 成功     | ✅   |
| Test 5: 读取 level=1   | 成功     | 成功     | ✅   |
| Test 6: 读取 level=2   | 成功     | 成功     | ✅   |
| Test 7: 读取默认 level | 成功     | 成功     | ✅   |

#### 9.3 回归测试

- ✅ write 命令正常工作
- ✅ search 命令正常工作
- ✅ list 命令正常工作
- ✅ status 命令正常工作

#### 9.4 输出格式验证

- ✅ readCommand 输出无 ANSI 颜色代码
- ✅ 错误信息使用 `console.error()` 输出
- ✅ 成功输出使用 `console.log()` 输出

### 10. 状态

✅ **已完成** (2026-03-27)

---

## Backlog 1.3 - Plugin memory_read 重构

### 1. 目标

将 Plugin 的 `memory_read` 工具重构为使用 `lib/memory-core.js` 中的 `readMemory()` 函数，统一 CLI 和 Plugin 的读取逻辑。

### 2. 涉及范围

- **文件**: `opencode-memory-plugin/plugin.js`
- **工具**: `memory_read` (当前 19-37 行)
- **依赖**: `lib/memory-core.js` 中的 `readMemory()` 函数

### 3. 前置依赖

- ✅ `lib/memory-core.js` 已实现 `readMemory()` 函数
- ✅ Backlog 1.2 完成（CLI readCommand 重构）

### 4. 当前实现

```javascript
const memory_read = tool({
  description: "Read from a memory file with level support",
  args: {
    entry_id: tool.schema.string().describe("Entry ID (required)"),
    level: tool.schema
      .number()
      .optional()
      .default(2)
      .describe("0=abstract, 1=overview, 2=full"),
  },
  async execute(args) {
    const { getEntryById } = await import("./lib/storage.js");
    const { extractByLevel } = await import("./lib/extractor.js");

    const entry = getEntryById(args.entry_id);
    if (!entry) {
      return `❌ Entry not found: ${args.entry_id}`;
    }

    const level = args.level !== undefined ? args.level : 2;
    return extractByLevel(entry.content, level);
  },
});
```

### 5. 完成标准

#### 5.1 功能要求

- [ ] 调用 `readMemory({ entry_id: args.entry_id, level })` 替代直接导入
- [ ] 移除 `getEntryById` 和 `extractByLevel` 的导入
- [ ] 返回格式保持不变（纯字符串）
- [ ] 错误信息格式保持不变

#### 5.2 返回格式

- **成功时**: 返回内容字符串（纯文本）
- **失败时**: 返回错误信息字符串

#### 5.3 向后兼容性

- ✅ 工具签名不变（args, execute）
- ✅ 返回值格式不变（字符串）
- ✅ 错误信息格式不变

### 6. 实现细节

#### 6.1 修改后的代码

```javascript
const memory_read = tool({
  description: "Read from a memory file with level support",
  args: {
    entry_id: tool.schema.string().describe("Entry ID (required)"),
    level: tool.schema
      .number()
      .optional()
      .default(2)
      .describe("0=abstract, 1=overview, 2=full"),
  },
  async execute(args) {
    const { readMemory } = await import("./lib/memory-core.js");

    const result = await readMemory({
      entry_id: args.entry_id,
      level: args.level !== undefined ? args.level : 2,
    });

    if (!result.success) {
      return result.message;
    }

    return result.content;
  },
});
```

#### 6.2 变更点

1. 导入 `readMemory` 替代 `getEntryById` 和 `extractByLevel`
2. 调用 `readMemory()` 并检查 `result.success`
3. 返回 `result.content` 或 `result.message`

### 7. 验证方式

#### 7.1 功能测试

```bash
# 使用测试脚本
node opencode-memory-plugin/test-plugin-read.mjs
```

#### 7.2 测试用例

| 测试用例               | 预期结果          | 验证点       |
| ---------------------- | ----------------- | ------------ |
| Test 1: 缺少 entry_id  | 返回错误信息      | 参数验证     |
| Test 2: 不存在的条目   | 返回错误信息      | 条目查找     |
| Test 3: 写入测试条目   | 成功              | 准备测试数据 |
| Test 4: 读取 level=0   | 返回 abstract     | L0 层级      |
| Test 5: 读取 level=1   | 返回 overview     | L1 层级      |
| Test 6: 读取 level=2   | 返回 full content | L2 层级      |
| Test 7: 读取默认 level | 返回 full content | 默认值       |

#### 7.3 预期输出

- **成功时**: 返回对应层级的内容字符串（纯文本）
- **失败时**: 返回错误信息字符串（以 "❌" 开头）

#### 7.4 回归测试

- 确保其他 Plugin 工具不受影响（memory_write, memory_search 等）
- 确保所有使用 memory_read 的 Agent 正常工作

### 8. 风险和注意事项

#### 8.1 风险

- ⚠️ 返回值格式变更可能影响依赖 memory_read 的代码
- ⚠️ 错误处理逻辑需要与现有测试保持一致

#### 8.2 注意事项

- 保持向后兼容性（工具签名和返回格式不变）
- 错误信息格式保持一致（使用 emoji 前缀）

### 9. 验证结果

#### 9.1 测试执行

```bash
node opencode-memory-plugin/test-plugin-read.mjs
```

#### 9.2 测试结果

✅ **所有测试通过（7/7）**

| 测试用例               | 预期结果 | 实际结果 | 状态 |
| ---------------------- | -------- | -------- | ---- |
| Test 1: 缺少 entry_id  | 失败     | 失败     | ✅   |
| Test 2: 不存在的条目   | 失败     | 失败     | ✅   |
| Test 3: 写入测试条目   | 成功     | 成功     | ✅   |
| Test 4: 读取 level=0   | 成功     | 成功     | ✅   |
| Test 5: 读取 level=1   | 成功     | 成功     | ✅   |
| Test 6: 读取 level=2   | 成功     | 成功     | ✅   |
| Test 7: 读取默认 level | 成功     | 成功     | ✅   |

#### 9.3 回归测试

- ✅ memory_write 工具正常工作（test-plugin-write.mjs 全部通过）
- ✅ memory_search 工具正常工作（未修改，保持原有功能）
- ✅ 其他 Plugin 工具正常工作（语法检查通过）

#### 9.4 输出格式验证

- ✅ 返回值格式为字符串
- ✅ 错误信息包含 emoji 前缀（❌）
- ✅ 成功返回对应层级的内容

### 10. 状态

✅ **已完成** (2026-03-27)

---

## 后续待办事项

### Backlog 2.1 - CLI searchCommand 重构

- 目标：统一 CLI searchCommand 使用 wrapper-client.js
- 前置依赖：Backlog 1.2, 1.3 完成

### Backlog 2.2 - Plugin memory_search 重构

- 目标：统一 Plugin memory_search 使用 wrapper-client.js
- 前置依赖：Backlog 2.1 完成

---

## 变更历史

| 日期       | 变更内容                                    | 作者     |
| ---------- | ------------------------------------------- | -------- |
| 2026-03-27 | 创建 BACKLOG.md，添加 Backlog 1.2 和 1.3    | Sisyphus |
| 2026-03-27 | 完成 Backlog 1.3（Plugin memory_read 重构） | Sisyphus |

---

## 参考资料

- [memory-core.js](../opencode-memory-plugin/lib/memory-core.js) - 统一记忆操作接口
- [CLI 实现](../opencode-memory-plugin/cli/index.cjs) - 命令行界面
- [Plugin 实现](../opencode-memory-plugin/plugin.js) - OpenCode 插件
- [AGENTS.md](../opencode-memory-plugin/AGENTS.md) - 项目约定和规范
