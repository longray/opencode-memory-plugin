import {
  gatherQualityMetrics,
  generateHealthReport,
  checkThresholds,
  saveReportToFile,
} from './quality-dashboard.js';
import {
  HEALTH_CHECK_ENABLED,
  HEALTH_CHECK_SCHEDULE,
  HEALTH_CHECK_THRESHOLD,
  HEALTH_CHECK_DENSITY_THRESHOLD,
  HEALTH_CHECK_ORPHAN_RATE_THRESHOLD,
  HEALTH_CHECK_TIMEOUT_MS,
} from './constants.js';
import { logInfo, logWarn, logError } from './logger.js';

export class ScheduledHealthCheck {
  constructor(config = {}) {
    const hcConfig = config.health_check || config;

    this.enabled = hcConfig.enabled !== undefined ? hcConfig.enabled : HEALTH_CHECK_ENABLED;
    this.schedule = hcConfig.schedule || HEALTH_CHECK_SCHEDULE;
    this.threshold = hcConfig.threshold !== undefined ? hcConfig.threshold : HEALTH_CHECK_THRESHOLD;
    this.densityThreshold =
      hcConfig.density_threshold !== undefined
        ? hcConfig.density_threshold
        : HEALTH_CHECK_DENSITY_THRESHOLD;
    this.orphanRateThreshold =
      hcConfig.orphan_rate_threshold !== undefined
        ? hcConfig.orphan_rate_threshold
        : HEALTH_CHECK_ORPHAN_RATE_THRESHOLD;
    this.timeout = hcConfig.timeout !== undefined ? hcConfig.timeout : HEALTH_CHECK_TIMEOUT_MS;

    this.timer = null;
    this.lastResult = null;
    this._running = false;
  }

  parseSchedule(schedule) {
    try {
      const parts = schedule.trim().split(/\s+/);
      if (parts.length !== 5) return 24 * 60 * 60 * 1000;

      const [minutePart, hourPart] = parts;

      if (minutePart.startsWith('*/')) {
        const minutes = parseInt(minutePart.slice(2), 10);
        if (isNaN(minutes) || minutes <= 0) return 24 * 60 * 60 * 1000;
        return minutes * 60 * 1000;
      }

      if (hourPart.startsWith('*/')) {
        const hours = parseInt(hourPart.slice(2), 10);
        if (isNaN(hours) || hours <= 0) return 24 * 60 * 60 * 1000;
        return hours * 60 * 60 * 1000;
      }

      return 24 * 60 * 60 * 1000;
    } catch {
      return 24 * 60 * 60 * 1000;
    }
  }

  start() {
    if (!this.enabled) {
      logInfo('scheduled-health-check', 'Health check is disabled');
      return;
    }

    const intervalMs = this.parseSchedule(this.schedule);
    logInfo(
      'scheduled-health-check',
      `Starting scheduled health check every ${intervalMs / 1000 / 60} minutes`
    );

    this.timer = setInterval(async () => {
      if (this._running) {
        logWarn('scheduled-health-check', 'Previous health check still running, skipping');
        return;
      }
      this._running = true;
      try {
        await this.execute();
      } finally {
        this._running = false;
      }
    }, intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logInfo('scheduled-health-check', 'Scheduled health check stopped');
    }
  }

  async execute() {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.timeout);
      });

      const result = await Promise.race([this.runCheck(), timeoutPromise]);

      this.lastResult = result;

      const duration = Date.now() - startTime;
      logInfo(
        'scheduled-health-check',
        `Health check completed in ${duration}ms, score: ${result.report.health_score}`
      );

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          logWarn(
            'scheduled-health-check',
            `${warning.message} - Suggestion: ${warning.suggestion}`
          );
        }
      }

      try {
        await saveReportToFile(result.report);
      } catch (saveError) {
        logWarn('scheduled-health-check', `Failed to save report: ${saveError.message}`);
      }

      return result;
    } catch (error) {
      logError('scheduled-health-check', `Health check failed: ${error.message}`, error);

      this.lastResult = {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        report: null,
        warnings: [],
      };

      return this.lastResult;
    }
  }

  async runCheck() {
    const startTime = Date.now();
    const metrics = await gatherQualityMetrics({ includeSearch: false });
    const report = await generateHealthReport(metrics);

    const thresholds = {
      healthScore: this.threshold,
      networkDensity: this.densityThreshold,
      orphanRate: this.orphanRateThreshold,
    };

    const warnings = checkThresholds(metrics, thresholds);

    return {
      success: true,
      duration: Date.now() - startTime,
      report,
      warnings,
    };
  }
}
