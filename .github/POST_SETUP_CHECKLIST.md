# GitHub Repository Post-Setup Checklist

Use this checklist after completing the initial repository setup to ensure everything is configured correctly.

## Remote Repository Setup

### Repository Creation
- [ ] Repository created on GitHub
- [ ] Repository name: `graceful-books`
- [ ] Repository visibility set (Private or Public)
- [ ] Description added: "A local-first, zero-knowledge accounting platform for entrepreneurs who find traditional accounting software intimidating"
- [ ] Repository URL noted: `https://github.com/[USERNAME]/graceful-books`

### Initial Push
- [ ] Remote added: `git remote -v` shows origin
- [ ] Master branch pushed: `git push -u origin master`
- [ ] All commits visible on GitHub
- [ ] All files synced to remote
- [ ] README.md visible on repository homepage

---

## Branch Protection Configuration

### Master Branch Protection
- [ ] Branch protection rule created for `master`
- [ ] Pull requests required before merging
- [ ] Minimum 1 approval required (increase to 2+ for teams)
- [ ] Stale reviews dismissed on new commits
- [ ] Code owner review required
- [ ] All conversations must be resolved
- [ ] Branches must be up to date before merging
- [ ] Direct pushes blocked
- [ ] Force pushes blocked
- [ ] Branch deletion blocked
- [ ] Rules enforced for admins

### Status Checks (if CI/CD configured)
- [ ] Status checks required: `lint`
- [ ] Status checks required: `test`
- [ ] Status checks required: `build`
- [ ] Status checks required: `e2e`
- [ ] Status checks required: `security-scan`
- [ ] Branches must be up to date enabled

---

## Repository Settings

### General Settings
- [ ] Issues enabled
- [ ] Discussions enabled (optional)
- [ ] Projects enabled (optional)
- [ ] Wiki disabled (use docs folder)
- [ ] Sponsorships disabled
- [ ] Preserve this repository disabled

### Pull Request Settings
- [ ] Allow squash merging enabled
- [ ] Allow merge commits enabled
- [ ] Allow rebase merging enabled
- [ ] Automatically delete head branches enabled
- [ ] Default to pull request title for squash merge
- [ ] Allow auto-merge enabled (optional)

### Topics/Tags
- [ ] `accounting` added
- [ ] `zero-knowledge` added
- [ ] `local-first` added
- [ ] `encryption` added
- [ ] `react` added
- [ ] `typescript` added
- [ ] `bookkeeping` added
- [ ] `small-business` added
- [ ] `gaap` added
- [ ] `progressive-disclosure` added

---

## Template Verification

### Pull Request Template
- [ ] Create test branch: `git checkout -b test-pr-template`
- [ ] Make test change: `echo "test" > test.txt`
- [ ] Commit: `git commit -am "test: PR template"`
- [ ] Push: `git push -u origin test-pr-template`
- [ ] Create PR via web interface or `gh pr create`
- [ ] Verify PR template appears in description
- [ ] Verify all checklist sections present
- [ ] Close PR: `gh pr close [NUMBER]`
- [ ] Delete branch: `git push origin --delete test-pr-template`
- [ ] Delete local: `git branch -D test-pr-template`
- [ ] Switch back: `git checkout master`

### Issue Templates
- [ ] Go to Issues > New Issue
- [ ] Verify "Bug Report" template appears
- [ ] Verify "Feature Request" template appears
- [ ] Verify blank issues disabled
- [ ] Verify contact links present
- [ ] Test creating issue with bug template
- [ ] Test creating issue with feature template
- [ ] Close test issues

### CODEOWNERS
- [ ] File visible at `.github/CODEOWNERS`
- [ ] Teams or usernames configured correctly
- [ ] Create test PR touching different file types
- [ ] Verify appropriate reviewers auto-assigned
- [ ] Check via: `gh api repos/:owner/:repo/codeowners/errors`

---

## CI/CD Verification

### GitHub Actions
- [ ] Workflows visible in Actions tab
- [ ] CI workflow enabled
- [ ] Push to master triggers CI (if not protected yet)
- [ ] PR creation triggers CI
- [ ] All jobs defined: lint, test, build, e2e, security-scan
- [ ] Check workflow runs successfully

### Secrets Configuration (if needed)
- [ ] `CODECOV_TOKEN` added (for coverage)
- [ ] `SNYK_TOKEN` added (for security scanning)
- [ ] Other secrets as needed

---

## Documentation Verification

### GitHub Pages (if used)
- [ ] GitHub Pages configured (optional)
- [ ] Documentation site accessible
- [ ] All links working

### Repository Files
- [ ] README.md renders correctly
- [ ] CHANGELOG.md visible
- [ ] LICENSE file present (if applicable)
- [ ] CONTRIBUTING.md present (if applicable)
- [ ] ROADMAP.md accessible
- [ ] SPEC.md accessible

### .github Directory
- [ ] All files committed and pushed
- [ ] GITHUB_SETUP.md accessible
- [ ] BRANCH_PROTECTION_RULES.md accessible
- [ ] pull_request_template.md present
- [ ] CODEOWNERS present
- [ ] Issue templates present

---

## Access Control

### Team Setup (if applicable)
- [ ] GitHub organization created (if needed)
- [ ] Teams created (see CODEOWNERS for list)
- [ ] Team members added
- [ ] Teams granted repository access
- [ ] Access levels appropriate (Write, Admin)
- [ ] CODEOWNERS updated with team names

### Collaborators (for personal repos)
- [ ] Individual collaborators invited
- [ ] Access levels set (Write, Admin)
- [ ] CODEOWNERS updated with usernames
- [ ] Collaborators accepted invitations

---

## Security Configuration

### Security Features
- [ ] Dependabot alerts enabled
- [ ] Dependabot security updates enabled
- [ ] Code scanning enabled (optional)
- [ ] Secret scanning enabled (for public repos)
- [ ] Security policy (SECURITY.md) present (if applicable)

### Branch Protection Security
- [ ] Verified force push blocked
- [ ] Verified branch deletion blocked
- [ ] Verified direct push to master blocked
- [ ] Verified approval required for merge

---

## Testing Branch Protection

### Direct Push Test (Should Fail)
```bash
# This should be rejected
echo "test" >> README.md
git add README.md
git commit -m "test: Direct push"
git push origin master
# Expected: protected branch hook declined
git reset --hard HEAD~1  # Undo test commit
```
- [ ] Direct push to master blocked
- [ ] Error message clear and helpful

### PR Workflow Test (Should Succeed)
```bash
# Create feature branch
git checkout -b test-workflow
echo "test" >> test-workflow.txt
git add test-workflow.txt
git commit -m "test: PR workflow"
git push -u origin test-workflow
gh pr create --title "Test Workflow" --body "Testing PR process"
```
- [ ] Branch created successfully
- [ ] PR created successfully
- [ ] PR template loaded
- [ ] Reviewers auto-assigned (if CODEOWNERS configured)
- [ ] CI checks triggered
- [ ] Can view PR status
- [ ] Can approve PR
- [ ] Can merge after approval
- [ ] Branch auto-deleted after merge

### Cleanup Test
```bash
# After testing
git checkout master
git branch -D test-workflow
```
- [ ] Test branch cleaned up
- [ ] Back on master branch

---

## Integration Verification

### GitHub CLI (if used)
- [ ] `gh` installed and authenticated
- [ ] `gh repo view` shows correct info
- [ ] `gh pr list` works
- [ ] `gh issue list` works
- [ ] `gh api` commands work

### Git Configuration
- [ ] Git user name configured
- [ ] Git user email configured
- [ ] SSH key added (if using SSH)
- [ ] HTTPS credentials cached (if using HTTPS)
- [ ] GPG signing configured (optional)

---

## Performance and Monitoring

### Repository Insights
- [ ] Check Insights > Pulse for activity
- [ ] Check Insights > Contributors
- [ ] Check Insights > Traffic (after 2 weeks)
- [ ] Check Insights > Community Standards

### Actions Usage
- [ ] Review Actions usage limits
- [ ] Configure workflow timeout limits
- [ ] Set up notifications for failed workflows
- [ ] Monitor action run times

---

## Documentation Updates

### Update Documentation
- [ ] Update README with repository URL
- [ ] Update contributing guide with PR process
- [ ] Update roadmap status (D10 complete)
- [ ] Create D10_IMPLEMENTATION_SUMMARY.md
- [ ] Commit and push documentation updates

### Share with Team
- [ ] Share repository URL with team
- [ ] Share setup documentation
- [ ] Share branch protection guidelines
- [ ] Schedule onboarding session (if needed)

---

## Final Verification

### Repository Health
- [ ] All files present and correct
- [ ] No secrets committed to repository
- [ ] All documentation accurate and up to date
- [ ] Repository description accurate
- [ ] Topics/tags relevant and complete

### Workflow Verification
- [ ] Can clone repository
- [ ] Can create branches
- [ ] Can create PRs
- [ ] Cannot push directly to master
- [ ] Can merge after approval
- [ ] CI runs on PRs
- [ ] Status checks enforce quality

### Team Readiness
- [ ] Team members have access
- [ ] Team understands PR workflow
- [ ] Team knows how to use templates
- [ ] Team knows branch protection rules
- [ ] Team has access to documentation

---

## Post-Setup Actions

### Immediate Actions
- [ ] Announce repository setup to team
- [ ] Schedule team onboarding (if needed)
- [ ] Create first real PR to test workflow
- [ ] Set up project boards (if using)
- [ ] Configure notifications

### Within First Week
- [ ] Monitor first few PRs for issues
- [ ] Gather team feedback on workflow
- [ ] Adjust settings if needed
- [ ] Update documentation based on feedback
- [ ] Schedule first sprint planning

### Within First Month
- [ ] Review branch protection effectiveness
- [ ] Review CI/CD performance
- [ ] Assess code review quality
- [ ] Update templates based on usage
- [ ] Plan first repository audit

---

## Troubleshooting

If any items fail, refer to:
- `.github/GITHUB_SETUP.md` for setup instructions
- `.github/BRANCH_PROTECTION_RULES.md` for protection rules
- GitHub documentation for specific features
- Team lead or administrator for access issues

---

## Success Criteria

All items above should be checked before considering D10 complete:
- ✅ Repository accessible on GitHub
- ✅ All code pushed and synced
- ✅ Branch protection active and tested
- ✅ Templates working correctly
- ✅ Team has appropriate access
- ✅ CI/CD running successfully
- ✅ Documentation complete and accurate

---

## Sign-Off

**Setup Completed By**: _________________
**Date**: _________________
**Repository URL**: _________________
**Setup Duration**: _________________
**Issues Encountered**: _________________
**Notes**: _________________

---

## Maintenance Schedule

Set reminders for:
- [ ] Monthly: Review branch protection settings
- [ ] Quarterly: Audit repository access and permissions
- [ ] Quarterly: Review and update templates
- [ ] Quarterly: Review CI/CD performance and costs
- [ ] Annually: Major documentation update
- [ ] Annually: Security audit

---

**Last Updated**: 2026-01-13
**Document Version**: 1.0
**Next Review**: After team onboarding or 2026-02-13
