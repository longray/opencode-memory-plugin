import { codeAnalyzer } from './code-analyzer.js';
import { WrapperClient } from './wrapper-client.js';
import { getPrecomputeClient } from './precompute/client.js';
import { FingerprintCache } from './precompute/fingerprint-cache.js';
import { resolveProjectId } from './project-resolver.js';
import { shouldSkipFile } from './privacy-filter.js';
import { getConfig } from './storage.js';
import { MemoryIdCache } from './memory-id-cache.js';
import { readFileSync } from 'fs';
import { extname, relative, basename } from 'path';
import { createHash } from 'crypto';
import { analyzeWithQuery } from './tree-sitter-parser.js';

const userConfig = getConfig();
const CODE_ANALYSIS_CONFIG = userConfig.code_analysis || {};

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

const DEBOUNCE_MS = CODE_ANALYSIS_CONFIG.debounce_ms || 300;
const BATCH_DELAY_MS = CODE_ANALYSIS_CONFIG.batch_delay_ms || 2000;
const BATCH_MAX_SIZE = CODE_ANALYSIS_CONFIG.batch_max_size || 10;
const MAX_CONCURRENT = CODE_ANALYSIS_CONFIG.max_concurrent || 2;
const QUEUE_TIMEOUT_MS = CODE_ANALYSIS_CONFIG.queue_timeout_ms || 5000;
const MAX_QUEUE_SIZE = CODE_ANALYSIS_CONFIG.max_queue_size || 10;

// BL-CA-41: Enable new Atom/Entity/Reference API
const _USE_ATOM_ENTITY_API = CODE_ANALYSIS_CONFIG.use_atom_entity_api !== false;

export class AnalysisQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.batch = [];
    this.batchTimer = null;
    this.debounceTimer = null;
    this.wrapperClient = new WrapperClient();
    this.precomputeClient = getPrecomputeClient();
    this.concurrentCount = 0;
    this.memoryIdCache = null;
    this.fingerprintCache = null;
    this.usePrecompute = CODE_ANALYSIS_CONFIG.use_precompute !== false;
  }

  async initCache() {
    if (!this.memoryIdCache) {
      const projectId = resolveProjectId({});
      this.memoryIdCache = new MemoryIdCache(projectId);
      await this.memoryIdCache.load();
    }
    if (!this.fingerprintCache && this.usePrecompute) {
      const projectRoot = process.cwd();
      this.fingerprintCache = new FingerprintCache(projectRoot);
    }
  }

  async add(filePath, projectRoot) {
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
      console.log(`[CodeAnalysis] Queue full, dropping oldest: ${removed.relativePath}`);
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
  }

  debouncedProcess() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, DEBOUNCE_MS);
  }

  async processQueue() {
    if (this.queue.length === 0) return;

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
      setTimeout(() => this.processQueue(), 100);
      return;
    }

    const itemsToProcess = this.queue.splice(0, availableSlots);

    for (const item of itemsToProcess) {
      this.processItem(item);
    }

    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  async processItem(item) {
    if (this.processing.has(item.filePath)) return;

    this.processing.add(item.filePath);
    this.concurrentCount++;

    try {
      await this.initCache();

      const content = readFileSync(item.filePath, 'utf-8');

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

      this.addToBatch(item, result, content);
    } catch (error) {
      console.error(`[CodeAnalysis] Error analyzing ${item.relativePath}:`, error.message);
    } finally {
      this.processing.delete(item.filePath);
      this.concurrentCount--;
    }
  }

  addToBatch(item, analysisResult, content) {
    const projectId = resolveProjectId({ projectRoot: item.projectRoot });

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
        await this.flushBatchPrecompute(batchToSend);
      } else {
        await this.flushBatchLegacy(batchToSend);
      }
    } catch (error) {
      console.error('[CodeAnalysis] Upload failed:', error.message);
    }
  }

  async flushBatchPrecompute(batchToSend) {
    const projectId = resolveProjectId({});

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
            await this.memoryIdCache.set(filePath, batchItem.sourceId, memoryId, {
              contentHash: batchItem.contentHash,
            });
          }
        }
      }
    }

    if (this.fingerprintCache) {
      for (const item of batchToSend) {
        this.fingerprintCache.set(item.filePath, {
          content_hash: item.contentHash,
          symbols_hash: this.fingerprintCache.getSymbolsHash(
            item.memoryItem.metadata?.code_analysis
          ),
        });
      }
    }
  }

  // ===== BL-CA-41: Atom/Entity/Reference API Implementation =====

  /**
   * 使用新的 Atom/Entity/Reference API 分析文件
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @param {string} projectRoot - 项目根目录
   */
  async analyzeWithAtomEntity(filePath, content, projectRoot) {
    const startTime = performance.now();
    const relativePath = relative(projectRoot, filePath);
    const projectId = resolveProjectId({ projectRoot });
    const language = this.detectLanguage(filePath);

    console.log(`[CodeAnalysis] Analyzing with Atom/Entity API: ${relativePath}`);

    try {
      // Step 1: 使用 Query API 分析代码
      const analysisResult = await analyzeWithQuery(filePath, content, language);

      // Step 2: 创建 Atoms（函数、类、导入）
      const createdAtoms = [];
      const atomIds = [];

      // 创建函数 Atoms
      for (const func of analysisResult.functions || []) {
        try {
          const atom = await this.wrapperClient.createAtom({
            type: 'function',
            name: func.name,
            content: `${func.name}(${func.params?.join(', ') || ''})`,
            signature: func.signature,
            params: func.params,
            return_type: func.return_type,
            is_exported: func.is_exported,
            is_async: func.is_async,
            complexity: func.complexity,
            max_nesting_depth: func.max_nesting_depth,
            docstring: func.docstring,
            start_line: func.line,
            end_line: func.end_line,
            project: projectId,
            tenant_id: this.wrapperClient.tenantId,
          });
          createdAtoms.push(atom);
          atomIds.push(atom.id);
          console.log(`[CodeAnalysis] Created atom: ${atom.id} (${func.name})`);
        } catch (error) {
          console.error(
            `[CodeAnalysis] Failed to create atom for function ${func.name}:`,
            error.message
          );
          // 继续处理其他函数
        }
      }

      // 创建类 Atoms
      for (const cls of analysisResult.classes || []) {
        try {
          const atom = await this.wrapperClient.createAtom({
            type: 'class',
            name: cls.name,
            content: `class ${cls.name}`,
            start_line: cls.line,
            project: projectId,
            tenant_id: this.wrapperClient.tenantId,
          });
          createdAtoms.push(atom);
          atomIds.push(atom.id);
          console.log(`[CodeAnalysis] Created atom: ${atom.id} (${cls.name})`);
        } catch (error) {
          console.error(
            `[CodeAnalysis] Failed to create atom for class ${cls.name}:`,
            error.message
          );
        }
      }

      // 创建导入 Atoms
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
          console.log(`[CodeAnalysis] Created atom: ${atom.id} (import ${imp.source})`);
        } catch (error) {
          console.error(
            `[CodeAnalysis] Failed to create atom for import ${imp.source}:`,
            error.message
          );
        }
      }

      // Step 3: 创建 Entity（代码文件）
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
            tenant_id: this.wrapperClient.tenantId,
          });
          console.log(`[CodeAnalysis] Created entity: ${entity.id} (${relativePath})`);
        } catch (error) {
          console.error(
            `[CodeAnalysis] Failed to create entity for ${relativePath}:`,
            error.message
          );
          // Entity 创建失败，清理已创建的 Atoms
          await this.rollbackAtoms(createdAtoms);
          throw error;
        }
      }

      // Step 4: 创建 References（调用关系）
      const createdReferences = [];
      for (const call of analysisResult.calls || []) {
        try {
          // 查找目标函数的 Atom ID
          const targetAtom = createdAtoms.find(a => a.name === call.target);
          if (targetAtom && entity) {
            const reference = await this.wrapperClient.createReference({
              from_id: entity.id,
              to_id: targetAtom.id,
              type: 'calls',
              weight: 0.5,
              metadata: {
                line: call.line,
                column: call.column,
                file_path: call.file_path,
              },
              tenant_id: this.wrapperClient.tenantId,
            });
            createdReferences.push(reference);
          }
        } catch (error) {
          console.error(
            `[CodeAnalysis] Failed to create reference for call ${call.target}:`,
            error.message
          );
        }
      }

      const duration = performance.now() - startTime;
      console.log(
        `[CodeAnalysis] Analysis complete: ${createdAtoms.length} atoms, ${createdReferences.length} references in ${duration.toFixed(2)}ms`
      );

      return {
        atoms: createdAtoms,
        entity,
        references: createdReferences,
        duration,
      };
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
    const result = await this.wrapperClient.uploadMemories(memoryItems);
    console.log(`[CodeAnalysis] Upload complete: ${result.success}/${result.total} success`);

    if (result.memory_ids && result.memory_ids.length > 0) {
      for (let i = 0; i < result.memory_ids.length; i++) {
        const memoryId = result.memory_ids[i];
        const batchItem = batchToSend[i];
        if (batchItem && memoryId) {
          await this.memoryIdCache.set(batchItem.filePath, batchItem.sourceId, memoryId, {
            contentHash: batchItem.contentHash,
          });
          console.log(`[CodeAnalysis] Cached memory_id for ${batchItem.filePath}: ${memoryId}`);
        }
      }
    }
  }

  async getMemoryId(filePath) {
    await this.initCache();
    return this.memoryIdCache.getMemoryId(filePath);
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
