# Changelog

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
