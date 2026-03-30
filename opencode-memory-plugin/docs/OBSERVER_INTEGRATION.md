# Observer 与主代理集成指南

> 当 Observer（作为 subagent）输出分析报告后，主代理（Build）需要能够正确处理并向用户确认。

## 当前限制

由于 OpenCode 框架的限制，插件注册的代理**只能作为 subagent 运行**（无法改为 primary mode）。这意味着：

1. Observer 以 subagent 模式运行，输出分析报告
2. 主代理（Build）收到 Observer 的输出
3. 主代理需要能够区分"可直接保存"和"需要确认"两类内容

## 解决方案

用户可以将以下**主代理增强片段**添加到自己的 OpenCode 配置中，使主代理能够正确处理 Observer 的输出。

### 添加方式

在 `~/.config/opencode/` 目录下创建或编辑 `agents/` 中的自定义代理配置。

或者使用 OpenCode 的内置命令添加自定义指令。

### 主代理增强片段（添加到系统 prompt 中）

```
## 记忆观察者（Observer）输出处理

当 Observer (@memory-automation) 报告记忆候选时，按以下规则处理：

### 第一类：记忆候选（可直接保存）

Observer 输出格式：
🧠 **记忆候选（可直接保存）**
**[1] 类型: preference**
- Abstract: ...
- Overview: ...
- Tags: ...

**处理方式**：
- 直接询问用户："是否保存这些记忆？输入 Save 1 / Save all / Discard"
- 用户确认后，调用 memory_write 保存

### 第二类：需要确认的隐式发现

Observer 输出格式：
⚠️ **需要确认的隐式发现**
**[A] 观察到的行为模式：**
- 你在第 N 轮...

**[B] 推断的用户偏好：**
- ...

**处理方式**：
- 向用户确认："我观察到你在第 N 轮遇到了 XX 问题。是否需要保存这个记忆？"
- 用户确认后，调用 memory_write 保存

### 黄金法则

- Observer **没有权限**执行 memory_write
- 只有你（主代理）在用户**明确确认后**才能调用 memory_write
- 绝对不要在用户未确认的情况下自动保存
```

## 简化方案（不添加配置）

如果用户不想手动添加配置，默认的主代理行为如下：

1. Observer 输出分析报告
2. 主代理显示 Observer 的输出
3. 用户可以手动选择是否保存：
   - 用户说"保存这个" → 主代理调用 memory_write
   - 用户说"不需要" → 主代理不执行

## 验证流程

1. 进行包含隐式偏好的对话（如：写代码→被 lint 检出→默默删除）
2. 触发 `@memory-automation`
3. Observer 应输出"需要确认的隐式发现"区块
4. 主代理向用户确认是否保存
5. 用户确认 → memory_write 执行
