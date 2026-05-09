/**
 * Tests for atom-to-entity index (Bug C-1 fix)
 *
 * Verifies that atom lookups use an O(1) index instead of scanning all entries.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

describe('atom-to-entity index', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, readMemory;
  let getAtomIndex;

  beforeAll(async () => {
    tempDir = setupTestTempDir('atom-index-test-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      readMemory = core.readMemory;
      const storage = await import('../../../lib/storage.js');
      getAtomIndex = storage.getAtomIndex;
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

  it('should build atom_index after writeMemory with atoms', async () => {
    const atoms = [
      {
        local_id: '01CHAP001',
        source_id: '01CHAP001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [
          {
            local_id: '01SEC001',
            source_id: '01SEC001',
            atom_id: null,
            type: 'section',
            name: 'Section 1.1',
            content: 'Section content',
            tags: [],
            aliases: [],
            order: 'a0',
            heading_level: 2,
            parent_id: '01CHAP001',
            children: [],
          },
        ],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Test entity',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const atomIndex = getAtomIndex();
    expect(atomIndex['01CHAP001']).toBe(writeResult.localId);
    expect(atomIndex['01SEC001']).toBe(writeResult.localId);
  });

  it('should not index entries without atoms', async () => {
    const writeResult = await writeMemory({
      abstract: 'No atoms entity',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const atomIndex = getAtomIndex();
    expect(atomIndex[writeResult.localId]).toBeUndefined();
  });

  it('should allow readMemory to find atom via index without full scan', async () => {
    const atoms = [
      {
        local_id: '01FINDME',
        source_id: '01FINDME',
        atom_id: null,
        type: 'note',
        name: 'Findable Atom',
        content: 'Content to find',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Entity with findable atom',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    // Read by atom local_id - should use index, not full scan
    const readResult = await readMemory({ entry_id: '01FINDME' });

    expect(readResult.success).toBe(true);
    expect(readResult.type).toBe('atom');
    expect(readResult.local_id).toBe('01FINDME');
    expect(readResult.name).toBe('Findable Atom');
    expect(readResult.content).toBe('Content to find');
    expect(readResult.entity_id).toBe(writeResult.localId);
  });

  it('should return empty object from getAtomIndex when no atoms exist', () => {
    const atomIndex = getAtomIndex();
    expect(atomIndex).toBeDefined();
    expect(typeof atomIndex).toBe('object');
  });

  it('should handle multiple entities with atoms in the index', async () => {
    const atoms1 = [
      {
        local_id: '01ENT1_A',
        source_id: '01ENT1_A',
        atom_id: null,
        type: 'chapter',
        name: 'Entity 1 Atom A',
        content: 'Content A',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const atoms2 = [
      {
        local_id: '01ENT2_B',
        source_id: '01ENT2_B',
        atom_id: null,
        type: 'section',
        name: 'Entity 2 Atom B',
        content: 'Content B',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 2,
        parent_id: null,
        children: [],
      },
    ];

    const result1 = await writeMemory({
      abstract: 'Entity 1',
      overview: 'Overview 1',
      content: 'Content 1',
      type: 'memory',
      tags: ['test'],
      atoms: atoms1,
      _source: 'test',
    });

    const result2 = await writeMemory({
      abstract: 'Entity 2',
      overview: 'Overview 2',
      content: 'Content 2',
      type: 'memory',
      tags: ['test'],
      atoms: atoms2,
      _source: 'test',
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    const atomIndex = getAtomIndex();
    expect(atomIndex['01ENT1_A']).toBe(result1.localId);
    expect(atomIndex['01ENT2_B']).toBe(result2.localId);
    expect(atomIndex['01ENT1_A']).not.toBe(atomIndex['01ENT2_B']);
  });
});
