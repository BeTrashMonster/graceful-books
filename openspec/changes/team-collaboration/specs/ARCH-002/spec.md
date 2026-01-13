# Multi-User Key Management - Capability Specification

**Capability ID:** `multi-user`, `key-rotation`
**Related Roadmap Items:** H1, H2
**SPEC Reference:** ARCH-002
**Status:** Planned (Phase 4)

## Overview

Multi-user key management enables team collaboration through hierarchical key derivation, role-based access control, and instant access revocation via key rotation. This implements zero-knowledge security for teams where each user receives permission-appropriate encryption keys without compromising data sovereignty.

## ADDED Requirements


### Functional Requirements

#### FR-1: Hierarchical Key Derivation
**Priority:** Critical

**ADDED Requirements:**

The system SHALL implement hierarchical key management:

**Master Key Generation:**
- Admin creates company and generates master encryption key
- Master key derived from strong passphrase using Argon2id
- Key never transmitted in plain text
- Only encrypted derivatives shared with users

**User Key Derivation:**
- Each invited user receives a derived key for their permission level
- Derived key encrypted with user's password before transmission
- Permission levels: Admin, Manager, User, Consultant (view-only), Accountant (2 slots)
- Keys provide access appropriate to role

**Key Slots:**
- 6 total user slots per company
- 1 Admin (required)
- 2 flexible Manager/User slots
- 1 Consultant (view-only)
- 2 Accountant slots
- Slot management and reallocation

**Acceptance Criteria:**
- [ ] Master key generated using Argon2id
- [ ] User keys derived from master key
- [ ] Keys encrypted with user password
- [ ] No plain-text key transmission
- [ ] Permission-appropriate access enforced

---

#### FR-2: User Invitation System
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support user invitation:

**Invitation Features:**
- Email-based invitation
- Secure invitation token (time-limited, single-use)
- Role assignment on invite
- Pending invitation management
- Resend invitation capability
- Cancel pending invitation

**Invitation Flow:**
- Admin sends invitation with role
- User receives email with secure link
- User creates password and accepts
- System derives user key encrypted with password
- User gains access with appropriate permissions

**Invitation Security:**
- Tokens expire after 7 days
- Single-use tokens (cannot reuse)
- Token invalidation on cancel
- Audit log of all invitations

**Acceptance Criteria:**
- [ ] Invitations send correctly
- [ ] Tokens secure and time-limited
- [ ] Role assignment works
- [ ] Invitation acceptance flow complete
- [ ] Audit trail maintained

---

#### FR-3: Role-Based Access Control
**Priority:** Critical

**ADDED Requirements:**

The system SHALL enforce role-based permissions:

**Role Definitions:**
- **Admin:** Full access, user management, key rotation, billing
- **Manager:** Most operations, limited admin functions (no user removal)
- **Bookkeeper:** Transaction entry, reconciliation, reporting (no settings)
- **View-Only:** Read-only access to reports and data (no edits)
- **Consultant:** Temporary view-only access (time-limited)
- **Accountant:** Full read, limited write (no user management)

**Permission Matrix:**
- Transactions: Admin/Manager/Bookkeeper (create, edit), View-Only/Consultant/Accountant (view)
- Reports: All roles can view
- Settings: Admin only
- User Management: Admin only
- Reconciliation: Admin/Manager/Bookkeeper/Accountant
- Invoices: Admin/Manager/Bookkeeper (create, edit), others (view)

**Permission Enforcement:**
- Client-side UI hiding (UX)
- Server-side enforcement (security)
- Encryption key scoping (technical)
- Audit log of permission denials

**Acceptance Criteria:**
- [ ] Roles defined and enforced
- [ ] Permission matrix implemented
- [ ] UI adapts to role
- [ ] Server validates permissions
- [ ] Audit log tracks denials

---

#### FR-4: Key Rotation
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support key rotation:

**Rotation Mechanism:**
- Admin-initiated key rotation
- Generate new master key
- Derive new user keys for all active users
- Distribute to active users automatically
- Complete within 60 seconds
- Zero-downtime rotation

**Rotation Triggers:**
- Manual admin-initiated
- User removal (revoke access)
- Security incident response
- Periodic rotation (optional)

**Active Session Handling:**
- Detect active sessions
- Notify users of key rotation
- Force re-authentication if needed
- Automatic re-key on next sync
- Clear local caches

**Rotation Audit:**
- Log all key rotations
- Timestamp and initiator
- Reason for rotation (optional)
- Affected users list
- Immutable audit log

**Acceptance Criteria:**
- [ ] Rotation completes within 60 seconds
- [ ] Active users receive new keys
- [ ] Zero-downtime rotation
- [ ] Audit trail complete
- [ ] Sessions handled gracefully

---

#### FR-5: Access Revocation
**Priority:** Critical

**ADDED Requirements:**

The system SHALL support instant access revocation:

**Revocation Features:**
- Remove user from key derivation
- Invalidate user sessions immediately
- Render local data unreadable (cryptographically)
- Effect within 10 seconds
- Audit trail of revocation

**Revocation Process:**
- Admin removes user
- System triggers key rotation (excludes removed user)
- User sessions invalidated
- User local data becomes unreadable
- User notified of removal

**Cryptographic Revocation:**
- Removed user's derived key excluded from new rotation
- Old encrypted data re-encrypted with new keys
- Removed user cannot decrypt new key
- Local data becomes unreadable without new key

**Acceptance Criteria:**
- [ ] Revocation effect within 10 seconds
- [ ] Sessions invalidated
- [ ] Local data unreadable
- [ ] Audit trail complete
- [ ] User notified appropriately

---

### Non-Functional Requirements

#### NFR-1: Security
**Priority:** Critical

**ADDED Requirements:**
- Master key never transmitted in plain text
- User keys encrypted with user password
- Argon2id for key derivation (memory-hard, GPU-resistant)
- Zero-knowledge compliance (server cannot decrypt)
- Rotation completes securely without exposing keys
- Audit log immutable and tamper-proof

#### NFR-2: Performance
**Priority:** High

**ADDED Requirements:**
- Key derivation <5 seconds per user
- Key rotation completes within 60 seconds (all users)
- Access revocation effect within 10 seconds
- Supports 6 concurrent users smoothly
- Minimal latency impact on sync

#### NFR-3: Usability
**Priority:** High

**ADDED Requirements:**
- Invitation flow simple (3 steps max)
- Role selection clear with descriptions
- Key rotation progress visible
- User removal confirmation required
- Educational content for security features

---

## Success Metrics
- 40%+ of growing businesses add team members
- 60%+ of teams use role-based permissions
- Zero key rotation failures
- Zero access revocation failures
- <60 seconds key rotation time (99th percentile)
- <10 seconds revocation effect time (99th percentile)
- >4.5 ease-of-use rating for multi-user features
