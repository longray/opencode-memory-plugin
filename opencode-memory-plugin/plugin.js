import { tool } from '@opencode-ai/plugin/tool';
import fs from 'fs';
import path from 'path';
import { getVectorStore } from './lib/vector-store.js';
import { BM25Index, createBM25Index } from './lib/bm25.js';
import * as stats from './lib/statistics-utils.js';
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
              // Phase 2: 真正的hybrid模式，使用RRF融合策略
              const files = getMemoryFiles();
              const documents = [];
              let docId = 0;
              
              for (const file of files) {
                try {
                  const content = fs.readFileSync(file.path, 'utf-8');
                  const lines = content.split('\n');
                  lines.forEach((line, index) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.length > 10) {
                      documents.push({
                        id: `doc_${docId++}`,
                        content: trimmedLine,
                        metadata: { source: file.name, line: index + 1 }
                      });
                    }
                  });
                } catch (e) {
                  // Skip files that can't be read
                }
              }
              
              // Use hybrid search with RRF fusion
              results = await vectorStore.hybridSearch(query, documents, {
                limit: optimizedLimit,
                vectorThreshold: threshold || 0.3,
                bm25MinScore: 0.1,
                fusionStrategy: 'rrf',
                fusionOptions: { k: 60 }
              });
            }
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

      bm25_diagnose: tool({
        description: "Diagnose BM25 search performance and score distribution. Use this to analyze how BM25 ranks documents and understand score patterns.",
        args: {
          query: tool.schema.string().describe("The search query to analyze"),
          mode: tool.schema.string().optional().default("keyword").describe("Analysis mode: 'keyword' or 'hybrid'"),
          limit: tool.schema.number().optional().default(10).describe("Maximum number of results to return")
        },
        async execute(args) {
          const { query, mode, limit } = args;
          
          try {
            // Get all memory files
            const files = getMemoryFiles();
            const documents = [];
            let docId = 0;
            
            for (const file of files) {
              try {
                const content = fs.readFileSync(file.path, 'utf-8');
                // Split into chunks
                const lines = content.split('\\n');
                const chunkSize = 400;
                let i = 0;
                while (i < lines.length) {
                  const endLine = Math.min(i + chunkSize, lines.length);
                  const chunk = lines.slice(i, endLine).join('\\n');
                  if (chunk.trim()) {
                    documents.push({
                      id: `doc_${docId++}`,
                      content: chunk,
                      source: file.name,
                      line: i + 1
                    });
                  }
                  i += chunkSize;
                }
              } catch (e) {
                // Skip files that can't be read
              }
            }
            
            if (documents.length === 0) {
              return {
                success: false,
                error: "No documents found to analyze"
              };
            }
            
            // Create BM25 index
            const index = createBM25Index(documents);
            
            // Determine minScore based on mode (Phase 1 optimization)
            const minScore = mode === 'keyword' ? 0.5 : mode === 'hybrid' ? 0.3 : 0.1;
            
            // Perform search with diagnostics
            const { results, diagnostics } = index.searchWithDiagnostics(query, {
              limit: limit || 10,
              minScore
            });
            
            // Also get vector search diagnostics if in hybrid mode
            let vectorDiagnostics = null;
            if (mode === 'hybrid' || mode === 'vector') {
              try {
                const vectorStore = getVectorStore();
                if (vectorStore.initialized) {
                  const vectorResult = await vectorStore.searchWithDiagnostics(query, {
                    limit: limit || 10,
                    threshold: 0.3
                  });
                  vectorDiagnostics = vectorResult.diagnostics;
                }
              } catch (e) {
                // Vector search not available
              }
            }
            
            // Generate analysis report
            const report = {
              success: true,
              query,
              mode,
              documentCount: documents.length,
              bm25Analysis: {
                totalDocs: diagnostics.totalDocs,
                queryTerms: diagnostics.queryTerms,
                processingTime: diagnostics.processingTime + 'ms',
                scoreDistribution: {
                  ...diagnostics.scoreDistribution,
                  allScores: undefined // Remove raw scores to reduce size
                },
                idfStats: diagnostics.idfStats
              },
              topResults: results.map(r => ({
                source: r.metadata?.source || r.id,
                score: Math.round(r.score * 100) / 100,
                preview: r.content.substring(0, 100) + (r.content.length > 100 ? '...' : '')
              }))
            };
            
            if (vectorDiagnostics) {
              report.vectorAnalysis = {
                totalChunks: vectorDiagnostics.totalChunks,
                processingTime: vectorDiagnostics.processingTime + 'ms',
                embeddingTime: vectorDiagnostics.embeddingTime + 'ms',
                scoreDistribution: vectorDiagnostics.scoreDistribution
              };
            }
            
            return report;
          } catch (e) {
            return {
              success: false,
              error: e.message
            };
          }
        }
      }),

      })

      bm25_diagnose: tool({
        description: "Analyze BM25 score distribution for search queries. Useful for understanding keyword matching behavior and optimizing search parameters.",
        args: {
          query: tool.schema.string().describe("The search query to analyze"),
          mode: tool.schema.string().optional().default("keyword").describe("Search mode: 'keyword', 'hybrid', or 'semantic'"),
          limit: tool.schema.number().optional().default(10).describe("Maximum results to return")
        },
        async execute(args) {
          const { query, mode, limit } = args;
          
          try {
            // Get memory files
            const files = getMemoryFiles();
            const documents = [];
            
            for (const file of files) {
              try {
                const content = fs.readFileSync(file.path, 'utf-8');
                // Split into chunks for analysis
                const lines = content.split('\n');
                const chunkSize = 400;
                const overlap = 80;
                
                let i = 0;
                while (i < lines.length) {
                  const endLine = Math.min(i + chunkSize, lines.length);
                  const chunkContent = lines.slice(i, endLine).join('\n');
                  
                  if (chunkContent.trim()) {
                    documents.push({
                      id: `${file.name}#${Math.floor(i/chunkSize)}`,
                      content: chunkContent.trim(),
                      source: file.name
                    });
                  }
                  
                  i += (chunkSize - overlap);
                }
              } catch (e) {
                console.error(`Error reading ${file.name}:`, e.message);
              }
            }
            
            if (documents.length === 0) {
              return {
                success: false,
                error: "No documents found to analyze"
              };
            }
            
            // Create BM25 index
            const index = createBM25Index(documents);
            
            // Determine minScore based on mode (Phase 1 optimization)
            const minScore = mode === 'keyword' ? 0.5 : mode === 'hybrid' ? 0.3 : 0.1;
            
            // Perform search with diagnostics
            const { results, diagnostics } = index.searchWithDiagnostics(query, {
              limit,
              minScore
            });
            
            // Generate distribution report using statistics-utils
            const scoreDist = diagnostics.scoreDistribution;
            let distributionReport = '';
            
            if (scoreDist.count > 0) {
              const allScores = documents.map(d => index.calculateBM25Score(d, index.tokenize(query)));
              distributionReport = stats.generateDistributionReport(
                stats.calculateScoreDistribution(allScores),
                `BM25分数 (${mode}模式)`
              );
            }
            
            // Check for long-tailed distribution
            const isLongTailed = scoreDist.count > 0 ? stats.isLongTailedDistribution({
              count: scoreDist.count,
              mean: scoreDist.mean,
              median: scoreDist.median,
              percentiles: scoreDist.percentiles || {}
            }) : false;
            
            return {
              success: true,
              query,
              mode,
              totalDocsAnalyzed: diagnostics.totalDocs,
              resultsAboveThreshold: scoreDist.aboveThreshold || 0,
              processingTime: diagnostics.processingTime,
              idfStats: diagnostics.idfStats,
              scoreDistribution: {
                count: scoreDist.count,
                min: scoreDist.min,
                max: scoreDist.max,
                mean: scoreDist.mean,
                percentiles: scoreDist.percentiles
              },
              isLongTailedDistribution: isLongTailed,
              topResults: results.slice(0, 5).map(r => ({
                source: r.id,
                score: Math.round(r.score * 1000) / 1000,
                snippet: r.content.substring(0, 100) + (r.content.length > 100 ? '...' : '')
              })),
              distributionReport
            };
          } catch (e) {
            return {
              success: false,
              error: e.message,
              stack: e.stack
            };
          }
        }
      }),

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