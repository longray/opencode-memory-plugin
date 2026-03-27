function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.substring(match[0].length) : content;
}

export function extractByLevel(content, level) {
  const body = stripFrontmatter(content);

  if (level === 0) {
    // # ≡≡≡ Abstract ≡≡≡ with code block
    const match = body.match(/# ≡≡≡ Abstract ≡≡≡\n```\n([\s\S]*?)```/);
    return match ? match[1].trim() : '';
  }

  if (level === 1) {
    const abstractMatch = body.match(/# ≡≡≡ Abstract ≡≡≡\n```\n([\s\S]*?)```/);
    const overviewMatch = body.match(/# ≡≡≡ Overview ≡≡≡\n```\n([\s\S]*?)```/);
    const abstract = abstractMatch ? abstractMatch[1].trim() : '';
    const overview = overviewMatch ? overviewMatch[1].trim() : '';
    return `# ≡≡≡ Abstract ≡≡≡\n\`\`\`\n${abstract}\n\`\`\`\n\n# ≡≡≡ Overview ≡≡≡\n\`\`\`\n${overview}\n\`\`\``;
  }

  return content;
}

export function getEntryInfo(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatterMatch) return null;

  const info = {};
  frontmatterMatch[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const k = key.trim();
      const v = valueParts.join(':').trim();
      if (k === 'meta' && v.startsWith('[')) {
        try {
          info[k] = JSON.parse(v);
        } catch {
          info[k] = v;
        }
      } else {
        info[k] = v;
      }
    }
  });

  return info;
}
