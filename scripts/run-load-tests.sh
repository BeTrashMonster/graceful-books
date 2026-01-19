#!/bin/bash

###############################################################################
# Load Testing Runner Script
#
# Runs k6 load tests with various configurations.
# Supports light, medium, heavy, and all test profiles.
#
# Requirements:
# - I7: Load Testing Infrastructure
# - k6 installed (https://k6.io/docs/getting-started/installation/)
#
# Usage:
#   ./scripts/run-load-tests.sh [light|medium|heavy|all]
#
# Examples:
#   npm run load:test:light   # 100 VUs, 5 minutes
#   npm run load:test:medium  # 500 VUs, 10 minutes
#   npm run load:test:heavy   # 1000 VUs, 15 minutes
#   npm run load:test:all     # Run all profiles sequentially
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOAD_DIR="$PROJECT_ROOT/tests/load"
CONFIG_DIR="$LOAD_DIR/config"
SCENARIOS_DIR="$LOAD_DIR/scenarios"
RESULTS_DIR="$LOAD_DIR/results"
BASELINES_DIR="$LOAD_DIR/baselines"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Check if k6 is installed
check_k6_installed() {
    if ! command -v k6 &> /dev/null; then
        echo -e "${RED}Error: k6 is not installed${NC}"
        echo ""
        echo "Install k6:"
        echo "  macOS:   brew install k6"
        echo "  Windows: choco install k6"
        echo "  Linux:   snap install k6"
        echo "  Or visit: https://k6.io/docs/getting-started/installation/"
        echo ""
        exit 1
    fi
}

# Print header
print_header() {
    local title="$1"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $title${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Load configuration
load_config() {
    local profile="$1"
    local config_file="$CONFIG_DIR/$profile.json"

    if [ ! -f "$config_file" ]; then
        echo -e "${RED}Error: Config file not found: $config_file${NC}"
        exit 1
    fi

    # Extract environment variables from config
    # Note: This is a simple implementation. For production, consider using jq
    export BASE_URL=$(grep -o '"BASE_URL": *"[^"]*"' "$config_file" | cut -d'"' -f4)
    export VUS_START=$(grep -o '"VUS_START": *"[^"]*"' "$config_file" | cut -d'"' -f4)
    export VUS_PEAK=$(grep -o '"VUS_PEAK": *"[^"]*"' "$config_file" | cut -d'"' -f4)
    export CONFLICT_VUS=$(grep -o '"CONFLICT_VUS": *"[^"]*"' "$config_file" | cut -d'"' -f4)
    export LIGHT_USERS=$(grep -o '"LIGHT_USERS": *"[^"]*"' "$config_file" | cut -d'"' -f4)
    export ACTIVE_USERS=$(grep -o '"ACTIVE_USERS": *"[^"]*"' "$config_file" | cut -d'"' -f4)
    export POWER_USERS=$(grep -o '"POWER_USERS": *"[^"]*"' "$config_file" | cut -d'"' -f4)

    echo -e "${GREEN}Configuration loaded: $profile${NC}"
    echo "  Base URL: $BASE_URL"
    echo "  Peak VUs: $VUS_PEAK"
}

# Run a single load test scenario
run_scenario() {
    local scenario="$1"
    local profile="$2"
    local scenario_file="$SCENARIOS_DIR/$scenario.js"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local result_file="$RESULTS_DIR/${profile}_${scenario}_${timestamp}.json"
    local html_report="$RESULTS_DIR/${profile}_${scenario}_${timestamp}.html"

    if [ ! -f "$scenario_file" ]; then
        echo -e "${RED}Error: Scenario file not found: $scenario_file${NC}"
        return 1
    fi

    echo ""
    echo -e "${YELLOW}Running scenario: $scenario${NC}"
    echo "  Profile: $profile"
    echo "  Output: $result_file"
    echo ""

    # Run k6 with JSON output and HTML report
    if k6 run \
        --out json="$result_file" \
        --summary-export="$RESULTS_DIR/${profile}_${scenario}_${timestamp}_summary.json" \
        "$scenario_file"; then
        echo -e "${GREEN}✓ Scenario completed: $scenario${NC}"

        # Generate HTML report if k6-reporter is available
        if command -v k6-to-html &> /dev/null; then
            k6-to-html "$result_file" "$html_report"
            echo -e "${GREEN}  HTML report: $html_report${NC}"
        fi

        return 0
    else
        echo -e "${RED}✗ Scenario failed: $scenario${NC}"
        return 1
    fi
}

# Run all scenarios for a profile
run_profile() {
    local profile="$1"

    print_header "Load Testing Profile: $profile"

    load_config "$profile"

    local scenarios=("sync-relay" "crdt-conflicts" "mixed-workload")
    local failed=0

    for scenario in "${scenarios[@]}"; do
        if ! run_scenario "$scenario" "$profile"; then
            ((failed++))
        fi

        # Brief pause between scenarios
        if [ "$scenario" != "${scenarios[-1]}" ]; then
            echo ""
            echo "Cooling down for 10 seconds..."
            sleep 10
        fi
    done

    echo ""
    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}✓ All scenarios completed successfully for $profile${NC}"
    else
        echo -e "${RED}✗ $failed scenario(s) failed for $profile${NC}"
    fi

    return $failed
}

# Compare results with baseline
compare_with_baseline() {
    local profile="$1"

    echo ""
    echo -e "${YELLOW}Comparing results with baseline...${NC}"

    # This is a placeholder for baseline comparison
    # In a real implementation, you would:
    # 1. Load baseline metrics from BASELINE.md or a JSON file
    # 2. Load current test results
    # 3. Calculate percentage differences
    # 4. Flag regressions that exceed thresholds

    echo "  Baseline comparison not yet implemented"
    echo "  See: $BASELINES_DIR/BASELINE.md"
}

# Generate summary report
generate_summary() {
    local profile="$1"

    echo ""
    echo -e "${BLUE}Test Summary${NC}"
    echo "  Profile: $profile"
    echo "  Results directory: $RESULTS_DIR"
    echo ""
    echo "Latest results:"
    ls -lt "$RESULTS_DIR" | grep "$profile" | head -5
}

# Main execution
main() {
    local mode="${1:-light}"

    check_k6_installed

    print_header "Graceful Books Load Testing"

    echo "Mode: $mode"
    echo "Project root: $PROJECT_ROOT"
    echo ""

    case "$mode" in
        light)
            run_profile "light"
            local exit_code=$?
            compare_with_baseline "light"
            generate_summary "light"
            exit $exit_code
            ;;
        medium)
            run_profile "medium"
            local exit_code=$?
            compare_with_baseline "medium"
            generate_summary "medium"
            exit $exit_code
            ;;
        heavy)
            run_profile "heavy"
            local exit_code=$?
            compare_with_baseline "heavy"
            generate_summary "heavy"
            exit $exit_code
            ;;
        all)
            echo "Running all load test profiles sequentially..."
            echo ""

            local total_failed=0

            run_profile "light"
            ((total_failed += $?))
            sleep 30  # Cool down between profiles

            run_profile "medium"
            ((total_failed += $?))
            sleep 30

            run_profile "heavy"
            ((total_failed += $?))

            print_header "All Tests Complete"

            if [ $total_failed -eq 0 ]; then
                echo -e "${GREEN}✓ All profiles completed successfully${NC}"
            else
                echo -e "${RED}✗ Some tests failed${NC}"
            fi

            echo ""
            echo "Results stored in: $RESULTS_DIR"

            exit $total_failed
            ;;
        *)
            echo -e "${RED}Error: Invalid mode: $mode${NC}"
            echo ""
            echo "Usage: $0 [light|medium|heavy|all]"
            echo ""
            echo "Modes:"
            echo "  light   - 100 VUs, 5 minutes (PR validation)"
            echo "  medium  - 500 VUs, 10 minutes (nightly tests)"
            echo "  heavy   - 1000 VUs, 15 minutes (stress testing)"
            echo "  all     - Run all profiles sequentially"
            echo ""
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
