import { test, expect, describe } from 'bun:test';
import { CodeAnalyzer } from '../lib/code-analyzer.js';

describe('BL-16: Code Analyzer Core', () => {
  const analyzer = new CodeAnalyzer();

  test('1. 可分析 JavaScript 文件', async () => {
    const code = `
      function greet(name) {
        return \`Hello, \${name}!\`;
      }
      
      export { greet };
    `;

    const result = await analyzer.analyze('test.js', code);

    expect(result).toBeDefined();
    expect(result.language).toBe('javascript');
    expect(result.analyzer).toBe('oxc');
    expect(result.functions.length).toBeGreaterThanOrEqual(1);

    console.log('✅ JavaScript 分析成功');
  });

  test('2. 可分析 TypeScript 文件', async () => {
    const code = `
      interface User {
        id: number;
        name: string;
      }
      
      class UserService {
        getUser(id: number): User {
          return { id, name: 'John' };
        }
      }
      
      export { UserService };
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result).toBeDefined();
    expect(result.language).toBe('typescript');
    expect(result.analyzer).toBe('oxc');
    expect(result.classes.length).toBe(1);
    expect(result.interfaces.length).toBe(1);

    console.log('✅ TypeScript 分析成功');
  });

  test('3. 可提取函数符号信息', async () => {
    const code = `
      async function fetchUser(id: number): Promise<User> {
        return await db.findOne(id);
      }
      
      function helper(a: string, b: number): string {
        return a + b;
      }
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result.functions.length).toBeGreaterThanOrEqual(2);

    const fetchUser = result.functions.find(f => f.name === 'fetchUser');
    expect(fetchUser).toBeDefined();
    expect(fetchUser?.is_async).toBe(true);
    expect(fetchUser?.params.length).toBe(1);

    console.log('✅ 函数符号提取成功');
  });

  test('4. 可提取类符号信息', async () => {
    const code = `
      class UserService {
        private db: Database;
        
        constructor(db: Database) {
          this.db = db;
        }
        
        async getUser(id: number): Promise<User> {
          return this.db.findOne(id);
        }
        
        saveUser(user: User): void {
          this.db.save(user);
        }
      }
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result.classes.length).toBe(1);

    const userService = result.classes[0];
    expect(userService.name).toBe('UserService');
    expect(userService.methods.length).toBeGreaterThanOrEqual(2);

    console.log('✅ 类符号提取成功');
  });

  test('5. 可提取导入导出信息', async () => {
    const code = `
      import { readFile } from 'fs';
      import axios from 'axios';
      import { helper } from './utils';
      
      export function main() {
        return 'main';
      }
      
      export default class App {}
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result.imports.length).toBe(3);
    expect(result.exports.length).toBe(2);

    const fsImport = result.imports.find(i => i.source === 'fs');
    expect(fsImport).toBeDefined();

    const defaultExport = result.exports.find(e => e.is_default);
    expect(defaultExport).toBeDefined();

    console.log('✅ 导入导出提取成功');
  });

  test('6. 可计算复杂度指标', async () => {
    const code = `
      function complex() {
        if (true) {
          for (let i = 0; i < 10; i++) {
            if (i > 5) {
              while (false) {}
            }
          }
        }
      }
      
      class Simple {
        method1() {}
        method2() {}
      }
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result.complexity_metrics).toBeDefined();
    expect(result.complexity_metrics.cyclomatic).toBeGreaterThan(1);
    expect(result.complexity_metrics.function_count).toBeGreaterThanOrEqual(1);
    expect(result.complexity_metrics.class_count).toBe(1);

    console.log('✅ 复杂度计算成功');
  });

  test('7. 可提取依赖信息', async () => {
    const code = `
      import { readFile } from 'fs';
      import { join } from 'node:path';
      import axios from 'axios';
      import { helper } from './utils';
      import { config } from '../config';
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result.dependencies.builtin.length).toBeGreaterThanOrEqual(2);
    expect(result.dependencies.external.length).toBeGreaterThanOrEqual(1);
    expect(result.dependencies.internal.length).toBeGreaterThanOrEqual(2);

    console.log('✅ 依赖提取成功');
  });

  test('8. 大文件降级处理', async () => {
    const code = generateTestCode(11000);

    const result = await analyzer.analyze('test.js', code);

    expect(result.analyzer).toBe('fallback');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0].type).toBe('large_file');

    console.log('✅ 大文件降级成功');
  });

  test('9. 分析结果符合数据结构规范', async () => {
    const code = `
      export function test() { return 1; }
    `;

    const result = await analyzer.analyze('test.ts', code);

    expect(result.language).toBeDefined();
    expect(result.analyzer).toBeDefined();
    expect(result.analyzed_at).toBeDefined();
    expect(result.analyzer_version).toBeDefined();
    expect(Array.isArray(result.functions)).toBe(true);
    expect(Array.isArray(result.classes)).toBe(true);
    expect(Array.isArray(result.interfaces)).toBe(true);
    expect(Array.isArray(result.imports)).toBe(true);
    expect(Array.isArray(result.exports)).toBe(true);
    expect(result.complexity_metrics).toBeDefined();
    expect(result.dependencies).toBeDefined();

    console.log('✅ 数据结构规范验证通过');
  });
});

function generateTestCode(lines) {
  const codeParts = [];

  for (let i = 0; i < lines; i++) {
    codeParts.push(`// Line ${i + 1}`);
    codeParts.push(`function func${i}() {`);
    codeParts.push(`  return ${i};`);
    codeParts.push(`}`);
  }

  return codeParts.join('\n');
}
