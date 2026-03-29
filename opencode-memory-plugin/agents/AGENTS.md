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

| 代理               | 文件                  | 说明               |
| ------------------ | --------------------- | ------------------ |
| memory-automation  | memory-automation.md  | 自动保存重要信息   |
| memory-consolidate | memory-consolidate.md | 自动合并和组织记忆 |

## 核心功能

- **memory-automation.md**: 自动保存代理配置，负责自动保存重要信息
- **memory-consolidate.md**: 自动合并代理配置，负责整理和归档记忆文件

## 独特约定

- 代理使用markdown格式定义
- 包含自动化记忆管理逻辑
- 与OpenCode框架集成

## 功能详情

|- **memory-automation.md**: 自动保存代理配置，负责自动保存重要信息
|- **memory-consolidate.md**: 自动合并代理配置，负责整理和归档记忆文件

## 重要技术参数 (CRITICAL - PROJECT MEMORY)

|- **向量维度**: 1024 (Qwen3-Embedding-0.6B)
|- **Embedding服务**: ModelScope API (<https://api-inference.modelscope.cn/v1/embeddings>)
|- **备用服务**: localhost:18000/v1/embeddings
|- **向量表**: vec_embeddings (必须使用1024维度)
|- **兼容性**: 旧索引使用384维度会导致维度不匹配错误
|⚠️ **关键警告**: 重建索引前必须删除旧向量表，否则会报错
|- **解决方案**: `rm -f ~/.opencode/memory/vector-index.db` 或调用 clearIndex()

## 技术细节

|- sqlite-vec扩展要求向量表在创建时指定固定维度
|- 向量表使用FLOAT32Array存储embedding
|- 删除并重建向量表是唯一的安全升级路径
|- 外部服务返回格式: `{ data: [{ embedding: [...] }] }`
这些代理在安装时自动注册到OpenCode配置中，无需额外配置即可使用。
