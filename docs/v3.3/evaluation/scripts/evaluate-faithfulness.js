#!/usr/bin/env node
/**
 * Faithfulness Evaluation Script
 *
 * Evaluates whether Atom content is faithful to the source Entity,
 * detecting hallucinations without LLM calls.
 *
 * Metrics:
 *   - coverage:    Key term coverage (Atom terms found in Entity content)
 *   - consistency: Atom name/tags consistency with Entity abstract
 *   - link_validity: [[local_id]] references point to existing atoms
 *   - hierarchy:   parent_id validity and heading_level correctness
 *   - overall:     Weighted average (0.3*coverage + 0.2*consistency + 0.3*link_validity + 0.2*hierarchy)
 *
 * Usage:
 *   node evaluate-faithfulness.js <entry_id> [--output report.json]
 */

import {
  getConfig,
  getEntryById,
} from "../../../../opencode-memory-plugin/lib/storage.js";
import { getEntityAtoms } from "../../../../opencode-memory-plugin/lib/memory-core.js";
import fs from "fs";

const STOP_WORDS = new Set([
  "的",
  "了",
  "在",
  "是",
  "我",
  "有",
  "和",
  "就",
  "不",
  "人",
  "都",
  "一",
  "一个",
  "上",
  "也",
  "很",
  "到",
  "说",
  "要",
  "去",
  "你",
  "会",
  "着",
  "没有",
  "看",
  "好",
  "自己",
  "这",
  "他",
  "她",
  "它",
  "们",
  "那",
  "些",
  "么",
  "什么",
  "吗",
  "呢",
  "吧",
  "啊",
  "把",
  "被",
  "从",
  "对",
  "与",
  "而",
  "或",
  "但",
  "如果",
  "因为",
  "所以",
  "可以",
  "这个",
  "那个",
  "之",
  "等",
  "为",
  "以",
  "及",
  "中",
  "用",
  "时",
  "其",
  "能",
  "让",
  "来",
  "地",
  "得",
  "过",
  "还",
  "下",
  "里",
  "后",
  "做",
  "多",
  "没",
  "每个",
  "如何",
]);

const LINK_REGEX = /\[\[([^\]|]+)/g;

function extractTerms(text) {
  if (!text) return new Set();
  const tokens = text
    .replace(/[^\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9_\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return new Set(tokens.map((t) => t.toLowerCase()));
}

function flattenAtoms(atoms, parent = null) {
  const result = [];
  for (const atom of atoms) {
    result.push({ ...atom, _parent: parent });
    if (atom.children && atom.children.length > 0) {
      result.push(...flattenAtoms(atom.children, atom));
    }
  }
  return result;
}

function computeCoverage(flatAtoms, entityContent) {
  if (!entityContent || flatAtoms.length === 0)
    return { score: 0, details: [] };
  const entityTerms = extractTerms(entityContent);
  if (entityTerms.size === 0) return { score: 1, details: [] };

  const details = [];
  let totalMatched = 0;
  let totalChecked = 0;

  for (const atom of flatAtoms) {
    if (!atom.content) continue;
    const atomTerms = extractTerms(atom.content);
    if (atomTerms.size === 0) continue;
    totalChecked++;

    let matched = 0;
    for (const term of atomTerms) {
      if (entityTerms.has(term)) matched++;
    }
    const atomCoverage = matched / atomTerms.size;
    totalMatched += atomCoverage;

    details.push({
      local_id: atom.local_id,
      name: atom.name,
      atom_terms: atomTerms.size,
      matched_terms: matched,
      coverage: Math.round(atomCoverage * 1000) / 1000,
    });
  }

  const score = totalChecked > 0 ? totalMatched / totalChecked : 1;
  return { score: Math.round(score * 1000) / 1000, details };
}

function computeConsistency(flatAtoms, entityAbstract) {
  if (!entityAbstract || flatAtoms.length === 0)
    return { score: 0, details: [] };

  const abstractTerms = extractTerms(entityAbstract);
  if (abstractTerms.size === 0) return { score: 1, details: [] };

  const details = [];
  let totalScore = 0;

  for (const atom of flatAtoms) {
    let matchCount = 0;
    let checkCount = 0;

    if (atom.name) {
      checkCount++;
      const nameTerms = extractTerms(atom.name);
      for (const term of nameTerms) {
        if (abstractTerms.has(term)) matchCount++;
      }
    }

    if (atom.tags && atom.tags.length > 0) {
      checkCount += atom.tags.length;
      for (const tag of atom.tags) {
        const tagTerms = extractTerms(tag);
        for (const term of tagTerms) {
          if (abstractTerms.has(term)) matchCount++;
        }
      }
    }

    const atomScore = checkCount > 0 ? matchCount / checkCount : 0.5;
    totalScore += atomScore;

    details.push({
      local_id: atom.local_id,
      name: atom.name,
      tags: atom.tags || [],
      matched: matchCount,
      checked: checkCount,
      consistency: Math.round(atomScore * 1000) / 1000,
    });
  }

  const score = flatAtoms.length > 0 ? totalScore / flatAtoms.length : 0;
  return { score: Math.round(score * 1000) / 1000, details };
}

function computeLinkValidity(flatAtoms) {
  if (flatAtoms.length === 0) return { score: 1, invalid_links: [] };

  const allIds = new Set(flatAtoms.map((a) => a.local_id));
  const invalidLinks = [];
  let totalLinks = 0;
  let validLinks = 0;

  for (const atom of flatAtoms) {
    if (!atom.content) continue;
    const regex = new RegExp(LINK_REGEX.source, "g");
    let match;
    while ((match = regex.exec(atom.content)) !== null) {
      totalLinks++;
      const targetId = match[1].trim();
      if (allIds.has(targetId)) {
        validLinks++;
      } else {
        invalidLinks.push({
          source: atom.local_id,
          target: targetId,
        });
      }
    }
  }

  if (totalLinks === 0) return { score: 1, invalid_links: [] };
  const score = validLinks / totalLinks;
  return {
    score: Math.round(score * 1000) / 1000,
    invalid_links: invalidLinks,
  };
}

function computeHierarchy(flatAtoms) {
  if (flatAtoms.length === 0) return { score: 1, hierarchy_issues: [] };

  const allIds = new Set(flatAtoms.map((a) => a.local_id));
  const issues = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const atom of flatAtoms) {
    totalChecks++;

    if (atom.parent_id && atom.parent_id !== "null") {
      if (!allIds.has(atom.parent_id)) {
        issues.push({
          local_id: atom.local_id,
          issue: "dangling_parent_id",
          parent_id: atom.parent_id,
        });
      } else {
        passedChecks++;
      }
    } else {
      passedChecks++;
    }

    if (atom.heading_level != null) {
      totalChecks++;
      if (atom.parent_id && atom.parent_id !== "null") {
        const parent = flatAtoms.find((a) => a.local_id === atom.parent_id);
        if (parent && parent.heading_level != null) {
          if (atom.heading_level <= parent.heading_level) {
            issues.push({
              local_id: atom.local_id,
              issue: "heading_level_not_deeper",
              atom_level: atom.heading_level,
              parent_level: parent.heading_level,
            });
          } else {
            passedChecks++;
          }
        } else {
          passedChecks++;
        }
      } else {
        if (atom.heading_level === 1) {
          passedChecks++;
        } else {
          issues.push({
            local_id: atom.local_id,
            issue: "root_not_level_1",
            heading_level: atom.heading_level,
          });
        }
      }
    }
  }

  const score = totalChecks > 0 ? passedChecks / totalChecks : 1;
  return { score: Math.round(score * 1000) / 1000, hierarchy_issues: issues };
}

async function evaluateFaithfulness(entryId, outputPath) {
  const _config = getConfig();
  const entry = getEntryById(entryId);

  if (!entry) {
    console.error(`Error: Entry ${entryId} not found in local storage`);
    process.exit(1);
  }

  const atomResult = await getEntityAtoms({
    entry_id: entryId,
    include_content: true,
  });

  if (
    !atomResult ||
    !atomResult.success ||
    !atomResult.tree ||
    atomResult.total_atoms === 0
  ) {
    console.error(`Error: No atoms found for entry ${entryId}`);
    process.exit(1);
  }

  const flatAtoms = flattenAtoms(atomResult.tree);
  const entityContent = entry.content || "";
  const entityAbstract = entry.abstract || "";

  const coverage = computeCoverage(flatAtoms, entityContent);
  const consistency = computeConsistency(flatAtoms, entityAbstract);
  const linkValidity = computeLinkValidity(flatAtoms);
  const hierarchy = computeHierarchy(flatAtoms);

  const overall =
    0.3 * coverage.score +
    0.2 * consistency.score +
    0.3 * linkValidity.score +
    0.2 * hierarchy.score;

  const report = {
    entry_id: entryId,
    timestamp: new Date().toISOString(),
    metrics: {
      coverage: coverage.score,
      consistency: consistency.score,
      link_validity: linkValidity.score,
      hierarchy: hierarchy.score,
      overall: Math.round(overall * 1000) / 1000,
    },
    details: {
      atoms_checked: flatAtoms.length,
      coverage_details: coverage.details,
      invalid_links: linkValidity.invalid_links,
      hierarchy_issues: hierarchy.hierarchy_issues,
    },
  };

  const json = JSON.stringify(report, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, json, "utf-8");
    console.log(`Report written to ${outputPath}`);
  } else {
    console.log(json);
  }
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.error(
    "Usage: node evaluate-faithfulness.js <entry_id> [--output report.json]",
  );
  console.error("");
  console.error("Evaluate Atom content faithfulness to source Entity.");
  console.error("");
  console.error("Arguments:");
  console.error("  entry_id    ULID of the memory entry to evaluate");
  console.error("");
  console.error("Options:");
  console.error(
    "  --output <path>  Write JSON report to file instead of stdout",
  );
  console.error("  -h, --help       Show this help message");
  process.exit(args.length === 0 ? 1 : 0);
}

const entryId = args[0];
const outputIdx = args.indexOf("--output");
const outputPath =
  outputIdx !== -1 && args[outputIdx + 1] ? args[outputIdx + 1] : null;

evaluateFaithfulness(entryId, outputPath);
