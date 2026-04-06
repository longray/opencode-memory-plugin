# 代码分析功能快速入门

> **目标**: 5 分钟内上手代码分析功能  
> **难度**: ⭐ 简单  
> **前提**: 已安装 OpenCode Memory Plugin  
> **版本**: v3.0.0 | v1.4 路线图规划中

---

## 1. 安装（1分钟）

代码分析功能已包含在 OpenCode Memory Plugin 中，无需额外安装。

**确认安装**:

```bash
cd opencode-memory-plugin
npm list oxc-parser
```

看到 `oxc-parser@^0.121.0` 即表示已安装。

---

## 2. 第一个分析（2分钟）

### 步骤 1: 准备一个代码文件

创建一个测试文件：

```bash
echo "function add(a, b) { return a + b; }" > test.js
```

### 步骤 2: 运行分析

```bash
node cli/code-analyzer.cjs test.js
```

**预期输出**:

```json
{
  "success": true,
  "file": "test.js",
  "result": {
    "language": "javascript",
    "functions": [{ "name": "add", "line": 1 }],
    "classes": [],
    "complexity_metrics": {
      "cyclomatic": 1,
      "lines_of_code": 1
    }
  }
}
```

### 步骤 3: 尝试表格输出

```bash
node cli/code-analyzer.cjs test.js --format table
```

**预期输出**:

```
┌────────────────────────────────────────────────────────────┐
│  Code Analysis: test.js                                    │
├────────────────────────────────────────────────────────────┤
│  Language: javascript                                      │
│  Lines: 1                                                  │
│  Functions: 1                                              │
│  Classes: 0                                                │
│  Complexity: 1                                             │
├────────────────────────────────────────────────────────────┤
│  Functions:                                                │
│  ┌─────────┬──────┬────────────┬─────────────────────────┐ │
│  │ Name    │ Line │ Complexity │ Risk                    │ │
│  ├─────────┼──────┼────────────┼─────────────────────────┤ │
│  │ add     │ 1    │ 1          │ 🟢 Low                  │ │
│  └─────────┴──────┴────────────┴─────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

**🎉 恭喜！你已完成第一个代码分析。**

---

## 3. 自动触发配置（2分钟）

### 步骤 1: 启用自动触发

编辑配置文件：

```bash
# Windows
notepad %USERPROFILE%\.opencode\memory\memory-config.json

# macOS/Linux
nano ~/.opencode/memory/memory-config.json
```

### 步骤 2: 添加配置

```json
{
  "code_analysis": {
    "enabled": true,
    "auto_trigger": true
  }
}
```

### 步骤 3: 测试自动触发

1. 打开你的项目
2. 修改任意 `.js` 或 `.ts` 文件
3. 保存文件（Ctrl+S）
4. 观察控制台输出 `[CodeAnalysis] Analyzing...`

**🎉 自动触发已启用！**

---

## 4. 常见问题（FAQ）

### Q: 分析失败怎么办？

**A**: 检查以下几点：

1. 文件扩展名是否正确（`.js`, `.ts`）
2. 文件是否在项目目录内
3. 运行 `npm test` 确认测试通过

### Q: 如何禁用自动触发？

**A**: 在配置文件中设置：

```json
{
  "code_analysis": {
    "auto_trigger": false
  }
}
```

### Q: 支持哪些语言？

**A**: 当前支持 JavaScript 和 TypeScript（使用 Oxc 解析器）。提供 AST 分析、复杂度计算、JSDoc 提取等功能。

### Q: 分析结果保存在哪里？

**A**: 结果保存到记忆系统，可通过以下命令查询：

```bash
# 搜索代码分析结果
memory_search query="code-analysis"

# 查看最近的分析
memory_timeline days=7 level=1
```

### Q: 如何分析整个项目？

**A**: 使用 `--project` 选项：

```bash
node cli/code-analyzer.cjs --project .
```

---

## 5. v1.4 新特性速览

v1.4 在 v3.0.0 基础上增强多语言分析和代码质量评估能力。

### 调用关系提取（规划中）

分析函数之间的调用关系，了解代码的依赖结构：

```bash
# v1.4 将新增 calls 字段
node cli/code-analyzer.cjs src/auth.js
# 输出包含: "calls": [{ "target": "validateUser", "line": 42 }]
```

### 增强复杂度计算（规划中）

Tree-sitter 多语言路径将从启发式估算升级为 AST 级别精确计算：

```bash
# 当前: Tree-sitter 使用函数名启发式（handle→3, validate→4）
# v1.4: 基于 if/for/while/catch/&&/|| 的 AST 遍历精确计算
node cli/code-analyzer.cjs --language python src/handler.py
```

### 文件级质量评分（规划中）

每个分析文件将获得 0-100 的质量评分：

```
Quality Score: 85/100  ✅ Good
  Complexity: 4 (Low)  Nesting: 2 (Normal)
```

**任务进度**: 详见 [BACKLOG.md](../../BACKLOG.md) 场景九

---

## 6. 下一步

### 深入学习

- **[完整文档](CODE-ANALYSIS.md)** — 了解所有功能和配置选项
- **[CLI 使用指南](CODE-ANALYSIS.md#cli-使用指南)** — 掌握高级用法
- **[项目级分析](CODE-ANALYSIS.md#5-项目健康度检查)** — 生成项目健康度报告

### 实践练习

1. **分析你的项目**: 运行 `node cli/code-analyzer.cjs --project .`
2. **查看健康度**: 检查项目评级（A/B/C/D）
3. **识别风险**: 查看复杂度 > 10 的文件列表

### 获取帮助

- **GitHub Issues**: [提交问题](https://github.com/longray/opencode-memory-plugin/issues)
- **文档**: [完整文档](CODE-ANALYSIS.md)

---

## 快速命令参考

| 命令                                                | 说明         |
| --------------------------------------------------- | ------------ |
| `node cli/code-analyzer.cjs file.js`                | 分析单个文件 |
| `node cli/code-analyzer.cjs file.js --format table` | 表格输出     |
| `node cli/code-analyzer.cjs file.js --format tree`  | 树形输出     |
| `node cli/code-analyzer.cjs file.js --save`         | 保存到记忆   |
| `node cli/code-analyzer.cjs --project .`            | 项目级分析   |

---

_最后更新：2026-04-07_