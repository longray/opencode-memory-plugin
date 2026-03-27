#!/usr/bin/env node

/**
 * OpenCode Memory Plugin - CLI Tool (v2.4.0)
 *
 * Uses shared code from lib/ directory
 * Usage: opencode-memory <command> [options]
 */

const commands = {
  write: writeCommand,
  read: readCommand,
  search: searchCommand,
  list: listCommand,
  init: initCommand,
  status: statusCommand,
  help: showHelp,
};

function log(msg, color = '') {
  const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[color] || ''}${msg}${colors.reset || ''}`);
}

function showHelp() {
  console.log(`
OpenCode Memory Plugin - CLI Tool v2.4.0

Usage: opencode-memory <command> [options]

Commands:
  write <content> [options]    Write entry to memory
    Options:
      --type <type>            Entry type (default: general)
      --tags <tags>            Comma-separated tags
      --abstract <text>        Abstract (required, auto-generated if omitted)
      --overview <text>        Overview (required, auto-generated if omitted)

  read [options]               Read entry from memory
    Options:
      --id <entry_id>          Entry ID (required)
      --level <0|1|2>          0=abstract, 1=overview, 2=full (default: 2)

  search <query> [options]     Search memory
      --mode <mode>            Search mode: keyword, vector, hybrid (default: keyword)

  list [options]               List timeline entries
      --days <n>               Last N days (default: 7)

  init                         Initialize today's timeline directory

  status                       Show system status

  help                         Show this help message

Examples:
  opencode-memory write "User prefers TypeScript" --type "preference" --tags "typescript"
  opencode-memory read --id 01KMK5N77WBW6J78Y1WAQ5BNMQ --level 0
  opencode-memory search "typescript"
  opencode-memory status
`);
}

async function writeCommand(args) {
  const content = args._[1] || args.content;
  if (!content) {
    log('Error: Content is required', 'red');
    log('Usage: opencode-memory write <content> [--type <type>] [--tags <tags>]', 'yellow');
    process.exit(1);
  }

  const type = args.type || 'general';
  const tagsStr = typeof args.tags === 'string' ? args.tags : '';
  const tags = tagsStr
    ? tagsStr
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : [];

  let abstract = typeof args.abstract === 'string' ? args.abstract : '';
  let overview = typeof args.overview === 'string' ? args.overview : '';

  if (!abstract) {
    abstract = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    log('ℹ️ Abstract auto-generated (建议 ≤100 字符)', 'yellow');
  }
  if (!overview) {
    overview = content.substring(0, 120) + (content.length > 120 ? '...' : '');
    log('ℹ️ Overview auto-generated (建议 ≤500 字符)', 'yellow');
  }

  try {
    const { writeAndSyncMemory } = await import('../lib/memory-core.js');
    const { getConfig } = await import('../lib/storage.js');
    const { getWrapperClient } = await import('../lib/wrapper-client.js');
    const { resolveProjectId } = await import('../lib/project-resolver.js');

    const config = getConfig();
    const client = getWrapperClient(config);
    const projectId = await resolveProjectId(config);
    const tenantId = config?.backend?.tenant_id || 'longray';

    const result = await writeAndSyncMemory({
      abstract,
      overview,
      content,
      type,
      tags,
      pinned: false,
      source_id: null, // CLI 不使用 source_id
      project_id: projectId,
      source: 'cli',
      tenant_id: tenantId,
      client,
    });

    if (!result.success) {
      if (result.memoryId) {
        // 重复错误
        log(result.message.split('\n')[0], 'yellow'); // 第一行是错误类型
        log(result.message.split('\n')[1], 'yellow'); // 后端 ID
        return;
      }
      log(`❌ Failed to write: ${result.message}`, 'red');
      process.exit(1);
    }

    log('✅ Entry written successfully', 'green');
    log(`  ID: ${result.localId}`, 'blue');
    log(`  Abstract: ${abstract.substring(0, 50)}...`, 'blue');
    log(`  File: ${result.filePath}`, 'blue');
    if (result.memoryId) {
      log(`  Backend: ✅ Synced (${result.memoryId})`, 'green');
      log(`  Memory ID: ${result.memoryId}`, 'blue');
    }
  } catch (e) {
    log(`❌ Failed to write: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

async function readCommand(args) {
  const entryId = args.id;
  if (!entryId) {
    log('Error: Entry ID is required', 'red');
    log('Usage: opencode-memory read --id <entry_id> [--level 0|1|2]', 'yellow');
    process.exit(1);
  }

  const level = args.level !== undefined ? parseInt(args.level) : 2;

  try {
    const { getEntryById } = await import('../lib/storage.js');
    const { extractByLevel } = await import('../lib/extractor.js');

    const entry = getEntryById(entryId);
    if (!entry) {
      log(`❌ Entry not found: ${entryId}`, 'red');
      process.exit(1);
    }

    const content = extractByLevel(entry.content, level);
    console.log(content);
  } catch (e) {
    log(`❌ Failed to read: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

async function searchCommand(args) {
  const query = args._[1] || args.query;
  if (!query) {
    log('Error: Query is required', 'red');
    log('Usage: opencode-memory search <query> [--mode <mode>]', 'yellow');
    process.exit(1);
  }

  const mode = args.mode || 'hybrid';

  try {
    const { getConfig } = await import('../lib/storage.js');
    const { getWrapperClient } = await import('../lib/wrapper-client.js');

    const config = getConfig();
    const backendEnabled = config?.backend?.enabled !== false;
    const tenantId = config?.backend?.tenant_id || 'default';

    if (!backendEnabled) {
      log('❌ Backend disabled', 'yellow');
      return;
    }

    const client = getWrapperClient(config);
    const result = await client.search({
      query,
      mode,
      limit: 10,
      tenant_id: tenantId,
    });

    if (!result.results || result.results.length === 0) {
      log(`❌ No results for: ${query}`, 'yellow');
      return;
    }

    log(`Found ${result.results.length} matches:`, 'green');
    console.log('');
    result.results.forEach((e, i) => {
      const type = e.type || 'general';
      const abstract = e.abstract || e.content_abstract || 'N/A';
      const id = e.id || e.local_id || 'N/A';

      console.log(`${i + 1}. [${type}] ${abstract.substring(0, 60)}`);
      console.log(`   ID: ${id}`);
      console.log(`   Score: ${e.score || 'N/A'}`);
      console.log('');
    });
  } catch (e) {
    log(`❌ Search failed: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

async function listCommand(args) {
  const days = parseInt(args.days) || 7;

  try {
    const { getLinkMap } = await import('../lib/storage.js');
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});

    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const byDate = {};
    for (const entry of entries) {
      const match = entry.path.match(/timeline\/(\d{4})\/(\d{2})\/(\d{2})/);
      if (match) {
        const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
        const entryDate = new Date(dateStr);
        if (entryDate >= cutoff) {
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr].push(entry);
        }
      }
    }

    const sortedDates = Object.keys(byDate).sort().reverse();

    if (sortedDates.length === 0) {
      log(`❌ No entries in the last ${days} days`, 'yellow');
      return;
    }

    log(`Timeline (last ${days} days):`, 'green');
    console.log('');
    for (const date of sortedDates) {
      console.log(`## ${date} (${byDate[date].length} entries)`);
      for (const entry of byDate[date].slice(0, 5)) {
        console.log(
          `  - [${entry.type}] ${entry.abstract?.substring(0, 50) || ''} \`${entry.id}\``
        );
      }
      console.log('');
    }
  } catch (e) {
    log(`❌ List failed: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

async function initCommand() {
  try {
    const fs = require('fs');
    const path = require('path');
    const { TIMELINE_DIR } = await import('../lib/constants.js');

    const now = new Date();
    const dayDir = path.join(
      TIMELINE_DIR,
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    );

    if (!fs.existsSync(dayDir)) {
      fs.mkdirSync(dayDir, { recursive: true });
      log(`✅ Created: ${dayDir}`, 'green');
    } else {
      log(`ℹ️ Already exists: ${dayDir}`, 'yellow');
    }
  } catch (e) {
    log(`❌ Failed to init: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

async function statusCommand() {
  try {
    const fs = require('fs');
    const { getLinkMap } = await import('../lib/storage.js');
    const { MEMORY_DIR, LINK_MAP_FILE } = await import('../lib/constants.js');

    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    const syncedCount = entries.filter(e => e.synced).length;

    log('Memory System Status:', 'blue');
    console.log('');
    log('Local:', 'green');
    log(`  Total entries: ${entries.length}`, 'blue');
    log(`  Synced: ${syncedCount}`, 'blue');
    log(`  Pending: ${entries.length - syncedCount}`, 'blue');
    console.log('');

    log('Storage:', 'green');
    log(`  Memory dir: ${MEMORY_DIR}`, 'blue');
    log(`  Link map: ${fs.existsSync(LINK_MAP_FILE) ? '✅' : '❌'}`, 'blue');
    console.log('');
  } catch (e) {
    log(`❌ Status failed: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

function parseArgs() {
  const args = { _: [] };
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = argv[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        args[key] = nextArg;
        i++;
      } else if (key.includes('=')) {
        const [k, v] = key.split('=');
        args[k] = v || true;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  return args;
}

async function main() {
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
    await handler(args);
  } catch (e) {
    log(`Error: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

main();
