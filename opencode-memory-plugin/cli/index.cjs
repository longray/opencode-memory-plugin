#!/usr/bin/env node

/**
 * OpenCode Memory Plugin - CLI Tool (v3.2.0)
 *
 * CLI commands delegate to tools/ — one codebase, multiple entry points.
 * Usage: opencode-memory <command> [options]
 */

import { logInfo, logError, logWarn } from '../lib/logger.js';

const VERSION = 'v3.2.0';

const commands = {
  write: writeCommand,
  read: readCommand,
  search: searchCommand,
  timeline: timelineCommand,
  topics: topicsCommand,
  relate: relateCommand,
  graph: graphCommand,
  pin: pinCommand,
  suggest: suggestCommand,
  init: initCommand,
  status: statusCommand,
  sync: syncCommand,
  rebuild: rebuildCommand,
  checkpoint: checkpointCommand,
  conflicts: conflictsCommand,
  help: showHelp,
};

// Backward compat: 'list' → 'timeline'
const aliases = { list: 'timeline' };

function log(msg, color = '') {
  logInfo('cli', msg, { color });
}

function parseTags(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

function showHelp() {
  logInfo('cli', `
┌─────────────────────────────────────────────────────────────┐
│                        OpenCode Memory CLI                  │
│                    Persistent Memory System                 │
└─────────────────────────────────────────────────────────────┘

Version: ${VERSION}

Commands:
  write    Write to memory
  read     Read from memory  
  search   Search memory
  timeline Browse memories by date
  topics   Browse memories by topic
  relate   Create relations between memories
  graph    Traverse memory graph
  pin      Pin/unpin memories
  suggest  Get search suggestions
  init     Initialize memory system
  status   Check system status
  sync     Sync memories to backend
  rebuild  Rebuild vector index
  checkpoint  View sync checkpoints
  conflicts   List sync conflicts
  help     Show this help

Examples:
  opencode-memory write "User prefers TypeScript" --type "preference"
  opencode-memory search "typescript"
  opencode-memory timeline --days 7
  opencode-memory status

For detailed help on a command: opencode-memory <command> --help
`);
}

// ─── Core Commands ────────────────────────────────────────────────

async function writeCommand(args) {
  const content = args._[1] || args.content;
  if (!content) {
    log('Error: Content is required', 'red');
    log('Usage: opencode-memory write <content> --abstract <text> --overview <text>', 'yellow');
    process.exit(1);
  }

  const abstract = typeof args.abstract === 'string' ? args.abstract.trim() : '';
  const overview = typeof args.overview === 'string' ? args.overview.trim() : '';

  if (!abstract) {
    log('Error: abstract is REQUIRED (recommended ≤100 chars)', 'red');
    process.exit(1);
  }
  if (!overview) {
    log('Error: overview is REQUIRED (recommended ≤500 chars)', 'red');
    process.exit(1);
  }

  try {
    const { memory_write } = await import('../tools/core.js');
    const result = await memory_write.execute({
      content,
      abstract,
      overview,
      type: args.type || 'general',
      tags: parseTags(args.tags),
      pinned: false,
    });

    log('✅ Entry written successfully', 'green');
    log(`  ID: ${result.id}`, 'blue');
    if (result.memory_id) {
      log(`  Backend: ✅ Synced (${result.memory_id})`, 'green');
    }
  } catch (e) {
    log(`❌ Failed to write: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function readCommand(args) {
  const entryId = args.id;
  if (!entryId) {
    log('Error: --id is required', 'red');
    log('Usage: opencode-memory read --id <entry_id> [--level 0|1|2]', 'yellow');
    process.exit(1);
  }

  try {
    const { memory_read } = await import('../tools/core.js');
    const result = await memory_read.execute({
      entry_id: entryId,
      level: parseInt(args.level) || 2,
    });
    console.log(result);
  } catch (e) {
    log(`❌ Failed to read: ${e.message}`, 'red');
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

  try {
    const { memory_search } = await import('../tools/search.js');
    const result = await memory_search.execute({
      query,
      mode: args.mode || 'hybrid',
      limit: parseInt(args.limit) || 10,
      level: parseInt(args.level) || 0,
    });
    console.log(result);
  } catch (e) {
    log(`❌ Search failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function suggestCommand(args) {
  const prefix = args._[1] || args.prefix || '';
  if (!prefix) {
    log('Error: Prefix is required', 'red');
    log('Usage: opencode-memory suggest <prefix> [--limit <n>]', 'yellow');
    process.exit(1);
  }

  try {
    const { memory_suggest } = await import('../tools/search.js');
    const result = await memory_suggest.execute({
      prefix,
      limit: parseInt(args.limit) || 10,
    });
    console.log(result);
  } catch (e) {
    log(`❌ Suggest failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Browse Commands ─────────────────────────────────────────────

async function timelineCommand(args) {
  try {
    const { memory_timeline } = await import('../tools/browse.js');
    const result = await memory_timeline.execute({
      days: parseInt(args.days) || 7,
      level: parseInt(args.level) || 1,
    });
    logInfo('cli-timeline', result);
  } catch (e) {
    log(`❌ Timeline failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function topicsCommand(args) {
  try {
    const { memory_topics } = await import('../tools/browse.js');
    const result = await memory_topics.execute({
      min_entries: parseInt(args.min) || 3,
    });
    logInfo('cli-topics', result);
  } catch (e) {
    log(`❌ Topics failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Graph Commands ──────────────────────────────────────────────

async function relateCommand(args) {
  const action = args.action || 'create';

  if (action === 'create') {
    if (!args['from-id'] || !args['to-id']) {
      log('Error: --from-id and --to-id are required for create', 'red');
      process.exit(1);
    }
    try {
      const { memory_relate } = await import('../tools/graph.js');
      const result = await memory_relate.execute({
        action: 'create',
        from_id: args['from-id'],
        to_id: args['to-id'],
        relation_type: args.type || 'related',
        weight: parseFloat(args.weight) || 0.5,
      });
      logInfo('cli-relate-create', result);
    } catch (e) {
      log(`❌ Relate failed: ${e.message}`, 'red');
      process.exit(1);
    }
  } else if (action === 'query') {
    if (!args['from-id']) {
      log('Error: --from-id is required for query', 'red');
      process.exit(1);
    }
    try {
      const { memory_relate } = await import('../tools/graph.js');
      const result = await memory_relate.execute({
        action: 'query',
        from_id: args['from-id'],
      });
      logInfo('cli-relate-query', result);
    } catch (e) {
      log(`❌ Relate query failed: ${e.message}`, 'red');
      process.exit(1);
    }
  } else {
    log(`Error: Unknown action "${action}". Use "create" or "query"`, 'red');
    process.exit(1);
  }
}

async function graphCommand(args) {
  if (!args['memory-id']) {
    log('Error: --memory-id is required', 'red');
    log('Usage: opencode-memory graph --memory-id <id> [--depth 2]', 'yellow');
    process.exit(1);
  }

  try {
    const { memory_graph } = await import('../tools/graph.js');
    const result = await memory_graph.execute({
      memory_id: args['memory-id'],
      depth: parseInt(args.depth) || 2,
      limit: parseInt(args.limit) || 20,
    });
    logInfo('cli-graph', result);
  } catch (e) {
    log(`❌ Graph failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function pinCommand(args) {
  if (!args['entry-id']) {
    log('Error: --entry-id is required', 'red');
    log('Usage: opencode-memory pin --entry-id <id> [--action pin|unpin]', 'yellow');
    process.exit(1);
  }

  try {
    const { memory_pin } = await import('../tools/core.js');
    const result = await memory_pin.execute({
      entry_id: args['entry-id'],
      action: args.action || 'pin',
    });
    logInfo('cli-pin', result);
  } catch (e) {
    log(`❌ Pin failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Sync Commands ───────────────────────────────────────────────

async function statusCommand(args) {
  try {
    const { index_status } = await import('../tools/sync.js');
    const result = await index_status.execute({
      detailed: !!args.detailed,
    });
    logInfo('cli-status', result);
  } catch (e) {
    log(`❌ Status failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function syncCommand(args) {
  try {
    const { incremental_sync, full_sync } = await import('../tools/sync.js');

    if (args.full) {
      const result = await full_sync.execute({
        dry_run: !!args['dry-run'],
        auto_clean: !!args['auto-clean'],
      });
      logInfo('cli-sync-full', result);
    } else {
      const result = await incremental_sync.execute({
        dry_run: !!args['dry-run'],
      });
      logInfo('cli-sync-incremental', result);
    }
  } catch (e) {
    log(`❌ Sync failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function rebuildCommand(args) {
  try {
    const { rebuild_index } = await import('../tools/sync.js');
    const result = await rebuild_index.execute({
      force: !!args.force,
      dry_run: !!args['dry-run'],
    });
    logInfo('cli-rebuild', result);
  } catch (e) {
    log(`❌ Rebuild failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function checkpointCommand(args) {
  try {
    const { sync_checkpoint } = await import('../tools/sync.js');
    const result = await sync_checkpoint.execute({
      action: args.action || 'list',
      limit: parseInt(args.limit) || 20,
    });
    logInfo('cli-checkpoint', result);
  } catch (e) {
    log(`❌ Checkpoint failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function conflictsCommand(args) {
  try {
    const { conflict_list, conflict_resolve } = await import('../tools/sync.js');

    if (args.resolve) {
      if (!args['conflict-id'] || !args.resolution) {
        log('Error: --conflict-id and --resolution are required with --resolve', 'red');
        process.exit(1);
      }
      const result = await conflict_resolve.execute({
        conflict_id: args['conflict-id'],
        resolution: args.resolution,
      });
      logInfo('cli-conflict-resolve', result);
    } else {
      const result = await conflict_list.execute({
        limit: parseInt(args.limit) || 10,
      });
      logInfo('cli-conflict-list', result);
    }
  } catch (e) {
    log(`❌ Conflicts failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Utility ─────────────────────────────────────────────────────

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
      log(`ℹ️  Already exists: ${dayDir}`, 'yellow');
    }
  } catch (e) {
    log(`❌ Init failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Argument Parser ─────────────────────────────────────────────

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

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  let command = args._[0];

  if (!command || command === 'help') {
    showHelp();
    process.exit(0);
  }

  if (aliases[command]) {
    command = aliases[command];
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
    logError('cli-main', 'Command execution error', e);
    process.exit(1);
  }
}

main();
