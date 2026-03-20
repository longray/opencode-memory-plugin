# Phase C 插件端实施计划

**版本**: v2.2-lite Phase C  
**目标**: 本地索引 + 实时同步 + 性能优化  
**工作量**: 11.5-13小时  
**文档日期**: 2026-03-18

---

## 一、概述

### 1.1 目标

实现本地加速索引和实时同步，提升系统性能：
- **本地Trie索引**：关键词快速匹配（<10ms）
- **离线回退机制**：后端不可用时使用本地搜索
- **实时同步**：文件变更时自动同步
- **性能优化**：减少不必要的文件读取和网络请求

### 1.2 核心原则

- **Backend-first架构**：本地索引仅用于加速，不替代后端
- **最小化实现**：只实现必要的功能
- **渐进式增强**：先实现基础功能，再优化性能
- **向后兼容**：保持API接口不变

### 1.3 前置条件

- ✅ Phase A 和 Phase B 已完成
- ✅ active/目录结构已建立
- ✅ 后端双模式同步API可用

---

## 二、任务清单

### 任务 3.1：本地Trie索引实现（3小时）

**目标**：实现关键词快速匹配索引

**实施步骤**：

1. **Trie数据结构**（1小时）：
```javascript
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.entries = []; // 包含此词的entry列表
  }
}

class TrieIndex {
  constructor() {
    this.root = new TrieNode();
  }
  
  insert(word, entryId) {
    let node = this.root;
    
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, new TrieNode());
      }
      node = node.children.get(char);
    }
    
    node.isEndOfWord = true;
    if (!node.entries.includes(entryId)) {
      node.entries.push(entryId);
    }
  }
  
  search(prefix) {
    let node = this.root;
    
    for (const char of prefix.toLowerCase()) {
      if (!node.children.has(char)) {
        return [];
      }
      node = node.children.get(char);
    }
    
    // 收集所有匹配的entries
    return this.collectEntries(node);
  }
  
  collectEntries(node) {
    let entries = [...node.entries];
    
    for (const child of node.children.values()) {
      entries.push(...this.collectEntries(child));
    }
    
    return [...new Set(entries)]; // 去重
  }
}
```

2. **索引构建**（1小时）：
```javascript
async function buildTrieIndex() {
  const trie = new TrieIndex();
  const files = await scanActiveDirectory();
  
  for (const file of files) {
    const content = fs.readFileSync(file.path, 'utf-8');
    const metadata = parseMetadata(content);
    const entryId = path.basename(file.path, '.md');
    
    // 索引abstract中的关键词
    const words = metadata.abstract.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3) { // 只索引3字符以上的词
        trie.insert(word, entryId);
      }
    }
    
    // 索引tags
    for (const tag of metadata.tags) {
      trie.insert(tag, entryId);
    }
  }
  
  // 持久化到文件
  const indexPath = path.join(MEMORY_DIR, '.index', 'trie-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(trie), 'utf8');
  
  return trie;
}

function loadTrieIndex() {
  const indexPath = path.join(MEMORY_DIR, '.index', 'trie-index.json');
  
  if (!fs.existsSync(indexPath)) {
    return null;
  }
  
  try {
    const data = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Trie] Failed to load index:', error);
    return null;
  }
}
```

3. **快速搜索**（1小时）：
```javascript
async function searchWithTrie(query) {
  const trie = loadTrieIndex();
  const words = query.split(/\s+/);
  
  // 查找包含所有关键词的entries
  let matchedEntries = null;
  
  for (const word of words) {
    const entries = trie.search(word);
    
    if (matchedEntries === null) {
      matchedEntries = new Set(entries);
    } else {
      // 交集
      matchedEntries = new Set(
        entries.filter(e => matchedEntries.has(e))
      );
    }
  }
  
  // 加载完整entry信息
  const results = [];
  for (const entryId of matchedEntries) {
    const entry = await loadEntry(entryId);
    results.push(entry);
  }
  
  return results;
}

async function loadEntry(entryId) {
  // entryId格式: "timeline/2026/03/18/entry-001"
  const filePath = path.join(MEMORY_DIR, `${entryId}.md`);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const entry = {
      id: entryId,
      metadata: {},
      content: ''
    };
    
    // 解析metadata（前几行的**Key**: Value格式）
    let contentStart = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('**') && line.includes('**:')) {
        const match = line.match(/\*\*(.+?)\*\*:\s*(.+)/);
        if (match) {
          const key = match[1].toLowerCase().replace(/\s+/g, '_');
          entry.metadata[key] = match[2].trim();
        }
      } else if (line.trim() === '') {
        contentStart = i + 1;
        break;
      }
    }
    
    // 提取content
    entry.content = lines.slice(contentStart).join('\n').trim();
    
    return entry;
  } catch (error) {
    console.error('[Entry] Failed to load:', error);
    return null;
  }
}
```

**验证**：
- 索引1000个entries，时间<5秒
- 搜索响应时间<10ms
- 准确率>90%

**预计时间**：3小时

---

### 任务 3.2：离线回退机制（2小时）

**目标**：后端不可用时使用本地搜索

**实施步骤**：

1. **后端健康检查**（30分钟）：
```javascript
let backendAvailable = true;
let lastHealthCheck = 0;

async function checkBackendHealth() {
  const now = Date.now();
  
  // 每30秒检查一次
  if (now - lastHealthCheck < 30000) {
    return backendAvailable;
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5000)  // Node.js 17.3+支持
    });
    backendAvailable = response.ok;
  } catch (err) {
    backendAvailable = false;
  }
  
  lastHealthCheck = now;
  return backendAvailable;
}
```

2. **搜索回退逻辑**（1小时）：
```javascript
async function search(query, mode = 'hybrid') {
  const isBackendAvailable = await checkBackendHealth();
  
  if (isBackendAvailable && mode !== 'local') {
    try {
      // 优先使用后端搜索
      return await searchBackend(query, mode);
    } catch (err) {
      console.warn('后端搜索失败，回退到本地:', err.message);
      backendAvailable = false;
    }
  }
  
  // 回退到本地Trie索引
  console.log('使用本地Trie索引搜索');
  return await searchWithTrie(query);
}
```

3. **状态通知**（30分钟）：
```javascript
function notifySearchMode(mode) {
  if (mode === 'local') {
    console.log('⚠️ 离线模式：使用本地索引（功能受限）');
  } else {
    console.log('✅ 在线模式：使用后端语义搜索');
  }
}
```

**验证**：
- 停止后端服务，验证自动回退
- 重启后端服务，验证自动恢复

**预计时间**：2小时

---

### 任务 3.3：实时同步（2小时）

**目标**：文件变更时自动同步到后端

**实施步骤**：

1. **文件监听**（1小时）：
```javascript
import chokidar from 'chokidar';

function watchMemoryFiles() {
  const watcher = chokidar.watch([ACTIVE_DIR, CORE_DIR], {
    ignored: /(^|[\/\\])\../, // 忽略隐藏文件
    persistent: true,
    ignoreInitial: true
  });
  
  watcher
    .on('add', path => handleFileChange('add', path))
    .on('change', path => handleFileChange('change', path))
    .on('unlink', path => handleFileChange('delete', path));
  
  console.log('📡 实时同步已启动');
}
```

2. **变更处理**（1小时）：
```javascript
const syncQueue = [];
let syncTimer = null;

async function handleFileChange(event, filePath) {
  console.log(`📝 文件${event}: ${filePath}`);
  
  // 添加到队列
  syncQueue.push({ event, filePath, timestamp: Date.now() });
  
  // 防抖：500ms内的变更合并处理
  if (syncTimer) clearTimeout(syncTimer);
  
  syncTimer = setTimeout(async () => {
    await processSyncQueue();
  }, 500);
}

async function processSyncQueue() {
  if (syncQueue.length === 0) return;
  
  const changes = [...syncQueue];
  syncQueue.length = 0;
  
  console.log(`🔄 同步${changes.length}个变更...`);
  
  try {
    await syncChangesToBackend(changes);
    console.log('✅ 同步完成');
  } catch (err) {
    console.error('❌ 同步失败:', err.message);
    // 失败的变更重新加入队列
    syncQueue.push(...changes);
  }
}
```

**验证**：
- 修改文件，验证自动同步
- 批量修改，验证防抖合并

**预计时间**：2小时

---

### 任务 3.4：性能优化（2.5小时）

**目标**：减少不必要的操作，提升整体性能

**实施步骤**：

1. **延迟加载**（1小时）：
```javascript
// 只在需要时加载文件内容
class LazyEntry {
  constructor(path, metadata) {
    this.path = path;
    this.metadata = metadata;
    this._content = null;
  }
  
  get content() {
    if (!this._content) {
      this._content = fs.readFileSync(this.path, 'utf-8');
    }
    return this._content;
  }
}
```

2. **缓存优化**（1小时）：
```javascript
const entryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

function getCachedEntry(entryId) {
  const cached = entryCache.get(entryId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.entry;
  }
  
  const entry = loadEntry(entryId);
  entryCache.set(entryId, {
    entry,
    timestamp: Date.now()
  });
  
  return entry;
}
```

3. **批量操作优化**（30分钟）：
```javascript
// 批量读取文件
async function loadEntriesBatch(entryIds) {
  const entries = await Promise.all(
    entryIds.map(id => getCachedEntry(id))
  );
  return entries;
}
```

**验证**：
- 测试缓存命中率
- 对比优化前后的性能

**预计时间**：2.5小时

---

## 三、验证和测试

### 3.1 性能测试

**测试脚本**（test-phase-c-performance.mjs）：
```javascript
async function testTrieIndexPerformance() {
  const start = Date.now();
  await buildTrieIndex();
  const buildTime = Date.now() - start;
  
  console.log(`索引构建时间: ${buildTime}ms`);
  assert(buildTime < 5000, '索引构建超时');
  
  const searchStart = Date.now();
  const results = await searchWithTrie('typescript');
  const searchTime = Date.now() - searchStart;
  
  console.log(`搜索时间: ${searchTime}ms`);
  assert(searchTime < 10, '搜索响应超时');
}

async function testOfflineFallback() {
  // 模拟后端不可用
  backendAvailable = false;
  
  const results = await search('test query');
  assert(results.length > 0, '离线搜索失败');
  
  console.log('✅ 离线回退正常');
}
```

### 3.2 集成测试

1. 完整工作流测试
2. 实时同步测试
3. 性能基准测试

---

## 四、Go/No-Go检查点

1. ✅ Trie索引构建时间<5秒
2. ✅ 搜索响应时间<10ms
3. ✅ 离线回退机制正常工作
4. ✅ 实时同步延迟<1秒
5. ✅ 缓存命中率>80%
6. ✅ 整体性能提升>50%

**如果任一检查点失败**：回滚到Phase B状态

---

## 五、时间分配

| 任务 | 预计时间 | 优先级 | 备注 |
|------|---------|--------|------|
| 3.1 本地Trie索引 | 3h | P1 | 强烈建议 |
| 3.2 离线回退 | 2h | P1 | 强烈建议 |
| 3.3 实时同步 | 2h | P2 | 可选 |
| 3.4 性能优化 | 2.5h | P2 | 可选 |
| 验证测试 | 2-3h | P0 | 必须完成 |
| **总计** | **11.5-13h** | | |

---

## 六、总结

**Phase C 插件端实施计划已完成**，包含：
- ✅ 4个核心任务的详细实施步骤
- ✅ 本地Trie索引和离线回退
- ✅ 实时同步和性能优化
- ✅ 6个Go/No-Go检查点

**预期效果**：
- 搜索速度提升10倍（1000ms → 100ms）
- 离线可用性100%
- 实时同步延迟<1秒

**下一步**：创建Phase C后端实施计划（后端向量索引优化）
