/**
 * SOP Engine - Standard Operating Procedure loading and execution
 *
 * Loads SOP definitions from YAML files, validates structure,
 * executes steps sequentially with progress display and report generation.
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { MEMORY_DIR } from './constants.js';
import { logWarn } from './logger.js';
import { getWrapperClient } from './wrapper-client.js';
import { getConfig } from './storage.js';

const SOPS_DIR = path.join(MEMORY_DIR, '..', '..', '.opencode', 'sops');
const REPORTS_DIR = path.join(MEMORY_DIR, '..', '..', '.opencode', 'sop-reports');

function ensureDirs() {
  if (!fs.existsSync(SOPS_DIR)) fs.mkdirSync(SOPS_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Simple YAML parser (handles basic SOP format without external deps)
 * @param {string} content - YAML content
 * @returns {Object}
 */
function parseYaml(content) {
  const result = {};
  let currentKey = null;
  let inSteps = false;
  let currentStep = null;

  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Top-level key
    if (!line.startsWith(' ') && !line.startsWith('\t') && trimmed.includes(':')) {
      const key = trimmed.slice(0, trimmed.indexOf(':')).trim();
      const value = trimmed
        .slice(trimmed.indexOf(':') + 1)
        .trim()
        .replace(/^["']|["']$/g, '');

      if (key === 'steps') {
        result.steps = [];
        inSteps = true;
        currentKey = null;
      } else if (key === 'parameters') {
        result.parameters = {};
        currentKey = 'parameters';
        inSteps = false;
      } else {
        result[key] = value;
        currentKey = key;
        inSteps = false;
      }
      continue;
    }

    if (inSteps) {
      // Step item start (- name: ...)
      if (trimmed.startsWith('- ') && trimmed.includes(':')) {
        currentStep = {};
        result.steps.push(currentStep);
        const [k, ...vParts] = trimmed.slice(2).split(':');
        currentStep[k.trim()] = vParts
          .join(':')
          .trim()
          .replace(/^["']|["']$/g, '');
        continue;
      }
      // Step property
      if (currentStep && trimmed.includes(':') && !trimmed.startsWith('-')) {
        const [k, ...vParts] = trimmed.split(':');
        const val = vParts
          .join(':')
          .trim()
          .replace(/^["']|["']$/g, '');
        currentStep[k.trim()] = val;
        continue;
      }
    }

    if (currentKey === 'parameters' && trimmed.includes(':')) {
      const [k, ...vParts] = trimmed.split(':');
      let val = vParts
        .join(':')
        .trim()
        .replace(/^["']|["']$/g, '');
      // Try to parse as number
      if (!isNaN(val) && val !== '') val = Number(val);
      result.parameters[k.trim()] = val;
      continue;
    }

    // Simple key: value (only for non-steps, non-parameters sections)
    if (
      !inSteps &&
      currentKey &&
      currentKey !== 'parameters' &&
      trimmed.includes(':') &&
      !trimmed.startsWith('-') &&
      !line.startsWith(' ')
    ) {
      const parts = trimmed.split(':');
      const v = parts
        .slice(1)
        .join(':')
        .trim()
        .replace(/^["']|["']$/g, '');
      result[currentKey] = v;
    }
  }

  return result;
}

/**
 * Loads an SOP definition from YAML file
 * @param {string} name - SOP name (without .yaml extension)
 * @returns {Object|null} SOP definition or null
 */
export function loadSOP(name) {
  ensureDirs();
  const filePath = path.join(SOPS_DIR, `${name}.yaml`);

  if (!fs.existsSync(filePath)) {
    logWarn('sop-engine', `SOP not found: ${filePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sop = parseYaml(content);

    // Validate required fields
    if (!sop.name || !sop.description || !sop.steps) {
      logWarn('sop-engine', `Invalid SOP structure: missing name/description/steps`);
      return null;
    }

    sop._filePath = filePath;
    return sop;
  } catch (error) {
    logWarn('sop-engine', `Failed to load SOP: ${error.message}`);
    return null;
  }
}

/**
 * Lists all available SOPs
 * @param {string} [category] - Filter by category
 * @returns {Array<{name: string, description: string, category: string, last_run: string|null}>}
 */
export function listSOPs(category) {
  ensureDirs();
  if (!fs.existsSync(SOPS_DIR)) return [];

  const sops = [];
  const files = fs.readdirSync(SOPS_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of files) {
    const name = file.replace(/\.(yaml|yml)$/, '');
    const sop = loadSOP(name);
    if (sop) {
      if (category && sop.category !== category) continue;
      sops.push({
        name: sop.name,
        description: sop.description,
        category: sop.category || 'general',
        last_run: getLastRunTime(name),
      });
    }
  }

  return sops.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Shows SOP details
 * @param {string} name - SOP name
 * @returns {Object|null}
 */
export function showSOP(name) {
  const sop = loadSOP(name);
  if (!sop) return null;
  return sop;
}

/**
 * Executes an SOP
 * @param {Object} params
 * @param {string} params.name - SOP name
 * @param {Object} [params.overrides] - Parameter overrides
 * @param {boolean} [params.dryRun=false] - Preview mode
 * @param {string} [params.step] - Execute specific step only
 * @param {string} [params.stepRange] - Execute step range (e.g., "1-3")
 * @param {string[]} [params.skip] - Steps to skip
 * @param {boolean} [params.listSteps=false] - List steps without executing
 * @returns {Promise<Object>} Execution result
 */
export async function executeSOP(params) {
  const {
    name,
    overrides = {},
    dryRun = false,
    step,
    stepRange,
    skip = [],
    listSteps = false,
  } = params;

  const sop = loadSOP(name);
  if (!sop) {
    return { success: false, error: `SOP "${name}" not found` };
  }

  if (listSteps) {
    return {
      success: true,
      steps: sop.steps.map((s, i) => ({
        index: i + 1,
        name: s.name || s.action,
        description: s.description || '',
      })),
    };
  }

  // Merge parameters
  const mergedParams = { ...sop.parameters, ...overrides };

  // Filter steps
  let stepsToRun = [...sop.steps];
  if (step) {
    stepsToRun = stepsToRun.filter(s => (s.name || s.action) === step);
  }
  if (stepRange) {
    const [start, end] = stepRange.split('-').map(Number);
    stepsToRun = stepsToRun.slice(start - 1, end);
  }
  if (skip.length > 0) {
    stepsToRun = stepsToRun.filter(s => !skip.includes(s.name || s.action));
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      sop: sop.name,
      stepsToRun: stepsToRun.length,
      steps: stepsToRun.map(s => ({
        name: s.name || s.action,
        description: s.description || '',
        action: s.action,
      })),
      parameters: mergedParams,
    };
  }

  // Execute steps
  const startTime = Date.now();
  const results = [];
  const client = getWrapperClient(getConfig());

  for (const stepDef of stepsToRun) {
    const stepResult = await executeStep(stepDef, mergedParams, client);
    results.push(stepResult);

    if (stepResult.status === 'failed' && stepDef.on_failure !== 'continue') {
      break;
    }
  }

  const duration = Date.now() - startTime;
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  // Save report
  const report = generateReport(sop, results, duration, mergedParams);
  saveReport(name, report);

  return {
    success: failedCount === 0,
    sop: sop.name,
    steps_executed: results.length,
    success_count: successCount,
    failed_count: failedCount,
    duration_ms: duration,
    results,
    report_path: report.path,
  };
}

/**
 * Executes a single SOP step
 * @param {Object} stepDef - Step definition
 * @param {Object} params - Merged parameters
 * @param {Object} client - WrapperClient instance
 * @returns {Promise<Object>}
 */
async function executeStep(stepDef, params, client) {
  const action = stepDef.action || stepDef.name;
  const startTime = Date.now();

  try {
    switch (action) {
      case 'detect_isolated_entities': {
        const refs = await client.queryReferences({ limit: 100 });
        const refEntities = new Set();
        for (const r of refs.data || refs.references || []) {
          if (r.from_id) refEntities.add(r.from_id);
          if (r.to_id) refEntities.add(r.to_id);
        }
        const entities = await client.listEntities({ limit: 100 });
        const isolated = (entities.data || entities.entities || []).filter(
          e => e.id && !refEntities.has(e.id)
        );
        return {
          status: 'success',
          action,
          duration_ms: Date.now() - startTime,
          affected_count: isolated.length,
          affected_ids: isolated.slice(0, 20).map(e => e.id),
        };
      }

      case 'detect_low_weight_relations': {
        const threshold = params.threshold || 0.5;
        const refs = await client.queryReferences({ limit: 100 });
        const lowWeight = (refs.data || refs.references || []).filter(r => r.weight < threshold);
        return {
          status: 'success',
          action,
          duration_ms: Date.now() - startTime,
          affected_count: lowWeight.length,
          affected_ids: lowWeight.slice(0, 20).map(r => r.id),
        };
      }

      case 'detect_missing_relations': {
        const entities = await client.listEntities({ limit: 100 });
        const entityList = entities.data || entities.entities || [];
        const suggestions = [];
        for (const entity of entityList.slice(0, 50)) {
          const rels = await client.getRelations({ memory_id: entity.id });
          if ((rels.relations || []).length === 0) {
            suggestions.push({ entity_id: entity.id, reason: 'no relations' });
          }
        }
        return {
          status: 'success',
          action,
          duration_ms: Date.now() - startTime,
          affected_count: suggestions.length,
          suggestions: suggestions.slice(0, 10),
        };
      }

      case 'detect_duplicates': {
        const entities = await client.listEntities({ limit: 100 });
        const entityList = entities.data || entities.entities || [];
        const duplicates = [];
        for (let i = 0; i < entityList.length; i++) {
          for (let j = i + 1; j < entityList.length; j++) {
            const a = entityList[i];
            const b = entityList[j];
            if (a.abstract && b.abstract && a.abstract === b.abstract) {
              duplicates.push({ id1: a.id, id2: b.id, similarity: 1.0 });
            }
          }
        }
        return {
          status: 'success',
          action,
          duration_ms: Date.now() - startTime,
          affected_count: duplicates.length,
          duplicates: duplicates.slice(0, 10),
        };
      }

      case 'verify_quality': {
        const status = await client.getStatus();
        return {
          status: 'success',
          action,
          duration_ms: Date.now() - startTime,
          metrics: {
            entity_count: status.memory_count || 0,
            relation_count: status.relation_count || 0,
          },
        };
      }

      default:
        return {
          status: 'success',
          action,
          duration_ms: Date.now() - startTime,
          note: `Custom action "${action}" - no built-in handler`,
        };
    }
  } catch (error) {
    return {
      status: 'failed',
      action,
      duration_ms: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Generates an execution report
 * @param {Object} sop - SOP definition
 * @param {Array} results - Step results
 * @param {number} duration - Total duration in ms
 * @param {Object} params - Parameters used
 * @returns {Object}
 */
function generateReport(sop, results, duration, params) {
  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  const lines = [
    `# SOP Execution Report: ${sop.name}`,
    ``,
    `**Date**: ${new Date().toISOString()}`,
    `**Duration**: ${duration}ms`,
    `**Steps**: ${results.length} executed, ${successCount} success, ${failedCount} failed`,
    `**Parameters**: ${JSON.stringify(params)}`,
    ``,
    `## Step Results`,
    ``,
  ];

  for (const r of results) {
    lines.push(`### ${r.action}`);
    lines.push(`- Status: ${r.status}`);
    lines.push(`- Duration: ${r.duration_ms}ms`);
    if (r.affected_count !== undefined) lines.push(`- Affected: ${r.affected_count}`);
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push('');
  }

  return {
    content: lines.join('\n'),
    path: null,
  };
}

/**
 * Saves execution report to file
 * @param {string} sopName - SOP name
 * @param {Object} report - Report object
 */
function saveReport(sopName, report) {
  ensureDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(REPORTS_DIR, `${sopName}-${timestamp}.md`);
  fs.writeFileSync(filePath, report.content, 'utf-8');
  report.path = filePath;
}

/**
 * Gets last run time for an SOP
 * @param {string} name - SOP name
 * @returns {string|null}
 */
function getLastRunTime(name) {
  ensureDirs();
  if (!fs.existsSync(REPORTS_DIR)) return null;

  const files = fs
    .readdirSync(REPORTS_DIR)
    .filter(f => f.startsWith(name) && f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  // Extract timestamp from filename
  const match = files[0].match(/-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
  if (match) {
    return match[1].replace(/-/g, (m, i) =>
      i === 4 || i === 7 ? '-' : i === 10 ? 'T' : i === 13 || i === 16 ? ':' : m
    );
  }
  return null;
}
