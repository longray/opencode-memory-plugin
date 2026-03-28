/**
 * Test Suite - Extractor Module
 * Tests for extractByLevel function
 */

import { describe, it, expect } from '@jest/globals';
import { extractByLevel } from '../lib/extractor.js';

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
});
