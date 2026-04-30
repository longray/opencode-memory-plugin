---
status: draft
version: 1.0.0
last_updated: 2026-05-01
owner: Prometheus
---

# OpenCode 记忆插件效果评估方案

**版本**: v1.1 (upgraded)
**日期**: 2026-05-01
**状态**: 设计完成，待实施
**评估对象**: opencode-memory-plugin v3.3 Atom Architecture

---

## 执行摘要

### 评估目标

量化评估 OpenCode 使用记忆插件（特别是 Atom Architecture）的效果，回答以下核心问题：

1. **知识组织质量**: Atom 树 vs 一大坨，哪种更适合 AI 推理？
2. **检索精准度**: Atom 粒度 vs Entity 粒度，哪个更高效？
3. **上下文效率**: 按 Atom 加载 vs 按 Entity 加载，token 节省多少？
4. **链接利用率**: [[atom_id]] 引用是否被有效使用？
5. **用户满意度**: 主观体验如何？

### 评估框架

采用**混合评估方法**：
- **定量指标**: token 使用、检索命中率、链接密度、响应时间
- **定性分析**: 案例研究、用户反馈、专家评审
- **A/B 测试**: 对比实验（Atom 模式 vs 传统模式）

---

## 一、评估维度与指标

### 1.1 知识组织质量

#### 指标定义

| 指标 | 定义 | 测量方法 |
|------|------|----------|
| **结构清晰度** | Atom 树的层级深度和逻辑一致性 | 平均层级深度、层级合理性评分 |
| **粒度均匀性** | Atom 内容长度的分布 | 内容长度标准差、异常值比例 |
| **链接密度** | [[atom_id]] 链接的使用频率 | 链接数 / Atom 数 |
| **完整性** | 知识覆盖的完整程度 | 专家评审、自动完整性检查 |

#### 基准值

```javascript
// 理想 Atom 结构
{
  "avg_depth": 2.5,        // 平均层级深度（1-4 为合理）
  "content_std": 150,      // 内容长度标准差（<200 为均匀）
  "link_density": 0.3,     // 每个 Atom 平均 0.3 个链接
  "orphan_rate": 0.05,     // 孤立 Atom 比例（<5% 为良好）
}
```

### 1.2 检索精准度

#### 指标定义

| 指标 | 定义 | 测量方法 |
|------|------|----------|
| **命中率** | 搜索返回相关结果的比例 | 人工标注 + 自动评估 |
| **精准率@K** | 前 K 个结果中相关的比例 | Precision@5, Precision@10 |
| **召回率** | 所有相关结果中被检索到的比例 | Recall@100 |
| **MRR** | 第一个相关结果的平均排名倒数 | Mean Reciprocal Rank |

#### 对比实验设计

```
实验组（Atom 模式）:
  - 知识存储为 Atom 树
  - 搜索返回 Atom 粒度结果
  - 上下文按 Atom 加载

对照组（传统模式）:
  - 知识存储为一大坨 content
  - 搜索返回 Entity 粒度结果
  - 上下文按 Entity 加载

控制变量:
  - 相同数据集
  - 相同查询集（50-100 个典型查询）
  - 相同评估者
```

### 1.3 上下文效率

#### 指标定义

| 指标 | 定义 | 测量方法 |
|------|------|----------|
| **Token 使用量** | 加载上下文消耗的 token 数 | 实际测量 |
| **有效信息密度** | 有用信息 / 总 token 数 | 人工评估 |
| **加载时间** | 从搜索到可用上下文的时间 | 性能测试 |
| **缓存命中率** | 重复查询的缓存命中比例 | 日志分析 |

#### 预期收益

| 场景 | 传统模式 | Atom 模式 | 节省 |
|------|----------|-----------|------|
| 代码查询 | 2000 tokens | 300 tokens | **85%** |
| 文档检索 | 1500 tokens | 400 tokens | **73%** |
| 对话记忆 | 1000 tokens | 200 tokens | **80%** |

### 1.4 链接利用率

#### 指标定义

| 指标 | 定义 | 测量方法 |
|------|------|----------|
| **链接创建率** | 内容中包含 [[atom_id]] 的比例 | 正则匹配统计 |
| **链接点击率** | 用户/AI 实际使用链接的频率 | 日志分析 |
| **链接有效性** | 链接指向存在的 Atom 的比例 | 死链检测 |
| **双向链接率** | 双向链接（A→B 且 B→A）的比例 | 图分析 |

### 1.5 用户满意度

#### 评估方法

**定量问卷**（5 分制 Likert 量表）：
- "搜索结果精准度"
- "上下文相关性"
- "响应速度"
- "整体满意度"

**定性访谈**（开放式问题）：
- "Atom 结构是否帮助理解知识？"
- "[[atom_id]] 链接是否有用？"
- "与传统模式相比的优势/劣势？"

---

## 二、统计方法

### 2.1 假设检验

所有对比实验采用双侧检验：

- **参数检验**: 独立样本 t 检验（两组数据均满足正态性时使用）
- **非参数检验**: Mann-Whitney U 检验（数据不满足正态性时使用）

正态性检验方法：Shapiro-Wilk 检验（样本量 < 50）或 Kolmogorov-Smirnov 检验（样本量 ≥ 50）。

### 2.2 显著性水平

- **显著性水平**: α = 0.05
- **多重比较校正**: 当同时检验多个指标时，使用 Bonferroni 校正

  ```text
  校正后 α = 0.05 / n_comparisons
  例如：检验 5 个指标 → 校正后 α = 0.01
  ```

### 2.3 效应量

使用 Cohen's d 衡量实际效果大小：

| 效应大小 | Cohen's d | 解释 |
|----------|-----------|------|
| 小 | 0.2 | 需要大样本才能检测 |
| 中 | 0.5 | 可感知的差异 |
| 大 | 0.8 | 明显的差异 |

计算公式：

```text
Cohen's d = (M_atom - M_entity) / S_pooled

S_pooled = sqrt(((n1-1) * s1² + (n2-1) * s2²) / (n1 + n2 - 2))
```

### 2.4 样本量计算

基于功效分析（Power Analysis），确保统计检验的可靠性：

```text
n = 2 * ((Z_α/2 + Z_β) / d)² * (1 + 1/k)

其中：
- Z_α/2 = 1.96 (α = 0.05 双侧)
- Z_β = 0.84 (功效 = 0.80)
- d = 预期效应量（Cohen's d）
- k = 两组样本量之比（k=1 表示等组）
```

| 预期效应 | 每组最少样本量 | 总样本量 |
|----------|---------------|----------|
| 大 (0.8) | 26 | 52 |
| 中 (0.5) | 64 | 128 |
| 小 (0.2) | 394 | 788 |

**推荐**: 以中等效应量（d=0.5）为目标，每组至少 64 个观测值。

### 2.5 置信区间

所有估计量报告 95% 置信区间：

```text
CI = x̄ ± 1.96 * (s / sqrt(n))
```

效应量的置信区间使用非中心化 t 分布计算。

---

## 三、基线测量

### 3.1 测量对象

从当前系统（v3.2，不含 Atom Architecture）收集基线数据。

### 3.2 测量协议

#### 准备工作

1. **环境隔离**: 搭建独立的测试后端实例，使用 `default` tenant
2. **数据准备**: 导入 100+ Entity，不含 atoms 字段
3. **查询集准备**: 准备 50-100 个典型查询，覆盖以下类别：

   | 类别 | 数量 | 示例 |
   |------|------|------|
   | 代码查询 | 20 | "Vue3 Composition API" |
   | 概念检索 | 15 | "error handling patterns" |
   | 对话记忆 | 15 | "用户偏好 TypeScript" |
   | 项目知识 | 10 | "memory-core.js 同步逻辑" |
   | 边界场景 | 10 | "不存在的概念" |

#### 测量步骤

```text
1. 启动 v3.2 后端，确认服务正常（index_status）
2. 执行全量同步（full_sync），确保数据完整
3. 运行基线测量脚本，记录以下指标：
   a. 检索精准度（Precision@5, Precision@10, MRR）
   b. 响应时间（p50, p95, p99）
   c. Token 使用量（按场景分类）
   d. 链接密度（v3.2 基线为 0）
4. 重复 3 次，取中位数作为基线值
5. 记录环境信息（后端版本、数据量、硬件配置）
```

### 3.3 基线指标（待测量）

| 指标 | v3.2 基线 | 单位 | 测量方法 |
|------|-----------|------|----------|
| Precision@5 | 待测量 | - | 自动评估 |
| Precision@10 | 待测量 | - | 自动评估 |
| MRR | 待测量 | - | 自动评估 |
| 响应时间 p50 | 待测量 | ms | 性能测试 |
| 响应时间 p95 | 待测量 | ms | 性能测试 |
| 代码查询 token | 待测量 | tokens | 上下文测量 |
| 文档检索 token | 待测量 | tokens | 上下文测量 |
| 对话记忆 token | 待测量 | tokens | 上下文测量 |
| 链接密度 | 0（无 Atom） | - | 结构分析 |
| 用户满意度 | 待测量 | /5 | 问卷调查 |

---

## 四、A/B 测试设计

### 4.1 随机化方法

- **被试间设计**（between-subjects）: 每个参与者只体验一种模式
- **随机分配**: 使用简单随机分配，通过哈希函数确保可重复性

  ```javascript
  function assignGroup(participantId) {
    const hash = simpleHash(participantId);
    return hash % 2 === 0 ? 'atom' : 'entity';
  }
  ```

- **分层因素**: 按使用经验（新手 / 熟练 / 专家）分层，确保各组经验分布均衡

### 4.2 交叉验证设计

为控制个体差异和学习效应，采用**拉丁方设计**（Latin Square）进行交叉实验：

| 阶段 | A 组 | B 组 |
|------|------|------|
| Period 1 | Atom 模式 | Entity 模式 |
| Washout | 休息期（3 天） | 休息期（3 天） |
| Period 2 | Entity 模式 | Atom 模式 |

- **Washout 期**: 两组之间设置 3 天休息期，消除学习效应
- **顺序效应检验**: 检验 Period × Group 交互作用是否显著
- **适用范围**: 仅适用于需要同一用户对比两种模式的场景（如检索精准度、token 效率）

### 4.3 控制变量

| 控制变量 | 控制方法 | 说明 |
|----------|----------|------|
| 数据集 | 相同的 100+ Entity | 确保内容一致性 |
| 查询顺序 | 拉丁方随机化 | 消除顺序效应 |
| 时间段 | 同一天同一时段 | 控制后端负载差异 |
| 后端版本 | 固定版本号 | 避免版本差异 |
| 网络 | 同一网络环境 | 控制延迟差异 |
| 评估者 | 盲评 | 评估者不知道分组 |

---

## 五、评估工具与脚本

### 5.1 自动化测试脚本

> **注意**: 以下脚本为伪代码设计，待实现为可执行脚本。可执行版本将放置在 `../scripts/` 目录。

#### 脚本 1: 知识组织质量分析

```javascript
// evaluate-atom-quality.js — 伪代码 → 待实现为可执行脚本
// 可执行版本: ../scripts/evaluate-atom-quality.js
import { getEntityAtoms } from './lib/memory-core.js';
import { getConfig } from './lib/storage.js';

async function evaluateAtomQuality(entryId) {
  const result = await getEntityAtoms({ entry_id: entryId });
  const tree = result.tree;

  const metrics = {
    avg_depth: calculateAverageDepth(tree),
    max_depth: calculateMaxDepth(tree),
    content_lengths: extractContentLengths(tree),
    content_std: calculateStd(extractContentLengths(tree)),
    total_atoms: countAtoms(tree),
    total_links: countWikiLinks(tree),
    link_density: countWikiLinks(tree) / countAtoms(tree),
    orphan_rate: countOrphanAtoms(tree) / countAtoms(tree),
  };

  return metrics;
}

async function batchEvaluate() {
  const config = await getConfig();
  const entryIds = await getAllEntryIds();

  const results = [];
  for (const id of entryIds) {
    const metrics = await evaluateAtomQuality(id);
    results.push({ entry_id: id, ...metrics });
  }

  const summary = {
    total_entities: results.length,
    avg_depth: average(results.map(r => r.avg_depth)),
    avg_link_density: average(results.map(r => r.link_density)),
    avg_orphan_rate: average(results.map(r => r.orphan_rate)),
  };

  console.log('=== Atom 质量评估报告 ===');
  console.log(JSON.stringify(summary, null, 2));

  return summary;
}
```

#### 脚本 2: 检索性能对比

```javascript
// evaluate-search-performance.js — 伪代码 → 待实现为可执行脚本
// 可执行版本: ../scripts/evaluate-search-performance.js
import { memory_search } from './tools/search.js';

const TEST_QUERIES = [
  { query: "Vue3 Composition API", expected: ["setup", "ref", "reactive"] },
  { query: "error handling patterns", expected: ["try-catch", "async", "promise"] },
  // ... 50-100 个测试查询
];

async function evaluateSearchPerformance(mode = 'atom') {
  const results = [];

  for (const test of TEST_QUERIES) {
    const startTime = Date.now();
    const searchResults = await memory_search({
      query: test.query,
      scope: mode,
      limit: 10,
    });
    const endTime = Date.now();

    const relevant = searchResults.filter(r =>
      test.expected.some(e => r.content.includes(e))
    ).length;

    results.push({
      query: test.query,
      precision_at_10: relevant / 10,
      response_time: endTime - startTime,
      result_count: searchResults.length,
    });
  }

  const summary = {
    mode,
    avg_precision: average(results.map(r => r.precision_at_10)),
    avg_response_time: average(results.map(r => r.response_time)),
    total_queries: results.length,
  };

  return { summary, details: results };
}

async function runComparison() {
  const atomResults = await evaluateSearchPerformance('atom');
  const entityResults = await evaluateSearchPerformance('entity');

  console.log('=== 检索性能对比 ===');
  console.log('Atom 模式:', atomResults.summary);
  console.log('Entity 模式:', entityResults.summary);

  const improvement = {
    precision: (atomResults.summary.avg_precision - entityResults.summary.avg_precision) / entityResults.summary.avg_precision,
    speed: (entityResults.summary.avg_response_time - atomResults.summary.avg_response_time) / entityResults.summary.avg_response_time,
  };

  console.log('提升:', improvement);
}
```

#### 脚本 3: 上下文效率测量

```javascript
// evaluate-context-efficiency.js — 伪代码 → 待实现为可执行脚本
// 可执行版本: ../scripts/evaluate-context-efficiency.js
import { memory_read } from './tools/core.js';
import { getEntityAtoms } from './lib/memory-core.js';

async function measureContextEfficiency(entryId, mode = 'atom') {
  let tokens = 0;
  let content = '';

  if (mode === 'atom') {
    const atoms = await getEntityAtoms({ entry_id: entryId });
    const relevantAtoms = selectRelevantAtoms(atoms.tree, query);
    content = relevantAtoms.map(a => a.content).join('\n\n');
  } else {
    const entity = await memory_read({ entry_id: entryId, level: 2 });
    content = entity.content;
  }

  tokens = Math.ceil(content.length / 4);

  return {
    mode,
    tokens,
    content_length: content.length,
    preview: content.substring(0, 200),
  };
}

async function batchMeasure() {
  const entryIds = await getAllEntryIds();
  const results = [];

  for (const id of entryIds) {
    const atomResult = await measureContextEfficiency(id, 'atom');
    const entityResult = await measureContextEfficiency(id, 'entity');

    results.push({
      entry_id: id,
      atom_tokens: atomResult.tokens,
      entity_tokens: entityResult.tokens,
      savings: (entityResult.tokens - atomResult.tokens) / entityResult.tokens,
    });
  }

  const summary = {
    avg_atom_tokens: average(results.map(r => r.atom_tokens)),
    avg_entity_tokens: average(results.map(r => r.entity_tokens)),
    avg_savings: average(results.map(r => r.savings)),
  };

  console.log('=== 上下文效率评估 ===');
  console.log('Atom 模式平均 token:', summary.avg_atom_tokens);
  console.log('Entity 模式平均 token:', summary.avg_entity_tokens);
  console.log('平均节省:', (summary.avg_savings * 100).toFixed(1) + '%');

  return summary;
}
```

### 5.2 可视化仪表板

#### 设计草图

```
┌─────────────────────────────────────────────────────────────┐
│           OpenCode 记忆插件效果评估仪表板                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 知识组织质量  │  │  检索精准度   │  │  上下文效率   │      │
│  │   85/100     │  │   92/100     │  │   78/100     │      │
│  │   [████░]    │  │   [█████]    │  │   [████░]    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  知识组织详情                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 平均层级深度: 2.3        链接密度: 0.35              │   │
│  │ 内容均匀性: 良好         孤立节点: 3%                │   │
│  │                                                     │   │
│  │ [Atom 树可视化 - 可交互展开/折叠]                    │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  检索性能对比                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Precision@10:  Atom 0.85  vs  Entity 0.62  ↑37%     │   │
│  │ MRR:           Atom 0.72  vs  Entity 0.51  ↑41%     │   │
│  │ 响应时间:      Atom 120ms vs  Entity 180ms ↓33%     │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Token 使用效率                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 场景        │ 传统模式  │ Atom 模式  │ 节省        │   │
│  │ 代码查询    │ 2000      │ 300        │ 85%        │   │
│  │ 文档检索    │ 1500      │ 400        │ 73%        │   │
│  │ 对话记忆    │ 1000      │ 200        │ 80%        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 实现技术栈

- **前端**: React + Recharts（可视化）
- **后端**: Express + 评估脚本 API
- **数据源**: 记忆插件日志、评估脚本输出

---

## 六、评估流程

### 6.1 准备阶段（Week 1）

| 任务 | 负责人 | 产出 |
|------|--------|------|
| 准备测试数据集 | 开发团队 | 100+ Entity，50% Atom 化 |
| 设计测试查询集 | 产品团队 | 50-100 个典型查询 |
| 搭建评估环境 | 开发团队 | 隔离的测试后端 |
| 开发评估脚本 | 开发团队 | 3 个核心脚本 |

### 6.2 基线测量（Week 2）

| 任务 | 方法 | 产出 |
|------|------|------|
| 传统模式基线 | 禁用 Atom 功能 | 基线指标报告 |
| Atom 模式测量 | 启用完整 Atom 功能 | Atom 指标报告 |
| 对比分析 | 统计对比（见第二章统计方法） | 提升/下降分析 |

### 6.3 用户研究（Week 3-4）

| 任务 | 方法 | 样本量 |
|------|------|--------|
| 定量问卷 | 在线问卷（SUS + NPS，见附录 A） | 50+ 用户 |
| 定性访谈 | 30分钟访谈 | 10-15 用户 |
| 可用性测试 | 任务完成测试 | 8-10 用户 |

### 6.4 报告与优化（Week 5）

| 任务 | 产出 |
|------|------|
| 综合评估报告 | PDF + 在线仪表板 |
| 优化建议 | 优先级排序的改进项 |
| 迭代计划 | 下一版本优化路线图 |

---

## 七、成功标准

### 7.1 定量目标

| 指标 | 基线（传统） | 目标（Atom） | 最低可接受 | 统计要求 |
|------|-------------|-------------|-----------|----------|
| Precision@10 | 待测量 | 0.80 | 0.70 | p < 0.05, d ≥ 0.5 |
| Token 节省 | 0% | 70% | 50% | p < 0.05, d ≥ 0.5 |
| 响应时间 | 待测量 | 150ms | 180ms | p < 0.05 |
| 链接密度 | 0 | 0.30 | 0.20 | 描述性统计 |
| 用户满意度 | 待测量 | 4.5/5 | 4.0/5 | p < 0.05 |

### 7.2 定性目标

- [ ] 用户能直观理解 Atom 结构的价值
- [ ] 用户主动使用 [[atom_id]] 链接
- [ ] 开发者认为 Atom 架构提升工作效率
- [ ] 愿意推荐给其他 OpenCode 用户

---

## 八、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 测试数据不具代表性 | 中 | 高 | 多场景采样、真实用户数据 |
| 评估指标定义模糊 | 低 | 中 | 专家评审、预测试验证 |
| 用户参与度低 | 中 | 中 | 激励措施、简化参与流程 |
| 技术故障 | 低 | 高 | 备份方案、监控告警 |
| 统计功效不足 | 中 | 高 | 按第三章公式预先计算样本量 |
| 学习效应干扰 | 中 | 中 | 拉丁方交叉设计消除 |

---

## 九、附录

### 附录 A：标准化问卷

#### A.1 SUS（System Usability Scale）

> 来源: Brooke, J. (1996). SUS: A "quick and dirty" usability scale.

请对以下每项陈述选择您的同意程度（1 = 非常不同意，5 = 非常同意）：

| # | 陈述 | 1 | 2 | 3 | 4 | 5 |
|---|------|---|---|---|---|---|
| Q1 | 我觉得我会经常想要使用这个系统 | | | | | |
| Q2 | 我觉得这个系统不必要地复杂 | | | | | |
| Q3 | 我觉得这个系统很容易使用 | | | | | |
| Q4 | 我觉得我需要技术人员的帮助才能使用这个系统 | | | | | |
| Q5 | 我觉得这个系统中的各种功能整合得很好 | | | | | |
| Q6 | 我觉得这个系统中存在太多不一致的地方 | | | | | |
| Q7 | 我觉得大多数人都能很快学会使用这个系统 | | | | | |
| Q8 | 我觉得这个系统用起来非常麻烦 | | | | | |
| Q9 | 我在使用这个系统时感到非常有信心 | | | | | |
| Q10 | 我需要学习很多东西才能开始使用这个系统 | | | | | |

**计分方法**：

```text
1. Q1, Q3, Q5, Q7, Q9 的分数 = 原始分 - 1
2. Q2, Q4, Q6, Q8, Q10 的分数 = 5 - 原始分
3. SUS 总分 = (所有调整后分数之和) × 2.5
4. 分数范围: 0-100（越高越好）
5. 参考值: 平均 68，优秀 ≥ 80.3
```

#### A.2 NPS（Net Promoter Score）

> 来源: Reichheld, F. (2003). The One Number You Need to Grow.

```
基于您使用 OpenCode 记忆插件的体验，您有多大可能向其他开发者推荐它？

请选择 0-10 之间的数字：

0 ─── 1 ─── 2 ─── 3 ─── 4 ─── 5 ─── 6 ─── 7 ─── 8 ─── 9 ─── 10
|       |       |       |       |       |       |       |       |
贬损者   ←               中立者                 →     推荐者
(0-6)                           (7-8)                     (9-10)
```

**计分方法**：

```text
NPS = 推荐者比例(%) - 贬损者比例(%)
范围: -100 到 +100
参考值: > 0 为良好，> 50 为优秀，> 70 为世界级
```

### 附录 B：评估脚本清单

| 脚本 | 功能 | 输出 | 状态 |
|------|------|------|------|
| `evaluate-atom-quality.js` | Atom 结构质量分析 | JSON 报告 | 伪代码 |
| `evaluate-search-performance.js` | 检索性能对比 | JSON 报告 | 伪代码 |
| `evaluate-context-efficiency.js` | 上下文效率测量 | JSON 报告 | 伪代码 |
| `evaluate-link-usage.js` | 链接利用率统计 | JSON 报告 | 伪代码 |
| `generate-dashboard.js` | 生成可视化仪表板 | HTML | 伪代码 |

### 附录 C：问卷模板

**定性访谈提纲**:

```
1. 请描述一次使用记忆插件解决问题的经历。
2. Atom 结构（层级化组织）是否帮助你更好地理解知识？
3. [[atom_id]] 链接功能是否有用？使用频率如何？
4. 与传统的一大坨存储方式相比，Atom 架构的优势和劣势是什么？
5. 有什么改进建议？
```

---

## 交叉引用

- [Atom 架构详细设计](../architecture/ATOM-ARCHITECTURE.md)
- [集成方案设计](../integration/DESIGN-INTEGRATION.md)

---

**下一步行动**: 开始准备阶段，搭建评估环境和测试数据集。
