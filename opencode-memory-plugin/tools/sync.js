import { tool } from '@opencode-ai/plugin/tool';
import { getConfig, getLinkMap } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { MEMORY_DIR, TIMELINE_DIR } from '../lib/constants.js';
import fs from 'fs';
import path from 'path';

export const rebuild_index = tool({
  description: 'Sync all local memory files to backend service',
  args: {
    force: tool.schema.boolean().optional().default(false),
    dry_run: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;

    if (!backendEnabled) {
      return '❌ Backend not enabled';
    }

    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    const toSync = entries.filter(e => !e.synced);

    if (toSync.length === 0) {
      return '✅ All memories already synced';
    }

    if (args.dry_run) {
      return `📋 Dry run: ${toSync.length} entries would be synced`;
    }

    let synced = 0;
    let failed = 0;

    for (const entry of toSync) {
      try {
        const filePath = path.join(MEMORY_DIR, entry.path);
        const content = fs.readFileSync(filePath, 'utf-8');

        await client.uploadMemory({
          content,
          type: entry.type,
          tags: entry.tags,
          source: 'plugin',
        });

        synced++;
      } catch {
        failed++;
      }
    }

    return `✅ Sync complete: ${synced} synced, ${failed} failed`;
  },
});

export const index_status = tool({
  description: 'Check the status of the memory system',
  args: {},
  async execute() {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    const syncedCount = entries.filter(e => e.synced).length;

    let backendStatus = '❌ Offline';
    let backendCount = 0;

    if (backendEnabled) {
      try {
        const status = await client.getStatus();
        backendStatus = '✅ Online';
        backendCount = status.memory_count || 0;
      } catch (e) {
        backendStatus = `❌ Error: ${e.message}`;
      }
    }

    return `## Memory System Status

**Local:**
- Total entries: ${entries.length}
- Synced: ${syncedCount}
- Pending: ${entries.length - syncedCount}

**Backend:**
- Status: ${backendStatus}
- Backend entries: ${backendCount}

**Storage:**
- Memory dir: ${MEMORY_DIR}
- Config: ${config ? '✅' : '❌'}
`;
  },
});

export const list_daily = tool({
  description: 'List available timeline entries from past N days',
  args: {
    days: tool.schema.number().optional().default(7),
  },
  async execute(args) {
    const days = args.days || 7;
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});

    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const byDate = {};
    for (const entry of entries) {
      const match = entry.path.match(/timeline\/(\d{4})\/(\d{2})\/(\d{2})/);
      if (match) {
        const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
        const entryDate = new Date(dateStr);
        if (entryDate >= cutoff) {
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr].push(entry);
        }
      }
    }

    const sortedDates = Object.keys(byDate).sort().reverse();

    if (sortedDates.length === 0) {
      return `❌ No entries in the last ${days} days`;
    }

    return sortedDates.map(d => `${d}: ${byDate[d].length} entries`).join('\n');
  },
});

export const init_daily = tool({
  description: "Initialize today's timeline directory if it doesn't exist",
  args: {},
  async execute() {
    const now = new Date();
    const dayDir = path.join(
      TIMELINE_DIR,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    );

    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
      return `✅ Created: ${dayDir}`;
    }

    return `ℹ️ Already exists: ${dayDir}`;
  },
});

export const sync_status = tool({
  description: 'Get real-time synchronization status',
  args: {
    detailed: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    const synced = entries.filter(e => e.synced).length;
    const pending = entries.length - synced;

    let output = `## Sync Status\n\n`;
    output += `- Total: ${entries.length}\n`;
    output += `- Synced: ${synced}\n`;
    output += `- Pending: ${pending}\n`;

    if (args.detailed && pending > 0) {
      output += `\n**Pending entries:**\n`;
      entries
        .filter(e => !e.synced)
        .slice(0, 10)
        .forEach(e => {
          output += `- ${e.id}: ${e.abstract?.substring(0, 40)}...\n`;
        });
    }

    return output;
  },
});

export const incremental_sync = tool({
  description: 'Perform incremental synchronization based on fingerprints',
  args: {
    dry_run: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    if (args.dry_run) {
      const linkMap = getLinkMap();
      const pending = Object.values(linkMap.entries || {}).filter(e => !e.synced);
      return `📋 Dry run: ${pending.length} entries would be synced`;
    }

    try {
      const result = await client.incrementalSync();
      return `✅ Incremental sync: ${result.synced || 0} synced`;
    } catch (e) {
      return `❌ Sync error: ${e.message}`;
    }
  },
});

export const full_sync = tool({
  description: 'Perform full synchronization with resume support',
  args: {
    resume: tool.schema.boolean().optional().default(false),
    batch_size: tool.schema.number().optional().default(50),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    try {
      const result = await client.fullSync({
        resume: args.resume || false,
        batch_size: args.batch_size || 50,
      });
      return `✅ Full sync: ${result.synced || 0} synced`;
    } catch (e) {
      return `❌ Sync error: ${e.message}`;
    }
  },
});

export const conflict_list = tool({
  description: 'List unresolved sync conflicts',
  args: {
    limit: tool.schema.number().optional().default(10),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    try {
      const conflicts = await client.listConflicts({ limit: args.limit || 10 });
      if (!conflicts || conflicts.length === 0) {
        return '✅ No conflicts found';
      }
      return conflicts.map(c => `${c.id}: ${c.description}`).join('\n');
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});

export const conflict_resolve = tool({
  description: 'Resolve a sync conflict',
  args: {
    conflict_id: tool.schema.string().describe('Conflict ID'),
    resolution: tool.schema.string().describe('Resolution: USE_LOCAL, USE_BACKEND, MERGE'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    try {
      await client.resolveConflict({
        conflict_id: args.conflict_id,
        resolution: args.resolution,
      });
      return `✅ Conflict resolved: ${args.conflict_id}`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});

export const batch_resolve = tool({
  description: 'Batch resolve multiple conflicts',
  args: {
    strategy: tool.schema.string().describe('Strategy: ACCEPT_ALL, USE_LOCAL_ALL, USE_BACKEND_ALL'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    try {
      const result = await client.batchResolve({ strategy: args.strategy });
      return `✅ Batch resolved: ${result.resolved || 0} conflicts`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});
