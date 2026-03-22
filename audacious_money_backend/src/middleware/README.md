# Authentication Middleware

This directory contains the JWT authentication middleware for the Audacious Money backend API.

## Files

- **`auth.ts`** - Main authentication middleware
- **`auth.test.ts`** - Comprehensive test suite
- **`security.ts`** - Security headers middleware
- **`rateLimit.ts`** - Rate limiting middleware
- **`errorHandler.ts`** - Error handling middleware

## Authentication Middleware (`auth.ts`)

### Available Middleware Functions

#### 1. `requireAuth`
Validates JWT token for regular users and sets user context.

**Sets in context:**
- `userId` - User's UUID
- `userEmail` - User's email address
- `userRole` - User's role (always 'user')

**PostgreSQL:** Sets session variable `app.user_id` for Row-Level Security.

**Example:**
```typescript
import { requireAuth } from './middleware/auth.js';

app.get('/api/user/profile', requireAuth, async (c) => {
  const userId = c.get('userId');
  // Always filter by userId in queries
});
```

#### 2. `requireAdmin`
Validates JWT token for admin users and sets admin context.

**Sets in context:**
- `adminId` - Admin's UUID
- `adminEmail` - Admin's email address
- `adminRole` - Admin's role (super_admin, admin, support, finance)
- `adminPermissions` - Array of permissions or ['*'] for super_admin

**Example:**
```typescript
import { requireAdmin } from './middleware/auth.js';

app.get('/admin/dashboard', requireAdmin, async (c) => {
  const adminId = c.get('adminId');
  // Admin logic
});
```

#### 3. `requireRole(role)`
Checks if user has a specific role.

**Example:**
```typescript
import { requireAuth, requireRole } from './middleware/auth.js';

app.get('/premium', requireAuth, requireRole('user'), async (c) => {
  // Only users with 'user' role
});
```

#### 4. `requirePermission(permissions)`
Checks if admin has specific permissions.

**Example:**
```typescript
import { requireAdmin, requirePermission } from './middleware/auth.js';
import { Permissions } from '../config/permissions.js';

app.get('/admin/users',
  requireAdmin,
  requirePermission([Permissions.VIEW_USERS]),
  async (c) => {
    // Only admins with VIEW_USERS permission
  }
);
```

## IDOR Prevention

### Critical Security Pattern

**ALWAYS filter database queries by the authenticated user's ID.**

### Wrong (Vulnerable to IDOR)

```typescript
// ❌ WRONG - Any authenticated user can access any product
app.get('/api/products/:id', requireAuth, async (c) => {
  const productId = c.req.param('id');

  const product = await db.query(
    'SELECT * FROM user_products WHERE id = $1',
    [productId]
  );

  return success(c, product.rows[0]);
});
```

**Problem:** User A can access User B's products by guessing the product ID.

### Correct (IDOR Prevention)

```typescript
// ✅ RIGHT - Users can only access their own products
app.get('/api/products/:id', requireAuth, async (c) => {
  const userId = c.get('userId'); // From requireAuth middleware
  const productId = c.req.param('id');

  const product = await db.query(
    'SELECT * FROM user_products WHERE id = $1 AND user_id = $2',
    [productId, userId]
  );

  // Don't reveal whether resource exists if user doesn't own it
  if (!product.rows[0]) {
    return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
  }

  return success(c, product.rows[0]);
});
```

### IDOR Prevention Checklist

For every protected endpoint:

- [ ] Get `userId` from context: `const userId = c.get('userId')`
- [ ] Include `AND user_id = $userId` in WHERE clause
- [ ] Return 404 NOT_FOUND if user doesn't own resource (don't use 403 FORBIDDEN)
- [ ] Never reveal whether a resource exists to unauthorized users

## Response Patterns

Always use response helpers, never raw `c.json()`.

```typescript
import { success, notFound, ErrorCodes, ErrorMessages } from '../utils/responses.js';

// Success
return success(c, { user: userData });

// Not found
return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.USER_NOT_FOUND);
```

## Token Generation

Use utilities from `src/utils/jwt.ts`:

```typescript
import { generateUserToken, generateAdminToken } from '../utils/jwt.js';

// User token (7 day expiry)
const token = await generateUserToken(user.id, user.email, 'user');

// Admin token (24 hour expiry)
const token = await generateAdminToken(
  admin.id,
  admin.email,
  admin.role,
  admin.permissions
);
```

## Password Hashing

Use utilities from `src/utils/password.ts`:

```typescript
import { hashPassword, verifyPassword, timingSafeVerify } from '../utils/password.js';

// Hash password (signup)
const passwordHash = await hashPassword(plainPassword);

// Verify password (login)
const isValid = await verifyPassword(plainPassword, passwordHash);

// Timing-safe verify (prevents user enumeration)
const isValid = await timingSafeVerify(plainPassword, user?.password_hash || null);
```

## Testing

Run tests with:
```bash
bun test src/middleware/auth.test.ts
```

The test suite covers:
- Valid token acceptance
- Invalid token rejection
- Missing token handling
- Expired token handling
- Role-based access
- Permission-based access
- IDOR prevention (context variables)

## Security Notes

1. **JWT Secret:** Loaded from `JWT_SECRET` environment variable
2. **Token Expiry:**
   - User tokens: 7 days
   - Admin tokens: 24 hours
3. **Password Hashing:** Argon2id with configurable parameters
4. **PostgreSQL RLS:** Session variable set for defense-in-depth
5. **IDOR Prevention:** Primary defense is application-level filtering

## Environment Variables

Required in `.env`:

```bash
JWT_SECRET=your-secret-key-here-generate-with-openssl-rand-hex-32
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4
```

## Admin Permissions

See `src/config/permissions.ts` for complete list of permissions and role definitions.

**Available Roles:**
- `super_admin` - All permissions (wildcard `*`)
- `admin` - General administrative access
- `support` - Customer support (view-only)
- `finance` - Financial operations only

**Example Permissions:**
- `view_users`, `manage_users`, `suspend_users`
- `view_products`, `manage_products`
- `view_payments`, `process_refunds`, `manage_payouts`
- `view_analytics`, `export_reports`

## Common Patterns

### Protected User Endpoint
```typescript
app.get('/api/user/products', requireAuth, async (c) => {
  const userId = c.get('userId');

  const products = await db.query(
    'SELECT * FROM user_products WHERE user_id = $1',
    [userId]
  );

  return success(c, products.rows);
});
```

### Protected Admin Endpoint
```typescript
app.get('/admin/users',
  requireAdmin,
  requirePermission([Permissions.VIEW_USERS]),
  async (c) => {
    const adminId = c.get('adminId');

    const users = await db.query('SELECT * FROM users ORDER BY created_at DESC');

    return success(c, users.rows);
  }
);
```

### Update User Resource (IDOR Prevention)
```typescript
app.put('/api/products/:id', requireAuth, async (c) => {
  const userId = c.get('userId');
  const productId = c.req.param('id');
  const { name } = await c.req.json();

  // Verify ownership before update
  const check = await db.query(
    'SELECT id FROM user_products WHERE id = $1 AND user_id = $2',
    [productId, userId]
  );

  if (!check.rows[0]) {
    return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
  }

  // Update (still include user_id filter for safety)
  await db.query(
    'UPDATE user_products SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
    [name, productId, userId]
  );

  return success(c, { message: 'Product updated' });
});
```

## Future Enhancements

Potential improvements for future agents:

1. Token refresh mechanism
2. Token blacklist for logout
3. Multi-factor authentication (MFA)
4. Session management
5. IP-based rate limiting per user
6. Suspicious activity detection
7. Audit logging for authentication events

---

**Created by:** Agent C - Task 0.5
**Last Updated:** 2026-03-21
