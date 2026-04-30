# 测试计划

> **状态**: draft  
> **版本**: v3.3.0

---

## 测试文档

| 文档 | 覆盖范围 | 状态 |
|------|----------|------|
| `unit-test-plan.md` | 函数/模块级别 | ⏳ 待编写 |
| `integration-test-plan.md` | 工具间协作 | ⏳ 待编写 |
| `e2e-test-plan.md` | 完整用户流程 | ⏳ 待编写 |

---

## 测试层次

```
E2E 测试 (e2e-test-plan.md)
├── 场景: 用户保存代码分析结果 → Atom 树自动创建 → 搜索可找到
└── 验证: 端到端流程完整

集成测试 (integration-test-plan.md)
├── 场景: memory_write({atoms}) → syncMemoryToBackend → memory_search(scope=atom)
└── 验证: 工具链协作正确

单元测试 (unit-test-plan.md)
├── 场景: detectCircularReference(), buildAtomTree(), flattenAtomTree()
└── 验证: 函数输入输出正确
```

---

## 编写规范

每个测试用例必须包含:
- **输入**: 明确的输入数据
- **预期输出**: 明确的预期结果
- **边界条件**: 异常情况处理
- **自动化**: 是否可自动化执行

---

**维护者**: Atlas (执行者智能体)
