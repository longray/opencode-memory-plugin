import { describe, it, expect } from '@jest/globals';
import {
  classifyNodes,
  parseSourceLocation,
  inferAtomType,
  detectLanguage,
  calculateWeight,
} from '../../../lib/graphify-bridge.js';

describe('classifyNodes', () => {
  it('should separate file-level and symbol-level nodes', () => {
    const nodes = [
      { id: 'lib_test_js', label: 'test.js', source_file: 'lib/test.js', source_location: '' },
      { id: 'lib_test_js_foo', label: 'foo()', source_file: 'lib/test.js', source_location: 'L10' },
      { id: 'lib_test_js_bar', label: 'Bar', source_file: 'lib/test.js', source_location: 'L20' },
    ];
    const { entityNodes, atomNodes } = classifyNodes(nodes);
    expect(entityNodes).toHaveLength(1);
    expect(entityNodes[0].id).toBe('lib_test_js');
    expect(atomNodes).toHaveLength(2);
  });

  it('should treat node without source_location as entity', () => {
    const nodes = [{ id: 'readme_md', label: 'README.md', source_file: 'README.md' }];
    const { entityNodes, atomNodes } = classifyNodes(nodes);
    expect(entityNodes).toHaveLength(1);
    expect(atomNodes).toHaveLength(0);
  });

  it('should handle empty nodes array', () => {
    const { entityNodes, atomNodes } = classifyNodes([]);
    expect(entityNodes).toHaveLength(0);
    expect(atomNodes).toHaveLength(0);
  });
});

describe('parseSourceLocation', () => {
  it('should parse L206 format', () => {
    expect(parseSourceLocation('L206')).toEqual({ start_line: 206 });
  });

  it('should parse LL206-230 range format', () => {
    expect(parseSourceLocation('LL206-230')).toEqual({ start_line: 206, end_line: 230 });
  });

  it('should return empty for null/empty/invalid', () => {
    expect(parseSourceLocation(null)).toEqual({});
    expect(parseSourceLocation('')).toEqual({});
    expect(parseSourceLocation('invalid')).toEqual({});
  });
});

describe('inferAtomType', () => {
  it('should detect function from ()', () => {
    expect(inferAtomType('getWebSocketClient()')).toBe('function');
    expect(inferAtomType('log()')).toBe('function');
  });

  it('should detect class from PascalCase without ()', () => {
    expect(inferAtomType('WrapperClient')).toBe('class');
    expect(inferAtomType('BM25Index')).toBe('class');
  });

  it('should default to function', () => {
    expect(inferAtomType('handler')).toBe('function');
  });
});

describe('detectLanguage', () => {
  it('should detect from extension', () => {
    expect(detectLanguage('lib/test.js')).toBe('javascript');
    expect(detectLanguage('lib/test.ts')).toBe('typescript');
    expect(detectLanguage('lib/test.py')).toBe('python');
    expect(detectLanguage('README.md')).toBe('markdown');
    expect(detectLanguage('lib/test.go')).toBe('go');
    expect(detectLanguage('lib/test.rs')).toBe('rust');
    expect(detectLanguage('lib/test.java')).toBe('java');
  });

  it('should return unknown for unrecognized', () => {
    expect(detectLanguage('Makefile')).toBe('unknown');
  });
});

describe('calculateWeight', () => {
  it('should return correct weights for relation+confidence combos', () => {
    expect(calculateWeight('contains', 'EXTRACTED')).toBe(1.0);
    expect(calculateWeight('method', 'EXTRACTED')).toBe(0.9);
    expect(calculateWeight('imports', 'EXTRACTED')).toBe(0.8);
    expect(calculateWeight('imports_from', 'EXTRACTED')).toBe(0.8);
    expect(calculateWeight('calls', 'EXTRACTED')).toBe(0.7);
    expect(calculateWeight('calls', 'INFERRED')).toBe(0.5);
  });

  it('should default to 0.5 for unknown combos', () => {
    expect(calculateWeight('unknown', 'EXTRACTED')).toBe(0.5);
  });

  it('should default confidence to EXTRACTED', () => {
    expect(calculateWeight('calls', null)).toBe(0.7);
  });
});
