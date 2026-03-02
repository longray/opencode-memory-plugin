# 接口规格与技术细节

> [← 组件详细](DESIGN_COMPONENTS.md) | [开发计划 →](DESIGN_ROADMAP.md)

---

## 一、Wrapper Service API 接口

### 1.1 健康检查

```
GET /api/health
```

**描述**：检查 Wrapper 服务及其依赖（SurrealDB、嵌入服务）的健康状态

**响应**：
```json
{
  "status": "ok",
  "timestamp": "2026-03-05T12:00:00Z",
  "latency": 15,
  "services": {
    "wrapper": "healthy",
    "surrealdb": "healthy",
    "embedding": "healthy",
    "allHealthy": true
  }
}
```

**错误响应**：
```json
{
  "status": "error",
  "error": "Service unavailable",
  "services": {
    "wrapper": "healthy",
    "surrealdb": "unreachable",
    "embedding": "healthy",
    "allHealthy": false
  }
}
```

---

### 1.2 语义搜索

```
POST /api/search
```

**描述**：执行语义向量搜索

**请求体**：
```json
{
  "query": "用户偏好的编码风格",
  "limit": 10,
  "threshold": 0.3,
  "filters": {
    "project_tag": "projectA"
  }
}
```

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| query | string | 是 | - | 搜索查询 |
| limit | number | 否 | 10 | 返回结果数量 |
| threshold | number | 否 | 0.3 | 相似度阈值 (0-1) |
| filters | object | 否 | - | 过滤条件 |

**响应**：
```json
{
  "success": true,
  "query": "用户偏好的编码风格",
  "count": 3,
  "results": [
    {
      "id": "memory:001",
      "content": "用户偏好使用 TypeScript 进行项目开发...",
      "score": 0.92,
      "project_tag": "projectA",
      "source": "MEMORY.md",
      "line": 15,
      "timestamp": "2026-03-05T10:30:00Z"
    },
    {
      "id": "memory:002",
      "content": "编码风格：使用 ESLint + Prettier...",
      "score": 0.85,
      "project_tag": "global",
      "source": "GLOBAL_MEMORY.md",
      "line": 8,
      "timestamp": "2026-03-01T15:20:00Z"
    }
  ]
}
```

---

### 1.3 上传记忆

```
POST /api/upload
```

**描述**：上传记忆条目到 SurrealDB

**请求体**：
```json
{
  "entries": [
    {
      "id": "local-001",
      "content": "用户偏好使用 TypeScript",
      "type": "preference",
      "tags": ["typescript", "style"],
      "project_tag": "projectA",
      "project_id": "github-org-repo",
      "project_name": "项目 A",
      "timestamp": "2026-03-05T12:00:00Z",
      "classification_confidence": 0.85,
      "classified_at": "2026-03-05T12:05:00Z",
      "metadata": {}
    }
  ]
}
```

|| 参数 | 类型 | 必填 | 说明 |
||------|------|------|------|
|| entries | array | 是 | 记忆条目数组 |

**Entry 对象**：
|| 字段 | 类型 | 必填 | 说明 |
||------|------|------|------|
|| id | string | 是 | 本地唯一标识 |
|| content | string | 是 | 记忆内容 |
|| type | string | 否 | 记忆类型 |
|| tags | array | 否 | 标签数组 |
|| project_tag | string | 否 | 项目标签 |
|| project_id | string | 否 | 项目唯一标识符 |
|| project_name | string | 否 | 项目可读名称 |
|| timestamp | string | 否 | 时间戳 |
|| classification_confidence | number | 否 | 分类置信度（0-1） |
|| classified_at | string | 否 | 分类时间戳 |
|| metadata | object | 否 | 额外元数据 |

**响应**：
```json
{
  "success": true,
  "count": 1,
  "ids": ["memory:001"],
  "failed": []
}
```

---

## 二、Memory Manager 内部接口

### 2.1 标签读取/更新

```javascript
// 读取标签
async function parseEntryTags(entryText) {
  const projectTagMatch = entryText.match(/\*\*project_tag\*\*:\s*(\S+)/);
  const uploadedMatch = entryText.match(/\*\*uploaded\*\*:\s*(\S+)/);
  
  return {
    project_tag: projectTagMatch ? projectTagMatch[1] : 'unclassified',
    uploaded: uploadedMatch ? uploadedMatch[1] : 'false'
  };
}

// 更新标签
async function updateEntryTag(entry, key, value) {
  const pattern = new RegExp(`(\\*\\*${key}\\*\\*:\\s*)\\S+`, 'g');
  return entry.replace(pattern, `$1${value}`);
}
```

### 2.2 项目检测规则

```javascript
const PROJECT_PATTERNS = [
  // 文件路径模式
  /\/workspaces\/([^\/]+)\//,
  /\/projects\/([^\/]+)\//,
  /\/repos\/([^\/]+)\//,
  
  // Git 仓库模式
  /git@github\.com:([^\/]+)\//,
  /https?:\/\/github\.com\/([^\/]+)\//,
  
  // 用户明确指定
  /project:\s*(\w+)/i,
];

function detectProjectTag(content, filePath) {
  // 1. 从文件路径检测
  for (const pattern of PROJECT_PATTERNS) {
    const match = filePath.match(pattern);
    if (match) return match[1];
  }
  
  // 2. 从内容检测
  for (const pattern of PROJECT_PATTERNS) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  
  // 3. 默认值
  return 'unclassified';
}
```

---

## 三、配置文件格式

### 3.1 扩展配置 (memory-config.json)

```json
{
  "version": "2.3.0",
    "localBackup": true,
    "enableAutoConsolidate": true,
    "consolidateIntervalMinutes": 5
  },
  "network": {
    "checkIntervalMs": 300000,
    "wrapperUrl": "http://localhost:3001",
    "timeoutMs": 5000,
    "enableAutoFallback": true
  },
  "semanticSearch": {
    "enabled": true,
    "defaultLimit": 10,
    "defaultThreshold": 0.3
  },
  "classifier": {
    "enabled": true,
    "autoClassify": false,
    "classifyIntervalMinutes": 5
  },
  "upload": {
    "batchSize": 20,
    "retryCount": 3,
    "retryDelayMs": 1000
  },
  "embedding": {
    "provider": "external",
    "endpoint": "http://localhost:18000/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B"
  },
  "projects": {}
}
```

### 3.2 项目配置 (projects.json)

```json
{
  "projects": {
    "global": {
      "id": "global",
      "name": "Global",
      "firstSeen": "2026-02-28T00:00:00Z",
      "lastSeen": "2026-03-05T20:00:00Z",
      "entryCount": 45,
      "uploadedCount": 40,
      "classificationConfidenceAvg": null
    },
    "projectA": {
      "id": "github-org-repo",
      "name": "Project A",
      "firstSeen": "2026-03-01T10:00:00Z",
      "lastSeen": "2026-03-05T15:30:00Z",
      "entryCount": 12,
      "uploadedCount": 10,
      "classificationConfidenceAvg": 0.85
    }
  }
}
```

---

## 四、健康状态类型定义

```typescript
interface HealthStatus {
  timestamp: string;           // ISO 时间戳
  latency: number;             // 响应延迟(毫秒)
  overall: 'healthy' | 'degraded' | 'unhealthy'; // 综合状态
  services: {
    wrapper: 'healthy' | 'unreachable' | 'unknown';
    surrealdb: 'healthy' | 'unreachable' | 'unknown';
    embedding: 'healthy' | 'unreachable' | 'unknown';
  ---

## 四、错误码定义

### 4.1 错误码列表

|| 错误码 | 描述 | HTTP 状态码 |
||--------|------|-------------|
|| `SUCCESS` | 操作成功 | 200 |
|| `INVALID_REQUEST` | 请求参数无效 | 400 |
|| `UNAUTHORIZED` | 未授权 | 401 |
|| `SERVICE_UNAVAILABLE` | 服务不可用 | 503 |
|| `NETWORK_ERROR` | 网络错误 | 500 |
|| `TIMEOUT` | 请求超时 | 408 |
|| `UPLOAD_FAILED` | 上传失败 | 500 |
|| `CLASSIFICATION_FAILED` | 分类失败 | 500 |

### 4.2 错误响应格式

```json
{
  "success": false,
  "errorCode": "UPLOAD_FAILED",
  "message": "Failed to upload memories",
  "details": {
    "failedCount": 2,
    "error": "Connection timeout"
  }
}
```

---

## 五、相关文档

- [← 设计概述](DESIGN_OVERVIEW.md)
- [← 架构设计](DESIGN_ARCHITECTURE.md)
- [← 组件详细](DESIGN_COMPONENTS.md)
- [开发计划 →](DESIGN_ROADMAP.md)

---

*文档版本: v2.4.0 | 最后更新: 2026-03-05*