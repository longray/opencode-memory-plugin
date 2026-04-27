import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_RECONNECT_BASE_DELAY_MS,
  SYNC_INTERVAL_MS,
} from './constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');

const envPaths = [join(rootDir, '.env'), join(rootDir, '.env.local'), join(process.cwd(), '.env')];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const config = {
  api: {
    port: parseInt(process.env.API_PORT || '18008', 10),
    host: process.env.API_HOST || 'localhost',
    url: process.env.MEMORY_BACKEND_URL || `http://localhost:${process.env.API_PORT || '18008'}`,
  },
  websocket: {
    enabled: process.env.WS_ENABLED !== 'false',
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || String(WS_HEARTBEAT_INTERVAL_MS), 10),
    reconnectMaxAttempts: parseInt(process.env.WS_RECONNECT_MAX_ATTEMPTS || '10', 10),
    reconnectBaseDelay: parseInt(process.env.WS_RECONNECT_BASE_DELAY || String(WS_RECONNECT_BASE_DELAY_MS), 10),
  },
  log: {
    level: process.env.LOG_LEVEL || 'info',
    pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV !== 'production',
  },
  sync: {
    autoSync: process.env.AUTO_SYNC !== 'false',
    syncInterval: parseInt(process.env.SYNC_INTERVAL || String(SYNC_INTERVAL_MS), 10),
  },
};

export const getConfig = () => config;

export const getApiUrl = () => config.api.url;

export const getWebSocketUrl = () => {
  const { host, port } = config.api;
  return `ws://${host}:${port}/ws/memories/live`;
};

export default config;
