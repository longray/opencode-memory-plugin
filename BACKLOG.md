# Backlog

> ⚠️ **创建新任务前必读**：
>
> 1. 检查当前最大编号：`grep "^### BL-" BACKLOG.md | tail -1` → **当前最大：BL-CA-42**
> 2. 下一个可用编号：**BL-CA-43**
> 3. 规则：**永不复用、永不跳号**（详见 [`AGENTS.md#backlog-编号规则`](./AGENTS.md)）
> 4. 如编号冲突，使用下一个可用编号（BL-CA-43, BL-CA-44, BL-CA-45...）
>
> 未完成任务。已完成任务归档至 [`backlog_archive.md`](./backlog_archive.md)。
> 已发布版本详见 [`CHANGELOG.md`](./CHANGELOG.md)。

**更新时间**: 2026-04-10  
**版本**: v2.9.4  
**当前阶段**: 场景十一 — v3.2 架构升级（新建）

---

## 文档分类说明

本项目文档分为三类，分工明确：

| 类别         | 回答       | 受众       | 位置                               |
| ------------ | ---------- | ---------- | ---------------------------------- |
| **产品文档** | 怎么用？   | 用户       | 根目录 + `opencode-memory-plugin/` |
| **开发文档** | 怎么实现？ | 开发者     | `docs/` + 后端 docs                |
| **Backlog**  | 做什么？   | 项目管理者 | 根目录 `BACKLOG.md`                |

---

## 场景四：文档治理 — 消除冗余、归档过时、统一分类

> **背景**: 项目有 55+ 个 md 文件，大量过时文档（v2.3.0 时代）散布在多个位置。产品文档、开发文档、Backlog 混在一起。
>
> **目标**: 建立三类文档分工（产品/开发/Backlog），归档过时文档，修复关键不一致。

---

### BL-8 [P1] 隐式偏好发现端到端验证

**目标**: 完整测试隐式偏好发现→报告→确认→保存的全流程，修复发现的问题

**涉及范围**:

1. `opencode-memory-plugin/agents/memory-automation.md` - Observer prompt 微调
2. `opencode-memory-plugin/agents/` - 主代理 prompt 微调
3. `README.md` - 更新 Observer 使用说明
4. `AGENTS.md` - 更新代理配置文档

**前置依赖**:

- BL-7 完成（隐式偏好发现基础实现）
- memory-automation agent 已配置

**完成标准**:

1. 全流程跑通：对话行为→Observer 分析→主代理确认→用户确认→memory_write 成功
2. Observer 输出中包含"需要确认"的隐式发现区块（至少识别出1个潜在偏好）
3. 主代理向用户确认："观察到你在第 N 轮遇到 XX 问题，是否需要保存这个记忆？"
4. 用户确认后，记忆成功保存到 timeline
5. 保存的记忆包含完整的 abstract/overview/content 三层结构
6. 误报率 < 20%（5次测试中出现1次误报可接受）

**验证方式**:

1. 设计测试对话场景：用户写代码→被 lint 检出→默默删除→再次提交
2. 运行 Observer 分析测试对话，检查输出是否包含隐式发现区块
3. 验证主代理是否正确引用 Observer 的发现并询问用户
4. 用户确认后，使用 `memory_read` 验证记忆已保存
5. 检查记忆内容是否包含：类型=preference、标签包含代码风格、abstract≤100字符
6. 运行5次不同场景的测试，统计识别准确率和误报率

**状态**: ⏳ 下一步执行

---

### BL-15 [P2] 后端增量同步对接

**目标**: 对接后端 fingerprint API，实现代码分析结果的增量同步，避免重复上传未变更文件

**涉及范围**:

1. `opencode-memory-plugin/lib/code-fingerprint.js` - 新增/修改指纹计算逻辑
2. `opencode-memory-plugin/lib/wrapper-client.js` - 新增 `syncCodeFingerprints()` 方法
3. `opencode-memory-plugin/lib/code-analysis-service.js` - 集成指纹检查到分析流程
4. 后端 API 对接：`POST /api/v1/sync/code-fingerprints`

**前置依赖**:

- BL-9 完成（代码分析基础功能）
- 后端 BL-26 完成（增量同步 API）
- code-fingerprint.js 基础实现已存在

**完成标准**:

1. 计算文件指纹（content_hash: SHA256、symbols_hash: 函数名+参数哈希）
2. 调用后端 fingerprint API 获取需要更新的文件列表
3. 只上传后端返回的变更文件，未变更文件跳过上传
4. 本地指纹持久化到 `.code_fingerprints.json`（项目根目录）
5. 支持手动触发全量同步（绕过指纹检查）
6. 同步完成后更新本地指纹缓存
7. 错误处理：后端 API 失败时回退到全量上传

**验证方式**:

1. 首次分析项目，验证所有文件上传成功，指纹文件生成
2. 修改单个文件，再次分析，验证只上传修改的文件（通过日志或网络监控）
3. 验证未修改文件未产生上传请求（检查 network 日志）
4. 删除 `.code_fingerprints.json`，验证全量同步触发
5. 模拟后端 API 失败，验证回退到全量上传
6. 检查指纹文件格式：JSON，包含文件路径→{content_hash, symbols_hash, last_sync}
7. 运行 `npm test`，验证无回归

**状态**: ⏸️ 暂停（等待后端 BL-26 完成）

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

**状态**: ✅ **已完成** (2026-04-08)

**完成验证**:

1. ✅ `lib/file-watcher.js` - FileWatcher 类完整实现（125行）
2. ✅ `plugin.js` - 已集成文件监听（支持 OpenCode 事件和文件系统 fallback）
3. ✅ `lib/code-analysis-service.js` - AnalysisQueue 实现，包含 `onFileSaved` 回调
4. ✅ `CONFIGURATION.md` - 已添加完整的 `code_analysis` 配置说明

**实现特性**:

- ✅ 300ms 防抖（debounce）
- ✅ 自动排除 node_modules、.git、dist 等目录
- ✅ 支持通过 `code_analysis.auto_trigger: false` 禁用
- ✅ 隐私文件过滤（复用 PrivacyFilter）
- ✅ 批量上传队列（batch upload）

**测试结果**: `npm test` 19套件全部通过，146测试通过，无回归

---

### BL-CA-11 [P0] 函数元数据补齐 ⚠️ 部分完成 - JS/TS 完成，多语言待完善

**目标**: 补齐函数元数据字段，支持更丰富的代码分析结果

**涉及范围**:

1. ✅ `lib/code-analyzer.js`（JS/TS 元数据提取 - Oxc 路径已完成）
2. ⚠️ `lib/tree-sitter-parser.js`（多语言元数据提取 - **部分完成**）
3. ✅ 输出格式包含 `return_type`, `is_exported`, `is_async` 字段

**前置依赖**: 无（JS/TS 路径独立实现）；多语言路径依赖 Tree-sitter parser 基础功能可用

**完成标准**:

1. ✅ JS/TS 函数提取 `name`, `line`, `column`, `type`, `params`
2. ✅ JS/TS 函数提取 `return_type`（通过 AST 分析）
3. ✅ JS/TS 函数提取 `is_exported`（通过 export 关键词）
4. ✅ JS/TS 函数提取 `is_async`（通过 async 关键词）
5. ⚠️ 多语言（Python/Go/Rust/Java）元数据提取 - **部分完成**

**验证方式**:

1. ✅ 分析 JS 文件，验证元数据字段完整
2. ⚠️ 分析 Python 文件，验证 return_type 等字段
3. ✅ 运行 `npm test`，验证无回归

**已知问题**:

| 问题                    | 严重程度 | 影响                               | 修复方案                                 |
| ----------------------- | -------- | ---------------------------------- | ---------------------------------------- |
| 多语言 return_type 缺失 | 🔴 P0    | Python/Go/Rust/Java 文件无返回类型 | 在 Tree-sitter parser 中添加返回类型分析 |

---

### BL-CA-12 [P1] 函数元数据补齐 - 多语言支持

**目标**: 补齐 Python/Go/Rust/Java 函数的元数据字段

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 新增多语言函数元数据提取
2. 返回类型分析（Python `-> Type`, Go `func() Type`, Rust `-> Type`, Java `@return`）
3. 导出函数识别（Python `__all__`, Go `func` vs `func`, Rust `pub fn`, Java `public`）

**前置依赖**: BL-CA-11 完成（基础元数据提取）

**完成标准**:

1. Python 函数提取 return_type, is_exported
2. Go 函数提取 return_type, is_exported
3. Rust 函数提取 return_type, is_exported
4. Java 方法提取 return_type, is_exported
5. CLI 输出包含完整元数据

**验证方式**:

1. 分析 Python/Go/Rust/Java 文件，验证元数据完整
2. 运行 `npm test`，验证无回归

**状态**: ⏳ 待执行

---

### BL-CA-13 [P1] 类成员提取 ⚠️ 部分完成 - JS/TS 完成，多语言待添加

**目标**: 提取类成员（方法、属性、接口），完善面向对象代码分析

**涉及范围**:

1. ✅ `lib/code-analyzer.js`（JS/TS 类成员提取 - Oxc 路径已完成）
2. ⚠️ `lib/tree-sitter-parser.js`（多语言类成员提取 - **待添加**）
3. ✅ 输出格式包含 `methods`, `properties` 字段

**前置依赖**: BL-CA-11 完成（基础元数据提取框架），Tree-sitter parser 基础功能可用

**完成标准**:

1. ✅ JS/TS 类提取 `methods` 数组
2. ✅ JS/TS 类提取 `properties` 数组
3. ⚠️ 多语言（Python/Go/Rust/Java）类成员提取 - **待添加**

**验证方式**:

1. ✅ 分析 JS 类文件，验证成员完整
2. ⚠️ 分析 Python/Go/Rust/Java 类文件，验证成员提取
3. ✅ 运行 `npm test`，验证无回归

**已知问题**:

| 问题                 | 严重程度 | 影响                             | 修复方案                               |
| -------------------- | -------- | -------------------------------- | -------------------------------------- |
| 多语言类成员提取缺失 | 🔴 P0    | Python/Go/Rust/Java 不显示类成员 | 在 Tree-sitter parser 中添加类成员提取 |

---

### BL-CA-14 [P1] 接口/特性提取 - Go/Rust/Java 支持

**目标**: 提取接口（Go interface, Rust trait, Java interface）支持面向对象设计分析

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 新增接口提取
2. Go interface 提取（方法签名列表）
3. Rust trait 提取（方法签名列表）
4. Java interface 提取（方法签名列表）

**前置依赖**: BL-CA-13 完成（类成员提取）

**完成标准**:

1. Go interface 提取完整
2. Rust trait 提取完整
3. Java interface 提取完整
4. CLI 输出包含接口定义

**验证方式**:

1. 分析 Go/Rust/Java 接口文件，验证提取完整
2. 运行 `npm test`，验证无回归

**状态**: ⏳ 待执行

---

### BL-CA-15 [P0] AST 圈复杂度计算 ⚠️ 部分完成 - JS/TS 完成，多语言估算

**目标**: 实现基于 AST 的精确圈复杂度计算

**涉及范围**:

1. ✅ `lib/code-analyzer.js`（JS/TS 复杂度计算 - Oxc 路径已完成）
2. ⚠️ `lib/tree-sitter-parser.js`（多语言复杂度计算 - **启发式估算**）

**前置依赖**: 无（Oxc 路径独立实现）；多语言路径依赖 Tree-sitter parser 基础功能可用

**完成标准**:

1. ✅ JS/TS 圈复杂度基于 AST 精确计算
2. ⚠️ 多语言圈复杂度使用启发式估算（非 AST 级别）

**验证方式**:

1. ✅ 分析 JS 文件，验证复杂度精确
2. ⚠️ 分析 Python 文件，验证复杂度为估算值
3. ✅ 运行 `npm test`，验证无回归

**已知问题**:

| 问题                   | 严重程度 | 影响                             | 修复方案                  |
| ---------------------- | -------- | -------------------------------- | ------------------------- |
| 多语言圈复杂度为估算值 | 🟡 P1    | Python/Go/Rust/Java 复杂度不精确 | 实现 AST 级别的复杂度计算 |

---

### BL-CA-16 [P1] 实现代码质量评分 ⚠️ 部分完成 - Oxc 路径完成，Tree-sitter 路径缺失

**目标**: 基于复杂度指标实现文件级和项目级代码质量评分，辅助代码审查决策

**涉及范围**:

1. ✅ `lib/project-analyzer.js`（健康度评级已实现）
2. ⚠️ `lib/code-analyzer.js`（文件级评分 - **Oxc 路径完成，Tree-sitter 路径缺失**）
3. ✅ `lib/code-analysis-formatter.js`（表格输出包含质量评分列）

**前置依赖**: BL-CA-15 完成（准确的复杂度计算是评分基础）

**完成标准**:

1. ✅ 项目级健康度评级（A/B/C/D）已实现
2. ⚠️ 文件级质量评分函数 - **Oxc 路径完成，Tree-sitter 路径缺失**
3. ✅ CLI `--format table` 输出包含质量评分列
4. ✅ 评分标准可配置（通过 `memory-config.json`）
5. ✅ 评分与项目级健康度评级一致（同一项目内）
6. ✅ 提供评分改进建议（如"函数过长，建议拆分"）

**验证方式**:

1. ✅ 分析简单文件（短函数、低复杂度），验证评分 ≥ A（Oxc 路径）
2. ⚠️ 分析复杂文件（长函数、高嵌套），验证评分 ≤ C（**Tree-sitter 路径不显示评分**）
3. ✅ 运行 CLI `--format table`，验证输出包含"质量"列（Oxc 路径）
4. ✅ 修改 `memory-config.json` 评分阈值，验证新配置生效
5. ✅ 对比同一项目的文件评分和项目级评级，验证一致性（Oxc 路径）
6. ✅ 验证评分改进建议准确（如长函数提示拆分）

**已知问题**:

| 问题                                 | 严重程度 | 影响                                   | 修复方案                                                               |
| ------------------------------------ | -------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Tree-sitter 路径缺失 `quality_score` | 🔴 P0    | Python/Go/Rust/Java 文件不显示质量评分 | 在 `analyzeWithTreeSitter()` 中添加 `calculateFileQualityScore()` 调用 |

**实现状态**:

- ✅ **Oxc 路径** (`analyzeWithOxc()` line 203):
  - 调用 `calculateFileQualityScore()` 计算评分
  - 返回完整的 `quality_score` 对象

- ❌ **Tree-sitter 路径** (`analyzeWithTreeSitter()` line 82):
  - **未调用** `calculateFileQualityScore()`
  - 返回结果中 `quality_score` 为 `undefined`
  - Formatter 中 `result.result.quality_score` 为 `undefined`，不显示质量评分

**评分示例**（Oxc 路径）:

```javascript
{
  score: 85,
  grade: 'B',
  issues: ['存在高复杂度函数', '嵌套深度偏大'],
  recommendations: ['重构高复杂度函数，提取逻辑到独立函数', '减少嵌套层级，使用提前返回']
}
```

**测试结果**: 18套件通过，138测试通过（集成测试因后端不可用失败，属预期行为）

---

### BL-CA-17 [P0] 场景1 - 文件保存自动触发分析 ⚠️ 部分完成 - JS/TS 支持完成，多语言支持待添加

**目标**: 实现文件保存后自动触发代码分析，让开发者无需手动操作即可获得实时反馈

**涉及范围**:

1. ✅ `lib/file-watcher.js` - 文件监听模块（FileWatcher类，125行）
2. ✅ `plugin.js` - 集成文件监听到插件生命周期（line 15-62）
3. ✅ `lib/code-analysis-service.js` - 队列系统与监听联动（line 246-249）
4. ✅ `CONFIGURATION.md` - 添加配置说明（line 248, 256）

**前置依赖**: BL-47 完成（测试稳定），BL-20 队列系统代码已存在，chokidar 依赖可用

**完成标准**:

1. ✅ 使用 chokidar 监听项目内 `.js`/`.ts` 文件变化（`lib/file-watcher.js` line 25-40）
2. ✅ 300ms 防抖，快速连续保存只触发一次分析（`lib/file-watcher.js` line 9, 67-73）
3. ✅ 自动排除 `node_modules`、`.git`、隐私文件（`lib/file-watcher.js` line 26-33, 60-63）
4. ✅ 分析结果输出到控制台，包含文件路径、函数数量、复杂度（`lib/code-analysis-service.js` line 247）
5. ✅ 可通过 `memory-config.json` 中 `code_analysis.auto_trigger: false` 禁用（`plugin.js` line 45, 60-62）
6. ✅ 不影响 OpenCode 编辑器性能（CPU<5%，内存<50MB）

**验证方式**:

1. ✅ 修改 `src/test.js` 并保存，观察控制台输出 `[CodeAnalysis] Analyzing...`
2. ✅ 快速连续保存 3 次，验证只输出 1 次分析结果
3. ✅ 修改 `node_modules/lodash/index.js`，验证不触发分析
4. ✅ 配置 `auto_trigger: false`，验证保存文件不触发分析
5. ✅ 运行 `npm test`，验证无回归（19套件全部通过）
6. ✅ 使用 Activity Monitor/任务管理器观察资源占用

**实现细节**:

**FileWatcher类** (`lib/file-watcher.js`):

- 使用chokidar监听`/**/*.{js,ts,mjs,cjs,mts,cts,tsx}`模式
- 自动排除：`node_modules`, `.git`, `dist`, `build`, `.opencode`, `coverage`
- 防抖处理：300ms debounce，使用`pendingFiles`集合收集变更文件
- 隐私过滤：集成`shouldSkipFile()`排除敏感文件
- 支持`change`和`add`事件

**Plugin集成** (`plugin.js`):

- 检查`code_analysis.auto_trigger`配置（默认true）
- 优先使用OpenCode事件监听：`ctx.on('file.saved', ...)`
- Fallback到文件系统监听：`startFileWatcher(projectRoot)`
- 禁用时可使用CLI工具手动分析

**队列系统联动** (`lib/code-analysis-service.js`):

- `onFileSaved()`函数接收文件路径和项目根目录
- 调用`analysisQueue.add()`将文件加入分析队列
- 队列系统自动处理批量上传和防抖

**测试结果**: `npm test` 19套件全部通过，146测试通过，无回归

**已知限制**:

| 限制              | 说明                                                            | 影响                                       | 修复方案                                     |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------- |
| 仅支持 JS/TS 文件 | `file-watcher.js` 监听模式为 `**/*.{js,ts,mjs,cjs,mts,cts,tsx}` | Python/Go/Rust/Java 文件保存不触发自动分析 | 添加 `.py`, `.go`, `.rs`, `.java` 到监听模式 |

**注意**: BL-CA-17 声称"文件保存自动触发分析"已完成，但实际仅对 JS/TS 生效。多语言支持需后续完善。

---

### BL-CA-18 [P1] 场景2 - 调用关系提取与可视化 ✅ 已完成

**目标**: 提取函数调用关系（CallSymbol），支持跨文件引用追踪，为代码审查提供调用关系视图

**涉及范围**:

1. ✅ `lib/code-analyzer.js` - 新增 `extractCallsFromOxcAst()` 方法（Oxc 路径）
2. ✅ `lib/tree-sitter-parser.js` - 新增 `extractCalls()` 及 4 语言调用提取（Tree-sitter 路径）
3. ✅ 分析结果新增 `calls` 字段，包含 `target`, `file_path`, `line`, `column`
4. ✅ `lib/code-analysis-formatter.js` - 新增调用关系可视化输出（表格 + 树形）

**前置依赖**: 无

**完成标准**:

1. ✅ Oxc 路径：遍历 `CallExpression` 节点，提取调用关系
2. ✅ Tree-sitter 路径：遍历 `call_expression` 节点，提取调用关系（Python/Go/Rust/Java）
3. ✅ `CallSymbol` 包含必需字段：`target`, `file_path`, `line`, `column`
4. ✅ 支持过滤内置调用（console.log 等）
5. ✅ CLI `--format tree` 输出包含调用关系层级
6. ✅ 所有测试通过（18 套件，140 测试）

**验证方式**:

1. ✅ 分析包含多函数调用的 JS 文件，验证 `calls` 数组正确
2. ✅ 验证 `file_path` 字段存在且为相对路径
3. ✅ 分析 Python 文件，验证函数调用提取正确
4. ✅ 运行 `npm test`，验证无回归
5. ✅ 检查输出示例符合后端 API 要求

**后端依赖**: BL-CA-20~22（调用关系存储/查询 API）- 后端 2026-04-11 完成

**实现细节**:

- Oxc 路径：支持直接调用 `func()` 和成员调用 `obj.method()`
- Tree-sitter 路径：支持 Python/Go/Rust/Java 4 种语言
- 内置调用过滤：console.log, fmt.Println, print 等
- 行号/列号计算：基于 AST 节点位置

**提交记录**: 未提交（本地改动保留）

---

### BL-CA-19 [P1] 场景3 - 重构影响分析 ⚠️ 待开发 - 依赖后端 API

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

---

## 场景十二：Agent-Native Backlog API 实施

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
>
> **实施阶段**: Phase 1-5（5-8天）
>
> **状态**: ⏸️ **已取消** - 需要重新综合设计方案
>
> **取消原因**: 设计方案需要重新评估，暂停实施

---

### ~~BL-CA-22 [P0] Agent-Native Backlog API - Phase 1: 基础框架~~ ⏸️ 已取消

**目标**: ~~实现 Backlog 管理的基础框架，支持创建和查询 backlog 条目~~

**状态**: ⏸️ **已取消** - 需要重新综合设计方案

**取消说明**:

- 原设计方案需要重新评估
- 已删除相关代码文件（backlog-api.js, backlog.js）
- 后续将基于新的设计方案重新规划

---

### ~~BL-CA-23 [P1] Agent-Native Backlog API - Phase 2: 依赖管理~~ ⏸️ 已取消

**状态**: ⏸️ **已取消** - 依赖 BL-CA-22，随主任务取消

---

### ~~BL-CA-24 [P1] Agent-Native Backlog API - Phase 3: 优先级与排序~~ ⏸️ 已取消

**状态**: ⏸️ **已取消** - 依赖 BL-CA-22，随主任务取消

---

### ~~BL-CA-25 [P2] Agent-Native Backlog API - Phase 4: 统计与报告~~ ⏸️ 已取消

**状态**: ⏸️ **已取消** - 依赖 BL-CA-22，随主任务取消

---

### ~~BL-CA-26 [P2] Agent-Native Backlog API - Phase 5: 集成与优化~~ ⏸️ 已取消

**状态**: ⏸️ **已取消** - 依赖 BL-CA-22，随主任务取消

---

## 场景十一：代码分析完善 - Tree-sitter 增强与测试覆盖

> **背景**: 代码分析 v3.0 核心功能已完成，但 Tree-sitter 路径存在多个 bug，测试覆盖不足。
>
> **目标**: 修复 Tree-sitter 已知问题，补充测试覆盖。

---

### BL-CA-27 [P0] Tree-sitter binary_expression 复杂度 bug 修复

**目标**: 修复 Tree-sitter 解析器对二元表达式（binary_expression）的复杂度计算 bug

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 修复 `binary_expression` 节点处理
2. 确保 `+`, `-`, `*`, `/`, `==`, `!=` 等操作符正确计数
3. 验证嵌套二元表达式的复杂度累积

**前置依赖**: 无（独立 bug 修复，不依赖其他任务）

**问题描述**:

- 当前 `binary_expression` 可能未被正确计数
- 导致包含复杂条件表达式的函数复杂度被低估

**完成标准**:

1. 修复 `binary_expression` 节点识别
2. 验证 `a + b * c` 类表达式复杂度正确
3. 验证嵌套条件 `if (a && b || c)` 复杂度正确
4. 运行 `npm test`，验证无回归

**验证方式**:

1. 分析包含复杂二元表达式的 Python/Go/Rust/Java 文件
2. 验证复杂度与手工计算一致

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 已移除 `binary_expression` 从决策类型列表（line 790）
- 验证 `a + b * c` 类表达式不再增加复杂度
- 验证 `if (a && b || c)` 条件复杂度计算正确
- 所有测试通过（19 suites, 146 passed）

---

### BL-CA-28 [P0] Tree-sitter quality_score 缺失修复

**目标**: 修复 Tree-sitter 路径缺失 `quality_score` 的问题

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 新增 `calculateFileQualityScore()` 调用
2. 确保返回结果中包含 `quality_score` 对象

**前置依赖**: 无（独立 bug 修复），但建议在 BL-CA-15 之后执行（复杂度计算是评分基础）

**问题描述**:

- CODE-ANALYSIS.md:254 记录：Tree-sitter 路径未调用 `calculateFileQualityScore()`
- 导致 Python/Go/Rust/Java 文件不显示质量评分

**完成标准**:

1. 在 `analyzeWithTreeSitter()` 中添加 `calculateFileQualityScore()` 调用
2. 验证输出包含 `quality_score` 对象
3. 验证 CLI 表格输出包含质量评分列（多语言）

**验证方式**:

1. 分析 Python/Go/Rust/Java 文件
2. 验证输出包含 `quality_score.score` 和 `quality_score.grade`
3. 运行 `npm test`，验证无回归

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 已添加 `calculateFileQualityScore()` 函数（约 90 行）
- 在 `analyzeWithTreeSitter()` 中调用并返回 `quality_score` 对象
- 包含 score、grade、issues、recommendations 字段
- 所有测试通过（19 suites, 146 passed）

---

### BL-CA-29 [P0] File watcher 多语言扩展名支持

**目标**: 扩展文件监听器支持多语言文件（Python/Go/Rust/Java）

**涉及范围**:

1. `lib/file-watcher.js` - 扩展监听文件模式
2. 添加 `.py`, `.go`, `.rs`, `.java` 到监听列表

**前置依赖**: BL-CA-17 完成（文件监听基础模块已实现），Tree-sitter 多语言解析器可用

**问题描述**:

- CODE-ANALYSIS.md:339 记录：仅支持 JS/TS 文件
- 导致多语言文件保存不触发自动分析

**完成标准**:

1. 扩展监听模式为 `**/*.{js,ts,mjs,cjs,mts,cts,tsx,py,go,rs,java}`
2. 验证保存 Python/Go/Rust/Java 文件触发分析
3. 保持 300ms 防抖机制正常
4. 保持自动排除 node_modules 等目录

**验证方式**:

1. 修改 `.py` 文件并保存，验证触发分析
2. 修改 `.go` 文件并保存，验证触发分析
3. 验证 node_modules 内文件不触发

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 已扩展监听模式为 `**/*.{js,ts,mjs,cjs,mts,cts,tsx,py,go,rs,java}`
- 添加 `.py`, `.go`, `.rs`, `.java` 扩展名支持
- 保持 300ms 防抖和自动排除机制
- 所有测试通过（19 suites, 146 passed）

---

### BL-CA-30 [P1] Tree-sitter exports 硬编码空数组修复

**目标**: 修复 Tree-sitter 解析器 exports 字段硬编码为空数组的问题

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 修复 `exports` 字段提取
2. 确保正确识别各语言的导出函数/类

**前置依赖**: 无（独立 bug 修复），建议在 BL-CA-12 之后执行（多语言元数据框架）

**问题描述**:

- 当前 Tree-sitter 解析器可能将 `exports` 硬编码为空数组
- 导致导出函数信息丢失

**完成标准**:

1. 修复 Python `__all__` 提取（如果存在）
2. 修复 Go 导出函数识别（首字母大写）
3. 修复 Rust `pub fn` 识别
4. 修复 Java `public` 方法识别
5. 验证 exports 数组正确填充

**验证方式**:

1. 分析包含导出函数的文件
2. 验证 exports 数组非空且正确

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 已修改 `analyzeWithTreeSitter()` 函数，添加 `exports` 数组收集
- 已实现 Python 导出识别（模块级函数和类）
- 已实现 Go 导出识别（首字母大写的函数、方法、接口、struct）
- 已实现 Rust 导出识别（顶层函数、struct、trait）
- 已实现 Java 导出识别（public 方法、类、接口）
- 各语言提取函数已更新，将导出符号添加到 exports 数组
- 返回结果现在包含正确的 exports 数组（不再是硬编码空数组）
- 所有测试通过（19 suites, 146 passed）

---

### BL-CA-31 [P1] Tree-sitter dependencies 分类

**目标**: 实现依赖分类（internal/external/builtin）而非扁平数组

**涉及范围**:

1. `lib/tree-sitter-parser.js` - 新增依赖分类逻辑
2. Python: 内置（built-in）vs 外部（pip 包）
3. Go: 内置（fmt, context）vs 外部（第三方）
4. Rust: 内置（std）vs 外部（cargo 包）
5. Java: 内置（java.lang）vs 外部（Maven/Gradle）

**前置依赖**: 无（独立功能），建议在 BL-CA-11 之后执行（依赖提取框架已就绪）

**完成标准**:

1. dependencies 字段从扁平数组改为分类对象
2. 输出格式：`{ internal: [], external: [], builtin: [] }`
3. 正确区分内置模块和外部模块

**验证方式**:

1. 分析包含多种依赖的文件
2. 验证依赖正确分类

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 已添加 `BUILTIN_MODULES` 常量定义（Python/Go/Rust/Java 内置模块列表）
- 已实现 `classifyDependencies()` 函数，支持：
  - 内置模块识别（对比 BUILTIN_MODULES 列表）
  - Internal 依赖识别（相对路径或包含 `/` 的路径）
  - External 依赖识别（其他情况）
- 已修改 `analyzeWithTreeSitter()` 返回格式：
  - 从 `dependencies: imports.map(imp => imp.source)`（扁平数组）
  - 改为 `dependencies: { builtin: [], internal: [], external: [] }`（分类对象）
- 支持版本号移除（如 `package@1.0.0` → `package`）
- 所有测试通过（19 suites, 146 passed）

---

### BL-CA-32 [P2] 代码分析单元测试覆盖

**目标**: 为 2,686 行核心代码补充单元测试覆盖

**涉及范围**:

1. `lib/code-analyzer.js` - 代码分析核心逻辑
2. `lib/tree-sitter-parser.js` - 多语言解析器
3. `lib/project-analyzer.js` - 项目分析器
4. `lib/code-analysis-service.js` - 队列服务

**前置依赖**: 建议在其他 bug 修复任务（BL-CA-27/28/29/30/31）之后执行，测试覆盖应包含修复后的行为

**当前状态**:

- 现有测试：18 套件，138 测试通过
- 核心代码行数：2,686 行
- 测试覆盖：约 50%（估算）

**完成标准**:

1. 新增代码分析模块测试（code-analyzer.test.js）
2. 新增多语言解析器测试（tree-sitter-parser.test.js）
3. 新增项目分析器测试（project-analyzer.test.js）
4. 测试覆盖率达到 70% 以上
5. 所有新增测试通过

**验证方式**:

1. 运行 `npm test` - 所有测试通过
2. 生成覆盖率报告 - 确认 70% 以上覆盖
3. 新增测试文件在 tests/ 目录

**状态**: ✅ **部分完成** (2026-04-09)

**完成说明**:

- 已创建 `tests/test-code-analysis.test.js` 测试文件（25 个测试）
- 已添加 CodeAnalyzer 测试（质量评分计算、等级生成）
- 已添加 Tree-sitter Parser 测试（函数导出检查）
- 已添加 ProjectAnalyzer 测试（类实例化、方法检查）
- 已添加 AnalysisQueue 测试（类实例化、方法检查）
- 已添加 PrivacyFilter 测试（敏感文件跳过、常规文件通过）
- 已添加代码分析集成测试（JS 文件分析、复杂度计算）
- 当前测试覆盖：20 个套件，171 个测试通过（原有 146 + 新增 25）
- 所有测试通过

**待补充**:

- Tree-sitter 多语言解析器详细测试（Python/Go/Rust/Java）
- 项目分析器完整功能测试
- 代码分析服务队列处理测试
- 覆盖率报告生成（目标 70%）

---

### BL-CA-33 [P0] 实现 memory_id 缓存机制

**目标**: 建立文件路径到 memory_id 的映射缓存，支持后端调用关系 API 集成

**背景**: 后端 `POST /api/v1/calls/batch` API 要求使用 `caller_memory_id` 和 `callee_memory_id` 而非文件路径。前端需要维护本地缓存来存储这个映射关系。

**涉及范围**:

1. **产品文档更新**:
   - `opencode-memory-plugin/CODE-ANALYSIS.md` - 添加调用关系功能说明
   - `opencode-memory-plugin/CONFIGURATION.md` - 添加缓存配置选项

2. **开发文档更新**:
   - `docs/API-CONTRACT.md` - 更新后端 API 映射（calls/batch, references, dependencies）
   - `docs/CODE-ANALYSIS-DESIGN-v1.4.md` - 添加 memory_id 缓存设计

3. **核心实现**:
   - `lib/memory-id-cache.js` - 新建：memory_id 缓存管理模块
   - `lib/code-analysis-service.js` - 修改：集成缓存到上传流程
   - `lib/wrapper-client.js` - 修改：添加调用关系 API 方法

**前置依赖**: BL-CA-27~31 完成（代码分析基础功能已就绪）

**完成标准**:

1. 实现 `MemoryIdCache` 类：
   - `set(filePath, memoryId)` - 保存映射
   - `get(filePath)` - 查询 memory_id
   - `load()` / `save()` - 持久化到本地文件
   - `clear()` - 清空缓存

2. 修改代码上传流程：
   - 上传代码分析结果后保存返回的 memory_id
   - 支持批量上传后批量获取 memory_id

3. 实现调用关系 API：
   - `createCallRelations(calls)` - 批量创建调用关系
   - `getCallReferences(memoryId)` - 查询谁调用了我
   - `getCallDependencies(memoryId)` - 查询我调用了谁

4. 集成到代码分析服务：
   - 分析代码后自动上传调用关系
   - 使用缓存的 memory_id 创建关系

**验证方式**:

1. 单元测试：MemoryIdCache 类的所有方法
2. 集成测试：完整流程（分析 → 上传 → 缓存 → 创建调用关系）
3. 手动验证：查询 references 和 dependencies API

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 实现 `MemoryIdCache` 类：支持 file_path → source_id → memory_id 三层映射
- 实现缓存持久化：支持本地 JSON 存储、导出/导入功能
- 实现缓存重建：支持从本地 entry 文件和后端 Lookup API 重建
- 修改上传流程：生成 source_id，保存 file_path 到 metadata，缓存 memory_id
- 集成后端 API：实现 `lookupMemory`, `createCallRelations`, `getCallReferences`, `getCallDependencies`, `getProjectStats`
- 验证通过：完成端到端集成测试，覆盖分析→上传→缓存→查询全流程

---

### BL-CA-34 [P0] 后端 Memory Lookup API 实现

**目标**: 提供基于 source_id, hash, file_path 的记忆快速查询接口

**状态**: ✅ **已完成** (2026-04-09)

**完成说明**:

- 后端实现 `GET /api/v1/memories/lookup` 接口
- 支持优先级查询：source_id > hash > file_path+project_id
- 实现 SurrealDB 索引优化
- 前端已完成集成验证

---

## 任务优先级矩阵

| 任务         | 优先级 | 用户价值 | 技术难度 | 依赖数量 | 推荐顺序   |
| ------------ | ------ | -------- | -------- | -------- | ---------- |
| BL-8         | P1     | 高       | 中       | 1        | 3          |
| BL-15        | P2     | 中       | 高       | 2        | 8          |
| BL-48        | P0     | 高       | 中       | 0        | 1          |
| BL-CA-11     | P0     | 高       | 中       | 0        | 2          |
| BL-CA-12     | P1     | 高       | 中       | 0        | 1          |
| BL-CA-13     | P1     | 中       | 中       | 1        | 4          |
| BL-CA-14     | P1     | 中       | 高       | 2        | 6          |
| BL-CA-15     | P0     | 高       | 中       | 0        | 2          |
| BL-CA-16     | P1     | 中       | 低       | 1        | 5          |
| BL-CA-17     | P0     | 高       | 中       | 0        | 1          |
| BL-CA-18     | P1     | 高       | 中       | 0        | 1          |
| BL-CA-19     | P1     | 高       | 中       | 2        | 4          |
| BL-CA-20     | P1     | 中       | 中       | 1        | 5          |
| BL-CA-21     | P2     | 中       | 中       | 2        | 7          |
| ~~BL-CA-22~~ | ~~P0~~ | ~~高~~   | ~~中~~   | ~~0~~    | ~~已取消~~ |
| ~~BL-CA-23~~ | ~~P1~~ | ~~中~~   | ~~中~~   | ~~1~~    | ~~已取消~~ |
| ~~BL-CA-24~~ | ~~P1~~ | ~~中~~   | ~~低~~   | ~~1~~    | ~~已取消~~ |
| ~~BL-CA-25~~ | ~~P2~~ | ~~低~~   | ~~中~~   | ~~3~~    | ~~已取消~~ |
| ~~BL-CA-26~~ | ~~P2~~ | ~~低~~   | ~~高~~   | ~~4~~    | ~~已取消~~ |
| BL-CA-27     | P0     | 高       | 中       | 0        | 1          |
| BL-CA-28     | P0     | 高       | 低       | 0        | 1          |
| BL-CA-29     | P0     | 高       | 低       | 0        | 1          |
| BL-CA-30     | P1     | 中       | 中       | 0        | 2          |
| BL-CA-31     | P1     | 中       | 中       | 0        | 3          |
| BL-CA-32     | P2     | 中       | 高       | 0        | 4          |
| BL-CA-33     | P0     | 高       | 中       | 0        | 1          |
| BL-CA-34     | P0     | 高       | 中       | 0        | 1          |
| **BL-CA-35** | **P0** | **高**   | **中**   | **0**    | **1**      |
| **BL-CA-36** | **P0** | **高**   | **高**   | **1**    | **2**      |
| **BL-CA-37** | **P0** | **高**   | **高**   | **1**    | **2**      |
| **BL-CA-38** | **P0** | **高**   | **中**   | **1**    | **2**      |
| **BL-CA-39** | **P0** | **高**   | **中**   | **3**    | **3**      |
| **BL-CA-40** | **P1** | **中**   | **中**   | **2**    | **4**      |
| **BL-CA-41** | **P1** | **中**   | **中**   | **1**    | **4**      |
| **BL-CA-42** | **P2** | **低**   | **低**   | **1**    | **5**      |

---

## 场景十一：v3.2 架构升级 — 统一架构实施

> **背景**: 基于 v3.1 文档审核结果和代码库分析，需要实施 v3.2 架构升级，包括 WebSocket 重构、PrecomputeService 服务化、Meilisearch SDK 升级、服务端口迁移。
>
> **目标**: 完成后端服务从 17999 到 18008 的完全替换，实现完整的可靠性保障和性能优化。

---

### BL-CA-35 [P0] v3.2 架构升级 - 总体文档编写

**目标**: 完成 v3.2 架构升级的所有 P0 核心文档编写，为后续开发提供完整的设计规范和实施指南

**涉及范围**:

1. `docs/v3.2/UNIFIED-ARCHITECTURE-v3.2.md` - 总体架构文档
2. `docs/v3.2/BACKEND-v3.2-IMPLEMENTATION.md` - 后端实施总览
3. `docs/v3.2/BACKEND-v3.2-WEBSOCKET.md` - WebSocket 详细设计
4. `docs/v3.2/BACKEND-v3.2-PRECOMPUTE.md` - 预计算服务设计
5. `docs/v3.2/BACKEND-v3.2-MIGRATION.md` - 迁移指南
6. `docs/v3.2/PLUGIN-v3.2-IMPLEMENTATION.md` - 插件端实施指南

**前置依赖**:

- v3.1 文档审核完成（UNIFIED-ARCHITECTURE-v3.1-problems-confirm.md）
- 技术栈确认（Python 3.10+, SurrealDB 3.0+, SDK 1.0.8）
- 决策确认（WebSocket 重写、PrecomputeService 重构、Meilisearch SDK 升级）

**完成标准**:

1. 所有 P0 文档编写完成并通过审核
2. 文档包含完整的目标、范围、前置依赖、完成标准、验证方式
3. WebSocket 设计包含心跳、指数退避重连、消息确认、DIFF 模式
4. PrecomputeService 设计包含批量处理、增量更新、性能监控
5. 迁移指南包含 17999 → 18008 的详细步骤
6. 插件端文档包含依赖升级（ws 8.20, pino, dotenv）

**验证方式**:

1. 文档评审：检查所有文档是否完整、一致、可实施
2. 技术评审：后端团队确认设计可行性
3. 架构评审：确认与现有系统的兼容性
4. 检查清单：所有完成标准项逐一确认

**状态**: 🆕 新建

---

### BL-CA-36 [P0] v3.2 WebSocket 服务重构

**目标**: 按 v3.2 设计完全重写 WebSocket 服务，实现完整的可靠性保障（心跳、指数退避重连、消息确认、DIFF 模式）

**涉及范围**:

1. `embedding_service/wrapper/src/routers/websocket.py` - 完全重写
2. `embedding_service/wrapper/src/utils/websocket/` - 新增目录
   - `reliable_client.py` - ReliableWebSocketClient 类
   - `ack_system.py` - AcknowledgementSystem 类
   - `state_recovery.py` - ConnectionStateRecovery 类
   - `persistent_queue.py` - PersistentMessageQueue 类
3. `embedding_service/wrapper/src/utils/diff/` - 新增 DIFF 模式支持
   - `subscription.py` - DiffSubscription 类
   - `patch_applier.py` - JSON Patch 应用器

**前置依赖**:

- BL-CA-35 完成（WebSocket 详细设计文档）
- Python `websockets` 库调研完成
- `fast-json-patch` 库确认可用

**完成标准**:

1. ReliableWebSocketClient 实现：
   - 心跳机制（30s 间隔，2 次未响应触发重连）
   - 指数退避重连（1s → 2s → 4s... 最大 300s）
   - 连接状态恢复（session + offset）
2. AcknowledgementSystem 实现：
   - 消息发送等待确认
   - 超时重试（5s 超时，3 次重试）
   - 指数退避延迟

3. DiffSubscription 实现：
   - LIVE SELECT DIFF 订阅
   - 本地缓存维护
   - JSON Patch 应用

4. PersistentMessageQueue 实现：
   - 离线消息持久化
   - 文件锁机制（portalocker）
   - 7 天过期清理

5. 所有功能单元测试通过

**验证方式**:

1. 单元测试：每个类独立测试
2. 集成测试：完整 WebSocket 流程测试
3. 压力测试：1000+ 并发连接测试
4. 故障测试：断网、超时、重连场景测试
5. 性能测试：DIFF 模式减少 90% 数据传输验证

**状态**: 🆕 新建

---

### BL-CA-37 [P0] v3.2 PrecomputeService 重构

**目标**: 将现有代码分析重构为 PrecomputeService，实现服务化、批量处理、增量更新、性能监控

**涉及范围**:

1. `embedding_service/wrapper/src/services/` - 新增目录
   - `precompute.py` - PrecomputeService 主类
   - `performance_monitor.py` - 性能监控类
   - `concurrency_control.py` - 并发控制类
2. `embedding_service/wrapper/src/utils/code_analyzer.py` - 解耦，改为服务调用
3. `embedding_service/wrapper/src/routers/code.py` - 新增预计算路由

**前置依赖**:

- BL-CA-35 完成（PrecomputeService 设计文档）
- `tree-sitter` Python 绑定确认可用
- `psutil` 库确认可用

**完成标准**:

1. PrecomputeService 实现：
   - AST 解析（tree-sitter Query）
   - 符号提取（函数、类、接口）
   - 批量创建 Atoms（SurrealDB 批量插入）
   - 创建 Entity（含双向引用）
   - 创建 Relations（调用关系）

2. 性能监控实现：
   - 耗时监控（perf_counter）
   - 内存监控（psutil）
   - CPU 监控（psutil）
   - 自动记录到 performance_log 表

3. 增量更新实现：
   - 文件指纹计算（SHA256）
   - 变更检测
   - 差异计算
   - 只更新变更部分

4. 并发控制实现：
   - asyncio.Semaphore 限流（最大 5 并发）
   - 去重机制（processing set）
   - 队列管理

5. 所有功能单元测试通过

**验证方式**:

1. 单元测试：每个方法独立测试
2. 集成测试：完整预计算流程测试
3. 性能测试：大文件（>1000 行）处理测试
4. 增量测试：重复分析相同文件，验证跳过
5. 并发测试：多文件同时分析测试

**状态**: 🆕 新建

---

### BL-CA-38 [P0] v3.2 Meilisearch SDK 升级

**目标**: 将 Meilisearch 从 httpx 调用升级为 Python SDK 0.40，获得类型安全和更好的 API

**涉及范围**:

1. `embedding_service/pyproject.toml` - 新增依赖 `meilisearch>=0.40.0,<0.41.0`
2. `embedding_service/wrapper/src/utils/meili_client.py` - 完全重写
3. `embedding_service/wrapper/src/utils/memory_manager/meili_sync.py` - 适配新 SDK

**前置依赖**:

- BL-CA-35 完成（Meilisearch 升级指南文档）
- Meilisearch SDK 0.40 发布确认
- 向后兼容性确认

**完成标准**:

1. 依赖升级：
   - 添加 `meilisearch>=0.40.0,<0.41.0` 到 pyproject.toml
   - 移除 httpx 直接调用

2. MeiliClient 重写：
   - 使用 Meilisearch SDK 客户端
   - 保持现有功能（索引管理、文档 CRUD、搜索）
   - 添加类型注解

3. 同步逻辑适配：
   - 更新 MeiliSyncMixin
   - 保持双写策略（SurrealDB + Meilisearch）

4. 配置兼容：
   - 环境变量配置保持不变
   - 索引设置自动迁移

5. 所有功能单元测试通过

**验证方式**:

1. 单元测试：MeiliClient 所有方法测试
2. 集成测试：文档增删改查测试
3. 搜索测试：全文搜索、过滤、排序测试
4. 性能测试：与 httpx 版本性能对比
5. 兼容性测试：现有索引无缝迁移

**状态**: 🆕 新建

---

### BL-CA-39 [P0] v3.2 服务端口迁移

**目标**: 将服务端口从 17999 迁移到 18008，完成与现有服务的完全替换

**涉及范围**:

1. `embedding_service/wrapper/src/main.py` - 端口配置更新
2. `embedding_service/wrapper/src/config.py` - 配置更新
3. `embedding_service/docker-compose.yml` - 端口映射更新
4. `opencode-memory-plugin/lib/wrapper-client.js` - 端口更新
5. `opencode-memory-plugin/agents/` - 端口更新
6. 文档更新

**前置依赖**:

- BL-CA-35 完成（迁移指南文档）
- BL-CA-36、BL-CA-37、BL-CA-38 完成（新服务就绪）
- 新服务测试通过

**完成标准**:

1. 后端端口更新：
   - FastAPI 服务端口改为 18008
   - WebSocket 端口改为 18008
   - Docker 端口映射更新

2. 插件端端口更新：
   - wrapper-client.js 默认端口改为 18008
   - 所有 agent 配置更新

3. 文档更新：
   - 所有文档中的端口引用更新
   - API 文档更新

4. 兼容性处理：
   - 保留 17999 作为可选配置（向后兼容）
   - 环境变量支持 PORT 配置

5. 部署验证：
   - Docker 部署测试通过
   - 本地部署测试通过

**验证方式**:

1. 配置检查：全局搜索 17999，确认全部更新
2. 单元测试：配置加载测试
3. 集成测试：完整端到端测试
4. 部署测试：Docker 部署验证
5. 回归测试：现有功能全部正常

**状态**: 🆕 新建

---

### BL-CA-40 [P1] v3.2 插件端依赖升级

**目标**: 升级插件端依赖（ws 8.20, pino, dotenv），支持 v3.2 新功能

**涉及范围**:

1. `opencode-memory-plugin/package.json` - 依赖更新
2. `opencode-memory-plugin/lib/websocket-client.js` - 适配新 ws 版本
3. `opencode-memory-plugin/lib/logger.js` - 新增（pino 封装）
4. `opencode-memory-plugin/lib/config.js` - 新增（dotenv 封装）

**前置依赖**:

- BL-CA-35 完成（插件端实施指南文档）
- BL-CA-36 完成（后端 WebSocket 就绪）

**完成标准**:

1. 依赖升级：
   - ws: 8.19.0 → 8.20.0
   - 新增 pino: ^9.5.0
   - 新增 dotenv: ^16.4.5

2. WebSocket 客户端适配：
   - 使用 ws 8.20 新特性
   - 适配后端 ReliableWebSocket

3. 日志系统：
   - pino 结构化日志
   - 性能提升 5x
   - 开发环境美化（pino-pretty）

4. 配置管理：
   - dotenv 环境变量加载
   - 配置验证

5. 所有功能测试通过

**验证方式**:

1. 依赖检查：package.json 验证
2. 单元测试：logger、config 测试
3. 集成测试：WebSocket 连接测试
4. 性能测试：日志性能对比
5. 回归测试：现有功能全部正常

**状态**: 🆕 新建

---

### BL-CA-41 [P1] v3.2 SurrealDB Schema 升级

**目标**: 升级 SurrealDB Schema 到 3.0+，添加 tenant_id 预留字段，支持 v3.2 新特性

**涉及范围**:

1. `docs/v3.2/DATABASE-v3.2-SCHEMA.md` - Schema 文档
2. `embedding_service/wrapper/src/db/migrations/` - 新增迁移脚本
   - `v3.2_schema.sql` - Schema 定义
   - `migrate_v2_to_v3.2.py` - 迁移脚本

**前置依赖**:

- BL-CA-35 完成（Schema 设计文档）
- SurrealDB 3.0+ 确认可用

**完成标准**:

1. Schema 升级：
   - 所有表添加 tenant_id 字段
   - 添加复合索引（tenant_id + 其他字段）
   - 添加辅助表（timeline, stats, project, config）
   - 添加 DEFINE EVENT
   - 添加 DEFINE FUNCTION
   - 添加 ChangeFeed

2. 数据迁移：
   - 现有数据迁移脚本
   - tenant_id 默认值为 "default"
   - 零停机迁移

3. 验证：
   - Schema 创建成功
   - 索引生效
   - 事件触发正常

**验证方式**:

1. Schema 检查：所有表结构验证
2. 索引检查：查询性能验证
3. 事件测试：CREATE/UPDATE/DELETE 触发验证
4. 迁移测试：现有数据迁移验证
5. 回归测试：现有功能全部正常

**状态**: 🆕 新建

---

### BL-CA-42 [P2] v3.2 P1/P2 文档编写

**目标**: 完成 v3.2 的 P1/P2 补充文档

**涉及范围**:

1. `docs/v3.2/BACKEND-v3.2-MEILISEARCH.md` - Meilisearch 详细指南
2. `docs/v3.2/PLUGIN-v3.2-API.md` - 插件端 API 规范
3. `docs/v3.2/DEPLOYMENT-v3.2.md` - 部署指南
4. `docs/v3.2/DEVELOPMENT-v3.2.md` - 开发指南

**前置依赖**:

- BL-CA-35 完成（P0 文档）
- 所有 P0 开发任务完成

**完成标准**:

1. 所有 P1/P2 文档编写完成
2. 文档与实现保持一致
3. 包含完整的示例代码
4. 包含故障排除指南

**验证方式**:

1. 文档评审：检查完整性
2. 技术评审：确认准确性
3. 示例验证：所有代码可运行

**状态**: 🆕 新建

---

_文档版本: v2.9.4_  
_更新时间: 2026-04-10_  
_状态: 已添加 v3.2 架构升级任务_
