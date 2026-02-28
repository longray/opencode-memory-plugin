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

## Data Flow

### For Semantic Search (`vector_memory_search`)

1. OpenCode calls `vector_memory_search` with a query
2. Vector Store sends query text to external embedding service
3. External service generates embedding vector
4. Vector Store performs similarity search against local SQLite DB
5. Vector Store returns ranked results to OpenCode

### For Indexing (`rebuild_index`)

1. System reads all memory files
2. Content is chunked appropriately
3. Each chunk is sent to external embedding service
4. Returned vectors are stored in SQLite DB with metadata
5. Index is ready for search operations

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

- **Latency**: ~50-100ms per embedding request
- **Memory Usage**: ~50-100MB RAM (much less than local model)
- **Scalability**: Can handle multiple concurrent requests via external service
- **Network Dependency**: Requires connectivity to localhost:18000

## Error Handling

- Graceful degradation to keyword search when external service is down
- Dimension validation to prevent index corruption
- Connection timeout handling
- Retry logic for transient failures