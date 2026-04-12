import { tool } from '@opencode-ai/plugin/tool';
import { writeAndSyncMemory, readMemory } from '../lib/memory-core.js';
import { getConfig, getLinkMap } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { resolveProjectId } from '../lib/project-resolver.js';
import { LINK_MAP_FILE } from '../lib/constants.js';
import fs from 'fs';

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
    content: tool.schema.string().describe('L2: Full content (required)'),
    abstract: tool.schema.string().describe('L0: Summary ≤100 chars (REQUIRED)'),
    overview: tool.schema.string().describe('L1: Key points ≤500 chars (REQUIRED)'),
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
    const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';

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

    if (args.pinned) {
      const linkMap = getLinkMap();
      if (linkMap.entries[result.localId]) {
        linkMap.entries[result.localId].pinned = true;
        fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
      }
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

    const linkMap = getLinkMap();
    if (!linkMap.entries || !linkMap.entries[entry_id]) {
      return `❌ Error: Memory entry with ID '${entry_id}' not found.`;
    }

    const isPinned = action === 'pin';
    linkMap.entries[entry_id].pinned = isPinned;

    try {
      fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
      return `✅ Successfully ${isPinned ? 'pinned' : 'unpinned'} memory entry '${entry_id}'.`;
    } catch (e) {
      return `❌ Error: Failed to update memory entry '${entry_id}': ${e.message}`;
    }
  },
});

export const memory_read = tool({
  description: 'Read a memory entry by ID with level support (v3.2 API)',
  args: {
    entry_id: tool.schema.string().describe('The ID of the memory entry to read (required)'),
    level: tool.schema.number().optional().default(2).describe('Content level: 0=abstract, 1=overview, 2=full (default)'),
  },
  async execute(args) {
    const { entry_id, level = 2 } = args;

    if (!entry_id) {
      return '❌ Error: entry_id is REQUIRED.';
    }

    const result = await readMemory({ entry_id, level });

    if (!result.success) {
      return result.message;
    }

    return `✅ Memory read successfully
- ID: ${entry_id}
- Level: ${level} (${level === 0 ? 'abstract' : level === 1 ? 'overview' : 'full'})
- Content:
${result.content}`;
  },
});
