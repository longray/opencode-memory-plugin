#!/usr/bin/env node
/**
 * Search Performance Comparison Script (Atom vs Entity)
 *
 * Compares search quality between atom-scope and entity-scope queries.
 * See DESIGN-EVALUATION.md Section 2.1 - Search Performance Comparison
 *
 * Metrics:
 *   - precision@K: Fraction of relevant results in top K
 *   - MRR (Mean Reciprocal Rank): Average reciprocal rank of first relevant result
 *   - response_time_ms: Average query response time
 *
 * Query file format (JSON):
 * {
 *   "queries": [
 *     {
 *       "query": "search text",
 *       "relevant_ids": ["01HQ...", "01HR..."]
 *     }
 *   ]
 * }
 *
 * Usage:
 *   node evaluate-search-performance.js queries.json
 *   node evaluate-search-performance.js --queries queries.json --top 5
 *
 * Output: JSON comparison report
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getConfig } from "../../../../opencode-memory-plugin/lib/storage.js";
import { getWrapperClient } from "../../../../opencode-memory-plugin/lib/wrapper-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let client = null;

function getClient() {
  if (!client) {
    const config = getConfig();
    client = getWrapperClient(config);
  }
  return client;
}

async function searchWithScope(query, scope, limit = 10) {
  const c = getClient();
  const searchParams = {
    query,
    mode: "hybrid",
    limit,
    level: 0,
    scope: scope === "atom" ? "atom" : "all",
  };

  const start = performance.now();
  try {
    const result = await c.search(searchParams);
    const time_ms = performance.now() - start;
    const results = (result.results || []).map((r) => ({
      id: r.local_id || r.id,
      entity_id: r.entity_id || null,
      type: r.type || "general",
      atom_type: r.atom_type || null,
      score: r.score || 0,
    }));
    return { results, time_ms };
  } catch (error) {
    const time_ms = performance.now() - start;
    console.error(
      `Warning: search failed for "${query}" (scope=${scope}): ${error.message}`,
    );
    return { results: [], time_ms };
  }
}

function calculatePrecisionAtK(results, relevantIds, k) {
  // DESIGN-EVALUATION.md §2.1: precision@K = |relevant ∩ topK| / K
  const topK = results.slice(0, k);
  const relevantSet = new Set(relevantIds);
  const hits = topK.filter((r) => relevantSet.has(r.id)).length;
  return k > 0 ? hits / k : 0;
}

function calculateMRR(results, relevantIds) {
  // DESIGN-EVALUATION.md §2.1: MRR = mean(1/rank_i) for first relevant result
  const relevantSet = new Set(relevantIds);
  for (let i = 0; i < results.length; i++) {
    if (relevantSet.has(results[i].id)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function parseArgs(argv) {
  const args = { queryFile: null, top: 5, output: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--queries" || argv[i] === "-q") {
      args.queryFile = argv[++i];
    } else if (argv[i] === "--top" || argv[i] === "-k") {
      args.top = parseInt(argv[++i], 10);
    } else if (argv[i] === "--output" || argv[i] === "-o") {
      args.output = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    } else if (!args.queryFile) {
      args.queryFile = argv[i];
    }
  }
  return args;
}

async function evaluateSearchPerformance(
  queryFile,
  topK = 5,
  outputFile = null,
) {
  try {
    const filePath = resolve(__dirname, queryFile);
    const queryData = JSON.parse(readFileSync(filePath, "utf-8"));

    if (!queryData.queries || !Array.isArray(queryData.queries)) {
      console.error('Error: Query file must contain a "queries" array');
      process.exit(1);
    }

    const report = {
      timestamp: new Date().toISOString(),
      config: { top_k: topK, query_count: queryData.queries.length },
      atom_scope: { precision_at_k: [], mrr: [], response_times: [] },
      entity_scope: { precision_at_k: [], mrr: [], response_times: [] },
    };

    for (const testCase of queryData.queries) {
      // DESIGN-EVALUATION.md §2.1: Run each query in both scopes
      const atomResults = await searchWithScope(testCase.query, "atom", topK);
      const entityResults = await searchWithScope(
        testCase.query,
        "entity",
        topK,
      );

      const relevantIds = testCase.relevant_ids || [];

      report.atom_scope.precision_at_k.push(
        calculatePrecisionAtK(atomResults.results, relevantIds, topK),
      );
      report.atom_scope.mrr.push(
        calculateMRR(atomResults.results, relevantIds),
      );
      report.atom_scope.response_times.push(atomResults.time_ms);

      report.entity_scope.precision_at_k.push(
        calculatePrecisionAtK(entityResults.results, relevantIds, topK),
      );
      report.entity_scope.mrr.push(
        calculateMRR(entityResults.results, relevantIds),
      );
      report.entity_scope.response_times.push(entityResults.time_ms);
    }

    // Aggregate results
    const avg = (arr) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    report.summary = {
      atom_scope: {
        avg_precision_at_k:
          Math.round(avg(report.atom_scope.precision_at_k) * 1000) / 1000,
        avg_mrr: Math.round(avg(report.atom_scope.mrr) * 1000) / 1000,
        avg_response_time_ms:
          Math.round(avg(report.atom_scope.response_times) * 100) / 100,
      },
      entity_scope: {
        avg_precision_at_k:
          Math.round(avg(report.entity_scope.precision_at_k) * 1000) / 1000,
        avg_mrr: Math.round(avg(report.entity_scope.mrr) * 1000) / 1000,
        avg_response_time_ms:
          Math.round(avg(report.entity_scope.response_times) * 100) / 100,
      },
    };

    // TODO: Add statistical significance testing (t-test or Wilcoxon)
    const reportJson = JSON.stringify(report, null, 2);
    console.log(reportJson);
    if (outputFile) {
      const outPath = resolve(__dirname, outputFile);
      writeFileSync(outPath, reportJson, "utf-8");
      console.error(`Report saved to ${outPath}`);
    }
  } catch (error) {
    console.error(`Error evaluating search performance: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point
const args = parseArgs(process.argv);

if (args.help || !args.queryFile) {
  console.error(
    "Usage: node evaluate-search-performance.js [options] <queryFile>",
  );
  console.error("");
  console.error("Compare search performance between atom and entity scopes.");
  console.error("");
  console.error("Arguments:");
  console.error("  queryFile    Path to JSON file containing test queries");
  console.error("");
  console.error("Options:");
  console.error(
    "  -q, --queries <file>  Query file path (positional also works)",
  );
  console.error(
    "  -k, --top <n>         Top-K for precision calculation (default: 5)",
  );
  console.error("  -o, --output <file>   Save report to file (JSON)");
  console.error("  -h, --help             Show this help message");
  console.error("");
  console.error("Query file format:");
  console.error('  { "queries": [');
  console.error('      { "query": "text", "relevant_ids": ["id1", "id2"] }');
  console.error("  ] }");
  process.exit(args.help ? 0 : 1);
}

evaluateSearchPerformance(args.queryFile, args.top, args.output);
