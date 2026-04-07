# Backlog API 实施任务

## 场景十一：Agent-Native Backlog API 实施

> **背景**: 基于 BACKLOG_V2_DESIGN.md 最终方案，实施 Backlog 管理功能
>
> **目标**: 基于 Memory 系统实现 Backlog 管理，采用 ULID、4状态、Metadata 嵌套方案
>
> **设计文档**: [BACKLOG_V2_DESIGN.md](./BACKLOG_V2_DESIGN.md)
>
> **关键决策**:
>
> - ID: ULID 天然唯一，字典序可排序
> - 状态机: 4状态（backlog → in_progress → review → done）
> - 数据模型: Metadata 嵌套，零 Schema 变更

---

### BL-CA-22 [P0] Phase 1 - 扩展 Meilisearch 索引配置

#### 目标

扩展 Meilisearch 索引配置，支持 Backlog 特有字段的过滤和排序，确保 Backlog 任务可以按状态、优先级、场景等字段高效查询。

#### 涉及范围

**文件变更**:

1. `embedding_service/wrapper/src/utils/meili_client.py`
   - 更新 `DEFAULT_INDEX_SETTINGS` 字典
   - 在 `filterableAttributes` 中添加：
     - `metadata.status`
     - `metadata.priority`
     - `metadata.scene`
     - `metadata.blocked`
   - 在 `sortableAttributes` 中添加：
     - `metadata.priority`
     - `metadata.estimated_hours`
     - `metadata.started_at`
     - `metadata.completed_at`

2. `embedding_service/wrapper/src/models.py`
   - 更新 `MemoryItem` 模型的 metadata 字段文档
   - 添加 Backlog 特有字段的验证规则

3. 创建索引重建脚本
   - `scripts/rebuild_backlog_index.py` - 用于开发环境重建索引

**配置变更详情**:

```python
# meili_client.py 更新内容
DEFAULT_INDEX_SETTINGS = {
    # ... 现有配置 ...
    "filterableAttributes": [
        # 现有字段
        "tenant_id",
        "type",
        "tags",
        "project_id",
        "source_id",
        # Backlog 特有字段（新增）
        "metadata.status",
        "metadata.priority",
        "metadata.scene",
        "metadata.blocked",
    ],
    "sortableAttributes": [
        # 现有字段
        "date",
        "created_at",
        # Backlog 特有字段（新增）
        "metadata.priority",
        "metadata.estimated_hours",
        "metadata.started_at",
        "metadata.completed_at",
    ],
    # ... 其他配置 ...
}
```

#### 前置依赖

- 无（这是第一阶段任务）
- 需要访问后端代码库 `embedding_service/`
- 需要 Meilisearch 服务运行权限

#### 完成标准

1. **配置更新完成**
   - [ ] `meili_client.py` 中的 `DEFAULT_INDEX_SETTINGS` 已更新
   - [ ] 包含所有 Backlog 特有字段的 filterableAttributes
   - [ ] 包含所有 Backlog 特有字段的 sortableAttributes

2. **索引重建成功**
   - [ ] 开发环境 Meilisearch 索引已重建
   - [ ] 重建过程无错误
   - [ ] 重建后索引包含新字段

3. **查询功能验证**
   - [ ] 可以按 `metadata.status` 过滤
   - [ ] 可以按 `metadata.priority` 排序
   - [ ] 可以按 `metadata.scene` 过滤
   - [ ] 复合过滤（status + priority）工作正常

4. **文档更新**
   - [ ] 更新 `docs/API-CONTRACT.md`，记录 Meilisearch 字段变更
   - [ ] 记录索引重建步骤

#### 验证方式

**步骤 1: 验证配置更新**

```bash
# 1. 检查配置文件是否正确更新
grep -A 20 "filterableAttributes" embedding_service/wrapper/src/utils/meili_client.py

# 2. 确认 Backlog 字段已添加
grep "metadata.status" embedding_service/wrapper/src/utils/meili_client.py
grep "metadata.priority" embedding_service/wrapper/src/utils/meili_client.py
```

**步骤 2: 重建索引**

```bash
# 1. 备份现有索引（可选，开发环境可跳过）
curl -X POST http://localhost:7700/indexes/memories/backup \
  -H "Authorization: Bearer $MEILI_MASTER_KEY"

# 2. 更新索引配置
cd embedding_service/wrapper
python scripts/rebuild_backlog_index.py

# 3. 验证索引设置
curl http://localhost:7700/indexes/memories/settings \
  -H "Authorization: Bearer $MEILI_MASTER_KEY" | jq
```

**步骤 3: 测试查询功能**

```bash
# 1. 测试状态过滤
curl "http://localhost:7700/indexes/memories/search?q=&filter=metadata.status='in_progress'" \
  -H "Authorization: Bearer $MEILI_MASTER_KEY"

# 2. 测试优先级排序
curl "http://localhost:7700/indexes/memories/search?q=&sort=metadata.priority:desc" \
  -H "Authorization: Bearer $MEILI_MASTER_KEY"

# 3. 测试复合过滤
curl "http://localhost:7700/indexes/memories/search?q=&filter=metadata.status='in_progress' AND metadata.priority='P0'" \
  -H "Authorization: Bearer $MEILI_MASTER_KEY"
```

**步骤 4: 验证通过标准**

- [ ] 所有查询返回 HTTP 200
- [ ] 过滤结果正确（只返回匹配条件的文档）
- [ ] 排序结果正确（按指定字段排序）
- [ ] 复合过滤工作正常

#### 风险与缓解

| 风险         | 影响 | 缓解措施                             |
| ------------ | ---- | ------------------------------------ |
| 索引重建失败 | 高   | 开发环境可立即重建；生产环境需备份   |
| 字段路径错误 | 中   | 使用 `metadata.field` 格式，提前测试 |
| 性能下降     | 低   | 监控查询延迟，必要时优化索引         |

#### 技术细节

**Meilisearch 嵌套字段语法**:

- 使用点号表示嵌套: `metadata.status`
- 支持多层嵌套: `metadata.source.type`

**索引重建命令**:

```python
# rebuild_backlog_index.py
from meili_client import MeiliClient

client = MeiliClient()
client.update_index_settings()  # 应用新配置
client.reindex_all()  # 重新索引所有文档
```

---

### BL-CA-23 [P0] Phase 2 - 实现 backlog_create 工具

#### 目标

实现 `backlog_create` 工具，支持创建 Backlog 任务，生成 ULID 作为任务 ID，构建 5要素内容格式，并正确存储到 Memory 系统。

#### 涉及范围

**文件变更**:

1. **新建** `opencode-memory-plugin/tools/backlog.js`
   - 实现 `backlog_create` 工具
   - 遵循现有工具模式（参考 `core.js`, `search.js`）
   - 使用 `tool()` 函数定义工具
   - 参数验证和错误处理

2. **修改** `opencode-memory-plugin/plugin.js`
   - 导入 `backlog_create` 工具
   - 在 `MemoryPlugin` 中注册工具

3. **新建** `opencode-memory-plugin/tests/test-backlog.test.js`
   - 单元测试覆盖

**工具参数设计**:

```javascript
backlog_create: {
  // 必需参数
  title: tool.schema.string().describe('任务标题（L0）'),
  description: tool.schema.string().describe('任务描述（L1）'),
  scene: tool.schema.string().describe('所属场景'),

  // 可选参数
  priority: tool.schema.string().optional().default('P2').describe('优先级: P0/P1/P2/P3'),
  scope: tool.schema.array(tool.schema.string()).optional().default([]).describe('涉及范围（文件路径列表）'),
  acceptance_criteria: tool.schema.array(tool.schema.string()).optional().default([]).describe('完成标准'),
  verification_method: tool.schema.string().optional().default('').describe('验证方式'),
  estimated_hours: tool.schema.number().optional().describe('预估工时'),
  dependencies: tool.schema.array(tool.schema.string()).optional().default([]).describe('依赖任务ID列表（ULID）'),
  tags: tool.schema.array(tool.schema.string()).optional().default([]).describe('额外标签'),
}
```

**5要素内容格式**:

```markdown
# 目标

{description}

# 涉及范围

{scope[0]}
{scope[1]}
...

# 前置依赖

{dependencies[0]}, {dependencies[1]}, ...

# 完成标准

- {acceptance_criteria[0]}
- {acceptance_criteria[1]}
  ...

# 验证方式

{verification_method}
```

**数据存储结构**:

```javascript
{
  type: 'backlog',
  abstract: title,  // L0: 任务标题
  overview: description,  // L1: 任务描述
  content: fiveElementsContent,  // L2: 5要素内容
  tags: [scene, ...tags],  // 场景 + 额外标签
  source_id: ulid(),  // ULID 格式的 Backlog ID
  project_id: resolvedProjectId,
  metadata: {
    status: 'backlog',
    priority: priority,
    scene: scene,
    scope: scope,
    acceptance_criteria: acceptance_criteria,
    verification_method: verification_method,
    estimated_hours: estimated_hours,
    dependencies: dependencies,
    blocked: false,
    blocked_reason: null,
    source: {
      type: 'user_created',
      created_by: 'user',
      created_at: new Date().toISOString(),
    },
  },
}
```

#### 前置依赖

- BL-CA-22 完成（Meilisearch 索引配置已更新）
- 需要 `lib/ulid.js` 中的 `generateLocalId()` 函数可用
- 需要 `lib/wrapper-client.js` 中的 `WrapperClient` 可用

#### 完成标准

1. **工具实现完成**
   - [ ] `backlog_create` 工具已创建
   - [ ] 所有参数验证正确
   - [ ] 错误处理符合规范（使用 `❌`/`✅`/`📋` 格式）
   - [ ] 工具已在 `plugin.js` 中注册

2. **ULID 生成正确**
   - [ ] 使用 `generateLocalId()` 生成 26 字符 ULID
   - [ ] ULID 存储在 `source_id` 字段
   - [ ] 生成的 ID 字典序可排序

3. **5要素内容格式正确**
   - [ ] 包含目标、涉及范围、前置依赖、完成标准、验证方式
   - [ ] Markdown 格式正确
   - [ ] 列表项正确渲染

4. **Metadata 字段完整**
   - [ ] 包含所有必需字段（status, priority, scene）
   - [ ] 包含所有可选字段（scope, acceptance_criteria 等）
   - [ ] 嵌套结构正确

5. **集成测试通过**
   - [ ] 可以成功创建 Backlog 任务
   - [ ] 创建的任务可以通过 `memory_search` 查询到
   - [ ] 返回结果包含正确的 Backlog ID

#### 验证方式

**步骤 1: 单元测试**

```bash
# 运行单元测试
cd opencode-memory-plugin
npm test -- test-backlog.test.js

# 验证测试覆盖
npm run test:coverage
```

**步骤 2: 手动测试**

```javascript
// 在 OpenCode 中测试
const result = await backlog_create({
  title: "测试任务",
  description: "这是一个测试任务",
  scene: "代码分析v1.4",
  priority: "P0",
  scope: ["src/test.js", "src/utils.js"],
  acceptance_criteria: ["功能正常", "测试通过"],
  verification_method: "手动测试",
  estimated_hours: 4,
});

// 验证返回结果
console.log(result);
// 预期: ✅ Backlog 任务创建成功: 01HQ2K3M4N5P6Q7R8S9T0UVWXY
```

**步骤 3: 验证数据存储**

```javascript
// 查询刚创建的任务
const searchResult = await memory_search({
  query: "测试任务",
  filters: { type: "backlog" },
});

// 验证字段完整性
const task = searchResult.data[0];
console.log(task.type); // 'backlog'
console.log(task.abstract); // '测试任务'
console.log(task.metadata.status); // 'backlog'
console.log(task.metadata.priority); // 'P0'
console.log(task.source_id); // ULID 格式
```

**步骤 4: 验证通过标准**

- [ ] 工具返回 `✅` 开头的成功消息
- [ ] 返回结果包含 26 字符 ULID
- [ ] 任务可以通过 `memory_search` 查询到
- [ ] Metadata 字段完整且正确
- [ ] 5要素内容格式正确

#### 风险与缓解

| 风险           | 影响 | 缓解措施                            |
| -------------- | ---- | ----------------------------------- |
| ULID 生成失败  | 高   | 使用成熟的 `generateLocalId()` 函数 |
| 参数验证不完整 | 中   | 参考现有工具模式，全面验证          |
| 5要素格式错误  | 低   | 使用模板字符串，单元测试验证        |

#### 技术细节

**工具实现模板**:

```javascript
import { tool } from "@opencode-ai/plugin/tool";
import { generateLocalId } from "../lib/ulid.js";
import { getConfig } from "../lib/storage.js";
import { getWrapperClient } from "../lib/wrapper-client.js";

export const backlog_create = tool({
  description: "创建新的 Backlog 任务",
  args: {
    title: tool.schema.string().describe("任务标题"),
    // ... 其他参数
  },
  async execute(args) {
    try {
      // 1. 验证必需参数
      if (!args.title || !args.description || !args.scene) {
        return "❌ Error: title, description, scene are REQUIRED.";
      }

      // 2. 生成 ULID
      const backlogId = generateLocalId();

      // 3. 构建 5要素内容
      const content = buildFiveElements(args);

      // 4. 调用 memory_write
      const result = await memory_write({
        type: "backlog",
        abstract: args.title,
        // ... 其他字段
      });

      return `✅ Backlog 任务创建成功: ${backlogId}`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});
```

---

### BL-CA-24 [P0] Phase 3 - 实现 backlog_list 工具

#### 目标

实现 `backlog_list` 工具，支持查询 Backlog 任务列表，提供灵活的过滤、排序和分页功能，输出格式清晰可读。

#### 涉及范围

**文件变更**:

1. **修改** `opencode-memory-plugin/tools/backlog.js`
   - 添加 `backlog_list` 工具实现
   - 支持多种过滤条件
   - 支持排序和分页

2. **修改** `opencode-memory-plugin/plugin.js`
   - 注册 `backlog_list` 工具

3. **更新** `opencode-memory-plugin/tests/test-backlog.test.js`
   - 添加 `backlog_list` 测试用例

**工具参数设计**:

```javascript
backlog_list: {
  // 过滤参数（可选）
  status: tool.schema.string().optional().describe('按状态过滤: backlog/in_progress/review/done'),
  priority: tool.schema.string().optional().describe('按优先级过滤: P0/P1/P2/P3'),
  scene: tool.schema.string().optional().describe('按场景过滤'),
  blocked: tool.schema.boolean().optional().describe('按阻塞状态过滤'),

  // 排序参数
  sort_by: tool.schema.string().optional().default('priority').describe('排序字段: priority/date/estimated_hours'),
  sort_order: tool.schema.string().optional().default('desc').describe('排序方向: asc/desc'),

  // 分页参数
  limit: tool.schema.number().optional().default(50).describe('返回数量'),
  offset: tool.schema.number().optional().default(0).describe('偏移量'),
}
```

**输出格式设计**:

```
📋 Backlog 任务列表 (共 15 个)

P0 | in_progress | 01HQ2K3M... | 实现文件监听自动触发分析
   | 场景: 代码分析v1.4 | 预估: 4h | 阻塞: 否

P1 | backlog | 01HQ2K3M... | 扩展函数元数据字段
   | 场景: 代码分析v1.4 | 预估: 2h | 阻塞: 否

P2 | review | 01HQ2K3M... | 实现代码复杂度计算
   | 场景: 代码分析v1.4 | 预估: 3h | 阻塞: 是 (等待API)
```

**过滤逻辑**:

```javascript
// 构建过滤条件
const filters = { type: "backlog" };
if (args.status) filters["metadata.status"] = args.status;
if (args.priority) filters["metadata.priority"] = args.priority;
if (args.scene) filters["metadata.scene"] = args.scene;
if (args.blocked !== undefined) filters["metadata.blocked"] = args.blocked;

// 构建排序
const sort = [`metadata.${args.sort_by}:${args.sort_order}`];
```

#### 前置依赖

- BL-CA-23 完成（`backlog_create` 工具已实现）
- 需要至少一个测试 Backlog 任务用于查询

#### 完成标准

1. **工具实现完成**
   - [ ] `backlog_list` 工具已创建
   - [ ] 支持按 status、priority、scene、blocked 过滤
   - [ ] 支持排序（priority/date/estimated_hours）
   - [ ] 支持分页（limit/offset）

2. **过滤功能正常**
   - [ ] 单条件过滤工作正常
   - [ ] 复合条件过滤工作正常
   - [ ] 过滤结果准确

3. **排序功能正常**
   - [ ] 按优先级排序正确
   - [ ] 按日期排序正确
   - [ ] 升序/降序都支持

4. **输出格式清晰**
   - [ ] 包含任务 ID、标题、状态、优先级
   - [ ] 包含场景、预估工时
   - [ ] 阻塞状态清晰显示
   - [ ] 格式美观易读

5. **性能达标**
   - [ ] 查询延迟 < 500ms（100条以内）
   - [ ] 分页切换流畅

#### 验证方式

**步骤 1: 基础查询测试**

```javascript
// 查询所有 Backlog 任务
const result = await backlog_list({});
console.log(result);
// 预期: 返回格式化的任务列表
```

**步骤 2: 过滤测试**

```javascript
// 按状态过滤
await backlog_list({ status: "in_progress" });

// 按优先级过滤
await backlog_list({ priority: "P0" });

// 按场景过滤
await backlog_list({ scene: "代码分析v1.4" });

// 复合过滤
await backlog_list({ status: "in_progress", priority: "P0" });
```

**步骤 3: 排序测试**

```javascript
// 按优先级降序
await backlog_list({ sort_by: "priority", sort_order: "desc" });

// 按日期升序
await backlog_list({ sort_by: "date", sort_order: "asc" });
```

**步骤 4: 分页测试**

```javascript
// 第一页
await backlog_list({ limit: 10, offset: 0 });

// 第二页
await backlog_list({ limit: 10, offset: 10 });
```

**步骤 5: 验证通过标准**

- [ ] 所有过滤条件工作正常
- [ ] 排序结果正确
- [ ] 分页切换正常
- [ ] 输出格式清晰易读
- [ ] 查询性能达标

#### 风险与缓解

| 风险             | 影响 | 缓解措施                            |
| ---------------- | ---- | ----------------------------------- |
| 查询性能差       | 中   | 使用 Meilisearch 索引，限制返回数量 |
| 过滤条件组合复杂 | 低   | 逐步添加过滤条件，充分测试          |
| 输出格式混乱     | 低   | 使用表格或结构化格式                |

#### 技术细节

**过滤条件构建**:

```javascript
function buildFilters(args) {
  const filters = { type: "backlog" };

  if (args.status) {
    filters["metadata.status"] = args.status;
  }

  if (args.priority) {
    filters["metadata.priority"] = args.priority;
  }

  if (args.scene) {
    filters["metadata.scene"] = args.scene;
  }

  if (args.blocked !== undefined) {
    filters["metadata.blocked"] = args.blocked;
  }

  return filters;
}
```

**输出格式化**:

```javascript
function formatBacklogList(tasks, total) {
  let output = `📋 Backlog 任务列表 (共 ${total} 个)\n\n`;

  for (const task of tasks) {
    const id = task.source_id.substring(0, 10) + "...";
    const blocked = task.metadata.blocked ? "是" : "否";

    output += `${task.metadata.priority} | ${task.metadata.status} | ${id} | ${task.abstract}\n`;
    output += `   | 场景: ${task.metadata.scene} | 预估: ${task.metadata.estimated_hours}h | 阻塞: ${blocked}\n\n`;
  }

  return output;
}
```

---

### BL-CA-25 [P1] Phase 4 - 实现 backlog_update_status 工具

#### 目标

实现 `backlog_update_status` 工具，支持更新 Backlog 任务状态，验证 4 状态流转规则，自动更新时间戳，处理阻塞状态。

#### 涉及范围

**文件变更**:

1. **修改** `opencode-memory-plugin/tools/backlog.js`
   - 添加 `backlog_update_status` 工具
   - 实现状态流转验证
   - 实现时间戳自动更新

2. **修改** `opencode-memory-plugin/plugin.js`
   - 注册 `backlog_update_status` 工具

3. **更新** `opencode-memory-plugin/tests/test-backlog.test.js`
   - 添加状态流转测试

**工具参数设计**:

```javascript
backlog_update_status: {
  // 必需参数
  backlog_id: tool.schema.string().describe('Backlog 任务 ID（ULID）'),
  status: tool.schema.string().describe('新状态: backlog/in_progress/review/done'),

  // 可选参数
  blocked: tool.schema.boolean().optional().describe('设置阻塞状态'),
  blocked_reason: tool.schema.string().optional().describe('阻塞原因'),
  actual_hours: tool.schema.number().optional().describe('实际工时'),
}
```

**4 状态流转规则**:

```yaml
状态流转:
  backlog:
    - in_progress # 开始工作
    # 可以删除任务（不经过状态变更）

  in_progress:
    - review # 提交审查
    - done # 直接完成
    # blocked 改为 metadata.blocked，不作为状态

  review:
    - done # 审查通过
    - in_progress # 打回重做

  done: [] # 终态，不可变更


# 特殊处理:
# - blocked: 使用 metadata.blocked 布尔值
# - cancelled: 使用 metadata.cancelled 布尔值 + metadata.cancelled_reason
# - archived: 使用 metadata.archived 布尔值
```

**时间戳自动更新**:

```javascript
const updates = { "metadata.status": newStatus };

// 状态变为 in_progress 时，自动设置 started_at
if (newStatus === "in_progress" && currentStatus !== "in_progress") {
  updates["metadata.started_at"] = new Date().toISOString();
}

// 状态变为 done 时，自动设置 completed_at
if (newStatus === "done" && currentStatus !== "done") {
  updates["metadata.completed_at"] = new Date().toISOString();
}
```

#### 前置依赖

- BL-CA-24 完成（`backlog_list` 工具已实现）
- 需要至少一个测试 Backlog 任务用于更新

#### 完成标准

1. **工具实现完成**
   - [ ] `backlog_update_status` 工具已创建
   - [ ] 支持更新 status、blocked、blocked_reason、actual_hours
   - [ ] 工具已在 `plugin.js` 中注册

2. **状态流转验证正确**
   - [ ] 验证 4 状态流转规则
   - [ ] 非法流转被拒绝并返回错误
   - [ ] 合法流转成功执行

3. **时间戳自动更新**
   - [ ] 变为 in_progress 时自动设置 started_at
   - [ ] 变为 done 时自动设置 completed_at
   - [ ] 时间戳格式正确（ISO 8601）

4. **阻塞状态处理**
   - [ ] 支持设置 metadata.blocked
   - [ ] 支持设置 metadata.blocked_reason
   - [ ] 阻塞状态在查询中正确显示

5. **错误处理完善**
   - [ ] 任务不存在时返回清晰错误
   - [ ] 非法状态流转时返回清晰错误
   - [ ] 参数错误时返回清晰错误

#### 验证方式

**步骤 1: 基础状态更新测试**

```javascript
// 更新状态从 backlog → in_progress
const result = await backlog_update_status({
  backlog_id: "01HQ2K3M4N5P6Q7R8S9T0UVWXY",
  status: "in_progress",
});
console.log(result);
// 预期: ✅ Backlog 任务 01HQ2K3M... 状态更新为: in_progress
```

**步骤 2: 时间戳自动更新验证**

```javascript
// 查询任务，验证 started_at 已设置
const task = await memory_search({
  query: "",
  filters: { source_id: "01HQ2K3M4N5P6Q7R8S9T0UVWXY" },
});

console.log(task.data[0].metadata.started_at);
// 预期: 2026-04-07T10:30:00.000Z（当前时间）
```

**步骤 3: 状态流转验证**

```javascript
// 合法流转: in_progress → review
await backlog_update_status({
  backlog_id: "01HQ2K3M4N5P6Q7R8S9T0UVWXY",
  status: "review",
});

// 非法流转: done → in_progress（应该失败）
await backlog_update_status({
  backlog_id: "01HQ2K3M4N5P6Q7R8S9T0UVWXY",
  status: "in_progress",
});
// 预期: ❌ Error: 非法状态流转: done → in_progress
```

**步骤 4: 阻塞状态测试**

```javascript
// 设置阻塞
await backlog_update_status({
  backlog_id: "01HQ2K3M4N5P6Q7R8S9T0UVWXY",
  status: "in_progress",
  blocked: true,
  blocked_reason: "等待API接口",
});

// 查询验证
const task = await memory_search({
  query: "",
  filters: { source_id: "01HQ2K3M4N5P6Q7R8S9T0UVWXY" },
});

console.log(task.data[0].metadata.blocked); // true
console.log(task.data[0].metadata.blocked_reason); // '等待API接口'
```

**步骤 5: 验证通过标准**

- [ ] 所有合法状态流转成功
- [ ] 所有非法状态流转被拒绝
- [ ] 时间戳自动更新正确
- [ ] 阻塞状态设置正确
- [ ] 错误消息清晰明确

#### 风险与缓解

| 风险             | 影响 | 缓解措施                        |
| ---------------- | ---- | ------------------------------- |
| 状态流转规则错误 | 高   | 严格遵循 4 状态设计，充分测试   |
| 时间戳更新失败   | 中   | 使用标准 Date 对象，验证格式    |
| 并发更新冲突     | 低   | 后端 API 处理并发，前端无需担心 |

#### 技术细节

**状态流转验证函数**:

```javascript
const VALID_TRANSITIONS = {
  backlog: ["in_progress"],
  in_progress: ["review", "done"],
  review: ["done", "in_progress"],
  done: [], // 终态
};

function validateStatusTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}
```

**工具实现**:

```javascript
export const backlog_update_status = tool({
  description: "更新 Backlog 任务状态",
  args: {
    backlog_id: tool.schema.string().describe("Backlog 任务 ID"),
    status: tool.schema.string().describe("新状态"),
    blocked: tool.schema.boolean().optional().describe("阻塞状态"),
    blocked_reason: tool.schema.string().optional().describe("阻塞原因"),
    actual_hours: tool.schema.number().optional().describe("实际工时"),
  },
  async execute(args) {
    try {
      // 1. 查询当前任务
      const task = await findBacklogById(args.backlog_id);
      if (!task) {
        return `❌ Error: Backlog 任务不存在: ${args.backlog_id}`;
      }

      // 2. 验证状态流转
      if (
        args.status &&
        !validateStatusTransition(task.metadata.status, args.status)
      ) {
        return `❌ Error: 非法状态流转: ${task.metadata.status} → ${args.status}`;
      }

      // 3. 构建更新
      const updates = {};
      if (args.status) {
        updates["metadata.status"] = args.status;

        // 自动更新时间戳
        if (
          args.status === "in_progress" &&
          task.metadata.status !== "in_progress"
        ) {
          updates["metadata.started_at"] = new Date().toISOString();
        }
        if (args.status === "done" && task.metadata.status !== "done") {
          updates["metadata.completed_at"] = new Date().toISOString();
        }
      }

      if (args.blocked !== undefined) {
        updates["metadata.blocked"] = args.blocked;
      }

      if (args.blocked_reason) {
        updates["metadata.blocked_reason"] = args.blocked_reason;
      }

      if (args.actual_hours) {
        updates["metadata.actual_hours"] = args.actual_hours;
      }

      // 4. 执行更新
      await updateMemory(task.id, updates);

      return `✅ Backlog 任务 ${args.backlog_id} 更新成功`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});
```

---

### BL-CA-26 [P1] Phase 5 - 测试和文档

#### 目标

完成 Backlog API 的全面测试覆盖和文档更新，确保功能稳定、文档完整、用户体验良好。

#### 涉及范围

**测试文件**:

1. **更新** `opencode-memory-plugin/tests/test-backlog.test.js`
   - 单元测试覆盖率 > 80%
   - 包含所有工具的测试用例
   - 包含边界条件测试
   - 包含错误处理测试

2. **新建** `opencode-memory-plugin/tests/test-backlog-integration.test.js`
   - 集成测试
   - 端到端测试
   - 性能测试

**文档文件**:

1. **更新** `opencode-memory-plugin/CONFIGURATION.md`
   - 添加 Backlog 配置说明
   - 说明工具参数和用法

2. **更新** `opencode-memory-plugin/QUICK_START.md`
   - 添加 Backlog 快速入门
   - 提供示例代码

3. **更新** `AGENTS.md`
   - 添加 Backlog 使用说明
   - 更新项目结构说明

4. **更新** `docs/API-CONTRACT.md`
   - 记录 Backlog API 契约
   - 说明数据模型和字段

**示例代码**:

1. **新建** `opencode-memory-plugin/examples/backlog-examples.js`
   - 常见使用场景示例
   - 最佳实践代码

#### 前置依赖

- BL-CA-25 完成（所有 Backlog 工具已实现）
- 所有工具功能已稳定

#### 完成标准

1. **测试覆盖达标**
   - [ ] 单元测试覆盖率 > 80%
   - [ ] 所有工具都有对应的测试用例
   - [ ] 边界条件测试完整
   - [ ] 错误处理测试完整
   - [ ] 集成测试通过

2. **文档更新完整**
   - [ ] CONFIGURATION.md 更新完成
   - [ ] QUICK_START.md 更新完成
   - [ ] AGENTS.md 更新完成
   - [ ] API-CONTRACT.md 更新完成
   - [ ] 所有文档通过 `npm run lint:md`

3. **示例代码可用**
   - [ ] 常见使用场景示例完整
   - [ ] 示例代码可运行
   - [ ] 最佳实践说明清晰

4. **性能达标**
   - [ ] 创建任务 < 500ms
   - [ ] 查询任务 < 300ms
   - [ ] 更新状态 < 200ms

5. **代码质量**
   - [ ] 通过 `npm run lint`（Oxlint）
   - [ ] 通过 `npm run format`（Prettier）
   - [ ] 无 console.log 调试代码
   - [ ] 代码注释完整

#### 验证方式

**步骤 1: 运行测试**

```bash
# 运行单元测试
cd opencode-memory-plugin
npm test -- test-backlog.test.js

# 运行集成测试
npm test -- test-backlog-integration.test.js

# 检查测试覆盖率
npm run test:coverage

# 验证覆盖率 > 80%
grep "All files" coverage/lcov-report/index.html
```

**步骤 2: 验证文档**

```bash
# 检查 Markdown 格式
npm run lint:md

# 检查代码格式
npm run lint

# 自动修复格式问题
npm run lint:fix
npm run format
```

**步骤 3: 性能测试**

```javascript
// 性能测试脚本
console.time("create");
await backlog_create({
  /* ... */
});
console.timeEnd("create"); // 应 < 500ms

console.time("list");
await backlog_list({ limit: 50 });
console.timeEnd("list"); // 应 < 300ms

console.time("update");
await backlog_update_status({
  /* ... */
});
console.timeEnd("update"); // 应 < 200ms
```

**步骤 4: 端到端测试**

```javascript
// 完整工作流测试
async function e2eTest() {
  // 1. 创建任务
  const created = await backlog_create({
    title: "E2E测试任务",
    description: "测试完整工作流",
    scene: "测试场景",
    priority: "P0",
  });

  // 2. 查询任务
  const listed = await backlog_list({ status: "backlog" });

  // 3. 更新状态
  await backlog_update_status({
    backlog_id: created.backlog_id,
    status: "in_progress",
  });

  // 4. 验证更新
  const updated = await backlog_list({ status: "in_progress" });

  console.log("✅ 端到端测试通过");
}
```

**步骤 5: 验证通过标准**

- [ ] 所有测试通过
- [ ] 测试覆盖率 > 80%
- [ ] 所有文档更新完成
- [ ] 文档格式检查通过
- [ ] 性能测试达标
- [ ] 端到端测试通过

#### 风险与缓解

| 风险         | 影响 | 缓解措施                         |
| ------------ | ---- | -------------------------------- |
| 测试覆盖不足 | 高   | 使用覆盖率工具，确保关键路径覆盖 |
| 文档过时     | 中   | 代码和文档同步更新，定期审查     |
| 性能不达标   | 中   | 早期进行性能测试，及时优化       |

#### 技术细节

**测试结构示例**:

```javascript
// test-backlog.test.js
describe("backlog_create", () => {
  it("should create backlog with valid params", async () => {
    // 测试代码
  });

  it("should reject missing required params", async () => {
    // 测试代码
  });

  it("should generate valid ULID", async () => {
    // 测试代码
  });
});

describe("backlog_list", () => {
  it("should list all backlog tasks", async () => {
    // 测试代码
  });

  it("should filter by status", async () => {
    // 测试代码
  });
});

describe("backlog_update_status", () => {
  it("should update status with valid transition", async () => {
    // 测试代码
  });

  it("should reject invalid status transition", async () => {
    // 测试代码
  });
});
```

**文档更新清单**:

```markdown
## CONFIGURATION.md 更新内容

- [ ] Backlog 工具介绍
- [ ] 工具参数说明
- [ ] 配置示例

## QUICK_START.md 更新内容

- [ ] Backlog 快速入门
- [ ] 创建第一个任务
- [ ] 查询和更新任务
- [ ] 示例代码

## AGENTS.md 更新内容

- [ ] Backlog 使用说明
- [ ] 项目结构更新
- [ ] 最佳实践

## API-CONTRACT.md 更新内容

- [ ] Backlog 数据模型
- [ ] 字段说明
- [ ] API 端点映射
```

---

## 任务依赖关系

```text
BL-CA-22 (Meilisearch配置)
         │
         ▼
BL-CA-23 (backlog_create)
         │
         ▼
BL-CA-24 (backlog_list)
         │
         ▼
BL-CA-25 (backlog_update_status)
         │
         ▼
BL-CA-26 (测试和文档)
```

## 实施优先级

| 优先级 | 任务     | 阶段    | 预期时间 | 预期收益 |
| ------ | -------- | ------- | -------- | -------- |
| P0     | BL-CA-22 | Phase 1 | 0.5天    | 基础设施 |
| P0     | BL-CA-23 | Phase 2 | 1-2天    | 核心功能 |
| P0     | BL-CA-24 | Phase 3 | 1-2天    | 核心功能 |
| P1     | BL-CA-25 | Phase 4 | 1天      | 状态管理 |
| P1     | BL-CA-26 | Phase 5 | 1-2天    | 质量保证 |

**总计**: 5-8天

---

## 验收检查清单

### Phase 1 验收 (BL-CA-22)

- [ ] Meilisearch 配置已更新
- [ ] 索引重建成功
- [ ] 过滤查询测试通过
- [ ] 排序查询测试通过

### Phase 2 验收 (BL-CA-23)

- [ ] backlog_create 工具可用
- [ ] 可以成功创建 Backlog 任务
- [ ] ULID 生成正确
- [ ] 5要素内容格式正确
- [ ] 单元测试通过

### Phase 3 验收 (BL-CA-24)

- [ ] backlog_list 工具可用
- [ ] 过滤功能正常
- [ ] 排序功能正常
- [ ] 分页功能正常
- [ ] 输出格式清晰

### Phase 4 验收 (BL-CA-25)

- [ ] backlog_update_status 工具可用
- [ ] 状态流转验证正确
- [ ] 时间戳自动更新
- [ ] 阻塞状态处理正确

### Phase 5 验收 (BL-CA-26)

- [ ] 测试覆盖率 > 80%
- [ ] 所有文档更新完成
- [ ] 性能测试达标
- [ ] 端到端测试通过
- [ ] 代码质量检查通过

---

## 变更历史

| 版本   | 日期       | 变更内容                                                                                |
| ------ | ---------- | --------------------------------------------------------------------------------------- |
| v1.1.0 | 2026-04-07 | 完善所有 Backlog 条目，添加详细的 5要素（目标、涉及范围、前置依赖、完成标准、验证方式） |
| v1.0.0 | 2026-04-07 | 初始创建，基于 BACKLOG_V2_DESIGN.md 最终方案                                            |
