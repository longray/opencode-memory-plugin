/**
 * Integration tests for Memory Lookup API
 * Tests the end-to-end flow: upload → lookup → verify
 */

import { describe, expect, beforeAll } from '@jest/globals';
import { WrapperClient } from '../../lib/wrapper-client.js';
import { MemoryIdCache } from '../../lib/memory-id-cache.js';
import { codeAnalyzer } from '../../lib/code-analyzer.js';

describe('Memory Lookup API Integration Tests', () => {
  let wrapperClient;
  let memoryIdCache;
  const projectId = 'test-lookup-project';
  const testSourceId = `test-source-${Date.now()}`;
  let uploadedMemoryId = null;

  beforeAll(async () => {
    wrapperClient = new WrapperClient();
    memoryIdCache = new MemoryIdCache(projectId);
    await memoryIdCache.load();
  });

  describe('Scenario 1: Upload and Lookup by source_id', () => {
    test('should upload code with source_id', async () => {
      const sourceCode = `
        export function lookupTestFunction(x: number): number {
          return x * 2;
        }
      `;

      const analysis = await codeAnalyzer.analyze('src/lookup-test.ts', sourceCode);
      expect(analysis).toBeDefined();
      expect(analysis.functions).toHaveLength(1);

      // Upload with source_id
      const result = await wrapperClient.uploadMemories([
        {
          type: 'code',
          content: JSON.stringify(analysis),
          abstract: 'Lookup test function',
          overview: 'Test file for lookup API',
          source_id: testSourceId,
          local_id: testSourceId,
          project_id: projectId,
          metadata: {
            file_path: 'src/lookup-test.ts',
            content_hash: 'abc123',
          },
        },
      ]);

      expect(result.success).toBeGreaterThan(0);
      expect(result.memory_ids).toHaveLength(1);
      uploadedMemoryId = result.memory_ids[0];

      console.log(`✅ Uploaded with source_id: ${testSourceId}, memory_id: ${uploadedMemoryId}`);
    });

    test('should lookup memory by source_id', async () => {
      const result = await wrapperClient.lookupMemory({
        source_id: testSourceId,
      });

      console.log('Lookup result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(result.found).toBe(true);
      expect(result.memory_id).toBe(uploadedMemoryId);
      expect(result.source_id).toBe(testSourceId);
    });
  });

  describe('Scenario 2: Lookup by file_path and project_id', () => {
    test('should lookup memory by file_path', async () => {
      const result = await wrapperClient.lookupMemory({
        file_path: 'src/lookup-test.ts',
        project_id: projectId,
      });

      console.log('Lookup by file_path result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(result.found).toBe(true);
      expect(result.memory_id).toBe(uploadedMemoryId);
      expect(result.file_path).toBe('src/lookup-test.ts');
    });
  });

  describe('Scenario 3: Lookup not found', () => {
    test('should return not found for non-existent source_id', async () => {
      const result = await wrapperClient.lookupMemory({
        source_id: 'non-existent-source-id',
      });

      console.log('Not found result:', JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      expect(result.found).toBe(false);
    });

    test('should return not found for non-existent file_path', async () => {
      const result = await wrapperClient.lookupMemory({
        file_path: 'non-existent-file.ts',
        project_id: projectId,
      });

      expect(result).toBeDefined();
      expect(result.found).toBe(false);
    });
  });

  describe('Scenario 4: Cache integration', () => {
    test('should save lookup result to cache', async () => {
      // Lookup from backend
      const result = await wrapperClient.lookupMemory({
        source_id: testSourceId,
      });

      expect(result.found).toBe(true);

      // Save to cache
      await memoryIdCache.set(result.file_path, result.source_id, result.memory_id);

      // Verify cache
      const cachedMemoryId = await memoryIdCache.getMemoryId(result.file_path);
      expect(cachedMemoryId).toBe(result.memory_id);

      const cachedSourceId = await memoryIdCache.getSourceId(result.file_path);
      expect(cachedSourceId).toBe(result.source_id);

      console.log('✅ Cache integration working');
    });

    test('should retrieve from cache without backend call', async () => {
      const filePath = 'src/lookup-test.ts';

      // Get from cache (should not need backend)
      const memoryId = await memoryIdCache.getMemoryId(filePath);
      const sourceId = await memoryIdCache.getSourceId(filePath);

      expect(memoryId).toBe(uploadedMemoryId);
      expect(sourceId).toBe(testSourceId);

      console.log('✅ Cache hit working');
    });
  });

  describe('Scenario 5: Cache rebuild from backend', () => {
    test('should rebuild cache from backend lookup', async () => {
      // Clear cache
      await memoryIdCache.clear();

      // Rebuild from backend
      const rebuilt = await memoryIdCache.rebuildFromBackend(
        wrapperClient.lookupMemory.bind(wrapperClient),
        ['src/lookup-test.ts']
      );

      expect(rebuilt).toBeGreaterThan(0);

      // Verify cache is rebuilt
      const memoryId = await memoryIdCache.getMemoryId('src/lookup-test.ts');
      expect(memoryId).toBe(uploadedMemoryId);

      console.log(`✅ Rebuilt ${rebuilt} entries from backend`);
    });
  });
});
