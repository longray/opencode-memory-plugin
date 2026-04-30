/**
 * File size monitoring for Atom Architecture
 * Ensures single file stays within 100KB limit
 */

export const MAX_FILE_SIZE = 100 * 1024; // 100KB in bytes
export const WARNING_THRESHOLD = 0.9; // Warn at 90% of limit

/**
 * Check if content exceeds file size limit
 * @param {string} content - Content to check
 * @returns {Object} Check result {ok, size, warning, error}
 */
export function checkFileSize(content) {
  const size = Buffer.byteLength(content, 'utf8');
  const warningThreshold = MAX_FILE_SIZE * WARNING_THRESHOLD;

  if (size > MAX_FILE_SIZE) {
    return {
      ok: false,
      size,
      maxSize: MAX_FILE_SIZE,
      error: `Content size (${size} bytes) exceeds maximum limit (${MAX_FILE_SIZE} bytes)`,
    };
  }

  if (size > warningThreshold) {
    return {
      ok: true,
      size,
      maxSize: MAX_FILE_SIZE,
      warning: true,
      warningMessage: `Content size (${size} bytes) is approaching limit (${MAX_FILE_SIZE} bytes)`,
    };
  }

  return {
    ok: true,
    size,
    maxSize: MAX_FILE_SIZE,
    warning: false,
  };
}

/**
 * Estimate size of entry with atoms
 * @param {Object} entry - Entry with atoms
 * @returns {number} Estimated size in bytes
 */
export function estimateEntrySize(entry) {
  const { buildEntryContent } = require('./entry.js');

  try {
    const content = buildEntryContent(entry);
    return Buffer.byteLength(content, 'utf8');
  } catch {
    // Fallback: rough estimation
    let size = 0;
    if (entry.abstract) size += entry.abstract.length * 2;
    if (entry.overview) size += entry.overview.length * 2;
    if (entry.content) size += entry.content.length * 2;
    if (entry.atoms) {
      size += JSON.stringify(entry.atoms).length * 2;
    }
    return size;
  }
}

/**
 * Check if adding atoms would exceed size limit
 * @param {Object} entry - Existing entry
 * @param {Array} newAtoms - Atoms to add
 * @returns {Object} Check result
 */
export function checkAtomAddition(entry, newAtoms) {
  const currentSize = estimateEntrySize(entry);
  const additionalSize = JSON.stringify(newAtoms).length * 2;
  const projectedSize = currentSize + additionalSize;

  if (projectedSize > MAX_FILE_SIZE) {
    return {
      ok: false,
      currentSize,
      projectedSize,
      maxSize: MAX_FILE_SIZE,
      error: `Adding ${newAtoms.length} atom(s) would exceed size limit`,
    };
  }

  return {
    ok: true,
    currentSize,
    projectedSize,
    maxSize: MAX_FILE_SIZE,
  };
}
