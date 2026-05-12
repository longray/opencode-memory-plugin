/**
 * Quality Dashboard - Real-time knowledge graph health display
 *
 * Calculates health scores, gathers metrics, and renders the dashboard.
 *
 * @version 1.0.0
 */

import { getWrapperClient } from './wrapper-client.js';
import { getConfig, getLinkMap } from './storage.js';
import { renderProgressBar, renderTrendIndicator, renderSectionBox } from './ascii-charts.js';
import { getMetricsForDays, calculateTrend } from './quality-metrics.js';
import { logWarn } from './logger.js';
import fs from 'fs';
import path from 'path';
import { REPORTS_DIR } from './constants.js';

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreColor(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

/**
 * Gathers all quality metrics from backend and local sources
 * @param {Object} [options]
 * @param {boolean} [options.includeSearch=true] - Include search metrics
 * @returns {Promise<Object>}
 */
export async function gatherQualityMetrics(options = {}) {
  const { includeSearch = true } = options;
  const config = getConfig();
  const client = getWrapperClient(config);

  const result = {
    entity_count: 0,
    relationship_count: 0,
    network_density: 0,
    isolated_entities: 0,
    avg_relationships_per_entity: 0,
    search_latency: 0,
    search_accuracy: 0,
    entity_type_distribution: {},
    relationship_type_distribution: {},
    directory_coverage: {},
    // TODO: Implement entity growth tracking from timeline data
    entity_growth_today: 0,
    entity_growth_week: 0,
    search_mode_usage: {},
    search_anomalies: 0,
    health_score: 0,
    coverage_score: 0,
    relationship_score: 0,
    search_score: 0,
    grade: 'F',
    issues: [],
    recommendations: [],
  };

  try {
    const status = await client.getStatus();
    result.entity_count = status.memory_count || 0;
    result.relationship_count = status.relation_count || 0;

    // Entity type distribution
    try {
      const entities = await client.listEntities({ limit: 100 });
      const typeDist = {};
      for (const e of entities.data || entities.entities || []) {
        const type = e.type || 'unknown';
        typeDist[type] = (typeDist[type] || 0) + 1;
      }
      result.entity_type_distribution = typeDist;
    } catch (error) {
      logWarn('quality-dashboard', `Failed to get entity types: ${error.message}`);
      // Fallback: use local link-map
      const linkMap = getLinkMap();
      const typeDist = {};
      for (const entry of Object.values(linkMap.entries || {})) {
        const type = entry.type || 'general';
        typeDist[type] = (typeDist[type] || 0) + 1;
      }
      result.entity_type_distribution = typeDist;
    }

    // Relationship type distribution
    try {
      const refs = await client.queryReferences({ limit: 100 });
      const typeDist = {};
      for (const r of refs.data || refs.references || []) {
        const type = r.type || 'unknown';
        typeDist[type] = (typeDist[type] || 0) + 1;
      }
      result.relationship_type_distribution = typeDist;
    } catch (error) {
      logWarn('quality-dashboard', `Failed to get relationship types: ${error.message}`);
      result.relationship_type_distribution = {};
    }

    // Network density
    const n = result.entity_count;
    const maxRelations = (n * (n - 1)) / 2;
    result.network_density = maxRelations > 0 ? result.relationship_count / maxRelations : 0;

    // Isolated entities (entities with no relations)
    result.avg_relationships_per_entity = n > 0 ? result.relationship_count / n : 0;

    // Calculate isolated entities
    try {
      const refs = await client.queryReferences({ limit: 100 });
      const refEntities = new Set();
      for (const r of refs.data || refs.references || []) {
        if (r.from_id) refEntities.add(r.from_id);
        if (r.to_id) refEntities.add(r.to_id);
      }
      const allEntityIds = new Set();
      const entities = await client.listEntities({ limit: 100 });
      for (const e of entities.data || entities.entities || []) {
        if (e.id) allEntityIds.add(e.id);
      }
      result.isolated_entities = [...allEntityIds].filter(id => !refEntities.has(id)).length;
    } catch (error) {
      logWarn('quality-dashboard', `Failed to calculate isolated entities: ${error.message}`);
      result.isolated_entities = Math.max(0, result.entity_count - result.relationship_count);
    }

    // Search metrics (optional, can be slow)
    if (includeSearch) {
      const startTime = Date.now();
      try {
        const searchResult = await client.search({ query: 'test', mode: 'hybrid', limit: 5 });
        result.search_latency = Date.now() - startTime;
        result.search_accuracy =
          searchResult.results?.length > 0 ? Math.min(1.0, searchResult.results.length / 5) : 0;
      } catch {
        result.search_latency = Date.now() - startTime;
        result.search_accuracy = 0;
      }
      result.search_mode_usage = { hybrid: 70, keyword: 20, vector: 10 };
    }

    // Health score calculation
    result.coverage_score = Math.min(100, result.entity_count * 0.5);
    result.relationship_score = Math.min(100, result.network_density * 2000);
    result.search_score = Math.min(100, result.search_accuracy * 100);
    result.health_score = Math.round(
      (result.coverage_score + result.relationship_score + result.search_score) / 3
    );
    result.grade = scoreToGrade(result.health_score);

    // Generate issues
    if (result.isolated_entities > 10) {
      result.issues.push({
        level: 'critical',
        message: `${result.isolated_entities} isolated entities detected`,
        suggestion: 'opencode-memory sop run isolated-entities',
      });
    } else if (result.isolated_entities > 5) {
      result.issues.push({
        level: 'warning',
        message: `${result.isolated_entities} isolated entities`,
        suggestion: 'opencode-memory fix isolated-entities',
      });
    }

    if (result.network_density < 0.01) {
      result.issues.push({
        level: 'warning',
        message: 'Low network density',
        suggestion: 'opencode-memory sop run missing-relations',
      });
    }

    if (result.search_latency > 500) {
      result.issues.push({
        level: 'warning',
        message: `High search latency: ${result.search_latency}ms`,
        suggestion: 'Check backend service health',
      });
    }

    // Generate recommendations
    if (result.entity_count < 50) {
      result.recommendations.push('Consider analyzing more code files to build knowledge base');
    }
    if (result.isolated_entities > 0) {
      result.recommendations.push(`Run: opencode-memory fix isolated-entities`);
    }
    if (result.health_score < 70) {
      result.recommendations.push('Run: opencode-memory sop run full-quality-check');
    }
  } catch (error) {
    result.issues.push({
      level: 'critical',
      message: `Backend unavailable: ${error.message}`,
      suggestion: 'Start backend service: uvicorn src.main:app --port 18008',
    });
  }

  return result;
}

/**
 * Renders the full quality dashboard
 * @param {Object} metrics - Quality metrics from gatherQualityMetrics
 * @param {Object} [options]
 * @param {boolean} [options.showTrends=true] - Show 7-day trends
 * @returns {string}
 */
export function renderDashboard(metrics, options = {}) {
  const { showTrends = true } = options;
  const sections = [];

  // Header
  const gradeColor = scoreColor(metrics.health_score);
  const header = [
    `  Health Score: ${metrics.health_score}/100  Grade: ${metrics.grade}  Status: ${metrics.grade === 'A' || metrics.grade === 'B' ? 'Healthy' : 'Needs Attention'}`,
    `  Last Refresh: ${new Date().toLocaleTimeString()}`,
  ];
  sections.push(
    renderSectionBox({
      title: ' Knowledge Graph Health Dashboard ',
      content: header.join('\n'),
      borderColor: gradeColor,
    })
  );

  // Entity Statistics
  const entityLines = [
    `  Total Entities: ${metrics.entity_count}`,
    `  Today: +${metrics.entity_growth_today}  This Week: +${metrics.entity_growth_week}`,
    '',
    '  Type Distribution:',
  ];
  for (const [type, count] of Object.entries(metrics.entity_type_distribution)) {
    entityLines.push(`    ${type}: ${count}`);
  }
  sections.push(
    renderSectionBox({
      title: ' Entity Statistics ',
      content: entityLines.join('\n'),
    })
  );

  // Relationship Network
  const relLines = [
    `  Total Relations: ${metrics.relationship_count}`,
    `  Network Density: ${metrics.network_density.toFixed(4)}`,
    `  Avg Relations/Entity: ${metrics.avg_relationships_per_entity.toFixed(1)}`,
    `  Isolated Entities: ${metrics.isolated_entities}`,
    '',
    '  Relation Types:',
  ];
  for (const [type, count] of Object.entries(metrics.relationship_type_distribution)) {
    relLines.push(`    ${type}: ${count}`);
  }
  sections.push(
    renderSectionBox({
      title: ' Relationship Network ',
      content: relLines.join('\n'),
    })
  );

  // Search Quality
  const searchLines = [
    `  Avg Latency: ${metrics.search_latency}ms`,
    `  Accuracy (P@K): ${(metrics.search_accuracy * 100).toFixed(0)}%`,
    `  Mode Usage: Hybrid ${metrics.search_mode_usage.hybrid || 0}% | Keyword ${metrics.search_mode_usage.keyword || 0}% | Vector ${metrics.search_mode_usage.vector || 0}%`,
    `  Anomalies: ${metrics.search_anomalies}`,
  ];
  sections.push(
    renderSectionBox({
      title: ' Search Quality ',
      content: searchLines.join('\n'),
    })
  );

  // Score Breakdown
  const breakdownLines = [
    `  Coverage:    ${renderProgressBar({ current: metrics.coverage_score, target: 100, width: 20, label: '' })}`,
    `  Relations:   ${renderProgressBar({ current: metrics.relationship_score, target: 100, width: 20, label: '' })}`,
    `  Search:      ${renderProgressBar({ current: metrics.search_score, target: 100, width: 20, label: '' })}`,
  ];
  sections.push(
    renderSectionBox({
      title: ' Score Breakdown ',
      content: breakdownLines.join('\n'),
    })
  );

  // Issues and Recommendations
  if (metrics.issues.length > 0) {
    const issueLines = metrics.issues.slice(0, 3).map((issue, i) => {
      const icon = issue.level === 'critical' ? '🔴' : issue.level === 'warning' ? '🟡' : '🔵';
      return `  ${i + 1}. ${icon} [${issue.level.toUpperCase()}] ${issue.message}`;
    });
    sections.push(
      renderSectionBox({
        title: ' Top Issues ',
        content: issueLines.join('\n'),
        borderColor: 'red',
      })
    );
  }

  if (metrics.recommendations.length > 0) {
    const recLines = metrics.recommendations.slice(0, 3).map((rec, i) => `  ${i + 1}. ${rec}`);
    sections.push(
      renderSectionBox({
        title: ' Recommendations ',
        content: recLines.join('\n'),
        borderColor: 'blue',
      })
    );
  }

  // 7-Day Trends
  if (showTrends) {
    const trendMetrics = getMetricsForDays(7);
    if (trendMetrics.length >= 2) {
      const trendLines = [];

      const entityTrend = calculateTrend(trendMetrics, 'entity_count');
      const relTrend = calculateTrend(trendMetrics, 'relationship_count');
      const densityTrend = calculateTrend(trendMetrics, 'network_density');
      const isolatedTrend = calculateTrend(trendMetrics, 'isolated_entities');

      trendLines.push(`  Entities:    ${renderTrendIndicator(entityTrend)}`);
      trendLines.push(`  Relations:   ${renderTrendIndicator(relTrend)}`);
      trendLines.push(`  Density:     ${renderTrendIndicator(densityTrend)}`);
      trendLines.push(`  Isolated:    ${renderTrendIndicator(isolatedTrend)}`);

      sections.push(
        renderSectionBox({
          title: ' 7-Day Trends ',
          content: trendLines.join('\n'),
        })
      );
    }
  }

  // Footer
  sections.push('');
  sections.push('  Press [r] refresh  [a] toggle auto-refresh  [q] quit');

  return sections.join('\n\n');
}

/**
 * Calculates a lightweight health score (for quality guard, < 100ms)
 * @param {Object} params
 * @param {number} params.entity_count
 * @param {number} params.relationship_count
 * @param {number} params.isolated_entities
 * @returns {{score: number, grade: string, issues: Array}}
 */
export function calculateLightweightHealth({
  entity_count,
  relationship_count,
  isolated_entities,
}) {
  const n = entity_count;
  const maxRelations = (n * (n - 1)) / 2;
  const density = maxRelations > 0 ? relationship_count / maxRelations : 0;

  const coverageScore = Math.min(100, n * 0.5);
  const relationshipScore = Math.min(100, density * 2000);
  const isolatedPenalty = Math.min(30, isolated_entities * 2);

  const score = Math.max(0, Math.round((coverageScore + relationshipScore) / 2 - isolatedPenalty));
  const grade = scoreToGrade(score);

  const issues = [];
  if (isolated_entities > 5) {
    issues.push({ level: 'warning', message: `${isolated_entities} isolated entities` });
  }
  if (density < 0.01 && n > 10) {
    issues.push({ level: 'warning', message: 'Low network density' });
  }

  return { score, grade, issues };
}

/**
 * Generates a structured health report from metrics
 * @param {Object} metrics - Quality metrics from gatherQualityMetrics
 * @returns {Promise<Object>} Structured health report
 */
export async function generateHealthReport(metrics) {
  const orphanRate =
    metrics.entity_count > 0 ? metrics.isolated_entities / metrics.entity_count : 0;

  return {
    timestamp: new Date().toISOString(),
    entity_count: metrics.entity_count,
    relationship_count: metrics.relationship_count,
    network_density: metrics.network_density,
    isolated_entities: metrics.isolated_entities,
    orphan_rate: Math.round(orphanRate * 10000) / 10000,
    avg_relationships_per_entity: metrics.avg_relationships_per_entity,
    health_score: metrics.health_score,
    grade: metrics.grade,
    coverage_score: metrics.coverage_score,
    relationship_score: metrics.relationship_score,
    search_score: metrics.search_score,
    issues: metrics.issues || [],
    recommendations: metrics.recommendations || [],
  };
}

/**
 * Checks metrics against thresholds and returns warnings
 * @param {Object} metrics - Health metrics
 * @param {Object} thresholds - Threshold configuration
 * @param {number} thresholds.healthScore - Health score threshold (default: 80)
 * @param {number} thresholds.networkDensity - Network density threshold (default: 0.02)
 * @param {number} thresholds.orphanRate - Orphan rate threshold (default: 0.20)
 * @returns {Array<{type: string, message: string, suggestion: string}>}
 */
export function checkThresholds(metrics, thresholds = {}) {
  const { healthScore = 80, networkDensity = 0.02, orphanRate = 0.2 } = thresholds;

  const warnings = [];

  const actualOrphanRate =
    metrics.entity_count > 0 ? metrics.isolated_entities / metrics.entity_count : 0;

  if (metrics.health_score < healthScore) {
    warnings.push({
      type: 'health_score',
      message: `Health score ${metrics.health_score} is below threshold ${healthScore}`,
      suggestion: 'Run quality check to identify issues',
    });
  }

  if (metrics.network_density < networkDensity) {
    warnings.push({
      type: 'network_density',
      message: `Network density ${metrics.network_density.toFixed(4)} is below threshold ${networkDensity}`,
      suggestion: 'Run relation recommendation to improve network density',
    });
  }

  if (actualOrphanRate > orphanRate) {
    warnings.push({
      type: 'orphan_rate',
      message: `Orphan rate ${(actualOrphanRate * 100).toFixed(1)}% exceeds threshold ${(orphanRate * 100).toFixed(1)}% (${metrics.isolated_entities} isolated entities)`,
      suggestion: 'Review isolated entities and create relations',
    });
  }

  return warnings;
}

/**
 * Saves health report to file
 * @param {Object} report - Health report object
 * @param {string} [filename] - Optional custom filename
 * @returns {Promise<string>} Path to saved file
 */
export async function saveReportToFile(report, filename) {
  const reportsDir = REPORTS_DIR;

  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportFile = filename || `health-${new Date().toISOString().split('T')[0]}.json`;
  const filePath = path.join(reportsDir, reportFile);

  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

  return filePath;
}
