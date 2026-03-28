/**
 * Test Suite - Entry Module
 * Tests for buildEntryContent and writeEntryToTimeline functions
 */

import { describe, it, expect } from '@jest/globals';
import { buildEntryContent, writeEntryToTimeline } from '../lib/entry.js';

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
});
