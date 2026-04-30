/**
 * Tests for memory_read with atoms support
 * TDD for v3.3 Atom Architecture
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

describe('readMemory with atoms', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, readMemory;

  beforeAll(async () => {
    tempDir = setupTestTempDir('memory-read-atoms-test-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      readMemory = core.readMemory;
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

  it('should read entity without atoms (backward compatible)', async () => {
    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 2 });

    expect(readResult.success).toBe(true);
    expect(readResult.entry_type).toBe('memory');
    expect(readResult.id).toBe(writeResult.localId);
    expect(readResult.abstract).toBe('Test abstract');
  });

  it('should read entity with atoms at level 2', async () => {
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

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 2 });

    expect(readResult.success).toBe(true);
    expect(readResult.content).toContain('[[01ATOM001]]');
    expect(readResult.content).toContain('Chapter 1');
  });

  // --- Bug H-5: entity content preserved when atoms present ---
  it('should preserve original entity content when atoms are also present at level 2', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content from atom',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const originalContent = 'This is the original entity-level content that must not be lost.';

    const writeResult = await writeMemory({
      abstract: 'Entity with atoms and content',
      overview: 'Entity overview text',
      content: originalContent,
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 2 });

    expect(readResult.success).toBe(true);
    // Must contain synthesized atom content
    expect(readResult.content).toContain('[[01ATOM001]]');
    expect(readResult.content).toContain('Chapter 1');
    expect(readResult.content).toContain('Chapter content from atom');
    // Must ALSO preserve original entity content (Bug H-5)
    expect(readResult.content).toContain(originalContent);
  });

  it('should separate synthesized atoms from original content with horizontal rule', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Atom-only content',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const entityContent = 'Original entity-level narrative.';

    const writeResult = await writeMemory({
      abstract: 'Entity with atoms and separate content',
      overview: 'Overview',
      content: entityContent,
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 2 });

    expect(readResult.success).toBe(true);
    expect(readResult.content).toContain('[[01ATOM001]]');
    expect(readResult.content).toContain('Atom-only content');
    expect(readResult.content).toContain(entityContent);
    expect(readResult.content).toContain('---');
  });

  it('should read atom by local_id', async () => {
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

    const readResult = await readMemory({ entry_id: '01ATOM001' });

    expect(readResult.success).toBe(true);
    expect(readResult.type).toBe('atom');
    expect(readResult.local_id).toBe('01ATOM001');
    expect(readResult.name).toBe('Chapter 1');
    expect(readResult.content).toBe('Chapter content');
  });

  it('should read nested atom by local_id', async () => {
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
        children: [
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
        ],
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

    const readResult = await readMemory({ entry_id: '01ATOM002' });

    expect(readResult.success).toBe(true);
    expect(readResult.type).toBe('atom');
    expect(readResult.local_id).toBe('01ATOM002');
    expect(readResult.name).toBe('Section 1.1');
    expect(readResult.content).toBe('Section content');
    expect(readResult.parent_id).toBe('01ATOM001');
  });

  it('should return error for non-existent atom', async () => {
    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: 'NONEXISTENT' });

    expect(readResult.success).toBe(false);
    expect(readResult.message).toContain('not found');
  });

  it('should read entity at different levels', async () => {
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
      overview: '{"key": "value"}',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const level0 = await readMemory({ entry_id: writeResult.localId, level: 0 });
    expect(level0.success).toBe(true);
    expect(level0.abstract).toBe('Test abstract');

    const level1 = await readMemory({ entry_id: writeResult.localId, level: 1 });
    expect(level1.success).toBe(true);
    expect(level1.abstract).toBe('Test abstract');
    expect(level1.overview).toContain('key');

    const level2 = await readMemory({ entry_id: writeResult.localId, level: 2 });
    expect(level2.success).toBe(true);
    expect(level2.abstract).toBe('Test abstract');
    expect(level2.content).toContain('[[01ATOM001]]');
    expect(level2.content).toContain('Chapter 1');
  });

  it('should read cross-entity atom by entity_id/atom_id format', async () => {
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
        children: [
          {
            local_id: '01ATOM002',
            source_id: '01ATOM002',
            atom_id: null,
            type: 'section',
            name: 'Section 1.1',
            content: 'Section content with [[01ATOM001]]',
            tags: [],
            aliases: [],
            order: 'a0',
            heading_level: 2,
            parent_id: '01ATOM001',
            children: [],
          },
        ],
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

    const readResult = await readMemory({ entry_id: `${writeResult.localId}/01ATOM002` });

    expect(readResult.success).toBe(true);
    expect(readResult.type).toBe('atom');
    expect(readResult.local_id).toBe('01ATOM002');
    expect(readResult.entity_id).toBe(writeResult.localId);
    expect(readResult.name).toBe('Section 1.1');
    expect(readResult.content).toBe('Section content with [[01ATOM001]]');
    expect(readResult.parent_id).toBe('01ATOM001');
    expect(readResult.outgoing_links).toHaveLength(1);
    expect(readResult.outgoing_links[0].target).toBe('01ATOM001');
    expect(readResult.outgoing_links[0].entity_id).toBeNull();
  });

  // --- Bug C2: level parameter ignored for atom entities ---
  it('should return only abstract in content for level=0 with atom entities', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content that should NOT appear at level 0',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Level zero abstract',
      overview: 'Level zero overview',
      content: 'Full content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 0 });

    expect(readResult.success).toBe(true);
    expect(readResult.content).toBe('Level zero abstract');
    expect(readResult.content).not.toContain('Chapter 1');
    expect(readResult.content).not.toContain('[[01ATOM001]]');
    expect(readResult.content).not.toContain('overview');
  });

  it('should return abstract + overview in content for level=1 with atom entities', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content that should NOT appear at level 1',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Level one abstract',
      overview: 'Level one overview text',
      content: 'Full content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 1 });

    expect(readResult.success).toBe(true);
    expect(readResult.content).toContain('Level one abstract');
    expect(readResult.content).toContain('Level one overview text');
    expect(readResult.content).not.toContain('Chapter 1');
    expect(readResult.content).not.toContain('[[01ATOM001]]');
  });

  it('should return full synthesized content for level=2 with atom entities', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content for level 2',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Level two abstract',
      overview: 'Level two overview',
      content: 'Full content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: writeResult.localId, level: 2 });

    expect(readResult.success).toBe(true);
    expect(readResult.content).toContain('[[01ATOM001]]');
    expect(readResult.content).toContain('Chapter 1');
    expect(readResult.content).toContain('Chapter content for level 2');
  });

  it('should return error for cross-entity read with non-existent entity', async () => {
    const readResult = await readMemory({ entry_id: '01NONEXISTENT/01ATOM001' });

    expect(readResult.success).toBe(false);
    expect(readResult.message).toContain('Entity not found');
  });

  it('should return error for cross-entity read with non-existent atom', async () => {
    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const readResult = await readMemory({ entry_id: `${writeResult.localId}/01ATOM999` });

    expect(readResult.success).toBe(false);
    expect(readResult.message).toContain('not found');
  });
});
