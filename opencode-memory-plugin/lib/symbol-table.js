import fs from 'fs';
import path from 'path';
import { builtinModules } from 'module';
import { DEBOUNCE_SAVE_MS } from './constants.js';
import { logInfo, logError, logWarn } from './logger.js';

const NODE_BUILTINS = builtinModules
  ? new Set(builtinModules)
  : new Set([
      'fs',
      'path',
      'os',
      'http',
      'https',
      'url',
      'util',
      'crypto',
      'stream',
      'events',
      'buffer',
      'child_process',
      'cluster',
      'dgram',
      'dns',
      'domain',
      'net',
      'readline',
      'repl',
      'tls',
      'tty',
      'v8',
      'vm',
      'zlib',
      'assert',
      'console',
      'process',
      'timers',
      'module',
      'string_decoder',
      'querystring',
      'perf_hooks',
      'async_hooks',
      'trace_events',
      'worker_threads',
      'wasi',
      'inspector',
      'punycode',
      'constants',
    ]);

const EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs'];

export class SymbolTable {
  constructor(projectId, cacheDir, options = {}) {
    this.projectId = projectId || 'default';
    this.cacheDir = cacheDir || this._getDefaultCacheDir();
    this.cacheFile = path.join(this.cacheDir, 'symbol-table.json');

    this.pathToEntityId = new Map();
    this.globalNameToEntityId = new Map();
    this._symbolToPaths = new Map();
    this._entityToSymbols = new Map();

    this.pathAliases = options.pathAliases || {};
    this.maxSize = options.maxSize || 10000;

    this._lruPathOrder = [];
    this._lruGlobalOrder = [];

    this.stats = { hits: 0, misses: 0, lastSaved: null };
  }

  _getDefaultCacheDir() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, '.opencode', 'cache');
  }

  _normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  async setPathMapping(filePath, entityId) {
    const normalized = this._normalizePath(filePath);
    this.pathToEntityId.set(normalized, entityId);
    this._touchLru('_lruPathOrder', normalized);
    this._evictIfNeeded();
    this._scheduleSave();
  }

  getPathEntityId(filePath) {
    const normalized = this._normalizePath(filePath);
    const entityId = this.pathToEntityId.get(normalized);
    if (entityId) {
      this.stats.hits++;
      this._touchLru('_lruPathOrder', normalized);
      return entityId;
    }
    this.stats.misses++;
    return null;
  }

  async setGlobalSymbol(symbolName, entityId, filePath) {
    this.globalNameToEntityId.set(symbolName, entityId);
    if (!this._entityToSymbols.has(entityId)) {
      this._entityToSymbols.set(entityId, new Set());
    }
    this._entityToSymbols.get(entityId).add(symbolName);

    if (filePath) {
      const normalized = this._normalizePath(filePath);
      const namespacedKey = `${normalized}:${symbolName}`;
      this.globalNameToEntityId.set(namespacedKey, entityId);
      if (!this._symbolToPaths.has(symbolName)) {
        this._symbolToPaths.set(symbolName, new Set());
      }
      this._symbolToPaths.get(symbolName).add(normalized);
    }
    this._touchLru('_lruGlobalOrder', symbolName);
    this._evictIfNeeded();
    this._scheduleSave();
  }

  getSymbolEntityId(symbolName) {
    const entityId = this.globalNameToEntityId.get(symbolName);
    if (entityId) {
      this.stats.hits++;
      this._touchLru('_lruGlobalOrder', symbolName);
      return entityId;
    }
    this.stats.misses++;
    return null;
  }

  hasPath(filePath) {
    return this.pathToEntityId.has(this._normalizePath(filePath));
  }

  removePathMapping(filePath) {
    const normalized = this._normalizePath(filePath);
    return this.pathToEntityId.delete(normalized);
  }

  clear() {
    this.pathToEntityId.clear();
    this.globalNameToEntityId.clear();
    this._symbolToPaths.clear();
    this._entityToSymbols.clear();
    this._lruPathOrder = [];
    this._lruGlobalOrder = [];
    this._scheduleSave();
  }

  resolveImportPath(importPath, currentFile) {
    if (importPath.startsWith('.')) {
      return this._resolveRelativePath(importPath, currentFile);
    }

    if (NODE_BUILTINS.has(importPath) || importPath.startsWith('node:')) {
      return null;
    }

    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      if (importPath.startsWith('@')) {
        const aliased = this._resolveAlias(importPath);
        if (aliased) return aliased;
      }
      return null;
    }

    return null;
  }

  lookupSymbolByPath(filePath) {
    return this.getPathEntityId(filePath);
  }

  lookupSymbolByName(symbolName) {
    return this.getSymbolEntityId(symbolName);
  }

  resolveAndLookup(importPath, currentFile) {
    const resolved = this.resolveImportPath(importPath, currentFile);
    if (!resolved) return null;
    return this.getPathEntityId(resolved);
  }

  invalidatePath(filePath) {
    const normalized = this._normalizePath(filePath);
    const entityId = this.pathToEntityId.get(normalized);
    this.pathToEntityId.delete(normalized);

    if (entityId) {
      const symbols = this._entityToSymbols.get(entityId);
      if (symbols) {
        for (const symbolName of symbols) {
          this.globalNameToEntityId.delete(symbolName);
          const namespacedKey = `${normalized}:${symbolName}`;
          this.globalNameToEntityId.delete(namespacedKey);
          if (this._symbolToPaths.has(symbolName)) {
            this._symbolToPaths.get(symbolName).delete(normalized);
            if (this._symbolToPaths.get(symbolName).size === 0) {
              this._symbolToPaths.delete(symbolName);
            }
          }
        }
        this._entityToSymbols.delete(entityId);
      }
    }
    this._scheduleSave();
  }

  async setBatchPathMappings(mappings) {
    for (const [filePath, entityId] of mappings) {
      await this.setPathMapping(filePath, entityId);
    }
  }

  async setBatchGlobalSymbols(symbols) {
    for (const [symbolName, entityId, filePath] of symbols) {
      await this.setGlobalSymbol(symbolName, entityId, filePath);
    }
  }

  getBatchPathEntityIds(filePaths) {
    const result = new Map();
    for (const filePath of filePaths) {
      const entityId = this.getPathEntityId(filePath);
      if (entityId) {
        result.set(filePath, entityId);
      }
    }
    return result;
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;
    return {
      pathEntries: this.pathToEntityId.size,
      globalEntries: this.globalNameToEntityId.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      lastSaved: this.stats.lastSaved,
    };
  }

  async load() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        if (data.project_id === this.projectId) {
          for (const [filePath, entityId] of Object.entries(data.pathToEntityId || {})) {
            this.pathToEntityId.set(filePath, entityId);
          }
          for (const [symbolName, entityId] of Object.entries(data.globalNameToEntityId || {})) {
            this.globalNameToEntityId.set(symbolName, entityId);
          }
          if (data.symbolToPaths) {
            for (const [symbolName, pathsArray] of Object.entries(data.symbolToPaths)) {
              this._symbolToPaths.set(symbolName, new Set(pathsArray));
            }
          }

          // Rebuild reverse index (_entityToSymbols) from loaded data
          for (const [key, entityId] of this.globalNameToEntityId) {
            if (!key.includes(':')) {
              if (!this._entityToSymbols.has(entityId)) {
                this._entityToSymbols.set(entityId, new Set());
              }
              this._entityToSymbols.get(entityId).add(key);
            }
          }

          // Rebuild LRU order arrays from loaded entries
          this._lruPathOrder = Array.from(this.pathToEntityId.keys());
          this._lruGlobalOrder = Array.from(this.globalNameToEntityId.keys()).filter(
            key => !key.includes(':')
          );

          logInfo(
            'SymbolTable',
            `[SymbolTable] Loaded ${this.pathToEntityId.size} path mappings, ${this.globalNameToEntityId.size} global symbols`
          );
        } else {
          logWarn(
            'SymbolTable',
            `[SymbolTable] Cache project mismatch: expected ${this.projectId}, got ${data.project_id}`
          );
        }
      }
    } catch (error) {
      logError('SymbolTable', '[SymbolTable] Failed to load cache:', error);
    }
  }

  async save() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const symbolToPathsObj = {};
      for (const [symbolName, pathsSet] of this._symbolToPaths) {
        symbolToPathsObj[symbolName] = Array.from(pathsSet);
      }

      const data = {
        version: '1.0',
        project_id: this.projectId,
        last_updated: new Date().toISOString(),
        pathToEntityId: Object.fromEntries(this.pathToEntityId),
        globalNameToEntityId: Object.fromEntries(this.globalNameToEntityId),
        symbolToPaths: symbolToPathsObj,
      };
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
      this.stats.lastSaved = new Date().toISOString();
      logInfo(
        'SymbolTable',
        `[SymbolTable] Saved ${this.pathToEntityId.size} path mappings, ${this.globalNameToEntityId.size} global symbols`
      );
      return true;
    } catch (error) {
      logError('SymbolTable', '[SymbolTable] Failed to save cache:', error);
      return false;
    }
  }

  cleanup() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
      this._saveTimeout = null;
    }
  }

  _resolveRelativePath(importPath, currentFile) {
    const isWindowsPath = p => /^[A-Za-z]:[\\/]/.test(p);
    const normalizedCurrent = currentFile.replace(/\\/g, '/');

    let resolved;
    if (isWindowsPath(currentFile)) {
      const dir = path.win32.dirname(currentFile);
      resolved = path.win32.resolve(dir, importPath).replace(/\\/g, '/');
    } else {
      const dir = path.posix.dirname(normalizedCurrent);
      resolved = path.posix.resolve(dir, importPath);
    }

    const toNative = p => p.replace(/\//g, path.sep);

    if (fs.existsSync(toNative(resolved))) {
      const stat = fs.statSync(toNative(resolved));
      if (stat.isFile()) return resolved;
      if (stat.isDirectory()) {
        const indexFile = resolved + '/index.js';
        if (fs.existsSync(toNative(indexFile))) return indexFile;
      }
    }

    for (const ext of EXTENSIONS) {
      const withExt = resolved + ext;
      if (fs.existsSync(toNative(withExt))) return withExt;
    }

    const indexFile = resolved + '/index.js';
    if (fs.existsSync(toNative(indexFile))) return indexFile;

    return resolved;
  }

  _resolveAlias(importPath) {
    for (const [alias, target] of Object.entries(this.pathAliases)) {
      if (alias.endsWith('/*')) {
        const prefix = alias.slice(0, -2);
        if (importPath.startsWith(prefix + '/')) {
          const remainder = importPath.slice(prefix.length + 1);
          return target.replace('/*', '') + '/' + remainder;
        }
      } else {
        if (importPath === alias || importPath.startsWith(alias + '/')) {
          const remainder = importPath.slice(alias.length);
          return target + remainder;
        }
      }
    }
    return null;
  }

  _touchLru(orderKey, key) {
    const order = this[orderKey];
    const idx = order.indexOf(key);
    if (idx !== -1) order.splice(idx, 1);
    order.push(key);
  }

  _evictIfNeeded() {
    while (this.pathToEntityId.size + this.globalNameToEntityId.size > this.maxSize) {
      if (this._lruPathOrder.length > 0) {
        const oldest = this._lruPathOrder.shift();
        this.pathToEntityId.delete(oldest);
      } else if (this._lruGlobalOrder.length > 0) {
        const oldest = this._lruGlobalOrder.shift();
        this.globalNameToEntityId.delete(oldest);
        if (this._symbolToPaths.has(oldest)) {
          const paths = this._symbolToPaths.get(oldest);
          for (const filePath of paths) {
            const namespacedKey = `${filePath}:${oldest}`;
            this.globalNameToEntityId.delete(namespacedKey);
          }
          this._symbolToPaths.delete(oldest);
        }
        for (const [entityId, symbols] of this._entityToSymbols) {
          symbols.delete(oldest);
          if (symbols.size === 0) {
            this._entityToSymbols.delete(entityId);
          }
        }
      } else {
        break;
      }
    }
  }

  _scheduleSave() {
    if (this._saveTimeout) {
      clearTimeout(this._saveTimeout);
    }
    this._saveTimeout = setTimeout(() => {
      this.save();
    }, DEBOUNCE_SAVE_MS).unref();
  }
}

export default SymbolTable;
