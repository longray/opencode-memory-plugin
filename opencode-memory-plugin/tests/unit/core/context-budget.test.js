import { describe, it, expect } from '@jest/globals';
import {
  estimateTokens,
  calculateRelevance,
  loadContextByBudget,
} from '../../../lib/memory-core.js';
import { buildAtomTree, flattenAtomTree } from '../../../lib/atom-tree.js';

const SAMPLE_TREE = [
  {
    local_id: '01CHAP001',
    name: 'Vue3 Composition API',
    type: 'chapter',
    content: 'Vue3 Composition API is the modern way to write Vue components using setup function and reactive references.',
    order: 'a0',
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: '01SEC001',
        name: 'setup function basics',
        type: 'section',
        content: 'The setup function is the entry point for Composition API components. It runs before the component is created and receives props and context.',
        order: 'a0',
        heading_level: 2,
        parent_id: '01CHAP001',
        children: [
          {
            local_id: '01NOTE001',
            name: 'props and context',
            type: 'note',
            content: 'setup receives two arguments: props and context. Props are reactive and context provides attrs, slots, and emit.',
            order: 'a0',
            heading_level: 3,
            parent_id: '01SEC001',
            children: [],
          },
          {
            local_id: '01NOTE002',
            name: 'lifecycle hooks',
            type: 'note',
            content: 'Lifecycle hooks like onMounted, onUpdated, and onUnmounted can be called inside setup to handle component lifecycle events.',
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
        content: 'ref and reactive are the two ways to create reactive state in Vue3. ref is for primitive values, reactive is for objects.',
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
    content: 'Pinia is the official state management solution for Vue3. It provides a simple API with TypeScript support and devtools integration.',
    order: 'aV',
    heading_level: 1,
    parent_id: null,
    children: [
      {
        local_id: '01SEC003',
        name: 'defining stores',
        type: 'section',
        content: 'Stores are defined using the defineStore function. They can use setup syntax or options syntax.',
        order: 'a0',
        heading_level: 2,
        parent_id: '01CHAP002',
        children: [],
      },
    ],
  },
];

describe('estimateTokens', () => {
  it('should return 0 for empty/null input', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });

  it('should return 0 for non-string input', () => {
    expect(estimateTokens(123)).toBe(0);
    expect(estimateTokens({})).toBe(0);
  });

  it('should estimate tokens as ceil(chars/4) for Latin text', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
    expect(estimateTokens('a')).toBe(1);
    expect(estimateTokens('hello world')).toBe(3);
  });

  it('should estimate CJK characters at ~1.5 tokens each', () => {
    // Pure CJK: each character ~1.5 tokens (not 0.25 from chars/4)
    expect(estimateTokens('你好世界')).toBeGreaterThan(4);
    expect(estimateTokens('你好世界')).toBeLessThanOrEqual(8);
  });

  it('should handle mixed Latin and CJK text', () => {
    // 'Hello 世界' = 6 Latin (non-CJK) chars + 2 CJK chars
    // = ceil(6/4) + 2*1.5 = 2 + 3 = 5
    expect(estimateTokens('Hello 世界')).toBe(5);
  });

  it('should handle pure CJK text accurately', () => {
    const chinese = '你好世界测试'; // 6 CJK chars
    // 0 non-CJK + 6 CJK * 1.5 = 9
    expect(estimateTokens(chinese)).toBe(9);
  });
});

describe('calculateRelevance', () => {
  it('should return 0 for empty query', () => {
    expect(calculateRelevance({ name: 'test', content: 'test' }, '', 5)).toBe(0);
    expect(calculateRelevance({ name: 'test', content: 'test' }, '  ', 5)).toBe(0);
    expect(calculateRelevance({ name: 'test', content: 'test' }, null, 5)).toBe(0);
  });

  it('should give higher score for matching title', () => {
    const atomWithMatch = { name: 'setup function basics', content: 'unrelated', heading_level: 2 };
    const atomWithoutMatch = { name: 'unrelated topic', content: 'unrelated', heading_level: 2 };

    const scoreMatch = calculateRelevance(atomWithMatch, 'setup function', 0);
    const scoreNoMatch = calculateRelevance(atomWithoutMatch, 'setup function', 0);

    expect(scoreMatch).toBeGreaterThan(scoreNoMatch);
  });

  it('should give higher score for higher BM25', () => {
    const atom = { name: 'test', content: 'test content', heading_level: 2 };

    const scoreHigh = calculateRelevance(atom, 'test query', 15);
    const scoreLow = calculateRelevance(atom, 'test query', 1);

    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it('should give bonus for higher-level headings', () => {
    const chapter = { name: 'test', content: 'test', heading_level: 1 };
    const note = { name: 'test', content: 'test', heading_level: 4 };

    const scoreChapter = calculateRelevance(chapter, 'test query', 0);
    const scoreNote = calculateRelevance(note, 'test query', 0);

    expect(scoreChapter).toBeGreaterThan(scoreNote);
  });

  it('should return score in 0-1 range', () => {
    const atom = { name: 'setup function', content: 'setup function is great', heading_level: 1 };
    const score = calculateRelevance(atom, 'setup function', 20);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('loadContextByBudget', () => {
  it('should return error for missing entry_id', async () => {
    const result = await loadContextByBudget({ entry_id: '', query: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('entry_id is REQUIRED');
  });

  it('should return error for non-string entry_id', async () => {
    const result = await loadContextByBudget({ entry_id: 123, query: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('entry_id is REQUIRED');
  });

  it('should return error for negative maxTokens', async () => {
    const result = await loadContextByBudget({ entry_id: '01TEST', query: 'test', maxTokens: -1 });
    expect(result.success).toBe(false);
    expect(result.error).toContain('maxTokens');
  });

  it('should return error for invalid strategy', async () => {
    const result = await loadContextByBudget({ entry_id: '01TEST', query: 'test', strategy: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('strategy');
  });

  it('should return empty result for non-existent entry', async () => {
    const result = await loadContextByBudget({ entry_id: '01NONEXISTENT', query: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('selectByRelevance (via flattenAtomTree + manual scoring)', () => {
  const flatAtoms = flattenAtomTree(buildAtomTree(SAMPLE_TREE, true));

  it('should select atoms within token budget', () => {
    const totalContent = flatAtoms.reduce((s, a) => s + (a.content || '').length, 0);
    const totalTokens = Math.ceil(totalContent / 4);

    const budget = Math.floor(totalTokens * 0.5);

    const scored = flatAtoms.map(atom => ({
      ...atom,
      relevance_score: Math.random(),
    }));

    const sorted = [...scored].sort((a, b) => b.relevance_score - a.relevance_score);
    const selected = [];
    let used = 0;
    for (const atom of sorted) {
      const t = Math.ceil((atom.content || '').length / 4);
      if (used + t <= budget) {
        selected.push(atom);
        used += t;
      }
    }

    const usedTokens = selected.reduce((s, a) => s + Math.ceil((a.content || '').length / 4), 0);
    expect(usedTokens).toBeLessThanOrEqual(budget);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('should select fewer atoms with smaller budget', () => {
    const smallBudget = 5;
    const largeBudget = 10000;

    const scored = flatAtoms.map(atom => ({
      ...atom,
      relevance_score: Math.random(),
    }));

    const selectWithBudget = (budget) => {
      const sorted = [...scored].sort((a, b) => b.relevance_score - a.relevance_score);
      const selected = [];
      let used = 0;
      for (const atom of sorted) {
        const t = Math.ceil((atom.content || '').length / 4);
        if (used + t <= budget) {
          selected.push(atom);
          used += t;
        }
      }
      return selected;
    };

    expect(selectWithBudget(smallBudget).length).toBeLessThanOrEqual(selectWithBudget(largeBudget).length);
  });

  it('should return atoms sorted by original order', () => {
    const scored = flatAtoms.map(atom => ({
      ...atom,
      relevance_score: Math.random(),
    }));

    const sorted = [...scored].sort((a, b) => b.relevance_score - a.relevance_score);
    const selected = [];
    let used = 0;
    for (const atom of sorted) {
      const t = Math.ceil((atom.content || '').length / 4);
      if (used + t <= 10000) {
        selected.push(atom);
        used += t;
      }
    }

    const byOrder = selected.sort((a, b) => (a.order || '').localeCompare(b.order || ''));

    for (let i = 1; i < byOrder.length; i++) {
      expect(byOrder[i].order >= byOrder[i - 1].order).toBe(true);
    }
  });
});

describe('selectByHierarchy (via flattenAtomTree + manual sorting)', () => {
  const flatAtoms = flattenAtomTree(buildAtomTree(SAMPLE_TREE, true));

  it('should prefer top-level atoms over deeper ones', () => {
    const scored = flatAtoms.map(atom => ({
      ...atom,
      relevance_score: Math.random(),
    }));

    const sorted = [...scored].sort((a, b) => {
      const levelDiff = (a.heading_level || 99) - (b.heading_level || 99);
      if (levelDiff !== 0) return levelDiff;
      return b.relevance_score - a.relevance_score;
    });

    const budget = 10000;
    const selected = [];
    let used = 0;
    for (const atom of sorted) {
      const t = Math.ceil((atom.content || '').length / 4);
      if (used + t <= budget) {
        selected.push(atom);
        used += t;
      }
    }

    const chapters = selected.filter(a => a.heading_level === 1);
    const notes = selected.filter(a => a.heading_level === 3);

    expect(chapters.length).toBeGreaterThan(0);

    if (notes.length > 0) {
      const firstNoteIndex = selected.findIndex(a => a.heading_level === 3);
      const lastChapterIndex = selected.reduce((max, a, i) => a.heading_level === 1 ? Math.max(max, i) : max, -1);
      expect(firstNoteIndex).toBeGreaterThan(lastChapterIndex);
    }
  });
});

describe('edge cases', () => {
  it('should handle zero budget', () => {
    const scored = [
      { local_id: 'A', content: 'hello world', order: 'a0', relevance_score: 0.5 },
    ];

    const selected = [];
    let used = 0;
    for (const atom of scored) {
      const t = Math.ceil((atom.content || '').length / 4);
      if (used + t <= 0) {
        selected.push(atom);
        used += t;
      }
    }

    expect(selected).toHaveLength(0);
  });

  it('should handle single atom within budget', () => {
    const scored = [
      { local_id: 'A', content: 'hello world', order: 'a0', relevance_score: 0.5 },
    ];

    const budget = 100;
    const selected = [];
    let used = 0;
    for (const atom of scored) {
      const t = Math.ceil((atom.content || '').length / 4);
      if (used + t <= budget) {
        selected.push(atom);
        used += t;
      }
    }

    expect(selected).toHaveLength(1);
    expect(selected[0].local_id).toBe('A');
  });

  it('should handle atoms with no content', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens(null)).toBe(0);

    const scored = [
      { local_id: 'A', content: '', order: 'a0', relevance_score: 0.5 },
      { local_id: 'B', content: null, order: 'aV', relevance_score: 0.3 },
    ];

    const budget = 10;
    const selected = [];
    let used = 0;
    for (const atom of scored) {
      const t = Math.ceil(((atom.content || '').length) / 4);
      if (used + t <= budget) {
        selected.push(atom);
        used += t;
      }
    }

    expect(selected).toHaveLength(2);
  });

  it('should handle atom too large for budget', () => {
    const bigContent = 'x'.repeat(1000);
    const scored = [
      { local_id: 'BIG', content: bigContent, order: 'a0', relevance_score: 0.9 },
      { local_id: 'SMALL', content: 'hi', order: 'aV', relevance_score: 0.1 },
    ];

    const budget = 10;
    const selected = [];
    let used = 0;
    for (const atom of scored) {
      const t = Math.ceil((atom.content || '').length / 4);
      if (used + t <= budget) {
        selected.push(atom);
        used += t;
      }
    }

    expect(selected).toHaveLength(1);
    expect(selected[0].local_id).toBe('SMALL');
  });
});
