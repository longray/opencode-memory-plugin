# Phase B 插件端实施计划

**版本**: v2.2-lite Phase B  
**目标**: 主题组织 + 完整双模式同步  
**工作量**: 12-15小时  
**文档日期**: 2026-03-18

---

## 一、概述

### 1.1 目标

从时间线组织迁移到主题组织，实现完整的双模式同步：
- 目录重组：`timeline/YYYY/MM/DD/` → `active/{topic}/`
- 双模式同步：增量同步（日常）+ 全量同步（首次/修复）
- URL引用机制：支持跨层跳转
- link-map.json：ID到路径的映射

### 1.2 核心原则

- **灰度迁移**：逐个主题迁移，降低风险
- **主题预分析**：生成报告，用户确认后再迁移
- **一致性检查**：迁移后验证数据完整性
- **向后兼容**：保留timeline/作为备份

### 1.3 前置条件

- ✅ Phase A 已完成（分层存储、简单增量同步）
- ✅ timeline/目录有足够的测试数据
- ✅ 后端服务支持批量同步API

---

## 二、任务清单

### 任务 2.1：主题识别策略（1小时）

**目标**：从记忆条目中自动识别主题

**实施步骤**：

1. **Type到Topic的映射**：
```javascript
const TYPE_TO_TOPIC = {
  'preference': 'preferences',
  'decision': 'decisions',
  'long-term': 'knowledge',
  'general': 'general',
  'daily': 'daily'
};

function resolveTopicFromType(type) {
  return TYPE_TO_TOPIC[type] || 'general';
}
```

2. **Tags推断逻辑**：
```javascript
function resolveTopicFromTags(tags) {
  const topicKeywords = {
    'decisions': ['decision', 'architecture', 'design'],
    'preferences': ['preference', 'user-preference', 'style'],
    'patterns': ['pattern', 'best-practice', 'lesson'],
    'knowledge': ['technical', 'research', 'analysis']
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (tags.some(tag => keywords.includes(tag))) {
      return topic;
    }
  }
  
  return null;
}
```

3. **综合策略**：
```javascript
function resolveTopicFromEntry(entry) {
  // 优先级：tags > type > 默认
  const topicFromTags = resolveTopicFromTags(entry.tags);
  if (topicFromTags) return topicFromTags;
  
  return resolveTopicFromType(entry.type);
}
```

**验证**：
- 测试100条记忆，检查主题分类准确率
- 目标：>90%准确率

**预计时间**：1小时

---

### 任务 2.2：目录结构重组（1.5小时）

**目标**：创建active/{topic}/目录结构

**实施步骤**：

1. **创建主题目录**：
```javascript
const ACTIVE_DIR = path.join(MEMORY_DIR, 'active');
const TOPICS = ['decisions', 'preferences', 'patterns', 'knowledge', 'general'];

function initActiveDirectories() {
  if (!fs.existsSync(ACTIVE_DIR)) {
    fs.mkdirSync(ACTIVE_DIR, { recursive: true });
  }
  
  for (const topic of TOPICS) {
    const topicDir = path.join(ACTIVE_DIR, topic);
    if (!fs.existsSync(topicDir)) {
      fs.mkdirSync(topicDir, { recursive: true });
    }
  }
}
```

2. **迁移脚本**：
```javascript
async function migrateToActive() {
  const entries = await scanTimelineEntries();
  const topicDistribution = new Map();
  
  for (const entry of entries) {
    const topic = resolveTopicFromEntry(entry);
    const targetDir = path.join(ACTIVE_DIR, topic);
    
    // 复制文件到新位置
    const newPath = path.join(targetDir, entry.filename);
    fs.copyFileSync(entry.path, newPath);
    
    // 统计
    topicDistribution.set(topic, (topicDistribution.get(topic) || 0) + 1);
  }
  
  console.log('📊 迁移完成：');
  for (const [topic, count] of topicDistribution) {
    console.log(`  ${topic}: ${count} 条目`);
  }
}
```

**验证**：
- 检查active/目录结构
- 验证文件数量和内容完整性

**预计时间**：1.5小时

---

### 任务 2.3：link-map.json实现（1小时）

**目标**：建立Entry ID到路径的映射

**实施步骤**：

1. **数据结构设计**：
```javascript
// .index/link-map.json
{
  "version": "2.2",
  "last_updated": "2026-03-18T15:00:00Z",
  "entries": {
    "entry-001": {
      "date": "2026-03-18",
      "topic": "decisions",
      "abstract": "PostgreSQL选型决策",
      "path": "active/decisions/entry-001.md",
      "content_hash": "abc123..."
    }
  }
}
```

2. **生成link-map**：
```javascript
async function generateLinkMap() {
  const linkMap = {
    version: '2.2',
    last_updated: new Date().toISOString(),
    entries: {}
  };
  
  const files = await scanActiveDirectory();
  
  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf-8');
    const metadata = parseMetadata(content);
    const entryId = path.basename(file.path, '.md');
    
    linkMap.entries[entryId] = {
      date: metadata.date,
      topic: file.topic,
      abstract: metadata.abstract,
      path: file.path.replace(MEMORY_DIR, '~/.opencode/memory'),
      content_hash: computeHash(content)
    };
  }
  
  const linkMapPath = path.join(MEMORY_DIR, '.index', 'link-map.json');
  fs.writeFileSync(linkMapPath, JSON.stringify(linkMap, null, 2));
}
```

**验证**：
- 检查link-map.json格式
- 验证所有路径有效

**预计时间**：1小时

---

### 任务 2.4：增量同步增强（3小时）

**目标**：实现完整的增量同步机制

**实施步骤**：

1. **指纹摘要生成**（30分钟）：
```javascript
async function generateFingerprints() {
  const files = getMemoryFiles();
  const fingerprints = [];
  
  for (const file of files) {
    const stats = fs.statSync(file);
    const content = fs.readFileSync(file, 'utf-8');
    const hash = crypto.createHash('xxhash64').update(content).digest('hex');
    
    fingerprints.push({
      path: file,
      mtime: stats.mtimeMs,
      size: stats.size,
      hash: hash
    });
  }
  
  return fingerprints;
}
```

2. **变更检测**（1小时）：
```javascript
async function detectChanges() {
  const localFingerprints = await generateFingerprints();
  
  // 发送指纹到后端
  const response = await fetch(`${BACKEND_URL}/sync/detect-changes`, {
    method: 'POST',
    body: JSON.stringify({ fingerprints: localFingerprints })
  });
  
  const { to_upload, to_delete, conflicts } = await response.json();
  
  return { to_upload, to_delete, conflicts };
}
```

3. **按需上传**（1小时）：
```javascript
async function uploadChanges(to_upload) {
  const batchSize = 50;
  
  for (let i = 0; i < to_upload.length; i += batchSize) {
    const batch = to_upload.slice(i, i + batchSize);
    const contents = batch.map(path => ({
      path,
      content: fs.readFileSync(path, 'utf-8')
    }));
    
    await fetch(`${BACKEND_URL}/sync/upload-batch`, {
      method: 'POST',
      body: JSON.stringify({ files: contents })
    });
    
    console.log(`📤 已上传: ${i + batch.length}/${to_upload.length}`);
  }
}
```

4. **冲突处理**（30分钟）：
```javascript
async function resolveConflicts(conflicts) {
  for (const conflict of conflicts) {
    console.log(`⚠️ 冲突: ${conflict.path}`);
    console.log(`  本地: ${conflict.local_hash}`);
    console.log(`  远程: ${conflict.remote_hash}`);
    
    // 时间戳裁决
    if (conflict.local_mtime > conflict.remote_mtime) {
      console.log(`  → 使用本地版本（更新）`);
      await uploadFile(conflict.path);
    } else {
      console.log(`  → 使用远程版本（跳过）`);
    }
  }
}
```

**验证**：
- 修改10个文件，验证只上传这10个
- 模拟冲突，验证裁决逻辑

**预计时间**：3小时

---

### 任务 2.5：全量同步实现（3小时）

**目标**：首次同步或修复时的全量同步

**实施步骤**：

1. **流式扫描**（1小时）：
```javascript
async function* scanAllFiles() {
  const dirs = [CORE_DIR, ACTIVE_DIR];
  
  for (const dir of dirs) {
    for await (const file of walkDirectory(dir)) {
      if (file.endsWith('.md')) {
        yield file;
      }
    }
  }
}

async function* walkDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDirectory(fullPath);
    } else {
      yield fullPath;
    }
  }
}
```

2. **批量上传**（1.5小时）：
```javascript
async function fullSync() {
  const allFiles = [];
  for await (const file of scanAllFiles()) {
    allFiles.push(file);
  }
  
  console.log(`📊 总文件数: ${allFiles.length}`);
  
  // 生成指纹清单
  const fingerprints = await generateFingerprints(allFiles);
  
  // 发送到后端计算差异
  const response = await fetch(`${BACKEND_URL}/sync/full-sync`, {
    method: 'POST',
    body: JSON.stringify({ fingerprints })
  });
  
  const { to_upload, to_download, to_update, to_delete } = await response.json();
  
  // 批量上传
  await uploadChanges(to_upload);
  
  // 可选：双向同步
  if (to_download.length > 0) {
    await downloadChanges(to_download);
  }
}
```

3. **断点续传**（30分钟）：
```javascript
async function fullSyncWithCheckpoint() {
  const checkpointFile = path.join(SYNC_DIR, 'full-sync-checkpoint.json');
  let checkpoint = { uploaded: [], failed: [] };
  
  if (fs.existsSync(checkpointFile)) {
    checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
    console.log(`📍 从断点恢复: ${checkpoint.uploaded.length} 已完成`);
  }
  
  const allFiles = await getAllFiles();
  const remaining = allFiles.filter(f => !checkpoint.uploaded.includes(f));
  
  for (const file of remaining) {
    try {
      await uploadFile(file);
      checkpoint.uploaded.push(file);
      fs.writeFileSync(checkpointFile, JSON.stringify(checkpoint));
    } catch (err) {
      checkpoint.failed.push({ file, error: err.message });
      console.error(`❌ 上传失败: ${file}`);
    }
  }
}
```

**验证**：
- 首次全量同步：所有文件上传
- 中断后恢复：从断点继续
- 双向同步：下载远程新增文件

**预计时间**：3小时

---

### 任务 2.6：URL引用机制（1.5小时）

**目标**：支持跨层跳转和引用

**实施步骤**：

1. **URL格式定义**：
```javascript
// 支持的URL格式
// active/decisions/.index#postgresql
// active/decisions/.overview#section-3
// active/decisions/entry-001.md
```

2. **URL解析器**：
```javascript
function parseMemoryURL(url) {
  const match = url.match(/^active\/([^\/]+)\/([^#]+)(#(.+))?$/);
  
  if (!match) throw new Error(`Invalid URL: ${url}`);
  
  return {
    topic: match[1],
    file: match[2],
    anchor: match[4] || null
  };
}
```

3. **URL解析和跳转**：
```javascript
async function resolveMemoryURL(url) {
  const { topic, file, anchor } = parseMemoryURL(url);
  const filePath = path.join(ACTIVE_DIR, topic, file);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (anchor) {
    // 查找锚点位置
    const lines = content.split('\n');
    const anchorLine = lines.findIndex(line => 
      line.includes(`#${anchor}`) || line.includes(`id="${anchor}"`)
    );
    
    if (anchorLine === -1) {
      throw new Error(`Anchor not found: ${anchor}`);
    }
    
    return { filePath, content, line: anchorLine };
  }
  
  return { filePath, content };
}
```

**验证**：
- 测试各种URL格式
- 验证锚点跳转

**预计时间**：1.5小时

---

### 任务 2.7：一致性检查工具（1小时）

**目标**：验证link-map与实际文件的一致性

**实施步骤**：

1. **一致性检查函数**：
```javascript
async function checkConsistency() {
  const linkMap = loadLinkMap();
  const issues = [];
  
  // 检查link-map中的文件是否存在
  for (const [entryId, metadata] of Object.entries(linkMap.entries)) {
    const filePath = metadata.path.replace('~/.opencode/memory', MEMORY_DIR);
    
    if (!fs.existsSync(filePath)) {
      issues.push({
        type: 'missing_file',
        entryId,
        path: filePath,
        severity: 'error'
      });
    } else {
      // 检查hash是否匹配
      const currentHash = computeHash(fs.readFileSync(filePath, 'utf-8'));
      if (currentHash !== metadata.content_hash) {
        issues.push({
          type: 'hash_mismatch',
          entryId,
          path: filePath,
          severity: 'warning'
        });
      }
    }
  }
  
  // 检查是否有文件未在link-map中
  const allFiles = await scanActiveDirectory();
  for (const file of allFiles) {
    const entryId = path.basename(file.path, '.md');
    if (!linkMap.entries[entryId]) {
      issues.push({
        type: 'orphan_file',
        path: file.path,
        severity: 'warning'
      });
    }
  }
  
  return issues;
}
```

2. **修复工具**：
```javascript
async function fixConsistencyIssues(issues) {
  for (const issue of issues) {
    switch (issue.type) {
      case 'missing_file':
        console.log(`🗑️ 从link-map删除: ${issue.entryId}`);
        delete linkMap.entries[issue.entryId];
        break;
        
      case 'hash_mismatch':
        console.log(`🔄 更新hash: ${issue.entryId}`);
        const content = fs.readFileSync(issue.path, 'utf-8');
        linkMap.entries[issue.entryId].content_hash = computeHash(content);
        break;
        
      case 'orphan_file':
        console.log(`➕ 添加到link-map: ${issue.path}`);
        await addToLinkMap(issue.path);
        break;
    }
  }
  
  saveLinkMap(linkMap);
}
```

**验证**：
- 删除一个文件，检查是否检测到
- 修改一个文件，检查hash是否更新
- 添加一个文件，检查是否检测到孤儿文件

**预计时间**：1小时

---

### 任务 2.8：UX改进（1小时）

**目标**：提升用户体验

**实施步骤**：

1. **迁移进度条**：
```javascript
function showProgress(current, total, message) {
  const percent = Math.floor((current / total) * 100);
  const bar = '█'.repeat(percent / 2) + '░'.repeat(50 - percent / 2);
  process.stdout.write(`\r[${bar}] ${percent}% ${message}`);
}

async function migrateWithProgress() {
  const entries = await scanTimelineEntries();
  
  for (let i = 0; i < entries.length; i++) {
    await migrateEntry(entries[i]);
    showProgress(i + 1, entries.length, `迁移中...`);
  }
  
  console.log('\n✅ 迁移完成');
}
```

2. **主题管理CLI**：
```javascript
// opencode-memory topic list
async function listTopics() {
  const topics = fs.readdirSync(ACTIVE_DIR);
  
  console.log('📂 主题列表：');
  for (const topic of topics) {
    const count = fs.readdirSync(path.join(ACTIVE_DIR, topic)).length;
    console.log(`  ${topic}: ${count} 条目`);
  }
}

// opencode-memory topic move <entry-id> <new-topic>
async function moveTopic(entryId, newTopic) {
  const linkMap = loadLinkMap();
  const entry = linkMap.entries[entryId];
  
  if (!entry) throw new Error(`Entry not found: ${entryId}`);
  
  const oldPath = entry.path.replace('~/.opencode/memory', MEMORY_DIR);
  const newPath = path.join(ACTIVE_DIR, newTopic, path.basename(oldPath));
  
  fs.renameSync(oldPath, newPath);
  entry.path = newPath.replace(MEMORY_DIR, '~/.opencode/memory');
  entry.topic = newTopic;
  
  saveLinkMap(linkMap);
  console.log(`✅ 已移动: ${entryId} → ${newTopic}`);
}
```

**验证**：
- 测试进度条显示
- 测试主题管理命令

**预计时间**：1小时

---

## 三、验证和测试

### 3.1 单元测试

创建 `test-phase-b.mjs`：
```javascript
const tests = [
  { name: '主题识别', fn: testTopicResolution },
  { name: '目录迁移', fn: testMigration },
  { name: 'link-map生成', fn: testLinkMapGeneration },
  { name: '增量同步', fn: testIncrementalSync },
  { name: '全量同步', fn: testFullSync },
  { name: 'URL解析', fn: testURLParsing },
  { name: '一致性检查', fn: testConsistencyCheck }
];

for (const test of tests) {
  try {
    await test.fn();
    console.log(`✅ ${test.name}`);
  } catch (err) {
    console.error(`❌ ${test.name}: ${err.message}`);
  }
}
```

### 3.2 集成测试

1. 完整迁移流程测试
2. 双模式同步测试
3. 冲突解决测试
4. 一致性检查和修复测试

---

## 四、Go/No-Go检查点

1. ✅ 主题识别准确率>90%
2. ✅ 迁移后文件数量一致
3. ✅ link-map.json格式正确
4. ✅ 增量同步只上传变更文件
5. ✅ 全量同步支持断点续传
6. ✅ URL引用解析正常
7. ✅ 一致性检查无严重问题
8. ✅ 后端同步成功率>99%

**如果任一检查点失败**：回滚到Phase A状态

---

## 五、时间分配

| 任务 | 预计时间 | 优先级 | 备注 |
|------|---------|--------|------|
| 2.1 主题识别 | 1h | P0 | 必须完成 |
| 2.2 目录重组 | 1.5h | P0 | 必须完成 |
| 2.3 link-map | 1h | P0 | 必须完成 |
| 2.4 增量同步增强 | 3h | P0 | 必须完成 |
| 2.5 全量同步 | 3h | P0 | 必须完成 |
| 2.6 URL引用 | 1.5h | P1 | 强烈建议 |
| 2.7 一致性检查 | 1h | P1 | 强烈建议 |
| 2.8 UX改进 | 1h | P2 | 可选 |
| 验证测试 | 2-3h | P0 | 必须完成 |
| **总计** | **12-15h** | | |

---

## 六、总结

**Phase B 插件端实施计划已完成**，包含：
- ✅ 8个核心任务的详细实施步骤
- ✅ 完整的双模式同步机制
- ✅ URL引用和一致性检查
- ✅ 8个Go/No-Go检查点

**下一步**：创建Phase B后端实施计划（双模式同步API支持）
