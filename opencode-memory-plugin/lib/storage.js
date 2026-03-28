import fs from 'fs';
import path from 'path';
import { MEMORY_DIR, LINK_MAP_FILE } from './constants.js';

export function getConfig() {
  try {
    const configPath = path.join(MEMORY_DIR, 'memory-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // ignore
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
  } catch {
    return { version: '2.4.0', entries: {} };
  }
}

export function getEntryById(entryId) {
  try {
    const linkMap = getLinkMap();
    const entry = linkMap.entries[entryId];
    if (!entry) return null;

    const filePath = path.join(MEMORY_DIR, entry.path);
    if (!fs.existsSync(filePath)) return null;

    return {
      ...entry,
      path: filePath,
      content: fs.readFileSync(filePath, 'utf-8'),
    };
  } catch {
    return null;
  }
}

export function deleteEntryFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
