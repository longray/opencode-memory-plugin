import { tool } from '@opencode-ai/plugin/tool';
import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs';
import { writeEntryToTimeline } from '../lib/entry.js';
import {
  updateLinkMap,
  removeFromLinkMap,
  updateMemoryIndex,
  updateDayOverview,
} from '../lib/indexer.js';
import { getConfig, deleteEntryFile } from '../lib/storage.js';
import { LINK_MAP_FILE } from '../lib/constants.js';
import { getWrapperClient } from '../lib/wrapper-client.js';
import { resolveProjectId } from '../lib/project-resolver.js';

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string')
    return tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  return [];
}

function generateSourceId(content, type, tags, tenantId, projectId) {
  const str = `${content}|${type}|${tags.join(',')}|${tenantId}|${projectId}`;
  return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

export const memory_write = tool({
  description: 'Write an entry to long-term memory. abstract and overview are REQUIRED.',
  args: {
    content: tool.schema.string().describe('L2: Full content (required)'),
    abstract: tool.schema.string().describe('L0: Summary ≤100 chars (REQUIRED)'),
    overview: tool.schema.string().describe('L1: Key points ≤500 chars (REQUIRED)'),
    type: tool.schema.string().optional().default('general'),
    tags: tool.schema.array(tool.schema.string()).optional().default([]),
    pinned: tool.schema.boolean().optional().default(false),
  },
  async execute(args) {
    const config = getConfig();
    const client = getWrapperClient(config);
    const projectId = await resolveProjectId(config);

    const abstract = (args.abstract || '').trim();
    const overview = (args.overview || '').trim();
    const content = args.content;
    const type = args.type || 'general';
    const tags = normalizeTags(args.tags);
    const timestamp = new Date().toISOString();

    if (!abstract) {
      return '❌ Error: abstract is REQUIRED. Generate it before calling memory_write.';
    }
    if (!overview) {
      return '❌ Error: overview is REQUIRED. Generate it before calling memory_write.';
    }

    const tenantId = config?.backend?.tenant_id || process.env.USERNAME || 'default';
    const sourceId = generateSourceId(content, type, tags, tenantId, projectId);

    const result = await writeEntryToTimeline(
      { abstract, overview, content },
      { type, tags, project: projectId, source_id: sourceId }
    );

    await updateLinkMap(
      {
        id: result.localId,
        abstract,
        overview,
        type,
        tags,
        pinned: args.pinned || false,
        synced: false,
        memory_id: null,
      },
      result.filePath
    );

    const dayDir = path.dirname(result.filePath);
    await updateDayOverview(dayDir, { abstract, type, fileName: result.fileName });
    await updateMemoryIndex({ abstract, type }, result.localId);

    let backendStatus = '❌ Disabled';
    let memoryId = null;

    const backendEnabled = config?.backend?.enabled !== false;
    if (backendEnabled) {
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
        const uploadResult = await client.uploadMemory(memory);
        memoryId = uploadResult.id;
        backendStatus = `✅ Synced (${uploadResult.id})`;

        const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
        if (linkMap.entries[result.localId]) {
          linkMap.entries[result.localId].synced = true;
          linkMap.entries[result.localId].memory_id = memoryId;
          fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
        }
      } catch (e) {
        if (e.name === 'DuplicateError') {
          const dupType = e.duplicateType === 'hash' ? '完全重复' : '语义相似';

          deleteEntryFile(result.filePath);
          await removeFromLinkMap(result.localId);
          await updateMemoryIndex({ abstract, type }, result.localId);

          return `⚠️ 记忆未保存：内容与后端重复 (${dupType})\n- 摘要: ${abstract.substring(0, 40)}...\n- 后端 ID: ${e.existingId}\n- 本地文件已回滚`;
        }
        backendStatus = `⏳ Queued (${e.message})`;
      }
    }

    return `✅ Memory saved
- ID: ${result.localId}
- Abstract: ${abstract.substring(0, 50)}...
- File: ${result.filePath}
- Backend: ${backendStatus}${memoryId ? `\n- Memory ID: ${memoryId}` : ''}`;
  },
});
