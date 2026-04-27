import fs from 'fs';
import path from 'path';
import { generateLocalId } from './ulid.js';
import { TIMELINE_DIR, MEMORY_DIR } from './constants.js';
import { atomicWriteText } from './atomic-write.js';
import { parseFrontmatter, extractSections } from './extractor.js';

export { atomicWriteText };

export function buildEntryContent(data) {
  const tags = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags || '';
  const meta = data.meta ? JSON.stringify(data.meta) : '[]';

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
meta: ${meta}
---

# ≡≡≡ Abstract ≡≡≡
\`\`\`
${data.abstract}
\`\`\`

# ≡≡≡ Overview ≡≡≡
\`\`\`
${data.overview}
\`\`\`

# ≡≡≡ Contents ≡≡≡
\`\`\`
${data.content}
\`\`\`

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
    meta: metadata.meta || [],
    abstract: layers.abstract,
    overview: layers.overview,
    content: layers.content,
  });

  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true });
  }

  const filePath = path.join(dayDir, fileName);
  atomicWriteText(filePath, content);

  const relativePath = filePath.replace(MEMORY_DIR + path.sep, '').replace(/\\/g, '/');

  return { filePath, localId, relativePath, fileName };
}

export function parseEntryFromFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    // File may not exist or be unreadable — expected, return null
    return null;
  }

  if (!content || !content.trim()) return null;

  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) return null;

  const sections = extractSections(content);

  return { frontmatter, ...sections };
}
