## Context

Currently, the atomic file write pattern (write to temp → rename → EXDEV fallback → copy → unlink) is implemented **6 times** across the codebase:

1. `lib/entry.js:6-19` - `atomicWriteText()`
2. `lib/indexer.js:7-20` - `atomicWriteText()` (identical)
3. `lib/indexer.js:24-37` - `atomicWriteJson()`
4. `lib/memory-id-cache.js:94-104` - EXDEV handler
5. `lib/project-resolver.js:292-302` - EXDEV handler
6. `lib/trie-index.js:317-330` - EXDEV handler

Additionally, `writeLog()` is implemented twice:

- `lib/wrapper-client.js:89-98` - with `redactSensitive()`
- `lib/sync.js:10-18` - **without** redaction (security risk)

## Goals / Non-Goals

**Goals:**

- Extract atomic write utilities into a single reusable module
- Unify logging with sensitive data redaction
- Eliminate code duplication (DRY)
- Improve maintainability (one place to update)
- Fix security vulnerability in sync.js logging
- Add comprehensive tests for atomic write operations

**Non-Goals:**

- Change the atomic write algorithm (keep existing behavior)
- Add new features to logging beyond redaction
- Refactor unrelated code
- Change file format or storage structure

## Decisions

### Decision 1: Create `lib/atomic-write.js` module

**Rationale**: Centralizes atomic write logic. Alternative was to add to `lib/storage.js`, but atomic write is a distinct concern from storage management.

### Decision 2: Keep sync I/O (not async)

**Rationale**: All current usages are in synchronous contexts. Changing to async would require cascading changes throughout the codebase. Consider async version in future if needed.

### Decision 3: Enhance existing `lib/logger.js` vs create new

**Rationale**: `lib/logger.js` already exists with pino setup. We'll add `writeLog()` there and export for use across modules.

### Decision 4: Preserve exact error handling behavior

**Rationale**: To minimize risk, keep existing error handling (console.warn on EXDEV, throw on other errors). Can be enhanced later.

## Risks / Trade-offs

| Risk                                       | Mitigation                                                     |
| ------------------------------------------ | -------------------------------------------------------------- |
| **Regression in file write operations**    | Comprehensive tests covering success, EXDEV, and error cases   |
| **Breaking change if exports mismatch**    | Keep function signatures identical, only move implementation   |
| **Performance impact from module imports** | Negligible - modules are cached after first import             |
| **Missing edge cases in EXDEV handling**   | Test on Windows (common EXDEV scenario with cross-drive moves) |

## Migration Plan

1. Create `lib/atomic-write.js` with extracted functions
2. Update `lib/logger.js` with unified `writeLog()`
3. Replace implementations in target files with imports
4. Run full test suite
5. Manual verification on Windows (if possible)

## Open Questions

- Should we add async versions of atomic write functions for future use?
- Should EXDEV handling include retry logic with exponential backoff?
