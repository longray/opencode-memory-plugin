/**
 * ASCII Charts - Terminal-friendly chart rendering
 *
 * Renders bar charts and line charts using ASCII characters.
 * No external dependencies.
 *
 * @version 1.0.0
 */

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const BAR_CHAR = '\u2588';

function colorize(text, color) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function getTerminalWidth() {
  return process.stdout.columns || 80;
}

/**
 * Renders a horizontal bar chart
 * @param {Object} params
 * @param {string} params.title - Chart title
 * @param {Array<{label: string, value: number, color?: string}>} params.data
 * @param {number} [params.maxWidth] - Max bar width
 * @param {number} [params.maxValue] - Override max value for scaling
 * @returns {string}
 */
export function renderBarChart({ title, data, maxWidth, maxValue }) {
  const width = maxWidth || getTerminalWidth() - 4;
  const maxVal = maxValue || Math.max(...data.map(d => d.value), 1);
  const labelWidth = Math.max(...data.map(d => d.label.length), 8);

  const lines = [];
  lines.push(colorize(title, 'bold'));
  lines.push('');

  for (const item of data) {
    const barLen = Math.round((item.value / maxVal) * (width - labelWidth - 10));
    const bar = BAR_CHAR.repeat(Math.max(0, barLen));
    const label = item.label.padEnd(labelWidth);
    const valueStr = String(item.value).padStart(6);
    const color = item.color || 'cyan';

    lines.push(`  ${label} ${colorize(bar, color)} ${colorize(valueStr, 'bold')}`);
  }

  return lines.join('\n');
}

/**
 * Renders a sparkline (mini line chart)
 * @param {Object} params
 * @param {string} params.title - Chart title
 * @param {Array<number>} params.values - Data values
 * @param {Array<string>} [params.labels] - X-axis labels
 * @param {string} [params.color] - Line color
 * @param {number} [params.maxWidth] - Max width
 * @returns {string}
 */
export function renderLineChart({ title, values, labels, color, maxWidth }) {
  const width = maxWidth || getTerminalWidth() - 4;
  if (values.length === 0) return `${title}\n  No data available`;

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const chartHeight = 8;
  const chartWidth = Math.min(values.length, width - 12);

  // Build grid
  const grid = Array.from({ length: chartHeight }, () => Array(chartWidth).fill(' '));

  // Plot points
  for (let i = 0; i < chartWidth; i++) {
    const val = values[i] ?? 0;
    const row = Math.round(((maxVal - val) / range) * (chartHeight - 1));
    const clampedRow = Math.max(0, Math.min(chartHeight - 1, row));
    grid[clampedRow][i] = '\u25cf';
  }

  // Connect points with lines
  for (let i = 0; i < chartWidth - 1; i++) {
    const val1 = values[i] ?? 0;
    const val2 = values[i + 1] ?? 0;
    const row1 = Math.round(((maxVal - val1) / range) * (chartHeight - 1));
    const row2 = Math.round(((maxVal - val2) / range) * (chartHeight - 1));
    const r1 = Math.max(0, Math.min(chartHeight - 1, row1));
    const r2 = Math.max(0, Math.min(chartHeight - 1, row2));

    if (r1 !== r2) {
      const step = r2 > r1 ? 1 : -1;
      for (let r = r1; r !== r2 + step; r += step) {
        if (grid[r][i] === ' ') grid[r][i] = '\u2502';
      }
    }
  }

  const lines = [];
  lines.push(colorize(title, 'bold'));
  lines.push('');

  // Y-axis labels and grid
  for (let row = 0; row < chartHeight; row++) {
    const valAtRow = maxVal - (row / (chartHeight - 1)) * range;
    const yLabel = valAtRow.toFixed(1).padStart(7);
    const rowStr = grid[row].join('');
    lines.push(`  ${colorize(yLabel, 'dim')} ${colorize(rowStr, color || 'cyan')}`);
  }

  // X-axis
  const xAxis = '  ' + ' '.repeat(8) + '\u2500'.repeat(chartWidth);
  lines.push(xAxis);

  // X-axis labels
  if (labels && labels.length > 0) {
    const labelLine = '  ' + ' '.repeat(8);
    const step = Math.max(1, Math.floor(chartWidth / labels.length));
    for (let i = 0; i < labels.length && i * step < chartWidth; i++) {
      const pos = i * step;
      lines.push(`${labelLine.substring(0, pos + 8)}${labels[i]}`);
    }
  }

  // Min/max annotation
  lines.push('');
  lines.push(`  Range: ${colorize(String(minVal), 'green')} - ${colorize(String(maxVal), 'red')}`);

  return lines.join('\n');
}

/**
 * Renders a progress bar
 * @param {Object} params
 * @param {number} params.current - Current value
 * @param {number} params.target - Target value
 * @param {number} [params.width] - Bar width
 * @param {string} [params.label] - Label text
 * @returns {string}
 */
export function renderProgressBar({ current, target, width, label }) {
  const w = width || 30;
  const progress = Math.min(1, Math.max(0, current / target));
  const filled = Math.round(progress * w);
  const empty = w - filled;

  const bar =
    colorize(
      BAR_CHAR.repeat(filled),
      progress >= 1 ? 'green' : progress >= 0.5 ? 'yellow' : 'red'
    ) + colorize('\u2591'.repeat(empty), 'dim');

  const pct = `${Math.round(progress * 100)}%`;
  const labelStr = label ? `${label} ` : '';

  return `${labelStr}[${bar}] ${colorize(pct, 'bold')} (${current}/${target})`;
}

/**
 * Renders a trend indicator with arrow and color
 * @param {Object} params
 * @param {number} params.changePercent - Percentage change
 * @param {number} params.change - Absolute change
 * @param {string} [params.direction] - Override direction: '↑' | '↓' | '→'
 * @returns {string}
 */
export function renderTrendIndicator({ changePercent, change, direction }) {
  let arrow = direction;
  let color;

  if (!arrow) {
    if (changePercent > 10) {
      arrow = '↑';
      color = 'green';
    } else if (changePercent < -10) {
      arrow = '↓';
      color = 'red';
    } else {
      arrow = '→';
      color = 'yellow';
    }
  } else {
    color = arrow === '↑' ? 'green' : arrow === '↓' ? 'red' : 'yellow';
  }

  const sign = change >= 0 ? '+' : '';
  return `${colorize(arrow, color)} ${colorize(`${sign}${change}`, color)} (${colorize(`${sign}${changePercent.toFixed(1)}%`, color)})`;
}

/**
 * Renders a simple ASCII table
 * @param {Object} params
 * @param {string[]} params.headers - Column headers
 * @param {Array<string[]>} params.rows - Data rows
 * @param {number} [params.maxWidth] - Max total width
 * @returns {string}
 */
export function renderTable({ headers, rows, maxWidth }) {
  const width = maxWidth || getTerminalWidth();
  const colCount = headers.length;

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxRowLen = Math.max(...rows.map(r => (r[i] || '').length), h.length);
    return Math.min(maxRowLen + 2, Math.floor(width / colCount));
  });

  const lines = [];

  // Header
  const headerStr = headers.map((h, i) => colorize(h.padEnd(colWidths[i]), 'bold')).join('');
  lines.push(headerStr);
  lines.push(
    '\u2500'.repeat(
      Math.min(
        width,
        colWidths.reduce((a, b) => a + b, 0)
      )
    )
  );

  // Rows
  for (const row of rows) {
    const rowStr = row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join('');
    lines.push(rowStr);
  }

  return lines.join('\n');
}

/**
 * Renders a dashboard section box
 * @param {Object} params
 * @param {string} params.title - Section title
 * @param {string} params.content - Section content
 * @param {string} [params.borderColor] - Border color
 * @returns {string}
 */
export function renderSectionBox({ title, content, borderColor }) {
  const color = borderColor || 'cyan';
  const lines = content.split('\n');
  const innerWidth = Math.max(...lines.map(l => l.length), title.length);
  const width = innerWidth + 4;

  const border = char => colorize(char.repeat(width), color);

  const output = [];
  output.push(border('\u2500'));
  output.push(
    `${colorize('\u2502', color)} ${colorize(title, 'bold')}${' '.repeat(Math.max(0, innerWidth - title.length))} ${colorize('\u2502', color)}`
  );
  output.push(border('\u2500'));

  for (const line of lines) {
    output.push(
      `${colorize('\u2502', color)} ${line}${' '.repeat(Math.max(0, innerWidth - line.length))} ${colorize('\u2502', color)}`
    );
  }

  output.push(border('\u2500'));
  return output.join('\n');
}
