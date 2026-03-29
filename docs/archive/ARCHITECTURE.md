# OpenCode Memory Plugin - Architecture (v2.3.0)

## Overview

OpenCode Memory Plugin v2.3.0 is a sophisticated memory management system with:

- **Backend-First Architecture**: All vector operations handled by SurrealDB backend
- **Dual-Mode Sync**: Incremental (fingerprint-based) + Full sync with resume support
- **Conflict Resolution**: Automatic detection, smart auto-resolve, manual merge
- **Timeline Structure**: Date-based memory organization (`timeline/YYYY/MM/DD/`)
- **Graph Relations**: Semantic connections between memories
- **Real-time Updates**: WebSocket live synchronization

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           OpenCode Runtime                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ memory_write │  │ memory_search│  │ 19 Tools...  │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Plugin Core   │
                    │   (plugin.js)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐        ┌─────▼──────┐      ┌────▼─────┐
   │  Local   │        │  Wrapper   │      │   Trie   │
   │  Files   │        │  Client    │      │  Index   │
   │          │        │            │      │          │
   │ timeline/│        │ HTTP/WS    │      │ <10ms    │
   │ MEMORY.md│        │            │      │ Search   │
   └──────────┘        └─────┬──────┘      └──────────┘
                             │
                    ┌────────▼────────────────────┐
                    │   Backend Service           │
                    │   (localhost:17999)         │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │   SurrealDB           │  │
                    │  │   - HNSW Vector Index │  │
                    │  │   - Graph Relations   │  │
                    │  │   - Multi-tenant      │  │
                    │  └───────────────────────┘  │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │   Meilisearch         │  │
                    │  │   - BM25 Full-text    │  │
                    │  │   - Chinese Support   │  │
                    │  └───────────────────────┘  │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │   Embedding Service   │  │
                    │  │   - ModelScope API    │  │
                    │  │   - Qwen3-Embedding   │  │
                    │  └───────────────────────┘  │
                    └─────────────────────────────┘
```

## Components

### 1. Plugin Core (`plugin.js`)

**Purpose**: OpenCode plugin entry point, registers all 19 memory tools

**Responsibilities**:

- Tool registration and validation
- Request routing to appropriate handlers
- Error handling and fallback logic
- Auto-trigger event handling

**Tools Registered** (19 total):

| Category | Tools                                                                                                                                                   | Count |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Core     | memory_write, memory_read, memory_search, memory_relate, memory_graph, memory_suggest, sync_status, list_daily, init_daily, rebuild_index, index_status | 11    |
| Sync     | incremental_sync, full_sync, sync_checkpoint, batch_resolve                                                                                             | 4     |
| Browser  | memory_timeline, memory_topics                                                                                                                          | 2     |
| Conflict | conflict_list, conflict_resolve                                                                                                                         | 2     |

### 2. Wrapper Client (`lib/wrapper-client.js`)

**Purpose**: HTTP client for backend API communication

**Key Methods**:

```javascript
class WrapperClient {
  async health()              // Check backend health
  async search(query, mode)   // Vector/keyword/hybrid search
  async upload(entry)         // Upload single memory
  async uploadBatch(entries)  // Batch upload
  async relate(...)          // Create graph relations
  async graph(...)           // Graph traversal
  async getCheckpoint(...)    // Sync checkpoint management
  async resolveConflict(...)  // Conflict resolution
}
```

**Features**:

- Automatic retry with exponential backoff
- Health checking before operations
- Fallback to local operations on failure
- WebSocket integration for real-time updates

### 3. Project Resolver (`lib/project-resolver.js`)

**Purpose**: Resolve unique project identifier for memory isolation

**Resolution Strategy** (priority order):

1. **Configuration**: `backend.project_id` in config file
2. **Git Remote**: Parse remote URL to unique ID
3. **Package.json**: Use `name` field
4. **Directory**: Absolute path hash

**Caching**:

- Persistent mappings in `~/.opencode/memory/project-mappings.json`
- Fingerprint-based validation
- Cache expiration after 24 hours

### 4. Trie Index (`lib/trie.js` + `lib/trie-index.js`)

**Purpose**: Fast local search and autocomplete

**Performance**:

- Search latency: <10ms (target: <10ms, achieved: 7.61ms avg)
- Autocomplete: <50ms (target: <50ms, achieved: 10.62ms avg)
- Memory efficient: O(n) space complexity

**Use Cases**:

- `memory_suggest`: Autocomplete suggestions
- Local keyword search fallback
- Prefix-based filtering

### 5. WebSocket Client (`lib/ws-client.js`)

**Purpose**: Real-time synchronization with backend

**Features**:

- Auto-reconnect with exponential backoff
- Connection state management (connected/connecting/disconnected)
- Live memory updates
- Sync status monitoring

**Events**:

```javascript
// Connection states
ws.on('connected', () => { ... })
ws.on('disconnected', () => { ... })
ws.on('error', (err) => { ... })

// Memory updates
ws.on('memory:created', (entry) => { ... })
ws.on('memory:updated', (entry) => { ... })
ws.on('memory:deleted', (id) => { ... })
```

### 6. BM25 Index (`lib/bm25.js`)

**Purpose**: Local keyword search fallback

**Features**:

- Chinese tokenization support
- BM25 scoring algorithm
- No external dependencies
- Works offline

### 7. Memory Files (OpenClaw Style)

**Core Memory Files**:

```
memory/
├── SOUL.md          # Personality, tone, boundaries
├── AGENTS.md        # Operating instructions
├── USER.md          # User profile
├── IDENTITY.md      # Assistant identity
├── TOOLS.md         # Tool conventions
├── MEMORY.md        # Long-term memory index
├── HEARTBEAT.md     # Health checklist
├── BOOT.md          # Startup checklist
└── BOOTSTRAP.md     # One-time ritual
```

**Timeline Structure** (v2.3+):

```
memory/
└── timeline/
    └── 2026/
        └── 03/
            ├── 16/
            │   ├── entry-001.md
            │   └── entry-002.md
            ├── 17/
            └── 23/
```

**Benefits**:

- Better organization (grouped by date)
- Scalability (no single directory with thousands of files)
- Timeline browser support
- Easier archival and cleanup

### 8. Auto-Trigger Mechanism

**Purpose**: Automatically save important information from conversations

**Workflow**:

```
OpenCode emits session.idle
        ↓
Plugin checks smart filters
        ↓
    ┌───────────────┐
    │   Filters:    │
    │ - New msgs > 3│
    │ - Total > 500 │
    │ - Not trivial │
    └───────┬───────┘
            ↓
    Passes filters?
            ↓
    ┌───Yes───┐    ┌────No────┐
    │ Invoke  │    │  Skip    │
    │ Agent   │    │          │
    └────┬────┘    └──────────┘
         ↓
memory-automation agent
         ↓
    Analyzes conversation
         ↓
    Identifies important info
         ↓
    Calls memory_write
         ↓
    Sets cooldown period
```

**Configuration**:

```json
{
  "auto_trigger": {
    "enabled": true,
    "min_new_messages": 3,
    "min_total_chars": 500,
    "cooldown_minutes": 30
  }
}
```

## Data Flow

### 1. Write Memory (`memory_write`)

```
User calls memory_write(content, type, tags)
        ↓
Plugin creates entry with:
  - source_id (MD5 hash)
  - tenant_id (username)
  - project_id (resolved)
  - created_at / updated_at
        ↓
Write to local file:
  - type="long-term" → memory/MEMORY.md
  - type="daily" → timeline/YYYY/MM/DD/
  - type="preference" → memory/PREFERENCES.md
        ↓
Async upload to backend:
  - WrapperClient.upload()
  - Retry on failure (max 3)
  - Queue failed uploads
        ↓
Update Trie index (local)
        ↓
Return success to user
```

### 2. Search Memory (`memory_search`)

```
User calls memory_search(query, mode)
        ↓
Check backend health
        ↓
    ┌─────────────────────────┐
    │ Backend Available?      │
    └────────┬────────────────┘
             │
    ┌────────▼────────┐
    │       Yes       │
    └────────┬────────┘
             │
    WrapperClient.search(query, mode)
             ↓
    ┌────────┴────────┐
    │   mode="hybrid" │ → 70% vector + 30% BM25
    │   mode="vector" │ → HNSW similarity
    │   mode="keyword"│ → Meilisearch BM25
    └────────┬────────┘
             │
    Backend returns results
             │
    ┌────────▼────────┐
    │       No        │
    └────────┬────────┘
             │
    Fallback to local:
    - BM25 search
    - Trie prefix match
             ↓
    Return combined results
```

### 3. Incremental Sync (`incremental_sync`)

```
User calls incremental_sync()
        ↓
Get local memory files
        ↓
Calculate fingerprints (MD5)
        ↓
Compare with backend checkpoint
        ↓
    ┌─────────────────────────┐
    │   Identify Changes:     │
    │ - New entries (local)   │
    │ - Modified entries      │
    │ - Deleted entries       │
    └────────┬────────────────┘
             │
    Upload changes only
             │
    Update checkpoint
             │
    Return sync stats
```

### 4. Conflict Resolution

```
Conflict detected during sync
        ↓
    ┌─────────────────────────┐
    │   Conflict Types:       │
    │ - content_diff          │
    │ - timestamp_diff        │
    │ - metadata_diff         │
    └────────┬────────────────┘
             │
    ┌────────▼────────┐
    │  Auto-resolve?  │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │   Can Auto?     │
    └────────┬────────┘
             │
    ┌────────▼────────┐    ┌─────────────┐
    │       Yes       │    │     No      │
    │  (timestamp,    │    │  Add to     │
    │   simple diff)  │    │  conflict   │
    └────────┬────────┘    │  queue      │
             │             └──────┬──────┘
    Apply resolution              │
             │                    │
    Update backend         User calls
             │          conflict_resolve()
             │                    │
             └────────────────────┘
                      ↓
              Manual resolution:
              - USE_LOCAL
              - USE_BACKEND
              - MERGE
```

## Sync Architecture (v2.3)

### Sync Storage

```
.sync/
├── checkpoint.jsonl      # Sync checkpoints
├── progress.json         # Full sync progress
└── conflicts.json        # Unresolved conflicts
```

**Checkpoint Format**:

```json
{
  "id": "cp_20260323_001",
  "timestamp": "2026-03-23T10:00:00Z",
  "entries_count": 137,
  "fingerprint": "abc123...",
  "stats": {
    "uploaded": 10,
    "skipped": 120,
    "conflicts": 7
  }
}
```

### Conflict Detection

**Detection Logic**:

```javascript
function detectConflict(local, backend) {
  // Check content hash
  if (local.content_hash !== backend.content_hash) {
    return { type: "content_diff" };
  }

  // Check timestamp
  if (local.updated_at !== backend.updated_at) {
    return { type: "timestamp_diff" };
  }

  // Check metadata
  if (JSON.stringify(local.metadata) !== JSON.stringify(backend.metadata)) {
    return { type: "metadata_diff" };
  }

  return null; // No conflict
}
```

### Auto-Resolve Strategy

| Conflict Type           | Strategy                     |
| ----------------------- | ---------------------------- |
| `timestamp_diff`        | Latest timestamp wins        |
| `content_diff` (simple) | Longer content wins if >1.5x |
| `metadata_diff`         | Merge metadata               |

## API Contract

### Backend Service API (localhost:17999)

**Health Check**:

```http
GET /api/v1/health
→ { "status": "ok", "version": "2.3.0" }
```

**Search**:

```http
POST /api/v1/search
{
  "query": "typescript patterns",
  "mode": "hybrid",
  "limit": 10,
  "tenant_id": "user123",
  "project_id": "project456"
}
→ {
  "results": [...],
  "total": 25,
  "mode": "hybrid",
  "latency_ms": 45
}
```

**Upload**:

```http
POST /api/v1/memories
{
  "content": "...",
  "type": "long-term",
  "tags": ["typescript"],
  "tenant_id": "user123",
  "project_id": "project456",
  "source_id": "abc123"
}
→ { "id": "mem_001", "status": "created" }
```

**Graph Relations**:

```http
POST /api/v1/relations
{
  "from_id": "mem_001",
  "to_id": "mem_002",
  "relation_type": "related",
  "weight": 0.8
}
→ { "status": "created" }
```

**Sync Checkpoint**:

```http
GET /api/v1/sync/checkpoint?tenant_id=user123&project_id=project456
→ {
  "id": "cp_001",
  "timestamp": "...",
  "fingerprint": "...",
  "entries_count": 137
}
```

### Embedding Service API (ModelScope)

**Request**:

```http
POST https://api-inference.modelscope.cn/v1/embeddings
Authorization: Bearer <MODELSCOPE_API_KEY>
{
  "model": "Qwen/Qwen3-Embedding-0.6B",
  "input": "text to embed"
}
```

**Response**:

```json
{
  "data": [{
    "embedding": [0.1, 0.2, ...],  // 1024 dimensions
    "index": 0
  }],
  "model": "Qwen/Qwen3-Embedding-0.6B",
  "usage": {
    "prompt_tokens": 10,
    "total_tokens": 10
  }
}
```

## Performance Characteristics

### Latency Targets

| Operation        | Target | Achieved     | Backend       |
| ---------------- | ------ | ------------ | ------------- |
| Trie Search      | <10ms  | 7.61ms       | Local         |
| Autocomplete     | <50ms  | 10.62ms      | Local         |
| Hybrid Search    | <100ms | ~50ms        | Backend       |
| Memory Write     | <20ms  | ~15ms        | Local + Async |
| Incremental Sync | Varies | Only changes | Backend       |

### Memory Usage

| Component   | Memory       | Notes              |
| ----------- | ------------ | ------------------ |
| Trie Index  | ~5-10MB      | Local memory files |
| BM25 Index  | ~5MB         | Fallback only      |
| Plugin Core | ~20MB        | Base overhead      |
| **Total**   | **~30-40MB** | Without backend    |

### Scalability

| Metric            | Limit        | Notes                          |
| ----------------- | ------------ | ------------------------------ |
| Memory Entries    | 100K+        | Timeline structure scales well |
| Concurrent Users  | Multi-tenant | tenant_id isolation            |
| Projects per User | Unlimited    | project_id isolation           |
| File Size         | No limit     | Chunked for embedding          |

## Security Considerations

### Data Isolation

- **Tenant Isolation**: All queries filtered by `tenant_id`
- **Project Isolation**: Secondary filter by `project_id`
- **Source Deduplication**: `source_id` prevents duplicates

### Network Security

- Backend service on localhost (not exposed)
- Embedding API uses HTTPS with API key
- WebSocket uses WSS in production

### Access Control

- No authentication for localhost services (trusted environment)
- API key required for external embedding services
- No sensitive data in memory files (user responsibility)

## Error Handling

### Graceful Degradation

```
Backend Available
      ↓
    ┌─Yes─┐    ┌───No───┐
    │ Full │    │ Fallback│
    │ Mode │    │  Mode   │
    └──┬───┘    └────┬────┘
       │             │
       │      ┌──────▼──────┐
       │      │  BM25 Local │
       │      │  Trie Index │
       │      └─────────────┘
       │
  ┌────▼─────────────────┐
  │  SurrealDB HNSW      │
  │  Meilisearch BM25    │
  │  ModelScope Embed    │
  └──────────────────────┘
```

### Retry Logic

```javascript
const retryConfig = {
  maxAttempts: 3,
  backoff: "exponential",
  initialDelay: 1000,
  maxDelay: 10000,
};
```

### Error Messages

- Clear, actionable error messages
- Suggestions for resolution
- Links to troubleshooting guide

## Migration from v2.2

### Timeline Migration

```bash
# Run migration script
node scripts/migrate-daily-to-timeline.mjs

# What it does:
# 1. Scans daily/ directory
# 2. Parses dates from filenames
# 3. Creates timeline/YYYY/MM/DD/ structure
# 4. Moves files to appropriate directories
# 5. Removes empty daily/ directory
```

### Configuration Update

v2.2 config:

```json
{
  "backend": {
    "url": "http://localhost:17999"
  }
}
```

v2.3 config:

```json
{
  "backend": {
    "url": "http://localhost:17999",
    "sync": {
      "mode": "incremental",
      "auto_sync": true
    }
  },
  "timeline": {
    "enabled": true,
    "base_path": "memory/timeline"
  }
}
```

## Future Enhancements

### Planned Features

- [ ] Embedding cache optimization (80% faster repeated queries)
- [ ] Query prefetch for popular searches
- [ ] HNSW dynamic parameter tuning
- [ ] Memory compression for old entries
- [ ] Automatic archival to cold storage

### Performance Roadmap

| Version | Target | Focus                               |
| ------- | ------ | ----------------------------------- |
| v2.3    | 100%   | Dual-mode sync, conflict resolution |
| v2.4    | +20%   | Cache optimization, prefetch        |
| v2.5    | +10%   | HNSW tuning, compression            |

---

**Last Updated**: 2026-03-23  
**Version**: v2.3.0  
**Maintainer**: OpenCode Memory Plugin Team
