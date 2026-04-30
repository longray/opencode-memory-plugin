/**
 * Tests for extractWikiLinks and findIncomingLinks
 * TDD for v3.3 Atom Architecture
 */

import { describe, it, expect } from '@jest/globals';
import { extractWikiLinks, findIncomingLinks } from '../../../lib/memory-core.js';

describe('extractWikiLinks', () => {
  it('should extract simple wiki link', () => {
    const content = 'See [[Chapter 1]] for details';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'Chapter 1',
      entity_id: null,
      label: 'Chapter 1',
      isEmbed: false,
    });
  });

  it('should extract wiki link with custom label', () => {
    const content = 'See [[Chapter 1|First Chapter]] for details';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'Chapter 1',
      entity_id: null,
      label: 'First Chapter',
      isEmbed: false,
    });
  });

  it('should extract embedded wiki link', () => {
    const content = '![[image.png]]';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'image.png',
      entity_id: null,
      label: 'image.png',
      isEmbed: true,
    });
  });

  it('should extract multiple wiki links', () => {
    const content = 'See [[Chapter 1]] and [[Chapter 2|Next]]';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({
      target: 'Chapter 1',
      entity_id: null,
      label: 'Chapter 1',
      isEmbed: false,
    });
    expect(links[1]).toEqual({
      target: 'Chapter 2',
      entity_id: null,
      label: 'Next',
      isEmbed: false,
    });
  });

  it('should return empty array for no links', () => {
    const content = 'Plain text without links';
    const links = extractWikiLinks(content);

    expect(links).toEqual([]);
  });

  it('should handle empty content', () => {
    const links = extractWikiLinks('');
    expect(links).toEqual([]);
  });

  it('should extract atom ID links', () => {
    const content = 'See [[01ATOM001]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: '01ATOM001',
      entity_id: null,
      label: '01ATOM001',
      isEmbed: false,
    });
  });

  it('should extract cross-entity wiki link', () => {
    const content = 'See [[01DEF456/01GHI789]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: '01GHI789',
      entity_id: '01DEF456',
      label: '01GHI789',
      isEmbed: false,
    });
  });

  it('should extract cross-entity wiki link with alias', () => {
    const content = 'See [[01DEF456/01GHI789|Display Name]] for details';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: '01GHI789',
      entity_id: '01DEF456',
      label: 'Display Name',
      isEmbed: false,
    });
  });

  it('should extract embedded cross-entity wiki link', () => {
    const content = '![[01DEF456/01GHI789]]';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: '01GHI789',
      entity_id: '01DEF456',
      label: '01GHI789',
      isEmbed: true,
    });
  });

  it('should handle ] character in label (first ]] wins)', () => {
    // [[Chapter 1|array[0]]] - the first ]] terminates the link, label is array[0
    const content = 'See [[Chapter 1|array[0]]] for details';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'Chapter 1',
      entity_id: null,
      label: 'array[0',
      isEmbed: false,
    });
  });

  it('should handle ] character in cross-entity target', () => {
    // [[01DEF/01GHI]X]] - the ] in the target is not ]] so it should be part of the target
    const content = 'See [[01DEF/01GHI]X]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: '01GHI]X',
      entity_id: '01DEF',
      label: '01GHI]X',
      isEmbed: false,
    });
  });

  it('should handle ] and | characters in label together', () => {
    // [[Chapter 1|a]b|c]] - ] and | inside label, only ]] terminates
    const content = 'See [[Chapter 1|a]b|c]] for details';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'Chapter 1',
      entity_id: null,
      label: 'a]b|c',
      isEmbed: false,
    });
  });

  it('should handle ] in same-entity target', () => {
    // [[A]B]] - single ] in target is valid, ]] terminates
    const content = 'See [[A]B]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'A]B',
      entity_id: null,
      label: 'A]B',
      isEmbed: false,
    });
  });

  it('should extract mixed same-entity and cross-entity links', () => {
    const content = 'See [[01ATOM001]] and [[01ENT/01ATOM]] and [[01ENT/01ATOM|Alias]]';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(3);
    expect(links[0]).toEqual({
      target: '01ATOM001',
      entity_id: null,
      label: '01ATOM001',
      isEmbed: false,
    });
    expect(links[1]).toEqual({
      target: '01ATOM',
      entity_id: '01ENT',
      label: '01ATOM',
      isEmbed: false,
    });
    expect(links[2]).toEqual({
      target: '01ATOM',
      entity_id: '01ENT',
      label: 'Alias',
      isEmbed: false,
    });
  });

  it('should handle unclosed links', () => {
    const content = 'See [[abc and more text';
    const links = extractWikiLinks(content);
    expect(links).toEqual([]);
  });

  it('should handle empty target', () => {
    const content = 'See [[]] for nothing';
    const links = extractWikiLinks(content);
    expect(links).toEqual([]);
  });

  it('should handle double slashes as entity_id and target', () => {
    const content = 'See [[entity//atom]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: '/atom',
      entity_id: 'entity',
      label: '/atom',
      isEmbed: false,
    });
  });

  it('should handle multiple pipes (first pipe separates label)', () => {
    const content = 'See [[abc|b|c]] for details';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'abc',
      entity_id: null,
      label: 'b|c',
      isEmbed: false,
    });
  });

  it('should handle cross-entity link with multiple pipes', () => {
    const content = 'See [[ENT/ATOM|b|c]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'ATOM',
      entity_id: 'ENT',
      label: 'b|c',
      isEmbed: false,
    });
  });

  it('should handle whitespace-only target', () => {
    const content = 'See [[   ]] for nothing';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0].target).toBe('   ');
    expect(links[0].label).toBe('   ');
  });

  it('should handle link with only pipe and no label', () => {
    const content = 'See [[abc|]] for reference';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: 'abc|',
      entity_id: null,
      label: 'abc|',
      isEmbed: false,
    });
  });

  it('should handle adjacent wiki links without separator', () => {
    const content = '[[A]][[B]][[C]]';
    const links = extractWikiLinks(content);

    expect(links).toHaveLength(3);
    expect(links[0].target).toBe('A');
    expect(links[1].target).toBe('B');
    expect(links[2].target).toBe('C');
  });
});

describe('findIncomingLinks', () => {
  it('should find incoming links to target atom', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        content: 'Chapter 1 content',
        children: [],
      },
      {
        local_id: '01ATOM002',
        content: 'See [[01ATOM001]] for reference',
        children: [],
      },
    ];

    const incoming = findIncomingLinks(atoms, '01ATOM001');

    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toEqual({
      source: '01ATOM002',
      target: '01ATOM001',
      entity_id: null,
      label: '01ATOM001',
      isEmbed: false,
    });
  });

  it('should find multiple incoming links', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        content: 'Target atom',
        children: [],
      },
      {
        local_id: '01ATOM002',
        content: 'Link to [[01ATOM001]]',
        children: [],
      },
      {
        local_id: '01ATOM003',
        content: 'Also see [[01ATOM001|target]]',
        children: [],
      },
    ];

    const incoming = findIncomingLinks(atoms, '01ATOM001');

    expect(incoming).toHaveLength(2);
    expect(incoming[0]).toEqual({
      source: '01ATOM002',
      target: '01ATOM001',
      entity_id: null,
      label: '01ATOM001',
      isEmbed: false,
    });
    expect(incoming[1]).toEqual({
      source: '01ATOM003',
      target: '01ATOM001',
      entity_id: null,
      label: 'target',
      isEmbed: false,
    });
  });

  it('should find links in nested children', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        content: 'Target atom',
        children: [],
      },
      {
        local_id: '01ATOM002',
        content: 'Parent section',
        children: [
          {
            local_id: '01ATOM003',
            content: 'See [[01ATOM001]] here',
            children: [],
          },
        ],
      },
    ];

    const incoming = findIncomingLinks(atoms, '01ATOM001');

    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toEqual({
      source: '01ATOM003',
      target: '01ATOM001',
      entity_id: null,
      label: '01ATOM001',
      isEmbed: false,
    });
  });

  it('should return empty array when no incoming links', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        content: 'Orphan atom',
        children: [],
      },
      {
        local_id: '01ATOM002',
        content: 'Another atom',
        children: [],
      },
    ];

    const incoming = findIncomingLinks(atoms, '01ATOM001');

    expect(incoming).toEqual([]);
  });

  it('should handle empty atoms array', () => {
    const incoming = findIncomingLinks([], '01ATOM001');
    expect(incoming).toEqual([]);
  });

  it('should handle null atoms', () => {
    const incoming = findIncomingLinks(null, '01ATOM001');
    expect(incoming).toEqual([]);
  });

  it('should ignore cross-entity links for incoming detection', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        content: 'Target atom',
        children: [],
      },
      {
        local_id: '01ATOM002',
        content: 'Cross-entity link [[01ENT/01ATOM001]]',
        children: [],
      },
    ];

    const incoming = findIncomingLinks(atoms, '01ATOM001');
    expect(incoming).toEqual([]);
  });

  it('should detect embedded links', () => {
    const atoms = [
      {
        local_id: '01ATOM001',
        content: 'Target atom',
        children: [],
      },
      {
        local_id: '01ATOM002',
        content: '![[01ATOM001]]',
        children: [],
      },
    ];

    const incoming = findIncomingLinks(atoms, '01ATOM001');

    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toEqual({
      source: '01ATOM002',
      target: '01ATOM001',
      entity_id: null,
      label: '01ATOM001',
      isEmbed: true,
    });
  });
});
