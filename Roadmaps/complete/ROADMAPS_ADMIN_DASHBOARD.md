# Audacious Money - Admin Dashboard

> Complete admin interface specification for business operations

## Overview

The admin dashboard (admin.audacious.money) provides comprehensive business management including:
- Analytics & reporting
- User management
- Subscription management
- Charity management & payouts
- Affiliate tracking & commissions
- Discount code management
- Support session management
- Audit logging

---

## Access & Permissions

### Admin Roles

```typescript
type AdminRole = 'super_admin' | 'admin' | 'support' | 'finance';

const permissions = {
  super_admin: ['*'], // All permissions
  admin: [
    'view_analytics',
    'manage_users',
    'manage_products',
    'manage_charities',
    'manage_affiliates',
    'manage_discounts',
    'view_support_sessions'
  ],
  support: [
    'view_users',
    'manage_support_sessions',
    'view_subscriptions'
  ],
  finance: [
    'view_analytics',
    'manage_charity_payouts',
    'view_payments',
    'manage_affiliate_payouts'
  ]
};
```

---

## Dashboard Pages

### 1. Overview / Analytics Dashboard

**Route:** `/admin`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  📊 Business Overview                   Last Updated: 3m ago │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Total Users  │  │ Active Subs  │  │ MRR          │ │
│  │ 1,234        │  │ 987          │  │ $28,750      │ │
│  │ +45 this mo  │  │ 78.5% conv   │  │ +$2,340 ↑    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Trial Users  │  │ Churn Rate   │  │ Charity Owed │ │
│  │ 156          │  │ 2.3%         │  │ $4,935       │ │
│  │ 14 end today │  │ Industry: 5% │  │ Feb payout   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
│  📈 Revenue Chart (Last 90 Days)                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Line/bar chart showing daily/weekly revenue]    │   │
│  │ - Total Revenue                                  │   │
│  │ - Charity Donations                              │   │
│  │ - Net Revenue                                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📦 Product Breakdown                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Product              Active  Trial  MRR     Conv │   │
│  │ CPG                  234     45     $7,020  82%  │   │
│  │ Bookkeeping Suite    178     23     $7,120  86%  │   │
│  │ Budgeting            156     12     $1,560  91%  │   │
│  │ Debt Management      98      8      $1,960  88%  │   │
│  │ ...                                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  🚨 Alerts                                              │
│  • 14 trials ending today                              │
│  • 3 failed payments need attention                    │
│  • Charity payout due for February                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Data Sources:**
- `GET /admin/analytics/overview`
- `GET /admin/analytics/revenue?period=90days`
- `GET /admin/analytics/products`

---

### 2. Users Page

**Route:** `/admin/users`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  👥 Users                                 Total: 1,234   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Search by email, name, or Support Key... ]           │
│                                                         │
│  Filters: [All ▼] [Active ▼] [Has Products ▼]         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Email              Name        Support Key  LTV  │   │
│  │ jane@ex.com        Jane Doe    AM-7K3M      $450 │   │
│  │   • CPG (Active)                                 │   │
│  │   • Budgeting (Active)                           │   │
│  │   [View Details] [Suspend] [Login As]           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ john@ex.com        John Smith  AM-9PQR      $120 │   │
│  │   • Debt Mgmt (Trial, ends 3/25)                │   │
│  │   [View Details] [Extend Trial] [Contact]       │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Pagination: < 1 2 3 ... 25 >]                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Search by email, name, Support Key
- Filter by status, product, trial/active
- View user details (modal or separate page)
- Suspend/unsuspend accounts
- View payment history
- View subscription details
- Impersonate user (login as, for debugging)

**User Detail Page:**

```
┌─────────────────────────────────────────────────────────┐
│  👤 Jane Doe (jane@example.com)                         │
│  Support Key: AM-7K3M-9PQR-5XWZ                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Account Info                                           │
│  • Created: Jan 15, 2026                                │
│  • Last Login: Mar 20, 2026 at 3:30 PM                 │
│  • Status: Active                                       │
│  • Email Verified: Yes                                  │
│  • Charity: One Tree Planted                            │
│  • Lifetime Value: $450                                 │
│                                                         │
│  Products (2)                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ CPG/Distributor Management                       │   │
│  │ Status: Active | Started: Feb 1, 2026           │   │
│  │ Subscription: sub_xxxx | Next billing: Apr 1    │   │
│  │ [Cancel] [Upgrade] [View Stripe]                │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Budgeting Tool                                   │   │
│  │ Status: Active | Started: Jan 15, 2026          │   │
│  │ [Cancel] [View Stripe]                           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Payment History (showing last 10)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Date       Product    Amount  Status  Invoice   │   │
│  │ Mar 1      CPG        $30     Paid    [View]    │   │
│  │ Feb 15     Budgeting  $10     Paid    [View]    │   │
│  │ Feb 1      CPG        $30     Paid    [View]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Support Sessions (2)                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Mar 15 | Books Access | Handled by Admin Sarah  │   │
│  │ Notes: Helped troubleshoot CPG calculations     │   │
│  │ Feb 20 | Admin Only   | Handled by Support Tom  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Actions:                                               │
│  [Suspend Account] [Send Email] [Login As User]        │
│  [Extend Trial] [Issue Refund]                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 3. Subscriptions Page

**Route:** `/admin/subscriptions`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  💳 Subscriptions                        Total: 987     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Filters: [Status ▼] [Product ▼] [Trial Ending ▼]     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ User         Product       Status    Next Bill  │   │
│  │ jane@ex.com  CPG           Active    Apr 1      │   │
│  │              $30/mo        sub_xxxx             │   │
│  │ [View Stripe] [Cancel] [Change Plan]           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ john@ex.com  Debt Mgmt     Trial     Mar 25     │   │
│  │              $20/mo        Ends in 5 days       │   │
│  │ [Extend Trial] [Convert Now] [Cancel]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Filter by status (trial, active, cancelled, expired)
- Filter by product
- View trials ending soon (next 7 days)
- Quick actions: extend trial, cancel, upgrade
- Bulk operations: send reminder emails

---

### 4. Charities Page

**Route:** `/admin/charities`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  🌱 Charities                            Total: 5       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [+ Add New Charity]                                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ One Tree Planted                        Active   │   │
│  │ EIN: 46-4664562                                  │   │
│  │ Global reforestation nonprofit...                │   │
│  │ Users: 456 | Owed: $2,280                        │   │
│  │ [Edit] [Deactivate] [View Donations]            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ The Ocean Cleanup                       Active   │   │
│  │ EIN: 82-2606143                                  │   │
│  │ Developing technology to remove plastic...       │   │
│  │ Users: 312 | Owed: $1,560                        │   │
│  │ [Edit] [Deactivate] [View Donations]            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  💰 Payouts                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ February 2026 Payouts (Pending)                  │   │
│  │ • One Tree Planted: $2,280 (456 payments)        │   │
│  │ • The Ocean Cleanup: $1,560 (312 payments)       │   │
│  │ • ...                                            │   │
│  │ Total: $4,935                                    │   │
│  │ [Generate Payout Report] [Mark All As Paid]     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📊 Donation History                                    │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Month      Charity             Amount    Status  │   │
│  │ Feb 2026   One Tree Planted    $2,280    Paid    │   │
│  │ Feb 2026   The Ocean Cleanup   $1,560    Paid    │   │
│  │ Jan 2026   One Tree Planted    $2,150    Paid    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Add/Edit Charity Form:**

```
┌─────────────────────────────────────────────────────────┐
│  ✏️ Edit Charity                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Name: [One Tree Planted___________________________]   │
│                                                         │
│  Short Description (shown to users):                   │
│  [Global reforestation nonprofit planting trees___]    │
│  [in 80+ countries to combat climate change_______]    │
│                                                         │
│  EIN: [46-4664562____________]                         │
│                                                         │
│  Contact Information:                                   │
│  Address: [123 Main St, Burlington, VT 05401______]    │
│  Phone:   [555-123-4567________________________]       │
│  Email:   [contact@onetreeplanted.org__________]       │
│  Website: [https://onetreeplanted.org__________]       │
│                                                         │
│  Internal Notes:                                        │
│  [Contact: Sarah Jones, preferred payout: ACH____]     │
│  [Account #: 123456789, Routing: 987654321______]     │
│                                                         │
│  Status: ☑ Active                                       │
│                                                         │
│  [Save] [Cancel]                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Mark Payout as Paid:**

```
┌─────────────────────────────────────────────────────────┐
│  💸 Mark Charity Payout as Paid                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Charity: One Tree Planted                              │
│  Period: February 1-28, 2026                            │
│  Amount: $2,280 (456 payments)                          │
│                                                         │
│  Payment Method:                                        │
│  ○ Check   ● Bank Transfer   ○ PayPal   ○ Other       │
│                                                         │
│  Payment Reference (e.g., transaction ID, check #):    │
│  [TXN-2026-02-28-123456_______________________]        │
│                                                         │
│  Payment Date: [03/01/2026__]                          │
│                                                         │
│  Notes:                                                 │
│  [ACH transfer, confirmation received__________]       │
│                                                         │
│  [Mark as Paid] [Cancel]                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 5. Affiliates Page

**Route:** `/admin/affiliates`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  🤝 Affiliates                           Total: 12      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [+ Add New Affiliate]                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ PARTNER123 | Jane Partner (jane@partner.com)    │   │
│  │ Commission: 20% first month                      │   │
│  │ Conversions: 45 | Revenue: $1,350 | Owed: $120  │   │
│  │ [View Details] [Edit] [Pay Commission]           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ COACH456 | John Coach (john@coach.com)          │   │
│  │ Commission: $10 per signup (flat)                │   │
│  │ Conversions: 23 | Revenue: $690 | Owed: $80     │   │
│  │ [View Details] [Edit] [Pay Commission]           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📊 Top Performers (This Month)                         │
│  1. PARTNER123 - 12 conversions                         │
│  2. COACH456 - 8 conversions                            │
│  3. INFLUENCER789 - 6 conversions                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Affiliate Detail Page:**

```
┌─────────────────────────────────────────────────────────┐
│  🤝 Affiliate: PARTNER123 (Jane Partner)                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Contact: jane@partner.com                              │
│  Commission: 20% of first month                         │
│  Duration: 1 month (first payment only)                 │
│  Status: Active                                         │
│                                                         │
│  Performance Summary                                    │
│  • Total Conversions: 45                                │
│  • Total Revenue Generated: $1,350                      │
│  • Total Commission Earned: $270                        │
│  • Commission Paid: $150                                │
│  • Commission Owed: $120                                │
│                                                         │
│  Conversions (showing last 25)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Date    User Email      Product  Payment  Comm  │   │
│  │ Mar 15  user@ex.com     CPG      $30      $6    │   │
│  │ Mar 10  other@ex.com    Budget   $10      $2    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Commission Payout History                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Date       Amount  Reference        Status       │   │
│  │ Feb 28     $150    PAYPAL-TXN-123   Paid         │   │
│  │ Jan 31     $120    PAYPAL-TXN-100   Paid         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Actions:                                               │
│  [Pay Commission ($120)] [Edit] [Deactivate]           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Add/Edit Affiliate Form:**

```
┌─────────────────────────────────────────────────────────┐
│  ✏️ Add New Affiliate                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Affiliate Code: [PARTNER123__________________]        │
│  (Users will use: audacious.money?ref=PARTNER123)      │
│                                                         │
│  Name:  [Jane Partner_________________________]        │
│  Email: [jane@partner.com_____________________]        │
│                                                         │
│  Commission Structure:                                  │
│  ● Percentage   ○ Flat Dollar Amount                   │
│                                                         │
│  Commission Value: [20___]%                            │
│                                                         │
│  Commission Duration (months):                          │
│  [1___] (1 = first payment only, 12 = first year)     │
│                                                         │
│  Status: ☑ Active                                       │
│                                                         │
│  [Save] [Cancel]                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Pay Commission:**

```
┌─────────────────────────────────────────────────────────┐
│  💸 Pay Affiliate Commission                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Affiliate: PARTNER123 (Jane Partner)                   │
│  Email: jane@partner.com                                │
│                                                         │
│  Unpaid Commissions:                                    │
│  • 12 conversions                                       │
│  • Total owed: $120.00                                  │
│                                                         │
│  Payment Reference (PayPal TXN, check #, etc.):        │
│  [PAYPAL-TXN-2026-03-20_______________________]        │
│                                                         │
│  [Mark All as Paid] [Cancel]                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 6. Discount Codes Page

**Route:** `/admin/discount-codes`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  🎫 Discount Codes                       Total: 15      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [+ Create New Discount Code]                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ WELCOME20                              Active    │   │
│  │ 20% off first month | All products               │   │
│  │ Used: 234/1000 | Valid until: Dec 31, 2026      │   │
│  │ [Edit] [Deactivate] [View Usage]                │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ SAVE50                                 Active    │   │
│  │ $50 off first month | Bookkeeping Suite only    │   │
│  │ Used: 45/100 | Valid until: Jun 30, 2026        │   │
│  │ [Edit] [Deactivate] [View Usage]                │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ EXTENDED7                              Expired   │   │
│  │ +7 days trial extension | CPG only               │   │
│  │ Used: 100/100 | Expired: Mar 1, 2026            │   │
│  │ [View Usage]                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Create/Edit Discount Code:**

```
┌─────────────────────────────────────────────────────────┐
│  ✏️ Create Discount Code                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Code: [WELCOME20_____________________________]        │
│                                                         │
│  Discount Type:                                         │
│  ● Percentage Off   ○ Fixed Amount   ○ Trial Extension │
│                                                         │
│  Discount Value: [20___]%                              │
│                                                         │
│  Valid for Products:                                    │
│  ☑ All Products                                         │
│  ☐ Specific products: [Select...▼]                     │
│                                                         │
│  Usage Limits:                                          │
│  Max total uses: [1000___] (leave blank for unlimited) │
│  Max uses per user: [1___]                             │
│                                                         │
│  Validity Period:                                       │
│  Valid from: [01/01/2026__] Valid until: [12/31/2026__]│
│                                                         │
│  Status: ☑ Active                                       │
│                                                         │
│  [Create Code] [Cancel]                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 7. Support Page

**Route:** `/admin/support`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  🆘 Support                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Look up user by Support Key:                           │
│  [AM-____-____-____] [Search]                          │
│                                                         │
│  Access with Support Session Token:                     │
│  [SUP-____-____-____-____] [Access User Data]          │
│                                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                         │
│  Active Support Sessions                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ User: jane@example.com (AM-7K3M-9PQR)           │   │
│  │ Access Type: Books Access                        │   │
│  │ Granted: 2 hours ago | Expires: 22 hours        │   │
│  │ Token: SUP-A7F2-9K3M-Q8P1-Z3Y5                  │   │
│  │ Notes: Help with CPG distributor costs          │   │
│  │ [Access User Data] [Revoke Access]               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Recent Support Sessions                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Date    User          Type          Admin       │   │
│  │ Mar 20  jane@ex.com   Books Access  Sarah       │   │
│  │ Mar 18  john@ex.com   Admin Only    Tom         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**After Looking Up User (via Support Key):**

```
┌─────────────────────────────────────────────────────────┐
│  👤 User: Jane Doe (jane@example.com)                   │
│  Support Key: AM-7K3M-9PQR-5XWZ                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Account Status: Active                                 │
│  Products: CPG (Active), Budgeting (Active)             │
│  Last Login: Mar 20, 2026 at 3:30 PM                   │
│                                                         │
│  Recent Payments:                                       │
│  • Mar 1: CPG - $30 (Successful)                        │
│  • Feb 15: Budgeting - $10 (Successful)                 │
│                                                         │
│  [View Full User Details]                               │
│                                                         │
│  ⚠️  To view this user's financial data (books),        │
│     you need a Support Session Token from the user.     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**After Accessing with Support Session Token:**

```
┌─────────────────────────────────────────────────────────┐
│  📊 Viewing Jane's Financial Data (READ-ONLY)           │
│  Session expires in 22 hours                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ⚠️  You are viewing encrypted user data. This access   │
│     was granted by the user and will expire in 22 hours.│
│     All actions are logged.                             │
│                                                         │
│  [View CPG Dashboard] [View Transactions]               │
│  [View Budgets] [Export Data]                           │
│                                                         │
│  Admin Notes:                                           │
│  [User asked about distributor cost trends...___]       │
│  [________________________________________________]       │
│                                                         │
│  [Save Notes] [End Session]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 8. Audit Log Page

**Route:** `/admin/audit-log`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  📜 Audit Log                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Filters: [Admin ▼] [Action Type ▼] [Date Range ▼]    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Time       Admin    Action               Details │   │
│  │ 3:45 PM    Sarah    user_suspended       jane@  │   │
│  │                     Reason: Payment dispute       │   │
│  │ 2:30 PM    Tom      discount_created     SAVE50  │   │
│  │ 1:15 PM    Sarah    charity_payout_paid  $2,280  │   │
│  │ 12:00 PM   Finance  affiliate_paid       $120    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Reactivation Tracking

**Route:** `/admin/analytics/reactivations`

Special view requested by user to track users who deactivate and reactivate.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  🔄 Reactivation Tracking                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Overview                                               │
│  • Total Cancellations (All Time): 245                  │
│  • Reactivations: 78 (31.8% reactivation rate)          │
│  • Average Inactive Period: 67 days                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ User         Product  Cancelled  Reactivated  Days│   │
│  │ jane@ex.com  CPG      Feb 1      Mar 15       42 │   │
│  │ john@ex.com  Budget   Jan 10     Mar 20       69 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📊 Reactivation Patterns                               │
│  • Most reactivated product: CPG (45%)                  │
│  • Peak reactivation time: 60-90 days                   │
│  • Common reactivation reason: "Tax season"             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### Frontend Stack
- React 18 + TypeScript
- React Router for navigation
- Recharts for analytics visualizations
- TanStack Table for data tables
- Tailwind CSS or custom CSS Modules

### API Integration

```typescript
// Example: Fetching analytics data
const fetchAnalytics = async () => {
  const response = await fetch('/admin/analytics/overview', {
    headers: {
      'Authorization': `Bearer ${adminJwt}`,
      'X-Admin-Role': adminRole
    }
  });

  if (!response.ok) {
    if (response.status === 403) {
      // Insufficient permissions
      router.push('/admin/unauthorized');
    }
    throw new Error('Failed to fetch analytics');
  }

  return response.json();
};
```

### Real-Time Updates

**Optional:** WebSocket connection for real-time updates

```typescript
// Connect to admin WebSocket
const ws = new WebSocket('wss://api.audacious.money/admin/ws');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);

  switch (type) {
    case 'new_signup':
      // Toast notification: "New user signed up!"
      refreshUsersList();
      break;
    case 'payment_failed':
      // Add to alerts
      showAlert('Payment failed for user@example.com');
      break;
    case 'trial_ending_soon':
      // Update trial counter
      updateTrialCounter(data.count);
      break;
  }
};
```

---

## Security

### Admin Authentication
- Separate JWT tokens (shorter expiry: 24 hours)
- Role-based access control (RBAC)
- All admin actions logged in audit trail
- IP address tracking
- Two-factor authentication (optional, but recommended)

### Data Access
- Support can only access user data with valid session token
- All data access logged with timestamp
- Support session tokens expire after 24 hours
- User can revoke access anytime

---

## Next Steps

See:
- **ROADMAPS_DEPLOYMENT.md** for deploying admin dashboard
- **ROADMAPS_API.md** for complete admin API endpoints

---

**Last Updated:** 2026-03-20
