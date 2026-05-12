/**
 * Quality Guard - Post-operation quality checks
 *
 * Hooks into memory_write and memory_relate operations to trigger
 * lightweight quality checks (< 100ms).
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { MEMORY_DIR, CONFIG_FILE } from './constants.js';
import { logWarn, logInfo } from './logger.js';
import { getWrapperClient } from './wrapper-client.js';
import { getConfig } from './storage.js';

const QUALITY_GUARD_LOG = path.join(MEMORY_DIR, '.quality-guard.log');

const DEFAULT_CONFIG = {
  enabled: true,
  check_on_write: true,
  check_on_relate: true,
  thresholds: {
    isolated: 5,
    min_weight: 0.3,
    max_weight: 1.0,
  },
  warning_level: 'warning',
  bypassed: false,
};

/**
 * Loads quality guard configuration
 * @returns {Object}
 */
export function loadQualityGuardConfig() {
  try {
    const config = getConfig();
    return { ...DEFAULT_CONFIG, ...config.quality_guard };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Saves quality guard configuration
 * @param {Object} updates - Config updates to merge
 */
export function saveQualityGuardConfig(updates) {
  try {
    const configPath = CONFIG_FILE;
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    config.quality_guard = { ...config.quality_guard, ...updates };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    logWarn('quality-guard', `Failed to save config: ${error.message}`);
  }
}

/**
 * Logs a bypass event
 * @param {string} reason - Reason for bypass
 */
export function logBypass(reason) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      event: 'bypass',
      reason,
    };
    fs.appendFileSync(QUALITY_GUARD_LOG, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Silently fail - logging is non-critical
  }
}

/**
 * Checks if quality guard is enabled
 * @returns {boolean}
 */
export function isQualityGuardEnabled() {
  const config = loadQualityGuardConfig();
  return config.enabled && !config.bypassed;
}

/**
 * Disables quality guard temporarily
 * @param {string} reason - Reason for disabling
 */
export function disableQualityGuard(reason = 'manual') {
  saveQualityGuardConfig({ bypassed: true });
  logBypass(reason);
  logInfo('quality-guard', `Quality guard disabled: ${reason}`);
}

/**
 * Re-enables quality guard
 */
export function enableQualityGuard() {
  saveQualityGuardConfig({ bypassed: false });
  logInfo('quality-guard', 'Quality guard re-enabled');
}

/**
 * Runs quality check after memory_write operation
 * @param {Object} params
 * @param {string} params.entity_id - Written entity ID
 * @param {boolean} [params.skipCheck=false] - Skip if true
 * @returns {Promise<Object>} Check result
 */
export async function checkAfterWrite(params) {
  const { entity_id, skipCheck = false } = params;
  const config = loadQualityGuardConfig();

  if (!config.enabled || !config.check_on_write || skipCheck) {
    return { skipped: true, reason: 'disabled or bypassed' };
  }

  const startTime = Date.now();
  const warnings = [];

  try {
    const client = getWrapperClient(getConfig());

    // Check if entity has relations
    const relations = await client.getRelations({ memory_id: entity_id });
    const relationCount = (relations.relations || []).length;

    if (relationCount === 0) {
      warnings.push({
        level: config.warning_level,
        message: `New entity ${entity_id} has no relations (isolated)`,
        suggestion: `Run: opencode-memory fix isolated-entities`,
        entity_id,
      });
    }

    // Check entity completeness
    const entity = await client.getEntity(entity_id);
    if (entity) {
      if (!entity.abstract) {
        warnings.push({
          level: 'error',
          message: `Entity ${entity_id} is missing abstract`,
          entity_id,
        });
      }
    }

    const duration = Date.now() - startTime;
    return {
      passed: warnings.length === 0,
      warnings,
      duration_ms: duration,
      entity_id,
    };
  } catch (error) {
    return {
      passed: false,
      warnings: [
        {
          level: 'error',
          message: `Quality check failed: ${error.message}`,
        },
      ],
      duration_ms: Date.now() - startTime,
    };
  }
}

/**
 * Runs quality check after memory_relate operation
 * @param {Object} params
 * @param {string} params.from_id - Source entity
 * @param {string} params.to_id - Target entity
 * @param {string} params.relation_type - Relation type
 * @param {number} params.weight - Relation weight
 * @param {boolean} [params.skipCheck=false] - Skip if true
 * @returns {Promise<Object>} Check result
 */
export async function checkAfterRelate(params) {
  const { from_id, to_id, relation_type, weight, skipCheck = false } = params;
  const config = loadQualityGuardConfig();

  if (!config.enabled || !config.check_on_relate || skipCheck) {
    return { skipped: true, reason: 'disabled or bypassed' };
  }

  const startTime = Date.now();
  const warnings = [];

  // Validate weight
  const { min_weight, max_weight } = config.thresholds;
  if (weight < min_weight || weight > max_weight) {
    warnings.push({
      level: 'warning',
      message: `Relation weight ${weight} outside valid range [${min_weight}, ${max_weight}]`,
      suggestion: 'Adjust weight to be within valid range',
      from_id,
      to_id,
    });
  }

  // Validate relation type
  const VALID_TYPES = new Set([
    'depends_on',
    'blocks',
    'calls',
    'imports',
    'implements',
    'relates_to',
    'wiki_link',
    'part_of',
    'related',
    'contains',
  ]);
  if (relation_type && !VALID_TYPES.has(relation_type)) {
    warnings.push({
      level: 'warning',
      message: `Unknown relation type: ${relation_type}`,
      suggestion: `Use one of: ${[...VALID_TYPES].join(', ')}`,
    });
  }

  // Check for duplicate relations
  try {
    const client = getWrapperClient(getConfig());
    const existing = await client.queryReferences({ from_id, to_id, limit: 10 });
    const duplicates = (existing.data || existing.references || []).filter(
      r => r.type === relation_type
    );

    if (duplicates.length > 0) {
      warnings.push({
        level: 'warning',
        message: `Duplicate relation detected: ${from_id} -> ${to_id} (${relation_type})`,
        suggestion: 'Consider removing duplicate or using different type',
      });
    }
  } catch {
    // Skip duplicate check if backend unavailable
  }

  return {
    passed: warnings.length === 0,
    warnings,
    duration_ms: Date.now() - startTime,
  };
}

/**
 * Formats warnings for display
 * @param {Object} result - Check result
 * @returns {string}
 */
export function formatWarnings(result) {
  if (result.skipped) return '';
  if (result.warnings.length === 0) return '';

  const lines = ['\n⚠️  Quality Guard Warnings:'];
  for (const w of result.warnings) {
    const icon = w.level === 'error' ? '🔴' : w.level === 'warning' ? '🟡' : '🔵';
    lines.push(`  ${icon} [${w.level.toUpperCase()}] ${w.message}`);
    if (w.suggestion) lines.push(`     💡 ${w.suggestion}`);
  }
  lines.push(`  (Check completed in ${result.duration_ms}ms)`);
  return lines.join('\n');
}
