# Security Remediation Tracker

**Version:** 1.0.0
**Created:** 2026-11-09
**Status:** Active Tracking

---

## Overview

This document tracks remediation status for all identified security threats. Each threat requires:
1. **Implementation** of the mitigation
2. **Proving test** that attempts the attack and verifies it's blocked
3. **Verification** that the test passes

**Threats are not "fixed" until a proving test passes.**

---

## Risk Summary

| Risk Level | Count | Remediated | Pending |
|------------|-------|------------|---------|
| Critical (7-9) | 1 | 1 | 0 |
| High (5-6) | 12 | 4 | 8 |
| Medium (3-4) | 8 | 1 | 7 |
| **Total Actionable** | **21** | **6** | **15** |

---

## Active Findings

### FINDING-001: XSS in EmailPreviewPanel (STRIDE-INPUT-01)
| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Status** | 🟢 VERIFIED |
| **File** | `src/components/admin/workshops/EmailPreviewPanel.tsx:108` |
| **Issue** | Used `dangerouslySetInnerHTML` without DOMPurify sanitization |
| **Attack** | Malicious HTML in email template executes in admin browser |
| **Fix Applied** | Wrapped `previewBody` with `sanitizeEmailHtml()` from `src/utils/sanitize.ts` |
| **Found By** | `securityProving.test.ts` - XSS Prevention test |
| **Verified** | 2026-11-09 - All 27 securityProving tests pass |

---

## Critical Risks (Score 7-9)

### STRIDE-INPUT-04: Prompt Injection Defense
| Field | Value |
|-------|-------|
| **Risk Score** | 9 (Critical) |
| **Trust Boundary** | Cross-boundary (Input Validation) |
| **Current Status** | 🟢 VERIFIED |
| **Mitigation Applied** | Bank import sanitization with 84+ injection pattern tests |
| **Proving Test** | `phase2Proving.test.ts` - Prompt Injection Detection (84 tests) |
| **Owner** | Security Implementation |
| **Verified** | 2026-11-09 - Phase 2 implementation complete |
| **Files** | `src/services/import/sanitization.ts`, `src/services/sanitization/documentSanitization.ts` |

---

## High Risks (Score 5-6)

### STRIDE-TB1-T01: DevTools Data Tampering
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB1: Browser ↔ IndexedDB |
| **Current Status** | 🔴 Not Implemented |
| **Mitigation Required** | Hash chain integrity verification on data load |
| **Proving Test** | `securityProving.test.ts` - `detects IndexedDB tampering via DevTools` |
| **Owner** | TBD |
| **Implementation** | Add HMAC signature to critical records, verify on read |

---

### STRIDE-TB1-T02: Browser Extension Tampering
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB1: Browser ↔ IndexedDB |
| **Current Status** | 🟡 Partial (Encryption exists) |
| **Mitigation Required** | Integrity checks on encrypted data |
| **Proving Test** | `securityProving.test.ts` - `detects extension data modification` |
| **Owner** | TBD |
| **Implementation** | Verify encryption + add tamper-detection signatures |

---

### STRIDE-TB1-I02: Extension Data Access
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB1: Browser ↔ IndexedDB |
| **Current Status** | 🟡 Partial (Encryption module exists) |
| **Mitigation Required** | Verify all sensitive fields encrypted at rest |
| **Proving Test** | `securityProving.test.ts` - `sensitive data is encrypted in IndexedDB` |
| **Owner** | TBD |
| **Implementation** | Audit all tables, ensure PII/financial data encrypted |

---

### STRIDE-TB1-E01: Permission Bypass via Direct DB Access
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB1: Browser ↔ IndexedDB |
| **Current Status** | 🟡 Partial (RBAC exists at service layer) |
| **Mitigation Required** | Data-layer permission checks (not just UI) |
| **Proving Test** | `securityProving.test.ts` - `blocks direct DB write bypassing service layer` |
| **Owner** | TBD |
| **Implementation** | Add Dexie middleware that enforces permissions |

---

### STRIDE-TB2-S02: Stolen Session Token
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB2: Device ↔ Sync Relay |
| **Current Status** | 🟡 Partial (Token binding exists) |
| **Mitigation Required** | Device fingerprint binding, short expiry |
| **Proving Test** | `securityProving.test.ts` - `rejects token used from different device` |
| **Owner** | TBD |
| **Implementation** | Verify session fingerprinting enforced on all sync ops |

---

### STRIDE-TB3-I01: Consultant Sees Admin Data
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB3: Multi-User |
| **Current Status** | 🔴 Unknown |
| **Mitigation Required** | Role-based encryption keys |
| **Proving Test** | `securityProving.test.ts` - `consultant cannot decrypt admin-only data` |
| **Owner** | TBD |
| **Implementation** | Separate encryption keys per role, key hierarchy |

---

### STRIDE-TB3-E01: Privilege Escalation via Sync
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB3: Multi-User |
| **Current Status** | 🟢 VERIFIED |
| **Mitigation Applied** | CRDT operation RBAC validation in SyncSecurity service |
| **Proving Test** | `phase2Proving.test.ts` - RBAC Permission Validation tests |
| **Owner** | Security Implementation |
| **Verified** | 2026-11-09 - Phase 2.4 implementation |
| **File** | `src/services/sync/SyncSecurity.ts` |

---

### STRIDE-TB3-E02: Revoked User Continues Access
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB3: Multi-User |
| **Current Status** | 🟢 VERIFIED |
| **Mitigation Applied** | SyncSecurity rejects all operations from revoked users |
| **Proving Test** | `phase2Proving.test.ts` - Revoked User Rejection tests |
| **Owner** | Security Implementation |
| **Verified** | 2026-11-09 - Phase 2.4 implementation |
| **File** | `src/services/sync/SyncSecurity.ts` |

---

### STRIDE-TB4-S01: Webhook Spoofing
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB4: Third-Party Services |
| **Current Status** | 🔴 Unknown |
| **Mitigation Required** | Stripe webhook signature validation |
| **Proving Test** | `securityProving.test.ts` - `rejects webhook with invalid signature` |
| **Owner** | TBD |
| **Implementation** | Verify Stripe signature on all webhook endpoints |

---

### STRIDE-TB4-I01: API Key Exposure in Frontend
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | TB4: Third-Party Services |
| **Current Status** | 🟡 Needs Verification |
| **Mitigation Required** | Secret keys backend-only |
| **Proving Test** | `securityProving.test.ts` - `no secret keys in frontend bundle` |
| **Owner** | TBD |
| **Implementation** | Scan build output for sk_live/sk_test patterns |

---

### STRIDE-INPUT-01: XSS via User Input
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | Input Validation |
| **Current Status** | 🟢 Verified |
| **Mitigation Applied** | EmailPreviewPanel now uses `sanitizeEmailHtml()` |
| **Proving Test** | `securityProving.test.ts` - `sanitizes XSS payloads in all input fields` |
| **Owner** | Security Implementation |
| **Verified** | 2026-11-09 - 27/27 securityProving tests pass |

---

### STRIDE-SESSION-02: Session Hijacking
| Field | Value |
|-------|-------|
| **Risk Score** | 6 (High) |
| **Trust Boundary** | Session Management |
| **Current Status** | 🟡 Partial (Fingerprinting exists) |
| **Mitigation Required** | Device fingerprinting enforced |
| **Proving Test** | `securityProving.test.ts` - `invalidates session on fingerprint mismatch` |
| **Owner** | TBD |
| **Implementation** | Verify fingerprint on every authenticated request |

---

## Medium Risks (Score 3-4)

### STRIDE-TB1-S01: Cross-Origin IndexedDB Access
| Field | Value |
|-------|-------|
| **Risk Score** | 3 (Medium) |
| **Current Status** | 🟢 Mitigated by Browser |
| **Mitigation** | Same-origin policy (browser-enforced) |
| **Proving Test** | `securityProving.test.ts` - `IndexedDB isolated by origin` |
| **Notes** | Browser provides isolation, verify we don't bypass it |

---

### STRIDE-TB1-I01: Unencrypted Sensitive Data at Rest
| Field | Value |
|-------|-------|
| **Risk Score** | 3 (Medium) |
| **Current Status** | 🟡 Partial |
| **Mitigation Required** | AES-256-GCM encryption for all PII |
| **Proving Test** | `securityProving.test.ts` - `all PII fields encrypted at rest` |
| **Owner** | TBD |

---

### STRIDE-TB2-S01: Fake Sync Relay Server
| Field | Value |
|-------|-------|
| **Risk Score** | 3 (Medium) |
| **Current Status** | 🟢 Mitigated by TLS |
| **Mitigation** | TLS certificate validation |
| **Proving Test** | `securityProving.test.ts` - `rejects invalid TLS certificates` |

---

### STRIDE-TB2-T01: Modified Sync Messages in Transit
| Field | Value |
|-------|-------|
| **Risk Score** | 3 (Medium) |
| **Current Status** | 🟢 Mitigated by TLS + Encryption |
| **Mitigation** | TLS + payload encryption |
| **Proving Test** | `securityProving.test.ts` - `detects tampered sync messages` |

---

### STRIDE-TB2-T02: Replay Attacks
| Field | Value |
|-------|-------|
| **Risk Score** | 4 (Medium) |
| **Current Status** | 🟡 Partial (CRDT versioning exists) |
| **Mitigation Required** | Version vectors prevent replay |
| **Proving Test** | `securityProving.test.ts` - `rejects replayed sync operations` |

---

### STRIDE-TB2-I01: Relay Operator Reading User Data
| Field | Value |
|-------|-------|
| **Risk Score** | 3 (Medium) |
| **Current Status** | 🟢 Architecture (Zero-knowledge) |
| **Mitigation** | Client-side encryption before sync |
| **Proving Test** | `securityProving.test.ts` - `sync payload is encrypted blob` |

---

### STRIDE-INPUT-02: CSV Injection
| Field | Value |
|-------|-------|
| **Risk Score** | 4 (Medium) |
| **Current Status** | 🟢 VERIFIED |
| **Mitigation Applied** | Bank import sanitization removes control chars, validates content |
| **Proving Test** | `phase2Proving.test.ts` - Control Character Removal tests |
| **Owner** | Security Implementation |
| **Verified** | 2026-11-09 - Phase 2.1 implementation |
| **File** | `src/services/import/sanitization.ts` |

---

### STRIDE-INPUT-03: SQL/NoSQL Injection
| Field | Value |
|-------|-------|
| **Risk Score** | 3 (Medium) |
| **Current Status** | 🟢 Mitigated (Parameterized queries via Dexie) |
| **Mitigation** | Dexie uses parameterized queries |
| **Proving Test** | `securityProving.test.ts` - `query params are not interpolated` |

---

## Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| 🟢 | Verified | Mitigation implemented AND proving test passes |
| 🟡 | Partial | Some mitigation exists, needs verification |
| 🔴 | Not Implemented | No mitigation in place |
| ⚪ | Not Applicable | Deferred or not relevant yet |

---

## Remediation Process

### For Each Threat:

1. **Implement Mitigation**
   - Write the security control
   - Follow secure coding guidelines

2. **Write Proving Test**
   - Test MUST attempt the actual attack
   - Test MUST verify the attack is blocked
   - Test SHOULD verify blocking is logged

3. **Verify & Update Status**
   - Run proving test
   - Update status to 🟢 when passing
   - Update risk counts in summary

### Test File Structure

```
src/__tests__/security/
├── securityProving.test.ts      # Actual attack/defense tests
├── attackSurfaceVerification.test.ts  # Documentation verification
├── strideValidation.test.ts     # Threat coverage verification
├── auditTamperResistance.test.ts  # Audit chain integrity
└── permissionMatrix.test.ts     # RBAC exhaustive tests
```

---

## Sprint Planning Recommendations

### Sprint 1: Quick Wins (Verification Only)
- STRIDE-TB4-I01: Scan build for API keys (automated)
- STRIDE-TB1-I02: Verify encryption at rest
- STRIDE-INPUT-01: Verify XSS sanitization

### Sprint 2: Authentication Hardening
- STRIDE-TB2-S02: Token binding verification
- STRIDE-SESSION-02: Fingerprint enforcement
- STRIDE-TB3-E02: Revoked user key rotation

### Sprint 3: Multi-User Security
- STRIDE-TB3-I01: Role-based encryption
- STRIDE-TB3-E01: Sync operation permission validation

### Sprint 4: Data Integrity
- STRIDE-TB1-T01: Tamper detection implementation
- STRIDE-TB1-T02: Extension tampering detection
- STRIDE-TB1-E01: Data-layer permission middleware

### Sprint 5: External Integration
- STRIDE-TB4-S01: Webhook signature validation
- STRIDE-INPUT-02: CSV injection sanitization

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-11-09 | Security Implementation | Initial tracker |

---

*This is a living document. Update status as remediations are completed.*
