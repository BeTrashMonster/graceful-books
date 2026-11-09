# Approved Dependencies

**Version:** 1.0.0
**Last Updated:** 2026-11-09
**Security Phase:** 2.3 - SLSA Level 2 Supply Chain Security

---

## Overview

This document tracks all approved dependencies for Graceful Books. New packages require security review before approval.

**Policy:**
- All direct dependencies must be listed here
- New packages require justification and security review
- Transitive dependencies are tracked via package-lock.json
- Vulnerabilities must be addressed within SLA (see below)

---

## Vulnerability Response SLA

| Severity | Response Time | Resolution Time |
|----------|---------------|-----------------|
| Critical | 4 hours | 24 hours |
| High | 24 hours | 72 hours |
| Moderate | 1 week | 2 weeks |
| Low | 1 month | Next release |

---

## Core Framework

| Package | Version | Approved By | Date | Justification |
|---------|---------|-------------|------|---------------|
| react | 18.3.1 | Security Team | 2026-01-01 | Core UI framework |
| react-dom | 18.3.1 | Security Team | 2026-01-01 | React DOM rendering |
| typescript | 5.x | Security Team | 2026-01-01 | Type safety |
| vite | 5.x | Security Team | 2026-01-01 | Build tooling |

## Data & Storage

| Package | Version | Approved By | Date | Justification |
|---------|---------|-------------|------|---------------|
| dexie | 4.x | Security Team | 2026-01-01 | IndexedDB wrapper for local-first |
| crypto-js | 4.x | Security Team | 2026-01-01 | Encryption (legacy compat) |

## Security

| Package | Version | Approved By | Date | Justification |
|---------|---------|-------------|------|---------------|
| dompurify | 3.x | Security Team | 2026-01-01 | XSS prevention |
| argon2-browser | 1.x | Security Team | 2026-01-01 | Password hashing |

## Utilities

| Package | Version | Approved By | Date | Justification |
|---------|---------|-------------|------|---------------|
| date-fns | 3.x | Security Team | 2026-01-01 | Date manipulation |
| uuid | 9.x | Security Team | 2026-01-01 | UUID generation |
| papaparse | 5.x | Security Team | 2026-01-01 | CSV parsing |

## Testing

| Package | Version | Approved By | Date | Justification |
|---------|---------|-------------|------|---------------|
| vitest | 4.x | Security Team | 2026-01-01 | Unit testing |
| @testing-library/react | 16.x | Security Team | 2026-01-01 | React testing |
| playwright | 1.x | Security Team | 2026-01-01 | E2E testing |

---

## Approval Process

### For New Dependencies

1. **Submit Request**
   - Package name and version
   - Justification for adding
   - Alternatives considered

2. **Security Review**
   - Check npm audit status
   - Review package maintainers
   - Check download counts and last update
   - Review dependencies (transitive)
   - Check for typosquatting

3. **Decision**
   - Approve: Add to this document
   - Reject: Document reason
   - Defer: Request more information

### Red Flags (Auto-Reject)

- Package with < 1000 weekly downloads
- No updates in > 2 years (unless stable/complete)
- Known security vulnerabilities unfixed
- Suspicious package name (typosquatting)
- No clear maintainer or organization
- Excessive transitive dependencies (> 50)

---

## Dependency Change Log

| Date | Package | Action | Reviewer | Notes |
|------|---------|--------|----------|-------|
| 2026-11-09 | (initial) | Document created | Security Team | Phase 2.3 implementation |

---

## Transitive Dependency Policy

Transitive dependencies are managed via:
1. `package-lock.json` with integrity hashes
2. Regular `npm audit` runs
3. Dependabot alerts (GitHub)
4. Weekly security scans

When a transitive dependency has a vulnerability:
1. Check if it affects our usage
2. Update parent dependency if fix available
3. Apply override if necessary (document reason)
4. Remove parent if no fix available within SLA

---

## Related Documents

- `NPM_INSTALL_CHECKLIST.md` - Pre-install security steps
- `.npmrc` - npm security configuration
- `scripts/dependency-audit.sh` - Automated audit script

---

*This is a living document. Update when dependencies change.*
