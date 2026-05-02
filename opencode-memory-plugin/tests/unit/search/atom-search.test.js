import { jest } from '@jest/globals';

const mockSchema = {
  string: () => mockSchema,
  number: () => mockSchema,
  array: () => mockSchema,
  describe: () => mockSchema,
  optional: () => mockSchema,
  default: () => mockSchema,
};

jest.unstable_mockModule('@opencode-ai/plugin/tool', () => ({
  tool: Object.assign(
    config => ({
      execute: config.execute,
      schema: config.args,
      description: config.description,
    }),
    { schema: mockSchema }
  ),
}));

let mockSearchFn;
jest.unstable_mockModule('../lib/wrapper-client.js', () => ({
  getWrapperClient: jest.fn(() => ({ search: (...args) => mockSearchFn(...args) })),
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getConfig: jest.fn(() => ({ backend: { enabled: true } })),
  resolveTenantId: jest.fn(() => 'default'),
}));

jest.unstable_mockModule('../lib/trie-index.js', () => ({
  getAutocompleteSuggestions: jest.fn(() => []),
}));

jest.unstable_mockModule('../lib/constants.js', () => ({
  MEMORY_DIR: '/tmp/test-memory',
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn(() => false),
    readFileSync: jest.fn(),
  },
  existsSync: jest.fn(() => false),
  readFileSync: jest.fn(),
}));

jest.unstable_mockModule('path', () => {
  const pathMock = {
    join: (...parts) => parts.join('/'),
  };
  pathMock.default = pathMock;
  return pathMock;
});

describe('tools/search.js atom scope', () => {
  let memory_search;
  let mockGetConfig;
  let mockResolveTenantId;

  beforeAll(async () => {
    const searchMod = await import('../../../tools/search.js');
    memory_search = searchMod.memory_search;
    const storageMod = await import('../../../lib/storage.js');
    mockGetConfig = storageMod.getConfig;
    mockResolveTenantId = storageMod.resolveTenantId;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue({ backend: { enabled: true } });
    mockResolveTenantId.mockReturnValue('default');
  });

  describe('scope: "atom" passes to backend', () => {
    it('should include scope=atom in search params', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({ results: [] });

      await memory_search.execute({
        query: 'setup function',
        scope: 'atom',
      });

      expect(mockSearchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'atom',
          query: 'setup function',
        })
      );
    });

    it('should include atom_types when provided', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({ results: [] });

      await memory_search.execute({
        query: 'render',
        scope: 'atom',
        atom_types: ['function', 'class'],
      });

      expect(mockSearchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'atom',
          atom_types: ['function', 'class'],
        })
      );
    });

    it('should not include atom_types when empty array', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({ results: [] });

      await memory_search.execute({
        query: 'test',
        scope: 'atom',
      });

      const callArgs = mockSearchFn.mock.calls[0][0];
      expect(callArgs.atom_types).toBeUndefined();
    });
  });

  describe('scope: "atom" with backend unavailable', () => {
    it('should return error message when backend fails', async () => {
      mockSearchFn = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await memory_search.execute({
        query: 'test',
        scope: 'atom',
      });

      expect(result).toContain('Atom scope search requires backend');
    });

    it('should return error message when backend is disabled', async () => {
      mockGetConfig.mockReturnValue({ backend: { enabled: false } });

      const result = await memory_search.execute({
        query: 'test',
        scope: 'atom',
      });

      expect(result).toContain('Atom scope search requires backend');
    });
  });

  describe('Atom result formatting', () => {
    it('should format atom results with atom_type and entity reference', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({
        results: [
          {
            type: 'atom',
            atom_type: 'function',
            local_id: '01FN001',
            entity_id: '01EN001',
            name: 'setup()',
            content: 'Entry point for Composition API',
          },
        ],
      });

      const result = await memory_search.execute({
        query: 'setup',
        scope: 'atom',
        level: 0,
      });

      expect(result).toContain('[atom:function]');
      expect(result).toContain('setup()');
      expect(result).toContain('01FN001');
      expect(result).toContain('(in 01EN001)');
    });

    it('should show content at level >= 1', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({
        results: [
          {
            type: 'atom',
            atom_type: 'section',
            local_id: '01SC001',
            name: 'Reactivity',
            content: 'Detailed content about Vue reactivity system',
          },
        ],
      });

      const result = await memory_search.execute({
        query: 'reactivity',
        scope: 'atom',
        level: 1,
      });

      expect(result).toContain('Detailed content about Vue reactivity');
    });

    it('should use entity type label for non-atom results', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({
        results: [
          {
            type: 'memory',
            id: '01EN002',
            abstract: 'Vue best practices',
          },
        ],
      });

      const result = await memory_search.execute({
        query: 'vue',
        scope: 'all',
        level: 0,
      });

      expect(result).toContain('[memory]');
      expect(result).toContain('Vue best practices');
    });
  });

  describe('Default scope behavior', () => {
    it('should default scope to "all" when not provided', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({ results: [] });

      await memory_search.execute({
        query: 'test',
      });

      expect(mockSearchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'all',
        })
      );
    });

    it('should default mode to "hybrid" when not provided', async () => {
      mockSearchFn = jest.fn().mockResolvedValue({ results: [] });

      await memory_search.execute({
        query: 'test',
      });

      expect(mockSearchFn).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'hybrid',
        })
      );
    });
  });
});
