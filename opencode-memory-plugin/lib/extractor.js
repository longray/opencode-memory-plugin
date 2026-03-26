function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.substring(match[0].length) : content;
}

export function extractByLevel(content, level) {
  const body = stripFrontmatter(content);

  if (level === 0) {
    const match = body.match(/# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/);
    return match ? match[1].trim() : '';
  }

  if (level === 1) {
    const abstract = body.match(/# Abstract\n([\s\S]*?)(?=\n## |\n---|$)/)?.[1]?.trim() || '';
    const overview = body.match(/## Overview\n([\s\S]*?)(?=\n## |\n---|$)/)?.[1]?.trim() || '';
    return `# Abstract\n${abstract}\n\n## Overview\n${overview}`;
  }

  return content;
}

export function getEntryInfo(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return null;

  const info = {};
  frontmatterMatch[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      info[key.trim()] = valueParts.join(':').trim();
    }
  });

  return info;
}
