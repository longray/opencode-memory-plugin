import pino from 'pino';
import fs from 'fs';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_FILE = path.join(
  process.env.HOME || process.env.USERPROFILE,
  '.opencode',
  'memory',
  'memory.log'
);

const SENSITIVE_KEYS = new Set([
  'wrapper_meili_api_key',
  'authorization',
  'api_key',
  'apikey',
  'token',
  'password',
  'secret',
  'credential',
  'private_key',
  'access_token',
]);

/**
 * Redact sensitive fields from an object (headers, auth keys, etc.)
 * Used by file-based writeLog to prevent leaking secrets to disk.
 */
export function redactSensitive(data) {
  if (!data || typeof data !== 'object') return data;
  const redacted = { ...data };
  for (const key of Object.keys(redacted)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    }
    if (key === 'headers' && typeof redacted[key] === 'object') {
      const headers = { ...redacted[key] };
      for (const h of Object.keys(headers)) {
        if (SENSITIVE_KEYS.has(h.toLowerCase())) headers[h] = '[REDACTED]';
      }
      redacted[key] = headers;
    }
  }
  return redacted;
}

/**
 * Append a log line to memory.log (file-based logging for WrapperClient).
 * Falls back to console.log if file write fails.
 */
export function writeLog(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const safeData = level === 'DEBUG' ? null : redactSensitive(data);
  const logLine = `[${timestamp}] [${level}] [${category}] ${message}${safeData ? ' ' + JSON.stringify(safeData) : ''}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch {
    console.log(logLine.trim());
  }
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: label => ({ level: label }),
  },
  base: {
    service: 'opencode-memory-plugin',
    version: '2.9.1',
  },
});

export const logInfo = (component, message, meta = {}) => {
  logger.info({ component, ...meta }, message);
};

export const logWarn = (component, message, meta = {}) => {
  logger.warn({ component, ...meta }, message);
};

export const logError = (component, message, error, meta = {}) => {
  logger.error(
    {
      component,
      error: error?.message || error,
      stack: error?.stack,
      ...meta,
    },
    message
  );
};

export const logDebug = (component, message, meta = {}) => {
  logger.debug({ component, ...meta }, message);
};

export { logger };
export default logger;
