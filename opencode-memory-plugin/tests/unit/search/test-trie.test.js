/**
 * Test Suite - Trie Module
 * Tests for Trie data structure
 */

import { describe, it, expect } from '@jest/globals';
import { Trie } from '../../../lib/trie.js';

describe('Trie Module', () => {
  describe('Trie class', () => {
    it('should be a constructor function', () => {
      expect(typeof Trie).toBe('function');
    });

    it('should create an instance', () => {
      const trie = new Trie();

      expect(trie).toBeDefined();
    });

    it('should have insert method', () => {
      const trie = new Trie();

      expect(typeof trie.insert).toBe('function');
    });

    it('should have search method', () => {
      const trie = new Trie();

      expect(typeof trie.search).toBe('function');
    });

    it('should insert and search words', () => {
      const trie = new Trie();

      trie.insert('apple', 'entry-001');
      trie.insert('application', 'entry-002');
      trie.insert('banana', 'entry-003');

      const results = trie.search('app');

      expect(results.size).toBe(2);
      expect(results.has('entry-001')).toBe(true);
      expect(results.has('entry-002')).toBe(true);
    });

    it('should return empty set for non-matching prefix', () => {
      const trie = new Trie();

      trie.insert('apple', 'entry-001');

      const results = trie.search('xyz');

      expect(results.size).toBe(0);
    });
  });
});
