/**
 * Test Suite - AnalysisQueue Core
 * Coverage: detectLanguage, generateAbstract, generateOverview, add, processItem, rollbackAtoms
 * Mock: 9 modules (storage, wrapper-client, precompute/client, fingerprint-cache,
 *       memory-id-cache, code-analyzer, privacy-filter, project-resolver, fs)
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../lib/storage.js', () => ({
  getConfig: jest.fn().mockReturnValue({ code_analysis: {} }),
}));

jest.unstable_mockModule('../lib/wrapper-client.js', () => ({
  WrapperClient: jest.fn().mockImplementation(() => ({
    tenantId: 'test-tenant',
    createAtom: jest.fn().mockResolvedValue({ id: 'atom:1' }),
    createEntity: jest.fn().mockResolvedValue({ id: 'entity:1' }),
    createReference: jest.fn().mockResolvedValue({ id: 'ref:1' }),
    deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    uploadMemories: jest.fn().mockResolvedValue({ success: 1, total: 1 }),
  })),
}));

jest.unstable_mockModule('../lib/precompute/client.js', () => ({
  getPrecomputeClient: jest.fn().mockReturnValue({
    uploadAnalysisBatch: jest.fn().mockResolvedValue({ success: 1, total: 1 }),
  }),
}));

jest.unstable_mockModule('../lib/precompute/fingerprint-cache.js', () => ({
  FingerprintCache: jest.fn().mockImplementation(() => ({
    hasChanged: jest.fn().mockReturnValue({ changed: true }),
    set: jest.fn(),
    getSymbolsHash: jest.fn().mockReturnValue('hash123'),
  })),
}));

jest.unstable_mockModule('../lib/memory-id-cache.js', () => ({
  MemoryIdCache: jest.fn().mockImplementation(() => ({
    load: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(true),
    set: jest.fn().mockResolvedValue(undefined),
    getMemoryId: jest.fn().mockResolvedValue(null),
    getSourceId: jest.fn().mockResolvedValue(null),
    generateSourceId: jest.fn().mockReturnValue('local-test-id'),
  })),
}));

jest.unstable_mockModule('../lib/code-analyzer.js', () => ({
  codeAnalyzer: {
    analyze: jest.fn().mockResolvedValue({
      language: 'javascript',
      functions: [
        {
          name: 'test',
          start_line: 1,
          end_line: 5,
          params: [],
          is_exported: false,
          is_async: false,
        },
      ],
      classes: [],
      imports: [],
      calls: [],
      complexity_metrics: { cyclomatic: 1, max_nesting_depth: 1, lines_of_code: 5 },
      quality_score: { score: 90, grade: 'A' },
    }),
  },
}));

jest.unstable_mockModule('../lib/privacy-filter.js', () => ({
  shouldSkipFile: jest.fn().mockReturnValue({ skip: false }),
}));

jest.unstable_mockModule('../lib/project-resolver.js', () => ({
  resolveProjectId: jest.fn().mockResolvedValue('test-project'),
}));

jest.unstable_mockModule('../lib/tree-sitter-parser.js', () => ({
  analyzeWithQuery: jest.fn().mockResolvedValue({
    language: 'javascript',
    functions: [],
    classes: [],
    calls: [],
    complexity_metrics: {},
  }),
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    readFileSync: jest.fn().mockReturnValue('function test() {}'),
    existsSync: jest.fn().mockReturnValue(true),
    writeFileSync: jest.fn(),
    statSync: jest.fn().mockReturnValue({ size: 100 }),
  },
  readFileSync: jest.fn().mockReturnValue('function test() {}'),
  existsSync: jest.fn().mockReturnValue(true),
  writeFileSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 100 }),
}));

jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue('function test() {}'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
}));

const { AnalysisQueue } = await import('../lib/code-analysis-service.js');
const { shouldSkipFile } = await import('../lib/privacy-filter.js');
const { codeAnalyzer } = await import('../lib/code-analyzer.js');
const fsModule = await import('fs');
const { readFile: readFileMock } = await import('fs/promises');

// ===== detectLanguage =====

describe('detectLanguage', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  it('.js → javascript', () => {
    expect(queue.detectLanguage('src/foo.js')).toBe('javascript');
  });

  it('.mjs / .cjs → javascript (同族)', () => {
    expect(queue.detectLanguage('src/foo.mjs')).toBe('javascript');
    expect(queue.detectLanguage('src/foo.cjs')).toBe('javascript');
  });

  it('.ts / .tsx → typescript', () => {
    expect(queue.detectLanguage('src/foo.ts')).toBe('typescript');
    expect(queue.detectLanguage('src/foo.tsx')).toBe('typescript');
  });

  it('.py / .go / .rs / .java → 各自语言', () => {
    expect(queue.detectLanguage('src/foo.py')).toBe('python');
    expect(queue.detectLanguage('src/foo.go')).toBe('go');
    expect(queue.detectLanguage('src/foo.rs')).toBe('rust');
    expect(queue.detectLanguage('src/Foo.java')).toBe('java');
  });

  it('未知扩展名 → unknown', () => {
    expect(queue.detectLanguage('src/foo.xyz')).toBe('unknown');
    expect(queue.detectLanguage('src/Makefile')).toBe('unknown');
  });
});

// ===== generateAbstract =====

describe('generateAbstract', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  it('有函数 + 类 → 标准格式', () => {
    const result = {
      language: 'javascript',
      functions: [{ name: 'a' }, { name: 'b' }],
      classes: [{ name: 'C' }],
    };
    expect(queue.generateAbstract('src/utils.js', result)).toBe(
      'javascript file: src/utils.js (2 functions, 1 classes)'
    );
  });

  it('无函数无类 → 0 计数', () => {
    const result = { language: 'python', functions: [], classes: [] };
    expect(queue.generateAbstract('src/main.py', result)).toBe(
      'python file: src/main.py (0 functions, 0 classes)'
    );
  });

  it('null/undefined functions/classes → 防御性 0 计数', () => {
    const result = { language: 'javascript' };
    expect(queue.generateAbstract('src/empty.js', result)).toBe(
      'javascript file: src/empty.js (0 functions, 0 classes)'
    );
  });
});

// ===== generateOverview =====

describe('generateOverview', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  it('正常结果 → 4 行格式', () => {
    const result = {
      complexity_metrics: { lines_of_code: 100, cyclomatic: 5 },
      functions: [{ name: 'a' }, { name: 'b' }],
      classes: [{ name: 'C' }],
    };
    const output = queue.generateOverview('src/utils.js', result);
    expect(output).toContain('File: src/utils.js');
    expect(output).toContain('Lines: 100');
    expect(output).toContain('Functions: a, b');
    expect(output).toContain('Classes: C');
    expect(output).toContain('Complexity: 5');
  });

  it('超过 5 函数 → 静默截断只取前 5', () => {
    const funcs = Array(8)
      .fill(0)
      .map((_, i) => ({ name: `f${i}` }));
    const result = { complexity_metrics: {}, functions: funcs, classes: [] };
    const output = queue.generateOverview('src/big.js', result);
    expect(output).toContain('f0, f1, f2, f3, f4');
    expect(output).not.toContain('f5');
  });

  it('超过 3 类 → 静默截断只取前 3', () => {
    const classes = Array(5)
      .fill(0)
      .map((_, i) => ({ name: `C${i}` }));
    const result = { complexity_metrics: {}, functions: [], classes };
    const output = queue.generateOverview('src/big.js', result);
    expect(output).toContain('C0, C1, C2');
    expect(output).not.toContain('C3');
  });
});

// ===== add =====

describe('add', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    queue.debouncedProcess = jest.fn();
  });

  it('正常入队 → queue.length === 1', () => {
    queue.add('/project/src/test.js', '/project');
    expect(queue.queue).toHaveLength(1);
    expect(queue.queue[0].filePath).toBe('/project/src/test.js');
    expect(queue.queue[0].relativePath).toMatch(/src[\\/]test\.js/);
  });

  it('排除文件 → 不入队', () => {
    shouldSkipFile.mockReturnValueOnce({ skip: true, reason: 'excluded_file' });
    queue.add('/project/.env', '/project');
    expect(queue.queue).toHaveLength(0);
  });

  it('不支持扩展名 → 不入队', () => {
    queue.add('/project/readme.txt', '/project');
    expect(queue.queue).toHaveLength(0);
  });

  it('重复文件 → 去重（替换旧条目）', () => {
    queue.add('/project/src/a.js', '/project');
    queue.add('/project/src/a.js', '/project');
    expect(queue.queue).toHaveLength(1);
  });

  it('队列溢出 (MAX_QUEUE_SIZE=10) → shift 最旧', () => {
    for (let i = 0; i < 11; i++) {
      queue.add(`/project/src/f${i}.js`, '/project');
    }
    expect(queue.queue).toHaveLength(10);
    expect(queue.queue[0].filePath).toBe('/project/src/f1.js');
  });
});

// ===== processItem =====

  describe('processItem', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    queue.initCache = jest.fn();
    queue.fingerprintCache = {
      hasChanged: jest.fn().mockReturnValue({ changed: true }),
      set: jest.fn(),
      getSymbolsHash: jest.fn().mockReturnValue('hash123'),
    };
    queue.memoryIdCache = { set: jest.fn() };
    queue.wrapperClient = {
      tenantId: 'test-tenant',
      createAtom: jest.fn().mockResolvedValue({ id: 'atom:1' }),
      createEntity: jest.fn().mockResolvedValue({ id: 'entity:1' }),
      createReference: jest.fn().mockResolvedValue({ id: 'ref:1' }),
      deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    };
    queue.concurrentCount = 0;
    readFileMock.mockResolvedValue('function test() {}');
  });

  afterEach(() => {
    queue.processing.clear();
  });

  it('文件不存在 (ENOENT) → 不抛异常', async () => {
    const err = new Error('ENOENT');
    err.code = 'ENOENT';
    readFileMock.mockRejectedValueOnce(err);

    await expect(
      queue.processItem({
        filePath: '/project/deleted.js',
        relativePath: 'deleted.js',
        projectRoot: '/project',
      })
    ).resolves.not.toThrow();
  });

  it('文件含敏感内容 → 跳过分析', async () => {
    shouldSkipFile.mockReturnValueOnce({ skip: true, reason: 'sensitive_content' });

    await queue.processItem({
      filePath: '/project/secret.js',
      relativePath: 'secret.js',
      projectRoot: '/project',
    });

    expect(codeAnalyzer.analyze).not.toHaveBeenCalled();
  });

  it('指纹未变 → 跳过分析', async () => {
    queue.fingerprintCache.hasChanged.mockReturnValueOnce({ changed: false });

    await queue.processItem({
      filePath: '/project/unchanged.js',
      relativePath: 'unchanged.js',
      projectRoot: '/project',
    });

    expect(codeAnalyzer.analyze).not.toHaveBeenCalled();
  });

  it('正常流程 → 调用 codeAnalyzer + uploadAsAtomEntity', async () => {
    const uploadSpy = jest.spyOn(queue, 'uploadAsAtomEntity').mockResolvedValue({
      atoms: [{ id: 'atom:1' }],
      entity: { id: 'entity:1' },
      references: [],
      duration: 10,
    });

    await queue.processItem({
      filePath: '/project/src/test.js',
      relativePath: 'src/test.js',
      projectRoot: '/project',
    });

    expect(codeAnalyzer.analyze).toHaveBeenCalledWith('/project/src/test.js', expect.any(String));
    expect(uploadSpy).toHaveBeenCalled();

    uploadSpy.mockRestore();
  });
});

// ===== rollbackAtoms =====

describe('rollbackAtoms', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
    queue.wrapperClient = {
      tenantId: 'test',
      deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    };
  });

  it('全部成功删除 → deleteAtom 调用 N 次', async () => {
    const atoms = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    await queue.rollbackAtoms(atoms);
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledTimes(3);
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledWith('a1');
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledWith('a2');
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledWith('a3');
  });

  it('部分删除失败 → 继续删除剩余，不抛异常', async () => {
    queue.wrapperClient.deleteAtom
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });

    const atoms = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    await expect(queue.rollbackAtoms(atoms)).resolves.not.toThrow();
    expect(queue.wrapperClient.deleteAtom).toHaveBeenCalledTimes(3);
  });
});
