/**
 * Test Suite - SymbolTable
 * Coverage: path-to-entity mapping, global name mapping, path resolution,
 *           LRU cache, persistence, path aliases, error handling
 * Tasks: 1.1-1.7, 2.1-2.7
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SymbolTable } from '../../../lib/symbol-table.js';

const TEST_DIR = path.join(os.tmpdir(), `symbol-table-test-${Date.now()}`);

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

// ===== 1.1-1.3: Constructor & Basic Mappings =====

describe('SymbolTable constructor & basic mappings', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('initializes with empty maps', () => {
    expect(st.pathToEntityId.size).toBe(0);
    expect(st.globalNameToEntityId.size).toBe(0);
  });

  it('stores projectId', () => {
    expect(st.projectId).toBe('test-project');
  });

  it('setPathMapping + getPathEntityId → returns entity id', async () => {
    await st.setPathMapping('src/utils.js', 'entity:utils');
    expect(st.getPathEntityId('src/utils.js')).toBe('entity:utils');
  });

  it('getPathEntityId miss → null', () => {
    expect(st.getPathEntityId('src/nonexist.js')).toBeNull();
  });

  it('setGlobalSymbol + getSymbolEntityId → returns entity id', async () => {
    await st.setGlobalSymbol('foo', 'entity:foo');
    expect(st.getSymbolEntityId('foo')).toBe('entity:foo');
  });

  it('getSymbolEntityId miss → null', () => {
    expect(st.getSymbolEntityId('nonexist')).toBeNull();
  });

  it('hasPath → true/false', () => {
    expect(st.hasPath('src/a.js')).toBe(false);
    st.pathToEntityId.set('src/a.js', 'e1');
    expect(st.hasPath('src/a.js')).toBe(true);
  });

  it('removePathMapping → removes entry', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    expect(st.removePathMapping('src/a.js')).toBe(true);
    expect(st.getPathEntityId('src/a.js')).toBeNull();
  });

  it('removePathMapping non-existent → false', () => {
    expect(st.removePathMapping('src/nope.js')).toBe(false);
  });

  it('clear → empties all maps', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.setGlobalSymbol('foo', 'e2');
    st.clear();
    expect(st.pathToEntityId.size).toBe(0);
    expect(st.globalNameToEntityId.size).toBe(0);
  });
});

// ===== 1.4, 2.1-2.3: Path Resolution =====

describe('resolveImportPath', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR);
  });

  afterEach(() => {
    st.cleanup();
  });

  // 2.1: Relative path resolution
  it('resolves ./utils relative to current file', () => {
    const result = st.resolveImportPath('./utils', '/project/src/index.js');
    expect(result).toBe('/project/src/utils');
  });

  it('resolves ../config relative to current file', () => {
    const result = st.resolveImportPath('../config', '/project/src/utils/index.js');
    expect(result).toBe('/project/src/config');
  });

  it('resolves ./lib/helper relative to current file', () => {
    const result = st.resolveImportPath('./lib/helper', '/project/src/index.js');
    expect(result).toBe('/project/src/lib/helper');
  });

  // 2.3: Skip external dependencies
  it('returns null for node_modules import (lodash)', () => {
    const result = st.resolveImportPath('lodash', '/project/src/index.js');
    expect(result).toBeNull();
  });

  it('returns null for scoped package (@babel/core)', () => {
    const result = st.resolveImportPath('@babel/core', '/project/src/index.js');
    expect(result).toBeNull();
  });

  it('returns null for react import', () => {
    const result = st.resolveImportPath('react', '/project/src/index.js');
    expect(result).toBeNull();
  });

  it('returns null for built-in module (fs)', () => {
    const result = st.resolveImportPath('fs', '/project/src/index.js');
    expect(result).toBeNull();
  });

  it('returns null for built-in module (path)', () => {
    const result = st.resolveImportPath('path', '/project/src/index.js');
    expect(result).toBeNull();
  });

  it('returns null for built-in module (os)', () => {
    const result = st.resolveImportPath('os', '/project/src/index.js');
    expect(result).toBeNull();
  });

  // 2.2: File extension resolution
  it('tries .js extension when resolving path', () => {
    const testFile = path.join(TEST_DIR, 'resolve-ext', 'utils.js');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, '// test');

    const result = st.resolveImportPath('./utils', path.join(TEST_DIR, 'resolve-ext', 'index.js'));
    expect(result).toBe(testFile.replace(/\\/g, '/'));
  });

  it('tries .ts extension when .js not found', () => {
    const testFile = path.join(TEST_DIR, 'resolve-ext2', 'utils.ts');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, '// test');

    const result = st.resolveImportPath('./utils', path.join(TEST_DIR, 'resolve-ext2', 'index.js'));
    expect(result).toBe(testFile.replace(/\\/g, '/'));
  });

  it('tries .mjs extension when .js/.ts not found', () => {
    const testFile = path.join(TEST_DIR, 'resolve-ext3', 'utils.mjs');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, '// test');

    const result = st.resolveImportPath('./utils', path.join(TEST_DIR, 'resolve-ext3', 'index.js'));
    expect(result).toBe(testFile.replace(/\\/g, '/'));
  });

  it('tries .cjs extension when .js/.ts/.mjs not found', () => {
    const testFile = path.join(TEST_DIR, 'resolve-ext4', 'utils.cjs');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, '// test');

    const result = st.resolveImportPath('./utils', path.join(TEST_DIR, 'resolve-ext4', 'index.js'));
    expect(result).toBe(testFile.replace(/\\/g, '/'));
  });

  it('tries /index.js when no file found', () => {
    const indexFile = path.join(TEST_DIR, 'resolve-ext5', 'lib', 'index.js');
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, '// test');

    const result = st.resolveImportPath('./lib', path.join(TEST_DIR, 'resolve-ext5', 'index.js'));
    expect(result).toBe(indexFile.replace(/\\/g, '/'));
  });

  it('returns resolved path even when no extension matches', () => {
    const result = st.resolveImportPath('./nonexist', '/project/src/index.js');
    expect(result).toBe('/project/src/nonexist');
  });

  it('handles path with extension already specified', () => {
    const testFile = path.join(TEST_DIR, 'resolve-ext6', 'utils.js');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, '// test');

    const result = st.resolveImportPath(
      './utils.js',
      path.join(TEST_DIR, 'resolve-ext6', 'index.js')
    );
    expect(result).toBe(testFile.replace(/\\/g, '/'));
  });
});

// ===== 2.4: Path Alias Support =====

describe('path alias support (tsconfig paths)', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR, {
      pathAliases: {
        '@utils': '/project/src/utils',
        '@components/*': '/project/src/components/*',
      },
    });
  });

  afterEach(() => {
    st.cleanup();
  });

  it('resolves @utils alias', () => {
    const result = st.resolveImportPath('@utils/helper', '/project/src/index.js');
    expect(result).toBe('/project/src/utils/helper');
  });

  it('resolves @components/* wildcard alias', () => {
    const result = st.resolveImportPath('@components/Button', '/project/src/index.js');
    expect(result).toBe('/project/src/components/Button');
  });

  it('returns null for unknown alias', () => {
    const result = st.resolveImportPath('@unknown/foo', '/project/src/index.js');
    expect(result).toBeNull();
  });
});

// ===== 2.5-2.6: Symbol Lookup & Error Handling =====

describe('symbol lookup & error handling', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('lookupSymbolByPath returns entity id when path exists', async () => {
    await st.setPathMapping('src/utils.js', 'entity:utils');
    expect(st.lookupSymbolByPath('src/utils.js')).toBe('entity:utils');
  });

  it('lookupSymbolByPath returns null for missing path', () => {
    expect(st.lookupSymbolByPath('src/missing.js')).toBeNull();
  });

  it('lookupSymbolByName returns entity id when symbol exists', async () => {
    await st.setGlobalSymbol('helper', 'entity:helper');
    expect(st.lookupSymbolByName('helper')).toBe('entity:helper');
  });

  it('lookupSymbolByName returns null for missing symbol', () => {
    expect(st.lookupSymbolByName('missing')).toBeNull();
  });

  it('resolveAndLookup returns entity id when path resolves and exists in table', async () => {
    // Set up: file exists in symbol table
    const targetFile = path.join(TEST_DIR, 'lookup-test', 'utils.js');
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, '// test');

    await st.setPathMapping(targetFile, 'entity:utils');

    const result = st.resolveAndLookup('./utils', path.join(TEST_DIR, 'lookup-test', 'index.js'));
    expect(result).toBe('entity:utils');
  });

  it('resolveAndLookup returns null when path resolves but not in table', () => {
    const result = st.resolveAndLookup('./utils', '/project/src/index.js');
    expect(result).toBeNull();
  });

  it('resolveAndLookup returns null when path cannot be resolved', () => {
    const result = st.resolveAndLookup('lodash', '/project/src/index.js');
    expect(result).toBeNull();
  });
});

// ===== 1.5: Persistence (save/load) =====

describe('persistence (save/load)', () => {
  let st;
  const persistDir = path.join(TEST_DIR, 'persist');

  beforeEach(() => {
    fs.mkdirSync(persistDir, { recursive: true });
    st = new SymbolTable('test-project', persistDir);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('save + load restores path mappings', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.setPathMapping('src/b.js', 'e2');
    await st.save();

    const st2 = new SymbolTable('test-project', persistDir);
    await st2.load();
    expect(st2.getPathEntityId('src/a.js')).toBe('e1');
    expect(st2.getPathEntityId('src/b.js')).toBe('e2');
    st2.cleanup();
  });

  it('save + load restores global symbol mappings', async () => {
    await st.setGlobalSymbol('foo', 'e1');
    await st.setGlobalSymbol('bar', 'e2');
    await st.save();

    const st2 = new SymbolTable('test-project', persistDir);
    await st2.load();
    expect(st2.getSymbolEntityId('foo')).toBe('e1');
    expect(st2.getSymbolEntityId('bar')).toBe('e2');
    st2.cleanup();
  });

  it('load with no file → empty table', async () => {
    const emptyDir = path.join(TEST_DIR, 'persist-empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const st3 = new SymbolTable('test-project', emptyDir);
    await st3.load();
    expect(st3.pathToEntityId.size).toBe(0);
    st3.cleanup();
  });

  it('load with wrong projectId → ignores file', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.save();

    const st4 = new SymbolTable('other-project', persistDir);
    await st4.load();
    expect(st4.getPathEntityId('src/a.js')).toBeNull();
    st4.cleanup();
  });

  it('scheduleSave debounces multiple calls', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.setPathMapping('src/b.js', 'e2');
    await st.setPathMapping('src/c.js', 'e3');

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 1500));

    const st2 = new SymbolTable('test-project', persistDir);
    await st2.load();
    expect(st2.getPathEntityId('src/a.js')).toBe('e1');
    expect(st2.getPathEntityId('src/b.js')).toBe('e2');
    expect(st2.getPathEntityId('src/c.js')).toBe('e3');
    st2.cleanup();
  });
});

// ===== 1.6: LRU Cache Management =====

describe('LRU cache management', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR, { maxSize: 5 });
  });

  afterEach(() => {
    st.cleanup();
  });

  it('evicts LRU entry when maxSize exceeded', async () => {
    await st.setPathMapping('src/1.js', 'e1');
    await st.setPathMapping('src/2.js', 'e2');
    await st.setPathMapping('src/3.js', 'e3');
    await st.setPathMapping('src/4.js', 'e4');
    await st.setPathMapping('src/5.js', 'e5');
    // Adding 6th should evict least recently used (e1)
    await st.setPathMapping('src/6.js', 'e6');

    expect(st.getPathEntityId('src/1.js')).toBeNull(); // evicted
    expect(st.getPathEntityId('src/6.js')).toBe('e6');
  });

  it('accessing entry updates LRU order', async () => {
    await st.setPathMapping('src/1.js', 'e1');
    await st.setPathMapping('src/2.js', 'e2');
    await st.setPathMapping('src/3.js', 'e3');
    await st.setPathMapping('src/4.js', 'e4');
    await st.setPathMapping('src/5.js', 'e5');

    // Access e1 to make it recently used
    st.getPathEntityId('src/1.js');

    // Adding 6th should evict e2 (now LRU)
    await st.setPathMapping('src/6.js', 'e6');

    expect(st.getPathEntityId('src/1.js')).toBe('e1'); // still exists
    expect(st.getPathEntityId('src/2.js')).toBeNull(); // evicted
  });

  it('evicts LRU global symbols when maxSize exceeded', async () => {
    await st.setGlobalSymbol('sym1', 'e1');
    await st.setGlobalSymbol('sym2', 'e2');
    await st.setGlobalSymbol('sym3', 'e3');
    await st.setGlobalSymbol('sym4', 'e4');
    await st.setGlobalSymbol('sym5', 'e5');
    // Adding 6th should evict least recently used
    await st.setGlobalSymbol('sym6', 'e6');

    expect(st.getSymbolEntityId('sym1')).toBeNull(); // evicted
    expect(st.getSymbolEntityId('sym6')).toBe('e6');
  });

  it('getStats returns cache statistics', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.setGlobalSymbol('foo', 'e2');

    const stats = st.getStats();
    expect(stats.pathEntries).toBe(1);
    expect(stats.globalEntries).toBe(1);
    expect(stats.maxSize).toBe(5);
  });

  it('invalidatePath removes path and its symbols', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.setGlobalSymbol('foo', 'e1');
    await st.setGlobalSymbol('bar', 'e2');

    st.invalidatePath('src/a.js');

    expect(st.getPathEntityId('src/a.js')).toBeNull();
    // Global symbols with same entity_id should also be removed
    expect(st.getSymbolEntityId('foo')).toBeNull();
    expect(st.getSymbolEntityId('bar')).toBe('e2'); // unrelated, still exists
  });
});

// ===== Batch Operations =====

describe('batch operations', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('setBatchPathMappings adds multiple path mappings', async () => {
    const mappings = new Map([
      ['src/a.js', 'e1'],
      ['src/b.js', 'e2'],
      ['src/c.js', 'e3'],
    ]);

    await st.setBatchPathMappings(mappings);

    expect(st.getPathEntityId('src/a.js')).toBe('e1');
    expect(st.getPathEntityId('src/b.js')).toBe('e2');
    expect(st.getPathEntityId('src/c.js')).toBe('e3');
  });

  it('setBatchGlobalSymbols adds multiple global symbols', async () => {
    const symbols = new Map([
      ['foo', 'e1'],
      ['bar', 'e2'],
      ['baz', 'e3'],
    ]);

    await st.setBatchGlobalSymbols(symbols);

    expect(st.getSymbolEntityId('foo')).toBe('e1');
    expect(st.getSymbolEntityId('bar')).toBe('e2');
    expect(st.getSymbolEntityId('baz')).toBe('e3');
  });

  it('getBatchPathEntityIds returns map of found ids', async () => {
    await st.setPathMapping('src/a.js', 'e1');
    await st.setPathMapping('src/b.js', 'e2');

    const result = st.getBatchPathEntityIds(['src/a.js', 'src/b.js', 'src/missing.js']);
    expect(result.get('src/a.js')).toBe('e1');
    expect(result.get('src/b.js')).toBe('e2');
    expect(result.has('src/missing.js')).toBe(false);
  });
});

// ===== Name Collision Handling =====

describe('name collision handling', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('handles duplicate symbol names with namespace (file path)', async () => {
    // Two files export the same name 'utils'
    await st.setGlobalSymbol('utils', 'entity:utils1', 'src/utils.js');
    await st.setGlobalSymbol('utils', 'entity:utils2', 'lib/utils.js');

    // Both should be accessible via namespaced lookup
    expect(st.getSymbolEntityId('src/utils.js:utils')).toBe('entity:utils1');
    expect(st.getSymbolEntityId('lib/utils.js:utils')).toBe('entity:utils2');
  });

  it('getSymbolEntityId returns last set for bare name collision', async () => {
    await st.setGlobalSymbol('helper', 'e1');
    await st.setGlobalSymbol('helper', 'e2');

    // Last one wins for bare name
    expect(st.getSymbolEntityId('helper')).toBe('e2');
  });
});

// ===== Path Normalization =====

describe('path normalization', () => {
  let st;

  beforeEach(() => {
    st = new SymbolTable('test-project', TEST_DIR);
  });

  afterEach(() => {
    st.cleanup();
  });

  it('normalizes backslashes to forward slashes', async () => {
    await st.setPathMapping('src\\utils.js', 'e1');
    expect(st.getPathEntityId('src/utils.js')).toBe('e1');
  });

  it('normalizes paths in global symbol mapping', async () => {
    await st.setGlobalSymbol('foo', 'e1', 'src\\utils.js');
    expect(st.getSymbolEntityId('src/utils.js:foo')).toBe('e1');
  });
});
