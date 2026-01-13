# Encryption Specification

**Capability:** encryption

## Overview

This capability implements the zero-knowledge encryption architecture that ensures user financial data is encrypted on-device before transmission and storage. The platform operator cannot access user data under any circumstances.

## ADDED Requirements

### Requirement: Zero-Knowledge Encryption Architecture
The system SHALL implement a zero-knowledge encryption architecture where all user financial data is encrypted on-device before transmission, sync relay servers act as "dumb pipes" with no ability to decrypt data, encryption keys never leave user devices in unencrypted form, and the platform operator cannot access user financial data under any circumstances.

**ID:** ARCH-001
**Priority:** Critical

#### Scenario: Encrypt Data Before Transmission

**GIVEN** a user creates or modifies financial data
**WHEN** the data needs to be synced to the relay server
**THEN** the data is encrypted on the user's device using AES-256
**AND** only encrypted ciphertext is transmitted
**AND** the encryption key never leaves the device

#### Scenario: Server Cannot Decrypt Data

**GIVEN** encrypted data is stored on the sync relay server
**WHEN** an administrator attempts to access the data
**THEN** only encrypted ciphertext is visible
**AND** no decryption is possible without the user's key
**AND** the server has no access to encryption keys

#### Scenario: Data at Rest Uses AES-256

**GIVEN** financial data needs to be stored locally
**WHEN** data is written to IndexedDB
**THEN** AES-256 encryption is used for all sensitive fields
**AND** the encryption key is derived from the user's passphrase

#### Scenario: Data in Transit Uses TLS 1.3 Plus Payload Encryption

**GIVEN** encrypted data is being synced
**WHEN** data is transmitted to the relay server
**THEN** TLS 1.3 or higher is used for transport security
**AND** the payload is additionally encrypted with AES-256
**AND** double-layer encryption protects against MITM attacks

---

### Requirement: Hierarchical Key Management
The system SHALL implement hierarchical key management with master key generation from passphrase, user key derivation for different permission levels, and key rotation capabilities.

**ID:** ARCH-002
**Priority:** Critical

#### Scenario: Generate Master Key from Passphrase

**GIVEN** an admin creates a new company
**WHEN** they provide a strong passphrase
**THEN** a master encryption key is derived using Argon2id
**AND** the key derivation uses appropriate salt and iteration parameters
**AND** the master key is stored encrypted in the local device only

#### Scenario: Derive User Key for Permission Level

**GIVEN** an admin invites a new user with "Manager" permissions
**WHEN** the invitation is created
**THEN** a derived key is generated for the Manager permission level
**AND** the derived key is encrypted with the user's password
**AND** only the encrypted derived key is transmitted

#### Scenario: Rotate Keys to Revoke Access

**GIVEN** a user's access needs to be revoked
**WHEN** an admin rotates the company encryption keys
**THEN** new keys are generated and distributed to active users
**AND** the revoked user's local data becomes unreadable
**AND** key rotation completes within 60 seconds for active sessions
**AND** the action is logged in the audit trail

---

### Requirement: Passphrase Strength Requirements
The system SHALL enforce passphrase strength requirements based on NIST Special Publication 800-63B to ensure sufficient entropy for key derivation.

**ID:** TECH-003 (implied from NIST 800-63B reference)
**Priority:** High

#### Scenario: Accept Strong Passphrase

**GIVEN** a user is creating a new company
**WHEN** they provide a passphrase with 4+ words or 12+ characters
**THEN** the passphrase is accepted
**AND** entropy is calculated and meets minimum requirements

#### Scenario: Reject Weak Passphrase

**GIVEN** a user is creating a new company
**WHEN** they provide a passphrase with insufficient entropy
**THEN** the passphrase is rejected
**AND** a user-friendly error message explains requirements
**AND** suggestions for creating strong passphrases are provided

## Technical Details

### Encryption Algorithm
- **Algorithm:** AES-256-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits
- **IV/Nonce:** 96 bits, randomly generated per encryption operation
- **Authentication Tag:** 128 bits

### Key Derivation Function
- **Algorithm:** Argon2id
- **Parameters:**
  - Memory: 64 MB minimum
  - Iterations: 3 minimum (adjusted based on device performance)
  - Parallelism: 4 threads
  - Output: 256-bit key

### Key Hierarchy
```
Master Key (derived from passphrase)
  ├── Data Encryption Key (for financial data)
  ├── Admin Key (full access)
  ├── Manager Key (edit access)
  ├── User Key (basic access)
  ├── Consultant Key (view-only)
  └── Accountant Key (view + export)
```

### Browser Crypto API
- Uses native Web Crypto API for all cryptographic operations
- No custom crypto implementations
- Hardware acceleration when available

### Key Storage
- Master key encrypted and stored in IndexedDB
- Derived keys never stored in plaintext
- Session keys in memory only, cleared on logout

## Dependencies

- Web Crypto API (browser native)
- Argon2id library (argon2-browser)
- IndexedDB for encrypted key storage

## Security Considerations

### Passphrase Recovery
- Optional passphrase recovery mechanism using secret sharing
- Recovery doesn't compromise zero-knowledge architecture
- User must explicitly opt-in to recovery option

### Side-Channel Attacks
- Constant-time operations for sensitive comparisons
- Memory cleared after cryptographic operations
- No sensitive data in console logs or error messages

### Key Rotation
- Scheduled key rotation recommendations
- Emergency rotation for security incidents
- Minimal downtime during rotation

## Testing

- Unit tests for encryption/decryption operations
- Security audit by third-party firm
- Penetration testing of key management
- Crypto library version monitoring for vulnerabilities
- Side-channel attack resistance testing
