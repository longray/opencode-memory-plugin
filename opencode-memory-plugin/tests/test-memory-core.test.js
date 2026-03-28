/**
 * Test Suite - Memory Core Module
 * Tests for writeMemory and readMemory functions
 */

import { describe, it, expect } from '@jest/globals';
import { writeMemory } from '../lib/memory-core.js';

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
});
