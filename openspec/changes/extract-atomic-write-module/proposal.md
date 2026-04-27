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
