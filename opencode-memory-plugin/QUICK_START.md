# Quick Start Guide

This guide will help you quickly set up and start using the OpenCode Memory Plugin.

## Prerequisites

Before beginning, ensure you have:

1. **Node.js** (v16 or higher) installed
2. **OpenCode** installed and running
3. **Bun Runtime** (optional) - Supported with automatic fallbacks

## Bun Runtime Quick Start

If you're running OpenCode in Bun, the plugin will work automatically with some optimizations:

### Automatic Configuration

The plugin detects Bun and configures itself:

- Search mode: Automatically set to BM25 (fastest)
- Embedding: Disabled (falls back to BM25)
- All tools: Work normally

### What Works in Bun

✅ **Full Functionality**: All 8 tools work normally
✅ **Fast Search**: BM25 keyword search is very fast (<1ms)
✅ **Low Memory**: ~50MB RAM usage
✅ **No Dependencies**: No network calls needed

### Limitations

⚠️ **Backend-first Architecture**: All vector search is handled by the backend service (localhost:17999). The plugin works seamlessly in all runtimes including Bun.
⚠️ **Manual Indexing**: Index rebuild uses BM25 instead of embeddings

**Recommendation**: Continue using the plugin - keyword search is fast and effective. Vector search will be automatically restored when Bun adds V8 C++ API support (see [GitHub Issue #4290](https://github.com/oven-sh/bun/issues/4290)).

## Step 1: Installation

Install the plugin globally:

```bash
npm install -g @csuwl/opencode-memory-plugin
```

This will automatically:

- Create memory directory (`~/.opencode/memory/`)
- Copy all core memory files (SOUL, AGENTS, USER, etc.)
- Generate configuration (v2.0)
- Register tools with OpenCode

## Step 2: Choose Your Embedding Service

### Option A: ModelScope API (Recommended) ⭐

**Best choice for most users** - Cloud-based, zero setup, high quality.

1. Get your API key from [ModelScope](https://modelscope.cn/)
2. Set the environment variable:

   **Linux/Mac:**

   ```bash
   export MODELSCOPE_API_KEY='your-api-key-here'
   ```

   **Windows PowerShell:**

   ```powershell
   $env:MODELSCOPE_API_KEY='your-api-key-here'
   ```

   **Windows CMD:**

   ```cmd
   set MODELSCOPE_API_KEY=your-api-key-here
   ```

3. You're done! The plugin will automatically use ModelScope API.

### Option B: Local Embedding Service

If you prefer to run your own service:

1. Ensure your embedding service is running at `http://localhost:18000/embeddings`
2. The service should accept POST requests with JSON input
3. See [EXTERNAL_EMBEDDING.md](./EXTERNAL_EMBEDDING.md) for details

## Step 3: Verify Configuration

Check your configuration at `~/.opencode/memory/memory-config.json`:

**Default (ModelScope API):**

```json
{
  "version": "3.0",
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  }
}
```

**Local Service (Fallback):**

```json
{
  "version": "3.0",
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  }
}
```

## Step 4: Test the Integration

Start OpenCode and test the memory tools:

```bash
# Write a test entry
memory_write content="This is a test for memory integration" type="test" tags=["quickstart","test"]

# Perform a search (supports semantic and keyword search via backend)
memory_search query="memory integration functionality"

# Browse memory timeline
memory_timeline days=7 level=1

# Check system status
index_status
```

## Step 5: Rebuild the Index

To incorporate existing memory files with the embedding service:

```bash
rebuild_index force=true
```

This will process all memory files through your embedding service and create vector indexes.

## Step 6: Explore Code Analysis (Optional)

The plugin can automatically analyze your code files and save them to memory:

**How it works:**

1. You save a code file in OpenCode
2. After 300ms debounce, the plugin analyzes the file
3. Functions, classes, and interfaces are extracted
4. Results are saved to memory automatically

**Supported Languages:**

- JavaScript (`.js`, `.mjs`, `.cjs`)
- TypeScript (`.ts`, `.mts`, `.cts`, `.tsx`)
- Python (`.py`)
- Go (`.go`)
- Rust (`.rs`)
- Java (`.java`)

**Configuration:**
Code analysis is enabled by default. To customize or disable it:

```json
{
  "code_analysis": {
    "enabled": true,
    "exclude_patterns": ["node_modules", ".git", "dist"],
    "batch_max_size": 10,
    "debounce_ms": 300
  }
}
```

**See [CODE-ANALYSIS.md](./CODE-ANALYSIS.md) for complete documentation.**

## Quick Search Examples

### Semantic Search (Vector + Keywords)

```bash
# Find relevant memories by meaning, not just keywords
memory_search query="how do I handle async errors"
memory_search query="best practices for testing"
memory_search query="user preferences for code style"
```

### Keyword Search Only

```bash
# Fast text-based search
memory_search query="typescript"
memory_search query="async patterns"
```

### Memory Management

```bash
# Write important information
memory_write content="User prefers TypeScript for all new features" type="long-term" tags=["typescript","preferences"]

# Read memory files
memory_read file="MEMORY.md"

# Browse memory timeline
memory_timeline days=30 level=1
```

## Troubleshooting Quick Fixes

### ModelScope API Issues

**API Key Not Found:**

```bash
# Check if set
echo $MODELSCOPE_API_KEY

# Set it
export MODELSCOPE_API_KEY='your-key'
```

**Connection Errors:**

- Check your internet connection
- Verify API key is valid
- System will fall back to BM25 keyword search

### Local Service Issues

**Service Not Reachable:**

```bash
curl -X POST http://localhost:18000/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "test"}'
```

**Slow Performance:**

- Check network latency between plugin and embedding service
- Consider switching to ModelScope API for better performance

## Performance Expectations

### With ModelScope API (Node.js/OpenCode)

- Initial search: ~50-100ms (network call)
- Subsequent searches: ~50-100ms per query
- Memory usage: ~50MB RAM (minimal local resources)

### With Bun Runtime

- Initial search: <1ms (BM25 keyword search)
- Subsequent searches: <1ms per query
- Memory usage: ~50MB RAM (no external dependencies)
- Quality: Good keyword matching (no semantic search)

### Without Embedding Service (BM25-only)

- Search time: <1ms
- Memory usage: ~50MB RAM
- Quality: Keyword matching only (fast but less accurate)

## Common Workflows

### Saving User Preferences

```bash
# Save coding style preferences
memory_write content="User prefers TypeScript over JavaScript for type safety" type="preference" tags=["typescript","code-style"]

# Save project conventions
memory_write content="Always use functional components with hooks in React" type="preference" tags=["react","best-practices"]
```

### Learning from Mistakes

```bash
# Document errors and solutions
memory_write content="Issue: Async function not awaited. Solution: Add await keyword or use .then()" type="long-term" tags=["javascript","async","debugging"]
```

### Project Context

```bash
# Save important project decisions
memory_write content="Decided to use PostgreSQL instead of MongoDB for better relational data support" type="long-term" tags=["database","decision"]
```

## Next Steps

1. **Explore Documentation:**
   - [Configuration Guide](./CONFIGURATION.md) - Advanced configuration options
   - [External Embedding Guide](./EXTERNAL_EMBEDDING.md) - Setting up custom embedding services
   - [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions

2. **Customize Your Setup:**
   - Adjust search modes (hybrid, vector-only, keyword-only)
   - Configure fallback behavior
   - Set up custom embedding endpoints

3. **Use in Your Workflow:**
   - Save important information automatically
   - Search past decisions and patterns
   - Maintain context across sessions

## Support

For issues or questions:

- Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Review [Configuration Guide](./CONFIGURATION.md)
- Open an issue on GitHub

Happy memory managing! 🧠✨
