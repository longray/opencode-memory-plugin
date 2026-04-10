# 迁移指南：v2.x → v3.2

> **版本**: v3.2.0  
> **更新时间**: 2026-04-10  
> **状态**: 实施版

---

## 目录

1. [迁移概述](#1-迁移概述)
2. [Breaking Changes](#2-breaking-changes)
3. [Schema 迁移](#3-schema-迁移)
4. [API 变更](#4-api-变更)
5. [配置更新](#5-配置更新)
6. [依赖升级](#6-依赖升级)
7. [迁移步骤](#7-迁移步骤)
8. [回滚方案](#8-回滚方案)
9. [常见问题](#9-常见问题)

---

## 1. 迁移概述

### 1.1 版本演进

```
v2.x (当前稳定)
  │  • 后端优先架构
  │  • SurrealDB 2.x + Meilisearch 0.31
  │  • 端口 17999
  │  • 基础 WebSocket（无心跳/ACK）
  │
  ├── v3.0 (已发布)
  │    • 代码分析 v3.0
  │    • tree-sitter 多语言支持
  │    • 项目健康度评级
  │
  ▼
v3.2 (目标版本)
     • SurrealDB 3.0 + Meilisearch 0.40
     • 端口 18008
     • 可靠 WebSocket（心跳/ACK/DIFF）
     • PrecomputeService
     • 四层架构（Atom/Entity/Relation/Timeline）
```

### 1.2 迁移范围

| 组件   | 变更级别 | 说明                                 |
| ------ | -------- | ------------------------------------ |
| 插件端 | 中等     | 端口更新、依赖升级、WebSocket 重写   |
| 后端   | 重大     | SurrealDB 3.0、Schema 重设计、新端口 |
| 数据库 | 重大     | Schema 变更、数据迁移脚本            |
| Docker | 中等     | 端口映射、多阶段构建优化             |
| 文档   | 低       | 端口引用更新                         |

### 1.3 预估时间

| 阶段     | 耗时       | 说明                             |
| -------- | ---------- | -------------------------------- |
| 准备     | 0.5 天     | 备份数据、阅读文档               |
| 后端迁移 | 2-3 天     | Schema + API + PrecomputeService |
| 插件适配 | 1-2 天     | 依赖升级 + WebSocket + 测试      |
| 验证测试 | 1 天       | 功能测试 + 回归测试              |
| **总计** | **4-7 天** |                                  |

---

## 2. Breaking Changes

### 2.1 端口变更

| 服务        | v2.x                      | v3.2                      |
| ----------- | ------------------------- | ------------------------- |
| HTTP API    | `localhost:17999`         | `localhost:18008`         |
| WebSocket   | `ws://localhost:17999/ws` | `ws://localhost:18008/ws` |
| Docker 映射 | `17999:17999`             | `18008:18008`             |

### 2.2 Schema 变更

**v2.x 记忆条目格式**：

```markdown
---
id: { ulid }
date: { ISO8601 }
type: { type }
tags: [{ tags }]
project: { project }
memory_id: { memory_id }
synced: { boolean }
---

# ≡≡≡ Abstract ≡≡≡

`content`

# ≡≡≡ Overview ≡≡≡

`content`

# ≡≡≡ Contents ≡≡≡

## `content`
```

**v3.2 数据库 Schema**（SurrealDB 3.0）：

```sql
-- Entity 表（记忆条目）
DEFINE TABLE entity SCHEMAFULL;
DEFINE FIELD abstract ON entity TYPE string;
DEFINE FIELD overview ON entity TYPE string;
DEFINE FIELD content ON entity TYPE string;
DEFINE FIELD type ON entity TYPE string;
DEFINE FIELD tags ON entity TYPE array;
DEFINE FIELD tenant_id ON entity TYPE string DEFAULT "default";
DEFINE FIELD project_id ON entity TYPE string;

-- Atom 表（代码符号）
DEFINE TABLE atom SCHEMAFULL;
DEFINE FIELD symbol_type ON entity TYPE string; -- function/class/interface
DEFINE FIELD name ON entity TYPE string;
DEFINE FIELD entity_id ON entity TYPE record<entity>;

-- Reference 表（关系）
DEFINE TABLE reference SCHEMAFULL IN;
DEFINE FIELD in ON reference TYPE record<atom | entity>;
DEFINE FIELD out ON reference TYPE record<atom | entity>;
DEFINE FIELD relation_type ON reference TYPE string;
```

### 2.3 API 变更

| API      | v2.x                              | v3.2                            | 说明        |
| -------- | --------------------------------- | ------------------------------- | ----------- |
| 健康检查 | `GET /api/v1/health`              | `GET /api/v1/health`            | 兼容        |
| 搜索     | `POST /api/v1/memories/search`    | `POST /api/v1/memories/search`  | 兼容        |
| 上传     | `POST /api/v1/memories`           | `POST /api/v1/entities`         | ⚠️ 路径变更 |
| 关系     | `POST /api/v1/memories/relations` | `POST /api/v1/references`       | ⚠️ 路径变更 |
| 图遍历   | `POST /api/v1/memories/graph`     | `POST /api/v1/references/graph` | ⚠️ 路径变更 |
| 同步预览 | `POST /api/v1/sync/preview`       | `POST /api/v1/sync/preview`     | 兼容        |
| 预计算   | 无                                | `POST /api/v1/precompute`       | 🆕 新增     |

### 2.4 工具变更

| 工具            | v2.x                  | v3.2                   | 影响     |
| --------------- | --------------------- | ---------------------- | -------- |
| `memory_write`  | 直接上传              | 通过 PrecomputeService | 行为不变 |
| `memory_search` | v1 search API         | v2 search API          | 行为不变 |
| `memory_relate` | `/memories/relations` | `/references`          | 内部变更 |
| `memory_graph`  | `/memories/graph`     | `/references/graph`    | 内部变更 |

> **插件工具接口不变**：所有 API 路径变更封装在 `wrapper-client.js` 内部，用户无感知。

---

## 3. Schema 迁移

### 3.1 迁移策略

v3.2 采用 **双写过渡** 策略：

```
Phase 1: 双写（过渡期）
  - 插件同时写入 v2 和 v3 Schema
  - 读取优先 v3，降级 v2

Phase 2: 全量迁移
  - 运行迁移脚本
  - 所有数据迁移到 v3 Schema
  - 验证数据完整性

Phase 3: 清理
  - 移除 v2 兼容代码
  - 删除旧表/旧索引
```

### 3.2 迁移脚本

```javascript
// scripts/migrate-v2-to-v3.js
import { WrapperClient } from '../lib/wrapper-client.js';

async function migrate() {
  const client = new WrapperClient({ port: 18008 });

  // 1. 获取所有 v2 条目
  const v2Entries = await client.getAllMemories();
  console.log(`Found ${v2Entries.length} entries to migrate`);

  // 2. 逐条迁移到 v3 Schema
  for (const entry of v2Entries) {
    await client.createEntity({
      abstract: entry.abstract,
      overview: entry.overview,
      content: entry.content,
      type: entry.type || 'general',
      tags: entry.tags || [],
      tenant_id: entry.tenant_id || 'default',
      project_id: entry.project_id || null,
      // v3 新增字段
      source_id: entry.source_id || null,
      pinned: entry.pinned || false,
    });
  }

  // 3. 迁移关系
  const relations = await client.getAllRelations();
  for (const rel of relations) {
    await client.createReference({
      in_id: rel.from_id,
      out_id: rel.to_id,
      relation_type: rel.relation_type,
      weight: rel.weight || 0.5,
    });
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);
```

### 3.3 本地文件兼容

v3.2 **不改变本地文件格式**，timeline 目录结构保持不变：

```
~/.opencode/memory/
├── timeline/
│   └── 2026/
│       └── 03/
│           └── 16/
│               ├── entry-001.md
│               └── entry-002.md
├── MEMORY.md
├── SOUL.md
└── ...
```

> 本地文件格式（`# ≡≡≡` 分隔符 + L0/L1/L2 分层）在 v2.4 就已确定，v3.2 保持兼容。

---

## 4. API 变更

### 4.1 WrapperClient 更新

```javascript
// lib/wrapper-client.js v3.2
class WrapperClient {
  constructor(options = {}) {
    // v3.2: 默认端口 18008
    this.port = options.port || 18008;
    this.host = options.host || 'localhost';
    this.baseUrl = `http://${this.host}:${this.port}/api/v1`;
  }

  // v3.2: 新增 Entity API
  async createEntity(data) {
    return this.request('POST', '/entities', data);
  }

  async getEntity(id) {
    return this.request('GET', `/entities/${id}`);
  }

  // v3.2: 新增 Reference API（替代 relations）
  async createReference(data) {
    return this.request('POST', '/references', data);
  }

  // 向后兼容：旧方法内部转发到新 API
  async upload(entry) {
    // 内部转换为 Entity 格式
    return this.createEntity({
      abstract: entry.abstract,
      overview: entry.overview,
      content: entry.content,
      type: entry.type,
      tags: entry.tags,
    });
  }
}
```

### 4.2 WebSocket 协议升级

**v2.x WebSocket**（基础版）：

```javascript
// 简单连接，无心跳，无 ACK
const ws = new WebSocket('ws://localhost:17999/ws');
ws.on('message', data => console.log(data));
```

**v3.2 WebSocket**（可靠版）：

```javascript
// lib/websocket-client.js
class ReliableWebSocketClient {
  constructor(url, options = {}) {
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.maxMissedPongs = 2;
    this.maxRetries = 10;
    this.baseDelay = 1000;
    this.maxDelay = 300000; // 5 分钟
  }

  // 心跳机制
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      this.missedPongs++;
    }, this.heartbeatInterval);
  }

  // 指数退避重连
  scheduleReconnect() {
    const delay = Math.min(this.baseDelay * Math.pow(2, this.retryCount), this.maxDelay);
    setTimeout(() => this.connect(), delay);
  }
}
```

### 4.3 消息格式变更

**v2.x**：

```json
{
  "type": "memory_update",
  "id": "01HN...",
  "action": "created"
}
```

**v3.2**：

```json
{
  "type": "entity_change",
  "entity_id": "01HN...",
  "action": "created",
  "timestamp": "2026-04-10T12:00:00.000Z",
  "session_id": "sess_abc123",
  "seq": 42,
  "diff": { "abstract": "new value" }
}
```

新增字段说明：

| 字段         | 说明                                         |
| ------------ | -------------------------------------------- |
| `session_id` | 会话标识，用于连接恢复                       |
| `seq`        | 消息序列号，用于 ACK 确认                    |
| `diff`       | DIFF 模式，只传输变更部分（减少 90% 数据量） |

---

## 5. 配置更新

### 5.1 环境变量

```bash
# v2.x
export API_PORT=17999

# v3.2
export API_PORT=18008
```

### 5.2 memory-config.json

```json
{
  "search": {
    "mode": "hybrid"
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B"
  },
  "v3.2": {
    "websocket": {
      "enabled": true,
      "heartbeat_interval": 30000,
      "max_retries": 10
    },
    "precompute": {
      "enabled": true,
      "batch_size": 100,
      "concurrency": 5
    }
  }
}
```

### 5.3 Docker Compose

```yaml
# docker-compose.yml v3.2
services:
  memory-service:
    build:
      context: ./embedding_service
      dockerfile: Dockerfile
    ports:
      - '18008:18008' # v2.x: 17999:17999
    environment:
      - PORT=18008 # v2.x: PORT=17999
      - WRAPPER_MEILI_API_KEY=${API_KEY}
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:18008/api/v1/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 6. 依赖升级

### 6.1 package.json 变更

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

**新增依赖**：

| 包名     | 版本    | 用途                           |
| -------- | ------- | ------------------------------ |
| `pino`   | ^9.5.0  | 结构化日志（替代 console.log） |
| `dotenv` | ^16.4.5 | 环境变量管理                   |

**升级依赖**：

| 包名        | v2.x    | v3.2    | 原因            |
| ----------- | ------- | ------- | --------------- |
| `ws`        | ^8.19.0 | ^8.20.0 | Bug 修复        |
| `@types/ws` | 无      | ^8.5.13 | TypeScript 支持 |

### 6.2 tree-sitter 升级

```bash
# v2.x → v3.2
tree-sitter:          未指定 → ^0.25.0
tree-sitter-python:   未指定 → ^0.25.0
tree-sitter-javascript: 未指定 → ^0.25.0
tree-sitter-typescript: 未指定 → ^0.23.0
tree-sitter-go:       未指定 → ^0.25.0
tree-sitter-rust:     未指定 → ^0.24.0
tree-sitter-java:     未指定 → ^0.23.0
```

---

## 7. 迁移步骤

### Step 1: 备份数据

```bash
# 备份本地记忆文件
cp -r ~/.opencode/memory ~/.opencode/memory.backup.$(date +%Y%m%d)

# 备份后端数据库（如果自托管 SurrealDB）
# 具体方法取决于部署方式
```

### Step 2: 更新插件

```bash
cd opencode-memory-plugin/opencode-memory-plugin

# 更新依赖
git pull origin main
npm install

# 运行测试确认
npm test
```

### Step 3: 更新后端

```bash
# 拉取最新后端代码
cd embedding_service

# 更新 Python 依赖
pip install -e ".[dev]"

# 更新 SurrealDB 到 3.0+
# 具体方法取决于部署方式
```

### Step 4: 运行迁移脚本

```bash
# 迁移数据库 Schema
node scripts/migrate-v2-to-v3.js

# 验证迁移结果
node scripts/verify-migration.js
```

### Step 5: 验证功能

```bash
# 检查后端健康
curl http://localhost:18008/api/v1/health

# 测试搜索
node cli/index.cjs search "测试查询"

# 测试写入
node cli/index.cjs write "迁移验证" --type general

# 测试 WebSocket
node -e "
import { SyncWebSocketClient } from './lib/ws-client.js';
const ws = new SyncWebSocketClient('ws://localhost:18008/ws');
ws.connect().then(() => console.log('WebSocket OK!'));
"
```

### Step 6: 更新配置

```bash
# 更新环境变量
export API_PORT=18008

# 更新 memory-config.json（如需要）
```

---

## 8. 回滚方案

### 8.1 回滚条件

- 迁移脚本执行失败
- 后端服务无法启动
- 搜索功能异常
- WebSocket 连接不稳定

### 8.2 回滚步骤

```bash
# 1. 恢复本地记忆文件
rm -rf ~/.opencode/memory
cp -r ~/.opencode/memory.backup.YYYYMMDD ~/.opencode/memory

# 2. 回退插件版本
cd opencode-memory-plugin
git checkout v2.9.1
npm install

# 3. 回退后端
cd embedding_service
git checkout v2.4.0
pip install -e ".[dev]"

# 4. 恢复端口配置
export API_PORT=17999

# 5. 重启服务
docker-compose down
docker-compose up -d
```

### 8.3 数据一致性

回滚后检查：

```bash
# 确认本地文件完整
ls ~/.opencode/memory/timeline/

# 确认后端数据
curl http://localhost:17999/api/v1/health
```

---

## 9. 常见问题

### 9.1 迁移后搜索不返回结果

**原因**：v3 Schema 数据未迁移或 Meilisearch 索引未重建。

**解决**：

```bash
# 重建索引
node cli/index.cjs rebuild-index --force
```

### 9.2 WebSocket 连接失败

**原因**：端口未更新或防火墙拦截。

**解决**：

```bash
# 确认端口
curl http://localhost:18008/api/v1/health

# 检查 WebSocket
wscat -c ws://localhost:18008/ws
```

### 9.3 旧版插件连接新版后端

**兼容性**：v3.2 后端保持 v1 API 兼容，旧版插件可以继续使用。

**注意**：旧版插件默认连接 17999 端口，需要手动修改或通过环境变量覆盖。

---

## 相关文档

| 文档                                                                                           | 说明                         |
| ---------------------------------------------------------------------------------------------- | ---------------------------- |
| [../../docs/v3.2/BACKEND-v3.2-MIGRATION.md](../../docs/v3.2/BACKEND-v3.2-MIGRATION.md)         | 后端 v3.2 迁移指南（详细版） |
| [../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md](../../docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md) | 插件端 v3.2 实施指南         |
| [../../docs/v3.2/DATABASE-v3.2-SCHEMA.md](../../docs/v3.2/DATABASE-v3.2-SCHEMA.md)             | v3.2 数据库 Schema 定义      |
| [../../docs/v3.2/DEPENDENCY-VERSIONS.md](../../docs/v3.2/DEPENDENCY-VERSIONS.md)               | 依赖版本锁定表               |
