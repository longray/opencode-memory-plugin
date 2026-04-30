/**
 * Tests for file size monitoring
 * TDD for v3.3 Atom Architecture - Phase 3 Risk Mitigation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writeMemory } from '../../../lib/memory-core.js';
import { checkFileSize, MAX_FILE_SIZE } from '../../../lib/file-size-monitor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('File Size Monitoring', () => {
  let tempDir;
  let originalMemoryDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-size-test-'));
    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    const now = new Date();
    const timelineDir = path.join(tempDir, 'timeline', String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0'));
    fs.mkdirSync(timelineDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'MEMORY.md'), '# Memory Index\n\n');
  });

  afterEach(() => {
    if (originalMemoryDir) {
      process.env.MEMORY_DIR = originalMemoryDir;
    } else {
      delete process.env.MEMORY_DIR;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('checkFileSize', () => {
    it('should return ok for small content', () => {
      const content = 'Small content';
      const result = checkFileSize(content);

      expect(result.ok).toBe(true);
      expect(result.size).toBeLessThan(MAX_FILE_SIZE);
    });

    it('should return warning for content near limit', () => {
      const content = 'x'.repeat(MAX_FILE_SIZE - 100);
      const result = checkFileSize(content);

      expect(result.ok).toBe(true);
      expect(result.warning).toBe(true);
    });

    it('should return error for content exceeding limit', () => {
      const content = 'x'.repeat(MAX_FILE_SIZE + 100);
      const result = checkFileSize(content);

      expect(result.ok).toBe(false);
      expect(result.error).toContain('exceeds');
    });

    it('should handle empty content', () => {
      const result = checkFileSize('');

      expect(result.ok).toBe(true);
      expect(result.size).toBe(0);
    });
  });

  describe('Integration with writeMemory', () => {
    it('should allow writing small entries', async () => {
      const result = await writeMemory({
        abstract: 'Small test',
        overview: 'Small overview',
        content: 'Small content',
        type: 'memory',
        tags: ['test'],
        _source: 'test',
      });

      expect(result.success).toBe(true);
    });

    it('should warn when entry is near size limit', async () => {
      const largeContent = 'x'.repeat(50000);

      const result = await writeMemory({
        abstract: 'Large test',
        overview: 'Large overview',
        content: largeContent,
        type: 'memory',
        tags: ['test'],
        _source: 'test',
      });

      expect(result.success).toBe(true);
    });
  });
});
