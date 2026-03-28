/**
 * Test Suite - Project Resolver Module
 * Tests for project ID resolution functions
 */

import { describe, it, expect } from '@jest/globals';
import { resolveProjectId } from '../lib/project-resolver.js';

describe('Project Resolver Module', () => {
  describe('resolveProjectId', () => {
    it('should be a function', () => {
      expect(typeof resolveProjectId).toBe('function');
    });

    it('should return a string', async () => {
      const projectId = await resolveProjectId();

      expect(typeof projectId).toBe('string');
    });

    it('should return a non-empty string', async () => {
      const projectId = await resolveProjectId();

      expect(projectId.length).toBeGreaterThan(0);
    });
  });
});
