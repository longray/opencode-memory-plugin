/**
 * Tests for 4 new tool functions in tools/core.js:
 *   - entity_update
 *   - entity_atoms
 *   - load_context_budget
 *   - load_context_level
 *
 * These are tool-layer tests: they verify parameter validation,
 * correct delegation to lib functions, output formatting, and error handling.
 * The lib functions themselves are mocked.
 */

import { jest } from '@jest/globals';

// --- Mocks (must be hoisted before any dynamic imports) ---

jest.unstable_mockModule('@opencode-ai/plugin/tool', () => {
  const mockSchema = {
    string: () => mockSchema,
    boolean: () => mockSchema,
    number: () => mockSchema,
    array: () => mockSchema,
    object: () => mockSchema,
    describe: () => mockSchema,
    optional: () => mockSchema,
    default: () => mockSchema,
    min: () => mockSchema,
    max: () => mockSchema,
    positive: () => mockSchema,
  };

  return {
    tool: Object.assign(
      config => ({
        execute: config.execute,
        schema: config.args,
        description: config.description,
      }),
      { schema: mockSchema }
    ),
  };
});

const mockUpdateEntity = jest.fn();
const mockGetEntityAtoms = jest.fn();
const mockLoadContextByBudget = jest.fn();
const mockLoadContextByLevel = jest.fn();

jest.unstable_mockModule('../lib/memory-core.js', () => ({
  writeAndSyncMemory: jest.fn(),
  readMemory: jest.fn(),
  updateEntity: mockUpdateEntity,
  getEntityAtoms: mockGetEntityAtoms,
  loadContextByBudget: mockLoadContextByBudget,
  loadContextByLevel: mockLoadContextByLevel,
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getConfig: jest.fn(() => ({})),
  resolveTenantId: jest.fn(() => 'default'),
  getLinkMap: jest.fn(() => ({ version: '2.4.0', entries: {} })),
}));

jest.unstable_mockModule('../lib/wrapper-client.js', () => ({
  getWrapperClient: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../lib/project-resolver.js', () => ({
  resolveProjectId: jest.fn(() => 'test-project'),
}));

jest.unstable_mockModule('../lib/indexer.js', () => ({
  atomicWriteJson: jest.fn(),
  withLinkMapLock: jest.fn(fn => fn()),
}));

jest.unstable_mockModule('../lib/constants.js', () => ({
  LINK_MAP_FILE: '/tmp/link-map.json',
  LINK_MAP_VERSION: '2.4.0',
}));

// --- Test suites ---

describe('tools/core.js — atom tools', () => {
  let entity_update, entity_atoms, load_context_budget, load_context_level;

  beforeAll(async () => {
    const core = await import('../../../tools/core.js');
    entity_update = core.entity_update;
    entity_atoms = core.entity_atoms;
    load_context_budget = core.load_context_budget;
    load_context_level = core.load_context_level;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // entity_update
  // ============================================================
  describe('entity_update', () => {
    it('should return error when entry_id is missing', async () => {
      const result = await entity_update.execute({});
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should return error when entry_id is empty string', async () => {
      const result = await entity_update.execute({ entry_id: '' });
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should call updateEntity with correct params for entity field update', async () => {
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01TEST123',
        atoms_result: [],
      });

      const result = await entity_update.execute({
        entry_id: '01TEST123',
        entity_updates: { abstract: 'New abstract', tags: ['foo'] },
      });

      expect(mockUpdateEntity).toHaveBeenCalledTimes(1);
      expect(mockUpdateEntity).toHaveBeenCalledWith({
        entry_id: '01TEST123',
        entity_updates: { abstract: 'New abstract', tags: ['foo'] },
        atoms_batch: undefined,
        client: {},
      });
      expect(result).toContain('✅ Entity updated successfully');
      expect(result).toContain('01TEST123');
    });

    it('should pass meta field through to updateEntity', async () => {
      const metaValue = [{ key: 'value' }, { priority: 'high' }];
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01META01',
        atoms_result: [],
      });

      const result = await entity_update.execute({
        entry_id: '01META01',
        entity_updates: { abstract: 'Meta test', meta: metaValue },
      });

      expect(mockUpdateEntity).toHaveBeenCalledTimes(1);
      expect(mockUpdateEntity).toHaveBeenCalledWith({
        entry_id: '01META01',
        entity_updates: { abstract: 'Meta test', meta: metaValue },
        atoms_batch: undefined,
        client: {},
      });
      expect(result).toContain('✅ Entity updated successfully');
    });

    it('should pass content field through to updateEntity', async () => {
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01CONTENT01',
        atoms_result: [],
      });

      const result = await entity_update.execute({
        entry_id: '01CONTENT01',
        entity_updates: { content: 'Updated full content' },
      });

      expect(mockUpdateEntity).toHaveBeenCalledTimes(1);
      expect(mockUpdateEntity).toHaveBeenCalledWith({
        entry_id: '01CONTENT01',
        entity_updates: { content: 'Updated full content' },
        atoms_batch: undefined,
        client: {},
      });
      expect(result).toContain('✅ Entity updated successfully');
    });

    it('should call updateEntity with correct params for atoms_batch', async () => {
      const batch = [{ action: 'add', local_id: '01NEW', type: 'section', name: 'New Section' }];
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01TEST456',
        atoms_result: [{ action: 'add', local_id: '01NEW', success: true }],
      });

      const result = await entity_update.execute({
        entry_id: '01TEST456',
        atoms_batch: batch,
      });

      expect(mockUpdateEntity).toHaveBeenCalledWith({
        entry_id: '01TEST456',
        entity_updates: undefined,
        atoms_batch: batch,
        client: {},
      });
      expect(result).toContain('Atom operations: 1');
      expect(result).toContain('add: 01NEW ✓');
    });

    it('should display removed_count in output when present', async () => {
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01TEST789',
        atoms_result: [{ action: 'remove', local_id: '01OLD', success: true, removed_count: 3 }],
      });

      const result = await entity_update.execute({
        entry_id: '01TEST789',
        atoms_batch: [{ action: 'remove', local_id: '01OLD', cascade: true }],
      });

      expect(result).toContain('removed 3 atoms');
    });

    it('should display warnings when present', async () => {
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01TESTWARN',
        atoms_result: [],
        warnings: ['Atom 01ORPHAN has no parent', 'Duplicate order detected'],
      });

      const result = await entity_update.execute({ entry_id: '01TESTWARN' });

      expect(result).toContain('⚠️ Warnings:');
      expect(result).toContain('Atom 01ORPHAN has no parent');
      expect(result).toContain('Duplicate order detected');
    });

    it('should return error when updateEntity returns success=false', async () => {
      mockUpdateEntity.mockResolvedValue({
        success: false,
        error: 'Entity not found',
      });

      const result = await entity_update.execute({ entry_id: '01GHOST' });

      expect(result).toContain('❌ Error: Entity not found');
    });

    it('should handle unexpected exceptions gracefully', async () => {
      mockUpdateEntity.mockRejectedValue(new Error('DB connection lost'));

      const result = await entity_update.execute({ entry_id: '01TEST' });

      expect(result).toContain('❌ Error: Failed to update entity: DB connection lost');
    });

    it('should handle failed atom operations in batch', async () => {
      mockUpdateEntity.mockResolvedValue({
        success: true,
        entity_id: '01MIXED',
        atoms_result: [
          { action: 'add', local_id: '01OK', success: true },
          { action: 'update', local_id: '01FAIL', success: false },
        ],
      });

      const result = await entity_update.execute({
        entry_id: '01MIXED',
        atoms_batch: [
          { action: 'add', local_id: '01OK' },
          { action: 'update', local_id: '01FAIL' },
        ],
      });

      expect(result).toContain('01OK ✓');
      expect(result).toContain('01FAIL ✗');
    });
  });

  // ============================================================
  // entity_atoms
  // ============================================================
  describe('entity_atoms', () => {
    it('should return error when entry_id is missing', async () => {
      const result = await entity_atoms.execute({});
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should return error when entry_id is empty string', async () => {
      const result = await entity_atoms.execute({ entry_id: '' });
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should call getEntityAtoms with correct params', async () => {
      mockGetEntityAtoms.mockResolvedValue({
        success: true,
        entity_id: '01EATOMS',
        total_atoms: 2,
        tree: [
          {
            local_id: '01CHAP001',
            name: 'Chapter 1',
            type: 'chapter',
            children: [],
          },
        ],
      });

      await entity_atoms.execute({
        entry_id: '01EATOMS',
        include_content: true,
      });

      expect(mockGetEntityAtoms).toHaveBeenCalledTimes(1);
      expect(mockGetEntityAtoms).toHaveBeenCalledWith({
        entry_id: '01EATOMS',
        include_content: true,
      });
    });

    it('should return JSON with entity_id, total_atoms, and tree', async () => {
      const tree = [
        {
          local_id: '01CHAP001',
          name: 'Chapter 1',
          type: 'chapter',
          content: 'Content here',
          children: [{ local_id: '01SEC001', name: 'Section 1.1', type: 'section', children: [] }],
        },
      ];
      mockGetEntityAtoms.mockResolvedValue({
        success: true,
        entity_id: '01TREE01',
        total_atoms: 2,
        tree,
      });

      const result = await entity_atoms.execute({ entry_id: '01TREE01' });
      const parsed = JSON.parse(result);

      expect(parsed.entity_id).toBe('01TREE01');
      expect(parsed.total_atoms).toBe(2);
      expect(parsed.tree).toHaveLength(1);
      expect(parsed.tree[0].local_id).toBe('01CHAP001');
      expect(parsed.tree[0].children).toHaveLength(1);
    });

    it('should return empty tree when entity has no atoms', async () => {
      mockGetEntityAtoms.mockResolvedValue({
        success: true,
        entity_id: '01EMPTY01',
        total_atoms: 0,
        tree: [],
      });

      const result = await entity_atoms.execute({ entry_id: '01EMPTY01' });
      const parsed = JSON.parse(result);

      expect(parsed.total_atoms).toBe(0);
      expect(parsed.tree).toEqual([]);
    });

    it('should return error when entity not found', async () => {
      mockGetEntityAtoms.mockResolvedValue({
        success: false,
        error: 'Entity 01GHOST not found',
      });

      const result = await entity_atoms.execute({ entry_id: '01GHOST' });

      expect(result).toContain('❌ Error: Entity 01GHOST not found');
    });

    it('should handle unexpected exceptions gracefully', async () => {
      mockGetEntityAtoms.mockRejectedValue(new Error('File read error'));

      const result = await entity_atoms.execute({ entry_id: '01TEST' });

      expect(result).toContain('❌ Error: Failed to retrieve atoms: File read error');
    });
  });

  // ============================================================
  // load_context_budget
  // ============================================================
  describe('load_context_budget', () => {
    it('should return error when entry_id is missing', async () => {
      const result = await load_context_budget.execute({ query: 'test' });
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should return error when entry_id is empty string', async () => {
      const result = await load_context_budget.execute({ entry_id: '', query: 'test' });
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should return error when query is missing', async () => {
      const result = await load_context_budget.execute({ entry_id: '01TEST' });
      expect(result).toContain('❌ Error: query is REQUIRED');
    });

    it('should call loadContextByBudget with correct params', async () => {
      mockLoadContextByBudget.mockResolvedValue({
        success: true,
        selected_count: 3,
        total_atoms: 10,
        used_tokens: 800,
        max_tokens: 2000,
        budget_utilization: 40,
        strategy: 'relevance',
        selected_atoms: [
          {
            local_id: '01A',
            name: 'Atom A',
            type: 'chapter',
            heading_level: 1,
            relevance_score: 0.9,
            content: 'A content',
          },
          {
            local_id: '01B',
            name: 'Atom B',
            type: 'section',
            heading_level: 2,
            relevance_score: 0.7,
            content: 'B content',
          },
          {
            local_id: '01C',
            name: 'Atom C',
            type: 'note',
            heading_level: 3,
            relevance_score: 0.5,
            content: 'C content',
          },
        ],
      });

      await load_context_budget.execute({
        entry_id: '01BUDGET',
        query: 'reactive state management',
        max_tokens: 2000,
        strategy: 'relevance',
      });

      expect(mockLoadContextByBudget).toHaveBeenCalledTimes(1);
      expect(mockLoadContextByBudget).toHaveBeenCalledWith({
        entry_id: '01BUDGET',
        query: 'reactive state management',
        maxTokens: 2000,
        strategy: 'relevance',
      });
    });

    it('should return formatted output with atom details', async () => {
      mockLoadContextByBudget.mockResolvedValue({
        success: true,
        selected_count: 2,
        total_atoms: 5,
        used_tokens: 500,
        max_tokens: 1000,
        budget_utilization: 50,
        strategy: 'hierarchy',
        selected_atoms: [
          {
            local_id: '01A',
            name: 'Chapter One',
            type: 'chapter',
            heading_level: 1,
            relevance_score: 0.95,
            content: 'Chapter content here',
          },
          {
            local_id: '01B',
            name: 'Section 1.1',
            type: 'section',
            heading_level: 2,
            relevance_score: 0.8,
            content: 'Section content here',
          },
        ],
      });

      const result = await load_context_budget.execute({
        entry_id: '01FMT',
        query: 'test query',
        max_tokens: 1000,
      });

      expect(result).toContain('✅ Context loaded: 2/5 atoms');
      expect(result).toContain('Tokens: 500/1000 (50% utilization)');
      expect(result).toContain('Strategy: hierarchy');
      expect(result).toContain('[[01A]] Chapter One');
      expect(result).toContain('[[01B]] Section 1.1');
    });

    it('should handle atoms with no content (0 tokens)', async () => {
      mockLoadContextByBudget.mockResolvedValue({
        success: true,
        selected_count: 1,
        total_atoms: 1,
        used_tokens: 0,
        max_tokens: 2000,
        budget_utilization: 0,
        strategy: 'relevance',
        selected_atoms: [
          {
            local_id: '01NOCT',
            name: 'No Content Atom',
            type: 'chapter',
            heading_level: 1,
            relevance_score: 0.5,
            content: '',
          },
        ],
      });

      const result = await load_context_budget.execute({
        entry_id: '01NOCT',
        query: 'test',
      });

      expect(result).toContain('[[01NOCT]] No Content Atom (0t)');
    });

    it('should return error when loadContextByBudget returns success=false', async () => {
      mockLoadContextByBudget.mockResolvedValue({
        success: false,
        error: 'Entity 01MISSING not found',
      });

      const result = await load_context_budget.execute({
        entry_id: '01MISSING',
        query: 'test',
      });

      expect(result).toContain('❌ Error: Entity 01MISSING not found');
    });

    it('should handle unexpected exceptions gracefully', async () => {
      mockLoadContextByBudget.mockRejectedValue(new Error('Network timeout'));

      const result = await load_context_budget.execute({
        entry_id: '01ERR',
        query: 'test',
      });

      expect(result).toContain('❌ Error: Failed to load context: Network timeout');
    });
  });

  // ============================================================
  // load_context_level
  // ============================================================
  describe('load_context_level', () => {
    it('should return error when entry_id is missing', async () => {
      const result = await load_context_level.execute({});
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should return error when entry_id is empty string', async () => {
      const result = await load_context_level.execute({ entry_id: '' });
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should call loadContextByLevel with correct params', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: true,
        max_level: 2,
        filtered_count: 3,
        total_atoms: 10,
        markdown: '# Chapter 1\n\n## Section 1.1',
      });

      await load_context_level.execute({
        entry_id: '01LVL',
        max_level: 2,
        include_breadcrumbs: true,
      });

      expect(mockLoadContextByLevel).toHaveBeenCalledTimes(1);
      expect(mockLoadContextByLevel).toHaveBeenCalledWith({
        entry_id: '01LVL',
        maxLevel: 2,
        includeBreadcrumbs: true,
      });
    });

    it('should return formatted output with markdown', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: true,
        max_level: 1,
        filtered_count: 2,
        total_atoms: 8,
        markdown:
          '# Vue3 Composition API\nVue3 modern approach.\n\n# Pinia State Management\nPinia overview.',
      });

      const result = await load_context_level.execute({
        entry_id: '01MD',
        max_level: 1,
      });

      expect(result).toContain('✅ Context (level ≤1): 2/8 atoms');
      expect(result).toContain('# Vue3 Composition API');
      expect(result).toContain('# Pinia State Management');
    });

    it('should show "(No atoms found)" when markdown is empty', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: true,
        max_level: 2,
        filtered_count: 0,
        total_atoms: 0,
        markdown: '',
      });

      const result = await load_context_level.execute({
        entry_id: '01NOATOMS',
      });

      expect(result).toContain('✅ Context (level ≤2): 0/0 atoms');
      expect(result).toContain('(No atoms found)');
    });

    it('should handle markdown being undefined/null', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: true,
        max_level: 2,
        filtered_count: 0,
        total_atoms: 0,
        markdown: null,
      });

      const result = await load_context_level.execute({
        entry_id: '01NULLMD',
      });

      expect(result).toContain('(No atoms found)');
    });

    it('should return error when loadContextByLevel returns success=false', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: false,
        error: 'maxLevel must be between 1 and 6',
      });

      const result = await load_context_level.execute({
        entry_id: '01BAD',
        max_level: 10,
      });

      expect(result).toContain('❌ Error: maxLevel must be between 1 and 6');
    });

    it('should return error when entity not found', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: false,
        error: 'Entity 01GHOST not found',
      });

      const result = await load_context_level.execute({
        entry_id: '01GHOST',
      });

      expect(result).toContain('❌ Error: Entity 01GHOST not found');
    });

    it('should handle unexpected exceptions gracefully', async () => {
      mockLoadContextByLevel.mockRejectedValue(new Error('Disk full'));

      const result = await load_context_level.execute({
        entry_id: '01ERR',
      });

      expect(result).toContain('❌ Error: Failed to load context by level: Disk full');
    });

    it('should pass default max_level when not provided', async () => {
      mockLoadContextByLevel.mockResolvedValue({
        success: true,
        max_level: 2,
        filtered_count: 0,
        total_atoms: 0,
        markdown: '',
      });

      await load_context_level.execute({ entry_id: '01DEFAULT' });

      expect(mockLoadContextByLevel).toHaveBeenCalledWith(
        expect.objectContaining({
          maxLevel: undefined,
          includeBreadcrumbs: undefined,
        })
      );
    });
  });
});
