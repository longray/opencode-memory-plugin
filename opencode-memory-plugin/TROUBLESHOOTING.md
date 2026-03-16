# Deployment and Troubleshooting Guide

This guide provides instructions for deploying the OpenCode Memory Plugin with an external embedding service and troubleshooting common issues.

## Deployment

### Prerequisites

1. **Node.js** (version 16 or higher)
2. **OpenCode** installed and configured
3. An embedding service running at `http://localhost:18000/embeddings`
4. Network access to the embedding service endpoint

### Deployment Steps

#### 1. Install the Plugin

```bash
# Global installation (recommended)
npm install -g @csuwl/opencode-memory-plugin

# Or local project installation
npm install @csuwl/opencode-memory-plugin
```

#### 2. Configure the Embedding Service

By default, the plugin expects an external embedding service at `http://localhost:18000/embeddings`. You can customize this in the configuration file:

```json
{
  "embedding": {
    "provider": "external",
    "endpoint": "http://your-custom-endpoint/embeddings",
    "model": "your-model-name"
  }
}
```

#### 3. Verify Installation

After installation, you can verify that everything is working correctly:

1. Start your embedding service on the configured endpoint
2. Launch OpenCode
3. Test the vector search functionality:

```
memory_search query="hello world"
```

If successful, you should see search results returned by the semantic search engine.

## Common Issues and Solutions

### Issue: "External embedding service not accessible"

**Symptoms:**

- Vector search is slow or not returning results
- Error messages indicating service unavailability

**Causes and Solutions:**

1. **Service Not Running**: Verify your embedding service is running and accessible at the configured endpoint.

   ```bash
   curl -X POST http://localhost:18000/embeddings \
     -H "Content-Type: application/json" \
     -d '{"input": "test"}'
   ```

2. **Wrong Endpoint**: Check your `~/.opencode/memory/memory-config.json` file and ensure the endpoint matches your service.

3. **Firewall/Security Software**: On Windows, ensure Windows Defender Firewall is not blocking Node.js from making outbound connections.

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

### Community Support

For additional help:

- Refer to the project documentation
- Check the GitHub repository for known issues
- Review the external embedding service documentation for specific configuration options
