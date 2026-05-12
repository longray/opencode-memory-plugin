## Why

开发阶段需要实时质量监控和SOP执行能力，而非等待周期性任务。当前质量监控和SOPs是批处理模式（每周/每月/每季度），无法满足开发时"随时查看状态、立即执行修复"的需求。需要构建一个交互式质量仪表板和即时SOP执行工具，让开发者在编码过程中随时检查知识图谱健康度、一键执行SOP修复、实时查看优化效果。

## What Changes

- **构建实时质量仪表板**：CLI工具 `opencode-memory quality-dashboard`，实时显示知识图谱健康度、搜索质量、关系网络状态
- **实现即时SOP执行**：CLI命令 `opencode-memory sop run <sop-name>`，立即执行指定SOP并显示结果
- **开发阶段质量守护**：在关键操作后自动触发质量检查（如memory_write后检查孤立实体）
- **一键修复功能**：`opencode-memory fix <issue-type>`，自动诊断并修复常见问题（孤立实体、低权重关系等）
- **实时通知机制**：开发时发现问题立即通知（如"检测到3个孤立实体，建议运行 sop run isolated-entities"）
- **质量趋势可视化**：显示最近7天质量指标变化趋势

## Capabilities

### New Capabilities

- `real-time-quality-dashboard`: 实时质量仪表板CLI工具，显示当前知识图谱健康状态
- `instant-sop-execution`: 即时SOP执行引擎，支持单条SOP立即运行
- `dev-phase-quality-guard`: 开发阶段质量守护，关键操作后自动质量检查
- `one-click-fix`: 一键修复工具，自动诊断并修复常见问题
- `quality-trend-visualization`: 质量趋势可视化，显示7天变化趋势

### Modified Capabilities

- 无现有能力修改

## Impact

- **开发工作流**: 编码过程中可随时检查质量，无需等待周期性任务
- **CLI工具**: 新增 `quality-dashboard`、`sop run`、`fix` 命令
- **插件端**: 关键操作后自动触发轻量级质量检查
- **知识图谱质量**: 问题发现时间从天级缩短到分钟级
