# 后端 RTM 系统移植指南

> **版本**: v1.0.0  
> **日期**: 2026-04-10  
> **目标**: 将前端 RTM 系统移植到后端 (Python/FastAPI) 项目

---

## 1. 移植概览

### 1.1 前端 vs 后端对比

| 组件 | 前端 (Node.js) | 后端 (Python) | 移植方式 |
|------|----------------|---------------|----------|
| RTM 主文档 | `docs/v3.2/RTM.md` | `docs/RTM.md` | ✅ 直接复制，调整内容 |
| 验收标准 | `docs/v3.2/ACCEPTANCE-CRITERIA.md` | `docs/ACCEPTANCE-CRITERIA.md` | ✅ 直接复制，调整 API 端点 |
| 提交规范 | `docs/COMMIT-CONVENTION.md` | `docs/COMMIT-CONVENTION.md` | ⚠️ 需适配 Python 项目 |
| Agent 工作流 | `docs/AGENT-WORKFLOW.md` | `docs/AGENT-WORKFLOW.md` | ⚠️ 需调整命令 |
| PR 审查规范 | `docs/PR-REVIEW-GUIDELINES.md` | `docs/PR-REVIEW-GUIDELINES.md` | ✅ 直接复制 |
| 每周检查 | `docs/WEEKLY-DESIGN-CHECK.md` | `docs/WEEKLY-DESIGN-CHECK.md` | ✅ 直接复制 |
| 集成脚本 | `scripts/*.js` (Node.js) | `scripts/*.py` (Python) | 🔴 需重写 |
| npm 脚本 | `package.json` | `pyproject.toml` / `Makefile` | 🔴 需重写 |

### 1.2 移植步骤

```
Phase 1: 文档移植 (1小时)
├── 复制并调整文档
└── 创建后端专用 RTM

Phase 2: 脚本开发 (2-3小时)
├── 用 Python 重写集成脚本
├── 适配 pyproject.toml
└── 测试脚本功能

Phase 3: 集成验证 (30分钟)
├── 运行脚本测试
├── 验证 RTM 更新
└── 提交示例验证
```

---

## 2. 文档移植

### 2.1 创建后端文档结构

```bash
embedding_service/
├── docs/
│   ├── RTM.md                    # 后端 RTM 主文档
│   ├── ACCEPTANCE-CRITERIA.md    # 验收标准
│   ├── COMMIT-CONVENTION.md      # 提交规范 (Python适配)
│   ├── AGENT-WORKFLOW.md         # Agent 工作流
│   ├── PR-REVIEW-GUIDELINES.md   # PR 审查规范
│   └── WEEKLY-DESIGN-CHECK.md    # 每周检查
└── scripts/
    ├── opencode_integration.py   # Agent 集成脚本
    ├── update_rtm.py             # RTM 更新脚本
    └── check_design_compliance.py # 设计符合性检查
```

### 2.2 RTM.md 内容调整

**前端 RTM** 追踪的是插件端实现，**后端 RTM** 应该追踪后端服务实现：

| 模块 | 前端追踪 | 后端追踪 |
|------|----------|----------|
| WebSocket | `lib/ws-client.js` | `src/websocket/server.py` |
| PrecomputeService | `lib/code-analysis-service.js` | `src/services/precompute.py` |
| Database Schema | 使用后端 Schema | `src/db/migrations/` |
| API | 调用后端 API | `src/routers/*.py` |
| Deployment | Docker 客户端 | Docker 服务端 + K8s |
| Dependencies | npm packages | pip packages |

**后端 RTM 示例**:

```markdown
## 1. WebSocket 服务端模块

| 设计ID | 设计文档 | 功能点 | 代码位置 | 测试文件 | 状态 | 风险 |
|--------|----------|--------|----------|----------|------|------|
| WS-SRV-001 | BACKEND-v3.2-WEBSOCKET.md | 心跳处理 30s | `src/websocket/server.py` | `tests/test_websocket.py` | ⏳ | 🔴 高 |
| WS-SRV-002 | BACKEND-v3.2-WEBSOCKET.md | 连接池管理 | `src/websocket/pool.py` | `tests/test_websocket.py` | ⏳ | 🔴 高 |
| WS-SRV-003 | BACKEND-v3.2-WEBSOCKET.md | ACK 确认机制 | `src/websocket/ack.py` | `tests/test_websocket.py` | ⏳ | 🔴 高 |
```

---

## 3. 脚本移植（Python 实现）

### 3.1 opencode_integration.py

```python
#!/usr/bin/env python3
"""
OpenCode Agent 集成脚本 (Python版)

功能：
1. 自动解析 Agent 的提交信息，提取 Design-Ref
2. 自动更新 RTM 状态
3. 生成提交建议

Usage: python scripts/opencode_integration.py <action> [options]
"""

import os
import sys
import subprocess
import re
from pathlib import Path
from typing import List, Dict, Optional

RTM_FILE = Path(__file__).parent.parent / "docs" / "RTM.md"
DESIGN_DOCS_DIR = Path(__file__).parent.parent / "docs"


class Colors:
    """终端颜色"""
    INFO = "\033[36mℹ️\033[0m"
    SUCCESS = "\033[32m✅\033[0m"
    WARNING = "\033[33m⚠️\033[0m"
    ERROR = "\033[31m❌\033[0m"
    AGENT = "\033[35m🤖\033[0m"


def log(message: str, type_: str = "info"):
    """打印日志"""
    prefix = getattr(Colors, type_.upper(), Colors.INFO)
    print(f"{prefix} {message}")


def get_changed_files() -> List[str]:
    """获取变更的文件列表"""
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        return [f for f in result.stdout.strip().split("\n") if f]
    except Exception as e:
        log(f"Failed to get changed files: {e}", "error")
        return []


def analyze_changes(files: List[str]) -> Dict:
    """分析变更类型"""
    analysis = {
        "type": "feat",
        "module": "",
        "description": "",
        "files": files
    }
    
    for file in files:
        if "test" in file:
            analysis["type"] = "test"
        elif "docs" in file:
            analysis["type"] = "docs"
        elif "fix" in file or "bug" in file:
            analysis["type"] = "fix"
        
        if "websocket" in file:
            analysis["module"] = "websocket"
        elif "precompute" in file:
            analysis["module"] = "precompute"
        elif "schema" in file or "migration" in file:
            analysis["module"] = "schema"
    
    return analysis


def find_related_design_docs(analysis: Dict) -> List[str]:
    """查找相关设计文档"""
    refs = []
    module = analysis.get("module", "")
    
    module_to_doc = {
        "websocket": "BACKEND-v3.2-WEBSOCKET.md",
        "precompute": "BACKEND-v3.2-PRECOMPUTE.md",
        "schema": "DATABASE-v3.2-SCHEMA.md",
    }
    
    if module in module_to_doc:
        refs.append(module_to_doc[module])
    
    return refs


def generate_commit_suggestion(analysis: Dict, refs: List[str]) -> str:
    """生成提交建议"""
    type_ = analysis["type"]
    module = analysis["module"]
    files = analysis["files"]
    
    suggestion = f"""{type_}({module}): 简短描述

详细描述（可选）:
- 说明变更原因
- 说明实现方式

Design-Ref:"""
    
    for ref in refs:
        suggestion += f"\n  - {ref}"
    
    suggestion += "\n\n变更文件:\n"
    for file in files[:5]:  # 最多显示5个文件
        suggestion += f"  - {file}\n"
    
    return suggestion


def suggest_commit():
    """为 Agent 生成提交建议"""
    log("Analyzing changes for commit suggestion...", "agent")
    
    files = get_changed_files()
    if not files:
        log("No changes detected", "warning")
        return
    
    log(f"Changed files: {len(files)}", "info")
    
    analysis = analyze_changes(files)
    refs = find_related_design_docs(analysis)
    suggestion = generate_commit_suggestion(analysis, refs)
    
    print("\n" + "="*60)
    print("🤖 OpenCode Agent Commit Suggestion")
    print("="*60)
    print("\nSuggested commit message:")
    print("-"*60)
    print(suggestion)
    print("-"*60)
    print("\nTo use this suggestion:")
    print("  1. Review the Design-Ref links")
    print("  2. Adjust the description if needed")
    print("  3. Commit with: git commit -m \"<message>\"")
    print("="*60 + "\n")


def update_rtm():
    """更新 RTM"""
    log("Updating RTM...", "agent")
    # TODO: 实现 RTM 更新逻辑
    log("RTM update not yet implemented", "warning")


def verify_design():
    """验证设计符合性"""
    log("Verifying design compliance...", "agent")
    # TODO: 实现验证逻辑
    log("Design verification not yet implemented", "warning")


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("Usage: python opencode_integration.py <action>")
        print("Actions: suggest-commit, update-rtm, verify-design")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == "suggest-commit":
        suggest_commit()
    elif action == "update-rtm":
        update_rtm()
    elif action == "verify-design":
        verify_design()
    else:
        log(f"Unknown action: {action}", "error")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

### 3.2 update_rtm.py

```python
#!/usr/bin/env python3
"""
RTM 自动更新脚本 (Python版)

Usage: python scripts/update_rtm.py [options]
Options:
  --commit <hash>    指定提交哈希
  --dry-run          预览变更，不实际修改
  --check            检查 RTM 状态
"""

import os
import sys
import subprocess
import re
from pathlib import Path
from typing import List, Dict, Optional
import argparse

RTM_FILE = Path(__file__).parent.parent / "docs" / "RTM.md"


class RTMUpdater:
    def __init__(self, options: Dict = None):
        self.options = options or {}
        self.rtm_content = ""
        self.changes = []
    
    def log(self, message: str, type_: str = "info"):
        """打印日志"""
        prefix = {
            "info": "ℹ️",
            "success": "✅",
            "warning": "⚠️",
            "error": "❌"
        }.get(type_, "ℹ️")
        print(f"{prefix} {message}")
    
    def load_rtm(self):
        """加载 RTM 文件"""
        if not RTM_FILE.exists():
            raise FileNotFoundError(f"RTM file not found: {RTM_FILE}")
        self.rtm_content = RTM_FILE.read_text(encoding="utf-8")
    
    def save_rtm(self):
        """保存 RTM 文件"""
        if self.options.get("dry_run"):
            self.log("Dry run mode - not saving changes", "warning")
            return
        RTM_FILE.write_text(self.rtm_content, encoding="utf-8")
        self.log("RTM updated successfully", "success")
    
    def get_recent_commits(self, count: int = 10) -> List[Dict]:
        """获取最近的提交"""
        try:
            result = subprocess.run(
                ["git", "log", f"--pretty=format:%H|%s|%b", f"-{count}"],
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent.parent
            )
            
            commits = []
            for line in result.stdout.strip().split("\n"):
                if "|" in line:
                    parts = line.split("|")
                    commits.append({
                        "hash": parts[0],
                        "subject": parts[1],
                        "body": "|".join(parts[2:]) if len(parts) > 2 else ""
                    })
            return commits
        except Exception as e:
            self.log(f"Failed to get commits: {e}", "error")
            return []
    
    def extract_design_refs(self, message: str) -> List[str]:
        """从提交信息中提取 Design-Ref"""
        refs = []
        pattern = r"Design-Ref:\s*([^\n]+)"
        for match in re.finditer(pattern, message):
            refs.append(match.group(1).strip())
        return refs
    
    def check_rtm(self):
        """检查 RTM 状态"""
        self.log("Checking RTM status...", "info")
        
        if not RTM_FILE.exists():
            self.log("RTM.md not found", "error")
            return
        
        content = RTM_FILE.read_text(encoding="utf-8")
        
        # 统计状态
        pending = len(re.findall(r"⏳", content))
        in_progress = len(re.findall(r"🔄", content))
        warning = len(re.findall(r"⚠️", content))
        completed = len(re.findall(r"✅", content))
        cancelled = len(re.findall(r"❌", content))
        
        total = pending + in_progress + warning + completed + cancelled
        completion_rate = (completed / total * 100) if total > 0 else 0
        
        print("\n" + "="*60)
        print("📊 RTM Status Summary")
        print("="*60)
        print(f"Total Items: {total}")
        print(f"  ⏳ Pending: {pending}")
        print(f"  🔄 In Progress: {in_progress}")
        print(f"  ⚠️ Warning: {warning}")
        print(f"  ✅ Completed: {completed}")
        print(f"  ❌ Cancelled: {cancelled}")
        print(f"Completion Rate: {completion_rate:.1f}%")
        print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="RTM Updater")
    parser.add_argument("--commit", help="指定提交哈希")
    parser.add_argument("--dry-run", action="store_true", help="预览变更")
    parser.add_argument("--check", action="store_true", help="检查 RTM 状态")
    
    args = parser.parse_args()
    
    updater = RTMUpdater(vars(args))
    
    if args.check:
        updater.check_rtm()
    else:
        updater.log("RTM update not yet fully implemented", "warning")
        updater.check_rtm()


if __name__ == "__main__":
    main()
```

### 3.3 check_design_compliance.py

```python
#!/usr/bin/env python3
"""
设计符合性检查脚本 (Python版)

Usage: python scripts/check_design_compliance.py [options]
Options:
  --rtm          检查RTM更新状态
  --api          检查API实现完整性
  --coverage     检查代码覆盖率
  --all          运行所有检查
"""

import os
import sys
import subprocess
import re
from pathlib import Path
import argparse

DESIGN_DOCS_DIR = Path(__file__).parent.parent / "docs"
RTM_FILE = DESIGN_DOCS_DIR / "RTM.md"


class DesignComplianceChecker:
    def __init__(self):
        self.results = []
        self.exit_code = 0
    
    def log(self, message: str, type_: str = "info"):
        """打印日志"""
        prefix = {
            "info": "ℹ️",
            "success": "✅",
            "warning": "⚠️",
            "error": "❌"
        }.get(type_, "ℹ️")
        print(f"{prefix} {message}")
    
    def check_rtm(self):
        """检查 RTM 状态"""
        self.log("Checking RTM status...", "info")
        
        if not RTM_FILE.exists():
            self.log("RTM.md not found", "error")
            self.exit_code = 1
            return
        
        content = RTM_FILE.read_text(encoding="utf-8")
        
        # 统计状态
        pending = len(re.findall(r"⏳", content))
        in_progress = len(re.findall(r"🔄", content))
        warning = len(re.findall(r"⚠️", content))
        completed = len(re.findall(r"✅", content))
        cancelled = len(re.findall(r"❌", content))
        
        total = pending + in_progress + warning + completed + cancelled
        completion_rate = (completed / total * 100) if total > 0 else 0
        
        self.log(f"RTM Status: {completed}/{total} completed ({completion_rate:.1f}%)", "info")
        self.log(f"  - Pending: {pending}", "info")
        self.log(f"  - In Progress: {in_progress}", "info")
        self.log(f"  - Warning: {warning}", "info")
        self.log(f"  - Completed: {completed}", "success")
        self.log(f"  - Cancelled: {cancelled}", "info")
        
        if pending > 0:
            self.log(f"{pending} items still pending", "warning")
    
    def check_api(self):
        """检查 API 实现"""
        self.log("Checking API implementation...", "info")
        # TODO: 实现 API 检查逻辑
        self.log("API check not yet implemented", "warning")
    
    def check_coverage(self):
        """检查代码覆盖率"""
        self.log("Checking code coverage...", "info")
        # TODO: 实现覆盖率检查逻辑
        self.log("Coverage check not yet implemented", "warning")
    
    def run_all(self):
        """运行所有检查"""
        self.check_rtm()
        self.check_api()
        self.check_coverage()
        
        print("\n" + "="*60)
        if self.exit_code == 0:
            self.log("All checks passed!", "success")
        else:
            self.log("Some checks failed", "error")
        print("="*60)
        
        return self.exit_code


def main():
    parser = argparse.ArgumentParser(description="Design Compliance Checker")
    parser.add_argument("--rtm", action="store_true", help="检查RTM状态")
    parser.add_argument("--api", action="store_true", help="检查API实现")
    parser.add_argument("--coverage", action="store_true", help="检查代码覆盖率")
    parser.add_argument("--all", action="store_true", help="运行所有检查")
    
    args = parser.parse_args()
    
    checker = DesignComplianceChecker()
    
    if args.all:
        sys.exit(checker.run_all())
    elif args.rtm:
        checker.check_rtm()
    elif args.api:
        checker.check_api()
    elif args.coverage:
        checker.check_coverage()
    else:
        # 默认运行 RTM 检查
        checker.check_rtm()


if __name__ == "__main__":
    main()
```

---

## 4. pyproject.toml 配置

在 `embedding_service/pyproject.toml` 中添加：

```toml
[project]
name = "embedding-service"
version = "3.2.0"
description = "OpenCode Memory Plugin Backend Service"

[project.scripts]
# RTM 脚本
rtm-suggest = "scripts.opencode_integration:suggest_commit"
rtm-update = "scripts.update_rtm:main"
rtm-check = "scripts.check_design_compliance:main"

[tool.hatch.scripts]
# 开发脚本
suggest-commit = "python scripts/opencode_integration.py suggest-commit"
rtm-update = "python scripts/update_rtm.py --all"
rtm-check = "python scripts/update_rtm.py --check"
weekly-check = "python scripts/update_rtm.py --check && python scripts/check_design_compliance.py --all"
```

或者使用 Makefile：

```makefile
# Makefile
.PHONY: suggest-commit rtm-update rtm-check weekly-check

suggest-commit:
	python scripts/opencode_integration.py suggest-commit

rtm-update:
	python scripts/update_rtm.py --all

rtm-check:
	python scripts/update_rtm.py --check

weekly-check:
	python scripts/update_rtm.py --check
	python scripts/check_design_compliance.py --all
```

---

## 5. 快速开始

### 5.1 一键移植脚本

创建 `scripts/port-rtm.sh`：

```bash
#!/bin/bash
# 一键移植 RTM 系统到后端

echo "🚀 Porting RTM system to backend..."

# 1. 创建目录结构
mkdir -p embedding_service/docs
mkdir -p embedding_service/scripts

# 2. 复制并调整文档
echo "📄 Copying documents..."
cp docs/v3.2/RTM.md embedding_service/docs/RTM.md
cp docs/v3.2/ACCEPTANCE-CRITERIA.md embedding_service/docs/
cp docs/PR-REVIEW-GUIDELINES.md embedding_service/docs/
cp docs/WEEKLY-DESIGN-CHECK.md embedding_service/docs/

# 3. 创建 Python 脚本
echo "🐍 Creating Python scripts..."
# (将上面的 Python 脚本保存到对应文件)

# 4. 初始化完成
echo "✅ RTM system ported successfully!"
echo ""
echo "Next steps:"
echo "  1. Review and adjust docs/RTM.md for backend-specific items"
echo "  2. Test scripts: python scripts/opencode_integration.py suggest-commit"
echo "  3. Add to pyproject.toml or Makefile"
```

### 5.2 使用示例

```bash
# 进入后端目录
cd embedding_service

# 获取提交建议
python scripts/opencode_integration.py suggest-commit

# 检查 RTM 状态
python scripts/update_rtm.py --check

# 更新 RTM
python scripts/update_rtm.py --all

# 运行每周检查
python scripts/update_rtm.py --check && python scripts/check_design_compliance.py --all
```

---

## 6. 前后端 RTM 协作

### 6.1 设计文档关联

前端和后端的 RTM 应该关联到同一套设计文档：

```
docs/v3.2/
├── UNIFIED-ARCHITECTURE-v3.2.md    # 共享
├── BACKEND-v3.2-WEBSOCKET.md       # 共享
├── BACKEND-v3.2-PRECOMPUTE.md      # 共享
├── DATABASE-v3.2-SCHEMA.md         # 共享
├── PLUGIN-v3.2-IMPLEMENTATION.md   # 前端实现参考
└── BACKEND-v3.2-IMPLEMENTATION.md  # 后端实现参考
```

### 6.2 提交信息关联

前端提交：
```
feat(websocket): add heartbeat mechanism

Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
Closes: BL-CA-36
```

后端提交：
```
feat(websocket): implement heartbeat handler

Design-Ref: BACKEND-v3.2-WEBSOCKET.md#3.1-心跳机制
Closes: BL-CA-36
```

同一个 Design-Ref，前后端分别实现各自的职责。

---

## 7. 总结

移植 RTM 系统到后端需要：

1. **文档**（30分钟）：复制并调整 6 个文档
2. **脚本**（2-3小时）：用 Python 重写 3 个脚本
3. **配置**（30分钟）：添加到 pyproject.toml 或 Makefile
4. **测试**（30分钟）：验证脚本功能

**总计**：约 4 小时完成移植。

要我帮你实际执行这个移植吗？我可以：
1. 创建所有文档
2. 编写 Python 脚本
3. 配置 pyproject.toml
4. 测试验证