# WebSocket 协议文档（客户端视角）

**版本**: v0.1  
**日期**: 2026-04-11  
**状态**: 草案

---

## 1. 概述

本文档从插件端（客户端）角度描述 WebSocket 通信协议，包括状态机、消息处理、错误处理和重连策略。

---

## 2. 客户端状态机

```
┌─────────┐    connect()     ┌──────────┐
│  CLOSED │ ───────────────→ │ CONNECTING│
└─────────┘                  └──────────┘
                                    │
                                    │ connected
                                    ↓
┌─────────┐    disconnect()  ┌──────────┐
│  CLOSED │ ←─────────────── │ CONNECTED│
└─────────┘                  └──────────┘
       ↑                            │
       │      reconnect()           │ error
       └────────────────────────────┘
```

### 2.1 状态定义

| 状态             | 说明                     |
| ---------------- | ------------------------ |
| **CLOSED**       | 初始状态或连接已关闭     |
| **CONNECTING**   | 正在建立连接             |
| **CONNECTED**    | 连接已建立，可以收发消息 |
| **RECONNECTING** | 连接断开，正在重连       |

---

## 3. 消息类型处理

### 3.1 心跳消息

**发送**:

```javascript
{"type": "ping", "timestamp": 1712812800000}
```

**接收**:

```javascript
{"type": "pong", "timestamp": 1712812800000}
```

**处理逻辑**:

1. 每 30s 发送 ping
2. 等待 pong 响应（超时 5s）
3. 连续 2 次超时触发重连

### 3.2 ACK 消息

**发送（需要 ACK 的消息）**:

```javascript
{
  "type": "message",
  "_msgId": "uuid-v4",
  "_requiresAck": true,
  "timestamp": 1712812800000,
  "payload": { ... }
}
```

**接收（ACK 响应）**:

```javascript
{"type": "ack", "_ackId": "uuid-v4", "timestamp": 1712812800000}
```

**处理逻辑**:

1. 发送消息时生成 `_msgId`
2. 等待 ACK（超时 5s）
3. 超时后重试（最多 3 次）
4. 达到最大重试次数后 reject

### 3.3 DIFF 消息

**接收**:

```javascript
{
  "type": "diff",
  "patch": [
    {"op": "replace", "path": "/content", "value": "..."}
  ],
  "timestamp": 1712812800000
}
```

**处理逻辑**:

1. 接收 JSON Patch（RFC 6902）
2. 应用到本地缓存
3. 触发更新事件

### 3.4 错误消息

**接收**:

```javascript
{
  "type": "error",
  "code": "SESSION_EXPIRED|RATE_LIMITED|INTERNAL_ERROR",
  "message": "...",
  "timestamp": 1712812800000
}
```

**处理逻辑**:

| 错误码          | 处理                   |
| --------------- | ---------------------- |
| UNAUTHORIZED    | 重新获取 token 后重连  |
| SESSION_EXPIRED | 使用新 session_id 重连 |
| RATE_LIMITED    | 退避后重试             |
| INTERNAL_ERROR  | 指数退避后重连         |

---

## 4. 重连策略

### 4.1 指数退避

**统一参数**（与后端一致）:

| 重试次数 | 延迟时间         |
| -------- | ---------------- |
| 1        | 1s               |
| 2        | 2s               |
| 3        | 4s               |
| 4        | 8s               |
| 5        | 16s              |
| 6        | 32s              |
| 7        | 64s              |
| 8        | 128s             |
| 9        | 256s             |
| 10+      | **300s（最大）** |

### 4.2 随机抖动

添加随机抖动避免惊群效应：

```javascript
delay = baseDelay + random(0, 1000); // 0-1s 随机抖动
```

### 4.3 最大重试次数

- 连接重试：最多 **10 次**（与后端一致）
- ACK 重试：最多 3 次

---

## 5. 错误处理

### 5.1 连接错误

| 错误         | 处理         |
| ------------ | ------------ |
| ECONNREFUSED | 指数退避重连 |
| ETIMEDOUT    | 指数退避重连 |
| EHOSTUNREACH | 指数退避重连 |

### 5.2 消息错误

| 错误         | 处理             |
| ------------ | ---------------- |
| INVALID_JSON | 记录日志，不重试 |
| UNKNOWN_TYPE | 记录日志，不重试 |

---

## 6. API 设计

### 6.1 ReliableWebSocketClient

```javascript
class ReliableWebSocketClient {
  constructor(options) {
    // options: url, token, tenantId, sessionId, onMessage, onError
  }

  async connect() // 建立连接
  async disconnect() // 断开连接
  async send(message) // 发送消息（无需 ACK）
  async sendWithAck(message, timeout=5000, maxRetries=3) // 发送消息（需要 ACK）
  subscribe(query) // 订阅 DIFF
  unsubscribe(subscriptionId) // 取消订阅
}
```

### 6.2 AckManager

```javascript
class AckManager {
  async sendWithAck(ws, message, timeout, maxRetries)
  handleAck(ackId) // 处理收到的 ACK
  clearPending() // 清除待确认消息（重连时调用）
}
```

---

## 7. 配置

**统一配置**（与后端一致）:

```javascript
{
  websocket: {
    url: 'ws://localhost:18008/ws/memories/live',
    heartbeatInterval: 30000, // 30s
    heartbeatTimeout: 5000, // 5s
    reconnectBaseDelay: 1000, // 1s
    reconnectMaxDelay: 300000, // 300s（与后端一致）
    reconnectMaxAttempts: 10,
    ackTimeout: 5000, // 5s
    ackMaxRetries: 3,
    offlineQueueMaxSize: 1000
  }
}
```

---

## 8. 已确认事项 ✅

| 参数         | 值                                | 状态      |
| ------------ | --------------------------------- | --------- |
| 心跳间隔     | 30s                               | ✅ 已确认 |
| 心跳超时     | 5s                                | ✅ 已确认 |
| 指数退避     | 1→2→4→8→16→32→64→128→256→**300s** | ✅ 已确认 |
| 最大重试次数 | 10 次                             | ✅ 已确认 |
| ACK 超时     | 5s                                | ✅ 已确认 |
| ACK 最大重试 | 3 次                              | ✅ 已确认 |
| 离线队列上限 | 1000 条                           | ✅ 已确认 |

---

_文档版本: v0.1_  
_更新日期: 2026-04-11_
