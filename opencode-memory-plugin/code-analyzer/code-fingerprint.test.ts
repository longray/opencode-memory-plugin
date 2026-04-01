import { test, expect, describe } from 'bun:test';
import { CodeFingerprint } from '../lib/code-fingerprint.js';

describe('BL-23: Code Fingerprint', () => {
  const fingerprint = new CodeFingerprint('/tmp/test-project');

  test('1. 应计算内容指纹', () => {
    const content = 'const x = 1;';
    const hash = fingerprint.calculateContentHash(content);

    expect(hash).toBeDefined();
    expect(hash.length).toBe(16);
    expect(typeof hash).toBe('string');
  });

  test('2. 相同内容应产生相同指纹', () => {
    const content = 'const x = 1;';
    const hash1 = fingerprint.calculateContentHash(content);
    const hash2 = fingerprint.calculateContentHash(content);

    expect(hash1).toBe(hash2);
  });

  test('3. 不同内容应产生不同指纹', () => {
    const hash1 = fingerprint.calculateContentHash('const x = 1;');
    const hash2 = fingerprint.calculateContentHash('const x = 2;');

    expect(hash1).not.toBe(hash2);
  });

  test('4. 应计算符号指纹', () => {
    const analysisResult = {
      functions: [{ name: 'foo' }, { name: 'bar' }],
      classes: [{ name: 'MyClass' }],
      interfaces: [{ name: 'IMyInterface' }],
    };

    const hash = fingerprint.calculateSymbolsHash(analysisResult);

    expect(hash).toBeDefined();
    expect(hash.length).toBeGreaterThan(0);
    expect(hash).not.toBe('empty');
  });

  test('5. 相同符号应产生相同指纹', () => {
    const analysisResult = {
      functions: [{ name: 'foo' }],
      classes: [],
      interfaces: [],
    };

    const hash1 = fingerprint.calculateSymbolsHash(analysisResult);
    const hash2 = fingerprint.calculateSymbolsHash(analysisResult);

    expect(hash1).toBe(hash2);
  });

  test('6. 应检测新文件', () => {
    const content = 'const x = 1;';
    const analysisResult = { functions: [], classes: [], interfaces: [] };

    const result = fingerprint.hasChanged('new-file.js', content, analysisResult);

    expect(result.changed).toBe(true);
    expect(result.reason).toBe('new_file');
    expect(result.fingerprint).toBeDefined();
  });

  test('7. 应检测内容变化', () => {
    fingerprint.localFingerprints = {
      'test.js': {
        file_path: 'test.js',
        content_hash: 'oldhash',
        symbols_hash: 'symbolshash',
      },
    };

    const content = 'const x = 1;';
    const analysisResult = { functions: [], classes: [], interfaces: [] };

    const result = fingerprint.hasChanged('test.js', content, analysisResult);

    expect(result.changed).toBe(true);
    expect(result.reason).toBe('content_changed');
  });

  test('8. 应检测未变化', () => {
    const content = 'const x = 1;';
    const analysisResult = { functions: [], classes: [], interfaces: [] };
    const hash = fingerprint.calculateContentHash(content);

    fingerprint.localFingerprints = {
      'test.js': {
        file_path: 'test.js',
        content_hash: hash,
        symbols_hash: 'empty',
      },
    };

    const result = fingerprint.hasChanged('test.js', content, analysisResult);

    expect(result.changed).toBe(false);
  });

  test('9. 应判断是否需要上传', async () => {
    const content = 'const x = 1;';
    const analysisResult = { functions: [], classes: [], interfaces: [] };

    const result = await fingerprint.shouldUpload('new-file.js', content, analysisResult);

    expect(result.shouldUpload).toBe(true);
    expect(result.fingerprint).toBeDefined();
  });
});
