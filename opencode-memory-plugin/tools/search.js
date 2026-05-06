import { tool } from '@opencode-ai/plugin/tool';
import { getConfig, resolveTenantId } from '../lib/storage.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { getAutocompleteSuggestions } from '../lib/trie-index.js';
import fs from 'fs';
import path from 'path';
import { MEMORY_DIR } from '../lib/constants.js';

/**
 * 根据搜索模式和 scope 返回合理的默认 threshold
 * @param {string} mode - 搜索模式: hybrid, vector, keyword
 * @param {string} scope - 搜索范围: all, atom
 * @returns {number} threshold 值
 */
function getDefaultThreshold(mode, _scope) {
  const baseThreshold = {
    hybrid: 0.01,
    vector: 0.3,
    keyword: 0.1,
    bm25: 0.1,
  };
  const threshold = baseThreshold[mode] ?? 0.01;
  // Atom scope 不需要额外降低，因为已经按模式设置了
  return threshold;
}

/**
 * 智能查询改写 — 短查询添加上下文词提升召回率
 * @param {string} query - 原始查询
 * @param {string} mode - 搜索模式
 * @returns {string} 改写后的查询
 */
function rewriteQuery(query, mode) {
  // vector 模式不改写（依赖语义 embedding）
  if (mode === 'vector') return query;

  const words = query.split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 3) return query; // 长查询不改写

  // 技术关键词扩展映射
  const expansions = {
    promise: ['Promise', 'async', 'await', 'then', 'catch'],
    async: ['async', 'await', 'Promise', '异步'],
    vue: ['Vue', 'Composition API', 'setup', 'reactive', 'ref'],
    setup: ['setup', 'Composition API', 'script setup'],
    stream: ['stream', 'Readable', 'Writable', 'pipe', 'pipeline'],
    git: ['Git', 'GitFlow', 'GitHub Flow', '分支', 'merge'],
    error: ['error', '错误处理', 'catch', 'try/catch'],
    ref: ['ref', 'reactive', 'computed', 'watch'],
  };

  // 提取第一个词进行扩展
  const firstWord = words[0].toLowerCase();
  const expanded = expansions[firstWord];

  if (expanded) {
    // 合并原始词和扩展词，去重
    const allTerms = [...new Set([...words, ...expanded])];
    return allTerms.join(' ');
  }

  return query;
}

/**
 * 对搜索结果按 local_id 去重（解决后端同一 local_id 出现在多个 entity 的问题）
 * @param {Array} results - 搜索结果
 * @returns {Array} 去重后的结果
 */
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const id = r.local_id || r.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

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
    threshold: tool.schema
      .number()
      .optional()
      .describe(
        '搜索结果最低相关度阈值（0-1），默认 hybrid=0.01, vector=0.3, keyword=0.1。Atom scope 建议使用更低阈值。'
      ),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const mode = args.mode || 'hybrid';
    const scope = args.scope || 'all';
    const atomTypes = args.atom_types || [];
    const limit = args.limit || 10;
    const level = args.level ?? 0;
    const threshold = args.threshold ?? getDefaultThreshold(mode, scope);

    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = resolveTenantId(config);

    if (backendEnabled) {
      try {
        const rewrittenQuery = rewriteQuery(args.query, mode);
        const searchParams = {
          query: rewrittenQuery,
          mode,
          scope,
          limit,
          level,
          tenant_id: tenantId,
          threshold,
          ...(atomTypes.length > 0 && { atom_types: atomTypes }),
        };

        const result = await client.search(searchParams);

        if (result.results && result.results.length > 0) {
          const uniqueResults = deduplicateResults(result.results);
          return formatSearchResults(uniqueResults, level, scope);
        }

        // Atom scope 降级策略
        if (scope === 'atom') {
          try {
            const fallbackParams = { ...searchParams, scope: 'all' };
            delete fallbackParams.atom_types;
            const fallbackResult = await client.search(fallbackParams);
            if (fallbackResult.results && fallbackResult.results.length > 0) {
              const uniqueFallbackResults = deduplicateResults(fallbackResult.results);
              return (
                formatSearchResults(uniqueFallbackResults, level, 'all') +
                '\n\n> ⚠️ Atom scope 搜索无结果，已自动降级到 Entity scope 搜索。'
              );
            }
          } catch (_fallbackErr) {
            // 降级失败不影响主流程
          }
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
    const config = getConfig();
    const backendEnabled = config?.backend?.enabled !== false;

    // 1. 优先尝试后端 API 获取建议
    if (backendEnabled) {
      try {
        const client = getWrapperClient(config);
        const backendSuggestions = await client.suggest({
          prefix: args.prefix,
          limit: args.limit || 10,
        });
        if (Array.isArray(backendSuggestions) && backendSuggestions.length > 0) {
          return backendSuggestions.map(s => `- ${s}`).join('\n');
        }
      } catch (e) {
        // 后端不可用，静默降级到本地 Trie
        console.error('[memory_suggest] Backend suggest failed, falling back to Trie:', e.message);
      }
    }

    // 2. 后端不可用时，回退到本地 Trie 索引
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
