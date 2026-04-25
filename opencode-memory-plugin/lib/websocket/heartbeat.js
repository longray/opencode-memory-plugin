/**
 * WebSocket Heartbeat Manager
 * Passive mode: monitors server pings instead of sending client pings.
 * If no server ping received within timeout × maxMissed, triggers reconnect.
 */

export class HeartbeatManager {
  constructor(options = {}) {
    this.interval = options.interval || 30000;
    this.maxMissed = options.maxMissed || 2;

    this.missedCount = 0;
    this.isRunning = false;
    this.lastPingTime = null;
    this.monitorTimer = null;

    this.onPongTimeout = null;
  }

  start(_onPing, onPongTimeout) {
    if (this.isRunning) {
      return;
    }

    this.onPongTimeout = onPongTimeout;
    this.isRunning = true;
    this.missedCount = 0;

    this.scheduleMonitor();
  }

  stop() {
    this.isRunning = false;
    if (this.monitorTimer) {
      clearTimeout(this.monitorTimer);
      this.monitorTimer = null;
    }
    this.onPongTimeout = null;
  }

  onServerPing() {
    this.missedCount = 0;
    this.lastPingTime = Date.now();
    this.scheduleMonitor();
  }

  scheduleMonitor() {
    if (!this.isRunning) {
      return;
    }

    if (this.monitorTimer) {
      clearTimeout(this.monitorTimer);
    }

    const checkInterval = this.interval;
    this.monitorTimer = setTimeout(() => {
      this.missedCount++;
      if (this.missedCount >= this.maxMissed) {
        this.onPongTimeout?.();
        this.stop();
      } else {
        this.scheduleMonitor();
      }
    }, checkInterval);
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      missedCount: this.missedCount,
      lastPingTime: this.lastPingTime,
      interval: this.interval,
    };
  }
}

export default { HeartbeatManager };
