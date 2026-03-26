/**
 * WebSocket Sync Client - Real-time synchronization with backend
 * Connects to backend WebSocket for live memory change notifications
 */

import WebSocket from 'ws';

// WebSocket connection state
const _wsClient = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000;

// Callbacks for different message types
const messageHandlers = new Map();

/**
 * WebSocket Sync Client
 */
export class SyncWebSocketClient {
  constructor(url, tenantId = 'default') {
    this.url = url;
    this.tenantId = tenantId;
    this.ws = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.messageQueue = [];
  }

  /**
   * Connect to WebSocket endpoint
   */
  async connect() {
    if (this.isConnected || this.ws) {
      console.log('[WebSocket] Already connected or connecting');
      return;
    }

    try {
      console.log(`[WebSocket] Connecting to ${this.url}...`);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('[WebSocket] Connected successfully');
        this.isConnected = true;
        reconnectAttempts = 0;

        // Send any queued messages
        this.flushMessageQueue();

        // Trigger callback
        this.triggerHandler('connected', { tenantId: this.tenantId });
      });

      this.ws.on('message', data => {
        try {
          const message = JSON.parse(data);
          this.handleMessage(message);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e.message);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[WebSocket] Disconnected: ${code} ${reason}`);
        this.isConnected = false;
        this.ws = null;
        this.triggerHandler('disconnected', { code, reason });
        this.scheduleReconnect();
      });

      this.ws.on('error', error => {
        console.error('[WebSocket] Error:', error.message);
        this.triggerHandler('error', { error: error.message });
      });
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error.message);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    const { action, type, data } = message;

    // Handle SurrealDB LIVE notifications
    if (type === 'CREATE' || type === 'UPDATE' || type === 'DELETE') {
      console.log(`[WebSocket] Memory ${type}:`, data?.id);
      this.triggerHandler('memory_changed', {
        action: type.toLowerCase(),
        memoryId: data?.id,
        data,
      });
      return;
    }

    // Handle custom actions
    switch (action) {
      case 'sync_required':
        console.log('[WebSocket] Sync required:', data);
        this.triggerHandler('sync_required', data);
        break;

      case 'conflict_detected':
        console.log('[WebSocket] Conflict detected:', data);
        this.triggerHandler('conflict_detected', data);
        break;

      case 'ping':
        this.send({ action: 'pong', timestamp: Date.now() });
        break;

      default:
        console.log('[WebSocket] Unknown message:', message);
    }
  }

  /**
   * Send message to server
   */
  send(message) {
    if (!this.isConnected || !this.ws) {
      // Queue message for later
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] Send failed:', error.message);
      this.messageQueue.push(message);
      return false;
    }
  }

  /**
   * Send local change notification to server
   */
  notifyLocalChange(entry) {
    return this.send({
      action: 'local_change',
      tenant_id: this.tenantId,
      entry,
      timestamp: Date.now(),
    });
  }

  /**
   * Request sync from server
   */
  requestSync() {
    return this.send({
      action: 'request_sync',
      tenant_id: this.tenantId,
      timestamp: Date.now(),
    });
  }

  /**
   * Flush queued messages
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Schedule reconnection
   */
  scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[WebSocket] Max reconnect attempts reached');
      this.triggerHandler('max_reconnect_reached', {});
      return;
    }

    reconnectAttempts++;
    const delay = RECONNECT_DELAY * reconnectAttempts;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Register message handler
   */
  on(event, handler) {
    messageHandlers.set(event, handler);
  }

  /**
   * Remove message handler
   */
  off(event) {
    messageHandlers.delete(event);
  }

  /**
   * Trigger handler for event
   */
  triggerHandler(event, data) {
    const handler = messageHandlers.get(event);
    if (handler) {
      handler(data);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    reconnectAttempts = 0;
    console.log('[WebSocket] Disconnected');
  }
}

// Global WebSocket client instance
let globalWsClient = null;

/**
 * Initialize WebSocket sync
 */
export async function initRealtimeSync(config, onSyncRequired, onConflictDetected) {
  if (!config?.backend?.enabled) {
    console.log('[WebSocket] Backend disabled, skipping realtime sync');
    return null;
  }

  const backendUrl = config?.backend?.url || 'http://localhost:17999';
  const wsUrl =
    backendUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/memories/live';
  const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';

  globalWsClient = new SyncWebSocketClient(wsUrl, tenantId);

  // Register handlers
  globalWsClient.on('sync_required', onSyncRequired);
  globalWsClient.on('conflict_detected', onConflictDetected);
  globalWsClient.on('connected', () => console.log('[Sync] Real-time sync enabled'));
  globalWsClient.on('disconnected', () => console.log('[Sync] Real-time sync paused'));

  await globalWsClient.connect();

  return globalWsClient;
}

/**
 * Notify server of local change
 */
export async function notifyLocalChange(entry) {
  if (!globalWsClient || !globalWsClient.isConnected) {
    return false;
  }

  return globalWsClient.notifyLocalChange(entry);
}

/**
 * Request manual sync
 */
export async function requestRealtimeSync() {
  if (!globalWsClient || !globalWsClient.isConnected) {
    return false;
  }

  return globalWsClient.requestSync();
}

/**
 * Get WebSocket connection status
 */
export function getRealtimeSyncStatus() {
  return {
    enabled: !!globalWsClient,
    connected: globalWsClient?.isConnected || false,
    reconnectAttempts,
    queuedMessages: globalWsClient?.messageQueue?.length || 0,
  };
}

/**
 * Stop realtime sync
 */
export function stopRealtimeSync() {
  if (globalWsClient) {
    globalWsClient.disconnect();
    globalWsClient = null;
  }
  console.log('[Sync] Real-time sync stopped');
}

export default {
  SyncWebSocketClient,
  initRealtimeSync,
  notifyLocalChange,
  requestRealtimeSync,
  getRealtimeSyncStatus,
  stopRealtimeSync,
};
