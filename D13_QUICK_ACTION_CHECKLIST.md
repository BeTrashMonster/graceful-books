# D13 Quick Action Checklist

**Use this checklist to activate your infrastructure foundation**

---

## Before You Start

- [ ] Read `D13_SUMMARY.md` (5 min read)
- [ ] Have GitHub account ready
- [ ] Have Git configured locally
- [ ] Have 2 hours available for setup

---

## Step 1: Fix Application Code (30-60 min)

**Why**: TypeScript errors will cause CI to fail

```bash
# Check current errors
npm run type-check

# Fix errors in: src/services/email/emailRenderer.test.ts
# (Fix the 14 syntax errors shown)

# Verify fixed
npm run type-check
# Should show: no errors ✓

# Commit the fix
git add src/services/email/emailRenderer.test.ts
git commit -m "fix(tests): Fix TypeScript errors in emailRenderer tests"
```

- [ ] TypeScript errors fixed
- [ ] `npm run type-check` passes

---

## Step 2: Create GitHub Repository (30 min)

**Option A: Using GitHub CLI (Recommended)**
```bash
gh repo create graceful-books --private --source=. --remote=origin --description "A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating"
```

**Option B: Using GitHub Web Interface**
1. Go to https://github.com/new
2. Repository name: `graceful-books`
3. Description: "A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating"
4. Private or Public: Choose
5. DO NOT initialize with README (we have one)
6. Click "Create repository"
7. Add remote:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/graceful-books.git
   ```

**After creation**:
```bash
# Verify remote is set
git remote -v
# Should show: origin https://github.com/YOUR_USERNAME/graceful-books.git
```

- [ ] Repository created on GitHub
- [ ] Remote origin configured
- [ ] Repository URL noted: ____________________

---

## Step 3: Configure Repository Settings (10 min)

**Via GitHub Web Interface**:
1. Go to repository Settings
2. Under "About" (right side), click gear icon:
   - Add description (copy from above)
   - Add topics: `accounting`, `zero-knowledge`, `local-first`, `encryption`, `react`, `typescript`, `bookkeeping`, `small-business`, `gaap`, `progressive-disclosure`
3. Under "General":
   - Enable Issues ✓
   - Enable Discussions (optional)
   - Pull Requests:
     - ✓ Allow squash merging
     - ✓ Allow merge commits
     - ✓ Allow rebase merging
     - ✓ Automatically delete head branches

- [ ] Description set
- [ ] Topics added
- [ ] Pull request settings configured

---

## Step 4: Push Code to Remote (5 min)

```bash
# Add infrastructure docs to commit
git add D13_*.md

# Commit infrastructure verification
git commit -m "docs: Add D13 infrastructure verification reports

- Comprehensive verification report
- Acceptance criteria status
- Quick action checklist
- Summary document

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to GitHub (first time)
git push -u origin master

# Verify push succeeded
git status
# Should show: Your branch is up to date with 'origin/master'
```

- [ ] Code pushed to GitHub
- [ ] No errors during push
- [ ] Files visible on GitHub

---

## Step 5: Configure Branch Protection (10 min)

**Follow these steps**:
1. Go to repository Settings → Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `master` (or `main`)
4. Enable:
   - ✓ Require a pull request before merging
     - Required approvals: 1
     - ✓ Dismiss stale pull request approvals when new commits are pushed
   - ✓ Require status checks to pass before merging
     - ✓ Require branches to be up to date before merging
     - Add status check: `CI Success` (appears after first CI run)
   - ✓ Require conversation resolution before merging
   - ✓ Do not allow bypassing the above settings
5. Scroll down and click "Create" or "Save changes"

**Note**: Status checks won't appear until first CI run

- [ ] Branch protection rule created
- [ ] Pull requests required
- [ ] Status checks will be required (after first CI run)

---

## Step 6: Test PR Workflow (15 min)

```bash
# Create test branch
git checkout -b test-pr-workflow

# Make a change
echo "Infrastructure foundation complete!" > INFRASTRUCTURE_COMPLETE.txt
git add INFRASTRUCTURE_COMPLETE.txt
git commit -m "test: Verify PR workflow and CI pipeline"

# Push test branch
git push -u origin test-pr-workflow

# Create PR (using GitHub CLI)
gh pr create --title "Test PR Workflow" --body "Testing infrastructure foundation (D13 verification)"

# OR create PR via web interface:
# Go to https://github.com/YOUR_USERNAME/graceful-books/pulls
# Click "New pull request"
# Select: base: master, compare: test-pr-workflow
# Click "Create pull request"
```

**Verify**:
- [ ] PR created successfully
- [ ] PR template loaded with all sections
- [ ] CI workflow triggered automatically
- [ ] Can see workflow progress in "Checks" tab
- [ ] All jobs appear: lint, test, build, e2e, security-scan, ci-success
- [ ] Wait for CI to complete (~5-8 minutes)

**If CI passes**:
- [ ] All checks show green ✓
- [ ] "Merge" button is available
- [ ] Can merge the PR

**If CI fails**:
- [ ] Click "Details" on failed check
- [ ] Review error logs
- [ ] Fix issue locally
- [ ] Push fix (CI re-runs automatically)

**After verification**:
```bash
# Merge the PR (if passed) or close it
gh pr merge test-pr-workflow --squash
# OR
gh pr close test-pr-workflow

# Clean up
git checkout master
git pull origin master
git branch -D test-pr-workflow
```

- [ ] PR workflow tested
- [ ] CI triggered successfully
- [ ] All checks passed or issues understood
- [ ] Test branch cleaned up

---

## Step 7: Update Branch Protection (5 min)

**Now that CI has run once**:
1. Go to Settings → Branches
2. Edit the "master" branch protection rule
3. Under "Require status checks to pass before merging":
   - Add required status check: `CI Success`
   - Add required status check: `lint`
   - Add required status check: `test`
   - Add required status check: `build`
   - Add required status check: `e2e`
   - Add required status check: `security-scan`
4. Click "Save changes"

- [ ] Required status checks added
- [ ] "CI Success" is required
- [ ] Branch protection active

---

## Step 8: Verify Everything Works (10 min)

**Test that direct push is blocked**:
```bash
# Try to push directly to master (should fail)
git checkout master
echo "test" >> README.md
git add README.md
git commit -m "test: Verify branch protection"
git push origin master
# Expected: Error - protected branch hook declined

# Undo test commit
git reset --hard HEAD~1
```

- [ ] Direct push to master blocked ✓
- [ ] Error message clear

**Test that PR is required**:
```bash
# Create proper PR
git checkout -b another-test
echo "test" >> README.md
git add README.md
git commit -m "test: Verify PR required"
git push -u origin another-test
gh pr create --title "Test 2" --body "Verify PR process"

# Verify:
# - Cannot merge until checks pass
# - Cannot merge without approval (if configured)

# Clean up
gh pr close [NUMBER]
git checkout master
git branch -D another-test
git push origin --delete another-test
```

- [ ] PR creation works
- [ ] Cannot bypass checks
- [ ] System working as expected

---

## Step 9: Optional Enhancements (15 min)

**Add CI Status Badge**:
```bash
# Edit README.md, add at the top:
[![CI](https://github.com/YOUR_USERNAME/graceful_books/workflows/CI/badge.svg)](https://github.com/YOUR_USERNAME/graceful_books/actions)

git add README.md
git commit -m "docs: Add CI status badge"
git push origin master
```

- [ ] CI badge added (optional)

**Configure Secrets** (optional):
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `CODECOV_TOKEN` (get from https://codecov.io)
4. Add `SNYK_TOKEN` (get from https://snyk.io)

- [ ] Codecov token added (optional)
- [ ] Snyk token added (optional)

**Update CODEOWNERS** (if solo developer):
```bash
# Edit .github/CODEOWNERS
# Replace team references with your username:
* @YOUR_USERNAME

git add .github/CODEOWNERS
git commit -m "chore: Update CODEOWNERS"
git push origin master
```

- [ ] CODEOWNERS updated (optional)

---

## Step 10: Document and Celebrate! (5 min)

```bash
# Update ROADMAP.md to mark D13 complete
# (If you're tracking in the roadmap)

git add ROADMAP.md
git commit -m "docs: Mark D13 infrastructure foundation complete"
git push origin master
```

**Create announcement** (optional):
- [ ] Announce to team (if applicable)
- [ ] Share repository URL
- [ ] Share documentation locations
- [ ] Schedule onboarding (if needed)

**Celebrate**! 🎉
- [ ] Infrastructure foundation complete!
- [ ] CI/CD pipeline operational!
- [ ] Team can start collaborating!
- [ ] High-quality development workflow established!

---

## Troubleshooting

### "npm run type-check fails"
- Review error messages carefully
- Fix syntax errors in indicated files
- Run again to verify

### "Cannot push to remote"
- Check remote is configured: `git remote -v`
- Check authentication (SSH key or HTTPS token)
- Try: `git remote set-url origin https://github.com/YOUR_USERNAME/graceful-books.git`

### "CI doesn't trigger"
- Verify workflow file: `.github/workflows/ci.yml` exists
- Check GitHub Actions tab for errors
- Verify GitHub Actions enabled: Settings → Actions → General

### "Status checks don't appear in branch protection"
- Wait for first CI run to complete
- Refresh branch protection settings page
- Status checks appear after first workflow run

### "CI takes too long"
- First run may be slow (cold cache)
- Should be 5-8 min on subsequent runs
- Check GitHub Actions tab for stuck jobs

### "All else fails"
- Review detailed docs: `.github/GITHUB_SETUP.md`
- Check troubleshooting: `CONTRIBUTING.md`
- Ask for help (we're here to support you!)

---

## Success Criteria

You're done when:
- ✅ GitHub repository exists and is accessible
- ✅ Code is pushed to remote
- ✅ Branch protection is active
- ✅ CI/CD pipeline triggers on PR
- ✅ All checks pass or issues are understood
- ✅ Direct push to master is blocked
- ✅ PR workflow is documented and tested

---

## Time Estimate

| Task | Time | Status |
|------|------|--------|
| Fix TypeScript errors | 30-60 min | ⬜ |
| Create repository | 30 min | ⬜ |
| Configure settings | 10 min | ⬜ |
| Push code | 5 min | ⬜ |
| Branch protection | 10 min | ⬜ |
| Test PR workflow | 15 min | ⬜ |
| Update protection | 5 min | ⬜ |
| Verify | 10 min | ⬜ |
| Optional enhancements | 15 min | ⬜ |
| Document | 5 min | ⬜ |
| **TOTAL** | **~2 hours** | |

---

## Additional Resources

- **Complete verification**: `D13_INFRASTRUCTURE_VERIFICATION_REPORT.md`
- **Acceptance criteria**: `D13_ACCEPTANCE_CRITERIA_STATUS.md`
- **Summary**: `D13_SUMMARY.md`
- **Setup guide**: `.github/GITHUB_SETUP.md`
- **Branch protection**: `.github/BRANCH_PROTECTION_SETUP.md`
- **Contributing**: `CONTRIBUTING.md`
- **CI/CD docs**: `.github/workflows/README.md`
- **Quick start**: `.github/workflows/QUICK_START.md`

---

## Notes

- Take your time - this is a one-time setup
- Follow steps in order for best results
- Document any issues you encounter
- Celebrate when done! This is a major milestone

---

**Last Updated**: 2026-01-13
**Status**: Ready for use
**Estimated Completion**: ~2 hours

**Ready to begin?** Start with Step 1! 🚀
