/**
 * 测试数据生成器
 * 生成各种类型的大规模测试数据
 */

import { createHash } from 'crypto';

// 测试数据模板
const TEMPLATES = {
  code: [
    '用户偏好使用 {language} 进行开发，代码风格偏好 {style}',
    '项目中使用 {framework} 框架，版本 {version}',
    '遇到 {problem} 问题，解决方案是 {solution}',
    '实现了 {feature} 功能，使用 {tech} 技术',
    '代码审查发现 {issue}，建议 {suggestion}',
  ],
  meeting: [
    '会议讨论 {topic}，结论是 {conclusion}',
    '决定采用 {decision} 方案，负责人 {owner}',
    '会议时间 {time}，参与者 {participants}',
    '讨论 {issue} 问题，需要进一步调研',
    '确定了 {milestone} 里程碑，截止日期 {deadline}',
  ],
  research: [
    '研究 {technology} 技术，发现 {finding}',
    '调研 {tool} 工具，优缺点 {pros_cons}',
    '阅读 {book} 书籍，笔记 {notes}',
    '学习 {skill} 技能，进度 {progress}',
    '分析 {data} 数据，结论 {conclusion}',
  ],
  bug: [
    '发现 Bug: {description}，影响 {impact}',
    'Bug 修复: {fix}，测试 {test}',
    '问题排查: {problem}，根因 {root_cause}',
    '紧急修复 {issue}，已部署 {deploy_status}',
    '回归测试 {feature}，结果 {result}',
  ],
  decision: [
    '技术选型: 选择 {option}，理由 {reason}',
    '架构决策: 采用 {architecture}，考虑 {factors}',
    '方案对比: {option1} vs {option2}，选择 {choice}',
    '风险评估: {risk}，应对措施 {mitigation}',
    '成本分析: {cost}，收益 {benefit}',
  ],
};

const FILLERS = {
  language: [
    'TypeScript',
    'Python',
    'Rust',
    'Go',
    'Java',
    'C++',
    'JavaScript',
    'Kotlin',
    'Swift',
    'Ruby',
  ],
  style: ['函数式', '面向对象', '模块化', '响应式', '声明式', '命令式'],
  framework: [
    'React',
    'Vue',
    'Angular',
    'Express',
    'Django',
    'FastAPI',
    'Spring',
    'Flutter',
    'React Native',
  ],
  version: ['v1.0', 'v2.0', 'v3.0', 'v4.0', 'v5.0', 'latest', 'stable', 'beta'],
  problem: ['性能瓶颈', '内存泄漏', '并发冲突', '接口不兼容', '数据不一致', '安全漏洞'],
  solution: ['缓存优化', '异步处理', '限流降级', '重构代码', '引入中间件', '增加监控'],
  feature: ['用户认证', '支付系统', '消息通知', '数据导出', '权限管理', '日志系统'],
  tech: ['Redis', 'Kafka', 'Elasticsearch', 'GraphQL', 'WebSocket', 'gRPC', 'Docker', 'Kubernetes'],
  issue: ['代码重复', '命名不规范', '缺少注释', '测试覆盖率低', '循环依赖'],
  suggestion: ['提取公共函数', '重命名变量', '添加 JSDoc', '补充单元测试', '解耦模块'],
  topic: ['技术架构', '产品规划', '团队建设', '代码规范', '发布计划', '性能优化'],
  conclusion: ['同意方案', '需要修改', '暂缓实施', '重新评估', '分阶段实施'],
  decision: ['微服务', '单体应用', 'Serverless', '容器化', '云原生'],
  owner: ['张三', '李四', '王五', '赵六', '前端组', '后端组', 'DevOps组'],
  time: ['周一上午', '周二下午', '周三全天', '周四晚上', '周五下午'],
  participants: ['全员', '技术组', '产品组', '管理层', '项目组'],
  milestone: ['MVP', 'Beta', '正式版', 'v2.0', '重构完成'],
  deadline: ['本月底', '下月初', '季度末', '年底前', '下周'],
  technology: ['AI/ML', '区块链', '物联网', '大数据', '云计算', '边缘计算'],
  finding: ['可行', '需要优化', '成本过高', '技术成熟', '有替代方案'],
  tool: ['Git', 'Jira', 'Confluence', 'Figma', 'Postman', 'Docker', 'K8s'],
  pros_cons: ['功能强大但复杂', '易用但功能有限', '开源但文档少', '商业但支持好'],
  book: ['设计模式', '重构', 'Clean Code', '人月神话', '黑客与画家'],
  notes: ['重要概念', '实践技巧', '常见误区', '最佳实践'],
  skill: ['系统设计', '性能调优', '代码审查', '自动化测试', 'CI/CD'],
  progress: ['初学者', '入门', '熟练', '精通', '专家'],
  data: ['用户行为', '系统日志', '性能指标', '业务数据', '错误报告'],
  description: ['页面卡顿', '数据丢失', '功能异常', '接口超时', '显示错误'],
  impact: ['所有用户', '部分用户', '特定浏览器', '移动端', '特定地区'],
  fix: ['修复逻辑错误', '优化 SQL', '增加缓存', '修复边界条件', '更新依赖'],
  test: ['单元测试', '集成测试', 'E2E测试', '性能测试', '回归测试'],
  root_cause: ['配置错误', '逻辑缺陷', '并发问题', '资源不足', '第三方故障'],
  deploy_status: ['已上线', '灰度发布', '测试中', '待部署'],
  result: ['通过', '失败', '部分通过', '需要修复'],
  option: ['方案A', '方案B', '方案C', '自建', '采购'],
  reason: ['成本考虑', '技术栈匹配', '团队熟悉', '社区活跃', '长期支持'],
  architecture: ['微服务', '单体', 'SOA', '事件驱动', '分层架构'],
  factors: ['可扩展性', '可维护性', '性能', '成本', '团队能力'],
  option1: ['React', 'Vue', 'MySQL', 'PostgreSQL', 'REST', 'GraphQL'],
  option2: ['Angular', 'Svelte', 'MongoDB', 'Redis', 'gRPC', 'WebSocket'],
  choice: ['前者', '后者', '混合方案', '都不选'],
  risk: ['技术风险', '进度风险', '成本风险', '人员风险', '市场风险'],
  mitigation: ['技术预研', '分阶段实施', '增加预算', '招聘培训', '市场调研'],
  cost: ['人力成本', '服务器成本', '第三方服务', '时间成本'],
  benefit: ['效率提升', '用户体验', '技术积累', '业务增长'],
};

/**
 * 随机选择数组元素
 */
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 填充模板
 */
function fillTemplate(template) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    if (FILLERS[key]) {
      return randomChoice(FILLERS[key]);
    }
    return match;
  });
}

/**
 * 生成单条记忆
 */
function generateMemory(type, index) {
  const templates = TEMPLATES[type] || TEMPLATES.code;
  const template = randomChoice(templates);
  const content = fillTemplate(template);

  const tags = [type];
  if (Math.random() > 0.5) tags.push(randomChoice(['重要', '紧急', '待跟进', '已完成']));
  if (Math.random() > 0.7) tags.push(randomChoice(['前端', '后端', 'DevOps', '测试', '设计']));

  return {
    content: `${content} (${index + 1})`,
    type: type,
    tags: tags,
    project_id: randomChoice(['project-a', 'project-b', 'project-c', 'global']),
    metadata: {
      generated: true,
      index: index,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 批量生成记忆
 * @param {number} count - 生成数量
 * @param {string} type - 记忆类型
 */
export function generateMemories(count, type = 'code') {
  const memories = [];
  for (let i = 0; i < count; i++) {
    memories.push(generateMemory(type, i));
  }
  return memories;
}

/**
 * 生成混合类型的记忆
 * @param {number} count - 每种类型生成数量
 */
export function generateMixedMemories(count = 100) {
  const memories = [];
  const types = Object.keys(TEMPLATES);

  types.forEach(type => {
    for (let i = 0; i < count; i++) {
      memories.push(generateMemory(type, i));
    }
  });

  // 打乱顺序
  return memories.sort(() => Math.random() - 0.5);
}

/**
 * 生成特定项目的记忆
 * @param {number} count - 数量
 * @param {string} projectId - 项目ID
 */
export function generateProjectMemories(count, projectId) {
  const memories = generateMixedMemories(Math.floor(count / 5));
  return memories.slice(0, count).map(m => ({
    ...m,
    project_id: projectId,
  }));
}

/**
 * 生成用于图关系测试的记忆网络
 * @param {number} nodeCount - 节点数
 * @param {number} edgeDensity - 边密度 (0-1)
 */
export function generateGraphMemories(nodeCount, edgeDensity = 0.3) {
  const memories = [];

  // 生成节点
  for (let i = 0; i < nodeCount; i++) {
    memories.push({
      content: `节点记忆 ${i + 1}: ${fillTemplate(randomChoice(TEMPLATES.code))}`,
      type: 'code',
      tags: ['graph', 'test'],
      project_id: 'graph-test',
      metadata: { nodeIndex: i },
    });
  }

  // 生成边关系 (在调用处使用)
  const relations = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      if (Math.random() < edgeDensity) {
        relations.push({
          from: i,
          to: j,
          type: randomChoice(['related', 'follow_up', 'elaboration', 'reference']),
          weight: Math.random(),
        });
      }
    }
  }

  return { memories, relations };
}

/**
 * 生成不同大小的测试数据集
 */
export function generateTestDatasets() {
  return {
    small: generateMixedMemories(20), // 100条
    medium: generateMixedMemories(100), // 500条
    large: generateMixedMemories(500), // 2500条
    xlarge: generateMixedMemories(1000), // 5000条
  };
}

/**
 * 导出统计数据
 */
export function getStats(memories) {
  const typeCount = {};
  const tagCount = {};
  let totalLength = 0;

  memories.forEach(m => {
    typeCount[m.type] = (typeCount[m.type] || 0) + 1;
    m.tags.forEach(tag => {
      tagCount[tag] = (tagCount[tag] || 0) + 1;
    });
    totalLength += m.content.length;
  });

  return {
    total: memories.length,
    types: typeCount,
    tags: tagCount,
    avgLength: Math.round(totalLength / memories.length),
    totalChars: totalLength,
  };
}

// CLI 用法
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = parseInt(process.argv[2]) || 100;
  const type = process.argv[3] || 'mixed';

  console.log(`Generating ${count} test memories...\n`);

  let memories;
  if (type === 'mixed') {
    memories = generateMixedMemories(Math.floor(count / 5));
  } else {
    memories = generateMemories(count, type);
  }

  // 只取前count个
  memories = memories.slice(0, count);

  const stats = getStats(memories);
  console.log('Statistics:');
  console.log(`  Total: ${stats.total}`);
  console.log(`  Types: ${JSON.stringify(stats.types)}`);
  console.log(`  Avg Length: ${stats.avgLength} chars`);
  console.log(`  Total Chars: ${stats.totalChars}`);

  // 输出前3条示例
  console.log('\nSample memories:');
  memories.slice(0, 3).forEach((m, i) => {
    console.log(`\n${i + 1}. [${m.type}] ${m.content.substring(0, 100)}...`);
    console.log(`   Tags: ${m.tags.join(', ')}`);
  });
}
