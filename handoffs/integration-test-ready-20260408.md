# 代码分析 v1.4 联调准备完成报告

**日期**: 2026-04-08  
**状态**: ✅ 准备完成，等待联调  
**联调时间**: 2026-04-11（周五）16:00-17:00

---

## 1. 后端 API 状态 ✅

后端已确认所有 API 完成：

| API              | 端点                                     | 状态    |
| ---------------- | ---------------------------------------- | ------- |
| 批量创建调用关系 | `POST /api/v1/calls/batch`               | ✅ 可用 |
| 引用查询         | `GET /api/v1/memories/{id}/references`   | ✅ 可用 |
| 依赖查询         | `GET /api/v1/memories/{id}/dependencies` | ✅ 可用 |
| 代码地图         | `GET /api/v1/projects/{id}/map`          | ✅ 可用 |
| 代码统计         | `GET /api/v1/projects/{id}/stats`        | ✅ 可用 |

---

## 2. 插件端准备完成 ✅

### 2.1 代码实现

- ✅ **调用关系提取**（Oxc + Tree-sitter）
- ✅ **调用关系可视化**（表格 + 树形）
- ✅ **memory_id 缓存机制**
- ✅ **auto_trigger 配置**

### 2.2 测试项目

已创建测试项目：`test-integration-project/`

```
test-integration-project/
├── src/
│   ├── utils/
│   │   └── crypto.ts      # hashPassword, verifyPassword, generateToken
│   ├── auth.ts            # AuthService (调用 crypto)
│   └── api.ts             # ApiService (调用 auth)
```

**调用关系**:

- `auth.ts:validateUser` → `crypto.ts:hashPassword`
- `auth.ts:verifyPassword` → `crypto.ts:verifyPassword`
- `api.ts:authenticateUser` → `auth.ts:login`

### 2.3 测试脚本

已创建集成测试：`tests/integration/calls-api.integration.test.js`

**测试场景**:

1. ✅ 基础调用关系分析
2. ✅ memory_id 缓存验证
3. ✅ 错误处理

**测试结果**: 6/6 通过

---

## 3. 联调测试计划

### 3.1 场景 1: 基础调用关系（16:10-16:20）

```
1. 上传 src/utils/crypto.ts
   → 获取 memory_id: mem_crypto

2. 上传 src/auth.ts
   → 获取 memory_id: mem_auth
   → 分析调用关系: validateUser → hashPassword

3. 批量上传调用关系:
   POST /api/v1/calls/batch
   {
     "calls": [{
       "caller_memory_id": "mem_auth",
       "callee_memory_id": "mem_crypto",
       "line": 15,
       "column": 20
     }]
   }

4. 查询引用:
   GET /api/v1/memories/mem_crypto/references
   → 应返回 validateUser 调用信息

5. 查询依赖:
   GET /api/v1/memories/mem_auth/dependencies
   → 应返回 hashPassword 调用信息
```

### 3.2 场景 2: 代码地图（16:20-16:30）

```
1. 获取项目地图:
   GET /api/v1/projects/github.com/test/integration/map
   → 验证 file_tree 结构
   → 验证 module_dependencies
   → 验证 hot_files

2. 获取项目统计:
   GET /api/v1/projects/github.com/test/integration/stats
   → 验证 total_files, total_functions
```

### 3.3 场景 3: 错误处理（16:30-16:40）

```
1. 批量上传包含不存在 memory_id 的调用关系
   → 验证是否正确返回错误列表
   → 验证是否跳过错误继续处理

2. 查询不存在的 memory_id
   → 验证返回空列表而非报错
```

---

## 4. 环境配置

### 4.1 后端环境

```yaml
地址: http://localhost:17999
Meilisearch: http://localhost:7700
SurrealDB: http://localhost:8000
```

### 4.2 插件端环境

```yaml
测试项目: D:/github/opencode-memory-plugin/test-integration-project
后端地址: http://localhost:17999
```

---

## 5. 联调检查清单

### 5.1 后端确认

- [x] 所有 API 实现完成
- [x] 单元测试通过（21 个测试）
- [x] 测试环境就绪
- [x] 确认参加 04-11 16:00 联调

### 5.2 插件端确认

- [x] 调用关系提取实现完成
- [x] memory_id 缓存实现完成
- [x] 测试项目准备完成
- [x] 测试脚本准备完成
- [x] 确认参加 04-11 16:00 联调

---

## 6. 风险与应对

| 风险           | 应对措施                    |
| -------------- | --------------------------- |
| 后端服务未启动 | 提前 10 分钟检查服务状态    |
| 网络连接问题   | 使用 localhost 避免网络问题 |
| 测试数据不一致 | 使用固定的测试项目          |

---

## 7. 联系方式

- **插件端**: OpenCode Memory Plugin Team
- **后端**: Embedding Service Team
- **沟通方式**: 实时通讯工具（联调时确定）

---

**联调准备已全部完成，期待 04-11 的联调！**
