/**
 * Test Suite - Indexer Module
 * Tests for updateLinkMap and updateMemoryIndex functions
 */

import { describe, it, expect } from '@jest/globals';
import { updateLinkMap, removeFromLinkMap } from '../lib/indexer.js';

describe('Indexer Module', () => {
  describe('updateLinkMap', () => {
    it('should be a function', () => {
      expect(typeof updateLinkMap).toBe('function');
    });
  });

  describe('removeFromLinkMap', () => {
    it('should be a function', () => {
      expect(typeof removeFromLinkMap).toBe('function');
    });
  });
});
