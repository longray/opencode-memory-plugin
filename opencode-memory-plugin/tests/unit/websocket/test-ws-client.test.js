/**
 * Test Suite - WebSocket Client Module
 * Tests for SyncWebSocketClient class
 */

import { describe, it, expect } from '@jest/globals';
import { SyncWebSocketClient } from '../../../lib/ws-client.js';

describe('WebSocket Client Module', () => {
  describe('SyncWebSocketClient class', () => {
    it('should be a constructor function', () => {
      expect(typeof SyncWebSocketClient).toBe('function');
    });

    it('should create an instance with default tenant', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080');

      expect(client).toBeDefined();
      expect(client.url).toBe('ws://localhost:8080');
      expect(client.tenantId).toBe('default');
    });

    it('should create an instance with custom tenant', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080', 'test-tenant');

      expect(client.tenantId).toBe('test-tenant');
    });

    it('should have connect method', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080');

      expect(typeof client.connect).toBe('function');
    });

    it('should have disconnect method', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080');

      expect(typeof client.disconnect).toBe('function');
    });

    it('should have send method', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080');

      expect(typeof client.send).toBe('function');
    });

    it('should have isConnected property', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080');

      expect(client.isConnected).toBe(false);
    });

    it('should have messageQueue property', () => {
      const client = new SyncWebSocketClient('ws://localhost:8080');

      expect(Array.isArray(client.messageQueue)).toBe(true);
    });
  });
});
