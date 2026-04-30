/**
 * Tests for entry.js Atom support
 * TDD for v3.3 Atom Architecture
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { buildEntryContent, parseEntryFromFile } from '../../../lib/entry.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('buildEntryContent with Atoms', () => {
  it('should generate entry without atoms (backward compatible)', () => {
    const data = {
      id: '01TEST123',
      date: '2026-04-28T10:00:00.000Z',
      type: 'memory',
      tags: ['test'],
      project: 'test-project',
      memory_id: 'pending',
      source_id: '',
      synced: false,
      meta: [],
      abstract: 'Test abstract',
      overview: '{"key": "value"}',
      content: 'Test content',
    };

    const result = buildEntryContent(data);

    expect(result).toContain('# ≡≡≡ Abstract ≡≡≡');
    expect(result).toContain('Test abstract');
    expect(result).toContain('# ≡≡≡ Overview ≡≡≡');
    expect(result).toContain('{"key": "value"}');
    expect(result).toContain('# ≡≡≡ Contents ≡≡≡');
    expect(result).toContain('Test content');
    expect(result).not.toContain('# ≡≡≡ Atoms ≡≡≡');
  });

  it('should generate entry with atoms array', () => {
    const data = {
      id: '01TEST123',
      date: '2026-04-28T10:00:00.000Z',
      type: 'memory',
      tags: ['test'],
      project: 'test-project',
      memory_id: 'pending',
      source_id: '',
      synced: false,
      meta: [],
      abstract: 'Test abstract',
      overview: '{"key": "value"}',
      content: 'Test content',
      atoms: [
        {
          local_id: '01ATOM001',
          source_id: '01ATOM001',
          atom_id: null,
          type: 'chapter',
          name: 'Chapter 1',
          content: 'Chapter content',
          tags: ['chapter'],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [],
        },
      ],
    };

    const result = buildEntryContent(data);

    expect(result).toContain('# ≡≡≡ Atoms ≡≡≡');
    expect(result).toContain('01ATOM001');
    expect(result).toContain('Chapter 1');
    expect(result).toContain('```json');
    expect(result).toContain('```');
  });

  it('should generate entry with nested atoms', () => {
    const data = {
      id: '01TEST123',
      date: '2026-04-28T10:00:00.000Z',
      type: 'memory',
      tags: ['test'],
      project: 'test-project',
      memory_id: 'pending',
      source_id: '',
      synced: false,
      meta: [],
      abstract: 'Test abstract',
      overview: '{"key": "value"}',
      content: 'Test content',
      atoms: [
        {
          local_id: '01ATOM001',
          source_id: '01ATOM001',
          atom_id: null,
          type: 'chapter',
          name: 'Chapter 1',
          content: 'Chapter content',
          tags: ['chapter'],
          aliases: [],
          order: 'a0',
          heading_level: 1,
          parent_id: null,
          children: [
            {
              local_id: '01ATOM002',
              source_id: '01ATOM002',
              atom_id: null,
              type: 'section',
              name: 'Section 1.1',
              content: 'Section content',
              tags: [],
              aliases: [],
              order: 'a0',
              heading_level: 2,
              parent_id: '01ATOM001',
              children: [],
            },
          ],
        },
      ],
    };

    const result = buildEntryContent(data);

    expect(result).toContain('# ≡≡≡ Atoms ≡≡≡');
    expect(result).toContain('01ATOM001');
    expect(result).toContain('01ATOM002');
    expect(result).toContain('Section 1.1');

    // Verify JSON is valid
    const atomsMatch = result.match(/```json\n([\s\S]*?)\n```/);
    expect(atomsMatch).toBeTruthy();
    const atoms = JSON.parse(atomsMatch[1]);
    expect(atoms).toHaveLength(1);
    expect(atoms[0].children).toHaveLength(1);
    expect(atoms[0].children[0].local_id).toBe('01ATOM002');
  });

  it('should handle empty atoms array', () => {
    const data = {
      id: '01TEST123',
      date: '2026-04-28T10:00:00.000Z',
      type: 'memory',
      tags: ['test'],
      project: 'test-project',
      memory_id: 'pending',
      source_id: '',
      synced: false,
      meta: [],
      abstract: 'Test abstract',
      overview: '{"key": "value"}',
      content: 'Test content',
      atoms: [],
    };

    const result = buildEntryContent(data);

    expect(result).toContain('# ≡≡≡ Atoms ≡≡≡');
    expect(result).toContain('```json\n[]\n```');
  });
});

describe('parseEntryFromFile with Atoms', () => {
  let tempDir;
  let tempFile;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-test-'));
    tempFile = path.join(tempDir, 'test-entry.md');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should parse entry without atoms section', () => {
    const content = `---
id: 01TEST123
date: 2026-04-28T10:00:00.000Z
type: memory
tags: [test]
project: test-project
memory_id: pending
source_id: ''
synced: false
meta: []
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
Test abstract
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
{"key": "value"}
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
Test content
\`\`\`

---
`;

    fs.writeFileSync(tempFile, content);
    const result = parseEntryFromFile(tempFile);

    expect(result).toBeTruthy();
    expect(result.frontmatter.id).toBe('01TEST123');
    expect(result.abstract).toBe('Test abstract');
    expect(result.overview).toBe('{"key": "value"}');
    expect(result.content).toBe('Test content');
    expect(result.atoms).toBeNull();
  });

  it('should parse entry with atoms section', () => {
    const content = `---
id: 01TEST123
date: 2026-04-28T10:00:00.000Z
type: memory
tags: [test]
project: test-project
memory_id: pending
source_id: ''
synced: false
meta: []
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
Test abstract
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
{"key": "value"}
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
Test content
\`\`\`

# ≡≡≡ Atoms ≡≡≡
\`\`\`json
[
  {
    "local_id": "01ATOM001",
    "source_id": "01ATOM001",
    "atom_id": null,
    "type": "chapter",
    "name": "Chapter 1",
    "content": "Chapter content",
    "tags": ["chapter"],
    "aliases": [],
    "order": "a0",
    "heading_level": 1,
    "parent_id": null,
    "children": []
  }
]
\`\`\`

---
`;

    fs.writeFileSync(tempFile, content);
    const result = parseEntryFromFile(tempFile);

    expect(result).toBeTruthy();
    expect(result.atoms).toBeTruthy();
    expect(result.atoms).toHaveLength(1);
    expect(result.atoms[0].local_id).toBe('01ATOM001');
    expect(result.atoms[0].name).toBe('Chapter 1');
  });

  it('should parse entry with nested atoms', () => {
    const content = `---
id: 01TEST123
date: 2026-04-28T10:00:00.000Z
type: memory
tags: [test]
project: test-project
memory_id: pending
source_id: ''
synced: false
meta: []
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
Test abstract
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
{"key": "value"}
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
Test content
\`\`\`

# ≡≡≡ Atoms ≡≡≡
\`\`\`json
[
  {
    "local_id": "01ATOM001",
    "source_id": "01ATOM001",
    "atom_id": null,
    "type": "chapter",
    "name": "Chapter 1",
    "content": "Chapter content",
    "tags": ["chapter"],
    "aliases": [],
    "order": "a0",
    "heading_level": 1,
    "parent_id": null,
    "children": [
      {
        "local_id": "01ATOM002",
        "source_id": "01ATOM002",
        "atom_id": null,
        "type": "section",
        "name": "Section 1.1",
        "content": "Section content",
        "tags": [],
        "aliases": [],
        "order": "a0",
        "heading_level": 2,
        "parent_id": "01ATOM001",
        "children": []
      }
    ]
  }
]
\`\`\`

---
`;

    fs.writeFileSync(tempFile, content);
    const result = parseEntryFromFile(tempFile);

    expect(result).toBeTruthy();
    expect(result.atoms).toHaveLength(1);
    expect(result.atoms[0].children).toHaveLength(1);
    expect(result.atoms[0].children[0].local_id).toBe('01ATOM002');
  });

  it('should handle invalid atoms JSON gracefully', () => {
    const content = `---
id: 01TEST123
date: 2026-04-28T10:00:00.000Z
type: memory
tags: [test]
project: test-project
memory_id: pending
source_id: ''
synced: false
meta: []
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
Test abstract
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
{"key": "value"}
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
Test content
\`\`\`

# ≡≡≡ Atoms ≡≡≡
\`\`\`json
[invalid json
\`\`\`

---
`;

    fs.writeFileSync(tempFile, content);
    const result = parseEntryFromFile(tempFile);

    expect(result).toBeTruthy();
    expect(result.atoms).toBeNull();
  });
});
