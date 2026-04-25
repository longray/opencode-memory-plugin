import { tool } from '@opencode-ai/plugin/tool';
import { getLinkMap } from '../lib/storage.js';

export const memory_timeline = tool({
  description: 'View memories organized by timeline (date)',
  args: {
    days: tool.schema.number().optional().default(7),
    level: tool.schema.number().optional().default(1).describe('0=abstract, 1=overview, 2=full'),
  },
  async execute(args) {
    const days = args.days || 7;
    const level = args.level || 1;
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});

    if (entries.length === 0) {
      return '❌ No memories found';
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const byDate = {};
    for (const entry of entries) {
      if (!entry.path) continue;
      const match = entry.path.match(/timeline\/(\d{4})\/(\d{2})\/(\d{2})/);
      if (match) {
        const dateStr = `${match[1]}-${match[2]}-${match[3]}`;
        const entryDate = new Date(dateStr);
        if (entryDate >= cutoff) {
          if (!byDate[dateStr]) byDate[dateStr] = [];
          byDate[dateStr].push(entry);
        }
      }
    }

    const sortedDates = Object.keys(byDate).sort().reverse();

    if (sortedDates.length === 0) {
      return `❌ No memories in the last ${days} days`;
    }

    let output = `# 记忆时间线 (最近 ${days} 天)\n\n`;

    for (const date of sortedDates) {
      output += `## ${date} (${byDate[date].length} entries)\n\n`;
      for (const entry of byDate[date].slice(0, 10)) {
        const content =
          level === 0
            ? entry.abstract?.substring(0, 50) || ''
            : level === 1
              ? (entry.overview || entry.abstract || '').substring(0, 100)
              : (entry.overview || entry.abstract || '').substring(0, 300);
        output += `- [${entry.type}] ${content}${content ? '...' : ''} \`${entry.id}\`\n`;
      }
      output += '\n';
    }

    return output;
  },
});

export const memory_topics = tool({
  description: 'List all topics with entry counts',
  args: {
    min_entries: tool.schema.number().optional().default(1),
  },
  async execute(args) {
    const minEntries = args.min_entries || 1;
    const linkMap = getLinkMap();
    const entries = Object.values(linkMap.entries || {});

    if (entries.length === 0) {
      return '❌ No memories found';
    }

    const topicCount = {};
    for (const entry of entries) {
      const type = entry.type || 'general';
      topicCount[type] = (topicCount[type] || 0) + 1;

      for (const tag of entry.tags || []) {
        topicCount[tag] = (topicCount[tag] || 0) + 1;
      }
    }

    const filtered = Object.entries(topicCount)
      .filter(([, count]) => count >= minEntries)
      .sort((a, b) => b[1] - a[1]);

    if (filtered.length === 0) {
      return `❌ No topics with ${minEntries}+ entries`;
    }

    let output = `# 记忆主题\n\n`;
    output += `| 主题 | 条目数 |\n|------|--------|\n`;
    output += filtered.map(([topic, count]) => `| ${topic} | ${count} |`).join('\n');

    return output;
  },
});
