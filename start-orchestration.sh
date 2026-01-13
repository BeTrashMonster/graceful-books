#!/bin/bash
# Quick launcher for background orchestration

echo "Starting 6-hour scheduled orchestration (simulation mode)..."
echo "Mode: Simulation"
echo "Duration: 6 hours"
echo "Interval: Every 10 minutes"
echo "Expected runs: 36"
echo ""

# Reset A1 back to unmarked for proper testing
echo "Resetting A1 to unmarked state..."
git checkout -- ROADMAP.md

# Create background runner
nohup bash << 'RUNNER' > logs/orchestration-master.log 2>&1 &
#!/bin/bash

LOG_DIR="logs"
mkdir -p "$LOG_DIR"
PID_FILE="$LOG_DIR/scheduler.pid"
echo $$ > "$PID_FILE"

INTERVAL_MINUTES=10
DURATION_HOURS=6
ORCHESTRATOR="./orchestrator-sim.sh"

START_TIME=$(date +%s)
END_TIME=$((START_TIME + (DURATION_HOURS * 3600)))
INTERVAL_SECONDS=$((INTERVAL_MINUTES * 60))

echo "═══════════════════════════════════════════════════════════"
echo "Scheduled Orchestration Started"
echo "Start: $(date)"
echo "End: $(date -d @$END_TIME 2>/dev/null || echo '+6 hours')"
echo "PID: $$"
echo "═══════════════════════════════════════════════════════════"
echo ""

RUN_COUNT=0
SUCCESS_COUNT=0

while true; do
    CURRENT_TIME=$(date +%s)
    [ $CURRENT_TIME -ge $END_TIME ] && break

    RUN_COUNT=$((RUN_COUNT + 1))
    echo ""
    echo "────────────────────────────────────────────────────────────"
    echo "RUN #$RUN_COUNT at $(date)"
    echo "────────────────────────────────────────────────────────────"

    if $ORCHESTRATOR 2>&1; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        echo "✓ Run #$RUN_COUNT completed successfully"
    else
        echo "✗ Run #$RUN_COUNT had issues"
    fi

    CURRENT_TIME=$(date +%s)
    TIME_REMAINING=$((END_TIME - CURRENT_TIME))
    [ $TIME_REMAINING -le 0 ] && break

    NEXT_RUN=$((CURRENT_TIME + INTERVAL_SECONDS))
    [ $NEXT_RUN -gt $END_TIME ] && break

    echo "Next run in $INTERVAL_MINUTES minutes ($(($TIME_REMAINING / 60)) minutes remaining total)"
    sleep $INTERVAL_SECONDS
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Scheduled Orchestration Complete"
echo "Total runs: $RUN_COUNT"
echo "Successful: $SUCCESS_COUNT"
echo "Completion time: $(date)"
echo "═══════════════════════════════════════════════════════════"

rm -f "$PID_FILE"
RUNNER

SCHEDULER_PID=$!

echo "✓ Orchestration started in background"
echo "  PID: Check logs/scheduler.pid"
echo "  Master log: logs/orchestration-master.log"
echo "  Individual runs: logs/sim_session_*.log"
echo ""
echo "Monitor with:"
echo "  tail -f logs/orchestration-master.log"
echo ""
echo "Stop with:"
echo "  kill \$(cat logs/scheduler.pid)"
echo ""
