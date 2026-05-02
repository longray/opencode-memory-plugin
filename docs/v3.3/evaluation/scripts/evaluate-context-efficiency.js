#!/usr/bin/env node
/**
 * Context Efficiency Measurement Script
 *
 * Measures token usage when loading memory via atom vs entity mode.
 * See DESIGN-EVALUATION.md Section 2.1 - Context Efficiency
 *
 * Metrics:
 *   - entity_tokens: Token count for full entity load (level=2)
 *   - atom_tokens: Token count for targeted atom load (level=2, specific atoms)
 *   - savings_percent: ((entity - atom) / entity) * 100
 *
 * Usage:
 *   node evaluate-context-efficiency.js <entryId> [mode]
 *   node evaluate-context-efficiency.js 01HQABCDEF atom
 *   node evaluate-context-efficiency.js 01HQABCDEF entity
 *   node evaluate-context-efficiency.js 01HQABCDEF compare
 *
 * Output: Token usage comparison report (JSON)
 */

import { getEntryById } from "../../../../opencode-memory-plugin/lib/storage.js";
import { getEntityAtoms } from "../../../../opencode-memory-plugin/lib/memory-core.js";

// Simple token estimator (~4 chars per token for English, ~2 for CJK)
function estimateTokens(text) {
  if (!text) return 0;
  // DESIGN-EVALUATION.md §2.1: Use consistent tokenizer for fair comparison
  // TODO: Replace with actual tokenizer (tiktoken or similar) if available
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) > 0x2fff ? 0.5 : 0.25;
  }
  return Math.ceil(tokens);
}

async function measureEntityMode(entryId) {
  const entry = getEntryById(entryId);
  if (!entry) {
    console.error(`Warning: Entry ${entryId} not found`);
    return {
      mode: "entity",
      entry_id: entryId,
      tokens: 0,
      bytes: 0,
      atom_count: 0,
    };
  }
  const fullText = [entry.abstract, entry.overview, entry.content]
    .filter(Boolean)
    .join("\n");
  const atomsText = entry.atoms
    ? flattenAtomTree(entry.atoms)
        .map((a) => [a.name, a.content].filter(Boolean).join("\n"))
        .join("\n")
    : "";
  const allText = [fullText, atomsText].filter(Boolean).join("\n");
  const tokens = estimateTokens(allText);
  const totalAtoms = entry.atoms ? flattenAtomTree(entry.atoms).length : 0;
  return {
    mode: "entity",
    entry_id: entryId,
    tokens,
    bytes: JSON.stringify(entry).length,
    atom_count: totalAtoms,
  };
}

function flattenAtomTree(nodes) {
  const flat = [];
  for (const node of nodes) {
    flat.push(node);
    if (node.children && node.children.length > 0) {
      flat.push(...flattenAtomTree(node.children));
    }
  }
  return flat;
}

async function measureAtomMode(entryId) {
  const result = await getEntityAtoms({
    entry_id: entryId,
    include_content: true,
  });
  if (!result.success || !result.tree || result.total_atoms === 0) {
    console.error(
      `Warning: No atoms for ${entryId}, falling back to entity mode`,
    );
    const entityResult = await measureEntityMode(entryId);
    return { ...entityResult, mode: "atom", fallback: "entity" };
  }
  const atoms = flattenAtomTree(result.tree);
  const allText = atoms
    .map((a) => [a.name, a.content].filter(Boolean).join("\n"))
    .join("\n");
  const tokens = estimateTokens(allText);
  return {
    mode: "atom",
    entry_id: entryId,
    tokens,
    bytes: JSON.stringify(result.tree).length,
    atom_count: result.total_atoms,
    breakdown: countByType(atoms),
  };
}

function countByType(atoms) {
  const map = {};
  for (const a of atoms) {
    const t = a.type || "unknown";
    if (!map[t]) map[t] = { count: 0, tokens: 0 };
    map[t].count++;
    map[t].tokens += estimateTokens(
      [a.name, a.content].filter(Boolean).join("\n"),
    );
  }
  return map;
}

function parseArgs(argv) {
  const args = { entryId: null, mode: "compare", help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--mode" || argv[i] === "-m") {
      args.mode = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    } else if (!args.entryId) {
      args.entryId = argv[i];
    } else if (!args.mode || args.mode === "compare") {
      args.mode = argv[i];
    }
  }
  return args;
}

async function measureContextEfficiency(entryId, mode = "compare") {
  try {
    const report = {
      entry_id: entryId,
      timestamp: new Date().toISOString(),
    };

    if (mode === "entity" || mode === "compare") {
      report.entity = await measureEntityMode(entryId);
    }

    if (mode === "atom" || mode === "compare") {
      report.atom = await measureAtomMode(entryId);
    }

    // Calculate savings when both modes available
    if (report.entity && report.atom) {
      const entityTokens = report.entity.tokens;
      const atomTokens = report.atom.tokens;
      report.comparison = {
        entity_tokens: entityTokens,
        atom_tokens: atomTokens,
        savings_tokens: entityTokens - atomTokens,
        savings_percent:
          entityTokens > 0
            ? Math.round(((entityTokens - atomTokens) / entityTokens) * 10000) /
              100
            : 0,
      };
    }

    if (report.atom?.breakdown) {
      report.atom.breakdown_summary = Object.entries(report.atom.breakdown).map(
        ([type, info]) => ({ type, count: info.count, tokens: info.tokens }),
      );
    }
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(`Error measuring context efficiency: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point
const args = parseArgs(process.argv);

if (args.help || !args.entryId) {
  console.error(
    "Usage: node evaluate-context-efficiency.js [options] <entryId> [mode]",
  );
  console.error("");
  console.error("Measure token usage for atom vs entity loading modes.");
  console.error("");
  console.error("Arguments:");
  console.error("  entryId    ULID of the memory entry to measure");
  console.error("  mode       atom | entity | compare (default: compare)");
  console.error("");
  console.error("Options:");
  console.error("  -m, --mode <mode>  Loading mode: atom, entity, or compare");
  console.error("  -h, --help          Show this help message");
  console.error("");
  console.error("Examples:");
  console.error("  node evaluate-context-efficiency.js 01HQABCDEF compare");
  console.error("  node evaluate-context-efficiency.js 01HQABCDEF atom");
  console.error("  node evaluate-context-efficiency.js -m entity 01HQABCDEF");
  process.exit(args.help ? 0 : 1);
}

if (!["atom", "entity", "compare"].includes(args.mode)) {
  console.error(
    `Error: Invalid mode "${args.mode}". Must be: atom, entity, or compare`,
  );
  process.exit(1);
}

measureContextEfficiency(args.entryId, args.mode);
