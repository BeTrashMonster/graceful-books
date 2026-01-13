# CI/CD Pipeline Documentation

## Overview

This directory contains GitHub Actions workflows for Continuous Integration and Continuous Deployment (CI/CD) of the Graceful Books application.

## Workflows

### CI Workflow (`ci.yml`)

The main CI workflow runs on every push to `main`/`master` branches and on all pull requests. It ensures code quality, test coverage, and build integrity before code is merged.

#### Jobs

1. **Lint & Type Check** (5 minutes max)
   - Runs ESLint to check code quality and style
   - Runs TypeScript compiler for type checking
   - Fails if any linting errors or type errors are found

2. **Test Suite** (10 minutes max)
   - Runs all unit and integration tests
   - Generates code coverage reports
   - Uploads coverage to Codecov
   - Enforces minimum coverage thresholds (80% for all metrics)

3. **Build Application** (5 minutes max)
   - Builds the production application bundle
   - Uploads build artifacts for later use
   - Verifies the application can be built successfully

4. **E2E Tests** (15 minutes max)
   - Runs end-to-end tests with Playwright
   - Only runs if lint, test, and build jobs pass
   - Uses Chromium browser for consistent testing
   - Uploads Playwright reports on failure

5. **Security Scan** (5 minutes max)
   - Runs `npm audit` to check for known vulnerabilities
   - Runs Snyk security scanning (if token configured)
   - Fails on moderate or higher severity vulnerabilities

6. **CI Success** (Status Check)
   - Final job that depends on all others
   - Used as a single required status check in GitHub
   - Fails if any previous job fails

#### Performance

- **Total Duration Target:** <10 minutes (achievable)
- **Optimization Features:**
  - Dependency caching via `cache: 'npm'`
  - Parallel job execution
  - Concurrency groups to cancel outdated runs
  - Minimal browser installation (Chromium only for E2E)

#### Branch Protection

To block PR merges if CI fails, configure these settings in GitHub:

1. Go to Settings → Branches → Branch protection rules
2. Add rule for `main` or `master` branch
3. Enable "Require status checks to pass before merging"
4. Select "CI Success" as required check
5. Enable "Require branches to be up to date before merging"

#### Secrets Required

The following secrets should be configured in GitHub repository settings:

- `CODECOV_TOKEN` (optional): Token for Codecov coverage reporting
- `SNYK_TOKEN` (optional): Token for Snyk security scanning

To add secrets:
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add name and value

#### Artifacts

The workflow generates and stores the following artifacts (7-day retention):

- **build-artifacts**: Production build output from `dist/` directory
- **playwright-report**: E2E test reports and screenshots (on failure)

#### Triggers

- **Push to main/master**: Runs full CI pipeline
- **Pull Request**: Runs full CI pipeline and blocks merge if failing
- **Manual**: Can be triggered manually from Actions tab

## Status Badge

Add this badge to your README.md to show CI status:

```markdown
[![CI](https://github.com/YOUR_USERNAME/graceful_books/workflows/CI/badge.svg)](https://github.com/YOUR_USERNAME/graceful_books/actions)
```

Replace `YOUR_USERNAME` with your GitHub username or organization name.

## Local Testing

Before pushing, you can run the same checks locally:

```bash
# Lint
npm run lint

# Type check
npm run type-check

# Tests with coverage
npm run test:coverage

# Build
npm run build

# E2E tests
npm run e2e
```

## Troubleshooting

### Job Times Out

If a job exceeds its timeout, check for:
- Infinite loops in tests
- Tests waiting for promises that never resolve
- Network requests without timeouts

### Coverage Fails

If coverage check fails:
- Add tests for uncovered code paths
- Check `vite.config.ts` for coverage thresholds
- Review coverage report in `coverage/` directory

### E2E Tests Fail

If E2E tests fail:
- Check Playwright report artifacts
- Run tests locally with `npm run e2e:ui` for debugging
- Ensure test data is properly seeded

### Build Fails

If build fails:
- Run `npm run build` locally to reproduce
- Check for TypeScript errors with `npm run type-check`
- Review build logs for specific errors

## Coverage Thresholds

Current thresholds (configured in `vite.config.ts`):
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

**Special Requirements:**
- Cryptographic code: 100% coverage (manually verified)
- Database operations: >90% coverage (target)
- UI components: >70% coverage (target)

## Security Scanning

### npm audit

- Runs on every CI execution
- Fails on `moderate` or higher severity
- Auto-blocks PR merge if vulnerabilities found

### Snyk (Optional)

- Requires `SNYK_TOKEN` secret
- Continues on error (doesn't block CI)
- Provides detailed vulnerability reports

## Performance Optimization

The CI pipeline is optimized to complete in under 10 minutes:

1. **Dependency Caching**: npm cache reduces install time from ~2min to ~20sec
2. **Parallel Execution**: Lint, test, and build run simultaneously
3. **Concurrency Groups**: Cancels outdated runs when new commits are pushed
4. **Selective E2E**: Only runs after other jobs pass
5. **Minimal Browser**: Only installs Chromium for E2E tests

## Future Enhancements

Planned improvements:

- [ ] Matrix testing across Node.js versions (18, 20)
- [ ] Matrix testing across browsers (Chrome, Firefox, Safari)
- [ ] Performance benchmarking
- [ ] Visual regression testing
- [ ] Automated dependency updates (Dependabot)
- [ ] Deployment workflows (staging, production)
- [ ] Release automation with semantic versioning

## Related Documentation

- [SPEC.md Section 19: Deployment & Release](../../SPEC.md)
- [AGENT_REVIEW_CHECKLIST.md](../../AGENT_REVIEW_CHECKLIST.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
