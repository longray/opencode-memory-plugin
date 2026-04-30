/**
 * Test Suite - BM25 Module
 * Tests for BM25Index class
 */

import { describe, it, expect } from '@jest/globals';
import { BM25Index } from '../../../lib/bm25.js';

describe('BM25 Module', () => {
  describe('BM25Index class', () => {
    it('should be a constructor function', () => {
      expect(typeof BM25Index).toBe('function');
    });

    it('should create an instance', () => {
      const bm25 = new BM25Index();

      expect(bm25).toBeDefined();
    });

    it('should have addDocument method', () => {
      const bm25 = new BM25Index();

      expect(typeof bm25.addDocument).toBe('function');
    });

    it('should have search method', () => {
      const bm25 = new BM25Index();

      expect(typeof bm25.search).toBe('function');
    });

    it('should add and search documents', () => {
      const bm25 = new BM25Index();

      bm25.addDocument('doc1', 'JavaScript programming language');
      bm25.addDocument('doc2', 'Python programming tutorial');
      bm25.addDocument('doc3', 'JavaScript framework React');

      const results = bm25.search('JavaScript');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', () => {
      const bm25 = new BM25Index();

      bm25.addDocument('doc1', 'JavaScript programming');

      const results = bm25.search('Python');

      expect(results).toEqual([]);
    });
  });
});
