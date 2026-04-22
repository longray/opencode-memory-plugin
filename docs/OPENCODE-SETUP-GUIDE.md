# OpenCode + oh-my-opencode 环境配置指南

**版本**: v1.0  
**更新时间**: 2026-04-23  
**适用**: opencode-memory-plugin v3.2.2+  
**目标**: 实现 BEST-PRACTICES-v2.1.md 中的"最佳效果"

---

## 目录

1. [快速开始](#一快速开始)
2. [环境架构](#二环境架构)
3. [安装步骤](#三安装步骤)
4. [配置文件详解](#四配置文件详解)
5. [智能体配置](#五智能体配置)
6. [工作流配置](#六工作流配置)
7. [验证安装](#七验证安装)
8. [故障排查](#八故障排查)
9. [最佳实践检查清单](#九最佳实践检查清单)

---

## 一、快速开始

### 1.1 环境要求

| 组件    | 版本要求 | 说明                |
| ------- | -------- | ------------------- |
| Node.js | 18+      | OpenCode 运行环境   |
| Python  | 3.10+    | oh-my-opencode 依赖 |
| Docker  | 最新版   | 后端服务部署        |
| Git     | 2.30+    | 版本控制            |

### 1.2 一键安装脚本

```bash
# 1. 安装 OpenCode
pip install opencode

# 2. 安装 oh-my-opencode
pip install oh-my-opencode

# 3. 启动后端服务
docker-compose up -d

# 4. 安装记忆插件
opencode plugin install opencode-memory-plugin

# 5. 验证安装
opencode doctor
```

---

## 二、环境架构

### 2.1 五层架构部署

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5: oh-my-opencode (编排层)                        │
│  • Sisyphus (主协调器)                                   │
│  • Prometheus (规划)                                     │
│  • Oracle (架构)                                         │
│  • The Observer (观察者)                                 │
│  • The Librarian (图书管理员)                            │
├─────────────────────────────────────────────────────────┤
│  Layer 4: OpenCode (基础 AI 平台)                        │
│  • 编码助手                                              │
│  • 工具调用框架                                          │
│  • 上下文管理                                            │
├─────────────────────────────────────────────────────────┤
│  Layer 3: opencode-memory-plugin (记忆智能层)            │
│  • 15 个 MCP 工具                                        │
│  • 2 个内置代理                                          │
│  • 代码分析服务                                          │
│  • WebSocket 实时同步                                    │
├─────────────────────────────────────────────────────────┤
│  Layer 2: 后端服务 (基础设施层)                          │
│  • SurrealDB (图数据库)                                  │
│  • Meilisearch (搜索引擎)                                │
│  • Embedding 服务                                        │
│  • WebSocket 服务                                        │
├─────────────────────────────────────────────────────────┤
│  Layer 1: 原子记忆存储 (数据层)                          │
│  • Timeline 文件系统                                     │
│  • MEMORY.md 索引                                        │
│  • Link-map 映射                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 端口映射

| 服务        | 端口  | 说明         |
| ----------- | ----- | ------------ |
| OpenCode    | 3000  | Web 界面     |
| 后端 API    | 18008 | v3.2+ 新端口 |
| SurrealDB   | 8000  | 数据库       |
| Meilisearch | 7700  | 搜索引擎     |
| WebSocket   | 18008 | 实时推送     |

---

## 三、安装步骤

### 3.1 安装 OpenCode

```bash
# 创建虚拟环境
python -m venv ~/.venvs/opencode
source ~/.venvs/opencode/bin/activate  # Linux/Mac
# 或
~/.venvs/opencode/Scripts/activate  # Windows

# 安装 OpenCode
pip install opencode

# 验证安装
opencode --version
```

### 3.2 安装 oh-my-opencode

```bash
# 安装 oh-my-opencode
pip install oh-my-opencode

# 安装额外依赖
pip install \
  tree-sitter \
  tree-sitter-javascript \
  tree-sitter-python \
  tree-sitter-go \
  tree-sitter-rust

# 验证安装
oh-my-opencode --version
```

### 3.3 部署后端服务

```bash
# 克隆后端仓库
git clone https://github.com/longray/opencode-memory-backend.git
cd opencode-memory-backend

# 启动服务
docker-compose up -d

# 验证服务状态
curl http://localhost:18008/health
```

**docker-compose.yml 示例**:

```yaml
version: "3.8"

services:
  surrealdb:
    image: surrealdb/surrealdb:latest
    ports:
      - "8000:8000"
    command: start --user root --pass root file:/data/surreal.db
    volumes:
      - surreal-data:/data

  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    environment:
      - MEILI_MASTER_KEY=your-master-key
    volumes:
      - meili-data:/data.ms

  backend:
    image: opencode-memory-backend:latest
    ports:
      - "18008:18008"
    environment:
      - SURREALDB_URL=ws://surrealdb:8000
      - MEILISEARCH_URL=http://meilisearch:7700
      - API_KEY=your-api-key
    depends_on:
      - surrealdb
      - meilisearch

volumes:
  surreal-data:
  meili-data:
```

### 3.4 安装记忆插件

```bash
# 在 OpenCode 中安装插件
opencode plugin install opencode-memory-plugin

# 或使用本地路径
opencode plugin install /path/to/opencode-memory-plugin

# 验证插件安装
opencode plugin list
```

---

## 四、配置文件详解

### 4.1 OpenCode 配置

**文件**: `~/.config/opencode/config.yaml`

```yaml
# OpenCode 主配置
version: "1.0"

# AI 模型配置
models:
  default: claude-sonnet-4
  fallback: claude-haiku-4

# 插件配置
plugins:
  - name: opencode-memory-plugin
    enabled: true
    config:
      memory_dir: ~/.opencode/memory
      backend_url: http://localhost:18008
      api_key: ${WRAPPER_MEILI_API_KEY}

# 智能体配置
agents:
  enabled:
    - sisyphus
    - prometheus
    - oracle
    - observer
    - librarian

# 日志配置
logging:
  level: info
  file: ~/.opencode/logs/opencode.log
```

### 4.2 记忆插件配置

**文件**: `~/.opencode/memory/memory-config.json`

```json
{
  "version": "3.2",
  "apiKey": "your-api-key",
  "apiPort": 18008,
  "search": {
    "mode": "hybrid",
    "fallback": "keyword"
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "apiKey": "${MODELSCOPE_API_KEY}"
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:18008",
    "tenant_id": "default",
    "timeout": 30000
  },
  "websocket": {
    "enabled": true,
    "heartbeatInterval": 30000,
    "reconnectMaxAttempts": 10,
    "reconnectDelay": 5000
  },
  "code_analysis": {
    "auto_trigger": true,
    "use_atom_entity_api": true,
    "batch_size": 50,
    "languages": ["javascript", "typescript", "python", "go", "rust", "java"],
    "fingerprint_cache": true,
    "privacy_filter": {
      "exclude_patterns": [
        "*.env",
        "*.key",
        "*.pem",
        "node_modules/**",
        ".git/**"
      ]
    }
  },
  "sync": {
    "auto_sync": true,
    "sync_interval": 300000,
    "conflict_resolution": "manual"
  }
}
```

### 4.3 oh-my-opencode 配置

**文件**: `~/.config/oh-my-opencode/config.yaml`

```yaml
# oh-my-opencode 配置
version: "1.0"

# 智能体配置
agents:
  sisyphus:
    enabled: true
    model: claude-sonnet-4
    tools:
      - memory_search
      - memory_write
      - memory_read
      - task_delegation

  prometheus:
    enabled: true
    model: claude-sonnet-4
    tools:
      - memory_timeline
      - memory_topics
      - backlog_create
      - backlog_update

  oracle:
    enabled: true
    model: claude-opus-4
    tools:
      - memory_graph
      - memory_search
      - code_analysis

  observer:
    enabled: true
    model: claude-haiku-4
    trigger: tab_switch
    tools:
      - memory_search
      - memory_write
      - memory_suggest

  librarian:
    enabled: true
    model: claude-sonnet-4
    schedule: "0 17 * * 5" # 每周五 17:00
    tools:
      - memory_timeline
      - memory_topics
      - memory_relate
      - memory_graph
      - memory_pin
      - incremental_sync

# Hooks 配置
hooks:
  pre_tool_use:
    enabled: true
    filters:
      - memory_delete
      - memory_clear

  post_tool_use:
    enabled: true
    actions:
      - auto_save_context
      - update_graph

  session_start:
    enabled: true
    actions:
      - load_memory_context
      - check_backlog

  session_end:
    enabled: true
    actions:
      - consolidate_memory
      - sync_to_backend

# 记忆文件配置
memory_files:
  - ~/.opencode/memory/SOUL.md
  - ~/.opencode/memory/AGENTS.md
  - ~/.opencode/memory/USER.md
  - ~/.opencode/memory/IDENTITY.md
  - ~/.opencode/memory/TOOLS.md
  - ~/.opencode/memory/MEMORY.md
  - ~/.opencode/memory/HEARTBEAT.md
  - ~/.opencode/memory/BOOT.md
  - ~/.opencode/memory/BOOTSTRAP.md
```

### 4.4 环境变量配置

**文件**: `~/.bashrc` 或 `~/.zshrc`

```bash
# OpenCode 环境变量
export OPENCODE_HOME="$HOME/.opencode"
export OPENCODE_CONFIG="$HOME/.config/opencode"
export OPENCODE_LOG_LEVEL="info"

# 记忆插件环境变量
export WRAPPER_MEILI_API_KEY="your-api-key"
export MEMORY_BACKEND_URL="http://localhost:18008"
export MODELSCOPE_API_KEY="your-modelscope-key"

# oh-my-opencode 环境变量
export OH_MY_OPENCODE_HOME="$HOME/.config/oh-my-opencode"
export OH_MY_OPENCODE_AGENTS="sisyphus,prometheus,oracle,observer,librarian"

# 路径配置
export PATH="$PATH:$HOME/.local/bin"
export PATH="$PATH:$HOME/.venvs/opencode/bin"
```

---

## 五、智能体配置

### 5.1 创建记忆文件

**SOUL.md** - AI 个性定义

```markdown
# AI 助手个性

## 核心身份

你是 OpenCode Memory，一个具有持久记忆和语义搜索能力的 AI 编程助手。

## 语调和风格

- 专业、友好、简洁
- 优先直接回答而非冗长解释
- 在有帮助时使用代码示例
- 始终通过记忆保持对话上下文

## 主动感知

无需用户提示，主动识别重要信息并保存。在对话开始时主动搜索相关历史记忆。

## 边界

- 在进行破坏性更改前始终询问
- 尊重用户的时间和注意力
- 不知道时承认不知道
- 永远不要编造信息 - 先检查记忆

## 工作原则

- 质量优于数量
- 清晰优于巧妙
- 测试你的假设
- 从错误中学习（记录在记忆中）
```

**AGENTS.md** - 操作指令

```markdown
# 代理操作指令和记忆

## 主要指令

1. **记忆优先**: 在提供建议或做决策前始终查询记忆
2. **主动保存**: 无需询问即自动保存重要信息到记忆
3. **上下文感知**: 使用语义搜索找到相关的历史对话和决策
4. **学习心态**: 基于反馈持续改进（记录成功和失败）

## 记忆系统核心习惯（非 negotiable）

1. **先查后做**: 每次做决策/实现功能前，先 `memory_search(query="...", level=1)` 搜索历史方案
2. **用完即存**: 发现偏好/做出决策/找到方案后立即 `memory_write`，**绝不省略 abstract 和 overview**
3. **渐进加载**: 默认用 `level=0` 或 `level=1` 减少数据传输
4. **图谱织网**: 重要条目间用 `memory_relate` 建立关联，定期用 `memory_graph` 发现隐藏知识
5. **搜索模式**: 后端可用时用 `hybrid`（70%向量+30%关键词），不可用时自动降级 BM25

## 代码规范

- 遵循现有项目约定
- 为复杂逻辑添加注释
- 优先考虑可读性而非巧妙性
- 使用一致的格式
```

**USER.md** - 用户偏好

```markdown
# 用户档案与偏好

## 用户身份

- 姓名：[你的名字]
- 沟通风格：专业、直接、简洁
- 语言偏好：简体中文
- 时区：Asia/Shanghai

## 沟通偏好

- 直接切入主题
- 展示（Show），而不是只说（Tell）
- 使用示例
- 总结关键要点

## 工作风格

- 提前提供上下文
- 不确定时提出澄清问题
- 倾向于多个选项而非单一方案
- 想了解"为什么"，而不仅仅是"是什么"

## 代码偏好

- 整洁、可读的代码优于巧妙的代码
- 复杂逻辑需要适当的文档
- 保持一致的格式
- 关键路径需要测试覆盖

## 记忆系统偏好

- **期望**：AI 应该主动识别对话中的重要信息并自动保存
- **智能过滤**：宁可漏掉边缘情况，也不要过度触发
- **渐进加载**：优先使用 level=0 或 level=1 减少数据传输
```

### 5.2 智能体激活

```bash
# 在 OpenCode 中激活智能体
opencode agent enable sisyphus
opencode agent enable prometheus
opencode agent enable oracle
opencode agent enable observer
opencode agent enable librarian

# 验证智能体状态
opencode agent list
```

---

## 六、工作流配置

### 6.1 日常工作流

```yaml
# 工作流配置
workflows:
  daily:
    name: "日常编码工作流"
    steps:
      - name: "启动检查"
        action: index_status
        params:
          detailed: true

      - name: "加载上下文"
        action: memory_search
        params:
          query: "当前项目状态"
          mode: hybrid
          limit: 5

      - name: "检查 Backlog"
        action: listEntities
        params:
          type: backlog
          status: in_progress

      - name: "编码辅助"
        trigger: on_save
        action: code_analysis
        params:
          auto_trigger: true

      - name: "会话结束保存"
        trigger: on_session_end
        action: memory_consolidate
```

### 6.2 知识整合流

```yaml
workflows:
  consolidation:
    name: "知识整合工作流"
    schedule: "0 17 * * 5" # 每周五 17:00
    steps:
      - name: "发现碎片"
        action: memory_timeline
        params:
          days: 7
          level: 1

      - name: "主题分析"
        action: memory_topics
        params:
          min_entries: 5

      - name: "聚合提炼"
        action: memory_write
        params:
          type: long-term
          pinned: true

      - name: "建立关联"
        action: memory_relate
        params:
          relation_type: summarizes

      - name: "同步后端"
        action: incremental_sync
```

### 6.3 快捷键配置

```json
{
  "shortcuts": {
    "memory_search": "Ctrl+Shift+F",
    "memory_write": "Ctrl+Shift+S",
    "memory_read": "Ctrl+Shift+R",
    "backlog_create": "Ctrl+Shift+B",
    "agent_switch": "Tab",
    "consolidate": "Ctrl+Shift+C"
  }
}
```

---

## 七、验证安装

### 7.1 健康检查清单

```bash
#!/bin/bash
# health-check.sh

echo "=== OpenCode + oh-my-opencode 健康检查 ==="

# 1. 检查 OpenCode
echo -n "✓ OpenCode 安装: "
opencode --version && echo "✅" || echo "❌"

# 2. 检查 oh-my-opencode
echo -n "✓ oh-my-opencode 安装: "
oh-my-opencode --version && echo "✅" || echo "❌"

# 3. 检查后端服务
echo -n "✓ 后端服务: "
curl -s http://localhost:18008/health | grep -q "healthy" && echo "✅" || echo "❌"

# 4. 检查插件
echo -n "✓ 记忆插件: "
opencode plugin list | grep -q "opencode-memory-plugin" && echo "✅" || echo "❌"

# 5. 检查智能体
echo -n "✓ 智能体: "
opencode agent list | grep -q "sisyphus" && echo "✅" || echo "❌"

# 6. 检查记忆文件
echo -n "✓ 记忆文件: "
[ -f ~/.opencode/memory/SOUL.md ] && echo "✅" || echo "❌"

# 7. 检查后端连接
echo -n "✓ 后端连接: "
opencode exec "index_status" | grep -q "healthy" && echo "✅" || echo "❌"

echo "=== 检查完成 ==="
```

### 7.2 功能测试

```bash
# 测试记忆写入
echo "测试记忆写入..."
opencode exec "memory_write" --content "测试内容" --abstract "测试摘要" --overview "测试概述"

# 测试记忆搜索
echo "测试记忆搜索..."
opencode exec "memory_search" --query "测试" --mode hybrid

# 测试代码分析
echo "测试代码分析..."
echo "function test() { return 1; }" > /tmp/test.js
opencode exec "analyze_code" --file /tmp/test.js

# 测试 Backlog 创建
echo "测试 Backlog 创建..."
opencode exec "createEntity" --type backlog --abstract "测试任务"

echo "✅ 所有功能测试通过！"
```

---

## 八、故障排查

### 8.1 常见问题

#### 问题 1: 后端连接失败

**症状**: `index_status` 返回后端不可用

**解决**:

```bash
# 检查后端服务
docker-compose ps

# 重启后端服务
docker-compose restart backend

# 检查端口占用
lsof -i :18008

# 查看后端日志
docker-compose logs backend
```

#### 问题 2: 智能体未激活

**症状**: Tab 切换无反应，智能体不工作

**解决**:

```bash
# 检查智能体状态
opencode agent list

# 重新激活
opencode agent enable sisyphus
opencode agent enable observer

# 重启 OpenCode
opencode restart
```

#### 问题 3: 记忆搜索无结果

**症状**: `memory_search` 返回空结果

**解决**:

```bash
# 检查索引状态
opencode exec "index_status" detailed=true

# 重建索引
opencode exec "rebuild_index"

# 检查后端搜索服务
curl "http://localhost:18008/api/v1/memories/search?q=test"
```

#### 问题 4: WebSocket 连接断开

**症状**: 实时同步不工作

**解决**:

```bash
# 检查 WebSocket 配置
grep websocket ~/.opencode/memory/memory-config.json

# 增加心跳间隔
# 在 memory-config.json 中设置:
# "heartbeatInterval": 60000

# 重启插件
opencode plugin restart opencode-memory-plugin
```

### 8.2 日志查看

```bash
# OpenCode 日志
tail -f ~/.opencode/logs/opencode.log

# 插件日志
tail -f ~/.opencode/logs/memory-plugin.log

# 后端日志
docker-compose logs -f backend

# 智能体日志
tail -f ~/.opencode/logs/agents.log
```

---

## 九、最佳实践检查清单

### 9.1 每日检查清单

- [ ] 启动 OpenCode → 运行 `index_status` 确认后端连接正常
- [ ] 检查智能体状态 → `opencode agent list`
- [ ] 加载上下文 → `memory_search` 搜索当前项目
- [ ] 检查 Backlog → `listEntities` 查看进行中的任务
- [ ] 编码中遇到问题时 → `memory_search` 搜索历史方案
- [ ] 做出重要决策时 → `memory_write` 保存（含 abstract/overview）
- [ ] 保存文件时 → 确认代码分析自动触发
- [ ] 会话结束前 → Tab 切到 The Observer 审阅候选记忆
- [ ] 每周五 → `@memory-consolidate` 整合知识

### 9.2 每周检查清单

- [ ] 运行健康检查脚本
- [ ] 检查磁盘空间（记忆文件、日志）
- [ ] 清理过期日志
- [ ] 验证备份（如启用）
- [ ] 检查后端资源使用（CPU/内存）
- [ ] 更新插件到最新版本
- [ ] 检查是否有新的最佳实践

### 9.3 性能优化检查清单

- [ ] 启用 `fingerprint_cache` 避免重复分析
- [ ] 使用 `level=0` 或 `level=1` 进行渐进加载
- [ ] 限制代码分析语言（只启用需要的）
- [ ] 启用 WebSocket 保持实时同步
- [ ] 使用 `hybrid` 搜索模式（后端可用时）
- [ ] 定期运行 `incremental_sync` 而非 `full_sync`

---

## 附录

### A. 完整配置示例

**docker-compose.yml**:

```yaml
[完整配置见 3.3 节]
```

**memory-config.json**:

```json
[完整配置见 4.2 节]
```

**oh-my-opencode/config.yaml**:

```yaml
[完整配置见 4.3 节]
```

### B. 相关文档

- [BEST-PRACTICES-v2.1.md](./BEST-PRACTICES-v2.1.md) - 最佳实践指南
- [UNIFIED-ARCHITECTURE-v3.2.md](./v3.2/UNIFIED-ARCHITECTURE-v3.2.md) - 架构设计
- [API-CONTRACT.md](./API-CONTRACT.md) - API 契约
- [BACKLOG.md](../BACKLOG.md) - 任务列表

### C. 版本历史

| 版本 | 日期       | 变更                   |
| ---- | ---------- | ---------------------- |
| v1.0 | 2026-04-23 | 初始版本，完整配置指南 |

---

**文档结束**

如有问题，请参考 [BEST-PRACTICES-v2.1.md](./BEST-PRACTICES-v2.1.md) 或提交 Issue。
