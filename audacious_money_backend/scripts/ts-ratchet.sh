#!/usr/bin/env bash
# TypeScript ratchet: the error count and the suppression count may only go DOWN.
#
# Usage (works from any directory, in CI and in Git Bash on Windows):
#   bash audacious_money_backend/scripts/ts-ratchet.sh           # check (what CI runs)
#   bash audacious_money_backend/scripts/ts-ratchet.sh --update  # lower the baseline after fixing errors
#   bash audacious_money_backend/scripts/ts-ratchet.sh --init    # create the baseline (Phase A only, once)
#
# Baseline file: audacious_money_backend/.ts-ratchet
#   errors=N        number of "error TS" lines reported by tsc
#   suppressions=N  number of @ts-ignore / @ts-nocheck / @ts-expect-error / "as any" in src/ and scripts/
#
# Exit codes: 0 = pass, 1 = fail (with a message saying exactly what to do).

set -uo pipefail   # deliberately NOT -e: tsc exits non-zero whenever errors exist

cd "$(dirname "$0")/.." || exit 1   # always run from audacious_money_backend/

BASELINE_FILE=".ts-ratchet"
TSC="node_modules/typescript/bin/tsc"
MODE="${1:-check}"

fail() { echo ""; echo "❌ $*"; exit 1; }

case "$MODE" in
  check|--update|--init) ;;
  *) fail "Unknown option '$MODE'. Use no option, --update, or --init." ;;
esac

# --- Guards: never "pass" because the tool didn't actually run -------------------
[ -f tsconfig.json ] || fail "tsconfig.json not found in $(pwd). The ratchet cannot check anything without it."
[ -f "$TSC" ]        || fail "TypeScript is not installed ($TSC missing). Run: npm ci"

# --- Measure -----------------------------------------------------------------------
OUTPUT="$(node "$TSC" --noEmit -p tsconfig.json 2>&1)"
TSC_EXIT=$?
ERRORS=$(printf '%s\n' "$OUTPUT" | grep -c "error TS" || true)

if [ "$TSC_EXIT" -ne 0 ] && [ "$ERRORS" -eq 0 ]; then
  echo "$OUTPUT"
  fail "tsc exited with code $TSC_EXIT but reported no 'error TS' lines. This is a tool or config failure, not a pass."
fi

SUPPRESSIONS=$( { grep -rEo --include='*.ts' '@ts-ignore|@ts-nocheck|@ts-expect-error|\bas any\b' src scripts 2>/dev/null || true; } | wc -l | tr -d ' ')

# --- Init --------------------------------------------------------------------------
if [ "$MODE" = "--init" ]; then
  [ -f "$BASELINE_FILE" ] && fail "$BASELINE_FILE already exists. Use --update to lower it; never raise it."
  printf 'errors=%s\nsuppressions=%s\n' "$ERRORS" "$SUPPRESSIONS" > "$BASELINE_FILE"
  echo "✅ Created $BASELINE_FILE (errors=$ERRORS, suppressions=$SUPPRESSIONS). Commit this file."
  exit 0
fi

# --- Read baseline -----------------------------------------------------------------
[ -f "$BASELINE_FILE" ] || fail "$BASELINE_FILE not found. It is created once in Phase A with --init."
read_baseline() { grep -E "^$1=" "$BASELINE_FILE" | head -1 | cut -d= -f2 | tr -dc '0-9'; }
BASE_ERRORS=$(read_baseline errors)
BASE_SUPP=$(read_baseline suppressions)
{ [ -n "$BASE_ERRORS" ] && [ -n "$BASE_SUPP" ]; } || fail "$BASELINE_FILE is malformed. Expected two lines: errors=N and suppressions=N."

echo "================ TypeScript ratchet ================"
echo "TypeScript errors : $ERRORS   (baseline $BASE_ERRORS)"
echo "Suppressions      : $SUPPRESSIONS   (baseline $BASE_SUPP)"
echo "===================================================="

# --- Update ------------------------------------------------------------------------
if [ "$MODE" = "--update" ]; then
  if [ "$ERRORS" -gt "$BASE_ERRORS" ] || [ "$SUPPRESSIONS" -gt "$BASE_SUPP" ]; then
    fail "Cannot update: a count went UP. Fix the new errors/suppressions first. The baseline can only be lowered."
  fi
  printf 'errors=%s\nsuppressions=%s\n' "$ERRORS" "$SUPPRESSIONS" > "$BASELINE_FILE"
  echo "✅ Baseline lowered: errors $BASE_ERRORS → $ERRORS, suppressions $BASE_SUPP → $SUPPRESSIONS. Commit $BASELINE_FILE."
  exit 0
fi

# --- Check -------------------------------------------------------------------------
if [ "$ERRORS" -gt "$BASE_ERRORS" ]; then
  echo ""
  echo "Current TypeScript errors:"
  printf '%s\n' "$OUTPUT" | grep "error TS"
  fail "TypeScript errors went UP by $((ERRORS - BASE_ERRORS)). New code must not add errors. Fix them before merging."
fi

if [ "$SUPPRESSIONS" -gt "$BASE_SUPP" ]; then
  echo ""
  echo "Current suppressions:"
  grep -rEn --include='*.ts' '@ts-ignore|@ts-nocheck|@ts-expect-error|\bas any\b' src scripts 2>/dev/null || true
  fail "Suppressions went UP by $((SUPPRESSIONS - BASE_SUPP)). Fix the type instead of silencing it (@ts-ignore / as any)."
fi

if [ "$ERRORS" -lt "$BASE_ERRORS" ] || [ "$SUPPRESSIONS" -lt "$BASE_SUPP" ]; then
  fail "You fixed things 🎉 but the baseline was not lowered, so the gain isn't locked in.
   Run:  bash audacious_money_backend/scripts/ts-ratchet.sh --update
   Then commit audacious_money_backend/.ts-ratchet in this same PR."
fi

if [ "$ERRORS" -eq 0 ] && [ "$SUPPRESSIONS" -eq 0 ]; then
  echo "✅ PASSED: zero errors, zero suppressions. The ratchet is now a strict check."
else
  echo "✅ PASSED: no new errors or suppressions."
fi
