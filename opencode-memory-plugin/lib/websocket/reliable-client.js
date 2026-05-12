/**
 * Reliable WebSocket Client
 * Enhanced WebSocket client with heartbeat, exponential backoff, and state management
 */

import WebSocket from 'ws';
import { StateManager, WebSocketState } from './state-manager.js';
import { HeartbeatManager } from './heartbeat.js';
import { AckManager } from './ack-manager.js';
import { logInfo, logWarn, logError, logDebug } from '../logger.js';
import {
  WS_RECONNECT_BASE_DELAY_MS,
  WS_RECONNECT_MAX_DELAY_MS,
  WS_RECONNECT_JITTER_MS,
  WS_HEARTBEAT_INTERVAL_MS,
  WS_HEARTBEAT_TIMEOUT_MS,
  WS_ACK_TIMEOUT_MS,
} from '../constants.js';

const MAX_QUEUE_SIZE = 1000;

export class ReliableWebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.tenantId = options.tenantId || 'default';
    this.token = options.token || null;

    this.reconnectOptions = {
      baseDelay: options.reconnectBaseDelay || WS_RECONNECT_BASE_DELAY_MS,
      maxDelay: options.reconnectMaxDelay || WS_RECONNECT_MAX_DELAY_MS,
      maxAttempts: options.reconnectMaxAttempts || 10,
      jitter: options.reconnectJitter !== false,
    };
    this.mode = options.mode || 'full';

    this.ws = null;
    this.stateManager = new StateManager();
    this.heartbeatManager = new HeartbeatManager({
      interval: options.heartbeatInterval || WS_HEARTBEAT_INTERVAL_MS,
      timeout: options.heartbeatTimeout || WS_HEARTBEAT_TIMEOUT_MS,
      maxMissed: options.heartbeatMaxMissed || 2,
    });
    this.ackManager = new AckManager({
      timeout: options.ackTimeout || WS_ACK_TIMEOUT_MS,
      maxRetries: options.ackMaxRetries || 3,
    });

    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this._connectedAt = null;
    this.messageQueue = [];
    this.messageHandlers = new Map();

    this.sessionId = options.sessionId || this.generateSessionId();
    this._connectResolve = null;
    this._connectReject = null;
  }

  generateSessionId() {
    return `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async connect() {
    if (!this.stateManager.is(WebSocketState.CLOSED)) {
      logInfo('ReliableWebSocket', 'Already connected or connecting');
      return;
    }

    this.stateManager.transition(WebSocketState.CONNECTING, 'user initiated');

    return new Promise((resolve, reject) => {
      this._connectResolve = resolve;
      this._connectReject = reject;

      try {
        const urlWithParams = this.buildUrl();
        logInfo('ReliableWebSocket', `Connecting to ${urlWithParams}...`);

        this.ws = new WebSocket(urlWithParams);

        this.setupEventHandlers();
      } catch (error) {
        logError('ReliableWebSocket', 'Connection failed', error);
        this.handleConnectionFailure();
        reject(error);
      }
    });
  }

  buildUrl() {
    const url = new URL(this.url);
    url.searchParams.set('tenant_id', this.tenantId);
    url.searchParams.set('session_id', this.sessionId);
    url.searchParams.set('mode', this.mode || 'full');
    if (this.token) {
      url.searchParams.set('token', this.token);
    }
    return url.toString();
  }

  _doConnect() {
    try {
      const urlWithParams = this.buildUrl();
      logInfo('ReliableWebSocket', `Reconnecting to ${urlWithParams}...`);

      if (this.ws) {
        this.ws.removeAllListeners();
      }

      this.ws = new WebSocket(urlWithParams);
      this.setupEventHandlers();
    } catch (error) {
      logError('ReliableWebSocket', 'Reconnection failed', error);
      this.handleConnectionFailure();
    }
  }

  setupEventHandlers() {
    this.ws.on('open', () => {
      logInfo('ReliableWebSocket', 'Transport open, waiting for connected message...');
      this.stateManager.transition(WebSocketState.CONNECTING, 'websocket open');
    });

    this.ws.on('message', data => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (e) {
        logError('ReliableWebSocket', 'Failed to parse message', e);
      }
    });

    this.ws.on('close', (code, reason) => {
      logInfo('ReliableWebSocket', `Disconnected: ${code} ${reason}`);
      this.handleDisconnect(code, reason);
    });

    this.ws.on('error', error => {
      logError('ReliableWebSocket', `Error: ${error.message}`, error);
      this.triggerHandler('error', { error: error.message });
      if (this._connectReject) {
        this._connectReject(error);
        this._connectReject = null;
        this._connectResolve = null;
      }
    });
  }

  handleConnectionFailure() {
    this.stateManager.transition(WebSocketState.RECONNECTING, 'connection failed');
    this.scheduleReconnect();
  }

  handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    const { type, action } = message;

    // M3: Server sends ping, client replies pong (passive heartbeat)
    if (type === 'ping') {
      this.send({ type: 'pong', timestamp: message.timestamp });
      this.heartbeatManager.onServerPing();
      return;
    }

    // Server-initiated connected message (actual protocol: server sends session_id)
    if (type === 'connected') {
      if (message.session_id) {
        this.sessionId = message.session_id;
      }
      logInfo('ReliableWebSocket', `Connected, session: ${this.sessionId}`);
      this._connectedAt = Date.now();
      this.reconnectAttempts = 0;
      this.stateManager.transition(WebSocketState.CONNECTED, 'server confirmed');
      this.startHeartbeat();
      this.flushMessageQueue();
      this.triggerHandler('connected', {
        tenantId: this.tenantId,
        sessionId: this.sessionId,
      });
      if (this._connectResolve) {
        this._connectResolve();
        this._connectResolve = null;
        this._connectReject = null;
      }
      return;
    }

    // M2: ACK using seq (server confirms our ack, or we process server seq)
    if (type === 'ack' && message.seq !== undefined) {
      this.ackManager.onAckReceived(String(message.seq));
      return;
    }

    // Server error message
    if (type === 'error') {
      logError('ReliableWebSocket', `Server error: ${message.message}`);
      this.triggerHandler('error', { error: message.message });
      return;
    }

    // M1: change message from server (action: CREATE/UPDATE/DELETE, data in result field)
    if (type === 'change' && action) {
      if (message.seq !== undefined) {
        this.send({ type: 'ack', seq: message.seq });
      }

      this.triggerHandler('message', message);
      this.triggerHandler('memory_changed', {
        action: action.toLowerCase(),
        memoryId: message.result?.id,
        data: message.result,
        seq: message.seq,
      });
      return;
    }

    // Fallback: pass through unhandled messages
    this.triggerHandler('message', message);
  }

  startHeartbeat() {
    this.heartbeatManager.start(null, () => this.handleHeartbeatTimeout());
  }

  handleHeartbeatTimeout() {
    logInfo('ReliableWebSocket', 'No server ping received, reconnecting...');
    this.ws?.terminate();
    this.handleDisconnect(1001, 'server ping timeout');
  }

  handleDisconnect(code, reason) {
    this.heartbeatManager.stop();

    const MIN_STABLE_MS = 5000;
    const wasStable = this._connectedAt && Date.now() - this._connectedAt >= MIN_STABLE_MS;

    if (wasStable) {
      this.reconnectAttempts = 0;
    }

    if (this.stateManager.is(WebSocketState.CONNECTED)) {
      this.stateManager.transition(WebSocketState.RECONNECTING, `disconnected: ${code}`);
      this.triggerHandler('disconnected', { code, reason });
      this.scheduleReconnect();
    } else {
      this.stateManager.transition(WebSocketState.CLOSED, `disconnected: ${code}`);
    }

    if (this._connectReject) {
      this._connectReject(new Error(`Disconnected: ${code} ${reason}`));
      this._connectReject = null;
      this._connectResolve = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.reconnectOptions.maxAttempts) {
      logError('ReliableWebSocket', 'Max reconnect attempts reached');
      this.stateManager.transition(WebSocketState.CLOSED, 'max attempts reached');
      this.triggerHandler('max_reconnect_reached', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();

    logInfo('ReliableWebSocket', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this._doConnect();
    }, delay);
  }

  calculateReconnectDelay() {
    const { baseDelay, maxDelay, jitter } = this.reconnectOptions;

    let delay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      delay += Math.random() * WS_RECONNECT_JITTER_MS;
    }

    return Math.floor(delay);
  }

  send(message) {
    if (!this.stateManager.is(WebSocketState.CONNECTED) || !this.ws) {
      if (this.messageQueue.length >= MAX_QUEUE_SIZE) {
        this.messageQueue.shift();
        logWarn('ReliableWebSocket', 'Queue full, dropped oldest message');
      }
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logError('ReliableWebSocket', 'Send failed', error);
      this.messageQueue.push(message);
      return false;
    }
  }

  sendWithAck(message, timeout, maxRetries) {
    if (!this.stateManager.is(WebSocketState.CONNECTED) || !this.ws) {
      return Promise.reject(new Error('WebSocket not connected'));
    }

    return this.ackManager.sendWithAck(this.ws, message, timeout, maxRetries);
  }

  flushMessageQueue() {
    const queueSnapshot = this.messageQueue.splice(0);
    for (const message of queueSnapshot) {
      if (!this.stateManager.is(WebSocketState.CONNECTED) || !this.ws) {
        this.messageQueue.unshift(message);
        break;
      }
      try {
        this.ws.send(JSON.stringify(message));
      } catch (e) {
        logDebug('ws-client', 'WebSocket send failed, re-queuing message', { error: e.message });
        this.messageQueue.unshift(message);
        break;
      }
    }
  }

  on(event, handler) {
    this.messageHandlers.set(event, handler);
    return this;
  }

  off(event) {
    this.messageHandlers.delete(event);
    return this;
  }

  triggerHandler(event, data) {
    const handler = this.messageHandlers.get(event);
    if (handler) {
      try {
        handler(data);
      } catch (error) {
        logError('ReliableWebSocket', `Handler error for ${event}`, error);
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.heartbeatManager.stop();
    this.ackManager.clearAll();

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }

    this.messageQueue = [];
    this.stateManager.transition(WebSocketState.CLOSED, 'user disconnected');
    this.reconnectAttempts = 0;
    this._connectResolve = null;
    this._connectReject = null;
    logInfo('ReliableWebSocket', 'Disconnected by user');
  }

  getState() {
    return this.stateManager.getState();
  }

  getStats() {
    return {
      state: this.stateManager.getState(),
      reconnectAttempts: this.reconnectAttempts,
      sessionId: this.sessionId,
      heartbeat: this.heartbeatManager.getStats(),
      queuedMessages: this.messageQueue.length,
    };
  }
}

export default { ReliableWebSocketClient };
