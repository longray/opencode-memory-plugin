#!/bin/bash

# OpenCode Memory Plugin - Uninstallation Script
# This script removes all installed components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function log() {
    echo -e "${2}$1${NC}"
}

function getHomeDir() {
    echo "$HOME"
}

# Paths
HOME=$(getHomeDir)
MEMORY_ROOT="$HOME/.opencode"
MEMORY_DIR="$MEMORY_ROOT/memory"
OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.json"
BACKUP_DIR="$HOME/opencode-memory-backup-$(date +%Y%m%d_%H%M%S)"

log '' '' 
log '═════════════════════════════════════════════════════════════════' "$BLUE"
log '  OpenCode Memory Plugin - Uninstallation' "$BLUE"
log '═════════════════════════════════════════════════════════════════' "$BLUE"
log '' '' 

# Ask for confirmation
log 'This will uninstall the OpenCode Memory Plugin.' "$YELLOW"
log '' '' 
log 'The following will be removed:' "$YELLOW"
log "  - Memory files in: $MEMORY_DIR" "$NC"
log "  - OpenCode configuration entries" "$NC"
log '' '' 
log 'Your memory files will be backed up to:' "$GREEN"
log "  $BACKUP_DIR" "$BLUE"
log '' '' 

read -p "Do you want to continue? (yes/no): " -r
echo

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log 'Uninstallation cancelled.' "$YELLOW"
    exit 0
fi

log '' '' 
log 'Step 1/4: Creating backup...' "$YELLOW"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup memory files if they exist
if [ -d "$MEMORY_DIR" ]; then
    cp -r "$MEMORY_DIR" "$BACKUP_DIR/"
    log "  ✓ Backed up memory files" "$GREEN"
else
    log "  ⊙ No memory files to backup" "$BLUE"
fi

# Backup OpenCode config
if [ -f "$OPENCODE_CONFIG" ]; then
    cp "$OPENCODE_CONFIG" "$BACKUP_DIR/"
    log "  ✓ Backed up OpenCode config" "$GREEN"
else
    log "  ⊙ No OpenCode config to backup" "$BLUE"
fi

log '' '' 
log 'Step 2/4: Removing OpenCode configuration...' "$YELLOW"

# Remove OpenCode configuration entries
if [ -f "$OPENCODE_CONFIG" ]; then
    # Use Node.js to safely modify JSON
    node -e "
        const fs = require('fs');
        const path = '$OPENCODE_CONFIG';
        
        try {
            if (fs.existsSync(path)) {
                let config = JSON.parse(fs.readFileSync(path, 'utf8'));
                
                // Remove memory instructions
                if (config.instructions) {
                    config.instructions = config.instructions.filter(
                        instr => !instr.includes('.opencode/memory/')
                    );
                }
                
                // Remove memory agents
                if (config.agent) {
                    delete config.agent['memory-automation'];
                    delete config.agent['memory-consolidate'];
                }
                
                // Remove memory tools
                if (config.tools) {
                    delete config.tools.memory_write;
                    delete config.tools.memory_read;
                    delete config.tools.memory_search;
                    delete config.tools.vector_memory_search;
                    delete config.tools.list_daily;
                    delete config.tools.init_daily;
                    delete config.tools.rebuild_index;
                    delete config.tools.index_status;
                }
                
                fs.writeFileSync(path, JSON.stringify(config, null, 2));
                console.log('  ✓ Removed memory configuration from OpenCode');
            }
        } catch (error) {
            console.error('  ✗ Error modifying config:', error.message);
            process.exit(1);
        }
    " 2>/dev/null || {
        log "  ⚠ Could not modify OpenCode config (manual cleanup may be needed)" "$YELLOW"
    }
else
    log "  ⊙ No OpenCode config found" "$BLUE"
fi

log '' '' 
log 'Step 3/4: Removing memory directory...' "$YELLOW"

# Remove memory directory
if [ -d "$MEMORY_DIR" ]; then
    rm -rf "$MEMORY_DIR"
    log "  ✓ Removed memory directory" "$GREEN"
else
    log "  ⊙ No memory directory found" "$BLUE"
fi

log '' '' 
log 'Step 4/4: Cleaning up...' "$YELLOW"

# Remove vector database cache
VECTOR_CACHE="$HOME/.cache/huggingface"
if [ -d "$VECTOR_CACHE" ]; then
    log "  ⊙ HuggingFace cache preserved at: $VECTOR_CACHE" "$BLUE"
    log "    (You can safely delete this to save ~80MB)" "$NC"
fi

# Summary
log '' '' 
log '═════════════════════════════════════════════════════════════════' "$BLUE"
log '  ✓ Uninstallation completed!' "$GREEN"
log '═════════════════════════════════════════════════════════════════' "$BLUE"
log '' '' 
log 'Backup location:' "$GREEN"
log "  $BACKUP_DIR" "$BLUE"
log '' ' 
log 'To restore your memory files:' "$YELLOW"
log '  cp -r '$BACKUP_DIR'/memory ~/.opencode/' "$BLUE"
log '' ' 
log 'To completely remove the backup:' "$YELLOW"
log '  rm -rf '$BACKUP_DIR "$BLUE"
log '' ' 
log 'To remove HuggingFace model cache (~80MB):' "$YELLOW"
log '  rm -rf ~/.cache/huggingface' "$BLUE"
log '' ' 
log 'Thank you for using OpenCode Memory Plugin!' "$GREEN"
log '' '' 
