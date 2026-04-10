# Bug 报告：Memory Lookup API 返回 found: false 但实际数据已上传

**发件人**: OpenCode Memory Plugin 前端团队  
**收件人**: rs-memory-service 后端团队  
**日期**: 2026-04-10  
**优先级**: P1 - High  
**关联文档**:

- plugin-lookup-api-clarification-20260409.md
- plugin-lookup-api-confirmation-20260409.md

---

## 问题概述

Memory Lookup API (`/api/v1/memories/lookup`) 存在严重 bug：**数据上传成功，但查询返回 `found: false`**。

这导致代码分析功能的 Memory ID 缓存机制无法正常工作，影响调用关系追踪功能。

---

## 复现步骤

### 1. 上传数据（成功）

```javascript
const result = await wrapperClient.uploadMemories([
  {
    type: "code",
    content: JSON.stringify(analysis),
    abstract: "Lookup test function",
    overview: "Test file for lookup API",
    source_id: "test-source-1775832138234",
    local_id: "test-source-1775832138234",
    project_id: "test-lookup-project",
    metadata: {
      file_path: "src/lookup-test.ts",
      content_hash: "abc123",
    },
  },
]);

// 结果：✅ 上传成功
// result.success = 1
// result.memory_ids = ["memory:xzaedsw2jqczzlqdafao"]
```

**日志输出**:

```
✅ Uploaded with source_id: test-source-1775832138234, memory_id: memory:xzaedsw2jqczzlqdafao
```

### 2. 通过 source_id 查询（失败）

```javascript
const result = await wrapperClient.lookupMemory({
  source_id: "test-source-1775832138234",
});

// 结果：❌ 未找到
// result.found = false
// result.message = "未找到匹配的记忆"
```

**日志输出**:

```
Lookup result: {
  "found": false,
  "message": "未找到匹配的记忆"
}
```

### 3. 通过 file_path + project_id 查询（同样失败）

```javascript
const result = await wrapperClient.lookupMemory({
  file_path: "src/lookup-test.ts",
  project_id: "test-lookup-project",
});

// 结果：❌ 未找到
// result.found = false
```

---

## 测试环境

- **后端版本**: minimal-wrapper v2.4.1
- **端口**: 17999
- **数据库**: SurrealDB (status: connected)
- **搜索**: Meilisearch (status: available)
- **测试文件**: `opencode-memory-plugin/tests/integration/lookup-api.integration.test.js`

---

## 影响范围

| 功能           | 影响    | 说明                               |
| -------------- | ------- | ---------------------------------- |
| Memory ID 缓存 | 🔴 严重 | 无法通过 file_path 查询 memory_id  |
| 代码分析       | 🔴 严重 | 无法建立调用关系（需要 memory_id） |
| 缓存重建       | 🔴 严重 | `rebuildFromBackend()` 返回 0 条   |
| 多设备同步     | 🟡 中等 | 无法通过 source_id 查找            |

---

## 预期行为

根据 API 规范（plugin-lookup-api-clarification-20260409.md），查询应该：

1. **通过 source_id 查询**: 返回对应的记忆
2. **通过 file_path + project_id 查询**: 返回该文件的最新记忆
3. **返回格式**:

   ```json
   {
     "found": true,
     "memory_id": "memory:xzaedsw2jqczzlqdafao",
     "source_id": "test-source-1775832138234",
     "file_path": "src/lookup-test.ts",
     "project_id": "test-lookup-project"
   }
   ```

   ```

   ```

---

## 实际行为

```json
{
  "found": false,
  "message": "未找到匹配的记忆"
}
```

---

## 可能原因分析

1. **索引延迟**: Meilisearch 索引有延迟，数据上传后不能立即查询
2. **查询逻辑错误**: Lookup API 实现中的查询条件有误
3. **字段映射问题**: source_id / file_path 存储和查询时的字段名不一致
4. **租户隔离**: tenant_id 过滤导致数据不可见

---

## 测试代码

完整的复现测试：

```javascript
// tests/integration/lookup-api.integration.test.js
describe("Memory Lookup API Integration Tests", () => {
  test("should upload and lookup by source_id", async () => {
    // 1. 上传
    const uploadResult = await wrapperClient.uploadMemories([
      {
        type: "code",
        content: JSON.stringify(analysis),
        source_id: "test-source-123",
        project_id: "test-project",
        metadata: { file_path: "src/test.ts" },
      },
    ]);

    expect(uploadResult.success).toBeGreaterThan(0); // ✅ 通过
    const memoryId = uploadResult.memory_ids[0];

    // 2. 查询
    const lookupResult = await wrapperClient.lookupMemory({
      source_id: "test-source-123",
    });

    expect(lookupResult.found).toBe(true); // ❌ 失败
    expect(lookupResult.memory_id).toBe(memoryId); // ❌ 失败
  });
});
```

---

## 请求

请后端团队：

1. **确认 Lookup API 实现状态** - 是否已完成开发？
2. **检查 SurrealDB 查询逻辑** - 是否正确存储和查询 source_id / file_path？
3. **检查 Meilisearch 索引** - 数据是否正确索引？
4. **提供调试日志** - 查询时的实际 SQL/查询语句

---

## 临时解决方案

在 Lookup API 修复之前，前端将：

1. 跳过相关测试（标记为 `test.skip()`）
2. 禁用缓存重建功能
3. 使用内存缓存（不依赖后端查询）

---

## 相关测试失败

当前测试失败情况：

```
Test Suites: 1 failed, 21 passed, 22 total
Tests:       4 failed, 10 skipped, 184 passed, 198 total

Failing tests:
- should lookup memory by source_id
- should lookup memory by file_path
- should retrieve from cache without backend call
- should rebuild cache from backend lookup
```

---

## 联系方式

如有疑问或需要更多信息，请联系前端团队。

**前端团队**  
OpenCode Memory Plugin
