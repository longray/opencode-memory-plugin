#!/bin/bash
# Docker test script - rebuilds native modules and runs tests

echo "========================================"
echo "Running Plugin Tests in Docker"
echo "========================================"
echo ""

# Install dependencies and rebuild native modules
echo "Installing dependencies..."
npm install 2>&1 | tail -2

# Rebuild better-sqlite3 for this platform
echo "Rebuilding native modules..."
npm rebuild better-sqlite3 2>&1 | tail -1

echo ""
echo "Running tests..."
echo ""

# Run tests
node << 'NODESCRIPT'
import('./plugin.js').then(async ({ MemoryPlugin }) => {
  console.log('Testing Plugin Tools...');
  console.log('');
  
  const plugin = await MemoryPlugin({});
  const results = { passed: 0, failed: 0 };
  
  // Test 1: memory_write
  try {
    const r = await plugin.tools.memory_write.execute({
      content: 'Docker test: Vector search implementation.',
      type: 'test',
      tags: ['docker', 'test']
    });
    console.log('1. memory_write:', r.success ? '✓ PASS' : '✗ FAIL');
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('1. memory_write: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 2: memory_read
  try {
    const r = await plugin.tools.memory_read.execute({ file: 'MEMORY.md' });
    console.log('2. memory_read:', r.success ? '✓ PASS' : '✗ FAIL', '-', r.lines, 'lines');
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('2. memory_read: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 3: memory_search
  try {
    const r = await plugin.tools.memory_search.execute({ query: 'test' });
    console.log('3. memory_search:', r.success ? '✓ PASS' : '✗ FAIL', '-', r.count, 'matches');
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('3. memory_search: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 4: list_daily
  try {
    const r = await plugin.tools.list_daily.execute({ days: 7 });
    console.log('4. list_daily:', r.success ? '✓ PASS' : '✗ FAIL', '-', r.count, 'files');
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('4. list_daily: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 5: init_daily
  try {
    const r = await plugin.tools.init_daily.execute({});
    console.log('5. init_daily:', r.success ? '✓ PASS' : '✗ FAIL');
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('5. init_daily: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 6: index_status
  try {
    const r = await plugin.tools.index_status.execute({});
    console.log('6. index_status:', r.success ? '✓ PASS' : '✗ FAIL');
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('6. index_status: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 7: rebuild_index
  try {
    const r = await plugin.tools.rebuild_index.execute({ force: true });
    console.log('7. rebuild_index:', r.success ? '✓ PASS' : '✗ FAIL');
    if (r.success) {
      console.log('   Indexed files:', r.indexedFiles);
      console.log('   Total chunks:', r.totalChunks);
    } else {
      console.log('   Error:', r.error);
      console.log('   Fallback:', r.fallback);
    }
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('7. rebuild_index: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  // Test 8: vector_memory_search
  try {
    const r = await plugin.tools.vector_memory_search.execute({
      query: 'docker test',
      limit: 3
    });
    console.log('8. vector_memory_search:', r.success ? '✓ PASS' : '✗ FAIL', '-', r.mode, 'mode');
    if (r.note) console.log('   Note:', r.note);
    r.success ? results.passed++ : results.failed++;
  } catch (e) {
    console.log('8. vector_memory_search: ✗ FAIL -', e.message);
    results.failed++;
  }
  
  console.log('');
  console.log('========================================');
  console.log('Summary');
  console.log('========================================');
  console.log('Passed:', results.passed);
  console.log('Failed:', results.failed);
  console.log('');
  
  if (results.failed === 0) {
    console.log('✓ All 8 tests passed in Docker!');
    process.exit(0);
  } else {
    console.log('✗ Some tests failed');
    process.exit(1);
  }
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
NODESCRIPT