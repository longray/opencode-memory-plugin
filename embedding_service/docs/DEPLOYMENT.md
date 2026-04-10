# Deployment Guide

> Embedding Service 生产环境部署指南
>
> **版本**: v3.2.0 | **端口**: 18008 | **最后更新**: 2026-04-10

---

## 目录

1. [Docker 部署](#1-docker-部署)
2. [环境变量](#2-环境变量)
3. [数据库配置](#3-数据库配置)
4. [服务配置](#4-服务配置)
5. [监控与日志](#5-监控与日志)
6. [健康检查](#6-健康检查)
7. [生产环境检查清单](#7-生产环境检查清单)

---

## 1. Docker 部署

### 1.1 快速部署

```bash
# 克隆仓库
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin/embedding_service

# 配置环境变量
cp .env.example .env
# 编辑 .env，设置 API 密钥

# 启动所有服务
docker-compose up -d

# 验证
docker-compose ps
curl http://localhost:18008/health
```

### 1.2 服务组件

| 服务        | 内部端口 | 外部端口 | 说明     |
| ----------- | -------- | -------- | -------- |
| FastAPI     | 18008    | 18008    | 主服务   |
| SurrealDB   | 8000     | 8000     | 图数据库 |
| Meilisearch | 7700     | 7700     | 搜索引擎 |

### 1.3 Dockerfile（多阶段构建）

```dockerfile
# Stage 1: Builder
FROM python:3.10-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y gcc g++ git \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Stage 2: Runtime
FROM python:3.10-slim AS runtime

WORKDIR /app
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY src/ ./src/

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:18008/health || exit 1

EXPOSE 18008

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "18008", "--workers", "4"]
```

### 1.4 docker-compose.yml

```yaml
version: "3.8"

services:
  api:
    build:
      context: ./wrapper
      dockerfile: Dockerfile
    container_name: opencode-memory-api
    ports:
      - "18008:18008"
    environment:
      - PORT=18008
      - HOST=0.0.0.0
      - WORKERS=4
      - SURREALDB_URL=ws://surrealdb:8000
      - SURREALDB_NS=opencode
      - SURREALDB_DB=memory
      - SURREALDB_USER=root
      - SURREALDB_PASS=root
      - MEILISEARCH_URL=http://meilisearch:7700
      - MEILISEARCH_API_KEY=${MEILISEARCH_API_KEY}
      - MODELSCOPE_API_KEY=${MODELSCOPE_API_KEY}
      - LOG_LEVEL=INFO
    depends_on:
      surrealdb:
        condition: service_healthy
      meilisearch:
        condition: service_healthy
    networks:
      - opencode-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18008/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  surrealdb:
    image: surrealdb/surrealdb:latest
    container_name: opencode-surrealdb
    ports:
      - "8000:8000"
    command:
      - start
      - --log
      - info
      - --user
      - root
      - --pass
      - root
      - file:/data/surrealdb.db
    volumes:
      - surrealdb_data:/data
    networks:
      - opencode-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "surreal", "is-ready", "--conn", "http://localhost:8000"]
      interval: 10s
      timeout: 5s
      retries: 5

  meilisearch:
    image: getmeili/meilisearch:latest
    container_name: opencode-meilisearch
    ports:
      - "7700:7700"
    environment:
      - MEILI_MASTER_KEY=${MEILISEARCH_API_KEY}
      - MEILI_HTTP_PAYLOAD_SIZE_LIMIT=104857600
    volumes:
      - meilisearch_data:/meili_data
    networks:
      - opencode-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7700/health"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  opencode-network:
    driver: bridge

volumes:
  surrealdb_data:
    driver: local
  meilisearch_data:
    driver: local
```

---

## 2. 环境变量

### 2.1 必需变量

| 变量                  | 说明                | 示例               |
| --------------------- | ------------------- | ------------------ |
| `MODELSCOPE_API_KEY`  | ModelScope API 密钥 | `sk-xxxxxxxxxxxxx` |
| `MEILISEARCH_API_KEY` | Meilisearch 密钥    | `your-master-key`  |

### 2.2 可选变量

| 变量              | 默认值                | 说明               |
| ----------------- | --------------------- | ------------------ |
| `PORT`            | 18008                 | 服务端口           |
| `HOST`            | 0.0.0.0               | 绑定地址           |
| `WORKERS`         | 4                     | Uvicorn 工作进程   |
| `LOG_LEVEL`       | INFO                  | 日志级别           |
| `SURREALDB_URL`   | ws://localhost:8000   | SurrealDB URL      |
| `SURREALDB_NS`    | opencode              | SurrealDB 命名空间 |
| `SURREALDB_DB`    | memory                | SurrealDB 数据库   |
| `SURREALDB_USER`  | root                  | SurrealDB 用户     |
| `SURREALDB_PASS`  | root                  | SurrealDB 密码     |
| `MEILISEARCH_URL` | http://localhost:7700 | Meilisearch URL    |

### 2.3 WebSocket 配置

| 变量                    | 默认值 | 说明           |
| ----------------------- | ------ | -------------- |
| `WS_HEARTBEAT_INTERVAL` | 30     | 心跳间隔（秒） |
| `WS_RECONNECT_MAX`      | 10     | 最大重连次数   |
| `WS_ACK_TIMEOUT`        | 5.0    | ACK 超时（秒） |

### 2.4 预计算配置

| 变量                        | 默认值 | 说明               |
| --------------------------- | ------ | ------------------ |
| `PRECOMPUTE_BATCH_SIZE`     | 100    | 批处理大小         |
| `PRECOMPUTE_MAX_CONCURRENT` | 5      | 最大并发数         |
| `PRECOMPUTE_INTERVAL`       | 300    | 定时任务间隔（秒） |

### 2.5 .env 示例

```bash
# 必需
MODELSCOPE_API_KEY=your-modelscope-api-key
MEILISEARCH_API_KEY=your-meilisearch-api-key

# 可选
# PORT=18008
# WORKERS=4
# LOG_LEVEL=INFO
```

---

## 3. 数据库配置

### 3.1 SurrealDB 初始化

```bash
# 首次启动后运行 Schema 初始化
docker-compose exec api python src/db/migrations/v3.2_schema.sql

# 或使用 SurrealDB CLI
docker-compose exec surrealdb surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  < wrapper/src/db/migrations/v3.2_schema.sql
```

### 3.2 SurrealDB 数据迁移

```bash
# v2.x → v3.2 迁移
docker-compose exec api python src/db/migrations/migrate_v2_to_v3.2.py

# 验证迁移
docker-compose exec surrealdb surreal sql \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns opencode --db memory \
  --query "SELECT count() FROM atom GROUP BY tenant_id"
```

### 3.3 Meilisearch 索引初始化

```python
# 自动在服务启动时创建
# 如需手动初始化：
from meilisearch import Client

client = Client("http://localhost:7700", "your-api-key")
client.create_index("memories")
index = client.index("memories")
index.update_settings({
    "searchableAttributes": ["content", "abstract", "tags"],
    "filterableAttributes": ["tenant_id", "type", "project", "tags"],
    "sortableAttributes": ["created_at", "updated_at"]
})
```

### 3.4 备份与恢复

```bash
# 备份 SurrealDB
docker exec opencode-surrealdb surreal dump \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns opencode --db memory \
  /backup/surrealdb-$(date +%Y%m%d).sql

# 备份 Meilisearch
docker exec opencode-meilisearch curl \
  -O /backup/meilisearch-dump.json \
  "http://localhost:7700/dumps?masterKey=your-key"

# 恢复 SurrealDB
docker exec -i opencode-surrealdb surreal import \
  --conn http://localhost:8000 \
  --user root --pass root \
  --ns opencode --db memory \
  < /backup/surrealdb-20260410.sql
```

---

## 4. 服务配置

### 4.1 Nginx 反向代理

```nginx
upstream api_backend {
    server localhost:18008;
    keepalive 32;
}

server {
    listen 80;
    server_name memory.example.com;

    # WebSocket
    location /ws {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # REST API
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 健康检查
    location /health {
        proxy_pass http://api_backend/health;
        access_log off;
    }
}
```

### 4.2 生产资源配置

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
        reservations:
          cpus: "1.0"
          memory: 2G
    environment:
      - LOG_LEVEL=WARNING
      - WORKERS=8
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
```

### 4.3 systemd 服务

```ini
# /etc/systemd/system/opencode-memory.service
[Unit]
Description=OpenCode Memory Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/opencode-memory-plugin/embedding_service
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable opencode-memory
sudo systemctl start opencode-memory
```

---

## 5. 监控与日志

### 5.1 健康检查端点

| 端点             | 说明           | 预期响应                                              |
| ---------------- | -------------- | ----------------------------------------------------- |
| `GET /health`    | 服务健康       | `{"status":"healthy","version":"3.2.0"}`              |
| `GET /health/db` | 数据库状态     | `{"surrealdb":"connected","meilisearch":"connected"}` |
| `GET /health/ws` | WebSocket 状态 | `{"connections":5,"uptime":3600}`                     |

### 5.2 日志配置

```python
# 结构化 JSON 日志
import logging
from pythonjsonlogger import jsonlogger

log_handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    '%(timestamp)s %(level)s %(name)s %(message)s',
    rename_fields={'levelname': 'level', 'asctime': 'timestamp'}
)
log_handler.setFormatter(formatter)
logging.getLogger().addHandler(log_handler)
logging.getLogger().setLevel(logging.INFO)
```

### 5.3 查看日志

```bash
# 实时日志
docker-compose logs -f api

# 最近 100 行
docker-compose logs --tail=100 api

# 特定时间范围
docker-compose logs --since="2026-04-10T10:00:00" --until="2026-04-10T12:00:00" api

# 导出日志
docker-compose logs api > api_logs.txt
```

### 5.4 Prometheus 指标

```python
from prometheus_client import Counter, Histogram, Gauge

http_requests_total = Counter(
    'http_requests_total', 'Total HTTP requests',
    ['method', 'endpoint', 'status']
)
http_request_duration = Histogram(
    'http_request_duration_seconds', 'Request duration',
    ['method', 'endpoint']
)
websocket_connections = Gauge(
    'websocket_connections', 'Active WebSocket connections'
)
precompute_queue_size = Gauge(
    'precompute_queue_size', 'Precompute task queue size'
)
```

---

## 6. 健康检查

### 6.1 Docker 内置健康检查

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:18008/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 6.2 服务依赖健康检查

```yaml
depends_on:
  surrealdb:
    condition: service_healthy
  meilisearch:
    condition: service_healthy
```

### 6.3 外部监控

```bash
# Cron 健康检查（每分钟）
* * * * * curl -sf http://localhost:18008/health || systemctl restart opencode-memory
```

---

## 7. 生产环境检查清单

### 7.1 部署前

- [ ] 设置 `MODELSCOPE_API_KEY` 环境变量
- [ ] 设置 `MEILISEARCH_API_KEY` 环境变量
- [ ] 运行 SurrealDB Schema 初始化
- [ ] 运行 v2.x → v3.2 迁移（如升级）
- [ ] 配置 Nginx 反向代理
- [ ] 配置 SSL/TLS 证书
- [ ] 配置日志轮转

### 7.2 部署后

- [ ] `curl http://localhost:18008/health` 返回 healthy
- [ ] `curl http://localhost:18008/health/db` 所有连接正常
- [ ] WebSocket 连接测试通过
- [ ] 记忆 CRUD 功能测试通过
- [ ] 搜索功能测试通过
- [ ] 代码分析功能测试通过

### 7.3 安全

- [ ] API Key 不在代码仓库中
- [ ] Docker 容器以非 root 用户运行
- [ ] 网络使用 bridge 模式
- [ ] 日志不包含敏感信息
- [ ] 定期备份 SurrealDB 和 Meilisearch 数据

### 7.4 性能

- [ ] `WORKERS` 设置为 CPU 核心数
- [ ] 内存限制配置合理（API: 4G, SurrealDB: 4G, Meilisearch: 2G）
- [ ] 日志级别设为 WARNING（生产环境）
- [ ] Docker 日志轮转配置

### 7.5 升级

```bash
# 1. 备份
./scripts/backup.sh

# 2. 拉取最新镜像
docker-compose pull

# 3. 停止服务
docker-compose down

# 4. 启动新版本
docker-compose up -d

# 5. 运行迁移
docker-compose exec api python src/db/migrations/migrate_v2_to_v3.2.py

# 6. 验证
curl http://localhost:18008/health
```

---

## 参考文档

- [Docker 文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [SurrealDB Docker](https://surrealdb.com/docs/installation/docker)
- [Meilisearch Docker](https://www.meilisearch.com/docs/learn/getting_started/installation)
- [v3.2 部署指南](../../docs/v3.2/DEPLOYMENT-v3.2.md) — 完整部署文档

---

_文档版本: v3.2.0 | 最后更新: 2026-04-10_
