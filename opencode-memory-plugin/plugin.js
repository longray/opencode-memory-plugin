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
    tools: {
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

            return {
              success: true,
              message: "Entry written to memory",
              file: MEMORY_FILE,
              type,
              tags,
              length: content.length
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
              return {
                success: false,
                error: `File not found: ${file}`
              };
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').length;

            return {
              success: true,
              file,
              content,
              lines,
              size: Buffer.byteLength(content, 'utf-8')
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
              return {
                success: false,
                error: `File not found: ${file}`
              };
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

            return {
              success: true,
              query,
              file,
              matches,
              count: matches.length
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
              return {
                success: false,
                error: "Memory configuration not found. Please run the initialization script."
              };
            }

            // Check if embedding is enabled
            if (!config.embedding?.enabled && config.embedding?.enabled !== undefined) {
              return {
                success: false,
                error: "Embedding is disabled in configuration",
                suggestion: "Try using memory_search for keyword search instead"
              };
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
                return {
                  success: true,
                  query,
                  mode: 'keyword',
                  matches: await fallbackKeywordSearch(query, limit),
                  count: (await fallbackKeywordSearch(query, limit)).length,
                  note: `Vector search unavailable: ${initResult.error}. Using keyword search instead.`
                };
              }
            }

            // Perform search based on mode
            let results;
            const searchMode = mode || config.search?.mode || 'hybrid';
            
            // Phase 1优化: 动态返回数量
            // semantic: 10, keyword: 6, hybrid: 5
            const optimizedLimit = searchMode === 'keyword' ? 6 : 
                                   searchMode === 'hybrid' ? 5 : 
                                   limit || 10;
            
            if (searchMode === 'vector') {
              results = await vectorStore.search(query, { limit: optimizedLimit, threshold });
            } else if (searchMode === 'keyword') {
              results = vectorStore.keywordSearch(query, { limit: optimizedLimit });
            } else {
              // Use vector search only (since we removed hybrid functionality)
              results = await vectorStore.search(query, { limit: optimizedLimit, threshold: threshold || 0.3 });
            }
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
              return {
                success: false,
                error: "Memory configuration not found. Please run the initialization script."
              };
            }

            // Check if embedding is enabled
            if (!config.embedding?.enabled && config.embedding?.enabled !== undefined) {
              return {
                success: false,
                error: "Embedding is disabled in configuration",
                suggestion: "Try using memory_search for keyword search instead"
              };
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
                return {
                  success: true,
                  query,
                  mode: 'keyword',
                  matches: await fallbackKeywordSearch(query, limit),
                  count: (await fallbackKeywordSearch(query, limit)).length,
                  note: `Vector search unavailable: ${initResult.error}. Using keyword search instead.`
                };
              }
            }

            // Perform search based on mode
            let results;
            const searchMode = mode || config.search?.mode || 'hybrid';
            
            if (searchMode === 'vector') {
              results = await vectorStore.search(query, { limit, threshold });
            } else if (searchMode === 'keyword') {
              results = vectorStore.keywordSearch(query, { limit });
            } else {
              // Use vector search only (since we removed hybrid functionality)
              results = await vectorStore.search(query, { limit, threshold: threshold || 0.3 });
            }

            return {
              success: true,
              query,
              mode: searchMode,
              matches: results.map(r => ({
                source: r.source,
                line: r.line,
                text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
                score: Math.round(r.score * 100) / 100,
                fullContent: r.content
              })),
              count: results.length,
              model: vectorStore.modelName,
              indexed: vectorStore.getIndexedCount()
            };
          } catch (e) {
            // Fall back to keyword search on error
            return {
              success: true,
              query,
              mode: 'keyword',
              matches: await fallbackKeywordSearch(query, 10),
              count: (await fallbackKeywordSearch(query, 10)).length,
              note: `Vector search failed: ${e.message}. Using keyword search.`
            };
          }
        }
      }),
              success: true,
              query,
              mode: searchMode,
              matches: results.map(r => ({
                source: r.source,
                line: r.line,
                text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
                score: Math.round(r.score * 100) / 100,
                fullContent: r.content
              })),
              count: results.length,
              model: vectorStore.modelName,
              indexed: vectorStore.getIndexedCount()
            };
          } catch (e) {
            // Fall back to keyword search on error
            return {
              success: true,
              query,
              mode: 'keyword',
              matches: await fallbackKeywordSearch(query, 10),
              count: (await fallbackKeywordSearch(query, 10)).length,
              note: `Vector search failed: ${e.message}. Using keyword search.`
            };
          }
        }
      }),

      list_daily: tool({
        description: "List available daily log files from the past N days.",
        args: {
          days: tool.schema.number().optional().default(7).describe("Number of days to look back (default: 7)")
        },
        async execute(args) {
          try {
            const { days } = args;

            if (!fs.existsSync(DAILY_DIR)) {
              return {
                success: true,
                files: [],
                count: 0,
                message: "Daily directory not found"
              };
            }

            const allFiles = fs.readdirSync(DAILY_DIR)
              .filter(f => f.endsWith('.md'))
              .sort()
              .reverse()
              .slice(0, days);

            const files = allFiles.map(file => {
              const filePath = path.join(DAILY_DIR, file);
              const stats = fs.statSync(filePath);
              return {
                name: file,
                size: stats.size,
                modified: stats.mtime
              };
            });

            return {
              success: true,
              files,
              count: files.length
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
              return {
                success: true,
                message: "Daily log already exists",
                file: dailyFile,
                date: today
              };
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

            return {
              success: true,
              message: "Daily log created",
              file: dailyFile,
              date: today
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
              return {
                success: false,
                error: "Memory configuration not found. Please run the initialization script."
              };
            }

            // Get vector store instance
            const vectorStore = getVectorStore();
            
            // Initialize
            const initResult = await vectorStore.initialize({ 
              model: config.embedding?.model 
            });
            
            if (!initResult.success) {
              return {
                success: false,
                error: `Failed to initialize vector store: ${initResult.error}`,
                fallback: initResult.fallback
              };
            }

            // Clear existing index if force rebuild
            if (force) {
              vectorStore.clearIndex();
            }

            // Get all memory files
            const files = getMemoryFiles();
            
            if (files.length === 0) {
              return {
                success: true,
                message: "No memory files found to index",
                indexedFiles: 0,
                totalChunks: 0
              };
            }

            // Index each file
            const results = [];
            let totalChunks = 0;
            
            for (const file of files) {
              try {
                const content = fs.readFileSync(file.path, 'utf-8');
                const result = await vectorStore.indexDocument(content, file.name, {
                  clearExisting: true,
                  chunkSize: config.indexing?.chunkSize || 400,
                  overlap: config.indexing?.chunkOverlap || 80
                });
                results.push({ file: file.name, indexed: result.indexed });
                totalChunks += result.indexed;
              } catch (e) {
                results.push({ file: file.name, error: e.message });
              }
            }

            // Get final status
            const status = vectorStore.getStatus();

            return {
              success: true,
              message: "Index rebuild completed",
              force,
              model: status.model,
              dimensions: status.dimensions,
              indexedFiles: files.length,
              totalChunks,
              results,
              lastIndexed: status.lastIndexed
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
              return {
                success: false,
                error: "Configuration not found"
              };
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

            return {
              success: true,
              config: {
                version: config.version,
                searchMode: config.search?.mode,
                embeddingEnabled: config.embedding?.enabled !== false,
                embeddingModel: config.embedding?.model || 'Xenova/all-MiniLM-L6-v2',
                fallbackMode: config.embedding?.fallbackMode
              },
              files,
              dailyLogCount,
              vectorIndex: {
                initialized: vectorStatus.initialized || false,
                model: vectorStatus.model || null,
                dimensions: vectorStatus.dimensions || 384,
                totalChunks: vectorStatus.totalChunks || 0,
                lastIndexed: vectorStatus.lastIndexed || null,
                dbPath: vectorStatus.dbPath || null
              }
            };
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
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
/**
 * Fallback BM25 search when vector search is unavailable
 * Uses BM25 algorithm for better relevance ranking
 * Phase 1优化: 应用动态BM25阈值
 */
async function fallbackBM25Search(query, limit = 10, mode = 'keyword') {
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
  
  // Phase 1优化: 动态BM25阈值
  // keyword: 0.5, hybrid: 0.3, semantic: 0.1
  const minScore = mode === 'keyword' ? 0.5 : 
                    mode === 'hybrid' ? 0.3 : 
                    0.1;
  
  // Create BM25 index and search with optimized threshold
  const index = createBM25Index(documents);
  const results = index.search(query, { limit, minScore });
  
  return results.map(r => ({
    source: r.metadata.source,
    line: r.metadata.line,
    text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    score: Math.min(1, r.score / 5)  // Normalize score to 0-1 range
  }));
}
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
/**
 * Legacy fallback keyword search (kept for compatibility)
 * @deprecated Use fallbackBM25Search instead
 */
async function fallbackKeywordSearch(query, limit = 10) {
  return fallbackBM25Search(query, limit, 'keyword');  // 默认使用keyword模式
}
  return fallbackBM25Search(query, limit);
}