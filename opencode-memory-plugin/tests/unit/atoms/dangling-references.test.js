/**
 * Tests for dangling reference detection
 * TDD for v3.3 Atom Architecture - Phase 3 Risk Mitigation
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { detectDanglingReferences } from '../../../lib/atom-tree.js';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

describe('Dangling Reference Detection', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, updateEntity;

  beforeAll(async () => {
    tempDir = setupTestTempDir('dangling-ref-test-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      updateEntity = core.updateEntity;
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

  describe('detectDanglingReferences', () => {
    it('should return empty arrays for no links', () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'No links here', children: [] },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toEqual([]);
      expect(result.cross_entity_links).toEqual([]);
    });

    it('should detect dangling link to non-existent atom', () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Link to [[01ATOM999]]', children: [] },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toHaveLength(1);
      expect(result.dangling[0]).toEqual({
        source: '01ATOM001',
        target: '01ATOM999',
        type: 'wiki-link',
      });
    });

    it('should not flag valid links', () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Link to [[01ATOM002]]', children: [] },
        { local_id: '01ATOM002', content: 'Target atom', children: [] },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toEqual([]);
    });

    it('should detect multiple dangling links', () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Links to [[01ATOM999]] and [[01ATOM998]]', children: [] },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toHaveLength(2);
    });

    it('should check links in nested children', () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Parent',
          children: [
            { local_id: '01ATOM002', content: 'Link to [[01ATOM999]]', children: [] },
          ],
        },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toHaveLength(1);
      expect(result.dangling[0].source).toBe('01ATOM002');
    });

    it('should not flag cross-entity links as dangling', () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Cross-entity link to [[01ENT999/01ATOM888]]',
          children: [],
        },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toEqual([]);
      expect(result.cross_entity_links).toHaveLength(1);
    });

    it('should handle parent_id references', () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Parent', parent_id: null, children: [] },
        { local_id: '01ATOM002', content: 'Child', parent_id: '01ATOM001', children: [] },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toEqual([]);
    });

    it('should detect dangling parent_id reference', () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Orphan', parent_id: '01ATOM999', children: [] },
      ];

      const result = detectDanglingReferences(atoms, atoms);

      expect(result.dangling).toHaveLength(1);
      expect(result.dangling[0]).toEqual({
        source: '01ATOM001',
        target: '01ATOM999',
        type: 'parent-reference',
      });
    });
  });

  describe('Integration with writeMemory', () => {
    it('should warn about dangling references but allow write', async () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Link to [[01ATOM999]]', children: [] },
      ];

      const result = await writeMemory({
        abstract: 'Test',
        overview: 'Test',
        content: 'Test',
        type: 'memory',
        tags: ['test'],
        atoms: atoms,
        _source: 'test',
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.some(w => w.includes('dangling'))).toBe(true);
    });
  });

  describe('Integration with updateEntity', () => {
    it('should detect dangling references after atom operations', async () => {
      const atoms = [
        { local_id: '01ATOM001', content: 'Link to [[01ATOM002]]', children: [] },
        { local_id: '01ATOM002', content: 'Target', children: [] },
      ];

      const writeResult = await writeMemory({
        abstract: 'Test',
        overview: 'Test',
        content: 'Test',
        type: 'memory',
        tags: ['test'],
        atoms: atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const updateResult = await updateEntity({
        entry_id: writeResult.localId,
        atoms_batch: [
          { action: 'add', local_id: '01ATOM003', content: 'Link to [[01ATOM999]]', name: 'Test', type: 'section' },
        ],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.warnings).toBeDefined();
      expect(updateResult.warnings.some(w => w.includes('dangling'))).toBe(true);
    });
  });
});
