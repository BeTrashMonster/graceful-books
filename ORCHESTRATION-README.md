# Orchestration System - Important Information

## Overview

The orchestration system consists of three scripts that work together to automate the development workflow for Graceful Books.

## Scripts

### 1. `orchestrator.sh` - Main Orchestrator
**Purpose:** Runs the three-stage development workflow
**Stages:**
- Stage 1: Implementation (launches Claude Code to write code)
- Stage 2: Review & Test (launches Claude Code to review and test)
- Stage 3: Commit & Push (launches Claude Code to commit and push)

**Limitation:** Requires `claude` or `claude-code` CLI to be installed and available in PATH

### 2. `orchestrator-sim.sh` - Simulation Orchestrator
**Purpose:** Simulates the orchestration workflow for testing
**What it does:**
- Finds next unclaimed roadmap item
- Simulates all three stages (with delays to show progress)
- Marks items as IN-PROGRESS → DONE in ROADMAP.md
- Does NOT actually write code or make commits

**Use case:** Testing the workflow, demonstrating the system, running from within Claude Code

### 3. `scheduler.sh` - Orchestration Scheduler
**Purpose:** Runs orchestrator.sh on a schedule
**Configuration:**
- Interval: Every 10 minutes (configurable)
- Duration: 6 hours (configurable)
- Expected runs: 36 (for 10min interval over 6h)

### 4. `run-scheduled-orchestration.sh` - Unified Launcher
**Purpose:** Easy launcher with mode selection
**Usage:**
```bash
# Simulation mode (recommended when running from Claude Code)
./run-scheduled-orchestration.sh sim 6 10

# Real mode (requires Claude Code CLI installed)
./run-scheduled-orchestration.sh real 6 10

# Arguments: mode duration(hours) interval(minutes)
```

## Important Limitation ⚠️

**Running from within Claude Code:**
When you are already IN a Claude Code session (like right now), the `orchestrator.sh` script **cannot launch new Claude Code instances**. This is because:
1. The script uses `claude` or `claude-code` CLI commands
2. Those commands start new Claude Code processes
3. You can't launch Claude Code from within Claude Code

**Solution:** Use the **simulation mode** (`orchestrator-sim.sh`) which:
- Demonstrates the full workflow
- Updates the ROADMAP.md correctly
- Shows what would happen at each stage
- Can run successfully from within this session

**For actual automated development:**
You would need to run `orchestrator.sh` from a regular terminal (outside of Claude Code), with the Claude Code CLI installed.

## Testing Roadmap Progression

The orchestrator will process roadmap items in dependency order:

**Phase 1: Foundation (Group A → B → C)**
- A1, A2, A3, A4, A5, A6 (can run in parallel)
- B1, B2, B3, B4, B5, B6, B7 (requires Group A)
- C1, C2, C3, C4, C5, C6, C7, C8 (requires Group B)

**Phase 2: First Steps (Group D → E)**
- D1, D2, D3, D4, D5, D6, D7, D8 (requires Group C)
- E1, E2, E3, E4, E5, E6, E7 (requires Group D)

To test **Phase 2 specifically**, you would need to either:
1. Mark all Phase 1 items as [DONE] first
2. Run the orchestrator and let it progress through Phase 1 naturally

## Current Status

Based on your simulation test:
- **A1** is now marked as `[DONE]`
- **A2** is next in line
- The system will need to complete all of Phase 1 before reaching Phase 2 (D1, D2, etc.)

## Running the 6-Hour Scheduled Orchestration

### Option 1: Simulation Mode (Recommended for now)
```bash
# Run in foreground (you'll see all output)
./run-scheduled-orchestration.sh sim 6 10

# Run in background
nohup ./run-scheduled-orchestration.sh sim 6 10 > logs/orchestration.log 2>&1 &
```

### Option 2: Real Mode (requires external setup)
Would need to:
1. Exit this Claude Code session
2. Open a regular terminal
3. Install Claude Code CLI
4. Run: `./run-scheduled-orchestration.sh real 6 10`

## Monitoring

### Check scheduler status:
```bash
# View PID file
cat logs/scheduler.pid

# View latest log
tail -f logs/scheduler_*.log

# View simulation log
tail -f logs/sim_session_*.log

# Stop scheduler
kill $(cat logs/scheduler.pid)
```

### Check roadmap progress:
```bash
# See completed items
grep "\[DONE\]" ROADMAP.md

# See in-progress items
grep "\[IN-PROGRESS\]" ROADMAP.md

# Count completed items
grep -c "\[DONE\]" ROADMAP.md
```

## Expected Behavior

Over 6 hours with 10-minute intervals:
- **36 runs** total
- Each run processes **one roadmap item**
- Progress: A1 → A2 → A3 → ... → D1 → D2 → ...
- Each item goes: [unmarked] → [IN-PROGRESS] → [DONE]
- Logs capture all activity

## Files Generated

- `logs/scheduler_TIMESTAMP.log` - Scheduler master log
- `logs/sim_session_TIMESTAMP.log` - Individual simulation logs
- `logs/session_TIMESTAMP.log` - Real orchestrator logs (if using real mode)

## Next Steps

1. Review this README
2. Decide: simulation mode or wait for real mode setup
3. Launch scheduled orchestration
4. Monitor progress
5. Review results after 6 hours

---

*Last Updated: 2026-01-10*
