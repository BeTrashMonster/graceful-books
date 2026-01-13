# GitHub Branch Protection Setup

This document provides step-by-step instructions for configuring branch protection rules to enforce CI/CD checks.

## Prerequisites

- Repository must be on GitHub
- You must have admin access to the repository
- CI workflow must be committed and pushed to the repository

## Setup Instructions

### Step 1: Navigate to Branch Protection Settings

1. Go to your GitHub repository
2. Click **Settings** tab (top right)
3. In the left sidebar, click **Branches**
4. Under "Branch protection rules", click **Add rule** or **Add branch protection rule**

### Step 2: Configure Branch Name Pattern

In the "Branch name pattern" field, enter:
```
main
```

Or if your default branch is `master`:
```
master
```

### Step 3: Enable Required Status Checks

Check the following boxes:

- ✅ **Require status checks to pass before merging**

  Then select the following status checks (they'll appear after the first CI run):
  - `CI Success`
  - `lint` (Lint & Type Check)
  - `test` (Test Suite)
  - `build` (Build Application)
  - `e2e` (E2E Tests)
  - `security-scan` (Security Scan)

- ✅ **Require branches to be up to date before merging**

  This ensures PRs are tested against the latest code.

### Step 4: Additional Recommended Settings

For better code quality and security:

- ✅ **Require a pull request before merging**
  - Minimum number of approvals: **1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed

- ✅ **Require conversation resolution before merging**

- ✅ **Do not allow bypassing the above settings**

Optional (for teams):
- ✅ **Require review from Code Owners** (if you have a CODEOWNERS file)
- ✅ **Restrict who can push to matching branches** (limit to specific users/teams)

### Step 5: Save Changes

1. Scroll to the bottom
2. Click **Create** or **Save changes**

## Verification

To verify the setup works:

1. Create a new branch:
   ```bash
   git checkout -b test-ci-protection
   ```

2. Make a change and commit:
   ```bash
   echo "test" >> README.md
   git add README.md
   git commit -m "test: verify CI protection"
   git push origin test-ci-protection
   ```

3. Open a pull request on GitHub

4. You should see:
   - CI checks running automatically
   - "Merge" button disabled until checks pass
   - Status checks listed at the bottom of the PR

## Troubleshooting

### Status Checks Don't Appear

**Issue**: The status checks don't show up in the list when configuring branch protection.

**Solution**:
1. Run the CI workflow at least once by pushing a commit or opening a PR
2. Wait for the workflow to complete
3. Return to branch protection settings - checks should now be visible

### Can't Merge Despite Passing Checks

**Issue**: All checks are green but merge button is still disabled.

**Possible Causes**:
1. "Require branches to be up to date" is enabled and the PR is behind `main`
   - **Solution**: Update the branch by clicking "Update branch" or merging `main` into your branch

2. Unresolved conversations exist
   - **Solution**: Resolve all review conversations

3. Insufficient approvals
   - **Solution**: Get the required number of approvals

### CI Never Runs

**Issue**: CI workflow doesn't run when pushing or opening PR.

**Possible Causes**:
1. Workflow file has syntax errors
   - **Solution**: Validate YAML syntax at https://www.yamllint.com/

2. Workflow file not in correct location
   - **Solution**: Ensure file is at `.github/workflows/ci.yml`

3. GitHub Actions not enabled
   - **Solution**: Go to Settings → Actions → General → Enable Actions

## Bypass Protection (Emergency Only)

In rare cases, you may need to bypass protection (e.g., critical hotfix with failing tests):

### Option 1: Temporary Disable (Recommended)
1. Go to Settings → Branches
2. Click **Edit** on the branch protection rule
3. Temporarily uncheck the problematic requirement
4. Merge the PR
5. Re-enable the requirement immediately

### Option 2: Admin Override (GitHub Pro/Enterprise)
1. As a repository admin, you can force-merge
2. Go to the PR
3. Click the "Merge" dropdown
4. Select "Merge without waiting for requirements to be met"
5. Confirm the override

**IMPORTANT**: Document why you bypassed protection in the PR or merge commit message.

## Required Status Checks Reference

| Check Name | Description | Typical Duration |
|------------|-------------|------------------|
| `CI Success` | Overall CI status (use this for branch protection) | N/A (depends on others) |
| `lint` | ESLint + TypeScript type checking | ~1 minute |
| `test` | Unit & integration tests with coverage | ~2 minutes |
| `build` | Production build verification | ~1 minute |
| `e2e` | End-to-end tests with Playwright | ~3 minutes |
| `security-scan` | npm audit + Snyk scanning | ~30 seconds |

**Recommendation**: Only require `CI Success` in branch protection. This job depends on all others and provides a single status check to monitor.

## Updating Branch Protection

If CI workflow changes (new jobs added/removed):

1. No action needed if using `CI Success` as the single required check
2. If requiring individual jobs, update branch protection settings to reflect new job names

## Best Practices

1. **Use `CI Success` as the single required check** - Simplifies maintenance
2. **Require branches to be up to date** - Prevents merge conflicts and integration issues
3. **Require at least 1 approval** - Ensures code review
4. **Never bypass for convenience** - Only for genuine emergencies
5. **Document exceptions** - If you must bypass, explain why

## Related Documentation

- [CI/CD Pipeline Documentation](.github/workflows/README.md)
- [Quick Start Guide](.github/workflows/QUICK_START.md)
- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
