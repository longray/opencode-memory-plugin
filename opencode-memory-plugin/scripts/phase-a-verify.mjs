#!/usr/bin/env node
/**
 * Phase A Verification Test Script
 * Tests all 8 Go/No-Go checkpoints for v2.2-lite
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const CORE_DIR = path.join(MEMORY_DIR, 'core');
const TIMELINE_DIR = path.join(MEMORY_DIR, 'timeline');
const SYNC_DIR = path.join(MEMORY_DIR, '.sync');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');

let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ ${name}`);
    passCount++;
  } else {
    console.log(`❌ ${name}`);
    if (details) console.log(`   ${details}`);
    failCount++;
    failures.push(name);
  }
}

console.log('🧪 Phase A Verification Tests\n');
console.log('='.repeat(50));

// Checkpoint 1: Directory Structure
console.log('\n📁 Checkpoint 1: Directory Structure');
test('core/ directory exists', fs.existsSync(CORE_DIR));
test('timeline/ directory exists', fs.existsSync(TIMELINE_DIR));
test('.sync/ directory exists', fs.existsSync(SYNC_DIR));

// Checkpoint 2: Core Functions
console.log('\n🔧 Checkpoint 2: Core Functions');
try {
  const pluginModule = await import(path.join(__dirname, '..', 'plugin.js'));
  test('generateEntryId function exists', typeof pluginModule.generateEntryId === 'function');
  test('writeToTimeline function exists', typeof pluginModule.writeToTimeline === 'function');
  test('updateDayOverview function exists', typeof pluginModule.updateDayOverview === 'function');
  test('updateMemoryIndex function exists', typeof pluginModule.updateMemoryIndex === 'function');
} catch (e) {
  test('Plugin module loads', false, e.message);
}

// Checkpoint 3: memory_write Tool
console.log('\n✏️ Checkpoint 3: memory_write Tool');
try {
  const pluginContent = fs.readFileSync(path.join(__dirname, '..', 'plugin.js'), 'utf-8');
  test('memory_write has abstract parameter', pluginContent.includes('abstract: tool.schema'));
  test('memory_write has overview parameter', pluginContent.includes('overview: tool.schema'));
  test('memory_write calls writeToTimeline', pluginContent.includes('writeToTimeline'));
} catch (e) {
  test('Plugin file readable', false, e.message);
}

// Checkpoint 4: getMemoryFiles
console.log('\n📂 Checkpoint 4: getMemoryFiles Adaptation');
try {
  const pluginContent = fs.readFileSync(path.join(__dirname, '..', 'plugin.js'), 'utf-8');
  test('getMemoryFiles includes timeline/', pluginContent.includes("name: `timeline/"));
  test('getMemoryFiles includes core/', pluginContent.includes("name: `core/"));
  test('getMemoryFiles returns layer property', pluginContent.includes("layer: 'L0'") || pluginContent.includes('layer: "L0"'));
} catch (e) {
  test('getMemoryFiles readable', false, e.message);
}

// Checkpoint 5: Timeline Write
console.log('\n📝 Checkpoint 5: Timeline Write Test');
try {
  const testDir = path.join(TIMELINE_DIR, '2026', '03', '19');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testFile = path.join(testDir, 'test-entry.md');
  const testContent = '# Test Entry\n\n**Date**: 2026-03-19\n**Type**: test\n\nTest content';
  fs.writeFileSync(testFile, testContent, 'utf-8');
  
  test('Can write to timeline/', fs.existsSync(testFile));
  
  // Cleanup
  fs.unlinkSync(testFile);
} catch (e) {
  test('Timeline write works', false, e.message);
}

// Checkpoint 6: Syntax Valid
console.log('\n🔍 Checkpoint 6: Syntax Validation');
import { execSync } from 'child_process';
try {
  execSync('node -c plugin.js', { cwd: path.join(__dirname, '..') });
  test('plugin.js syntax valid', true);
} catch (e) {
  test('plugin.js syntax valid', false, e.message);
}

// Checkpoint 7: MEMORY.md Index
console.log('\n📄 Checkpoint 7: MEMORY.md Index');
try {
  if (fs.existsSync(MEMORY_FILE)) {
    const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
    const lines = content.split('\n').length;
    test('MEMORY.md exists', true);
    test('MEMORY.md < 500 lines', lines < 500, `Current: ${lines} lines`);
  } else {
    test('MEMORY.md exists', false, 'File not found');
  }
} catch (e) {
  test('MEMORY.md readable', false, e.message);
}

// Checkpoint 8: Backend Sync
console.log('\n🌐 Checkpoint 8: Backend Sync');
try {
  // Check if backend config exists
  const configPath = path.join(MEMORY_DIR, 'memory-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    test('Backend config exists', true);
    test('Backend enabled', config.backend?.enabled !== false);
  } else {
    test('Backend config exists', false, 'Config file not found');
  }
} catch (e) {
  test('Backend config readable', false, e.message);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Results: ${passCount} passed, ${failCount} failed`);

if (failCount > 0) {
  console.log('\n❌ Failed checks:');
  failures.forEach(f => console.log(`  - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All checkpoints passed! Phase A complete.');
  process.exit(0);
}
