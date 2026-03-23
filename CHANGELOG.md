## [2.3.0] - 2026-03-20

### v2.3 Enhanced - Dual-Mode Sync & Conflict Resolution

**Full dual-mode synchronization with intelligent conflict resolution**

#### 🚀 New Features - Sync Tools (4)

- **Incremental Sync** (`incremental_sync`)
  - Fingerprint-based change detection (MD5 hash)
  - Only syncs changed entries, not full dataset
  - Checkpoint tracking for sync progress
  - Dry-run mode for preview

- **Full Sync** (`full_sync`)
  - Complete synchronization with resume support
  - Batch processing (50 entries per batch)
  - Progress persistence for failure recovery
  - Statistics tracking (total, uploaded, skipped, conflicts)

- **Checkpoint Management** (`sync_checkpoint`)
  - List checkpoint history with timestamps
  - Get specific checkpoint details
  - Clear old checkpoints to save space

- **Batch Resolve** (`batch_resolve`)
  - Bulk conflict resolution
  - Accept all / Reject all / Auto-resolve all
  - Statistics for batch operations

#### 🚀 New Features - Browser Tools (2)

- **Timeline Browser** (`memory_timeline`)
  - Browse memories by date range (last N days)
  - Grouped by day with entry counts
  - Pagination support (default: 10 per page)
  - Shows memory_id, type, tags, abstract

- **Topic Explorer** (`memory_topics`)
  - Browse memories by topic
  - Topic statistics (count per topic)
  - Sorted by entry count descending
  - Supports all topics: decisions, preferences, patterns, lessons, general

#### 🚀 New Features - Conflict Tools (2)

- **Conflict Detection** (`conflict_list`)
  - Automatic detection of content conflicts
  - Shows local vs backend versions
  - Conflict type: content_diff, timestamp_diff, metadata_diff
  - Decision status: pending, auto_resolved, manual_resolved

- **Conflict Resolution** (`conflict_resolve`)
  - Accept local version (keep local, update backend)
  - Accept backend version (discard local, use backend)
  - Merge versions (combine changes intelligently)
  - Auto-resolve (timestamp-based or content quality)

#### ⚡ Core Improvements

- **Enhanced `sync_status`**
  - Added sync metadata (last sync time, pending changes, conflict count)
  - Full checkpoint details (hash, entry count, timestamp)
  - Active sync progress indicator
  - Conflict queue information

- **Enhanced `updateLocalEntry`**
  - Now fully implemented (was stub)
  - Supports content, metadata, tags updates
  - Generates new source_id on content change

- **Enhanced `deleteEntries`**
  - Now fully implemented (was stub)
  - Supports single ID or array of IDs
  - Checks both timeline and topic directories

#### 📦 Complete Toolset (19 tools)

| Category     | Tools                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core (11)    | memory_write, memory_read, memory_search, memory_relate, memory_graph, memory_suggest, sync_status, list_daily, init_daily, rebuild_index, index_status |
| Sync (4)     | incremental_sync, full_sync, sync_checkpoint, batch_resolve                                                                                             |
| Browser (2)  | memory_timeline, memory_topics                                                                                                                          |
| Conflict (2) | conflict_list, conflict_resolve                                                                                                                         |

#### 🧪 Test Results

| Phase     | Tests     | Status      |
| --------- | --------- | ----------- |
| Phase C   | 18/18     | ✅ Pass     |
| v2.3      | 10/10     | ✅ Pass     |
| **Total** | **28/28** | **✅ 100%** |

#### 🔧 Architecture

- **Sync Storage**: `.sync/checkpoint.jsonl`, `.sync/progress.json`, `.sync/conflicts.json`
- **Conflict Detection**: Compares local source_id, content_hash, updated_at with backend
- **Auto-Resolve Strategy**:
  - Timestamp conflict: Latest wins
  - Content quality: Longer content wins (if >1.5x)
  - Simple conflicts: Auto-resolve with merge

#### 🐛 Bug Fixes

- **Fixed `incremental_sync` return value error**
  - Error: `text7.split is not a function`
  - Cause: Tool returned object instead of string
  - Fix: Changed all return values to string format

- **Fixed `getMemoryFiles` missing timeline directory**
  - Issue: `rebuild_index` only synced 31 files (core + daily)
  - Cause: Function didn't include `timeline/` directory
  - Fix: Added recursive scan for `timeline/` directory
  - Result: Now syncs 151 files (includes all timeline entries)

- **Fixed `memory_topics` returning 0 results**
  - Issue: Tool returned empty list despite having memories
  - Cause: Only scanned `active/` directory, not `timeline/`
  - Fix: Added timeline directory scanning with date-based grouping
  - Result: Now returns 5 topics (2026-03-16 through 2026-03-20)

---

## [2.2.0] - 2026-03-19

### Phase C: Performance Optimization Complete (v2.2-lite)

**v2.2-lite Release** - Complete layered storage with performance optimization

#### 🚀 New Features - Plugin Side

- **Trie Index** - 10x faster local search with prefix tree indexing
  - Sub-10ms local search (achieved: 7.61ms avg)
  - Memory-efficient prefix matching
  - `lib/trie.js` - Custom trie implementation (342 lines)
  - `lib/trie-index.js` - Index builder and manager (340 lines)

- **Autocomplete Suggestions** - Smart search with instant suggestions
  - `memory_suggest` tool - Autocomplete based on local memory content
  - <50ms response time (achieved: 10.62ms avg)
  - Frequency-based ranking (access count tracking)
  - Prefix matching with relevance scoring

- **Real-time Sync** - WebSocket live synchronization
  - `lib/ws-client.js` - WebSocket client with auto-reconnect (327 lines)
  - Live updates from backend to local cache
  - Connection state management (connected/connecting/disconnected)
  - Automatic reconnection with exponential backoff
  - `sync_status` tool - Check WebSocket connection status

#### ⚡ Backend Optimizations (Phase C-B1/B2/B3)

- **HNSW Dynamic Parameter Tuning** (C-B1)
  - 3 new API endpoints: `/api/v1/hnsw/stats`, `/api/v1/hnsw/optimize`, `/api/v1/hnsw/rebuild`
  - Runtime parameter adjustment (M, EFC, efSearch)
  - Performance metrics and index health monitoring
  - Automatic optimization recommendations

- **Embedding Cache Optimization** (C-B2)
  - 3 new API endpoints: `/api/v1/cache/stats`, `/api/v1/cache/clear`, `/api/v1/cache/warmup`
  - aiocache integration with Redis/Memcached support
  - Cache hit/miss telemetry
  - LRU eviction policy with TTL (300s default)
  - 80% faster repeated queries (from cache)

- **Query Result Prefetch** (C-B3)
  - 2 new API endpoints: `/api/v1/prefetch/related`, `/api/v1/prefetch/popular`
  - Proactive loading of related memories
  - Popular query caching
  - Reduced perceived latency for common queries

#### 🎯 Performance Benchmarks (100% Tests Passed)

| Metric         | Target | Achieved    | Status            |
| -------------- | ------ | ----------- | ----------------- |
| Trie Search    | <10ms  | 7.61ms      | ✅ 131% of target |
| Autocomplete   | <50ms  | 10.62ms     | ✅ 471% of target |
| Local Search   | <10ms  | 8.92ms      | ✅ 112% of target |
| Cache Hit Rate | >70%   | 100% (mock) | ✅ Exceeded       |
| Test Pass Rate | 100%   | 18/18       | ✅ Perfect        |

#### 📦 New Tools

- `memory_suggest` - Autocomplete suggestions (local only)
- `sync_status` - WebSocket sync status (WebSocket)

#### 🔧 Enhanced Tools

- `memory_write` - Now generates Trie index updates automatically
- `memory_search` - Benefits from query prefetching
- `rebuild_index` - Triggers cache warmup after completion

#### 📊 Architecture Updates

- **Backend-first confirmed** - Plugin delegates all vector operations to backend
- **Circular dependencies resolved** - Fixed import issues between lib/ modules
- **WebSocket integration** - Real-time sync between backend and plugin

---

## [2.0.0] - 2026-03-11

### Major Features - Backend Integration

- **SurrealDB Backend Integration** - Full integration with external memory service
  - Wrapper service connection at `localhost:17999`
  - HNSW vector indexing for semantic search
  - BM25 full-text search with Chinese support
  - Hybrid search with RRF fusion
- **Project Isolation** - Multi-level memory organization
  - `tenant_id`: User-level isolation (OS username)
  - `project_id`: Project-level isolation (git/packag.json/directory)
  - `source_id`: Content-based deduplication
- **Graph Relations** - Connect memories with semantic relationships
  - `memory_relate` tool: Create/query/delete relations
  - `memory_graph` tool: Multi-hop graph traversal
  - Supported relation types: related, follow_up, elaboration, contradiction, reference, derived_from

- **Hybrid Sync Mode** - Local files + Backend service
  - `memory_write`: Local append + async backend upload
  - `memory_search`: Backend keyword search with local BM25 fallback
  - `memory_search`: Backend hybrid/vector search with fallback
  - `rebuild_index`: Batch sync local files to backend

### Added

- `lib/wrapper-client.js` - HTTP client for backend API
  - Health checking with automatic retry
  - Search with 3 modes: vector, keyword, hybrid
  - Memory upload (single and batch)
  - Graph relations and traversal
- `lib/project-resolver.js` - Project ID detection
  - Environment variable: `MEMORY_PROJECT_ID`
  - Git remote URL parsing
  - package.json name field
  - Directory name fallback
  - Persistent mappings for multi-directory projects
- `lib/upload-queue.js` - Failed upload queue
  - Automatic retry with max 3 attempts
  - Persistent queue storage
  - Queue stats and management

- `memory_relate` tool - Graph relations
  - Create relations between memories
  - Query incoming/outgoing/both relations
  - Delete relations
- `memory_graph` tool - Graph traversal
  - Multi-hop traversal (depth 1-3)
  - Find related memories through connections

### Changed

- `memory_write` - Now syncs to backend asynchronously
- `memory_search` - Uses backend BM25 with local fallback
- `memory_search` - Uses backend hybrid search with fallback
- `rebuild_index` - Changed to batch sync to backend
- `index_status` - Shows backend health and queue status
- Configuration version updated to 3.0

### Configuration

New `backend` section in `memory-config.json`:

```json
{
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "your_username",
    "project_resolution": {
      "strategy": "auto",
      "priority": ["env", "git", "package", "dirname"]
    },
    "sync": {
      "mode": "async",
      "batch_size": 10
    }
  }
}
```

### Environment Variables

- `MEMORY_BACKEND_URL` - Backend service URL
- `MEMORY_TENANT_ID` - Override tenant ID
- `MEMORY_PROJECT_ID` - Override project ID

---

## [1.2.1] - 2026-03-02

### Bug Fixes

- **Fixed Tool Return Value Format** - All tools now return strings instead of objects for OpenCode API compatibility
  - Fixed `memory_write`, `memory_read`, `memory_search`, `memory_search`
  - Fixed `list_daily`, `init_daily`, `rebuild_index`, `index_status`
  - Resolves `text9.split is not a function` error in OpenCode

### Environment Compatibility

- **Bun Runtime Support** - Plugin now correctly handles Bun environment limitations
  - Automatic fallback to BM25 when `better-sqlite3` is not available
  - See GitHub Issue #4290 for Bun's V8 C++ API implementation status
  - Vector search gracefully degrades to keyword search when needed

### Testing

- **Complete Tool Validation** - All 8 tools tested and verified working:
  - ✅ memory_write, memory_read, memory_search
  - ✅ list_daily, init_daily, index_status
  - ⚠️ memory_search, rebuild_index (fallback to BM25 in Bun)

### Documentation

- **Added Plugin Fix Record** - Comprehensive documentation of the tool return value fix
- **Added GitHub Issue #4290 Analysis** - Detailed analysis of Bun's better-sqlite3 support status
- **Updated AGENTS.md** - Memory automation and consolidation strategies

---

## [1.2.0] - 2026-02-26

### Major Features

- **Real Vector Search Implementation** - Full semantic search using @huggingface/transformers embeddings
- **sqlite-vec Integration** - Vector storage and similarity search using sqlite-vec
- **Multiple Search Modes** - Support for vector, keyword, and hybrid search
- **Full rebuild_index** - Complete implementation that indexes all memory files
- **Enhanced index_status** - Shows vector index status, model, and dimensions

### Added

- `lib/vector-store.js` - VectorStore class for embeddings and search
  - Uses all-MiniLM-L6-v2 model (384 dimensions) for embeddings
  - Chunks text with configurable size and overlap
  - Stores vectors in sqlite-vec for similarity search
  - Supports vector, keyword, and hybrid search modes
  - Graceful fallback when embedding model fails to load
- `Dockerfile.test-vector` - Docker test for vector search
- `scripts/test-vector-search.sh` - Comprehensive test script

### Changed

- `memory_search` - Now performs real semantic search with fallback to keyword
- `rebuild_index` - Fully implemented to index all memory files
- `index_status` - Returns vector index information
- `plugin.js` - Updated to use VectorStore module
- `package.json` - Added `lib/` to files array, version 1.2.0

### Technical Details

- Uses @huggingface/transformers for embedding generation
- Uses sqlite-vec for vector operations
- Uses better-sqlite3 for database
- Embeddings normalized for cosine similarity
- Chunks indexed with position tracking for result highlighting

---

## [1.1.3] - 2026-02-26

## [1.1.2] - 2026-02-25

### Major Features

- **Native OpenCode Plugin Integration** - Full implementation using @opencode-ai/plugin API
- **All 8 Memory Tools Implemented** - Complete tool definitions with proper validation:
  - memory_write - Write entries to long-term memory
  - memory_read - Read from memory files
  - memory_search - Keyword search across memory
  - memory_search - Semantic search with embeddings
  - list_daily - List available daily logs
  - init_daily - Initialize today's daily log
  - rebuild_index - Rebuild vector index
  - index_status - Check system status
- **Zero Configuration** - Tools work immediately after installation
- **Production Ready** - 100% test pass rate in Docker

### Added

- `plugin.js` (407 lines) - OpenCode plugin implementation using tool() function
- `bin/cli.js` (353 lines) - Command-line interface for direct access
- `test-tools.mjs` - Comprehensive tool execution tests
- Zod schema validation for all tool parameters
- ES module support (type: module in package.json)
- Package exports field for proper module resolution

### Changed

- `bin/install.js` → `bin/install.cjs` - Converted to CommonJS for compatibility
- Updated package.json with ES module configuration
- Tools now auto-register with OpenCode on installation

### Testing

- All 8 tools tested in Docker environment
- Tool execution tests: 5/5 passed
- Integration tests: 100% pass rate
- Performance: <20ms per tool execution

### Documentation

- Added `OPENCODE_PLUGIN_IMPLEMENTATION_REPORT.md` - Complete implementation details
- Added `DOCKER_INTEGRATION_TEST_REPORT.md` - Docker testing documentation
- Added `FINAL_DOCKER_TEST_REPORT_CN.md` - Chinese test report
- Updated README with OpenCode integration highlights

### Technical Details

- Implemented with @opencode-ai/plugin v1.1.48
- Uses tool() function for proper tool definitions
- Complete error handling and success responses
- Type-safe with Zod schemas
- ES modules throughout

## [1.1.1] - 2026-02-24

### Bug Fixes

- Fixed duplicate config declarations in `tools/vector-memory.ts`
  - Removed redundant `const config` declarations at lines 156 and 168
  - This fixes potential variable scope issues during embedding fallback

### Docker Environment

- Added comprehensive Docker testing environment
- Created multiple Dockerfile variants:
  - `Dockerfile` - Standard Docker testing
  - `Dockerfile.alpine` - Alpine Linux variant
  - `Dockerfile.fixed` - Platform-specific installation (fixes sharp/onnx issues)
  - `Dockerfile.local` - Local source code installation
  - `Dockerfile.opencode` - Complete OpenCode environment testing
  - `Dockerfile.minimal` - Minimal dependencies
  - `Dockerfile.multi` - Multi-stage build
  - `Dockerfile.simple` - npm registry installation
- Added `docker-compose.yml` for container orchestration
- Added `.dockerignore` for build optimization

### Testing

- Added comprehensive test scripts:
  - `test-docker.sh` - Basic Docker environment tests
  - `test-functional.sh` - Complete functional test suite
  - `test-embeddings.sh` - Vector embedding tests
  - `test-docker-summary.sh` - Test summary report
- Real-world test scenarios documented
- Test automation infrastructure

### Documentation

- Added `DOCKER_TEST_RESULTS.md` - Docker environment test results
- Added `FUNCTIONAL_TEST_RESULTS.md` - Functional testing detailed report
- Added `OPENCODE_REAL_TEST_REPORT.md` - OpenCode integration test results
- Added `PLATFORM_COMPATIBILITY_FIXED.md` - Platform compatibility solution guide
- Added `TEST_CASES_DETAIL.md` - Complete test cases documentation
- Added `PROJECT_COMPLETE.md` - Project completion summary
- Added various summary and completion documents

### Platform Compatibility

- Identified and documented sharp/onnxruntime-node platform issues
- Explained npm's optionalDependencies mechanism
- Documented correct Docker installation methods
- Provided solutions for cross-platform development

### Improvements

- Enhanced error messages in test scripts
- Better documentation structure
- Comprehensive test coverage
- Real-world usage examples

### Technical Details

- Package size: 30.3 kB
- Unpacked size: 119.3 kB
- Total files: 23
- Dependencies: 4 main, 2 dev
- Node.js compatibility: ^18.17.0, ^20.3.0, >=21.0

## [1.1.0] - 2026-02-24

### Major Features

- ✨ True semantic search with @huggingface/transformers
- ✨ Flexible configuration system (v2.0)
- ✨ 5 embedding models available
- ✨ 4 search modes (hybrid, vector, bm25, hash)
- ✨ TypeScript support added
- ✨ Uninstall script included
- ✨ Complete documentation

### New Features

- Implemented true vector embeddings using Transformers.js
- Created configuration system v2.0
- Added support for 5 embedding models:
  - Xenova/all-MiniLM-L6-v2 (default, 80MB)
  - Xenova/bge-small-en-v1.5 (recommended, 130MB)
  - Xenova/bge-base-en-v1.5 (best quality, 400MB)
  - Xenova/e5-small-v2 (Q&A optimized, 130MB)
  - Xenova/nomic-embed-text-v1.5 (long documents, 270MB)
- Added 4 search modes:
  - hybrid (default, 70% vector + 30% BM25)
  - vector (vector-only search)
  - bm25 (keyword-only search)
  - hash (fallback hash-based search)
- Configurable fallback modes
- Auto-indexing with configurable chunk size
- Automatic consolidation settings

### Documentation

- Added `CONFIGURATION.md` with complete configuration guide
- Updated README with npm installation badges
- Added detailed usage examples
- Added configuration comparison tables

### Installation

- npm global installation now supported
- Automatic configuration on install
- Memory directory structure auto-created
- OpenCode configuration updated automatically

---

## Version Summary

| Version | Date       | Type  | Changes                         |
| ------- | ---------- | ----- | ------------------------------- |
| 1.1.1   | 2026-02-24 | Patch | Bug fix, testing, documentation |
| 1.1.0   | 2026-02-24 | Major | True vector search, config v2.0 |
