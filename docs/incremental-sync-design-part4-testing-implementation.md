# OpenCode Memory Plugin 增量同步方案

## 第四部分：测试和实施计划

**版本**: v1.0  
**日期**: 2026-03-17  
**状态**: 设计阶段

---

## 1. 测试策略

### 1.1 单元测试

#### 后端测试（pytest）

```python
# tests/test_batch_sync.py
import pytest
from utils.memory_manager import MemoryManager

@pytest.mark.asyncio
async def test_batch_sync_add():
    """测试批量新增"""
    manager = MemoryManager(config)

    result = await manager.batch_sync_memories(
        batch_id="test_batch_1",
        to_add=[{
            "content": "Test memory",
            "type": "long-term",
            "tags": ["test"],
            "source_fingerprint": "fp123",
            "hash": "hash123",
            "metadata": {"source_file": "test.md"}
        }],
        to_update=[],
        to_delete=[],
        tenant_id="test_tenant",
        project_id="test_project"
    )

    assert result["status"] == "success"
    assert len(result["results"]["added"]) == 1
    assert result["results"]["added"][0]["status"] == "success"
    assert "record_id" in result["results"]["added"][0]

@pytest.mark.asyncio
async def test_idempotency():
    """测试幂等性"""
    manager = MemoryManager(config)
    batch_id = "test_batch_idempotent"

    # 第一次执行
    result1 = await manager.batch_sync_memories(
        batch_id=batch_id,
        to_add=[{"content": "Test", ...}],
        to_update=[],
        to_delete=[],
        tenant_id="test",
        project_id="test"
    )

    # 第二次执行（相同batch_id）
    result2 = await manager.batch_sync_memories(
        batch_id=batch_id,
        to_add=[{"content": "Test", ...}],
        to_update=[],
        to_delete=[],
        tenant_id="test",
        project_id="test"
    )

    assert result2["status"] == "duplicate"

@pytest.mark.asyncio
async def test_version_conflict():
    """测试版本冲突"""
    manager = MemoryManager(config)

    # 先创建一条记录
    add_result = await manager.batch_sync_memories(...)
    record_id = add_result["results"]["added"][0]["record_id"]

    # 尝试用错误的版本更新
    update_result = await manager.batch_sync_memories(
        batch_id="test_update",
        to_add=[],
        to_update=[{
            "record_id": record_id,
            "expected_version": 999,  # 错误的版本
            "content": "Updated",
            ...
        }],
        to_delete=[],
        tenant_id="test",
        project_id="test"
    )

    assert update_result["results"]["updated"][0]["status"] == "conflict"
```

#### 插件端测试（Jest）

```javascript
// tests/sync-manager.test.js
const SyncManager = require('../lib/sync-manager');

describe('SyncManager', () => {
  test('detectChanges - identifies new entries', async () => {
    const manager = new SyncManager(config);

    // Mock checkpoint和本地文件
    jest.spyOn(manager, 'loadCheckpoint').mockResolvedValue([]);
    jest.spyOn(manager, 'parseAllMemoryFiles').mockResolvedValue([
      { local_key: 'MEMORY.md:abc123', content: 'Test', ... }
    ]);

    const changes = await manager.detectChanges();

    expect(changes.to_add).toHaveLength(1);
    expect(changes.to_update).toHaveLength(0);
    expect(changes.to_delete).toHaveLength(0);
  });

  test('detectChanges - identifies updates', async () => {
    const manager = new SyncManager(config);

    jest.spyOn(manager, 'loadCheckpoint').mockResolvedValue([
      {
        record_id: 'memory:01HQ...',
        local_key: 'MEMORY.md:abc123',
        source_fingerprint: 'old_fp',
        version: 1
      }
    ]);

    jest.spyOn(manager, 'parseAllMemoryFiles').mockResolvedValue([
      {
        local_key: 'MEMORY.md:abc123',
        source_fingerprint: 'new_fp',  // 变化了
        content: 'Updated'
      }
    ]);

    const changes = await manager.detectChanges();

    expect(changes.to_add).toHaveLength(0);
    expect(changes.to_update).toHaveLength(1);
    expect(changes.to_delete).toHaveLength(0);
  });

  test('validateDeletions - throws on excessive deletions', () => {
    const manager = new SyncManager(config);

    const checkpoint = Array(100).fill({}).map((_, i) => ({
      record_id: `memory:${i}`,
      local_key: `file:${i}`
    }));

    const to_delete = Array(30).fill({}).map((_, i) => ({
      record_id: `memory:${i}`
    }));

    expect(() => {
      manager.validateDeletions(to_delete, checkpoint);
    }).toThrow(/删除保护触发/);
  });
});
```

### 1.2 集成测试

```python
# tests/test_integration.py
@pytest.mark.asyncio
async def test_end_to_end_sync():
    """端到端测试：插件 → 后端 → 数据库"""

    # 1. 准备测试数据
    test_memory = {
        "content": "Integration test memory",
        "type": "long-term",
        "tags": ["integration", "test"]
    }

    # 2. 调用插件端同步
    sync_manager = SyncManager(test_config)
    result = await sync_manager.sync()

    # 3. 验证后端数据
    db_record = await db.query("""
        SELECT * FROM memory
        WHERE content = $content
    """, {"content": test_memory["content"]})

    assert len(db_record) == 1
    assert db_record[0]["type"] == "long-term"

    # 4. 验证Meilisearch数据
    await asyncio.sleep(2)  # 等待Outbox处理
    meili_result = await meili.index('memories').search(
        test_memory["content"]
    )

    assert len(meili_result["hits"]) == 1

    # 5. 验证checkpoint
    checkpoint = await sync_manager.loadCheckpoint()
    matching = [c for c in checkpoint
                if test_memory["content"] in c.get("content", "")]

    assert len(matching) == 1
    assert matching[0]["version"] == 1
```

### 1.3 性能测试

```python
# tests/test_performance.py
@pytest.mark.asyncio
async def test_sync_performance():
    """测试同步性能"""
    manager = MemoryManager(config)

    # 准备1000条测试数据
    entries = [
        {
            "content": f"Test memory {i}",
            "type": "long-term",
            "tags": ["test"],
            "source_fingerprint": f"fp{i}",
            "hash": f"hash{i}",
            "metadata": {"source_file": "test.md"}
        }
        for i in range(1000)
    ]

    # 测试批量同步
    start_time = time.time()
    result = await manager.batch_sync_memories(
        batch_id="perf_test",
        to_add=entries,
        to_update=[],
        to_delete=[],
        tenant_id="test",
        project_id="test"
    )
    elapsed = time.time() - start_time

    # 性能断言
    assert elapsed < 5.0  # 1000条记录应在5秒内完成
    assert result["summary"]["succeeded"] == 1000

    # 计算吞吐量
    throughput = 1000 / elapsed
    print(f"Throughput: {throughput:.2f} entries/sec")
```

## 2. 实施计划

### 2.1 优先级划分

**P0 - 核心功能（必须实现）**：

| 功能           | 说明                             | 工时 | 负责人 |
| -------------- | -------------------------------- | ---- | ------ |
| 批量同步API    | POST /api/v1/memories/batch-sync | 3h   | 后端   |
| 幂等性检查     | Redis存储batch_id状态            | 1h   | 后端   |
| 并发控制       | version字段乐观锁                | 1h   | 后端   |
| SyncManager    | 变更检测和同步逻辑               | 2h   | 插件   |
| Checkpoint管理 | 原子落盘和加载                   | 1.5h | 插件   |
| 删除保护       | 阈值检查和确认机制               | 0.5h | 插件   |
| 单元测试       | 核心功能测试覆盖                 | 2h   | 全栈   |

**P0小计：11小时**

**P1 - 一致性保障（强烈建议）**：

| 功能               | 说明                  | 工时 | 负责人 |
| ------------------ | --------------------- | ---- | ------ |
| Outbox模式         | 异步同步到Meilisearch | 2h   | 后端   |
| Source Fingerprint | 稳定内容指纹生成      | 1h   | 插件   |
| 部分成功响应       | 区分成功/失败条目     | 1h   | 后端   |
| Checkpoint压缩     | 定期清理和优化        | 1h   | 插件   |
| 集成测试           | 端到端测试            | 2h   | 全栈   |

**P1小计：7小时**

**P2 - 优化功能（可选）**：

| 功能          | 说明               | 工时 | 负责人 |
| ------------- | ------------------ | ---- | ------ |
| Tombstone清理 | 定期清理软删除记录 | 1h   | 后端   |
| Dry-run模式   | 预览变更           | 0.5h | 插件   |
| 监控指标      | 同步性能追踪       | 1h   | 后端   |
| 性能测试      | 压力测试和优化     | 1.5h | 全栈   |

**P2小计：4小时**

**总工时：22小时**（P0+P1+P2）

### 2.2 实施顺序

**阶段1：后端基础（6小时）**

1. **数据模型准备**（1h）
   - 更新SurrealDB schema（添加version、last_op_id字段）
   - 创建Outbox表
   - 添加必要的索引

2. **批量同步API**（3h）
   - 实现`batch_sync_memories()`方法
   - CREATE/UPDATE/DELETE逻辑
   - 事务处理

3. **幂等性和并发控制**（2h）
   - Redis幂等性检查
   - 乐观锁实现
   - 错误处理

**阶段2：插件端核心（5小时）**

4. **SyncManager实现**（3h）
   - 变更检测算法
   - Checkpoint加载和保存
   - Source fingerprint生成

5. **Checkpoint管理**（1.5h）
   - 原子写入机制
   - 损坏恢复
   - 压缩策略

6. **rebuild_index集成**（0.5h）
   - 修改工具调用SyncManager
   - 添加dry-run和force参数

**阶段3：测试和验证（3小时）**

7. **单元测试**（2h）
   - 后端测试（pytest）
   - 插件端测试（Jest）
   - 覆盖核心逻辑

8. **手动验证**（1h）
   - 新增/更新/删除场景
   - 幂等性验证
   - 并发冲突验证

**阶段4：一致性保障（4小时）**

9. **Outbox模式**（2h）
   - Outbox处理器实现
   - 后台任务启动
   - 重试机制

10. **部分成功处理**（1h）
    - 响应模型完善
    - 错误详情返回
    - Checkpoint部分更新

11. **集成测试**（1h）
    - 端到端测试
    - 跨存储一致性验证

**阶段5：优化和监控（4小时）**

12. **性能优化**（2h）
    - 批量大小调优
    - 查询优化
    - 压力测试

13. **监控和告警**（1h）
    - 同步延迟监控
    - 失败率告警
    - Outbox队列监控

14. **文档和部署**（1h）
    - 更新README
    - 配置说明
    - 灰度发布计划

### 2.3 MVP方案（最小可行产品）

如果需要快速验证，可以只实现P0功能：

**MVP范围**：

- ✅ 批量同步API（CREATE/UPDATE/DELETE）
- ✅ 幂等性检查
- ✅ 并发控制（乐观锁）
- ✅ SyncManager（变更检测）
- ✅ Checkpoint管理（原子写入）
- ✅ 删除保护
- ❌ Outbox模式（暂时同步调用Meilisearch）
- ❌ Source fingerprint（使用完整hash）
- ❌ 部分成功响应（全成功或全失败）

**MVP工时：11小时**

**MVP限制**：

- Meilisearch同步是同步调用，可能影响性能
- 没有source fingerprint，重建checkpoint需要完全重新同步
- 没有部分成功处理，一个失败导致整批失败

**MVP适用场景**：

- 快速验证方案可行性
- 单用户环境（并发低）
- 数据量小（<1000条）

## 3. 风险和缓解措施

### 3.1 风险矩阵

| 风险              | 影响 | 概率 | 优先级 | 缓解措施                |
| ----------------- | ---- | ---- | ------ | ----------------------- |
| Checkpoint损坏    | 高   | 低   | P0     | 原子写入+备份+校验和    |
| 并发冲突频繁      | 中   | 中   | P0     | 乐观锁+重试机制         |
| Outbox队列堆积    | 中   | 中   | P1     | 监控+告警+自动扩容      |
| 大量误删          | 高   | 低   | P0     | 删除保护+软删除+7天保留 |
| 性能不达标        | 中   | 中   | P1     | 批量优化+索引优化+缓存  |
| SurrealDB事务超时 | 中   | 低   | P1     | 批量大小限制+超时重试   |

### 3.2 详细缓解措施

**Checkpoint损坏**：

- 原子写入：使用临时文件+rename
- 自动备份：写入前备份现有文件
- 校验和：可选的文件完整性校验
- 恢复机制：失败时自动从备份恢复

**并发冲突**：

- 乐观锁：version字段防止冲突
- 重试机制：冲突时自动重试（最多3次）
- 冲突日志：记录所有冲突事件
- 用户提示：告知用户冲突原因

**Outbox队列堆积**：

- 监控告警：队列长度超过阈值告警
- 自动扩容：增加处理器数量
- 批量处理：提高处理效率
- 降级策略：队列过长时暂停新增

## 4. 部署计划

### 4.1 灰度发布

**阶段1：内部测试**（1-2天）

- 在开发环境完整测试
- 验证所有场景
- 性能基准测试

**阶段2：小范围试用**（3-5天）

- 选择1-2个测试用户
- 监控同步性能和错误率
- 收集反馈

**阶段3：全量发布**（1周后）

- 所有用户启用
- 持续监控
- 快速响应问题

### 4.2 配置开关

```json
{
  "sync": {
    "mode": "incremental", // "incremental" | "full"
    "enabled": true,
    "batch_size": 20,
    "auto_sync": false
  }
}
```

### 4.3 回滚策略

**如果增量同步出现问题**：

1. **立即回滚**：
   - 恢复旧版本的rebuild_index（全量同步）
   - 保留checkpoint文件（不删除）
   - 后端API保持兼容

2. **数据恢复**：
   - 从checkpoint.backup恢复
   - 或从SurrealDB重建checkpoint
   - 验证数据一致性

3. **问题修复**：
   - 分析日志和错误
   - 修复bug
   - 在测试环境验证
   - 重新部署

## 5. 关键文件清单

### 5.1 后端新增文件

```
wrapper/src/
├── utils/
│   ├── memory_manager.py          # 修改：添加batch_sync_memories()
│   └── outbox_processor.py        # 新增：Outbox处理器
├── models/
│   └── batch_sync.py              # 新增：请求/响应模型
└── main.py                        # 修改：添加batch-sync路由
```

### 5.2 插件端新增文件

```
opencode-memory-plugin/
├── lib/
│   ├── sync-manager.js            # 新增：增量同步管理器
│   ├── checkpoint-manager.js      # 新增：Checkpoint管理
│   ├── fingerprint.js             # 新增：内容指纹生成
│   └── wrapper-client.js          # 修改：添加batchSync()方法
├── plugin.js                      # 修改：rebuild_index调用SyncManager
└── .checkpoint.jsonl              # 新增：Checkpoint文件（运行时生成）
```

### 5.3 数据库Schema更新

```sql
-- 更新memory表
ALTER TABLE memory ADD COLUMN version INT DEFAULT 1;
ALTER TABLE memory ADD COLUMN last_op_id STRING;
ALTER TABLE memory ADD COLUMN source_fingerprint STRING;

-- 创建索引
DEFINE INDEX idx_memory_fingerprint ON TABLE memory COLUMNS source_fingerprint;
DEFINE INDEX idx_memory_version ON TABLE memory COLUMNS version;

-- 创建Outbox表
DEFINE TABLE outbox SCHEMAFULL;
-- (详见第二部分)
```

## 6. 成功指标

### 6.1 性能指标

| 指标     | 目标       | 测量方法     |
| -------- | ---------- | ------------ |
| 同步延迟 | < 100ms    | 平均响应时间 |
| 吞吐量   | > 200条/秒 | 批量同步测试 |
| 错误率   | < 1%       | 失败请求比例 |
| 可用性   | > 99.9%    | 服务健康检查 |

### 6.2 质量指标

| 指标       | 目标    | 测量方法   |
| ---------- | ------- | ---------- |
| 测试覆盖率 | > 80%   | pytest-cov |
| 代码质量   | A级     | SonarQube  |
| 文档完整性 | 100%    | 人工审核   |
| 用户满意度 | > 4.5/5 | 用户反馈   |

---

## 总结

**完整设计文档已完成**，包含：

1. ✅ 系统架构设计
2. ✅ 数据模型和API设计
3. ✅ 核心算法和实现
4. ✅ 测试和实施计划

**核心指标**：

- 性能提升：2000ms → 50-100ms（20倍）
- 工时估算：P0(11h) + P1(7h) + P2(4h) = 22小时
- MVP工时：11小时
- 风险等级：中等（有完善的缓解措施）

**推荐实施路径**：

1. 先实施P0功能（11小时）验证可行性
2. 再实施P1功能（7小时）保证生产质量
3. 最后实施P2功能（4小时）优化体验

**下一步**：等待审核和确认
