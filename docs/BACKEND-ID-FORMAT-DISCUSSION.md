# 后端API实体ID格式问题讨论

**发件人**: OpenCode Memory Plugin 开发团队  
**日期**: 2026-05-10  
**主题**: 实体ID格式不一致导致的API调用失败问题  
**优先级**: 高

---

## 问题概述

我们在实现知识图谱关系推荐功能时，发现后端API返回的实体ID格式不一致，导致无法正确创建关系。请协助确认标准格式。

---

## 具体问题描述

### 1. 不同API返回的ID格式不一致

我们观察到三种不同的实体ID格式：

#### A. 本地存储格式 (link-map)

```json
{
  "id": "01KR66P6AB6BDX879X529T53HR",
  "type": "code",
  "abstract": "BM25搜索算法实现..."
}
```

#### B. 搜索API返回格式

```json
{
  "results": [
    {
      "id": "memory:9h71r4h15lcbi99guz2k",
      "score": 0.87,
      "abstract": "BM25搜索算法实现..."
    }
  ]
}
```

#### C. listEntities API返回格式

```json
{
  "data": [
    {
      "id": "01KR66P6AB6BDX879X529T53HR",
      "type": "code"
    }
  ]
}
```

### 2. 导致的错误

当使用搜索API返回的ID (`memory:xxx`) 尝试创建关系时：

```javascript
await client.createRelation({
  from_id: "memory:9h71r4h15lcbi99guz2k",
  to_id: "memory:ldrijayo1b6lvjy9ivsm",
  type: "related",
  weight: 0.87,
});
```

**错误响应**:

```json
{
  "detail": "Source memory 01KR66P6AB6BDX879X529T53HR not found. Please sync it first using incremental_sync()"
}
```

### 3. 我们的困惑

1. **listEntities返回空数组**: 调用 `listEntities({ limit: 100 })` 返回 `data: []`，但搜索API能找到实体
2. **ID格式混乱**: 搜索返回 `memory:xxx`，但错误提示显示后端期望 `01KR...` 格式
3. **同步状态不明**: 本地有141个条目，但listEntities返回0个

---

## 需要确认的问题

### 问题1: 标准实体ID格式是什么？

请确认后端应该使用哪种ID格式：

- **选项A**: ULID格式 (`01KR66P6AB6BDX879X529T53HR`)
- **选项B**: Memory ID格式 (`memory:9h71r4h15lcbi99guz2k`)
- **选项C**: 两者都支持，但有主次之分

### 问题2: 不同API的ID格式是否应该统一？

当前状态：

| API            | 返回ID格式           | 期望输入ID格式     |
| -------------- | -------------------- | ------------------ |
| search         | `memory:xxx`         | ?                  |
| listEntities   | `01KR...` (但返回空) | ?                  |
| createRelation | ?                    | 提示期望 `01KR...` |
| getRelations   | ?                    | ?                  |

**建议**: 所有API应该统一使用同一种ID格式，避免混淆。

### 问题3: 实体同步机制

我们发现：

- 本地link-map有141个条目
- 搜索API能找到这些条目（返回`memory:xxx`格式）
- 但listEntities返回空数组

**问题**:

1. 这些实体是否已经同步到后端？
2. 为什么搜索能找到但listEntities返回空？
3. 同步后的实体ID是否会改变？

### 问题4: 关系创建API的ID格式要求

createRelation API期望的`from_id`和`to_id`应该是什么格式？

根据错误提示 `"Source memory 01KR... not found"`，似乎期望的是ULID格式，但搜索API返回的是memory:xxx格式。

---

## 我们的建议方案

### 方案1: 统一使用Memory ID格式（推荐）

**理由**:

- 搜索API已经返回`memory:xxx`格式
- 这是后端生成的全局唯一ID
- 与本地ULID解耦，支持多租户

**需要后端修改**:

1. listEntities返回`memory:xxx`格式的ID
2. createRelation接受`memory:xxx`格式的ID
3. 提供ID转换API（ULID ↔ Memory ID）

### 方案2: 统一使用ULID格式

**理由**:

- 与本地存储一致
- 时间有序，便于排序

**需要后端修改**:

1. search API返回ULID格式
2. 所有API统一使用ULID

### 方案3: 支持双格式（向后兼容）

**实现**:

- 后端同时接受`memory:xxx`和`01KR...`两种格式
- 内部自动转换
- API文档明确说明

---

## 当前阻塞点

我们的知识图谱关系推荐功能已完成开发：

- ✅ 语义相似度分析（发现130个潜在关系）
- ✅ 类型共现分析（发现282个潜在关系）
- ❌ 无法实际创建关系（ID格式问题）

**影响**:

- 知识图谱网络密度无法提升（当前0.0042，目标0.02）
- 健康度卡在63/100（Grade D）
- 需要创建约412个关系才能达到目标

---

## 请求支持

请后端团队协助：

1. **确认标准ID格式**（memory:xxx vs ULID）
2. **统一所有API的ID格式**
3. **提供ID转换方法**（如果需要）
4. **更新API文档**，明确ID格式要求
5. **修复listEntities返回空的问题**

---

## 附件

### 测试代码

```javascript
// 测试1: listEntities返回空
const result1 = await client.listEntities({ limit: 100 });
console.log(result1); // { data: [], total: 0 }

// 测试2: 搜索能找到实体
const result2 = await client.search({
  query: "BM25",
  mode: "vector",
  limit: 5,
});
console.log(result2.results[0].id); // "memory:9h71r4h15lcbi99guz2k"

// 测试3: 创建关系失败
await client.createRelation({
  from_id: "memory:9h71r4h15lcbi99guz2k",
  to_id: "memory:ldrijayo1b6lvjy9ivsm",
  type: "related",
  weight: 0.87,
});
// Error: "Source memory 01KR66P6AB6BDX879X529T53HR not found"
```

### 环境信息

- **后端地址**: localhost:18008
- **API版本**: /api/v1
- **租户ID**: default
- **本地条目数**: 141
- **后端条目数**: 271（根据status命令）

---

期待您的回复！

**OpenCode Memory Plugin 开发团队**  
联系邮箱: dev@opencode-memory-plugin.local
