import { jest } from '@jest/globals';
import { LINK_MAP_VERSION } from '../lib/constants.js';

jest.unstable_mockModule('@opencode-ai/plugin/tool', () => ({
  tool: config => ({
    execute: config.execute,
    schema: config.args,
    description: config.description,
  }),
}));

jest.unstable_mockModule('@opencode-ai/plugin/tool', () => {
  const mockSchema = {
    string: () => mockSchema,
    boolean: () => mockSchema,
    number: () => mockSchema,
    array: () => mockSchema,
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

jest.unstable_mockModule('../lib/indexer.js', () => ({
  atomicWriteJson: jest.fn(),
  withLinkMapLock: jest.fn(fn => fn()),
}));

jest.unstable_mockModule('../lib/constants.js', () => ({
  LINK_MAP_FILE: '/tmp/test-link-map.json',
  MEMORY_DIR: '/tmp/test-memory',
}));

jest.unstable_mockModule('../lib/memory-core.js', () => ({
  writeAndSyncMemory: jest.fn(),
  readMemory: jest.fn(),
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getConfig: jest.fn(() => ({})),
  resolveTenantId: jest.fn(() => 'default'),
  getLinkMap: jest.fn(() => ({
    version: LINK_MAP_VERSION,
    entries: {
      'test-id-123': {
        id: 'test-id-123',
        path: 'timeline/2026/01/01/test-id-123.md',
        pinned: false,
      },
    },
  })),
}));

jest.unstable_mockModule('../lib/wrapper-client.js', () => ({
  getWrapperClient: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../lib/project-resolver.js', () => ({
  resolveProjectId: jest.fn(() => 'test-project'),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    copyFileSync: jest.fn(),
    unlinkSync: jest.fn(),
    renameSync: jest.fn(),
  },
  writeFileSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  renameSync: jest.fn(),
}));

describe('tools/core.js', () => {
  let memory_pin;
  let indexerMock;

  beforeAll(async () => {
    const core = await import('../tools/core.js');
    memory_pin = core.memory_pin;
    indexerMock = await import('../lib/indexer.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('memory_pin', () => {
    it('should return error if entry_id is missing', async () => {
      const result = await memory_pin.execute({ action: 'pin' });
      expect(result).toContain('❌ Error: entry_id is REQUIRED');
    });

    it('should return error if action is invalid', async () => {
      const result = await memory_pin.execute({ entry_id: 'test-id-123', action: 'invalid' });
      expect(result).toContain("❌ Error: action must be either 'pin' or 'unpin'");
    });

    it('should return error if entry_id is not found', async () => {
      const result = await memory_pin.execute({ entry_id: 'non-existent-id', action: 'pin' });
      expect(result).toContain("Failed to update memory entry 'non-existent-id'");
    });

    it('should pin an existing memory entry', async () => {
      const result = await memory_pin.execute({ entry_id: 'test-id-123', action: 'pin' });
      expect(result).toContain("✅ Successfully pinned memory entry 'test-id-123'");
      expect(indexerMock.atomicWriteJson).toHaveBeenCalledTimes(1);

      const writeArgs = indexerMock.atomicWriteJson.mock.calls[0];
      expect(writeArgs[0]).toContain('link-map');
      expect(writeArgs[1].entries['test-id-123'].pinned).toBe(true);
    });

    it('should unpin an existing memory entry', async () => {
      const result = await memory_pin.execute({ entry_id: 'test-id-123', action: 'unpin' });
      expect(result).toContain("✅ Successfully unpinned memory entry 'test-id-123'");
      expect(indexerMock.atomicWriteJson).toHaveBeenCalledTimes(1);

      const writeArgs = indexerMock.atomicWriteJson.mock.calls[0];
      expect(writeArgs[1].entries['test-id-123'].pinned).toBe(false);
    });

    it('should handle fs write errors', async () => {
      indexerMock.atomicWriteJson.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });
      const result = await memory_pin.execute({ entry_id: 'test-id-123', action: 'pin' });
      expect(result).toContain(
        "❌ Error: Failed to update memory entry 'test-id-123': Permission denied"
      );
    });
  });
});
