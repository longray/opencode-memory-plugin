# 评估脚本

> **状态**: draft  
> **版本**: v3.3.0

---

## 脚本列表

| 脚本                             | 功能            | 状态                                  |
| -------------------------------- | --------------- | ------------------------------------- |
| `evaluate-atom-quality.js`       | Atom 树质量分析 | WIP - 框架已完成，待接入实际 API 调用 |
| `evaluate-search-performance.js` | 检索性能对比    | ✅ 已实现（接入 WrapperClient.search API） |
| `evaluate-context-efficiency.js` | Token 使用效率  | ✅ 已实现（接入 getEntryById/getEntityAtoms API） |

---

## 使用方式

```bash
# 运行所有评估
cd evaluation/scripts
node evaluate-atom-quality.js
node evaluate-search-performance.js
node evaluate-context-efficiency.js

# 输出: JSON 报告到 ../reports/ 目录
```

---

## 实现计划

这些脚本将从 `MEMORY-PLUGIN-EVALUATION-PLAN.md` 中的伪代码实现为可执行的 Node.js 脚本。

**依赖**:

- `../../../opencode-memory-plugin/lib/memory-core.js` (Atom 操作)
- `../../../opencode-memory-plugin/tools/search.js` (搜索功能)
- `../../../opencode-memory-plugin/lib/storage.js` (配置读取)

---

**维护者**: Atlas (执行者智能体)
