# OpenCode Memory Plugin

> **OpenClaw-style persistent memory system for OpenCode with native plugin integration and semantic vector search**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/csuwl/opencode-memory-plugin/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@csuwl/opencode-memory-plugin.svg)](https://www.npmjs.com/package/@csuwl/opencode-memory-plugin)
[![Downloads](https://img.shields.io/npm/dt/@csuwl/opencode-memory-plugin.svg)](https://www.npmjs.com/package/@csuwl/opencode-memory-plugin)

[![OpenCode](https://img.shields.io/badge/OpenCode-native%20plugin-success.svg)](https://docs.opencode.ai)
[![Transformers.js](https://img.shields.io/badge/Transformers.js-3.8.1-orange.svg)](https://huggingface.co/docs/transformers.js)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://github.com/opencode-memory-plugin/blob/main/LICENSE)

## 🎯 Features

- ✅ **Native OpenCode Plugin** - Using @opencode-ai/plugin API for seamless integration
- ✅ **8 Memory Tools** - All tools available immediately after installation
- ✅ **Zero Configuration** - Just install and use, no setup required
- ✅ **OpenClaw-Style Memory** - Complete 9 core memory files (SOUL, AGENTS, USER, IDENTITY, TOOLS, MEMORY, HEARTBEAT, BOOT, BOOTSTRAP)
- ✅ **Keyword Search** - Fast text-based search across all memory files

  ### Available Tools (8)

| Tool | Description | Status |
  |------|-------------|--------|
  | `memory_write` | Write entries to long-term memory | ✅ Working |
  | `memory_read` | Read from memory files | ✅ Working |
  | `memory_search` | Keyword search across memory | ✅ Working |
  | `vector_memory_search` | Semantic search with embeddings | ✅ Working |
  | `list_daily` | List available daily logs | ✅ Working |
  | `init_daily` | Initialize today's daily log | ✅ Working |
  | `rebuild_index` | Rebuild vector index | ✅ Working |
  | `index_status` | Check system status | ✅ Working |

*Note: `vector_memory_search` supports vector, keyword, and hybrid search modes. When embedding model is unavailable, it falls back to keyword search.

### One-Command Installation (Recommended)

```bash
# Install globally
npm install -g @csuwl/opencode-memory-plugin

# That's it! 🎉
# All tools are immediately available in OpenCode
```

**What happens automatically**:
- ✅ Creates memory directory (`~/.opencode/memory/`)
- ✅ Copies all 9 core memory files
- ✅ Generates configuration (v2.0)
- ✅ **Registers 8 tools with OpenCode**
- ✅ Tools ready to use immediately

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

| Mode | Description | Speed | Quality | Model Required |
|------|-------------|-------|---------|----------------|
| `hybrid` | Vector + BM25 (default) | Medium | ⭐⭐⭐⭐ | ✅ Yes (External Service) |
| `vector` | Vector-only | Medium | ⭐⭐⭐ | ✅ Yes (External Service) |
| `bm25` | BM25-only (keywords) | Fast | ⭐⭐ | ❌ No |
| `hash` | Hash-based (fallback) | Fast | ⭐ | ❌ No |
**Default**: `hybrid` mode (70% vector + 30% BM25)

## 🧠 Available Embedding Models

The plugin supports multiple embedding options:

### External API Services (Recommended) ⭐

| Provider | Model | Dimensions | Size | Quality | Speed |
|----------|-------|------------|------|---------|-------|
| **ModelScope API** | Qwen3-Embedding-0.6B | 1024 | 0MB | ⭐⭐⭐⭐⭐ | ⚡⚡ |
| Custom | Your choice | Variable | 0MB | ⭐⭐⭐⭐ | ⚡⚡ |

**Setup ModelScope API:**
```bash
export MODELSCOPE_API_KEY='your-api-key-here'
```

### Alternative: Local Service

If you prefer to run your own embedding service:

| Endpoint | Model | Dimensions |
|----------|-------|------------|
| `http://localhost:18000/embeddings` | Custom | Dynamic |

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

# Search memory
memory_search query="async patterns"

# Semantic search (NEW: uses real embeddings!)
vector_memory_search query="how do I handle async errors"

# The model understands meaning, not just keywords!

# List recent daily logs
list_daily days=7

# Initialize today's log
init_daily

# Rebuild vector index
rebuild_index force=true
```

### ⚠️ Feature Status

**Fully Implemented:**
- `memory_write` - Save memories to long-term storage
- `memory_read` - Read memory files
- `memory_search` - Keyword-based text search
- `vector_memory_search` - Semantic search with embeddings (vector, keyword, hybrid modes)
- `list_daily` - List daily log files
- `init_daily` - Create today's daily log
- `rebuild_index` - Rebuild vector index with embeddings
- `index_status` - Check system status including vector index info

**Fallback Behavior:**
- When external embedding service is unavailable, `vector_memory_search` falls back to keyword search
- Network access required to connect to external service endpoint

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
│   ├── MEMORY.md          # Long-term memory
│   ├── HEARTBEAT.md       # Health checklist
│   ├── BOOT.md            # Startup checklist
│   ├── BOOTSTRAP.md       # One-time ritual
│   └── daily/             # Daily logs
├── agents/              # Custom OpenCode agents
│   ├── memory-automation.md    # Auto-save agent
│   └── memory-consolidate.md   # Auto-consolidate agent
├── scripts/             # Utility scripts
│   ├── init.sh             # Installation script
│   ├── docker-init.sh     # Docker setup
│   ├── uninstall.sh        # Uninstall script
│   └── test-memory-functions.sh # Test script
├── lib/                 # Core library files
│   ├── vector-store.js    # Vector storage and external API integration
│   ├── bm25.js            # BM25 keyword search algorithm
│   └── service-validator.js # External service validation utility
├── bin/                 # CLI and install scripts
│   ├── cli.cjs            # Command-line interface
│   └── install.cjs        # NPM install hook
├── plugin.js            # OpenCode plugin entry
├── index.js             # Plugin metadata
└── package.json         # NPM package config
```

## 🔬 Under the Hood

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

- [Configuration Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/CONFIGURATION.md) - Complete configuration options
- [Architecture Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/ARCHITECTURE.md) - System architecture and data flows
- [Quick Start Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/QUICK_START.md) - Getting started with external service
- [Troubleshooting Guide](https://github.com/opencode-memory-plugin/blob/main/opencode-memory-plugin/TROUBLESHOOTING.md) - Deployment and troubleshooting
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

**Current Version**: v1.2.0

### Latest Release: v1.2.0 (2026-02-26)

**New Features**:
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

*Your OpenCode instance now has perfect memory with native plugin integration! 🧠✨*
