/**
 * 测试数据生成器
 * 生成模拟60天使用的各种类型数据
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 预定义的模拟数据模板
const DATA_TEMPLATES = {
  // 代码偏好和约定
  codingPreferences: [
    "用户偏好使用TypeScript而不是JavaScript",
    "代码风格偏好使用2空格缩进",
    "函数命名偏好使用camelCase",
    "类命名偏好使用PascalCase",
    "常量命名偏好使用UPPER_SNAKE_CASE",
    "注释偏好使用JSDoc格式",
    "测试文件命名偏好使用*.test.ts",
    "Git提交信息偏好使用Conventional Commits",
  ],

  // 开发决策
  decisions: [
    "决定使用PostgreSQL作为主数据库，因为支持复杂查询和事务",
    "决定采用微服务架构，以便于团队协作和独立部署",
    "决定使用React作为前端框架，因为生态丰富",
    "决定使用Docker进行容器化部署，提高环境一致性",
    "决定使用GitHub Actions作为CI/CD工具，因为与GitHub集成紧密",
    "决定采用TDD开发模式，提高代码质量",
    "决定使用Redis作为缓存层，提高性能",
    "决定使用GraphQL作为API层，提高查询效率",
  ],

  // 成功模式
  successfulPatterns: [
    "成功模式：使用try-catch处理异步错误，避免未捕获的Promise拒绝",
    "成功模式：在API端点中使用输入验证，防止无效数据",
    "成功模式：使用环境变量管理配置，避免硬编码",
    "成功模式：在数据库查询中使用索引，提高查询性能",
    "成功模式：使用日志记录关键操作，便于调试",
    "成功模式：在关键路径添加单元测试，提高代码覆盖率",
    "成功模式：使用中间件处理跨域请求，简化API设计",
    "成功模式：使用缓存减少重复计算，提高性能",
  ],

  // 教训和错误
  lessons: [
    "教训：忘记在Promise链中添加.catch()导致错误被吞噬",
    "教训：在生产环境中使用console.log泄露敏感信息",
    "教训：没有设置数据库连接池导致连接耗尽",
    "教训：忘记处理API限流导致服务被阻断",
    "教训：没有添加适当的超时处理导致请求挂起",
    "教训：在循环中使用await导致性能下降",
    "教训：没有验证用户输入导致SQL注入漏洞",
    "教训：忘记释放资源导致内存泄漏",
  ],

  // 用户偏好设置
  userSettings: [
    "编辑器偏好使用VS Code",
    "终端偏好使用PowerShell",
    "代码格式化工具偏好使用Prettier",
    "代码检查工具偏好使用ESLint",
    "包管理器偏好使用npm",
    "版本控制系统偏好使用Git",
    "测试框架偏好使用Jest",
    "文档工具偏好使用Markdown",
  ],

  // 日常上下文
  dailyContext: [
    "今天正在实现用户认证功能",
    "正在调试登录流程中的会话管理问题",
    "正在优化数据库查询性能",
    "正在编写API文档",
    "正在处理用户反馈的bug",
    "正在设计新的功能模块",
    "正在进行代码审查",
    "正在重构旧代码",
  ],

  // 代码片段
  codeSnippets: [
    "async function fetchData(url) { try { const response = await fetch(url); return await response.json(); } catch (error) { console.error('Fetch error:', error); } }",
    "const debounce = (func, wait) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; };",
    "const formatDate = (date) => { return new Intl.DateTimeFormat('zh-CN').format(date); };",
    "class EventEmitter { constructor() { this.events = {}; } on(event, listener) { if (!this.events[event]) this.events[event] = []; this.events[event].push(listener); } emit(event, ...args) { this.events[event]?.forEach(listener => listener(...args)); } }",
  ],

  // 项目约定
  projectConventions: [
    "所有API端点必须添加版本号前缀，如/api/v1/users",
    "所有数据库迁移必须创建up和down脚本",
    "所有敏感配置必须使用环境变量",
    "所有公共API必须添加OpenAPI文档",
    "所有关键操作必须添加审计日志",
    "所有用户输入必须进行验证和清理",
    "所有错误必须记录详细的堆栈跟踪",
    "所有性能关键路径必须添加性能监控",
  ],

  // 技术决策
  techDecisions: [
    "使用TypeScript的类型系统减少运行时错误",
    "使用JWT进行无状态认证",
    "使用WebSocket实现实时通信",
    "使用Redis实现分布式缓存",
    "使用消息队列处理异步任务",
    "使用CDN加速静态资源加载",
    "使用Gzip压缩HTTP响应",
    "使用HTTPS加密所有通信",
  ],

  // 问题解决方案
  solutions: [
    "解决方案：使用指数退避算法处理重试逻辑",
    "解决方案：使用连接池管理数据库连接",
    "解决方案：使用限流算法防止API滥用",
    "解决方案：使用熔断器模式保护系统稳定性",
    "解决方案：使用读写分离提高数据库性能",
    "解决方案：使用缓存预热减少冷启动时间",
    "解决方案：使用负载均衡分散请求压力",
    "解决方案：使用异步处理提高吞吐量",
  ],

  // 临时笔记
  notes: [
    "记住检查内存使用情况",
    "需要更新API文档",
    "记得添加单元测试",
    "需要优化这个查询",
    "记住处理边界条件",
    "需要添加错误处理",
    "记得提交代码",
    "需要更新依赖",
  ],
};

// 标签池
const TAGS = [
  'coding', 'preference', 'decision', 'pattern', 'lesson',
  'user-setting', 'context', 'note', 'project', 'technical',
  'solution', 'performance', 'security', 'api', 'database',
  'frontend', 'backend', 'testing', 'documentation', 'refactor',
  'debugging', 'optimization', 'architecture', 'best-practice',
];

/**
 * 生成随机记忆内容
 */
export function generateMemoryContent(type, day) {
  const templates = {
    'long-term': [
      ...DATA_TEMPLATES.codingPreferences,
      ...DATA_TEMPLATES.decisions,
      ...DATA_TEMPLATES.successfulPatterns,
      ...DATA_TEMPLATES.lessons,
      ...DATA_TEMPLATES.projectConventions,
      ...DATA_TEMPLATES.techDecisions,
      ...DATA_TEMPLATES.solutions,
    ],
    'daily': [
      ...DATA_TEMPLATES.dailyContext,
      ...DATA_TEMPLATES.notes,
    ],
    'preference': DATA_TEMPLATES.userSettings,
  };

  const contentPool = templates[type] || templates['long-term'];
  const content = contentPool[Math.floor(Math.random() * contentPool.length)];

  // 添加日期前缀，使内容更真实
  const datePrefix = `第${day}天: `;
  return datePrefix + content;
}

/**
 * 生成随机标签
 */
export function generateTags(count = 2) {
  const shuffled = [...TAGS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count).join(',');
}

/**
 * 生成60天的模拟数据
 */
export function generate60DayData() {
  const data = {
    day1: [], // 初始化阶段: 100条
    day2: [],
    day3: [],
    day4: [],  // 开发调试: 50条
    day5: [],
    day6: [],
    day7: [],
    day8: [],  // 文档编写: 30条
    day9: [],
    day10: [],
    day11: [], // 日常开发: 200条
    day12: [],
    day13: [],
    day14: [],
    day15: [],
    day16: [],
    day17: [],
    day18: [],
    day19: [],
    day20: [],
    day21: [], // 功能迭代: 150条
    day22: [],
    day23: [],
    day24: [],
    day25: [],
    day26: [],
    day27: [],
    day28: [],
    day29: [],
    day30: [],
    day31: [], // 重构项目: 300条
    day32: [],
    day33: [],
    day34: [],
    day35: [],
    day36: [], // 并发协作: 200条
    day37: [],
    day38: [],
    day39: [],
    day40: [],
    day41: [], // 压力测试: 100条
    day42: [],
    day43: [],
    day44: [],
    day45: [],
    day46: [], // 归档整理: 100条
    day47: [],
    day48: [],
    day49: [],
    day50: [],
    day51: [], // 历史查询: 50条
    day52: [],
    day53: [],
    day54: [],
    day55: [],
    day56: [], // 长期验证: 50条
    day57: [],
    day58: [],
    day59: [],
    day60: [],
  };

  // 阶段1: 初期使用（第1-10天）
  const stage1Days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7', 'day8', 'day9', 'day10'];
  stage1Days.forEach((day, index) => {
    const count = index < 3 ? 33 : (index < 7 ? 17 : 15);
    for (let i = 0; i < count; i++) {
      data[day].push({
        type: Math.random() > 0.3 ? 'long-term' : 'daily',
        content: generateMemoryContent(Math.random() > 0.3 ? 'long-term' : 'daily', parseInt(day.slice(3))),
        tags: generateTags(Math.floor(Math.random() * 3) + 1),
      });
    }
  });

  // 阶段2: 稳定使用（第11-30天）
  const stage2Days = [];
  for (let i = 11; i <= 30; i++) {
    stage2Days.push(`day${i}`);
  }
  stage2Days.forEach((day, index) => {
    const count = index < 10 ? 20 : (index < 20 ? 15 : 10);
    for (let i = 0; i < count; i++) {
      data[day].push({
        type: Math.random() > 0.4 ? 'daily' : (Math.random() > 0.5 ? 'long-term' : 'preference'),
        content: generateMemoryContent(Math.random() > 0.4 ? 'daily' : (Math.random() > 0.5 ? 'long-term' : 'preference'), parseInt(day.slice(3))),
        tags: generateTags(Math.floor(Math.random() * 3) + 1),
      });
    }
  });

  // 阶段3: 高频使用（第31-45天）
  const stage3Days = [];
  for (let i = 31; i <= 45; i++) {
    stage3Days.push(`day${i}`);
  }
  stage3Days.forEach((day, index) => {
    const count = index < 5 ? 60 : (index < 10 ? 50 : 20);
    for (let i = 0; i < count; i++) {
      data[day].push({
        type: Math.random() > 0.5 ? 'daily' : 'long-term',
        content: generateMemoryContent(Math.random() > 0.5 ? 'daily' : 'long-term', parseInt(day.slice(3))),
        tags: generateTags(Math.floor(Math.random() * 3) + 1),
      });
    }
  });

  // 阶段4: 长期使用（第46-60天）
  const stage4Days = [];
  for (let i = 46; i <= 60; i++) {
    stage4Days.push(`day${i}`);
  }
  stage4Days.forEach((day, index) => {
    const count = index < 5 ? 20 : (index < 10 ? 10 : 5);
    for (let i = 0; i < count; i++) {
      data[day].push({
        type: Math.random() > 0.3 ? 'long-term' : 'daily',
        content: generateMemoryContent(Math.random() > 0.3 ? 'long-term' : 'daily', parseInt(day.slice(3))),
        tags: generateTags(Math.floor(Math.random() * 3) + 1),
      });
    }
  });

  return data;
}

/**
 * 生成测试查询
 */
export function generateTestQueries(count = 50) {
  const queries = [];

  // 精确查询
  queries.push(
    { type: 'keyword', query: 'TypeScript' },
    { type: 'keyword', query: '数据库' },
    { type: 'keyword', query: 'API' },
    { type: 'keyword', query: '错误处理' },
    { type: 'keyword', query: '性能优化' },
  );

  // 语义查询
  queries.push(
    { type: 'semantic', query: '如何提高代码质量' },
    { type: 'semantic', query: '最佳实践' },
    { type: 'semantic', query: '遇到的技术问题' },
    { type: 'semantic', query: '项目架构决策' },
    { type: 'semantic', query: '开发效率提升' },
  );

  // 模糊查询
  queries.push(
    { type: 'fuzzy', query: '类型' },
    { type: 'fuzzy', query: '数据库' },
    { type: 'fuzzy', query: '缓存' },
    { type: 'fuzzy', query: '认证' },
    { type: 'fuzzy', query: '测试' },
  );

  // 跨语言查询
  queries.push(
    { type: 'multilingual', query: 'database' },
    { type: 'multilingual', query: 'performance' },
    { type: 'multilingual', query: 'API设计' },
    { type: 'multilingual', query: '错误处理' },
    { type: 'multilingual', query: '代码风格' },
  );

  // 随机生成剩余查询
  for (let i = queries.length; i < count; i++) {
    const types = ['keyword', 'semantic', 'fuzzy', 'multilingual'];
    const type = types[Math.floor(Math.random() * types.length)];
    const keywords = ['代码', '数据库', 'API', '性能', '安全', '测试', '文档', '架构', '优化', '重构'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    queries.push({ type, query: keyword });
  }

  return queries;
}

/**
 * 导出生成的数据到文件
 */
export async function exportGeneratedData(data, filename = 'generated-test-data.json') {
  const outputPath = path.join(__dirname, '..', 'test-results', filename);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✅ 测试数据已导出到: ${outputPath}`);
}

/**
 * 获取统计信息
 */
export function getDataStatistics(data) {
  const totalDays = Object.keys(data).length;
  const totalRecords = Object.values(data).reduce((sum, day) => sum + day.length, 0);

  const typeDistribution = {
    'long-term': 0,
    'daily': 0,
    'preference': 0,
  };

  Object.values(data).flat().forEach(record => {
    typeDistribution[record.type]++;
  });

  return {
    totalDays,
    totalRecords,
    typeDistribution,
    averageRecordsPerDay: (totalRecords / totalDays).toFixed(2),
  };
}

export default {
  generateMemoryContent,
  generateTags,
  generate60DayData,
  generateTestQueries,
  exportGeneratedData,
  getDataStatistics,
};
