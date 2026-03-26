import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;

export const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
export const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
export const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');
export const TIMELINE_DIR = path.join(MEMORY_DIR, 'timeline');
export const ACTIVE_DIR = path.join(MEMORY_DIR, 'active');
export const SYNC_DIR = path.join(MEMORY_DIR, '.sync');
export const CHECKPOINT_FILE = path.join(SYNC_DIR, 'checkpoint.jsonl');
export const LINK_MAP_FILE = path.join(MEMORY_DIR, 'link-map.json');
export const LOG_FILE = path.join(MEMORY_DIR, 'memory.log');
