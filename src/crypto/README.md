# Graceful Books Encryption Layer

Zero-knowledge encryption implementation for Graceful Books financial data protection.

## Overview

This module implements a complete zero-knowledge encryption architecture per specifications ARCH-001 and ARCH-002. All user financial data is encrypted on-device before transmission, ensuring the platform operator cannot access user data under any circumstances.

## Architecture

### Zero-Knowledge Encryption (ARCH-001)

- **Data at Rest**: AES-256-GCM encryption for all sensitive data in IndexedDB
- **Data in Transit**: TLS 1.3 + additional AES-256-GCM payload encryption
- **Server Role**: Sync relay servers act as "dumb pipes" with no decryption capability
- **Key Storage**: Encryption keys never leave user devices in unencrypted form

### Hierarchical Key Management (ARCH-002)

```
Master Key (derived from passphrase via Argon2id)
  ├── Admin Key (full access)
  ├── Manager Key (edit access)
  ├── Accountant Key (view + export)
  ├── User Key (basic access)
  └── Consultant Key (view-only)
```

## Security Specifications

### Encryption Algorithm

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits
- **IV/Nonce**: 96 bits, randomly generated per operation
- **Authentication Tag**: 128 bits

### Key Derivation Function

- **Algorithm**: Argon2id
- **Memory**: 64 MB minimum
- **Iterations**: 3 minimum
- **Parallelism**: 4 threads
- **Output**: 256-bit key

### Passphrase Requirements (NIST 800-63B)

- Minimum 4 words OR 12 characters
- Minimum 50 bits entropy (80+ recommended)
- Not in common weak password list

## Module Structure

```
src/crypto/
├── types.ts                  # TypeScript type definitions
├── encryption.ts             # AES-256-GCM encryption/decryption
├── keyDerivation.ts          # Argon2id key derivation
├── keyManagement.ts          # Hierarchical key management
├── passphraseValidation.ts   # Strength validation
├── index.ts                  # Barrel exports
└── README.md                 # This file
```

## Usage Examples

### 1. Basic Encryption Flow

```typescript
import {
  deriveMasterKey,
  createEncryptionContext,
  encrypt,
  decrypt,
  validatePassphrase,
} from '@/crypto';

// Validate passphrase
const validation = validatePassphrase('correct horse battery staple');
if (!validation.isValid) {
  console.error(validation.errorMessage);
  console.log('Suggestions:', validation.suggestions);
  return;
}

// Derive master key
const masterKeyResult = await deriveMasterKey('correct horse battery staple');
if (!masterKeyResult.success || !masterKeyResult.data) {
  console.error(masterKeyResult.error);
  return;
}
const masterKey = masterKeyResult.data;

// Create session encryption context
const contextResult = await createEncryptionContext(masterKey, 'session-123');
if (!contextResult.success || !contextResult.data) {
  console.error(contextResult.error);
  return;
}
const context = contextResult.data;

// Encrypt financial data
const transaction = { amount: 1000, description: 'Payment' };
const encryptResult = await encryptObject(transaction, context.masterKey);
if (!encryptResult.success || !encryptResult.data) {
  console.error(encryptResult.error);
  return;
}

// Store encrypted data
await saveToDatabase(encryptResult.data);

// Later: Decrypt data
const decryptResult = await decryptObject(encryptResult.data, context.masterKey);
if (decryptResult.success && decryptResult.data) {
  console.log('Transaction:', decryptResult.data);
}

// On logout: Clear sensitive data
clearEncryptionContext(context);
```

### 2. Permission-Based Access

```typescript
import {
  createEncryptionContext,
  getKeyForPermission,
  hasPermission,
  encrypt,
  decrypt,
} from '@/crypto';

// Create context with all permission keys
const context = await createEncryptionContext(masterKey, 'session-123');

// Manager encrypts data
const managerKeyResult = getKeyForPermission(context.data, 'manager');
const encrypted = await encrypt('manager data', managerKeyResult.data);

// Check if consultant can access manager data
if (hasPermission('consultant', 'manager')) {
  // No - consultant has lower permissions
} else {
  console.log('Access denied');
}

// Admin can access all data
if (hasPermission('admin', 'manager')) {
  const adminKeyResult = getKeyForPermission(context.data, 'manager');
  const decrypted = await decrypt(encrypted.data, adminKeyResult.data);
}
```

### 3. Key Rotation

```typescript
import {
  rotateKeys,
  reencryptData,
  deriveMasterKey,
} from '@/crypto';

// User access needs to be revoked
const newPassphrase = 'new secure passphrase here';
const newMasterKeyResult = await deriveMasterKey(newPassphrase);

const rotationRequest = {
  oldMasterKeyId: currentContext.masterKey.id,
  reason: 'user_revocation',
  revokedUserId: 'user-123',
  initiatedAt: Date.now(),
};

// Rotate keys (completes within 60 seconds)
const rotationResult = await rotateKeys(
  currentContext,
  newMasterKeyResult.data,
  rotationRequest
);

if (rotationResult.success) {
  console.log('Rotation completed in', rotationResult.data.durationMs, 'ms');

  // Create new context
  const newContext = await createEncryptionContext(
    newMasterKeyResult.data,
    'new-session'
  );

  // Re-encrypt all data
  const reencrypted = await reencryptData(
    currentContext,
    newContext.data,
    allEncryptedData,
    'manager'
  );

  // Save re-encrypted data
  await saveAllToDatabase(reencrypted.data);
}
```

### 4. Passphrase Validation

```typescript
import {
  validatePassphraseDetailed,
  getStrengthFeedback,
  estimateCrackTime,
  generatePassphraseSuggestion,
} from '@/crypto';

// Detailed validation
const result = validatePassphraseDetailed('mypassword123');

console.log('Valid:', result.isValid);
console.log('Entropy:', result.entropy, 'bits');
console.log('Crack time:', result.crackTime);
console.log('Strength:', result.strengthFeedback.description);
console.log('Weak patterns:', result.weakPatterns);

if (!result.isValid) {
  console.log('Error:', result.errorMessage);
  console.log('Suggestions:', result.suggestions);

  // Generate a strong suggestion
  const suggestion = generatePassphraseSuggestion(5);
  console.log('Try this:', suggestion);
}
```

### 5. Batch Operations

```typescript
import { batchEncrypt, batchDecrypt } from '@/crypto';

// Encrypt multiple transactions at once
const transactions = [
  'transaction 1',
  'transaction 2',
  'transaction 3',
];

const encryptResults = await batchEncrypt(transactions, masterKey);
const allSucceeded = encryptResults.every(r => r.success);

// Later: Decrypt all at once
const encryptedData = encryptResults
  .filter(r => r.success && r.data)
  .map(r => r.data);

const decryptResults = await batchDecrypt(encryptedData, masterKey);
const decrypted = decryptResults
  .filter(r => r.success && r.data)
  .map(r => r.data);
```

## Security Considerations

### Memory Safety

- All sensitive data cleared from memory after use
- Session keys exist only during active sessions
- Master key material never logged or exposed in error messages

### Constant-Time Operations

- Passphrase verification uses constant-time comparison
- Prevents timing attacks on authentication

### Side-Channel Resistance

- No sensitive data in console logs
- Error messages don't leak information about keys
- Memory cleared after cryptographic operations

### Key Expiration

- Default 90-day expiration for all keys
- Automatic warnings before expiration
- Forced rotation on expiration

## Browser Compatibility

### Primary: Web Crypto API

- Native browser support (Chrome 37+, Firefox 34+, Safari 11+)
- Hardware acceleration when available
- FIPS 140-2 validated on some platforms

### Key Derivation: Argon2-browser

- Primary: argon2-browser library (client-side WASM)
- Fallback: PBKDF2 via Web Crypto API (if Argon2 unavailable)

### Storage: IndexedDB

- Encrypted keys stored in IndexedDB
- Automatic quota management
- Transaction support for atomic operations

## Testing

Run the test suite:

```bash
npm test src/crypto
```

Tests cover:
- Encryption/decryption round-trips
- Key derivation determinism
- Passphrase validation edge cases
- Permission hierarchy enforcement
- Key rotation timing
- Memory clearing
- Error handling

## Performance

### Benchmarks (typical modern device)

- Key derivation: ~500ms (Argon2id with spec parameters)
- Encryption: ~1ms per KB
- Decryption: ~1ms per KB
- Key rotation: <10s for 1000 records

### Optimization Tips

1. **Batch Operations**: Use `batchEncrypt`/`batchDecrypt` for multiple items
2. **Caching**: Keep encryption context in memory during session
3. **Progressive Loading**: Decrypt data as needed, not all at once
4. **Web Workers**: Perform crypto operations in background thread

## Dependencies

### Required

- `crypto` (Web Crypto API - browser native)
- `indexeddb` (browser native)

### Optional

- `argon2-browser` - For Argon2id key derivation (recommended)
- `@noble/ciphers` - Alternative to Web Crypto API (future enhancement)

## Compliance

- **NIST 800-63B**: Passphrase requirements
- **FIPS 140-2**: Web Crypto API (on supported platforms)
- **GDPR**: Zero-knowledge architecture ensures data privacy
- **ARCH-001**: Zero-knowledge encryption specification
- **ARCH-002**: Hierarchical key management specification
- **TECH-003**: Passphrase strength requirements

## Future Enhancements

1. **@noble/ciphers Integration**: Add as primary encryption library
2. **Hardware Security Keys**: Support for WebAuthn/FIDO2
3. **Secret Sharing**: Passphrase recovery via Shamir's Secret Sharing
4. **Audit Logging**: Cryptographic operation audit trail
5. **Key Escrow**: Optional enterprise key escrow (with user consent)

## Contributing

When modifying crypto code:

1. **Never weaken security parameters**
2. **Always add tests for new functionality**
3. **Document all security assumptions**
4. **Have changes reviewed by security expert**
5. **Update this README with changes**

## Security Disclosure

If you discover a security vulnerability:

1. **Do NOT open a public issue**
2. Email security@gracefulbooks.com
3. Include detailed reproduction steps
4. Allow 90 days for patching before disclosure

## License

Copyright (c) 2024 Graceful Books. All rights reserved.
