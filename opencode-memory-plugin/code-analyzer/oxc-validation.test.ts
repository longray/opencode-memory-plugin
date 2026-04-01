import { test, expect, describe } from 'bun:test';
import { parseSync } from 'oxc-parser';

describe('BL-22: Oxc 解析器验证', () => {
  test('1. Oxc 解析器可正常加载', () => {
    expect(typeof parseSync).toBe('function');
    console.log('✅ Oxc 解析器加载成功');
  });

  test('2. 可解析 JavaScript 代码', () => {
    const code = `
      function greet(name) {
        return \`Hello, \${name}!\`;
      }
      
      class UserService {
        getUser(id) {
          return { id, name: 'John' };
        }
      }
      
      export { UserService };
    `;

    const result = parseSync('test.js', code);

    expect(result).toBeDefined();
    expect(result.program).toBeDefined();

    console.log('✅ JavaScript 解析成功');
  });

  test('3. 可解析 TypeScript 代码', () => {
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

    const result = parseSync('test.ts', code, { sourceType: 'module' });

    expect(result).toBeDefined();
    expect(result.program).toBeDefined();

    console.log('✅ TypeScript 解析成功');
  });

  test('4. 1000行文件解析耗时 <30ms', () => {
    const code = generateTestCode(1000);

    const startTime = performance.now();
    const result = parseSync('test.js', code);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(30);

    console.log(`✅ 1000行解析耗时: ${duration.toFixed(2)}ms`);
  });

  test('5. 5000行文件解析耗时 <100ms', () => {
    const code = generateTestCode(5000);

    const startTime = performance.now();
    const result = parseSync('test.js', code);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result).toBeDefined();
    expect(duration).toBeLessThan(100);

    console.log(`✅ 5000行解析耗时: ${duration.toFixed(2)}ms`);
  });

  test('6. 可提取函数和类定义', () => {
    const code = `
      class UserService {
        constructor(private db: Database) {}
        
        async getUser(id: number): Promise<User> {
          return this.db.findOne(id);
        }
      }
      
      function helper() {
        return 'helper';
      }
      
      export { UserService };
    `;

    const result = parseSync('test.ts', code, { sourceType: 'module' });

    let functionCount = 0;
    let classCount = 0;

    function traverse(node: any) {
      if (!node) return;

      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression'
      ) {
        functionCount++;
      }
      if (node.type === 'ClassDeclaration') {
        classCount++;
      }
      if (node.type === 'MethodDefinition') {
        functionCount++;
      }

      for (const key in node) {
        if (key === 'type') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(traverse);
        } else if (typeof value === 'object' && value !== null) {
          traverse(value);
        }
      }
    }

    traverse(result.program);

    expect(functionCount).toBeGreaterThanOrEqual(2);
    expect(classCount).toBe(1);

    console.log(`✅ 提取到 ${classCount} 个类, ${functionCount} 个函数`);
  });
});

function generateTestCode(lines: number): string {
  const codeParts: string[] = [];

  for (let i = 0; i < lines; i++) {
    codeParts.push(`// Line ${i + 1}`);
    codeParts.push(`function func${i}() {`);
    codeParts.push(`  return ${i};`);
    codeParts.push(`}`);
  }

  return codeParts.join('\n');
}
