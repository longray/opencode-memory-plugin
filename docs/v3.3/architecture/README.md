# v3.3 架构设计文档

> **状态**: implemented  
> **版本**: v3.3.0  
> **最后更新**: 2026-05-01

---

## 本目录文档

| 文档 | 说明 | 状态 |
|------|------|------|
| `ATOM-ARCHITECTURE.md` | Atom 架构详细设计 | ✅ 已实施 |

---

## 文档说明

`ATOM-ARCHITECTURE.md` 定义了 v3.3 的核心架构设计：

- **Entity-Atom 模型**: 知识实体与原子节点的关系
- **存储结构**: 内嵌树模型的设计决策
- **API 设计**: 后端和插件端的 API 规范
- **文件格式**: Entity 文件的 Markdown + JSON 格式
- **关键算法**: 循环检测、树重建、分数索引
- **风险缓解**: 潜在风险和应对措施

---

## 谁应该阅读

- **架构师**: 理解系统整体设计和决策依据
- **核心开发者**: 实现 Atom 相关功能时参考
- **新成员**: 快速理解 v3.3 的核心概念

---

## 与其他文档的关系

```
architecture/ATOM-ARCHITECTURE.md
    ├── 指导: integration/DESIGN-INTEGRATION.md (功能如何接入)
    ├── 约束: integration/IMPLEMENTATION-INTEGRATION.md (实现边界)
    └── 验证: evaluation/DESIGN-EVALUATION.md (效果是否达标)
```

---

**维护者**: Oracle (架构师智能体)  
**更新频率**: 架构变更时
