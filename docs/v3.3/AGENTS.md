---
status: implemented
version: v3.3.0
last_updated: 2026-05-01
owner: Sisyphus
---

# v3.3 文档分工与智能体操作指南

> **版本**: v3.3.0  
> **作用**: 定义 v3.3 目录下各类文档的职责，以及不同智能体应如何协作使用这些文档

---

## 一、文档分工矩阵

### 1.1 按智能体角色分配

| 智能体 | 主要参考文档 | 辅助文档 | 产出物 |
|--------|-------------|----------|--------|
| **Sisyphus (编排者)** | `README.md` (目录总览) | `AGENTS.md` (分工指南) | 任务分配、进度追踪 |
| **Prometheus (规划者)** | `architecture/ATOM-ARCHITECTURE.md` | `evaluation/DESIGN-EVALUATION.md` | 实施计划、里程碑 |
| **Atlas (执行者)** | `integration/IMPLEMENTATION-INTEGRATION.md` | `integration/test-plans/*.md` | 代码、测试用例 |
| **Oracle (架构师)** | `architecture/ATOM-ARCHITECTURE.md` | `integration/DESIGN-INTEGRATION.md` | 设计决策、技术选型 |
| **The Observer** | `integration/DESIGN-INTEGRATION.md` | `architecture/ATOM-ARCHITECTURE.md` | Atom 树候选 |
| **The Librarian** | `integration/IMPLEMENTATION-INTEGRATION.md` | `evaluation/DESIGN-EVALUATION.md` | 整合报告 |

### 1.2 按任务类型分配

```
任务类型: 架构设计
├── 参考: architecture/ATOM-ARCHITECTURE.md
├── 负责: Oracle
└── 产出: 设计决策记录 → 写入 memory (type: architecture)

任务类型: 功能实现
├── 参考: integration/IMPLEMENTATION-INTEGRATION.md
├── 检查: integration/test-plans/unit-test-plan.md
├── 负责: Atlas
└── 产出: 代码 + 测试 → PR

任务类型: 效果评估
├── 参考: evaluation/DESIGN-EVALUATION.md
├── 执行: evaluation/scripts/*.js
├── 负责: Prometheus + Atlas
└── 产出: 评估报告 → 写入 memory (type: research)

任务类型: 知识萃取
├── 参考: integration/DESIGN-INTEGRATION.md (Phase 2/3)
├── 触发: The Observer / The Librarian
└── 产出: Atom 树 / 整合节点 → memory_write({atoms})
```

---

## 二、文档使用规范

### 2.1 阅读顺序

**新成员 onboarding**:
1. `README.md` → 了解目录结构
2. `architecture/ATOM-ARCHITECTURE.md` → 理解核心概念
3. `integration/DESIGN-INTEGRATION.md` → 了解功能缺口
4. `AGENTS.md` → 明确自己的角色

**实施任务时**:
1. `integration/IMPLEMENTATION-INTEGRATION.md` → 找到对应任务
2. `integration/test-plans/*.md` → 查看测试要求
3. `architecture/ATOM-ARCHITECTURE.md` → 确认设计约束

**评估任务时**:
1. `evaluation/DESIGN-EVALUATION.md` → 了解评估指标
2. `evaluation/IMPLEMENTATION-EVALUATION.md` → 执行步骤
3. `evaluation/scripts/*.js` → 运行脚本

### 2.2 文档更新规则

| 场景 | 更新文档 | 更新内容 |
|------|----------|----------|
| 架构变更 | `architecture/ATOM-ARCHITECTURE.md` | 设计决策、数据结构变更 |
| 新增功能 | `integration/DESIGN-INTEGRATION.md` | 功能设计、API 契约 |
| 功能实现 | `integration/IMPLEMENTATION-INTEGRATION.md` | 代码示例、检查清单 |
| 新增测试 | `integration/test-plans/*.md` | 测试用例、边界条件 |
| 评估结果 | `evaluation/DESIGN-EVALUATION.md` | 基线数据、指标调整 |
| 目录调整 | `README.md` + `AGENTS.md` | 结构变更、分工调整 |

### 2.3 文档状态标记

每个文档顶部必须包含状态标记：

```markdown
---
status: draft | review | implemented | deprecated
version: x.y.z
last_updated: YYYY-MM-DD
owner: AgentName
---
```

---

## 三、智能体协作流程

### 3.1 新功能开发流程

```
[用户提出需求]
    ↓
[Prometheus] 阅读 architecture/ + integration/DESIGN-
    ├── 评估影响范围
    ├── 制定实施计划
    └── 分配任务给 Atlas
    ↓
[Atlas] 阅读 integration/IMPLEMENTATION- + test-plans/
    ├── 编写代码
    ├── 编写测试
    └── 自测通过
    ↓
[Prometheus] 验收
    ├── 检查测试覆盖率
    ├── 验证功能完整性
    └── 更新文档状态
    ↓
[The Observer] 自动检测
    ├── 是否值得保存到记忆？
    └── 生成 Atom 树候选
```

### 3.2 效果评估流程

```
[Prometheus] 阅读 evaluation/DESIGN-
    ├── 确定评估维度
    └── 准备测试数据集
    ↓
[Atlas] 阅读 evaluation/IMPLEMENTATION- + scripts/
    ├── 搭建评估环境
    ├── 执行评估脚本
    └── 收集原始数据
    ↓
[Prometheus] 数据分析
    ├── 统计分析
    ├── 生成图表
    └── 撰写报告
    ↓
[The Librarian] 知识整合
    ├── 将评估结果存入记忆
    ├── 关联相关历史评估
    └── 生成最佳实践 Atom 树
```

### 3.3 架构决策流程

```
[遇到复杂问题]
    ↓
[Oracle] 阅读 architecture/ATOM-
    ├── 分析当前架构约束
    ├── 提出 2-3 个方案
    └── 评估优劣
    ↓
[Prometheus] 阅读 evaluation/DESIGN-
    ├── 评估各方案的实施成本
    └── 评估各方案的风险
    ↓
[用户确认]
    ├── 选择方案
    └── 确认优先级
    ↓
[Atlas] 实施
    └── 更新 architecture/ 文档
```

---

## 四、记忆系统交互规范

### 4.1 何时保存到记忆

**必须保存**:
- 架构决策（type: architecture）
- 设计变更（type: decision）
- 评估结果（type: research）
- 发现的模式（type: pattern）

**建议保存**:
- 实施过程中的经验教训
- 测试发现的边界情况
- 用户反馈和偏好

**保存格式**:
```javascript
memory_write({
  abstract: "简短摘要（建议 ≤100 字符）",
  overview: "详细概述（建议 ≤500 字符）",
  content: "完整内容...",
  type: "architecture | decision | research | pattern",
  tags: ["v3.3", "atom", "相关标签"],
  atoms: [...] // 如有层级结构
})
```

### 4.2 何时查询记忆

**必须查询**:
- 做架构决策前（搜索历史方案）
- 写测试用例前（搜索边界情况）
- 评估效果前（搜索基线数据）

**查询方式**:
```javascript
memory_search({
  query: "关键词",
  scope: "all", // 或 "atom" 精准搜索
  level: 1,     // 先看概述
  limit: 10
})
```

---

## 五、质量控制

### 5.1 文档质量检查清单

**新增/修改文档时必须检查**:
- [ ] 文档顶部有状态标记（status/version/last_updated/owner）
- [ ] 与其他文档的交叉引用正确
- [ ] 代码示例可执行（或明确标记为伪代码）
- [ ] 表格对齐、链接有效
- [ ] 符合 Markdown 规范（通过 markdownlint）

### 5.2 代码质量检查清单

**提交代码时必须检查**:
- [ ] 有对应的测试用例（test-plans/ 或实际测试文件）
- [ ] 文档已更新（DESIGN- 和 IMPLEMENTATION-）
- [ ] 向后兼容性已考虑
- [ ] 性能影响已评估
- [ ] 通过 Oxlint 检查

---

## 六、附录

### 6.1 术语表

| 术语 | 说明 |
|------|------|
| **Atom** | 原子化知识节点，层级化组织 |
| **Entity** | 知识实体，包含 Atom 树 |
| **Phase 1/2/3** | 集成方案的三个实施阶段 |
| **DESIGN-** | 设计文档（What & Why） |
| **IMPLEMENTATION-** | 实施手册（How） |

### 6.2 参考文档

- [v3.2 文档体系](../v3.2/) - 参考 v3.2 的文档组织方式
- [产品文档](../../README.md) - 用户面向的产品说明
- [Backlog](../../BACKLOG.md) - 未完成任务清单

---

**维护者**: OpenCode Agent  
**最后更新**: 2026-05-01
