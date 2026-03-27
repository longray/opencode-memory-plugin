export const pluginInfo = {
  name: '@csuwl/opencode-memory-plugin',
  version: '2.0.0',
  description: 'OpenClaw-style memory system with backend SurrealDB integration',

  memoryDir: '~/.opencode/memory/',

  tools: [
    'memory_write',
    'memory_read',
    'memory_search',
    'rebuild_index',
    'index_status',
    'memory_relate',
    'memory_graph',
  ],

  agents: ['@memory-automation', '@memory-consolidate'],
};

export default pluginInfo;
