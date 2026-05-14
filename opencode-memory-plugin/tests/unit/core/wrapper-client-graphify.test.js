import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WrapperClient } from '../../../lib/wrapper-client.js';

describe('WrapperClient graphify fields', () => {
  let client;
  let postSpy;
  let deleteSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new WrapperClient({ backend: { tenant_id: 'test' } });
    postSpy = jest.spyOn(client.http, 'post').mockResolvedValue({ id: 'test123' });
    deleteSpy = jest.spyOn(client.http, 'delete').mockResolvedValue({ deleted: 0 });
  });

  describe('createRelation with confidence', () => {
    it('should pass confidence and confidence_score to API', async () => {
      postSpy.mockResolvedValue({ id: 'reference:test123' });

      await client.createRelation({
        from_id: 'entity:a',
        to_id: 'entity:b',
        type: 'method',
        weight: 0.9,
        confidence: 'EXTRACTED',
        confidence_score: 1.0,
        tenant_id: 'test',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/memories/relations',
        expect.objectContaining({
          type: 'method',
          confidence: 'EXTRACTED',
          confidence_score: 1.0,
          weight: 0.9,
        })
      );
    });

    it('should work without confidence fields (backward compat)', async () => {
      postSpy.mockResolvedValue({ id: 'reference:test123' });

      await client.createRelation({
        from_id: 'entity:a',
        to_id: 'entity:b',
        type: 'calls',
        weight: 0.5,
        tenant_id: 'test',
      });

      const calledWith = postSpy.mock.calls[0][1];
      expect(calledWith).not.toHaveProperty('confidence');
      expect(calledWith).not.toHaveProperty('confidence_score');
    });
  });

  describe('createEntity with norm_label', () => {
    it('should pass norm_label to API', async () => {
      postSpy.mockResolvedValue({ id: 'entity:test123' });

      await client.createEntity({
        type: 'code',
        abstract: 'test entity',
        norm_label: 'testjs',
        tenant_id: 'test',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/entities',
        expect.objectContaining({
          norm_label: 'testjs',
        })
      );
    });

    it('should work without norm_label (backward compat)', async () => {
      postSpy.mockResolvedValue({ id: 'entity:test123' });

      await client.createEntity({
        type: 'code',
        abstract: 'test entity',
        tenant_id: 'test',
      });

      const calledWith = postSpy.mock.calls[0][1];
      expect(calledWith).not.toHaveProperty('norm_label');
    });
  });

  describe('batchCreateEntities with norm_label', () => {
    it('should pass norm_label in entity payload', async () => {
      postSpy.mockResolvedValue({ created: 1, skipped: 0, errors: 0, entities: [] });

      await client.batchCreateEntities([
        {
          type: 'code',
          abstract: 'test',
          file_path: 'test.js',
          norm_label: 'testjs',
          tenant_id: 'test',
        },
      ]);

      const calledWith = postSpy.mock.calls[0][1];
      expect(calledWith.entities[0]).toHaveProperty('norm_label', 'testjs');
    });
  });

  describe('createAtom with norm_label', () => {
    it('should pass norm_label to API', async () => {
      postSpy.mockResolvedValue({ id: 'atom:test123' });

      await client.createAtom({
        type: 'function',
        content: 'function test() {}',
        norm_label: 'testjs',
        tenant_id: 'test',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/atoms',
        expect.objectContaining({
          norm_label: 'testjs',
        })
      );
    });
  });

  describe('batchCreateAtoms with norm_label', () => {
    it('should pass norm_label in atom payload', async () => {
      postSpy.mockResolvedValue({ created: 1, skipped: 0, errors: 0 });

      await client.batchCreateAtoms([
        {
          type: 'function',
          content: 'function test() {}',
          norm_label: 'testjs',
          tenant_id: 'test',
        },
      ]);

      const calledWith = postSpy.mock.calls[0][1];
      expect(calledWith.atoms[0]).toHaveProperty('norm_label', 'testjs');
    });
  });

  describe('deleteByProject', () => {
    it('should call delete API', async () => {
      deleteSpy.mockResolvedValue({ deleted: 5 });

      const result = await client.deleteByProject('test-project', 'test');

      expect(deleteSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/entities/by-project/test-project')
      );
      expect(result.deleted).toBe(5);
    });

    it('should gracefully handle missing endpoint', async () => {
      deleteSpy.mockRejectedValue(new Error('404 not found'));

      const result = await client.deleteByProject('test-project', 'test');

      expect(result.deleted).toBe(0);
    });

    it('should use tenant_id from client when not provided', async () => {
      deleteSpy.mockResolvedValue({ deleted: 3 });

      await client.deleteByProject('my-project');

      expect(deleteSpy).toHaveBeenCalledWith(expect.stringContaining('tenant_id=test'));
    });
  });
});
