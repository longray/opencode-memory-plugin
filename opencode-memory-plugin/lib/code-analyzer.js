import { parseSync } from 'oxc-parser';
import { readFileSync } from 'fs';
import { extname } from 'path';

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

export class CodeAnalyzer {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

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

    warnings.push({
      type: 'degraded',
      from: 'tree-sitter',
      to: 'fallback',
      reason: 'Tree-sitter WASM not available in current version',
    });

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
