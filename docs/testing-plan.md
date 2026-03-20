# OpenCode Memory Plugin - 测试计划

**版本**: v2.2-v3.0  
**创建日期**: 2026-03-18  
**适用范围**: Phase A/B/C 全阶段

---

## 1. 测试策略

### 1.1 核心原则

1. **测试优先级**：
   - P0（关键路径）：数据完整性、安全性、核心功能
   - P1（重要功能）：性能、用户体验、边界情况
   - P2（增强功能）：优化、辅助功能

2. **测试金字塔**：
   ```
   E2E测试 (10%)      ← 关键用户流程
   集成测试 (30%)     ← 组件交互
   单元测试 (60%)     ← 函数级别
   ```

3. **自动化优先**：
   - 单元测试：100%自动化
   - 集成测试：80%自动化
   - E2E测试：关键路径自动化

4. **持续集成**：
   - 每次提交触发单元测试
   - 每日运行完整测试套件
   - 发布前运行E2E测试

### 1.2 测试环境

| 环境 | 用途 | 配置 |
|------|------|------|
| 本地开发 | 单元测试、快速验证 | Node.js 16+, 本地文件系统 |
| CI环境 | 自动化测试 | GitHub Actions, 模拟后端 |
| 集成环境 | 集成测试 | 真实后端服务（localhost:17999） |
| 预发布 | E2E测试 | 完整环境，真实数据 |

---

## 2. 测试工具和框架

### 2.1 核心工具

```json
{
  "test": "node --test",
  "test:watch": "node --test --watch",
  "test:coverage": "c8 node --test"
}
```

**依赖**：
- `node:test`：Node.js原生测试框架
- `node:assert`：断言库
- `c8`：代码覆盖率工具

### 2.2 测试辅助工具

```javascript
// test/helpers/test-utils.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEST_DIR = path.join(__dirname, '../fixtures');
export const TEMP_DIR = path.join(__dirname, '../temp');

export async function setupTestEnv() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  return {
    memoryDir: path.join(TEMP_DIR, 'memory'),
    coreDir: path.join(TEMP_DIR, 'memory/core'),
    timelineDir: path.join(TEMP_DIR, 'memory/timeline'),
    syncDir: path.join(TEMP_DIR, 'memory/.sync')
  };
}

export async function cleanupTestEnv() {
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
}

export function mockBackendClient() {
  return {
    uploadMemories: async (memories) => ({
      success: memories.map(m => ({ id: `memory:${Date.now()}`, ...m })),
      failed: []
    }),
    search: async (query) => ({ results: [] })
  };
}
```

---

## 3. Phase A 测试计划

### 3.1 单元测试（60%）

#### 3.1.1 核心函数测试

**测试文件**: `test/unit/core-functions.test.js`

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { generateEntryId, writeToTimeline, updateDayOverview, updateMemoryIndex } from '../../lib/core-functions.js';
import { setupTestEnv, cleanupTestEnv } from '../helpers/test-utils.js';

describe('generateEntryId', () => {
  it('生成唯一ID（格式：entry-YYYYMMDD-HHMMSS-XXX）', () => {
    const id1 = generateEntryId();
    const id2 = generateEntryId();
    
    assert.match(id1, /^entry-\d{8}-\d{6}-\d{3}$/);
    assert.notStrictEqual(id1, id2);
  });
  
  it('同一毫秒内生成不同ID', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateEntryId());
    }
    assert.strictEqual(ids.size, 100);
  });
});

describe('writeToTimeline', () => {
  let testEnv;
  
  before(async () => {
    testEnv = await setupTestEnv();
  });
  
  after(async () => {
    await cleanupTestEnv();
  });
  
  it('写入新entry到timeline/YYYY/MM/DD/entry-*.md', async () => {
    const entry = {
      id: 'entry-20260318-150000-001',
      abstract: '测试摘要',
      overview: '测试概述',
      content: '测试内容',
      type: 'long-term',
      tags: ['test'],
      project_id: 'test-project'
    };
    
    const result = await writeToTimeline(entry, testEnv.timelineDir);
    
    assert.ok(result.success);
    assert.match(result.filePath, /timeline\/2026\/03\/18\/entry-.*\.md$/);
    
    const content = await fs.readFile(result.filePath, 'utf-8');
    assert.ok(content.includes('**Abstract**: 测试摘要'));
    assert.ok(content.includes('**Overview**: 测试概述'));
    assert.ok(content.includes('测试内容'));
  });
  
  it('幂等性检查：同一天内禁止重复source_id', async () => {
    const entry = {
      id: 'entry-20260318-150000-002',
      source_id: 'duplicate-test',
      abstract: '测试',
      overview: '测试',
      content: '测试'
    };
    
    await writeToTimeline(entry, testEnv.timelineDir);
    
    await assert.rejects(
      async () => await writeToTimeline(entry, testEnv.timelineDir),
      { message: /Duplicate source_id/ }
    );
  });
});

describe('updateDayOverview', () => {
  let testEnv;
  
  before(async () => {
    testEnv = await setupTestEnv();
  });
  
  after(async () => {
    await cleanupTestEnv();
  });
  
  it('创建.overview.md文件（包含当天所有entry的abstract）', async () => {
    const entries = [
      { id: 'entry-001', abstract: '摘要1' },
      { id: 'entry-002', abstract: '摘要2' }
    ];
    
    const overviewPath = path.join(testEnv.timelineDir, '2026/03/18/.overview.md');
    await updateDayOverview(entries, overviewPath);
    
    const content = await fs.readFile(overviewPath, 'utf-8');
    assert.ok(content.includes('摘要1'));
    assert.ok(content.includes('摘要2'));
  });
  
  it('增量更新：追加新entry，不重复', async () => {
    const overviewPath = path.join(testEnv.timelineDir, '2026/03/18/.overview.md');
    
    await updateDayOverview([{ id: 'entry-001', abstract: '摘要1' }], overviewPath);
    await updateDayOverview([{ id: 'entry-002', abstract: '摘要2' }], overviewPath);
    
    const content = await fs.readFile(overviewPath, 'utf-8');
    assert.strictEqual((content.match(/entry-001/g) || []).length, 1);
    assert.ok(content.includes('摘要2'));
  });
});

describe('updateMemoryIndex', () => {
  let testEnv;
  
  before(async () => {
    testEnv = await setupTestEnv();
  });
  
  after(async () => {
    await cleanupTestEnv();
  });
  
  it('更新MEMORY.md索引（只写入abstract + 位置链接）', async () => {
    const entry = {
      id: 'entry-20260318-150000-001',
      abstract: '测试摘要',
      filePath: 'timeline/2026/03/18/entry-20260318-150000-001.md'
    };
    
    const indexPath = path.join(testEnv.memoryDir, 'MEMORY.md');
    await updateMemoryIndex(entry, indexPath);
    
    const content = await fs.readFile(indexPath, 'utf-8');
    assert.ok(content.includes('测试摘要'));
    assert.ok(content.includes('timeline/2026/03/18/entry-20260318-150000-001.md'));
  });
  
  it('保持MEMORY.md ≤200行', async () => {
    const indexPath = path.join(testEnv.memoryDir, 'MEMORY.md');
    
    // 写入250个entry
    for (let i = 0; i < 250; i++) {
      await updateMemoryIndex({
        id: `entry-${i}`,
        abstract: `摘要${i}`,
        filePath: `timeline/2026/03/18/entry-${i}.md`
      }, indexPath);
    }
    
    const content = await fs.readFile(indexPath, 'utf-8');
    const lines = content.split('\n').length;
    assert.ok(lines <= 200, `MEMORY.md超过200行：${lines}行`);
  });
});
```

#### 3.1.2 memory_write工具测试

**测试文件**: `test/unit/memory-write.test.js`

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { setupTestEnv, cleanupTestEnv, mockBackendClient } from '../helpers/test-utils.js';

describe('memory_write工具', () => {
  let testEnv, mockClient;
  
  before(async () => {
    testEnv = await setupTestEnv();
    mockClient = mockBackendClient();
  });
  
  after(async () => {
    await cleanupTestEnv();
  });
  
  it('必填参数验证：abstract, overview, content', async () => {
    await assert.rejects(
      async () => await memoryWrite({ content: '测试' }),
      { message: /abstract is required/ }
    );
    
    await assert.rejects(
      async () => await memoryWrite({ abstract: '测试', content: '测试' }),
      { message: /overview is required/ }
    );
  });
  
  it('成功写入：本地文件 + 后端同步 + Memory ID', async () => {
    const result = await memoryWrite({
      abstract: '测试摘要',
      overview: '测试概述',
      content: '测试内容',
      type: 'long-term',
      tags: ['test']
    }, { client: mockClient, memoryDir: testEnv.memoryDir });
    
    assert.ok(result.success);
    assert.ok(result.memoryId);
    assert.match(result.filePath, /timeline\/2026\/03\/18\/entry-.*\.md$/);
    
    // 验证本地文件
    const content = await fs.readFile(result.filePath, 'utf-8');
    assert.ok(content.includes('**Memory ID**: memory:'));
  });
  
  it('后端同步失败：写入pending状态', async () => {
    const failClient = {
      uploadMemories: async () => { throw new Error('Network error'); }
    };
    
    const result = await memoryWrite({
      abstract: '测试',
      overview: '测试',
      content: '测试'
    }, { client: failClient, memoryDir: testEnv.memoryDir });
    
    assert.ok(result.success);
    assert.strictEqual(result.memoryId, 'pending');
    
    const content = await fs.readFile(result.filePath, 'utf-8');
    assert.ok(content.includes('**Memory ID**: pending'));
  });
});
```


#### 3.1.3 增量同步测试

**测试文件**: `test/unit/incremental-sync.test.js`

```javascript
describe('needsSync函数', () => {
  it('mtime变化 → 需要同步', async () => {
    const file = { path: 'test.md', mtime: new Date('2026-03-18T10:00:00Z') };
    const checkpoint = { 'test.md': { mtime: new Date('2026-03-18T09:00:00Z').getTime() } };
    
    assert.ok(needsSync(file, checkpoint));
  });
  
  it('hash变化 → 需要同步', async () => {
    const file = { path: 'test.md', hash: 'abc123' };
    const checkpoint = { 'test.md': { hash: 'def456' } };
    
    assert.ok(needsSync(file, checkpoint));
  });
  
  it('mtime和hash都未变化 → 跳过同步', async () => {
    const file = { path: 'test.md', mtime: new Date('2026-03-18T10:00:00Z'), hash: 'abc123' };
    const checkpoint = { 'test.md': { mtime: new Date('2026-03-18T10:00:00Z').getTime(), hash: 'abc123' } };
    
    assert.ok(!needsSync(file, checkpoint));
  });
});
```

---

### 3.2 集成测试（30%）

#### 3.2.1 完整写入流程测试

**测试文件**: `test/integration/write-flow.test.js`

```javascript
describe('完整写入流程', () => {
  it('memory_write → writeToTimeline → updateDayOverview → updateMemoryIndex → 后端同步', async () => {
    const result = await memoryWrite({
      abstract: '集成测试摘要',
      overview: '集成测试概述',
      content: '集成测试内容',
      type: 'long-term',
      tags: ['integration-test'],
      project_id: 'test-project'
    });
    
    // 验证timeline文件
    assert.ok(await fs.access(result.filePath).then(() => true).catch(() => false));
    
    // 验证.overview.md
    const overviewPath = result.filePath.replace(/entry-.*\.md$/, '.overview.md');
    const overview = await fs.readFile(overviewPath, 'utf-8');
    assert.ok(overview.includes('集成测试摘要'));
    
    // 验证MEMORY.md索引
    const memoryIndex = await fs.readFile(MEMORY_FILE, 'utf-8');
    assert.ok(memoryIndex.includes('集成测试摘要'));
    
    // 验证后端同步
    assert.ok(result.memoryId);
    assert.match(result.memoryId, /^memory:/);
  });
});
```

#### 3.2.2 后端交互测试

**测试文件**: `test/integration/backend-sync.test.js`

```javascript
describe('后端同步', () => {
  it('上传成功 → 返回memory_id', async () => {
    const memories = [{
      content: '测试内容',
      type: 'long-term',
      tags: ['test']
    }];
    
    const result = await backendClient.uploadMemories(memories);
    
    assert.strictEqual(result.success.length, 1);
    assert.match(result.success[0].id, /^memory:/);
  });
  
  it('网络错误 → 重试3次后失败', async () => {
    let attempts = 0;
    const failClient = {
      uploadMemories: async () => {
        attempts++;
        throw new Error('Network error');
      }
    };
    
    await assert.rejects(
      async () => await uploadWithRetry(failClient, [{ content: 'test' }]),
      { message: /Network error/ }
    );
    
    assert.strictEqual(attempts, 3);
  });
});
```

---

### 3.3 端到端测试（10%）

**测试文件**: `test/e2e/user-workflow.test.js`

```javascript
describe('用户工作流', () => {
  it('场景1：保存偏好 → 搜索 → 验证结果', async () => {
    // 1. 保存偏好
    await memoryWrite({
      abstract: '用户偏好TypeScript',
      overview: '用户在项目中优先使用TypeScript',
      content: '用户明确表示喜欢TypeScript的类型安全特性',
      type: 'preference',
      tags: ['typescript', 'preference']
    });
    
    // 2. 搜索
    const results = await memorySearch({ query: 'TypeScript偏好', limit: 5 });
    
    // 3. 验证
    assert.ok(results.length > 0);
    assert.ok(results[0].content.includes('TypeScript'));
  });
  
  it('场景2：离线模式 → 写入pending → 恢复连接 → 自动同步', async () => {
    // 模拟离线
    setOfflineMode(true);
    
    const result = await memoryWrite({
      abstract: '离线测试',
      overview: '离线测试',
      content: '离线测试内容'
    });
    
    assert.strictEqual(result.memoryId, 'pending');
    
    // 恢复连接
    setOfflineMode(false);
    await syncPendingMemories();
    
    // 验证同步成功
    const content = await fs.readFile(result.filePath, 'utf-8');
    assert.match(content, /\*\*Memory ID\*\*: memory:/);
  });
});
```

---

## 4. Phase B 测试计划

### 4.1 主题识别测试

```javascript
describe('主题识别', () => {
  it('type映射：decision → decisions', () => {
    assert.strictEqual(identifyTopic({ type: 'decision' }), 'decisions');
  });
  
  it('tags推断：包含"bug"或"fix" → bugs', () => {
    assert.strictEqual(identifyTopic({ tags: ['bug', 'critical'] }), 'bugs');
  });
  
  it('内容分析：包含"prefer"或"like" → preferences', () => {
    assert.strictEqual(identifyTopic({ content: 'I prefer using React' }), 'preferences');
  });
});
```

### 4.2 双模式同步测试

```javascript
describe('增量同步', () => {
  it('指纹检测：只上传变更文件', async () => {
    const changes = await detectChanges(localFiles, remoteFingerprints);
    
    assert.ok(changes.to_upload.length < localFiles.length);
    assert.ok(changes.to_delete.length === 0);
  });
});

describe('全量同步', () => {
  it('流式扫描：常数内存消耗', async () => {
    const memBefore = process.memoryUsage().heapUsed;
    
    await fullSync({ batchSize: 50 });
    
    const memAfter = process.memoryUsage().heapUsed;
    const memIncrease = (memAfter - memBefore) / 1024 / 1024;
    
    assert.ok(memIncrease < 50, `内存增长${memIncrease}MB，超过50MB阈值`);
  });
});
```

---

## 5. Phase C 测试计划

### 5.1 本地Trie索引测试

```javascript
describe('Trie索引', () => {
  it('关键词匹配：<10ms', async () => {
    const trie = buildTrieIndex(memories);
    
    const start = performance.now();
    const results = trie.search('typescript');
    const duration = performance.now() - start;
    
    assert.ok(duration < 10, `搜索耗时${duration}ms，超过10ms阈值`);
    assert.ok(results.length > 0);
  });
});
```

### 5.2 实时同步测试

```javascript
describe('文件监听', () => {
  it('文件变更 → 300ms防抖 → 触发同步', async () => {
    const changes = [];
    watchFiles(MEMORY_DIR, (change) => changes.push(change));
    
    // 快速连续修改
    await fs.writeFile(testFile, 'content1');
    await fs.writeFile(testFile, 'content2');
    await fs.writeFile(testFile, 'content3');
    
    await sleep(500);
    
    assert.strictEqual(changes.length, 1, '应该合并为1次变更');
  });
});
```


---

## 6. 验收标准

### 6.1 代码覆盖率

| 类型 | 目标 | 最低要求 |
|------|------|----------|
| 语句覆盖率 | 85% | 75% |
| 分支覆盖率 | 80% | 70% |
| 函数覆盖率 | 90% | 80% |
| 行覆盖率 | 85% | 75% |

### 6.2 性能指标

| 操作 | 目标 | 最大值 |
|------|------|--------|
| memory_write | <100ms | 200ms |
| 本地搜索（Trie） | <10ms | 20ms |
| 增量同步 | <500ms | 1000ms |
| 全量同步（1000条） | <5s | 10s |

### 6.3 功能完整性

**Phase A**：
- ✅ 分层存储（abstract/overview/content）
- ✅ timeline目录结构
- ✅ MEMORY.md索引（≤200行）
- ✅ 简单增量同步
- ✅ 安全增强（Bearer Token）

**Phase B**：
- ✅ 主题组织（active/{topic}/）
- ✅ 双模式同步（增量+全量）
- ✅ 冲突处理
- ✅ link-map.json

**Phase C**：
- ✅ 本地Trie索引
- ✅ 离线回退
- ✅ 实时同步

---

## 7. 测试执行计划

### 7.1 开发阶段

```bash
# 单元测试（每次提交）
npm test

# 监听模式（开发时）
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

### 7.2 集成阶段

```bash
# 集成测试（需要后端服务）
npm run test:integration

# E2E测试
npm run test:e2e
```

### 7.3 发布前

```bash
# 完整测试套件
npm run test:all

# 性能测试
npm run test:perf

# 安全扫描
npm audit
```

---

## 8. 测试数据管理

### 8.1 测试夹具

```
test/
├── fixtures/
│   ├── memories/
│   │   ├── preference-samples.json
│   │   ├── decision-samples.json
│   │   └── long-term-samples.json
│   ├── checkpoints/
│   │   └── sample-checkpoint.jsonl
│   └── backend-responses/
│       ├── upload-success.json
│       └── search-results.json
└── temp/  # 测试运行时临时目录
```

### 8.2 Mock数据生成

```javascript
// test/helpers/mock-data.js
export function generateMockMemory(overrides = {}) {
  return {
    abstract: 'Mock abstract',
    overview: 'Mock overview',
    content: 'Mock content',
    type: 'long-term',
    tags: ['mock'],
    project_id: 'mock-project',
    ...overrides
  };
}

export function generateMockMemories(count = 10) {
  return Array.from({ length: count }, (_, i) => 
    generateMockMemory({ abstract: `Mock ${i}` })
  );
}
```

---

## 9. 持续集成配置

### 9.1 GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm test
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 10. 总结

### 10.1 测试优先级

**P0（必须通过）**：
- 数据完整性测试
- 安全性测试
- 核心功能测试

**P1（强烈建议）**：
- 性能测试
- 集成测试
- 边界情况测试

**P2（可选）**：
- 压力测试
- 兼容性测试

### 10.2 测试时间分配

| 阶段 | 单元测试 | 集成测试 | E2E测试 | 总计 |
|------|----------|----------|---------|------|
| Phase A | 2h | 1h | 0.5h | 3.5h |
| Phase B | 3h | 2h | 1h | 6h |
| Phase C | 2h | 1.5h | 0.5h | 4h |
| **总计** | **7h** | **4.5h** | **2h** | **13.5h** |

