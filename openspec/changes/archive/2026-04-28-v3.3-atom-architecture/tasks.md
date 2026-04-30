# v3.3 Atom 架构实施任务

## Phase 1: 后端基础（1 周）

### 1.1 Atom 字段扩展
- [ ] **TDD** 修改 `AtomCreateRequest` 模型
  - 添加字段：tags, heading_level, parent_id, order, aliases
  - 编写单元测试验证字段验证逻辑
  - 测试边界条件（空值、超长字符串、特殊字符）
  
- [ ] **TDD** 修改 `AtomUpdateRequest` 模型
  - 添加相同的字段支持
  - 编写单元测试验证部分更新逻辑
  
- [ ] **TDD** 修改 `AtomResponse` 模型
  - 确保响应包含所有新字段
  - 编写序列化/反序列化测试
  
- [ ] 更新 SurrealDB schema
  - 添加新字段的表结构定义
  - 编写迁移脚本（向后兼容）
  - 测试现有数据读取

### 1.2 统一搜索端点
- [ ] **TDD** 新建 `POST /api/v1/search` 端点
  - 实现请求参数解析（query, mode, scope, types, atom_types, limit, level）
  - 编写单元测试覆盖所有参数组合
  
- [ ] **TDD** 实现 Entity 搜索逻辑
  - 集成现有 Meilisearch 索引
  - 编写测试验证搜索结果格式
  
- [ ] **TDD** 实现 Atom 搜索逻辑
  - 查询 SurrealDB 中的 Atom 表
  - 编写测试验证跨 Entity 搜索
  
- [ ] **TDD** 实现混合排序（Entity + Atom 结果合并）
  - 按 score 排序
  - 编写测试验证排序正确性
  
- [ ] 集成测试
  - 端到端测试搜索端点
  - 验证响应格式符合 spec.md

## Phase 2: 插件端核心（1 周）

### 2.1 存储层改造
- [x] **TDD** 修改 `buildEntryContent` 函数
  - 支持 Atoms 段生成
  - 编写测试验证 JSON 格式正确性
  - 测试边界条件（空 atoms 数组、嵌套层级）
  
- [x] **TDD** 修改 `parseEntryFromFile` 函数
  - 解析 `≡≡≡ Atoms ≡≡≡` 段
  - 编写测试验证解析正确性
  - 测试错误处理（无效 JSON、缺失字段）
  
- [x] **TDD** 实现 `buildAtomTree` O(n) 算法
  - 从扁平数组重建树结构
  - 编写测试覆盖：空数组、单节点、深层嵌套、循环引用
  - 性能测试：1000 个节点
  
- [x] **TDD** 实现 `flattenAtomTree` 扁平化
  - 树结构转扁平数组
  - 编写测试验证扁平化正确性
  
- [ ] **TDD** 实现 `synthesizeContentWithAtomIds`
  - 生成包含 [[local_id]] 的文本
  - 编写测试验证输出格式

### 2.2 API 层扩展
- [x] **TDD** 修改 `memory_write` 工具
  - 支持 atoms 树参数
  - 编写测试验证 atoms 写入
  - 测试向后兼容（无 atoms 参数）
  
- [x] **TDD** 修改 `memory_read` 工具
  - 实现 ID 类型自动检测
  - 编写测试：Entity L0/L1/L2 读取
  - 编写测试：Atom 读取
  - 测试向后兼容（返回字符串模式）
  
- [x] **TDD** 实现 `update_entity` 工具
  - 支持 entity_updates 和 atoms_batch
  - 编写测试：add/update/remove 操作
  - 编写测试：事务回滚
  - 编写测试：循环引用检测
  
- [ ] **TDD** 实现 `get_entity_atoms` 工具
  - 返回 Atom 树结构
  - 编写测试验证树结构正确性
  
- [ ] **TDD** 实现 `extractWikiLinks` 函数
  - 解析 [[target|label]] 语法
  - 编写测试覆盖：普通链接、嵌入链接、无标签链接
  
- [ ] **TDD** 实现 `findIncomingLinks` 函数
  - 单文件内反向链接查询
  - 编写测试验证查询正确性

## Phase 3: 风险缓解（1 周）

### 3.1 循环引用检测
- [x] **TDD** 实现 `detectCircularReference` 三色 DFS
  - 编写测试：空图、单节点自环、长链环、多环交织
  - 性能测试：1000 个节点，深度 100
  - 验证错误消息包含完整路径

### 3.2 悬挂引用处理
- [ ] **TDD** 实现悬挂 parent_id 降级逻辑
  - 在 `buildAtomTree` 中处理
  - 编写测试验证降级为根级
  - 添加警告日志

### 3.3 死链标记
- [ ] **TDD** 实现死链检测
  - 在 `extractWikiLinks` 中验证 target 存在性
  - 编写测试验证死链标记
  - 确保不抛出错误

### 3.4 分数索引实现
- [x] **TDD** 实现 `generateFractionalIndex` 函数
  - base-62 编码实现
  - 编写测试：初始值、中间插入、边界情况
  - 测试空间耗尽场景

### 3.5 文件大小监控
- [ ] **TDD** 实现文件大小检查
  - 警告阈值：80KB
  - 硬限制：100KB
  - 编写测试验证阈值触发
  - 添加拆分建议提示

## Phase 4: 测试与优化（1 周）

### 4.1 单元测试
- [ ] 确保所有新函数有单元测试覆盖
- [ ] 测试覆盖率 > 80%
- [ ] 边界条件测试完整

### 4.2 集成测试
- [ ] 端到端测试：完整 Atom 生命周期
  - 创建 Entity 带 Atoms
  - 读取 Entity 和 Atom
  - 更新 Atoms
  - 删除 Atoms
  
- [ ] 向后兼容测试
  - 旧格式 Entity 读取
  - 旧格式 memory_write
  - feature flag 切换

### 4.3 性能测试
- [ ] 大文件测试（100+ Atoms）
  - 读取性能
  - 写入性能
  - 搜索性能
  
- [ ] 并发测试
  - 多进程同时写入
  - 验证数据一致性

### 4.4 文档更新
- [ ] 更新 API-CONTRACT.md
- [ ] 更新插件文档
- [ ] 编写迁移指南
- [ ] 更新 CHANGELOG.md

## 验收标准

### 功能验收
- [ ] 新 Entity 可以包含 Atom 树结构
- [ ] Atom 支持 parent_id 层级和 order 排序
- [ ] memory_read 自动检测 ID 类型（Entity/Atom）
- [ ] update_entity 支持批量 Atom 操作
- [ ] 循环引用被检测并拒绝写入
- [ ] 向后兼容：旧格式 Entity 正常工作

### 性能验收
- [ ] 100 个 Atom 的 Entity 读取 < 100ms
- [ ] 搜索响应 < 200ms
- [ ] 文件大小监控正常工作

### 质量验收
- [ ] 所有测试通过
- [ ] 代码评审通过
- [ ] 文档完整

## 依赖关系

```
Phase 1 (后端)
    │
    ▼
Phase 2 (插件端核心)
    │
    ├──> 2.1 存储层
    │       └──> 2.2 API 层
    │
    ▼
Phase 3 (风险缓解)
    │
    ├──> 3.1 循环检测
    ├──> 3.2 悬挂引用
    ├──> 3.3 死链标记
    ├──> 3.4 分数索引
    └──> 3.5 文件监控
    │
    ▼
Phase 4 (测试与优化)
    │
    ├──> 4.1 单元测试
    ├──> 4.2 集成测试
    ├──> 4.3 性能测试
    └──> 4.4 文档更新
```

## 标记说明

- **[TDD]**：测试驱动开发任务，必须先写测试再实现
- **向后兼容**：确保不影响现有功能
- **性能关键**：需要性能测试验证
