import { tool } from '@opencode-ai/plugin/tool';
import { getConfig, resolveTenantId } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';

export const memory_relate = tool({
  description: 'Create, query, or delete relations between memories',
  args: {
    action: tool.schema.string().describe('Action: create, query, delete'),
    from_id: tool.schema.string().optional(),
    to_id: tool.schema.string().optional(),
    relation_type: tool.schema.string().optional().default('related'),
    weight: tool.schema.number().min(0).max(1).optional().default(0.5),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = resolveTenantId(config);

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
            type: args.relation_type || 'related',
            weight: args.weight || 0.5,
            tenant_id: tenantId,
          });
          return `✅ Relation created: ${args.from_id} → ${args.to_id} (${args.relation_type})`;
        }

        case 'query': {
          if (!args.from_id) {
            return '❌ from_id is required for query action';
          }
          const queryResult = await client.getRelations({
            memory_id: args.from_id,
            tenant_id: tenantId,
          });
          const relations = Array.isArray(queryResult) ? queryResult : queryResult?.relations || [];
          if (!relations || relations.length === 0) {
            return `❌ No relations found for: ${args.from_id}`;
          }
          return relations
            .map(r => {
              const targetId = r.to || r.to_id || 'unknown';
              const relType = r.type || r.relation_type || 'unknown';
              const weight = r.weight ?? 0.5;
              return `- ${targetId}: ${relType} (${weight})`;
            })
            .join('\n');
        }

        case 'delete':
          if (!args.from_id || !args.to_id) {
            return '❌ from_id and to_id are required for delete action';
          }
          // Query relations to find the relation_id
          const relationsResult = await client.getRelations({
            memory_id: args.from_id,
            tenant_id: tenantId,
          });
          const relations = Array.isArray(relationsResult)
            ? relationsResult
            : relationsResult?.relations || [];
          const targetRelation = relations.find(r => (r.to || r.to_id) === args.to_id);
          if (!targetRelation) {
            return `❌ No relation found from ${args.from_id} to ${args.to_id}`;
          }
          const relationId = targetRelation.id || targetRelation.relation_id;
          await client.deleteRelation(relationId, tenantId);
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
    depth: tool.schema.number().min(1).max(5).optional().default(2),
    limit: tool.schema.number().optional().default(20),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = resolveTenantId(config);

    if (!backendEnabled) {
      return '❌ Backend not enabled. Graph traversal requires backend service.';
    }

    try {
      const results = await client.traverseGraph({
        memory_id: args.memory_id,
        depth: args.depth || 2,
        limit: args.limit || 20,
        tenant_id: tenantId,
      });

      if (!results) {
        return `❌ No related memories found for: ${args.memory_id}`;
      }

      const nodes = Array.isArray(results) ? results : results.memories || results.relations || [];
      if (nodes.length === 0) {
        return `❌ No related memories found for: ${args.memory_id}`;
      }

      return nodes
        .map(r => {
          const rawId = r.id || r.memory_id || 'unknown';
          const nodeId = typeof rawId === 'object' ? rawId.id || JSON.stringify(rawId) : rawId;
          const abstract = r.abstract || r.overview || extractFromContent(r.content) || '';
          const depth = r.depth || 0;
          return `[${depth}] ${nodeId}: ${abstract}`;
        })
        .join('\n');
    } catch (e) {
      return `❌ Error: ${e.message}`;
    }
  },
});

function extractFromContent(content) {
  if (!content) return '';
  const stripped = content.replace(/^---[\s\S]*?---\n*/m, '');
  const abstractMatch = stripped.match(/# ≡≡≡ Abstract ≡≡≡\s*\n```\n([\s\S]*?)```/);
  const overviewMatch = stripped.match(/# ≡≡≡ Overview ≡≡≡\s*\n```\n([\s\S]*?)```/);
  const abstract = abstractMatch ? abstractMatch[1].replace(/\n/g, ' ').trim() : '';
  const overview = overviewMatch ? overviewMatch[1].replace(/\n/g, ' ').trim() : '';
  if (abstract && overview) return `${abstract} | ${overview}`;
  if (abstract) return abstract;
  if (overview) return overview;
  return stripped.replace(/\n/g, ' ').trim();
}
