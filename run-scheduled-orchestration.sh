#!/bin/bash
# run-scheduled-orchestration.sh
# Launcher for scheduled orchestration with configuration options

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
MODE="${1:-sim}"  # 'sim' or 'real'
DURATION="${2:-6}"  # hours
INTERVAL="${3:-10}"  # minutes

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}    Graceful Books - Scheduled Orchestration Launcher${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Configuration:${NC}"
echo -e "  Mode: ${MODE} (sim=simulation, real=actual Claude Code instances)"
echo -e "  Duration: ${DURATION} hours"
echo -e "  Interval: Every ${INTERVAL} minutes"
echo -e "  Expected runs: $(( (DURATION * 60) / INTERVAL ))"
echo ""

if [ "$MODE" = "real" ]; then
    echo -e "${YELLOW}⚠ IMPORTANT LIMITATION:${NC}"
    echo -e "${YELLOW}  The 'real' mode requires the Claude Code CLI to be installed${NC}"
    echo -e "${YELLOW}  and available in PATH. Since we are currently running INSIDE${NC}"
    echo -e "${YELLOW}  Claude Code, launching new instances may not work.${NC}"
    echo ""
    echo -e "${YELLOW}  For testing, use 'sim' mode (recommended).${NC}"
    echo ""

    # Check if claude CLI is available
    if ! command -v claude &> /dev/null && ! command -v claude-code &> /dev/null; then
        echo -e "${YELLOW}  ✗ Claude Code CLI not found${NC}"
        echo -e "${YELLOW}  → Switching to simulation mode${NC}"
        MODE="sim"
        sleep 2
    fi
fi

echo ""
echo -e "${GREEN}Starting scheduled orchestration...${NC}"
echo ""

# Create custom scheduler for the chosen mode
cat > .scheduler-temp.sh << 'SCHEDULER_SCRIPT'
#!/bin/bash
set -e

MODE="MODE_PLACEHOLDER"
INTERVAL_MINUTES=INTERVAL_PLACEHOLDER
DURATION_HOURS=DURATION_PLACEHOLDER

if [ "$MODE" = "sim" ]; then
    ORCHESTRATOR="./orchestrator-sim.sh"
else
    ORCHESTRATOR="./orchestrator.sh"
fi

LOG_DIR="logs"
SCHEDULER_LOG="$LOG_DIR/scheduler_$(date +%Y%m%d_%H%M%S).log"
PID_FILE="$LOG_DIR/scheduler.pid"
mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$SCHEDULER_LOG"; }
log_success() { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1" | tee -a "$SCHEDULER_LOG"; }
log_info() { echo -e "${CYAN}[$(date +%H:%M:%S)] ℹ${NC} $1" | tee -a "$SCHEDULER_LOG"; }

cleanup() {
    log "Scheduler stopping..."
    rm -f "$PID_FILE" .scheduler-temp.sh
    exit 0
}
trap cleanup SIGINT SIGTERM

echo $$ > "$PID_FILE"

START_TIME=$(date +%s)
END_TIME=$((START_TIME + (DURATION_HOURS * 3600)))
INTERVAL_SECONDS=$((INTERVAL_MINUTES * 60))

log "═══════════════════════════════════════════════════════════"
log "Orchestrator Scheduler Started"
log "Mode: $MODE | Duration: ${DURATION_HOURS}h | Interval: ${INTERVAL_MINUTES}m"
log "PID: $$ | Log: $SCHEDULER_LOG"
log "═══════════════════════════════════════════════════════════"

RUN_COUNT=0
SUCCESS_COUNT=0

while true; do
    CURRENT_TIME=$(date +%s)
    [ $CURRENT_TIME -ge $END_TIME ] && break

    RUN_COUNT=$((RUN_COUNT + 1))
    log ""
    log "RUN #$RUN_COUNT - $(date)"

    if $ORCHESTRATOR >> "$SCHEDULER_LOG" 2>&1; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        log_success "Run #$RUN_COUNT complete"
    else
        log "Run #$RUN_COUNT had issues (check log)"
    fi

    CURRENT_TIME=$(date +%s)
    TIME_REMAINING=$((END_TIME - CURRENT_TIME))
    [ $TIME_REMAINING -le 0 ] && break

    NEXT_RUN=$((CURRENT_TIME + INTERVAL_SECONDS))
    [ $NEXT_RUN -gt $END_TIME ] && break

    log_info "Next run in $INTERVAL_MINUTES minutes | Remaining: $((TIME_REMAINING / 3600))h $(((TIME_REMAINING % 3600) / 60))m"
    sleep $INTERVAL_SECONDS
done

log ""
log "═══════════════════════════════════════════════════════════"
log_success "Scheduler Complete: $SUCCESS_COUNT/$RUN_COUNT successful"
log "═══════════════════════════════════════════════════════════"

rm -f "$PID_FILE" .scheduler-temp.sh
SCHEDULER_SCRIPT

# Replace placeholders
sed -i "s/MODE_PLACEHOLDER/$MODE/g" .scheduler-temp.sh
sed -i "s/INTERVAL_PLACEHOLDER/$INTERVAL/g" .scheduler-temp.sh
sed -i "s/DURATION_PLACEHOLDER/$DURATION/g" .scheduler-temp.sh
chmod +x .scheduler-temp.sh

# Ask for confirmation
echo -e "${CYAN}Ready to start. Press Enter to begin, or Ctrl+C to cancel...${NC}"
read -r

# Run scheduler
./.scheduler-temp.sh

# Cleanup
rm -f .scheduler-temp.sh
