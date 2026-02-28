# Quick Start Guide - External Embedding Service

This guide will help you quickly set up the OpenCode Memory Plugin with an external embedding service.

## Prerequisites

Before beginning, ensure you have:
1. **Node.js** (v16 or higher) installed
2. **OpenCode** installed and running
3. An embedding service running at `http://localhost:18000/embeddings`

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

## Step 2: Set Up Your Embedding Service

Ensure your embedding service is running and accessible at `http://localhost:18000/embeddings`. 

The service should:
- Accept POST requests to `/embeddings`
- Expect JSON input: `{"input": "text to embed"}`
- Return embedding vectors in standard format

Example service setup (pseudo-code):
```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/embeddings', methods=['POST'])
def get_embedding():
    text = request.json['input']
    # Generate embedding using your model
    embedding = your_model.encode(text)
    return jsonify({"embeddings": embedding.tolist()})
```

## Step 3: Verify Configuration

Check your configuration at `~/.opencode/memory/memory-config.json`:
```json
{
  "version": "2.0",
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings",
    "fallbackMode": "bm25"
  }
}
```

## Step 4: Test the Integration

Start OpenCode and test the memory tools:

```bash
# Write a test entry
memory_write content="This is a test for external embedding integration" type="test" tags=["external","embedding"]

# Perform a semantic search (should use your external service)
vector_memory_search query="external embedding functionality"

# List daily logs
list_daily days=7

# Check system status
index_status
```

## Step 5: Rebuild the Index

To incorporate existing memory files with the new external service:

```bash
rebuild_index force=true
```

This will process all memory files through your external embedding service and create vector indexes.

## Troubleshooting Quick Fixes

If you encounter issues:

1. **Service Not Reachable**: Verify your embedding service responds to requests:
   ```bash
   curl -X POST http://localhost:18000/embeddings \
     -H "Content-Type: application/json" \
     -d '{"input": "test"}'
   ```

2. **Slow Performance**: Check network latency between the plugin and your embedding service

3. **Fallback to Keyword Search**: If vector search isn't working, the system will fall back to BM25 keyword search while displaying an error

## Performance Expectations

With the external embedding service:
- Initial search: ~50-100ms (network call to your service)
- Subsequent searches: ~50-100ms per query
- Memory usage: ~50-100MB RAM (significantly less than local models)

## Customizing Your Setup

You can customize the endpoint in the configuration file to point to any external embedding service that meets the API requirements.