# Backlog

> 任务追踪文档，按优先级排序

**更新时间**: 2026-03-28

---

## v2.6.0 - 代码规范迁移

### BL-201: Oxlint + Prettier 迁移（第一阶段：安装与配置）

**真实场景**: 项目当前使用 ESLint，但配置较旧且速度较慢。Oxlint 基于 Rust 构建，速度提升 10-50 倍，且开箱即用无需复杂配置。

**目标**: 完全替换 ESLint，使用 Oxlint + Prettier 作为代码检查和格式化工具

| 项目         | 内容                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **涉及范围** | `package.json`、`.eslintrc.cjs`、`eslint.config.js`、删除 ESLint 依赖、添加 Oxlint/Prettier                                                                                                                                                          |
| **前置依赖** | Node.js v22.18.0（已确认支持）                                                                                                                                                                                                                       |
| **完成标准** | 1. 安装 `oxlint` 和 `prettier` 到 devDependencies<br>2. 移除 `@eslint/js` 和 `globals` 依赖<br>3. 删除 `.eslintrc.cjs` 和 `eslint.config.js`<br>4. 更新 npm scripts：`lint`/`lint:fix`/`format`/`format:check`<br>5. 保留现有 `.prettierrc` 配置不变 |
| **验证方式** | `npm install` 成功，`npm run lint` 命令存在且不报错                                                                                                                                                                                                  |

---

### BL-202: Oxlint 代码问题修复（第二阶段：自动修复与格式整理）

**真实场景**: 首次运行 Oxlint 发现 8 个问题（5 警告 + 3 错误），同时 Prettier 检查发现大量文件需要格式化。先处理支持自动修复的问题和代码格式化。

**目标**:

1. 运行 `oxlint . --fix` 自动修复可修复的问题
2. 运行 `prettier --write` 格式化所有代码文件
3. 修复明显的语法错误（如 `tests/test-phase-c-performance.js` 的三重引号）

| 项目         | 内容                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **涉及范围** | 1. `tests/test-phase-c-performance.js`（语法错误修复）<br>2. `tests/test-sync-methods.test.js`（括号不匹配检查）<br>3. 所有 `.js`, `.cjs`, `.mjs` 文件（自动修复 + 格式化） |
| **前置依赖** | BL-201 完成（Oxlint 和 Prettier 已安装）                                                                                                                                    |
| **完成标准** | 1. `npm run lint:fix` 执行成功<br>2. `npm run format` 执行成功<br>3. 语法错误文件已修复<br>4. 剩余问题仅为需要手动修复的警告                                                |
| **验证方式** | 1. `npm run lint` 显示剩余问题数量<br>2. `npm run format:check` 无格式错误<br>3. 记录剩余需要手动修复的问题清单                                                             |

**当前已识别的 8 个问题**（BL-202 处理后剩余应为手动修复项）：

| 文件                                  | 问题                  | 类型    | 修复方式                   |
| ------------------------------------- | --------------------- | ------- | -------------------------- |
| `tests/test-phase-c-performance.js:1` | 三重引号 `"""`        | ❌ 错误 | 手动修复为 `//` 或 `/* */` |
| `tests/test-sync-methods.test.js:24`  | 括号不匹配            | ❌ 错误 | 手动检查修复               |
| `tests/test-topic-sync.test.js:8`     | `beforeEach` 未使用   | ⚠️ 警告 | `--fix` 自动               |
| `bin/cli.cjs:155`                     | catch 参数 `e` 未使用 | ⚠️ 警告 | `--fix` 自动或手动         |
| `bin/cli.cjs:273`                     | catch 参数 `e` 未使用 | ⚠️ 警告 | `--fix` 自动或手动         |
| `cli/index.cjs:258`                   | 参数 `args` 未使用    | ⚠️ 警告 | 手动（需确认是否保留）     |

---

### BL-203: Oxlint 代码问题修复（第三阶段：手动修复 - 批次一）

**真实场景**: BL-202 自动修复后，仍剩余 5 个 `no-unused-vars` 警告需要人工处理。这些警告分布在测试文件和 CLI 文件中，需要判断是删除未使用变量，还是改为 `_` 前缀保留（Oxlint 会忽略 `_` 前缀的变量）。

**目标**: 手动修复剩余的 5 个 Oxlint 警告

| 项目         | 内容                                                                                                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **涉及范围** | 1. `tests/test-topic-sync.test.js:8`（`beforeEach` 未使用）<br>2. `bin/cli.cjs:155`（catch 参数 `e` 未使用）<br>3. `bin/cli.cjs:227`（参数 `args` 未使用）<br>4. `bin/cli.cjs:259`（参数 `args` 未使用）<br>5. `bin/cli.cjs:274`（catch 参数 `e` 未使用）                        |
| **前置依赖** | BL-202 完成（自动修复已执行，剩余 5 个警告）                                                                                                                                                                                                                                     |
| **完成标准** | 1. `tests/test-topic-sync.test.js`：`beforeEach` 从导入中移除<br>2. `bin/cli.cjs:155` 和 `bin/cli.cjs:274`：catch 参数改为 `_e`（表示故意忽略）<br>3. `bin/cli.cjs:227` 和 `bin/cli.cjs:259`：参数改为 `_args`（表示接口保留但暂不实现）<br>4. 修复后 `npm run lint` 显示 0 警告 |
| **验证方式** | 1. `npm run lint` 显示 "0 warnings and 0 errors"<br>2. `npm test` 仍通过（确保修改未破坏功能）                                                                                                                                                                                   |

**修复策略说明**:

- **导入的未使用变量**（`beforeEach`）：直接删除导入
- **catch 参数**：改为 `_e` 表示故意忽略错误（保留异常处理结构）
- **函数参数**：改为 `_args` 表示接口需要但暂未使用（保留函数签名兼容性）

**为什么保留这些变量而不是删除？**

- `catch (_e)`：保留异常处理结构，未来可能需要记录或处理错误
- `function initDaily(_args)`：保留参数表示接口设计，未来可能扩展功能

---

### BL-204: Oxlint 代码问题修复（第四阶段：最终验证）

**真实场景**: 手动修复完成后，需要验证整个项目是否完全通过 Oxlint 检查，同时确保测试仍然通过。

**目标**: 确保整个项目通过 Oxlint 检查且测试通过

| 项目         | 内容                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **涉及范围** | 整个项目所有文件（除 `.eslintignore` 中排除的）                                                                        |
| **前置依赖** | BL-203 完成                                                                                                            |
| **完成标准** | 1. `npm run lint` 显示 "0 warnings and 0 errors"<br>2. `npm run format:check` 无格式错误<br>3. `npm test` 所有测试通过 |
| **验证方式** | 顺序执行以下命令并全部通过：<br>1. `npm run lint`<br>2. `npm run format:check`<br>3. `npm test`                        |

---

### BL-205: 文档更新 - README 产品文档

**真实场景**: 用户需要知道项目使用什么代码规范，如何运行检查命令。当前 README.md 没有代码规范相关说明。

**目标**: 在 README.md 中新增代码规范章节

| 项目         | 内容                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **涉及范围** | `README.md`（根目录）                                                                                                                                                                       |
| **前置依赖** | BL-204 完成（lint 命令可用，0 warnings and 0 errors）                                                                                                                                       |
| **完成标准** | 1. 在 "📖 Usage" 章节后新增 "代码规范" 章节<br>2. 说明使用 Oxlint + Prettier<br>3. 列出常用命令：`npm run lint`、`npm run format`<br>4. 说明 `.oxlintrc.json` 和 `.prettierrc` 配置文件位置 |
| **验证方式** | 1. README 中包含 "代码规范" 章节<br>2. 命令可复制执行<br>3. `npm run lint` 和 `npm run format` 命令存在且可用                                                                               |

**插入位置**: 在 "📖 Usage"（第 200 行）和 "📂 Project Structure"（第 273 行）之间

**预期内容**:

````markdown
## 代码规范

本项目使用 [Oxlint](https://oxc.rs/) + [Prettier](https://prettier.io/) 进行代码检查和格式化。

```bash
# 检查代码规范
npm run lint

# 自动修复可修复的问题
npm run lint:fix

# 格式化代码
npm run format

# 检查格式是否正确
npm run format:check
```
````

配置文件：

- `.oxlintrc.json` - Oxlint 规则配置
- `.prettierrc` - Prettier 格式配置
- `.eslintignore` - 忽略文件列表

````

---

### BL-206: 文档更新 - AGENTS.md 开发文档

**真实场景**: 开发者需要了解技术决策（为什么选 Oxlint）、配置细节、与 ESLint 的区别。当前 AGENTS.md 没有代码规范相关说明。

**目标**: 在 AGENTS.md 中新增代码规范技术说明

| 项目 | 内容 |
|------|------|
| **涉及范围** | `AGENTS.md`（根目录） |
| **前置依赖** | BL-204 完成（lint 命令可用） |
| **完成标准** | 1. 新增 "代码规范" 章节<br>2. 说明选择 Oxlint 的原因（速度、Rust 实现、开箱即用）<br>3. 列出 Oxlint 不支持但 ESLint 支持的规则（如 `no-shadow`）<br>4. 说明 `.oxlintrc.json` 配置要点（`caughtErrorsIgnorePattern` 需显式配置）<br>5. 说明 npm scripts 用法 |
| **验证方式** | 1. AGENTS.md 包含 "代码规范" 章节<br>2. 包含技术决策说明<br>3. 包含配置要点 |

**插入位置**: 在 "代码规范" 章节（如果已有则更新，否则在 "模块映射" 后新增）

**预期内容**:
```markdown
### 代码规范

**工具**: Oxlint + Prettier（替代 ESLint）

**选择原因**:
- Oxlint 基于 Rust 构建，速度比 ESLint 快 10-50 倍
- 开箱即用，无需复杂配置
- 与 Prettier 天然兼容，无规则冲突

**配置要点**:
- `.oxlintrc.json` - Oxlint 规则配置
  - `caughtErrorsIgnorePattern: "^_"` 需显式配置（catch 参数忽略 `_` 前缀）
  - `varsIgnorePattern` 和 `argsIgnorePattern` 默认就是 `^_`
- `.prettierrc` - Prettier 格式配置（保持不变）
- `.eslintignore` - 忽略文件列表（Oxlint 使用此文件）

**Oxlint 不支持的规则**（原 ESLint 规则）:
- `no-shadow`
- `prefer-arrow-callback`
- `object-shorthand`
- `no-multiple-empty-lines`
- `eol-last`

**npm scripts**:
- `npm run lint` - 检查代码规范
- `npm run lint:fix` - 自动修复可修复的问题
- `npm run format` - 格式化代码
- `npm run format:check` - 检查格式是否正确
````

---

## v2.5.2 - 后端 v2.4.0 对齐

### BL-115: syncIncremental → syncPreview 重命名

**真实场景**: 后端 v2.4.0 将 `/api/v1/sync/incremental` 重命名为 `/api/v1/sync/preview`。插件 wrapper-client 的方法名应与后端对齐，避免未来旧路由被移除后失效。

**目标**: wrapper-client 方法名和 HTTP 路径同步更新

| 项目         | 内容                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| **涉及范围** | `lib/wrapper-client.js`、`tools/sync.js`、`tests/test-sync-methods.test.js`、`docs/API-CONTRACT.md` |
| **前置依赖** | 后端 v2.4.0 已部署                                                                                  |
| **完成标准** | `client.syncPreview()` 调用 `/api/v1/sync/preview`，工具行为不变                                    |
| **验证方式** | `node -e "..."` 验证方法存在，ESLint 通过                                                           |

---

### BL-116: full_sync auto_clean 参数

**真实场景**: 用户重装系统后 full_sync 返回 50 条 skipped，但本地重复文件一直存在，每次同步都会重复上传被跳过。需要一个方式清理这些已同步的本地重复。

**目标**: full_sync 新增 `auto_clean: true` 参数，自动删除被后端标记为重复的本地文件

| 项目         | 内容                                                            |
| ------------ | --------------------------------------------------------------- |
| **涉及范围** | `tools/sync.js`、`docs/API-CONTRACT.md`                         |
| **前置依赖** | 后端 v2.4.0 skipped 返回值                                      |
| **完成标准** | `auto_clean=true` 时，删除 timeline 文件 + 从 link-map 移除条目 |
| **验证方式** | ESLint 通过，手动调用 full_sync auto_clean=true 验证            |

---

## v2.5.1 - Bug 修复（第三轮）

### BL-107: sync_checkpoint 无参调用默认值失效

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `tools/sync.js`
- **问题**: 不传 action 参数时，zod schema default 不生效，`args.action` 为 undefined
- **修复**: 在 execute 内增加 `const action = args.action || 'list'` 防御

### BL-108: full_sync wrapper-client 缺少 abstract/overview/local_id

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `lib/wrapper-client.js`
- **问题**: `syncFull()` 方法的 memories.map 缺少 abstract、overview、local_id 字段
- **修复**: 补全字段映射

### BL-109: createRelation 传参名不匹配

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `tools/graph.js`
- **问题**: graph.js 传 `relation_type`，wrapper-client 期望 `relationship_type`
- **修复**: 统一为 `relationship_type`

### BL-110: memory_relate query 字段映射错误

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `tools/graph.js`
- **问题**: 后端返回 `{from, to, relationship_type}`，代码用 `r.to_id` / `r.relation_type`
- **修复**: 防御性字段映射 `r.to || r.to_id`

### BL-111: memory_graph 结果数组取错字段

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `tools/graph.js`
- **问题**: 后端返回 `{memories: [], total, source, depth}`，代码只检查 `results.relations`
- **修复**: 优先取 `results.memories || results.relations || []`

### BL-112: memory_suggest 动态 import 问题

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `tools/search.js`
- **问题**: `await import()` 动态导入可能与模块缓存冲突，返回非数组
- **修复**: 改用静态 import，与文件顶部保持一致

### BL-113: conflict_resolve 枚举值大小写不匹配

- **状态**: ✅ 已修复（需重启 OpenCode 验证）
- **文件**: `tools/sync.js`
- **问题**: tool schema 描述 `USE_LOCAL/USE_BACKEND/MERGE`，后端只接受小写 `use_local/use_remote/keep_both`
- **修复**: 1) 更新 schema describe 2) execute 中 `.toLowerCase()` 转换

### BL-114: 第四轮全面测试（最终验证）

**目标**: 重启 OpenCode 后验证所有 15 工具

| 项目         | 内容                     |
| ------------ | ------------------------ |
| **涉及范围** | 15 个工具                |
| **前置依赖** | BL-107 ~ BL-113 代码修复 |
| **完成标准** | 15/15 全部通过           |
| **验证方式** | OpenCode 内逐工具调用    |

**第四轮测试结果** (2026-03-28，重启后):

| #   | 工具                   | 结果 | 备注                          |
| --- | ---------------------- | ---- | ----------------------------- |
| 1   | memory_write           | ✅   |                               |
| 2   | memory_read            | ✅   |                               |
| 3   | memory_search          | ✅   |                               |
| 4   | memory_suggest         | ✅   | 静态 import 修复生效          |
| 5   | memory_relate (create) | ✅   |                               |
| 6   | memory_relate (query)  | ✅   | 字段映射修复生效              |
| 7   | memory_graph           | ✅   | 后端返回空数组，正确显示      |
| 8   | memory_timeline        | ✅   |                               |
| 9   | memory_topics          | ✅   |                               |
| 10  | rebuild_index          | ✅   |                               |
| 11  | incremental_sync       | ✅   |                               |
| 12  | full_sync              | ✅   | 0 uploaded = 后端去重，非 bug |
| 13  | conflict_list          | ✅   |                               |
| 14  | conflict_resolve       | ✅   | 大小写转换修复生效            |
| 15  | index_status           | ✅   |                               |
| 15b | sync_checkpoint (带参) | ✅   |                               |
| 15c | sync_checkpoint (无参) | ✅   | args 防御修复生效             |

**通过率**: ✅ **15/15 (100%)**

**full_sync 0 uploaded 说明**: 后端通过 source_id 去重，所有本地记忆已存在于后端，行为正确。通过 curl 直接测试新内容可正常上传 (success:1)。

---

## 后端问题报告

> 以下问题在后端 v2.4.0 中已修复

### B-001: relationship_type 白名单限制 ✅ 已修复

- **严重度**: 低
- **端点**: `POST /api/v1/memories/relations`
- **问题**: 传非法类型时返回不友好的错误
- **修复**: 后端已返回清晰的错误提示 `Invalid relationship_type: 'xxx'. Must be one of: [...]`

### B-002: conflict resolution 值大小写敏感 ✅ 已修复

- **严重度**: 低
- **端点**: `POST /api/v1/sync/conflicts/{id}/resolve`
- **问题**: 只接受小写 `use_local/use_remote/keep_both`
- **修复**: 后端 v2.4.0 已支持大小写不敏感

### B-003: full_sync 返回 0 uploaded, 0 skipped ✅ 已修复

- **严重度**: 中
- **端点**: `POST /api/v1/sync/full`
- **问题**: 上传多条记忆但返回 `0 uploaded, 0 skipped`
- **修复**: 后端 v2.4.0 新增 `skipped` 列表（含 `local_id`, `existing_id`, `reason`, `similarity`）和 `updated` 字段；`errors` 仅保留真正的异常

---

## v2.5.1 - Bug 修复（第二轮，已完成）

### BL-101: incremental_sync 工具层缺参数 ✅

**目标**: 工具层需要收集本地指纹，传给后端进行增量比对

| 项目         | 内容                                                    |
| ------------ | ------------------------------------------------------- |
| **涉及范围** | `tools/sync.js`                                         |
| **前置依赖** | 无                                                      |
| **完成标准** | 工具读取 link-map，构造 fingerprints 数组，调用后端 API |
| **验证方式** | 有未同步条目时返回同步结果；无未同步时返回 0            |

**问题**: 工具直接调用 `client.syncIncremental()` 无参数，后端要求 `{fingerprints: [{path, mtime, hash, source_id}], tenant_id}`

**后端 API**: `POST /api/v1/sync/incremental`

**后端 Schema**:

```json
{
  "fingerprints": [
    {
      "path": "string",
      "mtime": "int",
      "hash": "string",
      "source_id": "string"
    }
  ],
  "tenant_id": "string (default: default)"
}
```

**修复方案**: 工具层遍历 link-map 中未同步条目，读取文件 stat 信息，构造指纹数组

---

### BL-102: full_sync 工具层缺参数 ✅

**目标**: 工具层需要读取所有本地记忆文件，构造 memories 数组上传

| 项目         | 内容                                               |
| ------------ | -------------------------------------------------- |
| **涉及范围** | `tools/sync.js`                                    |
| **前置依赖** | 无                                                 |
| **完成标准** | 工具读取本地文件，构造 memories 数组，调用后端 API |
| **验证方式** | 有条目时返回上传结果；无条目时返回 0               |

**问题**: 工具直接调用 `client.syncFull()` 无参数，后端要求 `{memories: [MemoryItem], tenant_id}`

**后端 API**: `POST /api/v1/sync/full`

**后端 Schema**:

```json
{
  "memories": [
    {
      "content": "string (required)",
      "abstract": "string?",
      "overview": "string?",
      "type": "string",
      "tags": ["string"],
      "metadata": {},
      "project_id": "string",
      "source": "string",
      "source_id": "string?"
    }
  ],
  "tenant_id": "string (default: default)"
}
```

**修复方案**: 工具层遍历 timeline 目录，读取每个文件内容，解析 frontmatter，构造 MemoryItem 数组

---

### BL-103: conflict_resolve wrapper-client 参数传错 ✅

**目标**: wrapper-client 的 resolveConflict 方法正确传递 resolution 到后端

| 项目         | 内容                         |
| ------------ | ---------------------------- |
| **涉及范围** | `lib/wrapper-client.js`      |
| **前置依赖** | 无                           |
| **完成标准** | 请求体包含 `resolution` 字段 |
| **验证方式** | 不报 422                     |

**问题**: `resolveConflict(conflict_id, resolution, tenant_id)` 方法签名正确，但请求体构造时把 `resolution` 放在了 `requestBody` 外层

**后端 API**: `POST /api/v1/sync/conflicts/{conflict_id}/resolve`

**后端 Schema**:

```json
{
  "resolution": "string (required) - use_local | use_remote | keep_both",
  "tenant_id": "string (default: default)"
}
```

**修复方案**: 检查 wrapper-client 中 `requestBody` 是否正确包含 `resolution` 字段

---

### BL-104: batch_resolve API 不存在 ✅

**目标**: 移除 batch_resolve 工具（后端未实现此 API）

| 项目         | 内容                                                  |
| ------------ | ----------------------------------------------------- |
| **涉及范围** | `tools/sync.js`, `plugin.js`, `lib/wrapper-client.js` |
| **前置依赖** | 无                                                    |
| **完成标准** | 移除工具，不报错                                      |
| **验证方式** | 工具列表中不再包含 batch_resolve                      |

**问题**: 后端无 `/api/v1/sync/conflicts/batch-resolve` 端点，返回 404

**后端 API**: 该端点不存在

**修复方案**: 删除 batch_resolve 工具、wrapper-client 方法、plugin.js 导出

---

### BL-105: 创建 API-CONTRACT.md ✅

**目标**: 建立工具↔后端 API 映射文档

| 项目         | 内容                                  |
| ------------ | ------------------------------------- |
| **涉及范围** | `docs/API-CONTRACT.md` (新建)         |
| **前置依赖** | BL-101 ~ BL-104 修复后                |
| **完成标准** | 每个需要后端的工具都有对应的 API 映射 |
| **验证方式** | 文档与代码一致                        |

---

### BL-106: 精简 AGENTS.md

**目标**: 移除产品信息，保留开发信息

| 项目         | 内容                     |
| ------------ | ------------------------ |
| **涉及范围** | `AGENTS.md`              |
| **前置依赖** | BL-105                   |
| **完成标准** | AGENTS.md 不包含产品介绍 |
| **验证方式** | 无产品相关内容           |

**具体任务**:

- [ ] 移除"核心功能"、"使用场景"等产品信息
- [ ] 移除工具使用说明（属于产品文档）
- [ ] 保留项目结构、模块映射、代码规范

---

## v2.5.0 - 工具优化

### BL-001: 工具合并与清理 ✅

**目标**: 简化工具集，删除冗余工具

| 项目         | 内容                                              |
| ------------ | ------------------------------------------------- |
| **涉及范围** | `tools/sync.js`, `plugin.js`, `index.js`          |
| **前置依赖** | 无                                                |
| **完成标准** | 删除 list_daily, init_daily, sync_status 三个工具 |
| **验证方式** | 工具数量从 19 减至 15                             |

### BL-002: CLI 时间线命令 ✅

**目标**: CLI 有时间线查看命令

| 项目         | 内容                                     |
| ------------ | ---------------------------------------- |
| **涉及范围** | `cli/index.cjs`                          |
| **前置依赖** | BL-001                                   |
| **完成标准** | CLI 有时间线查看命令                     |
| **验证方式** | `opencode-memory list --days 7` 正常工作 |

**结论**: CLI `list` 命令已实现时间线功能，无需额外开发

### BL-003: index_status 功能增强 ✅

**目标**: index_status 显示同步详情

| 项目         | 内容                                    |
| ------------ | --------------------------------------- |
| **涉及范围** | `tools/sync.js`, `cli/index.cjs`        |
| **前置依赖** | BL-001                                  |
| **完成标准** | 增加 `--detailed` 参数显示 pending 条目 |
| **验证方式** | `status --detailed` 显示 pending 详情   |

### BL-004: sync_checkpoint 工具实现 ✅

**目标**: 实现同步检查点工具

| 项目         | 内容                                          |
| ------------ | --------------------------------------------- |
| **涉及范围** | `tools/sync.js`, `plugin.js`, `cli/index.cjs` |
| **前置依赖** | 后端 API `/api/v1/sync/fingerprints`          |
| **完成标准** | 可查看同步检查点                              |
| **验证方式** | `checkpoint` 命令返回指纹列表                 |

### BL-105: 第二轮全面测试

**目标**: 修复后重新测试所有工具，通过率 15/15

| 项目         | 内容                               |
| ------------ | ---------------------------------- |
| **涉及范围** | 15 个工具（移除 batch_resolve 后） |
| **前置依赖** | BL-101 ~ BL-104                    |
| **完成标准** | 15 个工具全部通过                  |
| **验证方式** | CLI 测试                           |

---

## v2.5.0 - 全面测试

### BL-008: 全面测试（第一轮）

**目标**: 验证所有 16 个工具

| 项目         | 内容                  |
| ------------ | --------------------- |
| **涉及范围** | 16 个工具             |
| **前置依赖** | BL-001 ~ BL-004       |
| **完成标准** | 16 个工具全部测试通过 |
| **验证方式** | CLI 测试              |

**测试结果** (2026-03-27):

| 工具              | 结果 | 备注                  |
| ----------------- | ---- | --------------------- |
| memory_write      | ✅   | 写入成功，后端同步    |
| memory_read       | ✅   | Level 0/1/2 全部正常  |
| memory_search     | ✅   | keyword + hybrid 正常 |
| memory_timeline   | ✅   | CLI list 正常         |
| memory_topics     | ✅   | 标签统计正常          |
| index_status      | ✅   | basic + detailed 正常 |
| rebuild_index     | ✅   | 已同步条目提示正确    |
| sync_checkpoint   | ✅   | 查看检查点正常        |
| memory_relate     | ✅   | create + query 正常   |
| memory_graph      | ✅   | 修复后正常            |
| memory_suggest    | ✅   | 修复后正常            |
| conflict_list     | ✅   | 空列表正常            |
| incremental_sync  | ❌   | BL-101                |
| full_sync         | ❌   | BL-102                |
| conflict_resolve  | ❌   | BL-103                |
| ~~batch_resolve~~ | ❌   | BL-104 (移除)         |

**通过率**: 12/16 (75%)

**本轮修复的 Bug**:

| Bug                         | 文件              | 修复                           |
| --------------------------- | ----------------- | ------------------------------ |
| `incrementalSync` 方法名    | tools/sync.js     | → `syncIncremental`            |
| `fullSync` 方法名           | tools/sync.js     | → `syncFull`                   |
| `getRelations` 返回非数组   | tools/graph.js    | Array.isArray 防御             |
| `traverseGraph` 参数名      | tools/graph.js    | `start_id` → `memory_id`       |
| `traverseGraph` 返回非数组  | tools/graph.js    | 防御处理                       |
| `searchByPrefix` 参数不匹配 | tools/search.js   | → `getAutocompleteSuggestions` |
| `listConflicts` 不存在      | wrapper-client.js | 已添加                         |
| `batchResolve` 不存在       | wrapper-client.js | 已添加                         |
| `getStatus` 不存在          | wrapper-client.js | 已添加                         |

---

## 待定

### BL-009: memory_pin 工具

| 项目         | 内容                |
| ------------ | ------------------- |
| **涉及范围** | `tools/core.js`     |
| **前置依赖** | 无                  |
| **完成标准** | 可置顶/取消置顶条目 |
| **状态**     | 待定                |

### BL-010: memory_list 工具

| 项目         | 内容       |
| ------------ | ---------- |
| **涉及范围** | `tools/`   |
| **前置依赖** | 无         |
| **完成标准** | 可列出条目 |
| **状态**     | 待定       |

---

## 已完成

### BL-001: 工具合并与清理 ✅

- **完成时间**: 2026-03-27
- **内容**: 删除 list_daily, init_daily, sync_status (19→16)

### BL-MISC-1: syncMemoryToBackend 修复 ✅

- **完成时间**: 2026-03-27
- **内容**: 修复上传缺少 abstract/overview

### BL-MISC-2: 搜索结果显示修复 ✅

- **完成时间**: 2026-03-27
- **内容**: 修复 N/A 显示

### BL-MISC-3: CLI 三层必填 ✅

- **完成时间**: 2026-03-27
- **内容**: 写入必须提供 abstract 和 overview

### BL-MISC-4: 记忆条目格式升级 ✅

- **完成时间**: 2026-03-27
- **内容**: `# ≡≡≡` 分隔符 + ``` 包围 + meta 字段

### BL-MISC-5: CLI meta 参数 ✅

- **完成时间**: 2026-03-27
- **内容**: `--meta` 参数支持

### BL-MISC-6: getStatus 添加 ✅

- **完成时间**: 2026-03-27
- **内容**: wrapper-client 添加 getStatus() 方法
