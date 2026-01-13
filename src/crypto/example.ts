/**
 * Example Usage of Graceful Books Encryption Layer
 *
 * This file demonstrates how to use the encryption layer in your application.
 * Copy and adapt these examples to your specific use cases.
 */

import {
  // Passphrase validation
  validatePassphrase,
  validatePassphraseDetailed,
  generatePassphraseSuggestion,

  // Key derivation
  deriveMasterKey,
  verifyPassphrase,

  // Encryption context
  createEncryptionContext,
  clearEncryptionContext,
  getKeyForPermission,

  // Encryption operations
  encryptObject,
  decryptObject,
  serializeEncryptedData,
  deserializeEncryptedData,

  // Key management
  hasPermission,
  rotateKeys,
  checkKeyRotationNeeded,

  // Types
  type EncryptionContext,
} from './index';

/**
 * Example 1: Company Setup Flow
 *
 * When a new company is created, this flow guides the admin through
 * passphrase creation and master key generation.
 */
export async function exampleCompanySetup() {
  console.log('=== Example 1: Company Setup ===\n');

  // Step 1: User enters passphrase
  const userPassphrase = 'correct horse battery staple';

  // Step 2: Validate passphrase strength
  const validation = validatePassphraseDetailed(userPassphrase);
  console.log('Passphrase validation:');
  console.log('  Valid:', validation.isValid);
  console.log('  Entropy:', validation.entropy.toFixed(1), 'bits');
  console.log('  Strength:', validation.strengthFeedback?.description);
  console.log('  Crack time:', validation.crackTime);

  if (!validation.isValid) {
    console.log('\nPassphrase too weak!');
    console.log('Error:', validation.errorMessage);
    console.log('Suggestions:', validation.suggestions);

    // Offer a suggestion
    const suggestion = generatePassphraseSuggestion(5);
    console.log('\nTry this passphrase:', suggestion);
    return null;
  }

  // Step 3: Derive master key from passphrase
  console.log('\nDeriving master key...');
  const masterKeyResult = await deriveMasterKey(userPassphrase);

  if (!masterKeyResult.success || !masterKeyResult.data) {
    console.error('Failed to derive master key:', masterKeyResult.error);
    return null;
  }

  const masterKey = masterKeyResult.data;
  console.log('Master key created:', masterKey.id.substring(0, 16) + '...');

  // Step 4: Create encryption context with all permission keys
  console.log('\nCreating encryption context...');
  const contextResult = await createEncryptionContext(masterKey, 'session-abc123');

  if (!contextResult.success || !contextResult.data) {
    console.error('Failed to create context:', contextResult.error);
    return null;
  }

  const context = contextResult.data;
  console.log('Encryption context created');
  console.log('Available permission levels:', Array.from(context.derivedKeys.keys()));

  return { masterKey, context };
}

/**
 * Example 2: Encrypting and Storing Financial Data
 *
 * Demonstrates how to encrypt financial transactions before storing them.
 */
export async function exampleEncryptFinancialData(context: EncryptionContext) {
  console.log('\n=== Example 2: Encrypt Financial Data ===\n');

  // Financial transaction object
  const transaction = {
    id: 'txn-001',
    date: '2024-01-10',
    amount: 1250.50,
    category: 'Revenue',
    description: 'Client payment for services',
    vendor: 'Acme Corp',
  };

  console.log('Original transaction:', transaction);

  // Encrypt the transaction object
  console.log('\nEncrypting transaction...');
  const encryptResult = await encryptObject(transaction, context.masterKey);

  if (!encryptResult.success || !encryptResult.data) {
    console.error('Encryption failed:', encryptResult.error);
    return null;
  }

  const encrypted = encryptResult.data;
  console.log('Encrypted successfully');
  console.log('  Key ID:', encrypted.keyId.substring(0, 16) + '...');
  console.log('  Algorithm:', encrypted.algorithm);
  console.log('  Ciphertext length:', encrypted.ciphertext.length, 'bytes');

  // Serialize for storage/transmission
  const serialized = serializeEncryptedData(encrypted);
  const json = JSON.stringify(serialized);
  console.log('\nSerialized for storage (JSON):');
  console.log('  Length:', json.length, 'bytes');

  // Simulate storing to database
  console.log('\n[Simulating] Storing to IndexedDB...');
  // await db.transactions.put({ id: transaction.id, data: json });

  // Later: Retrieve and decrypt
  console.log('\n[Simulating] Retrieving from IndexedDB...');
  // const stored = await db.transactions.get(transaction.id);
  const deserialized = deserializeEncryptedData(JSON.parse(json));

  console.log('\nDecrypting transaction...');
  const decryptResult = await decryptObject(deserialized, context.masterKey);

  if (!decryptResult.success || !decryptResult.data) {
    console.error('Decryption failed:', decryptResult.error);
    return null;
  }

  console.log('Decrypted transaction:', decryptResult.data);

  return encrypted;
}

/**
 * Example 3: Permission-Based Access Control
 *
 * Demonstrates how different permission levels control data access.
 */
export async function examplePermissionBasedAccess(context: EncryptionContext) {
  console.log('\n=== Example 3: Permission-Based Access ===\n');

  // Manager creates sensitive financial data
  console.log('Manager encrypting sensitive report...');
  const managerKeyResult = getKeyForPermission(context, 'manager');

  if (!managerKeyResult.success || !managerKeyResult.data) {
    console.error('Failed to get manager key:', managerKeyResult.error);
    return;
  }

  const sensitiveReport = {
    type: 'quarterly-financials',
    revenue: 250000,
    expenses: 180000,
    profit: 70000,
  };

  const encryptResult = await encryptObject(sensitiveReport, managerKeyResult.data);

  if (!encryptResult.success || !encryptResult.data) {
    console.error('Encryption failed:', encryptResult.error);
    return;
  }

  console.log('Report encrypted with manager key');

  // Check permissions
  console.log('\nPermission checks:');
  console.log('  Can consultant access manager data?', hasPermission('consultant', 'manager'));
  console.log('  Can manager access consultant data?', hasPermission('manager', 'consultant'));
  console.log('  Can admin access manager data?', hasPermission('admin', 'manager'));
  console.log('  Can user access manager data?', hasPermission('user', 'manager'));

  // Admin can access the data
  console.log('\nAdmin accessing manager data...');
  const adminKeyResult = getKeyForPermission(context, 'manager');

  if (adminKeyResult.success && adminKeyResult.data) {
    const decryptResult = await decryptObject(encryptResult.data, adminKeyResult.data);

    if (decryptResult.success && decryptResult.data) {
      console.log('Admin successfully accessed:', decryptResult.data);
    }
  }

  // Consultant cannot access (would need the manager key)
  console.log('\nConsultant attempting to access manager data...');
  const consultantKeyResult = getKeyForPermission(context, 'consultant');

  if (consultantKeyResult.success && consultantKeyResult.data) {
    // This will fail because the data was encrypted with manager key
    const decryptResult = await decryptObject(encryptResult.data, consultantKeyResult.data);

    if (!decryptResult.success) {
      console.log('Access denied (expected):', decryptResult.error);
    }
  }
}

/**
 * Example 4: Key Rotation for Security
 *
 * Demonstrates how to rotate keys to revoke access or for scheduled maintenance.
 */
export async function exampleKeyRotation(
  currentContext: EncryptionContext,
  _oldPassphrase: string
) {
  console.log('\n=== Example 4: Key Rotation ===\n');

  // Check if rotation is needed
  const rotationCheck = checkKeyRotationNeeded(currentContext);
  console.log('Rotation check:');
  console.log('  Needs rotation:', rotationCheck.needsRotation);
  console.log('  Urgency:', rotationCheck.urgency);
  if (rotationCheck.reason) {
    console.log('  Reason:', rotationCheck.reason);
  }

  // Simulate a security incident requiring rotation
  console.log('\nSecurity incident detected - rotating keys...');

  // Generate new master key from new passphrase
  const newPassphrase = 'new secure passphrase with better entropy';
  const newMasterKeyResult = await deriveMasterKey(newPassphrase);

  if (!newMasterKeyResult.success || !newMasterKeyResult.data) {
    console.error('Failed to derive new master key:', newMasterKeyResult.error);
    return null;
  }

  const newMasterKey = newMasterKeyResult.data;
  console.log('New master key created:', newMasterKey.id.substring(0, 16) + '...');

  // Perform key rotation
  const rotationRequest = {
    oldMasterKeyId: currentContext.masterKey.id,
    reason: 'security_incident' as const,
    initiatedAt: Date.now(),
  };

  console.log('\nRotating keys...');
  const rotationResult = await rotateKeys(currentContext, newMasterKey, rotationRequest);

  if (!rotationResult.success || !rotationResult.data) {
    console.error('Key rotation failed:', rotationResult.error);
    return null;
  }

  console.log('Key rotation completed!');
  console.log('  Duration:', rotationResult.data.durationMs, 'ms');
  console.log('  New master key:', rotationResult.data.newMasterKeyId.substring(0, 16) + '...');
  console.log('  New derived keys:', rotationResult.data.newDerivedKeyIds.length);

  if (rotationResult.data.durationMs > 60000) {
    console.warn('WARNING: Rotation took longer than 60s target!');
  } else {
    console.log('✓ Rotation completed within 60s requirement');
  }

  // Old context is now cleared (access revoked)
  console.log('\nOld encryption context has been cleared');
  console.log('Previous keys can no longer decrypt data');

  // Create new context
  const newContextResult = await createEncryptionContext(newMasterKey, 'session-new');

  if (!newContextResult.success || !newContextResult.data) {
    console.error('Failed to create new context:', newContextResult.error);
    return null;
  }

  console.log('\nNew encryption context created');

  // Note: In a real application, you would now need to re-encrypt all
  // stored data with the new keys using reencryptData()

  return newContextResult.data;
}

/**
 * Example 5: Session Management
 *
 * Demonstrates proper session lifecycle with encryption context.
 */
export async function exampleSessionManagement() {
  console.log('\n=== Example 5: Session Management ===\n');

  // User logs in
  console.log('User logging in...');
  const passphrase = 'correct horse battery staple';

  // Validate passphrase
  const validation = validatePassphrase(passphrase);
  if (!validation.isValid) {
    console.log('Invalid passphrase:', validation.errorMessage);
    return;
  }

  // Derive master key
  const masterKeyResult = await deriveMasterKey(passphrase);
  if (!masterKeyResult.success || !masterKeyResult.data) {
    console.log('Login failed:', masterKeyResult.error);
    return;
  }

  // Verify against stored key (in real app, you'd load this from storage)
  const isValid = await verifyPassphrase(passphrase, masterKeyResult.data);
  console.log('Passphrase verified:', isValid);

  if (!isValid) {
    console.log('Authentication failed');
    return;
  }

  // Create session context
  const sessionId = `session-${Date.now()}`;
  const contextResult = await createEncryptionContext(masterKeyResult.data, sessionId);

  if (!contextResult.success || !contextResult.data) {
    console.log('Failed to create session:', contextResult.error);
    return;
  }

  const context = contextResult.data;
  console.log('Session created:', sessionId);
  console.log('Session started at:', new Date(context.sessionStartedAt).toISOString());

  // Use the session for operations...
  console.log('\n[User performs encrypted operations during session]');

  // User logs out
  console.log('\nUser logging out...');
  clearEncryptionContext(context);
  console.log('Session cleared - all keys removed from memory');
  console.log('✓ Zero-knowledge security maintained');
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Graceful Books Encryption Layer - Usage Examples    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  try {
    // Example 1: Company setup
    const setup = await exampleCompanySetup();
    if (!setup) return;

    const { context } = setup;

    // Example 2: Encrypt financial data
    await exampleEncryptFinancialData(context);

    // Example 3: Permission-based access
    await examplePermissionBasedAccess(context);

    // Example 4: Key rotation
    const newContext = await exampleKeyRotation(context, 'correct horse battery staple');

    // Example 5: Session management
    await exampleSessionManagement();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║              All Examples Completed ✓                  ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Clean up
    if (newContext) {
      clearEncryptionContext(newContext);
    }
  } catch (error) {
    console.error('\n❌ Example failed:', error);
  }
}

// Uncomment to run examples:
// runAllExamples();
