#!/usr/bin/env node
/**
 * OpenCode Agent 集成脚本
 * 
 * 为 OpenCode Agent 提供自动化的设计治理支持
 * 
 * 功能：
 * 1. 自动解析 Agent 的提交信息，提取 Design-Ref
 * 2. 自动更新 RTM 状态
 * 3. 生成提交建议
 * 
 * Usage: node scripts/opencode-integration.js <action> [options]
 * Actions:
 *   suggest-commit    根据当前变更生成提交建议
 *   update-rtm        根据最近提交更新 RTM
 *   verify-design     验证实现是否符合设计
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RTM_FILE = path.join(__dirname, '..', 'docs', 'v3.2', 'RTM.md');
const DESIGN_DOCS_DIR = path.join(__dirname, '..', 'docs', 'v3.2');

class OpenCodeIntegration {
  constructor() {
    this.rtmContent = '';
  }

  log(message, type = 'info') {
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      agent: '🤖'
    }[type];
    console.log(`${prefix} ${message}`);
  }

  /**
   * 为 Agent 生成提交建议
   */
  suggestCommit() {
    this.log('Analyzing changes for commit suggestion...', 'agent');
    
    try {
      // 获取变更的文件
      const changedFiles = execSync('git diff --name-only HEAD', {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      }).split('\n').filter(Boolean);
      
      if (changedFiles.length === 0) {
        this.log('No changes detected', 'warning');
        return;
      }
      
      this.log(`Changed files: ${changedFiles.length}`, 'info');
      
      // 分析变更类型
      const analysis = this.analyzeChanges(changedFiles);
      
      // 查找相关设计文档
      const designRefs = this.findRelatedDesignDocs(analysis);
      
      // 生成提交建议
      const suggestion = this.generateCommitSuggestion(analysis, designRefs);
      
      this.printCommitSuggestion(suggestion);
      
    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
    }
  }

  analyzeChanges(files) {
    const analysis = {
      type: 'feat',
      module: '',
      description: '',
      files: files
    };
    
    // 根据文件路径判断类型和模块
    for (const file of files) {
      if (file.includes('test')) {
        analysis.type = 'test';
      } else if (file.includes('docs')) {
        analysis.type = 'docs';
      } else if (file.includes('fix') || file.includes('bug')) {
        analysis.type = 'fix';
      }
      
      if (file.includes('websocket') || file.includes('ws')) {
        analysis.module = 'websocket';
      } else if (file.includes('precompute')) {
        analysis.module = 'precompute';
      } else if (file.includes('schema')) {
        analysis.module = 'schema';
      } else if (file.includes('api')) {
        analysis.module = 'api';
      }
    }
    
    // 生成描述
    const fileNames = files.map(f => path.basename(f)).join(', ');
    analysis.description = `Update ${fileNames.substring(0, 50)}`;
    
    return analysis;
  }

  findRelatedDesignDocs(analysis) {
    const refs = [];
    
    // 根据模块查找对应的设计文档
    const moduleToDoc = {
      'websocket': 'BACKEND-v3.2-WEBSOCKET.md',
      'precompute': 'BACKEND-v3.2-PRECOMPUTE.md',
      'schema': 'DATABASE-v3.2-SCHEMA.md',
      'api': 'PLUGIN-v3.2-API.md'
    };
    
    if (analysis.module && moduleToDoc[analysis.module]) {
      refs.push(moduleToDoc[analysis.module]);
    }
    
    return refs;
  }

  generateCommitSuggestion(analysis, designRefs) {
    return {
      type: analysis.type,
      module: analysis.module,
      description: analysis.description,
      designRefs: designRefs,
      body: this.generateCommitBody(analysis, designRefs)
    };
  }

  generateCommitBody(analysis, designRefs) {
    let body = '';
    
    // 添加设计引用
    if (designRefs.length > 0) {
      body += '\nDesign-Ref:\n';
      for (const ref of designRefs) {
        body += `  - ${ref}\n`;
      }
    }
    
    // 添加变更说明
    body += '\nChanges:\n';
    for (const file of analysis.files.slice(0, 5)) {
      body += `  - ${file}\n`;
    }
    if (analysis.files.length > 5) {
      body += `  - ... and ${analysis.files.length - 5} more files\n`;
    }
    
    return body;
  }

  printCommitSuggestion(suggestion) {
    console.log('\n' + '='.repeat(70));
    console.log('🤖 OpenCode Agent Commit Suggestion');
    console.log('='.repeat(70) + '\n');
    
    console.log('Suggested commit message:');
    console.log('-'.repeat(70));
    console.log(`${suggestion.type}(${suggestion.module}): ${suggestion.description}`);
    console.log(suggestion.body);
    console.log('-'.repeat(70) + '\n');
    
    console.log('To use this suggestion:');
    console.log('  1. Review the Design-Ref links');
    console.log('  2. Adjust the description if needed');
    console.log('  3. Commit with: git commit -m "<message>"');
    console.log('\n' + '='.repeat(70) + '\n');
  }

  /**
   * 自动更新 RTM
   */
  updateRTM() {
    this.log('Updating RTM based on recent commits...', 'agent');
    
    try {
      // 调用 update-rtm.js 脚本
      const output = execSync('node scripts/update-rtm.js --all', {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      console.log(output);
      
      this.log('RTM update completed', 'success');
      
    } catch (error) {
      this.log(`RTM update failed: ${error.message}`, 'error');
    }
  }

  /**
   * 验证设计符合性
   */
  verifyDesign() {
    this.log('Verifying design compliance...', 'agent');
    
    try {
      // 调用检查脚本
      const output = execSync('node scripts/check-design-compliance.js --all', {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });
      
      console.log(output);
      
    } catch (error) {
      // 检查失败时输出错误信息
      console.log(error.stdout || error.message);
      process.exit(1);
    }
  }

  /**
   * 获取 RTM 状态摘要（供 Agent 使用）
   */
  getRTMSummary() {
    try {
      if (!fs.existsSync(RTM_FILE)) {
        return { error: 'RTM file not found' };
      }
      
      const content = fs.readFileSync(RTM_FILE, 'utf8');
      
      const pending = (content.match(/⏳/g) || []).length;
      const inProgress = (content.match(/🔄/g) || []).length;
      const warning = (content.match(/⚠️/g) || []).length;
      const completed = (content.match(/✅/g) || []).length;
      const cancelled = (content.match(/❌/g) || []).length;
      
      const total = pending + inProgress + warning + completed + cancelled;
      const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
      
      return {
        total,
        pending,
        inProgress,
        warning,
        completed,
        cancelled,
        completionRate,
        status: completionRate >= 80 ? 'ON_TRACK' : completionRate >= 50 ? 'AT_RISK' : 'BEHIND'
      };
      
    } catch (error) {
      return { error: error.message };
    }
  }

  printRTMSummary() {
    const summary = this.getRTMSummary();
    
    if (summary.error) {
      this.log(summary.error, 'error');
      return;
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 RTM Status Summary');
    console.log('='.repeat(70));
    console.log(`Total Items: ${summary.total}`);
    console.log(`  ⏳ Pending: ${summary.pending}`);
    console.log(`  🔄 In Progress: ${summary.inProgress}`);
    console.log(`  ⚠️ Warning: ${summary.warning}`);
    console.log(`  ✅ Completed: ${summary.completed}`);
    console.log(`  ❌ Cancelled: ${summary.cancelled}`);
    console.log(`Completion Rate: ${summary.completionRate}%`);
    console.log(`Status: ${summary.status}`);
    console.log('='.repeat(70) + '\n');
  }

  run(action) {
    switch (action) {
      case 'suggest-commit':
        this.suggestCommit();
        break;
      case 'update-rtm':
        this.updateRTM();
        break;
      case 'verify-design':
        this.verifyDesign();
        break;
      case 'rtm-summary':
        this.printRTMSummary();
        break;
      default:
        this.log('Unknown action. Available actions:', 'error');
        this.log('  - suggest-commit: Generate commit suggestion', 'info');
        this.log('  - update-rtm: Update RTM based on commits', 'info');
        this.log('  - verify-design: Verify design compliance', 'info');
        this.log('  - rtm-summary: Show RTM status summary', 'info');
        process.exit(1);
    }
  }
}

// 主入口
const action = process.argv[2];

if (!action) {
  console.log('Usage: node scripts/opencode-integration.js <action>');
  console.log('Actions: suggest-commit, update-rtm, verify-design, rtm-summary');
  process.exit(1);
}

const integration = new OpenCodeIntegration();
integration.run(action);
