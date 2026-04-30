/**
 * Test Suite - ULID Module
 * Tests for ulid and generateLocalId functions
 */

import { describe, it, expect } from '@jest/globals';
import { ulid, generateLocalId } from '../../../lib/ulid.js';

describe('ULID Module', () => {
  describe('ulid', () => {
    it('should generate a 26-character string', () => {
      const id = ulid();

      expect(id).toHaveLength(26);
    });

    it('should only contain valid characters', () => {
      const id = ulid();
      const validChars = /^[0-9A-HJKMNP-TV-Z]+$/;

      expect(id).toMatch(validChars);
    });

    it('should generate unique IDs', () => {
      const id1 = ulid();
      const id2 = ulid();

      expect(id1).not.toBe(id2);
    });

    it('should start with time-based characters', () => {
      const id1 = ulid();
      const id2 = ulid();

      // First 10 characters should be similar (same time window)
      expect(id1.substring(0, 8)).toBe(id2.substring(0, 8));
    });
  });

  describe('generateLocalId', () => {
    it('should return a string', () => {
      const id = generateLocalId();

      expect(typeof id).toBe('string');
    });

    it('should generate 26-character IDs', () => {
      const id = generateLocalId();

      expect(id).toHaveLength(26);
    });
  });
});
