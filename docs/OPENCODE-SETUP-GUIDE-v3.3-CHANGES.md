# OpenCode 配置指南 v3.3 变更说明

**对比版本**: v2.0 (旧) → v3.3 (新)  
**变更日期**: 2026-04-29

---

## 主要变更概览

| 维度 | v2.0 旧版本 | v3.3 新版本 |
|------|------------|------------|
| **版本焦点** | v3.2 WebSocket 实时同步 | v3.3 Atom Architecture |
| **架构层级** | 5 层 | 5 层（Layer 3 新增 Atom 支持） |
| **文档长度** | 1913 行 | 652 行（精简实用） |
| **测试验证** | 324 测试 | 97 新测试 + 原有测试 |
| **后端端口** | 17999 | 18008 |

---

## 新增内容

### 1. v3.3 Atom Architecture

**核心概念**:
- Entity 包含 Atom 树结构（parent_id + children）
- 分数索引（Base-62 order 字段）
- 循环引用检测（三色 DFS）
- 悬挂引用检测和死链标记

**新 API**:
```javascript
// 写入带 Atoms 的 Entity
memory_write({
  abstract: "...",
  atoms: [{ local_id, type, name, content, parent_id, children }]
});

// 批量更新 Atoms
updateEntity({ entry_id, atoms_batch: [{action: "add/update/remove"}] });

// 获取 Atom 树
getEntityAtoms({ entry_id });

// 标记死链
markDeadLinks({ entry_id });
```

### 2. 统一搜索端点

```
POST /api/v1/search  （替代 /api/v1/memories/search）
```

支持 Entity + Atom 混合搜索，响应包含 `type: "entity" | "atom"`。

### 3. 文件大小监控

- 警告阈值：80KB
- 硬限制：100KB
- 自动检测和警告

---

## 更新内容

### 1. 后端 API 变更

| 端点 | v3.2 | v3.3 |
|------|------|------|
| 搜索 | `/api/v1/memories/search` | `/api/v1/search` |
| Atom 字段 | 基础字段 | +6 新字段（tags, heading_level, parent_id, order, aliases, entity_id） |
| 端口 | 17999 | 18008 |

### 2. 配置更新

**memory-config.json**:
```json
{
  "apiPort": 18008,  // 更新端口
  "backend": {
    "url": "http://localhost:18008"  // 更新端口
  }
}
```

### 3. 环境变量

```bash
# 端口更新
export API_PORT="18008"  # 替代 17999
```

---

## 删除/简化内容

### 1. 精简架构

v3.3 指南移除了 v2.0 中过于详细的内部实现细节，专注于：
- ✅ 实际配置步骤
- ✅ 可运行的代码示例
- ✅ 验证和测试方法
- ✅ 故障排除

### 2. 移除过时章节

- 移除了详细的内部消息流描述
- 简化了 OMO 智能体架构说明
- 合并了重复的配置示例

---

## 向后兼容

### 自动兼容

- ✅ 旧格式 Entity 无需迁移
- ✅ `memory_write` 无 atoms 参数时行为不变
- ✅ `memory_read` 自动检测 ID 类型

### 升级步骤

```bash
# 1. 备份
mv ~/.opencode/memory ~/.opencode/memory.backup

# 2. 升级
npm install -g @csuwl/opencode-memory-plugin@latest

# 3. 验证
opencode-memory --version  # 应显示 3.3.0
```

---

## 文档结构对比

### v2.0 结构（10 章，1913 行）

1. Executive Summary
2. Architecture Overview
3. Current Environment Analysis
4. Quick Start: Day in the Life
5. Detailed Configuration
6. Agent Configuration
7. Workflow Examples
8. Decision Trees
9. Verification & Troubleshooting
10. Appendix

### v3.3 结构（8 章，652 行）

1. Executive Summary
2. Architecture Overview
3. Prerequisites & Installation
4. Configuration Guide
5. Verification & Testing
6. Daily Workflow
7. Troubleshooting
8. Migration from v3.2

**改进**:
- 合并相关章节，减少重复
- 增加实际可运行的代码示例
- 强调验证和测试步骤
- 新增迁移指南章节

---

## 验证清单

使用 v3.3 指南前，请确认：

- [ ] 后端服务已升级到 v3.3（端口 18008）
- [ ] 插件版本为 3.3.0+ (`opencode-memory --version`)
- [ ] 环境变量 `API_PORT` 设置为 18008
- [ ] 配置文件 `memory-config.json` 更新端口
- [ ] 运行测试通过 (`npm test`)

---

## 参考文档

- [OPENCODE-SETUP-GUIDE-v3.3.md](./OPENCODE-SETUP-GUIDE-v3.3.md) - 新配置指南
- [OPENCODE-SETUP-GUIDE-FINAL.md](./OPENCODE-SETUP-GUIDE-FINAL.md) - 旧配置指南（v2.0）
- [MIGRATION-v3.3.md](./MIGRATION-v3.3.md) - 详细迁移指南
- [API-CONTRACT.md](./API-CONTRACT.md) - API 契约更新

---

**建议**: 新用户直接使用 v3.3 指南，v3.2 用户参考 Migration 章节升级。
