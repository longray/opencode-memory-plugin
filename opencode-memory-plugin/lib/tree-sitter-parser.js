import * as Parser from 'web-tree-sitter';

let parserInitialized = false;
let languageCache = new Map();

// 各语言内置模块定义
const BUILTIN_MODULES = {
  python: [
    'os',
    'sys',
    'json',
    're',
    'math',
    'random',
    'datetime',
    'collections',
    'itertools',
    'functools',
    'typing',
    'pathlib',
    'io',
    'string',
    'hashlib',
    'base64',
    'urllib',
    'http',
    'socket',
    'threading',
    'multiprocessing',
    'subprocess',
    'time',
    'calendar',
    'decimal',
    'fractions',
    'statistics',
    'csv',
    'pickle',
    'copy',
    ' pprint',
    'enum',
    'inspect',
    'textwrap',
    'dataclasses',
    'abc',
    'contextlib',
    'functools',
    'heapq',
    'bisect',
    'copy',
    'numbers',
    'builtins',
    '__future__',
    'warnings',
    'traceback',
    'types',
    'weakref',
    'codecs',
    'encodings',
    'zoneinfo',
    'graphlib',
  ],
  go: [
    'fmt',
    'os',
    'io',
    'bufio',
    'strings',
    'strconv',
    'time',
    'math',
    'math/rand',
    'sort',
    'container/list',
    'container/ring',
    'container/heap',
    'sync',
    'sync/atomic',
    'bytes',
    'errors',
    'flag',
    'path/filepath',
    'regexp',
    'regexp/syntax',
    'text/tabwriter',
    'text/template',
    'html',
    'html/template',
    'net',
    'net/http',
    'net/url',
    'net/rpc',
    'net/smtp',
    'net/textproto',
    'crypto',
    'crypto/md5',
    'crypto/sha1',
    'crypto/sha256',
    'encoding',
    'encoding/json',
    'encoding/base64',
    'encoding/binary',
    'encoding/csv',
    'encoding/hex',
    'encoding/xml',
    'archive/tar',
    'archive/zip',
    'compress/gzip',
    'compress/zlib',
    'context',
    'database/sql',
    'database/sql/driver',
    'debug',
    'debug/dwarf',
    'go/ast',
    'go/build',
    'go/parser',
    'go/token',
    'hash',
    'image',
    'log',
    'mime',
    'mime/multipart',
    'runtime',
    'runtime/debug',
    'testing',
    'testing/quick',
    'unicode',
    'unicode/utf8',
    'unsafe',
  ],
  rust: [
    'std',
    'core',
    'alloc',
    'collections',
    'hash',
    'io',
    'fs',
    'path',
    'sync',
    'thread',
    'time',
    'net',
    'process',
    'env',
    'fmt',
    'str',
    'string',
    'vec',
    'option',
    'result',
    'boxed',
    'rc',
    'arc',
    'cell',
    'refcell',
    'mutex',
    'rwlock',
    'atomic',
    'borrow',
    'any',
    'cmp',
    'convert',
    'default',
    'iter',
    'marker',
    'mem',
    'ops',
    'pin',
    'future',
    'task',
    'pin',
    'alloc::vec',
    'alloc::boxed',
    'std::io',
    'std::fs',
    'std::path',
    'std::sync',
    'std::thread',
    'std::time',
    'std::net',
    'std::process',
    'std::env',
    'std::collections',
  ],
  java: [
    'java.lang',
    'java.io',
    'java.nio',
    'java.util',
    'java.math',
    'java.time',
    'java.text',
    'java.net',
    'java.security',
    'java.sql',
    'java.beans',
    'java.awt',
    'javax.swing',
    'javafx',
    'java.rmi',
    'java.util.concurrent',
    'java.util.function',
    'java.util.stream',
    'java.util.regex',
    'java.util.zip',
    'java.util.jar',
    'java.util.prefs',
    'java.util.logging',
    'java.util.spi',
    'java.lang.annotation',
    'java.lang.invoke',
    'java.lang.ref',
    'java.lang.reflect',
    'java.nio.charset',
    'java.nio.file',
    'java.nio.channels',
    'javax.xml',
    'javax.json',
    'javax.crypto',
    'javax.net',
    'javax.security',
    'javax.sql',
    'javax.transaction',
  ],
};

/**
 * 分类依赖
 * @param {Array} imports - 导入列表
 * @param {string} language - 语言名称
 * @returns {Object} 分类后的依赖
 */
function classifyDependencies(imports, language) {
  const builtinList = BUILTIN_MODULES[language] || [];
  const result = {
    builtin: [],
    internal: [],
    external: [],
  };

  for (const imp of imports) {
    const source = imp.source || imp;
    if (!source) continue;

    // 移除版本号等后缀
    const cleanSource = source.replace(/["']/g, '').split(/[@>=<~]/)[0];

    // 检查是否为内置模块
    const isBuiltin = builtinList.some(
      builtin => cleanSource === builtin || cleanSource.startsWith(builtin + '/')
    );

    if (isBuiltin) {
      result.builtin.push(cleanSource);
    } else if (cleanSource.startsWith('.') || cleanSource.includes('/')) {
      // 相对路径或本地路径视为 internal
      result.internal.push(cleanSource);
    } else {
      result.external.push(cleanSource);
    }
  }

  return result;
}

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
    const exports = [];

    extractSymbols(rootNode, sourceCode, language, {
      functions,
      classes,
      interfaces,
      imports,
      exports,
    });

    const complexityMetrics = calculateBasicComplexity(functions, classes, sourceCode, rootNode);
    const qualityScore = calculateFileQualityScore(complexityMetrics, functions, classes);
    const calls = extractCalls(rootNode, sourceCode, language, filePath);
    const classifiedDeps = classifyDependencies(imports, language);
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
      exports,
      calls,
      complexity_metrics: complexityMetrics,
      quality_score: qualityScore,
      dependencies: classifiedDeps,
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
  const { functions, classes, imports, exports } = collectors;

  if (node.type === 'function_definition') {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      const isAsync = node.children.some(child => child.type === 'async');

      let returnType = undefined;
      const returnTypeNode = node.childForFieldName('return_type');
      if (returnTypeNode) {
        returnType = returnTypeNode.text;
      }

      // Python 中所有顶层函数都是导出的（如果模块被导入）
      // 实际导出由 __all__ 控制，这里标记为潜在导出
      const isExported = true; // Python 模块级函数默认可导出

      functions.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        column: node.startPosition.column,
        type: 'function',
        return_type: returnType,
        is_exported: isExported,
        is_async: isAsync,
      });

      // 添加到 exports 数组
      if (isExported) {
        exports.push({
          name: nameNode.text,
          line: node.startPosition.row + 1,
          type: 'function',
        });
      }
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

      // Python 类默认可导出
      exports.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'class',
      });
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
  const { functions, classes, imports, exports, interfaces } = collectors;

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

      if (isExported) {
        exports.push({
          name: funcName,
          line: node.startPosition.row + 1,
          type: 'function',
        });
      }
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

      if (isExported) {
        exports.push({
          name: `${receiverType}.${methodName}`,
          line: node.startPosition.row + 1,
          type: 'method',
        });
      }
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

        // Go interface 首字母大写表示导出
        if (nameNode.text[0] === nameNode.text[0].toUpperCase()) {
          exports.push({
            name: nameNode.text,
            line: node.startPosition.row + 1,
            type: 'interface',
          });
        }
      } else {
        const className = nameNode.text;
        classes.push({
          name: className,
          line: node.startPosition.row + 1,
          methods: [],
          properties: [],
        });

        // Go struct 首字母大写表示导出
        if (className[0] === className[0].toUpperCase()) {
          exports.push({
            name: className,
            line: node.startPosition.row + 1,
            type: 'class',
          });
        }
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
  const { functions, classes, imports, exports } = collectors;

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

      // Rust 函数在顶层声明时视为导出
      if (isExported) {
        exports.push({
          name: nameNode.text,
          line: node.startPosition.row + 1,
          type: 'function',
        });
      }
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

      // Rust struct 默认导出
      exports.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'class',
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

      // Rust trait 默认导出
      exports.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'interface',
      });
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
  const { functions, classes, imports, exports } = collectors;

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

      if (isExported) {
        exports.push({
          name: nameNode.text,
          line: node.startPosition.row + 1,
          type: 'method',
        });
      }
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

      // Java 类默认导出
      exports.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'class',
      });
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

      // Java 接口默认导出
      exports.push({
        name: nameNode.text,
        line: node.startPosition.row + 1,
        type: 'interface',
      });
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
 * 计算文件质量评分
 * @param {Object} complexityMetrics - 复杂度指标
 * @param {Array} functions - 函数列表
 * @param {Array} classes - 类列表
 * @returns {Object} 质量评分
 */
function calculateFileQualityScore(complexityMetrics, functions, _classes) {
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

  // 生成改进建议
  const recommendations = [];
  for (const issue of issues) {
    switch (issue) {
      case '平均圈复杂度过高':
      case '平均圈复杂度偏高':
        recommendations.push('考虑将复杂函数拆分为更小的函数');
        break;
      case '存在极高复杂度函数':
      case '存在高复杂度函数':
        recommendations.push('重构高复杂度函数，提取辅助函数');
        break;
      case '嵌套深度过大':
      case '嵌套深度偏高':
        recommendations.push('减少嵌套层级，使用提前返回或卫语句');
        break;
      case '文件过大':
      case '文件偏大':
        recommendations.push('将大文件拆分为多个模块');
        break;
      case '函数数量过多':
        recommendations.push('考虑将相关函数组织到类或模块中');
        break;
    }
  }

  return {
    score,
    grade,
    issues,
    recommendations,
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

// ===== Tree-sitter Query API Implementation (BL-CA-39) =====

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Query 缓存
const queryCache = new Map();

/**
 * 加载语言的 Query 文件
 * @param {string} language - 语言名称
 * @returns {Parser.Query|null} Query 对象或 null
 */
function loadQuery(language) {
  if (queryCache.has(language)) {
    return queryCache.get(language);
  }

  try {
    const queryPath = join(__dirname, 'queries', `${language}.scm`);
    const querySource = readFileSync(queryPath, 'utf-8');
    queryCache.set(language, querySource);
    return querySource;
  } catch {
    return null;
  }
}

/**
 * 使用 Tree-sitter Query API 分析代码
 * @param {string} filePath - 文件路径
 * @param {string} sourceCode - 源代码
 * @param {string} language - 语言名称
 * @returns {Object} 分析结果
 */
export async function analyzeWithQuery(filePath, sourceCode, language) {
  const startTime = performance.now();

  try {
    const lang = await loadLanguage(language);
    const parser = new Parser();
    parser.setLanguage(lang);

    const tree = parser.parse(sourceCode);
    const rootNode = tree.rootNode;

    // 加载 Query
    const querySource = loadQuery(language);
    if (!querySource) {
      // Fallback 到树遍历
      return await analyzeWithTreeSitter(filePath, sourceCode, language);
    }

    const query = lang.query(querySource);
    const matches = query.matches(rootNode);

    const functions = [];
    const classes = [];
    const interfaces = [];
    const imports = [];
    const exports = [];
    const calls = [];

    // 处理 Query 结果
    for (const match of matches) {
      for (const capture of match.captures) {
        const node = capture.node;
        const captureName = capture.name;

        switch (captureName) {
          case 'function.name':
          case 'method.name': {
            const funcDef = match.captures.find(
              c => c.name === 'function.def' || c.name === 'method.def'
            );
            if (funcDef) {
              const funcNode = funcDef.node;
              const isAsync = match.captures.some(c => c.name === 'function.async');

              functions.push({
                name: node.text,
                line: funcNode.startPosition.row + 1,
                column: funcNode.startPosition.column,
                type: captureName === 'method.name' ? 'method' : 'function',
                is_async: isAsync,
                is_exported: true,
              });
            }
            break;
          }

          case 'class.name': {
            const classDef = match.captures.find(c => c.name === 'class.def');
            if (classDef) {
              classes.push({
                name: node.text,
                line: classDef.node.startPosition.row + 1,
                methods: [],
                properties: [],
              });
            }
            break;
          }

          case 'interface.name': {
            const interfaceDef = match.captures.find(c => c.name === 'interface.def');
            if (interfaceDef) {
              interfaces.push({
                name: node.text,
                line: interfaceDef.node.startPosition.row + 1,
                methods: [],
              });
            }
            break;
          }

          case 'import.source':
          case 'import.module': {
            const importStmt = match.captures.find(
              c => c.name === 'import.stmt' || c.name === 'import.from' || c.name === 'import.spec'
            );
            if (importStmt) {
              imports.push({
                source: node.text.replace(/["']/g, ''),
                line: importStmt.node.startPosition.row + 1,
              });
            }
            break;
          }

          case 'export.name': {
            exports.push({
              name: node.text,
              line: node.startPosition.row + 1,
              type: 'function',
            });
            break;
          }

          case 'call.name':
          case 'call.method': {
            const callExpr = match.captures.find(
              c => c.name === 'call.direct' || c.name === 'call.method'
            );
            if (callExpr) {
              calls.push({
                target: node.text,
                file_path: filePath,
                line: callExpr.node.startPosition.row + 1,
                column: callExpr.node.startPosition.column,
              });
            }
            break;
          }
        }
      }
    }

    const complexityMetrics = calculateBasicComplexity(functions, classes, sourceCode, rootNode);
    const qualityScore = calculateFileQualityScore(complexityMetrics, functions, classes);
    const classifiedDeps = classifyDependencies(imports, language);
    const duration = performance.now() - startTime;

    return {
      language,
      analyzer: 'tree-sitter-query',
      analyzed_at: new Date().toISOString(),
      analyzer_version: '0.26.7',
      functions,
      classes,
      interfaces,
      imports,
      exports,
      calls,
      complexity_metrics: complexityMetrics,
      quality_score: qualityScore,
      dependencies: classifiedDeps,
      analysis_duration_ms: duration,
    };

    // 释放 Parser 资源
    parser.delete();

    return result;
  } catch (_error) {
    // 释放 Parser 资源（如果已创建）
    if (typeof parser !== 'undefined' && parser) {
      parser.delete();
    }
    // Fallback 到树遍历
    return await analyzeWithTreeSitter(filePath, sourceCode, language);
  }
}
