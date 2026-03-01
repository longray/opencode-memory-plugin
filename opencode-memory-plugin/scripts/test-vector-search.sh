#!/bin/bash
# Comprehensive test script for vector search implementation

set -e

echo "========================================"
echo "Vector Search Implementation Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_cmd="$2"
    
    echo -e "${BLUE}Running: ${test_name}${NC}"
    
    if eval "$test_cmd"; then
        echo -e "  ${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "  ${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Setup
echo -e "${YELLOW}Setting up test environment...${NC}"
cd opencode-memory-plugin

# Create test memory content
mkdir -p ~/.opencode/memory/daily 2>/dev/null || true

cat > ~/.opencode/memory/MEMORY.md << 'MEMEOF'
# Memory Test File

## Preference Entry
**Date**: 2024-01-01
**Type**: preference

User prefers TypeScript for all new projects. They like strict type checking and explicit interfaces.

---

## Decision Entry
**Date**: 2024-01-02
**Type**: decision

Decided to use SQLite for local storage due to simplicity and zero-config requirement.

---

## Learning Entry
**Date**: 2024-01-03
**Type**: note

Learned that embedding models work best with chunked text. The all-MiniLM-L6-v2 model provides good balance between speed and quality.

---

## Pattern Entry
**Date**: 2024-01-04
**Type**: pattern

When implementing vector search, always normalize embeddings for cosine similarity. Use mean pooling for sentence embeddings.
MEMEOF

echo -e "${GREEN}✓ Test memory file created${NC}"
echo ""

# Test 1: Module import
echo -e "${YELLOW}Test 1: Module Imports${NC}"
echo "--------------------------------"

run_test "Import vector-store module" "node -e \"import('./lib/vector-store.js').then(() => console.log('Module imported successfully')).catch(e => { console.error(e.message); process.exit(1); })\""

# Test 2: VectorStore initialization
echo -e "${YELLOW}Test 2: VectorStore Initialization${NC}"
echo "--------------------------------------"

run_test "Initialize VectorStore" "node -e \"
import { getVectorStore } from './lib/vector-store.js';
const vs = getVectorStore();
const result = await vs.initialize();
if (result.success || result.fallback) {
  console.log('Initialized:', result.model || 'fallback mode');
  process.exit(0);
} else {
  console.error('Failed:', result.error);
  process.exit(1);
}
\""

# Test 3: Document indexing
echo -e "${YELLOW}Test 3: Document Indexing${NC}"
echo "----------------------------------"

run_test "Index test document" "node -e \"
import { getVectorStore } from './lib/vector-store.js';
import fs from 'fs';
const vs = getVectorStore();
await vs.initialize();
const content = fs.readFileSync(process.env.HOME + '/.opencode/memory/MEMORY.md', 'utf-8');
const result = await vs.indexDocument(content, 'MEMORY.md');
console.log('Indexed chunks:', result.indexed);
if (result.indexed > 0) process.exit(0);
else process.exit(1);
\""

# Test 4: Semantic search
echo -e "${YELLOW}Test 4: Semantic Search${NC}"
echo "--------------------------------"

run_test "Search for 'programming language preference'" "node -e \"
import { getVectorStore } from './lib/vector-store.js';
const vs = getVectorStore();
await vs.initialize();
const results = await vs.search('What programming language does the user like?', { limit: 3, threshold: 0.2 });
console.log('Results:', results.length);
if (results.length > 0) {
  console.log('Top result score:', results[0].score.toFixed(3));
  process.exit(0);
}
process.exit(1);
\""

# Test 5: Hybrid search
echo -e "${YELLOW}Test 5: Hybrid Search${NC}"
echo "--------------------------------"

run_test "Hybrid search for 'TypeScript'" "node -e \"
import { getVectorStore } from './lib/vector-store.js';
const vs = getVectorStore();
await vs.initialize();
const results = await vs.hybridSearch('TypeScript preference', { limit: 3 });
console.log('Results:', results.length);
if (results.length > 0) process.exit(0);
else process.exit(1);
\""

# Test 6: Keyword search
echo -e "${YELLOW}Test 6: Keyword Search (Fallback)${NC}"
echo "----------------------------------------"

run_test "Keyword search for 'SQLite'" "node -e \"
import { getVectorStore } from './lib/vector-store.js';
const vs = getVectorStore();
await vs.initialize();
const results = vs.keywordSearch('SQLite', { limit: 3 });
console.log('Results:', results.length);
if (results.length > 0) process.exit(0);
else process.exit(1);
\""

# Test 7: Status check
echo -e "${YELLOW}Test 7: Status Check${NC}"
echo "--------------------------------"

run_test "Get vector store status" "node -e \"
import { getVectorStore } from './lib/vector-store.js';
const vs = getVectorStore();
await vs.initialize();
const status = vs.getStatus();
console.log('Initialized:', status.initialized);
console.log('Model:', status.model);
console.log('Total Chunks:', status.totalChunks);
if (status.totalChunks > 0) process.exit(0);
else process.exit(1);
\""

# Test 8: Plugin tools
echo -e "${YELLOW}Test 8: Plugin Tools${NC}"
echo "--------------------------------"

run_test "Test memory_write tool" "node -e \"
import { MemoryPlugin } from './plugin.js';
const plugin = await MemoryPlugin({});
const result = await plugin.tools.memory_write.execute({ content: 'Test entry for vector search', type: 'test', tags: ['test'] });
console.log('Write result:', result.success);
if (result.success) process.exit(0);
else process.exit(1);
\""

run_test "Test memory_search tool" "node -e \"
import { MemoryPlugin } from './plugin.js';
const plugin = await MemoryPlugin({});
const result = await plugin.tools.memory_search.execute({ query: 'Test', file: 'MEMORY.md' });
console.log('Search results:', result.count);
if (result.success && result.count >= 0) process.exit(0);
else process.exit(1);
\""

run_test "Test list_daily tool" "node -e \"
import { MemoryPlugin } from './plugin.js';
const plugin = await MemoryPlugin({});
const result = await plugin.tools.list_daily.execute({ days: 7 });
console.log('Daily files:', result.count);
if (result.success) process.exit(0);
else process.exit(1);
\""

run_test "Test index_status tool" "node -e \"
import { MemoryPlugin } from './plugin.js';
const plugin = await MemoryPlugin({});
const result = await plugin.tools.index_status.execute({});
console.log('Config version:', result.config?.version);
console.log('Vector index:', result.vectorIndex?.initialized);
if (result.success) process.exit(0);
else process.exit(1);
\""

# Summary
echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi