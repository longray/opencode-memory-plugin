/**
 * Test Suite - formatRecentEntries (BL-101.1 / BL-101.3)
 * Tests for the recent entries formatting logic in indexer.js
 */

import { describe, it, expect } from '@jest/globals';
import { formatRecentEntries } from '../../../lib/indexer.js';

describe('formatRecentEntries (BL-101.1)', () => {
  describe('empty / no entries', () => {
    it('should return empty section for empty array', () => {
      const result = formatRecentEntries([], 20);
      expect(result.section).toBe('');
      expect(result.count).toBe(0);
    });

    it('should return empty section when no entries have valid timeline paths', () => {
      const entries = [
        { id: 'abc', path: 'active/test.md', type: 'general', abstract: 'test' },
        { id: 'def', path: 'unknown/path.md', type: 'general', abstract: 'test' },
      ];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toBe('');
      expect(result.count).toBe(0);
    });
  });

  describe('date extraction', () => {
    it('should extract date from valid timeline path', () => {
      const entries = [
        {
          id: 'abc',
          path: 'timeline/2026/03/31/entry_abc.md',
          type: 'preference',
          abstract: 'test abstract',
        },
      ];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toContain('2026-03-31');
      expect(result.count).toBe(1);
    });

    it('should skip entries with non-matching paths', () => {
      const entries = [
        {
          id: 'abc',
          path: 'timeline/2026/03/31/entry_abc.md',
          type: 'preference',
          abstract: 'valid',
        },
        { id: 'def', path: 'active/test.md', type: 'general', abstract: 'invalid' },
      ];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toContain('valid');
      expect(result.section).not.toContain('invalid');
      expect(result.count).toBe(1);
    });
  });

  describe('sorting', () => {
    it('should sort by date descending (newest first)', () => {
      const entries = [
        { id: 'a', path: 'timeline/2026/03/30/entry_a.md', type: 'general', abstract: 'older' },
        { id: 'b', path: 'timeline/2026/03/31/entry_b.md', type: 'general', abstract: 'newer' },
      ];
      const result = formatRecentEntries(entries, 20);
      const lines = result.section
        .trim()
        .split('\n')
        .filter(l => l.startsWith('- '));
      expect(lines[0]).toContain('newer');
      expect(lines[1]).toContain('older');
    });

    it('should sort by ULID descending within same date', () => {
      const entries = [
        {
          id: '01AAA',
          path: 'timeline/2026/03/31/entry_a.md',
          type: 'general',
          abstract: 'older ulid',
        },
        {
          id: '01ZZZ',
          path: 'timeline/2026/03/31/entry_b.md',
          type: 'general',
          abstract: 'newer ulid',
        },
      ];
      const result = formatRecentEntries(entries, 20);
      const lines = result.section
        .trim()
        .split('\n')
        .filter(l => l.startsWith('- '));
      expect(lines[0]).toContain('newer ulid');
      expect(lines[1]).toContain('older ulid');
    });
  });

  describe('limit', () => {
    it('should respect the limit parameter', () => {
      const entries = Array.from({ length: 30 }, (_, i) => ({
        id: `id_${String(i).padStart(3, '0')}`,
        path: `timeline/2026/03/${String(Math.min(31, i + 1)).padStart(2, '0')}/entry_${i}.md`,
        type: 'general',
        abstract: `abstract ${i}`,
      }));
      const result = formatRecentEntries(entries, 5);
      const lines = result.section
        .trim()
        .split('\n')
        .filter(l => l.startsWith('- '));
      expect(lines.length).toBe(5);
      expect(result.count).toBe(5);
    });

    it('should return all entries when count < limit', () => {
      const entries = [
        { id: 'a', path: 'timeline/2026/03/31/entry_a.md', type: 'general', abstract: 'one' },
        { id: 'b', path: 'timeline/2026/03/30/entry_b.md', type: 'general', abstract: 'two' },
      ];
      const result = formatRecentEntries(entries, 20);
      const lines = result.section
        .trim()
        .split('\n')
        .filter(l => l.startsWith('- '));
      expect(lines.length).toBe(2);
      expect(result.count).toBe(2);
    });
  });

  describe('output format', () => {
    it('should format each line as: date `id` [**type**] abstract', () => {
      const entries = [
        {
          id: 'ABC123',
          path: 'timeline/2026/03/31/entry_x.md',
          type: 'preference',
          abstract: 'test abstract',
        },
      ];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toContain('- 2026-03-31 `ABC123` [**preference**] test abstract');
    });

    it('should include section header with correct count', () => {
      const entries = [
        { id: 'a', path: 'timeline/2026/03/31/entry_a.md', type: 'general', abstract: 'one' },
        { id: 'b', path: 'timeline/2026/03/30/entry_b.md', type: 'general', abstract: 'two' },
        { id: 'c', path: 'timeline/2026/03/29/entry_c.md', type: 'general', abstract: 'three' },
      ];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toContain('## 最近条目 (最近 3 条)');
    });

    it('should show [无摘要] when abstract is empty', () => {
      const entries = [
        { id: 'abc', path: 'timeline/2026/03/31/entry_x.md', type: 'general', abstract: '' },
      ];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toContain('[无摘要]');
    });

    it('should show [无摘要] when abstract is undefined', () => {
      const entries = [{ id: 'abc', path: 'timeline/2026/03/31/entry_x.md', type: 'general' }];
      const result = formatRecentEntries(entries, 20);
      expect(result.section).toContain('[无摘要]');
    });
  });

  describe('default limit', () => {
    it('should default to 20 entries when limit not specified', () => {
      const entries = Array.from({ length: 25 }, (_, i) => ({
        id: `id_${String(i).padStart(3, '0')}`,
        path: `timeline/2026/03/${String(Math.min(31, i + 1)).padStart(2, '0')}/entry_${i}.md`,
        type: 'general',
        abstract: `abstract ${i}`,
      }));
      const result = formatRecentEntries(entries);
      const lines = result.section
        .trim()
        .split('\n')
        .filter(l => l.startsWith('- '));
      expect(lines.length).toBe(20);
    });
  });
});
