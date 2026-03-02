import { tool } from '@opencode-ai/plugin/tool';
import fs from 'fs';
import path from 'path';
import { getVectorStore } from './lib/vector-store.js';
import { BM25Index, createBM25Index } from './lib/bm25.js';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');
const DAILY_DIR = path.join(MEMORY_DIR, 'daily');

/**
 * Read memory configuration
 */
function getConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Get all memory files to index
 */
function getMemoryFiles() {
  const files = [];

  // Core memory files
  const coreFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md'];
  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      files.push({ path: filePath, name: file });
    }
  }

  // Daily logs
  if (fs.existsSync(DAILY_DIR)) {
    const dailyFiles = fs.readdirSync(DAILY_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 30); // Last 30 days

    for (const file of dailyFiles) {
      files.push({
        path: path.join(DAILY_DIR, file),
        name: `daily/${file}`
      });
    }
  }

  return files;
}

/**
 * OpenCode Memory Plugin
 * Provides persistent memory functionality for OpenCode
 */
export const MemoryPlugin = async (ctx) => {
  return {
    tool: {
      memory_write: tool({
        description: "Write an entry to long-term memory. Use this to save important information that should persist across sessions.",
        args: {
          content: tool.schema.string().describe("The content to write to memory"),
          type: tool.schema.string().optional().default("general").describe("The type of entry (e.g., 'preference', 'decision', 'note', 'general')"),
          tags: tool.schema.array(tool.schema.string()).optional().default([]).describe("Tags for categorizing the entry")
        },
        async execute(args) {
          try {
            const { content, type, tags } = args;
            const timestamp = new Date().toISOString();

            const entry = `
## ${type.charAt(0).toUpperCase() + type.slice(1)} Entry

**Date**: ${timestamp}
**Type**: ${type}
**Tags**: ${tags.join(', ') || 'none'}

${content}

---
`;

            // Ensure memory directory exists
            if (!fs.existsSync(MEMORY_DIR)) {
              fs.mkdirSync(MEMORY_DIR, { recursive: true });
            }

            // Append to memory file
            fs.appendFileSync(MEMORY_FILE, entry, 'utf-8');

            return `✅ Entry written to memory
- Type: ${type}
- Tags: ${tags.join(', ') || 'none'}
- File: ${MEMORY_FILE}
- Length: ${content.length} characters`;
          } catch (e) {
            return `❌ Error writing to memory: ${e.message}`;
          }
        }
      }),

      memory_read: tool({
        description: "Read from a memory file. Defaults to MEMORY.md for long-term memory.",
        args: {
          file: tool.schema.string().optional().default("MEMORY.md").describe("The memory file to read (e.g., 'MEMORY.md', 'SOUL.md', 'AGENTS.md')")
        },
        async execute(args) {
          try {
            const file = args.file || 'MEMORY.md';
            const filePath = path.join(MEMORY_DIR, file);

            if (!fs.existsSync(filePath)) {
              return `❌ File not found: ${file}`;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').length;
            const size = Buffer.byteLength(content, 'utf-8');

            return `📖 Memory file: ${file}
- Lines: ${lines}
- Size: ${size} bytes
- Path: ${filePath}

---
${content}`;
          } catch (e) {
            return `❌ Error reading memory: ${e.message}`;
          }
        }
      }),

      memory_search: tool({
        description: "Search memory files using keyword matching. Returns lines containing the search query.",
        args: {
          query: tool.schema.string().describe("The search query to look for in memory"),
          file: tool.schema.string().optional().default("MEMORY.md").describe("The memory file to search (default: MEMORY.md)")
        },
        async execute(args) {
          try {
            const query = args.query;
            const file = args.file || 'MEMORY.md';
            const filePath = path.join(MEMORY_DIR, file);

            if (!fs.existsSync(filePath)) {
              return `❌ File not found: ${file}`;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            // Find matching lines
            const matches = [];
            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                matches.push({
                  line: index + 1,
                  text: line.trim()
                });
              }
            });

            if (matches.length === 0) {
              return `🔍 No matches found for query: "${query}"`;
            }

            let result = `🔍 Found ${matches.length} matches for "${query}" in ${file}:
`;
            matches.slice(0, 10).forEach(m => {
              result += `\n  Line ${m.line}: ${m.text.substring(0, 100)}${m.text.length > 100 ? '...' : ''}`;
            });

            if (matches.length > 10) {
              result += `\n  ... and ${matches.length - 10} more matches`;
            }

            return result;
          } catch (e) {
            return `❌ Error searching memory: ${e.message}`;
          }
        }
      }),

      vector_memory_search: tool({
        description: "Search memory using semantic vector search. Finds relevant content even when keywords don't match exactly.",
        args: {
          query: tool.schema.string().describe("The semantic search query"),
          mode: tool.schema.string().optional().default("hybrid").describe("Search mode: 'vector' (semantic only), 'keyword' (exact match), or 'hybrid' (both)"),
          limit: tool.schema.number().optional().default(10).describe("Maximum number of results to return"),
          threshold: tool.schema.number().optional().default(0.3).describe("Minimum similarity score (0-1)")
        },
        async execute(args) {
          const { query, mode, limit, threshold } = args;

          try {
            const config = getConfig();

            if (!config) {
              return `❌ Memory configuration not found. Please run initialization script.`;
            }

            // Check if embedding is enabled
            if (!config.embedding?.enabled && config.embedding?.enabled !== undefined) {
              return `❌ Embedding is disabled in configuration. Try using memory_search for keyword search instead.`;
            }

            // Get vector store instance
            const vectorStore = getVectorStore();

            // Initialize if needed
            let initResult;
            if (!vectorStore.initialized) {
              initResult = await vectorStore.initialize({
                model: config.embedding?.model
              });

              if (!initResult.success) {
                // Fall back to keyword search
                const fallbackResults = await fallbackKeywordSearch(query, limit);
                return `⚠️ Vector search unavailable: ${initResult.error}. Using keyword search instead.

🔍 Found ${fallbackResults.length} matches for "${query}":
${fallbackResults.slice(0, 5).map(r => `  [${r.score.toFixed(2)}] ${r.source}:${r.line} - ${r.text.substring(0, 100)}`).join('\n')}`;
              }
            }

            // Perform search based on mode
            let results;
            const searchMode = mode || config.search?.mode || 'hybrid';

            // Phase 1 optimization: Dynamic result limits
            const optimizedLimit = searchMode === 'keyword' ? 6 :
                                   searchMode === 'hybrid' ? 5 :
                                   limit;

            // Phase 1 optimization: BM25 thresholds
            const bm25MinScore = searchMode === 'keyword' ? 0.5 :
                                   searchMode === 'hybrid' ? 0.3 : 0.1;

            if (searchMode === 'vector') {
              results = await vectorStore.search(query, { limit: optimizedLimit, threshold });
            } else if (searchMode === 'keyword') {
              // Keyword mode: Use BM25 only
              const files = getMemoryFiles();
              const documents = [];
              for (const file of files) {
                try {
                  const content = fs.readFileSync(file.path, 'utf-8');
                  const lines = content.split('\n');
                  lines.forEach((line, index) => {
                    if (line.trim().length > 10) {
                      documents.push({
                        id: `${file.name}:${index + 1}`,
                        content: line.trim(),
                        metadata: { source: file.name, line: index + 1 }
                      });
                    }
                  });
                } catch (e) { /* skip */ }
              }
              results = vectorStore.keywordSearch(query, documents, {
                limit: optimizedLimit,
                minScore: bm25MinScore
              });
            } else {
              // Hybrid mode: Use RRF fusion
              const files = getMemoryFiles();
              const documents = [];
              for (const file of files) {
                try {
                  const content = fs.readFileSync(file.path, 'utf-8');
                  const lines = content.split('\n');
                  lines.forEach((line, index) => {
                    if (line.trim().length > 10) {
                      documents.push({
                        id: `${file.name}:${index + 1}`,
                        content: line.trim(),
                        metadata: { source: file.name, line: index + 1 }
                      });
                    }
                  });
                } catch (e) { /* skip */ }
              }
              results = await vectorStore.hybridSearch(query, documents, {
                limit: optimizedLimit,
                vectorThreshold: threshold || 0.3,
                bm25MinScore,
                fusionStrategy: 'rrf',
                fusionOptions: { k: 20 }
              });
            }

            let output = `🔍 Vector search results for "${query}" (mode: ${searchMode}):
`;
            results.slice(0, 10).forEach(r => {
              output += `\n  [${r.score.toFixed(2)}] ${r.source}:${r.line}`;
              output += `\n    ${r.content.substring(0, 150)}${r.content.length > 150 ? '...' : ''}`;
            });

            output += `\n\n📊 Statistics:
- Model: ${vectorStore.modelName}
- Total indexed: ${vectorStore.getIndexedCount()} chunks
- Results: ${results.length}`;

            return output;
          } catch (e) {
            // Fall back to keyword search on error
            const fallbackResults = await fallbackKeywordSearch(query, 10);
            return `⚠️ Vector search failed: ${e.message}. Using keyword search instead.

🔍 Found ${fallbackResults.length} matches:
${fallbackResults.slice(0, 5).map(r => `  [${r.score.toFixed(2)}] ${r.source}:${r.line} - ${r.text.substring(0, 100)}`).join('\n')}`;
          }
        }
      }),

      list_daily: tool({
        description: "List available daily log files from past N days.",
        args: {
          days: tool.schema.number().optional().default(7).describe("Number of days to look back (default: 7)")
        },
        async execute(args) {
          try {
            const { days } = args;

            if (!fs.existsSync(DAILY_DIR)) {
              return `📂 Daily directory not found`;
            }

            const allFiles = fs.readdirSync(DAILY_DIR)
              .filter(f => f.endsWith('.md'))
              .sort()
              .reverse()
              .slice(0, days);

            if (allFiles.length === 0) {
              return `📂 No daily log files found in the last ${days} days`;
            }

            let output = `📂 Daily log files (last ${days} days):
`;
            allFiles.forEach(file => {
              const filePath = path.join(DAILY_DIR, file);
              const stats = fs.statSync(filePath);
              output += `\n  📄 ${file}`;
              output += `\n     Size: ${(stats.size / 1024).toFixed(2)} KB`;
              output += `\n     Modified: ${stats.mtime.toISOString()}`;
            });

            return output;
          } catch (e) {
            return `❌ Error listing daily logs: ${e.message}`;
          }
        }
      }),

      init_daily: tool({
        description: "Initialize today's daily log file if it doesn't exist.",
        args: {},
        async execute(args) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const dailyFile = path.join(DAILY_DIR, `${today}.md`);

            if (fs.existsSync(dailyFile)) {
              return `✅ Daily log already exists: ${dailyFile}`;
            }

            // Create daily directory if needed
            if (!fs.existsSync(DAILY_DIR)) {
              fs.mkdirSync(DAILY_DIR, { recursive: true });
            }

            const content = `# Daily Memory Log - ${today}

*Session starts: ${new Date().toISOString()}*

## Notes

## Tasks

## Learnings

---
`;

            fs.writeFileSync(dailyFile, content, 'utf-8');

            return `✅ Daily log created: ${dailyFile}
- Date: ${today}`;
          } catch (e) {
            return `❌ Error creating daily log: ${e.message}`;
          }
        }
      }),

      rebuild_index: tool({
        description: "Rebuild the vector search index for all memory files. This processes all memory files and creates embeddings for semantic search.",
        args: {
          force: tool.schema.boolean().optional().default(false).describe("Force rebuild even if index exists")
        },
        async execute(args) {
          try {
            const { force } = args;
            const config = getConfig();

            if (!config) {
              return `❌ Memory configuration not found. Please run initialization script.`;
            }

            // Get vector store instance
            const vectorStore = getVectorStore();

            // Initialize
            const initResult = await vectorStore.initialize({
              model: config.embedding?.model
            });

            if (!initResult.success) {
              return `❌ Failed to initialize vector store: ${initResult.error}
- Fallback: ${initResult.fallback}`;
            }

            // Clear existing index if force rebuild
            if (force) {
              vectorStore.clearIndex();
            }

            // Get all memory files
            const files = getMemoryFiles();

            if (files.length === 0) {
              return `✅ No memory files found to index`;
            }

            // Index each file
            let output = `🔄 Rebuilding vector search index (force: ${force})...
`;
            let totalChunks = 0;

            for (const file of files) {
              try {
                const content = fs.readFileSync(file.path, 'utf-8');
                const result = await vectorStore.indexDocument(content, file.name, {
                  clearExisting: true,
                  chunkSize: config.indexing?.chunkSize || 400,
                  overlap: config.indexing?.chunkOverlap || 80
                });
                output += `\n  ✓ ${file.name}: ${result.indexed} chunks indexed`;
                totalChunks += result.indexed;
              } catch (e) {
                output += `\n  ✗ ${file.name}: ${e.message}`;
              }
            }

            // Get final status
            const status = vectorStore.getStatus();

            output += `\n\n📊 Index rebuild completed:
- Model: ${status.model}
- Dimensions: ${status.dimensions}
- Indexed files: ${files.length}
- Total chunks: ${totalChunks}
- Last indexed: ${status.lastIndexed}`;

            return output;
          } catch (e) {
            return `❌ Error rebuilding index: ${e.message}`;
          }
        }
      }),

      index_status: tool({
        description: "Check the status of the vector search index and memory configuration.",
        args: {},
        async execute(args) {
          try {
            const config = getConfig();

            if (!config) {
              return `❌ Configuration not found`;
            }

            // Check memory files
            const memoryFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md'];
            const files = {};
            memoryFiles.forEach(file => {
              const filePath = path.join(MEMORY_DIR, file);
              files[file] = {
                exists: fs.existsSync(filePath),
                size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
              };
            });

            // Check daily logs
            let dailyLogCount = 0;
            if (fs.existsSync(DAILY_DIR)) {
              const dailyFiles = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md'));
              dailyLogCount = dailyFiles.length;
            }

            // Get vector store status
            const vectorStore = getVectorStore();
            let vectorStatus = { initialized: false };

            try {
              vectorStatus = vectorStore.getStatus();
            } catch (e) {
              // Vector store not initialized
            }

            let output = `📊 Memory Plugin Status\n\n`;
            output += `📁 Configuration:\n`;
            output += `- Version: ${config.version}\n`;
            output += `- Search Mode: ${config.search?.mode}\n`;
            output += `- Embedding Enabled: ${config.embedding?.enabled !== false}\n`;
            output += `- Embedding Model: ${config.embedding?.model || 'Xenova/all-MiniLM-L6-v2'}\n`;
            output += `- Fallback Mode: ${config.embedding?.fallbackMode}\n\n`;

            output += `📄 Memory Files:\n`;
            Object.entries(files).forEach(([file, info]) => {
              output += `- ${file}: ${info.exists ? '✓' : '✗'} (${(info.size / 1024).toFixed(2)} KB)\n`;
            });
            output += `- Daily logs: ${dailyLogCount} files\n\n`;

            output += `🔍 Vector Index:\n`;
            output += `- Initialized: ${vectorStatus.initialized || false}\n`;
            output += `- Model: ${vectorStatus.model || 'N/A'}\n`;
            output += `- Dimensions: ${vectorStatus.dimensions || 'N/A'}\n`;
            output += `- Total chunks: ${vectorStatus.totalChunks || 0}\n`;
            output += `- Last indexed: ${vectorStatus.lastIndexed || 'Never'}\n`;
            if (vectorStatus.dbPath) {
              output += `- Database: ${vectorStatus.dbPath}\n`;
            }

            return output;
          } catch (e) {
            return `❌ Error getting status: ${e.message}`;
          }
        }
      })
    }
  };
};

/**
 * Fallback BM25 search when vector search is unavailable
 * Uses BM25 algorithm for better relevance ranking
 */
async function fallbackBM25Search(query, limit = 10) {
  const files = getMemoryFiles();

  // Collect all documents
  const documents = [];
  let docId = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const lines = content.split('\n');

      // Index each line as a separate document for better granularity
      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 10) {  // Skip very short lines
          documents.push({
            id: `${file.name}:${index + 1}`,
            content: trimmedLine,
            metadata: {
              source: file.name,
              line: index + 1
            }
          });
        }
      });
    } catch (e) {
      // Skip files that can't be read
    }
  }

  if (documents.length === 0) {
    return [];
  }

  // Create BM25 index and search
  const index = createBM25Index(documents);
  const results = index.search(query, { limit, minScore: 0.01 });

  return results.map(r => ({
    source: r.metadata.source,
    line: r.metadata.line,
    text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    score: Math.min(1, r.score / 5)  // Normalize score to 0-1 range
  }));
}

/**
 * Legacy fallback keyword search (kept for compatibility)
 * @deprecated Use fallbackBM25Search instead
 */
async function fallbackKeywordSearch(query, limit = 10) {
  return fallbackBM25Search(query, limit);
}
