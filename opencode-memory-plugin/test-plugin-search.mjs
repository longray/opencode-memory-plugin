#!/usr/bin/env node

/**
 * Test Backlog 2.2: Plugin memory_search refactoring
 */

import { memory_search } from './tools/search.js';

async function testPluginSearch() {
  console.log('=== Test 1: Basic search ===');
  const result1 = await memory_search.execute({ query: 'test' });
  console.log('Result type:', typeof result1);
  console.log('Result length:', result1?.length || 0);
  console.log('Result:', result1.substring(0, 200) || result1);
  console.log('');

  console.log('=== Test 2: Search with vector mode ===');
  const result2 = await memory_search.execute({ query: 'test', mode: 'vector' });
  console.log('Result type:', typeof result2);
  console.log('Result length:', result2?.length || 0);
  console.log('Result:', result2.substring(0, 200) || result2);
  console.log('');

  console.log('=== Test 3: Search with keyword mode ===');
  const result3 = await memory_search.execute({ query: 'test', mode: 'keyword' });
  console.log('Result type:', typeof result3);
  console.log('Result length:', result3?.length || 0);
  console.log('Result:', result3.substring(0, 200) || result3);
  console.log('');

  console.log('=== Test 4: Search with hybrid mode ===');
  const result4 = await memory_search.execute({ query: 'test', mode: 'hybrid' });
  console.log('Result type:', typeof result4);
  console.log('Result length:', result4?.length || 0);
  console.log('Result:', result4.substring(0, 200) || result4);
  console.log('');

  console.log('=== Test 5: Search with no results ===');
  const result5 = await memory_search.execute({ query: 'nonexistentquery123456789' });
  console.log('Result type:', typeof result5);
  console.log('Result:', result5);
  console.log('');

  console.log('=== Test 6: Missing query parameter ===');
  const result6 = await memory_search.execute({});
  console.log('Result type:', typeof result6);
  console.log('Result:', result6);
  console.log('');

  console.log('=== Summary ===');
  const tests = [result1, result2, result3, result4, result5, result6];
  const successCount = tests.filter(r => typeof r === 'string' && r.length > 0).length;

  console.log(`Total: ${tests.length}`);
  console.log(`Success: ${successCount}`);
  console.log('');

  if (
    typeof result1 === 'string' &&
    result1.length > 0 &&
    typeof result2 === 'string' &&
    result2.length > 0 &&
    typeof result3 === 'string' &&
    result3.length > 0 &&
    typeof result4 === 'string' &&
    result4.length > 0 &&
    typeof result5 === 'string' &&
    typeof result6 === 'string'
  ) {
    console.log('✅ All tests passed!');
    console.log('- Test 1: Basic search (success)');
    console.log('- Test 2: Vector mode (success)');
    console.log('- Test 3: Keyword mode (success)');
    console.log('- Test 4: Hybrid mode (success)');
    console.log('- Test 5: No results (success)');
    console.log('- Test 6: Missing query (success)');
  } else {
    console.log('❌ Some tests failed unexpectedly!');
    process.exit(1);
  }
}

testPluginSearch().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
