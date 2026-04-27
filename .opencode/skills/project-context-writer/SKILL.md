---
name: project-context-writer
description: 为存量项目生成 OpenSpec 的 project.md，自动扫描代码、识别技术栈、总结技术债务
---

# 存量项目上下文生成器

当用户需要为已有项目创建或更新 `openspec/project.md` 时，按以下流程执行：

## Phase 1：现状扫描（调用 Superpowers brainstorming）
1. 使用 skill 工具加载 `superpowers/brainstorming`
2. 扫描项目根目录，读取所有配置文件：
   - Python: pyproject.toml, requirements.txt, setup.py
   - Node: package.json, package-lock.json
   - Docker: Dockerfile, docker-compose.yml
   - CI/CD: .github/workflows/, .gitlab-ci.yml
   - 环境: .env.example, .envrc
3. 分析 src/ app/ lib/ 目录结构，识别主要模块
4. 查找测试配置（pytest.ini, jest.config, tox.ini 等）
5. 查找 lint/format 配置（.flake8, .prettierrc, pyproject.toml [tool.black] 等）

## Phase 2：技术债务识别（调用 Superpowers systematic-debugging）
1. 使用 skill 工具加载 `superpowers/systematic-debugging`
2. 扫描代码中的常见债务信号：
   - TODO/FIXME/HACK 注释
   - 硬编码值
   - 重复代码块
   - 缺少类型注解的函数
   - 过时的依赖版本
   - 未处理的异常
3. 总结为结构化的技术债务列表

## Phase 3：内容组织（调用 Superpowers writing-plans）
1. 使用 skill 工具加载 `superpowers/writing-plans`
2. 按以下结构组织 project.md：
   - 项目概述（一句话）
   - 技术栈（精确到版本号）
   - 目录结构
   - 核心模块及职责
   - 数据模型（现有 Entity/Atom 等）
   - 编码规范（从配置推断）
   - 已知技术债务（Phase 2 结果）
   - 部署方式
   - 测试策略

## Phase 4：输出
1. 将生成的内容写入 `openspec/project.md`
2. 如果文件已存在，先读取旧内容，做增量更新（保留用户手动添加的部分）
3. 报告生成摘要：识别了多少模块、多少技术债务、更新了哪些章节
