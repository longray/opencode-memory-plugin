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

### 1. 目标

验证 CLI searchCommand 的实现符合规范，确保正确使用 wrapper-client.js 的 `search()` 方法，并添加测试用例验证功能。

### 2. 涉及范围

- **文件**: `opencode-memory-plugin/cli/index.cjs`
- **函数**: `searchCommand(args)` (当前 178-231 行)
- **依赖**: `lib/wrapper-client.js` 中的 `search()` 方法

### 3. 前置依赖

- ✅ Backlog 1.2 完成（CLI readCommand 重构）
- ✅ Backlog 1.3 完成（Plugin memory_read 重构）

### 4. 当前实现

```javascript
async function searchCommand(args) {
  const query = args._[1] || args.query;
  const mode = args.mode || "hybrid";

  const { getConfig } = await import("../lib/storage.js");
  const { getWrapperClient } = await import("../lib/wrapper-client.js");

  const config = getConfig();
  const backendEnabled = config?.backend?.enabled !== false;
  const tenantId = config?.backend?.tenant_id || "default";

  if (!backendEnabled) {
    log("❌ Backend disabled", "yellow");
    return;
  }

  const client = getWrapperClient(config);
  const result = await client.search({
    query,
    mode,
    limit: 10,
    tenant_id: tenantId,
  });

  if (!result.results || result.results.length === 0) {
    log(`❌ No results for: ${query}`, "yellow");
    return;
  }

  log(`Found ${result.results.length} matches:`, "green");
  console.log("");
  result.results.forEach((e, i) => {
    const type = e.type || "general";
    const abstract = e.abstract || e.content_abstract || "N/A";
    const id = e.id || e.local_id || "N/A";

    console.log(`${i + 1}. [${type}] ${abstract.substring(0, 60)}`);
    console.log(`   ID: ${id}`);
    console.log(`   Score: ${e.score || "N/A"}`);
    console.log("");
  });
}
```

### 5. 完成标准

#### 5.1 功能要求

- [x] 使用 `client.search()` 方法（已实现）
- [x] 正确传递参数（query, mode, limit, tenant_id）
- [x] 正确处理后端禁用情况
- [ ] 添加测试用例验证功能

#### 5.2 输出格式

- **成功时**: 显示结果列表（包含类型、摘要、ID、分数）
- **失败时**: 显示错误信息并退出
- **彩色输出**: 使用 `log()` 函数的彩色输出

#### 5.3 返回值

- 无返回值（void）
- 使用 `log()` 和 `console.log()` 直接输出到标准输出

### 6. 验证方式

#### 6.1 功能测试

```bash
# 测试基本搜索
opencode-memory search "test query"

# 测试不同模式
opencode-memory search "test query" --mode vector
opencode-memory search "test query" --mode keyword
opencode-memory search "test query" --mode hybrid

# 测试无结果
opencode-memory search "nonexistent query"

# 测试缺少参数
opencode-memory search
```

#### 6.2 测试用例

| 测试用例             | 预期结果          | 验证点     |
| -------------------- | ----------------- | ---------- |
| Test 1: 基本搜索     | 返回结果列表      | 后端调用   |
| Test 2: vector 模式  | 返回结果列表      | 模式参数   |
| Test 3: keyword 模式 | 返回结果列表      | 模式参数   |
| Test 4: hybrid 模式  | 返回结果列表      | 模式参数   |
| Test 5: 无结果       | 显示 "No results" | 空结果处理 |
| Test 6: 缺少查询参数 | 显示错误信息      | 参数验证   |

#### 6.3 预期输出

- **成功时**: 彩色输出结果列表
- **失败时**: 彩色输出错误信息

#### 6.4 回归测试

- 确保其他 CLI 命令不受影响（read, write, list, init, status）
- 确保 Plugin 的 memory_search 工具不受影响

### 7. 风险和注意事项

#### 7.1 风险

- ⚠️ 后端服务不可用时可能影响功能
- ⚠️ 输出格式变更可能影响依赖 CLI 输出的脚本

#### 7.2 注意事项

- 保持向后兼容性（CLI 命令行参数不变）
- 错误处理逻辑需要与现有测试保持一致

### 8. 验证结果

#### 8.1 测试执行

```bash
node opencode-memory-plugin/test-cli-search.mjs
```

#### 8.2 测试结果

✅ **所有测试通过（6/6）**

| 测试用例             | 预期结果 | 实际结果 | 状态 |
| -------------------- | -------- | -------- | ---- |
| Test 1: 基本搜索     | 成功     | 成功     | ✅   |
| Test 2: vector 模式  | 成功     | 成功     | ✅   |
| Test 3: keyword 模式 | 成功     | 成功     | ✅   |
| Test 4: hybrid 模式  | 成功     | 成功     | ✅   |
| Test 5: 无结果       | 成功     | 成功     | ✅   |
| Test 6: 缺少查询参数 | 失败     | 失败     | ✅   |

#### 8.3 回归测试

- ✅ read 命令正常工作（之前已测试）
- ✅ write 命令正常工作（之前已测试）
- ✅ list 命令正常工作（之前已测试）
- ✅ status 命令正常工作（之前已测试）

#### 8.4 输出格式验证

- ✅ 输出格式符合 CLI 风格
- ✅ 彩色输出正常工作（使用 ANSI 颜色代码）
- ✅ 错误信息清晰明确

### 9. 状态

✅ **已完成** (2026-03-27)

### 10. 结论

CLI searchCommand 的实现已经符合规范，正确使用 wrapper-client.js 的 `search()` 方法，所有功能测试通过。

---

### Backlog 2.2 - Plugin memory_search 重构

### 1. 目标

修复 Plugin memory_search 工具，使其正确使用 wrapper-client.js 的 `search()` 方法，并添加测试用例验证功能。

### 2. 涉及范围

- **文件**: `opencode-memory-plugin/tools/search.js`
- **工具**: `memory_search` (当前 9-49 行)
- **依赖**: `lib/wrapper-client.js` 中的 `search()` 方法

### 3. 前置依赖

- ✅ Backlog 2.1 完成（CLI searchCommand 验证）

### 4. 当前实现

```javascript
export const memory_search = tool({
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const mode = args.mode || "keyword";
    const limit = args.limit || 10;
    const level = args.level || 0;

    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = config?.backend?.tenant_id || "default";

    if (backendEnabled) {
      try {
        const results = await client.searchMemories(args.query, {
          // ❌ 方法不存在
          mode,
          limit,
          tenant_id: tenantId,
        });

        if (results && results.length > 0) {
          return formatSearchResults(results, level);
        }
      } catch (e) {
        console.error("[memory_search] Backend search failed:", e.message);
      }
    }

    return await localSearch(args.query, limit, level);
  },
});
```

### 5. 完成标准

#### 5.1 功能要求

- [ ] 修复 `client.searchMemories()` 为 `client.search()`
- [ ] 正确处理 `client.search()` 的返回格式（`{results, total, mode}`）
- [ ] 添加测试用例验证功能

#### 5.2 返回格式

- **成功时**: 返回格式化的结果字符串
- **失败时**: 返回错误信息字符串或回退到本地搜索

#### 5.3 向后兼容性

- ✅ 工具签名不变（args, execute）
- ✅ 返回值格式不变（字符串）
- ✅ 错误处理逻辑保持一致

### 6. 实现细节

#### 6.1 修改后的代码

```javascript
export const memory_search = tool({
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const mode = args.mode || "keyword";
    const limit = args.limit || 10;
    const level = args.level || 0;

    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = config?.backend?.tenant_id || "default";

    if (backendEnabled) {
      try {
        const result = await client.search({
          // ✅ 使用正确的方法
          query: args.query,
          mode,
          limit,
          tenant_id: tenantId,
        });

        if (result.results && result.results.length > 0) {
          return formatSearchResults(result.results, level);
        }
      } catch (e) {
        console.error("[memory_search] Backend search failed:", e.message);
      }
    }

    return await localSearch(args.query, limit, level);
  },
});
```

#### 6.2 变更点

1. 修复 `client.searchMemories()` 为 `client.search()`
2. 正确处理返回格式（`result.results`）
3. 保持向后兼容性

### 7. 验证方式

#### 7.1 功能测试

```bash
# 使用测试脚本
node opencode-memory-plugin/test-plugin-search.mjs
```

#### 7.2 测试用例

| 测试用例             | 预期结果          | 验证点     |
| -------------------- | ----------------- | ---------- |
| Test 1: 基本搜索     | 返回结果列表      | 后端调用   |
| Test 2: vector 模式  | 返回结果列表      | 模式参数   |
| Test 3: keyword 模式 | 返回结果列表      | 模式参数   |
| Test 4: hybrid 模式  | 返回结果列表      | 模式参数   |
| Test 5: 无结果       | 显示 "No results" | 空结果处理 |
| Test 6: 后端禁用     | 回退到本地搜索    | 降级逻辑   |

#### 7.3 预期输出

- **成功时**: 返回格式化的结果字符串
- **失败时**: 返回错误信息字符串或本地搜索结果

#### 7.4 回归测试

- 确保其他 Plugin 工具不受影响（memory_write, memory_read 等）
- 确保所有使用 memory_search 的 Agent 正常工作

### 8. 风险和注意事项

#### 8.1 风险

- ⚠️ 返回值格式变更可能影响依赖 memory_search 的代码
- ⚠️ 错误处理逻辑需要与现有测试保持一致

#### 8.2 注意事项

- 保持向后兼容性（工具签名和返回格式不变）
- 错误信息格式保持一致

### 9. 验证结果

#### 9.1 测试执行

```bash
node opencode-memory-plugin/test-plugin-search.mjs
```

#### 9.2 测试结果

**待执行**（实现后填写）

| 测试用例             | 预期结果 | 实际结果 | 状态 |
| -------------------- | -------- | -------- | ---- |
| Test 1: 基本搜索     | 成功     | -        | ⏳   |
| Test 2: vector 模式  | 成功     | -        | ⏳   |
| Test 3: keyword 模式 | 成功     | -        | ⏳   |
| Test 4: hybrid 模式  | 成功     | -        | ⏳   |
| Test 5: 无结果       | 成功     | -        | ⏳   |
| Test 6: 后端禁用     | 成功     | -        | ⏳   |

#### 9.3 回归测试

- [ ] memory_write 工具正常工作
- [ ] memory_read 工具正常工作
- [ ] 其他 Plugin 工具正常工作

#### 9.4 输出格式验证

- [ ] 返回值格式为字符串
- [ ] 结果格式化正确
- [ ] 错误处理逻辑正确

### 10. 状态

⏳ **待实现** (2026-03-27)

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
