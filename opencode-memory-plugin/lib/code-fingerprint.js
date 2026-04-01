import { createHash } from 'crypto';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WrapperClient } from './wrapper-client.js';
import { resolveProjectId } from './project-resolver.js';

const FINGERPRINT_FILE = '.code_fingerprints.json';

export class CodeFingerprint {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.fingerprintFile = join(projectRoot, FINGERPRINT_FILE);
    this.localFingerprints = this.loadLocalFingerprints();
    this.wrapperClient = new WrapperClient();
  }

  calculateContentHash(content) {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  calculateSymbolsHash(analysisResult) {
    if (!analysisResult || !analysisResult.functions) {
      return 'empty';
    }

    const symbols = [
      ...analysisResult.functions.map(f => f.name),
      ...analysisResult.classes.map(c => c.name),
      ...analysisResult.interfaces.map(i => i.name),
    ]
      .sort()
      .join(',');

    if (!symbols) {
      return 'empty';
    }

    return createHash('sha256').update(symbols).digest('hex').substring(0, 16);
  }

  calculateFingerprint(filePath, content, analysisResult) {
    const contentHash = this.calculateContentHash(content);
    const symbolsHash = this.calculateSymbolsHash(analysisResult);

    return {
      file_path: filePath,
      content_hash: contentHash,
      symbols_hash: symbolsHash,
      timestamp: new Date().toISOString(),
    };
  }

  loadLocalFingerprints() {
    if (!existsSync(this.fingerprintFile)) {
      return {};
    }

    try {
      const content = readFileSync(this.fingerprintFile, 'utf-8');
      const data = JSON.parse(content);
      return data.fingerprints || {};
    } catch (error) {
      console.error('[CodeFingerprint] Error loading fingerprints:', error.message);
      return {};
    }
  }

  saveLocalFingerprints() {
    try {
      const data = {
        version: '1.0',
        updated_at: new Date().toISOString(),
        fingerprints: this.localFingerprints,
      };
      writeFileSync(this.fingerprintFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[CodeFingerprint] Error saving fingerprints:', error.message);
    }
  }

  hasChanged(filePath, content, analysisResult) {
    const newFingerprint = this.calculateFingerprint(filePath, content, analysisResult);
    const oldFingerprint = this.localFingerprints[filePath];

    if (!oldFingerprint) {
      return { changed: true, reason: 'new_file', fingerprint: newFingerprint };
    }

    if (oldFingerprint.content_hash !== newFingerprint.content_hash) {
      return { changed: true, reason: 'content_changed', fingerprint: newFingerprint };
    }

    if (oldFingerprint.symbols_hash !== newFingerprint.symbols_hash) {
      return { changed: true, reason: 'symbols_changed', fingerprint: newFingerprint };
    }

    return { changed: false, fingerprint: newFingerprint };
  }

  async syncWithBackend() {
    const fingerprints = Object.entries(this.localFingerprints).map(([path, fp]) => ({
      path,
      hash: fp.content_hash,
      symbols_hash: fp.symbols_hash,
      mtime: new Date(fp.timestamp).getTime(),
      size: 0,
    }));

    try {
      const response = await this.wrapperClient.http.post('/api/v1/sync/code-fingerprints', {
        fingerprints,
        project_id: resolveProjectId({ projectRoot: this.projectRoot }),
        tenant_id: this.wrapperClient.tenantId,
      });

      console.log('[CodeFingerprint] Sync response:', response);
      return {
        success: true,
        changed: response.changed || [],
        unchanged: response.unchanged || [],
        missing: response.missing || [],
        conflicts: response.conflicts || [],
      };
    } catch (error) {
      console.error('[CodeFingerprint] Sync failed:', error.message);
      return {
        success: false,
        changed: Object.keys(this.localFingerprints),
        unchanged: [],
        missing: [],
        error: error.message,
      };
    }
  }

  updateFingerprint(filePath, fingerprint) {
    this.localFingerprints[filePath] = fingerprint;
    this.saveLocalFingerprints();
  }

  async shouldUpload(filePath, content, analysisResult) {
    const changeCheck = this.hasChanged(filePath, content, analysisResult);

    if (!changeCheck.changed) {
      console.log(`[CodeFingerprint] File unchanged: ${filePath}`);
      return { shouldUpload: false, fingerprint: changeCheck.fingerprint };
    }

    console.log(`[CodeFingerprint] File ${changeCheck.reason}: ${filePath}`);
    return { shouldUpload: true, fingerprint: changeCheck.fingerprint };
  }

  markAsUploaded(filePath, fingerprint) {
    this.updateFingerprint(filePath, fingerprint);
  }
}

export function createFingerprintManager(projectRoot) {
  return new CodeFingerprint(projectRoot);
}
