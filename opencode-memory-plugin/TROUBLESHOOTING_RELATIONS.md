# 关系提取故障排除指南 (v3.3)

本指南帮助你诊断和解决自动代码关系提取功能中的常见问题。

## 功能概述

自动代码关系提取系统通过分析代码的 AST（抽象语法树），自动发现并追踪代码实体（函数、类、模块）之间的关系。系统包含以下核心组件：

| 组件                       | 职责                                           |
| -------------------------- | ---------------------------------------------- |
| **Symbol Table**           | 跨文件符号解析，维护文件路径与实体 ID 的映射   |
| **Relation Recommender**   | 双阈值关系推荐引擎（自动创建 / 待审核 / 忽略） |
| **Pending Review Queue**   | 人工审核队列，管理中等置信度的推荐关系         |
| **Scheduled Health Check** | 定期知识图谱健康监控                           |
| **Quality Dashboard**      | 知识图谱健康可视化，含 ASCII 图表              |

## 快速诊断

遇到问题时，按以下顺序排查：

```bash
# 1. 检查后端服务是否运行
curl http://localhost:18008/api/v1/health

# 2. 查看质量仪表盘
node opencode-memory-plugin/cli/index.mjs quality-dashboard

# 3. 运行健康检查
node opencode-memory-plugin/cli/index.mjs sop run full-quality-check

# 4. 查看待审核队列
# （通过 CLI 或查看 ~/.opencode/memory/pending-review-queue.json）
```

---

## 常见问题

### 问题 1：没有提取到任何关系

**症状**: 代码分析完成，但 `references` 数量为 0。

**排查步骤**:

1. **检查文件扩展名**

   确保分析的文件在支持的语言列表中：

   | 语言       | 扩展名                        |
   | ---------- | ----------------------------- |
   | JavaScript | `.js`, `.mjs`, `.cjs`         |
   | TypeScript | `.ts`, `.mts`, `.cts`, `.tsx` |
   | Python     | `.py`                         |
   | Go         | `.go`                         |
   | Rust       | `.rs`                         |
   | Java       | `.java`                       |

2. **检查 code_analysis 是否启用**

   查看 `~/.opencode/memory/memory-config.json`:

   ```json
   {
     "code_analysis": {
       "enabled": true,
       "auto_trigger": true
     }
   }
   ```

   如果 `enabled` 为 `false`，代码分析不会自动触发。

3. **检查排除模式**

   文件可能被 `exclude_patterns` 排除：

   ```json
   {
     "code_analysis": {
       "exclude_patterns": ["node_modules", ".git", "dist", "build"]
     }
   }
   ```

4. **手动触发分析**

   ```bash
   # 分析单个文件
   node opencode-memory-plugin/cli/code-analyzer.cjs src/utils.js

   # 分析整个项目
   node opencode-memory-plugin/cli/code-analyzer.cjs --project .
   ```

5. **检查后端是否支持批量上传**

   关系提取使用 `/references/batch` API。确认后端版本支持此端点：

   ```bash
   curl http://localhost:18008/api/v1/references/batch \
     -H "WRAPPER_MEILI_API_KEY: your-key" \
     -H "Content-Type: application/json" \
     -d '{"references":[]}'
   ```

   如果返回 404，说明后端版本过旧，需要升级。

---

### 问题 2：提取的关系不正确

**症状**: 关系指向错误的文件，或关系类型（`calls`, `depends_on`, `extends`）不准确。

**排查步骤**:

1. **检查符号表状态**

   符号表可能包含过时的映射。查看缓存文件：

   ```bash
   cat ~/.opencode/cache/symbol-table.json
   ```

   检查 `project_id` 是否与当前项目匹配。如果不匹配，删除缓存文件后重新分析：

   ```bash
   rm ~/.opencode/cache/symbol-table.json
   # 重新触发代码分析
   ```

2. **运行健康检查**

   ```bash
   node opencode-memory-plugin/cli/index.mjs sop run full-quality-check
   ```

   健康检查会报告以下问题：
   - 孤立实体数量过多
   - 网络密度过低
   - 孤儿率超过阈值

3. **检查路径别名配置**

   如果项目使用了路径别名（如 `@/utils`），确保符号表配置了正确的映射：

   ```javascript
   const symbolTable = new SymbolTable(projectId, cacheDir, {
     pathAliases: {
       '@/': 'src/',
       '~components/': 'src/components/',
     },
   });
   ```

4. **验证关系类型**

   | 关系类型     | 触发条件                  | 示例                            |
   | ------------ | ------------------------- | ------------------------------- |
   | `depends_on` | `import` / `require` 语句 | `import { foo } from './utils'` |
   | `calls`      | 函数调用表达式            | `foo.bar()`                     |
   | `extends`    | 类继承                    | `class A extends B`             |
   | `implements` | 接口实现                  | `class A implements Interface`  |

---

### 问题 3：关系未同步到后端

**症状**: 本地分析成功，但后端查询不到关系数据。

**排查步骤**:

1. **检查后端连接**

   ```bash
   curl http://localhost:18008/api/v1/health
   ```

   如果后端未运行，启动它：

   ```bash
   uvicorn src.main:app --port 18008
   ```

2. **执行增量同步**

   ```bash
   # 在 OpenCode 中
   incremental_sync

   # 或使用 CLI
   node opencode-memory-plugin/cli/index.mjs sync
   ```

3. **检查 tenant_id 配置**

   前后端 `tenant_id` 不一致会导致数据隔离：

   ```json
   {
     "backend": {
       "tenant_id": "default"
     }
   }
   ```

   确认 `memory-config.json` 中的 `tenant_id` 与后端查询时使用的值一致。

4. **验证关系已上传**

   ```bash
   curl "http://localhost:18008/api/v1/references?memory_id=YOUR_MEMORY_ID" \
     -H "WRAPPER_MEILI_API_KEY: your-key"
   ```

---

### 问题 4：Tenant ID 不匹配

**症状**: 上传成功但查询返回 `found: false`。

**原因**: Windows 上 `WrapperClient` 默认使用 `process.env.USERNAME`（如 `"Longray"`）作为 `tenant_id`，但后端查询可能默认使用 `"default"`。

**解决方案**:

在 `~/.opencode/memory/memory-config.json` 中显式指定 `tenant_id`：

```json
{
  "backend": {
    "tenant_id": "default",
    "project_id": "your-project-name"
  }
}
```

或通过环境变量覆盖：

```powershell
# Windows PowerShell
$env:MEMORY_TENANT_ID="default"

# Linux/macOS
export MEMORY_TENANT_ID="default"
```

---

### 问题 5：批量 API 错误

**症状**: 关系上传时返回 404 或 500 错误。

**排查步骤**:

1. **检查后端版本**

   `/references/batch` 端点需要后端 v3.2+ 支持。检查后端版本：

   ```bash
   curl http://localhost:18008/api/v1/health
   ```

2. **检查 API Key**

   ```bash
   curl http://localhost:18008/api/v1/health \
     -H "WRAPPER_MEILI_API_KEY: your-key"
   ```

   如果返回 401 或 403，说明 API Key 无效或缺失。

3. **检查请求体大小**

   批量上传的请求体过大可能导致超时。调整批处理配置：

   ```json
   {
     "code_analysis": {
       "batch_max_size": 10,
       "batch_delay_ms": 2000
     }
   }
   ```

   减小 `batch_max_size` 可以降低单次请求的大小。

---

## 工具使用指南

### 运行健康检查

健康检查定期评估知识图谱的质量指标，包括连通密度、孤儿节点率和整体健康评分。

```bash
# 手动执行健康检查
node opencode-memory-plugin/cli/index.mjs sop run full-quality-check

# 查看健康检查配置
# 在 memory-config.json 中:
```

```json
{
  "health_check": {
    "enabled": true,
    "schedule": "*/30 * * * *",
    "threshold": 80,
    "density_threshold": 0.02,
    "orphan_rate_threshold": 0.2,
    "timeout": 60000
  }
}
```

**配置说明**:

| 参数                    | 默认值           | 说明                        |
| ----------------------- | ---------------- | --------------------------- |
| `enabled`               | `true`           | 是否启用定时健康检查        |
| `schedule`              | `"*/30 * * * *"` | Cron 表达式，默认每 30 分钟 |
| `threshold`             | `80`             | 最低健康评分（0-100）       |
| `density_threshold`     | `0.02`           | 最低边/节点比               |
| `orphan_rate_threshold` | `0.2`            | 最大孤儿节点比例            |
| `timeout`               | `60000`          | 单次检查超时时间（毫秒）    |

**健康评分等级**:

| 评分   | 等级 | 状态   |
| ------ | ---- | ------ |
| 90-100 | A    | 优秀   |
| 80-89  | B    | 良好   |
| 70-79  | C    | 一般   |
| 60-69  | D    | 需改进 |
| 0-59   | F    | 不健康 |

---

### 查看质量仪表盘

质量仪表盘提供知识图谱的实时健康可视化，包含 ASCII 图表和趋势分析。

```bash
# 启动仪表盘
node opencode-memory-plugin/cli/index.mjs quality-dashboard

# 选项
node opencode-memory-plugin/cli/index.mjs quality-dashboard --no-search   # 跳过搜索测试
node opencode-memory-plugin/cli/index.mjs quality-dashboard --no-trends   # 不显示趋势
node opencode-memory-plugin/cli/index.mjs quality-dashboard --auto-refresh # 自动刷新模式
```

**仪表盘内容**:

- **健康评分**: 综合评分和等级（A/B/C/D/F）
- **实体统计**: 总数、今日新增、本周新增、类型分布
- **关系网络**: 总数、网络密度、平均每实体关系数、孤立实体数
- **搜索质量**: 平均延迟、准确率、模式使用分布
- **评分分解**: 覆盖率、关系质量、搜索质量的进度条
- **问题与建议**: 检测到的问题及修复建议
- **7 天趋势**: 关键指标的变化趋势

**自动刷新模式**:

在 `--auto-refresh` 模式下，仪表盘每分钟自动刷新。按 `q` 退出。

---

### 管理待审核队列

当关系推荐的置信度介于 `review_threshold`（默认 0.75）和 `auto_create_threshold`（默认 0.85）之间时，推荐项会进入待审核队列。

```bash
# 查看队列文件
cat ~/.opencode/memory/pending-review-queue.json
```

**队列操作**:

| 操作        | 说明                    |
| ----------- | ----------------------- |
| **approve** | 批准推荐项，创建关系    |
| **reject**  | 拒绝推荐项，从队列移除  |
| **expire**  | 清理过期项（默认 7 天） |
| **clear**   | 清空整个队列            |

**配置**:

```json
{
  "recommendation": {
    "auto_create_threshold": 0.85,
    "review_threshold": 0.75,
    "auto_create_enabled": false,
    "max_entities": 50,
    "queue_expiry_days": 7
  }
}
```

**配置说明**:

| 参数                    | 默认值  | 说明                         |
| ----------------------- | ------- | ---------------------------- |
| `auto_create_threshold` | `0.85`  | 自动创建的置信度阈值         |
| `review_threshold`      | `0.75`  | 进入审核队列的最低置信度     |
| `auto_create_enabled`   | `false` | 是否允许自动创建高置信度关系 |
| `max_entities`          | `50`    | 单次推荐处理的最大实体数     |
| `queue_expiry_days`     | `7`     | 未审核推荐项的过期天数       |

**双阈值决策流程**:

```
相似度评分
    │
    ├── ≥ 0.85 → 自动创建（如果 auto_create_enabled = true）
    │
    ├── 0.75 ~ 0.85 → 加入待审核队列
    │
    └── < 0.75 → 忽略
```

---

## 完整配置示例

```json
{
  "version": "3.0",
  "code_analysis": {
    "enabled": true,
    "auto_trigger": true,
    "exclude_patterns": ["node_modules", ".git", "dist", "build"],
    "batch_max_size": 10,
    "batch_delay_ms": 2000,
    "debounce_ms": 300
  },
  "health_check": {
    "enabled": true,
    "schedule": "*/30 * * * *",
    "threshold": 80,
    "density_threshold": 0.02,
    "orphan_rate_threshold": 0.2,
    "timeout": 60000
  },
  "recommendation": {
    "auto_create_threshold": 0.85,
    "review_threshold": 0.75,
    "auto_create_enabled": false,
    "max_entities": 50,
    "queue_expiry_days": 7
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:18008",
    "tenant_id": "default",
    "project_id": "my-project"
  }
}
```

---

## 日志排查

所有操作都会输出结构化日志。查看日志文件：

```bash
# 查看最近的日志
tail -f ~/.opencode/memory/sync.log
```

**关键日志关键词**:

| 关键词                   | 说明                 |
| ------------------------ | -------------------- |
| `SymbolTable`            | 符号表加载/保存/解析 |
| `relation-recommender`   | 关系推荐进度和结果   |
| `pending-review-queue`   | 队列操作记录         |
| `scheduled-health-check` | 健康检查结果         |
| `quality-dashboard`      | 仪表盘指标采集       |
| `CodeAnalysis`           | 代码分析流程         |

---

**最后更新**: 2026-05-12  
**版本**: v3.3.0
