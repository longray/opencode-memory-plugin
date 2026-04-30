/**
 * WebSocket Sync Client - Real-time synchronization with backend
 * Connects to backend WebSocket for live memory change notifications
 *
 * @deprecated Use lib/websocket/reliable-client.js (ReliableWebSocketClient) instead.
 * This module has module-level shared state that causes issues with multiple instances.
 */

import WebSocket from 'ws';
import { logInfo, logError } from './logger.js';
import { WS_RECONNECT_BASE_DELAY_MS } from './constants.js';

// WebSocket connection state
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = WS_RECONNECT_BASE_DELAY_MS;

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
      logInfo('WebSocket', 'Already connected or connecting');
      return;
    }

    try {
      logInfo('WebSocket', `[WebSocket] Connecting to ${this.url}...`);

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logInfo('WebSocket', 'Connected successfully');
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
          logError('WebSocket', '[WebSocket] Failed to parse message', e);
        }
      });

      this.ws.on('close', (code, reason) => {
        logInfo('WebSocket', `Disconnected: ${code} ${reason}`);
        this.isConnected = false;
        this.ws = null;
        this.triggerHandler('disconnected', { code, reason });
        this.scheduleReconnect();
      });

      this.ws.on('error', error => {
        logError('WebSocket', '[WebSocket] Error', error);
        this.triggerHandler('error', { error: error.message });
      });
    } catch (error) {
      logError('WebSocket', '[WebSocket] Connection failed', error);
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
      logInfo('WebSocket', `Memory ${type}:`, { id: data?.id });
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
        logInfo('WebSocket', 'Sync required:', { data });
        this.triggerHandler('sync_required', data);
        break;

      case 'conflict_detected':
        logInfo('WebSocket', 'Conflict detected:', { data });
        this.triggerHandler('conflict_detected', data);
        break;

      case 'ping':
        this.send({ action: 'pong', timestamp: Date.now() });
        break;

      default:
        logInfo('WebSocket', 'Unknown message:', { message });
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
      logError('WebSocket', '[WebSocket] Send failed', error);
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
      logError('WebSocket', '[WebSocket] Max reconnect attempts reached');
      this.triggerHandler('max_reconnect_reached', {});
      return;
    }

    reconnectAttempts++;
    const delay = RECONNECT_DELAY * reconnectAttempts;

    logInfo('WebSocket', `Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

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
    logInfo('WebSocket', 'Disconnected');
  }
}

// Global WebSocket client instance
let globalWsClient = null;

/**
 * Initialize WebSocket sync
 */
export async function initRealtimeSync(config, onSyncRequired, onConflictDetected) {
  if (!config?.backend?.enabled) {
    logInfo('WebSocket', 'Backend disabled, skipping realtime sync');
    return null;
  }

  // v3.2: Default port changed from 17999 to 18008
  const apiPort = process.env.API_PORT || '18008';
  const defaultUrl = `http://localhost:${apiPort}`;
  const backendUrl = config?.backend?.url || defaultUrl;
  const wsUrl =
    backendUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/memories/live';
  const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';

  globalWsClient = new SyncWebSocketClient(wsUrl, tenantId);

  // Register handlers
  globalWsClient.on('sync_required', onSyncRequired);
  globalWsClient.on('conflict_detected', onConflictDetected);
  globalWsClient.on('connected', () => logInfo('Sync', 'Real-time sync enabled'));
  globalWsClient.on('disconnected', () => logInfo('Sync', 'Real-time sync paused'));

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
  logInfo('Sync', 'Real-time sync stopped');
}

export default {
  SyncWebSocketClient,
  initRealtimeSync,
  notifyLocalChange,
  requestRealtimeSync,
  getRealtimeSyncStatus,
  stopRealtimeSync,
};
