# 智能增量同步设计

**创建时间**: 2026-03-16  
**状态**: 设计阶段  
**优先级**: 高

## 问题背景

### 当前同步机制的局限

1. **只能处理新增**：
   - `memory_write` 工具写入 → 自动同步
   - 手动编辑文件 → 没有同步
   - 删除条目 → 后端不知道
   - 修改条目 → 后端还是旧版本

2. **rebuild_index 的局限**：
   - 只做"上传"操作，不做"删除"
   - 使用 source_id 去重，但不会删除后端已有但本地没有的条目
   - 没有"同步删除"机制

3. **实际场景**：
   - 用户手动编辑 MEMORY.md（修改、删除、新增条目）
   - memory-consolidate 代理归并整理 daily 日志
   - 用户精简本地文件后，后端还保留旧数据
   - 搜索结果不一致

## 设计目标

1. **完整的变更检测**：检测新增、修改、删除
2. **智能同步**：只同步变化的部分
3. **安全机制**：大量删除时提示用户确认
4. **用户可控**：提供手动和自动两种模式
5. **向后兼容**：不破坏现有功能

## 核心设计

### 1. 变更检测机制

**原理**：对比本地和后端的 source_id 集合

```javascript
// 获取本地所有条目的 source_id
const localIds = new Set();
for (const entry of localEntries) {
  localIds.add(entry.source_id);
}

// 获取后端所有条目的 source_id
const backendIds = await client.listSourceIds(tenantId, projectId);

// 对比差异
const toAdd = [...localIds].filter((id) => !backendIds.has(id));
const toDelete = [...backendIds].filter((id) => !localIds.has(id));
```

**变更类型**：

- **新增**：local_ids - backend_ids
- **删除**：backend_ids - local_ids
- **修改**：内容变化导致 source_id 变化（先删除旧的，再添加新的）

### 2. 同步策略

**默认模式：增量同步**

```javascript
rebuild_index(); // 默认行为
```

- 检测变更
- 上传新增的条目
- 删除后端多余的条目
- 显示变更摘要

**完全重建模式**

```javascript
rebuild_index force_clean=true
```

- 清空后端该项目的所有数据
- 重新上传本地所有文件
- 适用于大规模清理后

### 3. 安全机制

**删除确认**：

```javascript
if (toDelete.length > 10) {
  return `⚠️ Warning: ${toDelete.length} entries will be deleted.
  
Run with confirm=true to proceed:
rebuild_index confirm=true`;
}
```

**变更摘要**：

```
🔄 Sync preview:
- To add: 5 entries
- To delete: 12 entries
- Current total: 108 entries
- After sync: 101 entries

Run rebuild_index to apply changes.
```

### 4. 触发方式

**手动触发**：

- 用户运行 `rebuild_index`
- 默认增量同步
- 可选 `force_clean=true` 完全重建

**自动触发**（可选）：

- OpenCode 启动时检查
- 检测到本地文件变化时提示
- 后台定期同步（可配置）

## 实现要点

### 后端 API 需求

1. **listSourceIds(tenant_id, project_id)**
   - 返回该项目所有条目的 source_id 列表
   - 性能优化：只返回 ID，不返回完整内容

2. **deleteBySourceIds(source_ids[])**
   - 批量删除指定的 source_id
   - 支持事务，确保原子性

3. **clearProject(tenant_id, project_id)**
   - 清空该项目的所有数据
   - 用于 force_clean 模式

### 插件端实现

**修改 rebuild_index 工具**：

```javascript
rebuild_index: tool({
  args: {
    dry_run: boolean,
    force_clean: boolean,
    confirm: boolean,
  },
  async execute(args) {
    if (args.force_clean) {
      // 完全重建模式
      await client.clearProject(tenantId, projectId);
      // 重新上传所有文件
    } else {
      // 增量同步模式
      const localIds = getLocalSourceIds();
      const backendIds = await client.listSourceIds(tenantId, projectId);

      const toAdd = difference(localIds, backendIds);
      const toDelete = difference(backendIds, localIds);

      if (toDelete.length > 10 && !args.confirm) {
        // 提示用户确认
      }

      // 执行同步
      await syncChanges(toAdd, toDelete);
    }
  },
});
```

## 用户体验

### 典型使用场景

**场景1：精简本地文件后**

```bash
# 用户精简了 MEMORY.md
# 运行同步
rebuild_index

# 输出：
# ⚠️ Warning: 45 entries will be deleted.
# Run with confirm=true to proceed

# 用户确认
rebuild_index confirm=true

# 输出：
# 🔄 Sync completed:
# - Deleted: 45 entries
# - Total: 63 entries in backend
```

**场景2：完全重建**

```bash
# 用户想完全重建后端索引
rebuild_index force_clean=true

# 输出：
# 🔄 Rebuilding backend index...
# - Cleared: 108 entries
# - Uploaded: 63 entries
# ✅ Rebuild completed
```

**场景3：预览变更**

```bash
# 用户想先看看会有什么变化
rebuild_index dry_run=true

# 输出：
# 📊 Sync preview:
# - To add: 5 entries
# - To delete: 12 entries
# - To keep: 91 entries
```

## 实现计划

### Phase 1: 后端 API（优先级：高）

- [ ] 实现 listSourceIds API
- [ ] 实现 deleteBySourceIds API
- [ ] 实现 clearProject API
- [ ] 测试 API 性能和稳定性

### Phase 2: 插件端实现（优先级：高）

- [ ] 修改 rebuild_index 工具
- [ ] 添加变更检测逻辑
- [ ] 添加安全确认机制
- [ ] 更新工具文档

### Phase 3: 测试和优化（优先级：中）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 用户体验优化

### Phase 4: 自动同步（优先级：低）

- [ ] OpenCode 启动时检查
- [ ] 文件变化监听
- [ ] 后台定期同步

## 风险和注意事项

1. **数据丢失风险**：
   - 删除操作不可逆
   - 必须有确认机制
   - 建议提供备份功能

2. **性能问题**：
   - listSourceIds 可能返回大量数据
   - 需要优化查询性能
   - 考虑分页或增量获取

3. **并发问题**：
   - 多个客户端同时同步
   - 需要考虑冲突处理
   - 建议使用乐观锁

4. **向后兼容**：
   - 不能破坏现有功能
   - 默认行为应该安全
   - 提供降级方案

## 参考资料

- [rebuild_index 工具分析](./AGENTS.md#rebuild_index)
- [数据一致性分析](./AGENTS.md#数据一致性)
- [后端 API 设计](./opencode-memory-plugin/ARCHITECTURE.md)

---

**下一步**：等待后端 API 实现后，开始插件端开发。
