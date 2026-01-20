# Security Scanning & Vulnerability Detection

This document describes the security scanning infrastructure for Graceful Books, including dependency vulnerability scanning, secret detection, and static application security testing (SAST).

## Overview

The security scanning system is designed to:

1. **Prevent vulnerable dependencies** from entering the codebase
2. **Detect secrets** accidentally committed to the repository
3. **Identify common security issues** through static analysis
4. **Track outdated dependencies** and generate software bills of materials
5. **Block PRs** with critical vulnerabilities from merging
6. **Require justification** for high-severity vulnerabilities

## CI/CD Pipeline Integration

Security scanning runs automatically on:

- **Every push** to `main`, `master`, or `develop` branches
- **Every pull request** against `main`, `master`, or `develop`
- **Weekly schedule** every Sunday at 2 AM UTC (scheduled scan)

### Workflow File

See `.github/workflows/security-scan.yml` for the complete implementation.

## Security Checks

### 1. Dependency Vulnerability Scanning

**Tool:** npm audit
**Trigger:** Every commit and PR
**Failure Condition:** Any critical vulnerabilities

#### How It Works

```bash
npm audit --json
```

- Scans `package.json` and `package-lock.json`
- Identifies known vulnerabilities in dependencies
- Categorizes by severity: `critical`, `high`, `moderate`, `low`

#### Vulnerability Levels

| Severity | Action | Blocks PR | Requires Action |
|----------|--------|-----------|-----------------|
| **Critical** | Fail immediately | Yes (blocks merge) | Must fix before merge |
| **High** | Report & comment | No | Requires justification |
| **Moderate** | Log & report | No | Best effort fix |
| **Low** | Log only | No | Consider in next sprint |

#### Example: Critical Vulnerability Detected

When a critical vulnerability is found:

```
CRITICAL: Found 1 critical vulnerabilities
Critical vulnerabilities must be addressed before merging.
```

The PR **cannot be merged** until the vulnerability is resolved.

#### Example: High Severity Vulnerabilities

When high vulnerabilities are found on a PR:

1. GitHub bot comments on the PR with details
2. Developer can:
   - Run `npm audit fix` to auto-patch
   - Run `npm audit fix --force` to update major versions
   - Document justification in PR description

#### Handling npm audit Results

**Quick Fix (if available):**
```bash
npm audit fix
```

**Force Fix (may update major versions):**
```bash
npm audit fix --force
```

**Review Vulnerabilities:**
```bash
npm audit
```

**Detailed JSON Report:**
```bash
npm audit --json > audit-report.json
```

**Specific Package Vulnerability:**
```bash
npm audit --omit=dev    # Exclude dev dependencies
npm audit fix --package-lock-only  # Don't update package.json
```

### 2. Secret Detection

**Tool:** TruffleHog + GitHub native scanning
**Trigger:** Every commit and PR
**Failure Condition:** Secrets detected in code

#### What It Detects

The secret detection system looks for:

- **AWS credentials** (access keys matching `AKIA[0-9A-Z]{16}`)
- **GitHub tokens** (PATs matching `ghp_[a-zA-Z0-9]{36}`)
- **API keys and passwords** in code and configuration
- **Private keys** (RSA, DSA, EC)
- **Database credentials**
- **Slack tokens**
- **Stripe API keys**

#### Best Practices

**NEVER commit secrets:**

```typescript
// ❌ WRONG - Secret in code
const API_KEY = "ghp_1234567890abcdefghijklmnopqr";

// ✅ CORRECT - Use environment variables
const API_KEY = process.env.GITHUB_API_TOKEN;

// ✅ CORRECT - Use .env.example as template
// .env.example:
// GITHUB_API_TOKEN=your_token_here
```

**If You Accidentally Commit a Secret:**

1. **Immediately revoke** the secret (rotate in production)
2. **Use git-filter-branch** or BFG to remove from history:
   ```bash
   # Remove file from entire history
   git filter-branch --tree-filter 'rm -f .env' -- --all
   ```
3. **Force push** to remote (if allowed):
   ```bash
   git push -f
   ```
4. **Create incident report** documenting what was exposed

**Configuration for .env Files:**

Create `.env.example` template:
```bash
# .env.example
DATABASE_URL=postgresql://user:password@localhost/dbname
API_KEY=your_api_key_here
STRIPE_SECRET_KEY=sk_test_...
ENCRYPTION_KEY=base64_encoded_key
```

Then add to `.gitignore`:
```
.env
.env.local
.env.*.local
*.key
*.pem
```

### 3. Static Application Security Testing (SAST)

**Tool:** ESLint + TypeScript + Pattern Matching
**Trigger:** Every commit and PR
**Failure Condition:** eval() detected, unsafe crypto patterns

#### Checks Performed

1. **ESLint Security Rules**
   - Linting with TypeScript and React best practices
   - No disabled security rules

2. **TypeScript Type Checking**
   - Strict null checks
   - No implicit any types
   - Type safety for all data flows

3. **Hardcoded Credentials**
   - Detects `password = "..."` patterns in source
   - Detects API key assignments

4. **Unsafe Crypto Usage**
   - Flags `Math.random()` for security purposes
   - Flags weak randomness patterns
   - Requires proper cryptographic RNGs

5. **SQL Injection Patterns**
   - Detects string concatenation in queries
   - Ensures parameterized queries

6. **eval() Usage**
   - Strictly forbidden - critical security issue
   - Fails PR if detected

7. **Encryption Implementation Verification**
   - Verifies AES-256 for data at rest
   - Confirms Argon2id for key derivation
   - Validates zero-knowledge architecture

#### Example: Detecting Unsafe Code

```typescript
// ❌ FAILS SAST CHECK - eval detected
const code = "2 + 2";
const result = eval(code);

// ❌ FAILS SAST CHECK - Hardcoded password
const dbPassword = "SuperSecure123";

// ❌ FAILS SAST CHECK - Math.random for security
const token = Math.random().toString(36);

// ✅ PASSES SAST CHECK - Proper crypto
import { randomBytes } from 'crypto';
const token = randomBytes(32).toString('hex');
```

### 4. Dependency Check

**Tool:** npm outdated + SBOM generation
**Trigger:** Every commit and PR (monthly deep scan via schedule)
**Failure Condition:** None (informational)

#### Software Bill of Materials (SBOM)

The system generates an SBOM (Software Bill of Materials) listing all dependencies:

```bash
npm ls --json > sbom.json
```

This includes:

- Package name and version
- License information
- Dependency tree
- Install size

#### Outdated Packages Report

Shows packages that have newer versions available:

```bash
npm outdated
```

Output example:
```
Package          Current  Latest  Wanted
react            18.2.0   18.3.0  18.3.0
@types/react     18.2.0   18.3.0  18.3.0
```

#### Keeping Dependencies Current

**Regular Updates:**
```bash
# Check what's outdated
npm outdated

# Update minor and patch versions safely
npm update

# Update to latest major versions (use with caution)
npm upgrade
```

**Dependency Update Policy:**

- **Security patches:** Apply immediately
- **Bug fix updates:** Apply within 2 weeks
- **Feature updates:** Apply within 1 sprint
- **Major updates:** Plan and test thoroughly

## Handling Vulnerabilities

### Workflow: Critical Vulnerability

1. **Detection**
   - CI pipeline detects critical vulnerability
   - PR blocked from merging
   - Email notification sent (if configured)

2. **Investigation**
   - Review vulnerability details: `npm audit`
   - Check CVE database for exploit details
   - Determine if fix is available

3. **Resolution Options**

   **Option A: Auto-fix (if available)**
   ```bash
   npm audit fix
   git add package*.json
   git commit -m "fix(security): address critical vulnerability in [package]"
   git push
   ```

   **Option B: Manual patching**
   - Update package version directly
   - Run full test suite
   - Verify no breaking changes

   **Option C: Dependency replacement**
   - If vulnerable package is abandoned
   - Find alternative package with similar functionality
   - Update imports and configuration

4. **Verification**
   ```bash
   npm audit  # Should show zero critical
   npm test   # Full test suite passes
   ```

5. **Merge**
   - All CI checks pass
   - PR can be merged

### Workflow: High Severity Vulnerability

1. **Detection**
   - Vulnerability detected on PR
   - GitHub bot comments with details
   - PR can still be merged (but flagged)

2. **Decision**
   - **Fix Now:** Run `npm audit fix` before merge
   - **Justify:** Document in PR why it's unavoidable
   - **Schedule:** Create follow-up issue if deferring

3. **If Deferring**
   - Add comment to PR explaining why
   - Create GitHub issue with "security" label
   - Link issue to project timeline

### Escalation: What to Do If Stuck

**Vulnerability cannot be fixed automatically:**

```bash
# See what the fix would do
npm audit fix --dry-run

# Check which packages would be updated
npm audit --json | jq '.vulnerabilities'

# Research the specific CVE
# Search: "CVE-YYYY-XXXXX"

# Check package release notes
npm view package changelog
```

**If vulnerability is unresolvable:**

1. **Escalate to security team**
2. **Document decision rationale**
3. **Implement compensating controls**
   - Additional input validation
   - Web Application Firewall (WAF) rules
   - Principle of least privilege

## PR Blocking & Status Checks

### Critical Security Failures Block PR

These failures **prevent merge**:

- ✗ Critical vulnerabilities in dependencies
- ✗ Secrets detected in code
- ✗ eval() or unsafe code patterns

### High Severity Issues Require Attention

These issues **allow merge but require action**:

- ⚠ High-severity vulnerabilities (need justification)
- ⚠ Outdated dependencies (informational)

### Status Check Configuration

All repos should have these branch protection rules:

```
Required status checks:
✓ Dependency Audit (security-scan job)
✓ Secret Detection (security-scan job)
✓ Static Analysis (security-scan job)
```

## Scheduled Scans

### Weekly Security Audit

Runs every **Sunday at 2 AM UTC**:

```yaml
schedule:
  - cron: '0 2 * * 0'
```

This scan:
- Runs full dependency audit
- Checks for newly discovered vulnerabilities
- Generates SBOM
- Reports outdated packages

### Setting Up Alerts

**GitHub Security Alerts:**

1. Go to repo Settings > Security & Analysis
2. Enable "Dependabot alerts"
3. Enable "Dependabot security updates"
4. Enable "Secret scanning"

**Email Notifications:**

1. Go to repo Settings > Notifications
2. Enable "Dependabot alerts"
3. Configure email recipients

## Troubleshooting

### npm audit showing false positives

**Investigate before dismissing:**

```bash
# Get detailed vulnerability info
npm audit --json | jq '.vulnerabilities'

# Check if it affects your code path
npm audit --production  # Only prod dependencies

# Review CVE details
npm view [vulnerable-package] cves
```

**Audit suppression (use carefully):**

In `package.json`:
```json
{
  "auditSuppress": [
    {
      "id": "CVEID",
      "expiry": "2026-03-17",
      "justification": "Reason for suppression"
    }
  ]
}
```

### Secret Detection False Positives

**Common false positives:**

- Example tokens in documentation
- UUIDs matching secret patterns
- Sample configuration values

**Exclude from scanning:**

Add to `.gitignore`:
```
# Example/documentation files
docs/examples/secrets.md
docs/sample-config.json
```

Or add paths to `.trufflehog.json`:
```json
{
  "exclusions": {
    "paths": [
      "docs/examples/.*",
      ".*example.*"
    ]
  }
}
```

### Static Analysis False Positives

**If ESLint shows incorrect errors:**

```typescript
// Disable for specific line
// eslint-disable-next-line rule-name
const something = problematicCode();

// Disable for entire file
/* eslint-disable rule-name */

// Or fix the underlying issue
```

## Security Scanning Metrics

Monitor these metrics over time:

| Metric | Target | Current |
|--------|--------|---------|
| Critical vulnerabilities | 0 | - |
| High vulnerabilities | <5 | - |
| Secrets detected | 0 | - |
| Code with security issues | <2% | - |
| Outdated packages | <10% | - |
| Test coverage | >80% | - |

## References

- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [TruffleHog GitHub](https://github.com/trufflesecurity/trufflehog)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [CVE Details](https://www.cvedetails.com/)

## See Also

- [CLAUDE.md](../CLAUDE.md) - Project architecture and security principles
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- `.github/workflows/security-scan.yml` - Security scan workflow
