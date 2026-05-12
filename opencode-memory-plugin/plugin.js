import { tool } from '@opencode-ai/plugin/tool';
import {
  memory_write,
  memory_pin,
  entity_update,
  entity_atoms,
  load_context_budget,
  load_context_level,
} from './tools/core.js';
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
import { getWebSocketUrl } from './lib/config.js';
import { ReliableWebSocketClient } from './lib/websocket/reliable-client.js';
import { ScheduledHealthCheck } from './lib/scheduled-health-check.js';
import { WS_HEARTBEAT_INTERVAL_MS, WS_RECONNECT_BASE_DELAY_MS } from './lib/constants.js';

let _wsClient = null;

export const getWebSocketClient = () => _wsClient;

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

  // WebSocket real-time sync
  const wsUrl = getWebSocketUrl();
  const apiKey = process.env.WRAPPER_MEILI_API_KEY || config.apiKey || null;
  const wsEnabled = config.websocket?.enabled !== false;

  if (wsEnabled && wsUrl) {
    try {
      _wsClient = new ReliableWebSocketClient(wsUrl, {
        tenantId: config.backend?.tenant_id || 'default',
        token: apiKey,
        heartbeatInterval: config.websocket?.heartbeatInterval || WS_HEARTBEAT_INTERVAL_MS,
        reconnectMaxAttempts: config.websocket?.reconnectMaxAttempts || 10,
        reconnectBaseDelay: config.websocket?.reconnectBaseDelay || WS_RECONNECT_BASE_DELAY_MS,
      });

      _wsClient.on('connected', data => {
        console.log(`[MemoryPlugin] WebSocket connected, session: ${data.sessionId}`);
      });

      _wsClient.on('memory_changed', data => {
        console.log(
          `[MemoryPlugin] Memory changed: ${data.action} (${data.memoryId || 'unknown'})`
        );
      });

      _wsClient.on('disconnected', data => {
        console.log(`[MemoryPlugin] WebSocket disconnected: ${data.code}`);
      });

      _wsClient.on('error', data => {
        console.error(`[MemoryPlugin] WebSocket error: ${data.error}`);
      });

      _wsClient.connect();
      console.log(`[MemoryPlugin] WebSocket connecting to ${wsUrl}...`);
    } catch (err) {
      console.error('[MemoryPlugin] WebSocket init failed:', err.message);
    }
  } else {
    console.log('[MemoryPlugin] WebSocket disabled');
  }

  // Scheduled health check
  const healthCheck = new ScheduledHealthCheck(config);
  healthCheck.start();

  process.on('exit', () => {
    healthCheck.stop();
  });

  return {
    tool: {
      memory_write,
      memory_read,
      memory_pin,
      entity_update,
      entity_atoms,
      load_context_budget,
      load_context_level,
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
