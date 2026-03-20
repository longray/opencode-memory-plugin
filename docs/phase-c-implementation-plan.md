# Phase C (v2.2-lite) 实施计划

## 概述

**目标**: 本地 Trie 索引优化 + 性能优化  
**工作量**: 11-13 小时  
**核心收益**:
- 关键词搜索从 100ms → <10ms (10倍提升)
- 自动完成建议 (<50ms)
- 实时同步延迟 <1秒

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Phase C Architecture                     │
├─────────────────────────────────────────────────────────────┤
│  插件端 (Node.js)                                            │
│  ├── Trie Index (内存中)                                     │
│  │   └── 关键词 → Entry ID 映射                             │
│  ├── Auto-complete Engine                                    │
│  │   └── 前缀匹配 → 建议列表                                │
│  └── Real-time Sync Client                                   │
│      └── WebSocket / Polling                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  后端 (Python FastAPI)                                       │
│  ├── HNSW Dynamic Tuning                                     │
│  │   └── 根据数据量自动调整参数                             │
│  ├── Embedding Cache (LRU)                                   │
│  │   └── 减少重复 embedding 计算                            │
│  └── Query Result Prefetch                                   │
│      └── 预测性缓存热门查询                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 任务分解

### Phase C-P1: 本地 Trie 索引（3小时）

**目标**: 实现前缀树索引，支持 O(m) 复杂度关键词查找（m为关键词长度）

**实现步骤**:

1. **Trie 数据结构** (45分钟)
   ```javascript
   // lib/trie.js
   class TrieNode {
     constructor() {
       this.children = new Map();
       this.isEndOfWord = false;
       this.entryIds = new Set();
     }
   }

   class Trie {
     constructor() {
       this.root = new TrieNode();
     }

     insert(word, entryId) {
       // O(m) 插入
     }

     search(prefix) {
       // O(m) 前缀查找，返回所有匹配 entryIds
     }

     delete(word, entryId) {
       // 删除关键词映射
     }
   }
   ```

2. **索引构建器** (45分钟)
   ```javascript
   // lib/trie-index.js
   async function buildTrieIndex(entriesDir) {
     const trie = new Trie();
     
     // 扫描所有条目文件
     // 提取关键词（tags + content中的单词）
     // 插入 Trie
     
     return trie;
   }
   ```

3. **增量更新** (30分钟)
   - memory_write 后自动更新 Trie
   - 定期全量重建（可选）

4. **搜索接口** (60分钟)
   ```javascript
   // memory_search 使用 Trie 预过滤
   const entryIds = trie.search(keyword);
   // 只搜索这些条目，而非全文扫描
   ```

**验证**:
```javascript
// 测试: 10万关键词搜索 < 10ms
const start = Date.now();
const results = trie.search("pref");
console.log(`Search took ${Date.now() - start}ms`);
```

---

### Phase C-P2: 搜索建议自动完成（2小时）

**目标**: 输入时实时提供建议，延迟 <50ms

**实现步骤**:

1. **建议生成器** (45分钟)
   ```javascript
   // 基于 Trie 获取前缀匹配
   function getSuggestions(prefix, limit = 10) {
     const node = trie.findNode(prefix);
     if (!node) return [];
     
     // DFS/BFS 收集所有完成词
     return collectWords(node, prefix, limit);
   }
   ```

2. **排序算法** (30分钟)
   - 频率优先（最近搜索过的）
   - 相关性排序（标签匹配度）
   - 时间衰减（旧记忆降低权重）

3. **UI 集成** (45分钟)
   ```javascript
   // 新工具: memory_suggest
   const suggest = tool({
     name: 'memory_suggest',
     description: 'Get search suggestions based on partial input',
     args: {
       prefix: tool.schema.string(),
       limit: tool.schema.number().optional().default(10),
     },
     async execute({ prefix, limit }) {
       const suggestions = getSuggestions(prefix, limit);
       return { suggestions };
     },
   });
   ```

**验证**:
```javascript
// 测试建议速度
const suggestions = await memory_suggest({ prefix: "proj", limit: 5 });
// 预期: <50ms 返回
```

---

### Phase C-P3: 实时同步机制（3小时）

**目标**: 本地修改后实时同步到后端

**方案选择**: **WebSocket**（推荐）
- 优点: 实时推送，低延迟
- 缺点: 需要保持连接
- 替代: 轮询（简单但延迟高）

**实现步骤**:

1. **WebSocket 客户端** (60分钟)
   ```javascript
   // lib/ws-client.js
   class SyncWebSocket {
     constructor(url) {
       this.ws = new WebSocket(url);
       this.reconnectAttempts = 0;
     }

     connect() {
       this.ws.onopen = () => { this.reconnectAttempts = 0; };
       this.ws.onmessage = (event) => {
         const msg = JSON.parse(event.data);
         this.handleSyncMessage(msg);
       };
       this.ws.onclose = () => this.reconnect();
     }

     handleSyncMessage(msg) {
       // 处理后端推送的同步通知
       if (msg.type === 'sync_required') {
         triggerIncrementalSync();
       }
     }
   }
   ```

2. **本地变更监听** (45分钟)
   ```javascript
   // 使用 fs.watch 监听文件变化
   function watchMemoryFiles(callback) {
     fs.watch(MEMORY_DIR, { recursive: true }, (event, filename) => {
       if (filename.endsWith('.md')) {
         callback(event, filename);
       }
     });
   }
   ```

3. **同步触发器** (45分钟)
   ```javascript
   // memory_write 成功后触发实时同步
   async function triggerRealtimeSync(entry) {
     if (wsClient.isConnected()) {
       wsClient.send({
         type: 'entry_changed',
         entry: entry,
         timestamp: Date.now(),
       });
     }
   }
   ```

4. **冲突处理** (30分钟)
   - 检测同时修改
   - 自动合并或提示用户

**验证**:
```javascript
// 测试实时同步
await memory_write({ content: "Test" });
// 1秒内后端应收到通知
```

---

### Phase C-B1: HNSW 动态调优（2小时）

**目标**: 根据数据量自动调整 HNSW 参数

**实现步骤**:

1. **数据统计** (30分钟)
   ```python
   async def get_memory_stats(self, tenant_id: str) -> dict:
       query = "SELECT count() FROM memory WHERE tenant_id = $tenant_id"
       result = await self._db.query(query, {"tenant_id": tenant_id})
       count = result[0][0]["count"] if result else 0
       
       return {
           "total_memories": count,
           "recommended_m": self._calculate_m(count),
           "recommended_ef": self._calculate_ef(count),
       }
   ```

2. **参数计算** (30分钟)
   ```python
   def _calculate_m(self, count: int) -> int:
       # 数据量 < 1K: M=12
       # 数据量 1K-10K: M=16
       # 数据量 10K-100K: M=20
       # 数据量 > 100K: M=24
       if count < 1000:
           return 12
       elif count < 10000:
           return 16
       elif count < 100000:
           return 20
       else:
           return 24
   
   def _calculate_ef(self, count: int) -> int:
       # ef_search 根据查询精度需求调整
       base_ef = 50
       if count > 10000:
           base_ef = 100
       if count > 100000:
           base_ef = 200
       return base_ef
   ```

3. **索引重建** (60分钟)
   ```python
   async def rebuild_hnsw_index(self, tenant_id: str):
       stats = await self.get_memory_stats(tenant_id)
       m = stats["recommended_m"]
       
       # 删除旧索引，创建新索引
       await self._db.query("REMOVE INDEX memory_embedding_hnsw ON memory")
       await self._db.query(f"""
           DEFINE INDEX memory_embedding_hnsw ON memory
           FIELDS embedding HNSW DIMENSION 1024 DIST COSINE
           EFC 200 M {m};
       """)
   ```

**验证**:
```python
# 测试参数计算
assert calculate_m(500) == 12
assert calculate_m(5000) == 16
assert calculate_m(50000) == 20
```

---

### Phase C-B2: Embedding 缓存优化（1.5小时）

**目标**: 减少重复 embedding 计算，提升 5-10 倍

**实现步骤**:

1. **LRU 缓存**（已部分实现）
   ```python
   # 增强现有缓存
   @cached(ttl=3600, key_builder=lambda text: hashlib.md5(text.encode()).hexdigest())
   async def get_embedding(self, text: str) -> list[float]:
       # 已存在，只需调优
   ```

2. **批量缓存** (45分钟)
   ```python
   async def get_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
       # 先检查缓存
       cached_results = []
       to_fetch = []
       
       for text in texts:
           cache_key = hashlib.md5(text.encode()).hexdigest()
           if cache_key in self._cache:
               cached_results.append((text, self._cache[cache_key]))
           else:
               to_fetch.append(text)
       
       # 批量获取未缓存的
       if to_fetch:
           new_embeddings = await self._fetch_embeddings(to_fetch)
           # 存入缓存
       
       # 合并结果
       return [emb for _, emb in sorted(cached_results + new_results, key=lambda x: texts.index(x[0]))]
   ```

3. **缓存预热** (30分钟)
   - 启动时加载热门查询的 embedding
   - 定期更新热门缓存

**验证**:
```python
# 第一次调用（缓存未命中）
emb1 = await get_embedding("test")  # ~100ms

# 第二次调用（缓存命中）
emb2 = await get_embedding("test")  # ~1ms
```

---

### Phase C-B3: 查询结果预取（1小时，可选）

**目标**: 预测用户查询，提前缓存结果

**实现思路**:
- 基于历史查询模式预测
- 预加载可能相关的记忆
- 低优先级任务

**简化实现**:
```python
# 预取最近访问的记忆的相似记忆
async def prefetch_related_memories(self, memory_id: str):
    related = await self.get_related_memories(memory_id, depth=1, limit=10)
    for mem in related:
        # 预热缓存
        await self._cache_related(mem)
```

---

## 实施顺序

### 第 1 天（6小时）
1. **C-P1**: Trie 索引（3h）
2. **C-P2**: 自动完成（2h）
3. **C-P3**: WebSocket 基础（1h）

### 第 2 天（5-7小时）
4. **C-P3**: 实时同步完成（2h）
5. **C-B1**: HNSW 动态调优（2h）
6. **C-B2**: Embedding 缓存优化（1.5h）
7. **C-Test**: 性能测试（1-2h）

---

## 性能目标

| 指标 | 当前 | 目标 | 提升 |
|------|------|------|------|
| 关键词搜索 | 100ms | <10ms | 10x |
| 自动完成 | - | <50ms | 新功能 |
| Embedding | 100ms | 10ms (缓存) | 10x |
| 同步延迟 | 手动 | <1s | 实时 |

---

## 风险与缓解

| 风险 | 概率 | 缓解措施 |
|------|------|----------|
| Trie 内存占用大 | 中 | 只索引关键词，非全文；定期清理 |
| WebSocket 不稳定 | 中 | 实现自动重连；降级到轮询 |
| HNSW 重建慢 | 低 | 后台异步重建；分段处理 |

---

## 下一步

准备好开始 **Phase C-P1: Trie 索引** 了吗？
