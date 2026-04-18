import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ReliableWebSocketClient,
  WebSocketState,
  HeartbeatManager,
  StateManager,
} from '../../lib/websocket/index.js';

describe('ReliableWebSocketClient', () => {
  let client;

  beforeEach(() => {
    client = new ReliableWebSocketClient('ws://localhost:18008/ws/memories/live', {
      tenantId: 'test-tenant',
      reconnectMaxAttempts: 3,
      reconnectBaseDelay: 100,
    });
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultClient = new ReliableWebSocketClient('ws://localhost:8080');
      expect(defaultClient.url).toBe('ws://localhost:8080');
      expect(defaultClient.tenantId).toBe('default');
      expect(defaultClient.sessionId).toBeDefined();
    });

    it('should create instance with custom options', () => {
      expect(client.url).toBe('ws://localhost:18008/ws/memories/live');
      expect(client.tenantId).toBe('test-tenant');
      expect(client.reconnectOptions.maxAttempts).toBe(3);
      expect(client.reconnectOptions.baseDelay).toBe(100);
    });
  });

  describe('state management', () => {
    it('should start in CLOSED state', () => {
      expect(client.getState()).toBe(WebSocketState.CLOSED);
    });

    it('should track state transitions', () => {
      const states = [];
      client.stateManager.onStateChange((from, to) => {
        states.push({ from, to });
      });

      client.stateManager.transition(WebSocketState.CONNECTING);
      expect(client.getState()).toBe(WebSocketState.CONNECTING);

      client.stateManager.transition(WebSocketState.CONNECTED);
      expect(client.getState()).toBe(WebSocketState.CONNECTED);

      expect(states).toHaveLength(2);
    });
  });

  describe('reconnect delay calculation', () => {
    it('should calculate exponential backoff', () => {
      client.reconnectAttempts = 1;
      expect(client.calculateReconnectDelay()).toBeGreaterThanOrEqual(100);

      client.reconnectAttempts = 2;
      expect(client.calculateReconnectDelay()).toBeGreaterThanOrEqual(200);

      client.reconnectAttempts = 3;
      expect(client.calculateReconnectDelay()).toBeGreaterThanOrEqual(400);
    });

    it('should respect max delay', () => {
      client.reconnectAttempts = 100;
      const delay = client.calculateReconnectDelay();
      expect(delay).toBeLessThanOrEqual(300000 + 1000);
    });
  });

  describe('message queue', () => {
    it('should queue messages when disconnected', () => {
      client.send({ type: 'test', data: 'hello' });
      expect(client.messageQueue).toHaveLength(1);
    });

    it('should clear queue on disconnect', () => {
      client.send({ type: 'test' });
      expect(client.messageQueue).toHaveLength(1);

      client.disconnect();
      expect(client.messageQueue).toHaveLength(0);
    });
  });

  describe('event handlers', () => {
    it('should register and trigger handlers', () => {
      const handler = jest.fn();
      client.on('test', handler);

      client.triggerHandler('test', { data: 'value' });
      expect(handler).toHaveBeenCalledWith({ data: 'value' });
    });

    it('should remove handlers', () => {
      const handler = jest.fn();
      client.on('test', handler);
      client.off('test');

      client.triggerHandler('test', {});
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('should return current stats', () => {
      const stats = client.getStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('reconnectAttempts');
      expect(stats).toHaveProperty('sessionId');
      expect(stats).toHaveProperty('heartbeat');
      expect(stats).toHaveProperty('queuedMessages');
    });
  });
});

describe('HeartbeatManager', () => {
  it('should initialize with default options', () => {
    const hb = new HeartbeatManager();
    expect(hb.interval).toBe(30000);
    expect(hb.maxMissed).toBe(2);
  });

  it('should accept custom options', () => {
    const hb = new HeartbeatManager({
      interval: 10000,
      maxMissed: 3,
    });
    expect(hb.interval).toBe(10000);
    expect(hb.maxMissed).toBe(3);
  });
});

describe('StateManager', () => {
  it('should start in CLOSED state', () => {
    const sm = new StateManager();
    expect(sm.getState()).toBe(WebSocketState.CLOSED);
  });

  it('should validate transitions', () => {
    const sm = new StateManager();
    expect(sm.isValidTransition(WebSocketState.CLOSED, WebSocketState.CONNECTING)).toBe(true);
    expect(sm.isValidTransition(WebSocketState.CLOSED, WebSocketState.CONNECTED)).toBe(false);
  });

  it('should record state history', () => {
    const sm = new StateManager();
    sm.transition(WebSocketState.CONNECTING);
    sm.transition(WebSocketState.CONNECTED);

    const history = sm.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].from).toBe(WebSocketState.CLOSED);
    expect(history[0].to).toBe(WebSocketState.CONNECTING);
  });
});
