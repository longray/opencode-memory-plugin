/**
 * WebSocket Heartbeat Manager
 * Manages ping/pong heartbeat mechanism
 */

export class HeartbeatManager {
  constructor(options = {}) {
    this.interval = options.interval || 30000;
    this.timeout = options.timeout || 5000;
    this.maxMissed = options.maxMissed || 2;

    this.pingTimer = null;
    this.pongTimer = null;
    this.missedCount = 0;
    this.isRunning = false;
    this.lastPongTime = null;

    this.onPing = null;
    this.onPongTimeout = null;
  }

  start(onPing, onPongTimeout) {
    if (this.isRunning) {
      return;
    }

    this.onPing = onPing;
    this.onPongTimeout = onPongTimeout;
    this.isRunning = true;
    this.missedCount = 0;

    this.schedulePing();
  }

  stop() {
    this.isRunning = false;
    this.clearTimers();
    this.onPing = null;
    this.onPongTimeout = null;
  }

  schedulePing() {
    if (!this.isRunning) {
      return;
    }

    this.pingTimer = setTimeout(() => {
      this.sendPing();
    }, this.interval);
  }

  sendPing() {
    if (!this.isRunning) {
      return;
    }

    this.onPing?.();

    this.pongTimer = setTimeout(() => {
      this.handlePongTimeout();
    }, this.timeout);
  }

  handlePongTimeout() {
    this.missedCount++;

    if (this.missedCount >= this.maxMissed) {
      this.onPongTimeout?.();
      this.stop();
    } else {
      this.schedulePing();
    }
  }

  onPongReceived() {
    this.clearPongTimer();
    this.missedCount = 0;
    this.lastPongTime = Date.now();
    this.schedulePing();
  }

  clearTimers() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    this.clearPongTimer();
  }

  clearPongTimer() {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      missedCount: this.missedCount,
      lastPongTime: this.lastPongTime,
      interval: this.interval,
      timeout: this.timeout,
    };
  }
}

export default { HeartbeatManager };
