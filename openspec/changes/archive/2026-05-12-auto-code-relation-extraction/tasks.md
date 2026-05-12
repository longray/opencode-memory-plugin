## 1. Symbol Table Module

- [x] 1.1 Create `lib/symbol-table.js` with SymbolTable class
- [x] 1.2 Implement path-to-entity mapping (pathToEntityId Map)
- [x] 1.3 Implement global name mapping (globalNameToEntityId Map)
- [x] 1.4 Add path resolution logic (resolveImportPath function)
- [x] 1.5 Integrate with MemoryIdCache for persistence
- [x] 1.6 Add symbol table cache management (LRU eviction)
- [x] 1.7 Write unit tests for SymbolTable class

## 2. Cross-File Symbol Resolution

- [x] 2.1 Implement relative path resolution (./utils -> /project/src/utils.js)
- [x] 2.2 Add file extension resolution (.js, .ts, .mjs, .cjs, /index.js)
- [x] 2.3 Handle external dependencies (skip node_modules and built-ins)
- [x] 2.4 Add path alias support (configurable tsconfig paths)
- [x] 2.5 Implement symbol lookup by path
- [x] 2.6 Add error handling for unresolved paths
- [x] 2.7 Write integration tests for path resolution

## 3. Global Symbol Table

- [x] 3.1 Extract exported symbols from AST (functions, classes, variables)
- [x] 3.2 Build global name to entity ID mapping
- [x] 3.3 Handle name collisions (use file path as namespace)
- [x] 3.4 Implement symbol lookup by name
- [x] 3.5 Add symbol table persistence (save/load to JSON)
- [x] 3.6 Implement cache invalidation on file change
- [x] 3.7 Write tests for global symbol extraction

## 4. Auto Depends-On Extraction

- [x] 4.1 Extract import statements from AST (ES6 imports, require)
- [x] 4.2 Resolve import paths to entity IDs using symbol table
- [x] 4.3 Create depends_on relationships for internal imports
- [x] 4.4 Add relationship metadata (import names, type, weight)
- [x] 4.5 Implement duplicate detection
- [x] 4.6 Integrate into code-analysis-service.js upload flow
- [x] 4.7 Write tests for depends_on extraction

## 5. Auto Calls Extraction

- [x] 5.1 Extract call expressions from AST (direct calls, member calls)
- [x] 5.2 Resolve call targets using global symbol table
- [x] 5.3 Create calls relationships for resolved targets
- [x] 5.4 Add call metadata (frequency, line numbers)
- [x] 5.5 Skip built-in function calls (console, Array, etc.)
- [x] 5.6 Handle cross-file call resolution
- [x] 5.7 Write tests for calls extraction

## 6. Auto Extends Extraction

- [x] 6.1 Extract class inheritance from AST (extends, implements)
- [x] 6.2 Resolve parent class to entity ID
- [x] 6.3 Create extends relationships
- [x] 6.4 Create implements relationships for interfaces
- [x] 6.5 Track multi-level inheritance chains
- [x] 6.6 Detect and report circular inheritance
- [x] 6.7 Write tests for extends extraction

## 7. Scheduled Health Check

- [x] 7.1 Add health check configuration (schedule, threshold, enabled)
- [x] 7.2 Implement setInterval-based scheduler in plugin.js
- [x] 7.3 Add async health check execution
- [x] 7.4 Implement health report generation
- [x] 7.5 Add threshold alerting (console warnings)
- [x] 7.6 Save reports to ~/.opencode/reports/
- [x] 7.7 Add timeout protection (60s max)
- [x] 7.8 Write tests for scheduled execution

## 8. Dual Threshold Recommendation

- [x] 8.1 Add recommendation configuration (thresholds, auto_create)
- [x] 8.2 Implement dual threshold logic (>0.85 auto, 0.75-0.85 review)
- [x] 8.3 Create pending review queue data structure
- [x] 8.4 Implement review queue persistence
- [x] 8.5 Add queue management (add/approve/reject/expire)
- [x] 8.6 Display review queue UI
- [x] 8.7 Auto-trigger recommendation on new entity
- [x] 8.8 Write tests for dual threshold logic

## 9. Integration

- [x] 9.1 Modify code-analysis-service.js to build symbol table before upload
- [x] 9.2 Add two-pass upload (first pass: upload, second pass: create relations)
- [x] 9.3 Update plugin.js to initialize scheduled tasks
- [ ] 9.4 Add configuration validation
- [ ] 9.5 Update memory-config.json schema
- [x] 9.6 Write integration tests for full workflow

## 10. Testing & Validation

- [x] 10.1 Unit tests for all new modules (>80% coverage)
- [x] 10.2 Integration tests for code analysis with relations
- [ ] 10.3 Performance tests for large projects (1000+ files)
- [x] 10.4 Regression tests for existing functionality
- [x] 10.5 Manual testing: verify depends_on creation
- [x] 10.6 Manual testing: verify calls creation
- [x] 10.7 Manual testing: verify scheduled health check
- [x] 10.8 Manual testing: verify dual threshold recommendation

## 11. Documentation

- [x] 11.1 Update CONFIGURATION.md with new options
- [ ] 11.2 Add symbol-table.md documentation
- [ ] 11.3 Update code-analysis documentation
- [ ] 11.4 Add troubleshooting guide for relation extraction
- [x] 11.5 Update CHANGELOG.md

## 12. Deployment

- [x] 12.1 Version bump (v3.3.0)
- [ ] 12.2 Update package.json dependencies
- [x] 12.3 Run full test suite
- [ ] 12.4 Create release notes
- [ ] 12.5 Tag release
- [ ] 12.6 Update documentation site
