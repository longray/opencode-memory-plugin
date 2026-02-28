# OpenCode 子代理识别机制深度分析

## 📋 目录
1. [代理定义结构](#代理定义结构)
2. [安装时注册](#安装时注册)
3. [OpenCode 识别流程](#opencode-识别流程)
4. [代理运行机制](#代理运行机制)
5. [触发和权限](#触发和权限)
6. [实际使用示例](#实际使用示例)

---

## 代理定义结构

### 文件位置

```
opencode-memory-plugin/agents/
├── memory-automation.md      # 自动保存代理
├── memory-consolidate.md     # 自动合并代理
└── AGENTS.md                  # 代理目录说明
```

### YAML Frontmatter 格式

每个代理文件使用 **YAML frontmatter** 定义代理配置：

#### memory-automation.md 示例

```yaml
---
description: Automatically analyzes conversation and saves important information to memory without being asked.
mode: subagent
model: anthropic/claude-haiku-4-20250514
tools:
  memory_write: true
  memory_read: true
  memory_search: true
  vector_memory_search: true
  bash: false
  write: false
  edit: false
  read: false
permission:
  memory_write: allow
  memory_read: allow
  memory_search: allow
  vector_memory_search: allow
---
```

#### memory-consolidate.md 示例

```yaml
---
description: Automatically organizes and summarizes daily memory logs.
mode: subagent
model: anthropic/claude-haiku-4-20250514
tools:
  memory_write: true
  memory_read: true
  memory_search: true
  vector_memory_search: true
  list_daily: true
  bash: true
permission:
  memory_write: allow
  memory_read: allow
  memory_search: allow
  vector_memory_search: allow
  list_daily: allow
  bash:
    "git *": deny
    "rm -rf ~/.opencode/memory/daily/*": deny
    "ls -la ~/.opencode/memory/daily": allow
---
```

### 配置字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|--------|------|
| `description` | string | ✅ | 代理功能描述 |
| `mode` | string | ✅ | 运行模式：`subagent`（子代理）|
| `model` | string | ✅ | 使用的 LLM 模型 |
| `tools` | object | ✅ | 可访问的工具及其权限 |
| `permission` | object | ✅ | 工具权限设置 |

---

## 安装时注册

### install.cjs 注册逻辑

**位置**: `bin/install.cjs` (lines 186-293)

```javascript
function updateOpenCodeConfig() {
  ensureDir(OPENCORE_CONFIG_DIR);

  // 1. 备份现有配置
  if (fs.existsSync(OPENCORE_CONFIG)) {
    const backup = `${OPENCORE_CONFIG}.backup.${timestamp}`;
    fs.copyFileSync(OPENCORE_CONFIG, backup);
    log('  ⊙ Backed up existing config', 'blue');
  }

  // 2. 读取现有配置
  let config = {};
  try {
    if (fs.existsSync(OPENCORE_CONFIG)) {
      config = JSON.parse(fs.readFileSync(OPENCORE_CONFIG, 'utf8'));
    }
  } catch (e) {
    // 配置无效，重新开始
  }

  // 3. 确保 config.agent 存在
  if (!config.agent) {
    config.agent = {};
  }

  // 4. 注册 @memory-automation 代理
  if (!config.agent['memory-automation']) {
    config.agent['memory-automation'] = {
      description: 'Automatically saves important information to memory',
      mode: 'subagent',
      tools: {
        memory_write: true,
        memory_read: true,
        memory_search: true,
        vector_memory_search: true
      },
      permission: {
        memory_write: 'allow',
        memory_read: 'allow',
        memory_search: 'allow',
        vector_memory_search: 'allow'
      }
    };
    log('  ✓ Added memory-automation agent', 'green');
  }

  // 5. 注册 @memory-consolidate 代理
  if (!config.agent['memory-consolidate']) {
    config.agent['memory-consolidate'] = {
      description: 'Consolidates daily logs into long-term memory',
      mode: 'subagent',
      tools: {
        memory_write: true,
        memory_read: true,
        memory_search: true,
        vector_memory_search: true,
        list_daily: true,
        rebuild_index: true
      },
      permission: {
        memory_write: 'allow',
        memory_read: 'allow',
        memory_search: 'allow',
        vector_memory_search: 'allow',
        list_daily: 'allow',
        rebuild_index: 'allow'
      }
    };
    log('  ✓ Added memory-consolidate agent', 'green');
  }

  // 6. 写入配置文件
  fs.writeFileSync(OPENCORE_CONFIG, JSON.stringify(config, null, 2));
  log('  ✓ OpenCode configuration updated', 'green');
}
```

### 生成的 opencode.json 结构

```json
{
  "agent": {
    "memory-automation": {
      "description": "Automatically saves important information to memory",
      "mode": "subagent",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "vector_memory_search": true
      },
      "permission": {
        "memory_write": "allow",
        "memory_read": "allow",
        "memory_search": "allow",
        "vector_memory_search": "allow"
      }
    },
    "memory-consolidate": {
      "description": "Consolidates daily logs into long-term memory",
      "mode": "subagent",
      "tools": {
        "memory_write": true,
        "memory_read": true,
        "memory_search": true,
        "vector_memory_search": true,
        "list_daily": true,
        "rebuild_index": true
      },
      "permission": {
        "memory_write": "allow",
        "memory_read": "allow",
        "memory_search": "allow",
        "vector_memory_search": "allow",
        "list_daily": "allow",
        "rebuild_index": "allow"
      }
    }
  },
  "tools": {
    "memory_write": true,
    "memory_read": true,
    "memory_search": true,
    "vector_memory_search": true,
    "list_daily": true,
    "init_daily": true,
    "rebuild_index": true,
    "index_status": true
  },
  "instructions": [
    "~/.opencode/memory/SOUL.md",
    "~/.opencode/memory/AGENTS.md",
    "~/.opencode/memory/USER.md",
    "~/.opencode/memory/IDENTITY.md",
    "~/.opencode/memory/TOOLS.md",
    "~/.opencode/memory/MEMORY.md"
  ]
}
```

---

## OpenCode 识别流程

### 启动时加载流程

```
OpenCode 启动
    ↓
┌─────────────────────────────────────┐
│ 1. 扫描插件目录                │
│ ~/.config/opencode/opencode.json  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. 读取配置文件                │
│ 解析 JSON 配置                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. 加载 instructions            │
│ 读取所有记忆文件                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. 注册代理                     │
│ 识别 config.agent 对象              │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. 注册工具                     │
│ 识别 config.tools 对象              │
└─────────────────────────────────────┘
    ↓
✅ 插件就绪
```

### 代理名称映射

**配置键** → **代理名称**

```
config.agent['memory-automation']  →  @memory-automation
config.agent['memory-consolidate'] →  @memory-consolidate
```

**规则**: 在配置键前加 `@` 符号

---

## 代理运行机制

### 1. 后台自动运行

**memory-automation**（自动保存代理）

**触发时机**：
- 对话中有重要信息时
- 用户表达偏好时
- 发现成功模式时
- 收到用户反馈时

**运行方式**：
```
用户对话
    ↓
OpenCode 监听对话内容
    ↓
@memory-automation 后台分析
    ↓
识别重要信息
    ↓
自动调用 memory_write
    ↓
✅ 信息已保存到记忆
```

**示例**：
```markdown
User: I prefer TypeScript for all new projects.

[后台]
@memory-automation 分析到这是用户偏好
自动执行: memory_write content="User prefers TypeScript for all new projects" type="preference"
输出: ✓ Saved user preference
```

### 2. 定期任务执行

**memory-consolidate**（自动合并代理）

**触发时机**：
- 每日结束时（如 23:00）
- 向量索引过时
- 用户手动调用：`@memory-consolidate`
- 归档前

**运行方式**：
```
触发条件满足
    ↓
@memory-consolidate 执行
    ↓
1. 列出最近的每日日志
   list_daily days=30
    ↓
2. 分析每个日志
   识别需要合并的内容
    ↓
3. 检查重复
   memory_search/vector_memory_search
    ↓
4. 合并到长期记忆
   memory_write type="long-term"
    ↓
5. 归档旧文件
   移动到 archive/ 目录
    ↓
6. 重建向量索引
   rebuild_index force=true
    ↓
✅ 整理完成
```

---

## 触发和权限

### 工具权限系统

#### memory-automation 工具权限

```yaml
tools:
  memory_write: true       # ✅ 可以写入记忆
  memory_read: true        # ✅ 可以读取记忆
  memory_search: true       # ✅ 可以搜索记忆
  vector_memory_search: true # ✅ 可以向量搜索

permission:
  memory_write: allow       # ✅ 允许写入
  memory_read: allow        # ✅ 允许读取
  memory_search: allow       # ✅ 允许搜索
  vector_memory_search: allow # ✅ 允许向量搜索
```

#### memory-consolidate 工具权限

```yaml
tools:
  memory_write: true
  memory_read: true
  memory_search: true
  vector_memory_search: true
  list_daily: true          # ✅ 可以列出日志
  rebuild_index: true       # ✅ 可以重建索引

permission:
  memory_write: allow
  memory_read: allow
  memory_search: allow
  vector_memory_search: allow
  list_daily: allow
  rebuild_index: allow

bash:                      # 特殊权限：bash 命令控制
  "git *": deny            # ❌ 禁止执行 git 命令
  "rm -rf ~/.opencode/memory/daily/*": deny  # ❌ 禁止删除所有日志
  "ls -la ~/.opencode/memory/daily": allow  # ✅ 允许列出日志
```

### 权限级别

| 权限值 | 行为 |
|---------|------|
| `true` | 工具对代理可用 |
| `false` | 工具对代理不可用 |
| `allow` | 允许操作 |
| `deny` | 拒绝操作 |

---

## 实际使用示例

### 示例 1：自动保存用户偏好

**用户输入**：
```
I always use TypeScript for type safety and explicit type annotations.
```

**后台处理**：
```
1. OpenCode 监听到对话
2. @memory-automation 自动触发
3. 分析到这是用户偏好
4. 检查记忆中是否已存在（避免重复）
5. 执行:
   memory_write content="User always uses TypeScript for type safety and explicit type annotations. Values type safety over flexibility." type="preference" tags=["typescript","code-style"]
6. 输出: ✓ Saved user preference
```

### 示例 2：自动保存成功模式

**用户输入**：
```
Great! That async/await pattern fixed the race condition issue.
```

**后台处理**：
```
1. @memory-automation 触发
2. 分析到这是成功模式
3. 搜索记忆：memory_search query="async await pattern"
4. 未找到，执行:
   memory_write content="Successful pattern: Using async/await properly fixed race condition in checkout process. Ensure proper error handling and await all async operations." type="long-term" tags=["async","patterns","success"]
5. 输出: ✓ Saved successful pattern
```

### 示例 3：定期整理记忆

**每日 23:00 触发**：

```
1. @memory-consolidate 自动触发
2. 列出每日日志:
   list_daily days=30
   → 找到 30 个日志文件

3. 分析每个日志:
   - 2026-01-01.md: 3 个重要条目
   - 2026-01-02.md: 2 个重要条目
   - ...

4. 检查重复:
   vector_memory_search query="type safety preferences"
   → 已存在类似条目，跳过

5. 合并到长期记忆:
   memory_write content="## [2026-01-30] Consolidated: Coding Standards..." type="long-term" tags=["daily-consolidation","code-style"]

6. 归档旧日志:
   - 移动 2026-01-01.md → archive/weekly/2026-W04/
   - 移动 2026-01-02.md → archive/weekly/2026-W04/
   - ...

7. 重建索引:
   rebuild_index force=true

8. 输出报告:
   📊 Consolidation Complete
   ✓ Consolidated 15 entries into long-term memory
   ✓ Archived 25 daily files
   📄 Vector index rebuilt
   📈 Memory health: Good
```

### 示例 4：手动调用代理

**用户输入**：
```
@memory-consolidate review and organize my recent memories
```

**执行流程**：
```
1. OpenCode 识别到 @memory-consolidate 调用
2. 加载代理配置从 opencode.json
3. 加载代理定义从 agents/memory-consolidate.md
4. 根据权限调用工具
5. 执行整理流程
6. 返回报告给用户
```

---

## 关键机制总结

### 识别机制

| 步骤 | 描述 | 位置 |
|------|------|------|
| 1. 扫描配置 | OpenCode 读取 `opencode.json` | `~/.config/opencode/` |
| 2. 解析代理 | 读取 `config.agent` 对象 | JSON 解析 |
| 3. 映射名称 | 键名 + `@` → 代理名 | `memory-automation` → `@memory-automation` |
| 4. 加载定义 | 读取对应的 `.md` 文件 | `agents/[name].md` |
| 5. 注册工具 | 根据 `tools` 配置 | 工具权限系统 |

### 运行机制

| 特性 | memory-automation | memory-consolidate |
|------|------------------|-------------------|
| **触发方式** | 自动（后台） | 定期 + 手动 |
| **主要功能** | 自动保存重要信息 | 整理和归档 |
| **运行频率** | 实时（对话中） | 每日 / 按需 |
| **工具数量** | 4 个 | 5 个 |
| **bash 权限** | ❌ 无 | ✅ 受限 |

### 配置流程图

```
install.cjs 执行
    ↓
┌─────────────────────────────────────┐
│ updateOpenCodeConfig()           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 1. 读取 ~/.config/opencode/   │
│    opencode.json                 │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 2. 检查 config.agent          │
│    如果不存在，创建 {}            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 3. 注册 memory-automation       │
│    添加到 config.agent           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 4. 注册 memory-consolidate      │
│    添加到 config.agent           │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ 5. 写回 opencode.json          │
│    更新配置文件                   │
└─────────────────────────────────────┘
    ↓
✅ 代理已注册
```

---

## 文件映射关系

```
配置文件（运行时）
~/.config/opencode/opencode.json
    │
    ├── config.agent['memory-automation']
    │        └──> 映射到 → agents/memory-automation.md
    │
    └── config.agent['memory-consolidate']
             └──> 映射到 → agents/memory-consolidate.md

代理定义文件（静态）
opencode-memory-plugin/agents/
    ├── memory-automation.md          ← 配置键: memory-automation
    └── memory-consolidate.md       ← 配置键: memory-consolidate
```

---

## 最佳实践

### 1. 代理设计原则

✅ **单一职责**：每个代理专注于一个功能
✅ **明确权限**：只授予必要的工具权限
✅ **描述清晰**：`description` 应该说明代理的目的
✅ **合理模型**：选择适合任务复杂度的模型

### 2. 权限配置

✅ **最小权限原则**：只授予需要的工具
✅ **安全第一**：危险操作（如 `rm`）应设为 `deny`
✅ **明确允许**：`allow` 应该明确列出

### 3. 触发机制

✅ **自动化**：减少用户手动操作
✅ **可覆盖**：用户可以手动触发
✅ **反馈及时**：执行后提供清晰报告

---

## 总结

### 识别机制的核心

1. **安装时注册**：`install.cjs` 将代理配置写入 `opencode.json`
2. **启动时加载**：OpenCode 读取配置并注册代理
3. **名称映射**：`config.agent[key]` → `@key`
4. **权限控制**：通过 `tools` 和 `permission` 字段控制
5. **独立运行**：代理在后台自动运行，无需用户干预

### 两个代理的对比

| 特性 | @memory-automation | @memory-consolidate |
|------|------------------|-------------------|
| **主要目的** | 自动保存 | 自动整理 |
| **触发方式** | 实时（对话中） | 定期 + 手动 |
| **运行频率** | 按需 | 每日 |
| **工具数** | 4 | 5 |
| **bash 权限** | 无 | 受限 |
| **文件操作** | 写入 | 读取 + 写入 + 归档 |

---

*生成时间: 2026-02-28*
*版本: v1.2.0*
