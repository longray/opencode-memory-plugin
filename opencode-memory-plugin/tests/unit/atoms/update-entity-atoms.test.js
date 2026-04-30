/**
 * Tests for update_entity with atoms support
 * TDD for v3.3 Atom Architecture
 *
 * Uses jest.isolateModulesAsync + process.env.MEMORY_DIR per test to avoid
 * shared-state contamination from jest.unstable_mockModule (process-level mock).
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

/**
 * Creates a mock WrapperClient for testing sync behavior.
 * @param {Object} options
 * @param {Function} [options.uploadMemory] - Custom upload handler
 * @returns {Object} Mock client with spy tracking
 */
function createMockClient(options = {}) {
  const uploadFn = options.uploadMemory || jest.fn().mockResolvedValue({ id: 'mock-memory-id-123' });
  return {
    uploadMemory: uploadFn,
    _uploadMemorySpy: uploadFn,
  };
}

describe('updateEntity with atoms', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, updateEntity;

  beforeEach(async () => {
    tempDir = setupTestTempDir('update-entity-atoms-test-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      updateEntity = core.updateEntity;
    });
  });

  afterEach(() => {
    if (originalMemoryDir === undefined) {
      delete process.env.MEMORY_DIR;
    } else {
      process.env.MEMORY_DIR = originalMemoryDir;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should update entity abstract without atoms', async () => {
    const writeResult = await writeMemory({
      abstract: 'Original abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: { abstract: 'Updated abstract' },
    });

    expect(updateResult.success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('Updated abstract');
    expect(content).not.toContain('Original abstract');
  });

  it('should add atom to entity', async () => {
    const writeResult = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'add',
          local_id: '01NEWATOM',
          source_id: '01NEWATOM',
          type: 'chapter',
          name: 'New Chapter',
          content: 'New chapter content',
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.atoms_result).toHaveLength(1);
    expect(updateResult.atoms_result[0].action).toBe('add');
    expect(updateResult.atoms_result[0].success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('01NEWATOM');
    expect(content).toContain('New Chapter');
  });

  it('should update existing atom', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Original content',
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'update',
          local_id: '01ATOM001',
          content: 'Updated content',
          name: 'Updated Chapter',
        },
      ],
    });

    expect(updateResult.success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('Updated content');
    expect(content).toContain('Updated Chapter');
    expect(content).not.toContain('Original content');
  });

  it('should remove atom from entity', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'remove',
          local_id: '01ATOM001',
          cascade: false,
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.atoms_result[0].removed_count).toBe(1);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).not.toContain('01ATOM001');
    expect(content).not.toContain('Chapter 1');
  });

  it('should cascade remove atom with children', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'remove',
          local_id: '01ATOM001',
          cascade: true,
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.atoms_result[0].removed_count).toBe(2);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).not.toContain('01ATOM001');
    expect(content).not.toContain('01ATOM002');
  });

  it('should reject update with circular reference', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'update',
          local_id: '01ATOM001',
          parent_id: '01ATOM001',
        },
      ],
    });

    expect(updateResult.success).toBe(false);
    expect(updateResult.error).toContain('Circular reference detected');
  });

  it('should update a nested (child) atom', async () => {
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
            content: 'Original section content',
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
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'update',
          local_id: '01SEC001',
          content: 'Updated section content',
          name: 'Updated Section 1.1',
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.atoms_result).toHaveLength(1);
    expect(updateResult.atoms_result[0].action).toBe('update');
    expect(updateResult.atoms_result[0].success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('Updated section content');
    expect(content).toContain('Updated Section 1.1');
    expect(content).not.toContain('Original section content');
  });

  it('should remove a nested (child) atom without cascade', async () => {
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
            content: 'Section content to remove',
            tags: [],
            aliases: [],
            order: 'a0',
            heading_level: 2,
            parent_id: '01CHAP001',
            children: [],
          },
          {
            local_id: '01SEC002',
            source_id: '01SEC002',
            atom_id: null,
            type: 'section',
            name: 'Section 1.2',
            content: 'Section content to keep',
            tags: [],
            aliases: [],
            order: 'a1',
            heading_level: 2,
            parent_id: '01CHAP001',
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'remove',
          local_id: '01SEC001',
          cascade: false,
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.atoms_result[0].removed_count).toBe(1);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).not.toContain('Section content to remove');
    expect(content).not.toContain('01SEC001');
    // Sibling should still exist
    expect(content).toContain('Section content to keep');
    expect(content).toContain('01SEC002');
    // Parent should still exist
    expect(content).toContain('Chapter 1');
    expect(content).toContain('01CHAP001');
  });

  it('should cascade remove a nested atom with its children', async () => {
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
            content: 'Section content to remove',
            tags: [],
            aliases: [],
            order: 'a0',
            heading_level: 2,
            parent_id: '01CHAP001',
            children: [
              {
                local_id: '01DET001',
                source_id: '01DET001',
                atom_id: null,
                type: 'note',
                name: 'Detail 1.1.1',
                content: 'Detail content to remove',
                tags: [],
                aliases: [],
                order: 'a0',
                heading_level: 3,
                parent_id: '01SEC001',
                children: [],
              },
            ],
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'remove',
          local_id: '01SEC001',
          cascade: true,
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    // Section + its child detail = 2 removed
    expect(updateResult.atoms_result[0].removed_count).toBe(2);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).not.toContain('Section content to remove');
    expect(content).not.toContain('Detail content to remove');
    expect(content).not.toContain('01SEC001');
    expect(content).not.toContain('01DET001');
    // Parent chapter should still exist
    expect(content).toContain('Chapter 1');
    expect(content).toContain('01CHAP001');
  });

  it('should calculate correct heading_level when adding atom under nested parent', async () => {
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
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    // Add a child under the nested section (heading_level should be 3)
    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'add',
          local_id: '01DET001',
          source_id: '01DET001',
          type: 'note',
          name: 'Detail 1.1.1',
          content: 'Detail content',
          tags: [],
          aliases: [],
          order: 'a0',
          parent_id: '01SEC001',
        },
      ],
    });

    expect(updateResult.success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('01DET001');
    expect(content).toContain('Detail 1.1.1');
    // Verify heading_level is 3 (parent section has heading_level 2)
    // The add operation uses calculateHeadingLevel which should find the nested parent
    expect(content).toContain('"heading_level": 3');
  });

  it('should reject entity_updates that try to overwrite internal fields (id, date, path, synced, memory_id)', async () => {
    const writeResult = await writeMemory({
      abstract: 'Original abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);
    const originalId = writeResult.localId;

    const updateResult = await updateEntity({
      entry_id: originalId,
      entity_updates: {
        id: 'HACKED_ID',
        date: '2099-01-01T00:00:00.000Z',
        path: '/tmp/evil-path.md',
        synced: true,
        synced_at: '2099-01-01T00:00:00.000Z',
        memory_id: 'hacked-memory-id',
        source_id: 'hacked-source-id',
        abstract: 'Safe abstract update',
        overview: 'Safe overview update',
        content: 'Safe content update',
      },
    });

    expect(updateResult.success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).not.toContain('HACKED_ID');
    expect(content).not.toContain('2099-01-01');
    expect(content).not.toContain('/tmp/evil-path.md');
    expect(content).not.toContain('hacked-memory-id');
    expect(content).not.toContain('hacked-source-id');

    expect(content).toContain('Safe abstract update');
    expect(content).toContain('Safe overview update');
    expect(content).toContain('Safe content update');

    expect(content).toContain(originalId);
  });

  it('should only allow whitelisted fields in entity_updates', async () => {
    const writeResult = await writeMemory({
      abstract: 'Original abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['original-tag'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: {
        abstract: 'New abstract',
        overview: 'New overview',
        content: 'New content',
        tags: ['new-tag'],
        meta: [{ key: 'value' }],
        project: 'hacked-project',
        type: 'hacked-type',
      },
    });

    expect(updateResult.success).toBe(true);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('New abstract');
    expect(content).toContain('New overview');
    expect(content).toContain('New content');
    expect(content).toContain('new-tag');
    expect(content).not.toContain('hacked-project');
    expect(content).toContain('type: memory');
  });

  it('should serialize concurrent updates to prevent lost writes (race condition)', async () => {
    // Create an entry with no atoms
    const writeResult = await writeMemory({
      abstract: 'Race condition test',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);
    const entryId = writeResult.localId;

    // Launch two concurrent updateEntity calls that each add a different atom
    // Without locking, the second write can overwrite the first write's atom (lost update)
    const [resultA, resultB] = await Promise.all([
      updateEntity({
        entry_id: entryId,
        atoms_batch: [
          {
            action: 'add',
            local_id: '01ATOM_RACE_A',
            source_id: '01ATOM_RACE_A',
            type: 'chapter',
            name: 'Atom A',
            content: 'Content from concurrent update A',
            tags: [],
            aliases: [],
            order: 'a0',
            heading_level: 1,
            parent_id: null,
          },
        ],
      }),
      updateEntity({
        entry_id: entryId,
        atoms_batch: [
          {
            action: 'add',
            local_id: '01ATOM_RACE_B',
            source_id: '01ATOM_RACE_B',
            type: 'section',
            name: 'Atom B',
            content: 'Content from concurrent update B',
            tags: [],
            aliases: [],
            order: 'a1',
            heading_level: 1,
            parent_id: null,
          },
        ],
      }),
    ]);

    // Both should succeed
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    // Both atoms must be present - if one was lost, this fails
    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('01ATOM_RACE_A');
    expect(content).toContain('Atom A');
    expect(content).toContain('Content from concurrent update A');
    expect(content).toContain('01ATOM_RACE_B');
    expect(content).toContain('Atom B');
    expect(content).toContain('Content from concurrent update B');
  });

  it('should cascade remove on deeply nested tree (4 levels) with correct children count', async () => {
    // 4-level tree: chapter → section → detail → note
    // This tests the findAllChildren fix for double-recursion bug
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
            children: [
              {
                local_id: '01DET001',
                source_id: '01DET001',
                atom_id: null,
                type: 'note',
                name: 'Detail 1.1.1',
                content: 'Detail content',
                tags: [],
                aliases: [],
                order: 'a0',
                heading_level: 3,
                parent_id: '01SEC001',
                children: [
                  {
                    local_id: '01NOT001',
                    source_id: '01NOT001',
                    atom_id: null,
                    type: 'note',
                    name: 'Note 1.1.1.1',
                    content: 'Note content',
                    tags: [],
                    aliases: [],
                    order: 'a0',
                    heading_level: 4,
                    parent_id: '01DET001',
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            local_id: '01SEC002',
            source_id: '01SEC002',
            atom_id: null,
            type: 'section',
            name: 'Section 1.2',
            content: 'Section 1.2 content',
            tags: [],
            aliases: [],
            order: 'a1',
            heading_level: 2,
            parent_id: '01CHAP001',
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

    // Cascade remove the chapter should remove: chapter + 2 sections + 1 detail + 1 note = 5
    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'remove',
          local_id: '01CHAP001',
          cascade: true,
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    // 1 (chapter) + 2 (sections) + 1 (detail) + 1 (note) = 5 total removed
    // The bug would cause duplicates in findAllChildren, inflating this count
    expect(updateResult.atoms_result[0].removed_count).toBe(5);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).not.toContain('01CHAP001');
    expect(content).not.toContain('01SEC001');
    expect(content).not.toContain('01SEC002');
    expect(content).not.toContain('01DET001');
    expect(content).not.toContain('01NOT001');
  });

  it('should sync to backend when client is provided', async () => {
    const mockClient = createMockClient();
    const writeResult = await writeMemory({
      abstract: 'Sync test abstract',
      overview: 'Sync test overview',
      content: 'Sync test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: { abstract: 'Synced abstract' },
      client: mockClient,
    });

    expect(updateResult.success).toBe(true);
    expect(mockClient._uploadMemorySpy).toHaveBeenCalledTimes(1);
    const uploadedMemory = mockClient._uploadMemorySpy.mock.calls[0][0];
    expect(uploadedMemory.abstract).toBe('Synced abstract');
  });

  it('should update local file synced flag after successful sync', async () => {
    const mockClient = createMockClient();
    const writeResult = await writeMemory({
      abstract: 'Synced flag test',
      overview: 'Synced flag overview',
      content: 'Synced flag content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: { abstract: 'Updated after sync' },
      client: mockClient,
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.synced).toBe(true);

    const fileContent = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(fileContent).toContain('synced: true');
  });

  it('should not sync to backend when client is not provided', async () => {
    const mockClient = createMockClient();
    const writeResult = await writeMemory({
      abstract: 'No-sync test abstract',
      overview: 'No-sync test overview',
      content: 'No-sync test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: { abstract: 'Local-only abstract' },
    });

    expect(updateResult.success).toBe(true);
    expect(mockClient._uploadMemorySpy).not.toHaveBeenCalled();
  });

  it('should include atoms in sync payload when client is provided', async () => {
    const mockClient = createMockClient();
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Atom sync test',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'update',
          local_id: '01ATOM001',
          content: 'Updated chapter content',
        },
      ],
      client: mockClient,
    });

    expect(updateResult.success).toBe(true);
    expect(mockClient._uploadMemorySpy).toHaveBeenCalledTimes(1);
    const uploadedMemory = mockClient._uploadMemorySpy.mock.calls[0][0];
    expect(uploadedMemory.atoms).toBeDefined();
    expect(uploadedMemory.atoms).toHaveLength(1);
    expect(uploadedMemory.atoms[0].content).toBe('Updated chapter content');
  });

  it('should return sync result in response when client is provided', async () => {
    const mockClient = createMockClient();
    const writeResult = await writeMemory({
      abstract: 'Sync result test',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: { overview: 'Updated overview' },
      client: mockClient,
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.synced).toBe(true);
    expect(updateResult.memory_id).toBe('mock-memory-id-123');
  });

  it('should handle sync failure gracefully and still return local success', async () => {
    const mockClient = createMockClient({
      uploadMemory: jest.fn().mockRejectedValue(new Error('Network error')),
    });
    const writeResult = await writeMemory({
      abstract: 'Sync failure test',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(writeResult.success).toBe(true);

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      entity_updates: { abstract: 'Failed sync abstract' },
      client: mockClient,
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.synced).toBe(false);
    expect(updateResult.sync_error).toContain('Network error');
  });

  it('should batch multiple atom operations', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
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

    const updateResult = await updateEntity({
      entry_id: writeResult.localId,
      atoms_batch: [
        {
          action: 'update',
          local_id: '01ATOM001',
          content: 'Updated chapter',
        },
        {
          action: 'add',
          local_id: '01ATOM002',
          source_id: '01ATOM002',
          type: 'section',
          name: 'New Section',
          content: 'New section content',
          tags: [],
          aliases: [],
          order: 'a1',
          heading_level: 2,
          parent_id: '01ATOM001',
        },
      ],
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.atoms_result).toHaveLength(2);

    const content = fs.readFileSync(writeResult.filePath, 'utf-8');
    expect(content).toContain('Updated chapter');
    expect(content).toContain('01ATOM002');
    expect(content).toContain('New Section');
  });

  describe('removeAtomFromTree depth guard', () => {
    function buildDeepChain(nesting) {
      let current = null;
      for (let i = nesting - 1; i >= 0; i--) {
        current = {
          local_id: `L${String(i).padStart(4, '0')}`,
          source_id: `L${String(i).padStart(4, '0')}`,
          atom_id: null,
          type: 'note',
          name: `Level ${i}`,
          content: `Content at level ${i}`,
          tags: [],
          aliases: [],
          order: 'a0',
          heading_level: Math.min(i + 1, 6),
          parent_id: i === 0 ? null : `L${String(i - 1).padStart(4, '0')}`,
          children: current ? [current] : [],
        };
      }
      return [current];
    }

    it('should remove atom within depth limit (10 levels)', async () => {
      const atoms = buildDeepChain(10);

      const writeResult = await writeMemory({
        abstract: 'Depth guard test',
        overview: 'Test removing atom within depth limit',
        content: 'Test content',
        type: 'memory',
        tags: ['test'],
        atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const updateResult = await updateEntity({
        entry_id: writeResult.localId,
        atoms_batch: [
          {
            action: 'remove',
            local_id: 'L0009',
            cascade: false,
          },
        ],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.atoms_result).toHaveLength(1);
      expect(updateResult.atoms_result[0].success).toBe(true);
    });

    it('should not stack overflow on deeply nested tree (25 levels)', async () => {
      const atoms = buildDeepChain(25);

      const writeResult = await writeMemory({
        abstract: 'Deep nesting guard test',
        overview: 'Test that remove does not stack overflow on deep trees',
        content: 'Test content',
        type: 'memory',
        tags: ['test'],
        atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const updateResult = await updateEntity({
        entry_id: writeResult.localId,
        atoms_batch: [
          {
            action: 'remove',
            local_id: 'L0024',
            cascade: true,
          },
        ],
      });

      expect(updateResult.success).toBe(true);
    });

    it('should gracefully handle remove beyond depth limit (atom at depth 21+)', async () => {
      const atoms = buildDeepChain(25);

      const writeResult = await writeMemory({
        abstract: 'Beyond depth limit test',
        overview: 'Test removeAtomFromTree returns null beyond maxDepth',
        content: 'Test content',
        type: 'memory',
        tags: ['test'],
        atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const DEPTH_BEYOND_LIMIT = 22;
      const TARGET_ID = `L${String(DEPTH_BEYOND_LIMIT).padStart(4, '0')}`;

      const updateResult = await updateEntity({
        entry_id: writeResult.localId,
        atoms_batch: [
          {
            action: 'remove',
            local_id: TARGET_ID,
            cascade: true,
          },
        ],
      });

      expect(updateResult.success).toBe(true);
    });
  });
});
