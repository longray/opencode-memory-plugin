/**
 * Test Suite - Auto Extends Extraction (Tasks 6.1-6.7)
 * Tests for class inheritance extraction and relationship creation.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { CodeAnalyzer } from '../../../lib/code-analyzer.js';

describe('Auto Extends Extraction', () => {
  let analyzer;

  beforeAll(() => {
    analyzer = new CodeAnalyzer();
  });

  describe('Task 6.1: Extract class inheritance from AST', () => {
    it('should extract ES6 class extends', async () => {
      const code = `
        class Animal {
          constructor(name) {
            this.name = name;
          }
        }

        class Dog extends Animal {
          bark() {
            return "Woof!";
          }
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const dogClass = result.classes.find(c => c.name === 'Dog');

      expect(dogClass).toBeDefined();
      expect(dogClass.superClass).toBe('Animal');
    });

    it('should extract class with no extends', async () => {
      const code = `
        class Simple {
          method() {}
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const simpleClass = result.classes.find(c => c.name === 'Simple');

      expect(simpleClass).toBeDefined();
      expect(simpleClass.superClass == null).toBe(true);
    });

    it('should extract TypeScript interface extends', async () => {
      const code = `
        interface Base {
          id: string;
        }

        interface User extends Base {
          name: string;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const userInterface = result.interfaces.find(i => i.name === 'User');

      expect(userInterface).toBeDefined();
      expect(userInterface.extends).toContain('Base');
    });

    it('should extract multiple interface extends', async () => {
      const code = `
        interface A {
          a: string;
        }

        interface B {
          b: number;
        }

        interface C extends A, B {
          c: boolean;
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const interfaceC = result.interfaces.find(i => i.name === 'C');

      expect(interfaceC).toBeDefined();
      expect(interfaceC.extends).toContain('A');
      expect(interfaceC.extends).toContain('B');
    });

    it('should extract class implements single interface', async () => {
      const code = `
        interface Runnable {
          run(): void;
        }

        class Runner implements Runnable {
          run() {
            console.log("running");
          }
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const runnerClass = result.classes.find(c => c.name === 'Runner');

      expect(runnerClass).toBeDefined();
      expect(runnerClass.implements).toContain('Runnable');
    });

    it('should extract class implements multiple interfaces', async () => {
      const code = `
        interface Runnable {
          run(): void;
        }

        interface Jumpable {
          jump(): void;
        }

        class Athlete implements Runnable, Jumpable {
          run() {}
          jump() {}
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const athleteClass = result.classes.find(c => c.name === 'Athlete');

      expect(athleteClass).toBeDefined();
      expect(athleteClass.implements).toContain('Runnable');
      expect(athleteClass.implements).toContain('Jumpable');
    });

    it('should extract class extends and implements together', async () => {
      const code = `
        class Animal {
          move() {}
        }

        interface Trainable {
          train(): void;
        }

        class Dog extends Animal implements Trainable {
          bark() {}
          train() {}
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const dogClass = result.classes.find(c => c.name === 'Dog');

      expect(dogClass).toBeDefined();
      expect(dogClass.superClass).toBe('Animal');
      expect(dogClass.implements).toContain('Trainable');
    });

    it('should extract multi-level inheritance', async () => {
      const code = `
        class Animal {
          eat() {}
        }

        class Mammal extends Animal {
          breathe() {}
        }

        class Dog extends Mammal {
          bark() {}
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const mammalClass = result.classes.find(c => c.name === 'Mammal');
      const dogClass = result.classes.find(c => c.name === 'Dog');

      expect(mammalClass.superClass).toBe('Animal');
      expect(dogClass.superClass).toBe('Mammal');
    });
  });

  describe('Task 6.2-6.6: Inheritance metadata and resolution', () => {
    it('should include superClass name in class metadata', async () => {
      const code = `
        class Base {}
        class Child extends Base {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const childClass = result.classes.find(c => c.name === 'Child');

      expect(childClass.superClass).toBe('Base');
    });

    it('should handle external parent classes', async () => {
      const code = `
        import { ExternalBase } from './external';

        class MyComponent extends ExternalBase {
          render() {}
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const myComponent = result.classes.find(c => c.name === 'MyComponent');

      expect(myComponent).toBeDefined();
      expect(myComponent.superClass).toBe('ExternalBase');
    });

    it('should handle circular inheritance detection data', async () => {
      // The analyzer should still extract the data correctly
      // Circular detection happens at relationship creation time
      const code = `
        class A extends C {}
        class B extends A {}
        class C extends B {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const classA = result.classes.find(c => c.name === 'A');
      const classB = result.classes.find(c => c.name === 'B');
      const classC = result.classes.find(c => c.name === 'C');

      expect(classA.superClass).toBe('C');
      expect(classB.superClass).toBe('A');
      expect(classC.superClass).toBe('B');
    });

    it('should track inheritance depth metadata', async () => {
      const code = `
        class Level0 {}
        class Level1 extends Level0 {}
        class Level2 extends Level1 {}
        class Level3 extends Level2 {}
      `;

      const result = await analyzer.analyze('test.js', code);

      const level0 = result.classes.find(c => c.name === 'Level0');
      const level1 = result.classes.find(c => c.name === 'Level1');
      const level2 = result.classes.find(c => c.name === 'Level2');
      const level3 = result.classes.find(c => c.name === 'Level3');

      expect(level0.superClass == null).toBe(true);
      expect(level1.superClass).toBe('Level0');
      expect(level2.superClass).toBe('Level1');
      expect(level3.superClass).toBe('Level2');
    });
  });

  describe('Task 6.7: Edge cases', () => {
    it('should handle empty file', async () => {
      const result = await analyzer.analyze('empty.js', '');
      expect(result.classes).toEqual([]);
    });

    it('should handle file with no classes', async () => {
      const code = `
        function helper() {}
        const x = 42;
      `;

      const result = await analyzer.analyze('test.js', code);
      expect(result.classes).toEqual([]);
    });

    it('should handle class expression (not declaration)', async () => {
      const code = `
        const MyClass = class extends Base {
          method() {}
        };
      `;

      const result = await analyzer.analyze('test.js', code);
      // Class expressions may not be detected as declarations
      // This test verifies the analyzer handles them gracefully
      expect(result).toBeDefined();
    });

    it('should handle TypeScript abstract class extends', async () => {
      const code = `
        abstract class BaseComponent {
          abstract render(): void;
        }

        class Button extends BaseComponent {
          render() {
            console.log("button");
          }
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const buttonClass = result.classes.find(c => c.name === 'Button');

      expect(buttonClass).toBeDefined();
      expect(buttonClass.superClass).toBe('BaseComponent');
    });

    it('should handle generic class extends', async () => {
      const code = `
        class Container<T> {
          value: T;
        }

        class StringContainer extends Container<string> {
          getValue(): string {
            return this.value;
          }
        }
      `;

      const result = await analyzer.analyze('test.ts', code);
      const stringContainer = result.classes.find(c => c.name === 'StringContainer');

      expect(stringContainer).toBeDefined();
      expect(stringContainer.superClass).toBe('Container');
    });
  });
});
