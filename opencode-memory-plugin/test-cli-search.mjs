#!/usr/bin/env node

/**
 * Test Backlog 2.1: CLI searchCommand verification
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

async function testCliSearch() {
  console.log('=== Test 1: Basic search ===');
  const result1 = await runCli(['search', 'test']);
  console.log('Exit code:', result1.code);
  console.log('Stdout:', result1.stdout);
  console.log('Stderr:', result1.stderr);
  console.log('');

  console.log('=== Test 2: Search with vector mode ===');
  const result2 = await runCli(['search', 'test', '--mode', 'vector']);
  console.log('Exit code:', result2.code);
  console.log('Stdout:', result2.stdout);
  console.log('Stderr:', result2.stderr);
  console.log('');

  console.log('=== Test 3: Search with keyword mode ===');
  const result3 = await runCli(['search', 'test', '--mode', 'keyword']);
  console.log('Exit code:', result3.code);
  console.log('Stdout:', result3.stdout);
  console.log('Stderr:', result3.stderr);
  console.log('');

  console.log('=== Test 4: Search with hybrid mode ===');
  const result4 = await runCli(['search', 'test', '--mode', 'hybrid']);
  console.log('Exit code:', result4.code);
  console.log('Stdout:', result4.stdout);
  console.log('Stderr:', result4.stderr);
  console.log('');

  console.log('=== Test 5: Search with no results ===');
  const result5 = await runCli(['search', 'nonexistentquery123456789']);
  console.log('Exit code:', result5.code);
  console.log('Stdout:', result5.stdout);
  console.log('Stderr:', result5.stderr);
  console.log('');

  console.log('=== Test 6: Search without query (should fail) ===');
  const result6 = await runCli(['search']);
  console.log('Exit code:', result6.code);
  console.log('Stdout:', result6.stdout);
  console.log('Stderr:', result6.stderr);
  console.log('');

  console.log('=== Summary ===');
  const tests = [result1, result2, result3, result4, result5, result6];
  const successCount = tests.filter(r => r.code === 0).length;
  const failCount = tests.filter(r => r.code !== 0).length;

  console.log(`Total: ${tests.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Fail: ${failCount}`);
  console.log('');

  if (
    result1.code === 0 &&
    result2.code === 0 &&
    result3.code === 0 &&
    result4.code === 0 &&
    result5.code === 0 &&
    result6.code !== 0
  ) {
    console.log('✅ All tests passed!');
    console.log('- Test 1: Basic search (success)');
    console.log('- Test 2: Vector mode (success)');
    console.log('- Test 3: Keyword mode (success)');
    console.log('- Test 4: Hybrid mode (success)');
    console.log('- Test 5: No results (success)');
    console.log('- Test 6: Missing query (expected fail)');
  } else {
    console.log('❌ Some tests failed unexpectedly!');
    process.exit(1);
  }
}

testCliSearch().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
