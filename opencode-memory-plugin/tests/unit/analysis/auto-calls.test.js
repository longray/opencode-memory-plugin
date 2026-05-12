/**
 * Test Suite - Auto Calls Extraction (Tasks 5.1-5.7)
 * Tests for call expression extraction from AST and relationship creation.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { CodeAnalyzer } from '../../../lib/code-analyzer.js';

describe('Auto Calls Extraction', () => {
  let analyzer;

  beforeAll(() => {
    analyzer = new CodeAnalyzer();
  });

  describe('Task 5.1: Extract call expressions from AST', () => {
    it('should extract direct function calls', async () => {
      const code = `
        function main() {
          helper();
          doWork();
        }
        function helper() {}
        function doWork() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('helper');
      expect(callTargets).toContain('doWork');
    });

    it('should extract member calls (obj.method())', async () => {
      const code = `
        function main() {
          obj.method();
          utils.format(data);
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('obj.method');
      expect(callTargets).toContain('utils.format');
    });

    it('should extract chained calls', async () => {
      const code = `
        function main() {
          arr.map(fn).filter(pred).reduce(acc);
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      // Chained calls: arr.map(), then .filter(), then .reduce()
      // The AST shows .filter() and .reduce() as member calls on the result
      expect(callTargets.length).toBeGreaterThan(0);
    });

    it('should skip built-in console calls', async () => {
      const code = `
        function main() {
          console.log('hello');
          console.error('error');
          console.warn('warn');
          console.info('info');
          console.debug('debug');
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('console.log');
      expect(callTargets).not.toContain('console.error');
      expect(callTargets).not.toContain('console.warn');
      expect(callTargets).not.toContain('console.info');
      expect(callTargets).not.toContain('console.debug');
      expect(callTargets).toContain('helper');
    });

    it('should skip Array built-in calls', async () => {
      const code = `
        function main() {
          Array.isArray([]);
          Array.from([1,2,3]);
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('Array.isArray');
      expect(callTargets).not.toContain('Array.from');
      expect(callTargets).toContain('helper');
    });

    it('should extract calls with line numbers', async () => {
      const code = `
        function main() {
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const helperCall = result.calls.find(c => c.target === 'helper');

      expect(helperCall).toBeDefined();
      expect(helperCall.line).toBeGreaterThan(0);
    });

    it('should extract calls within class methods', async () => {
      const code = `
        class Service {
          process() {
            this.validate();
            this.save();
          }
          validate() {}
          save() {}
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('this.validate');
      expect(callTargets).toContain('this.save');
    });

    it('should extract calls in nested functions', async () => {
      const code = `
        function outer() {
          function inner() {
            helper();
          }
          inner();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('helper');
      expect(callTargets).toContain('inner');
    });

    it('should extract calls in arrow functions', async () => {
      const code = `
        const process = () => {
          helper();
        };
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('helper');
    });

    it('should extract calls in async functions', async () => {
      const code = `
        async function main() {
          await fetchData();
          processResult(data);
        }
        async function fetchData() {}
        function processResult() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('fetchData');
      expect(callTargets).toContain('processResult');
    });

    it('should extract calls in try-catch blocks', async () => {
      const code = `
        function main() {
          try {
            riskyOperation();
          } catch (error) {
            handleError(error);
          }
        }
        function riskyOperation() {}
        function handleError() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('riskyOperation');
      expect(callTargets).toContain('handleError');
    });

    it('should extract calls in conditional blocks', async () => {
      const code = `
        function main(x) {
          if (x > 0) {
            positive();
          } else {
            negative();
          }
        }
        function positive() {}
        function negative() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('positive');
      expect(callTargets).toContain('negative');
    });

    it('should handle empty file', async () => {
      const result = await analyzer.analyze('empty.js', '');
      expect(result.calls).toEqual([]);
    });

    it('should handle file with no calls', async () => {
      const code = `
        const x = 42;
        const y = "hello";
      `;

      const result = await analyzer.analyze('test.js', code);
      expect(result.calls).toEqual([]);
    });
  });

  describe('Task 5.2-5.6: Call metadata and resolution', () => {
    it('should include file_path in call metadata', async () => {
      const code = `
        function main() {
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('src/test.js', code);
      const helperCall = result.calls.find(c => c.target === 'helper');

      expect(helperCall).toBeDefined();
      expect(helperCall.file_path).toBe('src/test.js');
    });

    it('should include column in call metadata', async () => {
      const code = `
        function main() {
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const helperCall = result.calls.find(c => c.target === 'helper');

      expect(helperCall).toBeDefined();
      expect(helperCall.column).toBeGreaterThanOrEqual(0);
    });

    it('should track call frequency (same function called multiple times)', async () => {
      const code = `
        function main() {
          helper();
          helper();
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const helperCalls = result.calls.filter(c => c.target === 'helper');

      expect(helperCalls.length).toBe(3);
    });

    it('should extract calls from imported modules', async () => {
      const code = `
        import { formatDate } from './utils';
        import * as helpers from './helpers';

        function main() {
          formatDate(date);
          helpers.log(msg);
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('formatDate');
      expect(callTargets).toContain('helpers.log');
    });

    it('should skip unresolved call targets gracefully', async () => {
      // This test verifies that the system doesn't crash on unresolved calls
      const code = `
        function main() {
          unknownFunction();
          someObj.unknownMethod();
        }
      `;

      const result = await analyzer.analyze('test.js', code);
      // Should still extract the calls, even if targets can't be resolved
      expect(result.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Task 5.7: Built-in function filtering', () => {
    it('should skip Object built-in calls', async () => {
      const code = `
        function main() {
          Object.keys(obj);
          Object.values(obj);
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('Object.keys');
      expect(callTargets).not.toContain('Object.values');
      expect(callTargets).toContain('helper');
    });

    it('should skip Math built-in calls', async () => {
      const code = `
        function main() {
          Math.max(1, 2);
          Math.min(1, 2);
          Math.random();
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('Math.max');
      expect(callTargets).not.toContain('Math.min');
      expect(callTargets).not.toContain('Math.random');
      expect(callTargets).toContain('helper');
    });

    it('should skip String built-in calls', async () => {
      const code = `
        function main() {
          String.fromCharCode(65);
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('String.fromCharCode');
      expect(callTargets).toContain('helper');
    });

    it('should skip Number built-in calls', async () => {
      const code = `
        function main() {
          Number.parseInt('42');
          Number.parseFloat('3.14');
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('Number.parseInt');
      expect(callTargets).not.toContain('Number.parseFloat');
      expect(callTargets).toContain('helper');
    });

    it('should skip Promise built-in calls', async () => {
      const code = `
        async function main() {
          Promise.all(promises);
          Promise.resolve(value);
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('Promise.all');
      expect(callTargets).not.toContain('Promise.resolve');
      expect(callTargets).toContain('helper');
    });

    it('should skip JSON built-in calls', async () => {
      const code = `
        function main() {
          JSON.parse(str);
          JSON.stringify(obj);
          helper();
        }
        function helper() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).not.toContain('JSON.parse');
      expect(callTargets).not.toContain('JSON.stringify');
      expect(callTargets).toContain('helper');
    });

    it('should allow user-defined functions with similar names to built-ins', async () => {
      const code = `
        function main() {
          myLog('hello');
          myParse('42');
        }
        function myLog() {}
        function myParse() {}
      `;

      const result = await analyzer.analyze('test.js', code);
      const callTargets = result.calls.map(c => c.target);

      expect(callTargets).toContain('myLog');
      expect(callTargets).toContain('myParse');
    });
  });
});
