/**
 * Test Suite - Extractor Module
 * Tests for extractByLevel function
 */

import { describe, it, expect } from '@jest/globals';
import { extractByLevel, getEntryInfo } from '../../../lib/extractor.js';

describe('Extractor Module', () => {
  describe('extractByLevel', () => {
    const sampleContent = `---
id: entry-001
date: 2026-03-28T00:00:00.000Z
type: general
tags: [test]
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
This is the abstract
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
This is the overview with more details
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
This is the full content with all details
\`\`\`

---
`;

    it('should extract abstract (level 0)', () => {
      const result = extractByLevel(sampleContent, 0);

      expect(result).toBe('This is the abstract');
    });

    it('should extract overview (level 1)', () => {
      const result = extractByLevel(sampleContent, 1);

      expect(result).toContain('This is the abstract');
      expect(result).toContain('This is the overview with more details');
    });

    it('should extract full content (level 2)', () => {
      const result = extractByLevel(sampleContent, 2);

      expect(result).toContain('This is the abstract');
      expect(result).toContain('This is the overview with more details');
      expect(result).toContain('This is the full content with all details');
    });

    it('should return full content for invalid level', () => {
      const result = extractByLevel(sampleContent, 3);

      expect(result).toContain('id: entry-001');
    });

    it('should handle content without sections', () => {
      const content = `---
id: entry-002
---
No sections here`;

      const result = extractByLevel(content, 0);

      expect(result).toBe('');
    });
  });

  describe('getEntryInfo', () => {
    it('should return null for content without frontmatter', () => {
      const result = getEntryInfo('No frontmatter here');

      expect(result).toBeNull();
    });

    it('should parse basic frontmatter fields', () => {
      const content = `---
id: entry-100
date: 2026-03-29T00:00:00.000Z
type: decision
tags: [test, unit]
project: my-project
---
Some body text`;

      const result = getEntryInfo(content);

      expect(result).not.toBeNull();
      expect(result.id).toBe('entry-100');
      expect(result.type).toBe('decision');
      expect(result.tags).toBe('[test, unit]');
      expect(result.project).toBe('my-project');
    });

    it('should parse meta field as JSON array', () => {
      const content = `---
id: entry-101
meta: [{"source":"cli","priority":"high"}]
---
Body`;

      const result = getEntryInfo(content);

      expect(result).not.toBeNull();
      expect(result.meta).toEqual([{ source: 'cli', priority: 'high' }]);
    });

    it('should fallback to string for invalid JSON meta', () => {
      const content = `---
id: entry-102
meta: [invalid json
---
Body`;

      const result = getEntryInfo(content);

      expect(result).not.toBeNull();
      expect(result.meta).toBe('[invalid json');
    });

    it('should skip lines without colon', () => {
      const content = `---
id: entry-103
this line has no colon separator
type: general
---
Body`;

      const result = getEntryInfo(content);

      expect(result).not.toBeNull();
      expect(result.id).toBe('entry-103');
      expect(result.type).toBe('general');
    });

    it('should handle values containing colons', () => {
      const content = `---
id: entry-104
date: 2026-03-29T12:30:00.000Z
url: https://example.com:8080/path
---
Body`;

      const result = getEntryInfo(content);

      expect(result).not.toBeNull();
      expect(result.url).toBe('https://example.com:8080/path');
    });
  });
});
