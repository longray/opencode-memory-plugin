# Configuration Guide

OpenCode Memory Plugin supports flexible configuration for embedding models, search modes, and indexing parameters.

## Configuration File Location

`~/.opencode/memory/memory-config.json`

## Quick Start

The plugin works out of the box with sensible defaults. You only need to customize if you want to:

- Use a different embedding model
- Change search mode (hybrid, vector-only, bm25-only, hash-only)
- Adjust search quality vs speed tradeoffs
- Configure fallback behavior

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

| Mode | Description | Best For | Requires Model |
|------|-------------|----------|----------------|
| `hybrid` | Vector + BM25 (default) | Best quality | ✅ Yes |
| `vector` | Vector-only | Pure semantic search | ✅ Yes |
| `bm25` | BM25-only | Fast keyword search | ❌ No |
| `hash` | Hash-based | Emergency fallback | ❌ No |

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
    "provider": "external",  // external API service (ModelScope or custom)
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",  // Default: ModelScope API
    "model": "Qwen/Qwen3-Embedding-0.6B",  // Default model for ModelScope
    "fallbackMode": "bm25",  // Use BM25 as fallback
    "cache": {
      "enabled": false  // No caching for external service
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

| Provider | Endpoint | Model | Dimensions | Quality | Speed |
|----------|----------|-------|------------|---------|-------|
| **ModelScope** | api-inference.modelscope.cn | Qwen3-Embedding-0.6B | 1024 | ⭐⭐⭐⭐⭐ | ⚡⚡ |
| Custom | Your endpoint | Custom | Variable | ⭐⭐⭐⭐ | ⚡⚡ |

**Recommendation**: Use ModelScope API for best quality with minimal resource usage.

#### Local Models (Transformers.js)

**Small Models (384 dimensions, fast)**

| Model | Size | Quality | Speed | Best For |
|-------|------|---------|-------|----------|
| `Xenova/all-MiniLM-L6-v2` | 80MB | ⭐⭐ | ⚡⚡⚡ | Baseline, resource-constrained |
| `Xenova/bge-small-en-v1.5` ⭐ | 130MB | ⭐⭐⭐⭐ | ⚡⚡ | **Best balance** (recommended) |
| `Xenova/gte-small` | 70MB | ⭐⭐⭐⭐ | ⚡⚡⚡ | Small + fast |
| `Xenova/e5-small-v2` | 130MB | ⭐⭐⭐ | ⚡⚡ | Question-answer tasks |

**Medium Models (768 dimensions, higher quality)**

| Model | Size | Quality | Speed | Best For |
|-------|------|---------|-------|----------|
| `Xenova/bge-base-en-v1.5` ⭐ | 400MB | ⭐⭐⭐⭐⭐ | ⚡⚡ | **Best quality** |
| `Xenova/nomic-embed-text-v1.5` | 270MB | ⭐⭐⭐⭐ | ⚡⚡ | Long documents |

**Recommendations:**

- **Most users**: ModelScope API (best quality, zero local resources)
- **Local only**: `Xenova/bge-small-en-v1.5` (best balance)
- **Maximum quality (local)**: `Xenova/bge-base-en-v1.5` (if you have RAM)
- **Resource-constrained**: `Xenova/all-MiniLM-L6-v2` (smallest)

**Recommendations:**

- **Most users**: `Xenova/bge-small-en-v1.5` (best balance)
- **Maximum quality**: `Xenova/bge-base-en-v1.5` (if you have RAM)
- **Resource-constrained**: `Xenova/all-MiniLM-L6-v2` (smallest)

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
  "version": "2.0",
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
  "version": "2.0",
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
    "model": "Xenova/bge-small-en-v1.5"
  }
}
```

### Resource-Constrained (Small Model, Pure Vector)

```json
{
  "version": "2.0",
  "search": {
    "mode": "vector"
  },
  "embedding": {
    "enabled": true,
    "model": "Xenova/all-MiniLM-L6-v2"
  }
}
```

### Maximum Quality (Large Model)

```json
{
  "version": "2.0",
  "search": {
    "mode": "vector"
  },
  "embedding": {
    "enabled": true,
    "model": "Xenova/bge-base-en-v1.5"
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
vector_memory_search query="test search"
```

**Note:** Different models have different dimensions. You must rebuild the index when switching models.

## Performance Comparison

| Configuration | First Search | Subsequent | RAM | Quality |
|---------------|--------------|------------|-----|---------|
| BM25-only | <1ms | <1ms | ~50MB | ⭐⭐ Keywords |
| Hash-only | ~5ms | ~5ms | ~50MB | ⭐ Poor |
| **ModelScope API** | ~50-100ms | ~50-100ms | ~50MB | ⭐⭐⭐⭐⭐ |
| Vector (small) | 2-3s | ~50ms | ~200MB | ⭐⭐⭐ Good |
| Vector (large) | 3-5s | ~100ms | ~500MB | ⭐⭐⭐⭐⭐ Excellent |
| Hybrid (small) | 2-3s | ~60ms | ~200MB | ⭐⭐⭐⭐ Best |

**Recommendation**: Use ModelScope API for best quality-performance ratio.

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
## Migration from v1.0

The plugin automatically supports v1.0 configs. To upgrade to v2.0:

```bash
# Backup current config
cp ~/.opencode/memory/memory-config.json ~/.opencode/memory/memory-config.json.backup

# Reinstall plugin to get v2.0 defaults
npm install @csuwl/opencode-memory-plugin@latest -g

# Customize as needed
nano ~/.opencode/memory/memory-config.json
```

## Advanced: Custom Models

You can use any Xenova model from HuggingFace:

```json
{
  "embedding": {
    "model": "Xenova/YOUR_MODEL_NAME"
  },
  "models": {
    "available": {
      "Xenova/YOUR_MODEL_NAME": {
        "dimensions": 384,
        "size": "100MB",
        "language": "en",
        "useCase": "custom",
        "quality": "good",
        "speed": "medium"
      }
    }
  }
}
```

Then rebuild the index with `rebuild_index force=true`.
