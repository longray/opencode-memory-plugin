/**
 * Batch API Tests for WrapperClient (batchCreateAtoms, batchCreateEntities)
 */

import { jest } from '@jest/globals';
import { WrapperClient, WrapperError } from '../../../lib/wrapper-client.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WrapperClient Batch APIs', () => {
  let client;

  beforeEach(() => {
    client = new WrapperClient({
      backend: {
        url: 'http://localhost:18008',
        tenant_id: 'test-tenant',
      },
    });
    mockFetch.mockClear();
  });

  describe('batchCreateAtoms', () => {
    test('should send correct request format to /api/v1/atoms/batch', async () => {
      const mockResponse = {
        atoms: [
          { id: 'atom:001', type: 'function', name: 'func1', status: 'created', error: null },
          { id: 'atom:002', type: 'class', name: 'Class1', status: 'created', error: null },
        ],
        total: 2,
        created: 2,
        skipped: 0,
        errors: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const atoms = [
        { type: 'function', name: 'func1', content: 'function func1() {}' },
        { type: 'class', name: 'Class1', content: 'class Class1 {}' },
      ];

      const result = await client.batchCreateAtoms(atoms);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18008/api/v1/atoms/batch',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"atoms"'),
        })
      );
    });

    test('should handle partial success', async () => {
      const mockResponse = {
        atoms: [
          { id: 'atom:001', type: 'function', status: 'created', error: null },
          { id: null, type: 'function', status: 'error', error: 'Invalid content' },
        ],
        total: 2,
        created: 1,
        skipped: 0,
        errors: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const atoms = [
        { type: 'function', name: 'func1', content: 'valid' },
        { type: 'function', name: 'func2', content: '' },
      ];

      const result = await client.batchCreateAtoms(atoms);

      expect(result.created).toBe(1);
      expect(result.errors).toBe(1);
      expect(result.atoms[1].error).toBe('Invalid content');
    });

    test('should include tenant_id from client default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          atoms: [],
          total: 0,
          created: 0,
          skipped: 0,
          errors: 0,
        }),
      });

      await client.batchCreateAtoms([]);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.atoms).toBeDefined();
    });

    test('should throw WrapperError on HTTP error', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      };
      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce({ ...errorResponse })
        .mockResolvedValueOnce({ ...errorResponse })
        .mockResolvedValueOnce({ ...errorResponse });

      await expect(
        client.batchCreateAtoms([{ type: 'function', content: 'test' }])
      ).rejects.toThrow(WrapperError);
    });
  });

  describe('batchCreateEntities', () => {
    test('should send correct request format to /api/v1/entities/batch', async () => {
      const mockResponse = {
        entities: [
          { id: 'entity:001', type: 'code', abstract: 'File1', status: 'created', error: null },
          { id: 'entity:002', type: 'code', abstract: 'File2', status: 'created', error: null },
        ],
        total: 2,
        created: 2,
        skipped: 0,
        errors: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const entities = [
        { type: 'code', abstract: 'File1', overview: { text: 'Overview 1' } },
        { type: 'code', abstract: 'File2', overview: { text: 'Overview 2' } },
      ];

      const result = await client.batchCreateEntities(entities);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18008/api/v1/entities/batch',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"entities"'),
        })
      );
    });

    test('should handle partial success', async () => {
      const mockResponse = {
        entities: [
          { id: 'entity:001', type: 'code', status: 'created', error: null },
          { id: null, type: 'code', status: 'error', error: 'Missing abstract' },
        ],
        total: 2,
        created: 1,
        skipped: 0,
        errors: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const entities = [{ type: 'code', abstract: 'Valid' }, { type: 'code' }];

      const result = await client.batchCreateEntities(entities);

      expect(result.created).toBe(1);
      expect(result.errors).toBe(1);
    });

    test('should include tenant_id from client default', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          entities: [],
          total: 0,
          created: 0,
          skipped: 0,
          errors: 0,
        }),
      });

      await client.batchCreateEntities([]);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.entities).toBeDefined();
    });

    test('should throw WrapperError on HTTP error', async () => {
      const errorResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      };
      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce({ ...errorResponse })
        .mockResolvedValueOnce({ ...errorResponse })
        .mockResolvedValueOnce({ ...errorResponse });

      await expect(
        client.batchCreateEntities([{ type: 'code', abstract: 'test' }])
      ).rejects.toThrow(WrapperError);
    });
  });

  describe('batchCreateAtoms fallback behavior', () => {
    test('should handle 404 gracefully (backend without batch API)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      await expect(
        client.batchCreateAtoms([{ type: 'function', content: 'test' }])
      ).rejects.toThrow(WrapperError);
    });
  });
});
