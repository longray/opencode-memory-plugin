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
  --upload [dir]            Upload all project files to backend (atoms + entities + references)
  --language <lang> <file>  Analyze file with specified language

Options:
  --output, -o <file>       Save output to file
  --format, -f <format>     Output format: json, table, tree (default: json)
  --pretty, -p              Pretty print JSON output
  --save, -s                Save analysis result to memory system
  --help, -h                Show this help message

Examples:
  opencode-memory code-analyze src/index.ts
  opencode-memory code-analyze src/index.ts --format table
  opencode-memory code-analyze src/index.ts --format tree --save
  opencode-memory code-analyze --project
  opencode-memory code-analyze --upload
  opencode-memory code-analyze --upload ./my-project
  opencode-memory code-analyze --language python script.py

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

async function collectProjectFiles(projectPath = '.') {
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
  const files = await collectProjectFiles(projectPath);

  if (files.length === 0) {
    return {
      success: false,
      error: 'No supported files found in project',
      total: 0,
      analyzed: 0,
      failed: 0,
    };
  }

  // Use ProjectAnalyzer for comprehensive project analysis
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
  // Handle project report
  if (result.type === 'project-report') {
    const { formatProjectReportAsTable } = await import('../lib/project-analyzer.js');
    if (options.format === 'json') {
      return JSON.stringify(result.report, null, options.pretty ? 2 : 0);
    }
    return formatProjectReportAsTable(result.report);
  }

  // Handle single file analysis
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
    console.error('[CodeAnalysis] Cannot save failed analysis to memory');
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
      console.log(`[CodeAnalysis] Result saved to memory: ${memoryResult.entry_id}`);
      return memoryResult.entry_id;
    } else {
      console.error('[CodeAnalysis] Failed to save to memory:', memoryResult.message);
      return null;
    }
  } catch (error) {
    console.error('[CodeAnalysis] Error saving to memory:', error.message);
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
    console.log('Uploading project to backend (two-pass: atoms/entities + references)...');
    const { uploadProject } = await import('../lib/code-analysis-service.js');
    const projectRoot = options.file || '.';
    const result = await uploadProject(projectRoot, options);
    console.log(
      '\nUpload complete:\n' +
        '  Files:      ' +
        result.files +
        '\n' +
        '  Atoms:      ' +
        result.atoms +
        '\n' +
        '  References: ' +
        result.references +
        '\n' +
        '  Duration:   ' +
        result.duration.toFixed(2) +
        'ms'
    );
    process.exit(0);
  }

  if (options.project) {
    console.log('Analyzing project...');
    result = await analyzeProject();
  } else {
    result = await analyzeFile(options.file, options.language);
  }

  const output = await formatOutput(result, options);

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`\nResults saved to: ${options.output}`);
  } else {
    console.log('\n' + output);
  }

  // Save to memory if requested
  if (options.save) {
    await saveToMemory(result);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
