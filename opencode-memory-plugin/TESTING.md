# 测试套件说明文档

## 概述

本测试套件用于全面测试 OpenCode Memory Plugin v2.0 与后端记忆服务的集成性能、功能和稳定性。

## 测试文件说明

### 1. 测试数据生成器

**文件**: `test-data-generator.mjs`

**功能**: 生成各种类型的测试数据

**用法**:

```bash
# 生成50条混合类型记忆
node test-data-generator.mjs 50 mixed

# 生成100条代码相关记忆
node test-data-generator.mjs 100 code

# 可用的类型: code, meeting, research, bug, decision, mixed
```

**API**:

```javascript
import {
  generateMemories,
  generateMixedMemories,
  generateGraphMemories,
} from './test-data-generator.mjs';

// 生成指定数量的特定类型记忆
const memories = generateMemories(100, 'code');

// 生成混合类型记忆（5种类型各count条）
const mixed = generateMixedMemories(20); // 共100条

// 生成图关系测试数据
const { memories, relations } = generateGraphMemories(50, 0.2); // 50节点，20%边密度
```

### 2. 集成测试

**文件**: `test-integration.mjs`

**功能**: 测试核心组件的基本功能

**测试内容**:

- WrapperClient - 健康检查、搜索、上传
- ProjectResolver - 项目ID解析
- UploadQueue - 上传队列管理
- 集成场景 - 上传后搜索、图关系操作

**用法**:

```bash
node test-integration.mjs
```

**预期结果**: 13个测试全部通过

### 3. 性能基准测试

**文件**: `test-performance.mjs`

**功能**: 测量后端服务的性能指标

**测试内容**:

1. **单条上传延迟** - 50次上传的延迟分布
2. **批量上传性能** - 不同批次大小（1, 5, 10, 20, 50）的吞吐量
3. **搜索延迟** - Keyword、Vector、Hybrid三种模式的延迟
4. **大规模导入** - 1000条记忆的批量导入性能
5. **并发性能** - 不同并发级别的上传性能
6. **Embedding性能** - 文本向量化的性能

**用法**:

```bash
node test-performance.mjs
```

**输出**:

- 控制台报告
- `performance-report.json` - 详细性能数据

**关键指标**:

- 单条上传延迟: < 500ms 为优秀
- 批量上传吞吐量: > 50 items/sec 为优秀
- 搜索延迟: < 200ms 为优秀
- Embedding延迟: < 100ms 为优秀

### 4. 压力测试

**文件**: `test-stress.mjs`

**功能**: 测试后端服务在高负载下的表现

**测试内容**:

1. **并发上传** - 10, 50, 100, 200 并发上传
2. **持续压力** - 1分钟持续负载，目标20 RPS
3. **突发流量** - 100, 200, 500 请求突发
4. **搜索压力** - 50并发搜索，持续30秒
5. **混合负载** - 上传+搜索混合压力测试

**用法**:

```bash
node test-stress.mjs
```

**输出**:

- 控制台报告
- `stress-test-report.json` - 详细压力测试数据

**关键指标**:

- 错误率: < 1% 为优秀
- P95延迟: < 1000ms 为优秀
- 吞吐量稳定性: 波动 < 20% 为优秀

### 5. 图关系性能测试

**文件**: `test-graph-performance.mjs`

**功能**: 测试图数据库的性能

**测试内容**:

1. **关系创建** - 批量关系创建性能
2. **关系查询** - 节点关系查询性能
3. **图遍历** - 不同深度（1-3跳）的遍历性能
4. **复杂查询** - 星型拓扑等复杂结构查询
5. **并发操作** - 并发图操作性能

**用法**:

```bash
node test-graph-performance.mjs
```

**输出**:

- 控制台报告
- `graph-performance-report.json` - 详细图性能数据

**关键指标**:

- 关系查询: < 100ms 为优秀
- 1跳遍历: < 200ms 为优秀
- 2跳遍历: < 500ms 为优秀

### 6. 一键运行所有测试

**文件**: `run-all-tests.mjs`

**功能**: 顺序运行所有测试并生成综合报告

**用法**:

```bash
node run-all-tests.mjs
```

**输出**:

- 每个测试的实时输出
- `comprehensive-test-report.json` - 综合测试报告

**注意**: 此脚本会自动检查后端服务健康状态

## 测试执行顺序建议

### 快速验证 (2-3分钟)

```bash
# 仅运行集成测试
node test-integration.mjs
```

### 性能基准 (5-10分钟)

```bash
# 运行集成测试 + 性能测试
node test-integration.mjs
node test-performance.mjs
```

### 完整测试 (15-30分钟)

```bash
# 运行所有测试
node run-all-tests.mjs
```

### 特定场景测试

```bash
# 只测试图性能
node test-graph-performance.mjs

# 只测试压力
node test-stress.mjs
```

## 环境要求

### 必需

- Node.js 18+
- 后端服务运行在 localhost:17999

### 检查后端服务

```bash
curl http://localhost:17999/health
```

### 启动后端服务

```bash
cd D:\embedding_service
start_services.bat
```

## 性能基准参考

### 后端服务 (GTX 1060)

| 操作         | 优秀     | 良好     | 需优化   |
| ------------ | -------- | -------- | -------- |
| 单条上传     | < 300ms  | < 500ms  | > 500ms  |
| 批量上传(50) | < 1000ms | < 2000ms | > 2000ms |
| Keyword搜索  | < 100ms  | < 200ms  | > 200ms  |
| Vector搜索   | < 200ms  | < 500ms  | > 500ms  |
| Hybrid搜索   | < 200ms  | < 500ms  | > 500ms  |
| Embedding    | < 50ms   | < 100ms  | > 100ms  |
| 关系查询     | < 50ms   | < 100ms  | > 100ms  |
| 图遍历(1跳)  | < 100ms  | < 200ms  | > 200ms  |
| 图遍历(2跳)  | < 300ms  | < 500ms  | > 500ms  |

### 并发能力

| 指标          | 优秀      | 良好      | 需优化    |
| ------------- | --------- | --------- | --------- |
| 并发上传(100) | 错误率<1% | 错误率<5% | 错误率>5% |
| 持续RPS       | > 50      | > 20      | < 20      |
| P95延迟       | < 500ms   | < 1000ms  | > 1000ms  |

## 故障排查

### 测试失败

1. **后端服务未启动**

   ```
   Error: Backend service unavailable
   ```

   **解决**: 启动后端服务

2. **连接超时**

   ```
   Error: Request timeout
   ```

   **解决**: 检查后端负载，增加timeout配置

3. **内存不足**
   ```
   Error: Out of memory
   ```
   **解决**: 减少测试数据量

### 性能不达标

1. **上传慢**
   - 检查 embedding service GPU 使用率
   - 减少 batch size

2. **搜索慢**
   - 检查 SurrealDB 索引是否正确创建
   - 检查 HNSW 参数配置

3. **图遍历慢**
   - 减少遍历深度
   - 增加关系索引

## 报告分析

### 综合报告结构

```json
{
  "timestamp": "2026-03-11T...",
  "summary": {
    "totalDuration": 123456,
    "totalTests": 4,
    "passed": 4,
    "failed": 0
  },
  "testResults": [...],
  "detailedReports": {
    "performance-report": {...},
    "stress-test-report": {...},
    "graph-performance-report": {...}
  }
}
```

### 性能趋势分析

运行多次测试后，可以比较不同时间点的 `performance-report.json`:

```bash
# 保存历史报告
mv performance-report.json reports/perf-$(date +%Y%m%d-%H%M%S).json

# 对比
node compare-reports.mjs reports/perf-*.json
```

## 持续集成

### GitHub Actions 示例

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * *' # 每天凌晨2点

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Start Backend
        run: |
          cd ../embedding_service
          docker-compose up -d
          sleep 30

      - name: Run Tests
        run: node run-all-tests.mjs

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: comprehensive-test-report.json
```

## 自定义测试

### 自定义测试数据

```javascript
import { generateMemories } from './test-data-generator.mjs';

const myData = generateMemories(100, 'code').map(m => ({
  ...m,
  project_id: 'my-project',
  metadata: { custom: true },
}));
```

### 自定义性能测试

```javascript
import { WrapperClient } from './lib/wrapper-client.js';

const client = new WrapperClient({
  backend: { url: 'http://localhost:17999' },
});

// 自定义测试逻辑
async function myTest() {
  const start = Date.now();
  // ... 测试代码
  return Date.now() - start;
}
```

## 注意事项

1. **不要在生产环境运行压力测试**
2. **确保有足够的磁盘空间** (测试数据会占用空间)
3. **测试前清理数据** (使用新的 tenant_id)
4. **监控后端资源** (CPU、内存、GPU)
5. **预留足够时间** (完整测试需要15-30分钟)

## 联系支持

遇到问题？

- 查看后端服务日志
- 检查 `comprehensive-test-report.json`
- 提交 Issue 附上报告文件
