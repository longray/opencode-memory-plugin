---
name: opsx-execute
description: 读取 OpenSpec 变更提案，用 OMO 多 Agent 调度执行，并用 Superpowers TDD 保障质量
---

# OpenSpec + OMO + Superpowers 桥接执行器

当用户需要执行 OpenSpec 变更（如 `/opsx:apply` 或 `ulw`）时，按以下流程：

## 1. 读取规范
- READ openspec/changes/$ARGUMENTS/proposal.md
- READ openspec/changes/$ARGUMENTS/specs/spec.md
- READ openspec/changes/$ARGUMENTS/design.md
- READ openspec/changes/$ARGUMENTS/tasks.md
- READ openspec/project.md（了解存量上下文）

## 2. 计划制定（Superpowers writing-plans）
- 使用 skill 工具加载 `superpowers/writing-plans`
- 将 tasks.md 转化为可执行的、带依赖关系的计划
- 识别哪些任务需要测试先行（TDD）

## 3. 执行实施（OMO 调度）
- 这是存量项目重构，必须向后兼容
- 优先调用 @sisyphus 进行整体调度
- 复杂设计任务 → @prometheus 补充方案
- 编码任务 → @hephaestus 实现
- 测试任务 → @atlas 验证
- 架构决策 → @oracle 审查
- 代码评审 → @momus review

## 4. 质量保障（Superpowers TDD）
- 对标记为"TDD"的任务：
  - 先写测试用例（调用 `superpowers/test-driven-development`）
  - 再写实现代码
  - 确保测试通过后再勾选 tasks.md

## 5. 进度同步
- 每完成一个任务，在 tasks.md 中勾选 `- [x]`
- 如果会话中断，下次从第一个未勾选任务继续

## 6. 验收归档
- 执行完成后，对比 spec.md 自验收
- 通过后执行：openspec sync $ARGUMENTS && openspec archive $ARGUMENTS
