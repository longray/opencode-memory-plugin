# Session Handoff - Code Analysis & Backlog API Design

**文件名**: `handoff-20260403-code-analysis-backlog-design.md`  
**日期**: 2026-04-03  
**任务焦点**: 为 Agent 设计 Backlog-as-a-Service API，替代手动维护 Markdown 文件  
**当前状态**: 方案设计已完成，包含代码分析器架构理解、A2A/ACP/MCP 协议对比、API 架构设计

---

## 快速上下文

### 问题定义

当前 `BACKLOG.md` 有 **527 行、39 个 backlog 项**，Agent 操作是**字符串解析地狱**：

- 创建项：手动分配 BL-XX 编号、填充 5 要素表格
- 更新状态：正则匹配替换表格内容
- 查询：全文搜索，无结构化过滤
- 关系：无依赖图谱，纯文本描述

### 已完成的设计工作

1. **架构设计**：复用现有 Wrapper Service (`localhost:17999`)，新增 `/backlog` 命名空间
2. **API 设计**：REST API + SQLite 本地存储 + Meilisearch 搜索
3. **协议对比**：排除 A2A/ACP/MCP（过度设计）、排除 WebSocket（轮询足够）
4. **数据模型**：支持 5 要素（目标/范围/依赖/标准/验证）+ 关系图谱

### 关键发现：代码分析器架构

通过读取实际代码文件，理解现有代码分析实现：

**文件位置**：

- `opencode-memory-plugin/lib/code-analyzer.js` - 核心分析器
- `opencode-memory-plugin/lib/code-analysis-service.js` - 服务层
- `opencode-memory-plugin/lib/privacy-filter.js` - 隐私过滤

**核心架构**：

```
┌─────────────────────────────────────────┐
│  FileWatcher (文件监听)                  │
└─────────────┬───────────────────────────┘
              │ 文件保存事件
              ▼
┌─────────────────────────────────────────┐
│  PrivacyFilter (隐私过滤)               │
│  - 排除敏感文件 (.env, .key)          │
│  - 文件大小检查                         │
│  - 敏感代码模式检测                     │
└─────────────┬───────────────────────────┘
              │ 通过过滤
              ▼
┌─────────────────────────────────────────┐
│  CodeAnalyzer (代码分析)                │
│  - Oxc Parser (Rust WASM)              │
│  - AST 分析                            │
│  - 符号提取                            │
│  - 复杂度计算                          │
└─────────────┬───────────────────────────┘
              │ 分析结果
              ▼
┌─────────────────────────────────────────┐
│  CodeAnalysisService (服务层)         │
│  - 批量队列                            │
│  - 防抖处理                            │
│  - 指纹计算                            │
│  - 后端同步                            │
└─────────────────────────────────────────┘
```

**关键技术选型**：

- **Parser**: Oxc (Rust 编写, WASM 运行, 比 Babel 快 10-50 倍)
- **降级**: Tree-sitter WASM (当 Oxc 不支持某种语言时)
- **指纹**: 内容 hash + 符号 hash，存储在 `.code_fingerprints.json`
- **同步**: 增量同步，只上传变更文件

**与 A2A/协议的关系**：
当前代码分析器**没有使用 A2A 或任何 Agent 协议**，它是传统的：

```
文件事件 → 分析器 → 本地存储 → 可选同步到后端
```

如果要接入 A2A，需要：**分析器作为 Agent 向后端推送分析结果**。

---

## 对比总结：协议选择

| 维度           | A2A (Google)   | MCP (Anthropic) | 简单 REST    |
| -------------- | -------------- | --------------- | ------------ |
| **设计目标**   | Agent 之间协作 | Agent ↔ 工具    | 简单数据传输 |
| **复杂度**     | 高             | 中              | 低           |
| **实时性**     | 支持           | 不支持          | 不支持       |
| **我们的需求** | 过度设计       | 工具调用已有    | ✅ 最适合    |
| **推荐**       | ❌ 不采用      | ❌ 不新增       | ✅ 采用      |

**关键结论**：

- **MCP**：我们**已经有** `memory_write` 等工具，就是 MCP 模式，不需要新增
- **A2A**：我们的场景是**单 Agent + 后端服务**，不是多 Agent 协作，A2A 过度设计
- **简单 REST**：**最合适**，快速、可控、易调试

---

## 待确认决策

1. **API 协议**：确认使用简单 REST（而非 A2A/MCP）
2. **实时推送**：确认不需要 WebSocket，轮询足够
3. **数据存储**：确认使用 SQLite（本地文件）而非独立数据库
4. **Phase 1 范围**：确认先做核心 CRUD（POST/GET/PATCH/DELETE），再做关系图谱

确认后启动 Phase 1 实现。

---

## 相关文件引用

- `opencode-memory-plugin/lib/code-analyzer.js` - 代码分析器实现（已读取）
- `opencode-memory-plugin/lib/code-analysis-service.js` - 分析服务层（已读取）
- `opencode-memory-plugin/lib/privacy-filter.js` - 隐私过滤（已读取）
- `opencode-memory-plugin/CODE-ANALYSIS.md` - 用户文档
- `docs/API-CONTRACT.md` - API 契约文档
- `docs/archive/CODE-ANALYSIS-DESIGN-v1.0.md` - 设计历史
- `handoffs/handoff-20260331-code-analysis-phase0-complete.md` - 之前会话交接

---

**给新会话的启动提示**：

请先阅读 `opencode-memory-plugin/lib/code-analyzer.js`、`code-analysis-service.js` 和 `privacy-filter.js` 理解现有代码分析实现，然后阅读本交接文档的"待确认决策"部分，验证当前状态，然后等待我的具体指令再行动。
