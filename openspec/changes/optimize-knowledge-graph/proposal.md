## Why

当前知识图谱存在三个关键问题：1）对话知识实体严重不足（仅3个decision/solution/pattern），技术决策和方案知识缺失；2）关系权重不均（部分为0.7），关系类型单一；3）中文搜索支持薄弱，关键词匹配不准确。需要优化知识图谱质量，补充对话知识、优化关系网络、增强中文搜索能力。

## What Changes

- **补充对话知识实体**：从历史会话中提取技术决策、问题解决方案、代码模式，创建decision/solution/pattern实体
- **优化关系权重**：重新计算关系权重（基于调用频率、依赖强度），丰富关系类型（adds/extends/implements）
- **增强中文搜索**：优化BM25中文分词，添加中文关键词索引，提升中文查询准确率
- **建立关系验证机制**：检测孤立实体、关系完整性检查、权重合理性验证
- **创建知识质量报告**：生成实体分布、关系网络、搜索质量等维度报告

## Capabilities

### New Capabilities

- `conversation-knowledge-extraction`: 从历史会话中提取技术决策、方案、模式，创建对话知识实体
- `relationship-weight-optimization`: 基于调用频率和依赖强度优化关系权重
- `chinese-search-enhancement`: 优化BM25中文分词和索引，提升中文搜索准确率
- `relationship-validation`: 验证关系完整性，检测孤立实体和缺失关系
- `knowledge-quality-reporting`: 生成多维度知识质量报告

### Modified Capabilities

- 无现有能力修改

## Impact

- **插件端**: 新增20-30个对话知识实体，关系数量从69提升到100+
- **后端服务**: 关系权重更新，新增中文关键词索引
- **搜索质量**: 中文搜索准确率从当前<50%提升到>80%
- **知识图谱**: 决策/方案/模式实体从3个提升到25+个
