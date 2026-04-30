import path from 'path';
import fs from 'fs';
import os from 'os';

export function createMockConstants(tempDir) {
  return {
    MEMORY_DIR: tempDir,
    MEMORY_FILE: path.join(tempDir, 'MEMORY.md'),
    CONFIG_FILE: path.join(tempDir, 'memory-config.json'),
    TIMELINE_DIR: path.join(tempDir, 'timeline'),
    ACTIVE_DIR: path.join(tempDir, 'active'),
    SYNC_DIR: path.join(tempDir, '.sync'),
    CHECKPOINT_FILE: path.join(tempDir, '.sync', 'checkpoint.jsonl'),
    LINK_MAP_FILE: path.join(tempDir, 'link-map.json'),
    LOG_FILE: path.join(tempDir, 'memory.log'),
    LINK_MAP_VERSION: '2.4.0',
    DEFAULT_HTTP_TIMEOUT_MS: 30000,
    RETRY_BASE_DELAY_MS: 1000,
    CACHE_TTL_MS: 300000,
    GIT_COMMAND_TIMEOUT_MS: 5000,
    DEBOUNCE_SAVE_MS: 1000,
    SYNC_INTERVAL_MS: 300000,
    QUEUE_TIMEOUT_MS: 5000,
    QUEUE_POLL_DELAY_MS: 100,
    DEFAULT_DEBOUNCE_MS: 300,
    DEFAULT_BATCH_DELAY_MS: 2000,
    DEFAULT_FILE_TIMEOUT_MS: 500,
    MAX_FILE_SIZE: 1048576,
    MAX_ABSTRACT_LENGTH: 100,
    MAX_OVERVIEW_LENGTH: 500,
    MAX_OVERVIEW_LINES: 102,
    DEFAULT_API_PORT: 18008,
    WS_HEARTBEAT_INTERVAL_MS: 30000,
    WS_HEARTBEAT_TIMEOUT_MS: 5000,
    WS_ACK_TIMEOUT_MS: 5000,
    WS_RECONNECT_BASE_DELAY_MS: 1000,
    WS_RECONNECT_MAX_DELAY_MS: 300000,
    WS_RECONNECT_JITTER_MS: 1000,
    resolveSafePath: (baseDir, relativePath) => {
      const resolved = path.resolve(baseDir, relativePath);
      const normalizedBase = path.resolve(baseDir);
      if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
        throw new Error(`Path traversal detected: ${relativePath} escapes ${baseDir}`);
      }
      return resolved;
    },
  };
}

export function setupTestTempDir(prefix) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const now = new Date();
  const timelineDir = path.join(
    tempDir,
    'timeline',
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  );
  fs.mkdirSync(timelineDir, { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'active'), { recursive: true });
  fs.mkdirSync(path.join(tempDir, '.sync'), { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'MEMORY.md'), '# Memory Index\n\n');
  fs.writeFileSync(path.join(tempDir, 'link-map.json'), JSON.stringify({ version: '2.4.0', entries: {} }, null, 2));
  return tempDir;
}
