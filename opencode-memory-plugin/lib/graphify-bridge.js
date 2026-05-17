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
    logInfo('GRAPHIFY', text.replace(/\x1b\[[0-9;]*m/g, ''));
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

const ATOM_CONCURRENCY = 10;

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
  const payload = {
    type: inferAtomType(node.label),
    name,
    content: '',
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
  if (entityBackendId) {
    payload.entity_id = entityBackendId;
  }
  return payload;
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
  const entityTotal = Math.ceil(entityBatch.length / BATCH_SIZE);
  const fileToEntity = new Map();
  for (let i = 0; i < entityBatch.length; i += BATCH_SIZE) {
    const batch = entityBatch.slice(i, i + BATCH_SIZE);
    const batchNodes = entityNodes.slice(i, i + BATCH_SIZE);
    const result = await client.batchCreateEntities(batch);
    totalEntitiesCreated += result.created ?? 0;
    const entities = result.entities || result.data || [];
    for (let j = 0; j < entities.length; j++) {
      const sf = batchNodes[j]?.source_file;
      const eid = entities[j]?.id;
      if (sf && eid) fileToEntity.set(sf, eid);
    }
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    logBatchProgress('Entities', batchNum, entityTotal);
  }
  endProgress(
    progressBar({ current: entityTotal, total: entityTotal, label: 'Entities' }) +
      ` ${PB_COLORS.green}✓${PB_COLORS.reset} ${totalEntitiesCreated} created`
  );

  // Step 5: Batch create Atoms (with entity_id auto-fallback)
  // Try batch with entity_id first; if backend returns 500 (known bug), retry without.
  const atomBatch = atomNodes.map(n =>
    buildAtomPayload(n, projectId, tenantId, fileToEntity.get(n.source_file))
  );
  const atomBatches = Math.ceil(atomBatch.length / BATCH_SIZE);
  let totalAtomsCreated = 0;
  const atomResultList = [];
  const atomStart = Date.now();
  let entityIdFallback = false;

  // Probe: test if batch API accepts entity_id
  if (atomBatch.length > 0) {
    const probePayloads = atomBatch.slice(0, Math.min(BATCH_SIZE, atomBatch.length));
    try {
      const probeResult = await client.batchCreateAtoms(probePayloads);
      totalAtomsCreated += probeResult.created ?? 0;
      atomResultList.push(...(probeResult.atoms || probeResult.data || []));
      logBatchProgress('Atoms   ', 1, atomBatches, ` ${Date.now() - atomStart}ms probe OK`);
    } catch (err) {
      if (err.statusCode === 500 && err.message?.includes('Entity existence')) {
        logInfo('GRAPHIFY', 'Batch API entity_id bug detected, retrying without entity_id');
        entityIdFallback = true;
        const strippedPayloads = probePayloads.map(({ entity_id: _eid, ...rest }) => rest);
        const retryResult = await client.batchCreateAtoms(strippedPayloads);
        totalAtomsCreated += retryResult.created ?? 0;
        atomResultList.push(...(retryResult.atoms || retryResult.data || []));
        logBatchProgress('Atoms   ', 1, atomBatches, ` ${Date.now() - atomStart}ms probe fallback`);
      } else {
        throw err;
      }
    }
  }

  // Remaining batches
  const startIdx = Math.min(BATCH_SIZE, atomBatch.length);
  for (let i = startIdx; i < atomBatch.length; i += BATCH_SIZE) {
    const batchSlice = atomBatch.slice(i, i + BATCH_SIZE);
    const payloads = entityIdFallback
      ? batchSlice.map(({ entity_id: _eid, ...rest }) => rest)
      : batchSlice;
    const batchStart = Date.now();
    const result = await client.batchCreateAtoms(payloads);
    totalAtomsCreated += result.created ?? 0;
    atomResultList.push(...(result.atoms || result.data || []));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batchMs = Date.now() - batchStart;
    const batchRate = batchMs > 0 ? (batchMs / batchSlice.length).toFixed(0) : '—';
    logBatchProgress(
      'Atoms   ',
      batchNum,
      atomBatches,
      ` ${((Date.now() - atomStart) / 1000).toFixed(1)}s ~${batchRate}ms/a`
    );
  }

  const atomElapsed = ((Date.now() - atomStart) / 1000).toFixed(1);
  endProgress(
    progressBar({ current: atomBatches, total: atomBatches, label: 'Atoms   ' }) +
      ` ${PB_COLORS.green}✓${PB_COLORS.reset} ${totalAtomsCreated} created in ${atomElapsed}s${entityIdFallback ? ' (no entity_id)' : ''}`
  );

  // Build ID maps (index-based: batch API returns same-order results)
  if (atomResultList.length !== atomNodes.length) {
    logError('GRAPHIFY', 'Atom result count mismatch', {
      expected: atomNodes.length,
      got: atomResultList.length,
    });
  }
  const entityMap = new Map();
  for (const [sf, eid] of fileToEntity) {
    const node = entityNodes.find(n => n.source_file === sf);
    if (node) entityMap.set(node.id, eid);
  }
  const atomMap = new Map();
  for (let i = 0; i < atomNodes.length; i++) {
    if (atomResultList[i]?.id) {
      atomMap.set(atomNodes[i].id, atomResultList[i].id);
    }
  }
  logInfo('GRAPHIFY', `ID maps: entityMap=${entityMap.size}, atomMap=${atomMap.size}`);

  // Step 6: Batch create References (with fallback to individual creation)
  const refStart = Date.now();
  let refCreated = 0;
  let refErrors = 0;
  let refSkipped = 0;

  // Build reference payloads (skip unresolvable links)
  const refPayloads = [];
  for (const link of graph.links) {
    const fromId = resolveId(link.source, entityMap, atomMap);
    const toId = resolveId(link.target, entityMap, atomMap);
    if (!fromId || !toId) {
      refSkipped++;
      continue;
    }
    refPayloads.push(buildReferencePayload(link, fromId, toId, tenantId));
  }

  const refBatches = Math.ceil(refPayloads.length / BATCH_SIZE);
  let useBatch = true;

  for (let i = 0; i < refPayloads.length; i += BATCH_SIZE) {
    const batch = refPayloads.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    if (useBatch) {
      try {
        const result = await client.createReferences(batch);
        const created =
          result.references?.filter(r => r.status !== 'error')?.length ?? result.created ?? 0;
        const errors =
          result.references?.filter(r => r.status === 'error')?.length ?? result.errors ?? 0;
        refCreated += created;
        refErrors += errors;
      } catch (err) {
        logInfo('GRAPHIFY', `createReferences batch failed, falling back to individual creation`, {
          error: err.message,
        });
        useBatch = false;
        await runConcurrent(
          batch.map(
            payload => () =>
              client
                .createReference(payload)
                .then(() => {
                  refCreated++;
                })
                .catch(() => {
                  refErrors++;
                })
          ),
          { concurrency: 10 }
        );
      }
    } else {
      // Individual creation mode (after fallback)
      await runConcurrent(
        batch.map(
          payload => () =>
            client
              .createReference(payload)
              .then(() => {
                refCreated++;
              })
              .catch(() => {
                refErrors++;
              })
        ),
        { concurrency: 10 }
      );
    }

    logBatchProgress('Refs    ', batchNum, refBatches);
  }

  const refElapsed = ((Date.now() - refStart) / 1000).toFixed(1);
  endProgress(
    progressBar({ current: refBatches, total: refBatches, label: 'Refs    ' }) +
      ` ${PB_COLORS.green}✓${PB_COLORS.reset} ${refCreated} created, ${refErrors}err, ${refSkipped}skip in ${refElapsed}s`
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

// ===== Incremental Import =====

import crypto from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const CACHE_FILENAME = '.graphify-cache.json';

export function nodeHash(node) {
  const raw = `${node.label}|${node.source_file}|${node.source_location || ''}|${node.file_type || ''}|${node.community ?? ''}|${node.norm_label || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

export function diffGraphs(oldGraph, newGraph) {
  const oldNodeMap = new Map(oldGraph.nodes.map(n => [n.id, n]));
  const newNodeMap = new Map(newGraph.nodes.map(n => [n.id, n]));

  const addedNodes = [];
  const removedNodes = [];
  const changedNodes = [];
  const changedNodeIds = new Set();

  for (const node of newGraph.nodes) {
    const old = oldNodeMap.get(node.id);
    if (!old) {
      addedNodes.push(node);
    } else if (nodeHash(old) !== nodeHash(node)) {
      changedNodes.push({ old, new: node });
      changedNodeIds.add(node.id);
    }
  }

  for (const node of oldGraph.nodes) {
    if (!newNodeMap.has(node.id)) {
      removedNodes.push(node);
    }
  }

  const oldLinkSet = new Set(oldGraph.links.map(l => `${l.source}|${l.target}|${l.relation}`));
  const newLinkSet = new Set(newGraph.links.map(l => `${l.source}|${l.target}|${l.relation}`));

  const addedLinks = newGraph.links.filter(
    l => !oldLinkSet.has(`${l.source}|${l.target}|${l.relation}`)
  );
  const removedLinks = oldGraph.links.filter(
    l => !newLinkSet.has(`${l.source}|${l.target}|${l.relation}`)
  );

  // Links referencing changed nodes need remapping
  const remappableLinks = newGraph.links.filter(
    l => changedNodeIds.has(l.source) || changedNodeIds.has(l.target)
  );

  return {
    addedNodes,
    removedNodes,
    changedNodes,
    changedNodeIds,
    addedLinks,
    removedLinks,
    remappableLinks,
  };
}

export async function loadCache(cachePath) {
  try {
    const raw = await readFile(cachePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveCache(cachePath, graph, backendMaps) {
  const cache = {
    version: 1,
    timestamp: new Date().toISOString(),
    nodes: graph.nodes.map(n => ({ ...n, _hash: nodeHash(n) })),
    links: graph.links,
    backendMaps: {
      entityMap: Object.fromEntries(backendMaps.entityMap),
      atomMap: Object.fromEntries(backendMaps.atomMap),
    },
  };
  await writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
}

async function deleteEntityCascade(client, entityId, _tenantId) {
  try {
    await client.http.delete(`/api/v1/entities/${entityId}`);
    return { deleted: true, method: 'cascade' };
  } catch (err) {
    logError('GRAPHIFY', 'Cascade delete failed, falling back to manual', {
      entityId,
      error: err.message,
    });
    let atomsDeleted = 0;
    let refsDeleted = 0;
    try {
      const atomsRes = await client.http.get(`/api/v1/atoms?entity_id=${entityId}&limit=1000`);
      const atoms = atomsRes.atoms || atomsRes.data || [];
      for (const atom of atoms) {
        try {
          await client.http.delete(`/api/v1/references?atom_id=${atom.id}`);
          refsDeleted++;
        } catch (refErr) {
          logError('GRAPHIFY', 'Ref delete failed', { atomId: atom.id, error: refErr.message });
        }
        try {
          await client.http.delete(`/api/v1/atoms/${atom.id}`);
          atomsDeleted++;
        } catch (atomErr) {
          logError('GRAPHIFY', 'Atom delete failed', { atomId: atom.id, error: atomErr.message });
        }
      }
    } catch (queryErr) {
      logError('GRAPHIFY', 'Atom query failed', { entityId, error: queryErr.message });
    }
    try {
      await client.http.delete(`/api/v1/entities/${entityId}`);
    } catch (entityErr) {
      logError('GRAPHIFY', 'Entity delete failed', { entityId, error: entityErr.message });
    }
    return { deleted: true, method: 'manual', atomsDeleted, refsDeleted };
  }
}

export async function importGraphJSONIncremental(options) {
  const { projectPath, projectId, client, tenantId } = options;
  const cachePath = path.join(projectPath, 'graphify-out', CACHE_FILENAME);

  const graphPath = path.join(projectPath, 'graphify-out', 'graph.json');
  const raw = await readFile(graphPath, 'utf-8');
  const newGraph = JSON.parse(raw);

  if (!Array.isArray(newGraph.nodes) || !Array.isArray(newGraph.links)) {
    throw new Error('Invalid graph.json: expected {nodes: Array, links: Array}');
  }

  const cached = await loadCache(cachePath);
  if (!cached || !cached.nodes || !cached.links) {
    logInfo('GRAPHIFY', 'No valid cache found, falling back to full import');
    const result = await importGraphJSON(options);
    await saveCache(cachePath, newGraph, { entityMap: new Map(), atomMap: new Map() });
    return { ...result, mode: 'full' };
  }

  const oldGraph = { nodes: cached.nodes, links: cached.links };
  const diff = diffGraphs(oldGraph, newGraph);

  const totalChanges = diff.addedNodes.length + diff.removedNodes.length + diff.changedNodes.length;
  if (totalChanges === 0 && diff.addedLinks.length === 0 && diff.removedLinks.length === 0) {
    logInfo('GRAPHIFY', 'No changes detected, skipping import');
    return {
      mode: 'incremental',
      entities: 0,
      atoms: 0,
      references: 0,
      errors: 0,
      skipped: 0,
      byRelation: {},
    };
  }

  logInfo(
    'GRAPHIFY',
    `Incremental diff: +${diff.addedNodes.length} -${diff.removedNodes.length} ~${diff.changedNodes.length} nodes, +${diff.addedLinks.length} -${diff.removedLinks.length} links`
  );

  // Restore backend maps from cache
  const entityMap = new Map(Object.entries(cached.backendMaps?.entityMap || {}));
  const atomMap = new Map(Object.entries(cached.backendMaps?.atomMap || {}));

  // Step 1: Delete removed nodes (cascade)
  const { entityNodes: removedEntities, atomNodes: removedAtoms } = classifyNodes(
    diff.removedNodes
  );
  let deletedCount = 0;

  endProgress(
    `Removals: ${PB_COLORS.red}${removedEntities.length} entities, ${removedAtoms.length} atoms${PB_COLORS.reset}`
  );

  for (const entity of removedEntities) {
    const backendId = entityMap.get(entity.id);
    if (backendId) {
      await deleteEntityCascade(client, backendId, tenantId);
      entityMap.delete(entity.id);
      deletedCount++;
    }
  }

  for (const atom of removedAtoms) {
    const backendId = atomMap.get(atom.id);
    if (backendId) {
      try {
        await client.http.delete(`/api/v1/atoms/${backendId}`);
      } catch {
        /* already deleted via entity cascade */
      }
      atomMap.delete(atom.id);
      deletedCount++;
    }
  }

  // Step 2: Delete old versions of changed nodes, then recreate
  const changedOldNodes = diff.changedNodes.map(c => c.old);
  const changedNewNodes = diff.changedNodes.map(c => c.new);
  const { entityNodes: changedEntities, atomNodes: changedAtoms } = classifyNodes(changedOldNodes);
  const { entityNodes: changedNewEntities, atomNodes: changedNewAtoms } =
    classifyNodes(changedNewNodes);

  // Delete old changed entities/atoms
  for (const entity of changedEntities) {
    const backendId = entityMap.get(entity.id);
    if (backendId) {
      await deleteEntityCascade(client, backendId, tenantId);
      entityMap.delete(entity.id);
    }
  }
  for (const atom of changedAtoms) {
    const backendId = atomMap.get(atom.id);
    if (backendId) {
      try {
        await client.http.delete(`/api/v1/atoms/${backendId}`);
      } catch {
        /* cascade */
      }
      atomMap.delete(atom.id);
    }
  }

  // Step 3: Create added + changed nodes
  const allNewEntityNodes = [
    ...diff.addedNodes.filter(
      n => hasFileExtension(n.label) || !n.source_location || n.source_location === ''
    ),
    ...changedNewEntities,
  ];
  const allNewAtomNodes = [
    ...diff.addedNodes.filter(
      n => n.source_location && n.source_location !== '' && !hasFileExtension(n.label)
    ),
    ...changedNewAtoms,
  ];

  // Create added+changed entities
  let newEntitiesCreated = 0;
  const entityBatch = allNewEntityNodes.map(n => buildEntityPayload(n, projectId, tenantId));
  const entityBatches = Math.ceil(entityBatch.length / BATCH_SIZE);
  const newEntityResults = [];

  for (let i = 0; i < entityBatch.length; i += BATCH_SIZE) {
    const batch = entityBatch.slice(i, i + BATCH_SIZE);
    const result = await client.batchCreateEntities(batch);
    newEntitiesCreated += result.created ?? 0;
    newEntityResults.push(...(result.entities || result.data || []));
    logBatchProgress('Inc Ents', Math.floor(i / BATCH_SIZE) + 1, entityBatches);
  }
  if (entityBatches > 0) {
    endProgress(`Inc Ents ${PB_COLORS.green}✓${PB_COLORS.reset} ${newEntitiesCreated} created`);
  }

  // Update entityMap with new entity IDs
  const fileToEntity = buildFileToEntityMap(allNewEntityNodes, newEntityResults);
  for (let i = 0; i < allNewEntityNodes.length; i++) {
    if (newEntityResults[i]?.id) {
      entityMap.set(allNewEntityNodes[i].id, newEntityResults[i].id);
    }
  }

  // Create added+changed atoms (single creation with entity_id)
  let newAtomsCreated = 0;
  const atomPayloads = allNewAtomNodes.map(n =>
    buildAtomPayload(n, projectId, tenantId, fileToEntity.get(n.source_file))
  );
  const newAtomResults = [];

  if (atomPayloads.length > 0) {
    const incAtomTasks = atomPayloads.map(
      (payload, idx) => () =>
        client
          .createAtom(payload)
          .then(result => {
            newAtomsCreated++;
            result._graphify_id = allNewAtomNodes[idx].id;
            return result;
          })
          .catch(err => {
            logError('GRAPHIFY', 'Inc atom creation failed', {
              name: payload.name,
              error: err.message,
            });
            return { error: err.message, _graphify_id: allNewAtomNodes[idx].id };
          })
    );

    const incAtomResults = await runConcurrent(incAtomTasks, { concurrency: ATOM_CONCURRENCY });
    for (const r of incAtomResults) {
      if (r && !r.error) newAtomResults.push(r);
    }
    endProgress(`Inc Atoms ${PB_COLORS.green}✓${PB_COLORS.reset} ${newAtomsCreated} created`);
  }

  // Update atomMap with new atom IDs
  for (const r of newAtomResults) {
    if (r._graphify_id && r.id) {
      atomMap.set(r._graphify_id, r.id);
    }
  }

  // Step 4: Delete removed links, then create added/remapped links
  let refCreated = 0;
  let refErrors = 0;

  for (const link of diff.removedLinks) {
    const fromId = resolveId(link.source, entityMap, atomMap);
    const toId = resolveId(link.target, entityMap, atomMap);
    if (fromId && toId) {
      try {
        await client.http.delete(
          `/api/v1/references?from_id=${fromId}&to_id=${toId}&type=${link.relation}`
        );
      } catch {
        /* reference may not exist */
      }
    }
  }

  const allRefLinks = [...diff.addedLinks, ...diff.remappableLinks];

  const refPayloads = [];
  for (const link of allRefLinks) {
    const fromId = resolveId(link.source, entityMap, atomMap);
    const toId = resolveId(link.target, entityMap, atomMap);
    if (fromId && toId) {
      refPayloads.push(buildReferencePayload(link, fromId, toId, tenantId));
    }
  }

  const refBatches = Math.ceil(refPayloads.length / BATCH_SIZE);
  let useBatch = true;

  for (let i = 0; i < refPayloads.length; i += BATCH_SIZE) {
    const batch = refPayloads.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    if (useBatch) {
      try {
        const result = await client.createReferences(batch);
        refCreated +=
          result.references?.filter(r => r.status !== 'error')?.length ?? result.created ?? 0;
        refErrors +=
          result.references?.filter(r => r.status === 'error')?.length ?? result.errors ?? 0;
      } catch {
        useBatch = false;
        await runConcurrent(
          batch.map(
            p => () =>
              client
                .createReference(p)
                .then(() => {
                  refCreated++;
                })
                .catch(() => {
                  refErrors++;
                })
          ),
          { concurrency: 10 }
        );
      }
    } else {
      await runConcurrent(
        batch.map(
          p => () =>
            client
              .createReference(p)
              .then(() => {
                refCreated++;
              })
              .catch(() => {
                refErrors++;
              })
        ),
        { concurrency: 10 }
      );
    }
    logBatchProgress('Inc Refs', batchNum, refBatches);
  }
  if (refBatches > 0) {
    endProgress(
      `Inc Refs ${PB_COLORS.green}✓${PB_COLORS.reset} ${refCreated} created, ${refErrors}err`
    );
  }

  // Save updated cache
  await saveCache(cachePath, newGraph, { entityMap, atomMap });

  const byRelation = {};
  for (const link of allRefLinks) {
    byRelation[link.relation] = (byRelation[link.relation] || 0) + 1;
  }

  return {
    mode: 'incremental',
    entities: newEntitiesCreated,
    atoms: newAtomsCreated,
    references: refCreated,
    errors: refErrors,
    skipped: 0,
    deleted: deletedCount,
    byRelation,
  };
}

/**
 * Full graphify project workflow: run graphify + import
 *
 * @param {object} options
 * @param {string} [options.projectPath] - Project directory
 * @param {boolean} [options.skipGraphify] - Skip running graphify
 * @param {'incremental'|'full'} [options.mode] - Import mode (default: 'incremental')
 */
export async function graphifyProject(options = {}) {
  const { projectPath = process.cwd(), skipGraphify = false, mode = 'incremental' } = options;

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
  const tenantId = config.backend?.tenant_id || process.env.USERNAME;
  const importOpts = { projectPath, projectId, client, tenantId };

  if (mode === 'full') {
    logInfo('GRAPHIFY', 'Full import mode (forced)');
    const result = await importGraphJSON(importOpts);
    return { ...result, mode: 'full' };
  }

  return await importGraphJSONIncremental(importOpts);
}
