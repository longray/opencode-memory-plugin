# 测试框架配置指南

**版本**: v2.0
**更新时间**: 2026-02-28

---

## 📋 配置选项

### 1. Embedding模式

#### Mock模式（快速测试）
```bash
# 使用模拟向量（哈希方法）
TEST_MODE=mock node run-60day-simulation.mjs
```

**特点**:
- ✅ 速度快（无网络请求）
- ✅ 无需API Key
- ✅ 适合快速迭代
- ❌ 不是真正的语义搜索
- ❌ 无法测试API集成

**适用场景**:
- 快速功能验证
- 单元测试
- CI/CD快速测试

#### Real模式（真实测试）
```bash
# 使用真实API（ModelScope）
export MODELSCOPE_API_KEY='your-api-key-here'
node run-60day-simulation.mjs
```

**特点**:
- ✅ 真实的语义搜索
- ✅ 真实的API调用
- ✅ 可以测试API集成
- ✅ 可以测试性能
- ⚠️ 需要网络连接
- ⚠️ 需要 API Key
- ⚠️ 速度较慢

**适用场景**:
- 集成测试
- 性能测试
- 生产环境验证

### 2. 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TEST_MODE` | 测试模式（mock/real） | real |
| `MODELSCOPE_API_KEY` | ModelScope API密钥 | 无 |
| `EMBEDDING_ENDPOINT` | 嵌入服务端点 | https://api-inference.modelscope.cn/v1/embeddings |
| `EMBEDDING_MODEL` | 嵌入模型 | Qwen/Qwen3-Embedding-0.6B |
| `EMBEDDING_DIMENSIONS` | 向量维度 | 1024 |

### 3. 使用示例

#### 快速测试（Mock模式）
```bash
cd test-framework

# 方式1: 环境变量
TEST_MODE=mock node run-60day-simulation.mjs

# 方式2: .env文件
echo "TEST_MODE=mock" > .env
node run-60day-simulation.mjs

# 方式3: 修改代码
# 在 run-60day-simulation.mjs 中修改：
# const tools = new MockOpenCodeTools({
#   embeddingMode: 'mock',
# });
```

#### 真实测试（Real模式）
```bash
cd test-framework

# 方式1: 环境变量
export MODELSCOPE_API_KEY='your-api-key-here'
node run-60day-simulation.mjs

# 方式2: .env文件
echo "MODELSCOPE_API_KEY=your-api-key-here" > .env
node run-60day-simulation.mjs

# 方式3: 命令行参数
node run-60day-simulation.mjs --api-key your-api-key-here
```

#### 自定义配置
```bash
cd test-framework

# 自定义端点
EMBEDDING_ENDPOINT='http://localhost:18000/embeddings' \
MODELSCOPE_API_KEY='your-key' \
node run-60day-simulation.mjs

# 自定义模型
EMBEDDING_MODEL='your-custom-model' \
MODELSCOPE_API_KEY='your-key' \
node run-60day-simulation.mjs
```

---

## 🔧 高级配置

### 1. 创建配置文件

#### config.json
```json
{
  "embedding": {
    "mode": "real",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "dimensions": 1024,
    "timeout": 30000,
    "retryAttempts": 3,
    "cacheEnabled": true
  },
  "search": {
    "bm25": {
      "k1": 1.5,
      "b": 0.75
    },
    "vector": {
      "similarityThreshold": 0.1,
      "topK": 10
    },
    "hybrid": {
      "vectorWeight": 0.7,
      "bm25Weight": 0.3
    }
  }
}
```

#### .env
```bash
# Embedding配置
TEST_MODE=real
MODELSCOPE_API_KEY=your-api-key-here
EMBEDDING_ENDPOINT=https://api-inference.modelscope.cn/v1/embeddings
EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B

# 搜索配置
SIMILARITY_THRESHOLD=0.1
TOP_K=10

# 缓存配置
EMBEDDING_CACHE_ENABLED=true
EMBEDDING_CACHE_TTL=3600000
```

### 2. 加载配置

```javascript
import MockOpenCodeTools from './mock-opencode-tools-v2.mjs';
import fs from 'fs/promises';
import path from 'path';

async function loadConfig() {
  // 1. 加载 config.json
  try {
    const configPath = path.join(process.cwd(), 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return config;
  } catch (error) {
    console.warn('No config.json found, using defaults');
    return {};
  }
}

async function createTools() {
  const config = await loadConfig();

  const tools = new MockOpenCodeTools({
    embeddingMode: process.env.TEST_MODE || config.embedding?.mode || 'real',
    apiEndpoint: process.env.EMBEDDING_ENDPOINT || config.embedding?.endpoint,
    apiKey: process.env.MODELSCOPE_API_KEY || config.embedding?.apiKey,
    model: process.env.EMBEDDING_MODEL || config.embedding?.model,
  });

  return tools;
}
```

---

## 📊 性能对比

### Mock模式性能
| 操作 | 平均耗时 | 说明 |
|------|---------|------|
| 向量生成 | ~0ms | 哈希计算 |
| 向量搜索 | ~1ms | 余弦相似度（100维）|
| 完整测试 | ~10s | 无网络延迟 |

### Real模式性能
| 操作 | 平均耗时 | 说明 |
|------|---------|------|
| 向量生成 | ~50-100ms | API调用 |
| 向量搜索 | ~2ms | 余弦相似度（1024维）|
| 完整测试 | ~30-60s | 包含网络延迟 |

### 性能对比
| 模式 | 速度 | 真实性 | 适用场景 |
|------|------|--------|----------|
| Mock | ⚡⚡⚡ | ❌ | 快速测试 |
| Real | ⚡ | ✅ | 生产测试 |
| Cache | ⚡⚡ | ✅ | 混合测试 |

---

## ✅ 推荐配置

### 开发环境
```bash
# 使用mock模式快速迭代
TEST_MODE=mock
```

### 测试环境
```bash
# 使用real模式验证集成
TEST_MODE=real
MODELSCOPE_API_KEY=test-key
```

### 生产环境
```bash
# 使用real模式 + 缓存
TEST_MODE=real
MODELSCOPE_API_KEY=production-key
EMBEDDING_CACHE_ENABLED=true
```

---

## 🚨 故障排除

### 问题1: API调用失败
**错误信息**:
```
Error: API error: 401 Unauthorized
```

**解决方案**:
1. 检查 `MODELSCOPE_API_KEY` 是否正确
2. 确认API Key是否有效
3. 检查端点URL是否正确

### 问题2: 网络超时
**错误信息**:
```
Error: fetch failed
```

**解决方案**:
1. 检查网络连接
2. 增加超时时间
3. 考虑使用本地服务

### 问题3: 缓存问题
**错误信息**:
```
Warning: Embedding cache size too large
```

**解决方案**:
1. 清空缓存
2. 调整缓存大小
3. 使用LRU缓存策略

---

## 📝 最佳实践

### 1. 测试策略
- **开发阶段**: 使用mock模式快速迭代
- **测试阶段**: 使用real模式验证集成
- **性能测试**: 使用real模式 + 缓存
- **回归测试**: 使用mock模式快速验证

### 2. 缓存策略
- 启用缓存提高性能
- 设置合理的TTL（1小时）
- 定期清理过期缓存

### 3. 错误处理
- API失败时降级到mock
- 记录详细的错误日志
- 提供重试机制

### 4. 监控和日志
- 记录所有API调用
- 监控缓存命中率
- 统计API延迟

---

**文档版本**: v2.0
**最后更新**: 2026-02-28
