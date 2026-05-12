import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';

const { generateHealthReport, checkThresholds, saveReportToFile } =
  await import('../../lib/quality-dashboard.js');

const { ScheduledHealthCheck } = await import('../../lib/scheduled-health-check.js');

describe('Scheduled Health Check', () => {
  describe('generateHealthReport', () => {
    it('should generate a report with entity count, relation count, and health score', async () => {
      const metrics = {
        entity_count: 100,
        relationship_count: 500,
        network_density: 0.05,
        isolated_entities: 10,
        avg_relationships_per_entity: 5.0,
        health_score: 85,
        grade: 'B',
        coverage_score: 50,
        relationship_score: 100,
        search_score: 80,
        issues: [],
        recommendations: [],
      };

      const report = await generateHealthReport(metrics);

      expect(report).toBeDefined();
      expect(report.entity_count).toBe(100);
      expect(report.relationship_count).toBe(500);
      expect(report.network_density).toBe(0.05);
      expect(report.health_score).toBe(85);
      expect(report.grade).toBe('B');
      expect(report.timestamp).toBeDefined();
    });

    it('should calculate orphan rate from isolated entities', async () => {
      const metrics = {
        entity_count: 100,
        relationship_count: 500,
        network_density: 0.05,
        isolated_entities: 20,
        avg_relationships_per_entity: 5.0,
        health_score: 70,
        grade: 'C',
        coverage_score: 50,
        relationship_score: 100,
        search_score: 80,
        issues: [],
        recommendations: [],
      };

      const report = await generateHealthReport(metrics);

      expect(report.orphan_rate).toBe(0.2);
    });

    it('should handle zero entity count gracefully', async () => {
      const metrics = {
        entity_count: 0,
        relationship_count: 0,
        network_density: 0,
        isolated_entities: 0,
        avg_relationships_per_entity: 0,
        health_score: 0,
        grade: 'F',
        coverage_score: 0,
        relationship_score: 0,
        search_score: 0,
        issues: [],
        recommendations: [],
      };

      const report = await generateHealthReport(metrics);

      expect(report.orphan_rate).toBe(0);
      expect(report.entity_count).toBe(0);
    });
  });

  describe('checkThresholds', () => {
    const defaultThresholds = {
      healthScore: 80,
      networkDensity: 0.02,
      orphanRate: 0.2,
    };

    it('should return empty warnings when all metrics are above thresholds', () => {
      const metrics = {
        health_score: 90,
        network_density: 0.05,
        isolated_entities: 5,
        entity_count: 100,
      };

      const warnings = checkThresholds(metrics, defaultThresholds);

      expect(warnings).toEqual([]);
    });

    it('should warn when health score is below threshold', () => {
      const metrics = {
        health_score: 70,
        network_density: 0.05,
        isolated_entities: 5,
        entity_count: 100,
      };

      const warnings = checkThresholds(metrics, defaultThresholds);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.type === 'health_score')).toBe(true);
    });

    it('should warn when network density is below threshold', () => {
      const metrics = {
        health_score: 90,
        network_density: 0.01,
        isolated_entities: 5,
        entity_count: 100,
      };

      const warnings = checkThresholds(metrics, defaultThresholds);

      expect(warnings.some(w => w.type === 'network_density')).toBe(true);
    });

    it('should warn when orphan rate exceeds threshold', () => {
      const metrics = {
        health_score: 90,
        network_density: 0.05,
        isolated_entities: 30,
        entity_count: 100,
      };

      const warnings = checkThresholds(metrics, defaultThresholds);

      expect(warnings.some(w => w.type === 'orphan_rate')).toBe(true);
    });

    it('should use custom thresholds when provided', () => {
      const metrics = {
        health_score: 75,
        network_density: 0.05,
        isolated_entities: 5,
        entity_count: 100,
      };

      const customThresholds = {
        healthScore: 70,
        networkDensity: 0.02,
        orphanRate: 0.2,
      };

      const warnings = checkThresholds(metrics, customThresholds);

      expect(warnings.some(w => w.type === 'health_score')).toBe(false);
    });

    it('should suggest running relation recommendation when density is low', () => {
      const metrics = {
        health_score: 90,
        network_density: 0.005,
        isolated_entities: 5,
        entity_count: 100,
      };

      const warnings = checkThresholds(metrics, defaultThresholds);

      const densityWarning = warnings.find(w => w.type === 'network_density');
      expect(densityWarning).toBeDefined();
      expect(densityWarning.suggestion).toContain('relation');
    });

    it('should warn about isolated entities when orphan rate is high', () => {
      const metrics = {
        health_score: 90,
        network_density: 0.05,
        isolated_entities: 25,
        entity_count: 100,
      };

      const warnings = checkThresholds(metrics, defaultThresholds);

      const orphanWarning = warnings.find(w => w.type === 'orphan_rate');
      expect(orphanWarning).toBeDefined();
      expect(orphanWarning.message).toContain('isolated');
    });
  });

  describe('saveReportToFile', () => {
    const reportsDir = path.join(os.homedir(), '.opencode', 'reports');

    afterEach(() => {
      try {
        const files = fs.readdirSync(reportsDir);
        for (const file of files) {
          if (file.startsWith('health-test-')) {
            fs.unlinkSync(path.join(reportsDir, file));
          }
        }
      } catch {
        // Directory may not exist
      }
    });

    it('should save report to ~/.opencode/reports/health-YYYY-MM-DD.json', async () => {
      const report = {
        timestamp: '2026-05-11T09:00:00.000Z',
        entity_count: 100,
        relationship_count: 500,
        health_score: 85,
        grade: 'B',
      };

      const filePath = await saveReportToFile(report, 'health-test.json');

      expect(filePath).toContain('.opencode');
      expect(filePath).toContain('reports');
      expect(fs.existsSync(filePath)).toBe(true);

      const savedContent = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(savedContent.entity_count).toBe(100);
      expect(savedContent.health_score).toBe(85);
    });
  });
});

describe('ScheduledHealthCheck class', () => {
  let healthCheck;

  afterEach(() => {
    if (healthCheck) {
      healthCheck.stop();
    }
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      healthCheck = new ScheduledHealthCheck();

      expect(healthCheck.enabled).toBe(true);
      expect(healthCheck.timeout).toBe(60000);
    });

    it('should respect enabled: false config', () => {
      healthCheck = new ScheduledHealthCheck({ enabled: false });

      expect(healthCheck.enabled).toBe(false);
    });

    it('should parse custom threshold from config', () => {
      healthCheck = new ScheduledHealthCheck({ threshold: 70 });

      expect(healthCheck.threshold).toBe(70);
    });

    it('should parse custom timeout from config', () => {
      healthCheck = new ScheduledHealthCheck({ timeout: 30000 });

      expect(healthCheck.timeout).toBe(30000);
    });
  });

  describe('parseSchedule', () => {
    it('should parse "0 9 * * *" (daily at 9 AM) to 24 hours in ms', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('0 9 * * *');

      expect(ms).toBe(24 * 60 * 60 * 1000);
    });

    it('should parse "0 */6 * * *" (every 6 hours) to 6 hours in ms', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('0 */6 * * *');

      expect(ms).toBe(6 * 60 * 60 * 1000);
    });

    it('should parse "*/30 * * * *" (every 30 minutes) to 30 minutes in ms', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('*/30 * * * *');

      expect(ms).toBe(30 * 60 * 1000);
    });

    it('should return default 24h for invalid schedule', () => {
      healthCheck = new ScheduledHealthCheck();
      const ms = healthCheck.parseSchedule('invalid');

      expect(ms).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('start/stop', () => {
    it('should not start timer when disabled', () => {
      healthCheck = new ScheduledHealthCheck({ enabled: false });
      healthCheck.start();

      expect(healthCheck.timer).toBeNull();
    });

    it('should create a timer when started and enabled', () => {
      healthCheck = new ScheduledHealthCheck({ schedule: '*/1 * * * *' });
      healthCheck.start();

      expect(healthCheck.timer).not.toBeNull();
      healthCheck.stop();
    });

    it('should clear timer on stop', () => {
      healthCheck = new ScheduledHealthCheck({ schedule: '*/1 * * * *' });
      healthCheck.start();
      healthCheck.stop();

      expect(healthCheck.timer).toBeNull();
    });
  });
});
