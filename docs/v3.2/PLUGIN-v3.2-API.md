# 插件端 v3.2 API 规范

> **版本**: v3.2.0  
> **日期**: 2026-04-10  
> **状态**: 实施版  
> **目标**: 定义插件端与后端 v3.2 的 API 接口

---

## 目录

1. [基础配置](#1-基础配置)
2. [Memory API](#2-memory-api)
3. [Code Analysis API](#3-code-analysis-api)
4. [WebSocket API](#4-websocket-api)
5. [错误处理](#5-错误处理)

---

## 1. 基础配置

### 1.1 服务端点

```javascript
// config.js
export const config = {
  // v3.2 新端口
  API_BASE: "http://localhost:18008/api/v1",
  WS_BASE: "ws://localhost:18008/api/v1/ws",

  // 向后兼容
  LEGACY_API_BASE: "http://localhost:17999/api/v1",

  // 认证
  API_KEY: process.env.OPENCODE_API_KEY,

  // 超时
  TIMEOUT: 30000,
  WS_HEARTBEAT_INTERVAL: 30000,
};
```

### 1.2 请求封装

```javascript
// lib/api-client.js
import { config } from "./config.js";

export class ApiClient {
  constructor() {
    this.baseUrl = config.API_BASE;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.API_KEY}`,
    };
  }

  async request(method, path, data = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: this.headers,
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }

  get(path) {
    return this.request("GET", path);
  }

  post(path, data) {
    return this.request("POST", path, data);
  }

  patch(path, data) {
    return this.request("PATCH", path, data);
  }

  delete(path) {
    return this.request("DELETE", path);
  }
}
```

---

## 2. Memory API

### 2.1 创建记忆

```javascript
// POST /api/v1/memories
const memory = await apiClient.post('/memories', {
  type: 'code',
  title: 'utils.ts',
  abstract: 'Utility functions for file operations',
  overview: {
    language: 'typescript',
    lines: 150,
    functions: 5
  },
  content: 'full content here...',
  project: 'my-project',
  tenant_id: 'default',
  tags: ['typescript', 'utils']
});

// 响应
{
  "id": "entity:01HQ...",
  "type": "code",
  "created_at": "2026-04-10T10:30:00Z"
}
```

### 2.2 搜索记忆

```javascript
// GET /api/v1/memories/search
const results = await apiClient.get('/memories/search?query=file+operations&project=my-project');

// 响应
{
  "hits": [
    {
      "id": "entity:01HQ...",
      "title": "utils.ts",
      "abstract": "Utility functions...",
      "score": 0.95
    }
  ],
  "total": 1
}
```

### 2.3 获取记忆

```javascript
// GET /api/v1/memories/{id}
const memory = await apiClient.get('/memories/entity:01HQ...');

// 响应
{
  "id": "entity:01HQ...",
  "type": "code",
  "title": "utils.ts",
  "abstract": "Utility functions...",
  "overview": {...},
  "content": "...",
  "atoms": ["atom:func-1", "atom:func-2"]
}
```

### 2.4 更新记忆

```javascript
// PATCH /api/v1/memories/{id}
await apiClient.patch("/memories/entity:01HQ...", {
  abstract: "Updated abstract",
  tags: ["typescript", "utils", "file"],
});
```

### 2.5 删除记忆

```javascript
// DELETE /api/v1/memories/{id}
await apiClient.delete("/memories/entity:01HQ...");
```

---

## 3. Code Analysis API

### 3.1 触发预计算

```javascript
// POST /api/v1/code/precompute
const result = await apiClient.post('/code/precompute', {
  file_path: 'src/utils.ts',
  source_code: '...',
  language: 'typescript',
  tenant_id: 'default'
});

// 响应
{
  "entity_id": "entity:code-src-utils",
  "atoms_count": 5,
  "duration_ms": 120,
  "memory_mb": 15.5,
  "success": true
}
```

### 3.2 代码导航

```javascript
// GET /api/v1/code/navigate
const result = await apiClient.get('/code/navigate?symbol=analyzeCode&action=goto_definition');

// 响应
{
  "symbol": "analyzeCode",
  "file_path": "src/utils.ts",
  "line": 85,
  "column": 10
}
```

### 3.3 爆炸半径分析

```javascript
// GET /api/v1/code/impact
const result = await apiClient.get('/code/impact?symbol=analyzeCode&depth=2&direction=both');

// 响应
{
  "symbol": "analyzeCode",
  "impacted_symbols": [
    {"name": "parseSync", "depth": 1},
    {"name": "validateConfig", "depth": 2}
  ]
}
```

### 3.4 代码搜索

```javascript
// GET /api/v1/code/search
const results = await apiClient.get('/code/search?query=async+file&language=typescript&hybrid=true');

// 响应
{
  "hits": [
    {
      "id": "atom:func-analyzeCode",
      "name": "analyzeCode",
      "signature": "async analyzeCode(filePath: string)",
      "score": 0.92
    }
  ]
}
```

---

## 4. WebSocket API

### 4.1 连接建立

```javascript
// lib/websocket-client.js
import WebSocket from "ws";
import { config } from "./config.js";

export class MemoryWebSocket {
  constructor() {
    this.url = `${config.WS_BASE}?token=${config.API_KEY}&tenant_id=default`;
    this.ws = null;
    this.subscriptions = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        console.log("WebSocket connected");
        resolve();
      });

      this.ws.on("message", (data) => {
        const message = JSON.parse(data);
        this.handleMessage(message);
      });

      this.ws.on("error", reject);
    });
  }

  handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case "update":
        this.handleUpdate(data);
        break;
      case "diff":
        this.handleDiff(data);
        break;
      case "ack":
        this.handleAck(data);
        break;
    }
  }
}
```

### 4.2 订阅变更

```javascript
// 订阅实体变更
subscribe(entityId) {
  const message = {
    action: 'subscribe',
    query: `LIVE SELECT * FROM entity WHERE id = "${entityId}"`
  };

  this.ws.send(JSON.stringify(message));
  this.subscriptions.set(entityId, callback);
}

// 订阅 DIFF 模式
subscribeDiff(entityId) {
  const message = {
    action: 'subscribe',
    query: `LIVE SELECT DIFF FROM entity WHERE id = "${entityId}"`
  };

  this.ws.send(JSON.stringify(message));
}
```

### 4.3 发送带确认的消息

```javascript
// 发送消息并等待确认
async sendWithAck(data, timeout = 5000) {
  const messageId = `msg-${Date.now()}`;

  const message = {
    ...data,
    _msgId: messageId,
    _requiresAck: true
  };

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Ack timeout'));
    }, timeout);

    this.pendingAcks.set(messageId, (ackData) => {
      clearTimeout(timeoutId);
      resolve(ackData);
    });

    this.ws.send(JSON.stringify(message));
  });
}
```

---

## 5. 错误处理

### 5.1 错误码

| 状态码 | 含义       | 处理建议     |
| ------ | ---------- | ------------ |
| 200    | 成功       | -            |
| 400    | 请求错误   | 检查参数     |
| 401    | 未授权     | 检查 API Key |
| 404    | 未找到     | 检查 ID      |
| 500    | 服务器错误 | 重试或报告   |

### 5.2 错误处理示例

```javascript
// lib/error-handler.js
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function handleApiError(error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        console.error("Authentication failed. Check API key.");
        break;
      case 404:
        console.error("Resource not found.");
        break;
      case 500:
        console.error("Server error. Retrying...");
        // 重试逻辑
        break;
      default:
        console.error(`API error ${error.status}:`, error.message);
    }
  } else {
    console.error("Network error:", error.message);
  }
}
```

---

## 参考文档

- [BACKEND-v3.2-IMPLEMENTATION.md](./BACKEND-v3.2-IMPLEMENTATION.md)
- [PLUGIN-v3.2-IMPLEMENTATION.md](./PLUGIN-v3.2-IMPLEMENTATION.md)
- [API-CONTRACT.md](../API-CONTRACT.md)

---

_文档版本: v3.2.0_  
_最后更新: 2026-04-10_
