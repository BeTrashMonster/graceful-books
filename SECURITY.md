# Security Policy

## Our Commitment to Security

At Graceful Books, security is at the heart of everything we do. We've built this platform on a zero-knowledge encryption architecture because we believe your financial data should be yours alone. We're committed to keeping your information safe, and we welcome the security community's help in making our platform even more secure.

As a zero-knowledge accounting platform, security is at the core of everything we build. We are committed to:

1. **Protecting user data** through client-side encryption before any data leaves your device
2. **Maintaining transparency** about our security practices and any incidents
3. **Responding promptly** to security reports and vulnerabilities
4. **Continuous improvement** of our security posture
5. **Working collaboratively** with security researchers in good faith

## Reporting a Vulnerability

We deeply appreciate security researchers who help us keep Graceful Books safe. If you've discovered a security vulnerability, we want to hear from you.

### How to Report

**Preferred Method: GitHub Security Advisories**

1. Go to [GitHub Security Advisories](https://github.com/gracefulbooks/graceful-books/security/advisories)
2. Click "Report a vulnerability"
3. Provide detailed information about the vulnerability
4. We will respond within 48 hours

**Alternative: Email**

If you prefer email or cannot use GitHub:
- **Email:** security@gracefulbooks.com
- **PGP encryption:** Available for sensitive issues (key available on request at security@gracefulbooks.com)
- **Key Fingerprint:** [To be added when PGP key is generated]

### What to Include in Your Report

To help us understand and address the issue quickly, please include:

1. **Description of the vulnerability**
   - What type of vulnerability is it? (IDOR, XSS, CSRF, SQL Injection, etc.)
   - What is the potential impact?

2. **Location**
   - Where is the vulnerability? (URL, file path, component name)
   - What versions are affected?

3. **Steps to reproduce**
   - Detailed step-by-step instructions
   - Proof of concept code or screenshots (if applicable)
   - Any special conditions required to trigger the issue

4. **Your contact information**
   - How should we reach you with questions?
   - Would you like to be credited in our acknowledgments?

5. **Optional but helpful**
   - Suggested fix or remediation approach
   - Any additional context or related findings

### What Happens Next

Here's exactly what you can expect after submitting a report:

| Timeline | Action |
|----------|--------|
| Within 48 hours | We acknowledge receipt of your report and assign a tracking number |
| Within 7 days | We validate the vulnerability and provide initial severity assessment |
| Within 15 days | We confirm the issue and share our remediation plan with you |
| Ongoing | We keep you updated on our progress every 7-14 days |
| Before disclosure | We coordinate public disclosure timing with you |

**Resolution Timelines by Severity:**
- **Critical vulnerabilities:** 7-14 days
- **High severity:** 30 days
- **Medium severity:** 60 days
- **Low severity:** 90 days

We may need to extend timelines for complex issues, but we'll keep you informed every step of the way.

---

## Responsible Disclosure Guidelines

We're committed to working with security researchers in good faith. Here's what that means:

### Our Promise to Researchers

We pledge to:

- **Never pursue legal action** against researchers who follow these guidelines
- **Respond promptly** to all legitimate security reports
- **Keep you informed** about our progress on your report
- **Give you credit** for your discovery (if you'd like)
- **Work collaboratively** to understand and resolve issues
- **Provide safe harbor** under the Computer Fraud and Abuse Act for authorized testing

### What We Ask of Researchers

To qualify for our responsible disclosure protections, please:

- **Report vulnerabilities privately** to security@gracefulbooks.com or via GitHub Security Advisories before public disclosure
- **Give us reasonable time** to fix the issue before going public (90 days is standard, following industry best practices)
- **Avoid privacy violations** - don't access, modify, or delete other users' data
- **Don't disrupt our services** - use test accounts when possible, avoid denial of service attacks
- **Don't exploit vulnerabilities** beyond what's necessary to demonstrate the issue
- **Act in good faith** - no extortion, no demands for payment
- **Keep details confidential** until we coordinate public disclosure together

### What's In Scope

We welcome security research on:

- **Web application:** app.gracefulbooks.com
- **API endpoints:** api.gracefulbooks.com
- **Authentication and authorization mechanisms**
- **Encryption implementation and key management**
- **Data isolation between companies (IDOR vulnerabilities)**
- **Client-side security (XSS, CSRF, etc.)**
- **Input validation and output sanitization**
- **Session management and security headers**
- **Dependencies and third-party libraries**
- **Open source repositories on GitHub**

### What's Out of Scope

Please don't report:

- **Social engineering attacks** against our team or users
- **Physical attacks** against our offices or infrastructure
- **Denial of Service (DoS/DDoS) attacks**
- **Spam or social media issues**
- **Reports from automated scanners** without manual validation
- **Issues in unsupported versions** (see Supported Versions below)
- **Theoretical vulnerabilities** without proof of concept
- **Known issues** already listed in our security advisories
- **Issues requiring physical access** to user devices

**Note:** If you're unsure whether something is in scope, please ask before testing. We're happy to clarify. Send questions to security@gracefulbooks.com.

---

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 1.x.x   | :white_check_mark: | Active development - full support |
| 0.9.x   | :white_check_mark: | Security patches only (6 months) |
| < 0.9   | :x:                | No longer supported |
| Pre-release | :x:            | Not recommended for production use |

**Recommendation:** Always use the latest version for the best security and features.

### Version Support Policy

- **Latest release (1.x.x):** Full support including features, bug fixes, and security patches
- **Previous minor release (0.9.x):** Security patches only for 6 months after new major release
- **Older versions (< 0.9):** No support; please upgrade immediately
- **Pre-release versions:** No security support; use at your own risk

## Security Updates

### How We Handle Security Updates

1. **Assessment:** We assess the severity using CVSS v3.1 scoring
2. **Validation:** We reproduce the issue and confirm the impact
3. **Development:** We develop and thoroughly test a fix
4. **Notification:** We notify affected users based on severity
5. **Release:** We release the fix with a security advisory
6. **Disclosure:** We publish details after users have time to update (coordinated with reporter)
7. **Recognition:** We credit the researcher in our Hall of Fame (if desired)

### Severity Levels

| Severity | CVSS Score | Response Time | Fix Timeline | User Notification |
|----------|-----------|---------------|--------------|-------------------|
| Critical | 9.0-10.0 | Within 24 hours | 7-14 days | Direct email notification |
| High | 7.0-8.9 | Within 48 hours | 30 days | Release notes + in-app notice |
| Medium | 4.0-6.9 | Within 7 days | 60 days | Release notes |
| Low | 0.1-3.9 | Within 14 days | 90 days | Changelog only |

### Staying Informed

To stay informed about security issues:

- **GitHub Security Advisories:** [View advisories](https://github.com/gracefulbooks/graceful-books/security/advisories)
- **Watch this repository** on GitHub with "Security alerts only" enabled
- **Security mailing list:** Subscribe at security-announce@gracefulbooks.com
- **Release Notes:** Check CHANGELOG.md for security-related updates (tagged with [SECURITY])
- **Status Page:** Monitor status.gracefulbooks.com for ongoing incidents
- **Twitter:** Follow [@gracefulbooks](https://twitter.com/gracefulbooks) for urgent announcements

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

---

## Security Best Practices for Users

We've built strong security into our platform, but security is a shared responsibility. Here's how you can help protect your data:

### Strong Passphrases
- Use a unique, strong passphrase (20+ characters recommended)
- Never reuse passphrases from other services
- Consider using a password manager like 1Password or Bitwarden
- Avoid common patterns or dictionary words

### Multi-User Access
- Use role-based access (don't give everyone Admin privileges)
- Follow the principle of least privilege
- Revoke access immediately when team members leave
- Audit user access regularly (monthly recommended)
- Use unique credentials for each team member

### Device Security
- Keep your devices and browsers up to date
- Use full-disk encryption on devices accessing financial data
- Don't access your account on shared or public computers
- Enable two-factor authentication (when available)
- Use a firewall and antivirus software

### Backup Your Encryption Key
- Store your recovery key in a safe place (use a password manager or secure vault)
- Never share your recovery key via email or messaging
- **Important:** If you lose your key, we cannot recover your data (zero-knowledge means zero access)
- Consider keeping a printed copy in a secure physical location

### Recognize Phishing Attempts
- We will never ask for your passphrase or recovery key via email
- Always verify the URL before entering credentials (look for https://app.gracefulbooks.com)
- Be suspicious of urgent requests to update account information
- When in doubt, contact us at support@gracefulbooks.com

---

## Legal

### Safe Harbor

We authorize security research on Graceful Books systems in accordance with this policy and commit to:

- Not pursuing legal action against researchers who follow these guidelines
- Working in good faith to understand and resolve security issues
- Treating your research as authorized security testing (not as a violation of laws like the Computer Fraud and Abuse Act, DMCA, or similar laws)

### Limitations

This safe harbor only applies to:
- Security research conducted in accordance with this policy
- Testing performed on your own accounts or with explicit permission from account owners
- Research reported privately before public disclosure
- Actions taken in good faith to identify and report vulnerabilities

This safe harbor does NOT protect:
- Accessing other users' data without authorization
- Intentionally disrupting our services or degrading user experience
- Violating laws beyond computer access (harassment, privacy violations, intellectual property theft, etc.)
- Demands for payment or compensation in exchange for disclosure
- Public disclosure before coordinating with our security team
- Social engineering attacks against our team or users

**Note:** This safe harbor is limited to U.S. law. Security researchers outside the U.S. should be aware of their local laws.

---

## Contact

- **Security issues:** security@gracefulbooks.com
- **GitHub Security Advisories:** [Report a vulnerability](https://github.com/gracefulbooks/graceful-books/security/advisories)
- **General inquiries:** hello@gracefulbooks.com
- **Support:** support@gracefulbooks.com

We typically respond to security inquiries within 2 business days (within 48 hours for vulnerability reports).

---

## Security Acknowledgments

We're grateful to the following security researchers who have helped make Graceful Books more secure:

### Hall of Fame

*When researchers help us identify vulnerabilities, we'll acknowledge them here (with their permission).*

**2026**
- *Your name could be here! Be the first to help us improve.*

**Recognition Levels:**
- 🏆 **Critical** - Prevented major data breach or system compromise (CVSS 9.0-10.0)
- 🥇 **High** - Identified significant security vulnerability (CVSS 7.0-8.9)
- 🥈 **Medium** - Found important security issue (CVSS 4.0-6.9)
- 🥉 **Low** - Reported minor security concern (CVSS 0.1-3.9)

### How Recognition Works

If you report a vulnerability:
1. We'll ask if you'd like to be credited (it's entirely optional)
2. After the fix is deployed, we'll add you to our Hall of Fame
3. You'll receive recognition based on the severity level
4. We'll link to your GitHub, Twitter, or website (if desired)

---

## Bug Bounty Program

**Status:** Coming soon!

While we don't currently offer monetary rewards, we deeply value security research contributions. We're working on establishing a formal bug bounty program that will include:

- **Monetary rewards** based on severity (Critical: $500-2000, High: $200-500, Medium: $50-200)
- **Swag and recognition** (Graceful Books merchandise)
- **Early access** to new features and beta programs
- **Direct communication** with our security team

**Interested in participating when we launch?** Email security@gracefulbooks.com with "Bug Bounty Interest" in the subject line, and we'll notify you when the program goes live.

**Expected Launch:** Q2 2026

---

## Policy Updates

This policy was last updated on **2026-02-23**.

We may update this policy from time to time to reflect changes in our practices, technology, or legal requirements. Significant changes will be announced via:
- Our security mailing list (security-announce@gracefulbooks.com)
- GitHub Security Advisories
- Our changelog (CHANGELOG.md)

**Policy Version:** 2.0.0

---

*Thank you for helping us keep Graceful Books secure. Your research and responsible disclosure help protect the financial data of entrepreneurs around the world. We're grateful for your partnership in making our platform safer for everyone.*
