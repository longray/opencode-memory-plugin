import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../helpers/mock-constants.js';

function generateLargeAtomTree(count) {
  const atoms = [];
  const batchSize = 10;
  for (let i = 0; i < count; i++) {
    const chapterIndex = Math.floor(i / batchSize);
    const childIndex = i % batchSize;

    if (childIndex === 0) {
      atoms.push({
        local_id: `01PERF${String(i).padStart(4, '0')}`,
        source_id: `01PERF${String(i).padStart(4, '0')}`,
        atom_id: null,
        type: 'chapter',
        name: `Chapter ${chapterIndex + 1}`,
        content: `Chapter ${chapterIndex + 1} content about topic ${chapterIndex}. `.repeat(3),
        tags: [],
        aliases: [],
        order: `a${chapterIndex}`,
        heading_level: 1,
        parent_id: null,
        children: [],
      });
    } else {
      const parentLocalId = `01PERF${String(chapterIndex * batchSize).padStart(4, '0')}`;
      atoms.push({
        local_id: `01PERF${String(i).padStart(4, '0')}`,
        source_id: `01PERF${String(i).padStart(4, '0')}`,
        atom_id: null,
        type: 'section',
        name: `Section ${chapterIndex + 1}.${childIndex}`,
        content: `Section ${chapterIndex + 1}.${childIndex} details about topic ${i}. `.repeat(5),
        tags: [],
        aliases: [],
        order: `a${childIndex}`,
        heading_level: 2,
        parent_id: parentLocalId,
        children: [],
      });
    }
  }
  return atoms;
}

describe('Large Atom Tree Performance', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, loadContextByBudget;

  beforeAll(async () => {
    tempDir = setupTestTempDir('context-budget-perf-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../lib/memory-core.js');
      writeMemory = core.writeMemory;
      loadContextByBudget = core.loadContextByBudget;
    });
  });

  afterAll(() => {
    if (originalMemoryDir === undefined) {
      delete process.env.MEMORY_DIR;
    } else {
      process.env.MEMORY_DIR = originalMemoryDir;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should write 100 atoms successfully', async () => {
    const atoms = generateLargeAtomTree(100);

    const start = Date.now();
    const result = await writeMemory({
      abstract: '100 atom tree',
      overview: 'Performance test with 100 atoms',
      content: 'Performance test content',
      type: 'memory',
      tags: ['test', 'perf'],
      atoms,
      _source: 'test',
    });
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(2000);
  });

  it('should write 1000 atoms successfully', async () => {
    const atoms = generateLargeAtomTree(1000);

    const start = Date.now();
    const result = await writeMemory({
      abstract: '1000 atom tree',
      overview: 'Performance test with 1000 atoms',
      content: 'Performance test content',
      type: 'memory',
      tags: ['test', 'perf'],
      atoms,
      _source: 'test',
    });
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(10000);
  });

  it('should handle 1000 atoms within performance budget on loadContextByBudget', async () => {
    const atoms = generateLargeAtomTree(1000);

    const writeResult = await writeMemory({
      abstract: 'Budget perf test',
      overview: 'Load context budget with large tree',
      content: 'Perf content',
      type: 'memory',
      tags: ['test', 'perf'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const start = Date.now();
    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'topic 50',
      maxTokens: 4000,
      strategy: 'relevance',
    });
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.total_atoms).toBe(1000);
    expect(result.selected_count).toBeGreaterThan(0);
    expect(result.selected_count).toBeLessThan(result.total_atoms);
    expect(result.used_tokens).toBeLessThanOrEqual(result.max_tokens);
    expect(duration).toBeLessThan(500);
  });

  it('should select atoms within tight budget for large tree', async () => {
    const atoms = generateLargeAtomTree(500);

    const writeResult = await writeMemory({
      abstract: 'Tight budget test',
      overview: 'Very tight budget with large tree',
      content: 'Budget content',
      type: 'memory',
      tags: ['test', 'perf'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'chapter section topic',
      maxTokens: 100,
      strategy: 'relevance',
    });

    expect(result.success).toBe(true);
    expect(result.selected_count).toBeLessThan(5);
    expect(result.used_tokens).toBeLessThanOrEqual(100);
  });

  it('should handle hierarchy strategy for large tree', async () => {
    const atoms = generateLargeAtomTree(500);

    const writeResult = await writeMemory({
      abstract: 'Hierarchy perf test',
      overview: 'Hierarchy strategy with large tree',
      content: 'Hierarchy content',
      type: 'memory',
      tags: ['test', 'perf'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const start = Date.now();
    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'topic',
      maxTokens: 4000,
      strategy: 'hierarchy',
    });
    const duration = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.selected_count).toBeGreaterThan(0);
    expect(result.used_tokens).toBeLessThanOrEqual(result.max_tokens);
    expect(duration).toBeLessThan(500);
  });
});
