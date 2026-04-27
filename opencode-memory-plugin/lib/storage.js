import fs from 'fs';
import path from 'path';
import { MEMORY_DIR, LINK_MAP_FILE, LINK_MAP_VERSION, resolveSafePath } from './constants.js';

let linkMapCache = null;
let linkMapMtime = 0;

/**
 * Invalidates the link map cache, forcing a reload from disk.
 */
export function invalidateLinkMapCache() {
  linkMapCache = null;
  linkMapMtime = 0;
}

/**
 * Gets the configuration from the memory-config.json file.
 * @returns {Object} Configuration object or empty object if not found/error
 */
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

/**
 * Ensures that the memory directory exists, creating it if necessary.
 */
export function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

/**
 * Gets the link map from the link-map.json file, with caching.
 * @returns {Object} Link map object containing version and entries
 */
export function getLinkMap() {
  if (!fs.existsSync(LINK_MAP_FILE)) {
    return { version: LINK_MAP_VERSION, entries: {} };
  }
  try {
    const stat = fs.statSync(LINK_MAP_FILE);
    if (linkMapCache && stat.mtimeMs === linkMapMtime) {
      return linkMapCache;
    }
    linkMapCache = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
    linkMapMtime = stat.mtimeMs;
    return linkMapCache;
  } catch (error) {
    console.warn(`[storage] Failed to parse link-map: ${error.message}`);
    return { version: LINK_MAP_VERSION, entries: {} };
  }
}

/**
 * Gets an entry by its ID from the link map.
 * @param {string} entryId - The ID of the entry to retrieve
 * @returns {Object|null} Entry object with content or null if not found
 */
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

/**
 * Deletes an entry file from the filesystem.
 * @param {string} filePath - Path to the file to delete
 */
export function deleteEntryFile(filePath) {
  const safePath = resolveSafePath(MEMORY_DIR, filePath);
  if (fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
  }
}

/**
 * Resolves the tenant ID from various sources in order of preference.
 * @param {Object} config - Configuration object
 * @returns {string} Tenant ID, defaulting to 'default' if none found
 */
export function resolveTenantId(config) {
  return (
    config?.backend?.tenant_id || process.env.MEMORY_TENANT_ID || process.env.USERNAME || 'default'
  );
}
