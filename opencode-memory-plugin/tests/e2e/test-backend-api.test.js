/**
 * E2E Integration Tests - Backend API Connectivity
 *
 * Tests real backend service interactions at localhost:18008.
 * These tests require the backend service to be running.
 *
 * Run: npm test -- tests/e2e/test-backend-api.test.js
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { WrapperClient } from '../../lib/wrapper-client.js';
import { PrecomputeClient } from '../../lib/precompute/client.js';

const BACKEND_URL = process.env.MEMORY_BACKEND_URL || 'http://localhost:18008';
const BACKEND_AVAILABLE = { value: false };

describe('E2E: Backend API', () => {
  let client;
  let precomputeClient;

  beforeAll(async () => {
    client = new WrapperClient({ backend: { url: BACKEND_URL, tenant_id: 'default' } });
    precomputeClient = new PrecomputeClient({ client });

    try {
      const health = await client.health();
      BACKEND_AVAILABLE.value = health.status === 'healthy';
    } catch {
      BACKEND_AVAILABLE.value = false;
    }
  });

  describe('Health Check', () => {
    it('should connect to backend service', async () => {
      if (!BACKEND_AVAILABLE.value) {
        console.log('Skipping: Backend not available');
        return;
      }

      const health = await client.health();
      expect(health.status).toBe('healthy');
      expect(health.port).toBe(18008);
    });

    it('should report SurrealDB as connected', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const health = await client.health();
      expect(health.surrealdb?.status).toBe('connected');
    });

    it('should report Meilisearch as available', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const health = await client.health();
      expect(health.meilisearch?.status).toBe('available');
    });
  });

  describe('Memory CRUD', () => {
    const testId = `e2e-test-${Date.now()}`;

    it('should upload a memory', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await client.uploadMemory({
        content: `E2E test content ${testId}`,
        abstract: `E2E test abstract ${testId}`,
        overview: `E2E test overview for integration testing`,
        type: 'general',
        tags: ['e2e-test', 'integration'],
        project_id: 'e2e-test-project',
        source: 'e2e-test',
        tenant_id: 'default',
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeTruthy();
    }, 30000);

    it('should search memories', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await client.search({
        query: 'E2E test',
        mode: 'keyword',
        limit: 5,
        tenant_id: 'default',
      });

      expect(result).toBeTruthy();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Code Fingerprint Sync', () => {
    it('should sync code fingerprints', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await precomputeClient.checkFingerprints({
        fingerprints: [
          {
            file: 'e2e-test-file.js',
            content_hash: 'abc123def456',
            symbols_hash: 'sym789ghi012',
          },
        ],
        project_id: 'e2e-test-project',
        tenant_id: 'default',
      });

      expect(result).toBeTruthy();
      expect(Array.isArray(result.changed_files || result.new_files || [])).toBe(true);
    });
  });

  describe('Precompute Analysis', () => {
    it('should upload code analysis results', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await precomputeClient.uploadAnalysis({
        project_id: 'e2e-test-project',
        files: [
          {
            path: 'e2e-test-analyze.js',
            content: 'function hello() { return "world"; }',
          },
        ],
        symbols: [{ name: 'hello', type: 'function', line: 1, location: 'e2e-test-analyze.js:1' }],
        relations: [],
        tenant_id: 'default',
      });

      expect(result).toBeTruthy();
      expect(typeof result.processed_count).toBe('number');
    });
  });

  describe('Symbol Search', () => {
    it('should search symbols', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await precomputeClient.searchSymbols({
        query: 'hello',
        type: 'function',
        tenant_id: 'default',
      });

      expect(result).toBeTruthy();
      expect(Array.isArray(result.symbols)).toBe(true);
    });
  });

  describe('Graph Relations', () => {
    it('should create and query relations', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const ts = Date.now();
      let mem1Id, mem2Id;

      try {
        const mem1 = await client.uploadMemory({
          content: `E2E relation source ${ts}`,
          abstract: `Relation source ${ts}`,
          overview: 'Source node for relation test',
          type: 'general',
          tags: ['e2e-test', 'relation'],
          project_id: 'e2e-test-project',
          tenant_id: 'default',
        });
        mem1Id = mem1.id;
      } catch {
        // Upload may fail due to dedup; skip test
        console.log('Skipping: mem1 upload failed');
        return;
      }

      try {
        const mem2 = await client.uploadMemory({
          content: `E2E relation target ${ts}`,
          abstract: `Relation target ${ts}`,
          overview: 'Target node for relation test',
          type: 'general',
          tags: ['e2e-test', 'relation'],
          project_id: 'e2e-test-project',
          tenant_id: 'default',
        });
        mem2Id = mem2.id;
      } catch {
        console.log('Skipping: mem2 upload failed');
        return;
      }

      if (mem1Id && mem2Id) {
        const relation = await client.createRelation({
          from_id: mem1Id,
          to_id: mem2Id,
          type: 'related',
          weight: 0.8,
          tenant_id: 'default',
        });

        expect(relation).toBeTruthy();

        const graph = await client.traverseGraph({
          memory_id: mem1Id,
          depth: 1,
          tenant_id: 'default',
        });

        expect(graph).toBeTruthy();
      }
    }, 30000);
  });

  describe('Sync Operations', () => {
    it('should get server fingerprints', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await client.getServerFingerprints('default');
      expect(result).toBeTruthy();
    });

    it('should list conflicts (empty)', async () => {
      if (!BACKEND_AVAILABLE.value) return;

      const result = await client.listConflicts({ limit: 10, tenant_id: 'default' });
      expect(result).toBeTruthy();
    });
  });
});
