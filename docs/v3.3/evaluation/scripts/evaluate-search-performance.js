#!/usr/bin/env node
/**
 * Search Performance Comparison Script (Atom vs Entity, Multi-Mode)
 *
 * Compares search quality between atom-scope and entity-scope queries
 * across hybrid, keyword, and vector modes.
 * See DESIGN-EVALUATION.md Section 2.1 - Search Performance Comparison
 *
 * Metrics:
 *   - precision@K: Fraction of relevant results in top K
 *   - recall@K: Fraction of all relevant results found in top K
 *   - f1@K: Harmonic mean of precision and recall
 *   - ndcg@K: Normalized Discounted Cumulative Gain
 *   - MRR (Mean Reciprocal Rank): Average reciprocal rank of first relevant result
 *   - response_time_ms: Average query response time
 *
 * Query file format (JSON):
 * {
 *   "queries": [
 *     {
 *       "query": "search text",
 *       "category": "exact|semantic|hybrid|negative|typo|chinese|cross-entity",
 *       "relevant_atom_ids": ["EVALS01", "EVALS02"],
 *       "relevant_entity_ids": ["memory:xxx", "entity:xxx"]
 *     }
 *   ]
 * }
 *
 * Usage:
 *   node evaluate-search-performance.js queries.json
 *   node evaluate-search-performance.js --queries queries.json --top 5
 *
 * Output: JSON comparison report with mode_comparison matrix
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
    // Override tenant_id to match backend test data
    client = getWrapperClient({
      ...config,
      backend: { ...config.backend, tenant_id: "default" },
    });
  }
  return client;
}

async function searchWithScope(query, scope, mode = "hybrid", limit = 10) {
  const c = getClient();
  const thresholds = {
    hybrid: 0.0001, // 降低 threshold 提升召回
    vector: 0.0001,
    keyword: 0.0001,
  };
  const searchParams = {
    query,
    mode,
    limit,
    level: 1, // 改为 level=1 获取 overview
    scope: scope === "atom" ? "atom" : "all",
    threshold: thresholds[mode] ?? 0.001,
  };

  const start = performance.now();
  try {
    const result = await c.search(searchParams);
    const time_ms = performance.now() - start;
    // Preserve both local_id (for atom matching) and id (for entity matching)
    const results = (result.results || []).map((r) => ({
      local_id: r.local_id || null,
      id: r.id || null,
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

function calculatePrecisionAtK(results, relevantIds, k, getId = (r) => r.id) {
  const topK = results.slice(0, k);
  const relevantSet = new Set(relevantIds);
  const hits = topK.filter((r) => relevantSet.has(getId(r))).length;
  return k > 0 ? hits / k : 0;
}

function calculateMRR(results, relevantIds, getId = (r) => r.id) {
  const relevantSet = new Set(relevantIds);
  for (let i = 0; i < results.length; i++) {
    if (relevantSet.has(getId(results[i]))) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

function calculateRecallAtK(results, relevantIds, k, getId = (r) => r.id) {
  const topK = results.slice(0, k);
  const relevantSet = new Set(relevantIds);
  const hits = topK.filter((r) => relevantSet.has(getId(r))).length;
  return relevantIds.length > 0 ? hits / relevantIds.length : 0;
}

function calculateF1AtK(precision, recall) {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function calculateNDCGAtK(results, relevantIds, k, getId = (r) => r.id) {
  const relevantSet = new Set(relevantIds);
  let dcg = 0;
  for (let i = 0; i < Math.min(k, results.length); i++) {
    const rel = relevantSet.has(getId(results[i])) ? 1 : 0;
    dcg += rel / Math.log2(i + 2);
  }
  let idcg = 0;
  const idealRelevant = Math.min(k, relevantIds.length);
  for (let i = 0; i < idealRelevant; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
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

    const modes = ["hybrid", "keyword", "vector"];

    const report = {
      timestamp: new Date().toISOString(),
      config: {
        top_k: topK,
        query_count: queryData.queries.length,
        modes,
        scope: "atom",
      },
      queries: [],
      mode_comparison: {},
    };

    for (const mode of modes) {
      report.mode_comparison[mode] = {
        atom_scope: {
          precision_at_k: [],
          recall_at_k: [],
          f1_at_k: [],
          ndcg_at_k: [],
          mrr: [],
          response_times: [],
        },
      };
    }

    for (const testCase of queryData.queries) {
      const atomRelevantIds =
        testCase.relevant_atom_ids || testCase.relevant_ids || [];

      const queryResult = {
        query: testCase.query,
        category: testCase.category || "unknown",
        modes: {},
      };

      for (const mode of modes) {
        queryResult.modes[mode] = {};

        const relevantIds = atomRelevantIds;
        const results = await searchWithScope(
          testCase.query,
          "atom",
          mode,
          topK,
        );

        const precision = calculatePrecisionAtK(
          results.results,
          relevantIds,
          topK,
          (r) => r.local_id,
        );
        const recall = calculateRecallAtK(
          results.results,
          relevantIds,
          topK,
          (r) => r.local_id,
        );
        const f1 = calculateF1AtK(precision, recall);
        const ndcg = calculateNDCGAtK(
          results.results,
          relevantIds,
          topK,
          (r) => r.local_id,
        );
        const mrr = calculateMRR(
          results.results,
          relevantIds,
          (r) => r.local_id,
        );

        report.mode_comparison[mode].atom_scope.precision_at_k.push(precision);
        report.mode_comparison[mode].atom_scope.recall_at_k.push(recall);
        report.mode_comparison[mode].atom_scope.f1_at_k.push(f1);
        report.mode_comparison[mode].atom_scope.ndcg_at_k.push(ndcg);
        report.mode_comparison[mode].atom_scope.mrr.push(mrr);
        report.mode_comparison[mode].atom_scope.response_times.push(
          results.time_ms,
        );

        queryResult.modes[mode] = {
          precision,
          recall,
          f1,
          ndcg,
          mrr,
          time_ms: results.time_ms,
          result_count: results.results.length,
        };
      }

      report.queries.push(queryResult);
    }

    const avg = (arr) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    report.summary = {};
    for (const mode of modes) {
      const data = report.mode_comparison[mode].atom_scope;
      report.summary[mode] = {
        avg_precision_at_k: Math.round(avg(data.precision_at_k) * 1000) / 1000,
        avg_recall_at_k: Math.round(avg(data.recall_at_k) * 1000) / 1000,
        avg_f1_at_k: Math.round(avg(data.f1_at_k) * 1000) / 1000,
        avg_ndcg_at_k: Math.round(avg(data.ndcg_at_k) * 1000) / 1000,
        avg_mrr: Math.round(avg(data.mrr) * 1000) / 1000,
        avg_response_time_ms: Math.round(avg(data.response_times) * 100) / 100,
      };
    }

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
