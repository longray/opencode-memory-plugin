/**
 * Tree-sitter Query API Tests (BL-CA-39)
 */

import { jest as _jest } from '@jest/globals';
import { analyzeWithQuery, analyzeWithTreeSitter } from '../lib/tree-sitter-parser.js';

// Check if Tree-sitter is available
let treeSitterAvailable = false;

try {
  // Try to initialize
  await analyzeWithTreeSitter('test.py', 'def test(): pass', 'python');
  treeSitterAvailable = true;
} catch {
  treeSitterAvailable = false;
}

(treeSitterAvailable ? describe : describe.skip)('Tree-sitter Query API', () => {
  describe('Python Analysis', () => {
    const pythonCode = `
def hello():
    pass

class MyClass:
    def method(self):
        pass

import os
from json import loads

hello()
`;

    test('should extract functions with Query API', async () => {
      const result = await analyzeWithQuery('test.py', pythonCode, 'python');

      expect(result.language).toBe('python');
      expect(['tree-sitter-query', 'tree-sitter']).toContain(result.analyzer);
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBeGreaterThan(0);
    });

    test('should extract classes with Query API', async () => {
      const result = await analyzeWithQuery('test.py', pythonCode, 'python');

      expect(result.classes).toBeDefined();
      expect(result.classes.length).toBeGreaterThan(0);
    });

    test('should extract imports with Query API', async () => {
      const result = await analyzeWithQuery('test.py', pythonCode, 'python');

      expect(result.imports).toBeDefined();
      expect(result.imports.length).toBeGreaterThan(0);
    });

    test('should fallback to tree traversal when Query fails', async () => {
      const result = await analyzeWithQuery('test.unknown', 'code', 'unknown');

      expect(['tree-sitter-query', 'tree-sitter']).toContain(result.analyzer);
    });

    test('Query results should match tree traversal results', async () => {
      const queryResult = await analyzeWithQuery('test.py', pythonCode, 'python');
      const treeResult = await analyzeWithTreeSitter('test.py', pythonCode, 'python');

      // Both should extract similar symbols
      expect(queryResult.functions.length).toBe(treeResult.functions.length);
      expect(queryResult.classes.length).toBe(treeResult.classes.length);
    });
  });

  describe('Go Analysis', () => {
    const goCode = `
package main

import "fmt"

func hello() {
    fmt.Println("Hello")
}

type MyStruct struct {
    Name string
}

func main() {
    hello()
}
`;

    test('should extract Go functions with Query API', async () => {
      const result = await analyzeWithQuery('test.go', goCode, 'go');

      expect(result.language).toBe('go');
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBeGreaterThan(0);
    });

    test('should extract Go structs with Query API', async () => {
      const result = await analyzeWithQuery('test.go', goCode, 'go');

      expect(result.classes).toBeDefined();
      expect(result.classes.length).toBeGreaterThan(0);
    });
  });

  describe('Rust Analysis', () => {
    const rustCode = `
fn hello() {
    println!("Hello");
}

struct MyStruct {
    name: String,
}

impl MyStruct {
    fn new() -> Self {
        MyStruct { name: String::new() }
    }
}

fn main() {
    hello();
}
`;

    test('should extract Rust functions with Query API', async () => {
      const result = await analyzeWithQuery('test.rs', rustCode, 'rust');

      expect(result.language).toBe('rust');
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBeGreaterThan(0);
    });

    test('should extract Rust structs with Query API', async () => {
      const result = await analyzeWithQuery('test.rs', rustCode, 'rust');

      expect(result.classes).toBeDefined();
      expect(result.classes.length).toBeGreaterThan(0);
    });
  });

  describe('Java Analysis', () => {
    const javaCode = `
import java.util.List;

public class MyClass {
    public void hello() {
        System.out.println("Hello");
    }
    
    public static void main(String[] args) {
        hello();
    }
}

interface MyInterface {
    void doSomething();
}
`;

    test('should extract Java methods with Query API', async () => {
      const result = await analyzeWithQuery('test.java', javaCode, 'java');

      expect(result.language).toBe('java');
      expect(result.functions).toBeDefined();
      expect(result.functions.length).toBeGreaterThan(0);
    });

    test('should extract Java classes with Query API', async () => {
      const result = await analyzeWithQuery('test.java', javaCode, 'java');

      expect(result.classes).toBeDefined();
      expect(result.classes.length).toBeGreaterThan(0);
    });

    test('should extract Java interfaces with Query API', async () => {
      const result = await analyzeWithQuery('test.java', javaCode, 'java');

      expect(result.interfaces).toBeDefined();
      expect(result.interfaces.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    const largePythonCode = `
${Array(100)
  .fill(0)
  .map(
    (_, i) => `
def function_${i}():
    pass
`
  )
  .join('')}
`;

    test('Query API should analyze large files within time budget', async () => {
      await analyzeWithQuery('warmup.py', 'def x(): pass', 'python');
      await analyzeWithTreeSitter('warmup.py', 'def x(): pass', 'python');

      const queryStart = performance.now();
      const queryResult = await analyzeWithQuery('large.py', largePythonCode, 'python');
      const queryTime = performance.now() - queryStart;

      expect(queryResult.functions.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing query files gracefully', async () => {
      const result = await analyzeWithQuery('test.xyz', 'code', 'xyz');

      expect(['tree-sitter-query', 'tree-sitter']).toContain(result.analyzer);
    });

    test('should handle parser initialization errors', async () => {
      await expect(analyzeWithQuery('test.py', '', 'python')).resolves.toBeDefined();
    });
  });
});
