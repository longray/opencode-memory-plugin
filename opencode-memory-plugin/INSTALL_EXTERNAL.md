# OpenCode Memory Plugin with External Embedding Service

This guide explains how to set up the OpenCode Memory Plugin with your custom embedding service running on port 18000.

## Prerequisites

1. Make sure your embedding service is running on `http://localhost:18000/embeddings`
2. Your service should accept POST requests with JSON payload containing:
   ```json
   {
     "input": "text to embed",
     "model": "default"
   }
   ```
3. Your service should return embeddings in one of these formats:
   - OpenAI-compatible: `{ "data": [{ "embedding": [0.1, 0.2, ...] }] }`
   - Direct array: `[0.1, 0.2, 0.3, ...]`
   - With embeddings property: `{ "embeddings": [0.1, 0.2, ...] }`

## Installation

```bash
npm install -g @csuwl/opencode-memory-plugin
```

## Configuration

The plugin is preconfigured to use the external service at `http://localhost:18000/embeddings`.
You can customize this by modifying `~/.opencode/memory/memory-config.json`:

```json
{
  "version": "2.0",
  "search": {
    "mode": "hybrid"
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings",
    "model": "local-embedding-model",
    "fallbackMode": "bm25"
  }
}
```

## Verification

To verify the installation:

1. Start your embedding service on port 18000
2. Run OpenCode
3. Test the vector search functionality:

```
vector_memory_search query="test search"
```

If the external service is not available, the plugin will automatically fall back to BM25 keyword search.

## Troubleshooting

- If you get "External embedding service not accessible" messages, ensure your service is running on port 18000
- Check that your embedding service accepts POST requests with JSON payload
- Ensure your embedding service returns results in the expected format
- To temporarily disable external embeddings, set `"enabled": false` in the configuration

## Performance Benefits

- Lower memory usage (no large embedding models loaded locally)
- Faster inference via dedicated service
- Ability to use custom embedding models
- Automatic fallback to BM25 search when external service unavailable