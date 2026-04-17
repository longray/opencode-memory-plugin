import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { getPrecomputeClient } from './client.js';

const CACHE_FILE = '.precompute_fingerprint_cache.json';

export class FingerprintCache {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.cacheFile = join(projectRoot, CACHE_FILE);
    this.cache = this.load();
  }

  load() {
    if (!existsSync(this.cacheFile)) {
      return { version: '1.0', fingerprints: {} };
    }

    try {
      const content = readFileSync(this.cacheFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { version: '1.0', fingerprints: {} };
    }
  }

  save() {
    try {
      const dir = dirname(this.cacheFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error('[FingerprintCache] Save failed:', error.message);
    }
  }

  getContentHash(content) {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  getSymbolsHash(analysisResult) {
    if (!analysisResult) return 'empty';

    const names = [
      ...(analysisResult.functions || []).map(f => f.name),
      ...(analysisResult.classes || []).map(c => c.name),
      ...(analysisResult.interfaces || []).map(i => i.name),
    ]
      .sort()
      .join(',');

    return names ? createHash('sha256').update(names).digest('hex').substring(0, 16) : 'empty';
  }

  get(filePath) {
    return this.cache.fingerprints[filePath] || null;
  }

  set(filePath, fingerprint) {
    this.cache.fingerprints[filePath] = {
      ...fingerprint,
      updated_at: new Date().toISOString(),
    };
    this.save();
  }

  hasChanged(filePath, content, analysisResult) {
    const contentHash = this.getContentHash(content);
    const symbolsHash = this.getSymbolsHash(analysisResult);
    const cached = this.get(filePath);

    if (!cached) {
      return { changed: true, reason: 'new_file', contentHash, symbolsHash };
    }

    if (cached.content_hash !== contentHash) {
      return { changed: true, reason: 'content_changed', contentHash, symbolsHash };
    }

    if (cached.symbols_hash !== symbolsHash) {
      return { changed: true, reason: 'symbols_changed', contentHash, symbolsHash };
    }

    return { changed: false, contentHash, symbolsHash };
  }

  async checkWithBackend(project_id, tenant_id) {
    const fingerprints = Object.entries(this.cache.fingerprints).map(([file, fp]) => ({
      file,
      content_hash: fp.content_hash,
      symbols_hash: fp.symbols_hash,
    }));

    if (fingerprints.length === 0) {
      return { changed_files: [], unchanged_files: [], new_files: [] };
    }

    const client = getPrecomputeClient();
    return await client.checkFingerprints({
      fingerprints,
      project_id,
      tenant_id,
    });
  }

  remove(filePath) {
    delete this.cache.fingerprints[filePath];
    this.save();
  }

  clear() {
    this.cache.fingerprints = {};
    this.save();
  }

  size() {
    return Object.keys(this.cache.fingerprints).length;
  }
}
