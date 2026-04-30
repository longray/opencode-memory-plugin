/**
 * Tests for Atom tree algorithms
 * TDD for v3.3 Atom Architecture
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildAtomTree,
  flattenAtomTree,
  detectCircularReference,
  detectDanglingReferences,
  generateFractionalIndex,
} from '../../../lib/atom-tree.js';

describe('buildAtomTree', () => {
  it('should return empty array for empty input', () => {
    const result = buildAtomTree([]);
    expect(result).toEqual([]);
  });

  it('should build tree from single root atom', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        name: 'Chapter 1',
        parent_id: null,
        order: 'a0',
        children: [],
      },
    ];

    const result = buildAtomTree(atoms);

    expect(result).toHaveLength(1);
    expect(result[0].local_id).toBe('01ATOM001');
    expect(result[0].children).toEqual([]);
  });

  it('should build tree with nested children', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        name: 'Chapter 1',
        parent_id: null,
        order: 'a0',
        children: [],
      },
      {
        local_id: '01ATOM002',
        name: 'Section 1.1',
        parent_id: '01ATOM001',
        order: 'a0',
        children: [],
      },
    ];

    const result = buildAtomTree(atoms);

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].local_id).toBe('01ATOM002');
  });

  it('should sort by order', () => {
    const atoms = [
      {
        local_id: '01ATOM002',
        name: 'Second',
        parent_id: null,
        order: 'b0',
        children: [],
      },
      {
        local_id: '01ATOM001',
        name: 'First',
        parent_id: null,
        order: 'a0',
        children: [],
      },
    ];

    const result = buildAtomTree(atoms);

    expect(result).toHaveLength(2);
    expect(result[0].local_id).toBe('01ATOM001');
    expect(result[1].local_id).toBe('01ATOM002');
  });

  it('should handle deep nesting', () => {
    const atoms = [
      { local_id: '01A', name: 'Root', parent_id: null, order: 'a0', children: [] },
      { local_id: '01B', name: 'Child', parent_id: '01A', order: 'a0', children: [] },
      { local_id: '01C', name: 'Grandchild', parent_id: '01B', order: 'a0', children: [] },
    ];

    const result = buildAtomTree(atoms);

    expect(result[0].children[0].children[0].local_id).toBe('01C');
  });

  it('should handle dangling parent_id by promoting to root', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        name: 'Orphan',
        parent_id: 'NONEXISTENT',
        order: 'a0',
        children: [],
      },
    ];

    const result = buildAtomTree(atoms);

    expect(result).toHaveLength(1);
    expect(result[0].local_id).toBe('01ATOM001');
  });

  it('should exclude content when includeContent is false', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        name: 'Chapter',
        content: 'Secret content',
        parent_id: null,
        order: 'a0',
        children: [],
      },
    ];

    const result = buildAtomTree(atoms, false);

    expect(result[0].content).toBeUndefined();
  });

  it('should include content when includeContent is true', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        name: 'Chapter',
        content: 'Visible content',
        parent_id: null,
        order: 'a0',
        children: [],
      },
    ];

    const result = buildAtomTree(atoms, true);

    expect(result[0].content).toBe('Visible content');
  });
});

describe('flattenAtomTree', () => {
  it('should return empty array for empty tree', () => {
    const result = flattenAtomTree([]);
    expect(result).toEqual([]);
  });

  it('should flatten single node', () => {
    const tree = [
      {
        local_id: '01ATOM001',
        name: 'Chapter',
        children: [],
      },
    ];

    const result = flattenAtomTree(tree);

    expect(result).toHaveLength(1);
    expect(result[0].local_id).toBe('01ATOM001');
    expect(result[0].parent_id).toBeNull();
  });

  it('should flatten nested tree', () => {
    const tree = [
      {
        local_id: '01A',
        name: 'Root',
        children: [
          {
            local_id: '01B',
            name: 'Child',
            children: [],
          },
        ],
      },
    ];

    const result = flattenAtomTree(tree);

    expect(result).toHaveLength(2);
    expect(result[0].local_id).toBe('01A');
    expect(result[0].parent_id).toBeNull();
    expect(result[1].local_id).toBe('01B');
    expect(result[1].parent_id).toBe('01A');
  });

  it('should remove children field from flattened nodes', () => {
    const tree = [
      {
        local_id: '01A',
        name: 'Root',
        children: [],
      },
    ];

    const result = flattenAtomTree(tree);

    expect(result[0].children).toBeUndefined();
  });
});

describe('detectCircularReference', () => {
  it('should return no cycle for empty graph', () => {
    const result = detectCircularReference([]);
    expect(result.hasCycle).toBe(false);
    expect(result.path).toEqual([]);
  });

  it('should return no cycle for single node', () => {
    const atoms = [
      { local_id: '01A', parent_id: null },
    ];

    const result = detectCircularReference(atoms);

    expect(result.hasCycle).toBe(false);
  });

  it('should detect self-loop', () => {
    const atoms = [
      { local_id: '01A', parent_id: '01A' },
    ];

    const result = detectCircularReference(atoms);

    expect(result.hasCycle).toBe(true);
    expect(result.path).toContain('01A');
  });

  it('should detect A->B->A cycle', () => {
    const atoms = [
      { local_id: '01A', parent_id: '01B' },
      { local_id: '01B', parent_id: '01A' },
    ];

    const result = detectCircularReference(atoms);

    expect(result.hasCycle).toBe(true);
    expect(result.path).toContain('01A');
    expect(result.path).toContain('01B');
  });

  it('should detect long chain cycle', () => {
    const atoms = [
      { local_id: '01A', parent_id: '01B' },
      { local_id: '01B', parent_id: '01C' },
      { local_id: '01C', parent_id: '01D' },
      { local_id: '01D', parent_id: '01A' },
    ];

    const result = detectCircularReference(atoms);

    expect(result.hasCycle).toBe(true);
  });

  it('should return no cycle for valid tree', () => {
    const atoms = [
      { local_id: '01A', parent_id: null },
      { local_id: '01B', parent_id: '01A' },
      { local_id: '01C', parent_id: '01A' },
      { local_id: '01D', parent_id: '01B' },
    ];

    const result = detectCircularReference(atoms);

    expect(result.hasCycle).toBe(false);
    expect(result.path).toEqual([]);
  });

  it('should handle multiple disconnected subgraphs', () => {
    const atoms = [
      { local_id: '01A', parent_id: null },
      { local_id: '01B', parent_id: '01A' },
      { local_id: '01C', parent_id: null },
      { local_id: '01D', parent_id: '01C' },
    ];

    const result = detectCircularReference(atoms);

    expect(result.hasCycle).toBe(false);
  });
});

describe('generateFractionalIndex', () => {
  it('should return "a0" for no arguments', () => {
    expect(generateFractionalIndex()).toBe('a0');
    expect(generateFractionalIndex(null, null)).toBe('a0');
  });

  it('should generate index between two values', () => {
    const result = generateFractionalIndex('a0', 'a1');
    expect(result).toBeTruthy();
    expect(result > 'a0').toBe(true);
    expect(result < 'a1').toBe(true);
  });

  it('should generate index after prev', () => {
    const result = generateFractionalIndex('a0', null);
    expect(result).toBeTruthy();
    expect(result > 'a0').toBe(true);
  });

  it('should generate index before next', () => {
    const result = generateFractionalIndex(null, 'a1');
    expect(result).toBeTruthy();
    expect(result < 'a1').toBe(true);
  });

  it('should generate multiple indices between same bounds', () => {
    const first = generateFractionalIndex('a0', 'a1');
    const second = generateFractionalIndex('a0', first);
    const third = generateFractionalIndex(first, 'a1');

    // All generated indices should be strictly between a0 and a1
    expect(second > 'a0').toBe(true);
    expect(second < 'a1').toBe(true);
    expect(first > 'a0').toBe(true);
    expect(first < 'a1').toBe(true);
    expect(third > 'a0').toBe(true);
    expect(third < 'a1').toBe(true);

    // They should be ordered
    expect(second <= first).toBe(true);
    expect(first <= third).toBe(true);
  });

  it('should not produce control characters when next starts with "0" (char code 48)', () => {
    // '0'.charCodeAt(0) === 48, Math.floor(48/2) === 24 (ASCII control char)
    const result = generateFractionalIndex(null, '0');
    expect(result).toBeTruthy();

    // Every character must be printable (code >= 32 and !== 127)
    for (let i = 0; i < result.length; i++) {
      const code = result.charCodeAt(i);
      expect(code).toBeGreaterThanOrEqual(32);
      expect(code).not.toBe(127);
    }
  });

  it('should not produce control characters for low char code boundaries', () => {
    // Test with '1' (49), 'A' (65), etc. where mid could be < 32
    const boundaries = ['0', '1', '2', '!', '@'];
    for (const next of boundaries) {
      const result = generateFractionalIndex(null, next);
      expect(result).toBeTruthy();

      for (let i = 0; i < result.length; i++) {
        const code = result.charCodeAt(i);
        expect(code).toBeGreaterThanOrEqual(32);
        expect(code).not.toBe(127);
      }
    }
  });
});

describe('detectDanglingReferences', () => {
  it('should return empty arrays for atoms with no links', () => {
    const atoms = [
      { local_id: '01A', content: 'No links here', children: [] },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.dangling).toEqual([]);
    expect(result.cross_entity_links).toEqual([]);
  });

  it('should detect dangling wiki links', () => {
    const atoms = [
      { local_id: '01A', content: 'Link to [[01NONEXISTENT]]', children: [] },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.dangling).toHaveLength(1);
    expect(result.dangling[0]).toEqual({
      source: '01A',
      target: '01NONEXISTENT',
      type: 'wiki-link',
    });
  });

  it('should not flag valid wiki links as dangling', () => {
    const atoms = [
      { local_id: '01A', content: 'Link to [[01B]]', children: [] },
      { local_id: '01B', content: 'Target atom', children: [] },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.dangling).toEqual([]);
  });

  it('should detect dangling parent references', () => {
    const atoms = [
      { local_id: '01A', parent_id: '01NONEXISTENT', content: '', children: [] },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.dangling).toHaveLength(1);
    expect(result.dangling[0]).toEqual({
      source: '01A',
      target: '01NONEXISTENT',
      type: 'parent-reference',
    });
  });

  it('should track cross-entity links separately', () => {
    const atoms = [
      {
        local_id: '01A',
        content: 'Cross-entity link [[ENTITY123/01ATOM999|Some Label]]',
        children: [],
      },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.dangling).toEqual([]);
    expect(result.cross_entity_links).toHaveLength(1);
    expect(result.cross_entity_links[0]).toEqual({
      source: '01A',
      target: '01ATOM999',
      entity_id: 'ENTITY123',
      label: 'Some Label',
      type: 'wiki-link',
    });
  });

  it('should track multiple cross-entity links alongside dangling', () => {
    const atoms = [
      {
        local_id: '01A',
        content: 'Links to [[E1/01B|L1]] and [[E2/01C|L2]] and [[01D]]',
        children: [],
      },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.dangling).toHaveLength(1);
    expect(result.dangling[0].target).toBe('01D');
    expect(result.cross_entity_links).toHaveLength(2);
    expect(result.cross_entity_links[0].entity_id).toBe('E1');
    expect(result.cross_entity_links[1].entity_id).toBe('E2');
  });

  it('should include total_checked in result', () => {
    const atoms = [
      {
        local_id: '01A',
        content: '[[01B]] [[E1/01C]]',
        children: [
          { local_id: '01B', content: 'no links', children: [] },
        ],
      },
    ];

    const result = detectDanglingReferences(atoms, atoms);

    expect(result.total_checked).toBe(2);
  });
});
