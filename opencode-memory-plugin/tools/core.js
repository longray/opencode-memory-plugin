import { tool } from '@opencode-ai/plugin/tool';
import { writeAndSyncMemory, updateEntity, getEntityAtoms, loadContextByBudget, loadContextByLevel } from '../lib/memory-core.js';
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
  description: 'Write an entry to long-term memory with optional Atom tree structure. abstract and overview are REQUIRED.',
  args: {
    content: tool.schema.string().min(1).describe('L2: Full content (required)'),
    abstract: tool.schema.string().min(1).describe('L0: Summary ≤100 chars (REQUIRED)'),
    overview: tool.schema.string().min(1).describe('L1: Key points ≤500 chars (REQUIRED)'),
    type: tool.schema.string().optional().default('general'),
    tags: tool.schema.array(tool.schema.string()).optional().default([]),
    pinned: tool.schema.boolean().optional().default(false),
    atoms: tool.schema.array(
      tool.schema.object({
        local_id: tool.schema.string().describe('Unique local ID for this atom'),
        type: tool.schema.string().describe('Atom type: chapter, section, function, class, note'),
        name: tool.schema.string().describe('Display name of the atom'),
        content: tool.schema.string().optional().describe('Atom content (optional)'),
        parent_id: tool.schema.string().optional().describe('Parent atom local_id (null for root)'),
        order: tool.schema.string().optional().describe('Fractional index for ordering (e.g., "a0", "aV")'),
        heading_level: tool.schema.number().optional().describe('Heading level (1-4)'),
        tags: tool.schema.array(tool.schema.string()).optional().default([]),
        aliases: tool.schema.array(tool.schema.string()).optional().default([]),
      })
    ).optional().describe('Optional Atom tree structure for hierarchical knowledge organization'),
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

    if (args.atoms && args.atoms.length > 0) {
      const ids = args.atoms.map(a => a.local_id);
      if (new Set(ids).size !== ids.length) {
        return '❌ Error: Duplicate local_id in atoms array';
      }
    }

    const result = await writeAndSyncMemory({
      abstract,
      overview,
      content,
      type,
      tags,
      pinned: args.pinned || false,
      atoms: args.atoms,
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

export const entity_update = tool({
  description: 'Update an entity with batch Atom operations (add/update/remove).',
  args: {
    entry_id: tool.schema.string().describe('Entity ID to update (required)'),
    entity_updates: tool.schema.object({
      abstract: tool.schema.string().optional(),
      overview: tool.schema.string().optional(),
      content: tool.schema.string().optional(),
      tags: tool.schema.array(tool.schema.string()).optional(),
      meta: tool.schema.array(tool.schema.object({})).optional(),
    }).optional().describe('Entity-level fields to update'),
    atoms_batch: tool.schema.array(
      tool.schema.object({
        action: tool.schema.string().describe("Action to perform: 'add', 'update', or 'remove'"),
        local_id: tool.schema.string().describe('Local ID of the atom'),
        type: tool.schema.string().optional().describe('Atom type (for add/update)'),
        name: tool.schema.string().optional().describe('Atom name (for add/update)'),
        content: tool.schema.string().optional().describe('Atom content (for add/update)'),
        parent_id: tool.schema.string().optional().describe('Parent atom local_id (for add)'),
        order: tool.schema.string().optional().describe('Fractional index (for add/update)'),
        heading_level: tool.schema.number().optional().describe('Heading level 1-4 (for add/update)'),
        tags: tool.schema.array(tool.schema.string()).optional().describe('Atom tags (for add/update)'),
        aliases: tool.schema.array(tool.schema.string()).optional().describe('Atom aliases (for add/update)'),
        cascade: tool.schema.boolean().optional().default(false).describe('Remove children when removing (for remove action)'),
      })
    ).optional().describe('Batch operations on atoms'),
  },
  async execute(args) {
    const { entry_id, entity_updates, atoms_batch } = args;

    if (!entry_id) {
      return '❌ Error: entry_id is REQUIRED.';
    }

    try {
      const config = getConfig();
      const client = getWrapperClient(config);

      const result = await updateEntity({
        entry_id,
        entity_updates,
        atoms_batch,
        client,
      });

      if (!result.success) {
        return `❌ Error: ${result.error}`;
      }

      let message = `✅ Entity updated successfully\n- Entity ID: ${result.entity_id}`;
      
      if (result.atoms_result && result.atoms_result.length > 0) {
        message += `\n- Atom operations: ${result.atoms_result.length}`;
        for (const op of result.atoms_result) {
          message += `\n  • ${op.action}: ${op.local_id} ${op.success ? '✓' : '✗'}`;
          if (op.removed_count) {
            message += ` (removed ${op.removed_count} atoms)`;
          }
        }
      }

      if (result.synced === true) {
        message += `\n- Backend: ✅ Synced (${result.memory_id})`;
      } else if (result.sync_error) {
        message += `\n- Backend: ⚠️ ${result.sync_error}`;
      }

      if (result.warnings && result.warnings.length > 0) {
        message += `\n\n⚠️ Warnings:\n${result.warnings.join('\n')}`;
      }

      return message;
    } catch (error) {
      return `❌ Error: Failed to update entity: ${error.message}`;
    }
  },
});

export const entity_atoms = tool({
  description: 'Get the Atom tree structure of an entity.',
  args: {
    entry_id: tool.schema.string().describe('Entity ID to retrieve atoms for (required)'),
    include_content: tool.schema.boolean().optional().default(true).describe('Whether to include atom content in the response'),
  },
  async execute(args) {
    const { entry_id, include_content } = args;

    if (!entry_id) {
      return '❌ Error: entry_id is REQUIRED.';
    }

    try {
      const result = await getEntityAtoms({
        entry_id,
        include_content,
      });

      if (!result.success) {
        return `❌ Error: ${result.error}`;
      }

      return JSON.stringify({
        entity_id: result.entity_id,
        total_atoms: result.total_atoms,
        tree: result.tree,
      }, null, 2);
    } catch (error) {
      return `❌ Error: Failed to retrieve atoms: ${error.message}`;
    }
  },
});

export const load_context_budget = tool({
  description: 'Load entity context within a token budget. Selects the most relevant atoms when the entity has many atoms (50+).',
  args: {
    entry_id: tool.schema.string().describe('Entity ID to load atoms from (required)'),
    query: tool.schema.string().describe('Current query for relevance scoring (required)'),
    max_tokens: tool.schema.number().optional().default(2000).describe('Maximum tokens to include (default 2000)'),
    strategy: tool.schema.string().optional().default('relevance').describe("Selection strategy: 'relevance' (BM25+title) or 'hierarchy' (top-level first)"),
  },
  async execute(args) {
    const { entry_id, query, max_tokens, strategy } = args;

    if (!entry_id) {
      return '❌ Error: entry_id is REQUIRED.';
    }
    if (!query) {
      return '❌ Error: query is REQUIRED for relevance scoring.';
    }

    try {
      const result = await loadContextByBudget({
        entry_id,
        query,
        maxTokens: max_tokens,
        strategy,
      });

      if (!result.success) {
        return `❌ Error: ${result.error}`;
      }

      const atoms = result.selected_atoms.map(a => ({
        local_id: a.local_id,
        name: a.name,
        type: a.type,
        heading_level: a.heading_level,
        relevance_score: Math.round(a.relevance_score * 100) / 100,
        tokens: Math.ceil((a.content || '').length / 4),
      }));

      return [
        `✅ Context loaded: ${result.selected_count}/${result.total_atoms} atoms`,
        `   Tokens: ${result.used_tokens}/${result.max_tokens} (${result.budget_utilization}% utilization)`,
        `   Strategy: ${result.strategy}`,
        '',
        ...atoms.map(a => `  [${a.relevance_score.toFixed(2)}] [[${a.local_id}]] ${a.name} (${a.tokens}t)`),
      ].join('\n');
    } catch (error) {
      return `❌ Error: Failed to load context: ${error.message}`;
    }
  },
});

export const load_context_level = tool({
  description: 'Load entity context filtered by hierarchy level. Returns a markdown document with only the requested depth.',
  args: {
    entry_id: tool.schema.string().describe('Entity ID to load atoms from (required)'),
    max_level: tool.schema.number().optional().default(2)
      .describe('1=chapters only, 2=chapters+sections, 3=all details'),
    include_breadcrumbs: tool.schema.boolean().optional().default(true)
      .describe('Include parent chain breadcrumbs in markdown'),
  },
  async execute(args) {
    const { entry_id, max_level, include_breadcrumbs } = args;

    if (!entry_id) {
      return '❌ Error: entry_id is REQUIRED.';
    }

    try {
      const result = await loadContextByLevel({
        entry_id,
        maxLevel: max_level,
        includeBreadcrumbs: include_breadcrumbs,
      });

      if (!result.success) {
        return `❌ Error: ${result.error}`;
      }

      const header = [
        `✅ Context (level ≤${result.max_level}): ${result.filtered_count}/${result.total_atoms} atoms`,
      ];

      if (result.markdown) {
        return header.join('\n') + '\n\n' + result.markdown;
      }

      return header.join('\n') + '\n\n(No atoms found)';
    } catch (error) {
      return `❌ Error: Failed to load context by level: ${error.message}`;
    }
  },
});
