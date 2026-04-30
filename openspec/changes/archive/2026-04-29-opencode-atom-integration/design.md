## Context

### 当前状态

**已实现（底层）**:
- `lib/memory-core.js`: `writeMemory({atoms})` 完整支持 Atom 树
- `lib/atom-tree.js`: 树算法、循环检测、分数索引
- `lib/code-analysis-service.js`: 自动 Atom 化代码分析结果
- 后端 API: 完整的 Atom CRUD 和搜索

**缺失（工具层）**:
- `tools/core.js`: `memory_write` 未暴露 `atoms` 参数
- `tools/search.js`: 不支持 Atom 粒度搜索
- `plugin.js`: 未注册 Atom 相关工具

**缺失（Agent 层）**:
- `agents/*.md`: 无 Atom 架构认知
- `memory/*.md`: 无 Atom 使用指南

### 约束条件

1. **向后兼容**: atoms 参数必须为 optional，现有代码继续工作
2. **渐进式**: 不强制使用 Atom，Agent 可选择性采用
3. **性能**: Atom 树构建 O(n)，搜索响应 < 200ms
4. **测试**: 所有变更必须有测试覆盖

## Goals / Non-Goals

**Goals:**
- OpenCode 可以创建带 Atom 树结构的记忆
- Agent 主动将结构化知识组织为 Atom 树
- 支持 [[atom_id]] 精准引用知识片段
- 按 Atom 粒度加载上下文，减少 token 浪费
- 代码分析与对话记忆统一在 Atom 架构下

**Non-Goals:**
- 强制所有记忆使用 Atom 结构（保持可选）
- 修改后端 API（已完整支持）
- 支持超过 4 层嵌套（限制复杂度）
- 自动迁移旧记忆（保持现状）

## Decisions

### Decision 1: 工具层暴露 vs Prompt 工程优先

**选择**: 工具层暴露优先

**理由**:
- 工具层是基础设施，必须先就绪
- Prompt 工程依赖工具可用
- 符合"先硬件后软件"原则

**替代方案**: Prompt 工程优先（被否决）
- 风险: Agent 知道 Atom 但无法使用，产生挫败感

### Decision 2: 新增独立工具 vs 扩展现有工具

**选择**: 混合策略
- 扩展 `memory_write` 添加 `atoms` 参数
- 新增 `entity_update`, `entity_atoms` 独立工具
- 扩展 `memory_search` 添加 `scope` 参数

**理由**:
- 扩展保持向后兼容
- 新增工具语义清晰（update 是批量操作，需要独立工具）
- 避免 `memory_write` 过于复杂

### Decision 3: Agent 自动萃取 vs 手动标记

**选择**: 自动萃取 + 手动确认

**流程**:
1. The Observer 自动识别结构化内容
2. 构建 Atom 树候选
3. 用户确认后保存

**理由**:
- 减少用户认知负担
- 保持 Human-in-the-loop
- 避免过度自动化

### Decision 4: 同步 vs 异步同步

**选择**: 异步同步（保持现有）

**理由**:
- 不阻塞用户操作
- 后台自动处理
- 失败可重试

### Decision 5: 本地文件格式

**选择**: 保持现有格式，Atoms 内嵌 JSON

**格式**:
```markdown
---
id: 01HQ...
type: memory
---

# ≡≡≡ Abstract ≡≡≡
```
摘要
```

# ≡≡≡ Overview ≡≡≡
```
概述
```

# ≡≡≡ Contents ≡≡≡
```
内容
```

# ≡≡≡ Atoms ≡≡≡
```json
[{"local_id": "01A1", "type": "chapter", ...}]
```
```

**理由**:
- 向后兼容
- 人类可读
- 易于调试

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Agent 不理解 Atom 结构 | 高 | Prompt 工程 + 示例引导 |
| atoms 参数 schema 复杂 | 中 | 提供清晰的示例和模板 |
| 性能下降（大树构建） | 低 | O(n) 算法，已优化 |
| 向后兼容性问题 | 低 | atoms 为 optional，默认空数组 |
| 用户困惑（新功能） | 中 | 文档 + 渐进式引导 |

**Trade-offs**:
- **灵活性 vs 简单性**: 选择灵活性（Atom 结构可选），牺牲简单性（需要学习）
- **功能完整 vs 快速交付**: 选择功能完整（完整 Atom 支持），牺牲时间（2-3 天 vs 1 天）

## Migration Plan

### Phase 1: 工具层（Day 1-2）
1. 修复 `memory_write` 暴露 `atoms`
2. 修复 `syncMemoryToBackend` 同步 `atoms`
3. 新增 `entity_update`, `entity_atoms`
4. 扩展 `memory_search`
5. 更新 `plugin.js` 注册

### Phase 2: Prompt 工程（Day 3-4）
1. 更新 `SOUL.md`
2. 更新 `AGENTS.md`
3. 更新 `TOOLS.md`

### Phase 3: Agent 改造（Day 5-7）
1. 改造 `The Observer`
2. 改造 `The Librarian`
3. 代码分析关联

### Rollback Strategy
- 所有变更为 additive，可安全回滚
- 保留 git 历史，可随时 revert
- Feature flag 控制（可选）

## Open Questions

1. **Atom 大小限制**: 是否需要限制单个 Atom 内容长度？
   - 建议: 500-1000 字符

2. **层级深度限制**: 是否限制最大层级？
   - 建议: 4 层（Entity → Chapter → Section → Detail）

3. **自动萃取触发条件**: 什么情况下自动萃取 Atom？
   - 建议: 内容 > 1000 字 或 检测到明确层级结构

4. **[[atom_id]] 链接格式**: 是否支持别名？
   - 建议: 支持 `[[id|alias]]` 格式
