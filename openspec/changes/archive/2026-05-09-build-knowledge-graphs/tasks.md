## 1. Preparation and Cleanup

- [x] 1.1 Backup core configuration files (AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, MEMORY.md, memory-config.json)
- [x] 1.2 Clear plugin端 timeline data (remove ~/.opencode/memory/timeline/\* entries)
- [x] 1.3 Clear backend SurrealDB and Meilisearch data via API
- [x] 1.4 Reset local indexes (link-map.json, MEMORY.md)
- [x] 1.5 Verify cleanup completion (index_status, check timeline directory)

## 2. Code Knowledge Graph Building

- [x] 2.1 Run code-analyzer on the entire project to extract code structure
- [x] 2.2 Parse JavaScript/TypeScript files to extract functions, classes, modules
- [x] 2.3 Build code relationship graph (calls, imports, inheritance)
- [x] 2.4 Create code_module entities with Chapter atoms (模块概述, 导出列表, 依赖关系)
- [x] 2.5 Create code_function entities with Chapter atoms (函数签名, 参数说明, 返回值, 实现逻辑, 调用关系)
- [x] 2.6 Create code_class entities with Chapter atoms (类定义, 继承关系, 方法列表, 属性列表, 使用示例)
- [x] 2.7 Establish relationships between code entities using memory_relate
- [x] 2.8 Sync all code knowledge to backend (incremental_sync or full_sync)

## 3. Conversation Knowledge Graph Building

- [x] 3.1 Use session_list to retrieve all historical OpenCode sessions
- [x] 3.2 Filter sessions by date range and relevance (last 30 days, exclude test sessions)
- [x] 3.3 Use session_read to extract content from high-value sessions
- [x] 3.4 Identify technical decisions using signal words ("我决定...", "选择 X 因为...")
- [x] 3.5 Identify problem solutions using signal words ("根因是...", "修复方案...")
- [x] 3.6 Identify code patterns using signal words ("模式是...", "每次都...")
- [x] 3.7 Filter low-value content using Google Test criteria
- [x] 3.8 Create decision entities with Chapter atoms (背景，方案对比，决策与理由，实施与结果)
- [x] 3.9 Create solution entities with Chapter atoms (问题描述，根因分析，解决步骤，验证结果)
- [x] 3.10 Create pattern entities with Chapter atoms (模式概述，适用场景，实现代码，优缺点)
- [x] 3.11 Establish relationships between conversation entities using memory_relate
- [x] 3.12 Sync all conversation knowledge to backend

## 4. Knowledge Graph Validation

- [x] 4.1 Validate entity counts (verify expected number of code_module, code_function, code_class, decision, solution, pattern entities)
- [x] 4.2 Validate atom structure (check all required atoms exist with valid content)
- [x] 4.3 Test keyword search for known terms ("decision", "function", "error handling")
- [x] 4.4 Test vector search with natural language queries ("how to handle errors")
- [x] 4.5 Test hybrid search combining keywords and semantic meaning
- [x] 4.6 Validate entity relationships using memory_graph traversal
- [x] 4.7 Detect and report any broken or dangling references
- [x] 4.8 Generate completeness report (total entities, atoms, type distribution)
- [x] 4.9 Generate search quality report (precision@K, recall@K, latency)
- [x] 4.10 Generate relationship report (total relationships, type distribution, broken links)

## 5. Documentation and Cleanup

- [x] 5.1 Document extraction rules and patterns used
- [x] 5.2 Document code analysis methodology and coverage
- [x] 5.3 Create knowledge graph usage guide for future development
- [x] 5.4 Archive any temporary files created during the process
- [x] 5.5 Final verification: run health check and confirm all systems operational
