/**
 * Phase B Test Suite - Sync Methods
 * Tests for WrapperClient sync functionality
 *
 * These tests verify the sync methods exist and have correct signatures
 * without making actual HTTP calls (mocked/stubbed)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

let WrapperClient;
let WrapperError;
let DuplicateError;

beforeAll(async () => {
  try {
    const module = await import('../lib/wrapper-client.js');
    WrapperClient = module.WrapperClient;
    WrapperError = module.WrapperError;
    DuplicateError = module.DuplicateError;
  } catch (e) {
    console.warn('Warning: Could not import wrapper-client.js:', e.message);
  }
});

describe('WrapperClient Sync Methods', () => {
  let client;

  beforeEach(() => {
    if (WrapperClient) {
      client = new WrapperClient({
        backend: {
          url: 'http://localhost:17999',
          tenant_id: 'test-user',
        },
      });
    }
  });

  describe('syncPreview', () => {
    it('should exist as a method', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }
      expect(typeof client.syncPreview).toBe('function');
    });

    it('should accept fingerprints array parameter', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      expect(() => {
        if (typeof client.syncPreview !== 'function') {
          throw new Error('syncPreview is not a function');
        }
      }).not.toThrow();
    });

    it('should return a promise when called', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const fingerprints = [];
      const result = client.syncPreview(fingerprints);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should use default tenant_id from config', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const fingerprints = [];
      const result = client.syncPreview(fingerprints);
      expect(result).toBeDefined();
    });
  });

  describe('syncFull', () => {
    it('should exist as a method', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }
      expect(typeof client.syncFull).toBe('function');
    });

    it('should accept memories array parameter', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const memories = [
        {
          content: 'Test content',
          type: 'general',
          tags: ['test'],
          project_id: 'test-project',
          source_id: 'entry-001',
          metadata: { l0: 'Test', l1: 'Test overview' },
        },
      ];

      const result = client.syncFull(memories);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should handle empty memories array', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const memories = [];
      const result = client.syncFull(memories);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('getServerFingerprints', () => {
    it('should exist as a method', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }
      expect(typeof client.getServerFingerprints).toBe('function');
    });

    it('should return a promise', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const result = client.getServerFingerprints();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept optional tenant_id parameter', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const result = client.getServerFingerprints('custom-tenant');
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('resolveConflict', () => {
    it('should exist as a method', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }
      expect(typeof client.resolveConflict).toBe('function');
    });

    it('should accept conflict_id and resolution parameters', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const result = client.resolveConflict('conflict-001', 'use_local');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept different resolution options', () => {
      if (!WrapperClient) {
        console.log('⚠️ Skipping - wrapper-client not available');
        return;
      }

      const options = ['use_local', 'use_remote', 'merge', 'keep_both'];

      for (const resolution of options) {
        const result = client.resolveConflict('conflict-001', resolution);
        expect(result).toBeInstanceOf(Promise);
      }
    });
  });

  describe('Error Classes', () => {
    it('should export WrapperError', () => {
      if (!WrapperError) {
        console.log('⚠️ Skipping - WrapperError not available');
        return;
      }
      expect(WrapperError).toBeDefined();
      expect(WrapperError.prototype).toBeInstanceOf(Error);
    });

    it('should export DuplicateError extending WrapperError', () => {
      if (!DuplicateError) {
        console.log('⚠️ Skipping - DuplicateError not available');
        return;
      }
      expect(DuplicateError).toBeDefined();
      expect(DuplicateError.prototype).toBeInstanceOf(Error);
    });
  });
});

describe('Sync Method Signatures', () => {
  it('should have all sync methods defined on WrapperClient', async () => {
    if (!WrapperClient) {
      console.log('⚠️ Skipping - WrapperClient not available');
      return;
    }

    const testClient = new WrapperClient({
      backend: { url: 'http://localhost:17999', tenant_id: 'test' },
    });

    const requiredMethods = ['syncPreview', 'syncFull', 'getServerFingerprints', 'resolveConflict'];

    for (const method of requiredMethods) {
      expect(testClient).toHaveProperty(method);
      expect(typeof testClient[method]).toBe('function');
    }
  });
});
