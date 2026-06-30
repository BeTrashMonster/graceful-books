# Audacious Money - Authentication & Encryption

> Complete guide to the two-key authentication system and zero-knowledge encryption

## The Two-Key System

Audacious Money uses **TWO separate authentication mechanisms**:

1. **Account Password** - Grants access to the platform
2. **Master Passphrase** - Decrypts user's financial data

This separation is the foundation of zero-knowledge architecture.

---

## Key Concepts

### Account Password

**Purpose:** Log into app.audacious.money

**Storage:**
- Hashed with Argon2id on server (PostgreSQL)
- JWT token issued on successful login
- Token valid for 7 days

**Can Be Reset:** Yes, via email reset link

**Grants Access To:**
- User account
- Subscription management
- Product purchases
- Settings

**Does NOT Grant Access To:**
- Encrypted financial data
- Transaction details
- Budget information
- Any zero-knowledge data

---

### Master Passphrase

**Purpose:** Decrypt user's financial data

**Storage:**
- NEVER sent to server
- NEVER stored in plaintext ANYWHERE
- Exists only in user's memory (and encrypted in recovery codes)

**Can Be Reset:** Only via recovery codes (if user has them)

**Grants Access To:**
- All encrypted financial data
- Transactions, budgets, forecasts
- CPG calculations
- Any user-entered financial information

**Technical Flow:**
```
User creates passphrase
     ↓
Argon2id derives 256-bit master key
     ↓
Master key encrypts/decrypts all financial data
     ↓
Master key itself encrypted with:
  - Account password (for quick access)
  - 5 recovery codes (for recovery)
```

---

## Complete Signup Flow

### Step 1: Account Creation

**Frontend:** `app.audacious.money/signup?product=cpg`

**User Actions:**
1. Enters email, password, name
2. Optionally enters affiliate code
3. Clicks "Create Account"

**API Call:**
```
POST /auth/signup
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "affiliateCode": "PARTNER123"
}
```

**Backend Process:**
1. Validate email format
2. Check if email already exists
3. Hash password with Argon2id
4. Generate unique Support Key (e.g., "AM-7K3M-9PQR")
5. Create user record in database
6. Track affiliate if code provided
7. Send verification email
8. Generate JWT token
9. Return user object + token

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "supportKey": "AM-7K3M-9PQR"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Frontend Action:**
- Store JWT token in memory/localStorage
- Redirect to charity selection

---

### Step 2: Charity Selection

**Frontend:** `app.audacious.money/onboarding/charity`

**User Actions:**
1. Views list of 5 curated charities
2. Reads short descriptions
3. Selects one charity
4. Clicks "Continue"

**API Call:**
```
PUT /users/me/charity
{
  "charityId": "uuid"
}
```

**Backend Process:**
1. Validate charity exists and is active
2. Create `user_charity_selections` record
3. Set `effective_from` to now

**Frontend Action:**
- Redirect to payment

---

### Step 3: Payment

**Frontend:** `app.audacious.money/onboarding/payment`

**User Actions:**
1. Sees selected product (e.g., CPG - $30/mo)
2. Sees option: "Upgrade to Bookkeeping Suite ($40/mo)?"
3. Clicks "Continue to Payment"

**API Call:**
```
POST /users/me/products
{
  "productSlug": "cpg",
  "upgradeToBookkeeping": false
}
```

**Backend Process:**
1. Get product details
2. Create Stripe Checkout session
3. Include metadata: userId, productId, trialEndDate
4. Return Stripe Checkout URL

**Response:**
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_..."
}
```

**Frontend Action:**
- Redirect to Stripe Checkout
- User completes payment
- Stripe redirects back to app with success/cancel

**Stripe Webhook:**
```
Event: checkout.session.completed
→ POST /stripe/webhook
```

**Backend Webhook Handler:**
1. Verify Stripe signature
2. Extract metadata (userId, productId)
3. Create `user_products` record with status='trial'
4. Set `trial_ends_at` to now + 14 days
5. Send email: "Welcome! Your 14-day trial has started"

---

### Step 4: Master Passphrase Creation

**Frontend:** `app.audacious.money/onboarding/security`

**CRITICAL:** This happens AFTER payment, so user is committed.

**UI Flow:**

```
┌────────────────────────────────────────────────────────┐
│  Protect Your Financial Data                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Your financial data is encrypted with zero-knowledge │
│  security. This means only YOU can decrypt it.        │
│                                                        │
│  Create a Master Passphrase (different from your      │
│  account password) to encrypt your data:              │
│                                                        │
│  [_______________________________] <-- passphrase      │
│  [_______________________________] <-- confirm         │
│                                                        │
│  ✓ At least 12 characters                             │
│  ✓ Mix of letters, numbers, symbols                   │
│  ✓ Something memorable (you'll need this to log in)   │
│                                                        │
│  ⚠️  IMPORTANT: If you forget this passphrase AND     │
│      lose your recovery codes, your data is gone.     │
│                                                        │
│  [Continue] ←── Disabled until strong passphrase      │
└────────────────────────────────────────────────────────┘
```

**Client-Side Process:**

```typescript
// 1. User enters passphrase
const passphrase = getUserInput();

// 2. Derive master key using Argon2id
const masterKey = await argon2.hash({
  pass: passphrase,
  salt: crypto.getRandomValues(new Uint8Array(16)),
  time: 3,
  mem: 65536,
  hashLen: 32,
  parallelism: 4,
  type: argon2.ArgonType.Argon2id
});

// 3. Generate 5 recovery codes
const recoveryCodes = [];
for (let i = 0; i < 5; i++) {
  recoveryCodes.push(generateRecoveryCode()); // e.g., "RCVR-XXXX-XXXX-XXXX"
}

// 4. Encrypt master key with each recovery code
const encryptedMasterKeys = await Promise.all(
  recoveryCodes.map(code => encryptWithRecoveryCode(masterKey, code))
);

// 5. Encrypt master key with account password (for quick access)
const encryptedMasterKeyForAccount = await encryptWithAccountPassword(
  masterKey,
  accountPassword
);

// 6. Store encrypted master key in IndexedDB
await db.secureStorage.put({
  id: 'master_key',
  encryptedKey: encryptedMasterKeyForAccount,
  salt: salt,
  createdAt: new Date()
});

// 7. Hash recovery codes for server storage
const hashedRecoveryCodes = await Promise.all(
  recoveryCodes.map(code => argon2.hash(code))
);
```

**API Call:**
```
PUT /users/me
{
  "encryptedMasterKey": "base64_encrypted_master_key",
  "recoveryCodesHash": ["hash1", "hash2", "hash3", "hash4", "hash5"]
}
```

**Backend Process:**
1. Store `encrypted_master_key` (encrypted with account password)
2. Store `recovery_codes_hash` array
3. These hashes allow verification later without knowing the codes

**Frontend Action:**
- Show recovery codes to user
- FORCE download as text file
- Show big warning: "Store these somewhere safe!"

---

### Step 5: Recovery Codes Download

**UI Flow:**

```
┌────────────────────────────────────────────────────────┐
│  Save Your Recovery Codes                              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  If you forget your Master Passphrase, these codes    │
│  are the ONLY way to recover your data.               │
│                                                        │
│  RCVR-A7F2-9K3M-Q8P1                                  │
│  RCVR-B4G8-2N5R-W9X6                                  │
│  RCVR-C1H7-8M4P-Z3Y5                                  │
│  RCVR-D9J3-6L2Q-V7T4                                  │
│  RCVR-E5K1-4N9S-U8R2                                  │
│                                                        │
│  [Download Recovery Codes] <-- Downloads .txt file    │
│                                                        │
│  ☐ I have saved these recovery codes in a safe place  │
│                                                        │
│  [Continue] ←── Disabled until checkbox checked       │
└────────────────────────────────────────────────────────┘
```

**Downloaded File: `audacious-money-recovery-codes.txt`**

```
Audacious Money - Recovery Codes
Email: user@example.com
Generated: 2026-03-20

KEEP THESE CODES SAFE! They are the only way to recover your
data if you forget your Master Passphrase.

RCVR-A7F2-9K3M-Q8P1
RCVR-B4G8-2N5R-W9X6
RCVR-C1H7-8M4P-Z3Y5
RCVR-D9J3-6L2Q-V7T4
RCVR-E5K1-4N9S-U8R2

What are these?
- Recovery codes let you access your data if you forget your passphrase
- Each code can only be used ONCE
- Store them in a safe place (external hard drive, password manager, safe)
- DO NOT share these codes with anyone

Need help? Contact support with your Support Key: AM-7K3M-9PQR
```

---

### Step 6: Product-Specific Onboarding

**For CPG Users ONLY:**

**Frontend:** `app.audacious.money/cpg/worksheet`

**User Actions:**
1. Fills out CPG worksheet (distributor costs, products, margins)
2. Clicks "Submit"

**Client-Side Process:**
1. Encrypt worksheet data with master key
2. Store in IndexedDB
3. Auto-populate CPG software interface
4. Sync encrypted data to sync relay

**For All Other Products:**
- Skip worksheet
- Redirect directly to product interface

**Final Redirect:**
```
app.audacious.money/dashboard  (if Bookkeeping Suite)
app.audacious.money/cpg        (if CPG standalone)
app.audacious.money/budgeting  (if Budgeting tool)
etc.
```

---

## Login Flow

### Standard Login

**Frontend:** `app.audacious.money/login`

**User Actions:**
1. Enters email + account password
2. Clicks "Log In"

**API Call:**
```
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Backend Process:**
1. Look up user by email
2. Verify password hash (Argon2id)
3. Check account status (not suspended)
4. Update `last_login_at`
5. Generate JWT token (7-day expiry)

**Response:**
```json
{
  "user": { /* user object */ },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Frontend Process:**
1. Store JWT token
2. Redirect to dashboard
3. **NOW prompt for Master Passphrase**

---

### Master Passphrase Entry (Post-Login)

**UI Flow:**

```
┌────────────────────────────────────────────────────────┐
│  Enter Your Master Passphrase                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  To decrypt your financial data, please enter your    │
│  Master Passphrase:                                    │
│                                                        │
│  [_______________________________]                     │
│                                                        │
│  [Unlock My Data]                                      │
│                                                        │
│  Forgot your passphrase? Use a recovery code          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Client-Side Process:**

```typescript
// 1. User enters passphrase
const passphrase = getUserInput();

// 2. Derive master key from passphrase
const derivedKey = await argon2.hash({
  pass: passphrase,
  salt: storedSalt, // Retrieved from IndexedDB
  time: 3,
  mem: 65536,
  hashLen: 32,
  parallelism: 4,
  type: argon2.ArgonType.Argon2id
});

// 3. Try to decrypt a known encrypted value to verify correctness
try {
  const testDecrypt = await decrypt(encryptedTestValue, derivedKey);
  // Success! Master key is correct
  sessionStorage.setItem('masterKey', derivedKey); // Keep in memory for session
} catch (error) {
  // Decryption failed = wrong passphrase
  showError("Incorrect passphrase. Please try again.");
}
```

**NO API CALL** - This happens entirely client-side

---

## Password Reset Flows

### Account Password Reset

**Frontend:** `app.audacious.money/forgot-password`

**User Actions:**
1. Enters email
2. Clicks "Send Reset Link"

**API Call:**
```
POST /auth/forgot-password
{
  "email": "user@example.com"
}
```

**Backend Process:**
1. Look up user by email
2. Generate secure reset token (64 chars, random)
3. Store in `password_reset_tokens` table with 1-hour expiry
4. Send email with reset link
5. **Always return success** (to prevent email enumeration)

**Email Content:**
```
Subject: Reset Your Audacious Money Password

Someone requested a password reset for your account.

Click here to reset your password:
https://app.audacious.money/reset-password?token=XXXX

This link expires in 1 hour.

If you didn't request this, ignore this email.
```

**Reset Page:** `app.audacious.money/reset-password?token=XXXX`

**User Actions:**
1. Enters new password
2. Confirms new password
3. Clicks "Reset Password"

**API Call:**
```
POST /auth/reset-password
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

**Backend Process:**
1. Look up token in `password_reset_tokens`
2. Check expiry (< 1 hour old)
3. Check not already used
4. Hash new password
5. Update user's `password_hash`
6. Mark token as used
7. **Re-encrypt master key with new password** (retrieve master key, re-encrypt)
8. Invalidate all existing JWT tokens

---

### Master Passphrase Recovery

**Frontend:** `app.audacious.money/login` → "Forgot passphrase?"

**UI Flow:**

```
┌────────────────────────────────────────────────────────┐
│  Recover Your Master Passphrase                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Enter one of your 5 recovery codes:                  │
│                                                        │
│  [____]-[____]-[____]-[____]                          │
│                                                        │
│  [Recover]                                             │
│                                                        │
│  ⚠️  Each recovery code can only be used ONCE          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**Client-Side Process:**

```typescript
// 1. User enters recovery code
const recoveryCode = getUserInput();

// 2. Hash recovery code
const hashedCode = await argon2.hash(recoveryCode);

// 3. Check if hash matches one of stored hashes (from backend)
const matchingHash = await checkRecoveryCodeHash(hashedCode);

if (!matchingHash) {
  showError("Invalid recovery code");
  return;
}

// 4. Use recovery code to decrypt master key
const masterKey = await decryptWithRecoveryCode(
  encryptedMasterKeyFromServer,
  recoveryCode
);

// 5. Prompt user to create NEW master passphrase
showCreateNewPassphraseForm();

// 6. Encrypt master key with new passphrase
const newPassphrase = getUserInput();
const newEncryptedMasterKey = await encryptWithPassphrase(masterKey, newPassphrase);

// 7. Mark recovery code as used (API call)
await markRecoveryCodeUsed(hashedCode);

// 8. Update encrypted master key on backend
await updateEncryptedMasterKey(newEncryptedMasterKey);
```

**API Calls:**

```
POST /users/me/recovery-code/verify
{
  "recoveryCodeHash": "hashed_code"
}

Response:
{
  "valid": true,
  "encryptedMasterKey": "base64_encrypted_key"
}
```

```
POST /users/me/recovery-code/use
{
  "recoveryCodeHash": "hashed_code",
  "newEncryptedMasterKey": "base64_new_encrypted_key"
}
```

**Backend Process:**
1. Verify hash matches one of user's recovery codes
2. Mark that specific code as used (delete from array)
3. Store new encrypted master key
4. User now has 4 remaining recovery codes

---

## Security Considerations

### Account Password Requirements
- Minimum 12 characters
- Must include: uppercase, lowercase, number, special char
- Not in common password list (check against haveibeenpwned)
- Not same as email
- Hashed with Argon2id (time=3, mem=65536, parallelism=4)

### Master Passphrase Requirements
- Minimum 16 characters (longer than account password)
- Must include: uppercase, lowercase, number, special char
- Cannot be same as account password
- NOT sent to server (client-side only)

### JWT Token Security
- Signed with HS256 algorithm
- 7-day expiry for user tokens
- 24-hour expiry for admin tokens
- Stored in httpOnly cookie OR localStorage (user preference)
- Refreshed on activity

### Recovery Code Security
- 20 characters: RCVR-XXXX-XXXX-XXXX-XXXX
- Generated with crypto.getRandomValues (cryptographically secure)
- Each code can only be used once
- Hashed on server (like passwords)
- User responsible for storing securely

---

## Session Management

### Active Session Tracking

**Client-Side:**
```typescript
// On login
sessionStorage.setItem('jwt', token);
sessionStorage.setItem('masterKey', derivedMasterKey);

// On logout or session end
sessionStorage.clear();
```

**Server-Side:**
- JWT tokens are stateless
- No session table needed
- Token invalidation via blacklist (for emergency revocation)

### Multi-Device Sync

**Scenario:** User logs in on laptop, then logs in on phone

**Flow:**
1. Laptop: Has JWT token + master key in session
2. Phone: User logs in, gets NEW JWT token
3. Phone: User enters master passphrase, derives master key
4. Both devices: Connect to sync relay with their JWT
5. Sync relay: Identifies both devices as same user (by JWT user_id)
6. Encrypted data syncs between devices

**Important:** Master key derivation happens independently on each device.

---

## Email Verification

### Verification Email

**Sent On:**
- Account creation
- Email change

**Email Content:**
```
Subject: Verify Your Audacious Money Email

Welcome to Audacious Money!

Click here to verify your email address:
https://app.audacious.money/verify-email?token=XXXX

This link expires in 7 days.
```

**Verification Page:** `app.audacious.money/verify-email?token=XXXX`

**API Call:**
```
POST /auth/verify-email
{
  "token": "verification_token"
}
```

**Backend Process:**
1. Look up token in `email_verification_tokens`
2. Check not expired (< 7 days)
3. Mark user's `email_verified = true`
4. Mark token as used
5. Delete token from table

---

## Support Access Grants

### Temporary Data Access for Support

**Use Case:** User needs help troubleshooting, wants support to see their books.

**Flow:**

1. **User grants access** in app settings:
```
POST /support/grant-session
{
  "accessType": "books_access",
  "notes": "Help me understand CPG distributor costs"
}
```

2. **Backend process:**
   - Generate unique session token (e.g., "SUP-XXXX-XXXX-XXXX-XXXX")
   - Encrypt master key with support's public key
   - Store in `support_sessions` table with 24-hour expiry

3. **User provides token to support:**
   - Via email, chat, phone
   - Token: "SUP-A7F2-9K3M-Q8P1-Z3Y5"

4. **Support accesses via admin dashboard:**
```
POST /admin/support/access
{
  "sessionToken": "SUP-A7F2-9K3M-Q8P1-Z3Y5"
}

Response:
{
  "userId": "uuid",
  "userEmail": "user@example.com",
  "decryptionKey": "encrypted_master_key",
  "expiresAt": "2026-03-21T10:00:00Z"
}
```

5. **Support can now decrypt user's data** (read-only)

6. **User can revoke anytime:**
```
POST /support/sessions/:id/revoke
```

---

## Next Steps

See:
- **ROADMAPS_STRIPE.md** for payment integration
- **ROADMAPS_ADMIN_DASHBOARD.md** for admin interface
- **ROADMAPS_DEPLOYMENT.md** for setting up infrastructure

---

**Last Updated:** 2026-03-20
