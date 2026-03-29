/**
 * Test Suite - Entry Module
 * Tests for buildEntryContent and writeEntryToTimeline functions
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildEntryContent, writeEntryToTimeline, parseEntryFromFile } from '../lib/entry.js';

describe('Entry Module', () => {
  describe('buildEntryContent', () => {
    it('should build entry content with all fields', () => {
      const data = {
        id: 'entry-001',
        date: '2026-03-28T00:00:00.000Z',
        type: 'general',
        tags: ['test', 'example'],
        project: 'test-project',
        memory_id: 'mem-001',
        source_id: 'src-001',
        synced: true,
        synced_at: '2026-03-28T00:00:00.000Z',
        meta: [{ key: 'value' }],
        abstract: 'Test abstract',
        overview: 'Test overview',
        content: 'Test content',
      };

      const result = buildEntryContent(data);

      expect(result).toContain('id: entry-001');
      expect(result).toContain('type: general');
      expect(result).toContain('tags: [test, example]');
      expect(result).toContain('project: test-project');
      expect(result).toContain('memory_id: mem-001');
      expect(result).toContain('source_id: src-001');
      expect(result).toContain('synced: true');
      expect(result).toContain('Test abstract');
      expect(result).toContain('Test overview');
      expect(result).toContain('Test content');
    });

    it('should handle missing optional fields', () => {
      const data = {
        id: 'entry-002',
        date: '2026-03-28T00:00:00.000Z',
        type: 'general',
        abstract: 'Test abstract',
        overview: 'Test overview',
        content: 'Test content',
      };

      const result = buildEntryContent(data);

      expect(result).toContain('id: entry-002');
      expect(result).toContain('tags: []');
      expect(result).toContain('project: ');
      expect(result).toContain('memory_id: pending');
    });

    it('should handle empty tags array', () => {
      const data = {
        id: 'entry-003',
        date: '2026-03-28T00:00:00.000Z',
        type: 'general',
        tags: [],
        abstract: 'Test abstract',
        overview: 'Test overview',
        content: 'Test content',
      };

      const result = buildEntryContent(data);

      expect(result).toContain('tags: []');
    });

    it('should handle meta field as JSON', () => {
      const data = {
        id: 'entry-004',
        date: '2026-03-28T00:00:00.000Z',
        type: 'general',
        meta: [{ source: 'test' }, { priority: 'high' }],
        abstract: 'Test abstract',
        overview: 'Test overview',
        content: 'Test content',
      };

      const result = buildEntryContent(data);

      expect(result).toContain('meta: [{"source":"test"},{"priority":"high"}]');
    });
  });

  describe('writeEntryToTimeline', () => {
    it('should be a function', () => {
      expect(typeof writeEntryToTimeline).toBe('function');
    });

    it('should return a promise', () => {
      const result = writeEntryToTimeline(
        {
          abstract: 'Test abstract',
          overview: 'Test overview',
          content: 'Test content',
        },
        { type: 'general' }
      );

      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('parseEntryFromFile', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-test-'));

    afterAll(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should return null for null filePath', () => {
      expect(parseEntryFromFile(null)).toBeNull();
    });

    it('should return null for non-existent file', () => {
      expect(parseEntryFromFile('/non/existent/path.md')).toBeNull();
    });

    it('should return null for empty file', () => {
      const emptyFile = path.join(tmpDir, 'empty.md');
      fs.writeFileSync(emptyFile, '');
      expect(parseEntryFromFile(emptyFile)).toBeNull();
    });

    it('should return null for file without frontmatter', () => {
      const noFmFile = path.join(tmpDir, 'no-frontmatter.md');
      fs.writeFileSync(noFmFile, 'Just some text without frontmatter');
      expect(parseEntryFromFile(noFmFile)).toBeNull();
    });

    it('should parse a valid entry file', () => {
      const validFile = path.join(tmpDir, 'valid.md');
      fs.writeFileSync(
        validFile,
        `---
id: entry-test-001
date: 2026-03-29T00:00:00.000Z
type: general
tags: [test]
project: test-project
memory_id: mem-001
source_id: 
synced: false
synced_at: null
meta: [{"source":"test"}]
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
Test abstract content
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
Test overview content
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
Test full content
\`\`\`

---
`
      );
      const result = parseEntryFromFile(validFile);

      expect(result).not.toBeNull();
      expect(result.frontmatter.id).toBe('entry-test-001');
      expect(result.frontmatter.type).toBe('general');
      expect(result.frontmatter.tags).toBe('[test]');
      expect(result.abstract).toBe('Test abstract content');
      expect(result.overview).toBe('Test overview content');
      expect(result.content).toBe('Test full content');
    });

    it('should handle meta field as JSON array', () => {
      const metaFile = path.join(tmpDir, 'meta.md');
      fs.writeFileSync(
        metaFile,
        `---
id: entry-test-002
date: 2026-03-29T00:00:00.000Z
type: general
tags: []
meta: [{"key":"value"}]
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
Abstract
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
Overview
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
Content
\`\`\`

---
`
      );
      const result = parseEntryFromFile(metaFile);

      expect(result).not.toBeNull();
      expect(result.frontmatter.meta).toEqual([{ key: 'value' }]);
    });

    it('should return empty strings for missing sections', () => {
      const partialFile = path.join(tmpDir, 'partial.md');
      fs.writeFileSync(
        partialFile,
        `---
id: entry-test-003
date: 2026-03-29T00:00:00.000Z
type: general
tags: []
---

No sections here
`
      );
      const result = parseEntryFromFile(partialFile);

      expect(result).not.toBeNull();
      expect(result.abstract).toBe('');
      expect(result.overview).toBe('');
      expect(result.content).toBe('');
    });
  });
});
