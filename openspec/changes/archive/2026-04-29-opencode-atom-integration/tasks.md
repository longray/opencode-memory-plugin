## 1. Tool Layer - Core Fixes

- [x] 1.1 Fix memory_write to expose atoms parameter in tools/core.js
  - Add atoms parameter to tool schema
  - Update execute function to pass atoms to writeAndSyncMemory
  - Verify backward compatibility (atoms optional)

- [x] 1.2 Fix syncMemoryToBackend to synchronize atoms in lib/memory-core.js
  - Include atoms in sync payload
  - Ensure atoms are sent to backend API
  - Add test for atom synchronization

- [x] 1.3 Add entity_update tool in tools/core.js
  - Create tool definition with atoms_batch parameter
  - Support actions: add, update, remove
  - Implement cascade option for remove

- [x] 1.4 Add entity_atoms tool in tools/core.js
  - Create tool to retrieve Atom tree
  - Support include_content option
  - Return properly nested tree structure

- [x] 1.5 Extend memory_search to support Atom scope in tools/search.js
  - Add scope parameter ("all", "entity", "atom")
  - Add atom_types filter parameter
  - Return Atom-level results when scope="atom"

- [x] 1.6 Register new tools in plugin.js
  - Import entity_update and entity_atoms
  - Add to tool exports
  - Verify tool registration

## 2. Tool Layer - Testing

- [x] 2.1 Write tests for memory_write with atoms
  - Test creating memory with valid atoms
  - Test backward compatibility (no atoms)
  - Test circular reference detection

- [x] 2.2 Write tests for entity_update
  - Test add action
  - Test update action
  - Test remove with cascade
  - Test remove without cascade (should fail)

- [x] 2.3 Write tests for entity_atoms
  - Test retrieving full tree
  - Test retrieving structure without content
  - Test empty atoms array

- [x] 2.4 Write tests for memory_search with atom scope
  - Test scope="atom" returns Atom results
  - Test atom_types filtering
  - Test hybrid search mode

- [x] 2.5 Write integration tests
  - End-to-end flow: write → sync → search → retrieve
  - Verify atoms persist through sync
  - Verify search finds Atoms correctly

## 3. Prompt Engineering - Documentation

- [x] 3.1 Update SOUL.md with Atom Architecture awareness
  - Add "Atom Architecture 认知" section
  - Explain Entity/Atom hierarchy
  - Provide usage guidelines
  - Include version information

- [x] 3.2 Update AGENTS.md with Atom operation guidelines
  - Add "Atom 操作规范" section
  - Define automatic extraction heuristics
  - Specify when to use Atom vs flat storage
  - Document [[atom_id]] linking

- [x] 3.3 Update TOOLS.md with Atom tool usage
  - Document memory_write with atoms
  - Document entity_update usage
  - Document entity_atoms usage
  - Document atom-scoped search
  - Provide code examples

## 4. Agent Workflow - The Observer

- [ ] 4.1 Update agents/memory-automation.md workflow
  - Add Atom tree extraction step
  - Define structured content detection
  - Add user confirmation for Atom trees
  - Update tool usage examples

- [ ] 4.2 Implement Atom extraction heuristics in The Observer
  - Content length heuristic (>1000 chars)
  - Heading detection heuristic
  - List detection heuristic
  - Code block heuristic

- [ ] 4.3 Test The Observer with sample conversations
  - Test structured conversation extraction
  - Test code discussion extraction
  - Test simple content (no Atom structure)
  - Verify user confirmation flow

## 5. Agent Workflow - The Librarian

- [ ] 5.1 Update agents/memory-consolidate.md workflow
  - Add Atom tree consolidation step
  - Define knowledge tree creation
  - Add relation establishment logic
  - Update tool usage examples

- [ ] 5.2 Implement weekly consolidation with Atoms
  - Scan memories from past 7 days
  - Group by topic and create Atom tree
  - Create "summarizes" relations
  - Mark source memories as consolidated

- [ ] 5.3 Test The Librarian consolidation
  - Test with fragmented memories
  - Verify Atom tree creation
  - Verify relation establishment
  - Verify source memory marking

## 6. Code Analysis Integration

- [ ] 6.1 Add conversation linking in code-analysis-service.js
  - Search for recent related conversations
  - Create "analyzes" relation when found
  - Handle multiple related conversations
  - Log linking decisions

- [ ] 6.2 Test code analysis linking
  - Test file save with related conversation
  - Test file save without related conversation
  - Test multiple related conversations
  - Verify relation creation

## 7. Context Management

- [ ] 7.1 Implement loadContextByLevel in lib/memory-core.js
  - Support maxLevel parameter
  - Return formatted markdown
  - Include parent chain option
  - Add tests

- [ ] 7.2 Implement [[atom_id]] link resolution
  - Parse [[local_id]] format
  - Support [[id|alias]] format
  - Handle broken links
  - Add tests

- [ ] 7.3 Implement context budget management
  - Relevance scoring for Atoms
  - Budget-constrained loading
  - Progressive loading on demand
  - Add tests

## 8. Verification and Documentation

- [x] 8.1 Run full test suite
  - All new tests pass
  - Existing tests still pass
  - Coverage > 80%

- [x] 8.2 Run linting
  - npm run lint passes
  - No new warnings
  - Code style consistent

- [x] 8.3 Update main documentation
  - Update README.md with new features
  - Update CHANGELOG.md
  - Update AGENTS.md (project root)

- [x] 8.4 Create migration guide
  - Document new capabilities
  - Provide examples
  - Note backward compatibility

## 9. Final Review

- [x] 9.1 Code review
  - Review all changes
  - Check for edge cases
  - Verify error handling

- [x] 9.2 Integration testing
  - End-to-end workflow test
  - Performance test
  - Backward compatibility test

- [x] 9.3 Documentation review
  - Check all docs are updated
  - Verify examples work
  - Check for typos

- [x] 9.4 Archive change
  - Run /opsx-archive
  - Verify all artifacts complete
  - Update project status
