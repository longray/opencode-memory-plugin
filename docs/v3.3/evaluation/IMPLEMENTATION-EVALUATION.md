---
status: draft
version: 1.0.0
last_updated: 2026-05-01
owner: Prometheus
---

# 评估实施手册

**版本**: v1.0.0
**日期**: 2026-05-01
**前置文档**: [评估方案设计](./DESIGN-EVALUATION.md)

---

## 一、环境搭建

### 1.1 前置条件

| 项目     | 要求                           | 验证命令                                                                    |
| -------- | ------------------------------ | --------------------------------------------------------------------------- |
| Node.js  | >= 18.0.0                      | `node -v`                                                                   |
| 后端服务 | localhost:18008 运行中         | `(Invoke-WebRequest -Uri http://localhost:18008/health).Content`            |
| API Key  | `WRAPPER_MEILI_API_KEY` 已设置 | `$env:WRAPPER_MEILI_API_KEY`                                                |
| 内存     | >= 4GB 可用                    | `Get-CimInstance Win32_OperatingSystem \| Select-Object FreePhysicalMemory` |
| 磁盘     | >= 2GB 可用                    | `Get-PSDrive C`                                                             |

### 1.2 安装依赖

```bash
# 从项目根目录
cd D:\github\opencode-memory-plugin
npm install

# 验证插件可用
node -e "import('./opencode-memory-plugin/lib/storage.js').then(m => console.log('OK:', Object.keys(m)))"
```

### 1.3 创建隔离测试环境

评估必须在独立环境中进行，避免污染生产数据。

```bash
# 1. 设置测试用 tenant
$env:WRAPPER_MEILI_API_KEY = "your-api-key"
$env:EVALUATION_TENANT = "evaluation-test"

# 2. 确认后端健康
node -e "
import { WrapperClient } from './opencode-memory-plugin/lib/wrapper-client.js';
const c = new WrapperClient();
const r = await c.health();
console.log(r);
"
```

**环境隔离策略**：

- 使用 `evaluation-test` tenant 隔离测试数据
- 测试结束后通过 API 清空该 tenant 的全部数据
- 不影响 `default` tenant 的生产记忆

### 1.4 目录结构准备

```text
evaluation/
├── DESIGN-EVALUATION.md           # 评估设计（已有）
├── IMPLEMENTATION-EVALUATION.md   # 本文件
├── scripts/                       # 评估脚本
│   ├── evaluate-atom-quality.js
│   ├── evaluate-search-performance.js
│   └── evaluate-context-efficiency.js
├── data/                          # 测试数据集
│   ├── queries.json               # 测试查询集
│   └── expected-results.json      # 期望结果（人工标注）
├── reports/                       # 评估输出
│   ├── baseline/                  # 基线数据
│   ├── atom/                      # Atom 模式数据
│   └── final/                     # 最终报告
└── logs/                          # 运行日志
```

创建目录：

```bash
New-Item -ItemType Directory -Force -Path docs/v3.3/evaluation/data
New-Item -ItemType Directory -Force -Path docs/v3.3/evaluation/reports/baseline
New-Item -ItemType Directory -Force -Path docs/v3.3/evaluation/reports/atom
New-Item -ItemType Directory -Force -Path docs/v3.3/evaluation/reports/final
New-Item -ItemType Directory -Force -Path docs/v3.3/evaluation/logs
```

---

## 二、测试数据集准备

### 2.1 数据集规格

| 属性         | 要求                                                                           |
| ------------ | ------------------------------------------------------------------------------ |
| Entity 总数  | >= 100                                                                         |
| Atom 化比例  | ~50%（50 个含 atoms，50 个不含）                                               |
| 内容类型分布 | 代码查询 20%、概念检索 15%、对话记忆 15%、项目知识 10%、边界场景 10%、补充 30% |
| 标签覆盖     | >= 10 个不同标签                                                               |
| 时间跨度     | 最近 30 天内                                                                   |

### 2.2 生成样例数据

批量生成脚本尚未实现（计划位于 `scripts/generate-test-data.js`），目前需手动通过 `memory_write` 写入测试数据。

**手动写入 Atom 化 Entity 示例**：

```javascript
// 代码分析类（带 Atom 树）
await memory_write({
  abstract: "Vue3 Composition API 核心概念",
  overview:
    "涵盖 setup、ref、reactive、computed、watch 等 Composition API 核心函数的使用方式和最佳实践",
  content: "Vue3 Composition API 是 Vue3 的核心编程模型...",
  type: "memory",
  tags: ["vue3", "composition-api", "frontend"],
  atoms: [
    {
      local_id: "01CHAP001",
      type: "chapter",
      name: "setup() 函数",
      content:
        "setup 是 Composition API 的入口函数，在 beforeCreate 之前执行...",
      order: "a0",
      heading_level: 1,
      parent_id: null,
      children: [
        {
          local_id: "01SEC001",
          type: "section",
          name: "基本用法",
          content: "在组件中定义 setup 函数，返回模板使用的响应式数据和方法...",
          order: "a0",
          heading_level: 2,
          parent_id: "01CHAP001",
          children: [],
        },
      ],
    },
  ],
});

// 传统模式 Entity（不带 atoms）
await memory_write({
  abstract: "Error handling patterns in Node.js",
  overview:
    "Node.js 中常见的错误处理模式，包括 try-catch、event emitters、async/await 等",
  content: "Node.js 错误处理的最佳实践和实践模式...",
  type: "memory",
  tags: ["nodejs", "error-handling", "backend"],
});
```

### 2.3 Atom 化指南

| 内容类型 | Atom 结构建议                     | 每个 Atom 内容长度 |
| -------- | --------------------------------- | ------------------ |
| 代码分析 | function/class → section → detail | 200-500 字         |
| 技术文档 | chapter → section → note          | 200-500 字         |
| API 文档 | endpoint → params → examples      | 150-300 字         |
| 项目知识 | module → component → function     | 200-400 字         |
| 决策记录 | context → options → decision      | 100-300 字         |

**Atom 质量检查清单**：

- [ ] 层级深度不超过 4 层
- [ ] 每个 Atom 有唯一的 `local_id`
- [ ] 内容长度在 100-800 字之间
- [ ] `[[local_id]]` 链接指向实际存在的 Atom
- [ ] 无循环引用（A→B→A）
- [ ] 无孤立 Atom（除根节点外都有 parent_id）

### 2.4 查询集准备

创建 `data/queries.json`，包含 50-100 个典型查询：

```json
[
  {
    "id": "Q001",
    "query": "Vue3 Composition API setup 函数用法",
    "category": "code",
    "expected_keywords": ["setup", "ref", "reactive"],
    "expected_entry_ids": ["01KQ..."]
  },
  {
    "id": "Q002",
    "query": "error handling patterns",
    "category": "concept",
    "expected_keywords": ["try-catch", "async", "promise"],
    "expected_entry_ids": []
  },
  {
    "id": "Q050",
    "query": "完全不存在的概念xyz123",
    "category": "edge",
    "expected_keywords": [],
    "expected_entry_ids": []
  }
]
```

**查询类别分布**（与 DESIGN-EVALUATION.md 对齐）：

| 类别     | 数量 | 覆盖重点                     |
| -------- | ---- | ---------------------------- |
| 代码查询 | 20   | 函数名、API 用法、代码模式   |
| 概念检索 | 15   | 设计模式、架构概念、最佳实践 |
| 对话记忆 | 15   | 用户偏好、历史决策、经验教训 |
| 项目知识 | 10   | 模块结构、依赖关系、配置     |
| 边界场景 | 10   | 空结果、拼写错误、歧义查询   |
| 补充     | 30+  | 跨类别混合查询               |

---

## 三、执行步骤

> **前提条件**: 运行评估脚本前，先执行 `node scripts/seed-test-data.mjs` 生成测试数据。
> 脚本会输出 entryId，后续评估脚本使用该 ID。

### 3.1 Week 1: 准备阶段

| 天    | 任务                       | 产出                             | 验收标准                     |
| ----- | -------------------------- | -------------------------------- | ---------------------------- |
| D1    | 搭建隔离测试环境           | 可用的测试后端                   | `index_status` 返回健康      |
| D1    | 创建目录结构               | `data/`, `reports/`, `logs/`     | 目录存在                     |
| D2    | 编写/完善测试数据生成脚本  | `generate-test-data.js`          | 可生成 100+ Entity           |
| D2-D3 | 生成测试数据集             | 100+ Entity（50% Atom 化）       | 数据集导入成功               |
| D3    | 准备查询集                 | `data/queries.json`              | 50-100 个查询，5 类覆盖      |
| D3    | 人工标注期望结果           | `data/expected-results.json`     | 每个查询有 expected_keywords |
| D4    | 实现评估脚本（Atom 质量）  | `evaluate-atom-quality.js`       | 可运行并输出 JSON            |
| D4    | 实现评估脚本（检索性能）   | `evaluate-search-performance.js` | 可运行并输出 JSON            |
| D5    | 实现评估脚本（上下文效率） | `evaluate-context-efficiency.js` | 可运行并输出 JSON            |
| D5    | 端到端测试全部脚本         | 脚本全部可运行                   | 无报错，输出格式正确         |

### 3.2 Week 2: 基线测量

| 天     | 任务                     | 产出                      | 验收标准                 |
| ------ | ------------------------ | ------------------------- | ------------------------ |
| D6     | 确认测试数据完整         | 数据完整性报告            | 100+ Entity 已同步       |
| D6     | 运行基线测量（第 1 轮）  | `reports/baseline/run-1/` | 所有指标有数值           |
| D7     | 运行基线测量（第 2 轮）  | `reports/baseline/run-2/` | 与第 1 轮偏差 < 10%      |
| D7     | 运行基线测量（第 3 轮）  | `reports/baseline/run-3/` | 取中位数作为基线         |
| D8     | Atom 模式测量（第 1 轮） | `reports/atom/run-1/`     | 所有指标有数值           |
| D8     | Atom 模式测量（第 2 轮） | `reports/atom/run-2/`     | 与第 1 轮偏差 < 10%      |
| D9     | Atom 模式测量（第 3 轮） | `reports/atom/run-3/`     | 取中位数                 |
| D9-D10 | 对比分析                 | 初步对比报告              | t 检验/Mann-Whitney 完成 |

### 3.3 Week 3-4: 用户研究

| 周      | 任务         | 方法                  | 产出            |
| ------- | ------------ | --------------------- | --------------- |
| W3 D1-2 | 设计问卷     | 基于 SUS + NPS 模板   | 在线问卷链接    |
| W3 D2-3 | 招募参与者   | 社区邀请 + 内部推荐   | 50+ 注册用户    |
| W3 D3-5 | 定量数据收集 | 在线问卷              | 原始问卷数据    |
| W4 D1-3 | 定性访谈     | 30 分钟/人，10-15 人  | 访谈记录        |
| W4 D3-4 | 可用性测试   | 任务完成测试，8-10 人 | 测试录屏 + 记录 |
| W4 D4-5 | 数据整理     | 编码、清洗            | 结构化数据集    |

### 3.4 Week 5: 报告生成

| 天    | 任务         | 产出                      |
| ----- | ------------ | ------------------------- |
| D1-D2 | 统计分析     | 描述性统计 + 假设检验结果 |
| D2-D3 | 可视化图表   | 对比图、分布图、趋势图    |
| D3-D4 | 撰写综合报告 | PDF + 在线仪表板          |
| D4    | 交叉评审     | 内部评审意见              |
| D5    | 优化建议     | 优先级排序的改进项列表    |

---

## 四、脚本执行

### 4.1 evaluate-atom-quality.js

**功能**：分析所有 Atom 化 Entity 的结构质量。

```bash
# 基本运行
node docs/v3.3/evaluation/scripts/evaluate-atom-quality.js

# 指定输出目录
node docs/v3.3/evaluation/scripts/evaluate-atom-quality.js --output reports/baseline/run-1

# 指定 tenant
node docs/v3.3/evaluation/scripts/evaluate-atom-quality.js --tenant evaluation-test
```

**预期输出格式**：

```json
{
  "timestamp": "2026-05-01T10:00:00.000Z",
  "run_id": "run-1",
  "summary": {
    "total_entities": 100,
    "atomized_entities": 50,
    "avg_depth": 2.3,
    "max_depth": 4,
    "avg_content_length": 350,
    "content_std": 145,
    "total_atoms": 320,
    "total_links": 96,
    "link_density": 0.3,
    "orphan_rate": 0.04,
    "dead_link_rate": 0.02
  },
  "per_entity": [
    {
      "entry_id": "01KQ...",
      "atom_count": 6,
      "depth": 3,
      "link_count": 2,
      "content_std": 120,
      "orphan_count": 0
    }
  ]
}
```

**输出文件**：

- `reports/{dir}/atom-quality-summary.json` — 汇总指标
- `reports/{dir}/atom-quality-details.json` — 逐 Entity 明细

### 4.2 evaluate-search-performance.js

**功能**：对比 Atom 模式和 Entity 模式的检索性能。

```bash
# 运行对比测试
node docs/v3.3/evaluation/scripts/evaluate-search-performance.js

# 仅运行 Atom 模式
node docs/v3.3/evaluation/scripts/evaluate-search-performance.js --mode atom

# 仅运行 Entity 模式
node docs/v3.3/evaluation/scripts/evaluate-search-performance.js --mode entity

# 自定义查询集
node docs/v3.3/evaluation/scripts/evaluate-search-performance.js --queries data/queries.json

# 指定重复次数
node docs/v3.3/evaluation/scripts/evaluate-search-performance.js --repeats 3
```

**预期输出格式**：

```json
{
  "timestamp": "2026-05-01T10:30:00.000Z",
  "run_id": "run-1",
  "atom_mode": {
    "avg_precision_at_5": 0.78,
    "avg_precision_at_10": 0.72,
    "avg_mrr": 0.85,
    "avg_response_time_ms": 120,
    "p50_response_time_ms": 95,
    "p95_response_time_ms": 250,
    "p99_response_time_ms": 480,
    "total_queries": 70,
    "zero_result_queries": 3
  },
  "entity_mode": {
    "avg_precision_at_5": 0.55,
    "avg_precision_at_10": 0.48,
    "avg_mrr": 0.62,
    "avg_response_time_ms": 180,
    "p50_response_time_ms": 150,
    "p95_response_time_ms": 350,
    "p99_response_time_ms": 700,
    "total_queries": 70,
    "zero_result_queries": 3
  },
  "comparison": {
    "precision_improvement": 0.5,
    "mrr_improvement": 0.37,
    "speed_improvement": 0.33
  },
  "per_query": [
    {
      "query_id": "Q001",
      "query": "Vue3 Composition API",
      "atom_precision_at_10": 0.8,
      "entity_precision_at_10": 0.5,
      "atom_response_time_ms": 85,
      "entity_response_time_ms": 160
    }
  ]
}
```

### 4.3 evaluate-context-efficiency.js

**功能**：测量 Atom 粒度加载 vs Entity 整体加载的 token 消耗差异。

```bash
# 运行效率测量
node docs/v3.3/evaluation/scripts/evaluate-context-efficiency.js

# 按场景分类输出
node docs/v3.3/evaluation/scripts/evaluate-context-efficiency.js --by-category

# 仅测量 Atom 化 Entity
node docs/v3.3/evaluation/scripts/evaluate-context-efficiency.js --atomized-only
```

**预期输出格式**：

```json
{
  "timestamp": "2026-05-01T11:00:00.000Z",
  "run_id": "run-1",
  "summary": {
    "total_entities_measured": 50,
    "avg_atom_tokens": 280,
    "avg_entity_tokens": 1850,
    "avg_savings_percent": 78.5,
    "median_savings_percent": 80.2
  },
  "by_category": {
    "code": {
      "count": 20,
      "avg_atom_tokens": 220,
      "avg_entity_tokens": 2100,
      "avg_savings_percent": 89.5
    },
    "concept": {
      "count": 15,
      "avg_atom_tokens": 310,
      "avg_entity_tokens": 1600,
      "avg_savings_percent": 80.6
    },
    "conversation": {
      "count": 15,
      "avg_atom_tokens": 180,
      "avg_entity_tokens": 1200,
      "avg_savings_percent": 85.0
    }
  },
  "per_entity": [
    {
      "entry_id": "01KQ...",
      "category": "code",
      "atom_tokens": 150,
      "entity_tokens": 2000,
      "savings_percent": 92.5
    }
  ]
}
```

### 4.4 常见问题排查

| 问题             | 症状                   | 解决方案                                                        |
| ---------------- | ---------------------- | --------------------------------------------------------------- |
| 后端连接失败     | `ECONNREFUSED`         | 检查后端是否在 18008 端口运行                                   |
| tenant 不匹配    | 查询返回 0 结果        | 确认 `WRAPPER_MEILI_API_KEY` 和 tenant 一致                     |
| 数据未同步       | `synced: false`        | 运行 `full_sync` 后重试                                         |
| 脚本模块导入失败 | `ERR_MODULE_NOT_FOUND` | 从项目根目录运行，检查相对路径                                  |
| 内存不足         | 进程 OOM               | 减少 batch size 或分批处理                                      |
| 中文编码乱码     | 输出乱码               | 设置 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` |
| 结果偏差大       | 轮次间偏差 > 20%       | 检查后端负载，增加 repeats 次数                                 |

---

## 五、数据收集

### 5.1 日志格式

每次脚本运行自动生成日志到 `logs/` 目录：

```text
logs/
├── 2026-05-01-atom-quality-run1.log
├── 2026-05-01-search-perf-run1.log
├── 2026-05-01-context-eff-run1.log
└── 2026-05-01-environment.log
```

日志格式（每行一条 JSON）：

```json
{"ts":"2026-05-01T10:00:01.234Z","level":"info","msg":"开始评估","script":"evaluate-atom-quality","run_id":"run-1"}
{"ts":"2026-05-01T10:00:05.678Z","level":"info","msg":"处理 Entity","entry_id":"01KQ...","atom_count":6}
{"ts":"2026-05-01T10:00:10.000Z","level":"error","msg":"请求失败","error":"ECONNREFUSED","retry":1}
```

### 5.2 指标聚合

基线测量需运行 3 轮，取中位数：

```javascript
// 聚合示例
const runs = [
  { precision_at_10: 0.71, response_time_ms: 125 },
  { precision_at_10: 0.73, response_time_ms: 118 },
  { precision_at_10: 0.72, response_time_ms: 122 },
];

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const baseline = {
  precision_at_10: median(runs.map((r) => r.precision_at_10)),
  response_time_ms: median(runs.map((r) => r.response_time_ms)),
};
// baseline = { precision_at_10: 0.72, response_time_ms: 122 }
```

### 5.3 数据导出

评估完成后，将所有数据导出为标准格式：

```bash
# 导出为 CSV（便于 Excel 分析）— 规划中，尚未实现
# node docs/v3.3/evaluation/scripts/export-csv.js --input reports/ --output reports/final/all-metrics.csv

# 导出为 JSON（便于程序分析）— 规划中，尚未实现
# node docs/v3.3/evaluation/scripts/export-json.js --input reports/ --output reports/final/all-metrics.json
```

---

## 六、报告生成

### 6.1 报告模板结构

```markdown
# OpenCode 记忆插件效果评估报告

## 1. 执行摘要

- 评估目标、方法、主要发现（1 页）

## 2. 评估环境

- 硬件配置、后端版本、数据集描述

## 3. 基线数据

- v3.2（传统模式）各指标数值

## 4. Atom 模式结果

- 各维度指标数值

## 5. 对比分析

### 5.1 知识组织质量

- Atom 结构深度、链接密度、孤立率

### 5.2 检索精准度

- Precision@5/10、MRR、响应时间
- 统计检验结果（p 值、效应量）

### 5.3 上下文效率

- Token 节省比例（按场景分类）

### 5.4 链接利用率

- 链接创建率、有效性、双向率

## 6. 用户满意度

- SUS 评分、NPS、定性反馈汇总

## 7. 结论与建议

- 是否达到成功标准
- 优先级排序的改进项

## 附录

- 原始数据表
- 统计检验详细结果
- 用户反馈原文
```

### 6.2 可视化指南

| 图表类型   | 用途                         | 数据源               |
| ---------- | ---------------------------- | -------------------- |
| 分组柱状图 | Atom vs Entity 指标对比      | 检索性能、Token 效率 |
| 箱线图     | 指标分布和离群值             | 3 轮测量数据         |
| 散点图     | 链接密度 vs 检索精准度相关性 | Atom 质量数据        |
| 雷达图     | 多维度综合评分               | 5 个评估维度         |
| 热力图     | 按查询类别的精准度矩阵       | 检索性能明细         |

### 6.3 关键发现格式

每条关键发现遵循以下格式：

```markdown
### 发现 N: [一句话结论]

**指标**: [具体指标名称]
**数值**: Atom 模式 [X] vs Entity 模式 [Y]，提升 [Z]%
**统计显著性**: p = [值]，Cohen's d = [值]
**置信区间**: 95% CI [[下限], [上限]]
**解读**: [2-3 句话说明实际意义]
**建议**: [具体改进方向]
```

---

## 七、清理与收尾

评估完成后清理测试环境：

```bash
# 1. 清空测试 tenant 数据
Invoke-WebRequest -Uri http://localhost:18008/api/v1/memories/clear -Method DELETE -Headers @{"WRAPPER_MEILI_API_KEY"="$env:WRAPPER_MEILI_API_KEY"; "X-Tenant-ID"="evaluation-test"}

# 2. 归档报告
Copy-Item -Recurse reports/final "archives/evaluation-$(Get-Date -Format 'yyyy-MM-dd')"

# 3. 更新设计文档中的基线数据
# 手动将测量结果填入 DESIGN-EVALUATION.md 的 "3.3 基线指标" 表格
```

---

## 交叉引用

- [评估方案设计](./DESIGN-EVALUATION.md) — 指标定义、统计方法、成功标准
- [Atom 架构设计](../architecture/ATOM-ARCHITECTURE.md) — 被评估的技术方案
- [集成方案设计](../integration/DESIGN-INTEGRATION.md) — 功能实现状态
- [评估脚本目录](./scripts/README.md) — 可执行脚本清单
