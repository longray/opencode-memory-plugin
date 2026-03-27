# OpenCode Memory Plugin

> **OpenClaw-style persistent memory system for OpenCode with native plugin integration and semantic vector search**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/csuwl/opencode-memory-plugin/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@csuwl/opencode-memory-plugin.svg)](https://www.npmjs.com/package/@csuwl/opencode-memory-plugin)
[![Downloads](https://img.shields.io/npm/dt/@csuwl/opencode-memory-plugin.svg)](https://www.npmjs.com/package/@csuwl/opencode-memory-plugin)

[![OpenCode](https://img.shields.io/badge/OpenCode-native%20plugin-success.svg)](https://docs.opencode.ai)
[![External Services](https://img.shields.io/badge/Embedding-External%20Services-blue.svg)](https://github.com/csuwl/opencode-memory-plugin#-external-embedding-service)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/opencode-memory-plugin/blob/main/LICENSE)

## 🔄 Architecture Update (v2.1.0+)

**Plugin Architecture Simplified**: The plugin now uses a **backend-first architecture**:

- ✅ **All vector search** is handled by the backend service (localhost:17999)
- ✅ **No local vector storage** in the plugin (removed better-sqlite3 dependency)
- ✅ **No Bun compatibility issues** - plugin works seamlessly in all runtimes
- ✅ **Simplified codebase** - removed 1300+ lines of vector storage code

**What this means for you**:

- All memory tools work the same way
- `memory_search` supports all search modes (vector/keyword/hybrid) via backend service
- Better performance and reliability
- No need to worry about local vector index management

## 🎯 Features

- ✅ **Native OpenCode Plugin** - Using @opencode-ai/plugin API for seamless integration
- ✅ **16 Memory Tools** - All tools available immediately after installation
- ✅ **v2.3: Dual-Mode Sync** - Incremental (fingerprint-based) + Full sync (with resume)
- ✅ **v2.3: Conflict Resolution** - Detection, auto-resolve, merge, manual resolve
- ✅ **v2.3: Memory Browsing** - Timeline browser and topic explorer
- ✅ **SurrealDB Backend** - External memory service with HNSW vector search
- ✅ **Graph Relations** - Connect memories with semantic relationships
- ✅ **Project Isolation** - Multi-tenant support with tenant_id and project_id
- ✅ **Hybrid Mode** - Local files + Backend service with automatic fallback
- ✅ **Zero Configuration** - Just install and use, no setup required
- ✅ **Auto-Trigger** - Automatically saves important information from conversations
- ✅ **OpenClaw-Style Memory** - Complete 9 core memory files (SOUL, AGENTS, USER, IDENTITY, TOOLS, MEMORY, HEARTBEAT, BOOT, BOOTSTRAP)
- ✅ **Phase C: Trie Index** - 10x faster local search with prefix tree indexing
- ✅ **Phase C: Autocomplete** - Smart search suggestions (<50ms)
- ✅ **Phase C: Real-time Sync** - WebSocket live synchronization

### Available Tools (16)

#### Core Tools (8)

| Tool              | Description                              | Backend Required   |
| ----------------- | ---------------------------------------- | ------------------ |
| `memory_write`    | Write entries to long-term memory        | Syncs to backend   |
| `memory_read`     | Read from memory files                   | Local only         |
| `memory_search`   | All search modes (vector/keyword/hybrid) | Backend + fallback |
| `memory_suggest`  | Autocomplete suggestions                 | Local only         |
| `memory_relate`   | Create/query graph relations             | ✅ Yes             |
| `memory_graph`    | Graph traversal                          | ✅ Yes             |
| `memory_timeline` | Browse memories by date range            | Local only         |
| `memory_topics`   | Browse memories by topic                 | Local only         |

#### Sync Tools (5)

| Tool               | Description                        | Sync Mode        |
| ------------------ | ---------------------------------- | ---------------- |
| `index_status`     | Check system status                | Backend + local  |
| `rebuild_index`    | Sync local files to backend        | ✅ Yes           |
| `incremental_sync` | Fingerprint-based change detection | Smart delta sync |
| `full_sync`        | Full sync with resume support      | Batch + resume   |
| `sync_checkpoint`  | View sync checkpoints              | History control  |

#### Conflict Tools (3)

| Tool               | Description                            | Use Case          |
| ------------------ | -------------------------------------- | ----------------- |
| `conflict_list`    | List detected conflicts                | Review pending    |
| `conflict_resolve` | Resolve conflict (accept/reject/merge) | Manual resolution |
| `batch_resolve`    | Batch resolve conflicts                | Bulk operations   |

### One-Command Installation (Recommended)

```bash
# Install globally
npm install -g @csuwl/opencode-memory-plugin

# That's it! 🎉
# All tools are immediately available in OpenCode
```

## Troubleshooting

**Recommendation:** Continue using the plugin - keyword search is fast and effective for most use cases. Semantic search will be available when Bun is updated.

### Verify Installation

```bash
# Start OpenCode
opencode

# Try using a tool:
# "Use memory_write to save: User prefers TypeScript for new projects"
```

All tools work out of the box - no configuration needed!

### Alternative: Install from Source

```bash
# Clone repository
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin

# Install globally
npm install -g .
```

## 🔍 Search Modes

The plugin supports 4 configurable search modes:

| Mode     | Description             | Speed  | Quality | Backend Required |
| -------- | ----------------------- | ------ | ------- | ---------------- |
| `hybrid` | Vector + BM25 (default) | Medium | ⭐⭐⭐  | ✅ Yes           |
| `vector` | Vector-only             | Medium | ⭐⭐    | ✅ Yes           |
| `bm25`   | BM25-only (keywords)    | Fast   | ⭐⭐    | ❌ No            |
| `hash`   | Hash-based (fallback)   | Fast   | ⭐      | ❌ No            |

**Default**: `hybrid` mode (70% vector + 30% BM25)

## 🧠 Available Embedding Models

The plugin supports multiple embedding options:

### External API Services (Recommended) ⭐

| Provider           | Model                | Dimensions | Size | Quality    | Speed |
| ------------------ | -------------------- | ---------- | ---- | ---------- | ----- |
| **ModelScope API** | Qwen3-Embedding-0.6B | 1024       | 0MB  | ⭐⭐⭐⭐⭐ | ⚡⚡  |
| Custom             | Your choice          | Variable   | 0MB  | ⭐⭐⭐⭐   | ⚡⚡  |

**Setup ModelScope API:**

```bash
export MODELSCOPE_API_KEY='your-api-key-here'
```

### Alternative: Local Service

If you prefer to run your own embedding service:

| Endpoint                            | Model  | Dimensions |
| ----------------------------------- | ------ | ---------- |
| `http://localhost:18000/embeddings` | Custom | Dynamic    |

**Note**: Configure `endpoint` and `model` in config to use local service.

## ⚙️ Configuration

The plugin creates a configuration file at `~/.opencode/memory/memory-config.json`:

### Quick Configuration Examples

**Default (ModelScope API)** - Works out of box:

```json
{
  "search": { "mode": "hybrid" },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B"
  }
}
```

**Fast Search** (No model, keywords only):

```json
{
  "search": { "mode": "bm25" },
  "embedding": { "enabled": false }
}
```

**Local Service** (Custom endpoint):

```json
{
  "search": { "mode": "vector" },
  "embedding": {
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings"
  }
}
```

For complete configuration guide, see [CONFIGURATION.md](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/CONFIGURATION.md).

## 📖 Usage

After installation, all memory tools are available in OpenCode:

### Basic Usage

```bash
# Write to memory
memory_write content="User prefers TypeScript for all new features" type="long-term" tags=["typescript","code-style"]

# Search memory (supports semantic and keyword search)
memory_search query="async patterns"
memory_search query="how do I handle async errors"

# The model understands meaning, not just keywords!

# Check system status
index_status detailed=true

# View sync checkpoints
sync_checkpoint

# Rebuild vector index
rebuild_index force=true
```

### ⚠️ Feature Status

**Fully Implemented:**

- `memory_write` - Save memories to long-term storage
- `memory_read` - Read memory files
- `memory_search` - All search modes (vector/keyword/hybrid) with backend service
- `memory_timeline` - Browse memories by date range
- `memory_topics` - Browse memories by topic
- `rebuild_index` - Rebuild vector index with embeddings
- `index_status` - Check system status including vector index info
- `sync_checkpoint` - View sync checkpoints

**Fallback Behavior:**

- When backend service is unavailable, `memory_search` falls back to local keyword search
- Network access required to connect to backend service endpoint

```bash
# Auto-save important information
@memory-automation review conversation and save important information

# Organize daily logs
@memory-consolidate review and consolidate recent memories
```

### CLI Tool (Bonus Feature)

We also include a CLI tool for command-line access:

```bash
# Write to memory
opencode-memory write "User prefers TypeScript" --type "preference" --tags "typescript,code-style"

# Read memory
opencode-memory read

# Search memory
opencode-memory search "typescript"

# List daily logs
opencode-memory list --days 7

# Check status
opencode-memory status
```

## 📂 Project Structure

```
opencode-memory-plugin/
├── memory/              # Core memory files (OpenClaw style)
│   ├── SOUL.md            # Personality, tone, boundaries
│   ├── AGENTS.md          # Operating instructions
│   ├── USER.md            # User profile
│   ├── IDENTITY.md        # Assistant identity
│   ├── TOOLS.md           # Tool conventions
│   ├── MEMORY.md          # Long-term memory index
│   ├── HEARTBEAT.md       # Health checklist
│   ├── BOOT.md            # Startup checklist
│   ├── BOOTSTRAP.md       # One-time ritual
│   └── timeline/           # Timeline-structured memory entries
│       └── YYYY/MM/DD/     # Date-based memory organization
├── agents/              # Custom OpenCode agents
│   ├── memory-automation.md    # Auto-save agent
│   └── memory-consolidate.md   # Auto-consolidate agent
├── scripts/             # Utility scripts
│   ├── migrate-daily-to-timeline.mjs  # Migration script
│   └── cleanup-memory.mjs      # Memory cleanup utilities
├── lib/                 # Core library files
│   ├── bm25.js            # BM25 keyword search algorithm
│   ├── trie.js            # Trie index for fast search
│   ├── trie-index.js      # Trie index manager
│   ├── wrapper-client.js  # Backend API client
│   ├── project-resolver.js # Project ID detection
│   └── ws-client.js       # WebSocket client
├── bin/                 # CLI and install scripts
│   ├── cli.cjs            # Command-line interface
│   └── install.cjs        # NPM install hook
├── plugin.js            # OpenCode plugin entry
├── index.js             # Plugin metadata
└── package.json         # NPM package config
```

## 🗂️ Memory Architecture (v2.3)

### Timeline-Based Organization

**Major Change in v2.3**: Memory entries now use a timeline-based directory structure:

```
memory/
├── timeline/
│   └── 2026/
│       └── 03/
│           ├── 16/
│           │   ├── entry-001.md
│           │   └── entry-002.md
│           ├── 17/
│           └── 23/
├── SOUL.md, AGENTS.md, USER.md, etc.
└── MEMORY.md (index file)
```

**Benefits**:

- ✅ **Better Organization**: Entries grouped by date for easier browsing
- ✅ **Scalability**: No single directory with thousands of files
- ✅ **Timeline Browser**: `memory_timeline` tool for date-based navigation
- ✅ **Migration**: `scripts/migrate-daily-to-timeline.mjs` for existing users

**Migration from v2.2**:

If upgrading from v2.2 or earlier, run the migration script:

```bash
node scripts/migrate-daily-to-timeline.mjs
```

This will:

1. Scan existing `daily/` directory
2. Parse dates from filenames (YYYY-MM-DD.md)
3. Create new `timeline/YYYY/MM/DD/` structure
4. Move files to appropriate directories
5. Remove empty `daily/` directory

## 🔬 Under the Hood

> **Note**: The following describes the backend service implementation. The plugin itself is now lightweight and delegates all vector operations to the backend service at `localhost:17999`.

### Embedding Service

**Primary Provider**: ModelScope Inference API

- **Endpoint**: `https://api-inference.modelscope.cn/v1/embeddings`
- **Model**: `Qwen/Qwen3-Embedding-0.6B`
- **Dimensions**: 1024
- **Latency**: ~50-100ms per request
- **Inference**: Cloud-based (via HTTP API)
- **Setup**: Set `MODELSCOPE_API_KEY` environment variable

**Fallback Provider**: Local service (optional)

- **Endpoint**: `http://localhost:18000/embeddings`
- **Dimensions**: Dynamically detected from response
- **Latency**: ~50-100ms per request
- **Inference**: Local (via HTTP API)

**Performance**:

- First search: ~50-100ms (network call + inference)
- Subsequent searches: ~50-100ms per query
- Memory usage: ~50-100MB RAM (minimal as embeddings computed externally)

**Default**: `ModelScope API` (0MB, high quality, cloud-based)

### Hybrid Search Algorithm

```
final_score = 0.7 × vector_similarity + 0.3 × bm25_score
```

This combines semantic understanding (70%) with keyword matching (30%) for optimal results.

## 🌐 External Embedding Service

The plugin supports multiple external embedding services:

- **ModelScope API** (Recommended): Cloud-based, high quality, zero setup
  - Set `MODELSCOPE_API_KEY` environment variable
  - Uses `Qwen/Qwen3-Embedding-0.6B` model (1024 dimensions)
  - Best quality with minimal resource usage

- **Custom Local Service**: Connect to any embedding service
  - Change endpoint in configuration file
  - Supports OpenAI-compatible API format
  - Fallback: Automatically falls back to BM25 keyword search if external service unavailable

- **Local Models (Transformers.js)**: Run models locally
  - Multiple pre-configured models available
  - Requires more RAM and CPU
  - Use when internet is unavailable or for privacy

## 📚 Documentation

### Current Version (v2.5.0)

- [Configuration Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/CONFIGURATION.md) - Complete configuration options
- [Architecture Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/ARCHITECTURE.md) - System architecture and data flows
- [Migration Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/MIGRATION_GUIDE.md) - Migrate from v2.2 to v2.3
- [Quick Start Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/QUICK_START.md) - Getting started with external service
- [Troubleshooting Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/TROUBLESHOOTING.md) - Deployment and troubleshooting

### Future Development (v2.0 Design)

- [Design Overview](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/DESIGN_OVERVIEW.md) - SurrealDB integration design overview
- [Architecture Design](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/DESIGN_ARCHITECTURE.md) - Complete system architecture
- [Component Specifications](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/DESIGN_COMPONENTS.md) - Core component details
- [API Specifications](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/DESIGN_API.md) - Wrapper Service API
- [Development Roadmap](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/DESIGN_ROADMAP.md) - Implementation plan

### External Resources

- [OpenCode Docs](https://docs.opencode.ai) - Official OpenCode documentation

We welcome contributions! Here's how you can help:

1. **Report Issues** - Open an issue on GitHub for bugs or feature requests
2. **Submit Pull Requests** - Fork the repository and create a pull request
3. **Improve Documentation** - Help improve README and examples
4. **Update Documentation** - Keep docs synchronized with code changes
5. **Add Features** - Add new tools or agents
6. **Share Ideas** - Suggest improvements or new use cases

### Development Guidelines

- Follow OpenCode plugin conventions
- Use TypeScript for tools
- Test changes thoroughly
- Update documentation with new features
- Respect the memory-first approach

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- OpenClaw team for the memory system design
- OpenCode team for the plugin system
- Hugging Face for Transformers.js and the all-MiniLM-L6-v2 model
- All contributors and users

**Current Version**: v2.5.0

### Latest Release: v2.5.0 (2026-03-27)

**v2.5.0 - Tool Cleanup**:

- ✨ **Tool Count**: 19 → 16 tools
- ✨ **Removed**: `list_daily`, `init_daily`, `sync_status`
- ✨ **Added**: `sync_checkpoint` - View sync checkpoints
- ✨ **Enhanced**: `index_status --detailed` - Pending entries
- ✨ **Bug Fix**: `getStatus()` method added

### Previous Release: v2.4.1 (2026-03-27)

**v2.4.1 - Entry Format Upgrade**:

- ✨ **New Delimiter Format**: `# ≡≡≡ {标题} ≡≡≡` (3x ≡)
- ✨ **Code Block Wrapping**: Content areas wrapped with ```
- ✨ **Meta Field**: Optional `meta` field for arbitrary key-value pairs
- ✨ **CLI Meta Support**: `--meta` parameter for write command

### Previous Release: v2.4.0 (2026-03-26)

**v2.4.0 - L0/L1/L2 Layered Storage**:

- ✨ **Unified ULID Storage**: `entry_{ulid}.md` filename format
- ✨ **Required Layers**: abstract + overview now REQUIRED
- ✨ **Frontmatter Fields**: Added id, memory_id, synced, synced_at
- ✨ **Code Refactoring**: lib/, tools/, cli/ modular architecture

### Previous Release: v2.3.0 (2026-03-20)

**v2.3 Enhanced - Dual-Mode Sync & Conflict Resolution**:

- ✨ **Dual-Mode Sync** - Incremental (fingerprint-based) + Full sync with resume support
- ✨ **Checkpoint Management** - Track sync progress, history, and enable resume after failure
- ✨ **Conflict Detection** - Automatic detection of content conflicts between local and backend
- ✨ **Smart Auto-Resolve** - Automatic resolution for timestamp and simple content conflicts
- ✨ **Manual Conflict Resolution** - Interactive resolve with accept/reject/merge options
- ✨ **Batch Operations** - Batch resolve multiple conflicts efficiently
- ✨ **Memory Browsing** - Timeline browser and topic explorer for historical views
- ✨ **100% Test Pass Rate** - All 28 tests passing (18 Phase C + 10 v2.3)

### Previous Release: v2.2.0 (2026-03-19)

**Phase C Complete - Performance Optimization**:

- ✨ **Trie Index** - 10x faster local search (<10ms)
- ✨ **Autocomplete** - Smart suggestions (<50ms)
- ✨ **Real-time Sync** - WebSocket live synchronization
- ✨ **HNSW Dynamic Tuning** - Runtime parameter optimization
- ✨ **Embedding Cache** - Query result caching (80% faster)
- ✨ **Query Prefetch** - Proactive loading of related memories
- ✨ **100% Test Pass Rate** - All 18 Phase C tests passing
- ✨ **Backend Optimizations** - 8 new API endpoints for performance

### Previous Release: v1.2.0 (2026-02-26)

**New Features**:

- ✨ External embedding services (ModelScope API + local service)
- ✨ Primary: ModelScope Inference API (Qwen3-Embedding-0.6B, 1024 dimensions)
- ✨ Fallback: Local embedding service at localhost:18000
- ✨ BM25 Chinese tokenization optimization (Recall: 0-14% → 82.5%)
- ✨ Dynamic result limits and BM25 thresholds
- ✨ MRR improved by 12.9% (0.7033 → 0.7939)
- ✨ Reduced resource usage (cloud-based embedding)
- ✨ Vector, keyword, and hybrid search modes
- ✨ sqlite-vec for vector storage and similarity search
- ✨ Automatic fallback to BM25 when external services unavailable
- ✨ Full `rebuild_index` implementation for indexing memory files
- ✨ Enhanced `index_status` with vector index information
- ✨ Real vector search with @huggingface/transformers embeddings
- ✨ Vector, keyword, and hybrid search modes
- ✨ sqlite-vec for vector storage and similarity search
- ✨ Automatic fallback to keyword search when embedding model unavailable
- ✨ Full `rebuild_index` implementation for indexing memory files
- ✨ Enhanced `index_status` with vector index information

### Previous Releases

**v1.1.3** (2026-02-26):

- 🐛 Fixed ES Module/CommonJS compatibility
- 🐛 Fixed version mismatch
- 📝 Updated documentation

**v1.1.2** (2026-02-25):

- 🎉 Native OpenCode Plugin Integration
- ✅ All 8 tools implemented

For detailed changes, see [CHANGELOG.md](./CHANGELOG.md).

---

_Your OpenCode instance now has perfect memory with native plugin integration! 🧠✨_
