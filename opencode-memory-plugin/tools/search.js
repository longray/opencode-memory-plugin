import { tool } from '@opencode-ai/plugin/tool';
import { getConfig } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { searchByPrefix } from '../lib/trie-index.js';
import fs from 'fs';
import path from 'path';
import { MEMORY_DIR } from '../lib/constants.js';

export const memory_search = tool({
  description: 'Search memory with configurable search mode',
  args: {
    query: tool.schema.string().describe('Search query'),
    mode: tool.schema
      .string()
      .optional()
      .default('keyword')
      .describe('Search mode: vector, keyword, hybrid'),
    limit: tool.schema.number().optional().default(10),
    level: tool.schema.number().optional().default(0).describe('0=abstract, 1=overview, 2=full'),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const mode = args.mode || 'keyword';
    const limit = args.limit || 10;
    const level = args.level || 0;

    const backendEnabled = config?.backend?.enabled !== false;

    if (backendEnabled && (mode === 'vector' || mode === 'hybrid')) {
      try {
        const results = await client.searchMemories(args.query, {
          mode,
          limit,
          tenant_id: config?.backend?.tenant_id,
        });

        if (results && results.length > 0) {
          return formatSearchResults(results, level);
        }
      } catch (e) {
        console.error('[memory_search] Backend search failed:', e.message);
      }
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
              : '';
        return `${i + 1}. [${e.type}] ${prefix}${prefix ? '...' : ''}\n   ID: ${e.id}`;
      })
      .join('\n\n');
  } catch (e) {
    return `❌ Search error: ${e.message}`;
  }
}

function formatSearchResults(results, level) {
  return results
    .map((r, i) => {
      const content =
        level === 0
          ? (r.abstract || '').substring(0, 50)
          : level === 1
            ? (r.overview || r.abstract || '').substring(0, 100)
            : (r.content || '').substring(0, 200);
      return `${i + 1}. [${r.type || 'general'}] ${content}${content ? '...' : ''}\n   ID: ${r.id}`;
    })
    .join('\n\n');
}

export const memory_suggest = tool({
  description: 'Get search autocomplete suggestions',
  args: {
    prefix: tool.schema.string().describe('Search prefix'),
    limit: tool.schema.number().optional().default(10),
  },
  async execute(args) {
    try {
      const suggestions = searchByPrefix(args.prefix, args.limit || 10);
      if (suggestions.length === 0) {
        return '❌ No suggestions';
      }
      return suggestions.map(s => `- ${s}`).join('\n');
    } catch (e) {
      return `❌ Suggestion error: ${e.message}`;
    }
  },
});
