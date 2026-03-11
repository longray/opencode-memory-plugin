/**
 * Wrapper Client - Backend Memory Service HTTP API Client
 *
 * 封装后端记忆服务的所有 API 调用
 * 支持：健康检查、搜索、上传、图关系、图遍历
 * 特性：自动重试、错误分类、超时控制
 *
 * @version 1.0.0
 */

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const QUEUE_FILE = path.join(MEMORY_DIR, 'upload-queue.json');

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

      if (!response.ok) {
        const errorText = await response.text();
        const retryable = response.status >= 500 || response.status === 429;
        throw new WrapperError(`HTTP ${response.status}: ${errorText}`, response.status, retryable);
      }

      // 204 No Content
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new WrapperError('Request timeout', 408, true);
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new WrapperError('Backend service unavailable', 503, true);
      }

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
    this.baseUrl =
      config.backend?.url || process.env.MEMORY_BACKEND_URL || 'http://localhost:17999';
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
   * @returns {Promise<{status: string, embedding_service: object, surrealdb: object, cache_stats: object}>}
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
   * 获取文本嵌入向量
   * @param {string} text - 输入文本
   * @param {string} model - 模型名称 (可选)
   * @returns {Promise<number[]>} - 1024维向量
   */
  async getEmbedding(text, model = 'Qwen3-Embedding-0.6B') {
    const response = await withRetry(
      () =>
        this.http.post('/v1/embeddings', {
          input: text,
          model,
          encoding_format: 'float',
        }),
      this.maxRetries
    );

    if (response.data && response.data[0] && response.data[0].embedding) {
      return response.data[0].embedding;
    }

    throw new WrapperError('Invalid embedding response format', 500, false);
  }

  /**
   * 搜索记忆
   * @param {Object} params - 搜索参数
   * @param {string} params.query - 搜索查询
   * @param {string} params.mode - 搜索模式: 'vector' | 'keyword' | 'hybrid'
   * @param {number} params.limit - 结果数量限制 (默认10)
   * @param {number} params.threshold - 相似度阈值 (默认0.3)
   * @param {string} params.tenant_id - 租户ID (可选)
   * @param {string} params.project_id - 项目ID (可选)
   * @returns {Promise<{results: Array, total: number, mode: string}>}
   */
  async search({ query, mode = 'hybrid', limit = 10, threshold = 0.3, tenant_id, project_id }) {
    const requestBody = {
      query,
      mode,
      limit,
      threshold,
      tenant_id: tenant_id || this.tenantId,
    };

    if (project_id) {
      requestBody.project_id = project_id;
    }

    return await withRetry(
      () => this.http.post('/api/v1/memories/search', requestBody),
      this.maxRetries
    );
  }

  /**
   * 上传单条记忆
   * @param {Object} memory - 记忆数据
   * @returns {Promise<{id: string, success: boolean}>}
   */
  async uploadMemory(memory) {
    const result = await this.uploadMemories([memory]);

    if (result.success === 1 && result.memory_ids.length === 1) {
      return { id: result.memory_ids[0], success: true };
    }

    if (result.errors && result.errors.length > 0) {
      throw new WrapperError(result.errors[0], 400, false);
    }

    throw new WrapperError('Upload failed', 500, true);
  }

  /**
   * 批量上传记忆
   * @param {Array} memories - 记忆数组
   * @returns {Promise<{total: number, success: number, failed: number, memory_ids: string[], errors: string[]}>}
   */
  async uploadMemories(memories) {
    const requestBody = {
      memories: memories.map(m => ({
        content: m.content,
        type: m.type || 'general',
        tags: m.tags || [],
        project_id: m.project_id || 'global',
        source_id: m.source_id,
        source: m.source || 'plugin',
        tenant_id: m.tenant_id || this.tenantId,
        metadata: m.metadata || {},
      })),
      tenant_id: this.tenantId,
    };

    return await withRetry(() => this.http.post('/api/v1/memories', requestBody), this.maxRetries);
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
}

/**
 * 单例模式获取 WrapperClient
 */
let wrapperClientInstance = null;

export function getWrapperClient(config) {
  if (!wrapperClientInstance) {
    wrapperClientInstance = new WrapperClient(config);
  }
  return wrapperClientInstance;
}

export function resetWrapperClient() {
  wrapperClientInstance = null;
}

export default WrapperClient;
