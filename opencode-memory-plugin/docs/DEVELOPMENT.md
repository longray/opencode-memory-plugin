# 开发指南

> **版本**: v3.0.0 → v3.2.0  
> **更新时间**: 2026-04-10  
> **状态**: 维护中

---

## 目录

1. [环境搭建](#1-环境搭建)
2. [开发工作流](#2-开发工作流)
3. [代码规范](#3-代码规范)
4. [测试策略](#4-测试策略)
5. [调试技巧](#5-调试技巧)
6. [Pre-commit 钩子](#6-pre-commit-钩子)
7. [常见问题](#7-常见问题)

---

## 1. 环境搭建

### 1.1 前置要求

| 工具     | 最低版本 | 说明                   |
| -------- | -------- | ---------------------- |
| Node.js  | 18+      | 插件运行时             |
| npm      | 9+       | 包管理器               |
| Git      | 2.40+    | 版本控制               |
| Gitleaks | v8.21.2  | 安全扫描（pre-commit） |

### 1.2 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin/opencode-memory-plugin

# 2. 安装依赖
npm install

# 3. 验证安装
npm test
```

### 1.3 本地开发链接

开发时使用全局链接，避免重复安装：

```bash
# 在项目根目录创建全局链接
npm link

# 验证链接
npm list -g @csuwl/opencode-memory-plugin
```

> **注意**：OpenCode 有模块缓存，修改源码后可能需要重启 OpenCode 才能加载新代码。使用 CLI 开发测试更高效。

### 1.4 后端服务（可选）

本地开发不强制要求后端服务，但以下功能需要后端支持：

- 向量搜索（hybrid/vector 模式）
- 图关系操作
- 同步功能

```bash
# 启动后端服务（如果需要）
docker-compose -f docker-compose.yml up -d

# 验证后端健康
curl http://localhost:18008/api/v1/health
```

### 1.5 环境变量

```bash
# 后端 API 密钥（使用后端功能时需要）
export WRAPPER_MEILI_API_KEY="your-api-key"

# 可选：日志级别
export LOG_LEVEL="debug"
```

---

## 2. 开发工作流

### 2.1 日常开发

```bash
# 1. 创建功能分支
git checkout -b feature/my-feature

# 2. 编写代码
# ...

# 3. 运行测试
npm test

# 4. 代码检查
npm run lint
npm run format:check

# 5. 提交（pre-commit 自动运行所有检查）
git add .
git commit -m "feat: 添加新功能描述"
```

### 2.2 开发模式

```bash
# 监视测试（开发时推荐）
npm run test:watch

# 代码检查自动修复
npm run lint:fix

# 代码格式化
npm run format
```

### 2.3 CLI 开发测试

CLI 工具是独立于 OpenCode 的测试入口：

```bash
# 基础 CLI 测试
node cli/index.cjs status
node cli/index.cjs search "test query"
node cli/index.cjs write "测试记忆" --type general

# 代码分析 CLI
node cli/code-analyzer.cjs lib/memory-core.js
node cli/code-analyzer.cjs --project .
```

### 2.4 提交规范

| 前缀        | 用途      | 示例                                    |
| ----------- | --------- | --------------------------------------- |
| `feat:`     | 新功能    | `feat: 添加自动补全建议功能`            |
| `fix:`      | 修复 Bug  | `fix: 修复 BM25 搜索空指针异常`         |
| `refactor:` | 重构      | `refactor: 简化 WrapperClient 重试逻辑` |
| `docs:`     | 文档      | `docs: 更新 API-CONTRACT.md`            |
| `chore:`    | 构建/配置 | `chore: 升级 oxlint 到 1.57.0`          |
| `test:`     | 测试      | `test: 添加 code-analyzer 边界用例`     |

---

## 3. 代码规范

### 3.1 工具链

本项目使用 **Oxlint + Prettier + Markdownlint-cli2** 三件套：

| 工具                                                                 | 版本   | 用途                                                 |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| [Oxlint](https://oxc.rs/)                                            | 1.57.0 | JavaScript 代码检查（Rust 实现，10-50x 快于 ESLint） |
| [Prettier](https://prettier.io/)                                     | 3.8.1  | 代码格式化                                           |
| [Markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) | 0.22.0 | Markdown 文档检查                                    |

### 3.2 配置文件

```bash
.oxlintrc.json           # Oxlint 规则配置
.prettierrc               # Prettier 格式配置
.markdownlint-cli2.jsonc  # Markdownlint 规则配置
.eslintignore             # 忽略文件列表（Oxlint 共用）
```

### 3.3 Oxlint 配置要点

```json
{
  "rules": {
    "no-unused-vars": "warn",
    "caughtErrorsIgnorePattern": "^_",
    "varsIgnorePattern": "^_",
    "argsIgnorePattern": "^_"
  }
}
```

**Oxlint 不支持的 ESLint 规则**（需要手动注意）：

- `no-shadow` — 避免变量遮蔽
- `prefer-arrow-callback` — 箭头函数回调
- `object-shorthand` — 对象属性简写
- `no-multiple-empty-lines` — 多空行限制
- `eol-last` — 文件末尾换行

### 3.4 代码风格约定

```javascript
// ✅ 正确 — ES Module 语法
import { writeMemory } from './memory-core.js';
export function processEntry(entry) {
  /* ... */
}

// ❌ 错误 — CommonJS 语法（仅 bin/ 和 cli/ 允许）
const { writeMemory } = require('./memory-core');

// ✅ 正确 — 下划线忽略未使用变量
try {
  await riskyOperation();
} catch (_error) {
  // 已知错误，静默处理
}

// ✅ 正确 — JSDoc 类型注解
/**
 * @param {WriteMemoryParams} params - 写入参数
 * @returns {Promise<WriteMemoryResult>} 写入结果
 */
export async function writeMemory(params) {
  /* ... */
}

// ✅ 正确 — 中文注释（项目使用简体中文）
// 计算条目的指纹，用于增量同步
const fingerprint = sha256(content);
```

### 3.5 npm scripts

```bash
# 代码检查
npm run lint          # Oxlint 检查
npm run lint:fix      # 自动修复

# 格式化
npm run format        # 格式化所有文件
npm run format:check  # 检查格式（CI 使用）

# Markdown
npm run lint:md       # 检查 Markdown
npm run lint:md:fix   # 自动修复 Markdown
```

---

## 4. 测试策略

### 4.1 测试框架

| 项目       | 配置                                                           |
| ---------- | -------------------------------------------------------------- |
| 框架       | Jest 29.x                                                      |
| 运行命令   | `node --experimental-vm-modules node_modules/jest/bin/jest.js` |
| 配置文件   | `jest.config.json`                                             |
| 测试目录   | `tests/`                                                       |
| 覆盖率阈值 | branches/functions/lines/statements: 10%                       |

### 4.2 测试文件

当前共 **19 个测试文件**，覆盖所有核心模块：

| 文件                            | 测试目标               |
| ------------------------------- | ---------------------- |
| `test-core.test.js`             | tools/core.js 工具函数 |
| `test-memory-core.test.js`      | 记忆读写核心逻辑       |
| `test-entry.test.js`            | 条目格式化和文件写入   |
| `test-extractor.test.js`        | 分层内容提取           |
| `test-storage.test.js`          | 配置和文件存储         |
| `test-indexer.test.js`          | 索引管理               |
| `test-bm25.test.js`             | BM25 搜索算法          |
| `test-trie.test.js`             | Trie 数据结构          |
| `test-trie-index.test.js`       | Trie 索引和自动补全    |
| `test-ws-client.test.js`        | WebSocket 客户端       |
| `test-code-analysis.test.js`    | 代码分析引擎           |
| `test-project-resolver.test.js` | 项目 ID 解析           |
| `test-sync-methods.test.js`     | 同步方法               |
| `test-topic-sync.test.js`       | 主题同步               |
| `test-upload-queue.test.js`     | 上传队列               |
| `test-ulid.test.js`             | ULID 生成器            |
| `test-phase-c-performance.js`   | Phase C 性能基准       |
| `phase-a.test.js`               | Phase A 集成测试       |
| `phase-a-integration.test.js`   | Phase A 完整集成       |

### 4.3 运行测试

```bash
# 运行所有测试
npm test

# 运行单个文件
npx jest tests/test-core.test.js

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# 运行匹配名称的测试
npx jest --testNamePattern="should write memory"
```

### 4.4 测试约定

```javascript
// ✅ 正确 — 测试文件命名
test - { module }.test.js;

// ✅ 正确 — 测试结构
describe('memory_write', () => {
  it('should write entry to timeline', async () => {
    const result = await writeMemory({
      abstract: '测试摘要',
      overview: '测试概览',
      content: '测试内容',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing abstract', async () => {
    const result = await writeMemory({ overview: 'x', content: 'y' });
    expect(result.success).toBe(false);
  });
});

// ✅ 正确 — Mock 外部依赖
jest.mock('./wrapper-client.js');
```

### 4.5 集成测试

集成测试需要后端服务运行：

```bash
# tests/integration/ 目录
# 运行前确保后端服务可用
curl http://localhost:18008/api/v1/health

# 集成测试使用 default tenant
# 项目 ID 使用 test-project
```

---

## 5. 调试技巧

### 5.1 CLI 调试

CLI 是最快的调试入口，无需重启 OpenCode：

```bash
# 检查配置
node cli/index.cjs status

# 测试写入
node cli/index.cjs write "调试测试" --type general --tags debug

# 测试搜索
node cli/index.cjs search "调试"

# 检查后端连接
node -e "
import { WrapperClient } from './lib/wrapper-client.js';
const c = new WrapperClient();
console.log(await c.healthCheck());
"
```

### 5.2 日志系统

插件使用 `memory.log` 记录运行日志：

```bash
# 查看日志（PowerShell）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-Content "$env:USERPROFILE\.opencode\memory\memory.log" -Tail 50
```

日志格式：

```
[2026-04-10T12:00:00.000Z] [INFO] [search] Search query: "test" mode: hybrid
[2026-04-10T12:00:00.100Z] [WARN] [sync] Backend unavailable, using local fallback
[2026-04-10T12:00:00.200Z] [ERROR] [ws-client] Connection failed: ECONNREFUSED
```

### 5.3 Node.js 调试

```bash
# 使用 --inspect 启动
node --inspect cli/index.cjs status

# 然后在 Chrome DevTools 中打开 chrome://inspect

# 或使用 VS Code 调试配置
# .vscode/launch.json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Test Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "${relativeFile}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 5.4 常见调试场景

**后端连接失败**：

```javascript
// 检查后端健康
const client = new WrapperClient();
const health = await client.healthCheck();
// status: 'healthy' | 'unavailable' | 'degraded'
```

**搜索不返回结果**：

```javascript
// 检查搜索模式
// 1. 确认后端可用 → 使用 hybrid 模式
// 2. 后端不可用 → 自动降级到 bm25
// 3. 检查索引是否已重建 → rebuild_index force=true
```

**文件未写入**：

```javascript
// 检查目录权限
// timeline/YYYY/MM/DD/ 目录是否存在
// ~/.opencode/memory/ 目录权限
```

---

## 6. Pre-commit 钩子

### 6.1 配置

项目使用 [pre-commit](https://pre-commit.com/) 框架，配置文件为 `.pre-commit-config.yaml`。

### 6.2 检查项

| 优先级 | 检查项           | 工具             | 耗时   | 说明            |
| ------ | ---------------- | ---------------- | ------ | --------------- |
| P0     | 🔐 安全扫描      | Gitleaks v8.21.2 | <5s    | 检测硬编码秘密  |
| P1     | 🔍 代码检查      | Oxlint           | <10s   | JavaScript 规范 |
| P2     | 💅 代码格式化    | Prettier         | <10s   | 自动格式化      |
| P3     | 📝 Markdown 检查 | Markdownlint     | <5s    | 文档规范        |
| P4     | 🧪 测试运行      | Jest             | 30-60s | 138 个用例      |

### 6.3 安装

```bash
# 安装 pre-commit 钩子
pre-commit install

# 手动运行所有检查
pre-commit run --all-files
```

### 6.4 跳过检查（不推荐）

```bash
# 跳过所有 pre-commit 检查
git commit --no-verify -m "紧急修复"

# 跳过特定检查
SKIP=gitleaks git commit -m "message"
```

### 6.5 排除规则

```yaml
# .pre-commit-config.yaml
exclude: '^node_modules/|^dist/|^build/|^\.git/|^\.opencode/'
```

---

## 7. 常见问题

### 7.1 安装问题

**`npm install` 失败**：

```bash
# 清除缓存重试
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**`npm link` 不生效**：

```bash
# OpenCode 使用模块缓存，需要重启
# 或使用 CLI 直接测试
node cli/index.cjs status
```

### 7.2 测试问题

**Jest ES Module 错误**：

```bash
# 必须使用 --experimental-vm-modules
node --experimental-vm-modules node_modules/jest/bin/jest.js
```

**测试超时**：

```javascript
// jest.config.json
{
  "testTimeout": 10000  // 默认 10 秒
}

// 单个测试覆盖
it('slow test', async () => {
  // ...
}, 30000);  // 30 秒超时
```

### 7.3 Windows 特定

**路径分隔符**：使用 `path.join()` 或 `path.resolve()`，不要硬编码 `/`。

**编码问题**：PowerShell 默认 GB2312，读取中文文件需要设置编码：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

**换行符**：`.editorconfig` 统一使用 LF：

```ini
[*]
end_of_line = lf
```

### 7.4 后端联调

**Tenant 配置**：测试必须使用 `default` tenant。

**端口冲突**：确认后端在 17999 端口运行：

```bash
# 检查端口占用
netstat -ano | findstr 17999
```

---

## 相关文档

| 文档                                                                       | 说明               |
| -------------------------------------------------------------------------- | ------------------ |
| [../ARCHITECTURE.md](./ARCHITECTURE.md)                                    | 系统架构文档       |
| [../../docs/API-CONTRACT.md](../../docs/API-CONTRACT.md)                   | 工具↔后端 API 映射 |
| [../../docs/v3.2/DEVELOPMENT-v3.2.md](../../docs/v3.2/DEVELOPMENT-v3.2.md) | v3.2 开发指南      |
