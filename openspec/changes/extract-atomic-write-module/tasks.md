## 1. Create Atomic Write Module

- [ ] 1.1 Create `lib/atomic-write.js` with `atomicWriteText()` function
- [ ] 1.2 Add `atomicWriteJson()` function to `lib/atomic-write.js`
- [ ] 1.3 Add JSDoc documentation for both functions
- [ ] 1.4 Export functions from `lib/atomic-write.js`

## 2. Enhance Logger Module

- [ ] 2.1 Add `redactSensitive()` helper function to `lib/logger.js`
- [ ] 2.2 Add `writeLog()` function with redaction to `lib/logger.js`
- [ ] 2.3 Export `writeLog` from `lib/logger.js`
- [ ] 2.4 Update existing logger exports if needed

## 3. Replace Duplicate Implementations

- [ ] 3.1 Replace `atomicWriteText()` in `lib/entry.js` with import from `lib/atomic-write.js`
- [ ] 3.2 Replace `atomicWriteText()` in `lib/indexer.js` with import from `lib/atomic-write.js`
- [ ] 3.3 Replace EXDEV handler in `lib/memory-id-cache.js` with import from `lib/atomic-write.js`
- [ ] 3.4 Replace EXDEV handler in `lib/project-resolver.js` with import from `lib/atomic-write.js`
- [ ] 3.5 Replace EXDEV handler in `lib/trie-index.js` with import from `lib/atomic-write.js`

## 4. Unify Logging

- [ ] 4.1 Replace `writeLog()` in `lib/wrapper-client.js` with import from `lib/logger.js`
- [ ] 4.2 Replace `writeLog()` in `lib/sync.js` with import from `lib/logger.js`
- [ ] 4.3 Remove duplicate `writeLog` implementations
- [ ] 4.4 Verify sensitive data is redacted in both modules

## 5. Testing

- [ ] 5.1 Create `tests/atomic-write.test.js` with test cases
- [ ] 5.2 Test successful atomic write
- [ ] 5.3 Test EXDEV fallback scenario
- [ ] 5.4 Test error handling
- [ ] 5.5 Test JSON serialization
- [ ] 5.6 Test sensitive data redaction
- [ ] 5.7 Run full test suite and verify no regressions

## 6. Documentation

- [ ] 6.1 Update `AGENTS.md` to reference new `lib/atomic-write.js` module
- [ ] 6.2 Update `openspec/project.md` technical debt section (mark as fixed)
- [ ] 6.3 Add inline comments explaining EXDEV handling

## 7. Verification

- [ ] 7.1 Run `npm run lint` and fix any issues
- [ ] 7.2 Run `npm run test` and ensure all tests pass
- [ ] 7.3 Run `npm run test:coverage` and verify coverage
- [ ] 7.4 Manual test on Windows (if possible) for EXDEV scenario
- [ ] 7.5 Verify no duplicate code remains (code review)
