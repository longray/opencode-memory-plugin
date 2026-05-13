#!/usr/bin/env node

/**
 * OpenCode Memory Plugin - CLI Tool (v3.3.0)
 *
 * CLI commands delegate to tools/ — one codebase, multiple entry points.
 * Usage: opencode-memory <command> [options]
 */

import { logInfo, logError } from '../lib/logger.js';

const VERSION = 'v3.3.0';

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
  'entity-update': entityUpdateCommand,
  'entity-atoms': entityAtomsCommand,
  'load-context-budget': loadContextBudgetCommand,
  'load-context-level': loadContextLevelCommand,
  init: initCommand,
  status: statusCommand,
  sync: syncCommand,
  rebuild: rebuildCommand,
  checkpoint: checkpointCommand,
  conflicts: conflictsCommand,
  graphify: graphifyCommand,
  // Quality Dashboard (Phase 1)
  'quality-dashboard': qualityDashboardCommand,
  // SOP Execution (Phase 2)
  sop: sopCommand,
  // Quality Guard (Phase 3)
  'quality-guard': qualityGuardCommand,
  // One-Click Fix (Phase 4)
  fix: fixCommand,
  // Quality Trends (Phase 5)
  'quality-trends': qualityTrendsCommand,
  'quality-export': qualityExportCommand,
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
  logInfo(
    'cli',
    `
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
  entity-update    Batch update atoms (add/update/remove)
  entity-atoms     Get atom tree structure for an entity
  load-context-budget  Load entity context within token budget
  load-context-level   Load entity context filtered by level
  init     Initialize memory system
  status   Check system status
  sync     Sync memories to backend
  rebuild  Rebuild vector index
  checkpoint  View sync checkpoints
  conflicts   List sync conflicts
  graphify Analyze project with graphify and import to SurrealDB

Quality Commands (v3.4):
  quality-dashboard  Real-time quality dashboard
  sop                SOP execution (run/list/show)
  quality-guard      Quality guard configuration
  fix                One-click diagnosis and repair
  quality-trends     7-day quality trend visualization
  quality-export     Export quality metrics (CSV/JSON)

Advanced Commands:
  graphify           Analyze project with graphify and import to SurrealDB

  help     Show this help

Examples:
  opencode-memory write "User prefers TypeScript" --type "preference"
  opencode-memory search "typescript"
  opencode-memory timeline --days 7
  opencode-memory status

For detailed help on a command: opencode-memory <command> --help
`
  );
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
    let atoms;
    if (args['atoms']) {
      try {
        atoms = JSON.parse(args['atoms']);
      } catch (parseErr) {
        log(`Error: --atoms is not valid JSON: ${parseErr.message}`, 'red');
        process.exit(1);
      }
    }

    const { memory_write } = await import('../tools/core.js');
    const result = await memory_write.execute({
      content,
      abstract,
      overview,
      type: args.type || 'general',
      tags: parseTags(args.tags),
      pinned: false,
      ...(atoms && { atoms }),
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

  const scope = args.scope || 'all';
  const atom_types = args['atom-types']
    ? args['atom-types']
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
    : undefined;

  try {
    const { memory_search } = await import('../tools/search.js');
    const result = await memory_search.execute({
      query,
      mode: args.mode || 'hybrid',
      limit: parseInt(args.limit) || 10,
      level: parseInt(args.level) || 0,
      scope,
      ...(atom_types && { atom_types }),
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

// ─── Entity Commands ──────────────────────────────────────────

async function entityUpdateCommand(args) {
  if (!args['entry-id']) {
    log('Error: --entry-id is required', 'red');
    log(
      'Usage: opencode-memory entity-update --entry-id <id> --atoms-batch <json> [--entity-updates <json>]',
      'yellow'
    );
    process.exit(1);
  }

  let atomsBatch;
  if (args['atoms-batch']) {
    try {
      atomsBatch = JSON.parse(args['atoms-batch']);
    } catch (e) {
      log(`Error: --atoms-batch is not valid JSON: ${e.message}`, 'red');
      process.exit(1);
    }
  }

  let entityUpdates;
  if (args['entity-updates']) {
    try {
      entityUpdates = JSON.parse(args['entity-updates']);
    } catch (e) {
      log(`Error: --entity-updates is not valid JSON: ${e.message}`, 'red');
      process.exit(1);
    }
  }

  try {
    const { entity_update } = await import('../tools/core.js');
    const params = { entry_id: args['entry-id'] };
    if (atomsBatch) params.atoms_batch = atomsBatch;
    if (entityUpdates) params.entity_updates = entityUpdates;
    const result = await entity_update.execute(params);
    logInfo('cli-entity-update', result);
  } catch (e) {
    log(`❌ Entity update failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function entityAtomsCommand(args) {
  if (!args['entry-id']) {
    log('Error: --entry-id is required', 'red');
    log('Usage: opencode-memory entity-atoms --entry-id <id> [--no-content]', 'yellow');
    process.exit(1);
  }

  try {
    const { entity_atoms } = await import('../tools/core.js');
    const result = await entity_atoms.execute({
      entry_id: args['entry-id'],
      include_content: !args['no-content'],
    });
    console.log(result);
  } catch (e) {
    log(`❌ Entity atoms failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function loadContextBudgetCommand(args) {
  if (!args['entry-id']) {
    log('Error: --entry-id is required', 'red');
    log(
      'Usage: opencode-memory load-context-budget --entry-id <id> --query <text> [--max-tokens 2000] [--strategy relevance]',
      'yellow'
    );
    process.exit(1);
  }
  if (!args.query) {
    log('Error: --query is required', 'red');
    process.exit(1);
  }

  try {
    const { load_context_budget } = await import('../tools/core.js');
    const result = await load_context_budget.execute({
      entry_id: args['entry-id'],
      query: args.query,
      max_tokens: parseInt(args['max-tokens']) || 2000,
      strategy: args.strategy || 'relevance',
    });
    console.log(result);
  } catch (e) {
    log(`❌ Load context budget failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

async function loadContextLevelCommand(args) {
  if (!args['entry-id']) {
    log('Error: --entry-id is required', 'red');
    log(
      'Usage: opencode-memory load-context-level --entry-id <id> [--max-level 2] [--no-breadcrumbs]',
      'yellow'
    );
    process.exit(1);
  }

  try {
    const { load_context_level } = await import('../tools/core.js');
    const result = await load_context_level.execute({
      entry_id: args['entry-id'],
      max_level: parseInt(args['max-level']) || 2,
      include_breadcrumbs: !args['no-breadcrumbs'],
    });
    console.log(result);
  } catch (e) {
    log(`❌ Load context level failed: ${e.message}`, 'red');
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

// ─── Quality Dashboard (Phase 1) ──────────────────────────────────

async function qualityDashboardCommand(args) {
  try {
    const { gatherQualityMetrics, renderDashboard } = await import('../lib/quality-dashboard.js');
    const { recordDailyMetrics } = await import('../lib/quality-metrics.js');

    const metrics = await gatherQualityMetrics({ includeSearch: !args['no-search'] });

    // Record metrics for trends
    recordDailyMetrics({
      entity_count: metrics.entity_count,
      relationship_count: metrics.relationship_count,
      network_density: metrics.network_density,
      isolated_entities: metrics.isolated_entities,
      search_latency: metrics.search_latency,
      search_accuracy: metrics.search_accuracy,
      health_score: metrics.health_score,
    });

    console.log(renderDashboard(metrics, { showTrends: !args['no-trends'] }));

    // Auto-refresh mode
    if (args['auto-refresh']) {
      const interval = setInterval(async () => {
        process.stdout.write('\x1b[H\x1b[2J');
        const newMetrics = await gatherQualityMetrics({ includeSearch: false });
        recordDailyMetrics({
          entity_count: newMetrics.entity_count,
          relationship_count: newMetrics.relationship_count,
          network_density: newMetrics.network_density,
          isolated_entities: newMetrics.isolated_entities,
          search_latency: newMetrics.search_latency,
          search_accuracy: newMetrics.search_accuracy,
          health_score: newMetrics.health_score,
        });
        console.log(renderDashboard(newMetrics, { showTrends: true }));
      }, 60000);

      process.stdin.setRawMode(true);
      process.stdin.on('data', key => {
        if (key.toString() === 'q') {
          clearInterval(interval);
          process.exit(0);
        }
        if (key.toString() === 'r') {
          // Manual refresh handled by interval
        }
      });
    }
  } catch (e) {
    log(`❌ Dashboard failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── SOP Execution (Phase 2) ──────────────────────────────────────

async function sopCommand(args) {
  const subCommand = args._[1];

  try {
    const { executeSOP, listSOPs, showSOP } = await import('../lib/sop-engine.js');

    if (subCommand === 'run') {
      const sopName = args._[2];
      if (!sopName) {
        log('Error: SOP name is required', 'red');
        log('Usage: opencode-memory sop run <name> [--dry-run] [--step <name>]', 'yellow');
        process.exit(1);
      }

      const overrides = {};
      if (args.threshold) overrides.threshold = parseFloat(args.threshold);
      if (args['min-weight']) overrides.min_weight = parseFloat(args['min-weight']);

      const result = await executeSOP({
        name: sopName,
        overrides,
        dryRun: !!args['dry-run'],
        step: args.step,
        stepRange: args['step-range'],
        skip: args.skip ? args.skip.split(',') : [],
        listSteps: !!args['list-steps'],
      });

      if (!result.success) {
        log(`❌ SOP failed: ${result.error}`, 'red');
        process.exit(1);
      }

      if (result.dryRun) {
        log(`📋 Dry Run: ${result.sop}`, 'yellow');
        log(`  Steps to run: ${result.stepsToRun}`, 'blue');
        log(`  Parameters: ${JSON.stringify(result.parameters)}`, 'dim');
        for (const s of result.steps) {
          log(`    - ${s.name}: ${s.description}`, 'cyan');
        }
      } else if (result.listSteps) {
        log(`📋 Steps for ${result.sop}:`, 'blue');
        for (const s of result.steps) {
          log(`  ${s.index}. ${s.name} - ${s.description}`, 'cyan');
        }
      } else {
        log(`✅ SOP completed: ${result.sop}`, 'green');
        log(
          `  Steps: ${result.steps_executed} executed, ${result.success_count} success, ${result.failed_count} failed`,
          'blue'
        );
        log(`  Duration: ${result.duration_ms}ms`, 'blue');
        if (result.report_path) log(`  Report: ${result.report_path}`, 'dim');
      }
    } else if (subCommand === 'list') {
      const sops = listSOPs(args.category);
      if (sops.length === 0) {
        log('No SOPs found. Create YAML files in ~/.opencode/sops/', 'yellow');
        return;
      }
      log('📋 Available SOPs:', 'blue');
      for (const sop of sops) {
        const lastRun = sop.last_run ? ` (last run: ${sop.last_run})` : '';
        log(`  ${sop.name} [${sop.category}] - ${sop.description}${lastRun}`, 'cyan');
      }
    } else if (subCommand === 'show') {
      const sopName = args._[2];
      if (!sopName) {
        log('Error: SOP name is required', 'red');
        process.exit(1);
      }
      const sop = showSOP(sopName);
      if (!sop) {
        log(`SOP "${sopName}" not found`, 'red');
        process.exit(1);
      }
      log(`📋 SOP: ${sop.name}`, 'blue');
      log(`  Description: ${sop.description}`, 'cyan');
      log(`  Category: ${sop.category || 'general'}`, 'cyan');
      if (sop.parameters) {
        log(`  Parameters:`, 'cyan');
        for (const [k, v] of Object.entries(sop.parameters)) {
          log(`    --${k}: ${v}`, 'dim');
        }
      }
      if (sop.steps) {
        log(`  Steps:`, 'cyan');
        for (const [i, step] of sop.steps.entries()) {
          log(`    ${i + 1}. ${step.name || step.action} - ${step.description || ''}`, 'dim');
        }
      }
    } else {
      log(`Unknown sop subcommand: ${subCommand}`, 'red');
      log('Usage: opencode-memory sop <run|list|show>', 'yellow');
      process.exit(1);
    }
  } catch (e) {
    log(`❌ SOP failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Quality Guard (Phase 3) ──────────────────────────────────────

async function qualityGuardCommand(args) {
  try {
    const {
      loadQualityGuardConfig,
      saveQualityGuardConfig,
      disableQualityGuard,
      enableQualityGuard,
    } = await import('../lib/quality-guard.js');

    const action = args._[1] || 'status';

    if (action === 'status') {
      const config = loadQualityGuardConfig();
      log('🛡️  Quality Guard Configuration:', 'blue');
      log(`  Enabled: ${config.enabled ? '✅' : '❌'}`, config.enabled ? 'green' : 'red');
      log(`  Check on Write: ${config.check_on_write ? '✅' : '❌'}`, 'cyan');
      log(`  Check on Relate: ${config.check_on_relate ? '✅' : '❌'}`, 'cyan');
      log(`  Isolated Threshold: ${config.thresholds.isolated}`, 'cyan');
      log(
        `  Weight Range: [${config.thresholds.min_weight}, ${config.thresholds.max_weight}]`,
        'cyan'
      );
      log(`  Warning Level: ${config.warning_level}`, 'cyan');
    } else if (action === 'enable') {
      enableQualityGuard();
      log('✅ Quality guard enabled', 'green');
    } else if (action === 'disable') {
      disableQualityGuard(args.reason || 'manual');
      log('⚠️  Quality guard disabled', 'yellow');
    } else if (action === 'set') {
      const key = args._[2];
      const value = args._[3];
      if (!key || value === undefined) {
        log('Usage: opencode-memory quality-guard set <key> <value>', 'yellow');
        process.exit(1);
      }
      const updates = {};
      if (key.includes('.')) {
        const [section, field] = key.split('.');
        updates[section] = {
          [field]:
            value === 'true'
              ? true
              : value === 'false'
                ? false
                : isNaN(value)
                  ? value
                  : Number(value),
        };
      } else {
        updates[key] =
          value === 'true'
            ? true
            : value === 'false'
              ? false
              : isNaN(value)
                ? value
                : Number(value);
      }
      saveQualityGuardConfig(updates);
      log(`✅ Updated ${key} = ${value}`, 'green');
    } else {
      log(`Unknown action: ${action}`, 'red');
      log('Usage: opencode-memory quality-guard <status|enable|disable|set>', 'yellow');
      process.exit(1);
    }
  } catch (e) {
    log(`❌ Quality guard failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── One-Click Fix (Phase 4) ──────────────────────────────────────

async function fixCommand(args) {
  try {
    const { diagnoseIssues, applyFixes, undoFix, getFixHistory } =
      await import('../lib/fix-engine.js');

    // Undo mode
    if (args.undo) {
      const result = await undoFix({
        fixId: typeof args.undo === 'string' ? args.undo : undefined,
      });
      if (!result.success) {
        log(`❌ Undo failed: ${result.error}`, 'red');
        process.exit(1);
      }
      log(`✅ Undo successful: ${result.message}`, 'green');
      return;
    }

    // History mode
    if (args.history) {
      const history = getFixHistory(10);
      if (history.length === 0) {
        log('No fix history available', 'yellow');
        return;
      }
      log('📋 Fix History:', 'blue');
      for (const record of history) {
        log(
          `  ${record.id} [${record.mode}] ${record.issue_type} - ${record.results.applied} applied, ${record.results.failed} failed`,
          'cyan'
        );
      }
      return;
    }

    // Determine issue type
    const issueType = args._[1] || 'all';

    // Dry-run mode
    if (args['dry-run']) {
      const diagnosis = await diagnoseIssues({
        types: issueType === 'all' ? undefined : [issueType],
      });
      log(`🔍 Diagnosis (dry-run):`, 'blue');
      log(`  Total issues: ${diagnosis.total_issues}`, 'cyan');
      for (const [type, count] of Object.entries(diagnosis.summary)) {
        if (count > 0) log(`  ${type}: ${count}`, count > 5 ? 'red' : 'yellow');
      }
      return;
    }

    // Apply fixes
    const result = await applyFixes({
      issueType,
      mode: args.auto ? 'auto' : 'dry-run',
      options: {},
    });

    if (result.mode === 'dry-run') {
      log(result.message, 'yellow');
      log(`  Total issues: ${result.diagnosis.total_issues}`, 'cyan');
      for (const [type, count] of Object.entries(result.diagnosis.summary)) {
        if (count > 0) log(`  ${type}: ${count}`, 'yellow');
      }
    } else {
      log(`✅ Fix completed: ${result.issue_type}`, 'green');
      log(
        `  Applied: ${result.applied}, Skipped: ${result.skipped}, Failed: ${result.failed}`,
        'blue'
      );
      log(`  Fix ID: ${result.fix_id}`, 'dim');
    }
  } catch (e) {
    log(`❌ Fix failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Quality Trends (Phase 5) ─────────────────────────────────────

async function qualityTrendsCommand(args) {
  try {
    const {
      getMetricsForDays,
      getMetricsByRange,
      calculateTrend,
      calculateTrendStats,
      compareWithTarget,
      estimateDaysToTarget,
      QUALITY_TARGETS,
    } = await import('../lib/quality-metrics.js');
    const { renderProgressBar, renderTrendIndicator } = await import('../lib/ascii-charts.js');

    let metrics;
    if (args.from && args.to) {
      metrics = getMetricsByRange(args.from, args.to);
    } else {
      metrics = getMetricsForDays(parseInt(args.days) || 7);
    }

    if (metrics.length === 0) {
      log('No trend data available. Run quality-dashboard first to collect metrics.', 'yellow');
      return;
    }

    const metricNames = [
      'entity_count',
      'relationship_count',
      'network_density',
      'isolated_entities',
      'search_latency',
      'health_score',
    ];
    const filterMetric = args.metric;

    log('📈 Quality Trends (Last 7 Days)', 'blue');
    log('');

    for (const metricName of metricNames) {
      if (filterMetric && metricName !== filterMetric) continue;

      const trend = calculateTrend(metrics, metricName);
      const values = trend.values;
      if (values.length === 0) continue;

      const stats = calculateTrendStats(values);
      const target = compareWithTarget(metricName, values[values.length - 1]);

      const displayName = metricName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      log(`  ${displayName}:`, 'cyan');
      log(
        `    ${renderTrendIndicator({ changePercent: trend.changePercent, change: trend.change })}`,
        'bold'
      );
      log(`    Min: ${stats.min} | Max: ${stats.max} | Avg: ${stats.avg}`, 'dim');

      if (target.target !== null) {
        log(
          `    Target: ${target.target} | Progress: ${target.progress}% | ${target.onTarget ? '✅ On target' : '⚠️ Off target'}`,
          target.onTarget ? 'green' : 'yellow'
        );
        log(
          `    ${renderProgressBar({ current: values[values.length - 1], target: target.target, width: 20 })}`,
          'dim'
        );

        const dailyChange =
          values.length > 1 ? (values[values.length - 1] - values[0]) / (values.length - 1) : 0;
        const targetConfig = QUALITY_TARGETS[metricName];
        if (targetConfig) {
          const days = estimateDaysToTarget(
            values[values.length - 1],
            targetConfig.target,
            dailyChange,
            targetConfig.direction
          );
          if (days !== null) log(`    Est. days to target: ${days}`, 'dim');
        }
      }
      log('');
    }

    // Comparison mode
    if (args.compare === 'week') {
      const thisWeek = metrics.slice(-7);
      const lastWeek = metrics.slice(-14, -7);
      if (lastWeek.length > 0) {
        log('📊 Week-over-Week Comparison:', 'blue');
        for (const metricName of metricNames) {
          if (filterMetric && metricName !== filterMetric) continue;
          const thisAvg =
            thisWeek.length > 0
              ? thisWeek.reduce((s, m) => s + (m[metricName] || 0), 0) / thisWeek.length
              : 0;
          const lastAvg = lastWeek.reduce((s, m) => s + (m[metricName] || 0), 0) / lastWeek.length;
          const change = lastAvg !== 0 ? ((thisAvg - lastAvg) / lastAvg) * 100 : 0;
          log(
            `  ${metricName}: ${lastAvg.toFixed(1)} → ${thisAvg.toFixed(1)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`,
            change >= 0 ? 'green' : 'red'
          );
        }
      }
    }
  } catch (e) {
    log(`❌ Trends failed: ${e.message}`, 'red');
    process.exit(1);
  }
}

// ─── Graphify Command ──────────────────────────────────────────────

async function graphifyCommand(args) {
  try {
    const { graphifyProject } = await import('../lib/graphify-bridge.js');
    const result = await graphifyProject({
      projectPath: args.project || process.cwd(),
      skipGraphify: args['skip-graphify'] || false,
    });

    console.log('\n=== Graphify Import Report ===');
    console.log(`Entities:   ${result.entities}`);
    console.log(`Atoms:      ${result.atoms}`);
    console.log(`References: ${result.references}`);
    if (result.errors) console.log(`Errors:     ${result.errors}`);
    if (result.skipped) console.log(`Skipped:    ${result.skipped}`);
    console.log('\nBy Relation:');
    for (const [type, count] of Object.entries(result.byRelation || {})) {
      console.log(`  ${type}: ${count}`);
    }
  } catch (err) {
    log(`Error: ${err.message}`, 'red');
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
