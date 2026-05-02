import { tool } from '@opencode-ai/plugin/tool';
import { getConfig, resolveTenantId } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { getAutocompleteSuggestions } from '../lib/trie-index.js';
import fs from 'fs';
import path from 'path';
import { MEMORY_DIR } from '../lib/constants.js';

/**
 * Searches memory with configurable search mode.
 * @param {Object} args - The arguments for the search
 * @param {string} args.query - Search query
 * @param {string} [args.mode='hybrid'] - Search mode: vector, keyword, hybrid
 * @param {number} [args.limit=10] - Maximum number of results to return
 * @param {number} [args.level=0] - Level of detail: 0=abstract, 1=overview, 2=full
 * @returns {Promise<string>} Search results
 */
export const memory_search = tool({
  description: 'Search memory with configurable search mode and optional Atom scope',
  args: {
    query: tool.schema.string().describe('Search query'),
    mode: tool.schema
      .string()
      .optional()
      .default('hybrid')
      .describe('Search mode: vector, keyword, hybrid'),
    scope: tool.schema
      .string()
      .optional()
      .default('all')
      .describe('Search scope: all, entity, atom'),
    atom_types: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe('Filter by atom types (e.g., ["function", "class"])'),
    limit: tool.schema.number().optional().default(10),
    level: tool.schema.number().optional().default(0).describe('0=abstract, 1=overview, 2=full'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const mode = args.mode || 'hybrid';
    const scope = args.scope || 'all';
    const atomTypes = args.atom_types || [];
    const limit = args.limit || 10;
    const level = args.level || 0;

    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = resolveTenantId(config);

    if (backendEnabled) {
      try {
        const searchParams = {
          query: args.query,
          mode,
          scope,
          limit,
          level,
          tenant_id: tenantId,
          ...(atomTypes.length > 0 && { atom_types: atomTypes }),
        };

        const result = await client.search(searchParams);

        if (result.results && result.results.length > 0) {
          return formatSearchResults(result.results, level, scope);
        }
      } catch (e) {
        console.error('[memory_search] Backend search failed:', e.message);
      }
    }

    if (scope === 'atom') {
      return '❌ Atom scope search requires backend service. Please enable backend or use scope="entity" or "all".';
    }

    return await localSearch(args.query, limit, level);
  },
});

async function localSearch(query, limit, level) {
  try {
    const linkMapPath = path.join(MEMORY_DIR, 'link-map.json');
    if (!fs.existsSync(linkMapPath)) {
      return '❌ No memories found';
    }

    const linkMap = JSON.parse(fs.readFileSync(linkMapPath, 'utf-8'));
    const entries = Object.values(linkMap.entries || {});

    if (entries.length === 0) {
      return '❌ No memories found';
    }

    const queryLower = query.toLowerCase();
    const scored = entries
      .map(entry => {
        const abstractLower = (entry.abstract || '').toLowerCase();
        const overviewLower = (entry.overview || '').toLowerCase();
        const tagsLower = (entry.tags || []).join(' ').toLowerCase();

        let score = 0;
        if (abstractLower.includes(queryLower)) score += 10;
        if (overviewLower.includes(queryLower)) score += 5;
        if (tagsLower.includes(queryLower)) score += 3;

        const words = queryLower.split(/\s+/);
        words.forEach(w => {
          if (abstractLower.includes(w)) score += 2;
          if (overviewLower.includes(w)) score += 1;
        });

        return { ...entry, score };
      })
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) {
      return `❌ No results for: ${query}`;
    }

    return scored
      .map((e, i) => {
        const prefix =
          level === 0
            ? e.abstract?.substring(0, 50) || ''
            : level === 1
              ? (e.overview || e.abstract || '').substring(0, 100)
              : (e.overview || e.abstract || '').substring(0, 300);
        return `${i + 1}. [${e.type}] ${prefix}${level >= 2 ? '' : '...'}\n   ID: ${e.id}`;
      })
      .join('\n\n');
  } catch (e) {
    return `❌ Search error: ${e.message}`;
  }
}

function formatSearchResults(results, level, _scope = 'all') {
  return results
    .map((r, i) => {
      const isAtom = r.type === 'atom' || r.atom_type;
      const entityType = r.entity_type || r.type;
      const typeLabel = isAtom ? `atom:${r.atom_type || r.type}` : entityType || 'general';

      let content;
      if (isAtom) {
        content =
          level === 0
            ? (r.name || '').substring(0, 50)
            : level === 1
              ? (r.content || r.name || '').substring(0, 100)
              : (r.content || r.name || '').substring(0, 500);
      } else {
        content =
          level === 0
            ? (r.abstract || '').substring(0, 50)
            : level === 1
              ? (r.overview || r.abstract || '').substring(0, 100)
              : (r.content || r.overview || r.abstract || '').substring(0, 500);
      }

      const id = r.local_id || r.id;
      const entityRef = isAtom && r.entity_id ? ` (in ${r.entity_id})` : '';

      return `${i + 1}. [${typeLabel}] ${content}${level >= 2 ? '' : '...'}\n   ID: ${id}${entityRef}`;
    })
    .join('\n\n');
}

/**
 * Gets search autocomplete suggestions.
 * @param {Object} args - The arguments for getting suggestions
 * @param {string} args.prefix - Search prefix
 * @param {number} [args.limit=10] - Maximum number of suggestions to return
 * @returns {Promise<string>} Autocomplete suggestions
 */
export const memory_suggest = tool({
  description: 'Get search autocomplete suggestions',
  args: {
    prefix: tool.schema.string().describe('Search prefix'),
    limit: tool.schema.number().optional().default(10),
  },
  async execute(args) {
    try {
      const suggestions = await getAutocompleteSuggestions(args.prefix, args.limit || 10);
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return '❌ No suggestions';
      }
      return suggestions
        .map(s =>
          typeof s === 'string' ? `- ${s}` : `- ${s.word || s.suggestion || JSON.stringify(s)}`
        )
        .join('\n');
    } catch (e) {
      return `❌ Suggestion error: ${e.message}`;
    }
  },
});
