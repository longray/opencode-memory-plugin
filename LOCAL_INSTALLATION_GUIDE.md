# 本地安装 OpenCode Memory Plugin 开发环境

## 📋 目录

1. [克隆仓库](#克隆仓库)
2. [安装依赖](#安装依赖)
3. [本地开发模式安装](#本地开发模式安装)
4. [验证安装](#验证安装)
5. [开发流程](#开发流程)
6. [测试方法](#测试方法)
7. [常见问题](#常见问题)

---

## 克隆仓库

### 方法 1：SSH（推荐，如果你有 SSH 密钥）

```bash
git clone git@github.com:csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin
```

### 方法 2：HTTPS

```bash
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin
```

### 方法 3：Fork 后克隆

```bash
# 1. 在 GitHub 上 Fork 仓库
# 2. 克隆你自己的 Fork
git clone https://github.com/YOUR_USERNAME/opencode-memory-plugin.git
cd opencode-memory-plugin
# 3. 添加上游仓库（可选）
git remote add upstream https://github.com/csuwl/opencode-memory-plugin.git
```

---

## 安装依赖

### 进入插件目录

**重要**：实际代码在 `opencode-memory-plugin/` 子目录中：

```bash
cd opencode-memory-plugin/opencode-memory-plugin
```

### 安装生产依赖

```bash
npm install
```

### 安装开发依赖（如果需要）

```bash
npm install --save-dev @types/node typescript
```

### 验证安装

```bash
# 查看已安装的包
npm list

# 查看依赖树
npm ls
```

---

## 本地开发模式安装

### 方法 1：使用 npm link（推荐）

**步骤 1：链接插件到全局**

```bash
cd opencode-memory-plugin/opencode-memory-plugin
npm link
```

**步骤 2：验证链接**

```bash
# 查看全局链接的包
npm list -g --depth=0 | grep opencode-memory

# 应该看到类似输出：
# @csuwl/opencode-memory-plugin -> /path/to/opencode-memory-plugin/opencode-memory-plugin
```

**步骤 3：运行安装脚本**

```bash
# npm link 不会自动运行 postinstall 脚本，需要手动运行
npm run install
# 或
node bin/install.cjs
```

### 方法 2：使用 pnpm link（如果你使用 pnpm）

```bash
cd opencode-memory-plugin/opencode-memory-plugin
pnpm link --global
```

### 方法 3：使用 yarn link（如果你使用 yarn）

```bash
cd opencode-memory-plugin/opencode-memory-plugin
yarn link
```

### 方法 4：直接使用 npm 全局安装（简单测试）

```bash
cd opencode-memory-plugin/opencode-memory-plugin
npm install -g .
```

**注意**：这种方式每次修改代码后需要重新安装。

---

## 验证安装

### 1. 检查目录结构

```bash
ls -la ~/.opencode/memory/
```

**预期输出**：

```
drwxr-xr-x  SOUL.md
drwxr-xr-x  AGENTS.md
drwxr-xr-x  USER.md
drwxr-xr-x  IDENTITY.md
drwxr-xr-x  TOOLS.md
drwxr-xr-x  MEMORY.md
drwxr-xr-x  HEARTBEAT.md
drwxr-xr-x  BOOT.md
drwxr-xr-x  BOOTSTRAP.md
drwxr-xr-x  daily/
drwxr-xr-x  archive/
drwxr-xr-x  memory-config.json
```

### 2. 检查配置文件

```bash
cat ~/.opencode/memory/memory-config.json
```

**预期输出**：

```json
{
  "version": "2.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  }
}
```

### 3. 检查 OpenCode 配置

```bash
cat ~/.config/opencode/opencode.json | grep -A 20 "agent"
```

**预期输出**：

```json
"agent": {
  "memory-automation": {
    "description": "Automatically saves important information to memory",
    "mode": "subagent",
    "tools": {
      "memory_write": true,
      "memory_read": true,
      "memory_search": true,
      "memory_search": true
    },
    "permission": {
      "memory_write": "allow",
      "memory_read": "allow",
      "memory_search": "allow",
      "memory_search": "allow"
    }
  },
  "memory-consolidate": {
    ...
  }
}
```

### 4. 测试 CLI 工具

```bash
# 测试 opencode-memory 命令
opencode-memory --help

# 应该看到帮助信息
```

---

## 开发流程

### 1. 修改代码

编辑 `opencode-memory-plugin/opencode-memory-plugin/` 目录中的文件：

```
opencode-memory-plugin/opencode-memory-plugin/
├── lib/                    # 核心库代码
│   ├── vector-store.js     # 向量存储
│   ├── bm25.js            # BM25 搜索
│   └── service-validator.js
├── bin/                    # 安装和 CLI 脚本
│   ├── install.cjs         # 安装脚本
│   └── cli.cjs            # CLI 工具
├── agents/                 # 代理定义
│   ├── memory-automation.md
│   └── memory-consolidate.md
├── memory/                 # 记忆文件模板
├── plugin.js              # 插件入口
└── package.json           # 包配置
```

### 2. 重新链接（如果使用 npm link）

```bash
cd opencode-memory-plugin/opencode-memory-plugin
npm link
```

**注意**：`npm link` 会自动更新全局链接，无需重新安装。

### 3. 重新运行安装脚本（如果修改了 install.cjs）

```bash
cd opencode-memory-plugin/opencode-memory-plugin
npm run install
# 或
node bin/install.cjs
```

### 4. 测试更改

启动 OpenCode 并测试：

```bash
opencode
```

在 OpenCode 中使用记忆工具：

```
# 写入测试
memory_write content="Local development test" type="test"

# 搜索测试
memory_search query="test"

# 向量搜索测试
memory_search query="local development"
```

---

## 测试方法

### 1. 单元测试

创建测试文件：

```bash
cd opencode-memory-plugin/opencode-memory-plugin
mkdir tests
```

**示例测试文件**：`tests/vector-store.test.js`

```javascript
import { describe, it, expect } from "@jest/globals";
import { getVectorStore } from "../lib/vector-store.js";

describe("VectorStore", () => {
  it("should initialize successfully", async () => {
    const vectorStore = getVectorStore();
    const result = await vectorStore.initialize({
      dbPath: ":memory:",
      useExternalService: false,
    });

    expect(result.success).toBe(true);
  });

  it("should generate embeddings", async () => {
    const vectorStore = getVectorStore();
    await vectorStore.initialize({ useExternalService: false });

    const embeddings = await vectorStore.generateEmbeddings(["test"]);
    expect(embeddings).toBeDefined();
    expect(embeddings.length).toBe(1);
  });
});
```

运行测试：

```bash
npm test
```

### 2. 集成测试

创建集成测试文件：`tests/integration.test.js`

```javascript
import { describe, it, expect } from "@jest/globals";
import { MemoryPlugin } from "../plugin.js";

describe("MemoryPlugin Integration", () => {
  it("should register all tools", async () => {
    const plugin = await MemoryPlugin({});
    expect(plugin.tools).toBeDefined();
    expect(plugin.tools.memory_write).toBeDefined();
    expect(plugin.tools.memory_search).toBeDefined();
    expect(plugin.tools.memory_search).toBeDefined();
  });
});
```

### 3. 手动测试

使用 OpenCode 手动测试所有功能：

```javascript
// 测试 1：写入记忆
memory_write content="Test entry" type="test" tags=["manual","test"]

// 测试 2：读取记忆
memory_read file="MEMORY.md"

// 测试 3：搜索记忆
memory_search query="test"

// 测试 4：向量搜索
memory_search query="test entry"

// 测试 5：列出日志
list_daily days=7

// 测试 6：初始化日志
init_daily

// 测试 7：重建索引
rebuild_index force=true

// 测试 8：检查状态
index_status
```

---

## 常见问题

### 问题 1：npm link 后找不到插件

**症状**：

```
Error: Cannot find module '@csuwl/opencode-memory-plugin'
```

**解决方案**：

```bash
# 1. 取消链接
npm unlink -g @csuwl/opencode-memory-plugin

# 2. 重新链接
cd opencode-memory-plugin/opencode-memory-plugin
npm link

# 3. 验证链接
npm list -g --depth=0 | grep opencode-memory
```

### 问题 2：修改代码后不生效

**症状**：修改代码后，OpenCode 中看不到更改

**解决方案**：

```bash
# 方法 1：重新链接（推荐）
npm link

# 方法 2：重启 OpenCode
# 完全退出 OpenCode，然后重新启动

# 方法 3：检查是否链接到了正确的目录
npm list -g --depth=0 | grep opencode-memory
# 确保路径指向你的开发目录
```

### 问题 3：安装脚本运行失败

**症状**：

```
Error: Cannot find module 'fs'
```

**解决方案**：

```bash
# 确保在正确的目录
cd opencode-memory-plugin/opencode-memory-plugin

# 直接运行安装脚本
node bin/install.cjs
```

### 问题 4：权限错误

**症状**：

```
Error: EACCES: permission denied
```

**解决方案**：

```bash
# Linux/Mac
sudo npm link

# 或使用 sudo 运行安装脚本
sudo node bin/install.cjs
```

**Windows**：

```powershell
# 以管理员身份运行 PowerShell
# 右键点击 PowerShell → "以管理员身份运行"
npm link
```

### 问题 5：模块导入错误

**症状**：

```
Error: Unexpected token 'export'
```

**解决方案**：

```bash
# 确保使用 Node.js v16+
node --version

# 如果版本过低，升级 Node.js
# https://nodejs.org/
```

### 问题 6：OpenCode 不识别插件

**症状**：OpenCode 启动后看不到记忆工具

**解决方案**：

```bash
# 1. 检查配置文件
cat ~/.config/opencode/opencode.json

# 2. 确认代理已注册
grep -A 5 "agent" ~/.config/opencode/opencode.json

# 3. 确认工具已启用
grep -A 10 "tools" ~/.config/opencode/opencode.json

# 4. 重启 OpenCode
```

---

## 完整安装流程示例

### Linux/Mac

```bash
# 1. 克隆仓库
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin

# 2. 安装依赖
cd opencode-memory-plugin
npm install

# 3. 链接到全局
npm link

# 4. 运行安装脚本
npm run install

# 5. 验证安装
npm list -g --depth=0 | grep opencode-memory
ls -la ~/.opencode/memory/

# 6. 启动 OpenCode 测试
opencode
```

### Windows

```powershell
# 1. 克隆仓库
git clone https://github.com/csuwl/opencode-memory-plugin.git
cd opencode-memory-plugin

# 2. 安装依赖
cd opencode-memory-plugin
npm install

# 3. 链接到全局
npm link

# 4. 运行安装脚本
npm run install

# 5. 验证安装
npm list -g --depth=0 | findstr opencode-memory
dir %USERPROFILE%\.opencode\memory\

# 6. 启动 OpenCode 测试
opencode
```

---

## 开发最佳实践

### 1. 使用 Git 分支

```bash
# 创建开发分支
git checkout -b feature/new-feature

# 进行修改
# ...

# 提交更改
git add .
git commit -m "feat: add new feature"

# 推送到远程
git push origin feature/new-feature

# 创建 Pull Request
```

### 2. 运行测试前提交

```bash
# 运行所有测试
npm test

# 运行 lint（如果配置了）
npm run lint

# 运行类型检查（如果使用 TypeScript）
npm run type-check
```

### 3. 更新文档

```bash
# 修改代码后，同步更新文档
# - README.md
# - CONFIGURATION.md
# - QUICK_START.md
```

### 4. 版本控制

```bash
# 修改 package.json 中的版本号
# "version": "1.2.0" → "1.2.1"

# 创建 Git 标签
git tag v1.2.1
git push origin v1.2.1
```

---

## 提交更改到上游（可选）

如果你 Fork 了仓库，想要贡献更改：

```bash
# 1. 添加上游仓库
git remote add upstream https://github.com/csuwl/opencode-memory-plugin.git

# 2. 获取最新更改
git fetch upstream

# 3. 合并上游更改
git checkout main
git merge upstream/main

# 4. 推送到你的 Fork
git push origin main
```

---

## 清理和卸载

### 取消链接

```bash
npm unlink -g @csuwl/opencode-memory-plugin
```

### 完全卸载

```bash
npm uninstall -g @csuwl/opencode-memory-plugin

# 删除记忆数据（可选）
rm -rf ~/.opencode
```

---

## 总结

### 推荐的开发流程

```
1. git clone → 克隆仓库
2. cd opencode-memory-plugin/opencode-memory-plugin → 进入目录
3. npm install → 安装依赖
4. npm link → 链接到全局（推荐）
5. npm run install → 运行安装脚本
6. 修改代码 → 开发
7. npm link → 重新链接（如需）
8. opencode → 启动 OpenCode 测试
9. npm test → 运行测试
10. git commit → 提交更改
```

### 关键命令速查

| 命令              | 用途               |
| ----------------- | ------------------ |
| `npm install`     | 安装依赖           |
| `npm link`        | 链接到全局（开发） |
| `npm unlink -g`   | 取消链接           |
| `npm run install` | 运行安装脚本       |
| `npm test`        | 运行测试           |
| `opencode`        | 启动 OpenCode      |

---

_生成时间: 2026-02-28_
_版本: v1.2.0_
