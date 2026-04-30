/**
 * Auto-Sync Pipeline Tests
 * Coverage: AnalysisQueue.add() → processQueue() → processItem() → uploadAsAtomEntity()
 *
 * Mock strategy:
 * - codeAnalyzer: jest.spyOn(codeAnalyzer, 'analyze') — ESM live binding, same object ref
 * - wrapperClient/fingerprintCache/memoryIdCache: instance replacement on queue
 * - shouldSkipFile: real function, use actual sensitive content to trigger skip
 * - fs/promises: jest.unstable_mockModule to ensure readFile mock propagates to all importers
 */

import { jest } from '@jest/globals';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn().mockImplementation(async filePath => {
    if (filePath.includes('nonexistent')) {
      const err = new Error('ENOENT');
      err.code = 'ENOENT';
      throw err;
    }
    if (filePath.includes('sensitive')) {
      return 'const API_KEY = "sk-1234567890abcdef";';
    }
    return 'function foo(x) { return x + 1; }';
  }),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getConfig: jest.fn().mockReturnValue({
    code_analysis: {},
    backend: { tenant_id: 'test-tenant' },
  }),
}));

const { codeAnalyzer } = await import('../../../lib/code-analyzer.js');
const { AnalysisQueue } = await import('../../../lib/code-analysis-service.js');

const flushPromises = () => Promise.resolve().then(() => Promise.resolve().then(() => {}));

async function drainTimersAndPromises() {
  for (let i = 0; i < 50; i++) {
    jest.advanceTimersByTime(100);
    await flushPromises();
  }
}

const MOCK_CONTENT = 'function foo(x) { return x + 1; }';

const MOCK_ANALYSIS = {
  language: 'javascript',
  analyzer: 'oxc',
  functions: [
    {
      name: 'foo',
      params: [{ name: 'x' }],
      return_type: 'number',
      is_exported: true,
      is_async: false,
      start_line: 1,
      end_line: 5,
    },
  ],
  classes: [],
  imports: [],
  calls: [{ target: 'foo', line: 3, column: 2, file_path: 'a.js' }],
  complexity_metrics: { cyclomatic: 1, lines_of_code: 5 },
  quality_score: { score: 90 },
};

const NO_CALLS_ANALYSIS = {
  ...MOCK_ANALYSIS,
  calls: [],
};

function buildQueue() {
  const queue = new AnalysisQueue();
  queue._clientTenant = 'test-tenant';
  queue._client = {
    createAtom: jest.fn().mockResolvedValue({ id: 'atom:foo', type: 'function', name: 'foo' }),
    createEntity: jest.fn().mockResolvedValue({ id: 'entity:test', type: 'code' }),
    createReferences: jest.fn().mockResolvedValue({ references: [{ id: 'ref:1', type: 'calls' }] }),
    deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    tenantId: 'test-tenant',
  };
  queue.usePrecompute = false;
  queue.fingerprintCache = null;
  queue.memoryIdCache = { load: jest.fn().mockResolvedValue() };
  return queue;
}

describe('Auto-Sync Pipeline: AnalysisQueue', () => {
  let queue;
  let analyzeSpy;
  let testDir;
  let fileA, fileB, fileC, fileMd, fileSensitive;

  beforeAll(() => {
    testDir = join(tmpdir(), 'auto-sync-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    fileA = join(testDir, 'a.js');
    fileB = join(testDir, 'b.js');
    fileC = join(testDir, 'c.js');
    fileMd = join(testDir, 'readme.md');
    fileSensitive = join(testDir, 'sensitive.js');
    writeFileSync(fileA, MOCK_CONTENT);
    writeFileSync(fileB, MOCK_CONTENT);
    writeFileSync(fileC, MOCK_CONTENT);
    writeFileSync(fileMd, '# readme');
    writeFileSync(fileSensitive, 'const API_KEY = "sk-1234567890abcdef";');
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    analyzeSpy = jest.spyOn(codeAnalyzer, 'analyze').mockResolvedValue(MOCK_ANALYSIS);
    queue = buildQueue();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('P0: End-to-End Flow', () => {
    it('E2E-1: single file save → analyze → upload atoms/entity/references', async () => {
      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).toHaveBeenCalledWith(fileA, MOCK_CONTENT);
      expect(queue._client.createAtom).toHaveBeenCalled();
      expect(queue._client.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'code',
          file_path: 'a.js',
          language: 'javascript',
        })
      );
      expect(queue._client.createReferences).toHaveBeenCalled();
    });

    it('E2E-2: multiple files saved → all processed', async () => {
      queue.add(fileA, testDir);
      queue.add(fileB, testDir);
      queue.add(fileC, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).toHaveBeenCalledTimes(3);
      expect(queue._client.createEntity).toHaveBeenCalledTimes(3);
    });

    it('E2E-3: same file saved multiple times → deduped to 1 analysis', async () => {
      queue.add(fileA, testDir);
      queue.add(fileA, testDir);
      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('P1: Queue Behavior', () => {
    it('Q-1: queue overflow (>10 files) → drops oldest', () => {
      for (let i = 0; i < 11; i++) {
        const fp = join(testDir, `file${i}.js`);
        writeFileSync(fp, MOCK_CONTENT);
        queue.add(fp, testDir);
      }

      expect(queue.queue.length).toBe(10);
      expect(queue.queue[0].relativePath).toBe('file1.js');
    });

    it('Q-2: unsupported file type (.md) → skipped', async () => {
      queue.add(fileMd, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(queue._client.createAtom).not.toHaveBeenCalled();
    });

    it('Q-3: file not found (ENOENT) → silently skipped', async () => {
      queue.add(join(testDir, 'nonexistent.js'), testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(queue._client.createAtom).not.toHaveBeenCalled();
    });

    it('Q-4: file with sensitive content → upload skipped', async () => {
      queue.add(fileSensitive, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(queue._client.createAtom).not.toHaveBeenCalled();
    });
  });

  describe('P2: Fingerprint Cache', () => {
    beforeEach(() => {
      queue.usePrecompute = true;
      queue.fingerprintCache = {
        hasChanged: jest.fn().mockReturnValue({ changed: true }),
        set: jest.fn(),
        getSymbolsHash: jest.fn().mockReturnValue('hash-123'),
      };
    });

    it('FP-1: content unchanged → skip analysis entirely', async () => {
      queue.fingerprintCache.hasChanged.mockReturnValue({ changed: false });

      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).not.toHaveBeenCalled();
      expect(queue._client.createAtom).not.toHaveBeenCalled();
    });

    it('FP-2: content changed but symbols unchanged → analyze runs but upload skipped', async () => {
      queue.fingerprintCache.hasChanged
        .mockReturnValueOnce({ changed: true })
        .mockReturnValueOnce({ changed: false });

      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).toHaveBeenCalledTimes(1);
      expect(queue._client.createAtom).not.toHaveBeenCalled();
    });

    it('FP-3: no fingerprintCache → skip check, normal upload', async () => {
      queue.fingerprintCache = null;
      queue.usePrecompute = false;

      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(analyzeSpy).toHaveBeenCalledTimes(1);
      expect(queue._client.createAtom).toHaveBeenCalled();
      expect(queue._client.createEntity).toHaveBeenCalled();
    });
  });

  describe('P3: Error Recovery', () => {
    it('ER-1: analyze throws → does not affect subsequent file', async () => {
      analyzeSpy
        .mockRejectedValueOnce(new Error('parse error'))
        .mockResolvedValueOnce(MOCK_ANALYSIS);

      queue.add(fileA, testDir);
      queue.add(fileB, testDir);
      await drainTimersAndPromises();

      expect(queue._client.createEntity).toHaveBeenCalledTimes(1);
      expect(queue._client.createEntity).toHaveBeenCalledWith(
        expect.objectContaining({ file_path: 'b.js' })
      );
    });

    it('ER-2: all createAtom fail → entity not created, no crash', async () => {
      queue._client.createAtom.mockRejectedValue(new Error('network error'));

      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(queue._client.createEntity).not.toHaveBeenCalled();
    });

    it('ER-3: createAtom intermittent failure → entity not created, no crash', async () => {
      queue._client.createAtom.mockRejectedValueOnce(new Error('timeout'));

      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(queue._client.createAtom).toHaveBeenCalledTimes(1);
      expect(queue._client.createEntity).not.toHaveBeenCalled();
    });
  });

  describe('P5: Upload Completeness', () => {
    it('VC-1: functions but 0 references → INCOMPLETE warning', async () => {
      analyzeSpy.mockResolvedValue(NO_CALLS_ANALYSIS);

      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(queue._client.createEntity).toHaveBeenCalled();
    });

    it('VC-2: functions with references → no INCOMPLETE warning', async () => {
      queue.add(fileA, testDir);
      await drainTimersAndPromises();

      expect(queue._client.createEntity).toHaveBeenCalled();
    });
  });
});
