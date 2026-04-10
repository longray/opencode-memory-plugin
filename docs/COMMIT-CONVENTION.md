# 代码提交规范

> **版本**: v1.0.0  
> **日期**: 2026-04-10  
> **适用范围**: v3.2 开发阶段

---

## 概述

本文档定义 v3.2 开发阶段的代码提交规范，确保每个提交都与设计文档关联，便于追踪和审查。

---

## 提交信息格式

```
类型(模块): 简短描述（50字符内）

详细描述（可选，每行72字符内）

- 说明变更原因
- 说明实现方式
- 说明影响范围

设计引用（必须）:
Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制

关闭的BACKLOG项（可选）:
Closes: BL-CA-36
```

---

## 类型（Type）

| 类型 | 说明 | 示例 |
|------|------|------|
| **feat** | 新功能 | `feat(websocket): add heartbeat mechanism` |
| **fix** | 修复bug | `fix(precompute): handle empty file content` |
| **docs** | 文档更新 | `docs(api): update WebSocket API spec` |
| **style** | 代码格式 | `style(ws): fix indentation` |
| **refactor** | 重构 | `refactor(schema): simplify tenant_id handling` |
| **perf** | 性能优化 | `perf(precompute): optimize batch processing` |
| **test** | 测试相关 | `test(websocket): add reconnection tests` |
| **chore** | 构建/工具 | `chore(deps): upgrade tree-sitter to 0.25.x` |

---

## 模块（Scope）

| 模块 | 说明 | 对应设计文档 |
|------|------|--------------|
| **websocket** | WebSocket相关 | BACKEND-v3.2-WEBSOCKET.md |
| **precompute** | 预计算服务 | BACKEND-v3.2-PRECOMPUTE.md |
| **schema** | 数据库Schema | DATABASE-v3.2-SCHEMA.md |
| **api** | API接口 | PLUGIN-v3.2-API.md |
| **deployment** | 部署配置 | DEPLOYMENT-v3.2.md |
| **deps** | 依赖更新 | DEPENDENCY-VERSIONS.md |
| **docs** | 文档 | 所有 .md 文件 |
| **rtm** | RTM更新 | RTM.md |

---

## 设计引用（Design-Ref）

**必须**在提交信息中引用设计文档，格式：

```
Design-Ref: 文档名#章节-标题
```

**示例**:
```
Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
Design-Ref: BACKEND-v3.2-PRECOMPUTE.md#4.2-批处理创建
Design-Ref: DATABASE-v3.2-SCHEMA.md#2.1-Atom表
```

**多个引用**:
```
Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.2-重连机制
```

---

## 关闭BACKLOG项

如果提交完成了某个BACKLOG任务，使用 `Closes` 关键字：

```
Closes: BL-CA-36
Closes: BL-CA-37, BL-CA-38
```

---

## 完整示例

### 示例1: 新功能

```
feat(websocket): implement heartbeat mechanism

- Add 30s interval heartbeat ping/pong
- Implement 2-miss detection for reconnection
- Add heartbeat success rate metrics

Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.2-重连机制

Closes: BL-CA-36
```

### 示例2: Bug修复

```
fix(precompute): handle circular call detection

- Fix infinite loop in cycle detection algorithm
- Add max depth limit (100) to prevent stack overflow
- Add test case for deeply nested calls

Design-Ref: BACKEND-v3.2-PRECOMPUTE.md#4.3-循环检测

Closes: BL-CA-44
```

### 示例3: 文档更新

```
docs(api): add WebSocket performance benchmarks

- Add Artillery test configuration
- Add k6 test scripts
- Add custom benchmark tool

Design-Ref: PLUGIN-v3.2-API.md#5-WebSocket性能测试

Closes: BL-CA-43
```

---

## 使用模板

### 配置Git使用模板

已自动配置：
```bash
git config commit.template .gitmessage
```

### 提交时使用模板

```bash
# 使用模板编辑提交信息
git commit

# 或命令行提交（不推荐，无法引用设计文档）
git commit -m "feat(websocket): add heartbeat"
```

---

## 检查清单

提交前检查：

- [ ] 类型正确（feat/fix/docs等）
- [ ] 模块正确（websocket/precompute等）
- [ ] 简短描述清晰（50字符内）
- [ ] 包含 Design-Ref 引用
- [ ] 如完成BACKLOG任务，包含 Closes
- [ ] 详细描述说明变更原因（如需要）

---

## 验证提交信息

### 查看最近提交

```bash
git log --oneline -10
```

### 查看完整提交信息

```bash
git show HEAD
```

### 检查是否包含Design-Ref

```bash
git log --grep="Design-Ref" --oneline
```

---

## 常见问题

### Q: 忘记添加Design-Ref怎么办？

A: 修改最后一次提交：
```bash
git commit --amend
# 添加 Design-Ref 后保存
```

### Q: 一个提交涉及多个模块怎么办？

A: 选择主要模块，或在描述中说明：
```
feat(websocket,precompute): integrate services

- WebSocket now triggers precompute on file change
- Add coordination between modules

Design-Ref: BACKEND-v3.2-WEBSOCKET.md#4.1-集成
Design-Ref: BACKEND-v3.2-PRECOMPUTE.md#5.1-触发机制
```

### Q: 纯重构没有对应设计文档怎么办？

A: 使用docs类型，引用架构文档：
```
refactor(schema): simplify tenant_id handling

Design-Ref: UNIFIED-ARCHITECTURE-v3.2.md#4-多租户预留
```

---

## 参考

- [RTM.md](./v3.2/RTM.md) - 实施追踪矩阵
- [BACKLOG.md](../BACKLOG.md) - 任务清单
- [v3.2设计文档](./v3.2/) - 设计文档目录

---

_文档版本: v1.0.0_  
_最后更新: 2026-04-10_
