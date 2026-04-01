# Windows 11 Setup Guide

This document provides instructions for setting up the OpenCode Memory Plugin on Windows 11 with ModelScope API or local embedding service.

## Prerequisites

1. **Node.js** (v16 or higher) installed on your Windows 11 machine
2. **ModelScope API Key** (recommended) or local embedding service running
3. Administrator privileges to install global packages (if installing globally)

## Installation Steps

### 1. Install the Plugin

```cmd
npm install -g @csuwl/opencode-memory-plugin
```

### 2. Verify Configuration

The installation will create a default configuration at `%USERPROFILE%/.opencode/memory/memory-config.json` with these settings:

```json
{
  "version": "3.0",
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

### 3. Configure ModelScope API (Recommended)

Set the environment variable in PowerShell:

```powershell
$env:MODELSCOPE_API_KEY='your-api-key-here'
```

Or in CMD:

```cmd
set MODELSCOPE_API_KEY=your-api-key-here
```

### 4. Alternative: Local Embedding Service

If using a local embedding service instead of ModelScope API, ensure it's running on the configured endpoint (default: `http://localhost:18000/embeddings`).

## Windows-Specific Considerations

### Path Handling

- The plugin correctly handles Windows-style paths (using `path.join()`)
- Memory files are stored in `%USERPROFILE%/.opencode/memory/` (equivalent to `C:\Users\<username>\.opencode\memory\`)

### Firewall/Network Access

Make sure Windows Defender Firewall or other security software allows Node.js to make outbound connections to localhost:18000 if your embedding service is running locally.

### Permission Issues

- If you encounter permission errors during installation, try running the command prompt as administrator
- Alternatively, install locally to your project without `-g` flag

## Testing the Integration

### 1. Test the Vector Search Functionality

Once your embedding service is running, open OpenCode and run:

```
memory_search query="test search functionality"
```

### 2. Check the Index Status

Verify everything is working properly:

```
index_status
```

### 3. Rebuild Index if Needed

After changing configurations or ensuring the service is running:

```
rebuild_index force=true
```

## Troubleshooting

### Common Issues on Windows

**Problem**: "External embedding service not accessible" error
**Solution**:

- Confirm your embedding service is running and accessible at <http://localhost:18000/embeddings>
- Verify the service accepts POST requests with JSON payload
- Check Windows Firewall isn't blocking the connection

**Problem**: Path errors with memory directory
**Solution**: Ensure the `.opencode\memory\` directory exists in your user profile directory

**Problem**: Installation fails with permission errors
**Solution**: Run Command Prompt as Administrator or adjust Node.js global package permissions

### Service Validation

Your external embedding service should:

1. Accept POST requests at `http://localhost:18000/embeddings`
2. Accept JSON input like: `{"input": "text to embed", "model": "default"}`
3. Return embeddings in a recognized format (OpenAI-compatible, direct array, or with embeddings property)

## Benefits of External Embedding Service

- **Reduced Memory Usage**: No need to load large models locally (~50-100MB RAM vs ~150-200MB+ for local models)
- **Faster Responses**: Leverage your optimized embedding service
- **Customization**: Use your own embedding models
- **Flexibility**: Easy updates and model swapping without reinstalling the plugin

## Performance Expectations on Windows 11

With the external embedding service running:

- **Initial Connection**: ~50-100ms (establishing connection to your service)
- **Subsequent Searches**: ~50-100ms per query
- **Memory Usage**: ~50-100MB RAM (much lower than local model approaches)

The plugin gracefully degrades to BM25 keyword search if the external service is unavailable.
