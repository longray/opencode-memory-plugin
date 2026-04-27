---
name: process-tracker
description: "Track process executions to identify patterns for skill creation. Records workflow runs, analyzes repetition, and suggests skill creation when threshold reached."
---

# Process Tracker

Track workflow executions to identify patterns suitable for skill creation.

## When to Use

Use this skill when:
- Starting a workflow that might be repeated in the future
- Completing a workflow phase
- Wanting to check if a workflow has been executed 3+ times
- Deciding whether to create a dedicated skill

## Commands

### `/track-start <process-name>`

Start tracking a new process execution.

**Example:**
```
/track-start tech-debt-remediation
```

**Records:**
- Process name
- Start timestamp
- Context (current directory, git branch)
- Trigger (user request, automation, etc.)

---

### `/track-phase <phase-name>`

Mark completion of a process phase.

**Example:**
```
/track-phase "Phase 1: Discovery"
```

**Records:**
- Phase name
- Completion timestamp
- Duration (since start or previous phase)
- Notes (optional)

---

### `/track-complete [notes]`

Mark process as complete.

**Example:**
```
/track-complete "Fixed 6 EXDEV duplicates, created lib/atomic-write.js"
```

**Records:**
- Completion timestamp
- Total duration
- Outcome notes
- Success/failure status

---

### `/track-status [process-name]`

Check execution history and statistics.

**Example:**
```
/track-status tech-debt-remediation
```

**Shows:**
- Total executions: N
- Last execution: date
- Average duration
- Pattern analysis
- Recommendation: "Create skill? YES/NO"

---

### `/track-list`

List all tracked processes.

**Shows:**
- Process name
- Execution count
- Last run date
- Status

---

## Workflow Integration

### Example: Tech Debt Remediation

```
# Start
/track-start tech-debt-remediation

# Phase 1
[Execute discovery...]
/track-phase "Phase 1: Discovery - Found 28 debts"

# Phase 2
[Select highest priority...]
/track-phase "Phase 2: Selection - Chose EXDEV duplicates"

# Phase 3
[Create OpenSpec change...]
/track-phase "Phase 3: OpenSpec - Created extract-atomic-write-module"

# Phase 4
[Apply and verify...]
/track-phase "Phase 4: Implementation - Fixed 6 duplicates"

# Complete
/track-complete "Successfully extracted atomic-write module, eliminated 6 duplicates"

# Check if we should create a skill
/track-status tech-debt-remediation
# Output: "Executed 3 times. Recommendation: Create dedicated skill!"
```

---

## Data Storage

**Location:** `openspec/process-tracker/`

**Files:**
- `executions.jsonl` - Append-only execution records
- `processes.json` - Process metadata and statistics
- `suggestions.md` - Generated skill suggestions

**Format:**
```json
{
  "process": "tech-debt-remediation",
  "executionId": "exec-001",
  "startTime": "2026-04-27T20:30:00Z",
  "phases": [
    {"name": "Discovery", "duration": 300},
    {"name": "Selection", "duration": 120},
    {"name": "OpenSpec", "duration": 600},
    {"name": "Implementation", "duration": 1800}
  ],
  "totalDuration": 2820,
  "outcome": "success",
  "notes": "Fixed 6 EXDEV duplicates"
}
```

---

## Skill Creation Threshold

**Recommendation triggers:**

| Executions | Recommendation |
|------------|----------------|
| 1-2 | "Continue tracking to identify patterns" |
| 3+ | "Consider creating dedicated skill" |
| 5+ | "Strongly recommend creating skill" |
| 10+ | "Skill creation overdue!" |

**Pattern analysis:**
- Same phases repeated?
- Similar duration each time?
- Same tools/commands used?
- Manual steps that could be automated?

---

## Best Practices

1. **Start tracking early** - Don't wait until you think you need it
2. **Be consistent** - Use same process names
3. **Add notes** - Context helps pattern recognition
4. **Check status** - Before starting similar work
5. **Act on recommendations** - Create skill when threshold reached

---

## Integration with Other Skills

**Before:**
- `project-context-writer` - "Generate project.md"
- `brainstorming` - Design new feature

**After:**
- `writing-plans` - Create implementation plan
- `subagent-driven-development` - Execute tasks

**When threshold reached:**
- Suggest creating new skill
- Use `writing-skills` to create it
