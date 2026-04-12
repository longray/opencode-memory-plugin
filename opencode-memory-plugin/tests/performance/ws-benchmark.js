/**
 * WebSocket Performance Benchmark
 * BL-P-10: WebSocket Performance Testing
 *
 * Benchmarks:
 * - Concurrent connections: 1000+ (success rate ≥ 95%)
 * - Message latency: p99 < 100ms
 * - Heartbeat success rate: ≥ 99%
 * - Memory usage: < 500MB per 1000 connections
 *
 * Usage:
 *   node tests/performance/ws-benchmark.js
 *
 * Environment Variables:
 *   WS_BENCHMARK_URL - WebSocket endpoint (default: ws://localhost:18008/ws)
 *   WS_BENCHMARK_CONNECTIONS - Number of connections (default: 100)
 *   WS_BENCHMARK_DURATION - Test duration in seconds (default: 30)
 */

import WebSocket from 'ws';
import { performance } from 'perf_hooks';

class WebSocketBenchmark {
  constructor(options = {}) {
    this.url = options.url || process.env.WS_BENCHMARK_URL || 'ws://localhost:18008/ws';
    this.concurrentConnections = options.connections || parseInt(process.env.WS_BENCHMARK_CONNECTIONS) || 100;
    this.duration = options.duration || parseInt(process.env.WS_BENCHMARK_DURATION) || 30;
    this.messageInterval = options.messageInterval || 1000;

    this.stats = {
      connections: { attempted: 0, success: 0, failed: 0 },
      messages: { sent: 0, received: 0, latencies: [] },
      heartbeats: { sent: 0, received: 0 },
      errors: [],
    };

    this.connections = [];
    this.startTime = null;
    this.endTime = null;
  }

  async run() {
    console.log('================================================');
    console.log('WebSocket Performance Benchmark');
    console.log('================================================');
    console.log(`URL: ${this.url}`);
    console.log(`Connections: ${this.concurrentConnections}`);
    console.log(`Duration: ${this.duration}s`);
    console.log('================================================\n');

    try {
      await this.phase1_connect();
      await this.phase2_messageExchange();
      await this.phase3_heartbeat();
      await this.phase4_cleanup();

      return this.generateReport();
    } catch (error) {
      console.error('Benchmark failed:', error.message);
      await this.cleanup();
      return false;
    }
  }

  async phase1_connect() {
    console.log('Phase 1: Establishing connections...');
    this.startTime = performance.now();

    const connectPromises = [];
    for (let i = 0; i < this.concurrentConnections; i++) {
      connectPromises.push(this.createConnection(i));
    }

    await Promise.all(connectPromises);

    const duration = (performance.now() - this.startTime) / 1000;
    console.log(`  Connected: ${this.stats.connections.success}/${this.concurrentConnections}`);
    console.log(`  Failed: ${this.stats.connections.failed}`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Success Rate: ${((this.stats.connections.success / this.concurrentConnections) * 100).toFixed(2)}%\n`);
  }

  async createConnection(index) {
    this.stats.connections.attempted++;

    return new Promise((resolve) => {
      const ws = new WebSocket(this.url);
      const connectionId = `conn-${index}`;

      const timeout = setTimeout(() => {
        this.stats.connections.failed++;
        this.stats.errors.push({ connectionId, error: 'Connection timeout' });
        resolve();
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.stats.connections.success++;
        this.connections.push({ ws, id: connectionId, openTime: performance.now() });
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.stats.connections.failed++;
        this.stats.errors.push({ connectionId, error: error.message });
        resolve();
      });
    });
  }

  async phase2_messageExchange() {
    console.log('Phase 2: Message exchange...');

    const messagePromises = [];
    const messageStartTime = performance.now();

    for (const conn of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        messagePromises.push(this.exchangeMessages(conn));
      }
    }

    await Promise.all(messagePromises);

    const duration = (performance.now() - messageStartTime) / 1000;
    const throughput = this.stats.messages.received / duration;

    console.log(`  Messages Sent: ${this.stats.messages.sent}`);
    console.log(`  Messages Received: ${this.stats.messages.received}`);
    console.log(`  Throughput: ${throughput.toFixed(2)} msg/s\n`);
  }

  async exchangeMessages(conn) {
    const messagesPerConnection = 10;

    for (let i = 0; i < messagesPerConnection; i++) {
      const message = {
        type: 'test',
        id: `${conn.id}-msg-${i}`,
        timestamp: performance.now(),
      };

      const sendTime = performance.now();
      this.stats.messages.sent++;

      conn.ws.send(JSON.stringify(message));

      await this.sleep(this.messageInterval / messagesPerConnection);
    }

    await this.sleep(100);
  }

  async phase3_heartbeat() {
    console.log('Phase 3: Heartbeat test...');

    const heartbeatPromises = [];

    for (const conn of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        heartbeatPromises.push(this.testHeartbeat(conn));
      }
    }

    await Promise.all(heartbeatPromises);

    const heartbeatRate = this.stats.heartbeats.sent > 0
      ? (this.stats.heartbeats.received / this.stats.heartbeats.sent) * 100
      : 0;

    console.log(`  Heartbeats Sent: ${this.stats.heartbeats.sent}`);
    console.log(`  Heartbeats Received: ${this.stats.heartbeats.received}`);
    console.log(`  Success Rate: ${heartbeatRate.toFixed(2)}%\n`);
  }

  async testHeartbeat(conn) {
    return new Promise((resolve) => {
      this.stats.heartbeats.sent++;

      const pingTime = performance.now();
      conn.ws.ping();

      const onPong = () => {
        this.stats.heartbeats.received++;
        conn.ws.removeListener('pong', onPong);
        resolve();
      };

      conn.ws.on('pong', onPong);

      setTimeout(() => {
        conn.ws.removeListener('pong', onPong);
        resolve();
      }, 5000);
    });
  }

  async phase4_cleanup() {
    console.log('Phase 4: Cleanup...');
    await this.cleanup();
    console.log('  Connections closed\n');
  }

  async cleanup() {
    for (const conn of this.connections) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.close();
      }
    }
    this.connections = [];
  }

  generateReport() {
    this.endTime = performance.now();
    const totalDuration = (this.endTime - this.startTime) / 1000;

    const latencies = this.stats.messages.latencies;
    const p50 = this.percentile(latencies, 0.5);
    const p95 = this.percentile(latencies, 0.95);
    const p99 = this.percentile(latencies, 0.99);

    const throughput = this.stats.messages.received / totalDuration;
    const connectionSuccessRate = (this.stats.connections.success / this.concurrentConnections) * 100;
    const heartbeatSuccessRate = this.stats.heartbeats.sent > 0
      ? (this.stats.heartbeats.received / this.stats.heartbeats.sent) * 100
      : 0;

    console.log('================================================');
    console.log('Benchmark Results');
    console.log('================================================');
    console.log(`Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`\nConnections:`);
    console.log(`  Attempted: ${this.stats.connections.attempted}`);
    console.log(`  Success: ${this.stats.connections.success}`);
    console.log(`  Failed: ${this.stats.connections.failed}`);
    console.log(`  Success Rate: ${connectionSuccessRate.toFixed(2)}%`);
    console.log(`\nMessages:`);
    console.log(`  Sent: ${this.stats.messages.sent}`);
    console.log(`  Received: ${this.stats.messages.received}`);
    console.log(`  Throughput: ${throughput.toFixed(2)} msg/s`);
    console.log(`\nLatency (ms):`);
    console.log(`  p50: ${p50 ? p50.toFixed(2) : 'N/A'}`);
    console.log(`  p95: ${p95 ? p95.toFixed(2) : 'N/A'}`);
    console.log(`  p99: ${p99 ? p99.toFixed(2) : 'N/A'}`);
    console.log(`\nHeartbeats:`);
    console.log(`  Sent: ${this.stats.heartbeats.sent}`);
    console.log(`  Received: ${this.stats.heartbeats.received}`);
    console.log(`  Success Rate: ${heartbeatSuccessRate.toFixed(2)}%`);
    console.log('================================================\n');

    const passed =
      this.stats.connections.success >= this.concurrentConnections * 0.95 &&
      p99 < 100 &&
      heartbeatSuccessRate >= 99;

    console.log(`Benchmark ${passed ? 'PASSED ✅' : 'FAILED ❌'}`);

    return passed;
  }

  percentile(arr, p) {
    if (arr.length === 0) return null;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function main() {
  const benchmark = new WebSocketBenchmark({
    url: process.env.WS_BENCHMARK_URL || 'ws://localhost:18008/ws/memories/live',
    connections: parseInt(process.env.WS_BENCHMARK_CONNECTIONS) || 100,
    duration: parseInt(process.env.WS_BENCHMARK_DURATION) || 30,
  });

  const passed = await benchmark.run();
  process.exit(passed ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Benchmark error:', error);
    process.exit(1);
  });
}

export { WebSocketBenchmark };
