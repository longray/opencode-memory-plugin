/**
 * 错误处理和用户提示增强模块
 * 提供清晰的错误消息和可操作的建议
 */

const ERROR_MESSAGES = {
  // 配置相关错误
  CONFIG_NOT_FOUND: {
    code: 'CONFIG_NOT_FOUND',
    message: '配置文件未找到',
    explanation: 'OpenCode Memory Plugin 的配置文件不存在于预期位置',
    location: '~/.opencode/memory/memory-config.json',
    solution: [
      '运行初始化命令：npm install @csuwl/opencode-memory-plugin -g',
      '手动创建配置文件',
      '检查插件是否正确安装'
    ]
  },

  CONFIG_INVALID: {
    code: 'CONFIG_INVALID',
    message: '配置文件格式无效',
    explanation: '配置文件包含无效的JSON格式或不正确的配置项',
    solution: [
      '检查配置文件的JSON语法',
      '参考文档中的配置示例',
      '删除配置文件并重新初始化'
    ]
  },

  // Embedding服务相关错误
  EMBEDDING_SERVICE_UNAVAILABLE: {
    code: 'EMBEDDING_SERVICE_UNAVAILABLE',
    message: 'Embedding服务不可用',
    explanation: '无法连接到外部embedding服务',
    location: 'ModelScope API 或本地服务 (localhost:18000)',
    solution: [
      '检查网络连接',
      '验证 MODELSCOPE_API_KEY 环境变量是否正确设置',
      '检查本地embedding服务是否运行（如果使用）',
      '插件将自动回退到BM25关键词搜索'
    ]
  },

  EMBEDDING_SERVICE_TIMEOUT: {
    code: 'EMBEDDING_SERVICE_TIMEOUT',
    message: 'Embedding服务请求超时',
    explanation: '连接到embedding服务时超时',
    solution: [
      '检查网络连接速度',
      '稍后重试',
      '考虑使用更快的本地embedding服务',
      '插件将自动回退到BM25关键词搜索'
    ]
  },

  EMBEDDING_API_KEY_MISSING: {
    code: 'EMBEDDING_API_KEY_MISSING',
    message: 'ModelScope API密钥未设置',
    explanation: 'ModelScope API需要有效的API密钥才能使用',
    location: '环境变量: MODELSCOPE_API_KEY',
    solution: [
      '在ModelScope注册账号并获取API密钥',
      '设置环境变量: export MODELSCOPE_API_KEY=\'your-api-key\'',
      '或者配置本地embedding服务作为替代'
    ]
  },

  EMBEDDING_DIMENSION_MISMATCH: {
    code: 'EMBEDDING_DIMENSION_MISMATCH',
    message: 'Embedding维度不匹配',
    explanation: '返回的embedding向量维度与预期不符',
    solution: [
      '检查embedding服务配置',
      '重新构建向量索引: rebuild_index force=true',
      '验证embedding服务返回的模型'
    ]
  },

  // 向量索引相关错误
  VECTOR_INDEX_NOT_FOUND: {
    code: 'VECTOR_INDEX_NOT_FOUND',
    message: '向量索引不存在',
    explanation: '未找到向量索引数据库，需要先构建索引',
    solution: [
      '运行: rebuild_index',
      '确保内存文件存在',
      '检查embedding服务是否可用'
    ]
  },

  VECTOR_INDEX_CORRUPTED: {
    code: 'VECTOR_INDEX_CORRUPTED',
    message: '向量索引损坏',
    explanation: '向量索引数据库可能已损坏或格式不正确',
    solution: [
      '强制重建索引: rebuild_index force=true',
      '删除 vector-index.db 文件并重新构建',
      '检查磁盘空间'
    ]
  },

  // 内存文件相关错误
  MEMORY_FILE_NOT_FOUND: {
    code: 'MEMORY_FILE_NOT_FOUND',
    message: '记忆文件未找到',
    explanation: '请求的记忆文件不存在',
    location: '~/.opencode/memory/',
    solution: [
      '检查文件路径是否正确',
      '运行初始化脚本创建缺失的文件',
      '使用 list_daily 查看可用的记忆文件'
    ]
  },

  MEMORY_DIRECTORY_NOT_FOUND: {
    code: 'MEMORY_DIRECTORY_NOT_FOUND',
    message: '记忆目录不存在',
    explanation: 'OpenCode Memory Plugin 的记忆目录不存在',
    location: '~/.opencode/memory/',
    solution: [
      '运行插件安装命令',
      '手动创建记忆目录',
      '检查权限设置'
    ]
  },

  // 搜索相关错误
  SEARCH_NO_RESULTS: {
    code: 'SEARCH_NO_RESULTS',
    message: '搜索未返回结果',
    explanation: '未找到与查询匹配的内容',
    solution: [
      '尝试使用不同的关键词',
      '使用语义搜索而非关键词搜索',
      '检查搜索模式设置',
      '确认记忆文件中是否包含相关内容'
    ]
  },

  SEARCH_INDEX_EMPTY: {
    code: 'SEARCH_INDEX_EMPTY',
    message: '搜索索引为空',
    explanation: '向量索引尚未构建或为空',
    solution: [
      '运行: rebuild_index',
      '确认记忆文件存在',
      '检查embedding服务是否可用'
    ]
  }
};

/**
 * 格式化错误消息
 */
export function formatErrorMessage(errorCode, details = {}) {
  const error = ERROR_MESSAGES[errorCode];

  if (!error) {
    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      message: '未知错误',
      explanation: '发生了一个未预期的错误',
      details
    };
  }

  return {
    success: false,
    ...error,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * 创建用户友好的错误提示
 */
export function createUserFriendlyError(error) {
  const friendlyError = formatErrorMessage(error.code || 'UNKNOWN_ERROR', error.details);

  let message = `❌ ${friendlyError.message}\n\n`;

  if (friendlyError.explanation) {
    message += `📋 说明: ${friendlyError.explanation}\n\n`;
  }

  if (friendlyError.location) {
    message += `📍 位置: ${friendlyError.location}\n\n`;
  }

  if (friendlyError.solution && friendlyError.solution.length > 0) {
    message += `💡 解决方案:\n`;
    friendlyError.solution.forEach((solution, index) => {
      message += `  ${index + 1}. ${solution}\n`;
    });
  }

  return message;
}

/**
 * 创建带代码片段的错误提示
 */
export function createCodeSnippetError(error, codeSnippet = '') {
  const friendlyError = formatErrorMessage(error.code || 'UNKNOWN_ERROR', error.details);

  let message = createUserFriendlyError(friendlyError);

  if (codeSnippet) {
    message += `\n\n📝 相关代码:\n\`\`\`\n${codeSnippet}\n\`\`\`\n`;
  }

  return message;
}

/**
 * 创建调试信息
 */
export function createDebugInfo(error) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    errorCode: error.code,
    errorMessage: error.message,
    errorDetails: error.details,
    systemInfo: {
      platform: process.platform,
      nodeVersion: process.version,
      env: {
        MODELSCOPE_API_KEY: process.env.MODELSCOPE_API_KEY ? 'SET' : 'NOT_SET',
        HOME: process.env.HOME || process.env.USERPROFILE
      }
    }
  };

  return debugInfo;
}

/**
 * 验证配置并返回验证结果
 */
export function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // 检查必要字段
  if (!config.version) {
    errors.push({
      code: 'CONFIG_MISSING_VERSION',
      message: '配置缺少版本号'
    });
  }

  if (!config.search) {
    errors.push({
      code: 'CONFIG_MISSING_SEARCH',
      message: '配置缺少搜索设置'
    });
  } else {
    const validModes = ['hybrid', 'vector', 'bm25', 'hash'];
    if (!validModes.includes(config.search.mode)) {
      errors.push({
        code: 'CONFIG_INVALID_SEARCH_MODE',
        message: `无效的搜索模式: ${config.search.mode}`,
        solution: `有效模式: ${validModes.join(', ')}`
      });
    }
  }

  if (!config.embedding) {
    warnings.push({
      code: 'CONFIG_MISSING_EMBEDDING',
      message: '配置缺少embedding设置，将使用默认值'
    });
  } else {
    if (config.embedding.enabled === undefined) {
      warnings.push({
        code: 'CONFIG_EMBEDDING_ENABLED_UNDEFINED',
        message: 'embedding.enabled 未定义，将默认为true'
      });
    }

    if (config.embedding.enabled && !config.embedding.endpoint) {
      warnings.push({
        code: 'CONFIG_MISSING_ENDPOINT',
        message: 'embedding已启用但未配置端点，将使用默认端点'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 获取配置建议
 */
export function getConfigSuggestions(config) {
  const suggestions = [];

  if (config.search?.mode === 'hybrid') {
    const vectorWeight = config.search.options?.hybrid?.vectorWeight || 0.7;
    const bm25Weight = config.search.options?.hybrid?.bm25Weight || 0.3;

    if (vectorWeight < 0.5 || vectorWeight > 0.9) {
      suggestions.push({
        type: 'optimization',
        message: `向量权重 (${vectorWeight}) 偏离推荐范围 (0.6-0.8)`,
        recommendation: '建议使用0.7，这是经过验证的最优值'
      });
    }
  }

  if (config.indexing) {
    const chunkSize = config.indexing.chunkSize || 400;
    const chunkOverlap = config.indexing.chunkOverlap || 80;

    if (chunkSize < 200 || chunkSize > 600) {
      suggestions.push({
        type: 'optimization',
        message: `块大小 (${chunkSize}) 可能需要调整`,
        recommendation: '建议使用400，这是推荐的默认值'
      });
    }

    const overlapRatio = chunkOverlap / chunkSize;
    if (overlapRatio < 0.15 || overlapRatio > 0.3) {
      suggestions.push({
        type: 'optimization',
        message: `重叠比例 (${(overlapRatio * 100).toFixed(1)}%) 偏离推荐范围 (15-25%)`,
        recommendation: '建议设置为20%，即块大小的0.2倍'
      });
    }
  }

  return suggestions;
}

export default {
  formatErrorMessage,
  createUserFriendlyError,
  createCodeSnippetError,
  createDebugInfo,
  validateConfig,
  getConfigSuggestions,
  ERROR_MESSAGES
};
