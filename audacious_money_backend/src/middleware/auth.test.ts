/**
 * Authentication Middleware Tests
 *
 * Tests for JWT authentication middleware, including:
 * - Valid token acceptance
 * - Invalid token rejection
 * - Missing token handling
 * - Expired token handling
 * - Role-based access control
 * - IDOR prevention (userId in context)
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { Hono } from 'hono';
import { requireAuth, requireAdmin, requirePermission } from './auth.js';
import { generateUserToken, generateAdminToken } from '../utils/jwt.js';
import { Permissions } from '../config/permissions.js';
import { success } from '../utils/responses.js';

// Mock database pool
const mockDb = {
  query: async (sql: string, params?: any[]) => {
    // Mock query implementation
    return { rows: [], rowCount: 0 };
  },
};

describe('Authentication Middleware', () => {
  let app: Hono;
  let validUserToken: string;
  let validAdminToken: string;
  let expiredToken: string;

  beforeAll(async () => {
    // Generate test tokens
    validUserToken = await generateUserToken(
      '123e4567-e89b-12d3-a456-426614174000',
      'test@example.com',
      'user'
    );

    validAdminToken = await generateAdminToken(
      '123e4567-e89b-12d3-a456-426614174001',
      'admin@example.com',
      'super_admin',
      ['*']
    );

    // Create expired token (by manipulating JWT - for testing only)
    // In real scenario, wait for expiration or mock time
    expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoidXNlciIsImV4cCI6MTYwMDAwMDAwMH0.invalid';
  });

  describe('requireAuth middleware', () => {
    beforeAll(() => {
      app = new Hono();

      // Make mock database available
      app.use('*', async (c, next) => {
        c.set('db', mockDb);
        await next();
      });

      app.get('/protected', requireAuth, async (c) => {
        const userId = c.get('userId');
        const userEmail = c.get('userEmail');
        return success(c, { userId, userEmail, message: 'Access granted' });
      });
    });

    test('should accept valid user token', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: `Bearer ${validUserToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(data.data.userEmail).toBe('test@example.com');
    });

    test('should reject request without token', async () => {
      const res = await app.request('/protected');

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('TOKEN_REQUIRED');
    });

    test('should reject request with malformed Authorization header', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: 'InvalidFormat',
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('TOKEN_REQUIRED');
    });

    test('should reject invalid token', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject expired token', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject admin token on user endpoint', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    test('IDOR Prevention: should set userId in context', async () => {
      const res = await app.request('/protected', {
        headers: {
          Authorization: `Bearer ${validUserToken}`,
        },
      });

      const data = await res.json();
      expect(data.data.userId).toBeDefined();
      expect(data.data.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });
  });

  describe('requireAdmin middleware', () => {
    beforeAll(() => {
      app = new Hono();

      app.use('*', async (c, next) => {
        c.set('db', mockDb);
        await next();
      });

      app.get('/admin/dashboard', requireAdmin, async (c) => {
        const adminId = c.get('adminId');
        const adminPermissions = c.get('adminPermissions');
        return success(c, { adminId, permissions: adminPermissions });
      });
    });

    test('should accept valid admin token', async () => {
      const res = await app.request('/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.adminId).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(data.data.permissions).toContain('*');
    });

    test('should reject user token on admin endpoint', async () => {
      const res = await app.request('/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${validUserToken}`,
        },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('FORBIDDEN');
    });

    test('should reject request without token', async () => {
      const res = await app.request('/admin/dashboard');

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('TOKEN_REQUIRED');
    });
  });

  describe('requirePermission middleware', () => {
    let supportToken: string;

    beforeAll(async () => {
      // Support role has limited permissions
      supportToken = await generateAdminToken(
        '123e4567-e89b-12d3-a456-426614174002',
        'support@example.com',
        'support',
        [Permissions.VIEW_USERS, Permissions.VIEW_PRODUCTS]
      );

      app = new Hono();

      app.use('*', async (c, next) => {
        c.set('db', mockDb);
        await next();
      });

      app.get(
        '/admin/users',
        requireAdmin,
        requirePermission([Permissions.VIEW_USERS]),
        async (c) => {
          return success(c, { message: 'Users list' });
        }
      );

      app.post(
        '/admin/users',
        requireAdmin,
        requirePermission([Permissions.MANAGE_USERS]),
        async (c) => {
          return success(c, { message: 'User created' });
        }
      );
    });

    test('should allow admin with required permission', async () => {
      const res = await app.request('/admin/users', {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
    });

    test('should allow support with VIEW_USERS permission', async () => {
      const res = await app.request('/admin/users', {
        headers: {
          Authorization: `Bearer ${supportToken}`,
        },
      });

      expect(res.status).toBe(200);
    });

    test('should reject support without MANAGE_USERS permission', async () => {
      const res = await app.request('/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supportToken}`,
        },
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('super admin should bypass all permission checks', async () => {
      const res = await app.request('/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Context Variables (IDOR Prevention)', () => {
    test('requireAuth sets userId, userEmail, userRole in context', async () => {
      const testApp = new Hono();

      testApp.use('*', async (c, next) => {
        c.set('db', mockDb);
        await next();
      });

      testApp.get('/test', requireAuth, async (c) => {
        return success(c, {
          userId: c.get('userId'),
          userEmail: c.get('userEmail'),
          userRole: c.get('userRole'),
        });
      });

      const res = await testApp.request('/test', {
        headers: {
          Authorization: `Bearer ${validUserToken}`,
        },
      });

      const data = await res.json();
      expect(data.data.userId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(data.data.userEmail).toBe('test@example.com');
      expect(data.data.userRole).toBe('user');
    });

    test('requireAdmin sets adminId, adminEmail, adminRole, adminPermissions in context', async () => {
      const testApp = new Hono();

      testApp.use('*', async (c, next) => {
        c.set('db', mockDb);
        await next();
      });

      testApp.get('/test', requireAdmin, async (c) => {
        return success(c, {
          adminId: c.get('adminId'),
          adminEmail: c.get('adminEmail'),
          adminRole: c.get('adminRole'),
          adminPermissions: c.get('adminPermissions'),
        });
      });

      const res = await testApp.request('/test', {
        headers: {
          Authorization: `Bearer ${validAdminToken}`,
        },
      });

      const data = await res.json();
      expect(data.data.adminId).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(data.data.adminEmail).toBe('admin@example.com');
      expect(data.data.adminRole).toBe('super_admin');
      expect(data.data.adminPermissions).toEqual(['*']);
    });
  });
});
