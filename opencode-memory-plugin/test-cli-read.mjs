#!/usr/bin/env node

/**
 * Test Backlog 1.2: CLI readCommand refactoring
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, 'cli', 'index.cjs');

function runCli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [cliPath, ...args], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => {
      stdout += data.toString();
    });

    proc.stderr.on('data', data => {
      stderr += data.toString();
    });

    proc.on('close', code => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', err => {
      reject(err);
    });
  });
}

async function testCliRead() {
  console.log('=== Test 1: Read without entry_id (should fail) ===');
  const result1 = await runCli(['read']);
  console.log('Exit code:', result1.code);
  console.log('Stdout:', result1.stdout);
  console.log('Stderr:', result1.stderr);
  console.log('');

  console.log('=== Test 2: Read non-existent entry (should fail) ===');
  const result2 = await runCli(['read', '--id', 'nonexistent-entry-id']);
  console.log('Exit code:', result2.code);
  console.log('Stdout:', result2.stdout);
  console.log('Stderr:', result2.stderr);
  console.log('');

  console.log('=== Test 3: Write a test entry first ===');
  const writeResult = await runCli([
    'write',
    'Test content for read test',
    '--abstract',
    'Test abstract for read',
    '--overview',
    'Test overview for read',
    '--type',
    'test',
    '--tags',
    'read,test',
  ]);
  console.log('Exit code:', writeResult.code);
  console.log('Stdout:', writeResult.stdout);
  console.log('Stderr:', writeResult.stderr);
  console.log('');

  // Extract entry ID from write result
  const idMatch = writeResult.stdout.match(/ID: ([a-zA-Z0-9_]+)/);
  if (!idMatch) {
    console.error('❌ Failed to extract entry ID from write result');
    process.exit(1);
  }
  const entryId = idMatch[1];
  console.log('Extracted entry ID:', entryId);
  console.log('');

  console.log('=== Test 4: Read entry with level=0 (abstract) ===');
  const result4 = await runCli(['read', '--id', entryId, '--level', '0']);
  console.log('Exit code:', result4.code);
  console.log('Stdout:', result4.stdout);
  console.log('Stderr:', result4.stderr);
  console.log('');

  console.log('=== Test 5: Read entry with level=1 (overview) ===');
  const result5 = await runCli(['read', '--id', entryId, '--level', '1']);
  console.log('Exit code:', result5.code);
  console.log('Stdout:', result5.stdout);
  console.log('Stderr:', result5.stderr);
  console.log('');

  console.log('=== Test 6: Read entry with level=2 (full, default) ===');
  const result6 = await runCli(['read', '--id', entryId, '--level', '2']);
  console.log('Exit code:', result6.code);
  console.log('Stdout:', result6.stdout);
  console.log('Stderr:', result6.stderr);
  console.log('');

  console.log('=== Test 7: Read entry without level (should default to 2) ===');
  const result7 = await runCli(['read', '--id', entryId]);
  console.log('Exit code:', result7.code);
  console.log('Stdout:', result7.stdout);
  console.log('Stderr:', result7.stderr);
  console.log('');

  console.log('=== Summary ===');
  const tests = [result1, result2, writeResult, result4, result5, result6, result7];
  const successCount = tests.filter(r => r.code === 0).length;
  const failCount = tests.filter(r => r.code !== 0).length;

  console.log(`Total: ${tests.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Fail: ${failCount}`);
  console.log('');

  if (
    result1.code !== 0 &&
    result2.code !== 0 &&
    writeResult.code === 0 &&
    result4.code === 0 &&
    result5.code === 0 &&
    result6.code === 0 &&
    result7.code === 0
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

testCliRead().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
