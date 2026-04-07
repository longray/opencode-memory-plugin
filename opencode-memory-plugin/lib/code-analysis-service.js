import { codeAnalyzer } from './code-analyzer.js';
import { WrapperClient } from './wrapper-client.js';
import { resolveProjectId } from './project-resolver.js';
import { shouldSkipFile } from './privacy-filter.js';
import { getConfig } from './storage.js';
import { readFileSync } from 'fs';
import { extname, relative, basename } from 'path';

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

export class AnalysisQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.batch = [];
    this.batchTimer = null;
    this.debounceTimer = null;
    this.wrapperClient = new WrapperClient();
    this.concurrentCount = 0;
    this.memoryIdCache = new Map(); // file_path -> memory_id
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
      const content = readFileSync(item.filePath, 'utf-8');

      const contentCheck = shouldSkipFile(item.filePath, content);
      if (contentCheck.skip) {
        console.log(`[CodeAnalysis] Skipping file with sensitive content: ${item.relativePath}`);
        return;
      }

      const result = await codeAnalyzer.analyze(item.filePath, content);

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

    const memoryItem = {
      type: 'code',
      content: content,
      abstract: this.generateAbstract(item.relativePath, analysisResult),
      overview: this.generateOverview(item.relativePath, analysisResult),
      tags: [analysisResult.language, 'code-analysis'],
      project_id: projectId,
      metadata: {
        file_path: item.relativePath,
        file_name: basename(item.filePath),
        code_analysis: analysisResult,
      },
    };

    this.batch.push(memoryItem);

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
      console.log(`[CodeAnalysis] Uploading ${batchToSend.length} code memories...`);
      const result = await this.wrapperClient.uploadMemories(batchToSend);
      console.log(`[CodeAnalysis] Upload complete: ${result.success}/${result.total} success`);

      // 保存返回的 memory_id 到缓存
      if (result.memory_ids && result.memory_ids.length > 0) {
        for (let i = 0; i < result.memory_ids.length; i++) {
          const memoryId = result.memory_ids[i];
          const filePath = batchToSend[i]?.metadata?.file_path;
          if (filePath && memoryId) {
            this.memoryIdCache.set(filePath, memoryId);
            console.log(`[CodeAnalysis] Cached memory_id for ${filePath}: ${memoryId}`);
          }
        }
      }
    } catch (error) {
      console.error('[CodeAnalysis] Upload failed:', error.message);
    }
  }

  getMemoryId(filePath) {
    return this.memoryIdCache.get(filePath);
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
