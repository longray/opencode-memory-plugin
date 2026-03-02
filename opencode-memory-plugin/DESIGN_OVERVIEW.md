# OpenCode Memory Plugin - 智能记忆分类与远程语义搜索系统

> v2.4.0 设计文档 - 重构版（根据用户反馈优化）

## 文档导航（渐进式披露）

```
📖 建议阅读顺序：
│
├─► 1. DESIGN_OVERVIEW.md (本文档)
│   快速了解系统目标和架构
│
├─► 2. DESIGN_ARCHITECTURE.md
│   详细架构设计和组件关系
│
├─► 3. DESIGN_COMPONENTS.md
│   核心组件详细规格
│
├─► 4. DESIGN_API.md
│   接口规格和技术细节
│
└─► 5. DESIGN_ROADMAP.md
    开发计划和任务分解
```

---

## 一、设计目标

本系统旨在解决 **Bun 环境下无法使用本地向量搜索** 的问题，同时保证：

| 目标 | 描述 |
|------|------|
| **数据安全** | 记忆始终保存在本地 MD 文件，永不丢失 |
| **智能分类** | 自动识别记忆类型（全局 vs 项目） |
| **远程语义搜索** | 通过外部服务提供向量搜索能力 |
| **多层回退** | 网络异常时自动降级到本地搜索 |

---

## 二、核心原则

1. **本地优先** - 所有记忆先写入本地 MD 文件
2. **扩展标签系统** - 每条记忆包含 8 个元数据标签
3. **手动触发** - 新子代理通过命令手动触发
4. **无本地依赖** - 移除本地 sqlite-vec，使用远程服务
---

## 三、系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode 环境                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 子代理系统                                        │    │
│  │ @memory-automation │ @memory-consolidate │ 新代理 │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 核心库 (lib/)                                     │
│  │ memory-manager │ network-checker │ wrapper-client  │    │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 本地 MD 文件 (9个核心文件)                         │    │
│  │ GLOBAL_MEMORY.md | PROJECT_MEMORY.md | daily/     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↓ HTTP
┌─────────────────────────────────────────────────────────────┐
│              外部服务 (独立部署)                          │
│  Express HTTP Wrapper Service (端口: 3001)              │
│  → SurrealDB (向量数据库)                           │
│  → Embedding Service (localhost:18000)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、核心组件

| 组件 | 类型 | 职责 |
|------|------|------|
| **memory-manager** | 核心库 | 管理本地 MD 文件读写，添加标签 |
| **network-checker** | 核心库 | 定时检查外部服务健康状态 |
| **wrapper-client** | 核心库 | HTTP 客户端调用外部服务 |
| **memory-classifier** | 子代理 | 手动触发，分类记忆项目标签 |

---

## 五、标签系统

### 扩展标签系统

每条记忆条目包含多个元数据标签：

```markdown
## General Entry

**Date**: 2026-03-02T12:44:34.581Z
**Type**: general
**Tags**: test, plugin, memory
**project_tag**: unclassified | global | projectA | ...
**project_id**: <unique_id> | null
**project_name**: <readable_name> | null
**uploaded**: false | true | failed
**upload_timestamp**: <ISO_timestamp> | null
**upload_error**: <error_message> | null
**classification_confidence**: <0.0-1.0> | null
**classified_at**: <ISO_timestamp> | null

content here
```

|| 标签 | 可选值 | 默认值 | 说明 |
||------|--------|---------|------|
|| `project_tag` | `unclassified`, `global`, `projectA`, ... | `unclassified` | 记忆所属项目（分类） |
|| `project_id` | `<unique_id>` 或 `null` | `null` | 项目唯一标识符（如：github-org-repo） |
|| `project_name` | `<readable_name>` 或 `null` | `null` | 项目可读名称 |
|| `uploaded` | `false`, `true`, `failed` | `false` | 上传状态 |
|| `upload_timestamp` | `<ISO_timestamp>` 或 `null` | `null` | 上传时间戳 |
|| `upload_error` | `<error_message>` 或 `null` | `null` | 上传失败原因 |
|| `classification_confidence` | `<0.0-1.0>` 或 `null` | `null` | 分类置信度（0-1） |
|| `classified_at` | `<ISO_timestamp>` 或 `null` | `null` | 分类时间戳 |

## 六、关键流程

### 写入流程
```
用户调用 memory_write
        ↓
Memory Manager 写入本地 MD（添加默认标签）
        ↓
返回成功响应
```

### 分类流程（手动触发）
```
@memory-classifier classify unclassified memories
        ↓
扫描所有 MD 文件，查找未分类记忆
        ↓
基于语义识别项目标签（子代理）
        ↓
更新 project_tag 和 classification_confidence
```

### 上传流程（手动触发）
```
@memory-upload upload unclassified entries
        ↓
检查网络健康状态
        ↓
获取待上传的记忆（uploaded: false）
        ↓
┌──────────────────────────────────────┐
│  批量上传（每批 20 条）         │
├──────────────────────────────────────┤
│  成功 → 更新 uploaded: true     │
│  失败 → 更新 uploaded: failed   │
│         重试 3 次               │
│  超时 → 更新 uploaded: failed   │
└──────────────────────────────────────┘
        ↓
更新 uploaded 标记和上传时间戳
        ↓
记录失败条目和错误信息
```

### 搜索流程
```
用户调用 vector_memory_search
        ↓
检查网络健康状态
        ↓
健康 → Wrapper Client 语义搜索
异常 → 本地 BM25/关键词搜索
```

---

## 七、相关文档

- [详细架构设计 →](DESIGN_ARCHITECTURE.md)
- [组件详细规格 →](DESIGN_COMPONENTS.md)
- [接口规格 →](DESIGN_API.md)
- [开发计划 →](DESIGN_ROADMAP.md)

---

## 八、审核确认

请确认以下内容：

- [ ] 系统架构设计合理
- [ ] 组件职责清晰
- [ ] 标签系统满足需求
- [ ] 流程设计符合预期
- [ ] 开发计划可行

---

*文档版本: v2.4.0 | 最后更新: 2026-03-05*