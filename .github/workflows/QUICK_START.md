# CI/CD Quick Start Guide

## What is CI/CD?

CI/CD stands for Continuous Integration and Continuous Deployment. It's an automated process that:
- Tests your code every time you push
- Ensures code quality and standards
- Prevents bugs from being merged
- Builds the application automatically

## How It Works

When you push code or open a pull request, GitHub Actions automatically:

1. **Lints your code** - Checks for code style issues
2. **Type checks** - Verifies TypeScript types are correct
3. **Runs tests** - Executes all unit and integration tests
4. **Builds the app** - Creates a production build
5. **Runs E2E tests** - Tests the app in a real browser
6. **Scans for security issues** - Checks for vulnerable dependencies

If any step fails, the pull request is blocked from merging.

## What You Need to Know

### Before Pushing

Run this locally to catch issues early:

**Windows (PowerShell):**
```powershell
.\.github\workflows\test-ci-locally.ps1
```

**macOS/Linux:**
```bash
./.github/workflows/test-ci-locally.sh
```

### When Opening a Pull Request

1. GitHub Actions will run automatically
2. You'll see status checks at the bottom of your PR
3. Green checkmarks = All good!
4. Red X = Something failed - click "Details" to see what

### If CI Fails

1. Click "Details" next to the failed check
2. Read the error message
3. Fix the issue locally
4. Push again (CI runs automatically)

### Common Failures

**ESLint Failed**
```bash
# Fix automatically
npm run lint:fix

# Or fix manually and run
npm run lint
```

**Type Check Failed**
```bash
# See the errors
npm run type-check
```

**Tests Failed**
```bash
# Run tests locally
npm test

# Or with coverage
npm run test:coverage
```

**Build Failed**
```bash
# Try building locally
npm run build
```

**Security Issues**
```bash
# Check for vulnerabilities
npm audit

# Try to fix automatically
npm audit fix
```

## Required Status Checks

Your pull request MUST pass these checks before merging:
- ✓ Lint & Type Check
- ✓ Test Suite
- ✓ Build Application
- ✓ E2E Tests
- ✓ Security Scan

## Performance

CI typically completes in **5-8 minutes**:
- Lint & Type Check: ~1 minute
- Test Suite: ~2 minutes
- Build: ~1 minute
- E2E Tests: ~3 minutes
- Security Scan: ~30 seconds

## Configuration Files

- **Workflow**: `.github/workflows/ci.yml`
- **Coverage**: `vite.config.ts` (test.coverage section)
- **ESLint**: `.eslintrc.cjs`
- **TypeScript**: `tsconfig.json`

## Secrets Setup (Optional)

For enhanced features, add these secrets in GitHub:

1. Go to: Settings → Secrets and variables → Actions
2. Add secrets:
   - `CODECOV_TOKEN` - For coverage tracking
   - `SNYK_TOKEN` - For advanced security scanning

## Status Badge

Show CI status in your README:

```markdown
[![CI](https://github.com/YOUR_USERNAME/graceful_books/workflows/CI/badge.svg)](https://github.com/YOUR_USERNAME/graceful_books/actions)
```

## Need Help?

- Full documentation: [README.md](./README.md)
- GitHub Actions logs: Click "Details" on any check
- Run locally first to debug faster

## Tips

1. **Run checks locally before pushing** - Saves time!
2. **Check the logs** - Error messages are usually clear
3. **Keep PRs small** - Easier to fix if CI fails
4. **Don't skip tests** - They catch bugs early
5. **Update dependencies carefully** - Run npm audit after updates

## Troubleshooting

### "CI is taking too long"

- Normal: 5-8 minutes
- If >10 minutes, check for hanging tests
- Cancel and re-run if stuck

### "CI passed locally but failed on GitHub"

- Check Node.js version (CI uses Node 18)
- Check for environment-specific issues
- Look at full logs in GitHub Actions

### "I can't merge my PR"

- Ensure all checks are green
- Update your branch with latest main/master
- Ask for help if stuck

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Developer pushes code or opens PR              │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  GitHub Actions triggers CI workflow            │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐   ┌──────────────┐
│  Lint & Type │   │  Test Suite  │
│     Check    │   │  + Coverage  │
└──────┬───────┘   └──────┬───────┘
       │                  │
       └────────┬─────────┘
                ▼
        ┌──────────────┐
        │    Build     │
        └──────┬───────┘
               │
        ┌──────┴───────────┐
        │                  │
        ▼                  ▼
┌──────────────┐   ┌──────────────┐
│  E2E Tests   │   │   Security   │
│  (Playwright)│   │     Scan     │
└──────┬───────┘   └──────┬───────┘
       │                  │
       └────────┬─────────┘
                ▼
        ┌──────────────┐
        │  CI Success  │
        │ Status Check │
        └──────┬───────┘
               │
               ▼
     ┌──────────────────┐
     │ PR can be merged │
     └──────────────────┘
```

---

**Remember:** CI is here to help you catch bugs before they reach production. It's your safety net!
