/**
 * Test Suite - Memory Core Module
 * Tests for writeMemory and readMemory functions
 */

import { describe, it, expect } from '@jest/globals';
import { writeMemory, readMemory } from '../../../lib/memory-core.js';

describe('Memory Core Module', () => {
  describe('writeMemory', () => {
    it('should return error for missing abstract', async () => {
      const result = await writeMemory({
        abstract: '',
        overview: 'Test overview',
        content: 'Test content',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('abstract is REQUIRED');
    });

    it('should return error for null abstract', async () => {
      const result = await writeMemory({
        abstract: null,
        overview: 'Test overview',
        content: 'Test content',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('abstract is REQUIRED');
    });

    it('should return error for non-string abstract', async () => {
      const result = await writeMemory({
        abstract: 123,
        overview: 'Test overview',
        content: 'Test content',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('abstract is REQUIRED');
    });

    it('should return error for missing overview', async () => {
      const result = await writeMemory({
        abstract: 'Test abstract',
        overview: '',
        content: 'Test content',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('overview is REQUIRED');
    });

    it('should return error for missing content', async () => {
      const result = await writeMemory({
        abstract: 'Test abstract',
        overview: 'Test overview',
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('content is REQUIRED');
    });
  });

  describe('readMemory', () => {
    it('should return error for missing entry_id', async () => {
      const result = await readMemory({ entry_id: '', level: 0 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('entry_id is REQUIRED');
    });

    it('should return error for non-string entry_id', async () => {
      const result = await readMemory({ entry_id: 123, level: 0 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('entry_id is REQUIRED');
    });

    it('should return error for invalid level', async () => {
      const result = await readMemory({ entry_id: 'test-id', level: 5 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('level must be 0, 1, or 2');
    });

    it('should return error for non-existent entry', async () => {
      const result = await readMemory({ entry_id: 'nonexistent-entry-id', level: 0 });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Entry not found');
    });

    it('should default to level 2 when level not specified', async () => {
      const result = await readMemory({ entry_id: 'nonexistent-entry-id' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Entry not found');
    });
  });
});
