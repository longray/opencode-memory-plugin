import fastJsonPatch from 'fast-json-patch';
import { logInfo, logWarn, logError } from '../logger.js';
const { applyPatch } = fastJsonPatch;

function escapeSurrealQL(value) {
  if (typeof value !== 'string') return String(value);
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export class DiffSubscription {
  constructor(client) {
    this.client = client;
    this.localCache = new Map();
    this.subscriptions = new Map();
    this.onUpdate = null;
  }

  async subscribe(entityId, tenantId = 'default') {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('WebSocket client not connected');
    }

    this.localCache.set(entityId, {});
    this.subscriptions.set(entityId, true);

    const subscribeRequest = {
      action: 'subscribe',
      query: `LIVE SELECT DIFF FROM entity WHERE id = "${escapeSurrealQL(entityId)}" AND tenant_id = "${escapeSurrealQL(tenantId)}"`,
    };

    this.client.send(subscribeRequest);

    logInfo('DiffSubscription', `Subscribed to DIFF for ${entityId}`);
  }

  async unsubscribe(entityId) {
    if (!this.client || !this.client.isConnected()) {
      return;
    }

    const unsubscribeRequest = {
      action: 'unsubscribe',
      entityId,
    };

    this.client.send(unsubscribeRequest);

    this.localCache.delete(entityId);
    this.subscriptions.delete(entityId);

    logInfo('DiffSubscription', `Unsubscribed from DIFF for ${entityId}`);
  }

  applyDiff(entityId, patches) {
    const current = this.localCache.get(entityId);
    if (!current) {
      logWarn('DiffSubscription', `No cache found for ${entityId}`);
      return null;
    }

    try {
      const result = applyPatch(current, patches, true, false);
      const updated = result.newDocument;

      this.localCache.set(entityId, updated);

      if (this.onUpdate) {
        this.onUpdate(entityId, updated, patches);
      }

      logInfo('DiffSubscription', `Applied diff to ${entityId}`);
      return updated;
    } catch (error) {
      logError('DiffSubscription', `Failed to apply diff: ${error.message}`);
      return null;
    }
  }

  getCache(entityId) {
    return this.localCache.get(entityId);
  }

  setCache(entityId, data) {
    this.localCache.set(entityId, data);
  }

  clearCache(entityId) {
    if (entityId) {
      this.localCache.delete(entityId);
    } else {
      this.localCache.clear();
    }
  }

  handleMessage(message) {
    if (message.type === 'diff') {
      const { entityId, patches } = message;
      return this.applyDiff(entityId, patches);
    }
    return null;
  }

  getSubscriptionCount() {
    return this.subscriptions.size;
  }

  getCacheSize() {
    return this.localCache.size;
  }
}

export default DiffSubscription;
