## Why

The codebase has **6 duplicate implementations** of atomic file write logic with EXDEV fallback across `entry.js`, `indexer.js`, `memory-id-cache.js`, `project-resolver.js`, and `trie-index.js`. This violates DRY principle and creates maintenance burden. When the atomic write pattern needs updates (e.g., better error handling, performance improvements), developers must remember to update all 6 locations.

Additionally, the `writeLog` function is duplicated between `wrapper-client.js` and `sync.js`, with the `sync.js` version **missing sensitive data redaction**, creating a potential security risk for API key leakage in logs.

## What Changes

- **Extract** `atomicWriteText()` and `atomicWriteJson()` into new `lib/atomic-write.js` module
- **Extract** `writeLog()` with sensitive data redaction into `lib/logger.js` (enhance existing)
- **Replace** all 6 duplicate EXDEV handlers with imports from `lib/atomic-write.js`
- **Unify** `writeLog()` usage across `wrapper-client.js` and `sync.js`
- **Add** comprehensive tests for atomic write operations
- **Document** the atomic write pattern in AGENTS.md

## Capabilities

### New Capabilities

- `atomic-write`: Reliable atomic file write operations with EXDEV fallback for cross-device moves

### Modified Capabilities

- `logging`: Enhanced to include sensitive data redaction and unified writeLog implementation

## Impact

- **Files modified**: `lib/entry.js`, `lib/indexer.js`, `lib/memory-id-cache.js`, `lib/project-resolver.js`, `lib/trie-index.js`, `lib/wrapper-client.js`, `lib/sync.js`
- **Files created**: `lib/atomic-write.js` (new module)
- **Tests**: New test file `tests/atomic-write.test.js`
- **Security**: Eliminates potential API key leakage in sync.js logs
- **Maintenance**: Single source of truth for atomic write pattern

---

## Status

**Completed**: 2026-04-27

**Outcome**: ✅ Success

**Summary**:
- Created `lib/atomic-write.js` with `atomicWriteText()` and `atomicWriteJson()`
- Enhanced `lib/logger.js` with `redactSensitive()` and `writeLog()`
- Replaced 6 EXDEV duplicates across 5 files
- Unified `writeLog()` in `wrapper-client.js`
- Net code reduction: ~47 lines
- All 483 tests passed, 0 LSP errors

**Modified Files**:
1. `lib/atomic-write.js` (new, +47 lines)
2. `lib/logger.js` (+35 lines)
3. `lib/entry.js` (import change)
4. `lib/indexer.js` (import + re-export)
5. `lib/memory-id-cache.js` (use atomicWriteJson)
6. `lib/project-resolver.js` (use atomicWriteJson)
7. `lib/trie-index.js` (use atomicWriteText)
8. `lib/wrapper-client.js` (import writeLog from logger)

**Key Insight**: Backward compatibility requires re-export pattern - `indexer.js` re-exports from `atomic-write.js` because `tools/core.js`, `lib/memory-core.js`, and tests import from `indexer.js`.

**Task 4.2 Cancelled**: `lib/sync.js` does not exist (writeLog only in wrapper-client.js).
