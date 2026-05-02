/**
 * Test Suite - Agent Frontmatter Schema
 * Validates agent .md frontmatter against expected schema and install.cjs consistency
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = resolve(__dirname, '../../../agents');
const INSTALL_CJS = resolve(__dirname, '../../../bin/install.cjs');

function parseFrontmatter(filePath) {
  const content = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new Error(`No frontmatter found in ${filePath}`);
  }

  const yaml = match[1];
  const frontmatter = {};
  const lines = yaml.split('\n');
  let lineIdx = 0;

  while (lineIdx < lines.length) {
    const trimmed = lines[lineIdx].trim();
    if (!trimmed || trimmed.startsWith('#')) {
      lineIdx++;
      continue;
    }

    if (trimmed.startsWith('- ')) {
      lineIdx++;
      continue;
    }

    const kvMatch = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kvMatch) {
      lineIdx++;
      continue;
    }

    const key = kvMatch[1];
    const value = kvMatch[2].trim().replace(/^['"]|['"]$/g, '');

    if (value === 'true') {
      frontmatter[key] = true;
      lineIdx++;
    } else if (value === 'false') {
      frontmatter[key] = false;
      lineIdx++;
    } else if (value === '') {
      const nested = {};
      lineIdx++;
      while (lineIdx < lines.length) {
        const raw = lines[lineIdx];
        const sub = raw.trim();
        if (!sub || sub.startsWith('#')) {
          lineIdx++;
          continue;
        }
        if (sub.startsWith('- ')) {
          lineIdx++;
          continue;
        }
        const subKv = sub.match(/^(\w[\w-]*):\s*(.*)$/);
        if (!subKv) {
          lineIdx++;
          continue;
        }
        const subVal = subKv[2].trim().replace(/^['"]|['"]$/g, '');
        if (subVal === 'true') nested[subKv[1]] = true;
        else if (subVal === 'false') nested[subKv[1]] = false;
        else if (subVal === '') {
          frontmatter[subKv[1]] = {};
          lineIdx++;
          break;
        } else {
          nested[subKv[1]] = subVal;
        }
        lineIdx++;
      }
      frontmatter[key] = nested;
    } else {
      frontmatter[key] = value;
      lineIdx++;
    }
  }

  return { frontmatter, content };
}

function getPromptContent(filePath) {
  const content = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1] : '';
}

function extractToolConfig(installCjsContent, agentName) {
  const normalized = installCjsContent.replace(/\r\n/g, '\n');
  const startPattern = `config.agent['${agentName}'] = {`;
  const startIdx = normalized.indexOf(startPattern);
  if (startIdx === -1) return null;

  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx + startPattern.length - 1; i < normalized.length; i++) {
    if (normalized[i] === '{') depth++;
    else if (normalized[i] === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) return null;

  const block = normalized.slice(startIdx, endIdx + 1);

  const descMatch = block.match(/description:\s*'([^']*)'/);
  const modeMatch = block.match(/mode:\s*'([^']*)'/);

  const toolsStart = block.indexOf('tools:');
  const tools = {};
  if (toolsStart !== -1) {
    let tDepth = 0;
    let tEnd = -1;
    for (let i = block.indexOf('{', toolsStart); i < block.length; i++) {
      if (block[i] === '{') tDepth++;
      else if (block[i] === '}') {
        tDepth--;
        if (tDepth === 0) {
          tEnd = i;
          break;
        }
      }
    }
    if (tEnd !== -1) {
      const toolsBlock = block.slice(block.indexOf('{', toolsStart) + 1, tEnd);
      for (const tl of toolsBlock.split('\n')) {
        const tm = tl.trim().match(/^(\w[\w-]*):\s*(true|false),?\s*$/);
        if (tm) tools[tm[1]] = tm[2] === 'true';
      }
    }
  }

  const permStart = block.indexOf('permission:');
  const permission = {};
  if (permStart !== -1) {
    let pDepth = 0;
    let pEnd = -1;
    for (let i = block.indexOf('{', permStart); i < block.length; i++) {
      if (block[i] === '{') pDepth++;
      else if (block[i] === '}') {
        pDepth--;
        if (pDepth === 0) {
          pEnd = i;
          break;
        }
      }
    }
    if (pEnd !== -1) {
      const permBlock = block.slice(block.indexOf('{', permStart) + 1, pEnd);
      for (const pl of permBlock.split('\n')) {
        const pm = pl.trim().match(/^(\w[\w-]*):\s*'([^']*)',?\s*$/);
        if (pm) permission[pm[1]] = pm[2];
      }
    }
  }

  return {
    description: descMatch ? descMatch[1] : undefined,
    mode: modeMatch ? modeMatch[1] : undefined,
    tools,
    permission,
  };
}

describe('Agent Frontmatter Schema', () => {
  const observerPath = resolve(AGENTS_DIR, 'memory-automation.md');
  const librarianPath = resolve(AGENTS_DIR, 'memory-consolidate.md');

  const observer = parseFrontmatter(observerPath);
  const librarian = parseFrontmatter(librarianPath);

  describe('Observer (memory-automation.md)', () => {
    it('should have required fields', () => {
      expect(observer.frontmatter).toHaveProperty('description');
      expect(observer.frontmatter).toHaveProperty('mode');
      expect(observer.frontmatter).toHaveProperty('model');
      expect(observer.frontmatter).toHaveProperty('tools');
    });

    it('should have mode = primary', () => {
      expect(observer.frontmatter.mode).toBe('primary');
    });

    it('should have a valid model specified', () => {
      expect(observer.frontmatter.model).toMatch(/\S+/);
      expect(observer.frontmatter.model).toContain('claude');
    });

    it('should have correct enabled tools', () => {
      const tools = observer.frontmatter.tools;
      expect(tools.memory_search).toBe(true);
      expect(tools.memory_suggest).toBe(true);
      expect(tools.memory_timeline).toBe(true);
      expect(tools.memory_topics).toBe(true);
    });

    it('should have bash/write/edit/read disabled', () => {
      const tools = observer.frontmatter.tools;
      expect(tools.bash).toBe(false);
      expect(tools.write).toBe(false);
      expect(tools.edit).toBe(false);
      expect(tools.read).toBe(false);
    });

    it('should NOT have memory_write', () => {
      const tools = observer.frontmatter.tools;
      expect(tools.memory_write).toBeUndefined();
    });

    it('should have non-empty description (>20 chars)', () => {
      expect(observer.frontmatter.description.length).toBeGreaterThan(20);
    });

    it('prompt should mention Atom', () => {
      const prompt = getPromptContent(observerPath);
      expect(prompt).toMatch(/Atom|atom/i);
    });

    it('prompt should contain markdown block templates', () => {
      const prompt = getPromptContent(observerPath);
      expect(prompt).toMatch(/```markdown/);
    });
  });

  describe('Librarian (memory-consolidate.md)', () => {
    it('should have required fields', () => {
      expect(librarian.frontmatter).toHaveProperty('description');
      expect(librarian.frontmatter).toHaveProperty('mode');
      expect(librarian.frontmatter).toHaveProperty('model');
      expect(librarian.frontmatter).toHaveProperty('tools');
    });

    it('should have mode = subagent', () => {
      expect(librarian.frontmatter.mode).toBe('subagent');
    });

    it('should have a valid model specified', () => {
      expect(librarian.frontmatter.model).toMatch(/\S+/);
      expect(librarian.frontmatter.model).toContain('claude');
    });

    it('should have correct enabled tools', () => {
      const tools = librarian.frontmatter.tools;
      expect(tools.memory_write).toBe(true);
      expect(tools.memory_read).toBe(true);
      expect(tools.memory_search).toBe(true);
      expect(tools.entity_update).toBe(true);
      expect(tools.incremental_sync).toBe(true);
    });

    it('should have bash/write/edit/read disabled', () => {
      const tools = librarian.frontmatter.tools;
      expect(tools.bash).toBe(false);
      expect(tools.write).toBe(false);
      expect(tools.edit).toBe(false);
      expect(tools.read).toBe(false);
    });

    it('should have non-empty description (>20 chars)', () => {
      expect(librarian.frontmatter.description.length).toBeGreaterThan(20);
    });

    it('prompt should mention Atom', () => {
      const prompt = getPromptContent(librarianPath);
      expect(prompt).toMatch(/Atom|atom/i);
    });
  });

  describe('Cross-agent consistency', () => {
    it('Observer does NOT have memory_write', () => {
      expect(observer.frontmatter.tools.memory_write).toBeUndefined();
    });

    it('Librarian DOES have memory_write', () => {
      expect(librarian.frontmatter.tools.memory_write).toBe(true);
    });

    it('Librarian has entity_update for Atom tree consolidation', () => {
      expect(librarian.frontmatter.tools.entity_update).toBe(true);
    });

    it('both agents have memory_search', () => {
      expect(observer.frontmatter.tools.memory_search).toBe(true);
      expect(librarian.frontmatter.tools.memory_search).toBe(true);
    });

    it('both agents have bash disabled', () => {
      expect(observer.frontmatter.tools.bash).toBe(false);
      expect(librarian.frontmatter.tools.bash).toBe(false);
    });
  });
});

describe('install.cjs consistency with agent .md files', () => {
  const installContent = readFileSync(INSTALL_CJS, 'utf8');

  it('install.cjs should exist and be readable', () => {
    expect(installContent.length).toBeGreaterThan(0);
  });

  describe('Observer config in install.cjs', () => {
    const agentConfig = extractToolConfig(installContent, 'memory-automation');

    it('should have memory-automation agent config', () => {
      expect(agentConfig).not.toBeNull();
    });

    it('should have mode = primary matching .md', () => {
      expect(agentConfig.mode).toBe('primary');
    });

    it('should have memory_search enabled', () => {
      expect(agentConfig.tools.memory_search).toBe(true);
    });

    it('should have memory_suggest enabled', () => {
      expect(agentConfig.tools.memory_suggest).toBe(true);
    });

    it('should have memory_timeline enabled', () => {
      expect(agentConfig.tools.memory_timeline).toBe(true);
    });

    it('should have memory_topics enabled', () => {
      expect(agentConfig.tools.memory_topics).toBe(true);
    });

    it('should have bash disabled', () => {
      expect(agentConfig.tools.bash).toBe(false);
    });

    it('should have write disabled', () => {
      expect(agentConfig.tools.write).toBe(false);
    });

    it('should have edit disabled', () => {
      expect(agentConfig.tools.edit).toBe(false);
    });

    it('should have read disabled', () => {
      expect(agentConfig.tools.read).toBe(false);
    });

    it('should NOT have memory_write enabled', () => {
      expect(agentConfig.tools.memory_write).not.toBe(true);
    });
  });

  describe('Librarian config in install.cjs', () => {
    const agentConfig = extractToolConfig(installContent, 'memory-consolidate');

    it('should have memory-consolidate agent config', () => {
      expect(agentConfig).not.toBeNull();
    });

    it('should have mode = subagent matching .md', () => {
      expect(agentConfig.mode).toBe('subagent');
    });

    it('should have memory_write enabled', () => {
      expect(agentConfig.tools.memory_write).toBe(true);
    });

    it('should have memory_read enabled', () => {
      expect(agentConfig.tools.memory_read).toBe(true);
    });

    it('should have memory_search enabled', () => {
      expect(agentConfig.tools.memory_search).toBe(true);
    });

    it('should have memory_suggest enabled', () => {
      expect(agentConfig.tools.memory_suggest).toBe(true);
    });

    it('should have memory_timeline enabled', () => {
      expect(agentConfig.tools.memory_timeline).toBe(true);
    });

    it('should have memory_topics enabled', () => {
      expect(agentConfig.tools.memory_topics).toBe(true);
    });

    it('should have memory_relate enabled', () => {
      expect(agentConfig.tools.memory_relate).toBe(true);
    });

    it('should have memory_graph enabled', () => {
      expect(agentConfig.tools.memory_graph).toBe(true);
    });

    it('should have memory_pin enabled', () => {
      expect(agentConfig.tools.memory_pin).toBe(true);
    });

    it('should have entity_update enabled', () => {
      expect(agentConfig.tools.entity_update).toBe(true);
    });

    it('should have incremental_sync enabled', () => {
      expect(agentConfig.tools.incremental_sync).toBe(true);
    });

    it('should have conflict_list enabled', () => {
      expect(agentConfig.tools.conflict_list).toBe(true);
    });

    it('should have conflict_resolve enabled', () => {
      expect(agentConfig.tools.conflict_resolve).toBe(true);
    });

    it('should have bash disabled', () => {
      expect(agentConfig.tools.bash).toBe(false);
    });

    it('should have write disabled', () => {
      expect(agentConfig.tools.write).toBe(false);
    });

    it('should have edit disabled', () => {
      expect(agentConfig.tools.edit).toBe(false);
    });

    it('should have read disabled', () => {
      expect(agentConfig.tools.read).toBe(false);
    });

    it('should NOT have deprecated tools', () => {
      expect(agentConfig.tools.list_daily).toBeUndefined();
      expect(agentConfig.tools.rebuild_index).toBeUndefined();
    });
  });
});
