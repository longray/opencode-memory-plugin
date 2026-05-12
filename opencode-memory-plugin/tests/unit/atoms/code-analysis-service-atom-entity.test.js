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
  let mockBatchCreateAtoms;
  let mockClient;

  beforeEach(() => {
    queue = new AnalysisQueue();

    mockCreateAtom = jest.fn();
    mockCreateEntity = jest.fn();
    mockCreateReference = jest.fn();
    mockDeleteAtom = jest.fn().mockResolvedValue({ success: true });
    mockBatchCreateAtoms = jest.fn();

    mockClient = {
      createAtom: mockCreateAtom,
      createEntity: mockCreateEntity,
      createReferences: mockCreateReference,
      deleteAtom: mockDeleteAtom,
      batchCreateAtoms: mockBatchCreateAtoms,
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);
      mockCreateReference.mockResolvedValue({
        references: mockReferences,
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockBatchCreateAtoms).toHaveBeenCalledTimes(1);
      expect(mockBatchCreateAtoms).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'function', name: 'testFunc' }),
          expect.objectContaining({ type: 'function', name: 'helperFunc' }),
          expect.objectContaining({ type: 'class', name: 'TestClass' }),
          expect.objectContaining({ type: 'import', name: 'lodash' }),
        ])
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          {
            id: null,
            type: 'function',
            name: 'helperFunc',
            status: 'error',
            error: 'Network timeout',
          },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 3,
        skipped: 0,
        errors: 1,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          {
            id: null,
            type: 'class',
            name: 'TestClass',
            status: 'error',
            error: 'Class creation error',
          },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 3,
        skipped: 0,
        errors: 1,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(3);
    });

    test('should continue when import atom creation fails', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          {
            id: null,
            type: 'import',
            name: 'lodash',
            status: 'error',
            error: 'Import creation error',
          },
        ],
        total: 4,
        created: 3,
        skipped: 0,
        errors: 1,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(3);
    });
  });

  describe('Entity Creation Failure', () => {
    test('should rollback atoms when entity creation fails and throw error', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          {
            id: null,
            type: 'function',
            name: 'testFunc',
            status: 'error',
            error: 'First atom failed',
          },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 3,
        skipped: 0,
        errors: 1,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
        ],
        total: 2,
        created: 2,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [{ ...mockAtoms.testFunc, status: 'created', error: null }],
        total: 1,
        created: 1,
        skipped: 0,
        errors: 0,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);
      mockCreateReference.mockResolvedValue({
        references: [mockReferences[0]],
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateReference).toHaveBeenCalledTimes(1);
      expect(result.references).toHaveLength(1);
    });

    test('should skip reference when entity is null (no atoms created)', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          {
            id: null,
            type: 'function',
            name: 'testFunc',
            status: 'error',
            error: 'All atoms fail',
          },
          {
            id: null,
            type: 'function',
            name: 'helperFunc',
            status: 'error',
            error: 'All atoms fail',
          },
          { id: null, type: 'class', name: 'TestClass', status: 'error', error: 'All atoms fail' },
          { id: null, type: 'import', name: 'lodash', status: 'error', error: 'All atoms fail' },
        ],
        total: 4,
        created: 0,
        skipped: 0,
        errors: 4,
      });

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

      expect(mockBatchCreateAtoms).not.toHaveBeenCalled();
      expect(mockCreateEntity).not.toHaveBeenCalled();
      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.atoms).toEqual([]);
      expect(result.entity).toBeNull();
      expect(result.references).toEqual([]);
    });

    test('should return empty atoms when all atom creations fail', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { id: null, type: 'function', name: 'testFunc', status: 'error', error: 'All fail' },
          { id: null, type: 'function', name: 'helperFunc', status: 'error', error: 'All fail' },
          { id: null, type: 'class', name: 'TestClass', status: 'error', error: 'All fail' },
          { id: null, type: 'import', name: 'lodash', status: 'error', error: 'All fail' },
        ],
        total: 4,
        created: 0,
        skipped: 0,
        errors: 4,
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toEqual([]);
      expect(result.entity).toBeNull();
      expect(mockCreateEntity).not.toHaveBeenCalled();
    });
  });

  describe('Empty Calls', () => {
    test('should create entity without references when no calls exist', async () => {
      const noCallsResult = { ...mockAnalysisResult, calls: [] };
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
        ],
        total: 2,
        created: 2,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [{ ...mockAtoms.testFunc, status: 'created', error: null }],
        total: 1,
        created: 1,
        skipped: 0,
        errors: 0,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, undefinedCallsResult, mockContent);

      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.references).toEqual([]);
    });
  });

  describe('Parallel Atom Creation', () => {
    test('should create all atoms concurrently, not sequentially', async () => {
      mockBatchCreateAtoms.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          atoms: [
            { ...mockAtoms.testFunc, status: 'created', error: null },
            { ...mockAtoms.helperFunc, status: 'created', error: null },
            { ...mockAtoms.TestClass, status: 'created', error: null },
            { ...mockAtoms.lodash, status: 'created', error: null },
          ],
          total: 4,
          created: 4,
          skipped: 0,
          errors: 0,
        };
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const startTime = Date.now();
      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(120);
      expect(result.atoms).toHaveLength(4);
    });

    test('should not block other atoms when one creation fails', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          {
            id: null,
            type: 'function',
            name: 'testFunc',
            status: 'error',
            error: 'Atom creation failed',
          },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 3,
        skipped: 0,
        errors: 1,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const startTime = Date.now();
      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(120);
      expect(result.atoms).toHaveLength(3);
      expect(result.atoms.map(a => a.id)).toEqual([
        mockAtoms.helperFunc.id,
        mockAtoms.TestClass.id,
        mockAtoms.lodash.id,
      ]);
    });
  });

  describe('Batch Reference Creation (C-3)', () => {
    test('should create all references via single batch API call', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [{ ...mockAtoms.testFunc, status: 'created', error: null }],
        total: 1,
        created: 1,
        skipped: 0,
        errors: 0,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, noCallsResult, mockContent);

      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.references).toEqual([]);
    });

    test('should not call batch API when entity is null', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          {
            id: null,
            type: 'function',
            name: 'testFunc',
            status: 'error',
            error: 'All atoms fail',
          },
          {
            id: null,
            type: 'function',
            name: 'helperFunc',
            status: 'error',
            error: 'All atoms fail',
          },
          { id: null, type: 'class', name: 'TestClass', status: 'error', error: 'All atoms fail' },
          { id: null, type: 'import', name: 'lodash', status: 'error', error: 'All atoms fail' },
        ],
        total: 4,
        created: 0,
        skipped: 0,
        errors: 4,
      });

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(mockCreateReference).not.toHaveBeenCalled();
      expect(result.references).toEqual([]);
    });

    test('should filter out calls whose target atom was not created', async () => {
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          {
            id: null,
            type: 'function',
            name: 'helperFunc',
            status: 'error',
            error: 'helperFunc failed',
          },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 3,
        skipped: 0,
        errors: 1,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
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
      mockBatchCreateAtoms.mockResolvedValue({
        atoms: [
          { ...mockAtoms.testFunc, status: 'created', error: null },
          { ...mockAtoms.helperFunc, status: 'created', error: null },
          { ...mockAtoms.TestClass, status: 'created', error: null },
          { ...mockAtoms.lodash, status: 'created', error: null },
        ],
        total: 4,
        created: 4,
        skipped: 0,
        errors: 0,
      });
      mockCreateEntity.mockResolvedValue(mockEntity);

      const result = await queue.uploadAsAtomEntity(mockItem, mockAnalysisResult, mockContent);

      expect(result.atoms).toHaveLength(4);
    });
  });
});
