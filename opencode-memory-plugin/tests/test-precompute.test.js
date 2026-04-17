import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PrecomputeClient, getPrecomputeClient } from '../lib/precompute/client.js';
import { BatchProcessor } from '../lib/precompute/batch-processor.js';
import { FingerprintCache } from '../lib/precompute/fingerprint-cache.js';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), 'precompute-test-' + Date.now());

describe('PrecomputeClient', () => {
  let client;
  let mockHttp;

  beforeEach(() => {
    mockHttp = {
      post: jest.fn(),
      get: jest.fn(),
    };

    client = new PrecomputeClient({
      client: {
        http: mockHttp,
        tenantId: 'default',
      },
    });
  });

  describe('uploadAnalysis', () => {
    it('should upload analysis results to backend', async () => {
      mockHttp.post.mockResolvedValue({
        memory_ids: { 'src/main.js': 'mem-001' },
        status: 'success',
        processed_count: 1,
      });

      const result = await client.uploadAnalysis({
        project_id: 'test-project',
        files: [{ path: 'src/main.js', content: 'function main() {}' }],
        symbols: [{ name: 'main', type: 'function', line: 1 }],
        relations: [],
      });

      expect(result.memory_ids).toEqual({ 'src/main.js': 'mem-001' });
      expect(result.status).toBe('success');
      expect(result.processed_count).toBe(1);
      expect(mockHttp.post).toHaveBeenCalledWith(
        '/api/v1/precompute/analysis',
        expect.objectContaining({
          project_id: 'test-project',
          tenant_id: 'default',
        })
      );
    });

    it('should handle empty symbols and relations', async () => {
      mockHttp.post.mockResolvedValue({
        memory_ids: {},
        status: 'success',
        processed_count: 0,
      });

      const result = await client.uploadAnalysis({
        project_id: 'test-project',
        files: [],
      });

      expect(result.processed_count).toBe(0);
    });

    it('should propagate errors', async () => {
      mockHttp.post.mockRejectedValue(new Error('Network error'));

      await expect(
        client.uploadAnalysis({
          project_id: 'test-project',
          files: [{ path: 'a.js', content: '' }],
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('uploadAnalysisBatch', () => {
    it('should split files into batches', async () => {
      mockHttp.post.mockResolvedValue({
        memory_ids: {},
        status: 'success',
        processed_count: 2,
      });

      const files = [
        { path: 'a.js', content: 'a' },
        { path: 'b.js', content: 'b' },
        { path: 'c.js', content: 'c' },
      ];

      const result = await client.uploadAnalysisBatch({
        project_id: 'test-project',
        files,
        batch_size: 2,
      });

      expect(result.total).toBe(3);
      expect(mockHttp.post).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch failures', async () => {
      mockHttp.post
        .mockResolvedValueOnce({
          memory_ids: { 'a.js': 'mem-001' },
          status: 'success',
          processed_count: 1,
        })
        .mockRejectedValueOnce(new Error('Batch 2 failed'));

      const files = [
        { path: 'a.js', content: 'a' },
        { path: 'b.js', content: 'b' },
      ];

      const result = await client.uploadAnalysisBatch({
        project_id: 'test-project',
        files,
        batch_size: 1,
      });

      expect(result.success).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('checkFingerprints', () => {
    it('should check fingerprints against backend', async () => {
      mockHttp.post.mockResolvedValue({
        changed_files: ['src/changed.js'],
        unchanged_files: ['src/unchanged.js'],
        new_files: ['src/new.js'],
      });

      const result = await client.checkFingerprints({
        fingerprints: [
          { file: 'src/changed.js', content_hash: 'abc', symbols_hash: 'def' },
          { file: 'src/unchanged.js', content_hash: 'ghi', symbols_hash: 'jkl' },
        ],
        project_id: 'test-project',
      });

      expect(result.changed_files).toEqual(['src/changed.js']);
      expect(result.unchanged_files).toEqual(['src/unchanged.js']);
      expect(result.new_files).toEqual(['src/new.js']);
    });
  });

  describe('searchSymbols', () => {
    it('should search symbols via backend API', async () => {
      mockHttp.get.mockResolvedValue({
        symbols: [{ name: 'main', type: 'function', file: 'src/main.js', line: 10 }],
        total: 1,
      });

      const result = await client.searchSymbols({
        query: 'main',
        type: 'function',
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe('main');
      expect(result.total).toBe(1);
    });

    it('should pass fuzzy and limit parameters', async () => {
      mockHttp.get.mockResolvedValue({ symbols: [], total: 0 });

      await client.searchSymbols({ query: 'test', fuzzy: true, limit: 5 });

      const calledUrl = mockHttp.get.mock.calls[0][0];
      expect(calledUrl).toContain('fuzzy=true');
      expect(calledUrl).toContain('limit=5');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const a = getPrecomputeClient();
      const b = getPrecomputeClient();
      expect(a).toBe(b);
    });
  });
});

describe('BatchProcessor', () => {
  it('should process analysis results and extract symbols', async () => {
    const mockClient = {
      uploadAnalysisBatch: jest.fn().mockResolvedValue({
        total: 1,
        success: 1,
        failed: 0,
        memory_ids: { 'test.js': 'mem-001' },
      }),
    };

    const processor = new BatchProcessor({ batch_size: 100 });
    processor.client = mockClient;

    const results = [
      {
        file_path: 'test.js',
        content: 'function foo() {}',
        functions: [{ name: 'foo', start: 1 }],
        classes: [],
        interfaces: [],
        call_relations: [{ from: 'foo', to: 'bar', type: 'calls', line: 2 }],
      },
    ];

    const result = await processor.processAll(results, 'test-project', 'default');

    expect(result.total).toBe(1);
    expect(result.success).toBe(1);

    const callArgs = mockClient.uploadAnalysisBatch.mock.calls[0][0];
    expect(callArgs.files).toHaveLength(1);
    expect(callArgs.symbols).toHaveLength(1);
    expect(callArgs.symbols[0].name).toBe('foo');
    expect(callArgs.relations).toHaveLength(1);
  });

  it('should handle empty results', async () => {
    const mockClient = {
      uploadAnalysisBatch: jest.fn().mockResolvedValue({
        total: 0,
        success: 0,
        failed: 0,
        memory_ids: {},
      }),
    };

    const processor = new BatchProcessor();
    processor.client = mockClient;

    const result = await processor.processAll([], 'test-project');
    expect(result.total).toBe(0);
  });
});

describe('FingerprintCache', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('should create empty cache when no file exists', () => {
    const cache = new FingerprintCache(TEST_DIR);
    expect(cache.size()).toBe(0);
  });

  it('should set and get fingerprints', () => {
    const cache = new FingerprintCache(TEST_DIR);
    cache.set('src/main.js', { content_hash: 'abc123', symbols_hash: 'def456' });

    const fp = cache.get('src/main.js');
    expect(fp).toBeTruthy();
    expect(fp.content_hash).toBe('abc123');
    expect(fp.symbols_hash).toBe('def456');
    expect(fp.updated_at).toBeTruthy();
  });

  it('should persist cache to disk', () => {
    const cache = new FingerprintCache(TEST_DIR);
    cache.set('src/main.js', { content_hash: 'abc', symbols_hash: 'def' });

    const cache2 = new FingerprintCache(TEST_DIR);
    expect(cache2.get('src/main.js').content_hash).toBe('abc');
  });

  it('should detect new files', () => {
    const cache = new FingerprintCache(TEST_DIR);
    const result = cache.hasChanged('src/new.js', 'content', { functions: [{ name: 'foo' }] });
    expect(result.changed).toBe(true);
    expect(result.reason).toBe('new_file');
  });

  it('should detect content changes', () => {
    const cache = new FingerprintCache(TEST_DIR);
    cache.set('src/main.js', { content_hash: 'old_hash', symbols_hash: 'sym_hash' });

    const result = cache.hasChanged('src/main.js', 'new content', { functions: [{ name: 'foo' }] });
    expect(result.changed).toBe(true);
    expect(result.reason).toBe('content_changed');
  });

  it('should detect symbol changes', () => {
    const cache = new FingerprintCache(TEST_DIR);
    const content = 'function foo() {}';
    const contentHash = cache.getContentHash(content);

    cache.set('src/main.js', { content_hash: contentHash, symbols_hash: 'old_sym' });

    const result = cache.hasChanged('src/main.js', content, { functions: [{ name: 'foo' }] });
    expect(result.changed).toBe(true);
    expect(result.reason).toBe('symbols_changed');
  });

  it('should detect no change', () => {
    const cache = new FingerprintCache(TEST_DIR);
    const content = 'function foo() {}';
    const analysis = { functions: [{ name: 'foo' }], classes: [], interfaces: [] };

    cache.set('src/main.js', {
      content_hash: cache.getContentHash(content),
      symbols_hash: cache.getSymbolsHash(analysis),
    });

    const result = cache.hasChanged('src/main.js', content, analysis);
    expect(result.changed).toBe(false);
  });

  it('should remove entries', () => {
    const cache = new FingerprintCache(TEST_DIR);
    cache.set('src/main.js', { content_hash: 'abc', symbols_hash: 'def' });
    expect(cache.size()).toBe(1);

    cache.remove('src/main.js');
    expect(cache.size()).toBe(0);
    expect(cache.get('src/main.js')).toBeNull();
  });

  it('should clear all entries', () => {
    const cache = new FingerprintCache(TEST_DIR);
    cache.set('a.js', { content_hash: 'a', symbols_hash: 'a' });
    cache.set('b.js', { content_hash: 'b', symbols_hash: 'b' });
    expect(cache.size()).toBe(2);

    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should compute consistent content hashes', () => {
    const cache = new FingerprintCache(TEST_DIR);
    const hash1 = cache.getContentHash('hello world');
    const hash2 = cache.getContentHash('hello world');
    const hash3 = cache.getContentHash('different');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(16);
  });

  it('should compute consistent symbol hashes', () => {
    const cache = new FingerprintCache(TEST_DIR);
    const analysis1 = { functions: [{ name: 'foo' }], classes: [], interfaces: [] };
    const analysis2 = { functions: [{ name: 'foo' }], classes: [], interfaces: [] };

    expect(cache.getSymbolsHash(analysis1)).toBe(cache.getSymbolsHash(analysis2));
  });

  it('should return "empty" for null analysis', () => {
    const cache = new FingerprintCache(TEST_DIR);
    expect(cache.getSymbolsHash(null)).toBe('empty');
  });

  it('should return "empty" for no symbols', () => {
    const cache = new FingerprintCache(TEST_DIR);
    expect(cache.getSymbolsHash({ functions: [], classes: [], interfaces: [] })).toBe('empty');
  });
});
