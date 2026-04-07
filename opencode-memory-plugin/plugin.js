import { tool } from '@opencode-ai/plugin/tool';
import { memory_write, memory_pin } from './tools/core.js';
import { memory_search, memory_suggest } from './tools/search.js';
import { memory_relate, memory_graph } from './tools/graph.js';
import { memory_timeline, memory_topics } from './tools/browse.js';
import {
  rebuild_index,
  index_status,
  incremental_sync,
  full_sync,
  conflict_list,
  conflict_resolve,
  sync_checkpoint,
} from './tools/sync.js';
import { onFileSaved } from './lib/code-analysis-service.js';
import { startFileWatcher } from './lib/file-watcher.js';
import { getConfig } from './lib/storage.js';

const memory_read = tool({
  description: 'Read from a memory file with level support',
  args: {
    entry_id: tool.schema.string().describe('Entry ID (required)'),
    level: tool.schema.number().optional().default(2).describe('0=abstract, 1=overview, 2=full'),
  },
  async execute(args) {
    const { readMemory } = await import('./lib/memory-core.js');

    const result = await readMemory({
      entry_id: args.entry_id,
      level: args.level !== undefined ? args.level : 2,
    });

    if (!result.success) {
      return result.message;
    }

    return result.content;
  },
});

export const MemoryPlugin = async ctx => {
  const projectRoot = process.cwd();
  const config = getConfig();
  const codeAnalysisConfig = config.code_analysis || {};
  const autoTrigger = codeAnalysisConfig.auto_trigger !== false;

  // 注册文件保存事件监听器，自动触发代码分析
  if (autoTrigger) {
    if (ctx?.on) {
      // OpenCode 事件监听（首选）
      ctx.on('file.saved', filePath => {
        onFileSaved(filePath, projectRoot);
      });
      console.log('[MemoryPlugin] Code analysis file watcher enabled (OpenCode event)');
    } else {
      // 文件系统监听（fallback）
      startFileWatcher(projectRoot);
      console.log('[MemoryPlugin] Code analysis file watcher enabled (filesystem)');
    }
  } else {
    console.log('[MemoryPlugin] Code analysis auto-trigger disabled');
  }

  return {
    tool: {
      memory_write,
      memory_read,
      memory_pin,
      memory_search,
      memory_suggest,
      memory_relate,
      memory_graph,
      memory_timeline,
      memory_topics,
      rebuild_index,
      index_status,
      incremental_sync,
      full_sync,
      conflict_list,
      conflict_resolve,
      sync_checkpoint,
    },
  };
};

export default MemoryPlugin;
