import fs from 'fs';
import path from 'path';
import os from 'os';
import { ulid } from './ulid.js';
import { RECOMMENDATION_QUEUE_EXPIRY_DAYS, PENDING_REVIEW_QUEUE_FILE } from './constants.js';
import { logInfo, logWarn } from './logger.js';
import { getWrapperClient } from './wrapper-client.js';
import { getConfig } from './storage.js';

export class PendingReviewQueue {
  constructor(config = {}) {
    this.queueFile =
      config.queueFile || path.join(os.homedir(), '.opencode', 'memory', PENDING_REVIEW_QUEUE_FILE);
    this.expiryDays =
      config.expiryDays !== undefined ? config.expiryDays : RECOMMENDATION_QUEUE_EXPIRY_DAYS;

    this.items = [];
    this._savePromise = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.queueFile)) {
        const data = JSON.parse(fs.readFileSync(this.queueFile, 'utf-8'));
        this.items = data.items || [];
        logInfo('pending-review-queue', `Loaded ${this.items.length} items from queue`);
      }
    } catch (error) {
      logWarn('pending-review-queue', `Failed to load queue: ${error.message}`);
      this.items = [];
    }
    this.expireOldItems();
  }

  async save() {
    if (this._savePromise) return this._savePromise;

    this._savePromise = (async () => {
      try {
        const dir = path.dirname(this.queueFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.queueFile, JSON.stringify({ items: this.items }, null, 2), 'utf-8');
        return true;
      } catch (error) {
        logWarn('pending-review-queue', `Failed to save queue: ${error.message}`);
        return false;
      }
    })();

    const result = await this._savePromise;
    this._savePromise = null;
    return result;
  }

  async add(item) {
    const queueId = ulid();
    const entry = {
      queueId,
      from_id: item.from_id,
      to_id: item.to_id,
      similarity: item.similarity,
      type: item.type || 'related',
      weight: item.weight || item.similarity,
      description: item.description || '',
      addedAt: new Date().toISOString(),
    };

    this.items.push(entry);
    await this.save();
    logInfo(
      'pending-review-queue',
      `Added item ${queueId} to queue (similarity: ${item.similarity})`
    );

    return queueId;
  }

  async approve(queueId) {
    const index = this.items.findIndex(i => i.queueId === queueId);
    if (index === -1) return null;

    const item = this.items.splice(index, 1)[0];
    await this.save();
    logInfo('pending-review-queue', `Approved item ${queueId}`);

    return item;
  }

  async reject(queueId) {
    const index = this.items.findIndex(i => i.queueId === queueId);
    if (index === -1) return false;

    this.items.splice(index, 1);
    await this.save();
    logInfo('pending-review-queue', `Rejected item ${queueId}`);

    return true;
  }

  list() {
    return [...this.items];
  }

  async expireOldItems() {
    const cutoff = new Date(Date.now() - this.expiryDays * 24 * 60 * 60 * 1000);
    const before = this.items.length;

    this.items = this.items.filter(item => {
      const addedAt = new Date(item.addedAt);
      return addedAt >= cutoff;
    });

    const expired = before - this.items.length;
    if (expired > 0) {
      await this.save();
      logInfo('pending-review-queue', `Expired ${expired} old items from queue`);
    }

    return expired;
  }

  async clear() {
    this.items = [];
    await this.save();
  }

  async approveAndCreate(queueId) {
    const item = await this.approve(queueId);
    if (!item) return null;

    try {
      const client = getWrapperClient(getConfig());
      await client.createRelation({
        from_id: item.from_id,
        to_id: item.to_id,
        type: item.type,
        weight: item.weight,
        description:
          item.description ||
          `Auto-approved from review queue (${Math.round(item.similarity * 100)}%)`,
      });

      logInfo('pending-review-queue', `Created relation for approved item ${queueId}`);
      return { success: true, item };
    } catch (error) {
      logWarn('pending-review-queue', `Failed to create relation for ${queueId}: ${error.message}`);
      return { success: false, error: error.message, item };
    }
  }
}
