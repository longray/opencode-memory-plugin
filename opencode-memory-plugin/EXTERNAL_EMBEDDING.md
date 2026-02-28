# External Embedding Service Configuration

This guide explains how to configure the OpenCode Memory Plugin to use an external embedding service running on port 18000.

## Default Configuration

The plugin is pre-configured to connect to an external embedding service at `http://localhost:18000/embeddings`.

## Configuration Parameters

The plugin expects the following configuration in `~/.opencode/memory/memory-config.json`:

```json
{
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings",
    "model": "local-embedding-model",
    "fallbackMode": "bm25"
  }
}
```

## Expected API Format

The external embedding service should expect POST requests with the following format:

```
POST /embeddings
Content-Type: application/json

{
  "input": "text to embed",
  "model": "default"
}
```

And respond with embeddings in one of these formats:

Format 1 (OpenAI-compatible):
```json
{
  "data": [
    {
      "embedding": [0.1, 0.2, 0.3, ...]
    }
  ]
}
```

Format 2 (Direct array):
```json
[0.1, 0.2, 0.3, ...]
```

Format 3 (Wrapped in embeddings):
```json
{
  "embeddings": [0.1, 0.2, 0.3, ...]
}
```

## Testing the Service

After starting your embedding service on localhost:18000, test that the connection works:

1. Run: `vector_memory_search query="test"`
2. If the service is accessible, you should see vector search results
3. If there are connection issues, it will fall back to BM25 keyword search

## Fallback Behavior

If the external service is unreachable, the plugin will automatically fall back to BM25 keyword search while logging an appropriate error message.