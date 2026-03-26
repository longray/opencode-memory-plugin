import fs from 'fs';
import path from 'path';
import { LINK_MAP_FILE, MEMORY_FILE, MEMORY_DIR } from './constants.js';

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

  if (lines.length > 102) {
    lines.splice(102);
  }

  const count = lines.filter(l => l.startsWith('- [')).length;
  lines[0] = `# ${dateStr} 记忆概览（${count} entries）`;

  fs.writeFileSync(overviewPath, lines.join('\n'), 'utf-8');
}

export async function updateLinkMap(entry, filePath) {
  let linkMap = { version: '2.4.0', entries: {} };

  if (fs.existsSync(LINK_MAP_FILE)) {
    try {
      linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
    } catch {
      // ignore
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

  fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
}

export async function removeFromLinkMap(localId) {
  if (!fs.existsSync(LINK_MAP_FILE)) return;

  try {
    const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
    if (linkMap.entries && linkMap.entries[localId]) {
      delete linkMap.entries[localId];
      fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
    }
  } catch {
    // ignore
  }
}

export async function updateMemoryIndex() {
  try {
    let linkMap = { entries: {} };
    if (fs.existsSync(LINK_MAP_FILE)) {
      try {
        linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
      } catch {
        // ignore
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

---

*此文件由 memory_write 工具自动更新*
`;

    fs.writeFileSync(MEMORY_FILE, indexContent, 'utf-8');
  } catch (e) {
    console.error('[updateMemoryIndex] Error:', e.message);
  }
}
