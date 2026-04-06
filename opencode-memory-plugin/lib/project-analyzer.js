import { codeAnalyzer } from './code-analyzer.js';
import { resolveProjectId } from './project-resolver.js';

/**
 * 项目分析器类
 * 提供项目级代码分析，生成健康度报告
 */
export class ProjectAnalyzer {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.projectId = resolveProjectId({ projectRoot });
  }

  /**
   * 分析整个项目
   */
  async analyzeProject(files) {
    console.log(`[ProjectAnalyzer] Analyzing ${files.length} files...`);

    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`[${i + 1}/${files.length}] Analyzing: ${file}`);

      try {
        const result = await codeAnalyzer.analyze(file);
        results.push({
          file,
          success: true,
          result,
        });
      } catch (error) {
        errors.push({
          file,
          error: error.message,
        });
      }
    }

    console.log(
      `[ProjectAnalyzer] Analysis complete: ${results.length} success, ${errors.length} failed`
    );

    // 计算项目级指标
    const metrics = this.calculateMetrics(results);
    const risks = this.identifyRisks(results);
    const grade = this.calculateGrade(metrics);
    const languageDistribution = this.calculateLanguageDistribution(results);

    return {
      success: errors.length === 0,
      total: files.length,
      analyzed: results.length,
      failed: errors.length,
      grade,
      metrics,
      risks,
      languageDistribution,
      timestamp: new Date().toISOString(),
      projectId: this.projectId,
      results: results.map(r => ({
        file: r.file,
        language: r.result.language,
        functions: r.result.functions?.length || 0,
        classes: r.result.classes?.length || 0,
        complexity: r.result.complexity_metrics?.cyclomatic || 0,
        lines: r.result.complexity_metrics?.lines_of_code || 0,
      })),
      errors,
    };
  }

  /**
   * 计算项目级指标
   */
  calculateMetrics(results) {
    const totalFiles = results.length;
    const totalFunctions = results.reduce((sum, r) => sum + (r.result.functions?.length || 0), 0);
    const totalClasses = results.reduce((sum, r) => sum + (r.result.classes?.length || 0), 0);
    const totalLines = results.reduce(
      (sum, r) => sum + (r.result.complexity_metrics?.lines_of_code || 0),
      0
    );

    // 计算平均复杂度
    const complexities = results
      .map(r => r.result.complexity_metrics?.cyclomatic || 0)
      .filter(c => c > 0);
    const averageComplexity =
      complexities.length > 0
        ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length
        : 0;

    // 高风险文件数量
    const highRiskFiles = results.filter(
      r => (r.result.complexity_metrics?.cyclomatic || 0) > 10
    ).length;

    // 大文件数量（行数 > 500）
    const largeFiles = results.filter(
      r => (r.result.complexity_metrics?.lines_of_code || 0) > 500
    ).length;

    return {
      totalFiles,
      totalFunctions,
      totalClasses,
      totalLines,
      averageComplexity: parseFloat(averageComplexity.toFixed(2)),
      highRiskFiles,
      largeFiles,
    };
  }

  /**
   * 识别风险文件
   */
  identifyRisks(results) {
    const risks = [];

    for (const r of results) {
      const complexity = r.result.complexity_metrics?.cyclomatic || 0;
      const lines = r.result.complexity_metrics?.lines_of_code || 0;

      if (complexity > 10 || lines > 500) {
        risks.push({
          file: r.file,
          complexity,
          lines,
          functions: r.result.functions?.length || 0,
          classes: r.result.classes?.length || 0,
          riskLevel: complexity > 10 ? 'high' : 'medium',
        });
      }
    }

    // 按复杂度排序
    return risks.sort((a, b) => b.complexity - a.complexity);
  }

  /**
   * 计算健康度评级
   */
  calculateGrade(metrics) {
    const { averageComplexity, highRiskFiles, largeFiles } = metrics;

    // A (优秀): 平均复杂度 < 5，无高风险文件
    if (averageComplexity < 5 && highRiskFiles === 0 && largeFiles === 0) {
      return { grade: 'A', label: '优秀', description: '代码质量良好，维护成本低' };
    }

    // B (良好): 平均复杂度 < 8，高风险文件 < 5
    if (averageComplexity < 8 && highRiskFiles < 5 && largeFiles < 5) {
      return { grade: 'B', label: '良好', description: '整体良好，少量文件需关注' };
    }

    // C (一般): 平均复杂度 < 12，高风险文件 < 10
    if (averageComplexity < 12 && highRiskFiles < 10 && largeFiles < 10) {
      return { grade: 'C', label: '一般', description: '存在技术债务，需要重构' };
    }

    // D (需改进): 其他情况
    return { grade: 'D', label: '需改进', description: '严重技术债务，急需重构' };
  }

  /**
   * 计算语言分布
   */
  calculateLanguageDistribution(results) {
    const distribution = {};

    for (const r of results) {
      const lang = r.result.language || 'unknown';
      if (!distribution[lang]) {
        distribution[lang] = { count: 0, percentage: 0 };
      }
      distribution[lang].count++;
    }

    // 计算百分比
    const total = results.length;
    for (const lang of Object.keys(distribution)) {
      distribution[lang].percentage = parseFloat(
        ((distribution[lang].count / total) * 100).toFixed(1)
      );
    }

    // 转换为数组并排序
    return Object.entries(distribution)
      .map(([language, data]) => ({ language, ...data }))
      .sort((a, b) => b.count - a.count);
  }
}

/**
 * 格式化项目报告为表格
 */
export function formatProjectReportAsTable(report) {
  const lines = [];

  // Header
  lines.push('┌' + '─'.repeat(62) + '┐');
  lines.push(`│${centerText('Project Health Report', 62)}│`);
  lines.push(`│${centerText(`Project: ${report.projectId}`, 62)}│`);
  lines.push(`│${centerText(`Generated: ${new Date(report.timestamp).toLocaleString()}`, 62)}│`);
  lines.push('├' + '─'.repeat(62) + '┤');

  // Grade
  const grade = report.grade;
  const gradeEmoji =
    grade.grade === 'A' ? '🟢' : grade.grade === 'B' ? '🟡' : grade.grade === 'C' ? '🟠' : '🔴';
  lines.push(`│ Overall Grade: ${gradeEmoji} ${grade.grade} (${grade.label})${padEnd('', 35)}│`);
  lines.push(`│ ${padEnd(grade.description, 60)}│`);
  lines.push('├' + '─'.repeat(62) + '┤');

  // Statistics
  const metrics = report.metrics;
  lines.push(`│${padEnd(' Statistics:', 62)}│`);
  lines.push(`│  • Total Files: ${padEnd(String(metrics.totalFiles), 47)}│`);
  lines.push(`│  • Total Functions: ${padEnd(String(metrics.totalFunctions), 43)}│`);
  lines.push(`│  • Total Classes: ${padEnd(String(metrics.totalClasses), 45)}│`);
  lines.push(`│  • Total Lines: ${padEnd(String(metrics.totalLines), 47)}│`);
  lines.push(`│  • Average Complexity: ${padEnd(String(metrics.averageComplexity), 39)}│`);
  lines.push('├' + '─'.repeat(62) + '┤');

  // Language Distribution
  lines.push(`│${padEnd(' Language Distribution:', 62)}│`);
  for (const lang of report.languageDistribution.slice(0, 5)) {
    const bar = '█'.repeat(Math.floor(lang.percentage / 5));
    lines.push(
      `│  ${padEnd(lang.language, 15)} ${padEnd(bar, 20)} ${padEnd(String(lang.percentage) + '%', 10)} (${String(lang.count)} files)│`
    );
  }
  lines.push('├' + '─'.repeat(62) + '┤');

  // High Risk Files
  if (report.risks.length > 0) {
    lines.push(`│${padEnd(' 🔴 High Risk Files:', 62)}│`);
    lines.push('│ ' + '─'.repeat(60) + ' │');
    lines.push(`│ ${padEnd('File', 35)}${padEnd('Complexity', 12)}${padEnd('Lines', 13)}│`);
    lines.push('│ ' + '─'.repeat(60) + ' │');

    for (const risk of report.risks.slice(0, 10)) {
      const file = truncate(risk.file, 33);
      const complexity = String(risk.complexity);
      const lines = String(risk.lines);
      lines.push(`│ ${padEnd(file, 35)}${padEnd(complexity, 12)}${padEnd(lines, 13)}│`);
    }

    if (report.risks.length > 10) {
      lines.push(`│ ${padEnd(`... and ${report.risks.length - 10} more`, 60)}│`);
    }
  }

  lines.push('└' + '─'.repeat(62) + '┘');

  return lines.join('\n');
}

/**
 * 文本居中
 */
function centerText(text, width) {
  const padding = width - text.length;
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

/**
 * 文本右填充
 */
function padEnd(text, width) {
  if (text.length >= width) {
    return text.substring(0, width);
  }
  return text + ' '.repeat(width - text.length);
}

/**
 * 截断文本
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}
