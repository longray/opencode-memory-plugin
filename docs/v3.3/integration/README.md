# v3.3 Atom 架构集成文档

> **状态**: draft  
> **版本**: v3.3.0  
> **最后更新**: 2026-05-01

---

## 本目录结构

```
integration/
├── README.md                          # 本文件
├── DESIGN-INTEGRATION.md              # 集成方案设计（升级自 INTEGRATION-PLAN）
├── IMPLEMENTATION-INTEGRATION.md      # 集成实施手册
└── test-plans/                        # 测试计划
    ├── unit-test-plan.md
    ├── integration-test-plan.md
    └── e2e-test-plan.md
```

---

## 文档说明

### DESIGN-INTEGRATION.md

**问题**: 如何让 OpenCode 内化 Atom Architecture？

**内容**:

- 五大缺口分析（已完成 ✅）
- 三阶段实施路线（Phase 1 ✅ / Phase 2 ✅ / Phase 3 ⏳）
- Agent 改造方案（The Observer / The Librarian）
- Prompt 工程计划（SOUL.md / AGENTS.md / TOOLS.md）
- 代码示例和 API 契约

**状态**: 待从根目录 `OPENCODE-ATOM-INTEGRATION-PLAN.md` 升级

### IMPLEMENTATION-INTEGRATION.md

**问题**: 具体如何执行每个任务？

**内容**:

- Phase 2 详细任务清单（Prompt 工程）
- Phase 3 详细任务清单（工作流改造）
- 代码模板和检查清单
- 每日/每周执行计划
- 验收标准和回滚方案

**状态**: ✅ 已编写

### test-plans/

**问题**: 如何验证集成正确性？

**内容**:

- `unit-test-plan.md`: 单元测试用例（函数级别）
- `integration-test-plan.md`: 集成测试用例（工具间协作）
- `e2e-test-plan.md`: 端到端测试用例（完整用户流程）

**状态**: ✅ 已编写

---

## 集成状态

| Phase       | 任务                              | 状态                        |
| ----------- | --------------------------------- | --------------------------- |
| **Phase 1** | 工具层修复                        | ✅ 已完成                   |
|             | memory_write 暴露 atoms           | ✅                          |
|             | syncMemoryToBackend 同步 atoms    | ✅                          |
|             | entity_update / entity_atoms 工具 | ✅                          |
|             | memory_search Atom 粒度           | ✅                          |
|             | plugin.js 注册                    | ✅                          |
| **Phase 2** | Prompt 工程                       | ✅ 已完成 (Prompt 注入完成) |
|             | SOUL.md Atom 认知                 | ✅                          |
|             | AGENTS.md 操作规范                | ✅                          |
|             | TOOLS.md 工具说明                 | ✅                          |
|             | Agent 行为验证                    | ⏳                          |
| **Phase 3** | 工作流改造                        | ⏳ 待实施                   |
|             | The Observer 自动萃取             | ⏳                          |
|             | The Librarian 按 Atom 整合        | ⏳                          |
|             | 代码分析关联对话                  | ⏳                          |
|             | 上下文管理 Atom 粒度              | ⏳                          |

---

## 实施流程

```
Phase 2 (Prompt 工程):
1. 阅读 IMPLEMENTATION-INTEGRATION.md → Phase 2 任务清单
2. 按任务清单更新 Agent 配置文件
3. 运行 test-plans/unit-test-plan.md 验证
4. 标记任务完成

Phase 3 (工作流改造):
1. 阅读 IMPLEMENTATION-INTEGRATION.md → Phase 3 任务清单
2. 按任务清单改造 Agent 工作流
3. 运行 test-plans/e2e-test-plan.md 验证
4. 标记任务完成
```

---

## 谁应该阅读

- **全栈开发者**: 实施 Atom 集成功能
- **Agent 开发者**: 改造 The Observer / The Librarian
- **QA 工程师**: 执行测试计划

---

## 与其他文档的关系

```
integration/DESIGN-INTEGRATION.md
    ├── 基础: architecture/ATOM-ARCHITECTURE.md (架构约束)
    ├── 验证: evaluation/DESIGN-EVALUATION.md (效果指标)
    └── 实施: integration/IMPLEMENTATION-INTEGRATION.md (具体步骤)
```

---

**维护者**: Atlas (执行者智能体)  
**更新频率**: 每 Phase 完成后
