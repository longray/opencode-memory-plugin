# Backlog

> ⚠️ **创建新任务前必读**：
>
> 1. 检查当前最大编号：`grep "### BL-" BACKLOG.md | tail -1` → **当前最大：BL-35**
> 2. 下一个可用编号：**BL-36**
> 3. 规则：**永不复用、永不跳号**（详见 [`AGENTS.md#backlog-编号规则`](./AGENTS.md)）
> 4. 如编号冲突，使用下一个可用编号（BL-36, BL-37, BL-38...)
>
> 未完成任务。已完成任务归档至 [`backlog_archive.md`](./backlog_archive.md)。
> 已发布版本详见 [`CHANGELOG.md`](./CHANGELOG.md)。

**更新时间**: 2026-04-02 02:00  
**版本**: v2.9.0  
**当前阶段**: 阶段 5 — 文档质量改进（已完成）+ 集成测试修复（进行中）

---

## 文档分类说明

本项目文档分为三类，分工明确：

| 类别         | 回答       | 受众       | 位置                               |
| ------------ | ---------- | ---------- | ---------------------------------- |
| **产品文档** | 怎么用？   | 用户       | 根目录 + `opencode-memory-plugin/` |
| **开发文档** | 怎么实现？ | 开发者     | `docs/` + 后端 docs                |
| **Backlog**  | 做什么？   | 项目管理者 | 根目录 + `handoffs/`               |

---

## 场景四：文档治理 — 消除冗余、归档过时、统一分类

> **背景**: 项目有 55+ 个 md 文件，大量过时文档（v2.3.0 时代）散布在多个位置。产品文档、开发文档、Backlog 混在一起。
>
> **目标**: 建立三类文档分工（产品/开发/Backlog），归档过时文档，修复关键不一致。

---

### BL-1 [P0] 产品文档紧急修复

| 项目         | 内容                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 修复 README.md 和 README.npm.md 中的严重错误，避免误导用户                                                                                                                                                                                                                                        |
| **涉及范围** | 1. `README.md`（根目录）<br>2. `opencode-memory-plugin/README.npm.md`                                                                                                                                                                                                                             |
| **前置依赖** | 无                                                                                                                                                                                                                                                                                                |
| **完成标准** | 1. 工具数 16→15（实际导出 15 个）<br>2. 删除孤立 `)`（L119）<br>3. 移除死链（DESIGN\_\*.md、ARCHITECTURE.md、MIGRATION_GUIDE.md）<br>4. 更新项目结构树（匹配实际文件）<br>5. README.npm.md 核心工具表添加 `memory_pin`<br>6. 删除双重 License 徽章<br>7. 修正 "Use TypeScript" → "Use JavaScript" |
| **验证方式** | 1. `npm run lint:md` 通过<br>2. 手动检查 README.md 无 404 链接<br>3. 对比 `plugin.js` 工具列表与文档一致                                                                                                                                                                                          |
| **状态**     | ✅ 已完成                                                                                                                                                                                                                                                                                         |

---

### BL-2 [P1] 过时文档归档

| 项目         | 内容                                                                                                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 将已过时的设计文档从活跃位置移至 `docs/archive/`，保持项目目录整洁                                                                                                                                                        |
| **涉及范围** | 1. `docs/BACKLOG.md`（已标记归档但未移动）<br>2. `opencode-memory-plugin/CHANGELOG.md`（与根目录重复）<br>3. `docs/CODE-ANALYSIS-DESIGN.md`（v1.0，被 v1.2 取代）                                                         |
| **前置依赖** | BL-1 完成（先修复活跃文档）                                                                                                                                                                                               |
| **完成标准** | 1. `docs/BACKLOG.md` 移至 `docs/archive/BACKLOG-old.md`<br>2. `opencode-memory-plugin/CHANGELOG.md` 删除<br>3. `docs/CODE-ANALYSIS-DESIGN.md` 移至 `docs/archive/CODE-ANALYSIS-DESIGN-v1.0.md`<br>4. 活跃目录中无过时文件 |
| **验证方式** | 1. `ls docs/` 无 BACKLOG.md<br>2. `ls opencode-memory-plugin/` 无 CHANGELOG.md<br>3. `ls docs/archive/` 包含 3 个归档文件<br>4. `npm run lint:md` 通过                                                                    |
| **状态**     | ✅ 已完成                                                                                                                                                                                                                 |

---

### BL-3 [P1] 产品文档版本同步

| 项目         | 内容                                                                                                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 将所有产品文档的版本号统一更新为 v2.9.0，移除过时配置引用                                                                                                                                                                                                                                                           |
| **涉及范围** | 1. `opencode-memory-plugin/CONFIGURATION.md`<br>2. `opencode-memory-plugin/QUICK_START.md`<br>3. `opencode-memory-plugin/TROUBLESHOOTING.md`<br>4. `opencode-memory-plugin/WINDOWS_SETUP.md`<br>5. `opencode-memory-plugin/EXTERNAL_EMBEDDING.md`                                                                   |
| **前置依赖** | BL-1、BL-2 完成                                                                                                                                                                                                                                                                                                     |
| **完成标准** | 1. 所有产品文档头部标注 `版本：v2.9.0`<br>2. CONFIGURATION.md 移除 Xenova 本地模型配置<br>3. CONFIGURATION.md 移除 `batch_resolve` 工具引用<br>4. QUICK_START.md 替换 `list_daily`/`init_daily` → `memory_timeline`<br>5. TROUBLESHOOTING.md 更新为后端优先架构<br>6. WINDOWS_SETUP.md 添加 ModelScope API 配置路径 |
| **验证方式** | 1. `grep "v2.3.0" opencode-memory-plugin/*.md` 无结果<br>2. `grep "Xenova" opencode-memory-plugin/*.md` 无结果<br>3. `grep "batch_resolve" opencode-memory-plugin/*.md` 无结果<br>4. `grep "list_daily" opencode-memory-plugin/*.md` 无结果                                                                         |
| **状态**     | ✅ 已完成                                                                                                                                                                                                                                                                                                           |

---

### BL-4 [P1] memory/ 模板更新

| 项目         | 内容                                                                                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 更新 9 个 OpenClaw 风格记忆模板，移除已废弃功能引用（SQLite、daily 结构、旧工具名）                                                                                                                                                                                                                                                |
| **涉及范围** | `opencode-memory-plugin/memory/` 下 9 个文件：<br>- SOUL.md → 翻译为中文<br>- AGENTS.md → 更新 timeline 结构<br>- TOOLS.md → 移除废弃工具<br>- HEARTBEAT.md → 移除 SQLite 引用<br>- BOOT.md → 移除 Vector index 引用<br>- BOOTSTRAP.md → 移除 Git Backup/daily 引用<br>- IDENTITY.md、USER.md、MEMORY.md（检查更新）               |
| **前置依赖** | BL-2 完成（文档归档后模板才干净）                                                                                                                                                                                                                                                                                                  |
| **完成标准** | 1. SOUL.md 全文翻译为简体中文<br>2. AGENTS.md 中 `daily/YYYY-MM-DD.md` → `timeline/YYYY/MM/DD/`<br>3. TOOLS.md 移除 `list_daily`、`init_daily`、`sync_status`<br>4. HEARTBEAT.md 移除 "SQLite database"<br>5. BOOT.md 移除 "Vector index"<br>6. BOOTSTRAP.md 移除 "Git Backup"、"daily logs"<br>7. 所有模板头部标注 `版本：v2.9.0` |
| **验证方式** | 1. `grep "SQLite" opencode-memory-plugin/memory/*.md` 无结果<br>2. `grep "daily/" opencode-memory-plugin/memory/*.md` 无结果<br>3. `grep "Vector index" opencode-memory-plugin/memory/*.md` 无结果<br>4. 中文模板无英文段落（SOUL.md）                                                                                             |
| **状态**     | ✅ 已完成                                                                                                                                                                                                                                                                                                                          |

---

### BL-5 [P2] 开发文档重组

| 项目         | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 明确开发文档位置，新增缺失模块指南，建立开发文档导航页                                                                                                                                                                                                                                                                                                                                                                                        |
| **涉及范围** | 1. ~~`AGENTS.md`（根目录）→ 移至 `docs/AGENTS.md`~~ ❌ **已恢复**<br>2. 新增 `docs/README.md`（开发文档导航页） ✅<br>3. 新增 `docs/tools/AGENTS.md`（工具模块指南） ⏳ 可选<br>4. 更新 `docs/lib/AGENTS.md`（移除已删除文件引用） ⏳ 可选<br>5. 新增 `docs/ARCHITECTURE.md`（系统架构说明） ⏳ 可选                                                                                                                                          |
| **前置依赖** | BL-2 完成（文档归档后结构才清晰）                                                                                                                                                                                                                                                                                                                                                                                                             |
| **完成标准** | 1. ~~AGENTS.md 移至 `docs/AGENTS.md`~~ ❌ **用户偏好：保留在根目录**<br>2. 根目录保留 README.md（产品）、CHANGELOG.md（产品）、BACKLOG.md（Backlog）、AGENTS.md（开发） ✅<br>3. `docs/README.md` 包含开发文档索引（按模块分类） ✅<br>4. `docs/tools/AGENTS.md` 包含 5 个工具文件说明 ⏳ 可选<br>5. `docs/lib/AGENTS.md` 移除 `vector-store.js`、`service-validator.js` 引用 ⏳ 可选<br>6. `docs/ARCHITECTURE.md` 包含后端优先架构图 ⏳ 可选 |
| **验证方式** | 1. `ls *.md` 根目录保留 4 类文档（产品 + 开发+Backlog）<br>2. `ls docs/` 包含 README.md（开发导航页）<br>3. `grep "vector-store.js" docs/lib/AGENTS.md` 无结果（如创建）                                                                                                                                                                                                                                                                      |
| **状态**     | ✅ 已完成（部分）— AGENTS.md 保留在根目录（用户偏好）                                                                                                                                                                                                                                                                                                                                                                                         |

---

### BL-6 [P2] package.json 依赖清理

| 项目         | 内容                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 移除不再使用的依赖，减少安装体积和潜在冲突                                                                                                                                                  |
| **涉及范围** | `opencode-memory-plugin/package.json`                                                                                                                                                       |
| **前置依赖** | BL-2 完成（确认代码不再使用 better-sqlite3）                                                                                                                                                |
| **完成标准** | 1. 从 `dependencies` 移除 `better-sqlite3`<br>2. 从 `dependencies` 移除 `sqlite-vec`<br>3. 保留 Tree-sitter WASM（代码分析功能使用）<br>4. 更新 `README.md` 安装说明（如移除 Bun 相关说明） |
| **验证方式** | 1. `grep "better-sqlite3" opencode-memory-plugin/package.json` 无结果<br>2. `grep "sqlite-vec" opencode-memory-plugin/package.json` 无结果<br>3. `npm install` 成功<br>4. 所有测试通过      |
| **状态**     | ✅ 已完成                                                                                                                                                                                   |

---

### BL-8 [P1] 隐式偏好发现端到端验证

| 项目         | 内容                                                                                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 完整测试隐式偏好发现→报告→确认→保存的全流程，修复发现的问题                                                                                                                                                                                                                                          |
| **涉及范围** | 1. Observer prompt 微调（如需要）<br>2. 主代理 prompt 微调（如需要）<br>3. 文档更新（README + AGENTS）                                                                                                                                                                                               |
| **前置依赖** | BL-7 完成                                                                                                                                                                                                                                                                                            |
| **完成标准** | 1. 全流程跑通：对话行为→Observer 分析→主代理确认→用户确认→memory_write 成功<br>2. 设计测试对话：用户写代码→被 lint 检出→默默删除→再次提交<br>3. Observer 输出中包含"需要确认"的隐式发现区块<br>4. 主代理向用户确认："观察到你在第 N 轮遇到 XX 问题，是否需要保存这个记忆？"<br>5. 用户确认后保存成功 |
| **验证方式** | 1. 模拟真实使用场景测试<br>2. 检查记忆中是否有保存的隐式偏好条目<br>3. 更新 README.md 和 AGENTS.md 中的 Observer 使用说明                                                                                                                                                                            |
| **状态**     | ⏳ 下一步执行                                                                                                                                                                                                                                                                                        |

---

### BL-11.1 [P1] JSDoc 类型注释（新增）

| 项目         | 内容                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 在关键模块添加 JSDoc 类型注释，获得 IDE 智能提示，无需 TypeScript 编译步骤                                                                                                                                        |
| **涉及范围** | 1. `lib/wrapper-client.js`（WrapperClient 类） ✅<br>2. `lib/memory-core.js`（核心函数） ✅<br>3. `tools/*.js`（工具函数） ⚠️ 可选扩展<br>4. `lib/code-analyzer.js`（新增模块） ✅                                |
| **前置依赖** | BL-9、BL-10 完成（bug 修复后才能加类型）                                                                                                                                                                          |
| **完成标准** | 1. WrapperClient 所有公共方法有 `@param` 和 `@returns` ✅<br>2. 工具函数参数有类型注释 ⚠️（可选扩展）<br>3. 复杂数据结构有 `@typedef` ✅<br>4. VS Code 悬浮显示类型信息 ✅<br>5. 无编译步骤，保持纯 JavaScript ✅ |
| **验证方式** | 1. VS Code 悬浮显示 `WrapperClient.search()` 参数类型 ✅<br>2. `npm run lint` 通过 ✅<br>3. 新贡献者能根据类型注释快速理解 API ✅<br>4. 语法检查全部通过 ✅                                                       |
| **状态**     | ✅ 已完成（核心库完成，tools/ 可选扩展）                                                                                                                                                                          |

**示例**：

```javascript
/**
 * @typedef {Object} SearchParams
 * @property {string} query - 搜索查询
 * @property {'vector'|'keyword'|'hybrid'} [mode='hybrid'] - 搜索模式
 * @property {number} [limit=10] - 结果数量
 * @property {string} tenant_id - 租户 ID
 */

/**
 * 搜索记忆
 * @param {SearchParams} params - 搜索参数
 * @returns {Promise<{results: Array, total: number}>} 搜索结果
 */
async search(params) {
  // ...
}
```

---

### BL-12 [P1] 代码分析功能测试覆盖

| 项目         | 内容                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 为代码分析功能的 4 个新模块编写单元测试，覆盖率 >80%                                                                                                                                                                                                                                                                                           |
| **涉及范围** | 1. 新增 `opencode-memory-plugin/tests/test-code-analyzer.test.js`<br>2. 新增 `opencode-memory-plugin/tests/test-code-analysis-service.test.js`<br>3. 新增 `opencode-memory-plugin/tests/test-code-fingerprint.test.js`<br>4. 新增 `opencode-memory-plugin/tests/test-privacy-filter.test.js`                                                   |
| **前置依赖** | BL-9、BL-10 完成（bug 修复后才能写测试）                                                                                                                                                                                                                                                                                                       |
| **完成标准** | 1. `test-code-analyzer.test.js` 覆盖 Oxc 解析、降级策略、多语言支持<br>2. `test-code-analysis-service.test.js` 覆盖队列管理、批量上传、防抖<br>3. `test-code-fingerprint.test.js` 覆盖指纹计算、变更检测、本地持久化<br>4. `test-privacy-filter.test.js` 覆盖文件排除、敏感模式检测、文件大小验证<br>5. 所有测试通过<br>6. 代码覆盖率报告 >80% |
| **验证方式** | 1. `npm test -- --coverage` 生成覆盖率报告<br>2. 检查 4 个新文件的覆盖率 >80%<br>3. 所有测试通过                                                                                                                                                                                                                                               |
| **状态**     | ✅ 已完成（7 个测试文件已提交：`opencode-memory-plugin/code-analyzer/*.test.ts`）                                                                                                                                                                                                                                                              |

---

### BL-13 [P1] 文件监听器实现

| 项目         | 内容                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 实现 OpenCode 文件保存事件监听，自动触发代码分析                                                                                                                                                      |
| **涉及范围** | 1. `opencode-memory-plugin/plugin.js`（注册事件监听器）<br>2. `opencode-memory-plugin/lib/code-analysis-service.js`（导出 `onFileSaved()`）<br>3. 或新增 `opencode-memory-plugin/lib/file-watcher.js` |
| **前置依赖** | BL-9、BL-10 完成（bug 修复后才能连接监听器）                                                                                                                                                          |
| **完成标准** | 1. 在 OpenCode 中注册 `file.saved` 事件回调<br>2. 文件保存后 300ms 防抖触发分析<br>3. 支持配置排除目录（node_modules、.git 等）<br>4. 分析结果输出到控制台（调试用）<br>5. 支持配置开关（默认开启）   |
| **验证方式** | 1. 在 OpenCode 中编辑一个 JS 文件并保存<br>2. 观察控制台输出分析结果<br>3. 快速连续保存 3 次，观察防抖生效（只触发 1 次）<br>4. 保存 `.env` 文件，观察被隐私过滤器跳过                                |
| **状态**     | ✅ 已完成                                                                                                                                                                                             |

---

### BL-14 [P2] 代码分析用户文档

| 项目         | 内容                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 编写代码分析功能的用户文档，说明功能用途、配置方法、使用场景                                                                                                                                      |
| **涉及范围** | 1. 新增 `opencode-memory-plugin/CODE-ANALYSIS.md`<br>2. 更新 `README.md` 添加代码分析功能说明<br>3. 更新 `CONFIGURATION.md` 添加代码分析配置项                                                    |
| **前置依赖** | BL-12、BL-13 完成（功能完善后才能写文档）                                                                                                                                                         |
| **完成标准** | 1. `CODE-ANALYSIS.md` 包含功能介绍、支持语言、配置项、使用场景<br>2. `README.md` 功能列表中添加代码分析<br>3. `CONFIGURATION.md` 添加 `code_analysis` 配置章节<br>4. 文档中包含示例配置和输出示例 |
| **验证方式** | 1. `npm run lint:md` 通过<br>2. 新用户能根据文档配置代码分析功能<br>3. 文档中无技术实现细节（属于产品文档）                                                                                       |
| **状态**     | ✅ 已完成                                                                                                                                                                                         |

---

### BL-15 [P2] 后端增量同步对接

| 项目         | 内容                                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 对接后端 fingerprint API，实现代码分析结果的增量同步                                                                                                                                                                 |
| **涉及范围** | 1. `opencode-memory-plugin/lib/code-fingerprint.js`（调用后端 API）<br>2. `opencode-memory-plugin/lib/wrapper-client.js`（新增 `syncCodeFingerprints()` 方法）<br>3. 后端 API：`POST /api/v1/sync/code-fingerprints` |
| **前置依赖** | 1. BL-9 完成<br>2. 后端增量同步 API 完成（BL-26）                                                                                                                                                                    |
| **完成标准** | 1. 计算文件指纹（content_hash、symbols_hash）<br>2. 调用后端 fingerprint API 获取差异<br>3. 只上传变更的文件<br>4. 本地指纹持久化到 `.code_fingerprints.json`<br>5. 支持手动触发全量同步                             |
| **验证方式** | 1. 修改文件后只上传变更文件<br>2. 未修改文件不重复上传<br>3. 检查后端记忆条目版本正确更新                                                                                                                            |
| **状态**     | ⏸️ 暂停（等待后端 BL-26 完成）                                                                                                                                                                                       |

---

## 场景七：代码分析功能 — 已完成

> **背景**: 代码分析功能已实现但有严重 bug（`resolveProjectId` 未导入会崩溃，隐私过滤器失效），且零测试覆盖。
>
> **目标**: 修复所有 bug，补充测试，完善功能。
>
> **状态**: ✅ **核心功能已完成**（BL-9, BL-10, BL-11, BL-12, BL-15~BL-22）

---

### BL-17 [P0] 代码分析核心功能实现（新增）

| 项目         | 内容                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**     | 实现代码分析核心功能，包括 AST 分析、批量处理、CLI 工具和测试                                                                                                                                                                                                                  |
| **涉及范围** | 1. `lib/code-analyzer.js`（Oxc AST 分析）<br>2. `lib/code-analysis-service.js`（批量分析队列）<br>3. `cli/code-analyzer.cjs`（CLI 工具）<br>4. `code-analyzer/*.test.ts`（7 个测试文件）<br>5. `lib/code-fingerprint.js`（变更检测）<br>6. `lib/privacy-filter.js`（隐私过滤） |
| **前置依赖** | BL-9、BL-10 完成（bug 修复）                                                                                                                                                                                                                                                   |
| **完成标准** | 1. Oxc 解析器正常工作<br>2. Tree-sitter WASM 降级策略可用<br>3. CLI 工具可独立运行<br>4. 7 个测试文件全部通过<br>5. 代码已提交到 Git                                                                                                                                           |
| **验证方式** | 1. `git log --oneline -1` 包含 "feat: add code analysis feature"<br>2. `ls opencode-memory-plugin/code-analyzer/*.test.ts` 显示 7 个测试文件<br>3. CLI 工具可运行                                                                                                              |
| **状态**     | ✅ 已完成（提交 ID: 9ecd39f）                                                                                                                                                                                                                                                  |

---

## 已移除功能

### BL-16 [P3] memory_list 工具（已移除）

**移除原因**:

经过需求分析，决定不实现 `memory_list` 工具，原因如下：

1. **功能重叠** — 现有工具已覆盖主要使用场景：
   - `memory_timeline` — 按日期浏览记忆
   - `memory_topics` — 按主题浏览记忆
   - `memory_search` — 语义搜索记忆

2. **用户需求不明确** — 没有明确的真实使用场景需要独立的列表工具

3. **保持简洁** — 避免工具数量膨胀，减少维护成本

**替代方案**:

| 原 memory_list 场景 | 替代工具          | 使用方法                                |
| ------------------- | ----------------- | --------------------------------------- |
| 列出所有记忆        | `memory_timeline` | `memory_timeline days=30 level=0`       |
| 按类型过滤          | `memory_search`   | `memory_search query="type:preference"` |
| 快速浏览            | `memory_topics`   | `memory_topics min_entries=1`           |

**决策日期**: 2026-04-02

---

## 场景八：文档质量改进（基于审核报告）

> **背景**: 代码审核和文档审核专家完成全面评估，发现 11 个文档问题需要修复。
>
> **目标**: 修复所有 P0/P1 文档问题，提升文档质量评分从 88→95。
>
> **审核评分**: 代码质量 72/100，文档质量 88/100，综合 80/100

---

### BL-26 [P0] TROUBLESHOOTING.md 架构更新

| 项目         | 内容                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 更新 TROUBLESHOOTING.md 的架构描述，从"直接连接 embedding 服务"改为"后端优先架构"                                                                                                         |
| **涉及范围** | `opencode-memory-plugin/TROUBLESHOOTING.md`（第 12 行先决条件部分）                                                                                                                       |
| **前置依赖** | 无                                                                                                                                                                                        |
| **完成标准** | 1. 先决条件更新为"Backend service running at localhost:17999"<br>2. 添加 BM25 fallback 说明<br>3. 移除"embedding service at localhost:18000"描述<br>4. 添加后端连接问题排查章节           |
| **验证方式** | 1. `grep "localhost:18000" TROUBLESHOOTING.md` 无结果<br>2. `grep "localhost:17999" TROUBLESHOOTING.md` 有结果<br>3. `grep "BM25" TROUBLESHOOTING.md` 有结果<br>4. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成（2026-04-02）                                                                                                                                                                   |

---

### BL-27 [P0] README.npm.md 功能补全

| 项目         | 内容                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 在 README.npm.md 中添加 v2.9 新功能（Code Analysis）和缺失的工具（memory_pin）                                                                                                                     |
| **涉及范围** | `opencode-memory-plugin/README.npm.md`（Features 列表和工具表）                                                                                                                                    |
| **前置依赖** | 无                                                                                                                                                                                                 |
| **完成标准** | 1. Features 列表添加"Code Analysis - Automatic AST analysis on file save"<br>2. 核心工具表添加 `memory_pin` 工具<br>3. 支持语言列表包含 6 种语言（JavaScript, TypeScript, Python, Go, Rust, Java） |
| **验证方式** | 1. `grep "Code Analysis" README.npm.md` 有结果<br>2. `grep "memory_pin" README.npm.md` 有结果<br>3. `npm run lint:md` 通过                                                                         |
| **状态**     | ✅ 已完成（2026-04-02）                                                                                                                                                                            |

---

### BL-28 [P0] CHANGELOG.md 代码分析条目完善

| 项目         | 内容                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 在 CHANGELOG.md v2.9.0 中添加清晰的 Code Analysis 功能条目，与 README 和 BACKLOG 保持一致                                                                                          |
| **涉及范围** | `CHANGELOG.md`（v2.9.0 章节）                                                                                                                                                      |
| **前置依赖** | 无                                                                                                                                                                                 |
| **完成标准** | 1. 新增"✨ Code Analysis Feature"章节<br>2. 列出所有子功能（File Watcher, AST Analysis, Privacy Filter, Batch Upload）<br>3. 列出支持语言<br>4. 列出修改文件清单                   |
| **验证方式** | 1. `grep "Code Analysis Feature" CHANGELOG.md` 有结果<br>2. `grep "File Watcher" CHANGELOG.md` 有结果<br>3. `grep "AST Analysis" CHANGELOG.md` 有结果<br>4. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成                                                                                                                                                                          |

---

### BL-29 [P1] CONFIGURATION.md 版本号统一

| 项目         | 内容                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 统一 CONFIGURATION.md 中所有版本号为 v3.0，移除旧的 v2.0/v2.3 引用                                                                                                                          |
| **涉及范围** | `opencode-memory-plugin/CONFIGURATION.md`（全文）                                                                                                                                           |
| **前置依赖** | 无                                                                                                                                                                                          |
| **完成标准** | 1. 所有 `"version": "2.0"` → `"version": "3.0"`<br>2. 所有 `v2.0` → `v3.0`<br>3. 迁移指南更新为"v1.0 → v2.9.0 → v3.0"<br>4. 无 v2.0/v2.3 残留引用                                           |
| **验证方式** | 1. `grep '"version": "2.0"' CONFIGURATION.md` 无结果<br>2. `grep '"version": "3.0"' CONFIGURATION.md` 有结果<br>3. `grep "v2.0\|v2.3" CONFIGURATION.md` 无结果<br>4. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成                                                                                                                                                                                   |

---

### BL-30 [P1] QUICK_START.md 代码分析入门

| 项目         | 内容                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**     | 在 QUICK_START.md 中添加 Code Analysis 功能的快速入门说明                                                                                                                      |
| **涉及范围** | `opencode-memory-plugin/QUICK_START.md`（新增 Step 6）                                                                                                                         |
| **前置依赖** | 无                                                                                                                                                                             |
| **完成标准** | 1. 新增"Step 6: Explore Code Analysis (Optional)"章节<br>2. 说明自动分析工作原理<br>3. 列出支持的 6 种语言<br>4. 链接到 CODE-ANALYSIS.md                                       |
| **验证方式** | 1. `grep "Step 6" QUICK_START.md` 有结果<br>2. `grep "Code Analysis" QUICK_START.md` 有结果<br>3. `grep "CODE-ANALYSIS.md" QUICK_START.md` 有结果<br>4. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成                                                                                                                                                                      |

---

### BL-31 [P1] EXTERNAL_EMBEDDING.md 代码分析引用

| 项目         | 内容                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**     | 在 EXTERNAL_EMBEDDING.md 中添加 Code Analysis 功能的引用和说明                                                                                               |
| **涉及范围** | `opencode-memory-plugin/EXTERNAL_EMBEDDING.md`（文档末尾新增章节）                                                                                           |
| **前置依赖** | 无                                                                                                                                                           |
| **完成标准** | 1. 新增"Advanced: Code Analysis Integration"章节<br>2. 说明工作原理（文件保存→分析→保存）<br>3. 列出配置示例<br>4. 链接到 CODE-ANALYSIS.md                   |
| **验证方式** | 1. `grep "Code Analysis Integration" EXTERNAL_EMBEDDING.md` 有结果<br>2. `grep "CODE-ANALYSIS.md" EXTERNAL_EMBEDDING.md` 有结果<br>3. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成                                                                                                                                                    |

---

### BL-32 [P2] docs/README.md 模块映射更新

| 项目         | 内容                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**     | 在 docs/README.md 的 lib/核心库模块映射表中添加代码分析相关模块                                                                                                                                        |
| **涉及范围** | `docs/README.md`（lib/核心库表格）                                                                                                                                                                     |
| **前置依赖** | 无                                                                                                                                                                                                     |
| **完成标准** | 1. 添加 `code-analyzer.js` → CodeAnalyzer<br>2. 添加 `code-analysis-service.js` → AnalysisQueue<br>3. 添加 `code-fingerprint.js` → CodeFingerprint<br>4. 添加 `privacy-filter.js` → 敏感内容过滤       |
| **验证方式** | 1. `grep "code-analyzer.js" docs/README.md` 有结果<br>2. `grep "code-analysis-service.js" docs/README.md` 有结果<br>3. `grep "code-fingerprint.js" docs/README.md` 有结果<br>4. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成                                                                                                                                                                                              |

---

### BL-33 [P2] docs/API-CONTRACT.md 代码分析 API

| 项目         | 内容                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 在 docs/API-CONTRACT.md 中添加代码分析相关的 API 映射                                                                                             |
| **涉及范围** | `docs/API-CONTRACT.md`（新增 API 条目）                                                                                                           |
| **前置依赖** | 无                                                                                                                                                |
| **完成标准** | 1. 添加 `uploadCodeAnalysis()` 方法映射<br>2. 说明 HTTP 端点（POST /api/v1/memories/code-analysis）<br>3. 列出参数和返回值<br>4. 标注状态为✅正常 |
| **验证方式** | 1. `grep "uploadCodeAnalysis" docs/API-CONTRACT.md` 有结果<br>2. `grep "code-analysis" docs/API-CONTRACT.md` 有结果<br>3. `npm run lint:md` 通过  |
| **状态**     | ✅ 已完成                                                                                                                                         |

---

### BL-34 [P2] WINDOWS_SETUP.md 内容扩展

| 项目         | 内容                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **目标**     | 扩展 WINDOWS_SETUP.md，添加 Code Analysis 配置说明和性能优化建议                                                                                                                     |
| **涉及范围** | `opencode-memory-plugin/WINDOWS_SETUP.md`（新增 Step 4 和性能优化章节）                                                                                                              |
| **前置依赖** | 无                                                                                                                                                                                   |
| **完成标准** | 1. 新增"Step 4: Configure Code Analysis (Optional)"<br>2. 列出配置示例（JSON 格式）<br>3. 添加性能优化建议<br>4. 链接到 CODE-ANALYSIS.md                                             |
| **验证方式** | 1. `grep "Step 4" WINDOWS_SETUP.md` 有结果<br>2. `grep "code_analysis" WINDOWS_SETUP.md` 有结果<br>3. `grep "CODE-ANALYSIS.md" WINDOWS_SETUP.md` 有结果<br>4. `npm run lint:md` 通过 |
| **状态**     | ✅ 已完成（2026-04-02）                                                                                                                                                              |

---

### BL-35 [P0] 集成测试 422 错误修复

| 项目         | 内容                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 修复 `phase-a-integration.test.js` 中 4 个测试的 422 错误（缺少 abstract/overview 字段）                                                              |
| **涉及范围** | `opencode-memory-plugin/tests/phase-a-integration.test.js`                                                                                            |
| **前置依赖** | 后端 API 契约确认（已完成）                                                                                                                           |
| **完成标准** | 1. 添加 `normalizeMemory()` 兜底函数（第 19 行后）<br>2. 修改 6 处 `memories: [...]` 调用点包裹 `normalizeMemory()`<br>3. 所有 4 个失败的集成测试通过 |
| **验证方式** | 1. `npm test -- phase-a-integration` 全部通过<br>2. 无 422 Unprocessable Entity 错误                                                                  |
| **状态**     | ✅ 已完成（2026-04-03）                                                                                                                               |

---

## 待定功能（已移除）

### BL-16 [P3] memory_list 工具（已移除）

**移除原因**:

经过需求分析，决定不实现 `memory_list` 工具，原因如下：

1. **功能重叠** — 现有工具已覆盖主要使用场景
2. **用户需求不明确** — 没有明确的真实使用场景
3. **保持简洁** — 避免工具数量膨胀，减少维护成本

**替代方案**:

| 原 memory_list 场景 | 替代工具          | 使用方法                                |
| ------------------- | ----------------- | --------------------------------------- |
| 列出所有记忆        | `memory_timeline` | `memory_timeline days=30 level=0`       |
| 按类型过滤          | `memory_search`   | `memory_search query="type:preference"` |
| 快速浏览            | `memory_topics`   | `memory_topics min_entries=1`           |

**决策日期**: 2026-04-02

---

## 阶段 6：文档质量改进（进行中）— 9 个任务

**说明**: 基于代码审核和文档审核专家报告，修复所有 P0/P1/P2 文档问题。

**审核评分**: 代码质量 72/100，文档质量 88/100，综合 80/100  
**目标评分**: 文档质量 95/100

### P0 紧急修复（3 个任务，已完成）

1. **BL-26** — TROUBLESHOOTING.md 架构更新 ✅
2. **BL-27** — README.npm.md 功能补全 ✅
3. **BL-28** — CHANGELOG.md 代码分析条目完善 ✅

### P1 高优先级（3 个任务，已完成）

1. **BL-29** — CONFIGURATION.md 版本号统一 ✅
2. **BL-30** — QUICK_START.md 代码分析入门 ✅
3. **BL-31** — EXTERNAL_EMBEDDING.md 代码分析引用 ✅

### P2 中优先级（3 个任务，已完成）

1. **BL-32** — docs/README.md 模块映射更新 ✅
2. **BL-33** — docs/API-CONTRACT.md 代码分析 API ✅
3. **BL-34** — WINDOWS_SETUP.md 内容扩展 ✅

### 阶段验收

- ✅ 所有 P0 问题修复（3/3）
- ✅ 所有 P1 问题修复（3/3）
- ✅ 所有 P2 问题修复（3/3）
- ✅ `npm run lint:md` 通过（0 errors）
- ✅ 文档质量评分 88→95

---

_最后更新：2026-04-02 01:00_
