import { parseSync } from 'oxc-parser';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { analyzeWithTreeSitter } from './tree-sitter-parser.js';

/**
 * @typedef {Object} AnalysisResult
 * @property {string} file_path - 文件路径
 * @property {string} language - 编程语言
 * @property {string} analyzer - 使用的分析器 ('oxc' | 'tree-sitter' | 'fallback')
 * @property {Array<{name: string, start?: number, end?: number}>} functions - 函数列表
 * @property {Array<{name: string}>} classes - 类列表
 * @property {Array<{name: string}>} interfaces - 接口列表
 * @property {Array<{name: string, source: string}>} imports - 导入列表
 * @property {Array<{name: string, type: 'function'|'class'|'const'|'let'|'var'}>} exports - 导出列表
 * @property {Object} [metrics] - 代码指标
 * @property {number} metrics.lines - 总行数
 * @property {number} metrics.functions - 函数数量
 * @property {number} metrics.classes - 类数量
 * @property {number} metrics.complexity - 复杂度
 * @property {Array<{type: string, reason: string}>} [warnings] - 警告列表
 */

/**
 * @typedef {Object} AnalyzerConfig
 * @property {number} [debounceMs=300] - 防抖时间（毫秒）
 * @property {number} [maxConcurrent=2] - 最大并发数
 * @property {number} [maxQueueSize=10] - 最大队列大小
 * @property {number} [queueTimeoutMs=5000] - 队列超时时间（毫秒）
 * @property {number} [fileTimeoutMs=500] - 文件分析超时时间（毫秒）
 * @property {number} [largeFileThreshold=5000] - 大文件行数阈值
 * @property {number} [skipFileThreshold=10000] - 跳过文件行数阈值
 * @property {number} [batchDelayMs=2000] - 批量延迟时间（毫秒）
 * @property {number} [batchMaxSize=10] - 批量最大大小
 */

export const DEFAULT_CONFIG = {
  debounceMs: 300,
  maxConcurrent: 2,
  maxQueueSize: 10,
  queueTimeoutMs: 5000,
  fileTimeoutMs: 500,
  largeFileThreshold: 5000,
  skipFileThreshold: 10000,
  batchDelayMs: 2000,
  batchMaxSize: 10,
};

const EXTENSION_TO_LANGUAGE = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
};

/**
 * 代码分析器类
 * 使用 Oxc 进行 AST 分析，支持 Tree-sitter WASM 降级策略
 */
export class CodeAnalyzer {
  /**
   * @param {AnalyzerConfig} [config] - 分析器配置
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 分析代码文件
   * @param {string} filePath - 文件路径
   * @param {string} [content] - 文件内容（可选，不传则从文件读取）
   * @returns {Promise<AnalysisResult>} 分析结果
   */
  async analyze(filePath, content) {
    const startTime = performance.now();
    const warnings = [];

    try {
      const sourceCode = content ?? readFileSync(filePath, 'utf-8');
      const lines = sourceCode.split('\n').length;

      if (lines > this.config.skipFileThreshold) {
        return this.createFallbackResult(filePath, sourceCode, lines, [
          {
            type: 'large_file',
            reason: `File has ${lines} lines, exceeds threshold ${this.config.skipFileThreshold}`,
          },
        ]);
      }

      const language = this.detectLanguage(filePath);
      const result = await this.analyzeWithStrategy(filePath, sourceCode, language, warnings);

      const duration = performance.now() - startTime;
      console.log(
        `[CodeAnalyzer] Analyzed ${filePath} in ${duration.toFixed(2)}ms using ${result.analyzer}`
      );

      return result;
    } catch (error) {
      console.error(`[CodeAnalyzer] Failed to analyze ${filePath}:`, error);

      const sourceCode = content ?? '';
      const lines = sourceCode.split('\n').length;
      return this.createFallbackResult(filePath, sourceCode, lines, [
        {
          type: 'degraded',
          from: 'analyzer',
          to: 'fallback',
          reason: error.message || 'Unknown error',
        },
      ]);
    }
  }

  async analyzeWithStrategy(filePath, sourceCode, language, warnings) {
    const lines = sourceCode.split('\n').length;

    if (language === 'javascript' || language === 'typescript') {
      try {
        const oxcStartTime = performance.now();
        const result = this.analyzeWithOxc(filePath, sourceCode, language);
        const oxcDuration = performance.now() - oxcStartTime;

        if (oxcDuration > 200) {
          warnings.push({
            type: 'degraded',
            from: 'oxc',
            to: 'tree-sitter',
            reason: 'timeout',
            duration_ms: oxcDuration,
          });
        } else {
          return result;
        }
      } catch (error) {
        warnings.push({
          type: 'degraded',
          from: 'oxc',
          to: 'tree-sitter',
          reason: error.message || 'Oxc parse error',
        });
      }
    }

    // Try Tree-sitter for non-JS/TS languages or as Oxc fallback
    try {
      const treeSitterResult = await analyzeWithTreeSitter(filePath, sourceCode, language);
      return treeSitterResult;
    } catch (error) {
      warnings.push({
        type: 'degraded',
        from: 'tree-sitter',
        to: 'fallback',
        reason: error.message || 'Tree-sitter parse error',
      });
    }

    return this.createFallbackResult(filePath, sourceCode, lines, warnings);
  }

  analyzeWithOxc(filePath, sourceCode, language) {
    const options = { sourceType: 'module' };
    const parseResult = parseSync(filePath, sourceCode, options);
    const ast = parseResult.program;

    const functions = [];
    const classes = [];
    const interfaces = [];
    const imports = [];
    const exports = [];

    this.extractSymbolsFromOxcAst(ast, sourceCode, {
      functions,
      classes,
      interfaces,
      imports,
      exports,
    });

    const complexityMetrics = this.calculateComplexity(functions, classes, sourceCode);
    const dependencies = this.extractDependencies(imports);

    return {
      language,
      analyzer: 'oxc',
      analyzed_at: new Date().toISOString(),
      analyzer_version: '0.x',
      functions,
      classes,
      interfaces,
      imports,
      exports,
      complexity_metrics: complexityMetrics,
      dependencies,
    };
  }

  extractSymbolsFromOxcAst(node, sourceCode, collectors, parentExported = false) {
    if (!node || typeof node !== 'object') return;

    const { functions, classes, interfaces, imports, exports } = collectors;

    switch (node.type) {
      case 'FunctionDeclaration':
        functions.push({
          name: node.id?.name || 'anonymous',
          start_line: node.loc?.start?.line ?? 0,
          end_line: node.loc?.end?.line ?? 0,
          params: this.extractParams(node.params),
          return_type: node.returnType?.typeAnnotation?.typeName?.name,
          is_exported: parentExported,
          is_async: node.async ?? false,
        });
        break;

      case 'ClassDeclaration': {
        const classMethods = [];
        const classProperties = [];

        node.body?.body?.forEach(member => {
          if (member.type === 'MethodDefinition') {
            classMethods.push(member.key?.name || 'anonymous');
          } else if (member.type === 'PropertyDefinition') {
            classProperties.push(member.key?.name);
          }
        });

        classes.push({
          name: node.id?.name || 'anonymous',
          start_line: node.loc?.start?.line ?? 0,
          end_line: node.loc?.end?.line ?? 0,
          methods: classMethods,
          properties: classProperties,
        });

        node.body?.body?.forEach(member => {
          this.extractSymbolsFromOxcAst(member, sourceCode, collectors, parentExported);
        });
        break;
      }

      case 'TSInterfaceDeclaration': {
        const interfaceMethods = [];
        const interfaceProperties = [];

        node.body?.body?.forEach(member => {
          if (member.type === 'TSMethodSignature') {
            interfaceMethods.push(member.key?.name);
          } else if (member.type === 'TSPropertySignature') {
            interfaceProperties.push(member.key?.name);
          }
        });

        interfaces.push({
          name: node.id?.name || 'anonymous',
          start_line: node.loc?.start?.line ?? 0,
          end_line: node.loc?.end?.line ?? 0,
          methods: interfaceMethods,
          properties: interfaceProperties,
        });
        break;
      }

      case 'ImportDeclaration':
        imports.push({
          source: node.source?.value || '',
          imported_names: node.specifiers?.map(s => s.local?.name) || [],
        });
        break;

      case 'ExportNamedDeclaration':
        if (node.declaration) {
          const isDefault = false;
          let exportType = 'variable';
          let exportName = '';

          if (node.declaration.type === 'FunctionDeclaration') {
            exportType = 'function';
            exportName = node.declaration.id?.name || '';
          } else if (node.declaration.type === 'ClassDeclaration') {
            exportType = 'class';
            exportName = node.declaration.id?.name || '';
          } else if (node.declaration.type === 'TSInterfaceDeclaration') {
            exportType = 'interface';
            exportName = node.declaration.id?.name || '';
          }

          exports.push({
            name: exportName,
            type: exportType,
            is_default: isDefault,
          });

          this.extractSymbolsFromOxcAst(node.declaration, sourceCode, collectors, true);
        }
        break;

      case 'ExportDefaultDeclaration': {
        let defaultName = '';
        let defaultType = 'variable';

        if (node.declaration?.type === 'FunctionDeclaration') {
          defaultType = 'function';
          defaultName = node.declaration.id?.name || 'default';
        } else if (node.declaration?.type === 'ClassDeclaration') {
          defaultType = 'class';
          defaultName = node.declaration.id?.name || 'default';
        } else if (node.declaration?.type === 'Identifier') {
          defaultName = node.declaration.name;
        }

        exports.push({
          name: defaultName,
          type: defaultType,
          is_default: true,
        });
        break;
      }
    }

    for (const key in node) {
      if (key === 'type' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(child =>
          this.extractSymbolsFromOxcAst(child, sourceCode, collectors, parentExported)
        );
      } else if (typeof value === 'object' && value !== null) {
        this.extractSymbolsFromOxcAst(value, sourceCode, collectors, parentExported);
      }
    }
  }

  extractParams(params) {
    return params.map(p => ({
      name: p.name || p.local?.name || 'unknown',
      type: p.typeAnnotation?.typeAnnotation?.typeName?.name,
    }));
  }

  calculateComplexity(functions, classes, sourceCode) {
    const lines = sourceCode.split('\n').length;
    const functionCount = functions.length;
    const classCount = classes.length;

    const controlFlowKeywords = (
      sourceCode.match(/\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g) || []
    ).length;
    const cyclomatic = Math.max(1, controlFlowKeywords + 1);

    const functionComplexities = functions.map(f => {
      const funcLines = f.end_line - f.start_line;
      return Math.max(1, funcLines / 10);
    });

    const maxFunctionComplexity =
      functionComplexities.length > 0 ? Math.max(...functionComplexities) : 0;
    const averageFunctionComplexity =
      functionComplexities.length > 0
        ? functionComplexities.reduce((a, b) => a + b, 0) / functionComplexities.length
        : 0;

    return {
      cyclomatic,
      lines_of_code: lines,
      function_count: functionCount,
      class_count: classCount,
      max_function_complexity: Math.round(maxFunctionComplexity * 10) / 10,
      average_function_complexity: Math.round(averageFunctionComplexity * 10) / 10,
    };
  }

  extractDependencies(imports) {
    const internal = [];
    const external = [];
    const builtin = [];

    const builtinModules = [
      'fs',
      'path',
      'http',
      'https',
      'os',
      'util',
      'crypto',
      'stream',
      'events',
    ];

    for (const imp of imports) {
      const source = imp.source;

      if (source.startsWith('node:') || builtinModules.includes(source)) {
        builtin.push(source);
      } else if (source.startsWith('.') || source.startsWith('/')) {
        internal.push(source);
      } else {
        external.push(source);
      }
    }

    return { internal, external, builtin };
  }

  createFallbackResult(filePath, sourceCode, lines, warnings) {
    const language = this.detectLanguage(filePath);

    return {
      language,
      analyzer: 'fallback',
      analyzed_at: new Date().toISOString(),
      analyzer_version: '1.0.0',
      functions: [],
      classes: [],
      interfaces: [],
      imports: [],
      exports: [],
      complexity_metrics: {
        cyclomatic: 1,
        lines_of_code: lines,
        function_count: 0,
        class_count: 0,
        max_function_complexity: 0,
        average_function_complexity: 0,
      },
      dependencies: {
        internal: [],
        external: [],
        builtin: [],
      },
      warnings,
    };
  }

  detectLanguage(filePath) {
    const ext = extname(filePath).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || 'unknown';
  }
}

export const codeAnalyzer = new CodeAnalyzer();
