#!/usr/bin/env bash
# ESLint ratchet: the error count may only go DOWN.
#
# Usage (works from any directory, in CI and in Git Bash on Windows):
#   bash scripts/eslint-ratchet.sh           # check (what CI runs)
#   bash scripts/eslint-ratchet.sh --update  # lower the baseline after fixing errors
#   bash scripts/eslint-ratchet.sh --init    # create the baseline (once)
#
# Baseline file: .eslint-ratchet
#   errors=N        number of ESLint errors
#   warnings=N      number of ESLint warnings (tracked but not enforced)
#
# Exit codes: 0 = pass, 1 = fail (with a message saying exactly what to do).

set -uo pipefail   # deliberately NOT -e: eslint exits non-zero when errors exist

cd "$(dirname "$0")/.." || exit 1   # always run from repo root

BASELINE_FILE=".eslint-ratchet"
MODE="${1:-check}"

fail() { echo ""; echo "❌ $*"; exit 1; }

case "$MODE" in
  check|--update|--init) ;;
  *) fail "Unknown option '$MODE'. Use no option, --update, or --init." ;;
esac

# --- Guards: never "pass" because the tool didn't actually run -------------------
[ -f package.json ] || fail "package.json not found in $(pwd). The ratchet cannot check anything without it."
[ -d node_modules ] || fail "node_modules not found. Run: npm ci"

# --- Measure -----------------------------------------------------------------------
echo "Running ESLint (this may take a minute)..."
OUTPUT="$(npm run lint 2>&1 || true)"

# Extract error and warning counts from ESLint output
# ESLint outputs: "X 3434 problems (3275 errors, 159 warnings)"
if echo "$OUTPUT" | grep -q "problems"; then
  ERRORS=$(echo "$OUTPUT" | grep -oE '[0-9]+ errors' | grep -oE '[0-9]+' | head -1)
  WARNINGS=$(echo "$OUTPUT" | grep -oE '[0-9]+ warnings' | grep -oE '[0-9]+' | head -1)
else
  # No problems found
  ERRORS=0
  WARNINGS=0
fi

# Default to 0 if grep didn't find anything
ERRORS=${ERRORS:-0}
WARNINGS=${WARNINGS:-0}

# --- Init --------------------------------------------------------------------------
if [ "$MODE" = "--init" ]; then
  [ -f "$BASELINE_FILE" ] && fail "$BASELINE_FILE already exists. Use --update to lower it; never raise it."
  printf 'errors=%s\nwarnings=%s\n' "$ERRORS" "$WARNINGS" > "$BASELINE_FILE"
  echo "✅ Created $BASELINE_FILE (errors=$ERRORS, warnings=$WARNINGS). Commit this file."
  exit 0
fi

# --- Read baseline -----------------------------------------------------------------
[ -f "$BASELINE_FILE" ] || fail "$BASELINE_FILE not found. Create it with: bash scripts/eslint-ratchet.sh --init"
read_baseline() { grep -E "^$1=" "$BASELINE_FILE" | head -1 | cut -d= -f2 | tr -dc '0-9'; }
BASE_ERRORS=$(read_baseline errors)
BASE_WARNINGS=$(read_baseline warnings)
{ [ -n "$BASE_ERRORS" ] && [ -n "$BASE_WARNINGS" ]; } || fail "$BASELINE_FILE is malformed. Expected two lines: errors=N and warnings=N."

echo "=================== ESLint ratchet ==================="
echo "ESLint errors   : $ERRORS   (baseline $BASE_ERRORS)"
echo "ESLint warnings : $WARNINGS   (baseline $BASE_WARNINGS)"
echo "======================================================="

# --- Update ------------------------------------------------------------------------
if [ "$MODE" = "--update" ]; then
  if [ "$ERRORS" -gt "$BASE_ERRORS" ]; then
    fail "Cannot update: error count went UP. Fix the new errors first. The baseline can only be lowered."
  fi
  printf 'errors=%s\nwarnings=%s\n' "$ERRORS" "$WARNINGS" > "$BASELINE_FILE"
  echo "✅ Baseline lowered: errors $BASE_ERRORS → $ERRORS, warnings $BASE_WARNINGS → $WARNINGS. Commit $BASELINE_FILE."
  exit 0
fi

# --- Check -------------------------------------------------------------------------
if [ "$ERRORS" -gt "$BASE_ERRORS" ]; then
  echo ""
  echo "Recent ESLint output:"
  echo "$OUTPUT" | tail -30
  fail "ESLint errors went UP by $((ERRORS - BASE_ERRORS)). New code must not add errors. Fix them before merging."
fi

if [ "$ERRORS" -lt "$BASE_ERRORS" ]; then
  fail "You fixed things! But the baseline was not lowered, so the gain isn't locked in.
   Run:  bash scripts/eslint-ratchet.sh --update
   Then commit .eslint-ratchet in this same PR."
fi

if [ "$ERRORS" -eq 0 ]; then
  echo "✅ PASSED: zero ESLint errors. The ratchet is now a strict check."
else
  echo "✅ PASSED: no new ESLint errors (baseline: $BASE_ERRORS)."
fi
