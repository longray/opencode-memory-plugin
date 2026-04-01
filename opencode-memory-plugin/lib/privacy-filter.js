import { readFileSync } from 'fs';

const EXCLUDED_PATTERNS = [
  /[\\/]\.env$/,
  /[\\/]\.env\.\w+$/,
  /[\\/]\.git[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.DS_Store$/,
  /config.*\.json$/,
  /[\\/]\.pem$/,
  /[\\/]\.key$/,
  /[\\/]\.p12$/,
  /[\\/]\.pfx$/,
  /[\\/]\.crt$/,
  /[\\/]\.cer$/,
  /[\\/]id_rsa$/,
  /[\\/]id_dsa$/,
  /[\\/]id_ecdsa$/,
  /[\\/]id_ed25519$/,
  /[\\/]\.htpasswd$/,
  /[\\/]\.netrc$/,
  /[\\/]\.npmrc$/,
  /[\\/]\.yarnrc$/,
  /[\\/]credentials$/,
  /[\\/]secret$/,
  /[\\/]secrets$/,
  /[\\/]password$/,
  /[\\/]passwords$/,
];

const SENSITIVE_PATTERNS = [
  { pattern: /password\s*[:=]\s*["'][^"']{4,}["']/i, type: 'password' },
  { pattern: /api[_-]?key\s*[:=]\s*["'][^"']{4,}["']/i, type: 'api_key' },
  { pattern: /secret\s*[:=]\s*["'][^"']{4,}["']/i, type: 'secret' },
  { pattern: /token\s*[:=]\s*["'][^"']{4,}["']/i, type: 'token' },
  { pattern: /private[_-]?key\s*[:=]\s*/i, type: 'private_key' },
  { pattern: /aws_access_key_id\s*[:=]\s*["'][^"']{4,}["']/i, type: 'aws_key' },
  { pattern: /aws_secret_access_key\s*[:=]\s*["'][^"']{4,}["']/i, type: 'aws_secret' },
  { pattern: /database[_-]?url\s*[:=]\s*["'][^"']{4,}["']/i, type: 'database_url' },
  { pattern: /connection[_-]?string\s*[:=]\s*["'][^"']{4,}["']/i, type: 'connection_string' },
  { pattern: /bearer\s+[a-zA-Z0-9_\-.]{10,}/i, type: 'bearer_token' },
];

const MAX_FILE_SIZE = 1024 * 1024;

export function isExcludedFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return { excluded: true, reason: 'matches pattern' };
    }
  }

  return { excluded: false };
}

export function containsSensitiveInfo(content) {
  if (!content || typeof content !== 'string') {
    return { hasSensitive: false };
  }

  const foundPatterns = [];

  for (const { pattern, type } of SENSITIVE_PATTERNS) {
    if (pattern.test(content)) {
      const matches = content.match(pattern);
      foundPatterns.push({
        type,
        count: matches ? matches.length : 0,
        sample: matches && matches[0] ? matches[0].substring(0, 50) + '...' : null,
      });
    }
  }

  if (foundPatterns.length > 0) {
    return {
      hasSensitive: true,
      patterns: foundPatterns,
    };
  }

  return { hasSensitive: false };
}

export function shouldSkipFile(filePath, content = null) {
  const exclusion = isExcludedFile(filePath);
  if (exclusion.excluded) {
    return {
      skip: true,
      reason: 'excluded_file',
      details: exclusion.reason,
    };
  }

  if (content) {
    const sensitivity = containsSensitiveInfo(content);
    if (sensitivity.hasSensitive) {
      return {
        skip: true,
        reason: 'sensitive_content',
        details: `Found ${sensitivity.patterns.length} sensitive patterns`,
        patterns: sensitivity.patterns,
      };
    }
  }

  return { skip: false };
}

export function validateFileSize(filePath) {
  try {
    const stats = readFileSync(filePath, { flag: 'r' }).length;
    return {
      valid: stats <= MAX_FILE_SIZE,
      size: stats,
      maxSize: MAX_FILE_SIZE,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}
