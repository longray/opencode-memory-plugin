/**
 * WrapperClient Atom/Entity/Reference API Tests (BL-CA-40)
 */

import { jest } from '@jest/globals';
import { WrapperClient, WrapperError } from '../lib/wrapper-client.js';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WrapperClient Atom/Entity/Reference API', () => {
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

  describe('Atom API', () => {
    test('createAtom should create a new atom', async () => {
      const mockResponse = {
        id: 'atom:test123',
        type: 'function',
        name: 'testFunc',
        content: 'function testFunc() {}',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.createAtom({
        type: 'function',
        name: 'testFunc',
        content: 'function testFunc() {}',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18008/api/v1/atoms',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('function'),
        })
      );
    });

    test('createAtom should convert docstring string to object format (BL-CA-48)', async () => {
      const mockResponse = {
        id: 'atom:test123',
        type: 'function',
        name: 'testFunc',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.createAtom({
        type: 'function',
        name: 'testFunc',
        content: 'function testFunc() {}',
        docstring: 'This is a test function',
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.docstring).toEqual({ text: 'This is a test function' });
    });

    test('createAtom should preserve docstring object format (BL-CA-48)', async () => {
      const mockResponse = {
        id: 'atom:test123',
        type: 'function',
        name: 'testFunc',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.createAtom({
        type: 'function',
        name: 'testFunc',
        content: 'function testFunc() {}',
        docstring: { text: 'This is a test', author: 'developer' },
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.docstring).toEqual({ text: 'This is a test', author: 'developer' });
    });

    test('getAtom should retrieve an atom by ID', async () => {
      const mockResponse = {
        id: 'atom:test123',
        type: 'function',
        name: 'testFunc',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getAtom('atom:test123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/atoms/atom:test123'),
        expect.any(Object)
      );
    });

    test('listAtoms should list atoms with filters', async () => {
      const mockResponse = {
        atoms: [
          { id: 'atom:1', type: 'function', name: 'func1' },
          { id: 'atom:2', type: 'class', name: 'Class1' },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.listAtoms({ type: 'function', limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=function'),
        expect.any(Object)
      );
    });

    test('updateAtom should update an atom', async () => {
      const mockResponse = {
        id: 'atom:test123',
        name: 'updatedFunc',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.updateAtom('atom:test123', { name: 'updatedFunc' });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18008/api/v1/atoms/atom:test123',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    test('deleteAtom should delete an atom', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await client.deleteAtom('atom:test123');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/atoms/atom:test123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Entity API', () => {
    test('createEntity should create a new entity', async () => {
      const mockResponse = {
        id: 'entity:test456',
        type: 'code',
        abstract: 'Test entity',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.createEntity({
        type: 'code',
        abstract: 'Test entity',
        overview: 'Overview text',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18008/api/v1/entities',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    test('createEntity should convert overview string to object format (BL-CA-48)', async () => {
      const mockResponse = {
        id: 'entity:test456',
        type: 'code',
        abstract: 'Test entity',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.createEntity({
        type: 'code',
        abstract: 'Test entity',
        overview: 'Overview text',
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.overview).toEqual({ text: 'Overview text' });
    });

    test('createEntity should convert quality_score number to object format (BL-CA-48)', async () => {
      const mockResponse = {
        id: 'entity:test456',
        type: 'code',
        abstract: 'Test entity',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.createEntity({
        type: 'code',
        abstract: 'Test entity',
        quality_score: 85,
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.quality_score).toEqual({ score: 85 });
    });

    test('createEntity should preserve overview and quality_score object format (BL-CA-48)', async () => {
      const mockResponse = {
        id: 'entity:test456',
        type: 'code',
        abstract: 'Test entity',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await client.createEntity({
        type: 'code',
        abstract: 'Test entity',
        overview: { text: 'Overview', language: 'zh' },
        quality_score: { score: 85, complexity: 5 },
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.overview).toEqual({ text: 'Overview', language: 'zh' });
      expect(requestBody.quality_score).toEqual({ score: 85, complexity: 5 });
    });

    test('getEntity should retrieve an entity by ID', async () => {
      const mockResponse = {
        id: 'entity:test456',
        type: 'code',
        abstract: 'Test entity',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getEntity('entity:test456', 2);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/entities/entity:test456'),
        expect.any(Object)
      );
    });

    test('listEntities should list entities with filters', async () => {
      const mockResponse = {
        entities: [
          { id: 'entity:1', type: 'code', abstract: 'Entity 1' },
          { id: 'entity:2', type: 'wiki', abstract: 'Entity 2' },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.listEntities({ type: 'code', limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=code'),
        expect.any(Object)
      );
    });
  });

  describe('Reference API', () => {
    test('createReference should create a new reference', async () => {
      const mockResponse = {
        id: 'ref:test789',
        from_id: 'atom:1',
        to_id: 'atom:2',
        type: 'calls',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.createReference({
        from_id: 'atom:1',
        to_id: 'atom:2',
        type: 'calls',
        weight: 0.8,
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18008/api/v1/references',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    test('queryReferences should query references with filters', async () => {
      const mockResponse = {
        references: [{ id: 'ref:1', from_id: 'atom:1', to_id: 'atom:2', type: 'calls' }],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.queryReferences({ from_id: 'atom:1', type: 'calls' });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('from_id=atom%3A1'),
        expect.any(Object)
      );
    });

    test('deleteReference should delete a reference', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const result = await client.deleteReference('ref:test789');

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/references/ref:test789'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 error for non-existent atom', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Atom not found',
      });

      await expect(client.getAtom('atom:nonexistent')).rejects.toThrow(WrapperError);
    });

    test('should handle 500 error with retry', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'Internal server error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'atom:test', type: 'function' }),
        });

      const result = await client.getAtom('atom:test');
      expect(result).toEqual({ id: 'atom:test', type: 'function' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Backward Compatibility', () => {
    test('uploadMemory should still work', async () => {
      const mockResponse = {
        total: 1,
        success: 1,
        failed: 0,
        memory_ids: ['mem:test123'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.uploadMemory({
        content: 'Test memory',
        abstract: 'Test',
        type: 'general',
      });

      expect(result).toEqual({ id: 'mem:test123', success: true });
    });

    test('createRelation should still work', async () => {
      const mockResponse = {
        id: 'rel:test',
        from_id: 'mem:1',
        to_id: 'mem:2',
        type: 'related',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.createRelation({
        from_id: 'mem:1',
        to_id: 'mem:2',
        type: 'related',
      });

      expect(result).toEqual(mockResponse);
    });
  });
});
