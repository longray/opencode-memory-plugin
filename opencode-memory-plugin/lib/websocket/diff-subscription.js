import fastJsonPatch from 'fast-json-patch';
const { applyPatch } = fastJsonPatch;

export class DiffSubscription {
  constructor(client) {
    this.client = client;
    this.localCache = new Map();
    this.subscriptions = new Map();
    this.onUpdate = null;
  }

  async subscribe(entityId, tenantId = 'default') {
    if (!this.client || this.client.state !== 'CONNECTED') {
      throw new Error('WebSocket client not connected');
    }

    this.localCache.set(entityId, {});

    const subscribeRequest = {
      action: 'subscribe',
      query: `LIVE SELECT DIFF FROM entity WHERE id = "${entityId}" AND tenant_id = "${tenantId}"`,
    };

    await this.client.send(JSON.stringify(subscribeRequest));

    console.log(`[DiffSubscription] Subscribed to DIFF for ${entityId}`);
  }

  async unsubscribe(entityId) {
    if (!this.client || this.client.state !== 'CONNECTED') {
      return;
    }

    const unsubscribeRequest = {
      action: 'unsubscribe',
      entityId,
    };

    await this.client.send(JSON.stringify(unsubscribeRequest));

    this.localCache.delete(entityId);
    this.subscriptions.delete(entityId);

    console.log(`[DiffSubscription] Unsubscribed from DIFF for ${entityId}`);
  }

  applyDiff(entityId, patches) {
    const current = this.localCache.get(entityId);
    if (!current) {
      console.warn(`[DiffSubscription] No cache found for ${entityId}`);
      return null;
    }

    try {
      const result = applyPatch(current, patches, true, false);
      const updated = result.newDocument;

      this.localCache.set(entityId, updated);

      if (this.onUpdate) {
        this.onUpdate(entityId, updated, patches);
      }

      console.log(`[DiffSubscription] Applied diff to ${entityId}`);
      return updated;
    } catch (error) {
      console.error(`[DiffSubscription] Failed to apply diff: ${error.message}`);
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
