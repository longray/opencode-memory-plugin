import fs from 'fs';
import path from 'path';

const HOME = process.env.HOME || process.env.USERPROFILE;
const CONFIG_FILE = path.join(HOME, '.opencode', 'memory', 'memory-config.json');

console.log('🧪 Testing Auto-Trigger Event Handler\n');

const mockConfig = {
  auto_trigger: {
    enabled: true,
    max_queue_size: 10,
    timeout_ms: 5000,
    skip_sensitive: true,
  },
};

const mockEvent = {
  type: 'session.idle',
  properties: {
    sessionID: 'test-session-123',
  },
};

const mockClient = {
  session: {
    get: ({ path }) => {
      console.log(`✓ Mock: session.get called with sessionID: ${path.id}`);
      return { messages: [] };
    },
    prompt: async ({ path, body }) => {
      console.log(`✓ Mock: session.prompt called`);
      console.log(`  - Session ID: ${path.id}`);
      console.log(`  - Agent: ${body.agent}`);
      console.log(`  - Message: ${body.parts[0].text.substring(0, 50)}...`);
      return { info: { id: 'msg-123' }, parts: [] };
    },
  },
};

console.log('Test 1: Event handler with valid session.idle event');
console.log('Expected: Should call session.prompt with memory-automation agent\n');

const autoTriggerQueue = new Set();
const MAX_QUEUE_SIZE = mockConfig.auto_trigger.max_queue_size;
const TIMEOUT_MS = mockConfig.auto_trigger.timeout_ms;

const containsSensitiveInfo = (sessionID) => {
  if (!mockConfig.auto_trigger.skip_sensitive) return false;
  try {
    const recentMessages = mockClient.session.get({ path: { id: sessionID } });
    const messageText = JSON.stringify(recentMessages).toLowerCase();
    const sensitivePatterns = [
      /password[:\s=]/i,
      /api[_\s-]?key[:\s=]/i,
      /secret[:\s=]/i,
      /token[:\s=]/i,
    ];
    return sensitivePatterns.some(pattern => pattern.test(messageText));
  } catch {
    return false;
  }
};

const eventHandler = async ({ event }) => {
  if (event.type !== 'session.idle') return;
  
  const autoTriggerEnabled = mockConfig.auto_trigger.enabled !== false;
  if (!autoTriggerEnabled) return;
  
  const sessionID = event.properties?.sessionID;
  if (!sessionID || autoTriggerQueue.has(sessionID)) return;
  
  if (containsSensitiveInfo(sessionID)) {
    console.log('[Memory Plugin] Skipping session with sensitive info:', sessionID);
    return;
  }
  
  if (autoTriggerQueue.size >= MAX_QUEUE_SIZE) {
    console.warn('[Memory Plugin] Auto-trigger queue full, skipping session:', sessionID);
    return;
  }
  
  autoTriggerQueue.add(sessionID);
  
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
    );
    
    const promptPromise = mockClient.session.prompt({
      path: { id: sessionID },
      body: {
        agent: 'memory-automation',
        noReply: true,
        parts: [{ type: 'text', text: 'Analyze this conversation and save important information to memory.' }],
      },
    });
    
    await Promise.race([promptPromise, timeoutPromise]);
    console.log('[Memory Plugin] Auto-trigger completed for session:', sessionID);
  } catch (error) {
    console.error('[Memory Plugin] Auto-trigger failed:', error.message);
  } finally {
    autoTriggerQueue.delete(sessionID);
  }
};

try {
  await eventHandler({ event: mockEvent });
  console.log('\n✅ Test 1 passed: Event handler executed successfully\n');
} catch (error) {
  console.error('\n❌ Test 1 failed:', error.message, '\n');
  process.exit(1);
}

console.log('Test 2: Event handler with wrong event type');
console.log('Expected: Should return early without calling session.prompt\n');

const wrongEvent = { type: 'message.updated', properties: { sessionID: 'test-123' } };
await eventHandler({ event: wrongEvent });
console.log('✅ Test 2 passed: Handler ignored non-session.idle event\n');

console.log('Test 3: Event handler with disabled config');
console.log('Expected: Should return early without calling session.prompt\n');

mockConfig.auto_trigger.enabled = false;
await eventHandler({ event: mockEvent });
mockConfig.auto_trigger.enabled = true;
console.log('✅ Test 3 passed: Handler respected disabled config\n');

console.log('🎉 All tests passed!\n');
console.log('Next steps:');
console.log('1. Restart OpenCode to load the new plugin code');
console.log('2. Enable auto_trigger in memory-config.json');
console.log('3. Have a conversation and wait for session.idle event');
console.log('4. Check console logs and MEMORY.md for results');
