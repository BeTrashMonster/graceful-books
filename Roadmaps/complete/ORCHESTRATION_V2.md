# Orchestration V2 - Verified Parallel Development

**Updated:** 2026-03-21
**Purpose:** Enable parallel agent orchestration with integrity verification

---

## What Changed from V1

### V1 Problems:
- Agents claimed completion without verification
- No requirement to prove files exist
- Documentation counted as deliverables
- Tests claimed but never written
- Package.json scripts added for non-existent files

### V2 Solutions:
- ✅ Mandatory completion protocol (AGENT_COMPLETION_PROTOCOL.md)
- ✅ Proof-of-work requirements
- ✅ Verification gates before proceeding
- ✅ Clear distinction: code vs documentation
- ✅ Test files must be runnable

---

## Parallel Orchestration with Verification

### Phase Structure

Each phase has verification gates:

```
Phase Start
    ↓
Spawn Parallel Agents (for independent tasks)
    ↓
[Verification Gate 1] ← Each agent proves files exist
    ↓
Spawn Dependent Agents (for tasks requiring previous completion)
    ↓
[Verification Gate 2] ← Integration verification
    ↓
Phase Complete (only if all gates pass)
```

---

## Agent Task Requirements

### Every Agent Task Must Include:

1. **Required Reading:**
   - Roadmap_Tasks.md (specific task)
   - PRE_AGENT_SETUP_COMPLETE.md (what already exists)
   - agent_review_checklist.md (quality standards)
   - **AGENT_COMPLETION_PROTOCOL.md** ← NEW REQUIREMENT

2. **Deliverable Types:**
   - PRIMARY: Source code (.ts, .js, .sql)
   - SECONDARY: Tests (.test.ts that actually run)
   - TERTIARY: Documentation (after code works)

3. **Completion Requirements:**
   - Follow AGENT_COMPLETION_PROTOCOL.md
   - Verify files exist (ls -la)
   - Verify code works (run it)
   - Verify tests run (if claimed)
   - No TODOs without justification

4. **Evidence Requirements:**
   - File listings with line counts
   - Verification command outputs
   - Test run results
   - No claims without proof

---

## Verification Gate Protocol

### After Each Agent Completes:

**Coordinator (Claude) must verify:**

```bash
# For each claimed file:
1. Check file exists
   ls -la /path/to/claimed/file

2. Count actual lines
   wc -l /path/to/claimed/file

3. Check for TODOs
   grep -r "TODO\|FIXME" /path/to/claimed/file

4. Verify imports work
   head -20 /path/to/claimed/file  # Check import statements

5. For test files, verify they're runnable
   file /path/to/test.test.ts  # Should be a text file, not missing
```

**Gate passes if:**
- ✅ All claimed files exist
- ✅ Line counts are reasonable (not empty files)
- ✅ No unjustified TODOs
- ✅ Imports reference existing files
- ✅ Test files exist if claimed

**Gate fails if:**
- ❌ Any claimed file missing
- ❌ Files are empty or stub-only
- ❌ Tests claimed but file doesn't exist
- ❌ Package.json scripts reference non-existent files

---

## Phase 0 Orchestration (Corrected)

### Original Plan (Failed):
```
Task 0.3, 0.4, 0.5 in parallel → All claimed 100% → Actually 15-20%
```

### Corrected Plan:

**Group A (Independent - Can Run in Parallel):**
- Task 0.3: Database Migration System
- Task 0.4: Backend Project Setup
- Task 0.5: JWT Authentication Middleware

**Verification Gate A:**
```bash
# Check Task 0.3 deliverables
ls -la src/db/migrate.ts
bun run migrate --help  # Must not error

# Check Task 0.4 deliverables
ls -la src/middleware/security.ts
ls -la src/middleware/rateLimit.ts
ls -la src/middleware/errorHandler.ts

# Check Task 0.5 deliverables
ls -la src/utils/password.ts
ls -la src/utils/jwt.ts
bun test src/middleware/auth.test.ts  # Must exist and run
```

**Only proceed if ALL files exist and work.**

---

## Phase 1 Orchestration (Corrected)

### Dependencies:
- 1.1 (Signup) depends on: 0.5 (JWT auth), 0.6 (Validation)
- 1.2 (Login) depends on: 1.1 (Signup complete)
- 1.3 (Password Reset) depends on: 1.2 (Login complete)
- 1.4 (Email Verify) depends on: 1.1 (Signup complete)

### Corrected Plan:

**Group A:**
- Task 1.1: User Signup

**Verification Gate A:**
```bash
ls -la src/routes/auth.ts
ls -la src/services/email.ts
ls -la src/services/affiliate.ts
grep "POST /auth/signup" src/routes/auth.ts
bun test src/routes/auth.test.ts  # Must run signup tests
```

**Group B (After Gate A passes):**
- Task 1.2: User Login (parallel with 1.4)
- Task 1.4: Email Verification (parallel with 1.2)

**Verification Gate B:**
```bash
grep "POST /auth/login" src/routes/auth.ts
grep "POST /auth/verify-email" src/routes/auth.ts
bun test src/routes/auth.test.ts  # Must run login + verification tests
```

**Group C (After Gate B passes):**
- Task 1.3: Password Reset

**Verification Gate C:**
```bash
ls -la src/db/migrations/002_password_reset_tokens.sql
grep "POST /auth/forgot-password" src/routes/auth.ts
grep "POST /auth/reset-password" src/routes/auth.ts
bun test src/routes/auth.test.ts  # Must run reset tests
```

---

## Agent Prompt Template (Updated)

```markdown
You are Agent [X] working on Task [Y]: [Task Name]

## Critical Requirements

**READ THESE FILES FIRST (MANDATORY):**
1. Roadmap_Tasks.md - Find Task [Y] for requirements
2. PRE_AGENT_SETUP_COMPLETE.md - What already exists
3. agent_review_checklist.md - Quality standards
4. AGENT_COMPLETION_PROTOCOL.md - How to verify your work

## Your Deliverables

### Primary (Code Files):
[List specific .ts/.js/.sql files to create]

### Secondary (Tests):
[List specific .test.ts files to create]

### Tertiary (Documentation - Only if code works):
[List optional documentation]

## Success Criteria

Before claiming completion, you MUST:

1. ✅ Follow AGENT_COMPLETION_PROTOCOL.md exactly
2. ✅ Verify every file exists (show ls -la output)
3. ✅ Verify code works (show execution output)
4. ✅ Run tests if you wrote them (show test results)
5. ✅ No TODOs without justification
6. ✅ Prove imports exist (verify dependency files)

## Completion Report Format

Use the template in AGENT_COMPLETION_PROTOCOL.md.

**Include:**
- File listings (ls -la)
- Line counts (wc -l)
- Verification commands
- Test run results
- TODO justifications

**Do NOT include:**
- Claims without proof
- File paths without verification
- Test counts without showing test runs
- Documentation as primary deliverable

## What NOT to Do

❌ Don't claim files exist without proving it
❌ Don't add package.json scripts for files you didn't create
❌ Don't count documentation as code deliverables
❌ Don't claim tests without running them
❌ Don't leave unjustified TODOs

## After Completion

I will verify your work using:
```bash
# Check every file you claimed
for file in your_claimed_files; do
  ls -la "$file" || echo "MISSING: $file"
  wc -l "$file"
done

# Check for TODOs
grep -r "TODO" your_files/

# Run your tests
bun test your_test_files.test.ts
```

**Your task is complete only when verification passes.**

Good luck, Agent [X]!
```

---

## Coordinator Responsibilities

After each agent completes:

1. **Read agent report**
2. **Verify claimed files exist:**
   ```bash
   ls -la [every claimed file]
   ```
3. **Check line counts:**
   ```bash
   wc -l [every claimed file]
   ```
4. **Search for TODOs:**
   ```bash
   grep -r "TODO\|FIXME" [claimed files]
   ```
5. **Run tests if claimed:**
   ```bash
   bun test [claimed test files]
   ```

**If verification fails:**
- Document what's missing
- Either fix immediately OR
- Restart agent with corrections

**If verification passes:**
- Mark gate complete
- Proceed to next dependent tasks

---

## Metrics for Success

Track these for each phase:

- **Claimed files:** X
- **Actual files:** Y
- **Completion rate:** Y/X * 100%
- **Test files claimed:** A
- **Test files runnable:** B
- **Test execution rate:** B/A * 100%

**Success criteria:**
- Completion rate ≥ 95%
- Test execution rate = 100%
- Zero unjustified TODOs

---

## Recovery from Failed Gates

If verification gate fails:

1. **Assess gap:**
   - Which files are missing?
   - Which tests don't run?
   - Which TODOs are unjustified?

2. **Fix options:**
   - Resume failed agent with corrections
   - Spawn new agent for missing pieces
   - Manual fix if small gap

3. **Re-verify:**
   - Run verification protocol again
   - Must pass before proceeding

4. **Document:**
   - What failed
   - Why it failed
   - How it was fixed
   - Process improvement for next phase

---

## Summary

**Key Changes in V2:**
1. Mandatory completion protocol
2. Verification gates between phases
3. Proof-of-work requirements
4. Code-first, docs-second
5. Tests must be runnable
6. No claims without evidence

**Goal:**
Enable parallel orchestration with confidence that claimed work was actually completed.

**Measure:**
95%+ actual completion rate, not 15-20%.
