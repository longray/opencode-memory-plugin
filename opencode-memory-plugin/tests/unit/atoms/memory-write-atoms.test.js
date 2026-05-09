/**
 * Tests for memory_write with atoms support
 * TDD for v3.3 Atom Architecture
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../../helpers/mock-constants.js';

describe('writeMemory with atoms', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory;

  beforeAll(async () => {
    tempDir = setupTestTempDir('memory-write-atoms-test-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../../lib/memory-core.js');
      writeMemory = core.writeMemory;
    });
  });

  afterAll(() => {
    if (originalMemoryDir === undefined) {
      delete process.env.MEMORY_DIR;
    } else {
      process.env.MEMORY_DIR = originalMemoryDir;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should write memory without atoms (backward compatible)', async () => {
    const result = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });

    expect(result.success).toBe(true);
    expect(result.filePath).toBeTruthy();

    const content = fs.readFileSync(result.filePath, 'utf-8');
    expect(content).toContain('# ≡≡≡ Abstract ≡≡≡');
    expect(content).toContain('Test abstract');
    expect(content).not.toContain('# ≡≡≡ Atoms ≡≡≡');
  });

  it('should write memory with atoms array', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const result = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(result.success).toBe(true);

    const content = fs.readFileSync(result.filePath, 'utf-8');
    expect(content).toContain('# ≡≡≡ Atoms ≡≡≡');
    expect(content).toContain('01ATOM001');
    expect(content).toContain('Chapter 1');
  });

  it('should write memory with nested atoms', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: ['chapter'],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [
          {
            local_id: '01ATOM002',
            source_id: '01ATOM002',
            atom_id: null,
            type: 'section',
            name: 'Section 1.1',
            content: 'Section content',
            tags: [],
            aliases: [],
            order: 'a0',
            heading_level: 2,
            parent_id: '01ATOM001',
            children: [],
          },
        ],
      },
    ];

    const result = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(result.success).toBe(true);

    const content = fs.readFileSync(result.filePath, 'utf-8');
    expect(content).toContain('01ATOM001');
    expect(content).toContain('01ATOM002');
    expect(content).toContain('Section 1.1');

    const atomsMatch = content.match(/```json\n([\s\S]*?)\n```/);
    expect(atomsMatch).toBeTruthy();
    const parsedAtoms = JSON.parse(atomsMatch[1]);
    expect(parsedAtoms).toHaveLength(1);
    expect(parsedAtoms[0].children).toHaveLength(1);
  });

  it('should reject atoms with circular reference', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter 1',
        content: 'Chapter content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: '01ATOM002',
        children: [],
      },
      {
        local_id: '01ATOM002',
        source_id: '01ATOM002',
        atom_id: null,
        type: 'section',
        name: 'Section 1.1',
        content: 'Section content',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 2,
        parent_id: '01ATOM001',
        children: [],
      },
    ];

    const result = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: atoms,
      _source: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Circular reference detected');
  });

  it('should handle empty atoms array', async () => {
    const result = await writeMemory({
      abstract: 'Test abstract',
      overview: 'Test overview',
      content: 'Test content',
      type: 'memory',
      tags: ['test'],
      atoms: [],
      _source: 'test',
    });

    expect(result.success).toBe(true);

    const content = fs.readFileSync(result.filePath, 'utf-8');
    expect(content).toContain('# ≡≡≡ Atoms ≡≡≡');
    expect(content).toContain('[]');
  });
});
