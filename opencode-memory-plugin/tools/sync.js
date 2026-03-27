import { tool } from '@opencode-ai/plugin/tool';
import { getConfig, getLinkMap, deleteEntryFile } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { MEMORY_DIR } from '../lib/constants.js';
import { removeFromLinkMap } from '../lib/indexer.js';
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
  args: {
    detailed: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe('Show pending entries details'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    const syncedCount = entries.filter(e => e.synced).length;
    const pendingCount = entries.length - syncedCount;

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

    let output = `## Memory System Status

**Local:**
- Total entries: ${entries.length}
- Synced: ${syncedCount}
- Pending: ${pendingCount}

**Backend:**
- Status: ${backendStatus}
- Backend entries: ${backendCount}

**Storage:**
- Memory dir: ${MEMORY_DIR}
- Config: ${config ? '✅' : '❌'}
`;

    if (args.detailed && pendingCount > 0) {
      const pending = entries.filter(e => !e.synced).slice(0, 10);
      output += `\n**Pending entries:**\n`;
      pending.forEach(e => {
        output += `- ${e.id}: ${e.abstract?.substring(0, 40) || '(no abstract)'}...\n`;
      });
      if (pendingCount > 10) {
        output += `... and ${pendingCount - 10} more\n`;
      }
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
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});

    if (args.dry_run) {
      const pending = entries.filter(e => !e.synced);
      return `📋 Dry run: ${pending.length} entries would be synced`;
    }

    const fingerprints = entries.map(e => {
      const filePath = path.join(MEMORY_DIR, e.path);
      const stat = fs.statSync(filePath);
      return {
        path: e.path,
        mtime: Math.floor(stat.mtimeMs),
        hash: e.hash || '',
        source_id: e.id,
      };
    });

    if (fingerprints.length === 0) {
      return '✅ No entries to sync';
    }

    try {
      const tenantId = config?.backend?.tenant_id || 'default';
      const result = await client.syncPreview(fingerprints, tenantId);
      const toUpload = result.to_upload?.length || 0;
      const toDelete = result.to_delete?.length || 0;
      return `✅ Incremental sync: ${toUpload} to upload, ${toDelete} to delete`;
    } catch (e) {
      return `❌ Sync error: ${e.message}`;
    }
  },
});

export const full_sync = tool({
  description: 'Perform full synchronization - upload all local memories to backend',
  args: {
    dry_run: tool.schema.boolean().optional().default(false),
    auto_clean: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});

    if (entries.length === 0) {
      return '✅ No entries to sync';
    }

    if (args.dry_run) {
      return `📋 Dry run: ${entries.length} entries would be synced`;
    }

    try {
      const memories = entries.map(e => {
        const filePath = path.join(MEMORY_DIR, e.path);
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          content,
          abstract: e.abstract || null,
          overview: e.overview || null,
          type: e.type || 'general',
          tags: e.tags || [],
          source: 'plugin',
          source_id: e.id || null,
          local_id: e.id || null,
          project_id: e.project || 'global',
        };
      });

      const tenantId = config?.backend?.tenant_id || 'default';
      const result = await client.syncFull(memories, tenantId);

      const skipped = result.skipped || [];
      let output = `✅ Full sync: ${result.success || 0} uploaded, ${skipped.length} skipped`;
      if (result.updated > 0) {
        output += `, ${result.updated} updated`;
      }
      if (result.failed > 0) {
        output += `, ${result.failed} failed`;
      }

      if (skipped.length > 0) {
        output += '\n\n**Skipped duplicates:**';
        for (const s of skipped) {
          const reason =
            s.reason === 'hash' ? 'exact match' : `semantic (${(s.similarity * 100).toFixed(0)}%)`;
          output += `\n- ${s.local_id}: ${reason} → ${s.existing_id}`;
        }
      }

      if (args.auto_clean && skipped.length > 0) {
        let cleaned = 0;
        for (const s of skipped) {
          if (!s.local_id) continue;
          const entry = linkMap.entries[s.local_id];
          if (!entry) continue;
          const filePath = path.join(MEMORY_DIR, entry.path);
          deleteEntryFile(filePath);
          await removeFromLinkMap(s.local_id);
          cleaned++;
        }
        output += `\n\n🧹 Auto-cleaned ${cleaned} local duplicates`;
      }

      return output;
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
    resolution: tool.schema.string().describe('Resolution: use_local, use_remote, keep_both'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);

    try {
      const normalizedResolution = (args.resolution || '').toLowerCase();
      await client.resolveConflict(
        args.conflict_id,
        normalizedResolution,
        config?.backend?.tenant_id
      );
      return `✅ Conflict resolved: ${args.conflict_id} (${normalizedResolution})`;
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});

export const sync_checkpoint = tool({
  description: 'View sync checkpoints and fingerprints',
  args: {
    action: tool.schema.string().optional().default('list').describe('Action: list'),
    limit: tool.schema.number().optional().default(20).describe('Max fingerprints to show'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;

    if (!backendEnabled) {
      return '❌ Backend not enabled';
    }

    const action = args.action || 'list';
    const limit = args.limit || 20;

    if (action === 'list') {
      try {
        const fingerprints = await client.getServerFingerprints(
          config?.backend?.tenant_id || 'default'
        );
        const list = fingerprints.fingerprints || fingerprints || [];

        if (list.length === 0) {
          return '✅ No fingerprints on server';
        }

        const shown = list.slice(0, limit);
        let output = `## Sync Checkpoints\n\n`;
        output += `**Total on server:** ${list.length}\n\n`;
        output += `| Source ID | Hash | Path |\n`;
        output += `|-----------|------|------|\n`;
        shown.forEach(fp => {
          const p = fp.path ? fp.path.substring(0, 40) : 'N/A';
          const hash = fp.hash ? fp.hash.substring(0, 12) : 'N/A';
          output += `| ${fp.source_id || 'N/A'} | ${hash}... | ${p}... |\n`;
        });

        if (list.length > limit) {
          output += `\n... and ${list.length - limit} more\n`;
        }

        return output;
      } catch (e) {
        return `❌ Error: ${e.message}`;
      }
    }

    return `❌ Unknown action: ${action}. Use: list`;
  },
});
