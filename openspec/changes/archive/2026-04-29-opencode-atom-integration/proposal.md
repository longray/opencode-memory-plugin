## Why

当前 OpenCode 使用记忆插件时，只能创建"一大坨"扁平记忆，无法利用 v3.3 Atom Architecture 的原子化、层级化、可链接的知识组织能力。这导致知识检索效率低下、上下文管理粗放、无法精准引用知识片段。我们需要让 OpenCode 真正"内化"原子化知识管理，主动将信息组织为 Atom 树、使用 [[atom_id]] 链接、按层级检索。

## What Changes

### 工具层增强
- **memory_write**: 暴露 `atoms` 参数，支持创建带 Atom 树结构的记忆
- **新增 entity_update**: 批量更新 Entity 和 Atom（增删改）
- **新增 entity_atoms**: 获取 Atom 树结构
- **memory_search**: 扩展支持 `scope: "atom"` 和 `atom_types` 过滤

### 同步层修复
- **syncMemoryToBackend**: 修复 atoms 参数不传给后端的 Bug

### Prompt 工程
- **SOUL.md**: 注入 Atom Architecture 认知和使用指南
- **AGENTS.md**: 定义 Atom 操作规范和自动萃取规则
- **TOOLS.md**: 说明 Atom 工具使用方法和最佳实践

### Agent 工作流改造
- **The Observer**: 自动将对话内容萃取为 Atom 树而非扁平存储
- **The Librarian**: 按 Atom 粒度整合碎片知识，建立知识图谱

### 代码分析关联
- **code-analysis-service**: 分析结果自动关联到最近的对话记忆

## Capabilities

### New Capabilities
- `atom-tools`: Atom 级工具操作（entity_update, entity_atoms, atom_search）
- `atom-prompt-injection`: Atom 架构认知注入到 Agent Prompt
- `atom-workflow`: Agent 自动萃取和组织 Atom 树的工作流
- `atom-context-management`: 按 Atom 粒度管理上下文

### Modified Capabilities
- `memory-write`: 扩展支持 atoms 参数
- `memory-search`: 扩展支持 Atom 粒度搜索
- `sync-backend`: 修复 atoms 同步逻辑

## Impact

### 代码文件
- `opencode-memory-plugin/tools/core.js` - memory_write 增强
- `opencode-memory-plugin/tools/search.js` - memory_search 扩展
- `opencode-memory-plugin/lib/memory-core.js` - syncMemoryToBackend 修复
- `opencode-memory-plugin/plugin.js` - 新工具注册
- `opencode-memory-plugin/agents/memory-automation.md` - The Observer 改造
- `opencode-memory-plugin/agents/memory-consolidate.md` - The Librarian 改造
- `opencode-memory-plugin/lib/code-analysis-service.js` - 关联逻辑

### 配置文件
- `memory/SOUL.md` - 注入 Atom 认知
- `memory/AGENTS.md` - 操作规范
- `memory/TOOLS.md` - 使用说明

### API 变更
- **新增**: `entity_update`, `entity_atoms` 工具
- **扩展**: `memory_write` 新增 `atoms` 参数
- **扩展**: `memory_search` 新增 `scope`, `atom_types` 参数

### 向后兼容
- 所有变更向后兼容，atoms 参数为 optional
- 现有扁平记忆继续正常工作
- 新功能需要显式启用

### 测试影响
- 需要新增 10+ 个测试用例
- 现有测试应继续通过
- 需要集成测试验证端到端流程
