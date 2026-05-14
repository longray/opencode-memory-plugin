/**
 * @deprecated since v3.4 - Replaced by graphify-bridge.js
 * This module will be removed in a future version.
 * Use graphifyProject() from graphify-bridge.js instead.
 */

import { parseSync } from 'oxc-parser';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { analyzeWithTreeSitter } from './tree-sitter-parser.js';
import { getConfig } from './storage.js';
import {
  QUEUE_TIMEOUT_MS as DEFAULT_QUEUE_TIMEOUT_MS,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_FILE_TIMEOUT_MS,
  EXTENSION_TO_LANGUAGE,
} from './constants.js';
import { logInfo, logError, logWarn } from './logger.js';

function readCodeAnalysisConfig() {
  return getConfig().code_analysis || {};
}

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

export const DEFAULT_CONFIG = (() => {
  const _cfg = readCodeAnalysisConfig();
  return {
    debounceMs: _cfg.debounce_ms || DEFAULT_DEBOUNCE_MS,
    maxConcurrent: _cfg.max_concurrent || 2,
    maxQueueSize: _cfg.max_queue_size || 10,
    queueTimeoutMs: _cfg.queue_timeout_ms || DEFAULT_QUEUE_TIMEOUT_MS,
    fileTimeoutMs: _cfg.file_timeout_ms || DEFAULT_FILE_TIMEOUT_MS,
    largeFileThreshold: _cfg.large_file_threshold || 5000,
    skipFileThreshold: _cfg.skip_file_threshold || 10000,
    batchDelayMs: _cfg.batch_delay_ms || 2000,
    batchMaxSize: _cfg.batch_max_size || 10,
  };
})();

/**
 * 内置调用列表（用于过滤常见内置函数调用）
 * 使用 Set 实现 O(1) 查找
 */
const BUILTIN_CALLS = new Set([
  'console.log',
  'console.error',
  'console.warn',
  'console.info',
  'console.debug',
  'Array.isArray',
  'Array.from',
  'Array.of',
  'Object.keys',
  'Object.values',
  'Object.entries',
  'Object.assign',
  'Object.create',
  'Object.freeze',
  'Object.seal',
  'Math.max',
  'Math.min',
  'Math.random',
  'Math.floor',
  'Math.ceil',
  'Math.round',
  'Math.abs',
  'Math.pow',
  'Math.sqrt',
  'String.fromCharCode',
  'String.raw',
  'Number.parseInt',
  'Number.parseFloat',
  'Number.isNaN',
  'Number.isFinite',
  'Number.isInteger',
  'Promise.all',
  'Promise.allSettled',
  'Promise.race',
  'Promise.resolve',
  'Promise.reject',
  'JSON.parse',
  'JSON.stringify',
]);

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
      const sourceCode = content ?? (await readFile(filePath, 'utf-8'));
      const lines = sourceCode.split('\n').length;

      if (lines > this.config.skipFileThreshold) {
        return this.createFallbackResult(filePath, sourceCode, lines, [
          {
            type: 'large_file',
            reason: `File has ${lines} lines, exceeds threshold ${this.config.skipFileThreshold}`,
          },
        ]);
      }

      const language = CodeAnalyzer.detectLanguage(filePath);
      const result = await this.analyzeWithStrategy(filePath, sourceCode, language, warnings);

      const _duration = performance.now() - startTime;
      logInfo(
        'CodeAnalyzer',
        `[CodeAnalyzer] Analyzing ${filePath} (${language}): ${result.functions?.length || 0} functions, ${result.calls?.length || 0} calls`
      );

      return result;
    } catch (error) {
      logError('CodeAnalyzer', `[CodeAnalyzer] Failed to analyze ${filePath}`, error);

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
          const fileSizeKB = Math.round(sourceCode.length / 1024);
          logWarn(
            'CodeAnalyzer',
            `[CodeAnalyzer] ${filePath} Oxc parse slow (${oxcDuration.toFixed(0)}ms for ${fileSizeKB}KB)`
          );
        }

        return result;
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

    const uniqueFunctions = this.deduplicateFunctions(functions);

    const enrichedFunctions = this.enrichFunctionsWithComplexity(uniqueFunctions, ast);

    const qualityScore = this.calculateFileQualityScore(
      complexityMetrics,
      enrichedFunctions,
      classes
    );

    return {
      language,
      analyzer: 'oxc',
      analyzed_at: new Date().toISOString(),
      analyzer_version: '0.x',
      functions: enrichedFunctions,
      classes,
      interfaces,
      imports,
      exports,
      calls,
      complexity_metrics: complexityMetrics,
      dependencies,
      quality_score: qualityScore,
    };
  }

  /**
   * 计算文件级代码质量评分
   * @param {Object} complexityMetrics - 复杂度指标
   * @param {Array} functions - 函数列表
   * @param {Array} classes - 类列表
   * @returns {Object} 质量评分
   */
  calculateFileQualityScore(complexityMetrics, functions, _classes) {
    const { cyclomatic, max_function_complexity, max_nesting_depth, lines_of_code } =
      complexityMetrics;

    let score = 100;
    const issues = [];

    if (cyclomatic > 10) {
      score -= 20;
      issues.push('平均圈复杂度过高');
    } else if (cyclomatic > 5) {
      score -= 10;
      issues.push('平均圈复杂度偏高');
    }

    if (max_function_complexity > 20) {
      score -= 20;
      issues.push('存在极高复杂度函数');
    } else if (max_function_complexity > 10) {
      score -= 10;
      issues.push('存在高复杂度函数');
    }

    if (max_nesting_depth > 5) {
      score -= 15;
      issues.push('嵌套深度过大');
    } else if (max_nesting_depth > 3) {
      score -= 5;
      issues.push('嵌套深度偏高');
    }

    if (lines_of_code > 500) {
      score -= 15;
      issues.push('文件过大');
    } else if (lines_of_code > 300) {
      score -= 5;
      issues.push('文件偏大');
    }

    const functionCount = functions?.length || 0;
    if (functionCount > 20) {
      score -= 10;
      issues.push('函数数量过多');
    }

    score = Math.max(0, Math.min(100, score));

    let grade = 'A';
    if (score >= 90) {
      grade = 'A';
    } else if (score >= 70) {
      grade = 'B';
    } else if (score >= 50) {
      grade = 'C';
    } else {
      grade = 'D';
    }

    return {
      score,
      grade,
      issues,
      recommendations: this.generateRecommendations(issues),
    };
  }

  /**
   * 生成改进建议
   * @param {Array} issues - 问题列表
   * @returns {Array} 建议列表
   */
  generateRecommendations(issues) {
    const recommendations = [];

    for (const issue of issues) {
      switch (issue) {
        case '平均圈复杂度过高':
        case '平均圈复杂度偏高':
          recommendations.push('考虑将复杂函数拆分为更小的函数');
          break;
        case '存在极高复杂度函数':
        case '存在高复杂度函数':
          recommendations.push('重构高复杂度函数，提取逻辑到独立函数');
          break;
        case '嵌套深度过大':
        case '嵌套深度偏高':
          recommendations.push('减少嵌套层级，使用提前返回或提取函数');
          break;
        case '文件过大':
        case '文件偏大':
          recommendations.push('考虑将大文件拆分为多个模块');
          break;
        case '函数数量过多':
          recommendations.push('考虑将相关函数组织到单独的模块中');
          break;
      }
    }

    return recommendations;
  }

  /**
   * 将 Oxc 字节偏移转换为行号
   * Oxc AST 节点只提供 start/end 字节偏移，不提供 loc 属性。
   * 通过计算偏移位置前的换行符数量推导行号。
   * @param {string} sourceCode - 源代码文本
   * @param {number} byteOffset - 字节偏移量
   * @returns {number} 行号（1-based）
   */
  offsetToLine(sourceCode, byteOffset) {
    if (!sourceCode || byteOffset == null || byteOffset < 0) return 0;
    let line = 1;
    const limit = Math.min(byteOffset, sourceCode.length);
    for (let i = 0; i < limit; i++) {
      if (sourceCode.charCodeAt(i) === 0x0a) line++;
    }
    return line;
  }

  deduplicateFunctions(functions) {
    const seen = new Set();
    return functions.filter(func => {
      const key = `${func.name}:${func.start_line}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  extractReturnType(returnTypeNode) {
    if (!returnTypeNode?.typeAnnotation) return null;
    const typeNode = returnTypeNode.typeAnnotation;
    if (typeNode.type === 'TSStringKeyword') return 'string';
    if (typeNode.type === 'TSNumberKeyword') return 'number';
    if (typeNode.type === 'TSBooleanKeyword') return 'boolean';
    if (typeNode.type === 'TSVoidKeyword') return 'void';
    if (typeNode.type === 'TSArrayType') return 'Array';
    if (typeNode.type === 'TSTypeReference') return typeNode.typeName?.name || 'unknown';
    if (typeNode.type === 'TSUnionType') {
      return typeNode.types
        ?.map(t => this.extractReturnType({ typeAnnotation: t }))
        .filter(Boolean)
        .join(' | ');
    }
    if (typeNode.type === 'TSFunctionType') return 'Function';
    if (typeNode.type === 'TSObjectKeyword') return 'object';
    if (typeNode.type === 'TSAnyKeyword') return 'any';
    if (typeNode.type === 'TSUnknownKeyword') return 'unknown';
    return typeNode.type;
  }

  buildFunctionSignature(name, params, returnType, isAsync) {
    const paramsStr = params.map(p => `${p.name}${p.type ? `: ${p.type}` : ''}`).join(', ');
    const asyncPrefix = isAsync ? 'async ' : '';
    const returnStr = returnType ? `: ${returnType}` : '';
    return `${asyncPrefix}function ${name || 'anonymous'}(${paramsStr})${returnStr}`;
  }

  extractSymbolsFromOxcAst(node, sourceCode, collectors, parentExported = false, comments = []) {
    if (!node || typeof node !== 'object') return;

    const { functions, classes, interfaces, imports, exports } = collectors;

    switch (node.type) {
      case 'FunctionDeclaration': {
        const jsdoc = this.extractJSDoc(node.start, comments);
        const params = this.extractParams(node.params);
        const returnType = this.extractReturnType(node.returnType);
        const signature = this.buildFunctionSignature(
          node.id?.name,
          params,
          returnType,
          node.async
        );
        functions.push({
          name: node.id?.name || 'anonymous',
          start_line: this.offsetToLine(sourceCode, node.start),
          end_line: this.offsetToLine(sourceCode, node.end),
          params,
          return_type: returnType,
          signature,
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

        let superClass = null;
        if (node.superClass) {
          if (node.superClass.type === 'Identifier') {
            superClass = node.superClass.name;
          } else if (node.superClass.type === 'MemberExpression') {
            superClass = node.superClass.property?.name || node.superClass.object?.name || null;
          }
        }

        const implementsList = [];
        if (node.implements && Array.isArray(node.implements)) {
          for (const impl of node.implements) {
            if (impl.expression?.type === 'Identifier') {
              implementsList.push(impl.expression.name);
            } else if (impl.expression?.type === 'MemberExpression') {
              implementsList.push(impl.expression.property?.name || impl.expression.object?.name);
            }
          }
        }

        node.body?.body?.forEach(member => {
          if (member.type === 'MethodDefinition') {
            classMethods.push(member.key?.name || 'anonymous');
          } else if (member.type === 'PropertyDefinition') {
            classProperties.push(member.key?.name);
          }
        });

        classes.push({
          name: node.id?.name || 'anonymous',
          start_line: this.offsetToLine(sourceCode, node.start),
          end_line: this.offsetToLine(sourceCode, node.end),
          methods: classMethods,
          properties: classProperties,
          superClass,
          implements: implementsList.length > 0 ? implementsList : undefined,
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

        const extendsList = [];
        if (node.extends && Array.isArray(node.extends)) {
          for (const ext of node.extends) {
            if (ext.expression?.type === 'Identifier') {
              extendsList.push(ext.expression.name);
            } else if (ext.expression?.type === 'MemberExpression') {
              extendsList.push(ext.expression.property?.name || ext.expression.object?.name);
            }
          }
        }

        node.body?.body?.forEach(member => {
          if (member.type === 'TSMethodSignature') {
            interfaceMethods.push(member.key?.name);
          } else if (member.type === 'TSPropertySignature') {
            interfaceProperties.push(member.key?.name);
          }
        });

        interfaces.push({
          name: node.id?.name || 'anonymous',
          start_line: this.offsetToLine(sourceCode, node.start),
          end_line: this.offsetToLine(sourceCode, node.end),
          methods: interfaceMethods,
          properties: interfaceProperties,
          extends: extendsList.length > 0 ? extendsList : undefined,
          jsdoc,
        });
        break;
      }

      case 'ImportDeclaration':
        imports.push({
          source: node.source?.value || '',
          imported_names: node.specifiers?.map(s => s.local?.name) || [],
          start_line: this.offsetToLine(sourceCode, node.start),
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
      if (key === 'type' || key === 'loc' || key === 'range' || key === 'declaration') continue;
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

  enrichFunctionsWithComplexity(functions, ast) {
    return functions.map(func => {
      const funcAst = this.findFunctionAst(ast, func.name, func.start_line);
      if (funcAst) {
        const complexity = this.calculateCyclomaticComplexity(funcAst);
        const maxDepth = this.calculateMaxNestingDepth(funcAst);
        return {
          ...func,
          complexity,
          max_nesting_depth: maxDepth,
        };
      }
      return { ...func, complexity: 1, max_nesting_depth: 0 };
    });
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

  findFunctionAst(ast, funcName, startLine) {
    let found = null;

    const traverse = node => {
      if (found) return;
      if (!node || typeof node !== 'object') return;

      const nodeStartLine = node.loc?.start?.line;
      const isMatch =
        (node.type === 'FunctionDeclaration' && node.id?.name === funcName) ||
        ((node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') &&
          node.id?.name === funcName);

      if (isMatch) {
        if (
          !found ||
          (startLine &&
            nodeStartLine &&
            Math.abs(nodeStartLine - startLine) <
              Math.abs((found.loc?.start?.line || 0) - startLine))
        ) {
          found = node;
        }
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

    function resolveMemberObject(node) {
      if (!node) return '';
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'ThisExpression') return 'this';
      if (node.type === 'Super') return 'super';
      if (node.type === 'MemberExpression') {
        const obj = resolveMemberObject(node.object);
        const prop = node.property?.name || '';
        return obj ? `${obj}.${prop}` : prop;
      }
      return '';
    }

    const traverse = node => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'CallExpression') {
        let targetName = null;

        if (node.callee?.type === 'Identifier') {
          targetName = node.callee.name;
        } else if (node.callee?.type === 'MemberExpression') {
          const obj = resolveMemberObject(node.callee.object);
          const prop = node.callee.property?.name || '';
          if (obj && prop) {
            targetName = `${obj}.${prop}`;
          }
        }

        if (targetName && !BUILTIN_CALLS.has(targetName)) {
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
    let line = 1;
    for (let i = 0; i < position && i < sourceCode.length; i++) {
      if (sourceCode.charCodeAt(i) === 0x0a) line++;
    }
    return line;
  }

  /**
   * 从位置计算列号
   * @param {string} sourceCode - 源代码
   * @param {number} position - 字符位置
   * @returns {number} 列号（0-based）
   */
  getColumnFromPosition(sourceCode, position) {
    let col = 0;
    for (let i = 0; i < position && i < sourceCode.length; i++) {
      if (sourceCode.charCodeAt(i) === 0x0a) col = 0;
      else col++;
    }
    return col;
  }

  createFallbackResult(filePath, sourceCode, lines, warnings) {
    const language = CodeAnalyzer.detectLanguage(filePath);

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
        average_nesting_depth: null,
        max_nesting_depth: null,
      },
      dependencies: {
        internal: [],
        external: [],
        builtin: [],
      },
      calls: [],
      warnings,
    };
  }

  static detectLanguage(filePath) {
    const ext = extname(filePath).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || 'unknown';
  }
}

export const codeAnalyzer = new CodeAnalyzer();
