/**
 * Test Suite - Storage Module
 * Tests for getConfig and getEntryById functions
 */

import { describe, it, expect } from '@jest/globals';
import { getConfig, getEntryById } from '../../../lib/storage.js';

describe('Storage Module', () => {
  describe('getConfig', () => {
    it('should return config object', () => {
      const config = getConfig();

      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should return empty object if config not found', () => {
      const config = getConfig();

      expect(typeof config).toBe('object');
    });
  });

  describe('getEntryById', () => {
    it('should return null for non-existent entry', () => {
      const result = getEntryById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should return null for empty entryId', () => {
      const result = getEntryById('');

      expect(result).toBeNull();
    });
  });
});
