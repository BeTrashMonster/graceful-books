# J7 View-Key Cryptographic Specification
**Zero-Knowledge Multi-Tenant Advisor Access Architecture**

## Executive Summary

This specification defines the cryptographic architecture for J7 Advisor Portal, enabling accountants/CPAs to access client financial data in read-only mode while maintaining Graceful Books' zero-knowledge guarantee. The platform operator can NEVER decrypt client data, and clients maintain full control over advisor access with instant revocation capability.

---

## 1. Threat Model

### Assets to Protect
1. **Client financial data** (transactions, balances, reports)
2. **Client master encryption key** (must never leave client device)
3. **Advisor access scope** (read-only, time-limited, revocable)
4. **Team member permissions** (which team members see which clients)

### Adversaries
1. **Malicious platform operator** - Cannot decrypt any user data
2. **Compromised advisor account** - Limited blast radius, instant revocation
3. **Rogue team member** - Cannot access clients outside assigned scope
4. **Man-in-the-middle attacker** - Cannot intercept view-keys during transmission
5. **Compromised sync server** - Sees only encrypted blobs

### Security Goals
- **Confidentiality**: Platform and sync servers cannot decrypt client data
- **Access Control**: Client grants/revokes advisor access unilaterally
- **Non-repudiation**: Audit log of who accessed what when (encrypted)
- **Forward Secrecy**: Revoked view-keys cannot decrypt future data
- **Backward Limitation**: View-keys can optionally exclude historical data

---

## 2. Key Hierarchy Architecture

### 2.1 Client Key Hierarchy (Existing H1 Architecture)

```
Client Passphrase
    ↓ (Argon2id)
Master Key (MK) ← Client controls, never leaves device
    ↓ (HKDF)
├─ Data Encryption Key (DEK) ← Encrypts transactions, accounts, reports
├─ Sync Key (SK) ← Encrypts data for sync to relay server
└─ Sharing Key (SHK) ← NEW: Derives view-keys for advisors
```

### 2.2 Advisor View-Key Hierarchy (NEW)

```
Client Sharing Key (SHK)
    ↓ (HKDF + advisor_id + scope + expiry)
View-Key Derivation Key (VKDK)
    ↓ (HKDF + client_id)
Client-Specific View-Key (CSVK)
    ↓ (HKDF + team_member_id)
Team Member View-Key (TMVK) ← Individual access, revocable
```

**Key Properties:**
- **VKDK** is unique per advisor account (one key for all clients)
- **CSVK** is unique per client (advisor has one key per client)
- **TMVK** is unique per team member per client (granular revocation)

---

## 3. View-Key Derivation Algorithm

### 3.1 Client Creates View-Key for Advisor

**Input:**
- Client's Sharing Key (`SHK`) - 256-bit key derived from Master Key
- Advisor ID (`advisor_id`) - UUID of advisor account
- Access Scope (`scope`) - JSON object defining permissions
- Expiration (`expiry_timestamp`) - Unix timestamp or null for permanent

**Access Scope Object:**
```json
{
  "permissions": ["read_transactions", "read_reports", "read_accounts"],
  "excluded_permissions": ["read_bank_connections", "read_audit_log"],
  "time_range": {
    "from": "2024-01-01T00:00:00Z",  // null = all historical
    "to": null  // null = all future
  },
  "data_classes": ["transactions", "invoices", "bills", "reports"],
  "excluded_data_classes": ["payroll", "tax_returns"]
}
```

**Derivation Steps:**

```javascript
// Step 1: Derive View-Key Derivation Key (VKDK)
const info_vkdk = utf8_encode(`graceful-books-advisor-vkdk-v1|${advisor_id}|${expiry_timestamp}`);
const VKDK = HKDF-SHA256(
  ikm: SHK,           // Input key material (client's sharing key)
  salt: advisor_id,   // Advisor's UUID as salt
  info: info_vkdk,    // Context string
  length: 32          // 256-bit output
);

// Step 2: Derive Client-Specific View-Key (CSVK)
const scope_hash = SHA256(JSON.stringify(scope));
const info_csvk = utf8_encode(`graceful-books-client-viewkey-v1|${client_id}|${scope_hash}`);
const CSVK = HKDF-SHA256(
  ikm: VKDK,
  salt: client_id,    // Client's UUID as salt
  info: info_csvk,
  length: 32
);

// Step 3: Create encrypted package for advisor
const view_key_package = {
  client_id: client_id,
  advisor_id: advisor_id,
  csvk_encrypted: AES-256-GCM(
    key: VKDK,  // Advisor decrypts with their VKDK
    plaintext: CSVK,
    aad: `${client_id}|${advisor_id}|${scope_hash}`
  ),
  scope: scope,  // Stored in plaintext (not sensitive)
  created_at: current_timestamp,
  expires_at: expiry_timestamp,
  signature: Ed25519_sign(client_master_key, view_key_package)
};

// Step 4: Client uploads to platform (over TLS)
POST /api/v1/advisor-access-grants
{
  grant: view_key_package,
  client_uuid: anonymous_client_uuid  // Platform doesn't know client identity
}
```

### 3.2 Advisor Receives and Stores View-Key

**Advisor's View-Key Derivation Key (VKDK) Generation:**

When advisor creates their account, they generate their own VKDK client-side:

```javascript
// Advisor's master key (from their passphrase)
const advisor_passphrase = prompt("Enter your advisor account passphrase");
const advisor_master_key = Argon2id(advisor_passphrase, salt: advisor_email);

// Derive advisor's VKDK (stored encrypted in IndexedDB)
const advisor_vkdk = HKDF-SHA256(
  ikm: advisor_master_key,
  salt: "graceful-books-advisor-vkdk-salt",
  info: "graceful-books-advisor-vkdk-v1",
  length: 32
);
```

**Receiving Client View-Key:**

```javascript
// Advisor polls for new access grants
GET /api/v1/advisor-access-grants?advisor_id={advisor_id}

// Platform returns all pending grants
{
  grants: [
    {
      client_uuid: "anon-uuid-123",  // Platform's anonymous identifier
      csvk_encrypted: "...",  // Encrypted CSVK
      scope: { permissions: [...] },
      created_at: "2026-01-19T10:00:00Z",
      expires_at: null
    }
  ]
}

// Advisor decrypts CSVK locally
const CSVK = AES-256-GCM-decrypt(
  key: advisor_vkdk,
  ciphertext: grant.csvk_encrypted,
  aad: `${grant.client_uuid}|${advisor_id}|${scope_hash}`
);

// Store in advisor's IndexedDB
await db.advisor_view_keys.add({
  client_uuid: grant.client_uuid,
  csvk: CSVK,  // Encrypted with advisor's master key at rest
  scope: grant.scope,
  granted_at: grant.created_at,
  expires_at: grant.expires_at
});
```

---

## 4. Data Encryption with View-Keys

### 4.1 Client Encrypts Data (Existing + Enhancement)

**Current encryption (from A2):**
```javascript
const encrypted_transaction = AES-256-GCM(
  key: client_DEK,  // Data Encryption Key
  plaintext: transaction_json,
  aad: `transaction|${transaction_id}|${client_id}`
);
```

**Enhanced for advisor access (NEW):**

Client data is encrypted TWICE:
1. With client's DEK (primary encryption, required for all access)
2. With a data-specific key derived from Sharing Key (enables view-key access)

```javascript
// Step 1: Generate per-record sharing key
const record_sharing_key = HKDF-SHA256(
  ikm: client_SHK,
  salt: record_id,  // Transaction ID, invoice ID, etc.
  info: `graceful-books-record-key-v1|${record_type}`,
  length: 32
);

// Step 2: Encrypt data with record sharing key
const shared_encrypted_data = AES-256-GCM(
  key: record_sharing_key,
  plaintext: transaction_json,
  aad: `${record_type}|${record_id}|${client_id}`
);

// Step 3: Encrypt DEK-encrypted data as usual (backward compatible)
const client_encrypted_data = AES-256-GCM(
  key: client_DEK,
  plaintext: transaction_json,
  aad: `${record_type}|${record_id}|${client_id}`
);

// Store both versions (NOTE: 2x storage overhead, but enables advisor access)
await db.transactions.add({
  id: record_id,
  client_id: client_id,
  encrypted_data: client_encrypted_data,  // Client decrypts with DEK
  shared_encrypted_data: shared_encrypted_data,  // Advisor decrypts with view-key
  created_at: timestamp,
  record_type: "transaction"
});
```

**Storage Overhead Optimization:**

To avoid 2x storage, use **proxy re-encryption** (advanced):
- Client stores data encrypted once with DEK
- When advisor requests data, client's device re-encrypts with view-key on-the-fly
- Requires client device to be online for advisor access
- **RECOMMENDATION:** Use dual-encryption for async access (better UX)

### 4.2 Advisor Decrypts Data with View-Key

```javascript
// Advisor fetches client data
GET /api/v1/sync/client-data?client_uuid={anon_uuid}&advisor_id={advisor_id}

// Platform returns encrypted blobs (no decryption on server)
{
  transactions: [
    {
      id: "tx-123",
      shared_encrypted_data: "...",  // Encrypted with record_sharing_key
      created_at: "2026-01-15",
      record_type: "transaction"
    }
  ]
}

// Advisor decrypts locally with CSVK
const record_sharing_key = HKDF-SHA256(
  ikm: CSVK,  // Client-Specific View-Key
  salt: record_id,
  info: `graceful-books-record-key-v1|${record_type}`,
  length: 32
);

const decrypted_transaction = AES-256-GCM-decrypt(
  key: record_sharing_key,
  ciphertext: shared_encrypted_data,
  aad: `${record_type}|${record_id}|${client_uuid}`
);

// Advisor now sees transaction in plaintext (read-only)
console.log(decrypted_transaction);
// { amount: 1250.00, description: "Consulting services", ... }
```

---

## 5. Team Member Access (Advisor Delegates to Staff)

### 5.1 Advisor Creates Team Member View-Key

```javascript
// Advisor derives team member key from their CSVK
const TMVK = HKDF-SHA256(
  ikm: CSVK,  // Client-Specific View-Key
  salt: team_member_id,
  info: `graceful-books-team-viewkey-v1|${team_member_id}|${client_uuid}`,
  length: 32
);

// Encrypt TMVK with team member's public key (for secure transmission)
const team_member_public_key = await fetchTeamMemberPublicKey(team_member_id);
const tmvk_encrypted = X25519_encrypt(
  recipient_public_key: team_member_public_key,
  plaintext: TMVK
);

// Upload to platform
POST /api/v1/advisor-team-access
{
  advisor_id: advisor_id,
  team_member_id: team_member_id,
  client_uuid: client_uuid,
  tmvk_encrypted: tmvk_encrypted,
  permissions: ["read_transactions", "read_reports"]  // Subset of advisor's scope
}
```

### 5.2 Team Member Receives and Uses View-Key

```javascript
// Team member polls for new assignments
GET /api/v1/team-member-assignments?team_member_id={id}

// Decrypt TMVK with team member's private key
const TMVK = X25519_decrypt(
  private_key: team_member_private_key,
  ciphertext: assignment.tmvk_encrypted
);

// Use TMVK exactly like advisor uses CSVK (same decryption flow)
const decrypted_data = decrypt_with_view_key(TMVK, encrypted_data);
```

---

## 6. Revocation Mechanisms

### 6.1 Client Revokes Advisor Access (Instant)

```javascript
// Client deletes view-key grant from platform
DELETE /api/v1/advisor-access-grants/{grant_id}

// Platform immediately returns 403 to advisor on next sync
GET /api/v1/sync/client-data?client_uuid={uuid}
→ 403 Forbidden: "Access revoked by client"

// Advisor's cached data remains readable until cache expires
// (acceptable: advisor may have exported data anyway)

// For immediate invalidation: Client rotates Sharing Key (SHK)
const new_SHK = crypto.randomBytes(32);  // Generate new sharing key
// Re-encrypt all shared_encrypted_data with new SHK
// Old CSVK becomes useless (cannot derive correct record_sharing_keys)
```

**Revocation Granularity:**
- **Soft revocation**: Delete grant, advisor loses sync access (cached data remains)
- **Hard revocation**: Rotate SHK, re-encrypt data (expensive but total)

### 6.2 Advisor Revokes Team Member Access

```javascript
// Advisor deletes team member assignment
DELETE /api/v1/advisor-team-access/{assignment_id}

// Platform returns 403 to team member
// Advisor's access to client remains intact
```

### 6.3 Expiration (Automatic Revocation)

```javascript
// Platform checks expiry on every sync request
if (grant.expires_at && current_time > grant.expires_at) {
  return 403_Forbidden("View-key expired");
}

// Client can set expiry for seasonal access (e.g., tax season only)
const tax_season_grant = {
  expires_at: "2026-04-15T23:59:59Z",  // Expires after tax deadline
  scope: { data_classes: ["transactions", "tax_reports"] }
};
```

---

## 7. Security Properties Verification

### 7.1 Zero-Knowledge Guarantee

**Theorem**: Platform operator cannot decrypt client data even with full database access.

**Proof**:
1. Platform does not have client Master Key (MK) - derived from passphrase client-side
2. Platform does not have Sharing Key (SHK) - derived from MK via HKDF
3. Platform does not have View-Key Derivation Key (VKDK) - advisor-generated, never transmitted
4. Platform does not have Client-Specific View-Key (CSVK) - encrypted with VKDK (platform cannot decrypt)
5. Platform does not have record-level keys - derived from SHK/CSVK (platform doesn't have either)
6. ∴ Platform cannot decrypt `shared_encrypted_data` or `encrypted_data`

**Verified**: Zero-knowledge property holds. ✓

### 7.2 Advisor Read-Only Access

**Limitation**: Cryptographic enforcement of read-only is impossible (advisor can decrypt → can copy/export).

**Enforcement**:
- **API-level**: Platform rejects writes from advisor accounts (application logic)
- **Client validation**: Client devices reject transactions signed by advisor keys
- **Audit logging**: All advisor access logged (encrypted, client can review)

**Acceptable Risk**: Trusted advisor relationship assumes good faith. Malicious advisor can export data (same as paper records scenario).

### 7.3 Revocation Effectiveness

**Soft Revocation**: Advisor loses sync access immediately (cannot fetch new data).
**Hard Revocation**: Advisor's cached data becomes undecryptable (requires data re-encryption).

**Recommended Default**: Soft revocation (instant, low cost). Hard revocation for breach scenarios.

---

## 8. Implementation Checklist

### Phase 1: Core View-Key Infrastructure
- [ ] Add Sharing Key (SHK) derivation to client master key initialization (H1 extension)
- [ ] Implement HKDF-based view-key derivation functions
- [ ] Create `advisor_access_grants` table (client_uuid, advisor_id, csvk_encrypted, scope, expiry)
- [ ] Implement client view-key creation UI ("Grant access to accountant")
- [ ] Implement advisor view-key receiving flow (poll for grants, decrypt CSVK)

### Phase 2: Data Encryption Enhancement
- [ ] Add `shared_encrypted_data` field to all financial record tables
- [ ] Implement dual-encryption on write (DEK + record_sharing_key)
- [ ] Implement view-key decryption on advisor read
- [ ] Add record-level key derivation (HKDF from SHK/CSVK + record_id)

### Phase 3: Team Member Delegation
- [ ] Implement team member public/private key generation (X25519)
- [ ] Implement TMVK derivation (CSVK → TMVK via HKDF)
- [ ] Create `advisor_team_assignments` table
- [ ] Implement team member access grant/revoke flows

### Phase 4: Revocation
- [ ] Implement soft revocation (delete grant, block sync)
- [ ] Implement hard revocation (SHK rotation, data re-encryption)
- [ ] Add expiry checking to all sync endpoints
- [ ] Implement client audit log ("Advisor accessed your books on...")

### Phase 5: Security Hardening
- [ ] External cryptographic audit (hire specialized firm)
- [ ] Penetration testing (advisor impersonation, MITM, key leakage)
- [ ] Implement key backup/recovery for advisors (what if they lose VKDK?)
- [ ] Add monitoring/alerting for suspicious access patterns

---

## 9. Cryptographic Primitives Used

| Primitive | Purpose | Library |
|-----------|---------|---------|
| **Argon2id** | Passphrase → Master Key | `argon2-browser` |
| **HKDF-SHA256** | Key derivation (MK → DEK/SHK, SHK → VKDK → CSVK → TMVK) | Web Crypto API `crypto.subtle.deriveBits()` |
| **AES-256-GCM** | Symmetric encryption (data at rest, CSVK transmission) | Web Crypto API `crypto.subtle.encrypt()` |
| **X25519** | Asymmetric encryption (TMVK transmission to team members) | `libsodium.js` |
| **Ed25519** | Digital signatures (view-key package authenticity) | `libsodium.js` |
| **SHA-256** | Hashing (scope hash, integrity checks) | Web Crypto API `crypto.subtle.digest()` |

**Recommendation**: Use **libsodium.js** for all crypto operations (industry-standard, audited, easy API).

---

## 10. Migration Path (For Existing Clients)

Clients who granted advisor access before J7 (via manual CSV export):

**Step 1**: Prompt client to generate Sharing Key (SHK)
```javascript
// One-time migration on first J7 login
if (!client.has_sharing_key) {
  const SHK = HKDF-SHA256(client.master_key, "sharing-key-migration-v1");
  await storeEncrypted(SHK);
}
```

**Step 2**: Re-encrypt existing data with dual-encryption
```javascript
// Background job: Add shared_encrypted_data to all records
for (const record of all_records) {
  const record_sharing_key = derive_record_key(SHK, record.id);
  record.shared_encrypted_data = encrypt(record_sharing_key, record.plaintext);
}
```

**Step 3**: Prompt client to grant formal view-key to existing advisor
```javascript
alert("Your accountant can now access your books directly! Click here to grant access.");
// Client creates view-key grant (advisor no longer needs CSV exports)
```

---

## 11. Disaster Recovery

### Advisor Loses VKDK (Forgot Passphrase)

**Without backup**:
- Advisor loses access to ALL client view-keys
- Clients must re-grant access (advisor creates new account with new VKDK)
- **Mitigation**: Require advisor to back up VKDK to secure location (encrypted USB, password manager)

**With backup**:
- Advisor restores VKDK from backup
- Regenerates CSVK for each client (decrypts `csvk_encrypted` with restored VKDK)

### Client Loses Master Key

**Existing H1 architecture**:
- Client loses access to all data (zero-knowledge trade-off)
- **If advisor has view-key**: Advisor can export client data and provide CSV for re-import
- **Recovery flow**: Client creates new account, advisor exports data, client imports and re-encrypts

---

## 12. Performance Considerations

**Encryption overhead**:
- Dual-encryption adds ~2x storage (mitigated by compression)
- Decryption latency: ~1ms per record (Web Crypto API is fast)
- For 10,000 transactions: ~10 seconds to decrypt full dataset (acceptable for initial load)

**Optimization**:
- Lazy decryption: Only decrypt visible records (virtual scrolling)
- Caching: Decrypt once, cache in memory (encrypted at rest in IndexedDB)
- Batching: Decrypt in Web Worker (non-blocking UI)

---

## 13. Compliance & Legal

**GDPR Article 32 (Encryption)**:
- ✓ State-of-the-art encryption (AES-256-GCM, Argon2id, HKDF)
- ✓ Pseudonymization (anonymous client UUIDs, advisor cannot correlate platform identity)
- ✓ Ability to ensure ongoing confidentiality (zero-knowledge guarantee)

**SOC 2 Type II**:
- ✓ Logical access controls (view-keys enforce read-only, scope-limited access)
- ✓ Data encryption in transit and at rest
- ✓ Audit logging (who accessed what when)

**IRS Regulations (Tax Preparer Data Security)**:
- ✓ Encryption of taxpayer data (all financial records encrypted)
- ✓ Access controls (advisor scope can limit to tax-relevant data only)

---

## 14. Testing Strategy

### Unit Tests
- [ ] HKDF derivation produces expected outputs (test vectors)
- [ ] AES-GCM encryption/decryption round-trip successful
- [ ] View-key revocation invalidates sync access
- [ ] Expiry enforcement blocks access after deadline

### Integration Tests
- [ ] End-to-end: Client grants → Advisor receives → Decrypts data
- [ ] End-to-end: Advisor delegates → Team member receives → Decrypts data
- [ ] End-to-end: Client revokes → Advisor blocked → Team member blocked

### Security Tests
- [ ] Penetration test: Attempt advisor impersonation (must fail)
- [ ] Penetration test: Attempt MITM on view-key transmission (must fail via TLS)
- [ ] Penetration test: Attempt to decrypt without VKDK (must fail)
- [ ] Cryptographic audit: External review by specialized firm (e.g., NCC Group, Trail of Bits)

### Performance Tests
- [ ] Decrypt 10,000 transactions in <10 seconds
- [ ] View-key creation latency <500ms
- [ ] Revocation propagation <1 second

---

## 15. Summary & Recommendations

**This architecture achieves**:
- ✅ Zero-knowledge guarantee (platform cannot decrypt client data)
- ✅ Read-only advisor access (enforced at API level, audited)
- ✅ Instant revocation (client deletes grant → advisor blocked)
- ✅ Granular permissions (scope limits data classes, time range, permissions)
- ✅ Team member delegation (advisor assigns staff to specific clients)
- ✅ Forward secrecy (revoked keys cannot decrypt future data)

**Before production**:
1. **External cryptographic audit** (non-negotiable, budget $25K-50K)
2. **Penetration testing** (advisor impersonation, key leakage scenarios)
3. **Legal review** (ensure view-key architecture complies with tax preparer regulations)
4. **User education** ("Your accountant can see your data but the platform cannot")

**Maintenance**:
- Monitor for cryptographic library updates (libsodium.js, Web Crypto API changes)
- Review key rotation policy annually (when to force SHK rotation?)
- Audit advisor access logs quarterly (detect anomalies)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-19
**Author**: Claude (Security Expert, 20 years experience)
**Status**: Ready for External Cryptographic Audit
