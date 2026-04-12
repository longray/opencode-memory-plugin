# Deployment and Troubleshooting Guide

This guide provides instructions for deploying the OpenCode Memory Plugin with an external embedding service and troubleshooting common issues.

## Deployment

### Prerequisites

1. **Node.js** (version 16 or higher)
2. **OpenCode** installed and configured
3. **Backend service** running at `http://localhost:18008` (v3.2+, previously 17999) (required for semantic search)
4. **OR** use BM25 keyword-only mode (no backend required)
5. Network access to the backend service endpoint

### Deployment Steps

#### 1. Install the Plugin

```bash
# Global installation (recommended)
npm install -g @csuwl/opencode-memory-plugin

# Or local project installation
npm install @csuwl/opencode-memory-plugin
```

#### 2. Configure the Backend Service

By default, the plugin uses a backend-first architecture with the backend service at `http://localhost:18008` (v3.2+, previously 17999). You can customize this in the configuration file:

```json
{
  "backend": {
    "enabled": true,
    "endpoint": "http://localhost:18008"
  },
  "embedding": {
    "provider": "external",
    "endpoint": "http://localhost:18000/embeddings",
    "model": "your-model-name",
    "fallbackMode": "bm25"
  }
}
```

**Note**: The backend service handles all vector search operations. The embedding service is optional (BM25 keyword search works without it).

#### 3. Verify Installation

After installation, you can verify that everything is working correctly:

1. **Start the backend service** (if using semantic search):

   ```bash
   # Backend service should be running at http://localhost:18008 (v3.2+, previously 17999)
   curl http://localhost:18008/health
   ```

2. **Launch OpenCode**

3. **Test the search functionality**:

   ```
   memory_search query="hello world"
   ```

**Expected Results**:

- ✅ **With backend**: Semantic search returns results
- ✅ **Without backend**: BM25 keyword search returns results
- ✅ **With embedding service**: Better semantic understanding
- ✅ **Without embedding service**: Falls back to BM25

## Common Issues and Solutions

### Issue: "Backend service not accessible"

**Symptoms:**

- Semantic search not working
- Error messages indicating backend unavailability
- Fallback to BM25 keyword search

**Causes and Solutions:**

1. **Backend Service Not Running**: Verify the backend service is running at `http://localhost:18008` (v3.2+, previously 17999).

   ```bash
   curl http://localhost:18008/health
   ```

   If not running, start the backend service first.

2. **Wrong Endpoint**: Check your `~/.opencode/memory/memory-config.json` file and ensure the backend endpoint is correct.

3. **Firewall/Security Software**: On Windows, ensure Windows Defender Firewall is not blocking Node.js from making outbound connections.

4. **Use BM25 Mode**: If backend is unavailable, you can use BM25 keyword-only mode:

   ```json
   {
     "search": {
       "mode": "bm25"
     }
   }
   ```

### Issue: "External embedding service not accessible"

**Symptoms:**

- Semantic search falls back to BM25
- Warning messages about embedding service

**Causes and Solutions:**

1. **Embedding Service Not Running**: This is optional. The plugin will fall back to BM25 keyword search.

   ```bash
   curl -X POST http://localhost:18000/embeddings \
     -H "Content-Type: application/json" \
     -d '{"input": "test"}'
   ```

2. **Wrong Endpoint**: Check your configuration file and ensure the endpoint matches your service.

3. **Use BM25 Fallback**: The plugin automatically falls back to BM25 if embedding service is unavailable (configured via `fallbackMode: "bm25"`).

### Issue: Dimension Mismatch Error

**Symptoms:**

- Errors mentioning dimension mismatch
- Vector indexing failing

**Solution:**

- Ensure your embedding service consistently returns embeddings with the same number of dimensions
- Verify that your embedding service returns vectors in one of the supported formats

### Issue: Authentication Failure

**Symptoms:**

- HTTP 401 or 403 errors
- Service appears accessible but rejects requests

**Solution:**

- If your embedding service requires authentication, update the vector-store.js file to include the appropriate headers

### Issue: Timeout Errors

**Symptoms:**

- Requests timing out
- Slow response times

**Solutions:**

1. Check the performance of your embedding service
2. Verify the network connection between the plugin and service
3. Increase timeout values in the vector store configuration if needed

## Configuration Files

### Main Configuration File

Location: `~/.opencode/memory/memory-config.json`

Key settings:

- `embedding.provider`: Must be set to `"external"`
- `embedding.endpoint`: The URL of your embedding service
- `embedding.fallbackMode`: What to do if external service fails (`"bm25"`, `"hash"`, or `"error"`)

### Service Configuration

Your external embedding service should:

1. Accept POST requests at the configured endpoint
2. Accept JSON payload with at least an `input` field
3. Return embeddings in one of the supported formats

## Performance Optimization

### Network Latency

Since all embedding requests go over the network, consider:

- Running the embedding service on localhost or a low-latency network
- Using connection pooling if supported by your embedding service
- Ensuring adequate bandwidth between the plugin and service

### Memory Usage

The external service configuration significantly reduces memory usage compared to local models:

- Local models typically require 150-200MB+ of RAM
- External service configuration uses only ~50-100MB RAM

### Caching Strategies

While the basic configuration doesn't include caching, you can:

- Implement caching at the external service level
- Cache frequently accessed embeddings in your embedding service

## Security Considerations

### Network Security

- The default configuration assumes a trusted local environment
- If exposing the embedding service externally, implement proper authentication and encryption
- Monitor network traffic between the plugin and service

### Data Privacy

- All text processed for embeddings is sent to the external service
- Ensure your embedding service complies with your privacy and security policies
- Consider using a service hosted within your security perimeter for sensitive data

## Monitoring and Logging

### Service Availability

Monitor the availability of your embedding service:

- Use health check endpoints if available
- Monitor response times and error rates
- Set up alerts for service unavailability

### Plugin Logs

Check the OpenCode logs for any issues with the memory plugin:

- Look for external service connection errors
- Monitor fallback behavior (when BM25 keyword search is used)
- Track performance metrics such as response times

## Updating the Plugin

When updating the plugin to a new version:

1. The new version will respect your existing configuration
2. Verify that the embedding service API remains compatible after updates
3. Test functionality after updates to ensure continued integration

## Support and Debugging

### Enable Debug Logging

For debugging purposes, you can enable detailed logging in your external service to see incoming requests and responses.

### API Compatibility

Verify that your embedding service adheres to the expected API contract:

- Accepts POST requests with JSON content type
- Expects `input` field in the request body
- Returns embeddings in one of the supported formats

## v3.2 Migration FAQ

### Issue: "Port 17999 connection refused after upgrade"

**Symptoms:**

- Plugin fails to connect to backend
- Error messages mentioning port 17999

**Cause:**

v3.2 changed the default port from 17999 to 18008.

**Solutions:**

1. **Update your configuration** to use port 18008:

   ```json
   {
     "backend": {
       "url": "http://localhost:18008"
     }
   }
   ```

2. **Or set environment variable** to use old port:

   ```bash
   export API_PORT="17999"
   ```

3. **Or set full URL** via environment variable:

   ```bash
   export MEMORY_BACKEND_URL="http://localhost:17999"
   ```

### Issue: "WebSocket connection not established"

**Symptoms:**

- Real-time sync not working
- WebSocket errors in logs

**Solutions:**

1. **Check WebSocket is enabled** (v3.2, default: true):

   ```bash
   export WS_ENABLED="true"
   ```

2. **Verify backend WebSocket endpoint** is accessible:

   ```bash
   curl http://localhost:18008/api/v1/health
   ```

3. **Check firewall** allows WebSocket connections on port 18008.

### Issue: "Logs not showing with pino format"

**Symptoms:**

- No log output after v3.2 upgrade
- Logs appear in JSON format instead of pretty format

**Solutions:**

1. **Enable pretty logging** in development:

   ```bash
   export LOG_PRETTY="true"
   export LOG_LEVEL="debug"
   ```

2. **Check log level** is set correctly:

   ```bash
   export LOG_LEVEL="info"  # or "debug", "warn", "error"
   ```

### Community Support

For additional help:

- Refer to the project documentation
- Check the GitHub repository for known issues
- Review the external embedding service documentation for specific configuration options
