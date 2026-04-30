/**
 * Tests for get_entity_atoms
 * TDD for v3.3 Atom Architecture
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

describe('getEntityAtoms', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, getEntityAtoms;

  beforeAll(async () => {
    tempDir = setupTestTempDir('get-entity-atoms-test-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      getEntityAtoms = core.getEntityAtoms;
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

  it('should return empty array for entity without atoms', async () => {
    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const result = await getEntityAtoms({ entry_id: writeResult.localId });

    expect(result.success).toBe(true);
    expect(result.entity_id).toBe(writeResult.localId);
    expect(result.total_atoms).toBe(0);
    expect(result.tree).toEqual([]);
  });

  it('should return atom tree for entity with atoms', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const result = await getEntityAtoms({ entry_id: writeResult.localId });

    expect(result.success).toBe(true);
    expect(result.entity_id).toBe(writeResult.localId);
    expect(result.total_atoms).toBe(1);
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].local_id).toBe('01ATOM001');
    expect(result.tree[0].name).toBe('Chapter 1');
  });

  it('should return nested atom tree', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01ATOM002',
        source_id: '01ATOM002',
        atom_id: null,
        type: 'section',
        name: 'Section 1.1',
        content: 'Section content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 2,
        parent_id: '01ATOM001',
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const result = await getEntityAtoms({ entry_id: writeResult.localId });

    expect(result.success).toBe(true);
    expect(result.total_atoms).toBe(2);
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].children).toHaveLength(1);
    expect(result.tree[0].children[0].local_id).toBe('01ATOM002');
  });

  it('should exclude content when include_content is false', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Secret content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const result = await getEntityAtoms({ entry_id: writeResult.localId, include_content: false });

    expect(result.success).toBe(true);
    expect(result.tree[0].content).toBeUndefined();
    expect(result.tree[0].name).toBe('Chapter 1');
  });

  it('should include content when include_content is true', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Visible content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const result = await getEntityAtoms({ entry_id: writeResult.localId, include_content: true });

    expect(result.success).toBe(true);
    expect(result.tree[0].content).toBe('Visible content');
  });

  it('should return error for non-existent entity', async () => {
    const result = await getEntityAtoms({ entry_id: 'NONEXISTENT' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should sort atoms by order', async () => {
    const atoms = [
      {
        local_id: '01ATOM002',
        source_id: '01ATOM002',
        atom_id: null,
        type: 'chapter',
        name: 'Second',
        content: 'Second content',
        tags: [],
        aliases: [],
        order: 'b0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'First',
        content: 'First content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const result = await getEntityAtoms({ entry_id: writeResult.localId });

    expect(result.success).toBe(true);
    expect(result.tree).toHaveLength(2);
    expect(result.tree[0].local_id).toBe('01ATOM001');
    expect(result.tree[1].local_id).toBe('01ATOM002');
  });
});
