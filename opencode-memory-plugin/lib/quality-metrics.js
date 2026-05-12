/**
 * Quality Metrics - Daily quality metrics collection and storage
 *
 * Collects, stores, and retrieves quality metrics for trend analysis.
 * Stores metrics in `.opencode/quality-metrics.json`.
 *
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { MEMORY_DIR } from './constants.js';
import { logWarn, logInfo } from './logger.js';

const QUALITY_METRICS_FILE = path.join(MEMORY_DIR, 'quality-metrics.json');

/**
 * Default quality targets
 */
export const QUALITY_TARGETS = {
  entity_count: { target: 200, direction: 'higher' },
  relationship_count: { target: 300, direction: 'higher' },
  network_density: { target: 0.05, direction: 'higher' },
  isolated_entities: { target: 0, direction: 'lower' },
  search_latency: { target: 200, direction: 'lower' },
  search_accuracy: { target: 0.9, direction: 'higher' },
  health_score: { target: 85, direction: 'higher' },
};

/**
 * Loads quality metrics from storage
 * @returns {{metrics: Array, last_updated: string|null}}
 */
export function loadQualityMetrics() {
  try {
    if (!fs.existsSync(QUALITY_METRICS_FILE)) {
      return { metrics: [], last_updated: null };
    }
    const data = JSON.parse(fs.readFileSync(QUALITY_METRICS_FILE, 'utf-8'));
    return {
      metrics: data.metrics || [],
      last_updated: data.last_updated || null,
    };
  } catch (error) {
    logWarn('quality-metrics', `Failed to load metrics: ${error.message}`);
    return { metrics: [], last_updated: null };
  }
}

/**
 * Saves quality metrics to storage
 * @param {Array} metrics - Array of metric snapshots
 */
export function saveQualityMetrics(metrics) {
  try {
    const data = {
      metrics,
      last_updated: new Date().toISOString(),
      version: '1.0.0',
    };
    fs.writeFileSync(QUALITY_METRICS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    logInfo('quality-metrics', `Saved ${metrics.length} metric snapshots`);
  } catch (error) {
    logWarn('quality-metrics', `Failed to save metrics: ${error.message}`);
  }
}

/**
 * Records a daily quality metric snapshot
 * @param {Object} snapshot - Metric values
 * @param {number} snapshot.entity_count - Total entity count
 * @param {number} snapshot.relationship_count - Total relationship count
 * @param {number} snapshot.network_density - Network density
 * @param {number} snapshot.isolated_entities - Isolated entity count
 * @param {number} snapshot.search_latency - Average search latency (ms)
 * @param {number} snapshot.search_accuracy - Search precision@K
 * @param {number} snapshot.health_score - Overall health score (0-100)
 * @param {Object} [snapshot.entity_type_distribution] - Entity type counts
 * @param {Object} [snapshot.relationship_type_distribution] - Relationship type counts
 * @param {number} [snapshot.avg_relationships_per_entity] - Average relations per entity
 * @returns {boolean} Success status
 */
export function recordDailyMetrics(snapshot) {
  const { metrics } = loadQualityMetrics();

  // Check if today's entry already exists, update if so
  const today = new Date().toISOString().split('T')[0];
  const existingIndex = metrics.findIndex(m => m.timestamp && m.timestamp.startsWith(today));

  const entry = {
    timestamp: new Date().toISOString(),
    ...snapshot,
  };

  if (existingIndex >= 0) {
    metrics[existingIndex] = entry;
  } else {
    metrics.push(entry);
  }

  // Keep only last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString();
  const filtered = metrics.filter(m => m.timestamp >= cutoffStr);

  saveQualityMetrics(filtered);
  return true;
}

/**
 * Gets metrics for the last N days
 * @param {number} days - Number of days to retrieve
 * @returns {Array} Metric snapshots
 */
export function getMetricsForDays(days = 7) {
  const { metrics } = loadQualityMetrics();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  return metrics
    .filter(m => m.timestamp >= cutoffStr)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Gets metrics within a date range
 * @param {string} from - Start date (ISO or YYYY-MM-DD)
 * @param {string} to - End date (ISO or YYYY-MM-DD)
 * @returns {Array} Metric snapshots
 */
export function getMetricsByRange(from, to) {
  const { metrics } = loadQualityMetrics();
  return metrics
    .filter(m => m.timestamp >= from && m.timestamp <= to)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Calculates trend for a specific metric
 * @param {Array} metrics - Metric snapshots
 * @param {string} metricName - Metric field name
 * @returns {{direction: string, change: number, changePercent: number, values: Array}}
 */
export function calculateTrend(metrics, metricName) {
  if (metrics.length < 2) {
    return { direction: '→', change: 0, changePercent: 0, values: [] };
  }

  const values = metrics.map(m => m[metricName] ?? 0);
  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const changePercent = first !== 0 ? (change / first) * 100 : 0;

  let direction = '→';
  if (changePercent > 10) direction = '↑';
  else if (changePercent < -10) direction = '↓';

  return {
    direction,
    change,
    changePercent: Math.round(changePercent * 100) / 100,
    values,
  };
}

/**
 * Calculates trend statistics (min, max, avg, stddev)
 * @param {Array} values - Numeric values
 * @returns {{min: number, max: number, avg: number, stddev: number}}
 */
export function calculateTrendStats(values) {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0, stddev: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    avg: Math.round(avg * 100) / 100,
    stddev: Math.round(stddev * 100) / 100,
  };
}

/**
 * Compares current metric with target
 * @param {string} metricName - Metric field name
 * @param {number} currentValue - Current value
 * @returns {{target: number, gap: number, progress: number, onTarget: boolean}}
 */
export function compareWithTarget(metricName, currentValue) {
  const targetConfig = QUALITY_TARGETS[metricName];
  if (!targetConfig) {
    return { target: null, gap: 0, progress: 100, onTarget: true };
  }

  const { target, direction } = targetConfig;
  const gap = direction === 'higher' ? target - currentValue : currentValue - target;
  const onTarget = direction === 'higher' ? currentValue >= target : currentValue <= target;

  // Progress calculation (0-100%)
  let progress;
  if (direction === 'higher') {
    progress = Math.min(100, Math.max(0, (currentValue / target) * 100));
  } else {
    // For "lower is better", invert the progress
    progress = Math.min(100, Math.max(0, ((target * 2 - currentValue) / (target * 2)) * 100));
  }

  return {
    target,
    gap: Math.round(gap * 100) / 100,
    progress: Math.round(progress),
    onTarget,
  };
}

/**
 * Estimates days to reach target based on current trend
 * @param {number} currentValue - Current value
 * @param {number} target - Target value
 * @param {number} dailyChange - Average daily change
 * @param {string} direction - 'higher' or 'lower'
 * @returns {number|null} Estimated days, or null if not trending toward target
 */
export function estimateDaysToTarget(currentValue, target, dailyChange, direction) {
  if (dailyChange === 0) return null;

  const needed = direction === 'higher' ? target - currentValue : currentValue - target;

  if ((direction === 'higher' && dailyChange < 0) || (direction === 'lower' && dailyChange > 0)) {
    return null; // Moving away from target
  }

  return Math.ceil(needed / Math.abs(dailyChange));
}

/**
 * Exports metrics to CSV format
 * @param {Array} metrics - Metric snapshots
 * @param {string[]} [metricNames] - Specific metrics to export
 * @returns {string} CSV content
 */
export function exportToCSV(metrics, metricNames = null) {
  if (metrics.length === 0) return '';

  const allKeys = [
    'timestamp',
    'entity_count',
    'relationship_count',
    'network_density',
    'isolated_entities',
    'search_latency',
    'search_accuracy',
    'health_score',
  ];
  const keys = metricNames ? ['timestamp', ...metricNames.filter(k => k !== 'timestamp')] : allKeys;

  const header = keys.join(',');
  const rows = metrics.map(m =>
    keys
      .map(k => {
        const val = m[k];
        if (val === undefined || val === null) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
        return val;
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Exports metrics to JSON format
 * @param {Array} metrics - Metric snapshots
 * @param {string[]} [metricNames] - Specific metrics to export
 * @returns {string} JSON content
 */
export function exportToJSON(metrics, metricNames = null) {
  if (metricNames) {
    const filtered = metrics.map(m => {
      const result = { timestamp: m.timestamp };
      for (const key of metricNames) {
        if (key !== 'timestamp' && m[key] !== undefined) {
          result[key] = m[key];
        }
      }
      return result;
    });
    return JSON.stringify(filtered, null, 2);
  }
  return JSON.stringify(metrics, null, 2);
}
