/**
 * Trie Index Builder - constructs and manages Trie index for fast keyword search
 * Integrates with existing BM25 for ranking
 */

import fs from 'fs';
import path from 'path';
import { Trie } from './trie.js';
import { atomicWriteText } from './atomic-write.js';
import { MEMORY_DIR, CACHE_TTL_MS } from './constants.js';
import { logInfo, logError } from './logger.js';

const ACTIVE_DIR = path.join(MEMORY_DIR, 'active');

// Global trie index instance
let trieIndex = null;
let lastBuildTime = 0;
const INDEX_TTL = CACHE_TTL_MS;

/**
 * Tokenize text into searchable keywords
 * Reuses BM25 tokenization logic with enhancements
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of unique keywords
 */
export function tokenizeForTrie(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const lowerText = text.toLowerCase();

  // Remove markdown syntax
  const cleanText = lowerText
    .replace(/[#*_`[\](){}]/g, ' ')
    .replace(/\*\*.*?\*\*/g, ' ')
    .replace(/`.*?`/g, ' ')
    .replace(/\[.*?\]\(.*?\)/g, ' ');

  // Split by whitespace and punctuation
  const tokens = cleanText
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2); // Min 2 chars

  // Extract additional keywords: camelCase, snake_case, kebab-case
  const additionalTokens = [];
  for (const token of tokens) {
    // camelCase
    const camelSplit = token.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    additionalTokens.push(...camelSplit);

    // snake_case and kebab-case
    const underscoreSplit = token.split(/[_-]+/);
    if (underscoreSplit.length > 1) {
      additionalTokens.push(...underscoreSplit);
    }
  }

  // Combine and deduplicate
  const allTokens = [...tokens, ...additionalTokens];
  return [...new Set(allTokens)].filter(t => t.length >= 2);
}

/**
 * Extract metadata from memory entry content
 * @param {string} content - Entry content
 * @returns {{tags: string[], type: string, project: string}}
 */
export function extractMetadata(content) {
  const metadata = {
    tags: [],
    type: 'general',
    project: 'global',
  };

  if (!content) return metadata;

  // Extract tags: **Tags**: tag1, tag2
  const tagsMatch = content.match(/\*\*Tags\*\*:\s*([^\n]+)/i);
  if (tagsMatch) {
    metadata.tags = tagsMatch[1]
      .split(/[,;]/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);
  }

  // Extract type: **Type**: type
  const typeMatch = content.match(/\*\*Type\*\*:\s*(\w+)/i);
  if (typeMatch) {
    metadata.type = typeMatch[1].toLowerCase();
  }

  // Extract project: **Project**: project
  const projectMatch = content.match(/\*\*Project\*\*:\s*([^\n]+)/i);
  if (projectMatch) {
    metadata.project = projectMatch[1].trim().toLowerCase();
  }

  return metadata;
}

/**
 * Build Trie index from all memory files
 * @param {boolean} force - Force rebuild even if index is fresh
 * @returns {Trie} The built trie index
 */
export async function buildTrieIndex(force = false) {
  const now = Date.now();

  // Return cached index if fresh
  if (!force && trieIndex && now - lastBuildTime < INDEX_TTL) {
    return trieIndex;
  }

  logInfo('TrieIndex', 'Building index...');
  const startTime = Date.now();

  trieIndex = new Trie();

  // Scan timeline directory
  const timelineDir = path.join(MEMORY_DIR, 'timeline');
  if (fs.existsSync(timelineDir)) {
    await scanDirectory(timelineDir, trieIndex);
  }

  // Scan active topics
  if (fs.existsSync(ACTIVE_DIR)) {
    const topics = fs.readdirSync(ACTIVE_DIR);
    for (const topic of topics) {
      const topicDir = path.join(ACTIVE_DIR, topic, 'entries');
      if (fs.existsSync(topicDir)) {
        await scanDirectory(topicDir, trieIndex);
      }
    }
  }

  // Scan core memory files
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md'];
  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      await indexFile(filePath, 'core-' + file, trieIndex);
    }
  }

  lastBuildTime = now;
  const duration = Date.now() - startTime;
  const stats = trieIndex.getStats();

  logInfo('TrieIndex', `Built in ${duration}ms`, stats);

  return trieIndex;
}

/**
 * Scan directory and index all markdown files
 */
async function scanDirectory(dir, trie) {
  const files = fs.readdirSync(dir, { recursive: true });

  for (const file of files) {
    if (typeof file === 'string' && file.endsWith('.md')) {
      const filePath = path.join(dir, file);
      const entryId = path.basename(file, '.md');
      await indexFile(filePath, entryId, trie);
    }
  }
}

/**
 * Index a single file into the trie
 */
async function indexFile(filePath, entryId, trie) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines
      if (!line.trim()) continue;

      // Skip metadata lines but extract keywords from them
      if (line.startsWith('**')) {
        const metaKeywords = extractMetadataKeywords(line);
        for (const keyword of metaKeywords) {
          trie.insert(keyword, entryId, 2); // Higher weight for metadata
        }
        continue;
      }

      // Index content lines
      const keywords = tokenizeForTrie(line);
      for (const keyword of keywords) {
        trie.insert(keyword, entryId, 1);
      }
    }
  } catch (e) {
    logError('TrieIndex', `Error indexing ${filePath}`, e);
  }
}

/**
 * Extract searchable keywords from metadata lines
 */
function extractMetadataKeywords(line) {
  const keywords = [];

  // **Tags**: tag1, tag2
  const tagsMatch = line.match(/\*\*Tags\*\*:\s*([^\n]+)/i);
  if (tagsMatch) {
    const tags = tagsMatch[1].split(/[,;]/).map(t => t.trim().toLowerCase());
    keywords.push(...tags);
  }

  // **Type**: type
  const typeMatch = line.match(/\*\*Type\*\*:\s*(\w+)/i);
  if (typeMatch) {
    keywords.push(typeMatch[1].toLowerCase());
  }

  // **Project**: project
  const projectMatch = line.match(/\*\*Project\*\*:\s*([^\n]+)/i);
  if (projectMatch) {
    keywords.push(...tokenizeForTrie(projectMatch[1]));
  }

  return keywords.filter(k => k.length >= 2);
}

/**
 * Update trie index incrementally when a new entry is added
 * @param {string} entryId - The entry ID
 * @param {string} content - The entry content
 * @param {string[]} tags - Entry tags
 */
export async function updateTrieIndex(entryId, content, tags = []) {
  if (!trieIndex) {
    await buildTrieIndex();
    return;
  }

  // Index content
  const keywords = tokenizeForTrie(content);
  for (const keyword of keywords) {
    trieIndex.insert(keyword, entryId, 1);
  }

  // Index tags with higher weight
  for (const tag of tags) {
    if (tag && tag.length >= 2) {
      trieIndex.insert(tag.toLowerCase(), entryId, 2);
    }
  }

  logInfo('TrieIndex', `Updated with entry: ${entryId}`);
}

/**
 * Search by prefix using trie index
 * @param {string} prefix - Search prefix
 * @returns {Set<string>} Set of matching entry IDs
 */
export async function searchByPrefix(prefix) {
  if (!trieIndex) {
    await buildTrieIndex();
  }

  return trieIndex.search(prefix);
}

/**
 * Get autocomplete suggestions
 * @param {string} prefix - The prefix to complete
 * @param {number} limit - Maximum suggestions
 * @returns {Array} Suggestions with word and frequency
 */
export async function getAutocompleteSuggestions(prefix, limit = 10) {
  if (!trieIndex) {
    await buildTrieIndex();
  }

  return trieIndex.getSuggestions(prefix, limit);
}

/**
 * Get current trie index statistics
 * @returns {object} Statistics
 */
export function getTrieStats() {
  if (!trieIndex) {
    return { size: 0, totalEntryIds: 0, nodeCount: 0 };
  }
  return trieIndex.getStats();
}

/**
 * Clear and rebuild the index
 */
export async function clearTrieIndex() {
  trieIndex = null;
  lastBuildTime = 0;
  await buildTrieIndex(true);
}

/**
 * Save trie index to disk for persistence
 * @param {string} filePath - Path to save index
 */
export async function saveTrieIndex(filePath) {
  if (!trieIndex) {
    return;
  }

  try {
    const serialized = trieIndex.serialize();
    atomicWriteText(filePath, JSON.stringify(serialized));
    logInfo('TrieIndex', `Saved to ${filePath}`);
  } catch (e) {
    logError('TrieIndex', 'Error saving index', e);
  }
}

/**
 * Load trie index from disk
 * @param {string} filePath - Path to load index from
 */
export async function loadTrieIndex(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    trieIndex = Trie.deserialize(data);
    lastBuildTime = Date.now();

    logInfo('TrieIndex', `Loaded from ${filePath}`);
    return true;
  } catch (e) {
    logError('TrieIndex', 'Error loading index', e);
    return false;
  }
}

export default {
  buildTrieIndex,
  updateTrieIndex,
  searchByPrefix,
  getAutocompleteSuggestions,
  getTrieStats,
  clearTrieIndex,
  saveTrieIndex,
  loadTrieIndex,
  tokenizeForTrie,
  extractMetadata,
};
