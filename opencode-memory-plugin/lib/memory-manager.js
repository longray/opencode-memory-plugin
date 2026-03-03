/**
 * Memory Manager - 记忆管理器
 * 
 * 核心功能：
 * - 管理本地 MD 文件的读写
 * - 添加 8 个元数据标签
 * - 项目标签检测和分类
 * - 上传状态管理
 * - 项目统计管理
 * 
 * @version v2.4.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const DEFAULT_CONFIG_FILE = path.join(MEMORY_DIR, 'memory-config.json');
const PROJECTS_CONFIG = path.join(MEMORY_DIR, 'projects.json');

/**
 * Memory Manager 类
 */
export class MemoryManager {
  constructor(options = {}) {
    this.memoryDir = options.memoryDir || MEMORY_DIR;
    this.configFile = options.configFile || DEFAULT_CONFIG_FILE;
    this.projectsConfig = options.projectsConfig || PROJECTS_CONFIG;
    
    // 加载项目配置
    this.projects = this.loadProjects();
  }
  
  // ============ 核心方法 ============
  
  /**
   * 写入记忆到本地 MD 文件
   * @param {Object} params
   * @param {string} params.content - 记忆内容
   * @param {string} params.type - 记忆类型 (general, preference, decision, etc.)
   * @param {string[]} params.tags - 标签数组
   * @returns {Promise<{success: boolean, entry: Object}>}
   */
  async write({ content, type = 'general', tags = [] }) {
    // 1. 检测项目标签
    const projectTag = this.detectProjectTag(content);
    const projectId = this.detectProjectId(content);
    const projectName = this.detectProjectName(content);
    
    // 2. 构建带标签的记忆条目
    const entryId = this.generateEntryId();
    const timestamp = new Date().toISOString();
    
    const entry = {
      id: entryId,
      timestamp,
      type,
      tags,
      project_tag: projectTag,           // 项目标签（分类）
      project_id: projectId,             // 项目唯一标识符
      project_name: projectName,         // 项目可读名称
      uploaded: false,                   // 上传状态
      upload_timestamp: null,            // 上传时间戳
      upload_error: null,               // 上传错误信息
      classification_confidence: null,   // 分类置信度（0-1）
      classified_at: null,              // 分类时间戳
      content
    };
    
    // 3. 写入对应文件
    const targetFile = this.getTargetFile(projectTag);
    const fullPath = path.join(this.memoryDir, targetFile);
    const formattedEntry = this.formatEntryAsMarkdown(entry);
    await this.appendToFile(fullPath, formattedEntry);
    
    // 4. 更新项目统计
    this.updateProjectStats(projectTag);
    
    return { success: true, entry };
  }
  
  /**
   * 读取记忆
   * @param {Object} options
   * @param {string} options.file - 文件名（默认：MEMORY.md）
   * @param {string} options.projectTag - 项目标签过滤（可选）
   * @param {string} options.uploaded - 上传状态过滤（可选）
   * @returns {Promise<{entries: Array, file: string, exists: boolean}>}
   */
  async read({ file = 'MEMORY.md', projectTag, uploaded }) {
    const filePath = path.join(this.memoryDir, file);
    
    if (!fs.existsSync(filePath)) {
      return { entries: [], file, exists: false };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    let entries = this.parseEntries(content);
    
    // 应用过滤条件
    if (projectTag) {
      entries = entries.filter(e => e.project_tag === projectTag);
    }
    if (uploaded !== undefined) {
      entries = entries.filter(e => e.uploaded === uploaded);
    }
    
    return { entries, file, exists: true };
  }
  
  /**
   * 获取待上传的记忆
   * @returns {Promise<Array>} 待上传的记忆条目
   */
  async getUnuploadedEntries() {
    const files = this.getMemoryFiles();
    const unuploaded = [];
    
    for (const file of files) {
      const { entries } = await this.read({ file });
      const unuploadedEntries = entries.filter(e => e.uploaded === false);
      unuploaded.push(...unuploadedEntries);
    }
    
    return unuploaded;
  }
  
  /**
   * 标记记忆为已上传或失败
   * @param {string[]} entryIds - 记忆 ID 数组
   * @param {Object} options - 选项
   * @param {boolean} options.success - 是否成功（默认：true）
   * @param {string} options.error - 错误信息（失败时）
   */
  async markAsUploaded(entryIds, options = {}) {
    const { success = true, error = null } = options;
    
    for (const entryId of entryIds) {
      const location = await this.findEntryLocation(entryId);
      if (!location) {
        throw new Error(`Entry not found: ${entryId}`);
      }
      
      // 读取文件内容
      const content = fs.readFileSync(location.file, 'utf-8');
      let entries = this.parseEntries(content);
      
      const entry = entries.find(e => e.id === entryId);
      if (!entry) {
        throw new Error(`Entry not found in file: ${entryId}`);
      }
      
      // 更新标签
      if (success) {
        entry.uploaded = 'true';
        entry.upload_timestamp = new Date().toISOString();
        entry.upload_error = null;
      } else {
        entry.uploaded = 'failed';
        entry.upload_timestamp = new Date().toISOString();
        entry.upload_error = error;
      }
      
      // 写回文件
      await this.updateEntryTags(location.file, entry);
    }
  }
  
  // ============ 辅助方法 ============
  
  /**
   * 生成唯一的记忆 ID
   * @returns {string} 唯一标识符
   */
  generateEntryId() {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    return `mem_${timestamp}_${randomBytes.substring(0, 8)}`;
  }
  
  /**
   * 将条目格式化为 Markdown
   * @param {Object} entry - 条目对象
   * @returns {string} Markdown 格式的条目
   */
  formatEntryAsMarkdown(entry) {
    const lines = [
      '## Entry',
      '',
      `**id**: ${entry.id}`,
      `**Date**: ${entry.timestamp}`,
      `**Type**: ${entry.type}`,
      `**Tags**: ${entry.tags.join(', ')}`,
      `**project_tag**: ${entry.project_tag}`,
      `**project_id**: ${entry.project_id || 'null'}`,
      `**project_name**: ${entry.project_name || 'null'}`,
      `**uploaded**: ${entry.uploaded}`,
      `**upload_timestamp**: ${entry.upload_timestamp || 'null'}`,
      `**upload_error**: ${entry.upload_error || 'null'}`,
      `**classification_confidence**: ${entry.classification_confidence || 'null'}`,
      `**classified_at**: ${entry.classified_at || 'null'}`,
      '',
      entry.content,
      '',
      '---'
    ];
    return lines.join('\n');
  }
  
  /**
   * 检测项目标签（基于规则）
   * @param {string} content - 记忆内容
   * @returns {string} 项目标签
   */
  detectProjectTag(content) {
    const PROJECT_PATTERNS = [
      // 文件路径模式
      /\/workspaces\/([^\/]+)\//,    // /workspaces/projectA/
      /\/projects\/([^\/]+)\//,     // /projects/projectB/
      /\/repos\/([^\/]+)\//,      // /repos/myproject/
      
      // Git 仓库模式
      /git@github\.com:([^\/]+)\//,  // git@github.com:org/repo
      /https?:\/\/github\.com\/([^\/]+)\//, // https://github.com/org/repo
      
      // 用户明确指定
      /project:\s*(\w+)/i,          // project: myproject
    ];
    
    // 1. 从内容检测（简单版本）
    for (const pattern of PROJECT_PATTERNS) {
      const match = content.match(pattern);
      if (match) {
        // 检查是否在全局模式白名单中
        const globalPatterns = [
          'user preferences', 'coding style', 'best practices',
          'project conventions', 'system configuration'
        ];
        
        const lowerContent = content.toLowerCase();
        const isGlobal = globalPatterns.some(p => lowerContent.includes(p));
        
        if (isGlobal) {
          return 'global';
        }
        
        // 返回项目名称（从匹配结果中提取）
        return match[1];
      }
    }
    
    // 默认未分类
    return 'unclassified';
  }
  
  /**
   * 检测项目唯一标识符
   * @param {string} content - 记忆内容
   * @returns {string|null} 项目 ID 或 null
   */
  detectProjectId(content) {
    // 从文件路径检测
    const pathPatterns = [
      /\/workspaces\/([^\/]+)\//,
      /\/projects\/([^\/]+)\//,
      /\/repos\/([^\/]+)\//,
    ];
    
    // 从 Git URL 检测
    const gitPatterns = [
      /git@github\.com:([^\/]+)\/([^\/]+)\//,
      /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\//
    ];
    
    // 尝试从内容检测项目 ID
    const idPatterns = [
      /project:\s*([a-zA-Z0-9_-]+)/i,
      /project_id:\s*([a-zA-Z0-9_-]+)/i
    ];
    
    for (const pattern of idPatterns) {
      const match = content.match(pattern);
      if (match) {
        // 标准化为小写并移除特殊字符
        return match[1].toLowerCase().replace(/[^a-z0-9]/g, '-');
      }
    }
    
    return null;
  }
  
  /**
   * 检测项目可读名称
   * @param {string} content - 记忆内容
   * @returns {string|null} 项目可读名称或 null
   */
  detectProjectName(content) {
    // 从内容中提取项目名称
    const namePatterns = [
      /(?:project|repo):?\s*["']([^"']+)["']/i,
      /(?:project|repo)\s+[:：]\s*([^"']+)["']/i
    ];
    
    for (const pattern of namePatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1]; // 返回引号内的名称
      }
    }
    
    return null;
  }
  
  /**
   * 根据项目标签获取目标文件
   * @param {string} projectTag - 项目标签
   * @returns {string} 目标文件路径
   */
  getTargetFile(projectTag) {
    switch (projectTag) {
      case 'global':
        return 'GLOBAL_MEMORY.md';
      case 'unclassified':
        return 'MEMORY.md';  // 默认
      default:
        return 'PROJECT_MEMORY.md';  // 项目记忆统一放这里
    }
  }
  
  /**
   * 加载项目配置
   * @returns {Object} 项目配置对象
   */
  loadProjects() {
    try {
      if (fs.existsSync(this.projectsConfig)) {
        const content = fs.readFileSync(this.projectsConfig, 'utf-8');
        return JSON.parse(content);
      }
      return { projects: {} };
    } catch (e) {
      console.warn('Failed to load projects config:', e.message);
      return { projects: {} };
    }
  }
  
  /**
   * 更新项目统计
   * @param {string} projectTag - 项目标签
   */
  updateProjectStats(projectTag) {
    try {
      const projects = this.loadProjects();
      
      if (!projects.projects[projectTag]) {
        projects.projects[projectTag] = {
          id: projectTag === 'global' ? 'global' : this.normalizeProjectId(projectTag),
          name: projectTag === 'global' ? 'Global' : this.capitalizeFirstLetter(projectTag),
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          entryCount: 0,
          uploadedCount: 0,
          classificationConfidenceAvg: null
        };
      }
      
      projects.projects[projectTag].entryCount++;
      
      this.saveProjects(projects);
    } catch (e) {
      console.warn('Failed to update project stats:', e.message);
    }
  }
  
  /**
   * 解析记忆条目
   * @param {string} content - Markdown 文件内容
   * @returns {Array} 记忆条目数组
   */
  parseEntries(content) {
    const entries = [];
    const lines = content.split('\n');
    let currentEntry = null;
    let inContent = false;
    let contentLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 检测新条目的开始
      if (line.startsWith('## ')) {
        // 保存上一个条目
        if (currentEntry) {
          currentEntry.content = contentLines.join('\n').trim();
          entries.push(currentEntry);
        }

        // 开始新条目
        currentEntry = {
          id: null,
          timestamp: null,
          type: 'general',
          tags: [],
          project_tag: 'unclassified',
          project_id: null,
          project_name: null,
          uploaded: false,
          upload_timestamp: null,
          upload_error: null,
          classification_confidence: null,
          classified_at: null,
          content: ''
        };

        contentLines = [];
        inContent = false;
        continue;
      }

      // 解析元数据
      if (!inContent && currentEntry) {
        if (line.startsWith('**Date**:')) {
          currentEntry.timestamp = line.replace('**Date**:', '').trim();
        } else if (line.startsWith('**Type**:')) {
          currentEntry.type = line.replace('**Type**:', '').trim();
        } else if (line.startsWith('**Tags**:')) {
          const tagsStr = line.replace('**Tags**:', '').trim();
          currentEntry.tags = tagsStr ? tagsStr.split(',').map(t => t.trim()) : [];
        } else if (line.startsWith('**id**:')) {
          currentEntry.id = line.replace('**id**:', '').trim();
        } else if (line.startsWith('**project_tag**:')) {
          currentEntry.project_tag = line.replace('**project_tag**:', '').trim();
        } else if (line.startsWith('**project_id**:')) {
          currentEntry.project_id = line.replace('**project_id**:', '').trim();
        } else if (line.startsWith('**project_name**:')) {
          currentEntry.project_name = line.replace('**project_name**:', '').trim();
        } else if (line.startsWith('**uploaded**:')) {
          const uploaded = line.replace('**uploaded**:', '').trim();
          currentEntry.uploaded = uploaded === 'true' || uploaded === 'failed' ? uploaded : false;
        } else if (line.startsWith('**upload_timestamp**:')) {
          currentEntry.upload_timestamp = line.replace('**upload_timestamp**:', '').trim() || null;
        } else if (line.startsWith('**upload_error**:')) {
          currentEntry.upload_error = line.replace('**upload_error**:', '').trim() || null;
        } else if (line.startsWith('**classification_confidence**:')) {
          const confidence = line.replace('**classification_confidence**:', '').trim();
          currentEntry.classification_confidence = confidence ? parseFloat(confidence) : null;
        } else if (line.startsWith('**classified_at**:')) {
          currentEntry.classified_at = line.replace('**classified_at**:', '').trim() || null;
        } else if (line === '---' || line === '') {
          inContent = true;
        } else {
          contentLines.push(lines[i]);
        }
      } else if (currentEntry) {
        contentLines.push(lines[i]);
      }
    }

    // 保存最后一个条目
    if (currentEntry) {
      currentEntry.content = contentLines.join('\n').trim();
      entries.push(currentEntry);
    }

    return entries;
  }
  
  /**
   * 查找记忆条目的位置
   * @param {string} entryId - 记忆 ID
   * @returns {Promise<Object|null>} 位置对象 {file, id, line} 或 null
   */
  async findEntryLocation(entryId) {
    const files = this.getMemoryFiles();
    
    for (const file of files) {
      const filePath = path.join(this.memoryDir, file);
      if (!fs.existsSync(filePath)) {
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 检查是否包含 ID
        const idMatch = line.match(/\*\*id\*\*:\s*(.+)/i);
        
        if (idMatch && idMatch[1] === entryId) {
          return { file, id: entryId, line: i + 1 };
        }
      }
    }
    
    return null;
  }
  
  /**
   * 更新条目标签
   * @param {string} filePath - 文件路径
   * @param {Object} entry - 更新的条目对象
   */
  async updateEntryTags(filePath, entry) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 查找条目 ID
      const idMatch = line.match(/\*\*id\*\*:\s*(.+)/);
      
      if (idMatch && idMatch[1] === entry.id) {
        // 找到条目的开始和结束
        let startLine = i + 1;
        let endLine = lines.length;
        
        // 查找条目的结束（下一个 ## 开头或文件结束）
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('## ')) {
            endLine = j;
            break;
          }
        }
        
        // 提取条目内容
        const entryContent = lines.slice(startLine, endLine).join('\n');
        
        // 更新标签
        const updatedEntry = this.updateEntryMetadata(entryContent, entry);
        
        // 替换原条目
        lines.splice(startLine, endLine - startLine + 1, ...updatedEntry.split('\n'));
        
        // 写回文件
        fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
        return;
      }
    }
    
    throw new Error(`Entry not found in file: ${entry.id}`);
  }
  
  /**
   * 更新条目的元数据标签
   * @param {string} content - 条目内容
   * @param {Object} entry - 包含新标签的条目对象
   * @returns {string} 更新后的条目内容
   */
  updateEntryMetadata(content, entry) {
    let updatedContent = content;
    
    // 更新现有的元数据标签
    const metadataFields = [
      { tag: 'project_tag', key: 'project_tag', value: entry.project_tag || 'unclassified' },
      { tag: 'project_id', key: 'project_id', value: entry.project_id || 'null' },
      { tag: 'project_name', key: 'project_name', value: entry.project_name || 'null' },
      { tag: 'uploaded', key: 'uploaded', value: entry.uploaded || 'false' },
      { tag: 'upload_timestamp', key: 'upload_timestamp', value: entry.upload_timestamp || null },
      { tag: 'upload_error', key: 'upload_error', value: entry.upload_error || 'null' },
      { tag: 'classification_confidence', key: 'classification_confidence', value: entry.classification_confidence || null },
      { tag: 'classified_at', key: 'classified_at', value: entry.classified_at || null }
    ];
    
    for (const field of metadataFields) {
      const tagPattern = new RegExp(`\\*\\*${field.tag}\\*\\*:\\s*(${field.value}|null)\\s*`, 'g');
      
      // 如果标签不存在，插入到条目开头（在 content 和 ## 标题之后）
      if (!content.includes(`${field.tag}:`)) {
        const contentParts = content.split('## General Entry');
        if (contentParts.length >= 2) {
          updatedContent = contentParts[0] + '\n\n' + `${field.tag}: ${field.value}\n\n` + contentParts[1];
        }
      } else {
        updatedContent = `## General Entry\n\n${field.tag}: ${field.value}\n\n${content}`;
      }
      
      if (tagPattern.test(updatedContent)) {
        updatedContent = updatedContent.replace(tagPattern, `$1${field.value}`);
      }
    }
    
    return updatedContent;
  }
  
  /**
   * 获取所有记忆文件
   * @returns {Array<string>} 记忆文件列表
   */
  getMemoryFiles() {
    const files = [
      'MEMORY.md',
      'GLOBAL_MEMORY.md',
      'PROJECT_MEMORY.md',
      'SOUL.md',
      'AGENTS.md',
      'USER.md',
      'IDENTITY.md',
      'TOOLS.md',
      'HEARTBEAT.md',
      'BOOT.md',
      'BOOTSTRAP.md'
    ];
    
    return files;
  }
  
  /**
   * 获取指定文件的内容
   * @param {string} file - 文件名
   * @returns {string} 文件内容
   */
  getFileContent(file) {
    const filePath = path.join(this.memoryDir, file);
    if (!fs.existsSync(filePath)) {
      return '';
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }
  
  /**
   * 创建必要的目录和文件（如果不存在）
   */
  ensureMemoryStructure() {
    // 确保主目录存在
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    
    // 创建默认配置文件
    if (!fs.existsSync(this.configFile)) {
      const defaultConfig = {
        version: '2.4.0',
        projects: {
          global: {
            id: 'global',
            name: 'Global',
            firstSeen: null,
            lastSeen: new Date().toISOString(),
            entryCount: 0,
            uploadedCount: 0,
            classificationConfidenceAvg: null
          }
        }
      };
      
      fs.writeFileSync(this.configFile, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    }
  }
  
  /**
   * 保存项目配置
   * @param {Object} projects - 项目配置对象
   */
  saveProjects(projects) {
    fs.writeFileSync(this.projectsConfig, JSON.stringify(projects, null, 2), 'utf-8');
  }
  
  /**
   * 写入文件（追加模式）
   * @param {string} filePath - 文件路径
   * @param {string} content - 写入内容
   */
  async appendToFile(filePath, content) {
    try {
      // 确保文件存在
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 检查文件是否存在，如果不存在则创建并写入标题
      if (!fs.existsSync(filePath)) {
        // 根据文件名生成标题
        const fileName = path.basename(filePath, '.md');
        const title = `# ${fileName}\n`;
        
        fs.writeFileSync(filePath, title + content + '\n\n', 'utf-8');
        return;
      }
      
      // 追加到文件末尾
      fs.appendFileSync(filePath, content + '\n', 'utf-8');
    } catch (error) {
      console.error(`Failed to write to file ${filePath}:`, error.message);
      throw error;
    }
  }
  
  /**
   * 标准化项目 ID
   * @param {string} projectId - 项目 ID
   * @returns {string} 标准化的项目 ID
   */
  normalizeProjectId(projectId) {
    if (!projectId) return null;
    return projectId.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
  
  /**
   * 首字母大写
   * @param {string} text - 文本
   * @returns {string} 首字母大写的文本
   */
  capitalizeFirstLetter(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

/**
 * Create or get singleton instance
 */
let memoryManagerInstance = null;

export function getMemoryManager(options = {}) {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager(options);
  }
  return memoryManagerInstance;
}

export default getMemoryManager;