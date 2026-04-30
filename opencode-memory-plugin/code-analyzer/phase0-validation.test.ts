/**
 * Phase 0: Bun + Tree-sitter WASM 技术验证
 * 目标：验证 Tree-sitter WASM 在 Bun 下的兼容性和性能
 */

import { test, expect, describe } from 'bun:test';

// Tree-sitter WASM 导入
let Parser: any;
let JavaScript: any;

describe('BL-15: Phase 0 技术验证', () => {
  // 测试 1: WASM 模块加载
  test('1. Tree-sitter WASM 模块可正常加载', async () => {
    try {
      // 尝试加载 web-tree-sitter
      const module = await import('web-tree-sitter');
      Parser = module.Parser;

      expect(Parser).toBeDefined();
      expect(typeof Parser.init).toBe('function');

      // 初始化 parser
      await Parser.init();

      console.log('✅ WASM 模块加载成功');
    } catch (error) {
      console.error('❌ WASM 模块加载失败:', error);
      throw error;
    }
  });

  // 测试 2: JavaScript 语言支持
  test('2. JavaScript 语言解析器可加载', async () => {
    try {
      const jsModule = await import('tree-sitter-javascript');
      JavaScript = jsModule.default || jsModule;

      expect(JavaScript).toBeDefined();

      const parser = new Parser();
      parser.setLanguage(JavaScript);

      console.log('✅ JavaScript 解析器加载成功');
    } catch (error) {
      console.error('❌ JavaScript 解析器加载失败:', error);
      throw error;
    }
  });

  // 测试 3: 小型文件解析 (<1000行，预期 <50ms)
  test('3. 1000行文件解析耗时 <50ms', async () => {
    const testCode = generateTestCode(1000);

    const parser = new Parser();
    parser.setLanguage(JavaScript);

    const startTime = performance.now();
    const tree = parser.parse(testCode);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(tree).toBeDefined();
    expect(duration).toBeLessThan(50);

    console.log(`✅ 1000行解析耗时: ${duration.toFixed(2)}ms`);

    tree.delete();
  });

  // 测试 4: 中型文件解析 (5000行，预期 <200ms)
  test('4. 5000行文件解析耗时 <200ms', async () => {
    const testCode = generateTestCode(5000);

    const parser = new Parser();
    parser.setLanguage(JavaScript);

    const startTime = performance.now();
    const tree = parser.parse(testCode);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(tree).toBeDefined();
    expect(duration).toBeLessThan(200);

    console.log(`✅ 5000行解析耗时: ${duration.toFixed(2)}ms`);

    tree.delete();
  });

  // 测试 5: 内存泄漏检测 (连续解析10次)
  test('5. 内存使用稳定（连续解析10次）', async () => {
    const testCode = generateTestCode(1000);

    // 获取初始内存
    const initialMemory = getMemoryUsage();

    const parser = new Parser();
    parser.setLanguage(JavaScript);

    // 连续解析10次
    for (let i = 0; i < 10; i++) {
      const tree = parser.parse(testCode);
      tree.delete();
    }

    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }

    // 等待一小段时间让内存稳定
    await new Promise(resolve => setTimeout(resolve, 100));

    const finalMemory = getMemoryUsage();
    const memoryGrowth = finalMemory - initialMemory;

    // 内存增长应小于 10MB
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);

    console.log(`✅ 内存增长: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
  });

  // 测试 6: TypeScript 语言支持
  test('6. TypeScript 语言解析器可加载', async () => {
    try {
      const tsModule = await import('tree-sitter-typescript');
      const TypeScript = tsModule.default || tsModule;

      expect(TypeScript).toBeDefined();

      const parser = new Parser();
      parser.setLanguage(TypeScript);

      const testCode = `
        interface User {
          name: string;
          age: number;
        }
        
        function greet(user: User): string {
          return \`Hello, \${user.name}!\`;
        }
      `;

      const tree = parser.parse(testCode);
      expect(tree).toBeDefined();

      console.log('✅ TypeScript 解析器工作正常');

      tree.delete();
    } catch (error) {
      console.error('❌ TypeScript 解析器加载失败:', error);
      throw error;
    }
  });

  // 测试 7: AST 提取基本功能
  test('7. 可提取函数和类定义', async () => {
    const testCode = `
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

    const parser = new Parser();
    parser.setLanguage(JavaScript);

    const tree = parser.parse(testCode);
    const rootNode = tree.rootNode;

    // 简单遍历查找函数和类
    let functionCount = 0;
    let classCount = 0;

    function traverse(node: any) {
      if (node.type === 'function_declaration' || node.type === 'method_definition') {
        functionCount++;
      }
      if (node.type === 'class_declaration') {
        classCount++;
      }

      for (const child of node.children) {
        traverse(child);
      }
    }

    traverse(rootNode);

    expect(functionCount).toBeGreaterThanOrEqual(2); // getUser + helper
    expect(classCount).toBe(1); // UserService

    console.log(`✅ 提取到 ${classCount} 个类, ${functionCount} 个函数`);

    tree.delete();
  });
});

// 辅助函数：生成测试代码
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

// 辅助函数：获取内存使用量
function getMemoryUsage(): number {
  if (process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}
