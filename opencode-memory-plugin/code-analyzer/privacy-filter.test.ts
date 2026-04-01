import { test, expect, describe } from 'bun:test';
import { isExcludedFile, containsSensitiveInfo, shouldSkipFile } from '../lib/privacy-filter.js';

describe('BL-19: Privacy Filter', () => {
  test('1. 应正确识别排除的文件', () => {
    const excludedFiles = [
      '/project/.env',
      '/project/.env.local',
      '/project/.env.production',
      '/project/node_modules/foo.js',
      '/project/.git/config',
      '/project/config.json',
      '/project/.htpasswd',
      '/project/.npmrc',
    ];

    for (const file of excludedFiles) {
      const result = isExcludedFile(file);
      expect(result.excluded).toBe(true);
    }
  });

  test('2. 应正确识别非排除的文件', () => {
    const normalFiles = [
      '/project/src/index.js',
      '/project/src/utils.ts',
      '/project/README.md',
      '/project/package.json',
    ];

    for (const file of normalFiles) {
      const result = isExcludedFile(file);
      expect(result.excluded).toBe(false);
    }
  });

  test('3. 应检测敏感信息', () => {
    const sensitiveCodes = [
      { code: 'const password = "test_password_value"', type: 'password' },
      { code: 'const api_key = "test_api_key_value"', type: 'api_key' },
      { code: 'const secret = "test_secret_value"', type: 'secret' },
      { code: 'const token = "test_token_value"', type: 'token' },
    ];

    for (const { code, type } of sensitiveCodes) {
      const result = containsSensitiveInfo(code);
      expect(result.hasSensitive).toBe(true);
      expect(result.patterns.some(p => p.type === type)).toBe(true);
    }
  });

  test('4. 应识别非敏感代码', () => {
    const normalCode = `
      function greet(name) {
        return \`Hello, \${name}!\`;
      }
      
      const greeting = "hello world";
      const count = 42;
    `;

    const result = containsSensitiveInfo(normalCode);
    expect(result.hasSensitive).toBe(false);
  });

  test('5. 应综合判断跳过文件', () => {
    const sensitiveCode = 'const password = "test_password_value"';

    const excludedResult = shouldSkipFile('/project/.env');
    expect(excludedResult.skip).toBe(true);
    expect(excludedResult.reason).toBe('excluded_file');

    const sensitiveResult = shouldSkipFile('/project/src/config.js', sensitiveCode);
    expect(sensitiveResult.skip).toBe(true);
    expect(sensitiveResult.reason).toBe('sensitive_content');

    const normalResult = shouldSkipFile('/project/src/index.js', 'const x = 1');
    expect(normalResult.skip).toBe(false);
  });

  test('6. 应返回敏感信息详情', () => {
    const code = `
      const password = "test_password_value";
      const api_key = "test_api_key_value";
      const token = "test_token_value";
    `;

    const result = containsSensitiveInfo(code);
    expect(result.hasSensitive).toBe(true);
    expect(result.patterns.length).toBeGreaterThanOrEqual(2);

    for (const pattern of result.patterns) {
      expect(pattern.type).toBeDefined();
      expect(pattern.count).toBeGreaterThanOrEqual(1);
    }
  });
});
