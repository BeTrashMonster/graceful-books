# CI/CD Workflow Diagram

## High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Developer Action                                 │
│                                                                     │
│  • Push to main/master branch                                      │
│  • Open/update Pull Request                                        │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 GitHub Actions Trigger                              │
│                                                                     │
│  Workflow: CI (.github/workflows/ci.yml)                           │
│  Concurrency: Auto-cancel outdated runs                            │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────┴────────────┐
            │   Parallel Execution    │
            └────────────┬────────────┘
                         │
         ┌───────────────┼───────────────┬─────────────┐
         │               │               │             │
         ▼               ▼               ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│    Lint     │ │    Test     │ │    Build    │ │  Security   │
│     Job     │ │     Job     │ │     Job     │ │  Scan Job   │
│             │ │             │ │             │ │             │
│ • ESLint    │ │ • Unit      │ │ • TypeScript│ │ • npm audit │
│ • TS Check  │ │ • Integration│ │   Compile   │ │ • Snyk      │
│             │ │ • Coverage  │ │ • Vite Build│ │   (optional)│
│             │ │             │ │ • Artifacts │ │             │
│ ~1 min      │ │ ~2 min      │ │ ~1 min      │ │ ~30 sec     │
└──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
       │               │               │               │
       └───────────────┴───────────────┴───────────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Dependencies  │
                 │   Met? ✓      │
                 └───────┬───────┘
                         │
                         ▼
                 ┌─────────────┐
                 │   E2E Test  │
                 │     Job     │
                 │             │
                 │ • Playwright│
                 │ • Chromium  │
                 │ • Reports   │
                 │             │
                 │ ~3 min      │
                 └──────┬──────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
         ▼                             ▼
   ┌──────────┐                 ┌──────────┐
   │   All    │                 │   Any    │
   │  Pass?   │                 │  Fail?   │
   │    ✓     │                 │    ✗     │
   └────┬─────┘                 └────┬─────┘
        │                            │
        ▼                            ▼
┌──────────────┐            ┌──────────────┐
│ CI Success   │            │ CI Success   │
│     Job      │            │     Job      │
│              │            │              │
│  Status: ✓   │            │  Status: ✗   │
└──────┬───────┘            └──────┬───────┘
       │                           │
       ▼                           ▼
┌──────────────┐            ┌──────────────┐
│ PR Can Merge │            │ PR Blocked   │
│   (if all    │            │ From Merge   │
│  conditions  │            │              │
│    met)      │            │ Fix Required │
└──────────────┘            └──────────────┘
```

## Detailed Job Flow

### Phase 1: Parallel Checks (0-2 minutes)

```
START
  │
  ├─► [Lint Job]
  │     │
  │     ├─► Checkout code
  │     ├─► Setup Node.js 18 (with npm cache)
  │     ├─► npm ci
  │     ├─► npm run lint ───────────► ESLint checks
  │     └─► npm run type-check ─────► TypeScript validation
  │
  ├─► [Test Job]
  │     │
  │     ├─► Checkout code
  │     ├─► Setup Node.js 18 (with npm cache)
  │     ├─► npm ci
  │     ├─► npm run test:coverage ──► Run all tests
  │     ├─► Upload to Codecov ──────► Coverage tracking
  │     └─► Check thresholds ───────► Enforce 80% minimum
  │
  ├─► [Build Job]
  │     │
  │     ├─► Checkout code
  │     ├─► Setup Node.js 18 (with npm cache)
  │     ├─► npm ci
  │     ├─► npm run build ──────────► Production build
  │     └─► Upload artifacts ───────► Store dist/ folder
  │
  └─► [Security Scan Job]
        │
        ├─► Checkout code
        ├─► Setup Node.js 18 (with npm cache)
        ├─► npm ci
        ├─► npm audit ────────────────► Check vulnerabilities
        └─► Snyk scan (if token set) ► Advanced scanning
```

### Phase 2: E2E Tests (2-5 minutes)

```
WAIT for: [Lint, Test, Build, Security] to complete
  │
  ▼
[E2E Job]
  │
  ├─► Checkout code
  ├─► Setup Node.js 18 (with npm cache)
  ├─► npm ci
  ├─► Install Playwright browsers ──► Chromium only
  ├─► Download build artifacts ─────► From Build Job
  ├─► npm run e2e ──────────────────► Run Playwright tests
  └─► Upload Playwright report ─────► On failure only
```

### Phase 3: Final Status (5-8 minutes)

```
WAIT for: [Lint, Test, Build, E2E, Security] to complete
  │
  ▼
[CI Success Job]
  │
  ├─► Check all job results
  │     │
  │     ├─► Lint result: success?
  │     ├─► Test result: success?
  │     ├─► Build result: success?
  │     ├─► E2E result: success?
  │     └─► Security result: success?
  │
  ├─► IF all success
  │     └─► Exit 0 (SUCCESS) ──────────► ✓ PR can merge
  │
  └─► IF any failure
        └─► Exit 1 (FAILURE) ──────────► ✗ PR blocked
```

## Performance Timeline

```
Time     Jobs Running                                    Status
─────────────────────────────────────────────────────────────────
0:00     [Lint] [Test] [Build] [Security] START         In Progress
0:30     [Lint] [Test] [Build] [Security] Running       In Progress
1:00     [Lint✓] [Test] [Build✓] [Security✓]           In Progress
1:30     [Test] Running coverage                        In Progress
2:00     [Test✓] All Phase 1 complete                   In Progress
         [E2E] START (waiting for dependencies)
2:30     [E2E] Installing browsers                      In Progress
3:00     [E2E] Running tests                            In Progress
4:00     [E2E] Generating reports                       In Progress
5:00     [E2E✓] Phase 2 complete                        In Progress
         [CI Success] START
5:30     [CI Success] Checking all results              In Progress
6:00     [CI Success✓] ALL COMPLETE                     ✓ SUCCESS
```

**Total Time: ~5-8 minutes** (target: <10 minutes) ✅

## Caching Strategy

```
┌─────────────────────────────────────────────────────┐
│                   npm Cache                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  First Run (Cold Cache):                           │
│    • npm ci: ~120 seconds                          │
│    • Downloads all dependencies from npm registry  │
│    • Stores in GitHub Actions cache                │
│                                                     │
│  Subsequent Runs (Warm Cache):                     │
│    • npm ci: ~20 seconds                           │
│    • Restores from GitHub Actions cache            │
│    • Only downloads changed packages               │
│                                                     │
│  Cache Key:                                        │
│    • OS: ubuntu-latest                             │
│    • Node version: 18                              │
│    • package-lock.json hash                        │
│                                                     │
│  Time Saved: ~100 seconds per job                  │
│  Total Saved: ~400 seconds (4 parallel jobs)       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Artifact Flow

```
┌─────────────────────────────────────────────────────┐
│                Build Job (Job 3)                    │
│                                                     │
│  npm run build ──► dist/ folder created            │
│                    │                                │
│                    ▼                                │
│              Upload Artifact                        │
│              • Name: build-artifacts                │
│              • Path: dist/                          │
│              • Retention: 7 days                    │
│                    │                                │
└────────────────────┼───────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│                 E2E Job (Job 5)                     │
│                                                     │
│              Download Artifact                      │
│              • Name: build-artifacts                │
│              • Path: dist/                          │
│                    │                                │
│                    ▼                                │
│              Use for E2E tests                      │
│              • Preview server from dist/            │
│              • Test against production build        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Concurrency Control

```
┌─────────────────────────────────────────────────────┐
│              Concurrency Group                      │
│  group: ${{ github.workflow }}-${{ github.ref }}   │
│  cancel-in-progress: true                          │
└─────────────────────────────────────────────────────┘

Example:
  Developer pushes commit A ──► CI Run #1 starts
  Developer pushes commit B ──► CI Run #2 starts
                                 CI Run #1 CANCELLED
  Developer pushes commit C ──► CI Run #3 starts
                                 CI Run #2 CANCELLED

  Result: Only Run #3 completes
  Time saved: 10-16 minutes
  Resources saved: 2 cancelled runs
```

## Error Handling

```
┌─────────────────────────────────────────────────────┐
│                  Job Failures                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Lint Failure:                                     │
│    • Exit code: 1                                  │
│    • Job status: Failed                            │
│    • Downstream: E2E blocked                       │
│    • CI Success: Failed                            │
│                                                     │
│  Test Failure:                                     │
│    • Exit code: 1                                  │
│    • Upload coverage: Still runs (if: always())    │
│    • Job status: Failed                            │
│    • Downstream: E2E blocked                       │
│    • CI Success: Failed                            │
│                                                     │
│  Build Failure:                                    │
│    • Exit code: 1                                  │
│    • Artifacts: Not uploaded                       │
│    • Job status: Failed                            │
│    • Downstream: E2E blocked                       │
│    • CI Success: Failed                            │
│                                                     │
│  E2E Failure:                                      │
│    • Exit code: 1                                  │
│    • Upload report: Still runs (if: always())      │
│    • Job status: Failed                            │
│    • CI Success: Failed                            │
│                                                     │
│  Security Scan Failure:                            │
│    • npm audit: Blocks (critical/high)             │
│    • Snyk: Continue on error                       │
│    • Job status: Failed (if npm audit fails)       │
│    • CI Success: Failed                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Integration with GitHub

```
GitHub Pull Request Interface:
┌─────────────────────────────────────────────────────┐
│  Pull Request #123                                  │
│  feat: Add new feature                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Checks: 6 checks                                   │
│    ✓ lint / Lint & Type Check          (1m 23s)   │
│    ✓ test / Test Suite                 (2m 15s)   │
│    ✓ build / Build Application         (1m 05s)   │
│    ✓ e2e / E2E Tests                    (3m 42s)   │
│    ✓ security-scan / Security Scan     (0m 34s)   │
│    ✓ ci-success / CI Success            (0m 05s)   │
│                                                     │
│  Required checks: 1/1 passing                       │
│    ✓ CI Success                                     │
│                                                     │
│  [Merge pull request ▼]  ← ENABLED                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Secrets & Environment Variables

```
┌─────────────────────────────────────────────────────┐
│              GitHub Secrets (Optional)              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CODECOV_TOKEN                                      │
│    • Used in: Test Job                             │
│    • Purpose: Upload coverage to Codecov           │
│    • Required: No (coverage still runs locally)    │
│                                                     │
│  SNYK_TOKEN                                         │
│    • Used in: Security Scan Job                    │
│    • Purpose: Advanced security scanning           │
│    • Required: No (npm audit still runs)           │
│                                                     │
└─────────────────────────────────────────────────────┘

No secrets required for basic functionality ✓
```

## Legend

```
Symbol   Meaning
─────────────────────────────
  ✓      Success / Passed
  ✗      Failure / Blocked
  ►      Flow direction
  │      Sequence
  ├      Branch
  └      End of branch
  ┌─┐    Container/Box
  ▼      Dependency/Wait
```
