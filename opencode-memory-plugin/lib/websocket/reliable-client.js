/**
 * Reliable WebSocket Client
 * Enhanced WebSocket client with heartbeat, exponential backoff, and state management
 */

import WebSocket from 'ws';
import { StateManager, WebSocketState } from './state-manager.js';
import { HeartbeatManager } from './heartbeat.js';
import { AckManager } from './ack-manager.js';
import { DiffSubscription } from './diff-subscription.js';

export class ReliableWebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.tenantId = options.tenantId || 'default';
    this.token = options.token || null;

    this.reconnectOptions = {
      baseDelay: options.reconnectBaseDelay || 1000,
      maxDelay: options.reconnectMaxDelay || 300000,
      maxAttempts: options.reconnectMaxAttempts || 10,
      jitter: options.reconnectJitter !== false,
    };

    this.ws = null;
    this.stateManager = new StateManager();
    this.heartbeatManager = new HeartbeatManager({
      interval: options.heartbeatInterval || 30000,
      timeout: options.heartbeatTimeout || 5000,
      maxMissed: options.heartbeatMaxMissed || 2,
    });
    this.ackManager = new AckManager({
      timeout: options.ackTimeout || 5000,
      maxRetries: options.ackMaxRetries || 3,
    });

    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.messageHandlers = new Map();

    this.sessionId = options.sessionId || this.generateSessionId();

    this.diffSubscription = new DiffSubscription(this);
  }

  generateSessionId() {
    return `sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  async connect() {
    if (!this.stateManager.is(WebSocketState.CLOSED)) {
      console.log('[ReliableWebSocket] Already connected or connecting');
      return;
    }

    this.stateManager.transition(WebSocketState.CONNECTING, 'user initiated');

    try {
      const urlWithParams = this.buildUrl();
      console.log(`[ReliableWebSocket] Connecting to ${urlWithParams}...`);

      this.ws = new WebSocket(urlWithParams);

      this.setupEventHandlers();
    } catch (error) {
      console.error('[ReliableWebSocket] Connection failed:', error.message);
      this.handleConnectionFailure();
    }
  }

  buildUrl() {
    const url = new URL(this.url);
    url.searchParams.set('tenant_id', this.tenantId);
    url.searchParams.set('session_id', this.sessionId);
    if (this.token) {
      url.searchParams.set('token', this.token);
    }
    return url.toString();
  }

  setupEventHandlers() {
    this.ws.on('open', () => {
      console.log('[ReliableWebSocket] Transport open, waiting for connected message...');
      this.stateManager.transition(WebSocketState.CONNECTING, 'websocket open');
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', data => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (e) {
        console.error('[ReliableWebSocket] Failed to parse message:', e.message);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[ReliableWebSocket] Disconnected: ${code} ${reason}`);
      this.handleDisconnect(code, reason);
    });

    this.ws.on('error', error => {
      console.error('[ReliableWebSocket] Error:', error.message);
      this.triggerHandler('error', { error: error.message });
    });
  }

  handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    const { type, action } = message;

    // M3: Server sends ping, client replies pong (passive heartbeat)
    if (type === 'ping') {
      this.send({ type: 'pong' });
      this.heartbeatManager.onServerPing();
      return;
    }

    // Server-initiated connected message (actual protocol: server sends session_id)
    if (type === 'connected') {
      if (message.session_id) {
        this.sessionId = message.session_id;
      }
      console.log('[ReliableWebSocket] Connected, session:', this.sessionId);
      this.stateManager.transition(WebSocketState.CONNECTED, 'server confirmed');
      this.startHeartbeat();
      this.flushMessageQueue();
      this.triggerHandler('connected', {
        tenantId: this.tenantId,
        sessionId: this.sessionId,
      });
      return;
    }

    // M2: ACK using seq (server confirms our ack, or we process server seq)
    if (type === 'ack' && message.seq !== undefined) {
      this.ackManager.onAckReceived(String(message.seq));
      return;
    }

    // Server error message
    if (type === 'error') {
      console.error('[ReliableWebSocket] Server error:', message.message);
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
    console.log('[ReliableWebSocket] No server ping received, reconnecting...');
    this.ws?.terminate();
    this.handleDisconnect(1001, 'server ping timeout');
  }

  handleDisconnect(code, reason) {
    this.heartbeatManager.stop();

    if (this.stateManager.is(WebSocketState.CONNECTED)) {
      this.stateManager.transition(WebSocketState.RECONNECTING, `disconnected: ${code}`);
      this.triggerHandler('disconnected', { code, reason });
      this.scheduleReconnect();
    } else {
      this.stateManager.transition(WebSocketState.CLOSED, `disconnected: ${code}`);
    }
  }

  handleConnectionFailure() {
    this.stateManager.transition(WebSocketState.RECONNECTING, 'connection failed');
    this.scheduleReconnect();
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.reconnectOptions.maxAttempts) {
      console.error('[ReliableWebSocket] Max reconnect attempts reached');
      this.stateManager.transition(WebSocketState.CLOSED, 'max attempts reached');
      this.triggerHandler('max_reconnect_reached', { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateReconnectDelay();

    console.log(
      `[ReliableWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.stateManager.transition(WebSocketState.CONNECTING, 'reconnecting');
      this.connect();
    }, delay);
  }

  calculateReconnectDelay() {
    const { baseDelay, maxDelay, jitter } = this.reconnectOptions;

    let delay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    delay = Math.min(delay, maxDelay);

    if (jitter) {
      delay += Math.random() * 1000;
    }

    return Math.floor(delay);
  }

  send(message) {
    if (!this.stateManager.is(WebSocketState.CONNECTED) || !this.ws) {
      this.messageQueue.push(message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[ReliableWebSocket] Send failed:', error.message);
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
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
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
        console.error(`[ReliableWebSocket] Handler error for ${event}:`, error);
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
      this.ws.close();
      this.ws = null;
    }

    this.messageQueue = [];
    this.stateManager.transition(WebSocketState.CLOSED, 'user disconnected');
    this.reconnectAttempts = 0;
    console.log('[ReliableWebSocket] Disconnected by user');
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
