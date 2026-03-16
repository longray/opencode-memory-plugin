# 详细架构设计

> [← 返回概述](DESIGN_OVERVIEW.md) | [组件详细 →](DESIGN_COMPONENTS.md)

---

## 一、整体架构

### 1.1 完整架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OpenCode 环境                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      子代理系统                                   │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │   │
│  │  │@memory-automation │  │@memory-consolidate │ │@memory-classifier│  │   │
│  │  │  (自动触发)      │  │  (手动触发)      │  │  (手动触发)   │  │   │
│  │  │description匹配   │  │ @memory-consolidate│ │@memory-classifier│  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     核心库 (lib/)                               │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │   │
│  │  │ memory-manager │  │network-checker │  │wrapper-client │   │   │
│  │  │   (记忆管理)   │  │  (网络检查)    │  │  (HTTP客户端) │   │   │
│  │  └────────────────┘  └────────────────┘  └────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              本地 MD 文件 (9个核心文件 + daily/)                   │   │
│  │                                                                  │   │
│  │  GLOBAL_MEMORY.md      → 全局记忆 (project_tag: global)         │   │
│  │  PROJECT_MEMORY.md    → 项目记忆 (project_tag: projectA/B/C)   │   │
│  │  MEMORY.md           → 通用记忆 (向后兼容)                    │   │
│  │  SOUL.md            → AI 人格                                 │   │
│  │  AGENTS.md          → 代理指令                                │   │
│  │  USER.md            → 用户配置                                │   │
│  │  IDENTITY.md        → 身份定义                                │   │
│  │  TOOLS.md          → 工具说明                                │   │
│  │  daily/             → 每日日志                               │   │
│  │                                                                  │   │
│  │  每个文件包含双标签: project_tag + uploaded                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                      ↓ HTTP 调用
┌─────────────────────────────────────────────────────────────────────────┐
│                      外部服务 (独立部署)                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                Express HTTP Wrapper Service                      │   │
│  │                 (端口: 3001, 独立进程)                     │   │
│  │                                                                 │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │/api/health  │  │/api/search  │  │/api/upload │        │   │
│  │  │ (健康检查)   │  │ (语义搜索)   │  │  (上传记忆)  │        │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │   │
│  │                                                                 │   │
│  │  ┌──────────────────────────────────────────────────────────┐      │   │
│  │  │            SurrealQL 内嵌 HTTP 调用嵌入服务           │      │   │
│  │  │  → http::post('http://localhost:18000/embeddings')│      │   │
│  │  └──────────────────────────────────────────────────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                  │
│         ┌────────────────────────┬────────────────────────┐             │
│         ↓                    ↓                    ↓             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  SurrealDB  │      │  Embedding  │                   │
│  │ (向量存储)  │      │   Service   │                   │
│  └──────────────┘      │(localhost:  │                   │
│                         │   18000)   │                   │
│                         └──────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、组件关系

### 2.1 数据流图

```
用户操作                    核心库                    外部服务
   │                         │                         │
   │                         │                         │
   ├─ memory_write ────────→│                         │
   │  (写入本地MD)         │                         │
   │                         │                         │
   │  @memory-classifier ──→│                         │
   │  (手动命令触发)       │                         │
   │                         │                         │
   ├─ memory_read ────────→│                         │
   │  (读取本地MD)         │                         │
   │                         │                         │
   │  @network-checker ────→│                         │
   │  (定时 1分钟)        │                         │
   │                         │                         │
   ├─ vector_search ─────→│───HTTP POST────────→│
   │                         │  /api/search        │
   │                         │                    │
   │  (网络异常?)          │                    │
   │←──────────────────────│                    │
   │  (降级到本地搜索)      │                    │
   │                         │                         │
```

---

## 三、子代理系统

### 3.1 现有子代理（保持不变）

| 子代理                | 触发方式                    | 职责                       |
| --------------------- | --------------------------- | -------------------------- |
| `@memory-automation`  | 自动（description 匹配）    | 自动分析对话并保存重要信息 |
| `@memory-consolidate` | 手动（@memory-consolidate） | 合并和归档日常日志         |

### 3.2 新增子代理

| 子代理               | 触发方式                            | 职责             |
| -------------------- | ----------------------------------- | ---------------- |
| `@memory-classifier` | 手动（@memory-classifier classify） | 分类未标记的记忆 |

**新子代理调用示例：**

```bash
@memory-classifier classify unclassified memories
```

---

## 四、标签系统详解

### 扩展标签系统定义

```markdown
## General Entry

**Date**: 2026-03-05T12:44:34.581Z
**Type**: general
**Tags**: test, plugin, memory
**project_tag**: unclassified | global | projectA | projectB | ...
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
||------|--------|--------|------|
|| `project_tag` | `unclassified`, `global`, `projectA`, ... | `unclassified` | 记忆所属项目（分类） |
|| `project_id` | `<unique_id>` 或 `null` | `null` | 项目唯一标识符（如：github-org-repo） |
|| `project_name` | `<readable_name>` 或 `null` | `null` | 项目可读名称 |
|| `uploaded` | `false`, `true`, `failed` | `false` | 上传状态 |
|| `upload_timestamp` | `<ISO_timestamp>` 或 `null` | `null` | 上传时间戳 |
|| `upload_error` | `<error_message>` 或 `null` | `null` | 上传失败原因 |
|| `classification_confidence` | `<0.0-1.0>` 或 `null` | `null` | 分类置信度（0-1） |
|| `classified_at` | `<ISO_timestamp>` 或 `null` | `null` | 分类时间戳 |

### 4.2 项目标签识别规则（规则 + LLM 混合）

```javascript
// 规则 + LLM 辅助分类

class MemoryClassifier {
  classify(content, filePath) {
    // 1. 规则分类（快速）
    const ruleBased = this.classifyByRules(content, filePath);
    if (ruleBased.confidence > 0.8) {
      return ruleBased;
    }

    // 2. LLM 辅助分类（慢速但准确）
    return this.classifyByLLM(content);
  }

  classifyByRules(content, filePath) {
    const PROJECT_PATTERNS = [
      // 文件路径模式
      /\/workspaces\/([^\/]+)\//, // /workspaces/projectA/
      /\/projects\/([^\/]+)\//, // /projects/projectB/
      /\/repos\/([^\/]+)\//, // /repos/myproject/

      // Git 仓库模式
      /git@github\.com:([^\/]+)\//, // git@github.com:org/repo
      /https?:\/\/github\.com\/([^\/]+)\//, // https://github.com/org/repo

      // 用户明确指定
      /project:\s*(\w+)/i, // project: myproject
    ];

    // 尝试匹配规则
    for (const pattern of PROJECT_PATTERNS) {
      const match = filePath?.match(pattern);
      if (match) {
        return { tag: match[1], confidence: 0.85, method: 'rule' };
      }
    }

    // 未匹配到规则
    return { tag: 'unclassified', confidence: 0.0, method: 'rule' };
  }

  classifyByLLM(content) {
    // 调用子代理进行语义分类
    // 返回格式：{ tag: 'projectA', confidence: 0.92, method: 'llm' }
  }
}
```

### 4.3 动态项目积累

```json
// ~/.opencode/memory/projects.json
{
  "projects": {
    "projectA": {
      "id": "github-org-repo",
      "name": "项目 A",
      "firstSeen": "2026-03-01T10:00:00Z",
      "lastSeen": "2026-03-05T15:30:00Z",
      "entryCount": 15,
      "uploadedCount": 10,
      "classificationConfidenceAvg": 0.85
    },
    "global": {
      "id": "global",
      "name": "Global",
      "firstSeen": "2026-02-28T00:00:00Z",
      "lastSeen": "2026-03-05T20:00:00Z",
      "entryCount": 45,
      "uploadedCount": 40,
      "classificationConfidenceAvg": null
    }
  }
}
```

---

## 五、网络检查机制

### 5.1 检查流程

```
定时器 (默认 5 分钟)
     ↓
调用 /api/health
     ↓
┌──────────────────────────────────────┐
│        返回健康状态                    │
├──────────────────────────────────────┤
│ healthy   → 启用语义搜索和上传         │
│ degraded  → 降级到本地搜索             │
│ unhealthy → 保留本地，下次重试          │
└──────────────────────────────────────┘
     ↓
更新内存中的健康状态
     ↓
通知其他组件
```

### 5.2 健康状态类型

```typescript
interface HealthStatus {
  timestamp: string; // 检查时间
  latency: number; // 响应延迟(ms)
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    wrapper: 'healthy' | 'unreachable' | 'unknown';
    surrealdb: 'healthy' | 'unreachable' | 'unknown';
    embedding: 'healthy' | 'unreachable' | 'unknown';
  };
}
```

---

## 六、搜索策略

### 6.1 搜索流程

```
用户调用 memory_search
     ↓
检查网络健康状态
     ↓
┌──────────────────────────────────────┐
│  网络健康?                            │
├──────────────────────────────────────┤
│  YES → Wrapper Client 语义搜索       │
│         ↓                            │
│      返回远程结果                   │
│                                      │
│  NO  → 本地 BM25/关键词搜索        │
│         ↓                            │
│      返回本地结果                   │
└──────────────────────────────────────┘
```

### 6.2 降级策略

| 状态      | 语义搜索 | 上传 | 本地搜索 |
| --------- | -------- | ---- | -------- |
| healthy   | ✅       | ✅   | ✅       |
| degraded  | ❌       | ❌   | ✅       |
| unhealthy | ❌       | ❌   | ✅       |

---

## 七、文件组织

```
~/.opencode/memory/
├── GLOBAL_MEMORY.md      # 全局记忆 (project_tag: global)
├── PROJECT_MEMORY.md    # 项目记忆 (project_tag: projectA/B/C...)
├── MEMORY.md           # 通用记忆 (向后兼容)
├── SOUL.md             # AI 人格
├── AGENTS.md           # 代理指令
├── USER.md             # 用户配置
├── IDENTITY.md         # 身份定义
├── TOOLS.md            # 工具说明
├── daily/              # 每日日志
│   ├── 2026-03-05.md
│   └── ...
├── projects.json       # 项目配置（动态积累）
└── memory-config.json  # 记忆配置
```

---

## 八、性能优化

### 8.1 文件读写优化

**缓存策略**：

- 缓存文件内容，减少重复读取
- 使用内存缓存，设置合理的过期时间（如 5 分钟）
- 批量更新标签，减少文件写入次数

**流式处理**：

- 大文件使用流式读取，避免一次性加载到内存
- 使用 Node.js 的 `fs.createReadStream` 和 `fs.createWriteStream`

### 8.2 网络请求优化

**连接池**：

- 复用 HTTP 连接，减少连接建立开销
- 使用 `http.Agent` 或 `https.Agent` 配置连接池

**指数退避**：

- 网络请求失败时使用指数退避重试策略
- 避免雪崩效应

**批量上传**：

- 批量上传记忆（每批 20 条），减少请求次数
- 并发控制（最多 5 个并发请求）

### 8.3 搜索优化

**结果缓存**：

- 缓存搜索结果，相同查询直接返回
- 缓存过期时间：10 分钟

**索引加速**：

- 为本地搜索建立索引（如倒排索引）
- 加速关键词搜索

**分页**：

- 实现分页，避免一次性返回大量结果
- 默认每页 10 条，支持自定义

---

## 九、安全考虑

### 9.1 数据安全

**本地优先**：

- 所有记忆始终保存在本地 MD 文件
- 外部服务不可用时，本地数据不受影响

**加密传输**：

- 上传时使用 HTTPS 加密传输
- 验证 SSL 证书，防止中间人攻击

**敏感信息过滤**：

- 上传前过滤敏感信息（如密码、API 密钥）
- 使用正则表达式识别敏感信息

### 9.2 访问控制

**认证机制**：

- Wrapper Service 实现基本的认证机制（如 API Key）
- 支持环境变量配置 API Key

**速率限制**：

- 限制 API 访问频率（如每分钟 100 次请求）
- 防止滥用和 DDoS 攻击

**访问日志**：

- 记录所有 API 访问日志
- 包含时间戳、IP 地址、请求内容

### 9.3 错误处理

**错误信息**：

- 不泄露敏感信息到错误消息
- 使用通用错误消息（如 "Upload failed" 而非 "Database error"）

**上传失败处理**：

- 上传失败时保留本地数据
- 记录失败原因和错误信息

**网络异常处理**：

- 网络异常时降级到本地搜索
- 不暴露内部错误信息

---

## 十、部署指南

### 10.1 本地部署

**前提条件**：

- Node.js 16+
- npm 或 yarn
- SurrealDB 1.0+
- Embedding Service（localhost:18000）

**部署步骤**：

1. 克隆仓库
2. 安装依赖：`npm install`
3. 配置环境变量：复制 `.env.example` 到 `.env`
4. 启动 Wrapper Service：`npm run start:wrapper`
5. 验证服务：`curl http://localhost:3001/api/health`

### 10.2 Docker 部署

**Docker Compose**：

```yaml
version: '3.8'
services:
  wrapper:
    build: ./wrapper-service
    ports:
      - '3001:3001'
    depends_on:
      - surrealdb
      - embedding
    environment:
      - SURREALDB_URL=ws://surrealdb:8000/rpc
      - EMBEDDING_URL=http://embedding:18000/v1/embeddings

  surrealdb:
    image: surrealdb/surrealdb:latest
    ports:
      - '8000:8000'
    volumes:
      - surrealdb_data:/data

  embedding:
    image: your-embedding-service:latest
    ports:
      - '18000:18000'

volumes:
  surrealdb_data:
```

**启动命令**：

```bash
docker-compose up -d
```

### 10.3 环境变量配置

**.env.example**：

```env
# Wrapper Service
PORT=3001
WRAPPER_API_KEY=your-api-key-here

# SurrealDB
SURREALDB_URL=ws://localhost:8000/rpc
SURREALDB_USER=root
SURREALDB_PASS=root

# Embedding Service
EMBEDDING_URL=http://localhost:18000/v1/embeddings
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B
```

---

## 十一、监控和日志

### 11.1 日志级别

**日志级别**：

- `DEBUG`: 详细调试信息
- `INFO`: 一般信息
- `WARN`: 警告信息
- `ERROR`: 错误信息
- `FATAL`: 致命错误

**日志格式**：

```json
{
  "timestamp": "2026-03-05T12:00:00Z",
  "level": "INFO",
  "component": "MemoryManager",
  "message": "Successfully wrote memory entry",
  "metadata": {
    "entryId": "local-001",
    "projectTag": "projectA"
  }
}
```

### 11.2 性能监控

**关键指标**：

- 请求延迟（P50, P95, P99）
- 请求成功率
- 错误率
- 内存使用
- CPU 使用

**监控端点**：

```
GET /api/metrics
```

**响应**：

```json
{
  "uptime": "5d 3h 12m",
  "requests": {
    "total": 10000,
    "success": 9850,
    "error": 150,
    "successRate": 0.985
  },
  "latency": {
    "p50": 50,
    "p95": 100,
    "p99": 200
  },
  "resources": {
    "memory": "512MB",
    "cpu": "25%"
  }
}
```

---

## 十二、版本兼容性

### 12.1 版本号规则

**格式**：`主版本.次版本.修订版本`（如 2.3.0）

**版本变化规则**：

- **主版本（Major）**：不兼容的 API 变更
- **次版本（Minor）**：向后兼容的功能新增
- **修订版本（Patch）**：向后兼容的问题修复

### 12.2 兼容性矩阵

| 版本  | API 兼容性 | 配置兼容性 | 数据格式兼容性 |
| ----- | ---------- | ---------- | -------------- |
| 2.0.x | ❌         | ❌         | ❌             |
| 2.1.x | ✅         | ✅         | ✅             |
| 2.2.x | ✅         | ✅         | ✅             |
| 2.3.x | ✅         | ✅         | ✅             |
| 2.4.x | ✅         | ✅         | ✅             |

### 12.3 升级指南

**从 2.3.x 升级到 2.4.x**：

1. 更新 `memory-config.json` 中的 `version` 字段
2. 更新 `projects.json` 格式（添加新字段）
3. 重新分类所有记忆（`@memory-classifier classify`）
4. 上传所有记忆（`@memory-upload upload`）

---

## 十三、相关文档

_文档版本: v2.4.0 | 最后更新: 2026-03-05_
