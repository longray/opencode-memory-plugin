#!/usr/bin/env node

/**
 * OpenCode Memory Plugin - CLI Tool
 *
 * Provides command-line access to memory functions
 * Usage: opencode-memory <command> [options]
 */

const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'MEMORY.md');
const CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');

const commands = {
  'write': memoryWrite,
  'read': memoryRead,
  'search': memorySearch,
  'list': listDaily,
  'init': initDaily,
  'status': indexStatus,
  'help': showHelp
};

function log(msg, color = '') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color] || ''}${msg}${colors.reset || ''}`);
}

function showHelp() {
  console.log(`
OpenCode Memory Plugin - CLI Tool

Usage: opencode-memory <command> [options]

Commands:
  write <content> [options]    Write entry to memory
    Options:
      --type <type>            Entry type (default: general)
      --tags <tags>            Comma-separated tags

  read [file]                  Read from memory file
    Options:
      --file <file>            File to read (default: MEMORY.md)

  search <query> [options]     Search memory
    Options:
      --mode <mode>            Search mode: basic, regex (default: basic)

  list [options]               List daily logs
    Options:
      --days <n>               Last N days (default: 7)

  init                         Initialize today's daily log

  status                       Show index and configuration status

  help                         Show this help message

Examples:
  opencode-memory write "User prefers TypeScript" --type "preference" --tags "typescript,code-style"
  opencode-memory read
  opencode-memory search "typescript"
  opencode-memory list --days 3
  opencode-memory init
  opencode-memory status
`);
}

function memoryWrite(args) {
  const content = args._[1] || args.content;
  if (!content) {
    log('Error: Content is required', 'red');
    log('Usage: opencode-memory write <content> [--type <type>] [--tags <tags>]', 'yellow');
    process.exit(1);
  }

  const type = typeof (args.type || 'general') === 'string' ? (args.type || 'general') : 'general';
  const tags = args.tags ? (typeof args.tags === 'string' ? args.tags.split(',') : args.tags) : [];
  const timestamp = new Date().toISOString();

  const entry = `
## ${type.charAt(0).toUpperCase() + type.slice(1)} Entry

**Date**: ${timestamp}
**Tags**: ${Array.isArray(tags) ? tags.join(', ') : tags || 'none'}

${content}

---
`;

  try {
    fs.appendFileSync(MEMORY_FILE, entry);
    log('✓ Entry written to MEMORY.md', 'green');
    log(`  Type: ${typeof type === 'string' ? type : 'general'}`, 'blue');
    log(`  Tags: ${Array.isArray(tags) ? tags.join(', ') : tags || 'none'}`, 'blue');
  } catch (e) {
    log(`✗ Failed to write: ${e.message}`, 'red');
    process.exit(1);
  }
}

function memoryRead(args) {
  const file = args.file || 'MEMORY.md';
  const filePath = path.join(MEMORY_DIR, file);

  if (!fs.existsSync(filePath)) {
    log(`✗ File not found: ${file}`, 'red');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(content);
  } catch (e) {
    log(`✗ Failed to read: ${e.message}`, 'red');
    process.exit(1);
  }
}

function memorySearch(args) {
  const query = args._[1] || args.query;
  if (!query) {
    log('Error: Query is required', 'red');
    log('Usage: opencode-memory search <query> [--mode <mode>]', 'yellow');
    process.exit(1);
  }

  const mode = args.mode || 'basic';

  try {
    const content = fs.readFileSync(MEMORY_FILE, 'utf8');
    let matches = [];

    if (mode === 'regex') {
      try {
        const regex = new RegExp(query, 'gi');
        let match;
        while ((match = regex.exec(content)) !== null) {
          matches.push({
            text: match[0],
            index: match.index
          });
        }
      } catch (e) {
        log(`✗ Invalid regex: ${query}`, 'red');
        process.exit(1);
      }
    } else {
      // Basic keyword search
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          matches.push({
            text: line.trim(),
            index: index
          });
        }
      });
    }

    if (matches.length > 0) {
      log(`Found ${matches.length} matches for "${query}":`, 'green');
      console.log('');
      matches.slice(0, 10).forEach((match, i) => {
        log(`${i + 1}. ${match.text.substring(0, 100)}`, 'blue');
      });
      if (matches.length > 10) {
        log(`... and ${matches.length - 10} more`, 'yellow');
      }
    } else {
      log(`No matches found for "${query}"`, 'yellow');
    }
  } catch (e) {
    log(`✗ Search failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

function listDaily(args) {
  const days = parseInt(args.days || 7);
  const dailyDir = path.join(MEMORY_DIR, 'daily');

  if (!fs.existsSync(dailyDir)) {
    log('✗ Daily directory not found', 'red');
    process.exit(1);
  }

  try {
    const files = fs.readdirSync(dailyDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse()
      .slice(0, days);

    if (files.length === 0) {
      log('No daily logs found', 'yellow');
      return;
    }

    log(`Found ${files.length} daily log(s):`, 'green');
    console.log('');

    files.forEach(file => {
      const filePath = path.join(dailyDir, file);
      const stats = fs.statSync(filePath);
      const size = Math.round(stats.size / 1024);
      log(`  📄 ${file} (${size} KB)`, 'blue');
    });
  } catch (e) {
    log(`✗ Failed to list: ${e.message}`, 'red');
    process.exit(1);
  }
}

function initDaily(args) {
  const today = new Date().toISOString().split('T')[0];
  const dailyDir = path.join(MEMORY_DIR, 'daily');
  const dailyFile = path.join(dailyDir, `${today}.md`);

  if (fs.existsSync(dailyFile)) {
    log(`Daily log already exists: ${today}.md`, 'yellow');
    return;
  }

  const content = `# Daily Memory Log - ${today}

*Session starts: ${new Date().toISOString()}*

## Notes

## Tasks

## Learnings

---
`;

  try {
    fs.writeFileSync(dailyFile, content);
    log(`✓ Created daily log: ${today}.md`, 'green');
  } catch (e) {
    log(`✗ Failed to create: ${e.message}`, 'red');
    process.exit(1);
  }
}

function indexStatus(args) {
  log('Memory System Status:', 'blue');
  console.log('');

  // Check configuration
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      log('✓ Configuration loaded', 'green');
      log(`  Version: ${config.version}`, 'blue');
      log(`  Search mode: ${config.search?.mode}`, 'blue');
      log(`  Embedding: ${config.embedding?.enabled ? 'enabled' : 'disabled'}`, 'blue');
      if (config.embedding?.enabled) {
        log(`  Model: ${config.embedding?.model}`, 'blue');
      }
    } catch (e) {
      log('✗ Configuration error', 'red');
    }
  } else {
    log('✗ Configuration not found', 'red');
  }

  console.log('');

  // Check memory files
  const files = ['SOUL.md', 'MEMORY.md', 'AGENTS.md'];
  files.forEach(file => {
    const filePath = path.join(MEMORY_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const size = Math.round(stats.size / 1024);
      log(`✓ ${file} (${size} KB)`, 'green');
    } else {
      log(`✗ ${file} missing`, 'red');
    }
  });

  console.log('');

  // Check daily logs
  const dailyDir = path.join(MEMORY_DIR, 'daily');
  if (fs.existsSync(dailyDir)) {
    const files = fs.readdirSync(dailyDir).filter(f => f.endsWith('.md'));
    log(`✓ Daily logs: ${files.length} files`, 'green');
  } else {
    log('✗ Daily directory missing', 'red');
  }
}

// Parse command line arguments
function parseArgs() {
  const args = {
    _: []
  };

  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    } else {
      args._.push(arg);
    }
  });

  return args;
}

// Main
function main() {
  const args = parseArgs();
  const command = args._[0];

  if (!command || command === 'help') {
    showHelp();
    process.exit(0);
  }

  const handler = commands[command];
  if (!handler) {
    log(`Unknown command: ${command}`, 'red');
    log('Run "opencode-memory help" for usage', 'yellow');
    process.exit(1);
  }

  try {
    handler(args);
  } catch (e) {
    log(`Error: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

main();
