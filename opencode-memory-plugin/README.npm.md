# @csuwl/opencode-memory-plugin

> OpenClaw-style persistent memory system for OpenCode with **flexible configuration** for embedding models and search modes

## Installation

```bash
# Install latest version
npm install @csuwl/opencode-memory-plugin -g

# Or install a specific version
npm install -g @csuwl/opencode-memory-plugin@1.1.0

# Or install locally without -g
npm install @csuwl/opencode-memory-plugin
```

The plugin will be automatically configured for you!

## Features

- 9 core memory files (OpenClaw-style)
- 8 memory tools (write, read, search, vector search)
- 2 automation agents (auto-save, auto-consolidate)
- Daily memory logs with automatic consolidation
- **Configurable semantic search** using @huggingface/transformers
- **Multiple search modes**: hybrid, vector-only, bm25-only, hash-only
- **Multiple embedding models**: all-MiniLM-L6-v2, bge-small-en-v1.5, bge-base-en-v1.5, and more
- **100% local** - No API calls, models auto-download on first use

## Configuration

The plugin supports flexible configuration via `~/.opencode/memory/memory-config.json`.

### Quick Configuration Examples

**Default (Balanced)** - Works out of the box:
```json
{
  "search": { "mode": "hybrid" },
  "embedding": {
    "model": "Xenova/bge-small-en-v1.5"
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

**High Quality** (Best model):
```json
{
  "search": { "mode": "vector" },
  "embedding": {
    "model": "Xenova/bge-base-en-v1.5"
  }
}
```

**Resource-Constrained** (Smallest model):
```json
{
  "search": { "mode": "vector" },
  "embedding": {
    "model": "Xenova/all-MiniLM-L6-v2"
  }
}
```

### Available Search Modes

| Mode | Description | Speed | Quality | Model Required |
|------|-------------|-------|---------|----------------|
| `hybrid` | Vector + BM25 (best) | Medium | ⭐⭐⭐⭐ | Yes |
| `vector` | Vector-only | Medium | ⭐⭐⭐ | Yes |
| `bm25` | Keywords only | Fast | ⭐⭐ | No |
| `hash` | Hash fallback | Fast | ⭐ | No |

### Available Embedding Models

| Model | Size | Quality | Speed | Best For |
|-------|------|---------|-------|----------|
| `Xenova/all-MiniLM-L6-v2` | 80MB | Good | ⚡⚡⚡ | Baseline |
| `Xenova/bge-small-en-v1.5` ⭐ | 130MB | Excellent | ⚡⚡ | **Best balance** |
| `Xenova/bge-base-en-v1.5` | 400MB | Best | ⚡⚡ | High quality |
| `Xenova/gte-small` | 70MB | Very Good | ⚡⚡⚡ | Small + fast |

See [CONFIGURATION.md](https://github.com/csuwl/opencode-memory-plugin/blob/main/CONFIGURATION.md) for details.

## Usage

After installation, all memory tools are available in OpenCode:

```bash
# Write to memory
memory_write content="User prefers TypeScript" type="long-term"

# Search memory
memory_search query="typescript"

# Semantic search (respects your config)
vector_memory_search query="how to handle errors"

# List daily logs
list_daily days=7
```

## What's New in v1.1.0

✨ **Flexible Configuration System**
- Choose from 5 embedding models (small to large)
- 4 search modes (hybrid, vector, bm25, hash)
- Configurable quality vs speed tradeoffs
- Easy fallback to keyword-only search

✨ **True Semantic Search**
- Real vector embeddings using Transformers.js
- Understands meaning, not just keywords
- Works 100% offline after model download

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
- [Full Documentation](https://github.com/csuwl/opencode-memory-plugin) - Project README

## License

MIT
