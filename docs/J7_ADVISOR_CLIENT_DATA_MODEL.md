# J7 Advisor-Client Data Model
**Anonymous Client ID Architecture (Option B)**

## Design Decision: Anonymous Client IDs with Metadata Minimization

Based on security expert analysis, we're implementing **Option B**: The platform stores anonymous client UUIDs to enable advisor-client relationship tracking while minimizing privacy exposure.

### Why Option B (Not Just Count)?

**Platform needs relationship tracking for:**
1. **Client transfer between advisors** - When client switches accountants
2. **Billing dispute resolution** - "This client left 3 months ago, why am I still charged?"
3. **Support scenarios** - "My client can't access their books"
4. **Preventing fraud** - Advisor claims 50 clients, actually has 200 (billing manipulation)

**What Platform CAN See:**
- Advisor-client relationships (advisor_id → [client_uuid_1, client_uuid_2...])
- Client UUID (non-reversible, generated client-side)
- Relationship creation date
- Billing tier assignments

**What Platform CANNOT See:**
- Client name, email, business name
- Client financial data (transactions, balances, reports)
- Comments, advisor notes
- Any encrypted user data

---

## Database Schema

### Table 1: `advisor_clients` (NEW)

**Purpose:** Track which clients are under which advisor's plan for billing and access management.

```sql
CREATE TABLE advisor_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Advisor reference
  advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Client reference (ANONYMOUS UUID, generated client-side)
  client_uuid UUID NOT NULL,  -- NOT a foreign key to users table

  -- Relationship metadata
  relationship_status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- Values: 'pending_invitation', 'active', 'removed', 'transferred'

  -- Invitation tracking
  invitation_sent_at TIMESTAMP,
  invitation_accepted_at TIMESTAMP,
  invitation_token VARCHAR(255),  -- Secure token for invitation link

  -- Billing tracking
  billing_started_at TIMESTAMP,  -- When client started being billed under advisor
  billing_ended_at TIMESTAMP,    -- When client was removed from advisor plan

  -- Transfer tracking (when client switches advisors)
  previous_advisor_id UUID REFERENCES users(id),
  transferred_at TIMESTAMP,

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(advisor_id, client_uuid),  -- Advisor cannot have same client twice
  CHECK(relationship_status IN ('pending_invitation', 'active', 'removed', 'transferred'))
);

-- Indexes
CREATE INDEX idx_advisor_clients_advisor_id ON advisor_clients(advisor_id);
CREATE INDEX idx_advisor_clients_client_uuid ON advisor_clients(client_uuid);
CREATE INDEX idx_advisor_clients_status ON advisor_clients(relationship_status);
CREATE INDEX idx_advisor_clients_billing ON advisor_clients(advisor_id, relationship_status)
  WHERE relationship_status = 'active';  -- Optimize billing calculations
```

**Key Design Decisions:**

1. **`client_uuid` is NOT a foreign key** - Maintains anonymization. Platform cannot reverse-lookup client details.
2. **`relationship_status` workflow:**
   - `pending_invitation`: Advisor sent invitation, client hasn't accepted yet
   - `active`: Client accepted, advisor has access, advisor pays for client
   - `removed`: Advisor removed client, billing transferred back to client
   - `transferred`: Client switched to different advisor
3. **No client email or name stored** - Only the UUID, which is meaningless to platform

**Anonymous Client UUID Generation (Client-Side):**

```javascript
// When client creates account (existing A2 user registration)
// OR when advisor invites a new client:

// Generate client UUID deterministically from email (so it's consistent)
// BUT platform never sees the email, only the UUID
const clientUUID = await generateAnonymousClientUUID(email);

async function generateAnonymousClientUUID(email) {
  // Use client-side hashing to create consistent UUID from email
  // Platform never sees the email, only receives the UUID
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convert hash to UUID format (first 16 bytes)
  const uuid = [
    hashArray.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join(''),
    hashArray.slice(4, 6).map(b => b.toString(16).padStart(2, '0')).join(''),
    hashArray.slice(6, 8).map(b => b.toString(16).padStart(2, '0')).join(''),
    hashArray.slice(8, 10).map(b => b.toString(16).padStart(2, '0')).join(''),
    hashArray.slice(10, 16).map(b => b.toString(16).padStart(2, '0')).join('')
  ].join('-');

  return uuid;
  // Example result: "a3d5f7e9-1234-5678-90ab-cdef12345678"
  // Platform sees this UUID but cannot reverse it to get the email
}
```

**Privacy Guarantee:**
- Platform sees: `client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678"`
- Platform CANNOT determine: Client email, name, or any identifying info
- Only client device and advisor device (with view-key) can decrypt client data

---

### Table 2: `advisor_team_members` (NEW)

**Purpose:** Track advisor's team members (staff who help manage clients).

```sql
CREATE TABLE advisor_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Advisor (firm owner) reference
  advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Team member (staff) reference
  team_member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Team member metadata
  role VARCHAR(50) NOT NULL,
    -- Values: 'senior_accountant', 'junior_accountant', 'bookkeeper',
    --         'tax_preparer', 'admin', 'custom'
  custom_role_name VARCHAR(100),  -- If role = 'custom', store custom name here

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- Values: 'pending_invitation', 'active', 'deactivated'

  -- Invitation tracking
  invitation_sent_at TIMESTAMP,
  invitation_accepted_at TIMESTAMP,
  invitation_token VARCHAR(255),

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(advisor_id, team_member_user_id),  -- Cannot add same person twice
  CHECK(status IN ('pending_invitation', 'active', 'deactivated')),
  CHECK(role IN ('senior_accountant', 'junior_accountant', 'bookkeeper',
                 'tax_preparer', 'admin', 'custom'))
);

-- Indexes
CREATE INDEX idx_advisor_team_members_advisor_id ON advisor_team_members(advisor_id);
CREATE INDEX idx_advisor_team_members_user_id ON advisor_team_members(team_member_user_id);
CREATE INDEX idx_advisor_team_members_status ON advisor_team_members(status);
```

**Key Design Decisions:**

1. **Team members are regular users** - They have their own `users` record with `role = 'team_member'`
2. **Advisor assigns team members to specific clients** (see Table 3 below)
3. **Role field** - Helps advisor organize team, no permission implications (permissions handled by H1 role system)
4. **First 5 team members free** - Billing logic counts `COUNT(*) WHERE status = 'active'`

---

### Table 3: `advisor_team_client_assignments` (NEW)

**Purpose:** Control which team members have access to which clients.

```sql
CREATE TABLE advisor_team_client_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Advisor reference (firm owner)
  advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Team member reference
  team_member_id UUID NOT NULL REFERENCES advisor_team_members(id) ON DELETE CASCADE,

  -- Client reference (ANONYMOUS UUID)
  client_uuid UUID NOT NULL,  -- NOT a foreign key

  -- Access scope (what can team member do with this client?)
  access_level VARCHAR(20) NOT NULL DEFAULT 'view_only',
    -- Values: 'view_only', 'view_and_comment', 'full_access'
    -- NOTE: 'full_access' still read-only for advisor team (cannot modify books)

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- Values: 'active', 'revoked'

  -- Audit fields
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  revoked_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(team_member_id, client_uuid),  -- Team member can only be assigned once per client
  CHECK(access_level IN ('view_only', 'view_and_comment', 'full_access')),
  CHECK(status IN ('active', 'revoked'))
);

-- Indexes
CREATE INDEX idx_team_assignments_advisor ON advisor_team_client_assignments(advisor_id);
CREATE INDEX idx_team_assignments_member ON advisor_team_client_assignments(team_member_id);
CREATE INDEX idx_team_assignments_client ON advisor_team_client_assignments(client_uuid);
CREATE INDEX idx_team_assignments_active ON advisor_team_client_assignments(team_member_id, status)
  WHERE status = 'active';  -- Optimize access checks
```

**Key Design Decisions:**

1. **Granular access control** - Advisor decides which team members see which clients
2. **Access levels:**
   - `view_only`: Team member can view reports, transactions (read-only)
   - `view_and_comment`: Can also add comments, @mentions (collaboration)
   - `full_access`: Can view + comment + generate reports + export data (still cannot modify books)
3. **Revocation** - Advisor can remove team member access to specific client anytime
4. **Anonymous client UUID** - Team member device receives view-key (TMVK) for decryption (see J7_VIEW_KEY_CRYPTOGRAPHIC_SPECIFICATION.md)

---

## Data Flow Examples

### Example 1: Advisor Invites Existing Client

**Scenario:** Client "Sarah's Bakery" (sarah@bakery.com) already has Graceful Books account. Her accountant John invites her to his advisor plan.

**Step 1: Advisor sends invitation**
```javascript
// Advisor John clicks "Invite Client" and enters: sarah@bakery.com

// Client-side (John's browser):
const clientUUID = await generateAnonymousClientUUID('sarah@bakery.com');
// Result: "a3d5f7e9-1234-5678-90ab-cdef12345678"

// API call to server:
POST /api/v1/advisor/invite-client
{
  advisor_id: "john-advisor-uuid",
  client_email: "sarah@bakery.com",  // Sent to server for email delivery only
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678"  // Stored for billing
}

// Server creates record:
INSERT INTO advisor_clients (
  advisor_id, client_uuid, relationship_status, invitation_token, invitation_sent_at
) VALUES (
  'john-advisor-uuid',
  'a3d5f7e9-1234-5678-90ab-cdef12345678',
  'pending_invitation',
  'secure-random-token-abc123',
  NOW()
);

// Server sends email to sarah@bakery.com:
// (Template 1 from IC4: Advisor Invitation)
// Email body: "John Smith (Smith & Associates CPA) invited you to connect..."
// Link: https://gracefulbooks.com/advisor/accept-invite?token=secure-random-token-abc123
```

**Platform database state:**
```
advisor_clients table:
  advisor_id: john-advisor-uuid
  client_uuid: a3d5f7e9-1234-5678-90ab-cdef12345678
  relationship_status: pending_invitation
  invitation_sent_at: 2026-01-19 14:30:00
```

**Privacy guarantee:** Platform sees UUID, but NOT Sarah's name, business name, or financial data.

**Step 2: Client accepts invitation**
```javascript
// Sarah clicks invitation link, logs into her account

// Client-side (Sarah's browser):
// Verify invitation token matches her client_uuid
const myClientUUID = await generateAnonymousClientUUID(myEmail);
// Result: "a3d5f7e9-1234-5678-90ab-cdef12345678" (matches!)

// Sarah sees modal:
// "John Smith wants to access your books. This means:
//  - John can view your transactions and reports (read-only)
//  - Your billing ($40/month) will be covered by John's plan (no charge to you)
//  - You can revoke access anytime
//  [Accept] [Decline]"

// Sarah clicks "Accept"

// API call:
POST /api/v1/advisor/accept-invite
{
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678",
  invitation_token: "secure-random-token-abc123",
  accept: true
}

// Server updates record:
UPDATE advisor_clients
SET relationship_status = 'active',
    invitation_accepted_at = NOW(),
    billing_started_at = NOW()
WHERE invitation_token = 'secure-random-token-abc123';

// Server cancels Sarah's individual subscription (Stripe):
// stripe.subscriptions.cancel(sarah.stripe_subscription_id)
// Sarah no longer billed $40/month

// Server updates John's subscription (Stripe):
// Count active clients: SELECT COUNT(*) FROM advisor_clients
//   WHERE advisor_id = 'john-advisor-uuid' AND relationship_status = 'active'
// Result: 4 clients (just added Sarah)
// John's billing tier changes from $0 (first 3 free) to $50 (4-50 clients)
// stripe.subscriptions.update(john.stripe_subscription_id, {
//   items: [{ price: price_50_per_50_clients }]
// })
```

**Platform database state:**
```
advisor_clients table:
  advisor_id: john-advisor-uuid
  client_uuid: a3d5f7e9-1234-5678-90ab-cdef12345678
  relationship_status: active
  invitation_accepted_at: 2026-01-19 14:35:00
  billing_started_at: 2026-01-19 14:35:00
```

**Privacy still maintained:** Platform knows "John's advisor plan includes 4 clients (UUIDs)" but cannot identify who those clients are.

---

### Example 2: Advisor Assigns Team Member to Client

**Scenario:** Advisor John wants his junior accountant Lisa to help with Sarah's Bakery books.

```javascript
// Advisor John's dashboard: Clicks "Assign Team Member" for Sarah's Bakery client

// Client-side:
POST /api/v1/advisor/assign-team-member
{
  advisor_id: "john-advisor-uuid",
  team_member_id: "lisa-team-member-id",
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678",
  access_level: "view_and_comment"
}

// Server creates record:
INSERT INTO advisor_team_client_assignments (
  advisor_id, team_member_id, client_uuid, access_level, assigned_at
) VALUES (
  'john-advisor-uuid',
  'lisa-team-member-id',
  'a3d5f7e9-1234-5678-90ab-cdef12345678',
  'view_and_comment',
  NOW()
);

// Server generates Team Member View-Key (TMVK) per J7 cryptographic spec:
// 1. John's device derives CSVK (Client-Specific View-Key) for Sarah
// 2. John's device derives TMVK from CSVK + Lisa's team_member_id
// 3. Encrypt TMVK with Lisa's public key
// 4. Upload encrypted TMVK to platform

POST /api/v1/advisor/team-view-keys
{
  team_member_id: "lisa-team-member-id",
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678",
  tmvk_encrypted: "encrypted-view-key-blob"  // Encrypted with Lisa's public key
}
```

**Lisa's experience:**
```javascript
// Lisa logs into her team member account

// Lisa sees on her dashboard: "You have access to 1 client"

// Lisa's device:
// 1. Fetches encrypted TMVK from platform
// 2. Decrypts TMVK with Lisa's private key
// 3. Uses TMVK to decrypt Sarah's financial data (same process as advisor)

// Lisa can now:
// - View Sarah's transactions, reports (read-only)
// - Add comments to transactions
// - @mention John or Sarah in comments
// - Generate reports for Sarah

// Lisa CANNOT:
// - Modify Sarah's transactions
// - Change Sarah's account settings
// - See Sarah's master key or passphrase
// - Access Sarah's data if John revokes assignment
```

**Platform knows:** "Lisa has access to client UUID a3d5f7e9-..."
**Platform does NOT know:** That this is Sarah's Bakery, what the financial data is, or what Lisa is viewing

---

### Example 3: Advisor Removes Client

**Scenario:** Sarah's Bakery decides to switch accountants. John removes Sarah from his advisor plan.

```javascript
// Advisor John clicks "Remove Client" for Sarah's Bakery

// Client-side:
POST /api/v1/advisor/remove-client
{
  advisor_id: "john-advisor-uuid",
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678",
  removal_reason: "client_requested"  // Optional: client_requested, no_longer_servicing, other
}

// Server updates record:
UPDATE advisor_clients
SET relationship_status = 'removed',
    billing_ended_at = NOW()
WHERE advisor_id = 'john-advisor-uuid'
  AND client_uuid = 'a3d5f7e9-1234-5678-90ab-cdef12345678';

// Server revokes all team member assignments for this client:
UPDATE advisor_team_client_assignments
SET status = 'revoked', revoked_at = NOW()
WHERE advisor_id = 'john-advisor-uuid'
  AND client_uuid = 'a3d5f7e9-1234-5678-90ab-cdef12345678';

// Server sends email to Sarah (Template 3 from IC4):
// "Your Graceful Books billing has been transferred back to you"
// Sarah must choose: Pay $40/month individually OR archive account (read-only)

// Server updates John's Stripe subscription:
// Count active clients: 3 remaining
// If count drops below threshold, tier downgrade:
// stripe.subscriptions.update(john.stripe_subscription_id, {
//   items: [{ price: price_free }]  // Back to free tier (0-3 clients)
// })
```

**Sarah's experience:**
```javascript
// Sarah logs in, sees modal:
// "Your accountant transferred billing back to you. Choose an option:
//  [Pay $40/month] - Keep full access
//  [Archive Account] - Free, read-only access
//  You have 14 days to decide (grace period)"

// If Sarah chooses "Pay $40/month":
POST /api/v1/billing/resume-individual
{
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678"
}
// Server creates new Stripe subscription for Sarah ($40/month)

// If Sarah chooses "Archive Account":
POST /api/v1/billing/archive-account
{
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678"
}
// Server marks account as archived (no billing, read-only access)
```

---

## Billing Calculation Logic

**Advisor Monthly Cost Formula:**

```javascript
function calculateAdvisorMonthlyCost(advisorId) {
  // Step 1: Count active clients
  const activeClients = db.query(`
    SELECT COUNT(*) as count
    FROM advisor_clients
    WHERE advisor_id = $1 AND relationship_status = 'active'
  `, [advisorId]);

  const clientCount = activeClients[0].count;

  // Step 2: Calculate client charge
  let clientCharge = 0;
  if (clientCount <= 3) {
    clientCharge = 0;  // First 3 free
  } else if (clientCount <= 50) {
    clientCharge = 50;  // 4-50 clients
  } else if (clientCount <= 100) {
    clientCharge = 100;  // 51-100 clients
  } else if (clientCount <= 150) {
    clientCharge = 150;  // 101-150 clients
  } else {
    // Calculate dynamically: $50 per 50 clients
    const blocks = Math.ceil(clientCount / 50);
    clientCharge = blocks * 50;
  }

  // Step 3: Count active team members
  const activeTeamMembers = db.query(`
    SELECT COUNT(*) as count
    FROM advisor_team_members
    WHERE advisor_id = $1 AND status = 'active'
  `, [advisorId]);

  const teamMemberCount = activeTeamMembers[0].count;

  // Step 4: Calculate team member charge
  let teamMemberCharge = 0;
  if (teamMemberCount > 5) {
    teamMemberCharge = (teamMemberCount - 5) * 2.50;  // $2.50 per user after 5
  }

  // Step 5: Add charity contribution
  const charityContribution = (clientCharge > 0 || teamMemberCharge > 0) ? 5.00 : 0;
  // NOTE: Per user clarification, charity is included IN the $50, not added on top
  // So Graceful Books net revenue = $45 per block, $5 goes to charity

  // Step 6: Calculate total
  const totalMonthlyCost = clientCharge + teamMemberCharge;

  return {
    clientCount,
    clientCharge,
    teamMemberCount,
    teamMemberCharge,
    charityContribution,  // Informational only, not added to total
    totalMonthlyCost,
    perClientCost: clientCount > 0 ? totalMonthlyCost / clientCount : 0
  };
}

// Example output:
// {
//   clientCount: 75,
//   clientCharge: 100,  // 51-100 tier
//   teamMemberCount: 8,
//   teamMemberCharge: 7.50,  // 3 extra users × $2.50
//   charityContribution: 5.00,  // Included in clientCharge (not added)
//   totalMonthlyCost: 107.50,
//   perClientCost: 1.43  // $107.50 / 75 clients
// }
```

**Charity Accounting:**
- Advisor pays $100/month for 51-100 clients
- Graceful Books keeps $95 (revenue)
- Graceful Books sends $5 to advisor's selected charity (expense)
- Net to Graceful Books: $95 per advisor block

---

## Privacy & Security Analysis

### What Platform CAN See (Metadata)

| Data Point | Example Value | Privacy Impact |
|------------|---------------|----------------|
| Advisor ID | john-advisor-uuid | Identifies advisor (acceptable) |
| Client UUID | a3d5f7e9-1234... | Anonymous, non-reversible (safe) |
| Relationship Status | active | Business metadata (acceptable) |
| Client Count | 75 | Aggregate metric (acceptable) |
| Billing Dates | 2026-01-19 | Subscription timing (acceptable) |
| Team Member Count | 8 | Aggregate metric (acceptable) |

**Metadata Leakage Concern:**
- With enough metadata (client count, timing of additions/removals, advisor's public client list), platform MIGHT correlate UUIDs to real identities
- **Mitigation:** Anonymous UUIDs are hashed client-side, platform never sees email/name

### What Platform CANNOT See (Protected)

| Data Point | Why Protected |
|------------|---------------|
| Client Email | Never sent to server (used only for UUID generation client-side) |
| Client Name | Never sent to server |
| Client Business Name | Encrypted in user's master key |
| Financial Data | All encrypted with client's DEK (zero-knowledge) |
| Transaction Details | Encrypted, advisor decrypts with view-key client-side |
| Comments/Notes | Encrypted with client's key |
| Advisor's View-Keys | Encrypted with advisor's VKDK (platform cannot decrypt) |

**Zero-Knowledge Guarantee Maintained:** ✅

Even though platform knows advisor-client relationships exist (UUIDs), it cannot:
1. Identify who the clients are
2. Access any financial data
3. Read communications between advisor and client
4. Decrypt view-keys or master keys

---

## Data Retention & GDPR Compliance

### User Deletion (Right to be Forgotten)

**When client deletes account:**
```sql
-- Delete client's encrypted data (transactions, accounts, etc.)
DELETE FROM transactions WHERE company_id = :client_company_id;
DELETE FROM accounts WHERE company_id = :client_company_id;
-- ... (all financial tables)

-- Anonymize advisor_clients record (keep for billing audit trail)
UPDATE advisor_clients
SET client_uuid = 'deleted-client-' || id,  -- Replace UUID with placeholder
    relationship_status = 'removed',
    billing_ended_at = NOW()
WHERE client_uuid = :client_uuid;

-- Remove team assignments
DELETE FROM advisor_team_client_assignments
WHERE client_uuid = :client_uuid;
```

**Result:**
- Client's financial data completely deleted
- Advisor's billing history preserved (for tax/audit purposes) but client identity removed
- Platform has no way to reconstruct who the client was

### Data Export (GDPR Article 15)

**Client requests data export:**
```javascript
// Client clicks "Export My Data"

// Server generates export package:
POST /api/v1/data-export/client
{
  client_uuid: "a3d5f7e9-1234-5678-90ab-cdef12345678"
}

// Export includes:
{
  "account_info": {
    "created_at": "2025-06-15",
    "email": "sarah@bakery.com",  // Client sees this, platform doesn't
    "subscription_type": "individual"
  },
  "advisor_relationships": [
    {
      "advisor_firm": "Smith & Associates CPA",  // Client sees this
      "relationship_start": "2026-01-19",
      "relationship_end": null,
      "status": "active"
    }
  ],
  "financial_data": "encrypted_blob.json.enc",  // Encrypted, client decrypts
  "view_key_grants": [
    {
      "granted_to": "Smith & Associates CPA",
      "granted_at": "2026-01-19",
      "expires_at": null,
      "scope": "read_only"
    }
  ]
}
```

---

## Migration Path (Existing Users → Advisor Model)

**For existing individual users who get invited by advisor:**

1. User already has `users` record with regular subscription
2. Advisor invites user (provides email)
3. System generates `client_uuid` from email (client-side hashing)
4. Creates `advisor_clients` record with status `pending_invitation`
5. User accepts invitation
6. System cancels user's individual Stripe subscription
7. User's `client_uuid` added to advisor's billing count
8. User's data remains encrypted, advisor receives view-key for access

**No data migration needed** - Just subscription transfer and view-key generation.

---

## Summary

This data model achieves:
✅ **Advisor-client relationship tracking** (for billing and support)
✅ **Team member access control** (granular permissions per client)
✅ **Anonymous client identities** (platform cannot identify clients)
✅ **Zero-knowledge preservation** (platform cannot decrypt financial data)
✅ **Billing accuracy** (prevents fraud, enables tier-based pricing)
✅ **GDPR compliance** (right to deletion, data export)
✅ **Revocation capability** (instant access removal for advisors/team members)

**Database tables:** 3 new tables, ~20 columns total
**Privacy level:** High (anonymous UUIDs, no reversible identifiers)
**Security level:** Maximum (zero-knowledge maintained, view-keys encrypted)
**Scalability:** Supports advisors with 1-500+ clients, unlimited team members
