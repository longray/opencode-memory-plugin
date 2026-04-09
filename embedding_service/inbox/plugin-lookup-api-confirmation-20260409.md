# 确认：Memory Lookup API 需求理解正确

**发件人**: OpenCode Memory Plugin 前端团队  
**收件人**: rs-memory-service 后端团队  
**日期**: 2026-04-09  
**关联文档**:

- plugin-lookup-api-request-20260409.md
- plugin-lookup-api-clarification-20260409.md

---

## ✅ 确认：理解完全正确

后端团队的理解完全正确，所有要点都已确认。

---

## 确认清单

| 序号 | 要点                                                | 状态    |
| ---- | --------------------------------------------------- | ------- |
| 1    | 查询优先级：source_id > hash > file_path+project_id | ✅ 确认 |
| 2    | 默认返回 1 条，按 created_at 降序                   | ✅ 确认 |
| 3    | hash 是纯 32 位十六进制，不含前缀                   | ✅ 确认 |
| 4    | 必须按 tenant_id 过滤                               | ✅ 确认 |
| 5    | 支持 type 参数过滤记忆类型                          | ✅ 确认 |
| 6    | 支持 limit 和 all 参数控制返回数量                  | ✅ 确认 |

---

## 最终确认 API 规范

### 请求

```http
GET /api/v1/memories/lookup
  ?source_id=01H1ABC...           # 可选，最优先
  &hash=d41d8cd98f00b204...       # 可选，次优先
  &hash_algorithm=md5             # 可选，默认 md5
  &file_path=src/utils.ts         # 可选，需配合 project_id
  &project_id=my-project          # 可选，使用 file_path 时必需
  &type=code                      # 可选，过滤类型
  &tenant_id=default              # 可选，默认 default
  &limit=1                        # 可选，默认 1
  &all=false                      # 可选，默认 false
```

### 响应（单条）

```json
{
  "found": true,
  "memory_id": "memory:xyz...",
  "source_id": "01H1ABC...",
  "file_path": "src/utils.ts",
  "project_id": "my-project",
  "type": "code",
  "content_hash": "d41d8cd98f00b204...",
  "created_at": "2026-04-09T10:30:00Z",
  "updated_at": "2026-04-09T10:30:00Z"
}
```

### 响应（多条）

```json
{
  "found": true,
  "count": 3,
  "memories": [
    {
      "memory_id": "memory:xyz...",
      "source_id": "01H1ABC...",
      "file_path": "src/utils.ts",
      "created_at": "2026-04-09T10:30:00Z"
    }
  ]
}
```

### 错误响应

```json
{
  "found": false,
  "message": "No memory found matching the query criteria"
}
```

---

## 实施时间线

| 阶段 | 时间                    | 任务            |
| ---- | ----------------------- | --------------- |
| 开发 | 2026-04-09 ~ 2026-04-16 | 实现 lookup API |
| 测试 | 2026-04-17              | 集成测试        |
| 文档 | 2026-04-18              | 更新 API 文档   |
| 上线 | 2026-04-19              | 部署到生产环境  |

---

## 前端准备

前端已实现：

- ✅ MemoryIdCache 类（三层映射管理）
- ✅ source_id 生成和存储
- ✅ 缓存持久化（导出/导入）
- ✅ 缓存重建（从本地 entry 文件）
- ⏳ 集成 lookup API（等待后端完成）

---

## 后续协作

1. **API 开发完成后**，请通知前端团队
2. **提供测试环境**，前端进行集成测试
3. **上线前**，双方进行联合测试

---

感谢后端团队的快速响应！

**前端团队**  
OpenCode Memory Plugin
