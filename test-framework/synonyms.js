/**
 * 同义词表
 * 用于查询扩展，提升搜索Recall
 */

const SYNONYM_DICT = {
  // 编程语言
  'typescript': ['ts', 'type script', '类型脚本'],
  'javascript': ['js', 'java script', '脚本语言'],
  'python': ['py', '爬虫语言', 'python语言'],
  'java': ['java语言', '后端语言'],
  'go': ['golang', 'go语言'],
  
  // 数据库
  '数据库': ['database', 'db', '数据存储', 'data store'],
  'postgresql': ['postgres', 'pg', 'postgresql数据库'],
  'mysql': ['mysql数据库', '关系数据库'],
  'mongodb': ['mongo', 'nosql', '文档数据库'],
  'redis': ['缓存', 'redis缓存', '内存数据库'],
  'sqlite': ['sqlite3', '轻量级数据库', '嵌入式数据库'],
  'nosql': ['非关系型数据库', 'not only sql', '非关系型'],
  
  // 前端技术
  'react': ['reactjs', 'react框架'],
  'vue': ['vuejs', 'vue框架'],
  'angular': ['angularjs', 'angular框架'],
  'frontend': ['前端', '前端开发', 'front-end'],
  '前端开发': ['frontend development', '前端工程'],
  
  // 后端技术
  'backend': ['后端', '后端开发', '后端架构'],
  'api': ['接口', 'web服务', 'rest api', 'graphql'],
  'rest': ['restful', 'restful api'],
  'graphql': ['gql', 'graph ql'],
  
  // 测试
  '测试': ['test', '单元测试', '集成测试', 'integration test'],
  '测试框架': ['testing framework', 'test framework'],
  'jest': ['jest测试', 'jest框架'],
  'mocha': ['mocha测试', 'mocha框架'],
  '测试驱动开发': ['tdd', 'test driven development'],
  
  // 质量保证
  '错误监控': ['error monitoring', 'error tracking'],
  'sentry': ['监控', '监控平台'],
  '日志': ['logging', '日志记录', 'log'],
  '调试': ['debug', 'debugging', '故障排除'],
  
  // 性能优化
  '性能优化': ['performance optimization', 'perf optimization'],
  'web性能': ['web performance', '前端性能', 'frontend performance'],
  '缓存': ['cache', 'caching', '缓存策略'],
  '缓存策略': ['cache strategy', 'caching strategy'],
  
  // 架构设计
  '微服务': ['microservice', 'microservices', '微服务架构'],
  '架构': ['architecture', '系统架构', 'software architecture'],
  '设计模式': ['design pattern', '设计范式'],
  '最佳实践': ['best practice', 'best practices'],
  
  // 并发与安全
  '并发编程': ['concurrency', '并发处理', 'parallel programming'],
  '异步': ['async', 'asynchronous', '异步编程'],
  '认证': ['authentication', 'auth', '身份验证'],
  'jwt': ['json web token', 'token认证', 'token'],
  '权限': ['authorization', '授权', 'permission'],
  
  // 系统编程
  '内存安全': ['memory safety', '内存管理', 'memory management'],
  '并发': ['concurrent', '并行', 'parallel'],
  '多线程': ['multithreading', 'threading'],
  
  // 数据相关
  '数据一致性': ['data consistency', '一致性'],
  '事务': ['transaction', '数据库事务', 'db transaction'],
  '事务处理': ['transaction processing', 'acid'],
  'acid': ['acid事务', '事务属性'],
  
  // 工具链
  '持续集成': ['ci', 'continuous integration', 'cicd'],
  '持续部署': ['cd', 'continuous deployment'],
  'devops': ['开发运维', '运维自动化'],
  'docker': ['容器化', '容器技术'],
  'kubernetes': ['k8s', '容器编排', '集群管理'],
  
  // 开发方法论
  '敏捷开发': ['agile', 'scrum', 'kanban'],
  '代码审查': ['code review', 'cr', '代码评审'],
  '版本控制': ['version control', 'vc', 'git'],
  '分支管理': ['branch management', '版本分支管理'],
  
  // 编程概念
  '类型': ['type', '数据类型', 'data type'],
  '类型系统': ['type system', '类型检查'],
  '类型检查': ['type checking', 'type checking', 'static typing'],
  '类型提示': ['type hints', '类型注解'],
  
  // 通用术语
  '如何': ['how to', '怎样', '方法'],
  '最佳': ['best', 'top', '最优'],
  '优化': ['optimize', 'improve', '改进'],
  '实现': ['implement', '实现方式'],
  '设计': ['design', '架构设计', '系统设计'],
  
  // 英文术语
  'optimization': ['优化', '改进', '提升'],
  'database optimization': ['数据库优化', 'db优化', '性能调优'],
  'types': ['类型', '数据类型'],
  'web': ['网页', 'web应用', '网站'],
  'app': ['应用', '应用程序'],
};

/**
 * 展开查询为多个变体
 */
function expandQuery(query) {
  const expansions = [query];
  const lowerQuery = query.toLowerCase();
  
  for (const [term, synonyms] of Object.entries(SYNONYM_DICT)) {
    if (lowerQuery.includes(term)) {
      for (const synonym of synonyms) {
        // 为每个同义词创建扩展查询
        expansions.push(query.replace(new RegExp(term, 'gi'), synonym));
      }
      break;
    }
  }
  
  return [...new Set(expansions)]; // 去重
}

/**
 * 获取查询的同义词
 */
function getSynonyms(query) {
  const synonyms = [];
  const lowerQuery = query.toLowerCase();
  
  for (const [term, termSynonyms] of Object.entries(SYNONYM_DICT)) {
    if (lowerQuery.includes(term)) {
      synonyms.push(...termSynonyms);
    }
  }
  
  return [...new Set(synonyms)];
}

export { SYNONYM_DICT, expandQuery, getSynonyms };
export default SYNONYM_DICT;