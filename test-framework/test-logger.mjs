/**
 * 测试日志记录器
 * 记录所有测试操作和结果
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TestLogger {
  constructor(options = {}) {
    this.logs = [];
    this.startTime = Date.now();
    this.logLevel = options.logLevel || 'info';
    this.logFile = options.logFile || null;
    this.verbose = options.verbose || false;
  }

  /**
   * 记录日志
   */
  async log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime,
    };

    this.logs.push(logEntry);

    // 控制台输出
    if (this.shouldLog(level)) {
      const color = this.getColor(level);
      const prefix = `[${level.toUpperCase()}]`;
      const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
      console.log(`${color}${prefix}${timestamp}${message}${dataStr}\x1b[0m`);
    }

    // 写入文件
    if (this.logFile) {
      await this.writeLog(logEntry);
    }
  }

  /**
   * 判断是否应该记录该级别的日志
   */
  shouldLog(level) {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * 获取日志级别颜色
   */
  getColor(level) {
    const colors = {
      debug: '\x1b[36m',   // Cyan
      info: '\x1b[32m',    // Green
      warn: '\x1b[33m',    // Yellow
      error: '\x1b[31m',   // Red
    };
    return colors[level] || '\x1b[0m';
  }

  /**
   * 写入日志文件
   */
  async writeLog(logEntry) {
    try {
      const logDir = path.dirname(this.logFile);
      await fs.mkdir(logDir, { recursive: true });
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(this.logFile, logLine, 'utf-8');
    } catch (error) {
      console.error('Failed to write log file:', error);
    }
  }

  /**
   * Debug级别日志
   */
  async debug(message, data) {
    await this.log('debug', message, data);
  }

  /**
   * Info级别日志
   */
  async info(message, data) {
    await this.log('info', message, data);
  }

  /**
   * Warn级别日志
   */
  async warn(message, data) {
    await this.log('warn', message, data);
  }

  /**
   * Error级别日志
   */
  async error(message, data) {
    await this.log('error', message, data);
  }

  /**
   * 记录测试开始
   */
  async testStart(testName, testData = {}) {
    await this.info(`🚀 测试开始: ${testName}`, testData);
    return Date.now();
  }

  /**
   * 记录测试结束
   */
  async testEnd(testName, startTime, result = {}, duration) {
    const elapsed = duration || (Date.now() - startTime);
    const status = result.success ? '✅ 成功' : '❌ 失败';
    await this.info(`🏁 测试结束: ${testName} ${status}`, {
      ...result,
      duration: elapsed,
    });
    return elapsed;
  }

  /**
   * 记录操作
   */
  async logOperation(operation, data = {}) {
    await this.debug(`操作: ${operation}`, data);
  }

  /**
   * 记录性能数据
   */
  async logPerformance(operation, duration, metadata = {}) {
    await this.debug(`性能: ${operation} 耗时 ${duration}ms`, metadata);
  }

  /**
   * 记录错误
   */
  async logError(operation, error, context = {}) {
    await this.error(`错误: ${operation}`, {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  }

  /**
   * 记录数据统计
   */
  async logStatistics(statistics) {
    await this.info('📊 数据统计', statistics);
  }

  /**
   * 记录进度
   */
  async logProgress(current, total, message = '') {
    const percentage = ((current / total) * 100).toFixed(1);
    await this.info(`📈 进度: ${current}/${total} (${percentage}%) ${message}`);
  }

  /**
   * 记录里程碑
   */
  async logMilestone(milestone, data = {}) {
    await this.info(`🎯 里程碑: ${milestone}`, data);
  }

  /**
   * 获取所有日志
   */
  getLogs(filter = {}) {
    let filteredLogs = [...this.logs];

    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }

    if (filter.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime);
    }

    if (filter.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime);
    }

    if (filter.message) {
      filteredLogs = filteredLogs.filter(log =>
        log.message.includes(filter.message)
      );
    }

    return filteredLogs;
  }

  /**
   * 获取错误日志
   */
  getErrorLogs() {
    return this.getLogs({ level: 'error' });
  }

  /**
   * 获取性能日志
   */
  getPerformanceLogs() {
    return this.logs.filter(log =>
      log.message.includes('性能') || log.message.includes('耗时')
    );
  }

  /**
   * 导出日志到文件
   */
  async exportLogs(filename = 'test-logs.json') {
    const logDir = path.join(__dirname, '..', 'test-results');
    await fs.mkdir(logDir, { recursive: true });
    const logFile = path.join(logDir, filename);
    await fs.writeFile(logFile, JSON.stringify(this.logs, null, 2), 'utf-8');
    console.log(`✅ 日志已导出到: ${logFile}`);
    return logFile;
  }

  /**
   * 生成日志摘要
   */
  generateSummary() {
    const summary = {
      totalLogs: this.logs.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      },
      errorCount: 0,
      warnCount: 0,
      totalDuration: Date.now() - this.startTime,
    };

    this.logs.forEach(log => {
      summary.byLevel[log.level]++;
      if (log.level === 'error') summary.errorCount++;
      if (log.level === 'warn') summary.warnCount++;
    });

    return summary;
  }

  /**
   * 打印日志摘要
   */
  printSummary() {
    const summary = this.generateSummary();
    console.log('\n📋 日志摘要:');
    console.log(`   总日志数: ${summary.totalLogs}`);
    console.log(`   Debug: ${summary.byLevel.debug}`);
    console.log(`   Info: ${summary.byLevel.info}`);
    console.log(`   Warn: ${summary.byLevel.warn}`);
    console.log(`   Error: ${summary.byLevel.error}`);
    console.log(`   总耗时: ${(summary.totalDuration / 1000).toFixed(2)}s`);
    console.log('');
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
    this.startTime = Date.now();
  }
}

export default TestLogger;
