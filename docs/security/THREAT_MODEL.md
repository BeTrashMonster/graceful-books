# Graceful Books Threat Model

**Version:** 1.0.0
**Created:** 2026-11-09
**Methodology:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
**Status:** Phase 1.2 - Foundation Security

---

## Executive Summary

This document applies STRIDE threat modeling to each trust boundary identified in the Attack Surface Map. Each threat is assigned a risk score and has a corresponding test case to verify mitigations.

**Key Principle:** Every threat must have a test. Untested mitigations are assumptions, not controls.

---

## Methodology

### STRIDE Categories

| Category | Description | Primary Asset Affected |
|----------|-------------|----------------------|
| **S**poofing | Impersonating something or someone | Identity |
| **T**ampering | Modifying data or code | Integrity |
| **R**epudiation | Denying having performed an action | Non-repudiation |
| **I**nformation Disclosure | Exposing data to unauthorized parties | Confidentiality |
| **D**enial of Service | Blocking access to resources | Availability |
| **E**levation of Privilege | Gaining unauthorized capabilities | Authorization |

### Risk Scoring

**Likelihood:**
| Rating | Score | Description |
|--------|-------|-------------|
| High | 3 | Exploitable with minimal effort/skill |
| Medium | 2 | Requires moderate effort or specific conditions |
| Low | 1 | Requires significant effort, skill, or access |

**Impact:**
| Rating | Score | Description |
|--------|-------|-------------|
| High | 3 | Complete compromise, data loss, financial loss |
| Medium | 2 | Partial compromise, limited exposure |
| Low | 1 | Minor impact, no sensitive data affected |

**Risk Score:** Likelihood × Impact

| Score | Risk Level | Action Required |
|-------|------------|-----------------|
| 7-9 | Critical | Immediate mitigation required |
| 5-6 | High | Prioritized mitigation |
| 3-4 | Medium | Scheduled mitigation |
| 1-2 | Low | Accept or monitor |

---

## Trust Boundary 1: Browser ↔ IndexedDB Storage

### Threat Analysis

| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation | Test Case |
|----|----------|--------|------------|--------|------|------------|-----------|
| STRIDE-TB1-S01 | Spoofing | Another browser tab/origin accessing IndexedDB | Low (1) | High (3) | 3 (Medium) | Same-origin policy enforcement | STRIDE-TB1-S01 |
| STRIDE-TB1-T01 | Tampering | External modification via DevTools | Medium (2) | High (3) | 6 (High) | Integrity signatures on critical data | STRIDE-TB1-T01 |
| STRIDE-TB1-T02 | Tampering | Browser extension modifying data | Medium (2) | High (3) | 6 (High) | Integrity checks on load | STRIDE-TB1-T02 |
| STRIDE-TB1-R01 | Repudiation | Actions performed without audit | Low (1) | Medium (2) | 2 (Low) | Comprehensive audit trail | STRIDE-TB1-R01 |
| STRIDE-TB1-I01 | Info Disclosure | Unencrypted sensitive data at rest | Low (1) | High (3) | 3 (Medium) | AES-256-GCM encryption | STRIDE-TB1-I01 |
| STRIDE-TB1-I02 | Info Disclosure | Data accessible to browser extensions | Medium (2) | High (3) | 6 (High) | Encryption at rest | STRIDE-TB1-I02 |
| STRIDE-TB1-D01 | DoS | Storage quota exhaustion | Low (1) | Medium (2) | 2 (Low) | Quota monitoring, graceful handling | STRIDE-TB1-D01 |
| STRIDE-TB1-E01 | Privilege | Bypassing permissions via direct DB access | Medium (2) | High (3) | 6 (High) | Data-layer permission checks | STRIDE-TB1-E01 |

### Detailed Threat Analysis

#### STRIDE-TB1-S01: Cross-Origin IndexedDB Access
- **Threat:** Malicious website attempts to access Graceful Books IndexedDB
- **Attack Vector:** XSS, malicious iframe, compromised third-party script
- **Current Mitigation:** Browser same-origin policy
- **Verification:** Test that IndexedDB is isolated per origin
- **Status:** Mitigated by browser

#### STRIDE-TB1-T01: DevTools Data Tampering
- **Threat:** User or attacker with DevTools access modifies IndexedDB directly
- **Attack Vector:** Direct database manipulation via DevTools
- **Current Mitigation:** None (inherent browser capability)
- **Verification:** Test that tampering is detectable
- **Required Mitigation:** Hash chain integrity verification
- **Status:** Requires implementation

#### STRIDE-TB1-E01: Direct Database Permission Bypass
- **Threat:** Bypassing UI permission checks by calling database directly
- **Attack Vector:** Browser console, malicious extension
- **Current Mitigation:** UI-level permission checks
- **Verification:** Test that permissions are enforced at data layer
- **Required Mitigation:** Service-layer permission enforcement
- **Status:** Requires verification

---

## Trust Boundary 2: Device ↔ Sync Relay

### Threat Analysis

| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation | Test Case |
|----|----------|--------|------------|--------|------|------------|-----------|
| STRIDE-TB2-S01 | Spoofing | Fake sync relay server | Low (1) | High (3) | 3 (Medium) | TLS certificate validation | STRIDE-TB2-S01 |
| STRIDE-TB2-S02 | Spoofing | Stolen session token | Medium (2) | High (3) | 6 (High) | Token binding, short expiry | STRIDE-TB2-S02 |
| STRIDE-TB2-T01 | Tampering | Modified sync messages in transit | Low (1) | High (3) | 3 (Medium) | TLS + payload signatures | STRIDE-TB2-T01 |
| STRIDE-TB2-T02 | Tampering | Replay attacks with old sync data | Medium (2) | Medium (2) | 4 (Medium) | Version vectors, timestamps | STRIDE-TB2-T02 |
| STRIDE-TB2-R01 | Repudiation | Sync operations without audit | Low (1) | Medium (2) | 2 (Low) | Server-side audit logging | STRIDE-TB2-R01 |
| STRIDE-TB2-I01 | Info Disclosure | Relay operator reading user data | Low (1) | High (3) | 3 (Medium) | Zero-knowledge encryption | STRIDE-TB2-I01 |
| STRIDE-TB2-I02 | Info Disclosure | Network eavesdropping | Low (1) | High (3) | 3 (Medium) | TLS 1.3 | STRIDE-TB2-I02 |
| STRIDE-TB2-D01 | DoS | Sync flooding | Medium (2) | Low (1) | 2 (Low) | Rate limiting | STRIDE-TB2-D01 |
| STRIDE-TB2-E01 | Privilege | Token with excessive scope | Low (1) | High (3) | 3 (Medium) | Minimal token scope | STRIDE-TB2-E01 |

### Detailed Threat Analysis

#### STRIDE-TB2-S01: Fake Sync Relay
- **Threat:** Attacker sets up fake sync server to intercept data
- **Attack Vector:** DNS poisoning, MITM, phishing
- **Current Mitigation:** TLS certificate validation
- **Verification:** Test rejection of invalid certificates
- **Status:** Mitigated by TLS

#### STRIDE-TB2-I01: Zero-Knowledge Violation
- **Threat:** Sync relay operator attempts to read user data
- **Attack Vector:** Insider threat, server compromise
- **Current Mitigation:** End-to-end encryption (AES-256-GCM)
- **Verification:** Test that relay only sees encrypted blobs
- **Status:** Mitigated by architecture

#### STRIDE-TB2-T02: Replay Attacks
- **Threat:** Attacker replays old sync messages to revert data
- **Attack Vector:** Network interception, compromised relay
- **Current Mitigation:** CRDT version vectors
- **Verification:** Test that old versions are rejected
- **Status:** Requires verification

---

## Trust Boundary 3: Multi-User (Device ↔ Device via Relay)

### Threat Analysis

| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation | Test Case |
|----|----------|--------|------------|--------|------|------------|-----------|
| STRIDE-TB3-S01 | Spoofing | User B impersonates User A | Low (1) | High (3) | 3 (Medium) | Per-user signing keys | STRIDE-TB3-S01 |
| STRIDE-TB3-S02 | Spoofing | Device impersonation | Low (1) | High (3) | 3 (Medium) | Device fingerprinting | STRIDE-TB3-S02 |
| STRIDE-TB3-T01 | Tampering | User B modifies User A's data | Low (1) | High (3) | 3 (Medium) | Per-entry signatures | STRIDE-TB3-T01 |
| STRIDE-TB3-T02 | Tampering | CRDT conflict exploitation | Medium (2) | Medium (2) | 4 (Medium) | Conflict resolution rules | STRIDE-TB3-T02 |
| STRIDE-TB3-R01 | Repudiation | User denies their changes | Low (1) | Medium (2) | 2 (Low) | Per-user audit trail | STRIDE-TB3-R01 |
| STRIDE-TB3-I01 | Info Disclosure | Consultant sees admin data | Medium (2) | High (3) | 6 (High) | Role-based encryption | STRIDE-TB3-I01 |
| STRIDE-TB3-D01 | DoS | User floods sync with changes | Low (1) | Low (1) | 1 (Low) | Per-user rate limits | STRIDE-TB3-D01 |
| STRIDE-TB3-E01 | Privilege | Consultant escalates to Admin | Medium (2) | High (3) | 6 (High) | CRDT permission validation | STRIDE-TB3-E01 |
| STRIDE-TB3-E02 | Privilege | Revoked user continues access | Medium (2) | High (3) | 6 (High) | Key rotation on revocation | STRIDE-TB3-E02 |

### Detailed Threat Analysis

#### STRIDE-TB3-S01: User Impersonation
- **Threat:** User B creates sync operations pretending to be User A
- **Attack Vector:** Key compromise, session theft
- **Current Mitigation:** Per-user signing keys
- **Verification:** Test signature verification on sync operations
- **Status:** Requires verification

#### STRIDE-TB3-E01: Privilege Escalation via Sync
- **Threat:** Consultant sends sync operation for admin action
- **Attack Vector:** Direct CRDT manipulation
- **Current Mitigation:** Permission checks on sync merge
- **Verification:** Test that operations validate permissions
- **Required Mitigation:** Check author's role at operation time
- **Status:** Requires verification

#### STRIDE-TB3-E02: Revoked User Access
- **Threat:** User continues accessing data after access revocation
- **Attack Vector:** Cached credentials, delayed sync
- **Current Mitigation:** Key rotation
- **Verification:** Test that revoked users cannot decrypt new data
- **Status:** Requires verification

---

## Trust Boundary 4: App ↔ Third-Party Services

### Threat Analysis

| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation | Test Case |
|----|----------|--------|------------|--------|------|------------|-----------|
| STRIDE-TB4-S01 | Spoofing | Fake Stripe webhook | Medium (2) | High (3) | 6 (High) | Webhook signature validation | STRIDE-TB4-S01 |
| STRIDE-TB4-S02 | Spoofing | MITM on API calls | Low (1) | Medium (2) | 2 (Low) | TLS certificate pinning | STRIDE-TB4-S02 |
| STRIDE-TB4-T01 | Tampering | Modified API responses | Low (1) | Medium (2) | 2 (Low) | Response validation | STRIDE-TB4-T01 |
| STRIDE-TB4-I01 | Info Disclosure | API key exposure in frontend | Medium (2) | High (3) | 6 (High) | Keys in backend only | STRIDE-TB4-I01 |
| STRIDE-TB4-I02 | Info Disclosure | Excessive data sent to APIs | Low (1) | Medium (2) | 2 (Low) | Minimal data principle | STRIDE-TB4-I02 |
| STRIDE-TB4-D01 | DoS | Third-party service down | Medium (2) | Low (1) | 2 (Low) | Graceful degradation | STRIDE-TB4-D01 |

### Detailed Threat Analysis

#### STRIDE-TB4-S01: Webhook Spoofing
- **Threat:** Attacker sends fake Stripe webhook to trigger actions
- **Attack Vector:** HTTP POST to webhook endpoint
- **Current Mitigation:** Stripe signature verification
- **Verification:** Test rejection of invalid webhook signatures
- **Status:** Requires verification

#### STRIDE-TB4-I01: API Key Exposure
- **Threat:** Stripe secret key exposed in frontend code
- **Attack Vector:** Source code inspection
- **Current Mitigation:** Backend-only API keys
- **Verification:** Test that secret keys are not in frontend bundle
- **Status:** Requires verification

---

## Cross-Boundary Threats

### Input Validation Threats

| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation | Test Case |
|----|----------|--------|------------|--------|------|------------|-----------|
| STRIDE-INPUT-01 | Tampering | XSS via user input | Medium (2) | High (3) | 6 (High) | DOMPurify sanitization | STRIDE-INPUT-01 |
| STRIDE-INPUT-02 | Tampering | CSV injection | Medium (2) | Medium (2) | 4 (Medium) | CSV sanitization | STRIDE-INPUT-02 |
| STRIDE-INPUT-03 | Tampering | SQL/NoSQL injection | Low (1) | High (3) | 3 (Medium) | Parameterized queries | STRIDE-INPUT-03 |
| STRIDE-INPUT-04 | Tampering | Prompt injection (future AI) | High (3) | High (3) | 9 (Critical) | Input sanitization | STRIDE-INPUT-04 |

### Session Management Threats

| ID | Category | Threat | Likelihood | Impact | Risk | Mitigation | Test Case |
|----|----------|--------|------------|--------|------|------------|-----------|
| STRIDE-SESSION-01 | Spoofing | Session fixation | Low (1) | High (3) | 3 (Medium) | Session regeneration | STRIDE-SESSION-01 |
| STRIDE-SESSION-02 | Spoofing | Session hijacking | Medium (2) | High (3) | 6 (High) | Device fingerprinting | STRIDE-SESSION-02 |
| STRIDE-SESSION-03 | Info Disclosure | Session token in URL | Low (1) | High (3) | 3 (Medium) | Token in header only | STRIDE-SESSION-03 |

---

## Risk Summary

### Critical Risks (Score 7-9)

| ID | Threat | Current Status | Action Required |
|----|--------|----------------|-----------------|
| STRIDE-INPUT-04 | Prompt injection | Not mitigated | Phase 2 implementation |

### High Risks (Score 5-6)

| ID | Threat | Current Status | Action Required |
|----|--------|----------------|-----------------|
| STRIDE-TB1-T01 | DevTools tampering | Partial | Implement integrity checks |
| STRIDE-TB1-T02 | Extension tampering | Partial | Implement integrity checks |
| STRIDE-TB1-I02 | Extension data access | Mitigated | Verify encryption |
| STRIDE-TB1-E01 | Permission bypass | Unknown | Verify data-layer checks |
| STRIDE-TB2-S02 | Stolen session token | Partial | Verify token binding |
| STRIDE-TB3-I01 | Role data leakage | Unknown | Verify role-based encryption |
| STRIDE-TB3-E01 | Privilege escalation | Unknown | Verify CRDT permissions |
| STRIDE-TB3-E02 | Revoked user access | Unknown | Verify key rotation |
| STRIDE-TB4-S01 | Webhook spoofing | Unknown | Verify signature validation |
| STRIDE-TB4-I01 | API key exposure | Unknown | Verify key placement |
| STRIDE-INPUT-01 | XSS attacks | Mitigated | Verify sanitization |
| STRIDE-SESSION-02 | Session hijacking | Partial | Verify fingerprinting |

---

## Verification Test Requirements

### Test Case Mapping

Each threat ID maps to a test case in `src/__tests__/security/strideValidation.test.ts`:

```typescript
// Test Case Structure
describe('STRIDE Threat Validation', () => {
  describe('Trust Boundary 1: Browser ↔ IndexedDB', () => {
    it('STRIDE-TB1-S01: Origin isolation', ...);
    it('STRIDE-TB1-T01: Tamper detection', ...);
    // ... for each threat
  });
});
```

### Required Test Count

- Trust Boundary 1: 8 threats = 8 tests
- Trust Boundary 2: 9 threats = 9 tests
- Trust Boundary 3: 9 threats = 9 tests
- Trust Boundary 4: 6 threats = 6 tests
- Input Validation: 4 threats = 4 tests
- Session Management: 3 threats = 3 tests

**Total: 39 threat-to-test mappings**

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-11-09 | Security Implementation | Initial threat model |

---

## References

- Attack Surface Map: `docs/security/ATTACK_SURFACE_MAP.md`
- MVS-R 16: STRIDE methodology
- OWASP Threat Modeling
- Microsoft SDL Threat Modeling

---

*This document is part of the Agentic AI Security Implementation Roadmap, Phase 1: Foundation Security.*
