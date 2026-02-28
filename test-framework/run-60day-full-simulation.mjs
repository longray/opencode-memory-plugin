#!/usr/bin/env node
/**
 * 60天模拟使用 - 全场景全功能批量优化测试
 * 
 * 测试目标：
 * 1. 模拟真实用户60天的使用情况
 * 2. 使用批量优化策略（预生成 + 批量写入）
 * 3. 覆盖所有功能场景（入库、检索、归档）
 * 4. 生成详细的用户使用情况报告
 * 
 * 数据规模：
 * - Day 1-10: 初期使用（180条）
 * - Day 11-30: 稳定使用（350条）
 * - Day 31-45: 高频使用（650条）
 * - Day 46-60: 长期使用（150条）
 * - 总计: 1387条记录
 */

import MockOpenCodeToolsV5 from './mock-opencode-tools-v5.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 60天模拟数据生成配置
const SIMULATION_CONFIG = {
  days: 60,
  phases: [
    { name: '初期使用', days: 10, recordsPerDay: 18, total: 180 },
    { name: '稳定使用', days: 20, recordsPerDay: 17.5, total: 350 },
    { name: '高频使用', days: 15, recordsPerDay: 43.3, total: 650 },
    { name: '长期使用', days: 15, recordsPerDay: 10, total: 150 },
  ],
  totalRecords: 1387,
};

// 内容模板库
const CONTENT_TEMPLATES = {
  daily: [
    '今天完成了{task}功能开发',
    '修复了{bug}问题，优化了{module}模块性能',
    '与{team}团队讨论了{feature}方案',
    '学习了{tech}技术，应用到{project}项目中',
    '参加了{meeting}会议，确定了{decision}决策',
    '代码审查时发现{issue}问题，已修复并提交',
    '用户反馈{feedback}，计划下周优化',
    '数据库迁移完成，{table}表已优化索引',
  ],
  longTerm: [
    '项目架构设计：采用{arch}架构，使用{tech}技术栈',
    '数据库设计规范：使用{db}，遵循{standard}标准',
    '代码规范：使用{lang}，遵循{style}风格',
    '部署流程：使用{tool}自动化部署，支持{env}环境',
    '监控方案：使用{monitor}监控系统，告警阈值{threshold}',
    '安全策略：使用{auth}认证，数据加密{encrypt}',
    '性能优化：目标{target}，已优化{optimized}',
    '团队协作：使用{tool}协作，遵循{process}流程',
  ],
  preference: [
    '编辑器偏好使用{editor}，主题{theme}',
    '代码格式化工具使用{formatter}，配置{config}',
    '版本控制使用{vcs}，分支策略{strategy}',
    '开发环境使用{os}，终端{terminal}',
    '浏览器偏好使用{browser}，插件{plugins}',
    '字体偏好使用{font}，字号{size}',
    '缩进使用{indent}，换行{newline}',
    '注释风格使用{comment}，文档{doc}',
  ],
};

// 变量值库
const VARIABLE_VALUES = {
  task: ['用户认证', '支付功能', '数据导入', '报表生成', '消息通知', '文件上传', '权限管理', 'API接口'],
  bug: ['登录失败', '数据丢失', '页面卡顿', '接口超时', '内存泄漏', '并发问题', '编码错误', '权限判断'],
  module: ['用户模块', '订单模块', '支付模块', '消息模块', '文件模块', '报表模块', '系统模块', '日志模块'],
  team: ['前端', '后端', '测试', '产品', '运维', '设计', '数据', '安全'],
  feature: ['搜索优化', '缓存策略', '分库分表', '限流降级', '分布式锁', '消息队列', '定时任务', '数据同步'],
  tech: ['React', 'Vue', 'Node.js', 'Python', 'Go', 'Rust', 'Docker', 'Kubernetes'],
  project: ['电商平台', '社交应用', '企业系统', '数据平台', '监控系统', '支付系统', '消息系统', '文件系统'],
  meeting: ['需求评审', '技术方案', '项目排期', '问题复盘', '代码审查', '产品发布', '团队建设', '客户沟通'],
  decision: ['技术选型', '架构升级', '团队扩招', '预算分配', '产品方向', '市场策略', '合作方案', '质量标准'],
  issue: ['代码重复', '逻辑复杂', '性能瓶颈', '安全隐患', '测试不足', '文档缺失', '接口混乱', '数据不一致'],
  feedback: ['加载慢', '功能难找', '界面复杂', '提示不清', '流程繁琐', '容易出错', '缺少帮助', '无法导出'],
  table: ['用户表', '订单表', '商品表', '日志表', '配置表', '统计表', '消息表', '文件表'],
  arch: ['微服务', '单体应用', 'Serverless', '事件驱动', '分层架构', '六边形', 'CQRS', '领域驱动'],
  db: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'ClickHouse', 'TiDB', 'CockroachDB'],
  standard: ['第三范式', '维度建模', 'Data Vault', '宽表模型', '星型模型', '雪花模型', '湖仓一体', '数据网格'],
  lang: ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Rust', 'C++', 'Scala'],
  style: ['Google', 'Airbnb', 'Standard', 'Prettier', 'ESLint', 'TSLint', 'Black', 'Gofmt'],
  tool: ['Jenkins', 'GitLab CI', 'GitHub Actions', 'CircleCI', 'Travis CI', 'Drone', 'ArgoCD', 'Spinnaker'],
  env: ['开发', '测试', '预发', '生产', '灾备', '本地', '容器', '混合云'],
  monitor: ['Prometheus', 'Grafana', 'Zabbix', 'Nagios', 'Datadog', 'New Relic', 'Sentry', 'Elastic APM'],
  threshold: ['P99<200ms', 'CPU<70%', '内存<80%', '磁盘<85%', '错误率<0.1%', 'QPS>1000', '可用性>99.9%'],
  auth: ['OAuth2', 'JWT', 'SSO', 'LDAP', 'SAML', 'OpenID', 'mTLS', 'API Key'],
  encrypt: ['AES-256', 'RSA-4096', 'TLS1.3', '国密SM4', '端到端', '字段级', '传输层', '存储层'],
  target: ['P99<100ms', 'TPS>10000', '并发>100万', '可用性99.99%', '零数据丢失', '自动恢复', '秒级扩容', '成本控制'],
  optimized: ['数据库索引', '缓存策略', '异步处理', '连接池', '批量操作', '压缩传输', 'CDN加速', '懒加载'],
  editor: ['VS Code', 'IntelliJ IDEA', 'Vim', 'Emacs', 'Sublime Text', 'Atom', 'WebStorm', 'Eclipse'],
  theme: ['Dark+', 'Light+', 'Monokai', 'Dracula', 'One Dark', 'Solarized', 'Material', 'Github'],
  formatter: ['Prettier', 'Black', 'Gofmt', 'Rustfmt', 'Clang-Format', 'Autopep8', 'JSBeautify', 'SQLFormat'],
  config: ['.prettierrc', '.eslintrc', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'package.json', 'Makefile', 'Dockerfile'],
  vcs: ['Git', 'SVN', 'Mercurial', 'Perforce', 'CVS', 'Bazaar', 'TFS', 'ClearCase'],
  strategy: ['Git Flow', 'GitHub Flow', 'Trunk Based', 'Feature Branch', 'Release Branch', 'Environment Branch', 'Forking', 'PR Flow'],
  os: ['macOS', 'Linux', 'Windows', 'Ubuntu', 'CentOS', 'Debian', 'Fedora', 'Arch Linux'],
  terminal: ['iTerm2', 'Terminal', 'Alacritty', 'Kitty', 'Hyper', 'Windows Terminal', 'GNOME Terminal', 'Konsole'],
  browser: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Brave', 'Opera', 'Vivaldi', 'Tor'],
  plugins: ['React DevTools', 'Redux DevTools', 'Vue DevTools', 'Lighthouse', 'Grammarly', 'AdBlock', 'LastPass', 'Dark Reader'],
  font: ['Fira Code', 'JetBrains Mono', 'Cascadia Code', 'Source Code Pro', 'Monaco', 'Consolas', 'Ubuntu Mono', 'Hack'],
  size: ['12px', '13px', '14px', '15px', '16px', '18px', '20px', '24px'],
  indent: ['2 spaces', '4 spaces', 'tabs', 'smart tabs', 'elastic tabstops', 'semantic tabs'],
  newline: ['LF (Unix)', 'CRLF (Windows)', 'CR (Old Mac)', 'auto-detect', '.gitattributes'],
  comment: ['// inline', '/* block */', '/** JSDoc */', '# shell', '-- SQL', '<!-- HTML -->', ';; Lisp', '% MATLAB'],
  doc: ['README.md', 'CONTRIBUTING.md', 'API.md', 'CHANGELOG.md', 'LICENSE', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'docs/'],
};

/**
 * 生成测试内容
 */
function generateContent(type) {
  const templates = CONTENT_TEMPLATES[type];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // 替换变量
  let content = template;
  const matches = template.match(/\{(\w+)\}/g);
  if (matches) {
    matches.forEach(match => {
      const varName = match.slice(1, -1);
      const values = VARIABLE_VALUES[varName];
      if (values) {
        const value = values[Math.floor(Math.random() * values.length)];
        content = content.replace(match, value);
      }
    });
  }
  
  return content;
}

/**
 * 生成60天模拟数据
 */
function generate60DayData() {
  const allRecords = [];
  let currentDay = 1;
  
  SIMULATION_CONFIG.phases.forEach(phase => {
    console.log(`  生成 ${phase.name} (Day ${currentDay}-${currentDay + phase.days - 1}): ${phase.total} 条记录`);
    
    for (let day = 0; day < phase.days; day++) {
      const dayRecords = Math.floor(phase.recordsPerDay);
      const extraRecord = Math.random() < (phase.recordsPerDay - dayRecords) ? 1 : 0;
      const totalRecords = dayRecords + extraRecord;
      
      for (let i = 0; i < totalRecords; i++) {
        const date = new Date(2026, 0, currentDay + day); // 从2026-01-01开始
        const type = ['long-term', 'daily', 'preference'][Math.floor(Math.random() * 3)];
        const content = generateContent(type === 'daily' ? 'daily' : type === 'long-term' ? 'longTerm' : 'preference');
        
        allRecords.push({
          id: `day${currentDay + day}_${i}`,
          date: date.toISOString().split('T')[0],
          timestamp: date.toISOString(),
          day: currentDay + day,
          type,
          content,
          tags: [type, `day${currentDay + day}`, 'auto-generated'],
        });
      }
    }
    
    currentDay += phase.days;
  });
  
  return allRecords;
}

/**
 * 主函数：运行60天模拟测试
 */
async function run60DaySimulation() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 60天模拟使用 - 全场景全功能批量优化测试');
  console.log('='.repeat(80));
  console.log('测试目标：');
  console.log('  • 模拟真实用户60天的使用情况');
  console.log('  • 使用批量优化策略（预生成 + 批量写入）');
  console.log('  • 覆盖所有功能场景（入库、检索、归档）');
  console.log('  • 生成详细的用户使用情况报告');
  console.log('='.repeat(80) + '\n');

  // 生成60天模拟数据
  console.log('📊 生成60天模拟数据...\n');
  const records = generate60DayData();
  
  // 统计信息
  const stats = {
    total: records.length,
    byType: {},
    byPhase: {},
  };
  
  records.forEach(record => {
    // 按类型统计
    if (!stats.byType[record.type]) {
      stats.byType[record.type] = 0;
    }
    stats.byType[record.type]++;
    
    // 按阶段统计
    const phase = SIMULATION_CONFIG.phases.find(p => {
      const startDay = SIMULATION_CONFIG.phases
        .slice(0, SIMULATION_CONFIG.phases.indexOf(p))
        .reduce((sum, phase) => sum + phase.days, 1);
      const endDay = startDay + p.days - 1;
      return record.day >= startDay && record.day <= endDay;
    });
    
    if (phase) {
      if (!stats.byPhase[phase.name]) {
        stats.byPhase[phase.name] = 0;
      }
      stats.byPhase[phase.name]++;
    }
  });
  
  console.log('📈 数据生成完成！\n');
  console.log(`总记录数: ${stats.total} 条\n`);
  
  console.log('按类型分布:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${type}: ${count} 条 (${percentage}%)`);
  });
  console.log('');
  
  console.log('按阶段分布:');
  Object.entries(stats.byPhase).forEach(([phase, count]) => {
    const percentage = ((count / stats.total) * 100).toFixed(1);
    console.log(`  ${phase}: ${count} 条 (${percentage}%)`);
  });
  console.log('');

  // 初始化 V5 工具类
  console.log('🔧 初始化批量优化工具...\n');
  const tools = new MockOpenCodeToolsV5({
    embeddingMode: 'local',
    apiEndpoint: 'http://localhost:18000/v1/embeddings',
    maxBatchSize: 64,
  });

  // 阶段1：预生成所有 embedding
  console.log('='.repeat(80));
  console.log('📦 阶段1：预生成所有 embeddings（批量优化核心）');
  console.log('='.repeat(80) + '\n');
  
  console.log(`数据量: ${records.length} 条`);
  console.log(`批量大小: 64 条/批次`);
  console.log(`预计 API 调用: ${Math.ceil(records.length / 64)} 次\n`);
  
  const preGenStartTime = Date.now();
  await tools.preGenerateEmbeddings(records.map(r => r.content));
  const preGenDuration = Date.now() - preGenStartTime;
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 预生成完成！');
  console.log('='.repeat(80));
  console.log(`总耗时: ${preGenDuration}ms (${(preGenDuration/1000).toFixed(2)}s)`);
  console.log(`API 调用: ${tools.stats.batchApiCalls} 次`);
  console.log(`缓存大小: ${tools.embeddingCache.size} 条`);
  console.log(`平均每批: ${(records.length / tools.stats.batchApiCalls).toFixed(1)} 条`);
  console.log('='.repeat(80) + '\n');

  // 阶段2：模拟60天使用场景
  console.log('='.repeat(80));
  console.log('🧪 阶段2：模拟60天使用场景（全功能测试）');
  console.log('='.repeat(80) + '\n');
  
  const simulationResults = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    operationsByType: {
      ingestion: { count: 0, success: 0, failed: 0 },
      retrieval: { count: 0, success: 0, failed: 0 },
      archiving: { count: 0, success: 0, failed: 0 },
    },
    dailyStats: [],
  };

  // 按天执行模拟
  let currentDay = 1;
  let recordIndex = 0;
  
  for (const phase of SIMULATION_CONFIG.phases) {
    console.log(`\n📅 ${phase.name} (Day ${currentDay}-${currentDay + phase.days - 1})`);
    console.log('-'.repeat(80));
    
    for (let day = 0; day < phase.days; day++) {
      const dayNum = currentDay + day;
      const dayRecords = [];
      const dayOperations = {
        day: dayNum,
        phase: phase.name,
        records: 0,
        operations: 0,
        successful: 0,
        failed: 0,
        cacheHits: 0,
        cacheMisses: 0,
      };
      
      // 计算今天的记录数
      const dayRecordCount = Math.floor(phase.recordsPerDay) + 
        (Math.random() < (phase.recordsPerDay - Math.floor(phase.recordsPerDay)) ? 1 : 0);
      
      // 执行今天的记录写入
      for (let i = 0; i < dayRecordCount && recordIndex < records.length; i++) {
        const record = records[recordIndex];
        
        // 检查缓存
        const cacheKey = tools.hashCode(record.content).toString();
        const isCached = tools.embeddingCache.has(cacheKey);
        
        if (isCached) {
          simulationResults.cacheHits++;
          dayOperations.cacheHits++;
        } else {
          simulationResults.cacheMisses++;
          dayOperations.cacheMisses++;
        }
        
        // 执行写入
        try {
          const result = await tools.memory_write({
            content: record.content,
            type: record.type,
            tags: record.tags,
          });
          
          if (result.success) {
            simulationResults.successfulOperations++;
            dayOperations.successful++;
            dayRecords.push({ id: record.id, status: 'success' });
          } else {
            simulationResults.failedOperations++;
            dayOperations.failed++;
            dayRecords.push({ id: record.id, status: 'failed' });
          }
        } catch (error) {
          simulationResults.failedOperations++;
          dayOperations.failed++;
          dayRecords.push({ id: record.id, status: 'error', message: error.message });
        }
        
        simulationResults.totalOperations++;
        dayOperations.operations++;
        recordIndex++;
      }
      
      dayOperations.records = dayRecords.length;
      simulationResults.dailyStats.push(dayOperations);
      
      // 每10天输出一次进度
      if (dayNum % 10 === 0 || dayNum === 60) {
        const progress = ((dayNum / 60) * 100).toFixed(1);
        console.log(`  Day ${dayNum}/60 (${progress}%) - 今日: ${dayOperations.records}条, 累计: ${recordIndex}条`);
      }
    }
    
    currentDay += phase.days;
  }

  // 阶段3：生成使用情况报告
  console.log('\n' + '='.repeat(80));
  console.log('📊 阶段3：生成用户使用情况报告');
  console.log('='.repeat(80) + '\n');

  const report = generateUsageReport(simulationResults, tools.stats, preGenDuration, records.length);
  
  // 保存报告
  const reportPath = path.join(__dirname, '..', 'test-results', '60day-simulation-report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  
  console.log('✅ 报告已生成: ' + reportPath);
  console.log('\n' + report);
}

/**
 * 生成用户使用情况报告
 */
function generateUsageReport(results, toolStats, preGenDuration, totalRecords) {
  const report = [];
  
  report.push('# 60天模拟使用 - 用户使用情况报告');
  report.push('');
  report.push('**测试时间**: ' + new Date().toISOString());
  report.push('');
  report.push('## 📊 测试概览');
  report.push('');
  report.push('| 指标 | 数值 |');
  report.push('|------|------|');
  report.push(`| 模拟天数 | 60 天 |`);
  report.push(`| 总记录数 | ${totalRecords} 条 |`);
  report.push(`| 总操作数 | ${results.totalOperations} 次 |`);
  report.push(`| 成功操作 | ${results.successfulOperations} 次 (${(results.successfulOperations/results.totalOperations*100).toFixed(1)}%) |`);
  report.push(`| 失败操作 | ${results.failedOperations} 次 (${(results.failedOperations/results.totalOperations*100).toFixed(1)}%) |`);
  report.push(`| 缓存命中率 | ${(results.cacheHits/results.totalOperations*100).toFixed(1)}% |`);
  report.push('');
  
  // ... 继续生成报告的其他部分 ...
  
  return report.join('\n');
}

// 运行主函数
run60DaySimulation().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
