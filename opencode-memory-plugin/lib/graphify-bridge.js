/**
 * Graphify Bridge - Convert graphify's graph.json into our data model
 *
 * Parses graphify output (nodes + links) and produces Entity/Atom/Reference
 * payloads compatible with our backend API.
 *
 * @module graphify-bridge
 */

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { writeLog } from './logger.js';

/** Batch size limit for backend API (max 100 per request) */
const BATCH_SIZE = 100;

function logInfo(category, message, data) {
  writeLog('INFO', category, message, data);
}
function logError(category, message, data) {
  writeLog('ERROR', category, message, data);
}

// ─── Inline Progress Bar ──────────────────────────────────────────
const PB_COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
};
const PB_BAR = '\u2588';
const PB_EMPTY = '\u2591';
const IS_TTY = process.stdout.isTTY;

/**
 * Render an inline progress bar string (for batch loops)
 * @param {object} opts
 * @param {number} opts.current - Items completed so far
 * @param {number} opts.total  - Total items
 * @param {string} opts.label  - Phase label (e.g. "Entities")
 * @param {number} [opts.width] - Bar width in chars
 * @returns {string}
 */
function progressBar({ current, total, label, width = 30 }) {
  const pct = total > 0 ? Math.min(1, Math.max(0, current / total)) : 1;
  const filled = Math.round(pct * width);
  const bar =
    (pct >= 1 ? PB_COLORS.green : pct >= 0.5 ? PB_COLORS.yellow : PB_COLORS.red) +
    PB_BAR.repeat(filled) +
    PB_COLORS.reset +
    PB_COLORS.dim +
    PB_EMPTY.repeat(width - filled) +
    PB_COLORS.reset;
  const pctStr = PB_COLORS.bold + `${Math.round(pct * 100)}%` + PB_COLORS.reset;
  return `${PB_COLORS.cyan}${label}${PB_COLORS.reset} [${bar}] ${pctStr} (${current}/${total})`;
}

function writeProgress(text) {
  if (IS_TTY) {
    process.stdout.write(`\r${text}`);
  }
}

function endProgress(text) {
  if (IS_TTY) {
    process.stdout.write(`\r${text}\n`);
  } else {
    logInfo('GRAPHIFY', text.replace(/\u001b\[[0-9;]*m/g, ''));
  }
}

function logBatchProgress(label, batchNum, totalBatches, extra) {
  if (IS_TTY) {
    writeProgress(progressBar({ current: batchNum, total: totalBatches, label }) + (extra || ''));
  } else if (batchNum === totalBatches || batchNum % 5 === 0) {
    logInfo('GRAPHIFY', `${label} batch ${batchNum}/${totalBatches}${extra || ''}`);
  }
}

const LANG_MAP = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.md': 'markdown',
};

const WEIGHT_MAP = {
  contains_EXTRACTED: 1.0,
  method_EXTRACTED: 0.9,
  imports_EXTRACTED: 0.8,
  imports_from_EXTRACTED: 0.8,
  calls_EXTRACTED: 0.7,
  calls_INFERRED: 0.5,
};

/**
 * Classify nodes into Entity (file-level) and Atom (symbol-level)
 */
export function classifyNodes(nodes) {
  const entityNodes = [];
  const atomNodes = [];
  for (const node of nodes) {
    if (!node.source_location || node.source_location === '' || hasFileExtension(node.label)) {
      entityNodes.push(node);
    } else {
      atomNodes.push(node);
    }
  }
  return { entityNodes, atomNodes };
}

function hasFileExtension(label) {
  return /\.(js|mjs|cjs|ts|tsx|py|go|rs|java|md|json|yaml|yml|toml)$/i.test(label);
}

/**
 * Parse graphify source_location to start_line/end_line
 */
export function parseSourceLocation(loc) {
  if (!loc) return {};
  const rangeMatch = loc.match(/^LL(\d+)-(\d+)$/);
  if (rangeMatch) {
    return { start_line: Number(rangeMatch[1]), end_line: Number(rangeMatch[2]) };
  }
  const lineMatch = loc.match(/^L(\d+)$/);
  if (lineMatch) {
    return { start_line: Number(lineMatch[1]) };
  }
  return {};
}

/**
 * Infer Atom type from label
 */
export function inferAtomType(label) {
  if (label.endsWith('()')) return 'function';
  if (/^[A-Z]/.test(label) && !label.includes('(')) return 'class';
  return 'function';
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return LANG_MAP[ext] || 'unknown';
}

/**
 * Calculate weight from relation + confidence
 */
export function calculateWeight(relation, confidence) {
  const key = `${relation}_${confidence || 'EXTRACTED'}`;
  return WEIGHT_MAP[key] ?? 0.5;
}

/**
 * Concurrent execution with semaphore
 */
export async function runConcurrent(tasks, { concurrency = 10 } = {}) {
  const results = Array.from({ length: tasks.length });
  let index = 0;
  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]();
      } catch (err) {
        results[i] = { error: err.message, index: i };
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Build graphify ID → our ID mapping tables
 */
export function buildIdMaps(entityNodes, atomNodes, entityResults, atomResults) {
  const entityMap = new Map();
  const atomMap = new Map();
  for (let i = 0; i < entityNodes.length; i++) {
    if (entityResults[i] && entityResults[i].id) {
      entityMap.set(entityNodes[i].id, entityResults[i].id);
    }
  }
  for (let i = 0; i < atomNodes.length; i++) {
    if (atomResults[i] && atomResults[i].id) {
      atomMap.set(atomNodes[i].id, atomResults[i].id);
    }
  }
  return { entityMap, atomMap };
}

/**
 * Build source_file → backend entity ID mapping for atom entity_id assignment
 */
export function buildFileToEntityMap(entityNodes, entityResults) {
  const map = new Map();
  for (let i = 0; i < entityNodes.length; i++) {
    const sf = entityNodes[i].source_file;
    const eid = entityResults[i]?.id;
    if (sf && eid) {
      map.set(sf, eid);
    }
  }
  return map;
}

/**
 * Resolve graphify link source/target to our ID
 */
export function resolveId(graphifyId, entityMap, atomMap) {
  return atomMap.get(graphifyId) || entityMap.get(graphifyId) || null;
}

/**
 * Build Entity payload from file-level node
 */
export function buildEntityPayload(node, projectId, tenantId) {
  return {
    type: node.file_type || 'code',
    abstract: `${node.source_file || node.label}`,
    file_path: node.source_file,
    norm_label: node.norm_label || null,
    language: detectLanguage(node.source_file || ''),
    project: projectId,
    tenant_id: tenantId,
    created_by: 'graphify',
    tags: node.community != null ? [`community:${node.community}`] : [],
  };
}

/**
 * Build Atom payload from symbol-level node
 */
export function buildAtomPayload(node, projectId, tenantId, entityBackendId) {
  const name = node.label.replace(/\(\)$/, '');
  const location = parseSourceLocation(node.source_location);
  return {
    type: inferAtomType(node.label),
    name,
    content: '',
    entity_id: entityBackendId || null,
    norm_label: node.norm_label || null,
    start_line: location.start_line,
    end_line: location.end_line || undefined,
    project: projectId,
    tenant_id: tenantId,
    metadata: {
      source_file: node.source_file,
      community: node.community,
      graphify_id: node.id,
    },
  };
}

/**
 * Build Reference payload from link
 */
export function buildReferencePayload(link, fromId, toId, tenantId) {
  const weight = calculateWeight(link.relation, link.confidence);
  const location = parseSourceLocation(link.source_location);
  return {
    from_id: fromId,
    to_id: toId,
    type: link.relation,
    weight,
    confidence: link.confidence || null,
    confidence_score: link.confidence_score || null,
    file_path: link.source_file || null,
    line: location.start_line || null,
    description: `${link.relation}: ${link.source} → ${link.target}`,
    tenant_id: tenantId,
    metadata: {
      context: link.context || null,
      graphify_source: link.source,
      graphify_target: link.target,
    },
  };
}

// ===== Graphify Integration =====

/**
 * Check if graphify Python package is installed
 */
export async function checkGraphifyInstalled() {
  const commands = ['python3', 'python'];
  for (const cmd of commands) {
    try {
      const { stdout } = await execFile(cmd, ['-m', 'graphify', '--version'], {
        timeout: 10000,
      });
      return { installed: true, version: stdout.trim(), command: cmd };
    } catch {
      continue;
    }
  }
  return { installed: false, version: null, command: null };
}

/**
 * Run graphify to generate graph.json
 */
export async function runGraphify(projectPath, command = 'python') {
  try {
    const { stdout, stderr } = await execFile(command, ['-m', 'graphify', 'update', projectPath], {
      timeout: 300000,
      cwd: projectPath,
    });
    const outputPath = path.join(projectPath, 'graphify-out', 'graph.json');
    return { success: true, outputPath, stdout, stderr };
  } catch (err) {
    logError('GRAPHIFY', 'graphify run failed', {
      error: err.message,
      stderr: err.stderr?.toString(),
    });
    return { success: false, outputPath: null, error: err.message, stderr: err.stderr?.toString() };
  }
}

/**
 * Import graph.json from graphify output into the backend
 */
export async function importGraphJSON(options) {
  const { projectPath, projectId, client, tenantId } = options;

  // Step 1: Read and validate graph.json
  const graphPath = path.join(projectPath, 'graphify-out', 'graph.json');
  const raw = await readFile(graphPath, 'utf-8');
  const graph = JSON.parse(raw);

  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
    throw new Error(
      `Invalid graph.json: expected {nodes: Array, links: Array}, got nodes=${typeof graph.nodes}, links=${typeof graph.links}`
    );
  }

  logInfo(
    'GRAPHIFY',
    `Loaded graph.json: ${graph.nodes.length} nodes, ${graph.links.length} links`
  );

  // Step 2: Classify nodes
  const { entityNodes, atomNodes } = classifyNodes(graph.nodes);
  logInfo('GRAPHIFY', `Classified: ${entityNodes.length} entities, ${atomNodes.length} atoms`);

  // Step 3: Clean old data
  if (client.deleteByProject) {
    await client.deleteByProject(projectId, tenantId);
    logInfo('GRAPHIFY', 'Cleared old data for project');
  }

  // Step 4: Batch create Entities
  const entityBatch = entityNodes.map(n => buildEntityPayload(n, projectId, tenantId));
  let totalEntitiesCreated = 0;
  const entityResultList = [];
  const entityTotal = Math.ceil(entityBatch.length / BATCH_SIZE);
  for (let i = 0; i < entityBatch.length; i += BATCH_SIZE) {
    const batch = entityBatch.slice(i, i + BATCH_SIZE);
    const result = await client.batchCreateEntities(batch);
    totalEntitiesCreated += result.created ?? 0;
    entityResultList.push(...(result.entities || result.data || []));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    logBatchProgress('Entities', batchNum, entityTotal);
  }
  endProgress(
    progressBar({ current: entityTotal, total: entityTotal, label: 'Entities' }) +
      ` ${PB_COLORS.green}✓${PB_COLORS.reset} ${totalEntitiesCreated} created`
  );

  // Build source_file → backend entity ID map for atom entity_id
  const fileToEntity = buildFileToEntityMap(entityNodes, entityResultList);

  // Step 5: Batch create Atoms (sequential — backend embedding is the bottleneck)
  const atomBatch = atomNodes.map(n =>
    buildAtomPayload(n, projectId, tenantId, fileToEntity.get(n.source_file))
  );
  const atomBatches = Math.ceil(atomBatch.length / BATCH_SIZE);
  let totalAtomsCreated = 0;
  const atomResultList = [];
  const atomStart = Date.now();
  for (let i = 0; i < atomBatch.length; i += BATCH_SIZE) {
    const batch = atomBatch.slice(i, i + BATCH_SIZE);
    const batchStart = Date.now();
    const result = await client.batchCreateAtoms(batch);
    totalAtomsCreated += result.created ?? 0;
    atomResultList.push(...(result.atoms || result.data || []));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batchMs = Date.now() - batchStart;
    const batchRate = batchMs > 0 ? (batchMs / batch.length).toFixed(0) : '—';
    const totalElapsed = ((Date.now() - atomStart) / 1000).toFixed(1);
    logBatchProgress('Atoms   ', batchNum, atomBatches, ` ${totalElapsed}s ~${batchRate}ms/atom`);
  }
  const atomElapsed = ((Date.now() - atomStart) / 1000).toFixed(1);
  endProgress(
    progressBar({ current: atomBatches, total: atomBatches, label: 'Atoms   ' }) +
      ` ${PB_COLORS.green}✓${PB_COLORS.reset} ${totalAtomsCreated} created in ${atomElapsed}s`
  );

  // Map atom results by index (backend returns same-count array)
  if (atomResultList.length !== atomNodes.length) {
    logError('GRAPHIFY', 'Atom result count mismatch', {
      expected: atomNodes.length,
      got: atomResultList.length,
    });
  }
  const { entityMap, atomMap } = buildIdMaps(
    entityNodes,
    atomNodes,
    entityResultList,
    atomResultList
  );
  logInfo('GRAPHIFY', `ID maps: entityMap=${entityMap.size}, atomMap=${atomMap.size}`);

  // Step 6: Concurrent create References
  const linkTotal = graph.links.length;
  const refStart = Date.now();
  let refDone = 0;
  let refErrors = 0;
  let refSkipped = 0;
  const linkTasks = graph.links.map(link => {
    const fromId = resolveId(link.source, entityMap, atomMap);
    const toId = resolveId(link.target, entityMap, atomMap);
    if (!fromId || !toId)
      return () => {
        refSkipped++;
        refDone++;
        return { skipped: true, link };
      };
    const payload = buildReferencePayload(link, fromId, toId, tenantId);
    return () =>
      client
        .createRelation(payload)
        .then(r => {
          refDone++;
          if (IS_TTY) {
            writeProgress(
              progressBar({ current: refDone, total: linkTotal, label: 'Refs    ' }) +
                ` ${((Date.now() - refStart) / 1000).toFixed(1)}s ${refErrors}err ${refSkipped}skip`
            );
          }
          return r;
        })
        .catch(err => {
          refErrors++;
          refDone++;
          if (IS_TTY) {
            writeProgress(
              progressBar({ current: refDone, total: linkTotal, label: 'Refs    ' }) +
                ` ${((Date.now() - refStart) / 1000).toFixed(1)}s ${refErrors}err ${refSkipped}skip`
            );
          }
          return { error: err.message };
        });
  });

  await runConcurrent(linkTasks, { concurrency: 10 });
  const refElapsed = ((Date.now() - refStart) / 1000).toFixed(1);
  endProgress(
    progressBar({ current: linkTotal, total: linkTotal, label: 'Refs    ' }) +
      ` ${PB_COLORS.green}✓${PB_COLORS.reset} ${linkTotal - refSkipped - refErrors} created in ${refElapsed}s`
  );

  // Step 7: Stats
  const byRelation = {};
  for (const link of graph.links) {
    byRelation[link.relation] = (byRelation[link.relation] || 0) + 1;
  }

  return {
    entities: entityNodes.length,
    atoms: atomNodes.length,
    references: graph.links.length,
    errors: refErrors,
    skipped: refSkipped,
    byRelation,
  };
}

/**
 * Full graphify project workflow: run graphify + import
 */
export async function graphifyProject(options = {}) {
  const { projectPath = process.cwd(), skipGraphify = false } = options;

  if (!skipGraphify) {
    const { installed, version, command } = await checkGraphifyInstalled();
    if (!installed) {
      throw new Error(
        'graphify 未安装。请运行: pip install graphify\n' +
          '文档: https://github.com/safishamsi/graphify'
      );
    }
    logInfo('GRAPHIFY', `graphify v${version} detected (${command})`);

    const { success, error } = await runGraphify(projectPath, command);
    if (!success) {
      throw new Error(`graphify 运行失败: ${error}`);
    }
  }

  const storageModule = await import('./storage.js');
  const getConfig = storageModule.getConfig;
  const wcModule = await import('./wrapper-client.js');
  const WrapperClient = wcModule.WrapperClient;
  const config = getConfig();
  const client = new WrapperClient(config);
  const projectId = config.project?.id || 'unknown';

  return await importGraphJSON({
    projectPath,
    projectId,
    client,
    tenantId: config.backend?.tenant_id || process.env.USERNAME,
  });
}
