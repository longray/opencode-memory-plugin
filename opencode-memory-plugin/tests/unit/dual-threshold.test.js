import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { classifyRecommendation } = await import('../../lib/relation-recommender.js');
const { PendingReviewQueue } = await import('../../lib/pending-review-queue.js');

describe('Dual Threshold Recommendation', () => {
  describe('classifyRecommendation', () => {
    it('should classify as auto-create when similarity >= 0.85', () => {
      expect(classifyRecommendation(0.9)).toBe('auto_create');
    });

    it('should classify as auto-create at exact 0.85 threshold', () => {
      expect(classifyRecommendation(0.85)).toBe('auto_create');
    });

    it('should classify as pending_review when 0.75 <= similarity < 0.85', () => {
      expect(classifyRecommendation(0.8)).toBe('pending_review');
    });

    it('should classify as pending_review at exact 0.75 threshold', () => {
      expect(classifyRecommendation(0.75)).toBe('pending_review');
    });

    it('should classify as ignored when similarity < 0.75', () => {
      expect(classifyRecommendation(0.7)).toBe('ignored');
    });

    it('should use custom thresholds when provided', () => {
      const result = classifyRecommendation(0.82, { autoCreate: 0.9, reviewThreshold: 0.8 });
      expect(result).toBe('pending_review');
    });

    it('should classify as auto-create with custom thresholds', () => {
      const result = classifyRecommendation(0.92, { autoCreate: 0.9, reviewThreshold: 0.8 });
      expect(result).toBe('auto_create');
    });

    it('should classify as ignored with custom thresholds', () => {
      const result = classifyRecommendation(0.78, { autoCreate: 0.9, reviewThreshold: 0.8 });
      expect(result).toBe('ignored');
    });
  });
});

describe('PendingReviewQueue', () => {
  let queue;
  const queueFile = path.join(os.homedir(), '.opencode', 'memory', 'test-pending-queue.json');

  beforeEach(() => {
    queue = new PendingReviewQueue({ queueFile });
  });

  afterEach(async () => {
    await queue.clear();
    try {
      if (fs.existsSync(queueFile)) {
        fs.unlinkSync(queueFile);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('add', () => {
    it('should add a recommendation to the queue', async () => {
      const item = {
        from_id: 'entity-1',
        to_id: 'entity-2',
        similarity: 0.8,
        type: 'related',
      };

      const queueId = await queue.add(item);

      expect(queueId).toBeDefined();
      expect(queue.list().length).toBe(1);
    });

    it('should add metadata including timestamp and similarity', async () => {
      const item = {
        from_id: 'entity-1',
        to_id: 'entity-2',
        similarity: 0.8,
        type: 'related',
      };

      const queueId = await queue.add(item);
      const items = queue.list();
      const added = items.find(i => i.queueId === queueId);

      expect(added).toBeDefined();
      expect(added.similarity).toBe(0.8);
      expect(added.from_id).toBe('entity-1');
      expect(added.to_id).toBe('entity-2');
      expect(added.addedAt).toBeDefined();
    });

    it('should generate unique queueId for each item', async () => {
      const item1 = { from_id: 'e1', to_id: 'e2', similarity: 0.8 };
      const item2 = { from_id: 'e3', to_id: 'e4', similarity: 0.78 };

      const id1 = await queue.add(item1);
      const id2 = await queue.add(item2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('approve', () => {
    it('should remove item from queue and return it', async () => {
      const item = { from_id: 'e1', to_id: 'e2', similarity: 0.8 };
      const queueId = await queue.add(item);

      const approved = await queue.approve(queueId);

      expect(approved).toBeDefined();
      expect(approved.queueId).toBe(queueId);
      expect(queue.list().length).toBe(0);
    });

    it('should return null for non-existent queueId', async () => {
      const result = await queue.approve('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('reject', () => {
    it('should remove item from queue without returning it', async () => {
      const item = { from_id: 'e1', to_id: 'e2', similarity: 0.8 };
      const queueId = await queue.add(item);

      const result = await queue.reject(queueId);

      expect(result).toBe(true);
      expect(queue.list().length).toBe(0);
    });

    it('should return false for non-existent queueId', async () => {
      const result = await queue.reject('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('list', () => {
    it('should return all pending items', async () => {
      await queue.add({ from_id: 'e1', to_id: 'e2', similarity: 0.8 });
      await queue.add({ from_id: 'e3', to_id: 'e4', similarity: 0.78 });

      const items = queue.list();
      expect(items.length).toBe(2);
    });

    it('should return empty array when queue is empty', () => {
      expect(queue.list()).toEqual([]);
    });
  });

  describe('expireOldItems', () => {
    it('should remove items older than expiry days', async () => {
      queue = new PendingReviewQueue({ queueFile, expiryDays: 7 });

      const item = { from_id: 'e1', to_id: 'e2', similarity: 0.8 };
      const queueId = await queue.add(item);

      const items = queue.list();
      const target = items.find(i => i.queueId === queueId);
      target.addedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      await queue.save();

      const expired = await queue.expireOldItems();

      expect(expired).toBe(1);
      expect(queue.list().length).toBe(0);
    });

    it('should not remove recent items', async () => {
      queue = new PendingReviewQueue({ queueFile, expiryDays: 7 });

      await queue.add({ from_id: 'e1', to_id: 'e2', similarity: 0.8 });

      const expired = await queue.expireOldItems();

      expect(expired).toBe(0);
      expect(queue.list().length).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should save queue to file', async () => {
      queue = new PendingReviewQueue({ queueFile });

      await queue.add({ from_id: 'e1', to_id: 'e2', similarity: 0.8 });
      await queue.save();

      expect(fs.existsSync(queueFile)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
      expect(saved.items.length).toBe(1);
    });

    it('should load queue from file on construction', async () => {
      const tempQueue = new PendingReviewQueue({ queueFile });
      await tempQueue.add({ from_id: 'e1', to_id: 'e2', similarity: 0.8 });
      await tempQueue.save();

      queue = new PendingReviewQueue({ queueFile });

      expect(queue.list().length).toBe(1);
    });
  });
});
