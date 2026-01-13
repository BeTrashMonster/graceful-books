#!/bin/bash
# scheduler.sh
# Runs orchestrator.sh every 10 minutes for 6 hours

set -e

# Configuration
INTERVAL_MINUTES=10
DURATION_HOURS=6
ORCHESTRATOR="./orchestrator.sh"
LOG_DIR="logs"
SCHEDULER_LOG="$LOG_DIR/scheduler_$(date +%Y%m%d_%H%M%S).log"
PID_FILE="$LOG_DIR/scheduler.pid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +%Y-%m-%d\ %H:%M:%S)]${NC} $1" | tee -a "$SCHEDULER_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date +%Y-%m-%d\ %H:%M:%S)] ✓${NC} $1" | tee -a "$SCHEDULER_LOG"
}

log_error() {
    echo -e "${RED}[$(date +%Y-%m-%d\ %H:%M:%S)] ✗${NC} $1" | tee -a "$SCHEDULER_LOG"
}

log_warning() {
    echo -e "${YELLOW}[$(date +%Y-%m-%d\ %H:%M:%S)] ⚠${NC} $1" | tee -a "$SCHEDULER_LOG"
}

log_info() {
    echo -e "${CYAN}[$(date +%Y-%m-%d\ %H:%M:%S)] ℹ${NC} $1" | tee -a "$SCHEDULER_LOG"
}

# Cleanup function
cleanup() {
    log_warning "Scheduler interrupted - cleaning up..."
    rm -f "$PID_FILE"
    log_info "Cleanup complete"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if orchestrator exists
if [ ! -f "$ORCHESTRATOR" ]; then
    log_error "Orchestrator script not found: $ORCHESTRATOR"
    exit 1
fi

# Check if already running
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        log_error "Scheduler already running with PID $OLD_PID"
        exit 1
    else
        log_warning "Removing stale PID file"
        rm -f "$PID_FILE"
    fi
fi

# Write PID file
echo $$ > "$PID_FILE"

# Calculate end time
START_TIME=$(date +%s)
END_TIME=$((START_TIME + (DURATION_HOURS * 3600)))
INTERVAL_SECONDS=$((INTERVAL_MINUTES * 60))

log "═══════════════════════════════════════════════════════════"
log "Graceful Books Orchestrator Scheduler"
log "═══════════════════════════════════════════════════════════"
log_info "Start time: $(date)"
log_info "End time: $(date -d "@$END_TIME" 2>/dev/null || date -r $END_TIME 2>/dev/null || echo "$(($DURATION_HOURS)) hours from now")"
log_info "Interval: Every $INTERVAL_MINUTES minutes"
log_info "Duration: $DURATION_HOURS hours"
log_info "Expected runs: $(( (DURATION_HOURS * 60) / INTERVAL_MINUTES ))"
log_info "PID: $$"
log "═══════════════════════════════════════════════════════════"

RUN_COUNT=0
SUCCESS_COUNT=0
FAILURE_COUNT=0

# Main scheduler loop
while true; do
    CURRENT_TIME=$(date +%s)

    # Check if we've exceeded duration
    if [ $CURRENT_TIME -ge $END_TIME ]; then
        log_success "Scheduled duration complete"
        break
    fi

    RUN_COUNT=$((RUN_COUNT + 1))

    log ""
    log "═══════════════════════════════════════════════════════════"
    log_info "RUN #$RUN_COUNT - $(date)"
    log "═══════════════════════════════════════════════════════════"

    # Run orchestrator
    if $ORCHESTRATOR >> "$SCHEDULER_LOG" 2>&1; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        log_success "Run #$RUN_COUNT completed successfully"
    else
        EXIT_CODE=$?
        FAILURE_COUNT=$((FAILURE_COUNT + 1))
        log_error "Run #$RUN_COUNT failed with exit code $EXIT_CODE"

        # Check if we should continue on failure
        if [ $FAILURE_COUNT -ge 3 ]; then
            log_error "Too many consecutive failures - stopping scheduler"
            break
        fi
    fi

    # Calculate time until next run
    CURRENT_TIME=$(date +%s)
    TIME_REMAINING=$((END_TIME - CURRENT_TIME))

    if [ $TIME_REMAINING -le 0 ]; then
        log_success "Scheduled duration complete"
        break
    fi

    # Calculate next run time
    NEXT_RUN=$((CURRENT_TIME + INTERVAL_SECONDS))
    if [ $NEXT_RUN -gt $END_TIME ]; then
        log_info "Next run would exceed duration - stopping"
        break
    fi

    TIME_TO_NEXT=$((NEXT_RUN - CURRENT_TIME))
    NEXT_RUN_TIME=$(date -d "@$NEXT_RUN" +"%H:%M:%S" 2>/dev/null || date -r $NEXT_RUN +"%H:%M:%S" 2>/dev/null || echo "in $INTERVAL_MINUTES minutes")

    log_info "Next run at $NEXT_RUN_TIME (in $TIME_TO_NEXT seconds)"
    log_info "Time remaining: $((TIME_REMAINING / 3600))h $(((TIME_REMAINING % 3600) / 60))m"

    # Sleep until next run
    sleep $INTERVAL_SECONDS
done

# Final summary
log ""
log "═══════════════════════════════════════════════════════════"
log "SCHEDULER COMPLETE"
log "═══════════════════════════════════════════════════════════"
log_info "Total runs: $RUN_COUNT"
log_success "Successful: $SUCCESS_COUNT"
if [ $FAILURE_COUNT -gt 0 ]; then
    log_error "Failed: $FAILURE_COUNT"
fi
log_info "Duration: $((($(date +%s) - START_TIME) / 60)) minutes"
log "═══════════════════════════════════════════════════════════"

# Cleanup
rm -f "$PID_FILE"
log_success "Scheduler finished"
