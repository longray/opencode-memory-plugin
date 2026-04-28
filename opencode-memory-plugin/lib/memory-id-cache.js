import fs from 'fs';
import path from 'path';
import { generateLocalId } from './ulid.js';
import { atomicWriteJson } from './atomic-write.js';
import { DEBOUNCE_SAVE_MS } from './constants.js';
import { logDebug, logInfo, logError, logWarn } from './logger.js';

/**
 * Memory ID 缓存管理类
 * 实现 file_path → source_id → memory_id 的三层映射
 *
 * @example
 * const cache = new MemoryIdCache('my-project');
 * await cache.load();
 *
 * // 保存映射
 * await cache.set('src/utils.ts', '01H1ABC...', 'memory:xyz...');
 *
 * // 查询 memory_id
 * const memoryId = await cache.getMemoryId('src/utils.ts');
 */
export class MemoryIdCache {
  constructor(projectId, cacheDir) {
    this.projectId = projectId || 'default';
    this.cacheDir = cacheDir || this.getDefaultCacheDir();
    this.cacheFile = path.join(this.cacheDir, 'memory-id-cache.json');

    // 内存缓存
    this.mappings = new Map(); // file_path → {source_id, memory_id, ...}
    this.reverseIndex = new Map(); // source_id → file_path

    // 统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      lastSaved: null,
    };
  }

  /**
   * 获取默认缓存目录
   */
  getDefaultCacheDir() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, '.opencode', 'cache');
  }

  /**
   * 加载缓存文件
   */
  async load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));

        if (data.project_id === this.projectId) {
          // 加载映射
          for (const [filePath, entry] of Object.entries(data.mappings || {})) {
            this.mappings.set(filePath, entry);
            this.reverseIndex.set(entry.source_id, filePath);
          }

          logInfo(
            'MemoryIdCache',
            `[MemoryIdCache] Loading cache for project: ${this.projectId}, tenant: ${this.tenantId}`
          );
        } else {
          logWarn(
            'MemoryIdCache',
            `[MemoryIdCache] Cache file not found, initializing empty cache: ${this.cacheFile}`
          );
        }
      }
    } catch (error) {
      logError('MemoryIdCache', '[MemoryIdCache] Failed to load cache:', error);
      // 加载失败时重置
      this.mappings.clear();
      this.reverseIndex.clear();
    }
  }

  /**
   * 保存缓存到文件
   */
  async save() {
    try {
      // 确保目录存在
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const data = {
        version: '1.0',
        project_id: this.projectId,
        last_updated: new Date().toISOString(),
        mappings: Object.fromEntries(this.mappings),
      };

      atomicWriteJson(this.cacheFile, data);
      this.stats.lastSaved = new Date().toISOString();

      logInfo(
        'MemoryIdCache',
        `[MemoryIdCache] Saved ${this.mappings.size} entries to ${this.cacheFile}`
      );
      return true;
    } catch (error) {
      logError('MemoryIdCache', '[MemoryIdCache] Failed to save cache:', error);
      return false;
    }
  }

  /**
   * 保存映射关系
   * @param {string} filePath - 文件路径（相对路径）
   * @param {string} sourceId - source_id（本地 ULID）
   * @param {string} memoryId - memory_id（后端生成）
   * @param {Object} options - 可选参数
   * @param {string} options.contentHash - 内容哈希
   */
  async set(filePath, sourceId, memoryId, options = {}) {
    const normalizedPath = this.normalizePath(filePath);

    const entry = {
      source_id: sourceId,
      memory_id: memoryId,
      content_hash: options.contentHash || null,
      last_synced: new Date().toISOString(),
    };

    this.mappings.set(normalizedPath, entry);
    this.reverseIndex.set(sourceId, normalizedPath);

    // 自动保存（防抖）
    this.scheduleSave();
  }

  /**
   * 通过 file_path 获取 memory_id
   * @param {string} filePath - 文件路径
   * @returns {string|null} memory_id 或 null
   */
  async getMemoryId(filePath) {
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.mappings.get(normalizedPath);

    if (entry) {
      this.stats.hits++;
      return entry.memory_id;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 通过 file_path 获取 source_id
   * @param {string} filePath - 文件路径
   * @returns {string|null} source_id 或 null
   */
  async getSourceId(filePath) {
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.mappings.get(normalizedPath);

    if (entry) {
      this.stats.hits++;
      return entry.source_id;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 通过 source_id 获取 file_path
   * @param {string} sourceId - source_id
   * @returns {string|null} file_path 或 null
   */
  async getFilePath(sourceId) {
    const filePath = this.reverseIndex.get(sourceId);

    if (filePath) {
      this.stats.hits++;
      return filePath;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 检查是否存在
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  has(filePath) {
    const normalizedPath = this.normalizePath(filePath);
    return this.mappings.has(normalizedPath);
  }

  /**
   * 删除映射
   * @param {string} filePath - 文件路径
   * @returns {boolean}
   */
  async delete(filePath) {
    const normalizedPath = this.normalizePath(filePath);
    const entry = this.mappings.get(normalizedPath);

    if (entry) {
      this.mappings.delete(normalizedPath);
      this.reverseIndex.delete(entry.source_id);
      this.scheduleSave();
      return true;
    }

    return false;
  }

  /**
   * 清空缓存
   */
  async clear() {
    this.mappings.clear();
    this.reverseIndex.clear();
    await this.save();
  }

  /**
   * 批量保存
   * @param {Map<string, {source_id: string, memory_id: string}>} mappings
   */
  async setBatch(mappings) {
    for (const [filePath, data] of mappings) {
      await this.set(filePath, data.source_id, data.memory_id, {
        contentHash: data.content_hash,
      });
    }
  }

  /**
   * 批量获取
   * @param {string[]} filePaths - 文件路径数组
   * @returns {Map<string, string>} file_path → memory_id
   */
  async getBatch(filePaths) {
    const result = new Map();

    for (const filePath of filePaths) {
      const memoryId = await this.getMemoryId(filePath);
      if (memoryId) {
        result.set(filePath, memoryId);
      }
    }

    return result;
  }

  /**
   * 生成新的 source_id
   * @returns {string} ULID
   */
  generateSourceId() {
    return generateLocalId();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

    return {
      total_entries: this.mappings.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hit_rate: `${hitRate}%`,
      last_saved: this.stats.lastSaved,
    };
  }

  /**
   * 导出缓存（用于备份或同步）
   * @returns {string} JSON 字符串
   */
  export() {
    const data = {
      version: '1.0',
      project_id: this.projectId,
      exported_at: new Date().toISOString(),
      mappings: Object.fromEntries(this.mappings),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入缓存（用于恢复或同步）
   * @param {string} json - JSON 字符串
   * @param {Object} options - 选项
   * @param {boolean} options.merge - 是否合并（默认 true）
   */
  async import(json, options = { merge: true }) {
    try {
      const data = JSON.parse(json);

      if (data.project_id && data.project_id !== this.projectId) {
        logWarn(
          'MemoryIdCache',
          `[MemoryIdCache] Importing from different project: ${data.project_id}`
        );
      }

      let imported = 0;
      let merged = 0;

      for (const [filePath, entry] of Object.entries(data.mappings || {})) {
        const existing = this.mappings.get(filePath);

        if (!existing) {
          // 新条目
          this.mappings.set(filePath, entry);
          this.reverseIndex.set(entry.source_id, filePath);
          imported++;
        } else if (options.merge) {
          // 合并：保留最新的
          const existingDate = new Date(existing.last_synced || 0);
          const newDate = new Date(entry.last_synced || 0);

          if (newDate > existingDate) {
            this.mappings.set(filePath, entry);
            this.reverseIndex.set(entry.source_id, filePath);
            merged++;
          }
        }
      }

      await this.save();
      logInfo('MemoryIdCache', `[MemoryIdCache] Imported: ${imported} new, ${merged} merged`);

      return { imported, merged };
    } catch (error) {
      logError('MemoryIdCache', '[MemoryIdCache] Failed to import:', error);
      throw error;
    }
  }

  /**
   * 验证缓存完整性
   * @returns {Object} 验证结果
   */
  validate() {
    const result = {
      valid: 0,
      invalid: 0,
      missing: [],
    };

    for (const [filePath, entry] of this.mappings) {
      if (entry.source_id && entry.memory_id) {
        result.valid++;
      } else {
        result.invalid++;
        result.missing.push(filePath);
      }
    }

    return result;
  }

  /**
   * 路径标准化
   * @param {string} filePath - 文件路径
   * @returns {string} 标准化后的路径
   */
  normalizePath(filePath) {
    // 统一使用正斜杠
    return filePath.replace(/\\/g, '/');
  }

  /**
   * 防抖保存
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.save();
    }, DEBOUNCE_SAVE_MS);
  }
  /**
   * 从本地 entry 文件重建缓存
   * 扫描 timeline 目录下的所有 entry 文件，读取 source_id 和 memory_id
   * @param {string} timelineDir - timeline 目录路径
   * @returns {Promise<number>} 重建的条目数
   */
  async rebuildFromLocal(timelineDir) {
    const fs = await import('fs');
    const path = await import('path');

    const timelinePath =
      timelineDir ||
      path.join(
        process.env.HOME || process.env.USERPROFILE || '.',
        '.opencode',
        'memory',
        'timeline'
      );

    let rebuilt = 0;

    try {
      if (!fs.existsSync(timelinePath)) {
        logInfo('MemoryIdCache', `[MemoryIdCache] Timeline directory not found: ${timelinePath}`);
        return 0;
      }

      // 递归扫描所有 entry 文件
      const entries = this.scanDirectory(timelinePath, '.md');

      for (const entryPath of entries) {
        try {
          const content = fs.readFileSync(entryPath, 'utf-8');
          const parsed = this.parseEntryFile(content);

          if (parsed.source_id && parsed.memory_id && parsed.memory_id !== 'pending') {
            // 从 metadata 中提取 file_path
            const filePath = parsed.metadata?.file_path || parsed.file_path;

            if (filePath) {
              await this.set(filePath, parsed.source_id, parsed.memory_id, {
                contentHash: parsed.metadata?.content_hash,
              });
              rebuilt++;
            }
          }
        } catch (error) {
          logWarn('MemoryIdCache', `[MemoryIdCache] Failed to parse entry: ${entryPath}`, error);
        }
      }

      logInfo('MemoryIdCache', `[MemoryIdCache] Rebuilt ${rebuilt} entries from local files`);
      await this.save();

      return rebuilt;
    } catch (error) {
      logError('MemoryIdCache', '[MemoryIdCache] Failed to rebuild from local:', error);
      return 0;
    }
  }

  /**
   * 扫描目录获取文件列表
   */
  scanDirectory(dir, extension) {
    const results = [];

    const scan = currentDir => {
      if (!fs.existsSync(currentDir)) return;

      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scan(fullPath);
        } else if (stat.isFile() && item.endsWith(extension)) {
          results.push(fullPath);
        }
      }
    };

    scan(dir);
    return results;
  }

  /**
   * 解析 entry 文件内容
   */
  parseEntryFile(content) {
    const lines = content.split('\n');
    const result = {
      source_id: null,
      memory_id: null,
      file_path: null,
      metadata: {},
    };

    let inFrontmatter = false;
    let frontmatterStarted = false;

    for (const line of lines) {
      // 检测 frontmatter 开始/结束
      if (line.trim() === '---') {
        if (!frontmatterStarted) {
          frontmatterStarted = true;
          inFrontmatter = true;
          continue;
        } else {
          inFrontmatter = false;
          continue;
        }
      }

      // 解析 frontmatter 字段
      if (inFrontmatter) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const [, key, value] = match;
          result[key] = value.trim();
        }
      }
    }

    // 解析 metadata（如果在 content 中）
    const metadataMatch = content.match(/metadata:\s*(\{[^}]+\})/);
    if (metadataMatch) {
      try {
        result.metadata = JSON.parse(metadataMatch[1]);
      } catch {
        // metadata JSON may be malformed — non-critical, skip silently
        logDebug('memory-id-cache', 'Failed to parse metadata JSON', {
          filePath: entryPath,
        });
      }
    }

    return result;
  }

  /**
   * 从后端重建缓存（需要后端支持 lookup API）
   * @param {Function} lookupFn - 后端查询函数
   * @param {string[]} filePaths - 要重建的文件路径列表
   * @returns {Promise<number>} 重建的条目数
   */
  async rebuildFromBackend(lookupFn, filePaths) {
    let rebuilt = 0;

    for (const filePath of filePaths) {
      try {
        // 通过 file_path 查询后端
        const result = await lookupFn({ file_path: filePath, project_id: this.projectId });

        if (result && result.memory_id) {
          await this.set(filePath, result.source_id, result.memory_id);
          rebuilt++;
        }
      } catch (error) {
        logWarn('MemoryIdCache', `[MemoryIdCache] Failed to lookup: ${filePath}`, error);
      }
    }

    logInfo('MemoryIdCache', `[MemoryIdCache] Rebuilt ${rebuilt} entries from backend`);
    await this.save();

    return rebuilt;
  }

  cleanup() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }
}

export default MemoryIdCache;
