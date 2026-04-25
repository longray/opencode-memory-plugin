/**
 * Code Analysis Formatter
 * 格式化代码分析结果输出
 */

/**
 * 格式化分析结果为表格
 */
export function formatAsTable(result) {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const { file, result: analysis } = result;
  const { language, functions, classes, complexity_metrics, calls } = analysis;

  const lines = [];

  // Header
  lines.push('┌' + '─'.repeat(58) + '┐');
  lines.push(`│${centerText(`Code Analysis: ${file}`, 58)}│`);
  lines.push('├' + '─'.repeat(58) + '┤');

  // Basic Info
  lines.push(`│ Language: ${padEnd(language, 48)}│`);
  lines.push(`│ Lines: ${padEnd(String(complexity_metrics?.lines_of_code || 0), 51)}│`);
  lines.push(`│ Functions: ${padEnd(String(functions?.length || 0), 47)}│`);
  lines.push(`│ Classes: ${padEnd(String(classes?.length || 0), 49)}│`);
  lines.push(`│ Complexity: ${padEnd(String(complexity_metrics?.cyclomatic || 0), 46)}│`);

  const qualityScore = result.result.quality_score;
  if (qualityScore) {
    const scoreText = `${qualityScore.score}/100 (${qualityScore.grade})`;
    lines.push(`│ Quality: ${padEnd(scoreText, 48)}│`);

    if (qualityScore.issues && qualityScore.issues.length > 0) {
      lines.push('├' + '─'.repeat(58) + '┤');
      lines.push(`│${padEnd(' Issues:', 58)}│`);
      for (const issue of qualityScore.issues.slice(0, 3)) {
        lines.push(`│  • ${padEnd(issue, 54)}│`);
      }
      if (qualityScore.issues.length > 3) {
        lines.push(`│  • ${padEnd(`... and ${qualityScore.issues.length - 3} more`, 54)}│`);
      }
    }
  }

  lines.push('├' + '─'.repeat(58) + '┤');

  // Functions
  if (functions && functions.length > 0) {
    lines.push(`│${padEnd(' Functions:', 58)}│`);
    lines.push('│ ' + '─'.repeat(56) + ' │');
    lines.push(`│ ${padEnd('Name', 30)}${padEnd('Line', 8)}${padEnd('Type', 18)}│`);
    lines.push('│ ' + '─'.repeat(56) + ' │');

    for (const func of functions.slice(0, 10)) {
      const name = truncate(func.name, 28);
      const line = String(func.line || '-');
      const type = func.type || 'function';
      lines.push(`│ ${padEnd(name, 30)}${padEnd(line, 8)}${padEnd(type, 18)}│`);
    }

    if (functions.length > 10) {
      lines.push(`│ ${padEnd(`... and ${functions.length - 10} more`, 56)}│`);
    }
  }

  // Classes
  if (classes && classes.length > 0) {
    lines.push('├' + '─'.repeat(58) + '┤');
    lines.push(`│${padEnd(' Classes:', 58)}│`);
    lines.push('│ ' + '─'.repeat(56) + ' │');

    for (const cls of classes.slice(0, 5)) {
      const name = truncate(cls.name, 28);
      const line = String(cls.line || '-');
      const methods = cls.methods ? `(${cls.methods.length} methods)` : '';
      lines.push(`│ ${padEnd(name, 30)}${padEnd(line, 8)}${padEnd(methods, 18)}│`);
    }

    if (classes.length > 5) {
      lines.push(`│ ${padEnd(`... and ${classes.length - 5} more`, 56)}│`);
    }
  }

  // Calls
  if (calls && calls.length > 0) {
    lines.push('├' + '─'.repeat(58) + '┤');
    lines.push(`│${padEnd(' Calls:', 58)}│`);
    lines.push('│ ' + '─'.repeat(56) + ' │');
    lines.push(`│ ${padEnd('Target', 35)}${padEnd('Line', 8)}${padEnd('Column', 13)}│`);
    lines.push('│ ' + '─'.repeat(56) + ' │');

    for (const call of calls.slice(0, 10)) {
      const target = truncate(call.target, 33);
      const line = String(call.line || '-');
      const column = String(call.column || '-');
      lines.push(`│ ${padEnd(target, 35)}${padEnd(line, 8)}${padEnd(column, 13)}│`);
    }

    if (calls.length > 10) {
      lines.push(`│ ${padEnd(`... and ${calls.length - 10} more`, 56)}│`);
    }
  }

  lines.push('└' + '─'.repeat(58) + '┘');

  return lines.join('\n');
}

/**
 * 格式化分析结果为树形
 */
export function formatAsTree(result) {
  if (!result.success) {
    return `Error: ${result.error}`;
  }

  const { file, result: analysis } = result;
  const { language, functions, classes, calls } = analysis;

  const lines = [];

  // Root
  lines.push(`${file} [${language}]`);

  // Functions
  if (functions && functions.length > 0) {
    lines.push(`├── Functions (${functions.length})`);
    for (let i = 0; i < functions.length; i++) {
      const func = functions[i];
      const isLast = i === functions.length - 1 && (!classes || classes.length === 0);
      const prefix = isLast ? '│   └── ' : '│   ├── ';
      const type = func.type ? ` [${func.type}]` : '';
      const lineNum = func.line || func.start_line || '?';
      lines.push(`${prefix}${func.name}() @ line ${lineNum}${type}`);
    }
  }

  // Classes
  if (classes && classes.length > 0) {
    const prefix = functions && functions.length > 0 ? '└── ' : '├── ';
    lines.push(`${prefix}Classes (${classes.length})`);

    for (let i = 0; i < classes.length; i++) {
      const cls = classes[i];
      const isLastClass = i === classes.length - 1;
      const classPrefix = isLastClass ? '    └── ' : '    ├── ';
      const classLineNum = cls.line || cls.start_line || '?';
      lines.push(`${classPrefix}${cls.name} @ line ${classLineNum}`);

      // Class methods
      if (cls.methods && cls.methods.length > 0) {
        for (let j = 0; j < cls.methods.length; j++) {
          const method = cls.methods[j];
          const isLastMethod = j === cls.methods.length - 1;
          const isLast = isLastClass && isLastMethod && (!calls || calls.length === 0);
          const methodPrefix = isLast ? '        └── ' : '        ├── ';
          const methodLineNum = method.line || method.start_line || '?';
          lines.push(`${methodPrefix}${method.name}() @ line ${methodLineNum}`);
        }
      }
    }
  }

  // Calls
  if (calls && calls.length > 0) {
    const hasFunctions = functions && functions.length > 0;
    const hasClasses = classes && classes.length > 0;
    const prefix = hasFunctions || hasClasses ? '└── ' : '├── ';
    lines.push(`${prefix}Calls (${calls.length})`);

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const isLast = i === calls.length - 1;
      const callPrefix = isLast ? '    └── ' : '    ├── ';
      lines.push(`${callPrefix}${call.target}() @ line ${call.line}:${call.column}`);
    }
  }

  return lines.join('\n');
}

/**
 * 格式化分析结果为 JSON
 */
export function formatAsJson(result, pretty = false) {
  if (pretty) {
    return JSON.stringify(result, null, 2);
  }
  return JSON.stringify(result);
}

/**
 * 文本居中
 */
function centerText(text, width) {
  if (text.length >= width) {
    return text.substring(0, width);
  }
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
