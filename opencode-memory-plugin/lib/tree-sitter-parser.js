import * as Parser from 'web-tree-sitter';

let parserInitialized = false;
let languageCache = new Map();

/**
 * 初始化 Tree-sitter WASM
 */
async function initParser() {
  if (parserInitialized) return;

  await Parser.init();
  parserInitialized = true;
}

/**
 * 加载语言 grammar
 */
async function loadLanguage(languageName) {
  if (languageCache.has(languageName)) {
    return languageCache.get(languageName);
  }

  await initParser();

  let langModule;
  try {
    switch (languageName) {
      case 'python':
        langModule = await import('tree-sitter-python');
        break;
      case 'go':
        langModule = await import('tree-sitter-go');
        break;
      case 'rust':
        langModule = await import('tree-sitter-rust');
        break;
      case 'java':
        langModule = await import('tree-sitter-java');
        break;
      default:
        throw new Error(`Unsupported language: ${languageName}`);
    }
  } catch (error) {
    throw new Error(`Failed to load ${languageName} grammar: ${error.message}`);
  }

  const language = await Parser.Language.load(langModule.default);
  languageCache.set(languageName, language);
  return language;
}

/**
 * 使用 Tree-sitter 分析代码
 * @param {string} filePath - 文件路径
 * @param {string} sourceCode - 源代码
 * @param {string} language - 语言名称 (python, go, rust, java)
 * @returns {Object} 分析结果
 */
export async function analyzeWithTreeSitter(filePath, sourceCode, language) {
  const startTime = performance.now();

  try {
    const lang = await loadLanguage(language);
    const parser = new Parser();
    parser.setLanguage(lang);

    const tree = parser.parse(sourceCode);
    const rootNode = tree.rootNode;

    const functions = [];
    const classes = [];
    const imports = [];

    extractSymbols(rootNode, sourceCode, language, {
      functions,
      classes,
      imports,
    });

    const complexityMetrics = calculateBasicComplexity(functions, classes, sourceCode);
    const duration = performance.now() - startTime;

    return {
      language,
      analyzer: 'tree-sitter',
      analyzed_at: new Date().toISOString(),
      analyzer_version: '0.26.7',
      functions,
      classes,
      interfaces: [], // Tree-sitter 不区分接口
      imports,
      exports: [], // 简化处理
      complexity_metrics: complexityMetrics,
      dependencies: imports.map(imp => imp.source),
      analysis_duration_ms: duration,
    };
  } catch (error) {
    throw new Error(`Tree-sitter analysis failed: ${error.message}`);
  }
}

/**
 * 从 AST 提取符号
 */
function extractSymbols(node, _sourceCode, language, collectors) {
  const { functions: _functions, classes: _classes, imports: _imports } = collectors;

  // 根据语言类型选择不同的提取策略
  switch (language) {
    case 'python':
      extractPythonSymbols(node, sourceCode, collectors);
      break;
    case 'go':
      extractGoSymbols(node, sourceCode, collectors);
      break;
    case 'rust':
      extractRustSymbols(node, sourceCode, collectors);
      break;
    case 'java':
      extractJavaSymbols(node, sourceCode, collectors);
      break;
  }
}

/**
 * 提取 Python 符号
 */
function extractPythonSymbols(node, sourceCode, collectors) {
  const { functions, classes, imports } = collectors;

  if (node.type === 'function_definition') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
      });
    }
  } else if (node.type === 'class_definition') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const classInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
      };

      // 提取类方法
      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'function_definition') {
            const methodName = child.childForFieldName('name');
            if (methodName) {
              classInfo.methods.push({
                name: methodName.text,
                line: child.startPosition.row + 1,
              });
            }
          }
        }
      }

      classes.push(classInfo);
    }
  } else if (node.type === 'import_statement' || node.type === 'import_from_statement') {
    const moduleNode = node.childForFieldName('module') || node.childForFieldName('name');
    if (moduleNode) {
      imports.push({
        source: moduleNode.text,
        line: node.startPosition.row + 1,
      });
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractPythonSymbols(child, sourceCode, collectors);
  }
}

/**
 * 提取 Go 符号
 */
function extractGoSymbols(node, sourceCode, collectors) {
  const { functions, classes, imports } = collectors;

  if (node.type === 'function_declaration') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
      });
    }
  } else if (node.type === 'method_declaration') {
    const nameNode = node.childForFieldName('name');
    const receiverNode = node.childForFieldName('receiver');
    if (nameNode && receiverNode) {
      const receiverType = extractReceiverType(receiverNode);
      functions.push({
        name: `${receiverType}.${nameNode.text}`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'method',
      });
    }
  } else if (node.type === 'type_spec') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      classes.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
      });
    }
  } else if (node.type === 'import_spec') {
    const pathNode = node.childForFieldName('path');
    if (pathNode) {
      imports.push({
        source: pathNode.text.replace(/"/g, ''),
        line: node.startPosition.row + 1,
      });
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractGoSymbols(child, sourceCode, collectors);
  }
}

/**
 * 提取 Rust 符号
 */
function extractRustSymbols(node, sourceCode, collectors) {
  const { functions, classes, imports } = collectors;

  if (node.type === 'function_item') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
      });
    }
  } else if (node.type === 'struct_item') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      classes.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'struct',
        methods: [],
      });
    }
  } else if (node.type === 'impl_item') {
    const typeNode = node.childForFieldName('type');
    if (typeNode) {
      const implBody = node.childForFieldName('body');
      if (implBody) {
        for (const child of implBody.children) {
          if (child.type === 'function_item') {
            const funcName = child.childForFieldName('name');
            if (funcName) {
              // 找到对应的类并添加方法
              const classInfo = classes.find(c => c.name === typeNode.text);
              if (classInfo) {
                classInfo.methods.push({
                  name: funcName.text,
                  line: child.startPosition.row + 1,
                });
              }
            }
          }
        }
      }
    }
  } else if (node.type === 'use_declaration') {
    const argument = node.childForFieldName('argument');
    if (argument) {
      imports.push({
        source: argument.text,
        line: node.startPosition.row + 1,
      });
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractRustSymbols(child, sourceCode, collectors);
  }
}

/**
 * 提取 Java 符号
 */
function extractJavaSymbols(node, sourceCode, collectors) {
  const { functions, classes, imports } = collectors;

  if (node.type === 'method_declaration') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'method',
      });
    }
  } else if (node.type === 'class_declaration') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const classInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
      };

      // 提取类方法
      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'method_declaration') {
            const methodName = child.childForFieldName('name');
            if (methodName) {
              classInfo.methods.push({
                name: methodName.text,
                line: child.startPosition.row + 1,
              });
            }
          }
        }
      }

      classes.push(classInfo);
    }
  } else if (node.type === 'import_declaration') {
    const pathNode = node.childForFieldName('path');
    if (pathNode) {
      imports.push({
        source: pathNode.text,
        line: node.startPosition.row + 1,
      });
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractJavaSymbols(child, sourceCode, collectors);
  }
}

/**
 * 提取 Go 接收者类型
 */
function extractReceiverType(receiverNode) {
  for (const child of receiverNode.children) {
    if (child.type === 'type_identifier' || child.type === 'pointer_type') {
      return child.text.replace('*', '');
    }
  }
  return 'Unknown';
}

/**
 * 计算基础复杂度
 */
function calculateBasicComplexity(functions, classes, sourceCode) {
  const lines = sourceCode.split('\n').length;
  const functionCount = functions.length;
  const classCount = classes.length;

  // 简化的复杂度估算：基于函数数量和代码行数
  let totalComplexity = 0;
  for (const func of functions) {
    // 基础复杂度为 1，根据函数名推测复杂度（简化算法）
    let complexity = 1;
    if (func.name.includes('handle') || func.name.includes('process')) {
      complexity = 3;
    } else if (func.name.includes('validate') || func.name.includes('parse')) {
      complexity = 4;
    }
    totalComplexity += complexity;
  }

  const avgComplexity = functionCount > 0 ? totalComplexity / functionCount : 0;

  return {
    cyclomatic: Math.round(avgComplexity),
    lines_of_code: lines,
    functions: functionCount,
    classes: classCount,
    average_complexity: parseFloat(avgComplexity.toFixed(2)),
  };
}
