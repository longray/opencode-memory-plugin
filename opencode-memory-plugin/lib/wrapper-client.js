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

import { writeLog, logWarn } from './logger.js';
import { DEFAULT_HTTP_TIMEOUT_MS, RETRY_BASE_DELAY_MS } from './constants.js';
import { DEFAULT_API_PORT } from './constants.js';

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
  constructor(baseUrl, timeout = DEFAULT_HTTP_TIMEOUT_MS) {
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

      if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
        throw new WrapperError('Backend service unavailable', 503, true);
      }

      if (error instanceof TypeError && error.message.includes('fetch failed')) {
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

  async put(endpoint, body) {
    return this.request('PUT', endpoint, body);
  }

  async delete(endpoint) {
    return this.request('DELETE', endpoint);
  }
}

/**
 * 重试策略
 */
async function withRetry(fn, maxRetries = 3, baseDelay = RETRY_BASE_DELAY_MS) {
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
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
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
    const apiPort = process.env.API_PORT || DEFAULT_API_PORT;
    const defaultUrl = `http://localhost:${apiPort}`;
    this.baseUrl = config.backend?.url || process.env.MEMORY_BACKEND_URL || defaultUrl;
    this.tenantId =
      config.backend?.tenant_id ||
      process.env.MEMORY_TENANT_ID ||
      process.env.USERNAME ||
      'default';
    this.timeout = config.backend?.timeout || DEFAULT_HTTP_TIMEOUT_MS;
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
      const stats = await withRetry(
        () => this.http.get(`/api/v1/memories/stats?tenant_id=${this.tenantId}`),
        this.maxRetries
      );
      return {
        status: health.status || 'unavailable',
        memory_count: stats.total_memories || 0,
        relation_count: stats.total_relations || 0,
        healthy: health.status === 'healthy',
      };
    } catch (error) {
      return {
        status: 'error',
        memory_count: 0,
        relation_count: 0,
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
    scope,
    atom_types,
  }) {
    const effectiveTenantId = tenant_id || this.tenantId;
    logInfo('SEARCH', 'search called', {
      query,
      mode,
      limit,
      scope,
      tenant_id: effectiveTenantId,
    });

    const requestBody = {
      query,
      mode,
      limit,
      threshold,
      level,
      tenant_id: effectiveTenantId,
    };

    if (project_id) {
      requestBody.project_id = project_id;
    }

    const useUnifiedEndpoint = scope && scope !== 'all';

    if (useUnifiedEndpoint) {
      requestBody.scope = scope;
      if (atom_types && atom_types.length > 0) {
        requestBody.atom_types = atom_types;
      }
    }

    const endpoint = useUnifiedEndpoint ? '/api/v1/search' : '/api/v1/memories/search';

    const result = await withRetry(() => this.http.post(endpoint, requestBody), this.maxRetries);

    logInfo('SEARCH', 'search completed', {
      result_count: result.results?.length || 0,
      endpoint,
    });

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

    // content_hash 去重命中 — 后端已有相同内容，视为成功
    if (result.skipped && result.skipped.length === 1 && result.skipped[0].reason === 'hash') {
      const existingId = result.skipped[0].existing_id;
      logInfo('UPLOAD', 'uploadMemory skipped (content_hash duplicate)', {
        local_id: result.skipped[0].local_id,
        existing_id: existingId,
      });
      return { id: existingId, success: true, deduplicated: true };
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
        atoms: m.atoms || undefined, // Include atoms field for Atom Architecture v3.3
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

    return await withRetry(
      () => this.http.post('/api/v1/access-log', requestBody),
      this.maxRetries
    );
  }

  /**
   * 创建关系
   * @param {Object} params - 关系参数
   * @returns {Promise<{id: string, type: string, weight: number}>}
   */
  async createRelation({ from_id, to_id, type = 'related', weight = 0.5, description, tenant_id }) {
    const requestBody = {
      from_id,
      to_id,
      type,
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
  async getRelations({ memory_id, direction = 'both', type, tenant_id }) {
    const requestBody = {
      direction,
      tenant_id: tenant_id || this.tenantId,
    };

    if (type) {
      requestBody.type = type;
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
        atoms: m.atoms || undefined,
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
      return await withRetry(
        () => this.http.post('/api/v1/sync/conflicts/list', body),
        this.maxRetries
      );
    } catch (e) {
      logWarn('wrapper-client', 'Failed to list conflicts, returning empty', { error: e.message });
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

  // ===== Atom/Entity/Reference API (BL-CA-40) =====

  /**
   * 创建 Atom
   * @param {Object} atomData - Atom 数据
   * @param {string} atomData.type - Atom 类型 (function, class, interface, import, goal, scope, task, note)
   * @param {string} atomData.content - 内容
   * @param {string} [atomData.name] - 名称
   * @param {string} [atomData.tenant_id] - 租户 ID
   * @returns {Promise<{id: string, type: string, content: string}>}
   */
  async createAtom(atomData) {
    logInfo('ATOM', 'createAtom called', { type: atomData.type, name: atomData.name });

    const VALID_ATOM_TYPES = new Set([
      'function',
      'class',
      'interface',
      'import',
      'note',
      'section',
      'chapter',
      'goal',
      'scope',
      'task',
    ]);

    if (!VALID_ATOM_TYPES.has(atomData.type)) {
      throw new WrapperError(`Invalid atom type: ${atomData.type}`, 400, false);
    }

    const requestBody = {
      type: atomData.type,
      content: atomData.content,
      tenant_id: atomData.tenant_id || this.tenantId,
    };

    // 可选字段
    if (atomData.name) requestBody.name = atomData.name;
    if (atomData.signature) requestBody.signature = atomData.signature;
    if (atomData.params) requestBody.params = atomData.params;
    if (atomData.return_type) requestBody.return_type = atomData.return_type;
    if (atomData.is_exported !== undefined) requestBody.is_exported = atomData.is_exported;
    if (atomData.is_async !== undefined) requestBody.is_async = atomData.is_async;
    if (atomData.complexity !== undefined) requestBody.complexity = atomData.complexity;
    if (atomData.max_nesting_depth !== undefined)
      requestBody.max_nesting_depth = atomData.max_nesting_depth;
    if (atomData.docstring) {
      requestBody.docstring =
        typeof atomData.docstring === 'string' ? { text: atomData.docstring } : atomData.docstring;
    }
    if (atomData.start_line !== undefined) requestBody.start_line = atomData.start_line;
    if (atomData.end_line !== undefined) requestBody.end_line = atomData.end_line;
    if (atomData.status) requestBody.status = atomData.status;
    if (atomData.metadata) requestBody.metadata = atomData.metadata;
    if (atomData.project) requestBody.project = atomData.project;

    const result = await withRetry(
      () => this.http.post('/api/v1/atoms', requestBody),
      this.maxRetries
    );

    logInfo('ATOM', 'createAtom success', { id: result.id });
    return result;
  }

  /**
   * 获取 Atom
   * @param {string} atomId - Atom ID
   * @param {string} [tenant_id] - 租户 ID
   * @returns {Promise<Object>}
   */
  async getAtom(atomId, tenant_id) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);

    return await withRetry(
      () => this.http.get(`/api/v1/atoms/${atomId}?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 列出 Atoms
   * @param {Object} filters - 过滤条件
   * @param {string} [filters.type] - Atom 类型
   * @param {string} [filters.project] - 项目 ID
   * @param {number} [filters.limit] - 数量限制
   * @param {string} [filters.tenant_id] - 租户 ID
   * @returns {Promise<{atoms: Array, total: number}>}
   */
  async listAtoms({ type, project, limit, tenant_id, query } = {}) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);
    if (query) params.append('query', query);
    if (type) params.append('type', type);
    if (project) params.append('project', project);
    if (limit) params.append('limit', limit.toString());

    return await withRetry(
      () => this.http.get(`/api/v1/atoms?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 更新 Atom
   * @param {string} atomId - Atom ID
   * @param {Object} updates - 更新字段
   * @param {string} [updates.tenant_id] - 租户 ID
   * @returns {Promise<Object>}
   */
  async updateAtom(atomId, updates) {
    const requestBody = { ...updates };
    if (!requestBody.tenant_id) {
      requestBody.tenant_id = this.tenantId;
    }

    return await withRetry(
      () => this.http.put(`/api/v1/atoms/${atomId}`, requestBody),
      this.maxRetries
    );
  }

  /**
   * 删除 Atom
   * @param {string} atomId - Atom ID
   * @param {string} [tenant_id] - 租户 ID
   * @returns {Promise<{success: boolean}>}
   */
  async deleteAtom(atomId, tenant_id) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);

    return await withRetry(
      () => this.http.delete(`/api/v1/atoms/${atomId}?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 创建 Entity
   * @param {Object} entityData - Entity 数据
   * @param {string} entityData.type - Entity 类型 (memory, backlog, wiki, code)
   * @param {string} entityData.abstract - 摘要
   * @param {string[]} [entityData.atoms] - 关联的 Atom IDs
   * @param {string} [entityData.tenant_id] - 租户 ID
   * @returns {Promise<{id: string, type: string, abstract: string}>}
   */
  async createEntity(entityData) {
    logInfo('ENTITY', 'createEntity called', {
      type: entityData.type,
      abstract: entityData.abstract?.substring(0, 50),
    });

    const requestBody = {
      type: entityData.type,
      abstract: entityData.abstract,
      tenant_id: entityData.tenant_id || this.tenantId,
    };

    if (entityData.overview) {
      requestBody.overview =
        typeof entityData.overview === 'string'
          ? { text: entityData.overview }
          : entityData.overview;
    }
    if (entityData.atoms) requestBody.atoms = entityData.atoms;
    if (entityData.tags) requestBody.tags = entityData.tags;
    if (entityData.project) requestBody.project = entityData.project;
    if (entityData.created_by) requestBody.created_by = entityData.created_by;

    // 类型特定字段
    if (entityData.title) requestBody.title = entityData.title;
    if (entityData.aliases) requestBody.aliases = entityData.aliases;
    if (entityData.priority) requestBody.priority = entityData.priority;
    if (entityData.status) requestBody.status = entityData.status;
    if (entityData.scene) requestBody.scene = entityData.scene;
    if (entityData.estimated_hours !== undefined)
      requestBody.estimated_hours = entityData.estimated_hours;
    if (entityData.actual_hours !== undefined) requestBody.actual_hours = entityData.actual_hours;
    if (entityData.file_path) requestBody.file_path = entityData.file_path;
    if (entityData.language) requestBody.language = entityData.language;
    if (entityData.quality_score !== undefined) {
      requestBody.quality_score =
        typeof entityData.quality_score === 'number'
          ? { score: entityData.quality_score }
          : entityData.quality_score;
    }
    if (entityData.complexity_metrics)
      requestBody.complexity_metrics = entityData.complexity_metrics;

    const result = await withRetry(
      () => this.http.post('/api/v1/entities', requestBody),
      this.maxRetries
    );

    logInfo('ENTITY', 'createEntity success', { id: result.id });
    return result;
  }

  /**
   * 获取 Entity
   * @param {string} entityId - Entity ID
   * @param {number} [level=2] - 返回层级 (0=abstract, 1=overview, 2=full)
   * @param {string} [tenant_id] - 租户 ID
   * @returns {Promise<Object>}
   */
  async getEntity(entityId, level = 2, tenant_id) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);
    params.append('level', level.toString());

    return await withRetry(
      () => this.http.get(`/api/v1/entities/${entityId}?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 列出 Entities
   * @param {Object} filters - 过滤条件
   * @param {string} [filters.type] - Entity 类型
   * @param {string} [filters.project] - 项目 ID
   * @param {string} [filters.status] - 状态
   * @param {number} [filters.limit] - 数量限制
   * @param {string} [filters.tenant_id] - 租户 ID
   * @returns {Promise<{entities: Array, total: number}>}
   */
  async listEntities({ type, project, status, limit, tenant_id } = {}) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);
    if (type) params.append('type', type);
    if (project) params.append('project', project);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());

    return await withRetry(
      () => this.http.get(`/api/v1/entities?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 创建 Reference（关系）
   * @param {Object} params - 关系参数
   * @param {string} params.from_id - 源 ID
   * @param {string} params.to_id - 目标 ID
   * @param {string} params.type - 关系类型 (calls, imports, extends, implements, related)
   * @param {number} [params.weight=0.5] - 权重
   * @param {Object} [params.metadata] - 元数据
   * @param {string} [params.tenant_id] - 租户 ID
   * @returns {Promise<{id: string, from_id: string, to_id: string, type: string}>}
   */
  async createReference({ from_id, to_id, type, weight = 0.5, metadata, tenant_id }) {
    logInfo('REFERENCE', 'createReference called', { from_id, to_id, type });

    const requestBody = {
      from_id,
      to_id,
      type,
      weight,
      tenant_id: tenant_id || this.tenantId,
    };

    if (metadata) requestBody.metadata = metadata;

    const result = await withRetry(
      () => this.http.post('/api/v1/references', requestBody),
      this.maxRetries
    );

    logInfo('REFERENCE', 'createReference success', { id: result.id });
    return result;
  }

  /**
   * 批量创建 References（关系）
   * @param {Array<Object>} references - 关系数组，每项包含 from_id, to_id, type, weight 等
   * @returns {Promise<{references: Array}>}
   */
  async createReferences(references) {
    logInfo('REFERENCE', `createReferences called with ${references.length} items`);

    const result = await withRetry(
      () => this.http.post('/api/v1/references/batch', { references }),
      this.maxRetries
    );

    logInfo('REFERENCE', 'createReferences success', {
      count: result.references?.length ?? 0,
    });
    return result;
  }

  /**
   * 查询 References
   * @param {Object} filters - 过滤条件
   * @param {string} [filters.from_id] - 源 ID
   * @param {string} [filters.to_id] - 目标 ID
   * @param {string} [filters.type] - 关系类型
   * @param {number} [filters.limit] - 数量限制
   * @param {string} [filters.tenant_id] - 租户 ID
   * @returns {Promise<{references: Array, total: number}>}
   */
  async queryReferences({ from_id, to_id, type, limit, tenant_id } = {}) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);
    if (from_id) params.append('from_id', from_id);
    if (to_id) params.append('to_id', to_id);
    if (type) params.append('type', type);
    if (limit) params.append('limit', limit.toString());

    return await withRetry(
      () => this.http.get(`/api/v1/references?${params.toString()}`),
      this.maxRetries
    );
  }

  /**
   * 删除 Reference
   * @param {string} referenceId - Reference ID
   * @param {string} [tenant_id] - 租户 ID
   * @returns {Promise<{success: boolean}>}
   */
  async deleteReference(referenceId, tenant_id) {
    const params = new URLSearchParams();
    params.append('tenant_id', tenant_id || this.tenantId);

    return await withRetry(
      () => this.http.delete(`/api/v1/references/${referenceId}?${params.toString()}`),
      this.maxRetries
    );
  }

  async verifyUploadCompleteness({ project, tenant_id } = {}) {
    const atomsResult = await this.listAtoms({ project, tenant_id });
    const refsResult = await this.queryReferences({ tenant_id });

    const atoms = atomsResult.data || [];
    const refs = refsResult.data || [];

    const refAtomIds = new Set();
    for (const ref of refs) {
      if (ref.from_id) refAtomIds.add(ref.from_id);
      if (ref.to_id) refAtomIds.add(ref.to_id);
    }

    const functions = atoms.filter(a => a.type === 'function');
    const unreferenced = functions.filter(a => !refAtomIds.has(a.id));

    return {
      total_atoms: atomsResult.total,
      total_functions: functions.length,
      total_references: refsResult.total || 0,
      unreferenced_functions: unreferenced.length,
      completeness: refAtomIds.size > 0 ? 'PASS' : 'INCOMPLETE',
    };
  }

  /**
   * 获取搜索建议（基于后端搜索 API）
   * @param {string} prefix - 前缀
   * @param {number} limit - 建议数量
   * @param {string} tenant_id - 租户 ID
   * @returns {Promise<Array>} 建议列表
   */
  async suggest({ prefix, limit = 10, tenant_id } = {}) {
    const effectiveTenantId = tenant_id || this.tenantId;
    // 使用 keyword 模式搜索前缀匹配
    const result = await withRetry(
      () =>
        this.http.post('/api/v1/memories/search', {
          query: prefix,
          mode: 'keyword',
          limit,
          threshold: 0.01,
          level: 0,
          tenant_id: effectiveTenantId,
        }),
      this.maxRetries
    );

    // 从搜索结果中提取唯一的关键词建议
    const suggestions = new Set();
    if (result.results) {
      for (const r of result.results) {
        if (r.abstract) suggestions.add(r.abstract.substring(0, 50));
        if (r.name) suggestions.add(r.name);
      }
    }
    return [...suggestions].slice(0, limit);
  }
}

let wrapperClientInstance = null;

export function getWrapperClient(config) {
  if (!wrapperClientInstance) {
    wrapperClientInstance = new WrapperClient(config);
  } else if (config?.forceNew) {
    wrapperClientInstance = new WrapperClient(config);
  } else if (
    config?.backend?.tenant_id &&
    config.backend.tenant_id !== wrapperClientInstance.tenantId
  ) {
    logWarn(
      'WrapperClient',
      `Ignoring tenant_id change: ${wrapperClientInstance.tenantId} → ${config.backend.tenant_id}. Use forceNew=true if needed.`
    );
  }
  return wrapperClientInstance;
}

/**
 * 重置 WrapperClient 单例实例
 * 用于在 tenant_id 变更或其他需要重新初始化的情况下使用
 */
export function resetWrapperClient(config = null) {
  if (config) {
    // 使用新配置创建新实例
    wrapperClientInstance = new WrapperClient(config);
  } else {
    // 完全重置，下次调用 getWrapperClient 时会使用新的默认配置
    wrapperClientInstance = null;
  }
  return wrapperClientInstance;
}
