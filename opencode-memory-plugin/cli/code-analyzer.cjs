#!/usr/bin/env node

/**
 * OpenCode Memory Plugin - Code Analyzer CLI Tool
 *
 * Analyze code files and extract functions, classes, and complexity metrics.
 * Usage: node cli/code-analyzer.cjs [options]
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Read version from package.json
const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
).version;

// Simple logger - avoid pino in CLI to keep output clean
function logInfo(_component, message) {
  if (typeof message === 'string') {
    console.log(message);
  } else if (message instanceof Error) {
    console.log(message.message);
  }
}

function logError(component, message, error) {
  const prefix = `[${component}]`;
  if (error instanceof Error) {
    console.error(`${prefix} ${message}: ${error.message}`);
  } else {
    console.error(`${prefix} ${message}`);
  }
}

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'go', 'rust', 'java'];

function showHelp() {
  console.log(`
┌─────────────────────────────────────────────────────────────┐
│                    Code Analyzer CLI                        │
│              Analyze code for functions, classes            │
└─────────────────────────────────────────────────────────────┘

Version: ${VERSION}

Options:
  <file>               Analyze single file
  --project            Analyze entire project
  --language <lang>    Specify language (javascript, typescript, python, go, rust, java)
  --output <path>      Output file (default: stdout)
  --format <format>    Output format (json, table, tree) (default: json)
  --upload             Upload project to backend
  --save               Save results to memory
  --pretty             Pretty-print JSON output
  --help               Show this help

Examples:
  node cli/code-analyzer.cjs src/utils.js
  node cli/code-analyzer.cjs --project --language javascript
  node cli/code-analyzer.cjs --project --format json --output analysis.json

`);
}

function parseArgs(args) {
  const options = {
    file: null,
    project: false,
    language: null,
    output: null,
    pretty: false,
    format: 'json',
    save: false,
    upload: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    } else if (arg === '--project') {
      options.project = true;
    } else if (arg === '--language' || arg === '-l') {
      options.language = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--pretty' || arg === '-p') {
      options.pretty = true;
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--save' || arg === '-s') {
      options.save = true;
    } else if (arg === '--upload' || arg === '-u') {
      options.upload = true;
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    }
  }

  return options;
}

function validateOptions(options) {
  if (!options.file && !options.project && !options.upload) {
    logError('code-analyzer-cli', 'Please specify a file, use --project, or use --upload');
    showHelp();
    process.exit(1);
  }

  if (options.language && !SUPPORTED_LANGUAGES.includes(options.language)) {
    logError('code-analyzer-cli', `Unsupported language: ${options.language}`);
    logError('code-analyzer-cli', `Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  if (options.file && !fs.existsSync(options.file)) {
    logError('code-analyzer-cli', `File not found: ${options.file}`);
    process.exit(1);
  }
}

async function analyzeFile(filePath, language = null) {
  try {
    const { codeAnalyzer } = await import('../lib/code-analyzer.js');
    const result = await codeAnalyzer.analyze(filePath);

    if (language && result.language !== language) {
      result.language = language;
    }

    return {
      success: true,
      file: filePath,
      result,
    };
  } catch (error) {
    return {
      success: false,
      file: filePath,
      error: error.message,
    };
  }
}

function collectProjectFiles(projectPath) {
  const results = [];

  const supportedExtensions = [
    '.js',
    '.mjs',
    '.cjs',
    '.ts',
    '.mts',
    '.cts',
    '.tsx',
    '.py',
    '.go',
    '.rs',
    '.java',
  ];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build') {
          continue;
        }
        scanDirectory(fullPath);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (supportedExtensions.includes(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  scanDirectory(projectPath);
  return results;
}

async function analyzeProject(projectPath = '.') {
  const files = collectProjectFiles(projectPath);

  if (files.length === 0) {
    return {
      success: false,
      error: 'No supported files found in project',
      total: 0,
      analyzed: 0,
      failed: 0,
    };
  }

  const { ProjectAnalyzer } = await import('../lib/project-analyzer.js');
  const analyzer = new ProjectAnalyzer(projectPath);
  const report = await analyzer.analyzeProject(files);

  return {
    success: report.success,
    type: 'project-report',
    report,
  };
}

async function formatOutput(result, options) {
  if (result.type === 'project-report') {
    const { formatProjectReportAsTable } = await import('../lib/project-analyzer.js');
    if (options.format === 'json') {
      return JSON.stringify(result.report, null, options.pretty ? 2 : 0);
    }
    return formatProjectReportAsTable(result.report);
  }

  const { formatAsTable, formatAsTree, formatAsJson } =
    await import('../lib/code-analysis-formatter.js');

  switch (options.format) {
    case 'table':
      return formatAsTable(result);
    case 'tree':
      return formatAsTree(result);
    case 'json':
    default:
      return formatAsJson(result, options.pretty);
  }
}

async function saveToMemory(result) {
  if (!result.success) {
    logError('code-analyzer-cli', 'Cannot save failed analysis to memory');
    return null;
  }

  try {
    const { writeMemory } = await import('../lib/memory-core.js');
    const { resolveProjectId } = await import('../lib/project-resolver.js');

    const projectRoot = process.cwd();
    const projectId = resolveProjectId({ projectRoot });
    const analysis = result.result;

    const memoryResult = await writeMemory({
      abstract: `${analysis.language} file: ${result.file} (${analysis.functions?.length || 0} funcs, ${analysis.classes?.length || 0} classes)`,
      overview: `File: ${result.file}\nLanguage: ${analysis.language}\nFunctions: ${
        analysis.functions
          ?.map(f => f.name)
          .slice(0, 5)
          .join(', ') || 'none'
      }\nClasses: ${
        analysis.classes
          ?.map(c => c.name)
          .slice(0, 3)
          .join(', ') || 'none'
      }\nComplexity: ${analysis.complexity_metrics?.cyclomatic || 0}`,
      content: JSON.stringify(analysis, null, 2),
      type: 'code-analysis',
      tags: ['code-analysis', analysis.language, projectId],
    });

    if (memoryResult.success) {
      logInfo(
        'code-analyzer-cli',
        `[CodeAnalysis] Result saved to memory: ${memoryResult.entry_id}`
      );
      return memoryResult.entry_id;
    } else {
      logError(
        'code-analyzer-cli',
        '[CodeAnalysis] Failed to save to memory',
        new Error(memoryResult.message)
      );
      return null;
    }
  } catch (error) {
    logError('code-analyzer-cli', '[CodeAnalysis] Error saving to memory', error);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const options = parseArgs(args);
  validateOptions(options);

  let result;

  if (options.upload) {
    logInfo(
      'code-analyzer-cli',
      'Uploading project to backend (two-pass: atoms/entities + references)...'
    );
    const { uploadProject } = await import('../lib/code-analysis-service.js');
    const projectRoot = options.file || '.';
    const uploadResult = await uploadProject(projectRoot, options);
    console.log(
      '\nUpload complete:\n' +
        '  Files:      ' +
        uploadResult.files +
        '\n  Atoms:      ' +
        uploadResult.atoms +
        '\n  References: ' +
        uploadResult.references +
        '\n  Duration:   ' +
        uploadResult.duration +
        '\n'
    );
    process.exit(0);
  }

  if (options.project) {
    logInfo('code-analyzer-cli', 'Analyzing project...');
    result = await analyzeProject();
  } else {
    result = await analyzeFile(options.file, options.language);
  }

  const output = await formatOutput(result, options);

  if (options.output) {
    fs.writeFileSync(options.output, output);
    logInfo('code-analyzer-cli', '\nResults saved to: ' + options.output);
  } else {
    logInfo('code-analyzer-cli', '\n' + output);
  }

  if (options.save) {
    await saveToMemory(result);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  logError('code-analyzer-cli', 'Error', error);
  process.exit(1);
});
