import { randomUUID } from 'crypto';
import { WS_ACK_TIMEOUT_MS } from '../constants.js';

export class AckManager {
  constructor(options = {}) {
    this.defaultTimeout = options.timeout || WS_ACK_TIMEOUT_MS;
    this.defaultMaxRetries = options.maxRetries || 3;
    this.pendingAcks = new Map();
    this.retryTimers = new Map();
  }

  // NOTE: sendWithAck uses internal _msgId protocol for client-initiated messages.
  // Server-initiated change messages use seq-based ACK (handled in reliable-client.js handleMessage).
  sendWithAck(ws, message, timeout = this.defaultTimeout, maxRetries = this.defaultMaxRetries) {
    return new Promise((resolve, reject) => {
      const msgId = randomUUID();
      const messageWithId = {
        ...message,
        _msgId: msgId,
        _requiresAck: true,
        timestamp: Date.now(),
      };

      const pendingAck = {
        msgId,
        message: messageWithId,
        resolve,
        reject,
        retries: 0,
        maxRetries,
        timeout,
        sentAt: Date.now(),
      };

      this.pendingAcks.set(msgId, pendingAck);

      const sendAndScheduleRetry = () => {
        if (!ws || ws.readyState !== 1) {
          this.pendingAcks.delete(msgId);
          reject(new Error('WebSocket not connected'));
          return;
        }

        try {
          ws.send(JSON.stringify(messageWithId));
        } catch (error) {
          this.pendingAcks.delete(msgId);
          reject(error);
          return;
        }

        const timer = setTimeout(() => {
          this.handleTimeout(msgId, ws, sendAndScheduleRetry);
        }, timeout);

        this.retryTimers.set(msgId, timer);
      };

      sendAndScheduleRetry();
    });
  }

  handleTimeout(msgId, ws, retryFn) {
    const pending = this.pendingAcks.get(msgId);
    if (!pending) {
      return;
    }

    this.retryTimers.delete(msgId);

    pending.retries++;

    if (pending.retries > pending.maxRetries) {
      this.pendingAcks.delete(msgId);
      pending.reject(new Error(`ACK timeout after ${pending.maxRetries} retries`));
      return;
    }

    retryFn();
  }

  onAckReceived(ackId) {
    const pending = this.pendingAcks.get(ackId);
    if (!pending) {
      return false;
    }

    const timer = this.retryTimers.get(ackId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(ackId);
    }

    this.pendingAcks.delete(ackId);
    pending.resolve({
      msgId: ackId,
      receivedAt: Date.now(),
      retries: pending.retries,
    });

    return true;
  }

  clearAll() {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    const pendingList = Array.from(this.pendingAcks.values());
    this.pendingAcks.clear();

    pendingList.forEach(pending => {
      try {
        pending.reject(new Error('ACK manager cleared'));
      } catch {
        // Promise may already be settled — reject() on settled promise is a no-op
      }
    });
  }

  getPendingCount() {
    return this.pendingAcks.size;
  }

  getStats() {
    return {
      pendingCount: this.pendingAcks.size,
      pendingIds: Array.from(this.pendingAcks.keys()),
    };
  }
}

export default { AckManager };
