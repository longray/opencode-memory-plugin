import { tool } from '@opencode-ai/plugin/tool';
import { memory_write } from './tools/core.js';
import { memory_search, memory_suggest } from './tools/search.js';
import { memory_relate, memory_graph } from './tools/graph.js';
import { memory_timeline, memory_topics } from './tools/browse.js';
import {
  rebuild_index,
  index_status,
  list_daily,
  init_daily,
  sync_status,
  incremental_sync,
  full_sync,
  conflict_list,
  conflict_resolve,
  batch_resolve,
} from './tools/sync.js';

const memory_read = tool({
  description: 'Read from a memory file with level support',
  args: {
    entry_id: tool.schema.string().describe('Entry ID (required)'),
    level: tool.schema.number().optional().default(2).describe('0=abstract, 1=overview, 2=full'),
  },
  async execute(args) {
    const { getEntryById } = await import('./lib/storage.js');
    const { extractByLevel } = await import('./lib/extractor.js');

    const entry = getEntryById(args.entry_id);
    if (!entry) {
      return `❌ Entry not found: ${args.entry_id}`;
    }

    const level = args.level !== undefined ? args.level : 2;
    return extractByLevel(entry.content, level);
  },
});

export const MemoryPlugin = async _ctx => {
  return {
    tool: {
      memory_write,
      memory_read,
      memory_search,
      memory_suggest,
      memory_relate,
      memory_graph,
      memory_timeline,
      memory_topics,
      rebuild_index,
      index_status,
      list_daily,
      init_daily,
      sync_status,
      incremental_sync,
      full_sync,
      conflict_list,
      conflict_resolve,
      batch_resolve,
    },
  };
};

export default MemoryPlugin;
