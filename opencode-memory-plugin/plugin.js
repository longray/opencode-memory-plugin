import { tool } from '@opencode-ai/plugin/tool';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { getVectorStore } from './lib/vector-store.js';
import { createBM25Index } from './lib/bm25.js';
import { getWrapperClient } from './lib/wrapper-client.js';
import { resolveProjectId } from './lib/project-resolver.js';
import * as uploadQueue from './lib/upload-queue.js';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');
const DAILY_DIR = path.join(MEMORY_DIR, 'daily');

function getConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getMemoryFiles() {
  const files = [];

  const coreFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md', 'IDENTITY.md', 'TOOLS.md'];
  for (const file of coreFiles) {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      files.push({ path: filePath, name: file });
    }
  }

  if (fs.existsSync(DAILY_DIR)) {
    const dailyFiles = fs
      .readdirSync(DAILY_DIR)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, 30);

    for (const file of dailyFiles) {
      files.push({
        path: path.join(DAILY_DIR, file),
        name: `daily/${file}`,
      });
    }
  }

  return files;
}

function generateSourceId(content, type, tags, tenantId, projectId) {
  const normalizedTags = (tags || []).sort().join(',');
  const data = `${tenantId}:${projectId}:${content}:${type}:${normalizedTags}`;
  return createHash('md5').update(data).digest('hex');
}

function formatBackendResults(results, query, mode) {
  if (!results || results.length === 0) {
    return `🔍 No matches found for "${query}"`;
  }

  let output = `🔍 Found ${results.length} matches for "${query}" (mode: ${mode}):
`;

  results.slice(0, 10).forEach(r => {
    output += `
  [${(r.score || 0).toFixed(2)}] ${r.id || 'unknown'}`;
    if (r.project_id && r.project_id !== 'global') {
      output += ` (${r.project_id})`;
    }
    output += `
    ${(r.content || '').substring(0, 150)}${(r.content || '').length > 150 ? '...' : ''}`;
    if (r.tags && r.tags.length > 0) {
      output += `
    Tags: ${r.tags.join(', ')}`;
    }
  });

  if (results.length > 10) {
    output += `
  ... and ${results.length - 10} more matches`;
  }

  return output;
}

async function fallbackBM25Search(query, limit = 10) {
  const files = getMemoryFiles();
  const documents = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 10) {
          documents.push({
            id: `${file.name}:${index + 1}`,
            content: trimmedLine,
            metadata: {
              source: file.name,
              line: index + 1,
            },
          });
        }
      });
    } catch {
      // Skip files that can't be read
    }
  }

  if (documents.length === 0) {
    return [];
  }

  const index = createBM25Index(documents);
  const results = index.search(query, { limit, minScore: 0.01 });

  return results.map(r => ({
    source: r.metadata.source,
    line: r.metadata.line,
    text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    score: Math.min(1, r.score / 5),
  }));
}

export const MemoryPlugin = async _ctx => {
  const config = getConfig();
  const client = getWrapperClient(config);

  return {
    tool: {
      memory_write: tool({
        description:
          'Write an entry to long-term memory. Automatically syncs to backend service if available.',
        args: {
          content: tool.schema.string().describe('The content to write to memory'),
          type: tool.schema
            .string()
            .optional()
            .default('general')
            .describe("The type of entry (e.g., 'preference', 'decision', 'note', 'general')"),
          tags: tool.schema
            .array(tool.schema.string())
            .optional()
            .default([])
            .describe('Tags for categorizing the entry'),
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

            if (!fs.existsSync(MEMORY_DIR)) {
              fs.mkdirSync(MEMORY_DIR, { recursive: true });
            }

            fs.appendFileSync(MEMORY_FILE, entry, 'utf-8');
            // Async upload to backend (non-blocking)
            let backendStatus = '❌ Disabled';
            let memoryId = null;
            const backendEnabled = config?.backend?.enabled !== false;

            if (backendEnabled) {
              const projectId = await resolveProjectId(config);
              const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';
              const sourceId = generateSourceId(content, type, tags, tenantId, projectId);

              const memory = {
                content,
                type,
                tags,
                project_id: projectId,
                source_id: sourceId,
                tenant_id: tenantId,
                source: 'plugin',
                metadata: { written_at: timestamp },
              };

              try {
                const result = await client.uploadMemory(memory);
                memoryId = result.id;
                backendStatus = `✅ Synced (${result.id})`;
              } catch (e) {
                // Add to queue for retry
                uploadQueue.addToQueue(memory);
                backendStatus = `⏳ Queued (${e.message})`;
              }
            }

            return `✅ Entry written to memory
- Type: ${type}
- Tags: ${tags.join(', ') || 'none'}
- File: ${MEMORY_FILE}
- Length: ${content.length} characters
- Backend: ${backendStatus}${memoryId ? `\n- Memory ID: ${memoryId}` : ''}`;
          } catch (e) {
            return `❌ Error writing to memory: ${e.message}`;
          }
        },
      }),

      memory_read: tool({
        description: 'Read from a memory file. Defaults to MEMORY.md for long-term memory.',
        args: {
          file: tool.schema
            .string()
            .optional()
            .default('MEMORY.md')
            .describe("The memory file to read (e.g., 'MEMORY.md', 'SOUL.md', 'AGENTS.md')"),
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
        },
      }),

      memory_search: tool({
        description:
          'Search memory using keyword matching. Uses backend service if available, falls back to local BM25.',
        args: {
          query: tool.schema.string().describe('The search query to look for in memory'),
          limit: tool.schema.number().optional().default(10).describe('Maximum number of results'),
        },
        async execute(args) {
          try {
            const { query, limit } = args;
            const backendEnabled = config?.backend?.enabled !== false;

            if (backendEnabled) {
              try {
                const health = await client.health();
                if (health.status === 'healthy') {
                  const projectId = await resolveProjectId(config);
                  const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';

                  const results = await client.search({
                    query,
                    mode: 'keyword',
                    limit: limit || 10,
                    threshold: 0.0,
                    tenant_id: tenantId,
                    project_id: projectId,
                  });

                  return formatBackendResults(results.results, query, 'keyword');
                }
              } catch {
                // Fall back to local
              }
            }

            // Fallback to local BM25
            const fallbackResults = await fallbackBM25Search(query, limit);

            if (fallbackResults.length === 0) {
              return `🔍 No matches found for query: "${query}"`;
            }

            let result = `🔍 Found ${fallbackResults.length} matches for "${query}" (local fallback):
`;
            fallbackResults.slice(0, 10).forEach(r => {
              result += `
  [${r.score.toFixed(2)}] ${r.source}:${r.line}: ${r.text.substring(0, 100)}${r.text.length > 100 ? '...' : ''}`;
            });

            if (fallbackResults.length > 10) {
              result += `
  ... and ${fallbackResults.length - 10} more matches`;
            }

            return result;
          } catch (e) {
            return `❌ Error searching memory: ${e.message}`;
          }
        },
      }),

      list_daily: tool({
        description: 'List available daily log files from past N days.',
        args: {
          days: tool.schema
            .number()
            .optional()
            .default(7)
            .describe('Number of days to look back (default: 7)'),
        },
        async execute(args) {
          try {
            const { days } = args;

            if (!fs.existsSync(DAILY_DIR)) {
              return `📂 Daily directory not found`;
            }

            const allFiles = fs
              .readdirSync(DAILY_DIR)
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
              output += `
  📄 ${file}
     Size: ${(stats.size / 1024).toFixed(2)} KB
     Modified: ${stats.mtime.toISOString()}`;
            });

            return output;
          } catch (e) {
            return `❌ Error listing daily logs: ${e.message}`;
          }
        },
      }),

      init_daily: tool({
        description: "Initialize today's daily log file if it doesn't exist.",
        args: {},
        async execute(_args) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const dailyFile = path.join(DAILY_DIR, `${today}.md`);

            if (fs.existsSync(dailyFile)) {
              return `✅ Daily log already exists: ${dailyFile}`;
            }

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
        },
      }),

      rebuild_index: tool({
        description:
          'Sync all local memory files to backend service. Replaces local vector indexing with backend synchronization.',
        args: {
          dry_run: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('Show what would be synced without actually uploading'),
        },
        async execute(args) {
          try {
            const { dry_run } = args;
            const backendEnabled = config?.backend?.enabled !== false;

            if (!backendEnabled) {
              return `❌ Backend sync is disabled in configuration.`;
            }

            const health = await client.health();
            if (health.status !== 'healthy') {
              return `❌ Backend service unavailable: ${health.error || 'Unknown error'}`;
            }

            const files = getMemoryFiles();
            if (files.length === 0) {
              return `✅ No memory files found to sync`;
            }

            // Parse entries from files
            const entries = [];
            const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';
            const projectId = await resolveProjectId(config);

            for (const file of files) {
              try {
                const content = fs.readFileSync(file.path, 'utf-8');
                // Parse markdown entries (simplified)
                const entryMatches = content.split(/\n## /).slice(1);

                for (const entryContent of entryMatches) {
                  const lines = entryContent.split('\n');
                  const title = lines[0];
                  const typeMatch = title.match(/^(\w+) Entry/);
                  const type = typeMatch ? typeMatch[1].toLowerCase() : 'general';

                  // Extract tags
                  const tagsLine = lines.find(l => l.startsWith('**Tags**:'));
                  const tags = tagsLine
                    ? tagsLine
                        .replace('**Tags**:', '')
                        .trim()
                        .split(',')
                        .map(t => t.trim())
                        .filter(t => t && t !== 'none')
                    : [];

                  // Extract content (everything after the metadata)
                  const contentStart = lines.findIndex(l => l === '') + 1;
                  const entryText = lines
                    .slice(contentStart)
                    .join('\n')
                    .replace(/---\s*$/, '')
                    .trim();

                  if (entryText) {
                    const sourceId = generateSourceId(entryText, type, tags, tenantId, projectId);
                    entries.push({
                      content: entryText,
                      type,
                      tags,
                      project_id: projectId,
                      source_id: sourceId,
                      tenant_id: tenantId,
                      source: 'plugin',
                      metadata: { source_file: file.name },
                    });
                  }
                }
              } catch {
                // Skip files that can't be read
              }
            }

            if (entries.length === 0) {
              return `✅ No entries found in memory files`;
            }

            if (dry_run) {
              return `📊 Dry run results:
- Files: ${files.length}
- Entries to sync: ${entries.length}
- Tenant: ${tenantId}
- Project: ${projectId}

First 5 entries:
${entries
  .slice(0, 5)
  .map(e => `- [${e.type}] ${e.content.substring(0, 50)}...`)
  .join('\n')}`;
            }

            // Batch upload
            const batchSize = config?.backend?.sync?.batch_size || 10;
            let totalSuccess = 0;
            let totalFailed = 0;

            for (let i = 0; i < entries.length; i += batchSize) {
              const batch = entries.slice(i, i + batchSize);
              try {
                const result = await client.uploadMemories(batch);
                totalSuccess += result.success;
                totalFailed += result.failed;
              } catch {
                totalFailed += batch.length;
                // Add failed entries to queue for retry
                batch.forEach(entry => uploadQueue.addToQueue(entry));
              }
            }

            return `🔄 Backend sync completed:
- Total entries: ${entries.length}
- Successful: ${totalSuccess}
- Failed: ${totalFailed}
- Tenant: ${tenantId}
- Project: ${projectId}

${totalFailed > 0 ? '⚠️ Failed uploads queued for retry.' : ''}`;
          } catch (e) {
            return `❌ Error syncing to backend: ${e.message}`;
          }
        },
      }),

      index_status: tool({
        description: 'Check the status of the memory system including backend service health.',
        args: {},
        async execute(_args) {
          try {
            const backendEnabled = config?.backend?.enabled !== false;
            let backendStatus = null;

            if (backendEnabled) {
              try {
                backendStatus = await client.health();
              } catch (e) {
                backendStatus = { status: 'unavailable', error: e.message };
              }
            }

            // Local status
            const memoryFiles = ['MEMORY.md', 'SOUL.md', 'AGENTS.md', 'USER.md'];
            const files = {};
            memoryFiles.forEach(file => {
              const filePath = path.join(MEMORY_DIR, file);
              files[file] = {
                exists: fs.existsSync(filePath),
                size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
              };
            });

            let dailyLogCount = 0;
            if (fs.existsSync(DAILY_DIR)) {
              dailyLogCount = fs.readdirSync(DAILY_DIR).filter(f => f.endsWith('.md')).length;
            }

            // Vector store status (legacy)
            const vectorStore = getVectorStore();
            let vectorStatus = { initialized: false };
            try {
              vectorStatus = vectorStore.getStatus();
            } catch {
              // Vector store not initialized
            }

            // Queue status
            const queueStats = uploadQueue.getQueueStats();

            let output = `📊 Memory Plugin Status\n\n`;

            output += `📁 Configuration:\n`;
            output += `- Version: ${config?.version || 'unknown'}\n`;
            output += `- Search Mode: ${config?.search?.mode || 'hybrid'}\n`;
            output += `- Backend Enabled: ${backendEnabled}\n`;
            if (backendEnabled) {
              output += `- Backend URL: ${config?.backend?.url || 'http://localhost:17999'}\n`;
              output += `- Tenant ID: ${config?.backend?.tenant_id || process.env.USERNAME || 'default'}\n`;
            }
            output += `\n`;

            output += `🌐 Backend Service:\n`;
            if (backendStatus) {
              output += `- Status: ${backendStatus.status === 'healthy' ? '✓ healthy' : '✗ ' + backendStatus.status}\n`;
              if (backendStatus.embedding_service) {
                output += `- Embedding: ${backendStatus.embedding_service.status}\n`;
              }
              if (backendStatus.surrealdb) {
                output += `- SurrealDB: ${backendStatus.surrealdb.status}\n`;
              }
              if (backendStatus.cache_stats) {
                output += `- Cache: ${backendStatus.cache_stats.hit_rate?.toFixed(1) || 0}% hit rate\n`;
              }
            } else {
              output += `- Status: disabled\n`;
            }
            output += `\n`;

            output += `📄 Local Memory Files:\n`;
            Object.entries(files).forEach(([file, info]) => {
              output += `- ${file}: ${info.exists ? '✓' : '✗'} (${(info.size / 1024).toFixed(2)} KB)\n`;
            });
            output += `- Daily logs: ${dailyLogCount} files\n`;
            output += `- Upload queue: ${queueStats.pending} pending, ${queueStats.exhausted} exhausted\n`;
            output += `\n`;

            output += `🔍 Legacy Vector Index:\n`;
            output += `- Initialized: ${vectorStatus.initialized || false}\n`;
            output += `- Model: ${vectorStatus.model || 'N/A'}\n`;
            output += `- Total chunks: ${vectorStatus.totalChunks || 0}\n`;

            return output;
          } catch (e) {
            return `❌ Error getting status: ${e.message}`;
          }
        },
      }),

      memory_relate: tool({
        description: 'Create, query, or delete relations between memories in the graph database.',
        args: {
          action: tool.schema
            .string()
            .describe("Action to perform: 'create', 'query', or 'delete'"),
          from_id: tool.schema.string().optional().describe('Source memory ID (for create action)'),
          to_id: tool.schema.string().optional().describe('Target memory ID (for create action)'),
          relation_type: tool.schema
            .string()
            .optional()
            .default('related')
            .describe(
              "Type: 'related', 'follow_up', 'elaboration', 'contradiction', 'reference', 'derived_from'"
            ),
          memory_id: tool.schema
            .string()
            .optional()
            .describe('Memory ID (for query/delete actions)'),
          direction: tool.schema
            .string()
            .optional()
            .default('both')
            .describe("For query: 'outgoing', 'incoming', or 'both'"),
          weight: tool.schema
            .number()
            .optional()
            .default(0.5)
            .describe('Relation strength 0.0-1.0 (for create)'),
        },
        async execute(args) {
          try {
            const backendEnabled = config?.backend?.enabled !== false;
            if (!backendEnabled) {
              return `❌ Backend service is disabled. Graph relations require backend.`;
            }

            const health = await client.health();
            if (health.status !== 'healthy') {
              return `❌ Backend service unavailable: ${health.error || 'Unknown error'}`;
            }

            const { action, from_id, to_id, relation_type, memory_id, direction, weight } = args;

            if (action === 'create') {
              if (!from_id || !to_id) {
                return `❌ Missing required parameters: from_id and to_id are required for create action`;
              }

              const result = await client.createRelation({
                from_id,
                to_id,
                relationship_type: relation_type,
                weight: weight || 0.5,
              });

              return `✅ Relation created:
- ID: ${result.id}
- From: ${from_id}
- To: ${to_id}
- Type: ${relation_type}
- Weight: ${weight || 0.5}`;
            }

            if (action === 'query') {
              if (!memory_id) {
                return `❌ Missing required parameter: memory_id is required for query action`;
              }

              const result = await client.getRelations({
                memory_id,
                direction: direction || 'both',
                relationship_type: relation_type,
              });

              if (!result.relations || result.relations.length === 0) {
                return `🔍 No relations found for memory ${memory_id}`;
              }

              let output = `🔍 Found ${result.total} relations for ${memory_id}:\n`;
              result.relations.forEach(r => {
                output += `
  [${r.direction}] ${r.relationship_type} (weight: ${r.weight})
  ${r.from_id} → ${r.to_id}`;
                if (r.description) {
                  output += `
  Description: ${r.description}`;
                }
              });

              return output;
            }

            if (action === 'delete') {
              if (!memory_id) {
                return `❌ Missing required parameter: memory_id (relation ID) is required for delete action`;
              }

              await client.deleteRelation(memory_id);
              return `✅ Relation ${memory_id} deleted`;
            }

            return `❌ Unknown action: ${action}. Use 'create', 'query', or 'delete'.`;
          } catch (e) {
            return `❌ Error in memory_relate: ${e.message}`;
          }
        },
      }),

      memory_graph: tool({
        description: 'Traverse the memory graph to find related memories (multi-hop traversal).',
        args: {
          memory_id: tool.schema.string().describe('Starting memory ID'),
          depth: tool.schema.number().optional().default(2).describe('Traversal depth (1-3)'),
          limit: tool.schema.number().optional().default(20).describe('Maximum number of results'),
        },
        async execute(args) {
          try {
            const backendEnabled = config?.backend?.enabled !== false;
            if (!backendEnabled) {
              return `❌ Backend service is disabled. Graph traversal requires backend.`;
            }

            const health = await client.health();
            if (health.status !== 'healthy') {
              return `❌ Backend service unavailable: ${health.error || 'Unknown error'}`;
            }

            const { memory_id, depth, limit } = args;

            const result = await client.traverseGraph({
              memory_id,
              depth: Math.min(Math.max(depth || 2, 1), 3),
              limit: limit || 20,
            });

            if (!result.memories || result.memories.length === 0) {
              return `🔍 No related memories found from ${memory_id} (depth: ${depth || 2})`;
            }

            let output = `🔍 Graph traversal from ${memory_id}:\n`;
            output += `- Depth: ${result.depth}\n`;
            output += `- Total related: ${result.total}\n\n`;

            result.memories.slice(0, limit || 20).forEach((m, i) => {
              output += `${i + 1}. [${m.id || 'unknown'}]`;
              if (m.type) {
                output += ` (${m.type})`;
              }
              output += `\n   ${(m.content || '').substring(0, 100)}${(m.content || '').length > 100 ? '...' : ''}\n`;
            });

            if (result.memories.length > (limit || 20)) {
              output += `\n... and ${result.memories.length - (limit || 20)} more`;
            }

            return output;
          } catch (e) {
            return `❌ Error in memory_graph: ${e.message}`;
          }
        },
      }),
    },
  };
};
