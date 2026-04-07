# Backlog

> ⚠️ **创建新任务前必读**：
>
> 1. 检查当前最大编号：`grep "### BL-" BACKLOG.md | tail -1` → **当前最大：BL-CA-16**
> 2. 下一个可用编号：**BL-CA-17**
> 3. 规则：**永不复用、永不跳号**（详见 [`AGENTS.md#backlog-编号规则`](./AGENTS.md)）
> 4. 如编号冲突，使用下一个可用编号（BL-CA-17, BL-CA-18, BL-CA-19...)
>
> 未完成任务。已完成任务归档至 [`backlog_archive.md`](./backlog_archive.md)。
> 已发布版本详见 [`CHANGELOG.md`](./CHANGELOG.md)。

**更新时间**: 2026-04-07 16:00  
**版本**: v2.9.1  
**当前阶段**: 场景九 — 代码分析 v1.4 实施（进行中）

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

## 场景十：代码分析功能 - 4周探索计划（真实使用场景验证）

> **背景**: 20周完整实施计划因"方向不确定、投入过大、风险过高"已调整为4周探索计划。
>
> **目标**: 快速验证代码分析功能的价值，在使用过程中决定下一步。
>
> **核心原则**: 让用户尽快"用起来"，根据实际痛点动态调整。
>
> **当前阶段**: Phase 1 - 深度审计（Week 1）

---

### BL-48 [P0] 场景1 - 文件监听自动触发

| 项目         | 内容                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 实现文件保存后自动触发代码分析，让开发者无需手动操作即可获得实时反馈                                                                                                                                                                                                                                                                                  |
| **涉及范围** | 1. 新建 `lib/file-watcher.js` - 文件监听模块<br>2. 修改 `plugin.js` - 集成文件监听到插件生命周期<br>3. 修改 `lib/code-analysis-service.js` - 确保队列系统与监听联动<br>4. 修改 `CONFIGURATION.md` - 添加配置说明                                                                                                                                      |
| **前置依赖** | BL-47 完成（测试稳定），BL-20 队列系统代码已存在，chokidar 依赖可用                                                                                                                                                                                                                                                                                   |
| **完成标准** | 1. 使用 chokidar 监听项目内 `.js`/`.ts` 文件变化<br>2. 300ms 防抖，快速连续保存只触发一次分析<br>3. 自动排除 `node_modules`、`.git`、隐私文件<br>4. 分析结果输出到控制台，包含文件路径、函数数量、复杂度<br>5. 可通过 `memory-config.json` 中 `code_analysis.auto_trigger: false` 禁用<br>6. 不影响 OpenCode 编辑器性能（CPU<5%，内存<50MB）          |
| **验证方式** | 1. 修改 `src/test.js` 并保存，观察控制台输出 `[CodeAnalysis] Analyzing...`<br>2. 快速连续保存 3 次，验证只输出 1 次分析结果<br>3. 修改 `node_modules/lodash/index.js`，验证不触发分析<br>4. 配置 `auto_trigger: false`，验证保存文件不触发分析<br>5. 运行 `npm test`，验证无回归（18套件全部通过）<br>6. 使用 Activity Monitor/任务管理器观察资源占用 |
| **状态**     | ⏳ 待执行                                                                                                                                                                                                                                                                                                                                             |

**技术方案**:

- 使用 `chokidar` 库（已安装，稳定可靠）
- 监听模式：`chokidar.watch('**/*.{js,ts,mjs,cjs}', { ignored: [...] })`
- 防抖实现：`debounceTimer = setTimeout(() => processQueue(), 300)`
- 复用 `PrivacyFilter.shouldSkipFile()` 排除敏感文件
- 在 `plugin.js` 的 `activate` 钩子中启动监听

---

### BL-CA-11 [P0] 扩展函数元数据字段

| 项目         | 内容                                                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 确保 `FunctionSymbol` 包含 `return_type`、`is_exported`、`is_async` 字段，Oxc 和 Tree-sitter 两条路径输出一致                                                                                                                                                                                                                                 |
| **涉及范围** | 1. `lib/code-analyzer.js`（Oxc 路径）<br>2. `lib/tree-sitter-parser.js`（Tree-sitter 路径）                                                                                                                                                                                                                                                   |
| **前置依赖** | 无                                                                                                                                                                                                                                                                                                                                            |
| **完成标准** | 1. Oxc 路径已输出 `return_type`、`is_exported`、`is_async` ✅<br>2. Tree-sitter 路径补齐 `return_type`（Python type hints, Go 返回值, Rust -> T, Java 返回类型）<br>3. Tree-sitter 路径补齐 `is_exported`（Python 无, Go 大写, Rust pub, Java public）<br>4. Tree-sitter 路径补齐 `is_async`（Python async def, Go goroutine, Rust async fn） |
| **验证方式** | 1. 分析 JS/TS 文件，验证 Oxc 输出包含三个新字段 ✅<br>2. 分析 Python 文件，验证 Tree-sitter 输出包含 `is_async`（async def）<br>3. 分析 Rust 文件，验证 Tree-sitter 输出包含 `is_exported`（pub fn）<br>4. 单元测试覆盖新增字段提取逻辑                                                                                                       |
| **状态**     | ⚠️ 部分完成 — Oxc 路径已实现，Tree-sitter 路径待增强                                                                                                                                                                                                                                                                                          |

**当前实现**:

- ✅ Oxc 路径：`return_type`（line 224）、`is_exported`（line 225）、`is_async`（line 226）
- ❌ Tree-sitter 路径：仅输出 `name`、`line`、`column`、`type`，缺少上述三个字段

---

### BL-CA-12 [P1] 新增调用关系提取（CallSymbol）

| 项目         | 内容                                                                                                                                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 新增 `_extract_calls()` 方法，提取函数调用关系（CallSymbol），支持跨文件引用追踪                                                                                                                                                                                                                |
| **涉及范围** | 1. `lib/code-analyzer.js`（新增 `_extract_calls`）<br>2. `lib/tree-sitter-parser.js`（新增调用提取）<br>3. 分析结果新增 `calls` 字段                                                                                                                                                            |
| **前置依赖** | 无                                                                                                                                                                                                                                                                                              |
| **完成标准** | 1. Oxc 路径：遍历 `CallExpression` 节点，提取 `{ target, line, column }`<br>2. Tree-sitter 路径：遍历 `call_expression` 节点，提取调用关系<br>3. 分析结果包含 `calls: CallSymbol[]` 字段<br>4. 支持过滤内置调用（console.log 等）<br>5. 单元测试覆盖调用提取逻辑<br>6. CLI 输出包含调用关系统计 |
| **验证方式** | 1. 分析包含多函数调用的 JS 文件，验证 `calls` 数组正确<br>2. 分析 Python 文件，验证函数调用提取正确<br>3. 单元测试覆盖 5+ 场景（嵌套调用、方法调用、链式调用等）                                                                                                                                |
| **状态**     | ⏳ 待执行                                                                                                                                                                                                                                                                                       |

**数据模型**（v1.4 设计文档 Section 2.1，已根据后端确认更新）:

```typescript
interface CallSymbol {
  target: string; // 被调用函数名
  file_path: string; // ← 新增必需字段（相对于项目根目录）
  line: number; // 调用所在行
  column?: number; // 调用所在列（可选）
}
```

**后端确认的技术细节**（详见 `docs/BACKEND-ALIGNMENT-v1.4.md`）：

1. **必须包含 `file_path` 字段** - 后端使用复合键 `(project_id, file_path, target)` 解析调用关系
2. **跨文件调用支持** - 通过 `file_path` 支持跨文件调用解析，插件端无需预先查询 target 的 memory_id
3. **错误处理** - 解析失败时后端标记为 `unresolved`，不阻塞上传流程
4. **后端索引** - SurrealDB 将创建 `(project_id, file_path, function_name)` 复合索引

**示例**:

```json
{
  "target": "hashPassword",
  "file_path": "src/utils/crypto.ts",
  "line": 42,
  "column": 10
}
```

---

### BL-CA-13 [P1] 新增类成员提取（methods, properties, interfaces）

| 项目         | 内容                                                                                                                                                                                                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 确保 `ClassSymbol` 包含 `methods`、`properties` 列表，`InterfaceSymbol` 提取完整，Oxc 和 Tree-sitter 两条路径输出一致                                                                                                                                                                                                        |
| **涉及范围** | 1. `lib/code-analyzer.js`（Oxc 路径）<br>2. `lib/tree-sitter-parser.js`（Tree-sitter 路径）                                                                                                                                                                                                                                  |
| **前置依赖** | 无                                                                                                                                                                                                                                                                                                                           |
| **完成标准** | 1. Oxc 路径已输出 `methods`、`properties` ✅<br>2. Oxc 路径已提取 `InterfaceSymbol` ✅<br>3. Tree-sitter 路径补齐 `properties`（Python `self.x`, Go struct fields, Rust struct fields, Java fields）<br>4. Tree-sitter 路径补齐 `InterfaceSymbol`（Go interface, Rust trait, Java interface）<br>5. 单元测试覆盖新增提取逻辑 |
| **验证方式** | 1. 分析 TS 文件，验证 Oxc 输出接口包含 methods 和 properties ✅<br>2. 分析 Python 文件，验证 Tree-sitter 输出类包含 properties（self.xxx）<br>3. 分析 Go 文件，验证 Tree-sitter 输出包含 interface 定义<br>4. 分析 Rust 文件，验证 Tree-sitter 输出包含 trait 和 impl methods                                                |
| **状态**     | ⚠️ 部分完成 — Oxc 路径已实现，Tree-sitter 路径待增强                                                                                                                                                                                                                                                                         |

**当前实现**:

- ✅ Oxc 路径：`ClassSymbol.methods`（line 239）、`ClassSymbol.properties`（line 241）、`InterfaceSymbol`（line 260-280）
- ⚠️ Tree-sitter 路径：Python/Java 类有 `methods` 但无 `properties`；Go/Rust 有 `methods` 但无 `properties`；无 `InterfaceSymbol` 提取

---

### BL-CA-14 [P1] 增强 Python/Go/Rust/Java 解析器

| 项目         | 内容                                                                                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 增强 Tree-sitter 多语言解析器，使输出结构与 Oxc 路径对齐，补齐缺失字段                                                                                                                                                                                                                                                            |
| **涉及范围** | 1. `lib/tree-sitter-parser.js`（4 个语言提取函数增强）<br>2. 分析结果结构对齐（`exports`、`dependencies` 分类）                                                                                                                                                                                                                   |
| **前置依赖** | BL-CA-11、BL-CA-13 完成                                                                                                                                                                                                                                                                                                           |
| **完成标准** | 1. 所有语言输出统一的 `functions`、`classes`、`interfaces`、`imports`、`exports` 结构<br>2. `dependencies` 分类为 `internal`/`external`/`builtin`（当前 Tree-sitter 路径为扁平数组）<br>3. `exports` 正确提取（Python **all**, Go 大写, Rust pub, Java public）<br>4. `ImportSymbol` 包含 `line` 字段<br>5. 单元测试覆盖 4 种语言 |
| **验证方式** | 1. 分析 Python 文件，验证 `dependencies` 正确分类（标准库 → builtin, 第三方 → external, 相对 → internal）<br>2. 分析 Go 文件，验证大写导出正确识别<br>3. 分析 Rust 文件，验证 `pub` 导出正确识别<br>4. 运行 `npm test` 全部通过                                                                                                   |
| **状态**     | ⏳ 待执行（依赖 BL-CA-11、BL-CA-13）                                                                                                                                                                                                                                                                                              |

**当前差距**:

- ❌ `exports` 字段为空数组（简化处理）
- ❌ `dependencies` 为扁平数组（未分类为 internal/external/builtin）
- ❌ `ImportSymbol` 缺少 `imported_names` 字段
- ❌ `InterfaceSymbol` 提取缺失

---

### BL-CA-15 [P0] 实现代码复杂度计算（圈复杂度）

| 项目         | 内容                                                                                                                                                                                                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 确保 Tree-sitter 路径使用 AST 级别的圈复杂度计算，替代当前基于函数名的启发式估算                                                                                                                                                                                                             |
| **涉及范围** | 1. `lib/tree-sitter-parser.js`（`calculateBasicComplexity` 重写）<br>2. 新增 `calculateCyclomaticComplexity` 用于 Tree-sitter AST                                                                                                                                                            |
| **前置依赖** | 无                                                                                                                                                                                                                                                                                           |
| **完成标准** | 1. Oxc 路径圈复杂度已基于 AST 计算 ✅<br>2. Tree-sitter 路径改为 AST 级别圈复杂度计算（if/for/while/try/and/or 计数）<br>3. 补齐 `max_function_complexity` 和 `average_function_complexity` 字段<br>4. 补齐 `max_nesting_depth` 和 `average_nesting_depth` 字段<br>5. 单元测试覆盖复杂度计算 |
| **验证方式** | 1. 分析包含 if/for/while 的 Python 文件，验证复杂度 > 1<br>2. 分析嵌套函数，验证 `max_nesting_depth` 正确<br>3. 对比 Oxc 和 Tree-sitter 对同一 JS 文件的复杂度结果，差异 < 10%<br>4. 运行 `npm test` 全部通过                                                                                |
| **状态**     | ⚠️ 部分完成 — Oxc 路径已实现 AST 级别计算，Tree-sitter 路径使用启发式估算                                                                                                                                                                                                                    |

**当前实现**:

- ✅ Oxc 路径：`calculateCyclomaticComplexity`（line 492-536）基于 AST 遍历 if/for/while/catch/&&/||
- ❌ Tree-sitter 路径：`calculateBasicComplexity`（line 383-410）基于函数名启发式（handle→3, validate→4）

---

### BL-CA-16 [P1] 实现代码质量评分

| 项目         | 内容                                                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **目标**     | 基于复杂度指标实现文件级和项目级代码质量评分，辅助代码审查决策                                                                                                                                                                      |
| **涉及范围** | 1. `lib/project-analyzer.js`（健康度评级已实现）<br>2. `lib/code-analyzer.js`（新增文件级评分）<br>3. CLI 输出包含评分                                                                                                              |
| **前置依赖** | BL-CA-15 完成（准确的复杂度计算是评分基础）                                                                                                                                                                                         |
| **完成标准** | 1. 项目级健康度评级（A/B/C/D）已实现 ✅<br>2. 新增文件级质量评分函数（基于圈复杂度、嵌套深度、函数长度）<br>3. CLI `--format table` 输出包含质量评分列<br>4. 评分标准可配置（通过 `memory-config.json`）<br>5. 单元测试覆盖评分算法 |
| **验证方式** | 1. `code-analyzer file.js --format table`，验证输出包含质量评分列<br>2. `code-analyzer --project .`，验证项目级和文件级评分一致<br>3. 分析已知高复杂度文件，验证评分合理<br>4. 运行 `npm test` 全部通过                             |
| **状态**     | ⚠️ 部分完成 — 项目级健康度评级已实现，文件级评分待实现                                                                                                                                                                              |

**当前实现**:

- ✅ `ProjectAnalyzer.calculateGrade()` — 项目级 A/B/C/D 评级
- ❌ 文件级质量评分函数未实现

---

---

## 场景十一：代码分析 v1.4 真实使用场景实施

> **背景**: 基于后端确认的技术细节（见 docs/BACKEND-ALIGNMENT-v1.4.md），围绕真实使用场景推进代码分析功能。
>
> **目标**: 让开发者在日常工作中真正用起来，解决实际痛点。
>
> **核心场景**:
>
> 1. 开发时实时分析 - 保存文件自动分析，即时反馈复杂度
> 2. 代码审查辅助 - 查看调用关系，了解影响范围
> 3. 重构决策支持 - 查找引用，评估变更影响
> 4. 项目质量监控 - 健康度评级，趋势追踪
> 5. 代码导航增强 - 符号跳转，跨文件搜索

### BL-CA-17 [P0] 场景1 - 文件保存自动触发分析

**目标**: 实现文件保存后自动触发代码分析，让开发者无需手动操作即可获得实时反馈

**涉及范围**:

1. 新建 `lib/file-watcher.js` - 文件监听模块
2. 修改 `plugin.js` - 集成文件监听到插件生命周期
3. 修改 `lib/code-analysis-service.js` - 确保队列系统与监听联动
4. 修改 `CONFIGURATION.md` - 添加配置说明

**前置依赖**: BL-47 完成（测试稳定），BL-20 队列系统代码已存在，chokidar 依赖可用

**完成标准**:

1. 使用 chokidar 监听项目内 `.js`/`.ts` 文件变化
2. 300ms 防抖，快速连续保存只触发一次分析
3. 自动排除 `node_modules`、`.git`、隐私文件
4. 分析结果输出到控制台，包含文件路径、函数数量、复杂度
5. 可通过 `memory-config.json` 中 `code_analysis.auto_trigger: false` 禁用
6. 不影响 OpenCode 编辑器性能（CPU<5%，内存<50MB）

**验证方式**:

1. 修改 `src/test.js` 并保存，观察控制台输出 `[CodeAnalysis] Analyzing...`
2. 快速连续保存 3 次，验证只输出 1 次分析结果
3. 修改 `node_modules/lodash/index.js`，验证不触发分析
4. 配置 `auto_trigger: false`，验证保存文件不触发分析
5. 运行 `npm test`，验证无回归（18套件全部通过）
6. 使用 Activity Monitor/任务管理器观察资源占用

---

### BL-CA-18 [P1] 场景2 - 调用关系提取与可视化

**目标**: 提取函数调用关系（CallSymbol），支持跨文件引用追踪，为代码审查提供调用关系视图

**涉及范围**:

1. `lib/code-analyzer.js` - 新增 `_extract_calls()` 方法（Oxc 路径）
2. `lib/tree-sitter-parser.js` - 新增调用提取（Tree-sitter 路径）
3. 分析结果新增 `calls` 字段，包含 `target`, `file_path`, `line`, `column`
4. `lib/code-analysis-formatter.js` - 新增调用关系可视化输出

**前置依赖**: 无

**完成标准**:

1. Oxc 路径：遍历 `CallExpression` 节点，提取调用关系
2. Tree-sitter 路径：遍历 `call_expression` 节点，提取调用关系
3. `CallSymbol` 包含必需字段：`target`, `file_path`, `line`, `column`
4. 支持过滤内置调用（console.log 等）
5. CLI `--format tree` 输出包含调用关系层级
6. 单元测试覆盖调用提取逻辑（5+ 场景）

**验证方式**:

1. 分析包含多函数调用的 JS 文件，验证 `calls` 数组正确
2. 验证 `file_path` 字段存在且为相对路径
3. 分析 Python 文件，验证函数调用提取正确
4. 运行 `npm test`，验证无回归
5. 检查输出示例符合后端 API 要求

**后端依赖**: BL-CA-20~22（调用关系存储/查询 API）

---

### BL-CA-19 [P1] 场景3 - 重构影响分析

**目标**: 实现查找函数引用功能，支持重构前评估变更影响范围

**涉及范围**:

1. `lib/code-analyzer.js` - 新增 `findReferences()` 方法
2. `cli/code-analyzer.cjs` - 新增 `--find-refs` 选项
3. 调用后端 API `GET /api/v1/memories/{id}/references`
4. 结果格式化输出（表格形式展示引用位置）

**前置依赖**: BL-CA-18 完成（调用关系提取），后端 BL-CA-21 完成（引用查询 API）

**完成标准**:

1. 支持按函数名查找所有引用位置
2. 输出包含：引用文件、行号、调用上下文
3. 支持跨文件引用查找
4. 支持递归查找（查找引用的引用，深度可配置）
5. CLI 输出格式清晰，便于重构决策

**验证方式**:

1. 查找已知函数的引用，验证结果完整
2. 验证跨文件引用正确解析
3. 测试递归查找功能（深度=2）
4. 运行 `npm test`，验证无回归

---

### BL-CA-20 [P1] 场景4 - 项目质量趋势追踪

**目标**: 实现项目代码质量历史追踪，展示质量变化趋势

**涉及范围**:

1. `lib/project-analyzer.js` - 新增 `saveAnalysisSnapshot()` 方法
2. 调用 `memory_write` 保存每次分析结果
3. 新增 `getQualityTrend()` 方法查询历史数据
4. `cli/code-analyzer.cjs` - 新增 `--trend` 选项

**前置依赖**: BL-CA-16 完成（代码质量评分）

**完成标准**:

1. 每次项目分析自动保存质量快照
2. 支持查询最近 N 次分析的质量变化
3. 输出趋势图表（文本形式）
4. 识别质量退化文件（复杂度上升）
5. 支持对比两个时间点的质量差异

**验证方式**:

1. 运行多次项目分析，验证快照保存成功
2. 查询趋势数据，验证历史记录完整
3. 验证质量退化文件识别准确
4. 运行 `npm test`，验证无回归

---

### BL-CA-21 [P2] 场景5 - 符号导航支持

**目标**: 增强代码导航功能，支持跳转到定义和跨文件符号搜索

**涉及范围**:

1. `lib/code-analyzer.js` - 新增 `findSymbolDefinition()` 方法
2. 集成 `memory_search` 查询符号定义
3. `cli/code-analyzer.cjs` - 新增 `--goto` 选项
4. 支持符号类型过滤（函数/类/接口）

**前置依赖**: BL-CA-11 完成（函数元数据补齐），BL-CA-13 完成（类成员提取）

**完成标准**:

1. 支持按符号名查找定义位置
2. 输出包含：文件路径、行号、符号类型
3. 支持符号类型过滤
4. 支持模糊搜索（部分匹配）
5. 结果按相关性排序

**验证方式**:

1. 查找已知符号的定义，验证位置准确
2. 测试模糊搜索功能
3. 验证类型过滤有效
4. 运行 `npm test`，验证无回归

---

## 任务依赖关系

```text
BL-CA-17 (文件监听) ──┐
                     ├──→ 可并行开发
BL-CA-18 (调用关系) ──┼──→ BL-CA-19 (影响分析)
                     │      ↑
BL-CA-11 (元数据) ────┤      │ (依赖后端 API)
                     │      │
BL-CA-13 (类成员) ────┘      │
                             │
BL-CA-16 (质量评分) ────────┼──→ BL-CA-20 (趋势追踪)
                             │
BL-CA-21 (符号导航) ────────┘
```

## 实施优先级

| 优先级 | 任务     | 场景           | 预期收益            |
| ------ | -------- | -------------- | ------------------- |
| P0     | BL-CA-17 | 开发时实时分析 | 高 - 即时反馈       |
| P1     | BL-CA-18 | 代码审查辅助   | 高 - 调用关系可视化 |
| P1     | BL-CA-19 | 重构决策支持   | 高 - 降低重构风险   |
| P1     | BL-CA-20 | 项目质量监控   | 中 - 长期价值       |
| P2     | BL-CA-21 | 代码导航增强   | 中 - 开发效率       |
