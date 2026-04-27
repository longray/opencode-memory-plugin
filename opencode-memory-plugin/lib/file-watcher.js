import { watch } from 'chokidar';
import { onFileSaved } from './code-analysis-service.js';
import { shouldSkipFile } from './privacy-filter.js';
import { getConfig } from './storage.js';
import { DEFAULT_DEBOUNCE_MS } from './constants.js';
import { relative } from 'path';

const DEBOUNCE_MS = getConfig().code_analysis?.debounce_ms || DEFAULT_DEBOUNCE_MS;

export class FileWatcher {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.watcher = null;
    this.debounceTimer = null;
    this.pendingFiles = new Set();
  }

  start() {
    if (this.watcher) {
      console.log('[FileWatcher] Already running');
      return;
    }

    const watchPattern = '**/*.{js,ts,mjs,cjs,mts,cts,tsx,py,go,rs,java}';
    const ignored = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.opencode/**',
      '**/coverage/**',
    ];

    this.watcher = watch(watchPattern, {
      cwd: this.projectRoot,
      ignored,
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on('change', filePath => {
      this.handleFileChange(filePath);
    });

    this.watcher.on('add', filePath => {
      this.handleFileChange(filePath);
    });

    this.watcher.on('error', error => {
      console.error('[FileWatcher] Error:', error.message);
    });

    console.log('[FileWatcher] Started watching', watchPattern);
  }

  handleFileChange(filePath) {
    const absolutePath = `${this.projectRoot}/${filePath}`;

    const skipCheck = shouldSkipFile(absolutePath);
    if (skipCheck.skip) {
      return;
    }

    this.pendingFiles.add(absolutePath);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processPendingFiles();
    }, DEBOUNCE_MS);
  }

  processPendingFiles() {
    const files = Array.from(this.pendingFiles);
    this.pendingFiles.clear();

    for (const filePath of files) {
      const relativePath = relative(this.projectRoot, filePath);
      console.log(`[FileWatcher] File changed: ${relativePath}`);
      onFileSaved(filePath, this.projectRoot);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[FileWatcher] Stopped');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.pendingFiles.clear();
  }
}

let globalWatcher = null;

export function startFileWatcher(projectRoot) {
  if (globalWatcher) {
    console.log('[FileWatcher] Already running, skipping');
    return globalWatcher;
  }

  globalWatcher = new FileWatcher(projectRoot);
  globalWatcher.start();
  return globalWatcher;
}

export function stopFileWatcher() {
  if (globalWatcher) {
    globalWatcher.stop();
    globalWatcher = null;
  }
}

export function getFileWatcher() {
  return globalWatcher;
}
