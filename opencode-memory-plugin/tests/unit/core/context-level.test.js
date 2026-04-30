import { describe, it, expect } from '@jest/globals';
import {
  filterByLevel,
  addBreadcrumbs,
  formatAsMarkdown,
  loadContextByLevel,
} from '../../../lib/memory-core.js';

const THREE_LEVEL_TREE = [
  {
    local_id: '01CHAP001',
    name: 'Vue3 Composition API',
    type: 'chapter',
    content: 'Vue3 Composition API is the modern way.',
    order: 'a0',
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: '01SEC001',
        name: 'setup function basics',
        type: 'section',
        content: 'The setup function is the entry point.',
        order: 'a0',
        heading_level: 2,
        parent_id: '01CHAP001',
        children: [
          {
            local_id: '01NOTE001',
            name: 'props and context',
            type: 'note',
            content: 'setup receives props and context.',
            order: 'a0',
            heading_level: 3,
            parent_id: '01SEC001',
            children: [],
          },
          {
            local_id: '01NOTE002',
            name: 'lifecycle hooks',
            type: 'note',
            content: 'onMounted, onUpdated, onUnmounted.',
            order: 'aV',
            heading_level: 3,
            parent_id: '01SEC001',
            children: [],
          },
        ],
      },
      {
        local_id: '01SEC002',
        name: 'reactive references',
        type: 'section',
        content: 'ref and reactive for state.',
        order: 'aV',
        heading_level: 2,
        parent_id: '01CHAP001',
        children: [],
      },
    ],
  },
  {
    local_id: '01CHAP002',
    name: 'Pinia State Management',
    type: 'chapter',
    content: 'Pinia is the official state management.',
    order: 'aV',
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: '01SEC003',
        name: 'defining stores',
        type: 'section',
        content: 'defineStore function.',
        order: 'a0',
        heading_level: 2,
        parent_id: '01CHAP002',
        children: [
          {
            local_id: '01NOTE003',
            name: 'setup syntax',
            type: 'note',
            content: 'Stores can use setup syntax.',
            order: 'a0',
            heading_level: 3,
            parent_id: '01SEC003',
            children: [],
          },
        ],
      },
    ],
  },
];

describe('filterByLevel', () => {
  it('should return empty array for null/undefined input', () => {
    expect(filterByLevel(null, 2)).toEqual([]);
    expect(filterByLevel(undefined, 2)).toEqual([]);
    expect(filterByLevel([], 2)).toEqual([]);
  });

  it('max_level=1 should keep only chapters', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 1);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].local_id).toBe('01CHAP001');
    expect(filtered[0].children).toEqual([]);
    expect(filtered[1].local_id).toBe('01CHAP002');
    expect(filtered[1].children).toEqual([]);
  });

  it('max_level=2 should keep chapters and sections', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 2);
    expect(filtered).toHaveLength(2);

    const chap1 = filtered[0];
    expect(chap1.local_id).toBe('01CHAP001');
    expect(chap1.children).toHaveLength(2);
    expect(chap1.children[0].local_id).toBe('01SEC001');
    expect(chap1.children[0].children).toEqual([]);
    expect(chap1.children[1].local_id).toBe('01SEC002');
    expect(chap1.children[1].children).toEqual([]);

    const chap2 = filtered[1];
    expect(chap2.children).toHaveLength(1);
    expect(chap2.children[0].local_id).toBe('01SEC003');
    expect(chap2.children[0].children).toEqual([]);
  });

  it('max_level=3 should keep all levels', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 3);
    expect(filtered).toHaveLength(2);

    const chap1 = filtered[0];
    expect(chap1.children[0].children).toHaveLength(2);
    expect(chap1.children[0].children[0].local_id).toBe('01NOTE001');
    expect(chap1.children[0].children[1].local_id).toBe('01NOTE002');

    const chap2 = filtered[1];
    expect(chap2.children[0].children).toHaveLength(1);
    expect(chap2.children[0].children[0].local_id).toBe('01NOTE003');
  });

  it('should preserve atom properties', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 1);
    const chapter = filtered[0];
    expect(chapter.name).toBe('Vue3 Composition API');
    expect(chapter.type).toBe('chapter');
    expect(chapter.content).toBe('Vue3 Composition API is the modern way.');
    expect(chapter.heading_level).toBe(1);
    expect(chapter.order).toBe('a0');
  });

  it('should handle atoms without heading_level (default to 1)', () => {
    const tree = [
      {
        local_id: 'A',
        name: 'No Level',
        content: 'test',
        children: [
          { local_id: 'B', name: 'Child', content: 'child', heading_level: 2, children: [] },
        ],
      },
    ];

    const filtered = filterByLevel(tree, 1);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].children).toEqual([]);
  });

  it('should handle 4-level deep trees', () => {
    const deepTree = [
      {
        local_id: 'L1',
        name: 'Level 1',
        heading_level: 1,
        content: 'L1 content',
        children: [
          {
            local_id: 'L2',
            name: 'Level 2',
            heading_level: 2,
            content: 'L2 content',
            children: [
              {
                local_id: 'L3',
                name: 'Level 3',
                heading_level: 3,
                content: 'L3 content',
                children: [
                  {
                    local_id: 'L4',
                    name: 'Level 4',
                    heading_level: 4,
                    content: 'L4 content',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const filtered = filterByLevel(deepTree, 3);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].children).toHaveLength(1);
    expect(filtered[0].children[0].children).toHaveLength(1);
    expect(filtered[0].children[0].children[0].children).toEqual([]);
  });
});

describe('addBreadcrumbs', () => {
  it('should add breadcrumb to root-level nodes', () => {
    const tree = [
      { local_id: 'A', name: 'Root Node', children: [] },
    ];

    addBreadcrumbs(tree);
    expect(tree[0].breadcrumb).toBe('Root Node');
  });

  it('should build breadcrumb path for nested nodes', () => {
    const tree = [
      {
        local_id: 'A', name: 'Chapter', children: [
          { local_id: 'B', name: 'Section', children: [
            { local_id: 'C', name: 'Detail', children: [] },
          ] },
        ],
      },
    ];

    addBreadcrumbs(tree);
    expect(tree[0].breadcrumb).toBe('Chapter');
    expect(tree[0].children[0].breadcrumb).toBe('Chapter > Section');
    expect(tree[0].children[0].children[0].breadcrumb).toBe('Chapter > Section > Detail');
  });

  it('should handle empty tree', () => {
    addBreadcrumbs([]);
    expect([]).toHaveLength(0);
  });

  it('should handle nodes without children', () => {
    const tree = [{ local_id: 'A', name: 'Solo', children: [] }];
    addBreadcrumbs(tree);
    expect(tree[0].breadcrumb).toBe('Solo');
  });

  it('should handle multiple root-level siblings', () => {
    const tree = [
      { local_id: 'A', name: 'First', children: [
        { local_id: 'C', name: 'Child of First', children: [] },
      ] },
      { local_id: 'B', name: 'Second', children: [
        { local_id: 'D', name: 'Child of Second', children: [] },
      ] },
    ];

    addBreadcrumbs(tree);
    expect(tree[0].breadcrumb).toBe('First');
    expect(tree[0].children[0].breadcrumb).toBe('First > Child of First');
    expect(tree[1].breadcrumb).toBe('Second');
    expect(tree[1].children[0].breadcrumb).toBe('Second > Child of Second');
  });
});

describe('formatAsMarkdown', () => {
  it('should return empty string for null/empty tree', () => {
    expect(formatAsMarkdown(null, 2)).toBe('');
    expect(formatAsMarkdown([], 2)).toBe('');
  });

  it('should format single chapter with correct heading level', () => {
    const tree = [
      { local_id: 'A', name: 'Chapter One', heading_level: 1, content: 'Chapter content.' },
    ];

    const md = formatAsMarkdown(tree, 1);
    expect(md).toContain('# Chapter One');
    expect(md).toContain('Chapter content.');
  });

  it('should not add breadcrumb for top-level headings', () => {
    const tree = [
      {
        local_id: 'A',
        name: 'Top Level',
        heading_level: 1,
        breadcrumb: 'Top Level',
        content: 'content',
        children: [],
      },
    ];

    const md = formatAsMarkdown(tree, 1);
    expect(md).not.toContain('>');
  });

  it('should add blockquote breadcrumb for nested headings', () => {
    const tree = [
      {
        local_id: 'A',
        name: 'Chapter',
        heading_level: 1,
        breadcrumb: 'Chapter',
        content: 'chap',
        children: [
          {
            local_id: 'B',
            name: 'Section',
            heading_level: 2,
            breadcrumb: 'Chapter > Section',
            content: 'sec',
            children: [],
          },
        ],
      },
    ];

    const md = formatAsMarkdown(tree, 2);
    expect(md).toContain('> Chapter > Section');
  });

  it('should format multi-level tree as markdown', () => {
    const tree = [
      {
        local_id: 'A',
        name: 'Chapter',
        heading_level: 1,
        breadcrumb: 'Chapter',
        content: 'Chapter content.',
        children: [
          {
            local_id: 'B',
            name: 'Section',
            heading_level: 2,
            breadcrumb: 'Chapter > Section',
            content: 'Section content.',
            children: [],
          },
        ],
      },
    ];

    const md = formatAsMarkdown(tree, 2);
    const lines = md.split('\n');

    expect(lines).toContain('# Chapter');
    expect(lines).toContain('Chapter content.');
    expect(lines).toContain('## Section');
    expect(lines).toContain('> Chapter > Section');
    expect(lines).toContain('Section content.');
  });

  it('should handle nodes without content gracefully', () => {
    const tree = [
      { local_id: 'A', name: 'No Content', heading_level: 1, children: [] },
    ];

    const md = formatAsMarkdown(tree, 1);
    expect(md).toContain('# No Content');
  });

  it('should cap heading level at 6 (markdown max)', () => {
    const tree = [
      { local_id: 'A', name: 'Deep', heading_level: 10, breadcrumb: 'Deep', content: 'deep content' },
    ];

    const md = formatAsMarkdown(tree, 10);
    expect(md).toContain('###### Deep');
  });

  it('should produce correct output for 3-level tree at max_level=1', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 1);
    const md = formatAsMarkdown(filtered, 1);

    expect(md).toContain('# Vue3 Composition API');
    expect(md).toContain('# Pinia State Management');
    expect(md).not.toContain('setup function basics');
    expect(md).not.toContain('props and context');
  });

  it('should produce correct output for 3-level tree at max_level=2', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 2);
    addBreadcrumbs(filtered);
    const md = formatAsMarkdown(filtered, 2);

    expect(md).toContain('# Vue3 Composition API');
    expect(md).toContain('## setup function basics');
    expect(md).toContain('## reactive references');
    expect(md).toContain('> Vue3 Composition API > setup function basics');
    expect(md).not.toContain('props and context');
    expect(md).not.toContain('lifecycle hooks');
  });

  it('should produce correct output for 3-level tree at max_level=3', () => {
    const filtered = filterByLevel(THREE_LEVEL_TREE, 3);
    addBreadcrumbs(filtered);
    const md = formatAsMarkdown(filtered, 3);

    expect(md).toContain('# Vue3 Composition API');
    expect(md).toContain('## setup function basics');
    expect(md).toContain('### props and context');
    expect(md).toContain('### lifecycle hooks');
    expect(md).toContain('### setup syntax');
  });
});

describe('loadContextByLevel', () => {
  it('should return error for missing entry_id', async () => {
    const result = await loadContextByLevel({ entry_id: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('entry_id is REQUIRED');
  });

  it('should return error for non-string entry_id', async () => {
    const result = await loadContextByLevel({ entry_id: 123 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('entry_id is REQUIRED');
  });

  it('should return error for maxLevel < 1', async () => {
    const result = await loadContextByLevel({ entry_id: '01TEST', maxLevel: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('maxLevel');
  });

  it('should return error for maxLevel > 6', async () => {
    const result = await loadContextByLevel({ entry_id: '01TEST', maxLevel: 7 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('maxLevel');
  });

  it('should return error for non-boolean includeBreadcrumbs', async () => {
    const result = await loadContextByLevel({ entry_id: '01TEST', includeBreadcrumbs: 'yes' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('includeBreadcrumbs');
  });

  it('should return error for non-existent entry', async () => {
    const result = await loadContextByLevel({ entry_id: '01NONEXISTENT' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should return empty result for entity with no atoms', async () => {
    const { writeMemory } = await import('../../../lib/memory-core.js');
    const written = await writeMemory({
      abstract: 'No atoms test',
      overview: 'Testing empty atoms',
      content: 'Plain content without atoms',
      type: 'test',
      tags: ['test'],
    });

    if (!written.success) {
      return;
    }

    const result = await loadContextByLevel({ entry_id: written.localId });
    expect(result.success).toBe(true);
    expect(result.filtered_tree).toEqual([]);
    expect(result.markdown).toBe('');
    expect(result.filtered_count).toBe(0);
  });
});

describe('edge cases', () => {
  it('should handle tree with only root nodes (no children)', () => {
    const flatTree = [
      { local_id: 'A', name: 'Standalone', heading_level: 1, content: 'solo', children: [] },
      { local_id: 'B', name: 'Another', heading_level: 1, content: 'also solo', children: [] },
    ];

    const filtered = filterByLevel(flatTree, 1);
    expect(filtered).toHaveLength(2);
  });

  it('should handle mixed heading levels (gaps in hierarchy)', () => {
    const gapTree = [
      {
        local_id: 'A', name: 'Level 1', heading_level: 1, content: 'L1',
        children: [
          { local_id: 'B', name: 'Level 3 directly', heading_level: 3, content: 'L3', children: [] },
        ],
      },
    ];

    const filtered = filterByLevel(gapTree, 2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].children).toEqual([]);
  });

  it('should handle very long breadcrumb paths', () => {
    const deepTree = [
      {
        local_id: 'L1', name: 'A', heading_level: 1, content: '', children: [
          { local_id: 'L2', name: 'B', heading_level: 2, content: '', children: [
            { local_id: 'L3', name: 'C', heading_level: 3, content: '', children: [
              { local_id: 'L4', name: 'D', heading_level: 4, content: '', children: [] },
            ] },
          ] },
        ],
      },
    ];

    addBreadcrumbs(deepTree);
    const leaf = deepTree[0].children[0].children[0].children[0];
    expect(leaf.breadcrumb).toBe('A > B > C > D');
  });

  it('should handle atom with undefined heading_level', () => {
    const tree = [
      {
        local_id: 'X', name: 'No Heading Level', content: 'test',
        children: [
          { local_id: 'Y', name: 'Child', heading_level: 2, content: 'child', children: [] },
        ],
      },
    ];

    const filtered = filterByLevel(tree, 1);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].children).toEqual([]);
  });

  it('should handle entity with many atoms at different levels', () => {
    const bigTree = Array.from({ length: 5 }, (_, i) => ({
      local_id: `CHAP${i}`,
      name: `Chapter ${i}`,
      heading_level: 1,
      content: `Chapter ${i} content`,
      children: Array.from({ length: 3 }, (_, j) => ({
        local_id: `SEC${i}_${j}`,
        name: `Section ${i}.${j}`,
        heading_level: 2,
        content: `Section ${i}.${j} content`,
        children: Array.from({ length: 2 }, (_, k) => ({
          local_id: `NOTE${i}_${j}_${k}`,
          name: `Note ${i}.${j}.${k}`,
          heading_level: 3,
          content: `Note ${i}.${j}.${k} content`,
          children: [],
        })),
      })),
    }));

    const filtered1 = filterByLevel(bigTree, 1);
    const filtered2 = filterByLevel(bigTree, 2);
    const filtered3 = filterByLevel(bigTree, 3);

    function countNodes(nodes) {
      let count = 0;
      for (const n of nodes || []) {
        count++;
        count += countNodes(n.children);
      }
      return count;
    }

    expect(countNodes(filtered1)).toBe(5);
    expect(countNodes(filtered2)).toBe(5 + 15);
    expect(countNodes(filtered3)).toBe(5 + 15 + 30);
  });
});
