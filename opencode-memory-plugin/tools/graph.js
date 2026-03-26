import { tool } from '@opencode-ai/plugin/tool';
import { getConfig } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';

export const memory_relate = tool({
  description: 'Create, query, or delete relations between memories',
  args: {
    action: tool.schema.string().describe('Action: create, query, delete'),
    from_id: tool.schema.string().optional(),
    to_id: tool.schema.string().optional(),
    relation_type: tool.schema.string().optional().default('related'),
    weight: tool.schema.number().optional().default(0.5),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;

    if (!backendEnabled) {
      return '❌ Backend not enabled. Graph relations require backend service.';
    }

    try {
      switch (args.action) {
        case 'create': {
          if (!args.from_id || !args.to_id) {
            return '❌ from_id and to_id are required for create action';
          }
          await client.createRelation({
            from_id: args.from_id,
            to_id: args.to_id,
            relation_type: args.relation_type || 'related',
            weight: args.weight || 0.5,
          });
          return `✅ Relation created: ${args.from_id} → ${args.to_id} (${args.relation_type})`;
        }

        case 'query': {
          if (!args.from_id) {
            return '❌ from_id is required for query action';
          }
          const queryResult = await client.getRelations(args.from_id);
          if (!queryResult || queryResult.length === 0) {
            return `❌ No relations found for: ${args.from_id}`;
          }
          return queryResult.map(r => `- ${r.to_id}: ${r.relation_type} (${r.weight})`).join('\n');
        }

        case 'delete':
          if (!args.from_id || !args.to_id) {
            return '❌ from_id and to_id are required for delete action';
          }
          await client.deleteRelation(args.from_id, args.to_id);
          return `✅ Relation deleted: ${args.from_id} → ${args.to_id}`;

        default:
          return `❌ Unknown action: ${args.action}. Use: create, query, delete`;
      }
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});

export const memory_graph = tool({
  description: 'Traverse the memory graph to find related memories',
  args: {
    memory_id: tool.schema.string().describe('Starting memory ID'),
    depth: tool.schema.number().optional().default(2),
    limit: tool.schema.number().optional().default(20),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;

    if (!backendEnabled) {
      return '❌ Backend not enabled. Graph traversal requires backend service.';
    }

    try {
      const results = await client.traverseGraph({
        start_id: args.memory_id,
        depth: args.depth || 2,
        limit: args.limit || 20,
      });

      if (!results || results.length === 0) {
        return `❌ No related memories found for: ${args.memory_id}`;
      }

      return results.map(r => `[${r.depth}] ${r.id}: ${r.abstract || ''}...`).join('\n');
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});
