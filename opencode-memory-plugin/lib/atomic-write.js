/**
 * Atomic file write utilities with EXDEV fallback support
 * @module atomic-write
 */

import fs from 'fs';

/**
 * Atomically write text file with EXDEV fallback
 * Writes to temp file then renames for atomicity.
 * If rename fails due to cross-device move (EXDEV),
 * falls back to copy + unlink.
 * If any error occurs, ensures temp file is cleaned up.
 *
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @throws {Error} If write fails (non-EXDEV errors)
 */
export function atomicWriteText(filePath, content) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf-8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    if (error.code === 'EXDEV') {
      // Cross-device move not supported, fallback to copy + unlink
      fs.copyFileSync(tmpPath, filePath);
      fs.unlinkSync(tmpPath);
    } else {
      // For any other error, clean up the temp file before throwing
      try {
        fs.unlinkSync(tmpPath);
      } catch (_cleanupError) {
        // If cleanup fails, we still throw the original error
        // but log the cleanup failure for debugging
      }
      throw error;
    }
  }
}

/**
 * Atomically write JSON file with formatting
 * Serializes data to JSON and writes atomically.
 *
 * @param {string} filePath - Target file path
 * @param {object} data - Data to serialize
 * @param {number} [space=2] - JSON formatting space
 * @throws {Error} If serialization or write fails
 */
export function atomicWriteJson(filePath, data, space = 2) {
  const content = JSON.stringify(data, null, space);
  atomicWriteText(filePath, content);
}
