# 插件端 v3.2 实施指南

> **版本**: v3.2.0  
> **日期**: 2026-04-10  
> **状态**: 实施版  
> **目标**: 升级插件端依赖，适配后端 v3.2

---

## 目录

1. [依赖升级](#1-依赖升级)
2. [配置更新](#2-配置更新)
3. [WebSocket 客户端](#3-websocket-客户端)
4. [测试验证](#4-测试验证)

---

## 1. 依赖升级

### 1.1 package.json 更新

```json
{
  "name": "@csuwl/opencode-memory-plugin",
  "version": "3.2.0",
  "dependencies": {
    "@opencode-ai/plugin": "^1.0.0",
    "chokidar": "^5.0.0",
    "oxc-parser": "^0.121.0",

    "ws": "^8.20.0",
    "pino": "^9.5.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.13",
    "pino-pretty": "^13.0.0"
  }
}
```

### 1.2 安装依赖

```bash
npm install
```

---

## 2. 配置更新

### 2.1 环境变量配置

```javascript
// lib/config.js
import dotenv from "dotenv";

dotenv.config();

export const config = {
  // 服务端口（v3.2 更新）
  API_PORT: process.env.API_PORT || 18008,
  API_HOST: process.env.API_HOST || "localhost",

  // WebSocket
  WS_HEARTBEAT_INTERVAL: 30000,
  WS_ACK_TIMEOUT: 5000,

  // 日志
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // 向后兼容
  LEGACY_PORT: 17999,
};
```

### 2.2 WrapperClient 更新

```javascript
// lib/wrapper-client.js
import { config } from "./config.js";

export class WrapperClient {
  constructor(options = {}) {
    this.port = options.port || config.API_PORT;
    this.host = options.host || config.API_HOST;
    this.baseUrl = `http://${this.host}:${this.port}/api/v1`;
  }

  // ... 其他方法
}
```

---

## 3. WebSocket 客户端

### 3.1 ReliableWebSocketClient

```javascript
// lib/websocket-client.js
import WebSocket from "ws";
import { config } from "./config.js";

export class ReliableWebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.maxMissedPongs = 2;
    this.baseDelay = 1000;
    this.maxDelay = 300000;
    this.maxRetries = 10;
    this.retryCount = 0;

    this.ws = null;
    this.connected = false;
    this.missedPongs = 0;
    this.heartbeatTimer = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on("open", () => {
        this.connected = true;
        this.retryCount = 0;
        this.startHeartbeat();
        resolve();
      });

      this.ws.on("message", (data) => {
        const msg = JSON.parse(data);

        if (msg.type === "pong") {
          this.missedPongs = 0;
        }

        if (this.onMessage) {
          this.onMessage(msg);
        }
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        reject(err);
      });
    });
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.missedPongs >= this.maxMissedPongs) {
        this.ws.close();
        return;
      }

      this.ws.send(
        JSON.stringify({
          type: "ping",
          timestamp: Date.now(),
        }),
      );

      this.missedPongs++;
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.retryCount >= this.maxRetries) {
      console.error("Max retries exceeded");
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay,
    );

    this.retryCount++;
    console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount})`);

    setTimeout(() => this.connect(), delay);
  }

  send(data) {
    if (!this.connected) {
      throw new Error("Not connected");
    }
    this.ws.send(JSON.stringify(data));
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}
```

---

## 4. 测试验证

### 4.1 依赖检查

```bash
# 检查版本
npm list ws pino dotenv

# 预期输出
# ws@8.20.0
# pino@9.5.0
# dotenv@16.4.5
```

### 4.2 连接测试

```javascript
// test-connection.js
import { WrapperClient } from "./lib/wrapper-client.js";

const client = new WrapperClient();

// 测试 HTTP 连接
const health = await fetch(`${client.baseUrl}/health`);
console.log("Health:", await health.json());

// 测试 WebSocket 连接
import { ReliableWebSocketClient } from "./lib/websocket-client.js";

const ws = new ReliableWebSocketClient(`ws://localhost:18008/ws`);
await ws.connect();
console.log("WebSocket connected");
```

### 4.3 运行测试

```bash
npm test
```

---

## 参考文档

- [UNIFIED-ARCHITECTURE-v3.2.md](./UNIFIED-ARCHITECTURE-v3.2.md)
- [BACKEND-v3.2-IMPLEMENTATION.md](./BACKEND-v3.2-IMPLEMENTATION.md)

---

_文档版本: v3.2.0_  
_最后更新: 2026-04-10_
