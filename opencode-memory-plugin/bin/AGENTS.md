# bin/ - CLI和安装脚本模块指南

**生成时间**: 2026-02-28  
**目录**: opencode-memory-plugin/bin/

## 概述

CLI和安装脚本目录，包含命令行工具和npm安装钩子。

## 结构

```
bin/
├── cli.cjs         # 命令行界面
└── install.cjs     # npm安装钩子
```

## WHERE TO LOOK

| 功能       | 文件        | 说明                      |
| ---------- | ----------- | ------------------------- |
| 命令行工具 | cli.cjs     | opencode-memory命令实现   |
| 安装脚本   | install.cjs | npm install自动执行的脚本 |

## 核心功能

- **cli.cjs**: 提供命令行接口 `opencode-memory`
- **install.cjs**: npm安装时自动运行，创建记忆文件目录结构

## 独特约定

- 使用CommonJS模块格式(.cjs)
- install.cjs会在npm install时自动运行
- cli.cjs提供命令行工具入口

## 命令

```bash
# 安装时自动运行
npm install -g @csuwl/opencode-memory-plugin

# CLI工具使用
opencode-memory write "some content" --type "preference"
opencode-memory search "query"
```
