# 统一架构 v3.0 草案：云端优先 + Agent-Native + 预计算

> **版本**: v3.0.0 DRAFT  
> **日期**: 2026-04-09  
> **状态**: 初期版本/待细化  
> **作者**: OpenCode Agent

---

## 核心设计原则

1. **云端优先**：主要部署在云端，小型化后可本地部署
2. **Agent-Native**：为 Coding Agent 设计，不迁就人类习惯
3. **无后端 LLM**：Agent 显式决策，系统提供能力
4. **预计算加速**：文件保存时预计算，查询时快速响应
5. **插件工具 + CLI**：无 MCP，轻量级按需调用

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Deployment (主要)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 API Gateway                          │   │
│  │  • 统一认证 (API Key)                                │   │
│  │  • 请求路由                                          │   │
│  │  • 限流/配额                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Precompute Service                      │   │
│  │  • AST 解析 (Oxc/Tree-sitter)                        │   │
│  │  • 符号提取                                          │   │
│  │  • 引用解析                                          │   │
│  │  • 聚类 (Leiden)                                     │   │
│  │  • 执行流追踪                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Plugin Tool API                         │   │
│  │  • memory_write/search/read                          │   │
│  │  • code_analyze/navigate/impact                      │   │
│  │  • task_create/update                                │   │
│  │  • graph_traverse/query                              │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │               Storage Layer                          │   │
│  │  • SurrealDB (符号、关系、图谱)                       │   │
│  │  • Meilisearch (混合搜索索引)                         │   │
│  │  • 纯存储，无 LLM 处理                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Local Deployment (小型化后)                     │
│  docker-compose up                                          │
│  • 同样的容器镜像                                           │
│  • 本地 SurrealDB + Meilisearch                            │
│  • 同样的插件工具接口                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 关键设计决策

### 1. 部署模式：云端优先

- **主要部署**：云端服务器（可扩展、高可用）
- **本地部署**：Docker 容器（小型化后）
- **决策原因**：云端更适合 Agent 高频调用，本地用于开发/测试

### 2. 接口模式：插件工具 + CLI

- **插件工具**：OpenCode 插件框架提供的工具（调用云端 API）
- **CLI**：本地命令行（触发分析、同步等）
- **决策原因**：轻量级，无常驻上下文，省 token

### 3. 预计算策略

- **触发时机**：文件保存时（通过文件监听或 CLI）
- **计算内容**：AST 解析、符号提取、引用解析、聚类、执行流
- **存储位置**：云端 SurrealDB
- **决策原因**：查询时快速响应，Agent 不会等待

### 4. Agent-Native 原则

- **无后端 LLM**：不自动提取元数据、不自动建立关系
- **Agent 显式决策**：Agent 指定 type/tags/project，决定建立哪些关系
- **显式优于隐式**：所有操作 Agent 明确知道在做什么

---

## 工具清单

### 记忆管理工具

- `memory_write` - 写入记忆（Agent 显式标注）
- `memory_read` - 读取记忆
- `memory_search` - 搜索记忆（Agent 决定查询策略）
- `memory_update` - 更新记忆
- `memory_delete` - 删除记忆

### 代码分析工具

- `code_analyze` - 触发代码预计算
- `code_navigate` - 代码导航（goto/findReferences）
- `code_impact` - 爆炸半径分析
- `code_search` - 代码搜索（BM25 + 语义）
- `code_get_tasks` - 获取代码实现的任务

### 任务管理工具

- `task_create` - 创建任务
- `task_update` - 更新任务
- `task_list` - 列出任务
- `task_get` - 获取任务详情
- `task_link_code` - 关联代码

### 图谱查询工具

- `graph_traverse` - 图遍历
- `graph_query` - Cypher 查询
- `graph_get_cluster` - 获取聚类信息
- `graph_get_process` - 获取执行流

---

## 预计算流程

```javascript
// 1. 触发（文件保存时）
onFileSave: async (filePath) => {
  const analysis = await codeAnalyzer.analyze(filePath);
  await api.code.precompute(filePath, analysis);
};

// 2. 预计算（云端）
class PrecomputeService {
  async precompute(filePath, analysis) {
    // 2.1 解析 AST
    const ast = await this.parseAST(analysis);

    // 2.2 提取符号
    const symbols = await this.extractSymbols(ast, filePath);

    // 2.3 解析引用
    const references = await this.resolveReferences(symbols);

    // 2.4 构建知识图谱
    const graph = await this.buildGraph(symbols, references);

    // 2.5 聚类
    const clusters = await this.clusterGraph(graph);

    // 2.6 追踪执行流
    const processes = await this.traceProcesses(graph);

    // 2.7 构建搜索索引
    await this.buildSearchIndex(symbols);

    // 2.8 存储
    await this.storeToDatabase({
      filePath,
      symbols,
      references,
      graph,
      clusters,
      processes,
    });
  }
}
```

---

## 存储 Schema（SurrealDB）

```sql
-- 符号表
DEFINE TABLE symbol TYPE NORMAL SCHEMAFULL;
DEFINE FIELD id ON symbol TYPE record;
DEFINE FIELD name ON symbol TYPE string;
DEFINE FIELD type ON symbol TYPE string;
DEFINE FIELD file_path ON symbol TYPE string;
DEFINE FIELD start_line ON symbol TYPE int;
DEFINE FIELD end_line ON symbol TYPE int;
DEFINE FIELD signature ON symbol TYPE string;
DEFINE FIELD complexity ON symbol TYPE int;

-- 引用关系表
DEFINE TABLE reference TYPE RELATION IN symbol OUT symbol;
DEFINE FIELD type ON reference TYPE string;
DEFINE FIELD file_path ON reference TYPE string;
DEFINE FIELD line ON reference TYPE int;

-- 记忆条目表
DEFINE TABLE memory TYPE NORMAL SCHEMAFULL;
DEFINE FIELD id ON memory TYPE record;
DEFINE FIELD content ON memory TYPE string;
DEFINE FIELD type ON memory TYPE string;
DEFINE FIELD tags ON memory TYPE array<string>;
DEFINE FIELD project ON memory TYPE string;

-- 关系表
DEFINE TABLE relation TYPE RELATION IN memory OUT memory;
DEFINE FIELD type ON relation TYPE string;
DEFINE FIELD metadata ON relation TYPE object;
```

---

## 与 BACKLOG API 整合

```javascript
// 预计算时检测代码实现的任务
async detectImplementedTasks(analysis) {
  const taskRefs = this.extractTaskReferences(analysis.comments);

  for (const taskId of taskRefs) {
    await this.createRelation({
      from: `code:${analysis.filePath}`,
      to: `backlog:${taskId}`,
      type: 'implements'
    });

    await backlogApi.updateTask(taskId, {
      status: 'in_progress',
      implementedIn: analysis.filePath
    });
  }
}
```

---

## 实施路径（草案）

### Phase 1: 基础设施（4周）

- [ ] 云端部署架构（K8s/Docker）
- [ ] SurrealDB + Meilisearch 集群
- [ ] API Gateway 搭建
- [ ] 基础认证和限流

### Phase 2: 预计算服务（4周）

- [ ] 集成现有 code-analyzer.js
- [ ] AST 解析和符号提取
- [ ] 引用解析（跨文件）
- [ ] 存储到 SurrealDB

### Phase 3: 插件工具（3周）

- [ ] memory_write/read/search
- [ ] code_analyze/navigate
- [ ] 与 OpenCode 插件框架集成

### Phase 4: 代码分析增强（3周）

- [ ] 聚类（Leiden 算法）
- [ ] 执行流追踪
- [ ] 爆炸半径分析

### Phase 5: BACKLOG 整合（2周）

- [ ] 任务关联
- [ ] 自动状态更新
- [ ] 双向查询

### Phase 6: 本地部署（2周）

- [ ] Docker 容器化
- [ ] docker-compose 配置
- [ ] 文档和示例

---

## 待细化项

1. **具体的数据库 Schema**（字段类型、索引、关系）
2. **API 详细规范**（请求/响应格式、错误码）
3. **预计算性能优化**（并发控制、增量更新）
4. **安全策略**（认证、授权、审计）
5. **监控和告警**（性能指标、错误追踪）
6. **测试策略**（单元测试、集成测试、性能测试）

---

## 参考文档

- [UNIFIED-ARCHITECTURE-v2.0.md](./UNIFIED-ARCHITECTURE-v2.0.md)
- [COMPETITIVE-ANALYSIS-REPORT.md](./COMPETITIVE-ANALYSIS-REPORT.md)
- [BACKLOG_API_DESIGN.md](./BACKLOG_API_DESIGN.md)
- [CODE-ANALYSIS-DESIGN-v1.4.md](./CODE-ANALYSIS-DESIGN-v1.4.md)

---

_文档版本: v3.0.0 DRAFT_  
_最后更新: 2026-04-09_  
_状态: 初期版本，待细化_
