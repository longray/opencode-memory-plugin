# agents/ - 自定义代理模块指南

**生成时间**: 2026-02-28  
**目录**: opencode-memory-plugin/agents/

## 概述
自定义OpenCode代理目录，包含自动保存和自动合并代理配置。

## 结构
```
agents/
├── memory-automation.md    # 自动保存代理
└── memory-consolidate.md   # 自动合并代理
```

## WHERE TO LOOK
| 代理 | 文件 | 说明 |
|------|------|------|
| memory-automation | memory-automation.md | 自动保存重要信息 |
| memory-consolidate | memory-consolidate.md | 自动合并和组织记忆 |

## 核心功能
- **memory-automation.md**: 自动保存代理配置，负责自动保存重要信息
- **memory-consolidate.md**: 自动合并代理配置，负责整理和归档记忆文件

## 独特约定
- 代理使用markdown格式定义
- 包含自动化记忆管理逻辑
- 与OpenCode框架集成

## 配置
这些代理在安装时自动注册到OpenCode配置中，无需额外配置即可使用。