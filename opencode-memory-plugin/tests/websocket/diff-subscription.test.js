import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DiffSubscription } from '../../lib/websocket/diff-subscription.js';

describe('DiffSubscription', () => {
  let diffSubscription;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      state: 'CONNECTED',
      send: jest.fn(),
    };
    diffSubscription = new DiffSubscription(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(diffSubscription).toBeDefined();
      expect(diffSubscription).toBeInstanceOf(DiffSubscription);
    });

    it('should initialize with empty cache', () => {
      expect(diffSubscription.localCache).toBeDefined();
      expect(diffSubscription.localCache.size).toBe(0);
    });

    it('should initialize with empty subscriptions', () => {
      expect(diffSubscription.subscriptions).toBeDefined();
      expect(diffSubscription.subscriptions.size).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should throw error if client not connected', async () => {
      mockClient.state = 'CLOSED';
      await expect(diffSubscription.subscribe('test-entity')).rejects.toThrow(
        'WebSocket client not connected'
      );
    });

    it('should send subscribe request', async () => {
      await diffSubscription.subscribe('test-entity', 'test-tenant');

      expect(mockClient.send).toHaveBeenCalled();
      const call = mockClient.send.mock.calls[0][0];
      const request = JSON.parse(call);

      expect(request.action).toBe('subscribe');
      expect(request.query).toContain('LIVE SELECT DIFF');
      expect(request.query).toContain('test-entity');
      expect(request.query).toContain('test-tenant');
    });

    it('should initialize cache for entity', async () => {
      await diffSubscription.subscribe('test-entity');

      const cache = diffSubscription.getCache('test-entity');
      expect(cache).toBeDefined();
      expect(typeof cache).toBe('object');
    });
  });

  describe('unsubscribe', () => {
    it('should send unsubscribe request', async () => {
      await diffSubscription.subscribe('test-entity');
      await diffSubscription.unsubscribe('test-entity');

      expect(mockClient.send).toHaveBeenCalledTimes(2);
      const call = mockClient.send.mock.calls[1][0];
      const request = JSON.parse(call);

      expect(request.action).toBe('unsubscribe');
      expect(request.entityId).toBe('test-entity');
    });

    it('should remove cache for entity', async () => {
      await diffSubscription.subscribe('test-entity');
      expect(diffSubscription.getCache('test-entity')).toBeDefined();

      await diffSubscription.unsubscribe('test-entity');
      expect(diffSubscription.getCache('test-entity')).toBeUndefined();
    });
  });

  describe('applyDiff', () => {
    beforeEach(async () => {
      await diffSubscription.subscribe('test-entity');
      diffSubscription.setCache('test-entity', {
        id: 'test-entity',
        name: 'Test',
        value: 100,
      });
    });

    it('should apply add operation', () => {
      const patches = [{ op: 'add', path: '/newField', value: 'new value' }];

      const result = diffSubscription.applyDiff('test-entity', patches);

      expect(result).toBeDefined();
      expect(result.newField).toBe('new value');
    });

    it('should apply replace operation', () => {
      const patches = [{ op: 'replace', path: '/value', value: 200 }];

      const result = diffSubscription.applyDiff('test-entity', patches);

      expect(result).toBeDefined();
      expect(result.value).toBe(200);
    });

    it('should apply remove operation', () => {
      const patches = [{ op: 'remove', path: '/value' }];

      const result = diffSubscription.applyDiff('test-entity', patches);

      expect(result).toBeDefined();
      expect(result.value).toBeUndefined();
    });

    it('should return null if no cache', () => {
      const result = diffSubscription.applyDiff('non-existent', [
        { op: 'add', path: '/test', value: 'test' },
      ]);

      expect(result).toBeNull();
    });

    it('should call onUpdate callback', () => {
      const onUpdate = jest.fn();
      diffSubscription.onUpdate = onUpdate;

      const patches = [{ op: 'replace', path: '/name', value: 'Updated' }];
      diffSubscription.applyDiff('test-entity', patches);

      expect(onUpdate).toHaveBeenCalled();
      expect(onUpdate.mock.calls[0][0]).toBe('test-entity');
      expect(onUpdate.mock.calls[0][1].name).toBe('Updated');
      expect(onUpdate.mock.calls[0][2]).toEqual(patches);
    });
  });

  describe('cache management', () => {
    it('should set and get cache', () => {
      const data = { id: 'test', value: 123 };
      diffSubscription.setCache('test-entity', data);

      expect(diffSubscription.getCache('test-entity')).toEqual(data);
    });

    it('should clear specific entity cache', async () => {
      await diffSubscription.subscribe('entity1');
      await diffSubscription.subscribe('entity2');

      diffSubscription.clearCache('entity1');

      expect(diffSubscription.getCache('entity1')).toBeUndefined();
      expect(diffSubscription.getCache('entity2')).toBeDefined();
    });

    it('should clear all cache', async () => {
      await diffSubscription.subscribe('entity1');
      await diffSubscription.subscribe('entity2');

      diffSubscription.clearCache();

      expect(diffSubscription.getCache('entity1')).toBeUndefined();
      expect(diffSubscription.getCache('entity2')).toBeUndefined();
    });
  });

  describe('handleMessage', () => {
    beforeEach(async () => {
      await diffSubscription.subscribe('test-entity');
      diffSubscription.setCache('test-entity', { id: 'test-entity', count: 0 });
    });

    it('should handle diff message', () => {
      const message = {
        type: 'diff',
        entityId: 'test-entity',
        patches: [{ op: 'replace', path: '/count', value: 5 }],
      };

      const result = diffSubscription.handleMessage(message);

      expect(result).toBeDefined();
      expect(result.count).toBe(5);
    });

    it('should return null for non-diff message', () => {
      const message = {
        type: 'other',
        data: 'test',
      };

      const result = diffSubscription.handleMessage(message);

      expect(result).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should return subscription count', async () => {
      expect(diffSubscription.getSubscriptionCount()).toBe(0);

      await diffSubscription.subscribe('entity1');
      await diffSubscription.subscribe('entity2');

      expect(diffSubscription.getCacheSize()).toBe(2);
    });

    it('should return cache size', async () => {
      expect(diffSubscription.getCacheSize()).toBe(0);

      await diffSubscription.subscribe('entity1');
      await diffSubscription.subscribe('entity2');

      expect(diffSubscription.getCacheSize()).toBe(2);
    });
  });
});
