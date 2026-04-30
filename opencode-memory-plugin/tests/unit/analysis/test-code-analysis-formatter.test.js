/**
 * Test Suite - Code Analysis Formatter
 * Tests for formatAsTable, formatAsTree, formatAsJson
 */

import { describe, it, expect } from '@jest/globals';
import { formatAsTable, formatAsTree, formatAsJson } from '../../../lib/code-analysis-formatter.js';

// ===== Fixtures =====

const mockResult = {
  success: true,
  file: 'src/utils.js',
  result: {
    language: 'javascript',
    functions: [
      { name: 'add', line: 1, type: 'function' },
      { name: 'subtract', line: 5, type: 'function' },
    ],
    classes: [{ name: 'Calculator', line: 10, methods: [{ name: 'run', line: 12 }] }],
    complexity_metrics: { cyclomatic: 5, max_nesting_depth: 3, lines_of_code: 100 },
    calls: [
      { target: 'add', line: 20, column: 4 },
      { target: 'subtract', line: 21, column: 8 },
    ],
    quality_score: { score: 85, grade: 'B', issues: ['High complexity in subtract'] },
  },
};

const mockErrorResult = {
  success: false,
  error: 'Parse error',
};

const mockEmptyResult = {
  success: true,
  file: 'empty.js',
  result: {
    language: 'javascript',
    functions: [],
    classes: [],
    complexity_metrics: { cyclomatic: 0, lines_of_code: 0 },
    calls: [],
  },
};

// ===== formatAsTable =====

describe('formatAsTable', () => {
  it('正常结果 → 包含 header + basic info + functions + classes + calls', () => {
    const output = formatAsTable(mockResult);
    expect(output).toContain('┌');
    expect(output).toContain('Code Analysis: src/utils.js');
    expect(output).toContain('Language: javascript');
    expect(output).toContain('Lines: 100');
    expect(output).toContain('Functions: 2');
    expect(output).toContain('Classes: 1');
    expect(output).toContain('Complexity: 5');
    expect(output).toContain('add');
    expect(output).toContain('Calculator');
    expect(output).toContain('subtract');
    expect(output).toContain('└');
  });

  it('有 quality_score → 显示评分和 issues', () => {
    const output = formatAsTable(mockResult);
    expect(output).toContain('Quality: 85/100 (B)');
    expect(output).toContain('High complexity in subtract');
  });

  it('超过 10 函数 → 截断显示', () => {
    const manyFuncs = Array(15)
      .fill(0)
      .map((_, i) => ({ name: `func${i}`, line: i }));
    const result = {
      success: true,
      file: 'big.js',
      result: {
        language: 'javascript',
        functions: manyFuncs,
        classes: [],
        complexity_metrics: {},
        calls: [],
      },
    };
    const output = formatAsTable(result);
    expect(output).toContain('... and 5 more');
  });

  it('超过 5 类 → 截断显示', () => {
    const manyClasses = Array(8)
      .fill(0)
      .map((_, i) => ({ name: `C${i}`, line: i, methods: [] }));
    const result = {
      success: true,
      file: 'big.js',
      result: {
        language: 'javascript',
        functions: [],
        classes: manyClasses,
        complexity_metrics: {},
        calls: [],
      },
    };
    const output = formatAsTable(result);
    expect(output).toContain('... and 3 more');
  });

  it('超过 10 calls → 截断显示', () => {
    const manyCalls = Array(15)
      .fill(0)
      .map((_, i) => ({ target: `fn${i}`, line: i, column: 0 }));
    const result = {
      success: true,
      file: 'big.js',
      result: {
        language: 'javascript',
        functions: [],
        classes: [],
        complexity_metrics: {},
        calls: manyCalls,
      },
    };
    const output = formatAsTable(result);
    expect(output).toContain('... and 5 more');
  });

  it('error 结果 → Error: xxx', () => {
    const output = formatAsTable(mockErrorResult);
    expect(output).toBe('Error: Parse error');
  });
});

// ===== formatAsTree =====

describe('formatAsTree', () => {
  it('正常结果 → 树形结构', () => {
    const output = formatAsTree(mockResult);
    expect(output).toContain('src/utils.js [javascript]');
    expect(output).toContain('├── Functions (2)');
    expect(output).toContain('add() @ line 1');
    expect(output).toContain('subtract() @ line 5');
    expect(output).toContain('└── Classes (1)');
    expect(output).toContain('Calculator @ line 10');
    expect(output).toContain('run() @ line 12');
    expect(output).toContain('└── Calls (2)');
    expect(output).toContain('add() @ line 20:4');
  });

  it('只有函数无类 → 正确前缀', () => {
    const result = {
      success: true,
      file: 'funcs.js',
      result: {
        language: 'javascript',
        functions: [{ name: 'a', line: 1 }],
        classes: [],
        calls: [],
      },
    };
    const output = formatAsTree(result);
    expect(output).toContain('├── Functions (1)');
    expect(output).toContain('└── a() @ line 1');
    expect(output).not.toContain('Classes');
  });

  it('只有类无函数 → 正确前缀', () => {
    const result = {
      success: true,
      file: 'cls.js',
      result: {
        language: 'javascript',
        functions: [],
        classes: [{ name: 'A', line: 1 }],
        calls: [],
      },
    };
    const output = formatAsTree(result);
    expect(output).toContain('├── Classes (1)');
    expect(output).toContain('└── A @ line 1');
  });

  it('只有 calls 无函数无类 → 正确前缀', () => {
    const result = {
      success: true,
      file: 'calls.js',
      result: {
        language: 'javascript',
        functions: [],
        classes: [],
        calls: [{ target: 'fn', line: 1, column: 0 }],
      },
    };
    const output = formatAsTree(result);
    expect(output).toContain('├── Calls (1)');
    expect(output).toContain('└── fn() @ line 1:0');
  });

  it('error 结果 → Error: xxx', () => {
    const output = formatAsTree(mockErrorResult);
    expect(output).toBe('Error: Parse error');
  });
});

// ===== formatAsJson =====

describe('formatAsJson', () => {
  it('默认 → 紧凑 JSON 字符串', () => {
    const output = formatAsJson(mockResult);
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(true);
    expect(parsed.file).toBe('src/utils.js');
  });

  it('pretty=true → 缩进 2 空格', () => {
    const output = formatAsJson(mockResult, true);
    expect(output).toContain('  "success": true,\n');
    expect(output).toContain('  "file": "src/utils.js",\n');
  });

  it('结果可 JSON.parse 往返', () => {
    const output = formatAsJson(mockEmptyResult);
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(true);
    expect(parsed.result.language).toBe('javascript');
    expect(parsed.result.functions).toEqual([]);
    expect(parsed.result.classes).toEqual([]);
  });

  it('error 结果 → 有效 JSON', () => {
    const output = formatAsJson(mockErrorResult);
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('Parse error');
  });
});
