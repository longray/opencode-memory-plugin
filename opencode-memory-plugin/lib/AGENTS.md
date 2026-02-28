# lib/ - 核心库模块指南

**生成时间**: 2026-02-28  
**目录**: opencode-memory-plugin/lib/

## 概述
核心库文件目录，包含向量存储、BM25搜索算法和外部服务验证等关键功能。

## 结构
```
lib/
├── vector-store.js    # 向量存储和外部API集成
├── bm25.js           # BM25关键词搜索算法  
└── service-validator.js # 外部服务验证工具
```

## WHERE TO LOOK
| 功能 | 文件 | 说明 |
|------|------|------|
| 向量存储 | vector-store.js | 外部API集成、搜索算法 |
| 关键词搜索 | bm25.js | BM25算法实现 |
| 服务验证 | service-validator.js | 外部服务可用性检查 |

## 核心功能
- **vector-store.js**: 实现向量存储和外部embedding服务调用，包含搜索算法
- **bm25.js**: BM25关键词搜索算法实现，提供回退搜索能力
- **service-validator.js**: 外部服务验证工具

## 独特约定
- 使用fetch进行外部API调用
- 支持多种embedding服务响应格式
- 自动降级到BM25搜索当外部服务不可用

## 命令
```bash
# 测试外部服务连接
node test-external-embedding.mjs
```