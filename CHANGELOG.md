# Changelog

## [Unreleased]

### Graphify Bridge — graph.json → SurrealDB 桥接

#### Added

- **`graphify-bridge.js`**: 将 graphify 的 `graph.json` 完整导入 SurrealDB（Entity/Atom/Reference）
- **CLI `graphify` 命令**: `opencode-memory graphify [--skip-graphify] [--project <id>]`
- **进度条**: Entities/Atoms/Refs 三阶段实时进度条（TTY 动画，非 TTY 降级日志）
- **Atom `entity_id`**: atoms 关联到所属 entity，支持 `entity_atoms` 工具查询
- **`buildFileToEntityMap()`**: source_file → entity backend ID 映射
- **`checkGraphifyInstalled()`**: 自动尝试 `python3` / `python` 命令
- **输入校验**: `importGraphJSON` 校验 graph.json 的 nodes/links 类型
- **33 个单元测试**: 4 个 test suites（parse, mapping, concurrent, import）

#### Changed

- **`buildAtomPayload()`**: 新增第 4 个参数 `entityBackendId`（可选）
- **`wrapper-client.batchCreateAtoms()`**: 发送 `entity_id` 字段
- **Atom rate 显示**: 改为当前批次速率（非累计平均）

#### Performance

- 导入耗时 700s → 205s（3.4x 提升），得益于后端 batch embedding 优化
- E2E 数据: 194 entities, 2452 atoms, 2843 references, 0 errors, 856 skipped

### Auto Code Relation Extraction

#### Added

- **Auto code relation extraction**: Automatic discovery of `depends_on`, `calls`, and `extends` relationships between code entities
- **Symbol table**: Cross-file symbol resolution with LRU cache and disk persistence for fast lookups across restarts
- **Scheduled health check**: Periodic knowledge graph health monitoring with configurable cron schedules and thresholds
- **Dual-threshold relation recommendation engine**: High-confidence relations auto-created, medium-confidence relations queued for review
- **Quality dashboard**: Knowledge graph quality metrics including health scores, connectivity density, and orphan node rates
- **Pending review queue**: Review queue for medium-confidence recommendations with configurable expiry management

#### Fixed

- **LRU eviction memory leak**: Fixed symbol table LRU cache not properly releasing evicted entries
- **Concurrent write protection**: Fixed race conditions in pending review queue during simultaneous writes
- **Code analyzer runtime errors**: Fixed undefined variable references and missing field access errors in code analyzer

---

## [3.3.0] - 2026-04-29

### v3.3 Atom Architecture - 层级化知识图谱

#### 🏗️ 核心架构

- **Atom 树结构**: 支持嵌套层级（parent_id + children）
- **分数索引**: Base-62 编码的 order 字段，支持无限插入
- **循环检测**: 三色 DFS 算法，写入前自动检测
- **悬挂引用**: 自动检测并警告 wiki 链接和 parent_id

#### 📝 存储层 (lib/)

- `buildEntryContent()` - 支持 Atoms JSON 区段
- `parseEntryFromFile()` - 解析 Atoms 区段
- `buildAtomTree()` - O(n) 重建树结构
- `flattenAtomTree()` - 树结构展平
- `detectCircularReference()` - 循环引用检测
- `generateFractionalIndex()` - Base-62 分数索引
- `detectDanglingReferences()` - 悬挂引用检测

#### 🔧 API 层 (lib/memory-core.js)

- `writeMemory({atoms})` - 支持 Atom 树写入
- `readMemory()` - 自动检测 Entity/Atom ID
- `updateEntity({atoms_batch})` - 批量 Atom 操作（add/update/remove）
- `getEntityAtoms()` - 获取 Atom 树
- `markDeadLinks()` - 标记死链
- `extractWikiLinks()` - 提取 wiki 链接
- `findIncomingLinks()` - 查找入链

#### 📏 Length Limit Changes

- **abstract/overview 长度限制调整**: 从强制限制改为建议限制
  - `abstract`: 建议 ≤100 字符（超长会警告但不拒绝）
  - `overview`: 建议 ≤500 字符（超长会警告但不拒绝）
  - 向后兼容: `MAX_ABSTRACT_LENGTH` / `MAX_OVERVIEW_LENGTH` 别名仍然有效
  - 新增常量: `RECOMMENDED_ABSTRACT_LENGTH` / `RECOMMENDED_OVERVIEW_LENGTH`

#### 🛡️ 风险缓解

- **循环检测**: 写入前自动检测，拒绝循环引用
- **悬挂引用**: 检测并警告，不阻止写入
- **死链标记**: 自动标记不存在的链接
- **文件大小监控**: 100KB 限制，80KB 警告

#### 🔌 后端集成

- **Atom 字段扩展**: tags, heading_level, parent_id, order, aliases, entity_id
- **统一搜索**: POST /api/v1/search（Entity + Atom 混合搜索）
- **SurrealDB Schema**: 6 新字段 + 3 索引

#### 🧪 测试覆盖

```
Test Suites: 13 atom-related test files
Tests:       97 new tests (100% pass)
Coverage:    entry-atoms, atom-tree, memory-write/read,
             update-entity, get-entity-atoms, wiki-links,
             dangling-references, dead-links, file-size-monitor,
             v3.3-atom-e2e
```

#### 📚 文档

- [MIGRATION-v3.3.md](./docs/MIGRATION-v3.3.md) - 迁移指南
- [API-CONTRACT.md](./docs/API-CONTRACT.md) - API 契约更新

#### 🐛 Bug Fixes

- `entity_update`: Added meta/content fields to entity_updates schema
- `markDeadLinks`: Added file locking to prevent concurrent write issues
- `updateEntity` sync: Fixed synced flag not being updated after successful sync
- `readMemory`: Added backward compatibility for entry field in return value
- `findAllChildren`: Removed dead parent_local_id check

#### 🔧 Improvements

- Console migration: Replaced console.log/warn/error with logger in non-core modules
- `removeAtomFromTree`: Added depth limit (maxDepth=20) to prevent infinite recursion
- `atomicWriteText`: Added EPERM fallback for Windows compatibility

#### 🧪 Test Infrastructure

- Added Jest projects configuration (unit parallel + integration serial)
- Improved test isolation using jest.isolateModules
- Reorganized test directory structure by functional domain

#### ⚠️ 向后兼容

- 旧格式 Entity 完全兼容
- 无 atoms 参数的 writeMemory 行为不变
- 自动识别 Entity/Atom ID 类型

---

## [3.2.2] - 2026-04-18

### Phase 7 - Code Quality Fixes (Code Review)

- **BL-P-18**: Fix pong missing timestamp (heartbeat may fail), shorten detection window to 60s, remove unused `timeout` field
- **BL-P-19**: Remove dead DiffSubscription code (module had bugs, backend doesn't support subscribe)
- **BL-P-20**: Store wsClient instance for external access, add `mode=full` to WebSocket URL
- **BL-P-21**: Integration tests correctly show `skipped` when backend unavailable, ack-manager protocol docs

### Phase 8 - Cleanup

- Remove orphaned `diff-subscription.test.js` (20 tests for deleted module)
- Sync backlog status for BL-P-2~13 (marked done but showed 🆕)

---

## [3.2.1] - 2026-04-18

### Phase 6 - WebSocket Real-time Sync Integration

#### 🔌 WebSocket Protocol Fix (BL-P-14)

- **M1**: Message type mapping — `type: "change"` with `action` field and `result` data
- **M2**: ACK using `seq` (integer) instead of `_ackId` (UUID), auto-ack on receive
- **M3**: Passive heartbeat — server sends ping, client replies pong (no client-initiated ping)

#### 🔌 Plugin Integration (BL-P-15)

- WebSocket auto-connects on plugin startup via `plugin.js`
- Configurable via `memory-config.json` (`websocket.enabled`, `heartbeatInterval`, etc.)
- Graceful degradation — plugin works normally if WebSocket unavailable

#### 🧪 Integration Tests (BL-P-16)

- 7 integration tests against live backend WebSocket endpoint
- Connection, session_id, heartbeat, error handling, client library state tracking

#### 📊 Test Results

```
Test Suites: 28 passed, 28 total
Tests:       324 passed, 10 skipped, 334 total
WebSocket Integration: 7 passed
```

---

## [3.2.0] - 2026-04-17

### v3.2 - Infrastructure Upgrade & Precompute API

#### 🏗️ Infrastructure

- **Dependency Upgrade (BL-P-1)**: pino structured logging, dotenv env config, ws@8.20.0, fast-json-patch
- **Port Migration (BL-P-8)**: Backend port 17999 → 18008 across all modules and docs
- **Config Management (BL-P-10)**: dotenv-based env config (API*PORT, LOG_LEVEL, WS*\*)
- **Structured Logging (BL-P-9)**: pino logger with JSON/pretty modes

#### 🔌 WebSocket (Library Modules - Not Yet Wired)

- **ReliableWebSocketClient (BL-P-2)**: 4-state machine (DISCONNECTED/CONNECTING/CONNECTED/RECONNECTING)
- **ACK Manager (BL-P-3)**: Message confirmation with 5s timeout, 3 retries
- **DIFF Mode (BL-P-4)**: JSON Patch-based incremental updates via WebSocket
- **Heartbeat**: 30s keepalive with automatic reconnect

> **Note**: WebSocket modules are implemented as library code but not yet wired into plugin.js startup. They are available for programmatic use and tested with 47 unit tests.

#### 🧮 Precompute Service

- **PrecomputeClient (BL-P-6)**: uploadAnalysis, checkFingerprints, searchSymbols
- **BatchProcessor**: Automatic batch splitting with concurrency control
- **FingerprintCache**: SHA-256 content hash + symbol hash for incremental detection
- **Code Analysis Adaptation (BL-P-7)**: code-analysis-service.js uses Precompute API with backward compat

#### 🧪 Testing

- **E2E Integration Tests (BL-P-13)**: 11 tests verifying all backend APIs (health, CRUD, fingerprint, precompute, symbols, graph, sync)
- **Precompute Unit Tests (BL-P-12)**: 24 tests for client, batch processor, fingerprint cache
- **WebSocket Unit Tests (BL-P-11)**: 47 tests for reliable client, ACK, DIFF, heartbeat
- **Test Framework Unified**: All tests converted from vitest to Jest (35 tests migrated)

#### 📊 Test Results

```
Test Suites: 29 passed, 29 total
Tests:       335 passed, 10 skipped, 345 total
```

---

## [3.0.0] - 2026-04-07

### Code Analysis v3.0 - Complete Feature Set (BL-44 ~ BL-48)

#### 🚀 New Features

- **Auto-Trigger (BL-48)**: File watcher with 300ms debounce
  - Automatic code analysis on file save
  - Uses `chokidar` for cross-platform file watching
  - Smart exclusion of node_modules, .git, sensitive files
  - Integration with OpenCode plugin lifecycle

- **Configuration System (BL-45)**: Customizable analysis parameters
  - `debounce_ms`: Adjust debounce timing (default: 300ms)
  - `batch_max_size`: Files per batch (default: 10)
  - `large_file_threshold`: Warning threshold (default: 5000 lines)
  - `skip_file_threshold`: Skip threshold (default: 10000 lines)
  - `max_concurrent`: Concurrent analysis limit (default: 2)

- **Enhanced Complexity Metrics (BL-47)**: AST-based accurate calculation
  - Cyclomatic complexity per function
  - Nesting depth tracking (max/average)
  - Function-level complexity metrics
  - Project health grading (A/B/C/D) based on complexity

- **JSDoc Extraction (BL-48)**: Automatic documentation parsing
  - Extracts description, @param, @returns from JSDoc comments
  - Attached to functions, classes, and interfaces
  - Supports TypeScript and JavaScript

- **Output Formatting (BL-50)**: Human-readable output formats
  - `--format table`: Tabular output with complexity metrics
  - `--format tree`: Hierarchical tree structure
  - `--format json`: Machine-readable JSON (default)
  - `--save`: Save analysis results to memory system

- **Project-Level Analysis (BL-51)**: Health grading and risk detection
  - Project health report with A/B/C/D grading
  - Language distribution statistics
  - High-risk file identification (complexity > 10)
  - Large file detection (lines > 500)
  - Batch analysis of entire project

#### 🔧 Technical Improvements

- **New Dependencies**: `chokidar`, `oxc-parser`
- **New Modules**:
  - `lib/file-watcher.js`: File system watcher
  - `lib/code-analysis-formatter.js`: Output formatting
  - `lib/project-analyzer.js`: Project-level analysis
  - `lib/code-fingerprint.js`: Change detection for incremental sync

#### 📚 Documentation

- **CODE-ANALYSIS.md**: Updated to v3.0.0, accurate language support (JS/TS only)
- **QUICK_START_CODE_ANALYSIS.md**: Updated FAQ for accurate language support
- **README.md**: Updated to v3.0.0, added complexity and JSDoc features
- **CODE_ANALYSIS_DEVELOPMENT.md**: New developer documentation

#### 🧪 Testing

- 18 test suites, 140 tests passing
- Integration tests for JavaScript and TypeScript
- Project analysis validation

#### ⚠️ Notes

- Multi-language support (Python/Go/Rust/Java) via Tree-sitter is implemented internally but not officially released pending backend API support
- Incremental sync (fingerprint-based) frontend is ready, waiting for backend `/api/v1/sync/code-fingerprints` endpoint

---

## [2.9.1] - 2026-04-03

### Bug Fixes (BL-35)

- **修复集成测试 422 错误**: 后端 API 要求 `abstract` 和 `overview` 字段，测试代码未提供导致 422 Unprocessable Entity
  - 添加 `normalizeMemory()` 辅助函数，自动从 `content` 字段提取前 100 字符作为 `abstract`，前 500 字符作为 `overview`
  - 更新 6 处 `memories[]` 调用点，统一包裹 `normalizeMemory()` 调用
  - 所有 12 个集成测试现在通过，无 422 错误

#### 🔧 Modified Files

- `opencode-memory-plugin/tests/phase-a-integration.test.js`: 添加 `normalizeMemory()` 函数，修改 6 处调用点
- `BACKLOG.md`: 新增 BL-35，更新阶段 6 状态为已完成
- `AGENTS.md`, `WINDOWS_SETUP.md`: Prettier 格式化修复

## [2.9.0] - 2026-04-02

### Code Analysis Feature (BL-13, BL-14)

- **File Watcher**: Automatic code analysis on file save (`plugin.js` event listener)
- **300ms Debounce**: Smart batching to reduce unnecessary analysis
- **Privacy Filter**: Automatically skips sensitive files (.env, node_modules, .git)
- **Batch Upload**: Up to 10 files or 2-second delay before upload
- **User Documentation**: Complete `CODE-ANALYSIS.md` guide (6.9KB)
- **Configuration**: Added `code_analysis` configuration section to `CONFIGURATION.md`
- **Supported Languages**: JavaScript, TypeScript, Python, Go, Rust, Java

#### 🔧 Modified Files

- `plugin.js`: Added file watcher event listener
- `CODE-ANALYSIS.md`: New user documentation
- `README.npm.md`: Added Code Analysis feature
- `CONFIGURATION.md`: Added code_analysis configuration section

### JSDoc Type Annotations (BL-11.1)

- **WrapperClient**: HealthStatus, SearchParams, SearchResult, MemoryEntry types
- **MemoryCore**: WriteMemoryParams, WriteMemoryResult types
- **CodeAnalyzer**: AnalysisResult, AnalyzerConfig types
- **IDE IntelliSense**: VS Code now shows type hints without TypeScript compilation

#### 🔧 Modified Files

- `lib/wrapper-client.js`: Added 4 typedefs + 3 method JSDoc comments
- `lib/memory-core.js`: Added 2 typedefs + 1 function JSDoc comment
- `lib/code-analyzer.js`: Added 2 typedefs + class/method JSDoc comments

### Documentation Governance (BL-2 ~ BL-6)

- **Archive Outdated Docs**: Moved old design docs to `docs/archive/`
- **Version Sync**: Updated all product docs to v2.9.0
- **Memory Templates**: Updated 9 OpenClaw templates (SOUL, AGENTS, etc.)
- **Dev Docs Reorganization**: Moved AGENTS.md to `docs/`, created `docs/README.md`
- **Dependency Cleanup**: Removed better-sqlite3, sqlite-vec from package.json

### Bug Fixes (BL-1, BL-7, BL-9, BL-10, BL-11)

- **README.md**: Fixed tool count 16→15, removed dead links, fixed orphaned parenthesis
- **Observer Mode**: Changed `mode: subagent` → `mode: primary` for Human-in-the-loop
- **Code Fingerprint**: Fixed missing `resolveProjectId` import
- **Privacy Filter**: Fixed `validateFileSize()` hardcoded size=0 bug
- **Test Syntax**: Fixed phase-a-integration.test.js syntax error

### Removed Features

- **BL-16 memory_list**: Decided NOT to implement (feature overlap with existing tools)

---

## [2.9.0] - 2026-03-29

### Markdownlint 集成与文档质量提升

- **Markdownlint-cli2**: 新增 Markdown 文档检查工具 (`lint:md`, `lint:md:fix`)
- **Pre-commit 集成**: 添加 markdownlint-cli2 hook（P3 优先级）
- **文档修复**: 修复 103 个 Markdown 格式错误
- **文档规范**: 新增 Markdown 编写规范（AGENTS.md）
- **配置文件**: 新增 `.markdownlint-cli2.jsonc`

#### 🔧 Modified Files

- `package.json`: 添加 `markdownlint-cli2` 依赖和 `lint:md`/`lint:md:fix` scripts
- `.pre-commit-config.yaml`: 添加 markdownlint-cli2 hook
- `.markdownlint-cli2.jsonc`: 新增配置文件
- `AGENTS.md`: 新增文档规范章节

---

## [2.7.0] - 2026-03-28

### 质量审核修复（部分）

基于全面质量审核发现的 53 个问题，修复了部分高优先级项：

- **单例模式**: `getWrapperClient()` 新增 `resetWrapperClient()` 方法
- **Git 缓存**: `gitRemoteCache` 添加 5 分钟 TTL 过期机制
- **bin/cli.cjs**: 标记为 DEPRECATED，显示废弃警告
- **未使用变量**: 清理 `_wsClient`、`_entryCount` 等

#### 🔧 Modified Files

- `lib/wrapper-client.js`: 新增 `resetWrapperClient()`，支持配置更新
- `lib/project-resolver.js`: 添加 `CACHE_TTL = 5 * 60 * 1000` 缓存过期
- `bin/cli.cjs`: 添加 DEPRECATED 警告

---

## [2.6.0] - 2026-03-28

### Oxlint + Prettier 代码规范迁移

完全替换 ESLint，使用 Oxlint + Prettier 作为代码检查和格式化工具。

#### Added

- **Oxlint**: 基于 Rust 构建，速度提升 10-50x
- **Prettier**: 代码格式化工具
- `.oxlintrc.json`: Oxlint 规则配置
- npm scripts: `lint`, `lint:fix`, `format`, `format:check`

#### Changed

- **ESLint → Oxlint**: 完全替换代码检查工具
- **测试文件重写**: test-phase-c-performance.js 从 Python 风格转为 Jest 格式
- **Pre-commit Hook**: ESLint hook 替换为 Oxlint hook

#### Removed

- **ESLint 依赖**: 移除 `@eslint/js`, `globals`, `eslint`
- **ESLint 配置**: 删除 `.eslintrc.cjs`, `eslint.config.js`

#### Fixed

- **5 个 no-unused-vars 警告**: 使用 `_` 前缀约定修复
- **测试文件语法**: test-sync-methods.test.js 修复顶层 await

---

## [2.5.2] - 2026-03-27

### 后端 v2.4.0 API 对齐

- **syncPreview**: `syncIncremental` → `syncPreview`，与后端路由对齐
- **auto_clean**: `full_sync` 新增 `auto_clean` 参数，自动清理重复文件
- **conflict_resolve**: 修复枚举值大小写（`USE_LOCAL` → `use_local`）
- **deleteRelation**: 修复 `relation_id` 参数映射
- **wrapper-client**: 方法签名全面对齐后端 v2.4.0
- **API-CONTRACT.md**: 更新工具↔后端 API 映射

#### 🔧 Modified Files

- `lib/wrapper-client.js`: 方法名和参数对齐
- `tools/sync.js`: auto_clean 参数、大小写转换
- `tools/graph.js`: deleteRelation 参数修复
- `docs/API-CONTRACT.md`: 更新 API 映射

---

## [2.5.1] - 2026-03-27

### Bug 修复（第三轮）

15/15 工具全面测试通过。

- **sync_checkpoint**: 无参调用时 `args.action` undefined 防御
- **full_sync**: 补全 abstract/overview/local_id 字段
- **createRelation**: 统一参数名为 `relationship_type`
- **memory_relate**: 防御性字段映射 `r.to || r.to_id`
- **memory_graph**: 优先取 `results.memories || results.relations`
- **memory_suggest**: 改用静态 import，修复动态 import 问题
- **conflict_resolve**: `.toLowerCase()` 转换枚举值

#### 🧪 Test Results

| Result  | Count |
| ------- | ----- |
| Passed  | 15/15 |
| Skipped | 0     |
| Failed  | 0     |

---

## [2.5.0] - 2026-03-27

### Tool Cleanup

**Simplified toolset and improved functionality**

#### 🗂️ Core Changes

- **Tool Cleanup**: Removed 4 redundant tools
  - Removed: `list_daily`, `init_daily`, `sync_status`, `batch_resolve`
  - Tool count: 19 → 15
- **Enhanced index_status**: Added `--detailed` parameter for pending entries
- **New sync_checkpoint**: View sync checkpoints and fingerprints
- **Bug Fix**: Added `getStatus()` method to `wrapper-client.js`
- **CLI Enhancements**: Added `checkpoint` command
- **Memory Core Refactoring**: Unified CLI and Plugin read/search logic via `lib/memory-core.js`

#### 🔧 Modified Files

- `tools/sync.js`: Removed 3 tools, added sync_checkpoint
- `lib/wrapper-client.js`: Added getStatus() method
- `cli/index.cjs`: Added checkpoint command, enhanced status
- `lib/memory-core.js`: Unified readMemory/writeMemory interface

#### 📋 Tool Changes

| Action   | Tools                                     |
| -------- | ----------------------------------------- |
| Removed  | `list_daily`, `init_daily`, `sync_status` |
| Added    | `sync_checkpoint`                         |
| Enhanced | `index_status` (--detailed)               |

#### 🧪 Test Coverage

103/113 tests passed (10 skipped), coverage 37.3%

---

## [2.4.1] - 2026-03-27

### Entry Format Upgrade

**Enhanced delimiter format and code block wrapping**

#### 🗂️ Core Changes

- **New Delimiter Format**: `# ≡≡≡ {标题} ≡≡≡` (3x ≡ instead of 2x)
- **Content Wrapping**: Content areas now wrapped with ``` code blocks
- **New Meta Field**: Added optional `meta` field in frontmatter
  - JSON array format: `meta: [{"key":"value"},...]`
- **CLI Support**: Added `--meta` parameter for `write` command

#### 🔧 Modified Files

- `lib/entry.js`: Updated `buildEntryContent()` for new format
- `lib/extractor.js`: Updated regex patterns for new delimiter
- `lib/memory-core.js`: Added `meta` parameter support
- `cli/index.cjs`: Added `--meta` CLI option

---

## [2.4.0] - 2026-03-26

### L0/L1/L2 Layered Storage

**Unified ULID-based storage with required abstract/overview layers**

#### 🗂️ Core Changes

- **Unified Filename Format**: `entry_{ulid}.md` for all timeline files
- **Required Layers**: `abstract` (≤100 chars) and `overview` (≤500 chars) now required
- **Frontmatter Fields**: Added `id`, `memory_id`, `synced`, `synced_at`
- **Code Refactoring**: Modular split (lib/, tools/, cli/)
- **Shared Code**: CLI and Plugin share lib/ core library

#### ⚠️ Breaking Changes

- `abstract` and `overview` are now REQUIRED in memory_write
- Filename format changed from `entry-{timestamp}.md` to `entry_{ulid}.md`
- memory_read now supports `entry_id` and `level` parameters

---

## [2.3.0] - 2026-03-23

### Dual-Mode Sync & Conflict Resolution

- **Incremental Sync**: Fingerprint-based change detection
- **Full Sync**: Complete synchronization with resume support
- **Conflict Resolution**: Detection, auto-resolve, merge, manual resolve
- **Memory Browsing**: Timeline browser and topic explorer
- **Tool count**: 19 tools (11 core + 4 sync + 2 browser + 2 conflict)

---

## [2.2.0] - 2026-03-19

### Phase C: Performance Optimization

- **Trie Index**: 10x faster local search (<10ms)
- **Autocomplete**: Smart search suggestions (<50ms)
- **Real-time Sync**: WebSocket live synchronization
- **Backend Optimizations**: HNSW tuning, embedding cache, query prefetch

---

## [2.0.0] - 2026-03-11

### Backend Integration

- **SurrealDB Backend**: External memory service with HNSW vector search
- **Project Isolation**: Multi-tenant support (tenant_id, project_id)
- **Graph Relations**: Semantic relationships between memories
- **Hybrid Sync**: Local files + Backend service with automatic fallback

---

## [1.2.0] - 2026-02-26

### Initial Release

- 8 memory tools (write, read, search, list_daily, init_daily, rebuild_index, index_status)
- OpenCode native plugin integration
- BM25 keyword search
- Zero configuration

---

## Version Summary

| Version | Date       | Highlights                             |
| ------- | ---------- | -------------------------------------- |
| 2.9.0   | 2026-03-29 | Markdownlint 集成                      |
| 2.7.0   | 2026-03-28 | 质量审核修复（单例、缓存、废弃标记）   |
| 2.6.0   | 2026-03-28 | Oxlint + Prettier 代码规范迁移         |
| 2.5.2   | 2026-03-27 | 后端 v2.4.0 API 对齐                   |
| 2.5.1   | 2026-03-27 | Bug 修复（15/15 工具通过）             |
| 2.5.0   | 2026-03-27 | Tool Cleanup (19→15), Memory Core 重构 |
| 2.4.1   | 2026-03-27 | Entry 格式升级（≡≡≡ 分隔符 + meta）    |
| 2.4.0   | 2026-03-26 | L0/L1/L2 分层存储                      |
| 2.3.0   | 2026-03-23 | 双模式同步 & 冲突解决                  |
| 2.2.0   | 2026-03-19 | Phase C 性能优化（Trie 索引）          |
| 2.0.0   | 2026-03-11 | 后端集成（SurrealDB + Graph）          |
| 1.2.0   | 2026-02-26 | 初始发布（8 工具）                     |
