/**
 * Graphify Bridge - Convert graphify's graph.json into our data model
 *
 * Parses graphify output (nodes + links) and produces Entity/Atom/Reference
 * payloads compatible with our backend API.
 *
 * @module graphify-bridge
 */

import path from 'node:path';

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
    if (!node.source_location || node.source_location === '') {
      entityNodes.push(node);
    } else {
      atomNodes.push(node);
    }
  }
  return { entityNodes, atomNodes };
}

/**
 * Parse graphify source_location to start_line/end_line
 * "L206" → { start_line: 206 }
 * "LL206-230" → { start_line: 206, end_line: 230 }
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
 * "foo()" → "function", "MyClass" → "class", default → "function"
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
export function buildAtomPayload(node, projectId, tenantId) {
  const name = node.label.replace(/\(\)$/, '');
  const location = parseSourceLocation(node.source_location);
  return {
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

// Stubs for later tasks
export async function checkGraphifyInstalled() {
  throw new Error('Not implemented');
}
export async function runGraphify() {
  throw new Error('Not implemented');
}
export async function importGraphJSON() {
  throw new Error('Not implemented');
}
export async function graphifyProject() {
  throw new Error('Not implemented');
}
