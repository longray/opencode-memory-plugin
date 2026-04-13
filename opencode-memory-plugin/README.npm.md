# @csuwl/opencode-memory-plugin

> OpenClaw-style persistent memory system for OpenCode with semantic vector search and layered storage

[![npm version](https://img.shields.io/npm/v/@csuwl/opencode-memory-plugin.svg)](https://www.npmjs.com/package/@csuwl/opencode-memory-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Version**: v3.2.0 - WebSocket real-time sync, structured logging, and improved code analysis

## Installation

```bash
# Install globally
npm install -g @csuwl/opencode-memory-plugin

# That's it! All tools are immediately available in OpenCode
```

## Features

- **16 Memory Tools** - Write, read, search, sync, graph relations, and more
- **L0/L1/L2 Layered Storage** - Abstract (≤100 chars), Overview (≤500 chars), Full content
- **Semantic Search** - Vector + BM25 hybrid search via backend service
- **WebSocket Real-Time Sync** - Reliable connection with heartbeat and ACK
- **Dual-Mode Sync** - Incremental (fingerprint-based) + Full sync with resume
- **Conflict Resolution** - Detect and resolve local/backend conflicts
- **Graph Relations** - Connect memories with semantic relationships
- **Memory Browsing** - Timeline browser and topic explorer
- **Project Isolation** - Multi-tenant support with tenant_id and project_id
- **Code Analysis** - Automatic AST analysis on file save (JavaScript, TypeScript, Python, Go, Rust, Java)
- **Structured Logging** - Pino-based logging with JSON and pretty print modes
- **Zero Configuration** - Just install and use

## Available Tools (16)

### Core Tools (9)

| Tool              | Description                          |
| ----------------- | ------------------------------------ |
| `memory_write`    | Write entries to long-term memory    |
| `memory_read`     | Read from memory files (level 0/1/2) |
| `memory_pin`      | Pin/unpin important entries          |
| `memory_search`   | Search (vector/keyword/hybrid)       |
| `memory_suggest`  | Autocomplete suggestions             |
| `memory_relate`   | Create/query graph relations         |
| `memory_graph`    | Graph traversal                      |
| `memory_timeline` | Browse memories by date range        |
| `memory_topics`   | Browse memories by topic             |

### Sync Tools (5)

| Tool               | Description                        |
| ------------------ | ---------------------------------- |
| `index_status`     | Check system status                |
| `rebuild_index`    | Sync local files to backend        |
| `incremental_sync` | Fingerprint-based change detection |
| `full_sync`        | Full sync with resume support      |
| `sync_checkpoint`  | View sync checkpoints              |

### Conflict Tools (2)

| Tool               | Description                            |
| ------------------ | -------------------------------------- |
| `conflict_list`    | List detected conflicts                |
| `conflict_resolve` | Resolve conflict (accept/reject/merge) |

## Configuration

The plugin creates a configuration file at `~/.opencode/memory/memory-config.json`.

### Backend Authentication

```bash
# Required for backend features (search, sync, graph)
export WRAPPER_MEILI_API_KEY="your-api-key-here"
```

### Quick Configuration

**Default (hybrid search)**:

```json
{
  "search": { "mode": "hybrid" },
  "backend": { "enabled": true }
}
```

**Keywords only (no backend)**:

```json
{
  "search": { "mode": "keyword" },
  "backend": { "enabled": false }
}
```

## Memory Files

Memory files are located at `~/.opencode/memory/`:

- `SOUL.md` - AI personality and boundaries
- `AGENTS.md` - Operating instructions
- `USER.md` - User profile and preferences
- `IDENTITY.md` - Assistant identity
- `TOOLS.md` - Tool usage conventions
- `MEMORY.md` - Long-term memory index
- `memory-config.json` - Plugin configuration
- `timeline/YYYY/MM/DD/` - Date-based memory entries

## Documentation

- [Full README](https://github.com/csuwl/opencode-memory-plugin#readme) - Complete documentation
- [Configuration Guide](https://github.com/csuwl/opencode-memory-plugin/blob/main/opencode-memory-plugin/CONFIGURATION.md) - All configuration options
- [Changelog](https://github.com/csuwl/opencode-memory-plugin/blob/main/CHANGELOG.md) - Version history

## License

MIT
