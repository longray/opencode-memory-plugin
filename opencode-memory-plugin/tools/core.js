import { tool } from '@opencode-ai/plugin/tool';
import { writeAndSyncMemory } from '../lib/memory-core.js';
import { getConfig, getLinkMap, resolveTenantId } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { resolveProjectId } from '../lib/project-resolver.js';
import { atomicWriteJson, withLinkMapLock } from '../lib/indexer.js';
import { LINK_MAP_FILE } from '../lib/constants.js';

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string')
    return tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  return [];
}

export const memory_write = tool({
  description: 'Write an entry to long-term memory. abstract and overview are REQUIRED.',
  args: {
    content: tool.schema.string().min(1).describe('L2: Full content (required)'),
    abstract: tool.schema.string().min(1).describe('L0: Summary ≤100 chars (REQUIRED)'),
    overview: tool.schema.string().min(1).describe('L1: Key points ≤500 chars (REQUIRED)'),
    type: tool.schema.string().optional().default('general'),
    tags: tool.schema.array(tool.schema.string()).optional().default([]),
    pinned: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const projectId = await resolveProjectId(config);

    const abstract = (args.abstract || '').trim();
    const overview = (args.overview || '').trim();
    const content = args.content;
    const type = args.type || 'general';
    const tags = normalizeTags(args.tags);
    const tenantId = resolveTenantId(config);

    if (!abstract) {
      return '❌ Error: abstract is REQUIRED. Generate it before calling memory_write.';
    }
    if (!overview) {
      return '❌ Error: overview is REQUIRED. Generate it before calling memory_write.';
    }

    const result = await writeAndSyncMemory({
      abstract,
      overview,
      content,
      type,
      tags,
      pinned: args.pinned || false,
      source_id: null,
      project_id: projectId,
      source: 'plugin',
      tenant_id: tenantId,
      client,
    });

    if (!result.success) {
      return result.message;
    }

    return `✅ Memory saved
- ID: ${result.localId}
- Abstract: ${abstract.substring(0, 50)}...
- File: ${result.filePath}
- Backend: ${result.memoryId ? `✅ Synced (${result.memoryId})` : '❌ Disabled'}
${result.memoryId ? `- Memory ID: ${result.memoryId}` : ''}`;
  },
});

export const memory_pin = tool({
  description: 'Pin or unpin a memory entry.',
  args: {
    entry_id: tool.schema.string().describe('The ID of the memory entry to pin/unpin (required)'),
    action: tool.schema.string().describe("Action to perform: 'pin' or 'unpin' (required)"),
  },
  async execute(args) {
    const { entry_id, action } = args;

    if (!entry_id) {
      return '❌ Error: entry_id is REQUIRED.';
    }

    if (action !== 'pin' && action !== 'unpin') {
      return "❌ Error: action must be either 'pin' or 'unpin'.";
    }

    const isPinned = action === 'pin';

    try {
      await withLinkMapLock(() => {
        const linkMap = getLinkMap();
        if (!linkMap.entries || !linkMap.entries[entry_id]) {
          throw new Error(`Memory entry with ID '${entry_id}' not found.`);
        }
        linkMap.entries[entry_id].pinned = isPinned;
        atomicWriteJson(LINK_MAP_FILE, linkMap);
      });
      return `✅ Successfully ${isPinned ? 'pinned' : 'unpinned'} memory entry '${entry_id}'.`;
    } catch (e) {
      return `❌ Error: Failed to update memory entry '${entry_id}': ${e.message}`;
    }
  },
});
