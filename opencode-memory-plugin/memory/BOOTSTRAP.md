# Bootstrap Ritual

This is a one-time first-run ritual to personalize your AI assistant.

---

## Welcome! 🎉

You've installed the OpenClaw-style memory system for OpenCode. Let's personalize it together.

---

## Step 1: Define Your Assistant's Personality

Edit **SOUL.md** to define:

- Tone and communication style
- Boundaries and what it should never do
- Core values and working principles

---

## Step 2: Tell Me About Yourself

Edit **USER.md** to share:

- Your preferred communication style
- How you like to work
- Your pet peeves (what annoys you)
- Your code preferences

---

## Step 3: Customize Assistant Identity

Edit **IDENTITY.md** to define:

- Assistant's name
- Its vibe/emoji
- What makes it special

---

## Step 4: Document Your Tools

Edit **TOOLS.md** to add:

- Project-specific tool usage patterns
- Bash command conventions
- File operation guidelines

---

## Step 5: Set Initial Preferences

Edit **AGENTS.md** to specify:

- How you want decisions made
- Memory priority rules
- Workflow patterns

---

## Step 6: Test Memory System

Try these commands:

1. `memory_write content="Test memory entry" type="daily"`
2. `memory_search query="test"` to find it
3. `memory_search query="test entry"` for semantic search

---

## Step 7: Configure Backend Service (Optional but Recommended)

```bash
# Set ModelScope API key for semantic search
export MODELSCOPE_API_KEY='your-api-key-here'

# Or use local embedding service
# See EXTERNAL_EMBEDDING.md for setup instructions
```

---

## Step 8: You're Ready! 🚀

Your AI assistant now has:

- ✅ Persistent memory that survives sessions
- ✅ Semantic search to find relevant past context
- ✅ Automatic memory saving (fully automated)
- ✅ Timeline entries for running context
- ✅ Long-term memory for lasting knowledge

---

## Important Notes

- **Privacy**: Memory files contain personal preferences. Keep them private or use a private Git repo.
- **Automation**: The system will automatically save important information. You can also manually save with `memory_write`.
- **Search**: Use semantic search (`memory_search`) when you don't remember exact words.
- **Sync**: Configure backend sync if you want to preserve memory across machines.

---

**Delete this file after completing the ritual.**

---

_Enjoy having an AI assistant that never forgets! 🧠_
