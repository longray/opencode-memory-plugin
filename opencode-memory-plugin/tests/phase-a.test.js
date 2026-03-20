/**
 * Phase A (v2.2-lite) Test Suite
 * Tests for timeline storage, memory_write, and getMemoryFiles
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_DIR = path.join(os.tmpdir(), 'opencode-memory-test-phase-a');
const MEMORY_DIR = path.join(TEST_DIR, 'memory');
const TIMELINE_DIR = path.join(MEMORY_DIR, 'timeline');

// Mock the plugin functions
const mockPlugin = {
  generateEntryId: () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `entry-${timestamp}-${random}`;
  },

  writeToTimeline: async (entry, layers) => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const dayDir = path.join(TIMELINE_DIR, year, month, day);
    await fs.mkdir(dayDir, { recursive: true });
    
    const entryId = mockPlugin.generateEntryId();
    const entryFile = path.join(dayDir, `${entryId}.md`);
    
    const content = `---
entry_id: ${entryId}
date: ${now.toISOString()}
type: ${entry.type || 'general'}
tags: ${JSON.stringify(entry.tags || [])}
project: ${entry.project || 'global'}
---

## Abstract (L0)
${layers.abstract}

## Overview (L1)
${layers.overview}

## Content (L2)
${entry.content}
`;
    
    await fs.writeFile(entryFile, content, 'utf8');
    return { entryId, filePath: entryFile };
  },

  updateDayOverview: async (dayDir, entry, layers) => {
    const overviewFile = path.join(dayDir, '.overview.md');
    let overview = '';
    
    try {
      overview = await fs.readFile(overviewFile, 'utf8');
    } catch {
      overview = '# Day Overview\n\n';
    }
    
    const entrySummary = `- [${entry.type || 'general'}] ${layers.abstract}\n`;
    overview += entrySummary;
    
    await fs.writeFile(overviewFile, overview, 'utf8');
    return overviewFile;
  },

  updateMemoryIndex: async (entry, layers, filePath) => {
    const memoryFile = path.join(MEMORY_DIR, 'MEMORY.md');
    let index = '';
    
    try {
      index = await fs.readFile(memoryFile, 'utf8');
    } catch {
      index = '# Memory Index\n\n## Timeline Entries\n\n';
    }
    
    const entryLine = `- ${layers.abstract} → ${filePath}\n`;
    
    // Keep index under 200 lines by removing oldest entries
    const lines = index.split('\n');
    if (lines.length > 195) {
      const headerEnd = lines.findIndex(l => l.startsWith('- '));
      if (headerEnd > 0) {
        lines.splice(headerEnd, lines.length - 195);
      }
    }
    
    lines.push(entryLine);
    await fs.writeFile(memoryFile, lines.join('\n'), 'utf8');
    return memoryFile;
  },

  getMemoryFiles: async () => {
    const files = [];
    
    // Add core files
    const coreDir = path.join(MEMORY_DIR, 'core');
    try {
      const coreFiles = await fs.readdir(coreDir);
      for (const f of coreFiles) {
        if (f.endsWith('.md')) {
          files.push({ path: path.join(coreDir, f), layer: 'L0' });
        }
      }
    } catch {}
    
    // Add MEMORY.md with L0
    files.push({ path: path.join(MEMORY_DIR, 'MEMORY.md'), layer: 'L0' });
    
    // Scan timeline (last 30 days)
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear().toString();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      
      const dayDir = path.join(TIMELINE_DIR, year, month, day);
      try {
        const entries = await fs.readdir(dayDir);
        for (const f of entries) {
          if (f.endsWith('.md') && !f.startsWith('.')) {
            files.push({ path: path.join(dayDir, f), layer: 'L2' });
          }
        }
      } catch {}
    }
    
    return files;
  }
};

describe('Phase A - Timeline Storage', () => {
  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('generateEntryId', () => {
    it('should generate unique entry IDs', () => {
      const id1 = mockPlugin.generateEntryId();
      const id2 = mockPlugin.generateEntryId();
      
      expect(id1).toMatch(/^entry-[a-z0-9]+-[a-z0-9]+$/);
      expect(id2).toMatch(/^entry-[a-z0-9]+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('writeToTimeline', () => {
    it('should create timeline directory structure', async () => {
      const entry = {
        content: 'Test content',
        type: 'test',
        tags: ['test', 'phase-a'],
        project: 'test-project'
      };
      const layers = {
        abstract: 'Test abstract',
        overview: 'Test overview'
      };
      
      const result = await mockPlugin.writeToTimeline(entry, layers);
      
      expect(result.entryId).toMatch(/^entry-/);
      expect(result.filePath).toContain('timeline');
      
      const content = await fs.readFile(result.filePath, 'utf8');
      expect(content).toContain('Test abstract');
      expect(content).toContain('Test overview');
      expect(content).toContain('Test content');
      expect(content).toContain('type: test');
    });
  });

  describe('updateDayOverview', () => {
    it('should update daily overview file', async () => {
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dayDir = path.join(TIMELINE_DIR, year, month, day);
      await fs.mkdir(dayDir, { recursive: true });
      
      const entry = { type: 'test', content: 'Test' };
      const layers = { abstract: 'Test entry summary' };
      
      await mockPlugin.updateDayOverview(dayDir, entry, layers);
      
      const overviewPath = path.join(dayDir, '.overview.md');
      const content = await fs.readFile(overviewPath, 'utf8');
      expect(content).toContain('Test entry summary');
    });
  });

  describe('updateMemoryIndex', () => {
    it('should keep index under 200 lines', async () => {
      const entry = { type: 'test', content: 'Test' };
      const layers = { abstract: 'Test entry' };
      const filePath = 'timeline/2026/03/19/test.md';
      
      // Add many entries
      for (let i = 0; i < 250; i++) {
        await mockPlugin.updateMemoryIndex(entry, layers, filePath);
      }
      
      const memoryFile = path.join(MEMORY_DIR, 'MEMORY.md');
      const content = await fs.readFile(memoryFile, 'utf8');
      const lines = content.split('\n');
      
      expect(lines.length).toBeLessThanOrEqual(200);
    });
  });

  describe('getMemoryFiles', () => {
    it('should return files with layer information', async () => {
      // Create test files
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dayDir = path.join(TIMELINE_DIR, year, month, day);
      await fs.mkdir(dayDir, { recursive: true });
      await fs.writeFile(path.join(dayDir, 'test-entry.md'), 'test', 'utf8');
      
      const files = await mockPlugin.getMemoryFiles();
      
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty('path');
      expect(files[0]).toHaveProperty('layer');
      expect(['L0', 'L1', 'L2']).toContain(files[0].layer);
    });
  });
});

describe('Phase A - End-to-End Workflow', () => {
  it('should complete full memory write workflow', async () => {
    const entry = {
      content: 'This is a test memory entry for Phase A',
      type: 'long-term',
      tags: ['test', 'phase-a', 'workflow'],
      project: '@longray/opencode-memory-plugin'
    };
    const layers = {
      abstract: 'Phase A test entry for timeline storage',
      overview: 'Testing the new timeline storage architecture with L0/L1/L2 layers'
    };
    
    // Write to timeline
    const { entryId, filePath } = await mockPlugin.writeToTimeline(entry, layers);
    expect(entryId).toBeTruthy();
    expect(filePath).toContain('timeline');
    
    // Update day overview
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dayDir = path.join(TIMELINE_DIR, year, month, day);
    await mockPlugin.updateDayOverview(dayDir, entry, layers);
    
    // Update memory index
    await mockPlugin.updateMemoryIndex(entry, layers, filePath);
    
    // Verify files exist
    const timelineContent = await fs.readFile(filePath, 'utf8');
    expect(timelineContent).toContain(layers.abstract);
    expect(timelineContent).toContain(layers.overview);
    expect(timelineContent).toContain(entry.content);
    
    const overviewPath = path.join(dayDir, '.overview.md');
    const overviewContent = await fs.readFile(overviewPath, 'utf8');
    expect(overviewContent).toContain(layers.abstract);
  });
});

// Run tests
console.log('Running Phase A test suite...');
