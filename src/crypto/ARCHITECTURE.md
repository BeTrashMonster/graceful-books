# Encryption Layer Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Passphrase                             │
│                  "correct horse battery staple"                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ passphraseValidation.ts │
                    │  - Validate strength    │
                    │  - Check entropy        │
                    │  - Detect patterns      │
                    └────────┬────────┘
                             │ Valid ✓
                             ▼
                    ┌────────────────┐
                    │ keyDerivation.ts │
                    │  - Argon2id     │
                    │  - 64MB memory  │
                    │  - 3 iterations │
                    └────────┬────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Master Key    │
                    │  (256 bits)    │
                    └────────┬────────┘
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
        ┌────────────────┐      ┌────────────────┐
        │ keyManagement.ts │      │ encryption.ts  │
        │  - HKDF derive  │      │  - AES-256-GCM │
        │  - Hierarchy    │      │  - Encrypt     │
        │  - Rotation     │      │  - Decrypt     │
        └────────┬────────┘      └────────┬────────┘
                 │                       │
                 ▼                       ▼
     ┌───────────────────────┐   ┌──────────────────┐
     │  Derived Keys         │   │  Encrypted Data  │
     │  - Admin              │   │  - Ciphertext    │
     │  - Manager            │   │  - IV (96-bit)   │
     │  - Accountant         │   │  - Tag (128-bit) │
     │  - User               │   └──────────────────┘
     │  - Consultant         │
     └───────────────────────┘
```

## Module Dependency Graph

```
types.ts
   │
   ├──> keyDerivation.ts
   │         │
   │         └──> keyManagement.ts
   │                   │
   ├──> encryption.ts  │
   │         │         │
   │         └─────────┴──> index.ts (barrel exports)
   │
   └──> passphraseValidation.ts
             │
             └──> index.ts
```

## Data Flow: Encryption

```
┌──────────────┐
│ Plaintext    │ "Transaction: $1000"
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Validate     │ Check key is valid, not expired
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Generate IV  │ crypto.getRandomValues(12 bytes)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ AES-256-GCM  │ Web Crypto API
│ Encrypt      │ Input: plaintext + key + IV
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Split Result │ Ciphertext + Auth Tag
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Create       │ {ciphertext, iv, authTag, keyId, ...}
│ Envelope     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Encrypted    │ Ready for storage/transmission
│ Data         │
└──────────────┘
```

## Data Flow: Decryption

```
┌──────────────┐
│ Encrypted    │ From storage/network
│ Data         │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Verify Key   │ Check keyId matches, not expired
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Combine      │ Ciphertext + Auth Tag
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ AES-256-GCM  │ Web Crypto API
│ Decrypt      │ Input: combined + key + IV
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Verify Tag   │ Authenticated decryption
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Plaintext    │ "Transaction: $1000"
└──────────────┘
```

## Key Hierarchy Architecture

```
                          ┌─────────────────────┐
                          │   User Passphrase   │
                          └──────────┬──────────┘
                                     │
                          Argon2id   │
                          (64MB, 3i) │
                                     ▼
                          ┌─────────────────────┐
                          │    Master Key       │
                          │    (256 bits)       │
                          └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            HKDF    │        HKDF    │        HKDF    │
          (admin)   │      (manager) │       (user)   │
                    ▼                ▼                ▼
         ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
         │  Admin Key  │  │Manager Key  │  │  User Key   │
         │ (full perm) │  │(edit perm)  │  │(basic perm) │
         └─────────────┘  └─────────────┘  └─────────────┘
                    │                │                │
                    │                │                │
            HKDF    │                │      HKDF      │
        (accountant)│                │   (consultant) │
                    ▼                │                ▼
         ┌─────────────┐             │     ┌─────────────┐
         │Accountant   │             │     │ Consultant  │
         │    Key      │             │     │    Key      │
         │(view+export)│             │     │ (view-only) │
         └─────────────┘             │     └─────────────┘
                                     │
                                     ▼
                           Encrypt Financial Data
```

## Permission Hierarchy

```
                   ┌──────────────┐
                   │    Admin     │ ← Highest privilege
                   │ (Full access)│
                   └──────┬───────┘
                          │ can access
                          ▼
                   ┌──────────────┐
                   │   Manager    │
                   │(Edit access) │
                   └──────┬───────┘
                          │ can access
                          ▼
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
       ┌──────────────┐        ┌──────────────┐
       │  Accountant  │        │     User     │
       │(View+Export) │        │ (Own data)   │
       └──────────────┘        └──────────────┘
              │                       │
              └───────────┬───────────┘
                          │ can access
                          ▼
                   ┌──────────────┐
                   │  Consultant  │ ← Lowest privilege
                   │ (View-only)  │
                   └──────────────┘
```

## Key Rotation Flow

```
┌─────────────────┐
│ Rotation Needed │ User revoked / Scheduled / Security incident
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ New Passphrase  │ User enters new secure passphrase
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Derive New      │ Argon2id → New Master Key
│ Master Key      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Derive All New  │ HKDF → All permission keys
│ Permission Keys │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Clear Old       │ Revoke access by clearing old keys
│ Context         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create New      │ New EncryptionContext with new keys
│ Context         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Re-encrypt Data │ Decrypt with old key, encrypt with new
│ (Background)    │ Batch processing for performance
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Rotation        │ Duration < 60 seconds ✓
│ Complete        │
└─────────────────┘
```

## Session Lifecycle

```
┌──────────┐
│  Login   │
└────┬─────┘
     │
     ▼
┌──────────────┐
│ Enter        │
│ Passphrase   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Validate     │ passphraseValidation.ts
│ Strength     │
└────┬─────────┘
     │ Valid
     ▼
┌──────────────┐
│ Derive       │ keyDerivation.ts
│ Master Key   │ Argon2id
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Verify       │ Compare with stored key hash
│ Against DB   │
└────┬─────────┘
     │ Match
     ▼
┌──────────────┐
│ Create       │ keyManagement.ts
│ Encryption   │ Derive all permission keys
│ Context      │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Session      │ Keys in memory only
│ Active       │ Encrypt/decrypt operations
└────┬─────────┘
     │
     │ (User performs operations)
     │
     ▼
┌──────────────┐
│  Logout      │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Clear        │ clearEncryptionContext()
│ All Keys     │ Zero out memory
│ from Memory  │
└──────────────┘
```

## Storage Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Application                        │
│  ┌───────────────────────────────────────────────┐  │
│  │         EncryptionContext (Memory)            │  │
│  │  - Master Key                                 │  │
│  │  - Derived Keys (Map)                         │  │
│  │  - Session ID                                 │  │
│  └───────────────────────────────────────────────┘  │
│                      ▲                               │
│                      │ Encrypt/Decrypt               │
│                      ▼                               │
│  ┌───────────────────────────────────────────────┐  │
│  │         IndexedDB (Persistent)                │  │
│  │  ┌─────────────────────────────────────────┐ │  │
│  │  │ Keys Table                              │ │  │
│  │  │ - keyId                                 │ │  │
│  │  │ - encryptedKeyMaterial (base64)        │ │  │
│  │  │ - derivationParams                      │ │  │
│  │  │ - metadata                              │ │  │
│  │  └─────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────┐ │  │
│  │  │ Data Table                              │ │  │
│  │  │ - id                                    │ │  │
│  │  │ - encryptedData (JSON)                  │ │  │
│  │  │   {ciphertext, iv, authTag, keyId}     │ │  │
│  │  └─────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                      │
                      │ Sync (encrypted)
                      ▼
┌─────────────────────────────────────────────────────┐
│              Sync Relay Server                       │
│  ┌───────────────────────────────────────────────┐  │
│  │   Cannot decrypt - "Dumb Pipe"                │  │
│  │   Stores only encrypted blobs                 │  │
│  │   {ciphertext, iv, authTag, keyId}           │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Application Security                           │
│ - Permission checks                                     │
│ - Access control                                        │
│ - Audit logging                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 3: Encryption Layer (This Implementation)         │
│ - AES-256-GCM encryption                                │
│ - Key management                                        │
│ - Zero-knowledge architecture                           │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 2: Transport Security                             │
│ - TLS 1.3                                               │
│ - Certificate validation                                │
│ - HTTPS only                                            │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│ Layer 1: Platform Security                              │
│ - Browser sandboxing                                    │
│ - Same-origin policy                                    │
│ - Content Security Policy                               │
└─────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌──────────────┐
│ Operation    │ encrypt() / decrypt() / deriveKey()
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Try Block    │ Wrap all crypto operations
└──────┬───────┘
       │
       ├─ Success ──┐
       │            ▼
       │     ┌──────────────┐
       │     │ CryptoResult │
       │     │ success: true│
       │     │ data: T      │
       │     └──────────────┘
       │
       └─ Error ────┐
                    ▼
              ┌──────────────┐
              │ Catch Block  │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ Classify     │
              │ Error        │
              └──────┬───────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
  ┌────────┐  ┌──────────┐  ┌──────────┐
  │INVALID_│  │DECRYPTION│  │KEY_      │
  │KEY     │  │_FAILED   │  │EXPIRED   │
  └────────┘  └──────────┘  └──────────┘
       │             │             │
       └─────────────┼─────────────┘
                     ▼
              ┌──────────────┐
              │ CryptoResult │
              │success: false│
              │error: string │
              │errorCode: X  │
              └──────────────┘
```

## Module Responsibilities

```
┌───────────────────────────────────────────────────────────┐
│ types.ts                                                  │
│ - Type definitions                                        │
│ - Interfaces                                              │
│ - No implementation logic                                 │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ passphraseValidation.ts                                   │
│ - Passphrase strength validation                          │
│ - Entropy calculation                                     │
│ - Pattern detection                                       │
│ - User feedback                                           │
│ Dependencies: types.ts                                    │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ keyDerivation.ts                                          │
│ - Argon2id key derivation                                 │
│ - PBKDF2 fallback                                         │
│ - Master key generation                                   │
│ - Memory clearing                                         │
│ Dependencies: types.ts                                    │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ encryption.ts                                             │
│ - AES-256-GCM encrypt/decrypt                             │
│ - Web Crypto API                                          │
│ - Serialization                                           │
│ - Batch operations                                        │
│ Dependencies: types.ts                                    │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ keyManagement.ts                                          │
│ - Hierarchical key derivation (HKDF)                      │
│ - Permission management                                   │
│ - Key rotation                                            │
│ - Session context                                         │
│ Dependencies: types.ts, encryption.ts, keyDerivation.ts   │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│ index.ts                                                  │
│ - Barrel exports                                          │
│ - Public API                                              │
│ - Re-exports from all modules                             │
└───────────────────────────────────────────────────────────┘
```

## Zero-Knowledge Proof Flow

```
User Device                     Sync Server              Database
     │                               │                       │
     │ 1. User enters passphrase     │                       │
     ├──────────────────────────────►│                       │
     │                               │                       │
     │ 2. Derive master key          │                       │
     │    (Argon2id, client-side)    │                       │
     │◄──────────────────────────────┤                       │
     │                               │                       │
     │ 3. Encrypt data               │                       │
     │    (AES-256-GCM, client-side) │                       │
     │◄──────────────────────────────┤                       │
     │                               │                       │
     │ 4. Send encrypted blob        │                       │
     ├──────────────────────────────►│                       │
     │                               │                       │
     │                               │ 5. Store blob         │
     │                               ├──────────────────────►│
     │                               │                       │
     │                               │   (Server has no key) │
     │                               │   (Cannot decrypt)    │
     │                               │                       │
     │ 6. Request data               │                       │
     ├──────────────────────────────►│                       │
     │                               │                       │
     │                               │ 7. Retrieve blob      │
     │                               │◄──────────────────────┤
     │                               │                       │
     │ 8. Return encrypted blob      │                       │
     │◄──────────────────────────────┤                       │
     │                               │                       │
     │ 9. Decrypt on client          │                       │
     │    (Master key from memory)   │                       │
     │◄──────────────────────────────┤                       │
     │                               │                       │
     │ 10. Display plaintext         │                       │
     │◄──────────────────────────────┤                       │

Key Point: Server NEVER has access to:
- User passphrase
- Master key
- Derived keys
- Plaintext data
```

## Compliance Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ARCH-001                              │
│          Zero-Knowledge Encryption                       │
│                                                          │
│  ✓ AES-256-GCM (encryption.ts)                          │
│  ✓ Keys never leave device (keyManagement.ts)           │
│  ✓ Server cannot decrypt (architecture)                 │
│  ✓ Double-layer encryption (TLS + AES)                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    ARCH-002                              │
│        Hierarchical Key Management                       │
│                                                          │
│  ✓ Argon2id derivation (keyDerivation.ts)              │
│  ✓ HKDF hierarchy (keyManagement.ts)                    │
│  ✓ Key rotation < 60s (keyManagement.ts)               │
│  ✓ Access revocation (rotateKeys())                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    TECH-003                              │
│     Passphrase Strength (NIST 800-63B)                  │
│                                                          │
│  ✓ 12+ chars / 4+ words (passphraseValidation.ts)      │
│  ✓ Entropy calculation (calculateEntropy())             │
│  ✓ User feedback (validatePassphrase())                 │
│  ✓ Pattern detection (detectWeakPatterns())             │
└─────────────────────────────────────────────────────────┘
```

---

This architecture provides:
- **Zero-knowledge security**: Server cannot access user data
- **Defense in depth**: Multiple security layers
- **Performance**: < 60s key rotation, ~1ms/KB encryption
- **Compliance**: NIST 800-63B, ARCH-001, ARCH-002, TECH-003
- **Maintainability**: Clear module separation, comprehensive docs
