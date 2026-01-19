# Security Policy

Graceful Books takes security seriously. This document outlines our security policy, how to report vulnerabilities, and how we handle security updates.

## Our Security Commitment

As a zero-knowledge accounting platform, security is at the core of everything we build. We are committed to:

1. **Protecting user data** through client-side encryption before any data leaves your device
2. **Maintaining transparency** about our security practices and any incidents
3. **Responding promptly** to security reports and vulnerabilities
4. **Continuous improvement** of our security posture

## Reporting a Vulnerability

We appreciate the security research community's efforts to improve our platform's security. If you discover a security vulnerability, please follow our responsible disclosure process.

### How to Report

**Preferred Method: GitHub Security Advisories**

1. Go to [GitHub Security Advisories](https://github.com/gracefulbooks/graceful-books/security/advisories)
2. Click "Report a vulnerability"
3. Provide detailed information about the vulnerability
4. We will respond within 48 hours

**Alternative: Email**

If you prefer email or cannot use GitHub:
- Email: security@gracefulbooks.com
- Use PGP encryption if available (key available on request)

### What to Include

Please provide as much information as possible:

- **Description:** Clear description of the vulnerability
- **Impact:** What could an attacker achieve?
- **Steps to reproduce:** Detailed steps to reproduce the issue
- **Affected versions:** Which versions are affected?
- **Proof of concept:** Code or screenshots demonstrating the issue
- **Suggested fix:** If you have ideas for remediation

### What to Expect

| Timeline | Action |
|----------|--------|
| Within 48 hours | We acknowledge receipt of your report |
| Within 7 days | We provide initial assessment and severity rating |
| Within 30 days | We aim to have a fix ready for testing |
| Within 90 days | Public disclosure (coordinated with you) |

We may extend timelines for complex issues, but we will keep you informed.

### Our Commitment to Researchers

- We will not take legal action against researchers who follow this policy
- We will acknowledge your contribution (unless you prefer to remain anonymous)
- We will keep you informed of our progress
- We will credit you in our security advisory (if desired)

### Responsible Disclosure Guidelines

Please:
- Give us reasonable time to address the issue before public disclosure
- Do not access, modify, or delete user data
- Do not disrupt our services or other users
- Do not exploit the vulnerability beyond what is necessary to demonstrate it
- Keep vulnerability details confidential until we coordinate disclosure

## Supported Versions

We provide security updates for the following versions:

| Version | Supported |
|---------|-----------|
| Latest release | Yes (full support) |
| Previous minor release | Yes (security patches only) |
| Older versions | No |

**Recommendation:** Always use the latest version for the best security.

### Version Support Policy

- **Latest release:** Full support including features, bug fixes, and security patches
- **Previous minor release:** Security patches only for 6 months after new release
- **Older versions:** No support; please upgrade

## Security Updates

### How We Handle Security Updates

1. **Assessment:** We assess the severity using CVSS scoring
2. **Development:** We develop and test a fix
3. **Notification:** We notify affected users if critical
4. **Release:** We release the fix with a security advisory
5. **Disclosure:** We publish details after users have time to update

### Severity Levels

| Severity | Response Time | User Notification |
|----------|--------------|-------------------|
| Critical (CVSS 9.0-10.0) | Immediate fix, within 24 hours | Direct notification |
| High (CVSS 7.0-8.9) | Fix within 7 days | Release notes |
| Medium (CVSS 4.0-6.9) | Fix within 30 days | Release notes |
| Low (CVSS 0.1-3.9) | Next scheduled release | Changelog |

### Staying Informed

- **Security Advisories:** [GitHub Security Advisories](https://github.com/gracefulbooks/graceful-books/security/advisories)
- **Release Notes:** Check the CHANGELOG.md for security-related updates
- **Status Page:** Monitor our status page for ongoing incidents

## Security Architecture

### Zero-Knowledge Encryption

Graceful Books uses a zero-knowledge architecture where:

- All financial data is encrypted on your device before transmission
- Encryption keys are derived from your passphrase using Argon2id
- The server only stores encrypted data it cannot decrypt
- Even in the event of a server breach, your data remains encrypted

### Key Security Features

| Feature | Description |
|---------|-------------|
| **Client-side encryption** | AES-256 encryption before any data leaves your device |
| **Key derivation** | Argon2id with secure parameters |
| **Transport security** | TLS 1.2+ for all communications |
| **Zero-knowledge sync** | Servers cannot decrypt your data |
| **Audit trail** | Immutable log of all financial transactions |
| **Role-based access** | Granular permissions for multi-user accounts |

### Security Headers

All deployments include security headers to prevent common attacks:

- Content Security Policy (CSP) to prevent XSS
- Strict Transport Security (HSTS) to enforce HTTPS
- X-Frame-Options to prevent clickjacking
- X-Content-Type-Options to prevent MIME sniffing
- Referrer-Policy to protect user privacy

See [docs/DEPLOYMENT_SECURITY.md](docs/DEPLOYMENT_SECURITY.md) for detailed configuration.

## Security Testing

### Automated Security Scanning

Our CI/CD pipeline includes:

- **Dependency scanning:** npm audit on every commit
- **Secret detection:** Scanning for accidentally committed secrets
- **Static analysis:** ESLint security rules and pattern detection
- **Type checking:** TypeScript strict mode for type safety

See [docs/SECURITY_SCANNING.md](docs/SECURITY_SCANNING.md) for details.

### Manual Security Review

- Code reviews include security considerations
- Periodic security audits of critical components
- Penetration testing for major releases

## Compliance

While Graceful Books is designed with security in mind, users are responsible for ensuring their use complies with applicable regulations. Our zero-knowledge architecture supports compliance with:

- **GDPR:** User data sovereignty and right to deletion
- **CCPA:** User control over personal information
- **SOC 2:** Security controls and audit trails

Consult with legal counsel for specific compliance requirements.

## Contact

- **Security issues:** security@gracefulbooks.com
- **GitHub Security Advisories:** [Report a vulnerability](https://github.com/gracefulbooks/graceful-books/security/advisories)
- **General inquiries:** support@gracefulbooks.com

## Recognition

We maintain a security hall of fame to recognize researchers who have helped improve our security:

*No entries yet - be the first to help us improve!*

---

**Last Updated:** 2026-01-18

Thank you for helping keep Graceful Books secure.
