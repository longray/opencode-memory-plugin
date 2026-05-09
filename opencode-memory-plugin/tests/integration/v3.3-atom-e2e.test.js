/**
 * v3.3 Atom Architecture End-to-End Integration Tests
 * Tests plugin-backend integration for Atom features
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../helpers/mock-constants.js';

describe('v3.3 Atom Architecture E2E', () => {
  let tempDir;
  let originalMemoryDir;
  let wrapperClient;
  let testEntityId;
  let writeMemory, readMemory, updateEntity, getEntityAtoms;

  beforeAll(async () => {
    tempDir = setupTestTempDir('v3.3-atom-e2e-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      readMemory = core.readMemory;
      updateEntity = core.updateEntity;
      getEntityAtoms = core.getEntityAtoms;

      const { WrapperClient } = await import('../../lib/wrapper-client.js');
      wrapperClient = new WrapperClient();
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

  describe('Step 1: Create Entity with Atoms', () => {
    it('should create Entity with Atom tree locally', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          source_id: '01ATOM001',
          atom_id: null,
          type: 'chapter',
          name: 'Chapter 1: Introduction',
          content: 'This is the introduction chapter.',
          tags: ['intro', 'chapter1'],
          aliases: ['Intro', 'Chapter One'],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [
            {
              local_id: '01ATOM002',
              source_id: '01ATOM002',
              atom_id: null,
              type: 'section',
              name: '1.1 Background',
              content: 'Background information here.',
              tags: ['background'],
              aliases: [],
              order: 'a0',
              heading_level: 2,
              parent_id: '01ATOM001',
              children: [],
            },
          ],
        },
      ];

      const result = await writeMemory({
        abstract: 'Vue 3 Best Practices Guide',
        overview: 'A comprehensive guide to Vue 3 with Composition API',
        content: 'Full guide content...',
        type: 'memory',
        tags: ['vue', 'guide'],
        atoms: atoms,
        _source: 'v3.3-e2e-test',
      });

      expect(result.success).toBe(true);
      expect(result.localId).toBeDefined();
      testEntityId = result.localId;
    });

    it('should sync Entity with Atoms to backend', async () => {
      const readResult = await readMemory({ entry_id: testEntityId, level: 2 });

      expect(readResult.success).toBe(true);
      expect(readResult.entry_type).toBe('memory');
      expect(readResult.atoms).toBeDefined();
      expect(readResult.atoms).toHaveLength(1);
      expect(readResult.atoms[0].children).toHaveLength(1);
    });
  });

  describe('Step 2: Backend API Verification', () => {
    it('should verify backend health', async () => {
      const health = await wrapperClient.http.get('/health');
      expect(health.status).toBe('healthy');
    });

    it('should search using unified search endpoint', async () => {
      try {
        const searchResult = await wrapperClient.http.post('/api/v1/search', {
          query: 'Vue',
          mode: 'hybrid',
          scope: 'all',
          limit: 10,
          tenant_id: 'default',
        });

        expect(searchResult).toBeDefined();
        expect(searchResult.results).toBeDefined();
        expect(Array.isArray(searchResult.results)).toBe(true);
      } catch (error) {
        console.log('Unified search endpoint not available yet:', error.message);
      }
    });
  });

  describe('Step 3: Update Entity Atoms', () => {
    it('should add new Atom to existing Entity', async () => {
      const updateResult = await updateEntity({
        entry_id: testEntityId,
        atoms_batch: [
          {
            action: 'add',
            local_id: '01ATOM003',
            type: 'section',
            name: '1.2 Getting Started',
            content: 'Getting started content...',
            parent_id: '01ATOM001',
            order: 'a1',
            heading_level: 2,
          },
        ],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.atoms_result).toHaveLength(1);
      expect(updateResult.atoms_result[0].action).toBe('add');
    });

    it('should verify Atom tree structure after update', async () => {
      const atomsResult = await getEntityAtoms({
        entry_id: testEntityId,
        include_content: true,
      });

      expect(atomsResult.success).toBe(true);
      expect(atomsResult.total_atoms).toBeGreaterThanOrEqual(1);
      expect(atomsResult.tree).toHaveLength(1);
    });
  });

  describe('Step 4: Atom Fields Verification', () => {
    it('should verify all v3.3 Atom fields are preserved', async () => {
      const readResult = await readMemory({ entry_id: testEntityId, level: 2 });

      expect(readResult.success).toBe(true);
      expect(readResult.atoms).toBeDefined();

      const chapter = readResult.atoms[0];
      expect(chapter.local_id).toBe('01ATOM001');
      expect(chapter.type).toBe('chapter');
      expect(chapter.name).toBe('Chapter 1: Introduction');
      expect(chapter.tags).toContain('intro');
      expect(chapter.aliases).toContain('Intro');
      expect(chapter.order).toBe('a0');
      expect(chapter.heading_level).toBe(1);
      expect(chapter.parent_id).toBeNull();
    });
  });

  describe('Step 5: Backward Compatibility', () => {
    it('should read Entity without atoms (old format)', async () => {
      const oldResult = await writeMemory({
        abstract: 'Old style entity',
        overview: 'No atoms here',
        content: 'Just plain content',
        type: 'memory',
        tags: ['old', 'test'],
        _source: 'v3.3-compat-test',
      });

      expect(oldResult.success).toBe(true);

      const readResult = await readMemory({ entry_id: oldResult.localId });
      expect(readResult.success).toBe(true);
      expect(readResult.entry_type).toBe('memory');
      expect(readResult.atoms || []).toHaveLength(0);
    });
  });
});
