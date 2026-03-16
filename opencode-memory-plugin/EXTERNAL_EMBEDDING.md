# External Embedding Service Configuration

This guide explains how to configure the OpenCode Memory Plugin to use external embedding services, including the recommended ModelScope Inference API and custom local services.

## Recommended: ModelScope Inference API (Primary)

The plugin now supports **ModelScope Inference API** as the primary external embedding service. This provides:

- ✅ High-quality embeddings with `Qwen/Qwen3-Embedding-0.6B` model
- ✅ 1024-dimensional vectors for better semantic understanding
- ✅ Cloud-based, no local resource requirements
- ✅ Automatic fallback to local service if unavailable

### Setup ModelScope API

**Step 1: Get API Key**

1. Visit [ModelScope](https://modelscope.cn/)
2. Sign up and get your API key
3. Export as environment variable:
   ```bash
   export MODELSCOPE_API_KEY='your-api-key-here'
   # Windows PowerShell:
   $env:MODELSCOPE_API_KEY='your-api-key-here'
   # Windows CMD:
   set MODELSCOPE_API_KEY=your-api-key-here
   ```

**Step 2: Configuration**

The plugin is pre-configured to use ModelScope API. Verify your configuration at `~/.opencode/memory/memory-config.json`:

```json
{
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  }
}
```

**Step 3: Test**

```bash
memory_search query="test semantic search"
```

If successful, you'll see vector search results powered by ModelScope API.

---

## Alternative: Local Embedding Service

If you prefer to run a local embedding service (fallback option), the plugin supports services running on port 18000.

## Default Configuration (Local Service)

The plugin can be configured to connect to a local embedding service at `http://localhost:18000/embeddings`.

### Setup Local Service

```json
{
  "version": "2.0",
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings", // Default local service port
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  }
}
```

### Supported Response Formats

Your local service should return embeddings in one of these formats:

### ModelScope Inference API (Recommended)

**Request:**

```
POST https://api-inference.modelscope.cn/v1/embeddings
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "model": "Qwen/Qwen3-Embedding-0.6B",
  "input": "text to embed",
  "encoding_format": "float"
}
```

**Response:**

```json
{
  "data": [
    {
      "embedding": [0.1, 0.2, 0.3, ...]
    }
  ]
}
```

### Local Service (Fallback)

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

## Testing the Services

### Test ModelScope API

After setting up your API key:

1. Set environment variable: `export MODELSCOPE_API_KEY='your-key'`
2. Run: `memory_search query="test"`
3. If successful, you'll see vector search results from ModelScope
4. If API fails, it will fall back to BM25 keyword search

### Test Local Service

After starting your embedding service on localhost:18000:

1. Run: `memory_search query="test"`
2. If the service is accessible, you should see vector search results
3. If there are connection issues, it will fall back to BM25 keyword search

## Fallback Behavior

The plugin uses a smart fallback mechanism:

1. **Primary**: ModelScope Inference API (if `MODELSCOPE_API_KEY` is set)
2. **Secondary**: Local service at `http://localhost:18000/embeddings`
3. **Final**: BM25 keyword search (always available)

If both external services are unreachable, the plugin will automatically fall back to BM25 keyword search while logging an appropriate error message.

## Performance Comparison

| Service            | Dimension | Latency   | Resource    | Quality    |
| ------------------ | --------- | --------- | ----------- | ---------- |
| **ModelScope API** | 1024      | ~50-100ms | Cloud (0MB) | ⭐⭐⭐⭐⭐ |
| Local Service      | Variable  | ~50-100ms | Local RAM   | ⭐⭐⭐⭐   |
| BM25 Keywords      | N/A       | <1ms      | ~50MB       | ⭐⭐       |

**Recommendation**: Use ModelScope API for best quality and minimal resource usage.

## Troubleshooting

### ModelScope API Issues

**API Key Not Found:**

```bash
echo $MODELSCOPE_API_KEY  # Check if set
export MODELSCOPE_API_KEY='your-key'  # Set it
```

**Connection Errors:**

- Check your internet connection
- Verify API key is valid
- Check ModelScope service status

### Local Service Issues

**Service Not Reachable:**

```bash
curl -X POST http://localhost:18000/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "test"}'
```

**Port Already in Use:**

```bash
# Linux/Mac
lsof -i :18000
# Windows
netstat -ano | findstr :18000
```

## Advanced: Custom Endpoint Configuration

To use a different external service, update the `endpoint` in your config:

```json
{
  "embedding": {
    "endpoint": "https://your-custom-endpoint.com/embeddings",
    "model": "your-model-name"
  }
}
```

The plugin will use this endpoint while maintaining the fallback to BM25.
