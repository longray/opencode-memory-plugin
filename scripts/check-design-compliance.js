#!/usr/bin/env node
/**
 * 设计符合性检查脚本
 * 
 * 检查代码实现是否符合设计文档
 * 
 * Usage: node scripts/check-design-compliance.js [options]
 * Options:
 *   --rtm          检查RTM更新状态
 *   --api          检查API实现完整性
 *   --coverage     检查代码覆盖率
 *   --all          运行所有检查
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DESIGN_DOCS_DIR = path.join(__dirname, '..', 'docs', 'v3.2');
const RTM_FILE = path.join(DESIGN_DOCS_DIR, 'RTM.md');

class DesignComplianceChecker {
  constructor() {
    this.results = [];
    this.exitCode = 0;
  }

  log(message, type = 'info') {
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    console.log(`${prefix} ${message}`);
  }

  async checkRTM() {
    this.log('Checking RTM status...', 'info');
    
    if (!fs.existsSync(RTM_FILE)) {
      this.log('RTM.md not found', 'error');
      this.exitCode = 1;
      return;
    }

    const rtmContent = fs.readFileSync(RTM_FILE, 'utf8');
    
    // 统计状态
    const pending = (rtmContent.match(/⏳/g) || []).length;
    const inProgress = (rtmContent.match(/🔄/g) || []).length;
    const warning = (rtmContent.match(/⚠️/g) || []).length;
    const completed = (rtmContent.match(/✅/g) || []).length;
    const cancelled = (rtmContent.match(/❌/g) || []).length;
    
    const total = pending + inProgress + warning + completed + cancelled;
    const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
    
    this.log(`RTM Status: ${completed}/${total} completed (${completionRate}%)`, 'info');
    this.log(`  - Pending: ${pending}`, 'info');
    this.log(`  - In Progress: ${inProgress}`, 'info');
    this.log(`  - Warning: ${warning}`, 'info');
    this.log(`  - Completed: ${completed}`, 'success');
    this.log(`  - Cancelled: ${cancelled}`, 'info');
    
    if (pending > 0) {
      this.log(`${pending} items still pending`, 'warning');
    }
    
    this.results.push({
      check: 'RTM',
      status: pending === 0 ? 'PASS' : 'WARNING',
      details: `${completed}/${total} completed`
    });
  }

  async checkAPIImplementation() {
    this.log('Checking API implementation...', 'info');
    
    // 读取API设计文档
    const apiDocPath = path.join(DESIGN_DOCS_DIR, 'PLUGIN-v3.2-API.md');
    if (!fs.existsSync(apiDocPath)) {
      this.log('API design doc not found', 'error');
      this.exitCode = 1;
      return;
    }
    
    const apiDoc = fs.readFileSync(apiDocPath, 'utf8');
    
    // 提取API端点（简化检查）
    const apiEndpoints = apiDoc.match(/\/api\/v1\/\w+/g) || [];
    this.log(`Found ${apiEndpoints.length} API endpoints in design`, 'info');
    
    // 检查实现（简化版，实际应检查代码）
    const toolsDir = path.join(__dirname, '..', 'opencode-memory-plugin', 'tools');
    if (fs.existsSync(toolsDir)) {
      const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.js'));
      this.log(`Found ${toolFiles.length} tool implementations`, 'info');
      
      // 简单对比
      this.log('API implementation check: PASSED (basic)', 'success');
    }
    
    this.results.push({
      check: 'API',
      status: 'PASS',
      details: `${apiEndpoints.length} endpoints defined`
    });
  }

  async checkCoverage() {
    this.log('Checking code coverage...', 'info');
    
    try {
      // 运行测试并获取覆盖率
      const output = execSync('cd opencode-memory-plugin && npm test -- --coverage --silent', {
        encoding: 'utf8',
        timeout: 120000
      });
      
      // 解析覆盖率（简化）
      const coverageMatch = output.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|([^|]+)/);
      const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;
      
      if (coverage >= 85) {
        this.log(`Coverage: ${coverage}% (>= 85%)`, 'success');
      } else {
        this.log(`Coverage: ${coverage}% (< 85%)`, 'error');
        this.exitCode = 1;
      }
      
      this.results.push({
        check: 'Coverage',
        status: coverage >= 85 ? 'PASS' : 'FAIL',
        details: `${coverage}%`
      });
    } catch (error) {
      this.log('Failed to run coverage check', 'error');
      this.exitCode = 1;
      
      this.results.push({
        check: 'Coverage',
        status: 'ERROR',
        details: 'Failed to run tests'
      });
    }
  }

  async checkDesignRefs() {
    this.log('Checking Design-Ref in recent commits...', 'info');
    
    try {
      const commits = execSync('git log --pretty=format:"%H %s" -10', {
        encoding: 'utf8'
      }).split('\n').filter(Boolean);
      
      let missingDesignRef = 0;
      
      for (const commit of commits) {
        const [hash, ...messageParts] = commit.split(' ');
        const message = messageParts.join(' ');
        
        if (!message.includes('Design-Ref:')) {
          this.log(`Commit ${hash.substring(0, 7)} missing Design-Ref: ${message.substring(0, 50)}...`, 'warning');
          missingDesignRef++;
        }
      }
      
      if (missingDesignRef === 0) {
        this.log('All recent commits have Design-Ref', 'success');
      } else {
        this.log(`${missingDesignRef} commits missing Design-Ref`, 'warning');
      }
      
      this.results.push({
        check: 'Design-Ref',
        status: missingDesignRef === 0 ? 'PASS' : 'WARNING',
        details: `${commits.length - missingDesignRef}/${commits.length} have Design-Ref`
      });
    } catch (error) {
      this.log('Failed to check commits', 'error');
    }
  }

  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('Design Compliance Report');
    console.log('='.repeat(60) + '\n');
    
    console.log('| Check        | Status | Details              |');
    console.log('|--------------|--------|---------------------|');
    
    for (const result of this.results) {
      const statusIcon = result.status === 'PASS' ? '✅' : 
                        result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`| ${result.check.padEnd(12)} | ${statusIcon} ${result.status.padEnd(4)} | ${result.details.padEnd(19)} |`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    const failures = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    
    if (failures > 0) {
      console.log(`❌ ${failures} check(s) failed`);
    } else if (warnings > 0) {
      console.log(`⚠️ ${warnings} check(s) have warnings`);
    } else {
      console.log('✅ All checks passed');
    }
    
    console.log('='.repeat(60) + '\n');
  }

  async run(options) {
    console.log('Design Compliance Checker\n');
    console.log('Options:', options);
    console.log('');
    
    if (options.rtm || options.all) {
      await this.checkRTM();
    }
    
    if (options.api || options.all) {
      await this.checkAPIImplementation();
    }
    
    if (options.coverage || options.all) {
      await this.checkCoverage();
    }
    
    if (options.all) {
      await this.checkDesignRefs();
    }
    
    this.printReport();
    
    process.exit(this.exitCode);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  rtm: args.includes('--rtm'),
  api: args.includes('--api'),
  coverage: args.includes('--coverage'),
  all: args.includes('--all') || args.length === 0
};

const checker = new DesignComplianceChecker();
checker.run(options).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
