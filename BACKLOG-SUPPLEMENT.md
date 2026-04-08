# Backlog 补充文档

本文档补充 BACKLOG.md 中定义不够清晰的任务，统一使用标准五要素格式。

---

## 标准任务格式

每个任务必须包含以下五要素：

1. **目标** - 任务要达成的具体结果
2. **涉及范围** - 需要修改的文件和模块
3. **前置依赖** - 必须先完成的任务
4. **完成标准** - 明确的验收条件（可量化、可验证）
5. **验证方式** - 具体的测试和验证步骤

---

## 待完善任务清单

### BL-8 [P1] 隐式偏好发现端到端验证

**目标**: 完整测试隐式偏好发现→报告→确认→保存的全流程，修复发现的问题

**涉及范围**:

1. `opencode-memory-plugin/agents/memory-automation.md` - Observer prompt 微调
2. `opencode-memory-plugin/agents/` - 主代理 prompt 微调
3. `README.md` - 更新 Observer 使用说明
4. `AGENTS.md` - 更新代理配置文档

**前置依赖**:

- BL-7 完成（隐式偏好发现基础实现）
- memory-automation agent 已配置

**完成标准**:

1. 全流程跑通：对话行为→Observer 分析→主代理确认→用户确认→memory_write 成功
2. Observer 输出中包含"需要确认"的隐式发现区块（至少识别出1个潜在偏好）
3. 主代理向用户确认："观察到你在第 N 轮遇到 XX 问题，是否需要保存这个记忆？"
4. 用户确认后，记忆成功保存到 timeline
5. 保存的记忆包含完整的 abstract/overview/content 三层结构
6. 误报率 < 20%（5次测试中出现1次误报可接受）

**验证方式**:

1. 设计测试对话场景：用户写代码→被 lint 检出→默默删除→再次提交
2. 运行 Observer 分析测试对话，检查输出是否包含隐式发现区块
3. 验证主代理是否正确引用 Observer 的发现并询问用户
4. 用户确认后，使用 `memory_read` 验证记忆已保存
5. 检查记忆内容是否包含：类型=preference、标签包含代码风格、abstract≤100字符
6. 运行5次不同场景的测试，统计识别准确率和误报率

---

### BL-15 [P2] 后端增量同步对接

**目标**: 对接后端 fingerprint API，实现代码分析结果的增量同步，避免重复上传未变更文件

**涉及范围**:

1. `opencode-memory-plugin/lib/code-fingerprint.js` - 新增/修改指纹计算逻辑
2. `opencode-memory-plugin/lib/wrapper-client.js` - 新增 `syncCodeFingerprints()` 方法
3. `opencode-memory-plugin/lib/code-analysis-service.js` - 集成指纹检查到分析流程
4. 后端 API 对接：`POST /api/v1/sync/code-fingerprints`

**前置依赖**:

- BL-9 完成（代码分析基础功能）
- 后端 BL-26 完成（增量同步 API）
- code-fingerprint.js 基础实现已存在

**完成标准**:

1. 计算文件指纹（content_hash: SHA256、symbols_hash: 函数名+参数哈希）
2. 调用后端 fingerprint API 获取需要更新的文件列表
3. 只上传后端返回的变更文件，未变更文件跳过上传
4. 本地指纹持久化到 `.code_fingerprints.json`（项目根目录）
5. 支持手动触发全量同步（绕过指纹检查）
6. 同步完成后更新本地指纹缓存
7. 错误处理：后端 API 失败时回退到全量上传

**验证方式**:

1. 首次分析项目，验证所有文件上传成功，指纹文件生成
2. 修改单个文件，再次分析，验证只上传修改的文件（通过日志或网络监控）
3. 验证未修改文件未产生上传请求（检查 network 日志）
4. 删除 `.code_fingerprints.json`，验证全量同步触发
5. 模拟后端 API 失败，验证回退到全量上传
6. 检查指纹文件格式：JSON，包含文件路径→{content_hash, symbols_hash, last_sync}
7. 运行 `npm test`，验证无回归

---

### BL-CA-11 [P0] 扩展函数元数据字段（Tree-sitter 路径）

**目标**: 补齐 Tree-sitter 路径的函数元数据字段，使 Python/Go/Rust/Java 输出与 Oxc 路径一致

**涉及范围**:

1. `opencode-memory-plugin/lib/tree-sitter-parser.js`:
   - `extractPythonFunctions()` - 添加 return_type、is_exported、is_async
   - `extractGoFunctions()` - 添加 return_type、is_exported、is_async
   - `extractRustFunctions()` - 添加 return_type、is_exported、is_async
   - `extractJavaFunctions()` - 添加 return_type、is_exported、is_async

**前置依赖**: 无

**完成标准**:

1. Python: 从 type hints 提取 `return_type`，`is_async` 识别 `async def`
2. Go: 从函数签名提取 `return_type`，`is_exported` 识别大写开头函数
3. Rust: 从 `-> Type` 提取 `return_type`，`is_exported` 识别 `pub fn`
4. Java: 从返回类型提取 `return_type`，`is_exported` 识别 `public` 修饰符
5. 所有语言统一输出字段：`name`, `params`, `return_type`, `is_exported`, `is_async`, `line`, `column`
6. 无 return_type 时输出 `undefined`（不是空字符串）

**验证方式**:

1. 分析 Python 文件 `async def fetch(): ...`，验证输出 `is_async: true`
2. 分析 Go 文件 `func Helper() string`，验证输出 `is_exported: true, return_type: "string"`
3. 分析 Rust 文件 `pub fn calc() -> i32`，验证输出 `is_exported: true, return_type: "i32"`
4. 分析 Java 文件 `public int getId()`，验证输出 `is_exported: true, return_type: "int"`
5. 对比 Oxc 和 Tree-sitter 对同一 JS 文件的输出，字段一致性 > 95%
6. 运行 `npm test`，验证 Tree-sitter 相关测试通过
7. 测试无返回值的函数，验证 `return_type: undefined`

---

### BL-CA-12 [P1] 新增调用关系提取（CallSymbol）

**目标**: 提取函数调用关系，支持跨文件引用追踪，为代码审查提供调用关系视图

**涉及范围**:

1. `opencode-memory-plugin/lib/code-analyzer.js`:
   - 新增 `_extractCallsFromOxcAst()` - Oxc 路径调用提取
2. `opencode-memory-plugin/lib/tree-sitter-parser.js`:
   - 新增 `extractPythonCalls()` - Python 调用提取
   - 新增 `extractGoCalls()` - Go 调用提取
   - 新增 `extractRustCalls()` - Rust 调用提取
   - 新增 `extractJavaCalls()` - Java 调用提取
3. 分析结果新增 `calls: CallSymbol[]` 字段

**前置依赖**: 无

**完成标准**:

1. Oxc 路径：遍历 `CallExpression` 节点，提取 `target`（函数名）、`file_path`（相对路径）、`line`、`column`
2. Tree-sitter 路径：遍历 `call_expression` 节点，提取相同字段
3. 支持识别直接调用 `func()` 和成员调用 `obj.method()`
4. 过滤内置调用（console.log、print、fmt.Println 等，可配置列表）
5. `file_path` 为相对于项目根目录的相对路径
6. 支持跨文件调用识别（通过导入语句解析）
7. CLI `--format tree` 输出包含调用关系层级

**验证方式**:

1. 分析 JS 文件包含 `helper()` 和 `console.log()`，验证 `calls` 包含 `helper`，不包含 `console.log`
2. 分析 Python 文件 `requests.get(url)`，验证 `calls` 包含 `requests.get`
3. 分析包含跨文件导入的文件，验证 `file_path` 正确指向被调用函数所在文件
4. 验证 `CallSymbol` 字段完整：`target`、`file_path`、`line`、`column`
5. 运行 CLI `--format tree`，验证输出包含调用关系树
6. 运行 `npm test`，验证新增测试用例通过
7. 测试递归调用场景（A调用B，B调用C），验证完整调用链提取

---

### BL-CA-13 [P1] 新增类成员提取（Tree-sitter 路径）

**目标**: 补齐 Tree-sitter 路径的类成员提取，使 Python/Go/Rust/Java 输出与 Oxc 路径一致

**涉及范围**:

1. `opencode-memory-plugin/lib/tree-sitter-parser.js`:
   - `extractPythonClasses()` - 添加 `properties`（`self.x` 赋值）
   - `extractGoStructs()` - 添加 `properties`（struct fields）
   - `extractRustStructs()` - 添加 `properties`（struct fields）
   - `extractJavaClasses()` - 添加 `properties`（fields）
   - 新增 `extractGoInterfaces()` - Go interface 提取
   - 新增 `extractRustTraits()` - Rust trait 提取
   - 新增 `extractJavaInterfaces()` - Java interface 提取

**前置依赖**: BL-CA-11（函数元数据补齐，确保 methods 字段格式一致）

**完成标准**:

1. Python 类：提取 `self.xxx = ...` 赋值语句作为 `properties`
2. Go struct：提取字段定义作为 `properties`，提取 interface 定义作为 `interfaces`
3. Rust struct：提取字段定义作为 `properties`，提取 trait 定义作为 `interfaces`
4. Java 类：提取字段定义作为 `properties`，提取 interface 定义作为 `interfaces`
5. 所有 `methods` 字段使用统一的 `FunctionSymbol` 格式（依赖 BL-CA-11）
6. `properties` 字段包含：`name`、`type`（如果有）、`line`

**验证方式**:

1. 分析 Python 类 `class User: def __init__(self): self.name = ""`，验证 `properties` 包含 `name`
2. 分析 Go `type User struct { Name string }`，验证 `properties` 包含 `Name`
3. 分析 Go `type Reader interface { Read() }`，验证输出包含 `interfaces` 数组
4. 分析 Rust `struct User { name: String }`，验证 `properties` 包含 `name`
5. 分析 Rust `trait Readable { fn read(&self); }`，验证输出包含 `interfaces`
6. 分析 Java `class User { private String name; }`，验证 `properties` 包含 `name`
7. 运行 `npm test`，验证所有语言测试通过

---

### BL-CA-14 [P1] 增强 Python/Go/Rust/Java 解析器

**目标**: 增强 Tree-sitter 多语言解析器，使输出结构与 Oxc 路径对齐，补齐缺失字段

**涉及范围**:

1. `opencode-memory-plugin/lib/tree-sitter-parser.js`:
   - 重构 `dependencies` 输出格式（扁平数组 → 分类对象）
   - 新增 `exports` 字段提取
   - 补齐 `ImportSymbol.line` 字段
   - 统一所有语言的输出结构

**前置依赖**:

- BL-CA-11（函数元数据补齐）
- BL-CA-13（类成员提取）

**完成标准**:

1. `dependencies` 分类为：`internal`（相对导入）、`external`（第三方包）、`builtin`（标准库）
2. `exports` 字段正确提取：Python `__all__`、Go 大写导出、Rust `pub`、Java `public`
3. `ImportSymbol` 包含 `line` 字段（导入语句所在行号）
4. 所有语言输出统一结构：`functions`、`classes`、`interfaces`、`imports`、`exports`
5. 向后兼容：旧代码使用扁平 `dependencies` 仍能工作

**验证方式**:

1. 分析 Python 文件 `from .utils import helper` → `dependencies.internal`，`import os` → `dependencies.builtin`
2. 分析 Go 文件 `import "github.com/gin-gonic/gin"` → `dependencies.external`
3. 验证 Python `__all__ = ['func1']` 提取到 `exports: ['func1']`
4. 验证 Go 大写函数名提取到 `exports`
5. 验证 Rust `pub fn` 提取到 `exports`
6. 验证 `ImportSymbol` 包含 `line` 字段且值正确
7. 运行 `npm test`，验证向后兼容（旧测试用例仍通过）

---

### BL-CA-15 [P0] 实现代码复杂度计算（Tree-sitter 路径）

**目标**: Tree-sitter 路径使用 AST 级别圈复杂度计算，替代当前基于函数名的启发式估算

**涉及范围**:

1. `opencode-memory-plugin/lib/tree-sitter-parser.js`:
   - 重写 `calculateBasicComplexity()` → `calculateCyclomaticComplexity()`
   - 新增 AST 遍历逻辑：统计 if/for/while/try/and/or/switch/case
   - 新增 `max_nesting_depth` 计算

**前置依赖**: 无

**完成标准**:

1. 圈复杂度计算：基础值 1 + 决策点数量（if/for/while/try/and/or/switch/case）
2. 支持语言：Python、Go、Rust、Java（统一算法）
3. 嵌套深度计算：函数内最大代码块嵌套层级
4. 输出字段：`complexity`、`max_nesting_depth`
5. 与 Oxc 路径对同一文件的计算结果差异 < 10%
6. 复杂度等级：简单(1-10)、中等(11-20)、复杂(21-50)、极复杂(>50)

**验证方式**:

1. 分析 Python 文件：

   ```python
   def test():
       if x:
           for i in y:
               pass
   ```

   验证 `complexity: 3`（基础1 + if1 + for1）

2. 分析嵌套函数，验证 `max_nesting_depth` 正确（示例：嵌套3层返回3）
3. 对比 Oxc 和 Tree-sitter 对同一 JS 文件的复杂度，差异 < 10%
4. 测试简单函数（无决策点），验证 `complexity: 1`
5. 测试复杂函数（多条件组合），验证复杂度计算正确
6. 运行 `npm test`，验证复杂度相关测试通过

---

### BL-CA-16 [P1] 实现代码质量评分（文件级）

**目标**: 实现文件级代码质量评分，辅助代码审查决策

**涉及范围**:

1. `opencode-memory-plugin/lib/code-analyzer.js`:
   - 新增 `calculateFileQualityScore()` 方法
2. `opencode-memory-plugin/lib/code-analysis-formatter.js`:
   - 表格输出新增"质量评分"列
3. `opencode-memory-plugin/CONFIGURATION.md`:
   - 添加评分阈值配置说明

**前置依赖**:

- BL-CA-15（准确的复杂度计算）
- 项目级健康度评级已实现（`ProjectAnalyzer.calculateGrade()`）

**完成标准**:

1. 文件级评分算法：综合圈复杂度、嵌套深度、函数长度、代码行数
2. 评分等级：A(90-100)、B(70-89)、C(50-69)、D(<50)
3. CLI `--format table` 输出包含质量评分列
4. 评分标准可配置（通过 `memory-config.json`）
5. 评分与项目级健康度评级一致（同一项目内）
6. 提供评分改进建议（如"函数过长，建议拆分"）

**验证方式**:

1. 分析简单文件（短函数、低复杂度），验证评分 ≥ A
2. 分析复杂文件（长函数、高嵌套），验证评分 ≤ C
3. 运行 CLI `--format table`，验证输出包含"质量"列
4. 修改 `memory-config.json` 评分阈值，验证新配置生效
5. 对比同一项目的文件评分和项目级评级，验证一致性
6. 验证评分改进建议准确（如长函数提示拆分）
7. 运行 `npm test`，验证评分算法测试通过

---

## 新增任务

### BL-CA-22 [P0] Agent-Native Backlog API - Phase 1: 基础框架

**目标**: 实现 Backlog 管理的基础框架，支持创建和查询 backlog 条目

**涉及范围**:

1. `opencode-memory-plugin/lib/backlog-api.js` - 新增 Backlog API 模块
2. `opencode-memory-plugin/tools/backlog.js` - 新增 backlog 管理工具
3. 集成 memory_write/memory_read 存储 backlog 条目

**前置依赖**: 无

**完成标准**:

1. Backlog 条目使用 ULID 作为 ID
2. 支持 4 种状态：backlog、in_progress、review、done
3. 支持 Metadata 嵌套存储（零 Schema 变更）
4. 提供 `backlog_create`、`backlog_list`、`backlog_update` 工具
5. 条目存储在 `~/.opencode/memory/backlog/` 目录

**验证方式**:

1. 创建 backlog 条目，验证 ULID ID 生成
2. 更新条目状态，验证状态流转
3. 查询 backlog 列表，验证过滤和排序
4. 验证条目持久化到文件系统

---

### BL-CA-23 [P1] Agent-Native Backlog API - Phase 2: 依赖管理

**目标**: 实现 backlog 条目间的依赖关系管理

**涉及范围**:

1. `opencode-memory-plugin/lib/backlog-api.js`:
   - 新增 `addDependency()`、`removeDependency()` 方法
   - 新增 `getDependencyGraph()` 方法
2. `opencode-memory-plugin/tools/backlog.js`:
   - 新增 `backlog_link` 工具

**前置依赖**: BL-CA-22

**完成标准**:

1. 支持条目间建立依赖关系（阻塞/被阻塞）
2. 检测循环依赖并报错
3. 查询条目时返回依赖列表
4. 可视化依赖图（文本形式）

**验证方式**:

1. 创建两个条目并建立依赖关系
2. 尝试创建循环依赖，验证报错
3. 查询条目，验证依赖列表正确
4. 生成依赖图，验证无环

---

### BL-CA-24 [P1] Agent-Native Backlog API - Phase 3: 优先级与排序

**目标**: 实现 backlog 优先级管理和自动排序

**涉及范围**:

1. `opencode-memory-plugin/lib/backlog-api.js`:
   - 新增优先级计算算法
   - 新增自动排序功能
2. 支持优先级标签：P0、P1、P2、P3

**前置依赖**: BL-CA-22

**完成标准**:

1. 支持手动设置优先级
2. 支持基于依赖关系的自动优先级调整
3. 支持多维度排序：优先级、状态、创建时间
4. 提供 `backlog_prioritize` 工具

**验证方式**:

1. 创建多个条目并设置不同优先级
2. 验证自动排序结果
3. 测试依赖关系对优先级的影响
4. 验证排序稳定性

---

### BL-CA-25 [P2] Agent-Native Backlog API - Phase 4: 统计与报告

**目标**: 实现 backlog 统计分析和报告生成

**涉及范围**:

1. `opencode-memory-plugin/lib/backlog-api.js`:
   - 新增统计计算方法
   - 新增报告生成功能
2. `opencode-memory-plugin/tools/backlog.js`:
   - 新增 `backlog_report` 工具

**前置依赖**: BL-CA-22、BL-CA-23、BL-CA-24

**完成标准**:

1. 统计各状态条目数量
2. 计算完成率、平均完成时间
3. 生成燃尽图数据
4. 支持导出报告为 Markdown

**验证方式**:

1. 创建多个条目并变更状态
2. 生成统计报告，验证数据准确
3. 验证燃尽图数据计算正确
4. 导出 Markdown 报告并验证格式

---

### BL-CA-26 [P2] Agent-Native Backlog API - Phase 5: 集成与优化

**目标**: 集成 backlog 功能到 OpenCode 工作流，优化性能

**涉及范围**:

1. `opencode-memory-plugin/plugin.js`:
   - 集成 backlog 工具到插件
2. `opencode-memory-plugin/agents/`:
   - 新增 backlog 管理 agent
3. 性能优化：缓存、批量操作

**前置依赖**: BL-CA-22、BL-CA-23、BL-CA-24、BL-CA-25

**完成标准**:

1. OpenCode 中可直接使用 backlog 工具
2. 提供专用 agent 管理 backlog
3. 支持批量创建/更新条目
4. 性能：1000 条 backlog 查询 < 100ms

**验证方式**:

1. 在 OpenCode 中测试 backlog 工具
2. 创建 1000 条 backlog 测试性能
3. 验证批量操作功能
4. 测试 agent 交互流程

---

## 任务优先级矩阵

| 任务     | 优先级 | 用户价值 | 技术难度 | 依赖数量 | 推荐顺序 |
| -------- | ------ | -------- | -------- | -------- | -------- |
| BL-8     | P1     | 高       | 中       | 1        | 3        |
| BL-15    | P2     | 中       | 高       | 2        | 8        |
| BL-CA-11 | P0     | 高       | 中       | 0        | 2        |
| BL-CA-12 | P1     | 高       | 中       | 0        | 1        |
| BL-CA-13 | P1     | 中       | 中       | 1        | 4        |
| BL-CA-14 | P1     | 中       | 高       | 2        | 6        |
| BL-CA-15 | P0     | 高       | 中       | 0        | 2        |
| BL-CA-16 | P1     | 中       | 低       | 1        | 5        |
| BL-CA-22 | P0     | 高       | 中       | 0        | 1        |
| BL-CA-23 | P1     | 中       | 中       | 1        | 3        |
| BL-CA-24 | P1     | 中       | 低       | 1        | 4        |
| BL-CA-25 | P2     | 低       | 中       | 3        | 7        |
| BL-CA-26 | P2     | 低       | 高       | 4        | 9        |

---

_文档版本: v1.0_  
_创建时间: 2026-04-08_  
_状态: 待合并到 BACKLOG.md_
