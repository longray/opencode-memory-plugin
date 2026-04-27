const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---/;
const SECTION_ABSTRACT = /# ≡≡≡ Abstract ≡≡≡\n```\n([\s\S]*?)```/;
const SECTION_OVERVIEW = /# ≡≡≡ Overview ≡≡≡\n```\n([\s\S]*?)```/;
const SECTION_CONTENTS = /# ≡≡≡ Contents ≡≡≡\n```\n([\s\S]*?)```/;

/**
 * Parse YAML frontmatter from markdown content.
 * Returns the parsed frontmatter object, or null if no frontmatter found.
 */
export function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;

  const info = {};
  match[1].split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const k = key.trim();
      const v = valueParts.join(':').trim();
      if (k === 'meta' && v.startsWith('[')) {
        try {
          info[k] = JSON.parse(v);
        } catch {
          // meta field may not be valid JSON — fall back to raw string
          info[k] = v;
        }
      } else {
        info[k] = v;
      }
    }
  });

  return info;
}

/**
 * Extract structured sections (abstract, overview, content) from entry body.
 * Returns { abstract, overview, content } with trimmed strings.
 */
export function extractSections(body) {
  const abstractMatch = body.match(SECTION_ABSTRACT);
  const overviewMatch = body.match(SECTION_OVERVIEW);
  const contentMatch = body.match(SECTION_CONTENTS);
  return {
    abstract: abstractMatch ? abstractMatch[1].trim() : '',
    overview: overviewMatch ? overviewMatch[1].trim() : '',
    content: contentMatch ? contentMatch[1].trim() : '',
  };
}

/**
 * Strips the frontmatter from the content.
 * @param {string} content - The content to strip frontmatter from
 * @returns {string} Content without frontmatter
 */
function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  return match ? content.substring(match[0].length) : content;
}

export function extractByLevel(content, level) {
  const body = stripFrontmatter(content);

  if (level === 0) {
    const match = body.match(SECTION_ABSTRACT);
    return match ? match[1].trim() : '';
  }

  if (level === 1) {
    const { abstract, overview } = extractSections(body);
    return `# ≡≡≡ Abstract ≡≡≡\n\`\`\`\n${abstract}\n\`\`\`\n\n# ≡≡≡ Overview ≡≡≡\n\`\`\`\n${overview}\n\`\`\``;
  }

  return content;
}

/**
 * Parse frontmatter from entry content.
 * Alias for parseFrontmatter — kept for backward compatibility.
 */
export function getEntryInfo(content) {
  return parseFrontmatter(content);
}
