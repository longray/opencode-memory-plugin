import { parseSync } from 'oxc-parser';
import { readFileSync } from 'fs';
import { extname } from 'path';
import { analyzeWithTreeSitter } from './tree-sitter-parser.js';
import { getConfig } from './storage.js';

const userConfig = getConfig();
const CODE_ANALYSIS_CONFIG = userConfig.code_analysis || {};

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
  debounceMs: CODE_ANALYSIS_CONFIG.debounce_ms || 300,
  maxConcurrent: CODE_ANALYSIS_CONFIG.max_concurrent || 2,
  maxQueueSize: CODE_ANALYSIS_CONFIG.max_queue_size || 10,
  queueTimeoutMs: CODE_ANALYSIS_CONFIG.queue_timeout_ms || 5000,
  fileTimeoutMs: CODE_ANALYSIS_CONFIG.file_timeout_ms || 500,
  largeFileThreshold: CODE_ANALYSIS_CONFIG.large_file_threshold || 5000,
  skipFileThreshold: CODE_ANALYSIS_CONFIG.skip_file_threshold || 10000,
  batchDelayMs: CODE_ANALYSIS_CONFIG.batch_delay_ms || 2000,
  batchMaxSize: CODE_ANALYSIS_CONFIG.batch_max_size || 10,
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
    const comments = parseResult.comments || [];

    const functions = [];
    const classes = [];
    const interfaces = [];
    const imports = [];
    const exports = [];

    this.extractSymbolsFromOxcAst(
      ast,
      sourceCode,
      {
        functions,
        classes,
        interfaces,
        imports,
        exports,
      },
      false,
      comments
    );

    const complexityMetrics = this.calculateComplexity(functions, classes, sourceCode, ast);
    const dependencies = this.extractDependencies(imports);
    const calls = this.extractCallsFromOxcAst(ast, filePath, sourceCode);

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
      calls,
      complexity_metrics: complexityMetrics,
      dependencies,
    };
  }

  extractSymbolsFromOxcAst(node, sourceCode, collectors, parentExported = false, comments = []) {
    if (!node || typeof node !== 'object') return;

    const { functions, classes, interfaces, imports, exports } = collectors;

    switch (node.type) {
      case 'FunctionDeclaration': {
        const jsdoc = this.extractJSDoc(node.start, comments);
        functions.push({
          name: node.id?.name || 'anonymous',
          start_line: node.loc?.start?.line ?? 0,
          end_line: node.loc?.end?.line ?? 0,
          params: this.extractParams(node.params),
          return_type: node.returnType?.typeAnnotation?.typeName?.name,
          is_exported: parentExported,
          is_async: node.async ?? false,
          jsdoc,
        });
        break;
      }

      case 'ClassDeclaration': {
        const jsdoc = this.extractJSDoc(node.start, comments);
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
          jsdoc,
        });

        node.body?.body?.forEach(member => {
          this.extractSymbolsFromOxcAst(member, sourceCode, collectors, parentExported, comments);
        });
        break;
      }

      case 'TSInterfaceDeclaration': {
        const jsdoc = this.extractJSDoc(node.start, comments);
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
          jsdoc,
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
          this.extractSymbolsFromOxcAst(child, sourceCode, collectors, parentExported, comments)
        );
      } else if (typeof value === 'object' && value !== null) {
        this.extractSymbolsFromOxcAst(value, sourceCode, collectors, parentExported, comments);
      }
    }
  }

  extractJSDoc(nodeStart, comments) {
    if (!comments || comments.length === 0) return null;

    const precedingComments = comments.filter(c => c.end < nodeStart);
    if (precedingComments.length === 0) return null;

    const lastComment = precedingComments[precedingComments.length - 1];
    if (lastComment.type !== 'Block' || !lastComment.value.startsWith('*')) return null;

    return this.parseJSDoc(lastComment.value);
  }

  parseJSDoc(commentValue) {
    const lines = commentValue.split('\n');
    const result = {
      description: '',
      params: [],
      returns: null,
    };

    let currentTag = null;

    for (const line of lines) {
      const trimmed = line
        .trim()
        .replace(/^\*\s?/, '')
        .trim();

      if (trimmed.startsWith('@param')) {
        const match = trimmed.match(/@param\s+\{([^}]+)\}\s+(\w+)\s*-?\s*(.*)/);
        if (match) {
          result.params.push({
            type: match[1],
            name: match[2],
            description: match[3] || '',
          });
        }
        currentTag = 'param';
      } else if (trimmed.startsWith('@returns') || trimmed.startsWith('@return')) {
        const match = trimmed.match(/@returns?\s+\{([^}]+)\}\s*-?\s*(.*)/);
        if (match) {
          result.returns = {
            type: match[1],
            description: match[2] || '',
          };
        }
        currentTag = 'returns';
      } else if (trimmed.startsWith('@')) {
        currentTag = trimmed.split(' ')[0];
      } else if (trimmed && !trimmed.startsWith('/')) {
        if (currentTag === null) {
          result.description += (result.description ? ' ' : '') + trimmed;
        }
      }
    }

    return result;
  }

  extractParams(params) {
    return params.map(p => ({
      name: p.name || p.local?.name || 'unknown',
      type: p.typeAnnotation?.typeAnnotation?.typeName?.name,
    }));
  }

  calculateComplexity(functions, classes, sourceCode, ast) {
    const lines = sourceCode.split('\n').length;
    const functionCount = functions.length;
    const classCount = classes.length;

    const functionComplexities = functions.map(func => {
      const funcAst = this.findFunctionAst(ast, func.name, func.start_line);
      if (funcAst) {
        const complexity = this.calculateCyclomaticComplexity(funcAst);
        const maxDepth = this.calculateMaxNestingDepth(funcAst);
        return {
          ...func,
          cyclomatic: complexity,
          max_nesting_depth: maxDepth,
        };
      }
      return { ...func, cyclomatic: 1, max_nesting_depth: 0 };
    });

    const cyclomaticValues = functionComplexities.map(f => f.cyclomatic);
    const totalCyclomatic = cyclomaticValues.reduce((a, b) => a + b, 0);
    const averageCyclomatic = functionCount > 0 ? totalCyclomatic / functionCount : 1;
    const maxFunctionComplexity = functionCount > 0 ? Math.max(...cyclomaticValues) : 0;

    const depthValues = functionComplexities.map(f => f.max_nesting_depth);
    const averageNestingDepth =
      functionCount > 0 ? depthValues.reduce((a, b) => a + b, 0) / functionCount : 0;

    return {
      cyclomatic: Math.round(averageCyclomatic),
      lines_of_code: lines,
      function_count: functionCount,
      class_count: classCount,
      max_function_complexity: maxFunctionComplexity,
      average_function_complexity: Math.round(averageCyclomatic * 10) / 10,
      average_nesting_depth: Math.round(averageNestingDepth * 10) / 10,
      max_nesting_depth: functionCount > 0 ? Math.max(...depthValues) : 0,
    };
  }

  findFunctionAst(ast, funcName, _startLine) {
    let found = null;

    const traverse = node => {
      if (found) return;
      if (!node || typeof node !== 'object') return;

      if (node.type === 'FunctionDeclaration' && node.id?.name === funcName) {
        found = node;
        return;
      }

      if (
        (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') &&
        node.id?.name === funcName
      ) {
        found = node;
        return;
      }

      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(child => traverse(child));
        } else if (typeof value === 'object' && value !== null) {
          traverse(value);
        }
      }
    };

    traverse(ast);
    return found;
  }

  calculateCyclomaticComplexity(node) {
    let complexity = 1;

    const traverse = n => {
      if (!n || typeof n !== 'object') return;

      switch (n.type) {
        case 'IfStatement':
        case 'ConditionalExpression':
          complexity++;
          break;
        case 'SwitchCase':
          if (n.test) complexity++;
          break;
        case 'ForStatement':
        case 'ForInStatement':
        case 'ForOfStatement':
        case 'WhileStatement':
        case 'DoWhileStatement':
          complexity++;
          break;
        case 'CatchClause':
          complexity++;
          break;
        case 'LogicalExpression':
          if (n.operator === '&&' || n.operator === '||') {
            complexity++;
          }
          break;
      }

      for (const key in n) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = n[key];
        if (Array.isArray(value)) {
          value.forEach(child => traverse(child));
        } else if (typeof value === 'object' && value !== null) {
          traverse(value);
        }
      }
    };

    traverse(node);
    return complexity;
  }

  calculateMaxNestingDepth(node) {
    let maxDepth = 0;

    const traverse = (n, currentDepth) => {
      if (!n || typeof n !== 'object') return;

      const isNestingStructure = [
        'IfStatement',
        'ForStatement',
        'ForInStatement',
        'ForOfStatement',
        'WhileStatement',
        'DoWhileStatement',
        'SwitchStatement',
        'TryStatement',
        'CatchClause',
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression',
        'ClassDeclaration',
      ].includes(n.type);

      if (isNestingStructure) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }

      for (const key in n) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = n[key];
        if (Array.isArray(value)) {
          value.forEach(child => traverse(child, currentDepth));
        } else if (typeof value === 'object' && value !== null) {
          traverse(value, currentDepth);
        }
      }
    };

    traverse(node, 0);
    return maxDepth;
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

  /**
   * 从 Oxc AST 提取函数调用关系
   * @param {Object} ast - Oxc AST
   * @param {string} filePath - 文件路径
   * @param {string} sourceCode - 源代码
   * @returns {Array<{target: string, file_path: string, line: number, column?: number}>} 调用列表
   */
  extractCallsFromOxcAst(ast, filePath, sourceCode) {
    const calls = [];
    const builtinCalls = [
      'console.log',
      'console.error',
      'console.warn',
      'console.info',
      'console.debug',
    ];

    const traverse = node => {
      if (!node || typeof node !== 'object') return;

      // 处理 CallExpression
      if (node.type === 'CallExpression') {
        let targetName = null;

        // 直接调用: func()
        if (node.callee?.type === 'Identifier') {
          targetName = node.callee.name;
        }
        // 成员调用: obj.method()
        else if (node.callee?.type === 'MemberExpression') {
          const obj = node.callee.object?.name || '';
          const prop = node.callee.property?.name || '';
          if (obj && prop) {
            targetName = `${obj}.${prop}`;
          }
        }

        // 过滤内置调用
        if (targetName && !builtinCalls.includes(targetName)) {
          const line = this.getLineFromPosition(sourceCode, node.start);
          const column = this.getColumnFromPosition(sourceCode, node.start);
          calls.push({
            target: targetName,
            file_path: filePath,
            line: line,
            column: column,
          });
        }
      }

      // 递归遍历子节点
      for (const key in node) {
        if (key === 'type' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(child => traverse(child));
        } else if (typeof value === 'object' && value !== null) {
          traverse(value);
        }
      }
    };

    traverse(ast);
    return calls;
  }

  /**
   * 从位置计算行号
   * @param {string} sourceCode - 源代码
   * @param {number} position - 字符位置
   * @returns {number} 行号（1-based）
   */
  getLineFromPosition(sourceCode, position) {
    const lines = sourceCode.substring(0, position).split('\n');
    return lines.length;
  }

  /**
   * 从位置计算列号
   * @param {string} sourceCode - 源代码
   * @param {number} position - 字符位置
   * @returns {number} 列号（0-based）
   */
  getColumnFromPosition(sourceCode, position) {
    const lines = sourceCode.substring(0, position).split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine.length;
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
