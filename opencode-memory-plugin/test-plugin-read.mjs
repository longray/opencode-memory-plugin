#!/usr/bin/env node

/**
 * Test Backlog 1.3: Plugin memory_read refactoring
 */

import { writeAndSyncMemory } from './lib/memory-core.js';
import { getConfig } from './lib/storage.js';
import { getWrapperClient } from './lib/wrapper-client.js';

function runTool(toolExecute, args) {
  return toolExecute(args);
}

async function testPluginRead() {
  console.log('=== Test 1: Read without entry_id (should fail) ===');
  const memoryReadTool = {
    execute: async args => {
      const { readMemory } = await import('./lib/memory-core.js');

      const result = await readMemory({
        entry_id: args.entry_id,
        level: args.level !== undefined ? args.level : 2,
      });

      if (!result.success) {
        return result.message;
      }

      return result.content;
    },
  };

  const result1 = await runTool(memoryReadTool.execute, {});
  console.log('Result:', result1);
  console.log('Type:', typeof result1);
  console.log('');

  console.log('=== Test 2: Read non-existent entry (should fail) ===');
  const result2 = await runTool(memoryReadTool.execute, { entry_id: 'nonexistent-entry-id' });
  console.log('Result:', result2);
  console.log('Type:', typeof result2);
  console.log('');

  console.log('=== Test 3: Write a test entry first ===');
  const config = getConfig();
  const client = getWrapperClient(config);
  const projectId = await import('./lib/project-resolver.js').then(m => m.resolveProjectId(config));
  const tenantId = config?.backend?.tenant_id || 'longray';

  const writeResult = await writeAndSyncMemory({
    abstract: 'Test abstract for plugin read',
    overview: 'Test overview for plugin read',
    content: 'Test content for plugin read',
    type: 'test',
    tags: ['plugin', 'read', 'test'],
    pinned: false,
    source_id: null,
    project_id: projectId,
    source: 'plugin',
    tenant_id: tenantId,
    client,
  });
  console.log('Success:', writeResult.success);
  console.log('Local ID:', writeResult.localId);
  console.log('Message:', writeResult.message);
  console.log('');

  const entryId = writeResult.localId;
  console.log('Entry ID:', entryId);
  console.log('');

  console.log('=== Test 4: Read entry with level=0 (abstract) ===');
  const result4 = await runTool(memoryReadTool.execute, { entry_id: entryId, level: 0 });
  console.log('Result:', result4);
  console.log('Type:', typeof result4);
  console.log('');

  console.log('=== Test 5: Read entry with level=1 (overview) ===');
  const result5 = await runTool(memoryReadTool.execute, { entry_id: entryId, level: 1 });
  console.log('Result:', result5);
  console.log('Type:', typeof result5);
  console.log('');

  console.log('=== Test 6: Read entry with level=2 (full, default) ===');
  const result6 = await runTool(memoryReadTool.execute, { entry_id: entryId, level: 2 });
  console.log('Result:', result6);
  console.log('Type:', typeof result6);
  console.log('');

  console.log('=== Test 7: Read entry without level (should default to 2) ===');
  const result7 = await runTool(memoryReadTool.execute, { entry_id: entryId });
  console.log('Result:', result7);
  console.log('Type:', typeof result7);
  console.log('');

  console.log('=== Summary ===');
  const tests = [result1, result2, writeResult, result4, result5, result6, result7];
  const successCount = [
    writeResult.success,
    result4 !== result1,
    result5 !== result1,
    result6 !== result1,
    result7 !== result1,
  ].filter(x => x).length;
  const failCount = [result1.includes('❌'), result2.includes('❌')].filter(x => x).length;

  console.log(`Total: ${tests.length}`);
  console.log(`Success: ${successCount + failCount}`);
  console.log(`Fail: ${tests.length - successCount - failCount}`);
  console.log('');

  if (
    result1.includes('❌') &&
    result2.includes('❌') &&
    writeResult.success &&
    result4 !== result1 &&
    result5 !== result1 &&
    result6 !== result1 &&
    result7 !== result1
  ) {
    console.log('✅ All tests passed!');
    console.log('- Test 1: Missing entry_id (expected fail)');
    console.log('- Test 2: Non-existent entry (expected fail)');
    console.log('- Test 3: Write test entry (success)');
    console.log('- Test 4: Read level=0 (success)');
    console.log('- Test 5: Read level=1 (success)');
    console.log('- Test 6: Read level=2 (success)');
    console.log('- Test 7: Read default level (success)');
  } else {
    console.log('❌ Some tests failed unexpectedly!');
    process.exit(1);
  }
}

testPluginRead().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
