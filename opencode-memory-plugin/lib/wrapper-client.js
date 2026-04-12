/**
 * Wrapper Client - Backend Memory Service HTTP API Client
 *
 * 封装后端记忆服务的所有 API 调用
 * 支持：健康检查、搜索、上传、图关系、图遍历
 * 特性：自动重试、错误分类、超时控制
 *
 * @version 1.0.1
 */

/**
 * @typedef {Object} HealthStatus
 * @property {string} status - 'healthy' | 'unavailable' | 'degraded'
 * @property {Object} embedding_service - Embedding 服务状态
 * @property {Object} surrealdb - SurrealDB 服务状态
 * @property {Object} cache_stats - 缓存统计
 */

/**
 * @typedef {Object} SearchParams
 * @property {string} query - 搜索查询
 * @property {'vector'|'keyword'|'hybrid'} [mode='hybrid'] - 搜索模式
 * @property {number} [limit=10] - 结果数量限制
 * @property {number} [threshold=0.3] - 相似度阈值
 * @property {number} [level=2] - 返回内容级别 (0=abstract, 1=overview, 2=full)
 * @property {string} [tenant_id] - 租户 ID
 * @property {string} [project_id] - 项目 ID
 */

/**
 * @typedef {Object} SearchResult
 * @property {Array} results - 搜索结果数组
 * @property {number} total - 结果总数
 * @property {string} mode - 使用的搜索模式
 */

/**
 * @typedef {Object} MemoryEntry
 * @property {string} abstract - L0 摘要（≤100 字符）
 * @property {string} overview - L1 概览（≤500 字符）
 * @property {string} content - L2 完整内容
 * @property {string} type - 条目类型
 * @property {string[]} tags - 标签列表
 * @property {boolean} pinned - 是否置顶
 * @property {string} [source_id] - 来源 ID
 * @property {string} [project_id] - 项目 ID
 */

import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const LOG_FILE = path.join(HOME, '.opencode', 'memory', 'memory.log');

/**
 * 写入日志到 memory.log
 */
function writeLog(level, category, message, data = null) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${category}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logLine);
  } catch {
    // Fallback to console if file write fails
    console.log(logLine.trim());
  }
}

function logInfo(category, message, data) {
  writeLog('INFO', category, message, data);
}
function logError(category, message, data) {
  writeLog('ERROR', category, message, data);
}
function logDebug(category, message, data) {
  writeLog('DEBUG', category, message, data);
}

/**
 * Wrapper API 错误分类
 */
export class WrapperError extends Error {
  constructor(message, statusCode, retryable = false) {
    super(message);
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.name = 'WrapperError';
  }
}

export class DuplicateError extends WrapperError {
  constructor(message, duplicateType, existingId, similarity = null) {
    super(message, 409, false);
    this.name = 'DuplicateError';
    this.duplicateType = duplicateType;
    this.existingId = existingId;
    this.similarity = similarity;
  }
}

/**
 * HTTP 请求包装类
 */
class HTTPClient {
  constructor(baseUrl, timeout = 30000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  /**
   * 发送 HTTP 请求
   */
  async request(method, endpoint, body = null, headers = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    logInfo('HTTP', `>>> ${method} ${endpoint}`, { body: body ? 'present' : 'none' });

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      logInfo('HTTP', `<<< ${response.status} ${endpoint}`);

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = response.status >= 500 || response.status === 429;
        logError('HTTP', `Error ${response.status}: ${errorText}`);
        throw new WrapperError(`HTTP ${response.status}: ${errorText}`, response.status, retryable);
      }

      if (response.status === 204) {
        return null;
      }

      const json = await response.json();
      logDebug('HTTP', `Response ${endpoint}`, { keys: Object.keys(json || {}) });
      return json;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new WrapperError('Request timeout', 408, true);
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new WrapperError('Backend service unavailable', 503, true);
      }

      logError('HTTP', `Exception: ${error.message}`);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request('GET', endpoint);
  }

  async post(endpoint, body) {
    return this.request('POST', endpoint, body);
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

/**
 * 重试策略
 */
async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!error.retryable || attempt === maxRetries) {
        throw error;
      }

      // 指数退避
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wrapper Client 主类
 */
export class WrapperClient {
  constructor(config = {}) {
    // v3.2: Default port changed from 17999 to 18008
    // Backward compatible: Use API_PORT env var or MEMORY_BACKEND_URL to override
    const apiPort = process.env.API_PORT || '18008';
    const defaultUrl = `http://localhost:${apiPort}`;
    this.baseUrl = config.backend?.url || process.env.MEMORY_BACKEND_URL || defaultUrl;
    this.tenantId =
      config.backend?.tenant_id ||
      process.env.MEMORY_TENANT_ID ||
      process.env.USERNAME ||
      'default';
    this.timeout = config.backend?.timeout || 30000;
    this.maxRetries = config.backend?.max_retries || 3;

    this.http = new HTTPClient(this.baseUrl, this.timeout);
    this.config = config;
  }

  /**
   * 健康检查
   * @returns {Promise<HealthStatus>} 后端服务健康状态
   */
  async health() {
    try {
      return await withRetry(() => this.http.get('/health'), this.maxRetries);
    } catch (error) {
      return {
        status: 'unavailable',
        error: error.message,
        embedding_service: { status: 'unknown' },
        surrealdb: { status: 'unknown' },
      };
    }
  }

  /**
   * 检查后端是否可用
   */
  async isHealthy() {
    const health = await this.health();
    return health.status === 'healthy';
  }

  /**
   * 获取后端状态信息
   */
  async getStatus() {
    try {
      const health = await this.health();
      return {
        status: health.status || 'unavailable',
        memory_count: health.memory_count || 0,
        healthy: health.status === 'healthy',
      };
    } catch (error) {
      return {
        status: 'error',
        memory_count: 0,
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索记忆
   * @param {SearchParams} params - 搜索参数
   * @returns {Promise<SearchResult>} 搜索结果
   */
  async search({
    query,
    mode = 'hybrid',
    limit = 10,
    threshold = 0.3,
    level = 2,
    tenant_id,
    project_id,
  }) {
    logInfo('SEARCH', 'search called', {
      query,
      mode,
      limit,
      tenant_id: tenant_id || this.tenantId,
    });

    const requestBody = {
      query,
      mode,
      limit,
      threshold,
      level,
      tenant_id: tenant_id || this.tenantId,
    };

    if (project_id) {
      requestBody.project_id = project_id;
    }

    const result = await withRetry(
      () => this.http.post('/api/v1/memories/search', requestBody),
      this.maxRetries
    );

    logInfo('SEARCH', 'search completed', { result_count: result.results?.length || 0 });

    return result;
  }

  /**
   * 上传单条记忆
   * @param {MemoryEntry} memory - 记忆数据
   * @returns {Promise<{id: string, success: boolean}>} 上传结果
   */
  async uploadMemory(memory) {
    logInfo('UPLOAD', 'uploadMemory called', {
      type: memory.type,
      abstract: memory.abstract?.substring(0, 50),
    });

    const result = await this.uploadMemories([memory]);

    if (result.success === 1 && result.memory_ids.length === 1) {
      logInfo('UPLOAD', 'uploadMemory success', { id: result.memory_ids[0] });
      return { id: result.memory_ids[0], success: true };
    }

    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      logError('UPLOAD', 'uploadMemory error', { error });

      if (typeof error === 'object' && error.type === 'duplicate') {
        throw new DuplicateError(
          error.message,
          error.duplicate_type,
          error.existing_id,
          error.similarity
        );
      }

      const errorMessage = typeof error === 'string' ? error : error.message || 'Upload failed';
      throw new WrapperError(errorMessage, 400, false);
    }

    logError('UPLOAD', 'uploadMemory unexpected result', { result });
    throw new WrapperError('Upload failed', 500, true);
  }

  /**
   * 批量上传记忆
   * @param {Array} memories - 记忆数组
   * @returns {Promise<{total: number, success: number, failed: number, memory_ids: string[], errors: string[]}>}
   */
  async uploadMemories(memories) {
    logInfo('UPLOAD', 'Starting uploadMemories', { count: memories.length, tenant: this.tenantId });

    const requestBody = {
      memories: memories.map(m => ({
        content: m.content,
        abstract: m.abstract,
        overview: m.overview,
        type: m.type || 'general',
        tags: m.tags || [],
        project_id: m.project_id || 'global',
        source_id: m.source_id,
        local_id: m.local_id,
        source: m.source || 'plugin',
        tenant_id: m.tenant_id || this.tenantId,
        metadata: m.metadata || {},
      })),
      tenant_id: this.tenantId,
    };

    logDebug('UPLOAD', 'Request body prepared', {
      memories: requestBody.memories.map(m => ({
        type: m.type,
        abstract: m.abstract?.substring(0, 30),
      })),
    });

    const result = await withRetry(
      () => this.http.post('/api/v1/memories', requestBody),
      this.maxRetries
    );

    logInfo('UPLOAD', 'uploadMemories completed', {
      total: result.total,
      success: result.success,
      failed: result.failed,
      memory_ids: result.memory_ids,
    });

    return result;
  }

  async reportAccessLog({ entries, tenant_id }) {
    const requestBody = {
      entries: entries.map(e => ({
        entry_id: e.entry_id,
        timestamp: e.timestamp,
        type: e.type,
      })),
      tenant_id: tenant_id || this.tenantId,
    };

    return await this.http.post('/api/v1/access-log', requestBody);
  }

  /**
   * 创建关系
   * @param {Object} params - 关系参数
   * @returns {Promise<{id: string, relationship_type: string, weight: number}>}
   */
  async createRelation({
    from_id,
    to_id,
    relationship_type = 'related',
    weight = 0.5,
    description,
    tenant_id,
  }) {
    const requestBody = {
      from_id,
      to_id,
      relationship_type,
      weight,
      tenant_id: tenant_id || this.tenantId,
    };

    if (description) {
      requestBody.description = description;
    }

    return await withRetry(
      () => this.http.post('/api/v1/memories/relations', requestBody),
      this.maxRetries
    );
  }

  /**
   * 查询关系
   * @param {Object} params - 查询参数
   * @returns {Promise<{relations: Array, total: number}>}
   */
  async getRelations({ memory_id, direction = 'both', relationship_type, tenant_id }) {
    const requestBody = {
      direction,
      tenant_id: tenant_id || this.tenantId,
    };

    if (relationship_type) {
      requestBody.relationship_type = relationship_type;
    }

    return await withRetry(
      () => this.http.post(`/api/v1/memories/${memory_id}/relations`, requestBody),
      this.maxRetries
    );
  }

  /**
   * 删除关系
   * @param {string} relation_id - 关系ID
   * @param {string} tenant_id - 租户ID (可选)
   * @returns {Promise<{deleted: boolean}>}
   */
  async deleteRelation(relation_id, tenant_id) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);

    return await withRetry(
      () => this.http.delete(`/api/v1/memories/relations/${relation_id}?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 图遍历
   * @param {Object} params - 遍历参数
   * @returns {Promise<{memories: Array, total: number, depth: number, source: string}>}
   */
  async traverseGraph({ memory_id, depth = 2, tenant_id }) {
    const requestBody = {
      depth,
      tenant_id: tenant_id || this.tenantId,
    };

    return await withRetry(
      () => this.http.post(`/api/v1/memories/${memory_id}/graph`, requestBody),
      this.maxRetries
    );
  }

  // ===== Phase B: Sync Methods =====

  /**
   * 增量同步 - 比对本地指纹和服务端指纹，返回需要上传/删除的指令
   * @param {Array<{path: string, mtime: number, hash: string, source_id: string}>} fingerprints
   * @param {string} tenant_id
   * @returns {Promise<{to_upload: Array, to_delete: Array, conflicts: Array, server_fingerprints: Array}>}
   */
  async syncPreview(fingerprints, tenant_id) {
    const requestBody = {
      fingerprints: fingerprints.map(fp => ({
        path: fp.path,
        mtime: fp.mtime,
        hash: fp.hash,
        source_id: fp.source_id,
      })),
      tenant_id: tenant_id || this.tenantId,
    };

    return await withRetry(
      () => this.http.post('/api/v1/sync/preview', requestBody),
      this.maxRetries
    );
  }

  /**
   * 全量同步 - 上传所有记忆到服务端（用于首次同步或完全重建）
   * @param {Array} memories
   * @param {string} tenant_id
   * @returns {Promise<{uploaded: number, skipped: number, failed: number}>}
   */
  async syncFull(memories, tenant_id) {
    const requestBody = {
      memories: memories.map(m => ({
        content: m.content,
        abstract: m.abstract || null,
        overview: m.overview || null,
        type: m.type || 'general',
        tags: m.tags || [],
        project_id: m.project_id || 'global',
        source_id: m.source_id,
        local_id: m.local_id,
        source: m.source || 'plugin',
        metadata: m.metadata || {},
        tenant_id: m.tenant_id || this.tenantId,
      })),
      tenant_id: tenant_id || this.tenantId,
    };

    return await withRetry(() => this.http.post('/api/v1/sync/full', requestBody), this.maxRetries);
  }

  /**
   * 获取服务端指纹列表 - 用于增量同步前的对比
   * @param {string} tenant_id
   * @returns {Promise<{fingerprints: Array<{path: string, mtime: number, hash: string, source_id: string}>}>}
   */
  async getServerFingerprints(tenant_id) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);

    return await withRetry(
      () => this.http.get(`/api/v1/sync/fingerprints?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 解决冲突 - 决定如何处理服务端和本地端的冲突
   * @param {string} conflict_id
   * @param {string} resolution - 'keep_local' | 'keep_server' | 'merge'
   * @param {string} tenant_id
   * @returns {Promise<{success: boolean, resolution: string}>}
   */
  async resolveConflict(conflict_id, resolution, tenant_id) {
    const requestBody = {
      resolution,
      tenant_id: tenant_id || this.tenantId,
    };

    return await withRetry(
      () => this.http.post(`/api/v1/sync/conflicts/${conflict_id}/resolve`, requestBody),
      this.maxRetries
    );
  }

  async listConflicts({ limit = 10, tenant_id }) {
    const body = { tenant_id: tenant_id || this.tenantId, limit };
    try {
      return await this.http.post('/api/v1/sync/conflicts/list', body);
    } catch {
      return [];
    }
  }

  async lookupMemory(params) {
    const queryParams = new URLSearchParams();

    if (params.source_id) queryParams.append('source_id', params.source_id);
    if (params.hash) queryParams.append('hash', params.hash);
    if (params.file_path) queryParams.append('file_path', params.file_path);
    if (params.project_id) queryParams.append('project_id', params.project_id);
    if (params.type) queryParams.append('type', params.type);
    if (params.tenant_id) queryParams.append('tenant_id', params.tenant_id);
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.all) queryParams.append('all', 'true');

    const url = `/api/v1/memories/lookup?${queryParams.toString()}`;

    return await withRetry(() => this.http.get(url), this.maxRetries);
  }

  async createCallRelations(calls) {
    return await withRetry(() => this.http.post('/api/v1/calls/batch', { calls }), this.maxRetries);
  }

  async getCallReferences(memoryId, limit = 50) {
    return await withRetry(
      () => this.http.get(`/api/v1/memories/${memoryId}/references?limit=${limit}`),
      this.maxRetries
    );
  }

  async getCallDependencies(memoryId, limit = 50) {
    return await withRetry(
      () => this.http.get(`/api/v1/memories/${memoryId}/dependencies?limit=${limit}`),
      this.maxRetries
    );
  }

  async getProjectStats(projectId) {
    return await withRetry(
      () => this.http.get(`/api/v1/projects/${projectId}/stats`),
      this.maxRetries
    );
  }
}

let wrapperClientInstance = null;

export function getWrapperClient(config) {
  if (!wrapperClientInstance) {
    wrapperClientInstance = new WrapperClient(config);
  }
  return wrapperClientInstance;
}
