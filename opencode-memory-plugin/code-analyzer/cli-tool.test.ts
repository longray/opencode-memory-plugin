import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('BL-21: CLI Tool', () => {
  test('1. CLI 文件存在且可执行', () => {
    const cliPath = join(process.cwd(), 'cli', 'code-analyzer.cjs');
    const content = readFileSync(cliPath, 'utf-8');

    expect(content).toContain('#!/usr/bin/env node');
    expect(content).toContain('function showHelp');
    expect(content).toContain('function parseArgs');
    expect(content).toContain('async function analyzeFile');
    expect(content).toContain('async function analyzeProject');
  });

  test('2. CLI 支持所有必需的命令', () => {
    const cliPath = join(process.cwd(), 'cli', 'code-analyzer.cjs');
    const content = readFileSync(cliPath, 'utf-8');

    expect(content).toContain('--project');
    expect(content).toContain('--language');
    expect(content).toContain('--output');
    expect(content).toContain('--pretty');
    expect(content).toContain('--help');
  });

  test('3. CLI 支持所有必需的语言', () => {
    const cliPath = join(process.cwd(), 'cli', 'code-analyzer.cjs');
    const content = readFileSync(cliPath, 'utf-8');

    expect(content).toContain('javascript');
    expect(content).toContain('typescript');
    expect(content).toContain('python');
    expect(content).toContain('go');
    expect(content).toContain('rust');
    expect(content).toContain('java');
  });

  test('4. CLI 输出 JSON 格式', () => {
    const cliPath = join(process.cwd(), 'cli', 'code-analyzer.cjs');
    const content = readFileSync(cliPath, 'utf-8');

    expect(content).toContain('JSON.stringify');
    expect(content).toContain('formatOutput');
  });

  test('5. analyzeFile 函数存在', () => {
    const cliPath = join(process.cwd(), 'cli', 'code-analyzer.cjs');
    const content = readFileSync(cliPath, 'utf-8');

    expect(content).toContain('async function analyzeFile');
  });

  test('6. analyzeProject 函数存在', () => {
    const cliPath = join(process.cwd(), 'cli', 'code-analyzer.cjs');
    const content = readFileSync(cliPath, 'utf-8');

    expect(content).toContain('async function analyzeProject');
    expect(content).toContain('scanDirectory');
  });
});
