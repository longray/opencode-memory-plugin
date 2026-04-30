/**
 * Tests for cross-entity link resolution
 * Verifies that [[entity_id/atom_id]] links resolve correctly across entities
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

describe('Cross-Entity Link Resolution', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, readMemory;

  beforeAll(async () => {
    tempDir = setupTestTempDir('cross-entity-links-');

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

  it('should resolve cross-entity atom read via entity_id/atom_id', async () => {
    // Create target entity with atoms
    const targetResult = await writeMemory({
      abstract: 'Target entity',
      overview: 'Entity containing target atoms',
      content: 'Target content',
      type: 'memory',
      tags: ['test'],
      atoms: [
        {
          local_id: '01TGT001',
          source_id: '01TGT001',
          atom_id: null,
          type: 'chapter',
          name: 'Target Chapter',
          content: 'This is the target chapter content.',
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [
            {
              local_id: '01TGT002',
              source_id: '01TGT002',
              atom_id: null,
              type: 'section',
              name: 'Target Section',
              content: 'This is the target section content with details.',
              tags: [],
              aliases: [],
              order: 'a0',
              heading_level: 2,
              parent_id: '01TGT001',
              children: [],
            },
          ],
        },
      ],
      _source: 'test',
    });
    expect(targetResult.success).toBe(true);
    const targetEntityId = targetResult.localId;

    // Read target atom using cross-entity format: entity_id/atom_id
    const result = await readMemory({ entry_id: `${targetEntityId}/01TGT002` });

    expect(result.success).toBe(true);
    expect(result.type).toBe('atom');
    expect(result.local_id).toBe('01TGT002');
    expect(result.entity_id).toBe(targetEntityId);
    expect(result.content).toBe('This is the target section content with details.');
    expect(result.atom_type).toBe('section');
    expect(result.heading_level).toBe(2);
    expect(result.parent_id).toBe('01TGT001');
  });

  it('should return error for non-existent entity in cross-entity read', async () => {
    const result = await readMemory({ entry_id: 'NONEXISTENT_ENTITY/01ATOM001' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Entity not found');
  });

  it('should return error for non-existent atom in existing entity', async () => {
    // Create entity
    const writeResult = await writeMemory({
      abstract: 'Source entity',
      overview: 'Entity without the target atom',
      content: 'Source content',
      type: 'memory',
      tags: ['test'],
      atoms: [
        {
          local_id: '01SRC001',
          source_id: '01SRC001',
          atom_id: null,
          type: 'chapter',
          name: 'Source Chapter',
          content: 'Source content only.',
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [],
        },
      ],
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const result = await readMemory({ entry_id: `${writeResult.localId}/01MISSING` });

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found in entity');
  });

  it('should include outgoing and incoming links in cross-entity read', async () => {
    // Create target entity
    const targetResult = await writeMemory({
      abstract: 'Target',
      overview: 'Target entity for link resolution',
      content: 'Target content',
      type: 'memory',
      tags: ['test'],
      atoms: [
        {
          local_id: '01LNK001',
          source_id: '01LNK001',
          atom_id: null,
          type: 'chapter',
          name: 'Chapter with links',
          content: 'See [[01LNK002|Target Section]] for details.',
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [],
        },
        {
          local_id: '01LNK002',
          source_id: '01LNK002',
          atom_id: null,
          type: 'section',
          name: 'Target Section',
          content: 'This is linked from chapter.',
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 2,
          parent_id: '01LNK001',
          children: [],
        },
      ],
      _source: 'test',
    });
    expect(targetResult.success).toBe(true);

    // Read the chapter atom (has outgoing link)
    const chapterResult = await readMemory({ entry_id: `${targetResult.localId}/01LNK001` });

    expect(chapterResult.success).toBe(true);
    expect(chapterResult.outgoing_links).toHaveLength(1);
    expect(chapterResult.outgoing_links[0]).toMatchObject({
      target: '01LNK002',
      label: 'Target Section',
      entity_id: null,
    });

    // Read the section atom (has incoming link from chapter)
    const sectionResult = await readMemory({ entry_id: `${targetResult.localId}/01LNK002` });

    expect(sectionResult.success).toBe(true);
    expect(sectionResult.incoming_links).toHaveLength(1);
    expect(sectionResult.incoming_links[0]).toMatchObject({
      source: '01LNK001',
      target: '01LNK002',
      entity_id: null,
    });
  });

  it('should handle cross-entity link in source atom content', async () => {
    // Create target entity
    const targetResult = await writeMemory({
      abstract: 'External target',
      overview: 'Target referenced from another entity',
      content: 'Target content',
      type: 'memory',
      tags: ['test'],
      atoms: [
        {
          local_id: '01EXT001',
          source_id: '01EXT001',
          atom_id: null,
          type: 'section',
          name: 'External Reference',
          content: 'Detailed external content.',
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 2,
          parent_id: null,
          children: [],
        },
      ],
      _source: 'test',
    });
    expect(targetResult.success).toBe(true);

    // Create source entity with cross-entity link
    const sourceResult = await writeMemory({
      abstract: 'Source entity',
      overview: 'Entity referencing another entity',
      content: 'Source content',
      type: 'memory',
      tags: ['test'],
      atoms: [
        {
          local_id: '01SRC001',
          source_id: '01SRC001',
          atom_id: null,
          type: 'chapter',
          name: 'Source Chapter',
          content: `See [[${targetResult.localId}/01EXT001|External Reference]] for details.`,
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [],
        },
      ],
      _source: 'test',
    });
    expect(sourceResult.success).toBe(true);

    // Read the source atom — outgoing link should show cross-entity format
    const sourceAtom = await readMemory({ entry_id: `${sourceResult.localId}/01SRC001` });

    expect(sourceAtom.success).toBe(true);
    expect(sourceAtom.outgoing_links).toHaveLength(1);
    expect(sourceAtom.outgoing_links[0]).toMatchObject({
      target: '01EXT001',
      entity_id: targetResult.localId,
      label: 'External Reference',
    });

    // Read the target atom via cross-entity path — should work
    const targetAtom = await readMemory({ entry_id: `${targetResult.localId}/01EXT001` });

    expect(targetAtom.success).toBe(true);
    expect(targetAtom.local_id).toBe('01EXT001');
    expect(targetAtom.content).toBe('Detailed external content.');
  });
});
