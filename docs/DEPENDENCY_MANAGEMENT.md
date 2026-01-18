# Dependency Management

## Overview

Graceful Books uses automated dependency management through GitHub's Dependabot to keep our codebase secure, up-to-date, and maintainable. This document explains how the system works, how to handle dependency updates, and how license compliance is managed.

## Automated Update Strategy

### Schedule

- **npm dependencies:** Weekly (Mondays at 3:00 AM UTC)
- **GitHub Actions:** Weekly (Mondays at 4:00 AM UTC)
- Maximum 10 open npm PRs and 5 open Actions PRs at any time

### Update Categories

#### Patch Updates (Automatic Merge)
- **Scope:** Bug fixes and security patches (semver patch)
- **Approval:** Auto-merge if all tests pass
- **Timeline:** Merged immediately after CI passes
- **Examples:** `1.0.0 → 1.0.1` (patch fixes, security updates)

#### Minor Updates (Manual Review)
- **Scope:** New features with backward compatibility (semver minor)
- **Approval:** Requires manual review and approval
- **Timeline:** Reviewed within 48 hours
- **Examples:** `1.0.0 → 1.1.0` (new features, enhancements)
- **Process:**
  1. Review changelog for breaking changes
  2. Check for migration guides
  3. Verify no deprecated APIs used
  4. Test locally if concerned
  5. Approve PR

#### Major Updates (Manual Review + Testing)
- **Scope:** Breaking changes (semver major)
- **Approval:** Requires thorough review and testing
- **Timeline:** Reviewed within 1 week; prioritized based on severity
- **Examples:** `1.0.0 → 2.0.0` (major rewrites, breaking changes)
- **Process:**
  1. Review migration guide thoroughly
  2. Check breaking changes document
  3. Search codebase for affected APIs
  4. Create isolated feature branch for testing
  5. Run full test suite locally
  6. Update code to use new APIs
  7. Request security review if security-related
  8. Approve and merge

### Consolidation

Multiple updates to the same package are consolidated into a single PR to reduce noise and simplify review.

## License Compliance

### Current License Policy

Graceful Books uses a **PROPRIETARY** license. All dependencies must comply with the following policies:

**Allowed Licenses:**
- MIT
- Apache 2.0
- BSD (2-Clause, 3-Clause)
- ISC
- Unlicense
- CC0 1.0 Universal

**Restricted Licenses (Require Review):**
- GPL (v2, v3) - Open source requirement may conflict with proprietary model
- AGPL - Requires special handling
- SSPL - Proprietary derivative restriction
- Commons Clause - Requires commercial license

**Blocked Licenses:**
- GPL with linking exception (requires separate review)
- Affero GPL (requires all users to have source access)
- Other viral open source licenses not listed above

### License Checking Process

#### Automated Checking

All PRs trigger license compliance checks:

```bash
npm run license-check
```

This command:
1. Scans all dependencies and their transitive dependencies
2. Extracts license information from `package.json`
3. Compares against allowed/restricted list
4. Blocks PR merge if restricted licenses found

#### Manual Review Process

If a restricted license is detected:

1. **Identify the Dependency:** Which package introduced the restricted license?
2. **Assess Business Impact:** Is there a similar alternative?
3. **Review Terms:** Can the license terms be satisfied?
4. **Get Approval:** Document business justification in PR comment
5. **Document Exception:** Add to `license-exceptions.txt` with approval
6. **Monitor:** Flag for compliance review in quarterly audits

### Checking Licenses Locally

```bash
# Check all dependencies
npm run license-check

# Check specific package
npm run license-check -- --package react

# Include transitive dependencies
npm run license-check -- --recursive

# Export to file
npm run license-check -- --output licenses.json
```

### Viewing License Information

```bash
# Show all licenses
npm list --all --depth=0

# Check specific dependency
npm view react license

# Check transitive dependencies
npm list --all --depth=Infinity
```

## Lock File Integrity

### Why Lock Files Matter

The `package-lock.json` ensures:
- **Reproducible Builds:** Exact same versions every deployment
- **Security:** Prevents MITM attacks on package installation
- **Audit Trail:** What was installed when and why

### Lock File Verification

All PRs verify lock file integrity:

```bash
npm ci --audit
```

This check ensures:
1. Lock file is valid and consistent
2. No known vulnerabilities in audit
3. Package tree can be reproduced exactly
4. No orphaned or broken dependencies

### When Lock File Conflicts Occur

If `package-lock.json` has conflicts:

1. **Don't manually edit** the lock file
2. **Delete lock file:** `rm package-lock.json`
3. **Reinstall:** `npm install`
4. **Commit new lock file:** `git add package-lock.json && git commit`
5. **Force push (if necessary):** Only if you're the only editor

## Handling Breaking Changes

### Major Version Updates

When a major version update is available:

1. **Create Feature Branch**
   ```bash
   git checkout -b upgrade/package-name-v2
   ```

2. **Accept Update**
   - Click "Approve and merge" on the Dependabot PR
   - Or manually: `npm install package-name@latest`

3. **Review Migration Guide**
   - Read the package's migration guide
   - Check GitHub releases for breaking changes
   - Note any deprecated APIs

4. **Search Codebase**
   ```bash
   grep -r "oldAPI" src/
   ```

5. **Update Usage**
   - Update to new API
   - Check TypeScript for type errors
   - Update tests if needed

6. **Run Tests**
   ```bash
   npm run test -- --coverage
   npm run type-check
   npm run lint
   ```

7. **Test Locally**
   ```bash
   npm run dev
   # Test the affected features in browser
   ```

8. **Commit Changes**
   ```bash
   git add .
   git commit -m "chore(upgrade): update package-name to v2"
   ```

9. **Create Pull Request**
   - Document breaking changes in PR description
   - Request review from team lead
   - Reference Dependabot PR

### Common Breaking Change Patterns

**React Component Props:**
```typescript
// Before
<MyComponent someProp={value} />

// After (if prop removed)
<MyComponent newProp={value} />
```

**API Changes:**
```typescript
// Before
const result = await oldFunction(param1, param2)

// After
const result = await newFunction({ param1, param2 })
```

**Type Changes:**
```typescript
// Before
function process(data: string): void

// After
function process(data: string | undefined): Promise<void>
```

## Security Updates

### Critical Security Updates

Critical security updates may be released outside the normal weekly schedule. These are handled immediately:

1. **Detection:** Dependabot creates emergency PR
2. **Review:** Security team reviews within 2 hours
3. **Testing:** Quick smoke test to ensure no immediate breakage
4. **Merge:** Merged to all branches immediately
5. **Deploy:** Pushed to production within 4 hours of discovery

### Reporting Security Issues

If you discover a security vulnerability in a dependency:

1. **Don't create a public issue**
2. **Email:** security@gracefulbooks.com
3. **Include:**
   - Package name and version
   - Vulnerability description
   - Proof of concept (if possible)
   - Suggested fix
4. **Response:** We respond within 24 hours

## Development Workflow

### Before Starting Development

Always update dependencies:

```bash
npm install
npm audit fix
```

### Adding New Dependencies

When adding a new package:

1. **Check License:** Verify it has an allowed license
   ```bash
   npm view new-package license
   ```

2. **Check Security:** No known vulnerabilities
   ```bash
   npm audit
   ```

3. **Check Size:** Doesn't bloat bundle significantly
   ```bash
   npm run perf:bundle-size
   ```

4. **Check Maintenance:** Active development, good community
   - Check npm page for recent updates
   - Check GitHub issues for activity
   - Check downloads/week

5. **Update package.json**
   ```bash
   npm install new-package --save
   ```

6. **Commit:** Include package and lock file
   ```bash
   git add package.json package-lock.json
   git commit -m "feat: add new-package for feature X"
   ```

### Code Review Checklist

When reviewing dependency PRs:

- [ ] Changelog reviewed for breaking changes
- [ ] Type definitions available (if TypeScript package)
- [ ] No unnecessary major version jumps
- [ ] License is still allowed
- [ ] Test suite passes
- [ ] No bundle size spike

## Performance Considerations

### Dependency Size

Monitor bundle size with each update:

```bash
npm run perf:bundle-size
```

If a dependency increases bundle size unexpectedly:

1. Check if you're importing correctly (tree-shaking)
2. Consider alternative packages
3. Report issue to package maintainer if bug

### Installation Performance

The project should install in <2 minutes:

```bash
npm ci --verbose
```

If installation is slow:
- Check network
- Check npm registry status: `npm status`
- Clear npm cache: `npm cache clean --force`
- Check for circular dependencies

## Quarterly Audits

Every quarter, the team performs a dependency audit:

1. **Run full audit**
   ```bash
   npm audit --production
   npm audit --development
   ```

2. **Review licenses**
   - Check for new restricted licenses
   - Review any license exceptions
   - Document business justifications

3. **Check staleness**
   - Identify packages with no updates in 1 year
   - Evaluate alternatives
   - Plan migrations if needed

4. **Review security**
   - Check for patterns of vulnerability fixes
   - Identify high-risk dependencies
   - Plan security hardening

5. **Document findings**
   - Update this guide if processes change
   - Report to security team
   - Plan migrations for Q+1

## Troubleshooting

### "Failed to resolve dependency"

Usually means `package-lock.json` is out of sync:

```bash
rm package-lock.json
npm install
```

### "Version not found in registry"

Check npm registry:

```bash
npm view package-name versions
```

If prerelease, you may need to explicitly allow it.

### "License check failed"

Unknown or restricted license detected:

1. View details:
   ```bash
   npm view package-name license
   ```

2. Check alternatives:
   ```bash
   npm search similar-package
   ```

3. If package is essential:
   - Document business case
   - Get compliance approval
   - Add to license exceptions
   - Plan migration timeline

### "Transitive dependency has vulnerability"

If a transitive dependency (dependency of a dependency) has a vulnerability:

1. **Don't modify package-lock.json manually**
2. **Check if direct dependency has update**
   ```bash
   npm update direct-dependency
   ```

3. **If no update available:**
   - Use npm overrides (npm 8.3+)
   - Or wait for upstream fix
   - Consider alternative package

### "Tests fail after dependency update"

1. Identify the failing test
2. Check dependency changelog
3. Look for migration guide
4. Update code to use new API
5. Run test again
6. Commit fix with explanation

## CI/CD Integration

### GitHub Actions

Dependabot PRs trigger full CI pipeline:

1. **Install:** `npm ci --audit`
2. **Lint:** `npm run lint`
3. **Type Check:** `npm run type-check`
4. **Tests:** `npm run test`
5. **Build:** `npm run build`
6. **Coverage:** Must maintain >80%
7. **License Check:** Must pass compliance

All checks must pass before merge.

### Status Checks

PR cannot merge without:

- ✅ All GitHub Action checks passing
- ✅ Code review approval
- ✅ License compliance pass
- ✅ No conflicts with base branch

## Related Documentation

- [SECURITY_SCANNING.md](./SECURITY_SCANNING.md) - Vulnerability detection
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guidelines
- [CI/CD Workflow](./workflows/) - Automated testing and deployment
- [Architecture](./ARCHITECTURE.md) - System design

## FAQ

**Q: Why auto-merge only patch updates?**
A: Patch updates are low-risk bug fixes. Minor and major versions may require code changes to use new features or adapt to breaking changes.

**Q: Can I skip an update?**
A: Yes, but document why. If a critical security update, you must plan migration immediately.

**Q: What if I disagree with auto-merge?**
A: Disable auto-merge for that package in `dependabot.yml` and submit PR to change config.

**Q: How do I know when updates are coming?**
A: Watch your GitHub notifications. Dependabot always creates PRs 24+ hours before auto-merging.

**Q: Can I force an update?**
A: Yes: `npm update package-name`. Then commit `package-lock.json`. Creates a normal PR for review.

**Q: What's the difference between `npm install` and `npm ci`?**
A: `npm ci` installs exact versions from lock file. `npm install` can update versions. Use `npm ci` in CI/CD.

---

**Last Updated:** 2026-01-17
**Maintained By:** Infrastructure Team (G11)
**Related:** Group G Infrastructure Sprint
