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
  checkpoint: checkpointCommand,
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
      --meta <json>            JSON array of key-value pairs: '[{"k":"v"}]'
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
      --detailed              Show pending entries

  checkpoint [options]         View sync checkpoints
      --action <action>       Action: list (default: list)
      --limit <n>             Max entries (default: 20)

  help                         Show this help message

Examples:
  opencode-memory write "User prefers TypeScript" --abstract "TS preference" --overview "User likes TypeScript"
  opencode-memory read --id 01KMK5N77WBW6J78Y1WAQ5BNMQ --level 0
  opencode-memory search "typescript"
  opencode-memory status --detailed
  opencode-memory checkpoint
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

  const abstract = typeof args.abstract === 'string' ? args.abstract.trim() : '';
  const overview = typeof args.overview === 'string' ? args.overview.trim() : '';
  let meta = [];

  if (typeof args.meta === 'string') {
    try {
      meta = JSON.parse(args.meta);
      if (!Array.isArray(meta)) {
        log('Warning: meta should be an array, using empty array', 'yellow');
        meta = [];
      }
    } catch {
      log('Warning: invalid meta JSON, using empty array', 'yellow');
      meta = [];
    }
  }

  if (!abstract) {
    log('Error: abstract is REQUIRED (建议 ≤100 字符)', 'red');
    log('Usage: opencode-memory write <content> --abstract <text> --overview <text>', 'yellow');
    process.exit(1);
  }
  if (!overview) {
    log('Error: overview is REQUIRED (建议 ≤500 字符)', 'red');
    log('Usage: opencode-memory write <content> --abstract <text> --overview <text>', 'yellow');
    process.exit(1);
  }
  if (abstract.length > 100) {
    log('Warning: abstract > 100 characters', 'yellow');
  }
  if (overview.length > 500) {
    log('Warning: overview > 500 characters', 'yellow');
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
      meta,
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
    console.error('Error: Entry ID is required');
    console.error('Usage: opencode-memory read --id <entry_id> [--level 0|1|2]');
    process.exit(1);
  }

  const level = args.level !== undefined ? parseInt(args.level) : 2;

  try {
    const { readMemory } = await import('../lib/memory-core.js');

    const result = await readMemory({ entry_id: entryId, level });

    if (!result.success) {
      console.error(result.message);
      process.exit(1);
    }

    console.log(result.content);
  } catch (e) {
    console.error(`❌ Failed to read: ${e.message}`);
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
      const display = e.abstract || e.overview || e.content || 'N/A';
      const id = e.id || e.local_id || 'N/A';

      console.log(`${i + 1}. [${type}] ${display.substring(0, 60)}`);
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

async function statusCommand(args) {
  try {
    const { getLinkMap, getConfig } = await import('../lib/storage.js');
    const { getWrapperClient } = await import('../lib/wrapper-client.js');
    const { MEMORY_DIR } = await import('../lib/constants.js');

    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});
    const syncedCount = entries.filter(e => e.synced).length;
    const pendingCount = entries.length - syncedCount;

    log('Memory System Status:', 'blue');
    console.log('');
    log('Local:', 'green');
    log(`  Total entries: ${entries.length}`, 'blue');
    log(`  Synced: ${syncedCount}`, 'blue');
    log(`  Pending: ${pendingCount}`, 'blue');

    if (backendEnabled) {
      try {
        const status = await client.getStatus();
        log('', '');
        log('Backend:', 'green');
        log(`  Status: ✅ Online`, 'blue');
        log(`  Backend entries: ${status.memory_count || 0}`, 'blue');
      } catch {
        log('', '');
        log('Backend:', 'green');
        log(`  Status: ❌ Offline`, 'red');
      }
    }

    log('', '');
    log('Storage:', 'green');
    log(`  Memory dir: ${MEMORY_DIR}`, 'blue');
    log(`  Link map: ✅`, 'blue');

    if (args.detailed && pendingCount > 0) {
      const pending = entries.filter(e => !e.synced).slice(0, 10);
      log('', '');
      log('Pending entries:', 'yellow');
      pending.forEach(e => {
        log(`  - ${e.id}: ${(e.abstract || '(no abstract)').substring(0, 40)}...`, 'blue');
      });
      if (pendingCount > 10) {
        log(`  ... and ${pendingCount - 10} more`, 'blue');
      }
    }

    console.log('');
  } catch (e) {
    log(`❌ Status failed: ${e.message}`, 'red');
    console.error(e);
    process.exit(1);
  }
}

async function checkpointCommand(args) {
  try {
    const { getConfig } = await import('../lib/storage.js');
    const { getWrapperClient } = await import('../lib/wrapper-client.js');

    const config = getConfig();
    const client = getWrapperClient(config);
    const backendEnabled = config?.backend?.enabled !== false;

    if (!backendEnabled) {
      log('❌ Backend not enabled', 'red');
      return;
    }

    const action = args.action || 'list';
    const limit = parseInt(args.limit) || 20;

    if (action === 'list') {
      log('Fetching checkpoints...', 'blue');
      const fingerprints = await client.getServerFingerprints(
        config?.backend?.tenant_id || 'default'
      );
      const list = fingerprints.fingerprints || fingerprints || [];

      if (list.length === 0) {
        log('✅ No fingerprints on server', 'green');
        return;
      }

      log(`## Sync Checkpoints`, 'blue');
      log(`Total on server: ${list.length}`, 'green');
      console.log('');

      const shown = list.slice(0, limit);
      log('Source ID                          | Hash          | Path', 'blue');
      log('-----------------------------------|---------------|-------------------', 'blue');
      shown.forEach(fp => {
        const sid = (fp.source_id || 'N/A').substring(0, 32);
        const hash = fp.hash ? fp.hash.substring(0, 12) : 'N/A';
        const path = fp.path ? fp.path.substring(0, 30) : 'N/A';
        log(`${sid.padEnd(33)}| ${hash.padEnd(13)}| ${path}`, 'blue');
      });

      if (list.length > limit) {
        log(`... and ${list.length - limit} more`, 'yellow');
      }
    } else {
      log(`❌ Unknown action: ${action}`, 'red');
    }
  } catch (e) {
    log(`❌ Checkpoint failed: ${e.message}`, 'red');
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
