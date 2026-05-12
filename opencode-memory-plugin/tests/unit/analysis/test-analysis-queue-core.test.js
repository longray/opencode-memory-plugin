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
    createReferences: jest.fn().mockResolvedValue({ references: [{ id: 'ref:1' }] }),
    deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    uploadMemories: jest.fn().mockResolvedValue({ success: 1, total: 1 }),
  })),
  getWrapperClient: jest.fn().mockReturnValue({
    tenantId: 'test-tenant',
    createAtom: jest.fn().mockResolvedValue({ id: 'atom:1' }),
    createEntity: jest.fn().mockResolvedValue({ id: 'entity:1' }),
    createReferences: jest.fn().mockResolvedValue({ references: [{ id: 'ref:1' }] }),
    deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    uploadMemories: jest.fn().mockResolvedValue({ success: 1, total: 1 }),
  }),
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

jest.unstable_mockModule('../lib/code-analyzer.js', () => {
  const EXTENSION_TO_LANGUAGE = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
  };
  function getExt(filePath) {
    const idx = filePath.lastIndexOf('.');
    return idx > 0 ? filePath.slice(idx).toLowerCase() : '';
  }
  return {
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
    CodeAnalyzer: {
      detectLanguage: jest.fn().mockImplementation(filePath => {
        return EXTENSION_TO_LANGUAGE[getExt(filePath)] || 'unknown';
      }),
    },
  };
});

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

const { AnalysisQueue } = await import('../../../lib/code-analysis-service.js');
const { shouldSkipFile } = await import('../../../lib/privacy-filter.js');
const { codeAnalyzer, CodeAnalyzer } = await import('../../../lib/code-analyzer.js');
const { readFile: readFileMock } = await import('fs/promises');
const { getConfig: getConfigMock } = await import('../../../lib/storage.js');
const { getWrapperClient: getWrapperClientMock } = await import('../../../lib/wrapper-client.js');

// ===== detectLanguage =====

describe('detectLanguage', () => {
  it('.js → javascript', () => {
    expect(CodeAnalyzer.detectLanguage('src/foo.js')).toBe('javascript');
  });

  it('.mjs / .cjs → javascript (同族)', () => {
    expect(CodeAnalyzer.detectLanguage('src/foo.mjs')).toBe('javascript');
    expect(CodeAnalyzer.detectLanguage('src/foo.cjs')).toBe('javascript');
  });

  it('.ts / .tsx → typescript', () => {
    expect(CodeAnalyzer.detectLanguage('src/foo.ts')).toBe('typescript');
    expect(CodeAnalyzer.detectLanguage('src/foo.tsx')).toBe('typescript');
  });

  it('.py / .go / .rs / .java → 各自语言', () => {
    expect(CodeAnalyzer.detectLanguage('src/foo.py')).toBe('python');
    expect(CodeAnalyzer.detectLanguage('src/foo.go')).toBe('go');
    expect(CodeAnalyzer.detectLanguage('src/foo.rs')).toBe('rust');
    expect(CodeAnalyzer.detectLanguage('src/Foo.java')).toBe('java');
  });

  it('未知扩展名 → unknown', () => {
    expect(CodeAnalyzer.detectLanguage('src/foo.xyz')).toBe('unknown');
    expect(CodeAnalyzer.detectLanguage('src/Makefile')).toBe('unknown');
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
    getConfigMock.mockReturnValue({ code_analysis: {}, backend: { tenant_id: 'test-tenant' } });
    queue._clientTenant = 'test-tenant';
    queue._client = {
      tenantId: 'test-tenant',
      createAtom: jest.fn().mockResolvedValue({ id: 'atom:1' }),
      createEntity: jest.fn().mockResolvedValue({ id: 'entity:1' }),
      createReferences: jest.fn().mockResolvedValue({ references: [{ id: 'ref:1' }] }),
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
    jest.clearAllMocks();
    getConfigMock.mockReturnValue({ code_analysis: {}, backend: { tenant_id: 'test' } });
    queue = new AnalysisQueue();
    queue._clientTenant = 'test';
    queue._client = {
      tenantId: 'test',
      deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    };
  });

  it('全部成功删除 → deleteAtom 调用 N 次', async () => {
    const atoms = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    await queue.rollbackAtoms(atoms);
    expect(queue._client.deleteAtom).toHaveBeenCalledTimes(3);
    expect(queue._client.deleteAtom).toHaveBeenCalledWith('a1');
    expect(queue._client.deleteAtom).toHaveBeenCalledWith('a2');
    expect(queue._client.deleteAtom).toHaveBeenCalledWith('a3');
  });

  it('部分删除失败 → 继续删除剩余，不抛异常', async () => {
    queue._client.deleteAtom
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });

    const atoms = [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }];
    await expect(queue.rollbackAtoms(atoms)).resolves.not.toThrow();
    expect(queue._client.deleteAtom).toHaveBeenCalledTimes(3);
  });
});

// ===== H-2: Lazy config reads (not baked at module load) =====

describe('H-2: lazy config initialization', () => {
  let queue;

  beforeEach(() => {
    jest.clearAllMocks();
    getConfigMock.mockReturnValue({ code_analysis: { debounce_ms: 50 } });
    queue = new AnalysisQueue();
  });

  it('config change after construction is picked up by debouncedProcess', () => {
    getConfigMock.mockReturnValue({ code_analysis: { debounce_ms: 999 } });

    const spy = jest.spyOn(globalThis, 'setTimeout');
    queue.debouncedProcess();

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    expect(lastCall[1]).toBe(999);

    spy.mockRestore();
  });
});

// ===== H-4: Lazy client initialization (respects tenant_id changes) =====

describe('H-4: lazy client initialization', () => {
  function makeMockClient(tenantId) {
    return {
      tenantId,
      createAtom: jest.fn().mockResolvedValue({ id: 'atom:1' }),
      createEntity: jest.fn().mockResolvedValue({ id: 'entity:1' }),
      createReferences: jest.fn().mockResolvedValue({ references: [] }),
      deleteAtom: jest.fn().mockResolvedValue({ success: true }),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getConfigMock.mockReturnValue({ backend: { tenant_id: 'tenant-A' } });
    getWrapperClientMock.mockReturnValue(makeMockClient('tenant-A'));
  });

  it('client getter returns fresh client when tenant_id changes', () => {
    const queue = new AnalysisQueue();
    const client1 = queue.client;
    expect(client1.tenantId).toBe('tenant-A');

    getConfigMock.mockReturnValue({ backend: { tenant_id: 'tenant-B' } });
    getWrapperClientMock.mockReturnValue(makeMockClient('tenant-B'));

    const client2 = queue.client;
    expect(client2.tenantId).toBe('tenant-B');
    expect(getWrapperClientMock).toHaveBeenCalledWith(expect.objectContaining({ forceNew: true }));
  });

  it('client getter reuses client when tenant_id is unchanged', () => {
    const queue = new AnalysisQueue();
    const client1 = queue.client;
    const client2 = queue.client;

    expect(client1).toBe(client2);
    expect(getWrapperClientMock).toHaveBeenCalledTimes(1);
  });
});

// ===== Global Symbol Table & Auto Depends-On (Tasks 3.1-4.7) =====

describe('Global Symbol Table Extraction (Tasks 3.1-3.7)', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  it('extracts exported functions from AST analysis result', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [
        { name: 'foo', is_exported: true, start_line: 1, end_line: 5 },
        { name: 'bar', is_exported: true, start_line: 10, end_line: 15 },
        { name: 'internal', is_exported: false, start_line: 20, end_line: 25 },
      ],
      classes: [],
      imports: [],
      exports: [
        { name: 'foo', type: 'function' },
        { name: 'bar', type: 'function' },
      ],
      calls: [],
    };

    const symbolTable = queue.buildSymbolTable('src/utils.js', analysisResult, 'entity-utils');

    expect(symbolTable.functions.size).toBe(2);
    expect(symbolTable.functions.get('foo')).toBe('entity-utils');
    expect(symbolTable.functions.get('bar')).toBe('entity-utils');
    expect(symbolTable.functions.has('internal')).toBe(false);
  });

  it('extracts exported classes from AST analysis result', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [],
      classes: [
        { name: 'MyClass', start_line: 1, end_line: 20 },
        { name: 'Helper', start_line: 25, end_line: 40 },
      ],
      imports: [],
      exports: [{ name: 'MyClass', type: 'class' }],
      calls: [],
    };

    const symbolTable = queue.buildSymbolTable('src/models.js', analysisResult, 'entity-models');

    expect(symbolTable.classes.size).toBe(2);
    expect(symbolTable.classes.get('MyClass')).toBe('entity-models');
    expect(symbolTable.classes.get('Helper')).toBe('entity-models');
  });

  it('handles name collisions using file path as namespace', () => {
    const result1 = {
      language: 'javascript',
      functions: [{ name: 'utils', is_exported: true, start_line: 1, end_line: 5 }],
      classes: [],
      imports: [],
      exports: [{ name: 'utils', type: 'function' }],
      calls: [],
    };

    const result2 = {
      language: 'javascript',
      functions: [{ name: 'utils', is_exported: true, start_line: 1, end_line: 5 }],
      classes: [],
      imports: [],
      exports: [{ name: 'utils', type: 'function' }],
      calls: [],
    };

    const table1 = queue.buildSymbolTable('src/utils.js', result1, 'entity-1');
    const table2 = queue.buildSymbolTable('lib/utils.js', result2, 'entity-2');

    const globalTable = queue.mergeSymbolTables([table1, table2]);

    expect(globalTable.functions.get('utils')).toBeDefined();
    expect(globalTable.namespaced.get('src/utils.js::utils')).toBe('entity-1');
    expect(globalTable.namespaced.get('lib/utils.js::utils')).toBe('entity-2');
  });

  it('handles default exports', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [{ name: 'default', is_exported: true, start_line: 1, end_line: 10 }],
      classes: [],
      imports: [],
      exports: [{ name: 'default', type: 'function', is_default: true }],
      calls: [],
    };

    const symbolTable = queue.buildSymbolTable('src/index.js', analysisResult, 'entity-index');

    expect(symbolTable.functions.get('default')).toBe('entity-index');
    expect(symbolTable.defaultExport).toBe('entity-index');
  });

  it('supports symbol lookup by name', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [{ name: 'calculateTotal', is_exported: true, start_line: 1, end_line: 10 }],
      classes: [],
      imports: [],
      exports: [{ name: 'calculateTotal', type: 'function' }],
      calls: [],
    };

    const symbolTable = queue.buildSymbolTable('src/cart.js', analysisResult, 'entity-cart');
    const entityId = queue.lookupSymbol(symbolTable, 'calculateTotal');

    expect(entityId).toBe('entity-cart');
  });

  it('returns null for unresolved symbols', () => {
    const symbolTable = queue.buildSymbolTable(
      'src/empty.js',
      {
        language: 'javascript',
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        calls: [],
      },
      'entity-empty'
    );

    const entityId = queue.lookupSymbol(symbolTable, 'nonexistent');

    expect(entityId).toBeNull();
  });
});

describe('Auto Depends-On Extraction (Tasks 4.1-4.7)', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  it('extracts ES6 import statements', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [],
      classes: [],
      imports: [{ source: './utils', imported_names: ['foo', 'bar'], start_line: 1 }],
      exports: [],
      calls: [],
    };

    const imports = queue.extractImports(analysisResult);

    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('./utils');
    expect(imports[0].imported_names).toEqual(['foo', 'bar']);
    expect(imports[0].type).toBe('es6');
  });

  it('extracts default imports', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [],
      classes: [],
      imports: [{ source: './utils', imported_names: ['default'], start_line: 1 }],
      exports: [],
      calls: [],
    };

    const imports = queue.extractImports(analysisResult);

    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('./utils');
    expect(imports[0].isDefault).toBe(true);
  });

  it('extracts namespace imports', () => {
    const analysisResult = {
      language: 'javascript',
      functions: [],
      classes: [],
      imports: [{ source: './utils', imported_names: ['* as utils'], start_line: 1 }],
      exports: [],
      calls: [],
    };

    const imports = queue.extractImports(analysisResult);

    expect(imports).toHaveLength(1);
    expect(imports[0].isNamespace).toBe(true);
    expect(imports[0].namespace).toBe('utils');
  });

  it('resolves import paths to entity IDs using symbol table', () => {
    const globalSymbolTable = {
      pathToEntityId: new Map([
        ['src/utils.js', 'entity-utils'],
        ['src/helpers.js', 'entity-helpers'],
      ]),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const resolved = queue.resolveImportPath('./utils', 'src/index.js', globalSymbolTable);

    expect(resolved).toBe('entity-utils');
  });

  it('creates depends_on relationships for internal imports', async () => {
    const globalSymbolTable = {
      pathToEntityId: new Map([['src/utils.js', 'entity-utils']]),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const dependencies = await queue.createDependsOnRelations(
      'entity-index',
      'src/index.js',
      [{ source: './utils', imported_names: ['foo'], type: 'es6' }],
      globalSymbolTable,
      'default'
    );

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0].from_id).toBe('entity-index');
    expect(dependencies[0].to_id).toBe('entity-utils');
    expect(dependencies[0].type).toBe('depends_on');
    expect(dependencies[0].weight).toBe(0.8);
  });

  it('skips external dependencies (node_modules)', async () => {
    const globalSymbolTable = {
      pathToEntityId: new Map(),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const dependencies = await queue.createDependsOnRelations(
      'entity-index',
      'src/index.js',
      [{ source: 'lodash', imported_names: ['merge'], type: 'es6' }],
      globalSymbolTable,
      'default'
    );

    expect(dependencies).toHaveLength(0);
  });

  it('skips built-in modules', async () => {
    const globalSymbolTable = {
      pathToEntityId: new Map(),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const dependencies = await queue.createDependsOnRelations(
      'entity-index',
      'src/index.js',
      [{ source: 'fs', imported_names: ['readFile'], type: 'es6' }],
      globalSymbolTable,
      'default'
    );

    expect(dependencies).toHaveLength(0);
  });

  it('handles multiple imports from different sources', async () => {
    const globalSymbolTable = {
      pathToEntityId: new Map([
        ['src/utils.js', 'entity-utils'],
        ['src/helpers.js', 'entity-helpers'],
      ]),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const dependencies = await queue.createDependsOnRelations(
      'entity-index',
      'src/index.js',
      [
        { source: './utils', imported_names: ['foo'], type: 'es6' },
        { source: './helpers', imported_names: ['bar'], type: 'es6' },
      ],
      globalSymbolTable,
      'default'
    );

    expect(dependencies).toHaveLength(2);
  });

  it('includes relationship metadata (import names, type)', async () => {
    const globalSymbolTable = {
      pathToEntityId: new Map([['src/utils.js', 'entity-utils']]),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const dependencies = await queue.createDependsOnRelations(
      'entity-index',
      'src/index.js',
      [{ source: './utils', imported_names: ['foo', 'bar'], type: 'es6' }],
      globalSymbolTable,
      'default'
    );

    expect(dependencies).toHaveLength(1);
    expect(dependencies[0].description).toContain('Imports: foo, bar');
    expect(dependencies[0].metadata).toBeDefined();
    expect(dependencies[0].metadata.import_type).toBe('es6');
  });

  it('detects and skips duplicate relationships', async () => {
    const globalSymbolTable = {
      pathToEntityId: new Map([['src/utils.js', 'entity-utils']]),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const existingRefs = new Set(['entity-index:entity-utils:depends_on']);

    const dependencies = await queue.createDependsOnRelations(
      'entity-index',
      'src/index.js',
      [{ source: './utils', imported_names: ['foo'], type: 'es6' }],
      globalSymbolTable,
      'default',
      existingRefs
    );

    expect(dependencies).toHaveLength(0);
  });

  it('resolves relative paths with file extension handling', () => {
    const globalSymbolTable = {
      pathToEntityId: new Map([
        ['src/utils.js', 'entity-utils'],
        ['src/utils/index.js', 'entity-utils-index'],
      ]),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
    };

    const resolved1 = queue.resolveImportPath('./utils', 'src/index.js', globalSymbolTable);
    expect(resolved1).toBe('entity-utils');

    const resolved2 = queue.resolveImportPath('./utils/index', 'src/index.js', globalSymbolTable);
    expect(resolved2).toBe('entity-utils-index');
  });
});

describe('Integration: Symbol Table + Depends-On', () => {
  let queue;

  beforeEach(() => {
    queue = new AnalysisQueue();
  });

  it('builds symbol table and adds to global table in uploadProject flow', () => {
    const globalSymbolTable = {
      pathToEntityId: new Map(),
      functions: new Map(),
      classes: new Map(),
      namespaced: new Map(),
      defaultExport: null,
    };

    const result = {
      functions: [{ name: 'foo', is_exported: true, start_line: 1, end_line: 5 }],
      classes: [{ name: 'MyClass', start_line: 10, end_line: 20 }],
      imports: [{ source: './utils', imported_names: ['bar'], start_line: 1 }],
      exports: [
        { name: 'foo', type: 'function' },
        { name: 'MyClass', type: 'class' },
      ],
      calls: [],
    };

    const symbolTable = queue.buildSymbolTable('src/index.js', result, 'entity-index');
    queue.addToGlobalSymbolTable(globalSymbolTable, 'src/index.js', symbolTable);

    expect(globalSymbolTable.pathToEntityId.get('src/index.js')).toBe('entity-index');
    expect(globalSymbolTable.functions.get('foo')).toBe('entity-index');
    expect(globalSymbolTable.classes.get('MyClass')).toBe('entity-index');
  });
});
