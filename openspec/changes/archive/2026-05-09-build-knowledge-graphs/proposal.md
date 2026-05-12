## Why

当前 OpenCode Memory Plugin 的记忆数据分散且缺乏结构化组织，导致知识检索效率低下。我们需要构建两种知识图谱来系统化地组织项目知识：1）从 OpenCode 对话中提取技术决策、问题解决方案等形成对话知识图谱；2）从项目代码分析中提取函数、类、模块关系形成代码知识图谱。这将显著提升知识检索效率，为后续开发提供智能指导。

## What Changes

- **清空现有记忆数据**：清理插件端本地记忆目录和后端 SurrealDB/Meilisearch 数据
- **构建对话知识图谱**：使用 session 工具提取历史对话中的技术决策、问题解决方案、代码模式等，组织为 Entity-Atom 结构
- **构建代码知识图谱**：使用 code-analyzer 分析项目代码，提取函数、类、模块及调用关系，组织为 Entity-Atom 结构
- **验证知识图谱**：测试搜索功能，确保知识图谱可被有效检索
- **建立提取规则**：定义对话内容提取标准和代码知识组织规范

## Capabilities

### New Capabilities

- `conversation-knowledge-extraction`: 从 OpenCode 对话中提取技术决策、问题解决方案、代码模式等知识，组织为 Entity-Atom 知识图谱
- `code-knowledge-graph`: 分析项目代码结构，提取函数、类、模块及调用关系，构建代码知识图谱
- `knowledge-graph-validation`: 验证知识图谱的完整性和可检索性

### Modified Capabilities

- 无现有能力修改

## Impact

- **插件端**: `~/.opencode/memory/` 目录将被清空并重新填充结构化知识
- **后端服务**: SurrealDB 和 Meilisearch 数据将被清空并重新索引
- **代码库**: 新增知识提取脚本和验证工具
- **开发流程**: 建立知识图谱构建的标准流程
