import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { logger, logInfo, logWarn, logError, logDebug } from '../lib/logger.js';

describe('Logger Module', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('logger instance', () => {
    it('should export a logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have correct default level', () => {
      expect(logger.level).toBe('info');
    });
  });

  describe('logInfo', () => {
    it('should be a function', () => {
      expect(typeof logInfo).toBe('function');
    });

    it('should log info message with component', () => {
      expect(() => logInfo('TestComponent', 'Test message')).not.toThrow();
    });

    it('should log info message with metadata', () => {
      expect(() =>
        logInfo('TestComponent', 'Test message', { key: 'value' })
      ).not.toThrow();
    });
  });

  describe('logWarn', () => {
    it('should be a function', () => {
      expect(typeof logWarn).toBe('function');
    });

    it('should log warn message with component', () => {
      expect(() => logWarn('TestComponent', 'Warning message')).not.toThrow();
    });
  });

  describe('logError', () => {
    it('should be a function', () => {
      expect(typeof logError).toBe('function');
    });

    it('should log error message with Error object', () => {
      const error = new Error('Test error');
      expect(() =>
        logError('TestComponent', 'Error occurred', error)
      ).not.toThrow();
    });

    it('should log error message with string error', () => {
      expect(() =>
        logError('TestComponent', 'Error occurred', 'string error')
      ).not.toThrow();
    });

    it('should log error message with metadata', () => {
      const error = new Error('Test error');
      expect(() =>
        logError('TestComponent', 'Error occurred', error, { context: 'test' })
      ).not.toThrow();
    });
  });

  describe('logDebug', () => {
    it('should be a function', () => {
      expect(typeof logDebug).toBe('function');
    });

    it('should log debug message with component', () => {
      expect(() => logDebug('TestComponent', 'Debug message')).not.toThrow();
    });
  });
});
