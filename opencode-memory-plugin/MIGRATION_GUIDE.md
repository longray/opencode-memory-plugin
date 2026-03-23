# Migration Guide (v2.2 → v2.3)

This guide helps you migrate from OpenCode Memory Plugin v2.2 (or earlier) to v2.3.0.

## Table of Contents

- [Overview](#overview)
- [What's New in v2.3](#whats-new-in-v23)
- [Migration Paths](#migration-paths)
- [Timeline Migration](#timeline-migration)
- [Configuration Migration](#configuration-migration)
- [Data Migration](#data-migration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Rollback](#rollback)

---

## Overview

v2.3.0 introduces significant changes to the memory system:

- **Timeline Structure**: Memory entries now use `timeline/YYYY/MM/DD/` instead of `daily/`
- **Dual-Mode Sync**: Incremental sync with fingerprint-based change detection
- **Conflict Resolution**: Automatic detection and resolution of sync conflicts
- **19 Memory Tools**: 8 new tools for sync, browsing, and conflict resolution

**Migration Time**: ~5-10 minutes (depending on data size)

**Risk Level**: Low (non-destructive migration with rollback support)

---

## What's New in v2.3

### 1. Timeline Structure

**Before (v2.2):**

```
memory/
└── daily/
    ├── 2026-03-16.md
    ├── 2026-03-17.md
    └── 2026-03-23.md
```

**After (v2.3):**

```
memory/
└── timeline/
    └── 2026/
        └── 03/
            ├── 16/
            │   ├── entry-001.md
            │   └── entry-002.md
            ├── 17/
            └── 23/
```

**Benefits:**

- Better organization (entries grouped by date)
- Scalability (no single directory with thousands of files)
- Timeline browser support (`memory_timeline` tool)
- Easier archival and cleanup

### 2. Dual-Mode Sync

**Before (v2.2):**

- Only `rebuild_index` (full sync)
- All entries re-uploaded every time
- No change detection

**After (v2.3):**

- `incremental_sync`: Only sync changes (fingerprint-based)
- `full_sync`: Complete sync with resume support
- `sync_checkpoint`: Track sync history
- `batch_resolve`: Bulk conflict resolution

### 3. Conflict Resolution

**Before (v2.2):**

- No conflict detection
- Silent overwrites possible

**After (v2.3):**

- Automatic conflict detection
- Smart auto-resolve (timestamp, content quality)
- Manual resolution options (accept/reject/merge)
- Conflict queue and history

### 4. New Tools

| Tool               | Purpose                   |
| ------------------ | ------------------------- |
| `incremental_sync` | Sync only changed entries |
| `full_sync`        | Full sync with resume     |
| `sync_checkpoint`  | Manage sync checkpoints   |
| `batch_resolve`    | Bulk conflict resolution  |
| `memory_timeline`  | Browse by date            |
| `memory_topics`    | Browse by topic           |
| `conflict_list`    | List conflicts            |
| `conflict_resolve` | Resolve conflicts         |

---

## Migration Paths

### Path 1: Fresh Installation (Easiest)

If you're installing for the first time or don't need to preserve data:

```bash
# Install latest version
npm install -g @csuwl/opencode-memory-plugin@latest

# That's it! Timeline structure is default
```

### Path 2: Upgrade from v2.2 (Recommended)

For existing users with data to preserve:

```bash
# 1. Backup current data
cp -r ~/.opencode/memory ~/.opencode/memory.backup

# 2. Install latest version
npm install -g @csuwl/opencode-memory-plugin@latest

# 3. Run migration script
node ~/.opencode/plugins/opencode-memory-plugin/scripts/migrate-daily-to-timeline.mjs

# 4. Update configuration
nano ~/.opencode/memory/memory-config.json
```

### Path 3: Upgrade from v1.x

For users on very old versions:

```bash
# 1. Backup data
cp -r ~/.opencode/memory ~/.opencode/memory.backup.v1

# 2. Export important memories (manual)
# Copy any important entries from MEMORY.md

# 3. Clean install
rm -rf ~/.opencode/memory
npm install -g @csuwl/opencode-memory-plugin@latest

# 4. Re-import important memories
# Use memory_write to add them back
```

---

## Timeline Migration

### Step 1: Verify Current Structure

```bash
# Check if you have daily/ directory
ls ~/.opencode/memory/daily/

# Expected output:
# 2026-03-16.md
# 2026-03-17.md
# ...
```

### Step 2: Run Migration Script

```bash
# Run the migration script
node ~/.opencode/plugins/opencode-memory-plugin/scripts/migrate-daily-to-timeline.mjs
```

**What the script does:**

1. ✅ Scans `daily/` directory for `.md` files
2. ✅ Parses dates from filenames (`2026-03-16.md` → 2026/03/16)
3. ✅ Creates `timeline/YYYY/MM/DD/` directory structure
4. ✅ Moves files to appropriate directories
5. ✅ Generates entry IDs and metadata
6. ✅ Updates memory index (MEMORY.md)
7. ✅ Removes empty `daily/` directory

**Example Output:**

```
🔄 Starting daily → timeline migration...

📁 Scanning daily/ directory...
   Found 9 files to migrate

📂 Creating timeline structure...
   ✓ Created timeline/2026/03/16/
   ✓ Created timeline/2026/03/17/
   ✓ Created timeline/2026/03/18/
   ✓ Created timeline/2026/03/19/
   ✓ Created timeline/2026/03/20/

📝 Migrating files...
   ✓ 2026-03-16.md → timeline/2026/03/16/entry-001.md
   ✓ 2026-03-17.md → timeline/2026/03/17/entry-001.md
   ... (7 more files)

📊 Migration Summary:
   - Total files: 9
   - Migrated: 9
   - Skipped: 0
   - Errors: 0
   - Time: 1.2s

✅ Migration complete!
   - Timeline entries: 137
   - Old daily/ directory removed
```

### Step 3: Verify Migration

```bash
# Check timeline structure
ls ~/.opencode/memory/timeline/

# Expected output:
# 2026/

# Check a specific date
ls ~/.opencode/memory/timeline/2026/03/16/

# Expected output:
# entry-001.md  entry-002.md  ...

# Use memory_timeline tool
opencode
> memory_timeline days=7
```

### Step 4: Update memory_write Usage

**Before (v2.2):**

```
memory_write content="..." type="daily"
→ Creates: daily/2026-03-23.md
```

**After (v2.3):**

```
memory_write content="..." type="daily"
→ Creates: timeline/2026/03/23/entry-001.md
```

**No code changes needed!** The tool automatically writes to timeline structure.

---

## Configuration Migration

### Step 1: Backup Configuration

```bash
# Backup current config
cp ~/.opencode/memory/memory-config.json ~/.opencode/memory/memory-config.json.backup
```

### Step 2: Update Version

```json
{
  "version": "3.0",
  ...
}
```

### Step 3: Add New Sections

Add the following sections to your config file:

```json
{
  "version": "3.0",

  // Existing sections...
  "search": { "mode": "hybrid" },
  "embedding": { ... },

  // NEW: Backend sync configuration
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "sync": {
      "mode": "incremental",
      "auto_sync": true
    }
  },

  // NEW: Timeline configuration
  "timeline": {
    "enabled": true,
    "base_path": "memory/timeline"
  },

  // NEW: WebSocket configuration
  "websocket": {
    "enabled": true
  },

  // NEW: Trie index configuration
  "trie": {
    "enabled": true
  }
}
```

### Step 4: Full Configuration Example

**v2.2 Config:**

```json
{
  "version": "2.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  },
  "backend": {
    "url": "http://localhost:17999"
  }
}
```

**v2.3 Config:**

```json
{
  "version": "3.0",
  "search": {
    "mode": "hybrid",
    "options": {
      "hybrid": {
        "vectorWeight": 0.7,
        "bm25Weight": 0.3
      }
    }
  },
  "embedding": {
    "enabled": true,
    "provider": "external",
    "endpoint": "https://api-inference.modelscope.cn/v1/embeddings",
    "model": "Qwen/Qwen3-Embedding-0.6B",
    "fallbackMode": "bm25"
  },
  "backend": {
    "enabled": true,
    "url": "http://localhost:17999",
    "tenant_id": "auto",
    "project_id": "auto",
    "sync": {
      "mode": "incremental",
      "auto_sync": true,
      "batch_size": 50
    }
  },
  "timeline": {
    "enabled": true,
    "base_path": "memory/timeline"
  },
  "websocket": {
    "enabled": true
  },
  "trie": {
    "enabled": true
  }
}
```

---

## Data Migration

### Sync Local Data to Backend

After timeline migration, sync your data to the backend:

```bash
# Option 1: Incremental sync (recommended)
incremental_sync dry_run=false

# Option 2: Full sync
full_sync resume=false auto_resolve=true batch_size=50
```

### Verify Sync

```bash
# Check index status
index_status

# Expected output:
# Backend: ✅ Connected
# Entries: 137
# Checkpoint: cp_20260323_001
# Last sync: 2026-03-23T10:00:00Z
```

### Handle Conflicts

If conflicts are detected:

```bash
# List conflicts
conflict_list limit=10

# Resolve conflicts
conflict_resolve conflict_id="xxx" resolution="USE_LOCAL"

# Or batch resolve
batch_resolve strategy="ACCEPT_ALL"
```

---

## Verification

### Step 1: Check Timeline Structure

```bash
# List timeline directories
ls -la ~/.opencode/memory/timeline/

# Check specific date
ls -la ~/.opencode/memory/timeline/2026/03/23/

# Count entries
find ~/.opencode/memory/timeline -name "*.md" | wc -l
```

### Step 2: Test Memory Tools

```bash
# Test timeline browser
memory_timeline days=7

# Test topic browser
memory_topics min_entries=3

# Test search
memory_search query="test" mode="hybrid"

# Test write
memory_write content="Migration test" type="daily" tags=["test"]
```

### Step 3: Verify Tools (19 total)

```bash
# Core tools (11)
memory_write ✓
memory_read ✓
memory_search ✓
memory_relate ✓
memory_graph ✓
memory_suggest ✓
sync_status ✓
list_daily ✓
init_daily ✓
rebuild_index ✓
index_status ✓

# Sync tools (4)
incremental_sync ✓
full_sync ✓
sync_checkpoint ✓
batch_resolve ✓

# Browser tools (2)
memory_timeline ✓
memory_topics ✓

# Conflict tools (2)
conflict_list ✓
conflict_resolve ✓
```

---

## Troubleshooting

### Issue: Migration Script Fails

**Error: "daily/ directory not found"**

This means you don't have daily logs to migrate. You can skip timeline migration.

```bash
# Check if daily/ exists
ls ~/.opencode/memory/daily/

# If not found, create timeline structure manually
mkdir -p ~/.opencode/memory/timeline
```

**Error: "Permission denied"**

```bash
# Fix permissions
chmod -R u+rw ~/.opencode/memory/

# Run migration again
node scripts/migrate-daily-to-timeline.mjs
```

**Error: "File already exists in timeline/"**

```bash
# Check for duplicates
ls ~/.opencode/memory/timeline/2026/03/23/

# Manually resolve conflicts
# Rename or remove duplicate files
```

### Issue: Tools Not Working

**Error: "Tool not found"**

```bash
# Reinstall plugin
npm install -g @csuwl/opencode-memory-plugin@latest

# Restart OpenCode
opencode
```

**Error: "Backend not connected"**

```bash
# Check backend status
curl http://localhost:17999/api/v1/health

# Start backend if not running
# (See backend documentation)
```

### Issue: Search Returns No Results

**Possible Causes:**

1. **Index not rebuilt**: Run `rebuild_index force=true`
2. **Backend not synced**: Run `incremental_sync`
3. **Timeline migration incomplete**: Re-run migration script

```bash
# Full diagnostics
index_status
rebuild_index force=true
incremental_sync
memory_search query="test"
```

### Issue: Sync Conflicts

**View Conflicts:**

```bash
conflict_list limit=20
```

**Resolve One by One:**

```bash
conflict_resolve conflict_id="xxx" resolution="USE_LOCAL"
```

**Batch Resolve:**

```bash
batch_resolve strategy="ACCEPT_ALL"  # Accept all backend versions
batch_resolve strategy="USE_LOCAL_ALL"  # Use all local versions
```

---

## Rollback

If you need to rollback to v2.2:

### Step 1: Uninstall v2.3

```bash
npm uninstall -g @csuwl/opencode-memory-plugin
```

### Step 2: Restore Backup

```bash
# Remove v2.3 data
rm -rf ~/.opencode/memory

# Restore v2.2 backup
cp -r ~/.opencode/memory.backup ~/.opencode/memory
```

### Step 3: Install v2.2

```bash
npm install -g @csuwl/opencode-memory-plugin@2.2.0
```

### Step 4: Restore Config

```bash
# Restore v2.2 config
cp ~/.opencode/memory/memory-config.json.backup ~/.opencode/memory/memory-config.json
```

### Manual Timeline → Daily Migration

If you need to convert timeline back to daily:

```bash
# This is a manual process
# For each timeline entry:

# 1. Read the entry
cat ~/.opencode/memory/timeline/2026/03/23/entry-001.md

# 2. Append to daily log
cat ~/.opencode/memory/timeline/2026/03/23/entry-001.md >> ~/.opencode/memory/daily/2026-03-23.md

# Repeat for all entries
```

---

## Post-Migration Checklist

- [ ] ✅ Timeline migration completed
- [ ] ✅ Configuration updated to v3.0
- [ ] ✅ Backend connection verified
- [ ] ✅ Incremental sync completed
- [ ] ✅ All 19 tools working
- [ ] ✅ Timeline browser functional
- [ ] ✅ Search returning results
- [ ] ✅ No sync conflicts remaining
- [ ] ✅ Backup created

---

## Getting Help

### Documentation

- [README.md](../README.md) - Project overview
- [CONFIGURATION.md](./CONFIGURATION.md) - Configuration options
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues

### Community

- **GitHub Issues**: [Report bugs](https://github.com/csuwl/opencode-memory-plugin/issues)
- **Discussions**: [Ask questions](https://github.com/csuwl/opencode-memory-plugin/discussions)

### Logs

```bash
# Check sync logs
tail -f ~/.opencode/memory/sync.log

# Check error logs
tail -f ~/.opencode/memory/errors.log

# Check auto-trigger logs
tail -f ~/.opencode/memory/auto-trigger.log
```

---

## Summary

**Migration Steps:**

1. Backup data and config
2. Install v2.3.0
3. Run timeline migration script
4. Update configuration to v3.0
5. Sync data to backend
6. Verify all tools working
7. Resolve any conflicts

**Time Required**: ~5-10 minutes

**Risk**: Low (non-destructive with rollback support)

**Benefits**:

- Better memory organization
- Faster incremental sync
- Conflict detection and resolution
- New browsing tools
- 19 total memory tools

---

**Last Updated**: 2026-03-23  
**Version**: v2.3.0  
**Maintainer**: OpenCode Memory Plugin Team
