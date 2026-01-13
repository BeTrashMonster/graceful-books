#!/bin/bash
# orchestrator.sh
# Autonomous development orchestrator for Graceful Books
# Manages three-stage workflow: Implementation -> Review/Test -> Commit/Push

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ROADMAP_FILE="ROADMAP.md"
CLAUDE_MD_FILE="CLAUDE.md"
LOG_DIR="logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SESSION_LOG="$LOG_DIR/session_$TIMESTAMP.log"

# Create logs directory if it doesn't exist
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

# Function to find next unclaimed roadmap item
find_next_item() {
    log "Searching for next unclaimed roadmap item..."

    # Parse roadmap and find first item without [IN-PROGRESS] or [DONE] marker
    # We'll look for items that start with ### and have [MVP] or (Nice) tags
    local next_item=$(grep -E "^###.*\[MVP\]|^###.*(Nice)" "$ROADMAP_FILE" | \
                      grep -v "\[IN-PROGRESS\]" | \
                      grep -v "\[DONE\]" | \
                      head -n 1)

    if [ -z "$next_item" ]; then
        log_error "No unclaimed items found in roadmap"
        return 1
    fi

    # Extract item ID (e.g., A1, B2, D1)
    local item_id=$(echo "$next_item" | grep -oE "[A-Z][0-9]+" | head -n 1)
    local item_name=$(echo "$next_item" | sed -E 's/^###\s+[A-Z][0-9]+\.\s+//' | sed -E 's/\s+\[MVP\]|\s+\(Nice\).*//')

    echo "$item_id|$item_name"
}

# Function to mark item in roadmap
mark_item_status() {
    local item_id="$1"
    local status="$2"  # IN-PROGRESS or DONE

    log "Marking item $item_id as $status in roadmap..."

    # Use a temp file for better portability across Windows/Mac/Linux
    local temp_file=$(mktemp)

    # First remove any existing status markers, then add the new one
    # This two-step approach is more reliable
    sed "s/^### $item_id\. \(.*\) \(\[IN-PROGRESS\]\|\[DONE\]\|\[FAILED\]\|\[REVIEW-FAILED\]\)/### $item_id. \1/" "$ROADMAP_FILE" | \
    sed "s/^### $item_id\. \(.*\)$/### $item_id. \1 [$status]/" > "$temp_file"

    # Replace original file
    mv "$temp_file" "$ROADMAP_FILE"

    log_success "Roadmap updated: $item_id is now $status"
}

# Function to run Claude Code with a specific prompt
run_claude_stage() {
    local stage_num="$1"
    local stage_name="$2"
    local prompt="$3"
    local stage_log="$LOG_DIR/stage${stage_num}_${TIMESTAMP}.log"

    log "═══════════════════════════════════════════════════════════"
    log "STAGE $stage_num: $stage_name"
    log "═══════════════════════════════════════════════════════════"

    # Write prompt to temporary file
    local prompt_file=$(mktemp)
    echo "$prompt" > "$prompt_file"

    # Run Claude Code with the prompt
    # Note: This assumes 'claude' or 'claude-code' CLI is available
    log "Starting Claude Code instance for Stage $stage_num..."

    # Try to run claude code - adjust command based on your setup
    if command -v claude &> /dev/null; then
        cat "$prompt_file" | claude 2>&1 | tee "$stage_log"
        local exit_code=${PIPESTATUS[1]}
    elif command -v claude-code &> /dev/null; then
        cat "$prompt_file" | claude-code 2>&1 | tee "$stage_log"
        local exit_code=${PIPESTATUS[1]}
    else
        log_error "Claude Code CLI not found. Please install it first."
        log_error "Visit: https://github.com/anthropics/claude-code"
        rm "$prompt_file"
        return 1
    fi

    rm "$prompt_file"

    if [ $exit_code -eq 0 ]; then
        log_success "Stage $stage_num completed successfully"
        return 0
    else
        log_error "Stage $stage_num failed with exit code $exit_code"
        return $exit_code
    fi
}

# Main orchestration function
orchestrate_development() {
    log "═══════════════════════════════════════════════════════════"
    log "Graceful Books Development Orchestrator"
    log "Session: $TIMESTAMP"
    log "═══════════════════════════════════════════════════════════"

    # Find next item
    local item_info=$(find_next_item)
    if [ $? -ne 0 ]; then
        log_error "Failed to find next item"
        exit 1
    fi

    local item_id=$(echo "$item_info" | cut -d'|' -f1)
    local item_name=$(echo "$item_info" | cut -d'|' -f2)

    log_success "Found next item: $item_id - $item_name"

    # Mark as in progress
    mark_item_status "$item_id" "IN-PROGRESS"

    # STAGE 1: Implementation
    local stage1_prompt="You are working on the Graceful Books project.

Your task: Implement roadmap item $item_id: $item_name

Instructions:
1. Read ROADMAP.md to understand the full requirements for $item_id
2. Read CLAUDE.md for project context and architecture
3. Read SPEC.md for detailed specifications
4. This item is already marked as [IN-PROGRESS] in the roadmap - DO NOT update it
5. Implement all required functionality for this item
6. Follow all architecture principles and requirements
7. Use the technology stack specified in CLAUDE.md
8. Ensure all code follows best practices
9. When complete, output 'IMPLEMENTATION COMPLETE' and exit

DO NOT:
- Commit any changes
- Update the roadmap status
- Write tests (that's Stage 2's job)
- Push to GitHub

Just implement the feature and exit when done."

    if ! run_claude_stage 1 "Implementation" "$stage1_prompt"; then
        log_error "Stage 1 failed - aborting orchestration"
        mark_item_status "$item_id" "FAILED"
        exit 1
    fi

    # STAGE 2: Review and Test
    local stage2_prompt="You are reviewing code for the Graceful Books project.

Your task: Review and test the implementation of roadmap item $item_id: $item_name

Instructions:
1. Review all code changes made in the previous stage
2. Check for:
   - Code quality and best practices
   - Security vulnerabilities (XSS, SQL injection, etc.)
   - Accessibility compliance (WCAG 2.1 AA)
   - Architecture consistency with SPEC.md and CLAUDE.md
   - Proper error handling
3. Fix any issues you find
4. Write comprehensive tests for the new functionality
5. Run all tests to ensure they pass
6. When complete, output 'REVIEW COMPLETE' and exit

DO NOT:
- Commit any changes
- Update the roadmap
- Push to GitHub

Just review, fix, test, and exit when done."

    if ! run_claude_stage 2 "Review & Test" "$stage2_prompt"; then
        log_error "Stage 2 failed - aborting orchestration"
        mark_item_status "$item_id" "REVIEW-FAILED"
        exit 1
    fi

    # STAGE 3: Commit and Push
    local stage3_prompt="You are finalizing work on the Graceful Books project.

Your task: Commit and push the completed work for roadmap item $item_id: $item_name

Instructions:
1. Review all changes that have been made
2. Update ROADMAP.md to mark $item_id as [DONE] instead of [IN-PROGRESS]
3. Update any relevant documentation files
4. Create a descriptive commit message that:
   - Follows conventional commits format
   - Describes what was implemented
   - References the roadmap item ID
   - Example: 'feat($item_id): implement $item_name'
5. Commit all changes with the Co-Authored-By line
6. Push to GitHub
7. When complete, output 'DEPLOYMENT COMPLETE' and exit

This is the final stage - make sure everything is committed and pushed."

    if ! run_claude_stage 3 "Commit & Push" "$stage3_prompt"; then
        log_error "Stage 3 failed"
        exit 1
    fi

    log "═══════════════════════════════════════════════════════════"
    log_success "ORCHESTRATION COMPLETE"
    log_success "Item $item_id ($item_name) has been implemented, tested, and deployed"
    log "═══════════════════════════════════════════════════════════"
}

# Function to test with a specific item (for testing the orchestrator)
test_orchestrator() {
    local test_item="$1"

    log "═══════════════════════════════════════════════════════════"
    log "TEST MODE: Marking item $test_item as DONE"
    log "═══════════════════════════════════════════════════════════"

    # For testing, we'll just mark an item as done without running the stages
    mark_item_status "$test_item" "IN-PROGRESS"
    sleep 2
    mark_item_status "$test_item" "DONE"

    log_success "Test complete: $test_item marked as DONE"
}

# Parse command line arguments
case "${1:-}" in
    --test)
        if [ -z "$2" ]; then
            log_error "Usage: $0 --test <ITEM_ID>"
            log_error "Example: $0 --test D1"
            exit 1
        fi
        test_orchestrator "$2"
        ;;
    --help|-h)
        echo "Graceful Books Development Orchestrator"
        echo ""
        echo "Usage:"
        echo "  $0              Run full orchestration (find next item, implement, test, commit)"
        echo "  $0 --test ID    Test mode: mark item ID as done without running stages"
        echo "  $0 --help       Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0              # Run orchestration for next unclaimed item"
        echo "  $0 --test D1    # Test by marking D1 as done"
        ;;
    "")
        # No arguments - run full orchestration
        orchestrate_development
        ;;
    *)
        log_error "Unknown argument: $1"
        log_error "Use --help for usage information"
        exit 1
        ;;
esac
