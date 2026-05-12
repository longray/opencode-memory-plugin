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

/** Recommended length of abstract field — used by memory-core for validation guidance */
export const RECOMMENDED_ABSTRACT_LENGTH = 100;

/** Recommended length of overview field — used by memory-core for validation guidance */
export const RECOMMENDED_OVERVIEW_LENGTH = 500;

// Backward compatibility aliases (deprecated, use RECOMMENDED_* instead)
export const MAX_ABSTRACT_LENGTH = RECOMMENDED_ABSTRACT_LENGTH;
export const MAX_OVERVIEW_LENGTH = RECOMMENDED_OVERVIEW_LENGTH;

/** Maximum lines in overview file — used by indexer to limit .overview.md length */
export const MAX_OVERVIEW_LINES = 102;

// ─── Scheduled Health Check Defaults ────────────────────────────────────────

/** Health check enabled by default */
export const HEALTH_CHECK_ENABLED = true;

/** Default schedule: daily at 9 AM (cron format) */
export const HEALTH_CHECK_SCHEDULE = '0 9 * * *';

/** Default health score threshold (below this triggers warning) */
export const HEALTH_CHECK_THRESHOLD = 80;

/** Default network density threshold (below this triggers warning) */
export const HEALTH_CHECK_DENSITY_THRESHOLD = 0.02;

/** Default orphan rate threshold (above this triggers warning) */
export const HEALTH_CHECK_ORPHAN_RATE_THRESHOLD = 0.2;

/** Health check execution timeout (ms) */
export const HEALTH_CHECK_TIMEOUT_MS = 60_000;

/** Reports directory relative to HOME */
export const REPORTS_DIR_NAME = 'reports';

export const REPORTS_DIR = path.join(HOME, '.opencode', REPORTS_DIR_NAME);

// ─── Dual Threshold Recommendation Defaults ─────────────────────────────────

/** Similarity threshold for auto-creating relations (>= this value) */
export const RECOMMENDATION_AUTO_CREATE_THRESHOLD = 0.85;

/** Similarity threshold for pending review (>= this value, < auto_create) */
export const RECOMMENDATION_REVIEW_THRESHOLD = 0.75;

/** Auto-create enabled by default */
export const RECOMMENDATION_AUTO_CREATE_ENABLED = true;

/** Pending review queue expiry days */
export const RECOMMENDATION_QUEUE_EXPIRY_DAYS = 7;

/** Pending review queue filename */
export const PENDING_REVIEW_QUEUE_FILE = 'pending-review-queue.json';

// ─── Quality Dashboard Defaults ──────────────────────────────────────────────

/** Quality check timeout (ms) — lightweight checks should complete within this */
export const QUALITY_CHECK_TIMEOUT_MS = 100;

/** Auto-refresh interval for dashboard (ms) */
export const DASHBOARD_REFRESH_INTERVAL_MS = 60_000;

/** Quality metrics retention period (days) */
export const QUALITY_METRICS_RETENTION_DAYS = 90;

/** Fix history retention count */
export const FIX_HISTORY_MAX_ENTRIES = 10;

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

// ─── Language / Extension Configuration ─────────────────────────────────────────

/** Map of file extension to language name — single source of truth for all modules */
export const EXTENSION_TO_LANGUAGE = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
};

/** Supported file extensions — derived from EXTENSION_TO_LANGUAGE */
export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_TO_LANGUAGE);

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
