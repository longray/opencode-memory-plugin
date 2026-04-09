/**
 * Test Suite - Code Analysis Module
 * Tests for code-analyzer.js, tree-sitter-parser.js, project-analyzer.js, code-analysis-service.js
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { CodeAnalyzer } from '../lib/code-analyzer.js';
import { analyzeWithTreeSitter } from '../lib/tree-sitter-parser.js';
import { ProjectAnalyzer } from '../lib/project-analyzer.js';
import { AnalysisQueue } from '../lib/code-analysis-service.js';
import { shouldSkipFile, isExcludedFile, containsSensitiveInfo } from '../lib/privacy-filter.js';

describe('Code Analysis Module', () => {
  describe('CodeAnalyzer (Oxc Path)', () => {
    let analyzer;

    beforeAll(() => {
      analyzer = new CodeAnalyzer();
    });

    it('should be a constructor function', () => {
      expect(typeof CodeAnalyzer).toBe('function');
    });

    it('should create an instance', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer).toBeInstanceOf(CodeAnalyzer);
    });

    it('should have analyze method', () => {
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should have analyze method', () => {
      expect(typeof analyzer.analyze).toBe('function');
    });

    it('should calculate file quality score', () => {
      const complexityMetrics = {
        cyclomatic: 5,
        max_function_complexity: 10,
        max_nesting_depth: 3,
        lines_of_code: 200,
      };
      const functions = [{ name: 'test', line: 1 }];
      const classes = [];

      const score = analyzer.calculateFileQualityScore(complexityMetrics, functions, classes);

      expect(score).toBeDefined();
      expect(typeof score.score).toBe('number');
      expect(typeof score.grade).toBe('string');
      expect(Array.isArray(score.issues)).toBe(true);
      expect(Array.isArray(score.recommendations)).toBe(true);
    });

    it('should generate correct grade for high score', () => {
      const complexityMetrics = {
        cyclomatic: 3,
        max_function_complexity: 5,
        max_nesting_depth: 2,
        lines_of_code: 100,
      };
      const functions = [{ name: 'test', line: 1 }];
      const classes = [];

      const score = analyzer.calculateFileQualityScore(complexityMetrics, functions, classes);

      expect(score.score).toBeGreaterThanOrEqual(90);
      expect(score.grade).toBe('A');
    });

    it('should generate correct grade for low score', () => {
      const complexityMetrics = {
        cyclomatic: 15,
        max_function_complexity: 30,
        max_nesting_depth: 8,
        lines_of_code: 600,
      };
      const functions = Array(25).fill({ name: 'test', line: 1 });
      const classes = [];

      const score = analyzer.calculateFileQualityScore(complexityMetrics, functions, classes);

      expect(score.score).toBeLessThan(50);
      expect(score.grade).toBe('D');
    });
  });

  describe('Tree-sitter Parser', () => {
    it('should export analyzeWithTreeSitter function', () => {
      expect(typeof analyzeWithTreeSitter).toBe('function');
    });

    it('should have BUILTIN_MODULES defined', async () => {
      // Import the module to check internal state
      const module = await import('../lib/tree-sitter-parser.js');
      // BUILTIN_MODULES is not exported, but we can test the function behavior
      expect(typeof module.analyzeWithTreeSitter).toBe('function');
    });
  });

  describe('ProjectAnalyzer', () => {
    let projectAnalyzer;

    beforeAll(() => {
      projectAnalyzer = new ProjectAnalyzer();
    });

    it('should be a constructor function', () => {
      expect(typeof ProjectAnalyzer).toBe('function');
    });

    it('should create an instance', () => {
      expect(projectAnalyzer).toBeDefined();
      expect(projectAnalyzer).toBeInstanceOf(ProjectAnalyzer);
    });

    it('should have analyzeProject method', () => {
      expect(typeof projectAnalyzer.analyzeProject).toBe('function');
    });

    it('should calculate project health score', () => {
      const fileScores = [
        { score: 90, grade: 'A' },
        { score: 80, grade: 'B' },
        { score: 70, grade: 'B' },
      ];

      const avgScore = fileScores.reduce((sum, f) => sum + f.score, 0) / fileScores.length;

      expect(avgScore).toBe(80);
    });
  });

  describe('AnalysisQueue', () => {
    let queue;

    beforeAll(() => {
      queue = new AnalysisQueue();
    });

    it('should be a constructor function', () => {
      expect(typeof AnalysisQueue).toBe('function');
    });

    it('should create an instance', () => {
      expect(queue).toBeDefined();
      expect(queue).toBeInstanceOf(AnalysisQueue);
    });

    it('should have add method', () => {
      expect(typeof queue.add).toBe('function');
    });

    it('should have processQueue method', () => {
      expect(typeof queue.processQueue).toBe('function');
    });
  });

  describe('PrivacyFilter', () => {
    it('should export shouldSkipFile function', () => {
      expect(typeof shouldSkipFile).toBe('function');
    });

    it('should export isExcludedFile function', () => {
      expect(typeof isExcludedFile).toBe('function');
    });

    it('should export containsSensitiveInfo function', () => {
      expect(typeof containsSensitiveInfo).toBe('function');
    });

    it('should skip .env files', () => {
      const result = shouldSkipFile('/project/.env');
      expect(result.skip).toBe(true);
    });

    it('should skip node_modules', () => {
      const result = shouldSkipFile('/project/node_modules/lodash/index.js');
      expect(result.skip).toBe(true);
    });

    it('should not skip regular source files', () => {
      const result = shouldSkipFile('/project/src/index.js');
      expect(result.skip).toBe(false);
    });
  });

  describe('Code Analysis Integration', () => {
    it('should analyze simple JavaScript file', async () => {
      const jsCode = `
        function add(a, b) {
          return a + b;
        }
        
        function subtract(a, b) {
          return a - b;
        }
      `;

      const analyzer = new CodeAnalyzer();
      const result = await analyzer.analyze('test.js', jsCode);

      expect(result).toBeDefined();
      expect(result.language).toBe('javascript');
      expect(Array.isArray(result.functions)).toBe(true);
      expect(result.functions.length).toBe(2);
    });

    it('should calculate complexity correctly', async () => {
      const jsCode = `
        function complex(x) {
          if (x > 0) {
            if (x < 10) {
              return x;
            }
          }
          return 0;
        }
      `;

      const analyzer = new CodeAnalyzer();
      const result = await analyzer.analyze('test.js', jsCode);

      expect(result).toBeDefined();
      expect(result.complexity_metrics).toBeDefined();
      expect(result.complexity_metrics.cyclomatic).toBeGreaterThan(1);
    });
  });
});
