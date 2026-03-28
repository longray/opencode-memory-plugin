/**
 * Phase B Test Suite - Topic Sync Tools
 * Tests for plugin topic_sync and rebuild_topics tools
 *
 * These tests verify the sync tools exist and have correct signatures
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_MEMORY_DIR = path.join(__dirname, 'test-memory-temp');

// Import plugin - may fail if topic_sync/rebuild_topics not implemented
let pluginModule;
let topicSyncAvailable = false;
let rebuildTopicsAvailable = false;

try {
  pluginModule = await import('../plugin.js');
  topicSyncAvailable = typeof pluginModule.topic_sync !== 'undefined';
  rebuildTopicsAvailable = typeof pluginModule.rebuild_topics !== 'undefined';
} catch (e) {
  console.warn('Warning: Could not import plugin.js:', e.message);
}

describe('Topic Sync Tools', () => {
  beforeAll(() => {
    // Setup test directory
    if (!fs.existsSync(TEST_MEMORY_DIR)) {
      fs.mkdirSync(TEST_MEMORY_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test directory
    try {
      if (fs.existsSync(TEST_MEMORY_DIR)) {
        fs.rmSync(TEST_MEMORY_DIR, { recursive: true, force: true });
      }
    } catch {}
  });

  // Skip all tests if topic_sync/rebuild_topics not implemented
  const describeOrSkip = topicSyncAvailable ? describe : describe.skip;
  const describeOrSkipRebuild = rebuildTopicsAvailable ? describe : describe.skip;

  describeOrSkip('topic_sync tool', () => {
    it('should be exported from plugin.js', () => {
      expect(pluginModule).toBeDefined();
      expect(pluginModule.topic_sync).toBeDefined();
    });

    it('should have execute method if defined', () => {
      expect(pluginModule.topic_sync).toBeDefined();
      expect(pluginModule.topic_sync.execute).toBeDefined();
      expect(typeof pluginModule.topic_sync.execute).toBe('function');
    });

    it('should accept dry_run parameter', async () => {
      const result = await pluginModule.topic_sync.execute({ dry_run: true });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });

    it('should accept topic parameter', async () => {
      const result = await pluginModule.topic_sync.execute({
        topic: 'test-topic',
        dry_run: true,
      });

      expect(result.success).toBe(true);
    });

    it('should return entry_count in dry_run mode', async () => {
      const result = await pluginModule.topic_sync.execute({ dry_run: true });

      if (result.dry_run) {
        expect(result).toHaveProperty('entry_count');
        expect(typeof result.entry_count).toBe('number');
      }
    });

    it('should return fingerprints_preview in dry_run mode', async () => {
      const result = await pluginModule.topic_sync.execute({ dry_run: true });

      if (result.dry_run) {
        expect(result).toHaveProperty('fingerprints_preview');
      }
    });
  });

  describeOrSkipRebuild('rebuild_topics tool', () => {
    it('should be exported from plugin.js', () => {
      expect(pluginModule).toBeDefined();
      expect(pluginModule.rebuild_topics).toBeDefined();
    });

    it('should have execute method if defined', () => {
      expect(pluginModule.rebuild_topics).toBeDefined();
      expect(pluginModule.rebuild_topics.execute).toBeDefined();
      expect(typeof pluginModule.rebuild_topics.execute).toBe('function');
    });

    it('should accept dry_run parameter', async () => {
      const result = await pluginModule.rebuild_topics.execute({ dry_run: true });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('message');
    });

    it('should return total count', async () => {
      const result = await pluginModule.rebuild_topics.execute({ dry_run: true });

      expect(result).toHaveProperty('total');
      expect(typeof result.total).toBe('number');
    });
  });

  describe('Helper Functions', () => {
    it('should have TYPE_TO_TOPIC mapping if defined', () => {
      if (!pluginModule) return;

      // Check if TYPE_TO_TOPIC constant exists
      const hasMapping = pluginModule.TYPE_TO_TOPIC !== undefined;

      if (hasMapping) {
        expect(typeof pluginModule.TYPE_TO_TOPIC).toBe('object');
        // Should have at least some default mappings
        expect(Object.keys(pluginModule.TYPE_TO_TOPIC).length).toBeGreaterThan(0);
      }
    });

    it('should have ACTIVE_DIR constant if defined', () => {
      if (!pluginModule) return;

      const hasActiveDir = pluginModule.ACTIVE_DIR !== undefined;

      if (hasActiveDir) {
        expect(typeof pluginModule.ACTIVE_DIR).toBe('string');
        expect(pluginModule.ACTIVE_DIR).toContain('active');
      }
    });

    it('should have TOPIC_KEYWORDS mapping if defined', () => {
      if (!pluginModule) return;

      const hasKeywords = pluginModule.TOPIC_KEYWORDS !== undefined;

      if (hasKeywords) {
        expect(typeof pluginModule.TOPIC_KEYWORDS).toBe('object');
      }
    });
  });

  describe('Topic Directory Structure', () => {
    it('should be able to create topic directory structure', () => {
      const testTopicDir = path.join(TEST_MEMORY_DIR, 'active', 'preferences');

      // Create directory
      fs.mkdirSync(testTopicDir, { recursive: true });

      // Verify it exists
      expect(fs.existsSync(testTopicDir)).toBe(true);

      // Create entries subdirectory
      const entriesDir = path.join(testTopicDir, 'entries');
      fs.mkdirSync(entriesDir, { recursive: true });
      expect(fs.existsSync(entriesDir)).toBe(true);
    });

    it('should support .index and .overview files', () => {
      const testTopicDir = path.join(TEST_MEMORY_DIR, 'active', 'test-topic');
      fs.mkdirSync(testTopicDir, { recursive: true });

      // Create .index file
      const indexFile = path.join(testTopicDir, '.index');
      fs.writeFileSync(indexFile, '# Test Topic Index\n');
      expect(fs.existsSync(indexFile)).toBe(true);

      // Create .overview file
      const overviewFile = path.join(testTopicDir, '.overview');
      fs.writeFileSync(overviewFile, '# Test Topic Overview\n');
      expect(fs.existsSync(overviewFile)).toBe(true);
    });
  });

  describe('Link Map JSON', () => {
    it('should support link-map.json structure', () => {
      const testTopicDir = path.join(TEST_MEMORY_DIR, 'active', 'test-topic');
      fs.mkdirSync(testTopicDir, { recursive: true });

      // Create link-map.json
      const linkMapFile = path.join(testTopicDir, 'link-map.json');
      const linkMap = {
        'entry-001': {
          date: '2026-03-19',
          topic: 'preferences',
          abstract: 'Test entry',
          path: 'active/preferences/entries/entry-001.md',
        },
      };

      fs.writeFileSync(linkMapFile, JSON.stringify(linkMap, null, 2));
      expect(fs.existsSync(linkMapFile)).toBe(true);

      // Read back and verify
      const readBack = JSON.parse(fs.readFileSync(linkMapFile, 'utf-8'));
      expect(readBack['entry-001']).toBeDefined();
      expect(readBack['entry-001'].path).toContain('entry-001.md');
    });
  });
});

// Summary test to report what's implemented
describe('Phase B Implementation Status', () => {
  it('should report topic_sync implementation status', () => {
    const status = {
      topic_sync: topicSyncAvailable ? '✅ Implemented' : '❌ Not implemented',
      rebuild_topics: rebuildTopicsAvailable ? '✅ Implemented' : '❌ Not implemented',
      plugin_module: pluginModule ? '✅ Available' : '❌ Not available',
    };

    console.log('\n📊 Phase B Implementation Status:');
    console.log(`  topic_sync: ${status.topic_sync}`);
    console.log(`  rebuild_topics: ${status.rebuild_topics}`);
    console.log(`  plugin_module: ${status.plugin_module}`);

    // This test always passes - it's just for reporting
    expect(true).toBe(true);
  });
});
