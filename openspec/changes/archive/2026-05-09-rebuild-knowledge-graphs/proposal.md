## Why

当前知识图谱覆盖率仅 15-20%，存在严重缺口：WebSocket 子系统（6文件/5类）0%覆盖、Precompute 子系统（3文件/3类）0%覆盖、20个 Plugin Tools 0%覆盖、atom-tree.js（7核心函数）0%覆盖。lib/ 目录26个文件被粗糙合并为1个实体，粒度失衡。需要系统化重建知识图谱，确保每个重要文件、类、函数都有独立实体，达到80%+覆盖率。

## What Changes

- **清空现有知识图谱**：清理后端 SurrealDB/Meilisearch 和插件端 timeline 数据，保留核心配置文件
- **建立文件级扫描机制**：使用 glob 遍历所有文件，确保不遗漏子目录（websocket/, precompute/）
- **独立实体化**：每个重要文件（>100行或有导出）创建独立 code_module/code_class/code_function 实体
- **分层级构建**：Module → Class → Function 三级递进，避免粒度失衡
- **覆盖率验证**：建立文件/类/函数三级检查清单，确保覆盖率 >80%
- **关系图谱补全**：建立 contains/calls/depends_on/implements 关系网络

## Capabilities

### New Capabilities

- `file-level-code-analysis`: 文件级代码分析，每个重要文件独立分析并创建实体
- `subdirectory-recursive-scan`: 递归扫描子目录（websocket/, precompute/），确保无遗漏
- `coverage-validation`: 覆盖率验证机制，文件/类/函数三级检查清单
- `granular-entity-creation`: 粒度化实体创建，避免合并多个文件到一个实体
- `relationship-graph-completion`: 关系图谱补全，建立完整的 contains/calls/depends_on 关系

### Modified Capabilities

- 无现有能力修改

## Impact

- **插件端**: `~/.opencode/memory/timeline/` 将被清空并重建，新增 30-40 个实体
- **后端服务**: SurrealDB 和 Meilisearch 数据清空并重新索引
- **代码库**: 新增系统化代码分析脚本和覆盖率验证工具
- **知识图谱**: 从 14 实体扩展到 40-50 实体，覆盖率从 15% 提升到 80%+
