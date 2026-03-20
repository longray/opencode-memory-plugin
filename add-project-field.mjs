import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_FILE = path.join(HOME, '.opencode', 'memory', 'MEMORY.md');
const PROJECT_ID = '@longray/opencode-memory-plugin';

const KEYWORDS = [
  'opencode-memory-plugin',
  'OpenCode Memory Plugin',
  'memory plugin',
  'plugin.js',
  'project-resolver',
  'memory_write',
  'memory_search',
  'rebuild_index',
  'project_id',
  'project-id',
  'getGitRemote',
  'ProjectResolver',
];

function parseEntries(content) {
  const entries = [];
  const lines = content.split('\n');
  let currentEntry = null;
  let inEntry = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^## .+ Entry$/)) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentEntry = {
        startLine: i,
        headerLine: i,
        lines: [line],
        hasProject: false,
      };
      inEntry = true;
    } else if (inEntry) {
      currentEntry.lines.push(line);
      if (line.startsWith('**Project**:')) {
        currentEntry.hasProject = true;
      }
      if (line === '---') {
        currentEntry.endLine = i;
        entries.push(currentEntry);
        currentEntry = null;
        inEntry = false;
      }
    }
  }

  return entries;
}

function isProjectRelated(entry) {
  const text = entry.lines.join('\n');
  return KEYWORDS.some(keyword => text.includes(keyword));
}

function addProjectField(entry) {
  const newLines = [];
  let projectAdded = false;

  for (const line of entry.lines) {
    newLines.push(line);
    if (line.startsWith('**Tags**:') && !projectAdded) {
      newLines.push(`**Project**: ${PROJECT_ID}`);
      projectAdded = true;
    }
  }

  return newLines;
}

const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
const entries = parseEntries(content);

console.log(`Total entries: ${entries.length}`);

const relatedEntries = entries.filter(e => isProjectRelated(e));
console.log(`Project-related entries: ${relatedEntries.length}`);

const needsUpdate = relatedEntries.filter(e => !e.hasProject);
console.log(`Entries needing Project field: ${needsUpdate.length}`);

if (needsUpdate.length === 0) {
  console.log('All project-related entries already have Project field.');
  process.exit(0);
}

console.log('\nEntries to update:');
needsUpdate.forEach((e, i) => {
  const preview = e.lines.slice(0, 3).join('\n');
  console.log(`${i + 1}. Line ${e.startLine}:\n${preview}\n`);
});

const lines = content.split('\n');
const newLines = [];
let currentEntryIndex = 0;

for (let i = 0; i < lines.length; i++) {
  const entry = entries[currentEntryIndex];

  if (entry && i === entry.startLine) {
    if (needsUpdate.includes(entry)) {
      const updatedLines = addProjectField(entry);
      newLines.push(...updatedLines);
      i = entry.endLine;
    } else {
      newLines.push(...entry.lines);
      i = entry.endLine;
    }
    currentEntryIndex++;
  } else if (!entry || i < entry.startLine) {
    newLines.push(lines[i]);
  }
}

const newContent = newLines.join('\n');
fs.writeFileSync(MEMORY_FILE + '.new', newContent, 'utf-8');
console.log(`\nUpdated file saved to: ${MEMORY_FILE}.new`);
console.log('Please review and rename to MEMORY.md if correct.');
