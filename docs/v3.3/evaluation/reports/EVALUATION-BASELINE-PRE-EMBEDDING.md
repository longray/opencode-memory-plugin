---
status: draft
version: v3.3.1
last_updated: 2026-05-03
owner: Sisyphus
---

# v3.3 Atom Architecture 评估报告 — Embedding 修复前基线

> **评估日期**: 2026-05-03
> **种子数据**: 4 Entity（JavaScript异步/Vue3/Node.js流/Git分支），29 Atom
> **创建方式**: `POST /api/v1/entities`（触发后端 embedding 路径）
> **后端状态**: Atom embedding **未生效**（commit `65a21c8` 未部署或有 bug）
> **Entity 搜索**: 不可用（Entity API 创建的数据未进入 Meilisearch 索引）

---

## 一、评估概览

| 维度         | 指标            | Atom Scope | Entity Scope | 备注                    |
| ------------ | --------------- | ---------- | ------------ | ----------------------- |
| **搜索质量** | Precision@5     | 0.013      | 0            | Entity 搜索不可用       |
| **搜索质量** | MRR             | 0.063      | 0            | Entity 搜索不可用       |
| **搜索性能** | 平均响应时间    | 99ms       | 27ms         | —                       |
| **搜索召回** | 16 条查询命中数 | 1/16       | 0/16         | 仅 AbortController 命中 |
| **知识组织** | Atom 总数       | 29         | —            | 4 Entity                |
| **忠实度**   | Overall         | 0.748      | —            | 仅 Entity 1 可测        |

---

## 二、详细结果

### 2.1 搜索性能（Atom Scope Only）

**数据集**: 16 条查询，覆盖 4 个领域

| 查询                           | 返回数 | 命中  | 期望 ID              |
| ------------------------------ | ------ | ----- | -------------------- |
| `Promise 错误处理`             | 0      | 0     | EVALS01, EVALS02     |
| `async await`                  | 0      | 0     | EVALCH02, EVALS03    |
| `Promise.all 并发`             | 0      | 0     | EVALCH03, EVALS04    |
| `Promise.race`                 | 0      | 0     | EVALS05              |
| `AbortController`              | 1      | **1** | EVALCH04             |
| `Promise 状态`                 | 0      | 0     | EVALCH01             |
| `微任务 setTimeout`            | 0      | 0     | EVALS03              |
| `Vue 3 setup 函数用法`         | 0      | 0     | EVAL2CH01, EVAL2S01  |
| `ref reactive 区别`            | 0      | 0     | EVAL2CH02, EVAL2S02  |
| `Vue computed watchEffect`     | 0      | 0     | EVAL2CH03, EVAL2S03  |
| `Node.js Readable Writable 流` | 0      | 0     | EVAL3CH01, EVAL3CH02 |
| `pipe 方法 背压`               | 0      | 0     | EVAL3S01, EVAL3S02   |
| `stream pipeline 错误处理`     | 0      | 0     | EVAL3S03, EVAL3CH03  |
| `GitFlow feature 分支`         | 0      | 0     | EVAL4CH01, EVAL4S01  |
| `GitHub Flow release 管理`     | 0      | 0     | EVAL4CH02, EVAL4S02  |
| `hotfix 紧急修复流程`          | 0      | 0     | EVAL4S03, EVAL4CH03  |

**汇总**: 16 条查询仅 1 条命中（6.25%），MRR=0.063

### 2.2 Atom 搜索模式对比

| 搜索模式  | "Promise" 查询结果      | 说明                       |
| --------- | ----------------------- | -------------------------- |
| `hybrid`  | 3 results (score≈0.008) | 仅 BM25 匹配，score 极低   |
| `keyword` | 0 results               | BM25 也不工作              |
| `vector`  | 0 results               | 无 embedding，无法向量搜索 |

**根因**: Atom 没有 embedding → vector 搜索不工作 → hybrid 模式退化为纯关键词匹配 → 分数极低

### 2.3 Atom 后端状态

通过 `GET /api/v1/atoms` 检查 29 个 Atom：

| 字段        | 状态                | 说明                 |
| ----------- | ------------------- | -------------------- |
| `local_id`  | ❌ 全部 `undefined` | 请求中传了但未保存   |
| `embedding` | ❌ 全部缺失         | embedding 生成未执行 |
| `name`      | ✅ 正确             | —                    |
| `content`   | ✅ 完整             | —                    |
| `entity_id` | ✅ 正确关联         | —                    |
| `parent_id` | ✅ 正确关联         | —                    |

### 2.4 Entity 搜索状态

通过 `POST /api/v1/entities` 创建的 Entity **未进入 Meilisearch 搜索索引**：

```
Entity search: "Promise" => 0 results
Entity search: "JavaScript异步编程" => 0 results
```

而通过 `POST /api/v1/memories` + `incremental_sync` 创建的 Entity 可以被搜索到。说明 Entity API 创建的数据没有触发 Meilisearch 索引更新。

---

## 三、与优化前的历史数据对比

| 指标             | 优化前（v1, sync上传） | 当前（v2, Entity API） | 变化                         |
| ---------------- | ---------------------- | ---------------------- | ---------------------------- |
| Atom Precision@5 | 0.013                  | 0.013                  | 无变化                       |
| Atom MRR         | 0.063                  | 0.063                  | 无变化                       |
| Entity MRR       | 0.906                  | **0**                  | ❌ 退化（Entity 搜索不可用） |
| Entity 响应时间  | 109ms                  | 27ms                   | ✅ 快（但无结果）            |

**结论**: 当前状态下，Entity API 创建的数据无法被搜索，评估数据质量反而不如旧方式（sync 上传）。

---

## 四、阻塞项

| 阻塞                      | 影响                               | 状态       |
| ------------------------- | ---------------------------------- | ---------- |
| **Atom embedding 未生成** | Vector 搜索不工作，Atom 召回率极低 | 等后端排查 |
| **Atom local_id 未保存**  | 评估脚本无法匹配结果               | 等后端排查 |
| **Entity 搜索索引缺失**   | Entity scope 搜索返回空            | 等后端排查 |

**已写信**: `D:\mailbox\backend-team\2026-05-03-atom-embedding-verification-round2.md`

---

## 五、后端修复后验证计划

1. 清空数据：`DELETE /api/v1/memories/clear`
2. 通过 Entity API 重新创建 4 个 Entity（29 Atom）
3. 验证 embedding 存在：`GET /api/v1/atoms` 检查 `embedding` 字段
4. 验证 local_id 存在：检查 `local_id` 字段
5. 验证 Entity 搜索可用：搜索确认 Entity 可被检索
6. 运行完整评估：4 个脚本 × 16 条查询
7. 产出修复后报告，与本文档对比

---

**评估脚本版本**: v3.3.1（含 Faithfulness 评估）
**种子数据**: 4 Entity, 29 Atom, 16 queries
**原始数据**: `report-search-baseline-pre-embedding.json`
