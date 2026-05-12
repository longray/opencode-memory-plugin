## Context

当前知识图谱的代码关系提取存在严重瓶颈。根据状态检查，301个实体仅有约2,528个关系，其中代码关系（depends_on/calls/extends）仅占9.6%（约243个）。根本问题在于：

1. **跨文件符号解析缺失**：import路径无法映射到实体ID，导致depends_on关系仅137个（预期500+）
2. **全局符号表未持久化**：函数调用无法解析到目标实体，calls关系仅30个（预期1,000+）
3. **类继承提取不完整**：superClass信息提取后未创建关系，extends关系仅76个（预期200+）
4. **健康检查人工触发**：无定时机制，需手动运行CLI
5. **关系推荐全人工**：无自动创建，需dryRun后手动确认

代码分析服务（code-analysis-service.js）已提取imports和calls，但上传时未构建符号表映射，导致无法创建跨文件关系。

## Goals / Non-Goals

**Goals:**

- 实现跨文件符号解析，将import路径映射到实体ID
- 构建全局符号表缓存，支持函数调用跨文件解析
- 自动创建depends_on/calls/extends代码关系
- 实现定时健康检查，每日自动运行并告警
- 实现双阈值关系推荐，高置信度自动创建

**Non-Goals:**

- 不修改后端API，使用现有createReference接口
- 不引入新的存储系统，使用现有MemoryIdCache机制
- 不改变代码分析核心逻辑，仅增强关系创建阶段
- 不实现实时关系推荐，保持批量处理模式

## Decisions

### Decision 1: 符号表存储方案

**选择**: 扩展MemoryIdCache，添加`pathToEntityId`和`globalNameToEntityId`映射

**理由**:

- MemoryIdCache已有持久化机制（`memory-id-cache.json`）
- 支持防抖保存（1000ms），避免频繁IO
- 可从本地文件重建，支持增量更新
- 无需引入新依赖

**替代方案**:

- 独立SymbolTable模块：增加复杂度，重复持久化逻辑
- 数据库存储：增加后端依赖，不符合本地优先设计

### Decision 2: 符号表构建时机

**选择**: 在`uploadProject()`批量上传前构建完整符号表

**流程**:

```
1. 收集所有文件路径
2. 逐个上传文件，获取entity_id
3. 构建path→entity_id映射
4. 提取所有exports，构建globalName→entity_id映射
5. 第二遍遍历：创建关系
```

**理由**:

- 批量上传时已知所有文件，可构建完整映射
- 避免单文件上传时的循环依赖问题
- 支持跨文件引用解析

**替代方案**:

- 单文件上传时构建：无法解析跨文件引用
- 延迟构建：增加复杂度，需要异步解析

### Decision 3: 路径解析策略

**选择**: 支持相对路径解析（`./utils`, `../config`）+ Node.js模块解析

**实现**:

```javascript
function resolveImportPath(importPath, currentFile) {
  if (importPath.startsWith(".")) {
    // 相对路径: ./utils -> /project/src/utils.js
    return path.resolve(path.dirname(currentFile), importPath);
  }
  // 内置模块: fs, path -> 跳过
  if (isBuiltin(importPath)) return null;
  // node_modules: lodash -> 跳过（外部依赖）
  return null;
}
```

**理由**:

- 项目内部依赖是关系创建的主要目标
- 外部依赖（node_modules）关系价值低
- 内置模块无需追踪

### Decision 4: 定时任务实现

**选择**: 使用Node.js `setInterval`，在plugin.js初始化时启动

**配置**:

```javascript
// memory-config.json
{
  "health_check": {
    "enabled": true,
    "schedule": "0 9 * * *",  // 每天9点
    "threshold": 80,           // 低于80分告警
    "auto_fix": false           // 不自动修复
  }
}
```

**理由**:

- 无需引入cron库，使用简单setInterval
- 配置灵活，支持禁用和调整时间
- 与插件生命周期绑定，自动启停

**替代方案**:

- node-cron库：增加依赖，功能过剩
- 操作系统cron：与插件解耦，管理复杂

### Decision 5: 双阈值策略

**选择**:

- `>0.85`: 自动创建（高置信度）
- `0.75-0.85`: 待审核（中置信度）
- `<0.75`: 忽略（低置信度）

**理由**:

- 0.85阈值过滤掉大部分低质量关系
- 0.75-0.85保留人工审核机会
- 与现有0.75阈值兼容

**替代方案**:

- 单阈值0.8：过于严格，减少自动创建
- 机器学习模型：增加复杂度，需要训练数据

## Risks / Trade-offs

### Risk 1: 符号表内存占用

**风险**: 大型项目（1000+文件）符号表可能占用50-100MB内存

**缓解**:

- 符号表按需加载，非全量常驻
- 支持配置`symbol_table.max_size`限制
- 使用LRU缓存策略，淘汰不常用条目

### Risk 2: 路径解析不准确

**风险**: 复杂路径别名（Webpack alias, TypeScript paths）无法解析

**缓解**:

- 优先支持标准Node.js解析
- 可配置`path_aliases`映射
- 解析失败时记录警告，不阻断流程

### Risk 3: 关系创建失败影响同步

**风险**: 关系创建失败可能导致同步中断

**缓解**:

- 关系创建失败记录日志，不阻断主流程
- 使用`Promise.allSettled`批量处理
- 支持重试机制（最多3次）

### Risk 4: 定时任务资源占用

**风险**: 健康检查运行时占用CPU/内存，影响正常使用

**缓解**:

- 健康检查异步执行，不阻塞主线程
- 支持配置`health_check.timeout`限制时间
- 低优先级运行，使用`setImmediate`调度

### Trade-off 1: 代码分析时间增加

**代价**: 符号表构建增加10-20%分析时间

**收益**: 代码关系数量提升3-5倍

**决策**: 接受，关系质量提升远大于时间成本

### Trade-off 2: 存储空间增加

**代价**: 符号表缓存增加50MB磁盘占用

**收益**: 跨文件关系解析能力

**决策**: 接受，可配置清理策略

## Migration Plan

### Phase 1: 符号表模块（1-2天）

1. 创建`lib/symbol-table.js`
2. 实现`SymbolTable`类，封装path/globalName映射
3. 集成到MemoryIdCache持久化
4. 添加单元测试

### Phase 2: 代码关系增强（2-3天）

1. 修改`code-analysis-service.js`
   - 在`uploadProject`中添加符号表构建
   - 实现`createCodeRelations`方法
   - 添加depends_on/calls/extends关系创建
2. 更新`code-analyzer.js`
   - 增强superClass提取
   - 确保exports信息完整
3. 添加集成测试

### Phase 3: 定时健康检查（1天）

1. 修改`plugin.js`
   - 添加定时任务初始化
   - 实现健康检查调度器
2. 修改`quality-dashboard.js`
   - 添加定时模式支持
   - 实现告警通知
3. 添加配置项到`memory-config.json`

### Phase 4: 双阈值推荐（1-2天）

1. 修改`relation-recommender.js`
   - 实现双阈值策略
   - 添加自动创建逻辑
   - 实现待审核队列
2. 添加配置项`recommendation.thresholds`
3. 添加单元测试

### Phase 5: 集成测试（1天）

1. 端到端测试：完整代码分析流程
2. 性能测试：大型项目符号表构建
3. 回归测试：确保现有功能正常

### Rollback Strategy

- **符号表问题**: 禁用`symbol_table.enabled`，回退到单文件模式
- **定时任务问题**: 设置`health_check.enabled: false`，停止定时任务
- **双阈值问题**: 设置`recommendation.auto_create: false`，恢复dryRun模式
- **全量回滚**: 恢复`code-analysis-service.js`到上一版本

## Open Questions

1. **TypeScript路径别名**: 是否需要支持`tsconfig.json`中的`paths`配置？
2. **Monorepo支持**: 跨package引用如何解析？是否需要支持`workspace:`协议？
3. **关系去重**: 如果手动创建了关系，自动提取时如何检测重复？
4. **健康检查通知**: 除了控制台日志，是否需要支持邮件/Slack通知？
5. **待审核队列**: 中置信度关系存储在哪里？是否需要新的存储机制？
