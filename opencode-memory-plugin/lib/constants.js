import path from 'path';
import os from 'os';

const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir() || '.';
const BASE_DIR = process.env.MEMORY_DIR || path.join(HOME, '.opencode', 'memory');

export const MEMORY_DIR = BASE_DIR;
export const MEMORY_FILE = path.join(BASE_DIR, 'MEMORY.md');
export const CONFIG_FILE = path.join(BASE_DIR, 'memory-config.json');
export const TIMELINE_DIR = path.join(BASE_DIR, 'timeline');
export const ACTIVE_DIR = path.join(BASE_DIR, 'active');
export const SYNC_DIR = path.join(BASE_DIR, '.sync');
export const CHECKPOINT_FILE = path.join(SYNC_DIR, 'checkpoint.jsonl');
export const LINK_MAP_FILE = path.join(BASE_DIR, 'link-map.json');
export const LOG_FILE = path.join(BASE_DIR, 'memory.log');
export const LINK_MAP_VERSION = '2.4.0';

// ─── Timeout / TTL Defaults ────────────────────────────────────────────────────
// Centralised so every module references the same values instead of magic numbers.

/** HTTP request timeout (ms) — used by WrapperClient / HTTPClient */
export const DEFAULT_HTTP_TIMEOUT_MS = 30_000;

/** Retry base delay (ms) — exponential backoff starting point */
export const RETRY_BASE_DELAY_MS = 1_000;

/** General-purpose cache TTL (ms) — git-remote cache, trie-index, etc. */
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Git subprocess timeout (ms) — execSync calls for git remote / rev-parse */
export const GIT_COMMAND_TIMEOUT_MS = 5_000;

/** Debounce interval (ms) — memory-id-cache persist, file-watcher, etc. */
export const DEBOUNCE_SAVE_MS = 1_000;

/** Background sync interval (ms) — periodic full-sync cadence */
export const SYNC_INTERVAL_MS = 300_000; // 5 minutes

/** Analysis queue timeout (ms) — how long a queued file waits before being dropped */
export const QUEUE_TIMEOUT_MS = 5_000;

/** Queue poll delay (ms) — retry interval when concurrent slots are full */
export const QUEUE_POLL_DELAY_MS = 100;

/** Default debounce interval (ms) — file-watcher, code-analysis debounce fallback */
export const DEFAULT_DEBOUNCE_MS = 300;

/** Default batch flush delay (ms) — code-analysis batch upload cadence fallback */
export const DEFAULT_BATCH_DELAY_MS = 2_000;

/** Default file analysis timeout (ms) — per-file AST analysis time limit fallback */
export const DEFAULT_FILE_TIMEOUT_MS = 500;

/** Maximum file size (bytes) — used by privacy filter to limit file processing */
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB

/** Maximum length of abstract field — used by memory-core for validation */
export const MAX_ABSTRACT_LENGTH = 100;

/** Maximum length of overview field — used by memory-core for validation */
export const MAX_OVERVIEW_LENGTH = 500;

/** Maximum lines in overview file — used by indexer to limit .overview.md length */
export const MAX_OVERVIEW_LINES = 102;

// ─── API Defaults ──────────────────────────────────────────────────────────────

/** Default API port — used by WrapperClient for backend connection */
export const DEFAULT_API_PORT = 18008;

// ─── WebSocket Defaults ────────────────────────────────────────────────────────

/** Heartbeat interval (ms) — how often the server is expected to ping */
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;

/** Heartbeat timeout (ms) — max wait for a server ping before reconnect */
export const WS_HEARTBEAT_TIMEOUT_MS = 5_000;

/** ACK timeout (ms) — max wait for an acknowledgement before retry */
export const WS_ACK_TIMEOUT_MS = 5_000;

/** Reconnect base delay (ms) — exponential backoff starting point */
export const WS_RECONNECT_BASE_DELAY_MS = 1_000;

/** Reconnect max delay (ms) — cap for exponential backoff */
export const WS_RECONNECT_MAX_DELAY_MS = 300_000; // 5 minutes

/** Reconnect jitter (ms) — random component added to delay to avoid thundering herd */
export const WS_RECONNECT_JITTER_MS = 1_000;

/**
 * Validates that a resolved path stays within the base directory.
 * Prevents path traversal via "../" in user-controlled path segments.
 */
export function resolveSafePath(baseDir, relativePath) {
  const resolved = path.resolve(baseDir, relativePath);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error(`Path traversal detected: ${relativePath} escapes ${baseDir}`);
  }
  return resolved;
}
