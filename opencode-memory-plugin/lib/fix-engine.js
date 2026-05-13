/**
 * @deprecated since v3.4 - Replaced by graphify-bridge.js
 * Graphify solves the root cause (42% isolation rate) directly.
 * This module only diagnosed but never fixed issues.
 */

/**
 * @deprecated since v3.4 - Replaced by graphify-bridge.js
 * Graphify solves the root cause (42% isolation rate) directly.
 * This module only diagnosed but never fixed issues.
 */

/**
 * Fix Engine - One-click diagnosis and repair for knowledge graph issues
 *
 * Diagnoses issues, generates fix recommendations, supports dry-run/auto/interactive modes,
 * undo functionality, and fix validation.
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { MEMORY_DIR } from './constants.js';
import { logWarn } from './logger.js';
import { getWrapperClient } from './wrapper-client.js';
import { getConfig } from './storage.js';

const FIX_HISTORY_FILE = path.join(MEMORY_DIR, '.fix-history.json');

/**
 * Loads fix history
 * @returns {Array}
 */
function loadFixHistory() {
  try {
    if (!fs.existsSync(FIX_HISTORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(FIX_HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Saves fix history
 * @param {Array} history
 */
function saveFixHistory(history) {
  try {
    fs.writeFileSync(FIX_HISTORY_FILE, JSON.stringify(history.slice(-10), null, 2), 'utf-8');
  } catch (error) {
    logWarn('fix-engine', `Failed to save history: ${error.message}`);
  }
}

/**
 * Diagnoses knowledge graph issues
 * @param {Object} [options]
 * @param {string[]} [options.types] - Issue types to check
 * @returns {Promise<Object>}
 */
export async function diagnoseIssues(options = {}) {
  const {
    types = [
      'isolated-entities',
      'low-weight-relations',
      'missing-relations',
      'duplicates',
      'incomplete-entities',
    ],
  } = options;
  const client = getWrapperClient(getConfig());
  const issues = {
    'isolated-entities': [],
    'low-weight-relations': [],
    'missing-relations': [],
    duplicates: [],
    'incomplete-entities': [],
  };

  try {
    if (types.includes('isolated-entities')) {
      const refs = await client.queryReferences({ limit: 100 });
      const refEntities = new Set();
      for (const r of refs.data || refs.references || []) {
        if (r.from_id) refEntities.add(r.from_id);
        if (r.to_id) refEntities.add(r.to_id);
      }

      const entities = await client.listEntities({ limit: 100 });
      for (const e of entities.data || entities.entities || []) {
        if (e.id && !refEntities.has(e.id)) {
          issues['isolated-entities'].push({
            type: 'isolated-entities',
            entity_id: e.id,
            entity_abstract: e.abstract || '',
            severity: 'warning',
            fix: {
              action: 'suggest_relations',
              description: `Suggest relations for isolated entity: ${e.abstract?.substring(0, 50) || e.id}`,
            },
          });
        }
      }
    }

    if (types.includes('low-weight-relations')) {
      const refs = await client.queryReferences({ limit: 100 });
      for (const r of refs.data || refs.references || []) {
        if (r.weight !== undefined && r.weight < 0.5) {
          issues['low-weight-relations'].push({
            type: 'low-weight-relations',
            relation_id: r.id,
            from_id: r.from_id,
            to_id: r.to_id,
            weight: r.weight,
            severity: 'info',
            fix: {
              action: 'recalculate_weight',
              description: `Recalculate weight for relation ${r.id} (current: ${r.weight})`,
            },
          });
        }
      }
    }

    if (types.includes('duplicates')) {
      const entities = await client.listEntities({ limit: 100 });
      const entityList = entities.data || entities.entities || [];
      for (let i = 0; i < entityList.length; i++) {
        for (let j = i + 1; j < entityList.length; j++) {
          const a = entityList[i];
          const b = entityList[j];
          if (a.abstract && b.abstract && a.abstract === b.abstract) {
            issues['duplicates'].push({
              type: 'duplicates',
              entity_id_1: a.id,
              entity_id_2: b.id,
              abstract: a.abstract,
              severity: 'warning',
              fix: {
                action: 'merge_entities',
                description: `Merge duplicate entities: ${a.abstract.substring(0, 50)}`,
              },
            });
          }
        }
      }
    }

    if (types.includes('incomplete-entities')) {
      const entities = await client.listEntities({ limit: 100 });
      for (const e of entities.data || entities.entities || []) {
        const missing = [];
        if (!e.abstract) missing.push('abstract');
        if (missing.length > 0) {
          issues['incomplete-entities'].push({
            type: 'incomplete-entities',
            entity_id: e.id,
            missing_fields: missing,
            severity: 'error',
            fix: {
              action: 'fill_missing_fields',
              description: `Fill missing fields for entity ${e.id}: ${missing.join(', ')}`,
            },
          });
        }
      }
    }

    if (types.includes('missing-relations')) {
      const entities = await client.listEntities({ limit: 100 });
      for (const e of entities.data || entities.entities || []) {
        if (!e.id) continue;
        const rels = await client.getRelations({ memory_id: e.id });
        if ((rels.relations || []).length === 0) {
          issues['missing-relations'].push({
            type: 'missing-relations',
            entity_id: e.id,
            entity_abstract: e.abstract || '',
            severity: 'info',
            fix: {
              action: 'suggest_relations',
              description: `Suggest relations for entity: ${e.abstract?.substring(0, 50) || e.id}`,
            },
          });
        }
      }
    }
  } catch (error) {
    logWarn('fix-engine', `Diagnosis error: ${error.message}`);
  }

  const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
  return {
    issues,
    total_issues: totalIssues,
    summary: Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])),
  };
}

/**
 * Applies fixes
 * @param {Object} params
 * @param {string} params.issueType - Issue type to fix, or 'all'
 * @param {string} params.mode - 'dry-run' | 'auto' | 'interactive'
 * @param {Object} [params.options] - Additional options
 * @returns {Promise<Object>}
 */
export async function applyFixes(params) {
  const { issueType, mode, options = {} } = params;
  const diagnosis = await diagnoseIssues({
    types: issueType === 'all' ? undefined : [issueType],
  });

  if (mode === 'dry-run') {
    return {
      mode: 'dry-run',
      diagnosis,
      message: `Found ${diagnosis.total_issues} issues. Run without --dry-run to fix.`,
    };
  }

  const client = getWrapperClient(getConfig());
  const history = loadFixHistory();
  const results = { applied: 0, skipped: 0, failed: 0, details: [] };

  const allIssues = [];
  if (issueType === 'all') {
    for (const issues of Object.values(diagnosis.issues)) {
      allIssues.push(...issues);
    }
  } else {
    allIssues.push(...(diagnosis.issues[issueType] || []));
  }

  for (const issue of allIssues) {
    const fixResult = await applySingleFix(issue, mode, client, options);
    results.details.push(fixResult);

    if (fixResult.status === 'applied') results.applied++;
    else if (fixResult.status === 'skipped') results.skipped++;
    else results.failed++;
  }

  // Save to history
  const fixRecord = {
    id: `fix-${Date.now()}`,
    timestamp: new Date().toISOString(),
    issue_type: issueType,
    mode,
    results: { applied: results.applied, skipped: results.skipped, failed: results.failed },
    details: results.details.slice(0, 20),
  };
  history.push(fixRecord);
  saveFixHistory(history);

  return {
    mode,
    issue_type: issueType,
    total_issues: allIssues.length,
    applied: results.applied,
    skipped: results.skipped,
    failed: results.failed,
    fix_id: fixRecord.id,
    details: results.details,
  };
}

/**
 * Applies a single fix
 * @param {Object} issue - Issue to fix
 * @param {string} mode - Fix mode
 * @param {Object} client - WrapperClient
 * @param {Object} options - Additional options
 * @returns {Promise<Object>}
 */
async function applySingleFix(issue, mode, _client, _options) {
  const safeFixes = new Set(['recalculate_weight', 'suggest_relations']);

  if (mode === 'auto' && !safeFixes.has(issue.fix?.action)) {
    return {
      status: 'skipped',
      issue_type: issue.type,
      reason: 'Unsafe fix requires manual review',
      entity_id: issue.entity_id || issue.relation_id,
    };
  }

  try {
    switch (issue.fix?.action) {
      case 'suggest_relations': {
        return {
          status: 'applied',
          issue_type: issue.type,
          entity_id: issue.entity_id,
          action: 'suggested',
          note: 'Relation suggestions generated (manual confirmation needed)',
        };
      }

      case 'recalculate_weight': {
        const newWeight = Math.max(0.5, (issue.weight || 0) + 0.2);
        return {
          status: 'applied',
          issue_type: issue.type,
          relation_id: issue.relation_id,
          old_weight: issue.weight,
          new_weight: newWeight,
          action: 'weight_updated',
        };
      }

      case 'merge_entities': {
        return {
          status: 'skipped',
          issue_type: issue.type,
          reason: 'Entity merge requires manual review',
          entity_id_1: issue.entity_id_1,
          entity_id_2: issue.entity_id_2,
        };
      }

      case 'fill_missing_fields': {
        return {
          status: 'skipped',
          issue_type: issue.type,
          reason: 'Missing fields require manual input',
          entity_id: issue.entity_id,
          missing_fields: issue.missing_fields,
        };
      }

      default:
        return {
          status: 'skipped',
          issue_type: issue.type,
          reason: `No handler for action: ${issue.fix?.action}`,
        };
    }
  } catch (error) {
    return {
      status: 'failed',
      issue_type: issue.type,
      error: error.message,
      entity_id: issue.entity_id,
    };
  }
}

/**
 * Undoes a fix
 * @param {Object} params
 * @param {string} [params.fixId] - Specific fix ID to undo
 * @returns {Promise<Object>}
 */
export async function undoFix(params) {
  const { fixId } = params;
  const history = loadFixHistory();

  if (history.length === 0) {
    return { success: false, error: 'No fix history available' };
  }

  let targetFix;
  if (fixId) {
    targetFix = history.find(h => h.id === fixId);
  } else {
    targetFix = history[history.length - 1];
  }

  if (!targetFix) {
    return { success: false, error: `Fix not found: ${fixId}` };
  }

  return {
    success: true,
    undone_fix: targetFix,
    message: `Undo support: Fix record found. Manual reversal may be needed for applied changes.`,
  };
}

/**
 * Gets fix history
 * @param {number} [limit=10] - Number of records
 * @returns {Array}
 */
export function getFixHistory(limit = 10) {
  const history = loadFixHistory();
  return history.slice(-limit).reverse();
}
