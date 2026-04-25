const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:18008';

module.exports = async () => {
  try {
    const start = Date.now();
    const res = await fetch(`${BACKEND_URL}/api/v1/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memories: [
          {
            content: `[global-setup] embedding warmup ${Date.now()}`,
            type: 'test',
            tags: ['warmup'],
            tenant_id: 'default',
            abstract: 'warmup',
            overview: 'warmup',
          },
        ],
      }),
    });
    if (res.ok) {
      console.log(`\n✅ Global embedding warmup: ${Date.now() - start}ms`);
    } else {
      console.warn(`\n⚠️ Global embedding warmup: HTTP ${res.status}`);
    }
  } catch {
    console.warn('\n⚠️ Global embedding warmup: backend not reachable (non-fatal)');
  }
};
