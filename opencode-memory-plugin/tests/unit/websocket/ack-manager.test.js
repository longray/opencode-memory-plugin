import { describe, it, expect, jest } from '@jest/globals';
import { AckManager } from '../../../lib/websocket/ack-manager.js';

describe('AckManager', () => {
  let ackManager;
  let mockWs;

  beforeEach(() => {
    ackManager = new AckManager({ timeout: 100, maxRetries: 2 });
    mockWs = {
      readyState: 1,
      send: jest.fn(),
    };
  });

  afterEach(async () => {
    ackManager.pendingAcks.clear();
    ackManager.retryTimers.clear();
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultAck = new AckManager();
      expect(defaultAck.defaultTimeout).toBe(5000);
      expect(defaultAck.defaultMaxRetries).toBe(3);
    });

    it('should create instance with custom options', () => {
      expect(ackManager.defaultTimeout).toBe(100);
      expect(ackManager.defaultMaxRetries).toBe(2);
    });
  });

  describe('sendWithAck', () => {
    it('should reject when WebSocket not connected', async () => {
      mockWs.readyState = 0;
      await expect(ackManager.sendWithAck(mockWs, { type: 'test' })).rejects.toThrow(
        'WebSocket not connected'
      );
    });

    it('should send message with _msgId and _requiresAck', async () => {
      const promise = ackManager.sendWithAck(mockWs, { type: 'test', data: 'hello' });

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage._msgId).toBeDefined();
      expect(sentMessage._requiresAck).toBe(true);
      expect(sentMessage.type).toBe('test');
      expect(sentMessage.data).toBe('hello');

      ackManager.onAckReceived(sentMessage._msgId);
      await promise;
    });

    it('should resolve when ACK received', async () => {
      const promise = ackManager.sendWithAck(mockWs, { type: 'test' });

      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      const msgId = sentMessage._msgId;

      setTimeout(() => {
        ackManager.onAckReceived(msgId);
      }, 10);

      const result = await promise;
      expect(result.msgId).toBe(msgId);
      expect(result.retries).toBe(0);
    });

    it('should retry on timeout', async () => {
      const promise = ackManager.sendWithAck(mockWs, { type: 'test' });

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockWs.send).toHaveBeenCalledTimes(2);

      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      ackManager.onAckReceived(sentMessage._msgId);

      const result = await promise;
      expect(result.retries).toBe(1);
    });

    it('should reject after max retries', async () => {
      await expect(async () => {
        await ackManager.sendWithAck(mockWs, { type: 'test' });
      }).rejects.toThrow('ACK timeout after 2 retries');
    }, 10000);
  });

  describe('onAckReceived', () => {
    it('should return false for unknown ACK', () => {
      const result = ackManager.onAckReceived('unknown-id');
      expect(result).toBe(false);
    });

    it('should return true for valid ACK', () => {
      ackManager.sendWithAck(mockWs, { type: 'test' });
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);

      const result = ackManager.onAckReceived(sentMessage._msgId);
      expect(result).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all pending ACKs and reject them', async () => {
      const promise1 = ackManager.sendWithAck(mockWs, { type: 'test1' });
      const promise2 = ackManager.sendWithAck(mockWs, { type: 'test2' });

      ackManager.clearAll();

      await expect(promise1).rejects.toThrow('ACK manager cleared');
      await expect(promise2).rejects.toThrow('ACK manager cleared');
      expect(ackManager.getPendingCount()).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      ackManager.sendWithAck(mockWs, { type: 'test' });

      const stats = ackManager.getStats();
      expect(stats.pendingCount).toBe(1);
      expect(stats.pendingIds).toHaveLength(1);
    });
  });
});
