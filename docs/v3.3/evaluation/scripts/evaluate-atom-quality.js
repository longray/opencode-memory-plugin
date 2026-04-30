#!/usr/bin/env node
/**
 * Atom Tree Quality Analysis Script
 *
 * Evaluates structural quality of Atom trees for a given memory entry.
 * See DESIGN-EVALUATION.md Section 2.1 - Atom Quality Metrics
 *
 * Metrics:
 *   - avg_depth: Average depth of all atoms in the tree
 *   - content_std: Standard deviation of content lengths
 *   - link_density: Ratio of [[local_id]] links per atom
 *   - orphan_rate: Percentage of atoms with no children and no parent links
 *
 * Usage:
 *   node evaluate-atom-quality.js <entryId>
 *   node evaluate-atom-quality.js 01HQABCDEF1234567890ABCDEF
 *
 * Output: JSON report to stdout
 */

import { getEntityAtoms } from '../../../opencode-memory-plugin/lib/memory-core.js';
import { getConfig } from '../../../opencode-memory-plugin/lib/storage.js';

function calculateAvgDepth(atoms, depth = 0) {
  // DESIGN-EVALUATION.md §2.1: avg_depth = mean(depth_i) for all atoms
  // TODO: Implement recursive depth calculation
  if (!atoms || atoms.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const atom of atoms) {
    total += depth;
    count++;
    if (atom.children && atom.children.length > 0) {
      const childResult = calculateAvgDepth(atom.children, depth + 1);
      total += childResult.total;
      count += childResult.count;
    }
  }
  return { avg: count > 0 ? total / count : 0, total, count };
}

function calculateContentStd(atoms) {
  // DESIGN-EVALUATION.md §2.1: content_std = stddev(len(content_i))
  // TODO: Flatten atom tree, collect content lengths, compute stddev
  const lengths = [];
  function collect(atom) {
    if (atom.content) lengths.push(atom.content.length);
    if (atom.children) atom.children.forEach(collect);
  }
  if (atoms) atoms.forEach(collect);
  if (lengths.length === 0) return 0;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  return Math.sqrt(variance);
}

function calculateLinkDensity(atoms) {
  // DESIGN-EVALUATION.md §2.1: link_density = count([[local_id]]) / total_atoms
  // TODO: Count [[...]] patterns across all atom content
  const linkRegex = /\[\[[\w|]+\]\]/g;
  let linkCount = 0;
  let atomCount = 0;
  function collect(atom) {
    atomCount++;
    if (atom.content) {
      const matches = atom.content.match(linkRegex);
      if (matches) linkCount += matches.length;
    }
    if (atom.children) atom.children.forEach(collect);
  }
  if (atoms) atoms.forEach(collect);
  return atomCount > 0 ? linkCount / atomCount : 0;
}

function calculateOrphanRate(atoms) {
  // DESIGN-EVALUATION.md §2.1: orphan_rate = atoms with no links / total_atoms
  // TODO: Identify atoms that have no [[local_id]] references from other atoms
  const linkRegex = /\[\[([^\]|]+)/g;
  const referencedIds = new Set();
  const allIds = new Set();
  function collect(atom) {
    allIds.add(atom.local_id);
    if (atom.content) {
      let match;
      while ((match = linkRegex.exec(atom.content)) !== null) {
        referencedIds.add(match[1].trim());
      }
    }
    if (atom.children) atom.children.forEach(collect);
  }
  if (atoms) atoms.forEach(collect);
  if (allIds.size === 0) return 0;
  const orphanCount = [...allIds].filter(id => !referencedIds.has(id)).length;
  return orphanCount / allIds.size;
}

async function evaluateAtomQuality(entryId) {
  try {
    const config = await getConfig();
    const result = await getEntityAtoms(entryId, { include_content: true });

    if (!result || !result.atoms) {
      console.error(`Error: No atoms found for entry ${entryId}`);
      process.exit(1);
    }

    const depthResult = calculateAvgDepth(result.atoms);
    const report = {
      entry_id: entryId,
      timestamp: new Date().toISOString(),
      metrics: {
        avg_depth: Math.round(depthResult.avg * 100) / 100,
        total_atoms: depthResult.count,
        content_std: Math.round(calculateContentStd(result.atoms) * 100) / 100,
        link_density: Math.round(calculateLinkDensity(result.atoms) * 1000) / 1000,
        orphan_rate: Math.round(calculateOrphanRate(result.atoms) * 1000) / 1000,
      },
    };

    // TODO: Add quality scoring based on thresholds in DESIGN-EVALUATION.md
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`Error evaluating atom quality: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point
const entryId = process.argv[2];
if (!entryId || process.argv.includes('--help') || process.argv.includes('-h')) {
  console.error('Usage: node evaluate-atom-quality.js <entryId>');
  console.error('');
  console.error('Evaluate structural quality of an Atom tree.');
  console.error('');
  console.error('Arguments:');
  console.error('  entryId    ULID of the memory entry to evaluate');
  console.error('');
  console.error('Options:');
  console.error('  -h, --help  Show this help message');
  process.exit(entryId ? 0 : 1);
}

evaluateAtomQuality(entryId);
