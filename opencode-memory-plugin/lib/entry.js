import fs from 'fs';
import path from 'path';
import { generateLocalId } from './ulid.js';
import { TIMELINE_DIR, MEMORY_DIR } from './constants.js';

export function buildEntryContent(data) {
  const tags = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '';

  return `---
id: ${data.id}
date: ${data.date}
type: ${data.type}
tags: [${tags}]
project: ${data.project || ''}
memory_id: ${data.memory_id || 'pending'}
source_id: ${data.source_id || ''}
synced: ${data.synced || false}
synced_at: ${data.synced_at || 'null'}
---

# Abstract
${data.abstract}

## Overview
${data.overview}

## Content
${data.content}

---
`;
}

export async function writeEntryToTimeline(layers, metadata) {
  const localId = generateLocalId();
  const fileName = `entry_${localId}.md`;

  const now = new Date();
  const dayDir = path.join(
    TIMELINE_DIR,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  );

  const content = buildEntryContent({
    id: localId,
    date: now.toISOString(),
    type: metadata.type || 'general',
    tags: metadata.tags || [],
    project: metadata.project || '',
    memory_id: 'pending',
    source_id: metadata.source_id || '',
    synced: false,
    abstract: layers.abstract,
    overview: layers.overview,
    content: layers.content,
  });

  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true });
  }

  const filePath = path.join(dayDir, fileName);
  fs.writeFileSync(filePath, content, 'utf-8');

  const relativePath = filePath.replace(MEMORY_DIR + path.sep, '').replace(/\\/g, '/');

  return { filePath, localId, relativePath, fileName };
}

export function parseEntryFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) return null;

  const frontmatter = {};
  frontmatterMatch[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  });

  const abstractMatch = content.match(/# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/);
  const overviewMatch = content.match(/## Overview\n([\s\S]*?)(?=\n## |\n---|$)/);
  const contentMatch = content.match(/## Content\n([\s\S]*?)$/);

  return {
    frontmatter,
    abstract: abstractMatch ? abstractMatch[1].trim() : '',
    overview: overviewMatch ? overviewMatch[1].trim() : '',
    content: contentMatch ? contentMatch[1].trim() : '',
  };
}
