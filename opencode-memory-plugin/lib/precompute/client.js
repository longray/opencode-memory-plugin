/**
 * PrecomputeClient - 后端预计算服务 API 客户端
 *
 * 调用后端 PrecomputeService API 上传代码分析结果
 * 支持批量上传、符号关系创建、指纹增量检查
 *
 * @version 1.0.0
 * @since v3.2.0
 */

import { getWrapperClient } from '../wrapper-client.js';
import { getConfig } from '../storage.js';

/**
 * @typedef {Object} PrecomputeResult
 * @property {Object<string, string>} memory_ids - 文件路径到 memory_id 的映射
 * @property {string} status - 处理状态 ('success' | 'partial' | 'failed')
 * @property {number} processed_count - 成功处理的数量
 */

/**
 * @typedef {Object} FingerprintCheckResult
 * @property {string[]} changed_files - 有变更的文件列表
 * @property {string[]} unchanged_files - 未变更的文件列表
 * @property {string[]} new_files - 新增文件列表
 */

export class PrecomputeClient {
  constructor(config = {}) {
    this.config = config;
    this.client = config.client || getWrapperClient(getConfig());
  }

  /**
   * 上传代码分析结果到后端预计算服务
   * @param {Object} params
   * @param {string} params.project_id - 项目 ID
   * @param {Array<{path: string, content: string}>} params.files - 文件列表
   * @param {Array<{name: string, type: string, line?: number}>} [params.symbols] - 符号列表
   * @param {Array<{from_symbol: string, to_symbol: string, type: string, line?: number}>} [params.relations] - 调用关系
   * @param {string} [params.tenant_id] - 租户 ID
   * @returns {Promise<PrecomputeResult>}
   */
  async uploadAnalysis({ project_id, files, symbols = [], relations = [], tenant_id }) {
    const requestBody = {
      project_id,
      files: files.map(f => ({
        path: f.path,
        content: f.content,
      })),
      symbols: symbols.map(s => ({
        name: s.name,
        type: s.type,
        line: s.line,
        location: s.location || (s.file_path ? `${s.file_path}:${s.line || 0}` : undefined),
      })),
      relations: relations.map(r => ({
        from_symbol: r.from_symbol,
        to_symbol: r.to_symbol,
        type: r.type,
        line: r.line,
      })),
      tenant_id: tenant_id || this.client.tenantId,
    };

    const result = await this.client.http.post('/api/v1/precompute/analysis', requestBody);

    return {
      memory_ids: result.memory_ids || {},
      status: result.status || 'success',
      processed_count: result.processed_count || 0,
    };
  }

  /**
   * 批量上传代码分析结果（自动分批）
   * @param {Object} params
   * @param {string} params.project_id - 项目 ID
   * @param {Array} params.files - 文件列表
   * @param {Array} [params.symbols] - 符号列表
   * @param {Array} [params.relations] - 调用关系
   * @param {number} [params.batch_size=100] - 每批大小
   * @param {string} [params.tenant_id] - 租户 ID
   * @returns {Promise<{total: number, success: number, failed: number, memory_ids: Object}>}
   */
  async uploadAnalysisBatch({
    project_id,
    files,
    symbols = [],
    relations = [],
    batch_size = 100,
    tenant_id,
  }) {
    const totalFiles = files.length;
    const allMemoryIds = {};
    let success = 0;
    let failed = 0;

    // Split files into batches
    for (let i = 0; i < totalFiles; i += batch_size) {
      const batchFiles = files.slice(i, i + batch_size);

      // Filter symbols/relations to only those in current batch
      const batchPaths = new Set(batchFiles.map(f => f.path));
      const batchSymbols = symbols.filter(s => batchPaths.has(s.file_path));
      const batchRelations = relations.filter(
        r => batchPaths.has(r.file_path) || batchPaths.has(r.from_file)
      );

      try {
        const result = await this.uploadAnalysis({
          project_id,
          files: batchFiles,
          symbols: batchSymbols,
          relations: batchRelations,
          tenant_id,
        });

        Object.assign(allMemoryIds, result.memory_ids);
        success += result.processed_count;
      } catch (error) {
        console.error(
          `[PrecomputeClient] Batch ${Math.floor(i / batch_size) + 1} failed:`,
          error.message
        );
        failed += batchFiles.length;
      }
    }

    return {
      total: totalFiles,
      success,
      failed,
      memory_ids: allMemoryIds,
    };
  }

  /**
   * 检查代码指纹，获取变更文件列表
   * @param {Object} params
   * @param {Array<{file: string, content_hash: string, symbols_hash: string}>} params.fingerprints - 指纹列表
   * @param {string} [params.project_id] - 项目 ID
   * @param {string} [params.tenant_id] - 租户 ID
   * @returns {Promise<FingerprintCheckResult>}
   */
  async checkFingerprints({ fingerprints, project_id, tenant_id }) {
    const requestBody = {
      fingerprints: fingerprints.map(fp => ({
        file: fp.file,
        content_hash: fp.content_hash,
        symbols_hash: fp.symbols_hash,
      })),
      tenant_id: tenant_id || this.client.tenantId,
      project_id: project_id || 'global',
    };

    const result = await this.client.http.post('/api/v1/sync/code-fingerprints', requestBody);

    return {
      changed_files: result.changed_files || [],
      unchanged_files: result.unchanged_files || [],
      new_files: result.new_files || [],
    };
  }

  /**
   * 搜索符号
   * @param {Object} params
   * @param {string} params.query - 搜索查询
   * @param {string} [params.type] - 符号类型过滤
   * @param {string} [params.project_id] - 项目 ID
   * @param {boolean} [params.fuzzy=false] - 是否模糊匹配
   * @param {number} [params.limit=20] - 结果数量限制
   * @param {string} [params.tenant_id] - 租户 ID
   * @returns {Promise<{symbols: Array, total: number}>}
   */
  async searchSymbols({ query, type, project_id, _fuzzy = false, limit = 20, tenant_id }) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.client.tenantId);
    if (query) params.append('query', query);
    if (type) params.append('type', type);
    if (project_id) params.append('project', project_id);
    if (limit) params.append('limit', String(limit));

    const result = await this.client.http.get(`/api/v1/atoms?${params.toString()}`);

    return {
      symbols: result.data || [],
      total: result.total || 0,
    };
  }
}

let precomputeClientInstance = null;

/**
 * 获取 PrecomputeClient 单例
 * @param {Object} [config] - 配置
 * @returns {PrecomputeClient}
 */
export function getPrecomputeClient(config) {
  if (!precomputeClientInstance) {
    precomputeClientInstance = new PrecomputeClient(config);
  }
  return precomputeClientInstance;
}
