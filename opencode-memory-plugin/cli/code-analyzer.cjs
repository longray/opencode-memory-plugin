#!/usr/bin/env node

/**
 * Code Analyzer CLI Tool
 * 代码分析命令行工具
 *
 * Usage: opencode-memory code-analyze [options] <file>
 */

const fs = require('fs');
const path = require('path');

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'go', 'rust', 'java'];

function showHelp() {
  console.log(`
Code Analyzer CLI Tool

Usage: opencode-memory code-analyze [options] <file>

Commands:
  <file>                    Analyze a single file
  --project                 Analyze all files in current project
  --language <lang> <file>  Analyze file with specified language

Options:
  --output, -o <file>       Save output to file (JSON format)
  --pretty, -p              Pretty print JSON output
  --help, -h                Show this help message

Examples:
  opencode-memory code-analyze src/index.ts
  opencode-memory code-analyze --project
  opencode-memory code-analyze --language python script.py
  opencode-memory code-analyze src/index.ts --output result.json

Supported Languages:
  ${SUPPORTED_LANGUAGES.join(', ')}
`);
}

function parseArgs(args) {
  const options = {
    file: null,
    project: false,
    language: null,
    output: null,
    pretty: false,
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
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    }
  }

  return options;
}

function validateOptions(options) {
  if (!options.file && !options.project) {
    console.error('Error: Please specify a file or use --project');
    showHelp();
    process.exit(1);
  }

  if (options.language && !SUPPORTED_LANGUAGES.includes(options.language)) {
    console.error(`Error: Unsupported language: ${options.language}`);
    console.error(`Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  if (options.file && !fs.existsSync(options.file)) {
    console.error(`Error: File not found: ${options.file}`);
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

async function analyzeProject(projectPath = '.') {
  const results = [];
  const errors = [];

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

  console.log(`Found ${results.length} files to analyze...`);

  const analysisResults = [];
  for (let i = 0; i < results.length; i++) {
    const file = results[i];
    console.log(`[${i + 1}/${results.length}] Analyzing: ${file}`);

    const result = await analyzeFile(file);
    analysisResults.push(result);

    if (!result.success) {
      errors.push(result);
    }
  }

  return {
    success: errors.length === 0,
    total: results.length,
    analyzed: analysisResults.filter(r => r.success).length,
    failed: errors.length,
    results: analysisResults,
  };
}

function formatOutput(result, pretty = false) {
  if (pretty) {
    return JSON.stringify(result, null, 2);
  }
  return JSON.stringify(result);
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

  if (options.project) {
    console.log('Analyzing project...');
    result = await analyzeProject();
  } else {
    result = await analyzeFile(options.file, options.language);
  }

  const output = formatOutput(result, options.pretty);

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`\nResults saved to: ${options.output}`);
  } else {
    console.log('\n' + output);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
