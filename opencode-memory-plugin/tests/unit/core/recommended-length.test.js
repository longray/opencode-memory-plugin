/**
 * Test for RECOMMENDED_* length warnings (not rejections)
 */

import { writeMemory } from '../../../lib/memory-core.js';
import {
  RECOMMENDED_ABSTRACT_LENGTH,
  RECOMMENDED_OVERVIEW_LENGTH,
} from '../../../lib/constants.js';

describe('RECOMMENDED_* length behavior', () => {
  test('should accept abstract longer than recommended length with warning', async () => {
    const longAbstract = 'a'.repeat(RECOMMENDED_ABSTRACT_LENGTH + 50);
    const result = await writeMemory({
      abstract: longAbstract,
      overview: 'Test overview',
      content: 'Test content',
      type: 'test',
    });

    // Should succeed (not reject)
    expect(result.success).toBe(true);
    // Should have warning
    expect(result.warnings).toBeDefined();
    expect(
      result.warnings.some(w => w.includes('abstract length') && w.includes('exceeds recommended'))
    ).toBe(true);
  });

  test('should accept overview longer than recommended length with warning', async () => {
    const longOverview = 'b'.repeat(RECOMMENDED_OVERVIEW_LENGTH + 100);
    const result = await writeMemory({
      abstract: 'Test abstract',
      overview: longOverview,
      content: 'Test content',
      type: 'test',
    });

    // Should succeed (not reject)
    expect(result.success).toBe(true);
    // Should have warning
    expect(result.warnings).toBeDefined();
    expect(
      result.warnings.some(w => w.includes('overview length') && w.includes('exceeds recommended'))
    ).toBe(true);
  });

  test('should accept both fields within recommended length without warning', async () => {
    const result = await writeMemory({
      abstract: 'Short abstract',
      overview: 'Short overview',
      content: 'Test content',
      type: 'test',
    });

    expect(result.success).toBe(true);
    // Should not have length warnings
    const lengthWarnings =
      result.warnings?.filter(
        w => w.includes('abstract length') || w.includes('overview length')
      ) || [];
    expect(lengthWarnings.length).toBe(0);
  });
});
