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
import {
  QUEUE_TIMEOUT_MS as DEFAULT_QUEUE_TIMEOUT_MS,
  QUEUE_POLL_DELAY_MS,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_BATCH_DELAY_MS,
} from './constants.js';

function readCodeAnalysisConfig() {
  return getConfig().code_analysis || {};
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

const _cfg = readCodeAnalysisConfig();
const DEBOUNCE_MS = _cfg.debounce_ms || DEFAULT_DEBOUNCE_MS;
const BATCH_DELAY_MS = _cfg.batch_delay_ms || DEFAULT_BATCH_DELAY_MS;
const BATCH_MAX_SIZE = _cfg.batch_max_size || 10;
const MAX_CONCURRENT = _cfg.max_concurrent || 2;
const QUEUE_TIMEOUT_MS = _cfg.queue_timeout_ms || DEFAULT_QUEUE_TIMEOUT_MS;
const MAX_QUEUE_SIZE = _cfg.queue_max_size || 10;

// BL-CA-41: Enable new Atom/Entity/Reference API
const _USE_ATOM_ENTITY_API = _cfg.use_atom_entity_api !== false;

export class AnalysisQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.batch = [];
    this.batchTimer = null;
    this.debounceTimer = null;
    this.wrapperClient = getWrapperClient(getConfig());
    this.precomputeClient = getPrecomputeClient();
    this.concurrentCount = 0;
    this.memoryIdCache = null;
    this.fingerprintCache = null;
    this.usePrecompute = readCodeAnalysisConfig().use_precompute !== false;
  }

  async initCache() {
    try {
      if (!this.memoryIdCache) {
        const projectId = await resolveProjectId({});
        this.memoryIdCache = new MemoryIdCache(projectId);
        await this.memoryIdCache.load();
      }
    } catch (error) {
      console.warn(
        `[CodeAnalysis] MemoryIdCache init failed, continuing without cache: ${error.message}`
      );
    }

    try {
      if (!this.fingerprintCache && this.usePrecompute) {
        const projectRoot = process.cwd();
        this.fingerprintCache = new FingerprintCache(projectRoot);
      }
    } catch (error) {
      console.warn(
        `[CodeAnalysis] FingerprintCache init failed, continuing without fingerprinting: ${error.message}`
      );
    }
  }

  async add(filePath, projectRoot) {
    try {
      const relativePath = relative(projectRoot, filePath);

      const skipCheck = shouldSkipFile(filePath);
      if (skipCheck.skip) {
        console.log(`[CodeAnalysis] Skipping file: ${relativePath} (${skipCheck.reason})`);
        return;
      }

      const ext = extname(filePath).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        console.log(`[CodeAnalysis] Skipping unsupported file type: ${relativePath}`);
        return;
      }

      if (this.queue.length >= MAX_QUEUE_SIZE) {
        const removed = this.queue.shift();
        console.warn(
          `[CodeAnalysis] Queue full (${MAX_QUEUE_SIZE}), dropped oldest: ${removed.relativePath}`
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
      console.error(`[CodeAnalysis] Failed to queue file ${filePath}: ${error.message}`);
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
        console.error(`[CodeAnalysis] Queue processing trigger failed: ${error.message}`);
      }
    }, DEBOUNCE_MS);
  }

  async processQueue() {
    if (this.queue.length === 0) return;

    try {
      const now = Date.now();
      const validItems = this.queue.filter(item => now - item.timestamp < QUEUE_TIMEOUT_MS);
      const expiredCount = this.queue.length - validItems.length;
      if (expiredCount > 0) {
        console.log(`[CodeAnalysis] Dropped ${expiredCount} expired items from queue`);
      }
      this.queue = validItems;

      if (this.queue.length === 0) return;

      const availableSlots = MAX_CONCURRENT - this.concurrentCount;
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
      console.error(`[CodeAnalysis] Queue processing failed: ${error.message}`);
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
          console.log(`[CodeAnalysis] File not found (deleted?): ${item.relativePath}`);
          return;
        }
        throw new Error(`Failed to read file ${item.relativePath}: ${error.message}`);
      }

      const contentCheck = shouldSkipFile(item.filePath, content);
      if (contentCheck.skip) {
        console.log(`[CodeAnalysis] Skipping file with sensitive content: ${item.relativePath}`);
        return;
      }

      if (this.usePrecompute && this.fingerprintCache) {
        const fpCheck = this.fingerprintCache.hasChanged(item.relativePath, content, null);
        if (!fpCheck.changed) {
          console.log(`[CodeAnalysis] File unchanged (fingerprint): ${item.relativePath}`);
          return;
        }
      }

      const result = await codeAnalyzer.analyze(item.filePath, content);

      if (this.usePrecompute && this.fingerprintCache) {
        const fpCheck = this.fingerprintCache.hasChanged(item.relativePath, content, result);
        if (!fpCheck.changed) {
          console.log(`[CodeAnalysis] File unchanged (symbols): ${item.relativePath}`);
          return;
        }
      }

      // BL-CA-45: Route to Atom/Entity API or legacy batch flow
      if (_USE_ATOM_ENTITY_API) {
        await this.uploadAsAtomEntity(item, result, content);
      } else {
        this.addToBatch(item, result, content);
      }
    } catch (error) {
      console.error(`[CodeAnalysis] Error analyzing ${item.relativePath}:`, error.message);
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

    if (this.batch.length >= BATCH_MAX_SIZE) {
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
    }, BATCH_DELAY_MS);
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
        } catch (error) {
          console.warn(
            `[CodeAnalysis] Precompute upload failed, falling back to legacy: ${error.message}`
          );
          await this.flushBatchLegacy(batchToSend);
        }
      } else {
        await this.flushBatchLegacy(batchToSend);
      }
    } catch (error) {
      console.error('[CodeAnalysis] All upload strategies failed:', error.message);
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

    console.log(`[CodeAnalysis] Uploading ${analysisResults.length} files via Precompute API...`);
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

    console.log(`[CodeAnalysis] Precompute complete: ${result.success}/${result.total} success`);

    if (result.memory_ids) {
      for (const [filePath, memoryId] of Object.entries(result.memory_ids)) {
        if (memoryId) {
          const batchItem = batchToSend.find(b => b.filePath === filePath);
          if (batchItem) {
            try {
              await this.memoryIdCache.set(filePath, batchItem.sourceId, memoryId, {
                contentHash: batchItem.contentHash,
              });
            } catch (cacheError) {
              console.warn(
                `[CodeAnalysis] Failed to cache memory_id for ${filePath}: ${cacheError.message}`
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
        console.warn(`[CodeAnalysis] Failed to update fingerprints: ${error.message}`);
      }
    }
  }

  // ===== BL-CA-45: Atom/Entity Upload from Oxc Analysis Result =====

  async uploadAsAtomEntity(item, analysisResult, content) {
    const startTime = performance.now();
    const projectId = await resolveProjectId({ projectRoot: item.projectRoot });
    const language = analysisResult.language || this.detectLanguage(item.filePath);

    console.log(`[CodeAnalysis] Uploading via Atom/Entity API: ${item.relativePath}`);

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
        console.warn(
          `[CodeAnalysis] Failed to update fingerprint for ${item.relativePath}: ${fpError.message}`
        );
      }
    }

    const duration = performance.now() - startTime;
    console.log(
      `[CodeAnalysis] Atom/Entity upload complete: ${result.atoms.length} atoms, ${result.references.length} references in ${duration.toFixed(2)}ms`
    );

    return { ...result, duration };
  }

  // ===== BL-CA-41: Atom/Entity/Reference API Implementation (standalone) =====

  async _createAtomsEntityReferences(relativePath, analysisResult, projectId, language, _content) {
    const createdAtoms = [];
    const atomIds = [];

    for (const func of analysisResult.functions || []) {
      try {
        const atom = await this.wrapperClient.createAtom({
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
          tenant_id: this.wrapperClient.tenantId,
        });
        createdAtoms.push(atom);
        atomIds.push(atom.id);
      } catch (error) {
        console.error(
          `[CodeAnalysis] Failed to create atom for function ${func.name}:`,
          error.message
        );
      }
    }

    for (const cls of analysisResult.classes || []) {
      try {
        const atom = await this.wrapperClient.createAtom({
          type: 'class',
          name: cls.name,
          content: `class ${cls.name}`,
          start_line: cls.start_line ?? cls.line,
          end_line: cls.end_line,
          project: projectId,
          tenant_id: this.wrapperClient.tenantId,
        });
        createdAtoms.push(atom);
        atomIds.push(atom.id);
      } catch (error) {
        console.error(`[CodeAnalysis] Failed to create atom for class ${cls.name}:`, error.message);
      }
    }

    for (const imp of analysisResult.imports || []) {
      try {
        const atom = await this.wrapperClient.createAtom({
          type: 'import',
          name: imp.source,
          content: `import ${imp.source}`,
          start_line: imp.line,
          project: projectId,
          tenant_id: this.wrapperClient.tenantId,
        });
        createdAtoms.push(atom);
        atomIds.push(atom.id);
      } catch (error) {
        console.error(
          `[CodeAnalysis] Failed to create atom for import ${imp.source}:`,
          error.message
        );
      }
    }

    let entity = null;
    if (atomIds.length > 0) {
      try {
        entity = await this.wrapperClient.createEntity({
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
          tenant_id: this.wrapperClient.tenantId,
        });
        console.log(`[CodeAnalysis] Created entity: ${entity.id} (${relativePath})`);
      } catch (error) {
        console.error(`[CodeAnalysis] Failed to create entity for ${relativePath}:`, error.message);
        await this.rollbackAtoms(createdAtoms);
        throw error;
      }
    }

    const createdReferences = [];
    let refFailures = 0;
    for (const call of analysisResult.calls || []) {
      try {
        const targetAtom = createdAtoms.find(a => a.name === call.target);
        if (targetAtom && entity) {
          const reference = await this.wrapperClient.createReference({
            from_id: entity.id,
            to_id: targetAtom.id,
            type: 'calls',
            weight: 0.5,
            line: call.line,
            column: call.column,
            file_path: call.file_path,
            tenant_id: this.wrapperClient.tenantId,
          });
          createdReferences.push(reference);
        }
      } catch (error) {
        refFailures++;
        console.error(
          `[CodeAnalysis] Failed to create reference for call ${call.target}:`,
          error.message
        );
      }
    }

    if (refFailures > 0) {
      console.warn(
        `[CodeAnalysis] ${refFailures}/${(analysisResult.calls || []).length} references failed`
      );
    }

    if (createdReferences.length === 0 && createdAtoms.some(a => a.type === 'function')) {
      console.warn(
        `[CodeAnalysis] INCOMPLETE: ${relativePath} has functions but 0 references. Call relations may be missing.`
      );
    }

    return { atoms: createdAtoms, entity, references: createdReferences };
  }

  async analyzeWithAtomEntity(filePath, content, projectRoot) {
    const startTime = performance.now();
    const relativePath = relative(projectRoot, filePath);
    const projectId = await resolveProjectId({ projectRoot });
    const language = this.detectLanguage(filePath);

    console.log(`[CodeAnalysis] Analyzing with Atom/Entity API: ${relativePath}`);

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
      console.log(
        `[CodeAnalysis] Analysis complete: ${result.atoms.length} atoms, ${result.references.length} references in ${duration.toFixed(2)}ms`
      );

      return { ...result, duration };
    } catch (error) {
      console.error(`[CodeAnalysis] Analysis failed for ${relativePath}:`, error.message);
      throw error;
    }
  }

  /**
   * 回滚已创建的 Atoms
   * @param {Array} atoms - 已创建的 Atom 列表
   */
  async rollbackAtoms(atoms) {
    console.log(`[CodeAnalysis] Rolling back ${atoms.length} atoms...`);
    for (const atom of atoms) {
      try {
        await this.wrapperClient.deleteAtom(atom.id);
        console.log(`[CodeAnalysis] Rolled back atom: ${atom.id}`);
      } catch (error) {
        console.error(`[CodeAnalysis] Failed to rollback atom ${atom.id}:`, error.message);
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
    console.log(`[CodeAnalysis] Uploading ${memoryItems.length} code memories (legacy)...`);

    try {
      const result = await this.wrapperClient.uploadMemories(memoryItems);
      console.log(`[CodeAnalysis] Upload complete: ${result.success}/${result.total} success`);

      if (result.memory_ids && result.memory_ids.length > 0) {
        for (let i = 0; i < result.memory_ids.length; i++) {
          const memoryId = result.memory_ids[i];
          const batchItem = batchToSend[i];
          if (batchItem && memoryId) {
            try {
              await this.memoryIdCache.set(batchItem.filePath, batchItem.sourceId, memoryId, {
                contentHash: batchItem.contentHash,
              });
              console.log(`[CodeAnalysis] Cached memory_id for ${batchItem.filePath}: ${memoryId}`);
            } catch (cacheError) {
              console.warn(
                `[CodeAnalysis] Failed to cache memory_id for ${batchItem.filePath}: ${cacheError.message}`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(`[CodeAnalysis] Legacy batch upload failed: ${error.message}`);
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
    const tenantId = this.wrapperClient.tenantId;

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
    console.log('[CodeAnalysis] uploadProject: ' + files.length + ' files in ' + projectRoot);

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
          const atom = await this.wrapperClient.createAtom({
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
          const atom = await this.wrapperClient.createAtom({
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
          const entity = await this.wrapperClient.createEntity({
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
        console.log('  OK: ' + relPath + ' -> ' + atomIds.length + ' atoms');
      } catch (e) {
        console.error('  FAIL: ' + path.relative(projectRoot, filePath) + ': ' + e.message);
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
          await this.wrapperClient.createReference({
            from_id: fromId,
            to_id: targetId,
            type: 'calls',
            weight: 0.5,
            metadata: { line: call.line, column: call.column, file_path: relPath },
            tenant_id: tenantId,
          });
          refCount++;
        } catch (error) {
          console.warn(
            `[CodeAnalysis] Failed to create reference for ${call.funcName} (${relPath}:${call.line}):`,
            error.message
          );
        }
      }
    }

    const duration = performance.now() - startTime;
    console.log(
      '[CodeAnalysis] uploadProject complete: ' +
        allResults.length +
        ' files, ' +
        globalNameToAtomId.size +
        ' atoms, ' +
        refCount +
        ' references in ' +
        duration.toFixed(2) +
        'ms'
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
  console.log(`[CodeAnalysis] File saved: ${filePath}`);
  analysisQueue.add(filePath, projectRoot);
}

export function flushPendingUploads() {
  return analysisQueue.flushBatch();
}

export function uploadProject(projectRoot, options = {}) {
  return analysisQueue.uploadProject(projectRoot, options);
}
