/**
 * Test Suite - Trie Index Module
 * Tests for tokenizeForTrie and searchByPrefix functions
 */

import { describe, it, expect } from '@jest/globals';
import { tokenizeForTrie, searchByPrefix } from '../../../lib/trie-index.js';

describe('Trie Index Module', () => {
  describe('tokenizeForTrie', () => {
    it('should be a function', () => {
      expect(typeof tokenizeForTrie).toBe('function');
    });

    it('should return empty array for null input', () => {
      const result = tokenizeForTrie(null);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = tokenizeForTrie('');

      expect(result).toEqual([]);
    });

    it('should tokenize simple text', () => {
      const result = tokenizeForTrie('hello world');

      expect(result).toContain('hello');
      expect(result).toContain('world');
    });

    it('should filter short tokens', () => {
      const result = tokenizeForTrie('a bb ccc');

      expect(result).not.toContain('a');
      expect(result).toContain('bb');
      expect(result).toContain('ccc');
    });

    it('should handle Chinese characters', () => {
      const result = tokenizeForTrie('你好世界');

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('searchByPrefix', () => {
    it('should be a function', () => {
      expect(typeof searchByPrefix).toBe('function');
    });

    it('should return a promise', () => {
      const result = searchByPrefix('test');

      expect(result).toBeInstanceOf(Promise);
    });

    it('should return Set for valid prefix', async () => {
      const result = await searchByPrefix('test');

      expect(result).toBeInstanceOf(Set);
    });
  });
});
