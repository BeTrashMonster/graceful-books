# GitHub Repository Setup Guide (D10)

This document provides complete instructions for setting up the Graceful Books GitHub repository with proper configuration and branch protection.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Creating the Remote Repository](#creating-the-remote-repository)
3. [Pushing Existing Codebase](#pushing-existing-codebase)
4. [Configuring Repository Settings](#configuring-repository-settings)
5. [Setting Up Branch Protection](#setting-up-branch-protection)
6. [Verification](#verification)
7. [Team Setup](#team-setup)

---

## Prerequisites

- GitHub account with permission to create repositories
- Git configured locally with authentication
- Local repository with existing codebase (already exists)
- GitHub CLI (optional but recommended): `gh` command

---

## Creating the Remote Repository

### Option 1: Using GitHub Web Interface

1. Navigate to [https://github.com/new](https://github.com/new)
2. Configure repository:
   - **Repository name**: `graceful-books`
   - **Description**: `A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating`
   - **Visibility**: Private (recommended initially) or Public
   - **DO NOT** initialize with README, .gitignore, or license (we have these already)
3. Click "Create repository"

### Option 2: Using GitHub CLI (Recommended)

```bash
# Create private repository
gh repo create graceful-books --private --source=. --remote=origin --description "A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating"

# Or create public repository
gh repo create graceful-books --public --source=. --remote=origin --description "A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating"
```

### Option 3: Manual Remote Setup

If you've created the repository via web interface:

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/graceful-books.git

# Or using SSH
git remote add origin git@github.com:YOUR_USERNAME/graceful-books.git
```

---

## Pushing Existing Codebase

### Step 1: Verify Current Branch

```bash
# Check current branch (should be 'master')
git branch

# If not on master, switch to it
git checkout master
```

### Step 2: Commit Any Pending Changes

```bash
# Check status
git status

# Add and commit any pending changes
git add .
git commit -m "chore: Prepare repository for GitHub push (D10 setup)"
```

### Step 3: Push to GitHub

```bash
# Push master branch to remote (first time)
git push -u origin master

# This sets master as the upstream branch
```

### Step 4: Verify Push

```bash
# Verify remote is configured
git remote -v

# Verify branch is tracking remote
git branch -vv
```

---

## Configuring Repository Settings

### Step 1: Set Repository Description and Topics

Via GitHub Web Interface:
1. Go to repository homepage
2. Click the gear icon next to "About" (right side)
3. Add description: `A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating`
4. Add topics (tags):
   - `accounting`
   - `zero-knowledge`
   - `local-first`
   - `encryption`
   - `react`
   - `typescript`
   - `bookkeeping`
   - `small-business`
   - `gaap`
   - `progressive-disclosure`
5. Update website (if applicable)
6. Click "Save changes"

Via GitHub CLI:
```bash
gh repo edit --description "A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating"

# Add topics (requires gh extension or API)
gh api repos/:owner/:repo/topics -X PUT -f names[]="accounting" -f names[]="zero-knowledge" -f names[]="local-first" -f names[]="encryption" -f names[]="react" -f names[]="typescript" -f names[]="bookkeeping" -f names[]="small-business" -f names[]="gaap" -f names[]="progressive-disclosure"
```

### Step 2: Configure General Settings

1. Navigate to repository Settings tab
2. Under "General" section:
   - **Features**: Enable Issues, Discussions (optional), Projects (optional)
   - **Pull Requests**:
     - ✅ Allow squash merging
     - ✅ Allow merge commits
     - ✅ Allow rebase merging
     - ✅ Automatically delete head branches (recommended)
   - **Archives**: Keep disabled
3. Save changes

---

## Setting Up Branch Protection

### Critical: Protect the Master Branch

1. Go to repository Settings > Branches
2. Click "Add branch protection rule"
3. Branch name pattern: `master` (or `main` if you renamed)

### Recommended Protection Rules

Configure the following settings:

#### Required Reviews
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: `1` (increase to 2+ for team)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners (if using CODEOWNERS)

#### Status Checks
- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - Add status checks when CI/CD is set up:
    - `test` (run tests)
    - `build` (verify build)
    - `lint` (code quality)
    - `type-check` (TypeScript)

#### Additional Restrictions
- ✅ **Require conversation resolution before merging** (recommended)
- ✅ **Require linear history** (optional, keeps clean history)
- ✅ **Do not allow bypassing the above settings** (even for admins)
- ⚠️ **Allow force pushes**: DISABLED (critical)
- ⚠️ **Allow deletions**: DISABLED (critical)

#### Who Can Push
- **Restrict who can push to matching branches**:
  - Leave empty to block all direct pushes
  - Or specify individuals/teams who can push (not recommended for master)

### Using GitHub CLI

```bash
# Enable branch protection with basic rules
gh api repos/:owner/:repo/branches/master/protection -X PUT -H "Accept: application/vnd.github.v3+json" --input - <<EOF
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
```

---

## Verification

### Verify Branch Protection is Active

1. Try to push directly to master (should fail):
```bash
# This should be rejected
git push origin master
# Expected error: "protected branch hook declined"
```

2. Verify protection via GitHub CLI:
```bash
gh api repos/:owner/:repo/branches/master/protection
```

3. Check via web interface:
   - Settings > Branches > Branch protection rules
   - Should show rule for `master`

### Verify PR Template is Working

1. Create a test branch:
```bash
git checkout -b test-pr-template
echo "test" > test-file.txt
git add test-file.txt
git commit -m "test: Verify PR template"
git push -u origin test-pr-template
```

2. Create a PR via web interface or CLI:
```bash
gh pr create --title "Test PR Template" --body "Testing"
```

3. Verify that the PR template appears in the description
4. Close and delete the test PR:
```bash
gh pr close 1
git push origin --delete test-pr-template
git checkout master
git branch -D test-pr-template
```

### Verify CODEOWNERS is Working

1. Check if CODEOWNERS is recognized:
```bash
gh api repos/:owner/:repo/codeowners/errors
```

2. When creating PRs, verify that appropriate reviewers are automatically requested

### Verify Repository Visibility

```bash
# Check repository details
gh repo view

# Should show description, topics, and visibility
```

---

## Team Setup

### If Working Solo

1. Update `.github/CODEOWNERS`:
   - Replace `@graceful-books/core-team` with your GitHub username
   - Example: `* @yourusername`

### If Working with a Team

1. Create GitHub Teams:
   - Go to Organization Settings > Teams
   - Create teams: `core-team`, `frontend-team`, `backend-team`, `security-team`, `qa-team`, `docs-team`, `product-team`, `devops-team`, `leads`

2. Add team members to appropriate teams

3. Grant teams repository access:
   - Settings > Collaborators and teams
   - Add each team with appropriate permissions:
     - `core-team`: Write
     - `leads`: Admin
     - Others: Write or Read as appropriate

4. Update branch protection to require team review

---

## Automation and CI/CD (Future)

Once you set up GitHub Actions, add these status checks to branch protection:

```yaml
# .github/workflows/ci.yml (example)
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run type-check
      - run: npm run lint
      - run: npm run build
```

---

## Troubleshooting

### Cannot Push to Master

**Expected behavior**: Branch protection is working correctly.
**Solution**: Create a branch and open a PR instead.

### PR Template Not Showing

**Check**: `.github/pull_request_template.md` exists and is committed
**Solution**: Ensure file is in `.github/` directory (not `github/`) and is pushed to remote

### CODEOWNERS Not Working

**Check**: File is named `CODEOWNERS` (no extension) in `.github/` directory
**Solution**: Verify team names exist or replace with usernames

### Force Push Needed (Emergency)

1. Temporarily disable branch protection
2. Perform force push: `git push --force origin master`
3. Re-enable branch protection immediately
4. Document why this was necessary

---

## Post-Setup Checklist

- [ ] Remote repository created on GitHub
- [ ] Repository description set
- [ ] Topics/tags configured
- [ ] Existing codebase pushed to remote
- [ ] Master branch protected (direct push blocked)
- [ ] PR reviews required (minimum 1 approval)
- [ ] PR template visible when creating PRs
- [ ] CODEOWNERS file configured
- [ ] Force pushes disabled
- [ ] Branch deletions disabled
- [ ] README visible on repository homepage
- [ ] All files successfully synced

---

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitHub PR Templates Documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)

---

## Maintenance

This document should be reviewed and updated:
- When team structure changes
- When branch protection rules need adjustment
- When CI/CD pipeline is added
- Quarterly as part of repository maintenance

**Last Updated**: 2026-01-13
**Status**: Initial Setup (D10)
**Next Review**: After first team member added
