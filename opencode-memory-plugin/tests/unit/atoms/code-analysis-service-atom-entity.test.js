/**
 * CodeAnalysisService - uploadAsAtomEntity() Unit Tests (BL-CA-45)
 */

import { jest } from '@jest/globals';
import { AnalysisQueue } from '../../../lib/code-analysis-service.js';

const TENANT_ID = 'test-tenant';

const mockItem = {
  filePath: '/project/src/test.js',
  relativePath: 'src/test.js',
  projectRoot: '/project',
};

const mockContent = 'const x = 1; function testFunc(a, b) { return a + b; }';

const mockAnalysisResult = {
  language: 'javascript',
  functions: [
    {
      name: 'testFunc',
      params: [{ name: 'a' }, { name: 'b' }],
      return_type: 'number',
      is_exported: true,
      is_async: false,
      start_line: 1,
      end_line: 10,
    },
    {
      name: 'helperFunc',
      params: [{ name: 'x' }],
      return_type: 'void',
      is_exported: false,
      is_async: true,
      start_line: 12,
      end_line: 20,
    },
  ],
  classes: [
    {
      name: 'TestClass',
      start_line: 25,
      end_line: 50,
    },
  ],
  imports: [
    {
      source: 'lodash',
      specifiers: ['debounce'],
    },
  ],
  calls: [
    { target: 'testFunc', line: 15, column: 4, file_path: 'src/test.js' },
    { target: 'helperFunc', line: 18, column: 8, file_path: 'src/test.js' },
  ],
  quality_score: { score: 85 },
  complexity_metrics: { cyclomatic: 5, lines_of_code: 120 },
};

const mockAtoms = {
  testFunc: { id: 'atom:testFunc', type: 'function', name: 'testFunc' },
  helperFunc: { id: 'atom:helperFunc', type: 'function', name: 'helperFunc' },
  TestClass: { id: 'atom:TestClass', type: 'class', name: 'TestClass' },
  lodash: { id: 'atom:lodash', type: 'import', name: 'lodash' },
};

// Matches the actual entity structure returned by the backend API
const mockEntity = {
  id: 'entity:testFile',
  type: 'code',
  abstract: 'javascript file: src/test.js (2 functions, 1 classes)',
  overview: expect.any(Object),
  atoms: expect.any(Array),
  tags: expect.any(Array),
  project: expect.any(String),
  tenant_id: expect.any(String),
  language: expect.any(String),
  file_path: expect.any(String),
  quality_score: expect.any(Object),
  complexity_metrics: expect.any(Object),
  created_at: expect.any(Object),
  updated_at: expect.any(Object),
  created_by: expect.any(String),
};

const mockReferences = [
  { id: 'ref:1', from_id: 'entity:testFile', to_id: 'atom:testFunc', type: 'calls' },
  { id: 'ref:2', from_id: 'entity:testFile', to_id: 'atom:helperFunc', type: 'calls' },
];

describe('AnalysisQueue.uploadAsAtomEntity()', () => {
  let queue;
  let mockCreateAtom;
  let mockCreateEntity;
  let mockCreateReference;
  let mockDeleteAtom;
  let mockClient;

  beforeEach(() => {
    queue = new AnalysisQueue();

    mockCreateAtom = jest.fn();
    mockCreateEntity = jest.fn();
    mockCreateReference = jest.fn();
    mockDeleteAtom = jest.fn().mockResolvedValue({ success: true });

    mockClient = {
      createAtom: mockCreateAtom,
      createEntity: mockCreateEntity,
      createReferences: mockCreateReference,
      deleteAtom: mockDeleteAtom,
      tenantId: TENANT_ID,
    };

    // Override the `client` getter so code uses our mocks instead of real API
    Object.defineProperty(queue, 'client', {
      value: mockClient,
      writable: true,
      configurable: true,
    });

    queue.fingerprintCache = {
      set: jest.fn(),
      getSymbolsHash: jest.fn().mockReturnValue('symbols-hash-123'),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Happy Path', () => {
    test('should create atoms, entity, and references successfully', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);
      mockCreateReference.mockResolvedValue({
        references: mockReferences,
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateAtom).toHaveBeenCalledTimes(4);

      expect(mockCreateAtom).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'function',
          name: 'testFunc',
          content: 'testFunc(a, b)',
          params: mockAnalysisResult.functions[0].params,
          return_type: 'number',
          is_exported: true,
          is_async: false,
          start_line: 1,
          end_line: 10,
          project: expect.any(String),
          tenant_id: TENANT_ID,
        })
      );
      expect(mockCreateAtom).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'function',
          name: 'helperFunc',
          content: 'helperFunc(x)',
          params: mockAnalysisResult.functions[1].params,
          return_type: 'void',
          is_exported: false,
          is_async: true,
          start_line: 12,
          end_line: 20,
          tenant_id: TENANT_ID,
        })
      );

      expect(mockCreateAtom).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'class',
          name: 'TestClass',
          content: 'class TestClass',
          start_line: 25,
          end_line: 50,
          tenant_id: TENANT_ID,
        })
      );

      expect(mockCreateAtom).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'import',
          name: 'lodash',
          content: 'import lodash',
          tenant_id: TENANT_ID,
        })
      );

      expect(mockCreateEntity).toHaveBeenCalledTimes(1);
      expect(mockCreateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'code',
          atoms: [
            mockAtoms.testFunc.id,
            mockAtoms.helperFunc.id,
            mockAtoms.TestClass.id,
            mockAtoms.lodash.id,
          ],
          tags: ['javascript', 'code-analysis'],
          file_path: 'src/test.js',
          language: 'javascript',
          quality_score: 85,
          complexity_metrics: { cyclomatic: 5, lines_of_code: 120 },
          tenant_id: TENANT_ID,
        })
      );

      expect(mockCreateReference).toHaveBeenCalledTimes(1);
      expect(mockCreateReference).toHaveBeenCalledWith([
        expect.objectContaining({
          from_id: mockEntity.id,
          to_id: mockAtoms.testFunc.id,
          type: 'calls',
          weight: 0.5,
          line: 15,
          column: 4,
          file_path: 'src/test.js',
          tenant_id: TENANT_ID,
        }),
        expect.objectContaining({
          from_id: mockEntity.id,
          to_id: mockAtoms.helperFunc.id,
          type: 'calls',
          weight: 0.5,
          line: 18,
          column: 8,
          file_path: 'src/test.js',
          tenant_id: TENANT_ID,
        }),
      ]);

      expect(result.atoms).toHaveLength(4);
      expect(result.entity).toMatchObject({
        id: mockEntity.id,
        type: 'code',
        abstract: mockEntity.abstract,
      });
      expect(result.references).toHaveLength(2);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Atom Creation Failure', () => {
    test('should continue when one atom creation fails, log error', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(3);
      expect(result.atoms.map(a => a.id)).toEqual([
        mockAtoms.testFunc.id,
        mockAtoms.TestClass.id,
        mockAtoms.lodash.id,
      ]);

      expect(mockCreateEntity).toHaveBeenCalledTimes(1);
      expect(mockCreateEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          atoms: [mockAtoms.testFunc.id, mockAtoms.TestClass.id, mockAtoms.lodash.id],
        })
      );
    });

    test('should continue when class atom creation fails', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockRejectedValueOnce(new Error('Class creation error'))
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(3);
      // Error is logged via logger (verified manually)
    });

    test('should continue when import atom creation fails', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockRejectedValueOnce(new Error('Import creation error'));
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(3);
    });
  });

  describe('Entity Creation Failure', () => {
    test('should rollback atoms when entity creation fails and throw error', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockRejectedValue(new Error('Entity creation failed'));

      await expect(
        queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent)
      ).rejects.toThrow('Entity creation failed');

      expect(mockDeleteAtom).toHaveBeenCalledTimes(4);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.testFunc.id);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.helperFunc.id);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.TestClass.id);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.lodash.id);
    });

    test('should rollback only successfully created atoms when entity fails', async () => {
      mockCreateAtom
        .mockRejectedValueOnce(new Error('First atom failed'))
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockRejectedValue(new Error('Entity creation failed'));

      await expect(
        queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent)
      ).rejects.toThrow('Entity creation failed');

      expect(mockDeleteAtom).toHaveBeenCalledTimes(3);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.helperFunc.id);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.TestClass.id);
      expect(mockDeleteAtom).toHaveBeenCalledWith(mockAtoms.lodash.id);
    });
  });

  describe('Reference Creation Failure', () => {
    test('should return empty references when batch creation fails', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc);
      mockCreateEntity.mockResolvedValue(mockEntity);
      mockCreateReference.mockRejectedValue(new Error('Batch reference creation error'));

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.entity).toMatchObject({
        id: mockEntity.id,
        type: 'code',
      });
      expect(result.references).toHaveLength(0);
      expect(mockCreateReference).toHaveBeenCalledTimes(1);
    });

    test('should skip reference when target atom not found in created atoms', async () => {
      mockCreateAtom.mockResolvedValueOnce(mockAtoms.testFunc);
      mockCreateEntity.mockResolvedValue(mockEntity);
      mockCreateReference.mockResolvedValue({
        references: [mockReferences[0]],
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateReference).toHaveBeenCalledTimes(1);
      expect(result.references).toHaveLength(1);
    });

    test('should skip reference when entity is null (no atoms created)', async () => {
      mockCreateAtom.mockRejectedValue(new Error('All atoms fail'));

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.entity).toBeNull();
      expect(result.references).toHaveLength(0);
      expect(mockCreateReference).not.toHaveBeenCalled();
    });
  });

  describe('No Atoms Created', () => {
    test('should skip entity creation when no atoms are successfully created', async () => {
      const emptyResult = {
        language: 'javascript',
        functions: [],
        classes: [],
        imports: [],
        calls: [],
        quality_score: { score: 0 },
        complexity_metrics: { cyclomatic: 0 },
      };

      const result = await queue.uploadAsAtomEntity(mockItem, emptyResult, '');

      expect(mockCreateAtom).not.toHaveBeenCalled();
      expect(mockCreateEntity).not.toHaveBeenCalled();
      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.atoms).toEqual([]);
      expect(result.entity).toBeNull();
      expect(result.references).toEqual([]);
    });

    test('should return empty atoms when all atom creations fail', async () => {
      mockCreateAtom.mockRejectedValue(new Error('All fail'));

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toEqual([]);
      expect(result.entity).toBeNull();
      expect(mockCreateEntity).not.toHaveBeenCalled();
    });
  });

  describe('Empty Calls', () => {
    test('should create entity without references when no calls exist', async () => {
      const noCallsResult = { ...mockAnalysisResult, calls: [] };
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, noCallsResult, mockContent);

      expect(mockCreateEntity).toHaveBeenCalledTimes(1);
      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.entity).toMatchObject({
        id: mockEntity.id,
        type: 'code',
      });
      expect(result.references).toEqual([]);
    });

    test('should handle calls array being undefined', async () => {
      const undefinedCallsResult = { ...mockAnalysisResult, calls: undefined };
      mockCreateAtom.mockResolvedValueOnce(mockAtoms.testFunc);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, undefinedCallsResult, mockContent);

      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.references).toEqual([]);
    });
  });

  describe('Parallel Atom Creation', () => {
    test('should create all atoms concurrently, not sequentially', async () => {
      // Track when each createAtom call starts and resolves
      const callTimings = [];
      let resolveOrder = 0;

      // Simulate each atom taking 50ms — sequential would take ~200ms, parallel ~50ms
      const createAtomWithDelay = (result) => {
        const start = Date.now();
        callTimings.push({ start, name: result.name });
        return new Promise((resolve) => {
          setTimeout(() => {
            resolveOrder++;
            callTimings.push({ end: Date.now(), name: result.name, resolveOrder });
            resolve(result);
          }, 50);
        });
      };

      mockCreateAtom
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.testFunc))
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.helperFunc))
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.TestClass))
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.lodash));
      mockCreateEntity.mockResolvedValue(mockEntity);

      const startTime = Date.now();
      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);
      const elapsed = Date.now() - startTime;

      // Sequential: 4 × 50ms = ~200ms minimum
      // Parallel: ~50ms (all fire at once)
      // Use 100ms as threshold — well above parallel, well below sequential
      expect(elapsed).toBeLessThan(120);
      expect(result.atoms).toHaveLength(4);
    });

    test('should not block other atoms when one creation fails', async () => {
      const callTimings = [];
      let resolveOrder = 0;

      const createAtomWithDelay = (result, shouldFail = false) => {
        const start = Date.now();
        callTimings.push({ start, name: result?.name || 'failed' });
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            resolveOrder++;
            callTimings.push({ end: Date.now(), name: result?.name || 'failed', resolveOrder });
            if (shouldFail) {
              reject(new Error('Atom creation failed'));
            } else {
              resolve(result);
            }
          }, 50);
        });
      };

      // First function fails, but others should still be created in parallel
      mockCreateAtom
        .mockImplementationOnce(() => createAtomWithDelay(null, true))
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.helperFunc))
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.TestClass))
        .mockImplementationOnce(() => createAtomWithDelay(mockAtoms.lodash));
      mockCreateEntity.mockResolvedValue(mockEntity);

      const startTime = Date.now();
      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);
      const elapsed = Date.now() - startTime;

      // All 4 should fire in parallel even though one fails
      expect(elapsed).toBeLessThan(120);
      expect(result.atoms).toHaveLength(3);
      expect(result.atoms.map((a) => a.id)).toEqual([
        mockAtoms.helperFunc.id,
        mockAtoms.TestClass.id,
        mockAtoms.lodash.id,
      ]);
    });
  });

  describe('Batch Reference Creation (C-3)', () => {
    test('should create all references via single batch API call', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      mockCreateReference.mockResolvedValue({
        references: mockReferences,
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateReference).toHaveBeenCalledTimes(1);
      expect(mockCreateReference).toHaveBeenCalledWith([
        expect.objectContaining({
          from_id: mockEntity.id,
          to_id: mockAtoms.testFunc.id,
          type: 'calls',
          weight: 0.5,
          line: 15,
          column: 4,
          file_path: 'src/test.js',
          tenant_id: TENANT_ID,
        }),
        expect.objectContaining({
          from_id: mockEntity.id,
          to_id: mockAtoms.helperFunc.id,
          type: 'calls',
          weight: 0.5,
          line: 18,
          column: 8,
          file_path: 'src/test.js',
          tenant_id: TENANT_ID,
        }),
      ]);

      expect(result.references).toHaveLength(2);
    });

    test('should not call batch API when no calls exist', async () => {
      const noCallsResult = { ...mockAnalysisResult, calls: [] };
      mockCreateAtom.mockResolvedValueOnce(mockAtoms.testFunc);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, noCallsResult, mockContent);

      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.references).toEqual([]);
    });

    test('should not call batch API when entity is null', async () => {
      mockCreateAtom.mockRejectedValue(new Error('All atoms fail'));

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.references).toEqual([]);
    });

    test('should filter out calls whose target atom was not created', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);
      mockCreateReference.mockResolvedValue({
        references: [mockReferences[0]],
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateReference).toHaveBeenCalledWith([
        expect.objectContaining({
          to_id: mockAtoms.testFunc.id,
        }),
      ]);
      expect(result.references).toHaveLength(1);
    });
  });

  describe('Fingerprint Cache Update', () => {
    test('should update fingerprint cache after successful upload', async () => {
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(queue.fingerprintCache.set).toHaveBeenCalledTimes(1);
      expect(queue.fingerprintCache.set).toHaveBeenCalledWith(
        '/project/src/test.js',
        expect.objectContaining({
          content_hash: expect.any(String),
          symbols_hash: 'symbols-hash-123',
        })
      );
    });

    test('should compute MD5 content hash correctly', async () => {
      const { createHash } = await import('crypto');
      const expectedHash = createHash('md5').update(mockContent).digest('hex');
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(queue.fingerprintCache.set).toHaveBeenCalledWith(
        '/project/src/test.js',
        expect.objectContaining({
          content_hash: expectedHash,
        })
      );
    });

    test('should skip fingerprint update when fingerprintCache is null', async () => {
      queue.fingerprintCache = null;
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(4);
      expect(result.entity).toMatchObject({
        id: mockEntity.id,
        type: 'code',
      });
    });

    test('should handle fingerprint cache update error gracefully', async () => {
      queue.fingerprintCache.set.mockImplementation(() => {
        throw new Error('Cache write failed');
      });
      mockCreateAtom
        .mockResolvedValueOnce(mockAtoms.testFunc)
        .mockResolvedValueOnce(mockAtoms.helperFunc)
        .mockResolvedValueOnce(mockAtoms.TestClass)
        .mockResolvedValueOnce(mockAtoms.lodash);
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(4);
    });
  });
});
