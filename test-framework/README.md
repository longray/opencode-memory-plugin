# OpenCode Memory Plugin 测试框架

完整的60天生产级测试框架，用于验证 OpenCode Memory Plugin 的功能、性能和稳定性。

## 📋 目录结构

test-framework/
├── test-engine.mjs              # 测试引擎核心
├── test-logger.mjs              # 日志记录器
├── test-monitor.mjs             # 性能监控器
├── test-data-generator.mjs      # 测试数据生成器
├── test-data-preprocessor.mjs   # 测试数据预处理器
├── mock-opencode-tools-v5.mjs   # V5批量优化工具类 ⭐
├── run-60day-simulation.mjs     # 主测试执行程序
├── run-batch-optimized-test.mjs # 批量优化测试程序 ⭐
├── suites/                      # 测试套件
│   ├── ingestion-test-suite.mjs # 入库测试
│   ├── retrieval-test-suite.mjs # 检索测试
│   ├── archiving-test-suite.mjs # 归档测试
│   ├── data-flow-test-suite.mjs # 数据流动测试
│   └── 60day-simulation-suite.mjs # 60天模拟测试
└── README.md                    # 本文档
test-framework/
├── test-engine.mjs              # 测试引擎核心
├── test-logger.mjs              # 日志记录器
├── test-monitor.mjs             # 性能监控器
├── test-data-generator.mjs      # 测试数据生成器
├── run-60day-simulation.mjs     # 主测试执行程序
├── suites/                      # 测试套件
│   ├── ingestion-test-suite.mjs # 入库测试
│   ├── retrieval-test-suite.mjs # 检索测试
│   ├── archiving-test-suite.mjs # 归档测试
│   ├── data-flow-test-suite.mjs # 数据流动测试
│   └── 60day-simulation-suite.mjs # 60天模拟测试
└── README.md                    # 本文档
```

## 🚀 快速开始

### 1. 安装依赖

```bash
cd D:\github\opencode-memory-plugin\test-framework
npm install
```

### 2. 运行测试

```bash
# 推荐：运行批量优化测试（V5工具类，40-60x性能提升）
node run-batch-optimized-test.mjs

# 或者运行完整的60天模拟测试
node run-60day-simulation.mjs

# 或者使用 uv run（如果项目使用 uv）
uv run node run-batch-optimized-test.mjs
```

### 3. 查看结果

测试完成后，结果将保存在 `test-results/` 目录：

```
test-results/
├── test-report.md           # 完整测试报告
├── test-results.json        # 详细测试结果
├── test-logs.json           # 操作日志
├── performance-metrics.json  # 性能数据
└── performance-report.md     # 性能报告
```

## 📊 测试覆盖

### 测试套件

| 套件 | 测试用例数 | 覆盖范围 |
|------|----------|---------|
| 入库测试 | 22 | memory_write 的各种场景 |
| 检索测试 | 17 | memory_search 和 vector_memory_search |
| 归档测试 | 10 | list_daily, init_daily, rebuild_index, index_status |
| 数据流动测试 | 18 | 完整的数据流动和错误处理 |
| 60天模拟 | 8 | 模拟60天的实际使用 |
| **总计** | **75** | **覆盖所有8个工具和4种搜索模式** |

### 功能覆盖

#### 工具覆盖率 (8/8)
- ✅ memory_write - 写入记忆
- ✅ memory_read - 读取记忆
- ✅ memory_search - 关键词搜索
- ✅ vector_memory_search - 语义搜索
- ✅ list_daily - 列出日志
- ✅ init_daily - 初始化日志
- ✅ rebuild_index - 重建索引
- ✅ index_status - 索引状态

#### 搜索模式覆盖率 (4/4)
- ✅ hybrid - 混合搜索（70%向量+30%BM25）
- ✅ vector - 纯向量搜索
- ✅ keyword - 纯关键词搜索
- ✅ hash - 哈希快速搜索

#### 记忆类型覆盖率 (3/3)
- ✅ long-term - 长期记忆
- ✅ daily - 每日记忆
- ✅ preference - 用户偏好

## 🎯 测试场景

### 1. 入库测试（22个用例）

**基础入库测试**:
- 短/中/长/超长内容入库
- 不同类型（long-term, daily, preference）
- 不同标签组合

**特殊内容测试**:
- 中日韩字符
- Emoji表情
- 特殊符号
- HTML/XML实体
- 代码片段
- URL链接

**边界条件测试**:
- 空内容（应该拒绝）
- 超长内容（>100KB）
- 标签数量上限
- 标签长度上限
- 同一内容重复入库
- 连续快速入库

### 2. 检索测试（17个用例）

**关键词搜索**:
- 精确匹配
- 部分匹配
- 多词查询
- 不存在的词
- 特殊字符查询
- 中英文混合查询
- 大小写不敏感
- 模糊查询

**语义搜索**:
- 同义词查询
- 概念查询
- 跨语言查询
- 模糊语义查询
- 特定领域查询
- 代码相关查询

**搜索模式**:
- hybrid模式（API可用）
- hybrid模式（API不可用时降级）
- vector模式（API可用）
- vector模式（API不可用时降级）
- keyword模式（纯BM25）
- hash模式（快速哈希）

**性能测试**:
- 小数据量（100条）
- 中等数据量（1000条）

### 3. 归档测试（10个用例）

**每日日志管理**:
- init_daily - 新日期
- init_daily - 已存在
- list_daily - 有日志
- list_daily - 无日志
- 连续多日创建

**索引管理**:
- index_status - 初始状态
- rebuild_index - 完整重建
- rebuild_index - 增量重建
- 重建后搜索
- 大量数据后重建

### 4. 数据流动测试（18个用例）

**完整流程**:
- 写入→关键词搜索→验证
- 写入→语义搜索→验证
- 写入→跨日搜索→验证
- 写入→重建索引→搜索→验证

**长期记忆持久化**:
- 跨会话访问
- 重启后访问
- 多次写入同一主题
- 长时间间隔访问

**错误处理**:
- API超时降级
- API返回错误降级
- 数据完整性验证

**并发和压力测试**:
- 多个并发写入
- 并发写入和搜索
- 连续1000次写入
- 连续1000次搜索
- 混合操作1000次
- 长时间运行测试

### 5. 60天模拟测试（8个用例）

**阶段模拟**:
- 阶段1: 初期使用（Day 1-10）- 180条
- 阶段2: 稳定使用（Day 11-30）- 350条
- 阶段3: 高频使用（Day 31-45）- 650条
- 阶段4: 长期使用（Day 46-60）- 150条

**验证测试**:
- 跨阶段数据验证
- 性能趋势分析
- 索引性能测试
- 最终数据统计

## 📈 生产级验收标准

### 功能验收
- [x] 测试用例覆盖率: 100% (75/75)
- [x] 工具覆盖率: 100% (8/8)
- [x] 搜索模式覆盖率: 100% (4/4)
- [x] 记忆类型覆盖率: 100% (3/3)

### 性能验收
- [ ] 平均入库响应时间 < 100ms
- [ ] 平均搜索响应时间 < 200ms
- [ ] P95响应时间 < 500ms
- [ ] P99响应时间 < 1000ms
- [ ] 最大RSS < 150MB

### 稳定性验收
- [ ] 操作成功率 > 99.9%
- [ ] 无数据丢失
- [ ] 无崩溃
- [ ] 错误恢复率 100%

### 可观测性验收
- [x] 日志完整性: 100%
- [x] 性能数据完整性: 100%
- [x] 错误可追溯性: 100%
- [x] 测试报告完整性: 100%

## 🔧 测试工具

### TestEngine (test-engine.mjs)
测试引擎核心，负责：
- 初始化测试环境
- 运行测试用例
- 收集测试结果
- 生成测试报告

### TestLogger (test-logger.mjs)
日志记录器，提供：
- 分级日志（debug, info, warn, error）
- 操作日志
- 性能日志
- 错误日志
- 日志导出

### PerformanceMonitor (test-monitor.mjs)
性能监控器，提供：
- 计时器（startTimer/endTimer）
- 性能指标记录
- 内存使用监控
- 性能统计
- 阈值检查
- 性能报告生成

### TestDataGenerator (test-data-generator.mjs)
测试数据生成器，提供：
- 60天模拟数据生成
- 测试查询生成
- 数据统计
- 数据导出

## 📝 测试报告

测试完成后生成的报告包括：

### test-report.md
完整的测试报告，包含：
- 执行摘要
- 详细测试结果
- 生产级验收标准
- 性能分析
- 问题分析
- 测试覆盖率
- 结论和建议

### test-results.json
详细的测试结果JSON，包含：
- 每个测试用例的结果
- 持续时间
- 错误信息
- 时间戳

### performance-report.md
性能测试报告，包含：
- 总体统计
- 内存统计
- 性能目标验证
- 阈值违规
- 详细数据

### test-logs.json
操作日志，包含：
- 所有操作记录
- 时间戳
- 日志级别
- 数据

### performance-metrics.json
性能数据，包含：
- 每次操作的持续时间
- 内存使用
- 操作类型
- 元数据

## 🚨 已知限制

1. **模拟工具**: 当前使用 MockOpenCodeTools 模拟工具，实际使用时需要集成真实的 OpenCode 工具
2. **数据量**: 60天模拟生成约1500条记录，可以根据需要调整
3. **测试时间**: 完整测试运行时间约5-10分钟，取决于系统性能
4. **并发限制**: 当前未设置并发限制，可以根据需要调整

## 🔧 扩展开发

### 添加新的测试套件

1. 在 `suites/` 目录创建新的测试套件文件
2. 导出测试套件函数：
   ```javascript
   export function createMyTestSuite() {
     return {
       name: '我的测试套件',
       testCases: [
         {
           name: 'TC-XXX: 测试用例名称',
           category: '分类',
           execute: async (engine) => {
             // 测试逻辑
             return { result };
           },
         },
       ],
     };
   }
   ```

3. 在 `run-60day-simulation.mjs` 中导入并添加到测试套件列表

### 添加新的工具集成

修改 `run-60day-simulation.mjs` 中的 `MockOpenCodeTools` 类，集成真实的 OpenCode 工具。

## 📚 参考文档

- [PRODUCTION_TEST_PLAN.md](../PRODUCTION_TEST_PLAN.md) - 详细的测试计划
- [README.md](../README.md) - 项目主文档
- [CONFIGURATION.md](../opencode-memory-plugin/CONFIGURATION.md) - 配置说明

## 🤝 贡献

欢迎提交问题和改进建议！

## 📄 许可证

与主项目相同
