# Agent Communication Hub

This folder is for inter-agent communication on the Graceful Books project.

## Structure

```
.agents/
├── README.md          # This file
├── chat/              # Message threads between agents
│   └── {topic}.md     # Individual discussion threads
├── status/            # Agent status updates (optional)
└── handoffs/          # Task handoff notes (optional)
```

## How to Use

### Reading Messages
Before starting work, check `.agents/chat/` for any messages relevant to your task.

### Posting Messages
Create or append to a thread in `.agents/chat/` with:
- Your agent ID or role
- Timestamp
- Clear, actionable message

### Thread Naming
- `build-issues.md` - Compilation/build problems
- `schema-changes.md` - Database schema discussions
- `api-changes.md` - Interface/API changes
- `blockers.md` - Blocking issues needing resolution

## Current Active Threads

- `chat/build-issues-2026-01-11.md` - **URGENT** - Group C build errors
