# Configuration Guide (v2.9.0)

OpenCode Memory Plugin supports flexible configuration for embedding models, search modes, sync settings, and timeline structure.

## Configuration File Location

`~/.opencode/memory/memory-config.json`

## Quick Start

The plugin works out of the box with sensible defaults. You only need to customize if you want to:

- Use a different embedding model
- Change search mode (hybrid, vector-only, bm25-only, hash-only)
- Configure sync settings (incremental vs full sync)
- Adjust timeline structure
- Configure conflict resolution behavior

## Configuration Version

```json
{
  "version": "3.0"
}
```

**Note**: Version 3.0 is for v3.0+ with timeline structure and dual-mode sync.

## Configuration Options

### Search Mode

Controls how search results are ranked and combined.

```json
{
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  }
}
```

**Available Modes:**

| Mode     | Description             | Best For             | Requires Model |
| -------- | ----------------------- | -------------------- | -------------- |
| `hybrid` | Vector + BM25 (default) | Best quality         | ✅ Yes         |
| `vector` | Vector-only             | Pure semantic search | ✅ Yes         |
| `bm25`   | BM25-only               | Fast keyword search  | ❌ No          |
| `hash`   | Hash-based              | Emergency fallback   | ❌ No          |

**Hybrid Weights:**

- `vectorWeight`: How much to weight semantic similarity (0.0-1.0, default 0.7)
- `bm25Weight`: How much to weight keyword matching (0.0-1.0, default 0.3)
- Must sum to 1.0 (will be normalized if not)

### Embedding Configuration

Controls which model to use for generating embeddings.

```json
{
  "embedding": {
    "enabled": true,
    "provider": "external", // external API service (ModelScope or custom)
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings", // Default: ModelScope API
    "model": "Qwen/Qwen3-Embedding-0.6B", // Default model for ModelScope
    "fallbackMode": "bm25", // Use BM25 as fallback
    "cache": {
      "enabled": false // No caching for external service
    }
  }
}
```

**Options:**

- `enabled`: Enable/disable embeddings (boolean)
- `provider`: `'external'` for external API services
- `endpoint`: URL of external embedding service
- `model`: Model identifier for external service
- `fallbackMode`: What to do if external service fails (`"hash"`, `"bm25"`, or `"error"`)

### Environment Variables

The plugin supports environment variables for external API configuration:

```bash
# ModelScope API Key (recommended)
export MODELSCOPE_API_KEY='your-modelscope-api-key'

# Windows PowerShell
$env:MODELSCOPE_API_KEY='your-modelscope-api-key'

# Windows CMD
set MODELSCOPE_API_KEY=your-modelscope-api-key
```

**Note**: When `MODELSCOPE_API_KEY` is set, the plugin will automatically use ModelScope Inference API with the `Qwen/Qwen3-Embedding-0.6B` model.

### Available Embedding Models

#### External API Services (Recommended)

| Provider       | Endpoint                    | Model                | Dimensions | Quality    | Speed |
| -------------- | --------------------------- | -------------------- | ---------- | ---------- | ----- |
| **ModelScope** | api-inference.modelscope.cn | Qwen3-Embedding-0.6B | 1024       | ⭐⭐⭐⭐⭐ | ⚡⚡  |
| Custom         | Your endpoint               | Custom               | Variable   | ⭐⭐⭐⭐   | ⚡⚡  |

**Recommendation**: Use ModelScope API for best quality with minimal resource usage.

### Indexing Configuration

Controls how text is chunked for indexing.

```json
{
  "indexing": {
    "chunkSize": 400,
    "chunkOverlap": 80,
    "autoRebuild": true
  }
}
```

**Options:**

- `chunkSize`: Target chunk size in tokens (100-2000, default 400)
- `chunkOverlap`: Overlap between chunks (0 to chunkSize, default 80)
- `autoRebuild`: Automatically rebuild index when needed

## Example Configurations

### Fast Search (No Model, Keywords Only)

```json
{
  "version": "3.0",
  "search": {
    "mode": "bm25"
  },
  "embedding": {
    "enabled": false
  }
}
```

### High Quality Search

```json
{
  "version": "3.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.8,
        "bm25Weight": 0.2
      }
    }
  },
  "embedding": {
    "enabled": true,
    "model": "Qwen/Qwen3-Embedding-0.6B"
  }
}
```

### Resource-Constrained (Small Model, Pure Vector)

```json
{
  "version": "3.0",
  "search": {
    "mode": "vector"
  },
  "embedding": {
    "enabled": true,
    "model": "Qwen/Qwen3-Embedding-0.6B"
  }
}
```

### Maximum Quality (Large Model)

```json
{
  "version": "3.0",
  "search": {
    "mode": "vector"
  },
  "embedding": {
    "enabled": true,
    "model": "Qwen/Qwen3-Embedding-0.6B"
  }
}
```

## Switching Models

When you switch to a different model, you'll need to rebuild the index:

```bash
# 1. Update config
nano ~/.opencode/memory/memory-config.json

# 2. Rebuild index
rebuild_index force=true

# 3. Test
memory_search query="test search"
```

**Note:** Different models have different dimensions. You must rebuild the index when switching models.

## Performance Comparison

| Configuration      | First Search | Subsequent | RAM    | Quality              |
| ------------------ | ------------ | ---------- | ------ | -------------------- |
| BM25-only          | <1ms         | <1ms       | ~50MB  | ⭐⭐ Keywords        |
| Hash-only          | ~5ms         | ~5ms       | ~50MB  | ⭐ Poor              |
| **ModelScope API** | ~50-100ms    | ~50-100ms  | ~50MB  | ⭐⭐⭐⭐⭐           |
| Vector (small)     | 2-3s         | ~50ms      | ~200MB | ⭐⭐⭐ Good          |
| Vector (large)     | 3-5s         | ~100ms     | ~500MB | ⭐⭐⭐⭐⭐ Excellent |
| Hybrid (small)     | 2-3s         | ~60ms      | ~200MB | ⭐⭐⭐⭐ Best        |

**Recommendation**: Use ModelScope API for best quality-performance ratio.

---

## Code Analysis Configuration

The code analysis feature automatically analyzes code files on save and stores the structure in memory.

### Enable/Disable

```json
{
  "code_analysis": {
    "enabled": true
  }
}
```

**Options**:

- `enabled`: Enable or disable code analysis (default: `true`)

### Exclude Patterns

```json
{
  "code_analysis": {
    "exclude_patterns": ["node_modules", ".git", "dist", "build", "coverage", ".min.js"]
  }
}
```

**Options**:

- `exclude_patterns`: Directory and file patterns to exclude (default: common directories)
- Supports glob patterns

### Batch Settings

```json
{
  "code_analysis": {
    "batch_max_size": 10,
    "batch_delay_ms": 2000,
    "debounce_ms": 300
  }
}
```

**Options**:

- `batch_max_size`: Maximum files per batch upload (default: `10`)
- `batch_delay_ms`: Delay before batch upload in milliseconds (default: `2000`)
- `debounce_ms`: Debounce time after file save in milliseconds (default: `300`)

### Complete Example

```json
{
  "version": "3.0",
  "code_analysis": {
    "enabled": true,
    "exclude_patterns": ["node_modules", ".git", "dist", "build"],
    "batch_max_size": 10,
    "batch_delay_ms": 2000,
    "debounce_ms": 300
  }
}
```

### Supported Languages

| Language   | Extensions                    | Analyzed Content                      |
| ---------- | ----------------------------- | ------------------------------------- |
| JavaScript | `.js`, `.mjs`, `.cjs`         | Functions, Classes, Imports, Exports  |
| TypeScript | `.ts`, `.mts`, `.cts`, `.tsx` | Functions, Classes, Interfaces, Types |
| Python     | `.py`                         | Functions, Classes, Imports           |
| Go         | `.go`                         | Functions, Types, Imports             |
| Rust       | `.rs`                         | Functions, Structs, Traits, Modules   |
| Java       | `.java`                       | Classes, Methods, Fields, Imports     |

**See [`CODE-ANALYSIS.md`](./CODE-ANALYSIS.md) for detailed documentation.**

## Troubleshooting

### ModelScope API Issues

**API Key Not Set:**

```bash
# Check if set
echo $MODELSCOPE_API_KEY

# Set it (Linux/Mac)
export MODELSCOPE_API_KEY='your-key'

# Windows PowerShell
$env:MODELSCOPE_API_KEY='your-key'

# Windows CMD
set MODELSCOPE_API_KEY=your-key
```

**Connection Errors:**

- Check your internet connection
- Verify API key is valid
- Check ModelScope service status
- System will fall back to BM25 keyword search

### Local Model Issues

**Model Download Fails:**

```json
{
  "embedding": {
    "fallbackMode": "bm25"
  }
}
```

This will use keyword-only search instead of failing.

**Out of Memory Errors:**

1. Switch to ModelScope API (recommended)
2. Or switch to a smaller model (`all-MiniLM-L6-v2`)
3. Or disable embeddings entirely (`enabled: false`)
4. Or use BM25-only search mode

**Slow Search:**
For faster searches:

1. Use BM25-only mode (`mode: "bm25"`)
2. Use ModelScope API instead of local models
3. Use a smaller model
4. Reduce chunk size (faster indexing)

## Bun Runtime Configuration

If you're running OpenCode in Bun, there are some special considerations:

### Automatic Configuration

The plugin will automatically detect Bun and configure itself accordingly:

```json
{
  "version": "3.0",
  "search": {
    "mode": "bm25" // Automatically set in Bun
  },
  "embedding": {
    "enabled": true,
    "fallbackMode": "bm25" // Automatic fallback to BM25
  }
}
```

### Limitations in Bun

**What Works:**

- ✅ All 8 memory tools
- ✅ BM25 keyword search (fast and effective)
- ✅ Full memory persistence
- ✅ All automation agents

**What Doesn't Work:**

- ⚠️ Local vector storage (plugin now uses backend service instead)

**Note:** The plugin v2.1.0+ uses backend-first architecture. All vector operations are handled by the backend service at localhost:17999, eliminating Bun compatibility issues.

**Status:** See [GitHub Issue #4290](https://github.com/oven-sh/bun/issues/4290) for implementation progress.

**Recommendation:**

- Continue using the plugin - all basic functionality works
- Keyword search is fast and effective for most use cases
- Vector search will be automatically restored when Bun adds V8 C++ API support

### Performance in Bun

| Operation     | Time  | Notes                      |
| ------------- | ----- | -------------------------- |
| BM25 search   | <1ms  | Very fast keyword matching |
| memory_write  | <10ms | File append operation      |
| memory_read   | <5ms  | File read operation        |
| Index rebuild | <5s   | BM25-only indexing         |

## Migration from v1.0

The plugin automatically supports v1.0 configs. To upgrade to v3.0:

```bash
# Backup current config
cp ~/.opencode/memory/memory-config.json ~/.opencode/memory/memory-config.json.backup

# Reinstall plugin to get v3.0 defaults
npm install @csuwl/opencode-memory-plugin@latest -g

# Customize as needed
nano ~/.opencode/memory/memory-config.json
```

## Advanced: Custom Embedding Models

You can use any custom embedding model via external API:

```json
{
  "embedding": {
    "provider": "custom",
    "endpoint": "https://your-api-endpoint/v1/embeddings",
    "model": "your-custom-model-name",
    "apiKey": "your-api-key"
  }
}
```

**Example: Using a custom API service**

```json
{
  "embedding": {
    "enabled": true,
    "provider": "custom",
    "endpoint": "https://api.yourcompany.com/embeddings",
    "model": "custom-embedding-v1",
    "fallbackMode": "bm25"
  }
}
```

Then rebuild the index with `rebuild_index force=true`.

## Auto-Trigger Configuration

Controls automatic memory saving when conversations reach certain thresholds.

```json
{
  "auto_trigger": {
    "enabled": true,
    "timeout_ms": 30000,
    "cooldown_ms": 300000,
    "max_queue_size": 10,
    "skip_sensitive": true,
    "debug_logging": false
  }
}
```

**Options:**

- `enabled`: Enable/disable auto-trigger (default: true)
- `timeout_ms`: Max time for memory-automation agent (default: 30000ms)
- `cooldown_ms`: Min time between triggers for same session (default: 300000ms / 5 minutes)
- `max_queue_size`: Max concurrent auto-trigger operations (default: 10)
- `skip_sensitive`: Skip sessions with sensitive info (passwords, API keys) (default: true)
- `debug_logging`: Output debug logs to ~/.opencode/memory/auto-trigger.log (default: false)

**Trigger Conditions:**

Auto-trigger activates when ALL conditions are met:

- New messages >= 8 (since last trigger)
- New user messages >= 5 (since last trigger)
- Total characters >= 400
- Session duration >= 5 minutes
- Has tool usage OR code blocks OR long replies
- No test keywords in short conversations

---

## v3.0 Configuration Options

### Backend Configuration (NEW)

Controls connection to SurrealDB backend service.

```json
{
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "auto",
    "project_id": "auto",
    "project_resolution": {
      "strategy": "auto",
      "priority": ["config", "git", "package", "dirname"]
    },
    "sync": {
      "mode": "incremental",
      "auto_sync": true,
      "batch_size": 50
    },
    "health_check": {
      "enabled": true,
      "interval_ms": 60000,
      "timeout_ms": 5000
    }
  }
}
```

**Options:**

- `enabled`: Enable/disable backend integration (default: true)
- `url`: Backend service URL (default: `http://localhost:17999`)
- `tenant_id`: User/tenant identifier
  - `"auto"`: Use OS username
  - Custom string: Use provided value
- `project_id`: Project identifier
  - `"auto"`: Resolve automatically (see `project_resolution`)
  - Custom string: Use provided value

**Project Resolution Strategy:**

| Priority | Method    | Description                        |
| -------- | --------- | ---------------------------------- |
| 1        | `config`  | Use `project_id` from config file  |
| 2        | `git`     | Parse git remote URL               |
| 3        | `package` | Use `name` field from package.json |
| 4        | `dirname` | Use directory name                 |

**Sync Configuration:**

- `mode`: Sync mode
  - `"incremental"`: Only sync changes (fingerprint-based)
  - `"full"`: Full sync (all entries)
- `auto_sync`: Automatically sync on changes (default: true)
- `batch_size`: Batch size for full sync (default: 50)

### Timeline Configuration (NEW)

Controls timeline-based memory organization.

```json
{
  "timeline": {
    "enabled": true,
    "base_path": "memory/timeline",
    "date_format": "YYYY/MM/DD",
    "auto_create": true,
    "cleanup": {
      "enabled": false,
      "retention_days": 365
    }
  }
}
```

**Options:**

- `enabled`: Use timeline structure (default: true)
- `base_path`: Base directory for timeline (default: `memory/timeline`)
- `date_format`: Date directory format (default: `YYYY/MM/DD`)
- `auto_create`: Automatically create date directories (default: true)
- `cleanup.retention_days`: Days to keep old entries (0 = forever)

### Conflict Resolution Configuration (NEW)

Controls automatic conflict resolution behavior.

```json
{
  "conflict": {
    "auto_resolve": true,
    "strategies": {
      "timestamp_diff": "latest",
      "content_diff": "longer",
      "metadata_diff": "merge"
    },
    "manual_timeout_hours": 168
  }
}
```

**Options:**

- `auto_resolve`: Enable automatic conflict resolution (default: true)
- `strategies`: Resolution strategies by conflict type
  - `timestamp_diff`:
    - `"latest"`: Most recent timestamp wins (default)
    - `"local"`: Always prefer local
    - `"backend"`: Always prefer backend
  - `content_diff`:
    - `"longer"`: Longer content wins (default)
    - `"local"`: Always prefer local
    - `"backend"`: Always prefer backend
  - `metadata_diff`:
    - `"merge"`: Merge metadata (default)
    - `"local"`: Use local metadata
    - `"backend"`: Use backend metadata
- `manual_timeout_hours`: Hours before auto-resolving manual conflicts (default: 168 / 7 days)

### WebSocket Configuration (NEW)

Controls real-time sync with backend.

```json
{
  "websocket": {
    "enabled": true,
    "url": "ws://localhost:17999/ws",
    "reconnect": {
      "enabled": true,
      "max_attempts": 10,
      "initial_delay_ms": 1000,
      "max_delay_ms": 30000
    }
  }
}
```

**Options:**

- `enabled`: Enable WebSocket real-time sync (default: true)
- `url`: WebSocket endpoint (default: from `backend.url`)
- `reconnect.max_attempts`: Max reconnection attempts (default: 10, 0 = infinite)
- `reconnect.initial_delay_ms`: Initial delay (default: 1000ms)
- `reconnect.max_delay_ms`: Max delay (default: 30000ms)

### Trie Index Configuration (NEW)

Controls local fast search index.

```json
{
  "trie": {
    "enabled": true,
    "min_prefix_length": 2,
    "max_results": 10,
    "case_sensitive": false
  }
}
```

**Options:**

- `enabled`: Enable Trie index for fast search (default: true)
- `min_prefix_length`: Minimum prefix length for autocomplete (default: 2)
- `max_results`: Max autocomplete suggestions (default: 10)
- `case_sensitive`: Case-sensitive matching (default: false)

---

## v3.0 Example Configurations

### Default Configuration (Recommended)

```json
{
  "version": "3.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "auto",
    "project_id": "auto",
    "sync": {
      "mode": "incremental",
      "auto_sync": true
    }
  },
  "timeline": {
    "enabled": true,
    "base_path": "memory/timeline"
  },
  "websocket": {
    "enabled": true
  },
  "trie": {
    "enabled": true
  }
}
```

### Offline Mode (No Backend)

```json
{
  "version": "3.0",
  "search": {
    "mode": "bm25"
  },
  "embedding": {
    "enabled": false
  },
  "backend": {
    "enabled": false
  },
  "timeline": {
    "enabled": true
  },
  "trie": {
    "enabled": true
  }
}
```

### High Performance Mode

```json
{
  "version": "3.0",
  "search": {
    "mode": "hybrid"
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B"
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "sync": {
      "mode": "incremental",
      "batch_size": 100
    }
  },
  "trie": {
    "enabled": true,
    "min_prefix_length": 1,
    "max_results": 20
  }
}
```

### Multi-Project Setup

```json
{
  "version": "3.0",
  "backend": {
    "enabled": true,
    "tenant_id": "my-company",
    "project_resolution": {
      "strategy": "git"
    }
  }
}
```

This will:

- Use `"my-company"` as tenant_id (shared across all projects)
- Automatically detect project_id from git remote URL
- Isolate memories per project

---

## Configuration Migration

### From v2.2 to v3.0

v2.2 config:

```json
{
  "version": "3.0",
  "search": { "mode": "hybrid" },
  "backend": {
    "url": "http://localhost:17999"
  }
}
```

v3.0 config (add new sections):

```json
{
  "version": "3.0",
  "search": { "mode": "hybrid" },
  "backend": {
    "url": "http://localhost:17999",
    "sync": { "mode": "incremental" }
  },
  "timeline": { "enabled": true },
  "websocket": { "enabled": true },
  "trie": { "enabled": true }
}
```

**Migration Steps:**

1. Update version to `"3.0"`
2. Add `backend.sync` section
3. Add `timeline` section
4. Add `websocket` section
5. Add `trie` section
6. Run timeline migration: `node scripts/migrate-daily-to-timeline.mjs`

---

## Troubleshooting v3.0

### Backend Connection Issues

**Backend Not Running:**

```bash
# Check backend status
curl http://localhost:17999/api/v1/health

# If not running, start it (see backend documentation)
```

**Fallback Behavior:**

- Plugin automatically falls back to local BM25 search
- All tools continue to work
- Sync operations queued until backend available

### Sync Conflicts

**View Conflicts:**

```bash
# List unresolved conflicts
conflict_list limit=10
```

**Resolve Conflicts:**

```bash
# Resolve specific conflict
conflict_resolve conflict_id="xxx" resolution="USE_LOCAL"
```

### Timeline Migration Issues

**Migration Script Errors:**

```bash
# Check if daily/ directory exists
ls ~/.opencode/memory/daily/

# Run migration
node scripts/migrate-daily-to-timeline.mjs

# Verify migration
ls ~/.opencode/memory/timeline/
```

**Rollback:**

If migration fails, the script preserves original `daily/` directory. You can manually move files back if needed.

### WebSocket Connection Issues

**Connection Drops:**

The plugin automatically reconnects with exponential backoff. Check logs:

```bash
tail -f ~/.opencode/memory/sync.log
```

**Disable WebSocket:**

```json
{
  "websocket": {
    "enabled": false
  }
}
```

Plugin will use HTTP polling instead.

---

## Environment Variables (v3.0)

### Backend Configuration

```bash
# Backend URL
export MEMORY_BACKEND_URL="http://localhost:17999"

# Tenant ID override
export MEMORY_TENANT_ID="custom-tenant"

# Project ID override
export MEMORY_PROJECT_ID="custom-project"
```

### Embedding Service

```bash
# ModelScope API Key (recommended)
export MODELSCOPE_API_KEY='your-api-key'

# Custom embedding endpoint
export EMBEDDING_ENDPOINT='http://localhost:18000/embeddings'
```

**Priority**: Environment variables override config file settings.

---

**Last Updated**: 2026-03-23  
**Version**: v2.9.0
