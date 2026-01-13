# Branch Protection Rules Reference

This document provides a quick reference for the branch protection rules configured for the Graceful Books repository.

## Protected Branches

### Master Branch (`master`)

The master branch is the main development branch and is protected with the following rules:

#### Pull Request Requirements
- ✅ **Pull requests required**: All changes must go through a PR
- ✅ **Approvals required**: Minimum 1 approval before merge
- ✅ **Dismiss stale reviews**: New commits dismiss previous approvals
- ✅ **Code owner review**: If CODEOWNERS file specifies owners for changed files
- ✅ **Conversation resolution**: All PR conversations must be resolved

#### Commit Requirements
- ✅ **Branches must be up to date**: Must merge latest master before merging PR
- ⚠️ **Direct pushes**: BLOCKED (must use PRs)
- ⚠️ **Force pushes**: BLOCKED (prevents history rewriting)
- ⚠️ **Branch deletion**: BLOCKED (prevents accidental deletion)

#### Status Check Requirements (when CI/CD is configured)
- ✅ **Tests must pass**: All test suites
- ✅ **Build must succeed**: Production build
- ✅ **Type checking**: No TypeScript errors
- ✅ **Linting**: Code quality checks pass

#### Admin Enforcement
- ✅ **Enforce for admins**: Admins cannot bypass these rules

---

## Why These Rules?

### Security and Quality
- **Prevents accidental breakage**: All changes reviewed before merge
- **Maintains code quality**: Automated checks must pass
- **Preserves history**: No force pushes or history rewriting
- **Ensures testing**: Code must be tested before merge

### Collaboration
- **Knowledge sharing**: Reviews spread knowledge across team
- **Documentation**: PRs provide context and discussion
- **Code ownership**: CODEOWNERS ensures right people review
- **Discussion tracking**: Conversations must be resolved

### Compliance
- **Audit trail**: All changes tracked through PRs
- **Approval records**: Who approved what and when
- **Change history**: Complete record of all changes

---

## Working with Protected Branches

### Standard Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**:
   ```bash
   git add .
   git commit -m "feat: Add my feature"
   ```

3. **Push to remote**:
   ```bash
   git push -u origin feature/my-feature
   ```

4. **Create pull request**:
   ```bash
   gh pr create --title "Add my feature" --body "Description"
   # Or use GitHub web interface
   ```

5. **Address review feedback**:
   ```bash
   # Make changes
   git add .
   git commit -m "fix: Address review feedback"
   git push
   ```

6. **Merge after approval**:
   - Approve via GitHub interface
   - Merge using GitHub interface (or `gh pr merge`)

### Branch Naming Conventions

Use descriptive branch names with prefixes:

- `feature/`: New features (e.g., `feature/invoice-templates`)
- `fix/`: Bug fixes (e.g., `fix/reconciliation-error`)
- `refactor/`: Code refactoring (e.g., `refactor/encryption-service`)
- `docs/`: Documentation changes (e.g., `docs/update-readme`)
- `test/`: Test improvements (e.g., `test/add-e2e-invoice`)
- `chore/`: Maintenance tasks (e.g., `chore/update-dependencies`)

### Commit Message Conventions

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semi-colons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(invoices): Add template customization

Implement color picker and logo upload for invoice templates.
Includes validation and preview functionality.

Closes #123
```

---

## Emergency Procedures

### When You Need to Force Push (Rare)

If you absolutely must force push (e.g., to remove sensitive data):

1. **Contact team lead/admin**
2. **Document the reason** in team chat/issue
3. **Admin temporarily disables protection**:
   - Settings > Branches > Edit rule
   - Temporarily uncheck "Do not allow bypassing"
4. **Perform the operation**:
   ```bash
   git push --force origin master
   ```
5. **Admin re-enables protection immediately**
6. **Document in security log** what was done and why

### If Branch Protection is Accidentally Disabled

1. **Re-enable immediately**
2. **Review recent commits** for any unauthorized changes
3. **Document the incident**
4. **Review who had access** to disable protection

---

## Updating Protection Rules

### When to Update

Consider updating rules when:
- Team size changes
- CI/CD pipeline is added/modified
- Security requirements change
- Workflow bottlenecks identified

### How to Update

1. **Discuss with team** (create issue for discussion)
2. **Document proposed changes**
3. **Get approval from leads**
4. **Update via Settings** > Branches > Edit rule
5. **Announce changes** to team
6. **Update this document**

### Gradual Enforcement

Start with minimum rules and add more as needed:

**Phase 1 (Current)**:
- Require PRs
- Require 1 approval
- Block force pushes

**Phase 2 (With CI/CD)**:
- Add status checks
- Require up-to-date branches

**Phase 3 (With Team)**:
- Increase required approvals to 2
- Require code owner reviews
- Add more specific status checks

---

## Common Issues and Solutions

### "Protected branch hook declined"

**Cause**: Trying to push directly to master
**Solution**: Create a branch and PR instead

```bash
# Create branch from current changes
git checkout -b fix/my-changes

# Push branch
git push -u origin fix/my-changes

# Create PR
gh pr create
```

### "Review required" but you're the only developer

**Solution**: Temporarily adjust settings or work with GitHub's review system:
1. Create PR
2. Request review from yourself (via web interface)
3. Approve your own PR
4. Merge

**Better**: Add another trusted developer or wait for team growth

### "Status checks must pass" but no CI/CD yet

**Solution**: Remove status check requirement until CI/CD is set up:
1. Settings > Branches > Edit rule
2. Uncheck "Require status checks to pass"
3. Re-enable when CI/CD is configured

### Cannot merge due to conflicts

**Solution**: Update branch with latest master:
```bash
git checkout feature/my-branch
git fetch origin
git merge origin/master
# Resolve conflicts
git commit
git push
```

---

## Review and Approval Guidelines

### What to Look For

Reviewers should check:

- [ ] Code follows project conventions
- [ ] Tests are included and pass
- [ ] No TypeScript errors
- [ ] Security considerations addressed
- [ ] User experience considerations met
- [ ] Documentation updated
- [ ] No hardcoded secrets
- [ ] Error handling implemented
- [ ] Performance acceptable

### Approval Checklist

Before approving a PR:

- [ ] Read the PR description
- [ ] Review all changed files
- [ ] Check tests cover new code
- [ ] Verify tests pass
- [ ] Check for security issues
- [ ] Ensure documentation is updated
- [ ] Confirm all conversations resolved
- [ ] Test locally if needed

### Review Timeline

- **Initial review**: Within 24 hours
- **Follow-up review**: Within 12 hours
- **Urgent fixes**: Within 4 hours (label as `urgent`)

---

## Monitoring and Auditing

### Regular Checks

Perform monthly:
- [ ] Review branch protection settings
- [ ] Verify rules are enforced
- [ ] Check for bypass attempts
- [ ] Review merge history
- [ ] Update documentation if needed

### Audit Trail

GitHub provides audit logs for:
- Protection rule changes
- PR approvals and merges
- Force push attempts
- Branch deletions

Access via Settings > Security > Audit log

---

## Related Documentation

- [GITHUB_SETUP.md](.github/GITHUB_SETUP.md) - Complete setup guide
- [pull_request_template.md](.github/pull_request_template.md) - PR template
- [CODEOWNERS](.github/CODEOWNERS) - Code ownership assignments
- [AGENT_REVIEW_CHECKLIST.md](../AGENT_REVIEW_CHECKLIST.md) - Quality checklist

---

**Last Updated**: 2026-01-13
**Applies To**: `master` branch
**Next Review**: 2026-02-13 or when team structure changes
