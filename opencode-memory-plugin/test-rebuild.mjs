import('./plugin.js').then(async ({ MemoryPlugin }) => {
  const plugin = await MemoryPlugin({});

  // Test rebuild_index with debug
  const r = await plugin.tools.rebuild_index.execute({ force: true });
  console.log('rebuild_index result:');
  console.log(JSON.stringify(r, null, 2));
});
