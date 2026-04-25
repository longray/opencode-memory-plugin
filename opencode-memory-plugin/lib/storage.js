import fs from 'fs';
import path from 'path';
import { MEMORY_DIR, LINK_MAP_FILE, resolveSafePath } from './constants.js';

export function getConfig() {
  try {
    const configPath = path.join(MEMORY_DIR, 'memory-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    console.warn(`[storage] Failed to read config: ${error.message}`);
  }
  return {};
}

export function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

export function getLinkMap() {
  if (!fs.existsSync(LINK_MAP_FILE)) {
    return { version: '2.4.0', entries: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
  } catch (error) {
    console.warn(`[storage] Failed to parse link-map: ${error.message}`);
    return { version: '2.4.0', entries: {} };
  }
}

export function getEntryById(entryId) {
  try {
    const linkMap = getLinkMap();
    const entry = linkMap.entries[entryId];
    if (!entry) return null;

    const filePath = resolveSafePath(MEMORY_DIR, entry.path);
    if (!fs.existsSync(filePath)) return null;

    return {
      ...entry,
      path: filePath,
      content: fs.readFileSync(filePath, 'utf-8'),
    };
  } catch (error) {
    console.warn(`[storage] Failed to read entry ${entryId}: ${error.message}`);
    return null;
  }
}

export function deleteEntryFile(filePath) {
  const safePath = resolveSafePath(MEMORY_DIR, filePath);
  if (fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
  }
}

export function resolveTenantId(config) {
  return (
    config?.backend?.tenant_id || process.env.MEMORY_TENANT_ID || process.env.USERNAME || 'default'
  );
}
