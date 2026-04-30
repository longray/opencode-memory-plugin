import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs';
import { setupTestTempDir } from '../helpers/mock-constants.js';

describe('loadContextByBudget E2E', () => {
  let tempDir;
  let originalMemoryDir;
  let writeMemory, loadContextByBudget, estimateTokens;

  beforeAll(async () => {
    tempDir = setupTestTempDir('context-budget-e2e-');

    originalMemoryDir = process.env.MEMORY_DIR;
    process.env.MEMORY_DIR = tempDir;

    await jest.isolateModulesAsync(async () => {
      const core = await import('../../lib/memory-core.js');
      writeMemory = core.writeMemory;
      loadContextByBudget = core.loadContextByBudget;
      estimateTokens = core.estimateTokens;
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

  it('should select most relevant atoms within budget (relevance strategy)', async () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Introduction to Cooking',
        content: 'Cooking is the art of preparing food using heat and various ingredients.',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01ATOM002',
        source_id: '01ATOM002',
        atom_id: null,
        type: 'section',
        name: 'Baking Bread Details',
        content: 'Bread baking requires flour, water, yeast, and salt. Kneading develops gluten for structure.',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 2,
        parent_id: '01ATOM001',
        children: [],
      },
      {
        local_id: '01ATOM003',
        source_id: '01ATOM003',
        atom_id: null,
        type: 'section',
        name: 'Grilling Techniques',
        content: 'Grilling uses direct heat from below. Marinate meats for at least 30 minutes before grilling.',
        tags: [],
        aliases: [],
        order: 'aV',
        heading_level: 2,
        parent_id: '01ATOM001',
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Cooking guide',
      overview: 'A guide about cooking techniques',
      content: 'Cooking content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'baking bread kneading flour',
      maxTokens: 10000,
      strategy: 'relevance',
    });

    expect(result.success).toBe(true);
    expect(result.selected_count).toBeGreaterThan(0);
    expect(result.selected_count).toBeLessThanOrEqual(result.total_atoms);
    expect(result.used_tokens).toBeLessThanOrEqual(result.max_tokens);

    const selectedIds = result.selected_atoms.map(a => a.local_id);
    expect(selectedIds).toContain('01ATOM002');
  });

  it('should select atoms by hierarchy within budget (hierarchy strategy)', async () => {
    const atoms = [
      {
        local_id: '01CHAP001',
        source_id: '01CHAP001',
        atom_id: null,
        type: 'chapter',
        name: 'Chapter One Overview',
        content: 'This chapter covers the fundamentals of the system architecture and design patterns.',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01SEC001',
        source_id: '01SEC001',
        atom_id: null,
        type: 'section',
        name: 'System Design',
        content: 'System design involves choosing appropriate patterns and technologies for the problem.',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 2,
        parent_id: '01CHAP001',
        children: [],
      },
      {
        local_id: '01NOTE001',
        source_id: '01NOTE001',
        atom_id: null,
        type: 'note',
        name: 'Design Pattern Note',
        content: 'The observer pattern is useful for event-driven architectures.',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 3,
        parent_id: '01SEC001',
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Architecture guide',
      overview: 'System architecture and design patterns',
      content: 'Architecture content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const totalTokens = atoms.reduce((s, a) => s + Math.ceil(a.content.length / 4), 0);
    const tightBudget = Math.ceil(totalTokens * 0.4);

    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'design pattern observer event architecture',
      maxTokens: tightBudget,
      strategy: 'hierarchy',
    });

    expect(result.success).toBe(true);
    expect(result.selected_count).toBeGreaterThan(0);
    expect(result.used_tokens).toBeLessThanOrEqual(result.max_tokens);

    const selectedIds = result.selected_atoms.map(a => a.local_id);
    expect(selectedIds).toContain('01CHAP001');
  });

  it('should stop when budget is exhausted', async () => {
    const smallContent = 'Short note about baking.';
    const largeContent = 'This is a very long detailed explanation of grilling techniques. '.repeat(20);

    const atoms = [
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'Short Chapter',
        content: smallContent,
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01ATOM002',
        source_id: '01ATOM002',
        atom_id: null,
        type: 'section',
        name: 'Large Section',
        content: largeContent,
        tags: [],
        aliases: [],
        order: 'aV',
        heading_level: 2,
        parent_id: '01ATOM001',
        children: [],
      },
      {
        local_id: '01ATOM003',
        source_id: '01ATOM003',
        atom_id: null,
        type: 'section',
        name: 'Medium Section',
        content: 'Medium length content about a specific cooking technique.',
        tags: [],
        aliases: [],
        order: 'aV',
        heading_level: 2,
        parent_id: '01ATOM001',
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Budget test',
      overview: 'Testing budget exhaustion',
      content: 'Budget content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const smallTokens = estimateTokens(smallContent);
    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'cooking',
      maxTokens: smallTokens,
      strategy: 'relevance',
    });

    expect(result.success).toBe(true);
    expect(result.total_atoms).toBe(3);
    expect(result.selected_count).toBeLessThanOrEqual(1);
    expect(result.used_tokens).toBeLessThanOrEqual(result.max_tokens);
  });

  it('should return empty atoms for entry without atoms', async () => {
    const writeResult = await writeMemory({
      abstract: 'No atoms entry',
      overview: 'Entry without atoms',
      content: 'Plain content without atoms',
      type: 'memory',
      tags: ['test'],
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'test query',
      maxTokens: 1000,
      strategy: 'relevance',
    });

    expect(result.success).toBe(true);
    expect(result.selected_atoms).toEqual([]);
    expect(result.total_atoms).toBe(0);
    expect(result.used_tokens).toBe(0);
  });

  it('should return atoms sorted by original order', async () => {
    const atoms = [
      {
        local_id: '01ATOM003',
        source_id: '01ATOM003',
        atom_id: null,
        type: 'chapter',
        name: 'Third Chapter',
        content: 'Third chapter content about advanced topics.',
        tags: [],
        aliases: [],
        order: 'b0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01ATOM001',
        source_id: '01ATOM001',
        atom_id: null,
        type: 'chapter',
        name: 'First Chapter',
        content: 'First chapter content about basics.',
        tags: [],
        aliases: [],
        order: 'a0',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
      {
        local_id: '01ATOM002',
        source_id: '01ATOM002',
        atom_id: null,
        type: 'chapter',
        name: 'Second Chapter',
        content: 'Second chapter content about intermediate topics.',
        tags: [],
        aliases: [],
        order: 'aV',
        heading_level: 1,
        parent_id: null,
        children: [],
      },
    ];

    const writeResult = await writeMemory({
      abstract: 'Order test',
      overview: 'Testing sort order',
      content: 'Order content',
      type: 'memory',
      tags: ['test'],
      atoms,
      _source: 'test',
    });
    expect(writeResult.success).toBe(true);

    const result = await loadContextByBudget({
      entry_id: writeResult.localId,
      query: 'chapter content topics',
      maxTokens: 10000,
      strategy: 'relevance',
    });

    expect(result.success).toBe(true);
    expect(result.selected_count).toBe(3);

    expect(result.selected_atoms[0].local_id).toBe('01ATOM001');
    expect(result.selected_atoms[1].local_id).toBe('01ATOM002');
    expect(result.selected_atoms[2].local_id).toBe('01ATOM003');
  });
});
