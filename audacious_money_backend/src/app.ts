/**
 * Audacious Money Backend API
 *
 * Main application setup with security-first middleware configuration
 */

import { Hono } from 'hono';
import { logger } from 'hono/logger';
import {
  securityHeadersMiddleware,
  corsMiddleware,
  requestIdMiddleware,
} from './middleware/security.js';
import { rateLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { getDatabase, checkDatabaseHealth } from './db/connection.js';
import { success } from './utils/responses.js';
import authRoutes from './routes/auth.js';
import webhookRoutes from './routes/webhooks.js';
import testEmailRoutes from './routes/test-email.js';
import productRoutes from './routes/products.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';

// Create Hono app
const app = new Hono();

// ==========================================
// Global Middleware (Order matters!)
// ==========================================

// 1. Security headers (apply to all routes)
app.use('*', securityHeadersMiddleware());

// 2. Request ID (for tracing and logging)
app.use('*', requestIdMiddleware);

// 3. Logger (log all requests)
app.use('*', logger());

// 4. CORS (allow only configured origins)
app.use('*', corsMiddleware());

// 5. Make database available in context
app.use('*', async (c, next) => {
  c.set('db', getDatabase());
  await next();
});

// ==========================================
// Rate Limiting (Stricter for auth endpoints)
// ==========================================

// Webhook routes (must be before rate limiting)
app.route('/webhooks', webhookRoutes);

// Auth endpoints: 5 requests per minute
app.use('/auth/*', rateLimiter({ max: 5, window: 60 }));

// All other endpoints: 100 requests per minute
app.use('*', rateLimiter({ max: 100, window: 60 }));

// ==========================================
// Health Check Endpoint
// ==========================================

app.get('/health', async (c) => {
  const dbHealth = await checkDatabaseHealth();

  if (!dbHealth.healthy) {
    return c.json(
      {
        status: 'unhealthy',
        database: {
          healthy: false,
          error: dbHealth.error,
        },
      },
      503
    );
  }

  return success(c, {
    status: 'healthy',
    database: {
      healthy: true,
      responseTime: dbHealth.responseTime,
    },
    timestamp: new Date().toISOString(),
  });
});

// ==========================================
// API Routes
// ==========================================

app.route('/auth', authRoutes);

// Public product routes
app.route('/products', productRoutes);

// Protected user routes
app.route('/users', userRoutes);

// Test email routes (DELETE IN PRODUCTION!)
app.route('/test', testEmailRoutes);

// Admin routes
app.route('/admin', adminRoutes);

// ==========================================
// Error Handling (Must be last)
// ==========================================

// 404 handler
app.notFound(notFoundHandler);

// Global error handler
app.onError(errorHandler);

// ==========================================
// Export
// ==========================================

export default app;

/**
 * AUTHENTICATION MIDDLEWARE USAGE
 *
 * The authentication middleware is now available for protecting routes.
 * Import from './middleware/auth.js':
 *
 * import { requireAuth, requireAdmin, requirePermission } from './middleware/auth.js';
 *
 * PROTECTED USER ROUTES:
 * ----------------------
 * app.get('/api/user/profile', requireAuth, async (c) => {
 *   const userId = c.get('userId');       // Get authenticated user ID
 *   const userEmail = c.get('userEmail'); // Get user email
 *   // CRITICAL: Always filter by userId in queries
 *   const profile = await db.query(
 *     'SELECT * FROM users WHERE id = $1',
 *     [userId]
 *   );
 *   return success(c, profile.rows[0]);
 * });
 *
 * PROTECTED ADMIN ROUTES:
 * -----------------------
 * import { Permissions } from './config/permissions.js';
 *
 * app.get('/admin/users', requireAdmin, requirePermission([Permissions.VIEW_USERS]), async (c) => {
 *   const adminId = c.get('adminId');
 *   const adminPermissions = c.get('adminPermissions');
 *   // Admin logic
 * });
 *
 * IDOR PREVENTION PATTERN:
 * ------------------------
 * ❌ WRONG (vulnerable):
 * const product = await db.query('SELECT * FROM user_products WHERE id = $1', [productId]);
 *
 * ✅ RIGHT (secure):
 * const userId = c.get('userId');
 * const product = await db.query(
 *   'SELECT * FROM user_products WHERE id = $1 AND user_id = $2',
 *   [productId, userId]
 * );
 * if (!product.rows[0]) {
 *   return notFound(c, ErrorCodes.NOT_FOUND, ErrorMessages.PRODUCT_NOT_FOUND);
 * }
 */
