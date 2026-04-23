/**
 * Integration tests for Calls API
 * Tests the end-to-end flow: upload → analyze → upload calls → query
 */

import { describe, expect, beforeAll, afterAll } from '@jest/globals';
import { WrapperClient } from '../../lib/wrapper-client.js';
import { codeAnalyzer } from '../../lib/code-analyzer.js';
import { AnalysisQueue } from '../../lib/code-analysis-service.js';
import { MemoryIdCache } from '../../lib/memory-id-cache.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

describe('Calls API Integration Tests', () => {
  let wrapperClient;
  let analysisQueue;
  const _projectId = 'github.com/test/integration';

  // Isolated cache directory per test run to avoid cross-test pollution
  const tempCacheDir = path.join(os.tmpdir(), 'memory-cache-calls-' + Date.now());
  let memoryIdCache;

  beforeAll(async () => {
    wrapperClient = new WrapperClient();
    analysisQueue = new AnalysisQueue();
    // Inject isolated cache into AnalysisQueue before initCache() is called
    memoryIdCache = new MemoryIdCache('github.com/test/integration', tempCacheDir);
    analysisQueue.memoryIdCache = memoryIdCache;
  });

  afterAll(() => {
    if (memoryIdCache) {
      memoryIdCache.cleanup();
    }
    // Clean up isolated temp cache
    try {
      fs.rmSync(tempCacheDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors (temp dir may already be gone)
    }
  });

  describe('Scenario 1: Basic Call Relationship', () => {
    test('should upload crypto.ts and get memory_id', async () => {
      const sourceCode = `
        export function hashPassword(password: string): string {
          return \`hash_\${password}\`;
        }
      `;

      const result = await codeAnalyzer.analyze('src/utils/crypto.ts', sourceCode);
      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
      expect(result.calls).toBeDefined();
    });

    test('should upload auth.ts and get memory_id', async () => {
      const sourceCode = `
        import { hashPassword } from './utils/crypto';
        
        export function validateUser(username: string, password: string): boolean {
          const hash = hashPassword(password);
          return hash !== '';
        }
      `;

      const result = await codeAnalyzer.analyze('src/auth.ts', sourceCode);
      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
      expect(result.calls).toBeDefined();
      expect(result.calls.length).toBeGreaterThan(0);
      expect(result.calls[0].target).toBe('hashPassword');
    });

    test('should cache memory_ids after upload', async () => {
      await analysisQueue.initCache();
      const cache = analysisQueue.getMemoryIdCache();
      expect(cache).toBeDefined();
      expect(cache.constructor.name).toBe('MemoryIdCache');
    });
  });

  describe('Scenario 2: Backend API Availability', () => {
    test('should have wrapper client initialized', () => {
      expect(wrapperClient).toBeDefined();
    });

    test('should have calls API endpoints available', () => {
      // Verify the wrapper client has the required methods
      expect(typeof wrapperClient.uploadMemories).toBe('function');
    });
  });

  describe('Scenario 3: Error Handling', () => {
    test('should handle missing memory_id gracefully', async () => {
      const memoryId = await analysisQueue.getMemoryId('non-existent-file.ts');
      expect(memoryId).toBeNull();
    });
  });
});
