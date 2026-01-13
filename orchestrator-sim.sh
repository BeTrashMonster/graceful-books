#!/bin/bash
# orchestrator-sim.sh
# Simulation mode for testing orchestrator workflow without launching Claude Code

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
ROADMAP_FILE="ROADMAP.md"
LOG_DIR="logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_LOG="$LOG_DIR/sim_session_$TIMESTAMP.log"
SIMULATION_DELAY=2  # Seconds to simulate each stage

# Create logs directory
mkdir -p "$LOG_DIR"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1" | tee -a "$SESSION_LOG"
}

log_success() {
    echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $1" | tee -a "$SESSION_LOG"
}

log_error() {
    echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $1" | tee -a "$SESSION_LOG"
}

log_warning() {
    echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $1" | tee -a "$SESSION_LOG"
}

log_stage() {
    echo -e "${MAGENTA}[$(date +%H:%M:%S)] 🎭${NC} $1" | tee -a "$SESSION_LOG"
}

log_info() {
    echo -e "${CYAN}[$(date +%H:%M:%S)] ℹ${NC} $1" | tee -a "$SESSION_LOG"
}

# Find next unclaimed roadmap item
find_next_item() {
    local next_item=$(grep -E "^###.*\[MVP\]|^###.*(Nice)" "$ROADMAP_FILE" | \
                      grep -v "\[IN-PROGRESS\]" | \
                      grep -v "\[DONE\]" | \
                      head -n 1)

    if [ -z "$next_item" ]; then
        return 1
    fi

    local item_id=$(echo "$next_item" | grep -oE "[A-Z][0-9]+" | head -n 1)
    local item_name=$(echo "$next_item" | sed -E 's/^###\s+[A-Z][0-9]+\.\s+//' | sed -E 's/\s+\[MVP\]|\s+\(Nice\).*//')

    echo "$item_id|$item_name"
}

# Mark item in roadmap
mark_item_status() {
    local item_id="$1"
    local status="$2"

    log "Marking item $item_id as $status..."

    local temp_file=$(mktemp)
    sed "s/^### $item_id\. \(.*\) \(\[IN-PROGRESS\]\|\[DONE\]\|\[FAILED\]\|\[REVIEW-FAILED\]\)/### $item_id. \1/" "$ROADMAP_FILE" | \
    sed "s/^### $item_id\. \(.*\)$/### $item_id. \1 [$status]/" > "$temp_file"
    mv "$temp_file" "$ROADMAP_FILE"

    log_success "Roadmap updated: $item_id → $status"
}

# Simulate a stage
simulate_stage() {
    local stage_num="$1"
    local stage_name="$2"
    local item_id="$3"
    local item_name="$4"

    log ""
    log "═══════════════════════════════════════════════════════════"
    log_stage "STAGE $stage_num: $stage_name"
    log "═══════════════════════════════════════════════════════════"
    log_info "Item: $item_id - $item_name"

    # Simulate work with progress
    local steps=5
    for i in $(seq 1 $steps); do
        sleep $((SIMULATION_DELAY / steps))
        case $stage_num in
            1)
                case $i in
                    1) log_info "Reading ROADMAP.md and SPEC.md..." ;;
                    2) log_info "Understanding requirements for $item_id..." ;;
                    3) log_info "Creating file structure..." ;;
                    4) log_info "Implementing core functionality..." ;;
                    5) log_info "Finalizing implementation..." ;;
                esac
                ;;
            2)
                case $i in
                    1) log_info "Reviewing code changes..." ;;
                    2) log_info "Checking for security issues..." ;;
                    3) log_info "Verifying accessibility compliance..." ;;
                    4) log_info "Writing tests..." ;;
                    5) log_info "Running test suite..." ;;
                esac
                ;;
            3)
                case $i in
                    1) log_info "Reviewing all changes..." ;;
                    2) log_info "Updating documentation..." ;;
                    3) log_info "Creating commit message..." ;;
                    4) log_info "Committing changes..." ;;
                    5) log_info "Pushing to GitHub..." ;;
                esac
                ;;
        esac
    done

    log_success "Stage $stage_num completed"
    sleep 1
}

# Main simulation
simulate_orchestration() {
    log "═══════════════════════════════════════════════════════════"
    log "Graceful Books Orchestrator - SIMULATION MODE"
    log "Session: $TIMESTAMP"
    log "═══════════════════════════════════════════════════════════"
    log_warning "This is a SIMULATION - no actual code changes will be made"
    log ""

    # Find next item
    local item_info=$(find_next_item)
    if [ $? -ne 0 ]; then
        log_error "No unclaimed items found"
        return 1
    fi

    local item_id=$(echo "$item_info" | cut -d'|' -f1)
    local item_name=$(echo "$item_info" | cut -d'|' -f2)

    log_success "Found next item: $item_id - $item_name"
    log_info "Phase: $(echo $item_id | grep -oE '^[A-Z]' | sed 's/A/1 (Foundation)/;s/B/1 (Foundation)/;s/C/1 (Foundation)/;s/D/2 (First Steps)/;s/E/2 (First Steps)/')"

    # Mark as in progress
    mark_item_status "$item_id" "IN-PROGRESS"

    # Simulate Stage 1
    simulate_stage 1 "Implementation" "$item_id" "$item_name"

    # Simulate Stage 2
    simulate_stage 2 "Review & Test" "$item_id" "$item_name"

    # Simulate Stage 3
    simulate_stage 3 "Commit & Push" "$item_id" "$item_name"

    # Mark as done
    mark_item_status "$item_id" "DONE"

    log ""
    log "═══════════════════════════════════════════════════════════"
    log_success "SIMULATION COMPLETE"
    log_success "Item $item_id ($item_name) marked as DONE"
    log "═══════════════════════════════════════════════════════════"

    # Show next item
    local next_info=$(find_next_item)
    if [ $? -eq 0 ]; then
        local next_id=$(echo "$next_info" | cut -d'|' -f1)
        local next_name=$(echo "$next_info" | cut -d'|' -f2)
        log_info "Next item ready: $next_id - $next_name"
    else
        log_success "All items complete!"
    fi
}

# Run simulation
simulate_orchestration
