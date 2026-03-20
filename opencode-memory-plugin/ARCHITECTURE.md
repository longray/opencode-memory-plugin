# OpenCode Memory Plugin - Architecture

## Overview

The OpenCode Memory Plugin is a sophisticated memory management system for OpenCode that leverages an external embedding service to provide semantic search capabilities. This architecture decouples the embedding computation from the core memory system, allowing for greater scalability and customization.

## System Architecture

```
┌─────────────────┐    HTTP Request     ┌──────────────────────┐
│                 │ ────────────────→   │                      │
│   OpenCode      │                     │   External Embedding │
│   Interface     │ ←───────────────    │   Service            │
│                 │   HTTP Response     │   (localhost:18000)  │
└─────────────────┘                     └──────────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐    Store/Retrieve    ┌──────────────────────┐
│                 │ ←────────────────   │                      │
│   Plugin Core   │                    │   Vector Storage     │
│                 │ ────────────────→   │   (SQLite + sqlite- │
│                 │   Index Vectors     │   vec)              │
└─────────────────┘                     └──────────────────────┘
         │
         ▼
┌─────────────────┐
│   Memory Files  │
│   (Markdown)    │
└─────────────────┘
```

## Components

### 1. Plugin Core (`plugin.js`)

- Entry point for all OpenCode memory tools
- Orchestrates communication between OpenCode and internal systems
- Handles tool registration and execution

### 2. Vector Store (`lib/vector-store.js`)

- Central component that manages embedding operations
- Communicates with external embedding service via HTTP API
- Handles vector storage and retrieval using SQLite with sqlite-vec
- Implements fallback mechanisms when external service is unavailable

### 3. External Embedding Service (localhost:18000)

- Standalone service that generates embedding vectors
- Receives text inputs via HTTP POST requests
- Returns embedding vectors in standardized format
- Can be implemented using various models (OpenAI-compatible, custom models, etc.)

### 4. Vector Storage (SQLite + sqlite-vec)

- Stores embedding vectors with associated metadata
- Enables efficient similarity search
- Persists indexed content from memory files

### 5. Memory Files (Markdown)

- User-provided memory content in Markdown format
- Includes SOUL, AGENTS, USER, IDENTITY, TOOLS, MEMORY files
- Daily logs stored separately

### 6. Auto-Trigger Mechanism (`plugin.js` event hook)

- Listens to `session.idle` events from OpenCode
- Automatically analyzes conversation content for important information
- Invokes memory-automation agent to save relevant memories
- Implements smart filtering to avoid triggering on trivial conversations
- Configurable thresholds and cooldown periods

## Data Flow

### For Search (`memory_search`)

1. OpenCode calls `memory_search` with a query and mode (vector/keyword/hybrid)
2. Plugin forwards request to backend service (localhost:17999)
3. Backend service performs search using SurrealDB (vector) and/or Meilisearch (keyword)
4. Backend returns ranked results to plugin
5. Plugin returns results to OpenCode

### For Indexing (`rebuild_index`)

1. System reads all memory files
2. Content is chunked appropriately
3. Each chunk is sent to external embedding service
4. Returned vectors are stored in SQLite DB with metadata
5. Index is ready for search operations

### For Auto-Trigger (session.idle event)

1. OpenCode emits `session.idle` event when conversation pauses
2. Plugin's event hook receives the event with session ID
3. Smart filtering checks conversation metrics (message count, length, quality)
4. If conversation meets thresholds, invokes memory-automation agent
5. Agent analyzes conversation and identifies important information
6. Agent calls `memory_write` to save relevant memories
7. Session marked as processed with cooldown period

## API Contract

### External Embedding Service API

**Request:**

```
POST /embeddings
Content-Type: application/json

{
  "input": "text to embed",
  "model": "default"  // optional
}
```

**Responses (Multiple formats supported):**

Standard format:

```json
{
  "embeddings": [0.1, 0.2, 0.3, ...]
}
```

OpenAI-compatible:

```json
{
  "data": [
    {
      "embedding": [0.1, 0.2, 0.3, ...]
    }
  ]
}
```

Direct array:

```json
[0.1, 0.2, 0.3, ...]
```

## Fallback Mechanisms

1. **Primary**: External embedding service for semantic search
2. **Secondary**: BM25 keyword search when external service unavailable
3. **Tertiary**: Hash-based fallback (minimal functionality)

## Security Considerations

- External embedding service runs on localhost (not exposed to network)
- Embedding requests only contain the actual text content to be embedded
- No authentication required for localhost service (assumes trusted environment)

## Performance Characteristics

### Node.js/OpenCode Environment

- **Latency**: ~50-100ms per embedding request
- **Memory Usage**: ~50-100MB RAM (much less than local model)
- **Scalability**: Can handle multiple concurrent requests via external service
- **Network Dependency**: Requires connectivity to embedding service

### Bun Runtime Environment

- **Latency**: <1ms per search (BM25 keyword matching)
- **Memory Usage**: ~50MB RAM (no external dependencies)
- **Search Quality**: Good keyword matching with BM25 scoring
- **Limitations**: No vector search (falls back to BM25)
- **Status**: See [GitHub Issue #4290](https://github.com/oven-sh/bun/issues/4290)

### Performance Comparison

| Environment                   | Search   | Memory | Quality  | Embedding Support   |
| ----------------------------- | -------- | ------ | -------- | ------------------- |
| Node.js (with ModelScope API) | 50-100ms | ~50MB  | ⭐⭐⭐⭐ | ✅ Yes              |
| Bun Runtime                   | <1ms     | ~50MB  | ⭐⭐     | ⚠️ Fallback to BM25 |

## Error Handling

- Graceful degradation to keyword search when external service is down
- Graceful degradation to BM25 when `better-sqlite3` is unavailable (Bun runtime)
- Dimension validation to prevent index corruption
- Connection timeout handling
- Retry logic for transient failures

### Bun Runtime Error Handling

In Bun runtime, the plugin has additional error handling:

1. **Vector Store Initialization Failure**
   - Detects when `better-sqlite3` is not available
   - Falls back to BM25-based search automatically
   - Logs warning message with GitHub issue reference

2. **Backend-First Architecture (v2.1.0+)**
   - All vector operations handled by backend service
   - No local vector storage in plugin
   - Eliminates Bun compatibility issues
   - All tools work normally across all runtimes

3. **User Experience**
   - All tools remain functional
   - Search quality: Good (BM25 keyword search)
   - Performance: Faster (no network calls to embedding service)
   - Error messages: Clear explanations about Bun limitations
