/**
 * Memory Core - Unified memory operations
 *
 * 统一 CLI 和 Plugin 的记忆操作，避免代码重复
 *
 * @version 1.0.0
 */

/**
 * @typedef {Object} WriteMemoryParams
 * @property {string} abstract - L0 摘要（必填）
 * @property {string} overview - L1 概览（必填）
 * @property {string} content - L2 完整内容（必填）
 * @property {string} [type='general'] - 条目类型
 * @property {string[]} [tags=[]] - 标签列表
 * @property {boolean} [pinned=false] - 是否置顶
 * @property {string} [source_id] - 来源 ID
 * @property {string} [project_id] - 项目 ID
 * @property {string} [source='cli'] - 来源标识
 */

/**
 * @typedef {Object} WriteMemoryResult
 * @property {boolean} success - 是否成功
 * @property {string} localId - 本地 ID
 * @property {string} filePath - 文件路径
 * @property {string|null} memoryId - 后端记忆 ID
 * @property {string} message - 消息
 */

import fs from 'fs';
import path from 'path';
import { logWarn, logError } from './logger.js';
import { writeEntryToTimeline, buildEntryContent } from './entry.js';
import {
  updateLinkMap,
  removeFromLinkMap,
  updateMemoryIndex,
  updateDayOverview,
  withLinkMapLock,
  readJsonSafe,
  atomicWriteJson,
} from './indexer.js';
import { deleteEntryFile, getEntryById, getAtomIndex } from './storage.js';
import {
  LINK_MAP_FILE,
  RECOMMENDED_ABSTRACT_LENGTH,
  RECOMMENDED_OVERVIEW_LENGTH,
} from './constants.js';
import { containsSensitiveInfo } from './privacy-filter.js';
import { extractByLevel } from './extractor.js';
import {
  detectCircularReference,
  buildAtomTree,
  detectDanglingReferences,
  flattenAtomTree,
  extractWikiLinks,
} from './atom-tree.js';
import { atomicWriteText } from './atomic-write.js';
import { BM25Index } from './bm25.js';

/** BM25 score normalization divisor — maps raw BM25 scores into [0, 1] range */
const BM25_NORMALIZATION_FACTOR = 10;

/**
 * 写入记忆到本地和后端
 *
 * @param {WriteMemoryParams} params - 写入参数
 * @returns {Promise<WriteMemoryResult>} 写入结果
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
  atoms,
  _source = 'cli',
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

  if (tags && !tags.every(t => typeof t === 'string')) {
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

  // Collect length warnings (don't reject, just warn)
  const _lengthWarnings = [];
  if (abstract.length > RECOMMENDED_ABSTRACT_LENGTH) {
    _lengthWarnings.push(
      `⚠️ Warning: abstract length (${abstract.length}) exceeds recommended ${RECOMMENDED_ABSTRACT_LENGTH} characters`
    );
  }
  if (overview.length > RECOMMENDED_OVERVIEW_LENGTH) {
    _lengthWarnings.push(
      `⚠️ Warning: overview length (${overview.length}) exceeds recommended ${RECOMMENDED_OVERVIEW_LENGTH} characters`
    );
  }
  if (content.length > 100_000) {
    return {
      success: false,
      localId: '',
      filePath: '',
      memoryId: null,
      message:
        '❌ Error: content must be ≤100KB (current: ' + (content.length / 1024).toFixed(1) + 'KB)',
    };
  }

  const sensitiveCheck = containsSensitiveInfo(content);
  if (sensitiveCheck.hasSensitive) {
    logWarn(
      'memory-core',
      `Content contains ${sensitiveCheck.patterns.length} sensitive pattern(s), saving anyway`
    );
  }

  // Validate atoms if provided
  if (atoms !== undefined) {
    if (!Array.isArray(atoms)) {
      return {
        success: false,
        localId: '',
        filePath: '',
        memoryId: null,
        message: '❌ Error: atoms must be an array',
      };
    }

    // Check for circular references
    const cycleCheck = detectCircularReference(atoms);
    if (cycleCheck.hasCycle) {
      return {
        success: false,
        localId: '',
        filePath: '',
        memoryId: null,
        message: `❌ Error: Circular reference detected: ${cycleCheck.path.join(' -> ')}`,
      };
    }
  }

  try {
    // 1. 写入本地文件
    const result = await writeEntryToTimeline(
      { abstract, overview, content, atoms },
      { type, tags, project: project_id, source_id, meta }
    );

    try {
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
          atoms,
        },
        result.filePath
      );

      // 3. 更新每日概览
      const dayDir = path.dirname(result.filePath);
      await updateDayOverview(dayDir, { abstract, type, fileName: result.fileName });

      // 4. 更新 MEMORY.md 索引
      await updateMemoryIndex({ abstract, type }, result.localId);
    } catch (pipelineError) {
      // 回滚：步骤 2-4 失败时删除孤立文件
      logWarn(
        'writeMemory',
        `Pipeline failed after file write, rolling back: ${pipelineError.message}`
      );
      try {
        deleteEntryFile(result.filePath);
      } catch (rollbackError) {
        logError('writeMemory', `Rollback failed: ${rollbackError.message}`);
      }
      throw pipelineError;
    }

    // 5. Check for dangling references and add length warnings
    let warnings = [..._lengthWarnings];
    if (atoms && atoms.length > 0) {
      const { dangling, cross_entity_links } = detectDanglingReferences(atoms, atoms);
      if (dangling.length > 0) {
        warnings.push(`⚠️ Warning: ${dangling.length} dangling reference(s) detected`);
      }
      if (cross_entity_links.length > 0) {
        warnings.push(`ℹ️ Info: ${cross_entity_links.length} cross-entity link(s) detected`);
      }
    }

    // 6. 返回成功结果（不包含后端同步）
    return {
      success: true,
      localId: result.localId,
      filePath: result.filePath,
      memoryId: null,
      atoms: atoms,
      message: `✅ Memory saved locally\n- ID: ${result.localId}\n- File: ${result.filePath}`,
      warnings: warnings.length > 0 ? warnings : undefined,
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
  atoms,
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
      atoms,
      project_id,
      source_id,
      tenant_id,
      source,
      metadata,
    };

    const uploadResult = await client.uploadMemory(memory);
    const memoryId = uploadResult.id;

    try {
      await withLinkMapLock(() => {
        if (!fs.existsSync(LINK_MAP_FILE)) return;
        const linkMap = readJsonSafe(LINK_MAP_FILE);
        if (linkMap.entries && linkMap.entries[localId]) {
          linkMap.entries[localId].synced = true;
          linkMap.entries[localId].memory_id = memoryId;
          atomicWriteJson(LINK_MAP_FILE, linkMap);
        }
      });
    } catch (linkMapError) {
      logWarn(
        'syncMemoryToBackend',
        `Upload succeeded (${memoryId}) but link-map update failed: ${linkMapError.message}. Entry will be re-synced on next run.`
      );
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

      logWarn(
        'syncMemoryToBackend',
        `Duplicate detected (${dupType}), rolling back local entry ${localId}`
      );

      deleteEntryFile(filePath);
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
      message: `⚠️ Sync failed: ${error.message}`,
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
  atoms,
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
    atoms,
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
    atoms: writeResult.atoms,
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
 * Find atom in tree by local_id
 * @param {Array} atoms - Atom tree
 * @param {string} localId - Local ID to find
 * @param {number} [maxDepth=10] - Maximum recursion depth to prevent stack overflow
 * @param {number} [currentDepth=0] - Current recursion depth (internal)
 * @returns {Object|null} Found atom or null
 */
function findAtomInTree(atoms, localId, maxDepth = 10, currentDepth = 0) {
  if (currentDepth > maxDepth) return null;
  for (const atom of atoms || []) {
    if (atom.local_id === localId) {
      return atom;
    }
    if (atom.children && atom.children.length > 0) {
      const found = findAtomInTree(atom.children, localId, maxDepth, currentDepth + 1);
      if (found) return found;
    }
  }
  return null;
}

function countAtoms(atoms) {
  if (!atoms || !Array.isArray(atoms)) return 0;
  let count = atoms.length;
  for (const atom of atoms) {
    if (atom.children?.length > 0) {
      count += countAtoms(atom.children);
    }
  }
  return count;
}

// Re-exported from atom-tree.js for backward compatibility
export { extractWikiLinks } from './atom-tree.js';

/**
 * Find incoming links to a target atom
 * @param {Array} atoms - All atoms in entity
 * @param {string} targetLocalId - Target local ID
 * @returns {Array} Array of {source, label, isEmbed}
 */
export function findIncomingLinks(atoms, targetLocalId) {
  const incoming = [];
  for (const atom of atoms || []) {
    const links = extractWikiLinks(atom.content || '');
    for (const link of links) {
      if (!link.entity_id && link.target === targetLocalId) {
        incoming.push({
          source: atom.local_id,
          target: link.target,
          entity_id: link.entity_id,
          label: link.label,
          isEmbed: link.isEmbed,
        });
      }
    }
    if (atom.children && atom.children.length > 0) {
      incoming.push(...findIncomingLinks(atom.children, targetLocalId));
    }
  }
  return incoming;
}

/**
 * Synthesize content with atom IDs
 * @param {Object} entity - Entity with atoms
 * @returns {string} Synthesized content
 */
function synthesizeContentWithAtomIds(entity) {
  let content = entity.abstract + '\n\n';
  content += entity.overview + '\n\n';

  function appendAtom(atom, depth = 0) {
    const indent = '  '.repeat(depth);
    content += `${indent}[[${atom.local_id}]] ${atom.name}\n\n`;
    content += `${indent}${atom.content}\n\n`;

    for (const child of atom.children || []) {
      appendAtom(child, depth + 1);
    }
  }

  for (const atom of entity.atoms || []) {
    appendAtom(atom);
  }

  return content;
}

/**
 * 读取记忆并按层级提取内容
 *
 * @param {Object} params - 读取参数
 * @param {string} params.entry_id - 条目 ID（必填）
 * @param {number} params.level - 层级（0=abstract, 1=overview, 2=full，默认 2）
 * @returns {Promise<{success: boolean, content: string, entry: object, message: string}>}
 * @deprecated(entry) - The nested `entry` field is kept for backward compatibility.
 *   Prefer the flat top-level fields (id, abstract, overview, tags, …) instead.
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
    // Cross-entity atom read: entry_id format is "entity_id/atom_id"
    if (entry_id.includes('/')) {
      const slashIndex = entry_id.indexOf('/');
      const entityId = entry_id.substring(0, slashIndex);
      const atomId = entry_id.substring(slashIndex + 1);

      const entity = getEntryById(entityId);
      if (!entity) {
        return {
          success: false,
          content: '',
          entry: null,
          message: `❌ Entity not found: ${entityId}`,
        };
      }

      const atom = entity.atoms ? findAtomInTree(entity.atoms, atomId) : null;
      if (!atom) {
        return {
          success: false,
          content: '',
          entry: null,
          message: `❌ Atom ${atomId} not found in entity ${entityId}`,
        };
      }

      const outgoingLinks = extractWikiLinks(atom.content || '');
      const incomingLinks = findIncomingLinks(entity.atoms, atom.local_id);

      return {
        success: true,
        type: 'atom',
        local_id: atom.local_id,
        atom_id: atom.atom_id,
        entity_id: entity.id,
        atom_type: atom.type,
        name: atom.name,
        content: atom.content,
        parent_id: atom.parent_id,
        order: atom.order,
        heading_level: atom.heading_level,
        tags: atom.tags || [],
        aliases: atom.aliases || [],
        outgoing_links: outgoingLinks,
        incoming_links: incomingLinks,
        message: '✅ Cross-entity atom read successfully',
      };
    }

    // First try to find as entity ID
    let entry = getEntryById(entry_id);

    // If not found as entity, search in atoms via O(1) index
    let atom = null;
    if (!entry) {
      const atomIndex = getAtomIndex();
      if (atomIndex[entry_id]) {
        const entityId = atomIndex[entry_id];
        entry = getEntryById(entityId);
        if (entry?.atoms) {
          atom = findAtomInTree(entry.atoms, entry_id);
        }
      }
    }

    if (!entry) {
      return {
        success: false,
        content: '',
        entry: null,
        message: `❌ Entry not found: ${entry_id}`,
      };
    }

    // If atom found, return atom data
    if (atom) {
      const outgoingLinks = extractWikiLinks(atom.content || '');
      const incomingLinks = findIncomingLinks(entry.atoms, atom.local_id);

      return {
        success: true,
        type: 'atom',
        local_id: atom.local_id,
        atom_id: atom.atom_id,
        entity_id: entry.id,
        atom_type: atom.type,
        name: atom.name,
        content: atom.content,
        parent_id: atom.parent_id,
        order: atom.order,
        heading_level: atom.heading_level,
        tags: atom.tags || [],
        aliases: atom.aliases || [],
        outgoing_links: outgoingLinks,
        incoming_links: incomingLinks,
        message: '✅ Atom read successfully',
      };
    }

    // Return entity data
    let content;
    if (entry.atoms && entry.atoms.length > 0) {
      if (level === 0) {
        content = entry.abstract;
      } else if (level === 1) {
        content = entry.abstract + '\n\n' + entry.overview;
      } else {
        const synthesized = synthesizeContentWithAtomIds(entry);
        content = entry.content ? synthesized + '\n\n---\n\n' + entry.content : synthesized;
      }
    } else {
      content = extractByLevel(entry.content, level);
    }

    // @deprecated(entry) The flat fields (id, abstract, overview, ...) are preferred.
    // The `entry` field is kept for backward compatibility and will be removed in a future version.
    const entryCompat = {
      id: entry.id,
      type: entry.type,
      abstract: entry.abstract,
      overview: entry.overview,
      content,
      tags: entry.tags,
      path: entry.path,
      synced: entry.synced,
      memory_id: entry.memory_id,
      atoms: entry.atoms,
    };

    return {
      success: true,
      result_type: 'entity',
      id: entry.id,
      entry_type: entry.type,
      abstract: entry.abstract,
      overview: entry.overview,
      content,
      tags: entry.tags,
      path: entry.path,
      synced: entry.synced,
      memory_id: entry.memory_id,
      atoms: entry.atoms,
      entry: entryCompat,
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

/**
 * Find all children of an atom recursively (handles both flat and tree structures)
 * @param {Array} atoms - All atoms (flat array or tree)
 * @param {string} parentLocalId - Parent local ID
 * @returns {Array} Array of child atom local_ids
 */
function findAllChildren(atoms, parentLocalId, maxDepth = 20) {
  const children = [];

  function findInTree(tree, targetParentId, depth) {
    if (depth > maxDepth) return;
    for (const atom of tree || []) {
      if (atom.parent_id === targetParentId) {
        children.push(atom.local_id);
        if (atom.children?.length > 0) {
          findInTree(atom.children, atom.local_id, depth + 1);
        }
      } else if (atom.children?.length > 0) {
        findInTree(atom.children, targetParentId, depth + 1);
      }
    }
  }

  findInTree(atoms, parentLocalId, 0);
  return children;
}

/**
 * Calculate heading level based on parent
 * @param {Array} atoms - All atoms
 * @param {string|null} parentLocalId - Parent local ID
 * @returns {number} Heading level
 */
function calculateHeadingLevel(atoms, parentLocalId) {
  if (!parentLocalId) return 1;
  const parent = findAtomInTree(atoms, parentLocalId);
  return parent ? (parent.heading_level || 1) + 1 : 1;
}

function removeAtomFromTree(atoms, localId, maxDepth = 20, depth = 0) {
  if (depth > maxDepth) return null;
  for (let i = 0; i < atoms.length; i++) {
    if (atoms[i].local_id === localId) {
      return atoms.splice(i, 1)[0];
    }
    if (atoms[i].children?.length > 0) {
      const removed = removeAtomFromTree(atoms[i].children, localId, maxDepth, depth + 1);
      if (removed) return removed;
    }
  }
  return null;
}

/**
 * Update entity with batch atom operations
 * @param {Object} params - Update parameters
 * @param {string} params.entry_id - Entity ID
 * @param {Object} params.entity_updates - Entity fields to update
 * @param {Array} params.atoms_batch - Atom operations batch
 * @returns {Promise<Object>} Update result
 */
export async function updateEntity({ entry_id, entity_updates, atoms_batch, client }) {
  if (!entry_id || typeof entry_id !== 'string') {
    return {
      success: false,
      error: '❌ Error: entry_id is REQUIRED and must be a string',
      atoms_result: [],
    };
  }

  try {
    const localResult = await withLinkMapLock(async () => {
      const entry = getEntryById(entry_id);
      if (!entry) {
        return {
          success: false,
          error: `❌ Entry not found: ${entry_id}`,
          atoms_result: [],
        };
      }

      const entryCopy = JSON.parse(JSON.stringify(entry));
      const results = [];

      if (atoms_batch && Array.isArray(atoms_batch)) {
        for (const op of atoms_batch) {
          switch (op.action) {
            case 'add': {
              const parentId = op.parent_id ?? op.parent_local_id ?? null;
              const newAtom = {
                local_id: op.local_id,
                source_id: op.source_id || op.local_id,
                atom_id: op.atom_id || null,
                type: op.type,
                name: op.name,
                content: op.content,
                tags: op.tags || [],
                aliases: op.aliases || [],
                order: op.order || 'a0',
                heading_level: op.heading_level || calculateHeadingLevel(entryCopy.atoms, parentId),
                parent_id: parentId,
                children: [],
              };
              entryCopy.atoms = entryCopy.atoms || [];
              entryCopy.atoms.push(newAtom);
              results.push({ action: 'add', local_id: op.local_id, success: true });
              break;
            }

            case 'update': {
              const atomToUpdate = findAtomInTree(entryCopy.atoms, op.local_id);
              if (!atomToUpdate) {
                throw new Error(`Atom ${op.local_id} not found`);
              }
              if (op.content !== undefined) atomToUpdate.content = op.content;
              if (op.name !== undefined) atomToUpdate.name = op.name;
              if (op.type !== undefined) atomToUpdate.type = op.type;
              const updateParentId = op.parent_id ?? op.parent_local_id;
              if (updateParentId !== undefined) {
                atomToUpdate.parent_id = updateParentId;
                atomToUpdate.heading_level = calculateHeadingLevel(entryCopy.atoms, updateParentId);
              }
              if (op.order !== undefined) atomToUpdate.order = op.order;
              if (op.tags !== undefined) atomToUpdate.tags = op.tags;
              if (op.aliases !== undefined) atomToUpdate.aliases = op.aliases;
              results.push({ action: 'update', local_id: op.local_id, success: true });
              break;
            }

            case 'remove': {
              const toRemove = [op.local_id];
              if (op.cascade) {
                const childIds = findAllChildren(entryCopy.atoms, op.local_id);
                toRemove.push(...childIds);
              }
              for (const id of toRemove) {
                removeAtomFromTree(entryCopy.atoms, id);
              }
              results.push({
                action: 'remove',
                local_id: op.local_id,
                removed_count: toRemove.length,
                success: true,
              });
              break;
            }

            default:
              throw new Error(`Unknown action: ${op.action}`);
          }
        }

        const cycleCheck = detectCircularReference(entryCopy.atoms || []);
        if (cycleCheck.hasCycle) {
          throw new Error(`Circular reference detected: ${cycleCheck.path.join(' -> ')}`);
        }
      }

      const ALLOWED_ENTITY_UPDATES = new Set(['abstract', 'overview', 'content', 'tags', 'meta']);

      if (entity_updates) {
        for (const [key, value] of Object.entries(entity_updates)) {
          if (ALLOWED_ENTITY_UPDATES.has(key)) {
            entryCopy[key] = value;
          }
        }
      }

      if (entryCopy.atoms) {
        const flat = flattenAtomTree(entryCopy.atoms);
        entryCopy.atoms = buildAtomTree(flat, true);
      }

      const newContent = buildEntryContent({
        id: entryCopy.id,
        date: entryCopy.date,
        type: entryCopy.type,
        tags: entryCopy.tags,
        project: entryCopy.project || '',
        memory_id: entryCopy.memory_id || 'pending',
        source_id: entryCopy.source_id || '',
        synced: false,
        synced_at: null,
        meta: entryCopy.meta || [],
        abstract: entryCopy.abstract,
        overview: entryCopy.overview,
        content: entryCopy.content,
        atoms: entryCopy.atoms,
      });

      atomicWriteText(entry.path, newContent);

      let warnings = [];
      if (entryCopy.atoms && entryCopy.atoms.length > 0) {
        const { dangling, cross_entity_links } = detectDanglingReferences(
          entryCopy.atoms,
          entryCopy.atoms
        );
        if (dangling.length > 0) {
          warnings.push(`⚠️ Warning: ${dangling.length} dangling reference(s) detected`);
        }
        if (cross_entity_links.length > 0) {
          warnings.push(`ℹ️ Info: ${cross_entity_links.length} cross-entity link(s) detected`);
        }
      }

      return {
        success: true,
        entity_id: entry_id,
        atoms_result: results,
        message: '✅ Entity updated successfully',
        warnings: warnings.length > 0 ? warnings : undefined,
        _entryCopy: entryCopy,
        _entryPath: entry.path,
      };
    });

    if (!localResult.success) {
      const { _entryCopy: _, _entryPath: __, ...resultWithoutInternals } = localResult;
      return resultWithoutInternals;
    }

    const { _entryCopy: entryCopy, _entryPath: entryPath, ...resultWithoutInternals } = localResult;

    if (client) {
      let syncResult;
      try {
        syncResult = await syncMemoryToBackend({
          localId: entryCopy.id,
          filePath: entryPath,
          content: entryCopy.content,
          abstract: entryCopy.abstract,
          overview: entryCopy.overview,
          type: entryCopy.type,
          tags: entryCopy.tags,
          atoms: entryCopy.atoms,
          project_id: entryCopy.project,
          source_id: entryCopy.source_id,
          tenant_id: entryCopy.tenant_id,
          source: 'plugin',
          client,
        });
      } catch (syncError) {
        syncResult = { success: false, message: `⚠️ Sync failed: ${syncError.message}` };
      }

      if (syncResult.success) {
        entryCopy.synced = true;
        entryCopy.synced_at = new Date().toISOString();
        const syncedContent = buildEntryContent({
          id: entryCopy.id,
          date: entryCopy.date,
          type: entryCopy.type,
          tags: entryCopy.tags,
          project: entryCopy.project || '',
          memory_id: syncResult.memoryId || entryCopy.memory_id || 'pending',
          source_id: entryCopy.source_id || '',
          synced: true,
          synced_at: entryCopy.synced_at,
          meta: entryCopy.meta || [],
          abstract: entryCopy.abstract,
          overview: entryCopy.overview,
          content: entryCopy.content,
          atoms: entryCopy.atoms,
        });
        atomicWriteText(entryPath, syncedContent);
      }

      return {
        ...resultWithoutInternals,
        synced: syncResult.success,
        memory_id: syncResult.memoryId || undefined,
        sync_error: !syncResult.success ? syncResult.message : undefined,
      };
    }

    return resultWithoutInternals;
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── Context Budget Management ───────────────────────────────────────────────

/**
 * Estimate token count for a string.
 * Uses the standard heuristic: ~4 characters per token.
 * @param {string} text - Text to estimate tokens for
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  const nonCjkLength = text.length - cjkCount;
  return Math.ceil(nonCjkLength / 4 + cjkCount * 1.5);
}

/**
 * Calculate relevance score for an atom against a query.
 * Combines three signals:
 *   1. BM25 keyword matching on (name + content)
 *   2. Title similarity (word overlap ratio)
 *   3. Heading level boost (higher-level atoms get a small bonus)
 *
 * @param {Object} atom - Atom object with name, content, heading_level
 * @param {string} query - Search query
 * @param {number} bm25Score - Pre-computed BM25 score for this atom
 * @returns {number} Composite relevance score (0-1 range)
 */
export function calculateRelevance(atom, query, bm25Score) {
  if (!query || !query.trim()) return 0;

  const bm25Normalized = Math.min(bm25Score / BM25_NORMALIZATION_FACTOR, 1);

  const queryWords = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1)
  );
  const titleWords = new Set(
    (atom.name || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 1)
  );
  let overlap = 0;
  for (const word of queryWords) {
    if (titleWords.has(word)) overlap++;
  }
  const titleSimilarity = queryWords.size > 0 ? overlap / queryWords.size : 0;

  const headingBoost = atom.heading_level ? 1 / atom.heading_level : 0;

  return Math.min(0.6 * bm25Normalized + 0.3 * titleSimilarity + 0.1 * headingBoost, 1);
}

/**
 * Build a BM25 index from flattened atoms and score each one against a query.
 * @param {Array} atoms - Flattened array of atoms
 * @param {string} query - Search query
 * @returns {Map<string, number>} Map of atom local_id -> BM25 score
 */
function scoreAtomsWithBM25(atoms, query) {
  const index = new BM25Index();
  const idToAtom = new Map();

  for (const atom of atoms) {
    const text = [atom.name, atom.content].filter(Boolean).join(' ');
    index.addDocument(atom.local_id, text);
    idToAtom.set(atom.local_id, atom);
  }

  const queryTerms = index.tokenize(query);
  const scores = new Map();

  for (const [id, doc] of index.documents) {
    const score = index.calculateBM25Score(doc, queryTerms);
    scores.set(id, score);
  }

  return scores;
}

/**
 * Load entity context within a token budget.
 *
 * Supports two strategies:
 * - `relevance`: Score atoms by BM25 + title similarity, select most relevant within budget
 * - `hierarchy`: Prefer top-level atoms first (chapters > sections > notes), then fill children
 *
 * @param {Object} params - Parameters
 * @param {string} params.entry_id - Entity ID to load atoms from
 * @param {string} params.query - Current query for relevance calculation
 * @param {number} [params.maxTokens=2000] - Token budget
 * @param {string} [params.strategy='relevance'] - Strategy: 'relevance' or 'hierarchy'
 * @returns {Promise<Object>} Result with selected atoms and budget info
 */
export async function loadContextByBudget({
  entry_id,
  query,
  maxTokens = 2000,
  strategy = 'relevance',
}) {
  // Parameter validation
  if (!entry_id || typeof entry_id !== 'string') {
    return {
      success: false,
      error: '❌ Error: entry_id is REQUIRED and must be a string',
    };
  }

  if (maxTokens < 0 || typeof maxTokens !== 'number') {
    return {
      success: false,
      error: '❌ Error: maxTokens must be a non-negative number',
    };
  }

  if (strategy !== 'relevance' && strategy !== 'hierarchy') {
    return {
      success: false,
      error: "❌ Error: strategy must be 'relevance' or 'hierarchy'",
    };
  }

  try {
    // 1. Get all atoms from entity (with content)
    const { success, tree, error } = await getEntityAtoms({
      entry_id,
      include_content: true,
    });

    if (!success) {
      return { success: false, error };
    }

    // 2. Flatten tree to array
    const atoms = flattenAtomTree(tree);

    if (atoms.length === 0) {
      return {
        success: true,
        entry_id,
        selected_atoms: [],
        total_atoms: 0,
        used_tokens: 0,
        max_tokens: maxTokens,
        strategy,
        message: '✅ No atoms found in entity',
      };
    }

    const bm25Scores = scoreAtomsWithBM25(atoms, query || '');

    const scoredAtoms = atoms.map(atom => ({
      ...atom,
      relevance_score: calculateRelevance(atom, query || '', bm25Scores.get(atom.local_id) || 0),
    }));

    const selected =
      strategy === 'relevance'
        ? selectByRelevance(scoredAtoms, maxTokens)
        : selectByHierarchy(scoredAtoms, maxTokens);

    const usedTokens = selected.reduce((sum, atom) => sum + estimateTokens(atom.content || ''), 0);

    return {
      success: true,
      entry_id,
      selected_atoms: selected,
      total_atoms: atoms.length,
      selected_count: selected.length,
      used_tokens: usedTokens,
      max_tokens: maxTokens,
      strategy,
      budget_utilization: maxTokens > 0 ? Math.round((usedTokens / maxTokens) * 100) : 0,
      message: `✅ Loaded ${selected.length}/${atoms.length} atoms within ${usedTokens}/${maxTokens} tokens`,
    };
  } catch (error) {
    return {
      success: false,
      error: `❌ Failed to load context: ${error.message}`,
    };
  }
}

/**
 * Greedy selection by relevance score within token budget.
 * @param {Array} scoredAtoms - Atoms with relevance_score field
 * @param {number} maxTokens - Token budget
 * @returns {Array} Selected atoms sorted by original order
 */
function selectByRelevance(scoredAtoms, maxTokens) {
  const sorted = [...scoredAtoms].sort((a, b) => b.relevance_score - a.relevance_score);

  const selected = [];
  let usedTokens = 0;

  for (const atom of sorted) {
    const atomTokens = estimateTokens(atom.content || '');
    if (usedTokens + atomTokens <= maxTokens) {
      selected.push(atom);
      usedTokens += atomTokens;
    }
  }

  return selected.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
}

/**
 * Greedy selection by heading hierarchy within token budget.
 * Top-level atoms first; relevance breaks ties within each level.
 * @param {Array} scoredAtoms - Atoms with relevance_score and heading_level fields
 * @param {number} maxTokens - Token budget
 * @returns {Array} Selected atoms sorted by original order
 */
function selectByHierarchy(scoredAtoms, maxTokens) {
  const sorted = [...scoredAtoms].sort((a, b) => {
    const levelDiff = (a.heading_level || 99) - (b.heading_level || 99);
    if (levelDiff !== 0) return levelDiff;
    return b.relevance_score - a.relevance_score;
  });

  const selected = [];
  let usedTokens = 0;

  for (const atom of sorted) {
    const atomTokens = estimateTokens(atom.content || '');
    if (usedTokens + atomTokens <= maxTokens) {
      selected.push(atom);
      usedTokens += atomTokens;
    }
  }

  return selected.sort((a, b) => (a.order || '').localeCompare(b.order || ''));
}

/**
 * Get atom tree for an entity
 * @param {Object} params - Query parameters
 * @param {string} params.entry_id - Entity ID
 * @param {boolean} params.include_content - Whether to include atom content
 * @returns {Promise<Object>} Atom tree result
 */
export async function getEntityAtoms({ entry_id, include_content = false }) {
  if (!entry_id || typeof entry_id !== 'string') {
    return {
      success: false,
      error: '❌ Error: entry_id is REQUIRED and must be a string',
    };
  }

  try {
    const entry = getEntryById(entry_id);
    if (!entry) {
      return {
        success: false,
        error: `❌ Entry not found: ${entry_id}`,
      };
    }

    const atoms = entry.atoms || [];
    const tree = buildAtomTree(atoms, include_content);

    return {
      success: true,
      entity_id: entry_id,
      total_atoms: countAtoms(tree),
      tree,
      message: '✅ Atom tree retrieved successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ─── Context Compression by Hierarchy Level ────────────────────────────────

/**
 * Filter atom tree by heading_level.
 * Keeps atoms whose heading_level <= maxLevel, prunes deeper children.
 *
 * @param {Array} nodes - Atom tree nodes
 * @param {number} maxLevel - Maximum heading_level to keep (1=chapter, 2=section, 3=detail)
 * @returns {Array} Filtered tree
 */
export function filterByLevel(nodes, maxLevel) {
  if (!nodes || nodes.length === 0) return [];

  return nodes
    .filter(node => (node.heading_level || 1) <= maxLevel)
    .map(node => ({
      ...node,
      children: (node.heading_level || 1) < maxLevel ? filterByLevel(node.children, maxLevel) : [],
    }));
}

/**
 * Add breadcrumb paths to each node in the tree.
 * Format: "Parent Name > Child Name > Current Name"
 *
 * @param {Array} nodes - Atom tree nodes
 * @param {string} parentPath - Accumulated parent breadcrumb path
 */
export function addBreadcrumbs(nodes, parentPath = '') {
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath} > ${node.name}` : node.name;
    node.breadcrumb = currentPath;

    if (node.children && node.children.length > 0) {
      addBreadcrumbs(node.children, currentPath);
    }
  }
}

/**
 * Format atom tree as markdown with hierarchical headings.
 *
 * @param {Array} tree - Atom tree (optionally with breadcrumbs)
 * @param {number} maxLevel - Maximum heading level that was used for filtering
 * @returns {string} Markdown formatted content
 */
export function formatAsMarkdown(tree, _maxLevel) {
  if (!tree || tree.length === 0) return '';

  let markdown = '';

  function traverse(nodes) {
    for (const node of nodes) {
      const level = node.heading_level || 1;
      const heading = '#'.repeat(Math.min(level, 6));

      if (node.breadcrumb && level > 1) {
        markdown += `${heading} ${node.name}\n`;
        markdown += `> ${node.breadcrumb}\n\n`;
      } else {
        markdown += `${heading} ${node.name}\n\n`;
      }

      if (node.content) {
        markdown += `${node.content}\n\n`;
      }

      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return markdown.trim();
}

/**
 * Load entity context compressed by hierarchy level.
 * Returns a filtered atom tree and markdown representation.
 *
 * @param {Object} params - Parameters
 * @param {string} params.entry_id - Entity ID to load atoms from
 * @param {number} [params.maxLevel=2] - Maximum heading level (1=chapter, 2=section, 3=detail)
 * @param {boolean} [params.includeBreadcrumbs=true] - Include parent chain breadcrumbs
 * @returns {Promise<Object>} Result with filtered tree and markdown
 */
export async function loadContextByLevel({ entry_id, maxLevel = 2, includeBreadcrumbs = true }) {
  // Parameter validation
  if (!entry_id || typeof entry_id !== 'string') {
    return {
      success: false,
      error: '❌ Error: entry_id is REQUIRED and must be a string',
    };
  }

  if (typeof maxLevel !== 'number' || maxLevel < 1 || maxLevel > 6) {
    return {
      success: false,
      error: '❌ Error: maxLevel must be a number between 1 and 6',
    };
  }

  if (typeof includeBreadcrumbs !== 'boolean') {
    return {
      success: false,
      error: '❌ Error: includeBreadcrumbs must be a boolean',
    };
  }

  try {
    // 1. Get full atom tree with content
    const { success, tree, error, total_atoms } = await getEntityAtoms({
      entry_id,
      include_content: true,
    });

    if (!success) {
      return { success: false, error };
    }

    if (!tree || tree.length === 0) {
      return {
        success: true,
        entry_id,
        filtered_tree: [],
        markdown: '',
        total_atoms: 0,
        filtered_count: 0,
        max_level: maxLevel,
        message: '✅ No atoms found in entity',
      };
    }

    // 2. Filter by heading_level
    const filtered = filterByLevel(tree, maxLevel);

    // 3. Optionally add breadcrumbs
    if (includeBreadcrumbs) {
      addBreadcrumbs(filtered);
    }

    const filteredCount = countAtoms(filtered);

    // 5. Format as markdown
    const markdown = formatAsMarkdown(filtered, maxLevel);

    return {
      success: true,
      entry_id,
      filtered_tree: filtered,
      markdown,
      total_atoms: total_atoms,
      filtered_count: filteredCount,
      max_level: maxLevel,
      include_breadcrumbs: includeBreadcrumbs,
      message: `✅ Loaded ${filteredCount}/${total_atoms} atoms at level ≤${maxLevel}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `❌ Failed to load context by level: ${error.message}`,
    };
  }
}

/**
 * Mark dead links in entity atoms
 * @param {Object} params - Parameters
 * @param {string} params.entry_id - Entity ID
 * @returns {Promise<Object>} Result with marked count
 */
export async function markDeadLinks({ entry_id }) {
  if (!entry_id || typeof entry_id !== 'string') {
    return {
      success: false,
      error: '❌ Error: entry_id is REQUIRED and must be a string',
    };
  }

  try {
    return await withLinkMapLock(async () => {
      const entry = getEntryById(entry_id);
      if (!entry) {
        return {
          success: false,
          error: `❌ Entry not found: ${entry_id}`,
        };
      }

      const { dangling, cross_entity_links } = detectDanglingReferences(
        entry.atoms || [],
        entry.atoms || []
      );

      if (dangling.length === 0 && cross_entity_links.length === 0) {
        return {
          success: true,
          entry_id,
          marked_count: 0,
          cross_entity_links: [],
          message: '✅ No dead links found',
        };
      }

      if (dangling.length === 0) {
        return {
          success: true,
          entry_id,
          marked_count: 0,
          dead_links: [],
          cross_entity_links,
          message: `ℹ️ No dead links, but found ${cross_entity_links.length} cross-entity link(s)`,
        };
      }

      let markedCount = 0;
      const markAtomLinks = atoms => {
        for (const atom of atoms || []) {
          const atomDangling = dangling.filter(d => d.source === atom.local_id);
          if (atomDangling.length > 0) {
            atom.dead_links = atomDangling.map(d => ({
              target: d.target,
              type: d.type,
            }));
            markedCount += atomDangling.length;
          }

          if (atom.children && atom.children.length > 0) {
            markAtomLinks(atom.children);
          }
        }
        return atoms;
      };

      const entryCopy = JSON.parse(JSON.stringify(entry));
      markAtomLinks(entryCopy.atoms);

      const newContent = buildEntryContent({
        id: entryCopy.id,
        date: entryCopy.date,
        type: entryCopy.type,
        tags: entryCopy.tags,
        project: entryCopy.project || '',
        memory_id: entryCopy.memory_id || 'pending',
        source_id: entryCopy.source_id || '',
        synced: false,
        synced_at: null,
        meta: entryCopy.meta || [],
        abstract: entryCopy.abstract,
        overview: entryCopy.overview,
        content: entryCopy.content,
        atoms: entryCopy.atoms,
      });

      atomicWriteText(entry.path, newContent);

      return {
        success: true,
        entry_id,
        marked_count: markedCount,
        dead_links: dangling,
        cross_entity_links,
        message: `✅ Marked ${markedCount} dead link(s)`,
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}
