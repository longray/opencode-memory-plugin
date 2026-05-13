import { describe, it, expect } from '@jest/globals';
import { runConcurrent, buildIdMaps, resolveId } from '../../../lib/graphify-bridge.js';

describe('runConcurrent', () => {
  it('should execute all tasks', async () => {
    const tasks = Array.from({ length: 20 }, (_, i) => () => Promise.resolve(i * 2));
    const results = await runConcurrent(tasks, { concurrency: 5 });
    expect(results).toHaveLength(20);
    expect(results[0]).toBe(0);
    expect(results[19]).toBe(38);
  });

  it('should capture errors without failing', async () => {
    const tasks = [
      () => Promise.resolve('ok'),
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve('also ok'),
    ];
    const results = await runConcurrent(tasks, { concurrency: 2 });
    expect(results[0]).toBe('ok');
    expect(results[1].error).toBe('boom');
    expect(results[2]).toBe('also ok');
  });

  it('should handle empty tasks', async () => {
    const results = await runConcurrent([], { concurrency: 5 });
    expect(results).toHaveLength(0);
  });
});

describe('buildIdMaps', () => {
  it('should build entity and atom ID maps', () => {
    const entityNodes = [
      { id: 'lib_test_js', source_file: 'lib/test.js' },
      { id: 'lib_foo_js', source_file: 'lib/foo.js' },
    ];
    const atomNodes = [{ id: 'lib_test_js_bar', source_file: 'lib/test.js' }];
    const entityResults = [{ id: 'entity:aaa111' }, { id: 'entity:bbb222' }];
    const atomResults = [{ id: 'atom:ccc333' }];
    const { entityMap, atomMap } = buildIdMaps(entityNodes, atomNodes, entityResults, atomResults);
    expect(entityMap.get('lib_test_js')).toBe('entity:aaa111');
    expect(entityMap.get('lib_foo_js')).toBe('entity:bbb222');
    expect(atomMap.get('lib_test_js_bar')).toBe('atom:ccc333');
  });

  it('should handle missing results gracefully', () => {
    const { entityMap, atomMap } = buildIdMaps([], [], [], []);
    expect(entityMap.size).toBe(0);
    expect(atomMap.size).toBe(0);
  });
});

describe('resolveId', () => {
  it('should check atomMap first, then entityMap', () => {
    const entityMap = new Map([['a', 'entity:1']]);
    const atomMap = new Map([
      ['a', 'atom:1'],
      ['b', 'atom:2'],
    ]);
    expect(resolveId('a', entityMap, atomMap)).toBe('atom:1');
    expect(resolveId('b', entityMap, atomMap)).toBe('atom:2');
  });

  it('should return null for unknown ID', () => {
    expect(resolveId('unknown', new Map(), new Map())).toBeNull();
  });
});
