import { codeAnalyzer } from './code-analyzer.js';
import { getWrapperClient } from './wrapper-client.js';
import { getPrecomputeClient } from './precompute/client.js';
import { FingerprintCache } from './precompute/fingerprint-cache.js';
import { resolveProjectId } from './project-resolver.js';
import { shouldSkipFile } from './privacy-filter.js';
import { getConfig } from './storage.js';
import { MemoryIdCache } from './memory-id-cache.js';
import fs from 'fs';
import path from 'path';
import { readFile } from 'fs/promises';
import { extname, relative, basename } from 'path';
import { createHash } from 'crypto';
import { analyzeWithQuery } from './tree-sitter-parser.js';
import { logInfo, logError, logWarn } from './logger.js';
import {
  QUEUE_TIMEOUT_MS as DEFAULT_QUEUE_TIMEOUT_MS,
  QUEUE_POLL_DELAY_MS,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_BATCH_DELAY_MS,
} from './constants.js';

function getCodeAnalysisConfig() {
  return getConfig().code_analysis || {};
}

function getDebounceMs() {
  return getCodeAnalysisConfig().debounce_ms || DEFAULT_DEBOUNCE_MS;
}

function getBatchDelayMs() {
  return getCodeAnalysisConfig().batch_delay_ms || DEFAULT_BATCH_DELAY_MS;
}

function getBatchMaxSize() {
  return getCodeAnalysisConfig().batch_max_size || 10;
}

function getMaxConcurrent() {
  return getCodeAnalysisConfig().max_concurrent || 2;
}

function getQueueTimeoutMs() {
  return getCodeAnalysisConfig().queue_timeout_ms || DEFAULT_QUEUE_TIMEOUT_MS;
}

function getQueueMaxSize() {
  return getCodeAnalysisConfig().queue_max_size || 10;
}

function isAutoLinkToConversation() {
  return getCodeAnalysisConfig().auto_link_to_conversation !== false;
}

function useAtomEntityApi() {
  return getCodeAnalysisConfig().use_atom_entity_api !== false;
}

const SUPPORTED_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
  '.py',
  '.go',
  '.rs',
  '.java',
];

export class AnalysisQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.batch = [];
    this.batchTimer = null;
    this.debounceTimer = null;
    this._client = null;
    this._clientTenant = null;
    this.precomputeClient = getPrecomputeClient();
    this.concurrentCount = 0;
    this.memoryIdCache = null;
    this.fingerprintCache = null;
    this.usePrecompute = getCodeAnalysisConfig().use_precompute !== false;
  }

  get client() {
    const cfg = getConfig();
    const tenantId =
      cfg.backend?.tenant_id ||
      process.env.MEMORY_TENANT_ID ||
      process.env.USERNAME ||
      'default';

    if (!this._client || this._clientTenant !== tenantId) {
      this._clientTenant = tenantId;
      this._client = getWrapperClient({ backend: { tenant_id: tenantId }, forceNew: true });
    }
    return this._client;
  }

  async initCache() {
    try {
      if (!this.memoryIdCache) {
        const projectId = await resolveProjectId({});
        this.memoryIdCache = new MemoryIdCache(projectId);
        await this.memoryIdCache.load();
      }
    } catch (_error) {
      logWarn(
        'CodeAnalysis',
        `[CodeAnalysis] Precompute API not available, falling back to atom/entity API: ${_error.message}`
      );
    }

    try {
      if (!this.fingerprintCache && this.usePrecompute) {
        const projectRoot = process.cwd();
        this.fingerprintCache = new FingerprintCache(projectRoot);
      }
    } catch (error) {
      logWarn(
        'CodeAnalysis',
        `[CodeAnalysis] FingerprintCache init failed, continuing without fingerprinting: ${error.message}`
      );
    }
  }

  async add(filePath, projectRoot) {
    try {
      const relativePath = relative(projectRoot, filePath);

      const skipCheck = shouldSkipFile(filePath);
      if (skipCheck.skip) {
        logInfo(
          'CodeAnalysis',
          `[CodeAnalysis] Skipping file: ${relativePath} (${skipCheck.reason})`
        );
        return;
      }

      const ext = extname(filePath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        logInfo('CodeAnalysis', `[CodeAnalysis] Skipping unsupported file type: ${relativePath}`);
        return;
      }

      if (this.queue.length >= getQueueMaxSize()) {
        const removed = this.queue.shift();
        logWarn(
          'CodeAnalysis',
          `[CodeAnalysis] Queue full (${getQueueMaxSize()}), dropped oldest: ${removed?.filePath || 'unknown'}`
        );
      }

      const existingIndex = this.queue.findIndex(item => item.filePath === filePath);
      if (existingIndex !== -1) {
        this.queue.splice(existingIndex, 1);
      }

      this.queue.push({
        filePath,
        relativePath,
        projectRoot,
        timestamp: Date.now(),
      });

      this.debouncedProcess();
    } catch (error) {
      logError(
        'CodeAnalysis',
        `[CodeAnalysis] Failed to queue file ${filePath}: ${error.message}`,
        error
      );
    }
  }

  debouncedProcess() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      try {
        this.processQueue();
      } catch (error) {
        logError(
          'CodeAnalysis',
          `[CodeAnalysis] Queue processing trigger failed: ${error.message}`,
          error
        );
      }
    }, getDebounceMs());
  }

  async processQueue() {
    if (this.queue.length === 0) return;

    try {
      const now = Date.now();
      const validItems = this.queue.filter(item => now - item.timestamp < getQueueTimeoutMs());
      const expiredCount = this.queue.length - validItems.length;
      if (expiredCount > 0) {
        logInfo('CodeAnalysis', `[CodeAnalysis] Dropped ${expiredCount} expired items from queue`);
      }
      this.queue = validItems;

      if (this.queue.length === 0) return;

      const availableSlots = getMaxConcurrent() - this.concurrentCount;
      if (availableSlots <= 0) {
        setTimeout(() => this.processQueue(), QUEUE_POLL_DELAY_MS);
        return;
      }

      const itemsToProcess = this.queue.splice(0, availableSlots);

      for (const item of itemsToProcess) {
        this.processItem(item);
      }

      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), QUEUE_POLL_DELAY_MS);
      }
    } catch (error) {
      logError('CodeAnalysis', `[CodeAnalysis] Queue processing failed: ${error.message}`, error);
    }
  }

  async processItem(item) {
    if (this.processing.has(item.filePath)) return;

    this.processing.add(item.filePath);
    this.concurrentCount++;

    try {
      await this.initCache();

      let content;
      try {
        content = await readFile(item.filePath, 'utf-8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          logInfo('CodeAnalysis', `[CodeAnalysis] File not found (deleted?): ${item.relativePath}`);
          return;
        }
        throw new Error(`Failed to read file ${item.relativePath}: ${error.message}`);
      }

      const contentCheck = shouldSkipFile(item.filePath, content);
      if (contentCheck.skip) {
        logInfo(
          'CodeAnalysis',
          `[CodeAnalysis] Skipping file with sensitive content: ${item.relativePath}`
        );
        return;
      }

      if (this.usePrecompute && this.fingerprintCache) {
        const fpCheck = this.fingerprintCache.hasChanged(item.relativePath, content, null);
        if (!fpCheck.changed) {
          logInfo(
            'CodeAnalysis',
            `[CodeAnalysis] File unchanged (fingerprint): ${item.relativePath}`
          );
          return;
        }
      }

      const result = await codeAnalyzer.analyze(item.filePath, content);

      if (this.usePrecompute && this.fingerprintCache) {
        const fpCheck = this.fingerprintCache.hasChanged(item.relativePath, content, result);
        if (!fpCheck.changed) {
          logInfo('CodeAnalysis', `[CodeAnalysis] File unchanged (symbols): ${item.relativePath}`);
          return;
        }
      }

      // BL-CA-45: Route to Atom/Entity API or legacy batch flow
      if (useAtomEntityApi()) {
        await this.uploadAsAtomEntity(item, result, content);
      } else {
        this.addToBatch(item, result, content);
      }
    } catch (error) {
      logError('CodeAnalysis', `[CodeAnalysis] Error analyzing ${item.relativePath}:`, error);
    } finally {
      this.processing.delete(item.filePath);
      this.concurrentCount--;
    }
  }

  async addToBatch(item, analysisResult, content) {
    const projectId = await resolveProjectId({ projectRoot: item.projectRoot });

    const sourceId = this.memoryIdCache?.generateSourceId() || `local-${Date.now()}`;
    const contentHash = createHash('md5').update(content).digest('hex');

    const memoryItem = {
      type: 'code',
      content: content,
      abstract: this.generateAbstract(item.relativePath, analysisResult),
      overview: this.generateOverview(item.relativePath, analysisResult),
      tags: [analysisResult.language, 'code-analysis'],
      project_id: projectId,
      source_id: sourceId,
      local_id: sourceId,
      metadata: {
        file_path: item.relativePath,
        file_name: basename(item.filePath),
        code_analysis: analysisResult,
        content_hash: contentHash,
      },
    };

    this.batch.push({
      memoryItem,
      filePath: item.relativePath,
      sourceId,
      contentHash,
    });

    if (this.batch.length >= getBatchMaxSize()) {
      this.flushBatch();
    } else {
      this.scheduleBatchFlush();
    }
  }

  generateAbstract(filePath, result) {
    const lang = result.language;
    const funcCount = result.functions?.length || 0;
    const classCount = result.classes?.length || 0;
    return `${lang} file: ${filePath} (${funcCount} functions, ${classCount} classes)`;
  }

  generateOverview(filePath, result) {
    const lines = result.complexity_metrics?.lines_of_code || 0;
    const funcs =
      result.functions
        ?.map(f => f.name)
        .slice(0, 5)
        .join(', ') || 'none';
    const classes =
      result.classes
        ?.map(c => c.name)
        .slice(0, 3)
        .join(', ') || 'none';

    return `File: ${filePath}\nLines: ${lines}\nFunctions: ${funcs}\nClasses: ${classes}\nComplexity: ${result.complexity_metrics?.cyclomatic || 0}`;
  }

  scheduleBatchFlush() {
    if (this.batchTimer) return;

    this.batchTimer = setTimeout(() => {
      this.flushBatch();
    }, getBatchDelayMs());
  }

  async flushBatch() {
    if (this.batch.length === 0) return;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const batchToSend = [...this.batch];
    this.batch = [];

    try {
      await this.initCache();

      if (this.usePrecompute) {
        try {
          await this.flushBatchPrecompute(batchToSend);
        } catch (_error) {
          logWarn(
            'CodeAnalysisService',
            `[CodeAnalysisService] Precompute API not available, falling back to legacy upload: ${_error.message}`
          );
          await this.flushBatchLegacy(batchToSend);
        }
      } else {
        await this.flushBatchLegacy(batchToSend);
      }
    } catch (error) {
      logError('CodeAnalysis', '[CodeAnalysis] All upload strategies failed:', error);
    }
  }

  async flushBatchPrecompute(batchToSend) {
    const projectId = await resolveProjectId({});

    const analysisResults = batchToSend.map(item => {
      const meta = item.memoryItem.metadata;
      return {
        file_path: item.filePath,
        content: item.memoryItem.content,
        ...meta.code_analysis,
        call_relations: meta.code_analysis.call_relations || [],
      };
    });

    logInfo(
      'CodeAnalysis',
      `[CodeAnalysis] Uploading ${analysisResults.length} files via Precompute API...`
    );
    const result = await this.precomputeClient.uploadAnalysisBatch({
      project_id: projectId,
      files: analysisResults.map(r => ({ path: r.file_path, content: r.content })),
      symbols: analysisResults.flatMap(r => [
        ...(r.functions || []).map(f => ({
          name: f.name,
          type: 'function',
          line: f.start,
          file_path: r.file_path,
        })),
        ...(r.classes || []).map(c => ({
          name: c.name,
          type: 'class',
          line: c.start,
          file_path: r.file_path,
        })),
        ...(r.interfaces || []).map(i => ({
          name: i.name,
          type: 'interface',
          line: i.start,
          file_path: r.file_path,
        })),
      ]),
      relations: analysisResults.flatMap(r =>
        (r.call_relations || []).map(rel => ({
          from_symbol: rel.from,
          to_symbol: rel.to,
          type: rel.type || 'calls',
          line: rel.line,
          file_path: r.file_path,
          from_file: r.file_path,
        }))
      ),
    });

    logInfo(
      'CodeAnalysis',
      `[CodeAnalysis] Precompute complete: ${result.success}/${result.total} success`
    );

    if (result.memory_ids) {
      for (const [filePath, memoryId] of Object.entries(result.memory_ids)) {
        if (memoryId) {
          const batchItem = batchToSend.find(b => b.filePath === filePath);
          if (batchItem) {
            try {
              await this.memoryIdCache.set(filePath, batchItem.sourceId, memoryId, {
                contentHash: batchItem.contentHash,
              });
            } catch (_cacheError) {
              logWarn(
                'CodeAnalysis',
                `[CodeAnalysis] Failed to update fingerprint cache: ${_cacheError.message}`
              );
            }
          }
        }
      }
    }

    if (this.fingerprintCache) {
      try {
        for (const item of batchToSend) {
          this.fingerprintCache.set(item.filePath, {
            content_hash: item.contentHash,
            symbols_hash: this.fingerprintCache.getSymbolsHash(
              item.memoryItem.metadata?.code_analysis
            ),
          });
        }
      } catch (error) {
        logWarn('CodeAnalysis', `[CodeAnalysis] Failed to update fingerprints: ${error.message}`);
      }
    }
  }

  // ===== BL-CA-45: Atom/Entity Upload from Oxc Analysis Result =====

  async uploadAsAtomEntity(item, analysisResult, content) {
    const startTime = performance.now();
    const projectId = await resolveProjectId({ projectRoot: item.projectRoot });
    const language = analysisResult.language || this.detectLanguage(item.filePath);

    logInfo('CodeAnalysis', `[CodeAnalysis] Uploading via Atom/Entity API: ${item.relativePath}`);

    const result = await this._createAtomsEntityReferences(
      item.relativePath,
      analysisResult,
      projectId,
      language,
      content
    );

    if (this.fingerprintCache) {
      try {
        const contentHash = createHash('md5').update(content).digest('hex');
        this.fingerprintCache.set(item.filePath, {
          content_hash: contentHash,
          symbols_hash: this.fingerprintCache.getSymbolsHash(analysisResult),
        });
      } catch (fpError) {
        logWarn(
          'CodeAnalysis',
          `[CodeAnalysis] Fingerprint cache update failed for ${item.relativePath}, skipping: ${fpError.message}`
        );
      }
    }

    const duration = performance.now() - startTime;
    logInfo(
      'CodeAnalysis',
      `[CodeAnalysis] Atom/Entity upload complete: ${result.atoms.length} atoms, ${result.references.length} references in ${duration.toFixed(2)}ms`
    );

    if (result.entity?.id && isAutoLinkToConversation()) {
      await this._linkToConversationMemory(
        result.entity.id,
        item.relativePath,
        analysisResult
      );
    }

    return { ...result, duration };
  }

  // ===== BL-CA-41: Atom/Entity/Reference API Implementation (standalone) =====

  async _createAtomsEntityReferences(relativePath, analysisResult, projectId, language, _content) {
    const functionPromises = (analysisResult.functions || []).map(func =>
      this.client.createAtom({
        type: 'function',
        name: func.name,
        content:
          func.signature || `${func.name}(${(func.params || []).map(p => p.name).join(', ')})`,
        signature: func.signature,
        params: func.params,
        return_type: func.return_type,
        is_exported: func.is_exported,
        is_async: func.is_async,
        complexity: func.complexity,
        max_nesting_depth: func.max_nesting_depth,
        docstring: func.jsdoc?.text,
        start_line: func.start_line ?? func.line,
        end_line: func.end_line,
        project: projectId,
        tenant_id: this.client.tenantId,
      })
    );

    const classPromises = (analysisResult.classes || []).map(cls =>
      this.client.createAtom({
        type: 'class',
        name: cls.name,
        content: `class ${cls.name}`,
        start_line: cls.start_line ?? cls.line,
        end_line: cls.end_line,
        project: projectId,
        tenant_id: this.client.tenantId,
      })
    );

    const importPromises = (analysisResult.imports || []).map(imp =>
      this.client.createAtom({
        type: 'import',
        name: imp.source,
        content: `import ${imp.source}`,
        start_line: imp.line,
        project: projectId,
        tenant_id: this.client.tenantId,
      })
    );

    const allPromises = [...functionPromises, ...classPromises, ...importPromises];
    const allResults = await Promise.allSettled(allPromises);

    const createdAtoms = [];
    const atomIds = [];
    let failedCount = 0;

    for (const result of allResults) {
      if (result.status === 'fulfilled' && result.value?.id) {
        createdAtoms.push(result.value);
        atomIds.push(result.value.id);
      } else {
        failedCount++;
      }
    }

    if (failedCount > 0) {
      logWarn('CodeAnalysis', `[CodeAnalysis] Failed to create ${failedCount} atoms for ${relativePath}`);
    }

    let entity = null;
    if (atomIds.length > 0) {
      try {
        entity = await this.client.createEntity({
          type: 'code',
          abstract: this.generateAbstract(relativePath, analysisResult),
          overview: this.generateOverview(relativePath, analysisResult),
          atoms: atomIds,
          tags: [language, 'code-analysis'],
          project: projectId,
          file_path: relativePath,
          language,
          quality_score: analysisResult.quality_score?.score,
          complexity_metrics: analysisResult.complexity_metrics,
          tenant_id: this.client.tenantId,
        });
        logInfo('CodeAnalysis', `[CodeAnalysis] Created entity: ${entity.id} (${relativePath})`);
      } catch (error) {
        logError(
          'CodeAnalysis',
          `[CodeAnalysis] Failed to create entity for ${relativePath}:`,
          error
        );
        await this.rollbackAtoms(createdAtoms);
        throw error;
      }
    }

    const createdReferences = [];
    const refPayloads = (analysisResult.calls || [])
      .filter((call) => {
        const targetAtom = createdAtoms.find((a) => a.name === call.target);
        return targetAtom && entity;
      })
      .map((call) => ({
        from_id: entity.id,
        to_id: createdAtoms.find((a) => a.name === call.target).id,
        type: 'calls',
        weight: 0.5,
        line: call.line,
        column: call.column,
        file_path: call.file_path,
        tenant_id: this.client.tenantId,
      }));

    if (refPayloads.length > 0) {
      try {
        const refResult = await this.client.createReferences(refPayloads);
        createdReferences.push(...((refResult?.references) || []));
      } catch (error) {
        logError(
          'CodeAnalysis',
          `[CodeAnalysis] Failed to create batch references for ${relativePath}:`,
          error
        );
      }
    }

    if (createdReferences.length === 0 && refPayloads.length > 0) {
      logWarn(
        'CodeAnalysis',
        `[CodeAnalysis] Failed to create ${refPayloads.length} references for ${relativePath}`
      );
    }

    if (createdReferences.length === 0 && createdAtoms.some((a) => a.type === 'function')) {
      logWarn(
        'CodeAnalysis',
        `[CodeAnalysis] No references created for ${relativePath}, but functions exist - possible API issue`
      );
    }

    return { atoms: createdAtoms, entity, references: createdReferences };
  }

  /**
   * Link a code analysis Entity to related conversation memories.
   * Searches for recent conversations mentioning the analyzed file or its symbols,
   * then creates an "analyzes" relation (conversation → code entity).
   *
   * Fire-and-forget: errors are logged but never propagated to the caller.
   *
   * @param {string} entityId - The code analysis Entity ID
   * @param {string} relativePath - Relative file path (used as search keyword)
   * @param {Object} analysisResult - Code analysis result with functions/classes
   */
  async _linkToConversationMemory(entityId, relativePath, analysisResult) {
    try {
      if (!entityId) {
        return;
      }

      const symbolNames = [
        ...(analysisResult.functions || []).slice(0, 3).map(f => f.name),
        ...(analysisResult.classes || []).slice(0, 2).map(c => c.name),
      ].filter(Boolean);

      const query = symbolNames.length > 0
        ? `${basename(relativePath)} ${symbolNames.join(' ')}`
        : basename(relativePath);

      logInfo(
        'CodeAnalysis',
        `[CodeAnalysis] Searching for related conversations: "${query}"`
      );

      const searchResult = await this.client.search({
        query,
        mode: 'keyword',
        limit: 5,
        level: 0,
        tenant_id: this.client.tenantId,
      });

      const results = searchResult?.results || [];
      if (results.length === 0) {
        logInfo(
          'CodeAnalysis',
          `[CodeAnalysis] No related conversations found for: ${relativePath}`
        );
        return;
      }

      const conversations = results.filter(r => r.type !== 'code');
      if (conversations.length === 0) {
        logInfo(
          'CodeAnalysis',
          `[CodeAnalysis] Only code entries found, skipping conversation link for: ${relativePath}`
        );
        return;
      }

      const bestMatch = conversations[0];
      const conversationId = bestMatch.local_id || bestMatch.id;

      await this.client.createRelation({
        from_id: conversationId,
        to_id: entityId,
        type: 'analyzes',
        weight: 0.7,
        description: `Conversation references code in ${relativePath}`,
        tenant_id: this.client.tenantId,
      });

      logInfo(
        'CodeAnalysis',
        `[CodeAnalysis] Linked conversation ${conversationId} → entity ${entityId} (analyzes: ${relativePath})`
      );
    } catch (error) {
      logWarn(
        'CodeAnalysis',
        `[CodeAnalysis] Failed to link ${relativePath} to conversation memory: ${error.message}`
      );
    }
  }

  async analyzeWithAtomEntity(filePath, content, projectRoot) {
    const startTime = performance.now();
    const relativePath = relative(projectRoot, filePath);
    const projectId = await resolveProjectId({ projectRoot });
    const language = this.detectLanguage(filePath);

    logInfo('CodeAnalysis', `[CodeAnalysis] Analyzing with Atom/Entity API: ${relativePath}`);

    try {
      const analysisResult = await analyzeWithQuery(filePath, content, language);
      const result = await this._createAtomsEntityReferences(
        relativePath,
        analysisResult,
        projectId,
        language,
        content
      );

      const duration = performance.now() - startTime;
      logInfo(
        'CodeAnalysis',
        `[CodeAnalysis] Analysis complete: ${result.atoms.length} atoms, ${result.references.length} references in ${duration.toFixed(2)}ms`
      );

      return { ...result, duration };
    } catch (error) {
      logError('CodeAnalysis', `[CodeAnalysis] Analysis failed for ${relativePath}:`, error);
      throw error;
    }
  }

  /**
   * 回滚已创建的 Atoms
   * @param {Array} atoms - 已创建的 Atom 列表
   */
  async rollbackAtoms(atoms) {
    logInfo('CodeAnalysis', `[CodeAnalysis] Rolling back ${atoms.length} atoms...`);
    for (const atom of atoms) {
      try {
        await this.client.deleteAtom(atom.id);
        logInfo('CodeAnalysis', `[CodeAnalysis] Rolled back atom: ${atom.id}`);
      } catch (error) {
        logError('CodeAnalysis', `[CodeAnalysis] Failed to rollback atom ${atom.id}:`, error);
      }
    }
  }

  /**
   * 检测文件语言
   * @param {string} filePath - 文件路径
   * @returns {string} 语言名称
   */
  detectLanguage(filePath) {
    const ext = extname(filePath).toLowerCase();
    const languageMap = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.mts': 'typescript',
      '.cts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
    };
    return languageMap[ext] || 'unknown';
  }

  async flushBatchLegacy(batchToSend) {
    const memoryItems = batchToSend.map(item => item.memoryItem);
    logInfo(
      'CodeAnalysis',
      `[CodeAnalysis] Uploading ${memoryItems.length} code memories (legacy)...`
    );

    try {
      const result = await this.client.uploadMemories(memoryItems);
      logInfo(
        'CodeAnalysis',
        `[CodeAnalysis] Upload complete: ${result.success}/${result.total} success`
      );

      if (result.memory_ids && result.memory_ids.length > 0) {
        for (let i = 0; i < result.memory_ids.length; i++) {
          const memoryId = result.memory_ids[i];
          const batchItem = batchToSend[i];
          if (batchItem && memoryId) {
            try {
              await this.memoryIdCache.set(batchItem.filePath, batchItem.sourceId, memoryId, {
                contentHash: batchItem.contentHash,
              });
              logInfo(
                'CodeAnalysis',
                `[CodeAnalysis] Cached memory_id for ${batchItem.filePath}: ${memoryId}`
              );
            } catch (_cacheError) {
              logWarn(
                'CodeAnalysis',
                `[CodeAnalysis] Failed to update memory ID cache: ${_cacheError.message}`
              );
            }
          }
        }
      }
    } catch (error) {
      logError(
        'CodeAnalysis',
        `[CodeAnalysis] Legacy batch upload failed: ${error.message}`,
        error
      );
      throw error;
    }
  }

  async getMemoryId(filePath) {
    await this.initCache();
    return this.memoryIdCache.getMemoryId(filePath);
  }

  async uploadProject(projectRoot, _options = {}) {
    const startTime = performance.now();
    const projectId = await resolveProjectId({ projectRoot });
    const tenantId = this.client.tenantId;

    const SUPPORTED = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.tsx']);
    const SKIP = new Set([
      'node_modules',
      '.git',
      'tests',
      'memory',
      'docs',
      'scripts',
      'agents',
      'cli',
      'bin',
    ]);

    function walkDir(dir, files = []) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (SKIP.has(entry.name)) continue;
        if (entry.isDirectory()) walkDir(full, files);
        else if (SUPPORTED.has(path.extname(entry.name))) files.push(full);
      }
      return files;
    }

    const files = walkDir(projectRoot);
    logInfo(
      'CodeAnalysis',
      '[CodeAnalysis] uploadProject: ' + files.length + ' files in ' + projectRoot
    );

    const globalNameToAtomId = new Map();
    const relPathToEntityId = new Map();
    const allResults = [];

    for (const filePath of files) {
      try {
        const source = await readFile(filePath, 'utf-8');
        if (source.split('\n').length > 1000) continue;

        const result = await codeAnalyzer.analyze(filePath, source);
        const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        const atomIds = [];

        for (const func of result.functions || []) {
          const atom = await this.client.createAtom({
            type: 'function',
            name: func.name,
            content: `${func.name}(${(func.params || []).map(p => p.name || p).join(', ')})`,
            params: func.params,
            return_type: func.return_type,
            is_exported: func.is_exported,
            is_async: func.is_async,
            start_line: func.start_line,
            end_line: func.end_line,
            project: projectId,
            tenant_id: tenantId,
          });
          atomIds.push(atom.id);
          globalNameToAtomId.set(func.name, atom.id);
        }

        for (const cls of result.classes || []) {
          const atom = await this.client.createAtom({
            type: 'class',
            name: cls.name,
            content: 'class ' + cls.name,
            start_line: cls.start_line,
            end_line: cls.end_line,
            project: projectId,
            tenant_id: tenantId,
          });
          atomIds.push(atom.id);
          globalNameToAtomId.set(cls.name, atom.id);
        }

        if (atomIds.length > 0) {
          const entity = await this.client.createEntity({
            type: 'code',
            abstract:
              relPath +
              ': ' +
              (result.functions || []).length +
              ' fns, ' +
              (result.classes || []).length +
              ' cls',
            file_path: relPath,
            atoms: atomIds,
            language: result.language,
            project: projectId,
            tenant_id: tenantId,
          });
          relPathToEntityId.set(relPath, entity.id);
        }

        allResults.push({ relPath, result });
        logInfo('CodeAnalysis', '  OK: ' + relPath + ' -> ' + atomIds.length + ' atoms');
      } catch (e) {
        logError(
          'CodeAnalysis',
          '  FAIL: ' + path.relative(projectRoot, filePath) + ': ' + e.message,
          e
        );
      }
    }

    let refCount = 0;
    for (const { relPath, result } of allResults) {
      const fromId = relPathToEntityId.get(relPath);
      if (!fromId) continue;

      for (const call of result.calls || []) {
        let targetId = globalNameToAtomId.get(call.target);
        if (!targetId && call.target.includes('.')) {
          targetId = globalNameToAtomId.get(call.target.split('.').pop());
        }
        if (!targetId) continue;
        try {
          await this.client.createReference({
            from_id: fromId,
            to_id: targetId,
            type: 'calls',
            weight: 0.5,
            metadata: { line: call.line, column: call.column, file_path: relPath },
            tenant_id: tenantId,
          });
          refCount++;
        } catch (_error) {
          logWarn('CodeAnalysis', `[CodeAnalysis] Failed to create reference: ${_error.message}`);
        }
      }
    }

    const duration = performance.now() - startTime;
    logInfo(
      'CodeAnalysis',
      `uploadProject complete: ${allResults.length} files, ${globalNameToAtomId.size} atoms, ${refCount} references in ${duration.toFixed(2)}ms`
    );

    return {
      files: allResults.length,
      atoms: globalNameToAtomId.size,
      references: refCount,
      duration,
    };
  }

  async getSourceId(filePath) {
    await this.initCache();
    return this.memoryIdCache.getSourceId(filePath);
  }

  getMemoryIdCache() {
    return this.memoryIdCache;
  }
}

const analysisQueue = new AnalysisQueue();

export function onFileSaved(filePath, projectRoot) {
  logInfo('CodeAnalysis', `[CodeAnalysis] File saved: ${filePath}`);
  analysisQueue.add(filePath, projectRoot);
}

export function flushPendingUploads() {
  return analysisQueue.flushBatch();
}

export function uploadProject(projectRoot, options = {}) {
  return analysisQueue.uploadProject(projectRoot, options);
}
