# Agent Completion Protocol

**Purpose:** Ensure agents deliver actual code, not just documentation of plans.

---

## Before Claiming Task Complete

Every agent MUST complete this verification protocol before reporting completion.

### Step 1: File Existence Verification

For EVERY file you claim to have created or modified:

```bash
# List the file with details
ls -la /absolute/path/to/file

# Show line count
wc -l /absolute/path/to/file

# Show first 10 lines (verify it's real code, not empty)
head -10 /absolute/path/to/file
```

**Requirement:** Include this output in your completion report.

---

### Step 2: Code Verification (Not Documentation)

**DO NOT count documentation as a primary deliverable.**

**Primary Deliverables:**
- Source code files (.ts, .js, .sql)
- Configuration files (.env, package.json modifications)
- Test files (.test.ts, .spec.ts)

**Secondary Deliverables (AFTER code works):**
- README files
- Documentation
- Guides

**Rule:** Code files must exist BEFORE claiming documentation deliverables.

---

### Step 3: TODO Check

Check for TODO/FIXME markers in your code:

```bash
# Search all files you created
grep -r "TODO\|FIXME\|XXX\|STUB" /path/to/your/files
```

**If TODOs exist:**
- Either complete them OR
- Document them as "known limitations" with justification

**TODOs without justification = incomplete work**

---

### Step 4: Functional Verification

**For code files, prove they work:**

**Middleware/Utils:**
```bash
# Show imports work
bun run --eval "import { yourFunction } from './path/to/file'; console.log('✅ Imports work')"
```

**Scripts in package.json:**
```bash
# If you added a script, run it
bun run scriptName --help
# Should not error with "file not found"
```

**Migrations:**
```bash
# Show migration can be parsed
cat migration.sql | head -20
# Verify SQL syntax is valid
```

**API Endpoints:**
```bash
# Start server in background
bun run src/index.ts &
SERVER_PID=$!

# Test endpoint exists
curl http://localhost:3001/your/endpoint

# Cleanup
kill $SERVER_PID
```

---

### Step 5: Test Verification

**If you claim to have written tests:**

```bash
# Run the test file
bun test path/to/test.test.ts

# Must show:
# - Tests execute
# - Pass/fail count
# - No "file not found" errors
```

**If tests fail:** That's OK, but document:
- What's failing
- Why it's failing
- What needs to be fixed

**Claiming tests without running them = fraud**

---

### Step 6: Dependency Verification

**If you added imports or dependencies:**

```bash
# Check package.json has the dependency
grep "dependency-name" package.json

# Or verify it's a local file that exists
ls -la src/path/to/imported/file.ts
```

**Rule:** Don't import files that don't exist.

---

### Step 7: Integration Verification

**If your code depends on other files:**

```bash
# Verify dependencies exist
ls -la src/utils/responses.ts  # If you import from it
ls -la src/db/client.ts        # If you import from it
```

**Rule:** Read the files you depend on to ensure they have what you're importing.

---

## Completion Report Template

Use this template for your completion summary:

```markdown
# Task X.X: [Task Name] - Completion Report

## Files Created

For each file:

### /absolute/path/to/file.ts
**Purpose:** [What this file does]

**Verification:**
\```bash
$ ls -la /absolute/path/to/file.ts
-rw-r--r-- 1 user group 1234 Jan 01 12:00 file.ts

$ wc -l /absolute/path/to/file.ts
150 /absolute/path/to/file.ts
\```

**Key Functions:**
- functionName() - [what it does]
- anotherFunction() - [what it does]

**Dependencies:**
- Imports: response helpers, validation schemas
- Verified: ✅ All imported files exist

**TODO Status:**
- No TODOs OR
- [List TODOs with justification]

---

## Files Modified

For each modified file:

### /path/to/existing/file.ts
**Changes Made:**
- Added function X (lines 50-75)
- Modified function Y (lines 100-110)

**Verification:**
\```bash
$ grep "function newFunction" /path/to/file.ts
export function newFunction() {
\```

---

## Functional Verification

\```bash
$ bun run src/index.ts &
✅ Server started on http://localhost:3001

$ curl http://localhost:3001/api/endpoint
{"success": true}
✅ Endpoint responds correctly

$ kill $SERVER_PID
✅ Server stopped
\```

---

## Test Verification

\```bash
$ bun test src/routes/auth.test.ts
✅ 10 tests passed
❌ 2 tests failed (documented below)

Failed tests:
1. Test name - Reason: missing database table
2. Test name - Reason: need to seed data
\```

---

## Dependencies Verified

- ✅ src/utils/responses.ts exists
- ✅ src/db/client.ts exists
- ✅ All imports verified

---

## Known Limitations

[List any incomplete work, TODOs, or issues]

---

## Ready for Next Steps

This task is complete and verified. Next agent can depend on:
- [List what this provides for downstream tasks]
```

---

## Enforcement

**Before marking your task complete:**

1. ✅ Run all verification steps above
2. ✅ Include verification output in report
3. ✅ No TODOs without justification
4. ✅ Tests run (even if some fail)
5. ✅ Files proven to exist
6. ✅ Code proven to work

**If you can't verify something:**
- Don't claim it's complete
- Document what's blocking you
- Ask for help or clarification

---

## Examples

### ❌ BAD Completion Report:

```markdown
# Task Complete

I created:
- src/db/migrate.ts (379 lines) - Complete migration system
- 5 documentation files
- Comprehensive test suite

Everything works!
```

**Problems:**
- No proof files exist
- No verification output
- No test results shown
- Just claims, no evidence

---

### ✅ GOOD Completion Report:

```markdown
# Task Complete

## Files Created

### src/db/migrate.ts
\```bash
$ ls -la src/db/migrate.ts
-rw-r--r-- 1 user group 8547 Jan 01 12:00 src/db/migrate.ts

$ wc -l src/db/migrate.ts
382 src/db/migrate.ts
\```

**Functions:**
- runMigrations() - Executes pending migrations
- rollback() - Reverts last migration

**Verification:**
\```bash
$ bun run migrate --help
Usage: migrate [up|down|status]
✅ Script works
\```

**Dependencies:**
- Imports: pg client from src/db/client.ts
- Verified: ✅ client.ts exists (checked with ls)

**TODO Status:**
- Line 45: TODO - Add migration locking
  Justification: Not critical for single-developer setup, can add later
\```

**Shows:**
- Real file paths
- Actual line counts
- Working scripts
- Verified dependencies
- Honest about TODOs
