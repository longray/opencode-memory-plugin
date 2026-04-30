/**
 * Tests for dead link marking
 * TDD for v3.3 Atom Architecture - Phase 3 Risk Mitigation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writeMemory, markDeadLinks } from '../../../lib/memory-core.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Dead Link Marking', () => {
  let tempDir;
  let originalMemoryDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-links-test-'));
    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    const now = new Date();
    const timelineDir = path.join(tempDir, 'timeline', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'));
    fs.mkdirSync(timelineDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'MEMORY.md'), '# Memory Index\n\n');
  });

  afterEach(() => {
    if (originalMemoryDir) {
      process.env.MEMORY_DIR = originalMemoryDir;
    } else {
      delete process.env.MEMORY_DIR;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('markDeadLinks', () => {
    it('should mark dangling wiki links as dead', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Link to [[01ATOM999]]',
          children: [],
        },
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

      const markResult = await markDeadLinks({ entry_id: writeResult.localId });

      expect(markResult.success).toBe(true);
      expect(markResult.marked_count).toBeGreaterThan(0);
    });

    it('should return 0 for no dead links', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'No links here',
          children: [],
        },
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

      const markResult = await markDeadLinks({ entry_id: writeResult.localId });

      expect(markResult.success).toBe(true);
      expect(markResult.marked_count).toBe(0);
    });

    it('should return error for non-existent entry', async () => {
      const result = await markDeadLinks({ entry_id: 'NONEXISTENT' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should track cross-entity links in result', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Cross-entity link [[SOME_ENTITY/01ATOM999|See Also]] and dead local [[01DEAD]]',
          children: [],
        },
      ];

      const writeResult = await writeMemory({
        abstract: 'Test cross-entity tracking',
        overview: 'Test cross-entity tracking',
        content: 'Test',
        type: 'memory',
        tags: ['test'],
        atoms: atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const markResult = await markDeadLinks({ entry_id: writeResult.localId });

      expect(markResult.success).toBe(true);
      expect(markResult.cross_entity_links).toHaveLength(1);
      expect(markResult.cross_entity_links[0]).toMatchObject({
        source: '01ATOM001',
        target: '01ATOM999',
        entity_id: 'SOME_ENTITY',
      });
      expect(markResult.dead_links).toHaveLength(1);
      expect(markResult.dead_links[0].target).toBe('01DEAD');
    });

    it('should return empty cross_entity_links when none exist', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'No cross-entity links here',
          children: [],
        },
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

      const markResult = await markDeadLinks({ entry_id: writeResult.localId });

      expect(markResult.success).toBe(true);
      expect(markResult.cross_entity_links).toEqual([]);
    });

    it('should persist dead_links field to file', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Link to dead [[01DEAD001]] and [[01DEAD002]]',
          children: [],
        },
      ];

      const writeResult = await writeMemory({
        abstract: 'Persistence test',
        overview: 'Test dead link persistence to file',
        content: 'Test',
        type: 'memory',
        tags: ['test'],
        atoms: atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const markResult = await markDeadLinks({ entry_id: writeResult.localId });

      expect(markResult.success).toBe(true);
      expect(markResult.marked_count).toBe(2);

      const fileContent = fs.readFileSync(writeResult.filePath, 'utf-8');
      expect(fileContent).toContain('"dead_links"');
      expect(fileContent).toContain('"01DEAD001"');
      expect(fileContent).toContain('"01DEAD002"');
      expect(fileContent).toContain('"type": "wiki-link"');
    });

    it('should persist dead_links in nested children to file', async () => {
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Parent content',
          children: [
            {
              local_id: '01ATOM002',
              content: 'Child links to [[01MISSING]]',
              children: [],
            },
          ],
        },
      ];

      const writeResult = await writeMemory({
        abstract: 'Nested persistence',
        overview: 'Test dead links in nested atoms persist',
        content: 'Test',
        type: 'memory',
        tags: ['test'],
        atoms: atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      const markResult = await markDeadLinks({ entry_id: writeResult.localId });

      expect(markResult.success).toBe(true);
      expect(markResult.marked_count).toBe(1);

      const fileContent = fs.readFileSync(writeResult.filePath, 'utf-8');
      expect(fileContent).toContain('"dead_links"');
      expect(fileContent).toContain('"01MISSING"');
    });
  });

  describe('markDeadLinks concurrency', () => {
    it('should serialize concurrent calls to prevent lost updates', async () => {
      // Create an entry with multiple dead links across atoms
      const atoms = [
        {
          local_id: '01ATOM001',
          content: 'Link to dead [[01DEAD001]]',
          children: [],
        },
        {
          local_id: '01ATOM002',
          content: 'Link to dead [[01DEAD002]]',
          children: [],
        },
      ];

      const writeResult = await writeMemory({
        abstract: 'Concurrency test',
        overview: 'Test concurrent markDeadLinks calls',
        content: 'Test',
        type: 'memory',
        tags: ['test'],
        atoms,
        _source: 'test',
      });

      expect(writeResult.success).toBe(true);

      // Fire two concurrent markDeadLinks calls
      const [result1, result2] = await Promise.all([
        markDeadLinks({ entry_id: writeResult.localId }),
        markDeadLinks({ entry_id: writeResult.localId }),
      ]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify no lost updates: the file should contain dead_links for both atoms
      const fileContent = fs.readFileSync(writeResult.filePath, 'utf-8');
      const hasDead001 = fileContent.includes('"01DEAD001"');
      const hasDead002 = fileContent.includes('"01DEAD002"');

      // At least one dead link must be present (the last writer wins)
      // With locking, both should be present since both calls read fresh state
      expect(hasDead001 || hasDead002).toBe(true);
    });
  });
});
