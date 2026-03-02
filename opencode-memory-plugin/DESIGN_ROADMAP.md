# 开发计划

> [← 接口规格](DESIGN_API.md)

---

## 一、开发任务总览

| 阶段 | 优先级 | 任务数 | 预估工时 |
|------|--------|--------|----------|
| 阶段 1 | 高 | 5 | ~13h |
| 阶段 2 | 高 | 2 | ~5h |
| 阶段 3 | 中 | 2 | ~5h |
| 阶段 4 | 低 | 3 | ~5h |
| **总计** | - | **12** | **~28h** |

---

## 二、阶段 1：核心组件（高优先级）

### Task 1.1: Memory Manager

| 项目 | 内容 |
|------|------|
| **文件** | `lib/memory-manager.js` |
| **描述** | 记忆管理器，管理 MD 文件读写和标签 |
| **核心功能** | `write()`, `read()`, `getUnuploadedEntries()`, `markAsUploaded()` |
| **预估工时** | 4h |

**子任务**：
- [ ] 创建 MemoryManager 类结构
- [ ] 实现 `write()` 方法（添加默认标签）
- [ ] 实现 `read()` 方法（支持过滤）
- [ ] 实现项目标签检测规则
- [ ] 实现 `getUnuploadedEntries()` 方法
- [ ] 实现 `markAsUploaded()` 方法
- [ ] 单元测试

---

### Task 1.2: Network Checker

| 项目 | 内容 |
| **文件** | `lib/network-checker.js` |
| **核心功能** | `start()`, `stop()`, `check()`, `getStatus()`, `isHealthy()` |
| **预估工时** | 2h |

**子任务**：
- [ ] 创建 NetworkChecker 类结构
- [ ] 实现定时检查机制
- [ ] 实现健康状态解析
- [ ] 实现状态历史记录
- [ ] 单元测试

---

### Task 1.3: Wrapper Client

| 项目 | 内容 |
|------|------|
| **文件** | `lib/wrapper-client.js` |
| **描述** | HTTP 客户端，调用外部 Express 服务 |
| **核心功能** | `search()`, `upload()`, `batchUpload()`, `request()` |
| **预估工时** | 3h |

**子任务**：
- [ ] 创建 WrapperClient 类结构
- [ ] 实现 HTTP 请求方法（带重试）
- [ ] 实现语义搜索接口
- [ ] 实现上传接口
- [ ] 实现批量上传
- [ ] 单元测试

---

### Task 1.4: Memory Classifier 子代理

| 项目 | 内容 |
|------|------|
| **文件** | `agents/memory-classifier.md` |
| **描述** | 手动触发的记忆分类子代理 |
| **触发命令** | `@memory-classifier classify unclassified memories` |
| **预估工时** | 2h |

**子任务**：
- [ ] 创建代理定义（参考现有格式）
- [ ] 编写系统提示词
- [ ] 定义分类规则
- [ ] 测试手动触发

---

### Task 1.5: Memory Upload 子代理（手动触发）

|| 项目 | 内容 |
||------|------|
|| **文件** | `agents/memory-upload.md` |
|| **描述** | 手动触发的记忆上传子代理 |
|| **触发命令** | `@memory-upload upload unclassified entries` |
|| **预估工时** | 2h |

**子任务**：
- [ ] 创建代理定义（参考现有格式）
- [ ] 编写系统提示词
- [ ] 实现上传逻辑（调用 WrapperClient）
- [ ] 实现上传结果记录
- [ ] 测试手动上传
- [ ] 测试上传失败处理

**上传策略**：
- **前期**：手动触发，方便调试
- **触发命令**：`@memory-upload upload unclassified entries`
- **上传流程**：
  1. 检查网络健康状态
  2. 获取待上传的记忆（`uploaded: false`）
  3. 批量上传到外部服务
  4. 更新 `uploaded` 标记和 `upload_timestamp`
  5. 记录失败条目和 `upload_error`

---

## 三、阶段 2：集成（高优先级）

### Task 2.1: 修改 plugin.js

|| 项目 | 内容 |
||------|------|
|| **文件** | `plugin.js` |
|| **描述** | 添加默认标签到写入逻辑 |
|| **预估工时** | 2h |
**子任务**：
- [ ] 导入 MemoryManager
- [ ] 修改 memory_write 工具添加默认标签
- [ ] 测试写入功能

---

### Task 2.2: 修改 vector-store.js

| 项目 | 内容 |
|------|------|
| **文件** | `lib/vector-store.js` |
| **描述** | 使用 Wrapper Client 替换本地 sqlite-vec |
| **预估工时** | 3h |

**子任务**：
- [ ] 移除 better-sqlite3 和 sqlite-vec 依赖
- [ ] 集成 WrapperClient
- [ ] 实现网络检查降级
- [ ] 测试语义搜索

---

## 四、阶段 3：外部服务（中等优先级）

### Task 3.1: Wrapper Service

| 项目 | 内容 |
|------|------|
| **文件** | `wrapper-service/server.js` |
| **描述** | Express HTTP 服务，提供 API 端点 |
| **端口** | 3001 |
| **预估工时** | 4h |

**子任务**：
- [ ] 创建 Express 服务框架
- [ ] 实现 `/api/health` 端点
- [ ] 实现 `/api/search` 端点
- [ ] 实现 `/api/upload` 端点
- [ ] 集成 SurrealDB
- [ ] 集成嵌入服务调用

---

### Task 3.2: 依赖配置

| 项目 | 内容 |
|------|------|
| **文件** | `wrapper-service/package.json` |
| **描述** | NPM 依赖配置 |
| **预估工时** | 1h |

**子任务**：
- [ ] 创建 package.json
- [ ] 配置依赖（express, surrealdb）
- [ ] 创建 .env.example

---

## 五、阶段 4：配置和文档（低优先级）

### Task 4.1: 更新配置

| 项目 | 内容 |
|------|------|
| **文件** | `memory-config.json` |
| **描述** | 扩展配置文件，添加新参数 |
| **预估工时** | 1h |

---

### Task 4.2: 更新架构文档

| 项目 | 内容 |
|------|------|
| **文件** | `ARCHITECTURE.md` |
| **描述** | 更新架构文档 |
| **预估工时** | 2h |

---

### Task 4.3: 更新使用说明

| 项目 | 内容 |
|------|------|
| **文件** | `README.md`, `QUICK_START.md` |
| **描述** | 更新使用说明 |
| **预估工时** | 2h |

---

## 六、测试策略

### 6.1 开发模式：TDD（测试驱动开发）

**原则**：
- 先写测试，再写代码
- 每个功能都有对应的测试用例
- 测试驱动代码设计和重构

**流程**：
```
1. 编写失败的测试用例
2. 运行测试，确认失败（RED）
3. 编写最小化的实现代码
4. 运行测试，确认通过（GREEN）
5. 重构代码，保持测试通过（REFACTOR）
```

### 6.2 测试覆盖率要求

**目标**：每阶段测试覆盖率 ≥ 80%

|| 阶段 | 覆盖率目标 | 必测项目 |
||------|------------|----------|
|| 阶段 1 | 80% | MemoryManager, NetworkChecker, WrapperClient |
|| 阶段 2 | 85% | plugin.js, vector-store.js |
|| 阶段 3 | 85% | Wrapper Service API |
|| 阶段 4 | 90% | 完整集成测试 |

**覆盖率类型**：
- 语句覆盖率（Statements）
- 分支覆盖率（Branches）
- 函数覆盖率（Functions）
- 行覆盖率（Lines）

### 6.3 单元测试

每个核心类需要编写单元测试：
- MemoryManager: 写入、读取、标签管理
- NetworkChecker: 健康检查、状态管理
- WrapperClient: 请求、重试、错误处理

**测试框架**：Jest 或 Mocha
**覆盖率工具**：Istanbul/nyc

### 6.4 集成测试

完整流程测试：
- 写入 → 分类 → 上传 → 搜索

**关键场景**：
- 手动上传流程
- 分类流程（子代理）
- 语义搜索降级到本地搜索

### 6.5 降级测试

模拟网络异常场景：
- 服务不可用时的降级行为
- 本地搜索回退
- 上传失败处理

### 6.6 性能测试

大批量操作测试：
- 100+ 条记忆批量上传
- 1000+ 条记忆搜索
- 网络延迟和超时处理
---

## 七、相关文档

- [← 设计概述](DESIGN_OVERVIEW.md)
- [← 架构设计](DESIGN_ARCHITECTURE.md)
- [← 组件详细](DESIGN_COMPONENTS.md)
- [← 接口规格](DESIGN_API.md)

---

## 八、审核确认

请确认以下内容：

### 设计确认
- [ ] 架构设计保持不变（不简化）
- [ ] 文件管理保持不变（多文件）
- [ ] 标签系统扩展合理（添加 8 个新字段）
- [ ] 上传策略明确（手动触发，方便调试）
- [ ] 分类逻辑保持原设计（基于子代理的语义分类）

### 实施确认
- [ ] 开发计划合理
- [ ] 工时估算可接受
- [ ] 任务分解清晰
- [ ] 测试策略完整（TDD 模式，覆盖率 80%）
- [ ] 每阶段可独立测试
---

*文档版本: v2.4.0 | 最后更新: 2026-03-05*