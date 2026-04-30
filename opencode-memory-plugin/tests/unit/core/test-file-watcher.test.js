/**
 * Test Suite - FileWatcher
 * Coverage: handleFileChange, processPendingFiles, stop
 * Mock: chokidar, code-analysis-service, privacy-filter, storage
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('chokidar', () => ({
  watch: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    close: jest.fn(),
  }),
}));

jest.unstable_mockModule('../lib/storage.js', () => ({
  getConfig: jest.fn().mockReturnValue({ code_analysis: {} }),
}));

jest.unstable_mockModule('../lib/code-analysis-service.js', () => ({
  onFileSaved: jest.fn(),
}));

jest.unstable_mockModule('../lib/privacy-filter.js', () => ({
  shouldSkipFile: jest.fn().mockReturnValue({ skip: false }),
}));

const { FileWatcher } = await import('../../../lib/file-watcher.js');
const { onFileSaved } = await import('../../../lib/code-analysis-service.js');
const { shouldSkipFile } = await import('../../../lib/privacy-filter.js');

describe('FileWatcher', () => {
  let watcher;

  beforeEach(() => {
    watcher = new FileWatcher('/project');
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    watcher.stop();
    jest.useRealTimers();
  });

  it('handleFileChange → adds to pendingFiles and debounces', () => {
    watcher.handleFileChange('src/test.js');
    expect(watcher.pendingFiles.has('/project/src/test.js')).toBe(true);
    expect(onFileSaved).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);
    expect(onFileSaved).toHaveBeenCalledWith('/project/src/test.js', '/project');
    expect(watcher.pendingFiles.size).toBe(0);
  });

  it('handleFileChange → excluded file not added', () => {
    shouldSkipFile.mockReturnValueOnce({ skip: true, reason: 'excluded_file' });
    watcher.handleFileChange('.env');
    expect(watcher.pendingFiles.size).toBe(0);
  });

  it('multiple rapid changes → debounced to single processPendingFiles call', () => {
    watcher.handleFileChange('src/a.js');
    watcher.handleFileChange('src/b.js');
    watcher.handleFileChange('src/c.js');

    jest.advanceTimersByTime(300);
    expect(onFileSaved).toHaveBeenCalledTimes(3);
    expect(watcher.pendingFiles.size).toBe(0);
  });

  it('stop → clears pendingFiles and timer', () => {
    watcher.handleFileChange('src/test.js');
    watcher.stop();
    expect(watcher.pendingFiles.size).toBe(0);
    expect(watcher.debounceTimer).toBeNull();
  });
});
