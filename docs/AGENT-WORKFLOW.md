# OpenCode Agent 工作流指南

> **版本**: v1.0.0  
> **日期**: 2026-04-10  
> **适用**: OpenCode Agent (Claude)

---

## 概述

本文档定义 OpenCode Agent 在 v3.2 开发阶段的工作流，确保 Agent 的提交自动关联设计文档，RTM 自动更新。

---

## Agent 工作流程

### 1. 开发前检查

每次开发任务开始前，Agent 应该：

```bash
# 检查 RTM 状态
node scripts/opencode-integration.js rtm-summary
```

这会输出：
```
📊 RTM Status Summary
============================================================
Total Items: 34
  ⏳ Pending: 20
  🔄 In Progress: 5
  ⚠️ Warning: 2
  ✅ Completed: 7
  ❌ Cancelled: 0
Completion Rate: 20.6%
Status: BEHIND
============================================================
```

### 2. 开发完成后

#### 2.1 获取提交建议

```bash
# 根据变更生成提交建议
node scripts/opencode-integration.js suggest-commit
```

输出示例：
```
🤖 OpenCode Agent Commit Suggestion
============================================================

Suggested commit message:
------------------------------------------------------
feat(websocket): Update ws-client.js, config.js

Design-Ref:
  - BACKEND-v3.2-WEBSOCKET.md

Changes:
  - lib/ws-client.js
  - lib/config.js
------------------------------------------------------

To use this suggestion:
  1. Review the Design-Ref links
  2. Adjust the description if needed
  3. Commit with: git commit -m "<message>"

============================================================
```

#### 2.2 提交代码

Agent 使用建议的提交信息：

```bash
git add -A
git commit -m "feat(websocket): implement heartbeat mechanism

- Add 30s interval heartbeat ping/pong
- Add 2-miss detection for reconnection

Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.2-重连机制

Closes: BL-CA-36"
```

**关键**: 必须包含 `Design-Ref:` 引用

#### 2.3 自动更新 RTM

提交后，Agent 运行：

```bash
# 自动更新 RTM 状态
node scripts/opencode-integration.js update-rtm
```

这会：
1. 解析最近的提交
2. 提取 Design-Ref
3. 自动更新 RTM 中对应项的状态
4. 输出更新摘要

### 3. 验证设计符合性

在 PR 前，Agent 运行：

```bash
# 验证设计符合性
node scripts/opencode-integration.js verify-design
```

这会检查：
- 代码风格
- 测试覆盖率
- Design-Ref 完整性
- RTM 更新状态

---

## 自动化集成

### Git Hooks（可选）

可以配置 Git Hooks 自动运行：

```bash
# .git/hooks/post-commit
#!/bin/bash
node scripts/opencode-integration.js update-rtm
```

### CI/CD 集成

已经在 `.github/workflows/design-compliance.yml` 中配置：

- 每次 PR 自动检查 Design-Ref
- 自动检查 RTM 更新
- 阻断不符合规范的提交

---

## 脚本清单

| 脚本 | 用途 | Agent 使用时机 |
|------|------|----------------|
| `opencode-integration.js` | Agent 主入口 | 开发前/后 |
| `update-rtm.js` | 更新 RTM | 提交后 |
| `check-design-compliance.js` | 设计符合性检查 | PR 前 |

---

## 快速参考

### Agent 开发流程

```bash
# 1. 开发前检查 RTM
node scripts/opencode-integration.js rtm-summary

# 2. 开发代码...

# 3. 获取提交建议
node scripts/opencode-integration.js suggest-commit

# 4. 提交代码（包含 Design-Ref）
git commit -m "feat(module): description

Design-Ref: BACKEND-v3.2-XXX.md#section

Closes: BL-CA-XX"

# 5. 自动更新 RTM
node scripts/opencode-integration.js update-rtm

# 6. 验证设计符合性
node scripts/opencode-integration.js verify-design
```

---

## 注意事项

1. **必须包含 Design-Ref**: 每个提交都必须引用设计文档
2. **自动更新 RTM**: 提交后自动运行更新脚本
3. **验证后再 PR**: 确保设计符合性检查通过

---

_文档版本: v1.0.0_  
_最后更新: 2026-04-10_
