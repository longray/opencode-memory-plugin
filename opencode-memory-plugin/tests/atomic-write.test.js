/**
 * Test Suite - Atomic Write Module
 * Tests for atomicWriteText and atomicWriteJson functions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { atomicWriteText, atomicWriteJson } from '../lib/atomic-write.js';

// Get the current directory (tests/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Atomic Write Module', () => {
  let tmpDir;

  beforeEach(() => {
    // Create a temporary directory for tests
    tmpDir = path.join(__dirname, 'tmp_test_dir');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up temporary directory after each test
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('atomicWriteText', () => {
    it('should write file correctly under normal conditions', () => {
      const testFile = path.join(tmpDir, 'test.txt');
      const content = 'hello world';
      
      atomicWriteText(testFile, content);
      
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
      
      // Ensure no temporary file remains
      const tmpFile = testFile + '.tmp';
      expect(fs.existsSync(tmpFile)).toBe(false);
    });

    it('should handle EXDEV error by falling back to copy + unlink', () => {
      const testFile = path.join(tmpDir, 'test-exdev.txt');
      const content = 'exdev test';
      const tmpFile = testFile + '.tmp';
      
      // Mock fs.renameSync to throw EXDEV error
      const originalRenameSync = fs.renameSync;
      fs.renameSync = jest.fn().mockImplementation(() => {
        const error = new Error('EXDEV: cross-device link not permitted');
        error.code = 'EXDEV';
        throw error;
      });
      
      // Spy on copyFileSync and unlinkSync to verify they are called
      const copyFileSyncSpy = jest.spyOn(fs, 'copyFileSync');
      const unlinkSyncSpy = jest.spyOn(fs, 'unlinkSync');
      
      try {
        atomicWriteText(testFile, content);
        
        expect(fs.existsSync(testFile)).toBe(true);
        expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
        
        // Verify that copyFileSync and unlinkSync were called
        expect(copyFileSyncSpy).toHaveBeenCalledWith(tmpFile, testFile);
        expect(unlinkSyncSpy).toHaveBeenCalledWith(tmpFile);
        
        // Verify that renameSync was called and threw EXDEV
        expect(fs.renameSync).toHaveBeenCalledWith(tmpFile, testFile);
      } finally {
        // Restore original functions
        fs.renameSync = originalRenameSync;
        copyFileSyncSpy.mockRestore();
        unlinkSyncSpy.mockRestore();
      }
    });

    it('should propagate non-EXDEV errors', () => {
      const testFile = path.join(tmpDir, 'test-error.txt');
      const content = 'error test';
      
      // Mock fs.renameSync to throw a non-EXDEV error
      const originalRenameSync = fs.renameSync;
      fs.renameSync = jest.fn().mockImplementation(() => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        throw error;
      });
      
      expect(() => {
        atomicWriteText(testFile, content);
      }).toThrow('Permission denied');
      
      // Restore original function
      fs.renameSync = originalRenameSync;
    });

    it('should handle writeFileSync errors', () => {
      const testFile = path.join(tmpDir, 'test-write-error.txt');
      const content = 'write error test';
      
      // Mock fs.writeFileSync to throw an error
      const originalWriteFileSync = fs.writeFileSync;
      fs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('Disk full');
      });
      
      expect(() => {
        atomicWriteText(testFile, content);
      }).toThrow('Disk full');
      
      // Restore original function
      fs.writeFileSync = originalWriteFileSync;
    });
  });

  describe('atomicWriteJson', () => {
    it('should serialize and write JSON data correctly', () => {
      const testFile = path.join(tmpDir, 'test.json');
      const data = { foo: 'bar', count: 42, nested: { a: 1, b: 2 } };
      
      atomicWriteJson(testFile, data);
      
      expect(fs.existsSync(testFile)).toBe(true);
      const content = fs.readFileSync(testFile, 'utf-8');
      const parsedData = JSON.parse(content);
      expect(parsedData).toEqual(data);
      
      // Check that the JSON is properly formatted with 2-space indentation
      expect(content).toContain('  "foo": "bar"');
      expect(content).toContain('  "nested": {\n    "a": 1,\n    "b": 2\n  }');
      
      // Ensure no temporary file remains
      const tmpFile = testFile + '.tmp';
      expect(fs.existsSync(tmpFile)).toBe(false);
    });

    it('should allow custom indentation', () => {
      const testFile = path.join(tmpDir, 'test-custom-indent.json');
      const data = { x: 1, y: 2 };
      
      // Use 4-space indentation
      atomicWriteJson(testFile, data, 4);
      
      expect(fs.existsSync(testFile)).toBe(true);
      const content = fs.readFileSync(testFile, 'utf-8');
      
      // Check that the JSON uses 4-space indentation
      expect(content).toContain('    "x": 1');
      expect(content).toContain('    "y": 2');
    });

    it('should handle JSON serialization errors', () => {
      const testFile = path.join(tmpDir, 'test-json-error.json');
      // Create circular reference to cause JSON serialization error
      const circularObj = { a: 1 };
      circularObj.b = circularObj;
      
      expect(() => {
        atomicWriteJson(testFile, circularObj);
      }).toThrow();
    });
  });

  describe('temporary file cleanup', () => {
    it('should clean up temporary file on successful write', () => {
      const testFile = path.join(tmpDir, 'cleanup-test.txt');
      const content = 'cleanup test';
      const tmpFile = testFile + '.tmp';
      
      atomicWriteText(testFile, content);
      
      // Verify target file exists
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
      
      // Verify temporary file does not exist
      expect(fs.existsSync(tmpFile)).toBe(false);
    });

    it('should clean up temporary file when EXDEV fallback occurs', () => {
      const testFile = path.join(tmpDir, 'cleanup-exdev-test.txt');
      const content = 'exdev cleanup test';
      const tmpFile = testFile + '.tmp';
      
      // Mock fs.renameSync to throw EXDEV error
      const originalRenameSync = fs.renameSync;
      fs.renameSync = jest.fn().mockImplementation(() => {
        const error = new Error('EXDEV: cross-device link not permitted');
        error.code = 'EXDEV';
        throw error;
      });
      
      try {
        atomicWriteText(testFile, content);
        
        // Verify target file exists
        expect(fs.existsSync(testFile)).toBe(true);
        expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
        
        // Verify temporary file does not exist (was cleaned up by unlinkSync)
        expect(fs.existsSync(tmpFile)).toBe(false);
      } finally {
        fs.renameSync = originalRenameSync;
      }
    });

    it('should clean up temporary file when non-EXDEV error occurs', () => {
      const testFile = path.join(tmpDir, 'cleanup-error-test.txt');
      const content = 'error cleanup test';
      const tmpFile = testFile + '.tmp';
      
      // Mock fs.writeFileSync to create the tmp file and then throw an error in renameSync
      const originalWriteFileSync = fs.writeFileSync;
      const originalRenameSync = fs.renameSync;
      
      fs.writeFileSync = jest.fn((filePath, data, encoding) => {
        // Actually write the file so we can test cleanup
        originalWriteFileSync(filePath, data, encoding);
      });
      
      fs.renameSync = jest.fn().mockImplementation(() => {
        const error = new Error('Permission denied');
        error.code = 'EACCES';
        throw error;
      });
      
      try {
        atomicWriteText(testFile, content);
        // Should not reach here
        expect(true).toBe(false);
      } catch (_error) {
        // Verify target file does not exist
        expect(fs.existsSync(testFile)).toBe(false);
        
        // Verify temporary file was cleaned up despite the error
        expect(fs.existsSync(tmpFile)).toBe(false);
      } finally {
        // Restore original functions
        fs.writeFileSync = originalWriteFileSync;
        fs.renameSync = originalRenameSync;
      }
    });
  });
});