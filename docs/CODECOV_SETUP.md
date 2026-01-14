# Codecov Setup Guide

This document explains how to set up Codecov for code coverage tracking.

## What is Codecov?

Codecov is a code coverage reporting tool that integrates with your CI/CD pipeline to:
- Track code coverage over time
- Display coverage badges
- Comment on PRs with coverage changes
- Enforce coverage requirements

## Setup Steps

### 1. Sign Up for Codecov

1. Go to [codecov.io](https://codecov.io)
2. Sign in with your GitHub account
3. Grant Codecov access to your repository

### 2. Add Repository to Codecov

1. In Codecov dashboard, click "Add a repository"
2. Find and select `graceful_books`
3. Codecov will generate a **repository upload token**
4. Copy this token (you'll need it for GitHub Actions)

### 3. Add Codecov Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `CODECOV_TOKEN`
5. Value: Paste the token from Codecov
6. Click **Add secret**

### 4. Verify Configuration

The following files are already configured:

- `.github/workflows/coverage.yml` - GitHub Actions workflow for coverage
- `codecov.yml` - Codecov configuration
- `vite.config.ts` - Coverage collection configuration

### 5. Test Coverage Reporting

```bash
# Trigger coverage workflow
git checkout -b test-coverage-reporting
git commit --allow-empty -m "Test coverage reporting"
git push origin test-coverage-reporting

# Create a PR and check:
# 1. GitHub Actions runs "Code Coverage" workflow
# 2. Coverage report uploads to Codecov
# 3. PR comment appears with coverage data
# 4. Codecov checks appear on PR
```

## Usage

### Viewing Coverage

**In Codecov Dashboard:**
1. Go to https://codecov.io
2. Select your repository
3. View coverage graphs, file-by-file coverage, and trends

**In GitHub PRs:**
- Coverage comment appears automatically on every PR
- Shows coverage % for each metric (lines, functions, branches, statements)
- Indicates if coverage thresholds are met

**Locally:**
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

### Coverage Badge

Add to README.md:

```markdown
[![codecov](https://codecov.io/gh/YOUR_USERNAME/graceful_books/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/graceful_books)
```

Replace `YOUR_USERNAME` with your GitHub username/org.

### Coverage Requirements

**Minimum Thresholds (configured in vite.config.ts and codecov.yml):**
- Lines: 80%
- Functions: 80%
- Branches: 80%
- Statements: 80%

**PR Coverage Rules:**
- Coverage cannot decrease by more than 1% on a PR
- New code (patch coverage) must meet 80% threshold
- If thresholds not met, PR checks will fail

## Configuration

### codecov.yml

The `codecov.yml` file controls Codecov behavior:

```yaml
coverage:
  status:
    project:
      default:
        target: 80%        # Overall project coverage target
        threshold: 1%      # Allow 1% decrease

    patch:
      default:
        target: 80%        # New code coverage target
```

**Key settings:**
- `target`: Minimum coverage percentage
- `threshold`: Acceptable coverage decrease
- `ignore`: Files to exclude from coverage

### GitHub Actions Workflow

The `.github/workflows/coverage.yml` workflow:

1. Runs tests with coverage collection
2. Uploads coverage to Codecov
3. Checks coverage thresholds
4. Comments on PRs with coverage data
5. Archives coverage reports as artifacts

### vite.config.ts

Coverage collection is configured in Vitest:

```typescript
test: {
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov'],
    exclude: [/* ... */],
    all: true,
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
}
```

## Troubleshooting

### Coverage Upload Fails

**Error:** "Error uploading to Codecov"

**Solutions:**
1. Verify `CODECOV_TOKEN` secret is set correctly in GitHub
2. Check token hasn't expired (regenerate if needed)
3. Verify repository is added to Codecov
4. Check Codecov status: https://status.codecov.io

### Coverage Badge Not Showing

**Solutions:**
1. Verify badge URL is correct (check Codecov dashboard for exact URL)
2. Ensure at least one coverage report has been uploaded
3. Clear browser cache or view in incognito mode
4. Check repository visibility (public vs private)

### PR Comment Not Appearing

**Solutions:**
1. Verify GitHub Actions workflow ran successfully
2. Check that `coverage-summary.json` was generated
3. Verify GitHub token has permission to comment on PRs
4. Check workflow logs for errors in "Comment PR with coverage" step

### Coverage Seems Incorrect

**Solutions:**
1. Verify `coverage.ignore` in `codecov.yml` excludes correct files
2. Check that test files are excluded (e.g., `*.test.ts`)
3. Run coverage locally to compare: `npm run test:coverage`
4. Check that all source files are being included (`all: true` in vite.config.ts)

### Threshold Failures

**Error:** "Coverage thresholds not met"

**Solutions:**
1. Write more tests to increase coverage
2. If intentional, document why in PR description
3. Consider adjusting thresholds if they're unrealistic (coordinate with team)
4. Check which files/lines are uncovered in coverage report

## Advanced Configuration

### Component-Level Coverage

Codecov tracks coverage for different components:

- **Services:** `src/services/**`
- **Store:** `src/store/**`
- **Components:** `src/components/**`
- **Libraries:** `src/lib/**`

View component coverage in Codecov dashboard → Components tab.

### Coverage Trends

Codecov automatically tracks:
- Coverage over time (graphs in dashboard)
- Coverage per commit
- Coverage per author
- Most/least covered files

### Notifications

Configure Slack/email notifications in `codecov.yml`:

```yaml
notifications:
  slack:
    default:
      url: "secret:slack_webhook_url"
      threshold: 1%
      only_pulls: true
```

## Best Practices

1. **Write tests first:** Aim for 80%+ coverage on new code
2. **Review coverage in PRs:** Check Codecov comments before merging
3. **Investigate decreases:** If coverage drops, understand why
4. **Don't game the system:** Coverage is a tool, not a goal
5. **Focus on critical paths:** Prioritize coverage for business logic

## Resources

- **Codecov Docs:** https://docs.codecov.com
- **Codecov Dashboard:** https://codecov.io/gh/YOUR_USERNAME/graceful_books
- **Coverage Report Artifact:** GitHub Actions → Artifacts
- **Local Coverage:** `npm run test:coverage` → `coverage/index.html`

---

**Last Updated:** 2026-01-14
**Maintained by:** Engineering Team
