import fs from 'fs';
import path from 'path';
import { LINK_MAP_FILE, MEMORY_FILE, MEMORY_DIR, CONFIG_FILE, MAX_OVERVIEW_LINES, LINK_MAP_VERSION } from './constants.js';
import { logDebug } from './logger.js';
import { invalidateLinkMapCache } from './storage.js';
import { atomicWriteText as _atomicWriteText, atomicWriteJson as _atomicWriteJson } from './atomic-write.js';

// Re-export for backward compatibility (tools/core.js, lib/memory-core.js, tests import from here)
export { _atomicWriteText as atomicWriteText };

/**
 * Atomically write JSON file with link-map cache invalidation.
 * @param {string} filePath - Target file path
 * @param {object} data - Data to serialize
 */
export function atomicWriteJson(filePath, data, space = 2) {
  _atomicWriteJson(filePath, data, space);
  if (filePath === LINK_MAP_FILE) {
    invalidateLinkMapCache();
  }
}

let linkMapLock = Promise.resolve();

/**
 * Serialize all link-map mutations to prevent TOCTOU race conditions.
 * Wraps an async operation that reads link-map, modifies it, and writes it back.
 */
export async function withLinkMapLock(fn) {
  await linkMapLock;
  let releaseLock;
  linkMapLock = new Promise(resolve => {
    releaseLock = resolve;
  });
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

export function readJsonSafe(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    logWarn('indexer', `Invalid JSON structure in ${filePath}, resetting`);
    return { version: LINK_MAP_VERSION, entries: {} };
  }
  return parsed;
}

export async function updateDayOverview(dayDir, entry) {
  const overviewPath = path.join(dayDir, '.overview.md');
  const dateStr = path.basename(dayDir);

  let lines = [];
  if (fs.existsSync(overviewPath)) {
    lines = fs.readFileSync(overviewPath, 'utf-8').split('\n');
  } else {
    lines = [`# ${dateStr} 记忆概览\n`];
  }

  const line = `- [${entry.type}] ${entry.abstract.substring(0, 80)} → ${entry.fileName}`;

  const idx = lines.findIndex(l => l.startsWith('- ['));
  if (idx >= 0) {
    lines.splice(idx, 0, line);
  } else {
    lines.push(line);
  }

  if (lines.length > MAX_OVERVIEW_LINES) {
    lines.splice(MAX_OVERVIEW_LINES);
  }

  const count = lines.filter(l => l.startsWith('- [')).length;
  lines[0] = `# ${dateStr} 记忆概览（${count} entries）`;

  atomicWriteText(overviewPath, lines.join('\n'));
}

export async function updateLinkMap(entry, filePath) {
  return withLinkMapLock(() => {
    let linkMap = { version: LINK_MAP_VERSION, entries: {} };

    if (fs.existsSync(LINK_MAP_FILE)) {
      try {
        linkMap = readJsonSafe(LINK_MAP_FILE);
      } catch (e) {
        logDebug('indexer', 'Failed to read link-map, using fresh one', { error: e.message });
      }
    }

    const relativePath = filePath.replace(MEMORY_DIR + path.sep, '').replace(/\\/g, '/');

    linkMap.entries[entry.id] = {
      id: entry.id,
      path: relativePath,
      abstract: entry.abstract,
      overview: entry.overview,
      type: entry.type,
      tags: entry.tags || [],
      pinned: entry.pinned || false,
      synced: entry.synced || false,
      memory_id: entry.memory_id || null,
    };

    atomicWriteJson(LINK_MAP_FILE, linkMap);
  });
}

export async function removeFromLinkMap(localId) {
  return withLinkMapLock(() => {
    if (!fs.existsSync(LINK_MAP_FILE)) return;

    try {
      const linkMap = readJsonSafe(LINK_MAP_FILE);
      if (linkMap.entries && linkMap.entries[localId]) {
        delete linkMap.entries[localId];
        atomicWriteJson(LINK_MAP_FILE, linkMap);
      }
    } catch (e) {
      logDebug('indexer', 'Failed to remove from link-map', { localId, error: e.message });
    }
  });
}

/**
 * 格式化最近条目列表 (BL-101.1)
 *
 * @param {Array} entries - 所有条目
 * @param {number} limit - 最大条目数
 * @returns {{ section: string, count: number }}
 */
export function formatRecentEntries(entries, limit = 20) {
  const entriesWithDate = entries
    .map(e => {
      const pathMatch = e.path.match(/timeline\/(\d{4})\/(\d{2})\/(\d{2})/);
      if (!pathMatch) return null;
      const [, year, month, day] = pathMatch;
      return {
        ...e,
        dateStr: `${year}-${month}-${day}`,
      };
    })
    .filter(Boolean);

  entriesWithDate.sort((a, b) => {
    if (a.dateStr !== b.dateStr) return b.dateStr.localeCompare(a.dateStr);
    return b.id.localeCompare(a.id);
  });

  const recentEntries = entriesWithDate
    .slice(0, limit)
    .map(e => `- ${e.dateStr} \`${e.id}\` [**${e.type}**] ${e.abstract || '[无摘要]'}`)
    .join('\n');

  if (!recentEntries) {
    return { section: '', count: 0 };
  }

  const section = `\n## 最近条目 (最近 ${Math.min(limit, entriesWithDate.length)} 条)\n\n${recentEntries}\n`;
  return { section, count: Math.min(limit, entriesWithDate.length) };
}

export async function updateMemoryIndex() {
  try {
    let linkMap = { entries: {} };
    if (fs.existsSync(LINK_MAP_FILE)) {
      try {
        linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
      } catch (e) {
        logDebug('indexer', 'Failed to read link-map for index update, using empty', { error: e.message });
      }
    }

    const entries = Object.values(linkMap.entries || {});
    const totalCount = entries.length;

    const typeCount = {};
    for (const e of entries) {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    }

    const dateDistribution = {};
    for (const e of entries) {
      const pathMatch = e.path.match(/timeline\/(\d{4})\/(\d{2})\/(\d{2})/);
      if (pathMatch) {
        const [, year, month, day] = pathMatch;
        const dateStr = `${year}-${month}-${day}`;
        dateDistribution[dateStr] = (dateDistribution[dateStr] || 0) + 1;
      }
    }

    const sortedDates = Object.keys(dateDistribution).sort().reverse().slice(0, 7);
    const dateDistStr = sortedDates.map(d => `| ${d} | ${dateDistribution[d]} |`).join('\n');

    // --- 最近条目生成 (BL-101.1) ---
    // Read limit from config (BL-101.2)
    let limit = 20;
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        const cfgLimit = config?.memory_index?.recent_entries_limit;
        if (typeof cfgLimit === 'number' && cfgLimit > 0) {
          limit = cfgLimit;
        }
      }
    } catch (e) {
      logDebug('indexer', 'Failed to read config for recent_entries_limit, using default', { error: e.message });
    }
    const { section: recentEntriesSection } = formatRecentEntries(entries, limit);

    const updateTime = new Date().toISOString();

    const indexContent = `# Memory Index

> 自动生成文件 - 由程序更新，请勿手动编辑

**统计**
| 指标 | 值 |
|------|-----|
| 总条目数 | ${totalCount} |
| 最后更新 | ${updateTime} |

**类型分布**
| 类型 | 数量 |
|------|------|
${Object.entries(typeCount)
  .map(([t, c]) => `| ${t} | ${c} |`)
  .join('\n')}

**日期分布 (最近7天)**
| 日期 | 条目数 |
|------|--------|
${dateDistStr || '| - | 0 |'}
${recentEntriesSection}
---

*此文件由 memory_write 工具自动更新*
`;

    atomicWriteText(MEMORY_FILE, indexContent);
  } catch (e) {
    logError('indexer', '[updateMemoryIndex] Error', e);
  }
}
