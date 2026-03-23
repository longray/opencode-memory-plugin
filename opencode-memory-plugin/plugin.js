import { tool } from '@opencode-ai/plugin/tool';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createBM25Index } from './lib/bm25.js';
import { getWrapperClient } from './lib/wrapper-client.js';
import { resolveProjectId } from './lib/project-resolver.js';
import * as uploadQueue from './lib/upload-queue.js';
import {
  buildTrieIndex,
  searchByPrefix,
  updateTrieIndex,
  tokenizeForTrie,
  getAutocompleteSuggestions,
} from './lib/trie-index.js';
import { initRealtimeSync, notifyLocalChange, getRealtimeSyncStatus } from './lib/ws-client.js';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');
const DAILY_DIR = path.join(MEMORY_DIR, 'daily');
const ACTIVE_DIR = path.join(MEMORY_DIR, 'active');
const SYNC_DIR = path.join(MEMORY_DIR, '.sync');
const CHECKPOINT_FILE = path.join(SYNC_DIR, 'checkpoint.jsonl');

// Checkpoint Management for v2.3 Incremental Sync
async function loadCheckpoint() {
  try {
    if (!fs.existsSync(CHECKPOINT_FILE)) {
      return {
        timestamp: new Date(0).toISOString(),
        last_sync: null,
        files: {},
        entries_count: 0,
      };
    }

    const content = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter(line => line);

    if (lines.length === 0) {
      return {
        timestamp: new Date(0).toISOString(),
        last_sync: null,
        files: {},
        entries_count: 0,
      };
    }

    // Read last checkpoint entry
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    return lastEntry;
  } catch (error) {
    console.error('[Checkpoint] Error loading checkpoint:', error.message);
    return {
      timestamp: new Date(0).toISOString(),
      last_sync: null,
      files: {},
      entries_count: 0,
    };
  }
}

async function updateCheckpoint(data) {
  try {
    // Ensure sync directory exists
    if (!fs.existsSync(SYNC_DIR)) {
      fs.mkdirSync(SYNC_DIR, { recursive: true });
    }

    const checkpointEntry = {
      timestamp: new Date().toISOString(),
      operation: data.operation || 'incremental_sync',
      files_processed: data.files_processed || 0,
      files_changed: data.files_changed || 0,
      entries_uploaded: data.entries_uploaded || 0,
      entries_failed: data.entries_failed || 0,
      entries_updated: data.entries_updated || 0,
      entries_deleted: data.entries_deleted || 0,
      status: data.status || 'completed',
      duration_ms: data.duration_ms || 0,
      errors: data.errors || [],
      ...data,
    };

    // Append to JSONL file
    const line = JSON.stringify(checkpointEntry) + '\n';
    fs.appendFileSync(CHECKPOINT_FILE, line);

    console.log(
      `[Checkpoint] Updated: ${checkpointEntry.files_changed} files changed, ${checkpointEntry.entries_uploaded} entries uploaded`
    );
    return checkpointEntry;
  } catch (error) {
    console.error('[Checkpoint] Error updating checkpoint:', error.message);
    throw error;
  }
}

async function getCheckpointHistory(limit = 10) {
  try {
    if (!fs.existsSync(CHECKPOINT_FILE)) {
      return [];
    }

    const content = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    const lines = content
      .trim()
      .split('\n')
      .filter(line => line);

    const history = lines
      .map(line => JSON.parse(line))
      .reverse()
      .slice(0, limit);

    return history;
  } catch (error) {
    console.error('[Checkpoint] Error reading history:', error.message);
    return [];
  }
}

// File Change Detection for Incremental Sync
async function detectFileChanges(checkpoint) {
  const changes = {
    added: [], // New files
    modified: [], // mtime or content changed
    deleted: [], // Local files deleted but still in checkpoint
    unchanged: [], // No changes
  };

  const currentFiles = new Map();
  const checkpointFiles = checkpoint.files || {};

  // Scan timeline/ and active/ directories
  const dirsToScan = [
    { dir: path.join(MEMORY_DIR, 'timeline'), prefix: 'timeline/' },
    { dir: ACTIVE_DIR, prefix: 'active/' },
  ];

  for (const { dir, prefix } of dirsToScan) {
    if (!fs.existsSync(dir)) continue;

    const files = await scanDirectory(dir);
    for (const file of files) {
      const relativePath = prefix + path.relative(dir, file);
      const stats = fs.statSync(file);
      const content = fs.readFileSync(file, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');

      currentFiles.set(relativePath, {
        path: file,
        mtime: stats.mtime.toISOString(),
        size: stats.size,
        hash,
      });
    }
  }

  // Compare with checkpoint
  for (const [path, current] of currentFiles) {
    const checkpointInfo = checkpointFiles[path];

    if (!checkpointInfo) {
      // New file
      changes.added.push({ path, ...current });
    } else if (checkpointInfo.hash !== current.hash) {
      // Content changed
      changes.modified.push({ path, ...current, old_hash: checkpointInfo.hash });
    } else {
      // Unchanged
      changes.unchanged.push({ path, ...current });
    }
  }

  // Find deleted files (in checkpoint but not on disk)
  for (const path of Object.keys(checkpointFiles)) {
    if (!currentFiles.has(path)) {
      changes.deleted.push({ path, ...checkpointFiles[path] });
    }
  }

  return changes;
}

async function scanDirectory(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(fullPath, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

// Incremental Sync Implementation
async function incrementalSync(ctx, options = {}) {
  const startTime = Date.now();
  const results = {
    files_processed: 0,
    files_changed: 0,
    entries_uploaded: 0,
    entries_failed: 0,
    entries_updated: 0,
    entries_deleted: 0,
    errors: [],
  };

  try {
    console.log('[Incremental Sync] Starting...');

    const checkpoint = await loadCheckpoint();
    
    if (!checkpoint || typeof checkpoint !== 'object') {
      throw new Error('Invalid checkpoint data loaded');
    }
    
    const lastSyncTime = checkpoint.timestamp || 'N/A';
    console.log(`[Incremental Sync] Last sync: ${lastSyncTime}`);

    const changes = await detectFileChanges(checkpoint);
    
    if (!changes || typeof changes !== 'object' || !Array.isArray(changes.added) || !Array.isArray(changes.modified) || !Array.isArray(changes.deleted)) {
      throw new Error('Invalid changes data structure');
    }
    
    results.files_changed = changes.added.length + changes.modified.length + changes.deleted.length;

    if (results.files_changed === 0) {
      console.log('[Incremental Sync] No changes detected');
      return { success: true, message: 'No changes to sync', results };
    }

    console.log(
      `[Incremental Sync] Changes: ${changes.added.length} added, ${changes.modified.length} modified, ${changes.deleted.length} deleted`
    );

    const config = getConfig();
    const client = getWrapperClient(config?.backend?.url);

    for (const file of changes.added) {
      try {
        if (!file || !file.path) {
          throw new Error(`Invalid file object: ${JSON.stringify(file)}`);
        }
        
        const entries = await parseMemoryFile(file.path);
        const uploadResults = await uploadEntries(client, entries, ctx);
        results.entries_uploaded += uploadResults.success;
        results.entries_failed += uploadResults.failed;
        results.files_processed++;
      } catch (error) {
        results.errors.push({ file: file.path, error: error.message });
        results.entries_failed++;
      }
    }

    for (const file of changes.modified) {
      try {
        if (!file || !file.path) {
          throw new Error(`Invalid file object: ${JSON.stringify(file)}`);
        }
        
        const entries = await parseMemoryFile(file.path);
        const uploadResults = await uploadEntries(client, entries, ctx, {
          mode: 'upsert',
          checkpoint: checkpoint.files?.[file.path],
        });
        results.entries_uploaded += uploadResults.success;
        results.entries_failed += uploadResults.failed;
        results.files_processed++;
      } catch (error) {
        results.errors.push({ file: file.path, error: error.message });
        results.entries_failed++;
      }
    }

    for (const file of changes.deleted) {
      try {
        if (!file || !file.path) {
          throw new Error(`Invalid file object: ${JSON.stringify(file)}`);
        }
        
        await deleteEntries(client, file.path);
        results.entries_deleted++;
        results.files_processed++;
      } catch (error) {
        results.errors.push({ file: file.path, error: error.message });
      }
    }

    const updatedFiles = { ...(checkpoint.files || {}) };
    for (const file of [...changes.added, ...changes.modified]) {
      if (file && file.path && file.mtime && file.size && file.hash) {
        updatedFiles[file.path] = {
          mtime: file.mtime,
          size: file.size,
          hash: file.hash,
        };
      }
    }
    for (const file of changes.deleted) {
      if (file && file.path) {
        delete updatedFiles[file.path];
      }
    }

    const duration = Date.now() - startTime;
    await updateCheckpoint({
      operation: 'incremental_sync',
      files_processed: results.files_processed,
      files_changed: results.files_changed,
      entries_uploaded: results.entries_uploaded,
      entries_failed: results.entries_failed,
      entries_updated: results.entries_updated,
      entries_deleted: results.entries_deleted,
      status: results.errors.length > 0 ? 'partial' : 'completed',
      duration_ms: duration,
      errors: results.errors.slice(0, 10),
      files: updatedFiles,
    });

    console.log(
      `[Incremental Sync] Completed in ${duration}ms: ${results.entries_uploaded} uploaded, ${results.entries_failed} failed`
    );

    return {
      success: results.errors.length === 0,
      message: `Synced ${results.entries_uploaded} entries in ${duration}ms`,
      results,
    };
  } catch (error) {
    console.error('[Incremental Sync] Error:', error.message);
    results.errors.push({ error: error.message });

    await updateCheckpoint({
      operation: 'incremental_sync',
      status: 'failed',
      duration_ms: Date.now() - startTime,
      errors: results.errors,
    });

    return {
      success: false,
      message: `Sync failed: ${error.message}`,
      results,
    };
  }
}

async function parseMemoryFile(filePath) {
  if (!filePath) {
    throw new Error('filePath is required for parseMemoryFile');
  }
  
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  
  if (typeof rawContent !== 'string' || rawContent.length === 0) {
    console.warn(`[ParseMemoryFile] Empty or invalid content for file: ${filePath}`);
    return [];
  }
  
  const content = String(rawContent);
  const entries = [];

  try {
    const sections = content.split(/^## /m).slice(1);

    for (const section of sections) {
      const sectionStr = String(section);
      const lines = sectionStr.split('\n');
      
      if (!Array.isArray(lines) || lines.length === 0) {
        continue;
      }
      
      const title = lines[0]?.trim() || '';
      const type = (title.match(/(\w+) Entry/)?.[1] || 'general');

      const metadata = {};
      let contentStart = 1;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]?.toString?.() || '';
        const match = line.match(/\*\*(\w+)\*\*:\s*(.+)/);
        if (match) {
          metadata[match[1].toLowerCase()] = match[2].trim();
        } else if (line.trim() === '') {
          contentStart = i + 1;
          break;
        }
      }

      const entryContent = lines.slice(contentStart).join('\n').trim();

      entries.push({
        type,
        ...metadata,
        content: entryContent,
        source_file: filePath,
      });
    }
  } catch (error) {
    console.error(`[ParseMemoryFile] Error parsing file ${filePath}:`, error.message);
    throw error;
  }

  return entries;
}

async function uploadEntries(client, entries, ctx, options = {}) {
  const results = { success: 0, failed: 0 };

  for (const entry of entries) {
    try {
      // Use existing upload logic or call backend
      // This is a simplified version - actual implementation should use batch API
      await client.uploadMemories([entry], {
        tenant_id: ctx?.project?.user?.username || 'default',
        project_id: await resolveProjectId(),
      });
      results.success++;
    } catch (error) {
      results.failed++;
      console.error(`[Upload] Failed to upload entry: ${error.message}`);
    }
  }

  return results;
}

async function deleteEntries(client, filePath, options = {}) {
  const results = { success: 0, failed: 0 };

  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[Delete] File not found: ${filePath}`);
      return results;
    }

    const entries = await parseMemoryFile(filePath);

    for (const entry of entries) {
      try {
        const memoryId = entry.memory_id || entry.source_id;

        if (memoryId) {
          await client.delete(`/api/v1/memories/${memoryId}`);
          results.success++;
          console.log(`[Delete] Deleted: ${memoryId}`);
        } else {
          console.log(`[Delete] No ID for entry: ${entry.content?.substring(0, 50)}`);
          results.failed++;
        }
      } catch (error) {
        console.error(`[Delete] Failed to delete: ${error.message}`);
        results.failed++;
      }
    }

    if (options.removeFile && results.failed === 0 && entries.length > 0) {
      fs.unlinkSync(filePath);
      console.log(`[Delete] Removed file: ${filePath}`);
    }

    console.log(`[Delete] Completed: ${results.success} deleted, ${results.failed} failed`);
  } catch (error) {
    console.error(`[Delete] Error processing file: ${error.message}`);
  }

  return results;
}

async function fullSync(ctx, options = {}) {
  const startTime = Date.now();
  const resumePoint = options.resumePoint || null;
  const batchSize = options.batchSize || 50;

  const results = {
    total_files: 0,
    processed_files: 0,
    entries_uploaded: 0,
    entries_updated: 0,
    entries_failed: 0,
    conflicts: [],
    errors: [],
    started_at: new Date().toISOString(),
    completed_at: null,
    duration_ms: 0,
  };

  const progress = {
    currentBatch: 0,
    totalBatches: 0,
    percentage: 0,
  };

  try {
    console.log('[Full Sync] Starting...');
    if (resumePoint) {
      console.log(`[Full Sync] Resuming from batch ${resumePoint.batch}`);
    }

    // Stream all files using generator
    const allFiles = [];
    const dirsToScan = [
      { dir: path.join(MEMORY_DIR, 'timeline'), prefix: 'timeline/' },
      { dir: ACTIVE_DIR, prefix: 'active/' },
    ];

    for (const { dir, prefix } of dirsToScan) {
      if (!fs.existsSync(dir)) continue;
      const files = await scanDirectory(dir);
      for (const file of files) {
        allFiles.push({
          path: file,
          relativePath: prefix + path.relative(dir, file),
          stats: fs.statSync(file),
        });
      }
    }

    results.total_files = allFiles.length;
    progress.totalBatches = Math.ceil(allFiles.length / batchSize);

    console.log(`[Full Sync] Found ${allFiles.length} files to sync`);

    // Get backend client
    const config = getConfig();
    const client = getWrapperClient(config?.backend?.url);

    // Fetch backend index for comparison
    const backendIndex = await fetchBackendIndex(client);
    const backendFiles = new Map();
    for (const entry of backendIndex) {
      if (entry.source_file) {
        backendFiles.set(entry.source_file, entry);
      }
    }

    // Calculate diff
    const diff = {
      toUpload: [], // Local has, backend doesn't
      toUpdate: [], // Both have, local newer
      toDelete: [], // Backend has, local doesn't
      unchanged: [], // Both have, same
      conflicts: [], // Both modified
    };

    const localFilesSet = new Set(allFiles.map(f => f.relativePath));

    // Compare local with backend
    for (const file of allFiles) {
      const backendEntry = backendFiles.get(file.relativePath);
      const content = fs.readFileSync(file.path, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex');

      if (!backendEntry) {
        diff.toUpload.push({ ...file, hash });
      } else if (backendEntry.hash !== hash) {
        const localTime = file.stats.mtime;
        const backendTime = new Date(backendEntry.updated_at);

        if (localTime > backendTime) {
          diff.toUpdate.push({ ...file, hash, backendEntry });
        } else if (localTime < backendTime) {
          // Backend is newer - potential conflict
          diff.conflicts.push({ ...file, hash, backendEntry });
        } else {
          // Same time, different content - conflict
          diff.conflicts.push({ ...file, hash, backendEntry });
        }
      } else {
        diff.unchanged.push(file);
      }
    }

    // Find files in backend but not local
    for (const [filePath, backendEntry] of backendFiles) {
      if (!localFilesSet.has(filePath)) {
        diff.toDelete.push({ relativePath: filePath, backendEntry });
      }
    }

    results.conflicts = diff.conflicts.map(c => c.relativePath);

    console.log(
      `[Full Sync] Diff: ${diff.toUpload.length} upload, ${diff.toUpdate.length} update, ${diff.toDelete.length} delete, ${diff.conflicts.length} conflicts`
    );

    // Process uploads in batches
    const filesToProcess = [...diff.toUpload, ...diff.toUpdate];
    const startBatch = resumePoint ? resumePoint.batch : 0;

    for (let i = startBatch * batchSize; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      progress.currentBatch = Math.floor(i / batchSize) + 1;
      progress.percentage = Math.round((i / filesToProcess.length) * 100);

      console.log(
        `[Full Sync] Processing batch ${progress.currentBatch}/${progress.totalBatches} (${progress.percentage}%)`
      );

      // Save progress for resume
      await saveProgress({
        batch: progress.currentBatch,
        processed: i,
        total: filesToProcess.length,
        results,
      });

      // Process batch
      for (const file of batch) {
        try {
          const entries = await parseMemoryFile(file.path);
          const isUpdate = diff.toUpdate.some(u => u.path === file.path);

          const uploadResults = await uploadEntries(client, entries, ctx, {
            mode: isUpdate ? 'upsert' : 'create',
          });

          if (isUpdate) {
            results.entries_updated += uploadResults.success;
          } else {
            results.entries_uploaded += uploadResults.success;
          }
          results.entries_failed += uploadResults.failed;
          results.processed_files++;
        } catch (error) {
          results.errors.push({ file: file.path, error: error.message });
          results.entries_failed++;
        }
      }

      // Small delay to prevent overwhelming backend
      if (i + batchSize < filesToProcess.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    // Handle deletions
    for (const file of diff.toDelete) {
      try {
        await deleteEntries(client, file.relativePath);
      } catch (error) {
        results.errors.push({ file: file.relativePath, error: error.message });
      }
    }

    // Handle conflicts if auto-resolve enabled
    if (options.autoResolve && diff.conflicts.length > 0) {
      console.log(`[Full Sync] Auto-resolving ${diff.conflicts.length} conflicts`);
      for (const conflict of diff.conflicts) {
        const resolution = await autoResolveConflict(conflict);
        if (resolution.action === 'use_local') {
          const entries = await parseMemoryFile(conflict.path);
          await uploadEntries(client, entries, ctx, { mode: 'upsert' });
          results.entries_updated += entries.length;
        }
      }
    }

    // Mark as completed
    results.completed_at = new Date().toISOString();
    results.duration_ms = Date.now() - startTime;

    // Clear progress file
    await clearProgress();

    // Update checkpoint
    await updateCheckpoint({
      operation: 'full_sync',
      files_processed: results.processed_files,
      entries_uploaded: results.entries_uploaded,
      entries_updated: results.entries_updated,
      entries_failed: results.entries_failed,
      conflicts: results.conflicts.length,
      status: results.errors.length > 0 ? 'partial' : 'completed',
      duration_ms: results.duration_ms,
      errors: results.errors.slice(0, 10),
    });

    console.log(
      `[Full Sync] Completed in ${results.duration_ms}ms: ${results.entries_uploaded} uploaded, ${results.entries_updated} updated, ${results.entries_failed} failed`
    );

    return {
      success: results.errors.length === 0 && results.conflicts.length === 0,
      message: `Full sync completed: ${results.entries_uploaded} uploaded, ${results.entries_updated} updated`,
      results,
      diff,
    };
  } catch (error) {
    console.error('[Full Sync] Error:', error.message);
    results.errors.push({ error: error.message });
    results.duration_ms = Date.now() - startTime;

    return {
      success: false,
      message: `Full sync failed: ${error.message}`,
      results,
      canResume: true,
      resumePoint: { batch: progress.currentBatch },
    };
  }
}

async function fetchBackendIndex(client) {
  try {
    // Fetch all entries from backend
    const result = await client.search({
      query: '',
      mode: 'keyword',
      limit: 10000,
    });
    return result.memories || [];
  } catch (error) {
    console.error('[Full Sync] Error fetching backend index:', error.message);
    return [];
  }
}

async function saveProgress(progress) {
  const progressFile = path.join(SYNC_DIR, 'progress.json');
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
}

async function loadProgress() {
  const progressFile = path.join(SYNC_DIR, 'progress.json');
  if (!fs.existsSync(progressFile)) return null;

  try {
    const content = fs.readFileSync(progressFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function clearProgress() {
  const progressFile = path.join(SYNC_DIR, 'progress.json');
  if (fs.existsSync(progressFile)) {
    fs.unlinkSync(progressFile);
  }
}

async function autoResolveConflict(conflict) {
  const localTime = fs.statSync(conflict.path).mtime;
  const backendTime = new Date(conflict.backendEntry.updated_at);

  if (localTime > backendTime) {
    return { action: 'use_local', reason: 'local_newer' };
  } else {
    return { action: 'use_backend', reason: 'backend_newer' };
  }
}

// Conflict Resolution Framework
async function detectConflict(localEntry, backendEntry) {
  const localModified = new Date(localEntry.updated_at || localEntry.mtime);
  const backendModified = new Date(backendEntry.updated_at);
  const timeDiff = Math.abs(localModified - backendModified);

  // Both have been modified
  if (localModified && backendModified) {
    return {
      type: timeDiff < 3600000 ? 'simultaneous' : 'sequential',
      similarity: await calculateSimilarity(localEntry, backendEntry),
      localNewer: localModified > backendModified,
      timeDiff,
    };
  }

  return null;
}

async function calculateSimilarity(localEntry, backendEntry) {
  // Simple content similarity based on length ratio
  const localContent = localEntry.content || '';
  const backendContent = backendEntry.content || '';

  if (localContent === backendContent) return 1.0;

  const maxLen = Math.max(localContent.length, backendContent.length);
  const minLen = Math.min(localContent.length, backendContent.length);

  return maxLen > 0 ? minLen / maxLen : 0;
}

function assessQuality(entry) {
  let score = 0;
  const content = entry.content || '';

  // Completeness check
  if (entry.tags && entry.tags.length > 0) score += 0.2;
  if (entry.project_id) score += 0.1;
  if (entry.type) score += 0.1;

  // Information density (word count)
  const wordCount = content.split(/\s+/).length;
  score += Math.min(wordCount / 100, 0.3);

  // Content length
  score += Math.min(content.length / 500, 0.2);

  // Source reliability
  const reliableSources = ['user', 'system', 'verified'];
  if (reliableSources.includes(entry.source)) score += 0.1;

  return Math.min(score, 1.0);
}

function autoResolve(conflict, localEntry, backendEntry) {
  // Strategy 1: Timestamp arbitration (simple scenarios)
  if (conflict.type === 'sequential') {
    return conflict.localNewer ? 'USE_LOCAL' : 'USE_BACKEND';
  }

  // Strategy 2: Content quality assessment
  const localQuality = assessQuality(localEntry);
  const backendQuality = assessQuality(backendEntry);

  if (Math.abs(localQuality - backendQuality) > 0.3) {
    return localQuality > backendQuality ? 'USE_LOCAL' : 'USE_BACKEND';
  }

  // Strategy 3: Similarity merge (high similarity)
  if (conflict.similarity > 0.9) {
    return 'MERGE';
  }

  // Requires manual decision
  return 'MANUAL';
}

function mergeEntries(localEntry, backendEntry) {
  const merged = {
    ...backendEntry,
    content:
      localEntry.content.length > backendEntry.content.length
        ? localEntry.content
        : backendEntry.content,
    tags: [...new Set([...(localEntry.tags || []), ...(backendEntry.tags || [])])],
    updated_at: new Date().toISOString(),
    merge_history: [
      ...(backendEntry.merge_history || []),
      {
        from: 'local',
        at: localEntry.updated_at,
        action: 'merge',
      },
    ],
  };

  return merged;
}

async function resolveConflict(conflictId, resolution, ctx) {
  const validResolutions = ['USE_LOCAL', 'USE_BACKEND', 'MERGE'];

  if (!validResolutions.includes(resolution)) {
    throw new Error(
      `Invalid resolution: ${resolution}. Must be one of: ${validResolutions.join(', ')}`
    );
  }

  // Load conflict from storage
  const conflictFile = path.join(SYNC_DIR, 'conflicts.json');
  if (!fs.existsSync(conflictFile)) {
    throw new Error('No conflicts file found');
  }

  const conflicts = JSON.parse(fs.readFileSync(conflictFile, 'utf-8'));
  const conflict = conflicts.find(c => c.id === conflictId);

  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  const config = getConfig();
  const client = getWrapperClient(config?.backend?.url);

  switch (resolution) {
    case 'USE_LOCAL':
      await uploadEntries(client, [conflict.local], ctx, { mode: 'upsert' });
      break;

    case 'USE_BACKEND':
      // Update local file with backend content
      await updateLocalEntry(conflict.filePath, conflict.backend);
      break;

    case 'MERGE':
      const merged = mergeEntries(conflict.local, conflict.backend);
      await uploadEntries(client, [merged], ctx, { mode: 'upsert' });
      await updateLocalEntry(conflict.filePath, merged);
      break;
  }

  // Mark conflict as resolved
  conflict.resolved = true;
  conflict.resolved_at = new Date().toISOString();
  conflict.resolution = resolution;

  fs.writeFileSync(conflictFile, JSON.stringify(conflicts, null, 2));

  return { success: true, message: `Conflict ${conflictId} resolved with ${resolution}` };
}

async function updateLocalEntry(filePath, entry) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`[Update] File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const memoryId = entry.memory_id || entry.source_id;

    if (!memoryId) {
      console.log(`[Update] No identifier to match entry`);
      return false;
    }

    const lines = content.split('\n');
    let entryStart = -1;
    let entryEnd = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ') && lines[i].includes('Entry')) {
        if (entryStart !== -1) {
          entryEnd = i;
        }

        const metadataSection = lines.slice(i + 1, i + 20).join('\n');
        if (metadataSection.includes(memoryId) || metadataSection.includes(entry.source_id)) {
          entryStart = i;
        }
      }

      if (entryStart !== -1 && entryEnd !== -1) {
        break;
      }
    }

    if (entryStart === -1) {
      console.log(`[Update] Entry not found: ${memoryId}`);
      return false;
    }

    const newEntryContent = formatEntryForMarkdown(entry);
    const newLines = [...lines.slice(0, entryStart), newEntryContent, ...lines.slice(entryEnd)];

    fs.writeFileSync(filePath, newLines.join('\n'));
    console.log(`[Update] Entry updated in ${filePath}`);
    return true;
  } catch (error) {
    console.error(`[Update] Error updating local entry: ${error.message}`);
    return false;
  }
}

function formatEntryForMarkdown(entry) {
  const lines = [`## ${entry.type || 'General'} Entry`];

  if (entry.date) {
    lines.push(`**Date**: ${entry.date}`);
  }
  if (entry.type) {
    lines.push(`**Type**: ${entry.type}`);
  }
  if (entry.tags && entry.tags.length > 0) {
    lines.push(`**Tags**: ${Array.isArray(entry.tags) ? entry.tags.join(', ') : entry.tags}`);
  }
  if (entry.project_id) {
    lines.push(`**Project**: ${entry.project_id}`);
  }
  if (entry.memory_id) {
    lines.push(`**Memory ID**: ${entry.memory_id}`);
  }
  if (entry.source_id) {
    lines.push(`**Source ID**: ${entry.source_id}`);
  }
  if (entry.merge_history) {
    lines.push(`**Merge History**: ${JSON.stringify(entry.merge_history)}`);
  }

  lines.push('');
  lines.push(entry.content || '');

  return lines.join('\n');
}

async function batchResolve(strategy, ctx) {
  const conflictFile = path.join(SYNC_DIR, 'conflicts.json');
  if (!fs.existsSync(conflictFile)) {
    return { success: true, message: 'No conflicts to resolve', resolved: 0 };
  }

  const conflicts = JSON.parse(fs.readFileSync(conflictFile, 'utf-8'));
  const unresolved = conflicts.filter(c => !c.resolved);

  if (unresolved.length === 0) {
    return { success: true, message: 'No unresolved conflicts', resolved: 0 };
  }

  const results = { resolved: 0, failed: 0, errors: [] };

  for (const conflict of unresolved) {
    try {
      let resolution;

      switch (strategy) {
        case 'ACCEPT_ALL':
          resolution = conflict.recommendation || 'MERGE';
          break;
        case 'USE_LOCAL_ALL':
          resolution = 'USE_LOCAL';
          break;
        case 'USE_BACKEND_ALL':
          resolution = 'USE_BACKEND';
          break;
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }

      await resolveConflict(conflict.id, resolution, ctx);
      results.resolved++;
    } catch (error) {
      results.failed++;
      results.errors.push({ conflict: conflict.id, error: error.message });
    }
  }

  return {
    success: results.failed === 0,
    message: `Resolved ${results.resolved} conflicts, ${results.failed} failed`,
    results,
  };
}

function generateConflictReport(conflicts) {
  return conflicts.map(c => ({
    id: c.id,
    type: c.type,
    file: c.relativePath,
    local: {
      preview: (c.local?.content || '').substring(0, 100),
      updated_at: c.local?.updated_at,
    },
    backend: {
      preview: (c.backend?.content || '').substring(0, 100),
      updated_at: c.backend?.updated_at,
    },
    recommendation: c.recommendation || autoResolve(c, c.local, c.backend),
    similarity: c.similarity || 0,
  }));
}

function getTopics() {
  if (!fs.existsSync(ACTIVE_DIR)) return [];

  const entries = fs.readdirSync(ACTIVE_DIR, { withFileTypes: true });
  return entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
}

function getConfig() {
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function scanAllTopics() {
  const topics = new Map();

  // 扫描 active/ 目录
  if (fs.existsSync(ACTIVE_DIR)) {
    const topicDirs = fs
      .readdirSync(ACTIVE_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.'));

    for (const dir of topicDirs) {
      const topicPath = path.join(ACTIVE_DIR, dir.name);
      const files = await scanDirectory(topicPath);

      let count = 0;
      let lastUpdated = new Date(0);

      for (const file of files) {
        const stats = fs.statSync(file);
        count++;
        if (stats.mtime > lastUpdated) {
          lastUpdated = stats.mtime;
        }
      }

      topics.set(dir.name, {
        name: dir.name,
        count,
        last_updated: lastUpdated.toISOString(),
      });
    }
  }

  // 扫描 timeline/ 目录，按日期分组
  const timelineDir = path.join(MEMORY_DIR, 'timeline');
  if (fs.existsSync(timelineDir)) {
    const years = fs.readdirSync(timelineDir, { withFileTypes: true })
      .filter(e => e.isDirectory());

    for (const year of years) {
      const yearPath = path.join(timelineDir, year.name);
      const months = fs.readdirSync(yearPath, { withFileTypes: true })
        .filter(e => e.isDirectory());

      for (const month of months) {
        const monthPath = path.join(yearPath, month.name);
        const days = fs.readdirSync(monthPath, { withFileTypes: true })
          .filter(e => e.isDirectory());

        for (const day of days) {
          const dayPath = path.join(monthPath, day.name);
          const files = fs.readdirSync(dayPath)
            .filter(f => f.endsWith('.md'));

          if (files.length > 0) {
            const topicName = `${year.name}-${month.name}-${day.name}`;
            let lastUpdated = new Date(0);

            for (const file of files) {
              const stats = fs.statSync(path.join(dayPath, file));
              if (stats.mtime > lastUpdated) {
                lastUpdated = stats.mtime;
              }
            }

            topics.set(topicName, {
              name: topicName,
              count: files.length,
              last_updated: lastUpdated.toISOString(),
            });
          }
        }
      }
    }
  }

  return Array.from(topics.values());
}

async function loadTimelineEntries({ since, topic = null }) {
  const entries = [];

  // Load from timeline directory
  const timelineDir = path.join(MEMORY_DIR, 'timeline');
  if (fs.existsSync(timelineDir)) {
    const years = fs.readdirSync(timelineDir);

    for (const year of years) {
      const yearPath = path.join(timelineDir, year);
      if (!fs.statSync(yearPath).isDirectory()) continue;

      const months = fs.readdirSync(yearPath);
      for (const month of months) {
        const monthPath = path.join(yearPath, month);
        if (!fs.statSync(monthPath).isDirectory()) continue;

        const days = fs.readdirSync(monthPath);
        for (const day of days) {
          const dayPath = path.join(monthPath, day);
          if (!fs.statSync(dayPath).isDirectory()) continue;

          const files = fs
            .readdirSync(dayPath)
            .filter(f => f.endsWith('.md') && !f.startsWith('.'));

          for (const file of files) {
            const filePath = path.join(dayPath, file);
            const stats = fs.statSync(filePath);

            if (stats.mtime < since) continue;

            const fileEntries = await parseMemoryFile(filePath);

            for (const entry of fileEntries) {
              if (topic && entry.topic !== topic) continue;

              entries.push({
                id: entry.id || `${year}-${month}-${day}-${file}`,
                date: stats.mtime,
                topic: entry.topic || 'general',
                type: entry.type || 'general',
                abstract: entry.abstract || entry.content?.substring(0, 100),
                content: entry.content,
              });
            }
          }
        }
      }
    }
  }

  return entries.sort((a, b) => b.date - a.date);
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

  // 添加 timeline/ 目录
  const timelineDir = path.join(MEMORY_DIR, 'timeline');
  if (fs.existsSync(timelineDir)) {
    const scanTimeline = (dir, prefix = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanTimeline(fullPath, `${prefix}${entry.name}/`);
        } else if (entry.name.endsWith('.md')) {
          files.push({
            path: fullPath,
            name: `timeline/${prefix}${entry.name}`,
          });
        }
      }
    };
    scanTimeline(timelineDir);
  }

  return files;
}

async function generateSyncFingerprints(baseDir, subDirs = []) {
  const fingerprints = [];
  const dirsToScan = subDirs.length > 0 ? subDirs.map(d => path.join(baseDir, d)) : [baseDir];

  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;

      const filePath = path.join(dir, file.name);
      const stats = fs.statSync(filePath);

      if (file.name.startsWith('.') || file.name.startsWith('_')) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      const hash = createHash('md5').update(content).digest('hex');
      const sourceId = path.basename(file.name, '.md');

      fingerprints.push({
        path: filePath,
        relativePath: path.relative(baseDir, filePath),
        mtime: stats.mtimeMs,
        size: stats.size,
        hash: hash,
        source_id: sourceId,
      });
    }
  }

  return fingerprints;
}

async function collectTopicMemories() {
  const memories = [];
  const topics = getTopics();

  for (const topic of topics) {
    const topicEntriesDir = path.join(ACTIVE_DIR, topic, 'entries');

    if (!fs.existsSync(topicEntriesDir)) continue;

    const files = fs.readdirSync(topicEntriesDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(topicEntriesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const entryId = path.basename(file, '.md');
      const sourceIdMatch = content.match(/\*\*Source ID\*\*:\s*(\S+)/);
      const typeMatch = content.match(/\*\*Type\*\*:\s*(\S+)/);
      const tagsMatch = content.match(/\*\*Tags\*\*:\s*([^\n]+)/);
      const projectMatch = content.match(/\*\*Project\*\*:\s*([^\n]+)/);
      const l0Match = content.match(/\*\*L0\*\*:\s*([^\n]+)/);
      const l1Match = content.match(/\*\*L1\*\*:\s*([^\n]+)/);
      const l2Match = content.match(/\*\*L2\*\*:\s*\n([\s\S]*)$/);

      memories.push({
        content: l2Match ? l2Match[1].trim() : content,
        type: typeMatch ? typeMatch[1] : 'general',
        tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
        project_id: projectMatch ? projectMatch[1] : 'global',
        source_id: sourceIdMatch ? sourceIdMatch[1] : entryId,
        metadata: {
          l0: l0Match ? l0Match[1].trim() : '',
          l1: l1Match ? l1Match[1].trim() : '',
          topic: topic,
          entry_id: entryId,
        },
      });
    }
  }

  return memories;
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
  const startTime = Date.now();

  // Phase C-P1: Use Trie index for fast pre-filtering
  let candidateIds = null;
  try {
    const queryTokens = tokenizeForTrie(query);
    if (queryTokens.length > 0) {
      // Use first token for prefix search
      candidateIds = await searchByPrefix(queryTokens[0]);
      if (candidateIds && candidateIds.size > 0) {
        console.log(
          `[Trie] Pre-filtered to ${candidateIds.size} candidates in ${Date.now() - startTime}ms`
        );
      }
    }
  } catch (e) {
    console.log('[Trie] Index not ready, falling back to full scan');
  }

  // If no candidates from Trie, fall back to full scan
  const useTrieFilter = candidateIds && candidateIds.size > 0;

  const files = getMemoryFiles();
  const documents = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.length > 10) {
          const docId = `${file.name}:${index + 1}`;

          // Phase C-P1: Apply Trie pre-filter if available
          if (useTrieFilter && !candidateIds.has(docId)) {
            return; // Skip non-matching documents
          }

          documents.push({
            id: docId,
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

  console.log(`[BM25] Searched ${documents.length} docs in ${Date.now() - startTime}ms`);

  return results.map(r => ({
    source: r.metadata.source,
    line: r.metadata.line,
    text: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    score: Math.min(1, r.score / 5),
  }));
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string')
    return tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  return [];
}

export const MemoryPlugin = async _ctx => {
  const config = getConfig();
  const client = getWrapperClient(config);

  // Phase C-P3: Initialize WebSocket sync
  let wsSync = null;
  const backendEnabled = config?.backend?.enabled !== false;
  if (backendEnabled) {
    try {
      wsSync = await initRealtimeSync(
        data => console.log('[Sync] Sync required:', data),
        data => console.log('[Sync] Conflict detected:', data)
      );
    } catch (e) {
      console.log('[Sync] WebSocket init failed:', e.message);
    }
  }

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
            const { content, type } = args;
            const tags = normalizeTags(args.tags);
            const timestamp = new Date().toISOString();

            const projectId = await resolveProjectId(config);

            const entry = `
## ${type.charAt(0).toUpperCase() + type.slice(1)} Entry

**Date**: ${timestamp}
**Type**: ${type}
**Tags**: ${tags.join(', ') || 'none'}
**Project**: ${projectId}

${content}

---
`;

            const today = new Date().toISOString().split('T')[0];
            const isDailyType = type === 'daily';
            const targetFile = isDailyType ? path.join(DAILY_DIR, `${today}.md`) : MEMORY_FILE;

            if (!fs.existsSync(MEMORY_DIR)) {
              fs.mkdirSync(MEMORY_DIR, { recursive: true });
            }

            if (isDailyType && !fs.existsSync(targetFile)) {
              if (!fs.existsSync(DAILY_DIR)) {
                fs.mkdirSync(DAILY_DIR, { recursive: true });
              }
              const projectMeta =
                projectId && projectId !== 'unknown' ? `**Project**: ${projectId}\n\n` : '';
              const dailyTemplate = `# Daily Memory Log - ${today}\n\n${projectMeta}*Session starts: ${new Date().toISOString()}*\n\n## Notes\n\n## Tasks\n\n## Learnings\n\n---\n`;
              fs.writeFileSync(targetFile, dailyTemplate, 'utf-8');
            }

            fs.appendFileSync(targetFile, entry, 'utf-8');
            let backendStatus = '❌ Disabled';
            let memoryId = null;
            const backendEnabled = config?.backend?.enabled !== false;

            if (backendEnabled) {
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
                if (e.name === 'DuplicateError') {
                  const dupType = e.duplicateType === 'hash' ? '完全重复' : '语义相似';
                  const simInfo = e.similarity
                    ? ` (相似度: ${(e.similarity * 100).toFixed(1)}%)`
                    : '';
                  backendStatus = `⚠️ ${dupType}${simInfo}\n- 已存在: ${e.existingId}`;
                } else {
                  uploadQueue.addToQueue(memory);
                  backendStatus = `⏳ Queued (${e.message})`;
                }
              }
            }

            return `✅ Entry written to memory
- Type: ${type}
- Tags: ${tags.join(', ') || 'none'}
- File: ${targetFile}
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
          'Search memory with configurable search mode. Uses backend service if available, falls back to local BM25.',
        args: {
          query: tool.schema.string().describe('The search query to look for in memory'),
          limit: tool.schema.number().optional().default(10).describe('Maximum number of results'),
          mode: tool.schema
            .string()
            .optional()
            .default('keyword')
            .describe(
              "Search mode: 'vector' (semantic), 'keyword' (BM25), 'hybrid' (both, recommended)"
            ),
        },
        async execute(args) {
          try {
            const { query, limit, mode } = args;
            const searchMode = mode || 'keyword';
            const backendEnabled = config?.backend?.enabled !== false;

            if (backendEnabled) {
              try {
                const health = await client.health();
                if (health.status === 'healthy') {
                  const projectId = await resolveProjectId(config);
                  const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';

                  const results = await client.search({
                    query,
                    mode: searchMode,
                    limit: limit || 10,
                    threshold: 0.0,
                    tenant_id: tenantId,
                    project_id: projectId,
                  });

                  return formatBackendResults(results.results, query, searchMode);
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
                const rawContent = fs.readFileSync(file.path, 'utf-8');
                
                if (typeof rawContent !== 'string' || rawContent.length === 0) {
                  console.warn(`[Rebuild Index] Skipping empty or invalid file: ${file.path}`);
                  continue;
                }
                
                const content = String(rawContent);
                const entryMatches = content.split(/\n## /).slice(1);

                for (const entryContent of entryMatches) {
                  const entryStr = String(entryContent);
                  const lines = entryStr.split('\n');
                  
                  if (!Array.isArray(lines) || lines.length === 0) {
                    continue;
                  }
                  
                  const title = lines[0]?.toString?.() || '';
                  const typeMatch = title.match(/^(\w+) Entry/);
                  const type = typeMatch ? typeMatch[1].toLowerCase() : 'general';

                  const tagsLine = lines.find(l => l && l.toString().startsWith('**Tags**:'));
                  const tags = tagsLine
                    ? tagsLine
                        .toString()
                        .replace('**Tags**:', '')
                        .trim()
                        .split(',')
                        .map(t => t.trim())
                        .filter(t => t && t !== 'none')
                    : [];

                  const contentStart = lines.findIndex(l => l && l.toString() === '') + 1;
                  const entryText = lines
                    .slice(contentStart)
                    .map(l => l ? l.toString() : '')
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
              } catch (e) {
                console.warn(`[Rebuild Index] Failed to parse file ${file.path}: ${e.message}`);
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
            let totalDuplicate = 0;

            for (let i = 0; i < entries.length; i += batchSize) {
              const batch = entries.slice(i, i + batchSize);
              try {
                const result = await client.uploadMemories(batch);
                totalSuccess += result.success;

                if (result.errors && result.errors.length > 0) {
                  for (let j = 0; j < result.errors.length; j++) {
                    const error = result.errors[j];

                    if (typeof error === 'object' && error.type === 'duplicate') {
                      totalDuplicate++;
                    } else {
                      totalFailed++;
                      if (batch[j]) {
                        uploadQueue.addToQueue(batch[j]);
                      }
                    }
                  }
                }
              } catch {
                totalFailed += batch.length;
                batch.forEach(entry => uploadQueue.addToQueue(entry));
              }
            }

            return `🔄 Backend sync completed:
- Total entries: ${entries.length}
- Successful: ${totalSuccess}
- Duplicates: ${totalDuplicate}
- Failed: ${totalFailed}
- Tenant: ${tenantId}
- Project: ${projectId}

${totalDuplicate > 0 ? `ℹ️ ${totalDuplicate} duplicate(s) skipped (already exists in backend).\n` : ''}${totalFailed > 0 ? '⚠️ Failed uploads queued for retry.' : ''}`;
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

      topic_sync: tool({
        description:
          'Incremental sync topic memories to backend service. Detects changes using fingerprints and only uploads modified entries.',
        args: {
          topic: tool.schema
            .string()
            .optional()
            .describe('Specific topic to sync. If omitted, syncs all topics.'),
          dry_run: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('If true, only shows what would be synced without making changes'),
          force: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('Force full sync ignoring mtime checks'),
        },
        async execute(args) {
          const { topic, dry_run = false, force = false } = args;

          try {
            const topics = topic ? [topic] : getTopics();

            if (topics.length === 0) {
              return { success: true, message: 'No topics to sync', synced: 0 };
            }

            const fingerprints = [];
            for (const t of topics) {
              const topicDir = path.join(ACTIVE_DIR, t, 'entries');
              if (fs.existsSync(topicDir)) {
                const topicFps = await generateSyncFingerprints(topicDir);
                fingerprints.push(...topicFps);
              }
            }

            if (fingerprints.length === 0) {
              return { success: true, message: 'No entries to sync', synced: 0 };
            }

            const config = getConfig();
            const client = getWrapperClient(config);

            if (dry_run) {
              return {
                success: true,
                dry_run: true,
                topics: topics,
                entry_count: fingerprints.length,
                fingerprints_preview: fingerprints.slice(0, 5).map(fp => ({
                  path: fp.relativePath,
                  hash: fp.hash.substring(0, 8),
                  mtime: new Date(fp.mtime).toISOString(),
                })),
                message: `Would sync ${fingerprints.length} entries from ${topics.length} topics`,
              };
            }

            const result = await client.syncIncremental(fingerprints);

            return {
              success: true,
              synced: result.synced || 0,
              to_upload: result.to_upload?.length || 0,
              to_delete: result.to_delete?.length || 0,
              conflicts: result.conflicts?.length || 0,
              message: `Synced ${result.synced || 0} entries`,
            };
          } catch (error) {
            return {
              success: false,
              error: error.message,
              message: `Sync failed: ${error.message}`,
            };
          }
        },
      }),

      rebuild_topics: tool({
        description:
          'Full sync and rebuild topic structure. Re-uploads all topic memories to backend service.',
        args: {
          topic: tool.schema
            .string()
            .optional()
            .describe('Specific topic to rebuild. If omitted, rebuilds all topics.'),
          dry_run: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('If true, only shows statistics without making changes'),
        },
        async execute(args) {
          const { topic, dry_run = false } = args;

          try {
            const allMemories = await collectTopicMemories();

            let memories = allMemories;
            if (topic) {
              memories = allMemories.filter(m => m.metadata.topic === topic);
            }

            if (memories.length === 0) {
              return {
                success: true,
                message: 'No memories to rebuild',
                total: 0,
              };
            }

            const stats = {
              total: memories.length,
              by_topic: {},
            };

            for (const mem of memories) {
              const t = mem.metadata.topic;
              stats.by_topic[t] = (stats.by_topic[t] || 0) + 1;
            }

            if (dry_run) {
              return {
                success: true,
                dry_run: true,
                total: memories.length,
                by_topic: stats.by_topic,
                preview: memories.slice(0, 3).map(m => ({
                  topic: m.metadata.topic,
                  entry_id: m.metadata.entry_id,
                  l0: m.metadata.l0.substring(0, 50),
                })),
                message: `Would rebuild ${memories.length} memories`,
              };
            }

            const config = getConfig();
            const client = getWrapperClient(config);
            const result = await client.syncFull(memories);

            return {
              success: result.failed === 0,
              total: result.total,
              success_count: result.success,
              failed_count: result.failed,
              by_topic: stats.by_topic,
              errors: result.errors?.slice(0, 5) || [],
              message: `Rebuilt ${result.success}/${result.total} memories`,
            };
          } catch (error) {
            return {
              success: false,
              error: error.message,
              message: `Rebuild failed: ${error.message}`,
            };
          }
        },
      }),

      memory_suggest: tool({
        description:
          'Get search autocomplete suggestions based on partial input using Trie index. Returns matching keywords from memory.',
        args: {
          prefix: tool.schema.string().describe('The partial input to get suggestions for'),
          limit: tool.schema
            .number()
            .optional()
            .default(10)
            .describe('Maximum number of suggestions'),
        },
        async execute(args) {
          try {
            const { prefix, limit } = args;
            const startTime = Date.now();

            if (!prefix || prefix.length < 2) {
              return {
                suggestions: [],
                count: 0,
                time_ms: 0,
                message: 'Please provide at least 2 characters for suggestions',
              };
            }

            // Get suggestions from Trie index
            const suggestions = await getAutocompleteSuggestions(prefix, limit);

            const duration = Date.now() - startTime;

            if (suggestions.length === 0) {
              return {
                suggestions: [],
                count: 0,
                time_ms: duration,
                message: `No suggestions found for "${prefix}"`,
              };
            }

            return {
              suggestions: suggestions.map(s => ({
                word: s.word,
                frequency: s.frequency,
                entry_count: s.entryIds.length,
              })),
              count: suggestions.length,
              time_ms: duration,
              message: `Found ${suggestions.length} suggestions for "${prefix}" in ${duration}ms`,
            };
          } catch (error) {
            return {
              suggestions: [],
              count: 0,
              error: error.message,
              message: `Failed to get suggestions: ${error.message}`,
            };
          }
        },
      }),

      sync_status: tool({
        description:
          'Get real-time synchronization status. Shows WebSocket connection state and sync statistics.',
        args: {
          detailed: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('Show detailed checkpoint history'),
        },
        async execute(args) {
          try {
            const wsStatus = getRealtimeSyncStatus();
            const checkpoint = await loadCheckpoint();
            const history = await getCheckpointHistory(3);

            let output = `📊 Sync Status Dashboard\n`;
            output += `═`.repeat(50) + `\n\n`;

            // Real-time Sync Section
            output += `🔌 Real-time Sync\n`;
            output += `  Status: ${wsStatus.enabled ? '✓ Enabled' : '✗ Disabled'}\n`;
            output += `  WebSocket: ${wsStatus.connected ? '🟢 Connected' : '🔴 Disconnected'}\n`;
            if (wsStatus.enabled) {
              output += `  Reconnect Attempts: ${wsStatus.reconnectAttempts}\n`;
              output += `  Queued Messages: ${wsStatus.queuedMessages}\n`;
            }
            output += `\n`;

            // Checkpoint Section
            output += `📋 Last Sync Checkpoint\n`;
            if (checkpoint.timestamp && checkpoint.timestamp !== new Date(0).toISOString()) {
              const lastSync = new Date(checkpoint.timestamp);
              const timeAgo = Math.round((Date.now() - lastSync) / 1000 / 60);
              output += `  Last Sync: ${timeAgo} minutes ago\n`;
              output += `  Operation: ${checkpoint.operation || 'N/A'}\n`;
              output += `  Files Changed: ${checkpoint.files_changed || 0}\n`;
              output += `  Entries Uploaded: ${checkpoint.entries_uploaded || 0}\n`;
              output += `  Status: ${checkpoint.status || 'unknown'}\n`;
            } else {
              output += `  No sync history found\n`;
            }
            output += `\n`;

            // Recent History
            if (args.detailed && history.length > 0) {
              output += `📜 Recent Sync History (last ${history.length})\n`;
              history.forEach((h, i) => {
                const time = new Date(h.timestamp).toLocaleTimeString();
                output += `  ${i + 1}. ${time} - ${h.operation} (${h.status})\n`;
                output += `     Files: ${h.files_changed}, Entries: ${h.entries_uploaded}\n`;
              });
              output += `\n`;
            }

            // Quick Actions
            output += `⚡ Quick Actions\n`;
            output += `  • incremental_sync - Sync only changed files\n`;
            output += `  • full_sync - Full synchronization\n`;
            output += `  • conflict_list - View unresolved conflicts\n`;
            output += `  • sync_checkpoint - View full history\n`;

            return output;
          } catch (error) {
            return `❌ Error getting sync status: ${error.message}`;
          }
        },
      }),

      incremental_sync: tool({
        description:
          'Perform incremental synchronization. Only uploads changed files since last sync.',
        args: {
          dry_run: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('Preview changes without uploading'),
        },
        async execute(args, ctx) {
          try {
            if (args.dry_run) {
              const checkpoint = await loadCheckpoint();
              const changes = await detectFileChanges(checkpoint);

              return `📋 Incremental Sync Dry Run\n\n` +
                `Changes detected:\n` +
                `  Added: ${changes.added.length} files\n` +
                `  Modified: ${changes.modified.length} files\n` +
                `  Deleted: ${changes.deleted.length} files\n\n` +
                `Last sync: ${checkpoint.timestamp || 'Never'}`;
            }

            const result = await incrementalSync(ctx);
            return `Incremental sync completed: ${result.message}`;
          } catch (error) {
            return `❌ Incremental sync failed: ${error.message}`;
          }
        },
      }),

      full_sync: tool({
        description:
          'Perform full synchronization. Compares all local files with backend and syncs differences. Supports resume.',
        args: {
          resume: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('Resume interrupted sync'),
          auto_resolve: tool.schema
            .boolean()
            .optional()
            .default(false)
            .describe('Auto-resolve conflicts'),
          batch_size: tool.schema
            .number()
            .optional()
            .default(50)
            .describe('Batch size for uploads'),
        },
        async execute(args, ctx) {
          try {
            let resumePoint = null;

            if (args.resume) {
              const progress = await loadProgress();
              if (progress) {
                resumePoint = { batch: progress.currentBatch };
              }
            }

            const result = await fullSync(ctx, {
              resumePoint,
              autoResolve: args.auto_resolve,
              batchSize: args.batch_size,
            });

            return result;
          } catch (error) {
            return {
              success: false,
              error: error.message,
              canResume: true,
              message: `Full sync failed: ${error.message}. Run with resume=true to continue.`,
            };
          }
        },
      }),

      conflict_list: tool({
        description: 'List unresolved sync conflicts with recommendations.',
        args: {
          limit: tool.schema.number().optional().default(10).describe('Maximum conflicts to show'),
        },
        async execute(args) {
          try {
            const conflictFile = path.join(SYNC_DIR, 'conflicts.json');

            if (!fs.existsSync(conflictFile)) {
              return {
                conflicts: [],
                count: 0,
                message: 'No conflicts found',
              };
            }

            const conflicts = JSON.parse(fs.readFileSync(conflictFile, 'utf-8'));
            const unresolved = conflicts.filter(c => !c.resolved).slice(0, args.limit);

            const report = generateConflictReport(unresolved);

            return {
              conflicts: report,
              count: unresolved.length,
              total: conflicts.length,
              message: `${unresolved.length} unresolved conflicts (of ${conflicts.length} total)`,
            };
          } catch (error) {
            return {
              conflicts: [],
              count: 0,
              error: error.message,
              message: `Failed to list conflicts: ${error.message}`,
            };
          }
        },
      }),

      conflict_resolve: tool({
        description: 'Resolve a sync conflict. Use conflict_list to see available conflicts.',
        args: {
          conflict_id: tool.schema.string().describe('ID of the conflict to resolve'),
          resolution: tool.schema
            .enum(['USE_LOCAL', 'USE_BACKEND', 'MERGE'])
            .describe('Resolution strategy'),
        },
        async execute(args, ctx) {
          try {
            const result = await resolveConflict(args.conflict_id, args.resolution, ctx);
            return result;
          } catch (error) {
            return {
              success: false,
              error: error.message,
              message: `Failed to resolve conflict: ${error.message}`,
            };
          }
        },
      }),

      sync_checkpoint: tool({
        description: 'View sync checkpoint history and status.',
        args: {
          limit: tool.schema
            .number()
            .optional()
            .default(5)
            .describe('Number of recent checkpoints to show'),
        },
        async execute(args) {
          try {
            const history = await getCheckpointHistory(args.limit);

            if (history.length === 0) {
              return {
                history: [],
                message: 'No checkpoint history found',
              };
            }

            return {
              history: history.map(h => ({
                timestamp: h.timestamp,
                operation: h.operation,
                files_changed: h.files_changed,
                entries_uploaded: h.entries_uploaded,
                status: h.status,
                duration_ms: h.duration_ms,
              })),
              message: `Last ${history.length} sync operations`,
            };
          } catch (error) {
            return {
              history: [],
              error: error.message,
              message: `Failed to get checkpoint history: ${error.message}`,
            };
          }
        },
      }),

      batch_resolve: tool({
        description: 'Batch resolve multiple conflicts with a single strategy.',
        args: {
          strategy: tool.schema
            .enum(['ACCEPT_ALL', 'USE_LOCAL_ALL', 'USE_BACKEND_ALL'])
            .describe('Resolution strategy for all conflicts'),
        },
        async execute(args, ctx) {
          try {
            const result = await batchResolve(args.strategy, ctx);
            return result;
          } catch (error) {
            return {
              success: false,
              error: error.message,
              message: `Batch resolve failed: ${error.message}`,
            };
          }
        },
      }),

      // Memory Browsing Tools
      memory_timeline: tool({
        description: 'View memories organized by timeline (date). Shows daily activity summary.',
        args: {
          days: tool.schema.number().optional().default(7).describe('Number of days to show'),
          topic: tool.schema.string().optional().describe('Filter by topic'),
        },
        async execute(args) {
          try {
            const entries = await loadTimelineEntries({
              since: new Date(Date.now() - args.days * 86400000),
              topic: args.topic,
            });

            // Group by date
            const grouped = {};
            for (const entry of entries) {
              const date = entry.date.toISOString().split('T')[0];
              if (!grouped[date]) {
                grouped[date] = {
                  date,
                  count: 0,
                  topics: {},
                  entries: [],
                };
              }
              grouped[date].count++;
              grouped[date].topics[entry.topic || 'general'] =
                (grouped[date].topics[entry.topic || 'general'] || 0) + 1;
              grouped[date].entries.push({
                id: entry.id,
                abstract: entry.abstract?.substring(0, 60) + '...',
                type: entry.type,
              });
            }

            const timeline = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));

            let output = `📅 Memory Timeline (last ${args.days} days)\n`;
            output += `═`.repeat(50) + `\n\n`;

            for (const day of timeline) {
              output += `${day.date} - ${day.count} entries\n`;
              const topicList = Object.entries(day.topics)
                .map(([t, c]) => `${t}(${c})`)
                .join(', ');
              output += `  Topics: ${topicList}\n`;

              for (const entry of day.entries.slice(0, 3)) {
                output += `  • ${entry.abstract}\n`;
              }
              if (day.entries.length > 3) {
                output += `  ... and ${day.entries.length - 3} more\n`;
              }
              output += `\n`;
            }

            return output;
          } catch (error) {
            return `❌ Error loading timeline: ${error.message}`;
          }
        },
      }),

      memory_topics: tool({
        description: 'List all topics with entry counts and last update time.',
        args: {
          min_entries: tool.schema
            .number()
            .optional()
            .default(5)
            .describe('Minimum entries to include'),
        },
        async execute(args) {
          try {
            const topics = await scanAllTopics();

            const filtered = topics
              .filter(t => t.count >= args.min_entries)
              .sort((a, b) => b.count - a.count);

            let output = `📁 Topics (${filtered.length} active)\n`;
            output += `═`.repeat(50) + `\n\n`;

            for (const topic of filtered) {
              const lastUpdate = new Date(topic.last_updated).toLocaleDateString();
              output += `${topic.name.padEnd(20)} ${topic.count} entries (last: ${lastUpdate})\n`;
              output += `  Path: active/${topic.name}/\n\n`;
            }

            return output;
          } catch (error) {
            return `❌ Error loading topics: ${error.message}`;
          }
        },
      }),
    },
  };
};
