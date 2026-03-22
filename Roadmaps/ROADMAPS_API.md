# Audacious Money - API Specification

> Complete REST API specification for the Business Backend (api.audacious.money)

## Base URL

```
Development:  http://localhost:3000
Production:   https://api.audacious.money
```

## Authentication

### JWT Tokens

**User Tokens:**
```
Authorization: Bearer <jwt_token>
```

**Admin Tokens:**
```
Authorization: Bearer <admin_jwt_token>
X-Admin-Role: super_admin|admin|support|finance
```

**Token Expiry:**
- User tokens: 7 days
- Admin tokens: 24 hours

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional additional context */ }
  }
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (no/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., email already exists)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## 📝 Authentication Endpoints

### POST /auth/signup

Create new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "companyName": "Acme Inc", // optional
  "affiliateCode": "PARTNER123" // optional
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "supportKey": "AM-7K3M-9PQR-5XWZ",
    "emailVerified": false,
    "createdAt": "2026-03-20T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Account created successfully. Please check your email to verify."
}
```

**Errors:**
- `409` - Email already exists
- `400` - Invalid email or weak password

**Rate Limit:** 5 requests/minute per IP

---

### POST /auth/login

Log in existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "supportKey": "AM-7K3M-9PQR-5XWZ",
    "emailVerified": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `401` - Invalid credentials
- `403` - Account suspended

**Rate Limit:** 5 requests/minute per IP

---

### POST /auth/logout

Log out current user (invalidate token).

**Request:** (Empty body)

**Response:** `200 OK`
```json
{
  "message": "Logged out successfully"
}
```

---

### POST /auth/verify-email

Verify email address with token.

**Request:**
```json
{
  "token": "verification_token_from_email"
}
```

**Response:** `200 OK`
```json
{
  "message": "Email verified successfully"
}
```

**Errors:**
- `400` - Invalid or expired token

---

### POST /auth/resend-verification

Resend email verification link.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Verification email sent"
}
```

---

### POST /auth/forgot-password

Request password reset link.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "If that email exists, a reset link has been sent"
}
```

**Note:** Always returns success to prevent email enumeration.

**Rate Limit:** 3 requests/hour per IP

---

### POST /auth/reset-password

Reset password with token.

**Request:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset successfully"
}
```

**Errors:**
- `400` - Invalid or expired token
- `400` - Weak password

---

## 👤 User Endpoints

### GET /users/me

Get current user profile.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "companyName": "Acme Inc",
    "supportKey": "AM-7K3M-9PQR-5XWZ",
    "emailVerified": true,
    "accountStatus": "active",
    "createdAt": "2026-03-20T10:00:00Z",
    "lastLoginAt": "2026-03-20T15:30:00Z"
  }
}
```

---

### PUT /users/me

Update current user profile.

**Auth:** Required

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "companyName": "New Company Inc"
}
```

**Response:** `200 OK`
```json
{
  "user": { /* updated user object */ }
}
```

---

### PUT /users/me/password

Change password (requires current password).

**Auth:** Required

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password updated successfully"
}
```

**Errors:**
- `401` - Current password incorrect

---

### DELETE /users/me

Delete user account.

**Auth:** Required

**Request:**
```json
{
  "password": "CurrentPassword123!",
  "confirmation": "DELETE MY ACCOUNT"
}
```

**Response:** `200 OK`
```json
{
  "message": "Account deleted successfully"
}
```

**Note:** Anonymizes user data but keeps records for financial/legal purposes.

---

## 🛒 Product Endpoints

### GET /products

Get all available products.

**Auth:** Optional (public endpoint)

**Response:** `200 OK`
```json
{
  "products": [
    {
      "id": "uuid",
      "slug": "budgeting",
      "name": "Budgeting Tool",
      "description": "Track income, expenses, and savings goals",
      "priceMonthly": 10.00,
      "charityAmount": 5.00,
      "revenueAmount": 5.00,
      "isUsageBased": false,
      "active": true,
      "displayOrder": 1
    },
    {
      "id": "uuid",
      "slug": "cpu",
      "name": "CPU Calculator",
      "description": "Cost Per Unit analysis tool",
      "priceMonthly": 0,
      "charityAmount": 5.00,
      "isUsageBased": true,
      "usageUnitPrice": 5.00,
      "usageMaxPrice": 50.00,
      "active": true,
      "displayOrder": 5
    }
  ]
}
```

---

### GET /products/:slug

Get single product by slug.

**Auth:** Optional

**Response:** `200 OK`
```json
{
  "product": { /* single product object */ }
}
```

**Errors:**
- `404` - Product not found

---

## 🎟️ User Product Entitlements

### GET /users/me/products

Get user's current product entitlements.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "products": [
    {
      "productId": "uuid",
      "slug": "cpg",
      "name": "CPG/Distributor Management",
      "status": "trial",
      "trialEndsAt": "2026-04-03T10:00:00Z",
      "activatedAt": "2026-03-20T10:00:00Z",
      "canAccess": true
    },
    {
      "productId": "uuid",
      "slug": "budgeting",
      "name": "Budgeting Tool",
      "status": "active",
      "activatedAt": "2026-01-15T10:00:00Z",
      "canAccess": true
    }
  ]
}
```

---

### POST /users/me/products

Purchase/add a new product.

**Auth:** Required

**Request:**
```json
{
  "productSlug": "cpg",
  "discountCode": "WELCOME20" // optional
}
```

**Response:** `201 Created`
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_..."
}
```

**Note:** Returns Stripe Checkout URL. User completes payment, then webhook activates product.

---

## 💰 Payment Endpoints

### GET /users/me/payments

Get user's payment history.

**Auth:** Required

**Query Params:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
- `status` (optional: 'succeeded', 'failed', 'refunded')

**Response:** `200 OK`
```json
{
  "payments": [
    {
      "id": "uuid",
      "productName": "CPG/Distributor Management",
      "totalAmount": 30.00,
      "charityAmount": 5.00,
      "revenueAmount": 25.00,
      "charityName": "One Tree Planted",
      "status": "succeeded",
      "paidAt": "2026-03-20T10:00:00Z"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

---

### GET /users/me/invoices

Get Stripe invoices for user.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "invoices": [
    {
      "id": "in_xxxxx",
      "number": "INV-2026-001",
      "amountDue": 30.00,
      "amountPaid": 30.00,
      "status": "paid",
      "invoiceUrl": "https://invoice.stripe.com/i/...",
      "pdfUrl": "https://invoice.stripe.com/i/.../pdf",
      "created": "2026-03-20T10:00:00Z"
    }
  ]
}
```

---

## 🌱 Charity Endpoints

### GET /charities

Get list of available charities.

**Auth:** Optional (public endpoint)

**Response:** `200 OK`
```json
{
  "charities": [
    {
      "id": "uuid",
      "name": "One Tree Planted",
      "shortDescription": "Global reforestation nonprofit planting trees in 80+ countries",
      "website": "https://onetreeplanted.org",
      "active": true
    },
    {
      "id": "uuid",
      "name": "The Ocean Cleanup",
      "shortDescription": "Developing technology to remove plastic from oceans",
      "website": "https://theoceancleanup.com",
      "active": true
    }
  ]
}
```

---

### GET /users/me/charity

Get user's current charity selection.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "charity": {
    "id": "uuid",
    "name": "One Tree Planted",
    "shortDescription": "Global reforestation nonprofit",
    "selectedAt": "2026-03-20T10:00:00Z",
    "effectiveFrom": "2026-03-20T10:00:00Z"
  }
}
```

---

### PUT /users/me/charity

Change charity selection.

**Auth:** Required

**Request:**
```json
{
  "charityId": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "message": "Charity updated. Change will apply to your next payment.",
  "charity": { /* charity object */ },
  "effectiveFrom": "2026-04-20T00:00:00Z"
}
```

---

## 🎫 Discount Code Endpoints

### POST /discount-codes/validate

Validate a discount code.

**Auth:** Required

**Request:**
```json
{
  "code": "WELCOME20",
  "productSlug": "cpg"
}
```

**Response:** `200 OK`
```json
{
  "valid": true,
  "code": "WELCOME20",
  "discountType": "percentage",
  "discountValue": 20.00,
  "description": "20% off your first month"
}
```

**Errors:**
- `400` - Invalid code
- `400` - Code expired
- `400` - Maximum uses reached
- `400` - Not valid for this product

---

## 🆘 Support Endpoints

### POST /support/grant-session

Grant temporary support access.

**Auth:** Required

**Request:**
```json
{
  "accessType": "books_access", // or "admin_only"
  "notes": "Help me with CPG calculations"
}
```

**Response:** `201 Created`
```json
{
  "sessionToken": "SUP-XXXX-XXXX-XXXX-XXXX",
  "accessType": "books_access",
  "expiresAt": "2026-03-21T10:00:00Z",
  "message": "Provide this token to support: SUP-XXXX-XXXX-XXXX-XXXX"
}
```

**Note:** If `accessType: "books_access"`, includes encrypted master key for support to decrypt user data.

---

### GET /support/sessions

Get user's support session history.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "sessions": [
    {
      "id": "uuid",
      "sessionToken": "SUP-XXXX-XXXX-XXXX-XXXX",
      "accessType": "books_access",
      "grantedAt": "2026-03-20T10:00:00Z",
      "expiresAt": "2026-03-21T10:00:00Z",
      "revokedAt": null,
      "accessedBy": "Admin Jane",
      "accessCount": 3,
      "userNotes": "Help with CPG calculations",
      "adminNotes": "Helped troubleshoot distributor cost trends"
    }
  ]
}
```

---

### POST /support/sessions/:id/revoke

Revoke a support session.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "message": "Support access revoked"
}
```

---

## 🔧 Admin Endpoints

**All admin endpoints require admin JWT token.**

### Admin Authentication

#### POST /admin/auth/login

Admin login.

**Request:**
```json
{
  "email": "admin@audacious.money",
  "password": "AdminPass123!"
}
```

**Response:** `200 OK`
```json
{
  "admin": {
    "id": "uuid",
    "email": "admin@audacious.money",
    "firstName": "Admin",
    "lastName": "User",
    "role": "super_admin",
    "permissions": ["*"]
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### User Management

#### GET /admin/users

List all users with filtering.

**Auth:** Admin Required

**Query Params:**
- `search` (email, name, support key)
- `status` ('active', 'suspended', 'deleted')
- `limit` (default: 50)
- `offset` (default: 0)

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "supportKey": "AM-7K3M-9PQR",
      "accountStatus": "active",
      "productCount": 2,
      "lifetimeValue": 450.00,
      "createdAt": "2026-01-15T10:00:00Z",
      "lastLoginAt": "2026-03-20T15:30:00Z"
    }
  ],
  "total": 1234,
  "hasMore": true
}
```

---

#### GET /admin/users/:id

Get detailed user info.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "supportKey": "AM-7K3M-9PQR",
    "accountStatus": "active",
    "emailVerified": true,
    "createdAt": "2026-01-15T10:00:00Z"
  },
  "products": [ /* user_products array */ ],
  "payments": [ /* payments array */ ],
  "lifetimeValue": 450.00
}
```

---

#### POST /admin/users/:id/suspend

Suspend user account.

**Auth:** Admin Required

**Request:**
```json
{
  "reason": "Payment dispute"
}
```

**Response:** `200 OK`
```json
{
  "message": "User suspended"
}
```

---

#### POST /admin/users/:id/unsuspend

Unsuspend user account.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "message": "User unsuspended"
}
```

---

### Analytics

#### GET /admin/analytics/overview

Get business overview metrics.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "metrics": {
    "totalUsers": 1234,
    "activeSubscriptions": 987,
    "trialUsers": 156,
    "expiredUsers": 91,
    "mrr": 28750.00,
    "revenueThisMonth": 28750.00,
    "charityThisMonth": 4935.00,
    "newUsersThisMonth": 45,
    "churnRate": 2.3,
    "conversionRate": 78.5
  },
  "updatedAt": "2026-03-20T15:30:00Z"
}
```

---

#### GET /admin/analytics/products

Product breakdown.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "products": [
    {
      "slug": "cpg",
      "name": "CPG/Distributor Management",
      "activeUsers": 234,
      "trialUsers": 45,
      "mrr": 7020.00,
      "conversionRate": 82.0
    }
  ]
}
```

---

#### GET /admin/analytics/revenue

Revenue analytics.

**Auth:** Admin Required

**Query Params:**
- `period` ('day', 'week', 'month', 'year')
- `startDate` (ISO 8601)
- `endDate` (ISO 8601)

**Response:** `200 OK`
```json
{
  "revenue": [
    {
      "date": "2026-03-01",
      "totalRevenue": 28750.00,
      "charityDonations": 4935.00,
      "netRevenue": 23815.00,
      "paymentCount": 987
    }
  ]
}
```

---

### Charity Management

#### GET /admin/charities

Get all charities (including inactive).

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "charities": [ /* full charity objects with admin fields */ ]
}
```

---

#### POST /admin/charities

Create new charity.

**Auth:** Admin Required

**Request:**
```json
{
  "name": "New Charity",
  "shortDescription": "Description for users",
  "ein": "12-3456789",
  "address": "123 Main St",
  "phone": "555-1234",
  "email": "contact@charity.org",
  "website": "https://charity.org",
  "notes": "Internal notes"
}
```

**Response:** `201 Created`
```json
{
  "charity": { /* created charity object */ }
}
```

---

#### PUT /admin/charities/:id

Update charity.

**Auth:** Admin Required

**Request:** (Same as POST, all fields optional)

**Response:** `200 OK`

---

#### GET /admin/charities/donations-owed

Get charity donations owed (unpaid).

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "charities": [
    {
      "charityId": "uuid",
      "name": "One Tree Planted",
      "totalOwed": 2450.00,
      "paymentCount": 490,
      "oldestUnpaidDate": "2026-01-15T00:00:00Z"
    }
  ],
  "totalOwed": 4935.00
}
```

---

#### POST /admin/charities/generate-payout

Generate monthly charity payout report.

**Auth:** Admin Required (role: 'finance' or 'super_admin')

**Request:**
```json
{
  "periodStart": "2026-03-01",
  "periodEnd": "2026-03-31"
}
```

**Response:** `201 Created`
```json
{
  "payouts": [
    {
      "id": "uuid",
      "charityId": "uuid",
      "charityName": "One Tree Planted",
      "periodStart": "2026-03-01",
      "periodEnd": "2026-03-31",
      "totalAmount": 2450.00,
      "paymentCount": 490,
      "status": "pending"
    }
  ]
}
```

---

#### POST /admin/charities/payouts/:id/mark-paid

Mark charity payout as paid.

**Auth:** Admin Required (role: 'finance' or 'super_admin')

**Request:**
```json
{
  "paymentMethod": "bank_transfer",
  "paymentReference": "TXN-123456",
  "notes": "Paid via ACH"
}
```

**Response:** `200 OK`
```json
{
  "message": "Payout marked as paid"
}
```

---

### Affiliate Management

#### GET /admin/affiliates

List all affiliates.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "affiliates": [
    {
      "id": "uuid",
      "code": "PARTNER123",
      "name": "Jane Partner",
      "email": "jane@partner.com",
      "commissionType": "percentage",
      "commissionValue": 20.00,
      "commissionDuration": 1,
      "totalConversions": 45,
      "totalRevenueGenerated": 1350.00,
      "totalCommissionEarned": 270.00,
      "commissionOwed": 120.00,
      "active": true
    }
  ]
}
```

---

#### POST /admin/affiliates

Create new affiliate.

**Auth:** Admin Required

**Request:**
```json
{
  "code": "PARTNER123",
  "name": "Jane Partner",
  "email": "jane@partner.com",
  "commissionType": "percentage", // or "flat"
  "commissionValue": 20.00,
  "commissionDuration": 1 // months
}
```

**Response:** `201 Created`

---

#### PUT /admin/affiliates/:id

Update affiliate.

**Auth:** Admin Required

**Request:** (Same as POST, all fields optional)

**Response:** `200 OK`

---

#### GET /admin/affiliates/:id/conversions

Get affiliate's conversions.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "conversions": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userEmail": "user@example.com",
      "productName": "CPG",
      "clickedAt": "2026-03-15T10:00:00Z",
      "signedUpAt": "2026-03-15T10:15:00Z",
      "convertedAt": "2026-03-15T10:30:00Z",
      "firstPaymentAmount": 30.00,
      "commissionEarned": 6.00,
      "commissionPaid": false
    }
  ]
}
```

---

#### POST /admin/affiliates/:id/pay-commission

Mark affiliate commissions as paid.

**Auth:** Admin Required

**Request:**
```json
{
  "conversionIds": ["uuid1", "uuid2"], // or "all" for all unpaid
  "payoutReference": "PAYPAL-TXN-123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Commission paid for 12 conversions",
  "totalPaid": 240.00
}
```

---

### Discount Codes

#### GET /admin/discount-codes

List all discount codes.

**Auth:** Admin Required

**Response:** `200 OK`
```json
{
  "discountCodes": [
    {
      "id": "uuid",
      "code": "WELCOME20",
      "discountType": "percentage",
      "discountValue": 20.00,
      "maxUses": 1000,
      "currentUses": 234,
      "validFrom": "2026-01-01T00:00:00Z",
      "validUntil": "2026-12-31T23:59:59Z",
      "active": true
    }
  ]
}
```

---

#### POST /admin/discount-codes

Create discount code.

**Auth:** Admin Required

**Request:**
```json
{
  "code": "WELCOME20",
  "discountType": "percentage", // or "fixed_amount" or "trial_extension"
  "discountValue": 20.00,
  "trialExtensionDays": null, // only if type = trial_extension
  "productSlugs": ["cpg", "budgeting"], // or null for all products
  "maxUses": 1000,
  "maxUsesPerUser": 1,
  "validFrom": "2026-01-01T00:00:00Z",
  "validUntil": "2026-12-31T23:59:59Z"
}
```

**Response:** `201 Created`

---

#### PUT /admin/discount-codes/:id

Update discount code.

**Auth:** Admin Required

**Request:** (Same as POST, all fields optional)

**Response:** `200 OK`

---

#### DELETE /admin/discount-codes/:id

Deactivate discount code.

**Auth:** Admin Required

**Response:** `200 OK`

---

### Support Sessions

#### GET /admin/support/lookup

Look up user by Support Key.

**Auth:** Admin Required

**Query Params:**
- `supportKey` (e.g., "AM-7K3M-9PQR")

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "supportKey": "AM-7K3M-9PQR",
    "accountStatus": "active",
    "products": [ /* user products */ ],
    "payments": [ /* recent payments */ ]
  }
}
```

**Errors:**
- `404` - Support key not found

---

#### POST /admin/support/access

Access user's data with support session token.

**Auth:** Admin Required

**Request:**
```json
{
  "sessionToken": "SUP-XXXX-XXXX-XXXX-XXXX"
}
```

**Response:** `200 OK`
```json
{
  "access": {
    "userId": "uuid",
    "userEmail": "user@example.com",
    "accessType": "books_access",
    "decryptionKey": "encrypted_master_key_here",
    "expiresAt": "2026-03-21T10:00:00Z",
    "userNotes": "Help with CPG calculations"
  }
}
```

**Errors:**
- `404` - Invalid token
- `403` - Token expired or revoked

**Note:** If `accessType: "books_access"`, admin can use `decryptionKey` to decrypt user's financial data.

---

## 🔔 Webhook Endpoints

### POST /stripe/webhook

Stripe webhook handler.

**Auth:** Stripe signature verification

**Events Handled:**
- `checkout.session.completed` - Activate product on successful payment
- `invoice.payment_succeeded` - Record recurring payment
- `invoice.payment_failed` - Handle failed payment
- `customer.subscription.deleted` - Mark subscription as cancelled
- `customer.subscription.updated` - Update subscription status

**Response:** `200 OK`
```json
{
  "received": true
}
```

---

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Auth (signup/login) | 5 requests | 1 minute |
| Password reset | 3 requests | 1 hour |
| All other endpoints (authenticated) | 100 requests | 1 minute |
| Webhook endpoints | No limit | N/A |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1710943200
```

**Rate Limit Exceeded Response:** `429 Too Many Requests`
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 45
  }
}
```

---

## Versioning

API version included in URL (future-proofing):

```
https://api.audacious.money/v1/users/me
```

Currently all endpoints are v1 (implied, can omit).

---

## Testing Endpoints

### GET /health

Health check.

**Auth:** None

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2026-03-20T15:30:00Z",
  "database": "connected",
  "stripe": "configured"
}
```

---

### GET /debug/echo

Echo request (dev only).

**Auth:** None

**Response:** `200 OK`
```json
{
  "method": "GET",
  "headers": { /* request headers */ },
  "query": { /* query params */ },
  "body": { /* request body */ }
}
```

---

## Implementation Notes

**Technology:**
- Bun runtime
- Hono web framework
- PostgreSQL for data
- Stripe SDK for payments
- Zod for validation
- JWT for authentication

**File Structure:**
```
src/routes/
├── auth.ts
├── users.ts
├── products.ts
├── charities.ts
├── support.ts
└── admin/
    ├── users.ts
    ├── analytics.ts
    ├── charities.ts
    ├── affiliates.ts
    └── discounts.ts
```

---

## Next Steps

1. See **ROADMAPS_AUTHENTICATION.md** for detailed auth flows
2. See **ROADMAPS_STRIPE.md** for payment integration details
3. See **ROADMAPS_ADMIN_DASHBOARD.md** for frontend admin interface

---

**Last Updated:** 2026-03-20
