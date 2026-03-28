/**
 * Test Suite - Upload Queue Module
 * Tests for addToQueue and getQueueStats functions
 */

import { describe, it, expect } from '@jest/globals';
import { addToQueue, getQueueStats } from '../lib/upload-queue.js';

describe('Upload Queue Module', () => {
  describe('getQueueStats', () => {
    it('should return an object with stats', () => {
      const stats = getQueueStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
    });
  });

  describe('addToQueue', () => {
    it('should be a function', () => {
      expect(typeof addToQueue).toBe('function');
    });
  });
});
