/**
 * Project Resolver - 解析当前项目的 project_id
 *
 * 策略优先级：
 * 1. 配置文件显式指定 (backend.project_id)
 * 2. 项目映射文件 (project-mappings.json)
 * 3. Git remote URL (格式: @owner/repo)
 * 4. package.json name
 * 5. 绝对路径哈希 (格式: dirname-hash8)
 * 6. 当前目录名
 * 7. 兜底值 'global'
 *
 * 同时支持 project-mappings.json 解决同一项目多目录问题
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const HOME = process.env.HOME || process.env.USERPROFILE;
const MEMORY_DIR = path.join(HOME, '.opencode', 'memory');
const MAPPINGS_FILE = path.join(MEMORY_DIR, 'project-mappings.json');

/**
 * 规范化路径 (统一分隔符，转为小写)
 */
function normalizePath(p) {
  return path.resolve(p).toLowerCase().replace(/\\/g, '/');
}

/**
 * 从 Git remote URL 提取项目ID
 * 格式: @owner/repo 或 @org/subgroup/project
 *
 * 支持格式:
 * - HTTPS: https://github.com/user/repo.git -> @user/repo
 * - SSH: git@github.com:user/repo.git -> @user/repo
 * - 多级: https://gitlab.com/org/sub/proj.git -> @org/sub/proj
 */
function extractProjectIdFromGitUrl(url) {
  if (!url) return null;

  url = url.replace(/\.git$/, '');

  // 处理 SSH 格式: git@github.com:user/repo
  if (url.includes('@') && url.includes(':')) {
    const match = url.match(/@[^:]+:(.+)$/);
    if (match) {
      return '@' + match[1];
    }
  }

  // 处理 HTTPS 格式: https://github.com/user/repo
  url = url.replace(/^https?:\/\//, '');
  const pathMatch = url.match(/^[^/]+\/(.+)$/);
  if (pathMatch) {
    return '@' + pathMatch[1];
  }

  return null;
}

function getConfigProjectId(config) {
  return config?.backend?.project_id || null;
}

function generateProjectIdFromAbsPath(cwd) {
  const normalized = path.resolve(cwd).toLowerCase().replace(/\\/g, '/');
  const hash = crypto.createHash('md5').update(normalized).digest('hex').substring(0, 8);
  const dirName = path.basename(cwd);
  return `${dirName}-${hash}`;
}

/**
 * 尝试读取 package.json
 */
function readPackageJson(cwd) {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const content = fs.readFileSync(pkgPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 尝试获取 Git remote URL
 */
function getGitRemote(cwd) {
  try {
    const result = execSync('git remote get-url origin', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * 读取 project mappings
 */
function readProjectMappings() {
  try {
    if (fs.existsSync(MAPPINGS_FILE)) {
      const content = fs.readFileSync(MAPPINGS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch {
    // ignore
  }
  return { mappings: {} };
}

/**
 * 查找目录对应的 project_id (通过 mappings)
 */
function findProjectByMapping(cwd, mappings) {
  const normalizedCwd = normalizePath(cwd);

  for (const [projectId, projectData] of Object.entries(mappings)) {
    const paths = projectData.paths || [];
    for (const projectPath of paths) {
      if (normalizePath(projectPath) === normalizedCwd) {
        return projectId;
      }
    }
  }

  return null;
}

/**
 * ProjectResolver 类
 */
export class ProjectResolver {
  constructor(config = {}) {
    this.config = config;
    this.cwd = process.cwd();
    this.cache = null;
    this.strategy = config.backend?.project_resolution?.strategy || 'auto';
    this.priority = config.backend?.project_resolution?.priority || [
      'config',
      'mapping',
      'git',
      'package',
      'abspath',
      'dirname',
    ];
  }

  /**
   * 解析 project_id
   * @returns {Promise<string>} project_id
   */
  async resolve() {
    if (this.cache) {
      return this.cache;
    }

    // 如果策略是手动，返回 default
    if (this.strategy === 'manual') {
      return 'global';
    }

    // 按优先级尝试
    for (const strategy of this.priority) {
      const result = await this.tryStrategy(strategy);
      if (result) {
        this.cache = result;
        return result;
      }
    }

    // 兜底
    return 'global';
  }

  /**
   * 尝试特定策略
   */
  async tryStrategy(strategy) {
    switch (strategy) {
      case 'config':
        return getConfigProjectId(this.config);

      case 'git': {
        const remote = getGitRemote(this.cwd);
        const projectId = extractProjectIdFromGitUrl(remote);
        if (process.env.DEBUG_PROJECT_RESOLVER) {
          console.log('[ProjectResolver] git strategy:', { cwd: this.cwd, remote, projectId });
        }
        return projectId;
      }

      case 'package': {
        const pkg = readPackageJson(this.cwd);
        return pkg?.name || null;
      }

      case 'abspath':
        return generateProjectIdFromAbsPath(this.cwd);

      case 'dirname': {
        const dirName = path.basename(this.cwd);
        if (['src', 'dist', 'build', 'test', 'docs'].includes(dirName)) {
          return null;
        }
        return dirName;
      }

      case 'mapping': {
        const mappings = readProjectMappings();
        return findProjectByMapping(this.cwd, mappings.mappings || {});
      }

      default:
        return null;
    }
  }

  /**
   * 获取解析详情 (用于调试)
   */
  async resolveWithDetails() {
    const details = [];

    for (const strategy of this.priority) {
      const result = await this.tryStrategy(strategy);
      details.push({
        strategy,
        result,
        used: !result,
      });
      if (result) break;
    }

    const final = await this.resolve();

    return {
      project_id: final,
      details,
      cwd: this.cwd,
    };
  }

  /**
   * 保存当前目录到 mappings
   * @param {string} projectId - 要关联的 project_id
   */
  async saveMapping(projectId) {
    const mappings = readProjectMappings();

    if (!mappings.mappings[projectId]) {
      mappings.mappings[projectId] = { paths: [] };
    }

    const normalizedCwd = normalizePath(this.cwd);
    const existingPaths = mappings.mappings[projectId].paths.map(normalizePath);

    if (!existingPaths.includes(normalizedCwd)) {
      mappings.mappings[projectId].paths.push(this.cwd);
    }

    // 确保目录存在
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }

    fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = null;
  }
}

/**
 * 便捷函数
 */
export async function resolveProjectId(config) {
  const resolver = new ProjectResolver(config);
  return await resolver.resolve();
}

export async function resolveProjectIdWithDetails(config) {
  const resolver = new ProjectResolver(config);
  return await resolver.resolveWithDetails();
}

export async function saveProjectMapping(projectId, config) {
  const resolver = new ProjectResolver(config);
  await resolver.saveMapping(projectId);
}
