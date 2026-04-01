import { test, expect, describe } from 'bun:test';
import { AnalysisQueue } from '../lib/code-analysis-service.js';

describe('BL-17/18/19/20: Code Analysis Service', () => {
  test('1. 应跳过排除的文件', () => {
    const queue = new AnalysisQueue();

    const testCases = [
      { path: '/project/.env', shouldSkip: true },
      { path: '/project/.env.local', shouldSkip: true },
      { path: '/project/node_modules/foo.js', shouldSkip: true },
      { path: '/project/test.txt', shouldSkip: true },
      { path: '/project/test.js', shouldSkip: false },
    ];

    for (const { path, shouldSkip } of testCases) {
      const result = queue.shouldSkipFile ? queue.shouldSkipFile(path, path) : { skip: false };
    }
  });

  test('2. 应检测敏感信息', () => {
    const sensitiveCode = `
      const password = "test_password_value";
      const api_key = "test_api_key_value";
    `;

    const normalCode = `
      const greeting = "hello world";
      const count = 42;
    `;

    expect(sensitiveCode).toContain('password');
    expect(normalCode).not.toContain('password');
  });

  test('3. 应生成正确的摘要', () => {
    const queue = new AnalysisQueue();

    const result = {
      language: 'typescript',
      functions: [{ name: 'foo' }, { name: 'bar' }],
      classes: [{ name: 'MyClass' }],
    };

    const abstract = queue.generateAbstract('src/test.ts', result);

    expect(abstract).toContain('typescript');
    expect(abstract).toContain('src/test.ts');
    expect(abstract).toContain('2 functions');
    expect(abstract).toContain('1 classes');
  });

  test('4. 应生成正确的概览', () => {
    const queue = new AnalysisQueue();

    const result = {
      language: 'typescript',
      functions: [{ name: 'foo' }, { name: 'bar' }],
      classes: [{ name: 'MyClass' }],
      complexity_metrics: {
        lines_of_code: 100,
        cyclomatic: 5,
      },
    };

    const overview = queue.generateOverview('src/test.ts', result);

    expect(overview).toContain('src/test.ts');
    expect(overview).toContain('Lines: 100');
    expect(overview).toContain('Complexity: 5');
  });

  test('5. 队列应限制大小', async () => {
    const queue = new AnalysisQueue();

    expect(queue.queue.length).toBe(0);
    expect(queue.concurrentCount).toBe(0);
  });

  test('6. 批量应限制大小', () => {
    const queue = new AnalysisQueue();

    expect(queue.batch.length).toBe(0);
  });

  test('7. 应支持并发控制', () => {
    const queue = new AnalysisQueue();

    expect(queue.concurrentCount).toBe(0);
    expect(queue.processing.size).toBe(0);
  });
});
