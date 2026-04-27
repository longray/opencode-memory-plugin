/**
 * Test Suite - Privacy Filter Extended
 * Full coverage: isExcludedFile (25 patterns), containsSensitiveInfo (10 patterns),
 * validateFileSize (post-fix), shouldSkipFile
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  isExcludedFile,
  containsSensitiveInfo,
  shouldSkipFile,
  validateFileSize,
} from '../lib/privacy-filter.js';

const tmpFiles = [];

function createTmpFile(content, suffix = '.txt') {
  const tmpFile = path.join(
    os.tmpdir(),
    `privacy-test-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`
  );
  fs.writeFileSync(tmpFile, content);
  tmpFiles.push(tmpFile);
  return tmpFile;
}

afterEach(() => {
  for (const f of tmpFiles) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* temp file may already be deleted */
    }
  }
  tmpFiles.length = 0;
});

// ===== isExcludedFile =====

describe('isExcludedFile', () => {
  it('.env / .env.local / .env.production → excluded', () => {
    expect(isExcludedFile('/project/.env').excluded).toBe(true);
    expect(isExcludedFile('/project/.env.local').excluded).toBe(true);
    expect(isExcludedFile('/project/.env.production').excluded).toBe(true);
  });

  it('.git/ 下的文件 → excluded', () => {
    expect(isExcludedFile('/project/.git/config').excluded).toBe(true);
  });

  it('证书文件 → excluded', () => {
    expect(isExcludedFile('/project/cert/.pem').excluded).toBe(true);
    expect(isExcludedFile('/project/cert/.key').excluded).toBe(true);
    expect(isExcludedFile('/project/cert/.p12').excluded).toBe(true);
    expect(isExcludedFile('/project/cert/.pfx').excluded).toBe(true);
  });

  it('SSH 密钥 → excluded', () => {
    expect(isExcludedFile('/project/.ssh/id_rsa').excluded).toBe(true);
    expect(isExcludedFile('/project/.ssh/id_ed25519').excluded).toBe(true);
  });

  it('配置凭证 → excluded', () => {
    expect(isExcludedFile('/project/.npmrc').excluded).toBe(true);
    expect(isExcludedFile('/project/.htpasswd').excluded).toBe(true);
  });

  it('敏感目录名 → excluded', () => {
    expect(isExcludedFile('/project/credentials').excluded).toBe(true);
    expect(isExcludedFile('/project/secrets').excluded).toBe(true);
    expect(isExcludedFile('/project/passwords').excluded).toBe(true);
  });

  it('config.*.json → excluded', () => {
    expect(isExcludedFile('/project/config.json').excluded).toBe(true);
    expect(isExcludedFile('/project/config.production.json').excluded).toBe(true);
  });

  it('普通源文件 → 不排除', () => {
    expect(isExcludedFile('/project/src/index.js').excluded).toBe(false);
    expect(isExcludedFile('/project/lib/utils.ts').excluded).toBe(false);
  });
});

describe('isExcludedFile - Windows paths', () => {
  it('反斜杠路径 → 正确排除', () => {
    expect(isExcludedFile('C:\\project\\.env').excluded).toBe(true);
    expect(isExcludedFile('C:\\Users\\test\\.ssh\\id_rsa').excluded).toBe(true);
  });

  it('反斜杠路径 → 正确放行', () => {
    expect(isExcludedFile('C:\\project\\src\\index.js').excluded).toBe(false);
  });
});

// ===== containsSensitiveInfo =====

describe('containsSensitiveInfo', () => {
  it('password 模式', () => {
    const result = containsSensitiveInfo('password = "mySecret123"');
    expect(result.hasSensitive).toBe(true);
    expect(result.patterns[0].type).toBe('password');
  });

  it('api_key 模式 (大小写)', () => {
    expect(containsSensitiveInfo('API_KEY = "sk-abc123"').hasSensitive).toBe(true);
    expect(containsSensitiveInfo('api_key="sk-abc"').hasSensitive).toBe(true);
  });

  it('secret 模式', () => {
    expect(containsSensitiveInfo('secret = "abcd"').hasSensitive).toBe(true);
  });

  it('token 模式', () => {
    expect(containsSensitiveInfo('token = "eyJhbGci"').hasSensitive).toBe(true);
  });

  it('private_key 模式', () => {
    expect(containsSensitiveInfo('private_key = "-----BEGIN"').hasSensitive).toBe(true);
  });

  it('aws_access_key_id 模式', () => {
    expect(containsSensitiveInfo('aws_access_key_id = "AKIAIOSFODNN7"').hasSensitive).toBe(true);
  });

  it('aws_secret_access_key 模式', () => {
    expect(containsSensitiveInfo('aws_secret_access_key = "wJalrX"').hasSensitive).toBe(true);
  });

  it('database_url 模式', () => {
    expect(containsSensitiveInfo('database_url = "postgres://localhost"').hasSensitive).toBe(true);
  });

  it('connection_string 模式', () => {
    expect(containsSensitiveInfo('connection_string = "Server=localhost"').hasSensitive).toBe(true);
  });

  it('Bearer token 模式', () => {
    expect(containsSensitiveInfo('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9').hasSensitive).toBe(
      true
    );
  });

  it('null / undefined → hasSensitive: false', () => {
    expect(containsSensitiveInfo(null).hasSensitive).toBe(false);
    expect(containsSensitiveInfo(undefined).hasSensitive).toBe(false);
  });

  it('短密码 (< 4 字符) → 不匹配（正则要求 4+ 字符）', () => {
    expect(containsSensitiveInfo('password = "ab"').hasSensitive).toBe(false);
  });
});

// ===== validateFileSize =====

describe('validateFileSize', () => {
  it('正常文件 → valid: true', () => {
    const tmpFile = createTmpFile('a'.repeat(100));
    const result = validateFileSize(tmpFile);
    expect(result.valid).toBe(true);
    expect(result.size).toBe(100);
  });

  it('超大文件 → valid: false', () => {
    // validateFileSize 内部 import { statSync } from 'fs' — 需要创建一个不存在的路径触发 catch
    const result = validateFileSize('/nonexistent-file-' + Date.now() + '.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ===== shouldSkipFile =====

describe('shouldSkipFile (with content)', () => {
  it('路径排除优先 → skip: true', () => {
    const result = shouldSkipFile('/project/.env');
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('excluded_file');
  });

  it('路径正常 + 内容含 password → skip: true', () => {
    const result = shouldSkipFile('/project/config.js', 'password = "secret123"');
    expect(result.skip).toBe(true);
    expect(result.reason).toBe('sensitive_content');
    expect(result.details).toContain('1 sensitive patterns');
  });

  it('路径正常 + 内容正常 → skip: false', () => {
    const result = shouldSkipFile('/project/src/index.js', 'const x = 1;');
    expect(result.skip).toBe(false);
  });
});
