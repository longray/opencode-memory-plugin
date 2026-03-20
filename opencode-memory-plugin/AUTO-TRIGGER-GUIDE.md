# Auto-Trigger User Guide

## Quick Setup

### 1. Enable Configuration

Edit `~/.opencode/memory/memory-config.json`:

```json
{
  "auto_trigger": {
    "enabled": true,
    "timeout_ms": 30000,
    "cooldown_ms": 300000,
    "max_queue_size": 10,
    "skip_sensitive": true,
    "debug_logging": false
  }
}
```

### 2. Restart OpenCode

Quit and restart OpenCode to load the plugin.

### 3. Test

- Start a conversation (at least 8 messages with 5+ user messages)
- Discuss decisions, preferences, or solutions
- End conversation and wait 10 seconds
- Check console: `[Memory Plugin] Auto-trigger completed`
- Check MEMORY.md for new entries

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| enabled | true | Enable auto-trigger |
| timeout_ms | 30000 | Timeout (milliseconds) |
| cooldown_ms | 300000 | Min time between triggers (5 minutes) |
| max_queue_size | 10 | Max concurrent sessions |
| skip_sensitive | true | Skip sessions with passwords/keys |
| debug_logging | false | Output debug logs to auto-trigger.log |

## Trigger Conditions

Auto-trigger activates when ALL conditions are met:
- **New messages >= 8** (since last trigger)
- **New user messages >= 5** (since last trigger)
- Total characters >= 400
- Session duration >= 5 minutes
- Has tool usage OR code blocks OR long replies
- No test keywords in short conversations

## Troubleshooting

**No trigger:** Check config enabled, backend running (port 17999)

**Timeout:** Already set to 30s. Check backend service health.

**Skipped:** Expected if conversation has sensitive info or doesn't meet trigger conditions

**Debug:** Set `debug_logging: true` and check `~/.opencode/memory/auto-trigger.log`

## Verification

Run test script:
```bash
cd opencode-memory-plugin
node test-auto-trigger.mjs
```

Expected: All 3 tests pass
