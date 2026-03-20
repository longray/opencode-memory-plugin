# Phase A 插件端实施计划

**版本**: v2.2-lite Phase A  
**目标**: 基础分层存储 + 简单增量同步 + 安全增强  
**工作量**: 4-4.5小时（不含后端优化）  
**文档日期**: 2026-03-18

---

## 一、概述

### 1.1 目标

实现OpenCode Memory Plugin的分层存储架构（L0/L1/L2），支持：
- 记忆条目按时间线组织（timeline/YYYY/MM/DD/）
- MEMORY.md降级为轻量级索引（≤200行）
- 简单增量同步（基于mtime + hash）
- 安全增强（API认证、敏感信息检测）

### 1.2 核心原则

- **重建而非迁移**：旧记忆保留为只读档案（memory.backup）
- **Backend-first架构**：插件端无向量能力，只负责文件管理
- **分段实施**：每个任务独立验证，可回滚
- **最小化代码**：只写必要的代码，避免过度工程

### 1.3 前置条件

- ✅ 用户已手动备份：`C:\Users\Longray\.opencode\memory` → `memory.backup`
- ✅ 后端服务运行正常（localhost:17999）
- ✅ SurrealDB数据库已备份

---

## 二、任务清单

### 任务 1.1：目录结构创建（10分钟）

**目标**：创建新的目录结构

**实施步骤**：

1. 在 `plugin.js` 顶部添加常量定义：
```javascript
const CORE_DIR = path.join(MEMORY_DIR, 'core');
const TIMELINE_DIR = path.join(MEMORY_DIR, 'timeline');
const SYNC_DIR = path.join(MEMORY_DIR, '.sync');
```

2. 在插件初始化时创建目录：
```javascript
// 在 init() 函数中添加
if (!fs.existsSync(CORE_DIR)) fs.mkdirSync(CORE_DIR, { recursive: true });
if (!fs.existsSync(TIMELINE_DIR)) fs.mkdirSync(TIMELINE_DIR, { recursive: true });
if (!fs.existsSync(SYNC_DIR)) fs.mkdirSync(SYNC_DIR, { recursive: true });
```

**验证**：
- 启动OpenCode，检查目录是否创建成功
- 路径：`~/.opencode/memory/core/`, `timeline/`, `.sync/`

**预计时间**：10分钟

---

### 任务 1.2：核心函数实现（1.5小时）

#### 1.2.1 generateEntryId() - 生成唯一Entry ID（15分钟）

**功能**：生成格式为 `entry-YYYYMMDD-HHMMSS-XXX.md` 的唯一ID

**实现**：
```javascript
function generateEntryId() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const random = Math.random().toString(36).substring(2, 5);
  return `entry-${dateStr}-${timeStr}-${random}.md`;
}
```

**验证**：
- 调用10次，确保ID唯一
- 格式正确：`entry-20260318-152342-abc.md`

---

#### 1.2.2 writeToTimeline() - 写入Timeline（30分钟）

**功能**：将记忆条目写入 `timeline/YYYY/MM/DD/entry-*.md`

**实现**：
```javascript
async function writeToTimeline(entry, layers) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const dayDir = path.join(TIMELINE_DIR, String(year), month, day);
  if (!fs.existsSync(dayDir)) {
    fs.mkdirSync(dayDir, { recursive: true });
  }
  
  const entryId = generateEntryId();
  const entryPath = path.join(dayDir, entryId);
  
  const content = `---
date: ${entry.date}
type: ${entry.type}
tags: ${entry.tags.join(', ')}
project: ${entry.project}
memory_id: ${entry.memoryId || 'pending'}
source_id: ${entry.sourceId}
---

# ${layers.abstract}

## Overview
${layers.overview}

## Content
${layers.content}
`;
  
  fs.writeFileSync(entryPath, content, 'utf-8');
  return { entryId, entryPath };
}
```

**验证**：
- 创建测试条目，检查文件是否正确生成
- 验证目录结构：`timeline/2026/03/18/entry-*.md`
- 验证文件内容格式

---

#### 1.2.3 updateDayOverview() - 更新日概览（20分钟）

**功能**：更新 `timeline/YYYY/MM/DD/.overview.md`

**实现**：
```javascript
async function updateDayOverview(dayDir, entry, layers) {
  const overviewPath = path.join(dayDir, '.overview.md');
  
  let content = '';
  if (fs.existsSync(overviewPath)) {
    content = fs.readFileSync(overviewPath, 'utf-8');
  } else {
    content = `# ${entry.date.split('T')[0]} 记忆概览\n\n`;
  }
  
  content += `- [${entry.type}] ${layers.abstract}\n`;
  
  fs.writeFileSync(overviewPath, content, 'utf-8');
}
```

**验证**：
- 创建多个条目，检查 `.overview.md` 是否正确更新
- 验证格式：每行一个摘要

---

#### 1.2.4 updateMemoryIndex() - 更新MEMORY.md索引（25分钟）

**功能**：在MEMORY.md中添加L0摘要 + 位置链接

**实现**：
```javascript
async function updateMemoryIndex(entry, layers, entryPath) {
  const indexEntry = `
## ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Entry

**Date**: ${entry.date}
**Type**: ${entry.type}
**Tags**: ${entry.tags.join(', ')}
**Project**: ${entry.project}
**Memory ID**: ${entry.memoryId || 'pending'}

${layers.abstract}

**Location**: ${entryPath.replace(MEMORY_DIR, '~/.opencode/memory')}

---
`;
  
  fs.appendFileSync(MEMORY_FILE, indexEntry, 'utf-8');
}
```

**验证**：
- 创建条目，检查MEMORY.md是否正确追加
- 验证格式和链接路径

---

### 任务 1.3：memory_write工具改造（45分钟）

**目标**：添加 `abstract` 和 `overview` 必填参数

**实施步骤**：

1. 修改工具参数定义：
```javascript
{
  name: 'memory_write',
  parameters: {
    abstract: { type: 'string', required: true, description: 'L0: 一句话摘要（≤100字符）' },
    overview: { type: 'string', required: true, description: 'L1: 核心要点（≤500字符）' },
    content: { type: 'string', required: true, description: 'L2: 完整内容' },
    type: { type: 'string', required: false, default: 'general' },
    tags: { type: 'array', required: false, default: [] }
  }
}
```

2. 修改execute函数：
```javascript
async execute({ abstract, overview, content, type, tags }) {
  // 1. 构建entry对象
  const entry = {
    date: new Date().toISOString(),
    type: type || 'general',
    tags: tags || [],
    project: await resolveProjectId(),
    sourceId: generateSourceId(content)
  };
  
  const layers = { abstract, overview, content };
  
  // 2. 写入timeline
  const { entryId, entryPath } = await writeToTimeline(entry, layers);
  
  // 3. 更新日概览
  const dayDir = path.dirname(entryPath);
  await updateDayOverview(dayDir, entry, layers);
  
  // 4. 后端同步
  const memoryId = await syncToBackend(entry, layers);
  entry.memoryId = memoryId;
  
  // 5. 更新MEMORY.md索引
  await updateMemoryIndex(entry, layers, entryPath);
  
  return `✅ Memory saved: ${abstract}`;
}
```

**验证**：
- 调用工具，验证所有步骤执行成功
- 检查文件生成、后端同步、索引更新

---

### 任务 1.4：getMemoryFiles适配（20分钟）

**目标**：返回新目录结构的文件

**实施步骤**：

修改 `getMemoryFiles()` 函数：
```javascript
function getMemoryFiles() {
  const files = [];
  
  // 1. Core目录文件
  if (fs.existsSync(CORE_DIR)) {
    const coreFiles = fs.readdirSync(CORE_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(CORE_DIR, f));
    files.push(...coreFiles);
  }
  
  // 2. Timeline最近30天
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(now - i * 86400000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const dayDir = path.join(TIMELINE_DIR, String(year), month, day);
    if (fs.existsSync(dayDir)) {
      const dayFiles = fs.readdirSync(dayDir)
        .filter(f => f.endsWith('.md') && !f.startsWith('.'))
        .map(f => path.join(dayDir, f));
      files.push(...dayFiles);
    }
  }
  
  // 3. MEMORY.md索引文件
  if (fs.existsSync(MEMORY_FILE)) {
    files.push(MEMORY_FILE);
  }
  
  return files;
}
```

**验证**：
- 调用函数，检查返回的文件列表
- 验证包含core、timeline、MEMORY.md

---

### 任务 1.5：简单增量同步（30分钟）

**目标**：只上传变更的文件到后端

**实施步骤**：

1. **Checkpoint文件管理**：
```javascript
const CHECKPOINT_FILE = path.join(SYNC_DIR, 'checkpoint.jsonl');

function saveCheckpoint(filePath, mtime, hash) {
  const record = JSON.stringify({ filePath, mtime, hash, timestamp: Date.now() }) + '\n';
  fs.appendFileSync(CHECKPOINT_FILE, record, 'utf-8');
}

function loadCheckpoints() {
  if (!fs.existsSync(CHECKPOINT_FILE)) return new Map();
  
  const lines = fs.readFileSync(CHECKPOINT_FILE, 'utf-8').split('\n').filter(Boolean);
  const checkpoints = new Map();
  
  for (const line of lines) {
    const record = JSON.parse(line);
    checkpoints.set(record.filePath, { mtime: record.mtime, hash: record.hash });
  }
  
  return checkpoints;
}
```

2. **needsSync()函数**：
```javascript
function needsSync(filePath, checkpoints) {
  const stats = fs.statSync(filePath);
  const currentMtime = stats.mtimeMs;
  const currentHash = crypto.createHash('md5').update(fs.readFileSync(filePath)).digest('hex');
  
  const checkpoint = checkpoints.get(filePath);
  if (!checkpoint) return true; // 新文件
  
  return checkpoint.mtime !== currentMtime || checkpoint.hash !== currentHash;
}
```

3. **rebuild_index适配**：
```javascript
async function rebuildIndex() {
  const files = getMemoryFiles();
  const checkpoints = loadCheckpoints();
  const toSync = files.filter(f => needsSync(f, checkpoints));
  
  console.log(`📊 需要同步: ${toSync.length}/${files.length} 文件`);
  
  for (const file of toSync) {
    await syncFileToBackend(file);
    const stats = fs.statSync(file);
    const hash = crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
    saveCheckpoint(file, stats.mtimeMs, hash);
  }
}
```

**验证**：
- 首次运行：所有文件上传
- 二次运行：0文件上传（无变更）
- 修改文件后：只上传变更文件

---

### 任务 1.6：安全增强（30分钟）

**目标**：启用API认证，所有请求携带Bearer Token

**实施步骤**：

1. **配置文件添加auth字段**：
```javascript
// memory-config.json
{
  "backend": {
    "endpoint": "http://localhost:17999",
    "auth": {
      "enabled": true,
      "token": "${MEMORY_API_TOKEN}"
    }
  }
}
```

2. **修改API调用**：
```javascript
async function callBackendAPI(endpoint, data) {
  const config = loadConfig();
  const headers = { 'Content-Type': 'application/json' };
  
  if (config.backend.auth?.enabled) {
    const token = process.env.MEMORY_API_TOKEN || config.backend.auth.token;
    if (!token) throw new Error('API token required but not configured');
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${config.backend.endpoint}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  });
  
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

3. **环境变量配置**：
```bash
# .env 或系统环境变量
export MEMORY_API_TOKEN="your-secret-token-here"
```

**验证**：
- 无token时：API调用失败，返回401
- 有效token：API调用成功
- 无效token：API调用失败，返回403

---

### 任务 1.7：敏感信息检测（30分钟）

**目标**：检测并拒绝包含密码/密钥的内容

**实施步骤**：

1. **敏感信息检测函数**：
```javascript
function detectSensitiveInfo(text) {
  const patterns = [
    /password\s*[=:]\s*['"]?[\w@#$%^&*]+/i,
    /api[_-]?key\s*[=:]\s*['"]?[\w-]+/i,
    /secret\s*[=:]\s*['"]?[\w-]+/i,
    /token\s*[=:]\s*['"]?[\w.-]+/i,
    /bearer\s+[\w.-]+/i,
    /[a-f0-9]{32,}/i  // 32位以上的hash
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { detected: true, type: 'sensitive', matched: match[0] };
    }
  }
  
  return { detected: false };
}
```

2. **在memory_write中添加检测**：
```javascript
async execute({ abstract, overview, content, type, tags }) {
  // 检测敏感信息
  const detection = detectSensitiveInfo(content);
  if (detection.detected) {
    throw new Error(`❌ 拒绝保存：检测到敏感信息 (${detection.type})`);
  }
  
  // 继续正常流程...
}
```

**验证**：
- 包含"password=123"：拒绝保存
- 包含"api_key=abc"：拒绝保存
- 包含32位hash：拒绝保存
- 正常内容：保存成功

---

## 三、验证和测试

### 3.1 单元测试

创建 `test-phase-a.mjs`：
```javascript
// 测试用例
const tests = [
  { name: '目录创建', fn: testDirectoryCreation },
  { name: 'Entry ID生成', fn: testGenerateEntryId },
  { name: 'Timeline写入', fn: testWriteToTimeline },
  { name: 'memory_write工具', fn: testMemoryWrite },
  { name: 'getMemoryFiles', fn: testGetMemoryFiles }
];

// 运行测试
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

1. 重启OpenCode
2. 调用 `memory_write` 创建3条测试记忆
3. 验证文件结构和内容
4. 检查后端同步状态
5. 验证MEMORY.md索引

---

## 四、Go/No-Go检查点

1. ✅ 目录结构创建成功
2. ✅ timeline写入成功
3. ✅ MEMORY.md ≤200行
4. ✅ memory_write接收abstract/overview参数
5. ✅ 后端同步正常
6. ✅ 增量同步只上传变更文件

**如果任一检查点失败**：执行回滚脚本，恢复备份。

---

## 五、时间分配

| 任务 | 预计时间 | 实际时间 | 备注 |
|------|---------|---------|------|
| 1.1 目录结构 | 10min | | |
| 1.2 核心函数 | 1.5h | | |
| 1.3 memory_write | 45min | | |
| 1.4 getMemoryFiles | 20min | | |
| 1.5 增量同步 | 30min | | 下一个文档 |
| 1.6 安全增强 | 30min | | 下一个文档 |
| 1.7 敏感信息检测 | 30min | | 下一个文档 |
| 1.9 验证测试 | 1h | | |
| **总计** | **4-4.5h** | | |

---

## 六、总结

**Phase A 插件端实施计划已完成**，包含：
- ✅ 7个核心任务的详细实施步骤
- ✅ 代码示例和验证方法
- ✅ 6个Go/No-Go检查点
- ✅ 完整的时间分配表

**下一步**：创建Phase A后端实施计划（后端数据库优化）
