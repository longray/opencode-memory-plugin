/**
 * Test Suite - MemoryIdCache
 * Coverage: CRUD, batch, export/import, validate, stats, normalizePath, parseEntryFile
 * No backend needed - pure file operations with temp directory
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { MemoryIdCache } from '../lib/memory-id-cache.js';

const TEST_CACHE_DIR = path.join(os.tmpdir(), `memory-cache-test-${Date.now()}`);

const entryFixture = `---
id: 01ABC123DEF
source_id: src-utils-001
memory_id: memory:abc123
synced: true
---
# Test Entry
Some content
`;

const entryFixtureWithMeta = `---
id: 01ABC123DEF
source_id: src-utils-001
memory_id: memory:abc123
synced: true
---
# Test Entry
metadata: {"file_path": "src/utils.js", "content_hash": "abc123"}
`;

beforeAll(() => {
  fs.mkdirSync(TEST_CACHE_DIR, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
});

// ===== Basic CRUD =====

describe('Basic CRUD', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
  });

  afterEach(() => {
    cache.cleanup();
  });

  it('set + getMemoryId → returns memory_id', async () => {
    await cache.set('src/a.js', 'sid1', 'mid1');
    expect(await cache.getMemoryId('src/a.js')).toBe('mid1');
  });

  it('getMemoryId miss → null + misses++', async () => {
    await cache.getMemoryId('src/nonexist.js');
    expect(cache.stats.misses).toBe(1);
  });

  it('getSourceId → returns source_id', async () => {
    await cache.set('src/a.js', 'sid1', 'mid1');
    expect(await cache.getSourceId('src/a.js')).toBe('sid1');
  });

  it('getFilePath (reverseIndex) → returns file_path', async () => {
    await cache.set('src/a.js', 'sid1', 'mid1');
    expect(await cache.getFilePath('sid1')).toBe('src/a.js');
  });

  it('has → exists / not exists', () => {
    expect(cache.has('src/a.js')).toBe(false);
    cache.mappings.set('src/a.js', { source_id: 's1', memory_id: 'm1' });
    expect(cache.has('src/a.js')).toBe(true);
  });

  it('delete → getMemoryId returns null after delete', async () => {
    await cache.set('src/a.js', 'sid1', 'mid1');
    expect(await cache.delete('src/a.js')).toBe(true);
    expect(await cache.getMemoryId('src/a.js')).toBeNull();
  });
});

// ===== Batch Operations =====

describe('Batch Operations', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
  });

  afterEach(() => {
    cache.cleanup();
  });

  it('setBatch → all entries queryable after write', async () => {
    const mappings = new Map([
      ['src/a.js', { source_id: 's1', memory_id: 'm1' }],
      ['src/b.js', { source_id: 's2', memory_id: 'm2' }],
    ]);
    await cache.setBatch(mappings);
    expect(await cache.getMemoryId('src/a.js')).toBe('m1');
    expect(await cache.getMemoryId('src/b.js')).toBe('m2');
  });

  it('getBatch → only returns existing entries', async () => {
    await cache.set('src/a.js', 's1', 'm1');
    const result = await cache.getBatch(['src/a.js', 'src/missing.js']);
    expect(result.size).toBe(1);
    expect(result.get('src/a.js')).toBe('m1');
  });

  it('getBatch empty input → empty Map', async () => {
    const result = await cache.getBatch([]);
    expect(result.size).toBe(0);
  });
});

// ===== Export / Import =====

describe('Export / Import', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
  });

  afterEach(() => {
    cache.cleanup();
  });

  it('export → valid JSON with project_id', () => {
    cache.mappings.set('src/a.js', { source_id: 's1', memory_id: 'm1' });
    const json = cache.export();
    const parsed = JSON.parse(json);
    expect(parsed.project_id).toBe('test-project');
    expect(parsed.mappings['src/a.js'].memory_id).toBe('m1');
  });

  it('import (merge) → new entries imported, old entries preserved', async () => {
    await cache.set('src/a.js', 's1', 'm1');
    const importJson = JSON.stringify({
      project_id: 'test-project',
      mappings: {
        'src/b.js': { source_id: 's2', memory_id: 'm2', last_synced: new Date().toISOString() },
      },
    });
    const result = await cache.import(importJson);
    expect(result.imported).toBe(1);
    expect(await cache.getMemoryId('src/a.js')).toBe('m1');
    expect(await cache.getMemoryId('src/b.js')).toBe('m2');
  });

  it('import non-merge → existing entries not overwritten', async () => {
    await cache.set('src/a.js', 's1', 'm1');
    const importJson = JSON.stringify({
      project_id: 'test-project',
      mappings: {
        'src/a.js': {
          source_id: 's1-new',
          memory_id: 'm1-new',
          last_synced: new Date().toISOString(),
        },
      },
    });
    const result = await cache.import(importJson, { merge: false });
    expect(result.imported).toBe(0);
    expect(await cache.getMemoryId('src/a.js')).toBe('m1');
  });
});

// ===== Validate & Stats =====

describe('Validate & Stats', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
  });

  it('validate → empty cache → valid: 0', () => {
    const result = cache.validate();
    expect(result.valid).toBe(0);
    expect(result.invalid).toBe(0);
    expect(result.missing).toEqual([]);
  });

  it('validate → valid entry + missing memory_id', () => {
    cache.mappings.set('src/a.js', { source_id: 's1', memory_id: 'm1' });
    cache.mappings.set('src/b.js', { source_id: 's2', memory_id: null });
    const result = cache.validate();
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(1);
    expect(result.missing).toContain('src/b.js');
  });

  it('getStats → hit_rate calculation', async () => {
    await cache.set('src/a.js', 's1', 'm1');
    await cache.getMemoryId('src/a.js');
    await cache.getMemoryId('src/nonexist.js');
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hit_rate).toBe('50.00%');
  });
});

// ===== Path Normalization =====

describe('Path Normalization', () => {
  it('backslash → forward slash', () => {
    const cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
    expect(cache.normalizePath('src\\utils\\index.js')).toBe('src/utils/index.js');
  });

  it('already forward slash → unchanged', () => {
    const cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
    expect(cache.normalizePath('src/utils/index.js')).toBe('src/utils/index.js');
  });
});

// ===== parseEntryFile =====

describe('parseEntryFile', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
  });

  it('valid frontmatter → extracts source_id/memory_id', () => {
    const result = cache.parseEntryFile(entryFixture);
    expect(result.source_id).toBe('src-utils-001');
    expect(result.memory_id).toBe('memory:abc123');
  });

  it('no frontmatter → all null', () => {
    const result = cache.parseEntryFile('# Just a heading\nSome text');
    expect(result.source_id).toBeNull();
    expect(result.memory_id).toBeNull();
  });
});

// ===== rebuildFromLocal =====

describe('rebuildFromLocal', () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
  });

  afterEach(() => {
    cache.cleanup();
  });

  it('has entry file with metadata → parses correctly', async () => {
    const timelineDir = path.join(TEST_CACHE_DIR, 'timeline', '2026', '04', '24');
    fs.mkdirSync(timelineDir, { recursive: true });
    fs.writeFileSync(path.join(timelineDir, 'entry_test.md'), entryFixtureWithMeta);

    const count = await cache.rebuildFromLocal(timelineDir);
    expect(count).toBe(1);
    expect(await cache.getMemoryId('src/utils.js')).toBe('memory:abc123');
  });

  it('empty timeline directory → returns 0', async () => {
    const timelineDir = path.join(TEST_CACHE_DIR, 'timeline', '2026', '04', '25');
    fs.mkdirSync(timelineDir, { recursive: true });

    const count = await cache.rebuildFromLocal(timelineDir);
    expect(count).toBe(0);
  });
});

// ===== Persistence (save + load roundtrip) =====

describe('Persistence', () => {
  it('save + load → roundtrip consistency', async () => {
    const cache1 = new MemoryIdCache('test-project-persist', TEST_CACHE_DIR);
    await cache1.set('src/a.js', 'sid1', 'mid1');
    cache1.cleanup();
    await cache1.save();

    const cache2 = new MemoryIdCache('test-project-persist', TEST_CACHE_DIR);
    await cache2.load();
    expect(await cache2.getMemoryId('src/a.js')).toBe('mid1');
    cache2.cleanup();
  });
});

// ===== generateSourceId =====

describe('generateSourceId', () => {
  it('returns non-empty string', () => {
    const cache = new MemoryIdCache('test-project', TEST_CACHE_DIR);
    const id = cache.generateSourceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});
