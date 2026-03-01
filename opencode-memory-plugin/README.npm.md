# @csuwl/opencode-memory-plugin

> OpenClaw-style persistent memory system for OpenCode with **external embedding services** and semantic vector search

## Installation

```bash
# Install latest version
npm install @csuwl/opencode-memory-plugin -g

# Or install a specific version
npm install -g @csuwl/opencode-memory-plugin@1.2.0

# Or install locally without -g
npm install @csuwl/opencode-memory-plugin
```

The plugin will be automatically configured for you!

## Features

- 9 core memory files (OpenClaw-style)
- 8 memory tools (write, read, search, vector search)
- 2 automation agents (auto-save, auto-consolidate)
- Daily memory logs with automatic consolidation
- **Semantic search** using external embedding services (ModelScope API + local service)
- **Multiple search modes**: hybrid, vector-only, bm25-only, hash-only
- **Flexible deployment**: Cloud-based ModelScope API with local service fallback
- **BM25 Chinese tokenization optimization** for better keyword search

## Configuration

The plugin supports flexible configuration via `~/.opencode/memory/memory-config.json`.

### Quick Configuration Examples

**Default (Recommended)** - ModelScope API:
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

**Local Service** - Custom endpoint:
```json
{
  "search": { "mode": "vector" },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/v1/embeddings"
  }
}
```

**Fast Search** - Keywords only (no embedding):
```json
{
  "search": { "mode": "bm25" },
  "embedding": { "enabled": false }
}
```

### External Embedding Services

| Service | Model | Dimensions | Quality | Resource | Speed |
|---------|-------|------------|---------|----------|-------|
| **ModelScope API** ⭐ | Qwen3-Embedding-0.6B | 1024 | ⭐⭐⭐⭐⭐ | Cloud (0MB) | ⚡⚡ |
| Local Service | Custom | Dynamic | ⭐⭐⭐⭐ | Local RAM | ⚡⚡ |

**ModelScope API Setup**:
1. Get API key from [ModelScope](https://modelscope.cn/)
2. Set environment variable: `export MODELSCOPE_API_KEY='your-api-key'`
3. Plugin will automatically use ModelScope API when available

### Search Modes

| Mode | Description | Speed | Quality | Model Required |
|------|-------------|-------|---------|----------------|
| `hybrid` | Vector + BM25 (70% + 30%) | Medium | ⭐⭐⭐⭐ | Yes |
| `vector` | Vector-only | Medium | ⭐⭐⭐ | Yes |
| `bm25` | Keywords only | Fast | ⭐⭐ | No |
| `hash` | Hash fallback | Fast | ⭐ | No |

**Default**: `hybrid` mode (combines semantic understanding with keyword matching)

See [CONFIGURATION.md](https://github.com/csuwl/opencode-memory-plugin/blob/main/CONFIGURATION.md) for details.

## Usage

After installation, all memory tools are available in OpenCode:

```bash
# Write to memory
memory_write content="User prefers TypeScript" type="long-term"

# Search memory
memory_search query="typescript"

# Semantic search (uses ModelScope API or local service)
vector_memory_search query="how to handle errors"

# List daily logs
list_daily days=7
```

## What's New in v1.2.0

✨ **External Embedding Services**
- Primary: ModelScope Inference API (Qwen3-Embedding-0.6B)
- Fallback: Local embedding service at localhost:18000
- Automatic fallback to BM25 when services unavailable
- 1024-dimensional vectors for better semantic understanding

✨ **Improved Search Quality**
- BM25 Chinese tokenization optimization (Recall: 0-14% → 82.5%)
- Dynamic result limits and BM25 thresholds
- MRR improved by 12.9%

✨ **Enhanced Performance**
- Reduced resource usage (cloud-based embedding)
- Faster indexing and search response times
- Better error handling and user feedback

## Configuration

Memory files are located at `~/.opencode/memory/`:

- `SOUL.md` - AI personality and boundaries
- `AGENTS.md` - Operating instructions
- `USER.md` - User profile and preferences
- `IDENTITY.md` - Assistant identity
- `TOOLS.md` - Tool usage conventions
- `MEMORY.md` - Long-term memory
- `memory-config.json` - **Plugin configuration**
- And more...

## Documentation

- **[CONFIGURATION.md](https://github.com/csuwl/opencode-memory-plugin/blob/main/CONFIGURATION.md)** - Complete configuration guide
- **[EXTERNAL_EMBEDDING.md](https://github.com/csuwl/opencode-memory-plugin/blob/main/EXTERNAL_EMBEDDING.md)** - External service setup guide
- **[ARCHITECTURE.md](https://github.com/csuwl/opencode-memory-plugin/blob/main/ARCHITECTURE.md)** - System architecture
- [Full Documentation](https://github.com/csuwl/opencode-memory-plugin) - Project README

## License

MIT
