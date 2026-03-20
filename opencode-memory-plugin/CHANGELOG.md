# Changelog

## [Unreleased]

### Changed
- **自动触发逻辑优化**：改为检查新增消息数（>=8条）和新增用户消息数（>=5条），而不是总消息数。冷却期后需要累积足够新消息才会再次触发
- **提示词优化**：改为中文，避开analyze-mode触发词。新提示词："识别对话中的重要信息并保存：用户偏好、决策、成功方案、项目约定、经验教训。使用memory_write工具保存。"
- **超时时间调整**：auto_trigger.timeout_ms从5秒增加到30秒，减少超时错误

### Added
- **debug_logging开关**：添加auto_trigger.debug_logging配置项（默认false），控制调试日志输出到~/.opencode/memory/auto-trigger.log

### Removed
- **移除project-resolver日志代码**：删除所有debugLog函数和调用，清理临时调试代码

### Fixed
- **修复debugLog未定义错误**：删除project-resolver.js中残留的debugLog调用
- **修复重复触发问题**：失败时也标记session为已处理，避免一直重复触发

---

## Previous Versions

See git history for older changes.
