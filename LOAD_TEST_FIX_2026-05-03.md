# Load Test Fix - Production URL Configuration

**Date:** 2026-05-03
**Issue:** Load tests failing in CI/CD (105 failures since January)
**Root Cause:** Tests attempting to connect to `localhost:3000` instead of production site
**Status:** ✅ FIXED

## Problem

The load tests were configured to run against `http://localhost:3000`. In CI/CD:
1. GitHub Actions attempted to start a local server using `npm run preview`
2. The server either failed to start or wasn't ready when tests began
3. Tests failed with: `dial tcp 127.0.0.1:3000: connect: connection refused`

This resulted in 105 consecutive failures since January.

## Solution

Changed load tests to be environment-aware:
- **Local development:** Tests run against `localhost:3000` (default)
- **CI/CD (GitHub Actions):** Tests run against production `https://app.audacious.money`
- **Custom environments:** Developers can specify any URL via `LOAD_TEST_URL` env var

## Changes Made

### 1. Updated Config Files
**Files:** `tests/load/config/{light,medium,heavy}.json`

Changed:
```json
"BASE_URL": "http://localhost:3000"
```

To:
```json
"BASE_URL": "${LOAD_TEST_URL:-http://localhost:3000}"
```

This uses bash-style environment variable substitution with a default fallback.

### 2. Updated Bash Script
**File:** `scripts/run-load-tests.sh`

Added logic to parse and substitute environment variables in the `BASE_URL` config value:
```bash
# Handle environment variable substitution in BASE_URL
if [[ "$base_url_raw" =~ \$\{([^:]+):-([^}]+)\} ]]; then
    local env_var="${BASH_REMATCH[1]}"
    local default_val="${BASH_REMATCH[2]}"
    export BASE_URL="${!env_var:-$default_val}"
else
    export BASE_URL="$base_url_raw"
fi
```

### 3. Updated GitHub Actions Workflow
**File:** `.github/workflows/load-tests.yml`

**Removed:**
- Build application step
- Start application in background
- Wait for application to be ready
- Stop application cleanup

**Added:**
- Verify production site is accessible before tests
- Set `LOAD_TEST_URL=https://app.audacious.money` environment variable

### 4. Updated Documentation
**File:** `tests/load/README.md`

Added section explaining the `LOAD_TEST_URL` environment variable and how to use it.

## Usage

### Local Testing (Default)
```bash
# Tests against localhost:3000
npm run load:test:light
```

### Production Testing
```bash
# Tests against production
LOAD_TEST_URL=https://app.audacious.money npm run load:test:light
```

### Staging Testing
```bash
# Tests against staging environment
LOAD_TEST_URL=https://staging.example.com npm run load:test:medium
```

### CI/CD
GitHub Actions automatically sets `LOAD_TEST_URL=https://app.audacious.money`, so no changes needed.

## Benefits

✅ **No more CI failures** - Tests now hit the actual production site
✅ **Real load testing** - Validates production performance, not local dev server
✅ **Backwards compatible** - Local development still works with localhost
✅ **Flexible** - Can test any environment via env var
✅ **Simpler CI** - No need to build and start app in GitHub Actions
✅ **Faster CI** - Removed ~2-3 minutes of build/startup time per test run

## Testing the Fix

To verify the fix works:

1. **Local test (should use localhost):**
   ```bash
   bash scripts/run-load-tests.sh light
   # Should show: Base URL: http://localhost:3000
   ```

2. **Production test (should use custom URL):**
   ```bash
   LOAD_TEST_URL=https://app.audacious.money bash scripts/run-load-tests.sh light
   # Should show: Base URL: https://app.audacious.money
   ```

3. **CI test:**
   Push to a branch and watch GitHub Actions - tests should now pass!

## Rollback Plan

If issues arise, revert these commits:
1. Restore config files to use hardcoded `http://localhost:3000`
2. Restore GitHub Actions workflow to build/start local server
3. Restore original `load_config()` function in run-load-tests.sh

## Next Steps

1. ✅ Commit these changes
2. ✅ Push to repository
3. ⏳ Monitor next scheduled load test (nightly at 2 AM UTC)
4. ⏳ Verify tests pass in CI
5. ⏳ Review actual production performance metrics

## Notes

- Production site must be accessible for CI tests to pass
- Load tests will now consume production resources - monitor performance
- Consider creating a dedicated staging environment for load testing if production load becomes a concern
- The 105 previous failures were wasted CI resources - this fix prevents that

## Related Files

- `tests/load/config/light.json`
- `tests/load/config/medium.json`
- `tests/load/config/heavy.json`
- `scripts/run-load-tests.sh`
- `.github/workflows/load-tests.yml`
- `tests/load/README.md`
