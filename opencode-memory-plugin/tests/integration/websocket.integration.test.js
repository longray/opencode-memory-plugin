import { describe, it, expect, jest } from '@jest/globals';
import WebSocket from 'ws';

const BACKEND_WS = 'ws://localhost:18008/ws/memories/live';
const BACKEND_HTTP = 'http://localhost:18008';
const TENANT_ID = 'default';
const TEST_TIMEOUT = 30000;

const isBackendAvailable = async () => {
  try {
    const res = await fetch(`${BACKEND_HTTP}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
};

const _backendUp = await isBackendAvailable();

const runTests = () => {
  describe('Connection', () => {
    it(
      'should connect and receive connected message',
      async () => {
        const result = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${BACKEND_WS}?tenant_id=${TENANT_ID}`);
          const messages = [];
          const timer = setTimeout(() => {
            ws.close();
            resolve(messages);
          }, 10000);

          ws.on('message', data => {
            const msg = JSON.parse(data);
            messages.push(msg);
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
            }
            if (msg.type === 'connected') {
              clearTimeout(timer);
              ws.close();
              resolve(messages);
            }
          });

          ws.on('error', e => {
            clearTimeout(timer);
            reject(e);
          });
        });

        expect(result.some(m => m.type === 'connected')).toBe(true);
        const connectedMsg = result.find(m => m.type === 'connected');
        expect(connectedMsg.session_id).toBeDefined();
        expect(typeof connectedMsg.session_id).toBe('string');
      },
      TEST_TIMEOUT
    );

    it(
      'should receive session_id in connected message',
      async () => {
        const sessionId = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${BACKEND_WS}?tenant_id=${TENANT_ID}`);
          const timer = setTimeout(() => {
            ws.close();
            resolve(null);
          }, 15000);

          ws.on('message', data => {
            const msg = JSON.parse(data);
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
            }
            if (msg.type === 'connected') {
              clearTimeout(timer);
              ws.close();
              resolve(msg.session_id);
            }
          });

          ws.on('error', e => {
            clearTimeout(timer);
            reject(e);
          });
        });

        expect(sessionId).toBeTruthy();
        expect(sessionId).toMatch(/^sess-/);
      },
      TEST_TIMEOUT
    );
  });

  describe('Heartbeat', () => {
    it(
      'should receive ping from server',
      async () => {
        const hasPing = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${BACKEND_WS}?tenant_id=${TENANT_ID}`);
          const timer = setTimeout(() => {
            ws.close();
            resolve(false);
          }, 8000);

          ws.on('message', data => {
            const msg = JSON.parse(data);
            if (msg.type === 'ping') {
              clearTimeout(timer);
              ws.close();
              resolve(true);
            }
          });

          ws.on('error', e => {
            clearTimeout(timer);
            reject(e);
          });
        });

        expect(hasPing).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should keep connection alive by replying pong',
      async () => {
        const pingCount = await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${BACKEND_WS}?tenant_id=${TENANT_ID}`);
          let pings = 0;
          const timer = setTimeout(() => {
            ws.close();
            resolve(pings);
          }, 8000);

          ws.on('message', data => {
            const msg = JSON.parse(data);
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
              pings++;
            }
          });

          ws.on('error', e => {
            clearTimeout(timer);
            reject(e);
          });
        });

        expect(pingCount).toBeGreaterThanOrEqual(1);
      },
      TEST_TIMEOUT
    );
  });

  describe('Protocol', () => {
    it(
      'should handle error messages gracefully',
      async () => {
        const messages = await new Promise((resolve, reject) => {
          const ws = new WebSocket(
            `${BACKEND_WS}?tenant_id=${TENANT_ID}&session_id=invalid-expired-session`
          );
          const msgs = [];
          const timer = setTimeout(() => {
            ws.close();
            resolve(msgs);
          }, 5000);

          ws.on('message', data => {
            const msg = JSON.parse(data);
            msgs.push(msg);
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
            }
          });

          ws.on('error', e => {
            clearTimeout(timer);
            reject(e);
          });
        });

        // Should get at least ping, may also get error about session
        expect(messages.length).toBeGreaterThan(0);
        expect(messages.some(m => m.type === 'ping')).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describe('ReliableWebSocketClient', () => {
    it(
      'should connect using our client library',
      async () => {
        const { ReliableWebSocketClient } = await import('../../lib/websocket/reliable-client.js');

        const client = new ReliableWebSocketClient(BACKEND_WS, {
          tenantId: TENANT_ID,
          reconnectMaxAttempts: 0,
        });

        const connected = await new Promise((resolve, _reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            resolve(null);
          }, 8000);

          client.on('connected', data => {
            clearTimeout(timer);
            resolve(data);
          });

          client.on('error', _data => {
            // Don't reject on error, wait for connected or timeout
          });

          client.connect();
        });

        expect(connected).not.toBeNull();
        expect(connected.sessionId).toBeTruthy();
        expect(connected.tenantId).toBe(TENANT_ID);

        client.disconnect();
      },
      TEST_TIMEOUT
    );

    it(
      'should track connection state correctly',
      async () => {
        const { ReliableWebSocketClient } = await import('../../lib/websocket/reliable-client.js');
        const { WebSocketState } = await import('../../lib/websocket/state-manager.js');

        const client = new ReliableWebSocketClient(BACKEND_WS, {
          tenantId: TENANT_ID,
          reconnectMaxAttempts: 0,
        });

        expect(client.getState()).toBe(WebSocketState.CLOSED);

        await new Promise((resolve, _reject) => {
          const timer = setTimeout(() => {
            client.disconnect();
            resolve();
          }, 5000);

          client.on('connected', () => {
            expect(client.getState()).toBe(WebSocketState.CONNECTED);
            clearTimeout(timer);
            resolve();
          });

          client.connect();
        });

        client.disconnect();
        expect(client.getState()).toBe(WebSocketState.CLOSED);
      },
      TEST_TIMEOUT
    );
  });
};

if (_backendUp) {
  describe('WebSocket Integration Tests', () => {
    jest.setTimeout(60000);
    runTests();
  });
} else {
  describe.skip('WebSocket Integration Tests (backend unavailable)', runTests);
}
