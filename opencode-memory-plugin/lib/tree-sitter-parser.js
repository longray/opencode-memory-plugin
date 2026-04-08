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
    const interfaces = [];
    const imports = [];

    extractSymbols(rootNode, sourceCode, language, {
      functions,
      classes,
      interfaces,
      imports,
    });

    const complexityMetrics = calculateBasicComplexity(functions, classes, sourceCode, rootNode);
    const calls = extractCalls(rootNode, sourceCode, language, filePath);
    const duration = performance.now() - startTime;

    return {
      language,
      analyzer: 'tree-sitter',
      analyzed_at: new Date().toISOString(),
      analyzer_version: '0.26.7',
      functions,
      classes,
      interfaces,
      imports,
      exports: [],
      calls,
      complexity_metrics: complexityMetrics,
      dependencies: imports.map(imp => imp.source),
      analysis_duration_ms: duration,
    };
  } catch (error) {
    if (error.message.includes('Parser.init is not a function')) {
      throw new Error(
        `Tree-sitter WASM initialization failed. ` +
          `Multi-language support (Python/Go/Rust/Java) is not yet available. ` +
          `Please use JavaScript or TypeScript files for full AST analysis.`
      );
    }
    throw new Error(`Tree-sitter analysis failed: ${error.message}`);
  }
}

/**
 * 从 AST 提取符号
 */
function extractSymbols(node, _sourceCode, language, collectors) {
  const {
    functions: _functions,
    classes: _classes,
    interfaces: _interfaces,
    imports: _imports,
  } = collectors;

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
      const isAsync = node.children.some(child => child.type === 'async');

      let returnType = undefined;
      const returnTypeNode = node.childForFieldName('return_type');
      if (returnTypeNode) {
        returnType = returnTypeNode.text;
      }

      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
        return_type: returnType,
        is_exported: false,
        is_async: isAsync,
      });
    }
  } else if (node.type === 'class_definition') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const classInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
        properties: [],
      };

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
          } else if (child.type === 'expression_statement') {
            const assignmentNode = child.childForFieldName('expression');
            if (assignmentNode && assignmentNode.type === 'assignment') {
              const leftNode = assignmentNode.childForFieldName('left');
              if (leftNode && leftNode.type === 'attribute') {
                const objNode = leftNode.childForFieldName('object');
                const attrNode = leftNode.childForFieldName('attribute');
                if (objNode && objNode.text === 'self' && attrNode) {
                  classInfo.properties.push({
                    name: attrNode.text,
                    line: child.startPosition.row + 1,
                  });
                }
              }
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
      const funcName = nameNode.text;
      const isExported = funcName[0] === funcName[0].toUpperCase();

      let returnType = undefined;
      const resultNode = node.childForFieldName('result');
      if (resultNode) {
        returnType = resultNode.text;
      }

      functions.push({
        name: funcName,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
        return_type: returnType,
        is_exported: isExported,
        is_async: false,
      });
    }
  } else if (node.type === 'method_declaration') {
    const nameNode = node.childForFieldName('name');
    const receiverNode = node.childForFieldName('receiver');
    if (nameNode && receiverNode) {
      const receiverType = extractReceiverType(receiverNode);
      const methodName = nameNode.text;
      const isExported = methodName[0] === methodName[0].toUpperCase();

      let returnType = undefined;
      const resultNode = node.childForFieldName('result');
      if (resultNode) {
        returnType = resultNode.text;
      }

      functions.push({
        name: `${receiverType}.${methodName}`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'method',
        return_type: returnType,
        is_exported: isExported,
        is_async: false,
      });
    }
  } else if (node.type === 'type_spec') {
    const nameNode = node.childForFieldName('name');
    const typeNode = node.childForFieldName('type');
    if (nameNode && typeNode) {
      if (typeNode.type === 'interface_type') {
        const interfaceInfo = {
          name: nameNode.text,
          line: node.startPosition.row + 1,
          methods: [],
        };

        const interfaceBody = typeNode.childForFieldName('body');
        if (interfaceBody) {
          for (const child of interfaceBody.children) {
            if (child.type === 'method_spec') {
              const methodName = child.childForFieldName('name');
              if (methodName) {
                interfaceInfo.methods.push({
                  name: methodName.text,
                  line: child.startPosition.row + 1,
                });
              }
            }
          }
        }

        interfaces.push(interfaceInfo);
      } else {
        classes.push({
          name: nameNode.text,
          line: node.startPosition.row + 1,
          methods: [],
          properties: [],
        });
      }
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
      const isExported =
        node.parent?.type === 'declaration_list' || node.parent?.type === 'source_file';

      const isAsync = node.children.some(child => child.type === 'async');

      let returnType = undefined;
      const returnTypeNode = node.childForFieldName('return_type');
      if (returnTypeNode) {
        returnType = returnTypeNode.text;
      }

      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
        return_type: returnType,
        is_exported: isExported,
        is_async: isAsync,
      });
    }
  } else if (node.type === 'struct_item') {
    const nameNode = node.childForFieldName('name');
    const bodyNode = node.childForFieldName('body');
    if (nameNode) {
      const classInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'struct',
        methods: [],
        properties: [],
      };

      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'field_declaration') {
            const fieldName = child.childForFieldName('name');
            if (fieldName) {
              classInfo.properties.push({
                name: fieldName.text,
                line: child.startPosition.row + 1,
              });
            }
          }
        }
      }

      classes.push(classInfo);
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
  } else if (node.type === 'trait_item') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const interfaceInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
      };

      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'function_item') {
            const funcName = child.childForFieldName('name');
            if (funcName) {
              interfaceInfo.methods.push({
                name: funcName.text,
                line: child.startPosition.row + 1,
              });
            }
          }
        }
      }

      interfaces.push(interfaceInfo);
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
    const modifiersNode = node.childForFieldName('modifiers');
    if (nameNode) {
      const modifiers = modifiersNode ? modifiersNode.text.split(/\s+/) : [];
      const isExported = modifiers.includes('public');

      let returnType = undefined;
      const typeNode = node.childForFieldName('type');
      if (typeNode) {
        returnType = typeNode.text;
      }

      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'method',
        return_type: returnType,
        is_exported: isExported,
        is_async: false,
      });
    }
  } else if (node.type === 'class_declaration') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const classInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
        properties: [],
      };

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
          } else if (child.type === 'field_declaration') {
            const declaratorNode = child.childForFieldName('declarator');
            if (declaratorNode) {
              const fieldName = declaratorNode.childForFieldName('name');
              if (fieldName) {
                classInfo.properties.push({
                  name: fieldName.text,
                  line: child.startPosition.row + 1,
                });
              }
            }
          }
        }
      }

      classes.push(classInfo);
    }
  } else if (node.type === 'interface_declaration') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const interfaceInfo = {
        name: nameNode.text,
        line: node.startPosition.row + 1,
        methods: [],
      };

      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (const child of bodyNode.children) {
          if (child.type === 'method_declaration') {
            const methodName = child.childForFieldName('name');
            if (methodName) {
              interfaceInfo.methods.push({
                name: methodName.text,
                line: child.startPosition.row + 1,
              });
            }
          }
        }
      }

      interfaces.push(interfaceInfo);
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
 * 从 AST 提取调用关系
 */
function extractCalls(node, sourceCode, language, filePath) {
  const calls = [];

  switch (language) {
    case 'python':
      extractPythonCalls(node, sourceCode, filePath, calls);
      break;
    case 'go':
      extractGoCalls(node, sourceCode, filePath, calls);
      break;
    case 'rust':
      extractRustCalls(node, sourceCode, filePath, calls);
      break;
    case 'java':
      extractJavaCalls(node, sourceCode, filePath, calls);
      break;
  }

  return calls;
}

/**
 * 提取 Python 调用
 */
function extractPythonCalls(node, sourceCode, filePath, calls) {
  const builtinCalls = ['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set'];

  if (node.type === 'call') {
    const funcNode = node.childForFieldName('function');
    if (funcNode) {
      let targetName = '';

      // 直接调用: func()
      if (funcNode.type === 'identifier') {
        targetName = funcNode.text;
      }
      // 成员调用: obj.method()
      else if (funcNode.type === 'attribute') {
        const objNode = funcNode.childForFieldName('object');
        const attrNode = funcNode.childForFieldName('attribute');
        if (objNode && attrNode) {
          targetName = `${objNode.text}.${attrNode.text}`;
        }
      }

      if (targetName && !builtinCalls.includes(targetName.split('.')[0])) {
        calls.push({
          target: targetName,
          file_path: filePath,
          line: node.startPosition.row + 1,
          column: node.startPosition.column,
        });
      }
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractPythonCalls(child, sourceCode, filePath, calls);
  }
}

/**
 * 提取 Go 调用
 */
function extractGoCalls(node, sourceCode, filePath, calls) {
  const builtinCalls = ['fmt.Println', 'fmt.Printf', 'fmt.Print', 'len', 'cap', 'append'];

  if (node.type === 'call_expression') {
    const funcNode = node.childForFieldName('function');
    if (funcNode) {
      let targetName = '';

      // 直接调用: func()
      if (funcNode.type === 'identifier') {
        targetName = funcNode.text;
      }
      // 成员调用: pkg.Func()
      else if (funcNode.type === 'selector_expression') {
        const pkgNode = funcNode.childForFieldName('operand');
        const funcNameNode = funcNode.childForFieldName('field');
        if (pkgNode && funcNameNode) {
          targetName = `${pkgNode.text}.${funcNameNode.text}`;
        }
      }

      if (targetName && !builtinCalls.includes(targetName)) {
        calls.push({
          target: targetName,
          file_path: filePath,
          line: node.startPosition.row + 1,
          column: node.startPosition.column,
        });
      }
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractGoCalls(child, sourceCode, filePath, calls);
  }
}

/**
 * 提取 Rust 调用
 */
function extractRustCalls(node, sourceCode, filePath, calls) {
  const builtinCalls = ['println!', 'print!', 'eprintln!', 'eprint!', 'format!', 'vec!'];

  if (node.type === 'call_expression') {
    const funcNode = node.childForFieldName('function');
    if (funcNode) {
      let targetName = '';

      // 直接调用: func()
      if (funcNode.type === 'identifier') {
        targetName = funcNode.text;
      }
      // 成员调用: obj.method()
      else if (funcNode.type === 'field_expression') {
        const objNode = funcNode.childForFieldName('value');
        const methodNode = funcNode.childForFieldName('field');
        if (objNode && methodNode) {
          targetName = `${objNode.text}.${methodNode.text}`;
        }
      }

      if (targetName && !builtinCalls.includes(targetName)) {
        calls.push({
          target: targetName,
          file_path: filePath,
          line: node.startPosition.row + 1,
          column: node.startPosition.column,
        });
      }
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractRustCalls(child, sourceCode, filePath, calls);
  }
}

/**
 * 提取 Java 调用
 */
function extractJavaCalls(node, sourceCode, filePath, calls) {
  const builtinCalls = ['System.out.println', 'System.out.print', 'System.err.println'];

  if (node.type === 'method_invocation') {
    const funcNode = node.childForFieldName('name');
    const objNode = node.childForFieldName('object');

    let targetName = '';

    // 直接调用: method()
    if (funcNode && !objNode) {
      targetName = funcNode.text;
    }
    // 成员调用: obj.method()
    else if (funcNode && objNode) {
      targetName = `${objNode.text}.${funcNode.text}`;
    }

    if (targetName && !builtinCalls.includes(targetName)) {
      calls.push({
        target: targetName,
        file_path: filePath,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
      });
    }
  }

  // 递归处理子节点
  for (const child of node.children) {
    extractJavaCalls(child, sourceCode, filePath, calls);
  }
}

/**
 * 计算圈复杂度（基于AST）
 * @param {Object} node - Tree-sitter AST节点
 * @returns {number} 圈复杂度
 */
function calculateCyclomaticComplexity(node) {
  let complexity = 1;

  const traverse = n => {
    if (!n || typeof n !== 'object') return;

    const decisionTypes = [
      'if_statement',
      'if_expression',
      'conditional_expression',
      'for_statement',
      'for_expression',
      'while_statement',
      'while_expression',
      'do_statement',
      'match_expression',
      'match_arm',
      'case',
      'try_statement',
      'try_expression',
      'catch_clause',
      'except_clause',
      'finally_clause',
      'with_statement',
      'with_expression',
      'and',
      'or',
      '&&',
      '||',
      'binary_expression',
    ];

    if (decisionTypes.includes(n.type)) {
      complexity++;
    }

    if (n.children) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  };

  traverse(node);
  return complexity;
}

/**
 * 计算最大嵌套深度
 * @param {Object} node - Tree-sitter AST节点
 * @returns {number} 最大嵌套深度
 */
function calculateMaxNestingDepth(node) {
  let maxDepth = 0;

  const nestingTypes = [
    'if_statement',
    'if_expression',
    'for_statement',
    'for_expression',
    'while_statement',
    'while_expression',
    'do_statement',
    'match_expression',
    'try_statement',
    'try_expression',
    'catch_clause',
    'except_clause',
    'with_statement',
    'with_expression',
    'function_definition',
    'function_item',
    'function_declaration',
    'method_declaration',
    'class_definition',
    'class_declaration',
    'struct_item',
  ];

  const traverse = (n, currentDepth) => {
    if (!n || typeof n !== 'object') return;

    if (nestingTypes.includes(n.type)) {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    if (n.children) {
      for (const child of n.children) {
        traverse(child, currentDepth);
      }
    }
  };

  traverse(node, 0);
  return maxDepth;
}

/**
 * 计算基础复杂度（基于AST）
 * @param {Array} functions - 函数列表
 * @param {Array} classes - 类列表
 * @param {string} sourceCode - 源代码
 * @param {Object} rootNode - Tree-sitter AST根节点
 * @returns {Object} 复杂度指标
 */
function calculateBasicComplexity(functions, classes, sourceCode, rootNode) {
  const lines = sourceCode.split('\n').length;
  const functionCount = functions.length;
  const classCount = classes.length;

  const functionComplexities = functions.map(func => {
    const funcNode = findFunctionNode(rootNode, func.name, func.line);
    if (funcNode) {
      const complexity = calculateCyclomaticComplexity(funcNode);
      const maxDepth = calculateMaxNestingDepth(funcNode);
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

/**
 * 查找函数节点
 * @param {Object} node - Tree-sitter AST节点
 * @param {string} funcName - 函数名
 * @param {number} startLine - 起始行号
 * @returns {Object|null} 函数节点
 */
function findFunctionNode(node, funcName, startLine) {
  const functionTypes = [
    'function_definition',
    'function_item',
    'function_declaration',
    'method_declaration',
  ];

  if (functionTypes.includes(node.type)) {
    const nameNode = node.childForFieldName('name');
    if (nameNode && nameNode.text === funcName) {
      if (node.startPosition.row + 1 === startLine) {
        return node;
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findFunctionNode(child, funcName, startLine);
      if (found) return found;
    }
  }

  return null;
}
