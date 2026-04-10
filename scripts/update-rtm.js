#!/usr/bin/env node
/**
 * RTM 自动更新脚本
 * 
 * 根据 git 提交自动更新 RTM 状态
 * 
 * Usage: node scripts/update-rtm.js [options]
 * Options:
 *   --commit <hash>    指定提交哈希
 *   --dry-run          预览变更，不实际修改
 *   --check            检查 RTM 状态
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RTM_FILE = path.join(__dirname, '..', 'docs', 'v3.2', 'RTM.md');

class RTMUpdater {
  constructor(options = {}) {
    this.options = options;
    this.rtmContent = '';
    this.changes = [];
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

  loadRTM() {
    if (!fs.existsSync(RTM_FILE)) {
      throw new Error(`RTM file not found: ${RTM_FILE}`);
    }
    this.rtmContent = fs.readFileSync(RTM_FILE, 'utf8');
  }

  saveRTM() {
    if (this.options.dryRun) {
      this.log('Dry run mode - not saving changes', 'warning');
      return;
    }
    fs.writeFileSync(RTM_FILE, this.rtmContent, 'utf8');
    this.log('RTM updated successfully', 'success');
  }

  getRecentCommits(count = 10) {
    try {
      const output = execSync(`git log --pretty=format:"%H|%s|%b" -${count}`, {
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });
      
      return output.split('\n').filter(Boolean).map(line => {
        const [hash, subject, ...bodyParts] = line.split('|');
        return {
          hash,
          subject,
          body: bodyParts.join('|'),
          fullMessage: `${subject}\n${bodyParts.join('|')}`
        };
      });
    } catch (error) {
      this.log(`Failed to get commits: ${error.message}`, 'error');
      return [];
    }
  }

  extractDesignRefs(message) {
    const refs = [];
    const regex = /Design-Ref:\s*([^\n]+)/g;
    let match;
    while ((match = regex.exec(message)) !== null) {
      refs.push(match[1].trim());
    }
    return refs;
  }

  extractCloses(message) {
    const closes = [];
    const regex = /Closes:\s*(BL-[A-Z0-9-]+)/g;
    let match;
    while ((match = regex.exec(message)) !== null) {
      closes.push(match[1]);
    }
    return closes;
  }

  parseDesignRef(ref) {
    // 格式: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
    // 或: BACKEND-v3.2-WEBSOCKET.md#3.1
    const match = ref.match(/([^#]+)#?(.+)?/);
    if (match) {
      return {
        doc: match[1],
        section: match[2] || ''
      };
    }
    return { doc: ref, section: '' };
  }

  findRTMEntry(designRef) {
    const parsed = this.parseDesignRef(designRef);
    
    // 在 RTM 中查找匹配项
    // 匹配逻辑：查找包含设计文档引用的行
    const lines = this.rtmContent.split('\n');
    const entries = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 检查是否包含设计文档引用
      if (line.includes(parsed.doc) || line.includes(parsed.doc.replace('.md', ''))) {
        // 检查是否是表格行（包含状态符号）
        if (line.includes('⏳') || line.includes('🔄') || line.includes('⚠️') || line.includes('✅') || line.includes('❌')) {
          entries.push({ line: i, content: line });
        }
      }
    }
    
    return entries;
  }

  updateRTMStatus(entries, newStatus) {
    const statusMap = {
      'pending': '⏳',
      'in-progress': '🔄',
      'warning': '⚠️',
      'completed': '✅',
      'cancelled': '❌'
    };
    
    const newStatusSymbol = statusMap[newStatus] || newStatus;
    
    for (const entry of entries) {
      const oldLine = entry.content;
      // 替换状态符号
      let newLine = oldLine;
      
      for (const symbol of Object.values(statusMap)) {
        if (oldLine.includes(symbol)) {
          newLine = oldLine.replace(symbol, newStatusSymbol);
          break;
        }
      }
      
      if (oldLine !== newLine) {
        this.rtmContent = this.rtmContent.replace(oldLine, newLine);
        this.changes.push({
          old: oldLine.trim(),
          new: newLine.trim(),
          status: newStatus
        });
        this.log(`Updated: ${oldLine.substring(0, 60)}... -> ${newStatusSymbol}`, 'success');
      }
    }
  }

  processCommit(commit) {
    this.log(`\nProcessing commit: ${commit.hash.substring(0, 7)} - ${commit.subject.substring(0, 50)}`, 'info');
    
    const designRefs = this.extractDesignRefs(commit.fullMessage);
    const closes = this.extractCloses(commit.fullMessage);
    
    if (designRefs.length === 0 && closes.length === 0) {
      this.log('No Design-Ref or Closes found', 'warning');
      return;
    }
    
    this.log(`Found ${designRefs.length} Design-Ref(s), ${closes.length} Closes`, 'info');
    
    // 根据提交类型判断状态
    let newStatus = 'in-progress';
    if (commit.subject.startsWith('feat:') || commit.subject.startsWith('fix:')) {
      newStatus = 'completed';
    } else if (commit.subject.startsWith('wip:') || commit.subject.startsWith('WIP:')) {
      newStatus = 'in-progress';
    }
    
    // 处理 Design-Ref
    for (const ref of designRefs) {
      this.log(`Design-Ref: ${ref}`, 'info');
      const entries = this.findRTMEntry(ref);
      
      if (entries.length > 0) {
        this.log(`Found ${entries.length} RTM entry(s)`, 'success');
        this.updateRTMStatus(entries, newStatus);
      } else {
        this.log(`No RTM entry found for: ${ref}`, 'warning');
      }
    }
    
    // 处理 Closes（直接标记为完成）
    for (const close of closes) {
      this.log(`Closes: ${close}`, 'info');
      // 在 RTM 中查找对应的 BACKLOG 项
      const entries = this.findRTMEntryByBacklog(close);
      if (entries.length > 0) {
        this.updateRTMStatus(entries, 'completed');
      }
    }
  }

  findRTMEntryByBacklog(backlogId) {
    // 在 RTM 中查找匹配的 BACKLOG 项
    const lines = this.rtmContent.split('\n');
    const entries = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 检查是否包含 BACKLOG ID
      if (line.includes(backlogId)) {
        if (line.includes('⏳') || line.includes('🔄') || line.includes('⚠️') || line.includes('✅') || line.includes('❌')) {
          entries.push({ line: i, content: line });
        }
      }
    }
    
    return entries;
  }

  checkStatus() {
    this.log('\nRTM Status Check', 'info');
    this.log('='.repeat(60), 'info');
    
    const pending = (this.rtmContent.match(/⏳/g) || []).length;
    const inProgress = (this.rtmContent.match(/🔄/g) || []).length;
    const warning = (this.rtmContent.match(/⚠️/g) || []).length;
    const completed = (this.rtmContent.match(/✅/g) || []).length;
    const cancelled = (this.rtmContent.match(/❌/g) || []).length;
    
    const total = pending + inProgress + warning + completed + cancelled;
    const completionRate = total > 0 ? (completed / total * 100).toFixed(1) : 0;
    
    this.log(`Total Items: ${total}`, 'info');
    this.log(`  ⏳ Pending: ${pending}`, 'info');
    this.log(`  🔄 In Progress: ${inProgress}`, 'info');
    this.log(`  ⚠️ Warning: ${warning}`, 'warning');
    this.log(`  ✅ Completed: ${completed}`, 'success');
    this.log(`  ❌ Cancelled: ${cancelled}`, 'info');
    this.log(`Completion Rate: ${completionRate}%`, 'info');
    
    return {
      total,
      pending,
      inProgress,
      warning,
      completed,
      cancelled,
      completionRate
    };
  }

  printSummary() {
    if (this.changes.length === 0) {
      this.log('\nNo changes made to RTM', 'info');
      return;
    }
    
    this.log('\n' + '='.repeat(60), 'info');
    this.log('RTM Update Summary', 'info');
    this.log('='.repeat(60), 'info');
    
    for (const change of this.changes) {
      this.log(`\n${change.old}`, 'info');
      this.log(`-> ${change.new}`, 'success');
    }
    
    this.log(`\nTotal changes: ${this.changes.length}`, 'info');
    this.log('='.repeat(60), 'info');
  }

  async run() {
    try {
      this.log('RTM Auto-Updater\n', 'info');
      
      // 加载 RTM
      this.loadRTM();
      this.log(`Loaded RTM: ${RTM_FILE}`, 'success');
      
      // 检查模式
      if (this.options.check) {
        this.checkStatus();
        return;
      }
      
      // 获取提交
      const commits = this.options.commit 
        ? [{ hash: this.options.commit, subject: 'Manual', body: '', fullMessage: '' }]
        : this.getRecentCommits(10);
      
      this.log(`Processing ${commits.length} commit(s)\n`, 'info');
      
      // 处理每个提交
      for (const commit of commits) {
        this.processCommit(commit);
      }
      
      // 打印摘要
      this.printSummary();
      
      // 保存
      this.saveRTM();
      
      // 最终状态检查
      this.checkStatus();
      
    } catch (error) {
      this.log(`Error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
const options = {
  commit: args.find((arg, i) => arg === '--commit' && args[i + 1]) ? args[args.indexOf('--commit') + 1] : null,
  dryRun: args.includes('--dry-run'),
  check: args.includes('--check')
};

const updater = new RTMUpdater(options);
updater.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
