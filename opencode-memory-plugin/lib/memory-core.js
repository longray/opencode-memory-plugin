/**
 * Memory Core - Unified memory operations
 *
 * 统一 CLI 和 Plugin 的记忆操作，避免代码重复
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { writeEntryToTimeline } from './entry.js';
import {
  updateLinkMap,
  removeFromLinkMap,
  updateMemoryIndex,
  updateDayOverview,
} from './indexer.js';
import { deleteEntryFile } from './storage.js';
import { LINK_MAP_FILE } from './constants.js';
import { getEntryById } from './storage.js';
import { extractByLevel } from './extractor.js';

/**
 * 写入记忆到本地和后端
 *
 * @param {Object} params - 写入参数
 * @param {string} params.abstract - L0 摘要（必填）
 * @param {string} params.overview - L1 概览（必填）
 * @param {string} params.content - L2 完整内容（必填）
 * @param {string} params.type - 条目类型（默认 'general'）
 * @param {string[]} params.tags - 标签列表（默认 []）
 * @param {boolean} params.pinned - 是否置顶（默认 false）
 * @param {string} params.source_id - 来源 ID（可选）
 * @param {string} params.project_id - 项目 ID（可选）
 * @param {string} params.source - 来源标识（默认 'cli'）
 * @returns {Promise<{success: boolean, localId: string, filePath: string, memoryId: string | null, message: string}>}
 */
export async function writeMemory({
  abstract,
  overview,
  content,
  type = 'general',
  tags = [],
  pinned = false,
  source_id,
  project_id,
  meta = [],
  source: _source = 'cli',
}) {
  // 参数验证
  if (!abstract || typeof abstract !== 'string' || abstract.trim() === '') {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: '❌ Error: abstract is REQUIRED and must be a non-empty string',
    };
  }

  if (!overview || typeof overview !== 'string' || overview.trim() === '') {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: '❌ Error: overview is REQUIRED and must be a non-empty string',
    };
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: '❌ Error: content is REQUIRED and must be a non-empty string',
    };
  }

  if (type && typeof type !== 'string') {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: '❌ Error: type must be a string',
    };
  }

  if (tags && !Array.isArray(tags)) {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: '❌ Error: tags must be an array of strings',
    };
  }

  if (typeof pinned !== 'boolean') {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: '❌ Error: pinned must be a boolean',
    };
  }

  try {
    // 1. 写入本地文件
    const result = await writeEntryToTimeline(
      { abstract, overview, content },
      { type, tags, project: project_id, source_id, meta }
    );

    // 2. 更新 link-map
    await updateLinkMap(
      {
        id: result.localId,
        abstract,
        overview,
        type,
        tags,
        pinned,
        synced: false,
        memory_id: null,
      },
      result.filePath
    );

    // 3. 更新每日概览
    const dayDir = path.dirname(result.filePath);
    await updateDayOverview(dayDir, { abstract, type, fileName: result.fileName });

    // 4. 更新 MEMORY.md 索引
    await updateMemoryIndex({ abstract, type }, result.localId);

    // 5. 返回成功结果（不包含后端同步）
    return {
      success: true,
      localId: result.localId,
      filePath: result.filePath,
      memoryId: null,
      message: `✅ Memory saved locally\n- ID: ${result.localId}\n- File: ${result.filePath}`,
    };
  } catch (error) {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message: `❌ Write failed: ${error.message}`,
    };
  }
}

/**
 * 同步记忆到后端
 *
 * @param {Object} params - 同步参数
 * @param {string} params.localId - 本地条目 ID
 * @param {string} params.filePath - 本地文件路径
 * @param {string} params.content - 完整内容
 * @param {string} params.type - 条目类型
 * @param {string[]} params.tags - 标签列表
 * @param {string} params.project_id - 项目 ID
 * @param {string} params.source_id - 来源 ID
 * @param {string} params.tenant_id - 租户 ID
 * @param {string} params.source - 来源标识
 * @param {Object} params.metadata - 元数据
 * @param {Object} params.client - WrapperClient 实例
 * @returns {Promise<{success: boolean, memoryId: string | null, message: string}>}
 */
export async function syncMemoryToBackend({
  localId,
  filePath,
  content,
  abstract,
  overview,
  type,
  tags,
  project_id,
  source_id,
  tenant_id,
  source = 'cli',
  metadata = {},
  client,
}) {
  try {
    const memory = {
      content,
      abstract,
      overview,
      type,
      tags,
      project_id,
      source_id,
      tenant_id,
      source,
      metadata,
    };

    const uploadResult = await client.uploadMemory(memory);
    const memoryId = uploadResult.id;

    // 更新 link-map
    const linkMap = JSON.parse(fs.readFileSync(LINK_MAP_FILE, 'utf-8'));
    if (linkMap.entries[localId]) {
      linkMap.entries[localId].synced = true;
      linkMap.entries[localId].memory_id = memoryId;
      fs.writeFileSync(LINK_MAP_FILE, JSON.stringify(linkMap, null, 2));
    }

    return {
      success: true,
      memoryId,
      message: `✅ Synced to backend (${memoryId})`,
    };
  } catch (error) {
    // 处理重复错误
    if (error.name === 'DuplicateError') {
      const dupType = error.duplicateType === 'hash' ? '完全重复' : '语义相似';

      // 删除本地文件
      deleteEntryFile(filePath);

      // 从 link-map 移除
      await removeFromLinkMap(localId);

      return {
        success: false,
        memoryId: error.existingId || null,
        message: `⚠️ 记忆未保存：内容与后端重复 (${dupType})\n- 后端 ID: ${error.existingId}\n- 本地文件已回滚`,
      };
    }

    return {
      success: false,
      memoryId: null,
      message: `⏳ Queued (${error.message})`,
    };
  }
}

/**
 * 完整写入并同步
 *
 * @param {Object} params - 写入参数
 * @param {string} params.abstract - L0 摘要（必填）
 * @param {string} params.overview - L1 概览（必填）
 * @param {string} params.content - L2 完整内容（必填）
 * @param {string} params.type - 条目类型（默认 'general'）
 * @param {string[]} params.tags - 标签列表（默认 []）
 * @param {boolean} params.pinned - 是否置顶（默认 false）
 * @param {string} params.source_id - 来源 ID（可选）
 * @param {string} params.project_id - 项目 ID（可选）
 * @param {string} params.source - 来源标识（默认 'cli'）
 * @param {string} params.tenant_id - 租户 ID
 * @param {Object} params.client - WrapperClient 实例
 * @returns {Promise<{success: boolean, localId: string, filePath: string, memoryId: string | null, message: string}>}
 */
export async function writeAndSyncMemory({
  abstract,
  overview,
  content,
  type = 'general',
  tags = [],
  pinned = false,
  source_id,
  project_id,
  meta = [],
  source = 'cli',
  tenant_id,
  client,
}) {
  // 1. 写入本地
  const writeResult = await writeMemory({
    abstract,
    overview,
    content,
    type,
    tags,
    pinned,
    source_id,
    project_id,
    meta,
    source,
  });

  if (!writeResult.success) {
    return writeResult;
  }

  // 2. 同步到后端
  const syncResult = await syncMemoryToBackend({
    localId: writeResult.localId,
    filePath: writeResult.filePath,
    content,
    abstract,
    overview,
    type,
    tags,
    project_id,
    source_id,
    tenant_id,
    source,
    metadata: { written_at: new Date().toISOString() },
    client,
  });

  return {
    success: writeResult.success && syncResult.success,
    localId: writeResult.localId,
    filePath: writeResult.filePath,
    memoryId: syncResult.memoryId,
    message: `${writeResult.message}\n${syncResult.message}`,
  };
}

/**
 * 读取记忆并按层级提取内容
 *
 * @param {Object} params - 读取参数
 * @param {string} params.entry_id - 条目 ID（必填）
 * @param {number} params.level - 层级（0=abstract, 1=overview, 2=full，默认 2）
 * @returns {Promise<{success: boolean, content: string, entry: object, message: string}>}
 */
export async function readMemory({ entry_id, level = 2 }) {
  // 参数验证
  if (!entry_id || typeof entry_id !== 'string') {
    return {
      success: false,
      content: '',
      entry: null,
      message: '❌ Error: entry_id is REQUIRED and must be a string',
    };
  }

  if (level !== 0 && level !== 1 && level !== 2) {
    return {
      success: false,
      content: '',
      entry: null,
      message: '❌ Error: level must be 0, 1, or 2',
    };
  }

  try {
    const entry = getEntryById(entry_id);

    if (!entry) {
      return {
        success: false,
        content: '',
        entry: null,
        message: `❌ Entry not found: ${entry_id}`,
      };
    }

    const content = extractByLevel(entry.content, level);

    return {
      success: true,
      content,
      entry: {
        id: entry.id,
        abstract: entry.abstract,
        overview: entry.overview,
        type: entry.type,
        tags: entry.tags,
        path: entry.path,
        synced: entry.synced,
        memory_id: entry.memory_id,
      },
      message: '✅ Memory read successfully',
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      entry: null,
      message: `❌ Read failed: ${error.message}`,
    };
  }
}
